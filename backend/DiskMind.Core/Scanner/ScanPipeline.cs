using System.Security.Cryptography;
using System.Threading.Channels;
using Dapper;
using Microsoft.Data.Sqlite;

namespace DiskMind.Core.Scanner;

public class ScanStatus
{
    public string SessionId { get; set; } = "";
    public bool IsRunning { get; set; }
    public long FilesScanned { get; set; }
    public long FoldersScanned { get; set; }
    public long BytesScanned { get; set; }
    public long TotalDiskBytes { get; set; }  // for progress bar
    public string CurrentFile { get; set; } = "";
    public string Status { get; set; } = "idle";
}

public class ScanSession
{
    public string Id { get; set; } = "";
    public string RootPath { get; set; } = "";
    public string StartedAt { get; set; } = "";
    public string? CompletedAt { get; set; }
    public string Status { get; set; } = "";
    public long FilesScanned { get; set; }
    public long FoldersScanned { get; set; }
    public long TotalBytes { get; set; }
}

public class ScanPipeline
{
    private readonly string _connStr;
    private volatile bool _stopRequested;
    private volatile bool _isRunning;
    private ScanStatus _status = new();
    private readonly object _lock = new();

    public ScanPipeline(SqliteConnection conn) => _connStr = conn.ConnectionString;

    private static string ClassifyFile(string ext, string path)
    {
        ext = ext.ToLowerInvariant().TrimStart('.');
        var pl = path.ToLowerInvariant();

        if (pl.Contains("\\windows\\temp") || pl.Contains("\\appdata\\local\\temp")) return "Temporary Files";
        if (pl.Contains("\\windows\\softwaredistribution")) return "Windows Update";
        if (pl.Contains("\\windows\\winsxs")) return "WinSxS";
        if (pl.Contains("\\windows\\logs")) return "System Logs";
        if (pl.Contains("\\appdata\\local\\microsoft\\windows\\inetcache")) return "Browser Cache";
        if (pl.Contains("\\appdata\\local\\google\\chrome\\user data\\default\\cache")) return "Browser Cache";
        if (pl.Contains("\\appdata\\local\\microsoft\\edge\\user data\\default\\cache")) return "Browser Cache";
        if (pl.Contains("node_modules")) return "Developer Tools";
        if (pl.Contains("\\.cargo\\registry") || pl.Contains("\\target\\debug") || pl.Contains("\\target\\release")) return "Developer Tools";
        if (pl.Contains("\\docker\\")) return "Developer Tools";
        if (pl.Contains("steamapps") || pl.Contains("epicgames") || pl.Contains("\\games\\")) return "Gaming";
        if (pl.Contains("\\appdata\\local\\microsoft\\onedrive")) return "Cloud Storage";

        return ext switch
        {
            "tmp" or "temp" or "bak" or "old" => "Temporary Files",
            "log" => "System Logs",
            "dmp" or "mdmp" => "Crash Dumps",
            "mp4" or "mkv" or "avi" or "mov" or "wmv" or "flv" or "webm" => "Video",
            "mp3" or "flac" or "wav" or "aac" or "ogg" or "wma" => "Audio",
            "jpg" or "jpeg" or "png" or "gif" or "bmp" or "tiff" or "webp" or "raw" or "heic" => "Images",
            "pdf" or "doc" or "docx" or "xls" or "xlsx" or "ppt" or "pptx" or "txt" or "odt" => "Documents",
            "zip" or "rar" or "7z" or "tar" or "gz" or "bz2" => "Archives",
            "exe" or "msi" or "dll" => "Executables",
            "cs" or "py" or "js" or "ts" or "java" or "cpp" or "c" or "h" or "rs" or "go" or "rb" => "Source Code",
            _ => "Other"
        };
    }

    public void RequestStop() => _stopRequested = true;

    public ScanStatus GetStatus() { lock (_lock) return _status; }

    public async Task<IEnumerable<ScanSession>> GetSessionsAsync()
    {
        using var conn = new SqliteConnection(_connStr);
        return await conn.QueryAsync<ScanSession>(
            "SELECT id, root_path as RootPath, started_at as StartedAt, completed_at as CompletedAt, status, files_scanned as FilesScanned, folders_scanned as FoldersScanned, total_bytes as TotalBytes FROM scan_sessions ORDER BY started_at DESC LIMIT 50");
    }

    public async Task<string> StartScanAsync(string rootPath)
    {
        if (_isRunning) throw new InvalidOperationException("A scan is already running.");

        var sessionId = Guid.NewGuid().ToString("N");
        _stopRequested = false;
        _isRunning = true;

        // Get total disk bytes for progress bar
        long totalDiskBytes = 0;
        try
        {
            var root = Path.GetPathRoot(rootPath) ?? rootPath;
            var drive = new DriveInfo(root);
            totalDiskBytes = drive.TotalSize;
        }
        catch { }

        lock (_lock) _status = new ScanStatus
        {
            SessionId = sessionId,
            IsRunning = true,
            Status = "running",
            TotalDiskBytes = totalDiskBytes
        };

        using (var conn = new SqliteConnection(_connStr))
        {
            await conn.ExecuteAsync(
                "INSERT INTO scan_sessions(id,root_path,started_at,status) VALUES(@id,@p,@t,'running')",
                new { id = sessionId, p = rootPath, t = DateTime.UtcNow.ToString("o") });
        }

        _ = Task.Run(async () =>
        {
            try { await RunScanAsync(sessionId, rootPath, totalDiskBytes); }
            finally { _isRunning = false; }
        });

        return sessionId;
    }

    private record FileRecord(string id, string session_id, string full_path, string file_name,
        string extension, long size_bytes, string last_modified, string category);

    private async Task RunScanAsync(string sessionId, string rootPath, long totalDiskBytes)
    {
        // Enable WAL mode + performance pragmas for this session
        await using (var pragmaConn = new SqliteConnection(_connStr))
        {
            await pragmaConn.OpenAsync();
            await pragmaConn.ExecuteAsync("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-32000; PRAGMA temp_store=MEMORY;");
        }

        long files = 0, folders = 0, bytes = 0;

        // Producer-consumer: enumeration thread -> channel -> writer thread
        // This means disk reads and DB writes happen concurrently
        var channel = Channel.CreateBounded<FileRecord>(new BoundedChannelOptions(8000)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = true
        });

        // Consumer: reads batches from channel and writes to SQLite
        var writerTask = Task.Run(async () =>
        {
            var batch = new List<FileRecord>(2000);
            await foreach (var record in channel.Reader.ReadAllAsync())
            {
                batch.Add(record);
                if (batch.Count >= 2000)
                {
                    await FlushBatchAsync(batch);
                    batch.Clear();
                }
            }
            if (batch.Count > 0) await FlushBatchAsync(batch);
        });

        try
        {
            // Producer: fast directory enumeration using EnumerateFiles (lazy, no array allocation)
            var dirs = new Stack<string>();
            dirs.Push(rootPath);

            while (dirs.Count > 0 && !_stopRequested)
            {
                var dir = dirs.Pop();
                try
                {
                    folders++;

                    // Enumerate subdirectories lazily
                    try
                    {
                        foreach (var sub in Directory.EnumerateDirectories(dir))
                            dirs.Push(sub);
                    }
                    catch { }

                    // Enumerate files lazily — no array allocation per dir
                    try
                    {
                        foreach (var file in Directory.EnumerateFiles(dir))
                        {
                            if (_stopRequested) break;
                            try
                            {
                                var info = new FileInfo(file);
                                if (!info.Exists) continue;
                                var size = info.Length;
                                var ext = info.Extension;
                                bytes += size;
                                files++;

                                // Update status every 500 files
                                if (files % 500 == 0)
                                {
                                    lock (_lock)
                                    {
                                        _status.FilesScanned = files;
                                        _status.FoldersScanned = folders;
                                        _status.BytesScanned = bytes;
                                        _status.CurrentFile = file;
                                        _status.TotalDiskBytes = totalDiskBytes;
                                    }
                                }

                                await channel.Writer.WriteAsync(new FileRecord(
                                    Guid.NewGuid().ToString("N"),
                                    sessionId, file, info.Name, ext, size,
                                    info.LastWriteTimeUtc.ToString("o"),
                                    ClassifyFile(ext, file)
                                ));
                            }
                            catch { }
                        }
                    }
                    catch { }
                }
                catch { }
            }

            // Final status update
            lock (_lock)
            {
                _status.FilesScanned = files;
                _status.FoldersScanned = folders;
                _status.BytesScanned = bytes;
            }
        }
        finally
        {
            channel.Writer.Complete();
        }

        // Wait for all writes to finish
        await writerTask;

        // Post-scan analysis (fast — runs after all files are inserted)
        await DetectDuplicatesAsync(sessionId);
        await AnalyzeDeveloperStorageAsync(sessionId);

        using var conn = new SqliteConnection(_connStr);
        await conn.ExecuteAsync(
            "UPDATE scan_sessions SET status='completed', completed_at=@t, files_scanned=@f, folders_scanned=@d, total_bytes=@b WHERE id=@id",
            new { t = DateTime.UtcNow.ToString("o"), f = files, d = folders, b = bytes, id = sessionId });

        lock (_lock) { _status.IsRunning = false; _status.Status = "completed"; _status.FilesScanned = files; _status.BytesScanned = bytes; }
    }

    private async Task FlushBatchAsync(List<FileRecord> batch)
    {
        using var conn = new SqliteConnection(_connStr);
        await conn.OpenAsync();
        using var tx = conn.BeginTransaction();
        foreach (var item in batch)
        {
            await conn.ExecuteAsync(
                "INSERT OR IGNORE INTO scanned_files(id,session_id,full_path,file_name,extension,size_bytes,last_modified,category) VALUES(@id,@session_id,@full_path,@file_name,@extension,@size_bytes,@last_modified,@category)",
                new { id = item.id, session_id = item.session_id, full_path = item.full_path, file_name = item.file_name,
                      extension = item.extension, size_bytes = item.size_bytes, last_modified = item.last_modified, category = item.category },
                tx);
        }
        await tx.CommitAsync();
    }

    private async Task DetectDuplicatesAsync(string sessionId)
    {
        try
        {
            using var conn = new SqliteConnection(_connStr);

            // Only look at sizes that appear more than once (huge speedup — skips unique files)
            var sizeGroups = await conn.QueryAsync<dynamic>(
                @"SELECT size_bytes FROM scanned_files
                  WHERE session_id=@s AND size_bytes > 65536
                  GROUP BY size_bytes HAVING COUNT(*) > 1
                  ORDER BY (size_bytes * COUNT(*)) DESC LIMIT 300",
                new { s = sessionId });

            if (!sizeGroups.Any()) return;

            var candidates = new List<(string path, long size)>();
            foreach (var sg in sizeGroups)
            {
                long sz = (long)sg.size_bytes;
                var files = await conn.QueryAsync<dynamic>(
                    "SELECT full_path FROM scanned_files WHERE session_id=@s AND size_bytes=@sz LIMIT 30",
                    new { s = sessionId, sz });
                foreach (var f in files)
                    candidates.Add(((string)f.full_path, sz));
                if (candidates.Count >= 3000) break;
            }

            var hashGroups = new System.Collections.Concurrent.ConcurrentDictionary<string,
                System.Collections.Concurrent.ConcurrentBag<string>>();
            var sem = new SemaphoreSlim(8); // 8-way parallel hashing
            var tasks = candidates.Select(async c =>
            {
                await sem.WaitAsync();
                try
                {
                    using var fs = File.OpenRead(c.path);
                    using var sha = SHA256.Create();
                    var h = await sha.ComputeHashAsync(fs);
                    var key = $"{c.size}_{Convert.ToHexString(h)}";
                    hashGroups.GetOrAdd(key, _ => new()).Add(c.path);
                }
                catch { }
                finally { sem.Release(); }
            });
            await Task.WhenAll(tasks);

            var dupeGroups = hashGroups.Where(g => g.Value.Count > 1).ToList();
            if (!dupeGroups.Any()) return;

            await conn.OpenAsync();
            using var tx = conn.BeginTransaction();
            foreach (var group in dupeGroups)
            {
                var hash = group.Key;
                var paths = group.Value.ToList();
                var sizeStr = hash.Split('_')[0];
                long fileSize = long.TryParse(sizeStr, out var sz2) ? sz2 : 0;
                long wasted = fileSize * (paths.Count - 1);
                await conn.ExecuteAsync(
                    "INSERT OR IGNORE INTO duplicate_groups(id,session_id,file_hash,file_count,total_wasted_bytes,file_size_bytes) VALUES(@id,@s,@h,@c,@w,@fs)",
                    new { id = Guid.NewGuid().ToString("N"), s = sessionId, h = hash, c = paths.Count, w = wasted, fs = fileSize }, tx);
                foreach (var p in paths)
                    await conn.ExecuteAsync(
                        "UPDATE scanned_files SET is_duplicate=1, duplicate_hash=@h WHERE session_id=@s AND full_path=@p",
                        new { h = hash, s = sessionId, p }, tx);
            }
            await tx.CommitAsync();
        }
        catch { }
    }

    private async Task AnalyzeDeveloperStorageAsync(string sessionId)
    {
        try
        {
            using var conn = new SqliteConnection(_connStr);

            var nodeMods = await conn.QueryAsync<dynamic>(
                "SELECT full_path, size_bytes FROM scanned_files WHERE session_id=@s AND full_path LIKE '%node_modules%'",
                new { s = sessionId });
            var nodeGroups = nodeMods
                .GroupBy(f => { string p = f.full_path; var idx = p.IndexOf("node_modules", StringComparison.OrdinalIgnoreCase); return idx > 0 ? p[..(idx + 12)] : p; })
                .Select(g => new { path = g.Key, size = g.Sum(x => (long)x.size_bytes) });
            foreach (var n in nodeGroups)
            {
                string nPath = n.path; long nSize = n.size;
                await conn.ExecuteAsync(
                    "INSERT OR IGNORE INTO developer_storage(id,session_id,tool_type,name,path,size_bytes) VALUES(@id,@s,'node_modules','node_modules',@p,@sz)",
                    new { id = Guid.NewGuid().ToString("N"), s = sessionId, p = nPath, sz = nSize });
            }

            var rustTargets = await conn.QueryAsync<dynamic>(
                "SELECT size_bytes FROM scanned_files WHERE session_id=@s AND (full_path LIKE '%\\target\\debug\\%' OR full_path LIKE '%\\target\\release\\%')",
                new { s = sessionId });
            long rustTotal = rustTargets.Sum(x => (long)x.size_bytes);
            if (rustTotal > 0) await conn.ExecuteAsync(
                "INSERT OR IGNORE INTO developer_storage(id,session_id,tool_type,name,size_bytes) VALUES(@id,@s,'rust','Rust Build Artifacts',@sz)",
                new { id = Guid.NewGuid().ToString("N"), s = sessionId, sz = rustTotal });

            var dotnetBuild = await conn.QueryAsync<dynamic>(
                "SELECT size_bytes FROM scanned_files WHERE session_id=@s AND (full_path LIKE '%\\bin\\Debug\\%' OR full_path LIKE '%\\bin\\Release\\%' OR full_path LIKE '%\\obj\\%')",
                new { s = sessionId });
            long dotnetTotal = dotnetBuild.Sum(x => (long)x.size_bytes);
            if (dotnetTotal > 0) await conn.ExecuteAsync(
                "INSERT OR IGNORE INTO developer_storage(id,session_id,tool_type,name,size_bytes) VALUES(@id,@s,'dotnet','Dotnet Build Output',@sz)",
                new { id = Guid.NewGuid().ToString("N"), s = sessionId, sz = dotnetTotal });

            var pyVenvs = await conn.QueryAsync<dynamic>(
                "SELECT size_bytes FROM scanned_files WHERE session_id=@s AND (full_path LIKE '%\\venv\\%' OR full_path LIKE '%\\.venv\\%' OR full_path LIKE '%\\Lib\\site-packages\\%')",
                new { s = sessionId });
            long pyTotal = pyVenvs.Sum(x => (long)x.size_bytes);
            if (pyTotal > 0) await conn.ExecuteAsync(
                "INSERT OR IGNORE INTO developer_storage(id,session_id,tool_type,name,size_bytes) VALUES(@id,@s,'python','Python Environments',@sz)",
                new { id = Guid.NewGuid().ToString("N"), s = sessionId, sz = pyTotal });
        }
        catch { }
    }
}

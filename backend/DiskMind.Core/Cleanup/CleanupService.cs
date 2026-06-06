using Dapper;
using Microsoft.Data.Sqlite;

namespace DiskMind.Core.Cleanup;

public class CleanupRecommendation
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Category { get; set; } = "";
    public string RiskLevel { get; set; } = "Safe";
    public int RiskScore { get; set; } = 1;
    public long EstimatedBytes { get; set; }
    public List<string> Paths { get; set; } = new();
}

public class CleanupResult
{
    public string ExecutionId { get; set; } = "";
    public int FilesDeleted { get; set; }
    public long BytesFreed { get; set; }
    public List<string> Errors { get; set; } = new();
    public string RollbackPath { get; set; } = "";
}

public class CleanupHistory
{
    public string Id { get; set; } = "";
    public string ExecutedAt { get; set; } = "";
    public int FilesDeleted { get; set; }
    public long BytesFreed { get; set; }
    public string Status { get; set; } = "";
    public string? RollbackPath { get; set; }
}

public class CleanupService
{
    private readonly string _connStr;

    private static readonly string[] ProtectedPaths = {
        @"C:\Windows\System32",
        @"C:\Windows\SysWOW64",
        @"C:\Program Files",
        @"C:\Program Files (x86)",
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)
            .Replace("Roaming", "Roaming\\Microsoft")
    };

    public CleanupService(SqliteConnection conn) => _connStr = conn.ConnectionString;

    public async Task<List<CleanupRecommendation>> GetRecommendationsAsync(string sessionId)
    {
        using var conn = new SqliteConnection(_connStr);
        var recs = new List<CleanupRecommendation>();

        // Temp files
        var tempSize = await conn.ExecuteScalarAsync<long>(
            "SELECT COALESCE(SUM(size_bytes),0) FROM scanned_files WHERE session_id=@s AND category='Temporary Files'",
            new { s = sessionId });
        if (tempSize > 0)
            recs.Add(new CleanupRecommendation
            {
                Title = "User Temporary Directory",
                Description = "Safe to remove - Windows recreates temp files automatically.",
                Category = "Temporary Files",
                RiskLevel = "Safe", RiskScore = 1,
                EstimatedBytes = tempSize,
                Paths = new List<string> {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Temp")
                }
            });

        var systemTemp = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Temp");
        if (Directory.Exists(systemTemp))
        {
            long sz = DirSize(systemTemp);
            if (sz > 0)
                recs.Add(new CleanupRecommendation
                {
                    Title = "Windows System Temp Files",
                    Description = "Windows system-level temporary files.",
                    Category = "Temporary Files",
                    RiskLevel = "Safe", RiskScore = 1,
                    EstimatedBytes = sz,
                    Paths = new List<string> { systemTemp }
                });
        }

        // Browser caches
        var browserCacheSize = await conn.ExecuteScalarAsync<long>(
            "SELECT COALESCE(SUM(size_bytes),0) FROM scanned_files WHERE session_id=@s AND category='Browser Cache'",
            new { s = sessionId });
        if (browserCacheSize > 0)
            recs.Add(new CleanupRecommendation
            {
                Title = "Browser Cache Files",
                Description = "Cached website data from Chrome, Edge, Firefox etc.",
                Category = "Browser Cache",
                RiskLevel = "Safe", RiskScore = 1,
                EstimatedBytes = browserCacheSize
            });

        // Windows Update cache
        var wuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "SoftwareDistribution", "Download");
        if (Directory.Exists(wuPath))
        {
            long sz = DirSize(wuPath);
            if (sz > 10_000_000)
                recs.Add(new CleanupRecommendation
                {
                    Title = "Windows Update Download Cache",
                    Description = "Downloaded Windows update packages no longer needed.",
                    Category = "Windows Update",
                    RiskLevel = "Moderate", RiskScore = 3,
                    EstimatedBytes = sz,
                    Paths = new List<string> { wuPath }
                });
        }

        // Duplicates
        var dupeStats = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT COALESCE(SUM(total_wasted_bytes),0) as wasted, COUNT(*) as cnt FROM duplicate_groups WHERE session_id=@s",
            new { s = sessionId });
        if (dupeStats != null && (long)(dupeStats.wasted ?? 0) > 0)
            recs.Add(new CleanupRecommendation
            {
                Title = $"Duplicate Files ({dupeStats.cnt} groups)",
                Description = "Files with identical content detected. Keep one copy, remove duplicates.",
                Category = "Duplicates",
                RiskLevel = "Moderate", RiskScore = 4,
                EstimatedBytes = (long)(dupeStats.wasted ?? 0)
            });

        // Developer: node_modules
        var nodeSize = await conn.ExecuteScalarAsync<long>(
            "SELECT COALESCE(SUM(size_bytes),0) FROM developer_storage WHERE session_id=@s AND tool_type='node_modules'",
            new { s = sessionId });
        if (nodeSize > 100_000_000)
            recs.Add(new CleanupRecommendation
            {
                Title = "Stale node_modules Directories",
                Description = "Old node_modules folders. Run 'npm install' to restore when needed.",
                Category = "Developer Tools",
                RiskLevel = "Caution", RiskScore = 5,
                EstimatedBytes = nodeSize
            });

        return recs.OrderBy(r => r.RiskScore).ToList();
    }

    public async Task<CleanupResult> ExecuteCleanupAsync(List<string> recommendationIds, string sessionId)
    {
        var executionId = Guid.NewGuid().ToString("N");
        var rollbackDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "DiskMind", "rollback", executionId);
        Directory.CreateDirectory(rollbackDir);

        var result = new CleanupResult { ExecutionId = executionId, RollbackPath = rollbackDir };
        var recs = await GetRecommendationsAsync(sessionId);
        var toProcess = recommendationIds.Any()
            ? recs.Where(r => recommendationIds.Contains(r.Id)).ToList()
            : recs.Where(r => r.RiskScore <= 2).ToList();

        using var conn = new SqliteConnection(_connStr);
        await conn.OpenAsync();
        using var tx = conn.BeginTransaction();

        foreach (var rec in toProcess)
        {
            foreach (var path in rec.Paths)
            {
                if (IsProtected(path)) continue;
                try
                {
                    if (File.Exists(path))
                    {
                        var backupPath = Path.Combine(rollbackDir, Guid.NewGuid().ToString("N") + Path.GetExtension(path));
                        try { File.Move(path, backupPath); } catch { File.Delete(path); backupPath = ""; }
                        var info = new FileInfo(backupPath.Length > 0 ? backupPath : path);
                        result.FilesDeleted++;
                        result.BytesFreed += rec.EstimatedBytes / Math.Max(rec.Paths.Count, 1);
                        await conn.ExecuteAsync(
                            "INSERT INTO cleanup_items(id,execution_id,original_path,backup_path,size_bytes) VALUES(@id,@eid,@op,@bp,@sz)",
                            new { id = Guid.NewGuid().ToString("N"), eid = executionId, op = path, bp = backupPath, sz = info.Exists ? info.Length : 0 }, tx);
                    }
                    else if (Directory.Exists(path))
                    {
                        var files = Directory.GetFiles(path, "*", SearchOption.AllDirectories);
                        foreach (var f in files)
                        {
                            try
                            {
                                if (IsProtected(f)) continue;
                                var fi = new FileInfo(f);
                                var backupPath = Path.Combine(rollbackDir, Guid.NewGuid().ToString("N") + fi.Extension);
                                try { File.Move(f, backupPath); } catch { File.Delete(f); backupPath = ""; }
                                result.FilesDeleted++;
                                result.BytesFreed += fi.Length;
                                await conn.ExecuteAsync(
                                    "INSERT INTO cleanup_items(id,execution_id,original_path,backup_path,size_bytes) VALUES(@id,@eid,@op,@bp,@sz)",
                                    new { id = Guid.NewGuid().ToString("N"), eid = executionId, op = f, bp = backupPath, sz = fi.Length }, tx);
                            }
                            catch (Exception ex) { result.Errors.Add($"{f}: {ex.Message}"); }
                        }
                    }
                }
                catch (Exception ex) { result.Errors.Add($"{path}: {ex.Message}"); }
            }
        }

        await conn.ExecuteAsync(
            "INSERT INTO cleanup_executions(id,executed_at,session_id,files_deleted,bytes_freed,rollback_path,status) VALUES(@id,@t,@s,@f,@b,@r,'completed')",
            new { id = executionId, t = DateTime.UtcNow.ToString("o"), s = sessionId, f = result.FilesDeleted, b = result.BytesFreed, r = rollbackDir }, tx);

        await tx.CommitAsync();
        return result;
    }

    public async Task<List<CleanupHistory>> GetHistoryAsync()
    {
        using var conn = new SqliteConnection(_connStr);
        var rows = await conn.QueryAsync<CleanupHistory>(
            "SELECT id, executed_at as ExecutedAt, files_deleted as FilesDeleted, bytes_freed as BytesFreed, status as Status, rollback_path as RollbackPath FROM cleanup_executions ORDER BY executed_at DESC LIMIT 50");
        return rows.ToList();
    }

    public async Task<object> RollbackAsync(string executionId)
    {
        using var conn = new SqliteConnection(_connStr);
        var items = await conn.QueryAsync<dynamic>(
            "SELECT original_path, backup_path FROM cleanup_items WHERE execution_id=@id AND backup_path IS NOT NULL AND backup_path != ''",
            new { id = executionId });

        int restored = 0;
        var errors = new List<string>();
        foreach (var item in items)
        {
            string orig = item.original_path;
            string backup = item.backup_path;
            try
            {
                if (File.Exists(backup))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(orig)!);
                    File.Move(backup, orig, true);
                    restored++;
                }
            }
            catch (Exception ex) { errors.Add($"{orig}: {ex.Message}"); }
        }

        await conn.ExecuteAsync("UPDATE cleanup_executions SET status='rolled_back' WHERE id=@id", new { id = executionId });
        return new { restored, errors };
    }

    public async Task<object> GetDuplicatesAsync(string sessionId)
    {
        using var conn = new SqliteConnection(_connStr);
        var groups = await conn.QueryAsync<dynamic>(
            "SELECT * FROM duplicate_groups WHERE session_id=@s ORDER BY total_wasted_bytes DESC LIMIT 200",
            new { s = sessionId });

        var result = new List<object>();
        foreach (var g in groups)
        {
            string hash = g.file_hash;
            var files = await conn.QueryAsync<dynamic>(
                "SELECT full_path, size_bytes, last_modified FROM scanned_files WHERE session_id=@s AND duplicate_hash=@h",
                new { s = sessionId, h = hash });
            result.Add(new
            {
                groupId = g.id,
                fileHash = hash,
                fileCount = g.file_count,
                wastedBytes = g.total_wasted_bytes,
                fileSizeBytes = g.file_size_bytes,
                files = files
            });
        }
        return result;
    }

    private static bool IsProtected(string path)
    {
        return ProtectedPaths.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase));
    }

    private static long DirSize(string path)
    {
        try
        {
            return Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories)
                .Sum(f => { try { return new FileInfo(f).Length; } catch { return 0; } });
        }
        catch { return 0; }
    }
}

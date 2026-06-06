using Dapper;
using Microsoft.Data.Sqlite;

namespace DiskMind.Core.Intelligence;

public class StorageAllocation
{
    public string Category { get; set; } = "";
    public long TotalBytes { get; set; }
    public long FileCount { get; set; }
    public double Percentage { get; set; }
    public string RecoverableLabel { get; set; } = "";
}

public class FileTypeInfo
{
    public string Extension { get; set; } = "";
    public long TotalBytes { get; set; }
    public long Count { get; set; }
}

public class StorageRecommendation
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Category { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public long EstimatedBytes { get; set; }
    public string RiskLevel { get; set; } = "Safe";
    public int RiskScore { get; set; }
    public List<string> Paths { get; set; } = new();
}

public class IntelligenceReport
{
    public string SessionId { get; set; } = "";
    public long TotalBytes { get; set; }
    public long TotalFiles { get; set; }
    public int HealthScore { get; set; }
    public List<StorageAllocation> Allocations { get; set; } = new();
    public List<FileTypeInfo> FileTypes { get; set; } = new();
    public List<StorageRecommendation> Recommendations { get; set; } = new();
    public Dictionary<string, long> ExtensionAnalysis { get; set; } = new();
    public long TotalDuplicateBytes { get; set; }
    public int DuplicateGroupCount { get; set; }
}

public class IntelligenceEngine
{
    private readonly string _connStr;
    public IntelligenceEngine(string connStr) => _connStr = connStr;

    public async Task<IntelligenceReport> GenerateIntelligenceReportAsync(string sessionId)
    {
        using var conn = new SqliteConnection(_connStr);

        var totalStats = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT COALESCE(SUM(size_bytes),0) as total, COUNT(*) as cnt FROM scanned_files WHERE session_id=@s",
            new { s = sessionId });

        long totalBytes = totalStats?.total ?? 0;
        long totalFiles = totalStats?.cnt ?? 0;

        // Category allocations
        var categories = await conn.QueryAsync<dynamic>(
            @"SELECT category, SUM(size_bytes) as total_bytes, COUNT(*) as file_count
              FROM scanned_files WHERE session_id=@s AND category IS NOT NULL
              GROUP BY category ORDER BY total_bytes DESC",
            new { s = sessionId });

        var allocations = categories.Select(c => new StorageAllocation
        {
            Category = c.category ?? "Other",
            TotalBytes = (long)(c.total_bytes ?? 0),
            FileCount = (long)(c.file_count ?? 0),
            Percentage = totalBytes > 0 ? Math.Round((double)(c.total_bytes ?? 0) / totalBytes * 100, 1) : 0
        }).ToList();

        // File types
        var fileTypes = await conn.QueryAsync<dynamic>(
            @"SELECT LOWER(extension) as ext, SUM(size_bytes) as total_bytes, COUNT(*) as cnt
              FROM scanned_files WHERE session_id=@s AND extension IS NOT NULL AND extension != ''
              GROUP BY LOWER(extension) ORDER BY total_bytes DESC LIMIT 30",
            new { s = sessionId });

        var ftList = fileTypes.Select(ft => new FileTypeInfo
        {
            Extension = ft.ext ?? "",
            TotalBytes = (long)(ft.total_bytes ?? 0),
            Count = (long)(ft.cnt ?? 0)
        }).ToList();

        // Extension analysis dict
        var extDict = ftList.ToDictionary(x => x.Extension, x => x.TotalBytes);

        // Duplicates
        var dupeStats = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT COALESCE(SUM(total_wasted_bytes),0) as wasted, COUNT(*) as groups FROM duplicate_groups WHERE session_id=@s",
            new { s = sessionId });
        long dupeBytes = dupeStats?.wasted ?? 0;
        int dupeGroups = (int)(dupeStats?.groups ?? 0);

        // Health score
        int health = ComputeHealthScore(totalBytes, allocations, dupeBytes);

        // Recommendations
        var recs = GenerateRecommendations(allocations, dupeBytes, dupeGroups);

        return new IntelligenceReport
        {
            SessionId = sessionId,
            TotalBytes = totalBytes,
            TotalFiles = totalFiles,
            HealthScore = health,
            Allocations = allocations,
            FileTypes = ftList,
            ExtensionAnalysis = extDict,
            Recommendations = recs,
            TotalDuplicateBytes = dupeBytes,
            DuplicateGroupCount = dupeGroups
        };
    }

    private static int ComputeHealthScore(long totalBytes, List<StorageAllocation> allocations, long dupeBytes)
    {
        int score = 100;
        var tempAlloc = allocations.FirstOrDefault(a => a.Category == "Temporary Files");
        var logAlloc = allocations.FirstOrDefault(a => a.Category == "System Logs");
        var dumpAlloc = allocations.FirstOrDefault(a => a.Category == "Crash Dumps");

        if (tempAlloc != null && tempAlloc.TotalBytes > 1_000_000_000) score -= 15;
        else if (tempAlloc != null && tempAlloc.TotalBytes > 500_000_000) score -= 8;

        if (logAlloc != null && logAlloc.TotalBytes > 500_000_000) score -= 10;
        if (dumpAlloc != null && dumpAlloc.TotalBytes > 500_000_000) score -= 10;
        if (dupeBytes > 5_000_000_000) score -= 20;
        else if (dupeBytes > 1_000_000_000) score -= 10;

        return Math.Max(0, Math.Min(100, score));
    }

    private static List<StorageRecommendation> GenerateRecommendations(
        List<StorageAllocation> allocations, long dupeBytes, int dupeGroups)
    {
        var recs = new List<StorageRecommendation>();

        foreach (var alloc in allocations)
        {
            switch (alloc.Category)
            {
                case "Temporary Files" when alloc.TotalBytes > 104_857_600:
                    recs.Add(new StorageRecommendation
                    {
                        Category = "Temporary Files",
                        Title = "Clean Temporary Files",
                        Description = $"Remove temporary files accumulating {FormatBytes(alloc.TotalBytes)}.",
                        EstimatedBytes = alloc.TotalBytes,
                        RiskLevel = "Safe",
                        RiskScore = 1,
                        Paths = new List<string> {
                            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Temp"),
                            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Temp")
                        }
                    });
                    break;

                case "Browser Cache" when alloc.TotalBytes > 52_428_800:
                    recs.Add(new StorageRecommendation
                    {
                        Category = "Browser Cache",
                        Title = "Clear Browser Cache",
                        Description = $"Browser caches are consuming {FormatBytes(alloc.TotalBytes)}.",
                        EstimatedBytes = alloc.TotalBytes,
                        RiskLevel = "Safe",
                        RiskScore = 1
                    });
                    break;

                case "System Logs" when alloc.TotalBytes > 209_715_200:
                    recs.Add(new StorageRecommendation
                    {
                        Category = "System Logs",
                        Title = "Archive Old System Logs",
                        Description = $"System logs are taking {FormatBytes(alloc.TotalBytes)}.",
                        EstimatedBytes = (long)(alloc.TotalBytes * 0.7),
                        RiskLevel = "Moderate",
                        RiskScore = 3
                    });
                    break;

                case "Windows Update" when alloc.TotalBytes > 524_288_000:
                    recs.Add(new StorageRecommendation
                    {
                        Category = "Windows Update",
                        Title = "Clean Windows Update Cache",
                        Description = $"Windows Update files consuming {FormatBytes(alloc.TotalBytes)}.",
                        EstimatedBytes = (long)(alloc.TotalBytes * 0.8),
                        RiskLevel = "Moderate",
                        RiskScore = 3
                    });
                    break;

                case "Developer Tools" when alloc.TotalBytes > 524_288_000:
                    recs.Add(new StorageRecommendation
                    {
                        Category = "Developer Tools",
                        Title = "Remove Stale Developer Artifacts",
                        Description = $"node_modules, build outputs, and caches use {FormatBytes(alloc.TotalBytes)}.",
                        EstimatedBytes = (long)(alloc.TotalBytes * 0.6),
                        RiskLevel = "Caution",
                        RiskScore = 5
                    });
                    break;
            }
        }

        if (dupeBytes > 104_857_600)
        {
            recs.Add(new StorageRecommendation
            {
                Category = "Duplicates",
                Title = $"Remove Duplicate Files ({dupeGroups} groups)",
                Description = $"Duplicate files are wasting {FormatBytes(dupeBytes)}.",
                EstimatedBytes = dupeBytes,
                RiskLevel = "Moderate",
                RiskScore = 4
            });
        }

        return recs.OrderBy(r => r.RiskScore).ToList();
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes > 1_073_741_824) return $"{bytes / 1_073_741_824.0:F1} GB";
        if (bytes > 1_048_576) return $"{bytes / 1_048_576.0:F1} MB";
        return $"{bytes / 1024.0:F1} KB";
    }
}

using Microsoft.AspNetCore.Mvc;
using DiskMind.Core.Intelligence;
using Dapper;
using Microsoft.Data.Sqlite;

namespace DiskMind.Api.Controllers;

[ApiController]
[Route("api/analytics")]
public class AnalyticsController : ControllerBase
{
    [HttpGet("{sessionId}")]
    public async Task<IActionResult> GetAnalytics(string sessionId)
    {
        try
        {
            var engine = new IntelligenceEngine(Program.ConnectionString);
            var report = await engine.GenerateIntelligenceReportAsync(sessionId);
            return Ok(report);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("breakdown/{sessionId}")]
    public async Task<IActionResult> GetBreakdown(string sessionId)
    {
        try
        {
            var engine = new IntelligenceEngine(Program.ConnectionString);
            var report = await engine.GenerateIntelligenceReportAsync(sessionId);
            return Ok(report.Allocations);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("filetypes/{sessionId}")]
    public async Task<IActionResult> GetFileTypes(string sessionId)
    {
        try
        {
            var engine = new IntelligenceEngine(Program.ConnectionString);
            var report = await engine.GenerateIntelligenceReportAsync(sessionId);
            return Ok(new { fileTypes = report.FileTypes, extensionAnalysis = report.ExtensionAnalysis });
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("applications/{sessionId}")]
    public async Task<IActionResult> GetApplications(string sessionId)
    {
        try
        {
            using var conn = new SqliteConnection(Program.ConnectionString);
            var apps = await conn.QueryAsync<dynamic>(
                "SELECT * FROM application_analysis WHERE session_id=@s ORDER BY total_size_bytes DESC LIMIT 100",
                new { s = sessionId });
            return Ok(apps);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("developer/{sessionId}")]
    public async Task<IActionResult> GetDeveloper(string sessionId)
    {
        try
        {
            using var conn = new SqliteConnection(Program.ConnectionString);
            var devItems = await conn.QueryAsync<dynamic>(
                "SELECT * FROM developer_storage WHERE session_id=@s ORDER BY size_bytes DESC",
                new { s = sessionId });
            return Ok(devItems);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("gaming/{sessionId}")]
    public async Task<IActionResult> GetGaming(string sessionId)
    {
        try
        {
            using var conn = new SqliteConnection(Program.ConnectionString);
            var games = await conn.QueryAsync<dynamic>(
                "SELECT * FROM gaming_storage WHERE session_id=@s ORDER BY size_bytes DESC",
                new { s = sessionId });
            return Ok(games);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("trends")]
    public async Task<IActionResult> GetTrends()
    {
        try
        {
            using var conn = new SqliteConnection(Program.ConnectionString);
            var sessions = await conn.QueryAsync<dynamic>(
                @"SELECT s.id, s.root_path, s.started_at, s.completed_at, s.status,
                         COALESCE(SUM(f.size_bytes),0) as total_bytes,
                         COUNT(f.id) as file_count
                  FROM scan_sessions s
                  LEFT JOIN scanned_files f ON f.session_id = s.id
                  WHERE s.status='completed'
                  GROUP BY s.id ORDER BY s.started_at ASC");
            return Ok(sessions);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("report/{sessionId}")]
    public async Task<IActionResult> GetReport(string sessionId)
    {
        try
        {
            var engine = new IntelligenceEngine(Program.ConnectionString);
            var report = await engine.GenerateIntelligenceReportAsync(sessionId);
            return Ok(report);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }
}

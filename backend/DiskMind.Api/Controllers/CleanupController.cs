using Microsoft.AspNetCore.Mvc;
using DiskMind.Core.Cleanup;

namespace DiskMind.Api.Controllers;

[ApiController]
[Route("api/cleanup")]
public class CleanupController : ControllerBase
{
    private readonly CleanupService _cleanup;
    public CleanupController(CleanupService cleanup) => _cleanup = cleanup;

    [HttpGet("recommendations/{sessionId}")]
    public async Task<IActionResult> GetRecommendations(string sessionId)
    {
        try
        {
            var recs = await _cleanup.GetRecommendationsAsync(sessionId);
            return Ok(recs);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPost("execute")]
    public async Task<IActionResult> Execute([FromBody] ExecuteCleanupRequest req)
    {
        try
        {
            var result = await _cleanup.ExecuteCleanupAsync(req.RecommendationIds ?? new List<string>(), req.SessionId ?? "");
            return Ok(result);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("history")]
    public async Task<IActionResult> History()
    {
        try
        {
            var history = await _cleanup.GetHistoryAsync();
            return Ok(history);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPost("rollback/{executionId}")]
    public async Task<IActionResult> Rollback(string executionId)
    {
        try
        {
            var result = await _cleanup.RollbackAsync(executionId);
            return Ok(result);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("duplicates/{sessionId}")]
    public async Task<IActionResult> GetDuplicates(string sessionId)
    {
        try
        {
            var dupes = await _cleanup.GetDuplicatesAsync(sessionId);
            return Ok(dupes);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }
}

public class ExecuteCleanupRequest
{
    public List<string>? RecommendationIds { get; set; }
    public string? SessionId { get; set; }
}

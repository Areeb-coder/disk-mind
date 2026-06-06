using Microsoft.AspNetCore.Mvc;
using DiskMind.Core.Scanner;

namespace DiskMind.Api.Controllers;

[ApiController]
[Route("api/scan")]
public class ScanController : ControllerBase
{
    private readonly ScanPipeline _pipeline;
    public ScanController(ScanPipeline pipeline) => _pipeline = pipeline;

    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartScanRequest req)
    {
        try
        {
            var sessionId = await _pipeline.StartScanAsync(req.Path ?? "C:\\");
            return Ok(new { sessionId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("stop")]
    public IActionResult Stop()
    {
        _pipeline.RequestStop();
        return Ok(new { stopped = true });
    }

    [HttpGet("status")]
    public IActionResult Status()
    {
        var s = _pipeline.GetStatus();
        return Ok(s);
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> Sessions()
    {
        var sessions = await _pipeline.GetSessionsAsync();
        return Ok(sessions);
    }
}

public class StartScanRequest
{
    public string? Path { get; set; }
}

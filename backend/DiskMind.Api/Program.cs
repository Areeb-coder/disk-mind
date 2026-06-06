using System.Security.Cryptography;
using DiskMind.Core.Data;
using DiskMind.Core.Scanner;
using DiskMind.Core.Cleanup;
using DiskMind.Core.Intelligence;
using Microsoft.Data.Sqlite;

var appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DiskMind");
Directory.CreateDirectory(appDataPath);

var dbPath = Path.Combine(appDataPath, "diskmind.db");
var tokenPath = Path.Combine(appDataPath, "client_token.txt");

string clientToken;
if (File.Exists(tokenPath))
    clientToken = File.ReadAllText(tokenPath).Trim();
else
{
    clientToken = RandomNumberGenerator.GetHexString(32);
    File.WriteAllText(tokenPath, clientToken);
}

Console.WriteLine($"[DiskMind] Token: {clientToken}");
Console.WriteLine($"[DiskMind] DB: {dbPath}");

var connectionString = $"Data Source={dbPath}";
Program.ConnectionString = connectionString;
Program.ClientToken = clientToken;

using (var conn = new SqliteConnection(connectionString))
{
    conn.Open();
    DbSchema.Initialize(conn);
}

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton(_ => new SqliteConnection(connectionString));
builder.Services.AddSingleton<ScanPipeline>();
builder.Services.AddSingleton<CleanupService>();
builder.WebHost.UseUrls("http://localhost:5000");

var app = builder.Build();
app.UseCors();

// Auth middleware - skip for health check
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path == "/health")
    {
        await next();
        return;
    }
    var token = ctx.Request.Headers["X-DiskMind-Token"].FirstOrDefault()
             ?? ctx.Request.Query["token"].FirstOrDefault();
    if (token != Program.ClientToken)
    {
        ctx.Response.StatusCode = 401;
        await ctx.Response.WriteAsync("Unauthorized");
        return;
    }
    await next();
});

app.MapGet("/health", () => Results.Ok(new { status = "ok", name = "DiskMind" }));
app.MapControllers();
app.Run();

public partial class Program
{
    public static string ConnectionString { get; set; } = "";
    public static string ClientToken { get; set; } = "";
}

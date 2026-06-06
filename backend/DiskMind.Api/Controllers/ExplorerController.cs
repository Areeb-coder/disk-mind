using Microsoft.AspNetCore.Mvc;
using Dapper;
using Microsoft.Data.Sqlite;

namespace DiskMind.Api.Controllers;

[ApiController]
[Route("api/explorer")]
public class ExplorerController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Browse([FromQuery] string sessionId, [FromQuery] string path = "")
    {
        try
        {
            using var conn = new SqliteConnection(Program.ConnectionString);
            string query;
            object param;

            if (string.IsNullOrEmpty(path))
            {
                // Return root drives
                query = @"SELECT SUBSTR(full_path, 1, 3) as name, 
                                 SUBSTR(full_path, 1, 3) as full_path,
                                 SUM(size_bytes) as size_bytes,
                                 COUNT(*) as file_count,
                                 1 as is_directory
                          FROM scanned_files 
                          WHERE session_id=@s
                          GROUP BY SUBSTR(full_path, 1, 3)";
                param = new { s = sessionId };
            }
            else
            {
                // Return children of path
                query = @"SELECT 
                    CASE 
                        WHEN INSTR(SUBSTR(full_path, LENGTH(@p)+2), '\') > 0
                        THEN SUBSTR(full_path, LENGTH(@p)+2, INSTR(SUBSTR(full_path, LENGTH(@p)+2), '\')-1)
                        ELSE SUBSTR(full_path, LENGTH(@p)+2)
                    END as name,
                    CASE 
                        WHEN INSTR(SUBSTR(full_path, LENGTH(@p)+2), '\') > 0
                        THEN @p || '\' || SUBSTR(full_path, LENGTH(@p)+2, INSTR(SUBSTR(full_path, LENGTH(@p)+2), '\')-1)
                        ELSE full_path
                    END as full_path,
                    SUM(size_bytes) as size_bytes,
                    COUNT(*) as file_count,
                    CASE WHEN INSTR(SUBSTR(full_path, LENGTH(@p)+2), '\') > 0 THEN 1 ELSE 0 END as is_directory,
                    MAX(extension) as extension,
                    MAX(category) as category
                    FROM scanned_files
                    WHERE session_id=@s 
                      AND full_path LIKE @pattern
                    GROUP BY name, is_directory
                    ORDER BY is_directory DESC, size_bytes DESC
                    LIMIT 500";
                param = new { s = sessionId, p = path, pattern = path + "\\%" };
            }

            var items = await conn.QueryAsync<dynamic>(query, param);
            return Ok(items);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }
}

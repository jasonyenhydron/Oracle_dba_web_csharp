using Microsoft.AspNetCore.Mvc;
using System.Data;
using System.Text.Json;
using OracleDbaWeb.Models;
using Oracle.ManagedDataAccess.Client;
using System.Text;

namespace OracleDbaWeb.Controllers
{
    [ApiController]
    [Route("api")]
    public class ApiController : ControllerBase
    {
        private readonly OracleHelper _oracleDb;
        private readonly ILogger<ApiController> _logger;

        public ApiController(OracleHelper oracleDb, ILogger<ApiController> logger)
        {
            _oracleDb = oracleDb;
            _logger = logger;
        }

        public class SqlRequest
        {
            public string Sql { get; set; } = "";
        }

        // 1. sql_text
        [HttpGet("sql_text/{sqlId}")]
        public async Task<IActionResult> GetSqlText(string sqlId)
        {
            try {
                var parameters = new[] { new OracleParameter("sid", sqlId) };
                var dt = await _oracleDb.ExecuteQueryAsync(@"
                    SELECT SQL_FULLTEXT
                    FROM V$SQL
                    WHERE SQL_ID = :sid
                    ORDER BY LAST_ACTIVE_TIME DESC
                ", parameters);

                if (dt.Rows.Count == 0) return NotFound(new { detail = "找不到此 SQL_ID 的紀錄" });

                var fullText = dt.Rows[0]["SQL_FULLTEXT"].ToString();
                return Ok(new { sql_text = fullText });
            } catch (Exception ex) {
                _logger.LogError(ex, "GetSqlText error");
                return StatusCode(500, new { detail = ex.Message });
            }
        }

        // 2. execute_sql
        [HttpPost("execute_sql")]
        public async Task ExecuteSql([FromBody] SqlRequest req)
        {
            Response.ContentType = "application/x-ndjson";
            var cnnStr = _oracleDb.GetConnectionString();

            if (string.IsNullOrEmpty(cnnStr))
            {
                await WriteNdJsonAsync(new { type = "error", detail = "Session timeout or unauthorized." });
                return;
            }

            try
            {
                using var connection = new OracleConnection(cnnStr);
                await connection.OpenAsync();

                // Enable DBMS_OUTPUT
                using (var enableDbms = new OracleCommand("BEGIN DBMS_OUTPUT.ENABLE(1000000); END;", connection))
                {
                    await enableDbms.ExecuteNonQueryAsync();
                }

                using var command = new OracleCommand();
                command.Connection = connection;

                string sql = req.Sql.Trim();
                string sqlUpper = sql.ToUpper();
                bool isPlsql = sqlUpper.StartsWith("BEGIN") || sqlUpper.StartsWith("DECLARE") || sqlUpper.StartsWith("CREATE");
                if (!isPlsql)
                {
                    sql = sql.TrimEnd(';');
                }

                command.CommandText = sql;

                if (sqlUpper.StartsWith("SELECT") || sqlUpper.StartsWith("WITH"))
                {
                    using var reader = await command.ExecuteReaderAsync();

                    var columns = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToList();
                    await WriteNdJsonAsync(new { type = "query", columns = columns });

                    var rows = new List<List<string?>>();
                    while (await reader.ReadAsync())
                    {
                        var row = new List<string?>();
                        for(int i = 0; i < reader.FieldCount; i++)
                        {
                            row.Add(reader.IsDBNull(i) ? null : reader.GetValue(i).ToString());
                        }
                        rows.Add(row);

                        if (rows.Count >= 50)
                        {
                            await WriteNdJsonAsync(new { type = "query", data = rows });
                            rows.Clear();
                        }
                    }
                    if (rows.Count > 0)
                    {
                        await WriteNdJsonAsync(new { type = "query", data = rows });
                    }
                }
                else
                {
                    var rowCount = await command.ExecuteNonQueryAsync();
                    await WriteNdJsonAsync(new { type = "message", content = $"執行成功。影響行數: {rowCount}" });
                }

                // Get DBMS_OUTPUT
                string dbmsOutput = await GetDbmsOutputAsync(connection);
                if (!string.IsNullOrEmpty(dbmsOutput))
                {
                    await WriteNdJsonAsync(new { type = "dbms", dbms_output = dbmsOutput });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ExecuteSql error");
                await WriteNdJsonAsync(new { type = "error", detail = ex.Message });
            }
        }

        private async Task WriteNdJsonAsync(object payload)
        {
            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            await Response.WriteAsync(json + "\n");
            await Response.Body.FlushAsync();
        }

        private async Task<string> GetDbmsOutputAsync(OracleConnection connection)
        {
            try {
                using var command = new OracleCommand(@"
                    BEGIN
                        DBMS_OUTPUT.GET_LINE(:line, :status);
                    END;", connection);

                var pLine = command.Parameters.Add("line", OracleDbType.Varchar2, 32767);
                pLine.Direction = ParameterDirection.Output;

                var pStatus = command.Parameters.Add("status", OracleDbType.Int32);
                pStatus.Direction = ParameterDirection.Output;

                var sb = new StringBuilder();
                while (true)
                {
                    await command.ExecuteNonQueryAsync();
                    var status = pStatus.Value.ToString();
                    if (status != "0") break;

                    var line = pLine.Value?.ToString() ?? "";
                    sb.AppendLine(line);
                }
                return sb.ToString().TrimEnd();
            } catch {
                return string.Empty;
            }
        }

        // 3. table_schema
        [HttpGet("table_schema/{tableName}")]
        public async Task<IActionResult> GetTableSchema(string tableName)
        {
            try
            {
                var targetOwner = HttpContext.Session.GetString("DBUser")?.ToUpper();
                if (string.IsNullOrEmpty(targetOwner)) return Unauthorized();

                var name = tableName.ToUpper();
                if (name.Contains('.'))
                {
                    var parts = name.Split('.', 2);
                    targetOwner = parts[0];
                    name = parts[1];
                }

                var sql = @"
                    SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH,
                           NULLABLE, DATA_DEFAULT,
                           (SELECT COMMENTS FROM ALL_COL_COMMENTS
                            WHERE OWNER = :owner AND TABLE_NAME = :table_name
                            AND COLUMN_NAME = c.COLUMN_NAME) AS COMMENTS
                    FROM ALL_TAB_COLUMNS c
                    WHERE OWNER = :owner AND TABLE_NAME = :table_name
                    ORDER BY COLUMN_ID";

                var parameters = new[]
                {
                    new OracleParameter("owner", targetOwner),
                    new OracleParameter("table_name", name)
                };

                var dt = await _oracleDb.ExecuteQueryAsync(sql, parameters);
                var rows = new List<List<string?>>();

                foreach (DataRow row in dt.Rows)
                {
                    rows.Add(new List<string?> {
                        row["COLUMN_NAME"]?.ToString(),
                        row["DATA_TYPE"]?.ToString(),
                        row["DATA_LENGTH"]?.ToString(),
                        row["NULLABLE"]?.ToString(),
                        row["DATA_DEFAULT"]?.ToString(),
                        row["COMMENTS"]?.ToString()
                    });
                }

                return Ok(new { success = true, data = rows });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTableSchema error");
                return StatusCode(500, new { detail = ex.Message });
            }
        }

        // 3.5 table_data
        [HttpGet("table_data/{tableName}")]
        public async Task<IActionResult> GetTableData(string tableName, [FromQuery] int limit = 50, [FromQuery] int offset = 0)
        {
            try
            {
                var owner = HttpContext.Session.GetString("DBUser")?.ToUpper() ?? "";
                var name = tableName.ToUpper();

                if (name.Contains('.'))
                {
                    var parts = name.Split('.', 2);
                    owner = parts[0];
                    name = parts[1];
                }

                if (string.IsNullOrEmpty(owner)) return Unauthorized();

                var cnnStr = _oracleDb.GetConnectionString();
                using var connection = new OracleConnection(cnnStr);
                await connection.OpenAsync();

                using var cmdCount = new OracleCommand($"SELECT COUNT(*) FROM \"{owner}\".\"{name}\"", connection);
                var totalCountObj = await cmdCount.ExecuteScalarAsync();
                int totalCount = Convert.ToInt32(totalCountObj);

                string dataSql;
                if (offset == 0)
                {
                    dataSql = $@"
                        SELECT * FROM (
                            SELECT * FROM ""{owner}"".""{name}""
                        ) WHERE ROWNUM <= {limit}";
                }
                else
                {
                    dataSql = $@"
                        SELECT * FROM (
                            SELECT a.*, ROWNUM AS RN__ FROM (
                                SELECT * FROM ""{owner}"".""{name}""
                            ) a WHERE ROWNUM <= {offset + limit}
                        ) WHERE RN__ > {offset}";
                }

                using var cmdData = new OracleCommand(dataSql, connection);
                using var reader = await cmdData.ExecuteReaderAsync();

                var columns = new List<string>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var colName = reader.GetName(i);
                    if (colName != "RN__") columns.Add(colName);
                }

                var data = new List<List<string?>>();
                while (await reader.ReadAsync())
                {
                    var row = new List<string?>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        if (reader.GetName(i) == "RN__") continue;
                        row.Add(reader.IsDBNull(i) ? null : reader.GetValue(i).ToString());
                    }
                    data.Add(row);
                }

                return Ok(new
                {
                    success = true,
                    columns = columns,
                    data = data,
                    total = totalCount,
                    limit = limit,
                    offset = offset
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTableData error");
                // 返回與原 Python 一樣的層級錯誤，讓前端跳出包含詳細內容的提示
                return StatusCode(500, new { detail = ex.Message });
            }
        }

        // 4. source_code
        [HttpGet("source_code/{objectName}")]
        public async Task<IActionResult> GetSourceCode(string objectName)
        {
            try
            {
                var targetOwner = HttpContext.Session.GetString("DBUser")?.ToUpper();
                if (string.IsNullOrEmpty(targetOwner)) return Unauthorized();

                var objNameUpper = objectName.ToUpper();
                if (objNameUpper.Contains('.'))
                {
                    var parts = objNameUpper.Split('.', 2);
                    targetOwner = parts[0];
                    objNameUpper = parts[1];
                }
                var sql = "SELECT TEXT FROM ALL_SOURCE WHERE OWNER = :o AND NAME = :n ORDER BY TYPE, LINE";

                var parameters = new[]
                {
                    new OracleParameter("o", targetOwner),
                    new OracleParameter("n", objNameUpper)
                };

                var dt = await _oracleDb.ExecuteQueryAsync(sql, parameters);

                if (dt.Rows.Count > 0)
                {
                    var sourceCode = new StringBuilder();
                    foreach (DataRow row in dt.Rows)
                    {
                        sourceCode.Append(row["TEXT"]?.ToString());
                    }
                    return Ok(new { success = true, source = sourceCode.ToString() });
                }

                // If ALL_SOURCE is empty, fallback to DBMS_METADATA GET_DDL
                var typeSql = "SELECT OBJECT_TYPE FROM ALL_OBJECTS WHERE OWNER = :o AND OBJECT_NAME = :n";
                var typeDt = await _oracleDb.ExecuteQueryAsync(typeSql, parameters);
                var objType = typeDt.Rows.Count > 0 ? typeDt.Rows[0][0].ToString() ?? "TABLE" : "TABLE";

                var metadataType = objType.Replace(' ', '_');
                string ddl = "";

                try
                {
                    var cnnStr = _oracleDb.GetConnectionString();
                    using var connection = new OracleConnection(cnnStr);
                    await connection.OpenAsync();

                    using (var cmd1 = new OracleCommand("BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SQLTERMINATOR', true); END;", connection))
                        await cmd1.ExecuteNonQueryAsync();
                    using (var cmd2 = new OracleCommand("BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'PRETTY', true); END;", connection))
                        await cmd2.ExecuteNonQueryAsync();

                    var sqlDDL = "SELECT DBMS_METADATA.GET_DDL(:type, :name, :schema) FROM DUAL";
                    using var cmdDDL = new OracleCommand(sqlDDL, connection);
                    cmdDDL.Parameters.Add("type", metadataType);
                    cmdDDL.Parameters.Add("name", objNameUpper);
                    cmdDDL.Parameters.Add("schema", targetOwner);

                    var lob = await cmdDDL.ExecuteScalarAsync();
                    ddl = lob?.ToString() ?? "";
                }
                catch (Exception metaEx)
                {
                    return StatusCode(500, new { detail = $"無法取得原始碼 (聯集錯誤): {metaEx.Message}" });
                }

                return Ok(new { success = true, source = ddl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetSourceCode error");
                return StatusCode(500, new { detail = ex.Message });
            }
        }

        // 5. search_source
        [HttpGet("search_source")]
        public async Task<IActionResult> SearchSource([FromQuery] string keyword, [FromQuery] string? owner = null)
        {
            if (string.IsNullOrEmpty(keyword)) return Ok(new { success = true, data = new object[0] });

            try
            {
                var targetOwner = string.IsNullOrEmpty(owner) ? HttpContext.Session.GetString("DBUser")?.ToUpper() : owner.ToUpper();
                if (string.IsNullOrEmpty(targetOwner)) return Unauthorized();

                var sql = @"
                    SELECT * FROM (
                        SELECT
                            OWNER AS ""擁有者"",
                            NAME AS ""物件名稱"",
                            TYPE AS ""物件類型"",
                            LINE AS ""行數"",
                            TRIM(TEXT) AS ""程式碼內容""
                        FROM ALL_SOURCE
                        WHERE UPPER(TEXT) LIKE '%' || UPPER(:keyword) || '%'
                          AND OWNER NOT IN ('SYS', 'SYSTEM', 'SYSMAN', 'DBSNMP', 'OUTLN', 'MGR')
                          AND OWNER = :search_owner
                        ORDER BY OWNER, NAME, LINE
                    ) WHERE ROWNUM <= 500";

                var parameters = new[]
                {
                    new OracleParameter("keyword", keyword),
                    new OracleParameter("search_owner", targetOwner)
                };

                var dt = await _oracleDb.ExecuteQueryAsync(sql, parameters);

                var columns = new List<string>();
                foreach (DataColumn c in dt.Columns) columns.Add(c.ColumnName);

                var data = new List<Dictionary<string, object?>>();
                foreach (DataRow row in dt.Rows)
                {
                    var dict = new Dictionary<string, object?>();
                    foreach(var col in columns)
                    {
                        dict[col] = row[col] == DBNull.Value ? null : row[col];
                    }
                    data.Add(dict);
                }

                return Ok(new { success = true, data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SearchSource error");
                return Ok(new { success = false, message = ex.Message });
            }
        }

        // 6. object_info
        [HttpGet("object_info/{owner}/{objectName}")]
        public async Task<IActionResult> GetObjectInfo(string owner, string objectName)
        {
            try
            {
                var targetOwner = owner.ToUpper();
                var name = objectName.ToUpper();
                if (name.Contains('.'))
                {
                    var parts = name.Split('.', 2);
                    targetOwner = parts[0];
                    name = parts[1];
                }

                var sql = @"
                    SELECT OBJECT_TYPE,
                           TO_CHAR(CREATED, 'YYYY-MM-DD HH24:MI:SS') as CREATED,
                           TO_CHAR(LAST_DDL_TIME, 'YYYY-MM-DD HH24:MI:SS') as LAST_DDL_TIME,
                           STATUS
                    FROM ALL_OBJECTS
                    WHERE OWNER = :o AND OBJECT_NAME = :n";

                var parameters = new[]
                {
                    new OracleParameter("o", targetOwner),
                    new OracleParameter("n", name)
                };

                var dt = await _oracleDb.ExecuteQueryAsync(sql, parameters);
                if (dt.Rows.Count == 0) return Ok(new { success = false, message = "找不到該物件" });

                var objType = dt.Rows[0]["OBJECT_TYPE"]?.ToString() ?? "";
                var created = dt.Rows[0]["CREATED"]?.ToString() ?? "";
                var lastDdl = dt.Rows[0]["LAST_DDL_TIME"]?.ToString() ?? "";
                var status = dt.Rows[0]["STATUS"]?.ToString() ?? "";

                var lastActive = "無權限或查無記錄";
                try {
                    var lastActiveSql = @"
                        SELECT TO_CHAR(MAX(LAST_ACTIVE_TIME), 'YYYY-MM-DD HH24:MI:SS') AS LAST_ACTIVE
                        FROM V$SQL
                        WHERE PARSING_SCHEMA_NAME = :o
                          AND (UPPER(SQL_TEXT) LIKE :n OR PROGRAM_ID = (SELECT OBJECT_ID FROM ALL_OBJECTS WHERE OWNER = :o AND OBJECT_NAME = :n AND ROWNUM=1))";
                    var activeDt = await _oracleDb.ExecuteQueryAsync(lastActiveSql, new OracleParameter("o", targetOwner), new OracleParameter("n", $"%{name}%"));
                    if (activeDt.Rows.Count > 0 && activeDt.Rows[0]["LAST_ACTIVE"] != DBNull.Value)
                    {
                        lastActive = activeDt.Rows[0]["LAST_ACTIVE"].ToString() ?? lastActive;
                    }
                } catch { }

                var ddl = "";
                var metadataType = objType.Replace(' ', '_');
                try {
                    var cnnStr = _oracleDb.GetConnectionString();
                    using var connection = new OracleConnection(cnnStr);
                    await connection.OpenAsync();

                    using (var cmd1 = new OracleCommand("BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SQLTERMINATOR', true); END;", connection))
                        await cmd1.ExecuteNonQueryAsync();
                    using (var cmd2 = new OracleCommand("BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'PRETTY', true); END;", connection))
                        await cmd2.ExecuteNonQueryAsync();

                    var sqlDDL = "SELECT DBMS_METADATA.GET_DDL(:type, :name, :schema) FROM DUAL";
                    using var cmdDDL = new OracleCommand(sqlDDL, connection);
                    cmdDDL.Parameters.Add("type", metadataType);
                    cmdDDL.Parameters.Add("name", name);
                    cmdDDL.Parameters.Add("schema", targetOwner);

                    var lob = await cmdDDL.ExecuteScalarAsync();
                    ddl = lob?.ToString() ?? "";
                } catch (Exception e) {
                    ddl = $"-- 無法取得 DDL: {e.Message}";
                }

                return Ok(new {
                    success = true,
                    data = new {
                        owner = targetOwner,
                        name = name,
                        type = objType,
                        created = created,
                        last_ddl = lastDdl,
                        last_active = lastActive,
                        status = status,
                        ddl = ddl
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetObjectInfo error");
                return StatusCode(500, new { detail = ex.Message });
            }
        }

        // 7. update_object_comment
        public class ObjectCommentRequest
        {
            [System.Text.Json.Serialization.JsonPropertyName("table_name")]
            public string TableName { get; set; } = "";
            [System.Text.Json.Serialization.JsonPropertyName("comment")]
            public string Comment { get; set; } = "";
        }

        [HttpPost("update_object_comment")]
        public async Task<IActionResult> UpdateObjectComment([FromBody] ObjectCommentRequest req)
        {
            var targetOwner = HttpContext.Session.GetString("DBUser")?.ToUpper();
            if (string.IsNullOrEmpty(targetOwner)) return Unauthorized();

            try {
                var sql = $"COMMENT ON TABLE \"{targetOwner}\".\"{req.TableName.ToUpper()}\" IS :comment";
                await _oracleDb.ExecuteNonQueryAsync(sql, new OracleParameter("comment", req.Comment));
                return Ok(new { success = true, message = "物件說明已更新" });
            } catch (Exception ex) {
                return Ok(new { success = false, message = ex.Message });
            }
        }

        // 8. update_column_comment
        public class ColumnCommentRequest
        {
            [System.Text.Json.Serialization.JsonPropertyName("owner")]
            public string Owner { get; set; } = "";
            [System.Text.Json.Serialization.JsonPropertyName("table_name")]
            public string TableName { get; set; } = "";
            [System.Text.Json.Serialization.JsonPropertyName("column_name")]
            public string ColumnName { get; set; } = "";
            [System.Text.Json.Serialization.JsonPropertyName("comment")]
            public string Comment { get; set; } = "";
        }

        [HttpPost("update_column_comment")]
        public async Task<IActionResult> UpdateColumnComment([FromBody] ColumnCommentRequest req)
        {
            var targetOwner = HttpContext.Session.GetString("DBUser")?.ToUpper();
            if (string.IsNullOrEmpty(targetOwner)) return Unauthorized();

            try {
                var ownerStr = string.IsNullOrEmpty(req.Owner) ? targetOwner : req.Owner.ToUpper();
                var sql = $"COMMENT ON COLUMN \"{ownerStr}\".\"{req.TableName.ToUpper()}\".\"{req.ColumnName.ToUpper()}\" IS :comment";
                await _oracleDb.ExecuteNonQueryAsync(sql, new OracleParameter("comment", req.Comment));
                return Ok(new { success = true, message = "欄位說明已更新" });
            } catch (Exception ex) {
                return Ok(new { success = false, message = ex.Message });
            }
        }

        // 9. table_script
        [HttpGet("table_script/{tableName}")]
        public async Task<IActionResult> GetTableScript(string tableName)
        {
            try
            {
                var targetOwner = HttpContext.Session.GetString("DBUser")?.ToUpper();
                if (string.IsNullOrEmpty(targetOwner)) return Unauthorized();

                var name = tableName.ToUpper();
                if (name.Contains('.'))
                {
                    var parts = name.Split('.', 2);
                    targetOwner = parts[0];
                    name = parts[1];
                }
                var typeSql = "SELECT OBJECT_TYPE FROM ALL_OBJECTS WHERE OWNER = :o AND OBJECT_NAME = :n";
                var typeDt = await _oracleDb.ExecuteQueryAsync(typeSql, new OracleParameter("o", targetOwner), new OracleParameter("n", name));
                var objType = typeDt.Rows.Count > 0 ? typeDt.Rows[0][0].ToString() ?? "TABLE" : "TABLE";

                var ddl = "";
                try {
                    var cnnStr = _oracleDb.GetConnectionString();
                    using var connection = new OracleConnection(cnnStr);
                    await connection.OpenAsync();

                    var commands = new[] {
                        "BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SQLTERMINATOR', true); END;",
                        "BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'PRETTY', true); END;",
                        "BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'CONSTRAINTS', true); END;",
                        "BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'INDEXES', true); END;",
                        "BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'COMMENTS', true); END;"
                    };

                    foreach(var cmdStr in commands) {
                        try {
                            using var cmd = new OracleCommand(cmdStr, connection);
                            await cmd.ExecuteNonQueryAsync();
                        } catch {}
                    }

                    var sqlDDL = "SELECT DBMS_METADATA.GET_DDL(:type, :name, :schema) FROM DUAL";
                    using var cmdDDL = new OracleCommand(sqlDDL, connection);
                    cmdDDL.Parameters.Add("type", objType.Replace(' ', '_'));
                    cmdDDL.Parameters.Add("name", name);
                    cmdDDL.Parameters.Add("schema", targetOwner);

                    var lob = await cmdDDL.ExecuteScalarAsync();
                    ddl = lob?.ToString() ?? "";
                } catch (Exception e) {
                    return StatusCode(500, new { detail = e.Message });
                }

                return Ok(new { success = true, script = ddl.ToLowerInvariant() });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { detail = ex.Message });
            }
        }
    }
}

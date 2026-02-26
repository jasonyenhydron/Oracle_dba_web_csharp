using Microsoft.AspNetCore.Mvc;
using System.Data;
using OracleDbaWeb.Models;
using Oracle.ManagedDataAccess.Client;

namespace OracleDbaWeb.Controllers
{
    [ApiController]
    [Route("api")]
    public class SchedulerController : ControllerBase
    {
        private readonly OracleHelper _oracleDb;
        private readonly ILogger<SchedulerController> _logger;

        public SchedulerController(OracleHelper oracleDb, ILogger<SchedulerController> logger)
        {
            _oracleDb = oracleDb;
            _logger = logger;
        }

        [HttpGet("scheduler_jobs")]
        public async Task<IActionResult> GetSchedulerJobs()
        {
            try
            {
                var sql = @"
                    SELECT
                        OWNER,
                        JOB_NAME,
                        JOB_TYPE,
                        JOB_ACTION,
                        SCHEDULE_TYPE,
                        SCHEDULE_NAME,
                        REPEAT_INTERVAL,
                        START_DATE,
                        END_DATE,
                        LAST_START_DATE,
                        NEXT_RUN_DATE,
                        STATE,
                        RUN_COUNT,
                        FAILURE_COUNT,
                        COMMENTS
                    FROM ALL_SCHEDULER_JOBS
                    WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'ORACLE_OCM', 'APEX_050000')
                    ORDER BY OWNER, JOB_NAME";

                var dt = await _oracleDb.ExecuteQueryAsync(sql);

                var jobs = new List<object>();
                foreach (DataRow row in dt.Rows)
                {
                    jobs.Add(new {
                        owner = row["OWNER"]?.ToString(),
                        job_name = row["JOB_NAME"]?.ToString(),
                        job_type = row["JOB_TYPE"]?.ToString(),
                        job_action = row["JOB_ACTION"]?.ToString(),
                        schedule_type = row["SCHEDULE_TYPE"]?.ToString(),
                        schedule_name = row["SCHEDULE_NAME"]?.ToString(),
                        repeat_interval = row["REPEAT_INTERVAL"]?.ToString(),
                        start_date = row["START_DATE"]?.ToString(),
                        end_date = row["END_DATE"]?.ToString(),
                        last_start_date = row["LAST_START_DATE"]?.ToString(),
                        next_run_date = row["NEXT_RUN_DATE"]?.ToString(),
                        state = row["STATE"]?.ToString(),
                        run_count = row["RUN_COUNT"]?.ToString(),
                        failure_count = row["FAILURE_COUNT"]?.ToString(),
                        comments = row["COMMENTS"]?.ToString()
                    });
                }

                return Ok(new { success = true, jobs = jobs });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetSchedulerJobs error");
                return Ok(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("scheduler_job/{owner}/{jobName}")]
        public async Task<IActionResult> GetSchedulerJobDetail(string owner, string jobName)
        {
            try
            {
                var sql = @"
                    SELECT
                        OWNER, JOB_NAME, JOB_TYPE, JOB_ACTION, JOB_CLASS,
                        SCHEDULE_TYPE, SCHEDULE_NAME, REPEAT_INTERVAL,
                        START_DATE, END_DATE, LAST_START_DATE, NEXT_RUN_DATE,
                        STATE, ENABLED, AUTO_DROP, RESTARTABLE,
                        RUN_COUNT, FAILURE_COUNT, RETRY_COUNT,
                        COMMENTS, CREDENTIAL_OWNER, CREDENTIAL_NAME
                    FROM ALL_SCHEDULER_JOBS
                    WHERE OWNER = :owner AND JOB_NAME = :job_name";

                var dt = await _oracleDb.ExecuteQueryAsync(sql,
                    new OracleParameter("owner", owner.ToUpper()),
                    new OracleParameter("job_name", jobName.ToUpper()));

                if (dt.Rows.Count == 0) return Ok(new { success = false, message = "Job 不存在" });

                var row = dt.Rows[0];
                var job = new {
                    owner = row["OWNER"]?.ToString(),
                    job_name = row["JOB_NAME"]?.ToString(),
                    job_type = row["JOB_TYPE"]?.ToString(),
                    job_action = row["JOB_ACTION"]?.ToString(),
                    job_class = row["JOB_CLASS"]?.ToString(),
                    schedule_type = row["SCHEDULE_TYPE"]?.ToString(),
                    schedule_name = row["SCHEDULE_NAME"]?.ToString(),
                    repeat_interval = row["REPEAT_INTERVAL"]?.ToString(),
                    start_date = row["START_DATE"]?.ToString(),
                    end_date = row["END_DATE"]?.ToString(),
                    last_start_date = row["LAST_START_DATE"]?.ToString(),
                    next_run_date = row["NEXT_RUN_DATE"]?.ToString(),
                    state = row["STATE"]?.ToString(),
                    enabled = row["ENABLED"]?.ToString(),
                    auto_drop = row["AUTO_DROP"]?.ToString(),
                    restartable = row["RESTARTABLE"]?.ToString(),
                    run_count = row["RUN_COUNT"]?.ToString(),
                    failure_count = row["FAILURE_COUNT"]?.ToString(),
                    retry_count = row["RETRY_COUNT"]?.ToString(),
                    comments = row["COMMENTS"]?.ToString(),
                    credential_owner = row["CREDENTIAL_OWNER"]?.ToString(),
                    credential_name = row["CREDENTIAL_NAME"]?.ToString()
                };

                return Ok(new { success = true, job = job });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetSchedulerJobDetail error");
                return Ok(new { success = false, message = ex.Message });
            }
        }

        public class CreateJobRequest
        {
            [System.Text.Json.Serialization.JsonPropertyName("job_name")]
            public string JobName { get; set; } = "";
            [System.Text.Json.Serialization.JsonPropertyName("job_type")]
            public string JobType { get; set; } = "";
            [System.Text.Json.Serialization.JsonPropertyName("job_action")]
            public string? JobAction { get; set; }
            [System.Text.Json.Serialization.JsonPropertyName("procedure_name")]
            public string? ProcedureName { get; set; }
            [System.Text.Json.Serialization.JsonPropertyName("schedule_type")]
            public string ScheduleType { get; set; } = "";
            [System.Text.Json.Serialization.JsonPropertyName("repeat_interval")]
            public string? RepeatInterval { get; set; }
            [System.Text.Json.Serialization.JsonPropertyName("cron_expression")]
            public string? CronExpression { get; set; }
            [System.Text.Json.Serialization.JsonPropertyName("auto_enable")]
            public bool AutoEnable { get; set; } = true;
            [System.Text.Json.Serialization.JsonPropertyName("comments")]
            public string? Comments { get; set; }
        }

        [HttpPost("scheduler_job")]
        public async Task<IActionResult> CreateSchedulerJob([FromBody] CreateJobRequest req)
        {
            try
            {
                var jobName = req.JobName.ToUpper();
                string jobAction = req.JobType == "PLSQL_BLOCK" ? req.JobAction ?? "" : req.ProcedureName ?? "";

                string repeatInterval = req.ScheduleType switch {
                    "INTERVAL" => req.RepeatInterval ?? "",
                    "CRON" => req.CronExpression ?? "",
                    _ => ""
                };

                var enabledStr = req.AutoEnable ? "TRUE" : "FALSE";
                string comments = req.Comments?.Replace("'", "''") ?? "";

                var plsql = $@"
                BEGIN
                    DBMS_SCHEDULER.CREATE_JOB (
                        job_name        => '{jobName}',
                        job_type        => '{req.JobType}',
                        job_action      => '{jobAction.Replace("'", "''")}',
                        {(string.IsNullOrEmpty(repeatInterval) ? "" : $"repeat_interval => '{repeatInterval.Replace("'", "''")}',")}
                        enabled         => {enabledStr},
                        comments        => '{comments}'
                    );
                END;";

                await _oracleDb.ExecuteNonQueryAsync(plsql);
                return Ok(new { success = true, message = $"Job {jobName} 建立成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateSchedulerJob error");
                return Ok(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("scheduler_job/{owner}/{jobName}/enable")]
        public async Task<IActionResult> EnableJob(string owner, string jobName)
        {
            try
            {
                var plsql = $"BEGIN DBMS_SCHEDULER.ENABLE('{owner.ToUpper()}.{jobName.ToUpper()}'); END;";
                await _oracleDb.ExecuteNonQueryAsync(plsql);
                return Ok(new { success = true, message = $"Job {jobName} 已啟用" });
            }
            catch (Exception ex)
            {
                return Ok(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("scheduler_job/{owner}/{jobName}/disable")]
        public async Task<IActionResult> DisableJob(string owner, string jobName)
        {
            try
            {
                var plsql = $"BEGIN DBMS_SCHEDULER.DISABLE('{owner.ToUpper()}.{jobName.ToUpper()}'); END;";
                await _oracleDb.ExecuteNonQueryAsync(plsql);
                return Ok(new { success = true, message = $"Job {jobName} 已停用" });
            }
            catch (Exception ex)
            {
                return Ok(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("scheduler_job/{owner}/{jobName}/run")]
        public async Task<IActionResult> RunJob(string owner, string jobName)
        {
            try
            {
                var plsql = $"BEGIN DBMS_SCHEDULER.RUN_JOB('{owner.ToUpper()}.{jobName.ToUpper()}'); END;";
                await _oracleDb.ExecuteNonQueryAsync(plsql);
                return Ok(new { success = true, message = $"Job {jobName} 已提交執行" });
            }
            catch (Exception ex)
            {
                return Ok(new { success = false, message = ex.Message });
            }
        }

        [HttpDelete("scheduler_job/{owner}/{jobName}")]
        public async Task<IActionResult> DeleteJob(string owner, string jobName)
        {
            try
            {
                var plsql = $"BEGIN DBMS_SCHEDULER.DROP_JOB('{owner.ToUpper()}.{jobName.ToUpper()}'); END;";
                await _oracleDb.ExecuteNonQueryAsync(plsql);
                return Ok(new { success = true, message = $"Job {jobName} 已刪除" });
            }
            catch (Exception ex)
            {
                return Ok(new { success = false, message = ex.Message });
            }
        }

        public class JobItem
        {
            [System.Text.Json.Serialization.JsonPropertyName("owner")]
            public string Owner { get; set; } = "";
            [System.Text.Json.Serialization.JsonPropertyName("job_name")]
            public string JobName { get; set; } = "";
        }

        public class BatchJobRequest
        {
            [System.Text.Json.Serialization.JsonPropertyName("jobs")]
            public List<JobItem> Jobs { get; set; } = new();
        }

        [HttpPost("scheduler_jobs/batch_disable")]
        public async Task<IActionResult> BatchDisableJobs([FromBody] BatchJobRequest req)
        {
            if (req.Jobs == null || req.Jobs.Count == 0) return Ok(new { success = false, message = "未選擇任何 Job" });

            var errors = new List<string>();
            foreach (var job in req.Jobs)
            {
                try {
                    var plsql = $"BEGIN DBMS_SCHEDULER.DISABLE('{job.Owner.ToUpper()}.{job.JobName.ToUpper()}'); END;";
                    await _oracleDb.ExecuteNonQueryAsync(plsql);
                } catch(Exception ex) {
                    errors.Add($"{job.JobName}: {ex.Message}");
                }
            }
            if (errors.Count > 0) return Ok(new { success = false, message = $"有 {errors.Count} 個停用失敗", errors = errors });
            return Ok(new { success = true, message = $"成功停用 {req.Jobs.Count} 個 Jobs" });
        }

        [HttpPost("scheduler_jobs/batch_enable")]
        public async Task<IActionResult> BatchEnableJobs([FromBody] BatchJobRequest req)
        {
            if (req.Jobs == null || req.Jobs.Count == 0) return Ok(new { success = false, message = "未選擇任何 Job" });

            var errors = new List<string>();
            foreach (var job in req.Jobs)
            {
                try {
                    var plsql = $"BEGIN DBMS_SCHEDULER.ENABLE('{job.Owner.ToUpper()}.{job.JobName.ToUpper()}'); END;";
                    await _oracleDb.ExecuteNonQueryAsync(plsql);
                } catch(Exception ex) {
                    errors.Add($"{job.JobName}: {ex.Message}");
                }
            }
            if (errors.Count > 0) return Ok(new { success = false, message = $"有 {errors.Count} 個啟用失敗", errors = errors });
            return Ok(new { success = true, message = $"成功啟用 {req.Jobs.Count} 個 Jobs" });
        }

        [HttpPost("scheduler_jobs/batch_delete")]
        public async Task<IActionResult> BatchDeleteJobs([FromBody] BatchJobRequest req)
        {
            if (req.Jobs == null || req.Jobs.Count == 0) return Ok(new { success = false, message = "未選擇任何 Job" });

            var errors = new List<string>();
            foreach (var job in req.Jobs)
            {
                try {
                    var plsql = $"BEGIN DBMS_SCHEDULER.DROP_JOB('{job.Owner.ToUpper()}.{job.JobName.ToUpper()}'); END;";
                    await _oracleDb.ExecuteNonQueryAsync(plsql);
                } catch(Exception ex) {
                    errors.Add($"{job.JobName}: {ex.Message}");
                }
            }
            if (errors.Count > 0) return Ok(new { success = false, message = $"有 {errors.Count} 個刪除失敗", errors = errors });
            return Ok(new { success = true, message = $"成功刪除 {req.Jobs.Count} 個 Jobs" });
        }
    }
}

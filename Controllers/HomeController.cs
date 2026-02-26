using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using OracleDbaWeb.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace OracleDbaWeb.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly OracleHelper _oracleDb;

        public HomeController(ILogger<HomeController> logger, OracleHelper oracleDb)
        {
            _logger = logger;
            _oracleDb = oracleDb;
        }

        [Authorize]
        public async Task<IActionResult> Index(string owner)
        {
            var user = HttpContext.Session.GetString("DBUser");
            var dsn = HttpContext.Session.GetString("DSN");

            if(string.IsNullOrEmpty(user) || string.IsNullOrEmpty(dsn))
            {
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return RedirectToAction("Login", "Account");
            }

            var targetOwner = string.IsNullOrEmpty(owner) ? user.ToUpper() : owner.ToUpper();

            // 1. 取得所有的 Schema Owners
            var allOwners = new List<string>();
            try
            {
                var dt = await _oracleDb.ExecuteQueryAsync("SELECT DISTINCT OWNER FROM ALL_OBJECTS WHERE OWNER NOT IN ('SYS','SYSTEM') ORDER BY OWNER");
                foreach (System.Data.DataRow row in dt.Rows)
                {
                    var ownerValue = row["OWNER"]?.ToString();
                    if (!string.IsNullOrEmpty(ownerValue))
                    {
                        allOwners.Add(ownerValue);
                    }
                }

                if (!allOwners.Contains(targetOwner)) allOwners.Insert(0, targetOwner);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch owners");
                allOwners.Add(targetOwner);
            }

            ViewData["CurrentOwner"] = targetOwner;
            ViewData["AllOwners"] = allOwners;
            ViewData["Dsn"] = dsn;

            // 2. 取得該 Schema 的物件列表
            try
            {
                var dtObjects = await _oracleDb.ExecuteQueryAsync(@"
                    SELECT OBJECT_TYPE, OBJECT_NAME, STATUS FROM ALL_OBJECTS
                    WHERE OWNER = :owner
                      AND OBJECT_TYPE IN ('TABLE','VIEW','PROCEDURE','FUNCTION','PACKAGE')
                      AND ROWNUM <= 1000
                    ORDER BY OBJECT_TYPE, OBJECT_NAME
                ", new Oracle.ManagedDataAccess.Client.OracleParameter("owner", targetOwner));

                ViewData["Objects"] = dtObjects;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch dashboard objects");
            }

            // 3. 取得 SQL 歷史 (限制 100 筆)
            try
            {
                var dtSqlHistory = await _oracleDb.ExecuteQueryAsync(@"
                    SELECT SQL_ID, SUBSTR(SQL_TEXT, 1, 100) AS SQL_PREVIEW, ELAPSED_TIME, LAST_ACTIVE_TIME
                    FROM V$SQL
                    WHERE PARSING_SCHEMA_NAME = :owner AND ROWNUM <= 100
                    ORDER BY LAST_ACTIVE_TIME DESC
                ", new Oracle.ManagedDataAccess.Client.OracleParameter("owner", targetOwner));

                ViewData["SqlHistory"] = dtSqlHistory;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch SQL history (可能沒有 V$SQL 權限)");
            }

            // 可在此加入其他 SQL 歷史及物件讀取的邏輯，待後續實作 PartialView 時補齊

            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View();
        }
    }
}

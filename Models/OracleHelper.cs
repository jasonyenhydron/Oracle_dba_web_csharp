using System.Data;
using System.Text.RegularExpressions;
using Oracle.ManagedDataAccess.Client;

namespace OracleDbaWeb.Models
{
    public class OracleHelper
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        // Cache TNS names so we don't read the file every time
        private static List<string> _tnsNamesCache = new();
        private static DateTime _lastTnsReadTime = DateTime.MinValue;

        public OracleHelper(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        /// <summary>
        /// 取得目前 Session 儲存的連線字串
        /// </summary>
        public string GetConnectionString()
        {
            var session = _httpContextAccessor.HttpContext?.Session;
            if (session == null) return string.Empty;

            var dsn = session.GetString("DSN");
            var user = session.GetString("DBUser");
            var pass = session.GetString("DBPassword");

            if (string.IsNullOrEmpty(dsn) || string.IsNullOrEmpty(user) || string.IsNullOrEmpty(pass))
                return string.Empty;

            // Oracle.ManagedDataAccess.Client 自動處理連線池
            // Min Pool Size=2;Max Pool Size=10;Connection Lifetime=3600 等可加入字串
            return $"Data Source={dsn};User Id={user};Password={pass};Min Pool Size=2;Max Pool Size=10;Connection Lifetime=3600;Decr Pool Size=1;";
        }

        /// <summary>
        /// 取得指定的連線字串 (用於登入驗證時)
        /// </summary>
        public string BuildConnectionString(string dsn, string user, string pass)
        {
            return $"Data Source={dsn};User Id={user};Password={pass};Min Pool Size=2;Max Pool Size=10;Connection Lifetime=3600;Decr Pool Size=1;";
        }

        public async Task<bool> TestConnectionAsync(string cnnString)
        {
            try
            {
                using var connection = new OracleConnection(cnnString);
                await connection.OpenAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<DataTable> ExecuteQueryAsync(string sql, params OracleParameter[] parameters)
        {
            var cnnStr = GetConnectionString();
            if (string.IsNullOrEmpty(cnnStr)) throw new UnauthorizedAccessException("Session 逾時或未登入");

            try
            {
                using var connection = new OracleConnection(cnnStr);
                using var command = new OracleCommand(sql, connection);
                if (parameters != null && parameters.Length > 0)
                    command.Parameters.AddRange(parameters);

                await connection.OpenAsync();
                using var reader = await command.ExecuteReaderAsync();
                var dataTable = new DataTable();
                dataTable.Load(reader);
                return dataTable;
            }
            catch (OracleException ex)
            {
                throw new Exception($"資料庫執行錯誤: {ex.Message}", ex);
            }
        }

        public async Task<int> ExecuteNonQueryAsync(string sql, params OracleParameter[] parameters)
        {
            var cnnStr = GetConnectionString();
            if (string.IsNullOrEmpty(cnnStr)) throw new UnauthorizedAccessException("Session 逾時或未登入");

            try
            {
                using var connection = new OracleConnection(cnnStr);
                using var command = new OracleCommand(sql, connection);
                if (parameters != null && parameters.Length > 0)
                    command.Parameters.AddRange(parameters);

                await connection.OpenAsync();
                return await command.ExecuteNonQueryAsync();
            }
            catch (OracleException ex)
            {
                throw new Exception($"資料庫執行錯誤: {ex.Message}", ex);
            }
        }

        public List<string> GetTnsNames()
        {
            if (_tnsNamesCache.Any() && (DateTime.Now - _lastTnsReadTime).TotalMinutes < 60)
            {
                return _tnsNamesCache;
            }

            string tnsPath = @"D:\APP\jason.yen\product\11.2.0\client_1\network\admin\tnsnames.ora";
            if (!File.Exists(tnsPath))
            {
                return new List<string> { "(找不到 tnsnames.ora)" };
            }

            try
            {
                var content = File.ReadAllText(tnsPath);
                var matches = Regex.Matches(content, @"^([\w\.\-]+)\s*=", RegexOptions.Multiline);
                var aliases = new List<string>();
                foreach (Match m in matches)
                {
                    aliases.Add(m.Groups[1].Value);
                }

                aliases.Sort();
                _tnsNamesCache = aliases;
                _lastTnsReadTime = DateTime.Now;
                return aliases;
            }
            catch (Exception ex)
            {
                return new List<string> { $"(讀取失敗: {ex.Message})" };
            }
        }
    }
}

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using OracleDbaWeb.Models;
using Microsoft.AspNetCore.Authorization;

namespace OracleDbaWeb.Controllers
{
    public class AccountController : Controller
    {
        private readonly OracleHelper _oracleDb;

        public AccountController(OracleHelper oracleDb)
        {
            _oracleDb = oracleDb;
        }

        [AllowAnonymous]
        [HttpGet]
        public IActionResult Login(string returnUrl = "/")
        {
            if (User.Identity!.IsAuthenticated)
            {
                return LocalRedirect(returnUrl);
            }

            ViewData["TnsList"] = _oracleDb.GetTnsNames();
            ViewData["ReturnUrl"] = returnUrl;
            return View();
        }

        [AllowAnonymous]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(string tns, string username, string password, string returnUrl = "/")
        {
            try
            {
                string cnnString = _oracleDb.BuildConnectionString(tns, username, password);
                bool isValid = await _oracleDb.TestConnectionAsync(cnnString);

                if (isValid)
                {
                    // 登入成功，建立連線資訊至 Session 供後續所有功能使用
                    HttpContext.Session.SetString("DSN", tns);
                    HttpContext.Session.SetString("DBUser", username);
                    HttpContext.Session.SetString("DBPassword", password);

                    // 記錄使用者身份 Claims
                    var claims = new List<Claim>
                    {
                        new Claim(ClaimTypes.Name, username),
                        new Claim("DSN", tns)
                    };

                    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
                    var principal = new ClaimsPrincipal(identity);

                    // 發送 Cookie
                    await HttpContext.SignInAsync(
                        CookieAuthenticationDefaults.AuthenticationScheme,
                        principal,
                        new AuthenticationProperties
                        {
                            IsPersistent = true,
                            ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(120)
                        });

                    return LocalRedirect(returnUrl);
                }
                else
                {
                    ModelState.AddModelError(string.Empty, "❌ 登入失敗: 帳號密碼或 TNS 設定錯誤。");
                }
            }
            catch (Exception ex)
            {
                ModelState.AddModelError(string.Empty, $"❌ 登入失敗: {ex.Message}");
            }

            ViewData["TnsList"] = _oracleDb.GetTnsNames();
            ViewData["ReturnUrl"] = returnUrl;
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            // 清除 Session
            HttpContext.Session.Clear();

            // 清除登入 Cookie
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToAction(nameof(Login));
        }
    }
}

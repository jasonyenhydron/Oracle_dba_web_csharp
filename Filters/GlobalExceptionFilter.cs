using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace OracleDbaWeb.Filters
{
    public class GlobalExceptionFilter : IExceptionFilter
    {
        public void OnException(ExceptionContext context)
        {
            // 處理 Session 逾時或未登入的例外
            if (context.Exception is UnauthorizedAccessException)
            {
                // HTMX 請求特殊處理：回傳 HX-Redirect 標頭讓前端跳轉
                if (context.HttpContext.Request.Headers.ContainsKey("HX-Request"))
                {
                    context.HttpContext.Response.Headers["HX-Redirect"] = "/Account/Login";
                    context.Result = new EmptyResult();
                }
                else
                {
                    // 一般請求：傳統重新導向
                    context.Result = new RedirectToActionResult("Login", "Account", null);
                }

                // 標記例外已經被處理完畢
                context.ExceptionHandled = true;
            }
            // 可以在此加入其他自訂例外處理...
        }
    }
}

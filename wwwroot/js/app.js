/**
 * app.js — 應用程式入口點
 *
 * MVC 前端架構：
 *   core/api.js   → Model 層：所有 HTTP 呼叫 (window.API)
 *   core/ui.js    → 共用 View 元件：Dialog, Toast, Modal
 *   content.js    → 主頁面 Controller：物件瀏覽、Modal、SQL 歷史
 *   schedule_job.js → Scheduler Controller：排程工作管理
 *
 * 此檔案作為入口點，確認各模組已載入並初始化
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Oracle DBA Web — App initialized');

    // 確認核心模組已載入
    if (window.API) {
        console.log('✅ [App] API module loaded');
    } else {
        console.warn('⚠️ [App] API module NOT found — ensure core/api.js is loaded before app.js');
    }

    // 確認共用 UI 模組
    if (window.showToast) {
        console.log('✅ [App] UI module loaded');
    } else {
        console.warn('⚠️ [App] UI module NOT found — ensure core/ui.js is loaded before app.js');
    }
});

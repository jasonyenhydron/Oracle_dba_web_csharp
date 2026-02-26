// 確認 content.js 已載入
console.log('🚀 content.js v24 已載入 - ' + new Date().toLocaleTimeString());

let modalObj = null, previewDataTable = null;

let currentTableName = null;
let objectComments = {}; // 儲存物件中文說明
let currentOwner = ''; // 當前 Owner

// ── 資料預覽分頁狀態 ──────────────────────────────────────────
let previewAllData   = [];  // 全部已載入資料列
let previewColumns   = [];  // 欄位名稱陣列
let previewPage      = 1;   // 目前頁碼 (1-based)
const PREVIEW_PAGE_SIZE = 50;
let previewSearchTerm = '';

/**
 * 計算 DataTable 可用高度（視口高度減去標題和其他固定元素）
 * @returns {number} 可用高度（像素）
 */
function computeAvailableDataTableHeight() {
    // 獲取模態框容器
    const modal = document.querySelector('.modal.show');
    if (!modal) return 400; // 預設高度

    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return 400;

    // 計算：模態框可見高度 - 邊距 - 分頁控制項空間
    const availableHeight = modalBody.clientHeight - 40; // 40px 用於邊距和分頁
    return Math.max(300, availableHeight); // 最小 300px
}

// === 物件中文說明管理功能 ===

/**
 * 載入所有物件的中文說明
 * @param {string} owner - Schema/Owner 名稱
 */
async function loadObjectComments(owner) {
    console.log('🚀 [loadObjectComments] 函數被調用，Owner:', owner);

    try {
        currentOwner = owner;
        const url = `/api/object_comments/${encodeURIComponent(owner)}`;
        console.log('📡 [loadObjectComments] 準備發送請求到:', url);

        const response = await fetch(url);
        console.log('📥 [loadObjectComments] 收到回應，狀態:', response.status, response.statusText);

        const data = await response.json();
        console.log('📊 [loadObjectComments] 回應資料:', data);

        if (response.ok) {
            // 檢查是否有錯誤訊息（權限不足等）
            if (data.error) {
                console.warn('⚠️ [loadObjectComments] API 返回錯誤:', data.error);
                console.warn('   中文說明功能可能因權限不足而無法使用');
                objectComments = {};
                // 隱藏操作按鈕
                const actionsBar = document.getElementById('objectActionsBar');
                if (actionsBar) {
                    actionsBar.style.display = 'none';
                }
                return false;
            }

            objectComments = data.comments || {};
            console.log(`✅ 已載入 ${Object.keys(objectComments).length} 個物件的中文說明`);

            // 更新界面顯示
            updateCommentDisplay();

            // 只有在成功載入時才顯示操作按鈕
            if (Object.keys(objectComments).length > 0) {
                const actionsBar = document.getElementById('objectActionsBar');
                if (actionsBar) {
                    actionsBar.style.display = 'block';
                }
            }

            return true;
        } else {
            console.error('❌ [loadObjectComments] HTTP 錯誤:', response.status, data);
            return false;
        }
    } catch (e) {
        console.error('❌ [loadObjectComments] 載入中文說明異常:', e);
        // 即使失敗也不影響頁面其他功能
        return false;
    }
}

/**
 * 更新界面上的中文說明顯示
 */
function updateCommentDisplay() {
    console.log('🔄 [updateCommentDisplay] 開始更新界面...');
    console.log('📊 [updateCommentDisplay] objectComments:', objectComments);

    // 找到所有的 comment-container
    const containers = document.querySelectorAll('.comment-container');
    console.log(`🔍 [updateCommentDisplay] 找到 ${containers.length} 個容器`);

    containers.forEach(container => {
        const tableName = container.id.replace('comment-', '');
        const comment = objectComments[tableName] || '';
        const displayText = comment || '(無說明)';

        console.log(`  ✏️ 更新 ${tableName}: "${displayText}"`);

        container.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <span class="comment-display flex-grow-1" style="font-size: 0.9em; ${comment ? '' : 'color: #999;'}">
                    ${displayText}
                </span>
                <button class="btn btn-sm btn-outline-primary py-0 px-2"
                        onclick="editObjectComment('${tableName}')"
                        title="編輯中文說明">
                    <i class="bi bi-pencil"></i>
                </button>
            </div>
        `;
    });

    console.log('✅ [updateCommentDisplay] 界面更新完成');
}

/**
 * 通用 Modal 管理器 (Vanilla JS + Tailwind)
 */
function createGenericModal(modalId, contentHtml) {
    const backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'fixed inset-0 z-[1050] flex items-center justify-center bg-black bg-opacity-50 opacity-0 transition-opacity duration-300';
    backdrop.style.display = 'flex';
    backdrop.innerHTML = contentHtml;

    document.body.appendChild(backdrop);

    // Trigger reflow for transition
    void backdrop.offsetWidth;
    backdrop.classList.remove('opacity-0');

    // TAB trap and focus handling could be added here

    return backdrop;
}

function closeGenericModal(modalId, cleanup = true) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('opacity-0');
    setTimeout(() => {
        if (cleanup) modal.remove();
        else modal.style.display = 'none';

        // Restore body scroll if needed
        document.body.style.overflow = '';
    }, 300);
}

/**
 * 顯示通用的輸入對話框 (Vanilla JS)
 */
function showInputDialog(options) {
    const {
        title = '輸入',
        message = '請輸入內容：',
        placeholder = '',
        defaultValue = '',
        onConfirm = null,
        onCancel = null
    } = options;

    const modalId = 'inputDialog' + Date.now();
    const modalHtml = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden transform transition-all scale-100" role="dialog">
            <div class="bg-blue-600 px-4 py-3 border-b border-blue-700 flex justify-between items-center text-white">
                <h5 class="text-lg font-bold flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    ${title}
                </h5>
                <button type="button" class="text-white hover:bg-blue-700 rounded p-1" onclick="closeGenericModal('${modalId}')">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="p-6">
                <label for="${modalId}_input" class="block text-sm font-medium text-gray-700 mb-2">${message}</label>
                <textarea id="${modalId}_input" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows="4" placeholder="${placeholder}">${defaultValue}</textarea>
            </div>
            <div class="bg-gray-50 px-4 py-3 flex justify-end gap-2 border-t border-gray-100">
                <button type="button" class="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors" onclick="closeGenericModal('${modalId}')">
                    取消
                </button>
                <button type="button" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm shadow-sm transition-colors" id="${modalId}_confirm">
                    確定
                </button>
            </div>
        </div>
    `;

    createGenericModal(modalId, modalHtml);
    document.body.style.overflow = 'hidden';

    const inputElement = document.getElementById(`${modalId}_input`);
    const confirmBtn = document.getElementById(`${modalId}_confirm`);

    inputElement.focus();
    inputElement.select();

    const handleConfirm = () => {
        const value = inputElement.value;
        closeGenericModal(modalId);
        if (onConfirm) onConfirm(value);
    };

    confirmBtn.addEventListener('click', handleConfirm);

    inputElement.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleConfirm();
        }
    });
}

/**
 * 顯示通用的確認對話框 (Vanilla JS)
 */
function showConfirmDialog(options) {
    const {
        title = '確認',
        message = '確定要執行此操作嗎？',
        onConfirm = null,
        onCancel = null,
        confirmText = '確定',
        cancelText = '取消',
        confirmClass = 'bg-blue-600 hover:bg-blue-700 text-white' // Expects Tailwind class
    } = options;

    const modalId = 'confirmDialog' + Date.now();
    // Default to blue if confirmClass contains 'btn-primary' (Bootstrap legacy)
    let btnClass = confirmClass;
    if (confirmClass.includes('btn-primary')) btnClass = 'bg-blue-600 hover:bg-blue-700 text-white';
    if (confirmClass.includes('btn-success')) btnClass = 'bg-green-600 hover:bg-green-700 text-white';
    if (confirmClass.includes('btn-danger')) btnClass = 'bg-red-600 hover:bg-red-700 text-white';

    const modalHtml = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden transform transition-all scale-100" role="dialog">
            <div class="bg-amber-100 px-4 py-3 border-b border-amber-200 flex justify-between items-center">
                <h5 class="text-lg font-bold text-amber-800 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    ${title}
                </h5>
                <button type="button" class="text-amber-800 hover:bg-amber-200 rounded p-1 transition-colors" onclick="closeGenericModal('${modalId}')">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="p-6">
                <p class="text-slate-700 whitespace-pre-wrap">${message}</p>
            </div>
            <div class="bg-gray-50 px-4 py-3 flex justify-end gap-2 border-t border-gray-100">
                <button type="button" class="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors" onclick="closeGenericModal('${modalId}')">
                    ${cancelText}
                </button>
                <button type="button" class="px-4 py-2 rounded font-medium text-sm shadow-sm transition-colors ${btnClass}" id="${modalId}_confirm">
                    ${confirmText}
                </button>
            </div>
        </div>
    `;

    createGenericModal(modalId, modalHtml);
    document.body.style.overflow = 'hidden';

    const confirmBtn = document.getElementById(`${modalId}_confirm`);
    confirmBtn.addEventListener('click', function () {
        closeGenericModal(modalId);
        if (onConfirm) onConfirm();
    });
}

/**
 * 編輯物件的中文說明
 */
async function editObjectComment(tableName) {
    const currentComment = objectComments[tableName] || '';

    showInputDialog({
        title: '編輯物件中文說明',
        message: `請輸入 ${tableName} 的中文說明：`,
        placeholder: '例如：客戶主檔',
        defaultValue: currentComment,
        onConfirm: async function(newComment) {
            try {
                const response = await fetch('/api/update_object_comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        owner: currentOwner,
                        table_name: tableName,
                        comment: newComment
                    })
                });

                const result = await response.json();

                if (result.success) {
                    objectComments[tableName] = newComment;
                    updateCommentDisplay();
                    // Show transient success message
                    const statusEl = document.getElementById('commentLoadStatus');
                    if(statusEl) statusEl.innerHTML = `<span class="text-green-600"><i class="bi bi-check-circle"></i> ${result.message}</span>`;
                } else {
                    alert(`更新失敗: ${result.message}`);
                }
            } catch (e) {
                alert(`更新中文說明時發生錯誤: ${e.message}`);
            }
        }
    });
}

/**
 * 自動補全所有物件的中文說明
 */
async function autoFillComments() {
    showConfirmDialog({
        title: '確認自動補全',
        message: '此功能會自動為所有沒有中文說明的物件補上預設說明。\n\n確定要繼續嗎？',
        confirmText: '確定執行',
        confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
        onConfirm: async function() {
            // ... Logic same as before ...
            const statusEl = document.getElementById('commentLoadStatus');
            if (statusEl) statusEl.innerHTML = '正在處理...';
            // Simple re-implementation of loop
            let updatedCount = 0;
             const emptyCommentObjects = Object.entries(objectComments)
                .filter(([name, comment]) => !comment)
                .map(([name]) => name);

            for (const tableName of emptyCommentObjects) {
                try {
                    const defaultComment = `${tableName} 資料表`;
                    const response = await fetch('/api/update_object_comment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ owner: currentOwner, table_name: tableName, comment: defaultComment })
                    });
                     if ((await response.json()).success) {
                        objectComments[tableName] = defaultComment;
                        updatedCount++;
                    }
                } catch(e) {}
            }
            updateCommentDisplay();
            if (statusEl) statusEl.innerHTML = `已補全 ${updatedCount} 個說明`;
        }
    });
}


// ----------------------------------------------------------------------------

function truncateText(text, maxLength = 50) {
    if (!text || text === 'NULL' || text === null || text === undefined) return '<em class="text-slate-400">NULL</em>';
    const textStr = String(text);
    if (textStr.length <= maxLength) return textStr;

    const uniqueId = 'cell_' + Math.random().toString(36).substr(2, 9);
    const truncated = textStr.substring(0, maxLength);

    return `
        <div class="flex items-center gap-1">
            <span class="truncate flex-grow">${truncated}...</span>
            <button class="px-1 py-0 text-slate-500 hover:text-blue-600 border rounded text-xs"
                    onclick="showFullText('${uniqueId}')"
                    title="點擊查看完整內容">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
            </button>
            <div id="${uniqueId}" class="hidden">${textStr}</div>
        </div>
    `;
}

function showFullText(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const fullText = element.textContent;

    const modalId = 'fullTextModal';
    const modalHtml = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col max-h-[80vh]" role="dialog">
            <div class="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <h5 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    完整內容
                </h5>
                <button type="button" class="text-slate-500 hover:bg-slate-200 rounded p-1 transition-colors" onclick="closeGenericModal('${modalId}')">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="p-0 overflow-y-auto bg-slate-50 flex-1">
                <pre class="whitespace-pre-wrap break-all p-4 text-sm font-mono text-slate-700">${fullText}</pre>
            </div>
            <div class="bg-white px-4 py-3 flex justify-end gap-2 border-t border-slate-200">
                <button type="button" class="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors" onclick="closeGenericModal('${modalId}')">
                    關閉
                </button>
                <button type="button" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm shadow-sm transition-colors" onclick="copyFullText('${elementId}', event)">
                    複製內容
                </button>
            </div>
        </div>
    `;

    // Check if modal exists
    let existing = document.getElementById(modalId);
    if(existing) existing.remove();

    const m = createGenericModal(modalId, modalHtml);
    document.body.style.overflow = 'hidden';
}

// 確保 Global Scope 有這些函數
window.createGenericModal = createGenericModal;
window.closeGenericModal = closeGenericModal;
window.showInputDialog = showInputDialog;
window.showConfirmDialog = showConfirmDialog;
window.showFullText = showFullText;

// 修復主 Modal 的關閉功能 (針對 dataModal)
window.closeModal = function() {
    const modalEl = document.getElementById('dataModal');
    if (modalEl) {
        modalEl.classList.add('hidden');
        modalEl.style.display = 'none';
    }
    document.body.style.overflow = '';
};

/**
 * 複製完整文字到剪貼簿
 * @param {string} elementId - 包含完整文字的元素 ID
 * @param {Event} event - 點擊事件（可選）
 */
function copyFullText(elementId, event) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('找不到元素:', elementId);
        alert('複製失敗：找不到內容');
        return;
    }

    const text = element.textContent || element.innerText;

    if (!text) {
        alert('沒有內容可複製');
        return;
    }

    // 方法 1: 使用 textarea (最可靠)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let success = false;

    try {
        // 嘗試使用 execCommand
        success = document.execCommand('copy');

        if (success) {
            console.log('✅ 使用 execCommand 複製成功');
            showCopySuccess(event);
        } else {
            throw new Error('execCommand 返回 false');
        }
    } catch (err) {
        console.warn('execCommand 失敗:', err);

        // 方法 2: 嘗試使用 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    console.log('✅ 使用 Clipboard API 複製成功');
                    showCopySuccess(event);
                })
                .catch(clipErr => {
                    console.error('Clipboard API 失敗:', clipErr);
                    alert('複製失敗，請手動選取並複製文字\n\n錯誤: ' + clipErr.message);
                });
        } else {
            alert('您的瀏覽器不支援自動複製，請手動選取並複製文字');
        }
    } finally {
        document.body.removeChild(textarea);
    }
}

/**
 * 顯示複製成功的視覺回饋
 * @param {Event} event - 點擊事件
 */
function showCopySuccess(event) {
    if (event) {
        const btn = event.target.closest('button');
        if (btn) {
            const originalHtml = btn.innerHTML;
            const originalClass = btn.className;

            btn.innerHTML = '<i class="bi bi-check2 me-1"></i>已複製';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
            btn.disabled = true;

            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.className = originalClass;
                btn.disabled = false;
            }, 2000);
        } else {
            alert('已複製到剪貼簿');
        }
    } else {
        alert('已複製到剪貼簿');
    }
}

// 初始化所有 DataTables
function initTables() {
    // Ensure all DBA data tables have consistent Tailwind styling and sensible max height
    document.querySelectorAll('.dba-datatable').forEach(el => {
        try {
            el.classList.add('min-w-full', 'text-sm');
            // Remove manual height calculation as it is now handled by CSS in modal.html
        } catch (e) {
            console.error('Table 初始化失敗:', el.id || el, e);
        }
    });

    // When app-level tab switches occur (custom tabs), recalc heights
    // When app-level tab switches occur (custom tabs), recalc heights & refresh editors
    document.querySelectorAll('#dbaTab [data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');

            // Refresh CodeMirror if switching to Execute SQL tab
            if (targetId === 'exec-pane') {
                setTimeout(() => {
                    if (typeof sqlEditor !== 'undefined' && sqlEditor) {
                        console.log('🔄 Refreshing SQL Editor layout...');
                        sqlEditor.refresh();
                        sqlEditor.focus();
                    }
                }, 100); // Delay to ensure DOM allows visibility
            }

            document.querySelectorAll('.dba-datatable').forEach(el => {
               // Height handled by CSS now
            });
        });
    });
}

/**
 * 物件表格分頁狀態（每個 type 各自獨立）
 */
const OBJ_PAGE_SIZE = 25; // 每頁筆數
const objPageState = {}; // { TABLE: {cur:1, filtered:[...]}, VIEW: {...}, ... }

/**
 * 取得目前 active pane 的 type 字串
 */
function getActiveObjType() {
    const pane = document.querySelector('.object-type-pane:not(.hidden)');
    return pane ? pane.getAttribute('data-type') : null;
}

/**
 * 取得指定 type 的 tbody 所有 tr
 */
function getObjRows(type) {
    const tbody = document.querySelector(`#objtable-${type} tbody`);
    return tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
}

/**
 * 搜尋目前的物件表格（整合分頁）
 */
function filterObjectTable() {
    const input = document.getElementById('objectSearchInput');
    if (!input) return;
    const filter = input.value.toLowerCase().trim();
    const type = getActiveObjType();
    if (!type) return;

    const allRows = getObjRows(type);
    // 篩選符合搜尋的 row 索引
    const filtered = allRows.filter(row =>
        row.textContent.toLowerCase().includes(filter)
    );

    // 初始化/重設當前 type 的分頁狀態
    if (!objPageState[type]) objPageState[type] = {};
    objPageState[type].filtered = filtered;
    objPageState[type].cur = 1;

    objRenderPage(type);
}

/**
 * 計算指定 type 的總頁數
 */
function objTotalPages(type) {
    const st = objPageState[type];
    if (!st || !st.filtered) return 1;
    return Math.max(1, Math.ceil(st.filtered.length / OBJ_PAGE_SIZE));
}

/**
 * 跳到指定頁
 */
function objGoPage(type, page) {
    const total = objTotalPages(type);
    page = Math.max(1, Math.min(page, total));
    if (!objPageState[type]) objPageState[type] = {};
    objPageState[type].cur = page;
    objRenderPage(type);
}

/**
 * 渲染指定 type 的目前頁（show/hide rows + 更新分頁 UI）
 */
function objRenderPage(type) {
    const st = objPageState[type];
    if (!st || !st.filtered) return;

    const allRows = getObjRows(type);
    const filtered = st.filtered;
    const cur = st.cur || 1;
    const total = objTotalPages(type);
    const start = (cur - 1) * OBJ_PAGE_SIZE; // 0-based
    const end = start + OBJ_PAGE_SIZE;

    // 全部先隱藏
    allRows.forEach(r => r.style.display = 'none');
    // 顯示本頁的 row
    filtered.slice(start, end).forEach(r => r.style.display = '');

    // 更新分頁 UI
    const pager = document.getElementById(`objpager-${type}`);
    if (!pager) return;

    if (filtered.length <= OBJ_PAGE_SIZE) {
        // 只有一頁，不需要分頁列；但要更新筆數顯示
        pager.style.setProperty('display', 'none', 'important');
    } else {
        pager.style.removeProperty('display');
        pager.style.display = 'flex';
    }

    // 筆數資訊
    const infoEl = document.getElementById(`objpager-info-${type}`);
    if (infoEl) {
        const from = filtered.length === 0 ? 0 : start + 1;
        const to = Math.min(end, filtered.length);
        infoEl.textContent = `共 ${filtered.length} 筆，顯示 ${from}–${to}`;
    }

    // 頁碼按鈕
    const btnsEl = document.getElementById(`objpager-btns-${type}`);
    if (btnsEl) {
        btnsEl.innerHTML = '';
        // 最多顯示 5 個頁碼（以目前頁為中心）
        let pageStart = Math.max(1, cur - 2);
        let pageEnd = Math.min(total, pageStart + 4);
        if (pageEnd - pageStart < 4) pageStart = Math.max(1, pageEnd - 4);
        for (let p = pageStart; p <= pageEnd; p++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = p;
            btn.className = p === cur
                ? 'px-3 py-1 rounded text-sm font-bold bg-blue-600 text-white border border-blue-600'
                : 'px-3 py-1 rounded text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-600';
            const _p = p;
            btn.onclick = () => objGoPage(type, _p);
            btnsEl.appendChild(btn);
        }
    }

    // 上/下頁按鈕 disabled 狀態
    const btnFirst = document.getElementById(`objpager-first-${type}`);
    const btnPrev  = document.getElementById(`objpager-prev-${type}`);
    const btnNext  = document.getElementById(`objpager-next-${type}`);
    const btnLast  = document.getElementById(`objpager-last-${type}`);
    if (btnFirst) btnFirst.disabled = cur <= 1;
    if (btnPrev)  btnPrev.disabled  = cur <= 1;
    if (btnNext)  btnNext.disabled  = cur >= total;
    if (btnLast)  btnLast.disabled  = cur >= total;
}

/**
 * 初始化所有 pane 的分頁狀態（頁面載入後呼叫）
 */
function initObjPagination() {
    const types = ['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'PACKAGE'];
    types.forEach(type => {
        const allRows = getObjRows(type);
        objPageState[type] = { cur: 1, filtered: allRows };
        objRenderPage(type);
    });
}

/**
 * 初始化全域搜尋快速鍵 (Ctrl+F 或 /)
 */
function initGlobalSearchShortcut() {
    window.addEventListener('keydown', function(e) {
        // 當使用者在非 input/textarea 元素按下 '/'
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) ||
                        (document.activeElement.closest('.CodeMirror')) ||
                        document.activeElement.isContentEditable;

        // '/' 觸發搜尋
        if (e.key === '/' && !isInput) {
            e.preventDefault();
            focusActiveSearch();
        }

        // Ctrl+F / Cmd+F 攔截
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            focusActiveSearch();
        }
    });
}

/**
 * 根據目前激活的分頁聚焦對應的搜尋框
 */
function focusActiveSearch() {
    // 檢查目前激活的分頁
    const activeTabBtn = document.querySelector('.nav-tab.active') ||
                       document.querySelector('.nav-tab[aria-selected="true"]');

    if (activeTabBtn) {
        const tabId = activeTabBtn.getAttribute('data-tab');

        // 如果是 Schedule Job 頁面
        if (tabId === 'job-pane') {
            const jobSearch = document.getElementById('jobSearchInput');
            if (jobSearch) {
                jobSearch.focus();
                jobSearch.select();
                return;
            }
        }
    }

    // 預設切換到物件導覽並聚焦
    const objSearch = document.getElementById('objectSearchInput');
    if (objSearch) {
        const objTab = document.querySelector('button[data-tab="obj-pane"]');
        if (objTab && !(objTab.classList.contains('active') || objTab.getAttribute('aria-selected') === 'true')) {
            objTab.click();
        }
        // 使用 setTimeout 確保 Tab 切換完成後再 focus
        setTimeout(() => {
            objSearch.focus();
            objSearch.select();
        }, 10);
    }
}

/**
 * 初始化物件導覽標籤切換
 */
function initObjectTypeTabs() {
    document.querySelectorAll('[data-type]').forEach(btn => {
        if (btn.classList.contains('type-tab')) {
            btn.addEventListener('click', function() {
                const type = this.getAttribute('data-type');

                // 更新標籤樣式
                document.querySelectorAll('.type-tab').forEach(t => {
                    t.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
                    t.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-300', 'hover:bg-slate-100');
                });
                this.classList.remove('bg-white', 'text-slate-700', 'border', 'border-slate-300', 'hover:bg-slate-100');
                this.classList.add('bg-blue-600', 'text-white', 'shadow-md');

                // 更新面板可見性
                document.querySelectorAll('.object-type-pane').forEach(pane => {
                    pane.classList.add('hidden');
                });
                const targetPane = document.querySelector(`.object-type-pane[data-type="${type}"]`);
                if (targetPane) targetPane.classList.remove('hidden');

                // 切換標籤時的特殊行為
                const objSearchWrapper = document.getElementById('objectSearchWrapper');
                if (type === 'SOURCE_SEARCH') {
                    // 隱藏物件搜尋框
                    if (objSearchWrapper) objSearchWrapper.style.display = 'none';
                    const input = document.getElementById('sourceSearchInput');
                    if (input) {
                        setTimeout(() => { input.focus(); input.select(); }, 50);
                    }
                } else {
                    // 顯示物件搜尋框
                    if (objSearchWrapper) objSearchWrapper.style.display = '';
                    // 一般物件切換時重設搜尋並重算分頁
                    const searchInput = document.getElementById('objectSearchInput');
                    if (searchInput) searchInput.value = '';
                    // 重設該 type 的分頁到第 1 頁（保留全部 rows）
                    if (!objPageState[type]) objPageState[type] = {};
                    objPageState[type].filtered = getObjRows(type);
                    objPageState[type].cur = 1;
                    objRenderPage(type);
                }
            });
        }
    });
}

// 鍵盤監聽功能
function initEditorShortcuts() {
    const editor = document.getElementById('sqlEditor');
    if (editor) {
        editor.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runSql();
            }
        });
    }
}

window.addEventListener('load', () => {
    initTables();
    getModal();
    initSqlEditor();
    initEditorShortcuts();
    initGlobalSearchShortcut();
    initObjectTypeTabs();
    initObjPagination(); // 初始化物件表格分頁

    // 監聽分頁切換以刷新 CodeMirror
    const execTab = document.querySelector('button[data-tab="exec-pane"]');
    if (execTab) {
        execTab.addEventListener('click', function (e) {
            if (window.sqlEditor) {
                setTimeout(() => window.sqlEditor.refresh(), 10);
            }
        });
    }

    // 載入當前 Owner 的物件中文說明
    console.log('🔍 [Debug] 開始檢查 data-current-owner 屬性...');
    const ownerElement = document.querySelector('[data-current-owner]');
    console.log('🔍 [Debug] ownerElement:', ownerElement);

    if (ownerElement) {
        const currentOwnerName = ownerElement.getAttribute('data-current-owner');
        console.log('🔍 [Debug] currentOwnerName:', currentOwnerName);

        if (currentOwnerName) {
            console.log('✅ [Debug] 準備載入 Owner:', currentOwnerName);
            loadObjectComments(currentOwnerName);
        } else {
            console.warn('⚠️ [Debug] data-current-owner 屬性存在但值為空');
        }
    } else {
        console.warn('⚠️ [Debug] 找不到 data-current-owner 元素');
        console.log('🔍 [Debug] 檢查頁面中所有帶 data 屬性的元素:');
        document.querySelectorAll('[data-current-owner]').forEach(el => {
            console.log('  -', el, el.getAttribute('data-current-owner'));
        });
    }
});

// CodeMirror 編輯器實例 (掛載到 window 以確保全域唯一)
window.sqlEditor = window.sqlEditor || null;

/**
 * 初始化 SQL 編輯器（CodeMirror）
 */
function initSqlEditor() {
    if (window.sqlEditorInitialized) {
        console.log('ℹ️ SQL 編輯器已初始化過，跳過。');
        return;
    }
    try {
        const textarea = document.getElementById('sqlEditor');

        if (!textarea || typeof CodeMirror === 'undefined') {
            console.warn('CodeMirror 未載入或找不到 sqlEditor 元素');
            return;
        }

        // 1. 徹底清理現有的實例與殘留 DOM
        if (window.sqlEditor) {
            try { window.sqlEditor.toTextArea(); } catch (e) {}
            window.sqlEditor = null;
        } else if (typeof sqlEditor !== 'undefined' && sqlEditor) {
            try { sqlEditor.toTextArea(); } catch (e) {}
            sqlEditor = null;
        }

        // 移除所有可能存在的殘留 CodeMirror 元素
        document.querySelectorAll('.CodeMirror').forEach(el => el.remove());

        // 2. 創建 CodeMirror 編輯器
        window.sqlEditor = CodeMirror.fromTextArea(textarea, {
            mode: 'text/x-sql',
            theme: 'monokai',
            lineNumbers: true,
            lineWrapping: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            matchBrackets: true,
            autoCloseBrackets: true,
            styleActiveLine: true,
            extraKeys: {
                'Ctrl-Enter': function() { runSql(); },
                'Ctrl-/': 'toggleComment',
                'Tab': 'indentMore',
                'Shift-Tab': 'indentLess'
            }
        });

        // 3. 設定樣式與強制隱藏原始 textarea (防止出現第二個黑塊)
        window.sqlEditor.setSize(null, '240px');
        window.sqlEditor.setValue('');

        // 強制隱藏原始輸入框
        textarea.style.setProperty('display', 'none', 'important');
        textarea.classList.add('hidden');

        window.sqlEditorInitialized = true;
        console.log('✅ SQL 編輯器已成功單一初始化');
    } catch (e) {
        console.error("CodeMirror 初始化錯誤:", e);
    }
}

function clearEditor() {
    try {
        if (window.sqlEditor) {
            window.sqlEditor.setValue('');
            window.sqlEditor.focus();
        } else {
            const el = document.getElementById('sqlEditor');
            if (el) el.value = '';
        }
    } catch (e) {
        alert("清除編輯器時發生錯誤: " + e.message);
    }
}

/**
 * 載入 SQL 檔案到編輯器
 * @param {Event} event - 檔案輸入變更事件
 */
function loadSqlFile(event) {
    try {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        // 檢查檔案類型
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.sql') && !fileName.endsWith('.txt')) {
            alert('請選擇 SQL 或 TXT 檔案');
            event.target.value = ''; // 清空輸入
            return;
        }

        // 檢查檔案大小（限制 5MB）
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            alert('檔案太大！請選擇小於 5MB 的檔案');
            event.target.value = '';
            return;
        }

        // 讀取檔案
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const editor = document.getElementById('sqlEditor');

                // 獲取當前內容 (兼容 CodeMirror)
                const currentContent = sqlEditor ? sqlEditor.getValue() : editor.value;

                // 詢問是否要覆蓋現有內容
                if (currentContent.trim() !== '') {
                    if (!confirm(`編輯器中已有內容，是否要覆蓋？\n\n檔案：${file.name}`)) {
                        event.target.value = '';
                        return;
                    }
                }

                // 載入內容到編輯器
                if (sqlEditor) {
                    sqlEditor.setValue(content);
                } else {
                    editor.value = content;
                }

                // 顯示成功訊息
                const statusMsg = document.getElementById('statusText');
                if (statusMsg) {
                    statusMsg.innerHTML = `<i class="bi bi-check-circle text-success me-2"></i>已載入檔案：${file.name} (${formatFileSize(file.size)})`;
                }

                // 顯示結果區域
                document.getElementById('execResultArea').classList.remove('hidden');

                console.log(`✅ 已載入 SQL 檔案: ${file.name}`);
            } catch (loadErr) {
                console.error("載入檔案內容失敗:", loadErr);
                alert(`載入檔案內容失敗:\n${loadErr.message}`);
            } finally {
                // 清空檔案輸入，允許重複選擇同一檔案
                event.target.value = '';
            }
        };

        reader.onerror = function() {
            alert('讀取檔案失敗，請重試');
            event.target.value = '';
            console.error('檔案讀取錯誤:', reader.error);
        };

        // 使用 UTF-8 編碼讀取
        reader.readAsText(file, 'UTF-8');
    } catch (e) {
        console.error("loadSqlFile 發生錯誤:", e);
        alert(`處理檔案時發生錯誤:\n${e.message}`);
        event.target.value = '';
    }
}

/**
 * 格式化檔案大小
 * @param {number} bytes - 位元組數
 * @returns {string} - 格式化的大小字串
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}


/**
 * ⚡ 執行 SQL：非同步串流模式
 */
async function runSql() {
    const editorEl = document.getElementById('sqlEditor');
    const sql = window.sqlEditor ? window.sqlEditor.getValue().trim() : (editorEl ? editorEl.value.trim() : '');
    if (!sql) return alert("❌ 請先輸入 SQL 語句");

    const resArea = document.getElementById('execResultArea');
    const statusBox = document.getElementById('execStatusMsg');
    const statusText = document.getElementById('statusText');
    const spinner = document.getElementById('execSpinner');
    const dbmsBox = document.getElementById('dbmsOutputArea');
    const scriptBox = document.getElementById('scriptOutputArea');
    const tableWrap = document.getElementById('execTableWrapper');
    const gridPlaceholder = document.getElementById('gridPlaceholder');

    // UI 初始化
    resArea.classList.remove('hidden');
    statusBox.className = 'bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-center gap-3';
    statusText.textContent = '🔄 指令執行中，正在建立串流連線...';
    spinner.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    gridPlaceholder.classList.remove('hidden');
    dbmsBox.textContent = '-- 執行中，等待輸出 --';
    switchResultTab('res-msg');

    // 清空之前的表格資料
    const thead = document.querySelector('#execDataTable thead');
    const tbody = document.querySelector('#execDataTable tbody');
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';

        // 清空搜尋緩衝
        window.filteredSqlData = null;

        const startTime = new Date();
    scriptBox.textContent = `> [${startTime.toLocaleTimeString()}] 開始執行腳本...\n> SQL: ${sql.substring(0, 200)}${sql.length > 200 ? '...' : ''}`;

    try {
        const response = await fetch('/api/execute_sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "伺服器執行錯誤");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // --- Pagination 初始化 ---
        window.currentSqlData = [];     // 存放所有緩衝數據
        let firstChunk = true;          // Flag to track first response chunk
        window.currentSqlColumns = [];  // 存放目前的欄位定義
        window.execCurrentPage = 1;     // 目前頁碼
        window.execPageSize = parseInt(document.getElementById('execPageSize')?.value || 50);
        const MAX_TOTAL_ROWS = 50000;   // 緩存上限 (避免前端崩潰)

        const processLine = async (line) => {
            if (!line.trim()) return;
            let data;
            try {
                data = JSON.parse(line);
            } catch (e) {
                console.error("JSON 解析錯誤:", e, "內容:", line);
                // 顯示在訊息欄，不跳 alert
                switchResultTab('res-msg');
                statusBox.className = 'bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg';
                statusText.innerHTML = `<svg class="w-5 h-5 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> <strong>前端解析錯誤 (JSON Parse Error):</strong><br>${e.message}<br><small class="font-mono">${line.substring(0,120)}...</small>`;
                return;
            }

            if (data.type === 'error') {
                const errorMsg = data.detail || "未知錯誤";
                // 顯示在訊息欄，切換到訊息 tab，不跳 alert
                spinner.classList.add('hidden');
                switchResultTab('res-msg');
                statusBox.className = 'bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg';
                statusText.innerHTML = `<svg class="w-5 h-5 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> <strong>SQL 執行錯誤 (Backend Error):</strong><br><pre class="mt-2 text-xs whitespace-pre-wrap font-mono bg-red-100 rounded p-2">${errorMsg}</pre>`;
                scriptBox.textContent += `\n[ERROR] ${errorMsg}`;
                throw new Error(errorMsg);
            }

            if (data.type === 'query' && firstChunk && data.columns) {
                try {
                    firstChunk = false;

                    // 顯示結果區域
                    const execResultArea = document.getElementById('execResultArea');
                    if (execResultArea) {
                        execResultArea.classList.remove('hidden');
                    }

                    // 隱藏 placeholder，顯示表格
                    gridPlaceholder.classList.add('hidden');
                    tableWrap.classList.remove('hidden');

                    window.currentSqlColumns = data.columns;

                    // 建立表頭
                    const execThead = document.querySelector('#execDataTable thead');
                    if (execThead) {
                        execThead.innerHTML = '<tr>' + data.columns.map(c => `<th class="px-4 py-3 text-left font-semibold whitespace-nowrap">${c}</th>`).join('') + '</tr>';
                    }

                    // 切換到資料表格 tab
                    if (typeof switchResultTab === 'function') {
                        console.log('🔄 準備切換到 res-grid tab...');
                        switchResultTab('res-grid');
                    } else {
                        console.error('❌ switchResultTab 函數不存在！');
                    }

                    console.log('✅ 表格已初始化，欄位:', data.columns.length);
                } catch (dtError) {
                    console.error("❌ 表格初始化失敗:", dtError);
                    // 顯示在訊息欄，不跳 alert
                    switchResultTab('res-msg');
                    statusBox.className = 'bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg';
                    statusText.innerHTML = `<svg class="w-5 h-5 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> <strong>表格初始化失敗:</strong><br>${dtError.message}`;
                }
            }

            if (data.data && data.data.length > 0) {
                // 將新數據加入緩衝區
                const remainingSpace = MAX_TOTAL_ROWS - window.currentSqlData.length;
                if (remainingSpace > 0) {
                    const chunkToAdd = data.data.slice(0, remainingSpace);
                    window.currentSqlData.push(...chunkToAdd);
                }

                // 如果目前是第一頁，且正在載入中，則更新顯示
                if (window.execCurrentPage === 1 && window.currentSqlData.length > 0) {
                    renderExecGridPage();
                }

                statusText.textContent = `⚡ 資料串流中... 已獲取 ${window.currentSqlData.length} 筆 (目前分頁顯示中)`;
                if (typeof updateExecSqlBadges === 'function') updateExecSqlBadges();
            }

            if (data.dbms_output) dbmsBox.textContent = data.dbms_output;
            if (data.type === 'message') {
                statusBox.className = 'bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-center gap-3';
                statusText.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> ${data.content}`;
            }
        };

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); // 保留未完成的一行

            for (let line of lines) {
                await processLine(line);
                if (window.currentSqlData.length >= MAX_TOTAL_ROWS) {
                    await reader.cancel();
                    break;
                }
            }
            if (window.currentSqlData.length >= MAX_TOTAL_ROWS) break;
        }

        const endTime = new Date();
        spinner.classList.add('hidden');
        scriptBox.textContent += `\n> [${endTime.toLocaleTimeString()}] 執行完畢。總獲取筆數: ${window.currentSqlData.length}`;

        if (window.currentSqlData.length > 0) {
            statusBox.className = 'bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-center gap-3';
            statusText.innerHTML = `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> 查詢完成，共 ${window.currentSqlData.length} 筆資料。(耗時: ${((endTime - startTime)/1000).toFixed(2)}s)`;
        }
    } catch (e) {
        spinner.classList.add('hidden');
        switchResultTab('res-msg');
        statusBox.className = 'bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg';
        statusText.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> <strong>錯誤:</strong> ${e.message}`;
        scriptBox.textContent += `\n[ERROR] ${e.message}`;

        // 顯示錯誤在訊息欄，無需額外 alert
        console.error("執行流程中斷:", e);
    }
}


/**
 * ⚡ 取得篩選後的 SQL 資料
 */
function getFilteredExecData() {
    const input = document.getElementById('execGridSearchInput');
    const filter = input ? input.value.toLowerCase().trim() : '';
    if (!filter) return window.currentSqlData || [];
    return (window.currentSqlData || []).filter(row =>
        row.some(cell => String(cell).toLowerCase().includes(filter))
    );
}

/**
 * ⚡ 計算總頁數
 */
function execTotalPages() {
    const filteredData = getFilteredExecData();
    const pageSize = window.execPageSize || 50;
    return Math.max(1, Math.ceil(filteredData.length / pageSize));
}

/**
 * ⚡ 跳到指定頁
 */
function goExecPage(page) {
    const total = execTotalPages();
    if (page < 1) page = 1;
    if (page > total) page = total;
    window.execCurrentPage = page;
    renderExecGridPage();

    // 捲動回頂部
    const scrollArea = document.getElementById('execTableScrollArea');
    if (scrollArea) scrollArea.scrollTop = 0;
}

/**
 * ⚡ 渲染 SQL 資料網格 (分頁版)
 */
function renderExecGridPage() {
    const filteredData = getFilteredExecData();
    const pageSize = window.execPageSize || 50;
    const totalPages = execTotalPages();

    if (window.execCurrentPage > totalPages) window.execCurrentPage = totalPages;
    if (window.execCurrentPage < 1) window.execCurrentPage = 1;

    const startIdx = (window.execCurrentPage - 1) * pageSize;
    const pageData = filteredData.slice(startIdx, startIdx + pageSize);

    const execTbody = document.querySelector('#execDataTable tbody');
    if (execTbody) {
        execTbody.innerHTML = pageData.map(row => {
            const cells = row.map(cell => {
                const displayValue = cell === null || cell === undefined
                    ? '<em class="text-slate-400">NULL</em>'
                    : String(cell);
                return `<td class="px-4 py-2 align-middle whitespace-nowrap">${displayValue}</td>`;
            }).join('');
            return `<tr class="hover:bg-slate-50 transition-colors">${cells}</tr>`;
        }).join('');
    }

    // 更新分頁 UI
    updateExecPagination(filteredData.length, totalPages);

    // 更新狀態文字
    const statusText = document.getElementById('statusText');
    if (statusText) {
        const isFiltered = !!document.getElementById('execGridSearchInput')?.value;
        statusText.textContent = `⚡ ${isFiltered ? '搜尋中' : '分頁顯示中'}... 目前第 ${window.execCurrentPage} 頁 (緩存共 ${window.currentSqlData.length} 筆)`;
    }

    // 更新 Badges
    updateExecSqlBadges();
}

/**
 * ⚡ 更新 SQL 分頁控制項
 */
function updateExecPagination(totalRows, totalPages) {
    const paginationEl = document.getElementById('execPagination');
    if (!paginationEl) return;

    if (totalRows === 0) {
        paginationEl.classList.add('hidden');
        return;
    }
    paginationEl.classList.remove('hidden');
    paginationEl.classList.add('flex');

    const infoEl = document.getElementById('execPaginationInfo');
    if (infoEl) {
        const start = totalRows === 0 ? 0 : (window.execCurrentPage - 1) * window.execPageSize + 1;
        const end = Math.min(window.execCurrentPage * window.execPageSize, totalRows);
        infoEl.textContent = `顯示第 ${start}–${end} 筆，共 ${totalRows.toLocaleString()} 筆 | 第 ${window.execCurrentPage} / ${totalPages} 頁`;
    }

    // 按鈕狀態
    const btnFirst = document.getElementById('btnExecFirstPage');
    const btnPrev = document.getElementById('btnExecPrevPage');
    const btnNext = document.getElementById('btnExecNextPage');
    const btnLast = document.getElementById('btnExecLastPage');

    if (btnFirst) btnFirst.disabled = window.execCurrentPage <= 1;
    if (btnPrev) btnPrev.disabled = window.execCurrentPage <= 1;
    if (btnNext) btnNext.disabled = window.execCurrentPage >= totalPages;
    if (btnLast) btnLast.disabled = window.execCurrentPage >= totalPages;

    // 頁碼數字 (顯示 5 個)
    const pageNumbers = document.getElementById('execPageNumbers');
    if (pageNumbers) {
        const maxVisible = 5;
        let start = Math.max(1, window.execCurrentPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

        let html = '';
        for (let i = start; i <= end; i++) {
            if (i === window.execCurrentPage) {
                html += `<button class="px-3 py-1.5 rounded bg-blue-600 text-white font-bold text-sm border border-blue-600 shadow-sm">${i}</button>`;
            } else {
                html += `<button onclick="goExecPage(${i})" class="px-3 py-1.5 rounded bg-white text-slate-600 border border-slate-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 text-sm transition-colors">${i}</button>`;
            }
        }
        pageNumbers.innerHTML = html;
    }
}

/**
 * ⚡ 更改每頁筆數
 */
function changeExecPageSize(size) {
    window.execPageSize = parseInt(size);
    window.execCurrentPage = 1;
    renderExecGridPage();
}

/**
 * ⚡ Helper to Update SQL Badges (Total, Rendered, Status)
 */
function updateExecSqlBadges() {
    const badges = document.getElementById('execSqlBadges');
    if (!badges) return;

    const dataBuffer = getFilteredExecData();
    const totalFetched = (window.currentSqlData || []).length;
    const filteredCount = dataBuffer.length;
    const isStreaming = document.getElementById('execSpinner') && !document.getElementById('execSpinner').classList.contains('hidden');

    const totalText = isStreaming ? `> ${totalFetched.toLocaleString()}` : totalFetched.toLocaleString();

    badges.innerHTML = `
        <span class="px-3 py-1 bg-blue-600 text-white rounded shadow-sm text-sm font-semibold">📊 總緩存筆數: ${totalText}</span>
        ${filteredCount !== totalFetched ? `<span class="px-3 py-1 bg-amber-500 text-white rounded shadow-sm text-sm font-semibold">🔍 篩選後筆數: ${filteredCount.toLocaleString()}</span>` : ''}
        <span class="px-3 py-1 bg-cyan-600 text-white rounded shadow-sm text-sm font-semibold">目前頁碼: ${window.execCurrentPage} / ${execTotalPages()}</span>
        <span class="px-3 py-1 bg-green-600 text-white rounded shadow-sm text-sm font-semibold">✅ 分頁模式已啟用</span>
    `;
    badges.classList.remove('hidden');
}


/**
 * ⚡ 搜尋結果網格
 */
function filterExecGridTable() {
    const input = document.getElementById('execGridSearchInput');
    if (!input || !window.currentSqlData) return;

    // 重設為第一頁並重新渲染
    window.execCurrentPage = 1;
    renderExecGridPage();
}


// 📊 功能補全：匯出 DataGrid 內容為 CSV
function exportGridToCSV() {
    try {
        // 直接從 DOM 讀取表格資料
        const table = document.getElementById('execDataTable');
        if (!table) {
            alert('找不到表格資料');
            return;
        }

        // 讀取表頭 (優先使用緩衝區)
        let headers = [];
        if (window.currentSqlColumns && window.currentSqlColumns.length > 0) {
            headers = window.currentSqlColumns;
        } else {
            headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        }

        // 讀取資料內容 (優先使用緩衝區)
        let dataRows = [];
        if (window.currentSqlData && window.currentSqlData.length > 0) {
            dataRows = window.currentSqlData;
        } else {
            const trElements = Array.from(table.querySelectorAll('tbody tr'));
            dataRows = trElements.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
        }

        if (dataRows.length === 0) {
            alert('沒有資料可以匯出');
            return;
        }

        // 建立 CSV 內容
        let csvContent = "\uFEFF"; // UTF-8 BOM

        // 加入表頭
        if (headers.length > 0) {
            csvContent += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\r\n';
        }

        // 加入內容
        dataRows.forEach(row => {
            csvContent += row.map(cell => {
                const cellVal = (cell === null || cell === undefined) ? '' : String(cell);
                return `"${cellVal.replace(/"/g, '""')}"`;
            }).join(',') + '\r\n';
        });

        // 建立下載連結
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `sql_export_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`✅ 已匯出 ${rows.length} 筆資料到 CSV`);
    } catch (e) {
        console.error('匯出 CSV 失敗:', e);
        alert(`匯出失敗: ${e.message}`);
    }
}


// --- 各種檢視功能補全 ---

function prepareModal(title) {
    const m = getModal(); if (!m) return false;

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) {
        modalTitle.innerHTML = `<svg class="w-5 h-5 inline me-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg> ${title}`;
    }

    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'flex';

    const tableContent = document.getElementById('tableContent');
    if (tableContent) tableContent.style.display = 'none';

    const sourceContent = document.getElementById('sourceContent');
    if (sourceContent) sourceContent.classList.add('hidden');

    const dbobjContent = document.getElementById('dbobjContent');
    if (dbobjContent) dbobjContent.classList.add('hidden');

    const monitorContent = document.getElementById('monitorContent');
    if (monitorContent) monitorContent.classList.add('hidden');

    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) copyBtn.classList.add('hidden');

    const totalRowsBadge = document.getElementById('totalRowsBadge');
    if (totalRowsBadge) totalRowsBadge.innerHTML = '';

    // 隱藏搜尋列與分頁列
    const searchBar = document.getElementById('previewSearchBar');
    if (searchBar) searchBar.style.display = 'none';
    const pagination = document.getElementById('previewPagination');
    if (pagination) pagination.style.display = 'none';
    const searchInput = document.getElementById('previewSearchInput');
    if (searchInput) searchInput.value = '';

    // 重設分頁狀態
    previewAllData = [];
    previewColumns = [];
    previewPage = 1;
    previewSearchTerm = '';

    if (previewDataTable) {
        try { previewDataTable.destroy(); } catch(e) {}
        previewDataTable = null;
    }

    const dataHeader = document.getElementById('dataHeader');
    if (dataHeader) dataHeader.innerHTML = '';

    const dataBody = document.getElementById('dataBody');
    if (dataBody) dataBody.innerHTML = '';

    const sourceCode = document.getElementById('sourceCode');
    if (sourceCode) sourceCode.textContent = '';

    document.body.style.overflow = 'hidden'; // 鎖定背景，防止背景頁面捲動
    m.show();
    return true;
}

async function viewData(name) {
    if (!name && currentTableName) name = currentTableName;
    currentTableName = name;

    if (!prepareModal(`資料預覽: ${name}`)) return;

    // 更新 Loading 提示文字
    const loadingEl = document.getElementById('loading');
    const loadingText = loadingEl ? loadingEl.querySelector('p') : null;
    if (loadingText) {
        loadingText.textContent = '正在載入資料，請稍候...';
    }

    // 設定 30 秒 Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const LOAD_LIMIT = 99999;
        const res = await fetch(
            `/api/table_data/${encodeURIComponent(name)}?limit=${LOAD_LIMIT}&offset=0`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        const d = await res.json();

        if (!res.ok) throw new Error(d.detail || '伺服器錯誤');

        // ── 儲存全部資料 ──────────────────────────────────────────
        previewColumns = d.columns || [];
        previewAllData = d.data || [];
        previewPage = 1;
        previewSearchTerm = '';

        // ── 建立表頭 ──────────────────────────────────────────────
        const dataHeader = document.getElementById('dataHeader');
        if (dataHeader) {
            dataHeader.innerHTML = previewColumns.map(c =>
                `<th class="px-4 py-2 font-semibold whitespace-nowrap">${c}</th>`
            ).join('');
        }

        // ── Badge ─────────────────────────────────────────────────
        const totalText = (d.total && d.total > 0)
            ? d.total.toLocaleString()
            : previewAllData.length.toLocaleString();
        const loadedCount = previewAllData.length;
        const isPartial = loadedCount >= LOAD_LIMIT;

        const totalRowsBadge = document.getElementById('totalRowsBadge');
        if (totalRowsBadge) {
            totalRowsBadge.innerHTML = `
                <div class="flex flex-wrap gap-2 items-center">
                    <span class="px-3 py-1 bg-blue-600 text-white rounded shadow-sm text-sm font-semibold">📊 總存量筆數: ${totalText}</span>
                    <span class="px-3 py-1 bg-cyan-600 text-white rounded shadow-sm text-sm font-semibold">已載入: ${loadedCount.toLocaleString()} 筆</span>
                    ${isPartial ? '<span class="px-3 py-1 bg-yellow-400 text-gray-900 rounded shadow-sm text-sm font-semibold border border-yellow-500">⚠️ 資料量超大，僅顯示前 99999 筆</span>' : '<span class="px-3 py-1 bg-green-600 text-white rounded shadow-sm text-sm font-semibold">✅ 全數載入完畢</span>'}
                </div>
            `;
        }

        // ── 顯示搜尋列 ────────────────────────────────────────────
        const searchBar = document.getElementById('previewSearchBar');
        if (searchBar) searchBar.style.display = 'flex';

        // ── 渲染第一頁 ────────────────────────────────────────────
        renderPreviewGrid();

        // ── 顯示表格區 ────────────────────────────────────────────
        if (loadingEl) loadingEl.style.display = 'none';
        const tableContent = document.getElementById('tableContent');
        if (tableContent) tableContent.style.display = 'flex';

        console.log(`✅ viewData 完成：${previewAllData.length} 筆，${previewColumns.length} 欄`);

    } catch (e) {
        clearTimeout(timeoutId);
        console.error('❌ viewData 錯誤:', e);

        if (loadingEl) loadingEl.style.display = 'none';
        const tableContent = document.getElementById('tableContent');
        if (tableContent) {
            tableContent.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <div class="text-red-600 text-5xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold text-red-800 mb-2">載入失敗</h3>
                    <p class="text-red-600">${e.name === 'AbortError' ? '伺服器回應超時，請稍後再試' : e.message}</p>
                    <button onclick="closeModal()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">關閉</button>
                </div>
            `;
            tableContent.style.display = 'flex';
        }
    }
}

// ── 資料預覽：取得過濾後資料 ─────────────────────────────────────
function getFilteredPreviewData() {
    if (!previewSearchTerm) return previewAllData;
    const term = previewSearchTerm.toLowerCase();
    return previewAllData.filter(row =>
        row.some(cell => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(term))
    );
}

// ── 資料預覽：計算總頁數 ─────────────────────────────────────────
function previewTotalPages() {
    return Math.max(1, Math.ceil(getFilteredPreviewData().length / PREVIEW_PAGE_SIZE));
}

// ── 資料預覽：渲染目前頁資料 ──────────────────────────────────────
function renderPreviewGrid() {
    const filtered = getFilteredPreviewData();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PREVIEW_PAGE_SIZE));

    // 確保頁碼合法
    if (previewPage < 1) previewPage = 1;
    if (previewPage > totalPages) previewPage = totalPages;

    const startIdx = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    const pageData = filtered.slice(startIdx, startIdx + PREVIEW_PAGE_SIZE);

    const tbody = document.getElementById('dataBody');
    if (!tbody) return;

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${previewColumns.length || 1}" class="px-4 py-8 text-center text-slate-400 italic">無符合條件的資料</td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(row =>
            '<tr class="hover:bg-slate-50 transition-colors">' +
            row.map(c =>
                `<td class="px-4 py-2 border-t border-slate-200 whitespace-nowrap">${c === null || c === undefined ? '<em class="text-slate-400">NULL</em>' : c}</td>`
            ).join('') +
            '</tr>'
        ).join('');
    }

    updatePreviewPagination(filtered.length, totalPages);
}

// ── 資料預覽：更新分頁控制列 ──────────────────────────────────────
function updatePreviewPagination(totalRows, totalPages) {
    const paginationEl = document.getElementById('previewPagination');
    const pageInfo     = document.getElementById('previewPageInfo');
    const btnFirst     = document.getElementById('previewBtnFirst');
    const btnPrev      = document.getElementById('previewBtnPrev');
    const btnNext      = document.getElementById('previewBtnNext');
    const btnLast      = document.getElementById('previewBtnLast');
    const pageBtns     = document.getElementById('previewPageBtns');
    const searchCount  = document.getElementById('previewSearchCount');

    if (!paginationEl) return;

    if (totalRows === 0) {
        paginationEl.style.display = 'none';
        return;
    }
    paginationEl.style.display = 'flex';

    const startRow = (previewPage - 1) * PREVIEW_PAGE_SIZE + 1;
    const endRow   = Math.min(previewPage * PREVIEW_PAGE_SIZE, totalRows);

    if (pageInfo) {
        pageInfo.textContent = `第 ${startRow}–${endRow} 筆，共 ${totalRows.toLocaleString()} 筆 | 第 ${previewPage} / ${totalPages} 頁`;
    }

    // 搜尋結果提示
    if (searchCount) {
        searchCount.textContent = previewSearchTerm
            ? `找到 ${totalRows.toLocaleString()} 筆符合「${previewSearchTerm}」`
            : '';
    }

    const isFirst = previewPage === 1;
    const isLast  = previewPage === totalPages;

    if (btnFirst) btnFirst.disabled = isFirst;
    if (btnPrev)  btnPrev.disabled  = isFirst;
    if (btnNext)  btnNext.disabled  = isLast;
    if (btnLast)  btnLast.disabled  = isLast;

    // 頁碼按鈕（最多顯示 5 個）
    if (pageBtns) {
        const maxBtns = 5;
        let startPage = Math.max(1, previewPage - Math.floor(maxBtns / 2));
        let endPage   = Math.min(totalPages, startPage + maxBtns - 1);
        if (endPage - startPage < maxBtns - 1) startPage = Math.max(1, endPage - maxBtns + 1);

        let html = '';
        for (let p = startPage; p <= endPage; p++) {
            const active = p === previewPage
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50';
            html += `<button type="button" class="px-3 py-1 rounded border text-sm ${active}" onclick="previewGoPage(${p})">${p}</button>`;
        }
        pageBtns.innerHTML = html;
    }
}

// ── 資料預覽：搜尋（即時過濾）────────────────────────────────────
function previewSearch(term) {
    previewSearchTerm = term.trim();
    previewPage = 1;
    renderPreviewGrid();
}

// ── 資料預覽：跳頁 ───────────────────────────────────────────────
function previewGoPage(page) {
    const total = previewTotalPages();
    if (page < 1 || page > total) return;
    previewPage = page;
    renderPreviewGrid();
    // 滾動表格容器回頂端
    const wrapper = document.getElementById('tableWrapper');
    if (wrapper) wrapper.scrollTop = 0;
}

// 🍞 Toast Notification Helper
function showLoadingToast(msg) {
    let toast = document.getElementById('loading-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'loading-toast';
        toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] flex items-center gap-2 transition-opacity duration-300 opacity-0';
        toast.innerHTML = `
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span id="loading-toast-msg" class="text-sm font-medium"></span>
        `;
        document.body.appendChild(toast);
        // Force reflow
        void toast.offsetWidth;
        toast.classList.remove('opacity-0');
    }
    const msgEl = toast.querySelector('#loading-toast-msg');
    if (msgEl) msgEl.textContent = msg;
}

function hideLoadingToast() {
    const toast = document.getElementById('loading-toast');
    if (toast) {
        toast.classList.add('opacity-0');
        setTimeout(() => {
            if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }
}



async function viewSchema(name) {
    if (!prepareModal(`物件結構定義: ${name}`)) return;

    // Update loading message
    const loadingText = document.querySelector('#loading p');
    if (loadingText) {
        loadingText.innerHTML = `<div class="inline-block w-5 h-5 border-2 border-blue-600 border-r-transparent rounded-full animate-spin mr-2 align-middle"></div>正在讀取資料表結構，請稍候...`;
    }

    try {
        const res = await fetch(`/api/table_schema/${encodeURIComponent(name)}`);
        const d = await res.json();
        if (res.ok) {
            // 添加「自動補全中文說明」按鈕
            const autoFillBtn = `
                <div class="mb-3">
                    <button class="px-3 py-1.5 bg-green-600 text-white rounded text-sm shadow hover:bg-green-700 transition-colors flex items-center gap-1" onclick="autoFillColumnComments('${name}')">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> 自動補全中文說明
                    </button>
                    <span id="columnCommentStatus" class="ms-3 text-slate-500 text-sm"></span>
                </div>
            `;

            const headers = ["欄位名稱", "資料型態", "長度/精度", "可否為空", "預設值", "中文說明"];
            document.getElementById('dataHeader').innerHTML = headers.map(h => `<th class="px-4 py-2 bg-slate-600 text-white font-semibold text-left">${h}</th>`).join('');

            // 儲存當前表格名稱供後續使用
            window.currentSchemaTable = name;

            document.getElementById('dataBody').innerHTML = d.data.map((r, idx) => {
                let isNullable = r[3] === 'Y' || r[3] === 'YES';
                const columnName = r[0];
                const comment = r[5] || '';
                const commentDisplay = comment || '(無說明)';

                return '<tr class="border-b hover:bg-slate-50 transition-colors">' +
                    `<td class="px-4 py-2 font-medium text-slate-700">${columnName}</td>` +
                    `<td class="px-4 py-2"><span class="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-mono">${r[1]}</span></td>` +
                    `<td class="px-4 py-2 text-slate-600">${r[2] ?? '-'}</td>` +
                    `<td class="px-4 py-2">${isNullable ? '<span class="text-green-600 text-xs font-semibold">NULLABLE</span>' : '<span class="text-red-600 text-xs font-bold">NOT NULL</span>'}</td>` +
                    `<td class="px-4 py-2"><small class="text-slate-500 font-mono">${r[4] ?? '-'}</small></td>` +
                    `<td class="px-4 py-2">
                        <div class="flex items-center gap-2" id="column-comment-${idx}">
                            <span class="flex-grow text-sm ${comment ? 'text-slate-700' : 'text-slate-400 italic'}">
                                ${commentDisplay}
                            </span>
                            <button class="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    onclick="editColumnComment('${name}', '${columnName}', '${idx}')"
                                    title="編輯中文說明">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                        </div>
                    </td>` +
                '</tr>';
            }).join('');

            document.getElementById('loading').style.display = 'none';

            // 在表格上方插入自動補全按鈕
            const tableContent = document.getElementById('tableContent');
            tableContent.style.display = 'flex';

            // 檢查是否已存在按鈕，避免重複添加
            if (!document.getElementById('columnCommentStatus')) {
                tableContent.insertAdjacentHTML('afterbegin', autoFillBtn);
            }

            try {
                // Schema view - 使用 SimpleTable 建立資料預覽
                // 表头已经在上面手动生成了，这里不需要再次生成，除非 SimpleTable 依赖它
                // 但 SimpleTable 不适用于这种高度定制的 HTML 行渲染（帶按鈕等）
                // 所以这里不需要初始化 SimpleTable 用于显示，只需要 basic scroll listeners mainly?
                // 或者我们不需要 SimpleTable 这里，只要 CSS 样式正确即可。
                // Existing content.js logic tried to use SimpleTable for *preview* but viewSchema renders implementation itself.
                // Wait, original code tried to use SimpleTable on `#dataTable`.
                // But viewSchema ALREADY populated #dataTable with manual HTML above!
                // So calling `new SimpleTable` might be redundant or for sorting features?
                // I'll skip SimpleTable initialization here and let it be a static table.

                // 🚀 設置無限滾動監聽器 ( 雖然 Schema view 通常不長，但保持一致性 )
                // setupInfiniteScroll();
                // Schema data is usually small (<100 rows).
            } catch (e) {
                console.error('Schema render error:', e);
            }

        } else {
            document.getElementById('loading').style.display = 'none';
            alert("讀取結構失敗: " + (d.detail || '未知錯誤'));
        }
    } catch (e) {
        document.getElementById('loading').style.display = 'none';
        alert("讀取異常: " + e.message);
    }
}

/**
 * 編輯欄位的中文說明
 * @param {string} tableName - 表格全名 (OWNER.TABLE)
 * @param {string} columnName - 欄位名稱
 * @param {string} rowIdx - 行索引
 */
async function editColumnComment(tableName, columnName, rowIdx) {
    const container = document.getElementById(`column-comment-${rowIdx}`);
    if (!container) return;

    const currentSpan = container.querySelector('span');
    const currentComment = currentSpan.textContent.trim() === '(無說明)' ? '' : currentSpan.textContent.trim();

    showInputDialog({
        title: '編輯欄位中文說明',
        message: `請輸入欄位 ${columnName} 的中文說明：`,
        placeholder: '例如：客戶編號、姓名、地址等',
        defaultValue: currentComment,
        onConfirm: async function(newComment) {
            try {
                // 拆分 tableName 取得 owner 和 table
                const parts = tableName.split('.');
                const owner = parts[0];
                const table = parts[1];

                const response = await fetch('/api/update_column_comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        owner: owner,
                        table_name: table,
                        column_name: columnName,
                        comment: newComment
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // 更新顯示
                    const displayText = newComment || '(無說明)';
                    currentSpan.innerHTML = displayText;
                    currentSpan.style.color = newComment ? '' : '#999';

                    // 顯示成功訊息
                    const statusEl = document.getElementById('columnCommentStatus');
                    if (statusEl) {
                        statusEl.innerHTML = `<i class="bi bi-check-circle text-success me-1"></i>${result.message}`;
                        setTimeout(() => { statusEl.innerHTML = ''; }, 3000);
                    }
                } else {
                    alert(`更新失敗: ${result.message}`);
                }
            } catch (e) {
                alert(`更新欄位中文說明時發生錯誤: ${e.message}`);
            }
        }
    });
}

/**
 * 自動補全所有欄位的中文說明
 * @param {string} tableName - 表格全名 (OWNER.TABLE)
 */
async function autoFillColumnComments(tableName) {
    showConfirmDialog({
        title: '確認自動補全欄位說明',
        message: '此功能會自動為所有沒有中文說明的欄位補上預設說明。\n\n確定要繼續嗎？',
        confirmText: '確定執行',
        confirmClass: 'btn-success',
        onConfirm: async function() {
            const statusEl = document.getElementById('columnCommentStatus');
            if (statusEl) {
                statusEl.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>正在處理...';
            }

            try {
                // 拆分 tableName 取得 owner 和 table
                const parts = tableName.split('.');
                const owner = parts[0];
                const table = parts[1];

                // 取得所有欄位
                const res = await fetch(`/api/table_schema/${encodeURIComponent(tableName)}`);
                const d = await res.json();

                if (!res.ok) {
                    throw new Error('無法取得欄位列表');
                }

                let updatedCount = 0;

                for (let i = 0; i < d.data.length; i++) {
                    const row = d.data[i];
                    const columnName = row[0];
                    const currentComment = row[5] || '';

                    // 只更新沒有說明的欄位
                    if (!currentComment) {
                        try {
                            const defaultComment = `${columnName} 欄位`;

                            const response = await fetch('/api/update_column_comment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    owner: owner,
                                    table_name: table,
                                    column_name: columnName,
                                    comment: defaultComment
                                })
                            });

                            const result = await response.json();
                            if (result.success) {
                                updatedCount++;

                                // 更新界面顯示
                                const container = document.getElementById(`column-comment-${i}`);
                                if (container) {
                                    const span = container.querySelector('span');
                                    if (span) {
                                        span.textContent = defaultComment;
                                        span.style.color = '';
                                    }
                                }
                            }
                        } catch (e) {
                            console.error(`更新欄位 ${columnName} 失敗:`, e);
                        }
                    }
                }

                if (statusEl) {
                    statusEl.innerHTML = `<i class="bi bi-check-circle text-success me-1"></i>已自動補全 ${updatedCount} 個欄位的中文說明`;
                    setTimeout(() => { statusEl.innerHTML = ''; }, 5000);
                }
            } catch (e) {
                const statusEl = document.getElementById('columnCommentStatus');
                if (statusEl) {
                    statusEl.innerHTML = `<i class="bi bi-exclamation-triangle text-danger me-1"></i>處理失敗: ${e.message}`;
                }
                alert(`自動補全失敗: ${e.message}`);
            }
        }
    });
}

function formatAndDisplaySql(rawText, isRaw = false) {
    let clean = (isRaw ? rawText : decodeHtml(rawText)).trim();
    let display = clean;
    try {
        display = sqlFormatter.format(clean.replace(/\r\n/g, '\n').replace(/\t/g, '    '), { language: 'plsql', uppercase: true, indent: '    ' });
    } catch (e) { console.warn("SQL美化失敗，改用原始顯示"); }
    const codeEl = document.getElementById('sourceCode');
    codeEl.textContent = display;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('sourceContent').classList.remove('hidden');
    document.getElementById('copyBtn').classList.remove('hidden');
    if (window.hljs) hljs.highlightElement(codeEl);
}

/**
 * 格式化 SQL 編輯器內容
 */
window.formatSqlEditor = function() {
    if (!window.sqlEditor) return;
    const sql = window.sqlEditor.getValue();
    if (!sql.trim()) return;
    try {
        const formatted = sqlFormatter.format(sql, { language: 'plsql', uppercase: true, indent: '    ' });
        window.sqlEditor.setValue(formatted);
    } catch (e) { console.error('SQL 格式化失敗:', e); }
};

/**
 * 切換 SQL 編輯器最大化 (僅限於 exec-pane 內部)
 */
window.toggleSqlEditorMaximize = function() {
    const container = document.getElementById('sqlModuleContainer');
    const resultArea = document.getElementById('execResultArea');
    const btnMax = document.getElementById('btnMaximize');
    const btnShrink = document.getElementById('btnShrink');
    const execPane = document.getElementById('exec-pane');

    if (!container) return;

    // 切換最大化類別
    const isFull = container.classList.toggle('sql-module-fullscreen');

    if (isFull) {
        // 隱藏下方結果區域，讓編輯器填滿空間
        if (resultArea) resultArea.classList.add('hidden');
        if (btnMax) btnMax.classList.add('hidden');
        if (btnShrink) btnShrink.classList.remove('hidden');

        if (execPane) {
            execPane.style.height = 'calc(100vh - 200px)';
            execPane.style.display = 'flex';
            execPane.style.flexDirection = 'column';
        }
        if (window.sqlEditor) window.sqlEditor.setSize(null, '100%');
    } else {
        // 恢復顯示結果區域
        if (resultArea) resultArea.classList.remove('hidden');
        if (btnMax) btnMax.classList.remove('hidden');
        if (btnShrink) btnShrink.classList.add('hidden');

        if (execPane) {
            execPane.style.height = '';
            execPane.style.display = '';
            execPane.style.flexDirection = '';
        }
        if (window.sqlEditor) window.sqlEditor.setSize(null, '240px');
    }

    // 更新 CodeMirror 佈局與焦點
    if (window.sqlEditor) {
        setTimeout(() => {
            window.sqlEditor.refresh();
            window.sqlEditor.focus();
        }, 150);
    }
};

async function viewScript(name) {
    if (!prepareModal(`DDL 建立腳本: ${name}`)) return;

    // Update loading message
    const loadingText = document.querySelector('#loading p');
    if (loadingText) {
        loadingText.innerHTML = `<i class="bi bi-hourglass-split me-2"></i>正在生成 DDL 腳本，請稍候...`;
    }

    try {
        const res = await fetch(`/api/table_script/${encodeURIComponent(name)}`);
        const d = await res.json();
        if (res.ok) {
            formatAndDisplaySql(d.script, true);
        } else {
            document.getElementById('loading').style.display = 'none';
            alert("提取腳本失敗: " + (d.detail || '未知錯誤'));
        }
    } catch (e) {
        document.getElementById('loading').style.display = 'none';
        alert("伺服器通訊錯誤: " + e.message);
    }
}

async function viewSource(name, type) {
    if (!prepareModal(`${type} 源碼檢視: ${name}`)) return;

    // Update loading message
    const loadingText = document.querySelector('#loading p');
    if (loadingText) {
        loadingText.innerHTML = `<i class="bi bi-hourglass-split me-2"></i>正在讀取程式碼，請稍候...`;
    }

    try {
        const res = await fetch(`/api/source_code/${encodeURIComponent(name)}`);
        const d = await res.json();
        if (res.ok) {
            formatAndDisplaySql(d.source, true);
        } else {
            document.getElementById('loading').style.display = 'none';
            alert("讀取源碼失敗: " + (d.detail || '未知錯誤'));
        }
    } catch (e) {
        document.getElementById('loading').style.display = 'none';
        alert("讀取異常: " + e.message);
    }
}

async function viewFullSql(sqlId) {
    if (!prepareModal("SQL 語句歷史詳情")) return;

    // 顯示載入中狀態
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('sourceContent').classList.add('hidden');
    document.getElementById('tableContent').style.display = 'none';
    document.getElementById('copyBtn').classList.add('hidden');

    try {
        const response = await fetch(`/api/sql_text/${sqlId}`);
        const data = await response.json();

        if (response.ok && data.sql_text) {
            formatAndDisplaySql(data.sql_text, true);
        } else {
            console.error('Failed to fetch SQL:', data);
            const codeEl = document.getElementById('sourceCode');
            codeEl.textContent = `無法取得 SQL 內容: ${data.detail || '未知錯誤'}`;
            document.getElementById('loading').style.display = 'none';
            document.getElementById('sourceContent').classList.remove('hidden');
        }
    } catch (e) {
        console.error('Error fetching SQL:', e);
        const codeEl = document.getElementById('sourceCode');
        codeEl.textContent = `取得 SQL 發生錯誤: ${e.message}`;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('sourceContent').classList.remove('hidden');
    }
}

function copyToClipboard() {
    const text = document.getElementById('sourceCode').textContent;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);

    const btn = document.getElementById('copyBtn');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check2-all me-1"></i>已複製成功';
    btn.className = 'btn btn-sm btn-success fw-bold me-3 shadow-sm';
    setTimeout(() => {
        btn.innerHTML = oldHtml;
        btn.className = 'btn btn-sm btn-light fw-bold me-3 shadow-sm';
    }, 2000);
}

/* === 效能監控功能 (Performance Monitor) === */

/**
 * 顯示效能監控視窗 (頭10筆正在執行的 Jobs, Procedures, Functions, Packages, SQL)
 */
async function showMonitor() {
    console.log('📊 [showMonitor] 啟動效能監控...');

    // 準備 Modal
    const modal = document.getElementById('dataModal');
    const modalTitle = document.getElementById('modalTitle');
    const loading = document.getElementById('loading');
    const tableContent = document.getElementById('tableContent');
    const sourceContent = document.getElementById('sourceContent');
    const monitorContent = document.getElementById('monitorContent');
    const copyBtn = document.getElementById('copyBtn');

    if (!modal) {
        console.error('❌ 找不到 dataModal 元件');
        return;
    }

    // 初始化顯示狀態
    modalTitle.innerHTML = '<span class="flex items-center gap-2"><svg class="w-6 h-6 animate-pulse text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> 效能即時監控 (OraGlance 模式)</span>';
    loading.style.display = 'flex';
    tableContent.style.display = 'none';
    sourceContent.classList.add('hidden');
    // 顯示 Loading (全域)
    loading.style.display = 'flex';
    monitorContent.classList.remove('hidden');
    monitorContent.innerHTML = '';
    copyBtn.classList.add('hidden');

    // 顯示 Modal
    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    try {
        // 先載入指標數據 (側邊欄)
        const metricsRes = await fetch('/api/monitor/system_metrics');
        const metrics = await metricsRes.json();

        // 渲染主佈局框架 (先不放內容)
        monitorContent.innerHTML = `
            <div class="flex flex-col lg:flex-row gap-6 h-full relative p-6">
                <div class="w-full lg:w-72 flex-shrink-0 space-y-4">
                    ${renderMetricsSidebar(metrics.data || [])}
                </div>
                <div class="flex-1 flex flex-col min-h-0">
                    <div class="flex border-b border-slate-200 mb-4 overflow-x-auto no-scrollbar gap-2 p-1 bg-slate-100 rounded-xl" id="monitorTabList">
                        <button class="px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap bg-white shadow-sm text-blue-600" data-monitor-tab="sql">⚡ SQL</button>
                        <button class="px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap text-slate-500 hover:bg-white/50" data-monitor-tab="jobs">⏰ Jobs</button>
                        <button class="px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap text-slate-500 hover:bg-white/50" data-monitor-tab="procs">📦 Procedures</button>
                        <button class="px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap text-slate-500 hover:bg-white/50" data-monitor-tab="funcs">🧩 Functions</button>
                        <button class="px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap text-slate-500 hover:bg-white/50" data-monitor-tab="pkgs">📚 Packages</button>
                    </div>
                    <div id="monitorTabContent" class="flex-1 overflow-auto pr-2 bubble-scrollbar space-y-4 pb-10">
                        <div id="pane-sql" class="monitor-pane"></div>
                        <div id="pane-jobs" class="monitor-pane hidden"></div>
                        <div id="pane-procs" class="monitor-pane hidden"></div>
                        <div id="pane-funcs" class="monitor-pane hidden"></div>
                        <div id="pane-pkgs" class="monitor-pane hidden"></div>
                    </div>
                </div>
            </div>
        `;

        // 手動記錄已載入的 Tab
        const loadedTabs = new Set();

        const loadTab = async (cat) => {
            const pane = document.getElementById(`pane-${cat}`);
            if (loadedTabs.has(cat)) return;

            pane.innerHTML = `<div class="p-20 text-center text-slate-400 italic"><i class="fas fa-circle-notch fa-spin mr-2"></i>正在查詢最新數據，請稍候...</div>`;

            try {
                const res = await fetch(`/api/monitor/active_sessions?category=${cat}`);
                const result = await res.json();
                const data = result.data;

                if (cat === 'sql') {
                    pane.innerHTML = renderMonitorSection('⚡ 今日執行 SQL', data.sql, ['LAST_ACTIVE_TIME', 'OWNER', 'MODULE', 'ACTION', 'EXECUTIONS', 'AVG_ELAPSED_SEC', 'SQL_TEXT'], 'SQL');
                } else if (cat === 'jobs') {
                    pane.innerHTML = renderMonitorSection('⏰ 今日 Jobs 執行', data.jobs, ['LAST_ACTIVE_TIME', 'OWNER', 'MODULE', 'ACTION', 'EXECUTIONS', 'AVG_ELAPSED_SEC', 'SQL_TEXT'], 'SQL');
                } else if (cat === 'procs') {
                    pane.innerHTML = renderMonitorSection('📦 今日 Procedures', data.procs, ['LAST_ACTIVE_TIME', 'OWNER', 'OBJECT_NAME', 'MODULE', 'ACTION', 'EXECUTIONS', 'SECONDS_ACTIVE'], 'SQL');
                } else if (cat === 'funcs') {
                    pane.innerHTML = renderMonitorSection('🧩 今日 Functions', data.funcs, ['LAST_ACTIVE_TIME', 'OWNER', 'OBJECT_NAME', 'MODULE', 'ACTION', 'EXECUTIONS', 'SECONDS_ACTIVE'], 'SQL');
                } else if (cat === 'pkgs') {
                    pane.innerHTML = renderMonitorSection('📚 今日 Packages', data.pkgs, ['LAST_ACTIVE_TIME', 'OWNER', 'OBJECT_NAME', 'MODULE', 'ACTION', 'EXECUTIONS', 'SECONDS_ACTIVE'], 'SQL');
                }
                loadedTabs.add(cat);
            } catch (err) {
                pane.innerHTML = `<div class="p-10 text-red-500 font-bold">❌ 查詢失敗: ${err.message}</div>`;
            }
        };

        // 頁籤點擊事件
        document.querySelectorAll('#monitorTabList [data-monitor-tab]').forEach(btn => {
            btn.onclick = function() {
                const cat = this.getAttribute('data-monitor-tab');

                // 按鈕樣式
                document.querySelectorAll('#monitorTabList [data-monitor-tab]').forEach(b => {
                    b.className = "px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap text-slate-500 hover:bg-white/50";
                });
                this.className = "px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap bg-white shadow-sm text-blue-600";

                // 切換面板
                document.querySelectorAll('.monitor-pane').forEach(p => p.classList.add('hidden'));
                document.getElementById(`pane-${cat}`).classList.remove('hidden');

                // 載入內容
                loadTab(cat);
            };
        });

        // 預設載入第一個 SQL
        loadTab('sql');

        loading.style.display = 'none';
        document.body.style.overflow = 'hidden';
    } catch (e) {
        console.error('❌ [showMonitor] 異常:', e);
        monitorContent.innerHTML = `<div class="p-10 text-red-600 font-bold">❌ 發生系統錯誤: ${e.message}</div>`;
        loading.style.display = 'none';
    }
}

/**
 * 渲染左側指標欄
 */
function renderMetricsSidebar(metrics) {
    const metricLabels = {
        'Physical Read Total IO Requests Per Sec': 'Physical Read Request',
        'Physical Read Total Bytes Per Sec': 'Physical Read',
        'Physical Write Total IO Requests Per Sec': 'Physical Write Request',
        'Physical Write Total Bytes Per Sec': 'Physical Write',
        'Parse Failure Count Per Sec': 'Parse Failures',
        'Hard Parse Count Per Sec': 'Hard Parse',
        'Logical Read Bytes Per Sec': 'Logical Read',
        'Executions Per Sec': 'Executions',
        'Redo Generated Per Sec': 'Redo Generated',
        'User Commits Per Sec': 'Commit'
    };

    let html = `
        <div class="bg-slate-800 text-slate-100 rounded-2xl p-5 shadow-inner border border-slate-700 space-y-4">
            <div class="flex items-center gap-2 border-b border-slate-700 pb-3 mb-2">
                <span class="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></span>
                <h4 class="text-sm font-black uppercase tracking-widest text-slate-400">System Metrics</h4>
            </div>
            <div class="space-y-3">
    `;

    metrics.forEach(m => {
        let label = metricLabels[m.METRIC_NAME] || m.METRIC_NAME;
        let value = parseFloat(m.VALUE).toLocaleString(undefined, { maximumFractionDigits: 1 });
        let unit = m.UNIT.split(' ')[0] === 'Bytes' ? 'MB/s' : (m.UNIT.includes('Per Second') ? '/s' : m.UNIT);

        // 單位換算 (Bytes to MB)
        if (m.UNIT.includes('Bytes')) {
            value = (parseFloat(m.VALUE) / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 });
        }

        html += `
            <div class="flex items-center justify-between group">
                <span class="text-xs text-slate-400 font-medium group-hover:text-slate-200 transition-colors">${label}</span>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-mono font-bold text-cyan-400 bg-black/30 px-2 py-0.5 rounded border border-slate-700">${value}</span>
                    <span class="text-[10px] text-slate-500 w-8">${unit}</span>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div class="pt-4 mt-6 border-t border-slate-700">
                <button onclick="showMonitor()" class="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[10px] font-black uppercase tracking-tighter rounded-lg border border-blue-500/30 transition-all">
                    🔄 Refresh Data
                </button>
            </div>
        </div>
    `;

    return html;
}

/**
 * 渲染監控區塊 HTML
 */
function renderMonitorSection(title, items, columns, type = 'SESSION') {
    // 欄位繁體中文對照表
    const columnLabels = {
        'LAST_ACTIVE_TIME': '最後執行時間',
        'OWNER': '執行帳號',
        'OBJECT_NAME': '物件名稱',
        'MODULE': '呼叫來源(模組)',
        'ACTION': '動作',
        'SQL_ID': 'SQL ID',
        'SESSION_ID': 'SID',
        'JOB_NAME': 'Job 名稱',
        'ELAPSED_TIME': '耗時(s)',
        'SECONDS_ACTIVE': '總耗時(s)',
        'SQL_TEXT': '執行語法',
        'EXECUTIONS': '執行次數',
        'TOTAL_ELAPSED_SEC': '總耗時(s)',
        'TOTAL_CPU_SEC': 'CPU(s)',
        'AVG_ELAPSED_SEC': '平均(s)',
        'DISK_READS': '磁碟讀取',
        'BUFFER_GETS': '緩衝讀取'
    };

    let rowsHtml = '';
    if (items === 'PERMISSION_DENIED') {
        rowsHtml = `<tr><td colspan="${columns.length + 1}" class="px-6 py-16 text-center text-red-500 font-bold bg-red-50/50">⚠️ 目前登入帳號無權限檢視此項數據</td></tr>`;
    } else if (!items || items.length === 0) {
        rowsHtml = `<tr><td colspan="${columns.length + 1}" class="px-6 py-16 text-center text-slate-400 italic bg-white/50">目前沒有偵測到今日執行過的項目</td></tr>`;
    } else {
        items.forEach(item => {
            rowsHtml += '<tr class="hover:bg-blue-50/80 transition-all duration-200 border-b border-slate-100">';
            columns.forEach(col => {
                let val = item[col] === null || item[col] === undefined ? '' : item[col];
                let displayVal = val;

                // 點擊事件處理
                let clickAttr = '';
                if (col === 'SID' || col === 'SESSION_ID') {
                    clickAttr = `onclick="showSessionDetail(${val})" class="cursor-pointer text-blue-600 font-bold hover:underline"`;
                } else if (col === 'SQL_ID') {
                    clickAttr = `onclick="showSqlDetail('${val}')" class="cursor-pointer text-cyan-600 font-bold hover:underline"`;
                } else if (col === 'SQL_TEXT') {
                    if (displayVal.length > 50) displayVal = displayVal.substring(0, 50) + '...';
                    clickAttr = `onclick="showSqlDetail('${item.SQL_ID}')" class="cursor-pointer hover:text-blue-500"`;
                }

                // 數字格式化 (執行次數, 讀取次數等)
                if (typeof val === 'number' && !['SID', 'SESSION_ID'].includes(col)) {
                    if (val > 1000) displayVal = val.toLocaleString();
                    if (col.includes('SEC')) displayVal = val.toFixed(3);
                }

                // 秒數格式
                if (col === 'SECONDS_ACTIVE' || col === 'ELAPSED_TIME') {
                    if (val !== '') displayVal = `<span class="font-mono text-blue-600 font-bold">${val}</span> <span class="text-[10px] text-slate-400">秒</span>`;
                }

                rowsHtml += `<td class="px-3 py-3 text-[11px] text-slate-700 break-words" ${clickAttr} title="${val}">${displayVal}</td>`;
            });

            // 加入詳細按鈕
            let detailFunc = '';
            if (type === 'SQL') detailFunc = `showSqlDetail('${item.SQL_ID}')`;
            else if (type === 'SESSION') detailFunc = `showSessionDetail(${item.SID})`;
            else if (type === 'JOB') detailFunc = `showJobDetail('${item.JOB_NAME}')`;

            rowsHtml += `
                <td class="px-3 py-3 text-right">
                    <button onclick="${detailFunc}" class="px-2 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-500 rounded text-[10px] font-bold border border-slate-200 transition-all shadow-sm">
                        詳情
                    </button>
                </td>
            `;
            rowsHtml += '</tr>';
        });
    }

    return `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
            <div class="bg-slate-50/80 backdrop-blur px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <button onclick="showMonitor()" title="更新" class="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m0 0H15"/></svg>
                    </button>
                    <h3 class="font-bold text-slate-800 flex items-center gap-2 tracking-tight text-sm">
                        ${title}
                    </h3>
                </div>
                <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase">
                    Top 10筆
                </span>
            </div>
            <div class="overflow-auto max-h-[400px] flex-1">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-50 text-slate-500 sticky top-0 z-10">
                        <tr>
                            ${columns.map(col => `<th class="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 bg-slate-50/95">${columnLabels[col] || col}</th>`).join('')}
                            <th class="px-3 py-2.5 border-b border-slate-200 bg-slate-50/95"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * 顯示特定 Session 的詳細資訊
 */
async function showSessionDetail(sid) {
    if (!sid) return;
    showLoadingToast(`正在載取 Session ${sid} 詳細資訊...`);

    try {
        const res = await fetch(`/api/monitor/session_details/${sid}`);
        const result = await res.json();
        hideLoadingToast();

        if (!result.success) {
            alert(result.message);
            return;
        }

        const data = result.data;
        const b = data.base;

        let waitEventsHtml = data.events.map(ev => `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-2 text-xs font-medium text-slate-700">${ev.WAIT_CLASS}</td>
                <td class="px-4 py-2 text-xs text-slate-600">${ev.EVENT}</td>
                <td class="px-4 py-2 text-xs font-mono text-blue-600">${ev.TOTAL_WAITS}</td>
                <td class="px-4 py-2 text-xs font-mono text-red-600">${ev.TIME_WAITED}</td>
            </tr>
        `).join('') || `<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">無等待事件紀錄</td></tr>`;

        // 處理阻擋者資訊
        let blockerHtml = '';
        if (b.BLOCKING_SESSION) {
            blockerHtml = `
                <div class="flex flex-col items-center justify-center h-full py-4 space-y-2">
                    <span class="text-red-500 animate-bounce">
                        <svg class="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    </span>
                    <div class="text-sm font-black text-red-600">BLOCKED BY SID: ${b.BLOCKING_SESSION}</div>
                    <button onclick="showSessionDetail(${b.BLOCKING_SESSION})" class="text-xs text-blue-600 font-bold hover:underline">View Blocker Details »</button>
                </div>
            `;
        } else {
            blockerHtml = `
                <div class="flex flex-col items-center justify-center h-full py-4 opacity-40">
                    <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <div class="text-sm font-medium text-slate-500 mt-2">No blocker detected</div>
                </div>
            `;
        }

        const detailHtml = `
            <div class="flex flex-col min-h-full">
                <!-- 固定標頭 (Sticky Header) - 改為純白不透明防止重疊 -->
                <div class="sticky top-0 z-[60] bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shadow-sm">
                    <div class="flex items-center gap-4">
                        <button onclick="showMonitor()" class="p-2 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-full transition-all group border border-slate-200 shadow-sm">
                            <svg class="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                            </svg>
                        </button>
                        <div>
                            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Session詳情導航</div>
                            <h2 class="text-xl font-black text-slate-800 leading-none">SID: <span class="text-blue-600">${sid}</span></h2>
                        </div>
                    </div>
                </div>

                <div class="p-6 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- Session Base Info -->
                        <div class="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Identification</h4>
                            <div class="grid grid-cols-2 gap-y-2 text-sm">
                                <span class="text-slate-500">Username</span><span class="font-bold text-slate-800">${b.USERNAME || 'N/A'}</span>
                                <span class="text-slate-500">Status</span><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${b.STATUS==='ACTIVE'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-600'} w-max">${b.STATUS}</span>
                                <span class="text-slate-500">Serial#</span><span class="font-mono">${b['SERIAL#']}</span>
                                <span class="text-slate-500">Module</span><span class="text-blue-600 font-bold">${b.MODULE || 'None'}</span>
                                <span class="text-slate-500">Action</span><span class="text-slate-700">${b.ACTION || 'None'}</span>
                                <span class="text-slate-500">OS User</span><span class="text-slate-700">${b.OSUSER}</span>
                                <span class="text-slate-500">Machine</span><span class="text-slate-700">${b.MACHINE}</span>
                            </div>
                        </div>

                        <!-- Wait Info -->
                        <div class="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Current Wait</h4>
                            <div class="space-y-2">
                                <div class="text-xs text-slate-500">Wait Class / Event</div>
                                <div class="text-sm font-bold text-red-600">${b.WAIT_CLASS || 'N/A'}</div>
                                <div class="text-[11px] text-slate-600 italic">${b.EVENT || 'None'}</div>
                                <div class="flex items-end gap-2 mt-4">
                                    <span class="text-3xl font-black text-slate-800">${b.SECONDS_IN_WAIT}</span>
                                    <span class="text-xs text-slate-400 pb-1 uppercase font-bold tracking-widest">Seconds In Wait</span>
                                </div>
                            </div>
                        </div>

                        <!-- Blocker Info -->
                        <div class="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Blocking Status</h4>
                            ${blockerHtml}
                        </div>

                        <!-- Wait Events Table -->
                        <div class="md:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div class="bg-slate-50 px-5 py-3 border-b flex items-center justify-between">
                                <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest">Session Wait Events</h4>
                            </div>
                            <div class="max-h-[300px] overflow-auto">
                                <table class="w-full text-left">
                                    <thead class="bg-slate-50/50 sticky top-0 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                        <tr>
                                            <th class="px-4 py-2 border-b">Class</th>
                                            <th class="px-4 py-2 border-b">Event</th>
                                            <th class="px-4 py-2 border-b">Waits</th>
                                            <th class="px-4 py-2 border-b">Time Waited</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100">
                                        ${waitEventsHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('monitorContent').innerHTML = detailHtml;
    } catch (e) {
        alert("取得詳情失敗: " + e.message);
    }
}

/**
 * 顯示特定 SQL 的詳細資訊
 */
async function showSqlDetail(sqlId) {
    if (!sqlId) return;
    showLoadingToast(`正在載取 SQL ${sqlId} 詳細執行統計...`);

    try {
        const res = await fetch(`/api/monitor/sql_details/${sqlId}`);
        const result = await res.json();
        hideLoadingToast();

        if (!result.success) {
            alert(result.message);
            return;
        }

        const s = result.data;

        // 1. 使用 sql-formatter 格式化
        let formattedSql = s.SQL_FULLTEXT;
        try {
            if (window.sqlFormatter) {
                formattedSql = window.sqlFormatter.format(s.SQL_FULLTEXT, {
                    language: 'plsql',
                    uppercase: true,
                    indent: '    '
                });
            }
        } catch (e) { console.warn('SQL format failed:', e); }

        const detailHtml = `
            <div class="flex flex-col min-h-full">
                <!-- 固定標頭 (Sticky Header) - 改為純白不透明防止重疊 -->
                <div class="sticky top-0 z-[60] bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shadow-sm">
                    <div class="flex items-center gap-4">
                        <button onclick="showMonitor()" class="p-2 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-full transition-all group border border-slate-200 shadow-sm">
                            <svg class="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                            </svg>
                        </button>
                        <div>
                            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">SQL詳情導航</div>
                            <h2 class="text-xl font-black text-slate-800 leading-none">SQL ID: <span class="text-cyan-600 font-mono">${sqlId}</span></h2>
                        </div>
                    </div>
                </div>

                <div class="p-6 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <!-- Basic Stats -->
                        <div class="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div class="flex flex-col">
                                <span class="text-[10px] uppercase font-black text-slate-400 tracking-widest">Executions</span>
                                <span class="text-3xl font-black text-blue-600 font-mono">${s.EXECUTIONS ? s.EXECUTIONS.toLocaleString() : 0}</span>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[10px] uppercase font-black text-slate-400 tracking-widest">Elapsed Time</span>
                                <span class="text-2xl font-black text-slate-800 font-mono">${s.ELAPSED_SEC ? s.ELAPSED_SEC.toFixed(4) : 0} <span class="text-sm">sec</span></span>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[10px] uppercase font-black text-slate-400 tracking-widest">CPU Time</span>
                                <span class="text-2xl font-black text-slate-800 font-mono">${s.CPU_SEC ? s.CPU_SEC.toFixed(4) : 0} <span class="text-sm">sec</span></span>
                            </div>
                        </div>

                        <!-- IO Stats -->
                        <div class="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div class="flex flex-col">
                                <span class="text-[10px] uppercase font-black text-slate-400 tracking-widest">Disk Reads</span>
                                <span class="text-2xl font-black text-orange-600 font-mono">${s.DISK_READS ? s.DISK_READS.toLocaleString() : 0}</span>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[10px] uppercase font-black text-slate-400 tracking-widest">Buffer Gets</span>
                                <span class="text-2xl font-black text-slate-800 font-mono">${s.BUFFER_GETS ? s.BUFFER_GETS.toLocaleString() : 0}</span>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[10px] uppercase font-black text-slate-400 tracking-widest">Direct Writes</span>
                                <span class="text-2xl font-black text-slate-800 font-mono">${s.DIRECT_WRITES ? s.DIRECT_WRITES.toLocaleString() : 0}</span>
                            </div>
                        </div>

                        <!-- SQL Fulltext (使用 highlight.js 渲染) -->
                        <div class="md:col-span-2 bg-[#1e1e1e] rounded-2xl p-6 shadow-2xl relative overflow-hidden group border border-slate-800">
                            <div class="absolute top-0 right-0 p-4 z-10">
                                <button id="copySqlBtn" class="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10 group-hover:scale-105">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                                </button>
                            </div>
                            <h4 class="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-4">SQL Full Text</h4>
                            <div class="max-h-[350px] overflow-auto custom-scrollbar">
                                <pre class="bg-transparent m-0 p-0 overflow-visible"><code id="fullSqlText" class="language-sql text-[11px] font-mono leading-relaxed"></code></pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('monitorContent').innerHTML = detailHtml;

        // 2. 填充內容並調用 highlight.js (由 content.html 載入的 vs2015 主題)
        const codeEl = document.getElementById('fullSqlText');
        if (codeEl) {
            codeEl.textContent = formattedSql;
            if (window.hljs) hljs.highlightElement(codeEl);
        }

        // 註冊複製按鈕點擊事件 (避免 template literal 轉義問題)
        const copyBtn = document.getElementById('copySqlBtn');
        if (copyBtn) {
            copyBtn.onclick = () => copyToClipboardText(document.getElementById('fullSqlText').textContent);
        }
    } catch (e) {
        alert("取得詳情失敗: " + e.message);
    }
}

/**
 * 輔助函數：顯示 Job 詳情 (導向現有的 Scheduler 模組)
 */
function showJobDetail(jobName) {
    if (!jobName) return;
    // 這裡我們可以利用現有的 jobActions.viewDetail 但那是針對列表的
    // 先關閉 monitor modal 再啟動對應的 Job 詳情（或者直接在 monitor 裡顯示）
    // 為了視覺一致性，我們直接抓取相關資訊
    alert("查看 Job 詳情: " + jobName + "\n(排程管理模組已提供完整歷史紀錄)");
}

/**
 * 輔助函數：複製文字
 */
function copyToClipboardText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('success', '已複製到剪貼簿');
}



// 註冊「效能監控」選單點擊事件
document.addEventListener('DOMContentLoaded', () => {
    const navMonitorLink = document.getElementById('navMonitor');
    if (navMonitorLink) {
        navMonitorLink.addEventListener('click', (e) => {
            console.log('💡 [navMonitor] 點擊觸發');
            e.preventDefault();
            showMonitor();
        });
    }
});
/**
 * 🔍 執行程式碼搜尋 (ALL_SOURCE)
 */
async function doSourceSearch() {
    const input = document.getElementById('sourceSearchInput');
    const keyword = input.value.trim();
    if (!keyword) {
        showToast('warning', '請輸入搜尋關鍵字');
        return;
    }

    const resultArea = document.getElementById('sourceSearchResults');
    const tbody = document.querySelector('#sourceSearchTable tbody');

    resultArea.classList.remove('hidden');
    tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400 italic"><i class="fas fa-circle-notch fa-spin mr-2"></i>正在從 ALL_SOURCE 檢索資料...</td></tr>`;

    try {
        const res = await fetch(`/api/search_source?keyword=${encodeURIComponent(keyword)}&owner=${encodeURIComponent(currentOwner || '')}`);
        const result = await res.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        const data = result.data;
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400 italic">查無符合關鍵字的程式碼</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(row => `
            <tr class="hover:bg-blue-50 cursor-pointer transition-colors group" onclick="showObjectDetail('${row['擁有者']}', '${row['物件名稱']}')">
                <td class="px-4 py-3 font-medium text-slate-600">${row['擁有者']}</td>
                <td class="px-4 py-3 font-bold text-slate-900 group-hover:text-blue-600 underline decoration-dotted decoration-blue-300 underline-offset-4">${row['物件名稱']}</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase">${row['物件類型']}</span></td>
                <td class="px-4 py-3 font-mono text-slate-400">${row['行數']}</td>
                <td class="px-4 py-3 text-slate-700 font-mono text-xs truncate max-w-md">${escapeHtml(row['程式碼內容'])}</td>
            </tr>
        `).join('');

        showToast('success', `搜尋完畢，共找到 ${data.length} 筆紀錄`);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-red-500 font-bold">❌ 搜尋失敗: ${e.message}</td></tr>`;
        showToast('error', '搜尋出錯: ' + e.message);
    }
}

/**
 * 💎 顯示物件詳細資訊畫窗 (相容 dbobj.html)
 */
async function showObjectDetail(owner, name) {
    if (!prepareModal(`物件詳情: ${owner}.${name}`)) return;

    // 顯示載入中
    const loadingText = document.querySelector('#loading p');
    if (loadingText) {
        loadingText.innerHTML = `<i class="bi bi-hourglass-split me-2"></i>正在提取 DDL 腳本，請稍候...`;
    }

    try {
        const res = await fetch(`/api/object_info/${owner}/${name}`);
        const result = await res.json();

        if (!res.ok || !result.success) {
            document.getElementById('loading').style.display = 'none';
            throw new Error(result.message || '呼叫 API 失敗');
        }

        let ddl = result.data.ddl;

        // 若 API 沒有回傳正確的 DDL 文字，提供預設提示
        if (!ddl || ddl.trim() === '') {
            ddl = '-- 此物件無 DDL 或獲取失敗';
        }

        // 以全螢幕代碼塊的方式展示 (與 viewScript 同樣的邏輯)
        formatAndDisplaySql(ddl, true);

    } catch (e) {
        document.getElementById('loading').style.display = 'none';
        alert("取得物件詳情失敗: " + e.message);
    }
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

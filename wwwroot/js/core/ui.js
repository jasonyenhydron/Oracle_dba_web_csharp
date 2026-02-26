/**
 * core/ui.js — 共用 UI 元件層
 * 提供 Modal、Dialog、Toast 等共用 UI 元件
 * (從 content.js 及 schedule_job.js 抽出共用部分)
 */

// =====================================================
// Generic Modal (Vanilla JS)
// =====================================================

function createGenericModal(modalId, contentHtml) {
    document.getElementById(modalId)?.remove();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
    modal.innerHTML = contentHtml;
    document.body.appendChild(modal);
    return modal;
}

function closeGenericModal(modalId, cleanup = true) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            if (cleanup) modal.remove();
            else modal.classList.remove('opacity-0', 'pointer-events-none');
        }, 200);
    }
}

// =====================================================
// Input Dialog
// =====================================================

function showInputDialog(options) {
    const {
        title = '輸入',
        message = '',
        placeholder = '',
        defaultValue = '',
        onConfirm = null,
        onCancel = null
    } = options;

    const modalId = 'inputDialog_' + Date.now();
    const contentHtml = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all">
            <h3 class="text-lg font-bold text-slate-800 mb-3">${title}</h3>
            <p class="text-slate-600 mb-4 text-sm">${message}</p>
            <input id="${modalId}_input" type="text"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                   placeholder="${placeholder}" value="${defaultValue}">
            <div class="flex justify-end gap-3 mt-5">
                <button id="${modalId}_cancel"
                        class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                    取消
                </button>
                <button id="${modalId}_confirm"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    確定
                </button>
            </div>
        </div>
    `;

    const modal = createGenericModal(modalId, contentHtml);

    function handleConfirm() {
        const value = document.getElementById(`${modalId}_input`).value;
        closeGenericModal(modalId);
        if (onConfirm) onConfirm(value);
    }

    document.getElementById(`${modalId}_confirm`).addEventListener('click', handleConfirm);
    document.getElementById(`${modalId}_cancel`).addEventListener('click', () => {
        closeGenericModal(modalId);
        if (onCancel) onCancel();
    });
    document.getElementById(`${modalId}_input`).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') closeGenericModal(modalId);
    });

    // Focus input
    setTimeout(() => document.getElementById(`${modalId}_input`)?.focus(), 50);
}

// =====================================================
// Confirm Dialog
// =====================================================

function showConfirmDialog(options) {
    const {
        title = '確認',
        message = '',
        confirmText = '確定',
        cancelText = '取消',
        confirmClass = 'bg-blue-600 hover:bg-blue-700',
        onConfirm = null,
        onCancel = null
    } = options;

    const modalId = 'confirmDialog_' + Date.now();
    const contentHtml = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all">
            <h3 class="text-lg font-bold text-slate-800 mb-3">${title}</h3>
            <p class="text-slate-600 mb-5 text-sm whitespace-pre-line">${message}</p>
            <div class="flex justify-end gap-3">
                <button id="${modalId}_cancel"
                        class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                    ${cancelText}
                </button>
                <button id="${modalId}_confirm"
                        class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${confirmClass}">
                    ${confirmText}
                </button>
            </div>
        </div>
    `;

    const modal = createGenericModal(modalId, contentHtml);

    document.getElementById(`${modalId}_confirm`).addEventListener('click', () => {
        closeGenericModal(modalId);
        if (onConfirm) onConfirm();
    });
    document.getElementById(`${modalId}_cancel`).addEventListener('click', () => {
        closeGenericModal(modalId);
        if (onCancel) onCancel();
    });
}

// =====================================================
// Toast Notification
// =====================================================

/**
 * 顯示 Toast 通知
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {string} message
 * @param {number} [duration=3000]
 */
function showToast(type, message, duration = 3000) {
    const colorMap = {
        success: 'bg-green-600',
        error:   'bg-red-600',
        warning: 'bg-yellow-500',
        info:    'bg-blue-600'
    };
    const iconMap = {
        success: '✅',
        error:   '❌',
        warning: '⚠️',
        info:    'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 ${colorMap[type] || 'bg-gray-800'} text-white px-4 py-3 rounded-lg shadow-lg z-[9999] flex items-center gap-2 transition-all duration-300 opacity-0 translate-y-2`;
    toast.innerHTML = `
        <span>${iconMap[type] || '●'}</span>
        <span class="text-sm font-medium">${message}</span>
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    });

    // Animate out and remove
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// =====================================================
// Loading Toast (for inline use during data loading)
// =====================================================

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
        setTimeout(() => { if (toast?.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }
}

// =====================================================
// Exports (global)
// =====================================================

window.createGenericModal = createGenericModal;
window.closeGenericModal  = closeGenericModal;
window.showInputDialog    = showInputDialog;
window.showConfirmDialog  = showConfirmDialog;
window.showToast          = showToast;
window.showLoadingToast   = showLoadingToast;
window.hideLoadingToast   = hideLoadingToast;

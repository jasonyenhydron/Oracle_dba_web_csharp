// Schedule Job 管理功能 (Tailwind Version)
console.log('🚀 schedule_job.js 已載入 (Tailwind) - ' + new Date().toLocaleTimeString());

let allJobs = [];
let selectedJobs = new Set();
let jobsDataTable = null;

// Modal Helpers
function openJobModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');          // 全螢幕 modal 需要 flex 佈局
        document.body.classList.add('overflow-hidden'); // 防止背景捲動
    }
}

function closeJobModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');       // 關閉時移除 flex
        document.body.classList.remove('overflow-hidden');
    }
}

// Close modals on Escape key
/**
 * 複製 Job Action 內容
 */
function copyJobActionToClipboard() {
    const pre = document.getElementById('jobActionPre');
    if (!pre) return;

    const text = pre.textContent;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('success', '執行內容已複製到剪貼簿');
    } catch (err) {
        console.error('複製失敗:', err);
    }
    document.body.removeChild(textArea);
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        ['jobDetailModal', 'jobFormModal', 'jobConfirmModal'].forEach(id => closeJobModal(id));
    }
});

/**
 * 初始化 Schedule Job 功能
 */
function initScheduleJobs() {
    console.log('🔄 初始化 Schedule Job 功能...');

    const jobTabBtn = document.querySelector('[data-tab="job-pane"]');
    if (jobTabBtn) {
        // 如果當前已經是 active 狀態 (例如重整後停留在該頁籤)，直接載入
        // 這裡檢查是否有特定的 active class (例如 bg-blue-50 或者 aria-selected="true")
        if (jobTabBtn.getAttribute('aria-selected') === 'true' || jobTabBtn.classList.contains('active')) {
             console.log('✅ Schedule Job 頁籤已激活，立即載入列表');
             loadJobList();
        }

        jobTabBtn.addEventListener('click', function() {
            // 使用 setTimeout 確保 UI 切換完成後再執行載入 (雖然不是必須，但有助於避免渲染卡頓)
            setTimeout(() => {
                console.log('👆 點擊 Schedule Job 頁籤');
                loadJobList();
            }, 50);
        });
    } else {
        console.warn('⚠️ 找不到 Schedule Job 頁籤按鈕 ([data-tab="job-pane"])');
    }
}

/**
 * 載入 Job 列表
 */
async function loadJobList() {
    const tbody = document.getElementById('jobsTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="px-4 py-8 text-center text-slate-500">
                <div class="inline-block w-5 h-5 border-2 border-blue-600 border-r-transparent rounded-full animate-spin mr-2 align-middle"></div>
                載入 Jobs 中...
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/scheduler_jobs');
        const data = await response.json();

        if (response.ok && data.success) {
            allJobs = data.jobs || [];
            renderJobList(allJobs);
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="px-4 py-8 text-center text-red-500">
                        <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        載入失敗: ${data.message || '未知錯誤'}
                    </td>
                </tr>
            `;
        }
    } catch (e) {
        console.error('載入 Jobs 失敗:', e);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-4 py-8 text-center text-red-500">
                    <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    載入異常: ${e.message}
                </td>
            </tr>
        `;
    }
}

/**
 * 渲染 Job 列表
 */
function renderJobList(jobs) {
    const tbody = document.getElementById('jobsTableBody');

    // 銷毀現有的 DataTable (如果有的話，這裡假設 DataTable 用於排序/分頁)
    if (jobsDataTable) {
        jobsDataTable.destroy();
        jobsDataTable = null;
    }

    if (!jobs || jobs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-4 py-12 text-center text-slate-500">
                    <svg class="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                    目前沒有 Schedule Jobs
                </td>
            </tr>
        `;
        return;
    }

    // 渲染表格內容
    tbody.innerHTML = jobs.map(job => {
        const isSelected = selectedJobs.has(job.job_name);
        const stateBadge = getStateBadge(job.state);

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-center border-b border-gray-100">
                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 job-checkbox"
                           value="${job.job_name}"
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleJobSelection('${job.job_name}')">
                </td>
                <td class="px-4 py-3 border-b border-gray-100">
                    <div class="flex items-center gap-1">
                        <button class="p-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
                                onclick="viewJobDetail('${job.owner}', '${job.job_name}')"
                                title="檢視詳情">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        ${job.state === 'DISABLED' ?
                            `<button class="p-2 text-green-600 border border-green-600 rounded hover:bg-green-50 transition-colors"
                                     onclick="enableJob('${job.owner}', '${job.job_name}')"
                                     title="啟用">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                             </button>` :
                            `<button class="p-2 text-yellow-600 border border-yellow-600 rounded hover:bg-yellow-50 transition-colors"
                                     onclick="disableJob('${job.owner}', '${job.job_name}')"
                                     title="停用">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                             </button>`
                        }
                        <button class="p-2 text-purple-600 border border-purple-600 rounded hover:bg-purple-50 transition-colors"
                                onclick="runJobNow('${job.owner}', '${job.job_name}')"
                                title="立即執行">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        </button>
                        <button class="p-2 text-red-600 border border-red-600 rounded hover:bg-red-50 transition-colors"
                                onclick="deleteJob('${job.owner}', '${job.job_name}')"
                                title="刪除">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </td>
                <td class="px-4 py-3 border-b border-gray-100">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        ${job.owner}
                    </span>
                </td>
                <td class="px-4 py-3 border-b border-gray-100">
                    <span class="font-medium text-slate-900">${job.job_name}</span>
                    ${job.comments ? `<br><small class="text-slate-500 truncate max-w-xs block" title="${job.comments}">${job.comments}</small>` : ''}
                </td>
                <td class="px-4 py-3 border-b border-gray-100">${stateBadge}</td>
                <td class="px-4 py-3 border-b border-gray-100"><span class="text-xs font-mono text-slate-600">${job.schedule_type || '-'}</span></td>
                <td class="px-4 py-3 border-b border-gray-100"><span class="text-xs text-slate-600">${formatDateTime(job.last_start_date)}</span></td>
                <td class="px-4 py-3 border-b border-gray-100"><span class="text-xs text-slate-600">${formatDateTime(job.next_run_date)}</span></td>
                <td class="px-4 py-3 text-center border-b border-gray-100 font-medium text-slate-700">${job.run_count || 0}</td>
            </tr>
        `;
    }).join('');

    // DataTable 初始化邏輯已移除，改用純 HTML 表格顯示
}

/**
 * 取得狀態徽章
 */
function getStateBadge(state) {
    const stateConfig = {
        'SCHEDULED': { class: 'bg-green-100 text-green-800', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: '已排程' },
        'ENABLED': { class: 'bg-green-100 text-green-800', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: '啟用中' },
        'DISABLED': { class: 'bg-gray-100 text-gray-800', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', text: '已停用' },
        'RUNNING': { class: 'bg-blue-100 text-blue-800', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', text: '執行中' },
        'COMPLETED': { class: 'bg-cyan-100 text-cyan-800', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: '已完成' },
        'FAILED': { class: 'bg-red-100 text-red-800', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', text: '失敗' },
        'BROKEN': { class: 'bg-yellow-100 text-yellow-800', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: '已中斷' },
        'RETRY SCHEDULED': { class: 'bg-yellow-100 text-yellow-800', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', text: '重試中' },
        'SUCCEEDED': { class: 'bg-green-100 text-green-800', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: '成功' }
    };

    const config = stateConfig[state] || {
        class: 'bg-gray-100 text-gray-800',
        icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        text: state || '未知'
    };

    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${config.class}" style="white-space: nowrap;">
        <svg class="w-3.5 h-3.5 me-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14" style="width: 14px !important; height: 14px !important;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${config.icon}"></path></svg>
        ${config.text}
    </span>`;
}

/**
 * 格式化日期時間
 */
function formatDateTime(dateStr) {
    if (!dateStr || dateStr === 'NULL') return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateStr;
    }
}

/**
 * 切換 Job 選取狀態
 */
function toggleJobSelection(jobName) {
    if (selectedJobs.has(jobName)) {
        selectedJobs.delete(jobName);
    } else {
        selectedJobs.add(jobName);
    }
    updateBatchButtons();
}

/**
 * 全選/取消全選
 */
function toggleSelectAll() {
    const checkbox = document.getElementById('selectAllJobs');
    const checkboxes = document.querySelectorAll('.job-checkbox');

    selectedJobs.clear();

    if (checkbox.checked) {
        checkboxes.forEach(cb => {
            cb.checked = true;
            selectedJobs.add(cb.value);
        });
    } else {
        checkboxes.forEach(cb => cb.checked = false);
    }
    updateBatchButtons();
}

/**
 * 更新批次操作按鈕狀態
 */
function updateBatchButtons() {
    const hasSelection = selectedJobs.size > 0;
    document.getElementById('batchDisableBtn').disabled = !hasSelection;
    document.getElementById('batchEnableBtn').disabled = !hasSelection;
    document.getElementById('batchDeleteBtn').disabled = !hasSelection;
}

/**
 * 重新整理 Job 列表
 */
function refreshJobList() {
    selectedJobs.clear();
    loadJobList();
}

/**
 * 檢視 Job 詳情
 */
async function viewJobDetail(owner, jobName) {
    openJobModal('jobDetailModal');
    const content = document.getElementById('jobDetailContent');
    if (!content) {
        console.error('Job Detail Content element not found!');
        return;
    }

    content.innerHTML = `
        <div class="text-center py-12">
            <div class="inline-block w-8 h-8 border-4 border-blue-600 border-r-transparent rounded-full animate-spin"></div>
            <p class="mt-4 text-slate-500">載入中...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/scheduler_job/${encodeURIComponent(owner)}/${encodeURIComponent(jobName)}`);
        const data = await response.json();

        if (response.ok && data.success) {
            const job = data.job;
            content.innerHTML = `
                <div class="space-y-6 text-left">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div class="col-span-1">
                            <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Job 名稱 (Job Name)</label>
                            <p class="font-mono text-base text-slate-800 break-all font-bold">${job.job_name}</p>
                        </div>
                        <div class="col-span-1">
                            <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">擁有者 (Owner)</label>
                            <div class="flex items-center">
                                <span class="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100 italic">
                                    <svg class="w-3.5 h-3.5 me-1.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg>
                                    ${job.owner}
                                </span>
                            </div>
                        </div>
                        <div class="col-span-1">
                            <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">目前狀態 (Status)</label>
                            <div class="mt-1 flex items-center">${getStateBadge(job.state)}</div>
                        </div>
                         <div class="col-span-1">
                            <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">類型 (Job Type)</label>
                            <p class="mt-1 text-sm text-slate-700 font-medium">${job.job_type || '-'}</p>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                            執行程式內容 (PL/SQL or Program)
                        </label>
                        <div class="relative group">
                            <pre id="jobActionPre" class="bg-black text-white p-5 rounded-xl text-sm overflow-auto font-mono border border-slate-800 max-h-[400px] shadow-2xl leading-relaxed custom-scrollbar">${job.job_action || '/* No Action Defined */'}</pre>
                            <button class="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-bold" onclick="copyJobActionToClipboard()">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                                複製
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">排程設定 (Schedule/Interval)</label>
                                <p class="font-mono text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">${job.schedule_name || job.repeat_interval || '-'}</p>
                            </div>
                            <div class="flex gap-4">
                                <div class="flex-1">
                                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">上次執行</label>
                                    <p class="text-xs text-slate-600 font-medium">${formatDateTime(job.last_start_date)}</p>
                                </div>
                                <div class="flex-1">
                                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">下次執行</label>
                                    <p class="text-xs text-blue-600 font-bold">${formatDateTime(job.next_run_date)}</p>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                            <div>
                                <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">累積執行</label>
                                <p class="text-2xl font-bold text-slate-800">${job.run_count || 0}</p>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 text-red-400">累積失敗</label>
                                <p class="text-2xl font-bold text-red-600">${job.failure_count || 0}</p>
                            </div>
                        </div>
                    </div>

                    ${job.comments ? `
                    <div class="pt-4 border-t border-slate-100">
                         <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">備註 (Comments)</label>
                         <div class="text-sm text-slate-600 leading-relaxed bg-amber-50/50 p-3 rounded-lg flex items-start gap-2">
                             <svg class="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg>
                             ${job.comments}
                         </div>
                    </div>
                    ` : ''}
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="bg-red-50 border-l-4 border-red-500 p-4">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        </div>
                        <div class="ml-3">
                             <p class="text-sm text-red-700">載入失敗: ${data.message || '未知錯誤'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        content.innerHTML = `
             <div class="bg-red-50 border-l-4 border-red-500 p-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    </div>
                    <div class="ml-3">
                         <p class="text-sm text-red-700">載入異常: ${e.message}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * 啟用 Job
 */
async function enableJob(owner, jobName) {
    try {
        const response = await fetch(`/api/scheduler_job/${owner}/${jobName}/enable`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showToast('success', `Job ${jobName} 已啟用`);
            refreshJobList();
        } else {
            showToast('error', `啟用失敗: ${data.message}`);
        }
    } catch (e) {
        showToast('error', `啟用 Job 時發生錯誤: ${e.message}`);
    }
}

/**
 * 停用 Job
 */
async function disableJob(owner, jobName) {
    try {
        const response = await fetch(`/api/scheduler_job/${owner}/${jobName}/disable`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showToast('success', `Job ${jobName} 已停用`);
            refreshJobList();
        } else {
            showToast('error', `停用失敗: ${data.message}`);
        }
    } catch (e) {
        showToast('error', `停用 Job 時發生錯誤: ${e.message}`);
    }
}

/**
 * 立即執行 Job
 */
async function runJobNow(owner, jobName) {
    showJobConfirm({
        title: '確認執行 Job',
        message: `確定要立即執行 ${jobName} 嗎？`,
        confirmText: '立即執行',
        confirmClass: 'bg-indigo-600 hover:bg-indigo-700',
        onConfirm: async function() {
            try {
                const response = await fetch(`/api/scheduler_job/${owner}/${jobName}/run`, { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    showToast('success', `Job ${jobName} 已提交執行`);
                    setTimeout(refreshJobList, 1000);
                } else {
                    showToast('error', `執行失敗: ${data.message}`);
                }
            } catch (e) {
                showToast('error', `執行 Job 時發生錯誤: ${e.message}`);
            }
        }
    });
}

/**
 * 刪除 Job
 */
async function deleteJob(owner, jobName) {
    showJobConfirm({
        title: '確認刪除 Job',
        message: `確定要刪除 ${jobName} 嗎？\n此操作無法復原！`,
        confirmText: '確定刪除',
        confirmClass: 'bg-red-600 hover:bg-red-700',
        onConfirm: async function() {
            try {
                const response = await fetch(`/api/scheduler_job/${owner}/${jobName}`, { method: 'DELETE' });
                const data = await response.json();
                if (data.success) {
                    showToast('success', `Job ${jobName} 已刪除`);
                    refreshJobList();
                } else {
                    showToast('error', `刪除失敗: ${data.message}`);
                }
            } catch (e) {
                showToast('error', `刪除 Job 時發生錯誤: ${e.message}`);
            }
        }
    });
}

/**
 * 建立新 Job
 */
function createNewJob() {
    document.getElementById('jobFormTitle').innerHTML = '<svg class="w-5 h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>建立新 Job';
    document.getElementById('jobForm').reset();
    openJobModal('jobFormModal');
    // 重置可見欄位
    toggleJobTypeFields();
    toggleScheduleFields();
}

/**
 * 切換 Job 類型欄位
 */
function toggleJobTypeFields() {
    const jobType = document.getElementById('jobType').value;
    const plsqlField = document.getElementById('plsqlBlockField');
    const procedureField = document.getElementById('procedureField');

    if (jobType === 'PLSQL_BLOCK') {
        plsqlField.classList.remove('hidden');
        procedureField.classList.add('hidden');
    } else {
        plsqlField.classList.add('hidden');
        procedureField.classList.remove('hidden');
    }
}

/**
 * 切換排程類型欄位
 */
function toggleScheduleFields() {
    const scheduleType = document.getElementById('scheduleType').value;
    const intervalField = document.getElementById('intervalField');
    const cronField = document.getElementById('cronField');

    intervalField.classList.add('hidden');
    cronField.classList.add('hidden');

    if (scheduleType === 'INTERVAL') {
        intervalField.classList.remove('hidden');
    } else if (scheduleType === 'CRON') {
        cronField.classList.remove('hidden');
    }
}

/**
 * 提交 Job
 */
async function submitJob() {
    const jobName = document.getElementById('jobName').value.trim();
    const jobType = document.getElementById('jobType').value;
    const scheduleType = document.getElementById('scheduleType').value;

    if (!jobName) {
        showToast('error', 'Job 名稱不能為空');
        return;
    }

    const jobData = {
        job_name: jobName,
        job_type: jobType,
        schedule_type: scheduleType,
        auto_enable: document.getElementById('autoEnable').checked,
        comments: document.getElementById('jobComments').value.trim()
    };

    if (jobType === 'PLSQL_BLOCK') {
        jobData.job_action = document.getElementById('jobAction').value.trim();
    } else {
        jobData.procedure_name = document.getElementById('procedureName').value.trim();
    }

    if (scheduleType === 'INTERVAL') {
        jobData.repeat_interval = document.getElementById('repeatInterval').value.trim();
    } else if (scheduleType === 'CRON') {
        jobData.cron_expression = document.getElementById('cronExpression').value.trim();
    }

    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    if (startDate) jobData.start_date = startDate;
    if (endDate) jobData.end_date = endDate;

    try {
        const response = await fetch('/api/scheduler_job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });
        const data = await response.json();

        if (data.success) {
            showToast('success', `Job ${jobName} 建立成功`);
            closeJobModal('jobFormModal');
            refreshJobList();
        } else {
            showToast('error', `建立失敗: ${data.message}`);
        }
    } catch (e) {
        showToast('error', `建立 Job 時發生錯誤: ${e.message}`);
    }
}

/**
 * 批次停用 Jobs
 */
async function batchDisableJobs() {
    if (selectedJobs.size === 0) return;
    showJobConfirm({
        title: '確認批次停用',
        message: `確定要停用 ${selectedJobs.size} 個 Jobs 嗎？`,
        confirmText: '確定停用',
        confirmClass: 'bg-yellow-600 hover:bg-yellow-700',
        onConfirm: async function() {
            const jobsToDisable = allJobs.filter(j => selectedJobs.has(j.job_name))
                                       .map(j => ({ owner: j.owner, job_name: j.job_name }));
            try {
                const response = await fetch('/api/scheduler_jobs/batch_disable', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jobs: jobsToDisable })
                });
                const data = await response.json();
                if (data.success) {
                    showToast('success', data.message);
                    refreshJobList();
                } else {
                    showToast('error', `部分失敗: ${data.message}\n${(data.errors || []).join('\n')}`);
                }
            } catch (e) {
                showToast('error', `批次停用時發生錯誤: ${e.message}`);
            }
        }
    });
}

/**
 * 批次啟用 Jobs
 */
async function batchEnableJobs() {
    if (selectedJobs.size === 0) return;
    showJobConfirm({
        title: '確認批次啟用',
        message: `確定要啟用 ${selectedJobs.size} 個 Jobs 嗎？`,
        confirmText: '確定啟用',
        confirmClass: 'bg-green-600 hover:bg-green-700',
        onConfirm: async function() {
            const jobsToEnable = allJobs.filter(j => selectedJobs.has(j.job_name))
                                      .map(j => ({ owner: j.owner, job_name: j.job_name }));
            try {
                const response = await fetch('/api/scheduler_jobs/batch_enable', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jobs: jobsToEnable })
                });
                const data = await response.json();
                if (data.success) {
                    showToast('success', data.message);
                    refreshJobList();
                } else {
                    showToast('error', `部分失敗: ${data.message}\n${(data.errors || []).join('\n')}`);
                }
            } catch (e) {
                showToast('error', `批次啟用時發生錯誤: ${e.message}`);
            }
        }
    });
}

/**
 * 批次刪除 Jobs
 */
async function batchDeleteJobs() {
    if (selectedJobs.size === 0) return;
    showJobConfirm({
        title: '確認批次刪除',
        message: `確定要刪除 ${selectedJobs.size} 個 Jobs 嗎？\n此操作無法復原！`,
        confirmText: '確定刪除',
        confirmClass: 'bg-red-600 hover:bg-red-700',
        onConfirm: async function() {
            const jobsToDelete = allJobs.filter(j => selectedJobs.has(j.job_name))
                                       .map(j => ({ owner: j.owner, job_name: j.job_name }));
            try {
                const response = await fetch('/api/scheduler_jobs/batch_delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jobs: jobsToDelete })
                });
                const data = await response.json();
                if (data.success) {
                    showToast('success', data.message);
                    refreshJobList();
                } else {
                    showToast('error', `部分失敗: ${data.message}\n${(data.errors || []).join('\n')}`);
                }
            } catch (e) {
                showToast('error', `批次刪除時發生錯誤: ${e.message}`);
            }
        }
    });
}

/**
 * Custom Confirmation Dialog (Tailwind Version)
 */
function showJobConfirm(options) {
    const modalId = 'jobConfirmModal';
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');

    if (titleEl) titleEl.textContent = options.title || '確認';
    if (msgEl) msgEl.textContent = options.message || '確定要繼續嗎？';

    if (confirmBtn) {
        confirmBtn.textContent = options.confirmText || '確定';
        // Remove old event listeners
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        // Apply classes (reset then add)
        newBtn.className = `w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${options.confirmClass || 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`;

        newBtn.addEventListener('click', async () => {
             closeJobModal(modalId);
             if (options.onConfirm) {
                 await options.onConfirm();
             }
        });
    }

    openJobModal(modalId);
}

/**
 * 顯示 Toast 提示訊息 (Tailwind Version)
 */
function showToast(type, message) {
    const toastId = 'toast_' + Date.now();
    let bgColor, icon;

    if (type === 'success') {
        bgColor = 'bg-green-600';
        icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    } else if (type === 'error') {
        bgColor = 'bg-red-600';
        icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
    } else {
        bgColor = 'bg-blue-600';
         icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }

    const toastHtml = `
        <div id="${toastId}" class="fixed top-5 right-5 z-[70] flex items-center w-full max-w-xs p-4 space-x-4 text-white ${bgColor} rounded-lg shadow-lg transition-all duration-300 transform translate-x-full" role="alert">
            ${icon}
            <div class="ps-2 text-sm font-normal">${message}</div>
            <button type="button" class="ms-auto -mx-1.5 -my-1.5 bg-transparent text-white hover:text-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-white/20 inline-flex items-center justify-center h-8 w-8" onclick="document.getElementById('${toastId}').remove()">
                <span class="sr-only">Close</span>
                <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                </svg>
            </button>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', toastHtml);

    // Animation to slide in
    setTimeout(() => {
        const el = document.getElementById(toastId);
        if(el) el.classList.remove('translate-x-full');
    }, 10);

    // Auto remove
    setTimeout(() => {
        const el = document.getElementById(toastId);
        if (el) {
            el.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => el.remove(), 300);
        }
    }, 4000);
}

/**
 * 搜尋目前的 Jobs 表格
 */
function filterJobsTable() {
    const input = document.getElementById('jobSearchInput');
    if (!input) return;

    const filter = input.value.toLowerCase().trim();
    const table = document.getElementById('jobsTable');
    if (!table) return;

    const rows = table.querySelectorAll('#jobsTableBody tr');
    rows.forEach(row => {
        // Skip specialized rows (loading, empty, etc.)
        if (row.cells.length < 5) return;

        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
}

// 修改重新整理函數以重置搜尋
const originalRefreshJobList = window.refreshJobList;
window.refreshJobList = async function() {
    const searchInput = document.getElementById('jobSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    await loadJobList();
};

// 初始化
window.addEventListener('load', () => {
    initScheduleJobs();
});

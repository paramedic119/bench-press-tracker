/* ==================================================
   app.js — アプリ初期化・タブ制御・トースト
   ================================================== */

// --- localStorageキー ---
const LS_KEY_MAX = 'bp_max_weight';
const LS_KEY_HISTORY = 'bp_history';
const LS_KEY_WEEK = 'bp_selected_week';
const LS_KEY_DAY = 'bp_selected_day';
const LS_KEY_PROGRAM = 'bp_selected_program';

/**
 * MAX重量を取得（デフォルト100kg）
 * @returns {number}
 */
function getMaxWeight() {
    const stored = localStorage.getItem(LS_KEY_MAX);
    return stored ? parseFloat(stored) : 100;
}

/**
 * MAX重量を保存
 * @param {number} weight
 */
function setMaxWeight(weight) {
    localStorage.setItem(LS_KEY_MAX, String(weight));
}

/**
 * 履歴一覧を取得
 * @returns {Array<object>}
 */
function getHistory() {
    const stored = localStorage.getItem(LS_KEY_HISTORY);
    return stored ? JSON.parse(stored) : [];
}

/**
 * 履歴一覧を保存
 * @param {Array<object>} history
 */
function setHistory(history) {
    localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(history));
}

/**
 * 選択中のプログラムIDを取得
 * @returns {string}
 */
function getSelectedProgramId() {
    const stored = localStorage.getItem(LS_KEY_PROGRAM);
    return stored || PROGRAMS[0].id;
}

/**
 * 選択中のプログラムIDを保存
 * @param {string} id
 */
function setSelectedProgramId(id) {
    localStorage.setItem(LS_KEY_PROGRAM, id);
}

/**
 * トースト通知を表示
 * @param {string} message - 表示メッセージ
 * @param {number} duration - 表示時間(ms)
 */
function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// --- タブ制御 ---
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            // アクティブ切り替え
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetEl = document.getElementById(`tab-${target}`);
            if (targetEl) targetEl.classList.add('active');

            // タブ切り替え時にグラフを再描画
            if (target === 'chart') {
                renderCharts();
            }
            // 履歴タブ切り替え時に再描画
            if (target === 'history') {
                renderHistory();
            }
            // プログラムタブ切り替え時に再描画
            if (target === 'progress') {
                renderProgress();
            }
        });
    });
}

// --- MAX重量入力 ---
function initMaxWeightInput() {
    const input = document.getElementById('max-weight-input');
    if (!input) return;

    input.value = getMaxWeight();

    input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
            setMaxWeight(val);
            // メニュー再描画
            renderMenu();
            showToast(`MAX重量を ${val}kg に更新しました`);
        }
    });
}

// --- アプリ起動 ---
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initMaxWeightInput();
    initSelectors();
    renderMenu();
    renderHistory();
});

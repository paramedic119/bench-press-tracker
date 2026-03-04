/* ==================================================
   app.js — アプリ初期化・タブ制御・トースト
   GAS PropertiesService 対応版
   ================================================== */

// --- localStorageキー（フォールバック用） ---
const LS_KEY_MAX = 'bp_max_weight';
const LS_KEY_HISTORY = 'bp_history';
const LS_KEY_WEEK = 'bp_selected_week';
const LS_KEY_DAY = 'bp_selected_day';
const LS_KEY_PROGRAM = 'bp_selected_program';

// --- GAS環境判定 ---
const IS_GAS = (typeof google !== 'undefined' && typeof google.script !== 'undefined' && typeof google.script.run !== 'undefined');

// --- インメモリキャッシュ（GAS環境で使用） ---
/** @type {Object<string, string>} */
let _dataCache = {};

/**
 * GAS環境かどうかを判定
 * @returns {boolean}
 */
function isGasEnv() {
    return IS_GAS;
}

// --- データの読み書き（GAS/localStorage 自動切り替え） ---

/**
 * キャッシュまたはlocalStorageから値を取得
 * @param {string} key
 * @returns {string|null}
 */
function _getData(key) {
    if (isGasEnv()) {
        const v = _dataCache[key];
        return v !== undefined ? v : null;
    }
    return localStorage.getItem(key);
}

/**
 * キャッシュまたはlocalStorageに値を保存し、GAS環境ならサーバーにも同期
 * @param {string} key
 * @param {string} value
 */
function _setData(key, value) {
    if (isGasEnv()) {
        _dataCache[key] = value;
        _syncToServer();
    } else {
        localStorage.setItem(key, value);
    }
}

/**
 * インメモリキャッシュをサーバーへ非同期保存（デバウンス付き）
 */
let _syncTimer = null;
function _syncToServer() {
    if (!isGasEnv()) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
        const jsonStr = JSON.stringify(_dataCache);
        google.script.run
            .withFailureHandler((err) => {
                console.error('サーバー保存エラー:', err);
            })
            .saveAllData(jsonStr);
    }, 500);
}

// --- 公開API（既存インターフェース維持） ---

/**
 * MAX重量を取得（デフォルト100kg）
 * @returns {number}
 */
function getMaxWeight() {
    const stored = _getData(LS_KEY_MAX);
    return stored ? parseFloat(stored) : 100;
}

/**
 * MAX重量を保存
 * @param {number} weight
 */
function setMaxWeight(weight) {
    _setData(LS_KEY_MAX, String(weight));
}

/**
 * 履歴一覧を取得
 * @returns {Array<object>}
 */
function getHistory() {
    const stored = _getData(LS_KEY_HISTORY);
    return stored ? JSON.parse(stored) : [];
}

/**
 * 履歴一覧を保存
 * @param {Array<object>} history
 */
function setHistory(history) {
    _setData(LS_KEY_HISTORY, JSON.stringify(history));
}

/**
 * 選択中のプログラムIDを取得
 * @returns {string}
 */
function getSelectedProgramId() {
    const stored = _getData(LS_KEY_PROGRAM);
    return stored || PROGRAMS[0].id;
}

/**
 * 選択中のプログラムIDを保存
 * @param {string} id
 */
function setSelectedProgramId(id) {
    _setData(LS_KEY_PROGRAM, id);
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

/**
 * アプリのUI初期化（データロード後に呼ばれる）
 */
function _initApp() {
    initTabs();
    initMaxWeightInput();
    initSelectors();
    renderMenu();
    renderHistory();
}

// --- アプリ起動 ---
document.addEventListener('DOMContentLoaded', () => {
    if (isGasEnv()) {
        // GAS環境: サーバーからデータをロードしてからUI初期化
        google.script.run
            .withSuccessHandler((jsonStr) => {
                try {
                    _dataCache = JSON.parse(jsonStr || '{}');
                } catch (e) {
                    _dataCache = {};
                }
                _initApp();
            })
            .withFailureHandler((err) => {
                console.error('サーバーデータ読み込みエラー:', err);
                _dataCache = {};
                _initApp();
            })
            .loadAllData();
    } else {
        // ローカル環境: 従来通りlocalStorageを使用
        _initApp();
    }
});

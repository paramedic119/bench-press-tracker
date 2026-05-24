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

// サーバーからの初期データ読込に失敗した場合 true。
// この状態で書込みを許すと空キャッシュでサーバーを上書きし既存データを失うため、書込みを抑止する。
let _dataLoadFailed = false;

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
        if (_dataLoadFailed) {
            showToast('⚠️ サーバー読込失敗のため保存できません。再読込してください', 4000);
            return;
        }
        _dataCache[key] = value;
        _syncToServer();
    } else {
        localStorage.setItem(key, value);
    }
}

let _syncTimer = null;

/**
 * インメモリキャッシュをサーバーへ非同期保存（デバウンス付き）
 */
function _syncToServer() {
    if (!isGasEnv() || _dataLoadFailed) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(_flushSyncNow, 500);
}

/**
 * デバウンス待ちをスキップして即座にサーバーへ送信。
 * ページ非表示・離脱イベント等から呼び、未同期データの消失を防ぐ。
 */
function _flushSyncNow() {
    if (_syncTimer) {
        clearTimeout(_syncTimer);
        _syncTimer = null;
    }
    if (!isGasEnv() || _dataLoadFailed) return;
    const jsonStr = JSON.stringify(_dataCache);
    google.script.run
        .withFailureHandler((err) => {
            console.error('サーバー保存エラー:', err);
        })
        .saveAllData(jsonStr);
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
            // 設定タブ切り替え時に最新値で描画
            if (target === 'settings') {
                renderSettings();
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

// ==================================================
// インターバルタイマー（休憩時間カウントダウン）
// ==================================================

const DEFAULT_REST_SEC = 180; // 3分
const LS_KEY_REST_SEC = 'bp_rest_duration_sec';
let _timerInterval = null;
let _timerRemaining = 0;

/**
 * 設定された休憩時間（秒）を取得
 * @returns {number}
 */
function getRestDuration() {
    const s = _getData(LS_KEY_REST_SEC);
    const n = s ? parseInt(s, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_REST_SEC;
}

/**
 * 休憩時間を保存
 * @param {number} sec
 */
function setRestDuration(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return;
    _setData(LS_KEY_REST_SEC, String(sec));
    showToast(`⏱ 休憩時間を ${sec}秒 に設定しました`, 2000);
}

/**
 * 休憩タイマーを開始（既存タイマーはリセット）
 * @param {number} [seconds] 省略時は設定値
 */
function startRestTimer(seconds) {
    stopRestTimer(false);
    _timerRemaining = (typeof seconds === 'number' && seconds > 0) ? seconds : getRestDuration();
    _renderRestTimer();
    _showRestTimer();
    _timerInterval = setInterval(() => {
        _timerRemaining--;
        if (_timerRemaining <= 0) {
            _onRestTimerComplete();
        } else {
            _renderRestTimer();
        }
    }, 1000);
}

/**
 * タイマー停止 + 非表示
 * @param {boolean} hide
 */
function stopRestTimer(hide = true) {
    if (_timerInterval) {
        clearInterval(_timerInterval);
        _timerInterval = null;
    }
    if (hide) _hideRestTimer();
}

/**
 * タイマーに秒数を加減算
 * @param {number} delta
 */
function adjustRestTimer(delta) {
    _timerRemaining = Math.max(0, _timerRemaining + delta);
    _renderRestTimer();
}

function _renderRestTimer() {
    const display = document.getElementById('rest-timer-display');
    if (!display) return;
    const min = Math.floor(_timerRemaining / 60);
    const sec = _timerRemaining % 60;
    display.textContent = `${min}:${String(sec).padStart(2, '0')}`;
}

function _showRestTimer() {
    const el = document.getElementById('rest-timer');
    if (el) el.classList.add('show');
}

function _hideRestTimer() {
    const el = document.getElementById('rest-timer');
    if (el) el.classList.remove('show');
}

function _onRestTimerComplete() {
    stopRestTimer();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    showToast('⏱ 休憩終了！次のセットへ', 3500);
}

// ==================================================
// MAX更新サジェスト（履歴の推定1RMが現在MAXを上回ったら提案）
// ==================================================

/**
 * 履歴を走査し、最大推定1RMが現在のMAXを上回っていればサジェスト表示
 */
function checkMaxSuggestion() {
    const el = document.getElementById('max-suggestion');
    if (!el) return;

    const currentMax = getMaxWeight();
    const history = getHistory();
    let best = 0;
    history.forEach(rec => {
        rec.exercises.forEach(ex => {
            // ベンチプレス系統のみ 1RM 推定に使う（足上げ・ナローは除外）
            if (ex.type !== 'bench_press') return;
            ex.sets.forEach(s => {
                const est = estimateMax(s.weight, s.reps);
                if (est > best) best = est;
            });
        });
    });

    const suggested = roundWeight(best);
    if (suggested > currentMax) {
        el.hidden = false;
        el.innerHTML = `
          <button class="max-suggest-btn" onclick="applyMaxSuggestion(${suggested})">
            🆙 推定1RM ${suggested}kg — MAX を更新
          </button>
        `;
    } else {
        el.hidden = true;
        el.innerHTML = '';
    }
}

/**
 * サジェストされたMAXを採用してメニューを再計算
 * @param {number} newMax
 */
function applyMaxSuggestion(newMax) {
    setMaxWeight(newMax);
    const input = document.getElementById('max-weight-input');
    if (input) input.value = newMax;
    checkMaxSuggestion();
    renderMenu();
    showToast(`💪 MAX重量を ${newMax}kg に更新しました`);
}

// ==================================================
// データエクスポート / インポート（JSON）
// GAS 同期失敗時の保険・機種変更時の引っ越し用
// ==================================================

const EXPORT_VERSION = 1;

/**
 * 現在の MAX・履歴・選択中プログラムを JSON でダウンロード
 */
function exportData() {
    const payload = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        maxWeight: getMaxWeight(),
        selectedProgram: getSelectedProgramId(),
        history: getHistory()
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `bp-tracker-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 バックアップを書き出しました');
}

/**
 * <input type="file"> の change イベントから JSON を読み込み、確認の上でデータ全置換
 * @param {Event} event
 */
function importData(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || !Array.isArray(data.history)) {
                throw new Error('history 配列が見つかりません');
            }
            const count = data.history.length;
            if (!confirm(`${count}件の履歴をインポートします。\n既存のデータは置き換えられます。続けますか？`)) {
                event.target.value = '';
                return;
            }

            if (typeof data.maxWeight === 'number' && data.maxWeight > 0) {
                setMaxWeight(data.maxWeight);
            }
            if (typeof data.selectedProgram === 'string') {
                setSelectedProgramId(data.selectedProgram);
            }
            setHistory(data.history);

            // UI 全体を再構築
            const maxInput = document.getElementById('max-weight-input');
            if (maxInput) maxInput.value = getMaxWeight();
            const progSel = document.getElementById('program-select');
            if (progSel) progSel.value = getSelectedProgramId();
            updateWeekOptions();
            updateDayOptions();
            renderMenu();
            renderHistory();
            checkMaxSuggestion();
            showToast(`✅ ${count}件をインポートしました`, 3000);
        } catch (err) {
            console.error('インポートエラー:', err);
            showToast(`❌ ファイル形式が無効です: ${err.message}`, 4000);
        } finally {
            event.target.value = '';
        }
    };
    reader.onerror = () => {
        showToast('❌ ファイルの読込に失敗しました', 3000);
        event.target.value = '';
    };
    reader.readAsText(file);
}

// ==================================================
// 設定タブ
// ==================================================

const APP_VERSION = '1.4.0';

/**
 * 設定タブを描画（タブ切替時 + 主要操作後に呼ぶ）
 */
function renderSettings() {
    // 休憩時間の選択
    const sel = document.getElementById('rest-duration-select');
    if (sel) sel.value = String(getRestDuration());
    // バージョン
    const ver = document.getElementById('app-version');
    if (ver) ver.textContent = APP_VERSION;
    // 履歴件数
    const rc = document.getElementById('record-count');
    if (rc) rc.textContent = `${getHistory().length}件`;
}

/**
 * 履歴のみ全削除（MAX重量や設定は残す）
 */
function resetHistory() {
    if (!confirm('履歴をすべて削除します。\nこの操作は取り消せません。続けますか？')) return;
    if (!confirm('本当に削除しますか？（最終確認）')) return;
    setHistory([]);
    renderHistory();
    if (typeof renderCharts === 'function') renderCharts();
    if (typeof checkMaxSuggestion === 'function') checkMaxSuggestion();
    renderSettings();
    showToast('🗑️ 履歴をすべて削除しました', 3000);
}

/**
 * 全データリセット（MAX・履歴・選択・設定すべて）
 */
function resetAllData() {
    if (!confirm('全データをリセットします。\nMAX重量・履歴・プログラム選択・休憩時間設定がすべて削除されます。続けますか？')) return;
    if (!confirm('本当にリセットしますか？（最終確認）')) return;

    // 既知の全キーを削除
    const keys = [LS_KEY_MAX, LS_KEY_HISTORY, LS_KEY_PROGRAM, LS_KEY_REST_SEC];
    PROGRAMS.forEach(p => {
        keys.push(`${LS_KEY_WEEK}_${p.id}`);
        keys.push(`${LS_KEY_DAY}_${p.id}`);
    });

    if (isGasEnv()) {
        keys.forEach(k => { delete _dataCache[k]; });
        _syncToServer();
    } else {
        keys.forEach(k => localStorage.removeItem(k));
    }

    // UI 再構築
    const maxInput = document.getElementById('max-weight-input');
    if (maxInput) maxInput.value = getMaxWeight();
    const progSel = document.getElementById('program-select');
    if (progSel) progSel.value = getSelectedProgramId();
    updateWeekOptions();
    updateDayOptions();
    renderMenu();
    renderHistory();
    if (typeof renderCharts === 'function') renderCharts();
    checkMaxSuggestion();
    renderSettings();
    showToast('💣 全データをリセットしました', 3000);
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
    checkMaxSuggestion();
    renderSettings();
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
                // 空キャッシュで上書きしないため書込みを抑止
                _dataLoadFailed = true;
                _dataCache = {};
                _initApp();
                showToast('⚠️ データ読込に失敗しました。保存は無効です。再読込してください', 6000);
            })
            .loadAllData();
    } else {
        // ローカル環境: 従来通りlocalStorageを使用
        _initApp();
    }

    // ページ離脱・バックグラウンド遷移時に未同期データをフラッシュ。
    // pagehide はモバイルブラウザでも比較的確実に発火する。
    window.addEventListener('pagehide', _flushSyncNow);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            _flushSyncNow();
        }
    });
});

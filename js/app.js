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
const LS_KEY_CUSTOM_PROGRAMS = 'bp_custom_programs';

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
 * 指定リフトの保存キーを返す
 * @param {string} lift
 * @returns {string}
 */
function _maxKeyForLift(lift) {
    return `${LS_KEY_MAX}_${lift}`;
}

/**
 * 現在選択中プログラムの主種目を取得
 * @returns {string} 'bench_press' | 'squat' | 'deadlift'
 */
function getCurrentLift() {
    const prog = getProgramById(getSelectedProgramId());
    return (prog && prog.mainLift) || 'bench_press';
}

/**
 * 指定リフト（省略時は現在のプログラムの主種目）のMAXを取得。
 * デフォルト100kg。bench_press は旧キー `bp_max_weight` からも読み取り後方互換。
 * @param {string} [lift]
 * @returns {number}
 */
function getMaxWeight(lift) {
    const targetLift = lift || getCurrentLift();
    let stored = _getData(_maxKeyForLift(targetLift));
    // 後方互換: bench_press はリフト別キーが無ければ旧キーを試す
    if (stored === null && targetLift === 'bench_press') {
        stored = _getData(LS_KEY_MAX);
    }
    return stored ? parseFloat(stored) : 100;
}

/**
 * 指定リフト（省略時は現在のプログラムの主種目）のMAXを保存
 * @param {number} weight
 * @param {string} [lift]
 */
function setMaxWeight(weight, lift) {
    const targetLift = lift || getCurrentLift();
    _setData(_maxKeyForLift(targetLift), String(weight));
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

// ==================================================
// カスタムプログラム（ユーザー作成）
// ==================================================

/**
 * カスタムプログラム一覧をストレージから取得
 * @returns {Array<object>}
 */
function getCustomPrograms() {
    const stored = _getData(LS_KEY_CUSTOM_PROGRAMS);
    try {
        const arr = stored ? JSON.parse(stored) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

/**
 * カスタムプログラム一覧をストレージへ保存
 * @param {Array<object>} programs
 */
function saveCustomPrograms(programs) {
    _setData(LS_KEY_CUSTOM_PROGRAMS, JSON.stringify(programs));
}

/**
 * ストレージのカスタムプログラムを PROGRAMS 配列へ反映。
 * 既存IDがあれば置換、無ければ末尾追加。`isCustom` フラグを立てる。
 * 初期化時とエディタ保存後に呼ばれる。
 */
function syncCustomProgramsIntoArray() {
    const customs = getCustomPrograms();
    // 既存のカスタムを一度削除（純粋に再ロード）
    for (let i = PROGRAMS.length - 1; i >= 0; i--) {
        if (PROGRAMS[i].isCustom) PROGRAMS.splice(i, 1);
    }
    customs.forEach(p => {
        p.isCustom = true;
        PROGRAMS.push(p);
    });
}

// --- トースト通知（キュー方式で連発時の上書きを防止） ---
const _toastQueue = [];
let _toastShowing = false;
const _TOAST_TRANSITION_MS = 350;

/**
 * トースト通知を表示。複数連続して呼ばれた場合はキューに積まれて順次表示される。
 * @param {string} message
 * @param {number} duration
 */
function showToast(message, duration = 2500) {
    _toastQueue.push({ message, duration });
    if (!_toastShowing) _processToastQueue();
}

function _processToastQueue() {
    if (_toastQueue.length === 0) {
        _toastShowing = false;
        return;
    }
    _toastShowing = true;
    const { message, duration } = _toastQueue.shift();
    const toast = document.getElementById('toast');
    if (!toast) {
        // DOM 未準備の場合は次へ
        _processToastQueue();
        return;
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        // スライドアウトのトランジション完了を待ってから次を表示
        setTimeout(_processToastQueue, _TOAST_TRANSITION_MS);
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

            // メニュータブ以外に切替時はインターバルタイマーを閉じて画面を遮らない
            if (target !== 'menu') {
                stopRestTimer();
            }

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

    refreshMaxWeightUI();

    input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
            const lift = getCurrentLift();
            setMaxWeight(val, lift);
            renderMenu();
            const liftName = LIFT_NAMES[lift] || lift;
            showToast(`${liftName} MAX を ${val}kg に更新しました`);
            checkMaxSuggestion();
        }
    });
}

/**
 * MAXラベルと入力値を現在のリフトに合わせて更新。
 * プログラム切替時にも呼ぶ。
 */
function refreshMaxWeightUI() {
    const input = document.getElementById('max-weight-input');
    const label = document.getElementById('max-weight-label');
    if (input) input.value = getMaxWeight();
    if (label) {
        const lift = getCurrentLift();
        label.textContent = `${LIFT_SHORT[lift] || 'CURRENT'} MAX`;
    }
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
 * 履歴を走査し、現在リフトの最大推定1RMが現在MAXを上回っていればサジェスト表示
 */
function checkMaxSuggestion() {
    const el = document.getElementById('max-suggestion');
    if (!el) return;

    const lift = getCurrentLift();
    const currentMax = getMaxWeight(lift);
    const history = getHistory();
    let best = 0;
    history.forEach(rec => {
        rec.exercises.forEach(ex => {
            // 現在リフトのメイン種目のみで推定（ナロー・ポーズ等の補助種目は除外）
            if (ex.type !== lift) return;
            ex.sets.forEach(s => {
                const est = estimateMax(s.weight, s.reps);
                if (est > best) best = est;
            });
        });
    });

    const suggested = roundWeight(best);
    if (suggested > currentMax) {
        const liftName = LIFT_NAMES[lift] || lift;
        el.hidden = false;
        el.innerHTML = `
          <button class="max-suggest-btn" onclick="applyMaxSuggestion(${suggested})">
            🆙 ${liftName}推定1RM ${suggested}kg — MAX を更新
          </button>
        `;
    } else {
        el.hidden = true;
        el.innerHTML = '';
    }
}

/**
 * サジェストされたMAXを現在リフトに対して採用してメニューを再計算
 * @param {number} newMax
 */
function applyMaxSuggestion(newMax) {
    const lift = getCurrentLift();
    setMaxWeight(newMax, lift);
    const input = document.getElementById('max-weight-input');
    if (input) input.value = newMax;
    checkMaxSuggestion();
    renderMenu();
    const liftName = LIFT_NAMES[lift] || lift;
    showToast(`💪 ${liftName} MAX を ${newMax}kg に更新しました`);
}

// ==================================================
// データエクスポート / インポート（JSON）
// GAS 同期失敗時の保険・機種変更時の引っ越し用
// ==================================================

const EXPORT_VERSION = 2; // v2: 全リフトMAX・休憩設定・アチーブメント対応

/**
 * 全データ（履歴・全リフトMAX・選択中プログラム・休憩設定・アチーブメント）を
 * JSON でダウンロード
 */
function exportData() {
    const maxWeights = {};
    Object.keys(LIFT_NAMES).forEach(lift => {
        maxWeights[lift] = getMaxWeight(lift);
    });
    const payload = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        maxWeights: maxWeights,
        // 旧形式リーダー向けに bench_press の値も同梱
        maxWeight: maxWeights.bench_press,
        selectedProgram: getSelectedProgramId(),
        restDuration: getRestDuration(),
        unlockedAchievements: Array.from(
            typeof getUnlockedAchievements === 'function' ? getUnlockedAchievements() : []
        ),
        customPrograms: getCustomPrograms(),
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

            // 新形式 (v2): maxWeights オブジェクトでリフト別に復元
            if (data.maxWeights && typeof data.maxWeights === 'object') {
                Object.entries(data.maxWeights).forEach(([lift, w]) => {
                    if (typeof w === 'number' && w > 0 && LIFT_NAMES[lift]) {
                        setMaxWeight(w, lift);
                    }
                });
            } else if (typeof data.maxWeight === 'number' && data.maxWeight > 0) {
                // 旧形式 (v1): 単一maxWeight は bench_press として扱う
                setMaxWeight(data.maxWeight, 'bench_press');
            }
            if (typeof data.selectedProgram === 'string') {
                setSelectedProgramId(data.selectedProgram);
            }
            if (typeof data.restDuration === 'number' && data.restDuration > 0) {
                _setData(LS_KEY_REST_SEC, String(data.restDuration));
            }
            if (Array.isArray(data.unlockedAchievements) && typeof setUnlockedAchievements === 'function') {
                setUnlockedAchievements(new Set(data.unlockedAchievements));
            }
            if (Array.isArray(data.customPrograms)) {
                saveCustomPrograms(data.customPrograms);
                syncCustomProgramsIntoArray();
            }
            setHistory(data.history);

            // UI 全体を再構築（カスタムプログラムが含まれる可能性があるので select も再構築）
            if (typeof refreshProgramSelect === 'function') refreshProgramSelect();
            const progSel = document.getElementById('program-select');
            if (progSel) progSel.value = getSelectedProgramId();
            updateWeekOptions();
            updateDayOptions();
            refreshMaxWeightUI();
            renderMenu();
            renderHistory();
            checkMaxSuggestion();
            if (typeof checkAchievements === 'function') checkAchievements(false); // 静かに遡及判定
            renderSettings();
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
    // カスタムプログラム一覧
    if (typeof renderCustomProgramList === 'function') renderCustomProgramList();
    // アチーブメント一覧
    if (typeof renderAchievements === 'function') renderAchievements();
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
    const keys = [LS_KEY_MAX, LS_KEY_HISTORY, LS_KEY_PROGRAM, LS_KEY_REST_SEC, LS_KEY_CUSTOM_PROGRAMS];
    if (typeof LS_KEY_ACHIEVEMENTS !== 'undefined') keys.push(LS_KEY_ACHIEVEMENTS);
    Object.keys(LIFT_NAMES).forEach(lift => {
        keys.push(_maxKeyForLift(lift));
    });
    PROGRAMS.forEach(p => {
        keys.push(`${LS_KEY_WEEK}_${p.id}`);
        keys.push(`${LS_KEY_DAY}_${p.id}`);
    });

    // カスタムプログラムを PROGRAMS から除去
    syncCustomProgramsIntoArray(); // ストレージは消える前に空になる前提だが念のため再同期は後段

    if (isGasEnv()) {
        keys.forEach(k => { delete _dataCache[k]; });
        _syncToServer();
    } else {
        keys.forEach(k => localStorage.removeItem(k));
    }

    // UI 再構築
    const progSel = document.getElementById('program-select');
    if (progSel) progSel.value = getSelectedProgramId();
    updateWeekOptions();
    updateDayOptions();
    refreshMaxWeightUI();
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
    // カスタムプログラムを PROGRAMS に注入してから UI 初期化
    syncCustomProgramsIntoArray();
    initTabs();
    initMaxWeightInput();
    initSelectors();
    renderMenu();
    renderHistory();
    checkMaxSuggestion();
    renderSettings();
    // 初回ロード時にアチーブメントを遡及判定（トースト無し）
    if (typeof checkAchievements === 'function') checkAchievements(false);
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

    // PWA: Service Worker 登録（GAS環境ではiframe内で動かないためスキップ）
    if ('serviceWorker' in navigator && !isGasEnv()) {
        navigator.serviceWorker.register('./service-worker.js')
            .catch(err => console.warn('Service Worker 登録に失敗:', err));
    }
});

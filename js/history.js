/* ==================================================
   history.js — 履歴管理・一括削除
   ================================================== */

/**
 * 履歴タブの描画
 */
function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    const history = getHistory();

    if (history.length === 0) {
        container.innerHTML = `
      <div class="history-empty">
        <div class="empty-icon">📝</div>
        <p>まだ記録がありません。<br>メニュータブから実績を保存しましょう！</p>
      </div>
    `;
        updateDeleteBtnState();
        return;
    }

    let html = '';
    history.forEach((rec) => {
        const date = new Date(rec.date);
        const dateStr = formatDateTime(date);
        const exerciseSummary = rec.exercises.map(ex => {
            const bestSet = ex.sets.reduce((best, s) =>
                (s.weight * s.reps > best.weight * best.reps) ? s : best
                , { weight: 0, reps: 0 });
            return `${ex.name} ${bestSet.weight}kg×${bestSet.reps}`;
        }).join(' / ');

        let totalVolume = 0;
        rec.exercises.forEach(ex => {
            ex.sets.forEach(s => { totalVolume += s.weight * s.reps; });
        });

        html += `
      <div class="history-item" data-id="${rec.id}" onclick="openHistoryDetail(${rec.id})">
        <input type="checkbox" class="history-checkbox" value="${rec.id}"
               onclick="event.stopPropagation(); updateDeleteBtnState();">
        <div class="history-info">
          <div class="history-date">📅 ${dateStr} [${rec.programName || 'BPS'}] W${rec.week}D${rec.day}</div>
          <div class="history-detail">${exerciseSummary}</div>
          <div class="history-volume">📊 Volume: ${totalVolume.toLocaleString()}kg</div>
        </div>
        <div class="history-chevron" aria-hidden="true">›</div>
      </div>
    `;
    });

    container.innerHTML = html;
    updateDeleteBtnState();
}

function toggleSelectAll() {
    const cbs = document.querySelectorAll('#history-list .history-checkbox');
    const allChecked = Array.from(cbs).every(cb => cb.checked);
    cbs.forEach(cb => { cb.checked = !allChecked; });
    updateDeleteBtnState();
}

function updateDeleteBtnState() {
    const checked = document.querySelectorAll('#history-list .history-checkbox:checked');
    const btn = document.getElementById('delete-selected-btn');
    if (!btn) return;
    if (checked.length > 0) {
        btn.textContent = `🗑️ ${checked.length}件を削除`;
        btn.style.display = 'flex';
    } else {
        btn.style.display = 'none';
    }
}

/**
 * 同じプログラム/週/日の直近履歴から、指定セットの実績を取得する。
 * exIdx は同一Day内で同種目が複数回登場するケース（例: URPEST2 W3D1 の bench_press × 4）
 * を区別するために使用。古いレコード（exIdx 未保存）は種目型のみで一致判定。
 *
 * @param {string} programId
 * @param {number} weekNum
 * @param {number} dayNum
 * @param {number} exIdx
 * @param {string} exerciseType
 * @param {number} setNum
 * @returns {{weight: number, reps: number}|null}
 */
function getPreviousResult(programId, weekNum, dayNum, exIdx, exerciseType, setNum, historyCache = null) {
    const history = historyCache || getHistory(); // 新しい順
    for (const rec of history) {
        if (rec.programId !== programId) continue;
        if (rec.week !== weekNum || rec.day !== dayNum) continue;

        // 同じ exIdx + type のエクササイズを優先一致
        let recEx = rec.exercises.find(e => e.exIdx === exIdx && e.type === exerciseType);
        // フォールバック: exIdx 未保存の古いレコードは型のみで一致
        if (!recEx) recEx = rec.exercises.find(e => !('exIdx' in e) && e.type === exerciseType);
        if (!recEx) continue;

        const set = recEx.sets.find(s => s.set === setNum);
        if (set) return { weight: set.weight, reps: set.reps };
    }
    return null;
}

function deleteSelected() {
    const cbs = document.querySelectorAll('#history-list .history-checkbox:checked');
    if (cbs.length === 0) { showToast('削除する履歴を選択してください'); return; }
    if (!confirm(`${cbs.length}件の履歴を削除しますか？`)) return;

    const ids = new Set(Array.from(cbs).map(cb => parseInt(cb.value, 10)));
    const history = getHistory().filter(r => !ids.has(r.id));
    setHistory(history);
    renderHistory();
    showToast(`🗑️ ${ids.size}件削除しました`);
}

// ==================================================
// 履歴詳細モーダル（ボトムシート）
// ==================================================

/**
 * 指定IDの履歴詳細をモーダルで表示
 * @param {number} id
 */
function openHistoryDetail(id) {
    const rec = getHistory().find(r => r.id === id);
    if (!rec) return;
    const modal = document.getElementById('history-modal');
    const body = document.getElementById('history-modal-body');
    if (!modal || !body) return;

    body.innerHTML = _renderHistoryDetailHTML(rec);
    modal.hidden = false;
    // 1フレーム後にクラス付与でトランジション発火
    requestAnimationFrame(() => modal.classList.add('show'));
    document.body.style.overflow = 'hidden';
}

/**
 * 履歴詳細モーダルを閉じる
 */
function closeHistoryDetail() {
    const modal = document.getElementById('history-modal');
    if (!modal) return;
    modal.classList.remove('show');
    // トランジション後に hidden
    setTimeout(() => {
        modal.hidden = true;
        const body = document.getElementById('history-modal-body');
        if (body) body.innerHTML = '';
    }, 320);
    document.body.style.overflow = '';
}

/**
 * 単独の履歴を削除（詳細モーダルから呼ばれる）
 * @param {number} id
 */
function deleteHistoryById(id) {
    if (!confirm('この記録を削除しますか？')) return;
    const history = getHistory().filter(r => r.id !== id);
    setHistory(history);
    closeHistoryDetail();
    renderHistory();
    if (typeof checkMaxSuggestion === 'function') checkMaxSuggestion();
    showToast('🗑️ 削除しました');
}

/**
 * 履歴1件の詳細表示HTMLを構築
 * @param {object} rec
 * @returns {string}
 */
function _renderHistoryDetailHTML(rec) {
    const date = new Date(rec.date);
    const dateStr = formatDateTime(date);

    let totalVolume = 0;
    let bestEstSession = 0;

    let html = '';
    html += `<div class="detail-header">`;
    html += `  <div class="detail-date">📅 ${dateStr}</div>`;
    html += `  <div class="detail-meta">${rec.programName || '不明'} · Week ${rec.week} Day ${rec.day}${rec.maxWeight ? ` · MAX ${rec.maxWeight}kg` : ''}</div>`;
    html += `</div>`;

    rec.exercises.forEach(ex => {
        const exName = ex.name || EXERCISE_NAMES[ex.type] || ex.type;
        const exIcon = EXERCISE_ICONS[ex.type] || '🏋️';
        let exBestEst = 0;
        let exVolume = 0;

        html += `<div class="detail-exercise">`;
        html += `  <div class="detail-ex-header">`;
        html += `    <span class="detail-ex-icon">${exIcon}</span>`;
        html += `    <span class="detail-ex-name">${exName}</span>`;
        html += `  </div>`;
        html += `  <div class="detail-set-list">`;

        ex.sets.forEach(s => {
            const est = estimateMax(s.weight, s.reps);
            if (est > exBestEst) exBestEst = est;
            exVolume += s.weight * s.reps;
            html += `<div class="detail-set">`;
            html += `  <span class="ds-num">${s.set}</span>`;
            html += `  <span class="ds-main">${s.weight}<small>kg</small> × ${s.reps}</span>`;
            html += `  <span class="ds-est">est. ${est}kg</span>`;
            html += `</div>`;
        });

        html += `  </div>`;
        html += `  <div class="detail-ex-summary">`;
        html += `    <span>推定1RM: <strong>${exBestEst}kg</strong></span>`;
        html += `    <span>Volume: <strong>${exVolume.toLocaleString()}kg</strong></span>`;
        html += `  </div>`;
        html += `</div>`;

        totalVolume += exVolume;
        if (exBestEst > bestEstSession) bestEstSession = exBestEst;
    });

    html += `<div class="detail-footer">`;
    html += `  <div class="detail-stat">`;
    html += `    <div class="stat-label">SESSION VOLUME</div>`;
    html += `    <div class="stat-value">${totalVolume.toLocaleString()}<small>kg</small></div>`;
    html += `  </div>`;
    html += `  <div class="detail-stat">`;
    html += `    <div class="stat-label">BEST EST. 1RM</div>`;
    html += `    <div class="stat-value">${bestEstSession}<small>kg</small></div>`;
    html += `  </div>`;
    html += `</div>`;

    html += `<button type="button" class="btn-danger detail-delete-btn" onclick="deleteHistoryById(${rec.id})">🗑️ この記録を削除</button>`;

    return html;
}

// ESC キーでモーダルを閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('history-modal');
        if (modal && !modal.hidden) closeHistoryDetail();
    }
});

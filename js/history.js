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
      <div class="history-item" data-id="${rec.id}" onclick="toggleHistoryItem(this)">
        <input type="checkbox" class="history-checkbox" value="${rec.id}"
               onclick="event.stopPropagation(); updateDeleteBtnState();">
        <div class="history-info">
          <div class="history-date">📅 ${dateStr} [${rec.programName || 'BPS'}] W${rec.week}D${rec.day}</div>
          <div class="history-detail">${exerciseSummary}</div>
          <div class="history-volume">📊 Volume: ${totalVolume.toLocaleString()}kg</div>
        </div>
      </div>
    `;
    });

    container.innerHTML = html;
    updateDeleteBtnState();
}

function toggleHistoryItem(el) {
    const cb = el.querySelector('.history-checkbox');
    if (cb) {
        cb.checked = !cb.checked;
        el.classList.toggle('selected', cb.checked);
        updateDeleteBtnState();
    }
}

function toggleSelectAll() {
    const cbs = document.querySelectorAll('#history-list .history-checkbox');
    const allChecked = Array.from(cbs).every(cb => cb.checked);
    cbs.forEach(cb => {
        cb.checked = !allChecked;
        cb.closest('.history-item')?.classList.toggle('selected', !allChecked);
    });
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

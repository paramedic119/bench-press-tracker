/* ==================================================
   program-editor.js — カスタムプログラム作成・編集UI
   ================================================== */

// 編集中プログラムのID（新規は null）
let _editingProgramId = null;

/**
 * 設定タブのカスタムプログラム一覧を描画
 */
function renderCustomProgramList() {
    const container = document.getElementById('custom-program-list');
    if (!container) return;

    const customs = getCustomPrograms();
    if (customs.length === 0) {
        container.innerHTML = `
          <div class="cp-empty">
            まだカスタムプログラムはありません。<br>
            「新規作成」から作成できます。
          </div>
        `;
        return;
    }

    let html = '';
    customs.forEach(p => {
        const liftName = LIFT_NAMES[p.mainLift] || p.mainLift;
        const totalDays = (p.weeks || []).reduce((sum, w) => sum + (w.days?.length || 0), 0);
        html += `
          <div class="cp-item">
            <div class="cp-info">
              <div class="cp-name">📝 ${_escapeHtml(p.name)}</div>
              <div class="cp-meta">${liftName} · ${p.weeks?.length || 0}週 / ${totalDays}Day</div>
            </div>
            <div class="cp-actions">
              <button type="button" class="cp-btn" onclick="openProgramEditor('${p.id}')" aria-label="編集">✏️</button>
              <button type="button" class="cp-btn cp-btn-danger" onclick="deleteCustomProgram('${p.id}')" aria-label="削除">🗑️</button>
            </div>
          </div>
        `;
    });
    container.innerHTML = html;
}

/**
 * エディタを開く。programId 指定で既存プログラムを編集、未指定で新規作成。
 * @param {string} [programId]
 */
function openProgramEditor(programId) {
    const modal = document.getElementById('program-editor-modal');
    if (!modal) return;

    _editingProgramId = programId || null;
    const existing = programId ? getCustomPrograms().find(p => p.id === programId) : null;

    // 基本情報のセット
    document.getElementById('pe-name').value = existing?.name || '';
    document.getElementById('pe-description').value = existing?.description || '';
    document.getElementById('pe-main-lift').value = existing?.mainLift || 'bench_press';

    // 種目セレクト用のオプション生成
    _refreshExerciseTypeOptions();

    // タイトル更新
    document.getElementById('program-editor-title').textContent = existing ? 'プログラム編集' : '新規プログラム作成';

    // Weeks 部分を構築
    const weeksContainer = document.getElementById('pe-weeks');
    weeksContainer.innerHTML = '';
    if (existing && existing.weeks?.length) {
        existing.weeks.forEach(w => _appendWeekToEditor(w));
    } else {
        // 新規時はデフォルトで Week 1 / Day 1 / Exercise 1 を入れて出発点を提示
        _appendWeekToEditor({ days: [{ exercises: [_defaultExercise()] }] });
    }

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));
    document.body.style.overflow = 'hidden';
}

/**
 * エディタを閉じる
 */
function closeProgramEditor() {
    const modal = document.getElementById('program-editor-modal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
        modal.hidden = true;
        const weeksContainer = document.getElementById('pe-weeks');
        if (weeksContainer) weeksContainer.innerHTML = '';
    }, 320);
    document.body.style.overflow = '';
    _editingProgramId = null;
}

/**
 * 入力内容を検証して保存。成功で UI 全体に反映してモーダルを閉じる。
 */
function saveProgramEditor() {
    const name = document.getElementById('pe-name').value.trim();
    const description = document.getElementById('pe-description').value.trim();
    const mainLift = document.getElementById('pe-main-lift').value;

    if (!name) {
        showToast('❌ プログラム名を入力してください', 2500);
        return;
    }
    if (!LIFT_NAMES[mainLift]) {
        showToast('❌ メインリフトを選択してください', 2500);
        return;
    }

    const weeks = [];
    const weekEls = document.querySelectorAll('#pe-weeks .pe-week');
    if (weekEls.length === 0) {
        showToast('❌ 週を1つ以上追加してください', 2500);
        return;
    }

    let valid = true;
    let errorMsg = '';

    weekEls.forEach((weekEl, wIdx) => {
        if (!valid) return;
        const dayEls = weekEl.querySelectorAll('.pe-day');
        if (dayEls.length === 0) {
            valid = false;
            errorMsg = `Week ${wIdx + 1} に Day を追加してください`;
            return;
        }
        const days = [];
        dayEls.forEach((dayEl, dIdx) => {
            if (!valid) return;
            const exEls = dayEl.querySelectorAll('.pe-exercise');
            if (exEls.length === 0) {
                valid = false;
                errorMsg = `Week ${wIdx + 1} Day ${dIdx + 1} に種目を追加してください`;
                return;
            }
            const exercises = [];
            exEls.forEach((exEl, eIdx) => {
                if (!valid) return;
                const type = exEl.querySelector('[data-field="type"]').value;
                const sets = parseInt(exEl.querySelector('[data-field="target_sets"]').value, 10);
                const reps = parseInt(exEl.querySelector('[data-field="target_reps"]').value, 10);
                const pct = parseFloat(exEl.querySelector('[data-field="percentage_of_max"]').value);
                const rpeRaw = exEl.querySelector('[data-field="rpe_target"]').value.trim();
                const rpe = rpeRaw === '' ? null : parseFloat(rpeRaw);
                const amrap = exEl.querySelector('[data-field="is_amrap"]').checked;

                if (!EXERCISE_NAMES[type]) {
                    valid = false; errorMsg = `Week ${wIdx + 1} Day ${dIdx + 1} 種目${eIdx + 1}: 種目タイプが無効です`; return;
                }
                if (!(sets > 0)) { valid = false; errorMsg = `Week ${wIdx + 1} Day ${dIdx + 1} 種目${eIdx + 1}: セット数を正しく入力`; return; }
                if (!(reps > 0)) { valid = false; errorMsg = `Week ${wIdx + 1} Day ${dIdx + 1} 種目${eIdx + 1}: 回数を正しく入力`; return; }
                if (!(pct > 0)) { valid = false; errorMsg = `Week ${wIdx + 1} Day ${dIdx + 1} 種目${eIdx + 1}: %MAXを正しく入力`; return; }

                exercises.push({
                    type,
                    target_sets: sets,
                    target_reps: reps,
                    percentage_of_max: pct,
                    is_amrap: amrap,
                    rpe_target: Number.isFinite(rpe) ? rpe : null
                });
            });
            days.push({ day_number: dIdx + 1, exercises });
        });
        weeks.push({ week_number: wIdx + 1, days });
    });

    if (!valid) {
        showToast(`❌ ${errorMsg}`, 3500);
        return;
    }

    // 保存
    const customs = getCustomPrograms();
    const isEdit = !!_editingProgramId;
    const id = _editingProgramId || `custom_${Date.now()}`;
    const newProgram = { id, name, description, mainLift, weeks };

    if (isEdit) {
        const idx = customs.findIndex(p => p.id === id);
        if (idx >= 0) customs[idx] = newProgram;
        else customs.push(newProgram);
    } else {
        customs.push(newProgram);
    }
    saveCustomPrograms(customs);

    // PROGRAMS 配列と各UI を再構築
    syncCustomProgramsIntoArray();
    if (typeof refreshProgramSelect === 'function') refreshProgramSelect();
    renderCustomProgramList();
    // 現在選択中のプログラムが編集対象だったらメニューも再描画
    if (getSelectedProgramId() === id) {
        if (typeof refreshMaxWeightUI === 'function') refreshMaxWeightUI();
        updateWeekOptions();
        updateDayOptions();
        renderMenu();
    }

    closeProgramEditor();
    showToast(isEdit ? '✅ プログラムを更新しました' : '✨ プログラムを作成しました');
}

/**
 * カスタムプログラムを削除（確認あり）
 */
function deleteCustomProgram(id) {
    const customs = getCustomPrograms();
    const target = customs.find(p => p.id === id);
    if (!target) return;
    if (!confirm(`「${target.name}」を削除しますか？\nこの操作は取り消せません。`)) return;

    const remaining = customs.filter(p => p.id !== id);
    saveCustomPrograms(remaining);
    syncCustomProgramsIntoArray();

    // 削除対象が選択中なら、最初のプログラムに切り替える
    if (getSelectedProgramId() === id) {
        if (PROGRAMS.length > 0) setSelectedProgramId(PROGRAMS[0].id);
    }
    if (typeof refreshProgramSelect === 'function') refreshProgramSelect();
    renderCustomProgramList();

    if (typeof refreshMaxWeightUI === 'function') refreshMaxWeightUI();
    updateWeekOptions();
    updateDayOptions();
    renderMenu();
    showToast('🗑️ プログラムを削除しました');
}

// --- 動的フォーム構築ヘルパ ---

function _defaultExercise() {
    return {
        type: 'bench_press',
        target_sets: 3,
        target_reps: 5,
        percentage_of_max: 75,
        is_amrap: false,
        rpe_target: null
    };
}

function _refreshExerciseTypeOptions() {
    // 全エクササイズタイプを EXERCISE_NAMES から生成
    const opts = Object.entries(EXERCISE_NAMES)
        .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    // すでにある select は openProgramEditor 後に追加されるので、テンプレートとして保持
    window._peExerciseTypeOptions = opts;
}

function _appendWeekToEditor(weekData) {
    const container = document.getElementById('pe-weeks');
    const weekEl = document.createElement('div');
    weekEl.className = 'pe-week';
    weekEl.innerHTML = `
      <div class="pe-week-header">
        <span class="pe-label">Week <span class="pe-week-num"></span></span>
        <button type="button" class="pe-icon-btn" onclick="_removeWeekFromEditor(this)" aria-label="週を削除">✕</button>
      </div>
      <div class="pe-days"></div>
      <button type="button" class="btn-sm" onclick="_addDayToWeek(this.previousElementSibling)">+ Day</button>
    `;
    container.appendChild(weekEl);

    const daysContainer = weekEl.querySelector('.pe-days');
    (weekData?.days || [{ exercises: [_defaultExercise()] }]).forEach(d => {
        _appendDayToWeek(daysContainer, d);
    });
    _renumberWeeks();
}

function _addDayToWeek(daysContainer) {
    _appendDayToWeek(daysContainer, { exercises: [_defaultExercise()] });
}

function _appendDayToWeek(daysContainer, dayData) {
    const dayEl = document.createElement('div');
    dayEl.className = 'pe-day';
    dayEl.innerHTML = `
      <div class="pe-day-header">
        <span class="pe-label pe-label-sm">Day <span class="pe-day-num"></span></span>
        <button type="button" class="pe-icon-btn" onclick="_removeDayFromEditor(this)" aria-label="Dayを削除">✕</button>
      </div>
      <div class="pe-exercises"></div>
      <button type="button" class="btn-sm" onclick="_addExerciseToDay(this.previousElementSibling)">+ 種目</button>
    `;
    daysContainer.appendChild(dayEl);

    const exContainer = dayEl.querySelector('.pe-exercises');
    (dayData?.exercises || [_defaultExercise()]).forEach(ex => {
        _appendExerciseToDay(exContainer, ex);
    });
    _renumberDays(daysContainer.closest('.pe-week'));
}

function _addExerciseToDay(exContainer) {
    _appendExerciseToDay(exContainer, _defaultExercise());
}

function _appendExerciseToDay(exContainer, exData) {
    const ex = exData || _defaultExercise();
    const exEl = document.createElement('div');
    exEl.className = 'pe-exercise';
    const typeOpts = window._peExerciseTypeOptions || '';
    exEl.innerHTML = `
      <div class="pe-ex-row pe-ex-row-top">
        <select data-field="type" class="pe-ex-type">${typeOpts}</select>
        <button type="button" class="pe-icon-btn pe-icon-btn-sm" onclick="_removeExerciseFromEditor(this)" aria-label="種目を削除">✕</button>
      </div>
      <div class="pe-ex-row pe-ex-row-fields">
        <label class="pe-field"><span>セット</span><input type="number" data-field="target_sets" min="1" max="20" value="${ex.target_sets}"></label>
        <label class="pe-field"><span>回数</span><input type="number" data-field="target_reps" min="1" max="50" value="${ex.target_reps}"></label>
        <label class="pe-field"><span>%MAX</span><input type="number" data-field="percentage_of_max" min="10" max="120" step="2.5" value="${ex.percentage_of_max}"></label>
        <label class="pe-field"><span>RPE</span><input type="number" data-field="rpe_target" min="1" max="10" step="0.5" placeholder="任意" value="${ex.rpe_target ?? ''}"></label>
        <label class="pe-checkbox-inline"><input type="checkbox" data-field="is_amrap" ${ex.is_amrap ? 'checked' : ''}><span>AMRAP</span></label>
      </div>
    `;
    exContainer.appendChild(exEl);
    // 型を反映
    exEl.querySelector('[data-field="type"]').value = ex.type;
}

function _removeWeekFromEditor(btn) {
    const weekEl = btn.closest('.pe-week');
    if (!weekEl) return;
    weekEl.remove();
    _renumberWeeks();
}

function _removeDayFromEditor(btn) {
    const dayEl = btn.closest('.pe-day');
    const weekEl = dayEl?.closest('.pe-week');
    if (dayEl) dayEl.remove();
    if (weekEl) _renumberDays(weekEl);
}

function _removeExerciseFromEditor(btn) {
    const exEl = btn.closest('.pe-exercise');
    if (exEl) exEl.remove();
}

function _renumberWeeks() {
    document.querySelectorAll('#pe-weeks .pe-week').forEach((w, i) => {
        const n = w.querySelector('.pe-week-num');
        if (n) n.textContent = i + 1;
        _renumberDays(w);
    });
}

function _renumberDays(weekEl) {
    weekEl.querySelectorAll('.pe-day').forEach((d, i) => {
        const n = d.querySelector('.pe-day-num');
        if (n) n.textContent = i + 1;
    });
}

function addWeekToEditor() {
    _appendWeekToEditor({ days: [{ exercises: [_defaultExercise()] }] });
}

function _escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// ESC で閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('program-editor-modal');
        if (modal && !modal.hidden) closeProgramEditor();
    }
});

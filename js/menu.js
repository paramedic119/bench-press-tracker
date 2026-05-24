/* ==================================================
   menu.js — 今日のメニュー表示・重量自動計算・実績入力
   ================================================== */

/**
 * Program/Week/Dayセレクターの初期化
 */
function initSelectors() {
    const programSelect = document.getElementById('program-select');
    const weekSelect = document.getElementById('week-select');
    const daySelect = document.getElementById('day-select');
    if (!programSelect || !weekSelect || !daySelect) return;

    // Programオプション生成
    PROGRAMS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        programSelect.appendChild(opt);
    });

    // 保存されたProgramがあれば復元
    const savedProgram = getSelectedProgramId();
    programSelect.value = savedProgram;

    // Week選択肢を更新
    updateWeekOptions();

    // 次に取り組むべき未完了のWeek/Dayを取得して自動設定
    const nextDay = getNextDay(savedProgram);
    let targetWeek, targetDay;

    if (nextDay) {
        targetWeek = nextDay.week;
        targetDay = nextDay.day;
    } else {
        // 保存済みのWeek/Dayがあれば復元（全て完了した場合など）
        targetWeek = _getData(`${LS_KEY_WEEK}_${savedProgram}`);
        targetDay = _getData(`${LS_KEY_DAY}_${savedProgram}`);
    }

    if (targetWeek) weekSelect.value = targetWeek;

    // Day選択肢を更新
    updateDayOptions();
    if (targetDay) daySelect.value = targetDay;

    programSelect.addEventListener('change', () => {
        const newProgId = programSelect.value;
        setSelectedProgramId(newProgId);
        updateWeekOptions();

        // プログラム変更時も自動で次の未完了Dayを選択
        const nextDay = getNextDay(newProgId);
        if (nextDay) {
            weekSelect.value = nextDay.week;
            updateDayOptions();
            daySelect.value = nextDay.day;
        } else {
            const savedWeek = _getData(`${LS_KEY_WEEK}_${newProgId}`);
            if (savedWeek) weekSelect.value = savedWeek;
            updateDayOptions();
            const savedDay = _getData(`${LS_KEY_DAY}_${newProgId}`);
            if (savedDay) daySelect.value = savedDay;
        }

        // 主種目が変わるとMAXラベル・MAX値が変わるので更新
        refreshMaxWeightUI();
        checkMaxSuggestion();
        renderMenu();
    });

    weekSelect.addEventListener('change', () => {
        const progId = getSelectedProgramId();
        _setData(`${LS_KEY_WEEK}_${progId}`, weekSelect.value);
        updateDayOptions();
        renderMenu();
    });

    daySelect.addEventListener('change', () => {
        const progId = getSelectedProgramId();
        _setData(`${LS_KEY_DAY}_${progId}`, daySelect.value);
        renderMenu();
    });
}

/**
 * 選択中のProgramに合わせてWeekの選択肢を更新
 */
function updateWeekOptions() {
    const programSelect = document.getElementById('program-select');
    const weekSelect = document.getElementById('week-select');
    if (!programSelect || !weekSelect) return;

    const progId = programSelect.value;
    const program = getProgramById(progId);
    weekSelect.innerHTML = '';

    if (program) {
        program.weeks.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.week_number;
            opt.textContent = `Week ${w.week_number}`;
            weekSelect.appendChild(opt);
        });
    }
}

/**
 * 選択中のWeekに合わせてDayの選択肢を更新
 */
function updateDayOptions() {
    const programSelect = document.getElementById('program-select');
    const weekSelect = document.getElementById('week-select');
    const daySelect = document.getElementById('day-select');
    if (!programSelect || !weekSelect || !daySelect) return;

    const progId = programSelect.value;
    const weekNum = parseInt(weekSelect.value, 10);
    const program = getProgramById(progId);
    daySelect.innerHTML = '';

    if (program) {
        const week = program.weeks.find(w => w.week_number === weekNum);
        if (week) {
            week.days.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.day_number;
                opt.textContent = `Day ${d.day_number}`;
                daySelect.appendChild(opt);
            });
        }
    }
}

/**
 * メニューを描画
 */
function renderMenu() {
    const container = document.getElementById('menu-container');
    if (!container) return;

    const programId = getSelectedProgramId();
    const weekNum = parseInt(document.getElementById('week-select')?.value || '1', 10);
    const dayNum = parseInt(document.getElementById('day-select')?.value || '1', 10);
    const maxWeight = getMaxWeight();
    const dayData = getDayData(programId, weekNum, dayNum);

    renderTodaySummary(dayData, maxWeight);

    // 前回実績ルックアップ用に履歴を1回だけ取得してキャッシュ
    const historyCache = getHistory();

    if (!dayData) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <div class="message">このDayのメニューはありません</div>
      </div>
    `;
        updateSaveButtonState();
        return;
    }

    let html = '';

    dayData.exercises.forEach((ex, exIdx) => {
        const name = EXERCISE_NAMES[ex.type] || ex.type;
        const icon = EXERCISE_ICONS[ex.type] || '🏋️';
        const targetWeight = calcTargetWeight(maxWeight, ex.percentage_of_max);

        // 種目ヘッダー
        html += `<div class="card">`;
        html += `<div class="exercise-header">`;
        html += `  <div class="exercise-icon">${icon}</div>`;
        html += `  <div>`;
        html += `    <div class="exercise-name">${name}</div>`;
        html += `    <div class="exercise-meta">${ex.percentage_of_max}% × ${ex.target_reps}回 × ${ex.target_sets}セット`;
        if (ex.is_amrap) {
            html += ` <span class="badge-amrap">AMRAP${ex.rpe_target ? ` RPE${ex.rpe_target}` : ''}</span>`;
        }
        html += `</div>`;
        html += `  </div>`;
        html += `</div>`;

        // セット行
        for (let s = 1; s <= ex.target_sets; s++) {
            const chkId = `chk-${exIdx}-${s}`;
            const prev = getPreviousResult(programId, weekNum, dayNum, exIdx, ex.type, s, historyCache);
            const prevHtml = prev
                ? `<div class="set-prev">前回: ${prev.weight}kg × ${prev.reps}</div>`
                : '';

            html += `<div class="set-row">`;
            // 行全体（チェック〜目標）を <label> でくるみ、タップで切替。デフォルトは未チェック
            html += `  <label class="set-row-toggle" for="${chkId}">`;
            html += `    <input type="checkbox" id="${chkId}" class="set-check-input">`;
            html += `    <div class="set-number">${s}</div>`;
            html += `    <div class="set-target">`;
            html += `      <span class="weight-value">${targetWeight}kg</span> × <span class="reps-value">${ex.target_reps}回</span>`;
            if (ex.rpe_target) {
                html += ` <small class="rpe-target">@${ex.rpe_target}</small>`;
            }
            html += prevHtml;
            html += `    </div>`;
            html += `  </label>`;
            html += `  <div class="set-inputs">`;
            // 重量ステッパー
            html += `    <div class="stepper-group">`;
            html += `      <div class="stepper-controls">`;
            html += `        <button type="button" class="stepper-btn" onclick="adjustValue('w-${exIdx}-${s}', -2.5, 0)">−</button>`;
            html += `        <input type="number" id="w-${exIdx}-${s}" class="stepper-value" value="${targetWeight}" step="2.5" min="0" inputmode="decimal">`;
            html += `        <button type="button" class="stepper-btn" onclick="adjustValue('w-${exIdx}-${s}', 2.5, 0)">＋</button>`;
            html += `      </div>`;
            html += `      <div class="input-label">kg</div>`;
            html += `    </div>`;
            // 回数ステッパー
            html += `    <div class="stepper-group">`;
            html += `      <div class="stepper-controls">`;
            html += `        <button type="button" class="stepper-btn" onclick="adjustValue('r-${exIdx}-${s}', -1, 0)">−</button>`;
            html += `        <input type="number" id="r-${exIdx}-${s}" class="stepper-value" value="${ex.target_reps}" step="1" min="0" inputmode="numeric">`;
            html += `        <button type="button" class="stepper-btn" onclick="adjustValue('r-${exIdx}-${s}', 1, 0)">＋</button>`;
            html += `      </div>`;
            html += `      <div class="input-label">回</div>`;
            html += `    </div>`;
            html += `  </div>`;
            html += `</div>`;
        }

        html += `</div>`; // card
    });

    container.innerHTML = html;

    // チェック切替: 保存ボタン更新 + 新規チェック時にインターバルタイマー起動
    container.querySelectorAll('.set-check-input').forEach(cb => {
        cb.addEventListener('change', (e) => {
            updateSaveButtonState();
            if (e.target.checked) {
                startRestTimer();
            }
        });
    });
    // 重量・回数の変化でも保存ボタン更新
    container.querySelectorAll('.stepper-value').forEach(el => {
        el.addEventListener('change', updateSaveButtonState);
        el.addEventListener('input', updateSaveButtonState);
    });

    updateSaveButtonState();
}

/**
 * 全セットのチェック状態を一括切替（全完了 ⇔ 全解除）
 */
function toggleAllSets() {
    const checkboxes = document.querySelectorAll('.set-check-input');
    if (checkboxes.length === 0) return;
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => { cb.checked = !allChecked; });
    updateSaveButtonState();
}

/**
 * 今日のサマリーカードを描画
 * @param {object|null} dayData
 * @param {number} maxWeight
 */
function renderTodaySummary(dayData, maxWeight) {
    const el = document.getElementById('today-summary');
    if (!el) return;
    if (!dayData) { el.hidden = true; return; }

    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;
    dayData.exercises.forEach(ex => {
        const w = calcTargetWeight(maxWeight, ex.percentage_of_max);
        totalSets += ex.target_sets;
        totalReps += ex.target_sets * ex.target_reps;
        totalVolume += w * ex.target_reps * ex.target_sets;
    });

    el.hidden = false;
    el.innerHTML = `
      <div class="summary-item">
        <div class="summary-label">SETS</div>
        <div class="summary-value">${totalSets}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">REPS</div>
        <div class="summary-value">${totalReps}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">VOLUME</div>
        <div class="summary-value">${totalVolume.toLocaleString()}<small>kg</small></div>
      </div>
    `;
}

/**
 * 保存ボタンのラベル・有効状態を、現在チェックされているセットから算出して更新
 */
function updateSaveButtonState() {
    const btn = document.getElementById('save-btn');
    const label = document.getElementById('save-btn-label');
    if (!btn || !label) return;

    const checkedBoxes = document.querySelectorAll('.set-check-input:checked');
    const count = checkedBoxes.length;

    if (count === 0) {
        btn.disabled = true;
        label.textContent = '保存するセットを選択してください';
        return;
    }

    // 推定総負荷（チェック済みセットのみ）
    let vol = 0;
    checkedBoxes.forEach(cb => {
        const m = cb.id.match(/^chk-(\d+)-(\d+)$/);
        if (!m) return;
        const w = parseFloat(document.getElementById(`w-${m[1]}-${m[2]}`)?.value || '0');
        const r = parseInt(document.getElementById(`r-${m[1]}-${m[2]}`)?.value || '0', 10);
        vol += w * r;
    });

    btn.disabled = false;
    label.textContent = `💾 ${count}セット保存　(${vol.toLocaleString()}kg)`;
}

/**
 * 実績を保存
 */
function saveWorkout() {
    const programId = getSelectedProgramId();
    const weekNum = parseInt(document.getElementById('week-select')?.value || '1', 10);
    const dayNum = parseInt(document.getElementById('day-select')?.value || '1', 10);
    const maxWeight = getMaxWeight();
    const dayData = getDayData(programId, weekNum, dayNum);

    if (!dayData) return;

    const record = {
        id: Date.now(),
        date: new Date().toISOString(),
        programId: programId,
        programName: getProgramById(programId)?.name || '不明',
        week: weekNum,
        day: dayNum,
        maxWeight: maxWeight,
        exercises: []
    };

    let hasAnyCheckedSets = false;

    dayData.exercises.forEach((ex, exIdx) => {
        const sets = [];
        for (let s = 1; s <= ex.target_sets; s++) {
            const chkInput = document.getElementById(`chk-${exIdx}-${s}`);
            if (chkInput && !chkInput.checked) {
                continue; // チェックされていないセットはパス
            }
            const wInput = document.getElementById(`w-${exIdx}-${s}`);
            const rInput = document.getElementById(`r-${exIdx}-${s}`);
            const weight = parseFloat(wInput?.value || '0');
            const reps = parseInt(rInput?.value || '0', 10);
            sets.push({ set: s, weight, reps });
            hasAnyCheckedSets = true;
        }
        if (sets.length > 0) {
            record.exercises.push({
                type: ex.type,
                name: EXERCISE_NAMES[ex.type] || ex.type,
                exIdx: exIdx,
                sets: sets
            });
        }
    });

    if (!hasAnyCheckedSets) {
        showToast('保存するセットが選択されていません', 2500);
        return;
    }

    // 履歴に追加
    const history = getHistory();
    history.unshift(record);
    setHistory(history);

    showToast('✅ 実績を保存しました！');

    // 推定1RM が現在MAXを超えていればサジェスト表示
    checkMaxSuggestion();

    // 新規アチーブメント判定（保存トーストの後に出る）
    if (typeof checkAchievements === 'function') checkAchievements(true);

    // 次のDayへ自動進行
    setTimeout(() => {
        advanceToNextDay(programId, weekNum, dayNum);
    }, 1200);
}

/**
 * ステッパーの値を増減させる
 * @param {string} inputId - 対象inputのID
 * @param {number} delta - 増減量
 * @param {number} min - 最小値
 */
function adjustValue(inputId, delta, min = 0) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let val = parseFloat(input.value) || 0;
    val += delta;
    if (val < min) val = min;
    // 浮動小数点誤差対策 (ex: 2.5の倍数など)
    input.value = Math.round(val * 10) / 10;
}


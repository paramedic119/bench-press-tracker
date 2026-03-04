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

    // 保存されたWeek/Dayがあれば復元
    const savedWeek = localStorage.getItem(`${LS_KEY_WEEK}_${savedProgram}`);
    const savedDay = localStorage.getItem(`${LS_KEY_DAY}_${savedProgram}`);
    if (savedWeek) weekSelect.value = savedWeek;

    // Day選択肢を更新
    updateDayOptions();
    if (savedDay) daySelect.value = savedDay;

    programSelect.addEventListener('change', () => {
        setSelectedProgramId(programSelect.value);
        updateWeekOptions();
        updateDayOptions();
        renderMenu();
    });

    weekSelect.addEventListener('change', () => {
        const progId = getSelectedProgramId();
        localStorage.setItem(`${LS_KEY_WEEK}_${progId}`, weekSelect.value);
        updateDayOptions();
        renderMenu();
    });

    daySelect.addEventListener('change', () => {
        const progId = getSelectedProgramId();
        localStorage.setItem(`${LS_KEY_DAY}_${progId}`, daySelect.value);
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

    if (!dayData) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <div class="message">このDayのメニューはありません</div>
      </div>
    `;
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
            html += `<div class="set-row">`;
            html += `  <div class="set-number">${s}</div>`;
            html += `  <div class="set-target">`;
            html += `    <span class="weight-value">${targetWeight}kg</span> × <span class="reps-value">${ex.target_reps}回</span>`;
            html += `  </div>`;
            html += `  <div class="set-inputs">`;
            html += `    <div>`;
            html += `      <input type="number" id="w-${exIdx}-${s}" value="${targetWeight}" step="2.5" min="0" inputmode="decimal">`;
            html += `      <div class="input-label text-center">kg</div>`;
            html += `    </div>`;
            html += `    <div>`;
            html += `      <input type="number" id="r-${exIdx}-${s}" value="${ex.target_reps}" step="1" min="0" inputmode="numeric">`;
            html += `      <div class="input-label text-center">回</div>`;
            html += `    </div>`;
            html += `  </div>`;
            html += `</div>`;
        }

        html += `</div>`; // card
    });

    container.innerHTML = html;
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

    dayData.exercises.forEach((ex, exIdx) => {
        const sets = [];
        for (let s = 1; s <= ex.target_sets; s++) {
            const wInput = document.getElementById(`w-${exIdx}-${s}`);
            const rInput = document.getElementById(`r-${exIdx}-${s}`);
            const weight = parseFloat(wInput?.value || '0');
            const reps = parseInt(rInput?.value || '0', 10);
            sets.push({ set: s, weight, reps });
        }
        record.exercises.push({
            type: ex.type,
            name: EXERCISE_NAMES[ex.type] || ex.type,
            sets: sets
        });
    });

    // 履歴に追加
    const history = getHistory();
    history.unshift(record);
    setHistory(history);

    showToast('✅ 実績を保存しました！');

    // 次のDayへ自動進行
    setTimeout(() => {
        advanceToNextDay(programId, weekNum, dayNum);
    }, 1200);
}

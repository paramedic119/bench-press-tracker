/* ==================================================
   progress.js — プログラム全体の進行状況一覧
   ================================================== */

/**
 * 指定プログラムの各Week/Dayの完了状態を取得
 * @param {string} programId
 * @returns {Set<string>} "W{week}D{day}" 形式の完了済みキーセット
 */
function getCompletedDays(programId) {
    const history = getHistory();
    const completed = new Set();
    history.forEach(rec => {
        // programId が一致する場合のみカウント（古いデータも考慮して programId がない場合は BPS とみなす等の処理も可能だが、新環境優先）
        if (rec.programId === programId || (!rec.programId && programId === 'bps_bench')) {
            completed.add(`W${rec.week}D${rec.day}`);
        }
    });
    return completed;
}

/**
 * 指定プログラムで次に取り組むべきWeek/Dayを取得
 * @param {string} programId
 * @returns {{week: number, day: number}|null}
 */
function getNextDay(programId) {
    const program = getProgramById(programId);
    if (!program) return null;

    const completed = getCompletedDays(programId);
    for (const week of program.weeks) {
        for (const day of week.days) {
            const key = `W${week.week_number}D${day.day_number}`;
            if (!completed.has(key)) {
                return { week: week.week_number, day: day.day_number };
            }
        }
    }
    return null; // 全て完了
}

/**
 * 指定Week/Dayの次のDayを取得
 * @param {string} programId
 * @param {number} weekNum
 * @param {number} dayNum
 * @returns {{week: number, day: number}|null}
 */
function getFollowingDay(programId, weekNum, dayNum) {
    const program = getProgramById(programId);
    if (!program) return null;

    const weeks = program.weeks;
    const wIdx = weeks.findIndex(w => w.week_number === weekNum);
    if (wIdx === -1) return null;

    const week = weeks[wIdx];
    const dIdx = week.days.findIndex(d => d.day_number === dayNum);

    // 同じWeek内に次のDayがある
    if (dIdx !== -1 && dIdx + 1 < week.days.length) {
        return { week: weekNum, day: week.days[dIdx + 1].day_number };
    }
    // 次のWeekの最初のDay
    if (wIdx + 1 < weeks.length) {
        const nextWeek = weeks[wIdx + 1];
        if (nextWeek.days.length > 0) {
            return { week: nextWeek.week_number, day: nextWeek.days[0].day_number };
        }
    }
    return null; // プログラム終了
}

/**
 * 保存後に次のDayへ自動進行
 * @param {string} programId
 * @param {number} currentWeek
 * @param {number} currentDay
 */
function advanceToNextDay(programId, currentWeek, currentDay) {
    const next = getFollowingDay(programId, currentWeek, currentDay);
    if (!next) {
        showToast('🎉 プログラム全日程完了！おめでとう！', 4000);
        return;
    }

    const weekSelect = document.getElementById('week-select');
    const daySelect = document.getElementById('day-select');
    if (!weekSelect || !daySelect) return;

    weekSelect.value = next.week;
    localStorage.setItem(`${LS_KEY_WEEK}_${programId}`, String(next.week));
    updateDayOptions();
    daySelect.value = next.day;
    localStorage.setItem(`${LS_KEY_DAY}_${programId}`, String(next.day));
    renderMenu();

    showToast(`➡️ Week${next.week} Day${next.day} に進みました`, 3000);
}

/**
 * プログラム進行状況一覧を描画
 */
function renderProgress() {
    const container = document.getElementById('progress-container');
    if (!container) return;

    const programId = getSelectedProgramId();
    const program = getProgramById(programId);
    if (!program) {
        container.innerHTML = '<p>プログラムが見つかりません</p>';
        return;
    }

    const completed = getCompletedDays(programId);

    // 完了数 / 全Day数
    let totalDays = 0;
    program.weeks.forEach(w => { totalDays += w.days.length; });
    const completedCount = completed.size;
    const progressPct = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

    let html = '';

    // タイトル追加
    html += `<h2 class="section-title">${program.name}</h2>`;

    // プログレスバー
    html += `<div class="progress-summary">`;
    html += `  <div class="progress-label">`;
    html += `    <span>全体進捗</span>`;
    html += `    <span class="progress-fraction">${completedCount} / ${totalDays}日　<strong>${progressPct}%</strong></span>`;
    html += `  </div>`;
    html += `  <div class="progress-bar-track">`;
    html += `    <div class="progress-bar-fill" style="width: ${progressPct}%"></div>`;
    html += `  </div>`;
    html += `</div>`;

    // Week別の一覧
    program.weeks.forEach(week => {
        const weekCompleted = week.days.filter(d => completed.has(`W${week.week_number}D${d.day_number}`)).length;
        const weekTotal = week.days.length;
        const weekDone = weekCompleted === weekTotal;

        html += `<div class="progress-week ${weekDone ? 'week-done' : ''}">`;
        html += `  <div class="progress-week-header">`;
        html += `    <span class="progress-week-title">${weekDone ? '✅' : '📋'} Week ${week.week_number}</span>`;
        html += `    <span class="progress-week-count">${weekCompleted}/${weekTotal}</span>`;
        html += `  </div>`;
        html += `  <div class="progress-day-grid">`;

        week.days.forEach(day => {
            const key = `W${week.week_number}D${day.day_number}`;
            const done = completed.has(key);
            // 種目要約
            const exSummary = day.exercises.map(ex => {
                const name = EXERCISE_NAMES[ex.type] || ex.type;
                return `${name} ${ex.percentage_of_max}%`;
            }).join(', ');

            html += `<div class="progress-day-card ${done ? 'done' : ''}" `;
            html += `  onclick="navigateToDay('${programId}', ${week.week_number}, ${day.day_number})">`;
            html += `  <div class="progress-day-top">`;
            html += `    <span class="progress-day-label">Day ${day.day_number}</span>`;
            html += `    <span class="progress-day-status">${done ? '✅' : '⬜'}</span>`;
            html += `  </div>`;
            html += `  <div class="progress-day-exercises">${exSummary}</div>`;
            html += `</div>`;
        });

        html += `  </div>`;
        html += `</div>`;
    });

    container.innerHTML = html;
}

/**
 * プログラム一覧からメニュータブへ遷移
 * @param {string} programId
 * @param {number} weekNum
 * @param {number} dayNum
 */
function navigateToDay(programId, weekNum, dayNum) {
    // プログラム選択を変更
    const programSelect = document.getElementById('program-select');
    if (programSelect) {
        programSelect.value = programId;
        setSelectedProgramId(programId);
    }

    updateWeekOptions();

    // Week/Day選択を変更
    const weekSelect = document.getElementById('week-select');
    const daySelect = document.getElementById('day-select');
    if (weekSelect) {
        weekSelect.value = weekNum;
        localStorage.setItem(`${LS_KEY_WEEK}_${programId}`, String(weekNum));
    }
    updateDayOptions();
    if (daySelect) {
        daySelect.value = dayNum;
        localStorage.setItem(`${LS_KEY_DAY}_${programId}`, String(dayNum));
    }
    renderMenu();

    // メニュータブに切り替え
    switchTab('menu');
}

/**
 * プログラムIDでタブを切り替える
 * @param {string} tabId
 */
function switchTab(tabId) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const content = document.getElementById(`tab-${tabId}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
}

/* ==================================================
   program-generator.js — 履歴解析からプログラムを自動生成
   ================================================== */

const ANALYSIS_WEEKS = 12;

/**
 * 指定リフトの過去履歴を解析して統計値を返す
 * @param {string} lift - 'bench_press' / 'squat' / 'deadlift'
 * @returns {{
 *   lift: string, sessionCount: number, sessionsPerWeek: number,
 *   estMax: number, baseMax: number,
 *   avgIntensity: number, avgVolume: number, hasData: boolean
 * }}
 */
function analyzeHistoryForLift(lift) {
    const history = getHistory();
    const cutoff = Date.now() - ANALYSIS_WEEKS * 7 * 24 * 60 * 60 * 1000;

    const relevant = history.filter(rec => {
        const t = new Date(rec.date).getTime();
        if (t < cutoff) return false;
        return Array.isArray(rec.exercises) && rec.exercises.some(ex => ex.type === lift);
    });

    let estMax = 0;
    let intensitySum = 0;
    let intensityCount = 0;
    let volumeSum = 0;

    relevant.forEach(rec => {
        const recMax = (typeof rec.maxWeight === 'number' && rec.maxWeight > 0) ? rec.maxWeight : null;
        rec.exercises.forEach(ex => {
            if (ex.type !== lift) return;
            ex.sets.forEach(s => {
                const est = estimateMax(s.weight, s.reps);
                if (est > estMax) estMax = est;
                if (recMax) {
                    intensitySum += (s.weight / recMax) * 100;
                    intensityCount++;
                }
                volumeSum += s.weight * s.reps;
            });
        });
    });

    const sessionCount = relevant.length;
    const sessionsPerWeek = Math.round((sessionCount / ANALYSIS_WEEKS) * 10) / 10;
    const avgIntensity = intensityCount > 0 ? Math.round(intensitySum / intensityCount) : 0;
    const avgVolume = sessionCount > 0 ? Math.round(volumeSum / sessionCount) : 0;

    const currentMax = getMaxWeight(lift);
    const baseMax = roundWeight(Math.max(estMax, currentMax || 0, 1));

    return {
        lift,
        sessionCount,
        sessionsPerWeek,
        estMax: roundWeight(estMax),
        baseMax,
        avgIntensity,
        avgVolume,
        hasData: sessionCount > 0
    };
}

/**
 * 解析結果から推奨テンプレートを返す
 * @param {object} a - analyzeHistoryForLift の結果
 * @returns {'linear'|'volume'|'peaking'}
 */
function suggestTemplate(a) {
    if (!a.hasData) return 'linear';
    if (a.avgIntensity >= 82) return 'peaking';
    if (a.avgVolume >= 5000) return 'volume';
    return 'linear';
}

/**
 * 解析結果から推奨頻度（週N回）を返す
 */
function suggestFrequency(a) {
    if (!a.hasData) return 3;
    const f = Math.round(a.sessionsPerWeek);
    if (f < 1) return 1;
    if (f > 5) return 5;
    return f;
}

/**
 * 指定パラメータでプログラムオブジェクトを生成
 * @param {'linear'|'volume'|'peaking'} template
 * @param {string} lift
 * @param {number} daysPerWeek
 * @param {number} weeks
 * @returns {object} program data (id 無し、保存時に発行)
 */
function generateProgram(template, lift, daysPerWeek, weeks) {
    switch (template) {
        case 'volume': return _genVolume(lift, daysPerWeek, weeks);
        case 'peaking': return _genPeaking(lift, daysPerWeek, weeks);
        default: return _genLinear(lift, daysPerWeek, weeks);
    }
}

// --- テンプレート実装 ---

function _genLinear(lift, daysPerWeek, weeks) {
    // Light / Medium / Heavy のローテーションで、週ごとに +2.5% ずつ漸増
    const liftJa = LIFT_NAMES[lift] || lift;
    const prog = {
        name: `${liftJa} 線形強化 ${weeks}週`,
        description: `週${daysPerWeek}回・履歴から自動生成された線形プログラム`,
        mainLift: lift,
        weeks: []
    };
    for (let w = 1; w <= weeks; w++) {
        const days = [];
        const inc = (w - 1) * 2.5;
        for (let d = 1; d <= daysPerWeek; d++) {
            const slot = (d - 1) % 3; // 0=Light, 1=Medium, 2=Heavy
            let ex;
            if (slot === 0) {
                ex = { type: lift, target_sets: 4, target_reps: 6, percentage_of_max: Math.min(85, 67.5 + inc), is_amrap: false, rpe_target: 7 };
            } else if (slot === 1) {
                ex = { type: lift, target_sets: 5, target_reps: 3, percentage_of_max: Math.min(92.5, 80 + inc), is_amrap: false, rpe_target: 8 };
            } else {
                ex = { type: lift, target_sets: 3, target_reps: 1, percentage_of_max: Math.min(97.5, 87.5 + inc * 0.6), is_amrap: false, rpe_target: 9 };
            }
            ex.percentage_of_max = _round25(ex.percentage_of_max);
            days.push({ day_number: d, exercises: [ex] });
        }
        prog.weeks.push({ week_number: w, days });
    }
    return prog;
}

function _genVolume(lift, daysPerWeek, weeks) {
    // 高ボリューム（4-5セット × 6-10回）、最終週デロード
    const liftJa = LIFT_NAMES[lift] || lift;
    const prog = {
        name: `${liftJa} ボリューム ${weeks}週`,
        description: `週${daysPerWeek}回・履歴から自動生成された肥大重視プログラム`,
        mainLift: lift,
        weeks: []
    };
    const repScheme = [10, 8, 6, 6]; // 週ごとに rep 数を絞っていく
    for (let w = 1; w <= weeks; w++) {
        const days = [];
        const isDeload = (weeks >= 4 && w === weeks);
        const reps = repScheme[(w - 1) % repScheme.length];
        const pct = isDeload ? 60 : Math.min(80, 65 + (w - 1) * 2.5);
        for (let d = 1; d <= daysPerWeek; d++) {
            const sets = isDeload ? 2 : (d === daysPerWeek && !isDeload ? 5 : 4);
            const ex = {
                type: lift,
                target_sets: sets,
                target_reps: isDeload ? 5 : reps,
                percentage_of_max: _round25(pct),
                is_amrap: false,
                rpe_target: isDeload ? 6 : 8
            };
            days.push({ day_number: d, exercises: [ex] });
        }
        prog.weeks.push({ week_number: w, days });
    }
    return prog;
}

function _genPeaking(lift, daysPerWeek, weeks) {
    // 強度を週ごとに上げ、最終週の最終日に MAX 挑戦
    const liftJa = LIFT_NAMES[lift] || lift;
    const prog = {
        name: `${liftJa} ピーキング ${weeks}週`,
        description: `週${daysPerWeek}回・履歴から自動生成された最大筋力ピーキング`,
        mainLift: lift,
        weeks: []
    };
    for (let w = 1; w <= weeks; w++) {
        const days = [];
        const isFinalWeek = (w === weeks);
        const pctBase = 75 + (w - 1) * 4; // 週+4%
        for (let d = 1; d <= daysPerWeek; d++) {
            let ex;
            if (isFinalWeek && d === daysPerWeek) {
                // 最終日: PR 挑戦
                ex = { type: lift, target_sets: 1, target_reps: 1, percentage_of_max: 102.5, is_amrap: false, rpe_target: 10 };
            } else if (isFinalWeek) {
                // 最終週の他の日: テーパー
                ex = { type: lift, target_sets: 2, target_reps: 2, percentage_of_max: 80, is_amrap: false, rpe_target: 7 };
            } else {
                const reps = Math.max(1, 5 - Math.floor((w - 1) / 1));
                const sets = Math.max(2, 5 - (w - 1));
                ex = {
                    type: lift,
                    target_sets: sets,
                    target_reps: reps,
                    percentage_of_max: _round25(Math.min(95, pctBase)),
                    is_amrap: false,
                    rpe_target: Math.min(9, 7 + (w - 1) * 0.5)
                };
            }
            days.push({ day_number: d, exercises: [ex] });
        }
        prog.weeks.push({ week_number: w, days });
    }
    return prog;
}

function _round25(n) {
    return Math.round(n / 2.5) * 2.5;
}

// ==================================================
// UI: 生成モーダル
// ==================================================

/**
 * 生成モーダルを開く。初期リフトを引数で指定可（省略時は現在のプログラムの主種目）
 */
function openProgramGenerator(initialLift) {
    const modal = document.getElementById('program-generator-modal');
    if (!modal) return;

    const liftSel = document.getElementById('pg-lift');
    if (liftSel) liftSel.value = initialLift || (typeof getCurrentLift === 'function' ? getCurrentLift() : 'bench_press');

    _refreshGeneratorPanel();

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));
    document.body.style.overflow = 'hidden';
}

/**
 * 生成モーダルを閉じる
 */
function closeProgramGenerator() {
    const modal = document.getElementById('program-generator-modal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => { modal.hidden = true; }, 320);
    document.body.style.overflow = '';
}

/**
 * 解析カードとプレビューを最新パラメータで再描画
 */
function _refreshGeneratorPanel() {
    const lift = document.getElementById('pg-lift').value;
    const a = analyzeHistoryForLift(lift);

    // 解析カード
    const analysisEl = document.getElementById('pg-analysis');
    if (analysisEl) {
        analysisEl.innerHTML = a.hasData ? `
          <div class="pg-stat"><div class="pg-stat-label">SESSIONS</div><div class="pg-stat-value">${a.sessionCount}<small>/12週</small></div></div>
          <div class="pg-stat"><div class="pg-stat-label">EST 1RM</div><div class="pg-stat-value">${a.estMax}<small>kg</small></div></div>
          <div class="pg-stat"><div class="pg-stat-label">AVG INT</div><div class="pg-stat-value">${a.avgIntensity}<small>%</small></div></div>
          <div class="pg-stat"><div class="pg-stat-label">AVG VOL</div><div class="pg-stat-value">${(a.avgVolume / 1000).toFixed(1)}<small>k kg</small></div></div>
        ` : `
          <div class="pg-no-data">この種目の履歴がありません。標準テンプレートで生成します。</div>
        `;
    }

    // 推奨テンプレート / 頻度の自動セット（初回のみ）
    if (!_pgUserOverrodeTemplate) {
        const recommended = suggestTemplate(a);
        document.querySelectorAll('input[name="pg-template"]').forEach(r => {
            r.checked = (r.value === recommended);
        });
    }
    if (!_pgUserOverrodeFrequency) {
        const freqSel = document.getElementById('pg-frequency');
        if (freqSel) freqSel.value = String(suggestFrequency(a));
    }

    _refreshGeneratorPreview();
}

let _pgUserOverrodeTemplate = false;
let _pgUserOverrodeFrequency = false;

/**
 * プログラム内容のプレビュー（最初の数日分）を再描画
 */
function _refreshGeneratorPreview() {
    const lift = document.getElementById('pg-lift').value;
    const template = document.querySelector('input[name="pg-template"]:checked')?.value || 'linear';
    const weeks = parseInt(document.getElementById('pg-weeks').value, 10) || 4;
    const daysPerWeek = parseInt(document.getElementById('pg-frequency').value, 10) || 3;

    const prog = generateProgram(template, lift, daysPerWeek, weeks);
    const previewEl = document.getElementById('pg-preview');
    if (!previewEl) return;

    let html = `<div class="pg-preview-title">${prog.name}</div>`;
    html += `<div class="pg-preview-desc">${prog.description}</div>`;

    // 各 Week の Day 1 だけサンプル表示
    html += `<div class="pg-preview-list">`;
    prog.weeks.forEach((w, i) => {
        if (i > 3) return; // 最大4週まで
        w.days.slice(0, Math.min(2, w.days.length)).forEach(d => {
            const ex = d.exercises[0];
            const liftJa = LIFT_NAMES[ex.type] || ex.type;
            html += `<div class="pg-preview-row">`;
            html += `  <span class="pg-preview-tag">W${w.week_number}D${d.day_number}</span>`;
            html += `  <span class="pg-preview-body">${liftJa} ${ex.percentage_of_max}% × ${ex.target_reps}回 × ${ex.target_sets}セット${ex.rpe_target ? ` @${ex.rpe_target}` : ''}</span>`;
            html += `</div>`;
        });
    });
    if (prog.weeks.length > 4) {
        html += `<div class="pg-preview-row pg-preview-more">…ほか ${prog.weeks.length - 4}週分</div>`;
    }
    html += `</div>`;

    previewEl.innerHTML = html;
}

/**
 * 生成 → エディタモーダルへ受け渡し
 */
function generateAndOpenEditor() {
    const lift = document.getElementById('pg-lift').value;
    const template = document.querySelector('input[name="pg-template"]:checked')?.value || 'linear';
    const weeks = parseInt(document.getElementById('pg-weeks').value, 10) || 4;
    const daysPerWeek = parseInt(document.getElementById('pg-frequency').value, 10) || 3;

    const prog = generateProgram(template, lift, daysPerWeek, weeks);
    closeProgramGenerator();
    // 生成器の override フラグはリセット
    _pgUserOverrodeTemplate = false;
    _pgUserOverrodeFrequency = false;
    // エディタにデータを渡して開く
    if (typeof openProgramEditor === 'function') openProgramEditor(prog);
    showToast('🤖 履歴から生成しました。内容を確認して保存してください', 3500);
}

/**
 * セレクタ・ラジオの change で再描画させるためのイベント配線
 * （HTML 側 onchange からこの関数を呼ぶ）
 */
function _pgOnTemplateChange() {
    _pgUserOverrodeTemplate = true;
    _refreshGeneratorPreview();
}

function _pgOnFrequencyChange() {
    _pgUserOverrodeFrequency = true;
    _refreshGeneratorPreview();
}

function _pgOnLiftChange() {
    // リフト変更時は推奨を再計算してリセットする
    _pgUserOverrodeTemplate = false;
    _pgUserOverrodeFrequency = false;
    _refreshGeneratorPanel();
}

function _pgOnWeeksChange() {
    _refreshGeneratorPreview();
}

// ESC で閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('program-generator-modal');
        if (modal && !modal.hidden) closeProgramGenerator();
    }
});

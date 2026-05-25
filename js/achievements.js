/* ==================================================
   achievements.js — アチーブメント定義・判定・表示
   ================================================== */

const LS_KEY_ACHIEVEMENTS = 'bp_unlocked_achievements';

/**
 * 履歴を集計するユーティリティ
 */
function _getEstMaxByLift(history, lift) {
    let max = 0;
    history.forEach(rec => {
        rec.exercises.forEach(ex => {
            if (ex.type !== lift) return;
            ex.sets.forEach(s => {
                const e = estimateMax(s.weight, s.reps);
                if (e > max) max = e;
            });
        });
    });
    return max;
}

/**
 * 各レコードを ISO 週でグループ化し、最大セッション数を返す。
 * ISO 週年は「その週の木曜日が属する年」と定義されるため、
 * 単純な d.getFullYear() ではなく木曜日（firstThu）の年を採用する。
 */
function _maxSessionsInAnyWeek(history) {
    const counts = {};
    history.forEach(rec => {
        const d = new Date(rec.date);
        // d をローカル日付として UTC 0:00 に正規化
        const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = (tmp.getUTCDay() + 6) % 7; // 0=月 ... 6=日
        tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // 当該週の木曜日
        const firstThu = tmp.getTime();
        const isoYear = tmp.getUTCFullYear(); // ISO週年は木曜の年
        // その年の最初の木曜日を求める
        tmp.setUTCMonth(0, 1);
        if (tmp.getUTCDay() !== 4) {
            tmp.setUTCMonth(0, 1 + ((4 - tmp.getUTCDay()) + 7) % 7);
        }
        const week = 1 + Math.round((firstThu - tmp.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const key = `${isoYear}-W${week}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    return Math.max(0, ...Object.values(counts));
}

/**
 * いずれかのプログラムが全Day完走されているか
 */
function _anyProgramCompleted(history) {
    for (const p of PROGRAMS) {
        const need = new Set();
        p.weeks.forEach(w => w.days.forEach(d => {
            need.add(`W${w.week_number}D${d.day_number}`);
        }));
        const done = new Set();
        history.forEach(rec => {
            if (rec.programId === p.id) {
                done.add(`W${rec.week}D${rec.day}`);
            }
        });
        if (need.size > 0 && [...need].every(k => done.has(k))) return true;
    }
    return false;
}

/**
 * アチーブメント定義
 * 各 check は履歴を受け取って boolean を返す純粋関数。
 */
const ACHIEVEMENTS = [
    { id: 'first_record', icon: '🏁', title: '初記録', description: '初めて実績を保存した', check: (h) => h.length >= 1 },
    { id: 'sessions_10', icon: '📅', title: '10セッション', description: '10回のセッションを記録', check: (h) => h.length >= 10 },
    { id: 'sessions_50', icon: '🎖️', title: '50セッション', description: '50回のセッションを記録', check: (h) => h.length >= 50 },
    { id: 'sessions_100', icon: '💯', title: '100セッション', description: '100回のセッションを記録', check: (h) => h.length >= 100 },
    { id: 'weekly_3', icon: '🔱', title: '週3達成', description: '1週間に3回以上トレーニング', check: (h) => _maxSessionsInAnyWeek(h) >= 3 },
    { id: 'weekly_5', icon: '🌪️', title: '週5達成', description: '1週間に5回以上トレーニング', check: (h) => _maxSessionsInAnyWeek(h) >= 5 },
    { id: 'bench_100', icon: '💪', title: 'ベンチ 100kg', description: '推定1RMが100kgに到達', check: (h) => _getEstMaxByLift(h, 'bench_press') >= 100 },
    { id: 'bench_120', icon: '🔥', title: 'ベンチ 120kg', description: '推定1RMが120kgに到達', check: (h) => _getEstMaxByLift(h, 'bench_press') >= 120 },
    { id: 'bench_140', icon: '⚡', title: 'ベンチ 140kg', description: '推定1RMが140kgに到達', check: (h) => _getEstMaxByLift(h, 'bench_press') >= 140 },
    { id: 'squat_140', icon: '🦿', title: 'スクワット 140kg', description: '推定1RMが140kgに到達', check: (h) => _getEstMaxByLift(h, 'squat') >= 140 },
    { id: 'squat_180', icon: '🏔️', title: 'スクワット 180kg', description: '推定1RMが180kgに到達', check: (h) => _getEstMaxByLift(h, 'squat') >= 180 },
    { id: 'deadlift_160', icon: '🛢️', title: 'デッド 160kg', description: '推定1RMが160kgに到達', check: (h) => _getEstMaxByLift(h, 'deadlift') >= 160 },
    { id: 'deadlift_200', icon: '🐂', title: 'デッド 200kg', description: '推定1RMが200kgに到達', check: (h) => _getEstMaxByLift(h, 'deadlift') >= 200 },
    { id: 'program_complete', icon: '🏆', title: 'プログラム完走', description: 'プログラムを完走', check: (h) => _anyProgramCompleted(h) }
];

/**
 * アンロック済みIDの Set を取得
 * @returns {Set<string>}
 */
function getUnlockedAchievements() {
    const stored = _getData(LS_KEY_ACHIEVEMENTS);
    try {
        const arr = stored ? JSON.parse(stored) : [];
        return new Set(arr);
    } catch (e) {
        return new Set();
    }
}

/**
 * アンロック済みIDを保存
 */
function setUnlockedAchievements(set) {
    _setData(LS_KEY_ACHIEVEMENTS, JSON.stringify(Array.from(set)));
}

/**
 * 全アチーブメントを判定し、新規アンロックがあれば保存・通知。
 * @param {boolean} announce - true ならトーストを順次表示
 * @returns {Array<object>} 新規アンロック分
 */
function checkAchievements(announce = true) {
    const history = getHistory();
    const unlocked = getUnlockedAchievements();
    const newly = [];

    ACHIEVEMENTS.forEach(ach => {
        if (unlocked.has(ach.id)) return;
        try {
            if (ach.check(history)) {
                unlocked.add(ach.id);
                newly.push(ach);
            }
        } catch (e) {
            console.error('アチーブメント判定エラー:', ach.id, e);
        }
    });

    if (newly.length > 0) {
        setUnlockedAchievements(unlocked);
        if (announce) _announceAchievements(newly);
        // 設定タブ表示中なら一覧も更新
        renderAchievements();
    }
    return newly;
}

/**
 * 新規アンロックを順次トーストで表示。トーストキュー側で順番に出してくれるので
 * ここでは即時 enqueue する。バイブは最初の1回のみ。
 */
function _announceAchievements(achievements) {
    if (achievements.length > 0 && navigator.vibrate) navigator.vibrate(80);
    achievements.forEach(ach => {
        showToast(`${ach.icon} 達成解除: ${ach.title}`, 2800);
    });
}

/**
 * 設定タブのアチーブメント一覧を描画
 */
function renderAchievements() {
    const container = document.getElementById('achievements-list');
    if (!container) return;

    const unlocked = getUnlockedAchievements();
    const unlockedCount = ACHIEVEMENTS.filter(a => unlocked.has(a.id)).length;
    const total = ACHIEVEMENTS.length;
    const pct = Math.round((unlockedCount / total) * 100);

    let html = '';
    html += `<div class="ach-progress-row">`;
    html += `  <div class="ach-progress-label"><strong>${unlockedCount}</strong> / ${total} 達成</div>`;
    html += `  <div class="ach-progress-bar-track">`;
    html += `    <div class="ach-progress-bar-fill" style="width: ${pct}%"></div>`;
    html += `  </div>`;
    html += `</div>`;

    html += `<div class="ach-grid">`;
    ACHIEVEMENTS.forEach(ach => {
        const isUnlocked = unlocked.has(ach.id);
        html += `
          <div class="ach-item ${isUnlocked ? 'unlocked' : 'locked'}" title="${ach.description}">
            <div class="ach-icon">${ach.icon}</div>
            <div class="ach-title">${ach.title}</div>
          </div>
        `;
    });
    html += `</div>`;

    container.innerHTML = html;
}

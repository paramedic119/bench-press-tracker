/**
 * ワークアウト画面。週 → 日 → セッションカードの3階層。
 */
import { PROGRAM, BY_ID, EX, EX_SHORT, TEST_WEEKS, FINAL_TEST_ID, MKEY, isMaxTest,
         computePlan, e1rm, suggestW, roundTo, bestOf, sessionVolume, warmupSets,
         weekProgress, dayProgress, isDayDone, isSessionDone, sessionDate,
         fmt, fmtKg, fmtSigned, fmtKgSigned } from '../../core/index.js';
import { $, $inp, $ta, qsa, esc, fmtDate, dataNum, dataStr } from '../dom.js';
import { S, save } from '../store.js';
import { onStateReplaced } from '../events.js';
import { haptic, unlockAudio, toast, withUndo } from '../feedback.js';
import { ask } from '../dialog.js';
import { autoRest, stopTimer } from '../timer.js';
import { clampInput } from '../stepper.js';
import { plateHTML } from '../plate-view.js';
import { renderHead } from '../header.js';
import { startNextCycle } from '../cycle.js';

const dayExLabel = (w, d) => [...new Set(PROGRAM.filter(s=>s.week===w && s.day===d).map(s=>EX_SHORT[s.ex]))].join('・');

export function renderWorkout(){
  const plan = computePlan(S.maxes, {adaptive:S.adaptive, logs:S.logs});
  const {week, day} = S.ui;
  /* 再描画をまたいで、開いているパネルの状態を保つ */
  const openLogs = new Set(qsa($('sessions'), '.logarea.open').map(e => e.id));
  const openWu = new Set(qsa($('sessions'), 'details.wu[open]').map(e => e.dataset.wu));

  /* --- 週ストリップ --- */
  $('weekstrip').innerHTML = Array.from({length:12}, (_, i) => {
    const w = i+1, pr = weekProgress(S.sets, w);
    return `<button class="wchip ${pr.state} ${week===w?'sel':''}" data-w="${w}" role="tab"
        aria-selected="${week===w}" aria-label="第${w}週${pr.state==='done'?' 完了':''}"
        style="--p:${Math.round(pr.ratio*100)}%">W<span class="num">${w}</span>
        ${TEST_WEEKS.includes(w)?'<span class="tst"></span>':''}<span class="dot"></span></button>`;
  }).join('');
  for(const b of qsa($('weekstrip'), '.wchip')) b.onclick = () => {
    S.ui.week = dataNum(b, 'w'); S.ui.day = 1; save(); renderWorkout(); haptic();
  };
  const sel = $('weekstrip').querySelector('.wchip.sel');
  if(sel) sel.scrollIntoView({block:'nearest', inline:'center', behavior:'smooth'});

  /* --- 週ラベル --- */
  const isTest = TEST_WEEKS.includes(week);
  const wp = weekProgress(S.sets, week);
  $('weeklabel').innerHTML = isTest
    ? `<span class="tag test">テスト週</span><span>RPE10シングルで推定MAXを更新</span>`
    : `<span class="tag">蓄積フェーズ</span><span>RPEを守って出し切らない</span>`;
  $('weeklabel').innerHTML += `<span style="margin-left:auto;white-space:nowrap">${wp.done}/${wp.total} セット</span>`;

  /* --- Dayタブ --- */
  $('daytabs').innerHTML = [1,2,3].map(d => {
    const done = isDayDone(S.sets, week, d), pr = dayProgress(S.sets, week, d);
    return `<button class="dtab ${day===d?'sel':''} ${done?'done':''}" data-d="${d}" role="tab"
      aria-selected="${day===d}">Day ${d}${done?' ✓':''}
      <small>${done ? dayExLabel(week,d) : `${pr.done}/${pr.total} · ${dayExLabel(week,d)}`}</small></button>`;
  }).join('');
  for(const b of qsa($('daytabs'), '.dtab')) b.onclick = () => {
    S.ui.day = dataNum(b, 'd'); save(); renderWorkout(); haptic();
  };

  /* --- セッションカード --- */
  const list = PROGRAM.filter(s => s.week===week && s.day===day);
  $('sessions').innerHTML = list.map(s => {
    const raw = plan.W[s.id], w = roundTo(raw, S.round);
    const logs = Array.isArray(S.logs[s.id]) ? S.logs[s.id] : [];
    const done = isSessionDone(S.sets, s);
    const hasLog = logs.some(x => x && x.w>0);
    const test = isMaxTest(s);
    const pl = plateHTML(w);

    const setsHtml = Array.from({length:s.sets}, (_, i) =>
      `<button class="setbtn ${(S.sets[s.id]||[])[i]?'on':''} ${logs[i]?'logged':''}"
        data-sid="${s.id}" data-i="${i}" type="button"
        aria-pressed="${!!(S.sets[s.id]||[])[i]}" aria-label="セット${i+1}${(S.sets[s.id]||[])[i]?' 完了':''}">${i+1}</button>`).join('');

    /* セット毎ログ行 + 次セット推奨 */
    let rows = '';
    for(let i=0; i<s.sets; i++){
      const lg = logs[i];
      /** @type {LogEntry | null} */
      let prevLogged = null;
      for(let j = i-1; j >= 0; j--){ const x = logs[j]; if(x && x.w > 0){ prevLogged = x; break; } }
      const preW = lg ? lg.w
        : prevLogged ? roundTo(suggestW(e1rm(prevLogged.w, prevLogged.reps, prevLogged.rpe), s.reps, s.rpe), S.round)
        : w;
      const st = (kind, id, extra='') =>
        `<button class="stepbtn" type="button" data-step="${id}" data-kind="${kind}" data-dir="-1" aria-label="減らす" tabindex="-1">－</button>
         ${extra}
         <button class="stepbtn" type="button" data-step="${id}" data-kind="${kind}" data-dir="1" aria-label="増やす" tabindex="-1">＋</button>`;
      rows += `<div class="setlog">
        <span class="setno num">${i+1}</span>
        <div class="stepper stw">${st('w', `lw-${s.id}-${i}`,
          `<input type="number" inputmode="decimal" step="0.5" id="lw-${s.id}-${i}" value="${fmtKg(preW)}" aria-label="セット${i+1}の重量 kg">`)}</div>
        <div class="stepper str">${st('r', `lr-${s.id}-${i}`,
          `<input type="number" inputmode="numeric" id="lr-${s.id}-${i}" value="${lg?lg.reps:s.reps}" aria-label="セット${i+1}の回数">`)}</div>
        <div class="stepper stp">${st('p', `lp-${s.id}-${i}`,
          `<input type="number" inputmode="decimal" step="1" min="5" max="10" id="lp-${s.id}-${i}" value="${lg?fmt(lg.rpe):fmt(s.rpe)}" aria-label="セット${i+1}のRPE">`)}</div>
        <button class="setok ${lg?'on':''}" type="button" data-slog="${s.id}" data-i="${i}"
          aria-label="セット${i+1}を${lg?'取り消す':'記録する'}">${lg?'✓':'＋'}</button>
      </div>`;
      if(lg && lg.w>0 && i<s.sets-1){
        const e = e1rm(lg.w, lg.reps, lg.rpe);
        const nw = roundTo(suggestW(e, s.reps, s.rpe), S.round);
        const diff = nw - roundTo(lg.w, S.round);
        rows += `<div class="suggest">→ 次セット推奨 <b>${fmtKg(nw)}kg</b>${Math.abs(diff)>=0.01?`（${fmtKgSigned(diff)}kg）`:'（維持）'} ・ e1RM ${fmt(e)}</div>`;
      }
    }

    const be = bestOf(logs), dt = sessionDate(S, s.id);
    const {vol, adj} = sessionVolume(raw, s);
    const wu = S.warmup ? warmupSets(w, S.bar, S.round) : [];

    return `<div class="card ${done?'completed':''}">
      ${test?'<span class="testbadge">MAX TEST</span>':''}
      <div class="exrow"><span class="ex">${EX[s.ex]}</span>
        <span class="e1rm">目標e1RM <b>${fmt(plan.H[s.id])}</b> kg</span></div>
      <div class="bigw">
        <span class="kg num ${done?'done':''}">${fmtKg(w)}</span><span class="unit">kg</span>
        <span class="scheme"><span class="rs num">${s.reps}×${s.sets}</span><br><span class="rpe">@RPE ${fmt(s.rpe)}</span></span>
      </div>
      ${S.round>0 && Math.abs(w-raw)>0.01 ? `<div class="meta">計算値 ${raw.toFixed(1)}kg → ${fmtKg(S.round)}kg刻みに丸め</div>` : ''}
      <div class="meta">総Vol ${Math.round(vol).toLocaleString()}kg ・ 補正Vol ${Math.round(adj).toLocaleString()}kg</div>
      <div class="plates" aria-hidden="true">${pl.bar}</div>
      <div class="meta${pl.warn?' ':''}" style="${pl.warn?'color:var(--warn)':''}">${esc(pl.label)}</div>
      ${wu.length ? `<details class="wu" data-wu="${s.id}"${openWu.has(String(s.id))?' open':''}>
        <summary><svg class="chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1l4 4-4 4" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ウォームアップ ${wu.length}セット</summary>
        ${wu.map(x => `<div class="wurow"><span class="wkg num">${fmtKg(x.w)}</span><span class="wx">kg × ${x.reps}</span>
          <span class="wp">${x.isBar?'バーのみ':`${x.pct}%`}</span></div>`).join('')}
      </details>` : ''}
      <div class="sets">${setsHtml}</div>
      ${be!==null ? `<div class="logresult">${dt?fmtDate(dt)+' ・ ':''}ベスト e1RM <b>${fmt(be)}kg</b>${S.adaptive?' → 以降のセッションに反映中':''}</div>` : ''}
      ${be===null && done && dt ? `<div class="donedate">${fmtDate(dt)} 完了</div>` : ''}
      <button class="logtoggle ${hasLog?'has':''}" type="button" data-log="${s.id}"
        aria-expanded="${openLogs.has('log-'+s.id) || (hasLog && !done)}" aria-controls="log-${s.id}">${hasLog?'セット記録を編集':'セット毎に記録（任意）'}</button>
      <div class="logarea ${openLogs.has('log-'+s.id) || (hasLog && !done) ? 'open':''}" id="log-${s.id}">
        <div class="loghead" aria-hidden="true"><span class="h-no"></span><span class="h-w">重量 kg</span><span class="h-r">回数</span><span class="h-p">RPE</span><span class="h-ok"></span></div>
        ${rows}
        ${hasLog ? `<button class="logclear" type="button" data-clear="${s.id}">この種目の記録を削除</button>` : ''}
      </div>
      ${s.id===FINAL_TEST_ID && (hasLog||done) ? `<button class="nextcycle" type="button" data-next>この結果で次のサイクルを開始 →</button>` : ''}
    </div>`;
  }).join('');

  bindWorkoutHandlers();
  renderNote();
}

/** その日のセットが全部埋まったらお祝いしてタイマーを止める */
function celebrateIfDayDone(){
  if(!isDayDone(S.sets, S.ui.week, S.ui.day)) return false;
  stopTimer();
  haptic([40, 60, 40, 60, 120]);
  toast(`Week ${S.ui.week} Day ${S.ui.day} 完了！お疲れさまでした`);
  return true;
}

function bindWorkoutHandlers(){
  const root = $('sessions');

  for(const b of qsa(root, '.setbtn')) b.onclick = () => {
    const id = dataNum(b, 'sid'), i = dataNum(b, 'i');
    const s = BY_ID.get(id);
    const arr = S.sets[id] = S.sets[id] || [];
    const wasOn = !!arr[i];
    const hadLog = Array.isArray(S.logs[id]) && S.logs[id][i];
    if(wasOn && hadLog){
      withUndo('セットの記録も削除しました', () => {
        arr[i] = false; S.logs[id][i] = null;
        if(S.logs[id].every(x => !x)) delete S.logs[id];
      });
      return;
    }
    arr[i] = wasOn ? false : Date.now();
    save(); haptic(wasOn ? 6 : 14);
    unlockAudio();
    renderWorkout(); renderHead();
    if(!wasOn && !celebrateIfDayDone()) autoRest(s);
  };

  for(const b of qsa(root, '.logtoggle')) b.onclick = () => {
    const el = $('log-' + dataStr(b, 'log'));
    const open = el.classList.toggle('open');
    b.setAttribute('aria-expanded', String(open));
  };

  for(const b of qsa(root, '[data-slog]')) b.onclick = () => {
    const id = dataNum(b, 'slog'), i = dataNum(b, 'i');
    const s = BY_ID.get(id);
    const logs = Array.isArray(S.logs[id]) ? S.logs[id] : [];

    if(logs[i] && logs[i].w > 0){                    /* 記録済み → タップで解除 */
      withUndo('記録を取り消しました', () => {
        logs[i] = null; S.logs[id] = logs;
        S.sets[id] = S.sets[id] || []; S.sets[id][i] = false;
        if(logs.every(x => !x)) delete S.logs[id];
      });
      return;
    }
    const w = clampInput($(`lw-${id}-${i}`), 'w');
    const reps = clampInput($(`lr-${id}-${i}`), 'r');
    const rpe = clampInput($(`lp-${id}-${i}`), 'p');
    if(!(w > 0)){ toast('重量を入力してください'); return; }

    logs[i] = {w, reps, rpe, t: Date.now()};
    S.logs[id] = logs;
    S.sets[id] = S.sets[id] || []; S.sets[id][i] = Date.now();
    save(); haptic(14); unlockAudio();
    renderWorkout(); renderHead();

    /* テスト日(1rep@RPE10)の記録が現MAXを超えたら自己ベスト通知 */
    if(s && isMaxTest(s)){
      const e = e1rm(w, reps, rpe), cur = S.maxes[MKEY[s.ex]];
      if(e > cur + 1e-9){
        haptic([30, 50, 30, 50, 180]);
        toast(`自己ベスト更新！ 推定1RM ${fmt(e)}kg（MAX ${fmtSigned(e-cur)}kg）`);
        if(!isDayDone(S.sets, S.ui.week, S.ui.day)) autoRest(s);
        return;
      }
    }
    if(!celebrateIfDayDone()) autoRest(s);
  };

  for(const b of qsa(root, '[data-clear]')) b.onclick = async () => {
    const id = dataNum(b, 'clear'), s = BY_ID.get(id);
    if(!s) return;
    if(!await ask({title:'記録を削除', body:`<b>${esc(EX[s.ex])}</b> のセット記録をすべて削除します。`,
      ok:'削除', danger:true})) return;
    withUndo('記録を削除しました', () => {
      delete S.logs[id];
      if(S.sets[id]) S.sets[id] = S.sets[id].map(()=>false);
    });
  };

  for(const b of qsa(root, '[data-next]')) b.onclick = startNextCycle;
}

/* --- セッションノート（体重・メモ） --- */
let noteTimer = null, noteKey = null;
/* 状態が差し替わったら作り直す。同じ週・日だと key が変わらず、
   古いメモを表示したまま書き戻してしまうため。 */
onStateReplaced(() => { noteKey = null; });
function renderNote(){
  const key = `${S.ui.week}-${S.ui.day}`;
  if(key === noteKey && $('notecard').children.length) return;   /* 入力中に作り直さない */
  noteKey = key;
  const n = S.notes[key] || {};
  $('notecard').innerHTML = `
    <div class="noterow">
      <label for="noteBw">体重 (kg)</label>
      <div class="stepper">
        <button class="stepbtn" type="button" data-step="noteBw" data-kind="bw" data-dir="-1" aria-label="体重を減らす" tabindex="-1">－</button>
        <input type="number" inputmode="decimal" step="0.1" id="noteBw" value="${n.bw?fmt(n.bw):''}" placeholder="—" aria-label="体重 kg">
        <button class="stepbtn" type="button" data-step="noteBw" data-kind="bw" data-dir="1" aria-label="体重を増やす" tabindex="-1">＋</button>
      </div>
    </div>
    <textarea id="noteText" placeholder="今日の調子・フォームの気づき・コンディションなど" aria-label="セッションのメモ">${esc(n.text||'')}</textarea>`;

  const commit = () => {
    const bw = +$inp('noteBw').value, text = $ta('noteText').value;
    if(!text && !(bw > 0)){ delete S.notes[key]; }
    else S.notes[key] = {text, ...(bw>0 ? {bw} : {}), t: Date.now()};
    save();
  };
  const debounced = () => { clearTimeout(noteTimer); noteTimer = setTimeout(commit, 400); };
  $ta('noteText').addEventListener('input', debounced);
  for(const ev of ['input', 'stepped']) $inp('noteBw').addEventListener(ev, debounced);
  $inp('noteBw').addEventListener('blur', commit);
}

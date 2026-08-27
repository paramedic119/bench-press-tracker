/**
 * 履歴画面。続けられているかどうかを、数字とカレンダーの両方で返す。
 */
import { PROGRAM, EX, MKEY, bestOf, isSessionDone, sessionDate,
         trainingDays, weekStreak, dayKeyOf, fmt, fmtKg, fmtKgSigned } from '../../core/index.js';
import { $, esc, setShown } from '../dom.js';
import { S } from '../store.js';

export function renderHistory(){
  const dayMap = trainingDays(S);
  const now = Date.now();
  const streak = weekStreak(dayMap, now);
  const thisMonth = [...dayMap.keys()].filter(k => k.startsWith(dayKeyOf(now).slice(0,7))).length;
  const totalSessions = [...dayMap.values()].reduce((a,b)=>a+b, 0);

  $('histStats').innerHTML = `
    <div class="stat"><div class="lbl">連続トレ週</div><div class="val num">${streak}<small> 週</small></div>
      <div class="delta${streak?'':' flat'}">${streak >= 4 ? 'good pace' : streak ? '継続中' : '今週から再開'}</div></div>
    <div class="stat"><div class="lbl">今月のトレ日</div><div class="val num">${thisMonth}<small> 日</small></div>
      <div class="delta flat">${new Date(now).getMonth()+1}月</div></div>
    <div class="stat"><div class="lbl">通算セッション</div><div class="val num">${totalSessions}</div>
      <div class="delta flat">サイクル${S.cycle.n}まで</div></div>`;

  /* ヒートマップ：直近18週（月曜始まり） */
  const monday = new Date(now); monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate() - ((monday.getDay()+6)%7));
  const weeks = 18, todayKey = dayKeyOf(now);
  let heat = '', months = [];
  for(let w = weeks-1; w >= 0; w--){
    const colStart = new Date(monday); colStart.setDate(colStart.getDate() - w*7);
    months.push(colStart.getMonth()+1);
    let col = '';
    for(let d = 0; d < 7; d++){
      const dt = new Date(colStart); dt.setDate(dt.getDate()+d);
      const k = dayKeyOf(dt.getTime()), n = dayMap.get(k) || 0;
      const cls = [n ? 'on' : '', n >= 3 ? 'n2' : '', k === todayKey ? 'today' : '',
        dt.getTime() > now ? 'future' : ''].filter(Boolean).join(' ');
      col += `<div class="hc ${cls}" title="${k}${n?` ・ ${n}セッション`:''}"></div>`;
    }
    heat += `<div class="hcol">${col}</div>`;
  }
  $('heat').innerHTML = heat;
  $('heatax').innerHTML = `<span>${months[0]}月</span><span>${months[Math.floor(weeks/2)]}月</span><span>今週</span>`;

  /* 記録したセッション（現サイクル・新しい順） */
  const items = PROGRAM.flatMap(s => {
    const logs = S.logs[s.id], t = sessionDate(S, s.id);
    if(!t) return [];
    /** @type {LogEntry | null} */
    let top = null;
    if(Array.isArray(logs)) for(const x of logs) if(x && (!top || x.w > top.w)) top = x;
    return [{s, t, be: bestOf(logs), top, done: isSessionDone(S.sets, s)}];
  }).sort((a, b) => b.t - a.t).slice(0, 30);

  $('histList').innerHTML = items.length ? items.map(it => {
    const d = new Date(it.t);
    return `<div class="hitem">
      <div class="hdate"><div class="d num">${d.getDate()}</div><div class="m">${d.getMonth()+1}月</div></div>
      <div class="hbody">
        <div class="htitle">${esc(EX[it.s.ex])} <span style="color:var(--muted);font-weight:400">W${it.s.week} D${it.s.day}</span></div>
        <div class="hsub">${it.top ? `トップセット ${fmtKg(it.top.w)}kg × ${it.top.reps} @RPE${fmt(it.top.rpe)}`
          : `${it.s.reps}×${it.s.sets} @RPE${fmt(it.s.rpe)}${it.done?' ・ 完了':''}`}</div>
      </div>
      ${it.be !== null ? `<div class="hval"><div class="v">${fmt(it.be)}</div><div class="k">e1RM</div></div>`
        : `<div class="hval"><div class="v" style="color:var(--ok)">✓</div><div class="k">完了</div></div>`}
    </div>`;
  }).join('') : `<div class="empty"><span class="big">🏋️</span>まだ記録がありません。<br>ワークアウト画面でセットに ✓ を付けると、ここに残ります。</div>`;

  /* 過去のサイクル */
  const hasHist = S.history.length > 0;
  setShown($('cycHead'), hasHist);
  $('cycList').innerHTML = !hasHist ? '' : S.history.slice().reverse().map(h => {
    const period = `${new Date(h.started).toLocaleDateString('ja-JP')} 〜 ${new Date(h.ended).toLocaleDateString('ja-JP')}`;
    const lines = Object.keys(MKEY).map(ex => {
      const k = MKEY[ex], a = h.maxesStart?.[k], b = h.maxesEnd?.[k];
      if(typeof a !== 'number' || typeof b !== 'number') return '';
      const d = b - a, cls = d > 0 ? 'up' : d < 0 ? 'dn' : '';
      return `<div class="cl"><span>${esc(EX[ex])}</span><b>${fmtKg(a)} → ${fmtKg(b)} <span class="${cls}">${fmtKgSigned(d)}</span></b></div>`;
    }).join('');
    return `<div class="cyccard"><div class="ct"><b>サイクル ${h.n}</b><span>${period}</span></div>${lines}</div>`;
  }).join('');
}
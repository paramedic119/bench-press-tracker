/**
 * サイクルの締めと繰り越し。記録をアーカイブし、ベストe1RMを新しいMAXにする。
 */
import { cycleBestOf, MKEY, EX, fmtKg, fmtKgSigned } from '../core/index.js';
import { esc } from './dom.js';
import { S } from './store.js';
import { ask } from './dialog.js';
import { withUndo } from './feedback.js';
import { stopTimer } from './timer.js';

export async function startNextCycle(){
  const best = cycleBestOf(S.logs), old = {...S.maxes};
  /** @type {Maxes} */
  const nm = /** @type {any} */ ({});
  for(const ex in MKEY){
    const k = MKEY[ex];
    nm[k] = best[ex] !== null ? Math.round(best[ex]*2)/2 : old[k];   /* 0.5kg刻み・記録なしは現状維持 */
  }
  const rowsHtml = Object.keys(MKEY).map(ex => {
    const k = MKEY[ex], d = nm[k] - old[k];
    const cls = d > 0 ? 'up' : d < 0 ? 'dn' : '';
    return `<div class="cl"><span>${esc(EX[ex])}</span><b>${fmtKg(old[k])} → ${fmtKg(nm[k])} kg
      <span class="${cls}">(${fmtKgSigned(d)})</span></b></div>`;
  }).join('');
  const okd = await ask({
    title: `サイクル${S.cycle.n}を完了`,
    body: `記録をアーカイブして、新しいMAXでWeek 1から再開します。<div style="margin-top:10px">${rowsHtml}</div>
      <div style="margin-top:10px;font-size:.74rem;color:var(--muted)">MAXはあとから設定で変更できます。今の記録は「履歴」に残ります。</div>`,
    ok: '次のサイクルを開始',
  });
  if(!okd) return;
  withUndo(`サイクル${S.cycle.n + 1}を開始しました`, () => {
    S.history.push({n:S.cycle.n, started:S.cycle.started, ended:Date.now(),
      maxesStart:old, maxesEnd:nm, best, logs:S.logs, sets:S.sets});
    S.maxes = nm; S.logs = {}; S.sets = {}; S.notes = {};
    S.cycle = {n:S.cycle.n + 1, started:Date.now()};
    S.ui.week = 1; S.ui.day = 1;
    stopTimer();
  });
}

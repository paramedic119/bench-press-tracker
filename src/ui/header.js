/**
 * ヘッダー。サイクル全体の進み具合をリングで示す。
 */
import { cycleProgress, sessionDate, PROGRAM, present } from '../core/index.js';
import { $ } from './dom.js';
import { S } from './store.js';

export function renderHead(){
  const pr = cycleProgress(S.sets);
  const days = PROGRAM.map(s => sessionDate(S, s.id)).filter(present);
  const last = days.length ? Math.max(...days) : null;
  const gap = last !== null ? Math.floor((Date.now() - last)/864e5) : null;
  const gapTxt = gap === null ? '記録なし' : gap === 0 ? '今日トレ済み' : `前回から${gap}日`;
  $('headSub').textContent =
    `サイクル${S.cycle.n} ・ W${S.ui.week} D${S.ui.day} ・ ${pr.done} / ${pr.total} セット ・ ${gapTxt}`;
  const C = 2 * Math.PI * 18.2;
  const ringBar = /** @type {SVGElement | null} */ ($('appHeader').querySelector('.ring .bar'));
  if(!ringBar) return;
  ringBar.setAttribute('stroke-dasharray', `${(C*pr.ratio).toFixed(1)} ${C.toFixed(1)}`);
  ringBar.style.opacity = pr.ratio > 0 ? '1' : '0';   /* 0% で丸キャップが点として残らないように */
  $('ringPct').textContent = Math.round(pr.ratio*100) + '%';
}

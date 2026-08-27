/**
 * − / ＋ ステッパー。長押しで連続変化する。
 * ボタンは全ページに散らばるので、document 1箇所に委譲して束ねる。
 */
import { fmtKg, stepValue } from '../core/index.js';
import { $inp, dataStr, dataNum } from './dom.js';
import { S } from './store.js';
import { haptic } from './feedback.js';

/** 押しっぱなしを連続変化に切り替えるまでの時間と、その間隔 */
const REPEAT_DELAY = 420, REPEAT_INTERVAL = 80;

function applyStep(btn){
  const inp = $inp(dataStr(btn, 'step'));
  const kind = dataStr(btn, 'kind');
  const v = stepValue(kind, +inp.value || 0, dataNum(btn, 'dir'), S.round);
  inp.value = kind === 'sec' ? String(v) : fmtKg(v);
  inp.dispatchEvent(new Event('stepped'));
}

/** 入力欄を範囲内に収める（手入力対策）。確定後の値を返す。 */
export function clampInput(inp, kind){
  const v = stepValue(kind, +inp.value || 0, 0, S.round);
  inp.value = kind === 'sec' ? String(v) : fmtKg(v);
  return v;
}

/** ステッパー1組ぶんの HTML。input は id で参照するので呼び出し側が一意な id を渡す。 */
export function stepperHTML(id, kind, value, {aria = '', attrs = '', cls = ''} = {}){
  const btn = dir => `<button class="stepbtn" type="button" data-step="${id}" data-kind="${kind}" `
    + `data-dir="${dir}" aria-label="${dir > 0 ? '増やす' : '減らす'}" tabindex="-1">${dir > 0 ? '＋' : '－'}</button>`;
  return `<div class="stepper${cls ? ' ' + cls : ''}">${btn(-1)}`
    + `<input type="number" inputmode="decimal" id="${id}" value="${value}" aria-label="${aria}" ${attrs}>`
    + `${btn(1)}</div>`;
}

export function initSteppers(){
  document.addEventListener('pointerdown', e => {
    const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-step]'));
    if(!b) return;
    e.preventDefault();
    applyStep(b); haptic(5);

    let iv = null;
    const to = setTimeout(() => { iv = setInterval(() => applyStep(b), REPEAT_INTERVAL); }, REPEAT_DELAY);
    const end = () => {
      clearTimeout(to); if(iv) clearInterval(iv);
      removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      b.removeEventListener('pointerleave', end);
      /* 値を状態へ書き戻すのは押し終わったあと（連打中に再描画で要素が消えないように） */
      b.dispatchEvent(new CustomEvent('stepend', {bubbles: true}));
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    b.addEventListener('pointerleave', end);
  });
}

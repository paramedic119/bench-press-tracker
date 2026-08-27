/**
 * 触覚・音・トースト・取り消し。
 * どれも「操作が届いた」ことを返すための層で、失敗しても本筋を止めない。
 */
import { migrate } from '../core/index.js';
import { $ } from './dom.js';
import { S, replaceState, save, saveNow } from './store.js';
import { requestRender } from './events.js';

/** @param {number | number[]} pattern */
export const haptic = (pattern = 8) => { try{ navigator.vibrate?.(pattern); }catch(e){} };

/** @type {AudioContext | null} */
let audioCtx = null;

export function beep(){
  if(!S.rest.sound) return;
  try{
    const ctx = audioCtx = audioCtx || new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    if(ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    [0, .18, .36].forEach((off, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = i === 2 ? 1046.5 : 784;
      g.gain.setValueAtTime(0, t0 + off);
      g.gain.linearRampToValueAtTime(.22, t0 + off + .02);
      g.gain.exponentialRampToValueAtTime(.001, t0 + off + .16);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + off); o.stop(t0 + off + .18);
    });
  }catch(e){}
}

/** タイマー音のためにオーディオを解錠する（ユーザー操作の中でのみ有効） */
export function unlockAudio(){
  if(audioCtx || !S.rest.sound) return;
  try{
    audioCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
  }catch(e){}
}

let toastTimer = null;

/**
 * 短い通知。`undo` を渡すと「元に戻す」が出る。
 * 追加のボタンを足したいときは戻り値の要素に append する。
 * @param {string} msg
 * @param {{undo?: (() => void) | null, ms?: number}} [opts]
 */
export function toast(msg, {undo = null, ms = undo ? 6000 : 2400} = {}){
  const el = $('toast');
  const msgEl = el.querySelector('.tmsg');
  if(msgEl) msgEl.textContent = msg;
  el.querySelector('.tundo')?.remove();
  if(undo) appendToastAction('元に戻す', () => { hideToast(); undo(); });
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  return el;
}

/** トーストに操作ボタンを足す（更新・再読み込みなど） */
export function appendToastAction(label, onClick){
  const b = document.createElement('button');
  b.className = 'tundo'; b.type = 'button'; b.textContent = label;
  b.onclick = onClick;
  $('toast').appendChild(b);
  return b;
}

export function hideToast(){
  clearTimeout(toastTimer);
  $('toast').classList.remove('show');
}

/**
 * 状態のスナップショットを取り、取り消し可能な変更を行う。
 * 破壊的操作はすべてこれを通す。
 */
export function withUndo(msg, mutate){
  const snap = JSON.stringify(S);
  mutate();
  save(); requestRender();
  toast(msg, {undo(){
    replaceState(migrate(JSON.parse(snap), Date.now()));   /* 差し替えの通知は replaceState が出す */
    saveNow();
    requestRender();
    toast('元に戻しました');
  }});
}

/**
 * インターバルタイマーの表示。状態そのものは core/timer.js が持つ。
 */
import { mmss, restSecondsFor, EX, fmt,
         startRest, adjustRest, restView, restoreRest, shouldFireRest, shouldClearRest } from '../core/index.js';
import { $ } from './dom.js';
import { S, TKEY, storage } from './store.js';
import { beep, haptic, toast } from './feedback.js';

const DIAL_CIRCUMFERENCE = 103;   /* r=16.4 の円周。CSS 側の値と揃えること */

/** @type {import('../core/timer.js').RestState | null} */
let state = null;
let tick = null;

const persist = () => storage.writeRaw(TKEY, state
  ? JSON.stringify({endsAt: state.endsAt, total: state.total, label: state.label}) : null);

export function startTimer(sec, label){
  const next = startRest(sec, label, Date.now());
  if(!next) return;
  state = next; persist(); run();
}

/** セッションの重さに応じたインターバルで開始する */
export function autoRest(session){
  if(!S.rest.on) return;
  startTimer(restSecondsFor(session, S.rest),
    `${EX[session.ex]} ${session.reps}×${session.sets} @RPE${fmt(session.rpe)}`);
}

export function adjustTimer(sec){
  if(!state) return;
  const next = adjustRest(state, sec, Date.now());
  if(!next){ stopTimer(); return; }
  state = next; persist(); paint(); haptic(6);
}

export function stopTimer(){
  state = null; persist();
  clearInterval(tick); tick = null;
  $('restbar').classList.remove('show', 'done');
  document.body.classList.remove('rest-on');
}

/** リロードやアプリ復帰のときに、走っていたタイマーを復元する */
export function restoreTimer(){
  const raw = storage.readRaw(TKEY);
  if(!raw) return;
  try{
    const next = restoreRest(JSON.parse(raw), Date.now());
    if(!next){ storage.writeRaw(TKEY, null); return; }
    state = next; run();
  }catch(e){ storage.writeRaw(TKEY, null); }
}

function run(){
  clearInterval(tick);
  $('restbar').classList.add('show');
  document.body.classList.add('rest-on');
  paint();
  tick = setInterval(paint, 250);
}

function paint(){
  if(!state) return;
  const now = Date.now();
  const v = restView(state, now);
  if(!v) return;
  const bar = $('restbar');
  const dial = bar.querySelector('.bar');

  if(!v.done){
    $('tTime').textContent = mmss(v.left);
    $('tLab').textContent = v.label;
    bar.classList.remove('done');
    dial?.setAttribute('stroke-dasharray', `${(DIAL_CIRCUMFERENCE * v.ratio).toFixed(1)} ${DIAL_CIRCUMFERENCE}`);
    return;
  }

  $('tTime').textContent = v.overSec > 0 ? `+${mmss(v.overSec)}` : '0:00';
  $('tLab').textContent = `${v.label} — 完了`;
  bar.classList.add('done');
  dial?.setAttribute('stroke-dasharray', `${DIAL_CIRCUMFERENCE} ${DIAL_CIRCUMFERENCE}`);

  if(shouldFireRest(state, now)){
    state = {...state, firedAt: now};
    beep();
    if(S.rest.vibrate) haptic([140, 90, 140, 90, 260]);
    toast('インターバル終了 — 次のセットへ');
  }
  if(shouldClearRest(state, now)) stopTimer();
}

export function initTimer(){
  $('tMinus').onclick = () => adjustTimer(-30);
  $('tPlus').onclick  = () => adjustTimer(30);
  $('tStop').onclick  = () => { stopTimer(); haptic(); };
  restoreTimer();
}

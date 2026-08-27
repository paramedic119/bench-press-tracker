/**
 * 保存データのスキーマ・検証・移行。壊れた入力を安全な状態へ正規化する。
 */
import { BY_ID } from './program.js';
import { MICRO_OPTIONS, ROUND_OPTIONS, microFor } from './plates.js';

export const SCHEMA_VERSION = 2;

/* ---------- 状態のスキーマ・移行・検証 ---------- */
export const DEFAULT_REST = {main:180, accessory:120, test:300};
export function defaults(now){
  return /** @type {AppState} */ ({
    v: SCHEMA_VERSION,
    maxes: {MB:110, MN:105, ML:100},
    round: 2.5, bar: 20, micro: 1.25, adaptive: false,
    theme: 'auto', warmup: true,
    rest: {on:true, sound:true, vibrate:true, ...DEFAULT_REST},
    logs: {}, sets: {}, notes: {},
    ui: {week:1, day:1, ex:'BP'},
    history: [], cycle: {n:1, started:now},
    onboarded: false,
  });
}

const num = (v, lo, hi, dflt) => { const n = +v; return Number.isFinite(n) && n>=lo && n<=hi ? n : dflt; };
const bool = (v, dflt) => typeof v==='boolean' ? v : dflt;

/** ログ1件を検証して正規化。壊れていれば null。 */
export function cleanEntry(x){
  if(!x || typeof x!=='object') return null;
  const w = +x.w, reps = +x.reps, rpe = +x.rpe;
  if(!(w>0 && w<1000) || !(reps>0 && reps<=100)) return null;
  const t = Number.isFinite(+x.t) && +x.t>0 ? +x.t : null;
  return {w, reps, rpe: num(rpe, 1, 10, 10), ...(t?{t}:{})};
}

/**
 * 任意の保存データ／読み込みJSONを、現行スキーマの健全な状態に変換する。
 * 壊れた値は既定値に落とし、v1（セッション単位ログ）からの移行も行う。
 */
export function migrate(raw, now){
  const d = defaults(now);
  if(!raw || typeof raw!=='object') return d;
  const S = d;

  if(raw.maxes && typeof raw.maxes==='object'){
    for(const k of ['MB','MN','ML']) S.maxes[k] = num(raw.maxes[k], 1, 999, d.maxes[k]);
  }
  /* 旧バージョンの 1.25kg 刻みは実際には組めないので 2.5kg に寄せる */
  S.round = +raw.round === 1.25 ? 2.5 : ROUND_OPTIONS.includes(+raw.round) ? +raw.round : d.round;
  S.bar = [20, 15, 10].includes(+raw.bar) ? +raw.bar : d.bar;
  S.micro = MICRO_OPTIONS.includes(+raw.micro) ? +raw.micro : d.micro;
  if(S.round > 0 && S.micro > microFor(S.round)) S.micro = microFor(S.round);
  S.adaptive = bool(raw.adaptive, d.adaptive);
  S.warmup = bool(raw.warmup, d.warmup);
  S.theme = ['auto','dark','light'].includes(raw.theme) ? raw.theme : d.theme;
  S.onboarded = bool(raw.onboarded, d.onboarded);

  if(raw.rest && typeof raw.rest==='object'){
    S.rest = {
      on: bool(raw.rest.on, true), sound: bool(raw.rest.sound, true), vibrate: bool(raw.rest.vibrate, true),
      main: num(raw.rest.main, 0, 900, DEFAULT_REST.main),
      accessory: num(raw.rest.accessory, 0, 900, DEFAULT_REST.accessory),
      test: num(raw.rest.test, 0, 900, DEFAULT_REST.test),
    };
  }

  /* ログ: v1 は「セッションに1件のオブジェクト」→ セット配列へ */
  if(raw.logs && typeof raw.logs==='object'){
    for(const k in raw.logs){
      if(!BY_ID.has(+k)) continue;
      const v = raw.logs[k];
      const arr = (Array.isArray(v) ? v : [v]).map(cleanEntry);
      while(arr.length && arr[arr.length-1]===null) arr.pop();
      if(arr.length) S.logs[k] = arr;
    }
  }
  if(raw.sets && typeof raw.sets==='object'){
    for(const k in raw.sets){
      if(!BY_ID.has(+k) || !Array.isArray(raw.sets[k])) continue;
      const arr = raw.sets[k].map(v => (typeof v==='number' && v>0) ? v : (v ? true : false));
      while(arr.length && !arr[arr.length-1]) arr.pop();
      if(arr.length) S.sets[k] = arr;
    }
  }
  if(raw.notes && typeof raw.notes==='object'){
    for(const k in raw.notes){
      const mk = /^(\d{1,2})-([123])$/.exec(k);
      if(!mk || +mk[1] < 1 || +mk[1] > 12) continue;
      const n = raw.notes[k]; if(!n || typeof n!=='object') continue;
      const text = typeof n.text==='string' ? n.text.slice(0, 2000) : '';
      const bw = num(n.bw, 20, 400, null);
      if(text || bw) S.notes[k] = {text, ...(bw?{bw}:{}), t: Number.isFinite(+n.t) ? +n.t : now};
    }
  }
  if(raw.ui && typeof raw.ui==='object'){
    S.ui.week = num(raw.ui.week, 1, 12, 1) | 0;
    S.ui.day = num(raw.ui.day, 1, 3, 1) | 0;
    S.ui.ex = ['BP','NR','LG'].includes(raw.ui.ex) ? raw.ui.ex : 'BP';
  }
  if(Array.isArray(raw.history)){
    S.history = raw.history.filter(h => h && typeof h==='object' && h.maxesStart).map(h => ({
      n: num(h.n, 1, 9999, 1)|0,
      started: num(h.started, 0, Infinity, now), ended: num(h.ended, 0, Infinity, now),
      maxesStart: h.maxesStart, maxesEnd: h.maxesEnd || h.maxesStart,
      best: h.best || {}, logs: h.logs && typeof h.logs==='object' ? h.logs : {},
      sets: h.sets && typeof h.sets==='object' ? h.sets : {},
    }));
  }
  if(raw.cycle && typeof raw.cycle==='object'){
    S.cycle = {n: num(raw.cycle.n, 1, 9999, 1)|0, started: num(raw.cycle.started, 0, Infinity, now)};
  }
  /* v1 のデータには onboarded が無い＝すでに使っているユーザーなので初期設定は出さない */
  if(raw.maxes && raw.onboarded===undefined) S.onboarded = true;
  return S;
}

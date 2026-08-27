/**
 * レップマックス（3RM / 5RM / 8RM）の推定。
 */
import { PROGRAM } from './program.js';
import { e1rm, suggestW } from './math.js';
import { dayKeyOf } from './progress.js';

/* ---------- レップマックス（3RM / 5RM / 8RM）の推定 ---------- */
export const REP_TARGETS = [3, 5, 8];
/** e1RM から「X回 @ RPE10」の重量＝X回マックスを逆算する */
export const repMax = (e1, reps) => suggestW(e1, reps, 10);
/** 推定に使う回数の許容幅。式は目標回数から離れるほど当てにならないので、
    8回のセットから3RMを出すようなことはしない。 */
export const REP_WINDOW = 3;
export const canEstimate = (reps, target) => Math.abs(reps - target) <= REP_WINDOW;

/**
 * 記録済みのセットから、日付ごとの推定レップマックスを組み立てる。
 * 過去サイクルの記録も含めて時系列に並べるので、サイクルをまたいだ推移が見える。
 * 日時を持たない古い記録は時系列に置けないため除外する。
 */
export function repMaxSeries(state, ex, targets = REP_TARGETS){
  /** @type {Map<string, RepMaxPoint>} */
  const byDay = new Map();
  const scan = logs => {
    for(const s of PROGRAM){
      if(s.ex !== ex) continue;
      const arr = logs[s.id];
      if(!Array.isArray(arr)) continue;
      for(const x of arr){
        if(!x || !(x.w > 0) || !(x.reps > 0) || !(x.t > 0)) continue;
        const key = dayKeyOf(x.t);
        let d = byDay.get(key);
        if(!d){ d = {key, t:x.t, rm:{}, e1:null, sets:0}; byDay.set(key, d); }
        if(x.t < d.t) d.t = x.t;
        d.sets++;
        const e = e1rm(x.w, x.reps, x.rpe);
        if(d.e1 === null || e > d.e1) d.e1 = e;
        for(const target of targets){
          if(!canEstimate(x.reps, target)) continue;
          const v = repMax(e, target);
          if(d.rm[target] === undefined || v > d.rm[target]) d.rm[target] = v;
        }
      }
    }
  };
  for(const h of state.history) scan(h.logs || {});
  scan(state.logs);
  return [...byDay.values()].sort((a, b) => a.t - b.t);
}

/** 各レップマックスの最新値・初回値・ベスト値。データが無い回数は入らない。 */
export function latestRepMaxes(series, targets = REP_TARGETS){
  /** @type {Record<number, {current:number, first:number, best:number, t:number, n:number}>} */
  const out = {};
  for(const target of targets){
    const pts = series.filter(p => p.rm[target] !== undefined);
    if(!pts.length) continue;
    out[target] = {
      current: pts[pts.length-1].rm[target],
      first: pts[0].rm[target],
      best: Math.max(...pts.map(p => p.rm[target])),
      t: pts[pts.length-1].t,
      n: pts.length,
    };
  }
  return out;
}

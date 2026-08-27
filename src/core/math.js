/**
 * e1RM とその周辺の数式。すべて Excel 互換。
 */
import { PROGRAM } from './program.js';

/* ---------- 数式 ---------- */
/** 推定1RM（Excel互換）。RPE10シングルは実重量そのもの。 */
export const e1rm = (w, reps, rpe) => (reps===1 && rpe===10) ? w : w*(reps+10-rpe)/33 + w;
/** e1RM から「目標回数@目標RPE」の重量を逆算（e1rm の逆関数） */
export const suggestW = (e, reps, rpe) => (reps===1 && rpe===10) ? e : e*33/(33+reps+10-rpe);
/** step 刻みに丸める。step<=0 は小数第2位まで。 */
export const roundTo = (w, step) => step>0 ? Math.round(w/step)*step : Math.round(w*100)/100;
/** 表示用フォーマット。整数はそのまま、小数は d 桁。-0 は 0 に。 */
/** 表示用。d桁に丸めたうえで末尾の0を落とす（105.04→"105" / 110.74→"110.7"） */
export const fmt = (v, d=1) => { const n = +v + 0; return Number.isFinite(n) ? String(+n.toFixed(d)) : '—'; };
export const fmtSigned = (v, d=1) => (v>=0?'+':'') + fmt(v, d);
/** バーに載る実重量用。1.25kg刻みまで正確に見せる（1.25→"1.25" / 92.50→"92.5"） */
export const fmtKg = v => fmt(v, 2);
export const fmtKgSigned = v => (v>=0?'+':'') + fmtKg(v);

/** ログ配列（[{w,reps,rpe}|null]）からベスト e1RM。無ければ null。 */
export function bestOf(arr){
  if(!Array.isArray(arr)) return null;
  let best = null;
  for(const x of arr){
    if(!x || !(x.w>0) || !(x.reps>0)) continue;
    const e = e1rm(x.w, x.reps, x.rpe);
    if(best===null || e>best) best = e;
  }
  return best;
}

/**
 * 12週すべてのセッション重量 W と e1RM チェーン H を計算する。
 * @param {Maxes} maxes
 * @param {{adaptive?:boolean, logs?:LogMap}} [opts]
 * @returns {Plan}
 * adaptive=true のときは記録済みセッションの実績ベスト e1RM で以降を再計算。
 */
export function computePlan(maxes, {adaptive=false, logs={}}={}){
  /** @type {Record<number, number>} */ const H = {};
  /** @type {Record<number, number>} */ const W = {};
  for(const s of PROGRAM){
    const base = typeof s.ref==='string' ? maxes[s.ref] : H[s.ref];
    const w = base * s.coef;
    W[s.id] = w;
    let e = e1rm(w, s.reps, s.rpe);
    if(adaptive){
      const be = bestOf(logs[s.id]);
      if(be!==null) e = be;
    }
    H[s.id] = e;
  }
  return {W, H};
}

/** 各セッションの計画ボリューム（Excel I列）と補正ボリューム（J列） */
export function sessionVolume(rawW, s){
  const vol = rawW * s.reps * s.sets;
  const adj = vol * Math.pow(s.rpe/10, 2) * Math.pow(rawW / e1rm(rawW, s.reps, s.rpe), 2);
  return {vol, adj};
}
/** 週ごとの合計ボリューム（全種目） */
export function weekVolumes(W){
  const out = Array.from({length:12}, ()=>({tot:0, adj:0}));
  for(const s of PROGRAM){
    const {vol, adj} = sessionVolume(W[s.id], s);
    out[s.week-1].tot += vol;
    out[s.week-1].adj += adj;
  }
  return out;
}
/** サイクル中の種目別ベスト e1RM */
export function cycleBestOf(logs){
  /** @type {Record<ExKey, number|null>} */
  const best = {BP:null, NR:null, LG:null};
  for(const s of PROGRAM){
    const b = bestOf(logs[s.id]);
    if(b === null) continue;
    const cur = best[s.ex];
    if(cur === null || b > cur) best[s.ex] = b;
  }
  return best;
}

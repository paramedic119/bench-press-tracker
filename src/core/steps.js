/**
 * 入力ステッパーの刻みと範囲。画面に依らない値の決め方だけを持つ。
 */

/**
 * 刻み st の格子上で dir 方向へ1つ動かす。dir=0 なら最寄りへ丸めるだけ。
 * 「いま格子から外れている値」から押したときに、素直に隣へ動くようにしてある
 * （91.3 から + なら 95 ではなく 92.5）。
 */
function onGrid(cur, dir, st){
  const eps = 1e-9;
  const v = dir > 0 ? (Math.floor(cur/st + eps) + 1) * st
          : dir < 0 ? (Math.ceil(cur/st - eps) - 1) * st
          : Math.round(cur/st) * st;
  return Math.round(v * 1e6) / 1e6;     /* 0.1+0.2 のような誤差を溜めない */
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * ステッパー1回ぶんの変化。手入力のクランプにも使う（dir=0 なら丸めと範囲だけ効く）。
 *   w=重量 / r=回数 / p=RPE / max=MAX / sec=インターバル秒 / bw=体重
 * @param {string} kind
 * @param {number} cur   現在値
 * @param {number} dir   +1 / -1 / 0
 * @param {number} roundStep 重量の丸め刻み
 */
export function stepValue(kind, cur, dir, roundStep = 2.5){
  switch(kind){
    case 'w':   return clamp(onGrid(cur, dir, roundStep > 0 ? roundStep : 2.5), 0, 999);
    case 'r':   return clamp(onGrid(cur, dir, 1), 1, 100);
    /* RPEの上下は1刻み。ただしクランプは0.5刻みで行う。
       プログラムには RPE 8.5 のセッションがあり、丸めてしまうと e1RM が変わる。 */
    case 'p':   return clamp(dir === 0 ? onGrid(cur, 0, 0.5) : onGrid(cur, dir, 1), 5, 10);
    case 'max': return clamp(onGrid(cur, dir, 2.5), 20, 999);
    case 'sec': return clamp(onGrid(cur, dir, 15), 0, 900);
    case 'bw':  return clamp(onGrid(cur, dir, 0.5), 20, 400);
    default:    return cur;
  }
}

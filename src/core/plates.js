/**
 * プレート計算と丸め刻み。「バーに実際に載る」ことを保証する層。
 */
import { roundTo } from './math.js';

/* ---------- プレート計算 ---------- */
export const PLATE_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25];
export const PLATE_CLASS = {25:'p25', 20:'p20', 15:'p15', 10:'p10', 5:'p5', 2.5:'p2_5', 1.25:'p1_25', 0.5:'p0_5', 0.25:'p0_25'};
export const MICRO_OPTIONS = [1.25, 0.5, 0.25];
/* 丸め刻みは「バーに実際に載る値」だけを並べる。
   刻み S を作るには片側 S/2 が必要なので、1.25kg刻み(=片側0.625kg)のような
   どんなプレートでも組めない値は選択肢に入れない。 */
export const ROUND_OPTIONS = [5, 2.5, 1, 0.5, 0];
/** その刻みを組むのに必要な、最小プレートの上限 */
export const microFor = step => step > 0
  ? MICRO_OPTIONS.filter(m => m <= step/2 + 1e-9).sort((a,b) => b-a)[0] ?? MICRO_OPTIONS[MICRO_OPTIONS.length-1]
  : MICRO_OPTIONS[MICRO_OPTIONS.length-1];
/** 片側の最小プレートに合わせて、使えるプレートの一覧を返す */
export const platesFor = micro => PLATE_KG.filter(k => k >= micro - 1e-9);
export const PLATE_UNIT = 0.25;   /* すべてのプレートは 0.25kg の倍数 */
/**
 * 片側に載せるプレート構成を「枚数最小」で厳密に解く。rest は載せきれなかった端数(kg)。
 * 大きい順の貪欲法だと、たとえば 0.5kg までしか持っていないのに片側1.5kg を作る場面で
 * 1.25kg を取ってしまい 0.25kg が余る。組めるのに組めないと言わないよう動的計画で解く。
 */
export function plateBreakdown(total, bar, plates = platesFor(1.25)){
  const sideKg = (total - bar) / 2;
  /* NaN や Infinity をそのまま通すと、下の配列確保が落ちる */
  if(!Number.isFinite(sideKg) || sideKg < -0.001) return {light:true, used:[], rest:0};
  const target = Math.max(0, Math.floor(sideKg / PLATE_UNIT + 1e-9));
  const coins = [...new Set(plates.map(p => Math.round(p / PLATE_UNIT)))].filter(c => c > 0).sort((a,b) => b-a);
  const count = new Float64Array(target + 1).fill(Infinity);
  const pick = new Int32Array(target + 1).fill(-1);
  count[0] = 0;
  for(let v = 1; v <= target; v++){
    for(const c of coins){                       /* coins は大きい順 → 同枚数なら大きいプレートを選ぶ */
      if(c > v) continue;
      if(count[v-c] + 1 < count[v]){ count[v] = count[v-c] + 1; pick[v] = c; }
    }
  }
  let v = target;
  while(v > 0 && !Number.isFinite(count[v])) v--; /* ぴったり作れないときは、作れる最大の重さまで下げる */
  const used = [];
  for(let cur = v; cur > 0; cur -= pick[cur]) used.push(pick[cur] * PLATE_UNIT);
  used.sort((a, b) => b - a);
  return {light:false, used, rest: Math.round((sideKg - v*PLATE_UNIT) * 100) / 100};
}

/** メインセットに向けたウォームアップ提案 */
export function warmupSets(work, bar, step){
  const st = step > 0 ? step : 2.5;
  if(!(work > bar + st*2)) return [];
  /** @type {WarmupSet[]} */
  const out = [{w:bar, reps:10, isBar:true}];
  const ramp = work >= bar*2.2 ? [[.45,8],[.62,5],[.78,3],[.9,1]] : [[.55,6],[.75,3],[.9,1]];
  for(const [p, reps] of ramp){
    const w = roundTo(work*p, st);
    if(w <= bar + st*0.5) continue;
    if(w >= work - st*0.5) continue;
    if(out.some(x => Math.abs(x.w-w) < 1e-9)) continue;
    out.push({w, reps, pct:Math.round(w/work*100)});
  }
  return out;
}

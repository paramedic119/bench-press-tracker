/**
 * 記録一覧の CSV 書き出し。
 */
import { PROGRAM, EX } from './program.js';
import { e1rm } from './math.js';

/** CSV（Excel/Numbersで開ける記録一覧） */
export function toCSV(state){
  const esc = v => /[",\n]/.test(String(v)) ? '"'+String(v).replace(/"/g,'""')+'"' : String(v);
  const rows = [['cycle','week','day','exercise','set','weight_kg','reps','rpe','e1rm_kg','recorded_at']];
  const push = (cycleN, st) => {
    for(const s of PROGRAM){
      const arr = st.logs[s.id]; if(!Array.isArray(arr)) continue;
      arr.forEach((x, i) => {
        if(!x || !(x.w>0)) return;
        rows.push([cycleN, s.week, s.day, EX[s.ex], i+1, x.w, x.reps, x.rpe,
          Math.round(e1rm(x.w, x.reps, x.rpe)*10)/10, x.t ? new Date(x.t).toISOString() : '']);
      });
    }
  };
  for(const h of state.history) push(h.n, {logs:h.logs||{}, sets:h.sets||{}});
  push(state.cycle.n, state);
  return rows.map(r => r.map(esc).join(',')).join('\r\n');
}

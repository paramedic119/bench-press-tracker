/**
 * 進捗の集計とトレーニング日の抽出。
 */
import { PROGRAM, isMaxTest } from './program.js';

/* ---------- 進捗の集計 ---------- */
export const setsDone = (sets, id) => (sets[id]||[]).filter(Boolean).length;
export const isSessionDone = (sets, s) => setsDone(sets, s.id) >= s.sets;
export const isDayDone = (sets, w, d) => PROGRAM.filter(s=>s.week===w && s.day===d).every(s=>isSessionDone(sets, s));
export function dayProgress(sets, w, d){
  const list = PROGRAM.filter(s=>s.week===w && s.day===d);
  const total = list.reduce((a,s)=>a+s.sets, 0);
  const done = list.reduce((a,s)=>a+Math.min(setsDone(sets, s.id), s.sets), 0);
  return {done, total, ratio: total ? done/total : 0};
}
export function weekProgress(sets, w){
  const list = PROGRAM.filter(s=>s.week===w);
  const total = list.reduce((a,s)=>a+s.sets, 0);
  const done = list.reduce((a,s)=>a+Math.min(setsDone(sets, s.id), s.sets), 0);
  return {done, total, ratio: total ? done/total : 0,
          state: done>=total ? 'done' : done>0 ? 'partial' : ''};
}
export function cycleProgress(sets){
  const total = PROGRAM.reduce((a,s)=>a+s.sets, 0);
  const done = PROGRAM.reduce((a,s)=>a+Math.min(setsDone(sets, s.id), s.sets), 0);
  return {done, total, ratio: total ? done/total : 0};
}
/** 最初の未完了の（週, 日）。全完了なら null。 */
export function firstIncompleteDay(sets){
  for(let w=1; w<=12; w++) for(let d=1; d<=3; d++) if(!isDayDone(sets, w, d)) return {week:w, day:d};
  return null;
}
/** セッションの記録日時 = セット✓とログの最新タイムスタンプ（旧データはnull） */
export function sessionDate(state, id){
  let t = 0;
  for(const v of (state.sets[id]||[])) if(typeof v==='number' && v>t) t = v;
  const a = state.logs[id];
  if(Array.isArray(a)) for(const x of a) if(x && x.t>t) t = x.t;
  return t || null;
}
/** タイマー秒数をセッション種別から決める */
export function restSecondsFor(s, rest){
  if(isMaxTest(s)) return rest.test;
  return s.rpe >= 8.5 ? rest.main : rest.accessory;
}
export const mmss = sec => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
export const dayKeyOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

/** 現サイクル＋履歴の全記録から、日付(YYYY-MM-DD)→セッション数 のマップ */
export function trainingDays(state){
  const map = new Map();
  const scan = st => {
    for(const s of PROGRAM){
      const t = sessionDate(st, s.id);
      if(t) map.set(dayKeyOf(t), (map.get(dayKeyOf(t))||0) + 1);
    }
  };
  scan(state);
  for(const h of state.history) scan({sets:h.sets||{}, logs:h.logs||{}});
  return map;
}
/** 月曜始まりの週で、直近から何週連続でトレーニングしたか */
export function weekStreak(dayMap, now){
  const monday = new Date(now); monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate() - ((monday.getDay()+6)%7));
  const hasWeek = start => {
    for(let i=0; i<7; i++){
      const d = new Date(start); d.setDate(d.getDate()+i);
      if(dayMap.has(dayKeyOf(d.getTime()))) return true;
    }
    return false;
  };
  let streak = 0;
  const cur = new Date(monday);
  if(!hasWeek(cur)) cur.setDate(cur.getDate()-7);   // 今週未実施なら先週から数える
  while(hasWeek(cur)){ streak++; cur.setDate(cur.getDate()-7); }
  return streak;
}

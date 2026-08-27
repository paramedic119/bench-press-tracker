/**
 * インターバルタイマーの状態機械。
 * Date.now をここに持ち込まず常に外から now を受け取るので、
 * 実時間を待たずに全分岐をテストできる（バックグラウンド復帰・期限切れ・自動片付け）。
 *
 * @typedef {{endsAt:number, total:number, label:string, firedAt:number|null}} RestState
 */

/** 完了してから、この時間が過ぎたらタイマー表示を片付ける */
export const REST_LINGER_MS = 180000;
/** 保存された状態を復元する猶予。終了からこれ以上経っていたら捨てる */
export const REST_RESTORE_MS = 300000;

/**
 * @returns {RestState | null} 秒数が0以下なら開始しない
 */
export function startRest(sec, label, now){
  if(!(sec > 0)) return null;
  return {endsAt: now + sec * 1000, total: sec, label: label || 'インターバル', firedAt: null};
}

/**
 * ±秒。マイナス側で現在時刻に追いついたら終了（null）を返す。
 * 残り時間が伸びたぶん total も広げ、進捗リングが振り切れないようにする。
 * @returns {RestState | null}
 */
export function adjustRest(t, sec, now){
  if(!t) return null;
  const base = Math.max(t.endsAt, now);
  const next = base + sec * 1000;
  if(sec < 0 && next <= now + 1000) return null;
  return {
    ...t,
    endsAt: next,
    total: Math.max(t.total + sec, Math.ceil((next - now) / 1000)),
    firedAt: null,
  };
}

/**
 * 表示に必要な値をまとめて返す。
 * @returns {{left:number, done:boolean, overSec:number, ratio:number, label:string} | null}
 */
export function restView(t, now){
  if(!t) return null;
  const leftMs = t.endsAt - now;
  const done = leftMs <= 0;
  return {
    left: Math.ceil(leftMs / 1000),
    done,
    overSec: done ? Math.floor(-leftMs / 1000) : 0,
    ratio: Math.max(0, Math.min(1, leftMs / (t.total * 1000 || 1))),
    label: t.label,
  };
}

/** 保存データから復元してよいか。終了からしばらく経っていれば捨てる。 */
export function restoreRest(saved, now){
  if(!saved || !(saved.endsAt > 0)) return null;
  if(now - saved.endsAt > REST_RESTORE_MS) return null;
  return {
    endsAt: saved.endsAt,
    total: saved.total > 0 ? saved.total : 180,
    label: typeof saved.label === 'string' && saved.label ? saved.label : 'インターバル',
    firedAt: now >= saved.endsAt ? saved.endsAt : null,
  };
}

/** 完了音を鳴らすべきタイミングか（1回だけ true になるよう firedAt で抑える） */
export const shouldFireRest = (t, now) => !!t && t.firedAt === null && now >= t.endsAt;
/** 完了からじゅうぶん経って、表示を片付けてよいか */
export const shouldClearRest = (t, now) => !!t && t.firedAt !== null && now - t.firedAt > REST_LINGER_MS;

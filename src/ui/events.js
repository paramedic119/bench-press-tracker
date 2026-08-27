/**
 * 画面をまたぐ通知。
 * ページ同士が直接 import し合うと循環するので、DOM イベントを1枚挟む。
 */
const RENDER = 'app:render';
const GOTO = 'app:goto';
const REPLACED = 'app:state-replaced';

/** 現在のページを描き直す */
export const requestRender = () => dispatchEvent(new CustomEvent(RENDER));
/** 指定のページへ移動する */
export const requestGoto = page => dispatchEvent(new CustomEvent(GOTO, {detail: page}));

/**
 * 状態がまるごと入れ替わった（取り消し・JSON読み込み）。
 * S から作った表示キャッシュを持っている側は、ここで捨てる。
 */
export const notifyStateReplaced = () => dispatchEvent(new CustomEvent(REPLACED));
export const onStateReplaced = fn => addEventListener(REPLACED, () => fn());

export const onRender = fn => addEventListener(RENDER, () => fn());
export const onGoto = fn => addEventListener(GOTO, e => fn(/** @type {CustomEvent<string>} */ (e).detail));

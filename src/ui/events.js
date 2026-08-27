/**
 * 画面をまたぐ通知。
 * ページ同士が直接 import し合うと循環するので、DOM イベントを1枚挟む。
 */
const RENDER = 'app:render';
const GOTO = 'app:goto';

/** 現在のページを描き直す */
export const requestRender = () => dispatchEvent(new CustomEvent(RENDER));
/** 指定のページへ移動する */
export const requestGoto = page => dispatchEvent(new CustomEvent(GOTO, {detail: page}));

export const onRender = fn => addEventListener(RENDER, () => fn());
export const onGoto = fn => addEventListener(GOTO, e => fn(/** @type {CustomEvent<string>} */ (e).detail));

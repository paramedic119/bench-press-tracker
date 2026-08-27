/**
 * 小さな共通ヘルパー。
 */

/**
 * null / undefined を落としつつ、型も絞り込む。
 * `.filter(Boolean)` は型が絞られず 0 も落としてしまうので、こちらを使う。
 * @template T
 * @param {T | null | undefined} v
 * @returns {v is T}
 */
export const present = v => v !== null && v !== undefined;

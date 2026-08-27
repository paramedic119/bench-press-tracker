/**
 * DOM ヘルパー。型の確定を1箇所に閉じ込め、呼び出し側にキャストを撒かないための層。
 */

/** id で要素を取る。無ければ即座に落とす（テンプレートとコードのズレを黙って進めない） */
export function $(id){
  const el = document.getElementById(id);
  if(!el) throw new Error(`要素 #${id} が見つかりません`);
  return el;
}
/** input 要素として取る */
export const $inp = id => /** @type {HTMLInputElement} */ ($(id));
/** textarea 要素として取る */
export const $ta = id => /** @type {HTMLTextAreaElement} */ ($(id));

/** querySelectorAll の結果を HTMLElement[] で返す（dataset / onclick を型安全に触るため） */
export const qsa = (root, sel) => /** @type {HTMLElement[]} */ ([...root.querySelectorAll(sel)]);
/** querySelector の結果を HTMLElement|null で返す */
export const qs = (root, sel) => /** @type {HTMLElement | null} */ (root.querySelector(sel));

/**
 * hidden の付け外し。
 * hidden は HTMLElement のプロパティで SVGElement には無いため、必ず属性で操作する。
 * （`svgEl.hidden = true` は何も起きずに黙って通ってしまう）
 */
export const setShown = (el, on) => el.toggleAttribute('hidden', !on);

/** HTML に差し込む文字列のエスケープ */
export const esc = s => String(s).replace(/[&<>"']/g,
  c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c] ?? c));

/** 「8/27」形式の短い日付 */
export const fmtDate = t => { const d = new Date(t); return `${d.getMonth()+1}/${d.getDate()}`; };

/** data-* を数値で読む（無ければ 0） */
export const dataNum = (el, key) => Number(el.dataset[key] ?? 0);
/** data-* を文字列で読む（無ければ空文字） */
export const dataStr = (el, key) => el.dataset[key] ?? '';

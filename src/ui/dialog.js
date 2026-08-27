/**
 * confirm() の置き換え。フォーカストラップと Esc を備えたシート型ダイアログ。
 */
import { $, esc } from './dom.js';

let closeCurrent = null;

/**
 * @returns {Promise<boolean>} OK が押されたか
 */
export function ask({title, body = '', ok = 'OK', cancel = 'キャンセル', danger = false}){
  return new Promise(resolve => {
    const scrim = $('scrim');
    const prev = /** @type {HTMLElement | null} */ (document.activeElement);
    scrim.innerHTML = `<div class="sheet" role="document">
        <h2 id="sheetTitle">${esc(title)}</h2>
        ${body ? `<div class="body">${body}</div>` : ''}
        <div class="acts">
          ${cancel ? `<button type="button" class="b-cancel">${esc(cancel)}</button>` : ''}
          <button type="button" class="b-ok${danger ? ' danger-ok' : ''}">${esc(ok)}</button>
        </div>
      </div>`;
    scrim.classList.add('show');
    document.body.style.overflow = 'hidden';

    const done = v => {
      if(!closeCurrent) return;
      closeCurrent = null;
      scrim.classList.remove('show'); scrim.innerHTML = '';
      document.body.style.overflow = '';
      removeEventListener('keydown', onKey, true);
      try{ prev?.focus?.(); }catch(e){}
      resolve(v);
    };
    const onKey = e => {
      if(e.key === 'Escape'){ e.preventDefault(); done(false); return; }
      if(e.key !== 'Tab') return;
      const f = /** @type {HTMLElement[]} */ ([...scrim.querySelectorAll('button')]);
      if(!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    };

    closeCurrent = done;
    const okBtn = /** @type {HTMLElement} */ (scrim.querySelector('.b-ok'));
    okBtn.onclick = () => done(true);
    const cancelBtn = /** @type {HTMLElement | null} */ (scrim.querySelector('.b-cancel'));
    if(cancelBtn) cancelBtn.onclick = () => done(false);
    scrim.onclick = e => { if(e.target === scrim) done(false); };
    addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => okBtn.focus());
  });
}

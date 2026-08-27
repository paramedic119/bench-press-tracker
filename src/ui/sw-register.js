/**
 * Service Worker の登録と更新通知。
 * オフライン動作そのものは sw.js 側の責務で、ここは「新しい版が来た」を伝えるだけ。
 */
import { APP_VERSION } from '../core/index.js';
import { $ } from './dom.js';
import { toast, appendToastAction, hideToast } from './feedback.js';

/** @type {ServiceWorker | null} */
let waiting = null;

function promptUpdate(sw){
  waiting = sw;
  toast('新しいバージョンがあります', {ms: 9000});
  appendToastAction('更新', () => { hideToast(); sw.postMessage({type: 'SKIP_WAITING'}); });
}

export async function registerSW(){
  if(!('serviceWorker' in navigator)) return null;
  /* file:// や http:// では登録できない。失敗ではなく想定内なので黙って諦める。 */
  if(location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) return null;
  try{
    const reg = await navigator.serviceWorker.register('./sw.js', {scope: './'});
    if(reg.waiting) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if(sw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(sw);
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(reloading) return;
      reloading = true; location.reload();
    });
    return reg;
  }catch(e){ return null; }
}

export async function checkForUpdate(){
  if(waiting){ waiting.postMessage({type: 'SKIP_WAITING'}); return; }
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if(!reg){ toast('この環境ではオフライン更新は使えません'); return; }
  toast('確認しています…');
  try{ await reg.update(); }catch(e){}
  setTimeout(() => { if(!waiting) toast(`最新です（v${APP_VERSION}）`); }, 1200);
}

export function initUpdateButton(){ $('btnUpdate').onclick = checkForUpdate; }

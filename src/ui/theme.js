/**
 * テーマ。auto は端末設定に追従し、theme-color も合わせて切り替える。
 */
import { $ } from './dom.js';
import { S } from './store.js';

const mqLight = matchMedia('(prefers-color-scheme: light)');

export function applyTheme(){
  const t = S.theme === 'auto' ? (mqLight.matches ? 'light' : 'dark') : S.theme;
  document.documentElement.dataset.theme = t;
  $('metaTheme').setAttribute('content', t === 'light' ? '#F4F5F3' : '#0F1216');
}

export function initTheme(){
  applyTheme();
  mqLight.addEventListener?.('change', () => { if(S.theme === 'auto') applyTheme(); });
}

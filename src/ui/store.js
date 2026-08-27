/**
 * 永続化。localStorage が使えない環境ではメモリへ退避し、その事実をユーザーに伝える。
 */
import { migrate } from '../core/index.js';
import { $ } from './dom.js';

/** 旧バージョンと同じキー。読み込み時に migrate() が差分を吸収する。 */
export const KEY = 'bench120.v1';
export const TKEY = 'bench120.timer';

let memFallback = null;

export const storage = {
  ok: true,
  read(){
    try{ const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch(e){ this.ok = false; return memFallback; }
  },
  write(v){
    try{ localStorage.setItem(KEY, JSON.stringify(v)); }
    catch(e){ memFallback = v; if(this.ok){ this.ok = false; showBanner(); } }
  },
  readRaw(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  writeRaw(k, v){ try{ v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} },
};

/** アプリ全体の状態。undo や読み込みで差し替わるので、参照ではなくこの束縛を見ること。 */
export let S = migrate(storage.read(), Date.now());
/** 状態をまるごと差し替える（undo / JSON読み込み） */
export function replaceState(next){ S = next; }

let saveTimer = null;
/** 連打時の書き込みをまとめる */
export function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => storage.write(S), 60);
}
export function saveNow(){ clearTimeout(saveTimer); storage.write(S); }

export function showBanner(){
  $('banner').innerHTML = '<b>保存できません。</b>プライベートブラウズか、ブラウザの保存容量がいっぱいの可能性があります。'
    + 'この画面を閉じると記録が消えるため、設定 → データ から JSON を書き出してください。';
  $('banner').classList.add('show');
}

/** タブを閉じる／隠れるタイミングで確実に書き出す */
export function initPersistence(){
  addEventListener('pagehide', saveNow);
  addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') saveNow(); });
}

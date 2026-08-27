/**
 * 設定画面。ジムの機材（バー・プレート）と、体感に関わる値（インターバル・丸め）を扱う。
 */
import { PROGRAM, MICRO_OPTIONS, ROUND_OPTIONS, microFor, migrate, toCSV,
         APP_VERSION, fmtKg } from '../../core/index.js';
import { $, $inp, qsa, dataStr } from '../dom.js';
import { S, replaceState, storage, save } from '../store.js';
import { requestRender } from '../events.js';
import { applyTheme } from '../theme.js';
import { haptic, toast, unlockAudio, beep, withUndo } from '../feedback.js';
import { ask } from '../dialog.js';
import { stopTimer } from '../timer.js';
import { clampInput, stepperHTML } from '../stepper.js';
import { startNextCycle } from '../cycle.js';
import { startOnboarding } from '../onboarding.js';
import { MAX_ROWS, REST_ROWS } from '../fields.js';


export function renderSettings(){
  $('maxRows').innerHTML = MAX_ROWS.map(([k, label]) =>
    `<div class="maxrow"><span>${label}</span>${stepperHTML('max'+k, 'max', fmtKg(S.maxes[k]), {aria:label+'のMAX kg', attrs:'step="0.5"'})}</div>`).join('');
  MAX_ROWS.forEach(([k]) => {
    const inp = $inp('max'+k);
    const commit = () => {
      const v = clampInput(inp, 'max');
      if(S.maxes[k] === v) return;
      S.maxes[k] = v; save(); requestRender(); toast('全12週を再計算しました');
    };
    inp.addEventListener('change', commit);
    inp.closest('.stepper')?.addEventListener('stepend', commit);
  });

  $('restRows').innerHTML = REST_ROWS.map(([k, label, hint]) =>
    `<div class="srow"><label for="rest${k}">${label}<small>${hint}</small></label>
      ${stepperHTML('rest'+k, 'sec', S.rest[k], {aria:label+'のインターバル秒', attrs:'step="15"'})}</div>`).join('');
  REST_ROWS.forEach(([k]) => {
    const inp = $inp('rest'+k);
    const commit = () => { S.rest[k] = clampInput(inp, 'sec'); save(); };
    inp.addEventListener('change', commit);
    inp.closest('.srow')?.addEventListener('stepend', commit);
  });

  const opts = (host, list, cur, onPick) => {
    $(host).innerHTML = list.map(([v, label]) =>
      `<button class="opt ${cur===v?'sel':''}" type="button" data-v="${v}" aria-pressed="${cur===v}">${label}</button>`).join('');
    for(const b of qsa($(host), '.opt')) b.onclick = () => { onPick(dataStr(b, 'v')); haptic(); };
  };
  opts('roundOpts', ROUND_OPTIONS.map(v => [v, v > 0 ? fmtKg(v)+' kg' : '丸めなし']), S.round,
    v => {
      S.round = +v;
      /* その刻みが組めないプレート構成なら、最小プレートも自動で合わせる */
      const need = microFor(S.round);
      if(S.round > 0 && S.micro > need){ S.micro = need; toast(`最小プレートを ${fmtKg(need)}kg に合わせました`); }
      save(); requestRender();
    });
  opts('barOpts', [[20,'20 kg'], [15,'15 kg'], [10,'10 kg']], S.bar,
    v => { S.bar = +v; save(); requestRender(); });
  opts('microOpts', MICRO_OPTIONS.map(v => [v, fmtKg(v)+' kg']), S.micro,
    v => { S.micro = +v; save(); requestRender(); });
  opts('themeOpts', [['auto','端末に合わせる'], ['dark','ダーク'], ['light','ライト']], S.theme,
    v => { S.theme = v; save(); applyTheme(); requestRender(); });

  const sw = (id, on) => { const el = $(id); el.className = 'sw' + (on ? ' on' : ''); el.setAttribute('aria-checked', String(on)); };
  sw('adaptiveSw', S.adaptive); sw('restSw', S.rest.on); sw('soundSw', S.rest.sound);
  sw('vibeSw', S.rest.vibrate); sw('warmSw', S.warmup);

  $('cycleInfo').textContent = `現在: サイクル${S.cycle.n}（${new Date(S.cycle.started).toLocaleDateString('ja-JP')}〜）`
    + (S.history.length ? ` ・ 完了 ${S.history.length}サイクル` : '');
  const logged = PROGRAM.filter(s => Array.isArray(S.logs[s.id]) && S.logs[s.id].some(Boolean)).length;
  $('dataInfo').textContent = `記録済み ${logged} セッション ・ 履歴 ${S.history.length} サイクル`
    + (storage.ok ? '' : ' ・ 保存できていません');
  $('appInfo').textContent = `バージョン ${APP_VERSION}` + (navigator.onLine ? '' : ' ・ オフライン');
  $('verLine').textContent = `BENCH 120 v${APP_VERSION}`;
}

function download(name, text, mime){
  const blob = new Blob([text], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0,10);

/** ボタンとスイッチの登録。起動時に一度だけ呼ぶ。 */
export function initSettings(){
  /* スイッチ類 */
  const bindSwitch = (id, get, set) => $(id).onclick = () => {
    set(!get()); save(); haptic(10);
    if(id === 'adaptiveSw' || id === 'warmSw') requestRender(); else renderSettings();
  };
  bindSwitch('adaptiveSw', () => S.adaptive, v => { S.adaptive = v; toast(v ? '実績反映モード ON' : '計画固定モード'); });
  bindSwitch('restSw',  () => S.rest.on, v => { S.rest.on = v; if(!v) stopTimer(); });
  bindSwitch('soundSw', () => S.rest.sound, v => { S.rest.sound = v; if(v){ unlockAudio(); beep(); } });
  bindSwitch('vibeSw',  () => S.rest.vibrate, v => { S.rest.vibrate = v; if(v) haptic([60,50,60]); });
  bindSwitch('warmSw',  () => S.warmup, v => { S.warmup = v; });
  $('btnNextCycle').onclick = startNextCycle;

  /* データ入出力 */
  $('btnExport').onclick = () => {
    download(`bench120-backup-${stamp()}.json`, JSON.stringify(S, null, 1), 'application/json');
    toast('バックアップを書き出しました');
  };
  $('btnCsv').onclick = () => {
    const csv = toCSV(S);
    if(csv.split('\r\n').length <= 1){ toast('書き出せる記録がまだありません'); return; }
    download(`bench120-log-${stamp()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
    toast('CSVを書き出しました');
  };
  $('btnImport').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const f = input.files?.[0];
    input.value = '';
    if(!f) return;
    if(f.size > 5*1024*1024){ toast('ファイルが大きすぎます'); return; }
    try{
      const d = JSON.parse(await f.text());
      if(!d || typeof d !== 'object' || !d.maxes) throw new Error('形式が違います');
      const next = migrate(d, Date.now());
      const n = PROGRAM.filter(s => next.logs[s.id]).length;
      if(!await ask({title:'バックアップを読み込む',
        body:`現在のデータは<b>上書き</b>されます。<div style="margin-top:8px">記録 ${n} セッション ・ 履歴 ${next.history.length} サイクル ・ サイクル${next.cycle.n}</div>`,
        ok:'読み込む', danger:true})) return;
      withUndo('読み込みました', () => { replaceState(next); applyTheme(); });
    }catch(err){ toast('読み込めないファイルです'); }
  };
  $('btnReset').onclick = async () => {
    if(!await ask({title:'記録をすべてリセット',
      body:'セットのチェック・実績記録・メモを削除します。<b>MAX・設定・サイクル履歴は残ります。</b>',
      ok:'リセット', danger:true})) return;
    withUndo('記録をリセットしました', () => {
      S.sets = {}; S.logs = {}; S.notes = {}; S.ui.week = 1; S.ui.day = 1; stopTimer();
    });
  };
  $('btnTour').onclick = () => startOnboarding();
}

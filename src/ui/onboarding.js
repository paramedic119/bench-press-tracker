/**
 * 初期設定ウィザード。MAX → ジムの機材 → タイマー の3ステップ。
 */
import { ROUND_OPTIONS, microFor, fmtKg } from '../core/index.js';
import { $, $inp, qsa, dataNum } from './dom.js';
import { S, saveNow } from './store.js';
import { requestGoto } from './events.js';
import { applyTheme } from './theme.js';
import { haptic, toast } from './feedback.js';
import { clampInput, stepperHTML } from './stepper.js';
import { MAX_ROWS } from './fields.js';

let obStep = 0;
export function startOnboarding(){ obStep = 0; $('onboard').classList.add('show'); document.body.style.overflow = 'hidden'; paintOnboard(); }
function endOnboarding(){
  $('onboard').classList.remove('show'); $('onboard').innerHTML = '';
  document.body.style.overflow = '';
  S.onboarded = true; saveNow(); applyTheme(); requestGoto('workout');
}
function paintOnboard(){
  const el = $('onboard');
  const dots = `<div class="obdots">${[0,1,2].map(i=>`<i class="${i===obStep?'on':''}"></i>`).join('')}</div>`;
  const steps = [
    {
      head: 'BENCH <span>120</span>', sub: '12週間でベンチプレスのMAXを引き上げるプログラムです。<br>まず現在のMAXを入れてください。あとから設定でいつでも変えられます。',
      body: MAX_ROWS.map(([k, label]) =>
        `<div class="maxrow"><span>${label}</span>${stepperHTML('ob'+k, 'max', fmtKg(S.maxes[k]), {aria:label+'のMAX kg', attrs:'step="0.5"'})}</div>`).join('')
        + `<p style="font-size:.68rem;color:var(--muted);line-height:1.8;margin-top:10px">
             ナロー・足上げが未測定なら、ベンチの 90% / 85% くらいを目安に入れておけば大丈夫です。</p>`,
      next: '次へ',
      commit(){ MAX_ROWS.forEach(([k]) => { S.maxes[k] = clampInput($inp('ob'+k), 'max'); }); },
    },
    {
      head: 'ジムの設定', sub: '使えるプレートとバーに合わせると、表示重量とプレート計算が正確になります。',
      body: `<div class="sgroup"><h3>重量の丸め<small>2.5kg刻みが一般的です（バーに実際に載る値のみ）</small></h3><div class="optrow" id="obRound"></div></div>
             <div class="sgroup"><h3>バー重量</h3><div class="optrow" id="obBar"></div></div>`,
      next: '次へ',
      after(){
        const pick = (host, list, cur, set) => {
          $(host).innerHTML = list.map(([v, l]) => `<button class="opt ${cur===v?'sel':''}" type="button" data-v="${v}">${l}</button>`).join('');
          for(const b of qsa($(host), '.opt')) b.onclick = () => { set(dataNum(b, 'v')); haptic(); paintOnboard(); };
        };
        pick('obRound', ROUND_OPTIONS.map(v => [v, v > 0 ? fmtKg(v)+' kg' : '丸めなし']), S.round,
             v => { S.round = v; if(v > 0 && S.micro > microFor(v)) S.micro = microFor(v); });
        pick('obBar', [[20,'20 kg'], [15,'15 kg'], [10,'10 kg']], S.bar, v => S.bar = v);
      },
    },
    {
      head: '準備完了', sub: 'セットの丸ボタンを押すと完了になり、インターバルタイマーが自動で走ります。<br>重量・回数・RPEを残したいときは「セット毎に記録」を開いてください。',
      body: `<div class="sgroup"><div class="switchrow"><p>セット完了で<b>インターバルタイマー</b>を自動スタート</p>
               <button class="sw" id="obRest" role="switch"></button></div></div>
             <div class="sgroup"><div class="switchrow"><p>カードに<b>ウォームアップ</b>を表示</p>
               <button class="sw" id="obWarm" role="switch"></button></div></div>
             <p style="font-size:.68rem;color:var(--muted);line-height:1.8">
               ホーム画面に追加すると、オフラインでもアプリとして使えます。</p>`,
      next: 'はじめる',
      after(){
        const t = (id, get, set) => {
          const el2 = $(id);
          el2.className = 'sw' + (get() ? ' on' : ''); el2.setAttribute('aria-checked', String(get()));
          el2.onclick = () => { set(!get()); haptic(10); paintOnboard(); };
        };
        t('obRest', () => S.rest.on, v => S.rest.on = v);
        t('obWarm', () => S.warmup, v => S.warmup = v);
      },
    },
  ];
  const st = steps[obStep];
  el.innerHTML = `<div class="obstep">
      <div class="obhead">${st.head}</div>
      <div class="obsub">${st.sub}</div>
      ${st.body}
    </div>
    ${dots}
    <div class="obacts">
      <button class="obskip" type="button" id="obSkip">${obStep===0?'スキップ':'戻る'}</button>
      <button class="obnext" type="button" id="obNext">${st.next}</button>
    </div>`;
  st.after?.();
  $('obSkip').onclick = () => {
    if(obStep === 0){ endOnboarding(); return; }
    steps[obStep].commit?.(); obStep--; paintOnboard();
  };
  $('obNext').onclick = () => {
    st.commit?.(); saveNow();
    if(obStep < steps.length-1){ obStep++; paintOnboard(); }
    else { endOnboarding(); toast('Week 1 Day 1 から始めましょう'); }
  };
}
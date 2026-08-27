/**
 * アプリの入口。ページの切り替えと起動手順だけを持ち、描画の中身は各ページに任せる。
 */
import { isDayDone, firstIncompleteDay } from '../core/index.js';
import { $, qsa, dataStr } from './dom.js';
import { S, save, storage, showBanner, initPersistence } from './store.js';
import { onRender, onGoto, onStateReplaced } from './events.js';
import { initTheme, applyTheme } from './theme.js';
import { toast, haptic } from './feedback.js';
import { initTimer } from './timer.js';
import { initSteppers } from './stepper.js';
import { renderHead } from './header.js';
import { startOnboarding } from './onboarding.js';
import { registerSW, initUpdateButton } from './sw-register.js';
import { renderWorkout } from './pages/workout.js';
import { renderProgress } from './pages/progress.js';
import { renderHistory } from './pages/history.js';
import { renderSettings, initSettings } from './pages/settings.js';

const RENDERERS = {
  workout: renderWorkout,
  progress: renderProgress,
  history: renderHistory,
  settings: renderSettings,
};

let currentPage = 'workout';

/** ページを切り替える。表示中のページだけ描画する。 */
export function goto(page, {scroll = true} = {}){
  if(!RENDERERS[page]) return;
  currentPage = page;
  for(const b of qsa(document, 'nav button')){
    const on = b.dataset.page === page;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-selected', String(on));
  }
  for(const p of qsa(document, '.page')) p.classList.toggle('active', p.id === 'page-' + page);
  RENDERERS[page]();
  renderHead();
  if(scroll) scrollTo(0, 0);
}

/** 表示中のページを描き直す */
function renderAll(){
  RENDERERS[currentPage]?.();
  renderHead();
}

function initNav(){
  for(const b of qsa(document, 'nav button')) b.onclick = () => { goto(dataStr(b, 'page') || 'workout'); haptic(); };

  $('btnToday').onclick = () => {
    const t = firstIncompleteDay(S.sets);
    if(!t){ goto('progress'); toast('12週すべて完了しています'); return; }
    S.ui.week = t.week; S.ui.day = t.day; save();
    goto('workout'); haptic();
    toast(`Week ${t.week} Day ${t.day} — 次のセッション`);
  };

  addEventListener('scroll', () => {
    $('appHeader').classList.toggle('stuck', scrollY > 4);
  }, {passive: true});
}

function boot(){
  initTheme();
  initPersistence();
  initSteppers();
  initTimer();
  initNav();
  initSettings();
  initUpdateButton();

  onRender(renderAll);
  onGoto(goto);
  /* 取り消しや JSON 読み込みで状態が入れ替わったら、テーマも追従させる */
  onStateReplaced(applyTheme);
  /* オンライン状態は設定画面に出しているので、変化したら描き直す */
  for(const ev of ['online', 'offline']) addEventListener(ev, () => { if(currentPage === 'settings') renderSettings(); });

  if(!storage.ok) showBanner();

  /* 保存されている日がすでに完了済みなら、次の未完了セッションへ進める */
  if(isDayDone(S.sets, S.ui.week, S.ui.day)){
    const t = firstIncompleteDay(S.sets);
    if(t){ S.ui.week = t.week; S.ui.day = t.day; }
  }

  goto('workout', {scroll: false});
  if(!S.onboarded) startOnboarding();
  registerSW();
}

/* 想定外のエラーで白画面にしない */
addEventListener('error', e => {
  console.error(e.error || e.message);
  toast('エラーが発生しました。設定からバックアップを取ってください');
});
addEventListener('unhandledrejection', e => console.error(e.reason));

boot();

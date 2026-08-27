/**
 * 3RM / 5RM / 8RM の推移。
 * 実際に記録したセットだけを使い、過去サイクルも含めて日付軸で並べる。
 */
import { EX, REP_TARGETS, REP_WINDOW, repMaxSeries, latestRepMaxes, fmt, fmtSigned } from '../../core/index.js';
import { $, fmtDate, setShown } from '../dom.js';
import { S } from '../store.js';

export const RM_COLOR = {3:'var(--accent)', 5:'var(--actual)', 8:'var(--ok)'};

/**
 * 3RM / 5RM / 8RM の推移。
 * 実際に記録したセットだけを使い、過去サイクルも含めて時系列（日付軸）で並べる。
 */
export function renderRepMax(ex){
  const series = repMaxSeries(S, ex);
  const stats = latestRepMaxes(series);
  const targets = REP_TARGETS.filter(t => stats[t]);
  const cycles = new Set(series.map(p => p.key)).size;

  $('rmTitle').textContent = `${EX[ex]} — レップマックスの推移`;

  /* SVG要素は hidden プロパティを持たないので属性で切り替える */
  const show = (id, on) => setShown($(id), on);
  if(!targets.length){
    $('rmEmpty').innerHTML = `<span class="big">📈</span>${EX[ex]}の記録がまだありません。<br>
      「セット毎に記録」で重量・回数・RPEを残すと、そこから 3RM / 5RM / 8RM を推定して並べます。`;
    show('rmEmpty', true);
    for(const id of ['rmChart','rmLegend','rmRow','rmNote']) show(id, false);
    return;
  }
  show('rmEmpty', false);
  for(const id of ['rmChart','rmLegend','rmRow','rmNote']) show(id, true);

  /* 現在値カード */
  $('rmRow').innerHTML = REP_TARGETS.map(t => {
    const st = stats[t];
    if(!st) return `<div class="rmcell none"><div class="k">${t}RM</div><div class="v">—</div>
      <div class="d flat">記録なし</div></div>`;
    const d = st.current - st.first;
    const cls = st.n < 2 ? 'flat' : d > 0.05 ? '' : d < -0.05 ? 'dn' : 'flat';
    return `<div class="rmcell"><div class="k">${t}RM</div>
      <div class="v" style="color:${RM_COLOR[t]}">${fmt(st.current)}<small> kg</small></div>
      <div class="d ${cls}">${st.n < 2 ? `${fmtDate(st.t)}` : `${fmtSigned(d)} kg`}</div></div>`;
  }).join('');

  $('rmNote').innerHTML = `各回数から±${REP_WINDOW}レップ以内のセットだけを使って推定しています
    （${targets.map(t => `${t}RM ← ${Math.max(1, t-REP_WINDOW)}〜${t+REP_WINDOW}回`).join(' / ')}）。
    過去のサイクルを含む、記録のある${cycles}日分の推移です。`;

  /* --- 折れ線（時間軸） --- */
  const W = 340, H = 200, pad = {l:34, r:10, t:12, b:20};
  const vals = series.flatMap(p => targets.map(t => p.rm[t])).filter(v => v !== undefined);
  let ymin = Math.min(...vals), ymax = Math.max(...vals);
  const span = Math.max(ymax - ymin, 4); ymin -= span*.12; ymax += span*.12;
  const Y = v => H - pad.b - (H - pad.t - pad.b) * ((v - ymin)/(ymax - ymin));

  const tmin = series[0].t, tmax = series[series.length-1].t;
  const spanT = tmax - tmin;
  const mid = pad.l + (W - pad.l - pad.r)/2;
  const X = t => spanT <= 0 ? mid : pad.l + (W - pad.l - pad.r) * ((t - tmin)/spanT);

  let svg = '';
  for(let g = 0; g < 4; g++){
    const v = ymin + (ymax - ymin)*g/3, y = Y(v);
    svg += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W-pad.r}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${pad.l-4}" y="${(y+3).toFixed(1)}" fill="var(--muted)" font-size="9" text-anchor="end">${Math.round(v)}</text>`;
  }
  /* 日付の目盛り */
  const ticks = spanT <= 0 ? 1 : 4;
  for(let i = 0; i < ticks; i++){
    const t = ticks === 1 ? tmin : tmin + spanT*i/(ticks-1);
    const anchor = ticks === 1 ? 'middle' : i === 0 ? 'start' : i === ticks-1 ? 'end' : 'middle';
    svg += `<text x="${X(t).toFixed(1)}" y="${H-6}" fill="var(--muted)" font-size="8" text-anchor="${anchor}">${fmtDate(t)}</text>`;
  }
  /* サイクルの切れ目に縦線を入れる */
  let marks = 0;
  for(const h of S.history){
    if(!(h.ended > tmin && h.ended < tmax)) continue;
    marks++;
    svg += `<line x1="${X(h.ended).toFixed(1)}" y1="${pad.t}" x2="${X(h.ended).toFixed(1)}" y2="${H-pad.b}"
      stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3" opacity=".55"/>`;
  }
  setShown($('rmCycleKey'), marks > 0);
  for(const t of targets){
    const pts = series.filter(p => p.rm[t] !== undefined);
    const line = pts.map(p => `${X(p.t).toFixed(1)},${Y(p.rm[t]).toFixed(1)}`).join(' ');
    if(pts.length > 1)
      svg += `<polyline fill="none" stroke="${RM_COLOR[t]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${line}"/>`;
    svg += pts.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.rm[t]).toFixed(1)}" r="${pts.length > 24 ? 2 : 3}" fill="${RM_COLOR[t]}"/>`).join('');
  }
  $('rmChart').innerHTML = svg;
}

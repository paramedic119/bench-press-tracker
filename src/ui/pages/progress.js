/**
 * 進捗画面。計画（オレンジ）と実績（青）を重ねて、ズレを一目で見せる。
 */
import { PROGRAM, EX, MKEY, isMaxTest, computePlan, bestOf, weekVolumes,
         cycleBestOf, sessionDate, present, fmt, fmtKg, fmtSigned } from '../../core/index.js';
import { $, qsa, fmtDate, setShown } from '../dom.js';
import { S, save } from '../store.js';
import { haptic } from '../feedback.js';
import { renderRepMax } from './repmax.js';

export function renderProgress(){
  const plan = computePlan(S.maxes, {adaptive:S.adaptive, logs:S.logs});
  const ex = S.ui.ex;

  $('extabs').innerHTML = Object.keys(EX).map(k =>
    `<button class="dtab ${ex===k?'sel':''}" data-ex="${k}" role="tab" aria-selected="${ex===k}">${EX[k]}</button>`).join('');
  for(const b of qsa($('extabs'), '[data-ex]')) b.onclick = () => {
    S.ui.ex = /** @type {ExKey} */ (b.dataset.ex); save(); renderProgress(); haptic();
  };

  const pts = PROGRAM.filter(s => s.ex===ex).map(s => ({s, pe:plan.H[s.id], ae:bestOf(S.logs[s.id])}));
  const startMax = S.maxes[MKEY[ex]];
  const actuals = pts.filter(p => p.ae !== null);
  const current = actuals.length ? actuals[actuals.length-1].ae : null;
  const curDate = actuals.length ? sessionDate(S, actuals[actuals.length-1].s.id) : null;
  const peak = Math.max(...pts.map(p => p.pe));
  const best = actuals.length ? Math.max(...actuals.map(p => p.ae)) : null;

  /* 今週(月曜始まり)のトレ日数と、前回からの経過日数（全種目） */
  const dts = PROGRAM.map(s => sessionDate(S, s.id)).filter(present);
  const lastT = dts.length ? Math.max(...dts) : null;
  const mon = new Date(); mon.setHours(0,0,0,0); mon.setDate(mon.getDate() - ((mon.getDay()+6)%7));
  const wkDays = new Set(PROGRAM.filter(s => {
    const t = sessionDate(S, s.id); return t && t >= mon.getTime();
  }).map(s => s.week+'-'+s.day)).size;
  const gap = lastT !== null ? Math.floor((Date.now()-lastT)/864e5) : null;

  const deltaHtml = current === null
    ? '<div class="delta flat">計画上のピーク</div>'
    : (d => `<div class="delta${d < 0 ? ' warn' : d === 0 ? ' flat' : ''}">${fmtSigned(d)} kg${curDate ? ` ・ ${fmtDate(curDate)}` : ''}</div>`)(current - startMax);
  $('statgrid').innerHTML = `
    <div class="stat"><div class="lbl">開始MAX</div><div class="val num">${fmtKg(startMax)}<small> kg</small></div>
      <div class="delta flat">サイクル${S.cycle.n}</div></div>
    <div class="stat"><div class="lbl">${current!==null?'直近の実績e1RM':'計画ピークe1RM'}</div>
      <div class="val num" style="color:${current!==null?'var(--actual)':'var(--accent)'}">${fmt(current!==null?current:peak)}<small> kg</small></div>
      ${deltaHtml}</div>
    <div class="stat"><div class="lbl">今週</div><div class="val num">${wkDays}<small> /3日</small></div>
      <div class="delta${gap!==null&&gap>=4?' warn':' flat'}">${gap===null?'記録なし':gap===0?'今日トレ済み':`前回から${gap}日`}</div></div>`;

  $('chartTitle').textContent = `${EX[ex]} — 推定1RMの推移（全${pts.length}セッション${best!==null?` ・ ベスト ${fmt(best)}kg`:''}）`;

  /* --- e1RM 折れ線 --- */
  const Wd = 340, Hd = 220, pad = {l:34, r:8, t:12, b:22};
  const ys = pts.flatMap(p => [p.pe, p.ae]).filter(v => v !== null);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  const span = Math.max(ymax-ymin, 4); ymin -= span*.1; ymax += span*.1;
  const X = i => pad.l + (Wd-pad.l-pad.r) * (pts.length===1 ? .5 : i/(pts.length-1));
  const Y = v => Hd - pad.b - (Hd-pad.t-pad.b) * ((v-ymin)/(ymax-ymin));
  let svg = '';
  for(let g=0; g<4; g++){
    const v = ymin + (ymax-ymin)*g/3, y = Y(v);
    svg += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${Wd-pad.r}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${pad.l-4}" y="${(y+3).toFixed(1)}" fill="var(--muted)" font-size="9" text-anchor="end">${Math.round(v)}</text>`;
  }
  let lastW = 0;
  pts.forEach((p, i) => { if(p.s.week !== lastW){ lastW = p.s.week;
    if(lastW % 2 === 1) svg += `<text x="${X(i).toFixed(1)}" y="${Hd-6}" fill="var(--muted)" font-size="8" text-anchor="middle">W${lastW}</text>`;
  }});
  const line = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.pe).toFixed(1)}`).join(' ');
  svg += `<polygon points="${X(0).toFixed(1)},${Hd-pad.b} ${line} ${X(pts.length-1).toFixed(1)},${Hd-pad.b}"
      fill="var(--accent)" opacity=".07"/>`;
  svg += `<polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" points="${line}"/>`;
  const aeIdx = pts.map((p,i)=>p.ae!==null?i:-1).filter(i=>i>=0);
  if(aeIdx.length > 1)
    svg += `<polyline fill="none" stroke="var(--actual)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7"
      points="${aeIdx.map(i => `${X(i).toFixed(1)},${Y(pts[i].ae).toFixed(1)}`).join(' ')}"/>`;
  pts.forEach((p, i) => {
    if(isMaxTest(p.s))
      svg += `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.pe).toFixed(1)}" r="4" fill="var(--bg)" stroke="var(--accent)" stroke-width="1.6"/>`;
    if(p.ae !== null)
      svg += `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.ae).toFixed(1)}" r="4" fill="var(--actual)"/>`;
  });
  $('chart').innerHTML = svg;

  /* --- レップマックス（3RM / 5RM / 8RM）の推移 --- */
  renderRepMax(ex);

  /* --- 週間ボリューム --- */
  const vw = weekVolumes(plan.W);
  const Wv = 340, Hv = 170, pv = {l:34, r:8, t:10, b:20};
  const vmax = Math.max(...vw.map(v => v.tot)) * 1.05 || 1;
  const Yv = v => Hv - pv.b - (Hv-pv.t-pv.b) * (v/vmax);
  const bw = (Wv-pv.l-pv.r)/12, y0 = Hv-pv.b;
  let sv = '';
  for(let g=0; g<4; g++){
    const v = vmax*g/3, y = Yv(v);
    sv += `<line x1="${pv.l}" y1="${y.toFixed(1)}" x2="${Wv-pv.r}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${pv.l-4}" y="${(y+3).toFixed(1)}" fill="var(--muted)" font-size="9" text-anchor="end">${v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)}</text>`;
  }
  vw.forEach((v, i) => {
    const bx = pv.l + bw*(i+.5), cur = i+1 === S.ui.week;
    sv += `<rect x="${(bx-bw*.31).toFixed(1)}" y="${Yv(v.tot).toFixed(1)}" width="${(bw*.62).toFixed(1)}" height="${(y0-Yv(v.tot)).toFixed(1)}" fill="var(--surface-3)" rx="2"/>
      <rect x="${(bx-bw*.15).toFixed(1)}" y="${Yv(v.adj).toFixed(1)}" width="${(bw*.3).toFixed(1)}" height="${(y0-Yv(v.adj)).toFixed(1)}" fill="var(--accent)" rx="2"/>
      <text x="${bx.toFixed(1)}" y="${Hv-6}" fill="${cur?'var(--accent)':'var(--muted)'}" font-size="8" text-anchor="middle" font-weight="${cur?700:400}">${i+1}</text>`;
  });
  $('volChart').innerHTML = sv;

  /* --- サイクルごとのMAX推移（履歴がある場合のみ） --- */
  const key = MKEY[ex];
  const hist = S.history.filter(h => h.maxesStart && typeof h.maxesStart[key] === 'number');
  if(!hist.length){ setShown($('cycleBox'), false); }
  else{
    setShown($('cycleBox'), true);
    /** @type {{lbl:string, v:number, act?:boolean}[]} */
    const cpts = hist.map(h => ({lbl:'C'+h.n, v:h.maxesStart[key]}));
    cpts.push({lbl:'C'+S.cycle.n, v:S.maxes[key]});
    const cb = cycleBestOf(S.logs)[ex];
    if(cb !== null) cpts.push({lbl:'今', v:cb, act:true});
    const d = S.maxes[key] - cpts[0].v;
    $('cycleTitle').textContent = `${EX[ex]} — サイクルごとのMAX推移（通算 ${fmtSigned(d)}kg）`;
    const Wc = 340, Hc = 170, pc = {l:34, r:14, t:16, b:20};
    const vs = cpts.map(p => p.v);
    let cmin = Math.min(...vs), cmax = Math.max(...vs);
    const csp = Math.max(cmax-cmin, 4); cmin -= csp*.15; cmax += csp*.15;
    const Xc = i => pc.l + (Wc-pc.l-pc.r) * (cpts.length===1 ? .5 : i/(cpts.length-1));
    const Yc = v => Hc - pc.b - (Hc-pc.t-pc.b) * ((v-cmin)/(cmax-cmin));
    let sc = '';
    for(let g=0; g<4; g++){
      const v = cmin + (cmax-cmin)*g/3, y = Yc(v);
      sc += `<line x1="${pc.l}" y1="${y.toFixed(1)}" x2="${Wc-pc.r}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
        <text x="${pc.l-4}" y="${(y+3).toFixed(1)}" fill="var(--muted)" font-size="9" text-anchor="end">${Math.round(v)}</text>`;
    }
    sc += `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${cpts.map((p,i)=>`${Xc(i).toFixed(1)},${Yc(p.v).toFixed(1)}`).join(' ')}"/>`;
    cpts.forEach((p, i) => {
      /* 端の点はラベルが枠外に出るのでアンカーを内側へ寄せる */
      const anchor = i === 0 ? 'start' : i === cpts.length-1 ? 'end' : 'middle';
      const lx = (i === 0 ? Xc(i)-3 : i === cpts.length-1 ? Xc(i)+3 : Xc(i)).toFixed(1);
      sc += `<circle cx="${Xc(i).toFixed(1)}" cy="${Yc(p.v).toFixed(1)}" r="4" fill="${p.act?'var(--actual)':'var(--accent)'}"/>
        <text x="${lx}" y="${Hc-6}" fill="var(--muted)" font-size="9" text-anchor="${anchor}">${p.lbl}</text>
        <text x="${lx}" y="${(Yc(p.v)-8).toFixed(1)}" fill="${p.act?'var(--actual)':'var(--text)'}" font-size="9" text-anchor="${anchor}">${fmt(p.v)}</text>`;
    });
    $('cycleChart').innerHTML = sc;
  }
}

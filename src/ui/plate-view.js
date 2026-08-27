/**
 * プレートの見た目。左右対称に並べ、載せられない端数はその場で伝える。
 */
import { plateBreakdown, platesFor, PLATE_CLASS, fmtKg } from '../core/index.js';
import { S } from './store.js';

/**
 * @returns {{bar:string, label:string, warn:boolean}} bar は .plates に流し込む HTML
 */
export function plateHTML(total){
  const {light, used, rest:remainder} = plateBreakdown(total, S.bar, platesFor(S.micro));
  if(light) return {bar:'', label:`バー(${fmtKg(S.bar)}kg)より軽い重量です`, warn:true};
  const p = kg => `<div class="plate ${PLATE_CLASS[kg]}"></div>`;
  const html = used.slice().reverse().map(p).join('')
    + '<div class="sleeve"></div><div class="bar"></div><div class="sleeve"></div>'
    + used.map(p).join('');
  const warn = remainder > 0.01;
  const label = (used.length ? `片側 ${used.map(fmtKg).join(' + ')} kg` : 'バーのみ')
    + (warn ? ` ・ 端数 ${fmtKg(remainder)}kg（片側）は載せられません` : '');
  return {bar:html, label, warn};
}

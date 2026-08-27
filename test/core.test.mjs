/**
 * index.html の /*<core>*​/ 〜 /*</core>*​/ ブロックを抜き出して検証する。
 * アプリを単一ファイルのまま保ちつつ、計算ロジックにはテストを効かせる。
 *   実行: npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const m = html.match(/\/\*<core>\*\/([\s\S]*?)\/\*<\/core>\*\//);
assert.ok(m, 'index.html に core ブロックが見つかりません');
// 同一レルムで評価する（別レルムだと deepEqual が prototype 差で落ちる）
const C = new Function(`'use strict';${m[1]};return CORE;`)();

const NOW = Date.UTC(2026, 0, 15, 9, 0, 0);

describe('e1RM の数式（Excel互換）', () => {
  test('RPE10シングルは実重量そのもの', () => {
    assert.equal(C.e1rm(140, 1, 10), 140);
  });
  test('通常式: w*(reps+10-rpe)/33 + w', () => {
    assert.equal(C.e1rm(100, 5, 8), 100 * (5 + 10 - 8) / 33 + 100);
    assert.ok(Math.abs(C.e1rm(100, 5, 8) - 121.2121) < 1e-3);
  });
  test('suggestW は e1rm の逆関数', () => {
    for(const [reps, rpe] of [[5,8],[3,9],[8,7],[1,9.5],[1,10]]){
      const w = 97.5;
      const back = C.suggestW(C.e1rm(w, reps, rpe), reps, rpe);
      assert.ok(Math.abs(back - w) < 1e-9, `reps=${reps} rpe=${rpe} → ${back}`);
    }
  });
  test('回数が増えるほど、RPEが下がるほど e1RM は上がる', () => {
    assert.ok(C.e1rm(100, 6, 8) > C.e1rm(100, 5, 8));
    assert.ok(C.e1rm(100, 5, 7) > C.e1rm(100, 5, 8));
  });
});

describe('プログラム定義', () => {
  test('58セッション・週1〜12・日1〜3', () => {
    assert.equal(C.PROGRAM.length, 57);
    for(const s of C.PROGRAM){
      assert.ok(s.week >= 1 && s.week <= 12, `week=${s.week}`);
      assert.ok([1,2,3].includes(s.day), `day=${s.day}`);
      assert.ok(['BP','NR','LG'].includes(s.ex));
      assert.ok(s.sets >= 1 && s.reps >= 1);
      assert.ok(s.rpe >= 5 && s.rpe <= 10);
    }
  });
  test('id は一意', () => {
    assert.equal(new Set(C.PROGRAM.map(s => s.id)).size, C.PROGRAM.length);
  });
  test('参照チェーンは必ず自分より前のセッションを指す', () => {
    const seen = new Set();
    for(const s of C.PROGRAM){
      if(typeof s.ref === 'number') assert.ok(seen.has(s.ref), `id=${s.id} が未計算の ${s.ref} を参照`);
      else assert.ok(['MB','MN','ML'].includes(s.ref));
      seen.add(s.id);
    }
  });
  test('全12週にテスト週(4/8/12)のRPE10シングルがある', () => {
    for(const w of C.TEST_WEEKS)
      assert.ok(C.PROGRAM.some(s => s.week === w && C.isMaxTest(s)), `week ${w}`);
  });
  test('最終テストIDは Week12 Day3 のベンチ', () => {
    const s = C.BY_ID.get(C.FINAL_TEST_ID);
    assert.equal(s.week, 12); assert.equal(s.day, 3); assert.equal(s.ex, 'BP');
    assert.ok(C.isMaxTest(s));
  });
});

describe('computePlan', () => {
  const maxes = {MB:110, MN:105, ML:100};
  test('全セッションに有限の重量が付く', () => {
    const {W, H} = C.computePlan(maxes);
    for(const s of C.PROGRAM){
      assert.ok(Number.isFinite(W[s.id]) && W[s.id] > 0, `id=${s.id}`);
      assert.ok(Number.isFinite(H[s.id]) && H[s.id] > 0, `id=${s.id}`);
    }
  });
  test('最初のセッションは MAX×係数', () => {
    const {W} = C.computePlan(maxes);
    assert.ok(Math.abs(W[6] - 110 * 0.83) < 1e-9);
  });
  test('MAXを上げると全セッションの重量が上がる（単調）', () => {
    const a = C.computePlan(maxes).W;
    const b = C.computePlan({MB:120, MN:105, ML:100}).W;
    assert.ok(b[6] > a[6]);
    assert.ok(b[121] > a[121], '最終テストまで伝播する');
    for(const s of C.PROGRAM.filter(x => x.ex === 'BP')) assert.ok(b[s.id] >= a[s.id] - 1e-9);
  });
  test('adaptive=false のとき記録は計画に影響しない', () => {
    const logs = {6:[{w:200, reps:5, rpe:8}]};
    assert.deepEqual(C.computePlan(maxes).W, C.computePlan(maxes, {adaptive:false, logs}).W);
  });
  test('adaptive=true のとき実績ベストが以降へ伝播する', () => {
    const base = C.computePlan(maxes).W;
    const logs = {6:[{w:140, reps:5, rpe:8}]};   // 計画(91.3kg)より大幅に強い
    const adapt = C.computePlan(maxes, {adaptive:true, logs}).W;
    assert.equal(adapt[6], base[6], '当該セッション自身の重量は計画のまま');
    assert.ok(adapt[11] > base[11], 'id=6 を参照する id=11 に反映される');
  });
  test('MAXを2倍にすると重量も2倍（線形チェーン）', () => {
    const a = C.computePlan({MB:100, MN:100, ML:100}).W;
    const b = C.computePlan({MB:200, MN:200, ML:200}).W;
    for(const s of C.PROGRAM) assert.ok(Math.abs(b[s.id] - a[s.id]*2) < 1e-6, `id=${s.id}`);
  });
});

describe('bestOf', () => {
  test('記録なしは null', () => {
    assert.equal(C.bestOf(undefined), null);
    assert.equal(C.bestOf([]), null);
    assert.equal(C.bestOf([null, null]), null);
  });
  test('最大の e1RM を返す', () => {
    const v = C.bestOf([{w:100,reps:5,rpe:8}, {w:130,reps:1,rpe:10}, null, {w:90,reps:8,rpe:7}]);
    assert.equal(v, 130);
  });
  test('見た目が軽くても高回数セットの方が e1RM が高いことがある', () => {
    // 100kg×5@RPE8 = 121.2 > 120kg シングル
    assert.equal(C.bestOf([{w:100,reps:5,rpe:8}, {w:120,reps:1,rpe:10}]), C.e1rm(100,5,8));
  });
  test('不正な値は無視する', () => {
    assert.equal(C.bestOf([{w:0,reps:5,rpe:8}, {w:100,reps:0,rpe:8}, {w:100,reps:1,rpe:10}]), 100);
  });
});

describe('丸め・表示', () => {
  test('roundTo', () => {
    assert.equal(C.roundTo(91.3, 2.5), 92.5);
    assert.equal(C.roundTo(91.3, 1.25), 91.25);
    assert.equal(C.roundTo(91.3, 0.5), 91.5);
    assert.equal(C.roundTo(91.34567, 0), 91.35);
  });
  test('fmt: 整数はそのまま／小数は1桁／-0は0／末尾の0は落とす', () => {
    assert.equal(C.fmt(92.5), '92.5');
    assert.equal(C.fmt(90), '90');
    assert.equal(C.fmt(105.0416), '105', '105.0 ではなく 105');
    assert.equal(C.fmt(110.7407), '110.7');
    assert.equal(C.fmt(-0), '0');
    assert.equal(C.fmt(NaN), '—');
    assert.equal(C.fmt(Infinity), '—');
  });
  test('fmtKg: 1.25kg刻みを丸めずに出す', () => {
    assert.equal(C.fmtKg(1.25), '1.25');
    assert.equal(C.fmtKg(91.25), '91.25');
    assert.equal(C.fmtKg(92.5), '92.5');
    assert.equal(C.fmtKg(90), '90');
    assert.equal(C.fmtKg(-0), '0');
    assert.equal(C.fmtKg(NaN), '—');
  });
  test('fmtKg: プレートで作れる重量は必ず往復できる', () => {
    for(let t = 20; t <= 300; t += 1.25)
      assert.equal(+C.fmtKg(t), Math.round(t*100)/100, `${t}`);
  });
  test('fmtKgSigned', () => {
    assert.equal(C.fmtKgSigned(1.25), '+1.25');
    assert.equal(C.fmtKgSigned(-1.25), '-1.25');
  });
  test('fmtSigned', () => {
    assert.equal(C.fmtSigned(2.5), '+2.5');
    assert.equal(C.fmtSigned(-2.5), '-2.5');
    assert.equal(C.fmtSigned(0), '+0');
  });
  test('mmss', () => {
    assert.equal(C.mmss(0), '0:00');
    assert.equal(C.mmss(9), '0:09');
    assert.equal(C.mmss(180), '3:00');
    assert.equal(C.mmss(-5), '0:00');
  });
});

describe('プレート計算', () => {
  test('20kgバー・100kg → 片側 25+15（大きい順に貪欲）', () => {
    const r = C.plateBreakdown(100, 20);
    assert.deepEqual(r.used, [25, 15]);
    assert.equal(r.rest, 0);
  });
  test('20kgバー・142.5kg → 片側 25+25+10+1.25', () => {
    assert.deepEqual(C.plateBreakdown(142.5, 20).used, [25, 25, 10, 1.25]);
  });
  test('バーちょうどならプレートなし', () => {
    assert.deepEqual(C.plateBreakdown(20, 20).used, []);
  });
  test('バーより軽ければ light フラグ', () => {
    assert.equal(C.plateBreakdown(15, 20).light, true);
  });
  test('刻めない端数は rest に残る', () => {
    const r = C.plateBreakdown(21, 20);   // 片側 0.5kg
    assert.equal(r.rest, 0.5);
    assert.deepEqual(r.used, []);
  });
  test('組んだ重量は必ず元の重量以下・誤差は最小プレート未満', () => {
    for(let t = 20; t <= 260; t += 0.5){
      const r = C.plateBreakdown(t, 20);
      const built = 20 + r.used.reduce((a,b)=>a+b, 0)*2;
      assert.ok(built <= t + 1e-9, `${t} → ${built}`);
      assert.ok(t - built < 2.5, `${t} → 端数 ${t-built}`);
    }
  });
});

describe('プレート在庫（最小プレート設定）', () => {
  test('既定は1.25kgまで', () => {
    assert.deepEqual(C.platesFor(1.25), [25, 20, 15, 10, 5, 2.5, 1.25]);
  });
  test('0.25kgを持っていれば端数が減る', () => {
    const coarse = C.plateBreakdown(91.5, 20, C.platesFor(1.25));   // 片側 35.75
    const fine   = C.plateBreakdown(91.5, 20, C.platesFor(0.25));
    assert.equal(coarse.rest, 0.75);
    assert.equal(fine.rest, 0);
    assert.deepEqual(fine.used, [25, 10, 0.5, 0.25]);
  });
  test('在庫を増やすほど端数は減る（単調）', () => {
    for(let t = 20; t <= 200; t += 0.25){
      const a = C.plateBreakdown(t, 20, C.platesFor(1.25)).rest;
      const b = C.plateBreakdown(t, 20, C.platesFor(0.5)).rest;
      const c = C.plateBreakdown(t, 20, C.platesFor(0.25)).rest;
      assert.ok(b <= a + 1e-9 && c <= b + 1e-9, `${t}: ${a} ${b} ${c}`);
    }
  });
  test('どの在庫でも組んだ重量は目標を超えない', () => {
    for(const micro of C.MICRO_OPTIONS){
      const plates = C.platesFor(micro);
      for(let t = 20; t <= 200; t += 0.25){
        const r = C.plateBreakdown(t, 20, plates);
        const built = 20 + r.used.reduce((a,b)=>a+b, 0)*2;
        assert.ok(built <= t + 1e-9, `micro=${micro} ${t} → ${built}`);
        assert.ok(t - built < micro*2, `micro=${micro} ${t} 端数 ${t-built}`);
      }
    }
  });
  test('貪欲法だと失敗するケースも組める（片側1.5kg / 0.5kgまで所持）', () => {
    const r = C.plateBreakdown(23, 20, C.platesFor(0.5));   // 片側 1.5kg
    assert.equal(r.rest, 0, '1.25kgを取ると0.25kgが余ってしまう');
    assert.deepEqual(r.used, [0.5, 0.5, 0.5]);
  });
  test('枚数は最小になる', () => {
    assert.deepEqual(C.plateBreakdown(140, 20).used, [25, 25, 10]);          // 20+20+20 ではなく3枚
    assert.deepEqual(C.plateBreakdown(60, 20).used, [20]);
  });
  test('全プレートに表示用クラスがある', () => {
    for(const kg of C.PLATE_KG) assert.ok(C.PLATE_CLASS[kg], `${kg}kg のクラスがない`);
  });
  test('丸め刻みは必ずバーに載る値になっている', () => {
    for(const step of C.ROUND_OPTIONS){
      if(step === 0) continue;
      const plates = C.platesFor(C.microFor(step));
      for(let t = 40; t <= 240; t += step){
        const w = C.roundTo(t, step);
        assert.equal(C.plateBreakdown(w, 20, plates).rest, 0, `${step}kg刻みの ${w}kg が組めない`);
      }
    }
  });
  test('1.25kg刻みは（片側0.625kgが必要なので）選択肢に無い', () => {
    assert.ok(!C.ROUND_OPTIONS.includes(1.25));
  });
  test('microFor: 刻みに必要な最小プレート', () => {
    assert.equal(C.microFor(5), 1.25);
    assert.equal(C.microFor(2.5), 1.25);
    assert.equal(C.microFor(1), 0.5);
    assert.equal(C.microFor(0.5), 0.25);
  });
  test('migrate: 旧 1.25kg 刻みは 2.5kg に寄せる', () => {
    assert.equal(C.migrate({maxes:{MB:110,MN:105,ML:100}, round:1.25}, NOW).round, 2.5);
  });
  test('migrate: 刻みに対して粗すぎる最小プレートは自動で下げる', () => {
    const s = C.migrate({maxes:{MB:110,MN:105,ML:100}, round:0.5, micro:1.25}, NOW);
    assert.equal(s.micro, 0.25);
  });
  test('migrate: 不正な micro は既定値', () => {
    assert.equal(C.migrate({maxes:{MB:110,MN:105,ML:100}, micro:3}, NOW).micro, 1.25);
    assert.equal(C.migrate({maxes:{MB:110,MN:105,ML:100}, micro:0.5}, NOW).micro, 0.5);
  });
});

describe('ウォームアップ', () => {
  test('軽すぎる重量では出さない', () => {
    assert.deepEqual(C.warmupSets(22.5, 20, 2.5), []);
  });
  test('バーから始まり、メイン重量未満で単調増加', () => {
    const wu = C.warmupSets(100, 20, 2.5);
    assert.ok(wu.length >= 3);
    assert.equal(wu[0].w, 20);
    assert.equal(wu[0].isBar, true);
    for(let i = 1; i < wu.length; i++) assert.ok(wu[i].w > wu[i-1].w, 'ウォームアップは増加する');
    for(const x of wu) assert.ok(x.w < 100, 'メインセットより軽い');
  });
  test('丸め刻みに乗る', () => {
    for(const step of [2.5, 1.25, 0.5]){
      for(const x of C.warmupSets(137.5, 20, step))
        assert.ok(Math.abs(x.w / step - Math.round(x.w / step)) < 1e-9, `${x.w} が ${step} 刻みでない`);
    }
  });
  test('重量が重いほどアップのセット数が増える', () => {
    assert.ok(C.warmupSets(160, 20, 2.5).length >= C.warmupSets(40, 20, 2.5).length);
  });
});

describe('migrate（保存データの移行・検証）', () => {
  test('null/壊れた入力は既定値', () => {
    for(const bad of [null, undefined, 42, 'x', []]){
      const s = C.migrate(bad, NOW);
      assert.equal(s.v, C.SCHEMA_VERSION);
      assert.deepEqual(s.maxes, {MB:110, MN:105, ML:100});
      assert.equal(s.onboarded, false);
    }
  });
  test('v1（セッション単位のログ）をセット配列へ移行', () => {
    const s = C.migrate({maxes:{MB:120,MN:110,ML:100}, logs:{6:{w:100, reps:5, rpe:8, t:NOW}}}, NOW);
    assert.ok(Array.isArray(s.logs[6]));
    assert.equal(s.logs[6][0].w, 100);
  });
  test('既存ユーザー（v1データ）には初期設定を出さない', () => {
    assert.equal(C.migrate({maxes:{MB:120,MN:110,ML:100}}, NOW).onboarded, true);
    assert.equal(C.migrate({}, NOW).onboarded, false);
  });
  test('範囲外の値は既定値に落とす', () => {
    const s = C.migrate({maxes:{MB:-5, MN:'abc', ML:9999}, round:7, bar:99, theme:'neon',
      ui:{week:99, day:0, ex:'ZZ'}, rest:{main:99999, accessory:-1}}, NOW);
    assert.deepEqual(s.maxes, {MB:110, MN:105, ML:100});
    assert.equal(s.round, 2.5);
    assert.equal(s.bar, 20);
    assert.equal(s.theme, 'auto');
    assert.deepEqual(s.ui, {week:1, day:1, ex:'BP'});
    assert.equal(s.rest.main, 180);
    assert.equal(s.rest.accessory, 120);
  });
  test('存在しないセッションIDのログは捨てる', () => {
    const s = C.migrate({maxes:{MB:110,MN:105,ML:100}, logs:{999:[{w:100,reps:5,rpe:8}], 6:[{w:100,reps:5,rpe:8}]}}, NOW);
    assert.equal(s.logs[999], undefined);
    assert.ok(s.logs[6]);
  });
  test('壊れたログ1件だけを落として他は残す', () => {
    const s = C.migrate({maxes:{MB:110,MN:105,ML:100},
      logs:{6:[{w:100,reps:5,rpe:8}, {w:'x'}, {w:95,reps:5,rpe:8}]}}, NOW);
    assert.equal(s.logs[6].length, 3);
    assert.equal(s.logs[6][1], null);
    assert.equal(s.logs[6][2].w, 95);
  });
  test('RPEは1〜10にクランプ', () => {
    const s = C.migrate({maxes:{MB:110,MN:105,ML:100}, logs:{6:[{w:100,reps:5,rpe:99}]}}, NOW);
    assert.equal(s.logs[6][0].rpe, 10);
  });
  test('migrate は冪等', () => {
    const a = C.migrate({maxes:{MB:120,MN:110,ML:100}, logs:{6:[{w:100,reps:5,rpe:8,t:NOW}]},
      sets:{6:[NOW,false,NOW]}, notes:{'1-1':{text:'ok', bw:80, t:NOW}}, history:[]}, NOW);
    assert.deepEqual(C.migrate(JSON.parse(JSON.stringify(a)), NOW), a);
  });
  test('不正なメモのキーは捨てる', () => {
    const s = C.migrate({maxes:{MB:110,MN:105,ML:100},
      notes:{'1-1':{text:'good'}, '12-3':{text:'last'}, 'bad':{text:'x'},
             '1-9':{text:'y'}, '13-1':{text:'z'}, '0-1':{text:'w'}}}, NOW);
    assert.ok(s.notes['1-1']);
    assert.ok(s.notes['12-3']);
    for(const k of ['bad', '1-9', '13-1', '0-1']) assert.equal(s.notes[k], undefined, k);
  });
});

describe('進捗の集計', () => {
  const doneAll = () => {
    const sets = {};
    for(const s of C.PROGRAM) sets[s.id] = Array.from({length:s.sets}, () => NOW);
    return sets;
  };
  test('未着手', () => {
    assert.equal(C.cycleProgress({}).done, 0);
    assert.equal(C.isDayDone({}, 1, 1), false);
    assert.deepEqual(C.firstIncompleteDay({}), {week:1, day:1});
  });
  test('全完了', () => {
    const sets = doneAll();
    const p = C.cycleProgress(sets);
    assert.equal(p.done, p.total);
    assert.equal(p.ratio, 1);
    assert.equal(C.firstIncompleteDay(sets), null);
  });
  test('Week1 Day1 を終えると次は Day2', () => {
    const sets = {};
    for(const s of C.PROGRAM.filter(x => x.week===1 && x.day===1)) sets[s.id] = Array.from({length:s.sets}, () => NOW);
    assert.equal(C.isDayDone(sets, 1, 1), true);
    assert.deepEqual(C.firstIncompleteDay(sets), {week:1, day:2});
  });
  test('余分なチェックがあっても done は上限を超えない', () => {
    const s = C.PROGRAM[0];
    const sets = {[s.id]: Array.from({length:s.sets + 5}, () => NOW)};
    assert.ok(C.dayProgress(sets, s.week, s.day).done <= C.dayProgress(sets, s.week, s.day).total);
  });
  test('週の進捗率は 0〜1', () => {
    for(let w = 1; w <= 12; w++){
      const r = C.weekProgress(doneAll(), w);
      assert.equal(r.state, 'done');
      assert.equal(r.ratio, 1);
    }
  });
});

describe('ボリューム', () => {
  test('週ごとの合計が全セッションの合計と一致', () => {
    const {W} = C.computePlan({MB:110, MN:105, ML:100});
    const vw = C.weekVolumes(W);
    const sum = vw.reduce((a,v) => a + v.tot, 0);
    const direct = C.PROGRAM.reduce((a,s) => a + C.sessionVolume(W[s.id], s).vol, 0);
    assert.ok(Math.abs(sum - direct) < 1e-6);
  });
  test('補正ボリュームは総ボリューム以下', () => {
    const {W} = C.computePlan({MB:110, MN:105, ML:100});
    for(const v of C.weekVolumes(W)) assert.ok(v.adj <= v.tot + 1e-9);
  });
  test('テスト週はボリュームが落ちる（ディロード）', () => {
    const {W} = C.computePlan({MB:110, MN:105, ML:100});
    const vw = C.weekVolumes(W);
    for(const w of [4, 8, 12]) assert.ok(vw[w-1].tot < vw[w-2].tot, `week ${w}`);
  });
});

describe('インターバル秒の決定', () => {
  const r = {main:180, accessory:120, test:300};
  test('MAXテストは test', () => {
    assert.equal(C.restSecondsFor(C.BY_ID.get(41), r), 300);
  });
  test('RPE8.5以上は main', () => {
    assert.equal(C.restSecondsFor({reps:3, rpe:9, sets:3}, r), 180);
    assert.equal(C.restSecondsFor({reps:5, rpe:8.5, sets:4}, r), 180);
  });
  test('RPE8以下は accessory', () => {
    assert.equal(C.restSecondsFor({reps:5, rpe:8, sets:3}, r), 120);
  });
});

describe('トレーニング日・連続週', () => {
  const day = (y, m, d) => new Date(y, m-1, d, 10).getTime();
  test('現サイクルと履歴の両方を数える', () => {
    const st = C.migrate({maxes:{MB:110,MN:105,ML:100},
      sets:{6:[day(2026,1,5)]},
      history:[{n:1, started:0, ended:0, maxesStart:{MB:100,MN:95,ML:90},
                sets:{7:[day(2025,12,1)]}, logs:{}}]}, NOW);
    const map = C.trainingDays(st);
    assert.ok(map.has('2026-01-05'));
    assert.ok(map.has('2025-12-01'));
  });
  test('同じ日の複数セッションはまとめて数える', () => {
    const st = C.migrate({maxes:{MB:110,MN:105,ML:100},
      sets:{6:[day(2026,1,5)], 7:[day(2026,1,5)]}}, NOW);
    assert.equal(C.trainingDays(st).get('2026-01-05'), 2);
  });
  test('連続週：記録なしは0', () => {
    assert.equal(C.weekStreak(new Map(), NOW), 0);
  });
  test('連続週：直近3週に記録があれば3', () => {
    const map = new Map();
    for(let w = 0; w < 3; w++){
      const d = new Date(NOW); d.setDate(d.getDate() - w*7);
      map.set(C.dayKeyOf(d.getTime()), 1);
    }
    assert.equal(C.weekStreak(map, NOW), 3);
  });
  test('連続週：間が空いたら途切れる', () => {
    const map = new Map();
    for(const w of [0, 1, 3]){
      const d = new Date(NOW); d.setDate(d.getDate() - w*7);
      map.set(C.dayKeyOf(d.getTime()), 1);
    }
    assert.equal(C.weekStreak(map, NOW), 2);
  });
  test('今週まだでも先週やっていれば継続扱い', () => {
    const map = new Map();
    const d = new Date(NOW); d.setDate(d.getDate() - 7);
    map.set(C.dayKeyOf(d.getTime()), 1);
    assert.equal(C.weekStreak(map, NOW), 1);
  });
});

describe('CSV書き出し', () => {
  test('記録がなければヘッダーのみ', () => {
    assert.equal(C.toCSV(C.migrate(null, NOW)).split('\r\n').length, 1);
  });
  test('現サイクルと履歴の両方を含む', () => {
    const st = C.migrate({maxes:{MB:110,MN:105,ML:100},
      logs:{6:[{w:92.5, reps:5, rpe:8, t:NOW}]},
      history:[{n:1, started:0, ended:0, maxesStart:{MB:100,MN:95,ML:90},
                logs:{7:[{w:80, reps:5, rpe:7, t:NOW}]}, sets:{}}]}, NOW);
    const rows = C.toCSV(st).split('\r\n');
    assert.equal(rows.length, 3);
    assert.ok(rows[1].startsWith('1,'), '履歴のサイクルが先');
    assert.ok(rows[2].includes('92.5'));
    assert.ok(rows[2].includes('ベンチプレス'));
  });
  test('カンマや引用符を含む値をエスケープする', () => {
    const esc = C.toCSV(C.migrate({maxes:{MB:110,MN:105,ML:100},
      logs:{6:[{w:100, reps:5, rpe:8, t:NOW}]}}, NOW));
    assert.ok(!esc.includes('\n\n'));
    for(const line of esc.split('\r\n')) assert.equal((line.match(/"/g)||[]).length % 2, 0);
  });
});

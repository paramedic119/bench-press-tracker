/**
 * 壊れた入力への耐性。
 * ここが崩れると「バックアップを読んだら画面が真っ白」になるので、
 * 例外を出さないことと、値が安全側へ落ちることの両方を確かめる。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/core/index.js';

const NOW = Date.UTC(2026, 7, 27, 9, 0, 0);

/** 状態を受け取って、画面が呼ぶ集計をひととおり走らせる */
function renderAll(st){
  C.computePlan(st.maxes, {adaptive: st.adaptive, logs: st.logs});
  C.cycleBestOf(st.logs);
  C.cycleProgress(st.sets);
  C.firstIncompleteDay(st.sets);
  C.weekVolumes(C.computePlan(st.maxes).W);
  for(const ex of ['BP', 'NR', 'LG']){
    C.latestRepMaxes(C.repMaxSeries(st, ex));
  }
  C.weekStreak(C.trainingDays(st), NOW);
  C.toCSV(st);
  for(const s of C.PROGRAM){ C.sessionDate(st, s.id); C.bestOf(st.logs[s.id]); }
}

const withHistory = h => C.migrate({maxes: {MB:110, MN:105, ML:100},
  history: [{n:1, started:0, ended:0, maxesStart:{MB:100, MN:95, ML:90}, ...h}]}, NOW);

describe('壊れた履歴を読んでも落ちない', () => {
  const cases = [
    ['sets が配列でない',        {sets: {6: {a: 1}},  logs: {}}],
    ['sets が文字列',            {sets: {6: 'xxx'},   logs: {}}],
    ['logs が配列でない',        {sets: {}, logs: {6: {w: 100}}}],
    ['logs の中身が欠けている',  {sets: {}, logs: {6: [{w: 100}]}}],
    ['logs が null だらけ',      {sets: {}, logs: {6: [null, null]}}],
    ['maxesStart が空',          {sets: {}, logs: {}, maxesStart: {}}],
    ['maxesStart が配列',        {sets: {}, logs: {}, maxesStart: []}],
    ['maxesStart が数値',        {sets: {}, logs: {}, maxesStart: 5}],
    ['セッションidが不正',       {sets: {}, logs: {abc: [{w:1, reps:1, rpe:1, t:1}]}}],
    ['best が壊れている',        {sets: {}, logs: {}, best: {BP: 'x', NR: null}}],
  ];
  for(const [name, h] of cases){
    test(name, () => { renderAll(withHistory(h)); });
  }

  test('履歴も現サイクルと同じ形に正規化される', () => {
    const s = withHistory({sets: {6: 'xxx'}, logs: {6: {w: 100, reps: 5, rpe: 8, t: NOW}}});
    assert.deepEqual(s.history[0].sets, {}, '配列でないセットは捨てる');
    assert.ok(Array.isArray(s.history[0].logs[6]), '単体オブジェクトは配列へ移行する');
    assert.equal(s.history[0].logs[6][0].w, 100);
  });

  test('履歴の MAX は3種目そろう', () => {
    const s = withHistory({sets: {}, logs: {}, maxesStart: {MB: 120}});
    for(const k of ['MB', 'MN', 'ML']) assert.equal(typeof s.history[0].maxesStart[k], 'number', k);
    assert.equal(s.history[0].maxesStart.MB, 120);
  });

  test('maxesEnd が無ければ maxesStart を引き継ぐ', () => {
    const s = withHistory({sets: {}, logs: {}, maxesStart: {MB:120, MN:110, ML:100}});
    assert.deepEqual(s.history[0].maxesEnd, s.history[0].maxesStart);
  });

  test('壊れた履歴を通しても migrate は冪等', () => {
    const a = withHistory({sets: {6: 'xxx'}, logs: {6: {w: 100, reps: 5, rpe: 8, t: NOW}}});
    assert.deepEqual(C.migrate(JSON.parse(JSON.stringify(a)), NOW), a);
  });
});

describe('壊れた現サイクルを読んでも落ちない', () => {
  const cases = [
    ['sets が配列でない',   {sets: {6: 'xxx'}}],
    ['logs が文字列',       {logs: {6: 'xxx'}}],
    ['logs の中身が壊れ',   {logs: {6: [{w: 'x', reps: null}]}}],
    ['maxes が欠けている',  {maxes: {MB: 110}}],
    ['maxes が NaN',        {maxes: {MB: NaN, MN: 105, ML: 100}}],
    ['ui が範囲外',         {ui: {week: 99, day: 0, ex: 'ZZ'}}],
    ['トップレベルが配列',  []],
    ['トップレベルが数値',  42],
  ];
  for(const [name, raw] of cases){
    test(name, () => { renderAll(C.migrate({maxes: {MB:110, MN:105, ML:100}, ...raw}, NOW)); });
  }

  test('集計は配列でないセットを 0 として扱う', () => {
    assert.equal(C.setsDone(/** @type {any} */ ({6: 'xxx'}), 6), 0);
    assert.equal(C.setsDone({}, 6), 0);
    assert.equal(C.setsDone({6: [1, false, 2]}, 6), 2);
  });

  test('sessionDate は壊れた形でも null を返す', () => {
    const st = /** @type {any} */ ({sets: {6: 'xxx'}, logs: {6: 'yyy'}});
    assert.equal(C.sessionDate(st, 6), null);
  });
});

describe('プレート計算に異常な重量を渡す', () => {
  test('非有限の重量では組まない', () => {
    for(const t of [NaN, Infinity, -Infinity]){
      const r = C.plateBreakdown(t, 20);
      assert.equal(r.light, true, String(t));
      assert.deepEqual(r.used, []);
    }
  });
  test('バーより軽い・ちょうど・少し重い', () => {
    assert.equal(C.plateBreakdown(0, 20).light, true);
    assert.equal(C.plateBreakdown(-50, 20).light, true);
    assert.deepEqual(C.plateBreakdown(20, 20).used, []);
    assert.equal(C.plateBreakdown(20, 20).light, false);
  });
  test('現実的な上限まで計算しきる', () => {
    const r = C.plateBreakdown(500, 20);
    assert.equal(r.rest, 0);
    assert.equal(20 + r.used.reduce((a, b) => a + b, 0) * 2, 500);
  });
});

describe('ウォームアップと e1RM の異常入力', () => {
  test('ウォームアップは例外を出さない', () => {
    for(const [w, b, s] of [[0,20,2.5], [NaN,20,2.5], [500,20,0], [25,20,2.5], [-10,20,2.5], [100,0,2.5]])
      assert.ok(Array.isArray(C.warmupSets(w, b, s)), `${w}/${b}/${s}`);
  });
  test('e1RM は数値を返す（NaN でも例外にしない）', () => {
    for(const [w, r, p] of [[0,0,0], [NaN,5,8], [100,0,8], [100,5,0]])
      assert.equal(typeof C.e1rm(w, r, p), 'number');
  });
});

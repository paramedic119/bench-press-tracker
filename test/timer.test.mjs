/**
 * インターバルタイマーの状態機械。
 * now を引数で受ける設計にしてあるので、実時間を待たずに全分岐を確かめられる。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startRest, adjustRest, restView, restoreRest,
         shouldFireRest, shouldClearRest, REST_LINGER_MS, REST_RESTORE_MS, mmss } from '../src/core/index.js';

const T0 = Date.UTC(2026, 0, 15, 9, 0, 0);
const sec = n => n * 1000;

describe('開始', () => {
  test('秒数から終了時刻を決める', () => {
    const t = startRest(180, 'ベンチ', T0);
    assert.equal(t.endsAt, T0 + sec(180));
    assert.equal(t.total, 180);
    assert.equal(t.label, 'ベンチ');
    assert.equal(t.firedAt, null);
  });
  test('0秒以下では開始しない', () => {
    assert.equal(startRest(0, 'x', T0), null);
    assert.equal(startRest(-30, 'x', T0), null);
  });
  test('ラベルが空なら既定の名前になる', () => {
    assert.equal(startRest(60, '', T0).label, 'インターバル');
  });
});

describe('表示', () => {
  const t = startRest(180, 'ベンチ', T0);
  test('残り時間', () => {
    assert.equal(restView(t, T0).left, 180);
    assert.equal(restView(t, T0 + sec(60)).left, 120);
    assert.equal(restView(t, T0).done, false);
  });
  test('リングの比率は 1 → 0', () => {
    assert.equal(restView(t, T0).ratio, 1);
    assert.ok(Math.abs(restView(t, T0 + sec(90)).ratio - 0.5) < 1e-9);
    assert.equal(restView(t, T0 + sec(180)).ratio, 0);
  });
  test('超過分は overSec に出る', () => {
    const v = restView(t, T0 + sec(200));
    assert.equal(v.done, true);
    assert.equal(v.overSec, 20);
    assert.equal(v.ratio, 0, '振り切れてマイナスにならない');
  });
  test('null からは null', () => {
    assert.equal(restView(null, T0), null);
  });
});

describe('バックグラウンドから戻ったとき', () => {
  test('経過時間は実時刻から決まる（タブが止まっていてもズレない）', () => {
    const t = startRest(180, 'x', T0);
    /* 120秒ぶんタブが止まっていた、という状況 */
    assert.equal(restView(t, T0 + sec(120)).left, 60);
  });
  test('止まっている間に終わっていれば、戻った瞬間に完了扱い', () => {
    const t = startRest(60, 'x', T0);
    assert.equal(restView(t, T0 + sec(300)).done, true);
    assert.ok(shouldFireRest(t, T0 + sec(300)));
  });
});

describe('±30秒', () => {
  test('残り時間が伸びる', () => {
    const t = adjustRest(startRest(180, 'x', T0), 30, T0);
    assert.equal(restView(t, T0).left, 210);
  });
  test('伸ばしたぶん total も広がり、リングが振り切れない', () => {
    const t = adjustRest(startRest(180, 'x', T0), 30, T0);
    assert.equal(t.total, 210);
    assert.ok(restView(t, T0).ratio <= 1);
  });
  test('縮めて現在時刻に追いつくと終了する', () => {
    const t = startRest(20, 'x', T0);
    assert.equal(adjustRest(t, -30, T0), null);
  });
  test('完了後に延長すると、現在時刻から数え直す', () => {
    const t = startRest(60, 'x', T0);
    const now = T0 + sec(200);                 // 140秒超過している
    const next = adjustRest(t, 30, now);
    assert.equal(restView(next, now).left, 30, '超過ぶんを引きずらない');
    assert.equal(next.firedAt, null, '延長したら完了通知はやり直し');
  });
  test('完了後にマイナスを押すと終了する', () => {
    const t = startRest(60, 'x', T0);
    assert.equal(adjustRest(t, -30, T0 + sec(200)), null);
  });
  test('null には何もしない', () => {
    assert.equal(adjustRest(null, 30, T0), null);
  });
});

describe('完了の通知', () => {
  test('終了時刻を過ぎたら1度だけ鳴る', () => {
    const t = startRest(60, 'x', T0);
    assert.equal(shouldFireRest(t, T0 + sec(59)), false);
    assert.equal(shouldFireRest(t, T0 + sec(60)), true);
    const fired = {...t, firedAt: T0 + sec(60)};
    assert.equal(shouldFireRest(fired, T0 + sec(61)), false, '2度は鳴らさない');
  });
  test('鳴る前は片付けない', () => {
    const t = startRest(60, 'x', T0);
    assert.equal(shouldClearRest(t, T0 + sec(9999)), false);
  });
  test('鳴ってからしばらく経つと片付ける', () => {
    const fired = {...startRest(60, 'x', T0), firedAt: T0 + sec(60)};
    assert.equal(shouldClearRest(fired, T0 + sec(60) + REST_LINGER_MS - 1), false);
    assert.equal(shouldClearRest(fired, T0 + sec(60) + REST_LINGER_MS + 1), true);
  });
});

describe('リロード後の復元', () => {
  test('走っている途中なら残り時間ごと戻る', () => {
    const saved = {endsAt: T0 + sec(180), total: 180, label: 'ベンチ'};
    const t = restoreRest(saved, T0 + sec(60));
    assert.equal(restView(t, T0 + sec(60)).left, 120);
    assert.equal(t.firedAt, null);
  });
  test('すでに終わっていれば、鳴らさず完了状態で戻す', () => {
    const saved = {endsAt: T0, total: 180, label: 'x'};
    const t = restoreRest(saved, T0 + sec(10));
    assert.equal(t.firedAt, T0, '復元直後に鳴り出さない');
    assert.equal(shouldFireRest(t, T0 + sec(10)), false);
  });
  test('だいぶ前に終わったものは捨てる', () => {
    const saved = {endsAt: T0, total: 180, label: 'x'};
    assert.ok(restoreRest(saved, T0 + REST_RESTORE_MS - 1));
    assert.equal(restoreRest(saved, T0 + REST_RESTORE_MS + 1), null);
  });
  test('壊れた保存データからは復元しない', () => {
    for(const bad of [null, undefined, {}, {endsAt: 0}, {endsAt: 'x'}])
      assert.equal(restoreRest(bad, T0), null, JSON.stringify(bad));
  });
  test('total が欠けていても既定値で動く', () => {
    const t = restoreRest({endsAt: T0 + sec(60)}, T0);
    assert.equal(t.total, 180);
    assert.equal(t.label, 'インターバル');
  });
});

describe('表示の整形', () => {
  test('mmss', () => {
    assert.equal(mmss(0), '0:00');
    assert.equal(mmss(5), '0:05');
    assert.equal(mmss(65), '1:05');
    assert.equal(mmss(600), '10:00');
  });
});

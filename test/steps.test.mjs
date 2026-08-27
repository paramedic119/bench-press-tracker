/**
 * 入力ステッパーの刻みと範囲。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { stepValue, present } from '../src/core/index.js';

describe('重量（丸め刻みに従う）', () => {
  test('2.5kg刻み', () => {
    assert.equal(stepValue('w', 92.5, 1, 2.5), 95);
    assert.equal(stepValue('w', 92.5, -1, 2.5), 90);
  });
  test('端数のある値は刻みに吸い付く', () => {
    assert.equal(stepValue('w', 91.3, 1, 2.5), 92.5, '95 まで飛ばさない');
    assert.equal(stepValue('w', 91.3, -1, 2.5), 90);
    assert.equal(stepValue('w', 91.3, 0, 2.5), 92.5, 'dir=0 は丸めだけ');
  });
  test('刻みなし(0)のときは 2.5kg で動く', () => {
    assert.equal(stepValue('w', 90, 1, 0), 92.5);
  });
  test('マイナスにならない', () => {
    assert.equal(stepValue('w', 0, -1, 2.5), 0);
    assert.equal(stepValue('w', 1, -1, 2.5), 0);
  });
  test('細かい刻みでも正確', () => {
    assert.equal(stepValue('w', 91, 1, 0.5), 91.5);
    assert.equal(stepValue('w', 91, 1, 1), 92);
  });
});

describe('回数・RPE・MAX・秒・体重', () => {
  test('回数は1〜100', () => {
    assert.equal(stepValue('r', 5, 1), 6);
    assert.equal(stepValue('r', 1, -1), 1);
    assert.equal(stepValue('r', 100, 1), 100);
  });
  test('RPEは5〜10', () => {
    assert.equal(stepValue('p', 8, 1), 9);
    assert.equal(stepValue('p', 10, 1), 10);
    assert.equal(stepValue('p', 5, -1), 5);
    assert.equal(stepValue('p', 99, 0), 10, '手入力の暴走をクランプする');
    assert.equal(stepValue('p', 0, 0), 5);
  });
  test('RPE 8.5 は保持される（第3・7・11週のセッションで使う）', () => {
    assert.equal(stepValue('p', 8.5, 0), 8.5, 'クランプで 9 に化けない');
    assert.equal(stepValue('p', 8.5, 1), 9, '上下は1刻みのまま');
    assert.equal(stepValue('p', 8.5, -1), 8);
  });
  test('刻みを繰り返しても誤差が溜まらない', () => {
    let v = 70;
    for(let i = 0; i < 100; i++) v = stepValue('bw', v, 1);
    assert.equal(v, 120, '70 + 0.5×100');
    for(let i = 0; i < 100; i++) v = stepValue('bw', v, -1);
    assert.equal(v, 70, '往復して元に戻る');
  });
  test('MAXは2.5kg刻みで20〜999', () => {
    assert.equal(stepValue('max', 110, 1), 112.5);
    assert.equal(stepValue('max', 20, -1), 20);
    assert.equal(stepValue('max', 999, 1), 999);
  });
  test('インターバルは15秒刻みで0〜900', () => {
    assert.equal(stepValue('sec', 180, 1), 195);
    assert.equal(stepValue('sec', 0, -1), 0);
    assert.equal(stepValue('sec', 900, 1), 900);
    assert.equal(stepValue('sec', 187, 0), 180, '15秒刻みに丸める');
  });
  test('体重は0.5kg刻みで20〜400', () => {
    assert.equal(stepValue('bw', 78, 1), 78.5);
    assert.equal(stepValue('bw', 20, -1), 20);
  });
  test('未知の種類はそのまま返す', () => {
    assert.equal(stepValue('???', 42, 1), 42);
  });
});

describe('present（null落としの型ガード）', () => {
  test('0 や空文字は残す', () => {
    assert.deepEqual([0, '', false, null, undefined, 1].filter(present), [0, '', false, 1]);
  });
});

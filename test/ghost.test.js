import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthKey, loadGhost, saveRun } from '../src/game/ghost.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

test('오늘 이전의 가장 최근 날짜 최고 기록이 고스트가 된다', () => {
  const s = memStorage();
  const key = birthKey({ year: 1995, month: 6, day: 15, hour: 8 });
  assert.equal(loadGhost(s, key, '2026-09-25'), null);
  saveRun(s, key, '2026-09-23', 500);
  saveRun(s, key, '2026-09-24', 300);
  saveRun(s, key, '2026-09-24', 800);
  saveRun(s, key, '2026-09-24', 400);
  saveRun(s, key, '2026-09-25', 9999); // 오늘 기록은 오늘의 고스트가 아니다
  assert.deepEqual(loadGhost(s, key, '2026-09-25'), { date: '2026-09-24', distance: 800 });
});

test('저장소가 없거나 깨져도 throw 하지 않는다', () => {
  assert.equal(loadGhost(null, 'k', '2026-09-25'), null);
  saveRun(null, 'k', '2026-09-25', 10);
  const broken = { getItem: () => '{not json', setItem: () => { throw new Error('quota'); } };
  assert.equal(loadGhost(broken, 'k', '2026-09-25'), null);
  saveRun(broken, 'k', '2026-09-25', 10);
});

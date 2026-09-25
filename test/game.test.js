import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, touchDrop, nearMiss, pickItem, survive, deathLine, ackttemRate, TUNING } from '../src/rules.js';
import { createProfile, summaryLine } from '../src/profile.js';
import { nextWave, pickFate, MOTION_BY_ELEMENT } from '../src/patterns.js';
import { CHARACTERS, SKILLS } from '../src/content.js';
import { controls } from '../src/saju/elements.js';

const WOOD = 0, FIRE = 1, EARTH = 2, METAL = 3, WATER = 4;
const never = () => 0.99;

// 불 본캐, 천적은 물. 스킬·운세 영향 없음
const plain = (mods = {}) => ({ me: FIRE, nemesis: WATER, mods });

test('내 색깔은 먹고, 다른 색은 하트 -1', () => {
  const p = plain();
  const run = createRun(p);
  const ev = touchDrop(run, p, { element: FIRE }, 0);
  assert.equal(ev.type, 'FRIEND');
  assert.equal(run.friends, 1);
  assert.equal(touchDrop(run, p, { element: EARTH }, 0, never).type, 'HURT');
  assert.equal(run.hearts, TUNING.startHearts - 1);
  assert.equal(run.combo, 0);
  assert.equal(touchDrop(run, p, { element: EARTH }, 500, never).type, 'NONE'); // 무적 시간
});

test('하트가 다 떨어지면 끝, 해탈 도사는 한 번 부활', () => {
  const p = plain();
  const run = createRun(p);
  run.hearts = 1;
  assert.equal(touchDrop(run, p, { element: WATER }, 0, never).type, 'DEAD');
  assert.match(deathLine(p, run, () => 0), /천적 물폭탄/);
  const monk = plain({ revives: 1 });
  const run2 = createRun(monk);
  run2.hearts = 1;
  assert.equal(touchDrop(run2, monk, { element: WATER }, 0, never).type, 'REVIVE');
  assert.equal(run2.hearts, 2);
});

test('돌진 호랑이는 확률로 튕겨낸다', () => {
  const tiger = plain({ tigerChance: 0.3 });
  const run = createRun(tiger);
  assert.equal(touchDrop(run, tiger, { element: WATER }, 0, () => 0.1).type, 'DEFLECT');
  assert.equal(run.hearts, TUNING.startHearts);
});

test('아슬아슬과 친구로 게이지가 차면 럭키타임, 럭키타임엔 운명도 코인', () => {
  const p = plain();
  const run = createRun(p);
  let lucky = false;
  for (let i = 0; i < 20 && !lucky; i++) lucky = nearMiss(run, p, 0).lucky;
  assert.ok(lucky);
  assert.equal(run.luckyCount, 1);
  assert.equal(touchDrop(run, p, { element: WATER }, 100).type, 'LUCKY_COIN');
  assert.equal(touchDrop(run, p, { element: WATER }, 99999, never).type, 'HURT');
});

test('콤보가 쌓이면 점수 배율이 오르고, 점수 배율 스킬도 적용된다', () => {
  const p = plain({ scoreMult: 1.5 });
  const run = createRun(p);
  const first = touchDrop(run, p, { element: FIRE }, 0).score;
  assert.equal(first, TUNING.friendScore * 1.5);
  for (let i = 0; i < 4; i++) touchDrop(run, p, { element: FIRE }, 0);
  assert.ok(touchDrop(run, p, { element: FIRE }, 0).score > first);
  survive(run, p, 1000);
  assert.equal(run.timeMs, 1000);
});

test('아이템: 짝퉁 럭키템은 게이지와 점수를 깎는다', () => {
  const p = plain();
  const run = createRun(p);
  run.score = 500;
  run.gauge = 80;
  assert.equal(pickItem(run, p, { kind: 'FAKE' }, 0).type, 'FAKE');
  assert.deepEqual([run.score, run.gauge], [200, 0]);
  assert.equal(pickItem(run, p, { kind: 'LUCKY' }, 0).type, 'LUCKY');
  assert.ok(run.luckyUntil > 0);
});

test('떨어지는 운명: 내 색깔은 안 나오고 천적이 제일 많다', () => {
  let seed = 3;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 6000; i++) counts[pickFate(rng, { me: FIRE, nemesis: WATER, today: EARTH })]++;
  assert.equal(counts[FIRE], 0);
  assert.equal(counts.indexOf(Math.max(...counts)), WATER);
  assert.deepEqual(MOTION_BY_ELEMENT, ['SPROUT', 'ROLL', 'HEAVY', 'ZIGZAG', 'POP']);
});

test('웨이브: 처음엔 친구 소나기, 이후 다양한 웨이브', () => {
  let seed = 11;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ctx = { rng, me: FIRE, nemesis: WATER, today: EARTH, lucky: WOOD, fake: METAL, sinceLuckyMs: 0, hearts: 3 };
  assert.equal(nextWave({ ...ctx, timeMs: 0 }).name, 'friends');
  const names = new Set();
  for (let i = 0; i < 200; i++) {
    const { name, items } = nextWave({ ...ctx, timeMs: 100000 });
    names.add(name);
    for (const it of items) {
      assert.ok(it.at >= 0);
      if (it.kind === 'DROP' && name === 'wall') assert.notEqual(it.element, FIRE);
    }
    if (name === 'wall') assert.equal(items.filter((it) => it.kind === 'DROP').length, 6); // 7칸 중 1칸 빈칸
  }
  assert.ok(['rain', 'mixed', 'wall', 'sniper'].every((n) => names.has(n)));
  const withLucky = nextWave({ ...ctx, timeMs: 30000, sinceLuckyMs: 25000 });
  assert.ok(withLucky.items.some((it) => it.kind === 'LUCKY' && it.element === WOOD));
});

test('프로필: 사주 용어 없이 게임 언어로 번역된다', () => {
  const pr = createProfile({ year: 1995, month: 6, day: 15, hour: 8, minute: 30 }, { year: 2026, month: 9, day: 25 });
  assert.equal(pr.character, CHARACTERS[pr.me]);
  assert.ok(controls(pr.nemesis, pr.me)); // 천적은 나를 이기는 오행
  assert.doesNotMatch(pr.summary + pr.fortune.headline + pr.fortune.title, /살|일간|용신|상극|상생/);
  assert.equal(summaryLine([1, 3, 2, 0, 2], [SKILLS.YEOKMA], CHARACTERS[1]), '불이 넘치고 쇠가 텅 빈, 방랑벽 있는 불꽃 폭주족');
});

test('액땜 성공률은 0~99', () => {
  const run = createRun(plain());
  assert.equal(ackttemRate(run), 0);
  Object.assign(run, { timeMs: 999999, nearMisses: 99, friends: 99, maxCombo: 99, luckyCount: 1 });
  assert.equal(ackttemRate(run), 99);
});

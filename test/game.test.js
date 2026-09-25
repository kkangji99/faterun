import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OUTCOME, outcome, beats, counterOf, tapsTo, createRun, hitObstacle, pickItem, changeForm, deathLine, ackttemRate, TUNING } from '../src/rules.js';
import { createProfile, summaryLine } from '../src/profile.js';
import { nextChunk } from '../src/patterns.js';
import { CHARACTERS, SKILLS } from '../src/content.js';

const WOOD = 0, FIRE = 1, EARTH = 2, METAL = 3, WATER = 4;
const never = () => 0.99;

// 스킬·운세 영향 없는 기본 프로필
const plain = (me = FIRE, mods = {}) => ({ me, mods });

test('오행 가위바위보: 나무 > 흙 > 물 > 불 > 쇠 > 나무', () => {
  assert.ok(beats(WOOD, EARTH) && beats(EARTH, WATER) && beats(WATER, FIRE) && beats(FIRE, METAL) && beats(METAL, WOOD));
  for (let e = 0; e < 5; e++) assert.ok(beats(counterOf(e), e));
  assert.equal(outcome(FIRE, FIRE), OUTCOME.SAME);
  assert.equal(outcome(FIRE, METAL), OUTCOME.WIN);
  assert.equal(outcome(FIRE, WATER), OUTCOME.LOSE);
  assert.equal(outcome(FIRE, EARTH), OUTCOME.BUMP);
  assert.equal(tapsTo(WATER, WOOD), 1);
});

test('이기면 부수고, 본캐 모양이면 점수 2배', () => {
  const p = plain(FIRE);
  const run = createRun(p);
  const main = hitObstacle(run, p, { element: METAL }, 0);
  assert.equal(main.type, 'SMASH');
  assert.equal(main.score, TUNING.smashScore * 2);
  changeForm(run); // 불 → 흙
  assert.equal(hitObstacle(run, p, { element: WATER }, 0).score, TUNING.smashScore);
});

test('같은 모양은 통과, 지면 하트 -2, 애매하면 -1', () => {
  const p = plain(FIRE);
  const run = createRun(p);
  assert.equal(hitObstacle(run, p, { element: FIRE }, 0).type, 'PASS');
  assert.equal(hitObstacle(run, p, { element: WATER }, 0, never).damage, 2);
  assert.equal(run.hearts, 1);
  assert.equal(hitObstacle(run, p, { element: EARTH }, 500, never).type, 'NONE'); // 무적 시간
  assert.equal(hitObstacle(run, p, { element: EARTH }, 2000, never).type, 'DEAD');
  assert.match(deathLine(run, () => 0), /바위/);
});

test('돌진 호랑이·해탈 도사', () => {
  const tiger = plain(FIRE, { tigerChance: 0.3 });
  assert.equal(hitObstacle(createRun(tiger), tiger, { element: WATER }, 0, () => 0.1).reason, 'TIGER');
  const monk = plain(FIRE, { revives: 1 });
  const run = createRun(monk);
  run.hearts = 1;
  assert.equal(hitObstacle(run, monk, { element: WATER }, 0, never).type, 'REVIVE');
});

test('럭키타임: 게이지가 차거나 럭키템을 먹으면 5초간 전부 부숨', () => {
  const p = plain(FIRE);
  const run = createRun(p);
  pickItem(run, p, { kind: 'LUCKY' }, 1000);
  assert.equal(hitObstacle(run, p, { element: WATER }, 2000).type, 'SMASH');
  assert.equal(hitObstacle(run, p, { element: WATER }, 7000, never).type, 'HURT');
  const run2 = createRun(p);
  let ev;
  for (let i = 0; i < 9; i++) ev = hitObstacle(run2, p, { element: METAL }, 0);
  assert.ok(ev.lucky);
});

test('짝퉁 럭키템은 게이지와 점수를 깎는다', () => {
  const p = plain(FIRE);
  const run = createRun(p);
  run.score = 500;
  run.gauge = 80;
  assert.equal(pickItem(run, p, { kind: 'FAKE' }, 0).type, 'FAKE');
  assert.deepEqual([run.score, run.gauge], [200, 0]);
});

test('프로필: 사주 용어 없이 게임 언어로 번역된다', () => {
  const pr = createProfile({ year: 1995, month: 6, day: 15, hour: 8, minute: 30 }, { year: 2026, month: 9, day: 25 });
  assert.equal(pr.character, CHARACTERS[pr.me]);
  assert.ok(beats(pr.nemesis, pr.me));
  assert.ok(pr.skills.length >= 1 && pr.fortune.title && pr.fortune.headline);
  assert.doesNotMatch(pr.summary + pr.fortune.headline + pr.fortune.title, /살|일간|용신|상극|상생/);
  assert.equal(summaryLine([1, 3, 2, 0, 2], [SKILLS.YEOKMA], CHARACTERS[1]), '불이 넘치고 쇠가 텅 빈, 방랑벽 있는 불꽃 폭주족');
  assert.equal(summaryLine([2, 2, 2, 1, 1], [SKILLS.NONE], CHARACTERS[4]), '말랑 슬라임');
});

test('패턴: 체인은 한 번 탭할 때마다 다음 벽을 이긴다', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let chains = 0;
  for (let i = 0; i < 300; i++) {
    const items = nextChunk({ rng, distanceM: 3000, today: WATER, lucky: EARTH, fake: WOOD, sinceLuckyM: 0, hearts: 3 });
    assert.ok(items[0].dx >= 480, '덩어리 사이 여백 확보');
    const walls = items.filter((it) => it.kind === 'WALL');
    for (const it of items) if (it.element !== undefined) assert.ok(it.element >= 0 && it.element < 5);
    if (walls.length >= 3 && new Set(walls.map((w) => w.element)).size === walls.length) {
      chains++;
      for (let j = 1; j < walls.length; j++) assert.equal(tapsTo(counterOf(walls[j - 1].element), counterOf(walls[j].element)), 1);
    }
  }
  assert.ok(chains > 0);
  const lucky = nextChunk({ rng, distanceM: 100, today: 0, lucky: EARTH, fake: WOOD, sinceLuckyM: 500, hearts: 3 });
  assert.ok(lucky.some((it) => it.kind === 'LUCKY' && it.element === EARTH));
});

test('액땜 성공률은 0~99', () => {
  const run = createRun(plain());
  assert.equal(ackttemRate(run), 0);
  Object.assign(run, { distance: 99999, smashes: 999, maxCombo: 999, luckyCount: 3 });
  assert.equal(ackttemRate(run), 99);
});

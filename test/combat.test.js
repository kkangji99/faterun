import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WOOD, FIRE, EARTH, METAL, WATER } from '../src/saju/constants.js';
import { createCharacter } from '../src/game/buildPlayer.js';
import { createRunState, calcDamage, resolveCollision, resolveItem, tickRun } from '../src/game/combat.js';
import { buildResultData, ackttemRate } from '../src/game/result.js';
import { BASE_OBSTACLE_DAMAGE } from '../src/game/tables.js';

const noRng = () => 0.99; // 확률 이벤트가 발동하지 않는 난수

// 일간을 원하는 오행으로 바꾼 캐릭터 (신살/과다부재 영향 제거)
function charWith(dayMaster, extra = {}) {
  const c = createCharacter({ year: 1995, month: 6, day: 15, hour: 8 }, { year: 2026, month: 9, day: 25 });
  c.profile = { ...c.profile, dayMaster, shinsal: [], imbalance: { excess: [], missing: [] } };
  c.elements = { ...c.elements, me: dayMaster };
  c.mods = { ...extra };
  c.character = { ...c.character, passive: { id: 'NONE' } };
  c.stats = { ...c.stats, shield: 0, revives: 0, hp: 100, maxHp: 100 };
  return c;
}

test('상극 장애물은 2배 데미지 + 상태이상', () => {
  const c = charWith(WOOD);
  assert.equal(calcDamage(c, { element: METAL }).damage, BASE_OBSTACLE_DAMAGE * 2);
  const run = createRunState(c);
  const ev = resolveCollision(run, c, { element: METAL }, 1000, noRng);
  assert.equal(ev.type, 'HIT');
  assert.equal(ev.status.id, 'BLEED'); // 金克木
  assert.equal(run.hp, 100 - 40);
});

test('각 상극 조합의 상태이상', () => {
  const pairs = [[FIRE, WATER, 'DOUSED'], [EARTH, WOOD, 'ROOTED'], [METAL, FIRE, 'MELTED'], [WATER, EARTH, 'MUDDY']];
  for (const [me, attacker, id] of pairs) {
    const c = charWith(me);
    const ev = resolveCollision(createRunState(c), c, { element: attacker }, 0, noRng);
    assert.equal(ev.status.id, id);
  }
});

test('관계별 배율 순서: 상극 > 식상 > 비겁 > 인성 > 재성', () => {
  const c = charWith(WOOD);
  const d = (el) => calcDamage(c, { element: el }).damage;
  assert.ok(d(METAL) > d(FIRE) && d(FIRE) > d(WOOD) && d(WOOD) > d(WATER) && d(WATER) > d(EARTH));
});

test('무적 시간 중엔 무시, 피버 중엔 박살', () => {
  const c = charWith(WOOD);
  const run = createRunState(c);
  resolveCollision(run, c, { element: METAL }, 0, noRng);
  assert.equal(resolveCollision(run, c, { element: METAL }, 100, noRng).type, 'IGNORED');
  resolveItem(run, c, { element: c.elements.yongsin, special: 'YONGSIN' }, 5000);
  assert.equal(resolveCollision(run, c, { element: METAL }, 5100, noRng).type, 'SMASH');
});

test('상생 아이템은 HP 회복, 부재 오행이면 2배', () => {
  const c = charWith(WOOD);
  const run = createRunState(c);
  run.hp = 50;
  assert.equal(resolveItem(run, c, { element: WATER }, 0).heal, 15);
  c.profile.imbalance.missing = [WATER];
  assert.equal(resolveItem(run, c, { element: WATER }, 0).heal, 30);
});

test('화개살 부활 1회', () => {
  const c = charWith(WOOD);
  c.stats.revives = 1;
  const run = createRunState(c);
  run.hp = 10;
  assert.equal(resolveCollision(run, c, { element: METAL }, 0, noRng).type, 'REVIVE');
  run.hp = 10;
  assert.equal(resolveCollision(run, c, { element: METAL }, 5000, noRng).type, 'DEAD');
});

test('출혈 DoT 로 사망하면 사인이 출혈', () => {
  const c = charWith(WOOD);
  const run = createRunState(c);
  run.hp = 45;
  resolveCollision(run, c, { element: METAL }, 0, noRng); // hp 5 + 출혈
  for (let t = 16; t < 3000 && !run.dead; t += 16) tickRun(run, c, t, 16);
  assert.ok(run.dead);
  const r = buildResultData(c, run, () => 0);
  assert.match(r.deathCause, /金 기운에 벌목/);
  assert.ok(ackttemRate(c, run) >= 0 && ackttemRate(c, run) <= 99);
});

test('점수 배율(역마·충)이 모든 점수 획득에 적용된다', async () => {
  const { addScore } = await import('../src/game/combat.js');
  const c = charWith(WOOD, { scoreMult: 1.8 });
  const run = createRunState(c);
  assert.equal(addScore(run, c, 100), 180);
  resolveItem(run, c, { element: WOOD, special: 'COIN' }, 0);
  assert.equal(run.score, 180 + 18);
});

test('水 과다: 슬라이딩 중 낮은 장애물 물보라 통과, 쿨다운 동안은 피격', () => {
  const c = charWith(WATER, { slideIgnoresLow: true });
  const run = createRunState(c);
  run.hp = 1000; // 土克水 2배 피해로 중간에 죽지 않게
  const low = { element: EARTH, high: false };
  assert.equal(resolveCollision(run, c, low, 0, noRng, { sliding: true }).type, 'SPLASH');
  assert.equal(resolveCollision(run, c, low, 1000, noRng, { sliding: true }).type, 'HIT');
  assert.equal(resolveCollision(run, c, { element: EARTH, high: true }, 9000, noRng, { sliding: true }).type, 'HIT');
  assert.equal(resolveCollision(run, c, low, 20000, noRng, { sliding: false }).type, 'HIT');
});

test('저스트 회피: 누구나 +100, 金 일간은 ×3 + 슬로모', async () => {
  const { resolveJustDodge, isJustTiming } = await import('../src/game/combat.js');
  const wood = charWith(WOOD);
  assert.deepEqual(resolveJustDodge(createRunState(wood), wood), { type: 'JUST_DODGE', score: 100, slowmo: false });
  const metal = charWith(METAL);
  metal.character.passive = { id: 'JUST_DODGE' };
  assert.deepEqual(resolveJustDodge(createRunState(metal), metal), { type: 'JUST_DODGE', score: 300, slowmo: true });
  const wood2 = charWith(WOOD);
  assert.ok(isJustTiming(wood2, 1000, 1150) && !isJustTiming(wood2, 1000, 1151) && !isJustTiming(wood2, 0, 100));
  assert.ok(!isJustTiming(charWith(WOOD, { justDodgeWindowMult: 0.7 }), 1000, 1150)); // 無金: 105ms
});

test('라이벌 고스트 추월 보너스는 한 판에 1회', async () => {
  const { resolveGhostPass } = await import('../src/game/combat.js');
  const c = charWith(FIRE);
  const run = createRunState(c);
  assert.equal(resolveGhostPass(run, c).score, 2000);
  assert.equal(resolveGhostPass(run, c), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayPillar, yearPillar, monthPillar, hourPillar, computeFourPillars } from '../src/saju/manse.js';
import { pillarLabel, WOOD, FIRE, EARTH, METAL, WATER } from '../src/saju/constants.js';
import { REL, relation, generates, controls } from '../src/saju/elements.js';
import { analyzeSaju, findShinsal, SHINSAL } from '../src/saju/analyze.js';
import { computeDailyFortune, isYukhap, isChung } from '../src/saju/iljin.js';

test('일주 기준점', () => {
  assert.equal(pillarLabel(dayPillar(2000, 1, 1)), '戊午');
  assert.equal(pillarLabel(dayPillar(1900, 1, 1)), '甲戌');
  // 60일 주기
  assert.equal(pillarLabel(dayPillar(2000, 3, 1)), pillarLabel(dayPillar(2000, 1, 1)));
});

test('년주는 입춘 기준으로 바뀐다', () => {
  assert.equal(pillarLabel(yearPillar(1984, 2, 3)), '癸亥');
  assert.equal(pillarLabel(yearPillar(1984, 2, 4)), '甲子');
  assert.equal(pillarLabel(yearPillar(2026, 9, 25)), '丙午');
});

test('월주 월두법', () => {
  assert.equal(pillarLabel(monthPillar(1984, 2, 10)), '丙寅'); // 甲년 寅월 = 丙寅
  assert.equal(pillarLabel(monthPillar(2026, 9, 25)), '丁酉'); // 丙년 酉월 = 丁酉
  assert.equal(pillarLabel(monthPillar(2026, 1, 3)), '戊子'); // 乙巳년 子월 = 戊子
});

test('시주 시두법', () => {
  assert.equal(pillarLabel(hourPillar(0, 0)), '甲子'); // 甲일 子시
  assert.equal(pillarLabel(hourPillar(1, 0)), '丙子'); // 乙일 子시
  assert.equal(pillarLabel(hourPillar(0, 13)), '辛未'); // 甲일 未시
});

test('23시는 다음 날 일주(조자시)', () => {
  const late = computeFourPillars({ year: 2000, month: 1, day: 1, hour: 23 });
  assert.equal(pillarLabel(late.day), pillarLabel(dayPillar(2000, 1, 2)));
  assert.equal(computeFourPillars({ year: 2000, month: 1, day: 1 }).hour, null);
});

test('상생·상극 관계', () => {
  assert.ok(generates(WOOD, FIRE) && generates(WATER, WOOD));
  assert.ok(controls(METAL, WOOD) && controls(WATER, FIRE) && controls(EARTH, WATER));
  assert.equal(relation(WOOD, METAL), REL.CONTROLS_ME);
  assert.equal(relation(WOOD, WATER), REL.GENERATES_ME);
  assert.equal(relation(WOOD, EARTH), REL.I_CONTROL);
  assert.equal(relation(WOOD, FIRE), REL.I_GENERATE);
  assert.equal(relation(FIRE, FIRE), REL.SAME);
});

test('신살 판정', () => {
  // 년지 子(申子辰) → 역마 寅, 도화 酉, 화개 辰
  const p = {
    year: { stem: 0, branch: 0 },
    month: { stem: 2, branch: 2 }, // 寅 → 역마
    day: { stem: 4, branch: 4 }, //   戊辰 → 화개 + 백호
    hour: { stem: 1, branch: 9 }, //  酉 → 도화
  };
  assert.deepEqual(new Set(findShinsal(p)), new Set([SHINSAL.YEOKMA, SHINSAL.DOHWA, SHINSAL.HWAGAE, SHINSAL.BAEKHO]));
});

test('육합/충', () => {
  assert.ok(isYukhap(2, 11) && isYukhap(6, 7) && !isYukhap(0, 2));
  assert.ok(isChung(0, 6) && isChung(11, 5) && !isChung(0, 5));
});

test('analyzeSaju 는 결정적이고 일관된 값을 낸다', () => {
  const birth = { year: 1995, month: 6, day: 15, hour: 8, minute: 30 };
  const a = analyzeSaju(birth);
  assert.deepEqual(a, analyzeSaju(birth));
  assert.equal(a.counts.reduce((s, c) => s + c, 0), 8);
  assert.ok(a.yongsin >= 0 && a.yongsin < 5);
  assert.equal((a.gisin + 2) % 5, a.yongsin); // 기신은 용신을 극한다
  const f = computeDailyFortune(a, { year: 2026, month: 9, day: 25 });
  assert.ok(f.effects.length >= 1 && f.grade.label);
});

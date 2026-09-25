// 사주 4기둥 → 게임에 필요한 분석값(일간, 오행 분포, 신강/신약, 용신, 신살).
// 명리학의 "억부용신"을 게임용으로 단순화한 버전이다. 점술 정확도보다
// "결과가 납득 가능하고, 같은 입력엔 항상 같은 결과"가 목표.

import { STEM_ELEMENT, BRANCH_ELEMENT } from './constants.js';
import { REL, relation, elementFor, controllerOf } from './elements.js';
import { computeFourPillars } from './manse.js';

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'];

/** 8글자(시주 모르면 6글자)의 오행 개수. 지지는 본기 오행만 센다. */
export function countElements(pillars) {
  const counts = [0, 0, 0, 0, 0];
  for (const key of PILLAR_KEYS) {
    const p = pillars[key];
    if (!p) continue;
    counts[STEM_ELEMENT[p.stem]]++;
    counts[BRANCH_ELEMENT[p.branch]]++;
  }
  return counts;
}

// 신강/신약 판정 가중치: 월지(월령)가 가장 강하고, 일지가 그다음.
const WEIGHTS = {
  year: { stem: 1, branch: 1 },
  month: { stem: 1, branch: 2 },
  day: { stem: 0, branch: 1.5 }, // 일간 자신은 제외
  hour: { stem: 1, branch: 1 },
};

/** 일간을 돕는 힘(비겁+인성) vs 빼는 힘(식상+재성+관성). 양수면 신강. */
export function strengthScore(pillars) {
  const me = STEM_ELEMENT[pillars.day.stem];
  let score = 0;
  for (const key of PILLAR_KEYS) {
    const p = pillars[key];
    if (!p) continue;
    for (const [part, el] of [['stem', STEM_ELEMENT[p.stem]], ['branch', BRANCH_ELEMENT[p.branch]]]) {
      const rel = relation(me, el);
      const helps = rel === REL.SAME || rel === REL.GENERATES_ME;
      score += (helps ? 1 : -1) * WEIGHTS[key][part];
    }
  }
  return score;
}

/**
 * 간이 억부용신.
 *  - 신약: 인성(나를 생하는 오행). 단 인성이 이미 3개 이상이면 비겁.
 *  - 신강: 식상·관성·재성 중 가장 적은 오행(동률이면 식상 > 관성 > 재성 순).
 */
export function pickYongsin(pillars, counts) {
  const me = STEM_ELEMENT[pillars.day.stem];
  if (strengthScore(pillars) <= 0) {
    const mother = elementFor(me, REL.GENERATES_ME);
    return counts[mother] >= 3 ? me : mother;
  }
  const candidates = [REL.I_GENERATE, REL.CONTROLS_ME, REL.I_CONTROL].map((r) => elementFor(me, r));
  return candidates.reduce((best, el) => (counts[el] < counts[best] ? el : best));
}

// ── 신살 ────────────────────────────────────────────────────────────
// 삼합 그룹(branch % 4): 0=申子辰 1=巳酉丑 2=寅午戌 3=亥卯未
const YEOKMA = [2, 11, 8, 5]; // 역마: 寅 亥 申 巳
const DOHWA = [9, 6, 3, 0]; //  도화: 酉 午 卯 子
const HWAGAE = [4, 1, 10, 7]; // 화개: 辰 丑 戌 未
// 백호대살 7주: 甲辰 乙未 丙戌 丁丑 戊辰 壬戌 癸丑
const BAEKHO = new Set(['0-4', '1-7', '2-10', '3-1', '4-4', '8-10', '9-1']);

export const SHINSAL = Object.freeze({
  YEOKMA: 'YEOKMA',
  DOHWA: 'DOHWA',
  HWAGAE: 'HWAGAE',
  BAEKHO: 'BAEKHO',
});

/** 년지·일지를 기준으로 나머지 지지에서 역마/도화/화개를 찾고, 백호는 기둥 자체로 판정. */
export function findShinsal(pillars) {
  const found = new Set();
  const entries = PILLAR_KEYS.filter((k) => pillars[k]).map((k) => [k, pillars[k]]);

  for (const baseKey of ['year', 'day']) {
    const group = pillars[baseKey].branch % 4;
    for (const [key, p] of entries) {
      if (key === baseKey) continue;
      if (p.branch === YEOKMA[group]) found.add(SHINSAL.YEOKMA);
      if (p.branch === DOHWA[group]) found.add(SHINSAL.DOHWA);
      if (p.branch === HWAGAE[group]) found.add(SHINSAL.HWAGAE);
    }
  }
  for (const [, p] of entries) {
    if (BAEKHO.has(`${p.stem}-${p.branch}`)) found.add(SHINSAL.BAEKHO);
  }
  return [...found];
}

/** 3개 이상 = 과다, 0개 = 부재 */
export function findImbalance(counts) {
  return {
    excess: counts.flatMap((c, el) => (c >= 3 ? [el] : [])),
    missing: counts.flatMap((c, el) => (c === 0 ? [el] : [])),
  };
}

/** 생년월일시 → 게임용 사주 프로필 (순수 함수, 결정적) */
export function analyzeSaju(birth, opts) {
  const pillars = computeFourPillars(birth, opts);
  const counts = countElements(pillars);
  const dayMaster = STEM_ELEMENT[pillars.day.stem];
  const strength = strengthScore(pillars);
  const yongsin = pickYongsin(pillars, counts);
  return {
    pillars,
    dayMaster,
    dayMasterYang: pillars.day.stem % 2 === 0,
    counts,
    strength,
    isStrong: strength > 0,
    yongsin,
    gisin: controllerOf(yongsin), // 기신: 용신을 극하는 오행 → 게임 내 "가짜 아이템"
    shinsal: findShinsal(pillars),
    imbalance: findImbalance(counts),
  };
}

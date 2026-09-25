// 오늘의 일진(日辰) × 내 사주 → 일일 버프/디버프.
//
// 판정 3종을 합산한다.
//   ① 지지 관계: 오늘 일지 vs 내 일지 — 육합(+), 충(-)
//   ② 천간 관계: 오늘 일간 오행 vs 내 일간 오행 — 5가지 relation
//   ③ 천간합:    오늘 일간과 내 일간이 합(甲己·乙庚·丙辛·丁壬·戊癸)

import { STEM_ELEMENT } from './constants.js';
import { REL, relation } from './elements.js';
import { dayPillar } from './manse.js';

export const isYukhap = (a, b) => (a + b) % 12 === 1; // 子丑 寅亥 卯戌 辰酉 巳申 午未
export const isChung = (a, b) => Math.abs(a - b) === 6; // 子午 丑未 寅申 卯酉 辰戌 巳亥
export const isStemHap = (a, b) => Math.abs(a - b) === 5;

// 각 효과는 게임 파라미터에 곱/합으로 적용되는 modifier 묶음이다.
const STEM_EFFECTS = {
  [REL.GENERATES_ME]: { id: 'MOM_CHANCE', title: '엄마 찬스의 날', desc: '인성일 — 시작 HP +20', luck: 2, mods: { startHpBonus: 20 } },
  [REL.SAME]: { id: 'RIVAL', title: '라이벌 출몰의 날', desc: '비겁일 — 어제의 나(고스트)를 추월하면 점수 +2000', luck: 0, mods: { ghostRival: true } },
  [REL.I_GENERATE]: { id: 'TALENT', title: '끼 폭발의 날', desc: '식상일 — 피버 게이지 충전 +25%', luck: 1, mods: { feverChargeMult: 1.25 } },
  [REL.I_CONTROL]: { id: 'MONEY', title: '재물운 떡상의 날', desc: '재성일 — 코인 가치 ×1.5', luck: 1, mods: { coinMult: 1.5 } },
  [REL.CONTROLS_ME]: {
    id: 'TRIAL',
    title: '시련의 날',
    desc: '관성일 — 상극 장애물 +30%, 대신 액땜 점수 ×2',
    luck: -2,
    mods: { nemesisSpawnMult: 1.3, ackttemMult: 2 },
  },
};

const BRANCH_EFFECTS = {
  YUKHAP: { id: 'YUKHAP', title: '귀인 강림', desc: '육합 — 시작 보호막 1개, 코인 ×1.2', luck: 2, mods: { startShield: 1, coinMult: 1.2 } },
  CHUNG: { id: 'CHUNG', title: '충돌 주의보', desc: '충 — 장애물 밀도 +20%, 점수 ×1.3', luck: -2, mods: { obstacleDensityMult: 1.2, scoreMult: 1.3 } },
};

const STEM_HAP_EFFECT = { id: 'STEM_HAP', title: '천생연분', desc: '천간합 — 용신 아이템 출현률 ×2', luck: 1, mods: { yongsinSpawnMult: 2 } };

const GRADES = [
  { min: 4, label: '대길(大吉)', emoji: '🌈' },
  { min: 2, label: '길(吉)', emoji: '☀️' },
  { min: 0, label: '평(平)', emoji: '⛅' },
  { min: -2, label: '흉(凶)', emoji: '🌧️' },
  { min: -Infinity, label: '대흉(大凶)', emoji: '⛈️' },
];

/** modifier 병합: 이름이 *Mult 이면 곱, 나머지 숫자는 합, 불리언은 OR */
export function mergeMods(list) {
  const out = {};
  for (const mods of list) {
    for (const [k, v] of Object.entries(mods)) {
      if (typeof v === 'boolean') out[k] = out[k] || v;
      else if (k.endsWith('Mult')) out[k] = (out[k] ?? 1) * v;
      else out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/**
 * @param {ReturnType<import('./analyze.js').analyzeSaju>} profile
 * @param {{year:number, month:number, day:number}} today 기기 로컬 날짜
 */
export function computeDailyFortune(profile, today) {
  const todayP = dayPillar(today.year, today.month, today.day);
  const myDay = profile.pillars.day;
  const effects = [STEM_EFFECTS[relation(profile.dayMaster, STEM_ELEMENT[todayP.stem])]];

  if (isYukhap(todayP.branch, myDay.branch)) effects.push(BRANCH_EFFECTS.YUKHAP);
  if (isChung(todayP.branch, myDay.branch)) effects.push(BRANCH_EFFECTS.CHUNG);
  if (isStemHap(todayP.stem, myDay.stem)) effects.push(STEM_HAP_EFFECT);

  const luck = effects.reduce((s, e) => s + e.luck, 0);
  return {
    todayPillar: todayP,
    effects,
    luck,
    grade: GRADES.find((g) => luck >= g.min),
    mods: mergeMods(effects.map((e) => e.mods)),
  };
}

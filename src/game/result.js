// 게임 오버 → 결과 카드에 들어갈 텍스트 데이터.

import { ELEMENTS, pillarLabel, pillarLabelKo } from '../saju/constants.js';
import { REL } from '../saju/elements.js';

const hj = (el) => ELEMENTS[el].hanja;

// 사인(死因) 템플릿: 마지막 피격 관계별. {X}=장애물 오행, {ME}=내 일간 오행
const DEATH_TEMPLATES = {
  [REL.CONTROLS_ME]: ['{X} 기운 부주의로 삼재 도달', '{X}克{ME} — 상극 정면충돌', '{X}의 기운을 얕보다 팔자 꼬임'],
  [REL.I_GENERATE]: ['{X}에게 기 빨려 탈진', '퍼주다 퍼주다 방전 ({ME}生{X})'],
  [REL.SAME]: ['동족상잔 — {X}끼리 박치기', '거울 속의 나와 충돌'],
  [REL.GENERATES_ME]: ['엄마({X})한테 등짝 맞고 기절', '과잉보호({X}生{ME})로 질식'],
  [REL.I_CONTROL]: ['만만한 {X}에게 방심하다 역관광', '재물({X})에 눈이 멀어 추락'],
};
const DOT_TEMPLATE = '{X} 기운에 벌목당해 과다출혈';

export function deathCause(char, run, rng = Math.random) {
  const hit = run.lastHit;
  if (!hit || hit.element === undefined) return '원인 불명의 급살';
  const fill = (t) => t.replaceAll('{X}', hj(hit.element)).replaceAll('{ME}', hj(char.elements.me));
  if (hit.cause === 'DOT') return fill(DOT_TEMPLATE);
  const list = DEATH_TEMPLATES[hit.rel];
  return fill(list[Math.floor(rng() * list.length)]);
}

/**
 * 오늘의 액땜 성공률(%)
 *   거리 달성(40) + 상극 회피율(30, 시련의 날 ×2 가중) + 용신버스터(15) + 콤보(15), 최대 99
 *   목표 거리는 오늘 운세가 나쁠수록 짧아진다(흉한 날엔 조금만 버텨도 액땜).
 */
export function ackttemRate(char, run) {
  const target = 3000 + char.fortune.luck * 300;
  const distPart = 40 * Math.min(1, run.distance / target);
  const { nemesisHit, nemesisDodged, yongsinBusters } = run.log;
  const seen = nemesisHit + nemesisDodged;
  const dodgeRatio = seen ? nemesisDodged / seen : 0.5;
  const nemesisPart = Math.min(30, 30 * dodgeRatio * (char.mods.ackttemMult ?? 1));
  const busterPart = yongsinBusters > 0 ? 15 : 0;
  const comboPart = 15 * Math.min(1, run.maxCombo / 50);
  return Math.min(99, Math.round(distPart + nemesisPart + busterPart + comboPart));
}

const ackttemComment = (rate) =>
  rate >= 90 ? '올해 액운 선결제 완료. 오늘은 뭘 해도 됨'
  : rate >= 70 ? '큰 액은 막았다. 잔챙이는 알아서 피하세요'
  : rate >= 40 ? '반타작. 오늘은 계단 조심'
  : '액땜 실패… 한 판 더 뛰어서 갚으세요';

/** 오행 분포 → "木2 火1 土3 金0 水2" */
const countsLine = (counts) => counts.map((c, i) => `${hj(i)}${c}`).join(' ');

export function buildResultData(char, run, rng = Math.random) {
  const { profile, fortune, character } = char;
  const p = profile.pillars;
  const rate = ackttemRate(char, run);
  const cause = deathCause(char, run, rng);
  return {
    title: '운명 피하기',
    subtitle: '내 사주대로 달린다',
    characterName: character.name,
    dayMaster: `${hj(profile.dayMaster)} 일간 · ${profile.isStrong ? '신강' : '신약'}`,
    pillars: ['hour', 'day', 'month', 'year'].map((k) => ({
      label: { hour: '시', day: '일', month: '월', year: '년' }[k],
      hanja: pillarLabel(p[k]),
      ko: pillarLabelKo(p[k]),
    })),
    elementCounts: profile.counts,
    elementLine: countsLine(profile.counts),
    yongsin: `용신 ${hj(profile.yongsin)} · 기신 ${hj(profile.gisin)}`,
    traits: char.traits.map((t) => t.name),
    todayLine: `${fortune.grade.emoji} 오늘 ${pillarLabel(fortune.todayPillar)}일 — ${fortune.grade.label}`,
    distance: Math.floor(run.distance),
    score: Math.floor(run.score),
    maxCombo: run.maxCombo,
    deathCause: cause,
    ackttemRate: rate,
    ackttemComment: ackttemComment(rate),
    shareText: `[운명 피하기] ${hj(profile.dayMaster)}일간 ${character.name} ${Math.floor(run.distance)}m 생존! 사인: ${cause} / 액땜 ${rate}% 🔮`,
  };
}

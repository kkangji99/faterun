// 기획 수치 테이블. 밸런싱은 이 파일만 고치면 되도록 로직과 분리한다.

import { WOOD, FIRE, EARTH, METAL, WATER } from '../saju/constants.js';
import { REL } from '../saju/elements.js';
import { SHINSAL } from '../saju/analyze.js';

// 기본 스탯: hp, speed(px/s 배율), jump(점프력 배율), magnet(px), iframe(피격 무적 ms)
export const BASE_STATS = { hp: 100, speed: 1.0, jump: 1.0, magnet: 40, iframe: 800, maxJumps: 1 };

// ── 일간(본원) 캐릭터 ────────────────────────────────────────────
export const DAY_MASTER_CHARACTERS = {
  [WOOD]: {
    name: '죽순 닌자 "뚝심이"',
    visual: '대나무 삿갓 + 초록 두건, 달릴수록 머리에 새싹이 자람',
    stats: { hp: 100, speed: 1.0, jump: 1.1 },
    passive: { id: 'GROWTH', name: '쑥쑥 성장', desc: '30초 생존마다 최대 HP +5, 즉시 5 회복 (최대 +30)' },
  },
  [FIRE]: {
    name: '불꽃 폭주족 "화끈이"',
    visual: '불타는 모히칸 + 가죽재킷, 발자국마다 불똥',
    stats: { hp: 80, speed: 1.15, jump: 1.0 },
    passive: { id: 'COMBO_BLAZE', name: '불붙은 콤보', desc: '코인 20콤보 시 3초 불꽃대시(전방 장애물 파괴, 점수 ×2)' },
  },
  [EARTH]: {
    name: '돌하르방 탱커 "묵직이"',
    visual: '미니 돌하르방, 달리면 쿵쿵 흙먼지',
    stats: { hp: 140, speed: 0.9, jump: 0.9 },
    passive: { id: 'ROCK_SHIELD', name: '바위 피부', desc: '피격 1회 무효 보호막, 20초마다 재생성' },
  },
  [METAL]: {
    name: '칼각 로봇 "쇠돌이"',
    visual: '크롬 바디 + 한쪽 눈 레이저 조준경',
    stats: { hp: 90, speed: 1.05, jump: 1.0 },
    passive: { id: 'JUST_DODGE', name: '칼같은 회피', desc: '장애물을 0.15초 이내 아슬아슬하게 피하면 슬로모 + 점수 ×3' },
  },
  [WATER]: {
    name: '물방울 슬라임 "말랑이"',
    visual: '반투명 파란 슬라임, 슬라이딩 시 납작하게 퍼짐',
    stats: { hp: 100, speed: 1.0, jump: 1.0, maxJumps: 2, iframe: 1200 },
    passive: { id: 'FLOW', name: '물 흐르듯', desc: '2단 점프(물수제비), 피격 무적시간 +50%, 슬라이딩 길이 ×1.5' },
  },
};

// ── 신살 패시브 ─────────────────────────────────────────────────
// mods 는 iljin.mergeMods 규칙(…Mult 곱, 숫자 합, bool OR)으로 합쳐진다.
export const SHINSAL_EFFECTS = {
  [SHINSAL.YEOKMA]: {
    name: '역마살 — 해외출장 러너',
    desc: '기본 속도 ×1.5, 점수 ×1.8, 받는 피해 ×1.2. 30초마다 배경 국가가 랜덤 전환',
    mods: { speedMult: 1.5, scoreMult: 1.8, damageTakenMult: 1.2, stageShuffle: true },
  },
  [SHINSAL.DOHWA]: {
    name: '도화살 — 인기 폭발',
    desc: '코인·아이템 자석 반경 180px. 장애물 5%가 반해서 스스로 비켜줌. 대신 가끔 코인 대신 "러브레터"(0점)가 섞임',
    mods: { magnetBonus: 140, obstacleSwoonChance: 0.05, loveLetterChance: 0.1 },
  },
  [SHINSAL.HWAGAE]: {
    name: '화개살 — 도사 모드',
    desc: 'HP 0 시 1회 "윤회" 부활(HP 30%). 피버 게이지 충전 +30%. 속세 무관심으로 코인 가치 -20%',
    mods: { reviveCount: 1, feverChargeMult: 1.3, coinMult: 0.8 },
  },
  [SHINSAL.BAEKHO]: {
    name: '백호살 — 들이받는 호랑이',
    desc: '충돌 시 30% 확률로 장애물을 박살(무피해 + 500점). 대신 받는 피해 ×1.3',
    mods: { smashChance: 0.3, damageTakenMult: 1.3 },
  },
};

// ── 오행 과다(≥3) / 부재(0) ─────────────────────────────────────
export const EXCESS_EFFECTS = {
  [WOOD]: { name: '木 과다 — 정글의 법칙', desc: '木 장애물 출현 +50%, 점프력 +10%', mods: { jumpMult: 1.1, spawnWeightWOOD: 0.5 } },
  [FIRE]: { name: '火 과다 — 과열 경보', desc: '속도 +10%, 피버 지속 +2초. 단 20초마다 1초간 화면 아지랑이', mods: { speedMult: 1.1, feverDurationBonus: 2000, heatHaze: true } },
  [EARTH]: { name: '土 과다 — 고집불통', desc: '넉백·속도저하 상태이상 면역, 점프력 -10%', mods: { jumpMult: 0.9, slowImmune: true } },
  [METAL]: { name: '金 과다 — 금속탐지기', desc: '코인 가치 +20%, 金 장애물 피해 -30%(동족 할인)', mods: { coinMult: 1.2, sameElementDamageMult: 0.7 } },
  [WATER]: { name: '水 과다 — 범람', desc: '슬라이딩 중 낮은 장애물 무시, 가끔 화면이 물결처럼 일렁임', mods: { slideIgnoresLow: true, waveFx: true } },
};

export const MISSING_EFFECTS = {
  [WOOD]: { name: '無木 — 성장판 닫힘', desc: '木 아이템 효과 ×2. 점프 체공 -5%', mods: { jumpMult: 0.95 } },
  [FIRE]: { name: '無火 — 열정 품절', desc: '火 아이템 효과 ×2. 피버 지속 -1초', mods: { feverDurationBonus: -1000 } },
  [EARTH]: { name: '無土 — 뿌리 없는 러너', desc: '土 아이템 효과 ×2. 착지 경직 +0.05초', mods: { landingLagBonus: 50 } },
  [METAL]: { name: '無金 — 결단력 가출', desc: '金 아이템 효과 ×2. 저스트 회피 판정 -30%', mods: { justDodgeWindowMult: 0.7 } },
  [WATER]: { name: '無水 — 건조주의보', desc: '水 아이템 효과 ×2. 피격 무적시간 -20%', mods: { iframeMult: 0.8 } },
};
// 부재 오행 아이템 효과 배율 (결핍 보상)
export const MISSING_ITEM_BONUS = 2;

// ── 충돌 데미지 ────────────────────────────────────────────────
export const BASE_OBSTACLE_DAMAGE = 20;

// 장애물 오행이 일간에 대해 갖는 관계별 배율
export const REL_DAMAGE_MULT = {
  [REL.CONTROLS_ME]: 2.0, //  상극: 나를 극함 → 2배 + 상태이상
  [REL.I_GENERATE]: 1.2, //   식상: 내 기운이 빠짐
  [REL.SAME]: 1.0, //         비겁: 보통
  [REL.GENERATES_ME]: 0.7, // 인성: 살살 부딪힘
  [REL.I_CONTROL]: 0.5, //    재성: 내가 이김 → 반감 + 20% 확률 파괴
};
export const I_CONTROL_BREAK_CHANCE = 0.2;

// 상극 장애물의 오행(공격자)별 상태이상
export const STATUS_BY_ATTACKER = {
  [METAL]: { id: 'BLEED', name: '벌목당함', desc: '3초간 초당 HP -3', duration: 3000, dotPerSec: 3 }, //       金克木
  [WATER]: { id: 'DOUSED', name: '불씨 꺼짐', desc: '2초간 속도 -30%', duration: 2000, speedMult: 0.7 }, //      水克火
  [WOOD]: { id: 'ROOTED', name: '뿌리 박힘', desc: '1.5초간 점프 불가', duration: 1500, noJump: true }, //      木克土
  [FIRE]: { id: 'MELTED', name: '녹아내림', desc: '1.5초간 점프/슬라이드 버튼 반전', duration: 1500, invertInput: true }, // 火克金
  [EARTH]: { id: 'MUDDY', name: '흙탕물 샤워', desc: '2초간 화면 60% 진흙 가림', duration: 2000, blind: 0.6 }, // 土克水
};

// ── 아이템 ─────────────────────────────────────────────────────
export const ITEM_RULES = {
  // 인성(나를 생하는 오행) 아이템
  MOTHER: { heal: 15, fever: 20 },
  // 비겁(같은 오행) 아이템
  SAME: { score: 300, fever: 10 },
  // 그 외 오행 아이템
  OTHER: { score: 100, fever: 5 },
  // 기신(용신을 극하는 오행) 가짜 아이템
  GISIN: { fever: -30, score: -200 },
};

export const FEVER = {
  max: 100,
  normalDuration: 4000, // 게이지 100 → 일반 피버
  yongsinDuration: 6000, // 용신 아이템 → 용신버스터
  yongsinSpeedMult: 1.6,
  yongsinScorePerObstacle: 300,
  yongsinGuaranteeMs: 45000, // 45초간 용신 아이템이 안 나오면 강제 출현
  yongsinBaseChance: 0.02,
};

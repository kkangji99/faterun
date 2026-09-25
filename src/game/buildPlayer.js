// 생년월일시(+오늘 날짜) → 플레이어 캐릭터·스탯·modifier 일체.

import { ELEMENTS } from '../saju/constants.js';
import { REL, elementFor } from '../saju/elements.js';
import { analyzeSaju } from '../saju/analyze.js';
import { computeDailyFortune, mergeMods } from '../saju/iljin.js';
import {
  BASE_STATS,
  DAY_MASTER_CHARACTERS,
  SHINSAL_EFFECTS,
  EXCESS_EFFECTS,
  MISSING_EFFECTS,
} from './tables.js';

/**
 * 생년월일시 데이터 기반으로 캐릭터 속성을 부여한다.
 * @param {{year:number, month:number, day:number, hour?:number|null, minute?:number}} birth
 * @param {{year:number, month:number, day:number}} today
 */
export function createCharacter(birth, today) {
  const profile = analyzeSaju(birth);
  const fortune = computeDailyFortune(profile, today);
  const character = DAY_MASTER_CHARACTERS[profile.dayMaster];

  // 발동한 특성 목록 (결과 카드/시작 화면에 그대로 노출)
  const traits = [
    ...profile.shinsal.map((s) => SHINSAL_EFFECTS[s]),
    ...profile.imbalance.excess.map((el) => EXCESS_EFFECTS[el]),
    ...profile.imbalance.missing.map((el) => MISSING_EFFECTS[el]),
  ];
  const mods = mergeMods([...traits.map((t) => t.mods), fortune.mods]);

  const base = { ...BASE_STATS, ...character.stats };
  const stats = {
    maxHp: base.hp,
    hp: base.hp + (mods.startHpBonus ?? 0), // 일진 보너스는 최대치를 넘는 오버힐로 시작
    speed: base.speed * (mods.speedMult ?? 1),
    jump: base.jump * (mods.jumpMult ?? 1),
    maxJumps: base.maxJumps,
    magnet: base.magnet + (mods.magnetBonus ?? 0),
    iframe: base.iframe * (mods.iframeMult ?? 1),
    shield: (character.passive.id === 'ROCK_SHIELD' ? 1 : 0) + (mods.startShield ?? 0),
    revives: mods.reviveCount ?? 0,
  };

  return {
    profile,
    fortune,
    character,
    traits,
    mods,
    stats,
    spawnWeights: obstacleSpawnWeights(profile, mods),
    // 자주 쓰는 오행 레퍼런스
    elements: {
      me: profile.dayMaster,
      nemesis: elementFor(profile.dayMaster, REL.CONTROLS_ME), // 나를 극하는 오행
      mother: elementFor(profile.dayMaster, REL.GENERATES_ME), // 나를 생하는 오행
      yongsin: profile.yongsin,
      gisin: profile.gisin,
    },
  };
}

/** 장애물 오행 출현 가중치: 기본 1, 오늘 시련의 날이면 상극 +30%, 과다 오행 보정 */
export function obstacleSpawnWeights(profile, mods) {
  const nemesis = elementFor(profile.dayMaster, REL.CONTROLS_ME);
  return ELEMENTS.map(({ id, key }) => {
    let w = 1 + (mods[`spawnWeight${key}`] ?? 0);
    if (id === nemesis) w *= mods.nemesisSpawnMult ?? 1;
    return w;
  });
}

export function pickWeighted(weights, rng = Math.random) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

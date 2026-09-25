// 상생상극 충돌 판정 / 아이템 획득 / 틱 처리.
// Phaser 에 의존하지 않는 순수 로직이라 node 테스트로 검증할 수 있다.
// 씬은 이 함수들이 돌려준 이벤트를 보고 연출(이펙트·사운드·카메라)만 담당한다.

import { ELEMENTS } from '../saju/constants.js';
import { REL, relation } from '../saju/elements.js';
import { SHINSAL } from '../saju/analyze.js';
import {
  BASE_OBSTACLE_DAMAGE,
  REL_DAMAGE_MULT,
  I_CONTROL_BREAK_CHANCE,
  STATUS_BY_ATTACKER,
  ITEM_RULES,
  MISSING_ITEM_BONUS,
  FEVER,
  SCENE_FX,
  JUST_DODGE,
  GHOST,
} from './tables.js';

/** 한 판의 가변 상태 */
export function createRunState(char) {
  return {
    hp: char.stats.hp,
    maxHp: char.stats.maxHp,
    shield: char.stats.shield,
    revives: char.stats.revives,
    fever: 0,
    feverUntil: 0,
    feverKind: null, // 'NORMAL' | 'YONGSIN'
    invincibleUntil: 0,
    statuses: [], // { ...STATUS, until }
    score: 0,
    coins: 0,
    combo: 0,
    maxCombo: 0,
    distance: 0,
    lastHit: null, // { element, rel, status }
    floodReadyAt: 0, // 水 과다 물보라 쿨다운
    ghostPassed: false,
    lastYongsinAt: 0,
    growthStacks: 0,
    nextShieldAt: 0,
    log: { nemesisHit: 0, nemesisDodged: 0, hitsByElement: [0, 0, 0, 0, 0], yongsinBusters: 0, smashed: 0, justDodges: 0, splashes: 0 },
    dead: false,
  };
}

/**
 * 충돌 데미지 공식
 *   damage = round( BASE × size × REL_MULT[관계] × 동족할인 × 신살/일진 피해배율 )
 */
export function calcDamage(char, obstacle) {
  const rel = relation(char.elements.me, obstacle.element);
  let dmg = BASE_OBSTACLE_DAMAGE * (obstacle.size ?? 1) * REL_DAMAGE_MULT[rel];
  if (rel === REL.SAME) dmg *= char.mods.sameElementDamageMult ?? 1;
  dmg *= char.mods.damageTakenMult ?? 1;
  return { rel, damage: Math.max(1, Math.round(dmg)) };
}

export const isFever = (run, now) => now < run.feverUntil;

/** 점수 획득은 전부 여기로: 역마살·충 등의 점수 배율(scoreMult)을 적용한다 */
export function addScore(run, char, points) {
  const gained = Math.round(points * (char.mods.scoreMult ?? 1));
  run.score += gained;
  return gained;
}

/**
 * 상생상극 충돌 판정.
 * pose.sliding: 플레이어가 슬라이딩 중인지 (水 과다 물보라 판정용)
 * @returns {{type:'IGNORED'|'SMASH'|'BLOCK'|'HIT'|'REVIVE'|'DEAD', rel?:string, damage?:number, status?:object, score?:number, reason?:string}}
 */
export function resolveCollision(run, char, obstacle, now, rng = Math.random, pose = {}) {
  if (run.dead || obstacle.swooned) return { type: 'IGNORED' };
  if (now < run.invincibleUntil && !isFever(run, now)) return { type: 'IGNORED' };

  const rel = relation(char.elements.me, obstacle.element);
  const smash = (score, reason) => {
    run.log.smashed++;
    return { type: 'SMASH', rel, score: addScore(run, char, score), reason };
  };

  // 1) 피버/용신버스터 중엔 전부 박살
  if (isFever(run, now)) {
    return smash(run.feverKind === 'YONGSIN' ? FEVER.yongsinScorePerObstacle : 150, 'FEVER');
  }
  // 2) 水 과다 "범람": 슬라이딩 중 낮은 장애물을 물보라로 통과 (쿨다운)
  if (pose.sliding && char.mods.slideIgnoresLow && !obstacle.high && now >= run.floodReadyAt) {
    run.floodReadyAt = now + SCENE_FX.floodSplashCooldownMs;
    run.log.splashes++;
    return { type: 'SPLASH', rel };
  }
  // 3) 백호살: 확률 들이받기
  if (char.profile.shinsal.includes(SHINSAL.BAEKHO) && rng() < (char.mods.smashChance ?? 0)) {
    return smash(500, 'BAEKHO');
  }
  // 4) 재성(내가 극하는 오행): 확률 파괴
  if (rel === REL.I_CONTROL && rng() < I_CONTROL_BREAK_CHANCE) {
    return smash(200, 'I_CONTROL');
  }
  // 5) 보호막
  if (run.shield > 0) {
    run.shield--;
    run.invincibleUntil = now + char.stats.iframe;
    return { type: 'BLOCK', rel };
  }

  // 6) 피해 + 상극 상태이상
  const { damage } = calcDamage(char, obstacle);
  let status = null;
  if (rel === REL.CONTROLS_ME) {
    run.log.nemesisHit++;
    status = STATUS_BY_ATTACKER[obstacle.element];
    if (status.speedMult && char.mods.slowImmune) status = null;
    if (status) applyStatus(run, status, now);
  }
  run.hp -= damage;
  run.combo = 0;
  run.log.hitsByElement[obstacle.element]++;
  run.lastHit = { element: obstacle.element, rel, status, cause: 'HIT' };
  run.invincibleUntil = now + char.stats.iframe;

  if (run.hp <= 0) return onZeroHp(run, now, { rel, damage, status });
  return { type: 'HIT', rel, damage, status };
}

function applyStatus(run, status, now) {
  run.statuses = run.statuses.filter((s) => s.id !== status.id);
  run.statuses.push({ ...status, until: now + status.duration });
}

function onZeroHp(run, now, info) {
  if (run.revives > 0) {
    run.revives--;
    run.hp = Math.round(run.maxHp * 0.3);
    run.statuses = [];
    run.invincibleUntil = now + 2000;
    return { type: 'REVIVE', ...info };
  }
  run.hp = 0;
  run.dead = true;
  return { type: 'DEAD', ...info };
}

/** 장애물을 맞지 않고 지나쳤을 때 (씬에서 화면 밖으로 나갈 때 호출) */
export function onObstaclePassed(run, char, obstacle) {
  if (relation(char.elements.me, obstacle.element) === REL.CONTROLS_ME && !obstacle.hit) {
    run.log.nemesisDodged++;
  }
}

/**
 * 아이템 획득 처리.
 * item = { element, special?: 'YONGSIN' | 'GISIN' | 'COIN' | 'LOVE_LETTER' }
 */
export function resolveItem(run, char, item, now) {
  const bonus = char.profile.imbalance.missing.includes(item.element) ? MISSING_ITEM_BONUS : 1;

  if (item.special === 'COIN') {
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    const value = Math.round(10 * (char.mods.coinMult ?? 1));
    run.coins += value;
    addScore(run, char, value);
    return { type: 'COIN', value };
  }
  if (item.special === 'LOVE_LETTER') return { type: 'LOVE_LETTER', value: 0 };

  if (item.special === 'YONGSIN') {
    triggerFever(run, char, now, 'YONGSIN');
    run.lastYongsinAt = now;
    run.log.yongsinBusters++;
    return { type: 'YONGSIN_BUSTER' };
  }
  if (item.special === 'GISIN') {
    run.fever = Math.max(0, run.fever + ITEM_RULES.GISIN.fever);
    run.score = Math.max(0, run.score + ITEM_RULES.GISIN.score);
    return { type: 'GISIN_TRAP' };
  }

  const rel = relation(char.elements.me, item.element);
  const rule = rel === REL.GENERATES_ME ? ITEM_RULES.MOTHER : rel === REL.SAME ? ITEM_RULES.SAME : ITEM_RULES.OTHER;
  const heal = (rule.heal ?? 0) * bonus;
  if (heal) run.hp = Math.min(run.maxHp, run.hp + heal);
  if (rule.score) addScore(run, char, rule.score * bonus);
  const spark = addFever(run, char, rule.fever * bonus, now);
  return { type: rel === REL.GENERATES_ME ? 'MOTHER_BUFF' : 'ELEMENT', rel, heal, bonus, spark };
}

/** 피버 게이지 증가. 가득 차면 일반 피버 발동 */
export function addFever(run, char, amount, now) {
  if (isFever(run, now)) return false;
  run.fever = Math.min(FEVER.max, run.fever + amount * (char.mods.feverChargeMult ?? 1));
  if (run.fever >= FEVER.max) {
    triggerFever(run, char, now, 'NORMAL');
    return true;
  }
  return false;
}

export function triggerFever(run, char, now, kind) {
  const base = kind === 'YONGSIN' ? FEVER.yongsinDuration : FEVER.normalDuration;
  const duration = base + (char.mods.feverDurationBonus ?? 0);
  run.fever = 0;
  run.feverKind = kind;
  run.feverUntil = now + duration;
  run.invincibleUntil = Math.max(run.invincibleUntil, now + duration);
  run.statuses = [];
}

/**
 * 저스트 회피: 장애물이 닿기 직전(windowMs 이내)에 점프/슬라이딩을 시작해 무사히 통과했을 때.
 * 누구나 +100, 金 일간(칼같은 회피)은 ×3 + 슬로모.
 */
export function resolveJustDodge(run, char) {
  const metal = char.character.passive.id === 'JUST_DODGE';
  run.log.justDodges++;
  run.combo++;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  const score = addScore(run, char, JUST_DODGE.baseScore * (metal ? JUST_DODGE.metalMult : 1));
  return { type: 'JUST_DODGE', score, slowmo: metal };
}

/** 저스트 회피 판정 시간창(ms): 無金이면 좁아진다 */
export const justDodgeWindow = (char) => JUST_DODGE.windowMs * (char.mods.justDodgeWindowMult ?? 1);

/** 장애물이 플레이어에 닿기 시작한 시각 기준으로, 마지막 회피 동작이 시간창 안이었나 */
export const isJustTiming = (char, lastActionAt, contactAt) =>
  lastActionAt > 0 && contactAt - lastActionAt >= 0 && contactAt - lastActionAt <= justDodgeWindow(char);

/** 라이벌 고스트(어제의 나) 추월 — 한 판에 1회 */
export function resolveGhostPass(run, char) {
  if (run.ghostPassed) return null;
  run.ghostPassed = true;
  return { type: 'GHOST_PASSED', score: addScore(run, char, GHOST.bonus) };
}

/** 매 프레임 호출: 상태이상 DoT/만료, 일간 패시브 */
export function tickRun(run, char, now, dtMs) {
  if (run.dead) return [];
  const events = [];
  run.statuses = run.statuses.filter((s) => s.until > now);
  for (const s of run.statuses) {
    if (!s.dotPerSec) continue;
    run.hp -= (s.dotPerSec * dtMs) / 1000;
    if (run.hp <= 0) {
      run.lastHit = { element: run.lastHit?.element, rel: REL.CONTROLS_ME, status: s, cause: 'DOT' };
      events.push(onZeroHp(run, now, { status: s }));
      if (run.dead) return events;
    }
  }

  const passive = char.character.passive.id;
  if (passive === 'GROWTH') {
    const stacks = Math.min(6, Math.floor(now / 30000));
    if (stacks > run.growthStacks) {
      run.growthStacks = stacks;
      run.maxHp += 5;
      run.hp = Math.min(run.maxHp, run.hp + 5);
      events.push({ type: 'GROWTH', stacks });
    }
  }
  if (passive === 'ROCK_SHIELD' && run.shield === 0) {
    if (!run.nextShieldAt) run.nextShieldAt = now + 20000;
    else if (now >= run.nextShieldAt) {
      run.shield = 1;
      run.nextShieldAt = 0;
      events.push({ type: 'SHIELD_REGEN' });
    }
  }
  if (passive === 'COMBO_BLAZE' && run.combo > 0 && run.combo % 20 === 0 && !isFever(run, now)) {
    run.combo++; // 같은 20콤보에서 중복 발동 방지
    run.feverKind = 'NORMAL';
    run.feverUntil = now + 3000;
    run.invincibleUntil = Math.max(run.invincibleUntil, now + 3000);
    events.push({ type: 'COMBO_BLAZE' });
  }
  return events;
}

/** 현재 상태이상이 입력/속도에 주는 영향 */
export function statusEffects(run) {
  return {
    speedMult: run.statuses.reduce((m, s) => m * (s.speedMult ?? 1), 1),
    noJump: run.statuses.some((s) => s.noJump),
    invertInput: run.statuses.some((s) => s.invertInput),
    blind: run.statuses.reduce((m, s) => Math.max(m, s.blind ?? 0), 0),
  };
}

export const elementName = (el) => `${ELEMENTS[el].hanja}(${ELEMENTS[el].ko})`;

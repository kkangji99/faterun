// 운명 피하기 규칙. 하늘에서 떨어지는 것들을 좌우로 움직여 피한다.
// Phaser 없이 돌아가는 순수 로직이라 node 로 테스트한다.
//
//   내 색깔(본캐 오행)  → 친구. 닿으면 먹어서 점수 + 콤보
//   다른 색깔          → 운명. 닿으면 하트 -1
//   아슬아슬하게 피함   → 보너스 점수 + 콤보 + 럭키 게이지
//   럭키 게이지 가득 / 럭키템 → 럭키타임: 닿는 건 전부 코인으로

import { FORMS, DEATH_LINES, ACKTTEM_COMMENTS, josa } from './content.js';

export const TUNING = {
  startHearts: 3,
  maxHearts: 5,
  hurtInvincibleMs: 1200,
  friendScore: 50,
  nearMissScore: 30,
  luckyScore: 40,
  coinValue: 10,
  fakePenalty: 300,
  gaugePerFriend: 10,
  gaugePerNearMiss: 8,
  luckyMs: 5000,
  survivePerSec: 10,
};

/** 콤보 5마다 배율 +0.5, 최대 ×3 */
export const comboMult = (combo) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5);

export function createRun(profile) {
  return {
    hearts: Math.min(TUNING.maxHearts, TUNING.startHearts + (profile.mods.bonusHearts ?? 0)),
    score: 0,
    coins: 0,
    combo: 0,
    maxCombo: 0,
    friends: 0, //    먹은 친구 수
    nearMisses: 0, // 아슬아슬 회피 수
    timeMs: 0, //     버틴 시간
    gauge: 0,
    luckyUntil: 0,
    luckyCount: 0,
    invUntil: 0,
    revives: profile.mods.revives ?? 0,
    lastHit: null,
    dead: false,
  };
}

function addScore(run, profile, points) {
  const gained = Math.round(points * (profile.mods.scoreMult ?? 1));
  run.score = Math.max(0, run.score + gained);
  return gained;
}

export const isLucky = (run, now) => now < run.luckyUntil;

export function startLucky(run, profile, now) {
  run.luckyUntil = now + TUNING.luckyMs + (profile.mods.luckyBonusMs ?? 0);
  run.gauge = 0;
  run.luckyCount++;
}

function bump(run, profile, now, gauge) {
  run.combo++;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  if (isLucky(run, now)) return false;
  run.gauge = Math.min(100, run.gauge + gauge);
  if (run.gauge < 100) return false;
  startLucky(run, profile, now);
  return true;
}

/** 버틴 시간 점수 (매 프레임) */
export function survive(run, profile, dtMs) {
  run.timeMs += dtMs;
  run.score += (TUNING.survivePerSec * (profile.mods.scoreMult ?? 1) * dtMs) / 1000;
}

/**
 * 떨어지는 것에 닿았을 때.
 * @param {{element:number}} drop
 * @returns {{type:'FRIEND'|'LUCKY_COIN'|'DEFLECT'|'HURT'|'REVIVE'|'DEAD'|'NONE', ...}}
 */
export function touchDrop(run, profile, drop, now, rng = Math.random) {
  if (run.dead) return { type: 'NONE' };
  if (drop.element === profile.me) {
    run.friends++;
    const score = addScore(run, profile, TUNING.friendScore * comboMult(run.combo + 1));
    const lucky = bump(run, profile, now, TUNING.gaugePerFriend);
    return { type: 'FRIEND', score, combo: run.combo, lucky };
  }
  if (isLucky(run, now)) {
    const score = addScore(run, profile, TUNING.luckyScore);
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    return { type: 'LUCKY_COIN', score };
  }
  if (now < run.invUntil) return { type: 'NONE' };
  if (rng() < (profile.mods.tigerChance ?? 0)) return { type: 'DEFLECT' };

  run.hearts -= 1;
  run.combo = 0;
  run.invUntil = now + TUNING.hurtInvincibleMs;
  run.lastHit = { element: drop.element, nemesis: drop.element === profile.nemesis };
  if (run.hearts > 0) return { type: 'HURT', element: drop.element };
  if (run.revives > 0) {
    run.revives--;
    run.hearts = 2;
    run.invUntil = now + 2000;
    return { type: 'REVIVE', element: drop.element };
  }
  run.hearts = 0;
  run.dead = true;
  return { type: 'DEAD', element: drop.element };
}

/** 아슬아슬 회피 (운명 하나당 한 번) */
export function nearMiss(run, profile, now) {
  run.nearMisses++;
  const score = addScore(run, profile, TUNING.nearMissScore * comboMult(run.combo + 1));
  const lucky = bump(run, profile, now, TUNING.gaugePerNearMiss);
  return { type: 'NEAR_MISS', score, combo: run.combo, lucky };
}

/** 아이템: COIN · HEART · LUCKY(럭키템) · FAKE(짝퉁 럭키템) */
export function pickItem(run, profile, item, now) {
  switch (item.kind) {
    case 'COIN': {
      const value = Math.round(TUNING.coinValue * (profile.mods.coinMult ?? 1));
      run.coins += value;
      return { type: 'COIN', score: addScore(run, profile, value) };
    }
    case 'HEART':
      run.hearts = Math.min(TUNING.maxHearts, run.hearts + 1);
      return { type: 'HEART' };
    case 'LUCKY':
      startLucky(run, profile, now);
      return { type: 'LUCKY' };
    case 'FAKE':
      run.gauge = 0;
      run.score = Math.max(0, run.score - TUNING.fakePenalty);
      return { type: 'FAKE' };
  }
  return { type: 'NONE' };
}

// ── 결과 ──────────────────────────────────────────────────────
export function deathLine(profile, run, rng = Math.random) {
  const hit = run.lastHit;
  if (!hit) return '원인 불명의 급살';
  const list = hit.nemesis ? DEATH_LINES.NEMESIS : DEATH_LINES.OTHER;
  const me = FORMS[profile.me];
  const obs = FORMS[hit.element].obstacle;
  return list[Math.floor(rng() * list.length)]
    .replace('{obs이}', josa(obs, '이', '가'))
    .replaceAll('{obs}', obs)
    .replace('{faint}', me.faint);
}

/** 오늘의 액땜 성공률(%). 100%는 없다. */
export function ackttemRate(run) {
  const rate =
    40 * Math.min(1, run.timeMs / 60000) +
    20 * Math.min(1, run.nearMisses / 20) +
    20 * Math.min(1, run.friends / 30) +
    10 * Math.min(1, run.maxCombo / 20) +
    (run.luckyCount > 0 ? 10 : 0);
  return Math.min(99, Math.round(rate));
}

export const ackttemComment = (rate) => ACKTTEM_COMMENTS.find(([min]) => rate >= min)[1];

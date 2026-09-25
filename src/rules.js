// 오행 가위바위보 규칙. Phaser 없이 돌아가는 순수 로직이라 node 로 테스트한다.
//
// 모양 5개가 서로 물고 물린다:  나무 > 흙 > 물 > 불 > 쇠 > 나무
// (사주 용어로 상극. 인덱스로는 a 가 b 를 이긴다 ⇔ (a + 2) % 5 === b)
//
// 장애물에 부딪혔을 때 내 모양 기준 결과:
//   WIN   이기는 모양 → 부숨! 점수 + 콤보
//   SAME  같은 모양   → 같은 편이라 스르륵 통과
//   LOSE  지는 모양   → 하트 -2 (천적!)
//   BUMP  그 외       → 하트 -1

import { FORMS, DEATH_LINES, ACKTTEM_COMMENTS, josa } from './content.js';

export const OUTCOME = Object.freeze({ WIN: 'WIN', SAME: 'SAME', LOSE: 'LOSE', BUMP: 'BUMP' });

export const beats = (a, b) => (a + 2) % 5 === b;
export const counterOf = (element) => (element + 3) % 5; // element 를 이기는 모양
export const nextForm = (form) => (form + 1) % 5;
export const tapsTo = (from, to) => (to - from + 5) % 5;

export function outcome(form, element) {
  if (form === element) return OUTCOME.SAME;
  if (beats(form, element)) return OUTCOME.WIN;
  if (beats(element, form)) return OUTCOME.LOSE;
  return OUTCOME.BUMP;
}

export const TUNING = {
  startHearts: 3,
  maxHearts: 5,
  hurtInvincibleMs: 1000,
  smashScore: 100,
  passScore: 20,
  mainFormMult: 2, //    본캐 모양으로 부수면 ×2
  gaugePerSmash: 12,
  luckyMs: 5000,
  luckyScore: 150,
  coinValue: 10,
  fakePenalty: 300,
  tigerChance: 0.3,
};

/** 콤보 5마다 배율 +0.5, 최대 ×3 */
export const comboMult = (combo) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5);

export function createRun(profile) {
  const hearts = Math.min(TUNING.maxHearts, TUNING.startHearts + (profile.mods.bonusHearts ?? 0));
  return {
    form: profile.me,
    hearts,
    score: 0,
    coins: 0,
    combo: 0,
    maxCombo: 0,
    smashes: 0,
    distance: 0,
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

function smash(run, profile, now, element, reason) {
  run.combo++;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  run.smashes++;
  const main = run.form === profile.me ? TUNING.mainFormMult : 1;
  const base = reason === 'LUCKY' ? TUNING.luckyScore : TUNING.smashScore * main;
  const score = addScore(run, profile, base * comboMult(run.combo));
  let lucky = false;
  if (!isLucky(run, now)) {
    run.gauge = Math.min(100, run.gauge + TUNING.gaugePerSmash);
    if (run.gauge >= 100) {
      startLucky(run, profile, now);
      lucky = true;
    }
  }
  return { type: 'SMASH', element, score, reason, combo: run.combo, mainForm: main > 1, lucky };
}

/** 모양 바꾸기 (나무→불→흙→쇠→물→나무) */
export function changeForm(run) {
  run.form = nextForm(run.form);
  return run.form;
}

/**
 * 장애물 충돌 판정.
 * @param {{element:number, swooned?:boolean}} obstacle
 */
export function hitObstacle(run, profile, obstacle, now, rng = Math.random) {
  if (run.dead || obstacle.swooned) return { type: 'NONE' };
  if (isLucky(run, now)) return smash(run, profile, now, obstacle.element, 'LUCKY');

  const result = outcome(run.form, obstacle.element);
  if (result === OUTCOME.WIN) return smash(run, profile, now, obstacle.element, 'WIN');
  if (result === OUTCOME.SAME) {
    return { type: 'PASS', element: obstacle.element, score: addScore(run, profile, TUNING.passScore) };
  }
  if (now < run.invUntil) return { type: 'NONE' };
  if (result === OUTCOME.LOSE && rng() < (profile.mods.tigerChance ?? 0)) {
    return smash(run, profile, now, obstacle.element, 'TIGER');
  }

  const damage = result === OUTCOME.LOSE ? 2 : 1;
  run.hearts -= damage;
  run.combo = 0;
  run.invUntil = now + TUNING.hurtInvincibleMs;
  run.lastHit = { element: obstacle.element, form: run.form, result };
  if (run.hearts > 0) return { type: 'HURT', element: obstacle.element, result, damage };

  if (run.revives > 0) {
    run.revives--;
    run.hearts = 2;
    run.invUntil = now + 2000;
    return { type: 'REVIVE', element: obstacle.element, result, damage };
  }
  run.hearts = 0;
  run.dead = true;
  return { type: 'DEAD', element: obstacle.element, result, damage };
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
const ro = (word) => {
  const code = (word.charCodeAt(word.length - 1) - 0xac00) % 28;
  return word + (code === 0 || code === 8 ? '로' : '으로'); // 받침 없음·ㄹ받침 → 로
};

export function deathLine(run, rng = Math.random) {
  const hit = run.lastHit;
  if (!hit) return '원인 불명의 급살';
  const list = DEATH_LINES[hit.result] ?? DEATH_LINES.BUMP;
  const form = FORMS[hit.form];
  const obs = FORMS[hit.element].obstacle;
  return list[Math.floor(rng() * list.length)]
    .replace('{obs}', obs)
    .replace('{form}{으로}', ro(form.name))
    .replace('{form}', form.name)
    .replace('{faint}', form.faint);
}

/** 오늘의 액땜 성공률(%). 100%는 없다. */
export function ackttemRate(run) {
  const rate =
    40 * Math.min(1, run.distance / 1500) +
    30 * Math.min(1, run.smashes / 40) +
    20 * Math.min(1, run.maxCombo / 15) +
    (run.luckyCount > 0 ? 10 : 0);
  return Math.min(99, Math.round(rate));
}

export const ackttemComment = (rate) => ACKTTEM_COMMENTS.find(([min]) => rate >= min)[1];

export { josa };

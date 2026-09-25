// 떨어지는 것들의 패턴 생성기. 시간이 지날수록 빨라지고 촘촘해진다.
//
// 스폰 항목: { at, x, kind, element?, motion?, speed? }
//   at      직전 항목으로부터의 시간(ms)
//   x       0~1 가로 위치 비율, 'PLAYER' 면 스폰 순간 플레이어 위치를 노린다
//   kind    'DROP'(오행 물체) · 'COIN' · 'HEART' · 'LUCKY' · 'FAKE'
//   motion  오행마다 움직임이 다르다 → 보면서 자연스럽게 익힌다
//           물 POP(떨어져 펑) · 흙 HEAVY(빠르게 쿵) · 쇠 ZIGZAG(지그재그)
//           불 ROLL(떨어진 뒤 굴러감) · 나무 SPROUT(땅에서 솟아오름, 예고 표시)

export const MOTION_BY_ELEMENT = ['SPROUT', 'ROLL', 'HEAVY', 'ZIGZAG', 'POP'];

/** 피할 운명의 오행: 천적 3배, 오늘 기운 2배, 내 색깔 제외 */
export function pickFate(rng, { me, nemesis, today }) {
  const pool = [];
  for (let e = 0; e < 5; e++) {
    if (e === me) continue;
    let w = 1;
    if (e === nemesis) w += 2;
    if (e === today) w += 1;
    for (let i = 0; i < w; i++) pool.push(e);
  }
  return pool[Math.floor(rng() * pool.length)];
}

const drop = (ctx, at, x, element) => ({
  at,
  x,
  kind: 'DROP',
  element,
  motion: MOTION_BY_ELEMENT[element],
  speed: ctx.speed * (element === 2 ? 1.5 : 1),
});

const WAVES = {
  // 여기저기 비
  rain: (ctx) => {
    const n = 3 + Math.floor(ctx.rng() * (2 + ctx.level * 4));
    return Array.from({ length: n }, (_, i) =>
      drop(ctx, i === 0 ? 0 : 260 - ctx.level * 120, 0.05 + ctx.rng() * 0.9, pickFate(ctx.rng, ctx)),
    );
  },
  // 한 줄로 쏟아지는데 한 칸만 비어 있다 → 빈칸으로!
  wall: (ctx) => {
    const cols = 7;
    const gap = Math.floor(ctx.rng() * cols);
    const el = pickFate(ctx.rng, ctx);
    const out = [];
    for (let c = 0; c < cols; c++) {
      if (c === gap) continue;
      out.push({ ...drop(ctx, 0, (c + 0.5) / cols, el), motion: 'FALL' });
    }
    return out;
  },
  // 나를 노리는 저격 (예고 후 떨어짐)
  sniper: (ctx) => {
    const n = 1 + Math.floor(ctx.level * 3);
    return Array.from({ length: n }, (_, i) => ({ ...drop(ctx, i === 0 ? 0 : 520, 'PLAYER', ctx.nemesis), motion: 'HEAVY', speed: ctx.speed * 1.6 }));
  },
  // 친구 소나기: 내 색깔 + 코인 (보상 구간)
  friends: (ctx) => {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const x = 0.1 + ctx.rng() * 0.8;
      out.push({ ...drop(ctx, i === 0 ? 0 : 220, x, ctx.me), motion: 'FALL' });
      out.push({ at: 110, x: Math.min(0.95, x + 0.08), kind: 'COIN', speed: ctx.speed });
    }
    return out;
  },
  // 친구 사이에 운명이 섞인 혼합
  mixed: (ctx) =>
    Array.from({ length: 6 }, (_, i) => {
      const friend = ctx.rng() < 0.4;
      return drop(ctx, i === 0 ? 0 : 240 - ctx.level * 80, 0.05 + ctx.rng() * 0.9, friend ? ctx.me : pickFate(ctx.rng, ctx));
    }),
};

function waveWeights(level) {
  return [
    ['rain', 3],
    ['mixed', 3],
    ['friends', 1.5 - level * 0.5],
    ['wall', 0.5 + level * 2],
    ['sniper', level * 2],
  ];
}

function weightedPick(rng, weights) {
  const total = weights.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let r = rng() * total;
  for (const [name, w] of weights) {
    r -= Math.max(0, w);
    if (r < 0) return name;
  }
  return weights[0][0];
}

/**
 * 다음 웨이브.
 * @param {{rng:()=>number, timeMs:number, me:number, nemesis:number, today:number,
 *          lucky:number, fake:number, sinceLuckyMs:number, hearts:number}} ctx
 */
export function nextWave(ctx) {
  const level = Math.min(1, ctx.timeMs / 90000); // 1분 30초에 최고 난이도
  const full = { ...ctx, level, speed: 260 + level * 260 };
  const name = ctx.timeMs < 4000 ? 'friends' : weightedPick(ctx.rng, waveWeights(level));
  const items = WAVES[name](full);

  // 웨이브 사이 숨 돌릴 틈
  items[0] = { ...items[0], at: 900 - level * 450 };

  if (ctx.sinceLuckyMs > 20000) items.push({ at: 300, x: 0.2 + ctx.rng() * 0.6, kind: 'LUCKY', element: ctx.lucky, speed: 200 });
  else if (ctx.rng() < 0.08) items.push({ at: 300, x: 0.2 + ctx.rng() * 0.6, kind: 'FAKE', element: ctx.fake, speed: 200 });
  else if (ctx.hearts < 3 && ctx.rng() < 0.08) items.push({ at: 300, x: 0.2 + ctx.rng() * 0.6, kind: 'HEART', speed: 200 });
  return { name, items };
}

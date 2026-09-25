// 장애물 패턴 생성기. 완전 랜덤 대신 "덩어리(chunk)" 단위로 리듬을 만든다.
// 모든 간격은 px(거리) 기준이라 속도가 빨라지면 자연스럽게 템포가 올라간다.
//
// 스폰 항목: { dx, kind, element? }
//   dx   직전 항목으로부터의 거리(px)
//   kind 'WALL'(못 넘음, 모양으로 부수거나 같은 모양으로 통과) · 'SMALL'(점프로 넘기 가능)
//        'COIN' · 'HEART' · 'LUCKY' · 'FAKE'

/** 오늘 기운이 강한 오행이 2배 자주 나온다 */
export function pickElement(rng, todayElement) {
  const r = Math.floor(rng() * 6);
  return r === 5 ? todayElement : r;
}

// counter 모양이 이기는 장애물 (rules.counterOf 의 역함수)
const elementBeatenBy = (counter) => (counter + 2) % 5;

const CHUNKS = {
  // 벽 하나
  single: (ctx) => [{ dx: 0, kind: 'WALL', element: pickElement(ctx.rng, ctx.today) }],
  // 같은 벽 두 개: 한 번 맞추면 연속 격파
  twin: (ctx) => {
    const el = pickElement(ctx.rng, ctx.today);
    return [{ dx: 0, kind: 'WALL', element: el }, { dx: ctx.wallGap * 0.8, kind: 'WALL', element: el }];
  },
  // 체인: 한 번씩만 탭하면 다음 벽을 이기는 모양이 되도록 배치 → 탭 리듬
  chain: (ctx) => {
    const n = 2 + Math.floor(ctx.rng() * (1 + ctx.level * 2)); // 2~4개
    let counter = Math.floor(ctx.rng() * 5);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ dx: i === 0 ? 0 : ctx.wallGap, kind: 'WALL', element: elementBeatenBy(counter) });
      counter = (counter + 1) % 5;
    }
    return out;
  },
  // 허들: 점프로 넘는 작은 장애물 + 위에 코인
  hurdles: (ctx) => {
    const n = 2 + Math.floor(ctx.rng() * 2);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ dx: i === 0 ? 0 : 300, kind: 'SMALL', element: pickElement(ctx.rng, ctx.today) });
      out.push({ dx: 0, kind: 'COIN', high: true });
    }
    return out;
  },
  // 벽 뒤에 바로 허들
  mixed: (ctx) => [
    { dx: 0, kind: 'WALL', element: pickElement(ctx.rng, ctx.today) },
    { dx: ctx.wallGap, kind: 'SMALL', element: pickElement(ctx.rng, ctx.today) },
  ],
  // 쉬어가기: 코인 줄
  coins: () => Array.from({ length: 6 }, (_, i) => ({ dx: i === 0 ? 0 : 45, kind: 'COIN' })),
};

// 레벨(0~1)별 덩어리 가중치
function chunkWeights(level) {
  return [
    ['single', 3 - level * 2],
    ['twin', 2],
    ['chain', 1 + level * 3],
    ['hurdles', 2],
    ['mixed', level * 2],
    ['coins', 1.5 - level],
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
 * 다음 덩어리를 만든다.
 * @param {{rng:()=>number, distanceM:number, today:number, lucky:number, fake:number,
 *          sinceLuckyM:number, hearts:number}} ctx
 */
export function nextChunk(ctx) {
  const level = Math.min(1, ctx.distanceM / 2500);
  const full = { ...ctx, level, wallGap: 420 - level * 110 };
  const items = CHUNKS[weightedPick(ctx.rng, chunkWeights(level))](full);

  // 덩어리 사이 여백(앞에): 최대 4번 탭할 시간은 확보
  items[0] = { ...items[0], dx: 640 - level * 160 + ctx.rng() * 120 };

  // 럭키템: 약 400m 마다 보장. 짝퉁은 가끔 섞는다.
  if (ctx.sinceLuckyM > 400) items.push({ dx: 160, kind: 'LUCKY', element: ctx.lucky });
  else if (ctx.rng() < 0.06) items.push({ dx: 160, kind: 'FAKE', element: ctx.fake });
  else if (ctx.hearts < 3 && ctx.rng() < 0.05) items.push({ dx: 160, kind: 'HEART' });
  return items;
}

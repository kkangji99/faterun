// 배경 스테이지(국가). 역마살이면 30초마다 랜덤 출장, 아니면 서울 고정.
// 각 draw 는 960×220 캔버스에 좌우가 이어지는 스카이라인을 그린다(tileSprite 반복용).

const W = 960;
const H = 220;

const rect = (ctx, color, x, y, w, h) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};
const poly = (ctx, color, pts) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
  ctx.fill();
};
const circle = (ctx, color, x, y, r) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};
// 결정적 의사난수 (텍스처가 매번 같게)
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function buildings(ctx, color, seed, minH, maxH) {
  const rnd = seeded(seed);
  for (let x = 0; x < W; ) {
    const w = 40 + rnd() * 50;
    const h = minH + rnd() * (maxH - minH);
    rect(ctx, color, x, H - h, w - 6, h);
    x += w;
  }
}

export const STAGES = [
  {
    name: '서울',
    sky: 0x1b1530,
    ground: 0x2a2146,
    draw(ctx) {
      buildings(ctx, '#2c2450', 7, 40, 120);
      rect(ctx, '#3a3060', 700, 60, 10, 160); // 남산타워 기둥
      circle(ctx, '#3a3060', 705, 70, 18);
      rect(ctx, '#3a3060', 703, 20, 4, 40);
    },
  },
  {
    name: '파리',
    sky: 0x2b1d3f,
    ground: 0x3a2a4a,
    draw(ctx) {
      buildings(ctx, '#3b2b52', 11, 30, 70);
      poly(ctx, '#4d3a66', [[380, 220], [440, 10], [500, 220], [470, 220], [440, 110], [410, 220]]); // 에펠탑
      rect(ctx, '#4d3a66', 400, 150, 80, 8);
    },
  },
  {
    name: '카이로',
    sky: 0x3d2414,
    ground: 0x6b4a22,
    draw(ctx) {
      circle(ctx, '#e8a33c', 780, 60, 34);
      poly(ctx, '#8a5f2a', [[100, 220], [260, 50], [420, 220]]);
      poly(ctx, '#7a5324', [[380, 220], [480, 110], [580, 220]]);
    },
  },
  {
    name: '뉴욕',
    sky: 0x121a2e,
    ground: 0x1f2a40,
    draw(ctx) {
      buildings(ctx, '#243453', 23, 80, 200);
      rect(ctx, '#2f4470', 300, 0, 40, 220); // 마천루
      poly(ctx, '#2f4470', [[300, 0], [320, -30], [340, 0]]);
    },
  },
  {
    name: '도쿄',
    sky: 0x261326,
    ground: 0x3a1f35,
    draw(ctx) {
      poly(ctx, '#4a2a48', [[500, 220], [680, 40], [860, 220]]); // 후지산
      poly(ctx, '#e8e0e8', [[640, 80], [680, 40], [720, 80], [700, 90], [680, 75], [660, 90]]);
      rect(ctx, '#c0392b', 150, 90, 12, 130); // 도리이
      rect(ctx, '#c0392b', 240, 90, 12, 130);
      rect(ctx, '#c0392b', 130, 80, 142, 12);
      rect(ctx, '#c0392b', 140, 110, 122, 8);
    },
  },
  {
    name: '하와이',
    sky: 0x0f2d3d,
    ground: 0x1f5566,
    draw(ctx) {
      for (const x of [120, 420, 760]) {
        poly(ctx, '#2f6b4a', [[x, 220], [x + 8, 70], [x + 14, 70], [x + 10, 220]]); // 야자수
        for (const a of [-2.6, -2, -1.2, -0.5]) {
          poly(ctx, '#3fae5a', [[x + 11, 70], [x + 11 + Math.cos(a) * 60, 70 + Math.sin(a) * 25 + 30], [x + 11 + Math.cos(a) * 40, 70 + Math.sin(a) * 15 + 20]]);
        }
      }
      for (let x = 0; x < W; x += 60) circle(ctx, '#2f6fd6', x + 30, 225, 30);
    },
  },
];

export const STAGE_TEX_SIZE = { width: W, height: H };

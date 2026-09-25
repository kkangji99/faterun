// 캔버스로 그리는 플레이스홀더 아트. 게임 텍스처와 결과 카드가 같은 함수를 쓴다.
// 모든 그림은 (0,0) 기준 로컬 좌표로 그리고, 호출 쪽에서 translate/scale 한다.

import { FORMS } from './content.js';

const TAU = Math.PI * 2;

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

function eyes(ctx, x, y, gap, r, { angry = false, look = 2 } = {}) {
  for (const s of [-1, 1]) {
    circle(ctx, x + s * gap, y, r, '#fff');
    circle(ctx, x + s * gap + look, y + 1, r * 0.55, '#221a2e');
    circle(ctx, x + s * gap + look + r * 0.2, y - r * 0.25, r * 0.18, '#fff');
    if (angry) {
      ctx.strokeStyle = '#221a2e';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + s * gap - s * r * 1.1, y - r * 1.5);
      ctx.lineTo(x + s * gap + s * r * 0.6, y - r * 0.9);
      ctx.stroke();
    }
  }
}

// ── 플레이어: 80×88, 발바닥이 (40, 88) ─────────────────────────────
export const PLAYER_SIZE = { w: 80, h: 88 };

export function drawPlayer(ctx, form) {
  const { css } = FORMS[form];
  const dark = shade(css, -45);
  ctx.save();
  ctx.lineJoin = 'round';

  // 발
  for (const x of [26, 54]) {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(x, 84, 11, 5, 0, 0, TAU);
    ctx.fill();
  }

  // 몸통 (모양마다 실루엣이 조금씩 다름)
  ctx.fillStyle = css;
  ctx.beginPath();
  if (form === 4) {
    // 물: 물방울
    ctx.moveTo(40, 10);
    ctx.bezierCurveTo(62, 36, 70, 50, 70, 60);
    ctx.bezierCurveTo(70, 78, 56, 84, 40, 84);
    ctx.bezierCurveTo(24, 84, 10, 78, 10, 60);
    ctx.bezierCurveTo(10, 50, 18, 36, 40, 10);
  } else if (form === 2) {
    // 흙: 네모난 돌
    ctx.roundRect(10, 26, 60, 58, 14);
  } else {
    ctx.ellipse(40, 56, 30, 30, 0, 0, TAU);
  }
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 배
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(40, 66, 17, 13, 0, 0, TAU);
  ctx.fill();

  // 머리 장식
  if (form === 0) {
    // 새싹
    ctx.strokeStyle = '#2b7a3d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, 28);
    ctx.lineTo(40, 14);
    ctx.stroke();
    ctx.fillStyle = '#7fd66b';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(40 + s * 10, 12, 11, 6, s * -0.5, 0, TAU);
      ctx.fill();
    }
  } else if (form === 1) {
    // 불꽃 머리
    const flame = (x, h, c) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - 10, 32);
      ctx.quadraticCurveTo(x - 8, 32 - h * 0.6, x, 32 - h);
      ctx.quadraticCurveTo(x + 8, 32 - h * 0.6, x + 10, 32);
      ctx.fill();
    };
    flame(28, 20, '#ffb02e');
    flame(52, 22, '#ffb02e');
    flame(40, 30, '#ffd84a');
  } else if (form === 2) {
    // 흙: 금 간 자국 + 풀 한 포기
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 40);
    ctx.lineTo(24, 46);
    ctx.lineTo(22, 52);
    ctx.stroke();
    ctx.fillStyle = '#6fbf5a';
    ctx.beginPath();
    ctx.moveTo(56, 27);
    ctx.lineTo(58, 16);
    ctx.lineTo(61, 27);
    ctx.fill();
  } else if (form === 3) {
    // 쇠: 안테나 + 바이저
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 27);
    ctx.lineTo(40, 12);
    ctx.stroke();
    circle(ctx, 40, 10, 5, '#ff5d73');
    ctx.fillStyle = 'rgba(40,60,90,0.35)';
    ctx.beginPath();
    ctx.roundRect(16, 38, 48, 20, 10);
    ctx.fill();
  }

  eyes(ctx, 40, 48, 11, 7, { look: 2 });
  // 볼터치
  for (const s of [-1, 1]) {
    ctx.fillStyle = 'rgba(255,120,140,0.45)';
    ctx.beginPath();
    ctx.ellipse(40 + s * 21, 60, 6, 3.5, 0, 0, TAU);
    ctx.fill();
  }
  // 입
  ctx.strokeStyle = '#221a2e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(40, 59, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

// ── 벽(못 넘는 큰 장애물): 96×170, 바닥이 (48, 170) ───────────────────
export const WALL_SIZE = { w: 96, h: 170 };

export function drawWall(ctx, element) {
  const { w, h } = WALL_SIZE;
  ctx.save();
  if (element === 0) {
    // 가시덩굴
    ctx.fillStyle = '#2f8a45';
    ctx.beginPath();
    ctx.roundRect(22, 8, 52, h - 8, 20);
    ctx.fill();
    ctx.fillStyle = '#1f6532';
    for (let y = 20; y < h - 10; y += 26) {
      for (const s of [-1, 1]) {
        const x = s < 0 ? 22 : 74;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s * 18, y + 8);
        ctx.lineTo(x, y + 16);
        ctx.fill();
      }
    }
    circle(ctx, 60, 30, 8, '#ff6b8a');
  } else if (element === 1) {
    // 불기둥
    const layer = (inset, color, top) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(inset, h);
      for (let i = 0; i <= 4; i++) {
        const x = inset + ((w - inset * 2) * i) / 4;
        ctx.lineTo(x, top + (i % 2 ? 22 : 0));
      }
      ctx.lineTo(w - inset, h);
      ctx.fill();
    };
    layer(6, '#e8453c', 4);
    layer(18, '#ff8a2e', 34);
    layer(30, '#ffd84a', 74);
  } else if (element === 2) {
    // 바위 탑
    const rock = (y, rw, rh, c) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(48, y, rw, rh, 0, 0, TAU);
      ctx.fill();
    };
    rock(140, 46, 30, '#a67c1f');
    rock(92, 40, 28, '#c9a227');
    rock(46, 32, 26, '#dcb84a');
  } else if (element === 3) {
    // 거대 가위
    ctx.strokeStyle = '#6b7a8c';
    ctx.lineWidth = 8;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#c9d3de';
      ctx.beginPath();
      ctx.moveTo(48, 100);
      ctx.lineTo(48 + s * 34, 6);
      ctx.lineTo(48 + s * 12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(48 + s * 20, 138, 17, 0, TAU);
      ctx.stroke();
    }
    circle(ctx, 48, 100, 7, '#6b7a8c');
  } else {
    // 물폭탄 3단
    for (const [y, r] of [[140, 30], [88, 27], [40, 24]]) {
      circle(ctx, 48, y, r, '#3a86e8');
      circle(ctx, 40, y - r * 0.4, r * 0.25, 'rgba(255,255,255,0.6)');
    }
  }
  // 모든 장애물은 심술궂은 눈
  eyes(ctx, 48, h * 0.55, 13, 7, { angry: true, look: -2 });
  ctx.restore();
}

// ── 작은 장애물(점프로 넘기): 60×52, 바닥이 (30, 52) ────────────────────
export const SMALL_SIZE = { w: 60, h: 52 };

export function drawSmall(ctx, element) {
  const { css } = FORMS[element];
  ctx.save();
  ctx.fillStyle = css;
  ctx.beginPath();
  if (element === 1) {
    ctx.moveTo(6, 52);
    ctx.quadraticCurveTo(10, 10, 30, 2);
    ctx.quadraticCurveTo(50, 10, 54, 52);
  } else if (element === 3) {
    ctx.moveTo(4, 52);
    ctx.lineTo(30, 4);
    ctx.lineTo(56, 52);
  } else if (element === 4) {
    ctx.arc(30, 30, 22, 0, TAU);
  } else if (element === 0) {
    for (let i = 0; i < 5; i++) {
      ctx.moveTo(6 + i * 12, 52);
      ctx.lineTo(12 + i * 12, 14 + (i % 2) * 10);
      ctx.lineTo(18 + i * 12, 52);
    }
  } else {
    ctx.ellipse(30, 36, 28, 16, 0, 0, TAU);
  }
  ctx.fill();
  eyes(ctx, 30, 36, 8, 5, { angry: true, look: -1 });
  ctx.restore();
}

// ── 아이템 ───────────────────────────────────────────────────────
export function drawCoin(ctx) {
  circle(ctx, 16, 16, 15, '#f2b92c');
  circle(ctx, 16, 16, 11, '#ffd95e');
  ctx.fillStyle = '#b07d10';
  ctx.font = '900 14px "Jua", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('福', 16, 17);
}

export function drawHeart(ctx, x = 0, y = 0, s = 1, fill = '#ff4d6d') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(16, 28);
  ctx.bezierCurveTo(-6, 14, 2, -2, 16, 8);
  ctx.bezierCurveTo(30, -2, 38, 14, 16, 28);
  ctx.fill();
  ctx.restore();
}

/** 럭키템(네잎클로버) / 짝퉁(세잎, 삐뚤) — 가운데 색이 오행 */
export function drawClover(ctx, element, fake = false) {
  const leaves = fake ? 3 : 4;
  const tilt = fake ? 0.35 : 0;
  ctx.save();
  ctx.translate(26, 26);
  circle(ctx, 0, 0, 25, fake ? 'rgba(200,180,120,0.35)' : 'rgba(255,215,90,0.45)');
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * TAU + tilt;
    circle(ctx, Math.cos(a) * 10, Math.sin(a) * 10, 10, fake ? '#9bb86a' : '#43c463');
  }
  circle(ctx, 0, 0, 7, FORMS[element].css);
  ctx.restore();
}

/** 말풍선 힌트 바탕 */
export function drawBubble(ctx) {
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = '#221a2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4, 4, 56, 48, 16);
  ctx.moveTo(26, 52);
  ctx.lineTo(32, 64);
  ctx.lineTo(38, 52);
  ctx.fill();
  ctx.stroke();
}

// ── 배경 ─────────────────────────────────────────────────────────
export function drawSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7fd3e8');
  g.addColorStop(1, '#ffe3c2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  circle(ctx, w * 0.8, h * 0.22, 46, '#fff4c9');
}

/** 이어지는 산 능선 (타일 반복용) */
export function drawHills(ctx, w, h) {
  const layer = (color, base, amp, freq, phase) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin((x / w) * TAU * freq + phase) * amp);
    ctx.lineTo(w, h);
    ctx.fill();
  };
  layer('#a9d9b8', h * 0.35, 30, 2, 0);
  layer('#7cc49a', h * 0.6, 22, 3, 1.3);
}

/** 단청 느낌 땅 (타일 반복용) */
export function drawGround(ctx, w, h) {
  ctx.fillStyle = '#c0453a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2f8a6b';
  ctx.fillRect(0, 0, w, 10);
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(0, 10, w, 4);
  for (let x = 0; x < w; x += 40) {
    circle(ctx, x + 20, 38, 9, '#3a6fd6');
    circle(ctx, x + 20, 38, 4, '#fff4c9');
  }
}

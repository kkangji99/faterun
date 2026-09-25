// 결과 카드 (1080×1920, 인스타 스토리 비율). 사주 원문은 맨 아래 작은 글씨로만.
//
//  y 0–230     제목 · 날짜 · 오늘 운세
//  y 250–760   본캐 캐릭터 그림 + 이름 + 팔자 한 줄 요약
//  y 790–1010  상성 3칸: 천적 / 귀인 / 럭키템
//  y 1030–1100 팔자 스킬 칩
//  y 1130–1350 사인(死因)
//  y 1380–1600 액땜 성공률 + 한마디
//  y 1630–1720 기록: 거리 · 부순 수 · 최고 콤보
//  y 1760–1880 버튼(화면 전용) / 저장 이미지는 사주 원문 + 주소

import { FORMS } from './content.js';
import { STEMS, BRANCHES } from './saju/constants.js';
import { drawPlayer, drawClover } from './art.js';
import { deathLine, ackttemRate, ackttemComment } from './rules.js';

export const CARD_W = 1080;
export const CARD_H = 1920;

const C = { bg: '#fff4e0', panel: '#ffffff', ink: '#221a2e', sub: '#7a6e8a', red: '#e8453c', green: '#2f8a45', gold: '#f2b92c' };
const FONT = '"Jua", "Noto Sans KR", sans-serif';

function text(ctx, s, x, y, size, color = C.ink, align = 'center') {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function box(ctx, x, y, w, h, r, fill, stroke = C.ink) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

/** 긴 문장은 최대 폭에 맞춰 두 줄로 나눈다 */
function wrap(ctx, s, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  if (ctx.measureText(s).width <= maxW) return [s];
  const words = s.split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  lines.push(line);
  return lines.slice(0, 2);
}

/** 결과 카드에 필요한 값 모으기 (사인은 한 번만 뽑아 화면·저장본이 같게) */
export function buildResult(profile, run) {
  const rate = ackttemRate(run);
  const death = deathLine(run);
  return {
    death,
    rate,
    comment: ackttemComment(rate),
    distance: Math.floor(run.distance),
    smashes: run.smashes,
    maxCombo: run.maxCombo,
    score: run.score,
    share: `[운명 피하기] 나는 ${profile.character.name}! ${Math.floor(run.distance)}m 달리고 사인: ${death} / 오늘 액땜 ${rate}% 🍀`,
  };
}

/**
 * @returns {{id:string,x:number,y:number,w:number,h:number}[]} 버튼 영역
 */
export function drawResultCard(ctx, profile, result, { date, includeButtons = true }) {
  const p = profile;
  ctx.save();
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // 배경 한자 장식 (사주 양념)
  ctx.globalAlpha = 0.06;
  text(ctx, FORMS[p.me].hanja, CARD_W - 160, 420, 520, C.ink);
  ctx.globalAlpha = 1;

  // 제목
  text(ctx, '운명 피하기', CARD_W / 2, 100, 96, C.red);
  const stars = '★'.repeat(p.fortune.stars) + '☆'.repeat(5 - p.fortune.stars);
  text(ctx, `${date} · 오늘은 ${p.fortune.title} ${stars}`, CARD_W / 2, 190, 36, C.sub);

  // 본캐
  ctx.save();
  ctx.translate(CARD_W / 2 - 150, 250);
  ctx.scale(3.4, 3.4);
  drawPlayer(ctx, p.me);
  ctx.restore();
  text(ctx, `나는 ${p.character.name}`, CARD_W / 2, 610, 68);
  text(ctx, p.character.tagline, CARD_W / 2, 675, 36, C.sub);
  wrap(ctx, `“${p.summary}”`, 900, 38).forEach((l, i) => text(ctx, l, CARD_W / 2, 730 + i * 46, 38, C.green));

  // 상성 3칸
  const trio = [
    ['내 천적', p.nemesis, '#ffe1dc'],
    ['내 귀인', p.helper, '#e1f5e4'],
    ['럭키템', p.lucky, '#fff3c4'],
  ];
  trio.forEach(([label, el, fill], i) => {
    const x = 60 + i * 330;
    box(ctx, x, 830, 300, 200, 32, fill);
    text(ctx, label, x + 150, 875, 34, C.sub);
    if (label === '럭키템') {
      ctx.save();
      ctx.translate(x + 150 - 39, 902);
      ctx.scale(1.5, 1.5);
      drawClover(ctx, el);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x + 150 - 32, 905);
      ctx.scale(0.8, 0.8);
      drawPlayer(ctx, el);
      ctx.restore();
    }
    text(ctx, FORMS[el].name, x + 150, 1005, 30, C.ink);
  });

  // 팔자 스킬
  ctx.font = `34px ${FONT}`;
  const chips = p.skills.map((s) => `${s.emoji} ${s.name}`);
  const widths = chips.map((c) => ctx.measureText(c).width + 56);
  let cx = CARD_W / 2 - (widths.reduce((a, b) => a + b, 0) + 20 * (chips.length - 1)) / 2;
  chips.forEach((c, i) => {
    box(ctx, cx, 1045, widths[i], 64, 32, '#efe6ff', '#6b4bd6');
    text(ctx, c, cx + widths[i] / 2, 1078, 34, '#4b2fb0');
    cx += widths[i] + 20;
  });

  // 사인
  box(ctx, 60, 1140, CARD_W - 120, 220, 36, '#221a2e', '#221a2e');
  text(ctx, '사인(死因)', CARD_W / 2, 1185, 34, '#ff9d8f');
  wrap(ctx, result.death, 880, 50).forEach((l, i, arr) => text(ctx, l, CARD_W / 2, 1282 + (i - (arr.length - 1) / 2) * 58, 50, '#fffaf0'));

  // 액땜 성공률
  const gx = CARD_W / 2;
  const gy = 1490;
  ctx.lineCap = 'round';
  ctx.lineWidth = 30;
  ctx.strokeStyle = '#ecdcc0';
  ctx.beginPath();
  ctx.arc(gx, gy, 95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = C.green;
  ctx.beginPath();
  ctx.arc(gx, gy, 95, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * result.rate) / 100);
  ctx.stroke();
  text(ctx, `${result.rate}%`, gx, gy - 10, 66, C.green);
  text(ctx, '오늘의 액땜', gx, gy + 42, 26, C.sub);
  text(ctx, result.comment, CARD_W / 2, 1635, 38);

  // 기록
  [
    ['달린 거리', `${result.distance.toLocaleString()}m`],
    ['부순 장애물', `${result.smashes}개`],
    ['최고 콤보', `${result.maxCombo}`],
  ].forEach(([label, value], i) => {
    const x = 200 + i * 340;
    text(ctx, label, x, 1700, 30, C.sub);
    text(ctx, value, x, 1752, 50);
  });

  const buttons = [];
  if (includeButtons) {
    [
      ['RETRY', '다시 달리기', '#fffaf0', C.ink],
      ['SAVE', '이미지 저장', '#fffaf0', C.ink],
      ['SHARE', '공유하기', C.red, '#fffaf0'],
    ].forEach(([id, label, fill, color], i) => {
      const b = { id, x: 60 + i * 330, y: 1805, w: 300, h: 96 };
      box(ctx, b.x, b.y, b.w, b.h, 48, fill);
      text(ctx, label, b.x + b.w / 2, b.y + b.h / 2, 38, color);
      buttons.push(b);
    });
  } else {
    const raw = ['year', 'month', 'day', 'hour']
      .map((k) => (p.pillars[k] ? STEMS[p.pillars[k].stem] + BRANCHES[p.pillars[k].branch] : ''))
      .filter(Boolean)
      .join(' ');
    text(ctx, `사주 원문 ${raw}`, CARD_W / 2, 1830, 28, C.sub);
    text(ctx, 'kkangji99.github.io/faterun', CARD_W / 2, 1878, 30, C.ink);
  }
  ctx.restore();
  return buttons;
}

export const hitTest = (buttons, x, y) =>
  buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id ?? null;

async function cardBlob(profile, result, date) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  drawResultCard(canvas.getContext('2d'), profile, result, { date, includeButtons: false });
  return new Promise((r) => canvas.toBlob(r, 'image/png'));
}

export function downloadBlob(blob, name = 'faterun.png') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function saveCard(profile, result, date) {
  downloadBlob(await cardBlob(profile, result, date));
}

/** 모바일은 공유 시트(인스타·카톡), 안 되면 이미지 저장 + X 공유 창 */
export async function shareCard(profile, result, date) {
  const blob = await cardBlob(profile, result, date);
  const file = new File([blob], 'faterun.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: result.share });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  downloadBlob(blob);
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(result.share)}`, '_blank', 'noopener');
}

// 바이럴 결과 카드: Canvas 2D 렌더러 (1080×1920, 인스타 스토리 비율).
//
//  y       구역
//  0–220   ① 헤더: 타이틀 · 날짜 · 오늘 일진 등급
//  240–560 ② 캐릭터: 일간 오행 원형 엠블럼 + 캐릭터명 + 일간/신강약
//  580–900 ③ 사주 요약: 4기둥 표(시·일·월·년) + 오행 막대
//  910–1030 ④ 용신/기신 + 발동 특성 칩
//  1050–1330 ⑤ 사인(死因) 박스 + "運命" 도장
//  1350–1600 ⑥ 액땜 성공률 원형 게이지 + 한줄평
//  1620–1720 ⑦ 기록: 거리 · 점수 · 최대콤보
//  1740–1900 ⑧ 버튼(화면 전용): [다시 달리기] [이미지 저장] [공유하기]
//            공유용 이미지(includeButtons:false)에는 버튼 대신 URL 워터마크.

import { ELEMENTS } from '../saju/constants.js';

export const CARD_W = 1080;
export const CARD_H = 1920;

const THEME = {
  bg: '#1b1530',
  panel: '#2a2146',
  ink: '#f6f1e7',
  sub: '#b9aed6',
  gold: '#f2c14e',
  red: '#e8453c',
  font: '"Pretendard", "Noto Sans KR", sans-serif',
  serif: '"Noto Serif KR", serif',
};

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function text(ctx, str, x, y, { size = 40, color = THEME.ink, weight = 700, align = 'center', font = THEME.font } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<import('./result.js').buildResultData>} data
 * @param {{dayMaster:number, date:string, includeButtons?:boolean}} opts
 * @returns {{id:string, x:number, y:number, w:number, h:number}[]} 버튼 히트 영역
 */
export function drawResultCard(ctx, data, { dayMaster, date, includeButtons = true }) {
  const me = ELEMENTS[dayMaster];
  ctx.save();
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ① 헤더
  text(ctx, data.title, CARD_W / 2, 90, { size: 84, font: THEME.serif, weight: 900, color: THEME.gold });
  text(ctx, `${data.subtitle} · ${date}`, CARD_W / 2, 160, { size: 34, color: THEME.sub, weight: 500 });
  text(ctx, data.todayLine, CARD_W / 2, 210, { size: 32, color: THEME.ink, weight: 500 });

  // ② 캐릭터 엠블럼
  ctx.beginPath();
  ctx.arc(CARD_W / 2, 380, 120, 0, Math.PI * 2);
  ctx.fillStyle = hex(me.color);
  ctx.fill();
  text(ctx, me.hanja, CARD_W / 2, 385, { size: 140, font: THEME.serif, weight: 900, color: THEME.bg });
  text(ctx, data.characterName, CARD_W / 2, 540, { size: 48 });
  text(ctx, data.dayMaster, CARD_W / 2, 590, { size: 32, color: THEME.sub, weight: 500 });

  // ③ 사주 4기둥
  roundRect(ctx, 60, 630, CARD_W - 120, 270, 28, THEME.panel);
  data.pillars.forEach((p, i) => {
    const x = 180 + i * 240;
    text(ctx, p.label, x, 658, { size: 28, color: THEME.sub, weight: 500 });
    text(ctx, p.hanja, x, 728, { size: 72, font: THEME.serif, weight: 900 });
    text(ctx, p.ko, x, 790, { size: 28, color: THEME.sub, weight: 500 });
  });
  // 오행 막대 (최대 4칸 기준)
  data.elementCounts.forEach((c, i) => {
    const x = 90 + i * 187.5;
    roundRect(ctx, x, 855, 150, 26, 13, '#3a3060');
    if (c > 0) roundRect(ctx, x, 855, Math.min(150, (150 * c) / 4), 26, 13, hex(ELEMENTS[i].color));
    text(ctx, `${ELEMENTS[i].hanja} ${c}`, x + 75, 832, { size: 24, color: THEME.sub, weight: 500 });
  });

  // ④ 용신 + 특성 칩
  text(ctx, data.yongsin, CARD_W / 2, 945, { size: 34, color: THEME.gold });
  const chips = data.traits.slice(0, 3).map((t) => t.split(' — ')[0]);
  ctx.font = `600 28px ${THEME.font}`;
  const widths = chips.map((c) => ctx.measureText(c).width + 48);
  let cx = CARD_W / 2 - (widths.reduce((a, b) => a + b, 0) + 16 * (chips.length - 1)) / 2;
  chips.forEach((c, i) => {
    roundRect(ctx, cx, 975, widths[i], 50, 25, '#3a3060');
    text(ctx, c, cx + widths[i] / 2, 1001, { size: 28, weight: 600 });
    cx += widths[i] + 16;
  });

  // ⑤ 사인 박스
  roundRect(ctx, 60, 1060, CARD_W - 120, 260, 28, '#3b1720');
  text(ctx, '사인(死因) · DEATH CAUSE', CARD_W / 2, 1115, { size: 32, color: THEME.red });
  text(ctx, `“${data.deathCause}”`, CARD_W / 2, 1210, { size: 54, font: THEME.serif, weight: 900 });
  ctx.save();
  ctx.translate(CARD_W - 170, 1270);
  ctx.rotate(-0.25);
  ctx.strokeStyle = THEME.red;
  ctx.lineWidth = 6;
  ctx.strokeRect(-70, -40, 140, 80);
  text(ctx, '運命', 0, 2, { size: 48, font: THEME.serif, weight: 900, color: THEME.red });
  ctx.restore();

  // ⑥ 액땜 게이지
  const gx = CARD_W / 2;
  const gy = 1470;
  ctx.lineWidth = 28;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a3060';
  ctx.beginPath();
  ctx.arc(gx, gy, 100, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = THEME.gold;
  ctx.beginPath();
  ctx.arc(gx, gy, 100, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * data.ackttemRate) / 100);
  ctx.stroke();
  text(ctx, `${data.ackttemRate}%`, gx, gy - 8, { size: 64, weight: 900, color: THEME.gold });
  text(ctx, '액땜 성공률', gx, gy + 45, { size: 24, color: THEME.sub, weight: 500 });
  text(ctx, data.ackttemComment, CARD_W / 2, 1610, { size: 32, weight: 500 });

  // ⑦ 기록
  [
    ['생존 거리', `${data.distance.toLocaleString()}m`],
    ['점수', data.score.toLocaleString()],
    ['최대 콤보', `${data.maxCombo}`],
  ].forEach(([label, value], i) => {
    const x = 200 + i * 340;
    text(ctx, label, x, 1665, { size: 26, color: THEME.sub, weight: 500 });
    text(ctx, value, x, 1715, { size: 44, weight: 800 });
  });

  // ⑧ 버튼 / 워터마크
  const buttons = [];
  if (includeButtons) {
    [
      ['RETRY', '다시 달리기', '#4a3d7a'],
      ['SAVE', '이미지 저장', '#4a3d7a'],
      ['SHARE', '공유하기', THEME.gold],
    ].forEach(([id, label, color], i) => {
      const b = { id, x: 60 + i * 330, y: 1780, w: 300, h: 100 };
      roundRect(ctx, b.x, b.y, b.w, b.h, 50, color);
      text(ctx, label, b.x + b.w / 2, b.y + b.h / 2, { size: 34, color: id === 'SHARE' ? THEME.bg : THEME.ink });
      buttons.push(b);
    });
  } else {
    text(ctx, '너의 팔자로 달려봐 → faterun.app', CARD_W / 2, 1830, { size: 34, color: THEME.sub, weight: 500 });
  }
  ctx.restore();
  return buttons;
}

export const hitTest = (buttons, x, y) =>
  buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id ?? null;

/** 공유: Web Share API(파일) → 실패 시 X(트위터) 인텐트 + 이미지 다운로드 */
export async function shareResult(data, dayMaster, date) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  drawResultCard(canvas.getContext('2d'), data, { dayMaster, date, includeButtons: false });
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'faterun-result.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: data.shareText });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob);
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(data.shareText)}`, '_blank', 'noopener');
  return 'fallback';
}

export function downloadBlob(blob, name = 'faterun-result.png') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

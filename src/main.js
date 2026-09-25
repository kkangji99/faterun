// 화면 흐름: 생일 입력 → 캐릭터 공개(상성·스킬·운세·하는 법) → 달리기 → 결과 카드.

import { FORMS } from './content.js';
import { createProfile } from './profile.js';
import { beats } from './rules.js';
import { drawPlayer, drawClover } from './art.js';
import { unlockAudio, setMuted, isMuted } from './sfx.js';
import { RunScene, GAME_SIZE } from './RunScene.js';
import { buildResult, drawResultCard, hitTest, saveCard, shareCard } from './resultCard.js';

const $ = (sel) => document.querySelector(sel);
const now = new Date();
const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
const pad = (n) => String(n).padStart(2, '0');
const dateLabel = `${today.year}.${pad(today.month)}.${pad(today.day)}`;

let profile = null;
let game = null;

function paint(canvas, draw) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  draw(ctx);
}

// 첫 화면: 다섯 캐릭터 줄 세우기
for (let f = 0; f < 5; f++) {
  const c = document.createElement('canvas');
  c.width = 80;
  c.height = 88;
  c.setAttribute('aria-label', FORMS[f].name);
  paint(c, (ctx) => drawPlayer(ctx, f));
  $('#lineup').append(c);
}

$('#no-time').addEventListener('change', (e) => {
  $('#birth-time').disabled = e.target.checked;
});

$('#birth-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const [year, month, day] = $('#birth-date').value.split('-').map(Number);
  const time = $('#no-time').checked ? '' : $('#birth-time').value;
  const [hour, minute] = time ? time.split(':').map(Number) : [null, 0];
  profile = createProfile({ year, month, day, hour, minute }, today);
  showReveal(profile);
});

function showReveal(p) {
  paint($('#hero-canvas'), (ctx) => drawPlayer(ctx, p.me));
  $('#char-name').textContent = `나는 ${p.character.name}`;
  $('#char-tagline').textContent = p.character.tagline;
  $('#char-summary').textContent = `“${p.summary}”`;

  paint($('#foe-canvas'), (ctx) => drawPlayer(ctx, p.nemesis));
  $('#foe-name').textContent = FORMS[p.nemesis].name;
  paint($('#friend-canvas'), (ctx) => drawPlayer(ctx, p.helper));
  $('#friend-name').textContent = FORMS[p.helper].name;
  paint($('#luck-canvas'), (ctx) => drawClover(ctx, p.lucky));
  $('#luck-name').textContent = FORMS[p.lucky].name;

  $('#skills').innerHTML = p.skills
    .map((s) => `<div><span class="chip">${s.emoji} ${s.name}</span> ${s.desc} <span class="sub-term">(${s.source})</span></div>`)
    .join('');

  const stars = '★'.repeat(p.fortune.stars) + '☆'.repeat(5 - p.fortune.stars);
  $('#fortune-title').textContent = `오늘은 ${p.fortune.title} ${stars}`;
  $('#fortune-headline').textContent = p.fortune.headline;
  $('#fortune-desc').textContent = `오늘의 효과: ${p.fortune.desc}`;

  // 가위바위보 표: 각 모양이 이기는 상대
  $('#rps').innerHTML = FORMS.map((f, i) => {
    const target = [0, 1, 2, 3, 4].find((t) => beats(i, t));
    return `<span>${f.emoji}${f.name} > ${FORMS[target].emoji}${FORMS[target].name}</span>`;
  }).join('');

  $('#intro').hidden = true;
  $('#reveal').hidden = false;
  window.scrollTo(0, 0);
}

$('#start').addEventListener('click', async () => {
  unlockAudio();
  await document.fonts?.load('24px "Jua"').catch(() => {});
  startRun();
});

$('#mute').addEventListener('click', () => {
  setMuted(!isMuted());
  $('#mute').textContent = isMuted() ? '🔇 음소거' : '🔊 소리';
});

function startRun() {
  $('#reveal').hidden = true;
  $('#result').hidden = true;
  $('#game').hidden = false;
  $('#mute').hidden = false;
  const data = { profile, onGameOver: showResult };
  if (game) {
    game.scene.start('RunScene', data);
    return;
  }
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    ...GAME_SIZE,
    backgroundColor: '#fff4e0',
    physics: { default: 'arcade' },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    scene: [],
  });
  game.scene.add('RunScene', RunScene, true, data);
  window.faterunGame = game; // 자동 플레이 테스트용 핸들
}

function showResult(run) {
  const result = buildResult(profile, run);
  const canvas = $('#result canvas');
  const buttons = drawResultCard(canvas.getContext('2d'), profile, result, { date: dateLabel });
  $('#result').hidden = false;
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const id = hitTest(buttons, x, y);
    if (id === 'RETRY') startRun();
    if (id === 'SAVE') saveCard(profile, result, dateLabel);
    if (id === 'SHARE') shareCard(profile, result, dateLabel);
  };
}

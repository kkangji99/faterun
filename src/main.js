// 엔트리: 입력 폼 → 사주 분석/오늘 운세 표시 → Phaser 러닝 → Canvas 결과 카드.

import { ELEMENTS, pillarLabel } from './saju/constants.js';
import { createCharacter } from './game/buildPlayer.js';
import { buildResultData } from './game/result.js';
import { drawResultCard, hitTest, shareResult, downloadBlob } from './game/resultCard.js';
import { RunScene, RUN_SCENE_SIZE } from './game/scenes/RunScene.js';

const $ = (sel) => document.querySelector(sel);
const now = new Date();
const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
const todayStr = `${today.year}.${String(today.month).padStart(2, '0')}.${String(today.day).padStart(2, '0')}`;

let char = null;
let game = null;

$('#birth-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const [year, month, day] = form.get('date').split('-').map(Number);
  const time = form.get('time');
  const [hour, minute] = time ? time.split(':').map(Number) : [null, 0];
  char = createCharacter({ year, month, day, hour, minute }, today);
  showFortune(char);
});

function showFortune(c) {
  const { profile, fortune, character } = c;
  const p = profile.pillars;
  $('#char-name').textContent = character.name;
  $('#char-desc').textContent =
    `${ELEMENTS[profile.dayMaster].hanja} 일간 · ${['hour', 'day', 'month', 'year'].map((k) => pillarLabel(p[k])).join(' ')} · ${character.passive.name}: ${character.passive.desc}`;
  $('#trait-list').innerHTML = c.traits.map((t) => `<li><b>${t.name}</b> — ${t.desc}</li>`).join('');
  $('#today-title').textContent = `${fortune.grade.emoji} 오늘(${pillarLabel(fortune.todayPillar)}일)의 운세: ${fortune.grade.label}`;
  $('#today-list').innerHTML = fortune.effects.map((e) => `<li><b>${e.title}</b> — ${e.desc}</li>`).join('');
  $('#birth-form').hidden = true;
  $('#fortune').hidden = false;
}

$('#start').addEventListener('click', startRun);

function startRun() {
  $('#fortune').hidden = true;
  $('#game').hidden = false;
  $('#result').style.display = 'none';
  const data = { char, onGameOver: showResult };
  if (game) return game.scene.start('RunScene', data);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    ...RUN_SCENE_SIZE,
    backgroundColor: '#1b1530',
    physics: { default: 'arcade' },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
  });
  game.scene.add('RunScene', RunScene, true, data);
}

function showResult(run) {
  const data = buildResultData(char, run);
  const canvas = $('#result canvas');
  const buttons = drawResultCard(canvas.getContext('2d'), data, { dayMaster: char.profile.dayMaster, date: todayStr });
  $('#result').style.display = 'grid';
  canvas.onclick = async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    switch (hitTest(buttons, x, y)) {
      case 'RETRY': return startRun();
      case 'SAVE': {
        const off = document.createElement('canvas');
        off.width = canvas.width;
        off.height = canvas.height;
        drawResultCard(off.getContext('2d'), data, { dayMaster: char.profile.dayMaster, date: todayStr, includeButtons: false });
        return off.toBlob((b) => downloadBlob(b));
      }
      case 'SHARE': return shareResult(data, char.profile.dayMaster, todayStr);
    }
  };
}

// 효과음: 파일 없이 WebAudio 로 짧게 합성한다. 브라우저 정책상 첫 클릭 이후에만 소리가 난다.

let ac = null;
let muted = false;

export function unlockAudio() {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
}

export const setMuted = (m) => (muted = m);
export const isMuted = () => muted;

function tone(freq, { dur = 0.12, type = 'square', vol = 0.08, slide = 0, delay = 0 } = {}) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  // 콤보가 오를수록 음이 올라간다
  smash: (combo = 1) => {
    const f = 330 * 2 ** (Math.min(combo, 24) / 12);
    tone(f, { dur: 0.09, type: 'square' });
    tone(f * 1.5, { dur: 0.12, type: 'triangle', delay: 0.04 });
  },
  pass: () => tone(520, { dur: 0.15, type: 'sine', vol: 0.05, slide: 200 }),
  hurt: () => tone(220, { dur: 0.3, type: 'sawtooth', vol: 0.09, slide: -150 }),
  transform: () => tone(600, { dur: 0.08, type: 'triangle', vol: 0.06, slide: 400 }),
  jump: () => tone(300, { dur: 0.12, type: 'sine', vol: 0.06, slide: 300 }),
  coin: () => tone(1200, { dur: 0.06, type: 'square', vol: 0.03 }),
  lucky: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.14, type: 'square', vol: 0.06, delay: i * 0.07 })),
  fake: () => [400, 300].forEach((f, i) => tone(f, { dur: 0.18, type: 'sawtooth', vol: 0.06, delay: i * 0.12 })),
  dead: () => [392, 330, 262].forEach((f, i) => tone(f, { dur: 0.25, type: 'triangle', vol: 0.08, delay: i * 0.18 })),
};

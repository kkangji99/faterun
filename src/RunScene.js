// 운명 피하기 — 메인 씬. 손가락으로 좌우로 움직여 하늘에서 떨어지는 운명을 피한다.
// 규칙·점수는 rules.js, 떨어지는 패턴은 patterns.js 가 정하고, 이 씬은 움직임·충돌·연출만 한다.
// 충돌은 원(circle) 거리로 직접 계산한다(물리 엔진 없음).
// Phaser 는 index.html 에서 전역(window.Phaser)으로 로드한다.

import { FORMS } from './content.js';
import { createRun, touchDrop, nearMiss, pickItem, survive, isLucky, comboMult } from './rules.js';
import { nextWave } from './patterns.js';
import { drawPlayer, drawDrop, drawSprout, drawCoin, drawHeart, drawClover, drawSky, drawHills, drawGround, PLAYER_SIZE, DROP_SIZE } from './art.js';
import { sfx, setMuted, isMuted } from './sfx.js';

const FONT = '"Jua", "Noto Sans KR", sans-serif';
const PLAYER_R = 24; //       플레이어 판정 반지름
const DROP_R = 22; //         떨어지는 물체 판정 반지름 (그림보다 살짝 작게: 억울하지 않게)
const NEAR_MARGIN = 30; //    이 안쪽으로 스치면 아슬아슬
const MOVE_SPEED = 950; //    px/s

// 화면 배치: 가로 960×540, 세로는 폭 600 + 폰 비율 높이
let W = 960;
let H = 540;
let GROUND_Y = 470;
let PORTRAIT = false;

function applyLayout(width, height) {
  W = width;
  H = height;
  PORTRAIT = height > width;
  GROUND_Y = PORTRAIT ? H - 190 : H - 70;
}

/** 뷰포트 크기 → 게임 해상도 */
export function gameSizeFor(vw, vh) {
  if (vh <= vw) return { width: 960, height: 540 };
  return { width: 600, height: Math.max(900, Math.min(1400, Math.round((600 * vh) / vw))) };
}

export class RunScene extends Phaser.Scene {
  constructor() {
    super('RunScene');
  }

  /** @param {{profile: ReturnType<import('./profile.js').createProfile>, onGameOver: Function}} data */
  init(data) {
    applyLayout(this.scale.width, this.scale.height);
    this.profile = data.profile;
    this.onGameOver = data.onGameOver;
    this.run = createRun(this.profile);
    this.now = 0;
    this.queue = [];
    this.nextAt = 600;
    this.lastLuckyAt = 0;
    this.drops = [];
    this.targetX = null;
    this.keys = { left: false, right: false };
    this.freezeMs = 0;
    this.ending = false;
    this.nemesisIntroduced = false;
  }

  create() {
    this.makeTextures();
    this.add.image(W / 2, H / 2, `sky-${W}x${H}`);
    this.hills = this.add.tileSprite(W / 2, GROUND_Y - 80, W, 160, `hills-${W}`);
    this.add.tileSprite(W / 2, GROUND_Y + (H - GROUND_Y) / 2, W, H - GROUND_Y, `ground-${W}x${H - GROUND_Y}`);

    this.player = this.add.image(W / 2, GROUND_Y, `player-${this.profile.me}`).setOrigin(0.5, 1).setDepth(10);
    this.shards = this.add.particles(0, 0, 'dot', {
      speed: { min: 120, max: 380 }, angle: { min: 200, max: 340 }, gravityY: 1000,
      lifespan: 650, scale: { start: 1.3, end: 0 }, emitting: false,
    }).setDepth(20);

    this.createHud();
    this.bindInput();
    this.say('손가락으로 좌우로 움직여요', '#221a2e', 2200);
    this.time.delayedCall(2400, () => this.say(`${FORMS[this.profile.me].emoji} 내 색깔은 친구! 먹으면 점수`, '#2f8a45', 2200));
  }

  // ── 입력: 드래그(손가락 위치로 이동) + 키보드 ←→ / A D ───────────────
  bindInput() {
    const follow = (p) => {
      if (!p.isDown || this.hitMute(p)) return;
      this.targetX = p.x;
    };
    this.input.on('pointerdown', follow);
    this.input.on('pointermove', follow);
    this.input.on('pointerup', () => (this.targetX = null));
    const kb = this.input.keyboard;
    for (const [key, dir] of [['LEFT', 'left'], ['A', 'left'], ['RIGHT', 'right'], ['D', 'right']]) {
      kb.on(`keydown-${key}`, () => {
        this.keys[dir] = true;
        this.targetX = null;
      });
      kb.on(`keyup-${key}`, () => (this.keys[dir] = false));
    }
  }

  hitMute(p) {
    return this.muteBtn.getBounds().contains(p.x, p.y);
  }

  movePlayer(dt) {
    const speed = MOVE_SPEED * (this.profile.mods.speedMult ?? 1);
    let vx = 0;
    if (this.targetX !== null) {
      const d = this.targetX - this.player.x;
      vx = Math.sign(d) * Math.min(Math.abs(d) / (dt / 1000), speed);
    } else if (this.keys.left !== this.keys.right) {
      vx = this.keys.left ? -speed : speed;
    }
    this.player.x = Phaser.Math.Clamp(this.player.x + (vx * dt) / 1000, 30, W - 30);
    // 달리는 느낌: 기울기 + 통통 튀기
    this.player.angle = Phaser.Math.Linear(this.player.angle, vx * 0.012, 0.3);
    this.player.y = GROUND_Y - Math.abs(Math.sin(this.now / 90)) * (Math.abs(vx) > 50 ? 6 : 2);
  }

  // ── 스폰 ────────────────────────────────────────────────────────
  spawnDue() {
    while (this.now >= this.nextAt) {
      if (!this.queue.length) {
        const { items } = nextWave({
          rng: Math.random,
          timeMs: this.now,
          me: this.profile.me,
          nemesis: this.profile.nemesis,
          today: this.profile.fortune.todayElement,
          lucky: this.profile.lucky,
          fake: this.profile.fake,
          sinceLuckyMs: this.now - this.lastLuckyAt,
          hearts: this.run.hearts,
        });
        if (items.some((it) => it.kind === 'LUCKY')) this.lastLuckyAt = this.now;
        this.queue.push(...items);
        this.nextAt += this.queue[0].at;
        continue;
      }
      const spec = this.queue.shift();
      this.spawn(spec);
      this.nextAt += this.queue.length ? this.queue[0].at : 0;
    }
  }

  spawn(spec) {
    const x = spec.x === 'PLAYER' ? this.player.x : 30 + spec.x * (W - 60);
    const friendly = spec.kind === 'DROP' && spec.element === this.profile.me;
    const motion = spec.kind !== 'DROP' ? 'FALL' : friendly ? 'FALL' : spec.motion;
    const d = { ...spec, x, y: -40, x0: x, vy: spec.speed, vx: 0, t: 0, friendly, motion, state: 'FALL', near: false, done: false };

    const key = spec.kind === 'DROP' ? `drop-${spec.element}-${friendly ? 'f' : 'e'}`
      : { COIN: 'coin', HEART: 'heart', LUCKY: `lucky-${spec.element}`, FAKE: `fake-${spec.element}` }[spec.kind];

    if (motion === 'SPROUT') {
      // 땅에서 솟기 전 예고 표시
      d.state = 'WARN';
      d.y = GROUND_Y;
      d.sprite = this.add.image(x, GROUND_Y, 'sprout-e').setOrigin(0.5, 1).setScale(1, 0).setDepth(6);
      d.warn = this.add.text(x, GROUND_Y - 24, '!', { fontFamily: FONT, fontSize: '40px', color: '#e8453c' }).setOrigin(0.5).setDepth(7).setStroke('#fffaf0', 6);
      this.tweens.add({ targets: d.warn, alpha: 0.2, duration: 120, yoyo: true, repeat: 3 });
    } else if (spec.x === 'PLAYER') {
      // 저격: 위에서 조준 표시 후 떨어짐
      d.state = 'AIM';
      d.sprite = this.add.image(x, -40, key).setDepth(8);
      d.warn = this.add.text(x, 70, '▼', { fontFamily: FONT, fontSize: '40px', color: '#e8453c' }).setOrigin(0.5).setDepth(7);
      this.tweens.add({ targets: d.warn, alpha: 0.2, duration: 110, yoyo: true, repeat: 2 });
    } else {
      d.sprite = this.add.image(x, -40, key).setDepth(8);
    }
    d.swoon = !friendly && spec.kind === 'DROP' && Math.random() < (this.profile.mods.swoonChance ?? 0);

    if (!friendly && spec.kind === 'DROP' && spec.element === this.profile.nemesis && !this.nemesisIntroduced) {
      this.nemesisIntroduced = true;
      this.time.delayedCall(300, () => this.say(`천적 ${FORMS[spec.element].obstacle} 등장! 조심`, '#e8453c', 1600));
    }
    this.drops.push(d);
  }

  // ── 떨어지는 것들 움직이기 ──────────────────────────────────────────
  updateDrops(dt) {
    const s = dt / 1000;
    const px = this.player.x;
    const py = GROUND_Y - 38;
    const magnet = this.profile.mods.magnet;

    for (const d of this.drops) {
      if (d.done) continue;
      d.t += dt;
      switch (d.state) {
        case 'WARN': // 가시덩굴 예고 → 솟기
          if (d.t > 700) {
            d.state = 'RISE';
            d.warn.destroy();
            d.t = 0;
            this.tweens.add({ targets: d.sprite, scaleY: 1, duration: 120, ease: 'Back.Out' });
          }
          break;
        case 'RISE':
          if (d.t > 650) this.finishDrop(d, 'sink');
          break;
        case 'AIM':
          if (d.t > 420) {
            d.state = 'FALL';
            d.warn.destroy();
          }
          break;
        case 'FALL':
          if (d.motion === 'HEAVY') d.vy += 1100 * s;
          d.y += d.vy * s;
          if (d.motion === 'ZIGZAG') d.x = d.x0 + Math.sin(d.t / 180) * 70;
          if (d.swoon && Math.abs(d.x - px) < 170 && d.y > py - 260) {
            d.swoon = false;
            d.harmless = true;
            d.vx = Math.sign(d.x - px || 1) * 500;
            d.sprite.setAlpha(0.6);
            this.floatText(d.x, d.y - 30, '♥ 반했어요', '#ff5d8f');
          }
          d.x += d.vx * s;
          if ((magnet && (d.friendly || d.kind === 'COIN')) && Math.abs(d.x - px) < 160 && d.y > py - 220) {
            d.x += (px - d.x) * Math.min(1, s * 8);
          }
          if (d.y >= GROUND_Y - DROP_R) this.onLand(d, px);
          break;
        case 'ROLL':
          d.x += d.vx * s;
          d.sprite.angle += d.vx * s * 3;
          d.rolled += Math.abs(d.vx * s);
          if (d.rolled > 220 || d.x < -40 || d.x > W + 40) this.finishDrop(d, 'fade');
          break;
      }
      if (d.done) continue;
      d.sprite.setPosition(d.x, d.state === 'RISE' || d.state === 'WARN' ? GROUND_Y : d.y);
      if (d.motion === 'ZIGZAG' && d.state === 'FALL') d.sprite.angle = Math.sin(d.t / 180) * 25;
      this.checkTouch(d, px, py);
    }
    this.drops = this.drops.filter((d) => !d.done);
  }

  onLand(d, px) {
    d.y = GROUND_Y - DROP_R;
    if (d.kind !== 'DROP' || d.friendly || d.harmless) return this.finishDrop(d, 'fade');
    if (d.motion === 'ROLL') {
      // 불똥: 플레이어 쪽으로 조금 굴러온다
      d.state = 'ROLL';
      d.rolled = 0;
      d.vx = (px >= d.x ? 1 : -1) * 320;
      return;
    }
    if (d.motion === 'POP') {
      // 물폭탄: 바닥에서 펑 (주변까지 튄다)
      const dist = Math.abs(this.player.x - d.x);
      this.burst(d.x, GROUND_Y - 10, d.element, 14);
      const splash = this.add.circle(d.x, GROUND_Y - 10, 20, FORMS[d.element].color, 0.5).setDepth(9);
      this.tweens.add({ targets: splash, radius: 64, alpha: 0, duration: 260, onComplete: () => splash.destroy() });
      if (!d.touched && dist < 62) this.hitBy(d);
      else if (!d.touched && dist < 62 + NEAR_MARGIN) this.onNearMiss(d);
      return this.finishDrop(d, 'none');
    }
    // 바위·가위 등: 쿵 하고 사라짐
    if (d.motion === 'HEAVY') this.cameras.main.shake(60, 0.004);
    this.finishDrop(d, 'fade');
  }

  checkTouch(d, px, py) {
    if (d.touched || d.harmless) return;
    let dx;
    let dy;
    if (d.state === 'RISE') {
      // 솟은 가시: 세로 막대 판정
      dx = Math.abs(d.x - px);
      dy = 0;
      if (dx < PLAYER_R + 16) return this.hitBy(d);
      if (!d.near && dx < PLAYER_R + 16 + NEAR_MARGIN) this.onNearMiss(d);
      return;
    }
    if (d.state === 'WARN' || d.state === 'AIM') return;
    dx = d.x - px;
    dy = d.y - py;
    const r = d.kind === 'DROP' ? DROP_R : 20;
    const dist = Math.hypot(dx, dy);
    if (dist < r + PLAYER_R) {
      if (d.kind === 'DROP') return this.hitBy(d);
      return this.collect(d);
    }
    // 머리 위를 지나 아래로 내려갔는데 아슬아슬하게 비껴갔다
    if (d.kind === 'DROP' && !d.friendly && !d.near && d.state === 'FALL' && dy > 0 && Math.abs(dx) < r + PLAYER_R + NEAR_MARGIN) {
      this.onNearMiss(d);
    }
  }

  hitBy(d) {
    d.touched = true;
    const ev = touchDrop(this.run, this.profile, d, this.now);
    switch (ev.type) {
      case 'FRIEND':
        this.burst(d.x, d.y, d.element, 10);
        this.finishDrop(d, 'none');
        sfx.smash(ev.combo);
        this.floatText(d.x, d.y - 30, `+${ev.score}`, '#2f8a45');
        this.bumpCombo();
        if (ev.lucky) this.onLuckyStart();
        break;
      case 'LUCKY_COIN':
        this.burst(d.x, d.y, d.element, 10);
        this.finishDrop(d, 'none');
        sfx.coin();
        this.floatText(d.x, d.y - 30, `+${ev.score}`, '#c98a00');
        break;
      case 'DEFLECT':
        d.harmless = true;
        d.vx = Math.sign(d.x - this.player.x || 1) * 700;
        d.vy = -400;
        this.floatText(this.player.x, GROUND_Y - 110, '🐯 튕겨냄!', '#e8453c');
        sfx.smash(1);
        break;
      case 'NONE':
        d.touched = false; // 무적 중: 나중에 다시 닿을 수 있게
        break;
      default: {
        // HURT · REVIVE · DEAD
        this.burst(d.x, d.y, d.element, 16);
        this.finishDrop(d, 'none');
        sfx.hurt();
        this.freezeMs = 70;
        this.cameras.main.shake(220, 0.018);
        this.cameras.main.flash(150, 255, 90, 90);
        const nemesis = d.element === this.profile.nemesis;
        this.say(nemesis ? `천적 ${FORMS[d.element].obstacle}! 하트 -1` : `아야! ${FORMS[d.element].obstacle} 조심`, '#e8453c');
        if (ev.type === 'REVIVE') this.time.delayedCall(700, () => this.say('🧘 해탈 도사 부활!', '#6b4bd6'));
        if (ev.type === 'DEAD') this.finish();
      }
    }
  }

  collect(d) {
    d.touched = true;
    const ev = pickItem(this.run, this.profile, d, this.now);
    this.finishDrop(d, 'none');
    switch (ev.type) {
      case 'COIN': sfx.coin(); break;
      case 'HEART': sfx.pass(); this.floatText(d.x, d.y - 30, '하트 +1', '#ff4d6d'); break;
      case 'LUCKY': this.onLuckyStart(); break;
      case 'FAKE': sfx.fake(); this.say('짝퉁 럭키템이었다… 게이지 0', '#8a6d1f'); break;
    }
  }

  onNearMiss(d) {
    d.near = true;
    if (this.run.dead) return;
    const ev = nearMiss(this.run, this.profile, this.now);
    sfx.pass();
    this.floatText(this.player.x, GROUND_Y - 120, `아슬아슬! +${ev.score}`, '#6b4bd6');
    this.bumpCombo();
    if (ev.lucky) this.onLuckyStart();
  }

  finishDrop(d, how) {
    d.done = true;
    d.warn?.destroy();
    const s = d.sprite;
    if (how === 'none') return s.destroy();
    if (how === 'sink') return this.tweens.add({ targets: s, scaleY: 0, duration: 150, onComplete: () => s.destroy() });
    this.tweens.add({ targets: s, alpha: 0, duration: 200, onComplete: () => s.destroy() });
  }

  burst(x, y, element, n) {
    this.shards.setParticleTint?.(FORMS[element].color);
    this.shards.explode(n, x, y);
  }

  onLuckyStart() {
    sfx.lucky();
    this.say('🍀 럭키타임! 다 먹어버려!', '#2f8a45', 1400);
    this.cameras.main.flash(200, 255, 230, 120);
  }

  // ── 메인 루프 ─────────────────────────────────────────────────────
  update(_, dt) {
    if (this.ending) return;
    dt = Math.min(dt, 50); // 탭 전환 등으로 한 프레임이 길어져도 순간이동하지 않게
    if (this.freezeMs > 0) {
      this.freezeMs -= dt;
      return;
    }
    this.now += dt;
    survive(this.run, this.profile, dt);
    this.movePlayer(dt);
    this.spawnDue();
    this.updateDrops(dt);
    this.hills.tilePositionX += dt * 0.02;

    const lucky = isLucky(this.run, this.now);
    this.luckyOverlay.setAlpha(lucky ? 0.12 + 0.06 * Math.sin(this.now / 80) : 0);
    if (lucky) this.player.setTint(Phaser.Display.Color.HSVToRGB((this.now / 600) % 1, 0.5, 1).color);
    else this.player.clearTint();
    this.player.setAlpha(this.now < this.run.invUntil && !lucky ? 0.5 + 0.3 * Math.sin(this.now / 40) : 1);
    this.updateHud();
  }

  finish() {
    this.ending = true;
    sfx.dead();
    this.player.clearTint().setAlpha(1);
    this.tweens.add({ targets: this.player, angle: -90, duration: 400, ease: 'Quad.In' });
    this.time.delayedCall(1000, () => this.onGameOver?.(this.run));
  }

  // ── HUD ────────────────────────────────────────────────────────
  createHud() {
    const txt = (x, y, s, size, color = '#221a2e') =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color }).setDepth(50);

    this.luckyOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xffd84a, 0).setDepth(40);
    this.hearts = Array.from({ length: 5 }, (_, i) => this.add.image(28 + i * 36, 30, 'heart').setDepth(50));
    this.add.rectangle(16, 58, 176, 12, 0xffffff, 0.7).setOrigin(0, 0.5).setDepth(50);
    this.gaugeBar = this.add.rectangle(16, 58, 0, 12, 0x43c463).setOrigin(0, 0.5).setDepth(51);
    txt(16, 68, '럭키 게이지', 14, '#2f5a3a');

    this.scoreText = txt(W - 16, 12, '0', 38).setOrigin(1, 0);
    this.timeText = txt(W - 16, 54, '0초', 20, '#4a3f5c').setOrigin(1, 0);
    this.comboText = txt(W / 2, PORTRAIT ? 116 : 96, '', 28, '#6b4bd6').setOrigin(0.5).setStroke('#fffaf0', 5);
    this.banner = txt(W / 2, PORTRAIT ? H * 0.22 : 130, '', PORTRAIT ? 28 : 30)
      .setOrigin(0.5).setStroke('#fffaf0', 6).setWordWrapWidth(W - 40).setAlign('center');
    const f = FORMS[this.profile.fortune.todayElement];
    txt(W / 2, 16, `오늘은 ${f.name} 기운 ↑`, 18, '#4a3f5c').setOrigin(0.5, 0);
    this.muteBtn = txt(W / 2, 40, '', 16, '#4a3f5c').setOrigin(0.5, 0).setPadding(10, 6).setInteractive({ useHandCursor: true });
    const muteLabel = () => this.muteBtn.setText(isMuted() ? '🔇 소리 꺼짐' : '🔊 소리 켜짐');
    muteLabel();
    this.muteBtn.on('pointerdown', () => {
      setMuted(!isMuted());
      muteLabel();
    });

    // 바닥 안내: 친구/천적 표시
    const me = FORMS[this.profile.me];
    const foe = FORMS[this.profile.nemesis];
    const hintY = PORTRAIT ? GROUND_Y + 90 : H - 26;
    txt(W / 2, hintY, `${me.emoji} 내 색깔은 먹기   ·   ${foe.emoji} 천적 ${foe.obstacle} 피하기`, PORTRAIT ? 22 : 18, '#fffaf0').setOrigin(0.5).setStroke('#8a2a22', 5);
    if (PORTRAIT) txt(W / 2, hintY + 44, '← 손가락으로 좌우 드래그 →', 20, '#ffe3c2').setOrigin(0.5);
  }

  updateHud() {
    const r = this.run;
    this.hearts.forEach((h, i) => h.setVisible(i < Math.max(r.hearts, 3)).setAlpha(i < r.hearts ? 1 : 0.2));
    this.gaugeBar.width = 176 * (r.gauge / 100);
    this.scoreText.setText(Math.floor(r.score).toLocaleString());
    this.timeText.setText(`${Math.floor(r.timeMs / 1000)}초`);
    const mult = comboMult(r.combo);
    this.comboText.setText(r.combo >= 3 ? `${r.combo} 콤보${mult > 1 ? ` 점수 ×${mult}` : ''}` : '');
  }

  bumpCombo() {
    this.comboText.setScale(1.4);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 200, ease: 'Back.Out' });
  }

  say(msg, color = '#221a2e', ms = 1100) {
    this.banner.setText(msg).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: ms, duration: 400 });
  }

  floatText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, { fontFamily: FONT, fontSize: '24px', color }).setOrigin(0.5).setDepth(30).setStroke('#fffaf0', 5);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  // ── 텍스처 ─────────────────────────────────────────────────────
  makeTextures() {
    const tex = (key, w, h, draw) => {
      if (this.textures.exists(key)) return;
      const t = this.textures.createCanvas(key, w, h);
      draw(t.getContext());
      t.refresh();
    };
    for (let e = 0; e < 5; e++) {
      tex(`player-${e}`, PLAYER_SIZE.w, PLAYER_SIZE.h, (c) => drawPlayer(c, e));
      tex(`drop-${e}-f`, DROP_SIZE, DROP_SIZE, (c) => drawDrop(c, e, true));
      tex(`drop-${e}-e`, DROP_SIZE, DROP_SIZE, (c) => drawDrop(c, e, false));
      tex(`lucky-${e}`, 52, 52, (c) => drawClover(c, e));
      tex(`fake-${e}`, 52, 52, (c) => drawClover(c, e, true));
    }
    tex('sprout-e', 48, 110, (c) => drawSprout(c, false));
    tex('coin', 32, 32, drawCoin);
    tex('heart', 32, 30, (c) => drawHeart(c));
    tex('dot', 10, 10, (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(5, 5, 5, 0, Math.PI * 2);
      c.fill();
    });
    tex(`sky-${W}x${H}`, W, H, (c) => drawSky(c, W, H));
    tex(`hills-${W}`, W, 160, (c) => drawHills(c, W, 160));
    tex(`ground-${W}x${H - GROUND_Y}`, W, H - GROUND_Y, (c) => drawGround(c, W, H - GROUND_Y));
  }
}

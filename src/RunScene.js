// 오행 가위바위보 러너 — 메인 씬.
// 규칙·점수는 rules.js, 장애물 배치는 patterns.js 가 정하고, 이 씬은 스폰·입력·연출만 한다.
// Phaser 는 index.html 에서 전역(window.Phaser)으로 로드한다.

import { FORMS } from './content.js';
import { counterOf, nextForm, createRun, hitObstacle, pickItem, changeForm, isLucky, comboMult } from './rules.js';
import { nextChunk } from './patterns.js';
import {
  drawPlayer, drawWall, drawSmall, drawCoin, drawHeart, drawClover, drawBubble, drawSky, drawHills, drawGround,
  PLAYER_SIZE, WALL_SIZE, SMALL_SIZE,
} from './art.js';
import { sfx } from './sfx.js';

const W = 960;
const H = 540;
const GROUND_Y = 440;
const PLAYER_X = 200;
const PX_PER_M = 40;
const BASE_SPEED = 330; // px/s
const FONT = '"Jua", "Noto Sans KR", sans-serif';

export const GAME_SIZE = { width: W, height: H };

export class RunScene extends Phaser.Scene {
  constructor() {
    super('RunScene');
  }

  /** @param {{profile: ReturnType<import('./profile.js').createProfile>, onGameOver: Function}} data */
  init(data) {
    this.profile = data.profile;
    this.onGameOver = data.onGameOver;
    this.run = createRun(this.profile);
    this.now = 0;
    this.traveled = 0; //  지나온 거리(px)
    this.cursor = 500; //   마지막으로 예약된 스폰 위치(px)
    this.lastLuckyPos = 0;
    this.pending = [];
    this.freezeMs = 0; //   타격 순간 멈칫(히트스톱)
    this.hintUntil = 0; //  지고 나면 잠깐 힌트를 다시 보여준다
    this.ending = false;
  }

  create() {
    this.makeTextures();
    this.physics.world.gravity.y = 2600;

    this.add.image(W / 2, H / 2, 'sky');
    this.hills = this.add.tileSprite(W / 2, GROUND_Y - 80, W, 160, 'hills');
    this.ground = this.add.tileSprite(W / 2, GROUND_Y + (H - GROUND_Y) / 2, W, H - GROUND_Y, 'ground');
    const floor = this.add.rectangle(W / 2, GROUND_Y + 20, W, 40, 0, 0);
    this.physics.add.existing(floor, true);

    // 발 기준 origin: 바디 바닥 = y
    this.player = this.physics.add.sprite(PLAYER_X, GROUND_Y, `player-${this.run.form}`).setOrigin(0.5, 1).setDepth(10);
    this.player.body.setSize(50, 70, false).setOffset(15, PLAYER_SIZE.h - 70);
    this.physics.add.collider(this.player, floor);

    this.hazards = this.physics.add.group({ allowGravity: false, immovable: true });
    this.items = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.hazards, (_, o) => this.onHazard(o));
    this.physics.add.overlap(this.player, this.items, (_, it) => this.onItem(it));

    this.shards = this.add.particles(0, 0, 'dot', {
      speed: { min: 180, max: 420 }, angle: { min: 200, max: 340 }, gravityY: 1200,
      lifespan: 700, scale: { start: 1.4, end: 0 }, emitting: false,
    }).setDepth(20);

    this.createHud();
    this.bindInput();
    this.fillPending();
    this.say('왼쪽 탭 = 변신 · 오른쪽 탭 = 점프', '#221a2e', 2600);
    this.time.delayedCall(2800, () => this.say('이기는 모양으로 부딪히면 박살!', '#221a2e', 2200));
  }

  // ── 입력 ────────────────────────────────────────────────────────
  bindInput() {
    const kb = this.input.keyboard;
    for (const k of ['Z', 'A', 'LEFT', 'SHIFT']) kb.on(`keydown-${k}`, () => this.transform());
    for (const k of ['SPACE', 'UP', 'X', 'RIGHT']) kb.on(`keydown-${k}`, () => this.jump());
    this.input.on('pointerdown', (p) => (p.x < W / 2 ? this.transform() : this.jump()));
  }

  transform() {
    if (this.run.dead) return;
    const form = changeForm(this.run);
    this.player.setTexture(`player-${form}`);
    this.tweens.killTweensOf(this.player);
    this.player.setScale(1.3, 0.75);
    this.tweens.add({ targets: this.player, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.Out' });
    this.shards.setParticleTint?.(FORMS[form].color);
    this.shards.explode(8, this.player.x, this.player.y - 40);
    sfx.transform();
    this.updateFormBadge();
  }

  jump() {
    if (this.run.dead || !this.player.body.blocked.down) return;
    this.player.setVelocityY(-900);
    sfx.jump();
  }

  // ── 스폰 ────────────────────────────────────────────────────────
  fillPending() {
    while (this.cursor - this.traveled < W + 800) {
      const chunk = nextChunk({
        rng: Math.random,
        distanceM: this.traveled / PX_PER_M,
        today: this.profile.fortune.todayElement,
        lucky: this.profile.lucky,
        fake: this.profile.fake,
        sinceLuckyM: (this.cursor - this.lastLuckyPos) / PX_PER_M,
        hearts: this.run.hearts,
      });
      for (const item of chunk) {
        this.cursor += item.dx;
        if (item.kind === 'LUCKY') this.lastLuckyPos = this.cursor;
        this.pending.push({ ...item, pos: this.cursor });
      }
    }
  }

  spawnDue() {
    while (this.pending.length && PLAYER_X + this.pending[0].pos - this.traveled <= W + 120) {
      const spec = this.pending.shift();
      const x = PLAYER_X + spec.pos - this.traveled;
      if (spec.kind === 'WALL' || spec.kind === 'SMALL') this.spawnHazard(spec, x);
      else this.spawnItem(spec, x);
    }
  }

  spawnHazard(spec, x) {
    const wall = spec.kind === 'WALL';
    const o = this.hazards.create(x, GROUND_Y, `${wall ? 'wall' : 'small'}-${spec.element}`).setOrigin(0.5, 1).setDepth(5);
    if (wall) o.body.setSize(60, WALL_SIZE.h - 10, false).setOffset(18, 10);
    else o.body.setSize(44, 40, false).setOffset(8, SMALL_SIZE.h - 40);
    const model = { ...spec, handled: false };
    model.swooned = Math.random() < (this.profile.mods.swoonChance ?? 0);
    o.setData('model', model);

    // 초보 힌트: 이 벽을 이기는 모양을 말풍선으로
    if (wall && (this.run.smashes < 12 || this.now < this.hintUntil)) {
      const top = GROUND_Y - WALL_SIZE.h - 40;
      const bubble = this.add.image(x, top, 'bubble').setDepth(6);
      const icon = this.add.image(x, top - 6, `player-${counterOf(spec.element)}`).setScale(0.45).setDepth(7);
      o.setData('hint', [bubble, icon]);
    }
  }

  spawnItem(spec, x) {
    const key = { COIN: 'coin', HEART: 'heart', LUCKY: `lucky-${spec.element}`, FAKE: `fake-${spec.element}` }[spec.kind];
    const y = spec.kind === 'COIN' ? (spec.high ? GROUND_Y - 130 : GROUND_Y - 40) : GROUND_Y - 70;
    const it = this.items.create(x, y, key).setDepth(8);
    it.setData('model', { ...spec });
    if (spec.kind === 'LUCKY' || spec.kind === 'FAKE') {
      this.tweens.add({ targets: it, y: y - 12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
  }

  // ── 메인 루프 ─────────────────────────────────────────────────────
  update(_, dt) {
    if (this.ending) return;
    this.now += dt;
    const now = this.now;

    if (this.freezeMs > 0) {
      this.freezeMs -= dt;
      return;
    }

    const lucky = isLucky(this.run, now);
    const ramp = 1 + Math.min(0.9, this.traveled / PX_PER_M / 3000);
    const speed = BASE_SPEED * (this.profile.mods.speedMult ?? 1) * ramp * (lucky ? 1.4 : 1);
    const dx = (speed * dt) / 1000;
    this.traveled += dx;
    this.run.distance = this.traveled / PX_PER_M;

    this.hills.tilePositionX += dx * 0.2;
    this.ground.tilePositionX += dx;

    this.fillPending();
    this.spawnDue();
    this.scrollObjects();

    // 럭키타임 연출
    this.luckyOverlay.setAlpha(lucky ? 0.12 + 0.06 * Math.sin(now / 80) : 0);
    if (lucky) this.player.setTint(Phaser.Display.Color.HSVToRGB((now / 600) % 1, 0.5, 1).color);
    else this.player.clearTint();
    this.player.setAlpha(now < this.run.invUntil && !lucky ? 0.5 + 0.3 * Math.sin(now / 40) : 1);

    this.updateHud(now);
  }

  scrollObjects() {
    const place = (o) => {
      const m = o.getData('model');
      o.x = PLAYER_X + m.pos - this.traveled;
      for (const h of o.getData('hint') ?? []) h.x = o.x;
      if (o.x < -120) this.destroyHazard(o);
      return m;
    };
    for (const o of [...this.hazards.getChildren()]) {
      const m = place(o);
      // 인기쟁이: 장애물이 반해서 비켜준다
      if (m.swooned && !m.handled && o.x < PLAYER_X + 260) {
        m.handled = true;
        this.tweens.add({ targets: o, y: GROUND_Y - 260, alpha: 0, duration: 500, ease: 'Back.In' });
        this.floatText(o.x, GROUND_Y - WALL_SIZE.h, '♥ 반했어요', '#ff5d8f');
      }
    }
    const magnet = this.profile.mods.magnet;
    for (const it of [...this.items.getChildren()]) {
      const m = it.getData('model');
      if (m.pulled) {
        it.x += (this.player.x - it.x) * 0.25;
        it.y += (this.player.y - 40 - it.y) * 0.25;
      } else {
        it.x = PLAYER_X + m.pos - this.traveled;
        if (magnet && m.kind === 'COIN' && Math.abs(it.x - this.player.x) < 170) m.pulled = true;
      }
      if (it.x < -60) it.destroy();
    }
  }

  destroyHazard(o) {
    for (const h of o.getData('hint') ?? []) h.destroy();
    o.destroy();
  }

  // ── 충돌 ────────────────────────────────────────────────────────
  onHazard(o) {
    const m = o.getData('model');
    if (m.handled) return;
    const ev = hitObstacle(this.run, this.profile, m, this.now);
    if (ev.type === 'NONE') return;
    m.handled = true;
    const obsName = FORMS[m.element].obstacle;

    switch (ev.type) {
      case 'SMASH': {
        this.shards.setParticleTint?.(FORMS[m.element].color);
        this.shards.explode(18, o.x, o.y - o.displayHeight / 2);
        this.destroyHazard(o);
        this.freezeMs = 45;
        this.cameras.main.shake(90, 0.006);
        sfx.smash(ev.combo);
        const label = ev.reason === 'TIGER' ? '🐯 들이받기!' : ev.mainForm ? `본캐 보너스 +${ev.score}` : `+${ev.score}`;
        this.floatText(o.x, GROUND_Y - 190, label, ev.mainForm ? '#e8453c' : '#221a2e');
        if (ev.combo >= 3) this.bumpCombo();
        if (ev.lucky) this.onLuckyStart();
        break;
      }
      case 'PASS':
        o.setAlpha(0.35);
        this.floatText(o.x, GROUND_Y - 190, '같은 편~ 통과', '#2f8a6b');
        sfx.pass();
        break;
      case 'HURT':
      case 'REVIVE':
      case 'DEAD': {
        sfx.hurt();
        this.cameras.main.shake(220, 0.016);
        this.cameras.main.flash(160, 255, 90, 90);
        this.hintUntil = this.now + 8000;
        const me = FORMS[this.run.lastHit.form].name;
        if (ev.result === 'LOSE') this.say(`천적! ${obsName} > ${me}  (하트 -2)`, '#e8453c');
        else this.say(`아야! 이기는 모양으로 부숴봐요 (하트 -1)`, '#e8453c');
        if (ev.type === 'REVIVE') this.time.delayedCall(700, () => this.say('🧘 해탈 도사 부활!', '#6b4bd6'));
        if (ev.type === 'DEAD') this.finish();
        break;
      }
    }
  }

  onItem(it) {
    const ev = pickItem(this.run, this.profile, it.getData('model'), this.now);
    it.destroy();
    switch (ev.type) {
      case 'COIN': sfx.coin(); break;
      case 'HEART': sfx.pass(); this.floatText(this.player.x, GROUND_Y - 130, '하트 +1', '#ff4d6d'); break;
      case 'LUCKY': this.onLuckyStart(); break;
      case 'FAKE':
        sfx.fake();
        this.say('짝퉁 럭키템이었다… 게이지 0', '#8a6d1f');
        break;
    }
  }

  onLuckyStart() {
    sfx.lucky();
    this.say('🍀 럭키타임! 다 부숴버려!', '#2f8a45', 1400);
    this.cameras.main.flash(200, 255, 230, 120);
  }

  finish() {
    this.ending = true;
    sfx.dead();
    this.physics.pause();
    this.player.clearTint().setAlpha(1);
    this.tweens.add({ targets: this.player, angle: -90, y: GROUND_Y + 10, duration: 500, ease: 'Quad.In' });
    this.time.delayedCall(1100, () => this.onGameOver?.(this.run));
  }

  // ── HUD ────────────────────────────────────────────────────────
  createHud() {
    const txt = (x, y, s, size, color = '#221a2e') =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color }).setDepth(50);

    this.luckyOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xffd84a, 0).setDepth(40);
    this.hearts = Array.from({ length: 5 }, (_, i) => this.add.image(28 + i * 36, 30, 'heart').setDepth(50));
    this.gaugeBg = this.add.rectangle(16, 58, 176, 12, 0xffffff, 0.7).setOrigin(0, 0.5).setDepth(50);
    this.gaugeBar = this.add.rectangle(16, 58, 0, 12, 0x43c463).setOrigin(0, 0.5).setDepth(51);
    txt(16, 68, '럭키 게이지', 14, '#2f5a3a');

    this.scoreText = txt(W - 16, 12, '0', 38).setOrigin(1, 0);
    this.distText = txt(W - 16, 54, '0m', 20, '#4a3f5c').setOrigin(1, 0);
    this.comboText = txt(W / 2, 64, '', 30, '#e8453c').setOrigin(0.5);
    this.banner = txt(W / 2, 120, '', 30).setOrigin(0.5).setStroke('#fffaf0', 6);
    const f = FORMS[this.profile.fortune.todayElement];
    txt(W / 2, 16, `오늘은 ${f.name} 기운 ↑`, 18, '#4a3f5c').setOrigin(0.5, 0);

    // 왼쪽 아래: 지금 모양 + 다음 모양 / 오른쪽 아래: 점프
    this.add.rectangle(64, H - 60, 250, 84, 0xfffaf0, 0.92).setOrigin(0, 0.5).setStrokeStyle(3, 0x221a2e).setDepth(49);
    this.add.circle(64, H - 60, 46, 0xfffaf0, 1).setStrokeStyle(4, 0x221a2e).setDepth(50);
    this.formIcon = this.add.image(64, H - 60, `player-${this.run.form}`).setScale(0.8).setDepth(51);
    this.formText = txt(120, H - 94, '', 22);
    this.nextText = txt(120, H - 66, '', 18, '#4a3f5c');
    txt(120, H - 42, '← 왼쪽 탭: 변신', 15, '#4a3f5c');
    this.add.circle(W - 64, H - 60, 46, 0xfffaf0, 0.92).setStrokeStyle(4, 0x221a2e).setDepth(50);
    txt(W - 64, H - 60, '점프', 24).setOrigin(0.5);
    this.updateFormBadge();
  }

  updateFormBadge() {
    const f = this.run.form;
    this.formIcon.setTexture(`player-${f}`);
    const main = f === this.profile.me ? ' (본캐)' : '';
    this.formText.setText(`지금: ${FORMS[f].name}${main}`);
    this.nextText.setText(`다음: ${FORMS[nextForm(f)].name}`);
  }

  updateHud() {
    const r = this.run;
    this.hearts.forEach((h, i) => h.setVisible(i < Math.max(r.hearts, 3)).setAlpha(i < r.hearts ? 1 : 0.2));
    this.gaugeBar.width = 176 * (r.gauge / 100);
    this.scoreText.setText(r.score.toLocaleString());
    this.distText.setText(`${Math.floor(r.distance)}m`);
    this.comboText.setText(r.combo >= 3 ? `${r.combo} 콤보 ×${comboMult(r.combo)}` : '');
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
      tex(`wall-${e}`, WALL_SIZE.w, WALL_SIZE.h, (c) => drawWall(c, e));
      tex(`small-${e}`, SMALL_SIZE.w, SMALL_SIZE.h, (c) => drawSmall(c, e));
      tex(`lucky-${e}`, 52, 52, (c) => drawClover(c, e));
      tex(`fake-${e}`, 52, 52, (c) => drawClover(c, e, true));
    }
    tex('coin', 32, 32, drawCoin);
    tex('heart', 32, 30, (c) => drawHeart(c));
    tex('bubble', 64, 68, drawBubble);
    tex('dot', 10, 10, (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(5, 5, 5, 0, Math.PI * 2);
      c.fill();
    });
    tex('sky', W, H, (c) => drawSky(c, W, H));
    tex('hills', W, 160, (c) => drawHills(c, W, 160));
    tex('ground', W, H - GROUND_Y, (c) => drawGround(c, W, H - GROUND_Y));
  }
}

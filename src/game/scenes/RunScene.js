// 메인 러닝 씬 (Phaser 3, Arcade Physics).
// 판정/수치는 combat.js·tables.js 가 담당하고, 이 씬은 스폰·입력·연출만 한다.
// Phaser 는 index.html 에서 전역(window.Phaser)으로 로드한다.

import { ELEMENTS } from '../../saju/constants.js';
import { pickWeighted } from '../buildPlayer.js';
import {
  createRunState,
  resolveCollision,
  resolveItem,
  onObstaclePassed,
  tickRun,
  statusEffects,
  isFever,
} from '../combat.js';
import { FEVER, STATUS_BY_ATTACKER } from '../tables.js';

const W = 960;
const H = 540;
const GROUND_Y = 460;
const BASE_SCROLL = 360; // px/s
const PX_PER_METER = 40;

// 장애물 콘셉트: 오행별 외형 이름
const OBSTACLE_NAMES = ['가시덩굴', '불기둥', '바위', '칼날', '물폭탄'];

export class RunScene extends Phaser.Scene {
  constructor() {
    super('RunScene');
  }

  /** @param {{char: ReturnType<import('../buildPlayer.js').createCharacter>, onGameOver: Function}} data */
  init(data) {
    this.char = data.char;
    this.onGameOver = data.onGameOver;
    this.run = createRunState(this.char);
    this.elapsed = 0; // 판 시작 후 ms — combat.js 의 now
    this.nextObstacleAt = 1500;
    this.nextItemAt = 800;
    this.jumpsLeft = this.char.stats.maxJumps;
    this.sliding = false;
  }

  create() {
    this.makeTextures();
    this.physics.world.gravity.y = 2200;

    this.add.rectangle(W / 2, (GROUND_Y + H) / 2, W, H - GROUND_Y, 0x2a2146);
    this.ground = this.add.rectangle(W / 2, GROUND_Y + 10, W, 20, 0x000000, 0);
    this.physics.add.existing(this.ground, true);

    this.player = this.physics.add.sprite(180, GROUND_Y - 40, `player-${this.char.elements.me}`);
    this.player.body.setSize(48, 80);
    this.physics.add.collider(this.player, this.ground, () => (this.jumpsLeft = this.char.stats.maxJumps));

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.items = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.obstacles, (_, o) => this.onHitObstacle(o));
    this.physics.add.overlap(this.player, this.items, (_, it) => this.onPickItem(it));

    this.blindOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x5b3a1a, 0).setDepth(50);
    this.hud = this.add.text(16, 12, '', { fontSize: '20px', color: '#f6f1e7' }).setDepth(60);
    this.banner = this.add.text(W / 2, 90, '', { fontSize: '32px', color: '#f2c14e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(60);

    this.bindInput();
  }

  // ── 입력: 키보드(↑/Space 점프, ↓ 슬라이딩) + 터치(좌 점프 / 우 슬라이딩) ──
  bindInput() {
    const kb = this.input.keyboard;
    kb.on('keydown-SPACE', () => this.press('JUMP'));
    kb.on('keydown-UP', () => this.press('JUMP'));
    kb.on('keydown-DOWN', () => this.press('SLIDE'));
    kb.on('keyup-DOWN', () => this.release('SLIDE'));
    this.input.on('pointerdown', (p) => this.press(p.x < W / 2 ? 'JUMP' : 'SLIDE'));
    this.input.on('pointerup', () => this.release('SLIDE'));
  }

  press(button) {
    // 火克金 상태이상 "녹아내림": 버튼 반전
    if (statusEffects(this.run).invertInput) button = button === 'JUMP' ? 'SLIDE' : 'JUMP';
    if (button === 'JUMP') this.jump();
    else this.setSliding(true);
  }

  release(button) {
    if (button === 'SLIDE' || statusEffects(this.run).invertInput) this.setSliding(false);
  }

  jump() {
    if (statusEffects(this.run).noJump || this.jumpsLeft <= 0) return;
    this.jumpsLeft--;
    this.setSliding(false);
    this.player.setVelocityY(-820 * this.char.stats.jump);
  }

  setSliding(on) {
    if (this.sliding === on) return;
    this.sliding = on;
    // Arcade 바디는 스케일을 따라가므로 scaleY 만 줄이면 판정도 같이 납작해진다.
    // 水 일간 "물 흐르듯"은 더 납작하게 (슬라이딩 길이 ×1.5 의 단순 구현)
    const flat = this.char.character.passive.id === 'FLOW' ? 0.375 : 0.5;
    this.player.setScale(1, on ? flat : 1);
  }

  // ── 메인 루프 ─────────────────────────────────────────────────
  update(_, dt) {
    if (this.run.dead) return;
    this.elapsed += dt;
    const now = this.elapsed;

    for (const ev of tickRun(this.run, this.char, now, dt)) this.fx(ev);
    if (this.run.dead) return this.finish();

    const fx = statusEffects(this.run);
    const feverMult = isFever(this.run, now) && this.run.feverKind === 'YONGSIN' ? FEVER.yongsinSpeedMult : 1;
    const ramp = 1 + Math.min(1, now / 180000); // 3분에 걸쳐 최대 2배
    const speed = BASE_SCROLL * this.char.stats.speed * fx.speedMult * feverMult * ramp;
    this.run.distance += (speed * dt) / 1000 / PX_PER_METER;

    this.scrollGroup(this.obstacles, speed, dt, (o) => onObstaclePassed(this.run, this.char, o.getData('model')));
    this.scrollGroup(this.items, speed, dt);
    this.applyMagnet(dt);

    if (now >= this.nextObstacleAt) this.spawnObstacle(now);
    if (now >= this.nextItemAt) this.spawnItem(now);

    this.blindOverlay.setFillStyle(0x5b3a1a, fx.blind);
    this.player.setAlpha(now < this.run.invincibleUntil && !isFever(this.run, now) ? 0.5 : 1);
    this.drawHud(now);
  }

  scrollGroup(group, speed, dt, onExit) {
    for (const obj of [...group.getChildren()]) {
      obj.x -= (speed * dt) / 1000;
      if (obj.x < -80) {
        onExit?.(obj);
        obj.destroy();
      }
    }
  }

  applyMagnet(dt) {
    const r = this.char.stats.magnet;
    for (const it of this.items.getChildren()) {
      const d = Phaser.Math.Distance.Between(it.x, it.y, this.player.x, this.player.y);
      if (d < r && d > 1) {
        const k = Math.min(1, (dt / 1000) * 8);
        it.x += (this.player.x - it.x) * k;
        it.y += (this.player.y - it.y) * k;
      }
    }
  }

  // ── 스폰 ─────────────────────────────────────────────────────
  spawnObstacle(now) {
    const { mods, spawnWeights } = this.char;
    const element = pickWeighted(spawnWeights);
    const high = Math.random() < 0.35; // 머리 위 장애물 → 슬라이딩으로 회피
    const y = high ? GROUND_Y - 115 : GROUND_Y - 30;
    const o = this.obstacles.create(W + 60, y, `obs-${element}`);
    const model = { element, size: high ? 1 : 1.2, high, hit: false, name: OBSTACLE_NAMES[element] };

    // 도화살: 장애물이 반해서 길을 비켜줌
    if (Math.random() < (mods.obstacleSwoonChance ?? 0)) {
      model.swooned = true;
      this.tweens.add({ targets: o, y: -60, delay: 400, duration: 600 });
      const heart = this.add.text(o.x, o.y - 40, '♥', { fontSize: '28px', color: '#ff7eb6' }).setDepth(40);
      this.tweens.add({ targets: heart, y: heart.y - 60, alpha: 0, duration: 900, onComplete: () => heart.destroy() });
    }
    o.setData('model', model);

    const gap = Phaser.Math.Between(900, 1500) / (mods.obstacleDensityMult ?? 1);
    this.nextObstacleAt = now + gap / (1 + Math.min(1, now / 180000));
  }

  spawnItem(now) {
    const { mods, elements, profile } = this.char;
    const sinceYongsin = now - this.run.lastYongsinAt;
    let spec;
    if (Math.random() < FEVER.yongsinBaseChance * (mods.yongsinSpawnMult ?? 1) || sinceYongsin > FEVER.yongsinGuaranteeMs) {
      spec = { element: elements.yongsin, special: 'YONGSIN' };
      this.run.lastYongsinAt = now; // 놓쳐도 보장 타이머 리셋
    } else if (Math.random() < 0.03) {
      spec = { element: elements.gisin, special: 'GISIN' }; // 용신처럼 빛나는 가짜
    } else if (Math.random() < 0.2) {
      spec = { element: Phaser.Math.Between(0, 4) };
    } else {
      spec = { element: profile.dayMaster, special: Math.random() < (mods.loveLetterChance ?? 0) ? 'LOVE_LETTER' : 'COIN' };
    }
    const key = spec.special === 'COIN' ? 'coin' : spec.special === 'LOVE_LETTER' ? 'letter' : spec.special ? `orb-glow-${spec.element}` : `orb-${spec.element}`;
    const it = this.items.create(W + 40, Phaser.Math.Between(GROUND_Y - 200, GROUND_Y - 40), key);
    it.setData('model', spec);
    this.nextItemAt = now + Phaser.Math.Between(350, 700);
  }

  // ── 충돌 ─────────────────────────────────────────────────────
  onHitObstacle(o) {
    const model = o.getData('model');
    if (model.hit) return;
    const ev = resolveCollision(this.run, this.char, model, this.elapsed);
    if (ev.type === 'IGNORED') return;
    model.hit = true;
    if (ev.type === 'SMASH') {
      this.tweens.add({ targets: o, angle: 540, x: o.x + 300, y: -80, duration: 500, onComplete: () => o.destroy() });
    }
    this.fx(ev);
    if (ev.type === 'DEAD') this.finish();
  }

  onPickItem(it) {
    const ev = resolveItem(this.run, this.char, it.getData('model'), this.elapsed);
    it.destroy();
    this.fx(ev);
    if (ev.type === 'YONGSIN_BUSTER') {
      // 화면 싹쓸이: 현재 화면의 모든 장애물 → 점수
      for (const o of [...this.obstacles.getChildren()]) this.onHitObstacle(o);
      this.cameras.main.flash(300, 242, 193, 78);
    }
  }

  fx(ev) {
    const say = (msg, color = '#f2c14e') => {
      this.banner.setText(msg).setColor(color).setAlpha(1);
      this.tweens.add({ targets: this.banner, alpha: 0, delay: 700, duration: 400 });
    };
    switch (ev.type) {
      case 'HIT':
        this.cameras.main.shake(ev.rel === 'CONTROLS_ME' ? 250 : 120, ev.rel === 'CONTROLS_ME' ? 0.02 : 0.008);
        if (ev.status) say(`상극! ${ev.status.name} (-${ev.damage})`, '#e8453c');
        break;
      case 'SMASH': if (ev.reason === 'BAEKHO') say('백호 박치기!'); break;
      case 'BLOCK': say('보호막!'); break;
      case 'REVIVE': say('화개살 발동 — 윤회!'); break;
      case 'MOTHER_BUFF': say(`상생! HP +${ev.heal}${ev.bonus > 1 ? ' (결핍 보상 ×2)' : ''}`, '#7be07b'); break;
      case 'YONGSIN_BUSTER': say('🔥 용신버스터 🔥'); break;
      case 'GISIN_TRAP': say('기신이었다… 게이지 -30', '#e8453c'); break;
      case 'LOVE_LETTER': say('💌 러브레터 (0점)', '#ff7eb6'); break;
      case 'COMBO_BLAZE': say('불붙은 콤보!'); break;
      case 'GROWTH': say(`쑥쑥 성장 Lv.${ev.stacks}`, '#7be07b'); break;
      case 'SHIELD_REGEN': say('바위 피부 재생'); break;
    }
  }

  drawHud(now) {
    const r = this.run;
    const statuses = r.statuses.map((s) => s.name).join(' ');
    const fever = isFever(r, now) ? `FEVER ${Math.ceil((r.feverUntil - now) / 1000)}s` : `게이지 ${Math.floor(r.fever)}%`;
    this.hud.setText(
      `HP ${Math.ceil(r.hp)}/${r.maxHp}${r.shield ? ' 🛡' : ''}  ${Math.floor(r.distance)}m  점수 ${Math.floor(r.score)}  ${fever}  ${statuses}`,
    );
  }

  finish() {
    this.physics.pause();
    this.time.delayedCall(600, () => this.onGameOver?.(this.run));
  }

  // ── 임시 텍스처 (아트 나오기 전 플레이스홀더) ────────────────────
  makeTextures() {
    const canvasTex = (key, w, h, draw) => {
      if (this.textures.exists(key)) return;
      const t = this.textures.createCanvas(key, w, h);
      draw(t.getContext());
      t.refresh();
    };
    const glyph = (ctx, s, x, y, size, color = '#1b1530') => {
      ctx.fillStyle = color;
      ctx.font = `900 ${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s, x, y);
    };
    ELEMENTS.forEach(({ id, hanja, color }) => {
      const css = `#${color.toString(16).padStart(6, '0')}`;
      canvasTex(`player-${id}`, 64, 88, (ctx) => {
        ctx.fillStyle = css;
        ctx.beginPath();
        ctx.roundRect(8, 0, 48, 88, 16);
        ctx.fill();
        glyph(ctx, hanja, 32, 36, 34);
      });
      canvasTex(`obs-${id}`, 56, 60, (ctx) => {
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 56, 60);
        glyph(ctx, hanja, 28, 31, 36);
      });
      canvasTex(`orb-${id}`, 36, 36, (ctx) => {
        ctx.fillStyle = css;
        ctx.beginPath();
        ctx.arc(18, 18, 16, 0, Math.PI * 2);
        ctx.fill();
        glyph(ctx, hanja, 18, 19, 20);
      });
      canvasTex(`orb-glow-${id}`, 52, 52, (ctx) => {
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.arc(26, 26, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css;
        ctx.beginPath();
        ctx.arc(26, 26, 18, 0, Math.PI * 2);
        ctx.fill();
        glyph(ctx, hanja, 26, 27, 22);
      });
    });
    canvasTex('coin', 24, 24, (ctx) => {
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath();
      ctx.arc(12, 12, 11, 0, Math.PI * 2);
      ctx.fill();
      glyph(ctx, '福', 12, 13, 14);
    });
    canvasTex('letter', 30, 22, (ctx) => {
      ctx.fillStyle = '#ffd1e3';
      ctx.fillRect(0, 0, 30, 22);
      glyph(ctx, '♥', 15, 12, 14, '#e8457c');
    });
  }
}

export const RUN_SCENE_SIZE = { width: W, height: H };
// 상태이상 표는 HUD 툴팁용으로 재노출
export { STATUS_BY_ATTACKER };

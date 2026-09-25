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
  resolveJustDodge,
  isJustTiming,
  resolveGhostPass,
} from '../combat.js';
import { FEVER, STATUS_BY_ATTACKER, SCENE_FX, JUST_DODGE, GHOST } from '../tables.js';
import { STAGES, STAGE_TEX_SIZE } from './stages.js';

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

  /**
   * @param {{char: ReturnType<import('../buildPlayer.js').createCharacter>, onGameOver: Function,
   *          ghost?: {date:string, distance:number} | null}} data
   */
  init(data) {
    this.char = data.char;
    this.onGameOver = data.onGameOver;
    this.ghostRecord = data.ghost ?? null;
    this.slowmoLeft = 0; //      저스트 회피 슬로모 남은 실시간 ms
    this.lastActionAt = 0; //    마지막 점프/슬라이딩 시작 시각 (저스트 회피 판정)
    this.landLockUntil = 0; //   착지 경직
    this.bufferedJump = false;
    this.wasGrounded = true;
    this.stageIdx = 0;
    this.nextStageAt = SCENE_FX.stageShuffleMs;
    this.fxActive = { heat: false, wave: false };
    this.ghost = null;
    this.ghostDone = false;
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
    this.endSlowmo(); // 재시작 시 이전 판 슬로모 잔여 제거

    // 배경: 스카이라인 tileSprite (패럴랙스) + 땅
    this.skyline = this.add.tileSprite(W / 2, GROUND_Y - STAGE_TEX_SIZE.height / 2, W, STAGE_TEX_SIZE.height, 'stage-0').setDepth(-10);
    this.groundRect = this.add.rectangle(W / 2, (GROUND_Y + H) / 2 + 40, W * 1.4, H - GROUND_Y + 80, 0x2a2146).setDepth(-5);
    this.stageLabel = this.add.text(W - 16, 12, '', { fontSize: '18px', color: '#b9aed6' }).setOrigin(1, 0).setDepth(60);
    this.setStage(0);
    this.ground = this.add.rectangle(W / 2, GROUND_Y + 10, W, 20, 0x000000, 0);
    this.physics.add.existing(this.ground, true);

    // 발 기준(origin 0.5,1)으로 두어 슬라이딩 scaleY 변화가 땅을 파고들지 않게 한다.
    // 바디 bottom = y - 88s + 8s + 80s = y → 스케일과 무관하게 발바닥 = 바디 바닥
    this.player = this.physics.add.sprite(180, GROUND_Y, `player-${this.char.elements.me}`).setOrigin(0.5, 1);
    this.player.body.setSize(48, 80, false).setOffset(8, 8);
    this.physics.add.collider(this.player, this.ground, () => (this.jumpsLeft = this.char.stats.maxJumps));

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.items = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.obstacles, (_, o) => this.onHitObstacle(o));
    this.physics.add.overlap(this.player, this.items, (_, it) => this.onPickItem(it));

    this.createGhost();

    // 화면 오버레이는 카메라 흔들림/회전에도 가장자리가 보이지 않게 크게 깐다
    this.tintOverlay = this.add.rectangle(W / 2, H / 2, W * 1.4, H * 1.4, 0x000000, 0).setDepth(49);
    this.blindOverlay = this.add.rectangle(W / 2, H / 2, W * 1.4, H * 1.4, 0x5b3a1a, 0).setDepth(50);
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
    // 착지 경직 중이면 입력을 버리지 않고 경직이 끝나는 순간 실행 (無土: +50ms)
    if (this.elapsed < this.landLockUntil) {
      this.bufferedJump = true;
      return;
    }
    this.bufferedJump = false;
    this.lastActionAt = this.elapsed;
    this.jumpsLeft--;
    this.setSliding(false);
    this.player.setVelocityY(-820 * this.char.stats.jump);
  }

  setSliding(on) {
    if (this.sliding === on) return;
    this.sliding = on;
    if (on) this.lastActionAt = this.elapsed;
    // Arcade 바디는 스케일을 따라가므로 scaleY 만 줄이면 판정도 같이 납작해진다.
    // 水 일간 "물 흐르듯"은 더 납작하게 (슬라이딩 길이 ×1.5 의 단순 구현)
    const flat = this.char.character.passive.id === 'FLOW' ? 0.375 : 0.5;
    this.player.setScale(1, on ? flat : 1);
  }

  // ── 메인 루프 ─────────────────────────────────────────────────
  update(_, realDt) {
    if (this.run.dead) return;
    const dt = this.applySlowmo(realDt);
    this.elapsed += dt;
    const now = this.elapsed;
    this.updateLanding(now);
    // 안전망: 어떤 이유로든 땅을 뚫고 내려가면 지면 위로 복귀
    if (this.player.body.bottom > GROUND_Y + 12) {
      this.player.body.reset(this.player.x, GROUND_Y);
      this.jumpsLeft = this.char.stats.maxJumps;
    }

    for (const ev of tickRun(this.run, this.char, now, dt)) this.fx(ev);
    if (this.run.dead) return this.finish();

    const fx = statusEffects(this.run);
    const feverMult = isFever(this.run, now) && this.run.feverKind === 'YONGSIN' ? FEVER.yongsinSpeedMult : 1;
    const ramp = 1 + Math.min(1, now / 180000); // 3분에 걸쳐 최대 2배
    const speed = BASE_SCROLL * this.char.stats.speed * fx.speedMult * feverMult * ramp;
    this.run.distance += (speed * dt) / 1000 / PX_PER_METER;

    this.scrollGroup(this.obstacles, speed, dt, (o) => onObstaclePassed(this.run, this.char, o.getData('model')));
    this.scrollGroup(this.items, speed, dt);
    this.skyline.tilePositionX += (speed * dt) / 1000 * 0.25;
    this.applyMagnet(dt);
    this.checkJustDodges();
    this.updateGhost();
    this.updateStageShuffle(now);
    this.updateScreenFx(now);

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

  // ── 착지 경직 (無土) ──────────────────────────────────────────
  updateLanding(now) {
    const grounded = this.player.body.blocked.down || this.player.body.touching.down;
    if (grounded && !this.wasGrounded) {
      this.landLockUntil = now + SCENE_FX.landingLagMs + (this.char.mods.landingLagBonus ?? 0);
    }
    this.wasGrounded = grounded;
    if (this.bufferedJump && now >= this.landLockUntil) this.jump();
  }

  // ── 저스트 회피 + 슬로모 (金 일간) ─────────────────────────────
  // 장애물이 플레이어 x 구간에 들어오는 순간, 마지막 회피 동작이 0.15초 이내였고
  // 지나가는 동안 한 번도 닿지 않았으면 저스트 회피.
  checkJustDodges() {
    const pb = this.player.body;
    for (const o of this.obstacles.getChildren()) {
      const m = o.getData('model');
      if (m.judged || m.hit || m.swooned) continue;
      const ob = o.getBounds();
      if (ob.right < pb.left) {
        m.judged = true;
        if (m.near && !m.touched) {
          const ev = resolveJustDodge(this.run, this.char);
          this.fx(ev);
          if (ev.slowmo) this.startSlowmo();
        }
        continue;
      }
      if (ob.left > pb.right) continue; // 아직 옆에 오지 않음
      if (m.near === undefined) m.near = isJustTiming(this.char, this.lastActionAt, this.elapsed);
      if (Math.max(ob.top - pb.bottom, pb.top - ob.bottom) <= 0) m.touched = true;
    }
  }

  startSlowmo() {
    this.slowmoLeft = JUST_DODGE.slowmoMs;
    this.physics.world.timeScale = 1 / JUST_DODGE.slowmoScale; // Arcade: 값이 클수록 느림
    this.tweens.timeScale = JUST_DODGE.slowmoScale;
    this.cameras.main.flash(120, 230, 237, 243);
  }

  endSlowmo() {
    this.slowmoLeft = 0;
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
  }

  /** 슬로모 중엔 게임 시간 dt 를 줄여 돌려준다 (슬로모 길이는 실시간 기준) */
  applySlowmo(realDt) {
    if (this.slowmoLeft <= 0) return realDt;
    this.slowmoLeft -= realDt;
    if (this.slowmoLeft <= 0) this.endSlowmo();
    return realDt * JUST_DODGE.slowmoScale;
  }

  // ── 라이벌 고스트 (비겁일) ──────────────────────────────────────
  createGhost() {
    if (!this.char.mods.ghostRival) return;
    this.ghost = this.ghostRecord
      ? { distance: this.ghostRecord.distance, label: `어제의 나 (${this.ghostRecord.date})` }
      : { distance: GHOST.fallbackM, label: '과거의 나 (추정)' };
    this.ghostSprite = this.add
      .image(W + 100, GROUND_Y - 44, `player-${this.char.elements.me}`)
      .setAlpha(0.35)
      .setTint(0x9fb7ff)
      .setDepth(5);
    this.ghostTag = this.add.text(0, 0, this.ghost.label, { fontSize: '14px', color: '#9fb7ff' }).setOrigin(0.5).setDepth(5);
  }

  updateGhost() {
    if (!this.ghost || this.ghostDone) return;
    const remainM = this.ghost.distance - this.run.distance;
    if (remainM <= 0) {
      this.ghostDone = true;
      const ev = resolveGhostPass(this.run, this.char);
      if (ev) this.fx(ev);
      // 고스트가 넘어지며 뒤로 흘러간다
      this.tweens.add({ targets: [this.ghostSprite, this.ghostTag], x: -100, angle: -90, alpha: 0, duration: 1200 });
      return;
    }
    // 15m 이내로 따라잡으면 화면 오른쪽에서 보이기 시작
    const x = remainM <= GHOST.showWithinM ? this.player.x + remainM * PX_PER_METER : W + 100;
    const bob = Math.sin(this.elapsed / 90) * 3;
    this.ghostSprite.setPosition(x, GROUND_Y - 44 + bob);
    this.ghostTag.setPosition(x, GROUND_Y - 104 + bob);
  }

  // ── 역마살: 배경 국가 랜덤 출장 ─────────────────────────────────
  setStage(idx) {
    this.stageIdx = idx;
    const stage = STAGES[idx];
    this.skyline.setTexture(`stage-${idx}`);
    this.groundRect.setFillStyle(stage.ground);
    this.cameras.main.setBackgroundColor(stage.sky);
    this.stageLabel.setText(`📍 ${stage.name}`);
  }

  updateStageShuffle(now) {
    if (!this.char.mods.stageShuffle || now < this.nextStageAt) return;
    this.nextStageAt = now + SCENE_FX.stageShuffleMs;
    let idx = Phaser.Math.Between(0, STAGES.length - 2);
    if (idx >= this.stageIdx) idx++; // 같은 나라 연속 방지
    this.cameras.main.flash(250, 255, 255, 255);
    this.setStage(idx);
    this.fx({ type: 'STAGE', name: STAGES[idx].name });
  }

  // ── 火 과다 아지랑이 / 水 과다 물결 ────────────────────────────
  // 카메라 회전·줌 + 색 오버레이라 Canvas/WebGL 렌더러 모두에서 동작한다.
  updateScreenFx(now) {
    const { mods } = this.char;
    const cam = this.cameras.main;
    const inWindow = ({ everyMs, durationMs }) => now >= everyMs && now % everyMs < durationMs;
    const heat = !!mods.heatHaze && inWindow(SCENE_FX.heatHaze);
    const wave = !!mods.waveFx && inWindow(SCENE_FX.wave);

    let rot = 0;
    let zoom = 1;
    let tint = 0;
    let alpha = 0;
    if (heat) {
      const t = now / 45;
      rot += 0.006 * Math.sin(t);
      zoom += 0.015 + 0.01 * Math.sin(t * 1.7);
      tint = 0xff6a00;
      alpha = 0.14 + 0.06 * Math.sin(t * 2);
    }
    if (wave) {
      const t = now / 220;
      rot += 0.02 * Math.sin(t);
      zoom += 0.03 + 0.01 * Math.sin(t * 2);
      tint = 0x2f6fd6;
      alpha = 0.18;
    }
    cam.setRotation(rot).setZoom(zoom);
    this.tintOverlay.setFillStyle(tint, alpha);

    if (heat && !this.fxActive.heat) this.fx({ type: 'HEAT' });
    if (wave && !this.fxActive.wave) this.fx({ type: 'WAVE' });
    this.fxActive = { heat, wave };
  }

  splash(o) {
    this.tweens.add({ targets: o, alpha: 0.3, duration: 200 });
    const p = this.add.particles(o.x, o.y + 20, 'drop', {
      speed: { min: 120, max: 320 },
      angle: { min: 200, max: 340 },
      gravityY: 900,
      lifespan: 600,
      quantity: 18,
      emitting: false,
    });
    p.explode(18);
    this.time.delayedCall(800, () => p.destroy());
  }

  // ── 스폰 ─────────────────────────────────────────────────────
  spawnObstacle(now) {
    const { mods, spawnWeights } = this.char;
    const element = pickWeighted(spawnWeights);
    const high = Math.random() < 0.35; // 머리 위 장애물 → 슬라이딩으로 회피
    // 높은 장애물(60px)은 340~400: 서 있으면(380~460) 머리에 걸리고, 슬라이딩(420~460)하면 통과
    const y = high ? GROUND_Y - 90 : GROUND_Y - 30;
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
    const ev = resolveCollision(this.run, this.char, model, this.elapsed, Math.random, { sliding: this.sliding });
    if (ev.type === 'IGNORED') {
      model.touched = true; // 무적으로 통과한 건 저스트 회피가 아니다
      return;
    }
    model.hit = true;
    if (ev.type === 'SPLASH') this.splash(o);
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
      case 'SPLASH': say('범람! 물보라 통과', '#6fa8ff'); break;
      case 'JUST_DODGE': say(ev.slowmo ? `칼같은 회피! +${ev.score}` : `저스트! +${ev.score}`, '#e6edf3'); break;
      case 'GHOST_PASSED': say(`어제의 나 추월! +${ev.score}`); break;
      case 'STAGE': say(`✈ 긴급 출장: ${ev.name}!`, '#e6edf3'); break;
      case 'HEAT': say('과열 경보! 🔥', '#ff8a3d'); break;
      case 'WAVE': say('범람! 🌊', '#6fa8ff'); break;
    }
  }

  drawHud(now) {
    const r = this.run;
    const statuses = r.statuses.map((s) => s.name).join(' ');
    const fever = isFever(r, now) ? `FEVER ${Math.ceil((r.feverUntil - now) / 1000)}s` : `게이지 ${Math.floor(r.fever)}%`;
    const ghost = this.ghost && !r.ghostPassed ? `  👻 ${Math.max(0, Math.ceil(this.ghost.distance - r.distance))}m` : '';
    this.hud.setText(
      `HP ${Math.ceil(r.hp)}/${r.maxHp}${r.shield ? ' 🛡' : ''}  ${Math.floor(r.distance)}m  점수 ${Math.floor(r.score)}  ${fever}${ghost}  ${statuses}`,
    );
  }

  finish() {
    this.endSlowmo();
    this.cameras.main.setRotation(0).setZoom(1);
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
    STAGES.forEach((stage, i) => canvasTex(`stage-${i}`, STAGE_TEX_SIZE.width, STAGE_TEX_SIZE.height, (ctx) => stage.draw(ctx)));
    canvasTex('drop', 8, 8, (ctx) => {
      ctx.fillStyle = '#9cc4ff';
      ctx.beginPath();
      ctx.arc(4, 4, 4, 0, Math.PI * 2);
      ctx.fill();
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

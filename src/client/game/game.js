// レイド本体：描画ループ・通信処理・リモートアクター補間・UI 連携
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { h, modal, fmt } from '../ui/dom.js';
import { ITEMS, weaponStats, CONTAINERS } from '../../shared/items.js';
import { allItems, countAmmo, listGrids } from '../../shared/inventory.js';
import { World } from '../../shared/world.js';
import { angleDiff, dirFromYawPitch } from '../../shared/math.js';
import { PARTS } from '../../shared/combat.js';
import { getMap, drawMapPreview, mapHotspots } from '../ui/mapview.js';
import { helpKeys } from '../ui/menu.js';
import { buildWorld3D, buildDoors, makeGlowTexture } from './world3d.js';
import { setAniso } from './textures.js';
import { Env } from './env.js';
import { Effects } from './effects.js';
import { ViewModel } from './viewmodel.js';
import { Audio3D } from './audio.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { TouchControls, IS_TOUCH, enterFullscreenLandscape } from './touch.js';
import { LocalPlayer } from './player.js';
import { HumanView, MachineView } from './actors3d.js';
import { buildWeapon } from './weapons3d.js';
import { RaidInventory } from './raidinv.js';
import { getItemIcon } from '../icons.js';
import { LocalTransport, WSTransport } from '../net.js';
import { MACHINES } from '../../shared/bots.js';

const SURF = { metal: 'metal', metal_wall: 'metal', container: 'metal', car: 'metal', wood: 'wood', wood_floor: 'wood', crate: 'wood', stair: 'concrete', concrete: 'concrete', concrete_floor: 'concrete', tile: 'concrete', lab_floor: 'concrete', carpet: 'dirt', dirt_floor: 'dirt' };

export class Game {
  constructor(app, { profile, opts, onEnd }) {
    this.app = app;
    this.profile = profile;
    this.opts = opts;
    this.onEnd = onEnd;
    this.settings = profile.settings;
    this.quality = this.settings.quality || 'high';
    this.root = h('div', { class: 'game' });
    app.append(this.root);
    this.loadingEl = h('div', { class: 'loading' }, h('div', { class: 'spinner' }), this.loadText = h('div', {}, 'レイドを準備中…'), h('div', { class: 'tip' }, randomTip()));
    this.root.append(this.loadingEl);
    this.actors = new Map();
    this.ground = new Map();
    this.nades = new Map();
    // 投擲物の見た目は共有（投げるたびに新しいマテリアルを作るとシェーダーの再コンパイルで止まる）
    this.nadeGeo = new THREE.SphereGeometry(0.06, 8, 6);
    this.nadeMat = new THREE.MeshStandardMaterial({ color: '#4c5a3a', roughness: 0.6 });
    this.extracts = [];
    this.time = 0;
    this.timeLeft = 0;
    this.inv = null;
    this.loot = null;
    this.selfState = null;
    this.pendingShots = 0;
    this.fps = 60;
    this.ended = false;
    this.flashT = 0;
    this.shake = 0;
    this.hurtFlash = 0;
    this.currentZoom = 1;
    this.lastStateSend = 0;
  }

  async start() {
    await frame();
    const q = this.quality;
    this.canvas = h('canvas', { class: 'view' });
    this.root.prepend(this.canvas);
    const R = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? (q === 'high' ? 1.25 : q === 'medium' ? 1 : 0.75) : q === 'high' ? 1.5 : 1));
    R.setSize(innerWidth, innerHeight, false);
    // スマホでメモリが足りなくなると描画が失われることがある → 真っ黒のままにせず知らせる
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.onContextLost(); });
    this.canvas.addEventListener('webglcontextrestored', () => { this.ctxLost = false; this.ctxEl?.remove(); this.ctxEl = null; });
    R.shadowMap.enabled = q !== 'low';
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.outputColorSpace = THREE.SRGBColorSpace;
    setAniso(Math.min(8, R.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.05, 3000);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.loadText.textContent = 'マップを構築中…';
    await frame();
    this.map = getMap();
    this.world = new World(this.map);
    this.w3d = buildWorld3D(this.scene, this.map, q);
    this.doors3d = buildDoors(this.scene, this.map.doors);
    this.env = new Env(this.scene, R, this.opts.timeOfDay, q);
    // 金属の反射用の環境マップ
    const pmrem = new THREE.PMREMGenerator(R);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.scene.environmentIntensity = { day: 0.45, dusk: 0.3, night: 0.08 }[this.opts.timeOfDay] ?? 0.4;
    this.effects = new Effects(this.scene, this.camera);
    this.vm = new ViewModel();
    this.vm.scene.environment = envTex;
    this.vm.scene.environmentIntensity = { day: 0.7, dusk: 0.45, night: 0.15 }[this.opts.timeOfDay] ?? 0.6;
    window.__game = this;
    this.audio = new Audio3D(this.settings.volume);
    this.hud = new HUD(this.root);
    this.rinv = new RaidInventory(this);
    this.input = new Input(this.canvas);
    if (IS_TOUCH) { this.touch = new TouchControls(this); this.hud.onHotbar = (i) => this.useQuick(i); }
    this.input.onLockChange = (locked) => { if (!locked && !this.rinv.open && !this.mapOpen && !this.ended && !this.pauseEl) this.showPause(); };
    // 懐中電灯
    this.flashlight = new THREE.SpotLight('#fff6e8', 0, 50, 0.48, 0.55, 1.4);
    this.flashlight.position.set(0.15, -0.1, 0);
    this.flashlight.target.position.set(0, -0.3, -5);
    this.camera.add(this.flashlight, this.flashlight.target);
    this.remoteLights = [0, 1].map(() => { const l = new THREE.SpotLight('#fff4e0', 0, 40, 0.42, 0.5, 1.5); this.scene.add(l, l.target); return l; });
    // ポストプロセス
    if (q === 'high') {
      this.composer = new EffectComposer(R);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), this.opts.timeOfDay === 'night' ? 0.6 : 0.3, 0.5, 0.88);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.extractBeams = new THREE.Group();
    this.scene.add(this.extractBeams);
    this.glowTex = makeGlowTexture();
    // 接続
    this.loadText.textContent = this.opts.mode === 'online' ? 'サーバーに接続中…' : 'レイドを生成中…';
    await frame();
    const profileMsg = { name: this.profile.name, inv: this.opts.loadout, health: this.profile.health, level: this.opts.level, easy: this.opts.difficulty === 'easy' };
    this.net = this.opts.mode === 'online' ? new WSTransport(this.opts.serverUrl) : new LocalTransport(this.opts);
    try {
      await this.net.connect(profileMsg);
    } catch (e) {
      this.dispose();
      throw e;
    }
    // 初期メッセージ処理
    for (const m of this.net.update(0)) this.handle(m);
    if (!this.player) { await frame(); for (const m of this.net.update(0.05)) this.handle(m); }
    if (!this.player) throw new Error('レイドに参加できませんでした');
    this.audio.ambience(this.opts.timeOfDay);
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
    this.resize();
    // ウォームアップ（シェーダーコンパイル）
    this.loadText.textContent = 'シェーダーを準備中…';
    await frame();
    this.effects.setPrewarm(true);
    const ground0 = { id: '__warm', item: 'bandage', count: 1, x: this.player.pos.x, y: -20, z: this.player.pos.z, rot: 0 };
    this.addGround(ground0);
    const nadeWarm = new THREE.Mesh(this.nadeGeo, this.nadeMat);
    nadeWarm.position.set(this.player.pos.x, -20, this.player.pos.z);
    this.scene.add(nadeWarm);
    this.flashlight.intensity = 1;
    R.compile(this.scene, this.camera);
    R.compile(this.vm.scene, this.vm.camera);
    // 実際に 1 フレーム描画してシェーダーとテクスチャをGPUへ
    this.render(0.016);
    this.flashlight.intensity = 0;
    this.effects.setPrewarm(false);
    this.removeGround('__warm');
    this.scene.remove(nadeWarm);
    this.loadingEl.innerHTML = '';
    this.loadingEl.append(
      h('div', { class: 'logo', style: { fontSize: '42px' } }, this.map.name),
      h('div', { class: 'tip' }, `${{ day: '昼', dusk: '夕暮れ', night: '夜' }[this.opts.timeOfDay]} ・ ${this.opts.mode === 'online' ? 'オンライン PvPvE' : 'オール NPC'} ・ 制限時間 ${Math.round(this.timeLeft / 60)} 分`),
      h('button', { class: 'btn primary big', onclick: () => this.begin() }, IS_TOUCH ? 'タップして開始' : 'クリックして開始'),
      h('div', { class: 'tip' }, IS_TOUCH ? '左下: 移動 ／ 右側スワイプ: 視点 ／ 上部ボタン: 一時停止・バッグ・マップ・脱出地点' : 'O: 脱出地点 ／ Tab: インベントリ ／ M: マップ ／ F: 漁る'),
    );
    this.last = performance.now();
    this.running = true;
    this.loop();
  }

  begin() {
    if (IS_TOUCH) enterFullscreenLandscape();
    this.loadingEl.remove();
    this.audio.resume();
    this.input.lock();
    this.hud.msg(`${this.map.name} に到着した。物資を集めて脱出せよ。`);
    this.hud.showExtracts(this, true);
    setTimeout(() => { if (!this.exHeld) this.hud.showExtracts(this, false); }, 6000);
  }

  resize() {
    const w = innerWidth, hh = innerHeight;
    this.renderer.setSize(w, hh, false);
    this.camera.aspect = w / hh;
    this.camera.updateProjectionMatrix();
    this.vm.resize(w / hh);
    this.composer?.setSize(w, hh);
  }

  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.fps = this.fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
    // 例外が出ても入力の「押した瞬間」は必ず消す（消えないと毎フレーム同じ処理が走って止まる）
    try { this.frame(dt); } catch (e) { console.error(e); window.__rbError?.(e); this.input.endFrame(); }
  }

  frame(dt) {
    this.time += dt;
    // 通信
    for (const m of this.net.update(dt)) this.handle(m);
    if (this.ended) { this.render(dt); return; }
    const inp = this.input;
    const P = this.player;
    // UI 系キー
    if (inp.pressed('Tab') || (this.rinv.open && inp.pressed('Escape'))) this.toggleInv();
    if (inp.pressed('KeyM')) this.toggleMap();
    if (inp.pressed('KeyO')) { this.exHeld = !this.exHeld; this.hud.showExtracts(this, this.exHeld); }
    if (this.exHeld && Math.floor(this.time) !== this._exT) { this._exT = Math.floor(this.time); this.hud.showExtracts(this, true); }
    const uiOpen = this.rinv.open || this.mapOpen || this.pauseEl;
    inp.enabled = !uiOpen || this.rinv.open;
    if (this.touch) { this.touch.update(); if (uiOpen) { inp.moveX = 0; inp.moveY = 0; } }
    if (!uiOpen && inp.locked) {
      this.aimAssist(dt, inp);
      P.update(dt, inp);
      if (inp.pressed('KeyF')) this.interact();
      if (inp.pressed('KeyG') && this.time > P.throwUntil) P.throwGrenade();
      if (inp.pressed('KeyH')) this.autoHeal();
      for (let k = 4; k <= 9; k++) if (inp.pressed('Digit' + k)) this.useQuick(k - 4);
    } else if (this.rinv.open && P) {
      // インベントリを開いていても移動はできる（Tarkov 同様に遅く）
      P.update(dt, { ...inp, mdx: 0, mdy: 0, down: (c) => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c) && inp.keys.has(c), pressed: () => false, mouse: [false, false, false], wheel: 0 });
    }
    // 戦利品の距離チェック
    if (this.loot && this.lootPos && Math.hypot(this.lootPos.x - P.pos.x, this.lootPos.z - P.pos.z) > 3.5) { this.closeLoot(); }
    // サーバーへ状態送信
    this.sendState(false);
    this.updateInteractPrompt();
    this.updateActors(dt);
    this.updateGround(dt);
    this.render(dt);
    inp.endFrame();
  }

  // ---------------------------------------------------------------- エイムアシスト（主にスマホ向け）
  // 照準の近くにいる敵に視点を少し吸い付かせ、敵の上では感度を落とす。オートファイアも任意で。
  aimAssist(dt, inp) {
    const level = this.settings.aimAssist ?? 0; // 0:なし 1:弱 2:標準 3:強
    const P = this.player;
    this.aimTarget = null;
    if (!P?.alive || !P.weapon()) return;
    const e = P.eye();
    const f = P.aimDir();
    let best = null, bestScore = Infinity;
    for (const a of this.actors.values()) {
      if (a.dead || !a.cur || !a.info) continue;
      const k = a.info.kind;
      const crouch = (a.flags || 0) & 1;
      let y = a.cur.y + (crouch ? 0.85 : 1.3), r = 0.35;
      if (k === 'machine') {
        const m = a.info.mtype;
        y = a.cur.y + (m === 'sentinel' ? 2.7 : m === 'tick' ? 0.45 : 0);
        r = m === 'sentinel' ? 1.3 : m === 'hornet' ? 0.8 : 0.55;
      }
      const dx = a.cur.x - e.x, dy = y - e.y, dz = a.cur.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 1 || d > 120) continue;
      const cos = (dx * f.x + dy * f.y + dz * f.z) / d;
      const ang = Math.acos(Math.min(1, cos));
      const size = Math.atan(r / d);
      const cone = size + (P.ads ? 0.06 : 0.11) * (0.6 + level * 0.25);
      if (ang > cone) continue;
      const score = ang / cone + d / 400;
      if (score < bestScore) { bestScore = score; best = { a, y, d, ang, size, dx, dy, dz }; }
    }
    if (best && !this.world.lineOfSight(e, { x: best.a.cur.x, y: best.y, z: best.a.cur.z })) best = null;
    if (!best) return;
    this.aimTarget = best;
    const onTarget = best.ang < best.size * 1.2;
    if (level > 0) {
      // 吸い付き：敵の方向へ少しずつ回す（ADS・射撃中は強め）
      const tYaw = Math.atan2(-best.dx, -best.dz) - P.recoilY;
      const tPitch = Math.atan2(best.dy, Math.hypot(best.dx, best.dz)) - P.recoilP;
      let dyaw = tYaw - P.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      const strength = (0.9 + level * 1.1) * (P.ads ? 1.8 : 1) * (inp.mouse[0] ? 1.4 : 1);
      const kk = Math.min(1, dt * strength);
      P.yaw += dyaw * kk;
      P.pitch += (tPitch - P.pitch) * kk * 0.85;
      // 敵の上では視点移動を鈍く（行き過ぎ防止）
      if (best.ang < best.size * 2.5) { const fr = 1 - 0.15 * level; inp.mdx *= fr; inp.mdy *= fr; }
    }
    // オートファイア：照準が敵に重なったら撃つ（単射武器は連打）
    if (this.settings.autoFire && onTarget) {
      this._afTick = !this._afTick;
      const def = ITEMS[P.weapon().id];
      const mode = def.weapon.modes[(this.selfState?.mode || 0) % def.weapon.modes.length];
      inp.mouse[0] = mode === 'auto' ? true : this._afTick;
      this._autoFiring = true;
    } else if (this._autoFiring) { this._autoFiring = false; if (!this.touch?.fireId) inp.mouse[0] = false; }
  }

  sendState(force) {
    const P = this.player;
    if (!P || !P.alive) return;
    const rate = this.net.online ? 1 / 20 : 0;
    if (!force && this.time - this.lastStateSend < rate) return;
    this.lastStateSend = this.time;
    this.net.send({ t: 'state', p: [r3(P.pos.x), r3(P.pos.y), r3(P.pos.z)], yaw: r3(P.yaw), pitch: r3(P.pitch), c: P.crouch ? 1 : 0, s: P.sprint && P.moving ? 1 : 0, ads: P.ads ? 1 : 0, m: P.moving ? 1 : 0, l: r3(P.lean), light: P.light ? 1 : 0, slot: P.slot });
  }

  // ---------------------------------------------------------------- 描画
  toastMsg(text, warn = false) { this.hud.msg(text, warn); }

  onContextLost() {
    this.ctxLost = true;
    if (this.ctxEl) return;
    const reload = h('button', { class: 'btn', style: { display: 'none', marginTop: '10px' }, onclick: () => location.reload() }, '再読み込み（このレイドは未帰還になります）');
    this.ctxEl = h('div', { class: 'pause', style: { zIndex: 60 } }, h('div', { class: 'col', style: { alignItems: 'center', maxWidth: '520px', textAlign: 'center', lineHeight: 1.7 } },
      h('b', { style: { fontSize: '18px' } }, '画面の描画が止まりました'),
      h('div', { class: 'mini' }, '端末のメモリ不足などで、グラフィックがリセットされました。復帰を待っています…'),
      h('div', { class: 'mini' }, 'たびたび起きる場合は、設定の「画質」を「低」にしてください。'),
      reload));
    this.root.append(this.ctxEl);
    setTimeout(() => { if (this.ctxLost) reload.style.display = ''; }, 4000);
  }

  render(dt) {
    if (this.ctxLost) return;
    const P = this.player;
    const cam = this.camera;
    if (P) {
      const e = P.eye();
      // 頭の揺れ
      const bobA = P.moving && P.phys.onGround ? (P.sprint ? 0.045 : 0.022) * (P.ads ? 0.3 : 1) : 0;
      this.bobT = (this.bobT || 0) + dt * (P.sprint ? 13 : 9) * (P.moving ? 1 : 0);
      const by = Math.abs(Math.sin(this.bobT)) * bobA, bx = Math.cos(this.bobT) * bobA * 0.5;
      this.shake = Math.max(0, this.shake - dt * 2);
      const sh = this.shake * this.shake;
      cam.position.set(e.x + bx * Math.cos(P.yaw), e.y + by, e.z - bx * Math.sin(P.yaw));
      cam.rotation.set(P.pitch + P.recoilP + (Math.random() - 0.5) * sh * 0.05, P.yaw + P.recoilY + (Math.random() - 0.5) * sh * 0.05, -P.lean * 0.14);
      // ズーム
      const w = P.weapon();
      let zoom = 1;
      let st = null;
      if (w) { st = weaponStats(w); if (P.ads) zoom = st.zoom >= 5 && P.zoomIdx === 1 ? st.zoom / 2.5 : st.zoom; }
      this.currentZoom += (zoom - this.currentZoom) * Math.min(1, dt * 12);
      const fov = this.settings.fov / this.currentZoom;
      if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
      const scoped = P.ads && st && st.zoom >= 2 && this.vm.ads > 0.85;
      this.hud.scope(scoped, st?.zoom, st?.reticle);
      // 暗視・サーマル
      const filt = scoped && st?.nv ? 'sepia(1) hue-rotate(55deg) saturate(3.5) brightness(2.6) contrast(1.15)' : scoped && st?.thermal ? 'grayscale(1) brightness(.5) contrast(1.6)' : '';
      if (filt !== this._filt) { this._filt = filt; this.canvas.style.filter = filt; this.setThermal(scoped && st?.thermal); }
      // 懐中電灯
      const hasLight = w && st?.light;
      this.flashlight.intensity = P.light ? (hasLight ? 60 : 25) : 0;
      this.flashlight.distance = hasLight ? 55 : 30;
      // 一人称モデル
      this.vm.update(dt, { ads: P.ads, sprint: P.sprint && P.moving, moving: P.moving, onGround: P.phys.onGround, crouch: P.crouch, lookDX: this.input.mdx, lookDY: this.input.mdy, lean: P.lean, hidden: scoped || !P.alive, adsSpeed: st ? 6 + st.ergo / 10 : 10 });
      // 音のリスナー
      const f = dirFromYawPitch(P.yaw, P.pitch);
      this.audio.setListener(cam.position, f);
    }
    this.env.update(cam.position);
    this.w3d.veg.wind.value = this.time;
    this.w3d.water.offset.set(this.time * 0.01, this.time * 0.006);
    this.updateLamps();
    this.effects.update(dt, this.time);
    // 扉アニメーション
    for (const piv of Object.values(this.doors3d)) {
      const u = piv.userData;
      if (u.cur !== u.target) { u.cur += Math.sign(u.target - u.cur) * Math.min(Math.abs(u.target - u.cur), dt * 3); piv.rotation.y = u.base + u.cur * 1.75; }
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    if (this.player) this.hud.update(this, dt);
    const R = this.renderer;
    if (this.composer) this.composer.render(dt);
    else { R.autoClear = true; R.render(this.scene, cam); }
    if (this.vm.root.visible) {
      R.autoClear = false;
      R.clearDepth();
      // 一人称モデルのライトを環境に合わせる
      const night = this.opts.timeOfDay === 'night';
      this.vm.hemi.intensity = night ? (this.player?.light ? 0.8 : 0.15) : this.opts.timeOfDay === 'dusk' ? 0.7 : 1.1;
      this.vm.dir.intensity = night ? 0.2 : 1.4;
      R.render(this.vm.scene, this.vm.camera);
      R.autoClear = true;
    }
  }

  setThermal(on) {
    for (const v of this.actors.values()) {
      if (!v.view) continue;
      v.view.root.traverse((o) => {
        if (!o.isMesh) return;
        if (on) { if (!o.userData.origMat) { o.userData.origMat = o.material; o.material = THERMAL_MAT; } }
        else if (o.userData.origMat) { o.material = o.userData.origMat; delete o.userData.origMat; }
      });
    }
  }

  updateLamps() {
    const night = this.opts.timeOfDay !== 'day';
    if (this._lampsSet === night) return;
    this._lampsSet = night;
    for (const l of this.w3d.lamps) {
      l.head.material.emissiveIntensity = night ? 3 : 0;
      l.sprite.material.opacity = night ? (this.opts.timeOfDay === 'night' ? 0.95 : 0.6) : 0;
    }
  }

  // ---------------------------------------------------------------- メッセージ処理
  handle(m) {
    switch (m.t) {
      case 'welcome': this.onWelcome(m); break;
      case 'ainfo': this.onActorInfo(m); break;
      case 'snap': this.onSnap(m); break;
      case 'self': this.selfState = m; this.pendingShots = 0; this.stimSpeed = 0; break;
      case 'inv': this.onInv(m.inv); break;
      case 'loot': this.openLoot(m); break;
      case 'lootUpd': if (this.loot && this.loot.root === m.root) { this.loot.inv = m.inv; this.rinv.refresh(); } break;
      case 'hitmark': this.hud.hitmarker(m.kill, m.blocked); this.audio.hitmarker(m.kill, m.blocked); if (m.kill) this.hud.msg(m.machine ? '機械を破壊した' : '敵を倒した'); break;
      case 'hurt': this.onHurt(m); break;
      case 'msg': this.hud.msg(m.text, m.warn); break;
      case 'picked': this.audio.pickup(); this.hud.msg(`${ITEMS[m.item]?.name}${m.count > 1 ? ' ×' + m.count : ''} を拾った`); break;
      case 'invFail': this.audio.ui(300); this.hud.msg('空きスペースがない（入らなかった物は元の場所に残っている）', true); break;
      case 'flashed': this.flashT = 1.5 + m.s * 4; this.audio.ring(2 + m.s * 4, m.s); break;
      case 'shake': this.shake = Math.min(1.5, this.shake + m.s * 2); this.audio.ring(1 + m.s * 3, m.s * 0.6); break;
      case 'died': this.onDied(m); break;
      case 'extractOk': this.onExtracted(m); break;
      case 'disconnected': if (!this.ended) { this.hud.msg('サーバーとの接続が切れた', true); this.finish({ survived: false, mia: true, killer: '接続切れ', stats: {} }); } break;
    }
  }

  onWelcome(m) {
    this.me = m.you;
    this.timeLeft = m.timeLeft;
    this.player = new LocalPlayer(this, m.pos, m.yaw);
    this.extracts = m.extracts;
    for (const d of m.doors) { this.world.setDoor(d.id, d.open); const p = this.doors3d[d.id]; if (p) { p.userData.target = p.userData.cur = d.open ? 1 : 0; p.rotation.y = p.userData.base + p.userData.cur * 1.75; } if (!d.locked) this.world.doors[d.id].locked = null; }
    for (const g of m.ground) this.addGround(g);
    for (const id of m.gates || []) this.world.setGate(id, true);
    this.buildExtractBeams();
  }

  onInv(inv) {
    const prevW = this.inv?.equip?.[this.player?.slot];
    this.inv = inv;
    const P = this.player;
    if (!P) return;
    const w = inv.equip[P.slot];
    const sig = (x) => (x ? x.uid + JSON.stringify(Object.values(x.mods || {}).map((q) => q?.id)) : '');
    if (sig(w) !== sig(prevW) || !this.vm.weapon) {
      if (!w) { const any = ['primary', 'secondary', 'holster'].find((s) => inv.equip[s]); if (any) P.slot = any; }
      this.vm.setWeapon(inv.equip[P.slot]);
    }
    this.rinv.refresh();
    this.updateHotbar();
  }

  onActorInfo(m) {
    if (m.id === this.me) { this.myInfo = m; return; }
    let a = this.actors.get(m.id);
    if (!a) {
      a = { id: m.id, info: m, buf: [], view: null, stepT: 0 };
      this.actors.set(m.id, a);
    }
    a.info = m;
    if (!a.view) a.view = m.kind === 'machine' ? new MachineView(m, this.scene) : new HumanView(m, this.scene);
    else a.view.setGear(m);
  }

  onSnap(m) {
    const now = performance.now() / 1000;
    this.timeLeft = m.left;
    this.serverTime = m.time;
    const seen = new Set();
    for (const e of m.a) {
      const [id, x, y, z, yaw, pitch, f, slot] = e;
      seen.add(id);
      if (id === this.me) { this.myFlags = f; continue; }
      const a = this.actors.get(id);
      if (!a) continue;
      a.buf.push({ t: now, x, y, z, yaw, pitch, f, slot });
      if (a.buf.length > 30) a.buf.shift();
      a.lastSeen = m.time;
      a.dead = !!(f & 8);
    }
    // 投擲物
    const live = new Set();
    for (const [id, x, y, z] of m.n) {
      live.add(id);
      let n = this.nades.get(id);
      if (!n) { n = { mesh: new THREE.Mesh(this.nadeGeo, this.nadeMat), buf: [] }; n.mesh.position.set(x, y, z); this.scene.add(n.mesh); this.nades.set(id, n); }
      n.buf.push({ t: now, x, y, z });
      if (n.buf.length > 10) n.buf.shift();
    }
    for (const [id, n] of this.nades) if (!live.has(id)) { this.scene.remove(n.mesh); this.nades.delete(id); }
    for (const ev of m.ev) this.onEvent(ev);
  }

  actorPos(id) {
    if (id === this.me) return this.player ? { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z } : null;
    const a = this.actors.get(id);
    if (!a?.cur) { const b = a?.buf[a.buf.length - 1]; return b ? { x: b.x, y: b.y, z: b.z } : null; }
    return a.cur;
  }

  onEvent(ev) {
    const V = (arr) => new THREE.Vector3(arr[0], arr[1], arr[2]);
    switch (ev.t) {
      case 'ainfo': this.onActorInfo(ev); break;
      case 'shot': this.onShotEvent(ev, V); break;
      case 'dry': if (ev.id !== this.me) { const p = this.actorPos(ev.id); if (p) this.audio.click(p, 3000, 0.3); } break;
      case 'reload': {
        if (ev.id === this.me) { this.vm.startReload(ev.dur); this.audio.reload(null, ev.dur, true); }
        else { const p = this.actorPos(ev.id); if (p) this.audio.reload(p, ev.dur); }
        break;
      }
      case 'use': if (ev.id === this.me) { const d = ITEMS[ev.item]; this.usingName = d?.name; this.usingDur = ev.dur; this.vm.startUse(ev.dur, d?.color); } break;
      case 'useEnd': if (ev.id === this.me) { this.vm.stopUse(); if (!ev.cancel) this.audio.ui(1200); } break;
      case 'death': this.onDeathEvent(ev); break;
      case 'feed': this.hud.feed(escapeHtml(ev.msg)); if (ev.kind === 'chat') this.hud.chat(ev.msg); break;
      case 'gadd': this.addGround(ev.g); break;
      case 'gdel': this.removeGround(ev.id); break;
      case 'door': {
        this.world.setDoor(ev.id, ev.open);
        if (ev.unlocked && this.world.doors[ev.id]) this.world.doors[ev.id].locked = null;
        const p = this.doors3d[ev.id];
        if (p) { p.userData.target = ev.open ? 1 : 0; this.audio.door(p.position, ev.open); }
        break;
      }
      case 'doorLocked': { const p = this.doors3d[ev.id]; if (p) this.audio.locked(p.position); break; }
      case 'bounce': this.audio.click({ x: ev.p[0], y: ev.p[1], z: ev.p[2] }, 900, 0.3); break;
      case 'boom': this.onBoom(ev); break;
      case 'smoke': this.effects.smoke({ x: ev.p[0], y: ev.p[1], z: ev.p[2] }, ev.r); this.audio.click({ x: ev.p[0], y: ev.p[1], z: ev.p[2] }, 600, 0.5); break;
      case 'gate': {
        const e = this.extracts.find((x) => x.id === ev.id);
        if (e) { e.open = true; this.world.setGate(ev.id, true); this.buildExtractBeams(); this.audio.alarm({ x: e.x, y: 2, z: e.z }); }
        break;
      }
      case 'extracted': break;
      case 'charge': {
        const a = this.actors.get(ev.id);
        const p = this.actorPos(ev.id);
        if (p) this.audio.charge(p);
        const tp = this.actorPos(ev.target);
        if (a?.view && tp) {
          const from = a.view.muzzleWorld(new THREE.Vector3());
          const B = this.effects.beams.find((b) => b.t <= 0);
          if (B) { this.effects.beam(from, new THREE.Vector3(tp.x, tp.y + 1.2, tp.z), '#ff2a20'); B.t = ev.dur; B.m.scale.x = B.m.scale.y = 0.15; }
        }
        break;
      }
      case 'tickArm': { const p = this.actorPos(ev.id); if (p) { this.audio.beep(p, 1800); setTimeout(() => this.audio.beep(p, 2200), 250); setTimeout(() => this.audio.beep(p, 2600), 500); } const a = this.actors.get(ev.id); if (a) a.armed = true; break; }
      case 'looted': break;
    }
  }

  onShotEvent(ev, V) {
    const o = V(ev.o);
    const mine = ev.id === this.me;
    const a = this.actors.get(ev.id);
    let from = o;
    if (mine) {
      const ml = this.vm.muzzleLocal(new THREE.Vector3());
      from = this.camera.localToWorld(ml);
    } else if (a?.view) {
      from = a.view.muzzleWorld(new THREE.Vector3());
      if (ev.cal === 'machine') {
        this.audio.machineShot(from, ev.msnd);
        this.effects.muzzle(from, new THREE.Vector3(...ev.e[0].slice(0, 3)).sub(from).normalize(), { color: ev.mtr, noLight: false });
      } else {
        const kind = soundKind(ev);
        this.audio.gunshot(from, kind, ev.sup);
        const dir = new THREE.Vector3(...ev.e[0].slice(0, 3)).sub(from).normalize();
        this.effects.muzzle(from, dir, { suppressed: ev.sup, big: ev.cls === 'lmg' || ev.cls === 'sniper' || ev.cls === 'shotgun' });
      }
    }
    const P = this.player;
    for (const [x, y, z, kind, n] of ev.e) {
      const end = new THREE.Vector3(x, y, z);
      if (ev.beam) this.effects.beam(from, end, ev.mtr);
      else if (ev.tr || ev.cal === 'machine' || (!mine && Math.random() < 0.18)) this.effects.tracer(from, end, ev.mtr || (ev.tr ? '#ff8a40' : '#ffe0a0'), ev.cal === 'machine' ? 160 : 420, ev.cal === 'machine' ? 2.2 : ev.tr ? 1.2 : 0.7);
      this.effects.impact(end, n ? { x: n[0], y: n[1], z: n[2] } : null, kind);
      if (Math.random() < 0.5) this.audio.impact(end, kind);
      // 至近弾
      if (!mine && P && kind !== 'flesh') {
        const d = distPointSeg(P.eye(), from, end);
        if (d < 2.2) { this.audio.flyby(P.eye()); this.suppression = Math.min(1, (this.suppression || 0) + 0.25); }
      }
    }
  }

  onDeathEvent(ev) {
    const killerMe = ev.killer === this.me;
    const icon = ev.head ? ' 🎯' : '';
    this.hud.feed(`<b>${escapeHtml(ev.kname || '環境')}</b> ⟶ ${escapeHtml(ev.vname)} <span style="color:#999">[${escapeHtml(ev.weapon || '')}]${icon}</span>`, killerMe);
    const a = this.actors.get(ev.id);
    if (a && a.info.kind === 'machine') {
      this.audio.stopLoop(a.id);
      this.effects.fire({ x: ev.pos[0], y: ev.pos[1] + 0.3, z: ev.pos[2] }, 25);
      this.effects.explosion({ x: ev.pos[0], y: ev.pos[1], z: ev.pos[2] }, 2, 'emp');
      this.audio.explosion({ x: ev.pos[0], y: ev.pos[1], z: ev.pos[2] });
    }
  }

  onBoom(ev) {
    const p = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
    this.effects.explosion(p, ev.r, ev.type);
    if (ev.type === 'flash') this.audio.flashbang(p);
    else this.audio.explosion(p, true);
    if (this.player) {
      const d = Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z);
      if (d < 40) this.shake = Math.min(1.5, this.shake + (1 - d / 40) * 1.2);
    }
  }

  onHurt(m) {
    this.hurtFlash = Math.min(1, this.hurtFlash + 0.4 + m.dmg / 60);
    this.audio.hurt(Math.min(1, 0.4 + m.dmg / 50));
    this.shake = Math.min(1, this.shake + 0.25);
    if (m.from) this.hud.damageFrom(m.from[0], m.from[1]);
    if (this.player) { this.player.pitch += 0.02 + Math.random() * 0.02; this.player.yaw += (Math.random() - 0.5) * 0.03; }
    if (m.bleed === 2) this.hud.msg('重出血！止血帯を使え', true);
    else if (m.bleed) this.hud.msg('出血している', true);
    if (m.fracture) this.hud.msg('骨折した！', true);
    if (m.blocked && m.armor) this.hud.msg(`${m.armor} が弾を止めた`);
  }

  // ---------------------------------------------------------------- リモートアクター
  updateActors(dt) {
    const now = performance.now() / 1000;
    const delay = this.net.online ? 0.12 : 0.045;
    const rt = now - delay;
    const P = this.player;
    const tmp = new THREE.Vector3();
    const lightCands = [];
    for (const [id, a] of this.actors) {
      if (!a.view) continue;
      const B = a.buf;
      if (!B.length) { a.view.root.visible = false; continue; }
      // 長時間更新がない＝脱出済み
      if (this.serverTime - a.lastSeen > 3 && !a.dead) { a.view.dispose(); this.audio.stopLoop(id); this.actors.delete(id); continue; }
      a.view.root.visible = true;
      let s0 = B[0], s1 = B[0];
      for (let i = B.length - 1; i >= 0; i--) { if (B[i].t <= rt) { s0 = B[i]; s1 = B[i + 1] || B[i]; break; } }
      const span = s1.t - s0.t;
      const k = span > 0 ? Math.min(1, Math.max(0, (rt - s0.t) / span)) : 1;
      const x = s0.x + (s1.x - s0.x) * k, y = s0.y + (s1.y - s0.y) * k, z = s0.z + (s1.z - s0.z) * k;
      const yaw = s0.yaw + angleDiff(s0.yaw, s1.yaw) * k;
      const pitch = s0.pitch + (s1.pitch - s0.pitch) * k;
      const speed = span > 0 ? Math.hypot(s1.x - s0.x, s1.z - s0.z) / span : 0;
      a.cur = { x, y, z };
      a.flags = s1.f;
      const flags = s1.f;
      a.view.update({ x, y, z, yaw, pitch, flags, speed, lean: 0, armed: a.armed }, dt, this.time);
      // 武器スロット変化 → 見た目は ainfo で更新される
      const dist = P ? Math.hypot(x - P.pos.x, z - P.pos.z) : 999;
      // 足音
      if (a.info.kind !== 'machine' && !(flags & 8) && (flags & 16) && dist < 45) {
        a.stepT += dt * speed * ((flags & 2) ? 0.42 : 0.55);
        if (a.stepT > 1) { a.stepT = 0; this.audio.step({ x, y: y + 0.1, z }, this.surfaceAt({ x, y, z }), (flags & 2) ? 1 : (flags & 1) ? 0.3 : 0.65); }
      }
      // 機械の駆動音
      if (a.info.kind === 'machine') {
        if (!(flags & 8) && dist < 90) this.audio.loop(id, { x, y: y + 0.5, z }, a.info.mtype);
        else if (this.audio.loops.has(id)) this.audio.stopLoop(id);
      }
      if (a.view.lightOn && dist < 80) lightCands.push({ a, dist, yaw, pitch });
    }
    // 他プレイヤーのライト
    lightCands.sort((p, q) => p.dist - q.dist);
    this.remoteLights.forEach((L, i) => {
      const c = lightCands[i];
      if (!c) { L.intensity = 0; return; }
      const v = c.a.view;
      v.weaponMount.getWorldPosition(tmp);
      L.position.copy(tmp);
      const d = dirFromYawPitch(c.yaw, c.pitch);
      L.target.position.set(tmp.x + d.x * 10, tmp.y + d.y * 10, tmp.z + d.z * 10);
      L.intensity = 30;
    });
    // 投擲物
    for (const n of this.nades.values()) {
      const b = n.buf[n.buf.length - 1];
      n.mesh.position.lerp(new THREE.Vector3(b.x, b.y, b.z), Math.min(1, dt * 20));
    }
  }

  surfaceAt(p) {
    if (p.y < 0.05) {
      for (const r of this.map.roads) { const dx = r.x1 - r.x0, dz = r.z1 - r.z0, L2 = dx * dx + dz * dz; let t = ((p.x - r.x0) * dx + (p.z - r.z0) * dz) / L2; t = Math.max(0, Math.min(1, t)); if (Math.hypot(p.x - r.x0 - dx * t, p.z - r.z0 - dz * t) < r.w / 2) return 'concrete'; }
      return 'grass';
    }
    let best = null, by = -1;
    this.world.query(p.x - 0.1, p.z - 0.1, p.x + 0.1, p.z + 0.1, (b) => { if (b.max[1] <= p.y + 0.05 && b.max[1] > by) { by = b.max[1]; best = b; } });
    return best ? SURF[best.mat] || 'concrete' : 'grass';
  }

  // ---------------------------------------------------------------- 地面のアイテム
  addGround(g) {
    if (this.ground.has(g.id)) return;
    const def = ITEMS[g.item];
    if (!def) return;
    let obj;
    if (def.weapon) {
      obj = buildWeapon(g.item);
      obj.rotation.set(0, g.rot, Math.PI / 2);
      obj.position.set(g.x, g.y + 0.04, g.z);
    } else {
      const s = 0.13;
      const w = def.w * s, d = def.h * s, hh = Math.min(0.25, 0.05 + Math.min(def.w, def.h) * 0.05);
      obj = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), [SIDE_MAT, SIDE_MAT, iconMat(def), SIDE_MAT, SIDE_MAT, SIDE_MAT]);
      obj.position.set(g.x, g.y + hh / 2 + 0.005, g.z);
      obj.rotation.y = g.rot;
      obj.castShadow = true;
    }
    this.scene.add(obj);
    this.ground.set(g.id, { ...g, obj, def });
  }
  removeGround(id) {
    const g = this.ground.get(id);
    if (!g) return;
    this.scene.remove(g.obj);
    this.ground.delete(id);
  }
  updateGround() { /* 静止 */ }

  // ---------------------------------------------------------------- インタラクト
  findTarget() {
    const P = this.player;
    if (!P) return null;
    const e = this.camera.position;
    const f = P.aimDir();
    let best = null, bestScore = 1e9;
    const consider = (kind, id, x, y, z, rad, name, extra = {}) => {
      const dx = x - e.x, dy = y - e.y, dz = z - e.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 2.8 || d < 0.01) return;
      const cos = (dx * f.x + dy * f.y + dz * f.z) / d;
      const ang = Math.acos(Math.min(1, cos));
      const lim = Math.atan(rad / d) + 0.1;
      if (ang > lim) return;
      const score = ang / lim + d * 0.15;
      if (score >= bestScore) return;
      // 遮蔽チェック
      const hit = this.world.raycast(e, { x: dx / d, y: dy / d, z: dz / d }, d, { ignoreInvisible: true });
      if (hit && hit.t < d - rad - 0.15 && !(hit.box && (hit.box.container === id || hit.box.door === id))) return;
      bestScore = score;
      best = { kind, id, name, x, y, z, ...extra };
    };
    for (const c of this.map.containers) {
      if (Math.abs(c.x - e.x) > 3 || Math.abs(c.z - e.z) > 3) continue;
      consider('container', c.id, c.x, c.y + (c.type === 'jacket' ? -0.4 : 0.35), c.z, 0.45, CONTAINERS[c.type]?.name || c.type);
    }
    for (const d of Object.values(this.world.doors)) {
      if (Math.abs(d.x - e.x) > 3 || Math.abs(d.z - e.z) > 3) continue;
      consider('door', d.id, d.x, d.y0 + 1.1, d.z, 0.55, d.name || '扉', { locked: d.locked, open: d.open });
    }
    for (const g of this.ground.values()) {
      if (Math.abs(g.x - e.x) > 3 || Math.abs(g.z - e.z) > 3) continue;
      consider('ground', g.id, g.x, g.y + 0.05, g.z, 0.25, g.def.name, { count: g.count, def: g.def });
    }
    for (const a of this.actors.values()) {
      if (!a.dead || !a.cur) continue;
      if (Math.abs(a.cur.x - e.x) > 3.5 || Math.abs(a.cur.z - e.z) > 3.5) continue;
      consider('body', a.id, a.cur.x, a.cur.y + 0.3, a.cur.z, 0.7, a.info.kind === 'machine' ? `${a.info.name}の残骸` : a.info.name);
    }
    for (const s of this.map.switches) consider('switch', s.id, s.x, s.y, s.z, 0.4, s.label);
    for (const ex of this.extracts) if (ex.type === 'pay') consider('extract', ex.id, ex.x, 0.9, ex.z, 1.4, `${ex.name}（${fmt(ex.cost)} C を支払う）`);
    return best;
  }

  updateInteractPrompt() {
    if (!this.player?.alive || this.rinv.open) { this.hud.setPrompt(null); this.target = null; return; }
    if (this.time - (this._tgtT || 0) > 0.08) { this._tgtT = this.time; this.target = this.findTarget(); }
    const t = this.target;
    if (!t) { this.hud.setPrompt(null); return; }
    let name = t.name, sub = '';
    if (t.kind === 'container') name = `${t.name} を漁る`;
    else if (t.kind === 'door') { name = t.open ? `${t.name} を閉める` : `${t.name} を開ける`; if (t.locked) sub = '🔒 施錠されている（対応する鍵が必要）'; }
    else if (t.kind === 'ground') { name = `${t.def.name}${t.count > 1 ? ' ×' + t.count : ''} を拾う`; sub = `${t.def.w}×${t.def.h}`; }
    else if (t.kind === 'body') name = `${t.name} を調べる`;
    this.hud.setPrompt({ key: 'F', name, sub });
  }

  interact() {
    const t = this.target;
    if (!t) return;
    this.net.send({ t: 'interact', kind: t.kind, id: t.id });
    if (t.kind === 'container' || t.kind === 'body') { this.lootPos = { x: t.x, z: t.z }; this.audio.loot(t); }
  }

  openLoot(m) {
    this.loot = { root: m.root, kind: m.kind, name: m.name, inv: m.inv };
    if (!this.rinv.open) this.toggleInv(true);
    else this.rinv.refresh();
  }
  closeLoot() {
    if (!this.loot) return;
    this.net.send({ t: 'closeLoot' });
    this.loot = null;
    this.rinv.refresh();
  }

  toggleInv(force) {
    const open = force ?? !this.rinv.open;
    if (open) {
      this.rinv.show(true);
      this.input.unlock();
      this.root.style.cursor = 'default';
    } else {
      this.rinv.show(false);
      this.closeLoot();
      this.root.style.cursor = '';
      this.input.lock();
    }
  }

  toggleMap() {
    if (this.mapOpen) { this.mapOpen.remove(); this.mapOpen = null; this.input.lock(); return; }
    const cv = h('canvas', { width: Math.min(innerWidth, innerHeight) * 0.9, height: Math.min(innerWidth, innerHeight) * 0.9, style: { border: '1px solid #444', boxShadow: '0 0 40px #000' } });
    this.mapOpen = h('div', { class: 'pause' }, h('div', { class: 'col', style: { alignItems: 'center' } }, cv, h('div', { class: 'mini' }, IS_TOUCH ? 'タップで閉じる ・ 黄色の矢印が現在地' : 'M で閉じる ・ 黄色の矢印が現在地')));
    this.mapOpen.addEventListener('click', () => { if (this.mapOpen) { this.mapOpen.remove(); this.mapOpen = null; this.input.lock(); } });
    this.root.append(this.mapOpen);
    drawMapPreview(cv, { player: { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw }, extracts: this.extracts, hotspots: mapHotspots() });
    this.input.unlock();
    const onKey = (e) => { if (e.code === 'KeyM' || e.code === 'Escape') { removeEventListener('keydown', onKey); if (this.mapOpen) { this.mapOpen.remove(); this.mapOpen = null; this.input.lock(); } } };
    setTimeout(() => addEventListener('keydown', onKey), 0);
  }

  showPause() {
    if (this.pauseEl || this.ended) return;
    const S = this.settings;
    const slider = (label, key, min, max, step, onChange) => {
      const val = h('span', { class: 'num' }, String(S[key]));
      return h('div', { class: 'slider-row' }, label, h('input', { type: 'range', min, max, step, value: S[key], oninput: (e) => { S[key] = parseFloat(e.target.value); val.textContent = S[key]; onChange?.(S[key]); } }), val);
    };
    this.pauseEl = h('div', { class: 'pause' }, h('div', { class: 'panel box' },
      h('div', { class: 'panel-h' }, '一時停止', h('span', { class: 'sub' }, this.net.online ? '※オンラインではゲームは止まりません' : 'オフライン：レイドは停止中')),
      h('div', { class: 'panel-b' },
        IS_TOUCH ? slider('タッチ感度', 'touchSens', 0.2, 3, 0.05) : slider('マウス感度', 'sens', 0.2, 3, 0.05),
        slider('ADS 感度倍率', 'adsSensMul', 0.3, 1.5, 0.05),
        slider('視野角 (FOV)', 'fov', 60, 100, 1),
        slider('音量', 'volume', 0, 1, 0.05, (v) => this.audio.setVolume(v)),
        slider('自分の足音', 'footsteps', 0, 1, 0.05),
        h('div', { class: 'slider-row' }, 'エイムアシスト', h('select', { onchange: (e) => { S.aimAssist = +e.target.value; } }, ['なし', '弱', '標準', '強'].map((t, i) => h('option', { value: i, selected: (S.aimAssist ?? 0) === i }, t))), h('span')),
        h('label', { class: 'row mini', style: { margin: '6px 0' } }, h('input', { type: 'checkbox', checked: !!S.autoFire, onchange: (e) => { S.autoFire = e.target.checked; } }), 'オートファイア（照準が敵に重なると自動で撃つ）'),
        h('label', { class: 'row mini', style: { margin: '6px 0' } }, h('input', { type: 'checkbox', checked: !!S.showFps, onchange: (e) => { S.showFps = e.target.checked; } }), 'FPS を表示'),
        h('div', { class: 'sep' }),
        IS_TOUCH ? null : helpKeys(),
        h('div', { class: 'sep' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => this.closePause() }, '再開'),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn danger', onclick: () => { modal('レイドを放棄', h('div', {}, '放棄すると死亡扱いになり、持ち込んだ装備を失います（セキュアコンテナを除く）。'), [{ text: 'キャンセル' }, { text: '放棄する', cls: 'danger', fn: () => this.abandon() }]); } }, 'レイドを放棄')),
      )));
    this.root.append(this.pauseEl);
    if (!this.net.online) this.net.paused = true;
  }
  closePause() { this.pauseEl?.remove(); this.pauseEl = null; this.net.paused = false; this.input.lock(); }
  abandon() {
    this.closePause();
    const sec = this.inv?.equip?.secure || null;
    this.finish({ survived: false, killer: 'レイド放棄', secure: sec, stats: {} });
  }

  // ---------------------------------------------------------------- アイテム使用
  quickItems() {
    if (!this.inv) return [];
    const out = [];
    const grids = [];
    if (this.inv.equip.rig?.grids) grids.push(...this.inv.equip.rig.grids);
    grids.push(this.inv.pockets);
    for (const g of grids) for (const it of g.items) { const c = ITEMS[it.id].cat; if (c === 'med' || c === 'food' || c === 'grenade') out.push(it); }
    return out.slice(0, 6);
  }
  updateHotbar() { const q = this.quickItems(); while (q.length < 6) q.push(null); this.hud.hotbar(q, this.preferredNade); }
  useQuick(i) {
    const it = this.quickItems()[i];
    if (!it) return;
    if (ITEMS[it.id].cat === 'grenade') { this.preferredNade = it.uid; this.updateHotbar(); this.player.throwGrenade(); return; }
    this.useItem(it.uid);
  }
  useItem(uid) {
    if (this.selfState?.use) return;
    this.net.send({ t: 'use', uid });
  }
  autoHeal() {
    const S = this.selfState;
    if (!S || !this.inv) return;
    const meds = allItems(this.inv).filter((i) => ITEMS[i.id].cat === 'med');
    const need = (f) => meds.find((it) => f(ITEMS[it.id].med));
    let pick = null;
    const bl = Object.values(S.bleed || {});
    if (bl.includes(2)) pick = need((m) => m.heavy);
    if (!pick && bl.includes(1)) pick = need((m) => m.bleed);
    if (!pick && Object.keys(S.frac || {}).length) pick = need((m) => m.fracture);
    if (!pick && Object.keys(S.dest || {}).length) pick = need((m) => m.restore);
    let tot = 0; for (const p of PARTS) tot += S.hp[p];
    if (!pick && tot < 420) pick = need((m) => m.heal > 0);
    if (!pick && S.hy < 50) pick = allItems(this.inv).find((i) => (ITEMS[i.id].med?.hydration || 0) > 20);
    if (!pick && S.en < 50) pick = allItems(this.inv).find((i) => (ITEMS[i.id].med?.energy || 0) > 20);
    if (pick) { this.useItem(pick.uid); this.hud.msg(`${ITEMS[pick.id].name} を使用`); }
    else this.hud.msg('使える医薬品がない', true);
  }
  reserveAmmo(cal) {
    if (!this.inv) return 0;
    return Object.values(countAmmo(this.inv, cal)).reduce((a, b) => a + b, 0);
  }

  onLocalShot(w, def, st, dir) {
    this.pendingShots++;
    const ml = this.vm.muzzleLocal(new THREE.Vector3());
    const from = this.camera.localToWorld(ml.clone());
    const d = new THREE.Vector3(dir.x, dir.y, dir.z);
    this.effects.muzzle(from, d, { suppressed: st.suppressed, big: def.weapon.class === 'lmg' || def.weapon.class === 'shotgun' || def.weapon.class === 'sniper', color: def.weapon.caliber === 'arc' ? def.color : undefined });
    this.audio.gunshot(null, soundKind({ cal: def.weapon.caliber, cls: def.weapon.class }), st.suppressed, true);
    this.vm.fire(Math.min(1.6, 0.5 + st.recoilV * 0.4));
    this.shake = Math.min(0.5, this.shake + st.recoilV * 0.05);
    if (def.weapon.bolt || def.weapon.pump) setTimeout(() => this.audio.bolt(), 120);
    // 薬莢
    if (def.weapon.caliber !== 'arc' && !def.weapon.bolt) {
      const ej = this.camera.localToWorld(this.vm.ejectLocal(new THREE.Vector3()));
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const c = right.multiplyScalar(1.5 + Math.random()).add(new THREE.Vector3(0, 1.8, 0));
      this.effects.casing(ej, c);
      this.effects.casings[this.effects.casings.length - 1].floor = this.player.pos.y + 0.02;
    }
  }

  buildExtractBeams() {
    this.extractBeams.clear();
    for (const e of this.extracts) {
      if (!e.open && e.type !== 'pay' && e.type !== 'key') continue;
      const col = e.type === 'random' ? '#ff4030' : '#60ff70';
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 70, 12, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(e.x, 35, e.z);
      this.extractBeams.add(m);
      const ring = new THREE.Mesh(new THREE.RingGeometry(e.r - 0.15, e.r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.set(e.x, this.world.groundAt(e.x, e.z, 3) + 0.06, e.z);
      this.extractBeams.add(ring);
    }
  }

  // ---------------------------------------------------------------- 終了
  onDied(m) {
    if (this.ended) return;
    this.player.alive = false;
    this.hud.msg(m.mia ? '時間切れ…レイドから脱出できなかった' : `死亡 — ${m.killer}`, true);
    this.vm.root.visible = false;
    // 倒れる演出
    const startY = this.player.pos.y;
    let t = 0;
    const fall = () => {
      t += 0.016;
      this.player.pitch = Math.max(-0.6, this.player.pitch - 0.02);
      this.player.pos.y = Math.max(startY - 1.2, startY - t * 3);
      if (t < 0.5) requestAnimationFrame(fall);
    };
    fall();
    this.canvas.style.transition = 'filter 2.5s';
    this.canvas.style.filter = 'grayscale(1) brightness(.4)';
    setTimeout(() => this.finish({ survived: false, mia: !!m.mia, killer: m.killer, weapon: m.weapon, zone: m.zone, secure: m.secure, stats: m.stats, health: m.health }), 2800);
  }
  onExtracted(m) {
    if (this.ended) return;
    this.hud.msg(`${m.ex} から脱出した！`);
    this.audio.heli?.({ x: this.player.pos.x, y: 5, z: this.player.pos.z });
    this.canvas.style.transition = 'filter 1.5s';
    this.canvas.style.filter = 'brightness(2.5)';
    setTimeout(() => this.finish({ survived: true, inv: m.inv, stats: m.stats, exName: m.ex, exId: m.exId, health: m.health }), 1500);
  }
  finish(res) {
    if (this.ended) return;
    this.ended = true;
    this.input.unlock();
    setTimeout(() => { this.dispose(); this.onEnd(res); }, 50);
  }

  dispose() {
    this.running = false;
    removeEventListener('resize', this.onResize);
    try { this.net?.close(); } catch { /* noop */ }
    this.input?.dispose();
    this.audio?.dispose();
    this.rinv?.dispose();
    this.touch?.dispose();
    this.hud?.dispose();
    try { this.renderer?.dispose(); this.renderer?.forceContextLoss(); } catch { /* noop */ }
    this.root.remove();
  }
}

const SIDE_MAT = new THREE.MeshStandardMaterial({ color: '#3a3e40', roughness: 0.8 });
const THERMAL_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const iconMats = {};
function iconMat(def) {
  if (iconMats[def.id]) return iconMats[def.id];
  const tex = new THREE.TextureLoader().load(getItemIcon(def));
  tex.colorSpace = THREE.SRGBColorSpace;
  iconMats[def.id] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, color: '#ffffff', emissive: '#222', emissiveMap: tex, emissiveIntensity: 0.4 });
  // 背景色（透明部分）を補う
  iconMats[def.id].onBeforeCompile = () => {};
  return iconMats[def.id];
}

function soundKind(ev) {
  if (ev.cal === 'arc') return 'energy';
  if (ev.cal === '9x39') return 'subsonic';
  if (ev.cls === 'shotgun') return 'shotgun';
  if (ev.cls === 'sniper') return 'sniper';
  if (ev.cal === '762x51' || ev.cal === '762x54r') return 'heavy';
  if (ev.cls === 'pistol') return 'pistol';
  if (ev.cls === 'smg') return 'smg';
  return 'rifle';
}
function distPointSeg(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const L2 = abx * abx + aby * aby + abz * abz || 1;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y, a.z + abz * t - p.z);
}
function frame() { return new Promise((r) => requestAnimationFrame(() => r())); }
const r3 = (v) => Math.round(v * 1000) / 1000;
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const TIPS = [
  'セキュアコンテナに入れたアイテムは死亡しても失われない。貴重品はここへ。',
  'ARC 機械は装甲が硬い。貫通力の高い弾か、EMP グレネードが有効だ。',
  'センチネルの弱点は背中の青く光るコアだ。',
  '足音は敵にも聞こえる。しゃがむと静かに移動できる。',
  '出血したら包帯や止血帯ですぐに止めよう。放置すると死ぬ。',
  'レイド内で拾ったアイテムには ✔ が付く。タスクの納品に必要だ。',
  '工場の制御室でスイッチを入れると、裏ゲートの脱出口が開く。',
  'ガソリンスタンドの車は 5,000 C 払えば脱出させてくれる。',
  '夜のレイドはライト（T キー）が必須。ただし敵にも見つかりやすくなる。',
  'ボルトアクションのスナイパーは、1 発で勝負が決まる。',
  'ハイドアウトでは拾ったガラクタから弾薬や医薬品を作れる。',
  '金庫と施錠された部屋は高価な物の宝庫。メニューの「ヒント」でマップ上の場所を確認できる。',
  '1 マス当たりの価値が高い宝石・金貨・GPU を優先して持ち帰ろう。',
  '研究所のレッド区画には金庫と研究用ケースが並ぶ。レッドキーカードが必要。',
  '司令官グロムを倒すと武器庫の鍵が手に入る。',
  'ARC 機械の残骸には数十万 C のパーツが入っていることがある。',
];
function randomTip() { return 'TIP: ' + TIPS[Math.floor(Math.random() * TIPS.length)]; }
void listGrids; void MACHINES;

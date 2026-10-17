// ローカルプレイヤーの操作・移動・射撃
import { ITEMS, weaponStats } from '../../shared/items.js';
import { rootWeight, allItems, countAmmo } from '../../shared/inventory.js';
import { dirFromYawPitch, clamp } from '../../shared/math.js';

export class LocalPlayer {
  constructor(game, pos, yaw) {
    this.g = game;
    this.pos = { x: pos.x, y: pos.y, z: pos.z };
    this.yaw = yaw; this.pitch = 0;
    this.vel = { x: 0, z: 0 };
    this.phys = { vy: 0, onGround: true };
    this.crouch = false; this.crouchK = 0;
    this.sprint = false; this.stamina = 100; this.staminaDelay = 0;
    this.lean = 0; this.leanTarget = 0;
    this.ads = false;
    this.slot = 'primary';
    this.recoilP = 0; this.recoilY = 0;
    this.lastShot = 0; this.burstLeft = 0; this.triggerHeld = false; this.semiReady = true;
    this.bobT = 0; this.stepT = 0;
    this.light = false;
    this.alive = true;
    this.swapUntil = 0;
    this.throwUntil = 0;
    this.moving = false;
    this.speed = 0;
    this.fallStartY = pos.y;
    this.zoomIdx = 0;
  }

  get inv() { return this.g.inv; }
  weapon() { return this.inv?.equip?.[this.slot] || null; }
  eye() { return { x: this.pos.x + this.leanOffset().x, y: this.pos.y + (1.62 - this.crouchK * 0.6), z: this.pos.z + this.leanOffset().z }; }
  leanOffset() {
    const r = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    const k = this.lean * 0.38;
    return { x: r.x * k, z: r.z * k };
  }

  weightFactor() {
    const w = rootWeight(this.inv);
    let speedPen = 0;
    for (const s of ['armor', 'helmet', 'rig', 'backpack']) {
      const it = this.inv.equip[s];
      if (!it) continue;
      const d = ITEMS[it.id];
      speedPen += d.armor?.speed || d.speed || 0;
    }
    const over = Math.max(0, w - 22);
    return { f: Math.max(0.45, 1 - over / 60 - speedPen), w };
  }

  update(dt, input) {
    const g = this.g;
    if (!this.alive) return;
    const self = g.selfState || {};
    // 視点
    const sens = g.settings.sens * 0.0022 * (this.ads ? g.settings.adsSensMul * (1 / Math.max(1, g.currentZoom * 0.55)) : 1);
    this.yaw -= input.mdx * sens;
    this.pitch -= input.mdy * sens * (g.settings.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.5, 1.5);
    // しゃがみ・リーン
    if (input.pressed('KeyC') || input.pressed('ControlLeft')) this.crouch = !this.crouch;
    this.leanTarget = input.down('KeyQ') ? -1 : input.down('KeyE') ? 1 : 0;
    // リーンの壁チェック
    if (this.leanTarget) {
      const r = { x: Math.cos(this.yaw) * this.leanTarget, y: 0, z: -Math.sin(this.yaw) * this.leanTarget };
      const e = { x: this.pos.x, y: this.pos.y + 1.5 - this.crouchK * 0.6, z: this.pos.z };
      const hit = g.world.raycast(e, r, 0.6);
      if (hit) this.leanTarget *= Math.max(0, (hit.t - 0.2) / 0.4);
    }
    this.lean += (this.leanTarget - this.lean) * Math.min(1, dt * 9);
    this.crouchK += ((this.crouch ? 1 : 0) - this.crouchK) * Math.min(1, dt * 10);
    // 移動入力
    let fx = 0, fz = 0;
    if (input.down('KeyW')) fz -= 1;
    if (input.down('KeyS')) fz += 1;
    if (input.down('KeyA')) fx -= 1;
    if (input.down('KeyD')) fx += 1;
    if (input.moveX || input.moveY) { fx = input.moveX; fz = input.moveY; }
    const using = !!self.use;
    const fracLeg = self.frac && (self.frac.legL || self.frac.legR) && !(self.pain > 0);
    const wantSprint = input.down('ShiftLeft') && fz < 0 && !using && this.stamina > 3 && !fracLeg;
    this.sprint = wantSprint && (this.sprint || this.stamina > 15);
    if (this.sprint) { this.crouch = false; this.ads = false; }
    const { f: wf } = this.weightFactor();
    let speed = this.sprint ? 6.2 : 3.7;
    if (this.crouchK > 0.5) speed = 1.9;
    if (this.ads) speed = Math.min(speed, 2.4);
    if (using) speed = Math.min(speed, 1.6);
    if (fracLeg) speed *= 0.6;
    speed *= wf;
    if (g.stimSpeed) speed *= 1 + g.stimSpeed;
    const len = Math.hypot(fx, fz);
    let tx = 0, tz = 0;
    if (len > 0) {
      // キーボードは正規化、アナログスティックは倒し具合（最低 50%）で速度が変わる
      const m = len > 1 ? 1 : Math.max(0.5, len);
      fx *= m / len; fz *= m / len;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      tx = (fx * c + fz * s) * speed;
      tz = (-fx * s + fz * c) * speed;
    }
    const acc = this.phys.onGround ? 12 : 2;
    this.vel.x += (tx - this.vel.x) * Math.min(1, dt * acc);
    this.vel.z += (tz - this.vel.z) * Math.min(1, dt * acc);
    // ジャンプ
    if (input.pressed('Space') && this.phys.onGround && this.stamina > 10 && this.crouchK < 0.5) { this.phys.vy = 5.0; this.phys.onGround = false; this.stamina -= 10; this.fallStartY = this.pos.y; }
    const wasGround = this.phys.onGround;
    g.world.moveCharacter(this.pos, this.vel.x * dt, this.vel.z * dt, dt, this.phys, 0.33, this.crouchK > 0.5 ? 1.25 : 1.8, 0.45);
    if (!wasGround && this.phys.onGround) { g.audio.land(Math.min(1, (g.settings.footsteps ?? 0.3) * 1.6)); g.vm.kick += 0.4; const fall = this.fallStartY - this.pos.y; if (fall > 3.5) g.toastMsg('高所から落下した', true); }
    if (wasGround && !this.phys.onGround) this.fallStartY = this.pos.y;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.moving = this.speed > 0.3;
    // スタミナ
    const stimSt = g.stimStamina || 1;
    if (this.sprint && this.moving) { this.stamina = Math.max(0, this.stamina - dt * 8.5); this.staminaDelay = 1.2; }
    else { this.staminaDelay -= dt; if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + dt * 11 * stimSt * (this.crouch ? 1.2 : 1)); }
    // 足音
    if (this.moving && this.phys.onGround) {
      this.stepT += dt * this.speed * (this.sprint ? 0.42 : 0.55);
      if (this.stepT > 1) { this.stepT = 0; g.audio.step(null, g.surfaceAt(this.pos), (this.sprint ? 0.9 : this.crouch ? 0.25 : 0.55) * (g.settings.footsteps ?? 0.3), true); }
    }
    // 武器切替
    for (const [code, slot] of [['Digit1', 'primary'], ['Digit2', 'secondary'], ['Digit3', 'holster']]) {
      if (input.pressed(code) && slot !== this.slot && this.inv.equip[slot]) this.switchSlot(slot);
    }
    if (input.wheel && !this.ads) {
      const order = ['primary', 'secondary', 'holster'].filter((s) => this.inv.equip[s]);
      const i = order.indexOf(this.slot);
      if (order.length > 1) this.switchSlot(order[(i + (input.wheel > 0 ? 1 : order.length - 1)) % order.length]);
    }
    if (!this.weapon()) {
      const any = ['primary', 'secondary', 'holster'].find((s) => this.inv.equip[s]);
      if (any && any !== this.slot) this.switchSlot(any);
    }
    // ADS
    const w = this.weapon();
    this.ads = input.mouse[2] && !!w && !this.sprint && !using && g.time > this.swapUntil;
    // 倍率切り替え（可変スコープ）
    if (input.pressed('KeyV')) this.zoomIdx = (this.zoomIdx + 1) % 2;
    // ライト
    if (input.pressed('KeyT')) { this.light = !this.light; g.audio.click(null, 2500, 0.2); }
    // 射撃モード
    if (input.pressed('KeyB') && w) { g.net.send({ t: 'mode' }); g.audio.click(null, 2000, 0.25); }
    // リロード
    if (input.pressed('KeyR') && w && !self.reload) this.tryReload();
    // 射撃
    this.handleFire(dt, input, w, using);
    // 反動の回復
    this.recoilP *= Math.pow(0.02, dt);
    this.recoilY *= Math.pow(0.02, dt);
  }

  switchSlot(slot) {
    this.slot = slot;
    this.swapUntil = this.g.time + 0.5;
    this.g.vm.setWeapon(this.inv.equip[slot]);
    this.g.audio.click(null, 1800, 0.2);
    this.g.sendState(true);
  }

  tryReload() {
    const w = this.weapon();
    if (!w) return;
    const def = ITEMS[w.id];
    const avail = countAmmo(this.inv, def.weapon.caliber);
    if (!Object.keys(avail).length) { this.g.toastMsg('予備弾薬がない', true); return; }
    const cap = weaponStats(w).capacity;
    const mag = this.g.selfState?.mag;
    if (mag && mag[0] >= cap) return;
    this.g.net.send({ t: 'reload' });
  }

  handleFire(dt, input, w, using) {
    const g = this.g;
    if (!input.mouse[0]) { this.semiReady = true; this.burstLeft = 0; }
    if (!w || this.sprint || g.time < this.swapUntil || g.selfState?.reload || g.invOpen || g.time < this.throwUntil) return;
    const def = ITEMS[w.id], st = weaponStats(w);
    const mode = def.weapon.modes[(g.selfState?.mode || 0) % def.weapon.modes.length];
    const interval = 60 / st.rpm;
    let want = false;
    if (mode === 'auto') want = input.mouse[0];
    else if (mode === 'burst') {
      if (input.mouse[0] && this.semiReady) { this.burstLeft = 3; this.semiReady = false; }
      want = this.burstLeft > 0;
    } else if (input.mouse[0] && this.semiReady) { want = true; }
    if (!want || g.time - this.lastShot < interval) return;
    const mag = g.selfState?.mag;
    const count = mag ? mag[0] - (g.pendingShots || 0) : w.mag?.count ?? 0;
    if (count <= 0) {
      if (this.semiReady || mode === 'auto') { g.audio.dry(); this.semiReady = false; if (g.settings.autoReload !== false) this.tryReload(); }
      this.burstLeft = 0;
      return;
    }
    if (using) g.net.send({ t: 'cancelUse' });
    this.lastShot = g.time;
    if (mode !== 'auto') this.semiReady = false;
    if (this.burstLeft > 0) this.burstLeft--;
    // 弾道方向
    const e = g.camera.position;
    const spreadDeg = (this.ads ? st.spread : st.hipSpread) * (this.moving ? 1.6 : 1) * (this.phys.onGround ? 1 : 3) * (this.crouch ? 0.8 : 1);
    const sp = spreadDeg * Math.PI / 180;
    const aimYaw = this.yaw + this.recoilY, aimPitch = this.pitch + this.recoilP;
    const r = Math.sqrt(Math.random()) * sp, a = Math.random() * Math.PI * 2;
    const d = dirFromYawPitch(aimYaw + Math.cos(a) * r, aimPitch + Math.sin(a) * r);
    g.net.send({ t: 'fire', o: [e.x, e.y, e.z], d: [d.x, d.y, d.z] });
    g.onLocalShot(w, def, st, d);
    // 反動
    const ergoK = 1.2 - st.ergo / 200;
    const kv = st.recoilV * 0.012 * (this.ads ? 0.8 : 1) * (this.crouch ? 0.85 : 1);
    const kh = (Math.random() - 0.5) * st.recoilH * 0.012 * 2;
    this.pitch += kv * 0.55; // 永続的な跳ね上がり
    this.recoilP += kv * 0.9 * ergoK;
    this.yaw += kh * 0.4;
    this.recoilY += kh * 0.6;
  }

  aimDir() { return dirFromYawPitch(this.yaw + this.recoilY, this.pitch + this.recoilP); }

  // 投擲物
  throwGrenade() {
    const g = this.g;
    const nades = allItems(this.inv).filter((i) => ITEMS[i.id].cat === 'grenade');
    if (!nades.length) { g.toastMsg('投擲物を持っていない', true); return; }
    const it = g.preferredNade && nades.find((n) => n.uid === g.preferredNade) || nades.find((n) => ITEMS[n.id].grenade.type === 'frag') || nades[0];
    this.throwUntil = g.time + 0.8;
    g.vm.startThrow();
    setTimeout(() => {
      if (!this.alive) return;
      const e = g.camera.position;
      const d = this.aimDir();
      g.net.send({ t: 'throw', uid: it.uid, o: [e.x + d.x * 0.4, e.y + d.y * 0.4, e.z + d.z * 0.4], d: [d.x, d.y + 0.12, d.z], power: this.sprint ? 19 : 15 });
    }, 380);
  }
}

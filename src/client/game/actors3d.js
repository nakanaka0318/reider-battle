// 人物・ARC 機械の 3D モデルと手続き的アニメーション
import * as THREE from 'three';
import { ITEMS } from '../../shared/items.js';
import { buildWeapon } from './weapons3d.js';

const mats = {};
function mat(color, rough = 0.85, metal = 0, emissive = null, ei = 1) {
  const k = [color, rough, metal, emissive, ei].join();
  if (!mats[k]) {
    mats[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (emissive) { mats[k].emissive = new THREE.Color(emissive); mats[k].emissiveIntensity = ei; }
  }
  return mats[k];
}
const geoCache = {};
function bgeo(w, h, d) { const k = `b${w},${h},${d}`; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); }
function mesh(parent, geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true; o.receiveShadow = true;
  parent.add(o);
  return o;
}
function limb(parent, w, len, d, m, x, y, z) {
  // 上端を原点とする四肢
  const g = new THREE.Group();
  g.position.set(x, y, z);
  mesh(g, bgeo(w, len, d), m, 0, -len / 2, 0);
  parent.add(g);
  return g;
}

const OUTFITS = {
  scav: [['#3a4a6a', '#2a2a30'], ['#4a4a4a', '#30343a'], ['#5a4a3a', '#2a2e2a'], ['#2a3a2a', '#3a3a3a'], ['#6a2a2a', '#2a2a2a'], ['#3a5a5a', '#252525']],
  raider: [['#4a5236', '#3e4430'], ['#6a604a', '#4a4436'], ['#2a2c2e', '#232526'], ['#4a4f3a', '#38402c'], ['#5c5a52', '#3a3a36']],
  player: [['#3e4a3a', '#2e3a2e']],
  boss: [['#2e3a24', '#22281c']],
  guard: [['#1e2022', '#1a1a1c']],
};
const SKINS = ['#c8a080', '#b08060', '#d8b090', '#8a6040', '#e0c0a0'];

export class HumanView {
  constructor(info, scene, isLocalBody = false) {
    this.info = info;
    this.scene = scene;
    const hash = [...info.id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
    const kind = info.kind === 'player' ? 'raider' : info.kind;
    const outfits = OUTFITS[kind] || OUTFITS.raider;
    const [top, bottom] = outfits[hash % outfits.length];
    const skin = SKINS[hash % SKINS.length];
    const mTop = mat(top), mBot = mat(bottom), mSkin = mat(skin, 0.7), mBoot = mat('#1a1814', 0.9);
    this.root = new THREE.Group();
    const R = this.root;
    this.hips = new THREE.Group(); this.hips.position.y = 0.95; R.add(this.hips);
    mesh(this.hips, bgeo(0.34, 0.18, 0.2), mBot, 0, 0, 0);
    this.legL = limb(this.hips, 0.14, 0.45, 0.16, mBot, -0.1, -0.05, 0);
    this.legR = limb(this.hips, 0.14, 0.45, 0.16, mBot, 0.1, -0.05, 0);
    this.kneeL = limb(this.legL, 0.12, 0.45, 0.13, mBot, 0, -0.45, 0);
    this.kneeR = limb(this.legR, 0.12, 0.45, 0.13, mBot, 0, -0.45, 0);
    mesh(this.kneeL, bgeo(0.13, 0.08, 0.26), mBoot, 0, -0.44, -0.05);
    mesh(this.kneeR, bgeo(0.13, 0.08, 0.26), mBoot, 0, -0.44, -0.05);
    this.spine = new THREE.Group(); this.spine.position.y = 0.06; this.hips.add(this.spine);
    this.torso = mesh(this.spine, bgeo(0.4, 0.52, 0.22), mTop, 0, 0.28, 0);
    this.neck = new THREE.Group(); this.neck.position.y = 0.58; this.spine.add(this.neck);
    this.head = mesh(this.neck, bgeo(0.2, 0.24, 0.22), mSkin, 0, 0.12, 0);
    // 目元
    mesh(this.neck, bgeo(0.16, 0.03, 0.01), mat('#111'), 0, 0.15, -0.111);
    this.armR = limb(this.spine, 0.11, 0.3, 0.12, mTop, 0.25, 0.5, 0);
    this.armL = limb(this.spine, 0.11, 0.3, 0.12, mTop, -0.25, 0.5, 0);
    this.foreR = limb(this.armR, 0.09, 0.28, 0.1, mTop, 0, -0.3, 0);
    this.foreL = limb(this.armL, 0.09, 0.28, 0.1, mTop, 0, -0.3, 0);
    mesh(this.foreR, bgeo(0.08, 0.09, 0.09), mSkin, 0, -0.31, 0);
    mesh(this.foreL, bgeo(0.08, 0.09, 0.09), mSkin, 0, -0.31, 0);
    this.gear = new THREE.Group(); this.spine.add(this.gear);
    this.headGear = new THREE.Group(); this.neck.add(this.headGear);
    this.weaponMount = new THREE.Group(); this.weaponMount.position.set(0.12, 0.42, -0.22); this.spine.add(this.weaponMount);
    this.walk = Math.random() * 6;
    this.dead = false; this.deadT = 0;
    this.light = null;
    this.setGear(info);
    if (isLocalBody) R.visible = false;
    scene.add(R);
  }

  setGear(info) {
    this.info = info;
    this.gear.clear(); this.headGear.clear(); this.weaponMount.clear(); this.lightBulb = null;
    for (const p of this.armPads || []) p.parent?.remove(p);
    this.armPads = [];
    const g = this.gear;
    if (info.armor || ITEMS[info.rig]?.armor) {
      const d = ITEMS[info.armor || info.rig];
      const c = mat(d.color || '#4a4f3a', 0.9);
      mesh(g, bgeo(0.44, 0.42, 0.28), c, 0, 0.3, 0);
      if (d.armor.zones.includes('armL')) this.armPads.push(mesh(this.armL, bgeo(0.14, 0.16, 0.15), c, 0, -0.08, 0), mesh(this.armR, bgeo(0.14, 0.16, 0.15), c, 0, -0.08, 0));
    }
    if (info.rig) {
      const d = ITEMS[info.rig];
      const c = mat(d.color || '#4a4f3a', 0.9);
      for (let i = -1; i <= 1; i++) mesh(g, bgeo(0.1, 0.13, 0.08), c, i * 0.12, 0.2, -0.17);
    }
    if (info.backpack) {
      const d = ITEMS[info.backpack];
      const s = Math.min(1.4, 0.6 + d.grids[0][0] * d.grids[0][1] / 50);
      const c = mat(d.color || '#4a4f3a', 0.95);
      mesh(g, bgeo(0.36 * s, 0.46 * s, 0.22 * s), c, 0, 0.28 + 0.05 * s, 0.11 + 0.11 * s);
      mesh(g, bgeo(0.3 * s, 0.14, 0.06), mat('#222'), 0, 0.15, 0.24 + 0.11 * s);
    }
    if (info.helmet) {
      const d = ITEMS[info.helmet];
      const c = mat(d.color || '#4a5040', 0.7, 0.1);
      mesh(this.headGear, bgeo(0.25, 0.13, 0.27), c, 0, 0.25, 0.01);
      if (d.armor.face) mesh(this.headGear, bgeo(0.22, 0.16, 0.03), mat('#2a3030', 0.3, 0.6), 0, 0.12, -0.125);
    } else if (this.info.kind === 'boss') {
      mesh(this.headGear, bgeo(0.24, 0.06, 0.26), mat('#8a1a1a'), 0.02, 0.255, 0);
    } else if (this.info.kind === 'scav' && (this.info.id.charCodeAt(this.info.id.length - 1) % 3 === 0)) {
      mesh(this.headGear, bgeo(0.22, 0.1, 0.24), mat('#2a2a2a'), 0, 0.24, 0); // ニット帽
    }
    if (info.weapon && ITEMS[info.weapon]) {
      this.weapon = buildWeapon(info.weapon, { mods: info.mods || {} });
      this.weapon.scale.setScalar(1.1);
      this.weaponMount.add(this.weapon);
      const pistol = ITEMS[info.weapon].weapon.class === 'pistol';
      this.weaponMount.position.set(pistol ? 0.05 : 0.12, pistol ? 0.4 : 0.42, pistol ? -0.4 : -0.2);
    } else this.weapon = null;
  }

  // st: { x,y,z,yaw,pitch,flags,speed }
  update(st, dt, time) {
    const R = this.root;
    const crouch = st.flags & 1, sprint = st.flags & 2, dead = st.flags & 8, moving = st.flags & 16, reloading = st.flags & 64, using = st.flags & 128;
    R.position.set(st.x, st.y, st.z);
    if (dead) {
      if (!this.dead) { this.dead = true; this.deadT = 0; this.fallDir = Math.random() < 0.5 ? 1 : -1; }
      this.deadT = Math.min(1, this.deadT + dt * 2.2);
      const t = easeOut(this.deadT);
      R.rotation.set(-t * Math.PI / 2 * 0.98, st.yaw, 0, 'YXZ');
      R.position.y = st.y + 0.12 * t;
      this.hips.position.y = 0.95 - 0.1 * t;
      this.armL.rotation.set(-2.6 * t, 0, -0.4 * t); this.armR.rotation.set(-2.4 * t, 0, 0.5 * t);
      this.legL.rotation.x = 0.2 * t; this.legR.rotation.x = -0.15 * t;
      this.kneeL.rotation.x = 0.3 * t; this.kneeR.rotation.x = 0.1 * t;
      this.spine.rotation.set(0, 0, 0);
      if (this.weapon) this.weaponMount.visible = false;
      this.lightOn = false;
      return;
    }
    R.rotation.set(0, st.yaw, 0);
    const spd = st.speed || 0;
    const rate = sprint ? 11 : crouch ? 5 : 7.5;
    if (moving && spd > 0.2) this.walk += dt * rate * Math.min(1.4, 0.4 + spd / 3);
    const amp = moving && spd > 0.2 ? (sprint ? 0.75 : crouch ? 0.35 : 0.5) : 0;
    this.amp = (this.amp || 0) + (amp - (this.amp || 0)) * Math.min(1, dt * 8);
    const s = Math.sin(this.walk), c = Math.cos(this.walk);
    const A = this.amp;
    const crouchK = (this.crouchK || 0) + ((crouch ? 1 : 0) - (this.crouchK || 0)) * Math.min(1, dt * 10);
    this.crouchK = crouchK;
    this.hips.position.y = 0.95 - crouchK * 0.38 + Math.abs(c) * A * 0.05;
    this.legL.rotation.x = s * A - crouchK * 1.1;
    this.legR.rotation.x = -s * A - crouchK * 0.7;
    this.kneeL.rotation.x = Math.max(0, -c) * A * 1.2 + crouchK * 1.9;
    this.kneeR.rotation.x = Math.max(0, c) * A * 1.2 + crouchK * 1.4;
    this.spine.rotation.x = -crouchK * 0.15 + (sprint ? -0.2 : 0);
    this.spine.rotation.z = (st.lean || 0) * 0.3;
    this.spine.rotation.y = s * A * 0.08;
    const pitch = st.pitch || 0;
    this.neck.rotation.x = pitch * 0.6;
    // 腕：武器を構える
    const aimP = sprint ? -0.6 : pitch;
    if (this.weapon && !using) {
      this.weaponMount.visible = true;
      const reloadK = reloading ? 0.5 + Math.sin(time * 8) * 0.15 : 0;
      this.weaponMount.rotation.set(aimP + (sprint ? 0.4 : 0) - reloadK * 0.6, sprint ? 0.6 : 0, sprint ? 0.3 : 0);
      this.armR.rotation.set(-1.15 - aimP * 0.9 + (sprint ? 0.7 : 0), -0.25, 0.15);
      this.foreR.rotation.set(-0.6, 0, 0);
      this.armL.rotation.set(-1.35 - aimP * 0.9 + (sprint ? 0.7 : 0) + reloadK, 0.6, 0);
      this.foreL.rotation.set(-0.5 - reloadK, 0, 0);
    } else {
      if (this.weapon) this.weaponMount.visible = !using;
      this.armR.rotation.set(-s * A * 0.6 - (using ? 1.2 : 0), 0, 0.08);
      this.armL.rotation.set(s * A * 0.6 - (using ? 1.2 : 0), 0, -0.08);
      this.foreR.rotation.set(-0.3 - (using ? 0.8 : 0), 0, 0);
      this.foreL.rotation.set(-0.3 - (using ? 0.8 : 0), 0, 0);
    }
    // ライト（実際の光源はゲーム側のプールで割り当て）
    this.lightOn = !!(st.flags & 32);
    if (this.lightOn && !this.lightBulb) {
      this.lightBulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: '#fffbe8' }));
      this.lightBulb.position.set(0.03, 0.03, -0.32);
      this.weaponMount.add(this.lightBulb);
    }
    if (this.lightBulb) this.lightBulb.visible = this.lightOn;
  }

  muzzleWorld(out) {
    if (this.weapon?.userData.muzzle) return this.weapon.userData.muzzle.getWorldPosition(out);
    return out.set(this.root.position.x, this.root.position.y + 1.4, this.root.position.z);
  }

  dispose() {
    this.scene.remove(this.root);
  }
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// ---------------------------------------------------------------- ARC 機械
export class MachineView {
  constructor(info, scene) {
    this.info = info;
    this.scene = scene;
    this.type = info.mtype;
    this.root = new THREE.Group();
    this.parts = {};
    this.t = Math.random() * 10;
    const R = this.root;
    const body = mat('#3a4248', 0.4, 0.7), dark = mat('#1e2226', 0.5, 0.6), plate = mat('#5a6268', 0.45, 0.6);
    const eyeCol = { wasp: '#ff5020', hornet: '#ffb020', tick: '#30d0ff', sentinel: '#40e0ff' }[this.type];
    this.eyeMat = mat('#200', 0.3, 0.2, eyeCol, 2.5).clone();
    if (this.type === 'wasp' || this.type === 'hornet') {
      const S = this.type === 'hornet' ? 1.35 : 1;
      const core = new THREE.Group(); R.add(core); this.parts.core = core;
      mesh(core, new THREE.SphereGeometry(0.32 * S, 16, 12).scale(1, 0.6, 1.2), body);
      mesh(core, new THREE.SphereGeometry(0.12 * S, 12, 8), this.eyeMat, 0, -0.02, -0.36 * S);
      mesh(core, bgeo(0.5 * S, 0.06, 0.2 * S), plate, 0, 0.12 * S, 0.05);
      this.rotors = [];
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const arm = mesh(core, bgeo(0.42 * S, 0.04, 0.05), dark, sx * 0.28 * S, 0.05, sz * 0.25 * S);
        arm.rotation.y = sx * sz * 0.7;
        const rotor = new THREE.Group();
        rotor.position.set(sx * 0.5 * S, 0.1, sz * 0.42 * S);
        mesh(rotor, new THREE.CylinderGeometry(0.03, 0.05, 0.08, 8), dark);
        const blade = mesh(rotor, bgeo(0.42 * S, 0.01, 0.05), mat('#606870', 0.5, 0.5), 0, 0.05, 0);
        const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.22 * S, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#9aa', transparent: true, opacity: 0.12, depthWrite: false }));
        disc.position.y = 0.05; rotor.add(disc);
        core.add(rotor);
        this.rotors.push(rotor);
      }
      if (this.type === 'hornet') {
        mesh(core, new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8).rotateX(Math.PI / 2), dark, 0.18, -0.12, 0.1);
        mesh(core, new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8).rotateX(Math.PI / 2), dark, -0.18, -0.12, 0.1);
      }
      // 砲身
      mesh(core, new THREE.CylinderGeometry(0.025, 0.03, 0.3, 8).rotateX(Math.PI / 2), dark, 0, -0.16, -0.25);
    } else if (this.type === 'tick') {
      const core = new THREE.Group(); core.position.y = 0.45; R.add(core); this.parts.core = core;
      mesh(core, new THREE.SphereGeometry(0.42, 16, 12).scale(1, 0.55, 1.15), body);
      mesh(core, new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.6, 1), this.eyeMat, 0, 0.18, 0);
      this.legs = [];
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? 1 : -1, k = i % 3;
        const leg = new THREE.Group();
        leg.position.set(side * 0.3, 0, (k - 1) * 0.28);
        mesh(leg, bgeo(0.4, 0.05, 0.05), dark, side * 0.2, 0.08, 0).rotation.z = side * 0.4;
        const low = new THREE.Group(); low.position.set(side * 0.38, 0.16, 0); leg.add(low);
        mesh(low, bgeo(0.05, 0.6, 0.05), dark, side * 0.08, -0.3, 0).rotation.z = side * -0.25;
        core.add(leg);
        this.legs.push({ leg, side, k });
      }
    } else if (this.type === 'sentinel') {
      const torso = new THREE.Group(); torso.position.y = 2.6; R.add(torso); this.parts.core = torso;
      mesh(torso, bgeo(1.8, 1.1, 2.0), body);
      mesh(torso, bgeo(1.9, 0.2, 2.1), plate, 0, 0.55, 0);
      mesh(torso, bgeo(1.4, 0.5, 0.6), plate, 0, -0.1, -1.1);
      // 背面の動力コア（弱点）
      this.coreMat = mat('#002', 0.3, 0.2, '#40e0ff', 3).clone();
      mesh(torso, new THREE.SphereGeometry(0.42, 16, 12), this.coreMat, 0, 0.95, 0.6);
      mesh(torso, new THREE.TorusGeometry(0.48, 0.07, 8, 20).rotateX(Math.PI / 2), dark, 0, 0.95, 0.6);
      // 頭と主砲
      const head = new THREE.Group(); head.position.set(0, 0.35, -1.1); torso.add(head); this.parts.head = head;
      mesh(head, bgeo(0.8, 0.5, 0.6), dark);
      mesh(head, new THREE.SphereGeometry(0.16, 12, 8), this.eyeMat, 0, 0.05, -0.32);
      mesh(head, new THREE.CylinderGeometry(0.12, 0.16, 1.5, 10).rotateX(Math.PI / 2), dark, 0.55, -0.15, -0.6);
      mesh(head, new THREE.CylinderGeometry(0.12, 0.16, 1.5, 10).rotateX(Math.PI / 2), dark, -0.55, -0.15, -0.6);
      this.legs = [];
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const leg = new THREE.Group(); leg.position.set(sx * 0.9, 2.2, sz * 0.85); R.add(leg);
        mesh(leg, bgeo(0.35, 1.3, 0.35), plate, sx * 0.35, -0.3, sz * 0.2).rotation.z = sx * 0.5;
        const low = new THREE.Group(); low.position.set(sx * 0.7, -0.85, sz * 0.35); leg.add(low);
        mesh(low, bgeo(0.3, 1.6, 0.3), dark, 0, -0.7, 0);
        mesh(low, bgeo(0.55, 0.15, 0.55), dark, 0, -1.45, 0);
        this.legs.push({ leg, low, sx, sz });
      }
    }
    R.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(R);
  }

  setGear(info) { this.info = info; }

  update(st, dt, time) {
    const R = this.root;
    const dead = st.flags & 8, moving = st.flags & 16, charging = st.flags & 256;
    this.t += dt;
    R.position.set(st.x, st.y, st.z);
    if (dead) {
      if (!this.dead) { this.dead = true; this.deadT = 0; this.eyeMat.emissiveIntensity = 0; if (this.coreMat) this.coreMat.emissiveIntensity = 0; }
      this.deadT = Math.min(1, this.deadT + dt * 2);
      R.rotation.set(0.35 * this.deadT, st.yaw, 0.5 * this.deadT, 'YXZ');
      return;
    }
    R.rotation.set(0, st.yaw, 0);
    const blink = (st.flags & 512) ? 2.5 + Math.sin(time * 12) * 0.8 : 1.6;
    this.eyeMat.emissiveIntensity = charging ? 4 + Math.sin(time * 40) * 2 : blink;
    if (this.rotors) {
      for (const r of this.rotors) r.rotation.y += dt * 40;
      this.parts.core.rotation.x = (st.pitch || 0) * 0.5 + (moving ? -0.12 : 0);
      this.parts.core.rotation.z = Math.sin(this.t * 2) * 0.05;
    }
    if (this.type === 'tick' && this.legs) {
      const sp = moving ? 18 : 0;
      for (const { leg, side, k } of this.legs) leg.rotation.y = Math.sin(this.t * sp + k * 2 + (side > 0 ? 0 : Math.PI)) * 0.35;
      this.parts.core.position.y = 0.45 + (moving ? Math.abs(Math.sin(this.t * 18)) * 0.04 : 0);
      if (st.armed) this.eyeMat.emissive.set(Math.sin(time * 30) > 0 ? '#ff2010' : '#30d0ff');
    }
    if (this.type === 'sentinel' && this.legs) {
      const sp = moving ? 3 : 0;
      for (const { leg, sx, sz } of this.legs) leg.rotation.x = Math.sin(this.t * sp + (sx * sz > 0 ? 0 : Math.PI)) * 0.25;
      this.parts.core.position.y = 2.6 + (moving ? Math.abs(Math.sin(this.t * 3)) * 0.08 : 0);
      this.parts.head.rotation.x = (st.pitch || 0);
      this.coreMat.emissiveIntensity = 2.5 + Math.sin(time * 3) * 0.8;
    }
  }

  muzzleWorld(out) {
    if (this.type === 'sentinel') return this.parts.head.localToWorld(out.set(0, -0.15, -1.4));
    return this.parts.core ? this.parts.core.localToWorld(out.set(0, -0.16, -0.45)) : out.copy(this.root.position);
  }

  dispose() { this.scene.remove(this.root); }
}

// 一人称視点の腕と武器（別シーンで描画）
import * as THREE from 'three';
import { buildWeapon } from './weapons3d.js';
import { ITEMS } from '../../shared/items.js';

const HIP = new THREE.Vector3(0.13, -0.135, -0.3);
const SPRINT_ROT = new THREE.Euler(-0.35, 0.75, 0.35);

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.scene.add(this.camera);
    // ライト（メインシーンに近い雰囲気）
    this.hemi = new THREE.HemisphereLight('#c8d8e8', '#40382c', 1.2);
    this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight('#fff4e0', 1.6);
    this.dir.position.set(0.5, 1, 0.3);
    this.scene.add(this.dir);
    this.flashL = new THREE.PointLight('#ffb060', 0, 2, 2);
    this.flashL.position.set(0.1, -0.05, -0.6);
    this.camera.add(this.flashL);
    this.root = new THREE.Group();
    this.camera.add(this.root);
    this.gunHolder = new THREE.Group();
    this.root.add(this.gunHolder);
    // 腕
    const sleeve = new THREE.MeshStandardMaterial({ color: '#3e4636', roughness: 0.9 });
    const glove = new THREE.MeshStandardMaterial({ color: '#1e1c1a', roughness: 0.8 });
    this.armR = this.makeArm(sleeve, glove);
    this.armL = this.makeArm(sleeve, glove);
    this.root.add(this.armR.g, this.armL.g);
    this.item = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), new THREE.MeshStandardMaterial({ color: '#b03030', roughness: 0.6 }));
    this.item.visible = false;
    this.root.add(this.item);
    this.nade = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: '#4c5a3a', roughness: 0.6 }));
    this.nade.visible = false;
    this.root.add(this.nade);
    this.weapon = null;
    this.ads = 0; this.sprintK = 0; this.swayX = 0; this.swayY = 0; this.bob = 0;
    this.kick = 0; this.kickRot = 0; this.kickSide = 0;
    this.reloadT = -1; this.reloadDur = 1; this.swapT = 1; this.useT = -1; this.throwT = -1;
    this.pumpT = -1;
  }
  makeArm(sleeve, glove) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.046, 1, 10).rotateX(Math.PI / 2).translate(0, 0, -0.5), sleeve);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.09), glove);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 10).rotateX(Math.PI / 2), glove);
    hand.add(cuff); cuff.position.z = 0.05;
    g.add(upper, hand);
    return { g, upper, hand };
  }
  setWeapon(item) {
    if (this.weapon) this.gunHolder.remove(this.weapon);
    this.weapon = null;
    this.def = null;
    if (!item) return;
    this.def = ITEMS[item.id];
    this.weapon = buildWeapon(item);
    this.weapon.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.gunHolder.add(this.weapon);
    this.swapT = 0;
  }
  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
  fire(k = 1) {
    this.kick = Math.min(1.5, this.kick + 0.6 * k);
    this.kickRot = Math.min(1.5, this.kickRot + 0.5 * k);
    this.kickSide = (Math.random() - 0.5) * k;
    this.flashL.intensity = 3;
    if (this.def?.weapon.pump || this.def?.weapon.bolt) this.pumpT = 0;
  }
  startReload(dur) { this.reloadT = 0; this.reloadDur = dur; }
  startUse(dur, color) { this.useT = 0; this.useDur = dur; this.item.material.color.set(color || '#b03030'); }
  stopUse() { this.useT = -1; }
  startThrow() { this.throwT = 0; }

  // s: { ads (0..1), sprint, moving, speed, lookDX, lookDY, crouch, onGround, lean }
  update(dt, s) {
    this.ads += ((s.ads ? 1 : 0) - this.ads) * Math.min(1, dt * (s.adsSpeed || 10));
    this.sprintK += ((s.sprint ? 1 : 0) - this.sprintK) * Math.min(1, dt * 8);
    this.swayX += (-s.lookDX * 0.0006 - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (s.lookDY * 0.0006 - this.swayY) * Math.min(1, dt * 8);
    if (s.moving && s.onGround) this.bob += dt * (s.sprint ? 13 : s.crouch ? 6 : 9);
    this.kick *= Math.pow(0.0008, dt); this.kickRot *= Math.pow(0.002, dt);
    this.flashL.intensity *= Math.pow(0.0001, dt);
    if (this.reloadT >= 0) { this.reloadT += dt / this.reloadDur; if (this.reloadT >= 1) this.reloadT = -1; }
    if (this.useT >= 0) { this.useT += dt / this.useDur; if (this.useT >= 1) this.useT = -1; }
    if (this.throwT >= 0) { this.throwT += dt / 0.8; if (this.throwT >= 1) this.throwT = -1; }
    if (this.pumpT >= 0) { this.pumpT += dt / 0.55; if (this.pumpT >= 1) this.pumpT = -1; }
    this.swapT = Math.min(1, this.swapT + dt * 2.5);
    const W = this.weapon;
    this.root.visible = !!W && !s.hidden;
    if (!W) return;
    const sightY = W.userData.sight.position.y;
    const adsK = this.ads * (1 - this.sprintK);
    const bobA = (s.moving && s.onGround ? (s.sprint ? 1 : 0.5) : 0) * (1 - adsK * 0.85);
    const bx = Math.sin(this.bob) * 0.012 * bobA, by = -Math.abs(Math.cos(this.bob)) * 0.012 * bobA;
    // 位置
    const adsPos = new THREE.Vector3(0, -sightY, this.def.weapon.class === 'pistol' ? -0.36 : -0.2);
    const p = HIP.clone().lerp(adsPos, adsK);
    p.x += bx + this.swayX * (1 - adsK * 0.7); p.y += by + this.swayY * (1 - adsK * 0.7);
    p.z += this.kick * 0.045;
    p.y -= this.sprintK * 0.04;
    p.x -= this.sprintK * 0.03;
    // スワップ
    const sw = 1 - easeOut(this.swapT);
    p.y -= sw * 0.3;
    // リロード
    let rr = 0;
    if (this.reloadT >= 0) { rr = Math.sin(Math.min(1, this.reloadT) * Math.PI); p.y -= rr * 0.05; }
    let uu = 0;
    if (this.useT >= 0) { uu = Math.sin(Math.min(1, this.useT) * Math.PI * 0.5 + 0.0) ; uu = Math.min(1, this.useT * 5, (1 - this.useT) * 5); p.y -= uu * 0.35; }
    let tt = 0;
    if (this.throwT >= 0) { tt = Math.min(1, this.throwT * 4, (1 - this.throwT) * 3); p.y -= tt * 0.35; }
    this.gunHolder.position.copy(p);
    const rot = new THREE.Euler(
      this.kickRot * 0.06 + this.swayY * 2 - rr * 0.35 + this.sprintK * SPRINT_ROT.x + (this.pumpT >= 0 ? Math.sin(this.pumpT * Math.PI) * 0.12 : 0),
      this.swayX * 3 + this.sprintK * SPRINT_ROT.y + this.kickSide * 0.02,
      -rr * 0.7 + this.sprintK * SPRINT_ROT.z + (s.lean || 0) * -0.15 + bx * 2,
    );
    this.gunHolder.rotation.copy(rot);
    // 腕
    const gripR = new THREE.Vector3(0, -0.06, 0.03).applyEuler(rot).add(p);
    const isPistol = this.def.weapon.class === 'pistol';
    let gripL = new THREE.Vector3(0, -0.03, isPistol ? 0.0 : -0.24).applyEuler(rot).add(p);
    if (isPistol) gripL.x -= 0.03;
    if (rr > 0) {
      const magPos = W.userData.mag ? W.userData.mag.position.clone().applyEuler(rot).add(p) : gripL;
      const t = this.reloadT;
      const off = t < 0.45 ? Math.sin((t / 0.45) * Math.PI) * 0.18 : 0;
      gripL = gripL.clone().lerp(magPos, Math.min(1, rr * 1.6));
      gripL.y -= off;
    }
    if (this.pumpT >= 0 && this.def.weapon.pump) gripL.z += Math.sin(this.pumpT * Math.PI) * 0.06;
    this.placeArm(this.armR, new THREE.Vector3(0.24, -0.38, 0.12), gripR);
    this.placeArm(this.armL, new THREE.Vector3(-0.2, -0.4, 0.05), gripL);
    // 医薬品
    this.item.visible = uu > 0.05;
    if (this.item.visible) { this.item.position.set(-0.05, -0.17 + uu * 0.05, -0.32); this.item.rotation.set(0.3, 0.3, 0); this.placeArm(this.armL, new THREE.Vector3(-0.2, -0.4, 0.05), this.item.position.clone().add(new THREE.Vector3(0, -0.04, 0.03))); }
    this.nade.visible = tt > 0.05;
    if (this.nade.visible) {
      const a = this.throwT;
      const np = new THREE.Vector3(0.12, -0.12 + Math.sin(a * Math.PI) * 0.1, -0.2 - (a > 0.5 ? (a - 0.5) * 0.6 : 0));
      this.nade.position.copy(np);
      this.placeArm(this.armR, new THREE.Vector3(0.24, -0.38, 0.12), np.clone().add(new THREE.Vector3(0, -0.03, 0.03)));
    }
    if (W.userData.reticle) W.userData.reticle.visible = adsK > 0.6;
  }
  placeArm(arm, shoulder, hand) {
    const d = new THREE.Vector3().subVectors(hand, shoulder);
    const len = d.length();
    arm.g.position.copy(shoulder);
    // root（カメラ直下）基準で肩から手へ向ける
    const m = new THREE.Matrix4().lookAt(shoulder, hand, new THREE.Vector3(0, 1, 0));
    arm.g.quaternion.setFromRotationMatrix(m);
    arm.upper.scale.z = Math.max(0.05, len - 0.04);
    arm.hand.position.set(0, 0, -len);
  }
  muzzleLocal(out) {
    if (!this.weapon) return out.set(0.1, -0.1, -0.6);
    this.weapon.updateWorldMatrix(true, true);
    this.camera.updateMatrixWorld(true);
    const wp = this.weapon.userData.muzzle.getWorldPosition(new THREE.Vector3());
    return this.camera.worldToLocal(out.copy(wp));
  }
  ejectLocal(out) {
    if (!this.weapon) return out.set(0.1, -0.1, -0.4);
    return out.copy(this.gunHolder.position).add(new THREE.Vector3(0.03, 0.04, -0.08));
  }
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// 武器の 3D モデル（プリミティブ組み立て）。原点＝グリップ位置、銃口は -Z 方向。
import * as THREE from 'three';
import { ITEMS } from '../../shared/items.js';

const matCache = {};
function M(color, rough = 0.5, metal = 0.6, emissive = null) {
  const k = color + rough + metal + emissive;
  if (!matCache[k]) {
    matCache[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (emissive) { matCache[k].emissive = new THREE.Color(emissive); matCache[k].emissiveIntensity = 1.5; }
  }
  return matCache[k];
}
function box(g, w, h, d, x, y, z, mat, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.x = rx;
  m.castShadow = true;
  g.add(m);
  return m;
}
function cyl(g, r, len, x, y, z, mat, seg = 10, r2 = null) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

// 戻り値: { group, muzzle (Object3D), sight (ADS 用の照準点 Object3D), mag (Object3D), sightHeight }
export function buildWeapon(itemOrId, opts = {}) {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  const mods = typeof itemOrId === 'string' ? (opts.mods || {}) : Object.fromEntries(Object.entries(itemOrId.mods || {}).map(([k, v]) => [k, v?.id]));
  const def = ITEMS[id];
  const w = def.weapon;
  const g = new THREE.Group();
  const base = new THREE.Color(def.color || '#3b3f42');
  const dark = M('#1c1e20', 0.45, 0.7);
  const metal = M('#2a2c2e', 0.35, 0.85);
  const body = M('#' + base.getHexString(), 0.55, 0.45);
  const furn = def.model?.ak ? M('#6a4026', 0.7, 0.05) : M('#' + base.clone().multiplyScalar(0.8).getHexString(), 0.7, 0.2);
  const isArc = w.caliber === 'arc';
  const glow = M('#1a2a30', 0.3, 0.5, def.color);
  const cls = w.class;
  // 寸法
  const D = {
    pistol: { recv: 0.17, barrel: 0.04, stock: 0, h: 0.035, grip: 0.1 },
    smg: { recv: 0.3, barrel: 0.12, stock: 0.22, h: 0.06, grip: 0.11 },
    rifle: { recv: 0.36, barrel: 0.3, stock: 0.28, h: 0.065, grip: 0.11 },
    dmr: { recv: 0.4, barrel: 0.45, stock: 0.3, h: 0.07, grip: 0.11 },
    sniper: { recv: 0.42, barrel: 0.55, stock: 0.32, h: 0.065, grip: 0.11 },
    shotgun: { recv: 0.34, barrel: 0.42, stock: 0.3, h: 0.07, grip: 0.11 },
    lmg: { recv: 0.42, barrel: 0.42, stock: 0.3, h: 0.08, grip: 0.11 },
  }[cls];
  const bull = def.model?.bullpup;
  let muzzleZ;
  let sightY = D.h * 1.3;
  if (cls === 'pistol') {
    // スライド
    box(g, 0.032, 0.035, D.recv, 0, 0.055, -0.06, body);
    box(g, 0.03, 0.025, D.recv - 0.02, 0, 0.025, -0.06, dark);
    box(g, 0.028, D.grip, 0.045, 0, -0.03, 0.01, dark, 0.25);
    box(g, 0.007, 0.012, 0.012, -0.007, 0.078, 0.01, metal); // 照門（左右に分かれたノッチ）
    box(g, 0.007, 0.012, 0.012, 0.007, 0.078, 0.01, metal);
    box(g, 0.004, 0.012, 0.008, 0, 0.078, -0.13, M('#e8e0a0', 0.4, 0.2, '#403a10')); // 照星
    // トリガーガード
    box(g, 0.006, 0.006, 0.05, 0, 0.0, -0.035, dark);
    muzzleZ = -0.06 - D.recv / 2 - 0.005;
    sightY = 0.084;
  } else {
    const rz = bull ? 0.05 : -0.05;
    // レシーバー
    box(g, 0.05, D.h, D.recv, 0, 0.03, rz - D.recv / 2 + 0.1, body);
    box(g, 0.052, 0.018, D.recv * 0.9, 0, 0.03 + D.h / 2 + 0.009, rz - D.recv / 2 + 0.1, dark); // レール
    // ハンドガード
    const hgLen = cls === 'smg' ? 0.14 : 0.24;
    const hgZ = rz - D.recv + 0.1 - hgLen / 2;
    if (def.model?.ak) box(g, 0.055, 0.05, hgLen, 0, 0.02, hgZ, furn);
    else box(g, 0.058, 0.058, hgLen, 0, 0.03, hgZ, dark);
    // バレル
    const bz0 = hgZ - hgLen / 2;
    cyl(g, cls === 'shotgun' ? 0.014 : 0.01, D.barrel, 0, 0.04, bz0 - D.barrel / 2 + 0.04, metal);
    muzzleZ = bz0 - D.barrel + 0.04;
    if (cls === 'shotgun') {
      cyl(g, 0.012, D.barrel * 0.8, 0, 0.012, bz0 - D.barrel * 0.4, metal); // チューブマガジン
      if (w.pump) box(g, 0.05, 0.04, 0.12, 0, 0.012, bz0 + 0.02, furn); // ポンプ
    }
    g.userData.frontZ = muzzleZ + 0.05;
    // グリップ
    const gz = bull ? -0.12 : 0.0;
    box(g, 0.035, D.grip, 0.045, 0, -0.045, gz + 0.02, dark, 0.3);
    box(g, 0.006, 0.006, 0.05, 0, -0.01, gz - 0.03, dark);
    // ストック
    if (D.stock) {
      const sz = bull ? 0.05 + D.stock / 2 : 0.1 + D.stock / 2;
      if (def.model?.ak) { box(g, 0.04, 0.06, D.stock, 0, 0.0, sz, furn, -0.08); }
      else if (cls === 'sniper' || cls === 'dmr') { box(g, 0.045, 0.09, D.stock, 0, 0.0, sz, furn); box(g, 0.04, 0.03, 0.1, 0, 0.06, sz - 0.02, furn); }
      else { cyl(g, 0.014, D.stock * 0.8, 0, 0.03, sz - 0.02, dark); box(g, 0.04, 0.09, 0.03, 0, 0.0, sz + D.stock / 2 - 0.015, dark); }
    }
    // マガジン
    let mag;
    const magZ = bull ? 0.12 : rz - 0.05;
    if (cls === 'lmg') { mag = box(g, 0.08, 0.1, 0.1, 0.02, -0.04, magZ, M('#3a3e30', 0.6, 0.3)); }
    else if (cls === 'shotgun' && !w.pump) { mag = box(g, 0.04, 0.12, 0.07, 0, -0.07, magZ, dark, def.model?.ak ? -0.25 : 0); }
    else if (cls === 'shotgun' || w.bolt) { mag = box(g, 0.035, 0.03, 0.06, 0, -0.005, magZ, dark); }
    else {
      const curved = def.model?.ak;
      const len = cls === 'smg' ? 0.14 : 0.16;
      mag = box(g, 0.03, len, 0.055, 0, -0.03 - len / 2 + 0.02, magZ, isArc ? glow : curved ? M('#4a3020', 0.6, 0.2) : dark, curved ? -0.3 : -0.12);
      if (mods.mag) { mag.scale.y = 1.35; if (/drum|75|50/.test(mods.mag)) { mag.scale.set(2.2, 0.9, 1.6); } }
    }
    g.userData.mag = mag;
    // ボルトハンドル
    if (w.bolt) cyl(g, 0.007, 0.06, 0.035, 0.05, rz + 0.02, metal).rotation.set(0, 0, Math.PI / 2);
    if (cls === 'lmg') { // バイポッド
      const bp = box(g, 0.008, 0.18, 0.008, 0.025, -0.06, muzzleZ + 0.12, metal, 0.4); bp.rotation.z = 0.3;
      const bp2 = box(g, 0.008, 0.18, 0.008, -0.025, -0.06, muzzleZ + 0.12, metal, 0.4); bp2.rotation.z = -0.3;
    }
    if (isArc) {
      for (let i = 0; i < 3; i++) box(g, 0.056, 0.008, 0.03, 0, 0.03, hgZ - 0.08 + i * 0.07, glow);
      box(g, 0.02, 0.02, D.recv * 0.6, 0.03, 0.04, rz - D.recv / 2 + 0.1, glow);
    }
  }
  // ---- MOD
  const sightId = mods.sight;
  let reticle = null;
  if (sightId) {
    const sd = ITEMS[sightId].mod;
    const sy = (cls === 'pistol' ? 0.075 : 0.03 + D.h / 2 + 0.018);
    const sz = cls === 'pistol' ? -0.05 : (bull ? 0.0 : -0.07);
    if (sd.zoom >= 2) {
      const len = sd.zoom >= 8 ? 0.3 : sd.zoom >= 4 ? 0.2 : 0.14;
      const r = sd.zoom >= 8 ? 0.022 : 0.018;
      box(g, 0.02, 0.02, 0.05, 0, sy + 0.01, sz, dark);
      cyl(g, r, len, 0, sy + 0.04, sz - 0.01, M(sd.thermal ? '#1f2a33' : '#202224', 0.4, 0.6));
      cyl(g, r * 1.35, 0.04, 0, sy + 0.04, sz - 0.01 - len / 2 + 0.02, M('#1a1a1a', 0.4, 0.6));
      cyl(g, r * 1.2, 0.03, 0, sy + 0.04, sz - 0.01 + len / 2 - 0.015, M('#1a1a1a', 0.4, 0.6));
      sightY = sy + 0.04;
    } else {
      // ドット・ホロ
      box(g, 0.03, 0.012, 0.05, 0, sy + 0.006, sz, dark);
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.004, 6, 16), dark);
      fr.position.set(0, sy + 0.028, sz - 0.01);
      g.add(fr);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16), new THREE.MeshBasicMaterial({ color: '#80c0a0', transparent: true, opacity: 0.12, depthWrite: false }));
      glass.position.set(0, sy + 0.028, sz - 0.01);
      g.add(glass);
      reticle = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 8), new THREE.MeshBasicMaterial({ color: '#ff3020', depthTest: false, transparent: true }));
      reticle.position.set(0, sy + 0.028, sz - 0.012);
      reticle.renderOrder = 10;
      g.add(reticle);
      sightY = sy + 0.028;
    }
  } else if (cls !== 'pistol') {
    // アイアンサイト：リアはピープ（リング）、フロントはポスト
    sightY = 0.03 + D.h / 2 + 0.04;
    const rz = bull ? 0.0 : -0.04;
    box(g, 0.016, sightY - (0.03 + D.h / 2) - 0.008, 0.012, 0, (sightY + 0.03 + D.h / 2) / 2 - 0.006, rz, dark);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.003, 6, 16), dark);
    ring.position.set(0, sightY, rz);
    g.add(ring);
    const fz = g.userData.frontZ ?? -0.4;
    const postH = sightY - 0.04;
    box(g, 0.012, postH * 0.6, 0.012, 0, 0.04 + postH * 0.3, fz, dark);
    box(g, 0.0035, 0.014, 0.004, 0, sightY - 0.007, fz, M('#e8e0a0', 0.4, 0.2, '#403a10'));
  }
  const muzzleMod = mods.muzzle;
  if (muzzleMod || w.suppressed) {
    const md = muzzleMod ? ITEMS[muzzleMod].mod : { suppressor: true };
    if (md.suppressor) { const len = 0.16; cyl(g, 0.02, len, 0, cls === 'pistol' ? 0.045 : 0.04, muzzleZ - len / 2 + 0.01, M('#1e1f20', 0.6, 0.4)); muzzleZ -= len - 0.01; }
    else { cyl(g, 0.015, 0.05, 0, cls === 'pistol' ? 0.045 : 0.04, muzzleZ - 0.02, metal); muzzleZ -= 0.04; }
  }
  if (mods.grip && cls !== 'pistol') {
    const hz = -0.2;
    box(g, 0.025, 0.07, 0.028, 0, -0.02, hz, dark, mods.grip === 'grip_angle' ? 0.6 : 0);
  }
  if (mods.tactical) {
    const td = ITEMS[mods.tactical].mod;
    const tz = cls === 'pistol' ? -0.11 : -0.22;
    const ty = cls === 'pistol' ? 0.008 : 0.03;
    cyl(g, 0.012, 0.07, 0.035, ty, tz, dark);
    if (td.laser) { const lm = cyl(g, 0.004, 0.02, 0.035, ty - 0.012, tz - 0.035, M('#300', 0.4, 0.2, '#ff2010')); lm.userData.laser = true; }
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, cls === 'pistol' ? 0.045 : 0.04, muzzleZ);
  g.add(muzzle);
  const sight = new THREE.Object3D();
  sight.position.set(0, sightY, 0);
  g.add(sight);
  g.userData.muzzle = muzzle;
  g.userData.sight = sight;
  g.userData.reticle = reticle;
  g.userData.cls = cls;
  return g;
}

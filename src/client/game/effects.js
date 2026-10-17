// 視覚エフェクト：パーティクル、曳光弾、マズルフラッシュ、着弾痕、爆発、煙
import * as THREE from 'three';

const VS = `
attribute float size; attribute float alpha; attribute vec3 pcolor;
varying float vA; varying vec3 vC;
uniform float uScale;
void main() {
  vA = alpha; vC = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying float vA; varying vec3 vC;
uniform sampler2D uTex;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vC * t.rgb, t.a * vA);
  if (gl_FragColor.a < 0.004) discard;
}`;

function softTex(kind = 'soft') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'smoke') {
    for (let i = 0; i < 14; i++) {
      const x = 20 + Math.random() * 24, y = 20 + Math.random() * 24, r = 10 + Math.random() * 14;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
  } else {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

class Particles {
  constructor(scene, max, blending, tex) {
    this.max = max;
    this.p = []; // 生存中
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uTex: { value: tex }, uScale: { value: 500 } }, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = blending === THREE.AdditiveBlending ? 3 : 2;
    scene.add(this.points);
  }
  emit(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: 0, max: o.life || 1, s0: o.size || 0.3, s1: o.size1 ?? o.size ?? 0.3, r: o.r ?? 1, g: o.g ?? 1, b: o.b ?? 1, a0: o.alpha ?? 1, grav: o.grav || 0, drag: o.drag ?? 0, fadeIn: o.fadeIn || 0 });
  }
  update(dt) {
    const P = this.p;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.life += dt;
      if (q.life >= q.max) continue;
      q.vy -= q.grav * dt;
      const dr = Math.max(0, 1 - q.drag * dt);
      q.vx *= dr; q.vy *= dr; q.vz *= dr;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.grav && q.y < 0.02) { q.y = 0.02; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
      const t = q.life / q.max;
      this.pos[w * 3] = q.x; this.pos[w * 3 + 1] = q.y; this.pos[w * 3 + 2] = q.z;
      this.col[w * 3] = q.r; this.col[w * 3 + 1] = q.g; this.col[w * 3 + 2] = q.b;
      this.size[w] = q.s0 + (q.s1 - q.s0) * t;
      const fi = q.fadeIn ? Math.min(1, q.life / q.fadeIn) : 1;
      this.alpha[w] = q.a0 * (1 - t) * fi;
      P[w] = q;
      w++;
    }
    P.length = w;
    this.geo.setDrawRange(0, w);
    for (const k of ['position', 'pcolor', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
  }
}

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.add = new Particles(scene, 3000, THREE.AdditiveBlending, softTex());
    this.norm = new Particles(scene, 2500, THREE.NormalBlending, softTex('smoke'));
    // 曳光弾
    this.tracers = [];
    const tg = new THREE.BoxGeometry(0.035, 0.035, 1).translate(0, 0, -0.5);
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: '#ffd080', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.frustumCulled = false;
      scene.add(m);
      this.tracers.push({ m, active: false });
    }
    // ビーム
    this.beams = [];
    const bg = new THREE.CylinderGeometry(0.06, 0.06, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: '#40e0ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; scene.add(m);
      this.beams.push({ m, t: 0 });
    }
    // マズルフラッシュ
    this.flashTex = this.makeFlashTex();
    this.flashes = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, color: '#ffc070', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false; scene.add(s);
      this.flashes.push({ s, t: 0 });
    }
    // 光源プール（数を固定してシェーダー再コンパイルを避ける）
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ffb060', 0, 14, 2);
      scene.add(l);
      this.lights.push({ l, t: 0, dur: 0.06, peak: 0 });
    }
    // 着弾痕
    const holeTex = this.makeHoleTex();
    this.decalMax = 400;
    this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshStandardMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 }), this.decalMax);
    this.decals.count = 0; this.decalIdx = 0;
    this.decals.frustumCulled = false;
    scene.add(this.decals);
    this.smokeSources = [];
    this.fires = [];
    this.casings = [];
    const cg = new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6).rotateZ(Math.PI / 2);
    this.casingMesh = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: '#c8a050', metalness: 0.8, roughness: 0.35 }), 60);
    this.casingMesh.count = 0; this.casingMesh.frustumCulled = false;
    scene.add(this.casingMesh);
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpS = new THREE.Vector3(1, 1, 1);
  }

  // シェーダーの事前コンパイル用に一時的に全て表示する
  setPrewarm(on) {
    for (const T of this.tracers.slice(0, 1)) T.m.visible = on;
    for (const B of this.beams.slice(0, 1)) B.m.visible = on;
    for (const f of this.flashes.slice(0, 1)) f.s.visible = on;
    this.decals.count = on ? 1 : this.decals.count;
    this.casingMesh.count = on ? 1 : 0;
    if (on) { this.add.emit({ x: 0, y: -50, z: 0, life: 0.1 }); this.norm.emit({ x: 0, y: -50, z: 0, life: 0.1 }); this.add.update(0); this.norm.update(0); }
  }

  makeFlashTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 64);
    for (let i = 0; i < 7; i++) {
      g.rotate((Math.PI * 2) / 7 + Math.random() * 0.3);
      const gr = g.createLinearGradient(0, 0, 60, 0);
      gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, -6); g.lineTo(40 + Math.random() * 22, 0); g.lineTo(0, 6); g.fill();
    }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill();
    return new THREE.CanvasTexture(c);
  }
  makeHoleTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, 'rgba(10,8,6,1)'); gr.addColorStop(0.25, 'rgba(20,18,16,.95)'); gr.addColorStop(0.5, 'rgba(60,55,50,.5)'); gr.addColorStop(1, 'rgba(60,55,50,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  flashLight(pos, color = '#ffb060', peak = 6, dur = 0.06, dist = 14) {
    let best = this.lights[0];
    for (const L of this.lights) if (L.t <= 0) { best = L; break; } else if (L.t < best.t) best = L;
    best.l.position.copy(pos); best.l.color.set(color); best.l.distance = dist;
    best.t = dur; best.dur = dur; best.peak = peak;
  }

  muzzle(pos, dir, opts = {}) {
    if (opts.suppressed) {
      for (let i = 0; i < 3; i++) this.norm.emit({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * 2 + rnd(0.3), vy: dir.y * 2 + 0.3, vz: dir.z * 2 + rnd(0.3), life: 0.6, size: 0.06, size1: 0.3, r: 0.7, g: 0.7, b: 0.7, alpha: 0.25 });
      return;
    }
    const f = this.flashes.find((x) => x.t <= 0) || this.flashes[0];
    f.s.position.copy(pos).addScaledVector(dir, 0.08);
    const sc = (opts.big ? 0.75 : 0.45) * (0.8 + Math.random() * 0.5);
    f.s.scale.set(sc, sc, 1);
    f.s.material.rotation = Math.random() * 6.28;
    f.s.material.color.set(opts.color || '#ffc070');
    f.s.visible = true; f.t = 0.05;
    if (!opts.noLight) this.flashLight(pos, opts.color || '#ffb060', opts.big ? 9 : 5, 0.06);
    for (let i = 0; i < 4; i++) this.add.emit({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * 8 + rnd(2), vy: dir.y * 8 + rnd(2), vz: dir.z * 8 + rnd(2), life: 0.08, size: 0.08, r: 1, g: 0.75, b: 0.4 });
    for (let i = 0; i < 2; i++) this.norm.emit({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * 1.5 + rnd(0.3), vy: 0.4, vz: dir.z * 1.5 + rnd(0.3), life: 0.9, size: 0.08, size1: 0.6, r: 0.75, g: 0.75, b: 0.72, alpha: 0.18 });
  }

  tracer(from, to, color = '#ffd080', speed = 420, width = 1) {
    const T = this.tracers.find((x) => !x.active);
    if (!T) return;
    const d = new THREE.Vector3().subVectors(to, from);
    const len = d.length();
    if (len < 2) return;
    d.normalize();
    T.active = true; T.from = from.clone(); T.dir = d; T.len = len; T.t = 0; T.speed = speed;
    T.m.material.color.set(color);
    T.m.scale.set(width, width, Math.min(8, len * 0.25));
    T.m.lookAt(T.m.position.copy(from).sub(d));
    T.m.position.copy(from);
    T.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d);
    T.m.visible = true;
  }

  beam(from, to, color = '#40e0ff') {
    const B = this.beams.find((b) => b.t <= 0) || this.beams[0];
    const d = new THREE.Vector3().subVectors(to, from);
    const len = d.length();
    B.m.position.copy(from);
    B.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d.normalize());
    B.m.scale.set(1, 1, len);
    B.m.material.color.set(color);
    B.m.visible = true; B.t = 0.35;
    this.flashLight(from, color, 10, 0.2, 20);
    this.flashLight(to, color, 8, 0.25, 12);
  }

  impact(p, n, kind) {
    const N = n || { x: 0, y: 1, z: 0 };
    const sp = (s) => ({ vx: N.x * s + rnd(s * 0.8), vy: N.y * s + rnd(s * 0.8) + s * 0.3, vz: N.z * s + rnd(s * 0.8) });
    if (kind === 'flesh') {
      for (let i = 0; i < 10; i++) this.norm.emit({ x: p.x, y: p.y, z: p.z, ...sp(1.5), life: 0.5 + Math.random() * 0.3, size: 0.08, size1: 0.35, r: 0.45, g: 0.03, b: 0.02, alpha: 0.85, grav: 3, drag: 2 });
      for (let i = 0; i < 6; i++) this.norm.emit({ x: p.x, y: p.y, z: p.z, ...sp(3), life: 0.6, size: 0.04, r: 0.5, g: 0.02, b: 0.02, alpha: 1, grav: 9 });
      return;
    }
    if (kind === 'metal' || kind === 'armor' || kind === 'metal_hit' || kind === 'armor_m') {
      const blue = kind === 'metal_hit' || kind === 'armor_m';
      for (let i = 0; i < 12; i++) this.add.emit({ x: p.x, y: p.y, z: p.z, ...sp(6), life: 0.2 + Math.random() * 0.3, size: 0.05, r: 1, g: blue ? 0.8 : 0.7, b: blue ? 1 : 0.3, grav: 12, drag: 1 });
      this.add.emit({ x: p.x, y: p.y, z: p.z, life: 0.06, size: 0.6, r: 1, g: 0.8, b: blue ? 1 : 0.5 });
      if (kind === 'metal') this.decal(p, N);
      return;
    }
    const col = { concrete: [0.62, 0.6, 0.56], dirt: [0.45, 0.36, 0.26], wood: [0.5, 0.36, 0.22], cloth: [0.4, 0.4, 0.38], glass: [0.7, 0.8, 0.85], world: [0.6, 0.6, 0.56] }[kind] || [0.6, 0.6, 0.56];
    for (let i = 0; i < 7; i++) this.norm.emit({ x: p.x, y: p.y, z: p.z, ...sp(1.6), life: 0.7 + Math.random() * 0.6, size: 0.1, size1: 0.7, r: col[0], g: col[1], b: col[2], alpha: 0.55, drag: 3, grav: 0.3 });
    for (let i = 0; i < 6; i++) this.norm.emit({ x: p.x, y: p.y, z: p.z, ...sp(4), life: 0.5, size: 0.035, r: col[0] * 0.7, g: col[1] * 0.7, b: col[2] * 0.7, alpha: 1, grav: 12 });
    if (kind !== 'dirt') { for (let i = 0; i < 3; i++) this.add.emit({ x: p.x, y: p.y, z: p.z, ...sp(5), life: 0.12, size: 0.04, r: 1, g: 0.7, b: 0.4 }); }
    this.decal(p, N, kind === 'dirt' ? 1.4 : 1);
  }

  decal(p, n, s = 1) {
    const i = this.decalIdx;
    this.decalIdx = (this.decalIdx + 1) % this.decalMax;
    this.decals.count = Math.max(this.decals.count, this.decalIdx === 0 ? this.decalMax : this.decalIdx);
    this.tmpV.set(p.x + n.x * 0.01, p.y + n.y * 0.01, p.z + n.z * 0.01);
    this.tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n.x, n.y, n.z));
    const r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28);
    this.tmpQ.multiply(r);
    const sc = s * (0.7 + Math.random() * 0.6);
    this.tmpS.set(sc, sc, sc);
    this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
    this.decals.setMatrixAt(i, this.tmpM);
    this.decals.instanceMatrix.needsUpdate = true;
  }

  explosion(p, r, type) {
    if (type === 'flash') {
      this.add.emit({ x: p.x, y: p.y, z: p.z, life: 0.25, size: 14, size1: 20, r: 1, g: 1, b: 1 });
      this.flashLight(new THREE.Vector3(p.x, p.y + 0.5, p.z), '#ffffff', 40, 0.25, 40);
      for (let i = 0; i < 20; i++) this.add.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(10), vy: rnd(10), vz: rnd(10), life: 0.3, size: 0.08, r: 1, g: 1, b: 0.9 });
      return;
    }
    if (type === 'emp') {
      this.add.emit({ x: p.x, y: p.y + 0.5, z: p.z, life: 0.5, size: r * 2, size1: r * 4, r: 0.3, g: 0.8, b: 1 });
      for (let i = 0; i < 60; i++) { const a = Math.random() * 6.28, e = rnd(1); this.add.emit({ x: p.x, y: p.y + 0.5, z: p.z, vx: Math.cos(a) * r * 2, vy: e * 4, vz: Math.sin(a) * r * 2, life: 0.5, size: 0.15, r: 0.4, g: 0.9, b: 1, drag: 2 }); }
      this.flashLight(new THREE.Vector3(p.x, p.y + 1, p.z), '#40c0ff', 30, 0.4, 30);
      return;
    }
    // 破片手榴弾
    this.add.emit({ x: p.x, y: p.y + 0.3, z: p.z, life: 0.18, size: 7, size1: 12, r: 1, g: 0.85, b: 0.5 });
    for (let i = 0; i < 26; i++) this.add.emit({ x: p.x, y: p.y + 0.3, z: p.z, vx: rnd(6), vy: Math.random() * 6, vz: rnd(6), life: 0.4 + Math.random() * 0.4, size: 1.2, size1: 2.4, r: 1, g: 0.5 + Math.random() * 0.3, b: 0.15, drag: 3 });
    for (let i = 0; i < 40; i++) this.add.emit({ x: p.x, y: p.y + 0.3, z: p.z, vx: rnd(25), vy: Math.random() * 18, vz: rnd(25), life: 0.6, size: 0.06, r: 1, g: 0.8, b: 0.4, grav: 15 });
    for (let i = 0; i < 30; i++) this.norm.emit({ x: p.x, y: p.y + 0.4, z: p.z, vx: rnd(4), vy: 1 + Math.random() * 3, vz: rnd(4), life: 3 + Math.random() * 3, size: 1.2, size1: 5, r: 0.25, g: 0.23, b: 0.21, alpha: 0.7, drag: 1.2, fadeIn: 0.2 });
    for (let i = 0; i < 20; i++) this.norm.emit({ x: p.x, y: p.y + 0.2, z: p.z, vx: rnd(10), vy: 4 + Math.random() * 8, vz: rnd(10), life: 1.5, size: 0.08, r: 0.2, g: 0.18, b: 0.15, alpha: 1, grav: 14 });
    this.flashLight(new THREE.Vector3(p.x, p.y + 1, p.z), '#ffa040', 40, 0.35, 30);
    this.decal({ x: p.x, y: 0.03, z: p.z }, { x: 0, y: 1, z: 0 }, 22);
  }

  smoke(p, r) { this.smokeSources.push({ x: p.x, y: p.y, z: p.z, r, t: 33, acc: 0 }); }
  fire(p, t = 20) { this.fires.push({ x: p.x, y: p.y, z: p.z, t, acc: 0 }); }

  casing(pos, vel) {
    if (this.casings.length >= 60) this.casings.shift();
    this.casings.push({ p: pos.clone(), v: vel.clone(), r: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), life: 0, rest: false });
  }

  update(dt, time) {
    this.add.update(dt); this.norm.update(dt);
    const h = innerHeight;
    this.add.mat.uniforms.uScale.value = h * 0.9;
    this.norm.mat.uniforms.uScale.value = h * 0.9;
    for (const T of this.tracers) {
      if (!T.active) continue;
      T.t += dt * T.speed;
      if (T.t > T.len) { T.active = false; T.m.visible = false; continue; }
      T.m.position.copy(T.from).addScaledVector(T.dir, T.t);
    }
    for (const B of this.beams) {
      if (B.t <= 0) continue;
      B.t -= dt;
      B.m.material.opacity = Math.max(0, B.t / 0.35);
      const w = 0.5 + B.t * 4;
      B.m.scale.x = w; B.m.scale.y = w;
      if (B.t <= 0) B.m.visible = false;
    }
    for (const f of this.flashes) { if (f.t > 0) { f.t -= dt; if (f.t <= 0) f.s.visible = false; } }
    for (const L of this.lights) {
      if (L.t > 0) { L.t -= dt; L.l.intensity = L.peak * Math.max(0, L.t / L.dur); }
      else L.l.intensity = 0;
    }
    for (let i = this.smokeSources.length - 1; i >= 0; i--) {
      const s = this.smokeSources[i];
      s.t -= dt; s.acc += dt;
      while (s.acc > 0.05) {
        s.acc -= 0.05;
        if (s.t > 3) this.norm.emit({ x: s.x + rnd(0.3), y: s.y + 0.3, z: s.z + rnd(0.3), vx: rnd(s.r * 0.4), vy: 0.6 + Math.random() * 0.8, vz: rnd(s.r * 0.4), life: 7 + Math.random() * 3, size: 2, size1: s.r * 1.6, r: 0.78, g: 0.78, b: 0.76, alpha: 0.75, drag: 0.6, fadeIn: 0.6 });
      }
      if (s.t <= 0) this.smokeSources.splice(i, 1);
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt; f.acc += dt;
      while (f.acc > 0.08) {
        f.acc -= 0.08;
        this.add.emit({ x: f.x + rnd(0.4), y: f.y + 0.2, z: f.z + rnd(0.4), vy: 1.2 + Math.random(), life: 0.5, size: 0.6, size1: 0.1, r: 1, g: 0.45, b: 0.12 });
        this.norm.emit({ x: f.x, y: f.y + 0.8, z: f.z, vx: rnd(0.2), vy: 1.2, vz: rnd(0.2), life: 4, size: 0.5, size1: 2.5, r: 0.12, g: 0.12, b: 0.12, alpha: 0.45, fadeIn: 0.3 });
      }
      if (f.t <= 0) this.fires.splice(i, 1);
    }
    // 薬莢
    let k = 0;
    for (const c of this.casings) {
      c.life += dt;
      if (!c.rest) {
        c.v.y -= 12 * dt;
        c.p.addScaledVector(c.v, dt);
        c.r.x += dt * 20; c.r.y += dt * 13;
        if (c.p.y < (c.floor ?? 0.02)) { c.p.y = c.floor ?? 0.02; c.v.y *= -0.35; c.v.x *= 0.5; c.v.z *= 0.5; if (Math.abs(c.v.y) < 0.4) c.rest = true; }
      }
      this.tmpQ.setFromEuler(c.r);
      this.tmpS.set(1, 1, 1);
      this.tmpM.compose(c.p, this.tmpQ, this.tmpS);
      this.casingMesh.setMatrixAt(k++, this.tmpM);
    }
    this.casings = this.casings.filter((c) => c.life < 20);
    this.casingMesh.count = k;
    this.casingMesh.instanceMatrix.needsUpdate = true;
    void time;
  }
}
function rnd(s) { return (Math.random() - 0.5) * 2 * s; }

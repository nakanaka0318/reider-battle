// 空・太陽・霧・時間帯ライティング
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

const PRESETS = {
  day: { elev: 38, azim: 140, turb: 6, rayleigh: 1.4, sun: 2.8, hemi: 1.25, sky: '#b8d0e8', groundC: '#6a6050', fog: '#a8b6c0', fogNear: 90, fogFar: 650, exposure: 0.6, stars: 0, ambient: 0.35 },
  dusk: { elev: 3.5, azim: 250, turb: 10, rayleigh: 3, sun: 1.8, hemi: 0.7, sky: '#d0906a', groundC: '#3a2a20', fog: '#8a6a5a', fogNear: 40, fogFar: 380, exposure: 0.5, stars: 0.2, ambient: 0.2, sunColor: '#ffb070' },
  night: { elev: -12, azim: 200, turb: 2, rayleigh: 0.3, sun: 0.4, hemi: 0.18, sky: '#304060', groundC: '#101418', fog: '#0c1218', fogNear: 15, fogFar: 170, exposure: 0.6, stars: 1, ambient: 0.05, moon: true },
};

export class Env {
  constructor(scene, renderer, tod = 'day', quality = 'high') {
    this.scene = scene;
    const P = this.P = PRESETS[tod] || PRESETS.day;
    this.tod = tod;
    renderer.toneMappingExposure = P.exposure;
    // 空
    const sky = new Sky();
    sky.scale.setScalar(4000);
    const u = sky.material.uniforms;
    u.turbidity.value = P.turb; u.rayleigh.value = P.rayleigh; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.85;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - P.elev), THREE.MathUtils.degToRad(P.azim));
    u.sunPosition.value.copy(sunDir);
    scene.add(sky);
    this.sky = sky;
    // 夜空を暗く（Sky シェーダーは夜でも明るめなので上からかぶせる）
    if (tod === 'night') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.MeshBasicMaterial({ color: '#05080e', side: THREE.BackSide, transparent: true, opacity: 0.93, fog: false, depthWrite: false }));
      scene.add(dome);
    }
    // 星
    if (P.stars > 0) {
      const n = 2500, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().setFromSphericalCoords(2500, Math.acos(Math.random() * 0.95), Math.random() * Math.PI * 2);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.85 * P.stars, fog: false, depthWrite: false }));
      scene.add(stars);
      // 月
      if (P.moon) {
        const moon = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), new THREE.MeshBasicMaterial({ color: '#e8eef8', fog: false }));
        moon.position.set(-900, 1200, -1400);
        scene.add(moon);
      }
    }
    // 霧
    scene.fog = new THREE.Fog(P.fog, P.fogNear, P.fogFar);
    // ライト
    const hemi = new THREE.HemisphereLight(P.sky, P.groundC, P.hemi);
    scene.add(hemi);
    const amb = new THREE.AmbientLight('#ffffff', P.ambient);
    scene.add(amb);
    const sun = new THREE.DirectionalLight(P.sunColor || (P.moon ? '#8aa8e0' : '#fff2dc'), P.sun);
    this.sunDir = P.elev > 0 ? sunDir.clone() : new THREE.Vector3(-0.4, 0.75, -0.55).normalize();
    sun.castShadow = quality !== 'low';
    const ss = quality === 'high' ? 4096 : 2048;
    sun.shadow.mapSize.set(ss, ss);
    const S = quality === 'high' ? 70 : 55;
    sun.shadow.camera.left = -S; sun.shadow.camera.right = S; sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun); scene.add(sun.target);
    this.sun = sun; this.hemi = hemi;
    this.shadowSize = S;
  }
  update(camPos) {
    // シャドウカメラをプレイヤーに追従（テクセル単位にスナップ）
    const s = this.sun;
    const texel = (this.shadowSize * 2) / s.shadow.mapSize.x;
    const cx = Math.round(camPos.x / texel) * texel, cz = Math.round(camPos.z / texel) * texel;
    s.target.position.set(cx, 0, cz);
    s.position.set(cx + this.sunDir.x * 200, this.sunDir.y * 200, cz + this.sunDir.z * 200);
    this.sky.position.copy(camPos);
  }
}

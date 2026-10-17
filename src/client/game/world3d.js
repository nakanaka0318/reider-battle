// マップの 3D 描画（静的ジオメトリの結合・地形・植生・コンテナ・扉）
import * as THREE from 'three';
import { getMaterial, texScale, getTex } from './textures.js';
import { makeRng } from '../../shared/math.js';
import { inNoTree, nearRoad } from '../../shared/map.js';

const SKIP = new Set(['invisible', 'tree', 'door', 'container_obj']);

// コンテナの見た目（ローカル座標：原点＝底面中央、正面 -Z）
const CMODEL = {
  crate: [[-0.5, 0, -0.4, 0.5, 0.8, 0.4, 'crate']],
  toolbox: [[-0.3, 0, -0.16, 0.3, 0.3, 0.16, 'metal', '#b02a20'], [-0.12, 0.3, -0.02, 0.12, 0.36, 0.02, 'metal', '#222']],
  weapon_box: [[-0.65, 0, -0.27, 0.65, 0.42, 0.27, 'metal', '#3e4a30'], [-0.66, 0.18, -0.28, 0.66, 0.24, 0.28, 'metal', '#2a3220'], [-0.4, 0.3, -0.29, -0.3, 0.38, -0.27, 'metal', '#999'], [0.3, 0.3, -0.29, 0.4, 0.38, -0.27, 'metal', '#999']],
  ammo_box: [[-0.3, 0, -0.2, 0.3, 0.38, 0.2, 'metal', '#4f5a38'], [-0.1, 0.38, -0.03, 0.1, 0.42, 0.03, 'metal', '#333']],
  military_crate: [[-0.75, 0, -0.45, 0.75, 0.85, 0.45, 'metal', '#4c5a3a'], [-0.76, 0.1, -0.46, 0.76, 0.2, 0.46, 'metal', '#3a4429'], [-0.76, 0.65, -0.46, 0.76, 0.75, 0.46, 'metal', '#3a4429']],
  med_case: [[-0.3, 0, -0.2, 0.3, 0.4, 0.2, 'metal', '#e0e0dc'], [-0.08, 0.15, -0.21, 0.08, 0.25, -0.2, 'metal', '#c02020'], [-0.03, 0.1, -0.21, 0.03, 0.3, -0.2, 'metal', '#c02020']],
  filing: [[-0.3, 0, -0.3, 0.3, 1.35, 0.3, 'metal', '#6a7078'], ...[0.2, 0.52, 0.84, 1.16].map((y) => [-0.25, y, -0.31, 0.25, y + 0.26, -0.3, 'metal', '#5a6068']), ...[0.3, 0.62, 0.94, 1.26].map((y) => [-0.06, y, -0.32, 0.06, y + 0.03, -0.31, 'metal', '#ccc'])],
  pc: [[-0.12, 0, -0.22, 0.12, 0.42, 0.22, 'metal', '#2a2c30'], [-0.08, 0.3, -0.23, 0.08, 0.32, -0.22, 'metal', '#3af06a']],
  safe: [[-0.4, 0, -0.4, 0.4, 1.0, 0.4, 'metal', '#2e3236'], [-0.33, 0.08, -0.41, 0.33, 0.92, -0.4, 'metal', '#3a3e42'], [0.1, 0.45, -0.44, 0.22, 0.57, -0.41, 'metal', '#b0a060']],
  jacket: [[-0.25, -0.8, -0.06, 0.25, 0, 0.06, 'fabric', '#4a5a6a'], [-0.3, -0.75, -0.05, -0.22, -0.2, 0.05, 'fabric', '#3a4a5a'], [0.22, -0.75, -0.05, 0.3, -0.2, 0.05, 'fabric', '#3a4a5a']],
  duffel: [[-0.45, 0, -0.22, 0.45, 0.38, 0.22, 'fabric', '#3d4a38'], [-0.3, 0.38, -0.03, 0.3, 0.42, 0.03, 'fabric', '#222']],
  fridge: [[-0.4, 0, -0.35, 0.4, 1.8, 0.35, 'metal', '#d8d8d0'], [-0.39, 1.15, -0.36, 0.39, 1.17, -0.35, 'metal', '#999'], [0.28, 1.25, -0.39, 0.32, 1.6, -0.36, 'metal', '#888'], [0.28, 0.5, -0.39, 0.32, 1.0, -0.36, 'metal', '#888']],
  locker: [[-0.45, 0, -0.27, 0.45, 1.9, 0.27, 'metal', '#5a6a7a'], [-0.01, 0.05, -0.28, 0.01, 1.85, -0.27, 'metal', '#3a4a5a'], ...[-0.3, 0.15].map((x) => [x, 1.5, -0.28, x + 0.15, 1.7, -0.275, 'metal', '#3a4a5a'])],
  register: [[-0.22, 0, -0.2, 0.22, 0.12, 0.2, 'metal', '#2a2a2a'], [-0.18, 0.12, 0, 0.18, 0.3, 0.05, 'metal', '#3a3a3a']],
  drawer: [[-0.45, 0, -0.25, 0.45, 0.8, 0.25, 'wood', '#7a5a3a'], [-0.4, 0.45, -0.26, 0.4, 0.7, -0.25, 'wood', '#6a4a2a'], [-0.4, 0.1, -0.26, 0.4, 0.38, -0.25, 'wood', '#6a4a2a']],
  drawer_small: [[-0.25, 0, -0.2, 0.25, 0.1, 0.2, 'wood', '#5a3a20']],
  arc_cache: [[-0.6, 0, -0.6, 0.6, 0.7, 0.6, 'arc_metal'], [-0.45, 0.7, -0.45, 0.45, 0.9, 0.45, 'arc_metal', '#8aa0b0']],
  lab_case: [[-0.45, 0, -0.3, 0.45, 0.5, 0.3, 'metal', '#c8ccd0'], [-0.46, 0.2, -0.31, 0.46, 0.26, 0.31, 'metal', '#2a6ad0']],
  supply_drop: [[-0.8, 0, -0.8, 0.8, 1.2, 0.8, 'metal', '#3a5a8a'], [-0.82, 0.3, -0.82, 0.82, 0.4, 0.82, 'metal', '#c8a020'], [-0.82, 0.9, -0.82, 0.82, 1.0, 0.82, 'metal', '#c8a020']],
};

function rotXZ(x, z, rot) {
  switch (rot & 3) {
    case 1: return [-z, x];
    case 2: return [-x, -z];
    case 3: return [z, -x];
    default: return [x, z];
  }
}

export function containerBoxes(c) {
  const parts = CMODEL[c.type === 'drawer' && c.small ? 'drawer_small' : c.type] || CMODEL.crate;
  const out = [];
  for (const [x0, y0, z0, x1, y1, z1, mat, color] of parts) {
    const [ax, az] = rotXZ(x0, z0, c.rot), [bx, bz] = rotXZ(x1, z1, c.rot);
    out.push({ min: [c.x + Math.min(ax, bx), c.y + y0, c.z + Math.min(az, bz)], max: [c.x + Math.max(ax, bx), c.y + y1, c.z + Math.max(az, bz)], mat, color });
  }
  return out;
}

class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  quad(p, n, uv, c) {
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.col.push(c[i][0], c[i][1], c[i][2]);
    }
    const b = this.n;
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.n += 4;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65000 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const tmpC = new THREE.Color();
function addBox(gb, b, scale) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  tmpC.set(b.color || '#ffffff');
  const base = [tmpC.r, tmpC.g, tmpC.b];
  // 簡易 AO：地面付近を暗く
  const ao = (y) => {
    if (y0 > 0.5) return 1;
    return 0.62 + 0.38 * Math.min(1, Math.max(0, y) / 1.4);
  };
  const col = (y) => { const k = ao(y); return [base[0] * k, base[1] * k, base[2] * k]; };
  const s = 1 / scale;
  // +X
  gb.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[z1 * s, y0 * s], [z0 * s, y0 * s], [z0 * s, y1 * s], [z1 * s, y1 * s]].map(([u, v]) => [-u, v]), [col(y0), col(y0), col(y1), col(y1)]);
  // -X
  gb.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0 * s, y0 * s], [z1 * s, y0 * s], [z1 * s, y1 * s], [z0 * s, y1 * s]], [col(y0), col(y0), col(y1), col(y1)]);
  // +Z
  gb.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0 * s, y0 * s], [x1 * s, y0 * s], [x1 * s, y1 * s], [x0 * s, y1 * s]], [col(y0), col(y0), col(y1), col(y1)]);
  // -Z
  gb.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[-x1 * s, y0 * s], [-x0 * s, y0 * s], [-x0 * s, y1 * s], [-x1 * s, y1 * s]], [col(y0), col(y0), col(y1), col(y1)]);
  // +Y
  gb.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]], [col(y1), col(y1), col(y1), col(y1)]);
  // -Y（地面に接していなければ）
  if (y0 > 0.02) gb.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]], [col(y0), col(y0), col(y0), col(y0)].map((c) => c.map((v) => v * 0.8)));
}

export function buildWorld3D(scene, map, quality = 'high') {
  const group = new THREE.Group();
  scene.add(group);
  const builders = {};
  const all = [...map.boxes.filter((b) => !b.hidden && !SKIP.has(b.mat))];
  for (const c of map.containers) all.push(...containerBoxes(c));
  for (const b of all) {
    const mat = b.mat;
    (builders[mat] ||= new GeoBuilder());
    addBox(builders[mat], b, texScale(mat));
  }
  for (const [mat, gb] of Object.entries(builders)) {
    const mesh = new THREE.Mesh(gb.build(), getMaterial(mat));
    mesh.castShadow = mat !== 'fence';
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }

  // ------------------------------------------------------------ 地面
  const H = map.half + 30;
  const seg = 120;
  const gg = new THREE.PlaneGeometry(H * 2, H * 2, seg, seg);
  gg.rotateX(-Math.PI / 2);
  const rng = makeRng(42);
  const gcol = [];
  const p = gg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let v = 0.85 + rng() * 0.25;
    let r = v, g = v, b = v;
    // 建物・道路の周辺は土っぽく
    if (inNoTree(map, x, z)) { r *= 1.08; g *= 0.92; b *= 0.8; }
    if (nearRoad(map, x, z, 3)) { r *= 0.95; g *= 0.88; b *= 0.8; }
    if (z > map.water.z - 6) { r *= 0.9; g *= 0.85; b *= 0.75; }
    gcol.push(r, g, b);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3));
  const grassT = getTex('grass');
  const gt = grassT.t.clone(); gt.needsUpdate = true;
  gt.repeat.set((H * 2) / grassT.scale, (H * 2) / grassT.scale);
  const groundMat = new THREE.MeshStandardMaterial({ map: gt, roughness: 1, vertexColors: true, bumpMap: gt, bumpScale: 0.6 });
  const ground = new THREE.Mesh(gg, groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // 道路
  const asph = getTex('asphalt');
  for (const r of map.roads) {
    const dx = r.x1 - r.x0, dz = r.z1 - r.z0;
    const L = Math.hypot(dx, dz) + r.w;
    const geo = new THREE.PlaneGeometry(L, r.w);
    geo.rotateX(-Math.PI / 2);
    const t = asph.t.clone(); t.needsUpdate = true;
    t.repeat.set(L / (r.w * 2), 1);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    m.position.set((r.x0 + r.x1) / 2, 0.025, (r.z0 + r.z1) / 2);
    m.rotation.y = -Math.atan2(dz, dx);
    m.receiveShadow = true;
    group.add(m);
  }
  // デカール
  for (const d of map.decals) {
    if (d.type === 'helipad') {
      const m = new THREE.Mesh(new THREE.CircleGeometry(d.r, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: getTex('helipad').t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
      m.position.set(d.x, 0.04, d.z); m.receiveShadow = true; group.add(m);
    } else if (d.type === 'rail') {
      const L = Math.hypot(d.x1 - d.x0, d.z1 - d.z0);
      const t = getTex('rail').t.clone(); t.needsUpdate = true; t.repeat.set(1, L / 3);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3, L).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
      m.position.set((d.x0 + d.x1) / 2 + 9, 0.035, (d.z0 + d.z1) / 2); m.receiveShadow = true; group.add(m);
    }
  }

  // 海
  const wt = getTex('water');
  const wtx = wt.t.clone(); wtx.needsUpdate = true; wtx.repeat.set(40, 10);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 300).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1e3e4c', roughness: 0.12, metalness: 0.35, bumpMap: wtx, bumpScale: 0.8 }));
  water.position.set(0, -0.35, map.water.z + 150);
  group.add(water);

  // ------------------------------------------------------------ 植生
  const veg = buildVegetation(map, quality);
  group.add(veg.group);

  // 街灯の灯り
  const lampGroup = new THREE.Group();
  const glowTex = makeGlowTexture();
  for (const l of map.lamps) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: l.red ? '#ff2020' : '#ffd890', emissiveIntensity: 0 }));
    head.position.set(l.x, l.y + 0.1, l.z);
    lampGroup.add(head);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: l.red ? '#ff3020' : '#ffd890', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    sp.position.set(l.x, l.y - 0.05, l.z); sp.scale.set(3, 3, 1);
    lampGroup.add(sp);
    l.head = head; l.sprite = sp;
  }
  group.add(lampGroup);

  return { group, water: wtx, veg, lamps: map.lamps, groundMat };
}

export function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// 植生：木・茂み・草
function buildVegetation(map, quality) {
  const group = new THREE.Group();
  const windUniform = { value: 0 };
  // 松
  const pine = mergeColored([
    [new THREE.CylinderGeometry(0.12, 0.22, 3.2, 6).translate(0, 1.6, 0), '#4a3424'],
    [new THREE.ConeGeometry(1.9, 3.2, 7).translate(0, 3.6, 0), '#2a4a24'],
    [new THREE.ConeGeometry(1.5, 2.8, 7).translate(0, 5.2, 0), '#2e5228'],
    [new THREE.ConeGeometry(1.0, 2.4, 7).translate(0, 6.7, 0), '#34582c'],
  ]);
  const birch = mergeColored([
    [new THREE.CylinderGeometry(0.1, 0.16, 5.5, 6).translate(0, 2.75, 0), '#d8d4c8'],
    [new THREE.IcosahedronGeometry(1.9, 1).scale(1, 1.3, 1).translate(0, 5.6, 0), '#5a7a32'],
    [new THREE.IcosahedronGeometry(1.4, 1).translate(0.9, 4.6, 0.4), '#4f6e2c'],
  ]);
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  addWind(treeMat, windUniform, 0.08);
  for (const [kind, geo] of [['pine', pine], ['birch', birch]]) {
    const list = map.trees.filter((t) => t.kind === kind);
    const im = new THREE.InstancedMesh(geo, treeMat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pp = new THREE.Vector3();
    const col = new THREE.Color();
    list.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      s.set(t.s, t.s * (0.9 + (i % 7) * 0.04), t.s);
      pp.set(t.x, 0, t.z);
      m.compose(pp, q, s);
      im.setMatrixAt(i, m);
      col.setHSL(0.25 + ((i * 37) % 10) / 200, 0.3, 0.42 + ((i * 13) % 10) / 60);
      im.setColorAt(i, col.multiplyScalar(2.2));
    });
    im.castShadow = true; im.receiveShadow = true;
    group.add(im);
  }
  // 茂み
  const bushGeo = new THREE.IcosahedronGeometry(1, 1).scale(1.2, 0.75, 1.2).translate(0, 0.45, 0);
  const bushMat = new THREE.MeshStandardMaterial({ color: '#3e5a2a', roughness: 1, flatShading: true });
  addWind(bushMat, windUniform, 0.05);
  const bim = new THREE.InstancedMesh(bushGeo, bushMat, map.bushes.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pp = new THREE.Vector3(), col = new THREE.Color();
  map.bushes.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot);
    s.set(b.s, b.s, b.s); pp.set(b.x, 0, b.z);
    m.compose(pp, q, s); bim.setMatrixAt(i, m);
    col.setHSL(0.24 + (i % 9) / 150, 0.35, 0.3 + (i % 5) / 40); bim.setColorAt(i, col.multiplyScalar(2.4));
  });
  bim.castShadow = true; bim.receiveShadow = true;
  group.add(bim);
  // 草
  if (quality !== 'low') {
    const n = quality === 'high' ? 26000 : 12000;
    const blade = makeGrassTexture();
    const g1 = new THREE.PlaneGeometry(0.9, 0.6).translate(0, 0.3, 0);
    const g2 = g1.clone().rotateY(Math.PI / 3), g3 = g1.clone().rotateY(-Math.PI / 3);
    const gGeo = mergeGeos([g1, g2, g3]);
    const gMat = new THREE.MeshStandardMaterial({ map: blade, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: '#9ab070' });
    addWind(gMat, windUniform, 0.15, true);
    const gim = new THREE.InstancedMesh(gGeo, gMat, n);
    const rng = makeRng(99);
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const x = (rng() - 0.5) * map.half * 1.9, z = (rng() - 0.5) * map.half * 1.9;
      if (inNoTree(map, x, z) || nearRoad(map, x, z, 1) || z > map.water.z - 4) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.28);
      const sc = 0.6 + rng() * 0.9;
      s.set(sc, sc * (0.7 + rng() * 0.6), sc); pp.set(x, 0, z);
      m.compose(pp, q, s); gim.setMatrixAt(k, m);
      col.setHSL(0.2 + rng() * 0.08, 0.4, 0.45 + rng() * 0.2); gim.setColorAt(k, col);
      k++;
    }
    gim.count = k;
    gim.receiveShadow = true;
    group.add(gim);
  }
  return { group, wind: windUniform };
}

function addWind(mat, uniform, amp, grass = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = uniform;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 wp = instanceMatrix * vec4(transformed, 1.0);
        float h = max(0.0, transformed.y) * ${grass ? '1.6' : '0.15'};
        float ph = wp.x * 0.13 + wp.z * 0.11;
        transformed.x += sin(uWind * 1.7 + ph) * ${amp.toFixed(3)} * h;
        transformed.z += cos(uWind * 1.3 + ph * 1.3) * ${amp.toFixed(3)} * h * 0.6;
      #endif
    `);
  };
}

function makeGrassTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  const rng = makeRng(5);
  for (let i = 0; i < 40; i++) {
    const x = rng() * 128, w = 1.5 + rng() * 2.5, hh = 30 + rng() * 34;
    const gr = g.createLinearGradient(0, 64, 0, 64 - hh);
    gr.addColorStop(0, '#3a4a20'); gr.addColorStop(1, rng() < 0.3 ? '#b0b070' : '#8aa850');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - w, 64); g.quadraticCurveTo(x + (rng() - 0.5) * 10, 64 - hh * 0.6, x + (rng() - 0.5) * 16, 64 - hh); g.lineTo(x + w, 64); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mergeColored(parts) {
  const geos = parts.map(([g, c]) => {
    const gg = g.toNonIndexed();
    const col = new THREE.Color(c);
    const arr = new Float32Array(gg.attributes.position.count * 3);
    for (let i = 0; i < gg.attributes.position.count; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    gg.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    gg.deleteAttribute('uv');
    return gg;
  });
  return mergeGeos(geos);
}
export function mergeGeos(geos) {
  const nonIdx = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const attrs = Object.keys(nonIdx[0].attributes);
  const out = new THREE.BufferGeometry();
  for (const a of attrs) {
    if (!nonIdx.every((g) => g.attributes[a])) continue;
    const size = nonIdx[0].attributes[a].itemSize;
    const total = nonIdx.reduce((s, g) => s + g.attributes[a].count, 0);
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const g of nonIdx) { arr.set(g.attributes[a].array, off); off += g.attributes[a].array.length; }
    out.setAttribute(a, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  return out;
}

// 扉
export function buildDoors(scene, doors) {
  const out = {};
  for (const d of doors) {
    const pivot = new THREE.Group();
    const w = d.w - 0.04, hh = d.h - 0.02;
    const mat = getMaterial(d.mat === 'metal' ? 'metal' : 'wood').clone();
    mat.vertexColors = false;
    mat.color = new THREE.Color(d.color || (d.locked ? '#7a8088' : '#a08060'));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.06), mat);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: '#c8b060', metalness: 0.8, roughness: 0.3 }));
    knob.position.set(w - 0.12, 1.0 - hh / 2, 0.06);
    const knob2 = knob.clone(); knob2.position.z = -0.06;
    panel.position.set(w / 2, hh / 2, 0);
    knob.position.x = w - 0.12; knob.position.y = 1.0;
    knob2.position.x = w - 0.12; knob2.position.y = 1.0;
    pivot.add(panel, knob, knob2);
    panel.castShadow = true; panel.receiveShadow = true;
    if (d.axis === 'x') { pivot.position.set(d.x - d.w / 2 + 0.02, d.y0 + 0.01, d.z); pivot.rotation.y = 0; }
    else { pivot.position.set(d.x, d.y0 + 0.01, d.z + d.w / 2 - 0.02); pivot.rotation.y = Math.PI / 2; }
    pivot.userData.base = pivot.rotation.y;
    pivot.userData.cur = d.open ? 1 : 0;
    pivot.userData.target = d.open ? 1 : 0;
    pivot.rotation.y = pivot.userData.base + pivot.userData.cur * 1.75;
    scene.add(pivot);
    out[d.id] = pivot;
  }
  return out;
}

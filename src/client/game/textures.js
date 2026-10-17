// プロシージャルテクスチャ（Canvas 生成）
import * as THREE from 'three';
import { makeRng } from '../../shared/math.js';

const cache = {};
let maxAniso = 4;
export function setAniso(n) { maxAniso = n; }

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d', { willReadFrequently: true }); return c; }
function tex(c, rep = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function noise(g, w, h, rng, count, sMin, sMax, colFn) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colFn(rng());
    const s = sMin + rng() * (sMax - sMin);
    g.fillRect(rng() * w, rng() * h, s, s);
  }
}
// 値ノイズ（滑らかなムラ）
function cloud(g, w, h, rng, scale, alpha, dark = true) {
  const n = Math.ceil(w / scale) + 2;
  const vals = [];
  for (let i = 0; i < n * n; i++) vals.push(rng());
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / scale, fy = y / scale;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const v00 = vals[(iy % n) * n + (ix % n)], v10 = vals[(iy % n) * n + ((ix + 1) % n)];
    const v01 = vals[((iy + 1) % n) * n + (ix % n)], v11 = vals[((iy + 1) % n) * n + ((ix + 1) % n)];
    const v = (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy;
    const k = (dark ? (v - 0.5) : v) * alpha * 255;
    const i = (y * w + x) * 4;
    d[i] = clamp8(d[i] + k); d[i + 1] = clamp8(d[i + 1] + k); d[i + 2] = clamp8(d[i + 2] + k);
  }
  g.putImageData(img, 0, 0);
}
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

const GEN = {
  concrete(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#9a9a94'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 48, 0.22); cloud(g, 256, 256, rng, 12, 0.1);
    noise(g, 256, 256, rng, 3000, 1, 2, (r) => `rgba(${r < 0.5 ? 60 : 200},${r < 0.5 ? 60 : 200},${r < 0.5 ? 58 : 196},.18)`);
    // 型枠の線
    g.strokeStyle = 'rgba(40,40,38,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(50,50,48,.5)'; g.beginPath(); g.arc(rng() * 256, rng() * 256, 1.5, 0, 7); g.fill(); }
    // 汚れの垂れ
    for (let i = 0; i < 10; i++) { const x = rng() * 256; const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(40,36,30,.18)'); gr.addColorStop(1, 'rgba(40,36,30,0)'); g.fillStyle = gr; g.fillRect(x, 0, 2 + rng() * 8, 120 + rng() * 136); }
    return { c, scale: 3 };
  },
  concrete_floor(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#8a8a84'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 64, 0.25); cloud(g, 256, 256, rng, 8, 0.06);
    g.strokeStyle = 'rgba(30,30,28,.5)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254);
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(30,25,20,${0.08 + rng() * 0.12})`; g.beginPath(); g.ellipse(rng() * 256, rng() * 256, 10 + rng() * 40, 6 + rng() * 25, rng() * 3, 0, 7); g.fill(); }
    return { c, scale: 4 };
  },
  brick(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, 256, 256);
    const bh = 256 / 16, bw = 256 / 4;
    for (let row = 0; row < 16; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 5; col++) {
        const v = 0.75 + rng() * 0.35;
        g.fillStyle = `rgb(${(178 * v) | 0},${(98 * v) | 0},${(72 * v) | 0})`;
        g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 3);
      }
    }
    cloud(g, 256, 256, rng, 32, 0.18);
    noise(g, 256, 256, rng, 2500, 1, 2, () => 'rgba(0,0,0,.12)');
    return { c, scale: 2.4 };
  },
  plaster(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#d0ccc4'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 40, 0.16); cloud(g, 256, 256, rng, 6, 0.06);
    for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(60,55,50,.25)'; g.lineWidth = 1; g.beginPath(); let x = rng() * 256, y = rng() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 30; y += rng() * 20; g.lineTo(x, y); } g.stroke(); }
    const gr = g.createLinearGradient(0, 200, 0, 256); gr.addColorStop(0, 'rgba(60,50,40,0)'); gr.addColorStop(1, 'rgba(60,50,40,.3)'); g.fillStyle = gr; g.fillRect(0, 200, 256, 56);
    return { c, scale: 3 };
  },
  metal(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#a0a4a8'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 32, 0.2);
    for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(255,255,255,${rng() * 0.06})`; g.beginPath(); const y = rng() * 256; g.moveTo(0, y); g.lineTo(256, y + (rng() - 0.5) * 4); g.stroke(); }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(120,60,20,${0.1 + rng() * 0.2})`; g.beginPath(); g.ellipse(rng() * 256, rng() * 256, 4 + rng() * 20, 3 + rng() * 14, rng() * 3, 0, 7); g.fill(); }
    return { c, scale: 2 };
  },
  metal_wall(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#b0b4b8'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0);
      gr.addColorStop(0, 'rgba(0,0,0,.22)'); gr.addColorStop(0.3, 'rgba(255,255,255,.18)'); gr.addColorStop(0.6, 'rgba(0,0,0,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
      g.fillStyle = gr; g.fillRect(x, 0, 16, 256);
    }
    cloud(g, 256, 256, rng, 40, 0.15);
    for (let i = 0; i < 20; i++) { const x = rng() * 256; const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(110,60,20,.3)'); gr.addColorStop(1, 'rgba(110,60,20,0)'); g.fillStyle = gr; g.fillRect(x, rng() * 128, 3 + rng() * 6, 60 + rng() * 120); }
    return { c, scale: 4 };
  },
  container(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 21) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, 0, 4, 256);
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 6, 0, 6, 256);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 14, 0, 4, 256);
    }
    cloud(g, 256, 256, rng, 30, 0.2);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(100,50,20,${0.15 + rng() * 0.25})`; g.beginPath(); g.ellipse(rng() * 256, rng() * 256, 2 + rng() * 12, 2 + rng() * 8, rng() * 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = 'bold 20px sans-serif'; g.fillText('GRVU ' + ((rng() * 900000) | 0), 20, 40);
    return { c, scale: 2.6 };
  },
  wood(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#a07850'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(${rng() < 0.5 ? '60,35,15' : '200,160,110'},${rng() * 0.12})`; g.fillRect(0, y, 256, 2); }
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(40,25,10,.25)'; g.beginPath(); g.ellipse(rng() * 256, rng() * 256, 8 + rng() * 10, 3, 0, 0, 7); g.stroke(); }
    for (let y = 0; y < 256; y += 32) { g.fillStyle = 'rgba(20,10,5,.45)'; g.fillRect(0, y, 256, 2); }
    return { c, scale: 2 };
  },
  wood_floor(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#8a6440'; g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) {
      for (let k = 0; k < 3; k++) {
        const v = 0.8 + rng() * 0.3, x = k * 96 + (row % 2) * 48;
        g.fillStyle = `rgb(${(150 * v) | 0},${(105 * v) | 0},${(65 * v) | 0})`;
        g.fillRect(x, row * 32, 94, 30);
      }
    }
    for (let y = 0; y < 256; y += 3) { g.fillStyle = `rgba(40,25,10,${rng() * 0.08})`; g.fillRect(0, y, 256, 1); }
    cloud(g, 256, 256, rng, 50, 0.12);
    return { c, scale: 3 };
  },
  wood_wall(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#9a7a5a'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 21) {
      const v = 0.85 + rng() * 0.25;
      g.fillStyle = `rgb(${(170 * v) | 0},${(130 * v) | 0},${(90 * v) | 0})`; g.fillRect(0, y, 256, 19);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 19, 256, 2);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, y, 256, 2);
    }
    cloud(g, 256, 256, rng, 36, 0.18);
    return { c, scale: 3 };
  },
  crate(rng) {
    const c = canvas(128), g = c.getContext('2d');
    g.fillStyle = '#9a7848'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(60,35,15,${rng() * 0.15})`; g.fillRect(0, y, 128, 2); }
    g.strokeStyle = '#5a3a1a'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
    g.beginPath(); g.moveTo(8, 8); g.lineTo(120, 120); g.stroke();
    g.fillStyle = 'rgba(30,20,10,.6)'; g.font = 'bold 14px sans-serif'; g.fillText('FRAGILE', 34, 70);
    return { c, scale: 1 };
  },
  tile(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#6a6a66'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = 0.85 + rng() * 0.2;
      const base = (x + y) % 2 ? [200, 196, 186] : [176, 172, 164];
      g.fillStyle = `rgb(${(base[0] * v) | 0},${(base[1] * v) | 0},${(base[2] * v) | 0})`;
      g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
    }
    cloud(g, 256, 256, rng, 40, 0.15);
    return { c, scale: 2.5 };
  },
  lab_floor(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#c8ccd0'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = `rgba(0,0,0,${rng() * 0.05})`; g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62); }
    g.strokeStyle = 'rgba(80,90,100,.4)';
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
    cloud(g, 256, 256, rng, 60, 0.08);
    return { c, scale: 4 };
  },
  carpet(rng) {
    const c = canvas(128), g = c.getContext('2d');
    g.fillStyle = '#6a3a3a'; g.fillRect(0, 0, 128, 128);
    noise(g, 128, 128, rng, 4000, 1, 1, (r) => `rgba(${r < 0.5 ? 0 : 255},${r < 0.5 ? 0 : 200},${r < 0.5 ? 0 : 200},.08)`);
    g.strokeStyle = 'rgba(200,160,80,.3)'; g.lineWidth = 3; g.strokeRect(10, 10, 108, 108);
    cloud(g, 128, 128, rng, 30, 0.15);
    return { c, scale: 2 };
  },
  dirt_floor(rng) { return GEN.dirt(rng); },
  roof(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#5a5a58'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 30, 0.25); noise(g, 256, 256, rng, 5000, 1, 2, (r) => `rgba(${r < 0.5 ? 0 : 255},${r < 0.5 ? 0 : 255},${r < 0.5 ? 0 : 255},.07)`);
    return { c, scale: 4 };
  },
  cliff(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#6e6a60'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 64, 0.35); cloud(g, 256, 256, rng, 16, 0.2); cloud(g, 256, 256, rng, 4, 0.1);
    for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(30,28,24,.4)'; g.lineWidth = 1 + rng() * 2; g.beginPath(); let x = rng() * 256, y = rng() * 256; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rng() - 0.5) * 40; y += (rng() - 0.3) * 30; g.lineTo(x, y); } g.stroke(); }
    // 苔
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(70,90,40,${0.15 + rng() * 0.2})`; g.beginPath(); g.ellipse(rng() * 256, rng() * 256, 10 + rng() * 30, 5 + rng() * 15, rng() * 3, 0, 7); g.fill(); }
    return { c, scale: 8 };
  },
  rock(rng) { return GEN.cliff(rng); },
  sandbag(rng) {
    const c = canvas(128), g = c.getContext('2d');
    g.fillStyle = '#8a7a58'; g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 4; row++) for (let k = -1; k < 3; k++) {
      const x = k * 56 + (row % 2) * 28;
      const gr = g.createRadialGradient(x + 28, row * 32 + 16, 4, x + 28, row * 32 + 16, 34);
      gr.addColorStop(0, '#b0a07a'); gr.addColorStop(1, '#5a4a30');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x + 28, row * 32 + 16, 27, 15, 0, 0, 7); g.fill();
    }
    noise(g, 128, 128, rng, 1500, 1, 1, () => 'rgba(0,0,0,.15)');
    return { c, scale: 1.6 };
  },
  hesco(rng) {
    const c = canvas(128), g = c.getContext('2d');
    g.fillStyle = '#9a8a62'; g.fillRect(0, 0, 128, 128);
    cloud(g, 128, 128, rng, 20, 0.25);
    g.strokeStyle = 'rgba(60,60,60,.7)'; g.lineWidth = 1.5;
    for (let i = 0; i <= 128; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
    g.fillStyle = 'rgba(40,40,40,.6)'; g.fillRect(0, 0, 4, 128); g.fillRect(62, 0, 4, 128);
    return { c, scale: 1.2 };
  },
  fence(rng) {
    const c = canvas(128), g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#8a9096'; g.lineWidth = 2;
    for (let i = -128; i < 256; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
    g.fillStyle = '#6a6e72'; g.fillRect(0, 0, 128, 5); g.fillRect(0, 0, 5, 128);
    void rng;
    return { c, scale: 2 };
  },
  fabric(rng) {
    const c = canvas(128), g = c.getContext('2d');
    g.fillStyle = '#b0aaa0'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 2) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(i, 0, 1, 128); g.fillRect(0, i, 128, 1); }
    cloud(g, 128, 128, rng, 24, 0.18);
    return { c, scale: 1.5 };
  },
  tarp(rng) { return GEN.fabric(rng); },
  rubber(rng) {
    const c = canvas(64), g = c.getContext('2d');
    g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 64; i += 6) { g.fillStyle = '#1a1a1a'; g.fillRect(0, i, 64, 3); }
    void rng;
    return { c, scale: 1 };
  },
  car(rng) {
    const c = canvas(128), g = c.getContext('2d');
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128);
    cloud(g, 128, 128, rng, 24, 0.12);
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(110,60,20,${0.2 + rng() * 0.3})`; g.beginPath(); g.ellipse(rng() * 128, rng() * 128, 2 + rng() * 8, 2 + rng() * 6, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 60, 128, 2);
    return { c, scale: 2 };
  },
  glass_dark(rng) {
    const c = canvas(64), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#506070'); gr.addColorStop(0.5, '#202a34'); gr.addColorStop(1, '#3a4a5a');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    void rng;
    return { c, scale: 2 };
  },
  stair(rng) { return GEN.concrete_floor(rng); },
  arc_metal(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#3a4248'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 30, 0.2);
    g.strokeStyle = 'rgba(20,24,28,.8)'; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { g.beginPath(); const x = rng() * 256, y = rng() * 256; g.moveTo(x, y); g.lineTo(x + (rng() < 0.5 ? 60 : 0), y + (rng() < 0.5 ? 0 : 60)); g.stroke(); }
    for (let i = 0; i < 8; i++) { g.strokeStyle = `rgba(80,220,255,${0.4 + rng() * 0.4})`; g.lineWidth = 2; g.beginPath(); const x = rng() * 256, y = rng() * 256; g.moveTo(x, y); g.lineTo(x + 40, y); g.lineTo(x + 40, y + 30); g.stroke(); }
    return { c, scale: 3 };
  },
  tunnel_dark() {
    const c = canvas(32), g = c.getContext('2d');
    g.fillStyle = '#040404'; g.fillRect(0, 0, 32, 32);
    return { c, scale: 4 };
  },
  // 地面
  grass(rng) {
    const c = canvas(512), g = c.getContext('2d');
    g.fillStyle = '#4a5a30'; g.fillRect(0, 0, 512, 512);
    cloud(g, 512, 512, rng, 96, 0.3); cloud(g, 512, 512, rng, 24, 0.18);
    for (let i = 0; i < 26000; i++) {
      const x = rng() * 512, y = rng() * 512, l = 2 + rng() * 5;
      const v = rng();
      g.strokeStyle = v < 0.33 ? 'rgba(90,110,50,.5)' : v < 0.66 ? 'rgba(50,70,30,.5)' : 'rgba(120,120,60,.35)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 2, y - l); g.stroke();
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,75,50,${0.15 + rng() * 0.2})`; g.beginPath(); g.ellipse(rng() * 512, rng() * 512, 8 + rng() * 30, 6 + rng() * 20, rng() * 3, 0, 7); g.fill(); }
    return { c, scale: 10 };
  },
  dirt(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#6a5a44'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 40, 0.3); cloud(g, 256, 256, rng, 10, 0.15);
    noise(g, 256, 256, rng, 3000, 1, 3, (r) => `rgba(${r < 0.5 ? 40 : 160},${r < 0.5 ? 32 : 140},${r < 0.5 ? 20 : 110},.25)`);
    return { c, scale: 4 };
  },
  asphalt(rng) {
    const c = canvas(512, 256), g = c.getContext('2d');
    g.fillStyle = '#3c3e3e'; g.fillRect(0, 0, 512, 256);
    cloud(g, 512, 256, rng, 50, 0.18); noise(g, 512, 256, rng, 16000, 1, 2, (r) => `rgba(${r < 0.5 ? 20 : 120},${r < 0.5 ? 20 : 120},${r < 0.5 ? 20 : 118},.3)`);
    // 白線（端）と中央線
    g.fillStyle = 'rgba(220,220,210,.75)'; g.fillRect(0, 12, 512, 5); g.fillRect(0, 239, 512, 5);
    g.fillStyle = 'rgba(220,180,60,.8)'; for (let x = 0; x < 512; x += 64) g.fillRect(x, 125, 36, 6);
    // ひび
    for (let i = 0; i < 25; i++) { g.strokeStyle = 'rgba(15,15,15,.6)'; g.lineWidth = 1; g.beginPath(); let x = rng() * 512, y = rng() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 30; y += (rng() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(20,20,20,.3)'; g.beginPath(); g.ellipse(rng() * 512, rng() * 256, 10 + rng() * 30, 5 + rng() * 15, 0, 0, 7); g.fill(); }
    return { c, scale: 1 };
  },
  water(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    cloud(g, 256, 256, rng, 32, 0.6); cloud(g, 256, 256, rng, 8, 0.3);
    return { c, scale: 12 };
  },
  helipad(rng) {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#4a4c4a'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
    cloud(g, 256, 256, rng, 30, 0.15);
    g.strokeStyle = '#e0d040'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke();
    g.fillStyle = '#e8e8e0'; g.fillRect(78, 68, 24, 120); g.fillRect(154, 68, 24, 120); g.fillRect(78, 116, 100, 24);
    return { c, scale: 1 };
  },
  rail(rng) {
    const c = canvas(128, 256), g = c.getContext('2d');
    g.fillStyle = '#5a5248'; g.fillRect(0, 0, 128, 256);
    noise(g, 128, 256, rng, 3000, 1, 3, (r) => `rgba(${r < 0.5 ? 30 : 150},${r < 0.5 ? 28 : 140},${r < 0.5 ? 25 : 130},.35)`);
    for (let y = 0; y < 256; y += 32) { g.fillStyle = '#4a3a2a'; g.fillRect(8, y + 4, 112, 14); }
    g.fillStyle = '#8a8a90'; g.fillRect(30, 0, 8, 256); g.fillRect(90, 0, 8, 256);
    return { c, scale: 1 };
  },
};

// マテリアル定義
const MAT_DEF = {
  concrete: { tex: 'concrete', rough: 0.95 },
  concrete_floor: { tex: 'concrete_floor', rough: 0.9 },
  stair: { tex: 'concrete_floor', rough: 0.9 },
  brick: { tex: 'brick', rough: 0.95 },
  plaster: { tex: 'plaster', rough: 0.95 },
  metal: { tex: 'metal', rough: 0.55, metal: 0.6 },
  metal_wall: { tex: 'metal_wall', rough: 0.6, metal: 0.45 },
  container: { tex: 'container', rough: 0.65, metal: 0.4 },
  wood: { tex: 'wood', rough: 0.9 },
  wood_wall: { tex: 'wood_wall', rough: 0.9 },
  wood_floor: { tex: 'wood_floor', rough: 0.8 },
  crate: { tex: 'crate', rough: 0.9 },
  tile: { tex: 'tile', rough: 0.5 },
  lab_floor: { tex: 'lab_floor', rough: 0.4 },
  carpet: { tex: 'carpet', rough: 1 },
  dirt_floor: { tex: 'dirt', rough: 1 },
  roof: { tex: 'roof', rough: 0.95 },
  cliff: { tex: 'cliff', rough: 1 },
  rock: { tex: 'rock', rough: 1 },
  sandbag: { tex: 'sandbag', rough: 1 },
  hesco: { tex: 'hesco', rough: 1 },
  fence: { tex: 'fence', rough: 0.6, metal: 0.5, alpha: true },
  fabric: { tex: 'fabric', rough: 1 },
  tarp: { tex: 'tarp', rough: 1 },
  rubber: { tex: 'rubber', rough: 0.9 },
  car: { tex: 'car', rough: 0.45, metal: 0.5 },
  glass_dark: { tex: 'glass_dark', rough: 0.1, metal: 0.8 },
  arc_metal: { tex: 'arc_metal', rough: 0.4, metal: 0.7, emissive: true },
  tunnel_dark: { tex: 'tunnel_dark', rough: 1 },
  sand: { tex: 'dirt', rough: 1 },
};
export function texScale(mat) {
  const d = MAT_DEF[mat] || MAT_DEF.concrete;
  return getTex(d.tex).scale;
}

export function getTex(name) {
  if (cache[name]) return cache[name];
  const gen = GEN[name] || GEN.concrete;
  const r = gen(makeRng(hash(name)));
  cache[name] = { t: tex(r.c), scale: r.scale, canvas: r.c };
  return cache[name];
}
function hash(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

const matCache = {};
export function getMaterial(mat) {
  if (matCache[mat]) return matCache[mat];
  const d = MAT_DEF[mat] || MAT_DEF.concrete;
  const T = getTex(d.tex);
  const m = new THREE.MeshStandardMaterial({
    map: T.t, roughness: d.rough, metalness: d.metal || 0, vertexColors: true,
    bumpMap: T.t, bumpScale: d.alpha ? 0 : 1.2,
  });
  if (d.alpha) { m.transparent = false; m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
  if (d.emissive) { m.emissive = new THREE.Color('#40c8ff'); m.emissiveMap = T.t; m.emissiveIntensity = 0.25; }
  matCache[mat] = m;
  return m;
}

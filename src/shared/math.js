// 共有の数学ユーティリティ（ブラウザ・Node 両対応、three.js 非依存）

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const DEG = Math.PI / 180;

export function v3(x = 0, y = 0, z = 0) { return { x, y, z }; }
export function vcopy(a) { return { x: a.x, y: a.y, z: a.z }; }
export function vadd(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
export function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function vscale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
export function vdot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
export function vlen(a) { return Math.hypot(a.x, a.y, a.z); }
export function vdist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
export function vdist2d(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
export function vnorm(a) {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
export function vcross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

// yaw: Y 軸回り（0 で -Z 方向を向く。three.js のカメラ規約と一致）、pitch: 上向きが正
export function dirFromYawPitch(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}
export function yawTo(from, to) {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// 決定的乱数（mulberry32）
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => Math.floor(a + (b - a + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.weighted = (arr, wf) => {
    let tot = 0;
    for (const e of arr) tot += wf(e);
    let r = rng() * tot;
    for (const e of arr) { r -= wf(e); if (r <= 0) return e; }
    return arr[arr.length - 1];
  };
  rng.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return rng;
}

export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

let uidCounter = 0;
export function uid(prefix = 'i') {
  uidCounter = (uidCounter + 1) % 1e9;
  return prefix + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1e6).toString(36) + uidCounter.toString(36);
}

export function fmtMoney(v) {
  return Math.round(v).toLocaleString('ja-JP') + ' C';
}
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

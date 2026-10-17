// 当たり判定ワールド：空間グリッド、レイキャスト、キャラクター移動、ナビグリッド + A*
export const CONTAINER_SIZES = {
  crate: [1.0, 0.8, 0.8], toolbox: [0.6, 0.35, 0.32], weapon_box: [1.3, 0.42, 0.55], ammo_box: [0.6, 0.4, 0.4],
  military_crate: [1.5, 0.85, 0.9], med_case: [0.6, 0.4, 0.4], filing: [0.6, 1.35, 0.6], pc: [0.3, 0.5, 0.5],
  safe: [0.8, 1.0, 0.8], jacket: [0.5, 0.8, 0.15], duffel: [0.9, 0.4, 0.45], fridge: [0.8, 1.8, 0.7],
  locker: [0.9, 1.9, 0.55], register: [0.45, 0.22, 0.4], drawer: [0.9, 0.8, 0.5], arc_cache: [1.2, 0.9, 1.2],
  lab_case: [0.9, 0.5, 0.6], supply_drop: [1.6, 1.2, 1.6],
};
const NO_COLLIDE = new Set(['jacket', 'register', 'pc', 'toolbox', 'ammo_box', 'med_case']);

export function containerBox(c) {
  const s = CONTAINER_SIZES[c.type] || [0.8, 0.8, 0.8];
  let [w, h, d] = s;
  if (c.small && c.type === 'drawer') { w = 0.5; h = 0.12; d = 0.4; }
  if (c.rot % 2) [w, d] = [d, w];
  return { min: [c.x - w / 2, c.y, c.z - d / 2], max: [c.x + w / 2, c.y + h, c.z + d / 2] };
}

export class World {
  constructor(map) {
    this.map = map;
    this.half = map.half;
    this.cell = 4;
    this.n = Math.ceil((map.half * 2 + 20) / this.cell);
    this.off = map.half + 10;
    this.cells = new Array(this.n * this.n);
    this.boxes = [];
    this.stamp = 0;
    for (const b of map.boxes) this.addBox(b);
    for (const c of map.containers) {
      if (NO_COLLIDE.has(c.type) || c.small) continue;
      const cb = containerBox(c);
      cb.mat = 'container_obj'; cb.container = c.id; cb.hidden = true;
      this.addBox(cb);
    }
    this.doors = {};
    for (const d of map.doors) {
      const t = 0.08;
      const b = d.axis === 'x'
        ? { min: [d.x - d.w / 2, d.y0, d.z - t], max: [d.x + d.w / 2, d.y0 + d.h, d.z + t] }
        : { min: [d.x - t, d.y0, d.z - d.w / 2], max: [d.x + t, d.y0 + d.h, d.z + d.w / 2] };
      b.mat = 'door'; b.door = d.id; b.hidden = true;
      const door = { ...d, box: b };
      b.disabled = door.open;
      this.doors[d.id] = door;
      this.addBox(b);
    }
    this.gates = {};
    for (const b of this.boxes) if (b.gate) (this.gates[b.gate] ||= []).push(b);
    this.buildNav();
  }

  addBox(b) {
    this.boxes.push(b);
    const [x0, z0, x1, z1] = [this.ci(b.min[0]), this.ci(b.min[2]), this.ci(b.max[0]), this.ci(b.max[2])];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const k = z * this.n + x;
      (this.cells[k] ||= []).push(b);
    }
  }
  ci(v) { return Math.max(0, Math.min(this.n - 1, Math.floor((v + this.off) / this.cell))); }

  setDoor(id, open) {
    const d = this.doors[id];
    if (!d) return;
    d.open = open;
    d.box.disabled = open;
  }
  setGate(id, open) { for (const b of this.gates[id] || []) b.disabled = open; }

  // XZ 範囲内のボックスに対してコールバック
  query(minx, minz, maxx, maxz, cb) {
    const st = ++this.stamp;
    const x0 = this.ci(minx), z0 = this.ci(minz), x1 = this.ci(maxx), z1 = this.ci(maxz);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const arr = this.cells[z * this.n + x];
      if (!arr) continue;
      for (const b of arr) {
        if (b._st === st) continue;
        b._st = st;
        if (b.disabled) continue;
        if (b.max[0] < minx || b.min[0] > maxx || b.max[2] < minz || b.min[2] > maxz) continue;
        cb(b);
      }
    }
  }

  // レイキャスト：{ t, point, normal, box } | null
  raycast(o, d, maxT, opts = {}) {
    let best = null, bestT = maxT;
    const st = ++this.stamp;
    const test = (b) => {
      if (b._st === st) return;
      b._st = st;
      if (b.disabled) return;
      if (opts.ignoreTrees && b.mat === 'tree') return;
      if (opts.ignoreInvisible && b.mat === 'invisible') return;
      const r = rayBox(o, d, b, bestT);
      if (r && r.t < bestT) { bestT = r.t; best = { t: r.t, normal: r.n, box: b }; }
    };
    // DDA（XZ 平面）
    const cs = this.cell;
    let cx = Math.floor((o.x + this.off) / cs), cz = Math.floor((o.z + this.off) / cs);
    const stepX = d.x > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
    const nextX = ((cx + (stepX > 0 ? 1 : 0)) * cs - this.off - o.x) / (d.x || 1e-9);
    const nextZ = ((cz + (stepZ > 0 ? 1 : 0)) * cs - this.off - o.z) / (d.z || 1e-9);
    let tMaxX = Math.abs(d.x) < 1e-9 ? Infinity : nextX;
    let tMaxZ = Math.abs(d.z) < 1e-9 ? Infinity : nextZ;
    const tDX = Math.abs(d.x) < 1e-9 ? Infinity : cs / Math.abs(d.x);
    const tDZ = Math.abs(d.z) < 1e-9 ? Infinity : cs / Math.abs(d.z);
    let t = 0;
    for (let i = 0; i < 400; i++) {
      if (cx >= 0 && cz >= 0 && cx < this.n && cz < this.n) {
        const arr = this.cells[cz * this.n + cx];
        if (arr) for (const b of arr) test(b);
      }
      const tNext = Math.min(tMaxX, tMaxZ);
      if (best && bestT <= tNext) break;
      t = tNext;
      if (t > maxT) break;
      if (tMaxX < tMaxZ) { cx += stepX; tMaxX += tDX; } else { cz += stepZ; tMaxZ += tDZ; }
      if ((cx < -1 || cz < -1 || cx > this.n || cz > this.n)) break;
    }
    // 地面
    if (d.y < 0) {
      const tg = -o.y / d.y;
      if (tg > 0 && tg < bestT) { bestT = tg; best = { t: tg, normal: { x: 0, y: 1, z: 0 }, box: null, ground: true }; }
    }
    if (best) best.point = { x: o.x + d.x * best.t, y: o.y + d.y * best.t, z: o.z + d.z * best.t };
    return best;
  }

  lineOfSight(a, b, opts = {}) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const L = Math.hypot(dx, dy, dz);
    if (L < 0.01) return true;
    const h = this.raycast(a, { x: dx / L, y: dy / L, z: dz / L }, L, { ignoreInvisible: true, ...opts });
    return !h || h.t >= L - 0.05;
  }

  // 床の高さ（足元 y 付近で、y + stepUp 以下の最上面）
  groundAt(x, z, y, r = 0.25, stepUp = 0.45) {
    let g = 0;
    this.query(x - r, z - r, x + r, z + r, (b) => {
      if (b.max[1] <= y + stepUp && b.max[1] > g && b.mat !== 'invisible') {
        if (circleRect(x, z, r, b)) g = b.max[1];
      }
    });
    return g;
  }

  // キャラクター移動（円柱）。p は {x,y,z}（足元）。state: { vy, onGround }
  moveCharacter(p, dx, dz, dt, state, r = 0.34, h = 1.8, stepUp = 0.45) {
    // 水平移動を分割
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 0.25));
    for (let s = 0; s < steps; s++) {
      p.x += dx / steps; p.z += dz / steps;
      this.resolve(p, r, h, state.onGround ? stepUp : 0.05);
    }
    // 垂直
    state.vy -= 22 * dt;
    if (state.vy < -40) state.vy = -40;
    let ny = p.y + state.vy * dt;
    // 天井
    if (state.vy > 0) {
      let ceil = Infinity;
      this.query(p.x - r * 0.8, p.z - r * 0.8, p.x + r * 0.8, p.z + r * 0.8, (b) => {
        if (b.min[1] >= p.y + h - 0.05 && b.min[1] < ceil && circleRect(p.x, p.z, r * 0.8, b)) ceil = b.min[1];
      });
      if (ny + h > ceil) { ny = ceil - h; state.vy = 0; }
    }
    const g = this.groundAt(p.x, p.z, Math.max(p.y, ny), r * 0.85, state.onGround ? stepUp : 0.05);
    const prevGround = state.onGround;
    if (ny <= g) {
      state.landV = prevGround ? 0 : state.vy;
      ny = g; state.vy = 0; state.onGround = true;
    } else {
      // 階段下りのスナップ
      if (prevGround && p.y - g < stepUp && state.vy <= 0) { ny = g; state.vy = 0; state.onGround = true; }
      else state.onGround = false;
    }
    p.y = ny;
    // 範囲外
    const lim = this.half - 1;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.z = Math.max(-lim, Math.min(lim, p.z));
  }

  resolve(p, r, h, stepUp) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      this.query(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
        if (b.max[1] <= p.y + stepUp || b.min[1] >= p.y + h) return;
        const cx = Math.max(b.min[0], Math.min(p.x, b.max[0]));
        const cz = Math.max(b.min[2], Math.min(p.z, b.max[2]));
        let ddx = p.x - cx, ddz = p.z - cz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 >= r * r) return;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          p.x += (ddx / d) * push; p.z += (ddz / d) * push;
        } else {
          // 中心がボックス内：最短の面へ押し出す
          const pen = [p.x - b.min[0] + r, b.max[0] - p.x + r, p.z - b.min[2] + r, b.max[2] - p.z + r];
          const m = Math.min(...pen);
          if (m === pen[0]) p.x = b.min[0] - r; else if (m === pen[1]) p.x = b.max[0] + r;
          else if (m === pen[2]) p.z = b.min[2] - r; else p.z = b.max[2] + r;
        }
        moved = true;
      });
      if (!moved) break;
    }
  }

  // ---------------------------------------------------------------- ナビ
  buildNav() {
    const cs = 1;
    const N = Math.ceil(this.half * 2 / cs);
    this.navN = N; this.navCs = cs;
    const g = new Uint8Array(N * N);
    const infl = 0.3;
    const mark = (b) => {
      if (b.mat === 'invisible' && false) return;
      if (b.min[1] > 1.5 || b.max[1] < 0.5) return;
      const x0 = Math.floor((b.min[0] - infl + this.half) / cs), x1 = Math.floor((b.max[0] + infl + this.half) / cs);
      const z0 = Math.floor((b.min[2] - infl + this.half) / cs), z1 = Math.floor((b.max[2] + infl + this.half) / cs);
      for (let z = Math.max(0, z0); z <= Math.min(N - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(N - 1, x1); x++) {
        // セル中心がインフレート領域に入るか
        const cx = (x + 0.5) * cs - this.half, cz = (z + 0.5) * cs - this.half;
        if (cx >= b.min[0] - infl && cx <= b.max[0] + infl && cz >= b.min[2] - infl && cz <= b.max[2] + infl) g[z * N + x] = 1;
      }
    };
    for (const b of this.boxes) {
      if (b.door) continue;
      mark(b);
    }
    this.navBase = g;
    this.nav = new Uint8Array(g);
    // 施錠扉は nav にブロックとして入れる
    for (const d of Object.values(this.doors)) if (d.locked) this._markInto(d.box, this.nav);
  }
  _markInto(b, arr) {
    const cs = this.navCs, N = this.navN, infl = 0.3;
    const x0 = Math.floor((b.min[0] - infl + this.half) / cs), x1 = Math.floor((b.max[0] + infl + this.half) / cs);
    const z0 = Math.floor((b.min[2] - infl + this.half) / cs), z1 = Math.floor((b.max[2] + infl + this.half) / cs);
    for (let z = Math.max(0, z0); z <= Math.min(N - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(N - 1, x1); x++) arr[z * N + x] = 1;
  }
  unlockDoorNav(id) {
    // 鍵が開けられたらナビを再構築（扉部分のみ base に戻す）
    const d = this.doors[id];
    if (!d) return;
    const cs = this.navCs, N = this.navN, infl = 0.4, b = d.box;
    const x0 = Math.floor((b.min[0] - infl + this.half) / cs), x1 = Math.floor((b.max[0] + infl + this.half) / cs);
    const z0 = Math.floor((b.min[2] - infl + this.half) / cs), z1 = Math.floor((b.max[2] + infl + this.half) / cs);
    for (let z = Math.max(0, z0); z <= Math.min(N - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(N - 1, x1); x++) this.nav[z * N + x] = this.navBase[z * N + x];
  }
  navIdx(x, z) {
    const N = this.navN;
    const ix = Math.floor((x + this.half) / this.navCs), iz = Math.floor((z + this.half) / this.navCs);
    if (ix < 0 || iz < 0 || ix >= N || iz >= N) return -1;
    return iz * N + ix;
  }
  walkable(x, z) { const i = this.navIdx(x, z); return i >= 0 && !this.nav[i]; }
  nearestWalkable(x, z, maxR = 6) {
    if (this.walkable(x, z)) return { x, z };
    for (let r = 1; r <= maxR; r++) {
      for (let a = 0; a < 8 * r; a++) {
        const ang = (a / (8 * r)) * Math.PI * 2;
        const px = x + Math.cos(ang) * r, pz = z + Math.sin(ang) * r;
        if (this.walkable(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  // A*（8 方向）。戻り値：ウェイポイント配列 [{x,z}] または null
  findPath(sx, sz, tx, tz, maxNodes = 30000) {
    const N = this.navN, cs = this.navCs, H = this.half;
    const s0 = this.nearestWalkable(sx, sz, 3), t0 = this.nearestWalkable(tx, tz, 6);
    if (!s0 || !t0) return null;
    const si = this.navIdx(s0.x, s0.z), ti = this.navIdx(t0.x, t0.z);
    if (si === ti) return [{ x: tx, z: tz }];
    const nav = this.nav;
    const gScore = this._g || (this._g = new Float32Array(N * N));
    const came = this._c || (this._c = new Int32Array(N * N));
    const seen = this._s || (this._s = new Uint32Array(N * N));
    const closed = this._cl || (this._cl = new Uint32Array(N * N));
    const gen = (this._gen = (this._gen || 0) + 1);
    const tx_ = ti % N, tz_ = (ti / N) | 0;
    const heur = (i) => { const dx = Math.abs((i % N) - tx_), dz = Math.abs(((i / N) | 0) - tz_); return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz); };
    const heap = new MinHeap();
    seen[si] = gen; gScore[si] = 0; came[si] = -1;
    heap.push(si, heur(si));
    let found = false, count = 0;
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === ti) { found = true; break; }
      if (++count > maxNodes) break;
      const cx = cur % N, cz = (cur / N) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], nz = cz + DZ[k];
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const ni = nz * N + nx;
        if (nav[ni]) continue;
        if (k >= 4 && (nav[cz * N + nx] || nav[nz * N + cx])) continue;
        const ng = gScore[cur] + (k >= 4 ? 1.4142 : 1);
        if (seen[ni] !== gen || ng < gScore[ni]) {
          seen[ni] = gen; gScore[ni] = ng; came[ni] = cur;
          heap.push(ni, ng + heur(ni) * 1.05);
        }
      }
    }
    if (!found) return null;
    const cellsPath = [];
    for (let c = ti; c !== -1; c = came[c]) cellsPath.push(c);
    cellsPath.reverse();
    const pts = cellsPath.map((c) => ({ x: ((c % N) + 0.5) * cs - H, z: (((c / N) | 0) + 0.5) * cs - H }));
    // スムージング（グリッド上の直線可視判定）
    const out = [];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.gridLine(pts[a], pts[b])) b--;
      out.push(pts[b]);
      a = b;
    }
    if (out.length) out[out.length - 1] = { x: tx, z: tz };
    if (!this.walkable(tx, tz) && out.length) out[out.length - 1] = t0;
    return out;
  }
  gridLine(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / 0.4);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!this.walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }
}

class MinHeap {
  constructor() { this.k = []; this.v = []; this.size = 0; }
  push(key, pri) {
    let i = this.size++;
    this.k[i] = key; this.v[i] = pri;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.v[p] <= this.v[i]) break;
      [this.k[p], this.k[i]] = [this.k[i], this.k[p]];
      [this.v[p], this.v[i]] = [this.v[i], this.v[p]];
      i = p;
    }
  }
  pop() {
    const top = this.k[0];
    this.size--;
    if (this.size > 0) {
      this.k[0] = this.k[this.size]; this.v[0] = this.v[this.size];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.size && this.v[l] < this.v[m]) m = l;
        if (r < this.size && this.v[r] < this.v[m]) m = r;
        if (m === i) break;
        [this.k[m], this.k[i]] = [this.k[i], this.k[m]];
        [this.v[m], this.v[i]] = [this.v[i], this.v[m]];
        i = m;
      }
    }
    return top;
  }
}

export function rayBox(o, d, b, maxT) {
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  const O = [o.x, o.y, o.z], D = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(D[a]) < 1e-9) {
      if (O[a] < b.min[a] || O[a] > b.max[a]) return null;
    } else {
      let t1 = (b.min[a] - O[a]) / D[a], t2 = (b.max[a] - O[a]) / D[a];
      let s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; nAxis = a; nSign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (nAxis < 0) return null; // 内部から
  const n = { x: 0, y: 0, z: 0 };
  n['xyz'[nAxis]] = nSign;
  return { t: tmin, n };
}

export function circleRect(x, z, r, b) {
  const cx = Math.max(b.min[0], Math.min(x, b.max[0]));
  const cz = Math.max(b.min[2], Math.min(z, b.max[2]));
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

// マップ「グレイヴ港湾区」— 400m 四方の工業港湾地帯
// すべて軸平行ボックスで構成（描画・当たり判定・ナビ共通）
import { makeRng } from './math.js';

export const MAP_NAME = 'グレイヴ港湾区';
export const HALF = 200;

export function buildMap(seed = 1337) {
  const rng = makeRng(seed);
  const M = {
    name: MAP_NAME, half: HALF,
    boxes: [], doors: [], containers: [], loose: [], spawns: [], extracts: [], pois: [],
    switches: [], trees: [], bushes: [], rocks: [], roads: [], lamps: [], water: { z: 174 },
    scavZones: [], machineZones: [], noTree: [], decals: [],
  };
  let cid = 0, did = 0;

  // ------------------------------------------------------------ 基本ヘルパ
  const box = (x0, y0, z0, x1, y1, z1, mat = 'concrete', color = null, extra = null) => {
    const b = {
      min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
      max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
      mat,
    };
    if (color) b.color = color;
    if (extra) Object.assign(b, extra);
    M.boxes.push(b);
    return b;
  };
  const cont = (type, x, y, z, rot = 0, extra = {}) => {
    M.containers.push({ id: 'c' + (cid++), type, x, y, z, rot, ...extra });
  };
  const loose = (x, y, z, tags) => M.loose.push({ x, y, z, tags });
  const noTree = (x0, z0, x1, z1) => M.noTree.push([x0 - 3, z0 - 3, x1 + 3, z1 + 3]);

  // 壁（開口部付き）。axis 'x' = X 方向に伸びる壁（z 固定）
  // openings: [{ c: 中心位置, w: 幅, y0, y1 }]
  function wall(axis, fixed, a0, a1, y0, y1, t, mat, openings = [], color = null) {
    const ops = openings.filter((o) => o.c + o.w / 2 > a0 && o.c - o.w / 2 < a1).sort((p, q) => p.c - q.c);
    const seg = (s0, s1, sy0, sy1) => {
      if (s1 - s0 < 0.01 || sy1 - sy0 < 0.01) return;
      if (axis === 'x') box(s0, sy0, fixed - t / 2, s1, sy1, fixed + t / 2, mat, color);
      else box(fixed - t / 2, sy0, s0, fixed + t / 2, sy1, s1, mat, color);
    };
    let cur = a0;
    for (const o of ops) {
      const o0 = Math.max(a0, o.c - o.w / 2), o1 = Math.min(a1, o.c + o.w / 2);
      seg(cur, o0, y0, y1);
      seg(o0, o1, y0, Math.max(y0, o.y0)); // 腰壁
      seg(o0, o1, Math.min(y1, o.y1), y1); // まぐさ
      cur = o1;
    }
    seg(cur, a1, y0, y1);
  }

  function door(axis, x, z, y0, w, h, opts = {}) {
    M.doors.push({ id: opts.id || 'd' + (did++), axis, x, z, y0, w, h, locked: opts.locked || null, open: !!opts.open, mat: opts.mat || (opts.locked ? 'metal' : 'wood'), color: opts.color || null, name: opts.name || null });
  }

  // 建物ビルダー
  // o: { x0,z0,x1,z1, floors, fh, mat, color, doors:[{side,c,w,h,door?}], windows, stairs:{x,z,axis,dir,w}, roofMat, noRoof, inner(ctx) }
  function building(o) {
    const floors = o.floors || 1, fh = o.fh || 3.4, t = o.t || 0.3;
    const { x0, z0, x1, z1 } = o;
    const mat = o.mat || 'brick';
    noTree(x0, z0, x1, z1);
    const doorsOn = (side, f) => (o.doors || []).filter((d) => d.side === side && (d.f || 0) === f);
    for (let f = 0; f < floors; f++) {
      const y0 = f * fh, y1 = (f + 1) * fh;
      const sides = { n: ['x', z0, x0, x1], s: ['x', z1, x0, x1], w: ['z', x0, z0, z1], e: ['z', x1, z0, z1] };
      for (const [side, [axis, fixed, a0, a1]] of Object.entries(sides)) {
        const ops = doorsOn(side, f).map((d) => ({ c: (d.abs ?? (a0 + d.c)), w: d.w || 1.6, y0: y0 + 0.0, y1: y0 + (d.h || 2.4) }));
        if (o.windows !== false) {
          const len = a1 - a0;
          const spacing = o.winSpacing || 4.2;
          const n = Math.floor((len - 2) / spacing);
          for (let i = 0; i < n; i++) {
            const c = a0 + (len - (n - 1) * spacing) / 2 + i * spacing;
            if (ops.some((p) => Math.abs(p.c - c) < p.w / 2 + 1.2)) continue;
            if (o.noWin && o.noWin.includes(side)) continue;
            ops.push({ c, w: 1.3, y0: y0 + 1.05, y1: y0 + 2.2, win: true });
          }
        }
        wall(axis, fixed, a0 - (axis === 'x' ? t / 2 : 0), a1 + (axis === 'x' ? t / 2 : 0), y0, y1, t, mat, ops, o.color);
        for (const d of doorsOn(side, f)) {
          if (!d.door) continue;
          const c = d.abs ?? (a0 + d.c);
          if (axis === 'x') door('x', c, fixed, y0, d.w || 1.6, d.h || 2.4, d.door);
          else door('z', fixed, c, y0, d.w || 1.6, d.h || 2.4, d.door);
        }
      }
      // 床
      const fm = o.floorMat || 'tile';
      if (f === 0) box(x0, 0, z0, x1, 0.12, z1, fm, o.floorColor || null);
      else {
        const st = o.stairs;
        const yb = f * fh - 0.25, yt = f * fh + 0.02;
        if (st) slabWithHole(x0, z0, x1, z1, yb, yt, stairFootprint(st, fh), fm, o.floorColor);
        else box(x0, yb, z0, x1, yt, z1, fm, o.floorColor || null);
      }
    }
    // 階段
    if (o.stairs) for (let f = 0; f < floors - 1; f++) stairs(o.stairs, f * fh, fh);
    // 屋根
    if (!o.noRoof) {
      const ry = floors * fh;
      box(x0 - 0.3, ry - 0.05, z0 - 0.3, x1 + 0.3, ry + 0.3, z1 + 0.3, o.roofMat || 'roof', o.roofColor || null);
      // パラペット
      if (o.parapet !== false) {
        box(x0 - 0.3, ry + 0.3, z0 - 0.3, x1 + 0.3, ry + 0.8, z0, mat, o.color);
        box(x0 - 0.3, ry + 0.3, z1, x1 + 0.3, ry + 0.8, z1 + 0.3, mat, o.color);
        box(x0 - 0.3, ry + 0.3, z0, x0, ry + 0.8, z1, mat, o.color);
        box(x1, ry + 0.3, z0, x1 + 0.3, ry + 0.8, z1, mat, o.color);
      }
    }
    if (o.inner) o.inner({ fh });
    M.pois.length; // noop
  }
  function stairFootprint(st, fh) {
    const n = Math.round(fh / 0.26), run = 0.3, len = n * run;
    const w = st.w || 1.4;
    if (st.axis === 'x') {
      const xa = st.dir > 0 ? st.x : st.x - len, xb = st.dir > 0 ? st.x + len : st.x;
      return [xa - 0.2, st.z - w / 2, xb + 0.2, st.z + w / 2];
    }
    const za = st.dir > 0 ? st.z : st.z - len, zb = st.dir > 0 ? st.z + len : st.z;
    return [st.x - w / 2, za - 0.2, st.x + w / 2, zb + 0.2];
  }
  function stairs(st, ybase, fh) {
    const n = Math.round(fh / 0.26), rise = fh / n, run = 0.3, w = st.w || 1.4;
    for (let i = 0; i < n; i++) {
      const a = i * run, b = (i + 1) * run, top = ybase + (i + 1) * rise;
      if (st.axis === 'x') {
        const xa = st.x + st.dir * a, xb = st.x + st.dir * b;
        box(xa, ybase, st.z - w / 2, xb, top, st.z + w / 2, 'stair');
      } else {
        const za = st.z + st.dir * a, zb = st.z + st.dir * b;
        box(st.x - w / 2, ybase, za, st.x + w / 2, top, zb, 'stair');
      }
    }
  }
  function slabWithHole(x0, z0, x1, z1, yb, yt, h, mat, color) {
    const [hx0, hz0, hx1, hz1] = h;
    box(x0, yb, z0, x1, yt, hz0, mat, color);
    box(x0, yb, hz1, x1, yt, z1, mat, color);
    box(x0, yb, hz0, hx0, yt, hz1, mat, color);
    box(hx1, yb, hz0, x1, yt, hz1, mat, color);
  }

  // ------------------------------------------------------------ 家具
  const F = {
    table(x, z, y = 0.12, w = 1.6, d = 0.9, tags = { residential: 1 }) {
      box(x - w / 2, y + 0.72, z - d / 2, x + w / 2, y + 0.78, z + d / 2, 'wood', '#6b4b30');
      box(x - w / 2 + 0.05, y, z - d / 2 + 0.05, x - w / 2 + 0.12, y + 0.72, z - d / 2 + 0.12, 'wood', '#5b3b20');
      box(x + w / 2 - 0.12, y, z - d / 2 + 0.05, x + w / 2 - 0.05, y + 0.72, z - d / 2 + 0.12, 'wood', '#5b3b20');
      box(x - w / 2 + 0.05, y, z + d / 2 - 0.12, x - w / 2 + 0.12, y + 0.72, z + d / 2 - 0.05, 'wood', '#5b3b20');
      box(x + w / 2 - 0.12, y, z + d / 2 - 0.12, x + w / 2 - 0.05, y + 0.72, z + d / 2 - 0.05, 'wood', '#5b3b20');
      loose(x, y + 0.8, z, tags);
    },
    desk(x, z, y = 0.12, rot = 0, tags = { office: 2, tech: 1 }, pc = true) {
      const w = rot % 2 ? 0.8 : 1.6, d = rot % 2 ? 1.6 : 0.8;
      box(x - w / 2, y, z - d / 2, x + w / 2, y + 0.76, z + d / 2, 'wood', '#5a4a3a');
      loose(x, y + 0.8, z, tags);
      if (pc) cont('pc', x + (rot % 2 ? 0 : 0.5), y + 0.76, z + (rot % 2 ? 0.5 : 0), rot, { small: true });
      cont('drawer', x - (rot % 2 ? 0 : 0.45), y + 0.76, z - (rot % 2 ? 0.45 : 0), rot, { small: true });
    },
    shelf(x, z, len, axis = 'x', y = 0.12, levels = 4, tags = { industrial: 2, junk: 1 }, h = 2.2) {
      const d = 0.6;
      const x0 = axis === 'x' ? x - len / 2 : x - d / 2, x1 = axis === 'x' ? x + len / 2 : x + d / 2;
      const z0 = axis === 'x' ? z - d / 2 : z - len / 2, z1 = axis === 'x' ? z + d / 2 : z + len / 2;
      // 支柱
      for (const [px, pz] of [[x0, z0], [x1 - 0.06, z0], [x0, z1 - 0.06], [x1 - 0.06, z1 - 0.06]]) box(px, y, pz, px + 0.06, y + h, pz + 0.06, 'metal', '#3a4a6a');
      for (let i = 0; i < levels; i++) {
        const sy = y + 0.1 + i * (h - 0.1) / (levels - 0.5);
        box(x0, sy, z0, x1, sy + 0.04, z1, 'metal', '#8a7a4a');
        const n = Math.max(1, Math.floor(len / 1.2));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n - 0.5;
          if (rng() < 0.55) loose(axis === 'x' ? x + t * len : x, sy + 0.05, axis === 'x' ? z : z + t * len, tags);
        }
      }
    },
    bed(x, z, y = 0.12, rot = 0) {
      const w = rot % 2 ? 2 : 0.9, d = rot % 2 ? 0.9 : 2;
      box(x - w / 2, y, z - d / 2, x + w / 2, y + 0.45, z + d / 2, 'fabric', '#7a7060');
      box(x - w / 2, y + 0.45, z - d / 2, x + w / 2, y + 0.55, z + d / 2, 'fabric', '#c8c0b0');
      loose(x, y + 0.6, z, { residential: 2, medical: 1, junk: 1 });
    },
    sofa(x, z, y = 0.12, rot = 0) {
      const w = rot % 2 ? 0.9 : 2.2, d = rot % 2 ? 2.2 : 0.9;
      box(x - w / 2, y, z - d / 2, x + w / 2, y + 0.45, z + d / 2, 'fabric', '#5a3a3a');
      if (rot % 2 === 0) box(x - w / 2, y + 0.45, z + (rot === 0 ? d / 2 - 0.25 : -d / 2), x + w / 2, y + 0.95, z + (rot === 0 ? d / 2 : -d / 2 + 0.25), 'fabric', '#4a2a2a');
      else box(x + (rot === 1 ? w / 2 - 0.25 : -w / 2), y + 0.45, z - d / 2, x + (rot === 1 ? w / 2 : -w / 2 + 0.25), y + 0.95, z + d / 2, 'fabric', '#4a2a2a');
    },
    counter(x0, z0, x1, z1, y = 0.12, tags = { food: 2, residential: 1 }) {
      box(x0, y, z0, x1, y + 0.95, z1, 'wood', '#7a6a5a');
      const len = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
      const n = Math.floor(len / 1.5);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        if (rng() < 0.5) loose(x0 + (x1 - x0) * t, y + 1.0, z0 + (z1 - z0) * t, tags);
      }
    },
    crates(x, z, n = 3, y = 0) {
      for (let i = 0; i < n; i++) {
        const cx = x + (rng() - 0.5) * 3, cz = z + (rng() - 0.5) * 3;
        const s = 0.8 + rng() * 0.5;
        box(cx - s / 2, y, cz - s / 2, cx + s / 2, y + s, cz + s / 2, 'crate');
        if (rng() < 0.4) box(cx - s / 3, y + s, cz - s / 3, cx + s / 3, y + s * 1.6, cz + s / 3, 'crate');
      }
    },
    pallet(x, z, y = 0) {
      box(x - 0.6, y, z - 0.5, x + 0.6, y + 0.15, z + 0.5, 'wood', '#9a7a50');
      const h = 0.4 + rng() * 0.9;
      box(x - 0.55, y + 0.15, z - 0.45, x + 0.55, y + 0.15 + h, z + 0.45, rng() < 0.5 ? 'crate' : 'fabric', rng() < 0.5 ? '#8a7a5a' : '#6a7a5a');
    },
    car(x, z, rot = 0, color = null) {
      color = color || rng.pick(['#7a2a20', '#2a4a6a', '#c8c8c8', '#3a3a3a', '#5a6a3a', '#a08a3a', '#e0e0d8', '#4a2a4a']);
      const L = 4.4, W = 1.8;
      const [w, d] = rot % 2 ? [L, W] : [W, L];
      box(x - w / 2, 0.25, z - d / 2, x + w / 2, 1.0, z + d / 2, 'car', color);
      const cw = rot % 2 ? 2.2 : W - 0.2, cd = rot % 2 ? W - 0.2 : 2.2;
      box(x - cw / 2, 1.0, z - cd / 2, x + cw / 2, 1.5, z + cd / 2, 'glass_dark', '#203040');
      box(x - cw / 2 + 0.05, 1.5, z - cd / 2 + 0.05, x + cw / 2 - 0.05, 1.58, z + cd / 2 - 0.05, 'car', color);
      // タイヤ
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const tx = x + (rot % 2 ? sx * 1.4 : sx * 0.8), tz = z + (rot % 2 ? sz * 0.8 : sz * 1.4);
        box(tx - 0.2, 0, tz - 0.2, tx + 0.2, 0.55, tz + 0.2, 'rubber');
      }
      if (rng() < 0.35) loose(x, 1.0, z, { residential: 1, junk: 2, industrial: 1 });
    },
    truck(x, z, rot = 0, color = '#4a5a3a') {
      const L = 8, W = 2.5;
      const [w, d] = rot % 2 ? [L, W] : [W, L];
      box(x - w / 2, 0.4, z - d / 2, x + w / 2, 1.3, z + d / 2, 'metal', '#2a2a2a');
      if (rot % 2) {
        box(x - L / 2, 1.3, z - W / 2, x - L / 2 + 2.4, 3.0, z + W / 2, 'car', color);
        box(x - L / 2 + 2.6, 1.3, z - W / 2, x + L / 2, 3.3, z + W / 2, 'tarp', color);
      } else {
        box(x - W / 2, 1.3, z - L / 2, x + W / 2, 3.0, z - L / 2 + 2.4, 'car', color);
        box(x - W / 2, 1.3, z - L / 2 + 2.6, x + W / 2, 3.3, z + L / 2, 'tarp', color);
      }
      for (const t of [-0.35, 0.05, 0.35]) for (const s of [-1, 1]) {
        const tx = rot % 2 ? x + t * L : x + s * (W / 2 - 0.1), tz = rot % 2 ? z + s * (W / 2 - 0.1) : z + t * L;
        box(tx - 0.45, 0, tz - 0.45, tx + 0.45, 0.95, tz + 0.45, 'rubber');
      }
    },
    sandbags(x0, z0, x1, z1, h = 1.1) { box(x0, 0, z0, x1, h, z1, 'sandbag'); },
    hesco(x0, z0, x1, z1, h = 2.4) { box(x0, 0, z0, x1, h, z1, 'hesco'); },
    fence(axis, fixed, a0, a1, h = 2.6, gaps = []) {
      wall(axis, fixed, a0, a1, 0, h, 0.12, 'fence', gaps.map((g) => ({ c: g[0], w: g[1], y0: 0, y1: h + 1 })));
    },
    lamp(x, z, h = 7) {
      box(x - 0.12, 0, z - 0.12, x + 0.12, h, z + 0.12, 'metal', '#3a3a3a');
      M.lamps.push({ x, y: h - 0.2, z });
    },
    shippingContainer(x, z, axis = 'x', y = 0, color = null, open = false) {
      color = color || rng.pick(['#8a2a1a', '#1a4a7a', '#2a6a3a', '#b0601a', '#6a6a6a', '#7a1a3a', '#a08a2a']);
      const L = 12, W = 2.45, H = 2.6;
      if (!open) {
        if (axis === 'x') box(x - L / 2, y, z - W / 2, x + L / 2, y + H, z + W / 2, 'container', color);
        else box(x - W / 2, y, z - L / 2, x + W / 2, y + H, z + L / 2, 'container', color);
        return;
      }
      // 片側が開いたコンテナ（中に入れる）
      const t = 0.1;
      if (axis === 'x') {
        box(x - L / 2, y, z - W / 2, x + L / 2, y + t, z + W / 2, 'container', color);
        box(x - L / 2, y + H - t, z - W / 2, x + L / 2, y + H, z + W / 2, 'container', color);
        box(x - L / 2, y, z - W / 2, x + L / 2, y + H, z - W / 2 + t, 'container', color);
        box(x - L / 2, y, z + W / 2 - t, x + L / 2, y + H, z + W / 2, 'container', color);
        box(x - L / 2, y, z - W / 2, x - L / 2 + t, y + H, z + W / 2, 'container', color);
        cont(rng.pick(['crate', 'crate', 'toolbox', 'military_crate', 'duffel']), x + L / 2 - 2.5, y + t, z, 1);
        loose(x, y + 0.2, z, { industrial: 2, junk: 1, tech: 1 });
        if (rng() < 0.5) F.pallet(x - 2, z, y + t);
      } else {
        box(x - W / 2, y, z - L / 2, x + W / 2, y + t, z + L / 2, 'container', color);
        box(x - W / 2, y + H - t, z - L / 2, x + W / 2, y + H, z + L / 2, 'container', color);
        box(x - W / 2, y, z - L / 2, x - W / 2 + t, y + H, z + L / 2, 'container', color);
        box(x + W / 2 - t, y, z - L / 2, x + W / 2, y + H, z + L / 2, 'container', color);
        box(x - W / 2, y, z - L / 2, x + W / 2, y + H, z - L / 2 + t, 'container', color);
        cont(rng.pick(['crate', 'toolbox', 'military_crate', 'duffel']), x, y + t, z + L / 2 - 2.5, 0);
        loose(x, y + 0.2, z, { industrial: 2, junk: 1, tech: 1 });
      }
    },
    watchtower(x, z, h = 6) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + sx * 1.6 - 0.15, 0, z + sz * 1.6 - 0.15, x + sx * 1.6 + 0.15, h + 2.4, z + sz * 1.6 + 0.15, 'wood', '#5a4a30');
      box(x - 1.9, h - 0.2, z - 1.9, x + 1.9, h, z + 1.9, 'wood', '#6a5a40');
      box(x - 1.9, h, z - 1.9, x + 1.9, h + 1.0, z - 1.8, 'wood', '#6a5a40');
      box(x - 1.9, h, z + 1.8, x + 1.9, h + 1.0, z + 1.9, 'wood', '#6a5a40');
      box(x - 1.9, h, z - 1.8, x - 1.8, h + 1.0, z + 1.8, 'wood', '#6a5a40');
      box(x - 2.1, h + 2.4, z - 2.1, x + 2.1, h + 2.6, z + 2.1, 'roof', '#3a3a30');
      // 階段（外側、+X 方向から上る）
      const n = Math.round(h / 0.26), rise = h / n, run = 0.3;
      for (let i = 0; i < n; i++) {
        const xa = x + 1.9 + (n - i - 1) * run, xb = xa + run;
        box(xa, 0, z - 0.6, xb, (i + 1) * rise, z + 0.6, 'stair', '#5a4a30');
      }
      cont('ammo_box', x - 1.2, h, z + 1.2, 0);
      loose(x, h + 0.1, z, { military: 2 });
    },
    rockCluster(x, z, r = 4) {
      const n = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = rng() * r * 0.6;
        const s = 1 + rng() * r * 0.5, h = 0.8 + rng() * r * 0.5;
        const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
        box(cx - s / 2, 0, cz - s / 2, cx + s / 2, h, cz + s / 2, 'rock');
      }
    },
  };

  // ------------------------------------------------------------ 外周（崖と海）
  {
    const ex = HALF;
    let p = -ex;
    while (p < ex) {
      const len = 8 + rng() * 14, h = 14 + rng() * 14, dep = 6 + rng() * 8;
      box(p, -1, -ex - 4, p + len, h, -ex + dep * 0.4, 'cliff'); // 北
      box(-ex - 4, -1, p, -ex + dep * 0.4, h * 0.95, p + len, 'cliff'); // 西
      if (p < 165) box(ex - dep * 0.4, -1, p, ex + 4, h * 1.05, p + len, 'cliff'); // 東
      p += len - 1;
    }
    // 南は海。護岸
    box(-ex, -2, 174, ex, 0.4, 176, 'concrete', '#6a6a64');
    // 海への見えない壁（桟橋部分を除く）
    box(-ex, -2, 175.5, 55, 4, 176.5, 'invisible');
    box(65, -2, 175.5, ex, 4, 176.5, 'invisible');
    box(54.5, -2, 176, 55, 4, 197, 'invisible');
    box(65, -2, 176, 65.5, 4, 197, 'invisible');
    box(55, -2, 196.5, 65, 4, 197, 'invisible');
  }

  // ------------------------------------------------------------ 道路
  M.roads.push(
    { x0: -190, z0: 0, x1: 190, z1: 0, w: 10 },
    { x0: 40, z0: -192, x1: 40, z1: 172, w: 9 },
    { x0: -165, z0: -120, x1: 185, z1: -120, w: 8 },
    { x0: -120, z0: -120, x1: -120, z1: 125, w: 8 },
    { x0: -160, z0: 112, x1: 175, z1: 112, w: 9 },
    { x0: -10, z0: 0, x1: -10, z1: 26, w: 7 },
    { x0: 40, z0: 50, x1: 92, z1: 50, w: 7 },
  );

  // ------------------------------------------------------------ 工場（中央南）
  {
    const x0 = -40, z0 = 30, x1 = 20, z1 = 66, H = 9;
    M.pois.push({ id: 'factory', name: '工場', x: -10, z: 48, r: 34, tags: ['industrial'], tier: 2 });
    M.scavZones.push({ x: -10, z: 48, r: 30, n: 4 });
    noTree(x0 - 15, z0 - 8, x1 + 18, 95);
    // 外壁
    const t = 0.4;
    wall('x', z0, x0, x1, 0, H, t, 'metal_wall', [{ c: -10, w: 5, y0: 0, y1: 4.5 }, { c: 8, w: 1.6, y0: 0, y1: 2.4 }], '#7a7d72');
    wall('x', z1, x0, x1, 0, H, t, 'metal_wall', [{ c: -25, w: 5, y0: 0, y1: 4.5 }, { c: 5, w: 1.6, y0: 0, y1: 2.4 }], '#7a7d72');
    wall('z', x0, z0, z1, 0, H, t, 'metal_wall', [{ c: 50, w: 1.6, y0: 0, y1: 2.4 }, ...[38, 46, 58].map((c) => ({ c, w: 2, y0: 5.5, y1: 7 }))], '#7a7d72');
    wall('z', x1, z0, z1, 0, H, t, 'metal_wall', [{ c: 56, w: 1.6, y0: 0, y1: 2.4 }, ...[40, 48].map((c) => ({ c, w: 2, y0: 5.5, y1: 7 }))], '#7a7d72');
    box(x0, 0, z0, x1, 0.12, z1, 'concrete_floor');
    box(x0 - 0.4, H, z0 - 0.4, x1 + 0.4, H + 0.4, z1 + 0.4, 'roof', '#5a5d58');
    // 天窓の梁
    for (let x = x0 + 6; x < x1; x += 6) box(x - 0.2, H - 1.2, z0, x + 0.2, H - 0.8, z1, 'metal', '#4a4a48');
    // 中二階（北側 z0..z0+8, y=4.5）とオフィス
    const my = 4.5;
    const st = { x: x1 - 2.5, z: z0 + 8.6, axis: 'x', dir: -1, w: 1.4 };
    // 階段は x1-2.5 から -X 方向へ、z = z0+9.4 付近（中二階の外）
    const stairs2 = { x: x0 + 24, z: z0 + 9.2, axis: 'x', dir: -1, w: 1.4 };
    stairs({ ...stairs2, w: 1.4, axis: 'x' }, 0, my);
    void st;
    box(x0, my - 0.25, z0, x1, my, z0 + 8, 'concrete_floor');
    // 手すり
    wall('x', z0 + 8, x0, x1, my, my + 1.0, 0.08, 'metal', [{ c: x0 + 18.1, w: 1.6, y0: my, y1: my + 2 }], '#c8a020');
    box(x0 + 17.2, my - 0.25, z0 + 8, x0 + 18.9, my, z0 + 9.9, 'concrete_floor'); // 踊り場
    // 中二階の支柱
    for (let x = x0 + 4; x < x1; x += 8) box(x - 0.2, 0, z0 + 7.8, x + 0.2, my - 0.25, z0 + 8.2, 'metal', '#c8a020');
    // オフィス（事務所 key_office）: x0..x0+12、制御室（key_control）: x1-12..x1
    wall('x', z0 + 7.6, x0, x0 + 12, my, H - 2, 0.2, 'plaster', [{ c: x0 + 6, w: 1.4, y0: my, y1: my + 2.3 }, { c: x0 + 2.5, w: 1.6, y0: my + 1.0, y1: my + 2.2 }, { c: x0 + 9.5, w: 1.6, y0: my + 1.0, y1: my + 2.2 }], '#b8b0a0');
    wall('z', x0 + 12, z0, z0 + 7.6, my, H - 2, 0.2, 'plaster', [], '#b8b0a0');
    box(x0, H - 2, z0, x0 + 12, H - 1.8, z0 + 7.6, 'plaster', '#c8c0b0');
    door('x', x0 + 6, z0 + 7.6, my, 1.4, 2.3, { id: 'factory_office', locked: 'factory_office', name: '工場事務所' });
    F.desk(x0 + 3, z0 + 2.5, my, 0, { office: 2, intel: 0 });
    F.desk(x0 + 9, z0 + 2.5, my, 0);
    cont('filing', x0 + 0.6, my, z0 + 5.5, 1);
    cont('filing', x0 + 0.6, my, z0 + 4.4, 1);
    cont('safe', x0 + 11.2, my, z0 + 0.8, 0);
    cont('jacket', x0 + 11.6, my + 1.4, z0 + 4, 3);
    wall('x', z0 + 7.6, x1 - 12, x1, my, H - 2, 0.2, 'plaster', [{ c: x1 - 6, w: 1.4, y0: my, y1: my + 2.3 }, { c: x1 - 9.5, w: 1.6, y0: my + 1.0, y1: my + 2.2 }], '#a8b0b8');
    wall('z', x1 - 12, z0, z0 + 7.6, my, H - 2, 0.2, 'plaster', [], '#a8b0b8');
    box(x1 - 12, H - 2, z0, x1, H - 1.8, z0 + 7.6, 'plaster', '#c8c0b0');
    door('x', x1 - 6, z0 + 7.6, my, 1.4, 2.3, { id: 'control_room', locked: 'control_room', name: '制御室' });
    box(x1 - 11, my, z0 + 0.4, x1 - 1, my + 1.0, z0 + 1.4, 'metal', '#4a5a6a'); // 制御盤
    M.switches.push({ id: 'power', x: x1 - 6, y: my + 1.3, z: z0 + 1.2, label: 'ゲート電源を入れる', extract: 'power_gate' });
    cont('pc', x1 - 9, my + 1.0, z0 + 0.9, 0);
    cont('filing', x1 - 1, my, z0 + 5, 3);
    cont('lab_case', x1 - 3, my, z0 + 6.4, 0);
    loose(x1 - 4, my + 1.05, z0 + 0.9, { tech: 3, office: 1 });
    // 中二階の通路にコンテナ
    cont('locker', x0 + 14, my, z0 + 0.5, 0);
    cont('locker', x0 + 15, my, z0 + 0.5, 0);
    cont('toolbox', x0 + 20, my, z0 + 1, 0);
    F.shelf(x0 + 30, z0 + 1.0, 6, 'x', my, 3, { industrial: 2, tech: 1 });
    // 1階：ラック、木箱、フォークリフト
    for (let r = 0; r < 4; r++) {
      const z = z0 + 14 + r * 5;
      F.shelf(x0 + 10, z, 10, 'x', 0.12, 4, { industrial: 3, junk: 2, tech: 1 }, 3.4);
      F.shelf(x0 + 30, z, 10, 'x', 0.12, 4, { industrial: 3, junk: 2, building: 1 }, 3.4);
    }
    F.crates(x0 + 46, z0 + 14, 5, 0.12);
    F.crates(x0 + 46, z0 + 28, 4, 0.12);
    cont('crate', x0 + 44, 0.12, z0 + 20, 0);
    cont('crate', x0 + 50, 0.12, z0 + 33, 1);
    cont('toolbox', x0 + 52, 0.12, z0 + 12, 0);
    cont('toolbox', x0 + 2, 0.12, z0 + 34, 2);
    cont('crate', x0 + 1.5, 0.12, z0 + 12, 0);
    cont('weapon_box', x0 + 20, 0.12, z0 + 35, 2);
    cont('duffel', x0 + 21, 0.12, z0 + 11, 0);
    // フォークリフト
    box(x0 + 40, 0.12, z0 + 22, x0 + 41.4, 1.6, z0 + 24.4, 'car', '#d0a020');
    box(x0 + 40, 1.6, z0 + 22, x0 + 41.4, 2.4, z0 + 23.2, 'metal', '#2a2a2a');
    // 機械
    box(x0 + 2, 0.12, z0 + 18, x0 + 5, 2.8, z0 + 24, 'metal', '#4a6a5a');
    box(x0 + 2, 0.12, z0 + 26, x0 + 5, 2.0, z0 + 30, 'metal', '#6a5a4a');
    // ボイラー棟
    building({ x0: 24, z0: 38, x1: 36, z1: 52, floors: 1, fh: 5, mat: 'brick', color: '#7a4a3a', doors: [{ side: 'w', c: 7, door: { name: 'ボイラー室' } }, { side: 'e', c: 4 }], floorMat: 'concrete_floor', inner() {
      box(27, 0.12, 41, 31, 3.5, 47, 'metal', '#5a3a2a');
      box(32, 0.12, 48, 35, 1.2, 51, 'metal', '#3a3a3a');
      cont('toolbox', 34.5, 0.12, 40, 3);
      cont('crate', 25, 0.12, 50.5, 0);
      loose(33.5, 1.3, 49.5, { industrial: 2, tech: 1 });
    } });
    box(29, 5, 43, 31, 22, 45, 'brick', '#6a3a2a'); // 煙突
    // ガレージ
    building({ x0: -54, z0: 70, x1: -36, z1: 80, floors: 1, fh: 4.2, mat: 'metal_wall', color: '#5a6a7a', doors: [{ side: 'n', c: 4.5, w: 3.6, h: 3.4 }, { side: 'n', c: 13.5, w: 3.6, h: 3.4 }], windows: false, floorMat: 'concrete_floor', inner() {
      F.car(-49.5, 75.5, 0);
      cont('toolbox', -38, 0.12, 78.5, 0);
      cont('crate', -43.5, 0.12, 78.6, 0);
      F.shelf(-40.5, 72.5, 3, 'z', 0.12, 3, { industrial: 3, tech: 1 });
    } });
    // 工場敷地のフェンス
    F.fence('x', 22, -58, 40, 2.8, [[-10, 9], [30, 6]]);
    F.fence('x', 95, -58, 40, 2.8, [[-15, 6]]);
    F.fence('z', -58, 22, 95, 2.8, [[50, 6]]);
    F.fence('z', 40, 22, 95, 2.8, [[50, 7]]);
    M.extracts.push({ id: 'power_gate', name: '工場 裏ゲート', x: -15, z: 99, r: 4, type: 'switch', desc: '制御室でゲートの電源を入れると開く' });
    box(-18, 0, 95.5, -12, 3.2, 96.0, 'metal', '#8a6a2a', { gate: 'power_gate' });
    F.lamp(-30, 24); F.lamp(10, 24); F.lamp(-50, 90); F.lamp(30, 90);
    F.truck(0, 82, 1, '#5a5a6a');
    F.pallet(-30, 85); F.pallet(-28, 86); F.pallet(-26.5, 84.5);
    cont('crate', -25, 0, 88, 0);
    F.crates(15, 85, 4);
  }

  // ------------------------------------------------------------ 無線塔
  {
    const cx = -60, cz = -30;
    M.pois.push({ id: 'tower', name: '無線塔', x: cx, z: cz, r: 14, tags: ['tech'], tier: 2 });
    building({ x0: cx - 5, z0: cz - 4, x1: cx + 5, z1: cz + 4, floors: 1, fh: 3.6, mat: 'concrete', color: '#8a8a82', doors: [{ side: 's', c: 2.5, door: { id: 'radio_room', locked: 'radio_room', name: '無線機器室' } }, { side: 'e', c: 4 }], inner() {
      wall('z', cx + 1, cz - 4, cz + 4, 0, 3.6, 0.2, 'plaster', [{ c: cz + 2.5, w: 1.2, y0: 0, y1: 2.3 }], '#a0a098');
      box(cx - 4.5, 0.12, cz - 3.5, cx - 2.5, 2.2, cz - 2.8, 'metal', '#3a4a3a');
      cont('pc', cx - 1.5, 0.12, cz - 3.2, 0);
      cont('lab_case', cx - 4, 0.12, cz + 3, 0);
      cont('filing', cx - 0.4, 0.12, cz + 3.2, 0);
      F.desk(cx + 3, cz - 2.5, 0.12, 0, { tech: 3, office: 1 }, false);
      cont('locker', cx + 4.4, 0.12, cz + 3.2, 3);
    } });
    // 鉄塔
    const H = 42;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(cx + 8 + sx * 2 - 0.2, 0, cz + sz * 2 - 0.2, cx + 8 + sx * 2 + 0.2, H, cz + sz * 2 + 0.2, 'metal', '#a03020');
    for (let y = 4; y < H; y += 4) {
      box(cx + 6 - 0.1, y, cz - 2.1, cx + 10 + 0.1, y + 0.2, cz - 1.9, 'metal', '#c8c8c8');
      box(cx + 6 - 0.1, y, cz + 1.9, cx + 10 + 0.1, y + 0.2, cz + 2.1, 'metal', '#c8c8c8');
      box(cx + 5.9, y, cz - 2, cx + 6.1, y + 0.2, cz + 2, 'metal', '#c8c8c8');
      box(cx + 9.9, y, cz - 2, cx + 10.1, y + 0.2, cz + 2, 'metal', '#c8c8c8');
    }
    M.lamps.push({ x: cx + 8, y: H + 0.5, z: cz, red: true });
    F.fence('x', cz - 9, cx - 9, cx + 14, 2.5, [[cx + 2, 4]]);
    F.fence('x', cz + 9, cx - 9, cx + 14, 2.5, [[cx + 2.5, 4]]);
    F.fence('z', cx - 9, cz - 9, cz + 9, 2.5);
    F.fence('z', cx + 14, cz - 9, cz + 9, 2.5);
    noTree(cx - 10, cz - 10, cx + 15, cz + 10);
  }

  // ------------------------------------------------------------ 軍事基地（北西）
  {
    const bx0 = -178, bz0 = -178, bx1 = -76, bz1 = -76;
    M.pois.push({ id: 'base', name: '軍事基地', x: -127, z: -127, r: 50, tags: ['military'], tier: 3 });
    M.scavZones.push({ x: -127, z: -127, r: 40, n: 5, boss: true });
    noTree(bx0, bz0, bx1, bz1);
    // ヘスコ防壁（東と南にゲート）
    F.hesco(bx0, bz0, bx1, bz0 + 1.4);
    F.hesco(bx0, bz0, bx0 + 1.4, bz1);
    F.hesco(bx0, bz1 - 1.4, -126, bz1);
    F.hesco(-114, bz1 - 1.4, bx1, bz1);
    F.hesco(bx1 - 1.4, bz0, bx1, -126);
    F.hesco(bx1 - 1.4, -114, bx1, bz1);
    // 兵舎 3 棟
    for (let i = 0; i < 3; i++) {
      const z0 = -170 + i * 14;
      building({ x0: -170, z0, x1: -146, z1: z0 + 9, floors: 1, fh: 3.4, mat: 'plaster', color: '#8a8a6a', roofMat: 'roof', roofColor: '#4a5a3a', doors: [{ side: 'e', c: 4.5 }, { side: 'w', c: 4.5 }], floorMat: 'wood_floor', inner() {
        for (let k = 0; k < 5; k++) {
          F.bed(-168 + k * 4.8, z0 + 1.3, 0.12, 1);
          if (k % 2 === 0) cont('locker', -165.6 + k * 4.8, 0.12, z0 + 0.4, 0);
          F.bed(-168 + k * 4.8, z0 + 7.7, 0.12, 1);
        }
        cont('duffel', -150, 0.12, z0 + 4.5, 1);
        cont('military_crate', -158, 0.12, z0 + 4.5, 0);
        if (i === 1) cont('weapon_box', -163, 0.12, z0 + 4.5, 0);
      } });
    }
    // 司令部 2F
    building({ x0: -104, z0: -156, x1: -84, z1: -142, floors: 2, fh: 3.5, mat: 'concrete', color: '#8a8a7a', doors: [{ side: 's', c: 10, door: {} }, { side: 'w', c: 7 }], stairs: { x: -86, z: -143.5, axis: 'x', dir: -1, w: 1.5 }, floorMat: 'tile', inner({ fh }) {
      // 1F
      wall('x', -149, -104, -84, 0, fh, 0.2, 'plaster', [{ c: -94, w: 1.6, y0: 0, y1: 2.4 }, { c: -100, w: 1.6, y0: 0, y1: 2.4 }], '#b0b0a0');
      F.desk(-100, -153, 0.12, 0, { office: 2, military: 1, intel: 0 });
      F.desk(-94, -153, 0.12, 0);
      cont('filing', -103.3, 0.12, -150.5, 1);
      cont('filing', -103.3, 0.12, -155.2, 1);
      F.table(-96, -145.5, 0.12, 2.4, 1.2, { military: 2, office: 1 });
      cont('ammo_box', -88, 0.12, -150, 0);
      // 2F：指揮官室
      const y = fh;
      wall('x', -149, -104, -84, y, y + fh, 0.2, 'plaster', [{ c: -92, w: 1.6, y0: y, y1: y + 2.4 }], '#b0b0a0');
      F.desk(-96, -154, y, 0, { military: 2, intel: 1, valuable: 1 });
      cont('safe', -103, y, -155.2, 0);
      cont('weapon_box', -86, y, -155, 0);
      cont('military_crate', -101, y, -146, 0);
      F.sofa(-90, -152.5, y, 0);
      cont('filing', -84.6, y, -151, 3);
      loose(-97, y + 0.1, -145, { military: 2, valuable: 1 });
    } });
    // 武器庫（key_armory）
    building({ x0: -112, z0: -174, x1: -100, z1: -164, floors: 1, fh: 3.4, mat: 'concrete', color: '#6a6a62', t: 0.6, windows: false, doors: [{ side: 's', c: 6, door: { id: 'armory', locked: 'armory', name: '武器庫' } }], inner() {
      cont('weapon_box', -110.6, 0.12, -172.6, 0);
      cont('weapon_box', -107.6, 0.12, -172.6, 0);
      cont('weapon_box', -104.6, 0.12, -172.6, 0);
      cont('ammo_box', -101.4, 0.12, -172, 0);
      cont('ammo_box', -101.4, 0.12, -169.5, 3);
      cont('military_crate', -110.5, 0.12, -167.5, 1);
      F.shelf(-106, -168, 4, 'x', 0.12, 3, { military: 4 });
    } });
    // 指揮バンカー（key_bunker）
    building({ x0: -142, z0: -112, x1: -126, z1: -98, floors: 1, fh: 3.2, mat: 'concrete', color: '#5a5a54', t: 0.9, windows: false, doors: [{ side: 'e', c: 7, w: 1.4, door: { id: 'bunker', locked: 'bunker', name: '指揮バンカー' } }], roofColor: '#4a4a44', inner() {
      wall('z', -134, -112, -98, 0, 3.2, 0.3, 'concrete', [{ c: -105, w: 1.4, y0: 0, y1: 2.3 }], '#6a6a64');
      F.table(-138, -105, 0.12, 3, 1.6, { military: 2, intel: 2 });
      cont('safe', -141, 0.12, -111, 0);
      cont('filing', -141.2, 0.12, -100, 1);
      cont('lab_case', -130, 0.12, -110.5, 0);
      cont('military_crate', -128, 0.12, -100, 0);
      cont('pc', -131, 0.12, -110.8, 0);
      box(-133.5, 0.12, -111.5, -130, 1.8, -111, 'metal', '#3a4a3a');
    } });
    for (let s of [[-120, -160], [-120, -148]]) F.sandbags(s[0] - 2, s[1] - 0.5, s[0] + 2, s[1] + 0.5);
    F.watchtower(-170, -84);
    F.watchtower(-84, -170);
    F.watchtower(-84, -84, 6);
    F.truck(-112, -130, 0);
    F.truck(-105, -130, 0, '#3a4a2a');
    F.truck(-150, -88, 1, '#4a5a3a');
    F.sandbags(-80, -128, -78, -122); F.sandbags(-80, -112, -78, -106);
    F.sandbags(-128, -82, -122, -80);
    // ヘリパッド
    M.decals.push({ type: 'helipad', x: -152, z: -122, r: 9 });
    M.extracts.push({ id: 'heli', name: '軍事基地 ヘリパッド', x: -152, z: -122, r: 6, type: 'random', chance: 0.6, desc: '救援ヘリが来るかは運次第（発煙弾が上がっていれば利用可能）' });
    for (let i = 0; i < 6; i++) cont('military_crate', -165 + i * 4.5, 0, -100 + (i % 2) * 3, i % 4);
    cont('ammo_box', -96, 0, -120, 0);
    cont('supply_drop', -118, 0, -95, 0);
    F.lamp(-120, -135); F.lamp(-150, -135); F.lamp(-95, -100); F.lamp(-160, -100);
    // テント
    for (const [tx, tz] of [[-98, -110], [-98, -98], [-110, -88]]) {
      box(tx - 3, 0, tz - 2.5, tx + 3, 0.1, tz + 2.5, 'tarp', '#4a5a3a');
      box(tx - 3, 0.1, tz - 2.5, tx + 3, 2.4, tz - 2.3, 'tarp', '#56603f');
      box(tx - 3, 0.1, tz + 2.3, tx + 3, 2.4, tz + 2.5, 'tarp', '#56603f');
      box(tx - 3, 2.4, tz - 2.5, tx + 3, 2.6, tz + 2.5, 'tarp', '#4a5a3a');
      cont(rng.pick(['military_crate', 'ammo_box', 'med_case']), tx, 0.1, tz, 0);
      F.bed(tx - 1.8, tz, 0.1, 0);
    }
  }

  // ------------------------------------------------------------ 住宅街（北東）
  {
    M.pois.push({ id: 'residential', name: '住宅街', x: 125, z: -125, r: 55, tags: ['residential'], tier: 1 });
    M.scavZones.push({ x: 125, z: -130, r: 45, n: 5 });
    // アパート A, B（2F, 3 戸/階）
    const apt = (ax0, az0, name, locks) => {
      const ax1 = ax0 + 30, az1 = az0 + 12, fh = 3.3;
      building({ x0: ax0, z0: az0, x1: ax1, z1: az1, floors: 2, fh, mat: 'brick', color: rng.pick(['#8a5a4a', '#7a6a5a', '#9a8a7a']), doors: [{ side: 's', c: 2, w: 1.6, door: {} }], stairs: { x: ax0 + 1.0, z: az0 + 2.2, axis: 'x', dir: 1, w: 1.4 }, floorMat: 'wood_floor', inner() {
        for (let f = 0; f < 2; f++) {
          const y = f * fh, y1 = y + fh;
          // 廊下（ax0..ax0+4 が階段室、z: az0..az0+4.4 が通路）
          wall('z', ax0 + 4, az0 + 4.4, az1, y, y1, 0.2, 'plaster', [], '#b8a890');
          wall('x', az0 + 4.4, ax0 + 4, ax1, y, y1, 0.2, 'plaster', [0, 1, 2].map((k) => ({ c: ax0 + 6 + k * 8.7, w: 1.2, y0: y, y1: y + 2.3 })), '#b8a890');
          for (let k = 0; k < 3; k++) {
            const ux0 = ax0 + 4 + k * 8.7, ux1 = ux0 + 8.7;
            if (k > 0) wall('z', ux0, az0 + 4.4, az1, y, y1, 0.2, 'plaster', [], '#b8a890');
            const unitNo = `${f + 1}${k + 1}`;
            const lockId = locks[unitNo];
            door('x', ax0 + 6 + k * 8.7, az0 + 4.4, y, 1.2, 2.3, lockId ? { id: lockId, locked: lockId, name: `${name} ${unitNo}号室` } : {});
            F.bed(ux0 + 1.5, az1 - 1.5, y + 0.12, 1);
            F.table(ux0 + 5.5, az0 + 8, y + 0.12, 1.4, 0.9);
            cont(rng.pick(['drawer', 'jacket', 'locker']), ux1 - 0.6, y + 0.12, az1 - 0.6, 3);
            if (rng() < 0.6) cont('fridge', ux1 - 0.7, y + 0.12, az0 + 5.2, 3);
            if (lockId) { cont('safe', ux0 + 0.6, y + 0.12, az0 + 5.2, 1); cont('weapon_box', ux0 + 4, y + 0.12, az1 - 0.6, 2); loose(ux0 + 5.5, y + 0.95, az0 + 8, { valuable: 2, tech: 1 }); }
            else if (rng() < 0.5) F.sofa(ux0 + 5.5, az1 - 1, y + 0.12, 2);
          }
          cont('jacket', ax0 + 3.6, y + 1.3, az0 + 4.2, 0);
        }
      } });
    };
    apt(78, -172, 'アパートA', { 12: 'apt_12' });
    apt(122, -172, 'アパートB', { 21: 'apt_21' });
    // 戸建て
    const house = (hx, hz, rot) => {
      const w = 9, d = 8;
      building({ x0: hx, z0: hz, x1: hx + w, z1: hz + d, floors: 1, fh: 3, mat: rng.pick(['plaster', 'brick', 'wood_wall']), color: rng.pick(['#c8b8a0', '#a8b8a8', '#b8a8a0', '#d0c8b0', '#8a6a5a']), roofMat: 'roof', roofColor: rng.pick(['#6a2a2a', '#3a3a4a', '#4a3a2a']), doors: [{ side: rot ? 'n' : 's', c: 2.5, door: {} }, { side: 'e', c: 5 }], floorMat: 'wood_floor', inner() {
        wall('z', hx + 5, hz, hz + d, 0, 3, 0.15, 'plaster', [{ c: hz + 4, w: 1.2, y0: 0, y1: 2.3 }], '#d0c8b8');
        F.bed(hx + 7, hz + 2, 0.12, 0);
        F.table(hx + 2.5, hz + 4, 0.12);
        cont(rng.pick(['drawer', 'jacket']), hx + 8.4, 0.12, hz + 7.3, 3);
        cont(rng.pick(['fridge', 'drawer', 'duffel']), hx + 0.6, 0.12, hz + (rot ? 7.3 : 0.6), 1);
        if (rng() < 0.4) cont('med_case', hx + 5.6, 0.12, hz + 7.2, 0);
      } });
    };
    house(78, -142, 0); house(92, -142, 0); house(150, -142, 0); house(164, -142, 0);
    house(150, -112, 1); house(164, -112, 1); house(165, -88, 1);
    // 薬局（奥に倉庫 key_pharmacy）
    building({ x0: 78, z0: -104, x1: 96, z1: -88, floors: 1, fh: 3.6, mat: 'plaster', color: '#d8e0e0', roofColor: '#2a6a5a', doors: [{ side: 'n', c: 9, w: 2.4, door: { open: true } }], floorMat: 'tile', inner() {
      wall('z', 90, -104, -88, 0, 3.6, 0.2, 'plaster', [{ c: -96, w: 1.4, y0: 0, y1: 2.3 }], '#e0e0e0');
      door('z', 90, -96, 0, 1.4, 2.3, { id: 'pharmacy_back', locked: 'pharmacy_back', name: '薬局 倉庫' });
      F.counter(80, -98, 88, -97, 0.12, { medical: 3, residential: 1 });
      F.shelf(84, -92, 6, 'x', 0.12, 4, { medical: 4, food: 1 }, 2.0);
      cont('register', 84, 1.07, -97.5, 2);
      cont('med_case', 92, 0.12, -103, 0);
      cont('med_case', 95, 0.12, -103, 0);
      cont('med_case', 95.2, 0.12, -92, 3);
      F.shelf(93, -98, 4, 'z', 0.12, 4, { medical: 5 }, 2.0);
      cont('lab_case', 92.5, 0.12, -89.5, 0);
    } });
    // スーパー（金庫室 key_market）
    building({ x0: 110, z0: -104, x1: 142, z1: -82, floors: 1, fh: 4.2, mat: 'concrete', color: '#c8c0a8', roofColor: '#5a5a5a', doors: [{ side: 'n', c: 8, w: 3.2, door: { open: true } }, { side: 'n', c: 20, w: 3.2 }, { side: 's', c: 28, w: 1.6, door: {} }], floorMat: 'tile', inner() {
      for (let i = 0; i < 5; i++) F.shelf(116 + i * 4.2, -92, 9, 'z', 0.12, 4, { food: 4, residential: 2, junk: 1 }, 2.0);
      F.counter(112, -99, 114, -97, 0.12, { office: 1 }); cont('register', 113, 1.07, -98, 1);
      F.counter(112, -95, 114, -93, 0.12, { office: 1 }); cont('register', 113, 1.07, -94, 1);
      cont('fridge', 141, 0.12, -101, 3); cont('fridge', 141, 0.12, -99, 3); cont('fridge', 141, 0.12, -97, 3);
      // 金庫室
      wall('x', -88, 134, 142, 0, 4.2, 0.3, 'concrete', [{ c: 136, w: 1.4, y0: 0, y1: 2.3 }], '#8a8a80');
      wall('z', 134, -88, -82, 0, 4.2, 0.3, 'concrete', [], '#8a8a80');
      door('x', 136, -88, 0, 1.4, 2.3, { id: 'market_safe', locked: 'market_safe', name: 'スーパー 金庫室' });
      cont('safe', 141, 0.12, -83, 0); cont('safe', 139, 0.12, -83, 0); cont('filing', 135, 0.12, -83, 0);
      cont('duffel', 140.5, 0.12, -86.5, 3);
    } });
    // 住宅街の車・街灯
    for (let i = 0; i < 9; i++) F.car(70 + i * 12 + rng() * 4, -116 + (rng() < 0.5 ? -3 : 3), 1);
    for (let i = 0; i < 5; i++) F.lamp(75 + i * 25, -126);
    F.car(105, -150, 0); F.car(118, -152, 0);
    // 公園
    box(100, 0, -84, 104, 0.6, -80, 'sand', '#c8b080');
    noTree(70, -180, 180, -78);
  }

  // ------------------------------------------------------------ 研究所（東）
  {
    const lx0 = 96, lz0 = -12, lx1 = 178, lz1 = 72;
    M.pois.push({ id: 'lab', name: '研究所', x: 137, z: 28, r: 42, tags: ['tech', 'machine'], tier: 4 });
    M.machineZones.push({ x: 137, z: 28, r: 40, n: 6, heavy: 2 });
    noTree(lx0, lz0, lx1, lz1);
    F.fence('x', lz0, lx0, lx1, 3.2, [[120, 8]]);
    F.fence('x', lz1, lx0, lx1, 3.2, [[150, 6]]);
    F.fence('z', lx0, lz0, lz1, 3.2, [[50, 8]]);
    F.fence('z', lx1, lz0, lz1, 3.2);
    // 本館 2F
    const x0 = 110, z0 = 4, x1 = 162, z1 = 36, fh = 4;
    building({ x0, z0, x1, z1, floors: 2, fh, mat: 'concrete', color: '#c8ccd0', roofColor: '#7a7e82', winSpacing: 3.4, doors: [{ side: 'n', c: 26, w: 3, door: { open: true } }, { side: 'w', c: 16, w: 1.6, door: {} }], stairs: { x: x0 + 2, z: z0 + 2.2, axis: 'x', dir: 1, w: 1.6 }, floorMat: 'lab_floor', inner() {
      // 1F：ロビー／ブルー（居住）／グリーン（医療）
      wall('x', z0 + 12, x0, x1, 0, fh, 0.25, 'plaster', [{ c: x0 + 26, w: 2.4, y0: 0, y1: 2.6 }], '#e0e4e8');
      wall('z', x0 + 18, z0 + 12, z1, 0, fh, 0.25, 'plaster', [{ c: z0 + 20, w: 1.4, y0: 0, y1: 2.4 }], '#e0e4e8');
      wall('z', x0 + 34, z0 + 12, z1, 0, fh, 0.25, 'plaster', [{ c: z0 + 20, w: 1.4, y0: 0, y1: 2.4 }], '#e0e4e8');
      door('z', x0 + 18, z0 + 20, 0, 1.4, 2.4, { id: 'lab_blue', locked: 'lab_blue', name: 'ブルー区画（居住）', color: '#2a6ad0' });
      door('z', x0 + 34, z0 + 20, 0, 1.4, 2.4, { id: 'lab_green', locked: 'lab_green', name: 'グリーン区画（医療）', color: '#2ad04a' });
      // ロビー
      F.counter(x0 + 22, z0 + 6, x0 + 30, z0 + 7, 0.12, { office: 2, tech: 1 });
      cont('pc', x0 + 24, 1.07, z0 + 6.5, 2);
      F.desk(x0 + 8, z0 + 8, 0.12, 0, { tech: 2, office: 2 });
      F.desk(x0 + 40, z0 + 8, 0.12, 0, { tech: 2, office: 2 });
      cont('filing', x1 - 0.6, 0.12, z0 + 3, 3);
      cont('lab_case', x1 - 1, 0.12, z0 + 10, 3);
      // ブルー（居住）
      for (let k = 0; k < 3; k++) { F.bed(x0 + 2 + k * 5, z1 - 1.5, 0.12, 1); cont('locker', x0 + 4 + k * 5, 0.12, z1 - 0.5, 2); }
      F.table(x0 + 9, z0 + 18, 0.12, 3, 1.2, { tech: 2, food: 1, valuable: 1 });
      cont('fridge', x0 + 0.6, 0.12, z0 + 14, 1);
      // グリーン（医療）
      for (let k = 0; k < 3; k++) { F.bed(x0 + 21 + k * 4.5, z1 - 1.6, 0.12, 1); cont('med_case', x0 + 23 + k * 4.5, 0.12, z1 - 0.6, 2); }
      F.table(x0 + 26, z0 + 18, 0.12, 4, 1.2, { medical: 3, tech: 1 });
      cont('lab_case', x0 + 33, 0.12, z0 + 13, 3);
      // 東側：エレベーターホール
      F.shelf(x0 + 44, z0 + 20, 6, 'z', 0.12, 4, { tech: 3, machine: 1 });
      cont('arc_cache', x0 + 40, 0.12, z1 - 1.5, 0);
      // 2F：レッド（機密）・研究室
      const y = fh;
      wall('x', z0 + 12, x0 + 6, x1, y, y + fh, 0.25, 'plaster', [{ c: x0 + 14, w: 1.6, y0: y, y1: y + 2.4 }, { c: x0 + 38, w: 1.6, y0: y, y1: y + 2.4 }], '#e0e4e8');
      wall('z', x0 + 26, z0 + 12, z1, y, y + fh, 0.25, 'concrete', [{ c: z0 + 24, w: 1.4, y0: y, y1: y + 2.4 }], '#a0a4a8');
      wall('z', x0 + 30, z0 + 12, z1, y, y + fh, 0.25, 'concrete', [], '#a0a4a8');
      door('z', x0 + 26, z0 + 24, y, 1.4, 2.4, { id: 'lab_red', locked: 'lab_red', name: 'レッド区画（機密保管室）', color: '#d02a2a' });
      // 研究室（西）
      for (let k = 0; k < 3; k++) F.table(x0 + 5 + k * 6.5, z0 + 24, y, 3, 1.2, { tech: 3, medical: 1, machine: 1 });
      cont('lab_case', x0 + 1, y, z1 - 1, 0);
      cont('pc', x0 + 20, y, z1 - 0.6, 2);
      // レッド（x0+26..x0+30 は通路/前室、レッド室は x0+30..x1 南半分）
      wall('x', z0 + 22, x0 + 30, x1, y, y + fh, 0.3, 'concrete', [], '#8a8e92');
      cont('safe', x0 + 32, y, z1 - 1, 0);
      cont('lab_case', x0 + 36, y, z1 - 1, 0);
      cont('lab_case', x0 + 40, y, z1 - 1, 0);
      cont('arc_cache', x0 + 46, y, z1 - 1.2, 0);
      cont('weapon_box', x1 - 1.5, y, z0 + 24, 1);
      loose(x0 + 44, y + 0.1, z0 + 28, { valuable: 3, tech: 2, machine: 1 });
      // 北半分（サーバールーム）
      for (let k = 0; k < 4; k++) box(x0 + 33 + k * 4, y, z0 + 15, x0 + 34.5 + k * 4, y + 2.4, z0 + 20, 'metal', '#2a2e34');
      cont('pc', x0 + 50, y, z0 + 14, 3);
      cont('filing', x0 + 31, y, z0 + 13, 1);
    } });
    // 地下エレベーター（脱出）
    building({ x0: 164, z0: 22, x1: 172, z1: 30, floors: 1, fh: 4, mat: 'concrete', color: '#a0a4a8', windows: false, doors: [{ side: 'w', c: 4, w: 2 }], floorMat: 'lab_floor' });
    M.extracts.push({ id: 'lab_elevator', name: '研究所 地下エレベーター', x: 168, z: 26, r: 2.6, type: 'key', key: 'card_black', desc: 'ブラックキーカードを所持していると起動できる' });
    // 墜落した ARC 機
    for (const [ax, az] of [[105, 55], [168, 60], [150, 46]]) { box(ax - 3, 0, az - 2, ax + 3, 1.8, az + 2, 'arc_metal'); cont('arc_cache', ax + 3.6, 0, az, 1); }
    F.truck(128, 50, 1, '#e0e0e0');
    F.car(144, 52, 0, '#e0e0e0'); F.car(104, 20, 0);
    for (let i = 0; i < 4; i++) F.lamp(104 + i * 20, 44);
  }

  // ------------------------------------------------------------ ガソリンスタンド・モーテル（南西）
  {
    M.pois.push({ id: 'gas', name: 'ガソリンスタンド', x: -132, z: 54, r: 22, tags: ['residential', 'industrial'], tier: 1 });
    M.pois.push({ id: 'motel', name: 'モーテル', x: -145, z: 100, r: 26, tags: ['residential'], tier: 1 });
    M.scavZones.push({ x: -138, z: 75, r: 35, n: 4 });
    // キャノピー
    noTree(-152, 36, -108, 72);
    for (const [px, pz] of [[-130, 46], [-118, 46], [-130, 62], [-118, 62]]) box(px - 0.3, 0, pz - 0.3, px + 0.3, 5, pz + 0.3, 'concrete', '#d0d0c8');
    box(-133, 5, 43, -115, 5.6, 65, 'metal', '#c03020');
    for (const pz of [50, 58]) { box(-125, 0, pz - 0.8, -123, 1.6, pz + 0.8, 'metal', '#d0d0d0'); }
    box(-140, 0, 44, -134, 0.2, 66, 'concrete', '#9a9a92');
    // 売店
    building({ x0: -152, z0: 42, x1: -138, z1: 56, floors: 1, fh: 3.6, mat: 'plaster', color: '#e0d8c8', roofColor: '#c03020', doors: [{ side: 'e', c: 4, w: 2, door: { open: true } }], floorMat: 'tile', inner() {
      wall('x', 51, -152, -138, 0, 3.6, 0.2, 'plaster', [{ c: -141, w: 1.4, y0: 0, y1: 2.3 }], '#d8d0c0');
      door('x', -141, 51, 0, 1.4, 2.3, { id: 'gas_office', locked: 'gas_office', name: 'GS事務所' });
      F.shelf(-147, 46, 5, 'x', 0.12, 3, { food: 4, residential: 1 }, 1.8);
      F.counter(-142, 43, -139, 45, 0.12, { office: 1, food: 1 });
      cont('register', -140.5, 1.07, 44, 1);
      cont('fridge', -151.2, 0.12, 44, 1); cont('fridge', -151.2, 0.12, 46, 1);
      F.desk(-148, 54.5, 0.12, 0, { office: 2, industrial: 1 });
      cont('safe', -151.2, 0.12, 52, 1);
      cont('filing', -138.8, 0.12, 55, 3);
    } });
    M.extracts.push({ id: 'car', name: 'ガソリンスタンド 車両脱出', x: -124, z: 68, r: 3.5, type: 'pay', cost: 5000, desc: '運転手に5,000 C 払えば乗せてもらえる' });
    F.car(-124, 68, 1, '#2a2a2a');
    F.car(-128, 54, 0); F.truck(-108, 60, 0, '#a08a3a');
    cont('toolbox', -137, 0, 64, 0);
    cont('crate', -135, 0, 66, 0);
    // モーテル
    building({ x0: -172, z0: 92, x1: -116, z1: 102, floors: 1, fh: 3.2, mat: 'wood_wall', color: '#a88a6a', roofColor: '#5a3a2a', winSpacing: 8, doors: [0, 1, 2, 3, 4, 5, 6].map((k) => ({ side: 's', c: 2 + k * 8, w: 1.2, door: k === 6 ? { id: 'motel_7', locked: 'motel_7', name: 'モーテル 7号室' } : {} })), floorMat: 'carpet', inner() {
      for (let k = 0; k < 7; k++) {
        const ux0 = -172 + k * 8;
        if (k > 0) wall('z', ux0, 92, 102, 0, 3.2, 0.2, 'plaster', [], '#c8b8a0');
        F.bed(ux0 + 5.5, 94.5, 0.12, 0);
        cont(rng.pick(['drawer', 'jacket', 'duffel']), ux0 + 0.6, 0.12, 92.6, 0);
        if (k === 6) { cont('weapon_box', ux0 + 2, 0.12, 93, 0); cont('safe', ux0 + 7.3, 0.12, 100, 3); cont('duffel', ux0 + 3, 0.12, 100.5, 0); loose(ux0 + 5.5, 0.8, 94.5, { valuable: 2, military: 1 }); }
        else if (rng() < 0.5) loose(ux0 + 3, 0.12, 97, { residential: 2, junk: 1 });
      }
    } });
    box(-172, 0, 102, -116, 0.15, 105, 'concrete', '#8a8a82');
    for (let i = 0; i < 4; i++) F.car(-165 + i * 13, 109, 0);
    // ダイナー
    building({ x0: -108, z0: 86, x1: -94, z1: 100, floors: 1, fh: 3.4, mat: 'metal_wall', color: '#c8c8c0', roofColor: '#c03020', doors: [{ side: 's', c: 7, w: 1.8, door: { open: true } }], floorMat: 'tile', inner() {
      F.counter(-106, 88, -96, 89, 0.12, { food: 3 });
      for (let k = 0; k < 3; k++) F.table(-104 + k * 4, 96, 0.12, 1.2, 1.2, { food: 2, residential: 1 });
      cont('fridge', -107.3, 0.12, 87.5, 1);
      cont('register', -100, 1.07, 88.5, 2);
    } });
    F.lamp(-120, 75); F.lamp(-140, 108); F.lamp(-100, 108);
  }

  // ------------------------------------------------------------ 港湾（南）
  {
    M.pois.push({ id: 'docks', name: '港湾コンテナヤード', x: -10, z: 142, r: 45, tags: ['industrial'], tier: 2 });
    M.pois.push({ id: 'warehouse', name: '港の倉庫', x: 95, z: 138, r: 30, tags: ['industrial'], tier: 2 });
    M.scavZones.push({ x: 10, z: 140, r: 40, n: 4 });
    M.scavZones.push({ x: 95, z: 140, r: 25, n: 3 });
    noTree(-70, 116, 180, 176);
    // コンテナヤード
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        const x = -56 + c * 14, z = 122 + r * 9;
        if (rng() < 0.12) continue;
        const open = rng() < 0.22;
        F.shippingContainer(x, z, 'x', 0, null, open);
        if (!open && rng() < 0.55) F.shippingContainer(x + (rng() - 0.5) * 0.4, z, 'x', 2.6, null, false);
        if (!open && rng() < 0.18) F.shippingContainer(x, z, 'x', 5.2, null, false);
      }
    }
    // クレーン
    for (const cx of [-30, 10]) {
      box(cx - 6, 0, 166, cx - 5, 22, 167, 'metal', '#c8a020');
      box(cx + 5, 0, 166, cx + 6, 22, 167, 'metal', '#c8a020');
      box(cx - 6, 0, 171, cx - 5, 22, 172, 'metal', '#c8a020');
      box(cx + 5, 0, 171, cx + 6, 22, 172, 'metal', '#c8a020');
      box(cx - 6, 22, 158, cx + 6, 24, 190, 'metal', '#c8a020');
      box(cx - 2, 17, 175, cx + 2, 19, 178, 'metal', '#3a3a3a');
    }
    // 倉庫 2 棟
    building({ x0: 60, z0: 124, x1: 88, z1: 152, floors: 1, fh: 7, mat: 'metal_wall', color: '#6a7a8a', roofColor: '#4a5a6a', winSpacing: 7, doors: [{ side: 'n', c: 14, w: 5, h: 4.5 }, { side: 'w', c: 22, w: 1.6, door: {} }], floorMat: 'concrete_floor', inner() {
      for (let i = 0; i < 3; i++) F.shelf(66 + i * 8, 140, 12, 'z', 0.12, 4, { industrial: 3, junk: 1, food: 1 }, 3.6);
      F.crates(84, 128, 4, 0.12);
      cont('crate', 62, 0.12, 150, 0); cont('crate', 86, 0.12, 150, 0);
      cont('toolbox', 62, 0.12, 128, 0);
      F.pallet(78, 128, 0.12); F.pallet(80, 128, 0.12);
    } });
    building({ x0: 100, z0: 124, x1: 128, z1: 152, floors: 1, fh: 7, mat: 'metal_wall', color: '#8a6a5a', roofColor: '#5a4a3a', winSpacing: 7, doors: [{ side: 'n', c: 6, w: 1.6, door: { id: 'dock_ware', locked: 'dock_ware', name: '埠頭倉庫' } }, { side: 's', c: 14, w: 5, h: 4.5, door: null }], floorMat: 'concrete_floor', inner() {
      for (let i = 0; i < 3; i++) F.shelf(106 + i * 8, 136, 12, 'z', 0.12, 4, { industrial: 2, tech: 2, military: 1 }, 3.6);
      cont('military_crate', 102, 0.12, 126, 0); cont('military_crate', 126, 0.12, 126, 0);
      cont('weapon_box', 114, 0.12, 126.2, 0);
      cont('safe', 127, 0.12, 133, 3);
      cont('ammo_box', 102, 0.12, 150, 0);
    } });
    // 南側の倉庫入口は開かない大扉（板で塞ぐ）
    box(111.5, 0, 151.8, 116.5, 4.5, 152.2, 'metal', '#5a4a3a');
    // 桟橋
    box(55, -0.6, 168, 65, 0.3, 196, 'wood_floor', '#6a5a40');
    for (let z = 170; z < 196; z += 4) for (const x of [55.3, 64.7]) box(x - 0.2, -3, z - 0.2, x + 0.2, 0.3, z + 0.2, 'wood', '#4a3a2a');
    M.extracts.push({ id: 'boat', name: '埠頭 小型ボート', x: 60, z: 192, r: 3.5, type: 'always', desc: '桟橋の先に係留されたボート' });
    // ボート
    box(57.5, -0.4, 196.5, 62.5, 0.8, 203, 'car', '#e0e0e0');
    // 港湾の照明
    for (let i = 0; i < 6; i++) F.lamp(-60 + i * 28, 116);
    for (let i = 0; i < 6; i++) cont(rng.pick(['crate', 'toolbox', 'duffel']), -60 + rng() * 100, 0, 117 + rng() * 2, rng.int(0, 3));
    F.truck(30, 130, 0, '#2a4a7a'); F.truck(44, 145, 0, '#7a2a20');
  }

  // ------------------------------------------------------------ 北部：線路とトンネル脱出、ARC 墜落地点
  {
    M.extracts.push({ id: 'tunnel', name: '北 鉄道トンネル', x: 40, z: -190, r: 4, type: 'always', desc: '北の崖に開いた古いトンネル' });
    // トンネル開口部（崖に穴）
    box(32, 0, -200, 34, 8, -186, 'concrete', '#5a5a52');
    box(46, 0, -200, 48, 8, -186, 'concrete', '#5a5a52');
    box(32, 6, -200, 48, 8, -186, 'concrete', '#5a5a52');
    box(34, 0, -199.5, 46, 6, -196, 'tunnel_dark');
    noTree(28, -200, 52, -170);
    M.extracts.push({ id: 'sewer', name: '西 下水道出口', x: -191, z: -6, r: 3.5, type: 'always', desc: '西の崖下にある下水道の排水口' });
    box(-200, 0, -12, -193, 4, -10.5, 'concrete', '#4a4a44');
    box(-200, 0, -1.5, -193, 4, 0, 'concrete', '#4a4a44');
    box(-200, 3.5, -12, -193, 4.5, 0, 'concrete', '#4a4a44');
    box(-200, 0, -10.5, -198, 3.5, -1.5, 'tunnel_dark');
    noTree(-200, -20, -175, 8);
    // 線路
    M.decals.push({ type: 'rail', x0: 40, z0: -192, x1: 40, z1: -60 });
    // ARC 墜落地点
    M.pois.push({ id: 'crash_n', name: 'ARC墜落地点', x: -20, z: -110, r: 20, tags: ['machine'], tier: 3 });
    M.machineZones.push({ x: -20, z: -110, r: 22, n: 4, heavy: 1 });
    box(-26, 0, -114, -14, 2.5, -106, 'arc_metal');
    box(-22, 2.5, -112, -16, 4.2, -108, 'arc_metal');
    box(-32, 0, -100, -28, 1.4, -96, 'arc_metal');
    cont('arc_cache', -12, 0, -110, 0); cont('arc_cache', -28, 0, -116, 0); cont('arc_cache', -30, 0, -94, 0);
    F.rockCluster(-8, -98, 5); F.rockCluster(-36, -120, 5);
    noTree(-40, -125, 0, -90);
    M.pois.push({ id: 'crash_s', name: '南の墜落機', x: -80, z: 150, r: 14, tags: ['machine'], tier: 3 });
    M.machineZones.push({ x: -80, z: 150, r: 18, n: 3, heavy: 0 });
    box(-86, 0, 146, -74, 2.2, 154, 'arc_metal');
    cont('arc_cache', -72, 0, 150, 0); cont('arc_cache', -88, 0, 156, 1);
    noTree(-95, 136, -65, 165);
    M.machineZones.push({ x: 0, z: -40, r: 60, n: 4, heavy: 0, roam: true });
    M.machineZones.push({ x: 60, z: 80, r: 40, n: 3, heavy: 0, roam: true });
    // 農家（北中央）
    building({ x0: -100, z0: -60, x1: -88, z1: -50, floors: 1, fh: 3, mat: 'wood_wall', color: '#7a5a3a', roofColor: '#4a2a1a', doors: [{ side: 's', c: 6, door: {} }], floorMat: 'wood_floor', inner() {
      F.table(-94, -55, 0.12); cont('drawer', -99.4, 0.12, -59.4, 1); cont('crate', -89, 0.12, -59, 0); F.bed(-90, -52, 0.12, 1);
    } });
    building({ x0: -84, z0: -64, x1: -70, z1: -52, floors: 1, fh: 5, mat: 'wood_wall', color: '#8a3a2a', roofColor: '#3a2a1a', windows: false, doors: [{ side: 'w', c: 6, w: 3.5, h: 3.5 }], floorMat: 'dirt_floor', inner() {
      F.crates(-76, -58, 4, 0.12); cont('crate', -72, 0.12, -62, 0); cont('toolbox', -82, 0.12, -62.5, 0); F.truck(-76, -58, 0, '#6a6a5a');
    } });
    M.pois.push({ id: 'farm', name: '農家', x: -88, z: -56, r: 14, tags: ['residential'], tier: 1 });
    // 中央の検問所
    F.sandbags(30, -6, 34, -5); F.sandbags(46, 5, 50, 6);
    building({ x0: 26, z0: -14, x1: 32, z1: -8, floors: 1, fh: 3, mat: 'concrete', color: '#8a8a7a', doors: [{ side: 'e', c: 3 }], floorMat: 'concrete_floor', inner() {
      F.desk(28.5, -12.5, 0.12, 0, { military: 1, office: 1 }, false); cont('ammo_box', 27, 0.12, -9, 0);
    } });
    M.pois.push({ id: 'checkpoint', name: '検問所', x: 34, z: -6, r: 12, tags: ['military'], tier: 2 });
    F.car(52, -3, 1); F.truck(60, 4, 1, '#3a4a2a'); F.car(-40, 3, 1); F.car(-90, -3, 1); F.car(80, 3, 1); F.car(-160, 4, 1);
    // バス停留所・道端
    for (let i = 0; i < 10; i++) F.lamp(-180 + i * 38, -7);
  }

  // ------------------------------------------------------------ 散在する小物（岩・瓦礫）
  for (let i = 0; i < 40; i++) {
    const x = (rng() - 0.5) * 360, z = (rng() - 0.5) * 340;
    if (inNoTree(M, x, z) || nearRoad(M, x, z, 7)) continue;
    F.rockCluster(x, z, 2 + rng() * 4);
    M.noTree.push([x - 4, z - 4, x + 4, z + 4]);
  }
  // 小さな物資隠し（森の中）
  for (let i = 0; i < 22; i++) {
    const x = (rng() - 0.5) * 360, z = (rng() - 0.5) * 330;
    if (inNoTree(M, x, z) || nearRoad(M, x, z, 6)) continue;
    cont(rng.pick(['duffel', 'crate', 'jacket', 'ammo_box', 'med_case', 'toolbox']), x, 0, z, rng.int(0, 3), { stash: true });
    M.noTree.push([x - 2, z - 2, x + 2, z + 2]);
  }

  // ------------------------------------------------------------ 木
  for (let i = 0; i < 2600 && M.trees.length < 900; i++) {
    const x = (rng() - 0.5) * 384, z = (rng() - 0.5) * 350 - 10;
    // 西と北に森を多めに
    const forest = (x < -150 ? 0.8 : 0) + (z < -60 && x > -70 && x < 30 ? 0.6 : 0) + (x > 20 && x < 90 && z > 60 && z < 110 ? 0.6 : 0) + (x > -110 && x < -60 && z > -40 && z < 40 ? 0.5 : 0) + 0.12;
    if (rng() > forest) continue;
    if (inNoTree(M, x, z) || nearRoad(M, x, z, 6.5) || z > 168) continue;
    const kind = rng() < 0.6 ? 'pine' : 'birch';
    const s = 0.75 + rng() * 0.6;
    M.trees.push({ x, z, s, kind, rot: rng() * Math.PI * 2 });
    box(x - 0.25 * s, 0, z - 0.25 * s, x + 0.25 * s, 9 * s, z + 0.25 * s, 'tree', null, { hidden: true });
  }
  for (let i = 0; i < 1400; i++) {
    const x = (rng() - 0.5) * 384, z = (rng() - 0.5) * 350;
    if (inNoTree(M, x, z) || nearRoad(M, x, z, 5.5) || z > 168) continue;
    M.bushes.push({ x, z, s: 0.6 + rng() * 0.9, rot: rng() * 6.28 });
  }

  // ------------------------------------------------------------ スポーン地点
  M.spawns.push(
    { x: -185, z: 30, yaw: -Math.PI / 2 }, { x: -175, z: -50, yaw: -Math.PI / 2 }, { x: -60, z: -185, yaw: Math.PI },
    { x: 10, z: -185, yaw: Math.PI }, { x: 90, z: -186, yaw: Math.PI }, { x: 186, z: -60, yaw: Math.PI / 2 },
    { x: 186, z: 90, yaw: Math.PI / 2 }, { x: 150, z: 165, yaw: 0 }, { x: -100, z: 168, yaw: 0 },
    { x: -185, z: 140, yaw: -Math.PI / 2 }, { x: 70, z: -60, yaw: Math.PI }, { x: -30, z: 110, yaw: 0 },
  );

  return M;
}

export function inNoTree(M, x, z) {
  for (const r of M.noTree) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true;
  return false;
}
export function nearRoad(M, x, z, d) {
  for (const r of M.roads) {
    const dx = r.x1 - r.x0, dz = r.z1 - r.z0;
    const L2 = dx * dx + dz * dz;
    let t = ((x - r.x0) * dx + (z - r.z0) * dz) / L2;
    t = Math.max(0, Math.min(1, t));
    const px = r.x0 + dx * t, pz = r.z0 + dz * t;
    if (Math.hypot(x - px, z - pz) < r.w / 2 + d) return true;
  }
  return false;
}

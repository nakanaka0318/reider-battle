// Procedural Canvas2D inventory icons (no external image assets).
// Style: dark, gritty military-sim inventory. Transparent background; the UI
// draws cell background and rarity border. Each icon key has its own drawer.

export const ICON_CELL = 64; // pixels per grid cell

const TAU = Math.PI * 2;
const OUT = 'rgba(9,10,11,0.92)';
const HL = 'rgba(255,255,255,0.28)';
const SHD = 'rgba(0,0,0,0.35)';
const STEEL = '#2d3135';
const METAL = '#8a9197';
const BRASS = '#c99a3c';
const COPPER = '#b4683a';
const WOOD = '#6e4728';
const RED = '#b0302a';
const PAPER = '#d8cfb4';
const CARD = '#a8845a';
const GLASS = 'rgba(170,215,235,0.38)';
const BLACK = '#18191b';
const WHITE = '#e6e3da';
const PCB = '#2f5a35';
const GOLD = '#d4a83a';

// ---------------------------------------------------------------- colors
function toRgb(col) {
  if (Array.isArray(col)) return col;
  if (typeof col === 'number') return [(col >> 16) & 255, (col >> 8) & 255, col & 255];
  if (typeof col !== 'string') return [128, 128, 128];
  const s = col.trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((ch) => ch + ch).join('');
    h = h.slice(0, 6);
    const n = parseInt(h, 16);
    if (h.length !== 6 || Number.isNaN(n)) return [128, 128, 128];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v));
    return [p[0] || 0, p[1] || 0, p[2] || 0];
  }
  return [128, 128, 128];
}
function rgb(a, al = 1) {
  const [r, g, b] = a.map((v) => Math.round(Math.max(0, Math.min(255, v))));
  return al >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${al})`;
}
function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return rgb([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
function shade(col, amt) {
  return amt >= 0 ? mix(col, '#ffffff', amt) : mix(col, '#000000', -amt);
}
function alpha(col, a) {
  return rgb(toRgb(col), a);
}
function lum(col) {
  const [r, g, b] = toRgb(col);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

const CAT_COLOR = {
  weapon: '#3a3e42', ammo: '#7d6a3e', mod: '#45494d', attachment: '#45494d',
  gear: '#56603f', armor: '#4f5640', helmet: '#4f5640', rig: '#4f5640', backpack: '#5b5440',
  container: '#34373a', med: '#c9c6bb', meds: '#c9c6bb', medical: '#c9c6bb',
  food: '#8a6a3f', drink: '#3f6f9a', key: '#b09455', keys: '#b09455',
  barter: '#76705f', misc: '#76705f', valuable: '#c9a23a', tech: '#4b5a4f',
  electronics: '#4b5a4f', tool: '#6a5d4a', tools: '#6a5d4a', quest: '#8a6f4a', throwable: '#4f5a3a',
};
const CAT_ACCENT = {
  med: '#c0302a', meds: '#c0302a', medical: '#c0302a', food: '#d6a23a',
  weapon: '#7a5634', ammo: '#c79b3b', key: '#d8c07a', keys: '#d8c07a',
};
const CAT_ICON = {
  weapon: 'rifle', ammo: 'ammo_box', mod: 'scope', attachment: 'scope', gear: 'armor',
  armor: 'armor', helmet: 'helmet', rig: 'rig', backpack: 'backpack', container: 'case',
  med: 'medkit', meds: 'medkit', medical: 'medkit', food: 'can', drink: 'water',
  key: 'key', keys: 'key', barter: 'box', misc: 'box', valuable: 'gold', tech: 'circuit',
  electronics: 'circuit', tool: 'tool', tools: 'tool', throwable: 'grenade', grenade: 'grenade',
};

function palette(item) {
  const raw = item.color;
  const base = raw != null && raw !== '' ? rgb(toRgb(raw)) : CAT_COLOR[item.cat] || '#6f6a5e';
  const [h, s] = rgbToHsl(toRgb(base));
  const accent = CAT_ACCENT[item.cat] ||
    rgb(hslToRgb((h + 0.5) % 1, Math.min(0.6, Math.max(0.35, s)), 0.5));
  return {
    base,
    light: shade(base, 0.35),
    dark: shade(base, -0.5),
    accent,
    rarity: item.rarity | 0,
  };
}

// ---------------------------------------------------------------- path helpers
function rrPath(ctx, x, y, w, h, r) {
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Drawing kit bound to a fitted frame f. All coordinates are fractions of the
// frame (x of width, y of height); radii are fractions of M = min(w, h).
function makeKit(ctx, f, c) {
  const X = (t) => f.x + f.w * t;
  const Y = (t) => f.y + f.h * t;
  const M = Math.min(f.w, f.h);
  const LW = Math.max(1.2, Math.min(2.2, M * 0.04));
  const P = {
    m: (x, y) => ctx.moveTo(X(x), Y(y)),
    l: (x, y) => ctx.lineTo(X(x), Y(y)),
    q: (cx, cy, x, y) => ctx.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y)),
    b: (ax, ay, bx, by, x, y) => ctx.bezierCurveTo(X(ax), Y(ay), X(bx), Y(by), X(x), Y(y)),
    a: (x, y, r, s, e, ccw) => ctx.arc(X(x), Y(y), Math.max(0.1, r * M), s, e, !!ccw),
    e: (x, y, rx, ry, rot = 0, s = 0, e = TAU) =>
      ctx.ellipse(X(x), Y(y), Math.max(0.1, rx * f.w), Math.max(0.1, ry * f.h), rot, s, e),
    z: () => ctx.closePath(),
  };
  const fs = (fill, stroke) => {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke !== false && stroke !== 0 && stroke !== null) {
      ctx.lineWidth = typeof stroke === 'number' ? stroke : LW;
      ctx.strokeStyle = OUT;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  };
  const cylStops = (col) => [
    [0, shade(col, -0.3)], [0.28, shade(col, 0.38)], [0.5, col], [1, shade(col, -0.58)],
  ];
  const g = {
    ctx, c, f, X, Y, M, LW, P, fs,
    W: (t) => f.w * t,
    H: (t) => f.h * t,
    save() { ctx.save(); },
    restore() { ctx.restore(); },
    rotAt(x, y, ang) {
      ctx.translate(X(x), Y(y));
      ctx.rotate(ang);
      ctx.translate(-X(x), -Y(y));
    },
    box(x1, y1, x2, y2, rad, fill, stroke) {
      ctx.beginPath();
      rrPath(ctx, X(x1), Y(y1), X(x2) - X(x1), Y(y2) - Y(y1), (rad || 0) * M);
      fs(fill, stroke);
    },
    poly(pts, fill, stroke) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
      ctx.closePath();
      fs(fill, stroke);
    },
    circle(x, y, r, fill, stroke) {
      ctx.beginPath();
      ctx.arc(X(x), Y(y), Math.max(0.1, r * M), 0, TAU);
      fs(fill, stroke);
    },
    ell(x, y, rx, ry, fill, stroke, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(X(x), Y(y), Math.max(0.1, rx * f.w), Math.max(0.1, ry * f.h), rot, 0, TAU);
      fs(fill, stroke);
    },
    line(x1, y1, x2, y2, col, lw) {
      ctx.beginPath();
      ctx.moveTo(X(x1), Y(y1));
      ctx.lineTo(X(x2), Y(y2));
      ctx.strokeStyle = col || OUT;
      ctx.lineWidth = lw || 1;
      ctx.lineCap = 'round';
      ctx.stroke();
    },
    path(fn, fill, stroke) {
      ctx.beginPath();
      fn(P);
      fs(fill, stroke);
    },
    // Thick stroked shape (straps, cables, handles) with dark outline.
    tube(fn, col, width, outline = true) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      fn(P);
      if (outline) {
        ctx.strokeStyle = OUT;
        ctx.lineWidth = width + LW * 1.6;
        ctx.stroke();
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = width;
      ctx.stroke();
    },
    // Cut a transparent hole (offscreen canvas) and outline it.
    hole(fn) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      fn(P);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      fn(P);
      fs(null, Math.max(1, LW * 0.8));
    },
    clip(fn) {
      ctx.save();
      ctx.beginPath();
      fn(P);
      ctx.clip();
    },
    lg(x1, y1, x2, y2, stops) {
      const gr = ctx.createLinearGradient(X(x1), Y(y1), X(x2), Y(y2));
      stops.forEach((s, i) => {
        if (Array.isArray(s)) gr.addColorStop(s[0], s[1]);
        else gr.addColorStop(stops.length > 1 ? i / (stops.length - 1) : 0, s);
      });
      return gr;
    },
    rg(x, y, r0, r1, stops) {
      const gr = ctx.createRadialGradient(X(x), Y(y), Math.max(0, r0 * M), X(x), Y(y), Math.max(0.1, r1 * M));
      stops.forEach((s, i) => {
        if (Array.isArray(s)) gr.addColorStop(s[0], s[1]);
        else gr.addColorStop(stops.length > 1 ? i / (stops.length - 1) : 0, s);
      });
      return gr;
    },
    // Top-lit flat metal/plastic.
    mv(y1, y2, col) {
      return g.lg(0, y1, 0, y2, [[0, shade(col, 0.35)], [0.42, col], [1, shade(col, -0.5)]]);
    },
    // Cylinder shading across y (horizontal cylinders).
    cy(y1, y2, col) { return g.lg(0, y1, 0, y2, cylStops(col)); },
    // Cylinder shading across x (vertical cylinders).
    mh(x1, x2, col) { return g.lg(x1, 0, x2, 0, cylStops(col)); },
    g3(x1, y1, x2, y2, col) {
      return g.lg(x1, y1, x2, y2, [shade(col, 0.3), col, shade(col, -0.45)]);
    },
    rivet(x, y, s = 0.035, col = METAL) {
      ctx.beginPath();
      ctx.arc(X(x), Y(y), Math.max(0.8, s * M), 0, TAU);
      fs(g.rg(x - s * 0.3 * M / f.w, y - s * 0.3 * M / f.h, 0, s * 1.2, [shade(col, 0.5), col, shade(col, -0.5)]), 1);
    },
    text(str, x, y, size, col = '#111', align = 'center', weight = 'bold') {
      if (str == null || str === '') return;
      const px = Math.max(5, size * M);
      ctx.font = `${weight} ${px.toFixed(1)}px "Arial Narrow", Arial, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = col;
      ctx.fillText(String(str), X(x), Y(y));
    },
    dots(x1, y1, x2, y2, nx, ny, col, r = 0.012) {
      ctx.fillStyle = col;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const px = x1 + ((x2 - x1) * (i + 0.5)) / nx;
          const py = y1 + ((y2 - y1) * (j + 0.5)) / ny;
          ctx.beginPath();
          ctx.arc(X(px), Y(py), Math.max(0.6, r * M), 0, TAU);
          ctx.fill();
        }
      }
    },
    star(x, y, R, r, n, fill, stroke, rot = -Math.PI / 2) {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = rot + (i * Math.PI) / n;
        const rr = (i % 2 ? r : R) * M;
        const px = X(x) + Math.cos(a) * rr, py = Y(y) + Math.sin(a) * rr;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      fs(fill, stroke);
    },
    glint(x, y, s = 0.08) {
      g.star(x, y, s, s * 0.22, 4, 'rgba(255,255,255,0.85)', false, 0);
    },
    hl(x1, y1, x2, y2, a = 0.28, lw = 1.2) {
      g.line(x1, y1, x2, y2, `rgba(255,255,255,${a})`, lw);
    },
    dash(arr) { ctx.setLineDash(arr); },
  };
  return g;
}

// Fit a frame of aspect (w/h) clamped to [minA, maxA] centered inside r.
function K(ctx, r, c, minA = 1, maxA = minA) {
  const ra = r.w / r.h;
  const a = Math.min(maxA, Math.max(minA, ra));
  let w = r.w, h = r.h;
  if (ra > a) w = h * a; else h = w / a;
  return makeKit(ctx, { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h }, c);
}

// Long objects: horizontal in wide rects, vertical (rotated) in tall rects,
// diagonal in square-ish rects. Caller's ctx state is restored by renderShape.
function KL(ctx, r, c, aspect) {
  const ra = r.w / r.h;
  if (ra >= 1.6) return K(ctx, r, c, Math.max(1.6, aspect * 0.78), aspect);
  if (ra <= 1 / 1.6) {
    ctx.translate(r.x, r.y + r.h);
    ctx.rotate(-Math.PI / 2);
    return K(ctx, { x: 0, y: 0, w: r.h, h: r.w }, c, Math.max(1.6, aspect * 0.78), aspect);
  }
  const s = Math.min(r.w, r.h);
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.rotate(-Math.PI / 4);
  const L = Math.min(s * 1.3, (1.414 * s) / (1 + 1 / aspect));
  const T = L / aspect;
  return makeKit(ctx, { x: -L / 2, y: -T / 2, w: L, h: T }, c);
}

function blades(g, x, y, rad, n, col, rot = 0) {
  const { ctx } = g;
  const cx = g.X(x), cy = g.Y(y), R = rad * g.M;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot + (i * TAU) / n);
    ctx.beginPath();
    ctx.moveTo(R * 0.25, -R * 0.1);
    ctx.quadraticCurveTo(R * 0.75, -R * 0.5, R * 0.96, -R * 0.08);
    ctx.quadraticCurveTo(R * 0.7, R * 0.12, R * 0.25, R * 0.12);
    ctx.closePath();
    g.fs(col, 1);
    ctx.restore();
  }
}

function gearPath(g, x, y, R, r, n) {
  const { ctx } = g;
  const cx = g.X(x), cy = g.Y(y);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const st = TAU / n;
    const pts = [
      [a0, r], [a0 + st * 0.12, R], [a0 + st * 0.45, R], [a0 + st * 0.57, r],
    ];
    pts.forEach(([a, rr], j) => {
      const px = cx + Math.cos(a) * rr * g.M, py = cy + Math.sin(a) * rr * g.M;
      if (i === 0 && j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
  }
  ctx.closePath();
}

function pips(g, x, y, s, n, col) {
  const L = {
    1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  }[n];
  L.forEach(([dx, dy]) => g.circle(x + dx * s * g.M / g.f.w, y + dy * s * g.M / g.f.h, s * 0.35, col, false));
}

// Gold-bar prism.
function goldBar(g, x, y, w, h, col) {
  g.poly([[x, y + h], [x + w, y + h], [x + w * 0.88, y + h * 0.42], [x + w * 0.12, y + h * 0.42]], g.mv(y + h * 0.42, y + h, col));
  g.poly([[x + w * 0.12, y + h * 0.42], [x + w * 0.88, y + h * 0.42], [x + w * 0.8, y], [x + w * 0.2, y]], g.lg(0, y, 0, y + h * 0.42, [shade(col, 0.55), shade(col, 0.2)]));
  g.line(x + w * 0.3, y + h * 0.7, x + w * 0.7, y + h * 0.7, alpha('#000', 0.3), 1);
  g.hl(x + w * 0.24, y + h * 0.06, x + w * 0.76, y + h * 0.06, 0.55);
}

// Glass vessel with liquid via clip. fn draws the vessel path.
function liquidIn(g, fn, level, col) {
  g.clip(fn);
  g.box(-0.1, level, 1.1, 1.1, 0, g.lg(0, level, 0, 1, [alpha(shade(col, 0.2), 0.85), alpha(shade(col, -0.35), 0.95)]), false);
  g.ell(0.5, level, 0.6, 0.02, alpha(shade(col, 0.45), 0.8), false);
  g.restore();
}

// ---------------------------------------------------------------- drawers
const GUNCOL = (c) => mix(c.base, STEEL, 0.55);

const DRAWERS = {
  // ======================= WEAPONS =======================
  pistol(ctx, r, c) {
    const g = K(ctx, r, c, 1.25, 1.5);
    const st = GUNCOL(c);
    g.poly([[0.12, 0.34], [0.43, 0.34], [0.4, 0.55], [0.34, 0.93], [0.05, 0.93], [0.09, 0.6]], g.g3(0.05, 0.3, 0.43, 0.9, c.base));
    g.dots(0.14, 0.5, 0.33, 0.86, 4, 6, alpha('#000', 0.35), 0.012);
    g.box(0.03, 0.9, 0.36, 0.99, 0.02, g.mv(0.9, 0.99, st));
    g.tube((P) => { P.m(0.42, 0.5); P.q(0.43, 0.7, 0.6, 0.66); P.l(0.66, 0.48); }, c.base, g.M * 0.05);
    g.poly([[0.48, 0.5], [0.52, 0.5], [0.51, 0.62], [0.48, 0.6]], st, 1);
    g.poly([[0.3, 0.33], [0.93, 0.33], [0.93, 0.46], [0.66, 0.48], [0.6, 0.52], [0.4, 0.5]], g.mv(0.33, 0.52, c.base));
    g.rivet(0.72, 0.41, 0.025);
    g.box(0.07, 0.1, 0.96, 0.35, 0.03, g.mv(0.1, 0.35, st));
    for (let i = 0; i < 6; i++) g.line(0.12 + i * 0.028, 0.14, 0.12 + i * 0.028, 0.32, alpha('#000', 0.6), 1);
    g.box(0.5, 0.13, 0.66, 0.21, 0.01, BLACK, 1);
    g.box(0.88, 0.05, 0.92, 0.1, 0, st, 1);
    g.box(0.1, 0.05, 0.16, 0.1, 0, st, 1);
    g.hl(0.1, 0.13, 0.94, 0.13, 0.35);
    g.box(0.95, 0.18, 0.97, 0.28, 0, BLACK, false);
  },

  smg(ctx, r, c) {
    const g = KL(ctx, r, c, 1.9);
    const st = GUNCOL(c);
    g.tube((P) => { P.m(0.28, 0.3); P.l(0.05, 0.3); P.l(0.05, 0.58); P.l(0.3, 0.48); }, st, g.M * 0.04);
    g.box(0.01, 0.24, 0.07, 0.64, 0.02, g.mv(0.24, 0.64, BLACK));
    g.poly([[0.58, 0.5], [0.69, 0.5], [0.72, 0.98], [0.61, 0.98]], g.g3(0.58, 0, 0.72, 0, st));
    for (let i = 0; i < 4; i++) g.line(0.6 + i * 0.002, 0.6 + i * 0.09, 0.7 + i * 0.004, 0.6 + i * 0.09, alpha('#000', 0.45), 1);
    g.poly([[0.36, 0.5], [0.48, 0.5], [0.45, 0.9], [0.32, 0.9]], g.g3(0.32, 0, 0.48, 0, c.base));
    g.tube((P) => { P.m(0.47, 0.52); P.q(0.5, 0.68, 0.58, 0.6); }, c.base, g.M * 0.035);
    g.box(0.76, 0.3, 0.92, 0.44, 0.02, g.cy(0.3, 0.44, st));
    [0.8, 0.84, 0.88].forEach((x) => g.circle(x, 0.37, 0.025, BLACK, false));
    g.box(0.91, 0.33, 0.99, 0.41, 0.01, g.cy(0.33, 0.41, st));
    g.box(0.26, 0.24, 0.77, 0.5, 0.025, g.mv(0.24, 0.5, c.base));
    g.box(0.3, 0.19, 0.72, 0.245, 0.005, BLACK, 1);
    for (let i = 0; i < 9; i++) g.line(0.32 + i * 0.045, 0.2, 0.32 + i * 0.045, 0.235, alpha('#888', 0.5), 1);
    g.poly([[0.32, 0.19], [0.36, 0.19], [0.355, 0.12], [0.325, 0.12]], st, 1);
    g.poly([[0.86, 0.3], [0.89, 0.3], [0.885, 0.2], [0.865, 0.2]], st, 1);
    g.box(0.5, 0.28, 0.6, 0.36, 0.01, BLACK, 1);
    g.box(0.63, 0.29, 0.69, 0.34, 0.01, st, 1);
    g.hl(0.28, 0.27, 0.75, 0.27);
  },

  rifle(ctx, r, c) {
    const g = KL(ctx, r, c, 2.9);
    const st = GUNCOL(c);
    g.box(0.15, 0.33, 0.26, 0.41, 0.01, g.cy(0.33, 0.41, st));
    g.poly([[0.0, 0.27], [0.05, 0.25], [0.18, 0.33], [0.22, 0.33], [0.22, 0.48], [0.16, 0.5], [0.05, 0.66], [0.0, 0.66]], g.g3(0, 0.25, 0, 0.66, c.base));
    g.box(0.0, 0.26, 0.02, 0.66, 0, BLACK, 1);
    g.line(0.06, 0.34, 0.14, 0.38, alpha('#000', 0.4), 1);
    g.path((P) => { P.m(0.37, 0.5); P.l(0.45, 0.5); P.q(0.47, 0.68, 0.51, 0.86); P.l(0.43, 0.9); P.q(0.4, 0.7, 0.37, 0.5); P.z(); }, g.g3(0.37, 0, 0.51, 0, st));
    g.line(0.395, 0.6, 0.46, 0.6, alpha('#000', 0.45), 1);
    g.line(0.405, 0.72, 0.475, 0.72, alpha('#000', 0.45), 1);
    g.poly([[0.27, 0.49], [0.33, 0.5], [0.3, 0.78], [0.23, 0.77]], g.g3(0.23, 0, 0.33, 0, c.base));
    g.tube((P) => { P.m(0.32, 0.53); P.q(0.34, 0.6, 0.37, 0.53); }, c.base, g.M * 0.03);
    g.poly([[0.22, 0.4], [0.47, 0.4], [0.47, 0.52], [0.36, 0.52], [0.3, 0.5], [0.22, 0.48]], g.mv(0.4, 0.52, c.base));
    g.box(0.82, 0.345, 0.95, 0.395, 0.005, g.cy(0.345, 0.395, st));
    g.box(0.94, 0.33, 0.995, 0.41, 0.01, g.cy(0.33, 0.41, BLACK));
    g.line(0.955, 0.345, 0.98, 0.345, alpha('#000', 0.7), 1);
    g.poly([[0.785, 0.25], [0.805, 0.25], [0.8, 0.16], [0.79, 0.16]], st, 1);
    g.box(0.56, 0.29, 0.82, 0.46, 0.015, g.mv(0.29, 0.46, c.base));
    for (let i = 0; i < 5; i++) g.box(0.59 + i * 0.045, 0.35, 0.615 + i * 0.045, 0.41, 0.01, alpha('#000', 0.55), false);
    g.box(0.22, 0.28, 0.57, 0.41, 0.01, g.mv(0.28, 0.41, st));
    g.box(0.26, 0.235, 0.82, 0.285, 0.005, BLACK, 1);
    for (let i = 0; i < 14; i++) g.line(0.28 + i * 0.039, 0.245, 0.28 + i * 0.039, 0.275, alpha('#999', 0.45), 1);
    g.box(0.27, 0.17, 0.31, 0.235, 0.005, st, 1);
    g.box(0.38, 0.31, 0.48, 0.36, 0.005, BLACK, 1);
    g.circle(0.51, 0.35, 0.03, st, 1);
    g.hl(0.23, 0.3, 0.56, 0.3);
  },

  dmr(ctx, r, c) {
    const g = KL(ctx, r, c, 3.3);
    const st = GUNCOL(c);
    g.poly([[0, 0.3], [0.04, 0.28], [0.19, 0.36], [0.23, 0.36], [0.23, 0.5], [0.17, 0.52], [0.04, 0.7], [0, 0.7]], g.g3(0, 0.28, 0, 0.7, c.base));
    g.box(0.05, 0.24, 0.17, 0.31, 0.02, g.mv(0.24, 0.31, shade(c.base, -0.15)));
    g.box(0, 0.29, 0.02, 0.7, 0, BLACK, 1);
    g.box(0.36, 0.48, 0.43, 0.72, 0.01, g.g3(0.36, 0, 0.43, 0, st));
    g.line(0.365, 0.66, 0.425, 0.66, alpha('#000', 0.5), 1);
    g.poly([[0.26, 0.48], [0.32, 0.49], [0.29, 0.75], [0.22, 0.74]], g.g3(0.22, 0, 0.32, 0, c.base));
    g.tube((P) => { P.m(0.31, 0.5); P.q(0.33, 0.58, 0.36, 0.5); }, c.base, g.M * 0.03);
    g.line(0.6, 0.5, 0.75, 0.5, BLACK, g.M * 0.04);
    g.box(0.76, 0.395, 0.97, 0.435, 0, g.cy(0.395, 0.435, st));
    g.box(0.95, 0.375, 1.0, 0.455, 0.01, g.cy(0.375, 0.455, BLACK));
    g.line(0.965, 0.38, 0.965, 0.45, alpha('#777', 0.7), 1);
    g.line(0.98, 0.38, 0.98, 0.45, alpha('#777', 0.7), 1);
    g.box(0.47, 0.355, 0.77, 0.485, 0.012, g.mv(0.355, 0.485, c.base));
    for (let i = 0; i < 6; i++) g.box(0.5 + i * 0.043, 0.4, 0.525 + i * 0.043, 0.44, 0.008, alpha('#000', 0.5), false);
    g.box(0.21, 0.34, 0.48, 0.48, 0.01, g.mv(0.34, 0.48, st));
    g.box(0.33, 0.37, 0.42, 0.41, 0.005, BLACK, 1);
    // scope
    g.box(0.28, 0.27, 0.31, 0.345, 0, st, 1);
    g.box(0.41, 0.27, 0.44, 0.345, 0, st, 1);
    g.box(0.24, 0.2, 0.47, 0.27, 0.01, g.cy(0.2, 0.27, shade(st, -0.1)));
    g.poly([[0.45, 0.2], [0.48, 0.16], [0.53, 0.16], [0.53, 0.31], [0.48, 0.31], [0.45, 0.27]], g.cy(0.16, 0.31, st));
    g.poly([[0.19, 0.18], [0.23, 0.18], [0.25, 0.2], [0.25, 0.27], [0.23, 0.29], [0.19, 0.29]], g.cy(0.18, 0.29, st));
    g.box(0.33, 0.14, 0.37, 0.2, 0.005, st, 1);
    g.ell(0.53, 0.235, 0.006, 0.07, GLASS, false);
    g.hl(0.25, 0.215, 0.46, 0.215, 0.35);
  },

  sniper(ctx, r, c) {
    const g = KL(ctx, r, c, 3.6);
    const st = GUNCOL(c);
    g.poly([[0.5, 0.43], [0.95, 0.445], [0.95, 0.485], [0.5, 0.5]], g.cy(0.43, 0.5, st));
    g.box(0.94, 0.42, 1.0, 0.51, 0.01, g.cy(0.42, 0.51, BLACK));
    g.line(0.96, 0.43, 0.96, 0.5, alpha('#888', 0.7), 1);
    g.line(0.98, 0.43, 0.98, 0.5, alpha('#888', 0.7), 1);
    g.poly([[0, 0.34], [0.05, 0.36], [0.2, 0.44], [0.62, 0.44], [0.63, 0.56], [0.33, 0.58], [0.27, 0.8], [0.19, 0.8], [0.18, 0.62], [0.05, 0.78], [0, 0.78]], g.g3(0, 0.34, 0, 0.8, c.base));
    g.hole((P) => { P.e(0.155, 0.56, 0.035, 0.07); });
    g.box(0, 0.33, 0.02, 0.78, 0, BLACK, 1);
    g.line(0.36, 0.5, 0.6, 0.5, alpha('#fff', 0.12), 1);
    g.box(0.38, 0.56, 0.45, 0.66, 0.01, g.mv(0.56, 0.66, st));
    g.tube((P) => { P.m(0.33, 0.58); P.q(0.35, 0.68, 0.4, 0.6); }, st, g.M * 0.03);
    g.box(0.26, 0.38, 0.5, 0.46, 0.01, g.mv(0.38, 0.46, st));
    g.tube((P) => { P.m(0.3, 0.44); P.l(0.28, 0.56); }, st, g.M * 0.04);
    g.circle(0.28, 0.575, 0.05, g.rg(0.275, 0.565, 0, 0.06, [METAL, STEEL]));
    // scope
    g.box(0.3, 0.29, 0.33, 0.38, 0, st, 1);
    g.box(0.45, 0.29, 0.48, 0.38, 0, st, 1);
    g.box(0.24, 0.2, 0.56, 0.29, 0.01, g.cy(0.2, 0.29, shade(st, -0.1)));
    g.poly([[0.5, 0.2], [0.55, 0.13], [0.62, 0.13], [0.62, 0.36], [0.55, 0.36], [0.5, 0.29]], g.cy(0.13, 0.36, st));
    g.poly([[0.16, 0.16], [0.22, 0.17], [0.25, 0.2], [0.25, 0.29], [0.22, 0.32], [0.16, 0.33]], g.cy(0.16, 0.33, st));
    g.line(0.19, 0.17, 0.19, 0.32, alpha('#000', 0.5), 1);
    g.box(0.36, 0.11, 0.41, 0.2, 0.005, g.mv(0.11, 0.2, st));
    for (let i = 0; i < 3; i++) g.line(0.37 + i * 0.015, 0.12, 0.37 + i * 0.015, 0.19, alpha('#999', 0.4), 1);
    g.circle(0.385, 0.245, 0.06, g.rg(0.38, 0.24, 0, 0.07, [METAL, STEEL]));
    g.ell(0.62, 0.245, 0.007, 0.1, g.lg(0, 0.14, 0, 0.36, ['#9fd0e8', '#24465a']), 1);
    g.hl(0.26, 0.215, 0.55, 0.215, 0.35);
  },

  shotgun(ctx, r, c) {
    const g = KL(ctx, r, c, 3.2);
    const st = GUNCOL(c);
    g.poly([[0, 0.3], [0.04, 0.3], [0.22, 0.38], [0.27, 0.36], [0.27, 0.54], [0.2, 0.56], [0.04, 0.74], [0, 0.74]], g.g3(0, 0.3, 0, 0.74, c.base));
    g.box(0, 0.29, 0.025, 0.74, 0, BLACK, 1);
    g.box(0.46, 0.41, 0.9, 0.48, 0.005, g.cy(0.41, 0.48, shade(st, -0.1)));
    g.box(0.885, 0.405, 0.915, 0.485, 0.005, st, 1);
    g.box(0.46, 0.33, 0.98, 0.4, 0.005, g.cy(0.33, 0.4, st));
    g.circle(0.965, 0.32, 0.03, METAL, 1);
    g.box(0.55, 0.385, 0.76, 0.535, 0.025, g.mv(0.385, 0.535, c.base));
    for (let i = 0; i < 7; i++) g.line(0.575 + i * 0.026, 0.41, 0.575 + i * 0.026, 0.51, alpha('#000', 0.5), 1.2);
    g.tube((P) => { P.m(0.31, 0.54); P.q(0.33, 0.66, 0.4, 0.54); }, st, g.M * 0.035);
    g.box(0.26, 0.32, 0.47, 0.54, 0.02, g.mv(0.32, 0.54, st));
    g.box(0.33, 0.47, 0.44, 0.52, 0.01, BLACK, 1);
    for (let i = 0; i < 4; i++) {
      const x = 0.285 + i * 0.04;
      g.box(x, 0.35, x + 0.028, 0.44, 0.005, g.mh(x, x + 0.028, RED), 1);
      g.box(x, 0.415, x + 0.028, 0.44, 0, BRASS, false);
    }
    g.hl(0.27, 0.335, 0.97, 0.335, 0.3);
  },

  lmg(ctx, r, c) {
    const g = KL(ctx, r, c, 2.8);
    const st = GUNCOL(c);
    g.tube((P) => { P.m(0.82, 0.45); P.l(0.76, 0.96); }, st, g.M * 0.035);
    g.tube((P) => { P.m(0.82, 0.45); P.l(0.89, 0.96); }, st, g.M * 0.035);
    g.box(0.73, 0.95, 0.79, 0.99, 0.01, BLACK, 1);
    g.box(0.86, 0.95, 0.92, 0.99, 0.01, BLACK, 1);
    g.poly([[0, 0.26], [0.05, 0.25], [0.22, 0.3], [0.22, 0.5], [0.05, 0.64], [0, 0.64]], g.g3(0, 0.25, 0, 0.64, c.base));
    g.box(0, 0.25, 0.02, 0.64, 0, BLACK, 1);
    g.poly([[0.25, 0.5], [0.31, 0.5], [0.29, 0.77], [0.22, 0.76]], g.g3(0.22, 0, 0.31, 0, c.base));
    g.box(0.86, 0.34, 0.95, 0.4, 0, g.cy(0.34, 0.4, st));
    g.poly([[0.94, 0.33], [0.995, 0.31], [0.995, 0.43], [0.94, 0.41]], g.cy(0.31, 0.43, BLACK));
    g.box(0.6, 0.29, 0.87, 0.45, 0.01, g.cy(0.29, 0.45, st));
    for (let i = 0; i < 6; i++) {
      g.circle(0.63 + i * 0.042, 0.335, 0.025, BLACK, false);
      g.circle(0.63 + i * 0.042, 0.405, 0.025, BLACK, false);
    }
    g.poly([[0.835, 0.29], [0.855, 0.29], [0.85, 0.2], [0.84, 0.2]], st, 1);
    g.tube((P) => { P.m(0.62, 0.28); P.l(0.64, 0.13); P.l(0.73, 0.13); P.l(0.75, 0.28); }, BLACK, g.M * 0.04);
    g.box(0.21, 0.26, 0.61, 0.52, 0.015, g.mv(0.26, 0.52, st));
    g.box(0.3, 0.2, 0.57, 0.27, 0.01, g.mv(0.2, 0.27, shade(st, 0.1)));
    g.rivet(0.32, 0.235, 0.02); g.rivet(0.55, 0.235, 0.02);
    for (let i = 0; i < 4; i++) g.box(0.29 + i * 0.025, 0.47, 0.305 + i * 0.025, 0.56, 0.003, BRASS, 1);
    g.box(0.36, 0.52, 0.57, 0.84, 0.025, g.mv(0.52, 0.84, c.base));
    g.box(0.4, 0.6, 0.53, 0.72, 0.005, alpha(PAPER, 0.75), 1);
    g.line(0.42, 0.64, 0.51, 0.64, alpha('#000', 0.6), 1);
    g.line(0.42, 0.68, 0.49, 0.68, alpha('#000', 0.6), 1);
    g.tube((P) => { P.m(0.29, 0.53); P.q(0.31, 0.62, 0.35, 0.53); }, st, g.M * 0.03);
    g.hl(0.22, 0.29, 0.6, 0.29);
  },

  grenade(ctx, r, c) {
    const g = K(ctx, r, c, 0.78, 0.9);
    const bodyPath = (P) => { P.e(0.46, 0.62, 0.4, 0.36); };
    g.path(bodyPath, g.rg(0.36, 0.5, 0.02, 0.5, [shade(c.base, 0.4), c.base, shade(c.base, -0.55)]));
    g.clip(bodyPath);
    for (let i = 1; i < 5; i++) g.line(0, 0.26 + i * 0.145, 1, 0.26 + i * 0.145, alpha('#000', 0.55), 1.6);
    for (let i = 1; i < 5; i++) {
      const x = 0.06 + i * 0.16;
      g.path((P) => { P.m(x, 0.2); P.q(x + (x - 0.46) * 0.4, 0.62, x, 1.0); }, null, 1.6);
    }
    g.ell(0.34, 0.48, 0.1, 0.07, alpha('#fff', 0.18), false);
    g.restore();
    g.path(bodyPath, null);
    g.box(0.33, 0.12, 0.59, 0.3, 0.02, g.mh(0.33, 0.59, METAL));
    g.box(0.36, 0.06, 0.56, 0.13, 0.01, g.mh(0.36, 0.56, shade(METAL, -0.2)));
    g.tube((P) => { P.m(0.56, 0.13); P.q(0.84, 0.12, 0.86, 0.36); P.l(0.84, 0.66); }, shade(METAL, 0.05), g.M * 0.07);
    g.line(0.6, 0.15, 0.82, 0.3, HL, 1);
    g.tube((P) => { P.m(0.35, 0.18); P.l(0.22, 0.17); }, METAL, g.M * 0.025);
    g.tube((P) => { P.a(0.14, 0.14, 0.1, 0, TAU); }, shade(METAL, 0.25), g.M * 0.035);
    g.box(0.18, 0.66, 0.74, 0.76, 0.01, alpha(shade(c.base, 0.55), 0.55), false);
  },

  // ======================= AMMO =======================
  ammo_box(ctx, r, c, item) {
    const g = K(ctx, r, c, 1, 1.6);
    const box = mix(CARD, c.base, 0.5);
    g.poly([[0.07, 0.38], [0.93, 0.38], [0.86, 0.2], [0.14, 0.2]], g.mv(0.2, 0.38, shade(box, -0.3)));
    for (let i = 0; i < 5; i++) {
      const x = 0.16 + i * 0.145;
      g.box(x, 0.2, x + 0.1, 0.45, 0.005, g.mh(x, x + 0.1, BRASS), 1);
      g.path((P) => { P.m(x + 0.008, 0.21); P.q(x + 0.05, -0.03, x + 0.092, 0.21); P.z(); }, g.mh(x, x + 0.1, COPPER), 1);
    }
    g.box(0.04, 0.4, 0.96, 0.96, 0.02, g.mv(0.4, 0.96, box));
    g.poly([[0.04, 0.38], [0.96, 0.38], [1.0, 0.47], [0.0, 0.47]], g.mv(0.38, 0.47, shade(box, 0.15)));
    g.box(0.12, 0.54, 0.88, 0.86, 0.01, PAPER, 1);
    g.box(0.12, 0.54, 0.88, 0.6, 0, alpha(RED, 0.85), false);
    g.text(item.short || 'AMMO', 0.5, 0.74, 0.17, '#1c1c1c');
    g.line(0.06, 0.92, 0.94, 0.92, alpha('#000', 0.25), 1);
  },

  shell(ctx, r, c) {
    const g = K(ctx, r, c, 0.95, 1.2);
    const hull = c.base;
    const one = (x, ang, y0) => {
      g.save();
      g.rotAt(x + 0.11, 0.95, ang);
      g.box(x, y0, x + 0.22, 0.8, 0.02, g.mh(x, x + 0.22, hull));
      for (let k = 0; k < 4; k++) g.line(x + 0.03 + k * 0.055, y0 + 0.02, x + 0.11, y0 + 0.07, alpha('#000', 0.5), 1);
      g.box(x - 0.01, 0.74, x + 0.23, 0.95, 0.01, g.mh(x - 0.01, x + 0.23, BRASS));
      g.line(x - 0.01, 0.9, x + 0.23, 0.9, alpha('#000', 0.45), 1);
      g.hl(x + 0.06, y0 + 0.1, x + 0.06, 0.72, 0.35);
      g.restore();
    };
    one(0.14, -0.3, 0.12);
    one(0.64, 0.3, 0.12);
    one(0.39, 0, 0.06);
  },

  cartridge(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.3);
    [0.1, 0.41, 0.72].forEach((x, i) => {
      const y = i === 1 ? -0.02 : 0.04;
      g.path((P) => {
        P.m(x, 0.97); P.l(x, y + 0.46); P.l(x + 0.05, y + 0.38); P.l(x + 0.05, y + 0.3);
        P.l(x + 0.13, y + 0.3); P.l(x + 0.13, y + 0.38); P.l(x + 0.18, y + 0.46); P.l(x + 0.18, 0.97); P.z();
      }, g.mh(x, x + 0.18, BRASS));
      g.path((P) => { P.m(x + 0.05, y + 0.32); P.q(x + 0.06, y + 0.06, x + 0.09, y + 0.04); P.q(x + 0.12, y + 0.06, x + 0.13, y + 0.32); P.z(); }, g.mh(x + 0.05, x + 0.13, COPPER));
      g.line(x, 0.92, x + 0.18, 0.92, alpha('#000', 0.45), 1);
      g.hl(x + 0.045, y + 0.5, x + 0.045, 0.88, 0.45);
    });
  },

  // ======================= MODS =======================
  scope(ctx, r, c) {
    const g = KL(ctx, r, c, 2.6);
    g.box(0.24, 0.8, 0.78, 0.94, 0.01, g.mv(0.8, 0.94, BLACK));
    g.box(0.3, 0.6, 0.4, 0.84, 0.01, g.mv(0.6, 0.84, shade(c.base, -0.2)));
    g.box(0.62, 0.6, 0.72, 0.84, 0.01, g.mv(0.6, 0.84, shade(c.base, -0.2)));
    g.rivet(0.35, 0.74, 0.04); g.rivet(0.67, 0.74, 0.04);
    g.box(0.21, 0.38, 0.79, 0.62, 0.03, g.cy(0.38, 0.62, c.base));
    g.poly([[0.72, 0.38], [0.82, 0.2], [0.98, 0.2], [0.98, 0.8], [0.82, 0.8], [0.72, 0.62]], g.cy(0.2, 0.8, c.base));
    g.poly([[0.02, 0.24], [0.13, 0.24], [0.22, 0.36], [0.22, 0.64], [0.13, 0.76], [0.02, 0.76]], g.cy(0.24, 0.76, c.base));
    g.line(0.06, 0.26, 0.06, 0.74, alpha('#000', 0.5), 1.2);
    g.line(0.09, 0.26, 0.09, 0.74, alpha('#000', 0.5), 1.2);
    g.box(0.44, 0.2, 0.56, 0.39, 0.01, g.mv(0.2, 0.39, c.base));
    g.box(0.43, 0.16, 0.57, 0.24, 0.01, g.mv(0.16, 0.24, shade(c.base, 0.1)));
    g.circle(0.5, 0.5, 0.09, g.rg(0.48, 0.47, 0, 0.1, [c.light, c.dark]));
    g.ell(0.98, 0.5, 0.014, 0.28, g.lg(0, 0.2, 0, 0.8, ['#a8dcf0', '#1f3e52']), 1);
    g.hl(0.23, 0.43, 0.77, 0.43, 0.4);
  },

  reddot(ctx, r, c) {
    const g = K(ctx, r, c, 1.05, 1.4);
    g.box(0.06, 0.78, 0.94, 0.93, 0.02, g.mv(0.78, 0.93, BLACK));
    g.rivet(0.2, 0.855, 0.04); g.rivet(0.8, 0.855, 0.04);
    g.box(0.12, 0.1, 0.88, 0.8, 0.16, g.mv(0.1, 0.8, c.base));
    g.box(0.86, 0.36, 0.96, 0.56, 0.02, g.mv(0.36, 0.56, shade(c.base, -0.2)));
    g.box(0.22, 0.2, 0.78, 0.68, 0.1, g.lg(0.2, 0.2, 0.8, 0.7, ['rgba(120,170,200,0.55)', 'rgba(30,60,80,0.75)', 'rgba(150,90,120,0.55)']));
    g.circle(0.5, 0.44, 0.14, g.rg(0.5, 0.44, 0, 0.14, ['rgba(255,60,40,0.8)', 'rgba(255,40,30,0)']), false);
    g.circle(0.5, 0.44, 0.035, '#ff4a30', false);
    g.line(0.28, 0.28, 0.42, 0.24, HL, 1.4);
    g.hl(0.18, 0.15, 0.82, 0.15, 0.35);
  },

  suppressor(ctx, r, c) {
    const g = KL(ctx, r, c, 4.2);
    g.box(0.0, 0.36, 0.07, 0.64, 0.01, g.cy(0.36, 0.64, METAL));
    for (let i = 0; i < 4; i++) g.line(0.012 + i * 0.016, 0.37, 0.012 + i * 0.016, 0.63, alpha('#000', 0.45), 1);
    g.box(0.05, 0.28, 0.93, 0.72, 0.05, g.cy(0.28, 0.72, c.base));
    g.box(0.9, 0.31, 0.99, 0.69, 0.05, g.cy(0.31, 0.69, shade(c.base, -0.15)));
    [0.16, 0.19, 0.78, 0.81].forEach((x) => g.line(x, 0.3, x, 0.7, alpha('#000', 0.5), 1.2));
    g.box(0.36, 0.42, 0.62, 0.58, 0.005, alpha('#fff', 0.08), false);
    g.line(0.38, 0.5, 0.6, 0.5, alpha('#fff', 0.25), 1);
    g.ell(0.99, 0.5, 0.004, 0.06, BLACK, false);
    g.hl(0.08, 0.36, 0.9, 0.36, 0.4);
  },

  muzzle(ctx, r, c) {
    const g = K(ctx, r, c, 1.4, 2);
    g.box(0.0, 0.38, 0.12, 0.62, 0.01, g.cy(0.38, 0.62, METAL));
    for (let i = 0; i < 4; i++) g.line(0.02 + i * 0.026, 0.39, 0.02 + i * 0.026, 0.61, alpha('#000', 0.45), 1);
    g.box(0.1, 0.26, 0.94, 0.74, 0.04, g.cy(0.26, 0.74, c.base));
    [[0.28, 0.38], [0.48, 0.58], [0.68, 0.78]].forEach(([a, b]) => g.box(a, 0.33, b, 0.67, 0.02, g.lg(0, 0.33, 0, 0.67, [BLACK, '#3a3d40', BLACK]), 1));
    g.box(0.92, 0.3, 0.99, 0.7, 0.03, g.cy(0.3, 0.7, shade(c.base, -0.2)));
    g.hl(0.12, 0.31, 0.92, 0.31, 0.4);
  },

  grip(ctx, r, c) {
    const g = K(ctx, r, c, 0.5, 0.75);
    g.path((P) => { P.m(0.28, 0.2); P.l(0.72, 0.2); P.l(0.68, 0.9); P.q(0.5, 1.0, 0.32, 0.9); P.z(); }, g.mh(0.28, 0.72, c.base));
    for (let i = 0; i < 4; i++) g.line(0.32, 0.36 + i * 0.13, 0.68, 0.36 + i * 0.13, alpha('#000', 0.45), 1.5);
    g.ell(0.5, 0.92, 0.17, 0.035, alpha('#000', 0.35), false);
    g.box(0.06, 0.04, 0.94, 0.22, 0.04, g.mv(0.04, 0.22, BLACK));
    g.box(0.12, 0.06, 0.88, 0.1, 0, alpha('#fff', 0.12), false);
    g.rivet(0.14, 0.15, 0.06); g.rivet(0.86, 0.15, 0.06);
    g.hl(0.4, 0.26, 0.38, 0.86, 0.3, 1.5);
  },

  mag(ctx, r, c) {
    const g = K(ctx, r, c, 0.45, 0.62);
    const body = (P) => { P.m(0.14, 0.06); P.l(0.6, 0.06); P.l(0.62, 0.14); P.q(0.78, 0.55, 0.98, 0.88); P.l(0.58, 0.99); P.q(0.38, 0.62, 0.14, 0.16); P.z(); };
    g.box(0.24, 0.0, 0.5, 0.08, 0.02, g.mh(0.24, 0.5, BRASS), 1);
    g.path(body, g.lg(0.1, 0, 1, 0.3, [shade(c.base, 0.3), c.base, shade(c.base, -0.5)]));
    g.clip(body);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      g.path((P) => { P.m(0.15 + t * 0.4, 0.1 + t * 0.12); P.q(0.38 + t * 0.4, 0.55 + t * 0.05, 0.6 + t * 0.32, 0.98 - t * 0.06); }, null, 1);
    }
    g.restore();
    g.line(0.18, 0.2, 0.62, 0.16, alpha('#000', 0.5), 1.2);
    g.poly([[0.55, 0.92], [0.97, 0.84], [0.99, 0.9], [0.58, 0.99]], g.mv(0.84, 0.99, shade(c.base, -0.2)), 1);
    g.hl(0.2, 0.14, 0.52, 0.8, 0.25, 1.4);
  },

  stock(ctx, r, c) {
    const g = KL(ctx, r, c, 2.2);
    g.box(0.5, 0.3, 1.0, 0.5, 0.01, g.cy(0.3, 0.5, METAL));
    g.path((P) => { P.m(0.86, 0.26); P.l(0.45, 0.18); P.l(0.08, 0.04); P.l(0.04, 0.04); P.l(0.04, 0.96); P.l(0.1, 0.96); P.q(0.3, 0.7, 0.5, 0.64); P.l(0.86, 0.6); P.z(); }, g.mv(0.04, 0.96, c.base));
    g.hole((P) => { P.m(0.2, 0.42); P.l(0.42, 0.36); P.l(0.42, 0.52); P.q(0.3, 0.56, 0.22, 0.66); P.z(); });
    g.box(0.0, 0.03, 0.06, 0.97, 0.02, g.mv(0.03, 0.97, BLACK));
    for (let i = 0; i < 6; i++) g.line(0.015, 0.12 + i * 0.14, 0.045, 0.12 + i * 0.14, alpha('#555', 0.7), 1);
    g.box(0.64, 0.6, 0.72, 0.74, 0.01, BLACK, 1);
    g.rivet(0.78, 0.43, 0.06);
    g.hl(0.1, 0.07, 0.8, 0.27, 0.3);
  },

  laser(ctx, r, c) {
    const g = KL(ctx, r, c, 2.0);
    g.line(0.86, 0.4, 1.0, 0.4, 'rgba(255,40,30,0.85)', g.M * 0.04);
    g.line(0.86, 0.4, 1.0, 0.4, 'rgba(255,200,200,0.9)', g.M * 0.012);
    g.box(0.18, 0.74, 0.62, 0.92, 0.02, g.mv(0.74, 0.92, BLACK));
    g.rivet(0.24, 0.83, 0.05); g.rivet(0.56, 0.83, 0.05);
    g.box(0.04, 0.18, 0.78, 0.76, 0.07, g.mv(0.18, 0.76, c.base));
    g.box(0.76, 0.26, 0.88, 0.7, 0.02, g.mv(0.26, 0.7, shade(c.base, -0.25)));
    g.circle(0.86, 0.4, 0.07, g.rg(0.86, 0.4, 0, 0.08, ['#ffd0c8', '#e0261c', '#5a0c08']), 1);
    g.circle(0.86, 0.58, 0.06, g.rg(0.86, 0.58, 0, 0.07, ['#c8e6ff', '#2a5070']), 1);
    g.box(0.14, 0.08, 0.3, 0.18, 0.02, BLACK, 1);
    g.box(0.38, 0.08, 0.54, 0.18, 0.02, '#7a1a14', 1);
    g.box(0.12, 0.34, 0.6, 0.56, 0.02, alpha('#000', 0.18), false);
    g.dots(0.14, 0.36, 0.58, 0.54, 8, 3, alpha('#fff', 0.15), 0.012);
    g.hl(0.08, 0.24, 0.74, 0.24, 0.35);
  },

  flashlight_mod(ctx, r, c) {
    const g = KL(ctx, r, c, 2.6);
    g.box(0.24, 0.64, 0.5, 0.84, 0.02, g.mv(0.64, 0.84, BLACK));
    g.rivet(0.37, 0.75, 0.06);
    g.box(0.0, 0.36, 0.09, 0.64, 0.03, g.cy(0.36, 0.64, BLACK));
    g.box(0.06, 0.33, 0.66, 0.67, 0.04, g.cy(0.33, 0.67, c.base));
    for (let i = 0; i < 7; i++) g.line(0.14 + i * 0.03, 0.35, 0.14 + i * 0.03, 0.65, alpha('#000', 0.4), 1);
    g.poly([[0.64, 0.33], [0.76, 0.2], [0.96, 0.2], [0.96, 0.8], [0.76, 0.8], [0.64, 0.67]], g.cy(0.2, 0.8, c.base));
    [0.8, 0.85, 0.9].forEach((x) => g.line(x, 0.22, x, 0.78, alpha('#000', 0.4), 1));
    g.ell(0.97, 0.5, 0.02, 0.28, g.rg(0.97, 0.5, 0, 0.3, ['#ffffff', '#fff3c0', '#c8b060']), 1);
    g.hl(0.08, 0.38, 0.95, 0.24, 0.3);
  },

  // ======================= GEAR =======================
  armor(ctx, r, c, item) {
    const g = K(ctx, r, c, 0.85, 1.05);
    g.poly([[0.12, 0.45], [0.0, 0.5], [0.0, 0.84], [0.12, 0.86]], g.mv(0.45, 0.86, shade(c.base, -0.25)));
    g.poly([[0.88, 0.45], [1.0, 0.5], [1.0, 0.84], [0.88, 0.86]], g.mv(0.45, 0.86, shade(c.base, -0.25)));
    g.box(0.01, 0.62, 0.07, 0.7, 0.01, BLACK, 1);
    g.box(0.93, 0.62, 0.99, 0.7, 0.01, BLACK, 1);
    g.box(0.18, 0.0, 0.34, 0.28, 0.04, g.mv(0, 0.28, shade(c.base, -0.1)));
    g.box(0.66, 0.0, 0.82, 0.28, 0.04, g.mv(0, 0.28, shade(c.base, -0.1)));
    g.path((P) => { P.m(0.12, 0.14); P.l(0.36, 0.14); P.q(0.5, 0.32, 0.64, 0.14); P.l(0.88, 0.14); P.l(0.9, 0.88); P.q(0.5, 0.98, 0.1, 0.88); P.z(); }, g.mv(0.14, 0.95, c.base));
    g.box(0.33, 0.27, 0.67, 0.43, 0.02, shade(c.base, -0.2), 1);
    g.dots(0.35, 0.29, 0.65, 0.41, 9, 4, alpha('#000', 0.25), 0.008);
    g.text(item.short || '', 0.5, 0.35, 0.09, alpha(WHITE, 0.7));
    g.dash([g.M * 0.06, g.M * 0.025]);
    for (let i = 0; i < 4; i++) g.line(0.18, 0.52 + i * 0.085, 0.82, 0.52 + i * 0.085, alpha('#000', 0.55), Math.max(1.5, g.M * 0.03));
    g.dash([]);
    g.line(0.24, 0.17, 0.12, 0.17, HL, 1);
    g.hl(0.15, 0.2, 0.15, 0.82, 0.18, 1.5);
  },

  helmet(ctx, r, c) {
    const g = K(ctx, r, c, 1.1, 1.35);
    const shell = (P) => { P.m(0.04, 0.8); P.q(0.0, 0.08, 0.52, 0.06); P.q(0.98, 0.08, 0.97, 0.62); P.l(0.88, 0.64); P.q(0.8, 0.62, 0.76, 0.5); P.l(0.58, 0.5); P.q(0.52, 0.52, 0.52, 0.64); P.l(0.48, 0.8); P.z(); };
    g.tube((P) => { P.m(0.5, 0.72); P.q(0.62, 1.0, 0.8, 0.6); }, BLACK, g.M * 0.04);
    g.path(shell, g.rg(0.4, 0.25, 0.05, 0.7, [shade(c.base, 0.3), c.base, shade(c.base, -0.55)]));
    g.tube((P) => { P.m(0.1, 0.62); P.q(0.3, 0.42, 0.72, 0.44); }, shade(c.base, -0.45), g.M * 0.06);
    for (let i = 0; i < 4; i++) g.circle(0.2 + i * 0.13, 0.5 - i * 0.012, 0.012, alpha('#999', 0.6), false);
    g.box(0.3, 0.16, 0.56, 0.3, 0.03, shade(c.base, -0.25), 1);
    g.dots(0.31, 0.17, 0.55, 0.29, 7, 3, alpha('#000', 0.25), 0.008);
    g.box(0.78, 0.2, 0.9, 0.34, 0.02, g.mv(0.2, 0.34, BLACK));
    g.rivet(0.81, 0.27, 0.02); g.rivet(0.87, 0.27, 0.02);
    g.path((P) => { P.m(0.14, 0.4); P.q(0.24, 0.14, 0.52, 0.12); }, null, false);
    g.tube((P) => { P.m(0.16, 0.36); P.q(0.26, 0.16, 0.5, 0.13); }, alpha('#fff', 0.2), g.M * 0.03, false);
  },

  rig(ctx, r, c) {
    const g = K(ctx, r, c, 1.1, 1.4);
    g.tube((P) => { P.m(0.22, 0.45); P.l(0.34, 0.0); }, shade(c.base, -0.2), g.M * 0.09);
    g.tube((P) => { P.m(0.78, 0.45); P.l(0.66, 0.0); }, shade(c.base, -0.2), g.M * 0.09);
    g.box(0.0, 0.58, 0.08, 0.7, 0.01, BLACK, 1);
    g.box(0.92, 0.58, 1.0, 0.7, 0.01, BLACK, 1);
    g.box(0.04, 0.4, 0.96, 0.94, 0.05, g.mv(0.4, 0.94, c.base));
    for (let i = 0; i < 4; i++) {
      const x = 0.08 + i * 0.215;
      const pc = shade(c.base, 0.06);
      g.box(x + 0.03, 0.24, x + 0.16, 0.34, 0.01, g.mv(0.24, 0.34, STEEL), 1);
      g.box(x, 0.3, x + 0.19, 0.74, 0.03, g.mv(0.3, 0.74, pc));
      g.box(x, 0.3, x + 0.19, 0.42, 0.03, g.mv(0.3, 0.42, shade(pc, -0.15)));
      g.box(x + 0.07, 0.38, x + 0.12, 0.46, 0.01, BLACK, 1);
    }
    g.dash([g.M * 0.05, g.M * 0.025]);
    [0.8, 0.88].forEach((y) => g.line(0.1, y, 0.9, y, alpha('#000', 0.5), Math.max(1.4, g.M * 0.025)));
    g.dash([]);
    g.hl(0.06, 0.43, 0.94, 0.43, 0.2);
  },

  backpack(ctx, r, c) {
    const g = K(ctx, r, c, 0.75, 0.9);
    g.tube((P) => { P.m(0.38, 0.1); P.q(0.5, -0.06, 0.62, 0.1); }, BLACK, g.M * 0.05);
    g.box(0.0, 0.3, 0.1, 0.92, 0.04, shade(c.base, -0.35), 1);
    g.box(0.9, 0.3, 1.0, 0.92, 0.04, shade(c.base, -0.35), 1);
    g.box(0.08, 0.08, 0.92, 0.98, 0.14, g.lg(0.08, 0, 0.92, 0, [shade(c.base, 0.15), c.base, shade(c.base, -0.4)]));
    g.path((P) => { P.m(0.08, 0.32); P.q(0.1, 0.06, 0.5, 0.06); P.q(0.9, 0.06, 0.92, 0.32); P.l(0.92, 0.38); P.q(0.5, 0.44, 0.08, 0.38); P.z(); }, g.mv(0.06, 0.44, shade(c.base, -0.12)));
    [0.3, 0.64].forEach((x) => {
      g.box(x, 0.36, x + 0.06, 0.6, 0.01, shade(c.base, -0.45), 1);
      g.box(x - 0.01, 0.54, x + 0.07, 0.62, 0.01, BLACK, 1);
    });
    g.box(0.18, 0.6, 0.82, 0.93, 0.08, g.mv(0.6, 0.93, shade(c.base, 0.08)));
    g.dash([2, 2]);
    g.line(0.22, 0.66, 0.78, 0.66, alpha('#000', 0.6), 1.4);
    g.dash([]);
    g.box(0.72, 0.64, 0.76, 0.7, 0.005, METAL, 1);
    for (let i = 0; i < 2; i++) g.line(0.24, 0.76 + i * 0.07, 0.76, 0.76 + i * 0.07, alpha('#000', 0.35), 1.6);
    g.hl(0.14, 0.4, 0.14, 0.9, 0.18, 1.6);
  },

  case(ctx, r, c, item) {
    const g = K(ctx, r, c, 1.0, 1.4);
    g.tube((P) => { P.m(0.36, 0.16); P.l(0.36, 0.04); P.l(0.64, 0.04); P.l(0.64, 0.16); }, BLACK, g.M * 0.06);
    g.box(0.04, 0.13, 0.96, 0.96, 0.08, g.mv(0.13, 0.96, c.base));
    g.line(0.05, 0.36, 0.95, 0.36, alpha('#000', 0.7), 1.6);
    g.line(0.05, 0.38, 0.95, 0.38, alpha('#fff', 0.15), 1);
    for (let i = 0; i < 4; i++) {
      g.line(0.1, 0.48 + i * 0.12, 0.9, 0.48 + i * 0.12, alpha('#000', 0.4), 1.5);
      g.line(0.1, 0.495 + i * 0.12, 0.9, 0.495 + i * 0.12, alpha('#fff', 0.1), 1);
    }
    [0.18, 0.72].forEach((x) => {
      g.box(x, 0.27, x + 0.1, 0.47, 0.02, g.mv(0.27, 0.47, shade(METAL, -0.1)));
      g.line(x + 0.02, 0.33, x + 0.08, 0.33, alpha('#000', 0.5), 1);
    });
    g.box(0.43, 0.29, 0.57, 0.45, 0.02, g.mv(0.29, 0.45, BRASS));
    g.circle(0.5, 0.35, 0.025, BLACK, false);
    g.box(0.49, 0.36, 0.51, 0.41, 0, BLACK, false);
    g.box(0.3, 0.6, 0.7, 0.78, 0.01, PAPER, 1);
    g.box(0.3, 0.6, 0.36, 0.78, 0, '#c8a020', false);
    g.text(item.short || 'CASE', 0.53, 0.69, 0.1, '#222');
    [[0.1, 0.2], [0.9, 0.2], [0.1, 0.9], [0.9, 0.9]].forEach(([x, y]) => g.rivet(x, y, 0.025));
  },

  headset(ctx, r, c) {
    const g = K(ctx, r, c, 1.05, 1.3);
    g.tube((P) => { P.m(0.17, 0.5); P.q(0.17, -0.02, 0.5, 0.04); P.q(0.83, -0.02, 0.83, 0.5); }, BLACK, g.M * 0.08);
    g.tube((P) => { P.m(0.2, 0.42); P.q(0.2, 0.06, 0.5, 0.08); }, alpha('#fff', 0.15), g.M * 0.02, false);
    g.tube((P) => { P.m(0.24, 0.8); P.q(0.32, 0.98, 0.56, 0.9); }, BLACK, g.M * 0.035);
    g.ell(0.59, 0.9, 0.05, 0.05, BLACK);
    [0.16, 0.84].forEach((x) => {
      g.ell(x, 0.62, 0.15, 0.25, g.rg(x - 0.04, 0.54, 0.02, 0.3, [shade(c.base, 0.3), c.base, shade(c.base, -0.5)]));
      g.ell(x, 0.62, 0.09, 0.16, alpha('#000', 0.18), 1);
    });
    g.circle(0.84, 0.48, 0.04, g.rg(0.84, 0.48, 0, 0.05, [METAL, BLACK]));
    g.box(0.12, 0.38, 0.2, 0.44, 0.01, BLACK, 1);
  },

  mask(ctx, r, c) {
    const g = K(ctx, r, c, 0.85, 1.0);
    g.tube((P) => { P.m(0.12, 0.3); P.l(0.0, 0.14); }, BLACK, g.M * 0.05);
    g.tube((P) => { P.m(0.88, 0.3); P.l(1.0, 0.14); }, BLACK, g.M * 0.05);
    g.tube((P) => { P.m(0.1, 0.62); P.l(0.0, 0.7); }, BLACK, g.M * 0.05);
    g.tube((P) => { P.m(0.9, 0.62); P.l(1.0, 0.7); }, BLACK, g.M * 0.05);
    g.path((P) => { P.m(0.5, 0.04); P.q(0.92, 0.06, 0.9, 0.5); P.q(0.86, 0.86, 0.5, 0.96); P.q(0.14, 0.86, 0.1, 0.5); P.q(0.08, 0.06, 0.5, 0.04); P.z(); }, g.rg(0.4, 0.32, 0.05, 0.6, [shade(c.base, 0.25), c.base, shade(c.base, -0.6)]));
    [0.3, 0.7].forEach((x) => {
      g.circle(x, 0.38, 0.16, g.rg(x, 0.38, 0.1, 0.17, [STEEL, METAL, STEEL]));
      g.circle(x, 0.38, 0.12, g.lg(x - 0.1, 0.28, x + 0.1, 0.5, ['#6a8a96', '#1d2a30', '#3a5560']));
      g.line(x - 0.06, 0.32, x - 0.01, 0.29, HL, 1.5);
    });
    g.circle(0.5, 0.76, 0.16, g.rg(0.47, 0.72, 0, 0.18, [shade(METAL, 0.2), shade(METAL, -0.35)]));
    g.circle(0.5, 0.76, 0.1, shade(METAL, -0.3), 1);
    g.dots(0.43, 0.7, 0.57, 0.82, 3, 3, BLACK, 0.015);
  },

  // ======================= MEDS =======================
  medkit(ctx, r, c) {
    const g = K(ctx, r, c, 1.1, 1.4);
    const crossCol = lum(c.base) > 0.5 ? RED : WHITE;
    g.tube((P) => { P.m(0.38, 0.2); P.l(0.38, 0.07); P.l(0.62, 0.07); P.l(0.62, 0.2); }, BLACK, g.M * 0.06);
    g.box(0.04, 0.18, 0.96, 0.95, 0.08, g.mv(0.18, 0.95, c.base));
    g.line(0.05, 0.34, 0.95, 0.34, alpha('#000', 0.5), 1.4);
    g.box(0.44, 0.29, 0.56, 0.38, 0.01, g.mv(0.29, 0.38, METAL));
    const cx = 0.5, cy = 0.64, a = 0.07, b = 0.2, ay = a * 1.25, by = b * 0.8;
    g.poly([[cx - a, cy - by], [cx + a, cy - by], [cx + a, cy - ay], [cx + b, cy - ay], [cx + b, cy + ay], [cx + a, cy + ay], [cx + a, cy + by], [cx - a, cy + by], [cx - a, cy + ay], [cx - b, cy + ay], [cx - b, cy - ay], [cx - a, cy - ay]], g.mv(cy - by, cy + by, crossCol));
    [[0.1, 0.24], [0.9, 0.24], [0.1, 0.89], [0.9, 0.89]].forEach(([x, y]) => g.rivet(x, y, 0.025));
    g.hl(0.08, 0.22, 0.92, 0.22, 0.35);
  },

  bandage(ctx, r, c) {
    const g = K(ctx, r, c, 1.1, 1.4);
    const w = mix(WHITE, c.base, 0.2);
    g.poly([[0.22, 0.78], [0.56, 0.8], [0.46, 0.98], [0.02, 0.96]], g.lg(0, 0.78, 0, 0.98, [shade(w, -0.05), shade(w, -0.3)]));
    for (let i = 0; i < 4; i++) g.line(0.08 + i * 0.1, 0.96, 0.24 + i * 0.08, 0.79, alpha('#000', 0.12), 1);
    g.ell(0.2, 0.5, 0.1, 0.32, shade(w, -0.2));
    g.box(0.2, 0.18, 0.76, 0.82, 0, g.cy(0.18, 0.82, w), false);
    g.line(0.2, 0.18, 0.76, 0.18, OUT, g.LW);
    g.line(0.2, 0.82, 0.76, 0.82, OUT, g.LW);
    for (let i = 0; i < 6; i++) g.line(0.24 + i * 0.09, 0.2, 0.24 + i * 0.09, 0.8, alpha('#000', 0.08), 1);
    g.box(0.4, 0.18, 0.5, 0.82, 0, alpha(c.accent, 0.55), false);
    g.ell(0.76, 0.5, 0.12, 0.32, g.rg(0.74, 0.46, 0, 0.35, [WHITE, shade(w, -0.1)]));
    [0.24, 0.18, 0.12].forEach((s, i) => g.ell(0.76, 0.5, 0.12 * (s / 0.32) * 1.2, s, null, i === 2 ? 1.2 : 0.8));
    g.ell(0.76, 0.5, 0.035, 0.09, CARD, 1);
  },

  syringe(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.3);
    g.save();
    g.rotAt(0.5, 0.5, -Math.PI / 4);
    g.box(0.0, 0.36, 0.04, 0.64, 0.01, g.mv(0.36, 0.64, WHITE));
    g.box(0.03, 0.47, 0.42, 0.53, 0, g.cy(0.47, 0.53, shade(WHITE, -0.15)));
    g.box(0.18, 0.31, 0.22, 0.69, 0.01, g.mv(0.31, 0.69, WHITE));
    g.box(0.22, 0.4, 0.74, 0.6, 0.02, GLASS);
    g.box(0.42, 0.415, 0.735, 0.585, 0.01, g.cy(0.415, 0.585, alpha(c.accent, 0.9)), false);
    g.box(0.4, 0.405, 0.43, 0.595, 0, BLACK, false);
    for (let i = 0; i < 6; i++) g.line(0.3 + i * 0.07, 0.4, 0.3 + i * 0.07, i % 2 ? 0.45 : 0.48, alpha('#000', 0.6), 1);
    g.hl(0.24, 0.43, 0.72, 0.43, 0.6);
    g.poly([[0.74, 0.44], [0.81, 0.47], [0.81, 0.53], [0.74, 0.56]], g.cy(0.44, 0.56, '#b8c2c8'));
    g.line(0.81, 0.5, 1.0, 0.5, OUT, Math.max(2, g.M * 0.03));
    g.line(0.81, 0.5, 1.0, 0.5, '#d8dee2', Math.max(1, g.M * 0.012));
    g.restore();
  },

  pills(ctx, r, c) {
    const g = K(ctx, r, c, 0.8, 1.0);
    const bc = c.base;
    g.box(0.16, 0.22, 0.72, 0.96, 0.06, g.mh(0.16, 0.72, alpha(bc, 0.92)));
    g.box(0.16, 0.44, 0.72, 0.78, 0, PAPER, 1);
    g.box(0.22, 0.5, 0.34, 0.6, 0, RED, false);
    g.box(0.26, 0.47, 0.3, 0.63, 0, RED, false);
    [0.52, 0.58, 0.64, 0.7].forEach((y, i) => g.line(0.4, y, i % 2 ? 0.6 : 0.66, y, alpha('#000', 0.5), 1));
    g.box(0.12, 0.05, 0.76, 0.24, 0.03, g.mh(0.12, 0.76, WHITE));
    for (let i = 0; i < 8; i++) g.line(0.17 + i * 0.075, 0.07, 0.17 + i * 0.075, 0.22, alpha('#000', 0.25), 1);
    g.hl(0.24, 0.28, 0.24, 0.92, 0.35, 1.6);
    g.save(); g.rotAt(0.86, 0.86, -0.6);
    g.box(0.74, 0.82, 0.98, 0.9, 0.04, null);
    g.box(0.74, 0.82, 0.86, 0.9, 0.04, g.cy(0.82, 0.9, c.accent), false);
    g.box(0.86, 0.82, 0.98, 0.9, 0.04, g.cy(0.82, 0.9, WHITE), false);
    g.box(0.74, 0.82, 0.98, 0.9, 0.04, null);
    g.restore();
    g.ell(0.86, 0.66, 0.08, 0.06, g.rg(0.85, 0.65, 0, 0.08, [WHITE, shade(WHITE, -0.3)]));
    g.line(0.82, 0.66, 0.9, 0.66, alpha('#000', 0.3), 1);
  },

  splint(ctx, r, c) {
    const g = KL(ctx, r, c, 2.4);
    const wd = mix(WOOD, c.base, 0.35);
    g.box(0.02, 0.16, 0.98, 0.42, 0.04, g.mv(0.16, 0.42, shade(wd, 0.2)));
    g.box(0.02, 0.58, 0.98, 0.84, 0.04, g.mv(0.58, 0.84, wd));
    [0.08, 0.3, 0.62].forEach((x) => g.line(x, 0.25, x + 0.2, 0.25, alpha('#000', 0.25), 1));
    [0.18, 0.5, 0.82].forEach((x) => {
      g.box(x - 0.07, 0.06, x + 0.07, 0.94, 0.02, g.mh(x - 0.07, x + 0.07, WHITE));
      for (let i = 0; i < 4; i++) g.line(x - 0.07, 0.18 + i * 0.2, x + 0.07, 0.28 + i * 0.2, alpha('#000', 0.2), 1);
    });
  },

  tourniquet(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.15);
    g.tube((P) => { P.e(0.44, 0.56, 0.34, 0.36); }, c.base, g.M * 0.14);
    g.tube((P) => { P.e(0.44, 0.56, 0.34, 0.36, 0, Math.PI * 1.1, Math.PI * 1.6); }, alpha('#fff', 0.15), g.M * 0.04, false);
    g.box(0.06, 0.6, 0.22, 0.86, 0.02, g.mv(0.6, 0.86, METAL));
    g.box(0.1, 0.66, 0.18, 0.8, 0.01, BLACK, false);
    g.save(); g.rotAt(0.62, 0.3, -0.55);
    g.box(0.3, 0.25, 0.94, 0.35, 0.03, g.cy(0.25, 0.35, BLACK));
    g.box(0.84, 0.25, 0.94, 0.35, 0.03, RED, 1);
    g.restore();
    g.poly([[0.72, 0.1], [0.92, 0.12], [0.84, 0.3]], g.mv(0.1, 0.3, BLACK));
    g.box(0.52, 0.74, 0.82, 0.86, 0.01, WHITE, 1);
    g.text('TIME', 0.67, 0.8, 0.08, '#222');
  },

  ointment(ctx, r, c) {
    const g = KL(ctx, r, c, 2.6);
    g.path((P) => { P.m(0.06, 0.16); P.l(0.7, 0.25); P.q(0.79, 0.28, 0.81, 0.4); P.l(0.81, 0.6); P.q(0.79, 0.72, 0.7, 0.75); P.l(0.06, 0.84); P.z(); }, g.cy(0.16, 0.84, c.base));
    g.box(0.0, 0.14, 0.08, 0.86, 0.01, g.mv(0.14, 0.86, shade(c.base, -0.1)));
    for (let i = 0; i < 4; i++) g.line(0.015 + i * 0.018, 0.16, 0.015 + i * 0.018, 0.84, alpha('#000', 0.4), 1);
    g.box(0.28, 0.32, 0.6, 0.68, 0.01, alpha(WHITE, 0.85), 1);
    g.box(0.4, 0.42, 0.48, 0.58, 0, RED, false);
    g.box(0.36, 0.46, 0.52, 0.54, 0, RED, false);
    g.poly([[0.81, 0.36], [0.93, 0.38], [0.99, 0.46], [0.99, 0.54], [0.93, 0.62], [0.81, 0.64]], g.cy(0.36, 0.64, WHITE));
    for (let i = 0; i < 3; i++) g.line(0.84 + i * 0.03, 0.39, 0.84 + i * 0.03, 0.61, alpha('#000', 0.3), 1);
    g.hl(0.1, 0.28, 0.68, 0.33, 0.35);
  },

  surgical(ctx, r, c) {
    const g = K(ctx, r, c, 1.3, 1.8);
    g.poly([[0.03, 0.27], [0.97, 0.27], [0.88, 0.04], [0.12, 0.04]], g.mv(0.04, 0.27, shade(c.base, 0.12)));
    g.box(0.44, 0.09, 0.56, 0.23, 0, RED, false);
    g.box(0.39, 0.13, 0.61, 0.19, 0, RED, false);
    g.box(0.02, 0.26, 0.98, 0.96, 0.06, g.mv(0.26, 0.96, c.base));
    g.box(0.07, 0.31, 0.93, 0.9, 0.04, g.mv(0.31, 0.9, shade(c.base, -0.45)));
    g.line(0.14, 0.82, 0.42, 0.42, '#ccd4d8', g.M * 0.05);
    g.poly([[0.4, 0.45], [0.46, 0.36], [0.44, 0.46]], '#e8eef0', 1);
    g.line(0.14, 0.82, 0.3, 0.6, BLACK, g.M * 0.06);
    g.line(0.5, 0.84, 0.56, 0.38, '#c0c8cc', g.M * 0.03);
    g.line(0.54, 0.84, 0.58, 0.38, '#a8b0b4', g.M * 0.03);
    g.tube((P) => { P.a(0.72, 0.74, 0.06, 0, TAU); }, '#b8c0c4', g.M * 0.02);
    g.tube((P) => { P.a(0.8, 0.74, 0.06, 0, TAU); }, '#b8c0c4', g.M * 0.02);
    g.line(0.73, 0.68, 0.86, 0.36, '#d0d8dc', g.M * 0.03);
    g.line(0.79, 0.68, 0.72, 0.36, '#d0d8dc', g.M * 0.03);
    g.box(0.07, 0.55, 0.93, 0.63, 0, alpha(shade(c.base, -0.2), 0.9), 1);
  },

  // ======================= FOOD =======================
  can(ctx, r, c, item) {
    const g = K(ctx, r, c, 0.7, 0.9);
    g.ell(0.5, 0.9, 0.38, 0.06, shade(METAL, -0.4));
    g.box(0.12, 0.12, 0.88, 0.9, 0, g.mh(0.12, 0.88, METAL), false);
    g.box(0.12, 0.28, 0.88, 0.76, 0, g.mh(0.12, 0.88, c.base), false);
    g.line(0.12, 0.12, 0.12, 0.9, OUT, g.LW);
    g.line(0.88, 0.12, 0.88, 0.9, OUT, g.LW);
    [0.2, 0.24, 0.82].forEach((y) => g.line(0.12, y, 0.88, y, alpha('#000', 0.3), 1));
    g.box(0.12, 0.36, 0.88, 0.42, 0, alpha(c.accent, 0.85), false);
    g.text(item.short || '', 0.5, 0.56, 0.16, alpha(WHITE, 0.9));
    g.ell(0.5, 0.12, 0.38, 0.07, g.lg(0.12, 0, 0.88, 0, [shade(METAL, 0.4), METAL, shade(METAL, -0.3)]));
    g.ell(0.5, 0.12, 0.31, 0.05, null, 1);
    g.ell(0.62, 0.11, 0.08, 0.02, alpha('#000', 0.3), false);
  },

  bottle(ctx, r, c) {
    const g = K(ctx, r, c, 0.32, 0.45);
    const body = (P) => { P.m(0.38, 0.02); P.l(0.62, 0.02); P.l(0.62, 0.28); P.q(0.9, 0.36, 0.9, 0.5); P.l(0.9, 0.95); P.q(0.9, 1, 0.82, 1); P.l(0.18, 1); P.q(0.1, 1, 0.1, 0.95); P.l(0.1, 0.5); P.q(0.1, 0.36, 0.38, 0.28); P.z(); };
    g.path(body, g.mh(0.1, 0.9, c.base));
    g.box(0.36, 0.0, 0.64, 0.14, 0.02, g.mh(0.36, 0.64, GOLD));
    g.box(0.1, 0.56, 0.9, 0.82, 0, g.mh(0.1, 0.9, PAPER), 1);
    g.box(0.1, 0.6, 0.9, 0.64, 0, alpha(RED, 0.8), false);
    g.line(0.25, 0.72, 0.75, 0.72, alpha('#000', 0.45), 1);
    g.hl(0.24, 0.42, 0.24, 0.54, 0.5, 2);
    g.hl(0.24, 0.85, 0.24, 0.95, 0.4, 2);
  },

  bar(ctx, r, c, item) {
    const g = K(ctx, r, c, 1.6, 2.4);
    g.save(); g.rotAt(0.5, 0.5, -0.18);
    g.poly([[0.0, 0.2], [0.03, 0.26], [0.0, 0.34], [0.03, 0.42], [0.0, 0.5], [0.03, 0.58], [0.0, 0.66], [0.03, 0.74], [0.0, 0.8], [0.1, 0.8], [0.1, 0.2]], g.mv(0.2, 0.8, shade(c.base, -0.1)));
    g.poly([[1.0, 0.2], [0.97, 0.26], [1.0, 0.34], [0.97, 0.42], [1.0, 0.5], [0.97, 0.58], [1.0, 0.66], [0.97, 0.74], [1.0, 0.8], [0.9, 0.8], [0.9, 0.2]], g.mv(0.2, 0.8, shade(c.base, -0.1)));
    g.box(0.09, 0.22, 0.91, 0.78, 0.04, g.cy(0.22, 0.78, c.base));
    g.poly([[0.3, 0.22], [0.5, 0.22], [0.4, 0.78], [0.2, 0.78]], alpha(c.accent, 0.8), false);
    g.text(item.short || 'BAR', 0.64, 0.5, 0.3, alpha(WHITE, 0.92));
    g.hl(0.12, 0.3, 0.88, 0.3, 0.4);
    g.restore();
  },

  pack(ctx, r, c, item) {
    const g = K(ctx, r, c, 0.75, 0.9);
    g.path((P) => { P.m(0.1, 0.1); P.l(0.9, 0.1); P.q(0.98, 0.5, 0.9, 0.9); P.l(0.1, 0.9); P.q(0.02, 0.5, 0.1, 0.1); P.z(); }, g.rg(0.4, 0.4, 0.05, 0.6, [shade(c.base, 0.35), c.base, shade(c.base, -0.5)]));
    [[0.02, 0.12], [0.88, 0.98]].forEach(([a, b]) => {
      g.box(0.08, a, 0.92, b, 0.01, g.mv(a, b, shade(c.base, -0.15)));
      for (let i = 0; i < 12; i++) g.line(0.1 + i * 0.07, a + 0.01, 0.1 + i * 0.07, b - 0.01, alpha('#000', 0.3), 1);
    });
    g.ell(0.5, 0.42, 0.3, 0.17, alpha(c.accent, 0.9), 1);
    g.text(item.short || 'SNACK', 0.5, 0.42, 0.13, WHITE);
    g.ell(0.4, 0.72, 0.12, 0.07, '#e0b84a', 1, -0.3);
    g.ell(0.6, 0.74, 0.12, 0.07, '#d4a83a', 1, 0.4);
    g.hl(0.2, 0.2, 0.16, 0.8, 0.3, 2);
  },

  water(ctx, r, c) {
    const g = K(ctx, r, c, 0.35, 0.45);
    const body = (P) => { P.m(0.38, 0.16); P.q(0.12, 0.22, 0.12, 0.38); P.l(0.12, 0.95); P.q(0.12, 1, 0.2, 1); P.l(0.8, 1); P.q(0.88, 1, 0.88, 0.95); P.l(0.88, 0.38); P.q(0.88, 0.22, 0.62, 0.16); P.z(); };
    g.path(body, g.mh(0.12, 0.88, alpha('#b8dcf0', 0.45)), false);
    liquidIn(g, body, 0.3, mix('#3a86c0', c.base, 0.3));
    g.path(body, null);
    [0.36, 0.42, 0.8, 0.88].forEach((y) => g.line(0.13, y, 0.87, y, alpha('#fff', 0.3), 1));
    g.box(0.12, 0.5, 0.88, 0.7, 0, g.mh(0.12, 0.88, mix('#2a5e9a', c.base, 0.3)), 1);
    g.path((P) => { P.m(0.14, 0.62); P.q(0.3, 0.54, 0.5, 0.62); P.q(0.7, 0.7, 0.86, 0.6); }, null, false);
    g.line(0.14, 0.6, 0.86, 0.6, alpha('#fff', 0.5), 1);
    g.box(0.38, 0.1, 0.62, 0.17, 0, alpha('#cfe8f5', 0.6), 1);
    g.box(0.34, 0.0, 0.66, 0.1, 0.02, g.mh(0.34, 0.66, '#2a5ea8'));
    g.hl(0.25, 0.4, 0.25, 0.92, 0.5, 2);
  },

  mre(ctx, r, c) {
    const g = K(ctx, r, c, 0.65, 0.85);
    const tan = mix('#9a8058', c.base, 0.4);
    g.box(0.06, 0.04, 0.94, 0.98, 0.04, g.mv(0.04, 0.98, tan));
    g.box(0.06, 0.04, 0.94, 0.15, 0.02, g.mv(0.04, 0.15, shade(tan, -0.15)));
    g.poly([[0.06, 0.15], [0.12, 0.12], [0.06, 0.09]], alpha('#000', 0.4), false);
    g.poly([[0.94, 0.15], [0.88, 0.12], [0.94, 0.09]], alpha('#000', 0.4), false);
    g.text('MRE', 0.5, 0.42, 0.3, alpha('#2a2015', 0.85));
    g.line(0.18, 0.6, 0.82, 0.6, alpha('#2a2015', 0.6), 1.3);
    g.line(0.24, 0.67, 0.76, 0.67, alpha('#2a2015', 0.5), 1);
    g.text('MENU 12', 0.5, 0.8, 0.1, alpha('#2a2015', 0.75));
    g.line(0.09, 0.2, 0.09, 0.94, alpha('#fff', 0.15), 1);
    g.line(0.91, 0.2, 0.91, 0.94, alpha('#000', 0.25), 1);
  },

  jar_food(ctx, r, c) {
    const g = K(ctx, r, c, 0.75, 0.95);
    const body = (P) => { const s = g.M * 0.12; const x = g.X(0.1), y = g.Y(0.16), w = g.W(0.8), h = g.H(0.82); rrPath(ctx, x, y, w, h, s); };
    g.path(body, g.mh(0.1, 0.9, alpha('#c8e4ee', 0.35)), false);
    g.clip(body);
    g.box(0, 0.32, 1, 1, 0, g.mv(0.32, 1, c.base), false);
    [[0.25, 0.42], [0.55, 0.38], [0.78, 0.5], [0.35, 0.85], [0.7, 0.9], [0.2, 0.62]].forEach(([x, y], i) => g.ell(x, y, 0.1, 0.06, i % 2 ? shade(c.base, 0.25) : shade(c.base, -0.25), false, i));
    g.restore();
    g.path(body, null);
    g.box(0.14, 0.5, 0.86, 0.78, 0.01, PAPER, 1);
    g.line(0.24, 0.6, 0.76, 0.6, alpha(RED, 0.8), 2);
    g.line(0.28, 0.68, 0.72, 0.68, alpha('#000', 0.45), 1);
    g.box(0.16, 0.03, 0.84, 0.18, 0.03, g.mv(0.03, 0.18, shade(GOLD, -0.1)));
    for (let i = 0; i < 9; i++) g.line(0.2 + i * 0.075, 0.05, 0.2 + i * 0.075, 0.16, alpha('#000', 0.3), 1);
    g.hl(0.18, 0.24, 0.18, 0.46, 0.55, 2);
  },

  energy_drink(ctx, r, c) {
    const g = K(ctx, r, c, 0.4, 0.55);
    g.ell(0.5, 0.94, 0.38, 0.04, shade(METAL, -0.4));
    g.box(0.12, 0.07, 0.88, 0.94, 0, g.mh(0.12, 0.88, c.base), false);
    g.line(0.12, 0.07, 0.12, 0.94, OUT, g.LW);
    g.line(0.88, 0.07, 0.88, 0.94, OUT, g.LW);
    g.box(0.12, 0.07, 0.88, 0.14, 0, g.mh(0.12, 0.88, METAL), false);
    g.poly([[0.56, 0.22], [0.3, 0.56], [0.48, 0.56], [0.38, 0.84], [0.7, 0.46], [0.52, 0.46], [0.62, 0.22]], g.lg(0, 0.22, 0, 0.84, ['#fff7a0', '#e8c020']), 1);
    g.ell(0.5, 0.07, 0.38, 0.04, g.lg(0.12, 0, 0.88, 0, [shade(METAL, 0.4), METAL, shade(METAL, -0.3)]));
    g.ell(0.58, 0.065, 0.1, 0.018, shade(METAL, -0.2), 1);
    g.hl(0.25, 0.16, 0.25, 0.9, 0.35, 1.6);
  },

  // ======================= KEYS =======================
  key(ctx, r, c) {
    const g = KL(ctx, r, c, 2.4);
    const kc = c.base;
    g.circle(0.2, 0.5, 0.4, g.rg(0.16, 0.42, 0.02, 0.45, [shade(kc, 0.45), kc, shade(kc, -0.5)]));
    g.hole((P) => { P.a(0.14, 0.5, 0.15, 0, TAU); });
    g.poly([[0.34, 0.4], [0.96, 0.4], [0.99, 0.5], [0.96, 0.58], [0.88, 0.58], [0.88, 0.76], [0.82, 0.76], [0.82, 0.66], [0.76, 0.66], [0.76, 0.8], [0.7, 0.8], [0.7, 0.66], [0.64, 0.66], [0.64, 0.74], [0.58, 0.74], [0.58, 0.58], [0.34, 0.6]], g.cy(0.4, 0.8, kc));
    g.line(0.38, 0.49, 0.94, 0.49, alpha('#000', 0.45), 1.2);
    g.hl(0.36, 0.43, 0.94, 0.43, 0.45);
    g.circle(0.31, 0.36, 0.05, null, 1);
  },

  keycard(ctx, r, c, item) {
    const g = K(ctx, r, c, 1.45, 1.65);
    g.box(0.02, 0.06, 0.98, 0.94, 0.1, g.lg(0, 0, 1, 1, [shade(c.base, 0.3), c.base, shade(c.base, -0.45)]));
    g.clip((P) => { rrPath(ctx, g.X(0.02), g.Y(0.06), g.W(0.96), g.H(0.88), g.M * 0.1); });
    g.box(0, 0.06, 1, 0.3, 0, alpha(shade(c.accent, -0.2), 0.9), false);
    g.circle(0.84, 0.66, 0.14, g.rg(0.82, 0.62, 0, 0.16, ['rgba(255,255,255,0.45)', 'rgba(140,220,255,0.18)', 'rgba(255,140,220,0.05)']), false);
    g.restore();
    g.hole((P) => { rrPath(ctx, g.X(0.42), g.Y(0.12), g.W(0.16), g.H(0.07), g.M * 0.03); });
    g.box(0.08, 0.4, 0.3, 0.66, 0.04, g.lg(0.08, 0.4, 0.3, 0.66, ['#f2d47a', GOLD, '#8a6a20']));
    g.line(0.08, 0.53, 0.3, 0.53, alpha('#000', 0.45), 1);
    g.line(0.19, 0.4, 0.19, 0.66, alpha('#000', 0.45), 1);
    g.text(item.short || 'KEY', 0.62, 0.48, 0.2, alpha(WHITE, 0.92));
    for (let i = 0; i < 14; i++) g.line(0.4 + i * 0.035, 0.74, 0.4 + i * 0.035, 0.86, alpha('#000', i % 3 ? 0.6 : 0.3), i % 2 ? 1 : 2);
  },

  // ======================= MISC / BARTER =======================
  circuit(ctx, r, c) {
    const g = K(ctx, r, c, 1.2, 1.5);
    const pcb = mix(PCB, c.base, 0.25);
    g.box(0.02, 0.06, 0.98, 0.94, 0.03, g.mv(0.06, 0.94, pcb));
    const tr = alpha('#c8d870', 0.55);
    [[0.1, 0.2, 0.3, 0.2, 0.3, 0.4], [0.1, 0.8, 0.25, 0.8, 0.32, 0.6], [0.6, 0.45, 0.75, 0.45, 0.85, 0.6], [0.6, 0.55, 0.7, 0.7, 0.9, 0.7], [0.45, 0.3, 0.45, 0.14, 0.7, 0.14]].forEach((p) => {
      g.path((P) => { P.m(p[0], p[1]); P.l(p[2], p[3]); P.l(p[4], p[5]); }, null, false);
      ctx.strokeStyle = tr; ctx.lineWidth = 1.2; ctx.stroke();
      g.circle(p[4], p[5], 0.02, BRASS, false);
    });
    g.box(0.32, 0.3, 0.6, 0.68, 0.02, g.mv(0.3, 0.68, BLACK));
    for (let i = 0; i < 5; i++) {
      const y = 0.35 + i * 0.07;
      g.line(0.28, y, 0.32, y, '#c8ccd0', 1.5);
      g.line(0.6, y, 0.64, y, '#c8ccd0', 1.5);
    }
    g.circle(0.36, 0.34, 0.015, alpha('#fff', 0.4), false);
    g.circle(0.8, 0.27, 0.08, g.mh(0.73, 0.87, '#3a5a9a'));
    g.line(0.8, 0.2, 0.8, 0.34, alpha('#fff', 0.5), 1);
    g.box(0.68, 0.76, 0.86, 0.84, 0.02, '#c8b48a', 1);
    [0.72, 0.76, 0.81].forEach((x) => g.line(x, 0.76, x, 0.84, ['#a03020', '#202020', '#c08020'][Math.round((x - 0.72) * 25) % 3], 1.2));
    [[0.07, 0.12], [0.93, 0.12], [0.07, 0.88], [0.93, 0.88]].forEach(([x, y]) => { g.circle(x, y, 0.04, BRASS, 1); g.circle(x, y, 0.018, BLACK, false); });
  },

  battery(ctx, r, c) {
    const g = K(ctx, r, c, 0.45, 0.6);
    g.box(0.36, 0.0, 0.64, 0.08, 0.02, g.mh(0.36, 0.64, METAL));
    g.box(0.12, 0.06, 0.88, 0.98, 0.06, g.mh(0.12, 0.88, c.base));
    g.box(0.12, 0.06, 0.88, 0.34, 0.06, g.mh(0.12, 0.88, COPPER), false);
    g.box(0.12, 0.06, 0.88, 0.98, 0.06, null);
    g.line(0.12, 0.34, 0.88, 0.34, alpha('#000', 0.5), 1.2);
    g.text('+', 0.5, 0.2, 0.42, alpha('#000', 0.6));
    g.line(0.3, 0.62, 0.7, 0.62, alpha('#fff', 0.5), 1.5);
    g.line(0.34, 0.72, 0.66, 0.72, alpha('#fff', 0.35), 1);
    g.box(0.12, 0.9, 0.88, 0.98, 0.04, g.mh(0.12, 0.88, METAL));
    g.hl(0.26, 0.1, 0.26, 0.9, 0.3, 2);
  },

  cable(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.3);
    const cc = c.base;
    g.tube((P) => { P.m(0.3, 0.3); P.q(0.15, 0.15, 0.08, 0.06); }, cc, g.M * 0.06);
    for (let i = 0; i < 4; i++) g.tube((P) => { P.e(0.42 + i * 0.035, 0.5 + i * 0.01, 0.3, 0.32); }, i % 2 ? shade(cc, -0.15) : cc, g.M * 0.06);
    g.tube((P) => { P.e(0.47, 0.51, 0.3, 0.32, 0, Math.PI * 1.1, Math.PI * 1.5); }, alpha('#fff', 0.2), g.M * 0.02, false);
    g.tube((P) => { P.m(0.7, 0.72); P.q(0.8, 0.86, 0.86, 0.84); }, cc, g.M * 0.06);
    g.box(0.84, 0.76, 0.98, 0.92, 0.02, g.mv(0.76, 0.92, BLACK));
    g.box(0.96, 0.79, 1.0, 0.89, 0, METAL, 1);
    g.box(0.0, 0.0, 0.12, 0.1, 0.02, g.mv(0, 0.1, BLACK));
  },

  gpu(ctx, r, c) {
    const g = K(ctx, r, c, 1.8, 2.4);
    g.box(0.06, 0.72, 0.96, 0.84, 0.01, g.mv(0.72, 0.84, PCB));
    g.box(0.3, 0.83, 0.7, 0.9, 0.005, g.mv(0.83, 0.9, GOLD));
    for (let i = 0; i < 16; i++) g.line(0.31 + i * 0.025, 0.84, 0.31 + i * 0.025, 0.89, alpha('#000', 0.35), 1);
    g.box(0.0, 0.08, 0.06, 0.94, 0.005, g.mh(0, 0.06, METAL));
    for (let i = 0; i < 5; i++) g.box(0.015, 0.16 + i * 0.12, 0.045, 0.24 + i * 0.12, 0.01, BLACK, false);
    g.box(0.06, 0.08, 0.98, 0.74, 0.05, g.mv(0.08, 0.74, c.base));
    g.poly([[0.62, 0.08], [0.7, 0.08], [0.56, 0.74], [0.48, 0.74]], alpha(c.accent, 0.75), false);
    g.box(0.84, 0.02, 0.94, 0.09, 0.01, BLACK, 1);
    [0.3, 0.74].forEach((x) => {
      g.circle(x, 0.41, 0.3, g.rg(x, 0.41, 0.05, 0.3, ['#3a3e42', BLACK]));
      blades(g, x, 0.41, 0.28, 7, g.lg(x - 0.1, 0.2, x + 0.1, 0.6, ['#4a4f54', '#202224']), 0.3);
      g.circle(x, 0.41, 0.08, g.rg(x, 0.4, 0, 0.09, [shade(c.base, 0.3), c.dark]));
    });
    g.hl(0.08, 0.12, 0.96, 0.12, 0.3);
  },

  hdd(ctx, r, c) {
    const g = K(ctx, r, c, 1.3, 1.5);
    const mc = mix('#9aa2a8', c.base, 0.3);
    g.box(0.04, 0.06, 0.96, 0.94, 0.04, g.mv(0.06, 0.94, mc));
    g.circle(0.4, 0.48, 0.38, alpha('#fff', 0.08), 1);
    g.circle(0.4, 0.48, 0.3, null, 0.8);
    g.circle(0.4, 0.48, 0.08, g.rg(0.4, 0.46, 0, 0.09, [shade(mc, 0.5), shade(mc, -0.3)]));
    g.box(0.62, 0.5, 0.92, 0.84, 0.01, PAPER, 1);
    g.text('HDD', 0.77, 0.6, 0.12, '#222');
    g.line(0.66, 0.7, 0.88, 0.7, alpha('#000', 0.5), 1);
    g.line(0.66, 0.76, 0.84, 0.76, alpha('#000', 0.5), 1);
    [[0.09, 0.12], [0.91, 0.12], [0.09, 0.88], [0.91, 0.88], [0.5, 0.12], [0.5, 0.88]].forEach(([x, y]) => g.rivet(x, y, 0.025));
    g.hl(0.06, 0.09, 0.94, 0.09, 0.4);
  },

  phone(ctx, r, c) {
    const g = K(ctx, r, c, 0.48, 0.55);
    g.box(0.06, 0.02, 0.94, 0.98, 0.14, g.mh(0.06, 0.94, mix(BLACK, c.base, 0.4)));
    g.box(0.96, 0.24, 0.99, 0.36, 0.01, BLACK, 1);
    g.box(0.12, 0.07, 0.88, 0.93, 0.08, g.lg(0.1, 0.07, 0.9, 0.93, ['#2a4a62', '#0e1820', '#1e3446']), 1);
    g.box(0.4, 0.09, 0.6, 0.12, 0.02, BLACK, false);
    g.poly([[0.12, 0.5], [0.88, 0.22], [0.88, 0.32], [0.12, 0.6]], alpha('#fff', 0.07), false);
    g.path((P) => { P.m(0.62, 0.62); P.l(0.4, 0.5); P.m(0.62, 0.62); P.l(0.8, 0.86); P.m(0.62, 0.62); P.l(0.86, 0.56); P.m(0.62, 0.62); P.l(0.3, 0.8); }, null, false);
    ctx.strokeStyle = alpha('#fff', 0.5); ctx.lineWidth = 0.8; ctx.stroke();
  },

  tool(ctx, r, c) {
    const g = K(ctx, r, c, 0.55, 0.75);
    g.poly([[0.42, 0.44], [0.5, 0.5], [0.3, 0.98], [0.15, 0.95]], g.mh(0.15, 0.5, METAL));
    g.poly([[0.5, 0.5], [0.58, 0.44], [0.85, 0.95], [0.7, 0.98]], g.mh(0.5, 0.85, METAL));
    g.poly([[0.38, 0.64], [0.47, 0.68], [0.3, 0.98], [0.15, 0.95]], g.mh(0.15, 0.47, c.base));
    g.poly([[0.53, 0.68], [0.62, 0.64], [0.85, 0.95], [0.7, 0.98]], g.mh(0.53, 0.85, c.base));
    g.poly([[0.36, 0.46], [0.64, 0.46], [0.58, 0.12], [0.5, 0.0], [0.42, 0.12]], g.mh(0.36, 0.64, shade(METAL, -0.1)));
    g.line(0.5, 0.02, 0.5, 0.4, OUT, 1.4);
    for (let i = 0; i < 4; i++) g.line(0.44, 0.12 + i * 0.05, 0.56, 0.12 + i * 0.05, alpha('#000', 0.35), 1);
    g.rivet(0.5, 0.46, 0.08);
  },

  wrench(ctx, r, c) {
    const g = KL(ctx, r, c, 3.4);
    const mc = mix(METAL, c.base, 0.3);
    g.box(0.16, 0.36, 0.84, 0.64, 0.05, g.cy(0.36, 0.64, mc));
    g.circle(0.87, 0.5, 0.48, g.rg(0.86, 0.45, 0.05, 0.5, [shade(mc, 0.4), mc, shade(mc, -0.45)]));
    g.hole((P) => { P.m(0.86, 0.43); P.l(1.05, 0.25); P.l(1.05, 0.75); P.l(0.86, 0.57); P.z(); });
    g.circle(0.12, 0.5, 0.46, g.rg(0.11, 0.45, 0.05, 0.48, [shade(mc, 0.4), mc, shade(mc, -0.45)]));
    g.hole((P) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = g.X(0.12) + Math.cos(a) * g.M * 0.24, py = g.Y(0.5) + Math.sin(a) * g.M * 0.24;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      P.z();
    });
    g.box(0.3, 0.42, 0.7, 0.58, 0.04, alpha('#000', 0.15), false);
    g.text('17', 0.5, 0.5, 0.22, alpha('#000', 0.45));
    g.hl(0.2, 0.39, 0.8, 0.39, 0.45);
  },

  screwdriver(ctx, r, c) {
    const g = KL(ctx, r, c, 4.4);
    g.box(0.47, 0.43, 0.92, 0.57, 0, g.cy(0.43, 0.57, METAL));
    g.poly([[0.92, 0.43], [0.99, 0.47], [0.99, 0.53], [0.92, 0.57]], g.cy(0.43, 0.57, shade(METAL, 0.1)));
    g.box(0.41, 0.33, 0.48, 0.67, 0.02, g.cy(0.33, 0.67, METAL));
    g.box(0.0, 0.2, 0.43, 0.8, 0.16, g.cy(0.2, 0.8, c.base));
    [0.36, 0.5, 0.64].forEach((y) => g.line(0.06, y, 0.38, y, alpha('#000', 0.4), 1.2));
    g.box(0.06, 0.22, 0.14, 0.78, 0.04, alpha(BLACK, 0.5), false);
    g.hl(0.16, 0.28, 0.4, 0.28, 0.5);
  },

  tape(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.2);
    const tc = c.base;
    g.poly([[0.8, 0.5], [0.96, 0.56], [0.94, 0.9], [0.9, 0.86], [0.86, 0.94], [0.82, 0.88], [0.79, 0.94], [0.76, 0.6]], g.mh(0.76, 0.96, tc));
    g.ell(0.44, 0.5, 0.4, 0.44, g.rg(0.38, 0.4, 0.05, 0.5, [shade(tc, 0.4), tc, shade(tc, -0.45)]));
    [0.34, 0.28].forEach((rr) => g.ell(0.44, 0.5, rr * 0.9, rr, null, 0.7));
    g.ell(0.44, 0.5, 0.2, 0.22, g.mv(0.28, 0.72, CARD), 1);
    g.hole((P) => { P.e(0.44, 0.5, 0.15, 0.17); });
    g.dots(0.1, 0.2, 0.3, 0.4, 3, 3, alpha('#000', 0.15), 0.01);
  },

  bolt(ctx, r, c) {
    const g = KL(ctx, r, c, 2.6);
    const mc = mix(METAL, c.base, 0.3);
    g.box(0.26, 0.32, 0.98, 0.68, 0.02, g.cy(0.32, 0.68, mc));
    for (let i = 0; i < 16; i++) g.line(0.42 + i * 0.035, 0.33, 0.44 + i * 0.035, 0.67, alpha('#000', 0.45), 1);
    g.box(0.64, 0.18, 0.8, 0.82, 0.02, g.mv(0.18, 0.82, shade(mc, -0.15)));
    g.line(0.64, 0.4, 0.8, 0.4, alpha('#000', 0.4), 1); g.line(0.64, 0.6, 0.8, 0.6, alpha('#000', 0.4), 1);
    g.box(0.21, 0.08, 0.27, 0.92, 0.01, g.mv(0.08, 0.92, mc));
    g.box(0.02, 0.14, 0.22, 0.86, 0.03, g.mv(0.14, 0.86, mc));
    g.line(0.02, 0.38, 0.22, 0.38, alpha('#000', 0.45), 1);
    g.line(0.02, 0.62, 0.22, 0.62, alpha('#000', 0.45), 1);
    g.hl(0.04, 0.2, 0.2, 0.2, 0.5);
  },

  pipe(ctx, r, c) {
    const g = KL(ctx, r, c, 3.6);
    const mc = mix('#6a6058', c.base, 0.5);
    g.box(0.08, 0.3, 0.92, 0.7, 0, g.cy(0.3, 0.7, mc));
    [[0.3, 0.55], [0.6, 0.45], [0.75, 0.62]].forEach(([x, y]) => g.ell(x, y, 0.03, 0.08, alpha('#7a3a14', 0.5), false));
    g.line(0.1, 0.6, 0.9, 0.6, alpha('#000', 0.2), 1);
    [[0.0, 0.12], [0.88, 1.0]].forEach(([a, b]) => {
      g.box(a, 0.22, b, 0.78, 0.02, g.cy(0.22, 0.78, shade(mc, -0.1)));
      for (let i = 1; i < 4; i++) g.line(a + ((b - a) * i) / 4, 0.24, a + ((b - a) * i) / 4, 0.76, alpha('#000', 0.35), 1);
    });
    g.ell(0.995, 0.5, 0.006, 0.2, BLACK, false);
    g.hl(0.1, 0.36, 0.9, 0.36, 0.35);
  },

  fuel(ctx, r, c) {
    const g = K(ctx, r, c, 0.78, 0.88);
    g.box(0.06, 0.06, 0.22, 0.2, 0.02, g.mv(0.06, 0.2, shade(c.base, -0.2)));
    g.box(0.1, 0.02, 0.18, 0.08, 0.01, METAL, 1);
    g.box(0.3, 0.02, 0.88, 0.16, 0.03, g.mv(0.02, 0.16, c.base));
    [0.36, 0.53, 0.7].forEach((x) => g.hole((P) => { rrPath(ctx, g.X(x), g.Y(0.05), g.W(0.12), g.H(0.07), g.M * 0.02); }));
    g.poly([[0.2, 0.16], [0.96, 0.16], [0.96, 0.98], [0.04, 0.98], [0.04, 0.3]], g.mv(0.16, 0.98, c.base));
    g.line(0.14, 0.32, 0.86, 0.9, alpha('#000', 0.35), 2.5);
    g.line(0.86, 0.32, 0.14, 0.9, alpha('#000', 0.35), 2.5);
    g.line(0.14, 0.3, 0.86, 0.88, alpha('#fff', 0.18), 1.2);
    g.line(0.86, 0.3, 0.14, 0.88, alpha('#fff', 0.18), 1.2);
    g.box(0.12, 0.28, 0.88, 0.92, 0.03, null, 1);
    g.hl(0.08, 0.22, 0.94, 0.2, 0.3);
  },

  canister(ctx, r, c) {
    const g = K(ctx, r, c, 0.5, 0.62);
    g.box(0.38, 0.04, 0.62, 0.18, 0.01, g.mh(0.38, 0.62, BRASS));
    g.box(0.6, 0.09, 0.74, 0.13, 0, BRASS, 1);
    g.box(0.26, 0.0, 0.74, 0.06, 0.02, g.mh(0.26, 0.74, BLACK));
    g.path((P) => { P.m(0.1, 0.96); P.l(0.1, 0.42); P.q(0.1, 0.16, 0.5, 0.16); P.q(0.9, 0.16, 0.9, 0.42); P.l(0.9, 0.96); P.z(); }, g.mh(0.1, 0.9, c.base));
    g.line(0.1, 0.5, 0.9, 0.5, alpha('#000', 0.4), 1.2);
    g.line(0.1, 0.53, 0.9, 0.53, alpha('#fff', 0.2), 1);
    g.poly([[0.5, 0.58], [0.68, 0.72], [0.5, 0.86], [0.32, 0.72]], RED, 1);
    g.poly([[0.5, 0.63], [0.62, 0.72], [0.5, 0.81], [0.38, 0.72]], WHITE, false);
    g.path((P) => { P.m(0.5, 0.79); P.q(0.42, 0.74, 0.5, 0.65); P.q(0.58, 0.74, 0.5, 0.79); P.z(); }, RED, false);
    g.box(0.08, 0.92, 0.92, 0.99, 0.02, g.mh(0.08, 0.92, shade(c.base, -0.3)));
    g.hl(0.26, 0.3, 0.26, 0.9, 0.35, 2);
  },

  gold(ctx, r, c) {
    const g = K(ctx, r, c, 1.2, 1.5);
    const gc = mix(GOLD, c.base, 0.3);
    goldBar(g, 0.02, 0.5, 0.48, 0.46, gc);
    goldBar(g, 0.5, 0.5, 0.48, 0.46, shade(gc, -0.05));
    goldBar(g, 0.26, 0.08, 0.48, 0.46, shade(gc, 0.05));
    g.glint(0.38, 0.12, 0.09);
  },

  chain(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.2);
    const gc = mix(GOLD, c.base, 0.4);
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) * (1 - t) * 0.1 + 2 * t * (1 - t) * 0.5 + t * t * 0.9;
      const y = (1 - t) * (1 - t) * 0.06 + 2 * t * (1 - t) * 1.05 + t * t * 0.06;
      const dx = 2 * (1 - t) * 0.4 + 2 * t * 0.4, dy = 2 * (1 - t) * 0.99 - 2 * t * 0.99;
      const ang = Math.atan2(dy * g.f.h, dx * g.f.w);
      ctx.save();
      ctx.translate(g.X(x), g.Y(y));
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(0, 0, g.M * 0.05, g.M * (i % 2 ? 0.015 : 0.03), 0, 0, TAU);
      ctx.strokeStyle = OUT; ctx.lineWidth = g.M * 0.03 + 1.5; ctx.stroke();
      ctx.strokeStyle = i % 2 ? shade(gc, -0.2) : shade(gc, 0.2); ctx.lineWidth = g.M * 0.03; ctx.stroke();
      ctx.restore();
    }
    g.box(0.47, 0.58, 0.53, 0.66, 0.01, gc, 1);
    g.circle(0.5, 0.78, 0.14, g.rg(0.46, 0.74, 0.01, 0.15, [shade(gc, 0.5), gc, shade(gc, -0.45)]));
    g.circle(0.5, 0.78, 0.09, null, 1);
    g.star(0.5, 0.78, 0.06, 0.025, 5, shade(gc, -0.3), false);
    g.glint(0.44, 0.72, 0.05);
  },

  statue(ctx, r, c) {
    const g = K(ctx, r, c, 0.6, 0.8);
    const sc = c.base;
    g.box(0.08, 0.84, 0.92, 0.98, 0.02, g.mv(0.84, 0.98, shade(sc, -0.35)));
    g.tube((P) => { P.m(0.7, 0.82); P.q(0.92, 0.8, 0.86, 0.58); }, shade(sc, -0.1), g.M * 0.07);
    g.path((P) => { P.m(0.28, 0.85); P.q(0.2, 0.5, 0.4, 0.36); P.l(0.37, 0.22); P.l(0.33, 0.04); P.l(0.45, 0.14); P.l(0.55, 0.14); P.l(0.67, 0.04); P.l(0.63, 0.22); P.l(0.6, 0.36); P.q(0.8, 0.52, 0.72, 0.85); P.z(); }, g.lg(0.2, 0.1, 0.8, 0.9, [shade(sc, 0.45), sc, shade(sc, -0.5)]));
    g.line(0.4, 0.36, 0.6, 0.36, shade(GOLD, 0.1), 2);
    g.circle(0.5, 0.4, 0.03, '#3a8ab0', 1);
    g.circle(0.44, 0.24, 0.02, '#2a8a40', false);
    g.circle(0.56, 0.24, 0.02, '#2a8a40', false);
    g.line(0.42, 0.6, 0.42, 0.84, alpha('#000', 0.3), 1);
    g.line(0.58, 0.6, 0.58, 0.84, alpha('#000', 0.3), 1);
    g.hl(0.32, 0.5, 0.36, 0.78, 0.35, 1.6);
  },

  watch(ctx, r, c) {
    const g = K(ctx, r, c, 0.55, 0.7);
    const strap = shade(c.accent, -0.55);
    g.box(0.28, 0.0, 0.72, 0.32, 0.03, g.mh(0.28, 0.72, strap));
    g.box(0.28, 0.68, 0.72, 1.0, 0.03, g.mh(0.28, 0.72, strap));
    [0.82, 0.9].forEach((y) => g.circle(0.5, y, 0.025, BLACK, false));
    g.box(0.88, 0.45, 0.96, 0.55, 0.01, METAL, 1);
    g.circle(0.5, 0.5, 0.42, g.rg(0.42, 0.42, 0.05, 0.45, [shade(METAL, 0.5), METAL, shade(METAL, -0.5)]));
    g.circle(0.5, 0.5, 0.33, g.rg(0.48, 0.46, 0, 0.35, [shade(c.base, 0.15), shade(c.base, -0.4)]));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const x1 = 0.5 + (Math.cos(a) * 0.27 * g.M) / g.f.w, y1 = 0.5 + (Math.sin(a) * 0.27 * g.M) / g.f.h;
      const x2 = 0.5 + (Math.cos(a) * 0.31 * g.M) / g.f.w, y2 = 0.5 + (Math.sin(a) * 0.31 * g.M) / g.f.h;
      g.line(x1, y1, x2, y2, alpha(WHITE, 0.85), i % 3 ? 1 : 2);
    }
    g.line(0.5, 0.5, 0.5, 0.33, WHITE, 1.8);
    g.line(0.5, 0.5, 0.64, 0.56, WHITE, 1.8);
    g.circle(0.5, 0.5, 0.03, METAL, false);
    g.line(0.38, 0.36, 0.46, 0.32, HL, 1.5);
  },

  ring(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1);
    const band = mix(GOLD, c.base, 0.5);
    g.tube((P) => { P.e(0.5, 0.62, 0.34, 0.3); }, band, g.M * 0.1);
    g.tube((P) => { P.e(0.5, 0.62, 0.34, 0.3, 0, Math.PI * 0.1, Math.PI * 0.9); }, shade(band, -0.35), g.M * 0.05, false);
    g.tube((P) => { P.e(0.5, 0.62, 0.34, 0.3, 0, Math.PI * 1.15, Math.PI * 1.45); }, alpha('#fff', 0.45), g.M * 0.03, false);
    g.poly([[0.38, 0.34], [0.42, 0.26], [0.58, 0.26], [0.62, 0.34]], g.mv(0.26, 0.34, band));
    g.poly([[0.34, 0.2], [0.42, 0.1], [0.58, 0.1], [0.66, 0.2], [0.5, 0.34]], g.lg(0.34, 0.1, 0.66, 0.34, [shade(c.accent, 0.55), c.accent, shade(c.accent, -0.5)]));
    g.poly([[0.42, 0.1], [0.58, 0.1], [0.55, 0.2], [0.45, 0.2]], alpha('#fff', 0.3), false);
    g.line(0.34, 0.2, 0.66, 0.2, alpha('#000', 0.3), 1);
    g.glint(0.44, 0.13, 0.07);
  },

  gem(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.2);
    const gc = c.base;
    const pts = [[0.04, 0.34], [0.26, 0.1], [0.74, 0.1], [0.96, 0.34], [0.5, 0.94]];
    g.poly(pts, g.lg(0.1, 0.1, 0.9, 0.9, [shade(gc, 0.5), gc, shade(gc, -0.55)]));
    g.poly([[0.36, 0.1], [0.64, 0.1], [0.7, 0.34], [0.3, 0.34]], alpha('#fff', 0.25), false);
    g.poly([[0.04, 0.34], [0.3, 0.34], [0.5, 0.94]], alpha('#fff', 0.15), false);
    g.poly([[0.7, 0.34], [0.96, 0.34], [0.5, 0.94]], alpha('#000', 0.25), false);
    g.poly([[0.26, 0.1], [0.36, 0.1], [0.3, 0.34], [0.04, 0.34]], alpha('#fff', 0.35), false);
    g.poly([[0.64, 0.1], [0.74, 0.1], [0.96, 0.34], [0.7, 0.34]], alpha('#000', 0.15), false);
    const fl = alpha('#000', 0.35);
    g.line(0.04, 0.34, 0.96, 0.34, fl, 1);
    [[0.3, 0.34], [0.7, 0.34], [0.5, 0.34]].forEach(([x, y]) => g.line(x, y, 0.5, 0.94, fl, 1));
    g.line(0.36, 0.1, 0.3, 0.34, fl, 1); g.line(0.64, 0.1, 0.7, 0.34, fl, 1);
    g.poly(pts, null);
    g.glint(0.3, 0.18, 0.12);
    g.glint(0.72, 0.5, 0.06);
  },

  coin(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.15);
    const cc = c.base;
    g.ell(0.64, 0.42, 0.32, 0.3, shade(cc, -0.5));
    g.ell(0.62, 0.38, 0.32, 0.3, g.rg(0.56, 0.3, 0.02, 0.35, [shade(cc, 0.3), shade(cc, -0.25)]));
    g.ell(0.42, 0.62, 0.38, 0.34, shade(cc, -0.55));
    g.ell(0.4, 0.58, 0.38, 0.34, g.rg(0.32, 0.48, 0.02, 0.42, [shade(cc, 0.55), cc, shade(cc, -0.45)]));
    g.ell(0.4, 0.58, 0.3, 0.27, null, 1);
    g.dash([1.5, 2]);
    g.ell(0.4, 0.58, 0.34, 0.305, null, 1);
    g.dash([]);
    g.star(0.4, 0.58, 0.16, 0.07, 5, g.lg(0.3, 0.45, 0.5, 0.7, [shade(cc, 0.4), shade(cc, -0.3)]), 1);
    g.glint(0.24, 0.4, 0.07);
  },

  cash(ctx, r, c) {
    const g = K(ctx, r, c, 1.6, 2.2);
    const bc = mix('#5a7a4a', c.base, 0.4);
    for (let i = 3; i >= 1; i--) g.box(0.04 + i * 0.008, 0.18 + i * 0.05, 0.96 + i * 0.008, 0.78 + i * 0.05, 0.02, shade(bc, -0.15 - i * 0.08), 1);
    g.box(0.04, 0.14, 0.96, 0.78, 0.02, g.lg(0, 0.14, 1, 0.78, [shade(bc, 0.25), bc, shade(bc, -0.2)]));
    g.box(0.08, 0.2, 0.92, 0.72, 0.01, null, 0.8);
    g.ell(0.24, 0.46, 0.1, 0.2, alpha(shade(bc, 0.4), 0.7), 0.8);
    g.ell(0.76, 0.46, 0.1, 0.2, alpha(shade(bc, -0.3), 0.6), 0.8);
    g.text('100', 0.13, 0.27, 0.12, alpha('#102010', 0.8));
    g.text('100', 0.87, 0.65, 0.12, alpha('#102010', 0.8));
    g.box(0.42, 0.08, 0.58, 0.94, 0.01, g.mv(0.08, 0.94, '#d8c8a0'));
    g.text('$', 0.5, 0.48, 0.2, alpha('#5a4020', 0.8));
  },

  book(ctx, r, c) {
    const g = K(ctx, r, c, 0.7, 0.85);
    g.poly([[0.82, 0.06], [0.95, 0.12], [0.95, 0.98], [0.82, 0.94]], g.lg(0.82, 0, 0.95, 0, [PAPER, shade(PAPER, -0.3)]));
    for (let i = 1; i < 8; i++) g.line(0.83, 0.06 + i * 0.11, 0.94, 0.12 + i * 0.11, alpha('#000', 0.2), 1);
    g.poly([[0.06, 0.94], [0.82, 0.94], [0.95, 0.98], [0.2, 0.99]], shade(PAPER, -0.2), 1);
    g.box(0.06, 0.04, 0.84, 0.95, 0.02, g.lg(0, 0, 1, 1, [shade(c.base, 0.2), c.base, shade(c.base, -0.45)]));
    g.box(0.06, 0.04, 0.17, 0.95, 0.02, alpha('#000', 0.3), 1);
    g.box(0.28, 0.18, 0.74, 0.4, 0.01, alpha(PAPER, 0.85), 1);
    g.line(0.34, 0.26, 0.68, 0.26, alpha('#000', 0.55), 1.4);
    g.line(0.38, 0.33, 0.64, 0.33, alpha('#000', 0.4), 1);
    g.line(0.24, 0.8, 0.78, 0.8, alpha(GOLD, 0.6), 1.4);
  },

  document(ctx, r, c) {
    const g = K(ctx, r, c, 0.7, 0.8);
    const pc = mix(PAPER, c.base, 0.15);
    g.poly([[0.08, 0.02], [0.72, 0.02], [0.92, 0.22], [0.92, 0.98], [0.08, 0.98]], g.lg(0, 0, 1, 1, [shade(pc, 0.15), pc, shade(pc, -0.2)]));
    g.poly([[0.72, 0.02], [0.72, 0.22], [0.92, 0.22]], shade(pc, -0.3));
    g.line(0.16, 0.12, 0.6, 0.12, alpha('#000', 0.75), 2);
    for (let i = 0; i < 9; i++) g.line(0.16, 0.28 + i * 0.07, i % 3 === 2 ? 0.6 : 0.84, 0.28 + i * 0.07, alpha('#000', 0.38), 1);
    g.save(); g.rotAt(0.5, 0.6, -0.35);
    g.box(0.18, 0.52, 0.82, 0.68, 0.01, alpha(RED, 0.12), 1.6);
    ctx.strokeStyle = alpha(RED, 0.85); ctx.lineWidth = 1.6; ctx.stroke();
    g.text('SECRET', 0.5, 0.6, 0.14, alpha(RED, 0.9));
    g.restore();
    g.path((P) => { P.m(0.54, 0.92); P.q(0.6, 0.84, 0.64, 0.92); P.q(0.7, 0.98, 0.76, 0.88); P.q(0.8, 0.84, 0.84, 0.92); }, null, false);
    ctx.strokeStyle = alpha('#1a2a5a', 0.8); ctx.lineWidth = 1.2; ctx.stroke();
  },

  folder(ctx, r, c, item) {
    const g = K(ctx, r, c, 1.15, 1.4);
    const mc = mix('#c8a868', c.base, 0.35);
    g.path((P) => { P.m(0.02, 0.18); P.l(0.3, 0.18); P.l(0.36, 0.06); P.l(0.6, 0.06); P.l(0.66, 0.18); P.l(0.98, 0.18); P.l(0.98, 0.96); P.l(0.02, 0.96); P.z(); }, g.mv(0.06, 0.96, shade(mc, -0.2)));
    g.save(); g.rotAt(0.5, 0.4, -0.05);
    g.box(0.1, 0.14, 0.9, 0.6, 0.01, WHITE, 1);
    [0.22, 0.28, 0.34].forEach((y) => g.line(0.16, y, 0.8, y, alpha('#000', 0.3), 1));
    g.restore();
    g.poly([[0.02, 0.34], [0.98, 0.3], [0.98, 0.96], [0.02, 0.96]], g.lg(0, 0.3, 1, 0.96, [shade(mc, 0.2), mc, shade(mc, -0.25)]));
    g.box(0.1, 0.44, 0.52, 0.58, 0.01, WHITE, 1);
    g.text(item.short || 'FILE', 0.31, 0.51, 0.1, '#222');
    g.box(0.02, 0.76, 0.98, 0.84, 0, alpha(RED, 0.7), false);
    g.hl(0.04, 0.36, 0.96, 0.32, 0.4);
  },

  usb(ctx, r, c) {
    const g = KL(ctx, r, c, 2.6);
    g.box(0.72, 0.3, 0.99, 0.7, 0.01, g.cy(0.3, 0.7, METAL));
    g.box(0.82, 0.38, 0.88, 0.46, 0, BLACK, false);
    g.box(0.82, 0.54, 0.88, 0.62, 0, BLACK, false);
    g.box(0.02, 0.16, 0.74, 0.84, 0.14, g.cy(0.16, 0.84, c.base));
    g.hole((P) => { P.a(0.1, 0.5, 0.1, 0, TAU); });
    g.box(0.26, 0.34, 0.6, 0.66, 0.04, alpha('#fff', 0.15), 1);
    g.circle(0.66, 0.5, 0.05, '#40ff60', false);
    g.hl(0.14, 0.24, 0.7, 0.24, 0.4);
  },

  chip(ctx, r, c, item) {
    const g = K(ctx, r, c, 1, 1);
    for (let i = 0; i < 7; i++) {
      const t = 0.24 + i * 0.087;
      g.box(t - 0.02, 0.04, t + 0.02, 0.18, 0, '#c0c6ca', 1);
      g.box(t - 0.02, 0.82, t + 0.02, 0.96, 0, '#c0c6ca', 1);
      g.box(0.04, t - 0.02, 0.18, t + 0.02, 0, '#c0c6ca', 1);
      g.box(0.82, t - 0.02, 0.96, t + 0.02, 0, '#c0c6ca', 1);
    }
    g.box(0.15, 0.15, 0.85, 0.85, 0.03, g.mv(0.15, 0.85, mix(BLACK, c.base, 0.3)));
    g.box(0.27, 0.27, 0.73, 0.73, 0.04, g.lg(0.27, 0.27, 0.73, 0.73, ['#d8dde0', '#8a9298', '#5a6066']));
    g.text(item.short || 'CPU', 0.5, 0.5, 0.15, alpha('#000', 0.6));
    g.poly([[0.17, 0.17], [0.25, 0.17], [0.17, 0.25]], GOLD, false);
  },

  sensor(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.3);
    g.tube((P) => { P.m(0.8, 0.86); P.q(0.96, 0.9, 0.98, 1.0); }, BLACK, g.M * 0.06);
    g.box(0.06, 0.54, 0.94, 0.94, 0.06, g.mv(0.54, 0.94, c.base));
    const dome = (P) => { P.m(0.24, 0.56); P.q(0.24, 0.06, 0.5, 0.06); P.q(0.76, 0.06, 0.76, 0.56); P.z(); };
    g.path(dome, g.rg(0.42, 0.24, 0.02, 0.4, ['#ffffff', '#d8d8d0', '#8a8a84']));
    g.clip(dome);
    for (let i = 1; i < 5; i++) g.path((P) => { P.m(0.24 + i * 0.104, 0.56); P.q(0.5 + (i - 2.5) * 0.08, 0.1, 0.5 + (i - 2.5) * 0.02, 0.06); }, null, 0.7);
    g.restore();
    g.circle(0.84, 0.66, 0.035, '#ff3020', false);
    g.circle(0.84, 0.66, 0.07, alpha('#ff3020', 0.25), false);
    g.rivet(0.14, 0.86, 0.03); g.rivet(0.86, 0.86, 0.03);
    g.line(0.12, 0.6, 0.88, 0.6, alpha('#fff', 0.25), 1);
  },

  motor(ctx, r, c) {
    const g = K(ctx, r, c, 1.4, 1.7);
    g.poly([[0.2, 0.78], [0.7, 0.78], [0.78, 0.94], [0.12, 0.94]], g.mv(0.78, 0.94, BLACK));
    g.box(0.86, 0.42, 0.99, 0.52, 0, g.cy(0.42, 0.52, METAL));
    g.line(0.9, 0.44, 0.97, 0.44, BLACK, 1);
    g.box(0.06, 0.24, 0.16, 0.7, 0.03, g.cy(0.24, 0.7, METAL));
    g.box(0.76, 0.2, 0.87, 0.74, 0.03, g.cy(0.2, 0.74, METAL));
    g.box(0.13, 0.16, 0.79, 0.78, 0.04, g.cy(0.16, 0.78, c.base));
    for (let i = 0; i < 10; i++) g.line(0.18 + i * 0.06, 0.18, 0.18 + i * 0.06, 0.76, alpha('#000', 0.35), 1.4);
    g.box(0.34, 0.04, 0.58, 0.17, 0.02, g.mv(0.04, 0.17, shade(c.base, -0.2)));
    g.tube((P) => { P.m(0.4, 0.06); P.q(0.36, -0.02, 0.24, 0.02); }, RED, g.M * 0.03);
    g.tube((P) => { P.m(0.52, 0.06); P.q(0.56, -0.02, 0.68, 0.02); }, BLACK, g.M * 0.03);
    [0.82].forEach((x) => g.rivet(x, 0.3, 0.025));
  },

  gear(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1);
    const mc = mix(METAL, c.base, 0.4);
    gearPath(g, 0.5, 0.5, 0.48, 0.38, 10);
    g.fs(g.rg(0.42, 0.4, 0.05, 0.5, [shade(mc, 0.45), mc, shade(mc, -0.45)]));
    g.circle(0.5, 0.5, 0.29, null, 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      g.hole((P) => { P.a(0.5 + (Math.cos(a) * 0.2 * g.M) / g.f.w, 0.5 + (Math.sin(a) * 0.2 * g.M) / g.f.h, 0.06, 0, TAU); });
    }
    g.circle(0.5, 0.5, 0.11, g.rg(0.48, 0.48, 0, 0.12, [shade(mc, 0.3), shade(mc, -0.3)]));
    g.hole((P) => { P.a(0.5, 0.5, 0.05, 0, TAU); });
  },

  core(ctx, r, c) {
    const g = K(ctx, r, c, 0.7, 0.85);
    const body = [[0.18, 0.16], [0.82, 0.16], [0.9, 0.3], [0.9, 0.7], [0.82, 0.84], [0.18, 0.84], [0.1, 0.7], [0.1, 0.3]];
    g.poly(body, g.rg(0.5, 0.5, 0.02, 0.55, ['#ffffff', shade(c.base, 0.4), c.base, shade(c.base, -0.6)]));
    g.circle(0.5, 0.5, 0.2, g.rg(0.5, 0.5, 0, 0.22, ['rgba(255,255,255,0.95)', alpha(c.light, 0.6), alpha(c.base, 0)]), false);
    g.tube((P) => { P.e(0.5, 0.5, 0.26, 0.12, 0.6); }, alpha('#fff', 0.45), g.M * 0.02, false);
    g.tube((P) => { P.e(0.5, 0.5, 0.26, 0.12, -0.6); }, alpha('#fff', 0.3), g.M * 0.02, false);
    [0.12, 0.88].forEach((x) => g.box(x - 0.03, 0.16, x + 0.03, 0.84, 0.01, g.mh(x - 0.03, x + 0.03, METAL)));
    g.box(0.16, 0.0, 0.84, 0.17, 0.04, g.mh(0.16, 0.84, METAL));
    g.box(0.16, 0.83, 0.84, 1.0, 0.04, g.mh(0.16, 0.84, METAL));
    [0.3, 0.5, 0.7].forEach((x) => { g.rivet(x, 0.085, 0.03); g.rivet(x, 0.915, 0.03); });
    g.hl(0.24, 0.2, 0.24, 0.8, 0.5, 2);
  },

  vial(ctx, r, c) {
    const g = K(ctx, r, c, 0.3, 0.42);
    const body = (P) => { P.m(0.2, 0.14); P.l(0.8, 0.14); P.l(0.8, 0.82); P.q(0.8, 0.98, 0.5, 0.98); P.q(0.2, 0.98, 0.2, 0.82); P.z(); };
    g.path(body, GLASS, false);
    liquidIn(g, body, 0.42, c.base);
    g.path(body, null);
    g.box(0.14, 0.11, 0.86, 0.17, 0.02, alpha('#d8eef5', 0.6), 1);
    g.box(0.28, 0.0, 0.72, 0.13, 0.03, g.mh(0.28, 0.72, CARD));
    g.hl(0.32, 0.2, 0.32, 0.88, 0.6, 1.6);
    g.box(0.2, 0.55, 0.8, 0.7, 0, alpha(PAPER, 0.8), 0.8);
  },

  jar(ctx, r, c) {
    const g = K(ctx, r, c, 0.75, 0.9);
    const body = (P) => { P.m(0.22, 0.16); P.l(0.78, 0.16); P.q(0.92, 0.22, 0.92, 0.36); P.l(0.92, 0.9); P.q(0.92, 0.98, 0.84, 0.98); P.l(0.16, 0.98); P.q(0.08, 0.98, 0.08, 0.9); P.l(0.08, 0.36); P.q(0.08, 0.22, 0.22, 0.16); P.z(); };
    g.path(body, g.mh(0.08, 0.92, alpha('#cfe6ee', 0.3)), false);
    liquidIn(g, body, 0.48, c.base);
    [[0.3, 0.7, 0.03], [0.6, 0.62, 0.02], [0.7, 0.82, 0.025]].forEach(([x, y, s]) => g.circle(x, y, s, null, 0.7));
    g.path(body, null);
    g.path((P) => { P.m(0.28, 0.3); P.q(0.5, 0.26, 0.72, 0.3); }, null, false);
    ctx.strokeStyle = alpha('#fff', 0.35); ctx.lineWidth = 1; ctx.stroke();
    g.box(0.18, 0.02, 0.82, 0.16, 0.02, g.mv(0.02, 0.16, mix(METAL, c.base, 0.2)));
    for (let i = 0; i < 9; i++) g.line(0.22 + i * 0.07, 0.04, 0.22 + i * 0.07, 0.14, alpha('#000', 0.3), 1);
    g.hl(0.18, 0.28, 0.18, 0.9, 0.55, 2);
  },

  spray(ctx, r, c, item) {
    const g = K(ctx, r, c, 0.38, 0.5);
    g.box(0.24, 0.0, 0.76, 0.2, 0.08, g.mh(0.24, 0.76, c.accent));
    g.box(0.44, 0.03, 0.56, 0.08, 0.01, BLACK, false);
    g.path((P) => { P.m(0.12, 0.3); P.q(0.14, 0.18, 0.5, 0.18); P.q(0.86, 0.18, 0.88, 0.3); P.z(); }, g.mh(0.12, 0.88, METAL));
    g.box(0.12, 0.28, 0.88, 0.97, 0.03, g.mh(0.12, 0.88, c.base));
    g.poly([[0.12, 0.62], [0.88, 0.46], [0.88, 0.56], [0.12, 0.72]], alpha(c.accent, 0.8), false);
    g.text(item.short || '', 0.5, 0.82, 0.22, alpha(WHITE, 0.9));
    g.box(0.12, 0.93, 0.88, 0.99, 0.02, g.mh(0.12, 0.88, METAL));
    g.hl(0.27, 0.32, 0.27, 0.92, 0.4, 2);
  },

  box(ctx, r, c) {
    const g = K(ctx, r, c, 1.05, 1.4);
    const bc = mix(CARD, c.base, 0.35);
    g.poly([[0.04, 0.34], [0.7, 0.34], [0.7, 0.96], [0.04, 0.96]], g.mv(0.34, 0.96, bc));
    g.poly([[0.7, 0.34], [0.96, 0.16], [0.96, 0.78], [0.7, 0.96]], g.mv(0.16, 0.96, shade(bc, -0.3)));
    g.poly([[0.04, 0.34], [0.3, 0.16], [0.96, 0.16], [0.7, 0.34]], shade(bc, 0.2));
    g.poly([[0.3, 0.34], [0.43, 0.34], [0.69, 0.16], [0.56, 0.16]], alpha('#d8c890', 0.6), false);
    g.box(0.3, 0.34, 0.43, 0.58, 0, alpha('#d8c890', 0.6), false);
    g.line(0.17, 0.25, 0.83, 0.25, alpha('#000', 0.3), 1);
    [0.12, 0.54].forEach((x) => {
      g.line(x + 0.04, 0.86, x + 0.04, 0.72, alpha('#000', 0.6), 1.4);
      g.poly([[x, 0.74], [x + 0.04, 0.68], [x + 0.08, 0.74]], alpha('#000', 0.6), false);
    });
    g.hl(0.06, 0.37, 0.68, 0.37, 0.25);
  },

  bag(ctx, r, c) {
    const g = K(ctx, r, c, 0.8, 0.95);
    g.poly([[0.36, 0.22], [0.64, 0.22], [0.74, 0.04], [0.26, 0.04]], g.mv(0.04, 0.22, shade(c.base, -0.1)));
    [0.36, 0.46, 0.56].forEach((x) => g.line(x, 0.06, x + 0.04, 0.2, alpha('#000', 0.35), 1));
    g.path((P) => { P.m(0.36, 0.2); P.q(0.0, 0.4, 0.06, 0.8); P.q(0.1, 0.98, 0.5, 0.98); P.q(0.9, 0.98, 0.94, 0.8); P.q(1.0, 0.4, 0.64, 0.2); P.z(); }, g.rg(0.42, 0.5, 0.05, 0.6, [shade(c.base, 0.3), c.base, shade(c.base, -0.5)]));
    g.path((P) => { P.m(0.3, 0.3); P.q(0.22, 0.6, 0.3, 0.9); }, null, 1);
    g.path((P) => { P.m(0.66, 0.3); P.q(0.8, 0.5, 0.74, 0.86); }, null, 1);
    g.box(0.32, 0.17, 0.68, 0.25, 0.04, g.mv(0.17, 0.25, '#b09868'));
    g.tube((P) => { P.m(0.62, 0.22); P.q(0.76, 0.34, 0.72, 0.46); }, '#b09868', g.M * 0.03);
    g.text('№7', 0.5, 0.64, 0.14, alpha('#000', 0.35));
  },

  lamp(ctx, r, c) {
    const g = K(ctx, r, c, 0.6, 0.75);
    g.tube((P) => { P.m(0.26, 0.24); P.q(0.5, -0.12, 0.74, 0.24); }, METAL, g.M * 0.03);
    g.ell(0.5, 0.52, 0.34, 0.26, g.rg(0.5, 0.56, 0.02, 0.4, ['rgba(255,240,180,0.95)', 'rgba(255,170,60,0.6)', 'rgba(140,90,40,0.35)']));
    g.path((P) => { P.m(0.5, 0.36); P.q(0.58, 0.5, 0.5, 0.6); P.q(0.42, 0.5, 0.5, 0.36); P.z(); }, '#fff2b0', false);
    [0.3, 0.5, 0.7].forEach((x) => g.line(x, 0.27, x, 0.77, alpha(shade(c.base, -0.3), 0.9), 1.6));
    g.poly([[0.18, 0.28], [0.82, 0.28], [0.7, 0.14], [0.3, 0.14]], g.mv(0.14, 0.28, c.base));
    g.box(0.12, 0.74, 0.88, 0.96, 0.04, g.mh(0.12, 0.88, c.base));
    g.circle(0.82, 0.85, 0.05, BRASS, 1);
    g.hl(0.3, 0.42, 0.34, 0.62, 0.5, 1.6);
  },

  radio(ctx, r, c) {
    const g = K(ctx, r, c, 0.4, 0.55);
    g.box(0.64, 0.0, 0.8, 0.32, 0.06, g.mh(0.64, 0.8, BLACK));
    g.box(0.22, 0.16, 0.38, 0.28, 0.02, g.mh(0.22, 0.38, BLACK));
    g.box(0.04, 0.38, 0.12, 0.6, 0.02, BLACK, 1);
    g.box(0.1, 0.24, 0.9, 0.98, 0.1, g.mh(0.1, 0.9, c.base));
    for (let i = 0; i < 6; i++) g.line(0.22, 0.32 + i * 0.04, 0.78, 0.32 + i * 0.04, alpha('#000', 0.6), 1.4);
    g.box(0.2, 0.58, 0.8, 0.7, 0.02, g.lg(0, 0.58, 0, 0.7, ['#9ac878', '#5a8a48']), 1);
    g.text('CH1', 0.5, 0.64, 0.12, alpha('#102010', 0.8));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.box(0.22 + i * 0.2, 0.75 + j * 0.09, 0.36 + i * 0.2, 0.81 + j * 0.09, 0.01, shade(c.base, -0.4), 0.8);
    g.hl(0.2, 0.28, 0.2, 0.94, 0.25, 1.6);
  },

  camera(ctx, r, c) {
    const g = K(ctx, r, c, 1.3, 1.6);
    g.poly([[0.36, 0.26], [0.42, 0.08], [0.64, 0.08], [0.7, 0.26]], g.mv(0.08, 0.26, c.base));
    g.box(0.76, 0.14, 0.88, 0.26, 0.02, g.mv(0.14, 0.26, METAL));
    g.box(0.04, 0.24, 0.96, 0.92, 0.08, g.mv(0.24, 0.92, c.base));
    g.box(0.04, 0.34, 0.22, 0.86, 0.04, alpha('#000', 0.3), false);
    g.dots(0.06, 0.36, 0.2, 0.84, 3, 7, alpha('#000', 0.35), 0.012);
    g.box(0.72, 0.3, 0.9, 0.42, 0.02, g.lg(0, 0.3, 0, 0.42, ['#f0f0e8', '#a0a098']), 1);
    g.circle(0.52, 0.58, 0.34, g.rg(0.48, 0.52, 0.05, 0.36, [shade(METAL, 0.3), STEEL]));
    g.circle(0.52, 0.58, 0.26, BLACK, 1);
    g.circle(0.52, 0.58, 0.2, g.rg(0.46, 0.5, 0.01, 0.22, ['#7aa0c8', '#25304a', '#100c18']), 1);
    g.circle(0.47, 0.52, 0.05, alpha('#fff', 0.55), false);
    g.hl(0.08, 0.28, 0.92, 0.28, 0.25);
  },

  cigarettes(ctx, r, c) {
    const g = K(ctx, r, c, 0.62, 0.8);
    g.poly([[0.08, 0.26], [0.92, 0.26], [0.96, 0.06], [0.12, 0.02]], g.mv(0.02, 0.26, shade(WHITE, -0.4)));
    [0.2, 0.42, 0.64].forEach((x, i) => {
      const y = 0.06 + (i === 1 ? 0 : 0.05);
      g.box(x, y + 0.1, x + 0.18, 0.4, 0, g.mh(x, x + 0.18, WHITE));
      g.box(x, y, x + 0.18, y + 0.11, 0, g.mh(x, x + 0.18, '#d08840'));
    });
    g.box(0.08, 0.26, 0.92, 0.98, 0.03, g.mh(0.08, 0.92, WHITE));
    g.box(0.08, 0.48, 0.92, 0.7, 0, g.mh(0.08, 0.92, c.base), false);
    g.circle(0.5, 0.59, 0.1, alpha(GOLD, 0.9), 1);
    g.box(0.14, 0.78, 0.86, 0.94, 0, alpha('#000', 0.08), 0.8);
    g.line(0.2, 0.84, 0.8, 0.84, alpha('#000', 0.5), 1);
    g.line(0.2, 0.88, 0.7, 0.88, alpha('#000', 0.5), 1);
    g.box(0.08, 0.26, 0.92, 0.98, 0.03, null);
  },

  lighter(ctx, r, c) {
    const g = K(ctx, r, c, 0.55, 0.7);
    g.path((P) => { P.m(0.38, 0.22); P.q(0.24, 0.12, 0.36, 0.0); P.q(0.42, 0.1, 0.46, 0.04); P.q(0.56, 0.14, 0.44, 0.22); P.z(); }, g.rg(0.4, 0.16, 0, 0.18, ['#fffbe0', '#ffc030', 'rgba(255,90,20,0.6)']), false);
    g.box(0.2, 0.2, 0.6, 0.44, 0.01, g.mh(0.2, 0.6, METAL));
    g.dots(0.24, 0.24, 0.56, 0.42, 4, 3, BLACK, 0.025);
    g.circle(0.62, 0.3, 0.08, g.mh(0.55, 0.69, STEEL));
    g.save(); g.rotAt(0.88, 0.44, 0.65);
    g.box(0.12, 0.2, 0.88, 0.44, 0.04, g.mh(0.12, 0.88, c.base));
    g.restore();
    g.box(0.12, 0.42, 0.88, 0.98, 0.05, g.mh(0.12, 0.88, c.base));
    g.line(0.12, 0.52, 0.88, 0.52, alpha('#000', 0.5), 1.2);
    g.hl(0.26, 0.56, 0.26, 0.94, 0.5, 2);
  },

  glass(ctx, r, c) {
    const g = K(ctx, r, c, 0.5, 0.65);
    const bowl = (P) => { P.m(0.12, 0.04); P.l(0.88, 0.04); P.q(0.94, 0.52, 0.5, 0.56); P.q(0.06, 0.52, 0.12, 0.04); P.z(); };
    g.path(bowl, GLASS, false);
    liquidIn(g, bowl, 0.26, c.base);
    g.path(bowl, null);
    g.box(0.46, 0.55, 0.54, 0.9, 0, alpha('#d0e8f0', 0.6), 1);
    g.ell(0.5, 0.92, 0.32, 0.06, alpha('#d0e8f0', 0.55));
    g.hl(0.24, 0.1, 0.26, 0.38, 0.6, 1.8);
  },

  cup(ctx, r, c) {
    const g = K(ctx, r, c, 1.05, 1.25);
    [0.3, 0.42, 0.54].forEach((x, i) => g.path((P) => { P.m(x, 0.14); P.q(x - 0.04, 0.08, x, 0.04); P.q(x + 0.04, 0.0, x, -0.04); }, null, false));
    ctx.strokeStyle = alpha('#fff', 0.35); ctx.lineWidth = 1.4; ctx.stroke();
    g.tube((P) => { P.m(0.72, 0.32); P.q(0.98, 0.3, 0.96, 0.56); P.q(0.94, 0.8, 0.72, 0.78); }, c.base, g.M * 0.08);
    g.box(0.1, 0.2, 0.74, 0.96, 0.08, g.mh(0.1, 0.74, c.base));
    g.ell(0.42, 0.2, 0.32, 0.07, shade(c.base, -0.3));
    g.ell(0.42, 0.21, 0.28, 0.05, '#3a2414', false);
    g.box(0.1, 0.48, 0.74, 0.56, 0, alpha(c.accent, 0.7), false);
    g.hl(0.2, 0.3, 0.2, 0.88, 0.4, 2);
  },

  toothpaste(ctx, r, c) {
    const g = KL(ctx, r, c, 2.8);
    g.path((P) => { P.m(0.04, 0.14); P.l(0.7, 0.22); P.q(0.8, 0.26, 0.82, 0.38); P.l(0.82, 0.62); P.q(0.8, 0.74, 0.7, 0.78); P.l(0.04, 0.86); P.z(); }, g.cy(0.14, 0.86, WHITE));
    g.poly([[0.1, 0.36], [0.76, 0.38], [0.76, 0.46], [0.1, 0.46]], alpha(c.base, 0.9), false);
    g.poly([[0.1, 0.52], [0.76, 0.52], [0.76, 0.6], [0.1, 0.62]], alpha(RED, 0.8), false);
    g.box(0.0, 0.12, 0.07, 0.88, 0.01, g.mv(0.12, 0.88, shade(WHITE, -0.1)));
    for (let i = 0; i < 4; i++) g.line(0.012 + i * 0.016, 0.14, 0.012 + i * 0.016, 0.86, alpha('#000', 0.3), 1);
    g.box(0.82, 0.28, 0.99, 0.72, 0.04, g.cy(0.28, 0.72, c.base));
    g.line(0.9, 0.29, 0.9, 0.71, alpha('#000', 0.4), 1);
    g.hl(0.1, 0.26, 0.7, 0.3, 0.6);
  },

  soap(ctx, r, c) {
    const g = K(ctx, r, c, 1.3, 1.6);
    g.box(0.06, 0.28, 0.9, 0.9, 0.2, g.lg(0, 0.28, 0, 0.9, [shade(c.base, 0.35), c.base, shade(c.base, -0.35)]));
    g.box(0.14, 0.34, 0.82, 0.78, 0.16, alpha('#fff', 0.15), 0.8);
    g.text('SOAP', 0.48, 0.56, 0.2, alpha(shade(c.base, -0.45), 0.7));
    [[0.84, 0.18, 0.07], [0.94, 0.06, 0.045], [0.72, 0.08, 0.05], [0.96, 0.3, 0.035]].forEach(([x, y, s]) => {
      g.circle(x, y, s, alpha('#ffffff', 0.15), false);
      ctx.strokeStyle = alpha('#fff', 0.7); ctx.lineWidth = 1; ctx.stroke();
    });
  },

  plug(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.2);
    g.tube((P) => { P.m(0.5, 0.74); P.q(0.5, 0.98, 0.08, 0.92); }, BLACK, g.M * 0.07);
    [0.33, 0.6].forEach((x) => {
      g.box(x, 0.02, x + 0.08, 0.32, 0.01, g.mh(x, x + 0.08, BRASS));
      g.circle(x + 0.04, 0.1, 0.018, BLACK, false);
    });
    g.path((P) => { P.m(0.24, 0.36); P.l(0.76, 0.36); P.l(0.68, 0.74); P.q(0.5, 0.82, 0.32, 0.74); P.z(); }, g.mh(0.24, 0.76, c.base));
    g.box(0.2, 0.28, 0.8, 0.38, 0.03, g.mv(0.28, 0.38, shade(c.base, 0.1)));
    for (let i = 0; i < 4; i++) g.line(0.34, 0.48 + i * 0.06, 0.66, 0.48 + i * 0.06, alpha('#000', 0.3), 1);
  },

  fan(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1);
    g.box(0.02, 0.02, 0.98, 0.98, 0.1, g.mv(0.02, 0.98, mix(BLACK, c.base, 0.5)));
    [[0.11, 0.11], [0.89, 0.11], [0.11, 0.89], [0.89, 0.89]].forEach(([x, y]) => g.hole((P) => { P.a(x, y, 0.04, 0, TAU); }));
    g.circle(0.5, 0.5, 0.44, g.rg(0.5, 0.5, 0.1, 0.44, ['#26282a', '#0c0d0e']));
    blades(g, 0.5, 0.5, 0.42, 7, g.lg(0.2, 0.2, 0.8, 0.8, [shade(c.base, 0.3), c.base, shade(c.base, -0.3)]), 0.2);
    g.circle(0.5, 0.5, 0.14, g.rg(0.48, 0.48, 0, 0.15, [shade(c.base, 0.2), c.dark]));
    g.circle(0.5, 0.5, 0.08, alpha(c.accent, 0.8), false);
  },

  magnet(ctx, r, c) {
    const g = K(ctx, r, c, 0.85, 1.0);
    const mc = c.base;
    g.path((P) => { P.m(0.06, 0.94); P.l(0.06, 0.48); P.a(0.5, 0.48, 0.44, Math.PI, 0); P.l(0.94, 0.94); P.l(0.66, 0.94); P.l(0.66, 0.48); P.a(0.5, 0.48, 0.16, 0, Math.PI, true); P.l(0.34, 0.94); P.z(); }, g.lg(0, 0, 1, 1, [shade(mc, 0.35), mc, shade(mc, -0.45)]));
    g.box(0.06, 0.78, 0.34, 0.94, 0, g.mh(0.06, 0.34, METAL));
    g.box(0.66, 0.78, 0.94, 0.94, 0, g.mh(0.66, 0.94, METAL));
    g.text('N', 0.2, 0.64, 0.16, alpha(WHITE, 0.85));
    g.text('S', 0.8, 0.64, 0.16, alpha(WHITE, 0.85));
    g.tube((P) => { P.a(0.5, 0.48, 0.38, Math.PI * 1.15, Math.PI * 1.45); }, alpha('#fff', 0.35), g.M * 0.03, false);
  },

  antenna(ctx, r, c) {
    const g = K(ctx, r, c, 1.3, 1.7);
    g.tube((P) => { P.m(0.06, 0.5); P.q(0.02, 0.8, 0.2, 0.96); }, BLACK, g.M * 0.04);
    for (let i = 0; i < 6; i++) {
      const x = 0.14 + i * 0.15, hh = 0.42 - i * 0.04;
      g.tube((P) => { P.m(x, 0.5 - hh); P.l(x, 0.5 + hh); }, METAL, g.M * 0.035);
    }
    g.box(0.02, 0.46, 0.98, 0.54, 0.02, g.cy(0.46, 0.54, c.base));
    g.box(0.44, 0.52, 0.56, 0.7, 0.01, g.mv(0.52, 0.7, BLACK));
    g.box(0.02, 0.42, 0.1, 0.58, 0.01, BLACK, 1);
  },

  drone_part(ctx, r, c) {
    const g = K(ctx, r, c, 1.3, 1.5);
    g.box(0.0, 0.62, 0.6, 0.78, 0.03, g.cy(0.62, 0.78, mix(BLACK, c.base, 0.3)));
    for (let i = 0; i < 10; i++) g.line(0.02 + i * 0.06, 0.64, 0.06 + i * 0.06, 0.76, alpha('#fff', 0.08), 1);
    g.line(0.04, 0.66, 0.56, 0.66, alpha(RED, 0.8), 1.2);
    g.box(0.54, 0.42, 0.82, 0.76, 0.04, g.mh(0.54, 0.82, c.accent));
    for (let i = 0; i < 4; i++) g.line(0.58 + i * 0.065, 0.46, 0.58 + i * 0.065, 0.72, alpha('#000', 0.35), 1);
    const pc = alpha(shade(c.base, -0.1), 0.95);
    g.poly([[0.68, 0.33], [0.94, 0.26], [1.0, 0.3], [0.96, 0.36], [0.68, 0.41]], pc);
    g.poly([[0.68, 0.33], [0.42, 0.37], [0.36, 0.43], [0.42, 0.46], [0.68, 0.41]], pc);
    g.box(0.62, 0.3, 0.74, 0.44, 0.02, g.mh(0.62, 0.74, METAL));
    g.circle(0.68, 0.33, 0.04, BLACK, false);
  },

  spring(ctx, r, c) {
    const g = K(ctx, r, c, 0.5, 0.7);
    const mc = mix(METAL, c.base, 0.3);
    const n = 8;
    for (let k = 0; k < 2; k++) {
      g.tube((P) => {
        P.m(0.15, 0.06);
        for (let i = 0; i < n; i++) {
          const y = 0.06 + i * 0.11;
          P.q(0.5, y - 0.01, 0.85, y + 0.055);
          P.q(0.5, y + 0.12, 0.15, y + 0.11);
        }
      }, k ? alpha('#fff', 0.3) : mc, k ? g.M * 0.025 : g.M * 0.08, !k);
    }
  },

  nails(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.15);
    const mc = mix(METAL, c.base, 0.3);
    [[0.12, 0.2, 0.6], [0.2, 0.84, -0.55], [0.08, 0.5, 0.05], [0.45, 0.12, 1.3]].forEach(([x, y, a]) => {
      ctx.save();
      ctx.translate(g.X(x), g.Y(y));
      ctx.rotate(a);
      const L = g.M * 0.85, t = g.M * 0.06;
      ctx.beginPath();
      ctx.moveTo(0, -t / 2); ctx.lineTo(L * 0.88, -t / 2); ctx.lineTo(L, 0); ctx.lineTo(L * 0.88, t / 2); ctx.lineTo(0, t / 2); ctx.closePath();
      const gr = ctx.createLinearGradient(0, -t / 2, 0, t / 2);
      gr.addColorStop(0, shade(mc, 0.4)); gr.addColorStop(1, shade(mc, -0.4));
      g.fs(gr, 1);
      ctx.beginPath();
      rrPath(ctx, -t * 0.6, -t * 1.5, t * 0.6, t * 3, t * 0.2);
      g.fs(shade(mc, 0.1), 1);
      ctx.restore();
    });
  },

  wire(ctx, r, c) {
    const g = K(ctx, r, c, 0.9, 1.15);
    g.tube((P) => { P.m(0.5, 0.12); P.q(0.6, -0.04, 0.9, 0.04); }, COPPER, g.M * 0.03);
    g.ell(0.16, 0.5, 0.12, 0.46, g.mv(0.04, 0.96, shade(c.base, -0.3)));
    g.box(0.16, 0.12, 0.84, 0.88, 0, g.cy(0.12, 0.88, COPPER), false);
    for (let i = 0; i < 14; i++) g.line(0.17 + i * 0.048, 0.13, 0.19 + i * 0.048, 0.87, alpha('#000', 0.25), 1);
    g.line(0.16, 0.12, 0.84, 0.12, OUT, g.LW);
    g.line(0.16, 0.88, 0.84, 0.88, OUT, g.LW);
    g.ell(0.84, 0.5, 0.14, 0.46, g.rg(0.82, 0.42, 0.02, 0.5, [shade(c.base, 0.3), c.base, shade(c.base, -0.4)]));
    g.ell(0.84, 0.5, 0.05, 0.14, BLACK, 1);
  },

  rope(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.1);
    const rc = mix('#a88a58', c.base, 0.35);
    g.tube((P) => { P.m(0.88, 0.6); P.q(0.98, 0.84, 0.82, 0.98); }, rc, g.M * 0.08);
    for (let k = 0; k < 3; k++) {
      const fn = (P) => { P.e(0.48, 0.52, 0.42 - k * 0.11, 0.4 - k * 0.1); };
      g.tube(fn, shade(rc, -k * 0.08), g.M * 0.09);
      g.dash([2, 3]);
      g.tube(fn, alpha(shade(rc, -0.45), 0.7), g.M * 0.06, false);
      g.dash([]);
    }
    g.path((P) => { P.m(0.79, 0.95); P.l(0.76, 1.0); P.m(0.82, 0.98); P.l(0.82, 1.0); }, null, 1);
  },

  cloth(ctx, r, c) {
    const g = K(ctx, r, c, 1.1, 1.4);
    const cols = [shade(c.base, -0.1), mix(c.base, c.accent, 0.25), shade(c.base, 0.1)];
    for (let i = 0; i < 3; i++) {
      const y = 0.64 - i * 0.24;
      g.box(0.06 + i * 0.02, y, 0.94 - i * 0.02, y + 0.3, 0.12, g.mv(y, y + 0.3, cols[i]));
      g.dash([2, 2]);
      g.line(0.14, y + 0.24, 0.86, y + 0.24, alpha('#000', 0.45), 1);
      g.dash([]);
      g.path((P) => { P.m(0.2, y + 0.04); P.q(0.4, y + 0.12, 0.6, y + 0.06); }, null, false);
      ctx.strokeStyle = alpha('#000', 0.25); ctx.lineWidth = 1; ctx.stroke();
    }
  },

  skull(ctx, r, c) {
    const g = K(ctx, r, c, 0.85, 0.95);
    const bc = mix('#d8cfb4', c.base, 0.25);
    g.box(0.28, 0.76, 0.72, 0.98, 0.06, g.mv(0.76, 0.98, shade(bc, -0.1)));
    for (let i = 1; i < 6; i++) g.line(0.28 + i * 0.073, 0.78, 0.28 + i * 0.073, 0.9, alpha('#000', 0.45), 1);
    g.line(0.3, 0.86, 0.7, 0.86, alpha('#000', 0.4), 1);
    g.path((P) => { P.m(0.5, 0.02); P.q(0.96, 0.02, 0.94, 0.5); P.q(0.92, 0.66, 0.76, 0.7); P.l(0.72, 0.84); P.l(0.28, 0.84); P.l(0.24, 0.7); P.q(0.08, 0.66, 0.06, 0.5); P.q(0.04, 0.02, 0.5, 0.02); P.z(); }, g.rg(0.42, 0.3, 0.05, 0.6, [shade(bc, 0.3), bc, shade(bc, -0.45)]));
    g.hole((P) => { P.e(0.32, 0.48, 0.13, 0.12); });
    g.hole((P) => { P.e(0.68, 0.48, 0.13, 0.12); });
    g.hole((P) => { P.m(0.5, 0.6); P.l(0.44, 0.72); P.l(0.56, 0.72); P.z(); });
    g.path((P) => { P.m(0.62, 0.06); P.l(0.66, 0.16); P.l(0.62, 0.22); P.l(0.68, 0.3); }, null, 1);
  },

  egg(ctx, r, c) {
    const g = K(ctx, r, c, 0.75, 0.85);
    g.poly([[0.32, 0.98], [0.68, 0.98], [0.6, 0.86], [0.4, 0.86]], g.mv(0.86, 0.98, GOLD));
    const egg = (P) => { P.m(0.5, 0.02); P.b(0.82, 0.02, 0.94, 0.46, 0.92, 0.6); P.b(0.9, 0.8, 0.72, 0.9, 0.5, 0.9); P.b(0.28, 0.9, 0.1, 0.8, 0.08, 0.6); P.b(0.06, 0.46, 0.18, 0.02, 0.5, 0.02); P.z(); };
    g.path(egg, g.rg(0.4, 0.3, 0.02, 0.6, [shade(c.base, 0.45), c.base, shade(c.base, -0.5)]));
    g.clip(egg);
    g.line(0, 0.5, 1, 0.5, GOLD, g.M * 0.05);
    g.line(0, 0.25, 1, 0.25, alpha(GOLD, 0.8), g.M * 0.025);
    g.line(0, 0.75, 1, 0.75, alpha(GOLD, 0.8), g.M * 0.025);
    for (let i = 0; i < 5; i++) g.line(0.1 + i * 0.2, 0.25, 0.2 + i * 0.2, 0.5, alpha(GOLD, 0.6), 1);
    g.restore();
    [0.2, 0.4, 0.6, 0.8].forEach((x, i) => g.circle(x, 0.5, 0.035, i % 2 ? '#c02838' : '#2a8ac0', 1));
    g.path(egg, null);
    g.glint(0.34, 0.16, 0.06);
  },

  figurine(ctx, r, c) {
    const g = K(ctx, r, c, 0.5, 0.7);
    g.ell(0.5, 0.92, 0.42, 0.07, g.mv(0.85, 0.99, BLACK));
    g.box(0.34, 0.58, 0.48, 0.92, 0.03, g.mh(0.34, 0.48, shade(c.base, -0.2)));
    g.box(0.52, 0.58, 0.66, 0.92, 0.03, g.mh(0.52, 0.66, shade(c.base, -0.2)));
    g.tube((P) => { P.m(0.32, 0.36); P.l(0.18, 0.6); }, c.base, g.M * 0.1);
    g.tube((P) => { P.m(0.68, 0.36); P.l(0.82, 0.52); P.l(0.7, 0.58); }, c.base, g.M * 0.1);
    g.line(0.66, 0.66, 0.9, 0.2, BLACK, g.M * 0.05);
    g.box(0.28, 0.3, 0.72, 0.62, 0.06, g.mh(0.28, 0.72, c.base));
    g.line(0.3, 0.56, 0.7, 0.56, BLACK, 2);
    g.circle(0.5, 0.2, 0.18, g.rg(0.46, 0.17, 0, 0.2, ['#f0c8a0', '#a07050']));
    g.path((P) => { P.m(0.26, 0.2); P.q(0.26, 0.0, 0.5, 0.0); P.q(0.74, 0.0, 0.74, 0.2); P.z(); }, g.mv(0, 0.2, shade(c.base, -0.15)));
  },

  tablet(ctx, r, c) {
    const g = K(ctx, r, c, 1.35, 1.5);
    g.box(0.02, 0.04, 0.98, 0.96, 0.08, g.mv(0.04, 0.96, mix(BLACK, c.base, 0.35)));
    g.box(0.08, 0.1, 0.92, 0.9, 0.03, g.lg(0.08, 0.1, 0.92, 0.9, ['#1e3a2e', '#0c1814']), 1);
    g.clip((P) => { rrPath(ctx, g.X(0.08), g.Y(0.1), g.W(0.84), g.H(0.8), 2); });
    for (let i = 1; i < 6; i++) g.line(0.08 + i * 0.14, 0.1, 0.08 + i * 0.14, 0.9, alpha('#5ac88a', 0.2), 1);
    for (let i = 1; i < 4; i++) g.line(0.08, 0.1 + i * 0.2, 0.92, 0.1 + i * 0.2, alpha('#5ac88a', 0.2), 1);
    g.path((P) => { P.m(0.15, 0.7); P.q(0.35, 0.3, 0.55, 0.55); P.q(0.7, 0.75, 0.85, 0.3); }, null, false);
    ctx.strokeStyle = alpha('#7af0a0', 0.8); ctx.lineWidth = 1.4; ctx.stroke();
    g.circle(0.85, 0.3, 0.04, '#ff5040', false);
    g.poly([[0.08, 0.6], [0.6, 0.1], [0.75, 0.1], [0.08, 0.75]], alpha('#fff', 0.06), false);
    g.restore();
    g.circle(0.05, 0.5, 0.02, '#333', false);
  },

  laptop(ctx, r, c) {
    const g = K(ctx, r, c, 1.2, 1.4);
    g.box(0.14, 0.02, 0.86, 0.62, 0.03, g.mv(0.02, 0.62, mix(BLACK, c.base, 0.4)));
    g.box(0.18, 0.06, 0.82, 0.56, 0.01, g.lg(0.18, 0.06, 0.82, 0.56, ['#2a4a6a', '#0c1420']), 1);
    g.line(0.24, 0.16, 0.5, 0.16, alpha('#8ac8ff', 0.6), 1.4);
    [0.24, 0.3, 0.36, 0.42].forEach((y, i) => g.line(0.24, y, 0.6 + (i % 2) * 0.1, y, alpha('#8ac8ff', 0.35), 1));
    g.poly([[0.14, 0.62], [0.86, 0.62], [0.98, 0.9], [0.02, 0.9]], g.mv(0.62, 0.9, c.base));
    for (let j = 0; j < 3; j++) for (let i = 0; i < 10; i++) {
      const y = 0.65 + j * 0.06, sk = (y - 0.62) / 0.28 * 0.12;
      const x0 = 0.18 - sk + i * ((0.64 + sk * 2) / 10);
      g.box(x0, y, x0 + 0.05, y + 0.04, 0.005, alpha('#000', 0.55), false);
    }
    g.poly([[0.42, 0.84], [0.58, 0.84], [0.6, 0.89], [0.4, 0.89]], alpha('#000', 0.25), false);
    g.box(0.02, 0.9, 0.98, 0.95, 0.02, g.mv(0.9, 0.95, shade(c.base, -0.3)));
  },

  keyboard(ctx, r, c) {
    const g = KL(ctx, r, c, 2.8);
    g.box(0.0, 0.06, 1.0, 0.94, 0.05, g.mv(0.06, 0.94, mix(BLACK, c.base, 0.35)));
    const cols = 14, rows = 4;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = 0.03 + i * (0.94 / cols), y = 0.12 + j * 0.17;
      g.box(x, y, x + 0.94 / cols - 0.01, y + 0.13, 0.02, g.mv(y, y + 0.13, '#3c4044'), 0.8);
    }
    g.box(0.26, 0.8, 0.74, 0.9, 0.02, g.mv(0.8, 0.9, '#3c4044'), 0.8);
    g.box(0.03, 0.8, 0.22, 0.9, 0.02, g.mv(0.8, 0.9, '#3c4044'), 0.8);
    g.box(0.78, 0.8, 0.97, 0.9, 0.02, g.mv(0.8, 0.9, '#3c4044'), 0.8);
  },

  mouse_dev(ctx, r, c) {
    const g = K(ctx, r, c, 0.6, 0.75);
    g.tube((P) => { P.m(0.5, 0.1); P.q(0.5, -0.02, 0.86, 0.02); }, BLACK, g.M * 0.04);
    const body = (P) => { P.m(0.5, 0.08); P.b(0.92, 0.08, 0.96, 0.5, 0.9, 0.75); P.b(0.84, 0.98, 0.16, 0.98, 0.1, 0.75); P.b(0.04, 0.5, 0.08, 0.08, 0.5, 0.08); P.z(); };
    g.path(body, g.rg(0.4, 0.35, 0.05, 0.6, [shade(c.base, 0.35), c.base, shade(c.base, -0.5)]));
    g.line(0.5, 0.09, 0.5, 0.42, OUT, 1.2);
    g.path((P) => { P.m(0.08, 0.42); P.q(0.5, 0.5, 0.92, 0.42); }, null, 1);
    g.box(0.45, 0.16, 0.55, 0.32, 0.04, g.mh(0.45, 0.55, BLACK));
    g.circle(0.5, 0.72, 0.04, alpha(c.accent, 0.8), false);
    g.hl(0.22, 0.2, 0.18, 0.6, 0.35, 1.6);
  },

  flask(ctx, r, c) {
    const g = K(ctx, r, c, 0.8, 0.95);
    const body = (P) => { P.m(0.38, 0.04); P.l(0.62, 0.04); P.l(0.62, 0.34); P.l(0.96, 0.9); P.q(0.98, 0.98, 0.9, 0.98); P.l(0.1, 0.98); P.q(0.02, 0.98, 0.04, 0.9); P.l(0.38, 0.34); P.z(); };
    g.path(body, GLASS, false);
    liquidIn(g, body, 0.62, c.base);
    [[0.4, 0.8, 0.03], [0.55, 0.72, 0.02], [0.62, 0.86, 0.025]].forEach(([x, y, s]) => g.circle(x, y, s, alpha('#fff', 0.3), false));
    g.path(body, null);
    g.box(0.34, 0.0, 0.66, 0.06, 0.02, alpha('#d8eef5', 0.7), 1);
    [0.5, 0.6, 0.7].forEach((y) => g.line(0.44, y, 0.5, y, alpha('#fff', 0.6), 1));
    g.hl(0.44, 0.1, 0.44, 0.32, 0.6, 1.6);
  },

  bulb(ctx, r, c) {
    const g = K(ctx, r, c, 0.62, 0.75);
    const glassPath = (P) => { P.a(0.5, 0.32, 0.44, Math.PI * 0.72, Math.PI * 0.28); P.l(0.64, 0.72); P.l(0.36, 0.72); P.z(); };
    g.path(glassPath, g.rg(0.5, 0.36, 0.02, 0.5, ['rgba(255,245,200,0.9)', alpha(mix('#ffe080', c.base, 0.3), 0.5), 'rgba(200,220,230,0.3)']));
    g.path((P) => { P.m(0.44, 0.66); P.l(0.42, 0.36); P.m(0.56, 0.66); P.l(0.58, 0.36); }, null, false);
    ctx.strokeStyle = alpha('#555', 0.8); ctx.lineWidth = 1; ctx.stroke();
    g.path((P) => { P.m(0.42, 0.36); for (let i = 1; i <= 6; i++) P.l(0.42 + i * 0.027, i % 2 ? 0.32 : 0.36); }, null, false);
    ctx.strokeStyle = '#ffd040'; ctx.lineWidth = 1.5; ctx.stroke();
    g.box(0.34, 0.72, 0.66, 0.92, 0.02, g.mh(0.34, 0.66, METAL));
    for (let i = 0; i < 4; i++) g.line(0.34, 0.76 + i * 0.045, 0.66, 0.74 + i * 0.045, alpha('#000', 0.45), 1);
    g.box(0.42, 0.92, 0.58, 0.99, 0.02, BLACK, 1);
    g.tube((P) => { P.a(0.5, 0.32, 0.34, Math.PI * 1.1, Math.PI * 1.4); }, alpha('#fff', 0.6), g.M * 0.03, false);
  },

  bottle_misc(ctx, r, c) {
    const g = K(ctx, r, c, 0.7, 0.85);
    g.box(0.4, 0.0, 0.62, 0.1, 0.02, g.mh(0.4, 0.62, c.accent));
    g.path((P) => { P.m(0.1, 0.3); P.q(0.1, 0.18, 0.3, 0.16); P.l(0.42, 0.16); P.l(0.42, 0.08); P.l(0.6, 0.08); P.l(0.6, 0.16); P.l(0.86, 0.16); P.q(0.94, 0.18, 0.94, 0.3); P.l(0.94, 0.92); P.q(0.94, 0.98, 0.86, 0.98); P.l(0.18, 0.98); P.q(0.1, 0.98, 0.1, 0.92); P.z(); }, g.mh(0.1, 0.94, c.base));
    g.hole((P) => { rrPath(ctx, g.X(0.66), g.Y(0.22), g.W(0.2), g.H(0.14), g.M * 0.04); });
    g.poly([[0.5, 0.46], [0.7, 0.66], [0.5, 0.86], [0.3, 0.66]], '#e88a20', 1);
    g.text('!', 0.5, 0.67, 0.22, '#111');
    g.hl(0.2, 0.3, 0.2, 0.92, 0.35, 2);
  },

  tube(ctx, r, c) {
    const g = K(ctx, r, c, 1.1, 1.3);
    g.box(0.02, 0.86, 0.98, 0.96, 0.02, g.mv(0.86, 0.96, mix(WOOD, c.base, 0.3)));
    g.box(0.06, 0.42, 0.12, 0.88, 0, mix(WOOD, c.base, 0.3), 1);
    g.box(0.88, 0.42, 0.94, 0.88, 0, mix(WOOD, c.base, 0.3), 1);
    [[0.22, c.base, 0.4], [0.5, c.accent, 0.52], [0.78, mix(c.base, '#40c060', 0.5), 0.6]].forEach(([x, col, lv]) => {
      const t = (P) => { P.m(x - 0.07, 0.06); P.l(x + 0.07, 0.06); P.l(x + 0.07, 0.76); P.q(x + 0.07, 0.86, x, 0.86); P.q(x - 0.07, 0.86, x - 0.07, 0.76); P.z(); };
      g.path(t, GLASS, false);
      g.clip(t);
      g.box(x - 0.1, lv, x + 0.1, 0.9, 0, g.mh(x - 0.07, x + 0.07, col), false);
      g.restore();
      g.path(t, null);
      g.hl(x - 0.035, 0.1, x - 0.035, 0.78, 0.5, 1.4);
    });
    g.box(0.04, 0.36, 0.96, 0.46, 0.01, g.mv(0.36, 0.46, mix(WOOD, c.base, 0.3)));
  },

  powder(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.15);
    g.path((P) => { P.m(0.1, 0.94); P.q(0.3, 0.46, 0.55, 0.44); P.q(0.82, 0.48, 0.9, 0.94); P.z(); }, g.rg(0.5, 0.5, 0.05, 0.5, [shade(c.base, 0.3), c.base, shade(c.base, -0.4)]), false);
    g.dots(0.25, 0.6, 0.8, 0.9, 6, 3, alpha('#000', 0.25), 0.01);
    g.box(0.06, 0.14, 0.94, 0.96, 0.05, 'rgba(220,230,235,0.22)');
    g.box(0.06, 0.14, 0.94, 0.24, 0.02, alpha(c.accent, 0.9), 1);
    g.line(0.08, 0.19, 0.92, 0.19, alpha('#000', 0.35), 1);
    g.box(0.56, 0.3, 0.9, 0.42, 0.01, alpha(WHITE, 0.9), 0.8);
    g.line(0.6, 0.36, 0.84, 0.36, alpha('#000', 0.5), 1);
    g.hl(0.12, 0.3, 0.12, 0.9, 0.45, 1.6);
  },

  dish(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.15);
    g.box(0.24, 0.9, 0.72, 0.98, 0.02, g.mv(0.9, 0.98, STEEL));
    g.box(0.43, 0.6, 0.53, 0.92, 0, g.mh(0.43, 0.53, METAL));
    g.ell(0.42, 0.44, 0.36, 0.4, g.rg(0.36, 0.36, 0.05, 0.5, [shade(c.base, 0.45), c.base, shade(c.base, -0.45)]), true, -0.5);
    g.ell(0.42, 0.44, 0.28, 0.32, null, 0.8, -0.5);
    g.tube((P) => { P.m(0.5, 0.7); P.l(0.86, 0.28); }, METAL, g.M * 0.035);
    g.tube((P) => { P.m(0.3, 0.72); P.l(0.86, 0.28); }, METAL, g.M * 0.02);
    g.box(0.82, 0.16, 0.96, 0.32, 0.02, g.mv(0.16, 0.32, c.accent));
    g.circle(0.42, 0.44, 0.04, STEEL, 1);
  },

  clock(ctx, r, c) {
    const g = K(ctx, r, c, 0.85, 1.0);
    g.tube((P) => { P.m(0.3, 0.86); P.l(0.18, 0.98); }, c.base, g.M * 0.05);
    g.tube((P) => { P.m(0.7, 0.86); P.l(0.82, 0.98); }, c.base, g.M * 0.05);
    [0.2, 0.8].forEach((x) => g.path((P) => { P.a(x, 0.2, 0.15, Math.PI, 0); P.z(); }, g.rg(x - 0.04, 0.12, 0, 0.16, [shade(c.base, 0.5), c.base, shade(c.base, -0.4)])));
    g.line(0.5, 0.08, 0.5, 0.18, OUT, 2);
    g.circle(0.5, 0.07, 0.04, c.base, 1);
    g.circle(0.5, 0.56, 0.42, g.rg(0.42, 0.48, 0.05, 0.45, [shade(c.base, 0.4), c.base, shade(c.base, -0.5)]));
    g.circle(0.5, 0.56, 0.33, g.rg(0.48, 0.52, 0, 0.35, ['#f4f0e4', '#c8c0b0']));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.line(0.5 + (Math.cos(a) * 0.26 * g.M) / g.f.w, 0.56 + (Math.sin(a) * 0.26 * g.M) / g.f.h, 0.5 + (Math.cos(a) * 0.3 * g.M) / g.f.w, 0.56 + (Math.sin(a) * 0.3 * g.M) / g.f.h, '#222', i % 3 ? 1 : 2);
    }
    g.line(0.5, 0.56, 0.5, 0.36, '#111', 2);
    g.line(0.5, 0.56, 0.64, 0.62, '#111', 2.2);
    g.line(0.5, 0.56, 0.38, 0.72, RED, 1);
    g.circle(0.5, 0.56, 0.03, '#111', false);
  },

  map(ctx, r, c) {
    const g = K(ctx, r, c, 1.2, 1.5);
    const pc = mix('#d8cca0', c.base, 0.2);
    const panels = [];
    for (let i = 0; i < 4; i++) {
      const x0 = 0.02 + i * 0.24, x1 = x0 + 0.24;
      const up = i % 2 === 0;
      panels.push([[x0, up ? 0.06 : 0.12], [x1, up ? 0.12 : 0.06], [x1, up ? 0.88 : 0.94], [x0, up ? 0.94 : 0.88]]);
    }
    panels.forEach((p, i) => g.poly(p, i % 2 ? shade(pc, -0.12) : pc));
    g.path((P) => { P.m(0.1, 0.3); P.q(0.3, 0.2, 0.5, 0.35); P.q(0.7, 0.5, 0.92, 0.3); }, null, false);
    ctx.strokeStyle = alpha('#5a7a3a', 0.7); ctx.lineWidth = 1; ctx.stroke();
    g.path((P) => { P.m(0.08, 0.62); P.q(0.3, 0.5, 0.45, 0.66); P.q(0.6, 0.8, 0.9, 0.7); }, null, false);
    ctx.strokeStyle = alpha('#2a5a9a', 0.85); ctx.lineWidth = 2; ctx.stroke();
    g.ell(0.7, 0.46, 0.1, 0.08, null, false);
    ctx.strokeStyle = alpha('#7a5a2a', 0.6); ctx.lineWidth = 1; ctx.stroke();
    g.dash([3, 2]);
    g.path((P) => { P.m(0.14, 0.82); P.q(0.4, 0.4, 0.74, 0.22); }, null, false);
    ctx.strokeStyle = RED; ctx.lineWidth = 1.5; ctx.stroke();
    g.dash([]);
    g.line(0.7, 0.17, 0.78, 0.27, RED, 2.2);
    g.line(0.78, 0.17, 0.7, 0.27, RED, 2.2);
  },

  photo(ctx, r, c) {
    const g = K(ctx, r, c, 0.82, 0.92);
    g.save(); g.rotAt(0.5, 0.5, -0.12);
    g.box(0.1, 0.06, 0.9, 0.94, 0.01, g.lg(0, 0, 1, 1, ['#f2eee4', '#c8c2b4']));
    g.box(0.16, 0.12, 0.84, 0.7, 0, g.lg(0, 0.12, 0, 0.7, [mix('#5a6a7a', c.base, 0.3), '#c8a070']), 1);
    g.circle(0.68, 0.26, 0.06, alpha('#fff0c0', 0.9), false);
    g.poly([[0.16, 0.7], [0.16, 0.52], [0.34, 0.36], [0.5, 0.54], [0.62, 0.44], [0.84, 0.6], [0.84, 0.7]], '#2a3028', false);
    g.circle(0.42, 0.5, 0.04, '#141614', false);
    g.box(0.39, 0.53, 0.45, 0.7, 0.01, '#141614', false);
    g.path((P) => { P.m(0.24, 0.82); P.q(0.36, 0.76, 0.48, 0.82); P.q(0.6, 0.88, 0.7, 0.8); }, null, false);
    ctx.strokeStyle = alpha('#1a2a5a', 0.7); ctx.lineWidth = 1.2; ctx.stroke();
    g.box(0.38, 0.0, 0.62, 0.1, 0, 'rgba(230,220,170,0.55)', false);
    g.restore();
  },

  badge(ctx, r, c, item) {
    const g = K(ctx, r, c, 0.85, 1.0);
    const bc = c.base;
    const shield = (s) => (P) => {
      const k = (x, y) => [0.5 + (x - 0.5) * s, 0.5 + (y - 0.5) * s];
      P.m(...k(0.5, 0.02)); P.l(...k(0.92, 0.14)); P.q(...k(0.94, 0.6), ...k(0.5, 0.98)); P.q(...k(0.06, 0.6), ...k(0.08, 0.14)); P.z();
    };
    g.path(shield(1), g.lg(0, 0, 1, 1, [shade(bc, 0.5), bc, shade(bc, -0.5)]));
    g.path(shield(0.82), null, 1.2);
    g.star(0.5, 0.42, 0.22, 0.09, 5, g.lg(0.3, 0.2, 0.7, 0.6, [shade(c.accent, 0.5), c.accent, shade(c.accent, -0.4)]), 1);
    g.box(0.18, 0.66, 0.82, 0.8, 0.01, shade(bc, -0.4), 1);
    g.text(item.short || 'SEC', 0.5, 0.73, 0.1, alpha(WHITE, 0.9));
    g.glint(0.3, 0.2, 0.06);
  },

  dogtag(ctx, r, c) {
    const g = K(ctx, r, c, 0.9, 1.1);
    g.dash([0.1, Math.max(2.5, g.M * 0.05)]);
    g.path((P) => { P.m(0.4, 0.36); P.q(0.1, -0.1, 0.5, 0.02); P.q(0.9, 0.08, 0.62, 0.32); }, null, false);
    ctx.lineCap = 'round'; ctx.strokeStyle = METAL; ctx.lineWidth = Math.max(2, g.M * 0.035); ctx.stroke();
    g.dash([]);
    const tag = (x1, y1, x2, y2, ang) => {
      g.save(); g.rotAt((x1 + x2) / 2, (y1 + y2) / 2, ang);
      g.box(x1, y1, x2, y2, 0.12, g.lg(x1, y1, x2, y2, [shade(METAL, 0.45), METAL, shade(METAL, -0.4)]));
      g.box(x1 + 0.04, y1 + 0.04, x2 - 0.04, y2 - 0.04, 0.09, null, 0.8);
      g.hole((P) => { P.a(x1 + 0.1, y1 + 0.1, 0.035, 0, TAU); });
      [0.3, 0.42, 0.54, 0.66].forEach((t) => g.line(x1 + 0.1, y1 + (y2 - y1) * t, x2 - 0.1, y1 + (y2 - y1) * t, alpha('#000', 0.45), 1.2));
      g.restore();
    };
    tag(0.34, 0.28, 0.84, 0.88, 0.22);
    tag(0.14, 0.34, 0.64, 0.96, -0.12);
  },

  vinyl(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.2);
    g.circle(0.62, 0.5, 0.42, g.rg(0.58, 0.44, 0.05, 0.42, ['#3a3a3e', '#121214']));
    [0.36, 0.3, 0.24].forEach((rr) => g.circle(0.62, 0.5, rr, null, false) || (ctx.strokeStyle = alpha('#fff', 0.08), ctx.lineWidth = 1, ctx.stroke()));
    g.circle(0.62, 0.5, 0.14, c.accent, 1);
    g.circle(0.62, 0.5, 0.025, BLACK, false);
    g.box(0.02, 0.06, 0.6, 0.94, 0.01, g.lg(0, 0, 1, 1, [shade(c.base, 0.25), c.base, shade(c.base, -0.4)]));
    g.circle(0.31, 0.42, 0.2, alpha(c.accent, 0.5), false);
    [0.7, 0.76, 0.82].forEach((y) => g.line(0.08, y, 0.54, y, alpha(c.light, 0.45), 1.5));
    g.text('LP', 0.31, 0.42, 0.16, alpha(WHITE, 0.85));
  },

  candle(ctx, r, c) {
    const g = K(ctx, r, c, 0.42, 0.55);
    g.circle(0.5, 0.14, 0.4, g.rg(0.5, 0.14, 0, 0.42, ['rgba(255,200,80,0.45)', 'rgba(255,160,40,0)']), false);
    g.ell(0.5, 0.92, 0.48, 0.06, g.mv(0.86, 0.98, BRASS));
    const wax = mix('#efe4c8', c.base, 0.3);
    g.box(0.22, 0.3, 0.78, 0.92, 0.02, g.mh(0.22, 0.78, wax));
    g.path((P) => { P.m(0.22, 0.32); P.l(0.22, 0.46); P.q(0.26, 0.5, 0.28, 0.44); P.l(0.3, 0.36); P.l(0.6, 0.36); P.l(0.62, 0.52); P.q(0.66, 0.56, 0.68, 0.5); P.l(0.7, 0.36); P.l(0.78, 0.32); P.z(); }, shade(wax, 0.15), 1);
    g.ell(0.5, 0.31, 0.28, 0.03, shade(wax, 0.1), 1);
    g.line(0.5, 0.31, 0.5, 0.24, '#222', 1.4);
    g.path((P) => { P.m(0.5, 0.26); P.q(0.36, 0.18, 0.5, 0.02); P.q(0.64, 0.18, 0.5, 0.26); P.z(); }, g.rg(0.5, 0.2, 0, 0.12, ['#ffffff', '#ffd040', 'rgba(255,100,20,0.7)']), false);
  },

  dice(ctx, r, c) {
    const g = K(ctx, r, c, 1.2, 1.4);
    const dc = c.base;
    const pc = lum(dc) > 0.5 ? '#151515' : WHITE;
    g.box(0.04, 0.32, 0.5, 0.92, 0.08, g.lg(0, 0.32, 0.5, 0.92, [shade(dc, 0.4), dc, shade(dc, -0.35)]));
    pips(g, 0.27, 0.62, 0.12, 5, pc);
    g.save(); g.rotAt(0.73, 0.4, 0.35);
    g.box(0.52, 0.12, 0.94, 0.66, 0.08, g.lg(0.5, 0.12, 0.94, 0.66, [shade(dc, 0.4), dc, shade(dc, -0.35)]));
    pips(g, 0.73, 0.39, 0.11, 3, pc);
    g.restore();
  },

  crown(ctx, r, c) {
    const g = K(ctx, r, c, 1.1, 1.3);
    const gc = mix(GOLD, c.base, 0.3);
    g.poly([[0.08, 0.66], [0.04, 0.22], [0.28, 0.46], [0.5, 0.1], [0.72, 0.46], [0.96, 0.22], [0.92, 0.66]], g.lg(0, 0.1, 0, 0.66, [shade(gc, 0.45), gc, shade(gc, -0.3)]));
    [[0.04, 0.2], [0.5, 0.08], [0.96, 0.2]].forEach(([x, y]) => g.circle(x, y, 0.05, g.rg(x, y, 0, 0.06, [shade(gc, 0.6), gc]), 1));
    g.box(0.06, 0.62, 0.94, 0.92, 0.03, g.mv(0.62, 0.92, gc));
    g.line(0.08, 0.68, 0.92, 0.68, alpha('#000', 0.3), 1);
    g.line(0.08, 0.86, 0.92, 0.86, alpha('#000', 0.3), 1);
    [[0.22, '#c02838'], [0.5, c.accent], [0.78, '#2a8ac0']].forEach(([x, col]) => g.ell(x, 0.77, 0.06, 0.07, g.rg(x - 0.01, 0.75, 0, 0.07, [shade(col, 0.5), col, shade(col, -0.4)]), 1));
    g.poly([[0.5, 0.36], [0.56, 0.46], [0.5, 0.56], [0.44, 0.46]], g.lg(0.44, 0.36, 0.56, 0.56, ['#ffffff', '#6ac8e8']), 1);
    g.glint(0.42, 0.2, 0.06);
  },

  vase(ctx, r, c) {
    const g = K(ctx, r, c, 0.55, 0.7);
    const body = (P) => { P.m(0.36, 0.04); P.l(0.64, 0.04); P.l(0.62, 0.12); P.q(0.6, 0.2, 0.7, 0.26); P.q(0.98, 0.42, 0.86, 0.72); P.q(0.76, 0.92, 0.62, 0.98); P.l(0.38, 0.98); P.q(0.24, 0.92, 0.14, 0.72); P.q(0.02, 0.42, 0.3, 0.26); P.q(0.4, 0.2, 0.38, 0.12); P.z(); };
    g.path(body, g.rg(0.36, 0.42, 0.05, 0.6, [shade(c.base, 0.4), c.base, shade(c.base, -0.5)]));
    g.clip(body);
    g.box(0, 0.4, 1, 0.48, 0, alpha(c.accent, 0.85), false);
    g.path((P) => { P.m(0, 0.6); for (let i = 1; i <= 10; i++) P.l(i * 0.1, i % 2 ? 0.55 : 0.6); }, null, false);
    ctx.strokeStyle = alpha(c.accent, 0.85); ctx.lineWidth = 1.5; ctx.stroke();
    g.box(0, 0.78, 1, 0.82, 0, alpha(c.accent, 0.7), false);
    g.restore();
    g.path(body, null);
    g.box(0.32, 0.0, 0.68, 0.06, 0.02, g.mv(0, 0.06, shade(c.base, 0.1)));
    g.hl(0.26, 0.36, 0.22, 0.7, 0.35, 2);
  },

  ingot(ctx, r, c) {
    const g = K(ctx, r, c, 1.4, 1.8);
    const ic = c.base;
    g.poly([[0.04, 0.9], [0.76, 0.9], [0.68, 0.42], [0.16, 0.42]], g.mv(0.42, 0.9, ic));
    g.poly([[0.76, 0.9], [0.96, 0.74], [0.86, 0.3], [0.68, 0.42]], g.mv(0.3, 0.9, shade(ic, -0.3)));
    g.poly([[0.16, 0.42], [0.68, 0.42], [0.86, 0.3], [0.36, 0.3]], g.lg(0, 0.3, 0, 0.42, [shade(ic, 0.55), shade(ic, 0.2)]));
    g.box(0.24, 0.52, 0.56, 0.8, 0.02, null, 1);
    g.text('999.9', 0.4, 0.66, 0.15, alpha('#000', 0.45));
    g.hl(0.2, 0.44, 0.64, 0.44, 0.55);
    g.glint(0.34, 0.33, 0.07);
  },

  crystal(ctx, r, c) {
    const g = K(ctx, r, c, 0.85, 1.0);
    g.ell(0.5, 0.94, 0.46, 0.07, g.mv(0.87, 1, '#3a3836'));
    const shard = (x, y, w, h, ang) => {
      ctx.save();
      ctx.translate(g.X(x), g.Y(y));
      ctx.rotate(ang);
      const W = w * g.M, H = h * g.M;
      ctx.beginPath();
      ctx.moveTo(-W / 2, 0); ctx.lineTo(-W / 2, -H * 0.75); ctx.lineTo(0, -H); ctx.lineTo(W / 2, -H * 0.75); ctx.lineTo(W / 2, 0); ctx.closePath();
      const gr = ctx.createLinearGradient(-W / 2, -H, W / 2, 0);
      gr.addColorStop(0, alpha(shade(c.base, 0.6), 0.95));
      gr.addColorStop(0.5, alpha(c.base, 0.9));
      gr.addColorStop(1, alpha(shade(c.base, -0.5), 0.95));
      g.fs(gr);
      ctx.beginPath();
      ctx.moveTo(0, -H); ctx.lineTo(W * 0.1, 0); ctx.lineTo(W / 2, 0); ctx.lineTo(W / 2, -H * 0.75); ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-W * 0.3, -H * 0.1); ctx.lineTo(-W * 0.3, -H * 0.7);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    };
    shard(0.16, 0.96, 0.14, 0.38, -0.8);
    shard(0.84, 0.96, 0.14, 0.42, 0.75);
    shard(0.3, 0.95, 0.2, 0.64, -0.38);
    shard(0.7, 0.95, 0.2, 0.68, 0.34);
    shard(0.5, 0.95, 0.28, 0.9, 0);
    g.glint(0.44, 0.2, 0.08);
  },

  engine(ctx, r, c) {
    const g = K(ctx, r, c, 1.25, 1.5);
    g.tube((P) => { P.m(0.12, 0.5); P.q(0.0, 0.5, 0.02, 0.8); }, METAL, g.M * 0.07);
    g.box(0.16, 0.84, 0.72, 0.96, 0.02, g.mv(0.84, 0.96, shade(c.base, -0.35)));
    g.box(0.1, 0.34, 0.78, 0.86, 0.04, g.mv(0.34, 0.86, c.base));
    g.box(0.16, 0.1, 0.72, 0.36, 0.02, g.mv(0.1, 0.36, shade(c.base, 0.1)));
    for (let i = 0; i < 6; i++) g.line(0.17, 0.14 + i * 0.038, 0.71, 0.14 + i * 0.038, alpha('#000', 0.45), 1.3);
    g.box(0.4, 0.0, 0.48, 0.12, 0.01, g.mh(0.4, 0.48, WHITE));
    g.tube((P) => { P.m(0.44, 0.02); P.q(0.6, -0.04, 0.66, 0.08); }, BLACK, g.M * 0.025);
    [[0.16, 0.42], [0.72, 0.42], [0.16, 0.78], [0.72, 0.78], [0.44, 0.42]].forEach(([x, y]) => g.rivet(x, y, 0.03));
    g.circle(0.84, 0.6, 0.24, g.rg(0.8, 0.55, 0.02, 0.26, [shade(METAL, 0.3), STEEL]));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      g.line(0.84, 0.6, 0.84 + (Math.cos(a) * 0.18 * g.M) / g.f.w, 0.6 + (Math.sin(a) * 0.18 * g.M) / g.f.h, BLACK, 2);
    }
    g.circle(0.84, 0.6, 0.06, METAL, 1);
    g.box(0.2, 0.5, 0.66, 0.62, 0.01, alpha('#000', 0.2), false);
  },

  servo(ctx, r, c, item) {
    const g = K(ctx, r, c, 1.3, 1.6);
    [['#6a3a1a', 0.0], [RED, 0.035], ['#e8a020', 0.07]].forEach(([col, o]) => g.tube((P) => { P.m(0.86, 0.8 + o); P.q(0.98, 0.82 + o, 0.96, 0.98); }, col, g.M * 0.03));
    g.box(0.0, 0.42, 1.0, 0.54, 0.02, g.mv(0.42, 0.54, shade(c.base, -0.1)));
    g.hole((P) => { P.a(0.05, 0.48, 0.035, 0, TAU); });
    g.hole((P) => { P.a(0.95, 0.48, 0.035, 0, TAU); });
    g.box(0.12, 0.24, 0.88, 0.92, 0.03, g.mv(0.24, 0.92, c.base));
    g.box(0.18, 0.6, 0.82, 0.84, 0.01, alpha(WHITE, 0.85), 1);
    g.text(item.short || 'SERVO', 0.5, 0.72, 0.13, '#222');
    g.box(0.26, 0.14, 0.38, 0.25, 0.01, g.mh(0.26, 0.38, METAL));
    g.box(0.06, 0.06, 0.58, 0.15, 0.04, g.mv(0.06, 0.15, WHITE));
    [0.12, 0.2, 0.44, 0.52].forEach((x) => g.circle(x, 0.105, 0.012, '#555', false));
  },

  lens(ctx, r, c) {
    const g = K(ctx, r, c, 0.9, 1.1);
    g.ell(0.5, 0.9, 0.34, 0.08, g.mv(0.82, 0.98, METAL));
    g.box(0.16, 0.3, 0.84, 0.9, 0, g.mh(0.16, 0.84, mix(BLACK, c.base, 0.25)), false);
    g.line(0.16, 0.3, 0.16, 0.9, OUT, g.LW);
    g.line(0.84, 0.3, 0.84, 0.9, OUT, g.LW);
    for (let i = 0; i < 12; i++) g.line(0.19 + i * 0.056, 0.5, 0.19 + i * 0.056, 0.7, alpha('#000', 0.55), 1.4);
    g.line(0.16, 0.76, 0.84, 0.76, alpha(RED, 0.9), 1.5);
    g.text('50mm', 0.5, 0.83, 0.09, alpha(WHITE, 0.7));
    g.ell(0.5, 0.3, 0.36, 0.14, g.lg(0.14, 0.2, 0.86, 0.4, [METAL, STEEL, METAL]));
    g.ell(0.5, 0.3, 0.27, 0.1, g.rg(0.44, 0.27, 0, 0.3, ['#c8b0ff', mix('#4a2a7a', c.accent, 0.3), '#0a0814']), 1);
    g.ell(0.42, 0.27, 0.06, 0.025, alpha('#fff', 0.6), false);
    g.ell(0.58, 0.33, 0.04, 0.015, alpha('#a0ffd0', 0.45), false);
  },

  plate(ctx, r, c, item) {
    const g = K(ctx, r, c, 0.72, 0.85);
    const pts = [[0.22, 0.02], [0.78, 0.02], [0.96, 0.2], [0.96, 0.92], [0.9, 0.98], [0.1, 0.98], [0.04, 0.92], [0.04, 0.2]];
    g.poly(pts, g.lg(0, 0, 1, 1, [shade(c.base, 0.3), c.base, shade(c.base, -0.5)]));
    g.poly(pts.map(([x, y]) => [0.5 + (x - 0.5) * 0.86, 0.5 + (y - 0.5) * 0.9]), null, 1);
    g.box(0.24, 0.56, 0.76, 0.8, 0.01, PAPER, 1);
    g.text(item.short || 'III+', 0.5, 0.64, 0.12, '#222');
    g.line(0.3, 0.73, 0.7, 0.73, alpha('#000', 0.45), 1);
    g.hl(0.24, 0.07, 0.76, 0.07, 0.35, 1.6);
  },

  filter(ctx, r, c) {
    const g = K(ctx, r, c, 0.72, 0.85);
    g.box(0.34, 0.0, 0.66, 0.14, 0.01, g.mh(0.34, 0.66, METAL));
    for (let i = 0; i < 3; i++) g.line(0.34, 0.03 + i * 0.035, 0.66, 0.05 + i * 0.035, alpha('#000', 0.45), 1);
    g.box(0.12, 0.12, 0.88, 0.2, 0.04, g.mh(0.12, 0.88, BLACK));
    g.box(0.1, 0.18, 0.9, 0.96, 0.08, g.mh(0.1, 0.9, c.base));
    [0.28, 0.32, 0.84, 0.88].forEach((y) => g.line(0.11, y, 0.89, y, alpha('#000', 0.4), 1.2));
    g.box(0.1, 0.42, 0.9, 0.7, 0, g.mh(0.1, 0.9, '#d8b830'), 1);
    g.text('A2B2', 0.5, 0.56, 0.15, '#1a1a1a');
    g.hl(0.24, 0.22, 0.24, 0.92, 0.3, 2);
  },

  glove(ctx, r, c) {
    const g = K(ctx, r, c, 0.75, 0.9);
    const gc = c.base;
    [[0.24, 0.12], [0.39, 0.04], [0.54, 0.06], [0.69, 0.16]].forEach(([x, y]) => g.box(x, y, x + 0.14, 0.5, 0.07, g.mh(x, x + 0.14, gc)));
    g.save(); g.rotAt(0.2, 0.6, -0.7);
    g.box(0.08, 0.5, 0.24, 0.78, 0.07, g.mh(0.08, 0.24, gc));
    g.restore();
    g.box(0.2, 0.38, 0.86, 0.84, 0.1, g.mv(0.38, 0.84, gc));
    g.box(0.24, 0.36, 0.83, 0.5, 0.06, g.mv(0.36, 0.5, shade(gc, -0.4)));
    [0.38, 0.53, 0.68].forEach((x) => g.line(x, 0.37, x, 0.49, alpha('#000', 0.5), 1));
    g.box(0.24, 0.8, 0.84, 0.98, 0.04, g.mv(0.8, 0.98, shade(gc, -0.3)));
    g.box(0.5, 0.78, 0.86, 0.9, 0.02, g.mv(0.78, 0.9, BLACK));
  },

  boot(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.15);
    const bc = c.base;
    g.path((P) => { P.m(0.16, 0.02); P.l(0.56, 0.02); P.l(0.58, 0.48); P.q(0.9, 0.56, 0.96, 0.7); P.l(0.97, 0.86); P.l(0.06, 0.86); P.l(0.1, 0.5); P.z(); }, g.lg(0, 0, 1, 1, [shade(bc, 0.25), bc, shade(bc, -0.5)]));
    g.path((P) => { P.m(0.62, 0.5); P.q(0.9, 0.56, 0.96, 0.7); P.l(0.97, 0.86); P.l(0.66, 0.86); P.z(); }, alpha('#000', 0.25), 1);
    g.box(0.06, 0.6, 0.3, 0.86, 0.04, alpha('#000', 0.2), 1);
    for (let i = 0; i < 5; i++) {
      const y = 0.1 + i * 0.08;
      g.line(0.5, y, 0.6, y + 0.06, '#c8b890', 1.4);
      g.line(0.5, y + 0.06, 0.6, y, '#c8b890', 1.4);
    }
    g.box(0.18, 0.0, 0.26, 0.08, 0.01, BLACK, 1);
    g.box(0.04, 0.84, 0.99, 0.98, 0.04, g.mv(0.84, 0.98, BLACK));
    for (let i = 0; i < 10; i++) g.line(0.08 + i * 0.09, 0.92, 0.12 + i * 0.09, 0.98, alpha('#555', 0.8), 1);
  },

  helmet_part(ctx, r, c) {
    const g = K(ctx, r, c, 1.2, 1.4);
    g.path((P) => { P.m(0.06, 0.18); P.q(0.5, 0.0, 0.94, 0.18); P.l(0.9, 0.76); P.q(0.5, 1.0, 0.1, 0.76); P.z(); }, g.lg(0, 0.1, 0.4, 1, [alpha(shade(c.base, 0.3), 0.55), alpha(c.base, 0.45), alpha(shade(c.base, -0.4), 0.7)]));
    g.tube((P) => { P.m(0.06, 0.2); P.q(0.5, 0.02, 0.94, 0.2); }, BLACK, g.M * 0.1);
    g.line(0.2, 0.36, 0.34, 0.7, alpha('#fff', 0.35), 2);
    g.line(0.28, 0.32, 0.4, 0.62, alpha('#fff', 0.2), 1.2);
    g.rivet(0.08, 0.2, 0.05); g.rivet(0.92, 0.2, 0.05); g.rivet(0.5, 0.11, 0.04);
  },

  paper(ctx, r, c) {
    const g = K(ctx, r, c, 0.85, 1.05);
    g.poly([[0.06, 0.26], [0.36, 0.42], [0.36, 0.94], [0.06, 0.78]], shade(WHITE, -0.15));
    for (let i = 1; i < 8; i++) g.line(0.06, 0.26 + i * 0.065, 0.36, 0.42 + i * 0.065, alpha('#000', 0.15), 1);
    g.poly([[0.36, 0.42], [0.96, 0.24], [0.96, 0.76], [0.36, 0.94]], shade(WHITE, -0.3));
    g.poly([[0.36, 0.58], [0.96, 0.4], [0.96, 0.6], [0.36, 0.78]], g.lg(0.36, 0, 0.96, 0, [c.base, shade(c.base, -0.3)]), 1);
    g.poly([[0.06, 0.26], [0.66, 0.08], [0.96, 0.24], [0.36, 0.42]], g.lg(0.06, 0.08, 0.96, 0.42, [WHITE, shade(WHITE, -0.1)]));
    g.save(); g.rotAt(0.5, 0.24, 0.12);
    g.poly([[0.14, 0.24], [0.62, 0.1], [0.86, 0.22], [0.38, 0.36]], alpha(WHITE, 0.95), 0.8);
    g.restore();
  },

  money(ctx, r, c) {
    const g = K(ctx, r, c, 1, 1.2);
    const bc = mix('#5a7a4a', c.base, 0.4);
    g.poly([[0.86, 0.3], [0.98, 0.34], [0.94, 0.5], [0.86, 0.48]], shade(bc, 0.15));
    g.box(0.14, 0.3, 0.86, 0.72, 0, g.cy(0.3, 0.72, bc), false);
    g.line(0.14, 0.3, 0.86, 0.3, OUT, g.LW);
    g.line(0.14, 0.72, 0.86, 0.72, OUT, g.LW);
    g.line(0.86, 0.3, 0.86, 0.72, OUT, g.LW);
    [0.38, 0.48, 0.58].forEach((y) => g.line(0.24, y, 0.82, y, alpha('#102010', 0.25), 1));
    g.text('$', 0.7, 0.5, 0.22, alpha('#102010', 0.5));
    g.ell(0.14, 0.51, 0.1, 0.21, g.rg(0.12, 0.48, 0, 0.22, [shade(bc, 0.35), shade(bc, -0.1)]));
    [0.14, 0.09, 0.05].forEach((s) => g.ell(0.14, 0.51, s * 0.48, s, null, 0.8));
    g.box(0.46, 0.27, 0.54, 0.75, 0.02, g.mh(0.46, 0.54, c.accent));
  },

  // ======================= FALLBACK =======================
  fallback(ctx, r, c, item) {
    const g = K(ctx, r, c, 0.8, 1.6);
    g.box(0.04, 0.08, 0.96, 0.92, 0.06, g.mv(0.08, 0.92, c.base));
    g.box(0.1, 0.14, 0.9, 0.86, 0.04, null, 1);
    g.line(0.1, 0.14, 0.9, 0.86, alpha('#000', 0.18), 2);
    g.line(0.9, 0.14, 0.1, 0.86, alpha('#000', 0.18), 2);
    g.box(0.2, 0.36, 0.8, 0.64, 0.02, PAPER, 1);
    const label = item.short || (item.name ? String(item.name).slice(0, 5) : '?');
    g.text(label, 0.5, 0.5, Math.min(0.2, 0.9 / Math.max(2, String(label).length)), '#1c1c1c');
    [[0.1, 0.14], [0.9, 0.14], [0.1, 0.86], [0.9, 0.86]].forEach(([x, y]) => g.rivet(x, y, 0.03));
    g.hl(0.08, 0.11, 0.92, 0.11, 0.3);
  },
};

// ---------------------------------------------------------------- render
const GLOW = new Set(['core', 'crystal', 'gem', 'crown', 'gold', 'ingot', 'ring', 'statue', 'egg', 'vial', 'coin', 'chain']);

function resolveKey(item) {
  if (item.cat === 'weapon') {
    const wc = item.weapon && item.weapon.class;
    if (wc && DRAWERS[wc]) return wc;
  }
  if (item.icon) return DRAWERS[item.icon] ? item.icon : 'fallback';
  if (item.sub && DRAWERS[item.sub]) return item.sub;
  return CAT_ICON[item.cat] || 'fallback';
}

function makeCanvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w));
  cv.height = Math.max(1, Math.ceil(h));
  return cv;
}

function renderShape(ctx, key, r, c, item) {
  const fn = DRAWERS[key] || DRAWERS.fallback;
  ctx.save();
  try {
    fn(ctx, r, c, item);
  } catch (e) {
    ctx.restore();
    ctx.save();
    try { ctx.setLineDash([]); } catch (_) { /* ignore */ }
    DRAWERS.fallback(ctx, r, c, item);
  }
  ctx.restore();
}

export function drawItemIcon(ctx, item, x, y, w, h) {
  item = item || {};
  if (!ctx || !(w > 0 && h > 0)) return;
  const key = resolveKey(item);
  const c = palette(item);
  const m = Math.min(w, h);
  const pad = Math.max(1, m * 0.1);
  const glow = GLOW.has(key) && c.rarity >= 4 ? 0.55 : c.rarity >= 5 ? 0.28 : 0;
  ctx.save();
  if (glow > 0) {
    const cx = x + w / 2, cy = y + h / 2, R = Math.max(w, h) * 0.55;
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, alpha(c.light, glow));
    gr.addColorStop(0.6, alpha(c.base, glow * 0.35));
    gr.addColorStop(1, alpha(c.base, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
  }
  const off = makeCanvas(w, h);
  const octx = off && off.getContext ? off.getContext('2d') : null;
  if (octx) {
    renderShape(octx, key, { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 }, c, item);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = Math.max(2, m * 0.07);
    ctx.shadowOffsetX = Math.max(1, m * 0.035);
    ctx.shadowOffsetY = Math.max(1, m * 0.035);
    ctx.drawImage(off, x, y);
  } else {
    renderShape(ctx, key, { x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2 }, c, item);
  }
  ctx.restore();
}

const ICON_CACHE = new Map();

export function getItemIcon(item, rotated = false) {
  item = item || {};
  const cacheKey = String(item.id != null ? item.id : 'unknown') + (rotated ? '_r' : '');
  const hit = ICON_CACHE.get(cacheKey);
  if (hit !== undefined) return hit;
  const gw = Math.max(1, item.w | 0 || 1);
  const gh = Math.max(1, item.h | 0 || 1);
  const W = gw * ICON_CELL, H = gh * ICON_CELL;
  const cw = rotated ? H : W, ch = rotated ? W : H;
  const cv = makeCanvas(cw, ch);
  if (!cv) return '';
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  if (rotated) {
    // 90 degrees clockwise: (x, y) -> (cw - y, x)
    ctx.translate(cw, 0);
    ctx.rotate(Math.PI / 2);
  }
  drawItemIcon(ctx, item, 0, 0, W, H);
  let url = '';
  try { url = cv.toDataURL('image/png'); } catch (_) { url = ''; }
  ICON_CACHE.set(cacheKey, url);
  return url;
}

export { DRAWERS as ICON_DRAWERS };

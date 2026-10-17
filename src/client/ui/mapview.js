// マップの俯瞰図（出撃画面・レイド内マップ）
import { buildMap } from '../../shared/map.js';

let cachedMap = null;
let cachedImg = null;
export function getMap() { return cachedMap || (cachedMap = buildMap(1337)); }

const MAT_COL = {
  cliff: '#3a3a34', rock: '#5a5a54', concrete: '#7a7a72', brick: '#8a5a4a', plaster: '#a8a090', metal: '#6a7078', metal_wall: '#6a7a8a',
  container: '#8a4a3a', car: '#5a5a6a', roof: '#4a4a48', hesco: '#8a7a5a', sandbag: '#9a8a6a', wood: '#7a5a3a', wood_wall: '#8a6a4a',
  fence: '#55595c', tree: null, invisible: null, arc_metal: '#2a8aa0', tarp: '#56603f', crate: '#8a6a3a', stair: '#7a7a72',
};

// 1px = 1m のベース画像を生成
function baseImage() {
  if (cachedImg) return cachedImg;
  const M = getMap();
  const S = M.half * 2;
  const cv = document.createElement('canvas');
  cv.width = S * 2; cv.height = S * 2;
  const g = cv.getContext('2d');
  g.scale(2, 2);
  g.fillStyle = '#2c3424'; g.fillRect(0, 0, S, S);
  // 地面のノイズ
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 30},${50 + Math.random() * 30},${30 + Math.random() * 15},.35)`;
    g.fillRect(Math.random() * S, Math.random() * S, 3 + Math.random() * 6, 3 + Math.random() * 6);
  }
  // 海
  g.fillStyle = '#1a3a4a'; g.fillRect(0, M.water.z + M.half, S, S);
  // 道路
  g.strokeStyle = '#3c3e3c'; g.lineCap = 'square';
  for (const r of M.roads) { g.lineWidth = r.w; g.beginPath(); g.moveTo(r.x0 + M.half, r.z0 + M.half); g.lineTo(r.x1 + M.half, r.z1 + M.half); g.stroke(); }
  // 木
  g.fillStyle = 'rgba(30,50,26,.9)';
  for (const t of M.trees) { g.beginPath(); g.arc(t.x + M.half, t.z + M.half, 2.4 * t.s, 0, Math.PI * 2); g.fill(); }
  // ボックス（低い順）
  const boxes = [...M.boxes].filter((b) => MAT_COL[b.mat] !== null && !b.hidden).sort((a, b) => a.max[1] - b.max[1]);
  for (const b of boxes) {
    if (b.max[1] < 0.3) continue;
    const col = b.color && ['container', 'car', 'tarp'].includes(b.mat) ? b.color : MAT_COL[b.mat] || '#6a6a6a';
    g.fillStyle = col;
    g.globalAlpha = b.mat === 'roof' ? 0.95 : 1;
    g.fillRect(b.min[0] + M.half, b.min[2] + M.half, b.max[0] - b.min[0], b.max[2] - b.min[2]);
  }
  g.globalAlpha = 1;
  cachedImg = cv;
  return cv;
}

// 高価な戦利品が出やすい場所（コンテナ種別と施錠された部屋）
export const HOTSPOT_TYPES = {
  safe: { label: '金庫', color: '#f0c040' },
  lab_case: { label: '研究用ケース', color: '#40d0f0' },
  arc_cache: { label: 'ARC キャッシュ', color: '#4080ff' },
  weapon_box: { label: '武器ケース', color: '#f05040' },
  supply_drop: { label: '補給物資', color: '#60f070' },
  locked: { label: '施錠された部屋', color: '#c060f0' },
};
export function mapHotspots() {
  const M = getMap();
  const out = [];
  for (const c of M.containers) if (HOTSPOT_TYPES[c.type]) out.push({ x: c.x, z: c.z, type: c.type, color: HOTSPOT_TYPES[c.type].color, big: c.type === 'supply_drop' });
  for (const d of M.doors) if (d.locked) out.push({ x: d.x, z: d.z, type: 'locked', color: HOTSPOT_TYPES.locked.color, big: true, name: d.name, key: d.locked });
  return out;
}

export function drawMapPreview(cv, opts = {}) {
  const M = getMap();
  const g = cv.getContext('2d');
  const img = baseImage();
  const S = M.half * 2;
  const W = cv.width, H = cv.height;
  g.fillStyle = '#0f1213'; g.fillRect(0, 0, W, H);
  // 表示範囲
  const view = opts.view || { x: 0, z: 0, size: S };
  const scale = Math.min(W, H) / view.size;
  const ox = W / 2 - (view.x + M.half) * scale, oz = H / 2 - (view.z + M.half) * scale;
  g.imageSmoothingEnabled = true;
  g.drawImage(img, ox, oz, S * scale, S * scale);
  const P = (x, z) => [ox + (x + M.half) * scale, oz + (z + M.half) * scale];
  // POI 名
  g.font = `bold ${Math.max(10, Math.min(14, scale * 5))}px "Noto Sans JP", sans-serif`;
  g.textAlign = 'center';
  for (const p of M.pois) {
    const [x, y] = P(p.x, p.z);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(p.name, x + 1, y + 1);
    g.fillStyle = '#e8e2d0'; g.fillText(p.name, x, y);
  }
  // 高価な物が出やすい場所
  for (const s of opts.hotspots || []) {
    const [x, y] = P(s.x, s.z);
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
    g.fillStyle = s.color; g.strokeStyle = '#000'; g.lineWidth = 1.2;
    const r = s.big ? 5 : 3.5;
    g.fillRect(-r, -r, r * 2, r * 2); g.strokeRect(-r, -r, r * 2, r * 2);
    g.restore();
  }
  // 脱出地点
  const exs = opts.extracts || M.extracts;
  for (const e of exs) {
    const [x, y] = P(e.x, e.z);
    g.fillStyle = e.open === false ? 'rgba(150,150,150,.8)' : '#7af06a';
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
    g.font = '11px "Noto Sans JP", sans-serif';
    g.fillStyle = '#000'; g.fillText(e.name, x + 1, y - 8);
    g.fillStyle = e.open === false ? '#aaa' : '#bff0a8'; g.fillText(e.name, x, y - 9);
  }
  // プレイヤー
  if (opts.player) {
    const [x, y] = P(opts.player.x, opts.player.z);
    g.save(); g.translate(x, y); g.rotate(-opts.player.yaw);
    g.fillStyle = '#ffd040'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
    g.restore();
  }
  // 方位
  g.fillStyle = '#e8c26a'; g.font = 'bold 14px Rajdhani, sans-serif'; g.textAlign = 'left';
  g.fillText('N ↑', 10, 20);
}

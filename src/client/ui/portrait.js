// トレーダーの肖像（プロシージャル）
export function drawPortrait(cv, t) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, shade(t.color, -0.55)); bg.addColorStop(1, '#0c0d0e');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 光
  const rg = g.createRadialGradient(W * 0.3, H * 0.2, 4, W * 0.3, H * 0.2, W);
  rg.addColorStop(0, 'rgba(255,230,180,.25)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  const skin = { borov: '#c89a78', eva: '#e0b898', mira: '#d8b090', yan: '#b88a68', luka: '#a87a5a' }[t.id] || '#c8a080';
  // 肩・服
  g.fillStyle = { borov: '#4a5a3a', eva: '#2a2e34', mira: '#d8dcd8', yan: '#5a4a2a', luka: '#3a2a3a' }[t.id];
  g.beginPath(); g.moveTo(W * 0.08, H); g.quadraticCurveTo(W * 0.15, H * 0.68, W * 0.5, H * 0.66); g.quadraticCurveTo(W * 0.85, H * 0.68, W * 0.92, H); g.fill();
  // 首
  g.fillStyle = shade(skin, -0.15); g.fillRect(W * 0.42, H * 0.52, W * 0.16, H * 0.16);
  // 顔
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(W * 0.5, H * 0.4, W * 0.19, H * 0.23, 0, 0, Math.PI * 2); g.fill();
  // 陰影
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.beginPath(); g.ellipse(W * 0.58, H * 0.42, W * 0.1, H * 0.2, 0, 0, Math.PI * 2); g.fill();
  // 目
  g.fillStyle = '#1a1a1a';
  g.fillRect(W * 0.41, H * 0.37, W * 0.06, H * 0.025); g.fillRect(W * 0.53, H * 0.37, W * 0.06, H * 0.025);
  // 口
  g.fillStyle = 'rgba(80,30,20,.7)'; g.fillRect(W * 0.45, H * 0.52, W * 0.1, H * 0.015);
  // 特徴
  if (t.id === 'borov') { // ベレー帽と髭
    g.fillStyle = '#7a1a1a'; g.beginPath(); g.ellipse(W * 0.47, H * 0.2, W * 0.24, H * 0.08, -0.15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(W * 0.5, H * 0.53, W * 0.13, H * 0.07, 0, 0, Math.PI); g.fill();
  } else if (t.id === 'eva') { // ポニーテール・ヘッドセット
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(W * 0.5, H * 0.24, W * 0.21, H * 0.1, 0, Math.PI, 0); g.fill();
    g.fillRect(W * 0.66, H * 0.22, W * 0.06, H * 0.3);
    g.fillStyle = '#1a1a1a'; g.fillRect(W * 0.28, H * 0.34, W * 0.05, H * 0.12); g.fillRect(W * 0.28, H * 0.22, W * 0.44, H * 0.02);
  } else if (t.id === 'mira') { // マスクと白衣
    g.fillStyle = '#9ac0c8'; g.fillRect(W * 0.36, H * 0.45, W * 0.28, H * 0.13);
    g.fillStyle = '#8a8a8a'; g.beginPath(); g.ellipse(W * 0.5, H * 0.22, W * 0.21, H * 0.1, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#c03030'; g.fillRect(W * 0.2, H * 0.82, W * 0.08, W * 0.08);
  } else if (t.id === 'yan') { // ゴーグル
    g.fillStyle = '#2a2a2a'; g.fillRect(W * 0.3, H * 0.33, W * 0.4, H * 0.08);
    g.fillStyle = '#d0a030'; g.beginPath(); g.arc(W * 0.43, H * 0.37, W * 0.05, 0, 7); g.arc(W * 0.57, H * 0.37, W * 0.05, 0, 7); g.fill();
    g.fillStyle = '#6a4a2a'; g.beginPath(); g.ellipse(W * 0.5, H * 0.2, W * 0.2, H * 0.07, 0, Math.PI, 0); g.fill();
  } else if (t.id === 'luka') { // フード
    g.fillStyle = '#2a1a2a'; g.beginPath(); g.ellipse(W * 0.5, H * 0.36, W * 0.27, H * 0.32, 0, Math.PI * 1.02, -0.02); g.fill();
    g.fillRect(W * 0.23, H * 0.36, W * 0.07, H * 0.3); g.fillRect(W * 0.7, H * 0.36, W * 0.07, H * 0.3);
    g.fillStyle = '#d0b040'; g.beginPath(); g.arc(W * 0.66, H * 0.48, W * 0.02, 0, 7); g.fill();
  }
  // 枠
  g.strokeStyle = t.color; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3);
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}

// オンライン PvPvE サーバー：静的ファイル配信 + WebSocket でレイドをホストする
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Raid, TICK } from '../src/shared/raid.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const PORT = Number(process.env.PORT || 8080);
const RAID_MINUTES = Number(process.env.RAID_MINUTES || 30);
const AI_RAIDERS = Number(process.env.AI_RAIDERS || 5);
const TIME_OF_DAY = process.env.TIME_OF_DAY || 'cycle';
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 12);
const JOIN_WINDOW = Number(process.env.JOIN_WINDOW || 0.6); // レイド時間のこの割合を過ぎたら新しいレイドを待つ

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(status()));
    return;
  }
  if (p === '/') p = '/index.html';
  const file = path.resolve(DIST, '.' + p);
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      if (!fs.existsSync(DIST)) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('dist/ がありません。先に `npm run build` を実行してください。'); return; }
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });
let raid = null;
let raidStart = 0;
let todIdx = 0;
const TODS = ['day', 'dusk', 'night', 'day'];

function newRaid() {
  const tod = TIME_OF_DAY === 'cycle' ? TODS[todIdx++ % TODS.length] : TIME_OF_DAY;
  raid = new Raid({ mode: 'pvpve', timeOfDay: tod, duration: RAID_MINUTES * 60, raiders: AI_RAIDERS, scavs: 1, machines: 1 });
  raidStart = Date.now();
  console.log(`[raid] 新しいレイドを開始 (${tod}, ${RAID_MINUTES}分, AIレイダー ${AI_RAIDERS})`);
}
function status() {
  return { raid: !!raid, players: raid ? raid.clients.size : 0, timeLeft: raid ? Math.round(raid.timeLeft) : 0, tod: raid?.opts.timeOfDay };
}

let cidSeq = 1;
wss.on('connection', (ws) => {
  const cid = 'c' + (cidSeq++);
  let joined = false;
  const send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!joined) {
      if (m.t !== 'join') return;
      if (!raid || raid.ended || raid.timeLeft < raid.opts.duration * (1 - JOIN_WINDOW)) {
        if (raid && raid.clients.size > 0 && !raid.ended) { send({ t: 'reject', reason: `現在のレイドは終盤です。残り ${Math.ceil(raid.timeLeft / 60)} 分後に新しいレイドが始まります。` }); return; }
        newRaid();
      }
      if (raid.clients.size >= MAX_PLAYERS) { send({ t: 'reject', reason: 'サーバーが満員です' }); return; }
      const p = m.profile || {};
      const name = String(p.name || 'レイダー').slice(0, 16);
      try {
        raid.addClient(cid, { name, inv: sanitizeInv(p.inv), health: p.health, level: p.level, easy: !!p.easy }, send);
        joined = true;
        console.log(`[join] ${name} (${cid}) players=${raid.clients.size}`);
      } catch (e) {
        console.error(e);
        send({ t: 'reject', reason: '参加データが不正です' });
      }
      return;
    }
    try { raid.handle(cid, m); } catch (e) { console.error('handle error', e); }
  });
  ws.on('close', () => {
    if (joined && raid) { raid.removeClient(cid); console.log(`[leave] ${cid} players=${raid.clients.size}`); }
  });
});

// 受け取ったインベントリは最低限の形だけ検証する
function sanitizeInv(inv) {
  if (!inv || typeof inv !== 'object' || !inv.equip || !inv.pockets) return undefined;
  return JSON.parse(JSON.stringify(inv));
}

let tickN = 0;
setInterval(() => {
  if (!raid) return;
  try {
    raid.tick(TICK);
    if (++tickN % 2 === 0) raid.flush();
  } catch (e) { console.error('tick error', e); }
  if (raid.ended && raid.clients.size === 0) { raid = null; }
  else if (raid.clients.size === 0 && Date.now() - raidStart > 5000 && !raid.ended) {
    // 誰もいなくなったらレイドを破棄
    raid = null;
    console.log('[raid] プレイヤーがいないため終了');
  }
}, TICK * 1000);

server.listen(PORT, () => {
  console.log(`RAIDER BATTLE サーバー起動: http://localhost:${PORT}  (WebSocket: ws://localhost:${PORT}/ws)`);
});

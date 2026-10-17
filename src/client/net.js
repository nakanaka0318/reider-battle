// 通信：オフライン（ブラウザ内シミュレーション）とオンライン（WebSocket）
import { Raid, TICK } from '../shared/raid.js';

export class LocalTransport {
  constructor(opts) {
    this.opts = opts;
    this.inbox = [];
    this.acc = 0;
    this.online = false;
  }
  async connect(profile) {
    const dens = { low: 0.6, normal: 1, high: 1.5 }[this.opts.density] ?? 1;
    this.raid = new Raid({ mode: 'offline', timeOfDay: this.opts.timeOfDay, duration: (this.opts.duration || 30) * 60, raiders: this.opts.raiders ?? 9, scavs: dens, machines: dens });
    this.raid.addClient('local', profile, (m) => this.inbox.push(m));
    this.raid.flush();
  }
  send(msg) { this.raid?.handle('local', msg); }
  update(dt) {
    if (this.paused) { const o = this.inbox; this.inbox = []; return o; }
    this.acc += Math.min(dt, 0.25);
    let n = 0;
    while (this.acc >= TICK && n < 8) {
      this.acc -= TICK; n++;
      this.raid.tick(TICK);
      this.raid.flush();
    }
    const out = this.inbox;
    this.inbox = [];
    return out;
  }
  close() { this.raid = null; }
}

export class WSTransport {
  constructor(url) {
    this.url = url;
    this.inbox = [];
    this.online = true;
    this.ping = 0;
  }
  connect(profile) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { reject(e); return; }
      this.ws = ws;
      const to = setTimeout(() => { reject(new Error('接続タイムアウト')); try { ws.close(); } catch { /* noop */ } }, 8000);
      ws.onopen = () => { ws.send(JSON.stringify({ t: 'join', profile })); };
      ws.onerror = () => { clearTimeout(to); reject(new Error('サーバーに接続できません: ' + this.url)); };
      ws.onclose = () => { this.closed = true; this.inbox.push({ t: 'disconnected' }); };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'welcome') { clearTimeout(to); resolve(); }
        if (m.t === 'reject') { clearTimeout(to); reject(new Error(m.reason || '参加できません')); return; }
        if (m.t === 'pong') { this.ping = performance.now() - m.ts; return; }
        this.inbox.push(m);
      };
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 2000);
    });
  }
  send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  update() { const out = this.inbox; this.inbox = []; return out; }
  close() { clearInterval(this.pingTimer); try { this.ws?.close(); } catch { /* noop */ } }
}

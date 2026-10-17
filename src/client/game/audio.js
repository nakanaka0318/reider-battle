// WebAudio による効果音の合成（外部音源なし）。3D 定位あり。
export class Audio3D {
  constructor(volume = 0.8) {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = volume;
    // 簡易リバーブ
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 5;
    this.master.connect(this.comp).connect(this.ctx.destination);
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.impulse(1.8, 2.6);
    this.revGain = this.ctx.createGain(); this.revGain.gain.value = 0.22;
    this.reverb.connect(this.revGain).connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.listener = this.ctx.listener;
    this.deaf = 0;
    this.lowpass = this.ctx.createBiquadFilter(); this.lowpass.type = 'lowpass'; this.lowpass.frequency.value = 22000;
    this.world = this.ctx.createGain();
    this.world.connect(this.lowpass).connect(this.master);
    this.lowpass.connect(this.reverb);
    this.loops = new Map();
  }
  resume() { if (this.ctx.state !== 'running') this.ctx.resume(); }
  setVolume(v) { this.master.gain.value = v; }
  makeNoise(sec) {
    const n = this.ctx.sampleRate * sec;
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  impulse(sec, decay) {
    const n = this.ctx.sampleRate * sec;
    const b = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }
  setListener(pos, fwd, up = { x: 0, y: 1, z: 0 }) {
    const L = this.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setValueAtTime(pos.x, t); L.positionY.setValueAtTime(pos.y, t); L.positionZ.setValueAtTime(pos.z, t);
      L.forwardX.setValueAtTime(fwd.x, t); L.forwardY.setValueAtTime(fwd.y, t); L.forwardZ.setValueAtTime(fwd.z, t);
      L.upX.setValueAtTime(up.x, t); L.upY.setValueAtTime(up.y, t); L.upZ.setValueAtTime(up.z, t);
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
    this.lpos = pos;
  }
  // 出力ノード（位置付き or 2D）
  out(pos, refDist = 4, maxDist = 600) {
    if (!pos) return this.world;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = refDist; p.maxDistance = maxDist; p.rolloffFactor = 1.1;
    const t = this.ctx.currentTime;
    if (p.positionX) { p.positionX.setValueAtTime(pos.x, t); p.positionY.setValueAtTime(pos.y, t); p.positionZ.setValueAtTime(pos.z, t); }
    else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(this.world);
    // 遠距離ほどこもる
    if (this.lpos) {
      const d = Math.hypot(pos.x - this.lpos.x, pos.y - this.lpos.y, pos.z - this.lpos.z);
      if (d > 30) {
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = Math.max(500, 9000 - d * 25);
        f.connect(p);
        return f;
      }
    }
    return p;
  }
  noise(dest, t0, dur, { gain = 1, filter = 'lowpass', freq = 2000, q = 1, attack = 0.002, decay = null, freqEnd = null } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay ?? dur));
    src.connect(f).connect(g).connect(dest);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }
  tone(dest, t0, dur, { type = 'sine', freq = 440, freqEnd = null, gain = 0.5, attack = 0.005 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------------- 銃声
  gunshot(pos, kind = 'rifle', suppressed = false, local = false) {
    const t = this.ctx.currentTime;
    const dest = local ? this.world : this.out(pos, suppressed ? 2 : 8);
    const dist = pos && this.lpos ? Math.hypot(pos.x - this.lpos.x, pos.z - this.lpos.z) : 0;
    const P = {
      pistol: { g: 1.0, f: 2600, body: 150, len: 0.25 },
      smg: { g: 0.9, f: 3000, body: 140, len: 0.22 },
      rifle: { g: 1.2, f: 2400, body: 110, len: 0.4 },
      heavy: { g: 1.4, f: 1800, body: 80, len: 0.55 },
      sniper: { g: 1.6, f: 1500, body: 60, len: 0.8 },
      shotgun: { g: 1.5, f: 1600, body: 70, len: 0.5 },
      subsonic: { g: 0.5, f: 2200, body: 160, len: 0.15 },
      energy: { g: 0.8, f: 4000, body: 300, len: 0.3 },
    }[kind] || { g: 1, f: 2400, body: 110, len: 0.35 };
    if (kind === 'energy') {
      this.tone(dest, t, 0.25, { type: 'sawtooth', freq: 1400, freqEnd: 180, gain: 0.35 });
      this.tone(dest, t, 0.18, { type: 'square', freq: 700, freqEnd: 90, gain: 0.2 });
      this.noise(dest, t, 0.12, { gain: 0.4, filter: 'highpass', freq: 3000 });
      return;
    }
    if (suppressed || kind === 'subsonic') {
      this.noise(dest, t, 0.12, { gain: 0.55 * P.g, filter: 'bandpass', freq: 1400, q: 0.8 });
      this.noise(dest, t, 0.05, { gain: 0.4, filter: 'highpass', freq: 4000 });
      this.tone(dest, t, 0.08, { type: 'triangle', freq: 180, freqEnd: 60, gain: 0.3 });
      // 機関部の作動音
      this.noise(dest, t + 0.03, 0.04, { gain: 0.25, filter: 'bandpass', freq: 3500, q: 3 });
      return;
    }
    const g = P.g * (local ? 1 : 1);
    // 衝撃音（クラック）
    this.noise(dest, t, 0.08, { gain: 1.1 * g, filter: 'highpass', freq: 1200 + (dist > 80 ? -800 : 0) });
    // 本体
    this.noise(dest, t, P.len, { gain: 0.9 * g, filter: 'lowpass', freq: P.f, freqEnd: 300, decay: P.len });
    // 低音のドン
    this.tone(dest, t, P.len * 0.7, { type: 'sine', freq: P.body * 1.6, freqEnd: P.body * 0.4, gain: 0.9 * g });
    // 残響（遠距離はエコー）
    if (dist > 60 || local) this.noise(this.reverb, t + 0.05, 1.2, { gain: 0.25 * g, filter: 'lowpass', freq: 800, decay: 1.2 });
  }
  machineShot(pos, snd) {
    const t = this.ctx.currentTime, dest = this.out(pos, 6);
    if (snd === 'laser') {
      this.tone(dest, t, 0.6, { type: 'sawtooth', freq: 220, freqEnd: 40, gain: 0.6 });
      this.tone(dest, t, 0.5, { type: 'sine', freq: 1800, freqEnd: 200, gain: 0.4 });
      this.noise(dest, t, 0.6, { gain: 0.5, filter: 'lowpass', freq: 1200, freqEnd: 100 });
    } else {
      this.tone(dest, t, 0.12, { type: 'square', freq: snd === 'zap2' ? 900 : 1300, freqEnd: 300, gain: 0.25 });
      this.noise(dest, t, 0.08, { gain: 0.35, filter: 'bandpass', freq: 2500, q: 2 });
    }
  }
  charge(pos) {
    const t = this.ctx.currentTime, dest = this.out(pos, 8);
    this.tone(dest, t, 1.1, { type: 'sawtooth', freq: 80, freqEnd: 900, gain: 0.25, attack: 0.3 });
    this.tone(dest, t, 1.1, { type: 'sine', freq: 300, freqEnd: 2400, gain: 0.15, attack: 0.5 });
  }
  dry() { const t = this.ctx.currentTime; this.noise(this.world, t, 0.03, { gain: 0.3, filter: 'bandpass', freq: 3000, q: 4 }); }
  explosion(pos, big = true) {
    const t = this.ctx.currentTime, dest = this.out(pos, 15);
    this.noise(dest, t, 2.2, { gain: 1.6, filter: 'lowpass', freq: 1800, freqEnd: 80, decay: 2.0 });
    this.tone(dest, t, 1.2, { type: 'sine', freq: 70, freqEnd: 25, gain: 1.4 });
    this.noise(this.reverb, t + 0.1, 2.5, { gain: 0.5, filter: 'lowpass', freq: 500, decay: 2.5 });
    void big;
  }
  flashbang(pos) {
    const t = this.ctx.currentTime, dest = this.out(pos, 15);
    this.noise(dest, t, 0.6, { gain: 1.8, filter: 'highpass', freq: 800 });
    this.tone(dest, t, 0.4, { type: 'sine', freq: 90, freqEnd: 30, gain: 1 });
  }
  ring(dur = 3, strength = 1) {
    const t = this.ctx.currentTime;
    this.tone(this.master, t, dur, { type: 'sine', freq: 3200, gain: 0.08 * strength, attack: 0.05 });
    // 一時的に聴覚をこもらせる
    this.lowpass.frequency.cancelScheduledValues(t);
    this.lowpass.frequency.setValueAtTime(400, t);
    this.lowpass.frequency.exponentialRampToValueAtTime(22000, t + dur);
  }
  // ---------------------------------------------------------------- 足音・動作
  step(pos, surface = 'dirt', loud = 1, local = false) {
    const t = this.ctx.currentTime;
    const dest = local ? this.world : this.out(pos, 2, 60);
    const f = { dirt: 900, concrete: 2400, metal: 3200, wood: 1400, grass: 700 }[surface] || 1200;
    this.noise(dest, t, 0.09, { gain: 0.2 * loud, filter: 'bandpass', freq: f, q: 1.2 });
    this.tone(dest, t, 0.05, { type: 'sine', freq: 90, freqEnd: 50, gain: 0.12 * loud });
    if (surface === 'metal') this.tone(dest, t, 0.15, { type: 'triangle', freq: 640, freqEnd: 600, gain: 0.05 * loud });
  }
  land(vol = 1) { const t = this.ctx.currentTime; this.noise(this.world, t, 0.15, { gain: 0.35 * vol, filter: 'lowpass', freq: 600 }); }
  click(pos, f = 3000, g = 0.25) {
    const t = this.ctx.currentTime, dest = this.out(pos, 2, 30);
    this.noise(dest, t, 0.03, { gain: g, filter: 'bandpass', freq: f, q: 5 });
  }
  reload(pos, dur = 2.4, local = false) {
    const t = this.ctx.currentTime, dest = local ? this.world : this.out(pos, 2, 25);
    this.noise(dest, t + 0.15, 0.06, { gain: 0.3, filter: 'bandpass', freq: 2000, q: 3 }); // マグ抜き
    this.noise(dest, t + dur * 0.55, 0.05, { gain: 0.35, filter: 'bandpass', freq: 2600, q: 3 }); // マグ挿入
    this.noise(dest, t + dur * 0.85, 0.04, { gain: 0.4, filter: 'bandpass', freq: 3600, q: 4 }); // チャージング
    this.noise(dest, t + dur * 0.9, 0.04, { gain: 0.35, filter: 'bandpass', freq: 2800, q: 4 });
  }
  bolt(local = true) { const t = this.ctx.currentTime; this.noise(this.world, t + 0.15, 0.05, { gain: 0.3, filter: 'bandpass', freq: 2200, q: 3 }); this.noise(this.world, t + 0.35, 0.05, { gain: 0.3, filter: 'bandpass', freq: 3000, q: 3 }); void local; }
  hitmarker(kill = false, armor = false) {
    const t = this.ctx.currentTime;
    this.tone(this.master, t, 0.06, { type: 'square', freq: armor ? 1800 : 1100, gain: 0.08 });
    if (kill) this.tone(this.master, t + 0.05, 0.15, { type: 'triangle', freq: 600, freqEnd: 300, gain: 0.15 });
  }
  hurt(strength = 1) {
    const t = this.ctx.currentTime;
    this.noise(this.master, t, 0.15, { gain: 0.5 * strength, filter: 'lowpass', freq: 500 });
    this.tone(this.master, t, 0.25, { type: 'sine', freq: 120, freqEnd: 60, gain: 0.3 * strength });
  }
  flyby(pos) {
    const t = this.ctx.currentTime, dest = this.out(pos, 2, 20);
    this.noise(dest, t, 0.12, { gain: 0.5, filter: 'bandpass', freq: 3500, q: 2, freqEnd: 1500 });
  }
  impact(pos, kind) {
    const t = this.ctx.currentTime, dest = this.out(pos, 1.5, 40);
    if (kind === 'metal' || kind === 'metal_hit' || kind === 'armor' || kind === 'armor_m') { this.tone(dest, t, 0.15, { type: 'triangle', freq: 1800 + Math.random() * 1500, freqEnd: 900, gain: 0.15 }); this.noise(dest, t, 0.04, { gain: 0.25, filter: 'highpass', freq: 3000 }); }
    else if (kind === 'flesh') this.noise(dest, t, 0.08, { gain: 0.35, filter: 'lowpass', freq: 700 });
    else this.noise(dest, t, 0.06, { gain: 0.2, filter: 'bandpass', freq: 1500, q: 1 });
  }
  door(pos, open = true) {
    const t = this.ctx.currentTime, dest = this.out(pos, 2, 30);
    this.tone(dest, t, 0.5, { type: 'sawtooth', freq: open ? 180 : 140, freqEnd: open ? 260 : 100, gain: 0.05, attack: 0.1 });
    this.noise(dest, t + (open ? 0 : 0.35), 0.1, { gain: 0.3, filter: 'lowpass', freq: 600 });
  }
  locked(pos) { this.click(pos, 1500, 0.4); this.click(pos, 1200, 0.3); }
  loot(pos) { const t = this.ctx.currentTime, dest = this.out(pos, 2, 20); for (let i = 0; i < 3; i++) this.noise(dest, t + i * 0.12, 0.1, { gain: 0.15, filter: 'bandpass', freq: 1200 + Math.random() * 800, q: 1 }); }
  pickup() { const t = this.ctx.currentTime; this.noise(this.world, t, 0.08, { gain: 0.2, filter: 'bandpass', freq: 1500, q: 1 }); this.tone(this.world, t, 0.06, { type: 'sine', freq: 900, gain: 0.05 }); }
  ui(f = 800) { const t = this.ctx.currentTime; this.tone(this.master, t, 0.05, { type: 'sine', freq: f, gain: 0.06 }); }
  beep(pos, f = 1200) { const t = this.ctx.currentTime, dest = this.out(pos, 3, 40); this.tone(dest, t, 0.08, { type: 'square', freq: f, gain: 0.25 }); }
  heartbeat() { const t = this.ctx.currentTime; this.tone(this.master, t, 0.12, { type: 'sine', freq: 55, freqEnd: 40, gain: 0.35 }); this.tone(this.master, t + 0.22, 0.12, { type: 'sine', freq: 50, freqEnd: 38, gain: 0.25 }); }
  extractTick() { const t = this.ctx.currentTime; this.tone(this.master, t, 0.07, { type: 'sine', freq: 1500, gain: 0.08 }); }
  alarm(pos) {
    const t = this.ctx.currentTime, dest = this.out(pos, 20, 400);
    for (let i = 0; i < 6; i++) this.tone(dest, t + i * 0.6, 0.5, { type: 'square', freq: i % 2 ? 600 : 800, gain: 0.2 });
  }
  heli(pos) {
    const t = this.ctx.currentTime, dest = this.out(pos, 30, 600);
    for (let i = 0; i < 30; i++) this.noise(dest, t + i * 0.12, 0.08, { gain: 0.4, filter: 'lowpass', freq: 300 });
  }
  // ---------------------------------------------------------------- ループ音（ドローン・環境音）
  loop(id, pos, type) {
    let L = this.loops.get(id);
    if (!L) {
      const ctx = this.ctx;
      const p = ctx.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = type === 'sentinel' ? 8 : 3; p.maxDistance = 200; p.rolloffFactor = 1.3;
      const g = ctx.createGain(); g.gain.value = 0;
      g.connect(p).connect(this.world);
      const nodes = [];
      if (type === 'wasp' || type === 'hornet') {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = type === 'hornet' ? 95 : 140;
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = (type === 'hornet' ? 95 : 140) * 1.51;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
        const og = ctx.createGain(); og.gain.value = 0.09;
        o.connect(f); o2.connect(f); f.connect(og).connect(g);
        const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
        const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 600; nf.Q.value = 0.7;
        const ng = ctx.createGain(); ng.gain.value = 0.12;
        n.connect(nf).connect(ng).connect(g);
        o.start(); o2.start(); n.start();
        nodes.push(o, o2, n);
      } else if (type === 'tick') {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 18;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 2;
        const og = ctx.createGain(); og.gain.value = 0.06;
        o.connect(f).connect(og).connect(g); o.start(); nodes.push(o);
      } else if (type === 'sentinel') {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 42;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
        const og = ctx.createGain(); og.gain.value = 0.25;
        o.connect(f).connect(og).connect(g); o.start(); nodes.push(o);
      }
      L = { p, g, nodes, alive: true };
      this.loops.set(id, L);
    }
    const t = this.ctx.currentTime;
    if (L.p.positionX) { L.p.positionX.setTargetAtTime(pos.x, t, 0.05); L.p.positionY.setTargetAtTime(pos.y, t, 0.05); L.p.positionZ.setTargetAtTime(pos.z, t, 0.05); }
    else L.p.setPosition(pos.x, pos.y, pos.z);
    L.g.gain.setTargetAtTime(1, t, 0.3);
    L.seen = true;
  }
  stopLoop(id) {
    const L = this.loops.get(id);
    if (!L) return;
    const t = this.ctx.currentTime;
    L.g.gain.setTargetAtTime(0, t, 0.1);
    setTimeout(() => { for (const n of L.nodes) { try { n.stop(); } catch { /* noop */ } } L.g.disconnect(); }, 600);
    this.loops.delete(id);
  }
  ambience(tod) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = tod === 'night' ? 0.05 : 0.07;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lg = ctx.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    n.connect(f).connect(g).connect(this.master);
    n.start(); lfo.start();
    this.amb = [n, lfo];
    // 鳥・虫の声
    this.ambTimer = setInterval(() => {
      if (this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      if (tod === 'night') { for (let i = 0; i < 6; i++) this.tone(this.master, t + i * 0.09, 0.05, { type: 'sine', freq: 4200 + Math.random() * 300, gain: 0.012 }); }
      else if (Math.random() < 0.6) { const f0 = 2000 + Math.random() * 2000; for (let i = 0; i < 3; i++) this.tone(this.master, t + i * 0.13, 0.1, { type: 'sine', freq: f0, freqEnd: f0 * 1.3, gain: 0.015 }); }
    }, 4000);
  }
  dispose() {
    clearInterval(this.ambTimer);
    for (const id of [...this.loops.keys()]) this.stopLoop(id);
    try { this.ctx.close(); } catch { /* noop */ }
  }
}

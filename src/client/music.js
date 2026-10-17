// メニュー用 BGM（WebAudio でその場で生成。外部の音源ファイルは使わない）
// 暗めのアンビエント・シンセ：パッド＋ベース＋アルペジオ＋軽いリズム＋時々メロディ
const BPM = 84;
const STEP = 60 / BPM / 4; // 16 分音符
// A マイナー系の進行（各 2 小節）。数字は MIDI ノート
const PROG = [
  { root: 45, chord: [57, 60, 64, 67] }, // Am7
  { root: 41, chord: [53, 57, 60, 64] }, // Fmaj7
  { root: 38, chord: [50, 53, 57, 60] }, // Dm7
  { root: 40, chord: [52, 55, 59, 62] }, // Em7
  { root: 45, chord: [57, 60, 64, 69] }, // Am
  { root: 43, chord: [55, 59, 62, 66] }, // G(add)
  { root: 41, chord: [53, 57, 60, 65] }, // F
  { root: 40, chord: [52, 56, 59, 64] }, // E（緊張感）
];
const SCALE = [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76];
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class MenuMusic {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.volume = 0.4;
    this.step = 0;
    this.wanted = false;
  }

  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    // リバーブとディレイ
    this.rev = ctx.createConvolver();
    this.rev.buffer = this.impulse(3.2, 2.2);
    const revG = ctx.createGain(); revG.gain.value = 0.5;
    this.rev.connect(revG).connect(this.master);
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(this.master);
    // ノイズ
    const n = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, n, n);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // 背景の風（ずっと鳴っている低いノイズ）
    const wind = ctx.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.035;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 220;
    lfo.connect(lg).connect(wf.frequency);
    wind.connect(wf).connect(wg).connect(this.master);
    wind.start(); lfo.start();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (this.playing) this.ctx.resume();
    });
    return true;
  }

  impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx && this.playing) this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.2);
  }

  // ユーザー操作の後でないと音を出せないので、再生要求は覚えておく
  play() {
    this.wanted = true;
    if (!this.unlocked) return;
    if (!this.init()) return;
    this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.volume * 0.9, t + 3);
    this.next = t + 0.1;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 30);
  }

  stop(fade = 1.2) {
    this.wanted = false;
    if (!this.ctx || !this.playing) return;
    this.playing = false;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + fade);
    clearInterval(this.timer);
    setTimeout(() => { if (!this.playing) this.ctx.suspend(); }, fade * 1000 + 100);
  }

  // 最初のタップ／クリック／キー入力で再生を解禁する
  unlockOnGesture() {
    const go = () => {
      this.unlocked = true;
      removeEventListener('pointerdown', go, true);
      removeEventListener('keydown', go, true);
      if (this.wanted) this.play();
    };
    addEventListener('pointerdown', go, true);
    addEventListener('keydown', go, true);
  }

  schedule() {
    const ctx = this.ctx;
    while (this.next < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.next);
      this.step++;
      this.next += STEP;
    }
  }

  playStep(s, t) {
    const bar = Math.floor(s / 16), pos = s % 16;
    const section = Math.floor(bar / 16) % 3; // 0:静か 1:リズム入り 2:メロディ入り
    const P = PROG[Math.floor(bar / 2) % PROG.length];
    const barLen = STEP * 16;
    if (pos === 0 && bar % 2 === 0) this.pad(P.chord, t, barLen * 2);
    // ベース：8 分で脈打つ
    if (pos % 2 === 0 && (section > 0 || pos % 8 === 0)) this.bass(P.root, t, STEP * 1.8, pos % 8 === 0 ? 1 : 0.6);
    // アルペジオ
    const arpOn = section > 0 || bar % 4 >= 2;
    if (arpOn && pos % 2 === 0) {
      const pat = [0, 2, 1, 3, 2, 1, 3, 2];
      const note = P.chord[pat[(pos / 2) % 8]] + (pos % 8 === 6 ? 12 : 0);
      this.pluck(note, t, 0.08 + (pos % 4 === 0 ? 0.04 : 0));
    }
    // リズム
    if (section >= 1) {
      if (pos === 0 || pos === 10) this.kick(t);
      if (pos === 8) this.snare(t);
      if (pos % 2 === 1) this.hat(t, pos % 4 === 3 ? 0.05 : 0.025);
    } else if (pos === 0 && bar % 4 === 0) this.kick(t, 0.5);
    // メロディ（ゆっくり、決まった音型をランダムに選ぶ）
    if (section === 2 && pos % 4 === 0 && this.rnd(s) < 0.55) {
      const base = SCALE.indexOf(P.chord[0]) >= 0 ? SCALE.indexOf(P.chord[0]) : 0;
      const idx = Math.min(SCALE.length - 1, base + [0, 2, 4, 1, 3, 5, 2][Math.floor(this.rnd(s + 7) * 7)]);
      this.lead(SCALE[idx] + 12, t, STEP * (pos % 8 === 0 ? 6 : 3));
    }
    // 時々遠くの金属音
    if (pos === 4 && bar % 8 === 5) this.bell(P.chord[3] + 12, t);
  }

  rnd(s) { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); }

  env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  pad(notes, t, dur) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(1300, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(600, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.2);
    g.gain.setValueAtTime(0.05, t + dur - 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    f.connect(g); g.connect(this.master); g.connect(this.rev);
    for (const n of notes) for (const det of [-7, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(n); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.5);
    }
  }

  bass(n, t, dur, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(n);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(n - 12);
    const g = ctx.createGain();
    this.env(g, t, 0.01, 0.16 * vel, dur);
    o.connect(g); o2.connect(g); g.connect(this.master);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  pluck(n, t, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz(n);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const g = ctx.createGain();
    this.env(g, t, 0.005, vel * 0.5, 0.35);
    o.connect(f).connect(g); g.connect(this.master); g.connect(this.delay);
    o.start(t); o.stop(t + 0.4);
  }

  lead(n, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(n);
    const vib = ctx.createOscillator(); vib.frequency.value = 5;
    const vg = ctx.createGain(); vg.gain.value = 4;
    vib.connect(vg).connect(o.frequency);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = hz(n) * 2.001;
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    o.connect(g); g2.connect(g); g.connect(this.master); g.connect(this.rev); g.connect(this.delay);
    o.start(t); o2.start(t); vib.start(t);
    o.stop(t + dur + 0.5); o2.stop(t + dur + 0.5); vib.stop(t + dur + 0.5);
  }

  bell(n, t) {
    const ctx = this.ctx;
    for (const [mul, amp] of [[1, 0.05], [2.76, 0.02], [5.4, 0.01]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(n) * mul;
      const g = ctx.createGain();
      this.env(g, t, 0.004, amp, 3);
      o.connect(g); g.connect(this.rev); g.connect(this.master);
      o.start(t); o.stop(t + 3.1);
    }
  }

  kick(t, vel = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = ctx.createGain();
    this.env(g, t, 0.003, 0.35 * vel, 0.4);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.45);
  }

  snare(t) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ctx.createGain();
    this.env(g, t, 0.002, 0.09, 0.22);
    s.connect(f).connect(g); g.connect(this.master); g.connect(this.rev);
    s.start(t, Math.random() * 0.5); s.stop(t + 0.25);
  }

  hat(t, vel) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    this.env(g, t, 0.001, vel, 0.05);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + 0.06);
  }
}

export const music = new MenuMusic();

// スマホ（横画面）用のタッチ操作：仮想スティック・視点ドラッグ・各種ボタン
import { h } from '../ui/dom.js';

export const IS_TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;

export class TouchControls {
  constructor(game) {
    this.g = game;
    const inp = this.inp = game.input;
    inp.touch = true;
    inp.moveX = 0; inp.moveY = 0;
    this.lookId = null; this.stickId = null; this.fireId = null;
    this.el = h('div', { class: 'touch-ui' });
    // 左：移動スティック（左下 45% の領域で、触れた位置に出現）
    this.stickZone = h('div', { class: 't-stick-zone' });
    this.stickBase = h('div', { class: 't-stick-base' }, this.stickKnob = h('div', { class: 't-stick-knob' }));
    this.stickZone.append(this.stickBase);
    // 右：視点ドラッグ領域
    this.lookZone = h('div', { class: 't-look-zone' });
    this.el.append(this.lookZone, this.stickZone);
    // ボタン
    const btn = (cls, label, opts = {}) => {
      const b = h('div', { class: 't-btn ' + cls }, label);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        b.classList.add('on');
        try { b.setPointerCapture(e.pointerId); } catch { /* noop */ }
        if (opts.key) { inp.keys.add(opts.key); inp.justPressed.add(opts.key); }
        if (opts.mouse != null) inp.mouse[opts.mouse] = true;
        opts.down?.(e);
        if (opts.look) { this.fireId = e.pointerId; this.fireLast = { x: e.clientX, y: e.clientY }; }
      });
      b.addEventListener('pointermove', (e) => {
        if (opts.look && e.pointerId === this.fireId) {
          this.addLook(e.clientX - this.fireLast.x, e.clientY - this.fireLast.y);
          this.fireLast = { x: e.clientX, y: e.clientY };
        }
      });
      const up = (e) => {
        b.classList.remove('on');
        if (opts.key && !opts.toggle) inp.keys.delete(opts.key);
        if (opts.mouse != null) inp.mouse[opts.mouse] = false;
        if (opts.look && e.pointerId === this.fireId) this.fireId = null;
        opts.up?.(e);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      return b;
    };
    this.adsOn = false;
    const B = this.B = {
      fire: btn('t-fire', '射撃', { mouse: 0, look: true }),
      fire2: btn('t-fire2', '射撃', { mouse: 0, look: true }),
      ads: btn('t-ads', 'ADS', { down: () => { this.adsOn = !this.adsOn; } }),
      reload: btn('t-reload', 'R', { key: 'KeyR' }),
      jump: btn('t-jump', '▲', { key: 'Space' }),
      crouch: btn('t-crouch', '▼', { key: 'KeyC' }),
      nade: btn('t-nade', '💣', { key: 'KeyG' }),
      heal: btn('t-heal', '✚', { key: 'KeyH' }),
      swap: btn('t-swap', '⇄', { down: () => { inp.wheel += 1; } }),
      use: btn('t-use', '拾う', { key: 'KeyF' }),
      leanL: btn('t-leanl', '◀', { key: 'KeyQ' }),
      leanR: btn('t-leanr', '▶', { key: 'KeyE' }),
      sprint: btn('t-sprint', '走', { down: () => { this.sprintLock = !this.sprintLock; } }),
    };
    // 上部メニュー
    const top = h('div', { class: 't-top' },
      btn('t-small', '⏸', { down: () => game.showPause() }),
      btn('t-small', '🎒', { down: () => game.toggleInv() }),
      btn('t-small', '🗺', { down: () => game.toggleMap() }),
      btn('t-small', '⛳', { key: 'KeyO' }),
      btn('t-small', '💡', { key: 'KeyT' }),
      btn('t-small', 'B', { key: 'KeyB' }),
      btn('t-small', 'V', { key: 'KeyV' }),
    );
    this.el.append(...Object.values(B), top);
    game.root.append(this.el);
    game.root.classList.add('touch');
    this.bindZones();
  }

  addLook(dx, dy) {
    const k = 1.7 * (this.g.settings.touchSens ?? 1);
    this.inp.mdx += dx * k;
    this.inp.mdy += dy * k;
  }

  bindZones() {
    const inp = this.inp;
    const z = this.stickZone, base = this.stickBase, knob = this.stickKnob;
    const R = 56;
    z.addEventListener('pointerdown', (e) => {
      if (this.stickId != null) return;
      e.preventDefault();
      this.stickId = e.pointerId;
      try { z.setPointerCapture(e.pointerId); } catch { /* noop */ }
      const r = z.getBoundingClientRect();
      this.stickC = { x: e.clientX, y: e.clientY };
      base.style.left = e.clientX - r.left + 'px'; base.style.top = e.clientY - r.top + 'px';
      base.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      let dx = e.clientX - this.stickC.x, dy = e.clientY - this.stickC.y;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const mx = dx / R, my = dy / R;
      inp.moveX = Math.abs(mx) < 0.12 ? 0 : mx;
      inp.moveY = Math.abs(my) < 0.12 ? 0 : my;
      // スティックを前に倒し切るとダッシュ
      this.stickSprint = d > R * 1.25 && dy < -R * 0.7;
    });
    const end = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null; inp.moveX = 0; inp.moveY = 0; this.stickSprint = false;
      base.classList.remove('on');
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
    // 視点
    const L = this.lookZone;
    L.addEventListener('pointerdown', (e) => {
      if (this.lookId != null) return;
      e.preventDefault();
      this.lookId = e.pointerId; this.lookLast = { x: e.clientX, y: e.clientY };
      try { L.setPointerCapture(e.pointerId); } catch { /* noop */ }
    });
    L.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      this.addLook(e.clientX - this.lookLast.x, e.clientY - this.lookLast.y);
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    const lend = (e) => { if (e.pointerId === this.lookId) this.lookId = null; };
    L.addEventListener('pointerup', lend);
    L.addEventListener('pointercancel', lend);
  }

  // 毎フレーム：状態をボタン表示と入力に反映
  update() {
    const g = this.g, inp = this.inp;
    const P = g.player;
    inp.mouse[2] = this.adsOn && !g.invOpen;
    const sprint = (this.sprintLock && inp.moveY < -0.3) || this.stickSprint;
    if (sprint) inp.keys.add('ShiftLeft'); else inp.keys.delete('ShiftLeft');
    if (this.sprintLock && this.stickId != null && inp.moveY > 0.2) this.sprintLock = false;
    this.B.ads.classList.toggle('active', this.adsOn);
    this.B.sprint.classList.toggle('active', !!this.sprintLock);
    this.B.crouch.classList.toggle('active', !!P?.crouch);
    const t = g.target;
    this.B.use.classList.toggle('hidden', !t);
    if (t) {
      const label = { container: '漁る', door: t.open ? '閉める' : '開ける', ground: '拾う', body: '調べる', switch: '操作', extract: '支払う' }[t.kind] || '使う';
      if (this.B.use.textContent !== label) this.B.use.textContent = label;
    }
    const hide = g.rinv.open || g.mapOpen || g.pauseEl || g.ended;
    this.el.classList.toggle('hidden', !!hide);
  }

  dispose() { this.el.remove(); }
}

// 全画面＋横向き固定（対応ブラウザのみ）
export async function enterFullscreenLandscape() {
  try {
    const de = document.documentElement;
    if (!document.fullscreenElement && de.requestFullscreen) await de.requestFullscreen({ navigationUI: 'hide' });
  } catch { /* noop */ }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* noop */ }
}

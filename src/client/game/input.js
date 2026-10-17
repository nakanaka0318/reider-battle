// キーボード・マウス入力（ポインタロック）
export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = [false, false, false];
    this.mouseJust = [false, false, false];
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    this.ignoreUntil = 0;
    this.h = {
      kd: (e) => {
        if (e.target?.tagName === 'INPUT') return;
        if (!this.keys.has(e.code)) this.justPressed.add(e.code);
        this.keys.add(e.code);
        if (['Tab', 'Space', 'ControlLeft', 'KeyF', 'AltLeft'].includes(e.code) || (e.ctrlKey && ['KeyW', 'KeyS', 'KeyD'].includes(e.code))) e.preventDefault();
      },
      ku: (e) => { this.keys.delete(e.code); },
      md: (e) => { if (!this.locked) return; this.mouse[e.button] = true; this.mouseJust[e.button] = true; },
      mu: (e) => { this.mouse[e.button] = false; },
      mm: (e) => {
        if (!this.locked) return;
        // ロック直後や異常値（ブラウザのバグで巨大な値が来ることがある）は無視
        if (performance.now() < this.ignoreUntil || Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
        this.mdx += e.movementX; this.mdy += e.movementY;
      },
      wh: (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); },
      pl: () => {
        this.locked = document.pointerLockElement === this.el;
        if (!this.locked) { this.mouse = [false, false, false]; } else { this.ignoreUntil = performance.now() + 120; this.mdx = 0; this.mdy = 0; }
        this.onLockChange?.(this.locked);
      },
      blur: () => { this.keys.clear(); this.mouse = [false, false, false]; },
      ctx: (e) => { if (this.locked) e.preventDefault(); },
    };
    addEventListener('keydown', this.h.kd);
    addEventListener('keyup', this.h.ku);
    addEventListener('mousedown', this.h.md);
    addEventListener('mouseup', this.h.mu);
    addEventListener('mousemove', this.h.mm);
    addEventListener('wheel', this.h.wh, { passive: true });
    addEventListener('blur', this.h.blur);
    addEventListener('contextmenu', this.h.ctx);
    document.addEventListener('pointerlockchange', this.h.pl);
  }
  lock() {
    try {
      const p = this.el.requestPointerLock({ unadjustedMovement: true });
      if (p?.catch) p.catch(() => { try { this.el.requestPointerLock(); } catch { /* noop */ } });
    } catch { try { this.el.requestPointerLock(); } catch { /* noop */ } }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.enabled && this.keys.has(code); }
  pressed(code) { return this.enabled && this.justPressed.has(code); }
  endFrame() { this.justPressed.clear(); this.mouseJust = [false, false, false]; this.mdx = 0; this.mdy = 0; this.wheel = 0; }
  dispose() {
    removeEventListener('keydown', this.h.kd); removeEventListener('keyup', this.h.ku);
    removeEventListener('mousedown', this.h.md); removeEventListener('mouseup', this.h.mu);
    removeEventListener('mousemove', this.h.mm); removeEventListener('wheel', this.h.wh);
    removeEventListener('blur', this.h.blur); removeEventListener('contextmenu', this.h.ctx);
    document.removeEventListener('pointerlockchange', this.h.pl);
    this.unlock();
  }
}

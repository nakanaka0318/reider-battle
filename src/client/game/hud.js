// レイド中の HUD
import { h, fmt } from '../ui/dom.js';
import { ITEMS, weaponStats } from '../../shared/items.js';
import { PART_HP, PARTS, PART_NAMES } from '../../shared/combat.js';
import { fmtTime } from '../../shared/math.js';
import { MODE_NAMES } from '../ui/itemtip.js';
import { getItemIcon } from '../icons.js';

export class HUD {
  constructor(root) {
    this.el = h('div', { class: 'hud' });
    root.append(this.el);
    const E = this.E = {};
    E.vignette = h('div', { class: 'vignette' });
    E.flash = h('div', { class: 'flashwhite' });
    E.scope = h('canvas', { class: 'scope-overlay' });
    E.cross = h('div', { class: 'crosshair' }, h('i', { class: 'dot' }));
    E.lines = [0, 1, 2, 3].map(() => h('i'));
    E.cross.append(...E.lines);
    E.hit = h('div', { class: 'hitmarker' });
    E.dmg = h('div', { class: 'damage-ind' });
    E.compass = h('div', { class: 'compass' }, E.strip = h('div', { class: 'strip' }));
    E.needle = h('div', { class: 'compass-needle' });
    E.timer = h('div', { class: 'raid-timer num' });
    E.feed = h('div', { class: 'killfeed' });
    E.msgs = h('div', { class: 'msgs' });
    E.prompt = h('div', { class: 'prompt' });
    E.extract = h('div', { class: 'extract-bar' });
    E.exlist = h('div', { class: 'extract-list hidden' });
    E.use = h('div', { class: 'use-bar hidden' });
    E.hotbar = h('div', { class: 'hotbar' });
    E.fps = h('div', { class: 'fps' });
    E.net = h('div', { class: 'netinfo' });
    // 左下：体力・スタミナ
    E.doll = h('div', { class: 'doll' });
    const DOLL = { head: [26, 0, 18, 18], thorax: [20, 20, 30, 28], stomach: [22, 50, 26, 18], armL: [6, 20, 12, 40], armR: [52, 20, 12, 40], legL: [20, 70, 14, 48], legR: [36, 70, 14, 48] };
    E.parts = {};
    for (const [p, [x, y, w, hh]] of Object.entries(DOLL)) { const d = h('div', { style: { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' } }); E.parts[p] = d; E.doll.append(d); }
    E.status = h('div', { class: 'status-icons' });
    const bar = (label, color) => { const i = h('i', { style: { background: color } }); return { row: h('div', { class: 'bar-row' }, h('span', { style: { width: '42px' } }, label), h('div', { class: 'b' }, i)), i }; };
    E.hpBar = bar('体力', '#c8d0c8'); E.stBar = bar('スタミナ', '#d6a23a'); E.enBar = bar('エネルギー', '#d0a060'); E.hyBar = bar('水分', '#4a9ad0');
    E.hpNum = h('div', { class: 'num', style: { fontSize: '22px', textShadow: '0 1px 3px #000' } });
    E.weight = h('div', { class: 'mini', style: { textShadow: '0 1px 2px #000', color: '#bbb' } });
    E.bl = h('div', { class: 'hud-bl' }, E.doll, h('div', { class: 'bars' }, E.status, E.hpNum, E.hpBar.row, E.stBar.row, E.enBar.row, E.hyBar.row, E.weight));
    // 右下：弾薬
    E.ammo = h('div', { class: 'ammo-big' });
    E.wname = h('div', { class: 'weapon-name' });
    E.atype = h('div', { class: 'ammo-type' });
    E.br = h('div', { class: 'hud-br' }, E.wname, E.ammo, E.atype);
    E.chat = h('div', { class: 'chatlog' });
    this.el.append(E.vignette, E.scope, E.flash, E.cross, E.hit, E.dmg, E.compass, E.needle, E.timer, E.feed, E.msgs, E.prompt, E.extract, E.exlist, E.use, E.hotbar, E.bl, E.br, E.fps, E.net, E.chat);
    this.buildCompass();
    this.dmgInds = [];
    this.hitT = 0;
  }

  buildCompass() {
    const s = this.E.strip;
    const pxPerDeg = 3;
    this.pxPerDeg = pxPerDeg;
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -360; d <= 720; d += 15) {
      const n = ((d % 360) + 360) % 360;
      const L = labels[n];
      s.append(h('span', { class: 'tick' + (L ? ' major' : ''), style: { left: d * pxPerDeg + 'px' } }, L || (n % 45 === 0 ? n : '·')));
    }
  }

  update(g, dt) {
    const E = this.E;
    const P = g.player;
    // コンパス（yaw=0 で北 = -Z）
    let deg = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
    E.strip.style.transform = `translateX(${210 - deg * this.pxPerDeg}px)`;
    // タイマー
    const left = g.timeLeft;
    E.timer.textContent = fmtTime(left);
    E.timer.classList.toggle('low', left < 300);
    // 体力
    const S = g.selfState;
    if (S?.hp) {
      let tot = 0;
      for (const p of PARTS) {
        const v = S.hp[p], m = PART_HP[p] * (p === 'thorax' && g.isBoss ? 1 : 1);
        tot += v;
        const f = v / m;
        const col = S.dest?.[p] ? '#111' : f > 0.7 ? 'rgba(160,190,160,.85)' : f > 0.35 ? 'rgba(210,170,60,.9)' : 'rgba(210,60,40,.95)';
        E.parts[p].style.background = col;
        E.parts[p].style.outline = S.bleed?.[p] ? `2px solid ${S.bleed[p] === 2 ? '#ff2020' : '#d06060'}` : S.frac?.[p] ? '2px solid #e0c040' : 'none';
      }
      E.hpNum.textContent = `${Math.round(tot)} / 440`;
      E.hpBar.i.style.width = (tot / 440) * 100 + '%';
      E.enBar.i.style.width = S.en + '%';
      E.hyBar.i.style.width = S.hy + '%';
      // 状態アイコン
      const st = [];
      const bl = Object.values(S.bleed || {});
      if (bl.includes(2)) st.push(['重出血', '']);
      else if (bl.includes(1)) st.push(['出血', '']);
      if (Object.keys(S.frac || {}).length) st.push(['骨折', 'y']);
      if (S.pain > 0) st.push(['鎮痛 ' + Math.ceil(S.pain) + 's', 'g']);
      if (S.stims?.length) st.push(['刺激剤', 'g']);
      if (S.en < 15) st.push(['空腹', 'y']);
      if (S.hy < 15) st.push(['脱水', 'y']);
      const key = st.map((x) => x[0]).join();
      if (key !== this._stKey) { this._stKey = key; E.status.innerHTML = ''; for (const [t, c] of st) E.status.append(h('span', { class: c }, t)); }
      // 低体力のビネット
      const low = Math.max(0, 1 - tot / 220);
      E.vignette.style.background = `radial-gradient(ellipse at center, transparent ${55 - low * 20}%, rgba(120,0,0,${low * 0.55 + (g.hurtFlash || 0) * 0.4}) 100%)`;
    }
    E.stBar.i.style.width = P.stamina + '%';
    const wt = S?.wt ?? 0, cap = S?.cap ?? 22;
    E.weight.textContent = `重量 ${wt.toFixed(1)} / ${cap} kg`;
    E.weight.style.color = wt > cap + 18 ? '#ff7060' : wt > cap ? '#e0c060' : '#bbb';
    // 武器
    const w = P.weapon();
    if (w) {
      const def = ITEMS[w.id];
      const st = weaponStats(w);
      const mag = S?.mag;
      const cnt = mag ? Math.max(0, mag[0] - (g.pendingShots || 0)) : w.mag?.count ?? 0;
      const mode = def.weapon.modes[(S?.mode || 0) % def.weapon.modes.length];
      const reserve = g.reserveAmmo(def.weapon.caliber);
      E.wname.innerHTML = '';
      E.wname.append(def.name, h('span', { class: 'firemode' }, MODE_NAMES[mode]));
      E.ammo.innerHTML = '';
      E.ammo.append(String(cnt), h('small', {}, ` / ${reserve}`));
      E.ammo.style.color = cnt === 0 ? '#ff6050' : cnt <= st.capacity * 0.25 ? '#ffc060' : '#fff';
      E.atype.textContent = S?.reload ? 'リロード中…' : mag ? ITEMS[mag[1]]?.name || '' : '';
    } else { E.wname.textContent = '素手'; E.ammo.textContent = ''; E.atype.textContent = ''; }
    // クロスヘア（腰だめのみ）
    const showCross = !P.ads && !!w && !g.invOpen;
    E.cross.style.display = showCross ? '' : 'none';
    // 照準が敵に重なっているときは赤く
    const hot = g.aimTarget && g.aimTarget.ang < g.aimTarget.size * 1.2;
    if (hot !== this._hot) { this._hot = hot; E.cross.classList.toggle('hot', !!hot); }
    if (showCross && w) {
      const st = weaponStats(w);
      const spreadDeg = st.hipSpread * (P.moving ? 1.6 : 1) * (P.crouch ? 0.8 : 1);
      const px = Math.tan(spreadDeg * Math.PI / 180) / Math.tan((g.camera.fov * Math.PI) / 360) * innerHeight / 2 + 4;
      const [a, b, c, d] = E.lines;
      Object.assign(a.style, { width: '2px', height: '8px', left: '-1px', top: -px - 8 + 'px' });
      Object.assign(b.style, { width: '2px', height: '8px', left: '-1px', top: px + 'px' });
      Object.assign(c.style, { width: '8px', height: '2px', top: '-1px', left: -px - 8 + 'px' });
      Object.assign(d.style, { width: '8px', height: '2px', top: '-1px', left: px + 'px' });
    }
    // ヒットマーカー
    this.hitT -= dt;
    E.hit.style.opacity = this.hitT > 0 ? Math.min(1, this.hitT * 5) : 0;
    // 被弾方向
    for (let i = this.dmgInds.length - 1; i >= 0; i--) {
      const d = this.dmgInds[i];
      d.t -= dt;
      const ang = Math.atan2(-(d.x - P.pos.x), -(d.z - P.pos.z));
      const rel = ang - P.yaw;
      d.el.style.transform = `rotate(${-rel}rad)`;
      d.el.style.opacity = Math.max(0, d.t);
      if (d.t <= 0) { d.el.remove(); this.dmgInds.splice(i, 1); }
    }
    // フラッシュ
    if (g.flashT > 0) { g.flashT -= dt; E.flash.style.opacity = Math.min(1, g.flashT / 1.5); } else E.flash.style.opacity = 0;
    // 脱出
    if (S?.ext) {
      const ex = g.extracts.find((e) => e.id === S.ext[0]);
      const left = Math.max(0, 8 - S.ext[1]);
      E.extract.textContent = `${ex?.name || ''} — 脱出まで ${left.toFixed(1)} 秒`;
      if (Math.floor(left) !== this._lastExt) { this._lastExt = Math.floor(left); g.audio.extractTick(); }
    } else E.extract.textContent = '';
    // 使用中
    if (S?.use > 0) {
      E.use.classList.remove('hidden');
      if (!this._useEl) { E.use.innerHTML = ''; this._useLabel = h('div'); this._useBar = h('i'); E.use.append(this._useLabel, h('div', { class: 'progress' }, this._useBar)); this._useEl = true; }
      this._useLabel.textContent = `${g.usingName || '使用中'}… ${S.use.toFixed(1)}s`;
      const tot = g.usingDur || 3;
      this._useBar.style.width = (1 - S.use / tot) * 100 + '%';
    } else E.use.classList.add('hidden');
    if (g.settings.showFps) { E.fps.textContent = g.fps.toFixed(0) + ' FPS'; E.net.textContent = g.net.online ? `PING ${Math.round(g.net.ping)}ms` : 'OFFLINE'; }
    else { E.fps.textContent = ''; E.net.textContent = ''; }
  }

  hitmarker(kill, armor) {
    const E = this.E;
    E.hit.className = 'hitmarker' + (kill ? ' kill' : armor ? ' armor' : '');
    this.hitT = kill ? 0.6 : 0.25;
  }
  damageFrom(x, z) {
    const el = h('i');
    this.E.dmg.append(el);
    this.dmgInds.push({ el, x, z, t: 1.8 });
  }
  feed(html, mine = false) {
    const el = h('div', { class: mine ? 'mine' : '', html });
    this.E.feed.prepend(el);
    while (this.E.feed.children.length > 6) this.E.feed.lastChild.remove();
    setTimeout(() => { el.style.transition = 'opacity .6s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 700); }, 7000);
  }
  msg(text, warn = false) {
    const el = h('div', { class: warn ? 'warn' : '' }, text);
    this.E.msgs.append(el);
    while (this.E.msgs.children.length > 4) this.E.msgs.firstChild.remove();
    setTimeout(() => el.remove(), 3000);
  }
  setPrompt(p) {
    const E = this.E;
    const key = p ? p.key + p.name + (p.sub || '') + (p.progress ?? '') : '';
    if (key === this._pk) return;
    this._pk = key;
    E.prompt.innerHTML = '';
    if (!p) return;
    E.prompt.append(h('div', {}, h('kbd', {}, p.key), h('span', { class: 'pn' }, p.name)));
    if (p.sub) E.prompt.append(h('div', { class: 'ps' }, p.sub));
  }
  showExtracts(g, show) {
    const E = this.E;
    E.exlist.classList.toggle('hidden', !show);
    if (!show) return;
    E.exlist.innerHTML = '';
    E.exlist.append(h('div', { style: { color: '#e8c26a', fontWeight: 700, marginBottom: '4px' } }, '脱出地点'));
    for (const e of g.extracts) {
      const d = Math.hypot(e.x - g.player.pos.x, e.z - g.player.pos.z);
      const cond = e.type === 'pay' ? `（${fmt(e.cost)} C）` : e.type === 'key' ? '（キーカード）' : e.type === 'switch' ? (e.open ? '' : '（電源オフ）') : e.type === 'random' ? (e.open ? '' : '（不確定）') : '';
      E.exlist.append(h('div', { class: 'ex' + (e.open === false && e.type !== 'random' ? ' closed' : '') }, h('span', {}, e.name + cond), h('span', { class: 'd' }, Math.round(d) + 'm')));
    }
  }
  hotbar(slots, activeUid) {
    const E = this.E;
    const key = slots.map((s) => s?.uid + (s?.count || '')).join() + activeUid;
    if (key === this._hb) return;
    this._hb = key;
    E.hotbar.innerHTML = '';
    slots.forEach((it, i) => {
      const el = h('div', { class: 'hs' + (it && it.uid === activeUid ? ' active' : '') }, h('b', {}, String(i + 4)));
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.onHotbar?.(i); });
      if (it) {
        el.style.backgroundImage = `url(${getItemIcon(ITEMS[it.id])})`;
        if (ITEMS[it.id].med?.uses > 1) el.append(h('span', {}, it.uses));
      }
      E.hotbar.append(el);
    });
  }
  scope(show, zoom, reticle) {
    const c = this.E.scope;
    if (!show) { c.style.display = 'none'; this._scopeKey = null; return; }
    c.style.display = 'block';
    const key = innerWidth + 'x' + innerHeight + reticle;
    if (key === this._scopeKey) return;
    this._scopeKey = key;
    c.width = innerWidth; c.height = innerHeight;
    const g = c.getContext('2d');
    const r = Math.min(innerWidth, innerHeight) * 0.46;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    g.fillStyle = '#000';
    g.beginPath(); g.rect(0, 0, innerWidth, innerHeight); g.arc(cx, cy, r, 0, Math.PI * 2, true); g.fill();
    const gr = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.85)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = reticle === 'thermal' ? '#ff5040' : '#111'; g.lineWidth = 1.5;
    if (reticle === 'chevron') {
      g.fillStyle = '#d02010';
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 8, cy + 10); g.lineTo(cx - 5, cy + 10); g.lineTo(cx, cy + 4); g.lineTo(cx + 5, cy + 10); g.lineTo(cx + 8, cy + 10); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx, cy + 12); g.lineTo(cx, cy + r); g.stroke();
    } else {
      g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx - 12, cy); g.moveTo(cx + 12, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy - 12); g.moveTo(cx, cy + 12); g.lineTo(cx, cy + r); g.stroke();
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx - r * 0.55, cy); g.moveTo(cx + r * 0.55, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy + r * 0.55); g.lineTo(cx, cy + r); g.stroke();
      if (reticle === 'mil') { g.lineWidth = 1; for (let i = -5; i <= 5; i++) { if (!i) continue; g.beginPath(); g.arc(cx + i * r * 0.07, cy, 2, 0, 7); g.fill(); g.beginPath(); g.arc(cx, cy + i * r * 0.07, 2, 0, 7); g.fill(); } }
      g.fillStyle = reticle === 'thermal' ? '#ff5040' : '#d02010';
      g.beginPath(); g.arc(cx, cy, 1.6, 0, 7); g.fill();
    }
    void zoom;
  }
  chat(text) {
    const el = h('div', {}, text);
    this.E.chat.append(el);
    while (this.E.chat.children.length > 6) this.E.chat.firstChild.remove();
    setTimeout(() => el.remove(), 12000);
  }
  dispose() { this.el.remove(); }
}
export { PART_NAMES };

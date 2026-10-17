// DOM ユーティリティ・トースト・モーダル・ツールチップ
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);

let toastBox = null;
export function toast(text, kind = '') {
  if (!toastBox) { toastBox = h('div', { class: 'toasts' }); document.body.append(toastBox); }
  const t = h('div', { class: 'toast ' + kind }, text);
  toastBox.append(t);
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 2600);
  setTimeout(() => t.remove(), 3100);
}

export function modal(title, body, buttons = [], opts = {}) {
  const bg = h('div', { class: 'modal-bg' });
  const close = () => { bg.remove(); opts.onClose?.(); };
  const m = h('div', { class: 'modal', style: opts.width ? { width: opts.width } : null },
    h('div', { class: 'panel-h' }, title, h('span', { class: 'close', onclick: close }, '✕')),
    h('div', { class: 'panel-b' }, body),
    buttons.length ? h('div', { class: 'modal-foot' }, buttons.map((b) => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => { if (b.fn?.() !== false) close(); } }, b.text))) : null,
  );
  bg.append(m);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg && !opts.sticky) close(); });
  document.body.append(bg);
  return { close, el: m };
}

export function confirmBox(title, text, okText = 'OK') {
  return new Promise((res) => {
    modal(title, h('div', { style: { maxWidth: '420px', lineHeight: 1.6 } }, text), [
      { text: 'キャンセル', fn: () => res(false) },
      { text: okText, cls: 'primary', fn: () => res(true) },
    ], { onClose: () => res(false) });
  });
}

let tip = null;
export function showTooltip(content, x, y) {
  if (!tip) { tip = h('div', { class: 'tooltip' }); document.body.append(tip); }
  tip.innerHTML = '';
  tip.append(content);
  tip.style.display = 'block';
  moveTooltip(x, y);
}
export function moveTooltip(x, y) {
  if (!tip || tip.style.display === 'none') return;
  const r = tip.getBoundingClientRect();
  let tx = x + 16, ty = y + 16;
  if (tx + r.width > innerWidth - 8) tx = x - r.width - 12;
  if (ty + r.height > innerHeight - 8) ty = Math.max(8, innerHeight - r.height - 8);
  tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
}
export function hideTooltip() { if (tip) tip.style.display = 'none'; }

let ctxEl = null;
export function contextMenu(x, y, items) {
  closeContext();
  ctxEl = h('div', { class: 'ctx' }, items.map((it) => h('div', { class: it.disabled ? 'dis' : '', onpointerdown: (e) => { e.stopPropagation(); e.preventDefault(); if (it.disabled) return; closeContext(); it.fn(); } }, it.text)));
  document.body.append(ctxEl);
  const r = ctxEl.getBoundingClientRect();
  ctxEl.style.left = Math.min(x, innerWidth - r.width - 6) + 'px';
  ctxEl.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
  setTimeout(() => addEventListener('pointerdown', closeContext, { once: true }), 0);
}
export function closeContext() { ctxEl?.remove(); ctxEl = null; }

export function fmt(n) { return Math.round(n).toLocaleString('ja-JP'); }

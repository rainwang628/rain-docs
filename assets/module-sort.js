(() => {
  'use strict';
  const grid = document.getElementById('module-grid');
  if (!grid) return;
  const key = 'rain.module-order.v1';
  let initialized = false;
  const cards = () => [...grid.querySelectorAll(':scope > a.tile')];
  const id = card => card.dataset.sortId;
  function save() {
    try { localStorage.setItem(key, JSON.stringify(cards().map(id))); } catch {}
  }
  function restore() {
    let order = [];
    try { const stored = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(stored)) order = stored; } catch {}
    const items = cards(), byId = new Map(items.map(card => [id(card), card]));
    for (const name of order) if (byId.has(name)) grid.append(byId.get(name));
    // Newly added modules keep their original relative position at the end.
    for (const card of items) if (!order.includes(id(card))) grid.append(card);
  }
  function enable() {
    if (initialized || !window.RAIN_SITE_ACCESS?.ready || !window.RAIN_SITE_ACCESS.owner) return;
    initialized = true;
    restore();
    for (const card of cards()) {
      const handle = document.createElement('span');
      handle.className = 'tile-drag-handle';
      handle.setAttribute('role', 'button');
      handle.setAttribute('tabindex', '0');
      handle.setAttribute('aria-label', '拖动调整' + (card.querySelector('h2')?.textContent || '模块') + '的顺序');
      handle.setAttribute('title', '按住拖动排序；也可用方向键调整');
      handle.textContent = '⠿';
      card.append(handle);
      let pointer = null, moved = false;
      handle.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
      handle.addEventListener('pointerdown', e => {
        if (e.button !== 0 || !e.isPrimary) return;
        e.preventDefault(); e.stopPropagation();
        pointer = e.pointerId; moved = false;
        handle.setPointerCapture(e.pointerId);
        card.classList.add('tile-dragging');
      });
      handle.addEventListener('pointermove', e => {
        if (pointer !== e.pointerId) return;
        const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('#module-grid > a.tile');
        if (!under || under === card || under.hidden) return;
        const rect = under.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        grid.insertBefore(card, before ? under : under.nextSibling);
        moved = true;
      });
      const end = e => {
        if (pointer !== e.pointerId) return;
        pointer = null;
        card.classList.remove('tile-dragging');
        if (moved) { save(); announce('模块顺序已保存'); }
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
      handle.addEventListener('keydown', e => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        const visible = cards().filter(c => !c.hidden), at = visible.indexOf(card);
        const step = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
        const next = visible[at + step];
        if (!next) return;
        grid.insertBefore(card, step < 0 ? next : next.nextSibling);
        save(); announce('模块顺序已保存');
        handle.focus();
      });
    }
  }
  function announce(message) {
    const el = document.getElementById('module-sort-status');
    if (el) el.textContent = message;
  }
  window.addEventListener('rain:access', enable);
  enable();
})();
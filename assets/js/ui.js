/* Overlay primitives: toasts, modals and the character picker popover. */

import { esc, attr } from './util.js';
import { ico } from './icons.js';

const overlay = () => document.getElementById('overlay');
const toastHost = () => document.getElementById('toasts');

/* ---------------------------------------------------------------- toasts */

export function toast(kind, message, detail = '') {
  const host = toastHost();
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = `
    <span class="toast-icon">${ico(kind === 'error' ? 'warning' : kind === 'info' ? 'info' : 'check', 16)}</span>
    <div class="toast-body">
      <strong>${esc(message)}</strong>
      ${detail ? `<span>${esc(detail)}</span>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss">${ico('x', 14)}</button>`;
  const remove = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector('.toast-close').addEventListener('click', remove);
  host.appendChild(el);
  setTimeout(remove, kind === 'error' ? 8000 : 4200);
}

/* ---------------------------------------------------------------- modals */

let activeModal = null;

export function closeModal() {
  if (!activeModal) return;
  activeModal.remove();
  activeModal = null;
  document.body.classList.remove('has-overlay');
}

export function openModal({ title, subtitle = '', body = '', footer = '', wide = false, onMount } = {}) {
  closeModal();
  const root = overlay();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${attr(title)}">
      <header class="modal-head">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </div>
        <button class="icon-btn" data-modal-close aria-label="Close">${ico('x', 18)}</button>
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;
  wrap.addEventListener('click', (event) => {
    if (event.target === wrap) closeModal();
  });
  wrap.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  root.appendChild(wrap);
  activeModal = wrap;
  document.body.classList.add('has-overlay');
  if (onMount) onMount(wrap);
  const focusable = wrap.querySelector('input, select, textarea, button');
  if (focusable) setTimeout(() => focusable.focus(), 30);
  return wrap;
}

export function confirmAction({
  title,
  message,
  detail = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };
    const modal = openModal({
      title,
      body: `
        <p class="modal-text">${esc(message)}</p>
        ${detail ? `<p class="modal-note">${esc(detail)}</p>` : ''}`,
      footer: `
        <button class="btn ghost" data-confirm="no">${esc(cancelLabel)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-confirm="yes">${esc(confirmLabel)}</button>`,
    });
    modal.querySelector('[data-confirm="no"]').addEventListener('click', () => finish(false));
    modal.querySelector('[data-confirm="yes"]').addEventListener('click', () => finish(true));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) finish(false);
    });
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (activePopover) closePopover();
  else closeModal();
});

/* --------------------------------------------------------------- popover */

let activePopover = null;

export function closePopover() {
  if (!activePopover) return;
  const { el, onOutside } = activePopover;
  activePopover = null;
  if (onOutside) document.removeEventListener('mousedown', onOutside, true);
  el.remove();
}

/**
 * Character picker. `items` is a list of {id, name, ilvl, className}.
 * onPick(name) is called with the chosen name (empty string clears the cell).
 */
export function openCharacterPopover(anchor, { player, items, current, onPick }) {
  closePopover();
  const el = document.createElement('div');
  el.className = 'popover';
  el.innerHTML = `
    <div class="popover-head">
      <span class="player-dot" style="--pc:${attr(player.color || '#a855f7')}"></span>
      <strong>${esc(player.name)}</strong>
      <span class="popover-hint">characters</span>
    </div>
    <div class="popover-search">
      ${ico('search', 14)}
      <input type="text" placeholder="Search or type a new name…" autocomplete="off" spellcheck="false" />
    </div>
    <div class="popover-list" role="listbox"></div>
    <div class="popover-foot">
      <button class="link-btn" data-pop="clear">${ico('x', 12)} Clear cell</button>
      <span class="popover-keys"><kbd>↵</kbd> pick <kbd>esc</kbd> close</span>
    </div>`;

  const input = el.querySelector('input');
  const list = el.querySelector('.popover-list');

  const renderList = () => {
    const query = input.value.trim().toLowerCase();
    const matches = items.filter((item) => !query || item.name.toLowerCase().includes(query));
    const exact = items.some((item) => item.name.toLowerCase() === query);
    const showCreate = query && !exact;
    list.innerHTML =
      matches
        .slice(0, 40)
        .map(
          (item) => `
        <button class="pop-item ${item.name === current ? 'is-current' : ''}" data-name="${attr(item.name)}" role="option">
          <span class="pop-name">${esc(item.name)}</span>
          <span class="pop-meta">${item.ilvl ? `iLvl ${esc(item.ilvl)}` : ''}${item.className ? ` · ${esc(item.className)}` : ''}</span>
        </button>`,
        )
        .join('') +
      (showCreate
        ? `<button class="pop-item pop-create" data-name="${attr(input.value.trim())}">
             ${ico('plus', 14)} Add “${esc(input.value.trim())}” to ${esc(player.name)}
           </button>`
        : '') +
      (!matches.length && !showCreate ? `<div class="pop-empty">No characters yet — type a name to add one.</div>` : '');
  };

  renderList();

  input.addEventListener('input', renderList);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = list.querySelector('.pop-item');
      if (first) {
        onPick(first.dataset.name);
        closePopover();
      }
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      list.querySelector('.pop-item')?.focus();
    }
  });

  el.addEventListener('click', (event) => {
    const item = event.target.closest('.pop-item');
    if (item) {
      onPick(item.dataset.name);
      closePopover();
      return;
    }
    if (event.target.closest('[data-pop="clear"]')) {
      onPick('');
      closePopover();
    }
  });

  document.getElementById('overlay').appendChild(el);

  // Position under the anchor, flipping up when there is no room.
  const rect = anchor.getBoundingClientRect();
  const width = 260;
  const height = 330;
  let left = Math.min(rect.left, window.innerWidth - width - 12);
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 6);
  el.style.left = `${Math.max(12, left)}px`;
  el.style.top = `${top}px`;

  activePopover = { el };
  setTimeout(() => {
    input.focus();
    input.select();
  }, 20);

  // Close on outside click (after the opening click finishes).
  setTimeout(() => {
    const onOutside = (event) => {
      if (!el.contains(event.target)) closePopover();
    };
    document.addEventListener('mousedown', onOutside, true);
    if (activePopover) activePopover.onOutside = onOutside;
  }, 0);

  return el;
}

/* -------------------------------------------------------------- fragments */

export function progressBar(value, max, tone = 'gold') {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return `<div class="progress tone-${tone}"><span style="width:${pct}%"></span></div>`;
}

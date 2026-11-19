/* Overlay primitives: toasts, modals and the character picker popover. */

import { esc, attr } from './util.js';
import { ico } from './icons.js';
import { classBadge } from './classbadge.js';

const overlay = () => document.getElementById('overlay');
const toastHost = () => document.getElementById('toasts');

const finePointer = () => !window.matchMedia || window.matchMedia('(pointer: fine)').matches;

/* --------------------------------------------------------------- feedback */

export const spinner = (size = 14) => `<span class="spinner" style="--sp:${size}px" aria-hidden="true"></span>`;

/** Swap a button into a disabled "spinner + label" state and back. */
export function setButtonBusy(button, busy, label = 'Working…') {
  if (!button) return;
  if (busy) {
    if (button.dataset.busy === '1') return;
    button.dataset.busy = '1';
    button.dataset.idleHtml = button.innerHTML;
    if ('disabled' in button) button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `${spinner(14)}<span>${esc(label)}</span>`;
  } else {
    if (button.dataset.busy !== '1') return;
    delete button.dataset.busy;
    if ('disabled' in button) button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.idleHtml) button.innerHTML = button.dataset.idleHtml;
    delete button.dataset.idleHtml;
  }
}

/** Run `fn` while the button shows what it is doing. Never leaves it stuck. */
export async function withBusy(button, label, fn) {
  if (!button || button.dataset.busy === '1') return undefined;
  setButtonBusy(button, true, label);
  try {
    return await fn();
  } finally {
    setButtonBusy(button, false);
  }
}

/* ---------------------------------------------------------------- toasts */

export function toast(kind, message, detail = '') {
  const host = toastHost();
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  // #toasts is a polite live region; errors announce themselves assertively.
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${ico(kind === 'error' ? 'warning' : kind === 'info' ? 'info' : 'check', 16)}</span>
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
let modalReturnFocus = null;
let modalSeq = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Everything behind the dialog leaves the tab order and the accessibility tree. */
function setBackgroundInert(on) {
  Array.from(document.body.children).forEach((el) => {
    if (el.id === 'overlay' || el.id === 'toasts') return;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') return;
    el.inert = on;
  });
}

function trapFocus(event) {
  if (event.key !== 'Tab' || !activeModal) return;
  const items = Array.from(activeModal.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function closeModal() {
  if (!activeModal) return;
  activeModal.remove();
  activeModal = null;
  document.body.classList.remove('has-overlay');
  setBackgroundInert(false);
  const back = modalReturnFocus;
  modalReturnFocus = null;
  if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
}

export function openModal({ title, subtitle = '', body = '', footer = '', wide = false, onMount } = {}) {
  closeModal();
  if (document.activeElement instanceof HTMLElement) modalReturnFocus = document.activeElement;
  const root = overlay();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  const titleId = `modal-title-${++modalSeq}`;
  wrap.innerHTML = `
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <header class="modal-head">
        <div>
          <h2 id="${titleId}">${esc(title)}</h2>
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
  wrap.addEventListener('keydown', trapFocus);
  root.appendChild(wrap);
  activeModal = wrap;
  document.body.classList.add('has-overlay');
  setBackgroundInert(true);
  if (onMount) onMount(wrap);
  // Focus the first real field, not the close button. Touch keyboards stay down.
  if (finePointer()) {
    const field = wrap.querySelector('.modal-body input:not([type="hidden"]):not([type="file"]), .modal-body select, .modal-body textarea');
    const target = field || wrap.querySelector('[data-modal-save]') || wrap.querySelector(FOCUSABLE);
    if (target) setTimeout(() => target.focus(), 30);
  }
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

export function closePopover({ restoreFocus = true } = {}) {
  if (!activePopover) return;
  const { el, onOutside, restoreTo } = activePopover;
  activePopover = null;
  if (onOutside) document.removeEventListener('mousedown', onOutside, true);
  el.remove();
  if (restoreFocus && restoreTo && restoreTo.isConnected && typeof restoreTo.focus === 'function') {
    restoreTo.focus({ preventScroll: true });
  }
}

/** Open under the anchor, flipping above when the window runs out of room. */
function placePopover(el, anchor, width = 300, height = 360) {
  const rect = anchor.getBoundingClientRect();
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 6);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function wireSharedPopover(el, anchor) {
  document.getElementById('overlay').appendChild(el);
  placePopover(el, anchor, el.offsetWidth || 300, el.offsetHeight || 360);
  activePopover = { el, restoreTo: anchor };
  // Close on outside click (after the opening click finishes).
  setTimeout(() => {
    if (!activePopover) return;
    const onOutside = (event) => {
      if (!el.contains(event.target)) closePopover({ restoreFocus: false });
    };
    document.addEventListener('mousedown', onOutside, true);
    if (activePopover) activePopover.onOutside = onOutside;
  }, 0);
}

/**
 * Character picker. `items` is a list of {id, name, ilvl, className, portrait}.
 * onPick(name) is called with the chosen name (empty string clears the cell).
 * The search field owns the listbox: one tab stop, arrow keys move the active
 * option, Enter picks it.
 */
export function openCharacterPopover(anchor, { player, items, current, onPick }) {
  closePopover({ restoreFocus: false });
  const el = document.createElement('div');
  el.className = 'popover';
  el.innerHTML = `
    <div class="popover-head">
      <span class="player-dot" style="--pc:${attr(player.color || '#a855f7')}" aria-hidden="true"></span>
      <strong>${esc(player.name)}</strong>
      <span class="popover-hint">characters</span>
    </div>
    <div class="popover-search">
      ${ico('search', 14)}
      <input type="text" role="combobox" aria-expanded="true" aria-controls="pop-list" aria-autocomplete="list"
        aria-label="Search characters for ${attr(player.name)}"
        placeholder="Search or type a new name…" autocomplete="off" spellcheck="false" />
    </div>
    <div class="popover-list" role="listbox" id="pop-list" aria-label="Characters for ${attr(player.name)}"></div>
    <div class="popover-foot">
      <button class="link-btn" data-pop="clear">${ico('x', 12)} Clear cell</button>
      <span class="popover-keys"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>↵</kbd> pick <kbd>esc</kbd> close</span>
    </div>`;

  const input = el.querySelector('input');
  const list = el.querySelector('.popover-list');
  let activeIndex = -1;

  const options = () => Array.from(list.querySelectorAll('.pop-item'));

  const paintActive = () => {
    const opts = options();
    opts.forEach((option, index) => {
      option.classList.toggle('is-active', index === activeIndex);
      option.setAttribute('aria-selected', String(index === activeIndex));
    });
    const active = opts[activeIndex];
    if (active) input.setAttribute('aria-activedescendant', active.id);
    else input.removeAttribute('aria-activedescendant');
    active?.scrollIntoView({ block: 'nearest' });
  };

  const renderList = () => {
    const query = input.value.trim().toLowerCase();
    const matches = items.filter((item) => !query || item.name.toLowerCase().includes(query));
    const exact = items.some((item) => item.name.toLowerCase() === query);
    const showCreate = query && !exact;
    const shown = matches.slice(0, 40);
    list.innerHTML =
      shown
        .map(
          (item, index) => `
        <button class="pop-item ${item.name === current ? 'is-current' : ''}" id="pop-opt-${index}"
          role="option" aria-selected="false" tabindex="-1" data-name="${attr(item.name)}">
          ${
            item.portrait
              ? `<img class="pop-portrait" src="${attr(item.portrait)}" alt="" width="54" height="44" loading="lazy" decoding="async" />`
              : classBadge(item.className, 30)
          }
          <span class="pop-text">
            <span class="pop-name">${esc(item.name)}</span>
            <span class="pop-meta">${item.ilvl ? `iLvl ${esc(item.ilvl)}` : ''}${item.className ? ` · ${esc(item.className)}` : ''}</span>
          </span>
        </button>`,
        )
        .join('') +
      (showCreate
        ? `<button class="pop-item pop-create" id="pop-opt-${shown.length}" role="option" aria-selected="false" tabindex="-1" data-name="${attr(input.value.trim())}">
             ${ico('plus', 14)} Add “${esc(input.value.trim())}” to ${esc(player.name)}
           </button>`
        : '') +
      (!matches.length && !showCreate ? `<div class="pop-empty">No characters yet — type a name to add one.</div>` : '');
    activeIndex = options().length ? 0 : -1;
    paintActive();
  };

  const pick = (name) => {
    onPick(name);
    // The board re-renders on write, so the caller owns focus after a pick.
    closePopover({ restoreFocus: false });
  };

  renderList();

  input.addEventListener('input', renderList);
  input.addEventListener('keydown', (event) => {
    const opts = options();
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = opts[activeIndex] || opts[0];
      if (target) pick(target.dataset.name);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!opts.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + step + opts.length) % opts.length;
      paintActive();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!opts.length) return;
      activeIndex = event.key === 'Home' ? 0 : opts.length - 1;
      paintActive();
    }
  });

  el.addEventListener('click', (event) => {
    const item = event.target.closest('.pop-item');
    if (item) {
      pick(item.dataset.name);
      return;
    }
    if (event.target.closest('[data-pop="clear"]')) pick('');
  });

  wireSharedPopover(el, anchor);

  setTimeout(() => {
    input.focus();
    input.select();
  }, 20);

  return el;
}

/** Small action menu for a row (touch has no hover to reveal the inline tools). */
export function openActionMenu(anchor, { title = 'Actions', items = [] } = {}) {
  closePopover({ restoreFocus: false });
  const el = document.createElement('div');
  el.className = 'popover popover-menu';
  el.setAttribute('role', 'menu');
  el.setAttribute('aria-label', title);
  el.innerHTML = `
    <div class="popover-head"><strong>${esc(title)}</strong></div>
    <div class="popover-list">
      ${items
        .map(
          (item, index) => `
        <button class="pop-item menu-item ${item.danger ? 'is-danger' : ''}" role="menuitem" tabindex="-1" data-index="${index}">
          ${item.icon ? ico(item.icon, 14) : ''}
          <span class="pop-text">
            <span class="pop-name">${esc(item.label)}</span>
            ${item.hint ? `<span class="pop-meta">${esc(item.hint)}</span>` : ''}
          </span>
        </button>`,
        )
        .join('')}
    </div>`;

  const buttons = Array.from(el.querySelectorAll('.menu-item'));
  const focusAt = (index) => buttons[(index + buttons.length) % buttons.length]?.focus();

  el.addEventListener('click', (event) => {
    const button = event.target.closest('.menu-item');
    if (!button) return;
    const item = items[Number(button.dataset.index)];
    closePopover({ restoreFocus: false });
    item?.onSelect?.();
  });

  el.addEventListener('keydown', (event) => {
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(buttons.length - 1);
    }
  });

  wireSharedPopover(el, anchor, 240, 200);
  setTimeout(() => focusAt(0), 20);
  return el;
}

/* -------------------------------------------------------------- fragments */

export function progressBar(value, max, tone = 'gold') {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  // The bar is decorative: every caller prints the same numbers as text next to it.
  return `<div class="progress tone-${tone}" aria-hidden="true"><span style="transform:scaleX(${pct / 100})"></span></div>`;
}

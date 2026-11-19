/* App shell + event wiring. Views are pure functions of state; every click
   goes through one delegated listener, which keeps the whole thing small. */

import {
  state,
  subscribe,
  onNotice,
  init,
  setRoute,
  setWeek,
  stepWeek,
  goCurrentWeek,
  setFocusRaid,
  toggleClear,
  addRun,
  duplicateRun,
  removeRun,
  setCell,
  addCharacter,
  updateCharacter,
  deleteCharacter,
  addLedger,
  removeLedger,
  upsertRaid,
  removeRaid,
  updatePlayer,
  connect,
  disconnect,
  pushToSheet,
  pushSeed,
  resetDemo,
  importData,
  exportPayload,
  manualRefresh,
  retryQueue,
  setGoldMode,
  saveSettings,
  consumeInviteHash,
  buildInvite,
  savePortrait,
  removePortrait,
  currentStats,
} from './store.js';
import { $, esc, attr, fmt, num, weekLabel, weekYear, ago, download, colorFor } from './util.js';
import { ico } from './icons.js';
import {
  toast,
  openModal,
  closeModal,
  confirmAction,
  openCharacterPopover,
  openActionMenu,
  closePopover,
  withBusy,
  setButtonBusy,
  spinner,
} from './ui.js';
import { renderBoard } from './views/board.js';
import { renderRoster } from './views/roster.js';
import { renderSummary } from './views/summary.js';
import { renderLedger } from './views/ledger.js';
import { renderSettings } from './views/settings.js';
import { portraitFor, portraitFallbackFor } from './portraits.js';
import { classColor, classInfo } from './classes.js';
import { classBadge } from './classbadge.js';
import { classPicker, wireClassPicker } from './classpicker.js';
import { readPortraitFile, displayWidthFor } from './image.js';

const ROUTES = {
  board: { label: 'Board', icon: 'sword', render: renderBoard },
  roster: { label: 'Roster', icon: 'users', render: renderRoster },
  summary: { label: 'Gold', icon: 'chart', render: renderSummary },
  ledger: { label: 'Ledger', icon: 'ledger', render: renderLedger },
  settings: { label: 'Settings', icon: 'settings', render: renderSettings },
};

const weekFromHash = () => {
  const raw = location.hash.replace(/^#\/?/, '') || 'board';
  const [route, param] = raw.split('/');
  if (route === 'raid' && param) return { route: 'board', raidId: decodeURIComponent(param) };
  return { route: ROUTES[route] ? route : 'board', raidId: '' };
};

/* The week lives in ?w=YYYY-MM-DD so a week view can be linked and restored. */
const WEEK_PARAM = 'w';
const ISO_WEEK = /^\d{4}-\d{2}-\d{2}$/;

let offline = navigator.onLine === false;
let updateReady = Boolean(window.__loandomUpdate);

window.addEventListener('online', () => {
  offline = false;
  render();
});
window.addEventListener('offline', () => {
  offline = true;
  render();
});
window.addEventListener('loandom:update', () => {
  updateReady = true;
  render();
});

function weekFromUrl() {
  const value = new URLSearchParams(location.search).get(WEEK_PARAM) || '';
  return ISO_WEEK.test(value) ? value : '';
}

function syncWeekUrl(week) {
  const url = new URL(location.href);
  if (url.searchParams.get(WEEK_PARAM) === week) return;
  url.searchParams.set(WEEK_PARAM, week);
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function applyHash() {
  const { route, raidId } = weekFromHash();
  setFocusRaid(raidId);
  setRoute(route);
}

/* ---------------------------------------------------------------- shell */

function syncPill() {
  const { status, sync } = state;
  if (status !== 'remote') {
    return `<button class="sync-pill is-demo" data-act="goto" data-route="settings" title="Data lives in this browser" aria-label="Demo mode, data lives in this browser">
      ${ico('cloudOff', 14)} <span aria-live="polite">Demo · local</span>
    </button>`;
  }
  if (sync.state === 'saving') {
    const task = TASKS[sync.task];
    const label = task ? task.label : `Saving…${sync.pending ? ` · ${sync.pending}` : ''}`;
    return `<button class="sync-pill is-saving" disabled aria-busy="true" aria-label="${attr(label)}">${spinner(13)} <span aria-live="polite">${esc(label)}</span></button>`;
  }
  if (sync.state === 'error') {
    const failed = sync.failedTask;
    const label =
      failed === 'seed'
        ? 'Reset failed'
        : failed === 'push'
          ? 'Push failed'
          : failed === 'refresh'
            ? 'Sync failed'
            : `Not saved${sync.pending ? ` · ${sync.pending}` : ''}`;
    return `<button class="sync-pill is-error" data-act="retry" title="${attr(sync.error)}" aria-label="${attr(`${label}, retry`)}">
      ${ico('warning', 14)} <span aria-live="polite">${esc(label)}</span>
    </button>`;
  }
  if (sync.pending > 0) {
    return `<button class="sync-pill is-saving" data-act="retry" title="Changes are queued — click to send now" aria-label="${attr(`${sync.pending} queued change${sync.pending === 1 ? '' : 's'}, retry now`)}">
      ${ico('upload', 14)} <span aria-live="polite">Queued · ${sync.pending}</span>
    </button>`;
  }
  if (state.readOnly) {
    return `<button class="sync-pill is-readonly" data-act="goto" data-route="settings" title="Read-only access — ask for the editor link" aria-label="Read-only access">
      ${ico('key', 14)} <span aria-live="polite">Read-only</span>
    </button>`;
  }
  return `<button class="sync-pill is-on" data-act="sync-now" title="Revision ${attr(sync.revision)} · click to sync now" aria-label="Synced ${attr(ago(sync.at))}, sync now">
    ${ico('cloud', 14)} <span aria-live="polite">Synced ${esc(ago(sync.at))}</span>
  </button>`;
}

function renderTopbar(stats) {
  const nav = $('#nav');
  if (nav) {
    nav.innerHTML = Object.entries(ROUTES)
      .map(
        ([id, route]) => `
        <a class="nav-link ${state.route === id ? 'is-active' : ''}" href="#/${id}"${state.route === id ? ' aria-current="page"' : ''}>
          ${ico(route.icon, 15)}<span>${route.label}</span>
        </a>`,
      )
      .join('');
  }

  const weeknav = $('#weeknav');
  if (weeknav) {
    weeknav.innerHTML = `
      <button class="week-arrow" data-act="week-prev" aria-label="Previous week">${ico('chevronLeft', 16)}</button>
      <span class="week-now" title="Week of ${attr(weekLabel(state.week))} — resets ${esc(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][num(state.settings.resetDay)] || 'Wednesday')} ${esc(state.settings.resetHour)}:00">
        <span class="week-now-label">${esc(weekLabel(state.week))}</span>
        <span class="week-now-year">${esc(weekYear(state.week))}</span>
      </span>
      <button class="week-arrow" data-act="week-next" aria-label="Next week">${ico('chevronRight', 16)}</button>
      <button class="week-today" data-act="week-today" title="Jump to the current reset week" aria-label="Jump to this week">${ico('clock', 13)}</button>`;
  }

  const pill = $('#sync-pill');
  if (pill) pill.innerHTML = syncPill();
}

function renderTotals(stats) {
  const host = $('#totals');
  if (!host) return;
  const t = stats.totals;
  const html = `
    <div class="totals-inner">
      <button class="total total-bound" data-act="goto" data-route="summary">
        <span class="total-label">${ico('info', 12)} Bound gold</span>
        <strong>${fmt(t.bound)}</strong>
      </button>
      <span class="total-sep"></span>
      <button class="total total-unbound" data-act="goto" data-route="summary">
        <span class="total-label">${ico('gold', 12)} Unbound gold</span>
        <strong>${fmt(t.tradable)}</strong>
      </button>
      <span class="total-sep"></span>
      <button class="total total-sum" data-act="goto" data-route="summary">
        <span class="total-label">Total</span>
        <strong>${fmt(t.total)}</strong>
      </button>
    </div>`;
  // #totals is a live region: only touch it when a number actually changed.
  if (host.innerHTML === html) return;
  host.innerHTML = html;
}

/* --------------------------------------------------------------- render */

let lastRoute = null;

const bootCard = `
  <div class="sk-card">
    <div class="sk-row"><span class="sk title"></span><span class="sk pill" style="margin-left:auto"></span></div>
    <div class="sk-row"><span class="sk short"></span><span class="sk"></span></div>
    <div class="sk-row"><span class="sk"></span><span class="sk"></span><span class="sk"></span></div>
    <div class="sk-row"><span class="sk"></span><span class="sk"></span><span class="sk"></span></div>
  </div>`;

function bootSkeleton() {
  return `<div class="boot-skeleton" role="status" aria-live="polite">
    <p class="boot-line"><span class="spinner" style="--sp:14px" aria-hidden="true"></span>Loading your week…</p>
    <div class="skeleton-grid" aria-hidden="true">${bootCard}${bootCard}</div>
  </div>`;
}

const TASKS = {
  seed: {
    label: 'Resetting sheet…',
    title: 'Resetting the sheet to demo data…',
    hint: 'Every tab is replaced. A large sheet can take a few seconds.',
  },
  push: {
    label: 'Pushing data…',
    title: 'Pushing your data to the sheet…',
    hint: 'Every tab is replaced with what is loaded here.',
  },
  refresh: {
    label: 'Syncing…',
    title: 'Syncing with the sheet…',
    hint: 'Pulling the latest revision.',
  },
};

/** Long tasks and failed round trips are shown, not just toasted. */
function renderSyncAlert() {
  const host = $('#sync-alert');
  if (!host) return;
  const sync = state.sync;
  let html = '';

  if (sync.task) {
    const task = TASKS[sync.task] || { title: 'Working…', hint: 'Waiting for the sheet.' };
    html = `
      <div class="sync-alert is-task" role="status" aria-live="polite">
        <span class="alert-icon" aria-hidden="true">${spinner(15)}</span>
        <div>
          <strong>${esc(task.title)}</strong>
          <span class="muted">${esc(task.hint)}</span>
        </div>
      </div>`;
  } else if (sync.state === 'error') {
    const failed = sync.failedTask;
    const queued = sync.pending > 0;
    const count = `${sync.pending} change${sync.pending === 1 ? '' : 's'}`;
    const title =
      failed === 'seed'
        ? 'The sheet reset failed.'
        : failed === 'push'
          ? 'Pushing to the sheet failed.'
          : failed === 'refresh'
            ? 'Could not reach the sheet.'
            : `${count} not saved yet.`;
    html = `
      <div class="sync-alert" role="alert">
        <span class="alert-icon" aria-hidden="true">${ico('warning', 16)}</span>
        <div>
          <strong>${esc(title)}</strong>
          <span>${esc(sync.error || 'The last request failed.')}</span>
          ${queued ? '<span class="muted">It stays queued and retries automatically.</span>' : ''}
        </div>
        <button class="btn small ghost" data-act="retry">${ico('refresh', 14)} Retry</button>
      </div>`;
  } else if (offline) {
    html = `
      <div class="sync-alert is-offline" role="status">
        <span class="alert-icon" aria-hidden="true">${ico('cloudOff', 16)}</span>
        <div>
          <strong>You're offline.</strong>
          <span class="muted">The board keeps working. Changes queue here and sync when the connection returns.</span>
        </div>
      </div>`;
  } else if (updateReady) {
    html = `
      <div class="sync-alert is-update" role="status">
        <span class="alert-icon" aria-hidden="true">${ico('spark', 16)}</span>
        <div>
          <strong>A new version is ready.</strong>
          <span class="muted">Refresh to load it.</span>
        </div>
        <button class="btn small primary" data-act="reload-app">Refresh</button>
      </div>`;
  }

  if (host.innerHTML !== html) host.innerHTML = html;
}

/* A full view re-render replaces the DOM. Keep the caret, the typed value of
   unmanaged inputs and any open <details> where the user left them. */
function captureFocus(view) {
  const active = document.activeElement;
  if (!active || !view.contains(active)) return null;
  const holder = active.closest('[data-act]');
  const name = active.getAttribute?.('name');
  const form = active.closest('form[data-form]');
  let selector = '';
  if (holder) {
    const id = holder.dataset.id || '';
    const field = holder.dataset.field || '';
    selector = `[data-act="${holder.dataset.act}"]${id ? `[data-id="${id}"]` : ''}${field ? `[data-field="${field}"]` : ''}`;
  } else if (name && form) {
    const player = form.dataset.player ? `[data-player="${form.dataset.player}"]` : '';
    selector = `form[data-form="${form.dataset.form}"]${player} [name="${name}"]`;
  }
  if (!selector) return null;
  const type = (active.getAttribute?.('type') || 'text').toLowerCase();
  const texty = active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && !['checkbox', 'radio', 'color', 'file', 'range', 'submit', 'button'].includes(type));
  return {
    selector,
    start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
    end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
    value: texty ? active.value : null,
    details: Array.from(view.querySelectorAll('details')).map((el) => el.open),
  };
}

function restoreFocus(view, snap) {
  if (!snap) return;
  Array.from(view.querySelectorAll('details')).forEach((el, index) => {
    if (typeof snap.details[index] === 'boolean') el.open = snap.details[index];
  });
  const next = view.querySelector(snap.selector);
  if (!next) return;
  if (snap.value != null && 'value' in next) next.value = snap.value;
  next.focus({ preventScroll: true });
  if (snap.start != null && typeof next.setSelectionRange === 'function') {
    try {
      next.setSelectionRange(snap.start, snap.end);
    } catch {
      /* not a text control */
    }
  }
}

/* The inline script in index.html paints this snapshot before the modules
   arrive, so a reload shows the board instead of a loading state. */
let bootCacheTimer = null;
function cacheBootView(view) {
  clearTimeout(bootCacheTimer);
  bootCacheTimer = setTimeout(() => {
    try {
      const html = (id) => document.getElementById(id)?.innerHTML || '';
      localStorage.setItem('loandom.boot.v1', JSON.stringify({
        build: document.documentElement.getAttribute('data-build'),
        at: Date.now(),
        week: state.week,
        route: state.route,
        nav: html('nav'),
        weeknav: html('weeknav'),
        pill: html('sync-pill'),
        totals: html('totals'),
        view: view.innerHTML,
      }));
    } catch {
      /* storage full or blocked: the skeleton is the fallback */
    }
  }, 350);
}

function render() {
  if (!state.ready) {
    const view = $('#view');
    if (view) view.innerHTML = bootSkeleton();
    return;
  }

  const stats = currentStats();
  renderTopbar(stats);
  renderTotals(stats);
  renderSyncAlert();
  document.body.classList.toggle(
    'is-syncing',
    state.status === 'remote' && (state.sync.state === 'saving' || state.sync.pending > 0),
  );

  const view = $('#view');
  const route = ROUTES[state.route] || ROUTES.board;
  const snap = captureFocus(view);
  let failed = false;
  try {
    view.innerHTML = route.render(state, stats);
  } catch (error) {
    failed = true;
    console.error(error);
    view.innerHTML = `
      <div class="empty">
        <span class="empty-icon" aria-hidden="true">${ico('warning', 22)}</span>
        <h3>This view could not render</h3>
        <p>${esc(error.message)}</p>
        <pre style="white-space:pre-wrap;font-size:11px;color:#8590a6">${esc(error.stack || '')}</pre>
        <button class="btn" data-act="goto" data-route="board">Reload the board</button>
      </div>`;
  }

  if (lastRoute !== state.route) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Move focus with the view so the next Tab starts in the new page.
    if (lastRoute !== null) view.focus({ preventScroll: true });
    lastRoute = state.route;
  } else {
    restoreFocus(view, snap);
  }

  document.body.dataset.route = state.route;
  document.body.classList.toggle('is-offline', offline);
  syncWeekUrl(state.week);
  if (!failed) cacheBootView(view);
}

/* ---------------------------------------------------------------- modals */

function wirePortraitFallback(img) {
  const fallback = img?.dataset.portraitFallback;
  if (!fallback) return;
  img.addEventListener(
    'error',
    () => {
      delete img.dataset.portraitFallback;
      img.src = fallback;
    },
    { once: true },
  );
}

function sizePortrait(img, onResize, ratio = 0.5) {
  if (!img) return;
  wirePortraitFallback(img);
  const apply = () => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    // A share of the portrait's natural size, shrunk only on viewports that can't fit it.
    const cap = Math.min(60 * window.innerWidth / 100, 78 * window.innerHeight / 100);
    const natural = displayWidthFor(img.naturalWidth, ratio);
    const naturalHeight = Math.round(natural * (img.naturalHeight / img.naturalWidth));
    const scale = Math.min(1, cap / natural, cap / naturalHeight);
    img.style.width = `${Math.round(natural * scale)}px`;
    if (typeof onResize === 'function') onResize();
  };
  if (img.complete && img.naturalWidth) apply();
  else img.addEventListener('load', apply, { once: true });
  return apply;
}

function openCharacterModal(charId) {
  const character = state.data.characters.find((c) => c.id === charId);
  if (!character) return;
  const player = state.data.players.find((p) => p.id === character.playerId);
  const used = [];
  const stats = currentStats();
  stats.raidBlocks.forEach((block) => {
    block.rows.forEach((row) => {
      const assignment = row.cells[character.playerId];
      if (assignment?.characterId === character.id) used.push({ raid: block.raid, run: row.run });
    });
  });

  const raidOptions = state.data.raids
    .filter((r) => r.active !== false)
    .sort((a, b) => num(a.ilvl) - num(b.ilvl));
  const pic = portraitFor(character);
  const picFallback = portraitFallbackFor(character);
  const tint = classColor(character.className);

  openModal({
    title: character.name,
    subtitle: `${player?.name || 'Unknown owner'} · ${used.length} assigned run${used.length === 1 ? '' : 's'} this week`,
    wide: true,
    body: `
      <div class="portrait-edit">
        <div class="portrait-preview" style="--cc:${attr(tint)}" data-portrait-preview>
          ${pic ? `<img src="${attr(pic)}" data-portrait-fallback="${attr(picFallback)}" alt="" decoding="async" />` : `<span data-portrait-placeholder>${esc(character.name.slice(0, 2))}</span>`}
          <div class="portrait-progress" data-portrait-progress hidden>
            <div class="progress" aria-hidden="true"><span></span></div>
            <p data-portrait-status role="status" aria-live="polite">Preparing…</p>
          </div>
        </div>
        <div class="portrait-side">
          <div class="portrait-actions">
            <button type="button" class="btn small" data-portrait-paste>${ico('clipboard', 14)} Paste image</button>
            <button type="button" class="btn small ghost" data-portrait-file>${ico('image', 14)} Choose file</button>
            <button type="button" class="btn small ghost danger-text" data-portrait-remove>Remove</button>
          </div>
          <input type="file" accept="image/*" data-portrait-input hidden />
          <p class="tiny-note">Copy a portrait from anywhere, then click Paste (or press Ctrl+V). Shown at 50% here and in a compact 104 × 144 frame in the roster tooltip, at its original aspect ratio; stored without re-encoding.</p>
        </div>
      </div>
      <form class="form-grid" data-form="char-edit" data-id="${attr(character.id)}">
        <label class="field"><span>Name</span><input name="name" value="${attr(character.name)}" maxlength="24" required /></label>
        ${classPicker(character.className)}
        <label class="field"><span>Item level</span><input name="ilvl" type="number" step="any" inputmode="decimal" value="${attr(character.ilvl || '')}" placeholder="1750.83" min="1" max="2000" /></label>
        <label class="field">
          <span>Owner</span>
          <select name="playerId">
            ${state.data.players
              .slice()
              .sort((a, b) => num(a.order, 999) - num(b.order, 999))
              .map((p) => `<option value="${attr(p.id)}" ${p.id === character.playerId ? 'selected' : ''}>${esc(p.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="check-field">
          <input type="checkbox" name="goldEarner" ${character.goldEarner ? 'checked' : ''} />
          <span>Gold earner</span>
        </label>
        <label class="check-field">
          <input type="checkbox" name="active" ${character.active !== false ? 'checked' : ''} />
          <span>Active</span>
        </label>

        <div class="span2 eligibility">
          <span class="el-title">Can run</span>
          <div class="el-list">
            ${raidOptions
              .map(
                (raid) => `
              <span class="el-chip ${character.ilvl >= raid.ilvl ? 'is-ok' : 'is-no'}">
                ${character.ilvl >= raid.ilvl ? ico('check', 11) : ico('x', 11)}
                ${esc(raid.short)} <span class="muted">${esc(raid.ilvl)}</span>
              </span>`,
              )
              .join('')}
          </div>
        </div>
      </form>`,
    footer: `
      <button class="btn ghost danger-text" data-modal-delete>${ico('trash', 14)} Delete</button>
      <span class="grow"></span>
      <button class="btn ghost" data-modal-close>Cancel</button>
      <button class="btn primary" data-modal-save>${ico('check', 15)} Save</button>`,
    onMount(modal) {
      wireClassPicker(modal);
      const preview = modal.querySelector('[data-portrait-preview]');
      const fileInput = modal.querySelector('[data-portrait-input]');
      const progress = modal.querySelector('[data-portrait-progress]');
      const progressFill = progress.querySelector('.progress > span');
      const progressText = progress.querySelector('[data-portrait-status]');
      const portraitButtons = Array.from(modal.querySelectorAll('[data-portrait-paste], [data-portrait-file], [data-portrait-remove]'));
      const saveButton = modal.querySelector('[data-modal-save]');
      let busy = false;
      let creep = null;
      let pct = 0;
      const setBar = () => {
        progressFill.style.transform = `scaleX(${Math.max(0, Math.min(1, pct / 100))})`;
      };

      // Drive upload is the slow part and gives us no real byte progress, so show
      // an honest "in flight" bar that eases toward 90% and completes on response.
      const startProgress = (text, from = 8) => {
        busy = true;
        portraitButtons.forEach((btn) => {
          btn.disabled = true;
        });
        // The portrait write owns the modal until it settles; make that visible.
        if (saveButton) saveButton.disabled = true;
        preview.classList.add('is-busy');
        progress.hidden = false;
        progressText.textContent = text;
        pct = from;
        setBar();
        clearInterval(creep);
        creep = setInterval(() => {
          // Never move backward and never claim completion before the server answers.
          pct = Math.min(90, Math.max(pct, pct + Math.max(0.4, (90 - pct) * 0.06)));
          setBar();
        }, 180);
      };
      const setProgress = (stage, text) => {
        if (!busy) return;
        if (text) progressText.textContent = text;
        if (stage === 'cache') pct = Math.max(pct, 96);
        else if (stage === 'upload') pct = Math.max(pct, 40);
        setBar();
      };
      const finishProgress = async (ok) => {
        clearInterval(creep);
        pct = ok ? 100 : 0;
        setBar();
        if (ok) await new Promise((resolve) => setTimeout(resolve, 220));
        progress.hidden = true;
        preview.classList.remove('is-busy');
        portraitButtons.forEach((btn) => {
          btn.disabled = false;
        });
        if (saveButton) saveButton.disabled = false;
        busy = false;
      };

      const paint = (url) => {
        const img = preview.querySelector('img');
        const placeholder = preview.querySelector('[data-portrait-placeholder]');
        // A data URL cannot fail to load, so it needs no second source; a Drive
        // URL keeps the thumbnail as a fallback.
        const fallback = url && !url.startsWith('data:') ? portraitFallbackFor(character) : '';
        const usableFallback = fallback && fallback !== url ? fallback : '';
        if (url) {
          if (img) {
            img.src = url;
            if (usableFallback) img.dataset.portraitFallback = usableFallback;
            else delete img.dataset.portraitFallback;
          } else if (placeholder) {
            placeholder.outerHTML = `<img src="${attr(url)}" alt="" decoding="async"${usableFallback ? ` data-portrait-fallback="${attr(usableFallback)}"` : ''} />`;
          }
          const next = preview.querySelector('img');
          const apply = sizePortrait(next);
          // The new src may already be decoded before the load listener could attach.
          if (next?.complete && apply) apply();
        } else if (img) {
          img.outerHTML = `<span data-portrait-placeholder>${esc(character.name.slice(0, 2))}</span>`;
        }
      };
      const applyBlob = async (blob) => {
        if (busy) return;
        startProgress('Reading image…', 10);
        try {
          const { dataUrl } = await readPortraitFile(blob);
          // Show the original immediately; the upload runs behind it.
          paint(dataUrl);
          pct = Math.max(pct, 25);
          const result = await savePortrait(character, dataUrl, setProgress);
          // savePortrait already refreshed the list when the upload landed.
          await finishProgress(Boolean(result?.saved));
        } catch (error) {
          await finishProgress(false);
          // Restore whatever is still stored instead of leaving a blank frame.
          paint(portraitFor(character) || '');
          toast('error', 'Could not use that image', error.message);
        }
      };


      sizePortrait(preview.querySelector('img'));

      modal.querySelector('[data-portrait-paste]').addEventListener('click', async () => {
        try {
          if (!navigator.clipboard?.read) throw new Error('Clipboard read is not available in this browser.');
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const type = item.types.find((t) => t.startsWith('image/'));
            if (type) {
              await applyBlob(await item.getType(type));
              return;
            }
          }
          toast('info', 'No image in the clipboard', 'Copy an image first, or press Ctrl+V.');
        } catch (error) {
          toast('info', 'Use Ctrl+V instead', error.message);
        }
      });

      modal.querySelector('[data-portrait-file]').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (file) await applyBlob(file);
        fileInput.value = '';
      });

      modal.addEventListener('paste', async (event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const image = items.find((item) => item.type.startsWith('image/'));
        if (!image) return;
        event.preventDefault();
        await applyBlob(image.getAsFile());
      });

      modal.querySelector('[data-portrait-remove]').addEventListener('click', async () => {
        if (busy || !preview.querySelector('img')) return;
        startProgress('Removing portrait…', 20);
        try {
          await removePortrait(character);
          paint('');
          await finishProgress(true);
          toast('info', 'Portrait removed');
        } catch (error) {
          await finishProgress(false);
          toast('error', 'Could not remove that portrait', error.message);
        }
      });

      saveButton.addEventListener('click', async () => {
        const form = modal.querySelector('form');
        if (!form.reportValidity()) return;
        if (busy) return; // the portrait upload owns this modal until it settles
        const data = new FormData(form);
        // Wait for the actual sheet write instead of claiming success up front.
        const written = await withBusy(saveButton, 'Saving…', () =>
          updateCharacter(character.id, {
            name: String(data.get('name')).trim(),
            className: String(data.get('className')).trim(),
            ilvl: num(data.get('ilvl')),
            playerId: String(data.get('playerId')),
            goldEarner: data.get('goldEarner') === 'on',
            active: data.get('active') === 'on',
          }),
        );
        closeModal();
        if (written === false) return; // flush() already showed the real error
        toast('ok', 'Character saved');
      });
      modal.querySelector('[data-modal-delete]').addEventListener('click', async () => {
        closeModal();
        const ok = await confirmAction({
          title: `Delete ${character.name}?`,
          message: 'The character is removed from the roster and from this week’s runs. Past weeks keep the name.',
          confirmLabel: 'Delete character',
          danger: true,
        });
        if (ok) {
          deleteCharacter(character.id);
          toast('ok', 'Character deleted');
        }
      });
      modal.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault();
        modal.querySelector('[data-modal-save]').click();
      });
    },
  });
}

function openCellPicker(anchor, runId, playerId) {
  const player = state.data.players.find((p) => p.id === playerId);
  if (!player) return;
  const assignment = state.data.assignments.find((a) => a.runId === runId && a.playerId === playerId);
  const items = state.data.characters
    .filter((c) => c.playerId === playerId && c.active !== false)
    .sort((a, b) => num(b.ilvl) - num(a.ilvl) || a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      ilvl: c.ilvl,
      className: c.className,
      portrait: portraitFor(c, 240),
    }));

  openCharacterPopover(anchor, {
    player: { ...player, color: player.color || colorFor(player.name) },
    items,
    current: assignment?.name || '',
    onPick: (name) => {
      setCell(runId, playerId, name);
      // The board re-rendered, so put focus back on the cell the user just filled.
      requestAnimationFrame(() => {
        const cell = document.querySelector(`#view .slot[data-run="${attr(runId)}"][data-player="${attr(playerId)}"]`);
        if (cell) cell.focus({ preventScroll: true });
      });
    },
  });
}

/* ---------------------------------------------------------------- events */

function go(route) {
  if (location.hash === `#/${route}`) setRoute(route);
  else location.hash = `#/${route}`;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function randomKey(length = 32) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/* ---------------------------------------------------------- char tooltip */

let charTip = null;

function hideCharTip() {
  if (charTip) charTip.hidden = true;
}

function positionCharTip(anchor) {
  if (!charTip || !anchor || !anchor.isConnected) {
    hideCharTip();
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const tipW = charTip.offsetWidth;
  const tipH = charTip.offsetHeight;
  let left = rect.left + rect.width / 2 - tipW / 2;
  let top = rect.bottom + 8;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  if (top + tipH > window.innerHeight - 8) top = Math.max(8, rect.top - tipH - 8);
  charTip.style.left = `${left}px`;
  charTip.style.top = `${top}px`;
}

function showCharTip(anchor, character) {
  if (!charTip) {
    charTip = document.createElement('div');
    charTip.className = 'char-tip';
    charTip.hidden = true;
    document.body.appendChild(charTip);
  }
  const player = state.data.players.find((p) => p.id === character.playerId);
  const pic = portraitFor(character);
  const picFallback = portraitFallbackFor(character);
  const info = classInfo(character.className);
  charTip.innerHTML = `
    <div class="tip-media">
      ${pic ? `<img src="${attr(pic)}" data-portrait-fallback="${attr(picFallback)}" alt="" width="104" height="144" decoding="async" />` : classBadge(character.className, 64)}
    </div>
    <div class="tip-body">
      <strong>${esc(character.name)}</strong>
      <span class="muted">${esc(player?.name || '')}${info ? ` · ${esc(info.name)}` : character.className ? ` · ${esc(character.className)}` : ''}</span>
      <span>iLvl ${esc(character.ilvl || '—')}</span>
      ${character.goldEarner ? '<span class="tip-gold">Gold earner</span>' : ''}
    </div>`;
  charTip.hidden = false;
  positionCharTip(anchor);
  wirePortraitFallback(charTip.querySelector('img'));
}

document.addEventListener('mouseover', (event) => {
  const el = event.target.closest('[data-char-tip]');
  if (!el || el.contains(event.relatedTarget)) return;
  const character = state.data.characters.find((c) => c.id === el.dataset.charTip);
  if (character) showCharTip(el, character);
});

document.addEventListener('mouseout', (event) => {
  const el = event.target.closest('[data-char-tip]');
  if (!el || el.contains(event.relatedTarget)) return;
  hideCharTip();
});

// Keyboard users get the same card the mouse does.
document.addEventListener('focusin', (event) => {
  const el = event.target.closest?.('[data-char-tip]');
  if (!el) return;
  const character = state.data.characters.find((c) => c.id === el.dataset.charTip);
  if (character) showCharTip(el, character);
});

document.addEventListener('focusout', (event) => {
  if (event.target.closest?.('[data-char-tip]')) hideCharTip();
});

window.addEventListener('scroll', hideCharTip, true);
document.addEventListener('click', hideCharTip);

function showSecretModal(title, value, property) {
  openModal({
    title,
    subtitle: 'Paste this into Apps Script → Project Settings → Script Properties',
    body: `
      <p class="modal-text">Property <code>${esc(property)}</code> needs exactly this value:</p>
      <div class="secret-row">
        <input class="secret-input" readonly value="${attr(value)}" spellcheck="false" />
        <button class="btn primary small" data-secret-copy>${ico('copy', 14)} Copy</button>
      </div>
      <p class="modal-note">
        Both sides must match character for character. Click <strong>Save script properties</strong>,
        then Deploy → Manage deployments → pencil → <strong>Version: New version</strong> → Deploy.
      </p>`,
    onMount(modal) {
      const input = modal.querySelector('.secret-input');
      input.focus();
      input.select();
      const copy = modal.querySelector('[data-secret-copy]');
      copy.addEventListener('click', async () => {
        const ok = await copyText(value);
        input.select();
        toast(ok ? 'ok' : 'info', ok ? 'Copied' : 'Select and press Ctrl+C', ok ? `${property} is on your clipboard` : 'The value is selected.');
      });
    },
  });
}

const WRITE_ACTIONS = new Set([
  'toggle',
  'cell',
  'add-run',
  'dup-run',
  'del-run',
  'edit-char',
  'del-char',
  'ledger-del',
  'raid-active',
  'raid-del',
  'push-data',
  'push-seed',
]);

const WRITE_FORMS = new Set(['add-char', 'add-raid', 'ledger-add']);

function blockReadOnly() {
  toast('info', 'Read-only access', 'Ask the owner for the editor link to change runs.');
}

/** A write re-renders the view; put focus back on the same control afterwards. */
const REFOCUS_ACTIONS = new Set(['toggle', 'raid-active', 'raid-field', 'player-field', 'setting', 'gold-mode']);

function refocusAction(el) {
  if (!el || el.isConnected) return;
  if (document.querySelector('[role="dialog"], .popover')) return;
  const act = el.dataset.act;
  if (!REFOCUS_ACTIONS.has(act)) return;
  const suffix = ['id', 'field', 'mode', 'run', 'player']
    .filter((key) => el.dataset[key])
    .map((key) => `[data-${key}="${el.dataset[key]}"]`)
    .join('');
  document.querySelector(`[data-act="${act}"]${suffix}`)?.focus({ preventScroll: true });
}

async function askDeleteRun(runId) {
  const run = state.data.runs.find((r) => r.id === runId);
  const raid = state.data.raids.find((r) => r.id === run?.raidId);
  const ok = await confirmAction({
    title: 'Delete this run?',
    message: `Run #${run?.index ?? ''} of ${raid?.short || 'this raid'} will be removed with its characters.`,
    confirmLabel: 'Delete run',
    danger: true,
  });
  if (ok) removeRun(runId);
}

document.addEventListener('click', async (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (state.readOnly && WRITE_ACTIONS.has(act)) {
    blockReadOnly();
    return;
  }
  if (REFOCUS_ACTIONS.has(act)) Promise.resolve().then(() => refocusAction(el));

  switch (act) {
    case 'goto':
      go(el.dataset.route || 'board');
      return;
    case 'reload-app':
      location.reload();
      return;
    case 'week-prev':
      stepWeek(-1);
      return;
    case 'week-next':
      stepWeek(1);
      return;
    case 'week-today':
      goCurrentWeek();
      return;
    case 'jump-week':
      setWeek(el.dataset.week);
      return;
    case 'focus-raid': {
      const raidId = el.dataset.raid || '';
      if (!raidId) {
        setFocusRaid('');
        if (location.hash !== '#/board') location.hash = '#/board';
      } else {
        setFocusRaid(raidId);
        const target = `#/raid/${encodeURIComponent(raidId)}`;
        if (location.hash !== target) location.hash = target;
      }
      return;
    }
    case 'toggle':
      toggleClear(el.dataset.run);
      return;
    case 'cell':
      event.preventDefault();
      openCellPicker(el, el.dataset.run, el.dataset.player);
      return;
    case 'add-run': {
      const run = addRun(el.dataset.raid);
      if (run) toast('ok', 'Run added');
      return;
    }
    case 'dup-run':
      duplicateRun(el.dataset.run);
      toast('ok', 'Run duplicated');
      return;
    case 'del-run':
      await askDeleteRun(el.dataset.run);
      return;
    case 'run-menu': {
      if (state.readOnly) {
        blockReadOnly();
        return;
      }
      const run = state.data.runs.find((r) => r.id === el.dataset.run);
      const raid = state.data.raids.find((r) => r.id === run?.raidId);
      openActionMenu(el, {
        title: `Run ${run?.index ?? ''}${raid ? ` · ${raid.short || raid.name}` : ''}`,
        items: [
          {
            label: 'Duplicate run',
            hint: 'Same characters',
            icon: 'copy',
            onSelect: () => {
              duplicateRun(el.dataset.run);
              toast('ok', 'Run duplicated');
            },
          },
          {
            label: 'Delete run',
            hint: 'Removes its characters',
            icon: 'trash',
            danger: true,
            onSelect: () => askDeleteRun(el.dataset.run),
          },
        ],
      });
      return;
    }
    case 'edit-char':
      openCharacterModal(el.dataset.char);
      return;
    case 'del-char': {
      const character = state.data.characters.find((c) => c.id === el.dataset.char);
      const ok = await confirmAction({
        title: `Delete ${character?.name || 'character'}?`,
        message: 'Removed from the roster. Past runs keep the name.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (ok) deleteCharacter(el.dataset.char);
      return;
    }
    case 'ledger-del': {
      const ok = await confirmAction({
        title: 'Delete this ledger entry?',
        message: 'This only removes the manual entry — raid gold is untouched.',
        confirmLabel: 'Delete entry',
        danger: true,
      });
      if (ok) removeLedger(el.dataset.id);
      return;
    }
    case 'gold-mode':
      setGoldMode(el.dataset.mode);
      return;
    case 'raid-active': {
      const raid = state.data.raids.find((r) => r.id === el.dataset.id);
      if (raid) upsertRaid({ ...raid, active: raid.active === false });
      return;
    }
    case 'raid-del': {
      const raid = state.data.raids.find((r) => r.id === el.dataset.id);
      const ok = await confirmAction({
        title: `Delete ${raid?.short || 'raid'}?`,
        message: 'The raid, all of its runs in every week and their character assignments are removed.',
        confirmLabel: 'Delete raid',
        danger: true,
      });
      if (ok) removeRaid(el.dataset.id);
      return;
    }
    case 'sync-now':
      await withBusy(el, 'Syncing…', () => manualRefresh());
      return;
    case 'retry':
      await withBusy(el, 'Retrying…', async () => {
        const failed = state.sync.failedTask;
        try {
          if (failed === 'seed') await pushSeed();
          else if (failed === 'push') await pushToSheet();
          else {
            retryQueue();
            await manualRefresh();
          }
        } catch (error) {
          toast('error', failed === 'seed' ? 'Reset failed' : failed === 'push' ? 'Push failed' : 'Sync failed', error.message);
        }
      });
      return;
    case 'pull':
      await withBusy(el, 'Pulling…', () => manualRefresh());
      return;
    case 'export':
      download(`loandom-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportPayload(), null, 2));
      toast('ok', 'Snapshot exported');
      return;
    case 'import': {
      const input = document.getElementById('import-file');
      if (input) input.click();
      return;
    }
    case 'reset-demo': {
      const ok = await confirmAction({
        title: 'Reset to the demo data?',
        message: 'Everything currently in this browser is replaced with the original LOANDOM week.',
        confirmLabel: 'Reset demo',
        danger: true,
      });
      if (ok) {
        await withBusy(el, 'Resetting…', () => resetDemo());
        toast('ok', 'Demo data restored');
      }
      return;
    }
    case 'push-data': {
      const ok = await confirmAction({
        title: 'Overwrite the sheet with this data?',
        message: 'Every tab in the spreadsheet is replaced by what is loaded here. Anything only in the sheet is lost.',
        detail: `Runs: ${state.data.runs.length} · Assignments: ${state.data.assignments.length} · Characters: ${state.data.characters.length}`,
        confirmLabel: 'Overwrite sheet',
        danger: true,
      });
      if (!ok) return;
      try {
        await withBusy(el, 'Pushing…', () => pushToSheet());
        toast('ok', 'Sheet updated');
      } catch (error) {
        toast('error', 'Push failed', error.message);
      }
      return;
    }
    case 'push-seed': {
      const ok = await confirmAction({
        title: 'Reset the sheet to the demo week?',
        message: 'The sheet is cleared and seeded with the original LOANDOM sheet data for the current week.',
        confirmLabel: 'Reset sheet',
        danger: true,
      });
      if (!ok) return;
      try {
        await withBusy(el, 'Resetting…', () => pushSeed());
        toast('ok', 'Sheet seeded');
      } catch (error) {
        toast('error', 'Reset failed', error.message);
      }
      return;
    }
    case 'disconnect': {
      const ok = await confirmAction({
        title: 'Disconnect the Google Sheet?',
        message: 'The app keeps a local copy of what you see and goes back to demo mode. Nothing is deleted from the sheet.',
        confirmLabel: 'Disconnect',
      });
      if (ok) {
        await withBusy(el, 'Disconnecting…', async () => disconnect());
        toast('info', 'Disconnected — running on local data');
      }
      return;
    }
    case 'copy-invite': {
      const includePin = el.dataset.mode === 'edit';
      const link = buildInvite(includePin);
      if (!link) {
        toast('error', 'Connect the sheet first');
        return;
      }
      const ok = await copyText(link);
      if (ok) toast('ok', includePin ? 'Editor link copied' : 'Member link copied', 'Send it privately.');
      else toast('error', 'Could not copy the link', link);
      return;
    }
    case 'gen-readkey': {
      const key = randomKey(32);
      const input = document.querySelector('form[data-form="connect"] input[name="readKey"]');
      if (input) input.value = key;
      copyText(key);
      showSecretModal('New read key', key, 'READ_KEY');
      return;
    }
    case 'gen-pin': {
      const pin = randomKey(32);
      const input = document.querySelector('form[data-form="connect"] input[name="pin"]');
      if (input) input.value = pin;
      copyText(pin);
      showSecretModal('New write PIN', pin, 'PIN');
      return;
    }
    case 'copy-secret': {
      const field = el.dataset.field === 'pin' ? 'pin' : 'readKey';
      const input = document.querySelector(`form[data-form="connect"] input[name="${field}"]`);
      const value = input ? input.value.trim() : '';
      if (!value) {
        toast('info', 'Nothing to copy yet', 'Click Generate to create one.');
        return;
      }
      showSecretModal(field === 'pin' ? 'Write PIN' : 'Read key', value, field === 'pin' ? 'PIN' : 'READ_KEY');
      return;
    }
    default:
      return;
  }
});

document.addEventListener('change', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (REFOCUS_ACTIONS.has(act)) Promise.resolve().then(() => refocusAction(el));

  if (act === 'raid-field') {
    if (state.readOnly) {
      blockReadOnly();
      render();
      return;
    }
    const raid = state.data.raids.find((r) => r.id === el.dataset.id);
    if (!raid) return;
    const field = el.dataset.field;
    const value = field === 'name' || field === 'short' || field === 'difficulty' ? el.value : num(el.value);
    upsertRaid({ ...raid, [field]: value });
    return;
  }

  if (act === 'player-field') {
    if (state.readOnly) {
      blockReadOnly();
      render();
      return;
    }
    updatePlayer(el.dataset.id, { [el.dataset.field]: el.value });
    return;
  }

  if (act === 'setting') {
    const key = el.dataset.key;
    const value = num(el.value);
    if (key === 'resetHour' || key === 'resetDay') {
      saveSettings({ [key]: value });
      goCurrentWeek();
    }
    return;
  }

  if (act === 'import-file') {
    const file = el.files?.[0];
    if (!file) return;
    const button = document.querySelector('[data-act="import"]');
    const reader = new FileReader();
    setButtonBusy(button, true, 'Importing…');
    reader.onload = () => {
      try {
        importData(String(reader.result));
        toast('ok', 'Import complete');
      } catch (error) {
        toast('error', 'Could not import that file', error.message);
      } finally {
        setButtonBusy(button, false);
      }
    };
    reader.onerror = () => {
      toast('error', 'Could not read that file');
      setButtonBusy(button, false);
    };
    reader.readAsText(file);
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  const data = new FormData(form);

  if (state.readOnly && WRITE_FORMS.has(kind)) {
    blockReadOnly();
    return;
  }

  if (kind === 'connect') {
    const endpoint = String(data.get('endpoint') || '').trim();
    const pin = String(data.get('pin') || '').trim();
    const readKey = String(data.get('readKey') || '').trim();
    const field = form.querySelector('input[name="endpoint"]');
    form.querySelector('[data-connect-error]')?.remove();
    field?.removeAttribute('aria-invalid');
    if (!endpoint) {
      toast('error', 'Paste the Apps Script /exec URL first');
      field?.focus();
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    const result = await withBusy(submit, 'Connecting…', async () => {
      try {
        await connect(endpoint, pin, readKey);
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    });
    if (result?.ok) {
      // store.js announces the connection (and whether it seeded the sheet)
    } else if (result) {
      toast('error', 'Connection failed', result.error.message);
      field?.setAttribute('aria-invalid', 'true');
      const note = document.createElement('p');
      note.className = 'inline-error span2';
      note.dataset.connectError = '';
      note.setAttribute('role', 'alert');
      note.textContent = result.error.message;
      form.appendChild(note);
      field?.focus();
    }
    return;
  }

  if (kind === 'add-char') {
    const playerId = form.dataset.player;
    const name = String(data.get('name') || '').trim();
    if (!name) return;
    addCharacter(playerId, name);
    form.reset();
    return;
  }

  if (kind === 'add-raid') {
    const raid = {
      id: `raid_${Date.now().toString(36)}`,
      name: String(data.get('name') || '').trim(),
      short: String(data.get('name') || '').trim().toUpperCase().slice(0, 14),
      difficulty: String(data.get('difficulty') || 'Normal'),
      ilvl: num(data.get('ilvl')),
      goldTradable: num(data.get('goldTradable')),
      goldBound: num(data.get('goldBound')),
      partySize: num(data.get('partySize'), 8),
      order: (state.data.raids.length + 1) * 10,
      active: true,
    };
    if (!raid.name) return;
    upsertRaid(raid);
    form.reset();
    toast('ok', `${raid.short} added`);
    return;
  }

  if (kind === 'ledger-add') {
    const amount = num(data.get('amount'));
    if (!amount) {
      toast('error', 'Enter an amount');
      return;
    }
    addLedger({
      kind: String(data.get('kind') || 'tradable'),
      amount,
      source: String(data.get('source') || '').trim() || 'Manual',
      note: String(data.get('note') || '').trim(),
      playerId: String(data.get('playerId') || ''),
    });
    form.reset();
    toast('ok', 'Ledger entry added');
    return;
  }

  if (kind === 'char-edit') {
    return; // handled inside the modal
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideCharTip();
  const tag = event.target.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable;
  if (typing) return;
  if (event.key === '[') stepWeek(-1);
  if (event.key === ']') stepWeek(1);
  if (event.key.toLowerCase() === 't') goCurrentWeek();
});

window.addEventListener('hashchange', () => {
  applyHash();
  closePopover();
});

onNotice(({ kind, message, detail }) => toast(kind, message, detail));

subscribe(render);

/* ------------------------------------------------------------------ boot */

const invite = consumeInviteHash();
if (invite) {
  toast(
    'info',
    invite.readOnly ? 'Member link applied — read-only' : 'Editor link applied',
    'Connecting to the shared sheet…',
  );
}

applyHash();
init()
  .then(() => {
    const fromUrl = weekFromUrl();
    if (fromUrl && fromUrl !== state.week) setWeek(fromUrl);
  })
  .catch((error) => {
    console.error(error);
    toast('error', 'Could not start', error.message);
  });

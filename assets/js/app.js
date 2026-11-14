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
  closePopover,
} from './ui.js';
import { renderBoard } from './views/board.js';
import { renderRoster } from './views/roster.js';
import { renderSummary } from './views/summary.js';
import { renderLedger } from './views/ledger.js';
import { renderSettings } from './views/settings.js';

const ROUTES = {
  board: { label: 'Board', icon: 'sword', render: renderBoard },
  roster: { label: 'Roster', icon: 'users', render: renderRoster },
  summary: { label: 'Gold', icon: 'chart', render: renderSummary },
  ledger: { label: 'Ledger', icon: 'ledger', render: renderLedger },
  settings: { label: 'Settings', icon: 'settings', render: renderSettings },
};

const weekFromHash = () => {
  const route = (location.hash.replace(/^#\/?/, '') || 'board').split('?')[0];
  return ROUTES[route] ? route : 'board';
};

/* ---------------------------------------------------------------- shell */

function syncPill() {
  const { status, sync } = state;
  if (status !== 'remote') {
    return `<button class="sync-pill is-demo" data-act="goto" data-route="settings" title="Data lives in this browser" aria-label="Demo mode, data lives in this browser">
      ${ico('cloudOff', 14)} <span>Demo · local</span>
    </button>`;
  }
  if (sync.state === 'saving') {
    return `<button class="sync-pill is-saving" disabled aria-label="Saving">${ico('upload', 14)} <span>Saving…</span></button>`;
  }
  if (sync.state === 'error') {
    return `<button class="sync-pill is-error" data-act="retry" title="${attr(sync.error)}" aria-label="Sync error, retry">
      ${ico('warning', 14)} <span>Sync error${sync.pending ? ` · ${sync.pending} queued` : ''}</span>
    </button>`;
  }
  if (state.readOnly) {
    return `<button class="sync-pill is-readonly" data-act="goto" data-route="settings" title="Read-only access — ask for the editor link" aria-label="Read-only access">
      ${ico('key', 14)} <span>Read-only</span>
    </button>`;
  }
  return `<button class="sync-pill is-on" data-act="sync-now" title="Revision ${attr(sync.revision)} · click to sync now" aria-label="Synced ${attr(ago(sync.at))}, sync now">
    ${ico('cloud', 14)} <span>Synced ${esc(ago(sync.at))}</span>
  </button>`;
}

function renderTopbar(stats) {
  const nav = $('#nav');
  if (nav) {
    nav.innerHTML = Object.entries(ROUTES)
      .map(
        ([id, route]) => `
        <a class="nav-link ${state.route === id ? 'is-active' : ''}" href="#/${id}">
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
      <button class="week-today" data-act="week-today" title="Jump to the current reset week">${ico('clock', 13)}</button>`;
  }

  const pill = $('#sync-pill');
  if (pill) pill.innerHTML = syncPill();
}

function renderTotals(stats) {
  const host = $('#totals');
  if (!host) return;
  const t = stats.totals;
  host.innerHTML = `
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
}

/* --------------------------------------------------------------- render */

let lastRoute = null;

function render() {
  if (!state.ready) {
    const view = $('#view');
    if (view) view.innerHTML = `<div class="boot"><span class="boot-spinner"></span>Loading your week…</div>`;
    return;
  }

  const stats = currentStats();
  renderTopbar(stats);
  renderTotals(stats);

  const view = $('#view');
  const route = ROUTES[state.route] || ROUTES.board;
  try {
    view.innerHTML = route.render(state, stats);
  } catch (error) {
    console.error(error);
    view.innerHTML = `
      <div class="empty">
        <span class="empty-icon">${ico('warning', 22)}</span>
        <h3>This view could not render</h3>
        <p>${esc(error.message)}</p>
        <pre style="white-space:pre-wrap;font-size:11px;color:#8590a6">${esc(error.stack || '')}</pre>
        <button class="btn" data-act="goto" data-route="board">Reload the board</button>
      </div>`;
  }

  if (lastRoute !== state.route) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    lastRoute = state.route;
  }

  document.body.dataset.route = state.route;
}

/* ---------------------------------------------------------------- modals */

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

  openModal({
    title: character.name,
    subtitle: `${player?.name || 'Unknown owner'} · ${used.length} assigned run${used.length === 1 ? '' : 's'} this week`,
    body: `
      <form class="form-grid" data-form="char-edit" data-id="${attr(character.id)}">
        <label class="field"><span>Name</span><input name="name" value="${attr(character.name)}" maxlength="24" required /></label>
        <label class="field"><span>Class</span><input name="className" value="${attr(character.className)}" placeholder="e.g. Gunslinger" maxlength="24" /></label>
        <label class="field"><span>Item level</span><input name="ilvl" type="number" value="${attr(character.ilvl || '')}" placeholder="1750" min="1" max="2000" /></label>
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
      modal.querySelector('[data-modal-save]').addEventListener('click', () => {
        const form = modal.querySelector('form');
        if (!form.reportValidity()) return;
        const data = new FormData(form);
        updateCharacter(character.id, {
          name: String(data.get('name')).trim(),
          className: String(data.get('className')).trim(),
          ilvl: num(data.get('ilvl')),
          playerId: String(data.get('playerId')),
          goldEarner: data.get('goldEarner') === 'on',
          active: data.get('active') === 'on',
        });
        closeModal();
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
    .sort((a, b) => num(b.ilvl) - num(a.ilvl) || a.name.localeCompare(b.name));

  openCharacterPopover(anchor, {
    player: { ...player, color: player.color || colorFor(player.name) },
    items,
    current: assignment?.name || '',
    onPick: (name) => {
      setCell(runId, playerId, name);
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

document.addEventListener('click', async (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (state.readOnly && WRITE_ACTIONS.has(act)) {
    blockReadOnly();
    return;
  }

  switch (act) {
    case 'goto':
      go(el.dataset.route || 'board');
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
    case 'del-run': {
      const run = state.data.runs.find((r) => r.id === el.dataset.run);
      const raid = state.data.raids.find((r) => r.id === run?.raidId);
      const ok = await confirmAction({
        title: 'Delete this run?',
        message: `Run #${run?.index ?? ''} of ${raid?.short || 'this raid'} will be removed with its characters.`,
        confirmLabel: 'Delete run',
        danger: true,
      });
      if (ok) removeRun(el.dataset.run);
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
      await manualRefresh();
      return;
    case 'retry':
      retryQueue();
      toast('info', 'Retrying queued changes');
      return;
    case 'pull':
      await manualRefresh();
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
        await resetDemo();
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
        await pushToSheet();
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
        await pushSeed();
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
        disconnect();
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
      const ok = await copyText(key);
      toast(
        ok ? 'ok' : 'info',
        ok ? 'Read key generated and copied' : 'Read key generated',
        'Run setReadKey("<the key>") in Apps Script, then Connect.',
      );
      return;
    }
    case 'gen-pin': {
      const pin = randomKey(32);
      const input = document.querySelector('form[data-form="connect"] input[name="pin"]');
      if (input) input.value = pin;
      const ok = await copyText(pin);
      toast(
        ok ? 'ok' : 'info',
        ok ? 'PIN generated and copied' : 'PIN generated',
        'Run setPin("<the pin>") in Apps Script, then Connect.',
      );
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
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(String(reader.result));
        toast('ok', 'Import complete');
      } catch (error) {
        toast('error', 'Could not import that file', error.message);
      }
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
    if (!endpoint) {
      toast('error', 'Paste the Apps Script /exec URL first');
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    const original = submit.innerHTML;
    submit.disabled = true;
    submit.innerHTML = `${ico('refresh', 15)} Connecting…`;
    try {
      await connect(endpoint, pin, readKey);
      toast('ok', 'Connected to the sheet');
    } catch (error) {
      toast('error', 'Connection failed', error.message);
    } finally {
      submit.disabled = false;
      submit.innerHTML = original;
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
  const tag = event.target.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable;
  if (typing) return;
  if (event.key === '[') stepWeek(-1);
  if (event.key === ']') stepWeek(1);
  if (event.key.toLowerCase() === 't') goCurrentWeek();
});

window.addEventListener('hashchange', () => {
  setRoute(weekFromHash());
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

setRoute(weekFromHash());
init().catch((error) => {
  console.error(error);
  toast('error', 'Could not start', error.message);
});

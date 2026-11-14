/* App state + optimistic mutation layer.
 *
 * Every edit is applied locally first (instant UI), then queued as an op and
 * sent to the Google Sheet in a debounced batch. If the request fails the ops
 * stay queued so nothing is lost, and the sync pill turns red with the reason.
 */

import { createRemote, createLocal, ApiError } from './api.js';
import { seed } from './seed.js';
import * as model from './model.js';
import { weekKeyFromDate, addWeeks, isoNow, uid, num, clamp } from './util.js';

const SETTINGS_KEY = 'loandom.settings.v1';
const LOCAL_KEY = 'loandom.local.v2';
const WEEK_KEY = 'loandom.week.v1';

export const defaultSettings = {
  endpoint: '',
  pin: '',
  readKey: '',
  goldMode: 'run',
  resetDay: 3,
  resetHour: 6,
};

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

export const settings = loadSettings();

const initialWeek = (() => {
  const stored = sessionStorage.getItem(WEEK_KEY);
  return stored || weekKeyFromDate(new Date(), settings.resetDay, settings.resetHour);
})();

export const state = {
  status: 'demo', // 'demo' | 'remote'
  data: model.emptyData(),
  week: initialWeek,
  route: 'board',
  ready: false,
  readOnly: false,
  keyEnforced: false,
  sheetTimeZone: null,
  settings,
  sync: { state: 'idle', revision: 0, at: null, error: '', pending: 0 },
};

const listeners = new Set();
const noticeListeners = new Set();
const localAdapter = createLocal(LOCAL_KEY);
let remoteAdapter = null;
let queue = [];
let sending = false;
let flushTimer = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onNotice(fn) {
  noticeListeners.add(fn);
  return () => noticeListeners.delete(fn);
}

function emit() {
  state.sync.pending = queue.length;
  listeners.forEach((fn) => fn(state));
}

function notify(kind, message, detail = '') {
  noticeListeners.forEach((fn) => fn({ kind, message, detail, at: Date.now() }));
}

export function saveSettings(patch = {}) {
  Object.assign(settings, patch);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  emit();
}

/* ---------------------------------------------------------------- loading */

async function loadLocal({ reset = false } = {}) {
  const currentWeek = weekKeyFromDate(new Date(), settings.resetDay, settings.resetHour);
  if (reset) {
    state.data = model.resolveSeed(seed, currentWeek, settings.resetDay, settings.resetHour);
    const rev = await localAdapter.save(state.data);
    state.sync = { state: 'ok', revision: rev, at: isoNow(), error: '', pending: 0 };
    return;
  }
  const res = await localAdapter.load();
  if (res.empty) {
    state.data = model.resolveSeed(seed, currentWeek, settings.resetDay, settings.resetHour);
    const rev = await localAdapter.save(state.data);
    state.sync = { state: 'ok', revision: rev, at: isoNow(), error: '', pending: 0 };
  } else {
    state.data = model.normalizeData(res.data || {});
    state.sync = { state: 'ok', revision: res.revision || 0, at: res.serverTime || isoNow(), error: '', pending: 0 };
  }
}

async function loadRemote({ force = false } = {}) {
  if (!remoteAdapter) return false;
  try {
    const res = await remoteAdapter.load(force ? null : state.sync.revision, settings.readKey);
    if (res.unchanged) {
      state.sync = { ...state.sync, state: 'ok', at: isoNow(), error: '' };
      return false;
    }
    state.data = model.normalizeData(res.data || res, { timeZone: state.sheetTimeZone || undefined });
    state.sync = {
      state: 'ok',
      revision: res.revision ?? 0,
      at: res.serverTime || isoNow(),
      error: '',
      pending: queue.length,
    };
    return true;
  } catch (error) {
    state.sync = { ...state.sync, state: 'error', error: error.message };
    throw error;
  }
}

export async function init() {
  if (settings.endpoint) {
    try {
      remoteAdapter = createRemote(settings.endpoint);
      state.status = 'remote';
      const health = await remoteAdapter.health();
      state.sheetTimeZone = health.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      state.readOnly = Boolean(health.pinRequired) && !settings.pin;
      state.keyEnforced = Boolean(health.readKeyRequired);
      if (!health.readKeyRequired && settings.readKey) {
        notify('info', 'Read key not enforced', 'Run setReadKey("<the key>") in Apps Script and deploy a new version.');
      }
      await loadRemote({ force: true });
    } catch (error) {
      remoteAdapter = null;
      state.status = 'demo';
      state.sync = { ...state.sync, state: 'error', error: error.message };
      await loadLocal();
      notify('error', 'Could not reach the Google Sheet', error.message);
    }
  } else {
    await loadLocal();
  }
  state.ready = true;
  emit();
  startPolling();
  wireNetworkEvents();
}

/* ------------------------------------------------------------ persistence */

const persistLocal = () => {
  localAdapter.save(state.data).then((rev) => {
    state.sync.revision = rev;
  });
};

function scheduleFlush(delay = 400) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, delay);
}

async function flush() {
  if (sending || !queue.length) return;
  if (state.status !== 'remote' || !remoteAdapter) {
    persistLocal();
    queue = [];
    emit();
    return;
  }
  sending = true;
  const ops = queue.splice(0);
  state.sync.state = 'saving';
  emit();
  try {
    const res = await remoteAdapter.send(settings.pin, ops);
    state.sync = {
      state: 'ok',
      revision: res.revision ?? state.sync.revision,
      at: isoNow(),
      error: '',
      pending: queue.length,
    };
    if (queue.length) scheduleFlush(0);
  } catch (error) {
    queue = ops.concat(queue);
    state.sync = { ...state.sync, state: 'error', error: error.message };
    if (error.code !== 'BAD_PIN' && error.code !== 'NO_PIN') scheduleFlush(4000);
    notify('error', 'Save failed — your change is queued', error.message);
  } finally {
    sending = false;
    emit();
  }
}

function queueOps(ops) {
  const list = Array.isArray(ops) ? ops : [ops];
  if (state.status === 'remote' && remoteAdapter) {
    queue.push(...list);
    scheduleFlush();
  } else {
    persistLocal();
  }
}

/* --------------------------------------------------------------- polling */

let pollTimer = null;

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (state.status !== 'remote' || !remoteAdapter) return;
    if (document.visibilityState !== 'visible') return;
    if (sending || queue.length) return;
    try {
      const changed = await loadRemote();
      if (changed) emit();
    } catch {
      emit();
    }
  }, 20000);
}

function wireNetworkEvents() {
  window.addEventListener('online', () => {
    if (state.status === 'remote' && queue.length) scheduleFlush(200);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.status === 'remote' && !queue.length) {
      loadRemote()
        .then((changed) => changed && emit())
        .catch(() => emit());
    }
  });
}

export async function manualRefresh() {
  if (state.status !== 'remote' || !remoteAdapter) return;
  try {
    const changed = await loadRemote({ force: true });
    if (changed) emit();
    notify('ok', 'Synced with the sheet');
  } catch (error) {
    notify('error', 'Sync failed', error.message);
  }
}

export function retryQueue() {
  if (!queue.length) return;
  scheduleFlush(0);
}

/* ------------------------------------------------------------ navigation */

export function setWeek(week) {
  state.week = week;
  sessionStorage.setItem(WEEK_KEY, week);
  emit();
}

export function stepWeek(delta) {
  setWeek(addWeeks(state.week, delta));
}

export function goCurrentWeek() {
  setWeek(weekKeyFromDate(new Date(), settings.resetDay, settings.resetHour));
}

export function setRoute(route) {
  state.route = route;
  emit();
}

/* -------------------------------------------------------------- mutations */

const findRun = (id) => state.data.runs.find((r) => r.id === id);
const findRaid = (id) => state.data.raids.find((r) => r.id === id);

export function toggleClear(runId, value) {
  const run = findRun(runId);
  if (!run) return;
  run.cleared = value === undefined ? !run.cleared : Boolean(value);
  run.updatedAt = isoNow();
  queueOps({ type: 'run.toggle', id: runId, cleared: run.cleared });
  emit();
}

export function addRun(raidId, { copyFrom = null } = {}) {
  const raid = findRaid(raidId);
  if (!raid) return null;
  const index = model.nextRunIndex(state.data, raidId, state.week);
  const run = model.makeRun(state.week, raidId, index);
  state.data.runs.push(run);
  queueOps({ type: 'run.create', run });

  if (copyFrom) {
    const source = state.data.assignments.filter((a) => a.runId === copyFrom);
    source.forEach((assignment) => {
      const copy = model.makeAssignment(run.id, assignment.playerId, {
        id: assignment.characterId,
        name: assignment.name,
      });
      state.data.assignments.push(copy);
      queueOps({
        type: 'cell.set',
        runId: run.id,
        playerId: assignment.playerId,
        characterId: assignment.characterId,
        name: assignment.name,
      });
    });
  }
  emit();
  return run;
}

export function duplicateRun(runId) {
  const run = findRun(runId);
  if (!run) return;
  addRun(run.raidId, { copyFrom: runId });
}

export function removeRun(runId) {
  const run = findRun(runId);
  if (!run) return;
  state.data.runs = state.data.runs.filter((r) => r.id !== runId);
  state.data.assignments = state.data.assignments.filter((a) => a.runId !== runId);
  queueOps({ type: 'run.delete', id: runId });
  emit();
}

export function setClaims(runId, claims) {
  const run = findRun(runId);
  if (!run) return;
  run.claims = clamp(Math.round(num(claims, 1)), 0, 20);
  run.updatedAt = isoNow();
  queueOps({ type: 'run.update', id: runId, patch: { claims: run.claims } });
  emit();
}

export function setCell(runId, playerId, rawName) {
  const run = findRun(runId);
  if (!run) return;
  const name = String(rawName || '').trim();
  const existing = state.data.assignments.find((a) => a.runId === runId && a.playerId === playerId);

  if (!name) {
    if (existing) {
      state.data.assignments = state.data.assignments.filter((a) => a.id !== existing.id);
      queueOps({ type: 'cell.clear', runId, playerId });
      emit();
    }
    return;
  }

  let character = model.findCharacterByName(state.data, playerId, name);
  if (!character) {
    character = model.makeCharacter(playerId, name);
    state.data.characters.push(character);
    queueOps({ type: 'character.upsert', character });
  }

  if (existing) {
    existing.characterId = character.id;
    existing.name = character.name;
    existing.updatedAt = isoNow();
  } else {
    state.data.assignments.push(model.makeAssignment(runId, playerId, character));
  }
  queueOps({ type: 'cell.set', runId, playerId, characterId: character.id, name: character.name });
  emit();
}

export function clearCell(runId, playerId) {
  setCell(runId, playerId, '');
}

/* ------------------------------------------------------------- characters */

export function addCharacter(playerId, name, extra = {}) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const existing = model.findCharacterByName(state.data, playerId, clean);
  if (existing) {
    notify('info', `${clean} is already in that roster`);
    return existing;
  }
  const character = { ...model.makeCharacter(playerId, clean), ...extra };
  state.data.characters.push(character);
  queueOps({ type: 'character.upsert', character });
  emit();
  return character;
}

export function updateCharacter(id, patch) {
  const character = state.data.characters.find((c) => c.id === id);
  if (!character) return;
  Object.assign(character, patch);
  queueOps({ type: 'character.upsert', character });
  emit();
}

export function deleteCharacter(id) {
  const currentWeek = weekKeyFromDate(new Date(), settings.resetDay, settings.resetHour);
  const weekOfRun = new Map(state.data.runs.map((r) => [r.id, r.week]));
  const removed = [];

  state.data.assignments = state.data.assignments.filter((assignment) => {
    if (assignment.characterId !== id) return true;
    const week = weekOfRun.get(assignment.runId);
    if (week && week < currentWeek) {
      // Past weeks keep the name so history stays readable.
      assignment.characterId = '';
      return true;
    }
    removed.push(assignment);
    return false;
  });

  state.data.characters = state.data.characters.filter((c) => c.id !== id);

  // Remove the character from current/future runs on the sheet too.
  removed.forEach((assignment) => {
    queueOps({ type: 'cell.clear', runId: assignment.runId, playerId: assignment.playerId });
  });
  queueOps({ type: 'character.delete', id });
  emit();
}

/* ----------------------------------------------------------------- ledger */

export function addLedger(entry) {
  const record = model.normalizeLedger({
    id: uid('l'),
    week: state.week,
    kind: 'tradable',
    amount: 0,
    source: 'Manual',
    ...entry,
    playerId: entry.playerId || '',
    characterId: entry.characterId || '',
  });
  state.data.ledger.push(record);
  queueOps({ type: 'ledger.add', ledger: record });
  emit();
  return record;
}

export function removeLedger(id) {
  state.data.ledger = state.data.ledger.filter((l) => l.id !== id);
  queueOps({ type: 'ledger.delete', id });
  emit();
}

/* ------------------------------------------------------------------ raids */

export function upsertRaid(raid) {
  const normalized = model.normalizeRaid(raid);
  const index = state.data.raids.findIndex((r) => r.id === normalized.id);
  if (index >= 0) state.data.raids[index] = { ...state.data.raids[index], ...normalized };
  else state.data.raids.push(normalized);
  queueOps({ type: 'raid.upsert', raid: state.data.raids.find((r) => r.id === normalized.id) });
  emit();
}

export function removeRaid(id) {
  state.data.raids = state.data.raids.filter((r) => r.id !== id);
  const deadRuns = state.data.runs.filter((r) => r.raidId === id).map((r) => r.id);
  state.data.runs = state.data.runs.filter((r) => r.raidId !== id);
  state.data.assignments = state.data.assignments.filter((a) => !deadRuns.includes(a.runId));
  queueOps({ type: 'raid.delete', id });
  emit();
}

export function updatePlayer(id, patch) {
  const player = state.data.players.find((p) => p.id === id);
  if (!player) return;
  Object.assign(player, patch);
  queueOps({ type: 'player.upsert', player });
  emit();
}

/* -------------------------------------------------------------- connection */

export async function connect(endpoint, pin, readKey = '') {
  const candidate = createRemote(endpoint);
  const health = await candidate.health();
  if (health && health.ok === false) {
    throw new ApiError(health.message || 'The endpoint is not healthy.', health.code || 'REMOTE');
  }
  state.sheetTimeZone = health.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Probe before committing: a wrong read key must not replace a working setup.
  const snapshot = await candidate.load(null, String(readKey || '').trim());
  const backup = model.cloneData(state.data);

  remoteAdapter = candidate;
  settings.endpoint = String(endpoint).trim();
  settings.pin = String(pin || '');
  settings.readKey = String(readKey || '').trim();
  saveSettings();
  state.status = 'remote';
  state.readOnly = Boolean(health.pinRequired) && !settings.pin;
  state.keyEnforced = Boolean(health.readKeyRequired);
  if (!health.readKeyRequired && settings.readKey) {
    notify('info', 'Read key not enforced', 'Run setReadKey("<the key>") in Apps Script and deploy a new version.');
  }
  queue = [];
  state.data = model.normalizeData(snapshot.data || snapshot, { timeZone: state.sheetTimeZone || undefined });
  state.sync = {
    state: 'ok',
    revision: snapshot.revision ?? 0,
    at: snapshot.serverTime || isoNow(),
    error: '',
    pending: 0,
  };

  // First connection to a blank sheet: seed it with what is on screen so the
  // user does not lose the demo/tracker they just built.
  const sheetIsEmpty = !state.data.raids.length && !state.data.runs.length;
  if (sheetIsEmpty && backup.raids.length) {
    try {
      await candidate.send(settings.pin, [{ type: 'replaceAll', data: backup }]);
      await loadRemote({ force: true });
      notify('ok', 'Connected — sheet seeded with your local data');
    } catch (error) {
      notify('error', 'Connected, but seeding the sheet failed', error.message);
    }
  } else {
    notify('ok', 'Connected to the Google Sheet');
  }

  emit();
  return health;
}

export function disconnect() {
  localAdapter.save(state.data);
  settings.endpoint = '';
  settings.pin = '';
  settings.readKey = '';
  saveSettings();
  remoteAdapter = null;
  queue = [];
  state.status = 'demo';
  state.readOnly = false;
  state.keyEnforced = false;
  state.sheetTimeZone = null;
  state.sync = { ...state.sync, state: 'ok', error: '' };
  emit();
}

export async function pushToSheet() {
  if (!remoteAdapter) throw new ApiError('Connect a sheet first.', 'NO_REMOTE');
  const res = await remoteAdapter.send(settings.pin, [{ type: 'replaceAll', data: state.data }]);
  await loadRemote({ force: true });
  emit();
  return res;
}

export async function pushSeed() {
  if (!remoteAdapter) throw new ApiError('Connect a sheet first.', 'NO_REMOTE');
  const currentWeek = weekKeyFromDate(new Date(), settings.resetDay, settings.resetHour);
  const seeded = model.resolveSeed(seed, currentWeek, settings.resetDay, settings.resetHour);
  const res = await remoteAdapter.send(settings.pin, [{ type: 'replaceAll', data: seeded }]);
  state.data = seeded;
  await loadRemote({ force: true });
  emit();
  return res;
}

export async function resetDemo() {
  await loadLocal({ reset: true });
  state.status = 'demo';
  emit();
}

export function importData(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const data = model.normalizeData(parsed.data || parsed, { timeZone: state.sheetTimeZone || undefined });
  state.data = data;
  if (state.status === 'remote' && remoteAdapter) {
    remoteAdapter
      .send(settings.pin, [{ type: 'replaceAll', data }])
      .then(() => {
        notify('ok', 'Sheet replaced with the imported data');
        loadRemote({ force: true }).then(() => emit());
      })
      .catch((error) => {
        notify('error', 'Import failed', error.message);
      });
  } else {
    persistLocal();
    notify('ok', 'Imported locally');
  }
  emit();
}

/* ------------------------------------------------------------------ invites
   A link that configures the app in one click. It carries the endpoint, the
   read key, and (optionally) the write PIN, so it is a secret: share it only
   with your party, and rotate the keys if it leaks. */

const b64url = (text) =>
  btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function unb64url(token) {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (token.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function buildInvite(includePin = false) {
  if (!settings.endpoint) return '';
  const payload = {
    v: 1,
    e: settings.endpoint,
    k: settings.readKey || '',
    p: includePin ? settings.pin || '' : '',
  };
  return `${location.origin}${location.pathname}#connect=${b64url(JSON.stringify(payload))}`;
}

/** Read an invite from the URL, persist it, and clean the address bar. */
export function consumeInviteHash() {
  const hash = location.hash || '';
  if (!hash.startsWith('#connect=')) return null;
  const token = hash.slice('#connect='.length);
  try {
    const payload = JSON.parse(unb64url(token));
    if (!payload || !payload.e) return null;
    history.replaceState(null, '', location.pathname + location.search);
    settings.endpoint = String(payload.e);
    settings.readKey = String(payload.k || '');
    settings.pin = String(payload.p || '');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return { endpoint: settings.endpoint, readOnly: !settings.pin };
  } catch {
    history.replaceState(null, '', location.pathname + location.search);
    return null;
  }
}

/* ------------------------------------------------------------------ export */

export function exportPayload() {
  return {
    ok: true,
    app: 'loandom',
    version: 2,
    exportedAt: isoNow(),
    revision: state.sync.revision,
    data: state.data,
  };
}

/* ------------------------------------------------------------------ stats */

export function currentStats() {
  return model.computeWeek(state.data, state.week, settings);
}

export function setGoldMode(mode) {
  saveSettings({ goldMode: mode === 'character' ? 'character' : 'run' });
}

export { model, addWeeks };

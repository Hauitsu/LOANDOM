/* Character portraits.
 *
 * Stored in the sheet's Portraits tab as Google Drive file IDs when connected
 * (originals, no re-encoding), or in localStorage while in demo mode.
 * Nothing is fetched from third-party sites.
 */

import { slug } from './util.js';

const LOCAL_KEY = 'loandom.portraits.v1';
const DRIVE_SIZE = 2400;

let cache = new Map(); // key -> { driveId?, dataUrl? } — both when we have both
let source = 'none'; // 'remote' | 'local' | 'none'

function entryFor(character) {
  if (!character) return null;
  return cache.get(String(character.id)) || cache.get(slug(character.name)) || null;
}

const originalUrl = (id) =>
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=view`;

const thumbUrl = (id, size) =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size || DRIVE_SIZE}`;

export function portraitFor(character, size) {
  const entry = entryFor(character);
  if (!entry) return '';
  // The device copy is the only source that always renders after a reopen; the
  // Drive file needs link sharing and a working third-party fetch. Drive stays
  // the cross-device copy and the fallback.
  if (entry.dataUrl) return entry.dataUrl;
  if (entry.driveId) {
    // Small contexts (the assignment picker) use a thumbnail;
    // tooltips and the modal ask Drive for the original bytes.
    return size && size < 1000 ? thumbUrl(entry.driveId, size) : originalUrl(entry.driveId);
  }
  return '';
}

export function portraitFallbackFor(character, size) {
  const entry = entryFor(character);
  if (!entry) return '';
  if (entry.dataUrl) return '';
  return entry.driveId ? thumbUrl(entry.driveId, size || DRIVE_SIZE) : '';
}

/** Returns the previous entry so a failed save can be rolled back. */
export function setPortrait(key, dataUrl) {
  if (!key || !dataUrl) return null;
  const id = String(key);
  const previous = cache.get(id) || null;
  cache.set(id, { ...(previous || {}), dataUrl });
  return previous;
}

export function restorePortrait(key, entry) {
  const id = String(key);
  if (!entry) cache.delete(id);
  else cache.set(id, entry);
}

export function removePortraitKey(key) {
  cache.delete(String(key));
}

/** Accepts both the older `"data:…"` value and the tagged `{u, id}` form. */
function parseLocal(value) {
  if (typeof value === 'string') {
    return value.startsWith('data:image/') ? { dataUrl: value, driveId: '' } : null;
  }
  if (value && typeof value.u === 'string' && value.u.startsWith('data:image/')) {
    return { dataUrl: value.u, driveId: String(value.id || '') };
  }
  return null;
}

function readLocalMap() {
  const map = new Map();
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    Object.keys(parsed).forEach((key) => {
      const entry = parseLocal(parsed[key]);
      if (entry) map.set(key, entry);
    });
  } catch {
    /* unreadable storage behaves like no copies */
  }
  return map;
}

function writeLocalMap(map) {
  const raw = {};
  map.forEach((entry, key) => {
    raw[key] = { u: entry.dataUrl, id: entry.driveId || '' };
  });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(raw));
}

export function replacePortraits(items) {
  const next = new Map();
  (items || []).forEach((item) => {
    if (!item || !item.key) return;
    const key = String(item.key);
    const previous = cache.get(key) || null;
    const entry = {};
    if (item.driveId) entry.driveId = String(item.driveId);
    // Bytes are only trusted for the file they were saved with, so a newer
    // upload from another device still wins over this device's copy.
    const previousBytes =
      previous && previous.dataUrl && (!previous.driveId || !entry.driveId || previous.driveId === entry.driveId)
        ? previous.dataUrl
        : '';
    const dataUrl = item.dataUrl || previousBytes;
    if (dataUrl) entry.dataUrl = dataUrl;
    if (entry.driveId || entry.dataUrl) next.set(key, entry);
  });
  // Keep bytes that only exist in memory: a paste whose upload list was read
  // before the row landed must not disappear from the modal.
  cache.forEach((entry, key) => {
    if (!next.has(key) && entry.dataUrl && !entry.driveId) next.set(key, entry);
  });
  cache = next;
  source = (items || []).some((item) => item && item.driveId) ? 'remote' : source;
}

export function loadLocalPortraits({ reset = false } = {}) {
  if (reset) {
    cache = new Map();
    source = 'local';
  }
  if (!cache.size) source = 'local';
  readLocalMap().forEach((local, key) => {
    const entry = cache.get(key) || {};
    if (local.driveId && entry.driveId && local.driveId !== entry.driveId) return;
    cache.set(key, { ...entry, dataUrl: local.dataUrl });
  });
}

export function saveLocalPortrait(key, dataUrl) {
  // Merge into what is already stored instead of rebuilding it from the in-memory
  // cache: entries that came back from the sheet carry a driveId and would be
  // dropped, silently deleting the only copy of someone else's portrait.
  const map = readLocalMap();
  cache.forEach((entry, k) => {
    if (entry.dataUrl) map.set(k, { dataUrl: entry.dataUrl, driveId: entry.driveId || '' });
  });
  const current = cache.get(String(key)) || {};
  map.set(String(key), { dataUrl, driveId: current.driveId || '' });
  try {
    writeLocalMap(map);
  } catch {
    throw new Error('Browser storage is full. Remove some portraits or connect the sheet.');
  }
  source = 'local';
  return true;
}

export function deleteLocalPortrait(key) {
  const map = readLocalMap();
  map.delete(String(key));
  try {
    writeLocalMap(map);
  } catch {
    /* ignore */
  }
}

export const portraitSource = () => source;
export const portraitCount = () => cache.size;

/** Local-only portraits (used to migrate to Drive after a redeploy). */
export function localEntries() {
  return Array.from(readLocalMap().entries()).map(([key, local]) => ({
    key,
    dataUrl: local.dataUrl,
    driveId: local.driveId || '',
  }));
}

export function clearLocalKeys(keys) {
  const map = readLocalMap();
  (keys || []).forEach((key) => map.delete(String(key)));
  try {
    writeLocalMap(map);
  } catch {
    /* ignore */
  }
}

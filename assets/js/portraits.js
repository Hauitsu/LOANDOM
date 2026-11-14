/* Character portraits.
 *
 * Stored in the sheet's Portraits tab as Google Drive file IDs when connected
 * (originals, no re-encoding), or in localStorage while in demo mode.
 * Nothing is fetched from third-party sites.
 */

import { slug } from './util.js';

const LOCAL_KEY = 'loandom.portraits.v1';
const DRIVE_SIZE = 2400;

let cache = new Map(); // key -> { driveId } | { dataUrl }
let source = 'none'; // 'remote' | 'local' | 'none'

const originalUrl = (id) =>
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=view`;

const thumbUrl = (id, size) =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size || DRIVE_SIZE}`;

export function portraitFor(character, size) {
  if (!character) return '';
  const entry = cache.get(String(character.id)) || cache.get(slug(character.name));
  if (!entry) return '';
  if (entry.driveId) {
    // Small contexts (the assignment picker) use a thumbnail;
    // tooltips and the modal ask Drive for the original bytes.
    return size && size < 1000 ? thumbUrl(entry.driveId, size) : originalUrl(entry.driveId);
  }
  return entry.dataUrl || '';
}

export function portraitFallbackFor(character, size) {
  if (!character) return '';
  const entry = cache.get(String(character.id)) || cache.get(slug(character.name));
  return entry && entry.driveId ? thumbUrl(entry.driveId, size || DRIVE_SIZE) : '';
}

export function setPortrait(key, dataUrl) {
  if (!key || !dataUrl) return;
  cache.set(String(key), { dataUrl });
}

export function removePortraitKey(key) {
  cache.delete(String(key));
}

export function replacePortraits(items) {
  cache = new Map();
  (items || []).forEach((item) => {
    if (!item || !item.key) return;
    if (item.driveId) cache.set(String(item.key), { driveId: item.driveId });
    else if (item.dataUrl) cache.set(String(item.key), { dataUrl: item.dataUrl });
  });
  source = 'remote';
}

export function loadLocalPortraits() {
  cache = new Map();
  source = 'local';
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    Object.keys(parsed).forEach((key) => {
      if (typeof parsed[key] === 'string' && parsed[key].startsWith('data:image/')) {
        cache.set(key, { dataUrl: parsed[key] });
      }
    });
  } catch {
    cache = new Map();
  }
}

export function saveLocalPortrait(key, dataUrl) {
  const map = {};
  cache.forEach((entry, k) => {
    if (entry.dataUrl) map[k] = entry.dataUrl;
  });
  map[String(key)] = dataUrl;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
    source = 'local';
  } catch {
    throw new Error('Browser storage is full. Remove some portraits or connect the sheet.');
  }
}

export function deleteLocalPortrait(key) {
  const map = {};
  cache.forEach((entry, k) => {
    if (entry.dataUrl && k !== String(key)) map[k] = entry.dataUrl;
  });
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export const portraitSource = () => source;
export const portraitCount = () => cache.size;

/** Local-only portraits (used to migrate to Drive after a redeploy). */
export function localEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return Object.keys(parsed)
      .filter((key) => typeof parsed[key] === 'string' && parsed[key].startsWith('data:image/'))
      .map((key) => [key, parsed[key]]);
  } catch {
    return [];
  }
}

export function clearLocalKeys(keys) {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    (keys || []).forEach((key) => delete parsed[key]);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

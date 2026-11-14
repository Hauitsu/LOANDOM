/* Character portraits.
 *
 * Stored in the sheet's Portraits tab (base64, 128px) when connected, or in
 * localStorage while in demo mode / before the script is redeployed.
 * Nothing is fetched from third-party sites.
 */

import { slug } from './util.js';

const LOCAL_KEY = 'loandom.portraits.v1';

let cache = new Map(); // key -> data URL
let source = 'none'; // 'remote' | 'local' | 'none'

export function portraitFor(character) {
  if (!character) return '';
  return cache.get(String(character.id)) || cache.get(slug(character.name)) || '';
}

export function setPortrait(key, dataUrl) {
  if (!key || !dataUrl) return;
  cache.set(String(key), dataUrl);
}

export function removePortraitKey(key) {
  cache.delete(String(key));
}

export function replacePortraits(items) {
  cache = new Map();
  (items || []).forEach((item) => {
    if (item && item.key && item.url) cache.set(String(item.key), item.url);
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
        cache.set(key, parsed[key]);
      }
    });
  } catch {
    cache = new Map();
  }
}

export function saveLocalPortrait(key, dataUrl) {
  const map = {};
  cache.forEach((value, k) => {
    map[k] = value;
  });
  map[String(key)] = dataUrl;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
    source = 'local';
  } catch (error) {
    throw new Error('Browser storage is full. Remove some portraits or connect the sheet.');
  }
}

export function deleteLocalPortrait(key) {
  const map = {};
  cache.forEach((value, k) => {
    if (k !== String(key)) map[k] = value;
  });
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export const portraitSource = () => source;
export const portraitCount = () => cache.size;

/** Local-only portraits (used to migrate to the sheet after a redeploy). */
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

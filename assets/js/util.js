/* Small helpers shared by every view. No dependencies on purpose: the site
   has to work when opened straight from GitHub Pages with zero build step. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape untrusted text (sheet cells are untrusted input). */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Escape a value for use inside an HTML attribute. */
export const attr = (value) => esc(value).replace(/`/g, '&#96;');

export const num = (value, fallback = 0) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

export const fmt = (value) => new Intl.NumberFormat('en-US').format(Math.round(num(value)));

export const fmtK = (value) => {
  const n = Math.round(num(value));
  if (Math.abs(n) < 10000) return fmt(n);
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
  return Math.round(n / 1000) + 'k';
};

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const slug = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 40) || 'item';

export const isoNow = () => new Date().toISOString();

export function debounce(fn, wait = 250) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/* ------------------------------------------------------------------ weeks
   Lost Ark resets weekly on Wednesday 06:00 server time. We store a week as
   the ISO date (YYYY-MM-DD) of the Wednesday that opened it, which is stable,
   sortable and readable inside a spreadsheet. */

export const pad2 = (n) => String(n).padStart(2, '0');

export const toKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Parse YYYY-MM-DD as local noon so DST shifts never move the date. */
export function parseKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Sheets turns `2026-11-11` into a Date; JSON gives `2026-11-10T15:00:00.000Z`
 * in a UTC+9 spreadsheet. Convert it back to the *spreadsheet's* calendar day,
 * not the viewer's, so every party member sees the same week.
 */
export function dateKeyInZone(value, timeZone) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type) => parts.find((p) => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return text.slice(0, 10);
  }
}

/** The Wednesday (or configured reset day) that owns the given moment. */
export function weekKeyFromDate(date = new Date(), resetDay = 3, resetHour = 6) {
  const d = new Date(date.getTime());
  let diff = (d.getDay() - resetDay + 7) % 7;
  if (diff === 0 && d.getHours() < resetHour) diff = 7;
  d.setDate(d.getDate() - diff);
  d.setHours(12, 0, 0, 0);
  return toKey(d);
}

export function addWeeks(key, delta) {
  const d = parseKey(key);
  d.setDate(d.getDate() + delta * 7);
  return toKey(d);
}

export function weekRange(key) {
  const start = parseKey(key);
  const end = parseKey(key);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekLabel(key) {
  const { start, end } = weekRange(key);
  const sameMonth = start.getMonth() === end.getMonth();
  const left = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const right = sameMonth ? `${end.getDate()}` : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${left} – ${right}`;
}

export function weekYear(key) {
  return parseKey(key).getFullYear();
}

export function dayLabel(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "3h ago" style relative time for the sync pill. */
export function ago(iso) {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'never';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

/* --------------------------------------------------------------- sorting */

export const byOrder = (a, b) =>
  num(a.order, 999) - num(b.order, 999) || String(a.name).localeCompare(String(b.name));

/* --------------------------------------------------------------- colors */

/** Deterministic color for a player tag that has no color configured. */
export function colorFor(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  const palette = ['#a855f7', '#f59e0b', '#38bdf8', '#f472b6', '#34d399', '#fb7185', '#c084fc', '#fbbf24'];
  return palette[Math.abs(hash) % palette.length];
}

/** Pick readable text color (black or white) for a background hex. */
export function textOn(hex) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return '#fff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? '#0b0d12' : '#ffffff';
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

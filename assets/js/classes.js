/* Local class registry: no external assets, no network.
   Names are display names; `short` is used for compact badges. */

export const CLASSES = [
  { name: 'Berserker', short: 'BRK', color: '#d64545' },
  { name: 'Destroyer', short: 'DES', color: '#a9714b' },
  { name: 'Gunlancer', short: 'GL', color: '#c9a227' },
  { name: 'Paladin', short: 'PAL', color: '#e8c95b' },
  { name: 'Slayer', short: 'SLY', color: '#b03a48' },
  { name: 'Breaker', short: 'BKR', color: '#e07a1f' },

  { name: 'Arcanist', short: 'ARC', color: '#7c5cff' },
  { name: 'Bard', short: 'BRD', color: '#3fc9b8' },
  { name: 'Sorceress', short: 'SOR', color: '#b06cf0' },
  { name: 'Summoner', short: 'SUM', color: '#6d9dc5' },

  { name: 'Glaivier', short: 'GLV', color: '#3f9e6a' },
  { name: 'Striker', short: 'STR', color: '#f0a020' },
  { name: 'Wardancer', short: 'WD', color: '#e8590c' },
  { name: 'Scrapper', short: 'SCR', color: '#d6336c' },
  { name: 'Soulfist', short: 'SF', color: '#f06595' },

  { name: 'Deathblade', short: 'DB', color: '#9b59b6' },
  { name: 'Shadowhunter', short: 'SH', color: '#7048e8' },
  { name: 'Reaper', short: 'REA', color: '#5f3dc4' },
  { name: 'Souleater', short: 'SE', color: '#c2255c' },

  { name: 'Artillerist', short: 'ART', color: '#e67700' },
  { name: 'Deadeye', short: 'DE', color: '#f08c00' },
  { name: 'Sharpshooter', short: 'SS', color: '#2b8a3e' },
  { name: 'Machinist', short: 'MCH', color: '#6c757d' },
  { name: 'Gunslinger', short: 'GS', color: '#c92a2a' },
  { name: 'Scouter', short: 'SC', color: '#0b7285' },

  { name: 'Aeromancer', short: 'AER', color: '#22b8cf' },
  { name: 'Artist', short: 'ARTS', color: '#f2c14e' },
  { name: 'Wildsoul', short: 'WS', color: '#74b816' },
];

const BY_KEY = new Map();
CLASSES.forEach((entry) => {
  BY_KEY.set(entry.name.toLowerCase(), entry);
  BY_KEY.set(entry.short.toLowerCase(), entry);
});

/** Look up a class by full name or short code; null when unknown. */
export function classInfo(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  return BY_KEY.get(key) || null;
}

export function classColor(name, fallback = '#4b566c') {
  return classInfo(name)?.color || fallback;
}

export function classShort(name) {
  const info = classInfo(name);
  if (info) return info.short;
  const text = String(name || '').trim();
  return text ? text.slice(0, 3).toUpperCase() : '';
}

/* Local class registry: bundled publisher emblems, no runtime network.
   Names use the official GLOBAL/WESTERN English spellings. `short` is used for
   compact badges; `icon` is a local SVG tinted as a CSS mask by classbadge.js.
   Aliases are lookup-only: they never add duplicate picker choices. */

export const CLASSES = [
  // Warrior
  { name: 'Berserker', short: 'BRK', color: '#d64545', group: 'Warrior', icon: 'assets/classes/berserker.svg' },
  { name: 'Destroyer', short: 'DES', color: '#a9714b', group: 'Warrior', icon: 'assets/classes/destroyer.svg' },
  { name: 'Gunlancer', short: 'GL', color: '#c9a227', group: 'Warrior', icon: 'assets/classes/gunlancer.svg', aliases: ['Warlord', '워로드'] },
  { name: 'Paladin', short: 'PAL', color: '#e8c95b', group: 'Warrior', icon: 'assets/classes/paladin.svg', aliases: ['Holy Knight', 'Holyknight', '홀리나이트'] },
  { name: 'Slayer', short: 'SLY', color: '#b03a48', group: 'Warrior', icon: 'assets/classes/slayer.svg', aliases: ['슬레이어'] },
  { name: 'Valkyrie', short: 'VLK', color: '#e6c86e', group: 'Warrior', icon: 'assets/classes/valkyrie.svg', aliases: ['발키리'] },

  // Martial Artist
  { name: 'Striker', short: 'STR', color: '#f0a020', group: 'Martial Artist', icon: 'assets/classes/striker.svg', aliases: ['스트라이커'] },
  { name: 'Wardancer', short: 'WD', color: '#e8590c', group: 'Martial Artist', icon: 'assets/classes/wardancer.svg', aliases: ['Battle Master', 'Battlemaster', '배틀마스터'] },
  { name: 'Scrapper', short: 'SCR', color: '#d6336c', group: 'Martial Artist', icon: 'assets/classes/scrapper.svg', aliases: ['Infighter', '인파이터'] },
  { name: 'Soulfist', short: 'SF', color: '#f06595', group: 'Martial Artist', icon: 'assets/classes/soulfist.svg', aliases: ['Soul Master', 'Soulmaster', '기공사'] },
  { name: 'Glaivier', short: 'GLV', color: '#3f9e6a', group: 'Martial Artist', icon: 'assets/classes/glaivier.svg', aliases: ['Lance Master', 'Lancemaster', '창술사'] },
  { name: 'Breaker', short: 'BKR', color: '#e07a1f', group: 'Martial Artist', icon: 'assets/classes/breaker.svg', aliases: ['브레이커'] },

  // Gunner
  { name: 'Gunslinger', short: 'GS', color: '#c92a2a', group: 'Gunner', icon: 'assets/classes/gunslinger.svg', aliases: ['건슬링어'] },
  { name: 'Artillerist', short: 'ART', color: '#e67700', group: 'Gunner', icon: 'assets/classes/artillerist.svg', aliases: ['Blaster', '블래스터'] },
  { name: 'Deadeye', short: 'DE', color: '#f08c00', group: 'Gunner', icon: 'assets/classes/deadeye.svg', aliases: ['Devil Hunter', 'Devilhunter', '데빌헌터'] },
  { name: 'Sharpshooter', short: 'SS', color: '#2b8a3e', group: 'Gunner', icon: 'assets/classes/sharpshooter.svg', aliases: ['Hawk Eye', 'Hawkeye', '호크아이'] },
  { name: 'Machinist', short: 'MCH', color: '#6c757d', group: 'Gunner', icon: 'assets/classes/machinist.svg', aliases: ['Scouter', 'SC', '스카우터'] },

  // Mage
  { name: 'Bard', short: 'BRD', color: '#3fc9b8', group: 'Mage', icon: 'assets/classes/bard.svg', aliases: ['바드'] },
  { name: 'Sorceress', short: 'SOR', color: '#b06cf0', group: 'Mage', icon: 'assets/classes/sorceress.svg', aliases: ['Elemental Master', 'Elementalmaster', '소서리스'] },
  { name: 'Arcanist', short: 'ARC', color: '#7c5cff', group: 'Mage', icon: 'assets/classes/arcanist.svg', aliases: ['Arcana', '아르카나'] },
  { name: 'Summoner', short: 'SUM', color: '#6d9dc5', group: 'Mage', icon: 'assets/classes/summoner.svg', aliases: ['서머너'] },

  // Assassin
  { name: 'Shadowhunter', short: 'SH', color: '#7048e8', group: 'Assassin', icon: 'assets/classes/shadowhunter.svg', aliases: ['Demonic', '데모닉'] },
  { name: 'Deathblade', short: 'DB', color: '#9b59b6', group: 'Assassin', icon: 'assets/classes/deathblade.svg', aliases: ['Blade', '블레이드'] },
  { name: 'Reaper', short: 'REA', color: '#5f3dc4', group: 'Assassin', icon: 'assets/classes/reaper.svg', aliases: ['리퍼'] },
  { name: 'Souleater', short: 'SE', color: '#c2255c', group: 'Assassin', icon: 'assets/classes/souleater.svg', aliases: ['Soul Eater', '소울이터'] },

  // Specialist
  { name: 'Artist', short: 'ARTS', color: '#f2c14e', group: 'Specialist', icon: 'assets/classes/artist.svg', aliases: ['도화가'] },
  { name: 'Aeromancer', short: 'AER', color: '#22b8cf', group: 'Specialist', icon: 'assets/classes/aeromancer.svg', aliases: ['기상술사'] },
  { name: 'Wildsoul', short: 'WS', color: '#74b816', group: 'Specialist', icon: 'assets/classes/wildsoul.svg', aliases: ['환수사'] },
  { name: 'Dimensionalist', short: 'DIM', color: '#8e6cf0', group: 'Specialist', icon: 'assets/classes/dimensionalist.svg', aliases: ['Dimension Master', 'Dimensionmaster', '차원술사'] },

  // Guardianknight (official one-word GLOBAL name; introduced February 2026)
  { name: 'Guardianknight', short: 'GDK', color: '#4c7fd6', group: 'Guardianknight', icon: 'assets/classes/guardianknight.svg', aliases: ['Guardian Knight', 'GuardianKnight', '가디언나이트'] },
];

/** Normalise a sheet value so legacy spellings, spacing and zero-width
    characters still resolve without rewriting the stored value. */
const classKey = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\u00ad\u200b-\u200d\ufeff]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, '')
  .toLowerCase();

const BY_KEY = new Map();
CLASSES.forEach((entry) => {
  BY_KEY.set(classKey(entry.name), entry);
  BY_KEY.set(classKey(entry.short), entry);
  entry.aliases?.forEach((alias) => {
    const key = classKey(alias);
    if (key && !BY_KEY.has(key)) BY_KEY.set(key, entry);
  });
});

/** Look up a class by full name, alias or short code; null when unknown. */
export function classInfo(name) {
  const key = classKey(name);
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

/** Canonical picker order: official family, then class display name. */
export const CLASS_GROUPS = [
  'Warrior',
  'Martial Artist',
  'Gunner',
  'Mage',
  'Assassin',
  'Specialist',
  'Guardianknight',
].map((name) => ({ name, entries: CLASSES.filter((entry) => entry.group === name) }));

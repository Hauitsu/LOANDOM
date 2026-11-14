/* Pure data layer: normalisation, gold math and week validation.
   Nothing in here touches the DOM or the network, which keeps it easy to reason
   about and to unit-test later. */

import { num, byOrder, uid, isoNow, weekKeyFromDate, addWeeks } from './util.js';

export const LIMITS = {
  goldCharacters: 6, // roster-wide gold earners per week
  goldContent: 3, // endgame gold rewards per character per week
};

export const emptyData = () => ({
  config: {},
  raids: [],
  players: [],
  characters: [],
  runs: [],
  assignments: [],
  ledger: [],
});

const truthy = (value) => {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'y' || text === 'x' || text === '✓';
};

const text = (value) => String(value ?? '').trim();

export function normalizeRaid(raw, index = 0) {
  const name = text(raw.name) || 'Unnamed raid';
  return {
    id: text(raw.id) || `raid_${index}_${Date.now().toString(36)}`,
    name,
    short: text(raw.short) || name.toUpperCase(),
    difficulty: text(raw.difficulty) || 'Normal',
    ilvl: num(raw.ilvl, 0),
    goldTradable: num(raw.goldTradable, 0),
    goldBound: num(raw.goldBound, 0),
    partySize: num(raw.partySize, 8),
    order: num(raw.order, (index + 1) * 10),
    active: raw.active === undefined || raw.active === '' ? true : truthy(raw.active),
    note: text(raw.note),
  };
}

export function normalizePlayer(raw, index = 0) {
  const name = text(raw.name) || `Player ${index + 1}`;
  return {
    id: text(raw.id) || `p_${index}_${Date.now().toString(36)}`,
    name,
    tag: text(raw.tag) || name.slice(0, 3).toUpperCase(),
    color: text(raw.color) || '',
    order: num(raw.order, (index + 1) * 10),
  };
}

export function normalizeCharacter(raw, index = 0) {
  const name = text(raw.name) || 'Unnamed';
  return {
    id: text(raw.id) || `c_${index}_${Date.now().toString(36)}`,
    playerId: text(raw.playerId),
    name,
    className: text(raw.className),
    ilvl: num(raw.ilvl, 0),
    goldEarner: raw.goldEarner === undefined || raw.goldEarner === '' ? true : truthy(raw.goldEarner),
    active: raw.active === undefined || raw.active === '' ? true : truthy(raw.active),
    notes: text(raw.notes),
  };
}

export function normalizeRun(raw, index = 0) {
  return {
    id: text(raw.id) || `r_${index}_${Date.now().toString(36)}`,
    week: text(raw.week),
    raidId: text(raw.raidId),
    index: num(raw.index, index + 1),
    cleared: truthy(raw.cleared),
    claims: Math.max(0, num(raw.claims, 1)),
    note: text(raw.note),
    updatedAt: text(raw.updatedAt),
  };
}

export function normalizeAssignment(raw, index = 0) {
  return {
    id: text(raw.id) || `a_${index}_${Date.now().toString(36)}`,
    runId: text(raw.runId),
    playerId: text(raw.playerId),
    characterId: text(raw.characterId),
    name: text(raw.name),
    updatedAt: text(raw.updatedAt),
  };
}

export function normalizeLedger(raw, index = 0) {
  return {
    id: text(raw.id) || `l_${index}_${Date.now().toString(36)}`,
    week: text(raw.week),
    kind: text(raw.kind).toLowerCase() === 'bound' ? 'bound' : 'tradable',
    amount: num(raw.amount, 0),
    source: text(raw.source) || 'Manual',
    note: text(raw.note),
    playerId: text(raw.playerId),
    characterId: text(raw.characterId),
    updatedAt: text(raw.updatedAt),
  };
}

/** Coerce anything (sheet rows, JSON, seed) into the canonical shape. */
export function normalizeData(raw = {}) {
  return {
    config: raw.config && typeof raw.config === 'object' ? raw.config : {},
    raids: (raw.raids || []).map(normalizeRaid),
    players: (raw.players || []).map(normalizePlayer),
    characters: (raw.characters || []).map(normalizeCharacter),
    runs: (raw.runs || []).map(normalizeRun),
    assignments: (raw.assignments || []).map(normalizeAssignment),
    ledger: (raw.ledger || []).map(normalizeLedger),
  };
}

/** Deep clone a seed and replace @current / @prev tokens with real weeks. */
export function resolveSeed(seed, currentWeek, resetDay = 3, resetHour = 6) {
  const data = JSON.parse(JSON.stringify(seed));
  const prevWeek = addWeeks(currentWeek, -1);
  const map = { '@current': currentWeek, '@prev': prevWeek };
  data.runs.forEach((run) => {
    run.week = map[run.week] || run.week;
  });
  data.ledger.forEach((entry) => {
    entry.week = map[entry.week] || entry.week;
  });
  return normalizeData(data);
}

/* --------------------------------------------------------------- indexes */

export function buildIndex(data) {
  const players = new Map(data.players.map((p) => [p.id, p]));
  const raids = new Map(data.raids.map((r) => [r.id, r]));
  const characters = new Map(data.characters.map((c) => [c.id, c]));
  const runs = new Map(data.runs.map((r) => [r.id, r]));
  const assignmentsByRun = new Map();
  data.assignments.forEach((a) => {
    if (!assignmentsByRun.has(a.runId)) assignmentsByRun.set(a.runId, new Map());
    assignmentsByRun.get(a.runId).set(a.playerId, a);
  });
  return { players, raids, characters, runs, assignmentsByRun };
}

export const activeRaids = (data) => data.raids.filter((r) => r.active !== false).sort(byOrder);
export const sortedPlayers = (data) => data.players.slice().sort(byOrder);

export function charactersOf(data, playerId) {
  return data.characters
    .filter((c) => c.playerId === playerId)
    .sort((a, b) => (b.ilvl || 0) - (a.ilvl || 0) || a.name.localeCompare(b.name));
}

export function findCharacterByName(data, playerId, name) {
  const needle = text(name).toLowerCase();
  return data.characters.find(
    (c) => c.playerId === playerId && c.name.trim().toLowerCase() === needle,
  );
}

export function nextRunIndex(data, raidId, week) {
  const used = data.runs.filter((r) => r.raidId === raidId && r.week === week).map((r) => num(r.index));
  return used.length ? Math.max(...used) + 1 : 1;
}

/* ----------------------------------------------------------------- stats */

/**
 * Gold model:
 *   goldMode = 'run'       -> each cleared run pays the raid gold once (sheet style)
 *   goldMode = 'character' -> each character in a cleared run pays the gold (game style)
 */
export function runGold(run, raid, assignedCount, goldMode) {
  if (!run || !raid || !run.cleared) return { tradable: 0, bound: 0, total: 0, claims: 0 };
  const claims = goldMode === 'character' ? Math.max(1, assignedCount) : Math.max(1, num(run.claims, 1));
  const tradable = claims * num(raid.goldTradable);
  const bound = claims * num(raid.goldBound);
  return { tradable, bound, total: tradable + bound, claims };
}

const emptyTotals = () => ({ tradable: 0, bound: 0, total: 0 });

const addTotals = (acc, add) => {
  acc.tradable += add.tradable;
  acc.bound += add.bound;
  acc.total += add.total;
  return acc;
};

export function computeWeek(data, week, settings = {}) {
  const goldMode = settings.goldMode === 'character' ? 'character' : 'run';
  const players = sortedPlayers(data);
  const raids = activeRaids(data);
  const idx = buildIndex(data);
  const warnings = [];
  const totals = emptyTotals();

  const charRunCount = new Map(); // characterId -> number of cleared runs (all raids)
  const charRaidSeen = new Map(); // characterId -> Set(raidId)

  const raidBlocks = raids.map((raid) => {
    const runs = data.runs
      .filter((r) => r.week === week && r.raidId === raid.id)
      .sort((a, b) => num(a.index) - num(b.index));

    const rows = runs.map((run) => {
      const cells = {};
      let assignedCount = 0;
      players.forEach((player) => {
        const assignment = idx.assignmentsByRun.get(run.id)?.get(player.id) || null;
        cells[player.id] = assignment;
        if (assignment) assignedCount += 1;
      });

      const gold = runGold(run, raid, assignedCount, goldMode);
      if (run.cleared) addTotals(totals, gold);

      if (run.cleared && assignedCount === 0) {
        warnings.push({
          level: 'info',
          code: 'empty-clear',
          text: `${raid.short} run #${run.index} is checked but has nobody assigned.`,
          runId: run.id,
        });
      }

      players.forEach((player) => {
        const assignment = cells[player.id];
        if (!assignment?.name) return;
        const character = assignment.characterId ? idx.characters.get(assignment.characterId) : null;
        const label = character ? character.name : assignment.name;
        const charKey = character ? character.id : `${player.id}:${label.toLowerCase()}`;

        if (run.cleared) {
          charRunCount.set(charKey, (charRunCount.get(charKey) || 0) + 1);
          if (!charRaidSeen.has(charKey)) charRaidSeen.set(charKey, new Set());
          const seen = charRaidSeen.get(charKey);
          if (seen.has(raid.id)) {
            warnings.push({
              level: 'warn',
              code: 'duplicate-raid',
              text: `${label} (${player.name}) is assigned to ${raid.short} more than once this week.`,
              runId: run.id,
            });
          }
          seen.add(raid.id);
        }

        if (character && character.ilvl && raid.ilvl && character.ilvl < raid.ilvl) {
          warnings.push({
            level: 'warn',
            code: 'ilvl',
            text: `${label} is ${character.ilvl} but ${raid.short} needs ${raid.ilvl}.`,
            runId: run.id,
          });
        }
      });

      return { run, cells, assignedCount, gold };
    });

    const blockTotals = rows.reduce((acc, row) => addTotals(acc, row.gold), emptyTotals());
    const clearedRuns = rows.filter((row) => row.run.cleared).length;

    return { raid, rows, totals: blockTotals, clearedRuns, runCount: rows.length };
  });

  // Gold slots per character (endgame content)
  charRunCount.forEach((count, charKey) => {
    if (count > LIMITS.goldContent) {
      const character = idx.characters.get(charKey);
      const label = character ? character.name : charKey.split(':')[1];
      warnings.push({
        level: 'warn',
        code: 'content-cap',
        text: `${label} has ${count} gold clears — the game only pays for ${LIMITS.goldContent}.`,
      });
    }
  });

  // Gold earners per roster
  const perPlayer = players.map((player) => {
    const charIds = new Set();
    let clearedRuns = 0;
    raidBlocks.forEach((block) => {
      block.rows.forEach((row) => {
        if (!row.run.cleared) return;
        const assignment = row.cells[player.id];
        if (!assignment) return;
        clearedRuns += 1;
        if (assignment.characterId) charIds.add(assignment.characterId);
        else if (assignment.name) charIds.add(`${player.id}:${assignment.name.toLowerCase()}`);
      });
    });
    if (charIds.size > LIMITS.goldCharacters) {
      warnings.push({
        level: 'warn',
        code: 'char-cap',
        text: `${player.name} has ${charIds.size} gold-earning characters — only ${LIMITS.goldCharacters} can earn.`,
      });
    }
    return {
      player,
      goldCharacters: charIds.size,
      clearedRuns,
      assignments: raidBlocks.reduce(
        (acc, block) => acc + block.rows.filter((row) => row.cells[player.id]?.name).length,
        0,
      ),
    };
  });

  // Manual ledger entries are a separate pot (bound gold from other content,
  // una tokens, chaos gates, ...) and are added on top of raid gold.
  const ledgerRows = data.ledger.filter((entry) => entry.week === week);
  const ledgerTotals = ledgerRows.reduce((acc, entry) => {
    if (entry.kind === 'bound') acc.bound += num(entry.amount);
    else acc.tradable += num(entry.amount);
    acc.total += num(entry.amount);
    return acc;
  }, emptyTotals());

  return {
    week,
    goldMode,
    raidBlocks,
    players,
    perPlayer,
    totals: {
      tradable: totals.tradable + ledgerTotals.tradable,
      bound: totals.bound + ledgerTotals.bound,
      total: totals.total + ledgerTotals.total,
      raidTradable: totals.tradable,
      raidBound: totals.bound,
      ledgerTradable: ledgerTotals.tradable,
      ledgerBound: ledgerTotals.bound,
    },
    ledger: { rows: ledgerRows, totals: ledgerTotals },
    warnings,
  };
}

/** Totals only — used by the history/sparkline views. */
export function weekTotals(data, week, settings) {
  const stats = computeWeek(data, week, settings);
  const runs = data.runs.filter((r) => r.week === week).length;
  const cleared = data.runs.filter((r) => r.week === week && r.cleared).length;
  return { week, totals: stats.totals, runs, cleared };
}

export function availableWeeks(data, currentWeek) {
  const set = new Set([currentWeek]);
  data.runs.forEach((r) => r.week && set.add(r.week));
  data.ledger.forEach((l) => l.week && set.add(l.week));
  return Array.from(set).sort().reverse();
}

export function recentWeeks(data, currentWeek, count = 8) {
  const weeks = availableWeeks(data, currentWeek);
  const anchor = weeks[0] || currentWeek;
  const out = [];
  for (let i = 0; i < count; i++) {
    const key = addWeeks(anchor, -i);
    if (weeks.includes(key)) out.push(key);
  }
  return out;
}

/* -------------------------------------------------------------- mutations
   Small pure helpers used by the store. They return fresh objects so the
   optimistic UI never mutates what is already on screen. */

export function cloneData(data) {
  return {
    config: { ...data.config },
    raids: data.raids.map((r) => ({ ...r })),
    players: data.players.map((p) => ({ ...p })),
    characters: data.characters.map((c) => ({ ...c })),
    runs: data.runs.map((r) => ({ ...r })),
    assignments: data.assignments.map((a) => ({ ...a })),
    ledger: data.ledger.map((l) => ({ ...l })),
  };
}

export function makeCharacter(playerId, name) {
  const clean = String(name || '').trim();
  return {
    id: uid('c'),
    playerId,
    name: clean,
    className: '',
    ilvl: 0,
    goldEarner: true,
    active: true,
    notes: '',
  };
}

export function makeRun(week, raidId, index) {
  return {
    id: uid('r'),
    week,
    raidId,
    index,
    cleared: false,
    claims: 1,
    note: '',
    updatedAt: isoNow(),
  };
}

export function makeAssignment(runId, playerId, character) {
  return {
    id: uid('a'),
    runId,
    playerId,
    characterId: character?.id || '',
    name: character?.name || '',
    updatedAt: isoNow(),
  };
}

export { weekKeyFromDate };

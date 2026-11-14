/* Minimal fake of the Apps Script runtime, enough to exercise Code.gs.
   Not shipped — used to validate the sheet API logic offline. */

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

class Range {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = [];
      for (let c = 0; c < this.numCols; c++) {
        const value = this.sheet.cells[this.row - 1 + r]?.[this.col - 1 + c];
        line.push(value === undefined ? '' : value);
      }
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    values.forEach((line, r) => {
      const target = this.row - 1 + r;
      this.sheet.cells[target] = this.sheet.cells[target] || [];
      line.forEach((value, c) => {
        this.sheet.cells[target][this.col - 1 + c] = value;
      });
    });
    this.sheet.trim();
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setNumberFormat() { return this; }
}

class Sheet {
  constructor(name) { this.name = name; this.cells = []; }
  trim() {
    while (this.cells.length && this.cells[this.cells.length - 1].every((v) => v === '' || v === undefined)) {
      this.cells.pop();
    }
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }
  getLastRow() {
    let last = 0;
    this.cells.forEach((row, i) => {
      if (row.some((v) => v !== '' && v !== undefined && v !== null)) last = i + 1;
    });
    return last;
  }
  getLastColumn() { return this.cells.reduce((m, row) => Math.max(m, row.length), 0); }
  getMaxColumns() { return Math.max(this.getLastColumn(), 12); }
  getRange(row, col, numRows = 1, numCols = 1) { return new Range(this, row, col, numRows, numCols); }
  appendRow(values) {
    const row = this.getLastRow() + 1;
    this.getRange(row, 1, 1, values.length).setValues([values]);
  }
  deleteRow(n) { this.cells.splice(n - 1, 1); }
  clearContents() { this.cells = []; }
  setFrozenRows() {}
}

class Spreadsheet {
  constructor(name, timezone = 'UTC') {
    this.name = name;
    this.timezone = timezone;
    this.sheets = [];
  }
  getName() { return this.name; }
  getSpreadsheetTimeZone() { return this.timezone; }
  getSheets() { return this.sheets; }
  getSheetByName(name) { return this.sheets.find((s) => s.name === name) || null; }
  insertSheet(name) { const s = new Sheet(name); this.sheets.push(s); return s; }
  deleteSheet(sheet) { this.sheets = this.sheets.filter((s) => s !== sheet); }
  toast() {}
}

const ss = new Spreadsheet('LOANDOM');
const props = new Map();
const properties = {
  getProperty: (k) => (props.has(k) ? props.get(k) : null),
  setProperty: (k, v) => props.set(k, String(v)),
  deleteProperty: (k) => props.delete(k),
};

const context = {
  console,
  JSON,
  Math,
  Date,
  String,
  Number,
  Object,
  Array,
  Boolean,
  parseFloat,
  parseInt,
  isNaN,
  Error,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ss,
    getActive: () => ss,
    openById: () => ss,
  },
  PropertiesService: { getScriptProperties: () => properties },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (text) => ({
      text,
      setMimeType() { return this; },
    }),
  },
  Utilities: { getUuid: () => crypto.randomUUID() },
  Logger: { log: (...args) => console.log(...args) },
  BAD_PIN_TEST: true,
};
context.globalThis = context;

const code = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
vm.createContext(context);
vm.runInContext(code, context);

const call = (name, ...args) => context[name](...args);

function get(params) {
  const res = call('doGet', { parameter: params });
  return JSON.parse(res.text);
}
function post(body) {
  const res = call('doPost', { postData: { contents: JSON.stringify(body) } });
  return JSON.parse(res.text);
}

let failures = 0;
const check = (label, condition, extra = '') => {
  if (!condition) {
    failures += 1;
    console.log('  FAIL', label, extra);
  } else {
    console.log('  ok  ', label);
  }
};

console.log('setup');
call('setup');
let health = get({ op: 'health' });
check('health ok', health.ok === true);
check('all tabs exist', health.tabs.length === 7, JSON.stringify(health.tabs));

let snap = get({ op: 'snapshot' });
check('default raids seeded', snap.data.raids.length === 4, snap.data.raids.length);
check('default players seeded', snap.data.players.length === 4);
check('no runs yet', snap.data.runs.length === 0);

console.log('replaceAll');
const data = {
  raids: [
    { id: 'r1', name: 'Belgardin', short: 'BELG NM', difficulty: 'Normal', ilvl: 1750, goldTradable: 50000, goldBound: 0, partySize: 8, order: 10, active: true, note: '' },
    { id: 'r2', name: 'Serca', short: 'SERCA', difficulty: 'Hard', ilvl: 1730, goldTradable: 44000, goldBound: 0, partySize: 8, order: 20, active: true, note: '' },
  ],
  players: [{ id: 'p1', name: 'RYN', tag: 'RYN', color: '#a855f7', order: 10 }],
  characters: [{ id: 'c1', playerId: 'p1', name: 'tayori', className: '', ilvl: 1770, goldEarner: true, active: true }],
  runs: [{ id: 'run1', week: '2026-11-11', raidId: 'r1', index: 1, cleared: true, claims: 1 }],
  assignments: [{ id: 'a1', runId: 'run1', playerId: 'p1', characterId: 'c1', name: 'tayori' }],
  ledger: [{ id: 'l1', week: '2026-11-11', kind: 'bound', amount: 231000, source: 'Sheet', note: '' }],
};
let res = post({ op: 'mutate', ops: [{ type: 'replaceAll', data }] });
check('replaceAll accepted', res.ok === true, JSON.stringify(res));
snap = get({ op: 'snapshot' });
check('raids replaced', snap.data.raids.length === 2, snap.data.raids.length);
check('run stored', snap.data.runs.length === 1 && snap.data.runs[0].cleared === true);
check('assignment stored', snap.data.assignments[0].name === 'tayori');
check('ledger bound kept', snap.data.ledger[0].amount === 231000 && snap.data.ledger[0].kind === 'bound');

console.log('unchecked snapshot with revision');
const rev = snap.revision;
const same = get({ op: 'snapshot', rev });
check('unchanged short circuit', same.unchanged === true, JSON.stringify(same));

console.log('run.toggle');
res = post({ op: 'mutate', ops: [{ type: 'run.toggle', id: 'run1', cleared: false }] });
check('toggle accepted', res.ok === true);
snap = get({ op: 'snapshot' });
check('run unchecked', snap.data.runs[0].cleared === false);
res = post({ op: 'mutate', ops: [{ type: 'run.toggle', id: 'run1', cleared: true }] });

console.log('cell.set creates character');
res = post({
  op: 'mutate',
  ops: [{ type: 'cell.set', runId: 'run1', playerId: 'p1', characterId: '', name: 'frian' }],
});
check('cell.set accepted', res.ok === true, JSON.stringify(res));
snap = get({ op: 'snapshot' });
check('character auto-created', snap.data.characters.some((c) => c.name === 'frian'));
check('assignment updated in place', snap.data.assignments.length === 1 && snap.data.assignments[0].name === 'frian', JSON.stringify(snap.data.assignments));
check('assignment is idempotent (update, not duplicate)', (() => {
  post({ op: 'mutate', ops: [{ type: 'cell.set', runId: 'run1', playerId: 'p1', name: 'frian' }] });
  const again = get({ op: 'snapshot' });
  return again.data.assignments.length === 1 && again.data.assignments[0].name === 'frian';
})());

console.log('healing hand-typed rows');
const runsSheet = ss.getSheetByName('Runs');
runsSheet.appendRow(['', '2026-11-11', 'r2', 1, true, 1, 'typed by hand', '']);
snap = get({ op: 'snapshot' });
check('orphan row healed with id', snap.data.runs.some((r) => r.raidId === 'r2' && r.id.startsWith('auto_')));
check('healed row has updatedAt', snap.data.runs.find((r) => r.raidId === 'r2').updatedAt.length > 0);

console.log('run.delete cascades assignments');
res = post({ op: 'mutate', ops: [{ type: 'run.delete', id: 'run1' }] });
check('delete accepted', res.ok === true);
snap = get({ op: 'snapshot' });
check('run gone', !snap.data.runs.some((r) => r.id === 'run1'));
check('its assignments gone', snap.data.assignments.every((a) => a.runId !== 'run1'));

console.log('raid.delete cascades');
res = post({ op: 'mutate', ops: [{ type: 'raid.delete', id: 'r2' }] });
snap = get({ op: 'snapshot' });
check('raid gone', !snap.data.raids.some((r) => r.id === 'r2'));
check('its runs gone', !snap.data.runs.some((r) => r.raidId === 'r2'));

console.log('pin protection');
call('setPin', '1234');
health = get({ op: 'health' });
check('pinRequired true', health.pinRequired === true);
res = post({ op: 'mutate', pin: '', ops: [{ type: 'run.toggle', id: 'x', cleared: true }] });
check('write without pin rejected', res.ok === false && res.code === 'BAD_PIN', JSON.stringify(res));
res = post({ op: 'mutate', pin: '1234', ops: [{ type: 'ledger.delete', id: 'l1' }] });
check('write with pin accepted', res.ok === true, JSON.stringify(res));
snap = get({ op: 'snapshot' });
check('ledger deleted', snap.data.ledger.length === 0);

console.log('read key protection');
call('setReadKey', 'k'.repeat(32));
health = get({ op: 'health' });
check('readKeyRequired true', health.readKeyRequired === true);
let denied = get({ op: 'snapshot' });
check('snapshot without key rejected', denied.ok === false && denied.code === 'BAD_KEY', JSON.stringify(denied));
denied = get({ op: 'snapshot', key: 'wrong' });
check('wrong key rejected', denied.ok === false && denied.code === 'BAD_KEY');
let allowed = get({ op: 'snapshot', key: 'k'.repeat(32) });
check('snapshot with key allowed', allowed.ok === true && Array.isArray(allowed.data.raids));
const postSnap = post({ op: 'snapshot', key: 'k'.repeat(32) });
check('POST snapshot with key allowed', postSnap.ok === true && Array.isArray(postSnap.data.players));
call('clearReadKey');
check('clearReadKey reopens reads', get({ op: 'snapshot' }).ok === true);

console.log('player.upsert + raid.upsert');
res = post({ op: 'mutate', pin: '1234', ops: [
  { type: 'player.upsert', player: { id: 'p2', name: 'OIS', tag: 'OIS', color: '#f59e0b', order: 20 } },
  { type: 'raid.upsert', raid: { id: 'r3', name: 'Kazeros', short: 'KAZ', difficulty: 'Hard', ilvl: 1730, goldTradable: 48000, goldBound: 0, partySize: 8, order: 30, active: true } },
] });
check('batch accepted', res.ok === true);
snap = get({ op: 'snapshot' });
check('player added', snap.data.players.some((p) => p.id === 'p2'));
check('raid added', snap.data.raids.some((r) => r.id === 'r3' && r.goldTradable === 48000));
check('revision advanced', Number(snap.revision) > Number(rev));

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall backend checks passed');
process.exit(failures ? 1 : 0);

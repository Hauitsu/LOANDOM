/**
 * LOANDOM — Google Sheet backend (Apps Script Web App)
 * -----------------------------------------------------
 * This file turns one spreadsheet into the database + API for the static site.
 * No VPS, no domain, no billing: GitHub Pages talks to this script, the script
 * owns the sheet.
 *
 * SETUP
 *   1. Google Sheet -> Extensions -> Apps Script.
 *   2. Paste this file as Code.gs (and appsscript.json in Project Settings).
 *   3. Run setup() once and approve permissions. It creates every tab.
 *   4. Optional: run setPin('1234') so only people with the PIN can write.
 *   5. Deploy -> New deployment -> Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *      Copy the /exec URL into the site (Settings -> Google Sheet).
 *
 * ENDPOINTS
 *   GET  ?op=health                     -> status, revision, key/PIN requirements
 *   GET  ?op=snapshot[&key=K][&rev=N]   -> full data, or {unchanged:true}
 *   POST {op:'snapshot', key, rev}      -> same, without putting the key in a URL
 *   POST {op:'mutate', pin, ops}        -> batched writes, returns new revision
 *
 * Two independent secrets, both optional but recommended:
 *   READ_KEY (setReadKey) -> required for reads
 *   PIN      (setPin)     -> required for writes
 */

var APP = 'loandom';
var APP_VERSION = '2.0.0';

var TABS = {
  Config: ['key', 'value'],
  Raids: ['id', 'name', 'short', 'difficulty', 'ilvl', 'goldTradable', 'goldBound', 'partySize', 'order', 'active', 'note'],
  Players: ['id', 'name', 'tag', 'color', 'order'],
  Characters: ['id', 'playerId', 'name', 'className', 'ilvl', 'goldEarner', 'active', 'notes', 'updatedAt'],
  Runs: ['id', 'week', 'raidId', 'index', 'cleared', 'claims', 'note', 'updatedAt'],
  Assignments: ['id', 'runId', 'playerId', 'characterId', 'name', 'updatedAt'],
  Ledger: ['id', 'week', 'kind', 'amount', 'source', 'note', 'playerId', 'characterId', 'updatedAt'],
  Portraits: [
    'key', 'mime', 'chunks',
    'data', 'data2', 'data3', 'data4', 'data5', 'data6', 'data7', 'data8',
    'data9', 'data10', 'data11', 'data12', 'data13', 'data14', 'data15', 'data16',
    'data17', 'data18', 'data19', 'data20', 'data21', 'data22', 'data23', 'data24',
    'updatedAt',
  ],
};

var NUMERIC = {
  Raids: ['ilvl', 'goldTradable', 'goldBound', 'partySize', 'order'],
  Players: ['order'],
  Characters: ['ilvl'],
  Runs: ['index', 'claims'],
  Ledger: ['amount'],
  Portraits: ['chunks'],
};

var BOOLEAN = {
  Raids: ['active'],
  Characters: ['goldEarner', 'active'],
  Runs: ['cleared'],
};

var DEFAULT_RAIDS = [
  ['raid_belgardin_nm', 'Belgardin', 'BELGARDIN NM', 'Normal', 1750, 50000, 0, 8, 10, true, 'Shadow Raid · 2 gates · 8 players'],
  ['raid_kazeros_hm', 'Kazeros: Final Day', 'KAZEROS HM', 'Hard', 1730, 48000, 0, 8, 20, true, 'Denouement · 2 gates · 8 players'],
  ['raid_belgardin_hm', 'Belgardin', 'BELGARDIN HM', 'Hard', 1770, 62000, 0, 8, 30, true, 'Shadow Raid · 2 gates · 8 players'],
  ['raid_serca_hm', 'Serca', 'SERCA HM', 'Hard', 1730, 44000, 0, 8, 40, true, 'Shadow Raid · 8 players'],
];

var DEFAULT_PLAYERS = [
  ['p_ois', 'OIS', 'OIS', '#94a3b8', 10],
  ['p_ryn', 'RYN', 'RYN', '#a855f7', 20],
  ['p_dp', 'DP', 'DP', '#64748b', 30],
  ['p_tq', 'TQ', 'TQ', '#f59e0b', 40],
];

/* ==================================================================== setup */

/**
 * Container-bound usage (Extensions -> Apps Script) resolves automatically.
 * A standalone script can point at a sheet instead: setSheetId('<sheet id>').
 */
function ss_() {
  var bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('No spreadsheet attached. Use Extensions > Apps Script from the sheet, or run setSheetId("<id>").');
}

function setSheetId(id) {
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', String(id || '').trim());
}

/** Run once from the editor. Creates tabs, headers and the default catalog. */
function setup() {
  var ss = ss_();
  var props = PropertiesService.getScriptProperties();

  Object.keys(TABS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var headers = TABS[name];
    var first = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
    var needsHeader = headers.some(function (h, i) { return String(first[i] || '') !== h; });
    if (needsHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#111827').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      if (sheet.getMaxColumns() > headers.length) {
        // Do not shrink user sheets; just make sure the used area is sane.
      }
    }
  });

  var raids = ss.getSheetByName('Raids');
  if (raids.getLastRow() < 2) {
    raids.getRange(2, 1, DEFAULT_RAIDS.length, TABS.Raids.length).setValues(DEFAULT_RAIDS);
  }
  var players = ss.getSheetByName('Players');
  if (players.getLastRow() < 2) {
    players.getRange(2, 1, DEFAULT_PLAYERS.length, TABS.Players.length).setValues(DEFAULT_PLAYERS);
  }

  var config = ss.getSheetByName('Config');
  writeConfig_(config, 'name', 'LOANDOM');
  writeConfig_(config, 'createdAt', new Date().toISOString());
  writeConfig_(config, 'appVersion', APP_VERSION);

  removeDefaultSheet_(ss);
  bumpRevision_(props);
  ss_().toast('LOANDOM sheet is ready. Now deploy as a Web App.', 'Setup complete', 8);
}

function removeDefaultSheet_(ss) {
  var sheet = ss.getSheetByName('Sheet1');
  if (sheet && ss.getSheets().length > 1 && sheet.getLastRow() <= 1) ss.deleteSheet(sheet);
}

function writeConfig_(sheet, key, value) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

/** Optional write protection: setPin('<long random string>'). */
function setPin(pin) {
  PropertiesService.getScriptProperties().setProperty('PIN', String(pin || ''));
  ss_().toast(pin ? 'PIN set - writes now require it.' : 'PIN cleared.', 'LOANDOM', 6);
}

function clearPin() {
  PropertiesService.getScriptProperties().deleteProperty('PIN');
}

/**
 * Optional read protection: setReadKey('<long random string>').
 * When set, snapshots require the key. Share it with your party, not publicly.
 */
function setReadKey(key) {
  var clean = String(key || '').trim();
  if (clean && clean.length < 16) throw new Error('Use at least 16 characters, ideally 32 or more.');
  PropertiesService.getScriptProperties().setProperty('READ_KEY', clean);
  ss_().toast(clean ? 'Read key set - snapshots now require it.' : 'Read key cleared.', 'LOANDOM', 6);
}

function clearReadKey() {
  PropertiesService.getScriptProperties().deleteProperty('READ_KEY');
}

function checkReadAccess_(key) {
  var required = PropertiesService.getScriptProperties().getProperty('READ_KEY');
  if (!required) return { ok: true };
  if (String(key || '') === String(required)) return { ok: true };
  return {
    ok: false,
    code: 'BAD_KEY',
    message: 'A valid read key is required. Add it in the app: Settings > Google Sheet > Read key.',
  };
}

/** Quick sanity check from the editor. */
function testSnapshot() {
  Logger.log(JSON.stringify(snapshot_(), null, 2).slice(0, 4000));
}

/* ================================================================= HTTP API */

function doGet(e) {
  var params = (e && e.parameter) || {};
  try {
    if (params.op === 'health' || params.op === 'ping') return json_(health_());
    if (params.op === 'portraits') {
      var portraitGuard = checkReadAccess_(params.key);
      if (!portraitGuard.ok) return json_(portraitGuard);
      return json_(portraits_());
    }
    var guard = checkReadAccess_(params.key);
    if (!guard.ok) return json_(guard);
    return json_(snapshot_(params.rev));
  } catch (error) {
    return json_({ ok: false, code: 'SERVER_ERROR', message: String(error && error.message || error) });
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    var op = body.op || 'mutate';
    if (op === 'health') return json_(health_());

    // Reads can come through POST too, so the key never has to sit in a URL.
    if (op === 'snapshot') {
      var readGuard = checkReadAccess_(body.key);
      if (!readGuard.ok) return json_(readGuard);
      return json_(snapshot_(body.rev));
    }

    if (op === 'portraits') {
      var portraitGuard = checkReadAccess_(body.key);
      if (!portraitGuard.ok) return json_(portraitGuard);
      return json_(portraits_());
    }

    if (op !== 'mutate') {
      return json_({ ok: false, code: 'UNKNOWN_OP', message: 'Unknown operation: ' + op });
    }

    var guard = checkWriteAccess_(body.pin);
    if (!guard.ok) return json_(guard);

    var ops = body.ops || [];
    if (!Array.isArray(ops) || !ops.length) {
      return json_({ ok: false, code: 'NO_OPS', message: 'No operations were sent.' });
    }

    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(25000);
    } catch (lockError) {
      return json_({ ok: false, code: 'BUSY', message: 'The sheet is busy, try again in a second.' });
    }

    try {
      var result = applyOps_(ops);
      return json_({
        ok: true,
        revision: bumpRevision_(),
        applied: result.applied,
        created: result.created,
        changed: true,
        serverTime: new Date().toISOString(),
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json_({
      ok: false,
      code: 'WRITE_FAILED',
      message: String(error && error.message || error),
    });
  }
}

function checkWriteAccess_(pin) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('READ_ONLY') === 'true') {
    return { ok: false, code: 'READ_ONLY', message: 'This deployment is read-only.' };
  }
  var required = props.getProperty('PIN');
  if (required && String(pin || '') !== required) {
    return {
      ok: false,
      code: required ? 'BAD_PIN' : 'NO_PIN',
      message: 'Wrong or missing PIN.',
    };
  }
  return { ok: true };
}

function health_() {
  var props = PropertiesService.getScriptProperties();
  var ss = ss_();
  return {
    ok: true,
    app: APP,
    version: APP_VERSION,
    revision: props.getProperty('revision') || '0',
    pinRequired: Boolean(props.getProperty('PIN')),
    readKeyRequired: Boolean(props.getProperty('READ_KEY')),
    readOnly: props.getProperty('READ_ONLY') === 'true',
    spreadsheet: ss ? ss.getName() : '',
    timezone: ss ? ss.getSpreadsheetTimeZone() : '',
    serverTime: new Date().toISOString(),
    tabs: Object.keys(TABS).filter(function (name) { return Boolean(ss.getSheetByName(name)); }),
  };
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function bumpRevision_() {
  var props = PropertiesService.getScriptProperties();
  var next = Number(props.getProperty('revision') || '0') + 1;
  props.setProperty('revision', String(next));
  return next;
}

/* ================================================================ snapshot */

var PORTRAIT_CHUNK_CHARS = 40000;
var PORTRAIT_MAX_PARTS = 24;

function portraitParts_(row) {
  var parts = [];
  for (var i = 0; i < PORTRAIT_MAX_PARTS; i++) {
    var column = i === 0 ? 'data' : 'data' + (i + 1);
    var value = row.obj[column];
    if (value) parts.push(String(value));
  }
  return parts;
}

function portraits_() {
  var db = openDb_();
  var rows = db.Portraits ? db.Portraits.rows : [];
  var items = rows
    .map(function (row) {
      var data = portraitParts_(row).join('');
      return {
        key: String(row.obj.key || ''),
        mime: String(row.obj.mime || 'image/webp'),
        data: data,
        updatedAt: String(row.obj.updatedAt || ''),
      };
    })
    .filter(function (item) {
      return item.key && item.data;
    });
  return { ok: true, items: items };
}

function snapshot_(sinceRevision) {
  var db = openDb_({ skipPortraits: true });
  var healed = heal_(db);
  var revision = PropertiesService.getScriptProperties().getProperty('revision') || '0';

  if (sinceRevision && String(sinceRevision) === String(revision) && !healed) {
    return { ok: true, unchanged: true, revision: revision, serverTime: new Date().toISOString() };
  }

  var data = {};
  Object.keys(TABS).forEach(function (name) {
    // Portraits are large; they are fetched on demand by op=portraits.
    if (name === 'Portraits') return;
    data[name.toLowerCase()] = db[name] ? db[name].rows.map(function (row) { return row.obj; }) : [];
  });

  return {
    ok: true,
    app: APP,
    version: APP_VERSION,
    revision: revision,
    serverTime: new Date().toISOString(),
    data: data,
  };
}

function openDb_(options) {
  var opts = options || {};
  var ss = ss_();
  var db = {};
  Object.keys(TABS).forEach(function (name) {
    if (opts.skipPortraits && name === 'Portraits') return;
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = createTab_(ss, name);
    var lastRow = sheet.getLastRow();
    var lastCol = Math.max(sheet.getLastColumn(), TABS[name].length);
    var values = sheet.getRange(1, 1, Math.max(lastRow, 1), lastCol).getValues();
    var headers = (values[0] || []).map(function (h) { return String(h).trim(); });
    // Trust the declared schema even if the header row was edited by hand.
    TABS[name].forEach(function (header, index) {
      if (!headers[index]) headers[index] = header;
    });
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var raw = values[i];
      var obj = {};
      var empty = true;
      headers.forEach(function (header, col) {
        if (!header) return;
        var value = raw[col];
        if (value !== '' && value !== null && value !== undefined) empty = false;
        obj[header] = value;
      });
      if (empty) continue;
      obj = coerce_(name, obj);
      rows.push({ row: i + 1, obj: obj, raw: raw });
    }
    db[name] = { sheet: sheet, headers: headers, rows: rows, byId: indexById_(name, rows) };
  });
  return db;
}

function createTab_(ss, name) {
  var sheet = ss.insertSheet(name);
  var headers = TABS[name];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function indexById_(name, rows) {
  var map = {};
  rows.forEach(function (row) {
    var usesKey = name === 'Config' || name === 'Portraits';
    var key = usesKey ? row.obj.key : row.obj.id;
    if (key !== undefined && key !== null && key !== '') map[String(key)] = row;
  });
  return map;
}

function coerce_(name, obj) {
  var nums = NUMERIC[name] || [];
  nums.forEach(function (field) {
    if (field in obj) obj[field] = toNumber_(obj[field]);
  });
  var bools = BOOLEAN[name] || [];
  bools.forEach(function (field) {
    if (field in obj) obj[field] = toBool_(obj[field]);
  });
  if ((name === 'Runs' || name === 'Ledger') && 'week' in obj) {
    obj.week = toWeekKey_(obj.week);
  }
  if ('id' in obj) obj.id = String(obj.id || '');
  return obj;
}

/** Sheets may store `2026-11-11` as a Date; normalise to a plain calendar day. */
function toWeekKey_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  var text = String(value === null || value === undefined ? '' : value).trim();
  if (text.length > 10 && text.charAt(10) === 'T') return text.slice(0, 10);
  return text;
}

function toNumber_(value) {
  if (typeof value === 'number') return value;
  var n = parseFloat(String(value === null || value === undefined ? '' : value).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toBool_(value) {
  if (typeof value === 'boolean') return value;
  var text = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'y' || text === 'x' || text === '✓';
}

/** Give every hand-typed row an id and timestamp so it becomes addressable. */
function heal_(db) {
  var changed = false;
  var names = Object.keys(TABS);
  for (var n = 0; n < names.length; n++) {
    var name = names[n];
    var table = db[name];
    if (!table) continue;
    for (var i = 0; i < table.rows.length; i++) {
      var row = table.rows[i];
      var needs = [];
      var usesKey = name === 'Config' || name === 'Portraits';
      if (!usesKey && !row.obj.id) {
        row.obj.id = 'auto_' + Utilities.getUuid().slice(0, 8);
        needs.push(['id', row.obj.id]);
      }
      if (usesKey && !row.obj.key) continue;
      if (TABS[name].indexOf('updatedAt') >= 0 && !row.obj.updatedAt) {
        row.obj.updatedAt = new Date().toISOString();
        needs.push(['updatedAt', row.obj.updatedAt]);
      }
      needs.forEach(function (pair) {
        var col = table.headers.indexOf(pair[0]);
        if (col >= 0) table.sheet.getRange(row.row, col + 1).setValue(pair[1]);
        changed = true;
      });
    }
    if (changed) table.byId = indexById_(name, table.rows);
  }
  if (changed) bumpRevision_();
  return changed;
}

/* ================================================================ mutation */

function applyOps_(ops) {
  var needsPortraits = ops.some(function (op) {
    return String(op && op.type || '').indexOf('portrait.') === 0;
  });
  var db = openDb_({ skipPortraits: !needsPortraits });
  var applied = 0;
  var created = [];

  for (var i = 0; i < ops.length; i++) {
    var op = ops[i] || {};
    switch (op.type) {
      case 'run.toggle':
        updateRow_(db, 'Runs', op.id, { cleared: !!op.cleared, updatedAt: now_() });
        break;
      case 'run.create':
        createRun_(db, op.run, created);
        break;
      case 'run.update':
        updateRow_(db, 'Runs', op.id, merge_(op.patch || {}, { updatedAt: now_() }));
        break;
      case 'run.delete':
        deleteRun_(db, op.id);
        break;
      case 'cell.set':
        setCell_(db, op, created);
        break;
      case 'cell.clear':
        clearCell_(db, op.runId, op.playerId);
        break;
      case 'character.upsert':
        upsertCharacter_(db, op.character, created);
        break;
      case 'character.delete':
        deleteCharacter_(db, op.id);
        break;
      case 'raid.upsert':
        upsertRaid_(db, op.raid, created);
        break;
      case 'raid.delete':
        deleteRaid_(db, op.id);
        break;
      case 'player.upsert':
        upsertPlayer_(db, op.player, created);
        break;
      case 'ledger.add':
        upsertRow_(db, 'Ledger', op.ledger, created);
        break;
      case 'ledger.delete':
        deleteRow_(db, 'Ledger', op.id);
        break;
      case 'portrait.upsert':
        upsertPortrait_(db, op.portrait);
        break;
      case 'portrait.delete':
        deletePortrait_(db, op.key);
        break;
      case 'replaceAll':
        replaceAll_(db, op.data || {});
        break;
      default:
        continue;
    }
    applied += 1;
  }

  return { applied: applied, created: created };
}

function now_() {
  return new Date().toISOString();
}

function merge_(patch, base) {
  var out = {};
  Object.keys(base || {}).forEach(function (key) { out[key] = base[key]; });
  Object.keys(patch || {}).forEach(function (key) { out[key] = patch[key]; });
  return out;
}

function headersOf_(db, name) {
  return db[name] ? db[name].headers : TABS[name];
}

function rowValues_(db, name, obj) {
  var headers = headersOf_(db, name);
  return headers.map(function (header) {
    var value = obj[header];
    if (value === undefined || value === null) return '';
    if (name === 'Raids' && (header === 'goldTradable' || header === 'goldBound' || header === 'ilvl')) return toNumber_(value);
    return value;
  });
}

function append_(db, name, obj) {
  var table = db[name];
  if (!table) throw new Error('Missing tab: ' + name);
  var headers = headersOf_(db, name);
  var values = rowValues_(db, name, obj);
  table.sheet.appendRow(values);
  var rowNumber = table.sheet.getLastRow();
  var row = { row: rowNumber, obj: coerce_(name, toObject_(headers, values)), raw: values };
  table.rows.push(row);
  var usesKey = name === 'Config' || name === 'Portraits';
  var key = usesKey ? row.obj.key : row.obj.id;
  if (key) table.byId[String(key)] = row;
  return row;
}

function toObject_(headers, values) {
  var obj = {};
  headers.forEach(function (header, i) {
    if (header) obj[header] = values[i];
  });
  return obj;
}

function updateRow_(db, name, id, patch) {
  var table = db[name];
  if (!table || !id) return null;
  var row = table.byId[String(id)];
  if (!row) return null;
  var headers = headersOf_(db, name);
  var changed = false;
  Object.keys(patch || {}).forEach(function (field) {
    var col = headers.indexOf(field);
    if (col < 0) return;
    row.obj[field] = patch[field];
    table.sheet.getRange(row.row, col + 1).setValue(patch[field] === undefined || patch[field] === null ? '' : patch[field]);
    changed = true;
  });
  if (changed) row.obj = coerce_(name, row.obj);
  return row;
}

function deleteRow_(db, name, id) {
  var table = db[name];
  if (!table || !id) return false;
  var row = table.byId[String(id)];
  if (!row) return false;
  table.sheet.deleteRow(row.row);
  // Re-index rows below the deleted one.
  table.rows = table.rows.filter(function (r) { return r.row !== row.row; });
  table.rows.forEach(function (r) { if (r.row > row.row) r.row -= 1; });
  delete table.byId[String(id)];
  table.rows.forEach(function (r) {
    var usesKey = name === 'Config' || name === 'Portraits';
    var key = usesKey ? r.obj.key : r.obj.id;
    if (key) table.byId[String(key)] = r;
  });
  return true;
}

function upsertRow_(db, name, obj, created) {
  if (!obj) return null;
  var headers = headersOf_(db, name);
  var clean = {};
  headers.forEach(function (header) {
    if (header in obj) clean[header] = obj[header];
  });
  if (!clean.id) clean.id = 'auto_' + Utilities.getUuid().slice(0, 8);
  if (headers.indexOf('updatedAt') >= 0 && !clean.updatedAt) clean.updatedAt = now_();

  var existing = db[name] && db[name].byId[String(clean.id)];
  if (existing) {
    updateRow_(db, name, clean.id, clean);
    return existing.obj;
  }
  var row = append_(db, name, clean);
  if (created) created.push({ tab: name, id: clean.id });
  return row.obj;
}

/* --------------------------------------------------------------- specific */

function createRun_(db, run, created) {
  if (!run || !run.id) return;
  if (db.Runs.byId[String(run.id)]) return;
  var record = {
    id: String(run.id),
    week: run.week || '',
    raidId: run.raidId || '',
    index: toNumber_(run.index),
    cleared: !!run.cleared,
    claims: run.claims === undefined ? 1 : toNumber_(run.claims),
    note: run.note || '',
    updatedAt: now_(),
  };
  append_(db, 'Runs', record);
  if (created) created.push({ tab: 'Runs', id: record.id });
}

function deleteRun_(db, runId) {
  if (!runId) return;
  deleteRow_(db, 'Runs', runId);
  db.Assignments.rows
    .filter(function (row) { return String(row.obj.runId) === String(runId); })
    .forEach(function (row) { deleteRow_(db, 'Assignments', row.obj.id); });
}

function findOrCreateCharacter_(db, playerId, characterId, name, created) {
  var table = db.Characters;
  if (characterId && table.byId[String(characterId)]) return table.byId[String(characterId)].obj;
  var clean = String(name || '').trim();
  if (!clean) return null;
  var existing = null;
  table.rows.forEach(function (row) {
    if (String(row.obj.playerId) === String(playerId) && String(row.obj.name).trim().toLowerCase() === clean.toLowerCase()) {
      existing = row.obj;
    }
  });
  if (existing) return existing;

  var record = {
    id: characterId || 'c_' + Utilities.getUuid().slice(0, 8),
    playerId: playerId,
    name: clean,
    className: '',
    ilvl: 0,
    goldEarner: true,
    active: true,
    notes: '',
    updatedAt: now_(),
  };
  append_(db, 'Characters', record);
  if (created) created.push({ tab: 'Characters', id: record.id });
  return record;
}

function setCell_(db, op, created) {
  var run = db.Runs.byId[String(op.runId)];
  if (!run) return;
  var character = findOrCreateCharacter_(db, op.playerId, op.characterId, op.name, created);
  var name = character ? character.name : String(op.name || '').trim();
  if (!name) return;

  var assignment = null;
  db.Assignments.rows.forEach(function (row) {
    if (String(row.obj.runId) === String(op.runId) && String(row.obj.playerId) === String(op.playerId)) assignment = row;
  });

  if (assignment) {
    updateRow_(db, 'Assignments', assignment.obj.id, {
      characterId: character ? character.id : '',
      name: name,
      updatedAt: now_(),
    });
  } else {
    var record = {
      id: 'a_' + Utilities.getUuid().slice(0, 8),
      runId: op.runId,
      playerId: op.playerId,
      characterId: character ? character.id : '',
      name: name,
      updatedAt: now_(),
    };
    append_(db, 'Assignments', record);
    if (created) created.push({ tab: 'Assignments', id: record.id });
  }
}

function clearCell_(db, runId, playerId) {
  var row = null;
  db.Assignments.rows.forEach(function (candidate) {
    if (String(candidate.obj.runId) === String(runId) && String(candidate.obj.playerId) === String(playerId)) row = candidate;
  });
  if (row) deleteRow_(db, 'Assignments', row.obj.id);
}

function upsertCharacter_(db, character, created) {
  if (!character) return;
  var clean = {
    id: character.id || 'c_' + Utilities.getUuid().slice(0, 8),
    playerId: character.playerId || '',
    name: String(character.name || '').trim(),
    className: character.className || '',
    ilvl: toNumber_(character.ilvl),
    goldEarner: character.goldEarner === undefined ? true : !!character.goldEarner,
    active: character.active === undefined ? true : !!character.active,
    notes: character.notes || '',
    updatedAt: now_(),
  };
  if (!clean.name) return;
  upsertRow_(db, 'Characters', clean, created);
}

function deleteCharacter_(db, id) {
  deleteRow_(db, 'Characters', id);
  db.Assignments.rows.forEach(function (row) {
    if (String(row.obj.characterId) === String(id)) {
      updateRow_(db, 'Assignments', row.obj.id, { characterId: '', updatedAt: now_() });
    }
  });
}

function upsertRaid_(db, raid, created) {
  if (!raid || !raid.id) return;
  upsertRow_(db, 'Raids', {
    id: raid.id,
    name: raid.name || 'Raid',
    short: raid.short || String(raid.name || 'RAID').toUpperCase(),
    difficulty: raid.difficulty || 'Normal',
    ilvl: toNumber_(raid.ilvl),
    goldTradable: toNumber_(raid.goldTradable),
    goldBound: toNumber_(raid.goldBound),
    partySize: raid.partySize || 8,
    order: toNumber_(raid.order),
    active: raid.active === undefined ? true : !!raid.active,
    note: raid.note || '',
  }, created);
}

function deleteRaid_(db, id) {
  var runIds = db.Runs.rows
    .filter(function (row) { return String(row.obj.raidId) === String(id); })
    .map(function (row) { return row.obj.id; });
  runIds.forEach(function (runId) { deleteRun_(db, runId); });
  deleteRow_(db, 'Raids', id);
}

function upsertPortrait_(db, portrait) {
  if (!portrait || !portrait.key) return;
  var data = String(portrait.data || '');
  if (!data) return;
  if (data.length > PORTRAIT_CHUNK_CHARS * PORTRAIT_MAX_PARTS) {
    throw new Error('Portrait is too large. Keep it under ~650 KB; no compression is applied.');
  }
  var mime = String(portrait.mime || 'image/webp');
  if (mime.indexOf('image/') !== 0) mime = 'image/webp';

  var record = { key: String(portrait.key), mime: mime, updatedAt: now_() };
  var parts = 0;
  for (var i = 0; i < PORTRAIT_MAX_PARTS; i++) {
    var column = i === 0 ? 'data' : 'data' + (i + 1);
    var chunk = data.slice(i * PORTRAIT_CHUNK_CHARS, (i + 1) * PORTRAIT_CHUNK_CHARS);
    record[column] = chunk;
    if (chunk) parts = i + 1;
  }
  record.chunks = parts;

  if (db.Portraits.byId[String(record.key)]) {
    updateRow_(db, 'Portraits', record.key, record);
  } else {
    append_(db, 'Portraits', record);
  }
}

function deletePortrait_(db, key) {
  if (!key) return;
  if (db.Portraits.byId[String(key)]) deleteRow_(db, 'Portraits', key);
}

function upsertPlayer_(db, player, created) {  if (!player || !player.id) return;
  upsertRow_(db, 'Players', {
    id: player.id,
    name: player.name || 'Player',
    tag: player.tag || String(player.name || 'P').slice(0, 3).toUpperCase(),
    color: player.color || '',
    order: toNumber_(player.order),
  }, created);
}

/* ------------------------------------------------------------- replaceAll */

function replaceAll_(db, data) {
  var ss = ss_();
  var collection = {
    Raids: data.raids || [],
    Players: data.players || [],
    Characters: data.characters || [],
    Runs: data.runs || [],
    Assignments: data.assignments || [],
    Ledger: data.ledger || [],
  };

  Object.keys(collection).forEach(function (name) {
    var table = db[name];
    if (!table) return;
    var headers = headersOf_(db, name);
    var rows = collection[name].map(function (obj) { return rowValues_(db, name, obj); });
    table.sheet.clearContents();
    table.sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (rows.length) table.sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    table.sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    table.sheet.setFrozenRows(1);
    table.rows = rows.map(function (values, i) {
      return { row: i + 2, obj: coerce_(name, toObject_(headers, values)), raw: values };
    });
    table.byId = indexById_(name, table.rows);
  });

  var config = ss.getSheetByName('Config');
  if (config) {
    writeConfig_(config, 'name', (data.config && data.config.name) || 'LOANDOM');
    writeConfig_(config, 'updatedAt', now_());
    writeConfig_(config, 'appVersion', APP_VERSION);
  }
  bumpRevision_();
}

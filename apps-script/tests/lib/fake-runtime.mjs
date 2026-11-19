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
  constructor(name) { this.name = name; this.cells = []; this.columns = 26; }
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
  getMaxColumns() { return Math.max(this.getLastColumn(), this.columns); }
  insertColumns(after, count) {
    this.cells.forEach((row) => {
      row.splice(after, 0, ...Array(count).fill(''));
    });
    this.columns = Math.max(this.columns, this.getLastColumn());
  }
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

/**
 * Builds a fake Apps Script host around the real Code.gs.
 * `sharing` flips how Drive answers setSharing:
 *   'ok'     — the file becomes anyone-with-the-link (default)
 *   'throw'  — Drive refuses the permission (Workspace policy)
 *   'silent' — setSharing returns but the file stays private
 */
export function createFakeRuntime({ sharing = 'ok' } = {}) {
  const ss = new Spreadsheet('LOANDOM');
  const props = new Map();
  const properties = {
    getProperty: (k) => (props.has(k) ? props.get(k) : null),
    setProperty: (k, v) => props.set(k, String(v)),
    deleteProperty: (k) => props.delete(k),
  };

  const driveFiles = new Map();
  let driveSeq = 0;
  const access = { anyone: 'ANYONE_WITH_LINK', private: 'PRIVATE' };

  const fileHandle = (id) => ({
    getId: () => id,
    getName: () => driveFiles.get(id).blob.name,
    getSharingAccess: () => driveFiles.get(id).sharing || access.private,
    setSharing: () => {
      if (sharing === 'throw') throw new Error('Link sharing is disabled for this domain.');
      driveFiles.get(id).sharing = sharing === 'silent' ? access.private : access.anyone;
    },
    setTrashed(value) {
      driveFiles.get(id).trashed = value;
    },
  });

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
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      base64Decode: (value) => Buffer.from(String(value || ''), 'base64'),
      newBlob: (bytes, mimeType, name) => ({ bytes, mimeType, name }),
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: access.anyone },
      Permission: { VIEW: 'VIEW' },
      createFile(blob) {
        driveSeq += 1;
        const id = `drv_${driveSeq}`;
        driveFiles.set(id, { blob, trashed: false, sharing: null });
        return fileHandle(id);
      },
      getFileById(id) {
        if (!driveFiles.has(id)) throw new Error(`missing drive file ${id}`);
        return fileHandle(id);
      },
    },
    Logger: { log: (...args) => console.log(...args) },
  };
  context.globalThis = context;

  const code = fs.readFileSync(new URL('../../Code.gs', import.meta.url), 'utf8');
  vm.createContext(context);
  vm.runInContext(code, context);

  const call = (name, ...args) => context[name](...args);
  const get = (params) => JSON.parse(call('doGet', { parameter: params }).text);
  const post = (body) => JSON.parse(call('doPost', { postData: { contents: JSON.stringify(body) } }).text);

  return { ss, props, driveFiles, sharing, call, get, post, setSharing: (mode) => { sharing = mode; } };
}

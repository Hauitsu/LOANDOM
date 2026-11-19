/* Backend checks for Code.gs against a fake Apps Script runtime.
   Run from anywhere: node apps-script/tests/run.mjs */

import fs from 'node:fs';
import { createFakeRuntime } from './lib/fake-runtime.mjs';

const { ss, call, get, post, driveFiles, setSharing } = createFakeRuntime();

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
check('all tabs exist', health.tabs.length === 8, JSON.stringify(health.tabs));

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

console.log('character portraits');
let pres = post({
  pin: '1234',
  op: 'mutate',
  ops: [{ type: 'portrait.upsert', portrait: { key: 'c1', mime: 'image/webp', data: 'AAAA' } }],
});
check('portrait upsert accepted', pres.ok === true && pres.applied === 1, JSON.stringify(pres));
let pitems = post({ op: 'portraits' });
check(
  'portrait list returns a Drive id',
  pitems.ok === true && pitems.items.length === 1 && pitems.items[0].key === 'c1' && pitems.items[0].driveId.indexOf('drv_') === 0,
);
const bigPortrait = 'B'.repeat(90000);
pres = post({
  pin: '1234',
  op: 'mutate',
  ops: [{ type: 'portrait.upsert', portrait: { key: 'c2', mime: 'image/webp', data: bigPortrait } }],
});
check('large portrait accepted (Drive, no compression)', pres.ok === true && pres.applied === 1, JSON.stringify(pres));
pitems = post({ op: 'portraits' });
check('second portrait stored', pitems.items.length === 2 && pitems.items.some((item) => item.key === 'c2'));
post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.delete', key: 'c2' }] });
let snap3 = get({ op: 'snapshot' });
check('snapshot excludes portraits', snap3.data.portraits === undefined);
call('setReadKey', 'k'.repeat(32));
let pguard = post({ op: 'portraits' });
check('portraits gated by read key', pguard.ok === false && pguard.code === 'BAD_KEY');
pitems = post({ op: 'portraits', key: 'k'.repeat(32) });
check('portraits readable with key', pitems.ok === true && pitems.items.length === 1);
call('clearReadKey');
let pdel = post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.delete', key: 'c1' }] });
check('portrait delete accepted', pdel.ok === true);
check('portrait gone', post({ op: 'portraits' }).items.length === 0);

console.log('portrait regressions');
const portraitSheet = ss.getSheetByName('Portraits');
// A tab created before Drive storage had no driveId column and silently dropped it.
portraitSheet.getRange(1, 3).setValue('data');
portraitSheet.getRange(2, 1, 1, 4).setValues([['c_old', 'image/png', 'AAAA', '2026-01-01T00:00:00.000Z']]);
let legacy = post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.upsert', portrait: { key: 'c_legacy', mime: 'image/png', data: 'AAAA' } }] });
check('legacy tab: portrait accepted', legacy.ok === true && legacy.applied === 1, JSON.stringify(legacy));
const legacyHeaders = portraitSheet.getRange(1, 1, 1, portraitSheet.getLastColumn()).getValues()[0];
check('legacy tab: driveId column added', legacyHeaders.indexOf('driveId') >= 0, JSON.stringify(legacyHeaders));
const legacyRow = portraitSheet.getRange(2, 1, 1, 5).getValues()[0];
check('legacy tab: existing row keeps its values', legacyRow[3] === '2026-01-01T00:00:00.000Z' && !legacyRow[4], JSON.stringify(legacyRow));
pitems = post({ op: 'portraits' });
const legacyItem = pitems.items.find((item) => item.key === 'c_legacy');
check('legacy tab: portrait listed with a Drive id', Boolean(legacyItem && legacyItem.driveId), JSON.stringify(pitems.items));
check('legacy tab: id-less rows stay hidden', pitems.items.every((item) => item.key !== 'c_old'), JSON.stringify(pitems.items));

const firstId = legacyItem && legacyItem.driveId;
let again = post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.upsert', portrait: { key: 'c_legacy', mime: 'image/png', data: 'BBBB' } }] });
pitems = post({ op: 'portraits' });
const replaced = pitems.items.filter((item) => item.key === 'c_legacy');
check('re-upload replaces the row', again.ok === true && replaced.length === 1 && replaced[0].driveId !== firstId, JSON.stringify(replaced));
check('re-upload trashes the previous Drive file', driveFiles.get(firstId).trashed === true);

setSharing('throw');
let blocked = post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.upsert', portrait: { key: 'c_private', mime: 'image/png', data: 'AAAA' } }] });
check('unshareable portrait reported, not saved', blocked.ok === false && blocked.code === 'PORTRAIT_SHARING', JSON.stringify(blocked));
check('unshareable portrait leaves no row', post({ op: 'portraits' }).items.every((item) => item.key !== 'c_private'));
const newestFile = Array.from(driveFiles.keys()).pop();
check('unshareable upload file is trashed', driveFiles.get(newestFile).trashed === true);

setSharing('silent');
blocked = post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.upsert', portrait: { key: 'c_private', mime: 'image/png', data: 'AAAA' } }] });
check('file left private is reported too', blocked.ok === false && blocked.code === 'PORTRAIT_SHARING', JSON.stringify(blocked));
setSharing('ok');

blocked = post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.upsert', portrait: { key: 'c_empty' } }] });
check('portrait without data is rejected', blocked.ok === false && blocked.code === 'BAD_PORTRAIT', JSON.stringify(blocked));

// MAX_BYTES in assets/js/image.js is 9 MiB; that must still fit the server cap.
const nineMib = 'B'.repeat(12582912);
let huge = post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.upsert', portrait: { key: 'c_max', mime: 'image/png', data: nineMib } }] });
check('largest accepted client image uploads', huge.ok === true && huge.applied === 1, JSON.stringify(huge).slice(0, 120));
let over = post({ pin: '1234', op: 'mutate', ops: [{ type: 'portrait.upsert', portrait: { key: 'c_over', mime: 'image/png', data: 'B'.repeat(12600001) } }] });
check('oversized portrait is rejected', over.ok === false && over.code === 'PORTRAIT_TOO_LARGE', JSON.stringify(over).slice(0, 120));

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

console.log('roster tooltip sizing');
const css = fs.readFileSync(new URL('../../assets/css/app.css', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../../assets/js/app.js', import.meta.url), 'utf8');
const rule = (selector) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\}`))?.[1] || '';
const charTip = rule('.char-tip');
const tipMedia = rule('.tip-media');
const tipImg = rule('.tip-media img');
check('tooltip width is bounded on desktop', /width:\s*min\(300px,\s*calc\(100vw\s*-\s*16px\)\)/.test(charTip), charTip);
check('tooltip portrait desktop bounds are 104x144', /--tip-portrait-w:\s*104px/.test(charTip) && /--tip-portrait-h:\s*144px/.test(charTip), charTip);
check('portrait frame consumes the bounded dimensions', /width:\s*var\(--tip-portrait-w\)/.test(tipMedia) && /height:\s*var\(--tip-portrait-h\)/.test(tipMedia), tipMedia);
check('portrait keeps the whole image with object-fit contain', /object-fit:\s*contain/.test(tipImg), tipImg);
const mobileStart = css.indexOf('@media (max-width: 480px)');
const mobileCss = mobileStart >= 0 ? css.slice(mobileStart, mobileStart + 400) : '';
check('narrow viewport shrinks portrait to 80x120', /--tip-portrait-w:\s*80px/.test(mobileCss) && /--tip-portrait-h:\s*120px/.test(mobileCss), mobileCss);
const showTipStart = appSource.indexOf('function showCharTip');
const showTip = showTipStart >= 0 ? appSource.slice(showTipStart, appSource.indexOf("document.addEventListener('mouseover'", showTipStart)) : '';
check('tooltip reuses the original portrait source', /const pic = portraitFor\(character\)/.test(showTip) && /<img src="\$\{attr\(pic\)\}"/.test(showTip), showTip.slice(0, 240));
check('tooltip does not size from natural image dimensions', !/sizePortrait/.test(showTip), showTip.slice(0, 240));

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall backend checks passed');
process.exit(failures ? 1 : 0);

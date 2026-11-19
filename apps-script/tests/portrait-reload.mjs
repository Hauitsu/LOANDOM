/* End-to-end portrait persistence: paste -> save -> reopen -> reload.

   Boots the real assets/js modules in a fresh vm module graph per "page load",
   against the real Code.gs running on the fake Apps Script runtime. Run with:
     node --experimental-vm-modules apps-script/tests/portrait-reload.mjs */

import vm from 'node:vm';
import { createFakeRuntime } from './lib/fake-runtime.mjs';
import { createClientHost, createStorage } from './lib/client-host.mjs';

if (!vm.SourceTextModule) {
  console.error('This test needs: node --experimental-vm-modules apps-script/tests/portrait-reload.mjs');
  process.exit(1);
}

const ENDPOINT = 'https://script.google.com/macros/s/AKfyfake/exec';
const PNG_A = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_B = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_C = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z1APAAX/AgH4k5nKAAAAAElFTkSuQmCC';

const backend = createFakeRuntime();
backend.call('setup');
backend.call('setPin', '1234');

const settings = JSON.stringify({ endpoint: ENDPOINT, pin: '1234', readKey: '' });

let failures = 0;
const check = (label, condition, extra = '') => {
  if (!condition) {
    failures += 1;
    console.log('  FAIL', label, extra);
  } else {
    console.log('  ok  ', label);
  }
};

function newBrowser() {
  const storage = createStorage();
  storage.setItem('loandom.settings.v1', settings);
  return createClientHost({ backend, storage });
}

async function load(host) {
  const page = await host.boot();
  await page.store.init();
  await page.store.refreshPortraits();
  return page;
}

const uploads = () => backend.post({ op: 'portraits' }).items;

console.log('paste, save, reopen');
const browser = newBrowser();
let page = await load(browser);
check('connected to the fake sheet', page.store.state.status === 'remote', page.store.state.status);

const character = page.store.addCharacter('p_ois', 'Cafra');
check('character added to the roster', Boolean(character && character.id));

const saved = await page.store.savePortrait(character, PNG_A);
check('portrait uploaded to Drive', saved.saved === true && saved.uploaded === true, JSON.stringify(saved));

const remoteRow = uploads().find((item) => item.key === character.id);
check('sheet row keeps the Drive id', Boolean(remoteRow && remoteRow.driveId), JSON.stringify(uploads()));

check('reopened settings render the saved bytes', page.portraits.portraitFor(character) === PNG_A, String(page.portraits.portraitFor(character)).slice(0, 60));

const written = await page.store.updateCharacter(character.id, { className: 'Gunslinger' });
check('character Save reaches the sheet', written === true, String(written));

console.log('reload in the same browser');
const reloaded = await load(browser);
const afterReload = reloaded.store.state.data.characters.find((c) => c.id === character.id);
check('character edit survived the reload', afterReload && afterReload.className === 'Gunslinger', JSON.stringify(afterReload));
check(
  'portrait still renders after the reload',
  reloaded.portraits.portraitFor(afterReload) === PNG_A,
  String(reloaded.portraits.portraitFor(afterReload)).slice(0, 60),
);

console.log('reload on a device without the local copy');
const other = createClientHost({ backend, storage: createStorage() });
other.storage.setItem('loandom.settings.v1', settings);
const elsewhere = await load(other);
const remoteCharacter = elsewhere.store.state.data.characters.find((c) => c.id === character.id);
const driveUrl = elsewhere.portraits.portraitFor(remoteCharacter);
check('Drive remains the cross-device copy', driveUrl.includes(remoteRow.driveId), driveUrl.slice(0, 80));

console.log('Drive refuses to share the file');
backend.setSharing('throw');
const secondBrowser = newBrowser();
const second = await load(secondBrowser);
const secondCharacter = second.store.addCharacter('p_ryn', 'Ryn');
check('second character added', Boolean(secondCharacter && secondCharacter.id));
const blocked = await second.store.savePortrait(secondCharacter, PNG_B);
check('sharing failure is reported, not hidden', blocked.saved === true && blocked.uploaded === false, JSON.stringify({ saved: blocked.saved, uploaded: blocked.uploaded }));
check('portrait stays usable from the device copy', second.portraits.portraitFor(secondCharacter) === PNG_B);
check('no unreadable row was written', uploads().every((item) => item.key !== secondCharacter.id));

const third = await load(secondBrowser);
const thirdCharacter = third.store.state.data.characters.find((c) => c.id === secondCharacter.id);
check('unshared portrait survives a reload', third.portraits.portraitFor(thirdCharacter) === PNG_B, String(third.portraits.portraitFor(thirdCharacter)).slice(0, 60));

console.log('browser storage is full');
backend.setSharing('ok');
const tightBrowser = createClientHost({ backend, storage: createStorage(800) });
tightBrowser.storage.setItem('loandom.settings.v1', settings);
const tight = await load(tightBrowser);
const tightCharacter = tight.store.addCharacter('p_dp', 'Dp');
check('third character added', Boolean(tightCharacter && tightCharacter.id));
const big = `data:image/png;base64,${'A'.repeat(2000)}`;
const tightResult = await tight.store.savePortrait(tightCharacter, big);
check('large paste still reaches Drive', tightResult.saved === true && tightResult.uploaded === true, JSON.stringify({ saved: tightResult.saved, uploaded: tightResult.uploaded }));
check('missing device copy is reported', tightResult.localCopy === false, String(tightResult.localCopy));
check('portrait renders while the tab is open', tight.portraits.portraitFor(tightCharacter) === big);

const tightReload = await load(tightBrowser);
const tightAgain = tightReload.store.state.data.characters.find((c) => c.id === tightCharacter.id);
const tightDrive = tightReload.portraits.portraitFor(tightAgain);
const tightRow = uploads().find((item) => item.key === tightCharacter.id);
check(
  'after reload the Drive copy is used',
  Boolean(tightRow && tightDrive.includes(tightRow.driveId)),
  tightDrive.slice(0, 80),
);

console.log('another device replaces the portrait');
const otherBrowser = newBrowser();
const otherPage = await load(otherBrowser);
const otherCharacter = otherPage.store.state.data.characters.find((c) => c.id === character.id);
const replacedResult = await otherPage.store.savePortrait(otherCharacter, PNG_C);
check('second device uploaded a new file', replacedResult.saved === true && replacedResult.uploaded === true, JSON.stringify({ saved: replacedResult.saved, uploaded: replacedResult.uploaded }));
const newerRow = uploads().find((item) => item.key === character.id);
check('sheet points at the newer file', Boolean(newerRow && newerRow.driveId !== remoteRow.driveId), JSON.stringify(newerRow));

const backAgain = await load(browser);
const backCharacter = backAgain.store.state.data.characters.find((c) => c.id === character.id);
const backUrl = backAgain.portraits.portraitFor(backCharacter);
check('first device follows the newer Drive file', backUrl.includes(newerRow.driveId), backUrl.slice(0, 80));
const stored = JSON.parse(browser.storage.getItem('loandom.portraits.v1') || '{}');
check('stale device copy is dropped', !stored[character.id], JSON.stringify(Object.keys(stored)));

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall portrait persistence checks passed');
process.exit(failures ? 1 : 0);

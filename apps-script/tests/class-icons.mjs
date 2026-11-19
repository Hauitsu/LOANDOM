/* Class emblem, registry and picker checks.
   Run with:
     node --experimental-vm-modules apps-script/tests/class-icons.mjs */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

if (!vm.SourceTextModule) {
  console.error('This test needs: node --experimental-vm-modules apps-script/tests/class-icons.mjs');
  process.exit(1);
}

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let failures = 0;
const check = (label, condition, extra = '') => {
  if (!condition) {
    failures += 1;
    console.log('  FAIL', label, extra);
  } else {
    console.log('  ok  ', label);
  }
};

const context = vm.createContext({ console });
const registry = new Map();
async function load(rel) {
  const file = path.join(ROOT, rel);
  const id = new URL(`file:///${file.replace(/\\/g, '/')}`).href;
  if (registry.has(id)) return registry.get(id);
  const source = fs.readFileSync(file, 'utf8');
  const module = new vm.SourceTextModule(source, { context, identifier: id });
  registry.set(id, module);
  await module.link((specifier, referencing) => {
    if (!specifier.startsWith('.')) throw new Error(`Bare import: ${specifier}`);
    return load(fileURLToPath(new URL(specifier, referencing.identifier)).slice(ROOT.length));
  });
  return module;
}
async function evaluate(rel) {
  const module = await load(rel);
  await module.evaluate();
  return module.namespace;
}

const classes = await evaluate('assets/js/classes.js');
const badges = await evaluate('assets/js/classbadge.js');
const pickers = await evaluate('assets/js/classpicker.js');

const { CLASSES, CLASS_GROUPS, classInfo } = classes;
const { classBadge } = badges;
const { classPicker } = pickers;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/classes/manifest.json'), 'utf8'));

console.log('canonical registry');
check('exactly 30 canonical classes', CLASSES.length === 30, String(CLASSES.length));
check('seven families', CLASS_GROUPS.length === 7, CLASS_GROUPS.map((g) => g.name).join(','));
check('unique display names', new Set(CLASSES.map((c) => c.name)).size === 30);
check('unique short codes', new Set(CLASSES.map((c) => c.short)).size === 30);
check('Breaker is Martial Artist', classInfo('Breaker')?.group === 'Martial Artist', classInfo('Breaker')?.group);
check('Machinist is canonical once', CLASSES.filter((c) => c.name === 'Machinist').length === 1);
check('Scouter is not a separate option', !CLASSES.some((c) => c.name === 'Scouter'));
check('Guardianknight uses official one-word name', classInfo('Guardianknight')?.name === 'Guardianknight');
check('Dimensionalist is the 30th class', classInfo('Dimensionalist')?.group === 'Specialist');

console.log('legacy aliases');
const aliases = [
  ['Scouter', 'Machinist'], ['SC', 'Machinist'], ['Warlord', 'Gunlancer'],
  ['Holy Knight', 'Paladin'], ['Battlemaster', 'Wardancer'], ['Infighter', 'Scrapper'],
  ['Soul Master', 'Soulfist'], ['Lance Master', 'Glaivier'], ['Devil Hunter', 'Deadeye'],
  ['Blaster', 'Artillerist'], ['Hawkeye', 'Sharpshooter'], ['Elemental Master', 'Sorceress'],
  ['Arcana', 'Arcanist'], ['Demonic', 'Shadowhunter'], ['Blade', 'Deathblade'],
  ['Guardian Knight', 'Guardianknight'], ['GuardianKnight', 'Guardianknight'],
  ['Dimension Master', 'Dimensionalist'], ['Soul Eater', 'Souleater'],
  ['스카우터', 'Machinist'], ['차원술사', 'Dimensionalist'],
];
aliases.forEach(([alias, expected]) => {
  check(`alias ${alias} -> ${expected}`, classInfo(alias)?.name === expected, classInfo(alias)?.name);
});
check('soft hyphen does not break a class name', classInfo('Guardian\u00adknight')?.name === 'Guardianknight');
check('unknown class stays unknown', classInfo('Homebrew') === null);

console.log('local emblem coverage');
const iconFiles = fs.readdirSync(path.join(ROOT, 'assets/classes')).filter((f) => f.endsWith('.svg')).sort();
check('30 bundled SVG files', iconFiles.length === 30, String(iconFiles.length));
check('manifest lists 30 icons', manifest.classes.length === 30, String(manifest.classes.length));
check('manifest records the licence caveat', /No license claimed/.test(manifest.license.artworkLicense));
check('manifest has GLOBAL evidence', manifest.globalEvidence.some((url) => url.includes('dimensions-unbound')));

const unsafe = [];
const missing = [];
CLASSES.forEach((entry) => {
  const file = path.join(ROOT, entry.icon);
  if (!fs.existsSync(file)) {
    missing.push(entry.name);
    return;
  }
  const svg = fs.readFileSync(file, 'utf8');
  const issues = [];
  if (!/^\s*<svg[\s>]/i.test(svg)) issues.push('root');
  if (!/viewBox="([^"]+)"/i.test(svg)) issues.push('viewBox');
  if (/<script\b|<foreignObject\b|<style\b|<image\b|\son[a-z]+\s*=|\b(?:xlink:)?href\s*=|url\s*\(|<!ENTITY|<!DOCTYPE/i.test(svg)) issues.push('active-content');
  const tags = new Set([...svg.matchAll(/<([a-zA-Z][\w:-]*)\b/g)].map((m) => m[1].toLowerCase()));
  if ([...tags].some((tag) => tag !== 'svg' && tag !== 'path')) issues.push(`tags:${[...tags].join(',')}`);
  if (issues.length) unsafe.push(`${entry.name}:${issues.join('+')}`);

  const row = manifest.classes.find((c) => c.name === entry.name);
  if (!row) {
    unsafe.push(`${entry.name}:missing-manifest`);
    return;
  }
  const bytes = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (row.file !== path.basename(entry.icon)) unsafe.push(`${entry.name}:filename`);
  if (row.group !== entry.group) unsafe.push(`${entry.name}:group`);
  if (row.sha256 !== hash) unsafe.push(`${entry.name}:hash`);
  if (row.bytes !== bytes.length) unsafe.push(`${entry.name}:bytes`);
  if (!row.url.endsWith(`/${row.sourceFile}`)) unsafe.push(`${entry.name}:url`);
  const [w, h] = String(row.viewBox).split(/\s+/).slice(2).map(Number);
  if (!w || w !== h) unsafe.push(`${entry.name}:square-viewBox`);
});
check('every registry icon exists', missing.length === 0, missing.join(','));
check('every SVG is safe, path-only and hash-verified', unsafe.length === 0, unsafe.join(';'));
check('all icon paths are local', CLASSES.every((c) => c.icon.startsWith('assets/classes/') && !c.icon.includes('://')));

console.log('badge rendering');
const machinist = classBadge('Machinist', 22);
check('known class uses the local glyph', machinist.includes('assets/classes/machinist.svg') && machinist.includes('class-logo-glyph'));
check('badge keeps the requested pixel size', machinist.includes('width:22px;height:22px'));
check('alias renders the canonical badge', classBadge('SC', 22).includes('assets/classes/machinist.svg'));
check('badge exposes an accessible name', machinist.includes('aria-label="Machinist"') && machinist.includes('role="img"'));
check('small badge size is preserved', classBadge('Berserker', 14).includes('width:14px;height:14px'));
const custom = classBadge('Homebrew', 18);
check('unknown class gets the crest fallback', custom.includes('class-logo-crest') && custom.includes('is-fallback'));
check('unknown class requests no emblem', !custom.includes('assets/classes/'));
check('empty class still has a label', classBadge('', 18).includes('aria-label="Class not set"'));

console.log('picker markup');
const picker = classPicker('SC');
check('picker renders all 30 canonical choices', (picker.match(/name="classChoice"/g) || []).length === 30);
check('picker has no Scouter duplicate', !picker.includes('value="Scouter"'));
check('legacy alias preselects Machinist', /value="Machinist" checked/.test(picker));
check('picker preserves the stored alias text', picker.includes('name="className" value="SC"'));
check('picker groups are labelled', CLASS_GROUPS.every((g) => picker.includes(`>${g.name}</span>`)));
check('picker uses bundled glyphs', picker.includes('assets/classes/machinist.svg'));
check('picker has no inline event handlers', !/\son[a-z]+\s*=/i.test(picker));
const unknownPicker = classPicker('Homebrew');
check('custom class leaves all radios unselected', !/name="classChoice"[^>]*checked/.test(unknownPicker));
check('custom class is kept in the text field', unknownPicker.includes('name="className" value="Homebrew"'));

console.log('picker selection wiring');
const fakeInput = {
  value: 'SC',
  handlers: {},
  addEventListener(type, fn) { this.handlers[type] = fn; },
};
const fakeRadios = CLASSES.map((entry) => {
  const choice = { selected: false, classList: { toggle(_name, on) { choice.selected = on; } } };
  const radio = {
    value: entry.name,
    checked: false,
    handlers: {},
    closest: () => choice,
    addEventListener(type, fn) { radio.handlers[type] = fn; },
    choice,
  };
  return radio;
});
const fakePicker = {
  querySelector(selector) {
    if (selector === 'input[name="className"]') return fakeInput;
    return null;
  },
  querySelectorAll: () => fakeRadios,
};
const fakeContainer = { querySelector: (selector) => (selector === '[data-class-picker]' ? fakePicker : null) };
pickers.wireClassPicker(fakeContainer);
const machinistRadio = fakeRadios.find((r) => r.value === 'Machinist');
check('reopen selects the canonical alias radio', machinistRadio.checked && machinistRadio.choice.selected);
check('reopen leaves the stored alias text untouched', fakeInput.value === 'SC');
machinistRadio.checked = true;
machinistRadio.handlers.change();
check('choosing a class writes its canonical name', fakeInput.value === 'Machinist');
fakeInput.value = 'Homebrew';
fakeInput.handlers.input();
check('custom text clears the radio selection', fakeRadios.every((r) => !r.checked && !r.choice.selected));
fakeInput.value = 'SC';
fakeInput.handlers.input();
check('typing an alias selects its class again', machinistRadio.checked && machinistRadio.choice.selected);


console.log('integration points');
const app = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
check('settings modal mounts the picker', app.includes('${classPicker(character.className)}') && app.includes('wireClassPicker(modal)'));
check('Save writes the existing className field', app.includes("className: String(data.get('className')).trim()"));
check('roster, board, popover and tooltip use classBadge', ['views/roster.js', 'views/board.js', 'ui.js'].every((rel) => fs.readFileSync(path.join(ROOT, 'assets/js', rel), 'utf8').includes('classBadge')));
check('no classIcon schema was added', !['apps-script/Code.gs', 'assets/js/store.js', 'assets/js/model.js'].some((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').includes('classIcon')));

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall class icon checks passed');
process.exit(failures ? 1 : 0);

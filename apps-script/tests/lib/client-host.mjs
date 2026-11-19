/* Loads the real browser modules (assets/js/*.js) in a Node vm context.
   Each boot() creates a brand-new module graph, so module-level state such as
   the portrait cache is empty — the same thing a page reload does. */

import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export function createStorage(limit = Infinity) {
  const map = new Map();
  const size = () => {
    let total = 0;
    map.forEach((value, key) => {
      total += key.length + value.length;
    });
    return total;
  };
  return {
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem(key, value) {
      const id = String(key);
      const text = String(value);
      const previous = map.has(id) ? id.length + map.get(id).length : 0;
      if (size() - previous + id.length + text.length > limit) {
        const error = new Error('The quota has been exceeded.');
        error.name = 'QuotaExceededError';
        throw error;
      }
      map.set(id, text);
    },
    removeItem: (key) => map.delete(String(key)),
    clear: () => map.clear(),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
    dump: () => Object.fromEntries(map),
  };
}

export function createClientHost({ backend, storage, session = createStorage(), log = [] }) {
  if (!vm.SourceTextModule) {
    throw new Error('Run with: node --experimental-vm-modules apps-script/tests/portrait-reload.mjs');
  }

  const sandbox = {};
  Object.getOwnPropertyNames(globalThis).forEach((key) => {
    try {
      sandbox[key] = globalThis[key];
    } catch {
      /* some globals are getters that throw outside their realm */
    }
  });

  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    let raw;
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      log.push(body.op || 'mutate');
      raw = backend.call('doPost', { postData: { contents: JSON.stringify(body) } }).text;
    } else {
      log.push(url.searchParams.get('op') || 'snapshot');
      raw = backend.call('doGet', { parameter: Object.fromEntries(url.searchParams) }).text;
    }
    return { ok: true, status: 200, text: async () => raw };
  };

  Object.assign(sandbox, {
    console,
    fetch,
    localStorage: storage,
    sessionStorage: session,
    document: {
      addEventListener() {},
      removeEventListener() {},
      visibilityState: 'visible',
      querySelector: () => null,
      createElement: () => ({ style: {} }),
      body: { dataset: {} },
    },
    window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 800 },
    navigator: { onLine: true, clipboard: null },
    location: { origin: 'http://127.0.0.1:8137', pathname: '/index.html', hash: '', search: '' },
    history: { replaceState() {} },
    setInterval: () => 0,
    clearInterval: () => {},
  });

  const context = vm.createContext(sandbox);

  function fileOf(entry) {
    return entry.startsWith('assets/') ? `${ROOT}${entry}` : entry;
  }

  async function boot() {
    const registry = new Map();
    const evaluating = new Map();

    async function loadModule(file) {
      const id = pathToFileURL(file).href;
      if (registry.has(id)) return registry.get(id);
      const source = fs.readFileSync(file, 'utf8');
      const module = new vm.SourceTextModule(source, { context, identifier: id });
      registry.set(id, module);
      await module.link(async (specifier, referencing) => {
        if (!specifier.startsWith('.')) throw new Error(`Bare import is not supported: ${specifier}`);
        return loadModule(fileURLToPath(new URL(specifier, referencing.identifier)));
      });
      return module;
    }

    async function evaluate(entry) {
      const module = await loadModule(fileOf(entry));
      if (!evaluating.has(module)) evaluating.set(module, module.evaluate());
      await evaluating.get(module);
      return module.namespace;
    }

    const store = await evaluate('assets/js/store.js');
    const portraits = await evaluate('assets/js/portraits.js');
    return { store, portraits, evaluate };
  }

  return { boot, storage, session, log, sandbox };
}

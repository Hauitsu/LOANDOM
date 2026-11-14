/* Transport layer.
 *
 * remote: Google Apps Script Web App (the "serverless backend" — no VPS, no
 *         domain, no build pipeline). Deployed with access = Anyone, so it is
 *         callable straight from GitHub Pages.
 * local:  localStorage, used for the demo and when the sheet is not connected.
 */

export class ApiError extends Error {
  constructor(message, code = 'API_ERROR', detail = '') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.detail = detail;
  }
}

async function parseJson(response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    const hint = raw.includes('<!DOCTYPE') || raw.includes('<html')
      ? 'The endpoint returned an HTML page. Re-deploy the Apps Script (Deploy > Manage deployments) with "Execute as: Me" and "Who has access: Anyone".'
      : raw.slice(0, 200);
    throw new ApiError('Unexpected response from the sheet endpoint.', 'BAD_RESPONSE', hint);
  }
}

export function createRemote(endpoint) {
  const url = String(endpoint || '').trim();
  if (!/^https:\/\/script\.google\.com\//.test(url) || !/\/exec(\?|$)/.test(url)) {
    throw new ApiError(
      'That does not look like an Apps Script Web App URL. It should end with /exec.',
      'BAD_ENDPOINT',
      url,
    );
  }

  return {
    mode: 'remote',
    endpoint: url,

    /** Full snapshot, or a cheap "unchanged" answer when the revision matches. */
    async load(sinceRevision, readKey) {
      if (readKey) {
        // POST keeps the read key out of URLs, history and server access logs.
        const response = await fetch(url, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ op: 'snapshot', key: readKey, rev: sinceRevision || undefined }),
        });
        if (!response.ok) {
          throw new ApiError(`Sheet endpoint answered HTTP ${response.status}.`, 'HTTP', String(response.status));
        }
        const json = await parseJson(response);
        if (json.ok === false) {
          if (json.code === 'BAD_KEY') {
            throw new ApiError(
              'Wrong read key — paste the same string you set with setReadKey() in Apps Script.',
              'BAD_KEY',
            );
          }
          if (json.code === 'UNKNOWN_OP') {
            throw new ApiError(
              'This deployment does not support read keys yet. Update Code.gs, deploy a new version, then reconnect.',
              'OLD_BACKEND',
            );
          }
          throw new ApiError(json.message || 'The sheet endpoint refused the request.', json.code || 'REMOTE');
        }
        return json;
      }

      const target = new URL(url);
      target.searchParams.set('op', 'snapshot');
      if (sinceRevision) target.searchParams.set('rev', String(sinceRevision));
      target.searchParams.set('_', String(Date.now()));

      const response = await fetch(target.toString(), { redirect: 'follow', cache: 'no-store' });
      if (!response.ok) {
        throw new ApiError(`Sheet endpoint answered HTTP ${response.status}.`, 'HTTP', String(response.status));
      }
      const json = await parseJson(response);
      if (json.ok === false) {
        if (json.code === 'BAD_KEY') {
          throw new ApiError(
            'This sheet is protected by a read key. Add it in Settings → Google Sheet → Read key.',
            'BAD_KEY',
          );
        }
        throw new ApiError(json.message || 'The sheet endpoint refused the request.', json.code || 'REMOTE');
      }
      return json;
    },

    /** Send a batch of mutations. text/plain avoids the CORS preflight. */
    async send(pin, ops) {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ op: 'mutate', pin, ops }),
      });
      if (!response.ok) {
        throw new ApiError(`Sheet endpoint answered HTTP ${response.status}.`, 'HTTP', String(response.status));
      }
      const json = await parseJson(response);
      if (json.ok === false) {
        const code = json.code || 'REMOTE';
        const messages = {
          BAD_PIN: 'Wrong PIN — open Settings and check the PIN you set in Apps Script.',
          NO_PIN: 'This sheet endpoint requires a PIN. Add it in Settings.',
          READ_ONLY: 'The sheet endpoint is read-only.',
        };
        throw new ApiError(messages[code] || json.message || 'The sheet rejected the change.', code);
      }
      return json;
    },

    async health() {
      const target = new URL(url);
      target.searchParams.set('op', 'health');
      target.searchParams.set('_', String(Date.now()));
      const response = await fetch(target.toString(), { redirect: 'follow', cache: 'no-store' });
      return parseJson(response);
    },

    /** Portrait rows (base64) for this sheet. */
    async portraits(readKey) {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ op: 'portraits', key: readKey || '' }),
      });
      if (!response.ok) {
        throw new ApiError(`Sheet endpoint answered HTTP ${response.status}.`, 'HTTP', String(response.status));
      }
      const json = await parseJson(response);
      if (json.ok === false) {
        if (json.code === 'UNKNOWN_OP') {
          throw new ApiError('This deployment does not store portraits yet.', 'OLD_BACKEND');
        }
        if (json.code === 'BAD_KEY') {
          throw new ApiError('Wrong read key.', 'BAD_KEY');
        }
        throw new ApiError(json.message || 'The sheet refused the request.', json.code || 'REMOTE');
      }
      return json.items || [];
    },
  };
}

export function createLocal(storageKey) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || 'null');
    } catch {
      return null;
    }
  };

  return {
    mode: 'local',
    storageKey,

    async load(sinceRevision) {
      const stored = read();
      if (!stored) {
        return { ok: true, revision: '0', empty: true };
      }
      if (sinceRevision && String(stored.revision) === String(sinceRevision)) {
        return { ok: true, unchanged: true, revision: stored.revision };
      }
      return { ok: true, revision: String(stored.revision || 0), data: stored.data, serverTime: stored.at };
    },

    async save(data) {
      const revision = String(Date.now());
      localStorage.setItem(
        storageKey,
        JSON.stringify({ revision, at: new Date().toISOString(), data }),
      );
      return revision;
    },

    async send() {
      return { ok: true };
    },
  };
}

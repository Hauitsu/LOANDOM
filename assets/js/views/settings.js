/* Settings: connect the sheet, tune the gold rules, edit payouts and move data. */

import { esc, attr, fmt, num, ago, weekLabel } from '../util.js';
import { ico } from '../icons.js';

function connectionPanel(state) {
  const connected = state.status === 'remote';
  const sync = state.sync;
  const statusText = connected
    ? sync.state === 'error'
      ? 'Connected · sync error'
      : sync.state === 'saving'
        ? 'Saving…'
        : 'Connected'
    : 'Demo mode';

  return `
    <section class="panel" id="connection">
      <header class="panel-head">
        <h2>${ico('link', 16)} Google Sheet</h2>
        <span class="pill ${connected ? (sync.state === 'error' ? 'is-error' : 'is-on') : 'is-demo'}">
          <span class="pill-dot"></span>${statusText}
        </span>
      </header>

      <form class="form-grid" data-form="connect" autocomplete="off">
        <label class="field span2">
          <span>Apps Script Web App URL</span>
          <input name="endpoint" value="${attr(state.settings.endpoint)}" placeholder="https://script.google.com/macros/s/AKfy…/exec" spellcheck="false" />
          <small>Deploy the script in <code>apps-script/Code.gs</code> as a Web App: execute as <em>Me</em>, access <em>Anyone</em>.</small>
        </label>
        <label class="field">
          <span>PIN</span>
          <input name="pin" type="password" value="${attr(state.settings.pin)}" placeholder="optional, set inside Apps Script" spellcheck="false" />
          <small>Required for writes if you set a PIN in the script.</small>
        </label>
        <div class="field field-actions">
          <button class="btn primary" type="submit">${connected ? ico('refresh', 15) + ' Reconnect' : ico('link', 15) + ' Connect'}</button>
          ${connected ? `<button class="btn ghost" type="button" data-act="pull">${ico('download', 14)} Pull</button>` : ''}
          ${connected ? `<button class="btn ghost danger-text" type="button" data-act="disconnect">${ico('logout', 14)} Disconnect</button>` : ''}
        </div>
      </form>

      <details class="details">
        <summary>${ico('info', 13)} First-time setup (5 minutes, no server needed)</summary>
        <ol class="steps">
          <li>Create a Google Sheet. Open <strong>Extensions → Apps Script</strong>.</li>
          <li>Paste <code>apps-script/Code.gs</code> and <code>apps-script/appsscript.json</code> from this repo (the manifest goes in <em>Project Settings</em>).</li>
          <li>Run <code>setup()</code> once and approve the permissions. It creates the tabs.</li>
          <li>Optional: run <code>setPin('1234')</code> so only people with the PIN can write.</li>
          <li><strong>Deploy → New deployment → Web app</strong>: execute as <em>Me</em>, access <em>Anyone</em>. Copy the <code>/exec</code> URL here.</li>
          <li>Click <strong>Push data to sheet</strong> below to seed it with what you see now, then edit from either side.</li>
        </ol>
        <p class="muted">Full walkthrough: <code>SETUP.md</code> in the repository.</p>
      </details>
    </section>`;
}

function syncPanel(state) {
  const sync = state.sync;
  const local = state.status !== 'remote';
  return `
    <section class="panel">
      <header class="panel-head">
        <h2>${ico('refresh', 16)} Sync & counting</h2>
        <span class="muted">${state.status === 'remote' ? 'auto every 20s' : 'local only'}</span>
      </header>

      <div class="kv-grid">
        <div class="kv"><span>${local ? 'Store' : 'Sheet revision'}</span><strong>${local ? 'local' : esc(sync.revision || '—')}</strong></div>
        <div class="kv"><span>${local ? 'Last saved' : 'Last sync'}</span><strong>${esc(ago(sync.at))}</strong></div>
        <div class="kv"><span>Queued changes</span><strong>${sync.pending || 0}</strong></div>
        <div class="kv"><span>Storage</span><strong>${state.status === 'remote' ? 'Google Sheet' : 'This browser'}</strong></div>
      </div>

      ${sync.state === 'error' ? `<div class="inline-error">${ico('warning', 14)} ${esc(sync.error || 'Sync failed')}</div>` : ''}

      <div class="row-actions-line">
        <button class="btn ghost" data-act="sync-now">${ico('refresh', 14)} Sync now</button>
        ${sync.pending ? `<button class="btn ghost" data-act="retry">${ico('upload', 14)} Retry ${sync.pending} change${sync.pending === 1 ? '' : 's'}</button>` : ''}
      </div>

      <div class="setting-block">
        <div>
          <h3>How gold is counted</h3>
          <p class="muted">Your sheet pays the run once per checked row. The game pays every character in the run. Pick the rule you want the totals to follow.</p>
        </div>
        <div class="mode-switch">
          <button class="${state.settings.goldMode === 'run' ? 'is-active' : ''}" data-act="gold-mode" data-mode="run">Per run</button>
          <button class="${state.settings.goldMode === 'character' ? 'is-active' : ''}" data-act="gold-mode" data-mode="character">Per character</button>
        </div>
      </div>

      <div class="setting-block">
        <div>
          <h3>Week reset</h3>
          <p class="muted">Lost Ark resets weekly at 06:00 server time. The board keys weeks by the reset day, so history never collides.</p>
        </div>
        <div class="inline-fields">
          <label class="field">
            <span>Day</span>
            <select data-act="setting" data-key="resetDay">
              ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                .map((d, i) => `<option value="${i}" ${num(state.settings.resetDay) === i ? 'selected' : ''}>${d}</option>`)
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Hour</span>
            <input type="number" min="0" max="23" value="${attr(state.settings.resetHour)}" data-act="setting" data-key="resetHour" />
          </label>
        </div>
      </div>
    </section>`;
}

function payoutsPanel(state) {
  const raids = state.data.raids.slice().sort((a, b) => num(a.order, 999) - num(b.order, 999));
  return `
    <section class="panel panel-wide" id="payouts">
      <header class="panel-head">
        <h2>${ico('sword', 16)} Raids & payouts</h2>
        <span class="muted">edit any cell — saves to the sheet</span>
      </header>
      <div class="table-scroll">
        <table class="table raid-settings">
          <thead>
            <tr>
              <th>Label</th><th>Name</th><th>Difficulty</th><th>iLvl</th>
              <th>Tradable</th><th>Bound</th><th>Party</th><th>On</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${raids
              .map(
                (raid) => `
              <tr class="${raid.active === false ? 'is-inactive' : ''}">
                <td><input class="cell-input w-sm" value="${attr(raid.short)}" data-act="raid-field" data-id="${attr(raid.id)}" data-field="short" /></td>
                <td><input class="cell-input" value="${attr(raid.name)}" data-act="raid-field" data-id="${attr(raid.id)}" data-field="name" /></td>
                <td>
                  <select class="cell-input" data-act="raid-field" data-id="${attr(raid.id)}" data-field="difficulty">
                    ${['Normal', 'Hard', 'Nightmare', 'Solo']
                      .map((d) => `<option ${raid.difficulty === d ? 'selected' : ''}>${d}</option>`)
                      .join('')}
                  </select>
                </td>
                <td><input class="cell-input w-xs" type="number" value="${attr(raid.ilvl)}" data-act="raid-field" data-id="${attr(raid.id)}" data-field="ilvl" /></td>
                <td><input class="cell-input w-md" type="number" step="100" value="${attr(raid.goldTradable)}" data-act="raid-field" data-id="${attr(raid.id)}" data-field="goldTradable" /></td>
                <td><input class="cell-input w-md" type="number" step="100" value="${attr(raid.goldBound)}" data-act="raid-field" data-id="${attr(raid.id)}" data-field="goldBound" /></td>
                <td><input class="cell-input w-xs" type="number" value="${attr(raid.partySize)}" data-act="raid-field" data-id="${attr(raid.id)}" data-field="partySize" /></td>
                <td><button class="switch ${raid.active !== false ? 'is-on' : ''}" data-act="raid-active" data-id="${attr(raid.id)}" title="Active"><span></span></button></td>
                <td class="row-actions"><button class="mini danger" data-act="raid-del" data-id="${attr(raid.id)}" title="Delete raid and its runs">${ico('trash', 13)}</button></td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <form class="form-grid compact" data-form="add-raid">
        <label class="field"><span>Name</span><input name="name" placeholder="Kazeros Act 4" required /></label>
        <label class="field"><span>Difficulty</span>
          <select name="difficulty"><option>Normal</option><option>Hard</option><option>Nightmare</option><option>Solo</option></select>
        </label>
        <label class="field"><span>iLvl</span><input name="ilvl" type="number" placeholder="1720" /></label>
        <label class="field"><span>Tradable gold</span><input name="goldTradable" type="number" step="100" placeholder="38000" /></label>
        <label class="field"><span>Bound gold</span><input name="goldBound" type="number" step="100" placeholder="0" /></label>
        <label class="field"><span>Party</span><input name="partySize" type="number" placeholder="8" value="8" /></label>
        <button class="btn" type="submit">${ico('plus', 14)} Add raid</button>
      </form>

      <footer class="panel-foot">
        <span class="muted">Totals follow the game's split: tradable gold for the market, bound gold for your own characters.</span>
      </footer>
    </section>`;
}

function playersPanel(state) {
  return `
    <section class="panel">
      <header class="panel-head">
        <h2>${ico('users', 16)} Owners</h2>
        <span class="muted">the columns of the sheet</span>
      </header>
      <div class="player-settings">
        ${state.data.players
          .slice()
          .sort((a, b) => num(a.order, 999) - num(b.order, 999))
          .map(
            (player) => `
          <div class="ps-edit">
            <input type="color" value="${attr(player.color || '#a855f7')}" data-act="player-field" data-id="${attr(player.id)}" data-field="color" title="Column color" />
            <input class="cell-input" value="${attr(player.name)}" data-act="player-field" data-id="${attr(player.id)}" data-field="name" placeholder="Name" aria-label="Owner name" />
            <input class="cell-input w-xs" value="${attr(player.tag)}" data-act="player-field" data-id="${attr(player.id)}" data-field="tag" placeholder="TAG" aria-label="Owner tag" maxlength="5" />
            <span class="muted">${state.data.characters.filter((c) => c.playerId === player.id).length} characters</span>
          </div>`,
          )
          .join('')}
      </div>
    </section>`;
}

function dataPanel(state) {
  const connected = state.status === 'remote';
  return `
    <section class="panel">
      <header class="panel-head">
        <h2>${ico('download', 16)} Data</h2>
      </header>
      <div class="data-actions">
        <button class="btn ghost" data-act="export">${ico('download', 14)} Export JSON</button>
        <button class="btn ghost" data-act="import">${ico('upload', 14)} Import JSON</button>
        <input type="file" accept="application/json,.json" id="import-file" hidden />
        ${connected
          ? `<button class="btn ghost" data-act="push-data">${ico('upload', 14)} Push data to sheet</button>
             <button class="btn ghost" data-act="push-seed">${ico('spark', 14)} Reset sheet to demo data</button>`
          : `<button class="btn ghost" data-act="reset-demo">${ico('refresh', 14)} Reset demo data</button>`}
      </div>
      <p class="muted small-note">
        Export is a full snapshot (every week). Import replaces everything — use it to move between browsers or to seed a new sheet.
        ${connected ? ' Push overwrites the sheet tabs with what is loaded here.' : ''}
      </p>
    </section>`;
}

function aboutPanel() {
  return `
    <section class="panel about">
      <header class="panel-head"><h2>${ico('spark', 16)} About</h2></header>
      <p><strong>LOANDOM</strong> — a raid gold tracker that keeps its database in a Google Sheet and its UI on GitHub Pages. No VPS, no domain, no database service.</p>
      <div class="kv-grid">
        <div class="kv"><span>Frontend</span><strong>static · GitHub Pages</strong></div>
        <div class="kv"><span>Backend</span><strong>Apps Script web app</strong></div>
        <div class="kv"><span>Database</span><strong>Google Sheet</strong></div>
        <div class="kv"><span>Build step</span><strong>none</strong></div>
      </div>
      <p class="muted">Unofficial fan tool. Lost Ark and its raid data belong to Smilegate / Amazon Games. Payout values are editable because patches move them.</p>
    </section>`;
}

export function renderSettings(state, stats) {
  return `
    <div class="view-head">
      <div>
        <h1>Settings</h1>
        <p>Connect the spreadsheet, fix a payout after a patch, or move your data around.</p>
      </div>
      <div class="head-stats">
        <div class="head-stat"><span>Raid gold / week</span><strong class="gold-text">${fmt(stats.totals.raidTradable + stats.totals.raidBound)}</strong></div>
        <div class="head-stat"><span>Week</span><strong>${esc(weekLabel(state.week))}</strong></div>
      </div>
    </div>
    <div class="settings-grid">
      ${connectionPanel(state)}
      ${syncPanel(state)}
      ${playersPanel(state)}
      ${payoutsPanel(state)}
      ${dataPanel(state)}
      ${aboutPanel()}
    </div>`;
}

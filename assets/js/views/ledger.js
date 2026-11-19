/* Ledger: gold that does not come from the raid board (una tokens, chaos
   gates, solo-mode bound gold, the BOUND GOLD cell at the bottom of the
   original sheet, ...). Kept separate so raid math stays trustworthy. */

import { esc, attr, fmt, num, weekLabel, rowStatus } from '../util.js';
import { ico } from '../icons.js';

export function renderLedger(state, stats) {
  const rows = stats.ledger.rows.slice().sort((a, b) => num(b.amount) - num(a.amount));
  const players = state.data.players;
  const playerName = (id) => players.find((p) => p.id === id)?.name || '';

  return `
    <div class="view-head">
      <div>
        <h1>Ledger <span class="week-chip">${esc(weekLabel(state.week))}</span></h1>
        <p>Manual gold outside the raid board. Raid gold is already counted automatically — this is for everything else.</p>
      </div>
      <div class="head-stats">
        <div class="head-stat"><span>Manual tradable</span><strong class="gold-text">${fmt(stats.ledger.totals.tradable)}</strong></div>
        <div class="head-stat"><span>Manual bound</span><strong class="violet-text">${fmt(stats.ledger.totals.bound)}</strong></div>
      </div>
    </div>

    <section class="panel">
      <header class="panel-head">
        <h2>${ico('plus', 16)} Add an entry</h2>
        <span class="muted">saved to the Ledger tab of the sheet</span>
      </header>
      <form class="ledger-form" data-form="ledger-add">
        <label class="field">
          <span>Type</span>
          <select name="kind">
            <option value="tradable">Tradable</option>
            <option value="bound">Bound</option>
          </select>
        </label>
        <label class="field">
          <span>Amount (G)</span>
          <input name="amount" type="number" min="0" step="100" placeholder="231000" required />
        </label>
        <label class="field grow">
          <span>Source</span>
          <input name="source" list="ledger-sources" placeholder="Una tokens, chaos gate, solo mode…" maxlength="48" />
          <datalist id="ledger-sources">
            <option>Una tokens</option>
            <option>Chaos gate</option>
            <option>Solo mode</option>
            <option>Horizon Cathedral</option>
            <option>Extreme raid</option>
            <option>Sheet import</option>
          </datalist>
        </label>
        <label class="field">
          <span>Owner <span class="muted">(optional)</span></span>
          <select name="playerId">
            <option value="">Whole roster</option>
            ${players.map((p) => `<option value="${attr(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field grow">
          <span>Note <span class="muted">(optional)</span></span>
          <input name="note" placeholder="Anything worth remembering" maxlength="80" />
        </label>
        <button class="btn primary" type="submit">${ico('plus', 15)} Add</button>
      </form>
    </section>

    <section class="panel">
      <header class="panel-head">
        <h2>${ico('ledger', 16)} This week</h2>
        <span class="muted">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}</span>
      </header>
      ${
        rows.length
          ? `<table class="table ledger-table">
              <thead><tr><th scope="col">Type</th><th scope="col" class="num">Amount</th><th scope="col">Source</th><th scope="col">Owner</th><th scope="col">Note</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>
                ${rows
                  .map((row) => {
                    const status = rowStatus(state, `ledger:${row.id}`);
                    return `
                  <tr${status ? ` class="${status.trim()}" aria-busy="true"` : ''}>
                    <td><span class="kind kind-${row.kind}">${row.kind === 'bound' ? 'Bound' : 'Tradable'}</span></td>
                    <td class="num strong">${fmt(row.amount)}</td>
                    <td>${esc(row.source || '—')}</td>
                    <td class="muted">${esc(playerName(row.playerId) || 'Roster')}</td>
                    <td class="muted note-cell">${esc(row.note || '—')}</td>
                    <td class="row-actions">
                      <button class="mini danger" data-act="ledger-del" data-id="${attr(row.id)}" title="Delete entry" aria-label="Delete ${attr(fmt(row.amount))} gold entry">${ico('trash', 13)}</button>
                    </td>
                  </tr>`;
                  })
                  .join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td class="muted">Total</td>
                  <td class="num strong gold-text">${fmt(stats.ledger.totals.total)}</td>
                  <td colspan="3" class="muted">tradable ${fmt(stats.ledger.totals.tradable)} · bound ${fmt(stats.ledger.totals.bound)}</td>
                </tr>
              </tfoot>
            </table>`
          : `<div class="empty small">
              <span class="empty-icon">${ico('ledger', 20)}</span>
              <h3>Nothing manual this week</h3>
              <p>The sheet's BOUND GOLD total lives here if you want the summary to match it exactly.</p>
            </div>`
      }
      <footer class="panel-foot">
        <span class="muted">${ico('info', 12)} Ledger entries are added on top of raid gold in Gold → totals.</span>
      </footer>
    </section>`;
}

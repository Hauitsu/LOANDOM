/* The weekly board — the interactive version of the original sheet. */

import { esc, attr, fmt, num, weekLabel, colorFor, textOn } from '../util.js';
import { ico } from '../icons.js';
import { progressBar } from '../ui.js';
import { classBadge } from '../classbadge.js';

function diffClass(difficulty) {
  const d = String(difficulty || '').toLowerCase();
  if (d.startsWith('night')) return 'diff-nightmare';
  if (d.startsWith('hard')) return 'diff-hard';
  if (d.startsWith('solo')) return 'diff-solo';
  return 'diff-normal';
}

function payout(raid) {
  const tradable = num(raid.goldTradable);
  const bound = num(raid.goldBound);
  if (bound > 0 && tradable > 0) return { main: fmt(tradable + bound), split: `${fmt(tradable)} tradable · ${fmt(bound)} bound` };
  if (bound > 0) return { main: fmt(bound), split: 'bound gold' };
  return { main: fmt(tradable), split: 'tradable gold' };
}

function slotCell(row, raid, player, state, charMap) {
  const assignment = row.cells[player.id];
  if (!assignment?.name) {
    return `<button class="slot is-empty" data-act="cell" data-run="${attr(row.run.id)}" data-player="${attr(player.id)}" aria-label="Assign a character">
      <span class="slot-plus">${ico('plus', 13)}</span>
    </button>`;
  }
  const character = assignment.characterId ? charMap.get(assignment.characterId) : null;
  const ilvlWarn = character && character.ilvl && raid.ilvl && character.ilvl < raid.ilvl;
  const label = character ? character.name : assignment.name;
  const title = [
    label,
    character?.className || '',
    character?.ilvl ? `iLvl ${character.ilvl}` : '',
    ilvlWarn ? `below ${raid.short} (${raid.ilvl})` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return `<button class="slot ${ilvlWarn ? 'is-warn' : ''}" data-act="cell" data-run="${attr(row.run.id)}" data-player="${attr(player.id)}"${character ? ` data-char-tip="${attr(character.id)}"` : ''} title="${attr(title)}">
    ${classBadge(character?.className, 14)}
    <span class="slot-name">${esc(label)}</span>
    ${ilvlWarn ? `<span class="slot-flag">${ico('warning', 11)}</span>` : ''}
  </button>`;
}

function raidCard(block, state, charMap, focused = false) {
  const { raid, rows, totals, clearedRuns, runCount } = block;
  const players = state.data.players.slice().sort((a, b) => num(a.order, 999) - num(b.order, 999));
  const money = payout(raid);

  const body = rows.length
    ? rows
        .map(
          (row) => `
      <div class="raid-row run-row ${row.run.cleared ? 'is-cleared' : ''}">
        <div class="cell idx">
          <span class="run-no">${esc(row.run.index)}</span>
          <div class="run-tools">
            <button class="mini" data-act="dup-run" data-run="${attr(row.run.id)}" title="Duplicate this run (same characters)">${ico('copy', 13)}</button>
            <button class="mini danger" data-act="del-run" data-run="${attr(row.run.id)}" title="Delete this run">${ico('trash', 13)}</button>
          </div>
        </div>
        ${players.map((player) => `<div class="cell">${slotCell(row, raid, player, state, charMap)}</div>`).join('')}
        <div class="cell gold">
          ${
            row.run.cleared
              ? `<span class="gold-value">${fmt(row.gold.total)}</span>${row.gold.claims > 1 ? `<span class="gold-mult">×${row.gold.claims}</span>` : ''}`
              : '<span class="gold-value is-zero">—</span>'
          }
        </div>
        <div class="cell check">
          <button class="check ${row.run.cleared ? 'on' : ''}" data-act="toggle" data-run="${attr(row.run.id)}"
            aria-pressed="${row.run.cleared}" title="${row.run.cleared ? 'Cleared — click to uncheck' : 'Mark as cleared'}">
            ${ico('check', 14)}
          </button>
        </div>
      </div>`,
        )
        .join('')
    : `<div class="raid-empty">
         <span>No runs yet for this raid.</span>
         <button class="btn small" data-act="add-run" data-raid="${attr(raid.id)}">${ico('plus', 14)} Add first run</button>
       </div>`;

  return `
  <article class="raid ${raid.active === false ? 'is-inactive' : ''} ${focused ? 'is-focused' : ''}">
    <header class="raid-head">
      <div class="raid-headline">
        <div class="raid-title">
          <h2>${esc(raid.name)}</h2>
          <span class="badge ${diffClass(raid.difficulty)}">${esc(raid.difficulty)}</span>
        </div>
        <div class="raid-meta">
          <span class="meta-item">${ico('sword', 12)} iLvl ${esc(raid.ilvl || '—')}</span>
          <span class="meta-item">${ico('users', 12)} ${esc(raid.partySize || 8)}p</span>
          ${raid.note ? `<span class="meta-item muted">${esc(raid.note)}</span>` : ''}
        </div>
      </div>
      <div class="raid-head-right">
        <button class="icon-btn focus-btn" data-act="focus-raid" data-raid="${attr(raid.id)}"
          title="${focused ? 'Back to all raids' : 'Focus this raid'}" aria-label="${focused ? 'Back to all raids' : 'Focus this raid'}">
          ${ico(focused ? 'grid' : 'expand', 16)}
        </button>
        <div class="raid-payout" title="${attr(money.split)}">
          <span class="payout-main">${money.main}</span>
          <span class="payout-unit">G / run</span>
        </div>
      </div>
    </header>

    <div class="raid-strip">
      ${progressBar(clearedRuns, Math.max(runCount, 1))}
      <span class="strip-label">${clearedRuns}/${runCount} runs</span>
    </div>

    <div class="raid-table" style="--players:${players.length}">
      <div class="raid-row head-row">
        <div class="cell idx">#</div>
        ${players
          .map(
            (player) => `
          <div class="cell player-head" style="--pc:${attr(player.color || colorFor(player.name))};--pc-ink:${attr(textOn(player.color || colorFor(player.name)))}">
            <span class="player-tag">${esc(player.tag || player.name)}</span>
          </div>`,
          )
          .join('')}
        <div class="cell gold-head">Gold</div>
        <div class="cell check-head" title="Cleared">${ico('check', 13)}</div>
      </div>
      ${body}
    </div>

    <footer class="raid-foot">
      <div class="foot-actions">
        <button class="add-run" data-act="add-run" data-raid="${attr(raid.id)}">${ico('plus', 13)} Run</button>
      </div>
      <div class="foot-stat">
        <span>Cleared</span>
        <strong>${clearedRuns}<span class="muted">/${runCount}</span></strong>
      </div>
      <div class="foot-stat">
        <span>Earned</span>
        <strong class="gold-text">${fmt(totals.total)}</strong>
      </div>
    </footer>
  </article>`;
}

function demoTip(state) {
  return `
    <div class="banner banner-demo">
      <span class="banner-icon">${ico('spark', 16)}</span>
      <div>
        <strong>Demo mode.</strong> Edits are saved in this browser only.
        <span class="muted">Connect your Google Sheet to sync everywhere — your demo data can be pushed into it with one click.</span>
      </div>
      <button class="btn small" data-act="goto" data-route="settings">${ico('link', 14)} Connect sheet</button>
    </div>`;
}

function readOnlyTip() {
  return `
    <div class="banner banner-readonly">
      <span class="banner-icon">${ico('key', 16)}</span>
      <div>
        <strong>Read-only access.</strong> You can browse every week and every total.
        <span class="muted">Ticking runs, editing characters or adding gold needs the editor link from the sheet owner.</span>
      </div>
      <button class="btn small" data-act="goto" data-route="settings">${ico('settings', 14)} Access</button>
    </div>`;
}

export function renderBoard(state, stats) {
  const charMap = new Map(state.data.characters.map((c) => [c.id, c]));
  const cleared = stats.raidBlocks.reduce((acc, b) => acc + b.clearedRuns, 0);
  const total = stats.raidBlocks.reduce((acc, b) => acc + b.runCount, 0);

  if (!stats.raidBlocks.length) {
    return `
      <div class="view-head">
        <div><h1>Raid board</h1><p>Nothing to track yet.</p></div>
      </div>
      <div class="empty">
        <span class="empty-icon">${ico('sword', 22)}</span>
        <h3>No raids configured</h3>
        <p>Add your weekly raids and their gold payouts in Settings — the board builds itself from there.</p>
        <button class="btn primary" data-act="goto" data-route="settings">${ico('settings', 15)} Open settings</button>
      </div>`;
  }

  const focusBlock = state.focusRaidId
    ? stats.raidBlocks.find((block) => block.raid.id === state.focusRaidId)
    : null;

  if (focusBlock) {
    return `
      ${state.status === 'remote' && state.readOnly ? readOnlyTip() : ''}
      ${state.status === 'demo' ? demoTip(state) : ''}
      <div class="view-head">
        <div>
          <h1>${esc(focusBlock.raid.name)} <span class="week-chip">${esc(weekLabel(state.week))}</span></h1>
          <p>Focused board — ${esc(focusBlock.raid.difficulty)} · iLvl ${esc(focusBlock.raid.ilvl)} · ${focusBlock.clearedRuns}/${focusBlock.runCount} runs cleared.</p>
        </div>
        <div class="head-actions">
          <button class="btn" data-act="focus-raid" data-raid="">${ico('grid', 15)} All raids</button>
        </div>
      </div>
      <div class="raid-grid raid-grid-focus">
        ${raidCard(focusBlock, state, charMap, true)}
      </div>`;
  }

  return `
    ${state.status === 'remote' && state.readOnly ? readOnlyTip() : ''}
    ${state.status === 'demo' ? demoTip(state) : ''}
    <div class="view-head">
      <div>
        <h1>Raid board <span class="week-chip">${esc(weekLabel(state.week))}</span></h1>
        <p>Assign characters per run, tick the runs you cleared, and the gold adds itself up.</p>
      </div>
      <div class="head-stats">
        <div class="head-stat"><span>Runs cleared</span><strong>${cleared}<span class="muted">/${total}</span></strong></div>
        <div class="head-stat"><span>Raid gold</span><strong class="gold-text">${fmt(stats.totals.raidTradable + stats.totals.raidBound)}</strong></div>
      </div>
    </div>
    <div class="raid-grid">
      ${stats.raidBlocks.map((block) => raidCard(block, state, charMap)).join('')}
    </div>`;
}

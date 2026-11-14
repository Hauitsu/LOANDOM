/* Gold summary: the bound / unbound numbers from the bottom of the sheet,
   plus per-raid, per-player and week-over-week breakdowns. */

import { esc, attr, fmt, weekLabel, fmtK, colorFor, textOn } from '../util.js';
import { ico } from '../icons.js';
import { progressBar } from '../ui.js';
import * as model from '../model.js';

function goldCards(stats) {
  const t = stats.totals;
  return `
    <div class="gold-cards">
      <article class="gold-card bound">
        <span class="gc-label">BOUND GOLD</span>
        <strong class="gc-value">${fmt(t.bound)}</strong>
        <span class="gc-sub">${ico('info', 12)} stuck on your characters — honing, karma, quality</span>
      </article>
      <article class="gold-card unbound">
        <span class="gc-label">UNBOUND GOLD</span>
        <strong class="gc-value">${fmt(t.tradable)}</strong>
        <span class="gc-sub">${ico('gold', 12)} spendable on the marketplace</span>
      </article>
      <article class="gold-card total">
        <span class="gc-label">TOTAL THIS WEEK</span>
        <strong class="gc-value">${fmt(t.total)}</strong>
        <span class="gc-sub">${fmt(t.raidTradable + t.raidBound)} from raids${t.ledgerTradable + t.ledgerBound ? ` · ${fmt(t.ledgerTradable + t.ledgerBound)} manual` : ''}</span>
      </article>
    </div>`;
}

function modeSwitch(stats) {
  const mode = stats.goldMode;
  return `
    <div class="mode-switch" role="group" aria-label="Gold counting mode">
      <button class="${mode === 'run' ? 'is-active' : ''}" data-act="gold-mode" data-mode="run" title="One payout per cleared run — matches the original sheet">
        Per run
      </button>
      <button class="${mode === 'character' ? 'is-active' : ''}" data-act="gold-mode" data-mode="character" title="Every character in a cleared run earns the payout — matches the game">
        Per character
      </button>
    </div>`;
}

function breakdown(stats) {
  const max = Math.max(1, ...stats.raidBlocks.map((b) => b.totals.total));
  return `
    <section class="panel">
      <header class="panel-head">
        <h2>${ico('sword', 16)} Raid breakdown</h2>
        <span class="muted">${stats.raidBlocks.reduce((a, b) => a + b.clearedRuns, 0)} clears</span>
      </header>
      <div class="breakdown">
        ${stats.raidBlocks
          .map((block) => {
            const share = Math.round((block.totals.total / max) * 100);
            return `
            <div class="breakdown-row">
              <div class="bd-main">
                <div class="bd-title">
                  <span>${esc(block.raid.name)}</span>
                  <span class="badge subtle">${esc(block.raid.difficulty)}</span>
                </div>
                <div class="bd-bar">
                  <span style="width:${share}%"></span>
                </div>
              </div>
              <div class="bd-count muted">${block.clearedRuns}/${block.runCount}</div>
              <div class="bd-gold ${block.totals.total ? '' : 'is-zero'}">${fmt(block.totals.total)}</div>
            </div>`;
          })
          .join('')}
        ${
          stats.ledger.rows.length
            ? `<div class="breakdown-row is-manual">
                <div class="bd-main">
                  <div class="bd-title"><span>Manual entries</span><span class="badge subtle">ledger</span></div>
                  <div class="bd-bar"><span style="width:${Math.round((stats.ledger.totals.total / max) * 100)}%"></span></div>
                </div>
                <div class="bd-count muted">${stats.ledger.rows.length}</div>
                <div class="bd-gold">${fmt(stats.ledger.totals.total)}</div>
              </div>`
            : ''
        }
      </div>
      <footer class="panel-foot">
        <span class="muted">${stats.goldMode === 'character' ? 'Counting one payout per character in each cleared run.' : 'Counting one payout per cleared run — same as the original sheet.'}</span>
        <button class="link-btn" data-act="goto" data-route="settings">${ico('settings', 12)} Payouts</button>
      </footer>
    </section>`;
}

function playersPanel(stats) {
  return `
    <section class="panel">
      <header class="panel-head">
        <h2>${ico('users', 16)} By owner</h2>
        <span class="muted">${stats.players.length} owners</span>
      </header>
      <div class="player-summary">
        ${stats.perPlayer
          .map(({ player, goldCharacters, clearedRuns, assignments }) => {
            const color = player.color || colorFor(player.name);
            return `
              <div class="ps-row">
                <span class="ps-avatar" style="--pc:${attr(color)};--pc-ink:${attr(textOn(color))}">${esc(player.tag || player.name.slice(0, 2))}</span>
                <div class="ps-name">
                  <strong>${esc(player.name)}</strong>
                  <span class="muted">${goldCharacters}/${6} gold-earning characters</span>
                </div>
                <div class="ps-stat"><span>Assigned</span><strong>${assignments}</strong></div>
                <div class="ps-stat"><span>Cleared</span><strong>${clearedRuns}</strong></div>
                <div class="ps-bar">${progressBar(Math.min(goldCharacters, 6), 6, goldCharacters > 6 ? 'danger' : 'gold')}</div>
              </div>`;
          })
          .join('')}
      </div>
    </section>`;
}

function historyPanel(state) {
  const weeks = model.recentWeeks(state.data, state.week, 7).reverse();
  if (weeks.length < 2) {
    return `
      <section class="panel">
        <header class="panel-head"><h2>${ico('chart', 16)} Week over week</h2></header>
        <div class="empty small">
          <p>History appears once you have more than one week of runs.</p>
          <span class="muted">Navigate weeks with the arrows in the header — the sheet keeps every week.</span>
        </div>
      </section>`;
  }
  const rows = weeks.map((week) => ({ week, ...model.weekTotals(state.data, week, state.settings) }));
  const max = Math.max(1, ...rows.map((r) => r.totals.total));
  return `
    <section class="panel">
      <header class="panel-head">
        <h2>${ico('chart', 16)} Week over week</h2>
        <span class="muted">last ${rows.length} weeks</span>
      </header>
      <div class="history">
        ${rows
          .map((row) => {
            const totalH = Math.round((row.totals.total / max) * 100);
            const boundShare = row.totals.total ? Math.round((row.totals.bound / row.totals.total) * 100) : 0;
            return `
              <button class="hist-col ${row.week === state.week ? 'is-current' : ''}" data-act="jump-week" data-week="${attr(row.week)}"
                title="${attr(weekLabel(row.week))}: ${fmt(row.totals.total)} G">
                <span class="hist-track">
                  <span class="hist-bar" style="height:${Math.max(4, totalH)}%">
                    <span class="hist-bound" style="height:${boundShare}%"></span>
                  </span>
                </span>
                <span class="hist-value">${fmtK(row.totals.total)}</span>
                <span class="hist-label">${esc(weekLabel(row.week).split('–')[0].trim())}</span>
              </button>`;
          })
          .join('')}
      </div>
    </section>`;
}

function warningsPanel(stats) {
  const warnings = stats.warnings;
  return `
    <section class="panel">
      <header class="panel-head">
        <h2>${ico('warning', 16)} Checks</h2>
        <span class="muted">${warnings.length ? `${warnings.length} to review` : 'all clear'}</span>
      </header>
      ${
        warnings.length
          ? `<ul class="warning-list">
              ${warnings
                .slice(0, 12)
                .map(
                  (w) => `<li class="warning-item level-${w.level}">
                    <span class="w-icon">${ico(w.level === 'warn' ? 'warning' : 'info', 14)}</span>
                    <span>${esc(w.text)}</span>
                  </li>`,
                )
                .join('')}
              ${warnings.length > 12 ? `<li class="warning-item muted">…and ${warnings.length - 12} more.</li>` : ''}
            </ul>`
          : `<div class="all-clear">${ico('check', 16)} No duplicate characters, item-level problems or over-cap clears this week.</div>`
      }
    </section>`;
}

export function renderSummary(state, stats) {
  return `
    <div class="view-head">
      <div>
        <h1>Gold <span class="week-chip">${esc(weekLabel(state.week))}</span></h1>
        <p>Everything the sheet totals up, live — with the raid and owner breakdown behind it.</p>
      </div>
      <div class="head-actions">${modeSwitch(stats)}</div>
    </div>
    ${goldCards(stats)}
    <div class="summary-grid">
      ${breakdown(stats)}
      ${playersPanel(stats)}
      ${historyPanel(state)}
      ${warningsPanel(stats)}
    </div>`;
}

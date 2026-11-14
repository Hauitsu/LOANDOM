/* Roster: every character, its item level and what it is doing this week. */

import { esc, attr, num, colorFor, textOn } from '../util.js';
import { ico } from '../icons.js';
import { progressBar } from '../ui.js';
import { classColor } from '../classes.js';
import { classBadge } from '../classbadge.js';

function usageMap(stats) {
  const map = new Map();
  stats.raidBlocks.forEach((block) => {
    block.rows.forEach((row) => {
      Object.values(row.cells).forEach((assignment) => {
        if (!assignment?.name) return;
        const key = assignment.characterId || `name:${assignment.name.toLowerCase()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ raid: block.raid, run: row.run, cleared: row.run.cleared });
      });
    });
  });
  return map;
}

function characterRow(character, player, usage, eligibleRaids) {
  const used = usage.get(character.id) || [];
  const clearedCount = used.filter((u) => u.cleared).length;
  const overCap = clearedCount > 3;
  const belowLevel = used.filter((u) => character.ilvl && u.raid.ilvl && character.ilvl < u.raid.ilvl);
  const tint = classColor(character.className);

  const chips = used.length
    ? used
        .map(
          (u) => `<span class="usage ${u.cleared ? 'is-cleared' : ''}" title="${attr(u.raid.name)} · ${u.cleared ? 'cleared' : 'planned'}">
            ${u.cleared ? ico('check', 10) : ''}${esc(u.raid.short || u.raid.name)}
          </span>`,
        )
        .join('')
    : `<span class="usage is-idle">not assigned</span>`;

  return `
    <tr class="${!character.active ? 'is-inactive' : ''}" data-char="${attr(character.id)}">
      <td class="char-name-cell">
        ${classBadge(character.className, 22)}
        <button class="char-name" data-act="edit-char" data-char="${attr(character.id)}" data-char-tip="${attr(character.id)}">
          ${character.goldEarner ? `<span class="crown" title="Gold earner">${ico('crown', 11)}</span>` : ''}
          <span>${esc(character.name)}</span>
        </button>
        ${belowLevel.length ? `<span class="row-flag" title="Below the item level of ${esc(belowLevel.map((u) => u.raid.short).join(', '))}">${ico('warning', 11)}</span>` : ''}
      </td>
      <td class="muted">${
        character.className
          ? `<span class="class-dot" style="background:${attr(tint)}"></span>${esc(character.className)}`
          : '<span class="dash">—</span>'
      }</td>
      <td class="num">${character.ilvl ? esc(character.ilvl) : '<span class="dash">—</span>'}</td>
      <td class="usage-cell">${chips}${overCap ? `<span class="usage is-over" title="Only 3 content entries pay gold">+${clearedCount - 3} over cap</span>` : ''}</td>
      <td class="row-actions">
        <button class="mini" data-act="edit-char" data-char="${attr(character.id)}" title="Edit">${ico('settings', 13)}</button>
        <button class="mini danger" data-act="del-char" data-char="${attr(character.id)}" title="Delete">${ico('trash', 13)}</button>
      </td>
    </tr>`;
}

function playerCard(player, state, stats, usage) {
  const color = player.color || colorFor(player.name);
  const characters = state.data.characters
    .filter((c) => c.playerId === player.id)
    .sort((a, b) => num(b.ilvl) - num(a.ilvl) || a.name.localeCompare(b.name));

  const goldEarners = characters.filter((c) => c.goldEarner && c.active !== false).length;
  const raidCount = stats.raidBlocks.length;

  return `
    <section class="roster-card" style="--pc:${attr(color)};--pc-ink:${attr(textOn(color))}">
      <header class="roster-head">
        <span class="avatar">${esc(player.tag || player.name.slice(0, 3))}</span>
        <div class="roster-id">
          <h2>${esc(player.name)}</h2>
          <p>${characters.length} character${characters.length === 1 ? '' : 's'} · ${goldEarners}/${6} gold earners</p>
        </div>
        <form class="add-char" data-form="add-char" data-player="${attr(player.id)}" autocomplete="off">
          <input name="name" placeholder="New character…" maxlength="24" aria-label="New character for ${attr(player.name)}" />
          <button class="icon-btn" type="submit" title="Add character">${ico('plus', 15)}</button>
        </form>
      </header>

      <div class="roster-cap">${progressBar(Math.min(goldEarners, 6), 6)}</div>

      ${
        characters.length
          ? `<table class="table roster-table">
              <thead>
                <tr><th>Character</th><th>Class</th><th>iLvl</th><th>This week <span class="muted">(${raidCount})</span></th><th></th></tr>
              </thead>
              <tbody>${characters.map((c) => characterRow(c, player, usage, stats.raidBlocks)).join('')}</tbody>
            </table>`
          : `<div class="roster-empty">
              <p>No characters yet for ${esc(player.name)}.</p>
              <span class="muted">Type a name above, or assign one on the board and it appears here.</span>
            </div>`
      }
    </section>`;
}

export function renderRoster(state, stats) {
  const usage = usageMap(stats);
  const players = state.data.players.slice().sort((a, b) => num(a.order, 999) - num(b.order, 999));
  const totalChars = state.data.characters.length;

  return `
    <div class="view-head">
      <div>
        <h1>Roster</h1>
        <p>${totalChars} characters across ${players.length} owners. Item level drives the “can they run it” check.</p>
      </div>
      <div class="head-stats">
        <div class="head-stat"><span>Characters</span><strong>${totalChars}</strong></div>
        <div class="head-stat"><span>Gold clears this week</span><strong>${stats.raidBlocks.reduce((a, b) => a + b.clearedRuns, 0)}</strong></div>
      </div>
    </div>
    <div class="rules-strip">
      <span>${ico('info', 14)} Weekly limits: <strong>6</strong> gold-earning characters per roster, <strong>3</strong> gold clears per character.</span>
      <span class="muted">The app flags anything over the cap.</span>
    </div>
    <div class="roster-grid">
      ${players.map((player) => playerCard(player, state, stats, usage)).join('')}
    </div>`;
}

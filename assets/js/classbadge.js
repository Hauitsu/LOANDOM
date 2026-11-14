/* Placeholder class sigil — a local crest tinted by class colour.
   Replaced by real class icons later without touching call sites. */

import { attr } from './util.js';
import { classInfo } from './classes.js';

const CREST = '<path d="M12 2.5 19.5 5.5v5.9c0 4.9-3.2 8.7-7.5 10.2-4.3-1.5-7.5-5.3-7.5-10.2V5.5L12 2.5Z"/>';

export function classBadge(name, size = 18) {
  const info = classInfo(name);
  const color = info ? info.color : '#5b6579';
  const label = name ? name : 'Class not set';
  return `<span class="class-logo" style="--cc:${attr(color)};width:${size}px;height:${size}px" title="${attr(label)}" aria-label="${attr(label)}">
    <svg viewBox="0 0 24 24" width="${Math.max(10, size - 7)}" height="${Math.max(10, size - 7)}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">${CREST}</svg>
  </span>`;
}

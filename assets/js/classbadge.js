/* Class sigil: bundled official publisher emblem, tinted by class colour with
   a local CSS mask. Unknown custom names keep the original crest fallback.
   Call sites pass a class name and a pixel size; no network image requests. */

import { attr } from './util.js';
import { classInfo } from './classes.js';

const CREST = '<path d="M12 2.5 19.5 5.5v5.9c0 4.9-3.2 8.7-7.5 10.2-4.3-1.5-7.5-5.3-7.5-10.2V5.5L12 2.5Z"/>';
const FALLBACK_COLOR = '#5b6579';

/** CSS mask URLs resolve against the stylesheet, so pass an absolute page URL. */
const iconUrl = (path) => {
  if (typeof document === 'undefined' || !document.baseURI) return path;
  return new URL(path, document.baseURI).href;
};

export function classBadge(name, size = 18) {
  const info = classInfo(name);
  const color = info ? info.color : FALLBACK_COLOR;
  const label = info ? info.name : (String(name || '').trim() || 'Class not set');
  const px = Math.max(10, Number(size) || 18);
  const glyph = info?.icon
    ? `<span class="class-logo-glyph" style="--class-icon:url(${attr(iconUrl(info.icon))})" aria-hidden="true"></span>`
    : `<svg class="class-logo-crest" viewBox="0 0 24 24" width="${Math.max(10, px - 7)}" height="${Math.max(10, px - 7)}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">${CREST}</svg>`;
  return `<span class="class-logo ${info?.icon ? 'has-icon' : 'is-fallback'}" style="--cc:${attr(color)};width:${px}px;height:${px}px" title="${attr(label)}" aria-label="${attr(label)}" role="img">
    ${glyph}
  </span>`;
}

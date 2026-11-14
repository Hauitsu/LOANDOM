/* Inline SVG icons. Kept as tiny strings so views can stay declarative and the
   whole app ships without an icon font or CDN dependency. */

const wrap = (body, size = 16, extra = '') =>
  `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icons = {
  gold: (s = 16) =>
    wrap('<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5h5"/><path d="M9.5 14.5h5"/><path d="M12 6v12"/>', s),
  check: (s = 16) => wrap('<path d="M20 6 9 17l-5-5"/>', s),
  x: (s = 16) => wrap('<path d="M18 6 6 18M6 6l12 12"/>', s),
  plus: (s = 16) => wrap('<path d="M12 5v14M5 12h14"/>', s),
  minus: (s = 16) => wrap('<path d="M5 12h14"/>', s),
  trash: (s = 16) => wrap('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>', s),
  chevronLeft: (s = 16) => wrap('<path d="m15 18-6-6 6-6"/>', s),
  chevronRight: (s = 16) => wrap('<path d="m9 18 6-6-6-6"/>', s),
  chevronDown: (s = 16) => wrap('<path d="m6 9 6 6 6-6"/>', s),
  refresh: (s = 16) => wrap('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>', s),
  link: (s = 16) => wrap('<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>', s),
  settings: (s = 16) => wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>', s),
  users: (s = 16) => wrap('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>', s),
  sword: (s = 16) => wrap('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>', s),
  ledger: (s = 16) => wrap('<path d="M4 19.5V4a2 2 0 0 1 2-2h13v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/><path d="M8 7h8M8 11h8M8 15h5"/>', s),
  chart: (s = 16) => wrap('<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>', s),
  warning: (s = 16) => wrap('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>', s),
  info: (s = 16) => wrap('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>', s),
  cloud: (s = 16) => wrap('<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A3.5 3.5 0 0 0 6.5 19Z"/>', s),
  cloudOff: (s = 16) => wrap('<path d="M3 3l18 18"/><path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-4.2-4.8"/><path d="M6.4 6.4A6 6 0 0 0 6.4 17.9H16"/>', s),
  copy: (s = 16) => wrap('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', s),
  clipboard: (s = 16) => wrap('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3"/>', s),
  image: (s = 16) => wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>', s),
  download: (s = 16) => wrap('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>', s),
  upload: (s = 16) => wrap('<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>', s),
  search: (s = 16) => wrap('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', s),
  crown: (s = 16) => wrap('<path d="M3 7l4 4 5-7 5 7 4-4v12H3Z"/>', s),
  clock: (s = 16) => wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
  logout: (s = 16) => wrap('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>', s),
  key: (s = 16) => wrap('<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/><path d="m14 9 3 3"/>', s),
  spark: (s = 16) => wrap('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>', s),
};

/** Convenience for using an icon inside a template string. */
export const ico = (name, size = 16) => (icons[name] ? icons[name](size) : '');

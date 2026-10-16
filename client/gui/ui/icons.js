// Icon set: line icons (24x24, currentColor) + TeamSpeak-style coloured status icons.
const ICONS = {
  plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v5"/>',
  unplug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v5M3 3l18 18"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',
  micOff: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M3 3l18 18"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  headphonesOff: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3zM3 3l18 18"/>',
  speaker: '<path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  join: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  arrowIn: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor"/>',
};

function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    if (!el.dataset.hydrated) {
      el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
      el.dataset.hydrated = '1';
    }
  });
}

// ---------------------------------------------------------------- status icons

/** Channel icon: open (green), full (red), password (yellow), subchannel-capable look. */
function channelIcon(kind) {
  const col = { open: '#3ec46d', full: '#e5484d', locked: '#e8b339', denied: '#7b8193' }[kind] || '#3ec46d';
  return `<svg class="st" viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="13" rx="3.5" fill="${col}"/>
    <path d="M6 7.5h8M6 11h5" stroke="#0d1a12" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M6 16l-1.5 2.5L9 16z" fill="${col}"/></svg>`;
}

/** Client status icon like TeamSpeak's bubbles. */
function clientIcon(kind) {
  switch (kind) {
    case 'talking':
      return `<svg class="st talking" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#2f8cff"/>
        <path d="M6.5 8v4M10 5.5v9M13.5 7.5v5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'mic_muted':
      return `<svg class="st" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#3a1f24" stroke="#e5484d" stroke-width="1.4"/>
        <rect x="8" y="4.5" width="4" height="7" rx="2" fill="#e5484d"/><path d="M6 10a4 4 0 0 0 8 0M10 14v2M4.5 4.5l11 11" stroke="#e5484d" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`;
    case 'sound_muted':
      return `<svg class="st" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#3a1f24" stroke="#e5484d" stroke-width="1.4"/>
        <path d="M5 12V9.5a5 5 0 0 1 10 0V12" stroke="#e5484d" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <rect x="4" y="11" width="3" height="4" rx="1" fill="#e5484d"/><rect x="13" y="11" width="3" height="4" rx="1" fill="#e5484d"/>
        <path d="M4.5 4.5l11 11" stroke="#e5484d" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    case 'no_hw':
      return `<svg class="st" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#262b38" stroke="#7b8193" stroke-width="1.4"/>
        <rect x="8" y="4.5" width="4" height="7" rx="2" fill="#7b8193"/><path d="M4.5 4.5l11 11" stroke="#7b8193" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    case 'away':
      return `<svg class="st" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#3a3220" stroke="#e8b339" stroke-width="1.4"/>
        <path d="M13.5 11.6A4.5 4.5 0 1 1 8.4 6.5a3.5 3.5 0 0 0 5.1 5.1z" fill="#e8b339"/></svg>`;
    case 'no_talk':
      return `<svg class="st" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#262b38" stroke="#7b8193" stroke-width="1.4"/>
        <path d="M7 13V8.5M9.5 13V6.5M12 13V8M7 13h6" stroke="#9aa1b2" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    default: // idle
      return `<svg class="st" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#1b2a44" stroke="#2f8cff" stroke-width="1.4"/>
        <circle cx="10" cy="10" r="3" fill="#2f8cff"/></svg>`;
  }
}

/** Small coloured badge for a group (SA, CA, OP, ...). */
function groupBadge(name, kind) {
  const n = name.toLowerCase();
  let label, col;
  if (kind === 'server' && n.includes('admin')) { label = 'SA'; col = '#e5484d'; }
  else if (kind === 'channel' && n.includes('admin')) { label = 'CA'; col = '#3ec46d'; }
  else if (kind === 'channel' && n.includes('operator')) { label = 'OP'; col = '#2f8cff'; }
  else if (n === 'guest' || n === 'gast' || n === 'normal') return '';
  else { label = name.replace(/[^A-Za-z0-9ÄÖÜäöü]/g, '').slice(0, 2).toUpperCase() || '?'; col = '#8b5cf6'; }
  return `<span class="badge-g" style="--c:${col}" title="${kind === 'server' ? 'Servergruppe' : 'Channelgruppe'}: ${name.replace(/"/g, '&quot;')}">${label}</span>`;
}

ICONS.image = '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>';
ICONS.upload = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>';
ICONS.menu = '<path d="M4 6h16M4 12h16M4 18h16"/>';
ICONS.power = '<path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10"/>';

// ---------------------------------------------------------------- built-in icons
// Icon ids below 1000 are built in (no upload needed); uploaded icons use the
// CRC32 of the PNG as id, like TeamSpeak.
const BUILTIN_ICONS = {
  100: ['Krone', '#f5b301', '<path d="M3 17h18l-1.5-9-4.5 4-3-6-3 6-4.5-4z"/><rect x="3" y="18" width="18" height="2.5" rx="1"/>'],
  200: ['Schild', '#3b82f6', '<path d="M12 2 4 5v6c0 5.5 3.4 9.4 8 11 4.6-1.6 8-5.5 8-11V5z"/>'],
  300: ['Mikrofon', '#22c55e', '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0" fill="none" stroke="currentColor" stroke-width="2"/><rect x="11" y="16" width="2" height="5"/>'],
  500: ['Stern', '#ef4444', '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'],
  600: ['Person', '#94a3b8', '<circle cx="12" cy="8" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0z"/>'],
  700: ['Herz', '#ec4899', '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>'],
  701: ['Blitz', '#facc15', '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'],
  702: ['Flamme', '#f97316', '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3 1-6 1-8z"/>'],
  703: ['Diamant', '#22d3ee', '<path d="M6 3h12l4 6-10 12L2 9z"/>'],
  704: ['Controller', '#a855f7', '<path d="M7 7h10a5 5 0 0 1 4.8 6.4l-1 3.4a2.6 2.6 0 0 1-4.4 1L14 16h-4l-2.4 1.8a2.6 2.6 0 0 1-4.4-1l-1-3.4A5 5 0 0 1 7 7z"/>'],
  705: ['Musik', '#14b8a6', '<path d="M9 18V5l12-2v13" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'],
  706: ['Werkzeug', '#64748b', '<path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-2 2-2.4-2.3a4 4 0 0 1-5-5L5 16.6 7.4 19 3 21l2-4.4z"/>'],
  707: ['Flagge', '#3b82f6', '<path d="M5 22V3h12l-2 4 2 4H7v11z"/>'],
  708: ['Kaffee', '#a16207', '<path d="M3 8h14v6a6 6 0 0 1-12 0zM17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M6 2v3M10 2v3M14 2v3" stroke="currentColor" stroke-width="2"/>'],
  709: ['Roboter', '#10b981', '<rect x="4" y="7" width="16" height="13" rx="3"/><circle cx="9" cy="13" r="1.6" fill="#111"/><circle cx="15" cy="13" r="1.6" fill="#111"/><rect x="11" y="2" width="2" height="5"/>'],
  710: ['Auge', '#6366f1', '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3.2" fill="#111"/>'],
  711: ['Schloss', '#eab308', '<rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2.2"/>'],
  712: ['Globus', '#0ea5e9', '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" fill="none" stroke="#0b1220" stroke-width="1.4"/>'],
  713: ['Haken', '#22c55e', '<circle cx="12" cy="12" r="10"/><path d="m7 12.5 3.2 3L17 9" fill="none" stroke="#06240f" stroke-width="2.4"/>'],
  714: ['Totenkopf', '#e5e7eb', '<path d="M12 2a9 9 0 0 0-6 15.7V21h3v-2h2v2h2v-2h2v2h3v-3.3A9 9 0 0 0 12 2z"/><circle cx="8.5" cy="11" r="2" fill="#111"/><circle cx="15.5" cy="11" r="2" fill="#111"/>'],
  715: ['Megafon', '#f43f5e', '<path d="M3 10v4h3l9 5V5L6 10zM18 8.5a5 5 0 0 1 0 7"/>'],
  716: ['Pokal', '#f59e0b', '<path d="M7 3h10v5a5 5 0 0 1-10 0zM7 5H3a4 4 0 0 0 4 4M17 5h4a4 4 0 0 1-4 4M10 13h4l1 5H9zM7 19h10v3H7z"/>'],
  717: ['Rakete', '#8b5cf6', '<path d="M12 2c4 2 6 6 6 11l-3 3H9l-3-3c0-5 2-9 6-11zM9 16l-3 5 4-2M15 16l3 5-4-2"/><circle cx="12" cy="9" r="2" fill="#111"/>'],
  718: ['Wolke', '#7dd3fc', '<path d="M7 19a5 5 0 0 1-.5-10A6.5 6.5 0 0 1 19 9.5 4.8 4.8 0 0 1 18 19z"/>'],
};

/** Icon cache for uploaded icons: key `${conn}:${id}` -> data URL ('' = loading) */
const ICON_CACHE = new Map();

/** HTML for an icon id (built-in SVG or uploaded PNG). `fetcher(id)` loads unknown ones. */
function iconHtml(id, conn, fetcher, title = '') {
  id = Number(id) >>> 0;
  if (!id) return '';
  const t = title ? ` title="${String(title).replace(/"/g, '&quot;')}"` : '';
  const b = BUILTIN_ICONS[id];
  if (b) return `<svg class="ico" viewBox="0 0 24 24" style="color:${b[1]}" fill="currentColor"${t}>${b[2]}</svg>`;
  const key = `${conn}:${id}`;
  const url = ICON_CACHE.get(key);
  if (url) return `<img class="ico" src="${url}"${t}>`;
  if (url === undefined && fetcher) {
    ICON_CACHE.set(key, '');
    fetcher(id);
  }
  return `<span class="ico ico-missing"${t}></span>`;
}
ICONS.activity = '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>';

// Video / channel stage
Object.assign(ICONS, {
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  camera: '<path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  maximize: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
});

Object.assign(ICONS, {
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M9 17h6M2 13v3M22 13v3"/><circle cx="12" cy="3" r="1"/>',
});

// RustSpeak UI. Talks to the Rust backend via Tauri commands/events.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// UI options; replaced by the saved settings once settings.js has loaded
let UI = { app: {}, playback: {}, design: { groupText: true }, chat: { timestamps: true, events: true }, hotkeys: {} };

const state = {
  snap: null,
  treeJson: '',
  audio: null,
  convs: new Map(), // conn -> {tabs: Map, active}
  phases: new Map(), // conn -> last known phase (for sounds)
  selected: null, // {conn, type, id}
  multi: new Set(),
  connArgs: new Map(), // conn -> last connect arguments (for reconnects)
  lastTx: false,
  talkingIds: new Set(),
  lastMutedHint: 0, // Ctrl+click selected client ids (active connection)
  lastClick: { key: '', t: 0 },
  drag: null,
  permCache: new Map(), // conn -> permission list
  waiters: [],
  bannerKey: '',
};

// ------------------------------------------------------------------ helpers

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'poke' ? 9000 : 5000);
}

function colorFor(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 45%)`;
}

function bbcode(text) {
  let s = esc(text);
  s = s.replace(/\[url=([^\]]+)\](.*?)\[\/url\]/gi, (_, u, t) => `<a href="${u}" data-ext>${t}</a>`);
  s = s.replace(/\[url\](.*?)\[\/url\]/gi, (_, u) => `<a href="${/^https?:/i.test(u) ? u : 'https://' + u}" data-ext>${u}</a>`);
  s = s.replace(/\[b\](.*?)\[\/b\]/gi, '<b>$1</b>').replace(/\[i\](.*?)\[\/i\]/gi, '<i>$1</i>').replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
  s = s.replace(/\[\/?(color|size|center|left|right)[^\]]*\]/gi, '');
  return s;
}

/** Open a link in the system browser. */
function openExternal(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  invoke('plugin:opener|open_url', { url }).catch(e => toast(String(e), 'error'));
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-ext]');
  if (a) {
    e.preventDefault();
    openExternal(a.getAttribute('href'));
  }
});

const now = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function fmtDuration(ms) {
  let s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return (d ? `${d} T ` : '') + (h ? `${h} h ` : '') + (m ? `${m} min ` : '') + `${s} s`;
}
const fmtDate = unix => unix ? new Date(Number(unix) * 1000).toLocaleString('de-DE') : '–';
function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KiB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(2)} MiB`;
  return `${(n / 1024 ** 3).toFixed(2)} GiB`;
}
const fmtRate = n => `${fmtBytes(n)}/s`;
const fmtPct = v => `${(Number(v || 0) * 100).toFixed(2)} %`;

async function call(cmd, args) {
  try {
    return await invoke(cmd, args);
  } catch (e) {
    toast(String(e), 'error');
    throw e;
  }
}

const srv = () => state.snap?.server;
const activeConn = () => state.snap?.active ?? 0;
const connected = () => !!srv()?.connected;
const perm = name => srv()?.perms?.[name] ?? 0;
const can = name => perm(name) > 0;
const me = () => srv()?.clients.find(c => c.id === srv().own_id);
const clientById = id => srv()?.clients.find(c => c.id === id);
const channelById = id => srv()?.channels.find(c => c.id === id);

/** Send a protocol command to a connection (default: active). */
function ts(name, args = {}, label, conn = activeConn(), items) {
  const pairs = Object.entries(args).map(([k, v]) => [k, String(v)]);
  const its = items?.map(it => Object.entries(it).map(([k, v]) => [k, String(v)]));
  return call('ts_command', { conn, name, args: pairs, items: its ?? null, label: label ?? name });
}

/** Wait for a data notification (permission lists etc.). */
function waitNotify(name, conn = activeConn(), timeout = 2500) {
  return new Promise(resolve => {
    const w = { name, conn, resolve };
    state.waiters.push(w);
    setTimeout(() => {
      const i = state.waiters.indexOf(w);
      if (i >= 0) {
        state.waiters.splice(i, 1);
        resolve(null);
      }
    }, timeout);
  });
}

// ------------------------------------------------------------------ icons (uploaded ones are fetched on demand)

async function fetchIcon(id, conn = activeConn()) {
  ts('icondownload', { iconid: id }, 'Icon laden', conn);
  const items = await waitNotify('notifyicondownload', conn);
  const data = items?.[0]?.data;
  ICON_CACHE.set(`${conn}:${id}`, data ? `data:image/png;base64,${data}` : null);
  state.treeJson = '';
}
const ico = (id, title = '') => iconHtml(id, activeConn(), fetchIcon, title);

// ------------------------------------------------------------------ chat

function conv(conn) {
  if (!state.convs.has(conn)) {
    const tabs = new Map();
    tabs.set('server', { id: 'server', title: 'Server', kind: 'server', messages: [], unread: 0 });
    tabs.set('channel', { id: 'channel', title: 'Channel', kind: 'channel', messages: [], unread: 0 });
    state.convs.set(conn, { tabs, active: 'server' });
  }
  return state.convs.get(conn);
}

function ensureTab(conn, id, title, kind, partner) {
  const c = conv(conn);
  if (!c.tabs.has(id)) c.tabs.set(id, { id, title, kind, partner, messages: [], unread: 0 });
  return c.tabs.get(id);
}

/** Log lines that are not errors but deserve attention (shown yellow). */
const WARN_RE = /(Verbindung verloren|getrennt|Timeout|antwortet nicht|geworfen|gekickt|gebannt|verweigert|fehlgeschlagen|nicht erreichbar|erneut verbinden|Reconnect|Warnung)/i;

function addMessage(conn, tabId, msg) {
  const c = conv(conn);
  const tab = c.tabs.get(tabId);
  if (!tab) return;
  if (msg.kind === 'info' && WARN_RE.test(msg.text)) msg = { ...msg, kind: 'warn' };
  tab.messages.push({ time: now(), ...msg });
  if (tab.messages.length > 500) tab.messages.shift();
  if (c.active !== tabId || conn !== activeConn()) tab.unread++;
  if (conn === activeConn()) {
    renderTabs();
    if (c.active === tabId) renderMessages(true);
  }
  renderServerTabs();
}

function renderTabs() {
  const conn = activeConn();
  const c = conv(conn);
  const nav = $('#tabs');
  nav.innerHTML = '';
  for (const t of c.tabs.values()) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === c.active ? ' active' : '');
    const ic = t.kind === 'server' ? 'server' : t.kind === 'channel' ? 'hash' : 'user';
    let title = t.title;
    if (t.kind === 'channel') title = displayName(channelById(me()?.channel)) || 'Channel';
    if (t.kind === 'private') title = clientById(t.partner)?.nickname || t.title;
    el.innerHTML = `${icon(ic)}<span>${esc(title)}</span>` + (t.unread ? `<span class="unread">${t.unread}</span>` : '') +
      (t.kind === 'private' ? `<span class="x" title="Schließen">${icon('close')}</span>` : '');
    el.onclick = e => {
      if (e.target.closest('.x')) {
        c.tabs.delete(t.id);
        if (c.active === t.id) c.active = 'server';
      } else {
        c.active = t.id;
        t.unread = 0;
      }
      renderTabs();
      renderMessages(true);
      updateChatInput();
      renderServerTabs();
    };
    nav.appendChild(el);
  }
}

function renderMessages(scroll) {
  const box = $('#messages');
  const c = conv(activeConn());
  const tab = c.tabs.get(c.active) || c.tabs.get('server');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = tab.messages.map(m => {
    const who = m.who ? `<span class="who" style="color:${colorFor(m.who)}">${esc(m.who)}</span>` : '';
    return `<div class="msg ${m.kind || ''}"><span class="time">${m.time}</span><div class="body">${who}${bbcode(m.text)}</div></div>`;
  }).join('');
  if (scroll || atBottom) box.scrollTop = box.scrollHeight;
}

function updateChatInput() {
  const input = $('#chat-text');
  const on = connected();
  input.disabled = !on;
  $('#chat-send').disabled = !on;
  const c = conv(activeConn());
  const tab = c.tabs.get(c.active) || c.tabs.get('server');
  if (!on) input.placeholder = 'Nicht verbunden';
  else if (tab.kind === 'server') input.placeholder = 'Nachricht an alle auf dem Server …';
  else if (tab.kind === 'channel') input.placeholder = 'Nachricht an deinen Channel …';
  else input.placeholder = `Private Nachricht an ${clientById(tab.partner)?.nickname || tab.title} …`;
}

$('#chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('#chat-text').value.trim();
  if (!text) return;
  const c = conv(activeConn());
  const tab = c.tabs.get(c.active);
  if (tab.kind === 'server') ts('sendtextmessage', { targetmode: 3, target: 0, msg: text }, 'Servernachricht');
  else if (tab.kind === 'channel') ts('sendtextmessage', { targetmode: 2, target: 0, msg: text }, 'Channelnachricht');
  else ts('sendtextmessage', { targetmode: 1, target: tab.partner, msg: text }, 'Private Nachricht');
  $('#chat-text').value = '';
});

function clearChat() {
  const c = conv(activeConn());
  const tab = c.tabs.get(c.active);
  if (tab) tab.messages = [];
  renderMessages(true);
}

function openPrivate(clid) {
  const conn = activeConn();
  const c = clientById(clid);
  const id = `pm:${clid}`;
  ensureTab(conn, id, c ? c.nickname : `Client ${clid}`, 'private', clid);
  conv(conn).active = id;
  conv(conn).tabs.get(id).unread = 0;
  renderTabs();
  renderMessages(true);
  updateChatInput();
  $('#chat-text').focus();
}

// ------------------------------------------------------------------ events from Rust

listen('log', ({ payload }) => {
  const { conn, kind, partner, text } = payload;
  const m = /^\[(channel|private|server)\] <(.+?)> ([\s\S]*)$/.exec(text);
  if (kind === 'channel' && m) {
    if (UI.app.autoOpenChannelChat && conn === activeConn()) conv(conn).active = 'channel';
    return addMessage(conn, 'channel', { who: m[2], text: m[3] });
  }
  if (kind === 'private' && m && partner && Blocked.has(clientById(partner)) && m[2] !== me()?.nickname) return;
  if (kind === 'private' && m) {
    ensureTab(conn, `pm:${partner}`, m[2], 'private', partner);
    return addMessage(conn, `pm:${partner}`, { who: m[2], text: m[3] });
  }
  if (kind === 'server' && m) return addMessage(conn, 'server', { who: m[2], text: m[3] });
  if (kind === 'poke') {
    if (UI.app.noPokeDialog) toast(text, 'poke');
    else pokeDialog(conn, text);
  }
  if (kind === 'error' && !text.includes('database empty result set')) {
    toast(text, 'error');
    if (conn === activeConn()) Sounds.play(/id 2568|insufficient|permission/i.test(text) ? 'insufficient_permissions' : 'error');
  }
  addMessage(conn, 'server', { kind: kind === 'error' ? 'error' : kind === 'poke' ? 'poke' : kind === 'server' ? '' : 'info', text });
  if (kind === 'info' && UI.chat.events && /(wechselte|verschoben|verbunden|verlassen|Verbindung verloren|geworfen|gekickt|gebannt)/.test(text)) {
    addMessage(conn, 'channel', { kind: 'info', text });
  }
});

listen('status', ({ payload }) => {
  if (payload.conn === activeConn()) setStatus('busy', payload.text);
});

listen('connected', ({ payload }) => {
  state.phases.set(payload.conn, 'connected');
  Sounds.play('connected');
  if (payload.conn === activeConn()) setStatus('on', 'Verbunden');
});

listen('disconnected', ({ payload }) => {
  const { conn, text } = payload;
  Video.stopAll(conn);
  const was = state.phases.get(conn);
  state.phases.set(conn, 'disconnected');
  let sound = 'disconnected';
  if (/gekickt/.test(text)) sound = 'kicked_server';
  else if (/gebannt|banned/.test(text)) sound = 'banned';
  else if (/Timeout|antwortet nicht/.test(text)) sound = 'connection_lost';
  else if (was !== 'connected') sound = 'connect_failed';
  Sounds.play(sound);
  addMessage(conn, 'server', { kind: was === 'connected' ? 'info' : 'error', text: `Verbindung beendet: ${text}` });
  if (was !== 'connected' || sound !== 'disconnected') toast(sound === 'connect_failed' ? `Verbindung fehlgeschlagen: ${text}` : `Getrennt: ${text}`, 'error');
  if (conn === activeConn()) setStatus('off', `Nicht verbunden – ${text}`);
  // Auto-reconnect after a lost connection (not after kicks, bans or leaving on purpose)
  if (UI.app.autoReconnect && sound === 'connection_lost' && state.connArgs.has(conn)) {
    addMessage(conn, 'server', { kind: 'info', text: 'Neu verbinden in 5 Sekunden …' });
    setTimeout(() => {
      if (state.snap?.connections.some(c => c.id === conn && c.phase === 'disconnected')) {
        call('connect', { args: { ...state.connArgs.get(conn), conn } }).then(() => state.phases.set(conn, 'connecting')).catch(() => {});
      }
    }, 5000);
  }
});

listen('sound', ({ payload }) => {
  // Other servers only make noise for things aimed at us personally.
  if (payload.conn !== activeConn() && !['poked', 'message_private', 'you_were_moved', 'you_kicked_channel'].includes(payload.text)) return;
  if (Blocked.hasUid(payload.uid)) {
    if (payload.blocked) return Sounds.play(payload.blocked);
    if (['poked', 'message_private', 'message_channel', 'message_server', 'user_connected', 'user_disconnected'].includes(payload.text)) return;
  }
  Sounds.play(payload.text);
});

listen('notify', ({ payload }) => {
  for (const w of [...state.waiters]) {
    if (w.name === payload.name && w.conn === payload.conn) {
      state.waiters.splice(state.waiters.indexOf(w), 1);
      w.resolve(payload.items);
    }
  }
});

function setStatus(kind, text) {
  $('#status-dot').className = `dot ${kind}`;
  $('#status-text').textContent = text;
}

// ------------------------------------------------------------------ toolbar / server tabs

function updateButtons() {
  const on = connected();
  const phase = srv()?.phase;
  $('#btn-disconnect').disabled = !srv() || phase === 'disconnected';
  $('#btn-away').disabled = !on;
  $('#btn-new-channel').disabled = !on;
  const a = state.audio || {};
  const mic = $('#btn-mic'), spk = $('#btn-speaker'), away = $('#btn-away');
  mic.classList.toggle('active-bad', !!a.mic_muted);
  spk.classList.toggle('active-bad', !!a.speaker_muted);
  mic.querySelector('.ti').innerHTML = icon(a.mic_muted ? 'micOff' : 'mic');
  spk.querySelector('.ti').innerHTML = icon(a.speaker_muted ? 'headphonesOff' : 'headphones');
  mic.querySelector('.tl').textContent = a.mic_muted ? 'Mikro aus' : 'Mikrofon';
  spk.querySelector('.tl').textContent = a.speaker_muted ? 'Ton aus' : 'Lautsprecher';
  away.classList.toggle('active-warn', !!me()?.away);
  away.querySelector('.tl').textContent = me()?.away ? 'Abwesend' : 'Anwesend';
  const modes = { va: a.vad_ai ? 'Sprachaktivierung (KI)' : 'Sprachaktivierung', ptt: 'Push-to-Talk', always: 'Dauerhaft senden' };
  $('#mode-label').textContent = (a.noise_suppression ? 'RNNoise · ' : '') + (modes[a.mode] || '');
}

function renderServerTabs() {
  const nav = $('#server-tabs');
  const conns = state.snap?.connections || [];
  if (conns.length <= 1) {
    nav.innerHTML = '';
    return;
  }
  nav.innerHTML = conns.map(c => {
    const unread = [...conv(c.id).tabs.values()].reduce((n, t) => n + t.unread, 0);
    const dot = c.phase === 'connected' ? 'on' : c.phase === 'connecting' ? 'busy' : 'off';
    return `<div class="stab${c.id === activeConn() ? ' active' : ''}" data-conn="${c.id}" title="${esc(c.address)}">
      <span class="dot ${dot}"></span><span class="name">${esc(c.server_name || c.address)}</span>
      ${unread && c.id !== activeConn() ? `<span class="tab"><span class="unread">${unread}</span></span>` : ''}
      <span class="x" title="Tab schließen">${icon('close')}</span></div>`;
  }).join('') + `<div class="stab-add" title="Neue Verbindung">${icon('plus')}</div>`;
}

$('#server-tabs').addEventListener('click', async e => {
  if (e.target.closest('.stab-add')) return openConnect(true);
  const tab = e.target.closest('.stab');
  if (!tab) return;
  const conn = Number(tab.dataset.conn);
  if (e.target.closest('.x')) {
    await call('close_connection', { conn });
    state.convs.delete(conn);
  } else {
    await call('set_active', { conn });
    if (UI.app.micOnTabSwitch && state.audio.mic_muted) toggleMic();
  }
  state.multi.clear();
  state.treeJson = '';
  await poll(true);
  renderTabs();
  renderMessages(true);
  updateChatInput();
});

// ------------------------------------------------------------------ tree

/** TeamSpeak spacer channels: [spacer], [cspacer], [rspacer], [*spacer] (repeat). */
function parseSpacer(ch) {
  if (!ch || ch.parent !== 0) return null;
  const m = /^\[([lcr*]?)spacer[^\]]*\](.*)$/i.exec(ch.name);
  if (!m) return null;
  return { align: m[1].toLowerCase() || 'l', text: m[2] };
}
const displayName = ch => {
  if (!ch) return '';
  const sp = parseSpacer(ch);
  return sp ? (sp.text.trim() || 'Trenner') : ch.name;
};

function clientStatus(c, ch) {
  if (c.talking) return 'talking';
  if (c.away) return 'away';
  if (c.output_muted) return 'sound_muted';
  if (c.input_muted) return 'mic_muted';
  if (!c.input_hardware) return 'no_hw';
  if (ch && ch.needed_talk_power > 0 && c.talk_power < ch.needed_talk_power) return 'no_talk';
  return 'idle';
}

/** TeamSpeak "show name in tree": [Group] before (1) or after (2) the nickname. */
function groupNames(c, s, mode) {
  const out = [];
  for (const id of c.server_groups) {
    const g = s.server_groups.find(g => g.id === id);
    if (g?.name_mode === mode) out.push(g.name);
  }
  const cg = s.channel_groups.find(g => g.id === c.channel_group);
  if (cg?.name_mode === mode) out.push(cg.name);
  if (!out.length) return '';
  const t = out.map(n => '[' + esc(n) + ']').join(' ');
  return mode === 1 ? '<span class="gname-tag">' + t + '</span> ' : ' <span class="gname-tag">' + t + '</span>';
}

function groupMarks(c, s) {
  const out = [];
  for (const id of c.server_groups) {
    const g = s.server_groups.find(g => g.id === id);
    if (!g) continue;
    out.push(g.icon_id ? ico(g.icon_id, `Servergruppe: ${g.name}`) : UI.design.groupText ? groupBadge(g.name, 'server') : '');
  }
  const cg = s.channel_groups.find(g => g.id === c.channel_group);
  if (cg) out.push(cg.icon_id ? ico(cg.icon_id, `Channelgruppe: ${cg.name}`) : UI.design.groupText ? groupBadge(cg.name, 'channel') : '');
  return out.join('');
}

/** Video kinds a client is streaming on the active connection (0 = screen, 1 = camera). */
function liveKinds(clid) {
  if (typeof Video === 'undefined') return [];
  const s = Video.sessions.get(activeConn());
  if (!s) return [];
  if (clid === srv()?.own_id) return [...s.pubs.keys()];
  return s.list.filter(x => x.clid === clid).map(x => x.kind);
}

function renderTree() {
  const s = srv();
  const tree = $('#tree');
  if (!s || !s.connected) {
    const msg = s?.phase === 'connecting' ? `Verbinde mit ${esc(s.address)} …` : 'Du bist mit keinem Server verbunden.';
    tree.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('server')}</div><p>${msg}</p>
      ${s?.phase === 'connecting' ? '' : `<button class="tb-btn primary" data-action="connect">${icon('plug')}${s ? 'Erneut verbinden' : 'Verbinden …'}</button>`}</div>`;
    $('#server-title').textContent = s?.phase === 'connecting' ? 'Verbinde …' : 'Nicht verbunden';
    return;
  }
  $('#server-title').textContent = s.server_name || 'Server';
  const mine = me();
  const sel = state.selected?.conn === s.conn ? state.selected : null;
  let html = `<div class="node server${sel?.type === 'server' ? ' selected' : ''}" data-type="server" data-id="0">${icon('server')}<span class="name">${esc(s.server_name)}</span>
    <span class="flags"><span class="count">${s.clients.length}</span></span></div>`;
  for (const ch of s.channels) {
    const pad = 10 + ch.depth * 18;
    const members = s.clients.filter(c => c.channel === ch.id).sort((a, b) => b.talk_power - a.talk_power || a.nickname.localeCompare(b.nickname));
    const selCls = `${mine?.channel === ch.id ? ' mine' : ''}${sel?.type === 'channel' && sel.id === ch.id ? ' selected' : ''}`;
    const sp = parseSpacer(ch);
    if (sp) {
      const inner = sp.align === '*'
        ? `<span class="sp-fill">${esc(sp.text || '-').repeat(300)}</span>`
        : `<span class="sp-text">${esc(sp.text)}</span>`;
      html += `<div class="node channel spacer sp-${sp.align === '*' ? 'fill' : sp.align}${selCls}" data-type="channel" data-id="${ch.id}" title="${esc(ch.topic)}">${inner}</div>`;
    } else {
      const full = ch.max_clients >= 0 && members.length >= ch.max_clients;
      const denied = ch.needed_join_power > 0 && perm('i_channel_join_power') < ch.needed_join_power;
      const kind = full ? 'full' : denied ? 'denied' : ch.has_password ? 'locked' : 'open';
      const flags = [
        ch.is_default ? `<span title="Standardchannel">${icon('home')}</span>` : '',
        ch.has_password ? `<span title="Passwortgeschützt">${icon('lock')}</span>` : '',
        ch.codec_quality >= 8 ? `<span title="Hohe Sprachqualität">${icon('music')}</span>` : '',
        ch.needed_talk_power > 0 ? `<span title="Moderiert (Sprechkraft ${ch.needed_talk_power})">${icon('hand')}</span>` : '',
        ch.icon_id ? ico(ch.icon_id, 'Channel-Icon') : '',
        `<span class="count">${ch.max_clients >= 0 ? `${members.length}/${ch.max_clients}` : (members.length || '')}</span>`,
      ].join('');
      html += `<div class="node channel${selCls}" data-type="channel" data-id="${ch.id}" style="padding-left:${pad}px" title="${esc(ch.topic)}">
        ${channelIcon(kind)}<span class="name">${esc(ch.name)}</span><span class="flags">${flags}</span></div>`;
    }
    for (const c of members) {
      const isMe = c.id === s.own_id;
      const csel = (sel?.type === 'client' && sel.id === c.id) || state.multi.has(c.id);
      const extra = [
        c.recording ? `<span title="Nimmt auf" style="color:var(--bad)">${icon('dot')}</span>` : '',
        liveKinds(c.id).map(k => `<span class="live-ic" title="${k ? 'Webcam' : 'Bildschirm'} wird übertragen">${icon(k ? 'camera' : 'monitor')}</span>`).join(''),
        c.platform === 'Bot' ? `<span class="bot-badge" title="Bot">BOT</span>` : '',
        Blocked.has(c) ? `<span class="blocked-ic" title="Blockiert">${icon('eyeoff')}</span>` : '',
        c.description ? `<span title="${esc(c.description)}">${icon('info')}</span>` : '',
      ].join('');
      html += `<div class="node client${isMe ? ' me' : ''}${Blocked.has(c) ? ' blocked' : ''}${csel ? ' selected' : ''}${state.multi.has(c.id) ? ' multi' : ''}" data-type="client" data-id="${c.id}" style="padding-left:${(sp ? 10 : pad) + 20}px">
        ${clientIcon(clientStatus(c, ch))}<span class="name">${groupNames(c, s, 1)}${esc(c.nickname)}${groupNames(c, s, 2)}</span>
        ${c.away && c.away_msg ? `<span class="away-msg">[${esc(c.away_msg)}]</span>` : ''}
        <span class="flags">${extra}${groupMarks(c, s)}</span></div>`;
    }
  }
  tree.innerHTML = html;
}

// Stable click / double-click handling (the tree re-renders often while people talk).
$('#tree').addEventListener('mousedown', e => {
  if (e.button === 1 && UI.app.middleClick) {
    // Middle mouse button: quick access (join channel / private message)
    e.preventDefault();
    const n = e.target.closest('.node');
    if (n?.dataset.type === 'channel') joinChannel(Number(n.dataset.id));
    if (n?.dataset.type === 'client' && Number(n.dataset.id) !== srv().own_id) openPrivate(Number(n.dataset.id));
    return;
  }
  if (e.button !== 0) return;
  if (e.target.closest('[data-action="connect"]')) return reconnectOrOpen();
  const n = e.target.closest('.node');
  if (!n) return;
  const type = n.dataset.type, id = Number(n.dataset.id);
  if (e.ctrlKey && type === 'client') {
    // Ctrl+click: multi selection (e.g. to give several clients groups at once)
    if (state.multi.size === 0 && state.selected?.type === 'client' && state.selected.conn === activeConn()) state.multi.add(state.selected.id);
    state.multi.has(id) ? state.multi.delete(id) : state.multi.add(id);
    renderTree();
    return;
  }
  state.multi.clear();
  const key = `${type}:${id}`;
  const t = performance.now();
  const dbl = state.lastClick.key === key && t - state.lastClick.t < 400;
  state.lastClick = dbl ? { key: '', t: 0 } : { key, t };
  select(type, id);
  if (dbl) {
    if (type === 'channel') joinChannel(id);
    if (type === 'client' && id !== srv().own_id) openPrivate(id);
    return;
  }
  if (type === 'client') state.drag = { clid: id, x: e.clientX, y: e.clientY, active: false };
});

function select(type, id) {
  const conn = activeConn();
  const changed = !(state.selected?.conn === conn && state.selected.type === type && state.selected.id === id);
  state.selected = { conn, type, id };
  // Clicking your own channel turns the info area into the channel stage (video)
  if (type === 'channel' && id === me()?.channel && !parseSpacer(channelById(id))) Stage.show();
  else Stage.hide();
  renderTree();
  renderInfo();
  if (!changed) return;
  // Fetch details for the info panel
  if (type === 'client') ts('clientgetvariables', { clid: id }, 'Clientinfo');
  if (type === 'channel' && channelById(id)?.description == null) ts('channelgetdescription', { cid: id }, 'Channelbeschreibung');
  if (type === 'server') ts('servergetvariables', {}, 'Serverinfo');
}

window.addEventListener('mousemove', e => {
  const d = state.drag;
  if (!d) return;
  if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
    d.active = true;
    const c = clientById(d.clid);
    const g = $('#drag-ghost');
    g.innerHTML = `${clientIcon('idle')}<span>${esc(c?.nickname || '')}</span>`;
    g.hidden = false;
  }
  if (!d.active) return;
  const g = $('#drag-ghost');
  g.style.left = e.clientX + 12 + 'px';
  g.style.top = e.clientY + 8 + 'px';
  document.querySelectorAll('.node.drop-target').forEach(n => n.classList.remove('drop-target'));
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node.channel');
  if (target) target.classList.add('drop-target');
});

window.addEventListener('mouseup', e => {
  const d = state.drag;
  state.drag = null;
  if (!d?.active) return;
  $('#drag-ghost').hidden = true;
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node.channel');
  document.querySelectorAll('.node.drop-target').forEach(n => n.classList.remove('drop-target'));
  if (!target) return;
  const cid = Number(target.dataset.id);
  if (d.clid === srv().own_id) joinChannel(cid);
  else ts('clientmove', { clid: d.clid, cid }, 'Client verschieben');
});

// ------------------------------------------------------------------ banner + info panel

const isWebUrl = u => /^https?:\/\/[^\s]+$/i.test(u || '');

function renderBanner() {
  const s = srv();
  const i = s?.connected ? s.server_info || {} : {};
  // Banners are external links only (also guards against servers sending data: or file: URLs).
  const gfx = isWebUrl(i.virtualserver_hostbanner_gfx_url) ? i.virtualserver_hostbanner_gfx_url : '';
  const link = isWebUrl(i.virtualserver_hostbanner_url) ? i.virtualserver_hostbanner_url : '';
  const box = $('#banner');
  const key = `${s?.conn}|${gfx}|${link}|${i.virtualserver_hostbanner_mode}`;
  if (key === state.bannerKey) return;
  state.bannerKey = key;
  clearInterval(state.bannerTimer);
  box.hidden = !gfx;
  if (!gfx) return;
  const img = $('#banner-img');
  img.src = gfx;
  box.className = `banner mode-${i.virtualserver_hostbanner_mode ?? 2}`;
  box.title = link || '';
  box.style.cursor = link ? 'pointer' : 'default';
  box.onclick = () => link && openExternal(link);
  const interval = Number(i.virtualserver_hostbanner_gfx_interval || 0);
  if (interval >= 60) {
    state.bannerTimer = setInterval(() => (img.src = gfx + (gfx.includes('?') ? '&' : '?') + '_=' + Date.now()), interval * 1000);
  }
}

function setHtml(el, html) {
  if (el._html !== html) {
    el._html = html;
    el.innerHTML = html;
  }
}

function renderInfo() {
  renderBanner();
  const box = { set innerHTML(h) { setHtml($('#info'), h); } };
  const s = srv();
  const sel = state.selected?.conn === s?.conn ? state.selected : null;
  if (!s || !s.connected) {
    box.innerHTML = `<h3>${icon('info')}RustSpeak</h3><div class="sub">Ein freier Client für das TeamSpeak-3-Protokoll.</div>
      <div class="grid"><span class="k">Tipp</span><span class="v">Doppelklick auf einen Channel betritt ihn, Rechtsklick öffnet das Menü, Clients lassen sich per Drag &amp; Drop verschieben, Strg+Klick wählt mehrere Clients.</span>
      <span class="k">Tastenkürzel</span><span class="v">Strg+M Mikrofon, Strg+D Lautsprecher</span></div>`;
    return;
  }
  const sgList = ids => ids.map(id => {
    const g = s.server_groups.find(g => g.id === id);
    return g ? `<span class="gchip">${g.icon_id ? ico(g.icon_id) : ''}${esc(g.name)}</span>` : `#${id}`;
  }).join(' ');
  const cg = id => {
    const g = s.channel_groups.find(g => g.id === id);
    return g ? `<span class="gchip">${g.icon_id ? ico(g.icon_id) : ''}${esc(g.name)}</span>` : `#${id}`;
  };
  if (sel?.type === 'client' && clientById(sel.id)) {
    const c = clientById(sel.id);
    const ch = channelById(c.channel);
    const x = c.extra || {};
    box.innerHTML = `<h3><span class="avatar-big" style="background:${colorFor(c.uid || c.nickname)}">${esc(c.nickname.slice(0, 1).toUpperCase())}</span>${esc(c.nickname)}${c.id === s.own_id ? ' <span class="sub">(du)</span>' : ''}</h3>
      <div class="sub">${esc(c.uid)}</div>
      <div class="grid">
        <span class="k">Servergruppen</span><span class="v">${sgList(c.server_groups)}</span>
        <span class="k">Channelgruppe</span><span class="v">${cg(c.channel_group)} in „${esc(displayName(ch))}“</span>
        <span class="k">Sprechkraft</span><span class="v">${c.talk_power}${ch?.needed_talk_power ? ` (benötigt ${ch.needed_talk_power})` : ''}</span>
        <span class="k">Version</span><span class="v">${esc(c.version || '–')} ${c.platform ? `auf ${esc(c.platform)}` : ''}</span>
        ${x.connection_connected_time ? `<span class="k">Verbunden seit</span><span class="v">${fmtDuration(Number(x.connection_connected_time))}</span>` : ''}
        ${x.client_idle_time ? `<span class="k">Untätig seit</span><span class="v">${fmtDuration(Number(x.client_idle_time))}</span>` : ''}
        ${x.client_created ? `<span class="k">Erstmals gesehen</span><span class="v">${fmtDate(x.client_created)}</span>` : ''}
        ${x.client_totalconnections ? `<span class="k">Verbindungen</span><span class="v">${x.client_totalconnections}</span>` : ''}
        ${c.away ? `<span class="k">Abwesend</span><span class="v">${esc(c.away_msg || 'ja')}</span>` : ''}
        <span class="k">Status</span><span class="v">${[c.input_muted && 'Mikrofon stumm', c.output_muted && 'Lautsprecher stumm', !c.input_hardware && 'kein Mikrofon', c.recording && 'nimmt auf'].filter(Boolean).join(', ') || 'normal'}</span>
      </div>
      ${c.description ? `<div class="desc">${bbcode(c.description)}</div>` : ''}
      <div class="actions">
        ${c.id !== s.own_id ? `<button class="tb-btn small" data-act="pm">${icon('message')}Nachricht</button>
        <button class="tb-btn small" data-act="poke">${icon('hand')}Anstupsen</button>
        ${perm('i_client_move_power') > 0 && c.channel !== me()?.channel ? `<button class="tb-btn small" data-act="pull">${icon('arrowIn')}In meinen Channel</button>` : ''}` : ''}
        <button class="tb-btn small" data-act="conninfo">${icon('activity')}Verbindungsinfo</button>
      </div>`;
    return;
  }
  if (sel?.type === 'channel' && channelById(sel.id)) {
    const ch = channelById(sel.id);
    const members = s.clients.filter(c => c.channel === ch.id);
    const type = ch.permanent ? 'Permanent' : ch.semi_permanent ? 'Semi-permanent' : 'Temporär';
    box.innerHTML = `<h3>${parseSpacer(ch) ? icon('menu') : channelIcon(ch.has_password ? 'locked' : 'open')}${esc(displayName(ch))}${ch.icon_id ? ico(ch.icon_id) : ''}</h3>
      <div class="sub">${esc(ch.topic || (parseSpacer(ch) ? 'Trennerchannel' : 'Kein Thema'))}</div>
      <div class="grid">
        <span class="k">Typ</span><span class="v">${type}${ch.is_default ? ', Standardchannel' : ''}${ch.has_password ? ', passwortgeschützt' : ''}</span>
        <span class="k">Clients</span><span class="v">${members.length}${ch.max_clients >= 0 ? ` / ${ch.max_clients}` : ' (unbegrenzt)'}</span>
        <span class="k">Codec</span><span class="v">Opus Voice, Qualität ${ch.codec_quality}</span>
        ${ch.needed_talk_power ? `<span class="k">Benötigte Sprechkraft</span><span class="v">${ch.needed_talk_power}</span>` : ''}
        ${ch.needed_join_power ? `<span class="k">Benötigte Beitrittskraft</span><span class="v">${ch.needed_join_power}</span>` : ''}
      </div>
      ${ch.description ? `<div class="desc">${bbcode(ch.description)}</div>` : ''}
      <div class="actions">
        ${me()?.channel !== ch.id ? `<button class="tb-btn small" data-act="join">${icon('join')}Betreten</button>` : `<button class="tb-btn small primary" data-act="stage">${icon('monitor')}Channel-Ansicht</button>`}
        <button class="tb-btn small" data-act="edit">${icon('edit')}Bearbeiten</button>
      </div>`;
    return;
  }
  const i = s.server_info || {};
  box.innerHTML = `<h3>${icon('server')}${esc(s.server_name)}</h3>
    <div class="sub">${esc(s.address)}</div>
    <div class="grid">
      <span class="k">Version</span><span class="v">${esc(i.virtualserver_version || '–')} ${i.virtualserver_platform ? `(${esc(i.virtualserver_platform)})` : ''}</span>
      <span class="k">Clients</span><span class="v">${s.clients.length}${i.virtualserver_maxclients ? ` / ${i.virtualserver_maxclients}` : ''}</span>
      <span class="k">Channels</span><span class="v">${s.channels.length}</span>
      ${i.virtualserver_uptime ? `<span class="k">Laufzeit</span><span class="v">${fmtDuration(Number(i.virtualserver_uptime) * 1000)}</span>` : ''}
      ${i.virtualserver_created ? `<span class="k">Erstellt</span><span class="v">${fmtDate(i.virtualserver_created)}</span>` : ''}
      <span class="k">Ping</span><span class="v">${s.ping_ms != null ? Math.round(s.ping_ms) + ' ms' : '–'}</span>
      <span class="k">Deine Gruppen</span><span class="v">${sgList(me()?.server_groups || [])}</span>
    </div>
    ${i.virtualserver_welcomemessage ? `<div class="desc">${bbcode(i.virtualserver_welcomemessage)}</div>` : ''}`;
}

// Info panel buttons (delegated, so a redraw never swallows a click)
$('#info').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  const sel = state.selected;
  if (!b || !sel) return;
  const c = clientById(sel.id), ch = channelById(sel.id);
  switch (b.dataset.act) {
    case 'pm': return openPrivate(sel.id);
    case 'poke': return c && poke(c);
    case 'pull': return ts('clientmove', { clid: sel.id, cid: me().channel }, 'Client verschieben');
    case 'conninfo': return connectionInfo(sel.id);
    case 'join': return joinChannel(sel.id);
    case 'stage': return Stage.show();
    case 'edit': return ch && channelDialog(ch);
  }
});

// ------------------------------------------------------------------ context menus

function showMenu(x, y, items, el = $('#ctx')) {
  el.innerHTML = '';
  if (el === $('#ctx')) $('#ctx-sub').hidden = true;
  for (const it of items) {
    if (it === '-') {
      el.appendChild(document.createElement('hr'));
      continue;
    }
    if (it.title) {
      el.insertAdjacentHTML('beforeend', `<div class="ctx-title">${esc(it.title)}</div>`);
      continue;
    }
    const b = document.createElement('button');
    b.className = it.danger ? 'danger' : '';
    b.disabled = !!it.disabled;
    const ic = it.check !== undefined ? icon('check', it.check ? 'checkmark' : 'blank') : it.html ? it.html : icon(it.icon || 'dot', it.icon ? '' : 'blank');
    b.innerHTML = `${ic}<span>${esc(it.label)}</span>${it.key ? `<span class="kbd">${esc(it.key)}</span>` : ''}${it.sub ? `<span class="sub-arrow">${icon('chevron')}</span>` : ''}`;
    if (it.sub) {
      b.onmouseenter = b.onclick = () => {
        el.querySelectorAll('button.open').forEach(o => o.classList.remove('open'));
        b.classList.add('open');
        const r = b.getBoundingClientRect();
        showMenu(r.right + 2, r.top - 5, it.sub(), $('#ctx-sub'));
      };
    } else {
      b.onmouseenter = () => {
        if (el === $('#ctx')) {
          $('#ctx-sub').hidden = true;
          el.querySelectorAll('button.open').forEach(o => o.classList.remove('open'));
        }
      };
      b.onclick = () => {
        if (it.keepOpen) return it.action(b);
        hideMenus();
        it.action();
      };
    }
    el.appendChild(b);
  }
  el.hidden = false;
  const r = el.getBoundingClientRect();
  el.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 8)) + 'px';
  el.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 8)) + 'px';
}

function hideMenus() {
  $('#ctx').hidden = true;
  $('#ctx-sub').hidden = true;
  document.querySelectorAll('.menu-btn.open').forEach(b => b.classList.remove('open'));
}
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.ctx') && !e.target.closest('.menu-btn')) hideMenus();
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') hideMenus();
});

$('#tree').addEventListener('contextmenu', e => {
  e.preventDefault();
  const n = e.target.closest('.node');
  if (!n || !connected()) return;
  const id = Number(n.dataset.id);
  const type = n.dataset.type;
  // Right-click on one of several selected clients acts on all of them.
  if (type === 'client' && state.multi.size > 1 && state.multi.has(id)) {
    const list = [...state.multi].map(clientById).filter(Boolean);
    return showMenu(e.clientX, e.clientY, [
      { title: `${list.length} Clients ausgewählt` },
      { icon: 'shield', label: 'Servergruppen zuweisen …', action: () => assignGroupsDialog(list) },
      { icon: 'users', label: 'Channelgruppe zuweisen …', action: () => assignChannelGroupDialog(list) },
      { icon: 'arrowIn', label: 'In meinen Channel holen', disabled: perm('i_client_move_power') <= 0, action: () => list.forEach(c => c.channel !== me().channel && ts('clientmove', { clid: c.id, cid: me().channel }, 'Client verschieben')) },
      '-',
      { icon: 'logout', label: 'Alle vom Server werfen …', danger: true, disabled: perm('i_client_kick_from_server_power') <= 0, action: () => kickMany(list) },
      { icon: 'close', label: 'Auswahl aufheben', action: () => { state.multi.clear(); renderTree(); } },
    ]);
  }
  state.multi.clear();
  select(type, id);
  let items = [];
  if (type === 'server') {
    items = [
      { icon: 'plus', label: 'Channel erstellen …', action: () => channelDialog(null, 0) },
      { icon: 'edit', label: 'Server bearbeiten …', action: serverDialog, disabled: !canEditServer() },
      { icon: 'info', label: 'Serverinfo aktualisieren', action: () => ts('servergetvariables', {}, 'Serverinfo') },
    ];
  } else if (type === 'channel') {
    const ch = channelById(id);
    items = [
      { icon: 'join', label: 'Channel betreten', action: () => joinChannel(id), disabled: me()?.channel === id },
      ...(me()?.channel === id ? [{ icon: 'monitor', label: 'Channel-Ansicht (Video) öffnen', action: () => select('channel', id) }] : []),
      { icon: 'edit', label: 'Channel bearbeiten …', action: () => channelDialog(ch) },
      { icon: 'image', label: 'Channel-Icon …', disabled: !can('b_channel_modify_icon'), action: () => pickIcon(`Icon für „${displayName(ch)}“`, ch.icon_id).then(r => r != null && ts('channeledit', { cid: ch.id, channel_icon_id: r }, 'Channel-Icon')) },
      '-',
      { icon: 'plus', label: 'Unterchannel erstellen …', action: () => channelDialog(null, id) },
      { icon: 'plus', label: 'Channel erstellen …', action: () => channelDialog(null, 0) },
      { icon: 'menu', label: 'Trenner erstellen …', action: spacerDialog },
      '-',
      { icon: 'trash', label: 'Channel löschen', danger: true, action: () => deleteChannel(ch), disabled: ch.is_default },
    ];
  } else {
    const c = clientById(id);
    if (id === srv().own_id) {
      items = [
        { icon: 'edit', label: 'Spitzname ändern …', action: renameSelf },
        { icon: 'info', label: 'Beschreibung ändern …', action: describeSelf },
        { icon: 'moon', label: me()?.away ? 'Nicht mehr abwesend' : 'Abwesend …', action: toggleAway },
      ];
    } else {
      items = [
        { icon: 'message', label: 'Private Nachricht', action: () => openPrivate(id) },
        { icon: 'hand', label: 'Anstupsen …', action: () => poke(c) },
        { icon: 'eyeoff', label: Blocked.has(c) ? 'Blockierung aufheben' : 'Blockieren', action: () => { Blocked.toggle(c); state.treeJson = ''; toast(Blocked.has(c) ? `„${c.nickname}“ ist blockiert.` : `„${c.nickname}“ ist nicht mehr blockiert.`); } },
        { icon: 'arrowIn', label: 'In meinen Channel holen', action: () => ts('clientmove', { clid: id, cid: me().channel }, 'Client verschieben'), disabled: perm('i_client_move_power') <= 0 || c.channel === me()?.channel },
      ];
    }
    items.push({ icon: 'activity', label: 'Verbindungsinfo …', action: () => connectionInfo(id) });
    items.push('-');
    items.push({ icon: 'shield', label: 'Servergruppen', sub: () => serverGroupMenu(c) });
    items.push({ icon: 'shield', label: 'Servergruppen zuweisen …', action: () => assignGroupsDialog([c]) });
    items.push({ icon: 'users', label: 'Channelgruppe', sub: () => channelGroupMenu(c) });
    if (id !== srv().own_id) {
      items.push('-');
      items.push({ icon: 'logout', label: 'Aus Channel werfen …', danger: true, action: () => kick(c, 4), disabled: perm('i_client_kick_from_channel_power') <= 0 });
      items.push({ icon: 'logout', label: 'Vom Server werfen …', danger: true, action: () => kick(c, 5), disabled: perm('i_client_kick_from_server_power') <= 0 });
      items.push({ icon: 'ban', label: 'Bannen …', danger: true, action: () => banDialog(c), disabled: perm('i_client_ban_power') <= 0 });
    }
  }
  showMenu(e.clientX, e.clientY, items);
});

function serverGroupMenu(c) {
  const s = srv();
  const items = [{ title: 'Servergruppen (Klick schaltet um, Menü bleibt offen)' }];
  for (const g of s.server_groups.filter(g => g.kind === 1)) {
    const member = c.server_groups.includes(g.id);
    items.push({
      check: member,
      label: g.name,
      keepOpen: true,
      disabled: perm(member ? 'i_group_member_remove_power' : 'i_group_member_add_power') <= 0,
      action: btn => {
        const on = btn.querySelector('.ic').classList.contains('checkmark');
        ts(on ? 'servergroupdelclient' : 'servergroupaddclient', { sgid: g.id, cldbid: c.dbid }, 'Servergruppe');
        btn.querySelector('.ic').classList.toggle('checkmark', !on);
        btn.querySelector('.ic').classList.toggle('blank', on);
      },
    });
  }
  return items;
}

function channelGroupMenu(c) {
  const s = srv();
  const items = [{ title: `Channelgruppe in „${displayName(channelById(c.channel))}“` }];
  for (const g of s.channel_groups.filter(g => g.kind === 1)) {
    items.push({
      check: c.channel_group === g.id,
      label: g.name,
      disabled: perm('i_group_member_add_power') <= 0,
      action: () => ts('setclientchannelgroup', { cgid: g.id, cid: c.channel, cldbid: c.dbid }, 'Channelgruppe'),
    });
  }
  return items;
}

const canEditServer = () => ['b_virtualserver_modify_name', 'b_virtualserver_modify_welcomemessage', 'b_virtualserver_modify_maxclients', 'b_virtualserver_modify_password', 'b_virtualserver_modify_hostbanner'].some(can);

// ------------------------------------------------------------------ menu bar

const MENUS = {
  connections: () => [
    { icon: 'plug', label: 'Verbinden …', key: '', action: () => openConnect(false) },
    { icon: 'plus', label: 'In neuem Server-Tab verbinden …', action: () => openConnect(true) },
    { icon: 'plug', label: 'Erneut verbinden', disabled: !srv() || srv().phase !== 'disconnected', action: reconnectOrOpen },
    '-',
    { icon: 'unplug', label: 'Trennen', disabled: !srv() || srv().phase === 'disconnected', action: () => call('disconnect', { conn: activeConn(), message: 'Verlassen' }) },
    { icon: 'unplug', label: 'Von allen Servern trennen', disabled: !(state.snap?.connections || []).some(c => c.phase !== 'disconnected'), action: () => state.snap.connections.forEach(c => call('disconnect', { conn: c.id, message: 'Verlassen' })) },
    { icon: 'close', label: 'Server-Tab schließen', disabled: !srv(), action: async () => { await call('close_connection', { conn: activeConn() }); state.treeJson = ''; } },
    '-',
    { icon: 'plus', label: 'Channel erstellen …', disabled: !connected(), action: () => channelDialog(null, 0) },
    { icon: 'info', label: 'Serverinfo', disabled: !connected(), action: () => select('server', 0) },
    { icon: 'activity', label: 'Eigene Verbindungsinfo …', disabled: !connected(), action: () => connectionInfo(srv().own_id) },
  ],
  bookmarks: () => {
    const list = bookmarks();
    const items = list.length ? list.map(b => ({ icon: 'server', label: `${b.name}${b.name !== b.server ? ` (${b.server})` : ''}`, action: () => doConnect({ server: b.server, nickname: b.nickname || 'RustSpeaker', password: b.password || '', channel: b.channel || '', channel_password: '' }, connected()) }))
      : [{ title: 'Noch keine Favoriten' }];
    items.push('-');
    items.push({ icon: 'plus', label: 'Aktuellen Server hinzufügen …', disabled: !srv(), action: addBookmark });
    items.push({ icon: 'edit', label: 'Favoriten verwalten …', disabled: !list.length, action: manageBookmarks });
    return items;
  },
  rights: () => [
    { icon: 'key', label: 'Berechtigungsschlüssel verwenden …', disabled: !connected(), action: useToken },
    { icon: 'plus', label: 'Berechtigungsschlüssel erstellen …', action: createToken, disabled: !can('b_virtualserver_token_add') },
    { icon: 'key', label: 'Berechtigungsschlüssel anzeigen …', action: listTokens, disabled: !can('b_virtualserver_token_list') },
    { icon: 'bot', label: 'Bots verwalten …', action: manageBots, disabled: !can('b_virtualserver_bot_manage') },
    '-',
    { icon: 'shield', label: 'Gruppen & Rechte verwalten …', action: openPermEditor, disabled: !can('b_virtualserver_servergroup_permission_list') },
    { icon: 'image', label: 'Icons verwalten …', action: manageIcons, disabled: !connected() },
    { icon: 'ban', label: 'Bannliste …', action: banList, disabled: !can('b_client_ban_list') },
    { icon: 'edit', label: 'Server bearbeiten …', action: serverDialog, disabled: !canEditServer() },
    ...(connected() ? ['-', { title: `Deine Gruppen: ${(me()?.server_groups || []).map(id => srv().server_groups.find(g => g.id === id)?.name).join(', ')}` }] : []),
  ],
  extras: () => [
    { icon: 'settings', label: 'Einstellungen …', action: openSettings },
    { icon: 'mic', label: 'Mikrofon stumm', key: 'Strg+M', check: !!state.audio?.mic_muted, action: toggleMic },
    { icon: 'headphones', label: 'Lautsprecher stumm', key: 'Strg+D', check: !!state.audio?.speaker_muted, action: toggleSpeaker },
    { icon: 'moon', label: 'Abwesend …', disabled: !connected(), check: !!me()?.away, action: toggleAway },
    '-',
    { icon: 'edit', label: 'Spitzname ändern …', disabled: !connected(), action: renameSelf },
    { icon: 'trash', label: 'Chatverlauf leeren', action: clearChat },
    '-',
    { icon: 'info', label: 'Über RustSpeak', action: about },
  ],
};

document.querySelectorAll('.menu-btn').forEach(btn => {
  const open = () => {
    hideMenus();
    btn.classList.add('open');
    const r = btn.getBoundingClientRect();
    showMenu(r.left, r.bottom + 2, MENUS[btn.dataset.menu]());
  };
  btn.addEventListener('click', () => (btn.classList.contains('open') ? hideMenus() : open()));
  // Like a native menu bar: hovering another title while one is open switches menus.
  btn.addEventListener('mouseenter', () => {
    if (document.querySelector('.menu-btn.open') && !btn.classList.contains('open')) open();
  });
});

function about() {
  formDialog(`${icon('info')}Über RustSpeak`, [{ type: 'html', name: 'x', html: `<p>RustSpeak – ein freier Client für das TeamSpeak-3-Protokoll, geschrieben in Rust (Tauri v2).</p>
    <p class="note">Opus-Sprachcodec, RNNoise-Rauschunterdrückung, Ed25519/P-256-Handshake, QuickLZ. Getestet gegen den Original-Server 3.13.8.</p>` }], '', { cancel: 'Schließen' });
}

// ------------------------------------------------------------------ generic form dialog

/**
 * fields: [{name, label, type: text|password|number|textarea|checkbox|select|range|html, value, options:[[v,l]], required, note, min, max, step}]
 */
function formDialog(title, fields, okLabel = 'OK', { wide = false, cancel = 'Abbrechen', onOpen } = {}) {
  return new Promise(resolve => {
    const dlg = $('#dlg-form');
    dlg.classList.toggle('wide', wide);
    $('#form-title').innerHTML = title;
    $('#form-ok').textContent = okLabel;
    $('#form-ok').hidden = !okLabel;
    $('#form-cancel').textContent = cancel;
    const box = $('#form-fields');
    box.innerHTML = fields.map(f => {
      const req = f.required ? 'required' : '';
      const note = f.note ? `<p class="note">${f.note}</p>` : '';
      switch (f.type) {
        case 'html': return f.html;
        case 'checkbox': return `<label class="check"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}><span>${esc(f.label)}</span></label>${note}`;
        case 'textarea': return `<label>${esc(f.label)}<textarea name="${f.name}" ${req}>${esc(f.value ?? '')}</textarea></label>${note}`;
        case 'select': return `<label>${esc(f.label)}<select name="${f.name}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>${note}`;
        case 'range': return `<label>${esc(f.label)} <output>${esc(f.value)}</output><input type="range" name="${f.name}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${esc(f.value)}" oninput="this.previousElementSibling.textContent=this.value"></label>${note}`;
        case 'icon': return `<label>${esc(f.label)}<div class="icon-field"><span class="icon-preview" data-icon-preview="${f.name}">${f.value ? ico(f.value) : '<span class="hint">kein Icon</span>'}</span>
          <input type="hidden" name="${f.name}" value="${f.value || 0}"><button type="button" class="tb-btn small" data-icon-pick="${f.name}">${icon('image')}Auswählen …</button></div></label>${note}`;
        default: return `<label>${esc(f.label)}<input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${req} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}" autocomplete="off"></label>${note}`;
      }
    }).join('');
    // Icon fields open the picker on top of this dialog
    box.querySelectorAll('[data-icon-pick]').forEach(b => b.addEventListener('click', async () => {
      const name = b.dataset.iconPick;
      const input = box.querySelector(`[name="${name}"]`);
      const r = await pickIcon('Icon auswählen', Number(input.value), true);
      if (r == null) return;
      input.value = r;
      box.querySelector(`[data-icon-preview="${name}"]`).innerHTML = r ? ico(r) : '<span class="hint">kein Icon</span>';
    }));
    dlg.returnValue = '';
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      const data = {};
      for (const f of fields) {
        const el = box.querySelector(`[name="${f.name}"]`);
        if (!el) continue;
        data[f.name] = f.type === 'checkbox' ? el.checked : el.value;
      }
      resolve(data);
    };
    dlg.showModal();
    onOpen?.(box);
    box.querySelector('input:not([type=checkbox]):not([type=hidden]),textarea')?.focus();
  });
}

// ------------------------------------------------------------------ icon picker / upload

/** Read an image file, scale it to 32x32 (or keep 16x16) and return base64 PNG. */
function chooseImage(maxSize = 32) {
  return new Promise(resolve => {
    const input = $('#file-input');
    input.value = '';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return resolve(null);
      const img = new Image();
      img.onload = () => {
        const size = Math.min(maxSize, Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d');
        const sc = size / Math.max(img.width, img.height);
        g.drawImage(img, (size - img.width * sc) / 2, (size - img.height * sc) / 2, img.width * sc, img.height * sc);
        resolve(cv.toDataURL('image/png').split(',')[1]);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(f);
    };
    input.click();
  });
}

async function uploadIcon() {
  const data = await chooseImage(32);
  if (!data) return null;
  ts('iconupload', { data }, 'Icon hochladen');
  const items = await waitNotify('notifyiconupload');
  const id = items?.[0]?.iconid;
  if (id) {
    ICON_CACHE.set(`${activeConn()}:${Number(id) >>> 0}`, `data:image/png;base64,${data}`);
    toast('Icon hochgeladen', 'ok');
  }
  return id ? Number(id) >>> 0 : null;
}

/** Icon picker: built-in icons + icons uploaded to the server. Resolves to an id (0 = none) or null. */
async function pickIcon(title, current = 0, nested = false) {
  ts('iconlist', {}, 'Iconliste');
  const items = (await waitNotify('notifyiconlist', activeConn(), 1500)) || [];
  const uploaded = items.filter(i => i.iconid).map(i => Number(i.iconid) >>> 0);
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg wide';
    const cell = id => `<button type="button" class="icon-cell${(id >>> 0) === (current >>> 0) ? ' active' : ''}" data-id="${id}" title="${id ? (BUILTIN_ICONS[id]?.[0] || 'Icon ' + id) : 'Kein Icon'}">${id ? ico(id) : icon('close')}</button>`;
    dlg.innerHTML = `<form method="dialog"><h2>${icon('image')}${esc(title)}</h2>
      <div class="perm-cat">Integrierte Icons</div><div class="icon-grid">${cell(0)}${Object.keys(BUILTIN_ICONS).map(Number).map(cell).join('')}</div>
      <div class="perm-cat">Hochgeladene Icons</div><div class="icon-grid" id="up-grid">${uploaded.map(cell).join('') || '<span class="hint">Noch keine eigenen Icons.</span>'}</div>
      <div class="dlg-actions"><button type="button" class="tb-btn" id="ip-upload" ${can('b_icon_manage') ? '' : 'disabled'}>${icon('upload')}Bild hochladen …</button><div class="tb-spacer"></div>
      <button value="cancel" class="tb-btn">Abbrechen</button></div></form>`;
    document.body.appendChild(dlg);
    let result = null;
    dlg.addEventListener('click', e => {
      const c = e.target.closest('.icon-cell');
      if (!c) return;
      result = Number(c.dataset.id) >>> 0;
      dlg.close();
    });
    dlg.querySelector('#ip-upload').onclick = async () => {
      const id = await uploadIcon();
      if (id != null) {
        result = id;
        dlg.close();
      }
    };
    dlg.onclose = () => {
      dlg.remove();
      resolve(result);
    };
    dlg.showModal();
    if (nested) dlg.style.zIndex = 100;
  });
}

async function manageIcons() {
  ts('iconlist', {}, 'Iconliste');
  const items = (await waitNotify('notifyiconlist', activeConn(), 1500)) || [];
  const ids = items.filter(i => i.iconid).map(i => Number(i.iconid) >>> 0);
  const html = `<p class="note">Icons kannst du Gruppen (Rechteverwaltung → Gruppen-Icon) und Channelsn (Rechtsklick → Channel-Icon) zuweisen. Bilder werden auf 32×32 Pixel verkleinert.</p>
    <div class="icon-grid big">${ids.map(id => `<div class="icon-tile">${ico(id)}<span class="hint">${id}</span>${can('b_icon_manage') ? `<button type="button" class="mini-btn" data-del="${id}" title="Löschen">${icon('trash')}</button>` : ''}</div>`).join('') || '<span class="hint">Noch keine hochgeladenen Icons.</span>'}</div>
    <button type="button" class="tb-btn" id="mi-upload" ${can('b_icon_manage') ? '' : 'disabled'}>${icon('upload')}Bild hochladen …</button>`;
  const p = formDialog(`${icon('image')}Icons`, [{ type: 'html', name: 'x', html }], '', { wide: true, cancel: 'Schließen' });
  $('#form-fields').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    ts('icondelete', { iconid: b.dataset.del }, 'Icon löschen');
    b.closest('.icon-tile').remove();
  }));
  $('#mi-upload').onclick = async () => {
    $('#dlg-form').close();
    await uploadIcon();
    manageIcons();
  };
  await p;
}

// ------------------------------------------------------------------ connection info

async function connectionInfo(clid) {
  const conn = activeConn();
  const c = clientById(clid);
  if (!c) return;
  const dlg = document.createElement('dialog');
  dlg.className = 'dlg wide';
  dlg.innerHTML = `<form method="dialog"><h2>${icon('activity')}Verbindungsinfo – ${esc(c.nickname)}</h2><div id="ci-body" class="ci-body"><p class="hint">Lade …</p></div>
    <div class="dlg-actions"><button value="cancel" class="tb-btn">Schließen</button></div></form>`;
  document.body.appendChild(dlg);
  let open = true;
  dlg.onclose = () => {
    open = false;
    dlg.remove();
  };
  dlg.showModal();
  const row = (k, a, b) => `<tr><td class="k">${k}</td><td>${a}</td>${b !== undefined ? `<td>${b}</td>` : ''}</tr>`;
  while (open) {
    ts('getconnectioninfo', { clid }, 'Verbindungsinfo', conn);
    const items = await waitNotify('notifyconnectioninfo', conn, 2000);
    if (!open) break;
    const i = items?.[0];
    if (!i) {
      dlg.querySelector('#ci-body').innerHTML = '<p class="hint">Keine Daten (Client nicht mehr verbunden?).</p>';
    } else {
      const lt = Number(i.connection_last_talked);
      const ip = i.connection_client_ip ? `${esc(i.connection_client_ip)}:${esc(i.connection_client_port)}` : '<span class="hint">verborgen (Recht fehlt)</span>';
      const cat = (base, f = x => x) => ['speech', 'keepalive', 'control', 'total'].map(k => f(i[`${base}_${k}`]));
      const tri = (label, inBase, outBase, f) => {
        const a = cat(inBase, f), b = cat(outBase, f);
        return `<tr class="sub-h"><td class="k" colspan="3">${label}</td></tr>` +
          ['Sprache', 'Keepalive', 'Steuerung', 'Gesamt'].map((n, j) => row(`<span class="ind">${n}</span>`, a[j], b[j])).join('');
      };
      dlg.querySelector('#ci-body').innerHTML = `<table class="ci">
        ${row('Clientname', esc(clientById(clid)?.nickname || c.nickname))}
        ${row('Verbindungsdauer', fmtDuration(Number(i.connection_connected_time)))}
        ${row('Untätig seit', fmtDuration(Number(i.connection_idle_time)))}
        ${row('Nicht geredet seit', lt >= 0 ? fmtDuration(lt) : 'hat noch nicht geredet')}
        ${row('Ping', `${Number(i.connection_ping).toFixed(0)} ms`)}
        ${row('Clientadresse', ip)}
      </table>
      <table class="ci">
        <tr><th></th><th>Eingehend (Server → Client)</th><th>Ausgehend (Client → Server)</th></tr>
        ${tri('Paketverlust', 'connection_server2client_packetloss', 'connection_client2server_packetloss', fmtPct)}
        ${tri('Übertragene Pakete', 'connection_packets_received', 'connection_packets_sent', v => Number(v).toLocaleString('de-DE'))}
        ${tri('Übertragene Bytes', 'connection_bytes_received', 'connection_bytes_sent', fmtBytes)}
        ${tri('Bandbreite letzte Sekunde', 'connection_bandwidth_received_last_second', 'connection_bandwidth_sent_last_second', fmtRate)}
        ${tri('Bandbreite letzte Minute', 'connection_bandwidth_received_last_minute', 'connection_bandwidth_sent_last_minute', fmtRate)}
        <tr class="sub-h"><td class="k" colspan="3">Dateitransfer-Bandbreite</td></tr>
        ${row('<span class="ind">Gesamt</span>', fmtRate(i.connection_filetransfer_bandwidth_received), fmtRate(i.connection_filetransfer_bandwidth_sent))}
      </table>`;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

// ------------------------------------------------------------------ actions

async function joinChannel(cid) {
  const ch = channelById(cid);
  if (!ch || me()?.channel === cid) return;
  const args = { clid: srv().own_id, cid };
  if (ch.has_password && !can('b_channel_join_ignore_password')) {
    const r = await formDialog(`Passwort für „${esc(displayName(ch))}“`, [{ name: 'pw', label: 'Channel-Passwort', type: 'password', required: true }], 'Betreten');
    if (!r) return;
    args.cpw = r.pw;
  }
  ts('clientmove', args, 'Channel betreten');
}

async function spacerDialog() {
  const r = await formDialog(`${icon('menu')}Trenner erstellen`, [
    { name: 'kind', label: 'Art', type: 'select', value: '*', options: [['*', 'Linie über die ganze Breite ([*spacer])'], ['c', 'Text zentriert ([cspacer])'], ['l', 'Text links ([spacer])'], ['r', 'Text rechts ([rspacer])']] },
    { name: 'text', label: 'Zeichen / Text', value: '-', required: true, note: 'Bei „Linie“ wird das Zeichen (z. B. -, =, ~, _ oder ·) über die komplette Breite wiederholt.' },
  ], 'Erstellen');
  if (!r) return;
  const tag = r.kind === '*' ? '*spacer' : r.kind === 'l' ? 'spacer' : `${r.kind}spacer`;
  const n = srv().channels.filter(c => /^\[[lcr*]?spacer/i.test(c.name)).length;
  ts('channelcreate', { channel_name: `[${tag}${n}]${r.text}`, channel_flag_permanent: 1, channel_maxclients: 0 }, 'Trenner erstellen');
}

async function channelDialog(ch, parent = 0) {
  const edit = !!ch;
  const type = ch ? (ch.permanent ? 'permanent' : ch.semi_permanent ? 'semi' : 'temporary') : 'temporary';
  if (edit && ch.description == null) {
    ts('channelgetdescription', { cid: ch.id }, 'Channelbeschreibung');
    await new Promise(r => setTimeout(r, 250));
    await poll(true);
    ch = channelById(ch.id) || ch;
  }
  const types = [['temporary', 'Temporär (wird gelöscht, wenn leer)'], ['semi', 'Semi-permanent (bis zum Serverneustart)'], ['permanent', 'Permanent']]
    .filter(([v]) => edit || can(v === 'temporary' ? 'b_channel_create_temporary' : v === 'semi' ? 'b_channel_create_semi_permanent' : 'b_channel_create_permanent'));
  const r = await formDialog(edit ? `${icon('edit')}Channel „${esc(displayName(ch))}“ bearbeiten` : `${icon('plus')}${parent ? `Unterchannel von „${esc(displayName(channelById(parent)))}“` : 'Channel'} erstellen`, [
    { name: 'name', label: 'Name', value: ch?.name || '', required: true, note: 'Trenner: <code>[*spacer]-</code> (Linie), <code>[cspacer]Text</code> (zentriert), <code>[rspacer]Text</code> (rechts).' },
    { name: 'topic', label: 'Thema', value: ch?.topic || '' },
    { name: 'description', label: 'Beschreibung (BBCode erlaubt)', type: 'textarea', value: ch?.description || '' },
    { name: 'password', label: edit && ch.has_password ? 'Neues Passwort (leer = unverändert)' : 'Passwort (optional)', type: 'password' },
    ...(edit && ch.has_password ? [{ name: 'nopw', label: 'Passwort entfernen', type: 'checkbox' }] : []),
    { name: 'type', label: 'Channeltyp', type: 'select', value: type, options: types },
    { name: 'is_default', label: 'Standardchannel (neue Clients landen hier)', type: 'checkbox', value: ch?.is_default },
    ...(can('b_channel_modify_icon') ? [{ name: 'icon', label: 'Channel-Icon', type: 'icon', value: ch?.icon_id || 0 }] : []),
    { name: 'max', label: 'Maximale Clients (-1 = unbegrenzt)', type: 'number', value: ch?.max_clients ?? -1, min: -1 },
    { name: 'quality', label: 'Sprachqualität (Opus)', type: 'range', value: ch?.codec_quality ?? 6, min: 0, max: 10 },
    { name: 'talk', label: 'Benötigte Sprechkraft (0 = jeder darf sprechen)', type: 'number', value: ch?.needed_talk_power ?? 0, min: 0 },
    { name: 'join', label: 'Benötigte Beitrittskraft', type: 'number', value: ch?.needed_join_power ?? 0, min: 0 },
  ], edit ? 'Speichern' : 'Erstellen', { wide: true });
  if (!r) return;
  const a = {};
  const set = (k, v, old) => { if (!edit || String(v) !== String(old)) a[k] = v; };
  set('channel_name', r.name.trim(), ch?.name);
  set('channel_topic', r.topic, ch?.topic);
  set('channel_description', r.description, ch?.description ?? '');
  if (r.password) a.channel_password = r.password;
  if (r.nopw) a.channel_password = '';
  if (r.type !== type || !edit) {
    a.channel_flag_permanent = r.type === 'permanent' ? 1 : 0;
    a.channel_flag_semi_permanent = r.type === 'semi' ? 1 : 0;
  }
  if (r.is_default && !ch?.is_default) a.channel_flag_default = 1;
  if (r.icon !== undefined) set('channel_icon_id', Number(r.icon) >>> 0, ch?.icon_id ?? 0);
  set('channel_maxclients', Number(r.max), ch?.max_clients ?? -1);
  set('channel_codec_quality', Number(r.quality), ch?.codec_quality ?? 6);
  set('channel_needed_talk_power', Number(r.talk), ch?.needed_talk_power ?? 0);
  set('channel_needed_join_power', Number(r.join), ch?.needed_join_power ?? 0);
  if (!edit) {
    if (Number(r.max) < 0) delete a.channel_maxclients;
    if (!r.description) delete a.channel_description;
    if (!r.topic) delete a.channel_topic;
    if (!Number(r.icon)) delete a.channel_icon_id;
    for (const k of ['channel_codec_quality', 'channel_needed_talk_power', 'channel_needed_join_power']) if (String(a[k]) === String({ channel_codec_quality: 6 }[k] ?? 0)) delete a[k];
  }
  if (edit) {
    if (Object.keys(a).length) ts('channeledit', { cid: ch.id, ...a }, 'Channel bearbeiten');
  } else {
    if (parent) a.cpid = parent;
    ts('channelcreate', a, 'Channel erstellen');
  }
}

async function deleteChannel(ch) {
  const members = srv().clients.filter(c => c.channel === ch.id).length;
  const r = await formDialog(`Channel „${esc(displayName(ch))}“ löschen?`, [{ type: 'html', name: 'x', html: `<p class="note">${members ? `Im Channel sind ${members} Client(s); sie werden in den Standardchannel verschoben.` : 'Der Channel und alle Unterchannels werden gelöscht.'}</p>` }], 'Löschen');
  if (r) ts('channeldelete', { cid: ch.id, force: 1 }, 'Channel löschen');
}

async function serverDialog() {
  ts('servergetvariables', {}, 'Serverinfo');
  await new Promise(r => setTimeout(r, 250));
  await poll(true);
  const i = srv().server_info || {};
  const gfx = i.virtualserver_hostbanner_gfx_url || '';
  const r = await formDialog(`${icon('server')}Server bearbeiten`, [
    { name: 'name', label: 'Servername', value: srv().server_name, required: true },
    { name: 'welcome', label: 'Willkommensnachricht', type: 'textarea', value: i.virtualserver_welcomemessage || '' },
    { name: 'max', label: 'Maximale Clients', type: 'number', value: i.virtualserver_maxclients || 32, min: 1 },
    { name: 'password', label: 'Neues Serverpasswort (leer = unverändert)', type: 'password' },
    { name: 'nopw', label: 'Serverpasswort entfernen', type: 'checkbox' },
    { type: 'html', name: 'bh', html: `<div class="perm-cat">Server-Banner</div>` },
    { name: 'banner_gfx', label: 'Banner-Bild (URL)', value: isWebUrl(gfx) ? gfx : '', placeholder: 'https://example.org/banner.png', note: 'Das Bild wird über einen externen Link geladen (http:// oder https://).' },
    { type: 'html', name: 'bu', html: `<div class="row-btns"><button type="button" class="tb-btn small" id="banner-clear">${icon('trash')}Banner entfernen</button><span class="hint" id="banner-state"></span></div><div class="banner-preview" id="banner-preview" hidden><img alt=""></div>` },
    { name: 'banner_url', label: 'Link beim Klick auf das Banner', value: i.virtualserver_hostbanner_url || '', placeholder: 'https://example.org' },
    { name: 'banner_mode', label: 'Anzeige', type: 'select', value: i.virtualserver_hostbanner_mode ?? 2, options: [[0, 'Originalgröße'], [1, 'An Breite anpassen (verzerren)'], [2, 'An Breite anpassen (Seitenverhältnis behalten)']] },
    { name: 'banner_interval', label: 'Bild neu laden alle … Sekunden (0 = nie, min. 60)', type: 'number', value: i.virtualserver_hostbanner_gfx_interval || 0, min: 0 },
  ], 'Speichern', {
    wide: true,
    onOpen: box => {
      const field = box.querySelector('[name=banner_gfx]');
      const hint = box.querySelector('#banner-state');
      const prev = box.querySelector('#banner-preview');
      const pimg = prev.querySelector('img');
      pimg.onload = () => { prev.hidden = false; hint.textContent = `${pimg.naturalWidth} × ${pimg.naturalHeight}`; };
      pimg.onerror = () => { prev.hidden = true; hint.textContent = 'Bild konnte nicht geladen werden'; };
      const update = () => {
        const u = field.value.trim();
        hint.textContent = '';
        if (!u) { prev.hidden = true; return; }
        if (!isWebUrl(u)) { prev.hidden = true; hint.textContent = 'Nur http:// oder https:// Links'; return; }
        pimg.src = u;
      };
      field.addEventListener('change', update);
      update();
      box.querySelector('#banner-clear').onclick = () => {
        field.value = '';
        update();
        hint.textContent = 'Banner wird entfernt';
      };
    },
  });
  if (!r) return;
  r.banner_gfx = (r.banner_gfx || '').trim();
  r.banner_url = (r.banner_url || '').trim();
  if ((r.banner_gfx && !isWebUrl(r.banner_gfx)) || (r.banner_url && !isWebUrl(r.banner_url))) {
    return toast('Banner-Bild und Link müssen mit http:// oder https:// beginnen.', 'error');
  }
  const a = {};
  if (r.name !== srv().server_name) a.virtualserver_name = r.name;
  if (r.welcome !== (i.virtualserver_welcomemessage || '')) a.virtualserver_welcomemessage = r.welcome;
  if (String(r.max) !== String(i.virtualserver_maxclients)) a.virtualserver_maxclients = r.max;
  if (r.password) a.virtualserver_password = r.password;
  if (r.nopw) a.virtualserver_password = '';
  if (r.banner_gfx !== gfx) a.virtualserver_hostbanner_gfx_url = r.banner_gfx;
  if (r.banner_url !== (i.virtualserver_hostbanner_url || '')) a.virtualserver_hostbanner_url = r.banner_url;
  if (String(r.banner_mode) !== String(i.virtualserver_hostbanner_mode ?? 2)) a.virtualserver_hostbanner_mode = r.banner_mode;
  if (String(r.banner_interval) !== String(i.virtualserver_hostbanner_gfx_interval || 0)) a.virtualserver_hostbanner_gfx_interval = r.banner_interval;
  if (Object.keys(a).length) ts('serveredit', a, 'Server bearbeiten');
}

async function poke(c) {
  const r = await formDialog(`${icon('hand')}${esc(c.nickname)} anstupsen`, [{ name: 'msg', label: 'Nachricht' }], 'Anstupsen');
  if (r) ts('clientpoke', { clid: c.id, msg: r.msg }, 'Anstupsen');
}

async function kick(c, reason) {
  const r = await formDialog(`${esc(c.nickname)} ${reason === 4 ? 'aus dem Channel' : 'vom Server'} werfen`, [{ name: 'msg', label: 'Grund' }], 'Werfen');
  if (r) ts('clientkick', { clid: c.id, reasonid: reason, reasonmsg: r.msg }, 'Kick');
}

async function kickMany(list) {
  const r = await formDialog(`${list.length} Clients vom Server werfen`, [{ name: 'msg', label: 'Grund' }], 'Werfen');
  if (r) ts('clientkick', { reasonid: 5, reasonmsg: r.msg, clid: list[0].id }, 'Kick', activeConn(), list.slice(1).map(c => ({ clid: c.id })));
  state.multi.clear();
}

/** Give one or several clients several server groups at once. */
async function assignGroupsDialog(list) {
  const s = srv();
  const groups = s.server_groups.filter(g => g.kind === 1);
  const html = `<p class="note">${list.length === 1 ? `Gruppen von <b>${esc(list[0].nickname)}</b>` : `Gruppen für <b>${list.length} Clients</b>: ${list.map(c => esc(c.nickname)).join(', ')}`}. Ein Strich bedeutet „nur einige haben die Gruppe“ – unverändert lassen.</p>
    <div class="group-checks">${groups.map(g => {
      const n = list.filter(c => c.server_groups.includes(g.id)).length;
      const st = n === 0 ? 'off' : n === list.length ? 'on' : 'some';
      return `<label class="check gcheck"><input type="checkbox" data-g="${g.id}" data-state="${st}" ${st === 'on' ? 'checked' : ''}><span>${g.icon_id ? ico(g.icon_id) : ''}${esc(g.name)}</span></label>`;
    }).join('')}</div>`;
  const p = formDialog(`${icon('shield')}Servergruppen zuweisen`, [{ type: 'html', name: 'x', html }], 'Übernehmen', {
    onOpen: box => box.querySelectorAll('[data-state=some]').forEach(cb => (cb.indeterminate = true)),
  });
  const box = $('#form-fields');
  const wanted = new Map();
  box.querySelectorAll('[data-g]').forEach(cb => cb.addEventListener('change', () => wanted.set(Number(cb.dataset.g), cb.checked)));
  if (!(await p)) return;
  for (const [sgid, on] of wanted) {
    for (const c of list) {
      const has = c.server_groups.includes(sgid);
      if (on && !has) ts('servergroupaddclient', { sgid, cldbid: c.dbid }, 'Servergruppe');
      if (!on && has) ts('servergroupdelclient', { sgid, cldbid: c.dbid }, 'Servergruppe');
    }
  }
  state.multi.clear();
}

async function assignChannelGroupDialog(list) {
  const s = srv();
  const r = await formDialog(`${icon('users')}Channelgruppe zuweisen`, [
    { name: 'cg', label: `Channelgruppe für ${list.length} Clients (jeweils in ihrem aktuellen Channel)`, type: 'select', value: s.channel_groups[0]?.id, options: s.channel_groups.filter(g => g.kind === 1).map(g => [g.id, g.name]) },
  ], 'Übernehmen');
  if (!r) return;
  for (const c of list) ts('setclientchannelgroup', { cgid: r.cg, cid: c.channel, cldbid: c.dbid }, 'Channelgruppe');
  state.multi.clear();
}

async function banDialog(c) {
  const r = await formDialog(`${icon('ban')}${esc(c.nickname)} bannen`, [
    { name: 'reason', label: 'Grund' },
    { name: 'time', label: 'Dauer', type: 'select', value: 3600, options: [[600, '10 Minuten'], [3600, '1 Stunde'], [86400, '1 Tag'], [604800, '1 Woche'], [2592000, '30 Tage'], [0, 'Permanent']] },
  ], 'Bannen');
  if (r) ts('banclient', { clid: c.id, time: r.time, banreason: r.reason }, 'Bannen');
}

async function banList() {
  ts('banlist', {}, 'Bannliste');
  const items = await waitNotify('notifybanlist', activeConn(), 1500);
  const rows = (items || []).map(b => `<tr><td>${esc(b.lastnickname || b.name || '–')}</td><td>${esc(b.ip || '')}<br><span class="note">${esc(b.uid || '')}</span></td>
    <td>${esc(b.reason)}</td><td>${b.duration === '0' ? 'permanent' : fmtDuration(Number(b.duration) * 1000)}</td><td>${esc(b.invokername)}</td>
    <td><button type="button" class="tb-btn small danger" data-ban="${b.banid}">Aufheben</button></td></tr>`).join('');
  const html = rows ? `<table><tr><th>Name</th><th>IP / UID</th><th>Grund</th><th>Dauer</th><th>Von</th><th></th></tr>${rows}</table>` : '<p class="note">Keine aktiven Banns.</p>';
  const p = formDialog(`${icon('ban')}Bannliste`, [{ type: 'html', name: 'x', html }], '', { wide: true, cancel: 'Schließen' });
  $('#form-fields').querySelectorAll('[data-ban]').forEach(b => b.addEventListener('click', () => {
    ts('bandel', { banid: b.dataset.ban }, 'Bann aufheben');
    b.closest('tr').remove();
  }));
  await p;
}

async function useToken() {
  const r = await formDialog(`${icon('key')}Berechtigungsschlüssel verwenden`, [{ name: 'token', label: 'Schlüssel', required: true, note: 'Den Schlüssel bekommst du vom Serveradministrator. Beim ersten Start gibt der Server einen Schlüssel für „Server Admin“ aus.' }], 'Verwenden');
  if (r) ts('privilegekeyuse', { token: r.token.trim() }, 'Berechtigungsschlüssel');
}

async function createToken() {
  const s = srv();
  const sg = s.server_groups.filter(g => g.kind === 1).map(g => [`s:${g.id}`, `Servergruppe: ${g.name}`]);
  const cg = s.channel_groups.filter(g => g.kind === 1).map(g => [`c:${g.id}`, `Channelgruppe: ${g.name}`]);
  const r = await formDialog(`${icon('key')}Berechtigungsschlüssel erstellen`, [
    { name: 'group', label: 'Gruppe', type: 'select', value: sg[0]?.[0], options: [...sg, ...cg] },
    { name: 'channel', label: 'Channel (nur für Channelgruppen)', type: 'select', value: me()?.channel, options: s.channels.filter(c => !parseSpacer(c)).map(c => [c.id, '  '.repeat(c.depth) + c.name]) },
    { name: 'desc', label: 'Beschreibung' },
  ], 'Erstellen');
  if (!r) return;
  const [kind, id] = r.group.split(':');
  ts('privilegekeyadd', { tokentype: kind === 's' ? 0 : 1, tokenid1: id, tokenid2: kind === 's' ? 0 : r.channel, tokendescription: r.desc }, 'Schlüssel erstellen');
  const items = await waitNotify('notifytokenadd');
  if (!items) return;
  const token = items[0].token;
  const p = formDialog(`${icon('key')}Schlüssel erstellt`, [{ type: 'html', name: 'x', html: `<p class="note">Gib diesen Schlüssel an die Person weiter. Er kann genau einmal verwendet werden.</p><div class="token">${esc(token)}</div><button type="button" class="tb-btn" id="copy-token">${icon('copy')}Kopieren</button>` }], '', { cancel: 'Schließen' });
  $('#copy-token').onclick = () => navigator.clipboard.writeText(token).then(() => toast('Kopiert', 'ok'));
  await p;
}

async function listTokens() {
  ts('privilegekeylist', {}, 'Schlüsselliste');
  const items = await waitNotify('notifytokenlist', activeConn(), 1500);
  const s = srv();
  const gname = t => t.token_type === '0' ? s.server_groups.find(g => g.id == t.token_id1)?.name : `${s.channel_groups.find(g => g.id == t.token_id1)?.name} in „${displayName(channelById(Number(t.token_id2)))}“`;
  const rows = (items || []).map(t => `<tr><td><span class="token">${esc(t.token)}</span></td><td>${esc(gname(t) || '?')}</td><td>${esc(t.token_description)}</td>
    <td><button type="button" class="tb-btn small danger" data-tok="${esc(t.token)}">Löschen</button></td></tr>`).join('');
  const html = rows ? `<table><tr><th>Schlüssel</th><th>Gruppe</th><th>Beschreibung</th><th></th></tr>${rows}</table>` : '<p class="note">Keine offenen Schlüssel.</p>';
  const p = formDialog(`${icon('key')}Berechtigungsschlüssel`, [{ type: 'html', name: 'x', html }], '', { wide: true, cancel: 'Schließen' });
  $('#form-fields').querySelectorAll('[data-tok]').forEach(b => b.addEventListener('click', () => {
    ts('privilegekeydelete', { token: b.dataset.tok }, 'Schlüssel löschen');
    b.closest('tr').remove();
  }));
  await p;
}

/** Bot keys: programs that log in over the bot interface and show up as clients. */
async function manageBots() {
  ts('botkeylist', {}, 'Bot-Liste');
  const items = (await waitNotify('notifybotkeylist', activeConn(), 1500)) || [];
  const host = hostOf(srv()?.address || '');
  const rows = items.filter(b => b.botid).map(b => `<tr><td><b>${esc(b.name)}</b> ${b.online === '1' ? '<span class="bot-on">online</span>' : ''}</td>
    <td><span class="token">${esc(b.key)}</span> <button type="button" class="mini-btn" data-copy="${esc(b.key)}" title="Kopieren">${icon('copy')}</button></td>
    <td><button type="button" class="tb-btn small danger" data-bot="${esc(b.botid)}">Löschen</button></td></tr>`).join('');
  const html = `<p class="note">Bots melden sich per TCP auf Port 10013 dieses Servers (${esc(host)}) mit einem Bot-Schlüssel an und erscheinen dann wie normale Clients im Channelbaum. Man kann sie anschreiben und anstupsen. Ein Beispiel liegt in <code>bots/echo-bot.js</code>.</p>
    ${rows ? `<table><tr><th>Name</th><th>Bot-Schlüssel</th><th></th></tr>${rows}</table>` : '<p class="note">Noch keine Bots angelegt.</p>'}
    <div class="row-btns"><button type="button" class="tb-btn small primary" id="bot-add">${icon('plus')}Bot anlegen …</button></div>`;
  const p = formDialog(`${icon('bot')}Bots`, [{ type: 'html', name: 'x', html }], '', { wide: true, cancel: 'Schließen' });
  const box = $('#form-fields');
  box.querySelectorAll('[data-bot]').forEach(b => b.addEventListener('click', () => {
    ts('botkeydel', { botid: b.dataset.bot }, 'Bot löschen');
    b.closest('tr').remove();
  }));
  box.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
    navigator.clipboard?.writeText(b.dataset.copy).then(() => toast('Bot-Schlüssel kopiert.'));
  }));
  box.querySelector('#bot-add').addEventListener('click', async () => {
    $('#dlg-form').close();
    await p;
    const r = await formDialog(`${icon('bot')}Bot anlegen`, [{ name: 'name', label: 'Name des Bots (wird als Spitzname verwendet)', required: true }], 'Anlegen');
    if (!r) return;
    ts('botkeyadd', { name: r.name }, 'Bot anlegen');
    const k = (await waitNotify('notifybotkeyadd', activeConn(), 1500))?.[0];
    if (k) {
      navigator.clipboard?.writeText(k.key).catch(() => {});
      toast(`Bot „${k.name}“ angelegt, Schlüssel kopiert.`);
    }
    manageBots();
  });
  await p;
}

async function renameSelf() {
  const r = await formDialog('Spitzname ändern', [{ name: 'nick', label: 'Neuer Spitzname', value: me()?.nickname, required: true }], 'Ändern');
  if (!r) return;
  ts('clientupdate', { client_nickname: r.nick }, 'Spitzname ändern');
  if (UI.app.updateBookmarkNick && srv()) saveBookmarks(bookmarks().map(b => (b.server === srv().address ? { ...b, nickname: r.nick } : b)));
}

async function describeSelf() {
  const r = await formDialog('Beschreibung ändern', [{ name: 'd', label: 'Beschreibung', value: me()?.description }], 'Speichern');
  if (r) ts('clientupdate', { client_description: r.d }, 'Beschreibung');
}

async function toggleAway() {
  if (!connected()) return;
  if (me()?.away) {
    Sounds.play('back');
    return ts('clientupdate', { client_away: 0 }, 'Abwesenheit');
  }
  const r = await formDialog(`${icon('moon')}Abwesend`, [{ name: 'msg', label: 'Abwesenheitsnachricht (optional)' }], 'Abwesend setzen');
  if (r) {
    Sounds.play('away');
    ts('clientupdate', { client_away: 1, client_away_message: r.msg }, 'Abwesenheit');
  }
}

async function setAudio(patch) {
  state.audio = { ...state.audio, ...patch };
  await call('set_audio_config', { cfg: state.audio });
  updateButtons();
}

async function toggleMic() {
  const muted = !state.audio.mic_muted;
  await setAudio({ mic_muted: muted });
  Sounds.play(muted ? 'mic_muted' : 'mic_unmuted');
  for (const c of state.snap?.connections || []) if (c.phase === 'connected') ts('clientupdate', { client_input_muted: muted ? 1 : 0 }, 'Mikrofon', c.id);
}

async function toggleSpeaker() {
  const muted = !state.audio.speaker_muted;
  await setAudio({ speaker_muted: muted });
  Sounds.play(muted ? 'sound_muted' : 'sound_unmuted');
  for (const c of state.snap?.connections || []) if (c.phase === 'connected') ts('clientupdate', { client_output_muted: muted ? 1 : 0 }, 'Lautsprecher', c.id);
}

$('#btn-mic').onclick = toggleMic;
$('#btn-speaker').onclick = toggleSpeaker;
$('#btn-away').onclick = toggleAway;
$('#btn-new-channel').onclick = () => channelDialog(null, 0);
$('#btn-disconnect').onclick = () => call('disconnect', { conn: activeConn(), message: 'Verlassen' });

window.addEventListener('keydown', e => {
  if (capturing || !e.ctrlKey) return;
  if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleMic(); }
  if (e.key.toLowerCase() === 'd') { e.preventDefault(); toggleSpeaker(); }
});

// ------------------------------------------------------------------ connect + bookmarks

const bookmarks = () => JSON.parse(localStorage.getItem('rs.bookmarks') || '[]');
const saveBookmarks = b => localStorage.setItem('rs.bookmarks', JSON.stringify(b));

function openConnect(newTab = false, preset = null) {
  const dlg = $('#dlg-connect');
  const saved = preset || JSON.parse(localStorage.getItem('rs.connect') || '{}');
  const f = $('#form-connect');
  for (const k of ['server', 'nickname', 'channel']) f.elements[k].value = saved[k] || '';
  if (!f.elements.nickname.value) f.elements.nickname.value = 'RustSpeaker';
  f.elements.password.value = preset?.password || '';
  f.elements.channel_password.value = '';
  f.elements.new_tab.checked = newTab || connected();
  f.elements.new_tab.parentElement.hidden = !state.snap?.connections.length;
  f.elements.bookmark.checked = false;
  dlg.returnValue = '';
  dlg.showModal();
  (f.elements.server.value ? f.elements.nickname : f.elements.server).focus();
}

async function doConnect(args, newTab) {
  const reuse = !newTab && state.snap?.server ? state.snap.server.conn : null;
  try {
    const conn = await call('connect', { args: { ...args, conn: reuse } });
    state.connArgs.set(conn, args);
    state.phases.set(conn, 'connecting');
    conv(conn);
    state.multi.clear();
    state.treeJson = '';
    setStatus('busy', `Verbinde mit ${args.server} …`);
    await poll(true);
    renderTabs();
    renderMessages(true);
  } catch { /* toast shown */ }
}

$('#dlg-connect').addEventListener('close', async () => {
  const dlg = $('#dlg-connect');
  if (dlg.returnValue !== 'ok') return;
  const f = $('#form-connect');
  const args = {
    server: f.elements.server.value.trim(),
    nickname: f.elements.nickname.value.trim(),
    password: f.elements.password.value,
    channel: f.elements.channel.value.trim(),
    channel_password: f.elements.channel_password.value,
  };
  localStorage.setItem('rs.connect', JSON.stringify({ server: args.server, nickname: args.nickname, channel: args.channel }));
  if (f.elements.bookmark.checked) {
    saveBookmarks([...bookmarks().filter(b => b.server !== args.server), { name: args.server, server: args.server, nickname: args.nickname, channel: args.channel, password: args.password }]);
    toast('Zu Favoriten hinzugefügt', 'ok');
  }
  doConnect(args, f.elements.new_tab.checked);
});

function reconnectOrOpen() {
  const s = srv();
  if (!s) return openConnect();
  const saved = JSON.parse(localStorage.getItem('rs.connect') || '{}');
  openConnect(false, { server: s.address, nickname: saved.nickname, channel: saved.channel });
}

$('#btn-connect').onclick = () => openConnect(false);

async function addBookmark() {
  const s = srv();
  const saved = JSON.parse(localStorage.getItem('rs.connect') || '{}');
  const r = await formDialog(`${icon('star')}Favorit hinzufügen`, [
    { name: 'name', label: 'Name', value: s.server_name || s.address, required: true },
    { name: 'server', label: 'Adresse', value: s.address, required: true },
    { name: 'nickname', label: 'Spitzname', value: me()?.nickname || saved.nickname },
    { name: 'password', label: 'Server-Passwort', type: 'password' },
    { name: 'channel', label: 'Standardchannel', value: channelById(me()?.channel)?.name || '' },
  ], 'Speichern');
  if (!r) return;
  saveBookmarks([...bookmarks().filter(b => b.server !== r.server), r]);
  toast('Favorit gespeichert', 'ok');
}

async function manageBookmarks() {
  const html = `<table><tr><th>Name</th><th>Adresse</th><th>Spitzname</th><th></th></tr>${bookmarks().map((b, i) =>
    `<tr><td>${esc(b.name)}</td><td>${esc(b.server)}</td><td>${esc(b.nickname || '')}</td><td><button type="button" class="tb-btn small danger" data-bm="${i}">Entfernen</button></td></tr>`).join('')}</table>`;
  const p = formDialog(`${icon('star')}Favoriten`, [{ type: 'html', name: 'x', html }], '', { wide: true, cancel: 'Schließen' });
  $('#form-fields').querySelectorAll('[data-bm]').forEach(b => b.addEventListener('click', () => {
    const list = bookmarks();
    list.splice(Number(b.dataset.bm), 1);
    saveBookmarks(list);
    b.closest('tr').remove();
  }));
  await p;
}

// ------------------------------------------------------------------ hotkeys, audio cues, poke dialog

listen('hotkey', ({ payload }) => {
  if (payload === 'toggle_mic') toggleMic();
  if (payload === 'toggle_speaker') toggleSpeaker();
  if (payload === 'toggle_away') toggleAway();
});

/** Mic clicks (own / others) and the "your mic is muted" hint, driven by the poll loop. */
function audioCues(snap) {
  if (typeof UI === 'undefined') return;
  const tx = snap.transmitting && !state.audio?.mic_muted;
  if (tx !== state.lastTx && UI.playback.ownClicks && snap.server?.connected) Sounds.click(tx);
  state.lastTx = tx;
  const talking = new Set((snap.server?.clients || []).filter(c => c.talking && c.id !== snap.server.own_id).map(c => c.id));
  if (UI.playback.otherClicks) {
    for (const id of talking) if (!state.talkingIds.has(id)) Sounds.click(true);
    for (const id of state.talkingIds) if (!talking.has(id)) Sounds.click(false);
  }
  state.talkingIds = talking;
  const thr = state.audio?.threshold_db ?? -45;
  if (UI.app.mutedMicHint && state.audio?.mic_muted && snap.server?.connected && snap.mic_level_db > Math.max(thr, -40) && Date.now() - state.lastMutedHint > 6000) {
    state.lastMutedHint = Date.now();
    Sounds.play('mic_muted_hint');
  }
}

function pokeDialog(conn, text) {
  const m = /^(.*) stupst dich an: ([\s\S]*)$/.exec(text);
  const who = m ? m[1] : '';
  const body = bbcode(m ? m[2] : text) || '<span class="hint">(keine Nachricht)</span>';
  formDialog(icon('hand') + 'Angestupst', [{ type: 'html', name: 'x', html: '<p><b>' + esc(who) + '</b> stupst dich an:</p><div class="desc">' + body + '</div>' }], who ? 'Antworten' : '', { cancel: 'Schließen' }).then(r => {
    if (!r || !who) return;
    const c = state.snap?.server?.clients.find(c => c.nickname === who);
    if (c && conn === activeConn()) openPrivate(c.id);
  });
}

// ------------------------------------------------------------------ custom controls (slider fill)

/** Sliders show their filled part in the accent colour. */
function updateRangeFills(root = document) {
  root.querySelectorAll('input[type=range]').forEach(r => {
    const pct = ((r.value - (r.min || 0)) / ((r.max || 100) - (r.min || 0))) * 100;
    r.style.setProperty('--fill', `${pct}%`);
  });
}
document.addEventListener('input', e => {
  if (e.target.matches?.('input[type=range]')) updateRangeFills(e.target.parentElement);
});
new MutationObserver(() => updateRangeFills()).observe(document.body, { childList: true, subtree: true });

// ------------------------------------------------------------------ splitters

(() => {
  const v = $('#split-v'), h = $('#split-h'), panel = $('.tree-panel'), chat = $('.chat-panel');
  let dv = false, dh = false;
  v.addEventListener('mousedown', e => { dv = true; e.preventDefault(); });
  h.addEventListener('mousedown', e => { dh = true; e.preventDefault(); });
  window.addEventListener('mouseup', () => (dv = dh = false));
  window.addEventListener('mousemove', e => {
    if (dv) panel.style.width = Math.max(240, Math.min(e.clientX, innerWidth - 360)) + 'px';
    if (dh) chat.style.height = Math.max(120, Math.min(chat.getBoundingClientRect().bottom - e.clientY, innerHeight - 260)) + 'px';
  });
})();

// ------------------------------------------------------------------ polling loop

function levelToPct(db) {
  return Math.max(0, Math.min(100, ((db + 70) / 60) * 100));
}

async function poll(once = false) {
  try {
    const snap = await invoke('get_state');
    state.snap = snap;
    const meterBar = $('#meter-bar');
    meterBar.style.width = levelToPct(snap.mic_level_db) + '%';
    meterBar.classList.toggle('tx', snap.transmitting);
    $('#meter-thr').style.left = state.audio?.mode === 'va' && !state.audio?.vad_ai ? levelToPct(state.audio.threshold_db) + '%' : '-10px';
    const smb = $('#set-meter-bar');
    if (smb) {
      smb.style.width = levelToPct(snap.mic_level_db) + '%';
      smb.classList.toggle('tx', snap.transmitting);
    }
    const spb = $('#set-prob-bar');
    if (spb) spb.style.width = Math.round(snap.speech_prob * 100) + '%';
    audioCues(snap);
    const ae = $('#audio-error');
    ae.hidden = !snap.audio_error;
    ae.textContent = snap.audio_error ? `Audio: ${snap.audio_error}` : '';
    ae.title = ae.textContent;
    const s = snap.server;
    $('#ping').textContent = s?.connected && s.ping_ms != null ? `Ping ${Math.round(s.ping_ms)} ms` : '';
    if (s?.phase === 'connected') setStatus('on', `Verbunden mit ${s.server_name || s.address}`);
    else if (!s) setStatus('off', 'Nicht verbunden');
    // Drop multi selection entries of clients that left
    for (const id of state.multi) if (!s?.clients.some(c => c.id === id)) state.multi.delete(id);
    // Re-render only on change, and never while dragging (keeps the drop target stable).
    const json = JSON.stringify([snap.active, snap.connections, s && { ...s, ping_ms: 0 }, ICON_CACHE.size]);
    if (json !== state.treeJson && !state.drag?.active) {
      state.treeJson = json;
      renderTree();
      renderInfo();
      renderTabs();
      renderServerTabs();
      updateButtons();
      updateChatInput();
      if (typeof Stage !== 'undefined') Stage.update();
    }
  } catch (e) {
    console.error(e);
  }
  if (!once) setTimeout(poll, 100);
}

// ------------------------------------------------------------------ init

(async () => {
  hydrateIcons();
  state.audio = await invoke('get_audio_config');
  conv(0);
  renderTabs();
  renderMessages(true);
  updateButtons();
  updateChatInput();
  renderTree();
  renderInfo();
  updateRangeFills();
  addMessage(0, 'server', { kind: 'info', text: 'Willkommen bei RustSpeak. Verbinde dich über das Menü „Verbindungen“ oder wähle einen Favoriten.' });
  conv(0).tabs.get('server').unread = 0;
  poll();
})();

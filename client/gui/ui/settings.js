// Settings window (TeamSpeak-style options) and rights window (simple + expert view).
// Loaded after app.js and shares its globals (state, call, ts, Sounds, ...).

// ================================================================== UI settings (local)

const UI_DEFAULTS = {
  app: {
    micOnTabSwitch: false,
    autoReconnect: true,
    middleClick: true,
    updateBookmarkNick: false,
    alwaysOnTop: false,
    autoOpenChannelChat: false,
    expertRights: false,
    mutedMicHint: true,
    noPokeDialog: false,
    language: 'de',
  },
  playback: { ownClicks: false, otherClicks: false },
  design: { accent: 'blau', fontSize: 14, compactTree: false, groupText: true },
  chat: { timestamps: true, events: true },
  hotkeys: { toggle_mic: 0, toggle_speaker: 0, toggle_away: 0 },
};

const ACCENTS = {
  blau: ['#4f7cff', '#7c5cff', 'Blau / Lila'],
  tuerkis: ['#14b8a6', '#0ea5e9', 'Türkis'],
  gruen: ['#22c55e', '#10b981', 'Grün'],
  orange: ['#f97316', '#f59e0b', 'Orange'],
  rot: ['#ef4444', '#ec4899', 'Rot / Pink'],
  grau: ['#64748b', '#94a3b8', 'Grau'],
};

function loadUi() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('rs.ui') || '{}'); } catch {}
  const ui = structuredClone(UI_DEFAULTS);
  for (const k of Object.keys(ui)) Object.assign(ui[k], saved[k] || {});
  return ui;
}
UI = loadUi();

function applyUi() {
  const [a1, a2] = ACCENTS[UI.design.accent] || ACCENTS.blau;
  const root = document.documentElement.style;
  root.setProperty('--accent', a1);
  root.setProperty('--accent-2', a2);
  document.body.style.fontSize = UI.design.fontSize + 'px';
  $('#tree').classList.toggle('compact', UI.design.compactTree);
  document.body.classList.toggle('no-group-text', !UI.design.groupText);
  $('#messages').classList.toggle('no-time', !UI.chat.timestamps);
  try { window.__TAURI__.window.getCurrentWindow().setAlwaysOnTop(UI.app.alwaysOnTop); } catch {}
  invoke('set_hotkeys', { keys: UI.hotkeys }).catch(() => {});
  if (typeof setLanguage === 'function' && UI.app.language !== LANG) setLanguage(UI.app.language);
}

function saveUi() {
  localStorage.setItem('rs.ui', JSON.stringify(UI));
  applyUi();
}

// ================================================================== key names

const VK_NAMES = { 0x05: 'Maustaste 4', 0x06: 'Maustaste 5', 0x10: 'Umschalt', 0x11: 'Strg', 0x12: 'Alt', 0x14: 'Feststelltaste', 0x20: 'Leertaste', 0x13: 'Pause', 0x91: 'Rollen', 0x2D: 'Einfg', 0x24: 'Pos1', 0x23: 'Ende', 0x21: 'Bild ↑', 0x22: 'Bild ↓', 0xA0: 'Umschalt links', 0xA1: 'Umschalt rechts', 0xA2: 'Strg links', 0xA3: 'Strg rechts', 0xA4: 'Alt links', 0xA5: 'Alt Gr' };
function vkName(vk) {
  if (!vk) return 'Keine';
  if (VK_NAMES[vk]) return VK_NAMES[vk];
  if ((vk >= 0x30 && vk <= 0x39) || (vk >= 0x41 && vk <= 0x5a)) return String.fromCharCode(vk);
  if (vk >= 0x70 && vk <= 0x87) return 'F' + (vk - 0x6f);
  if (vk >= 0x60 && vk <= 0x69) return 'Num ' + (vk - 0x60);
  return `Taste ${vk}`;
}
const CODE_VK = { ShiftLeft: 0xA0, ShiftRight: 0xA1, ControlLeft: 0xA2, ControlRight: 0xA3, AltLeft: 0xA4, AltRight: 0xA5, CapsLock: 0x14, Space: 0x20 };
let capturing = null; // callback(vk) while waiting for a key

window.addEventListener('keydown', e => {
  if (!capturing) return;
  e.preventDefault();
  e.stopPropagation();
  const cb = capturing;
  capturing = null;
  cb(e.key === 'Escape' ? 0 : CODE_VK[e.code] || e.keyCode);
}, true);
window.addEventListener('mousedown', e => {
  if (!capturing || e.button < 3) return;
  e.preventDefault();
  const cb = capturing;
  capturing = null;
  cb(e.button === 3 ? 0x05 : 0x06);
}, true);

// ================================================================== settings window

const dbToLin = db => Math.pow(10, db / 20);
const linToDb = v => (v <= 0.0001 ? -40 : Math.round(20 * Math.log10(v) * 10) / 10);

const SETTINGS_PAGES = [
  ['app', 'Anwendung', 'Allgemeine Anwendungseinstellungen', 'settings'],
  ['playback', 'Wiedergabe', 'Ändern der Wiedergabeeinstellungen', 'speaker'],
  ['capture', 'Aufnahme', 'Mikrofon und Sprachübertragung', 'mic'],
  ['design', 'Design', 'Farben, Schrift und Darstellung', 'image'],
  ['hotkeys', 'Hotkeys', 'Globale Tastenkürzel', 'key'],
  ['chat', 'Chat', 'Darstellung des Chats', 'message'],
  ['notify', 'Meldungen', 'Sprachansagen und Töne', 'speaker'],
  ['security', 'Sicherheit', 'Identität und Sicherheitslevel', 'shield'],
];

const sw = (key, label, checked, hint = '') =>
  `<label class="switch"><input type="checkbox" data-k="${key}" ${checked ? 'checked' : ''}><span class="sw"></span><span class="sw-label">${label}${hint ? `<span class="hint"> – <span>${hint}</span></span>` : ''}</span></label>`;
const section = (title, body) => `<section class="opt-sec"><h4>${title}</h4>${body}</section>`;

/** Draft copy of all settings while the window is open */
let sd = null;

async function openSettings() {
  const devs = await call('list_devices');
  let autostart = false;
  try { autostart = await invoke('get_autostart'); } catch {}
  sd = { ui: structuredClone(UI), audio: { ...state.audio }, sounds: { ...Sounds.cfg }, autostart, devs, page: sd?.page || 'app' };
  const dlg = $('#dlg-settings');
  $('#opt-nav').innerHTML = SETTINGS_PAGES.map(([id, title, , ic]) => `<button type="button" class="opt-nav-btn" data-page="${id}">${icon(ic)}<span>${title}</span></button>`).join('');
  renderSettingsPage();
  dlg.showModal();
}

$('#opt-nav').addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (!b) return;
  sd.page = b.dataset.page;
  renderSettingsPage();
});

function renderSettingsPage() {
  const [id, title, sub, ic] = SETTINGS_PAGES.find(p => p[0] === sd.page);
  document.querySelectorAll('.opt-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  $('#opt-head').innerHTML = `<div><div class="opt-title">${title}</div><div class="opt-sub">${sub}</div></div>${icon(ic, 'opt-head-ic')}`;
  const a = sd.audio, u = sd.ui, s = sd.sounds;
  let html = '';
  switch (id) {
    case 'app':
      html = `<div class="opt-cols"><div>
        ${section('Server', sw('ui.app.micOnTabSwitch', 'Mikrofon beim Wechseln des Servers automatisch aktivieren', u.app.micOnTabSwitch) +
          sw('ui.app.autoReconnect', 'Nach Verbindungsverlust automatisch neu verbinden', u.app.autoReconnect) +
          sw('ui.app.middleClick', 'Mittlere Maustaste als Schnellzugriff im Baum benutzen', u.app.middleClick, 'Channel betreten / Nachricht') +
          sw('ui.app.updateBookmarkNick', 'Spitznamen in Favoriten automatisch aktualisieren', u.app.updateBookmarkNick))}
        ${section('Verschiedenes', sw('ui.app.alwaysOnTop', 'Immer im Vordergrund', u.app.alwaysOnTop) +
          sw('ui.app.autoOpenChannelChat', 'Channel-Chat bei neuen Nachrichten automatisch öffnen', u.app.autoOpenChannelChat) +
          sw('ui.app.expertRights', 'Fortgeschrittenes Rechtesystem (Expertenansicht mit einzelnen Rechten)', u.app.expertRights) +
          sw('ui.app.mutedMicHint', 'Akustischen Hinweis abspielen, wenn das Mikrofon gemutet ist', u.app.mutedMicHint) +
          sw('sd.autostart', 'RustSpeak automatisch mit Windows starten', sd.autostart) +
          sw('ui.app.noPokeDialog', 'Anstupsen-Dialog nie zeigen (nur Hinweis unten rechts)', u.app.noPokeDialog))}
      </div><div>
        ${section('Anzeigesprache', `<select data-k="ui.app.language" data-notr>${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${u.app.language === k ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
        ${section('Daten', `<p class="hint">Identität, Audio-Einstellungen und Favoriten werden lokal gespeichert.</p>
          <button type="button" class="tb-btn small" id="opt-reset-ui">${icon('trash')}Darstellung und Optionen zurücksetzen</button>`)}
      </div></div>`;
      break;
    case 'playback':
      html = `<label class="opt-row">Wiedergabegerät<select data-k="audio.output_device">${devOptions(sd.devs.outputs, a.output_device)}</select></label>
        <div class="db-slider"><div class="db-top"><span>Leise</span><b>Sprachlautstärke</b><span>Laut</span></div>
          <div class="db-row"><input type="range" min="-30" max="12" step="0.5" value="${linToDb(a.volume)}" data-k="audio.volume_db"><output class="db-val"></output></div></div>
        <div class="db-slider"><div class="db-top"><span>Leise</span><b>Lautstärke des Sound Packs</b><span>Laut</span></div>
          <div class="db-row"><input type="range" min="-40" max="0" step="0.5" value="${linToDb(s.volume)}" data-k="sounds.volume_db"><output class="db-val"></output></div></div>
        <button type="button" class="tb-btn primary small" id="opt-test-sound">${icon('speaker')}Test Ton abspielen</button>
        ${section('Optionen', sw('audio.playback_agc', 'Automatische Lautstärkeanpassung (andere Sprecher angleichen)', a.playback_agc) +
          sw('ui.playback.ownClicks', 'Eigener Client spielt Mikro-Klicks', u.playback.ownClicks) +
          sw('ui.playback.otherClicks', 'Andere Clients spielen Mikro-Klicks', u.playback.otherClicks) +
          sw('audio.comfort_noise', 'Comfort Noise (leises Grundrauschen in Sprechpausen)', a.comfort_noise) +
          `<div class="db-row small"><span class="hint">Leise</span><input type="range" min="-80" max="-30" step="1" value="${a.comfort_noise_db}" data-k="audio.comfort_noise_db"><span class="hint">Laut</span><output class="db-val"></output></div>`)}`;
      break;
    case 'capture':
      html = `<label class="opt-row">Mikrofon<select data-k="audio.input_device">${devOptions(sd.devs.inputs, a.input_device)}</select></label>
        ${section('Sprachübertragung', `<div class="seg">
            ${[['va', 'Sprachaktivierung'], ['ptt', 'Push-to-Talk'], ['always', 'Dauerhaft']].map(([v, l]) => `<label><input type="radio" name="opt-mode" value="${v}" ${a.mode === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          </div>
          <div class="opt-mode-va" ${a.mode === 'va' ? '' : 'hidden'}>
            ${sw('audio.vad_ai', 'KI-Spracherkennung statt Pegelschwelle (RNNoise-VAD)', a.vad_ai)}
            <div class="opt-thr" ${a.vad_ai ? 'hidden' : ''}><div class="db-top"><span>Empfindlich</span><b>Aktivierungsschwelle</b><span>Unempfindlich</span></div>
              <div class="meter big"><div id="set-meter-bar" class="meter-bar"></div><div id="set-meter-thr" class="meter-thr"></div></div>
              <div class="db-row"><input type="range" min="-70" max="-10" step="1" value="${a.threshold_db}" data-k="audio.threshold_db"><output class="db-val"></output></div></div>
            <div class="opt-prob" ${a.vad_ai ? '' : 'hidden'}><span class="hint">Spracherkennung</span><div class="meter big"><div id="set-prob-bar" class="meter-bar prob-bar"></div></div></div>
          </div>
          <div class="opt-mode-ptt" ${a.mode === 'ptt' ? '' : 'hidden'}>
            <label class="opt-row">Push-to-Talk-Taste <button type="button" class="tb-btn small" data-capture="audio.ptt_key">${vkName(a.ptt_key)}</button></label>
            <p class="hint">Die Taste wirkt global, auch wenn RustSpeak im Hintergrund ist.</p>
          </div>`)}
        ${section('Verarbeitung', sw('audio.noise_suppression', 'Rauschunterdrückung (RNNoise)', a.noise_suppression) +
          sw('audio.auto_gain', 'Automatische Lautstärkeanpassung des Mikrofons (AGC)', a.auto_gain) +
          `<div class="db-slider"><div class="db-top"><span>Leise</span><b>Mikrofonverstärkung</b><span>Laut</span></div>
            <div class="db-row"><input type="range" min="-20" max="12" step="0.5" value="${linToDb(a.mic_gain)}" data-k="audio.mic_gain_db"><output class="db-val"></output></div></div>
          <button type="button" class="tb-btn small${state.snap?.mic_test ? ' active-ok' : ''}" id="opt-mic-test">${icon('mic')}<span>${state.snap?.mic_test ? 'Test beenden' : 'Mikrofon testen'}</span></button>`)}`;
      break;
    case 'design':
      html = `${section('Akzentfarbe', `<div class="accent-grid">${Object.entries(ACCENTS).map(([k, [c1, c2, n]]) =>
          `<label class="accent-opt"><input type="radio" name="opt-accent" value="${k}" ${u.design.accent === k ? 'checked' : ''}><span class="accent-sw" style="background:linear-gradient(135deg,${c1},${c2})"></span><span>${n}</span></label>`).join('')}</div>`)}
        ${section('Darstellung', `<label class="opt-row">Schriftgröße<select data-k="ui.design.fontSize">${[12, 13, 14, 15, 16].map(v => `<option value="${v}" ${u.design.fontSize == v ? 'selected' : ''}>${v} px${v === 14 ? ' (Standard)' : ''}</option>`).join('')}</select></label>` +
          sw('ui.design.compactTree', 'Kompakter Channelbaum', u.design.compactTree) +
          sw('ui.design.groupText', 'Gruppen ohne Icon als Kürzel anzeigen (SA, CA, OP …)', u.design.groupText))}`;
      break;
    case 'hotkeys':
      html = section('Globale Hotkeys', `<p class="hint">Hotkeys funktionieren auch, wenn RustSpeak im Hintergrund ist. Klicke auf eine Taste und drücke die gewünschte Taste (Esc = keine).</p>
        <table class="hk-table">
          ${[['audio.ptt_key', 'Push-to-Talk (nur im Modus Push-to-Talk)', a.ptt_key], ['ui.hotkeys.toggle_mic', 'Mikrofon an/aus', u.hotkeys.toggle_mic], ['ui.hotkeys.toggle_speaker', 'Lautsprecher an/aus', u.hotkeys.toggle_speaker], ['ui.hotkeys.toggle_away', 'Abwesend an/aus', u.hotkeys.toggle_away]]
            .map(([k, l, v]) => `<tr><td>${l}</td><td><button type="button" class="tb-btn small" data-capture="${k}">${vkName(v)}</button></td></tr>`).join('')}
        </table>
        <p class="hint">Im Fenster gelten zusätzlich Strg+M (Mikrofon) und Strg+D (Lautsprecher).</p>`);
      break;
    case 'chat':
      html = section('Chat', sw('ui.chat.timestamps', 'Zeitstempel anzeigen', u.chat.timestamps) +
        sw('ui.chat.events', 'Channel-Ereignisse (Betreten, Verlassen, Verschieben) im Channel-Chat anzeigen', u.chat.events) +
        sw('ui.app.autoOpenChannelChat', 'Channel-Chat bei neuen Nachrichten automatisch öffnen', u.app.autoOpenChannelChat));
      break;
    case 'notify':
      html = `${section('Klänge', `<div class="seg">${[['pack', 'Soundpack'], ['voice', 'Sprachansagen'], ['tones', 'Töne'], ['off', 'Aus']].map(([v, l]) => `<label><input type="radio" name="opt-sound" value="${v}" ${s.mode === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
          <label class="opt-row">Stimme<select data-k="sounds.voice"><option value="">Automatisch (Deutsch)</option>${Sounds.voices().map(v => `<option ${v.name === s.voice ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
          <button type="button" class="tb-btn small" id="opt-test-sound">${icon('speaker')}Probe anhören</button>`)}
        ${section('Ereignisse', sw('sounds.messages', 'Ton bei Channel- und Servernachrichten', s.messages) +
          sw('sounds.serverEvents', 'Ansage, wenn Benutzer den Server betreten/verlassen', s.serverEvents))}`;
      break;
    case 'security':
      html = section('Identität', `<div id="opt-identity" class="hint">Lade …</div>
        <div class="row-btns"><label class="opt-row inline">Ziel-Level <input type="number" id="opt-id-level" min="8" max="32" value="20"></label>
        <button type="button" class="tb-btn small" id="opt-id-improve">${icon('shield')}Sicherheitslevel erhöhen</button></div>
        <p class="hint">Ein höheres Level wird von manchen Servern verlangt. Die Berechnung kann bei Level 25+ mehrere Minuten dauern.</p>`);
      break;
  }
  $('#opt-body').innerHTML = html;
  syncSettingsLabels();
  if (id === 'security') loadIdentity();
}

function devOptions(list, cur) {
  return `<option value="">Standardgerät</option>` + list.map(d => `<option ${d === cur ? 'selected' : ''}>${esc(d)}</option>`).join('');
}

function syncSettingsLabels() {
  $('#opt-body').querySelectorAll('.db-row').forEach(r => {
    const inp = r.querySelector('input[type=range]'), out = r.querySelector('output');
    if (!inp || !out) return;
    const v = Number(inp.value);
    out.textContent = `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
    out.classList.toggle('pos', v > 0);
    out.classList.toggle('neg', v < 0);
  });
  const thr = $('#set-meter-thr');
  if (thr) thr.style.left = levelToPct(sd.audio.threshold_db) + '%';
  updateRangeFills($('#opt-body'));
}

function setDraft(key, value) {
  const [root, ...path] = key.split('.');
  if (root === 'sd') return (sd[path[0]] = value);
  if (root === 'audio') {
    if (path[0] === 'volume_db') return (sd.audio.volume = dbToLin(value));
    if (path[0] === 'mic_gain_db') return (sd.audio.mic_gain = dbToLin(value));
    sd.audio[path[0]] = value;
    return;
  }
  if (root === 'sounds') {
    if (path[0] === 'volume_db') return (sd.sounds.volume = dbToLin(value));
    sd.sounds[path[0]] = value;
    return;
  }
  if (root === 'ui') sd.ui[path[0]][path[1]] = value;
}

$('#opt-body').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.k) {
    let v = t.type === 'checkbox' ? t.checked : t.type === 'range' || t.type === 'number' ? Number(t.value) : t.value;
    if (t.dataset.k.endsWith('fontSize')) v = Number(v);
    if (t.dataset.k.endsWith('_device')) v = v || null;
    setDraft(t.dataset.k, v);
  }
  if (t.name === 'opt-mode') {
    sd.audio.mode = t.value;
    $('#opt-body .opt-mode-va').hidden = t.value !== 'va';
    $('#opt-body .opt-mode-ptt').hidden = t.value !== 'ptt';
  }
  if (t.name === 'opt-sound') sd.sounds.mode = t.value;
  if (t.name === 'opt-accent') {
    sd.ui.design.accent = t.value;
    const [c1, c2] = ACCENTS[t.value];
    document.documentElement.style.setProperty('--accent', c1); // preview
    document.documentElement.style.setProperty('--accent-2', c2);
  }
  if (t.dataset.k === 'audio.vad_ai') {
    $('#opt-body .opt-thr').hidden = t.checked;
    $('#opt-body .opt-prob').hidden = !t.checked;
  }
  syncSettingsLabels();
  // Live preview of audio processing (devices change on apply)
  call('set_audio_config', { cfg: { ...sd.audio, input_device: state.audio.input_device, output_device: state.audio.output_device } });
});

$('#opt-body').addEventListener('click', async e => {
  const cap = e.target.closest('[data-capture]');
  if (cap) {
    cap.textContent = 'Taste drücken …';
    capturing = vk => {
      setDraft(cap.dataset.capture, vk);
      cap.textContent = vkName(vk);
    };
    return;
  }
  if (e.target.closest('#opt-test-sound')) {
    const old = { ...Sounds.cfg };
    Object.assign(Sounds.cfg, sd.sounds);
    if (Sounds.cfg.mode === 'off') Sounds.cfg.mode = 'tones';
    Sounds.play(Sounds.cfg.mode === 'pack' ? 'test' : 'user_joined_channel');
    Object.assign(Sounds.cfg, old);
  }
  if (e.target.closest('#opt-mic-test')) {
    const on = !state.snap?.mic_test;
    await call('set_mic_test', { on });
    const b = $('#opt-mic-test');
    b.classList.toggle('active-ok', on);
    b.querySelector('span').textContent = on ? 'Test beenden' : 'Mikrofon testen';
  }
  if (e.target.closest('#opt-reset-ui')) {
    sd.ui = structuredClone(UI_DEFAULTS);
    renderSettingsPage();
  }
  if (e.target.closest('#opt-id-improve')) {
    const level = Number($('#opt-id-level').value);
    const box = $('#opt-identity');
    box.textContent = `Berechne Level ${level} … (die Verbindung bleibt bestehen)`;
    try {
      const id = await invoke('improve_identity', { level });
      showIdentity(id);
      toast(`Sicherheitslevel jetzt ${id.level}`, 'ok');
    } catch (err) {
      box.textContent = String(err);
    }
  }
});

async function loadIdentity() {
  try { showIdentity(await invoke('get_identity')); } catch (e) { $('#opt-identity').textContent = String(e); }
}
function showIdentity(id) {
  const box = $('#opt-identity');
  if (!box) return;
  box.innerHTML = `<table class="ci"><tr><td class="k">Eindeutige ID</td><td><code>${esc(id.uid)}</code></td></tr>
    <tr><td class="k">Sicherheitslevel</td><td><b>${id.level}</b></td></tr><tr><td class="k">Offset</td><td>${id.offset}</td></tr></table>`;
}

async function applySettings() {
  const oldDevices = [state.audio.input_device, state.audio.output_device].join('|');
  UI = structuredClone(sd.ui);
  saveUi();
  Object.assign(Sounds.cfg, sd.sounds);
  Sounds.save();
  await setAudio({ ...sd.audio });
  if (sd.autostart !== (await invoke('get_autostart').catch(() => sd.autostart))) {
    await call('set_autostart', { on: sd.autostart }).catch(() => {});
  }
  if (oldDevices !== [sd.audio.input_device, sd.audio.output_device].join('|')) toast('Audiogeräte gewechselt', 'ok');
  state.treeJson = '';
}

$('#opt-ok').onclick = async () => {
  await applySettings();
  $('#dlg-settings').close();
};
$('#opt-apply').onclick = applySettings;
$('#opt-cancel').onclick = () => $('#dlg-settings').close();
$('#dlg-settings').addEventListener('close', async () => {
  capturing = null;
  if (state.snap?.mic_test) await call('set_mic_test', { on: false });
  // Undo live previews that were not applied
  await call('set_audio_config', { cfg: state.audio });
  applyUi();
});
$('#btn-settings').onclick = openSettings;

// ================================================================== rights window

/** Simple view: bundles of permissions, like TeamSpeak's simplified rights dialog. */
const BUNDLES = {
  server: [
    { title: 'Den Server administrieren', desc: 'Einstellungen editieren, Banner setzen, Icons verwalten', perms: { b_virtualserver_modify_name: 1, b_virtualserver_modify_welcomemessage: 1, b_virtualserver_modify_maxclients: 1, b_virtualserver_modify_password: 1, b_virtualserver_modify_hostbanner: 1, b_icon_manage: 1 } },
    { title: 'Gruppen verwalten', desc: 'erstellen, löschen, editieren', perms: { b_virtualserver_servergroup_create: 1, b_virtualserver_servergroup_delete: 1, b_virtualserver_channelgroup_create: 1, b_virtualserver_channelgroup_delete: 1, b_virtualserver_servergroup_permission_list: 1, i_group_modify_power: 75 } },
    { title: 'Mitglieder hinzufügen und entfernen', desc: 'Benutzer hinzufügen, Berechtigungsschlüssel verwalten', perms: { i_group_member_add_power: 75, i_group_member_remove_power: 75, b_virtualserver_token_add: 1, b_virtualserver_token_list: 1, b_virtualserver_token_delete: 1 } },
    { title: 'Clients administrieren', desc: 'verschieben, kicken, bannen, IP-Adressen sehen', perms: { i_client_move_power: 50, i_client_kick_from_channel_power: 50, i_client_kick_from_server_power: 50, i_client_ban_power: 50, b_client_ban_list: 1, b_client_ban_delete: 1, b_client_remoteaddress_view: 1 } },
    { title: 'Channel verwalten', desc: 'erstellen, bearbeiten, löschen', perms: { b_channel_create_permanent: 1, b_channel_create_semi_permanent: 1, b_channel_create_child: 1, b_channel_create_with_password: 1, b_channel_modify_name: 1, b_channel_modify_topic: 1, b_channel_modify_description: 1, b_channel_modify_password: 1, b_channel_modify_maxclients: 1, b_channel_modify_codec_quality: 1, b_channel_modify_needed_talk_power: 1, b_channel_modify_needed_join_power: 1, b_channel_modify_make_permanent: 1, b_channel_modify_make_default: 1, b_channel_modify_icon: 1, b_channel_delete_temporary: 1, b_channel_delete_semi_permanent: 1, b_channel_delete_permanent: 1, b_channel_delete_flag_force: 1, b_channel_join_ignore_password: 1, b_channel_join_ignore_maxclients: 1 } },
    { title: 'Grundlagen', desc: 'Nachrichten senden, anstupsen, Channel betreten, sprechen, temporäre Channel erstellen', perms: { b_client_server_textmessage_send: 1, b_client_channel_textmessage_send: 1, i_client_private_textmessage_power: 25, i_client_poke_power: 25, i_channel_join_power: 25, i_client_talk_power: 25, b_channel_create_temporary: 1, b_virtualserver_token_use: 1, b_virtualserver_servergroup_list: 1 } },
    { title: 'Bildschirm und Webcam übertragen', desc: 'in der Channel-Ansicht den Bildschirm oder die Webcam teilen und Übertragungen ansehen', perms: { b_client_video_stream: 1, b_client_video_watch: 1 } },
    { title: 'Vor anderen geschützt', desc: 'kann von Gästen nicht verschoben, gekickt, gebannt oder angestupst werden', perms: { i_client_needed_move_power: 75, i_client_needed_kick_from_channel_power: 75, i_client_needed_kick_from_server_power: 75, i_client_needed_ban_power: 75, i_client_needed_poke_power: 75 } },
  ],
  channel: [
    { title: 'Channel administrieren', desc: 'Channel bearbeiten und löschen, Unterchannel erstellen, Channel-Icon setzen', perms: { b_channel_modify_name: 1, b_channel_modify_topic: 1, b_channel_modify_description: 1, b_channel_modify_password: 1, b_channel_modify_maxclients: 1, b_channel_modify_codec_quality: 1, b_channel_modify_needed_talk_power: 1, b_channel_modify_needed_join_power: 1, b_channel_modify_icon: 1, b_channel_delete_temporary: 1, b_channel_delete_semi_permanent: 1, b_channel_delete_flag_force: 1, b_channel_create_child: 1 } },
    { title: 'Channel moderieren', desc: 'Clients im Channel verschieben und aus dem Channel werfen', perms: { i_client_move_power: 50, i_client_kick_from_channel_power: 50 } },
    { title: 'Channelgruppen vergeben', desc: 'anderen im Channel eine Channelgruppe geben', perms: { i_group_member_add_power: 50, i_group_member_remove_power: 50 } },
    { title: 'Sprechen in moderierten Channels', desc: 'erhöhte Sprechkraft (50)', perms: { i_client_talk_power: 50 } },
    { title: 'Thema bearbeiten', desc: 'Thema und Beschreibung des Channels ändern', perms: { b_channel_modify_topic: 1, b_channel_modify_description: 1 } },
  ],
};

const pe = { kind: 'server', group: null, perms: [], values: new Map(), pending: new Map(), expert: false, members: [], memberSel: null };

/** Effective value of a permission in the editor (pending changes win). */
function peValue(p) {
  return pe.pending.has(p) ? pe.pending.get(p) : pe.values.has(p) ? pe.values.get(p) : null;
}

async function openPermEditor() {
  const conn = activeConn();
  if (!state.permCache.has(conn)) {
    ts('permissionlist', {}, 'Rechteliste');
    const items = await waitNotify('notifypermissionlist');
    if (!items) return toast('Rechteliste nicht verfügbar', 'error');
    state.permCache.set(conn, items);
  }
  pe.perms = state.permCache.get(conn);
  pe.expert = UI.app.expertRights;
  $('#perm-expert').checked = pe.expert;
  $('#perm-title').textContent = `Rechte – ${srv().server_name}`;
  setPermKind('server');
  $('#dlg-perms').showModal();
}

function setPermKind(kind) {
  pe.kind = kind;
  document.querySelectorAll('.perm-kind-tab').forEach(t => t.classList.toggle('active', t.dataset.kind === kind));
  pe.group = permGroups()[0]?.id ?? null;
  renderPermGroups();
  loadGroupPerms();
}

document.querySelectorAll('.perm-kind-tab').forEach(t => t.addEventListener('click', () => {
  if (pe.pending.size && !confirmDiscard()) return;
  setPermKind(t.dataset.kind);
}));
$('#perm-expert').addEventListener('change', e => {
  pe.expert = e.target.checked;
  renderPermMain();
});
$('#perm-close').onclick = () => $('#dlg-perms').close();

const confirmDiscard = () => {
  pe.pending.clear();
  return true;
};

function permGroups() {
  return pe.kind === 'server' ? srv().server_groups : srv().channel_groups;
}

function renderPermGroups() {
  $('#perm-group-list').innerHTML = permGroups().map(g =>
    `<div class="perm-group${g.id === pe.group ? ' active' : ''}" data-g="${g.id}">${g.icon_id ? ico(g.icon_id) : '<span class="ico"></span>'}<span class="gname">${esc(g.name)}</span><span class="gid">${g.kind === 2 ? 'Query' : g.kind === 0 ? 'Vorlage' : ''}</span></div>`).join('');
}

$('#perm-group-list').addEventListener('click', e => {
  const g = e.target.closest('.perm-group');
  if (!g) return;
  pe.pending.clear();
  pe.group = Number(g.dataset.g);
  renderPermGroups();
  loadGroupPerms();
});

async function loadGroupPerms() {
  if (pe.group == null) return;
  const key = pe.kind === 'server' ? 'sgid' : 'cgid';
  const name = pe.kind === 'server' ? 'servergrouppermlist' : 'channelgrouppermlist';
  ts(name, { [key]: pe.group }, 'Gruppenrechte');
  const items = await waitNotify(`notify${name}`);
  pe.values = new Map((items || []).filter(i => i.permsid).map(i => [i.permsid, Number(i.permvalue)]));
  pe.pending.clear();
  renderPermMain();
  loadMembers();
}

function renderPermMain() {
  const g = permGroups().find(g => g.id === pe.group);
  const iconId = peValue('i_icon_id') ?? 0;
  const nameMode = peValue('i_group_show_name_in_tree') ?? 0;
  $('#perm-group-head').innerHTML = g ? `
    <div class="pg-title">${iconId ? ico(iconId >>> 0) : ''}<b>${esc(g.name)}</b><span class="hint">${pe.kind === 'server' ? 'Servergruppe' : 'Channelgruppe'} #${g.id}</span></div>
    <div class="pg-opts">
      <label class="opt-row inline">Icon <button type="button" class="tb-btn small" id="pg-icon-btn">${iconId ? ico(iconId >>> 0) : icon('image')}<span>${iconId ? 'Ändern' : 'Kein Icon'}</span></button></label>
      <label class="opt-row inline">Name im Baum anzeigen <select id="pg-namemode">${[[0, 'Nicht anzeigen'], [1, 'Vor dem Namen'], [2, 'Nach dem Namen']].map(([v, l]) => `<option value="${v}" ${Number(nameMode) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>` : '';
  $('#perm-search-wrap').hidden = !pe.expert;
  if (pe.expert) renderExpertTable();
  else renderBundles();
  $('#perm-apply').disabled = $('#perm-discard').disabled = pe.pending.size === 0;
  $('#perm-pending').textContent = pe.pending.size ? `${pe.pending.size} ungespeicherte Änderung(en)` : '';
}

function bundleState(b) {
  let on = 0;
  const entries = Object.entries(b.perms);
  for (const [p, v] of entries) {
    const cur = peValue(p);
    if (cur != null && cur >= v) on++;
  }
  return on === 0 ? 'off' : on === entries.length ? 'on' : 'some';
}

function renderBundles() {
  const list = BUNDLES[pe.kind];
  $('#perm-table').innerHTML = `<div class="perm-cat">Gruppen-Optionen</div>` + list.map((b, i) => {
    const st = bundleState(b);
    return `<label class="bundle"><input type="checkbox" data-b="${i}" data-state="${st}" ${st === 'on' ? 'checked' : ''}>
      <div><div class="b-title">${esc(b.title)}</div><div class="b-desc">${esc(b.desc)}</div></div></label>`;
  }).join('') + `<p class="hint bundle-hint">Einzelne Rechte und genaue Werte findest du in der Expertenansicht (Schalter oben rechts oder Einstellungen → Anwendung → „Fortgeschrittenes Rechtesystem“).</p>`;
  $('#perm-table').querySelectorAll('[data-state=some]').forEach(cb => (cb.indeterminate = true));
}

function renderExpertTable() {
  const q = $('#perm-search').value.toLowerCase();
  const onlySet = $('#perm-only-set').checked;
  const cats = new Map();
  for (const p of pe.perms) {
    const v = peValue(p.permname);
    if (onlySet && v == null) continue;
    if (q && !p.permname.toLowerCase().includes(q) && !p.permdesc.toLowerCase().includes(q)) continue;
    if (!cats.has(p.permcat)) cats.set(p.permcat, []);
    cats.get(p.permcat).push(p);
  }
  let html = '';
  for (const [cat, list] of cats) {
    html += `<div class="perm-cat">${esc(cat)}</div>`;
    for (const p of list) {
      const v = peValue(p.permname);
      const set = v != null;
      const val = v ?? (p.permname.startsWith('b_') ? 1 : 50);
      const changed = pe.pending.has(p.permname);
      html += `<div class="perm-row${set ? '' : ' unset'}${changed ? ' changed' : ''}" data-p="${p.permname}">
        <input type="checkbox" class="p-set" ${set ? 'checked' : ''} title="Recht setzen">
        <div><div class="pdesc">${esc(p.permdesc)}</div><div class="pname">${esc(p.permname)}</div></div>
        ${p.permname.startsWith('b_') ? `<select class="p-val" ${set ? '' : 'disabled'}><option value="1" ${val > 0 ? 'selected' : ''}>erlaubt</option><option value="0" ${val <= 0 ? 'selected' : ''}>verboten</option></select>`
          : `<input type="number" class="p-val" value="${val}" ${set ? '' : 'disabled'}>`}</div>`;
    }
  }
  $('#perm-table').innerHTML = html || '<p class="hint">Keine passenden Rechte.</p>';
}

$('#perm-search').addEventListener('input', renderExpertTable);
$('#perm-only-set').addEventListener('change', renderExpertTable);

function stage(p, value) {
  const orig = pe.values.has(p) ? pe.values.get(p) : null;
  if (value === orig) pe.pending.delete(p);
  else pe.pending.set(p, value);
}

$('#perm-table').addEventListener('change', e => {
  const b = e.target.closest('[data-b]');
  if (b) {
    const bundle = BUNDLES[pe.kind][Number(b.dataset.b)];
    const turnOn = bundleState(bundle) !== 'on';
    for (const [p, v] of Object.entries(bundle.perms)) {
      const cur = peValue(p);
      if (turnOn) stage(p, cur != null && cur > v ? cur : v);
      else stage(p, null);
    }
    return renderPermMain();
  }
  const row = e.target.closest('.perm-row');
  if (!row) return;
  const p = row.dataset.p;
  const valEl = row.querySelector('.p-val');
  if (e.target.classList.contains('p-set')) stage(p, e.target.checked ? Number(valEl.value) : null);
  else stage(p, Number(valEl.value));
  renderPermMain();
});

$('#perm-group-head').addEventListener('change', e => {
  if (e.target.id === 'pg-namemode') {
    const v = Number(e.target.value);
    stage('i_group_show_name_in_tree', v ? v : null);
    renderPermMain();
  }
});
$('#perm-group-head').addEventListener('click', async e => {
  if (!e.target.closest('#pg-icon-btn')) return;
  const g = permGroups().find(g => g.id === pe.group);
  const r = await pickIcon(`Icon für „${g?.name}“`, peValue('i_icon_id') ?? 0, true);
  if (r == null) return;
  stage('i_icon_id', r ? r | 0 : null);
  renderPermMain();
});

$('#perm-discard').onclick = () => {
  pe.pending.clear();
  renderPermMain();
};

$('#perm-apply').onclick = async () => {
  const key = pe.kind === 'server' ? 'sgid' : 'cgid';
  const prefix = pe.kind === 'server' ? 'servergroup' : 'channelgroup';
  const set = [...pe.pending].filter(([, v]) => v != null);
  const del = [...pe.pending].filter(([, v]) => v == null).map(([p]) => p);
  if (set.length) {
    const [first, ...rest] = set;
    ts(`${prefix}addperm`, { [key]: pe.group, permsid: first[0], permvalue: first[1], permnegated: 0, permskip: 0 }, 'Rechte speichern', activeConn(),
      rest.map(([p, v]) => ({ permsid: p, permvalue: v, permnegated: 0, permskip: 0 })));
  }
  if (del.length) {
    const [first, ...rest] = del;
    ts(`${prefix}delperm`, { [key]: pe.group, permsid: first }, 'Rechte entfernen', activeConn(), rest.map(p => ({ permsid: p })));
  }
  await new Promise(r => setTimeout(r, 300));
  await poll(true);
  renderPermGroups();
  await loadGroupPerms();
  toast('Rechte gespeichert', 'ok');
};

// ----- members (right column)

async function loadMembers() {
  const box = $('#perm-members');
  if (pe.kind !== 'server') {
    pe.members = [];
    box.innerHTML = '<p class="hint">Channelgruppen gelten pro Channel. Vergib sie per Rechtsklick auf einen Client → „Channelgruppe“.</p>';
    $('#pm-add').disabled = $('#pm-remove').disabled = true;
    return;
  }
  ts('servergroupclientlist', { sgid: pe.group }, 'Gruppenmitglieder');
  const items = (await waitNotify('notifyservergroupclientlist')) || [];
  pe.members = items.filter(m => m.cldbid);
  pe.memberSel = null;
  renderMembers();
}

function renderMembers() {
  const q = $('#pm-search').value.toLowerCase();
  const list = pe.members.filter(m => !q || m.client_nickname.toLowerCase().includes(q) || m.client_unique_identifier.toLowerCase().includes(q));
  $('#perm-members').innerHTML = list.map(m => `<div class="m${pe.memberSel === m.cldbid ? ' active' : ''}" data-m="${m.cldbid}" title="${esc(m.client_unique_identifier)}">${icon('user')}<span>${esc(m.client_nickname)}</span></div>`).join('')
    || '<p class="hint">Keine Mitglieder.</p>';
  $('#pm-add').disabled = false;
  $('#pm-remove').disabled = !pe.memberSel;
}

$('#pm-search').addEventListener('input', renderMembers);
$('#perm-members').addEventListener('click', e => {
  const m = e.target.closest('[data-m]');
  if (!m) return;
  pe.memberSel = m.dataset.m;
  renderMembers();
});
$('#pm-remove').onclick = () => {
  if (!pe.memberSel) return;
  ts('servergroupdelclient', { sgid: pe.group, cldbid: pe.memberSel }, 'Mitglied entfernen');
  pe.members = pe.members.filter(m => m.cldbid !== pe.memberSel);
  pe.memberSel = null;
  renderMembers();
};
$('#pm-add').onclick = async () => {
  const online = srv().clients.filter(c => !c.server_groups.includes(pe.group));
  $('#dlg-perms').close();
  const r = await formDialog(`${icon('plus')}Mitglied hinzufügen`, [
    { name: 'client', label: 'Online-Client', type: 'select', value: online[0]?.dbid ?? '', options: [['', '– auswählen –'], ...online.map(c => [c.dbid, c.nickname])] },
    { name: 'dbid', label: 'oder Datenbank-ID', type: 'number', min: 1 },
  ], 'Hinzufügen');
  if (r) {
    const dbid = r.dbid || r.client;
    if (dbid) ts('servergroupaddclient', { sgid: pe.group, cldbid: dbid }, 'Mitglied hinzufügen');
  }
  $('#dlg-perms').showModal();
  setTimeout(loadMembers, 300);
};

// ----- group actions (bottom left)

async function groupAction(action) {
  const prefix = pe.kind === 'server' ? 'servergroup' : 'channelgroup';
  const key = pe.kind === 'server' ? 'sgid' : 'cgid';
  const g = permGroups().find(g => g.id === pe.group);
  $('#dlg-perms').close();
  if (action === 'add' || action === 'copy') {
    const r = await formDialog(action === 'add' ? 'Neue Gruppe' : `Gruppe „${esc(g?.name)}“ kopieren`, [{ name: 'name', label: 'Name', required: true, value: action === 'copy' ? `${g?.name} (Kopie)` : '' }], 'Erstellen');
    if (r) {
      if (action === 'add') ts(`${prefix}add`, { name: r.name }, 'Gruppe erstellen');
      else ts(`${prefix}copy`, { [pe.kind === 'server' ? 'ssgid' : 'scgid']: pe.group, [pe.kind === 'server' ? 'tsgid' : 'tcgid']: 0, name: r.name, type: 1 }, 'Gruppe kopieren');
      pe.group = null;
    }
  } else if (action === 'rename' && g) {
    const r = await formDialog(`Gruppe „${esc(g.name)}“ umbenennen`, [{ name: 'name', label: 'Neuer Name', value: g.name, required: true }], 'Umbenennen');
    if (r) ts(`${prefix}rename`, { [key]: g.id, name: r.name }, 'Gruppe umbenennen');
  } else if (action === 'del' && g) {
    const r = await formDialog(`Gruppe „${esc(g.name)}“ löschen?`, [{ type: 'html', name: 'x', html: '<p class="note">Mitglieder verlieren die Gruppe und deren Rechte.</p>' }], 'Löschen');
    if (r) {
      ts(`${prefix}del`, { [key]: g.id, force: 1 }, 'Gruppe löschen');
      pe.group = null;
    }
  }
  await new Promise(r => setTimeout(r, 300));
  await poll(true);
  if (pe.group == null || !permGroups().some(x => x.id === pe.group)) pe.group = permGroups()[permGroups().length - 1]?.id ?? null;
  $('#dlg-perms').showModal();
  renderPermGroups();
  loadGroupPerms();
}
$('#pg-add').onclick = () => groupAction('add');
$('#pg-copy').onclick = () => groupAction('copy');
$('#pg-rename').onclick = () => groupAction('rename');
$('#pg-del').onclick = () => groupAction('del');
$('#perm-refresh').onclick = async () => {
  await poll(true);
  renderPermGroups();
  loadGroupPerms();
};

applyUi();

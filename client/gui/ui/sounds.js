// Notification sounds: spoken announcements (Windows voices via Web Speech API)
// like TeamSpeak's default sound pack, or synthesized tones.

const SOUND_TEXT = {
  connected: 'Verbunden',
  disconnected: 'Verbindung getrennt',
  connection_lost: 'Verbindung verloren',
  connect_failed: 'Verbindung fehlgeschlagen',
  kicked_server: 'Du wurdest vom Server geworfen',
  banned: 'Du wurdest gebannt',
  channel_switched: 'Channel gewechselt',
  you_were_moved: 'Du wurdest verschoben',
  you_kicked_channel: 'Du wurdest aus dem Channel geworfen',
  user_joined_channel: 'Benutzer hat deinen Channel betreten',
  user_left_channel: 'Benutzer hat deinen Channel verlassen',
  user_kicked_channel: 'Benutzer wurde aus dem Channel geworfen',
  user_kicked_server: 'Benutzer wurde vom Server geworfen',
  user_banned: 'Benutzer wurde gebannt',
  user_lost_connection: 'Benutzer hat die Verbindung verloren',
  user_connected: 'Benutzer verbunden',
  user_disconnected: 'Benutzer hat den Server verlassen',
  poked: 'Du wurdest angestupst',
  message_private: null, // tone only
  message_channel: null,
  message_server: null,
  group_assigned: 'Servergruppe zugewiesen',
  group_removed: 'Servergruppe entfernt',
  channelgroup_assigned: 'Channelgruppe zugewiesen',
  mic_muted: 'Mikrofon stummgeschaltet',
  mic_unmuted: 'Mikrofon aktiviert',
  sound_muted: 'Lautsprecher stummgeschaltet',
  sound_unmuted: 'Lautsprecher aktiviert',
  away: 'Abwesend',
  back: 'Wieder da',
  tab_switched: null,
};

// Sound pack: event -> file in ui/sounds/ (without .mp3)
const SOUND_FILES = {
  connected: 'connected',
  connection_lost: 'connection-lost',
  connect_failed: 'error',
  channel_switched: 'channel-switched',
  you_kicked_channel: 'you-were-kicked-from-the-channel',
  poked: 'hey-wake-up',
  message_private: 'hey',
  group_assigned: 'server-group-assigned',
  group_removed: 'server-group-revoked',
  channelgroup_assigned: 'channel-group-changed',
  mic_muted: 'microphone-muted',
  mic_unmuted: 'microphone-activated',
  mic_muted_hint: 'microphone-muted',
  sound_muted: 'sound-muted',
  sound_unmuted: 'sound-resumed',
  channel_created: 'channel-created',
  channel_deleted: 'channel-deleted',
  channel_edited: 'channel-edited',
  channel_moved: 'channel-moved',
  your_channel_edited: 'your-channel-was-edited',
  server_edited: 'you-edited-the-server',
  talk_power_granted: 'talk-power-granted',
  talk_power_revoked: 'talk-power-revoked',
  insufficient_permissions: 'insufficient-permissions',
  error: 'error',
  test: 'testing-your-playback-sound-system',
  // Locally blocked clients
  blocked_entered: 'blocked-user-entered-your-channel',
  blocked_joined: 'blocked-user-joined-your-channel',
  blocked_left: 'blocked-user-left-your-channel',
  blocked_disconnected: 'blocked-user-disconnected-from-your-channel',
  blocked_timed_out: 'blocked-user-in-your-channel-timed-out',
  blocked_banned: 'blocked-user-in-your-channel-was-banned-from-the-server',
  blocked_kicked_server: 'blocked-user-in-your-channel-was-kicked-from-the-server',
  blocked_kicked_out: 'blocked-user-was-kicked-out-of-your-channel',
  blocked_kicked_to: 'blocked-user-was-kicked-to-your-channel',
  blocked_moved_out: 'blocked-user-was-moved-out-of-your-channel',
  blocked_moved_to: 'blocked-user-was-moved-to-your-channel',
};

Object.assign(SOUND_TEXT, {
  channel_created: 'Channel erstellt',
  channel_deleted: 'Channel gelöscht',
  channel_edited: 'Channel bearbeitet',
  channel_moved: 'Channel verschoben',
  your_channel_edited: 'Dein Channel wurde bearbeitet',
  server_edited: 'Du hast den Server bearbeitet',
  talk_power_granted: 'Rederecht erteilt',
  talk_power_revoked: 'Rederecht entzogen',
  insufficient_permissions: 'Unzureichende Rechte',
  error: 'Fehler',
  test: 'Test der Wiedergabe',
  blocked_entered: 'Blockierter Benutzer hat deinen Channel betreten',
  blocked_joined: 'Blockierter Benutzer ist deinem Channel beigetreten',
  blocked_left: 'Blockierter Benutzer hat deinen Channel verlassen',
  blocked_disconnected: 'Blockierter Benutzer hat die Verbindung getrennt',
  blocked_timed_out: 'Blockierter Benutzer hat die Verbindung verloren',
  blocked_banned: 'Blockierter Benutzer wurde gebannt',
  blocked_kicked_server: 'Blockierter Benutzer wurde vom Server geworfen',
  blocked_kicked_out: 'Blockierter Benutzer wurde aus deinem Channel geworfen',
  blocked_kicked_to: 'Blockierter Benutzer wurde in deinen Channel geworfen',
  blocked_moved_out: 'Blockierter Benutzer wurde aus deinem Channel verschoben',
  blocked_moved_to: 'Blockierter Benutzer wurde in deinen Channel verschoben',
});

// Tone patterns: [frequency Hz, duration ms] pairs
const TONES = {
  connected: [[523, 90], [784, 140]],
  disconnected: [[784, 90], [523, 160]],
  connection_lost: [[440, 120], [330, 120], [262, 200]],
  connect_failed: [[330, 150], [262, 220]],
  kicked_server: [[392, 120], [262, 240]],
  banned: [[300, 150], [200, 300]],
  channel_switched: [[660, 70], [880, 90]],
  you_were_moved: [[880, 70], [660, 90]],
  you_kicked_channel: [[600, 90], [400, 160]],
  user_joined_channel: [[700, 60], [940, 80]],
  user_left_channel: [[940, 60], [700, 80]],
  user_kicked_channel: [[500, 80], [350, 120]],
  user_kicked_server: [[500, 80], [350, 120]],
  user_banned: [[400, 100], [250, 160]],
  user_lost_connection: [[600, 80], [450, 120]],
  user_connected: [[880, 50]],
  user_disconnected: [[660, 50]],
  poked: [[1047, 80], [0, 60], [1047, 80], [0, 60], [1319, 120]],
  message_private: [[988, 70], [1319, 110]],
  message_channel: [[1175, 60]],
  message_server: [[1175, 60]],
  group_assigned: [[523, 70], [659, 70], [784, 120]],
  group_removed: [[784, 70], [523, 120]],
  channelgroup_assigned: [[659, 70], [784, 110]],
  mic_muted: [[440, 60]],
  mic_unmuted: [[660, 60]],
  sound_muted: [[392, 60]],
  sound_unmuted: [[587, 60]],
  away: [[500, 80]],
  back: [[700, 80]],
  channel_created: [[660, 60], [880, 80]],
  channel_deleted: [[880, 60], [660, 80]],
  channel_edited: [[740, 70]],
  channel_moved: [[740, 50], [740, 50]],
  your_channel_edited: [[620, 70], [740, 70]],
  server_edited: [[523, 60], [784, 80]],
  talk_power_granted: [[587, 70], [880, 100]],
  talk_power_revoked: [[880, 70], [587, 100]],
  insufficient_permissions: [[330, 90], [262, 140]],
  error: [[300, 120], [220, 180]],
  test: [[523, 80], [659, 80], [784, 120]],
};

const Sounds = {
  cfg: { mode: 'pack', volume: 0.7, voice: '', messages: false, serverEvents: false },
  ctx: null,
  queue: [],

  load() {
    try { Object.assign(this.cfg, JSON.parse(localStorage.getItem('rs.sounds') || '{}')); } catch {}
    // Switch existing installs to the new sound pack once
    try {
      if (!localStorage.getItem('rs.soundpack')) {
        localStorage.setItem('rs.soundpack', '1');
        if (this.cfg.mode === 'voice') { this.cfg.mode = 'pack'; this.save(); }
      }
    } catch {}
  },

  /** Play a sound pack file; returns false if the event has none. */
  playFile(key) {
    const f = SOUND_FILES[key];
    if (!f) return false;
    try { this.current?.pause(); } catch {}
    const a = new Audio(`sounds/${f}.mp3`);
    a.volume = Math.max(0, Math.min(1, this.cfg.volume));
    a.play().catch(() => {});
    this.current = a;
    return true;
  },
  save() {
    localStorage.setItem('rs.sounds', JSON.stringify(this.cfg));
  },

  voices() {
    return (window.speechSynthesis?.getVoices() || []).filter(v => v.lang?.toLowerCase().startsWith('de')).concat(
      (window.speechSynthesis?.getVoices() || []).filter(v => !v.lang?.toLowerCase().startsWith('de')));
  },

  play(key) {
    if (this.cfg.mode === 'off') return;
    if ((key === 'user_connected' || key === 'user_disconnected') && !this.cfg.serverEvents) return;
    if ((key === 'message_channel' || key === 'message_server') && !this.cfg.messages) return;
    if (this.cfg.mode === 'pack' && this.playFile(key)) return;
    const text = SOUND_TEXT[key];
    if (this.cfg.mode !== 'tones' && text && window.speechSynthesis) {
      this.speak(text);
    } else if (TONES[key]) {
      this.tone(TONES[key]);
    }
  },

  speak(text) {
    const u = new SpeechSynthesisUtterance(text);
    const voices = this.voices();
    const v = voices.find(v => v.name === this.cfg.voice) || voices.find(v => v.lang?.toLowerCase().startsWith('de'));
    if (v) u.voice = v;
    u.lang = v?.lang || 'de-DE';
    u.volume = this.cfg.volume;
    u.rate = 1.1;
    // Keep the queue short: newer announcements replace stale ones.
    if (speechSynthesis.speaking && speechSynthesis.pending) speechSynthesis.cancel();
    speechSynthesis.speak(u);
  },

  tone(pattern) {
    this.ctx ??= new AudioContext();
    let t = this.ctx.currentTime + 0.01;
    for (const [f, ms] of pattern) {
      const d = ms / 1000;
      if (f > 0) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25 * this.cfg.volume, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0005, t + d);
        o.connect(g).connect(this.ctx.destination);
        o.start(t);
        o.stop(t + d + 0.02);
      }
      t += d;
    }
  },
};
Sounds.load();
// Voices load asynchronously in Chromium/WebView2.
window.speechSynthesis?.addEventListener?.('voiceschanged', () => {});

SOUND_TEXT.mic_muted_hint = 'Dein Mikrofon ist stummgeschaltet';
TONES.mic_muted_hint = [[330, 90], [0, 50], [330, 90]];

/** Short "mic click" when a transmission starts (higher) or ends (lower). */
Sounds.click = function (start) {
  if (this.cfg.mode === 'off') return;
  this.tone(start ? [[1600, 18]] : [[1100, 18]]);
};

// ---------------------------------------------------------------- local block list

/** Clients blocked on this PC (by unique id): voice muted, private messages and their sounds hidden. */
const Blocked = {
  map: {}, // uid -> last nickname
  load() {
    try { this.map = JSON.parse(localStorage.getItem('rs.blocked') || '{}') || {}; } catch { this.map = {}; }
    this.sync();
  },
  save() {
    try { localStorage.setItem('rs.blocked', JSON.stringify(this.map)); } catch {}
    this.sync();
  },
  sync() {
    window.__TAURI__?.core?.invoke('set_blocked', { uids: Object.keys(this.map) }).catch(() => {});
  },
  has(c) {
    return !!(c?.uid && this.map[c.uid] != null);
  },
  hasUid(uid) {
    return !!(uid && this.map[uid] != null);
  },
  toggle(c) {
    if (!c?.uid) return;
    if (this.has(c)) delete this.map[c.uid];
    else this.map[c.uid] = c.nickname;
    this.save();
  },
};
Blocked.load();

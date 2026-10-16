// Channel stage: screen sharing and webcams (RustSpeak extension).
//
// Clicking your own channel turns the info area into a stage that shows everybody in
// the channel plus their video streams. Video goes through the server's WebSocket
// relay (token via `videotoken`), encoded and decoded with WebCodecs.

const VIDEO_QUALITY = {
  '720p30': { w: 1280, h: 720, fps: 30, kbps: 2500, label: '720p · 30 FPS' },
  '1080p30': { w: 1920, h: 1080, fps: 30, kbps: 4500, label: '1080p · 30 FPS' },
  '1080p60': { w: 1920, h: 1080, fps: 60, kbps: 7000, label: '1080p · 60 FPS' },
  '1440p60': { w: 2560, h: 1440, fps: 60, kbps: 11000, label: '1440p · 60 FPS' },
  '480p30': { w: 854, h: 480, fps: 30, kbps: 1000, label: '480p · 30 FPS (sparsam)' },
};
const KIND_SCREEN = 0, KIND_CAMERA = 1;
const KIND_NAME = ['Bildschirm', 'Webcam'];

const Video = {
  cfg: { quality: '1080p30', camera: '', autoWatch: true },
  sessions: new Map(), // conn -> session

  load() {
    try { Object.assign(this.cfg, JSON.parse(localStorage.getItem('rs.video') || '{}')); } catch {}
  },
  save() {
    try { localStorage.setItem('rs.video', JSON.stringify(this.cfg)); } catch {}
  },

  session(conn) {
    let s = this.sessions.get(conn);
    if (!s) {
      s = { conn, ws: null, opening: null, clid: 0, list: [], canStream: false, canWatch: false, pubs: new Map(), views: new Map(), error: '' };
      this.sessions.set(conn, s);
    }
    return s;
  },

  /** Streams of `clid` currently announced on `conn`. */
  streamsOf(conn, clid) {
    return (this.sessions.get(conn)?.list || []).filter(x => x.clid === clid);
  },

  /** Open the relay connection for a server tab (once). */
  async ensure(conn) {
    const s = this.session(conn);
    if (s.ws && s.ws.readyState <= 1) return s;
    if (s.opening) return s.opening;
    s.opening = (async () => {
      try {
        const info = state.snap?.connections?.find(c => c.id === conn);
        ts('videotoken', {}, 'Video-Verbindung', conn);
        const items = await waitNotify('notifyvideotoken', conn, 4000);
        const tok = items?.[0];
        if (!tok?.token) throw new Error('Der Server unterstützt keine Video-Übertragung.');
        const host = hostOf(info?.address || srv()?.address || '');
        const ws = new WebSocket(`ws://${host.includes(':') ? `[${host}]` : host}:${tok.port}/`);
        ws.binaryType = 'arraybuffer';
        s.ws = ws;
        await new Promise((resolve, reject) => {
          ws.onopen = () => { ws.send(JSON.stringify({ t: 'auth', token: tok.token })); resolve(); };
          ws.onerror = () => reject(new Error('Video-Relay nicht erreichbar.'));
          setTimeout(() => reject(new Error('Video-Relay antwortet nicht.')), 5000);
        });
        ws.onmessage = e => (typeof e.data === 'string' ? this.onText(s, JSON.parse(e.data)) : this.onFrame(s, e.data));
        ws.onclose = () => this.onClose(s, ws);
        ws.onerror = null;
        s.error = '';
        return s;
      } catch (e) {
        s.error = e.message || String(e);
        s.ws = null;
        Stage.render();
        throw e;
      } finally {
        s.opening = null;
      }
    })();
    return s.opening;
  },

  send(s, msg) {
    if (s.ws?.readyState === 1) s.ws.send(JSON.stringify(msg));
  },

  onText(s, m) {
    switch (m.t) {
      case 'hello': s.clid = m.clid; break;
      case 'streams': {
        s.canStream = m.can_stream;
        s.canWatch = m.can_watch;
        s.list = m.list;
        // Drop viewers of ended streams, reconfigure on codec changes
        for (const [key, v] of s.views) {
          const info = s.list.find(x => skey(x.clid, x.kind) === key);
          if (!info) this.unwatch(s, v.clid, v.kind, true);
          else if (info.codec !== v.codec) this.configureView(s, v, info);
        }
        if (Stage.open && Video.cfg.autoWatch && s.conn === activeConn()) {
          for (const x of s.list) if (x.clid !== s.clid && !s.views.has(skey(x.clid, x.kind)) && !Stage.skipped.has(skey(x.clid, x.kind))) this.watch(s, x.clid, x.kind);
        }
        state.treeJson = '';
        Stage.render();
        break;
      }
      case 'keyframe': {
        const p = s.pubs.get(m.kind);
        if (p?.native) { if (p.id) window.__TAURI__.core.invoke('screen_keyframe', { id: p.id }); }
        else if (p) p.forceKey = true;
        break;
      }
      case 'stopped': {
        const p = s.pubs.get(m.kind);
        if (p && !p.stopping) {
          this.stopPublish(s, m.kind, true);
          toast(`${KIND_NAME[m.kind]}-Übertragung wurde beendet.`);
        }
        break;
      }
      case 'error':
        if (m.msg === 'no_permission') {
          this.stopPublish(s, m.kind, true);
          toast('Dir fehlt das Recht, im Channel zu übertragen.', 'error');
        } else if (m.msg === 'invalid_token') toast('Video-Anmeldung abgelehnt.', 'error');
        break;
    }
  },

  onClose(s, ws) {
    if (s.ws !== ws) return;
    s.ws = null;
    s.list = [];
    for (const k of [...s.pubs.keys()]) this.stopPublish(s, k, true);
    for (const v of [...s.views.values()]) this.unwatch(s, v.clid, v.kind, true);
    state.treeJson = '';
    Stage.render();
    // Reconnect while the stage is open on a connected server
    setTimeout(() => {
      if (Stage.open && s.conn === activeConn() && connected()) this.ensure(s.conn).catch(() => {});
    }, 2000);
  },

  // ---------------------------------------------------------------- publishing

  async startPublish(kind) {
    const s = await this.ensure(activeConn());
    if (!s.canStream) return toast('Dir fehlt das Recht, im Channel zu übertragen (b_client_video_stream).', 'error');
    if (s.pubs.has(kind)) return;
    if (kind === KIND_SCREEN && window.__TAURI__?.core) return this.startNativeScreen(s);
    if (!window.VideoEncoder) return toast('Diese WebView unterstützt keine Video-Kodierung (WebCodecs).', 'error');
    const q = VIDEO_QUALITY[this.cfg.quality] || VIDEO_QUALITY['1080p30'];
    let media;
    try {
      media = kind === KIND_SCREEN
        ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: q.fps, max: q.fps } }, audio: false })
        : await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: Math.min(q.w, 1920) }, height: { ideal: Math.min(q.h, 1080) }, frameRate: { ideal: Math.min(q.fps, 30) }, ...(this.cfg.camera ? { deviceId: { exact: this.cfg.camera } } : {}) },
            audio: false,
          });
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') toast(`${KIND_NAME[kind]}: ${e.message || e.name}`, 'error');
      return;
    }
    const track = media.getVideoTracks()[0];
    if (!track) return;
    try { track.contentHint = kind === KIND_SCREEN ? 'detail' : 'motion'; } catch {}
    const p = { kind, media, track, q, fps: kind === KIND_SCREEN ? q.fps : Math.min(q.fps, 30), encoder: null, codec: '', w: 0, h: 0, forceKey: true, lastKey: 0, lastTs: -1e12, stopping: false, canvas: document.createElement('canvas'), sent: 0, dropped: 0 };
    p.ctx = p.canvas.getContext('2d', { alpha: false });
    s.pubs.set(kind, p);
    track.addEventListener('ended', () => this.stopPublish(s, kind));
    Sounds.tone?.([[880, 50], [1175, 70]]);
    Stage.render();
    this.pump(s, p);
  },

  async pump(s, p) {
    const frameInterval = 1e6 / p.fps;
    const handle = async frame => {
      try {
        if (p.stopping) return;
        if (frame.timestamp - p.lastTs < frameInterval * 0.85) return; // fps limit
        if (p.encoder && p.encoder.encodeQueueSize > 2) { p.dropped++; return; } // encoder busy
        if (s.ws?.readyState !== 1) return;
        // Fit into the quality box, even dimensions for H.264
        const fw = frame.displayWidth, fh = frame.displayHeight;
        const scale = Math.min(1, p.q.w / fw, p.q.h / fh);
        const w = Math.max(2, Math.round((fw * scale) / 2) * 2), h = Math.max(2, Math.round((fh * scale) / 2) * 2);
        if (!p.encoder || w !== p.w || h !== p.h) await this.configureEncoder(s, p, w, h);
        if (!p.encoder) return;
        p.lastTs = frame.timestamp;
        if (p.canvas.width !== w || p.canvas.height !== h) { p.canvas.width = w; p.canvas.height = h; }
        p.ctx.drawImage(frame, 0, 0, w, h);
        const vf = new VideoFrame(p.canvas, { timestamp: frame.timestamp });
        const now = performance.now();
        const key = p.forceKey || now - p.lastKey > 10000;
        if (key) { p.forceKey = false; p.lastKey = now; }
        p.encoder.encode(vf, { keyFrame: key });
        vf.close();
      } finally {
        frame.close();
      }
    };
    if (window.MediaStreamTrackProcessor) {
      const reader = new MediaStreamTrackProcessor({ track: p.track }).readable.getReader();
      p.reader = reader;
      while (!p.stopping) {
        const { value, done } = await reader.read().catch(() => ({ done: true }));
        if (done) break;
        await handle(value);
      }
    } else {
      // Fallback: grab frames from a hidden <video>
      const v = document.createElement('video');
      v.muted = true;
      v.srcObject = p.media;
      await v.play().catch(() => {});
      const step = async () => {
        if (p.stopping) return;
        if (v.videoWidth) await handle(new VideoFrame(v, { timestamp: Math.round(performance.now() * 1000) }));
        v.requestVideoFrameCallback(step);
      };
      v.requestVideoFrameCallback(step);
    }
  },

  /**
   * Screen share captured and H.264-encoded natively (Windows Graphics Capture +
   * OpenH264); the source comes from RustSpeak's own picker instead of the WebView one.
   */
  async startNativeScreen(s) {
    const pick = await pickScreenSource();
    if (!pick || s.pubs.has(KIND_SCREEN)) return;
    const q = VIDEO_QUALITY[this.cfg.quality] || VIDEO_QUALITY['1080p30'];
    const p = { kind: KIND_SCREEN, native: true, id: 0, source: pick, media: null, q, fps: q.fps, codec: 'avc1.42E034', w: 0, h: 0, stopping: false, sent: 0, dropped: 0 };
    s.pubs.set(KIND_SCREEN, p);
    const ch = new window.__TAURI__.core.Channel();
    ch.onmessage = data => this.onNativeChunk(s, p, data);
    try {
      p.id = await window.__TAURI__.core.invoke('screen_start', { source: pick.id, maxW: q.w, maxH: q.h, fps: q.fps, kbps: q.kbps, onChunk: ch });
    } catch (e) {
      s.pubs.delete(KIND_SCREEN);
      toast(`Bildschirm: ${e}`, 'error');
      return Stage.render();
    }
    if (p.stopping) return window.__TAURI__.core.invoke('screen_stop', { id: p.id });
    Sounds.tone?.([[880, 50], [1175, 70]]);
    Stage.render();
  },

  onNativeChunk(s, p, data) {
    if (p.stopping) return;
    const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer || data);
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const type = buf[0], key = buf[1] === 1, w = dv.getUint16(2, true), h = dv.getUint16(4, true);
    if (type === 2) {
      this.stopPublish(s, KIND_SCREEN);
      return toast('Das geteilte Fenster wurde geschlossen.');
    }
    if (type === 3) {
      this.stopPublish(s, KIND_SCREEN);
      return toast(`Bildschirm: ${new TextDecoder().decode(buf.subarray(14))}`, 'error');
    }
    const ws = s.ws;
    if (!ws || ws.readyState !== 1) return;
    if (w !== p.w || h !== p.h) {
      p.w = w;
      p.h = h;
      this.send(s, { t: 'start', kind: p.kind, codec: p.codec, width: w, height: h, fps: p.fps });
    }
    // Congested uplink: drop delta frames and restart with a keyframe
    if (ws.bufferedAmount > 3 * 1024 * 1024 && !key) {
      p.dropped++;
      if (!p.keyPending) { p.keyPending = true; window.__TAURI__.core.invoke('screen_keyframe', { id: p.id }); }
      return;
    }
    if (key) p.keyPending = false;
    const out = new Uint8Array(buf.length - 4);
    out[0] = p.kind;
    out[1] = key ? 1 : 0;
    out.set(buf.subarray(6, 14), 2); // timestamp (u64 LE)
    out.set(buf.subarray(14), 10);
    ws.send(out);
    p.sent += out.length;
  },

  async configureEncoder(s, p, w, h) {
    try { p.encoder?.close(); } catch {}
    p.encoder = null;
    const bitrate = Math.round(p.q.kbps * 1000 * Math.min(1, (w * h) / (p.q.w * p.q.h) + 0.15));
    const base = { width: w, height: h, bitrate, framerate: p.fps, latencyMode: 'realtime', bitrateMode: 'variable' };
    const candidates = [
      { ...base, codec: 'avc1.640034', avc: { format: 'annexb' }, hardwareAcceleration: 'prefer-hardware' },
      { ...base, codec: 'avc1.42E034', avc: { format: 'annexb' } },
      { ...base, codec: 'vp8' },
    ];
    for (const c of candidates) {
      const sup = await VideoEncoder.isConfigSupported(c).catch(() => null);
      if (!sup?.supported) continue;
      const enc = new VideoEncoder({
        output: chunk => this.sendChunk(s, p, chunk),
        error: e => {
          console.error('encoder', e);
          if (p.encoder === enc) { p.encoder = null; p.w = p.h = 0; }
        },
      });
      try { enc.configure(c); } catch { continue; }
      p.encoder = enc;
      p.codec = c.codec;
      p.w = w;
      p.h = h;
      p.forceKey = true;
      this.send(s, { t: 'start', kind: p.kind, codec: c.codec, width: w, height: h, fps: p.fps });
      return;
    }
    toast('Kein passender Video-Encoder gefunden.', 'error');
    this.stopPublish(s, p.kind);
  },

  sendChunk(s, p, chunk) {
    const ws = s.ws;
    if (!ws || ws.readyState !== 1 || p.stopping) return;
    const key = chunk.type === 'key';
    // Congested uplink: drop delta frames and restart with a keyframe
    if (ws.bufferedAmount > 3 * 1024 * 1024 && !key) { p.forceKey = true; p.dropped++; return; }
    const buf = new Uint8Array(10 + chunk.byteLength);
    buf[0] = p.kind;
    buf[1] = key ? 1 : 0;
    new DataView(buf.buffer).setBigUint64(2, BigInt(Math.max(0, Math.round(chunk.timestamp))), true);
    chunk.copyTo(buf.subarray(10));
    ws.send(buf);
    p.sent += buf.length;
  },

  stopPublish(s, kind, remote = false) {
    const p = s.pubs.get(kind);
    if (!p) return;
    p.stopping = true;
    s.pubs.delete(kind);
    try { p.reader?.cancel(); } catch {}
    try { p.encoder?.close(); } catch {}
    p.media?.getTracks().forEach(t => t.stop());
    if (p.native && p.id) window.__TAURI__.core.invoke('screen_stop', { id: p.id });
    if (!remote) this.send(s, { t: 'stop', kind });
    Sounds.tone?.([[1175, 50], [880, 70]]);
    state.treeJson = '';
    Stage.render();
  },

  stopAll(conn) {
    const s = this.sessions.get(conn);
    if (!s) return;
    for (const k of [...s.pubs.keys()]) this.stopPublish(s, k);
    try { s.ws?.close(); } catch {}
  },

  // ---------------------------------------------------------------- viewing

  watch(s, clid, kind) {
    const key = skey(clid, kind);
    if (s.views.has(key) || !window.VideoDecoder) return;
    const info = s.list.find(x => x.clid === clid && x.kind === kind);
    if (!info) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'stage-canvas';
    const v = { clid, kind, key, canvas, ctx: canvas.getContext('2d', { alpha: false }), decoder: null, codec: '', waitKey: true, frames: 0, fps: 0, fpsT: performance.now(), bytes: 0, kbps: 0 };
    s.views.set(key, v);
    Stage.skipped.delete(key);
    this.configureView(s, v, info);
    this.send(s, { t: 'watch', clid, kind });
    Stage.render();
  },

  configureView(s, v, info) {
    try { v.decoder?.close(); } catch {}
    v.codec = info.codec;
    v.waitKey = true;
    v.decoder = new VideoDecoder({
      output: f => {
        if (v.canvas.width !== f.displayWidth || v.canvas.height !== f.displayHeight) {
          v.canvas.width = f.displayWidth;
          v.canvas.height = f.displayHeight;
        }
        v.ctx.drawImage(f, 0, 0);
        f.close();
        v.frames++;
      },
      error: e => {
        console.warn('decoder', e);
        // Recover: new decoder, ask for a keyframe
        setTimeout(() => {
          if (s.views.get(v.key) === v) {
            this.configureView(s, v, s.list.find(x => x.clid === v.clid && x.kind === v.kind) || info);
            this.send(s, { t: 'keyframe', clid: v.clid, kind: v.kind });
          }
        }, 200);
      },
    });
    try {
      v.decoder.configure({ codec: info.codec, optimizeForLatency: true });
    } catch (e) {
      toast(`Video von ${info.name} kann nicht dekodiert werden (${info.codec}).`, 'error');
    }
  },

  onFrame(s, buf) {
    const u8 = new Uint8Array(buf);
    if (u8.length < 12) return;
    const dv = new DataView(buf);
    const clid = dv.getUint16(0, true), kind = u8[2], key = (u8[3] & 1) !== 0;
    const v = s.views.get(skey(clid, kind));
    if (!v || v.decoder?.state !== 'configured') return;
    v.bytes += u8.length;
    if (v.waitKey && !key) return;
    if (!key && v.decoder.decodeQueueSize > 8) {
      // Decoder falls behind: wait for the next keyframe
      v.waitKey = true;
      this.send(s, { t: 'keyframe', clid, kind });
      return;
    }
    v.waitKey = false;
    try {
      v.decoder.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp: Number(dv.getBigUint64(4, true)), data: u8.subarray(12) }));
    } catch (e) {
      v.waitKey = true;
    }
  },

  unwatch(s, clid, kind, silent = false) {
    const key = skey(clid, kind);
    const v = s.views.get(key);
    if (!v) return;
    s.views.delete(key);
    try { v.decoder?.close(); } catch {}
    if (!silent) this.send(s, { t: 'unwatch', clid, kind });
    Stage.render();
  },

  unwatchAll(conn) {
    const s = this.sessions.get(conn);
    if (!s) return;
    for (const v of [...s.views.values()]) this.unwatch(s, v.clid, v.kind);
  },
};
Video.load();

const skey = (clid, kind) => `${clid}:${kind}`;

/** Host part of a server address ("host", "host:port", "[v6]:port", "v6"). */
function hostOf(addr) {
  addr = String(addr).trim();
  if (addr.startsWith('[')) return addr.slice(1, addr.indexOf(']'));
  const parts = addr.split(':');
  return parts.length === 2 ? parts[0] : addr;
}

// ------------------------------------------------------------------ stage UI

const Stage = {
  open: false,
  conn: -1,
  focus: null, // tile key in focus
  skipped: new Set(), // streams the user closed (no auto-watch)
  timer: 0,

  async show() {
    if (!connected()) return;
    const conn = activeConn();
    if (this.open && this.conn === conn) return;
    if (this.open) this.hide();
    this.open = true;
    this.conn = conn;
    this.skipped.clear();
    document.querySelector('.right-col').classList.add('stage-mode');
    $('#stage').hidden = false;
    this.render();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
    try {
      const s = await Video.ensure(conn);
      if (Video.cfg.autoWatch) for (const x of s.list) if (x.clid !== s.clid) Video.watch(s, x.clid, x.kind);
    } catch (e) {
      /* shown in the stage */
    }
    this.render();
  },

  hide() {
    if (!this.open) return;
    this.open = false;
    Video.unwatchAll(this.conn); // save bandwidth; own streams keep running
    clearInterval(this.timer);
    document.querySelector('.right-col').classList.remove('stage-mode');
    $('#stage').hidden = true;
    $('#stage').innerHTML = '';
    this.focus = null;
  },

  tick() {
    const s = Video.sessions.get(this.conn);
    if (!s) return;
    const t = performance.now();
    for (const v of s.views.values()) {
      const dt = (t - v.fpsT) / 1000;
      v.fps = Math.round(v.frames / dt);
      v.kbps = Math.round((v.bytes * 8) / 1000 / dt);
      v.frames = 0;
      v.bytes = 0;
      v.fpsT = t;
    }
    for (const el of document.querySelectorAll('#stage .tile[data-key]')) {
      const v = s.views.get(el.dataset.key);
      const st = el.querySelector('.tile-stats');
      if (st) st.textContent = v ? `${v.canvas.width}×${v.canvas.height} · ${v.fps} FPS · ${v.kbps >= 1000 ? (v.kbps / 1000).toFixed(1) + ' Mbit/s' : v.kbps + ' kbit/s'}` : '';
    }
  },

  /** Called from the poll loop: follow own channel, talking rings, etc. */
  update() {
    if (!this.open) return;
    if (!connected() || activeConn() !== this.conn) return this.hide();
    this.render();
  },

  render() {
    if (!this.open) return;
    const root = $('#stage');
    const s = srv();
    if (!s?.connected) return;
    const mine = me();
    const ch = channelById(mine?.channel);
    const vs = Video.sessions.get(this.conn);
    const members = s.clients.filter(c => c.channel === mine?.channel).sort((a, b) => b.talk_power - a.talk_power || a.nickname.localeCompare(b.nickname));
    const list = vs?.list || [];
    const pubs = vs?.pubs || new Map();
    const qOpts = Object.entries(VIDEO_QUALITY).map(([k, q]) => `<option value="${k}"${k === Video.cfg.quality ? ' selected' : ''}>${q.label}</option>`).join('');

    // Header (rebuilt only when its content changes)
    const head = `<div class="stage-head">
      <div class="stage-title">${channelIcon('open')}<span class="name">${esc(displayName(ch || { name: '' }))}</span><span class="stage-count">${members.length}</span></div>
      <div class="tb-spacer"></div>
      <button class="tb-btn small${pubs.has(KIND_SCREEN) ? ' live' : ''}" data-stage="screen" ${vs && !vs.canStream ? 'disabled title="Kein Recht zum Übertragen"' : ''}>${icon(pubs.has(KIND_SCREEN) ? 'stop' : 'monitor')}${pubs.has(KIND_SCREEN) ? 'Bildschirm beenden' : 'Bildschirm teilen'}</button>
      <button class="tb-btn small${pubs.has(KIND_CAMERA) ? ' live' : ''}" data-stage="camera" ${vs && !vs.canStream ? 'disabled title="Kein Recht zum Übertragen"' : ''}>${icon(pubs.has(KIND_CAMERA) ? 'stop' : 'camera')}${pubs.has(KIND_CAMERA) ? 'Webcam beenden' : 'Webcam'}</button>
      <select class="stage-quality" title="Qualität">${qOpts}</select>
      <button class="mini-btn" data-stage="settings" title="Video-Einstellungen">${icon('settings')}</button>
      <button class="mini-btn" data-stage="close" title="Channel-Ansicht schließen">${icon('close')}</button>
    </div>`;
    let headEl = root.querySelector('.stage-head');
    if (!headEl || headEl._html !== head) {
      const tmp = document.createElement('div');
      tmp.innerHTML = head;
      const fresh = tmp.firstElementChild;
      fresh._html = head;
      headEl ? headEl.replaceWith(fresh) : root.prepend(fresh);
    }
    let body = root.querySelector('.stage-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'stage-body';
      body.innerHTML = '<div class="stage-grid"></div><div class="stage-people"></div><div class="stage-note"></div>';
      root.appendChild(body);
    }

    // Video tiles: own previews + remote streams
    const tiles = [];
    for (const [kind, p] of pubs) tiles.push({ key: `own:${kind}`, own: true, kind, name: mine?.nickname || '', clid: s.own_id, p });
    for (const x of list) if (x.clid !== vs.clid) tiles.push({ key: skey(x.clid, x.kind), own: false, kind: x.kind, name: x.name, clid: x.clid, info: x });
    if (this.focus && !tiles.some(t => t.key === this.focus)) this.focus = null;
    const grid = body.querySelector('.stage-grid');
    grid.classList.toggle('focused', !!this.focus);
    grid.dataset.n = Math.min(tiles.length, 9);
    const keep = new Set(tiles.map(t => t.key));
    for (const el of [...grid.children]) if (!keep.has(el.dataset.key)) el.remove();
    tiles.forEach((t, i) => {
      let el = grid.querySelector(`.tile[data-key="${t.key}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile';
        el.dataset.key = t.key;
        el.innerHTML = `<div class="tile-media"></div><div class="tile-bar"><span class="tile-kind"></span><span class="tile-name"></span><span class="tile-stats"></span><span class="tb-spacer"></span>
          <button class="mini-btn" data-tile="focus" title="Hervorheben">${icon('maximize')}</button>
          <button class="mini-btn" data-tile="preview" title="Vorschau ausblenden" hidden>${icon('eyeoff')}</button>
          <button class="mini-btn" data-tile="full" title="Vollbild">${icon('expand')}</button>
          <button class="mini-btn" data-tile="hide" title="Ausblenden">${icon('eyeoff')}</button></div>`;
      }
      if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
      const c = clientById(t.clid);
      el.classList.toggle('talking', !!c?.talking);
      el.classList.toggle('is-focus', this.focus === t.key);
      el.classList.toggle('own', t.own);
      el.querySelector('.tile-kind').innerHTML = icon(t.kind === KIND_SCREEN ? 'monitor' : 'camera');
      el.querySelector('.tile-name').textContent = t.own ? `${t.name} (du)` : t.name;
      el.querySelector('[data-tile="hide"]').hidden = t.own;
      const media = el.querySelector('.tile-media');
      // Own screen: no live preview by default, it would film itself (mirror tunnel).
      const ownScreenHidden = t.own && t.kind === KIND_SCREEN && (!this.ownPreview || !t.p.media);
      el.querySelector('[data-tile="full"]').hidden = ownScreenHidden;
      el.querySelector('.tile-bar [data-tile="preview"]').hidden = !(t.own && t.kind === KIND_SCREEN && this.ownPreview);
      if (ownScreenHidden) {
        if (!media.querySelector('.own-cover')) {
          const src = t.p.source;
          media.innerHTML = `<div class="tile-cover own-cover">${src?.thumb ? `<img class="own-thumb" src="${src.thumb}" alt="">` : icon('monitor')}
            <div>${src ? `Du teilst „${esc(src.name)}“.` : 'Du teilst deinen Bildschirm.'}</div>
            ${t.p.media ? `<button class="tb-btn small" data-tile="preview">${icon('eye')}Vorschau anzeigen</button>` : ''}</div>`;
        }
        el.querySelector('.tile-stats').textContent = t.p.w ? `${t.p.w}×${t.p.h} · ${t.p.fps} FPS · ${t.p.codec.startsWith('avc') ? 'H.264' : 'VP8'}` : 'startet …';
      } else if (t.own) {
        let vid = media.querySelector('video');
        if (!vid || vid.srcObject !== t.p.media) {
          media.innerHTML = '';
          vid = document.createElement('video');
          vid.muted = true;
          vid.autoplay = true;
          vid.playsInline = true;
          vid.srcObject = t.p.media;
          media.appendChild(vid);
        }
        el.classList.toggle('mirror', t.kind === KIND_CAMERA);
        el.querySelector('.tile-stats').textContent = t.p.w ? `${t.p.w}×${t.p.h} · ${t.p.fps} FPS · ${t.p.codec.startsWith('avc') ? 'H.264' : 'VP8'}` : 'startet …';
      } else {
        const v = vs.views.get(t.key);
        if (v) {
          if (media.firstChild !== v.canvas) { media.innerHTML = ''; media.appendChild(v.canvas); }
        } else if (!media.querySelector('.tile-cover')) {
          media.innerHTML = `<div class="tile-cover"><div class="avatar-big" style="background:${colorFor(t.name)}">${esc((t.name[0] || '?').toUpperCase())}</div>
            <button class="tb-btn small primary" data-tile="watch">${icon('eye')}Ansehen</button>
            ${!vs.canWatch ? '<div class="hint">Kein Recht zum Ansehen</div>' : ''}</div>`;
        }
      }
    });

    // People in the channel
    const people = members.map(c => {
      const live = [...(c.id === s.own_id ? [...pubs.keys()] : list.filter(x => x.clid === c.id).map(x => x.kind))];
      return `<div class="person${c.talking ? ' talking' : ''}${c.id === s.own_id ? ' me' : ''}" data-clid="${c.id}" title="${esc(c.nickname)}">
        <div class="p-avatar" style="background:${colorFor(c.nickname)}">${esc((c.nickname[0] || '?').toUpperCase())}${c.input_muted || c.output_muted ? `<span class="p-mute">${icon(c.output_muted ? 'headphonesOff' : 'micOff')}</span>` : ''}</div>
        <div class="p-name">${esc(c.nickname)}</div>
        ${live.length ? `<div class="p-live">${live.map(k => icon(k === KIND_SCREEN ? 'monitor' : 'camera')).join('')}LIVE</div>` : ''}
      </div>`;
    }).join('');
    setHtml(body.querySelector('.stage-people'), people);

    const note = vs?.error
      ? `<span class="bad">${esc(vs.error)}</span>`
      : !tiles.length
        ? `${icon('monitor')}<span>Niemand überträgt gerade. Teile deinen Bildschirm oder deine Webcam mit dem Channel.</span>`
        : '';
    setHtml(body.querySelector('.stage-note'), note);
    body.querySelector('.stage-note').hidden = !note;
  },

  async settings() {
    let cams = [];
    try { cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch {}
    const r = await formDialog(`${icon('camera')}Video-Einstellungen`, [
      { name: 'quality', label: 'Qualität beim Übertragen', type: 'select', value: Video.cfg.quality, options: Object.entries(VIDEO_QUALITY).map(([k, q]) => [k, q.label]) },
      { name: 'camera', label: 'Webcam', type: 'select', value: Video.cfg.camera, options: [['', 'Standard'], ...cams.map((d, i) => [d.deviceId, d.label || `Kamera ${i + 1}`])] },
      { name: 'autoWatch', label: 'Übertragungen in der Channel-Ansicht automatisch ansehen', type: 'checkbox', value: Video.cfg.autoWatch },
    ], 'Speichern');
    if (!r) return;
    Video.cfg.quality = r.quality;
    Video.cfg.camera = r.camera;
    Video.cfg.autoWatch = !!r.autoWatch;
    Video.save();
    this.render();
  },
};

// Stage interactions (delegated; the stage re-renders often)
document.addEventListener('click', e => {
  const st = e.target.closest('#stage [data-stage]');
  if (st) {
    const s = Video.sessions.get(Stage.conn);
    switch (st.dataset.stage) {
      case 'close': return Stage.hide(), renderInfo();
      case 'settings': return Stage.settings();
      case 'screen': return s?.pubs.has(KIND_SCREEN) ? confirmStopScreen(s) : Video.startPublish(KIND_SCREEN);
      case 'camera': return s?.pubs.has(KIND_CAMERA) ? Video.stopPublish(s, KIND_CAMERA) : Video.startPublish(KIND_CAMERA);
    }
  }
  const tb = e.target.closest('#stage [data-tile]');
  if (tb) {
    const tile = tb.closest('.tile');
    const key = tile.dataset.key;
    const s = Video.sessions.get(Stage.conn);
    switch (tb.dataset.tile) {
      case 'watch': {
        const [clid, kind] = key.split(':').map(Number);
        return s && Video.watch(s, clid, kind);
      }
      case 'hide': {
        const [clid, kind] = key.split(':').map(Number);
        Stage.skipped.add(key);
        if (Stage.focus === key) Stage.focus = null;
        tile.querySelector('.tile-media').innerHTML = '';
        return s && Video.unwatch(s, clid, kind);
      }
      case 'focus':
        Stage.focus = Stage.focus === key ? null : key;
        return Stage.render();
      case 'full':
        return toggleTileFullscreen(tile);
      case 'preview':
        Stage.ownPreview = !Stage.ownPreview;
        if (!Stage.ownPreview && tile.classList.contains('fs')) toggleTileFullscreen(tile);
        return Stage.render();
    }
  }
  const person = e.target.closest('#stage .person');
  if (person) {
    const clid = Number(person.dataset.clid);
    const t = document.querySelector(`#stage .tile[data-key^="${clid === srv()?.own_id ? 'own:' : clid + ':'}"]`);
    if (t) { Stage.focus = t.dataset.key; Stage.render(); }
  }
});
document.addEventListener('dblclick', e => {
  const tile = e.target.closest('#stage .tile');
  if (tile && !e.target.closest("button") && !tile.querySelector(".own-cover")) toggleTileFullscreen(tile);
});
document.addEventListener('change', e => {
  if (e.target.matches('#stage .stage-quality')) {
    Video.cfg.quality = e.target.value;
    Video.save();
    toast(`Qualität: ${VIDEO_QUALITY[Video.cfg.quality].label}${Video.sessions.get(Stage.conn)?.pubs.size ? ' (gilt ab der nächsten Übertragung)' : ''}`);
  }
});

/**
 * Fullscreen for a video tile. Both element fullscreen and window fullscreen turn the
 * WebView2 surface green (GPU compositor), so the tile fills the window via CSS and the
 * window is only maximized; its previous state is restored afterwards.
 */
let fsWasMaximized = true;
async function toggleTileFullscreen(tile) {
  const cur = document.querySelector('#stage .tile.fs');
  const on = cur !== tile;
  cur?.classList.remove('fs');
  if (on) tile.classList.add('fs');
  document.body.classList.toggle('tile-fs', on);
  const win = window.__TAURI__?.window?.getCurrentWindow?.();
  if (!win || (on && cur)) return;
  try {
    if (on) {
      fsWasMaximized = await win.isMaximized();
      if (!fsWasMaximized) await win.maximize();
    } else if (!fsWasMaximized) await win.unmaximize();
  } catch {}
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const cur = document.querySelector('#stage .tile.fs');
    if (cur) toggleTileFullscreen(cur);
  }
});

// ---------------------------------------------------------------- share picker

/** RustSpeak's own source picker: monitors and windows with thumbnails, plus quality. */
async function pickScreenSource() {
  let sources = null;
  const grid = list => {
    if (!list) return `<div class="pick-loading">${icon('monitor')}Quellen werden geladen …</div>`;
    const card = x => `<button type="button" class="pick-card" data-src="${esc(x.id)}" title="${esc(x.name)}">
        <div class="pick-thumb">${x.thumb ? `<img src="${x.thumb}" alt="">` : icon(x.kind === 'monitor' ? 'monitor' : 'image')}</div>
        <div class="pick-name">${x.kind === 'monitor' ? icon('monitor') : ''}<span>${esc(x.name)}</span></div>
        <div class="pick-sub">${x.kind === 'monitor' ? `${x.width}×${x.height}${x.primary ? ' · Hauptbildschirm' : ''}` : esc(x.app || '')}</div>
      </button>`;
    const mons = list.filter(x => x.kind === 'monitor'), wins = list.filter(x => x.kind === 'window');
    return `<div class="pick-section">Bildschirme</div><div class="pick-grid">${mons.map(card).join('') || '<div class="hint">Keine Bildschirme gefunden.</div>'}</div>
      <div class="pick-section">Fenster</div><div class="pick-grid">${wins.map(card).join('') || '<div class="hint">Keine Fenster gefunden.</div>'}</div>`;
  };
  const r = await formDialog(`${icon('monitor')}Bildschirm teilen`, [
    { type: 'html', name: 'x', html: `<div class="pick-tabs"><button type="button" class="pick-tab active" data-pick-tab="all">Alle</button><button type="button" class="pick-tab" data-pick-tab="monitor">Bildschirme</button><button type="button" class="pick-tab" data-pick-tab="window">Fenster</button></div><div class="pick-body">${grid(null)}</div><input type="hidden" name="source" value="">` },
    { type: 'html', name: 'source', html: '' }, // the hidden input above; listed so its value is returned
    { name: 'quality', label: 'Qualität', type: 'select', value: Video.cfg.quality, options: Object.entries(VIDEO_QUALITY).map(([k, q]) => [k, q.label]) },
  ], 'Teilen', {
    wide: true,
    onOpen: async box => {
      const ok = $('#form-ok');
      ok.disabled = true;
      const body = box.querySelector('.pick-body');
      const input = box.querySelector('[name="source"]');
      let tab = 'all';
      const draw = () => {
        body.innerHTML = grid(sources && sources.filter(x => tab === 'all' || x.kind === tab));
        body.querySelector(`.pick-card[data-src="${CSS.escape(input.value)}"]`)?.classList.add('selected');
      };
      box.querySelectorAll('[data-pick-tab]').forEach(b => b.addEventListener('click', () => {
        tab = b.dataset.pickTab;
        box.querySelectorAll('[data-pick-tab]').forEach(x => x.classList.toggle('active', x === b));
        draw();
      }));
      body.addEventListener('click', e => {
        const c = e.target.closest('.pick-card');
        if (!c) return;
        input.value = c.dataset.src;
        body.querySelectorAll('.pick-card').forEach(x => x.classList.toggle('selected', x === c));
        ok.disabled = false;
      });
      body.addEventListener('dblclick', e => {
        if (e.target.closest('.pick-card')) ok.click();
      });
      try { sources = await window.__TAURI__.core.invoke('screen_sources'); } catch { sources = []; }
      if (!input.value) {
        const first = sources.find(x => x.primary) || sources[0];
        if (first) { input.value = first.id; ok.disabled = false; }
      }
      draw();
    },
  });
  $('#form-ok').disabled = false;
  if (!r?.source) return null;
  if (r.quality && r.quality !== Video.cfg.quality) { Video.cfg.quality = r.quality; Video.save(); }
  return sources?.find(x => x.id === r.source) || { id: r.source, name: '', thumb: '' };
}

/** Ask before ending the own screen share. */
async function confirmStopScreen(s) {
  const p = s.pubs.get(KIND_SCREEN);
  const what = p?.source?.name ? `„${esc(p.source.name)}“` : 'deinen Bildschirm';
  const r = await formDialog(`${icon('stop')}Bildschirmübertragung beenden`, [
    { type: 'html', name: 'x', html: `<p>Möchtest du die Übertragung von ${what} wirklich beenden?</p><p class="note">Alle Zuschauer im Channel sehen deinen Bildschirm danach nicht mehr.</p>` },
  ], 'Beenden');
  if (r && s.pubs.has(KIND_SCREEN)) Video.stopPublish(s, KIND_SCREEN);
}

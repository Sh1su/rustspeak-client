//! Connection engine shared by the CLI and the GUI: handshake, keep-alive,
//! command/response tracking and voice I/O. Runs on a tokio runtime and reports
//! everything through a callback; the server state lives in a shared [`Model`].

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{anyhow, bail, Context, Result};
use tokio::net::UdpSocket;
use tokio::sync::mpsc;
use tracing::{debug, warn};

use tsproto::crypto::{self, EdKey, SharedSecret};
use tsproto::identity::{self, Identity};
use tsproto::init::{self, ClientInit};
use tsproto::{b64, hash_password, license, unb64, Command, Connection, Dir, Event};

use crate::model::Model;

/// Version string + platform + Ed25519 signature checked by official servers.
/// Public, widely used pair of an official 3.x Windows build (accepted by ts3server 3.13.8).
pub const VERSION: &str = "3.?.? [Build: 5680278000]";
pub const PLATFORM: &str = "Windows";
pub const VERSION_SIGN: &str = "DX5NIYLvfJEUjuIbCidnoeozxIDRRkpq3I9vVMBmE9L2qnekOoBzSenkzsg2lC9CMv8K5hkEzhr2TYUYSwUXCg==";

#[derive(Clone, Debug)]
pub struct ConnectOptions {
    pub server: String,
    pub nickname: String,
    pub identity: PathBuf,
    pub security_level: u32,
    pub password: String,
    pub channel: String,
    pub channel_password: String,
    pub client_version: String,
    pub client_platform: String,
    pub version_sign: String,
    /// Accept a license root announced by the server (`root=`, our own Rust server).
    pub accept_server_root: bool,
}

impl ConnectOptions {
    pub fn new(server: &str, nickname: &str, identity: PathBuf) -> Self {
        ConnectOptions {
            server: server.into(),
            nickname: nickname.into(),
            identity,
            security_level: 8,
            password: String::new(),
            channel: String::new(),
            channel_password: String::new(),
            client_version: VERSION.into(),
            client_platform: PLATFORM.into(),
            version_sign: VERSION_SIGN.into(),
            accept_server_root: true,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LogKind {
    Info,
    Error,
    ChannelChat,
    ServerChat,
    /// Private chat with the given client id (the partner, not us)
    Private(u16),
    Poke,
}

#[derive(Debug)]
pub enum SessionEvent {
    Status(String),
    Connected,
    Log { kind: LogKind, text: String },
    /// Opus (or other codec) frame from a talker; empty `data` = end of transmission.
    Voice { from: u16, codec: u8, data: Vec<u8> },
    /// Something worth a notification sound / announcement (see `Model::sound_for`).
    Sound(crate::model::Sound),
    /// Data replies for dialogs (permission lists, privilege keys, ban list, ...).
    Notify(Command),
    Disconnected(String),
}

/// Notifications that carry data for UI dialogs rather than state changes.
const DATA_NOTIFIES: &[&str] = &[
    "notifyservergrouppermlist",
    "notifychannelgrouppermlist",
    "notifypermissionlist",
    "notifytokenadd",
    "notifytokenlist",
    "notifybanlist",
    "notifyservergroupclientlist",
    "notifyiconupload",
    "notifyiconlist",
    "notifyicondownload",
    "notifyconnectioninfo",
    "notifyvideotoken",
    "notifybotkeyadd",
    "notifybotkeylist",
];

pub enum Request {
    /// A command plus a human readable label for error messages.
    Cmd(Command, String),
    /// One encoded voice frame (codec 4 = Opus voice, 5 = Opus music); empty = end.
    Voice { codec: u8, data: Vec<u8> },
    Disconnect(String),
}

pub type Sink = Arc<dyn Fn(SessionEvent) + Send + Sync>;

#[derive(Clone)]
pub struct SessionHandle {
    tx: mpsc::UnboundedSender<Request>,
}

impl SessionHandle {
    pub fn send(&self, cmd: Command, label: &str) {
        let _ = self.tx.send(Request::Cmd(cmd, label.into()));
    }
    pub fn voice(&self, codec: u8, data: Vec<u8>) {
        let _ = self.tx.send(Request::Voice { codec, data });
    }
    pub fn disconnect(&self, msg: &str) {
        let _ = self.tx.send(Request::Disconnect(msg.into()));
    }
    pub fn is_closed(&self) -> bool {
        self.tx.is_closed()
    }
}

/// Start a session on the current tokio runtime.
pub fn spawn(opts: ConnectOptions, model: Arc<Mutex<Model>>, sink: Sink) -> SessionHandle {
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        let reason = match run(opts, model, sink.clone(), rx).await {
            Ok(r) => r,
            Err(e) => format!("{e:#}"),
        };
        sink(SessionEvent::Disconnected(reason));
    });
    SessionHandle { tx }
}

enum Phase {
    Init { init: ClientInit, last: Vec<u8>, sent: Instant, initiv: String, alpha: [u8; 10] },
    AwaitExpand { alpha: [u8; 10] },
    AwaitInitServer,
    Connected,
}

struct Session {
    opts: ConnectOptions,
    sock: UdpSocket,
    conn: Connection,
    id: Identity,
    phase: Phase,
    model: Arc<Mutex<Model>>,
    sink: Sink,
    next_rc: u32,
    pending: HashMap<String, String>,
    last_ping: Instant,
    quitting: Option<(Instant, String)>,
    started: Instant,
}

pub async fn resolve(s: &str) -> Result<SocketAddr> {
    let s = s.trim();
    let with_port = if s.parse::<SocketAddr>().is_ok() || (s.contains(':') && !s.contains('[') && s.matches(':').count() == 1) {
        s.to_string()
    } else {
        format!("{s}:9987")
    };
    let addr = tokio::net::lookup_host(with_port).await?.next();
    addr.ok_or_else(|| anyhow!("cannot resolve {s}"))
}

async fn run(opts: ConnectOptions, model: Arc<Mutex<Model>>, sink: Sink, mut rx: mpsc::UnboundedReceiver<Request>) -> Result<String> {
    sink(SessionEvent::Status(format!("Löse {} auf ...", opts.server)));
    let addr = resolve(&opts.server).await?;
    if !opts.identity.exists() {
        sink(SessionEvent::Status(format!("Erzeuge Identität (Sicherheitslevel {}) ...", opts.security_level)));
    }
    let (path, level) = (opts.identity.clone(), opts.security_level);
    let id = tokio::task::spawn_blocking(move || Identity::load_or_create(&path, level)).await??;
    sink(SessionEvent::Log { kind: LogKind::Info, text: format!("Identität {} (Level {})", id.uid(), id.level()) });

    let sock = UdpSocket::bind(if addr.is_ipv4() { "0.0.0.0:0" } else { "[::]:0" }).await?;
    sock.connect(addr).await?;
    sink(SessionEvent::Status(format!("Verbinde mit {addr} ...")));

    let alpha: [u8; 10] = crypto::random_bytes();
    let initiv = Command::new("clientinitiv").arg("alpha", b64(&alpha)).arg("omega", id.omega()).arg("ot", 1).arg("ip", "").to_string();
    let (init, p0) = ClientInit::start();
    let first = init::wrap(Dir::C2S, &p0);
    sock.send(&first).await?;
    *model.lock().unwrap() = Model::default();

    let mut s = Session {
        opts,
        sock,
        conn: Connection::new(Dir::C2S),
        id,
        phase: Phase::Init { init, last: first, sent: Instant::now(), initiv, alpha },
        model,
        sink,
        next_rc: 1,
        pending: HashMap::new(),
        last_ping: Instant::now(),
        quitting: None,
        started: Instant::now(),
    };

    let mut buf = vec![0u8; 2048];
    let mut tick = tokio::time::interval(Duration::from_millis(20));
    loop {
        tokio::select! {
            r = s.sock.recv(&mut buf) => match r {
                Ok(n) => {
                    let data = buf[..n].to_vec();
                    if let Some(reason) = s.on_datagram(&data).await? {
                        return Ok(reason);
                    }
                }
                Err(e) => debug!("recv: {e}"),
            },
            req = rx.recv() => match req {
                Some(r) => s.on_request(r).await,
                None => {
                    s.on_request(Request::Disconnect("leaving".into())).await;
                }
            },
            _ = tick.tick() => {
                if let Some(reason) = s.on_tick().await? {
                    return Ok(reason);
                }
            }
        }
    }
}

impl Session {
    fn log(&self, kind: LogKind, text: impl Into<String>) {
        (self.sink)(SessionEvent::Log { kind, text: text.into() });
    }

    async fn send(&self, pkts: Vec<Vec<u8>>) {
        for p in pkts {
            let _ = self.sock.send(&p).await;
        }
    }

    async fn send_cmd(&mut self, cmd: Command, what: &str) {
        let rc = self.next_rc.to_string();
        self.next_rc += 1;
        self.pending.insert(rc.clone(), what.to_string());
        let text = cmd.arg("return_code", &rc).to_string();
        debug!("-> {text}");
        let pkts = self.conn.send_command(&text, false);
        self.send(pkts).await;
    }

    async fn on_request(&mut self, r: Request) {
        if !matches!(self.phase, Phase::Connected) || self.quitting.is_some() {
            if let Request::Disconnect(msg) = r {
                self.quitting = Some((Instant::now(), msg));
            }
            return;
        }
        match r {
            Request::Cmd(c, label) => self.send_cmd(c, &label).await,
            Request::Voice { codec, data } => {
                let p = self.conn.send_voice_c2s(codec, &data);
                self.send(vec![p]).await;
            }
            Request::Disconnect(msg) => {
                let c = Command::new("clientdisconnect").arg("reasonid", 8).arg("reasonmsg", &msg);
                let pkts = self.conn.send_command(&c.to_string(), false);
                self.send(pkts).await;
                self.quitting = Some((Instant::now(), msg));
            }
        }
    }

    async fn on_datagram(&mut self, data: &[u8]) -> Result<Option<String>> {
        let (events, replies) = match self.conn.handle_packet(data) {
            Ok(r) => r,
            Err(e) => {
                debug!("dropped packet: {e}");
                return Ok(None);
            }
        };
        self.send(replies).await;
        for ev in events {
            match ev {
                Event::Init(p) => self.on_init(&p).await?,
                Event::Command { text, .. } => {
                    debug!("<- {text}");
                    for line in text.split('\n').filter(|l| !l.trim().is_empty()) {
                        if let Some(r) = self.on_command(Command::parse(line, true)).await? {
                            return Ok(Some(r));
                        }
                    }
                }
                Event::Voice { payload, .. } => self.on_voice(&payload),
            }
        }
        Ok(None)
    }

    async fn on_init(&mut self, p: &[u8]) -> Result<()> {
        let Phase::Init { init, initiv, alpha, .. } = &mut self.phase else { return Ok(()) };
        let (next, done) = init.handle(p, initiv)?;
        let pkt = init::wrap(Dir::C2S, &next);
        self.sock.send(&pkt).await?;
        if done {
            let alpha = *alpha;
            self.phase = Phase::AwaitExpand { alpha };
        } else if let Phase::Init { last, sent, .. } = &mut self.phase {
            *last = pkt;
            *sent = Instant::now();
        }
        Ok(())
    }

    async fn on_command(&mut self, cmd: Command) -> Result<Option<String>> {
        match (&self.phase, cmd.name.as_str()) {
            (Phase::AwaitExpand { alpha }, "initivexpand") => {
                let alpha = *alpha;
                if unb64(cmd.get_or("alpha", ""))? != alpha {
                    bail!("initivexpand: alpha mismatch");
                }
                let beta = unb64(cmd.get("beta").ok_or_else(|| anyhow!("no beta"))?)?;
                let server = identity::parse_omega(cmd.get("omega").ok_or_else(|| anyhow!("no omega"))?)?;
                self.conn.secret = Some(SharedSecret::legacy(&self.id.ecdh(&server), &alpha, &beta));
                self.send_clientinit().await;
            }
            (Phase::AwaitExpand { alpha }, "initivexpand2") => {
                let alpha = *alpha;
                let l = unb64(cmd.get("l").ok_or_else(|| anyhow!("no license"))?)?;
                let beta = unb64(cmd.get("beta").ok_or_else(|| anyhow!("no beta"))?)?;
                let server = identity::parse_omega(cmd.get("omega").ok_or_else(|| anyhow!("no omega"))?)?;
                if let Some(proof) = cmd.get("proof") {
                    if identity::verify(&server, &l, &unb64(proof)?).is_err() {
                        warn!("server license proof does not verify");
                    }
                }
                let blocks = license::parse(&l)?;
                let root: [u8; 32] = match cmd.get("root") {
                    Some(r) if self.opts.accept_server_root => {
                        self.log(LogKind::Info, "Hinweis: Server nutzt eine eigene Lizenz-Root (keine offizielle TeamSpeak-Lizenz)");
                        unb64(r)?.try_into().map_err(|_| anyhow!("bad root"))?
                    }
                    _ => tsproto::TS_ROOT_KEY,
                };
                let server_key = license::derive_public_key(&root, &blocks)?;
                let ek = EdKey::generate();
                let ek_pub = ek.public();
                let mut signed = ek_pub.to_vec();
                signed.extend_from_slice(&beta);
                let clientek = Command::new("clientek").arg("ek", b64(&ek_pub)).arg("proof", b64(&self.id.sign(&signed)));
                // clientek still goes out with the fake key ...
                let pkts = self.conn.send_command(&clientek.to_string(), false);
                self.send(pkts).await;
                // ... everything after it uses the new shared secret.
                self.conn.secret = Some(SharedSecret::ed25519(&ek.shared_secret(&server_key), &alpha, &beta));
                self.send_clientinit().await;
            }
            (Phase::AwaitInitServer, "initserver") => {
                self.conn.client_id = cmd.num("aclid").unwrap_or(0);
                self.phase = Phase::Connected;
                let (line, welcome) = {
                    let mut m = self.model.lock().unwrap();
                    (m.apply(&cmd), m.welcome.clone())
                };
                if let Some(l) = line {
                    self.log(LogKind::Info, l);
                }
                if !welcome.is_empty() {
                    self.log(LogKind::ServerChat, format!("Willkommensnachricht: {welcome}"));
                }
                (self.sink)(SessionEvent::Connected);
            }
            (_, "error") => {
                let id = cmd.get_or("id", "0");
                let what = cmd.get("return_code").and_then(|rc| self.pending.remove(rc));
                if id != "0" {
                    let msg = cmd.get_or("msg", "");
                    match &self.phase {
                        Phase::Connected => {
                            self.log(LogKind::Error, format!("Fehler: {} ({msg}, id {id})", what.unwrap_or_else(|| "Befehl".into())))
                        }
                        _ => bail!("Server hat die Verbindung abgelehnt: {msg} (id {id})"),
                    }
                }
            }
            (Phase::Connected, _) => {
                let own = self.model.lock().unwrap().own_id;
                if cmd.name == "notifyclientleftview" && cmd.num::<u16>("clid") == Some(own) {
                    let msg = cmd.get_or("reasonmsg", "").to_string();
                    let why = match cmd.get("reasonid") {
                        Some("5") => format!("vom Server gekickt von {}: {msg}", cmd.get_or("invokername", "?")),
                        Some("6") => format!("vom Server gebannt von {}: {msg}", cmd.get_or("invokername", "?")),
                        _ => format!("getrennt: {msg}"),
                    };
                    return Ok(Some(why));
                }
                let kind = match (cmd.name.as_str(), cmd.get("targetmode")) {
                    ("notifytextmessage", Some("1")) => {
                        let inv: u16 = cmd.num("invokerid").unwrap_or(0);
                        let partner = if inv == own { cmd.num("target").unwrap_or(0) } else { inv };
                        LogKind::Private(partner)
                    }
                    ("notifytextmessage", Some("3")) => LogKind::ServerChat,
                    ("notifytextmessage", _) => LogKind::ChannelChat,
                    ("notifyclientpoke", _) => LogKind::Poke,
                    _ => LogKind::Info,
                };
                if DATA_NOTIFIES.contains(&cmd.name.as_str()) {
                    (self.sink)(SessionEvent::Notify(cmd));
                    return Ok(None);
                }
                let (line, sound) = {
                    let mut m = self.model.lock().unwrap();
                    let sound = m.sound_event(&cmd);
                    (m.apply(&cmd), sound)
                };
                if let Some(l) = line {
                    self.log(kind, l);
                }
                if let Some(s) = sound {
                    (self.sink)(SessionEvent::Sound(s));
                }
            }
            (_, other) => debug!("ignoring {other} during handshake"),
        }
        Ok(None)
    }

    async fn send_clientinit(&mut self) {
        let a = &self.opts;
        let ch = if a.channel.is_empty() || a.channel.starts_with('/') || a.channel.parse::<u64>().is_err() {
            a.channel.clone()
        } else {
            format!("/{}", a.channel)
        };
        let hwid = format!("{},{}", hex(&crypto::random_bytes::<16>()), hex(&crypto::random_bytes::<16>()));
        let cmd = Command::new("clientinit")
            .arg("client_nickname", &a.nickname)
            .arg("client_version", &a.client_version)
            .arg("client_platform", &a.client_platform)
            .arg("client_input_hardware", 1)
            .arg("client_output_hardware", 1)
            .arg("client_default_channel", ch)
            .arg("client_default_channel_password", hash_password(&a.channel_password))
            .arg("client_server_password", hash_password(&a.password))
            .arg("client_meta_data", "")
            .arg("client_version_sign", &a.version_sign)
            .arg("client_key_offset", self.id.offset)
            .arg("client_nickname_phonetic", "")
            .arg("client_default_token", "")
            .arg("hwid", hwid);
        self.phase = Phase::AwaitInitServer;
        self.send_cmd(cmd, "Verbinden").await;
    }

    fn on_voice(&mut self, p: &[u8]) {
        // S->C: vid u16 | talker u16 | codec u8 | data (empty = end of transmission)
        if p.len() < 5 {
            return;
        }
        let from = u16::from_be_bytes([p[2], p[3]]);
        let data = p[5..].to_vec();
        {
            let mut m = self.model.lock().unwrap();
            if let Some(cl) = m.clients.get_mut(&from) {
                cl.last_voice = Some(Instant::now());
                if data.is_empty() {
                    cl.talking_since = None;
                } else if cl.talking_since.is_none() {
                    cl.talking_since = Some(Instant::now());
                }
            }
        }
        (self.sink)(SessionEvent::Voice { from, codec: p[4], data });
    }

    /// Returns Some(reason) when the session ends.
    async fn on_tick(&mut self) -> Result<Option<String>> {
        let now = Instant::now();
        if let Phase::Init { last, sent, .. } = &mut self.phase {
            if now.duration_since(*sent) > Duration::from_secs(1) {
                *sent = now;
                let pkt = last.clone();
                self.sock.send(&pkt).await?;
            }
        }
        if !matches!(self.phase, Phase::Connected) && now.duration_since(self.started) > Duration::from_secs(20) {
            bail!("Zeitüberschreitung beim Verbindungsaufbau");
        }
        let resend = self.conn.poll_resend(now).context("Server antwortet nicht mehr")?;
        self.send(resend).await;
        if matches!(self.phase, Phase::Connected) {
            if now.duration_since(self.last_ping) >= Duration::from_secs(1) {
                self.last_ping = now;
                let p = self.conn.ping();
                self.send(vec![p]).await;
                if let Some(rtt) = self.conn.rtt {
                    self.model.lock().unwrap().ping_ms = Some(rtt.as_secs_f32() * 1000.0);
                }
            }
            if self.conn.timed_out() {
                bail!("Verbindung verloren (Timeout)");
            }
        }
        // Talkers without an end marker
        {
            let mut m = self.model.lock().unwrap();
            for cl in m.clients.values_mut() {
                if cl.talking_since.is_some() && cl.last_voice.map(|t| now.duration_since(t) > Duration::from_millis(400)).unwrap_or(true) {
                    cl.talking_since = None;
                }
            }
        }
        if let Some((t, msg)) = &self.quitting {
            if !matches!(self.phase, Phase::Connected) || !self.conn.has_unacked() || now.duration_since(*t) > Duration::from_secs(3) {
                return Ok(Some(format!("getrennt ({msg})")));
            }
        }
        Ok(None)
    }
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

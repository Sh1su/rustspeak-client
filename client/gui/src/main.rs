//! RustSpeak: Windows GUI client for the TeamSpeak 3 protocol (Tauri v2 backend).
//!
//! Several server connections can be open at once (tabs). The microphone goes
//! to the active one; voice from all of them is mixed.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod screen;

use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use ts3_client::model::Model;
use ts3_client::session::{self, ConnectOptions, LogKind, SessionEvent, SessionHandle, Sink};
use tsproto::{hash_password, Command};

use audio::{Audio, AudioConfig};

struct Conn {
    id: u32,
    address: String,
    nickname: String,
    model: Arc<Mutex<Model>>,
    session: Mutex<Option<SessionHandle>>,
    connected: AtomicBool,
    /// "connecting" | "connected" | "disconnected"
    phase: Mutex<&'static str>,
}

struct AppState {
    conns: Mutex<BTreeMap<u32, Arc<Conn>>>,
    active: AtomicU32,
    next_id: AtomicU32,
    audio: Audio,
    data_dir: PathBuf,
    /// Global hotkeys: action -> Windows virtual key code
    hotkeys: Arc<Mutex<HashMap<String, i32>>>,
    /// Unique ids of locally blocked clients: their voice is not played
    blocked: Mutex<std::collections::HashSet<String>>,
}

impl AppState {
    fn conn(&self, id: u32) -> Result<Arc<Conn>, String> {
        self.conns.lock().unwrap().get(&id).cloned().ok_or_else(|| "Unbekannte Verbindung".into())
    }

    /// Route the microphone to the active connection.
    fn update_audio_target(&self) {
        let active = self.active.load(Ordering::Relaxed);
        let h = self.conns.lock().unwrap().get(&active).and_then(|c| c.session.lock().unwrap().clone());
        self.audio.set_session(h);
    }
}

#[derive(Deserialize)]
struct ConnectArgs {
    /// Reuse an existing tab (reconnect) instead of opening a new one
    #[serde(default)]
    conn: Option<u32>,
    server: String,
    nickname: String,
    #[serde(default)]
    password: String,
    #[serde(default)]
    channel: String,
    #[serde(default)]
    channel_password: String,
}

#[derive(Clone, Serialize)]
struct LogPayload {
    conn: u32,
    kind: &'static str,
    partner: Option<u16>,
    text: String,
}

#[derive(Clone, Serialize)]
struct ConnPayload {
    conn: u32,
    text: String,
}

#[derive(Clone, Serialize)]
struct SoundPayload {
    conn: u32,
    text: &'static str,
    clid: u16,
    uid: String,
    blocked: Option<&'static str>,
}

#[derive(Clone, Serialize)]
struct NotifyPayload {
    conn: u32,
    name: String,
    items: Vec<BTreeMap<String, String>>,
}

#[derive(Serialize)]
struct ChannelDto {
    id: u64,
    parent: u64,
    depth: usize,
    name: String,
    topic: String,
    description: Option<String>,
    has_password: bool,
    is_default: bool,
    permanent: bool,
    semi_permanent: bool,
    max_clients: i32,
    codec_quality: u8,
    needed_talk_power: i32,
    needed_join_power: i32,
    icon_id: u32,
}

#[derive(Serialize)]
struct ClientDto {
    id: u16,
    dbid: u64,
    nickname: String,
    uid: String,
    channel: u64,
    server_groups: Vec<u64>,
    channel_group: u64,
    talk_power: i32,
    input_muted: bool,
    output_muted: bool,
    input_hardware: bool,
    away: bool,
    away_msg: String,
    recording: bool,
    description: String,
    version: String,
    platform: String,
    extra: BTreeMap<String, String>,
    talking: bool,
}

#[derive(Serialize)]
struct GroupDto {
    id: u64,
    name: String,
    kind: u8,
    sort_id: u32,
    icon_id: u32,
    name_mode: u8,
}

#[derive(Serialize)]
struct ConnSummary {
    id: u32,
    address: String,
    nickname: String,
    server_name: String,
    phase: &'static str,
}

#[derive(Serialize)]
struct ServerDto {
    conn: u32,
    connected: bool,
    phase: &'static str,
    address: String,
    server_name: String,
    own_id: u16,
    ping_ms: Option<f32>,
    channels: Vec<ChannelDto>,
    clients: Vec<ClientDto>,
    server_groups: Vec<GroupDto>,
    channel_groups: Vec<GroupDto>,
    perms: HashMap<String, i32>,
    server_info: BTreeMap<String, String>,
}

#[derive(Serialize)]
struct Snapshot {
    connections: Vec<ConnSummary>,
    active: u32,
    server: Option<ServerDto>,
    mic_level_db: f32,
    speech_prob: f32,
    transmitting: bool,
    mic_test: bool,
    audio_error: Option<String>,
}

fn log_kind(kind: LogKind) -> (&'static str, Option<u16>) {
    match kind {
        LogKind::Info => ("info", None),
        LogKind::Error => ("error", None),
        LogKind::ChannelChat => ("channel", None),
        LogKind::ServerChat => ("server", None),
        LogKind::Private(p) => ("private", Some(p)),
        LogKind::Poke => ("poke", None),
    }
}

fn make_sink(app: AppHandle, conn: Arc<Conn>) -> Sink {
    Arc::new(move |ev| {
        let state = app.state::<AppState>();
        let id = conn.id;
        match ev {
            SessionEvent::Voice { from, codec, data } => {
                let blocked = {
                    let b = state.blocked.lock().unwrap();
                    !b.is_empty() && conn.model.lock().unwrap().clients.get(&from).is_some_and(|c| b.contains(&c.uid))
                };
                if !blocked {
                    state.audio.push_voice(id, from, codec, &data)
                }
            }
            SessionEvent::Status(s) => {
                let _ = app.emit("status", ConnPayload { conn: id, text: s });
            }
            SessionEvent::Connected => {
                conn.connected.store(true, Ordering::Relaxed);
                *conn.phase.lock().unwrap() = "connected";
                state.update_audio_target();
                let _ = app.emit("connected", ConnPayload { conn: id, text: String::new() });
                // Ask for server details for the info panel
                if let Some(h) = conn.session.lock().unwrap().clone() {
                    h.send(Command::new("servergetvariables"), "Serverinfo");
                }
            }
            SessionEvent::Log { kind, text } => {
                let (kind, partner) = log_kind(kind);
                let _ = app.emit("log", LogPayload { conn: id, kind, partner, text });
            }
            SessionEvent::Sound(snd) => {
                let _ = app.emit("sound", SoundPayload { conn: id, text: snd.key, clid: snd.clid, uid: snd.uid, blocked: snd.blocked });
            }
            SessionEvent::Notify(cmd) => {
                let items = cmd.items.iter().map(|it| it.iter().cloned().collect()).collect();
                let _ = app.emit("notify", NotifyPayload { conn: id, name: cmd.name.clone(), items });
            }
            SessionEvent::Disconnected(reason) => {
                conn.connected.store(false, Ordering::Relaxed);
                *conn.phase.lock().unwrap() = "disconnected";
                conn.session.lock().unwrap().take();
                state.audio.clear_connection(id);
                state.update_audio_target();
                let _ = app.emit("disconnected", ConnPayload { conn: id, text: reason });
            }
        }
    })
}

#[tauri::command]
async fn connect(app: AppHandle, state: State<'_, AppState>, args: ConnectArgs) -> Result<u32, String> {
    if args.server.trim().is_empty() || args.nickname.trim().chars().count() < 3 {
        return Err("Bitte Serveradresse und einen Spitznamen (mind. 3 Zeichen) angeben.".into());
    }
    let id = match args.conn {
        Some(id) if state.conns.lock().unwrap().contains_key(&id) => {
            if let Some(h) = state.conn(id)?.session.lock().unwrap().take() {
                h.disconnect("Neu verbinden");
            }
            id
        }
        _ => state.next_id.fetch_add(1, Ordering::Relaxed),
    };
    let conn = Arc::new(Conn {
        id,
        address: args.server.trim().into(),
        nickname: args.nickname.trim().into(),
        model: Arc::new(Mutex::new(Model::default())),
        session: Mutex::new(None),
        connected: AtomicBool::new(false),
        phase: Mutex::new("connecting"),
    });
    state.conns.lock().unwrap().insert(id, conn.clone());
    state.active.store(id, Ordering::Relaxed);

    let mut opts = ConnectOptions::new(&conn.address, &conn.nickname, state.data_dir.join("identity.txt"));
    opts.password = args.password;
    opts.channel = args.channel;
    opts.channel_password = args.channel_password;
    let h = session::spawn(opts, conn.model.clone(), make_sink(app.clone(), conn.clone()));
    *conn.session.lock().unwrap() = Some(h);
    state.update_audio_target();
    Ok(id)
}

#[tauri::command]
fn disconnect(state: State<'_, AppState>, conn: u32, message: Option<String>) -> Result<(), String> {
    if let Some(h) = state.conn(conn)?.session.lock().unwrap().clone() {
        h.disconnect(message.as_deref().unwrap_or("Verlassen"));
    }
    Ok(())
}

/// Close a tab (disconnecting first if needed).
#[tauri::command]
fn close_connection(state: State<'_, AppState>, conn: u32) {
    let c = state.conns.lock().unwrap().remove(&conn);
    if let Some(c) = c {
        if let Some(h) = c.session.lock().unwrap().take() {
            h.disconnect("Verlassen");
        }
    }
    state.audio.clear_connection(conn);
    if state.active.load(Ordering::Relaxed) == conn {
        let next = state.conns.lock().unwrap().keys().next().copied().unwrap_or(0);
        state.active.store(next, Ordering::Relaxed);
    }
    state.update_audio_target();
}

#[tauri::command]
fn set_active(state: State<'_, AppState>, conn: u32) {
    state.active.store(conn, Ordering::Relaxed);
    state.update_audio_target();
}

/// Send any protocol command. Password keys are hashed the way the official
/// client does (`base64(sha1(pw))`).
#[tauri::command]
fn ts_command(state: State<'_, AppState>, conn: u32, name: String, args: Vec<(String, String)>, items: Option<Vec<Vec<(String, String)>>>, label: Option<String>) -> Result<(), String> {
    let c = state.conn(conn)?;
    let h = c.session.lock().unwrap().clone().ok_or("Nicht verbunden")?;
    let hash = |k: &str, v: String| {
        if (k == "cpw" || k == "channel_password" || k == "virtualserver_password") && !v.is_empty() {
            hash_password(&v)
        } else {
            v
        }
    };
    let mut cmd = Command::new(&name);
    for (k, v) in args {
        let v = hash(&k, v);
        cmd.push(&k, v);
    }
    for item in items.unwrap_or_default() {
        cmd.next_item();
        for (k, v) in item {
            let v = hash(&k, v);
            cmd.push(&k, v);
        }
    }
    h.send(cmd, label.as_deref().unwrap_or(&name));
    Ok(())
}

fn groups(g: &BTreeMap<u64, ts3_client::model::GroupInfo>) -> Vec<GroupDto> {
    let mut v: Vec<GroupDto> = g.values().map(|g| GroupDto { id: g.id, name: g.name.clone(), kind: g.kind, sort_id: g.sort_id, icon_id: g.icon_id, name_mode: g.name_mode }).collect();
    v.sort_by_key(|g| (g.sort_id, g.id));
    v
}

fn server_dto(c: &Conn, transmitting: bool) -> ServerDto {
    let m = c.model.lock().unwrap();
    ServerDto {
        conn: c.id,
        connected: c.connected.load(Ordering::Relaxed),
        phase: *c.phase.lock().unwrap(),
        address: c.address.clone(),
        server_name: m.server_name.clone(),
        own_id: m.own_id,
        ping_ms: m.ping_ms,
        channels: m
            .ordered_channels()
            .into_iter()
            .map(|(depth, ch)| ChannelDto {
                id: ch.id,
                parent: ch.parent,
                depth,
                name: ch.name.clone(),
                topic: ch.topic.clone(),
                description: ch.description.clone(),
                has_password: ch.has_password,
                is_default: ch.is_default,
                permanent: ch.permanent,
                semi_permanent: ch.semi_permanent,
                max_clients: ch.max_clients,
                codec_quality: ch.codec_quality,
                needed_talk_power: ch.needed_talk_power,
                needed_join_power: ch.needed_join_power,
                icon_id: ch.icon_id,
            })
            .collect(),
        clients: m
            .clients
            .values()
            .map(|cl| ClientDto {
                id: cl.id,
                dbid: cl.dbid,
                nickname: cl.nickname.clone(),
                uid: cl.uid.clone(),
                channel: cl.channel,
                server_groups: cl.server_groups.clone(),
                channel_group: cl.channel_group,
                talk_power: cl.talk_power,
                input_muted: cl.input_muted,
                output_muted: cl.output_muted,
                input_hardware: cl.input_hardware,
                away: cl.away,
                away_msg: cl.away_msg.clone(),
                recording: cl.recording,
                description: cl.description.clone(),
                version: cl.version.clone(),
                platform: cl.platform.clone(),
                extra: cl.extra.clone(),
                talking: cl.talking_since.is_some() || (cl.id == m.own_id && transmitting),
            })
            .collect(),
        server_groups: groups(&m.server_groups),
        channel_groups: groups(&m.channel_groups),
        perms: m.perms.clone(),
        server_info: m.server_info.clone(),
    }
}

#[tauri::command]
fn get_state(state: State<'_, AppState>) -> Snapshot {
    let sh = &state.audio.shared;
    let active = state.active.load(Ordering::Relaxed);
    let conns = state.conns.lock().unwrap();
    // Our own "talking" ring only lights up on the server we transmit to.
    let transmitting = sh.transmitting.load(Ordering::Relaxed) && !sh.mic_test.load(Ordering::Relaxed);
    Snapshot {
        connections: conns
            .values()
            .map(|c| ConnSummary {
                id: c.id,
                address: c.address.clone(),
                nickname: c.nickname.clone(),
                server_name: c.model.lock().unwrap().server_name.clone(),
                phase: *c.phase.lock().unwrap(),
            })
            .collect(),
        active,
        server: conns.get(&active).map(|c| server_dto(c, transmitting)),
        mic_level_db: sh.level_db(),
        speech_prob: sh.speech_prob(),
        transmitting: sh.transmitting.load(Ordering::Relaxed),
        mic_test: sh.mic_test.load(Ordering::Relaxed),
        audio_error: sh.error.lock().unwrap().clone(),
    }
}

#[tauri::command]
fn get_audio_config(state: State<'_, AppState>) -> AudioConfig {
    state.audio.shared.cfg.lock().unwrap().clone()
}

#[tauri::command]
fn set_audio_config(state: State<'_, AppState>, cfg: AudioConfig) {
    let _ = std::fs::write(state.data_dir.join("audio.json"), serde_json::to_string_pretty(&cfg).unwrap_or_default());
    state.audio.set_config(cfg);
}

#[tauri::command]
fn set_mic_test(state: State<'_, AppState>, on: bool) {
    state.audio.shared.mic_test.store(on, Ordering::Relaxed);
}

#[tauri::command]
fn list_devices() -> audio::Devices {
    audio::list_devices()
}

/// Monitors and windows for the screen share picker (with thumbnails)
#[tauri::command]
async fn screen_sources() -> Vec<screen::Source> {
    tauri::async_runtime::spawn_blocking(screen::sources).await.unwrap_or_default()
}

/// Start capturing a source; encoded H.264 chunks arrive on `on_chunk`.
#[tauri::command]
fn screen_start(
    screens: State<'_, screen::Screens>,
    source: String,
    max_w: u32,
    max_h: u32,
    fps: u32,
    kbps: u32,
    on_chunk: tauri::ipc::Channel<tauri::ipc::InvokeResponseBody>,
) -> Result<u32, String> {
    screens.start(&source, max_w, max_h, fps, kbps, on_chunk)
}

#[tauri::command]
fn screen_keyframe(screens: State<'_, screen::Screens>, id: u32) {
    screens.keyframe(id);
}

#[tauri::command]
fn screen_stop(screens: State<'_, screen::Screens>, id: u32) {
    screens.stop(id);
}

/// Unique ids of locally blocked clients (their voice is dropped on every server)
#[tauri::command]
fn set_blocked(state: State<'_, AppState>, uids: Vec<String>) {
    *state.blocked.lock().unwrap() = uids.into_iter().collect();
}

#[tauri::command]
fn set_hotkeys(state: State<'_, AppState>, keys: HashMap<String, i32>) {
    *state.hotkeys.lock().unwrap() = keys;
}

const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";

fn reg(args: &[&str]) -> bool {
    let mut cmd = std::process::Command::new("reg");
    cmd.args(args).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.status().map(|s| s.success()).unwrap_or(false)
}

/// Start RustSpeak with Windows (HKCU Run key)
#[tauri::command]
fn get_autostart() -> bool {
    reg(&["query", RUN_KEY, "/v", "RustSpeak"])
}

#[tauri::command]
fn set_autostart(on: bool) -> Result<(), String> {
    let ok = if on {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let value = format!("\"{}\"", exe.display());
        reg(&["add", RUN_KEY, "/v", "RustSpeak", "/t", "REG_SZ", "/d", &value, "/f"])
    } else {
        reg(&["delete", RUN_KEY, "/v", "RustSpeak", "/f"]) || !get_autostart()
    };
    if ok { Ok(()) } else { Err("Autostart konnte nicht geändert werden".into()) }
}

#[derive(Serialize)]
struct IdentityInfo {
    uid: String,
    level: u32,
    offset: u64,
}

#[tauri::command]
async fn get_identity(state: State<'_, AppState>) -> Result<IdentityInfo, String> {
    let path = state.data_dir.join("identity.txt");
    tauri::async_runtime::spawn_blocking(move || {
        let id = tsproto::identity::Identity::load_or_create(&path, 8).map_err(|e| e.to_string())?;
        Ok(IdentityInfo { uid: id.uid(), level: id.level(), offset: id.offset })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Raise the identity security level (hashcash, can take a while for high levels)
#[tauri::command]
async fn improve_identity(state: State<'_, AppState>, level: u32) -> Result<IdentityInfo, String> {
    if level > 32 {
        return Err("Maximal Level 32".into());
    }
    let path = state.data_dir.join("identity.txt");
    tauri::async_runtime::spawn_blocking(move || {
        let id = tsproto::identity::Identity::load_or_create(&path, level).map_err(|e| e.to_string())?;
        Ok(IdentityInfo { uid: id.uid(), level: id.level(), offset: id.offset })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let cfg: AudioConfig = std::fs::read_to_string(data_dir.join("audio.json"))
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            let hotkeys: Arc<Mutex<HashMap<String, i32>>> = Arc::new(Mutex::new(HashMap::new()));
            {
                // Global hotkeys (work while the window is in the background)
                let hk = hotkeys.clone();
                let handle = app.handle().clone();
                std::thread::Builder::new().name("hotkeys".into()).spawn(move || {
                    let mut down: HashMap<String, bool> = HashMap::new();
                    loop {
                        std::thread::sleep(std::time::Duration::from_millis(25));
                        let keys = hk.lock().unwrap().clone();
                        for (action, vk) in keys {
                            if vk <= 0 {
                                continue;
                            }
                            let pressed = audio::key_down(vk);
                            let was = down.insert(action.clone(), pressed).unwrap_or(false);
                            if pressed && !was {
                                let _ = handle.emit("hotkey", action);
                            }
                        }
                    }
                })?;
            }
            app.manage(screen::Screens::default());
            app.manage(AppState {
                conns: Mutex::new(BTreeMap::new()),
                active: AtomicU32::new(0),
                next_id: AtomicU32::new(1),
                audio: Audio::start(cfg),
                data_dir,
                hotkeys,
                blocked: Mutex::default(),
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window.try_state::<AppState>() {
                    let mut any = false;
                    for c in state.conns.lock().unwrap().values() {
                        if let Some(h) = c.session.lock().unwrap().clone() {
                            h.disconnect("Fenster geschlossen");
                            any = true;
                        }
                    }
                    if any {
                        std::thread::sleep(std::time::Duration::from_millis(300));
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            connect,
            disconnect,
            close_connection,
            set_active,
            ts_command,
            get_state,
            get_audio_config,
            set_audio_config,
            set_mic_test,
            list_devices,
            set_hotkeys,
            get_autostart,
            set_autostart,
            get_identity,
            improve_identity,
            screen_sources,
            screen_start,
            screen_keyframe,
            screen_stop,
            set_blocked
        ])
        .run(tauri::generate_context!())
        .expect("error while running RustSpeak");
}

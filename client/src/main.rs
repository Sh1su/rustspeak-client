//! TeamSpeak 3 compatible command line client, reimplemented in Rust.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::Result;
use clap::Parser;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc;

use ts3_client::model::Model;
use ts3_client::session::{self, ConnectOptions, SessionEvent, SessionHandle};
use tsproto::{hash_password, Command};

#[derive(Parser)]
#[command(version, about = "TeamSpeak 3 compatible command line client")]
struct Args {
    /// Server address (host or host:port)
    #[arg(default_value = "127.0.0.1")]
    server: String,
    #[arg(short, long, default_value = "RustClient")]
    nickname: String,
    /// Identity file (created on first use)
    #[arg(long, default_value = "identity.txt")]
    identity: PathBuf,
    /// Security level to raise a new identity to
    #[arg(long, default_value_t = 8)]
    security_level: u32,
    /// Server password
    #[arg(long, default_value = "")]
    password: String,
    /// Default channel ("/<cid>" or "Parent/Child")
    #[arg(long, default_value = "")]
    channel: String,
    #[arg(long, default_value = "")]
    channel_password: String,
    /// Override client_version / client_platform / client_version_sign
    #[arg(long, default_value = session::VERSION)]
    client_version: String,
    #[arg(long, default_value = session::PLATFORM)]
    client_platform: String,
    #[arg(long, default_value = session::VERSION_SIGN)]
    version_sign: String,
    /// Accept a license root key announced by the server (`root=`) instead of the official one
    #[arg(long, default_value_t = true, action = clap::ArgAction::Set)]
    accept_server_root: bool,
    /// Run these commands after connecting (separated by ';'), e.g. "/list;/msg hi;/quit"
    #[arg(long)]
    exec: Option<String>,
}

enum Input {
    Line(String),
    Event(SessionEvent),
}

fn out(s: &str) {
    for line in s.lines() {
        println!("{line}");
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "warn".into()))
        .with_writer(std::io::stderr)
        .init();
    let a = Args::parse();
    let opts = ConnectOptions {
        server: a.server.clone(),
        nickname: a.nickname.clone(),
        identity: a.identity.clone(),
        security_level: a.security_level,
        password: a.password.clone(),
        channel: a.channel.clone(),
        channel_password: a.channel_password.clone(),
        client_version: a.client_version.clone(),
        client_platform: a.client_platform.clone(),
        version_sign: a.version_sign.clone(),
        accept_server_root: a.accept_server_root,
    };

    let (tx, mut rx) = mpsc::unbounded_channel::<Input>();
    let model = Arc::new(Mutex::new(Model::default()));
    let ev_tx = tx.clone();
    let handle = session::spawn(opts, model.clone(), Arc::new(move |e| {
        let _ = ev_tx.send(Input::Event(e));
    }));
    tokio::spawn(async move {
        let mut lines = BufReader::new(tokio::io::stdin()).lines();
        while let Ok(Some(l)) = lines.next_line().await {
            if tx.send(Input::Line(l)).is_err() {
                break;
            }
        }
    });

    let mut script = a.exec.as_deref().map(|s| s.split(';').map(|x| x.trim().to_string()).collect::<Vec<_>>()).unwrap_or_default().into_iter();
    let mut cli = Cli { h: handle, model, connected: false, voice_until: None, voice_next: Instant::now(), talking: Default::default() };
    let mut tick = tokio::time::interval(Duration::from_millis(20));
    let mut script_wait = Instant::now();
    loop {
        tokio::select! {
            Some(i) = rx.recv() => match i {
                Input::Line(l) => cli.on_line(&l),
                Input::Event(SessionEvent::Disconnected(r)) => {
                    out(&format!("Disconnected: {r}"));
                    return Ok(());
                }
                Input::Event(e) => cli.on_event(e),
            },
            _ = tick.tick() => {
                cli.on_tick();
                if cli.connected && Instant::now() >= script_wait && cli.voice_until.is_none() {
                    if let Some(line) = script.next() {
                        out(&format!("> {line}"));
                        cli.on_line(&line);
                        script_wait = Instant::now() + Duration::from_millis(700);
                    }
                }
            }
        }
    }
}

struct Cli {
    h: SessionHandle,
    model: Arc<Mutex<Model>>,
    connected: bool,
    voice_until: Option<Instant>,
    voice_next: Instant,
    talking: std::collections::HashSet<u16>,
}

impl Cli {
    fn on_event(&mut self, e: SessionEvent) {
        match e {
            SessionEvent::Status(s) => out(&s),
            SessionEvent::Connected => {
                self.connected = true;
                out("Type /help for commands.");
            }
            SessionEvent::Log { text, .. } => out(&text),
            SessionEvent::Voice { from, codec, data } => {
                let nick = self.model.lock().unwrap().clients.get(&from).map(|c| c.nickname.clone()).unwrap_or_default();
                if data.is_empty() {
                    if self.talking.remove(&from) {
                        out(&format!("{nick} stopped talking"));
                    }
                } else if self.talking.insert(from) {
                    out(&format!("{nick} is talking (codec {codec})"));
                }
            }
            SessionEvent::Notify(c) => out(&c.to_string()),
            SessionEvent::Disconnected(_) | SessionEvent::Sound(..) => {}
        }
    }

    fn on_tick(&mut self) {
        // talkers that stopped without an end marker
        let m = self.model.lock().unwrap();
        let stopped: Vec<u16> = self.talking.iter().copied().filter(|id| m.clients.get(id).map(|c| c.talking_since.is_none()).unwrap_or(true)).collect();
        drop(m);
        for id in stopped {
            self.talking.remove(&id);
            let nick = self.model.lock().unwrap().clients.get(&id).map(|c| c.nickname.clone()).unwrap_or_default();
            out(&format!("{nick} stopped talking"));
        }
        if let Some(until) = self.voice_until {
            let now = Instant::now();
            if now >= until {
                self.voice_until = None;
                self.h.voice(4, vec![]);
                out("Voice test finished");
            } else if now >= self.voice_next {
                self.voice_next = now + Duration::from_millis(20);
                self.h.voice(4, vec![0xf8, 0xff, 0xfe]);
            }
        }
    }

    fn on_line(&mut self, line: &str) {
        let line = line.trim();
        if line.is_empty() {
            return;
        }
        if !self.connected {
            out("Not connected yet");
            return;
        }
        let (cmd, rest) = match line.strip_prefix('/') {
            Some(l) => l.split_once(' ').map(|(a, b)| (a, b.trim())).unwrap_or((l, "")),
            None => ("msg", line),
        };
        let (arg1, arg2) = rest.split_once(' ').map(|(a, b)| (a, b.trim())).unwrap_or((rest, ""));
        let m = self.model.lock().unwrap();
        let own = m.own().cloned().unwrap_or_default();
        let find_client = |s: &str| m.find_client(s);
        let find_channel = |s: &str| m.find_channel(s);
        match cmd {
            "help" | "h" | "?" => out(HELP),
            "list" | "l" => out(&m.tree()),
            "msg" | "m" => self.h.send(Command::new("sendtextmessage").arg("targetmode", 2).arg("target", 0).arg("msg", rest), "message"),
            "smsg" => self.h.send(Command::new("sendtextmessage").arg("targetmode", 3).arg("target", 0).arg("msg", rest), "message"),
            "pm" | "poke" => match find_client(arg1) {
                None => out(&format!("No client '{arg1}'")),
                Some(t) if cmd == "pm" => self.h.send(Command::new("sendtextmessage").arg("targetmode", 1).arg("target", t).arg("msg", arg2), "pm"),
                Some(t) => self.h.send(Command::new("clientpoke").arg("clid", t).arg("msg", arg2), "poke"),
            },
            "join" | "j" => match find_channel(arg1) {
                None => out(&format!("No channel '{arg1}'")),
                Some(cid) => {
                    let mut c = Command::new("clientmove").arg("clid", own.id).arg("cid", cid);
                    if !arg2.is_empty() {
                        c.push("cpw", hash_password(arg2));
                    }
                    self.h.send(c, "join channel");
                }
            },
            "nick" => self.h.send(Command::new("clientupdate").arg("client_nickname", rest), "rename"),
            "mute" => self.h.send(Command::new("clientupdate").arg("client_input_muted", !own.input_muted as u8), "mute"),
            "deaf" => self.h.send(Command::new("clientupdate").arg("client_output_muted", !own.output_muted as u8), "deaf"),
            "away" => {
                let mut c = Command::new("clientupdate").arg("client_away", !own.away as u8);
                if !own.away {
                    c.push("client_away_message", rest);
                }
                self.h.send(c, "away");
            }
            "mkchan" => {
                let mut c = Command::new("channelcreate").arg("channel_name", arg1);
                if !arg2.is_empty() {
                    c.push("channel_password", hash_password(arg2));
                }
                self.h.send(c, "create channel");
            }
            "rmchan" => match find_channel(arg1) {
                None => out(&format!("No channel '{arg1}'")),
                Some(cid) => self.h.send(Command::new("channeldelete").arg("cid", cid).arg("force", 1), "delete channel"),
            },
            "topic" => self.h.send(Command::new("channeledit").arg("cid", own.channel).arg("channel_topic", rest), "set topic"),
            "kick" => match find_client(arg1) {
                None => out(&format!("No client '{arg1}'")),
                Some(t) => self.h.send(Command::new("clientkick").arg("clid", t).arg("reasonid", 5).arg("reasonmsg", arg2), "kick"),
            },
            "raw" => self.h.send(Command::parse(rest, true), "raw command"),
            "voicetest" => {
                let secs: u64 = arg1.parse().unwrap_or(2);
                self.voice_until = Some(Instant::now() + Duration::from_secs(secs));
                out(&format!("Sending {secs}s of Opus silence frames ..."));
            }
            "ping" => out(&format!("RTT: {:?} ms", m.ping_ms)),
            "quit" | "q" | "exit" => self.h.disconnect(if rest.is_empty() { "leaving" } else { rest }),
            other => out(&format!("Unknown command /{other}, try /help")),
        }
    }
}

const HELP: &str = "\
Commands:
  <text>                  send a message to your channel
  /list                   channel tree with clients
  /join <channel> [pw]    switch channel (name or cid)
  /msg <text>             channel message
  /smsg <text>            server message
  /pm <client> <text>     private message (nickname or clid)
  /poke <client> <text>   poke a client
  /nick <name>            change nickname
  /mute, /deaf            toggle microphone / speakers
  /away [message]         toggle away status
  /mkchan <name> [pw]     create a channel
  /rmchan <channel>       delete a channel
  /topic <text>           set the topic of your channel
  /kick <client> [reason] kick from server (needs Server Admin)
  /voicetest [seconds]    send Opus silence frames (voice relay test)
  /raw <command>          send a raw protocol command
  /ping                   show round trip time
  /quit [message]         disconnect";

//! Client-side view of the server, kept in sync from notifications.

use std::collections::{BTreeMap, HashMap};
use std::time::Instant;

use tsproto::Command;

#[derive(Clone, Debug, Default)]
pub struct Channel {
    pub id: u64,
    pub parent: u64,
    pub order: u64,
    pub name: String,
    pub topic: String,
    pub description: Option<String>,
    pub has_password: bool,
    pub max_clients: i32,
    pub is_default: bool,
    pub permanent: bool,
    pub semi_permanent: bool,
    pub codec: u8,
    pub codec_quality: u8,
    pub needed_talk_power: i32,
    pub needed_join_power: i32,
    pub icon_id: u32,
}

#[derive(Clone, Debug, Default)]
pub struct Client {
    pub id: u16,
    pub uid: String,
    pub dbid: u64,
    pub nickname: String,
    pub channel: u64,
    pub server_groups: Vec<u64>,
    pub channel_group: u64,
    pub talk_power: i32,
    pub input_muted: bool,
    pub output_muted: bool,
    pub input_hardware: bool,
    pub output_hardware: bool,
    pub away: bool,
    pub away_msg: String,
    pub recording: bool,
    pub description: String,
    pub version: String,
    pub platform: String,
    /// Extra values from `clientgetvariables` (times, connection counts, ...)
    pub extra: BTreeMap<String, String>,
    pub talking_since: Option<Instant>,
    pub last_voice: Option<Instant>,
}

/// A notification sound (see [`Model::sound_event`]).
#[derive(Clone, Debug)]
pub struct Sound {
    pub key: &'static str,
    /// Client the event is about (0 if none)
    pub clid: u16,
    /// Unique id of that client (empty if unknown)
    pub uid: String,
    /// Key to use instead when `clid` is blocked locally
    pub blocked: Option<&'static str>,
}

#[derive(Clone, Debug, Default)]
pub struct GroupInfo {
    pub id: u64,
    pub name: String,
    pub kind: u8,
    pub sort_id: u32,
    pub icon_id: u32,
    /// 0 = hidden, 1 = before the nickname, 2 = after it
    pub name_mode: u8,
}

#[derive(Default)]
pub struct Model {
    pub own_id: u16,
    pub server_name: String,
    pub welcome: String,
    pub ping_ms: Option<f32>,
    pub channels: BTreeMap<u64, Channel>,
    pub clients: BTreeMap<u16, Client>,
    pub server_groups: BTreeMap<u64, GroupInfo>,
    pub channel_groups: BTreeMap<u64, GroupInfo>,
    /// Our effective permissions (`notifyclientneededpermissions`)
    pub perms: HashMap<String, i32>,
    /// `notifyserverupdated` / `initserver` properties
    pub server_info: BTreeMap<String, String>,
}

fn flag(c: &Command, i: usize, k: &str) -> Option<bool> {
    c.get_in(i, k).map(|v| v == "1")
}

fn parse_groups(c: &Command, key: &str) -> BTreeMap<u64, GroupInfo> {
    (0..c.items.len())
        .filter_map(|i| {
            let id = c.num_in(i, key)?;
            Some((
                id,
                GroupInfo {
                    id,
                    name: c.get_in(i, "name").unwrap_or("").into(),
                    kind: c.num_in(i, "type").unwrap_or(1),
                    sort_id: c.num_in(i, "sortid").unwrap_or(0),
                    name_mode: c.num_in(i, "namemode").unwrap_or(0),
                    icon_id: c.get_in(i, "iconid").and_then(|v| v.parse::<i64>().ok()).map(|v| v as u32).unwrap_or(0),
                },
            ))
        })
        .collect()
}

impl Model {
    pub fn own(&self) -> Option<&Client> {
        self.clients.get(&self.own_id)
    }

    pub fn own_channel(&self) -> u64 {
        self.own().map(|c| c.channel).unwrap_or(0)
    }

    pub fn perm(&self, name: &str) -> i32 {
        self.perms.get(name).copied().unwrap_or(0)
    }

    pub fn channel_name(&self, id: u64) -> String {
        self.channels.get(&id).map(|c| c.name.clone()).unwrap_or_else(|| format!("#{id}"))
    }

    pub fn find_client(&self, s: &str) -> Option<u16> {
        if let Ok(id) = s.parse::<u16>() {
            if self.clients.contains_key(&id) {
                return Some(id);
            }
        }
        let s = s.to_lowercase();
        self.clients.values().find(|c| c.nickname.to_lowercase() == s).map(|c| c.id)
    }

    pub fn find_channel(&self, s: &str) -> Option<u64> {
        if let Ok(id) = s.parse::<u64>() {
            if self.channels.contains_key(&id) {
                return Some(id);
            }
        }
        let s = s.to_lowercase();
        self.channels.values().find(|c| c.name.to_lowercase() == s).map(|c| c.id)
    }

    fn update_channel(ch: &mut Channel, c: &Command, i: usize) {
        if let Some(v) = c.get_in(i, "channel_name") {
            ch.name = v.into();
        }
        if let Some(v) = c.get_in(i, "channel_topic") {
            ch.topic = v.into();
        }
        if let Some(v) = c.get_in(i, "channel_description") {
            ch.description = Some(v.into());
        }
        if let Some(v) = c.num_in(i, "channel_order") {
            ch.order = v;
        }
        if let Some(v) = flag(c, i, "channel_flag_password") {
            ch.has_password = v;
        }
        if let Some(v) = flag(c, i, "channel_flag_default") {
            ch.is_default = v;
        }
        if let Some(v) = flag(c, i, "channel_flag_permanent") {
            ch.permanent = v;
        }
        if let Some(v) = flag(c, i, "channel_flag_semi_permanent") {
            ch.semi_permanent = v;
        }
        if let Some(v) = c.num_in(i, "channel_maxclients") {
            ch.max_clients = v;
        }
        if flag(c, i, "channel_flag_maxclients_unlimited") == Some(true) {
            ch.max_clients = -1;
        }
        if let Some(v) = c.num_in(i, "channel_codec") {
            ch.codec = v;
        }
        if let Some(v) = c.num_in(i, "channel_codec_quality") {
            ch.codec_quality = v;
        }
        if let Some(v) = c.num_in(i, "channel_needed_talk_power") {
            ch.needed_talk_power = v;
        }
        if let Some(v) = c.num_in(i, "channel_needed_join_power") {
            ch.needed_join_power = v;
        }
        if let Some(v) = c.get_in(i, "channel_icon_id").and_then(|v| v.parse::<i64>().ok()) {
            ch.icon_id = v as u32;
        }
    }

    fn update_client(cl: &mut Client, c: &Command, i: usize) {
        let Some(item) = c.items.get(i) else { return };
        for (k, v) in item {
            let f = v == "1";
            match k.as_str() {
                "client_nickname" => cl.nickname = v.clone(),
                "client_unique_identifier" => cl.uid = v.clone(),
                "client_database_id" => cl.dbid = v.parse().unwrap_or(cl.dbid),
                "client_servergroups" => cl.server_groups = v.split(',').filter_map(|g| g.trim().parse().ok()).collect(),
                "client_channel_group_id" => cl.channel_group = v.parse().unwrap_or(cl.channel_group),
                "client_talk_power" => cl.talk_power = v.parse().unwrap_or(cl.talk_power),
                "client_input_muted" => cl.input_muted = f,
                "client_output_muted" => cl.output_muted = f,
                "client_input_hardware" => cl.input_hardware = f,
                "client_output_hardware" => cl.output_hardware = f,
                "client_away" => cl.away = f,
                "client_away_message" => cl.away_msg = v.clone(),
                "client_is_recording" => cl.recording = f,
                "client_description" => cl.description = v.clone(),
                "client_version" => cl.version = v.clone(),
                "client_platform" => cl.platform = v.clone(),
                "client_created" | "client_totalconnections" | "connection_connected_time" | "client_idle_time" | "client_country" | "client_is_talker" => {
                    cl.extra.insert(k.clone(), v.clone());
                }
                _ => {}
            }
        }
    }

    /// Sound for a notification (computed *before* it is applied), with the client it is
    /// about and the variant to play when that client is blocked locally.
    pub fn sound_event(&self, c: &Command) -> Option<Sound> {
        let key = self.sound_for(c)?;
        let clid = match c.name.as_str() {
            "notifycliententerview" | "notifyclientleftview" | "notifyclientmoved" => c.num::<u16>("clid").unwrap_or(0),
            "notifytextmessage" | "notifyclientpoke" => c.num::<u16>("invokerid").unwrap_or(0),
            _ => 0,
        };
        let reason = c.get("reasonid").unwrap_or("0");
        let blocked = match (c.name.as_str(), key) {
            ("notifycliententerview", "user_joined_channel") => Some("blocked_entered"),
            (_, "user_kicked_server") => Some("blocked_kicked_server"),
            (_, "user_banned") => Some("blocked_banned"),
            (_, "user_lost_connection") => Some("blocked_timed_out"),
            ("notifyclientleftview", "user_left_channel") => Some("blocked_disconnected"),
            ("notifyclientmoved", "user_joined_channel") => Some(match reason {
                "4" => "blocked_kicked_to",
                "1" => "blocked_moved_to",
                _ => "blocked_joined",
            }),
            ("notifyclientmoved", "user_kicked_channel") => Some("blocked_kicked_out"),
            ("notifyclientmoved", "user_left_channel") => Some(if reason == "1" { "blocked_moved_out" } else { "blocked_left" }),
            _ => None,
        };
        let uid = c
            .get("client_unique_identifier")
            .map(str::to_owned)
            .or_else(|| self.clients.get(&clid).map(|cl| cl.uid.clone()))
            .unwrap_or_default();
        Some(Sound { key, clid, uid, blocked })
    }

    /// Sound/announcement key for a notification, computed *before* it is applied.
    pub fn sound_for(&self, c: &Command) -> Option<&'static str> {
        let own = self.own_id;
        let own_ch = self.own_channel();
        match c.name.as_str() {
            "notifycliententerview" => {
                if self.clients.is_empty() || c.num::<u16>("clid") == Some(own) || c.get("reasonid") != Some("0") {
                    return None;
                }
                Some(if c.num::<u64>("ctid") == Some(own_ch) { "user_joined_channel" } else { "user_connected" })
            }
            "notifyclientleftview" => {
                let id: u16 = c.num("clid")?;
                if id == own {
                    return None;
                }
                let was_here = self.clients.get(&id).map(|cl| cl.channel == own_ch).unwrap_or(false);
                Some(match (c.get("reasonid"), was_here) {
                    (Some("5"), true) => "user_kicked_server",
                    (Some("6"), true) => "user_banned",
                    (Some("3"), true) => "user_lost_connection",
                    (_, true) => "user_left_channel",
                    _ => "user_disconnected",
                })
            }
            "notifyclientmoved" => {
                let id: u16 = c.num("clid")?;
                let to: u64 = c.num("ctid")?;
                if id == own {
                    return Some(match c.get("reasonid") {
                        Some("4") => "you_kicked_channel",
                        Some("0") => "channel_switched",
                        _ => "you_were_moved",
                    });
                }
                let from = self.clients.get(&id).map(|cl| cl.channel).unwrap_or(0);
                if to == own_ch {
                    Some("user_joined_channel")
                } else if from == own_ch {
                    Some(if c.get("reasonid") == Some("4") { "user_kicked_channel" } else { "user_left_channel" })
                } else {
                    None
                }
            }
            "notifytextmessage" => {
                if c.num::<u16>("invokerid") == Some(own) {
                    return None;
                }
                match c.get("targetmode") {
                    Some("1") => Some("message_private"),
                    Some("2") => Some("message_channel"),
                    _ => Some("message_server"),
                }
            }
            "notifyclientpoke" => Some("poked"),
            "notifyservergroupclientadded" if c.num::<u16>("clid") == Some(own) => Some("group_assigned"),
            "notifyservergroupclientdeleted" if c.num::<u16>("clid") == Some(own) => Some("group_removed"),
            "notifyclientchannelgroupchanged" if c.num::<u16>("clid") == Some(own) && c.get("invokerid").map(|i| i != "0").unwrap_or(false) => {
                Some("channelgroup_assigned")
            }
            "notifychannelcreated" if c.num::<u16>("invokerid") == Some(own) => Some("channel_created"),
            "notifychanneldeleted" if c.num::<u16>("invokerid") == Some(own) => Some("channel_deleted"),
            "notifychannelmoved" if c.num::<u16>("invokerid") == Some(own) => Some("channel_moved"),
            "notifychanneledited" => {
                if c.num::<u16>("invokerid") == Some(own) {
                    Some("channel_edited")
                } else if c.num::<u64>("cid") == Some(own_ch) && c.get("invokerid").is_some_and(|i| i != "0") {
                    Some("your_channel_edited")
                } else {
                    None
                }
            }
            "notifyserveredited" if c.num::<u16>("invokerid") == Some(own) => Some("server_edited"),
            "notifyclientupdated" if c.num::<u16>("clid") == Some(own) => {
                let was = self.clients.get(&own).is_some_and(|cl| cl.extra.get("client_is_talker").is_some_and(|v| v == "1"));
                match c.get("client_is_talker") {
                    Some("1") if !was => Some("talk_power_granted"),
                    Some("0") if was => Some("talk_power_revoked"),
                    _ => None,
                }
            }
            _ => None,
        }
    }

    /// Apply a notification. Returns a line to show to the user, if any.
    pub fn apply(&mut self, c: &Command) -> Option<String> {
        match c.name.as_str() {
            "initserver" => {
                self.own_id = c.num("aclid").unwrap_or(0);
                self.server_name = c.get_or("virtualserver_name", "").into();
                self.welcome = c.get_or("virtualserver_welcomemessage", "").into();
                for (k, v) in &c.items[0] {
                    if k.starts_with("virtualserver_") {
                        self.server_info.insert(k.clone(), v.clone());
                    }
                }
                Some(format!("Verbunden mit „{}“ als Client {}", self.server_name, self.own_id))
            }
            "notifyserverupdated" => {
                for (k, v) in &c.items[0] {
                    self.server_info.insert(k.clone(), v.clone());
                }
                if let Some(n) = c.get("virtualserver_name") {
                    self.server_name = n.into();
                }
                None
            }
            "notifyservergrouplist" => {
                self.server_groups = parse_groups(c, "sgid");
                None
            }
            "notifychannelgrouplist" => {
                self.channel_groups = parse_groups(c, "cgid");
                None
            }
            "notifyclientneededpermissions" => {
                for i in 0..c.items.len() {
                    if let (Some(name), Some(v)) = (c.get_in(i, "permsid"), c.num_in::<i32>(i, "permvalue")) {
                        self.perms.insert(name.into(), v);
                    }
                }
                None
            }
            "channellist" | "notifychannelcreated" => {
                let mut created = None;
                for i in 0..c.items.len() {
                    let Some(id) = c.num_in(i, "cid") else { continue };
                    let mut ch = Channel { id, parent: c.num_in(i, "cpid").unwrap_or(0), max_clients: -1, codec: 4, codec_quality: 6, ..Default::default() };
                    Self::update_channel(&mut ch, c, i);
                    // Inserting after `order`: the old successor now follows us.
                    if c.name == "notifychannelcreated" {
                        for o in self.channels.values_mut() {
                            if o.parent == ch.parent && o.order == ch.order {
                                o.order = id;
                            }
                        }
                        created = Some(format!("Channel „{}“ erstellt von {}", ch.name, c.get_or("invokername", "?")));
                    }
                    self.channels.insert(id, ch);
                }
                created
            }
            "notifychanneledited" => {
                let id = c.num("cid")?;
                let ch = self.channels.get_mut(&id)?;
                Self::update_channel(ch, c, 0);
                // Pure description fetches carry no invoker.
                c.get("invokername").map(|inv| format!("Channel „{}“ bearbeitet von {inv}", ch.name))
            }
            "notifychanneldeleted" => {
                let mut out = Vec::new();
                for i in 0..c.items.len() {
                    if let Some(ch) = c.num_in(i, "cid").and_then(|id| self.channels.remove(&id)) {
                        for o in self.channels.values_mut() {
                            if o.parent == ch.parent && o.order == ch.id {
                                o.order = ch.order;
                            }
                        }
                        out.push(format!("Channel „{}“ gelöscht", ch.name));
                    }
                }
                Some(out.join("\n"))
            }
            "notifycliententerview" => {
                let mut out = Vec::new();
                for i in 0..c.items.len() {
                    let Some(id) = c.num_in(i, "clid") else { continue };
                    let mut cl = Client { id, channel: c.num_in(i, "ctid").unwrap_or(0), input_hardware: true, output_hardware: true, ..Default::default() };
                    Self::update_client(&mut cl, c, i);
                    if id != self.own_id && c.get_in(i, "reasonid") == Some("0") && !self.clients.is_empty() {
                        out.push(format!("{} hat sich verbunden (Channel „{}“)", cl.nickname, self.channel_name(cl.channel)));
                    }
                    self.clients.insert(id, cl);
                }
                (!out.is_empty()).then(|| out.join("\n"))
            }
            "notifyclientleftview" => {
                let id = c.num("clid")?;
                let cl = self.clients.remove(&id)?;
                let msg = c.get_or("reasonmsg", "");
                let why = match c.get("reasonid") {
                    Some("3") => "hat die Verbindung verloren".to_string(),
                    Some("4") | Some("5") => format!("wurde von {} gekickt ({msg})", c.get_or("invokername", "?")),
                    Some("6") => format!("wurde von {} gebannt ({msg})", c.get_or("invokername", "?")),
                    _ if !msg.is_empty() => format!("hat den Server verlassen ({msg})"),
                    _ => "hat den Server verlassen".to_string(),
                };
                Some(format!("{} {}", cl.nickname, why))
            }
            "notifyclientmoved" => {
                let id = c.num("clid")?;
                let to = c.num("ctid")?;
                let name = self.channel_name(to);
                let cl = self.clients.get_mut(&id)?;
                cl.channel = to;
                let who = cl.nickname.clone();
                Some(match (c.get("reasonid"), c.get("invokername")) {
                    (Some("4"), Some(inv)) => format!("{who} wurde von {inv} aus dem Channel geworfen ({})", c.get_or("reasonmsg", "")),
                    (Some(r), Some(inv)) if r != "0" => format!("{who} wurde von {inv} nach „{name}“ verschoben"),
                    _ => format!("{who} wechselte in den Channel „{name}“"),
                })
            }
            "notifyclientupdated" => {
                let id = c.num("clid")?;
                let cl = self.clients.get_mut(&id)?;
                let old = cl.nickname.clone();
                Self::update_client(cl, c, 0);
                if old != cl.nickname {
                    return Some(format!("{old} heißt jetzt {}", cl.nickname));
                }
                None
            }
            "notifyclientchannelgroupchanged" => {
                let id = c.num("clid")?;
                let cgid = c.num("cgid")?;
                let gname = self.channel_groups.get(&cgid).map(|g| g.name.clone()).unwrap_or_else(|| cgid.to_string());
                let cl = self.clients.get_mut(&id)?;
                cl.channel_group = cgid;
                let inv = c.get("invokername").filter(|_| c.get("invokerid").map(|i| i != "0").unwrap_or(false))?;
                Some(format!("{} ist jetzt „{gname}“ (durch {inv})", cl.nickname))
            }
            "notifyservergroupclientadded" | "notifyservergroupclientdeleted" => {
                let id: u16 = c.num("clid")?;
                let sgid: u64 = c.num("sgid")?;
                let gname = self.server_groups.get(&sgid).map(|g| g.name.clone()).unwrap_or_else(|| sgid.to_string());
                let who = self.clients.get(&id).map(|c| c.nickname.clone()).unwrap_or_default();
                let inv = c.get_or("invokername", "Server");
                Some(if c.name.ends_with("added") {
                    format!("{who} wurde von {inv} zur Servergruppe „{gname}“ hinzugefügt")
                } else {
                    format!("{who} wurde von {inv} aus der Servergruppe „{gname}“ entfernt")
                })
            }
            "notifytextmessage" => {
                let from = c.get_or("invokername", "?");
                let msg = c.get_or("msg", "");
                Some(match c.get("targetmode") {
                    Some("1") => format!("[private] <{from}> {msg}"),
                    Some("3") => format!("[server] <{from}> {msg}"),
                    _ => format!("[channel] <{from}> {msg}"),
                })
            }
            "notifyclientpoke" => Some(format!("{} stupst dich an: {}", c.get_or("invokername", "?"), c.get_or("msg", ""))),
            "notifyserveredited" => {
                for (k, v) in &c.items[0] {
                    if k.starts_with("virtualserver_") {
                        self.server_info.insert(k.clone(), v.clone());
                    }
                }
                if let Some(n) = c.get("virtualserver_name") {
                    self.server_name = n.into();
                }
                Some(format!("Servereinstellungen geändert von {}", c.get_or("invokername", "?")))
            }
            _ => None,
        }
    }

    /// Channels in display order (parents before children), with their depth.
    pub fn ordered_channels(&self) -> Vec<(usize, &Channel)> {
        let mut out = Vec::new();
        self.order_level(0, 0, &mut out);
        out
    }

    fn order_level<'a>(&'a self, parent: u64, depth: usize, out: &mut Vec<(usize, &'a Channel)>) {
        let mut sibs: Vec<&Channel> = self.channels.values().filter(|c| c.parent == parent).collect();
        let mut prev = 0;
        while !sibs.is_empty() {
            let i = sibs.iter().position(|c| c.order == prev).unwrap_or(0);
            let ch = sibs.remove(i);
            prev = ch.id;
            out.push((depth, ch));
            self.order_level(ch.id, depth + 1, out);
        }
    }

    /// Channel tree with clients, ready to print.
    pub fn tree(&self) -> String {
        let mut out = format!("{}\n", self.server_name);
        for (depth, ch) in self.ordered_channels() {
            let ind = "  ".repeat(depth + 1);
            let mut flags = String::new();
            if ch.has_password {
                flags.push_str(" [pw]");
            }
            if ch.is_default {
                flags.push_str(" [default]");
            }
            out.push_str(&format!("{ind}# {} (cid {}){}\n", ch.name, ch.id, flags));
            for cl in self.clients.values().filter(|c| c.channel == ch.id) {
                let mut st = String::new();
                if cl.talking_since.is_some() {
                    st.push_str(" [talking]");
                }
                if cl.input_muted {
                    st.push_str(" [mic muted]");
                }
                if cl.output_muted {
                    st.push_str(" [sound muted]");
                }
                if cl.away {
                    st.push_str(&format!(" [away: {}]", cl.away_msg));
                }
                let groups: Vec<String> = cl.server_groups.iter().filter_map(|g| self.server_groups.get(g)).map(|g| g.name.clone()).collect();
                if !groups.is_empty() {
                    st.push_str(&format!(" [{}]", groups.join(", ")));
                }
                let me = if cl.id == self.own_id { " (you)" } else { "" };
                out.push_str(&format!("{ind}    - {} (clid {}){me}{st}\n", cl.nickname, cl.id));
            }
        }
        out
    }
}

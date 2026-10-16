//! Audio engine: microphone -> (RNNoise, AGC) -> Opus -> active session, and
//! sessions -> Opus decode -> per-talker jitter buffer -> mixer -> speakers.
//!
//! cpal streams are not `Send`, so they live on a dedicated thread that rebuilds
//! them whenever the device selection changes.

use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Mutex};

use anyhow::{anyhow, Result};
use audiopus::coder::{Decoder, Encoder};
use audiopus::packet::Packet;
use audiopus::{Application, Bitrate, Channels, MutSignals, SampleRate};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream, StreamConfig};
use nnnoiseless::DenoiseState;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use ts3_client::session::SessionHandle;

const RATE: u32 = 48_000;
const FRAME: usize = 960; // 20 ms @ 48 kHz (Opus)
const RNN_FRAME: usize = DenoiseState::FRAME_SIZE; // 10 ms @ 48 kHz
const CODEC_OPUS_VOICE: u8 = 4;
const CODEC_OPUS_MUSIC: u8 = 5;
/// Talker key used for the local microphone test.
pub const LOOPBACK: (u32, u16) = (0, u16::MAX);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    /// Voice activation (level threshold or speech detection)
    Va,
    /// Push to talk (global key)
    Ptt,
    /// Always transmit
    Always,
}

fn yes() -> bool {
    true
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AudioConfig {
    pub mode: Mode,
    pub threshold_db: f32,
    /// Windows virtual key code for push to talk
    pub ptt_key: i32,
    pub mic_muted: bool,
    pub speaker_muted: bool,
    pub input_device: Option<String>,
    pub output_device: Option<String>,
    /// Output volume, 1.0 = 100 %
    pub volume: f32,
    /// Microphone gain, 1.0 = 100 %
    pub mic_gain: f32,
    /// RNNoise noise suppression
    #[serde(default = "yes")]
    pub noise_suppression: bool,
    /// Automatic gain control
    #[serde(default = "yes")]
    pub auto_gain: bool,
    /// Voice activation uses the neural speech detector instead of the level
    #[serde(default)]
    pub vad_ai: bool,
    /// Even out the loudness of other speakers
    #[serde(default)]
    pub playback_agc: bool,
    /// Low background noise so silence does not sound "dead"
    #[serde(default)]
    pub comfort_noise: bool,
    #[serde(default = "default_comfort")]
    pub comfort_noise_db: f32,
}

fn default_comfort() -> f32 {
    -60.0
}

impl Default for AudioConfig {
    fn default() -> Self {
        AudioConfig {
            mode: Mode::Va,
            threshold_db: -45.0,
            ptt_key: 0x56, // V
            mic_muted: false,
            speaker_muted: false,
            input_device: None,
            output_device: None,
            volume: 1.0,
            mic_gain: 1.0,
            noise_suppression: true,
            auto_gain: true,
            vad_ai: false,
            playback_agc: false,
            comfort_noise: false,
            comfort_noise_db: -60.0,
        }
    }
}

#[derive(Serialize)]
pub struct Devices {
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
}

pub fn list_devices() -> Devices {
    let host = cpal::default_host();
    let names = |it: Option<Vec<cpal::Device>>| it.unwrap_or_default().iter().filter_map(|d| d.name().ok()).collect();
    Devices {
        inputs: names(host.input_devices().ok().map(|i| i.collect())),
        outputs: names(host.output_devices().ok().map(|i| i.collect())),
    }
}

/// Shared state between UI, sessions and the realtime callbacks.
pub struct Shared {
    pub cfg: Mutex<AudioConfig>,
    /// Session that receives our microphone (the active server tab)
    pub session: Mutex<Option<SessionHandle>>,
    level_db: AtomicU32,
    speech_prob: AtomicU32,
    pub transmitting: AtomicBool,
    pub mic_test: AtomicBool,
    player: Mutex<Player>,
    pub error: Mutex<Option<String>>,
}

impl Shared {
    pub fn level_db(&self) -> f32 {
        f32::from_bits(self.level_db.load(Ordering::Relaxed))
    }
    pub fn speech_prob(&self) -> f32 {
        f32::from_bits(self.speech_prob.load(Ordering::Relaxed))
    }
}

#[derive(Clone)]
pub struct Audio {
    pub shared: Arc<Shared>,
    restart: mpsc::Sender<()>,
}

impl Audio {
    pub fn start(cfg: AudioConfig) -> Audio {
        let shared = Arc::new(Shared {
            cfg: Mutex::new(cfg),
            session: Mutex::new(None),
            level_db: AtomicU32::new((-100f32).to_bits()),
            speech_prob: AtomicU32::new(0f32.to_bits()),
            transmitting: AtomicBool::new(false),
            mic_test: AtomicBool::new(false),
            player: Mutex::new(Player::default()),
            error: Mutex::new(None),
        });
        let (tx, rx) = mpsc::channel::<()>();
        let sh = shared.clone();
        std::thread::Builder::new()
            .name("audio".into())
            .spawn(move || loop {
                let streams = match build_streams(&sh) {
                    Ok(s) => s,
                    Err(e) => {
                        warn!("audio: {e:#}");
                        *sh.error.lock().unwrap() = Some(format!("{e:#}"));
                        Vec::new()
                    }
                };
                if rx.recv().is_err() {
                    return;
                }
                drop(streams);
            })
            .expect("spawn audio thread");
        Audio { shared, restart: tx }
    }

    pub fn set_config(&self, cfg: AudioConfig) {
        let devices_changed = {
            let mut c = self.shared.cfg.lock().unwrap();
            let changed = c.input_device != cfg.input_device || c.output_device != cfg.output_device;
            *c = cfg;
            changed
        };
        if devices_changed {
            let _ = self.restart.send(());
        }
    }

    /// Set the session our microphone goes to (the active server).
    pub fn set_session(&self, h: Option<SessionHandle>) {
        *self.shared.session.lock().unwrap() = h;
    }

    /// Forget all talkers of a connection (it disconnected).
    pub fn clear_connection(&self, conn: u32) {
        self.shared.player.lock().unwrap().talkers.retain(|k, _| k.0 != conn);
    }

    /// Voice frame from a session.
    pub fn push_voice(&self, conn: u32, from: u16, codec: u8, data: &[u8]) {
        let agc = {
            let c = self.shared.cfg.lock().unwrap();
            if c.speaker_muted {
                return;
            }
            c.playback_agc
        };
        self.shared.player.lock().unwrap().push((conn, from), codec, data, agc);
    }
}

fn pick_device(devs: Result<impl Iterator<Item = cpal::Device>, cpal::DevicesError>, name: &Option<String>) -> Option<cpal::Device> {
    let name = name.as_ref()?;
    devs.ok()?.find(|d| d.name().map(|n| &n == name).unwrap_or(false))
}

fn build_streams(sh: &Arc<Shared>) -> Result<Vec<Stream>> {
    let host = cpal::default_host();
    let (in_name, out_name) = {
        let c = sh.cfg.lock().unwrap();
        (c.input_device.clone(), c.output_device.clone())
    };
    let mut streams = Vec::new();
    let mut errors = Vec::new();

    let input = pick_device(host.input_devices(), &in_name).or_else(|| host.default_input_device());
    match input.ok_or_else(|| anyhow!("kein Mikrofon gefunden")).and_then(|d| build_input(&d, sh.clone())) {
        Ok(s) => streams.push(s),
        Err(e) => errors.push(format!("Mikrofon: {e:#}")),
    }
    let output = pick_device(host.output_devices(), &out_name).or_else(|| host.default_output_device());
    match output.ok_or_else(|| anyhow!("kein Ausgabegerät gefunden")).and_then(|d| build_output(&d, sh.clone())) {
        Ok(s) => streams.push(s),
        Err(e) => errors.push(format!("Wiedergabe: {e:#}")),
    }
    *sh.error.lock().unwrap() = (!errors.is_empty()).then(|| errors.join("; "));
    if streams.is_empty() {
        return Err(anyhow!(errors.join("; ")));
    }
    Ok(streams)
}

// ---------------------------------------------------------------------------- capture

struct Capture {
    sh: Arc<Shared>,
    resampler: Resampler,
    raw: Vec<f32>,
    buf: Vec<f32>,
    denoise: Box<DenoiseState<'static>>,
    denoise_out: Vec<f32>,
    last_prob: f32,
    agc_gain: f32,
    encoder: Encoder,
    hang: u32,
    was_tx: bool,
    out: Vec<u8>,
}

impl Capture {
    fn process(&mut self, mono: &[f32]) {
        self.resampler.process(mono, &mut self.raw);
        let cfg = self.sh.cfg.lock().unwrap().clone();
        // 10 ms blocks through RNNoise (it works on 16 bit scaled floats)
        while self.raw.len() >= RNN_FRAME {
            let block: Vec<f32> = self.raw.drain(..RNN_FRAME).map(|s| s * cfg.mic_gain).collect();
            if cfg.noise_suppression || cfg.vad_ai {
                let input: Vec<f32> = block.iter().map(|s| s * 32767.0).collect();
                self.last_prob = self.denoise.process_frame(&mut self.denoise_out, &input);
                if cfg.noise_suppression {
                    self.buf.extend(self.denoise_out.iter().map(|s| s / 32767.0));
                } else {
                    self.buf.extend_from_slice(&block);
                }
            } else {
                self.buf.extend_from_slice(&block);
            }
        }
        self.sh.speech_prob.store(self.last_prob.to_bits(), Ordering::Relaxed);
        while self.buf.len() >= FRAME {
            let frame: Vec<f32> = self.buf.drain(..FRAME).collect();
            self.frame(frame, &cfg);
        }
    }

    fn frame(&mut self, mut frame: Vec<f32>, cfg: &AudioConfig) {
        let rms = (frame.iter().map(|s| s * s).sum::<f32>() / frame.len() as f32).sqrt();
        let db = 20.0 * (rms + 1e-9).log10();

        // Automatic gain control: steer speech towards -20 dBFS, ignore silence.
        if cfg.auto_gain {
            if db > -55.0 {
                let target = 10f32.powf(-20.0 / 20.0);
                let wanted = (target / (rms + 1e-6)).clamp(0.5, 8.0);
                self.agc_gain += (wanted - self.agc_gain) * if wanted < self.agc_gain { 0.3 } else { 0.03 };
            }
        } else {
            self.agc_gain = 1.0;
        }
        for s in frame.iter_mut() {
            *s = (*s * self.agc_gain).clamp(-1.0, 1.0);
        }
        // The meter shows the level before AGC so the threshold stays meaningful.
        self.sh.level_db.store(db.to_bits(), Ordering::Relaxed);

        let wants = match cfg.mode {
            Mode::Always => true,
            Mode::Ptt => key_down(cfg.ptt_key),
            Mode::Va => {
                let active = if cfg.vad_ai { self.last_prob > 0.6 } else { db > cfg.threshold_db };
                if active {
                    self.hang = 15; // keep transmitting 300 ms after speech ends
                } else {
                    self.hang = self.hang.saturating_sub(1);
                }
                self.hang > 0
            }
        };
        let mic_test = self.sh.mic_test.load(Ordering::Relaxed);
        if mic_test && wants && !cfg.mic_muted {
            self.sh.player.lock().unwrap().push_pcm(LOOPBACK, &frame);
        }
        let session = self.sh.session.lock().unwrap().clone();
        let tx = wants && !cfg.mic_muted && session.is_some() && !mic_test;
        self.sh.transmitting.store(wants && !cfg.mic_muted, Ordering::Relaxed);
        let Some(session) = session else {
            self.was_tx = false;
            return;
        };
        if tx {
            match self.encoder.encode_float(&frame, &mut self.out) {
                Ok(n) => session.voice(CODEC_OPUS_VOICE, self.out[..n].to_vec()),
                Err(e) => warn!("opus encode: {e}"),
            }
        } else if self.was_tx {
            session.voice(CODEC_OPUS_VOICE, Vec::new()); // end of transmission
        }
        self.was_tx = tx;
    }
}

#[cfg(windows)]
pub fn key_down(vk: i32) -> bool {
    // SAFETY: GetAsyncKeyState has no preconditions.
    unsafe { windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(vk) as u16 & 0x8000 != 0 }
}

#[cfg(not(windows))]
pub fn key_down(_vk: i32) -> bool {
    false
}

fn build_input(dev: &cpal::Device, sh: Arc<Shared>) -> Result<Stream> {
    let sup = dev.default_input_config()?;
    let fmt = sup.sample_format();
    let config: StreamConfig = sup.into();
    let ch = config.channels as usize;
    info!("Mikrofon: {} ({} Hz, {} Kanäle, {:?})", dev.name().unwrap_or_default(), config.sample_rate.0, ch, fmt);
    let mut encoder = Encoder::new(SampleRate::Hz48000, Channels::Mono, Application::Voip)?;
    encoder.set_bitrate(Bitrate::BitsPerSecond(48_000))?;
    let mut cap = Capture {
        sh,
        resampler: Resampler::new(config.sample_rate.0, RATE),
        raw: Vec::with_capacity(RNN_FRAME * 4),
        buf: Vec::with_capacity(FRAME * 4),
        denoise: DenoiseState::new(),
        denoise_out: vec![0.0; RNN_FRAME],
        last_prob: 0.0,
        agc_gain: 1.0,
        encoder,
        hang: 0,
        was_tx: false,
        out: vec![0u8; 1500],
    };
    let err = |e| warn!("input stream: {e}");
    let stream = match fmt {
        SampleFormat::F32 => dev.build_input_stream(
            &config,
            move |d: &[f32], _: &_| {
                let mono: Vec<f32> = d.chunks(ch).map(|f| f.iter().sum::<f32>() / ch as f32).collect();
                cap.process(&mono);
            },
            err,
            None,
        )?,
        SampleFormat::I16 => dev.build_input_stream(
            &config,
            move |d: &[i16], _: &_| {
                let mono: Vec<f32> = d.chunks(ch).map(|f| f.iter().map(|&s| s as f32 / 32768.0).sum::<f32>() / ch as f32).collect();
                cap.process(&mono);
            },
            err,
            None,
        )?,
        f => return Err(anyhow!("Sampleformat {f:?} wird nicht unterstützt")),
    };
    stream.play()?;
    Ok(stream)
}

// ---------------------------------------------------------------------------- playback

struct Talker {
    mono: Option<Decoder>,
    stereo: Option<Decoder>,
    buf: VecDeque<f32>,
    resampler: Resampler,
    playing: bool,
    agc_gain: f32,
}

#[derive(Default)]
struct Player {
    talkers: HashMap<(u32, u16), Talker>,
    out_rate: u32,
    noise_state: u32,
}

impl Player {
    fn talker(&mut self, key: (u32, u16), decoders: bool) -> Option<&mut Talker> {
        if self.out_rate == 0 {
            return None;
        }
        let out_rate = self.out_rate;
        Some(self.talkers.entry(key).or_insert_with(|| Talker {
            mono: decoders.then(|| Decoder::new(SampleRate::Hz48000, Channels::Mono).ok()).flatten(),
            stereo: decoders.then(|| Decoder::new(SampleRate::Hz48000, Channels::Stereo).ok()).flatten(),
            buf: VecDeque::new(),
            resampler: Resampler::new(RATE, out_rate),
            playing: false,
            agc_gain: 1.0,
        }))
    }

    fn push(&mut self, key: (u32, u16), codec: u8, data: &[u8], agc: bool) {
        if data.is_empty() || !(codec == CODEC_OPUS_VOICE || codec == CODEC_OPUS_MUSIC) {
            return;
        }
        let rate = self.out_rate;
        let Some(t) = self.talker(key, true) else { return };
        let Ok(packet) = Packet::try_from(data) else { return };
        let mut pcm = vec![0i16; 5760 * 2];
        let mut samples: Vec<f32> = if codec == CODEC_OPUS_MUSIC {
            let (Some(dec), Ok(sig)) = (t.stereo.as_mut(), MutSignals::try_from(&mut pcm[..])) else { return };
            let Ok(n) = dec.decode(Some(packet), sig, false) else { return };
            pcm[..n * 2].chunks(2).map(|c| (c[0] as f32 + c[1] as f32) / 65536.0).collect()
        } else {
            let (Some(dec), Ok(sig)) = (t.mono.as_mut(), MutSignals::try_from(&mut pcm[..])) else { return };
            let Ok(n) = dec.decode(Some(packet), sig, false) else { return };
            pcm[..n].iter().map(|&s| s as f32 / 32768.0).collect()
        };
        if agc {
            // Steer every talker towards -20 dBFS (only while they actually speak)
            let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len().max(1) as f32).sqrt();
            if rms > 0.003 {
                let wanted = (0.1 / rms).clamp(0.3, 6.0);
                t.agc_gain += (wanted - t.agc_gain) * if wanted < t.agc_gain { 0.4 } else { 0.05 };
            }
            for s in samples.iter_mut() {
                *s = (*s * t.agc_gain).clamp(-1.0, 1.0);
            }
        }
        Self::append(t, &samples, rate);
    }

    /// Raw 48 kHz samples (microphone test).
    fn push_pcm(&mut self, key: (u32, u16), samples: &[f32]) {
        let rate = self.out_rate;
        if let Some(t) = self.talker(key, false) {
            Self::append(t, samples, rate);
        }
    }

    fn append(t: &mut Talker, samples: &[f32], out_rate: u32) {
        let mut out = Vec::with_capacity(samples.len() * 2);
        t.resampler.process(samples, &mut out);
        t.buf.extend(out);
        // Bound latency to 400 ms
        let max = (out_rate as usize * 2) / 5;
        while t.buf.len() > max {
            t.buf.pop_front();
        }
    }

    fn next_sample(&mut self) -> f32 {
        let start = (self.out_rate as usize * 6) / 100; // 60 ms jitter buffer
        let mut s = 0.0;
        for t in self.talkers.values_mut() {
            if !t.playing {
                if t.buf.len() >= start {
                    t.playing = true;
                } else {
                    continue;
                }
            }
            match t.buf.pop_front() {
                Some(v) => s += v,
                None => t.playing = false,
            }
        }
        s
    }
}

fn build_output(dev: &cpal::Device, sh: Arc<Shared>) -> Result<Stream> {
    let sup = dev.default_output_config()?;
    let fmt = sup.sample_format();
    let config: StreamConfig = sup.into();
    let ch = config.channels as usize;
    info!("Wiedergabe: {} ({} Hz, {} Kanäle, {:?})", dev.name().unwrap_or_default(), config.sample_rate.0, ch, fmt);
    {
        let mut p = sh.player.lock().unwrap();
        p.out_rate = config.sample_rate.0;
        p.noise_state = 0x9e37_79b9;
        p.talkers.clear();
    }
    let err = |e| warn!("output stream: {e}");
    let fill = move |frames: usize, write: &mut dyn FnMut(usize, f32)| {
        let (vol, test, noise) = {
            let c = sh.cfg.lock().unwrap();
            let noise = if c.comfort_noise && !c.speaker_muted { 10f32.powf(c.comfort_noise_db / 20.0) } else { 0.0 };
            (if c.speaker_muted { 0.0 } else { c.volume }, sh.mic_test.load(Ordering::Relaxed), noise)
        };
        // The mic test must stay audible even with muted speakers.
        let vol = if test { vol.max(0.8) } else { vol };
        let mut p = sh.player.lock().unwrap();
        for i in 0..frames {
            let mut v = p.next_sample() * vol;
            if noise > 0.0 {
                // xorshift noise
                p.noise_state ^= p.noise_state << 13;
                p.noise_state ^= p.noise_state >> 17;
                p.noise_state ^= p.noise_state << 5;
                v += ((p.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0) * noise;
            }
            let v = v.clamp(-1.0, 1.0);
            write(i, v);
        }
    };
    let stream = match fmt {
        SampleFormat::F32 => dev.build_output_stream(
            &config,
            move |d: &mut [f32], _: &_| {
                let frames = d.len() / ch;
                fill(frames, &mut |i, v| d[i * ch..(i + 1) * ch].fill(v));
            },
            err,
            None,
        )?,
        SampleFormat::I16 => dev.build_output_stream(
            &config,
            move |d: &mut [i16], _: &_| {
                let frames = d.len() / ch;
                fill(frames, &mut |i, v| d[i * ch..(i + 1) * ch].fill((v * 32767.0) as i16));
            },
            err,
            None,
        )?,
        f => return Err(anyhow!("Sampleformat {f:?} wird nicht unterstützt")),
    };
    stream.play()?;
    Ok(stream)
}

// ---------------------------------------------------------------------------- resampling

/// Linear interpolation resampler (good enough for speech).
struct Resampler {
    step: f64,
    t: f64,
    prev: f32,
}

impl Resampler {
    fn new(from: u32, to: u32) -> Self {
        Resampler { step: from as f64 / to as f64, t: 0.0, prev: 0.0 }
    }

    fn process(&mut self, input: &[f32], out: &mut Vec<f32>) {
        if (self.step - 1.0).abs() < 1e-9 {
            out.extend_from_slice(input);
            return;
        }
        for &x in input {
            while self.t < 1.0 {
                out.push(self.prev + (x - self.prev) * self.t as f32);
                self.t += self.step;
            }
            self.t -= 1.0;
            self.prev = x;
        }
    }
}

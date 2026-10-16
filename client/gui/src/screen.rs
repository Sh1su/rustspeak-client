//! Native screen sharing: list monitors and windows (with thumbnails), capture the
//! chosen one with Windows Graphics Capture and encode it to H.264 (OpenH264, Annex B).
//!
//! Replaces the WebView2 `getDisplayMedia` picker so RustSpeak can show its own
//! source selection. Encoded chunks go to the UI over a Tauri channel; the UI sends
//! them through the existing video relay WebSocket.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

use base64::Engine;
use serde::Serialize;
use tauri::ipc::{Channel, InvokeResponseBody};

/// A capturable monitor or window, shown in the share picker.
#[derive(Serialize)]
pub struct Source {
    /// `m:<hmonitor>` or `w:<hwnd>`
    id: String,
    kind: &'static str,
    name: String,
    app: String,
    width: u32,
    height: u32,
    primary: bool,
    /// JPEG data URL (may be empty when the source could not be captured)
    thumb: String,
}

fn thumb_url(img: &image::RgbaImage) -> String {
    let small = image::imageops::thumbnail(img, 320, (320 * img.height() / img.width().max(1)).clamp(1, 240));
    let rgb = image::DynamicImage::ImageRgba8(small).to_rgb8();
    let mut out = Vec::new();
    let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 70);
    if rgb.write_with_encoder(enc).is_err() {
        return String::new();
    }
    format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(out))
}

/// Monitors first, then visible top-level windows of other applications.
pub fn sources() -> Vec<Source> {
    let mut out = Vec::new();
    if let Ok(mons) = xcap::Monitor::all() {
        for (i, m) in mons.iter().enumerate() {
            let Ok(id) = m.id() else { continue };
            let thumb = m.capture_image().map(|img| thumb_url(&img)).unwrap_or_default();
            out.push(Source {
                id: format!("m:{id}"),
                kind: "monitor",
                name: m.friendly_name().ok().filter(|n| !n.is_empty()).unwrap_or_else(|| format!("Bildschirm {}", i + 1)),
                app: String::new(),
                width: m.width().unwrap_or(0),
                height: m.height().unwrap_or(0),
                primary: m.is_primary().unwrap_or(false),
                thumb,
            });
        }
    }
    let own = std::process::id();
    if let Ok(wins) = xcap::Window::all() {
        for w in wins {
            let title = w.title().unwrap_or_default();
            let (width, height) = (w.width().unwrap_or(0), w.height().unwrap_or(0));
            if title.trim().is_empty() || width < 120 || height < 80 || w.is_minimized().unwrap_or(true) || w.pid().ok() == Some(own) {
                continue;
            }
            let app = w.app_name().unwrap_or_default();
            if title == "Program Manager" {
                continue;
            }
            let Ok(id) = w.id() else { continue };
            let thumb = w.capture_image().map(|img| thumb_url(&img)).unwrap_or_default();
            out.push(Source { id: format!("w:{id}"), kind: "window", name: title, app, width, height, primary: false, thumb });
        }
    }
    out
}

// ---------------------------------------------------------------- capture + encode

/// Latest captured frame, already scaled and converted to I420.
struct Shared {
    frame: Mutex<Option<(Vec<u8>, usize, usize)>>,
    fresh: Condvar,
    stop: AtomicBool,
    force_key: AtomicBool,
}

struct Flags {
    shared: Arc<Shared>,
    max_w: u32,
    max_h: u32,
    interval: Duration,
    out: Channel<InvokeResponseBody>,
}

struct Handler {
    shared: Arc<Shared>,
    max_w: u32,
    max_h: u32,
    interval: Duration,
    last: Option<Instant>,
    out: Channel<InvokeResponseBody>,
    tmp: Vec<u8>,
}

/// Message types sent to the UI (first byte of each channel message)
const MSG_CHUNK: u8 = 0;
const MSG_ENDED: u8 = 2;
const MSG_ERROR: u8 = 3;

fn send_msg(out: &Channel<InvokeResponseBody>, kind: u8, key: bool, w: usize, h: usize, ts: u64, data: &[u8]) {
    let mut buf = Vec::with_capacity(14 + data.len());
    buf.push(kind);
    buf.push(key as u8);
    buf.extend_from_slice(&(w as u16).to_le_bytes());
    buf.extend_from_slice(&(h as u16).to_le_bytes());
    buf.extend_from_slice(&ts.to_le_bytes());
    buf.extend_from_slice(data);
    let _ = out.send(InvokeResponseBody::Raw(buf));
}

impl windows_capture::capture::GraphicsCaptureApiHandler for Handler {
    type Flags = Flags;
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn new(ctx: windows_capture::capture::Context<Self::Flags>) -> Result<Self, Self::Error> {
        let f = ctx.flags;
        Ok(Self { shared: f.shared, max_w: f.max_w, max_h: f.max_h, interval: f.interval, last: None, out: f.out, tmp: Vec::new() })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut windows_capture::frame::Frame,
        control: windows_capture::graphics_capture_api::InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        if self.shared.stop.load(Ordering::Relaxed) {
            control.stop();
            return Ok(());
        }
        let now = Instant::now();
        if self.last.is_some_and(|l| now - l < self.interval.mul_f32(0.85)) {
            return Ok(());
        }
        self.last = Some(now);
        let buf = frame.buffer()?;
        let (sw, sh) = (buf.width() as usize, buf.height() as usize);
        if sw < 2 || sh < 2 {
            return Ok(());
        }
        let data = buf.as_nopadding_buffer(&mut self.tmp);
        let scale = (self.max_w as f64 / sw as f64).min(self.max_h as f64 / sh as f64).min(1.0);
        let dw = (((sw as f64 * scale) / 2.0).round() as usize * 2).max(2);
        let dh = (((sh as f64 * scale) / 2.0).round() as usize * 2).max(2);
        let mut yuv = self.shared.frame.lock().unwrap().take().map(|f| f.0).unwrap_or_default();
        bgra_to_i420(data, sw, sh, dw, dh, &mut yuv);
        *self.shared.frame.lock().unwrap() = Some((yuv, dw, dh));
        self.shared.fresh.notify_one();
        Ok(())
    }

    fn on_closed(&mut self) -> Result<(), Self::Error> {
        self.shared.stop.store(true, Ordering::Relaxed);
        self.shared.fresh.notify_one();
        send_msg(&self.out, MSG_ENDED, false, 0, 0, 0, &[]);
        Ok(())
    }
}

/// BGRA (tightly packed) to I420 with box-filtered scaling to `dw`×`dh` (BT.601, limited range).
fn bgra_to_i420(src: &[u8], sw: usize, sh: usize, dw: usize, dh: usize, out: &mut Vec<u8>) {
    out.resize(dw * dh * 3 / 2, 0);
    let (y_plane, uv) = out.split_at_mut(dw * dh);
    let (u_plane, v_plane) = uv.split_at_mut(dw * dh / 4);
    // Source span per output pixel (≥ 1); averaging a small box keeps text readable when downscaling
    let fx = sw as f64 / dw as f64;
    let fy = sh as f64 / dh as f64;
    let bx = (fx.floor() as usize).clamp(1, 2);
    let by = (fy.floor() as usize).clamp(1, 2);
    let xs: Vec<usize> = (0..dw).map(|x| ((x as f64 * fx) as usize).min(sw - bx)).collect();
    let mut rgb_row = vec![[0i32; 3]; dw * 2];
    for y2 in 0..dh / 2 {
        for dy in 0..2 {
            let y = y2 * 2 + dy;
            let sy = ((y as f64 * fy) as usize).min(sh - by);
            for (x, &sx) in xs.iter().enumerate() {
                let (mut r, mut g, mut b) = (0i32, 0i32, 0i32);
                for oy in 0..by {
                    let row = (sy + oy) * sw * 4;
                    for ox in 0..bx {
                        let i = row + (sx + ox) * 4;
                        b += src[i] as i32;
                        g += src[i + 1] as i32;
                        r += src[i + 2] as i32;
                    }
                }
                let n = (bx * by) as i32;
                let (r, g, b) = (r / n, g / n, b / n);
                y_plane[y * dw + x] = (((66 * r + 129 * g + 25 * b + 128) >> 8) + 16).clamp(0, 255) as u8;
                rgb_row[dy * dw + x] = [r, g, b];
            }
        }
        for x2 in 0..dw / 2 {
            let mut s = [0i32; 3];
            for i in [x2 * 2, x2 * 2 + 1, dw + x2 * 2, dw + x2 * 2 + 1] {
                for c in 0..3 {
                    s[c] += rgb_row[i][c];
                }
            }
            let (r, g, b) = (s[0] / 4, s[1] / 4, s[2] / 4);
            u_plane[y2 * (dw / 2) + x2] = (((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128).clamp(0, 255) as u8;
            v_plane[y2 * (dw / 2) + x2] = (((112 * r - 94 * g - 18 * b + 128) >> 8) + 128).clamp(0, 255) as u8;
        }
    }
}

/// Encoder thread: encodes the newest frame at most `fps` times per second; repeats the
/// last frame as a keyframe when a viewer asks for one while the picture is static.
fn encode_loop(shared: Arc<Shared>, out: Channel<InvokeResponseBody>, fps: u32, kbps: u32) {
    use openh264::encoder::{BitRate, Encoder, EncoderConfig, FrameRate, RateControlMode, UsageType};
    use openh264::formats::YUVBuffer;
    let start = Instant::now();
    let mut enc: Option<(Encoder, usize, usize)> = None;
    let mut last: Option<(Vec<u8>, usize, usize)> = None;
    let mut last_key = Instant::now();
    let mut bits = Vec::new();
    while !shared.stop.load(Ordering::Relaxed) {
        let fresh = {
            let g = shared.frame.lock().unwrap();
            let (mut g, _) = shared.fresh.wait_timeout_while(g, Duration::from_millis(250), |f| f.is_none() && !shared.stop.load(Ordering::Relaxed) && !shared.force_key.load(Ordering::Relaxed)).unwrap();
            g.take()
        };
        if shared.stop.load(Ordering::Relaxed) {
            break;
        }
        let want_key = shared.force_key.swap(false, Ordering::Relaxed) || last_key.elapsed() > Duration::from_secs(10);
        if let Some(f) = fresh {
            last = Some(f);
        } else if !want_key {
            continue;
        }
        let Some((yuv, w, h)) = last.as_ref() else { continue };
        let (w, h) = (*w, *h);
        if enc.as_ref().is_none_or(|e| e.1 != w || e.2 != h) {
            // Bitrate scales with the area relative to 1080p
            let area = (w * h) as f64 / (1920.0 * 1080.0);
            let bps = ((kbps as f64 * 1000.0) * area.clamp(0.25, 2.0)) as u32;
            let cfg = EncoderConfig::new()
                .bitrate(BitRate::from_bps(bps))
                .max_frame_rate(FrameRate::from_hz(fps as f32))
                .usage_type(UsageType::ScreenContentRealTime)
                .rate_control_mode(RateControlMode::Bitrate)
                .skip_frames(true)
                .adaptive_quantization(false)
                .background_detection(false)
                .num_threads(4);
            match Encoder::with_api_config(openh264::OpenH264API::from_source(), cfg) {
                Ok(e) => enc = Some((e, w, h)),
                Err(e) => {
                    send_msg(&out, MSG_ERROR, false, 0, 0, 0, format!("H.264-Encoder: {e}").as_bytes());
                    break;
                }
            }
        }
        let e = &mut enc.as_mut().unwrap().0;
        if want_key || last_key.elapsed() > Duration::from_secs(10) {
            e.force_intra_frame();
        }
        let src = YUVBuffer::from_vec(yuv.clone(), w, h);
        let Ok(bs) = e.encode(&src) else { continue };
        let key = matches!(bs.frame_type(), openh264::encoder::FrameType::IDR | openh264::encoder::FrameType::I);
        bits.clear();
        bs.write_vec(&mut bits);
        if bits.is_empty() {
            continue;
        }
        if key {
            last_key = Instant::now();
        }
        send_msg(&out, MSG_CHUNK, key, w, h, start.elapsed().as_micros() as u64, &bits);
    }
}

type Control = windows_capture::capture::CaptureControl<Handler, Box<dyn std::error::Error + Send + Sync>>;

struct Running {
    shared: Arc<Shared>,
    control: Option<Control>,
}

#[derive(Default)]
pub struct Screens {
    next: AtomicU32,
    running: Mutex<HashMap<u32, Running>>,
}

impl Screens {
    pub fn start(&self, source: &str, max_w: u32, max_h: u32, fps: u32, kbps: u32, out: Channel<InvokeResponseBody>) -> Result<u32, String> {
        use windows_capture::capture::GraphicsCaptureApiHandler;
        use windows_capture::settings::*;
        let (kind, raw) = source.split_once(':').ok_or("Ungültige Quelle")?;
        let raw: u32 = raw.parse().map_err(|_| "Ungültige Quelle")?;
        // HWND/HMONITOR values are 32-bit and sign-extended
        let ptr = raw as i32 as isize as *mut std::ffi::c_void;
        let fps = fps.clamp(1, 60);
        let shared = Arc::new(Shared { frame: Mutex::new(None), fresh: Condvar::new(), stop: AtomicBool::new(false), force_key: AtomicBool::new(true) });
        let flags = || Flags { shared: shared.clone(), max_w, max_h, interval: Duration::from_secs_f64(1.0 / fps as f64), out: out.clone() };
        let interval = MinimumUpdateIntervalSettings::Custom(Duration::from_millis((1000 / fps as u64).max(1)));
        let start = |border: DrawBorderSettings| -> Result<Control, String> {
            match kind {
                "m" => {
                    let item = windows_capture::monitor::Monitor::from_raw_hmonitor(ptr);
                    let s = Settings::new(item, CursorCaptureSettings::WithCursor, border, SecondaryWindowSettings::Default, interval, DirtyRegionSettings::Default, ColorFormat::Bgra8, flags());
                    Handler::start_free_threaded(s).map_err(|e| e.to_string())
                }
                "w" => {
                    let item = windows_capture::window::Window::from_raw_hwnd(ptr);
                    if !item.is_valid() {
                        return Err("Das Fenster existiert nicht mehr.".into());
                    }
                    let s = Settings::new(item, CursorCaptureSettings::WithCursor, border, SecondaryWindowSettings::Include, interval, DirtyRegionSettings::Default, ColorFormat::Bgra8, flags());
                    Handler::start_free_threaded(s).map_err(|e| e.to_string())
                }
                _ => Err("Ungültige Quelle".into()),
            }
        };
        // Hiding the yellow capture border needs Windows 11; fall back to the default
        let control = start(DrawBorderSettings::WithoutBorder).or_else(|_| start(DrawBorderSettings::Default))?;
        let id = self.next.fetch_add(1, Ordering::Relaxed) + 1;
        {
            let shared = shared.clone();
            std::thread::Builder::new()
                .name("screen-encode".into())
                .spawn(move || encode_loop(shared, out, fps, kbps))
                .map_err(|e| e.to_string())?;
        }
        self.running.lock().unwrap().insert(id, Running { shared, control: Some(control) });
        Ok(id)
    }

    pub fn keyframe(&self, id: u32) {
        if let Some(r) = self.running.lock().unwrap().get(&id) {
            r.shared.force_key.store(true, Ordering::Relaxed);
            r.shared.fresh.notify_one();
        }
    }

    pub fn stop(&self, id: u32) {
        let Some(mut r) = self.running.lock().unwrap().remove(&id) else { return };
        r.shared.stop.store(true, Ordering::Relaxed);
        r.shared.fresh.notify_one();
        if let Some(c) = r.control.take() {
            // Stopping joins the capture thread; keep the UI thread free
            std::thread::spawn(move || {
                let _ = c.stop();
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_sources() {
        let s = sources();
        for x in &s {
            println!("{} {} {}x{} thumb={}B {}", x.id, x.kind, x.width, x.height, x.thumb.len(), x.name);
        }
        assert!(s.iter().any(|x| x.kind == "monitor"));
    }

    /// Encode a test picture and decode it again: colours must survive (no green cast).
    #[test]
    fn encode_roundtrip_keeps_colours() {
        use openh264::decoder::Decoder;
        use openh264::encoder::{Encoder, EncoderConfig, UsageType};
        use openh264::formats::{YUVBuffer, YUVSource};
        let (sw, sh, dw, dh) = (640usize, 360usize, 320usize, 180usize);
        // Left half grey (40,40,40), right half orange (240,120,30), BGRA
        let mut src = vec![0u8; sw * sh * 4];
        for y in 0..sh {
            for x in 0..sw {
                let (r, g, b) = if x < sw / 2 { (40, 40, 40) } else { (240, 120, 30) };
                let i = (y * sw + x) * 4;
                src[i..i + 4].copy_from_slice(&[b, g, r, 255]);
            }
        }
        let mut yuv = Vec::new();
        bgra_to_i420(&src, sw, sh, dw, dh, &mut yuv);
        let mut enc = Encoder::with_api_config(openh264::OpenH264API::from_source(), EncoderConfig::new().usage_type(UsageType::ScreenContentRealTime)).unwrap();
        let mut bits = Vec::new();
        enc.encode(&YUVBuffer::from_vec(yuv, dw, dh)).unwrap().write_vec(&mut bits);
        assert_eq!(&bits[..4], &[0, 0, 0, 1], "Annex B start code");
        let mut dec = Decoder::new().unwrap();
        let pic = dec.decode(&bits).unwrap().expect("picture");
        let mut rgb = vec![0u8; dw * dh * 3];
        pic.write_rgb8(&mut rgb);
        let px = |x: usize, y: usize| { let i = (y * dw + x) * 3; (rgb[i], rgb[i + 1], rgb[i + 2]) };
        let close = |a: (u8, u8, u8), b: (u8, u8, u8)| (a.0 as i32 - b.0 as i32).abs() < 14 && (a.1 as i32 - b.1 as i32).abs() < 14 && (a.2 as i32 - b.2 as i32).abs() < 14;
        println!("grey {:?} orange {:?} dims {:?}", px(40, 90), px(280, 90), pic.dimensions());
        assert!(close(px(40, 90), (40, 40, 40)));
        assert!(close(px(280, 90), (240, 120, 30)));
    }
}

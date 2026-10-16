# RustSpeak

Ein Windows-Client für das TeamSpeak-3-Protokoll, geschrieben in Rust (Tauri v2, WebView2). Passender Server: [RustSpeak Server](https://github.com/Sh1su/rustspeak-server).

## Download

Den Windows-Installer gibt es unter [Releases](https://github.com/Sh1su/rustspeak-client/releases). Voraussetzung ist Windows 10 oder 11 mit WebView2-Laufzeit (bei Windows 11 vorinstalliert).

| Ordner | Inhalt |
|---|---|
| `client/gui/` | **RustSpeak**: Windows-GUI-Client mit Sprachchat |
| `client/` | `ts3-client`: Kommandozeilen-Client und Client-Bibliothek (Session-Engine) |
| `tsproto/` | Protokoll-Bibliothek (Pakete, Krypto, Handshake, Lizenzkette, QuickLZ, zuverlässiger Command-Transport) |

## Bauen

```bash
cargo run --release -p rustspeak
```

Installer bauen (NSIS):

```bash
cargo install tauri-cli --version "^2" --locked
```

```bash
cd client/gui && cargo tauri build
```

## Funktionen

```bash
cargo run --release -p rustspeak
```

- Mehrere Serververbindungen gleichzeitig in Tabs. Das Mikrofon geht an den aktiven Tab, Ton kommt von allen.
- Kanalbaum mit TeamSpeak-artigen Icons:
  - Kanal offen, voll, mit Passwort oder ohne Beitrittsrecht; Standard- und moderierter Kanal
  - Client sprechend, stumm, abwesend oder ohne Rederecht
  - Gruppen-Badges SA, CA, OP
- Bedienung im Baum: Doppelklick betritt einen Kanal. Drag & Drop verschiebt dich oder andere Clients. Rechtsklick öffnet Menüs.
- Infobereich für Server, Kanal und Client (Gruppen, Version, Verbindungszeit, Beschreibung).
- Rechteverwaltung:
  - Server- und Kanalgruppen anlegen, kopieren, umbenennen und löschen
  - Rechte-Editor mit Suche
  - Mitglieder per Rechtsklick → „Servergruppen“ oder „Kanalgruppe“
  - Berechtigungsschlüssel erstellen, anzeigen und einlösen
  - Bannen und Bannliste
- Dialoge zum Bearbeiten von Kanälen (Typ, Passwort, Limit, Qualität, Sprech- und Beitrittskraft, Beschreibung) und des Servers.
- Favoriten.
- Chat unten über die volle Breite in Tabs pro Server (Server, Channel, privat). Zeitstempel HH:MM:SS; Infos grün, Warnungen gelb, Fehler rot.
- Sprache:
  - Opus mit 48 kHz
  - Rauschunterdrückung (RNNoise) und automatische Lautstärkeanpassung
  - Senden per Sprachaktivierung (Pegelschwelle oder KI-Spracherkennung), Push-to-Talk mit globaler Taste (auch Maustaste 4/5) oder dauerhaft
  - Mikrofontest, Geräteauswahl
- Benachrichtigungen:
  - Soundpack (Standard): MP3-Dateien aus `client/gui/ui/sounds/` für Verbinden, Verbindung verloren, Channel gewechselt/erstellt/gelöscht/bearbeitet/verschoben, Server bearbeitet, Gruppen, Rederecht, Mikrofon/Lautsprecher, Anstupsen, private Nachricht, fehlende Rechte und Fehler. Ereignisse ohne eigene Datei fallen auf Sprachansage zurück.
  - Clients lokal blockieren (Rechtsklick → Blockieren): Sprache stumm, private Nachrichten ausgeblendet, eigene Sounds, wenn ein blockierter Benutzer deinen Channel betritt, verlässt, verschoben, geworfen oder gebannt wird.
  - Sprachansagen über Windows-Stimmen wie beim TS-Soundpack („Verbunden“, „Kanal gewechselt“, „Benutzer hat deinen Kanal betreten“, „Du wurdest angestupst“, …)
  - alternativ Töne
- Tastenkürzel: Strg+M (Mikrofon), Strg+D (Lautsprecher).
- Sprachen: Deutsch, English, Español, Русский, Dansk, Svenska, Português, 中文 und 日本語 (Einstellungen → Anwendung → Anzeigesprache). Auch die Sprachansagen kommen in der gewählten Sprache, sofern Windows eine passende Stimme hat.
- Optionsfenster im TeamSpeak-Stil mit Schaltern:
  - **Anwendung:** Auto-Reconnect, Schnellzugriff per mittlerer Maustaste, Immer im Vordergrund, Autostart mit Windows, Hinweiston bei stummem Mikrofon, Expertenrechte
  - **Wiedergabe:** Lautstärken in dB, Mikro-Klicks, Comfort Noise, Angleichen der Sprecher-Lautstärke
  - **Aufnahme**, **Design** (Akzentfarbe, Schriftgröße, kompakter Baum)
  - **Hotkeys:** globale Tasten für Mikrofon, Lautsprecher und Abwesend
  - **Chat**, **Meldungen**, **Sicherheit** (Identität, Sicherheitslevel erhöhen)
- Rechtefenster im TeamSpeak-Stil:
  - standardmäßig die einfache Ansicht mit Rechte-Bündeln wie „Den Server administrieren“ oder „Clients administrieren“
  - Gruppen-Icon, „Name im Baum anzeigen“, Mitgliederliste, Verwerfen/Anwenden
  - umschaltbar auf die Expertenansicht mit allen Einzelrechten
- Bedienung:
  - Menüleiste mit Verbindungen, Favoriten, Rechte und Extras
  - eigene Leiste für Mikrofon, Lautsprecher und Abwesend
  - eigene Schieberegler, Dropdowns und Checkboxen im App-Design
- Icons:
  - für Gruppen über das TeamSpeak-Recht `i_icon_id` (Rechteverwaltung → Bild-Knopf) und für Kanäle (Rechtsklick → Kanal-Icon), jeweils rechts im Baum angezeigt
  - integrierte Icons oder eigene PNG-Uploads; die ID ist wie bei TeamSpeak die CRC32 des Bildes
- Trennerkanäle wie bei TeamSpeak:
  - `[spacer]Text`, `[cspacer]Text`, `[rspacer]Text`, jeweils ohne Sprech-Icon
  - `[*spacer]=` wiederholt das Zeichen über die ganze Breite
- Channel-Ansicht mit Video: Ein Klick auf den eigenen Channel baut den rechten Bereich zu einer Bühne um.
  - Bildschirm teilen und Webcam (auch beides gleichzeitig), Qualität von 480p bis 1440p60
  - eigene Auswahl für Bildschirm teilen mit Vorschaubildern aller Monitore und Fenster; aufgenommen wird nativ (Windows Graphics Capture) und mit OpenH264 kodiert. Beim Beenden fragt RustSpeak nach.
  - Die eigene Bildschirmübertragung zeigt keine Live-Vorschau, sonst filmt sie sich selbst (Spiegeleffekt).
  - alle Clients im Channel als Kacheln mit Sprech-Anzeige; Übertragungen werden automatisch angesehen, lassen sich hervorheben, im Vollbild zeigen (Doppelklick) oder ausblenden
  - im Baum zeigt ein rotes Symbol, wer gerade überträgt
  - Kodierung mit WebCodecs (H.264, bevorzugt per Hardware; sonst VP8), Übertragung über das Video-Relay des Servers
  - Rechte: `b_client_video_stream` (übertragen) und `b_client_video_watch` (ansehen), im einfachen Rechtefenster als Bündel „Bildschirm und Webcam übertragen“
  - Wer den Channel wechselt, beendet seine Übertragung.
- Server-Banner rechts oben, wie bei TeamSpeak über einen externen Link (`http://` oder `https://`) bereitgestellt: Bild-URL mit Vorschau, Klick-Link, Anzeigemodus, Neuladeintervall. Der Server lehnt andere Adressen ab und verwirft früher hochgeladene Bilder.
- Mehrere Servergruppen auf einmal vergeben, auch für mehrere Clients (Strg+Klick, dann Rechtsklick → „Servergruppen zuweisen …“).
- Verbindungsinfo (Rechtsklick auf einen Client), live aktualisiert:
  - Clientname, Verbindungsdauer, untätig seit, nicht geredet seit, Ping
  - Clientadresse (nur mit `b_client_remoteaddress_view`)
  - Paketverlust, übertragene Pakete und Bytes, Bandbreite letzte Sekunde und letzte Minute sowie Dateitransfer-Bandbreite, jeweils nach Sprache, Keepalive und Steuerung getrennt
- Identität und Audio-Einstellungen liegen in `%APPDATA%\dev.rustspeak.client\`.
- Build-Voraussetzung: Visual Studio Build Tools (für libopus). `cmake` wird über `.cargo/config.toml` gefunden.
- Einen Installer baut die Tauri-CLI: erst `cargo install tauri-cli`, dann `cargo tauri build` in `client/gui`.

## Kommandozeilen-Client

```bash
target/release/ts3-client 127.0.0.1 -n MeinName
```

Im Client listet `/help` alle Kommandos, z. B. `/list`, `/join`, `/pm`, `/poke`, `/mkchan`, `/voicetest` und `/quit`. Mit `--exec "/list;hallo;/quit"` lässt er sich skripten.

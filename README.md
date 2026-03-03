# Spicy Lyric Translator

Real-time lyric translation extension for **[Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics)** on Spicetify.

![Spicetify](https://img.shields.io/badge/Spicetify-Extension-1DB954?style=flat-square&logo=spotify&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Online-success?style=flat-square)

---
![Preview](https://raw.githubusercontent.com/7xeh/SpicyLyricTranslate/main/preview.png)

---

## Features

- **Two display modes**  
	- **Replace**: swaps original lines with translated lines.  
	- **Below each line**: keeps original lyrics and adds translations underneath.
- **Real-time translation pipeline**  
	Uses Google Translate, LibreTranslate, or a custom LibreTranslate-compatible endpoint.
- **Smart language detection**  
	Detects source language and skips unnecessary translation when lyrics are already in the target language.
- **Track-aware caching**  
	Stores per-track translations for faster reloads and better offline resilience.
- **Native Spotify settings integration**  
	Injects settings directly into Spotify preferences (plus a quick modal via right-click on the translate button).
- **Keyboard shortcut**  
	Press **Alt+T** to toggle translation on/off.
- **Update checks**  
	Built-in update checker with release metadata and one-click update flow.

---

## Requirements

- Spicetify `>= 2.0.0`
- Spicy Lyrics extension installed and working
- Internet connection for first-time translations and update checks

---

## Installation

### Marketplace (recommended)

Install from **Spicetify Marketplace**:

1. Open Spicetify Marketplace.
2. Search for **Spicy Lyric Translator**.
3. Click **Install**.

No additional setup required.

### Manual (loader)

If you install manually, use the loader in `loader/SLT-loader.js` so you can receive hosted updates:

1. Copy `SLT-loader.js` to your Spicetify extensions folder as `spicy-lyric-translater.js`.
2. Register extension:
	```bash
	spicetify config extensions spicy-lyric-translater.js
	spicetify apply
	```

Windows users can also use the installer script in `installer/install-spicetify-SLT.cmd`.

### Local development build

```bash
npm install
npm run build
```

Build output is written to `dist/spicy-lyric-translater.js`.

Useful scripts:

- `npm run build` — production bundle + typecheck
- `npm run build:watch` — watch mode for development
- `npm run deploy` — build and copy to `%APPDATA%\spicetify\Extensions\`
- `npm run apply` — run `spicetify apply`

---

## Usage

1. Open a track with available lyrics in Spicy Lyrics.
2. Click the translate button in lyric view controls.
3. Right-click the translate button to open quick settings.
4. (Optional) Enable **Auto-Translate on Song Change**.

The extension works across full lyrics view, sidebar lyrics, and picture-in-picture lyrics contexts when available.

---

## Settings

- **Target Language**
- **Translation Display** (`Replace` or `Below each line`)
- **Translation API** (`Google`, `LibreTranslate`, or `Custom API URL`)
- **Auto-Translate on Song Change**
- **Show Notifications**
- **Debug Mode** (shown when dev tools are enabled)
- **Cache tools** (view/clear)
- **Check for Updates**

---

## Caching & Data

- Track cache keeps up to **100 tracks** (with expiry pruning).
- Line translation cache keeps up to **500 entries** with 7-day expiry.
- Connectivity indicator shows install/viewer counts and latency at a glance.
- **No personal data is collected** — ever.

---

## Troubleshooting

- **No translate button appears**: ensure Spicy Lyrics is installed and open.
- **No translations**: verify internet/API availability and try switching Translation API.
- **Wrong language or stale lines**: clear cache from settings and retry.
- **Extension not loading after manual install**: re-run `spicetify apply` and restart Spotify.
- **Custom API issues**: endpoint must be LibreTranslate-compatible.

---

## Links

Setup & usage guide:  
https://7xeh.dev/apps/spicylyrictranslate/docs

Service status:  
https://7xeh.dev/apps/spicylyrictranslate/status/

Song issue or bad translation? Report it here:  
https://7xeh.dev/apps/spicylyrictranslate/report/

Join the Discord for support, updates, and feedback:  
https://discord.gg/fXK34DeDW5

---

## Credits

Made with care for the Spicetify community by **7xeh**.

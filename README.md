<div align="center">

# Spicy Lyric Translator

**Real-time lyric translation for [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) on Spicetify.**

Translate any song as it plays — replace the lines or stack translations underneath, with eight providers, romanization-safe source detection, and per-track caching.

[![Discord](https://img.shields.io/badge/Discord-Join%20the%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/fXK34DeDW5)

![Spicetify](https://img.shields.io/badge/Spicetify-Extension-1DB954?style=flat-square&logo=spotify&logoColor=white)
![Version](https://img.shields.io/badge/Version-2.1.3-blue?style=flat-square)
![License](https://img.shields.io/badge/License-Source%20Available-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Online-success?style=flat-square)

[Install](#installation) · [Usage](#usage) · [Settings](#settings) · [Troubleshooting](#troubleshooting) · [Docs](https://7xeh.dev/apps/spicylyrictranslate/docs)

![Preview](https://github.com/7xeh/SpicyLyricTranslate/blob/main/slt_preview.gif?raw=true)
![Preview2](https://github.com/7xeh/SpicyLyricTranslate/blob/main/preview.png?raw=true)

</div>

---

## Need help or want to chat?

Join the official Discord for live support, bug reports, feature requests, translation feedback, and release announcements. It's the fastest way to get unstuck.

[**→ Join the Discord**](https://discord.gg/fXK34DeDW5)

- Help with installation and setup
- Report bad translations or song-specific issues
- Suggest features and vote on what comes next
- Release and hotfix announcements

---

## Features

**Display**

- **Replace mode** — swaps original lines for translated lines
- **Below mode** — keeps the original lyrics and adds translations underneath
- Works in the full lyrics view, the sidebar lyrics view, and picture-in-picture lyrics where available
- Per-line translation quality indicator

**Providers** — pick whichever fits your budget and quality bar:

| Provider | Key required | Notes |
| --- | --- | --- |
| Google Translate | No | Default, zero setup |
| LibreTranslate | Depends on host | Custom URL; key required for hosted `libretranslate.com` |
| DeepL | Yes | Header auth (`DeepL-Auth-Key`), free and pro hosts |
| OpenAI | Yes | Configurable model |
| Gemini | Yes | Configurable model and temperature |
| Grok (xAI) | Yes | Configurable model |
| Claude (Anthropic) | Yes | Configurable model |
| Custom endpoint | Optional | Generic, LibreTranslate-, OpenAI-, Gemini-, or DeepL-compatible formats |

**Accuracy**

- **Romanization-safe** — when Spicy Lyrics romanization is on, the translator pulls the original lyric text from Spicy Lyrics data instead of the romanized text on screen
- **Fallback source lookup** from the Spicy Lyrics cache, so already-loaded tracks still translate when Spicy Lyrics doesn't re-hit the lyrics API
- **Smart language detection** skips translation when lyrics are already in your target language
- **Regional variants** (e.g. Valencian for Catalan) on LLM providers

**Speed and convenience**

- Track-aware caching for fast reloads and better offline behavior
- Parallel requests — split long songs across 1–6 concurrent requests on LLM providers
- Native Spotify settings integration, plus a quick popup on right-click of the translate button
- `Alt+T` toggles translation on and off
- Built-in update checker with hotfix support and a one-click update flow
- Connection indicator with latency and total installed users

### Vocabulary / Learning Mode

Turns lyric lines into word-by-word paired flashcards. Original words are blurred by default and reveal on hover next to their translated counterpart, and the pairs hook into the karaoke gradient sync so translated words highlight in time with the music.

---

## Requirements

- Spicetify `>= 2.0.0`
- The Spicy Lyrics extension, installed and working
- An internet connection for first-time translations and update checks

## Installation

### Marketplace (recommended)

1. Open the Spicetify Marketplace
2. Search for **Spicy Lyric Translator**
3. Click **Install**

No further setup needed.

### Manual

Loader script, Windows installer, or a local development build — see **[INSTALL.md](INSTALL.md)**.

---

## Usage

1. Open a track with lyrics in Spicy Lyrics
2. Click the **translate button** in the lyric view controls
3. **Right-click** that button for the quick settings popup
4. Turn on **Auto-Translate on Song Change** to translate automatically as tracks change

Press `Alt+T` at any time to toggle translation.

---

## Settings

Available in Spotify settings and in the right-click popup.

**Translation**

| Setting | What it does |
| --- | --- |
| Target Language | Full Google Translate language list |
| Use Regional Variant | Asks for a regional variant of the target language (currently Valencian for Catalan). Only shown when the language has a variant *and* the provider is OpenAI, Gemini, Grok, Claude, or Custom — code-based providers have no variant model, so the option hides rather than silently returning the standard language |
| Translation Display | Replace, or Below each line |
| Translation API | Google, LibreTranslate, DeepL, OpenAI, Gemini, Grok, Claude, or Custom |
| Parallel Translation Requests | 1–6 concurrent requests on LLM providers. Faster on long songs; higher values increase API usage and can hit free-tier rate limits |

**Provider credentials**

| Provider | Fields |
| --- | --- |
| LibreTranslate | URL, API key |
| DeepL | API key |
| OpenAI | API key, model |
| Gemini | API key, model, temperature |
| Grok (xAI) | API key, model |
| Claude (Anthropic) | API key, model |
| Custom | URL, request format, API key (optional), model (optional) |

**Behaviour and interface**

- Auto-Translate on Song Change
- Show Notifications
- Show Translation Quality Indicator
- Vocabulary / Learning Mode
- Hide Connection Status

**Actions**

- View Cache · Clear Spicy Lyrics Cache · Clear All Cached Translations
- View Changelog · Check for Updates

---

## How it works

### Romanization and original lyrics

Spicy Lyrics can display romanized lyrics for Japanese, Chinese, Korean, Cyrillic, Greek, and other scripts. Translating from that romanized text produces poor results, because providers usually detect it as Latin text.

So the extension prefers original lyrics in this order:

1. Captured Spicy Lyrics `/query` API response
2. Spicy Lyrics cache storage for the current Spotify track
3. This extension's previously cached original source lines
4. Visible DOM lyrics — only when romanization is off

If romanization is on and no original lyrics can be found, the extension stops rather than sending romanized text to the provider.

### Caching and data

- **Track cache** — up to 100 tracks, 14-day expiry with pruning
- **Line cache** — up to 500 entries, 7-day expiry
- The Spicy Lyrics lyric cache is read as a fallback source for original lyrics
- The connection indicator reports server latency and total installed users
- **No personal data is collected**

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No translate button | Confirm Spicy Lyrics is installed and the lyrics view is open |
| No translations at all | Check your internet connection and selected provider; try switching providers |
| Wrong language or stale lines | Clear both the Spicy Lyrics cache and the translation cache, then reload the song |
| Romanization on, translation won't start | The extension couldn't find original lyrics and refused to send romanized text. Clear the Spicy Lyrics cache and reload the track |
| Extension not loading after a manual install | Re-run `spicetify apply` and restart Spotify |
| Custom endpoint failing | Make sure the selected Custom API Format matches what your endpoint actually speaks |

### Repairing a bad cache

If a track shows stale, missing, or wrong source lyrics:

1. Right-click the translate button in the Spicy Lyrics controls
2. Open Spicy Lyric Translator settings
3. **Clear Spicy Lyrics Cache** — forces Spicy Lyrics to re-fetch source lyrics
4. **Clear All Cached Translations** — removes old translated lines saved by this extension
5. Switch away from the song and back, or restart Spotify

Both actions are also available from the Spicetify menu.

---

## Development

```bash
npm install
npm run build
```

| Command | Purpose |
| --- | --- |
| `npm run build` | Production bundle and typecheck |
| `npm run build:watch` | Rebuild on change |
| `npm test` | Run the test suite |
| `npm run deploy` | Build, then copy `dist/spicy-lyric-translater.js` into the Spicetify extensions directory (Windows) |
| `npm run apply` | Run `spicetify apply` so Spotify picks up the new build |

Source lives in `src/` (`app.ts` plus `utils/`, `styles/`, `types/`), tests in `tests/`, and the auto-updating loader in `loader/`.

---

## Links

- **Discord** (support, updates, feedback) — https://discord.gg/fXK34DeDW5
- **Setup and usage guide** — https://7xeh.dev/apps/spicylyrictranslate/docs
- **Service status** — https://7xeh.dev/apps/spicylyrictranslate/status/
- **Report a song issue or bad translation** — https://7xeh.dev/apps/spicylyrictranslate/report/
- **GitHub** — https://github.com/7xeh/SpicyLyricTranslate

## License

Source-available under the SLT Source-Available License v1.0 — see [LICENSE](LICENSE). Not OSI open source.

---

<div align="center">

Made with <3 for the Spicetify community by **7xeh**.

[![Discord](https://img.shields.io/badge/Need%20help%3F-Join%20the%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/fXK34DeDW5)

</div>

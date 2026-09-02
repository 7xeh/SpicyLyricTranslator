<div align="center">

# Spicy Lyric Translator

**Real-time lyric translation for [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) on Spicetify.**

Translate any song as it plays — replace the lines or stack translations underneath, with eight providers, romanization-safe source detection, and per-track caching.

[![Discord](https://img.shields.io/badge/Discord-Join%20the%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/fXK34DeDW5)

![Spicetify](https://img.shields.io/badge/Spicetify-Extension-1DB954?style=flat-square&logo=spotify&logoColor=white)
![Version](https://img.shields.io/badge/Version-2.1.5-blue?style=flat-square)
![License](https://img.shields.io/badge/License-Source%20Available-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Online-success?style=flat-square)

[Getting Started](docs/getting-started.md) · [Providers](docs/providers.md) · [Settings](docs/settings.md) · [Troubleshooting](docs/troubleshooting.md) · [All Docs](docs/README.md)

![Preview](https://github.com/7xeh/SpicyLyricTranslate/blob/main/slt_preview.gif?raw=true)
![Preview2](https://github.com/7xeh/SpicyLyricTranslate/blob/main/preview.png?raw=true)

</div>

---

## Highlights

- **Two display modes** — replace the original lines, or keep them and add translations underneath
- **Romanization *and* translation together** — read the pinyin/romaji and the meaning at the same time, so you can follow a Chinese or Japanese song and still sing along
- **Eight providers** — Google (no key needed), LibreTranslate, DeepL, OpenAI, Gemini, Grok, Claude, or your own endpoint
- **Romanization-safe** — pulls original lyric text rather than translating romaji, pinyin, or other romanized display text
- **Smart language detection** — skips translation when lyrics are already in your target language
- **Fast on repeats** — track-aware caching, plus 1–6 parallel requests on LLM providers
- **Editable cached translations** — fix a bad line by hand in the cached lyrics viewer; the edit sticks and reapplies live
- **`Alt+T`** to toggle, auto-translate on song change, and a built-in update checker

Full feature list: [docs/features.md](docs/features.md)

---

## Install

**Marketplace (recommended)**

1. Open the Spicetify Marketplace
2. Search for **Spicy Lyric Translator**
3. Click **Install**

No further setup needed — it works out of the box on Google Translate.

Requires Spicetify `>= 2.0.0` and the Spicy Lyrics extension. For loader script or Windows installer instructions, see [docs/installation.md](docs/installation.md).

Then: play a track with lyrics, open the lyrics view, and click the **translate button**. Right-click it for quick settings. → [Getting Started](docs/getting-started.md)

---

## Documentation

| Page | What's in it |
| --- | --- |
| [Getting Started](docs/getting-started.md) | Requirements, first run, your first translation, keyboard shortcut |
| [Installation](docs/installation.md) | Manual install — loader script and Windows installer |
| [Features](docs/features.md) | Display modes, romanization, quality indicator |
| [Providers](docs/providers.md) | All eight translation backends, keys, models, and per-provider notes |
| [Settings](docs/settings.md) | Every setting, credential field, toggle, and action |
| [How It Works](docs/how-it-works.md) | Romanization handling, source lyric priority, caching and data |
| [Troubleshooting](docs/troubleshooting.md) | Common problems, fixes, and cache repair |

---

## Need help or want to chat?

Join the official Discord for live support, bug reports, feature requests, translation feedback, and release announcements. It's the fastest way to get unstuck.

[**→ Join the Discord**](https://discord.gg/fXK34DeDW5)

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

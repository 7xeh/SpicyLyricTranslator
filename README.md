# Spicy Lyric Translator

Real-time lyric translation extension for [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) on Spicetify.

[![Discord](https://img.shields.io/badge/Discord-Join%20the%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/fXK34DeDW5)

![Spicetify](https://img.shields.io/badge/Spicetify-Extension-1DB954?style=flat-square&logo=spotify&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Online-success?style=flat-square)

![Preview](https://raw.githubusercontent.com/7xeh/SpicyLyricTranslate/main/preview.png)

## Need Help or Want to Chat?

> Join the official Discord server for live support, bug reports, feature requests, translation feedback, and release announcements. The fastest way to get unstuck is to ask in the community.
>
> [**Join the Discord**](https://discord.gg/fXK34DeDW5)
>
> - Get help with installation and setup
> - Report bad translations or song-specific issues
> - Suggest features and vote on what comes next
> - Stay up to date with new releases and hotfixes

## Features

- Two display modes
  - Replace: swaps original lines with translated lines
  - Below each line: keeps original lyrics and adds translations underneath
- Multiple translation backends
  - Google Translate (no key required)
  - LibreTranslate
  - DeepL (API key)
  - OpenAI (API key, configurable model)
  - Gemini (API key)
  - Custom LibreTranslate-compatible endpoint (optional API key)
- Smart language detection that skips translation when lyrics are already in the target language
- Track-aware caching for faster reloads and better offline behavior
- Translation quality indicator per line
- Native Spotify settings integration plus a quick popup via right-click on the translate button
- Keyboard shortcut: `Alt+T` to toggle translation on/off
- Built-in update checker with hotfix support and one-click update flow
- Connection indicator with latency and total installed users

## Vocabulary / Learning Mode

- Transforms lyric lines into word-by-word paired flashcards
- Original words are blurred by default and revealed on hover, paired with their translated counterpart
- Integrates with the karaoke gradient sync system so translated words highlight in time with the music

## Requirements

- Spicetify `>= 2.0.0`
- Spicy Lyrics extension installed and working
- Internet connection for first-time translations and update checks

## Installation

### Marketplace (recommended)

- Open Spicetify Marketplace
- Search for `Spicy Lyric Translator`
- Click Install

No additional setup required.

For manual installation (loader script, installer, or local development build), see [INSTALL.md](INSTALL.md).

## Usage

- Open a track with available lyrics in Spicy Lyrics
- Click the translate button in the lyric view controls
- Right-click the translate button to open the quick settings popup
- Enable Auto-Translate on Song Change to translate automatically when tracks change

The extension works in the full lyrics view, the sidebar lyrics view, and picture-in-picture lyrics where available.

## Settings

- Target Language (full Google Translate language list)
- Translation Display: Replace or Below each line
- Translation API: Google, LibreTranslate, DeepL, OpenAI, Gemini, or Custom
- API credentials per provider (DeepL key, OpenAI key/model, Gemini key, Custom URL/key)
- Auto-Translate on Song Change
- Show Notifications
- Show Translation Quality Indicator
- Vocabulary / Learning Mode
- Hide Connection Status indicator
- View / Clear translation cache
- View Changelog
- Check for Updates

## Caching and Data

- Track cache keeps up to 100 tracks with expiry pruning
- Line translation cache keeps up to 500 entries with a 7-day expiry
- The connection indicator shows server latency and total installed users
- No personal data is collected

## Troubleshooting

- No translate button appears: make sure Spicy Lyrics is installed and the lyrics view is open
- No translations: verify internet access and your selected API; try switching providers
- Wrong language or stale lines: clear the cache from settings and retry
- Extension not loading after manual install: re-run `spicetify apply` and restart Spotify
- Custom API issues: the endpoint must be LibreTranslate-compatible

[![Discord](https://img.shields.io/badge/Need%20help%3F-Join%20the%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/fXK34DeDW5)


## Links

- Discord (support, updates, feedback): https://discord.gg/fXK34DeDW5
- Setup and usage guide: https://7xeh.dev/apps/spicylyrictranslate/docs
- Service status: https://7xeh.dev/apps/spicylyrictranslate/status/
- Report a song issue or bad translation: https://7xeh.dev/apps/spicylyrictranslate/report/
- GitHub: https://github.com/7xeh/SpicyLyricTranslate

## Credits

Made with <3 for the Spicetify community by 7xeh.
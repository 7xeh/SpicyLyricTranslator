# Features

## Display modes

| Mode | Behaviour |
| --- | --- |
| **Replace** | Swaps the original lines for translated lines |
| **Below each line** | Keeps the original lyrics and adds translations underneath |

Both work in the full lyrics view, the sidebar lyrics view, and picture-in-picture lyrics where available.

## Translation quality indicator

Each translated line can show a quality indicator, so you can tell at a glance where the provider was confident and where it struggled. Toggle it with **Show Translation Quality Indicator**.

## Vocabulary / Learning Mode

Turns lyric lines into word-by-word paired flashcards:

- Original words are blurred by default and reveal on hover, next to their translated counterpart
- The pairs hook into the karaoke gradient sync, so translated words highlight in time with the music

Enable it under **Vocabulary / Learning Mode** in settings.

## Accuracy

- **Romanization-safe** — when Spicy Lyrics romanization is on, the translator pulls original lyric text from Spicy Lyrics data instead of the romanized text on screen. See [How It Works](how-it-works.md#romanization-and-original-lyrics)
- **Fallback source lookup** from the Spicy Lyrics cache, so already-loaded tracks still translate when Spicy Lyrics doesn't re-hit the lyrics API
- **Smart language detection** skips translation when lyrics are already in your target language
- **Regional variants** — e.g. Valencian for Catalan, on LLM providers

## Speed and convenience

- **Track-aware caching** for fast reloads and better offline behavior — see [Caching and data](how-it-works.md#caching-and-data)
- **Parallel requests** — split long songs across 1–6 concurrent requests on LLM providers
- **Native Spotify settings integration**, plus a quick popup on right-click of the translate button
- **`Alt+T`** toggles translation on and off
- **Built-in update checker** with hotfix support and a one-click update flow
- **Connection indicator** with latency and total installed users

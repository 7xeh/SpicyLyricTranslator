# Settings

Settings live in two places, with the same options in both:

- **Spotify settings** — the full panel, grouped into Translation, Providers, and Interface
- **Quick popup** — right-click the translate button in the Spicy Lyrics controls for display mode and romanization, without opening the full panel

## Translation

| Setting | What it does |
| --- | --- |
| **Target Language** | The language to translate into. Full Google Translate language list |
| **Use Regional Variant** | Asks for a regional variant of the target language (currently Valencian for Catalan). Only shown when the language has a variant *and* the provider is OpenAI, Gemini, Grok, Claude, or Custom — code-based providers have no variant model, so the option hides rather than silently returning the standard language |
| **Translation Display** | Below each line (default), Replace, or None (original lyrics only, pairs with Learning Mode) |
| **Don't Translate** | Languages you already read. Songs detected in one of them are left untranslated, and lines in them are skipped inside songs that are otherwise in your target language |
| **Replace Lyrics When Only the Script Changes** | Shown when the target is Chinese. Between Simplified and Traditional Chinese, the converted lyrics replace the original instead of appearing below it |
| **Show Romanization** | Adds a pronunciation line (pinyin, romaji, ...) alongside the translation, when the lyrics provider supplies one |
| **Translation API** | Google, LibreTranslate, DeepL, OpenAI, Gemini, Grok, Claude, or Custom |
| **Parallel Translation Requests** | 1–6 concurrent requests on LLM providers. Faster on long songs; higher values increase API usage and can hit free-tier rate limits |

## Provider credentials

Only the fields for your selected provider are shown. See [Providers](providers.md) for details on each.

| Provider | Fields |
| --- | --- |
| Google Translate | *(none — no setup required)* |
| LibreTranslate | URL, API key |
| DeepL | API key |
| OpenAI | API key, model |
| Gemini | API key, model, temperature |
| Grok (xAI) | API key, model |
| Claude (Anthropic) | API key, model |
| Custom | URL, request format, API key (optional), model (optional) |

## Behaviour

| Setting | What it does |
| --- | --- |
| **Auto-Translate on Song Change** | Translates each new track automatically as it starts |
| **Learning Mode** | Word-by-word breakdown card under the line that is playing |
| **Learning Mode Breakdowns** | *Automatic* breaks lines down ahead of playback, about ten lines per request, and reuses cached breakdowns for repeated lines. *On demand only* sends nothing until you click a card or press the breakdown shortcut, which keeps AI providers inside free-tier rate limits |
| **Show Notifications** | Surfaces status and error notifications |

## Interface

| Setting | What it does |
| --- | --- |
| **Show Translation Quality Indicator** | Per-line confidence indicator on translated lines |
| **Hide Connection Status** | Hides the latency and installed-users indicator |

## Actions

| Action | What it does |
| --- | --- |
| **View Cache** | Inspect what's currently cached |
| **Clear Spicy Lyrics Cache** | Forces Spicy Lyrics to re-fetch source lyrics |
| **Clear All Cached Translations** | Removes old translated lines saved by this extension |
| **View Changelog** | What changed in recent releases |
| **Check for Updates** | Manual update check with a one-click update flow |

The cache actions are also available from the Spicetify menu. If a track is showing stale or wrong lyrics, see [Repairing a bad cache](troubleshooting.md#repairing-a-bad-cache).

## Keyboard shortcuts

Change these under **Interface · Shortcuts**: click the box and press the new combination, or press Backspace to turn a shortcut off.

| Default | What it does |
| --- | --- |
| `Alt+T` | Toggles translation on and off |
| `Alt+L` | Shows or hides the Learning Mode cards, and turns Learning Mode on if it is off |
| `Alt+B` | Breaks down the line playing now, in either breakdown mode |

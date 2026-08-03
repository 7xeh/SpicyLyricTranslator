# Settings

Settings live in two places, with the same options in both:

- **Spotify settings** — the full panel, grouped into Translation, Providers, and Interface
- **Quick popup** — right-click the translate button in the Spicy Lyrics controls

## Translation

| Setting | What it does |
| --- | --- |
| **Target Language** | The language to translate into. Full Google Translate language list |
| **Use Regional Variant** | Asks for a regional variant of the target language (currently Valencian for Catalan). Only shown when the language has a variant *and* the provider is OpenAI, Gemini, Grok, Claude, or Custom — code-based providers have no variant model, so the option hides rather than silently returning the standard language |
| **Translation Display** | Replace, or Below each line |
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
| **Show Notifications** | Surfaces status and error notifications |

## Interface

| Setting | What it does |
| --- | --- |
| **Show Translation Quality Indicator** | Per-line confidence indicator on translated lines |
| **Vocabulary / Learning Mode** | Word-by-word paired flashcards — see [Features](features.md#vocabulary--learning-mode) |
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

## Keyboard shortcut

`Alt+T` toggles translation on and off.

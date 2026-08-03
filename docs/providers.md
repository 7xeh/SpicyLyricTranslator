# Providers

The extension supports eight translation backends. Pick whichever fits your budget and quality bar — the default needs no setup at all.

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

Switch between them with the **Translation API** setting. Credential fields appear only for the provider you've selected.

## Choosing one

- **Just want it to work** — stay on Google Translate
- **Best quality on plain translation** — DeepL
- **Best at context, slang, and poetic lines** — OpenAI, Gemini, Grok, or Claude
- **Self-hosting or privacy-conscious** — LibreTranslate or a Custom endpoint

## Per-provider notes

### Google Translate

Default. No key, no configuration.

### LibreTranslate

Sends real POST requests using form data and falls back through Spicetify Cosmos when needed. Set **LibreTranslate URL** to your instance; the hosted `libretranslate.com` requires an API key.

### DeepL

Uses header-based authentication (`DeepL-Auth-Key`) and supports both the free and pro API hosts. Get a free key at [deepl.com/pro-api](https://www.deepl.com/pro-api).

### OpenAI

Supports a custom model setting, so you can trade cost against quality.

### Gemini

Supports custom model names and a temperature setting.

### Grok (xAI)

API key plus a configurable model.

### Claude (Anthropic)

API key plus a configurable model.

### Custom endpoint

Point the extension at any endpoint you control. Set **Custom API Format** to match what your endpoint actually speaks:

- Generic
- LibreTranslate Compatible
- OpenAI Compatible
- Gemini Compatible
- DeepL Compatible

An API key and a model name are both optional, depending on your endpoint.

## LLM-only capabilities

These apply to OpenAI, Gemini, Grok, Claude, and Custom:

- **Regional variants** — the **Use Regional Variant** setting appears only when your target language has a variant and you're on one of these providers. Code-based providers have no variant model, so the option hides rather than silently returning the standard language.
- **Parallel Translation Requests** — split long songs across 1–6 concurrent requests. Faster, but higher values increase API usage and can hit free-tier rate limits.

# How It Works

## Romanization and original lyrics

Spicy Lyrics can display romanized lyrics for Japanese, Chinese, Korean, Cyrillic, Greek, and other scripts. Translating from that romanized text produces poor results, because providers usually detect it as Latin text and return weak or incorrect translations.

So the extension prefers original lyrics in this order:

1. Captured Spicy Lyrics `/query` API response
2. Spicy Lyrics cache storage for the current Spotify track
3. This extension's previously cached original source lines
4. Visible DOM lyrics — only when romanization is off

If romanization is on and no original lyrics can be found, the extension **stops** rather than sending romanized text to the provider. If that happens, clear the Spicy Lyrics cache and reload the track — see [Troubleshooting](troubleshooting.md).

## Language detection

Before sending anything to a provider, the extension checks whether the lyrics are already in your target language and skips translation if they are. That saves both time and API quota.

## Caching and data

| Cache | Limit | Expiry |
| --- | --- | --- |
| Track cache | 100 tracks | 14 days, with pruning |
| Line cache | 500 entries | 7 days |

- The Spicy Lyrics lyric cache is read as a fallback source for original lyrics
- Caching is what makes reloads instant and gives you reasonable offline behavior on tracks you've already translated
- Both caches can be inspected and cleared from settings — see [Actions](settings.md#actions)

## Connection indicator

Reports server latency and the total number of installed users. Hide it with **Hide Connection Status**.

## Privacy

**No personal data is collected.**

Lyric text is sent to whichever translation provider you select, and that provider's own privacy policy applies to it. If that matters to you, use a self-hosted LibreTranslate instance or a Custom endpoint you control — see [Providers](providers.md).

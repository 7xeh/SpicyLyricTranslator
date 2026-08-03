# Troubleshooting

## Common problems

| Symptom | Fix |
| --- | --- |
| No translate button | Confirm Spicy Lyrics is installed and the lyrics view is open |
| No translations at all | Check your internet connection and selected provider; try switching providers |
| Wrong language or stale lines | Clear both the Spicy Lyrics cache and the translation cache, then reload the song — see [below](#repairing-a-bad-cache) |
| Romanization on, translation won't start | The extension couldn't find original lyrics and refused to send romanized text. Clear the Spicy Lyrics cache and reload the track |
| Nothing happens on a track | The lyrics may already be in your target language — detection skips those on purpose |
| Extension not loading after a manual install | Re-run `spicetify apply` and restart Spotify |
| Custom endpoint failing | Make sure the selected **Custom API Format** matches what your endpoint actually speaks |
| Provider rate-limit or quota errors | Lower **Parallel Translation Requests**, or switch providers |

## Repairing a bad cache

If a track shows stale, missing, or wrong source lyrics:

1. Right-click the translate button in the Spicy Lyrics controls
2. Open Spicy Lyric Translator settings
3. **Clear Spicy Lyrics Cache** — forces Spicy Lyrics to re-fetch source lyrics
4. **Clear All Cached Translations** — removes old translated lines saved by this extension
5. Switch away from the song and back, or restart Spotify

Both actions are also available from the Spicetify menu.

## Still stuck?

- Ask on **[Discord](https://discord.gg/fXK34DeDW5)** — fastest way to get help
- Report a song issue or bad translation — https://7xeh.dev/apps/spicylyrictranslate/report/
- Check service status — https://7xeh.dev/apps/spicylyrictranslate/status/

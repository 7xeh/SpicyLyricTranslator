# Installation

For most users, installing from the **Spicetify Marketplace** is the way to go — search for `Spicy Lyric Translator` and click Install. This page covers the manual options for everyone else.

## Requirements

- Spicetify `>= 2.0.0` installed and working
- Spicy Lyrics extension installed and enabled
- Internet connection for translations and update checks

## Option 1: Loader script (recommended)

The loader keeps the extension up to date by fetching the latest hosted build at startup.

- Download `loader/SLT-loader.js` from this repository
- Rename it to `spicy-lyric-translater.js`
- Copy it to your Spicetify extensions folder
  - Windows: `%APPDATA%\spicetify\Extensions\`
  - macOS / Linux: `~/.config/spicetify/Extensions/`
- Register and apply the extension:

```bash
spicetify config extensions spicy-lyric-translater.js
spicetify apply
```

## Option 2: Windows installer script

Windows users can run the bundled installer, which copies the loader and applies Spicetify automatically.

- Run `installer/install-spicetify-SLT.cmd`
- Restart Spotify when the script finishes

## Updating

Updates are pulled automatically on Spotify start. You can also use `Check for Updates` in the extension settings.

## Uninstalling

- Remove the extension from Spicetify:

```bash
spicetify config extensions spicy-lyric-translater.js-
spicetify apply
```

- Delete `spicy-lyric-translater.js` from your Spicetify extensions folder

## Troubleshooting

- Extension not loading: re-run `spicetify apply` and restart Spotify
- Translate button missing: confirm the Spicy Lyrics extension is installed and the lyrics view is open
- Loader not updating: check your internet connection, then restart Spotify

For anything else, see [Troubleshooting](troubleshooting.md) or join the [Discord](https://discord.gg/fXK34DeDW5).

## Next steps

Installed and working? Head to [Getting Started](getting-started.md).

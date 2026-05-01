# Manual Installation

This guide covers installing Spicy Lyric Translator outside of the Spicetify Marketplace. For most users, installing from the Marketplace is recommended — see the main [README](README.md).

## Requirements

- Spicetify `>= 2.0.0` installed and working
- Spicy Lyrics extension installed and enabled
- Internet connection for translations and update checks

## Option 1: Loader script (recommended for manual installs)

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

## Option 3: Local development build

Build the extension from source.

- Install dependencies and build:

```bash
npm install
npm run build
```

- The bundled output is written to `dist/spicy-lyric-translater.js`
- Copy that file to your Spicetify extensions folder (see paths above)
- Register and apply:

```bash
spicetify config extensions spicy-lyric-translater.js
spicetify apply
```

### Useful scripts

- `npm run build` — production bundle and typecheck
- `npm run build:watch` — watch mode for development
- `npm run deploy` — build and copy to `%APPDATA%\spicetify\Extensions\` (Windows)
- `npm run apply` — run `spicetify apply`

## Updating

- Loader install: updates are pulled automatically on Spotify start
- Local build: pull the latest changes and re-run `npm run build` (or `npm run deploy`)

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
- Build errors: ensure Node.js 18+ is installed and run `npm install` again
- For more help, join the Discord: https://discord.gg/fXK34DeDW5

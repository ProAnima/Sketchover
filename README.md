<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="Sketchover icon — draw on screen app">
</p>

<h1 align="center">Sketchover</h1>

<p align="center"><b>Draw on your screen during calls</b> — brush, arrows, Markdown text blocks, region screenshots and a laser pointer.<br>A free, open-source screen annotation tool for Windows, macOS and Linux.</p>

<p align="center">
  <a href="https://github.com/ProAnima/Sketchover/releases/latest"><img src="https://img.shields.io/github/v/release/ProAnima/Sketchover?label=download&color=6D28D9" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License: Apache 2.0"></a>
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Windows, macOS, Linux">
  <a href="https://github.com/ProAnima/Sketchover/actions/workflows/ci.yml"><img src="https://github.com/ProAnima/Sketchover/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center"><b>English</b> · <a href="README.ru.md">Русский</a></p>

Sketchover puts a transparent canvas over every window. Press one hotkey on a Zoom, Google Meet, Microsoft Teams or Discord call, share your whole screen, and draw right on top of whatever you are showing — code, a design, a spreadsheet, a website. Hold `Alt` and your mouse goes back to the apps underneath, so you can click and scroll without losing your drawing.

## Features

- **Draw on top of any app**: brush, line, arrow, rectangle, ellipse, text and a fading laser pointer.
- **Click-through**: hold `Alt` to click and scroll the windows below; double-tap `Alt` to stay in click-through mode. The drawing stays, semi-transparent.
- **Text blocks with Markdown**: headings, bullet and numbered lists (they continue on `Enter`), **bold**, *italic*, `code`, ~~strikethrough~~.
- **Arrows that stick**: arrows attach to text blocks and screenshots and follow them when you move them.
- **Region screenshots**: press `S`, select part of the screen, and it lands on the canvas — move it, resize it, rotate it.
- **Paste into the chat**: `Ctrl+Shift+C` copies your drawing as an image — paste it into Zoom, Teams, Slack or Telegram.
- **Save and keep editing**: `Ctrl+S` saves a PNG that opens anywhere and still contains the editable canvas — open it later with `Ctrl+O`.
- **Keyboard first, layout independent**: `1`…`0` pick tools, `Alt+1…8` colors, `Shift+1…3` stroke width, `F1` shows a cheat sheet.
- **Always ready, never in the way**: starts with your system and waits in the tray; one global hotkey (`` Alt+` ``, configurable) opens it on the monitor under your cursor.
- **Small and private**: a ~3 MB installer, no account; only an anonymous update check and anonymous usage statistics leave your computer, and the statistics can be turned off.
- **11 languages**: English, Русский, Deutsch, Español, Français, Português, 中文, 日本語, 한국어, العربية, हिन्दी.
- **Updates itself**, signed releases.

## Download

Get the installer for your system from the [latest release](https://github.com/ProAnima/Sketchover/releases/latest).


| System | File | Install |
|---|---|---|
| Windows 10/11 | `Sketchover_X.Y.Z_x64-setup.exe` | Run it and click Install. No admin rights needed. |
| macOS 11+ (Intel and Apple Silicon) | `Sketchover_X.Y.Z_universal.dmg` | Open it and drag Sketchover to Applications. |
| Linux (Ubuntu 24.04+, Debian 13+, Fedora 40+) | `Sketchover_X.Y.Z_amd64.AppImage` | `chmod +x` it and run. |
| Ubuntu, Debian, Mint | `Sketchover_X.Y.Z_amd64.deb` | Double-click, or `sudo apt install ./Sketchover_*.deb`. |
| Fedora, openSUSE | `Sketchover-X.Y.Z-1.x86_64.rpm` | Double-click, or `sudo dnf install ./Sketchover-*.rpm`. |

Sketchover opens the canvas right after install — press `` Alt+` `` (the key left of `1`) any time to bring it back. It then lives in the tray (the menu bar on macOS) and starts with your system, so it is always one hotkey away. Turn off “Start with the system” in Settings if you prefer; closing the canvas only hides it — quit from the tray or Settings.

**First launch.** The installers are not yet signed with a paid developer certificate:
- Windows may show “Windows protected your PC” → More info → Run anyway.
- macOS may say the developer cannot be verified → right-click Sketchover in Finder → Open → Open. For screenshots, macOS asks once for Screen Recording permission.

## Shortcuts

| Action | Keys |
|---|---|
| Show the canvas / drawing ⇄ click-through | `` Alt+` `` (global, configurable) |
| Mouse to the windows below while held | hold `Alt` (`⌥` on macOS; Windows and macOS) |
| Click-through on / off | double-tap `Alt` (Windows, macOS); `Esc`, the mode button or the global hotkey |
| Tools | `1` select, `2` brush, `3` line, `4` arrow, `5` rectangle, `6` ellipse, `7` text block, `8` text, `9` laser, `0` eraser |
| Region screenshot | `S` |
| Color / stroke width | `Alt+1…8` / `Shift+1…3` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` |
| Copy the drawing as an image | `Ctrl+Shift+C` |
| Save / open (PNG with the editable canvas inside) | `Ctrl+S` / `Ctrl+O` |
| Delete selected / clear all | `Delete` / `Shift+Delete` |
| Edit a text block | double-click it with any tool |
| Cheat sheet | `F1` |

Viewers see your drawing when you share the **entire screen**, not a single window.

## Why Sketchover

If you are looking for an **Epic Pen, ZoomIt, gInk, ppInk or Presentify alternative** for Windows, macOS and Linux, Sketchover is built for live calls and screen sharing: you can explain with arrows and text blocks, grab a piece of the screen as a screenshot and point at it, and keep working in the apps underneath without closing the overlay.

## FAQ

**Can other people on the call see what I draw?** Yes, when you share your entire screen. If you share a single window, the overlay is not part of it.

**Does it work with Zoom, Google Meet, Teams, Discord, Slack huddles?** Yes — Sketchover draws over the screen itself, so it works with any app that shares your screen.

**Does it collect data?** No account, and nothing about what you draw. Sketchover checks for updates and, unless you turn it off in Settings, sends anonymous usage statistics to ProAnima Hub: a launch and a heartbeat every 5 minutes while it runs, with a random install ID, the app version, the OS and the architecture. Nothing else.

**How do I keep a drawing?** `Ctrl+S` saves a regular PNG — it opens in any image viewer — with the canvas embedded, so `Ctrl+O` brings it back fully editable. Or `Ctrl+Shift+C` and paste it straight into the chat.

**Is everything the same on Linux?** Almost: holding or double-tapping `Alt` is Windows and macOS only for now. On Linux, switch click-through with `Esc`, the mode button or the global hotkey.

## Build from source

You need Node.js and Rust.

```bash
npm install
npm start          # run in development
npm run build      # installer for the current system
npm run check      # interface checks
npm test           # core logic tests
```

Releases: add a `## [X.Y.Z]` section to [CHANGELOG.md](CHANGELOG.md), then `npm version X.Y.Z && git push --follow-tags` — GitHub Actions builds, signs and smoke-tests the installers for all three systems in a draft release with those notes. Publish the draft, then promote the version to `stable` in ProAnima Hub.

Tauri 2 (Rust) for the system side, plain JavaScript modules for the canvas, no bundler. Project rules: [CLAUDE.md](CLAUDE.md), roadmap: [docs/ROADMAP.md](docs/ROADMAP.md).

## License

[Apache License 2.0](LICENSE) © 2026 [ProAnimaStudio](https://github.com/ProAnima), made by Ian Panaev. Free to use, modify and distribute, including commercially, keeping the [NOTICE](NOTICE).

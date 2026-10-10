# Changelog

All notable changes to Sketchover. The release workflow takes the notes for each version from this file.

## [Unreleased]

### Install
- Branded installers: the Windows setup shows the Sketchover artwork, the macOS disk image shows where to drag the app.
- Every release is now smoke-tested before it is published: installed and started on Windows, macOS and Linux.

## [0.1.0] — first release

Draw on your screen during calls — a free screen annotation tool for Windows, macOS and Linux.

### Drawing
- Brush, line, arrow, rectangle, ellipse, text, text blocks, laser pointer and eraser over every window.
- Text blocks and text with Markdown: headings, bullet and numbered lists that continue on `Enter`, **bold**, *italic*, `code`, ~~strikethrough~~. Double-click to edit with any tool.
- Arrows attach to text blocks and screenshots and follow them.
- Region screenshots (`S`): select part of the screen and it lands on the canvas — move, resize, rotate.

### Calls
- One global hotkey, `` Alt+` `` (configurable), opens the canvas on the monitor under the cursor.
- Hold `Alt` to click and scroll the windows below; double-tap `Alt` to stay in click-through mode (Windows, macOS).
- `Ctrl+Shift+C` copies the drawing as an image — paste it into the call chat.
- `Ctrl+S` saves a PNG that opens anywhere and keeps the editable canvas inside; `Ctrl+O` opens it again.

### App
- Starts with the system and waits in the tray; closing the canvas only hides it.
- Keys work on any keyboard layout: `1…0` tools, `Alt+1…8` colors, `Shift+1…3` stroke width, `F1` cheat sheet.
- Settings panel: language, hotkey, start with the system, updates, about.
- 11 languages: English, Русский, Deutsch, Español, Français, Português, 中文, 日本語, 한국어, العربية, हिन्दी.
- Signed automatic updates through ProAnima Hub.

### Install
- Windows 10/11 — `.exe`, no admin rights needed.
- macOS 11+ — one `.dmg` for Intel and Apple Silicon.
- Linux (Ubuntu 24.04+, Debian 13+, Fedora 40+) — AppImage, `.deb`, `.rpm`.

The installers are not yet signed with a paid developer certificate: on first launch Windows may show “Windows protected your PC” (More info → Run anyway), and macOS may ask you to open the app with right-click → Open.

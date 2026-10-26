# Changelog

All notable changes to Sketchover. The release workflow takes the notes for each version from this file.

## [0.5.1]

A polish release: every tool was re-tested by driving the real app, the interface was checked in all 11 languages on laptop and desktop screens, and every translation was proofread. No new features — just fewer surprises.

### Fixed

**Text and blocks**
- The text tool works on the first click again: the text field no longer closes empty right after it opens.
- Double-clicking a text or a block to edit it puts the cursor at the end instead of selecting the whole text, so one keystroke no longer wipes it.
- After you finish typing, nothing stays secretly selected: `Delete`, a new color or `Esc` no longer act on the block you just wrote.

**Arrows and selection**
- Clicking an arrow that connects two blocks no longer detaches it: a tiny hand tremor is not a drag any more (moving starts after 3 px).
- A click with the arrow tool inside a block or a screenshot no longer leaves a stray dash or a lone arrowhead.
- An arrow that starts and ends in the same block is no longer glued to its center.

**Drawing and pointer**
- A stroke ends when the mouse button is released outside the canvas — for example after holding the hold key mid-stroke — instead of drawing on without a pressed button.
- On touch screens and pens, a second finger no longer interrupts the stroke you are drawing.
- The accidental dot removed after a double-click can no longer come back with redo.

**Laser, highlighter, screenshots**
- The laser dot stays visible while you hold the button still, not only while moving.
- The highlighter's selection frame is drawn outside its wide stroke instead of crossing it.
- Picking a color or width while a screenshot is selected no longer adds empty undo steps.
- A failed region screenshot frees its memory right away (a 4K frame is tens of megabytes).

**Undo and files**
- Undo hides the "Canvas cleared — press Ctrl+Z to bring it back" hint once it is no longer relevant.
- Opening a damaged or hand-edited file no longer creates shapes that cannot be selected or erased: zero-size boxes and duplicate ids are dropped, stray rotation is ignored and text size is kept within limits.

**Languages and layout**
- Arabic (right-to-left): key combinations read left to right (``Alt + ` ``, not the other way round), and the *Keys* section arrow points the right way.
- All 10 translations were proofread for consistent terms and natural wording: one word for the canvas, the board and the system tray in each language, polite forms in Japanese and Korean, French narrow no-break spaces before `:`, `?` and `!` so punctuation never wraps onto its own line, and more.
- The toolbar, Settings, the cheat sheet and every tour step were checked at 1024 and 1280 px in all 11 languages: no clipped or overlapping text.

## [0.5.0]

### Changed
- `Esc` steps back: it deselects, then removes the board, and only then switches to click-through.
- Short hints say what just happened and how to undo it: after clearing the canvas, when fading ink is turned on or off, and when a board covers the screen.
- The toolbar now fits in two even rows on laptop screens (1024–1366 px) instead of three, and the cheat sheet hides while Settings is open.
- The near-black color is outlined, so it is visible on the dark toolbar; the *Keys* section shows that it expands.

### Added
- Highlighter (`M`): a wide, see-through stroke to mark a line of text without hiding it.
- Fading ink (`F`): lines, arrows and shapes fade away by themselves after a couple of seconds — point things out without cleaning up. Text, blocks and screenshots stay; faded ink is not in undo or in saved files.
- Whiteboard: `W` for a white board, `K` for a dark one, or the board button. Press again to bring the screen back; the board hides in click-through mode and is part of copied and saved images.
- One *Keys* section in Settings for every key, saved between launches:
  - Two more global hotkeys, without a key by default: *Drawing ⇄ click-through* and *Show / hide the canvas*.
  - Choose the hold key (mouse to the windows below) as well as the double-tap key: `Alt`, `Ctrl`, `Shift`, `⌘` (macOS) or off.
  - The same click-and-press recording for global and canvas keys. A global hotkey takes its combination away from canvas keys, and you are told where a key was taken from. A combination held by another program is kept and marked in orange.
- A short tour on the first launch: it highlights the toolbar step by step — tools, color and width, screenshots and saving, undo, click-through, hiding, the cheat sheet, settings — and explains each part with your current keys, in your language. Skip it any time; take it again from Settings → *Take the tour again*. Existing installs are not shown it automatically.

## [0.4.0]

### Added
- Every canvas key can be changed: Settings → *Canvas keys* → click a key and press the new one. A key already in use moves to the new action; reset one key or all of them. The cheat sheet and toolbar tooltips show your keys.
- Choose the double-tap key for click-through in Settings: `Alt`, `Ctrl`, `Shift`, `⌘` (macOS) or off.

### Changed
- macOS: double-tap `⌘` toggles click-through by default instead of `⌥` — double `⌥` opens other apps (Claude's quick entry, for one). Holding `⌥` still sends the mouse to the windows below.

### Fixed
- Anonymous usage statistics were never sent in 0.3.0: the request ran outside the async runtime and stopped the statistics thread. Drawing was not affected.

### Install
- Linux: built on Ubuntu 22.04, so the AppImage, `.deb` and `.rpm` now also run on Ubuntu 22.04, Debian 12, Linux Mint 21 and Fedora 36 and newer (before: Ubuntu 24.04+).

## [0.3.0]

### Added
- Anonymous usage statistics for ProAnima Hub: a launch and a heartbeat every 5 minutes while Sketchover runs, with a random install ID, the app version, the OS and the architecture — nothing about what you draw. On by default; turn it off in Settings → *Send anonymous usage statistics*.

## [0.2.0]

### Fixed
- The toolbar no longer runs off the screen on small displays (1024–1366 px wide): it wraps onto a second row.
- macOS: no Dock icon — Sketchover lives in the menu bar only, as intended.

### Install
- Branded installers: the Windows setup shows the Sketchover artwork, the macOS disk image shows where to drag the app.
- Every release is smoke-tested before it is published: installed and started on clean Windows, macOS and Linux machines, with a check that the canvas is transparent.

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

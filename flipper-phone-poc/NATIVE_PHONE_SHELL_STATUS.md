# Native Flipper Phone shell — verified prototype (23 Nov 2026)

## Proven by real CI test

Latest clean, equal-size screen run: https://github.com/russellstokes-ai/book-orbit-HA/actions/runs/45272556887

- Original Flipper One Rust/Slint native Linux application compiled and ran (no QEMU).
- Real, unmodified Flipper One application menus and screen stream shown in portrait mobile browser presentation.
- Original stock Flipper Zero Dolphin PNG sequences from firmware commit e459e2d939db7f292d7dcfe6935b8fb2641409e3: Waves, Laptop, Sleep, Furippa and Showtime.
- Stock frames preserve original source content and playback FPS/sequence. The phone renderer converts their original black/white display palette to black/amber, without drawing or inventing animations.
- Permanent Dolphin display area persists during original Network and Settings submenu navigation.
- Original 13 Flipper One keys exposed: directional gestures, OK, Back, Apps, PTT, Esc, View, Power, Edit and Run.
- Native host telemetry uses the existing status backend. Live captures show disconnected/unknown signals honestly. A separate screenshot-only 5G/Wi-Fi test fixture exists without a badge by user request; it must always be labelled a preview in documentation, NEVER presented as actual mobile connectivity.
- Direct menu tapping and browser screens verified in Playwright at 390x844. Dolphin and Flipper One display rectangles are both 356 x 200.25 CSS pixels in the tested viewport, each exactly 256x144 canvas pixels. The stock 128x64 Dolphin frames are 2x pixel-blitted with symmetric 8px amber bands, not stretched.
- Removed top-right connection dot. Original Flipper One hardware legend shapes, traced from the official Flipper One documentation (not copied official SVG assets): X for Escape, three lines for View, power symbol, corner brackets for Edit, check for Run, overlapping windows for App Switcher, circular D-pad centre for OK, back arrow and waveform for PTT. All button behaviours remain mapped to the original Flipper One key events. Exact original icon **assets** do not exist in the project; these are faithful graphic interpretations of the official hardware legends.
- Screenshots and source manifests are in the GitHub Actions artifact named genuine-flipper-phone-native-ui-screenshots.

## Not yet proven

- Browser presentation is NOT a packaged native Android/Linux phone application, although the core FlipCTL UI runs natively.
- No real ARM64 smartphone installation or device OS support.
- RF, NFC, LF RFID, IR and other peripheral hardware bridges are not implemented.
- Task-aware Dolphin selection is not connected to live task state. Idle cycling is implemented; only initial stock-frame rendering was verified by CI.
- Actual phone modem integration, power management, performance and battery life are untested.
- GPL-3.0 licensing of stock Dolphin content and Flipper branding permission require review before distribution.

## Source and reproduction

Main build script: flipper-phone-poc/build-native-shell.py.
Shell layout: flipper-phone-poc/native-shell.html and native-shell.js.
CI: .github/workflows/flipper-phone-native-shell.yml.
Official Flipper One source pinned at commit 258e19a1ead6e32f27c89f272d6ec92be986ad61.
Official Flipper Zero Dolphin source pinned at commit e459e2d939db7f292d7dcfe6935b8fb2641409e3.

All changes are confined to an isolated experimental branch. Prior validated prototypes and unrelated Home Assistant project files remain untouched.

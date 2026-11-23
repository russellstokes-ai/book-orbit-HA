# Native Flipper Phone shell — verified prototype (23 Nov 2026)

## Proven by real CI test

Run: https://github.com/russellstokes-ai/book-orbit-HA/actions/runs/45251789976

- Original Flipper One Rust/Slint native Linux application compiled and ran (no QEMU).
- Real, unmodified Flipper One application menus and screen stream shown in portrait mobile browser presentation.
- Original stock Flipper Zero Dolphin PNG sequences from firmware commit e459e2d939db7f292d7dcfe6935b8fb2641409e3: Waves, Laptop, Sleep, Furippa and Showtime.
- Stock frames preserve original source content and playback FPS/sequence. The phone renderer converts their original black/white display palette to black/amber, without drawing or inventing animations.
- Permanent Dolphin display area persists during original Network and Settings submenu navigation.
- Original 13 Flipper One keys exposed: directional gestures, OK, Back, Apps, PTT, Esc, View, Power, Edit and Run.
- Native host telemetry uses the existing status backend. Host without modem displays No service; 5G, Wi-Fi strength and battery values appear only in an explicitly labelled DEMO view when no actual device exists.
- Direct menu tapping and browser screens verified in Playwright at 390x844.
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

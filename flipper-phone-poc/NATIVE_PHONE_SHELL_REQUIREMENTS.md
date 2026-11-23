# Native Flipper Phone shell — agreed baseline, 23 Nov 2026

## Architecture: **native Linux, NOT QEMU at runtime**
Build on existing genuine Flipper One Rust/Slint FlipCTL software, running as a
native Linux UI on an ARM64 handset. The QEMU Flipper Zero experiment remains
a separate compatibility reference. It is **not** the intended production runtime.

### Source provenance (pin versions when implementing)
* Flipper One: https://github.com/flipperdevices/flipctl-slint
  Source reviewed: `258e19a1ead6e32f27c89f272d6ec92be986ad61`; MIT.
* Original Flipper Zero Dolphin animation assets:
  https://github.com/flipperdevices/flipperzero-firmware/tree/dev/assets/dolphin
  Source reviewed: `e459e2d939db7f292d7dcfe6935b8fb2641409e3`; firmware repository GPL-3.0.
* Do not confuse Flipper One's animated menu **icons** with the separate
  Flipper Zero **Dolphin animations**.

## Permanently visible Dolphin
* Always reserve a dedicated top-of-app animated Dolphin zone, beneath the
  system status bar, even while navigation changes underneath it.
* Every pixel of Dolphin artwork must come from **stock Flipper Zero**
  `assets/dolphin` source files. No AI images, redrawing, imitation,
  reanimated screenshots, or custom substitute animations.
* Load stock PNG frames from the source animation directories, read each
  stock `meta.txt` for `Width`, `Height`, `Frames order`, `Frame rate`,
  `Passive frames`, `Active frames`, `Active cycles`, `Active cooldown`
  and `Duration`. Preserve timing, playback order, native pixel boundaries,
  aspect ratio, and original animation frame content.
* Idle cycle: choose eligible entries from stock `external/manifest.txt`.
  Respect level, mood/butthurt limits and weighted selection when those
  values are tracked; otherwise use a documented subset of stock eligible
  level-1 idle animations. Never use warnings/error animations as cheerful idle.
* Tasks may select *existing* themed animations (e.g. stock
  `L1_Laptop_128x51` or `L2_Coding_in_the_shell_128x64` for a
  computing task), but **never promise a unique animation for every task**.
  When no suitable stock animation exists, use the active idle animation.
* Original text bubbles are defined in `meta.txt`; rendering those accurately
  requires stock font, placement, and sequence handling, not invented captions.
* Do not let Dolphin steal menu touch focus. When an app needs more room,
  shrink the header rather than hiding it, subject to legibility.

## Real Flipper One input semantics
Flipper One source: `crates/flipper-ui/src/key.rs` and
`crates/flipper-ui/src/remote/page.html`.

Original complete set, all retained:
- Left, Right, Up, Down and OK: touch gestures / direct row taps rather
  than a permanent visual D-pad.
- Back and AppSwitch: visible touch controls.
- PTT: visible context-specific press-and-hold control.
- **Escape, View, Power, Edit, Run**: all five distinct soft buttons
  permanently accessible in the exact original order.
- Preserve press and release semantics for PTT and held keys.
- The original Flipper One source maps these to evdev codes; do not change
  command meaning or silently collapse Escape into Back.

## Real connectivity indicators
Flipper One already contains `crates/flipper-ui/src/status.rs` and
`crates/flipper-ui/ui/statusbar.slint`:
* Top bar must show actual Wi-Fi signal quality if connected, using the
  original Wi-Fi status assets (0/25/50/75/100).
* Display cellular signal bars and access technology from the modem only
  when the modem exists and is registered. Label 5G **only for actual 5G**,
  otherwise show LTE/4G/3G or no service/unknown as appropriate.
* Display actual charge level and charging state; never draw full
  battery or full signal by default.
* On a host without modem/Wi-Fi (e.g. CI), use no-service, hidden indicators,
  or **clearly labelled DEMO** placeholders. Do not claim real readings.
* ARM64 handset backend may require ModemManager, NetworkManager or
  platform-specific services; source's current sysfs/modem assumptions are
  not guaranteed to work unchanged on Android.

## Layout order on a portrait touchscreen
1. Live connectivity/clock/battery bar (clock integration pending).
2. Permanent native-stock Dolphin animation panel.
3. Main genuine Flipper One menu, application or activity content,
   with direct tap-selection and swipes.
4. Compact Back / AppSwitch / Select / contextual PTT strip.
5. Five native soft-key equivalents:
   **ESC | VIEW | POWER | EDIT | RUN**.

This is a **requirements contract**, not a claim that the final native
screen has already shipped. Until native shell implementation and CI tests
exist, mark the header, restored input row and phone status integrations
as pending.

## Acceptance criteria and protection
- Proven ARM64 native build against pinned official FlipCTL code.
- Real stock Dolphin frame and metadata playback and rotation, *without QEMU*.
- All 13 Flipper One semantic key inputs reachable (touch and/or keyboard).
- Real status values presented only when available; unknown is never fabricated.
- Confirm no previous native FlipCTL or separate Zero-emulator test regresses.
- Review the GPL-3.0 obligations and branding/trademark permissions for
  bundled Flipper Zero artwork before any distributable commercial release.
- All changes on isolated experiment branches until tests and UI approved.

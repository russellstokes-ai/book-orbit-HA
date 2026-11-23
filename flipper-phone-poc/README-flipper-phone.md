# Flipper Phone: no-device technical prototype

This isolated prototype is a **feasibility test**, not yet an Android app or a replacement for a physical Flipper Zero.

## Genuine components

- **Official Flipper Zero firmware 1.5.1, unmodified**, running in [FlipperEmu](https://github.com/KaraZajac/FlipperEmu), upstream commit e194a55f18fc5d18406c6a7197af7d0e9387caf3.
- Firmware boot, original Dolphin artwork and menu frames on native ARM64 Linux.
- Framebuffer capture and simulated button events through FlipperEmu's upstream QEMU monitor.
- Touch-first browser wrapper; no on-screen D-pad.

## Files and roles

- zero-touch-server.py: local HTTP bridge to the genuine emulator.
- zero-touch.html and zero-touch.js: portrait display, tap, swipe, edge-back and held-OK navigation.
- zero-touch.test.cjs: six unit tests for gesture translation.
- zero-touch-browser-smoke.mjs: real Chrome touch interaction using a **clearly labelled mock monitor**.
- zero-touch-api-smoke.py: real firmware framebuffer + button input and security checks on ARM64.
- .github/workflows/flipper-phone-zero-touch.yml: both browser and ARM64 test jobs.

## Display fidelity

The original LCD is 128 by 64 **logical** pixels. Pinned FlipperEmu's QEMU framebuffer
is 544 by 312 pixels, containing a 512 by 256, four-times-scaled original LCD
at x=16, y=16. The remaining pixels are emulator bezel/status graphics, not the
Flipper LCD. The bridge crops the LCD rectangle (16,16,528,272) without modifying
original art or UI. Any unrecognised framebuffer size is rejected rather than stretched.

## Touch input — current scope

Tap = OK. Swipe = Up, Down, Left or Right. Swipe right from left edge = Back.
Long press = held OK (up to 1.2 seconds). Back/Select actions and accessibility
keyboard shortcuts are also available.

**Important limitation:** this is gesture-to-existing-button navigation, *not*
direct selection of an arbitrary menu row by tapping it. Reliable per-screen
selection/hit testing is a further task.

## Run without a phone

Build pinned FlipperEmu on Linux using upstream instructions (including QEMU
dependencies, Python Pillow, mtools and dosfstools). Download the official
firmware using FlipperEmu's fetch_firmware.py script, version 1.5.1.

Inside the FlipperEmu folder, run:

    ./flipperemu -d touchproof run -f firmware/official-1.5.1/flipper-z-f7-update-1.5.1.tgz --headless --detach

From the project root, run:

    python3 flipper-phone-poc/zero-touch-server.py --monitor flipperemu/devices/touchproof/monitor.sock --fe-monitor flipperemu/scripts/fe_monitor.py

Open http://127.0.0.1:8877/ in a browser on the same machine.
Automated CI builds and tests the prototype without local Linux or a phone.

## Still unproven — do not buy hardware yet

1. Direct menu-row/icon taps and smooth sustained Dolphin animation frame rate.
2. Installation on a real Android/Linux phone, reliable suspend/resume, battery life and thermals.
3. Real radio/GPIO peripherals. Virtual Sub-GHz, NFC, RFID and IR hardware in QEMU
   is not evidence of physical RF operation. These require dedicated hardware
   or appropriately designed interfaces and a validated software bridge.
4. On-device AI feasibility, including memory, acceleration, performance and power draw.

## Protection and security

Experiments are isolated from the existing BookOrbit Home Assistant add-on and
the older FlipCTL touchscreen prototype. Original Flipper firmware is unchanged.
The bridge listens only on localhost, checks Host and Origin, and validates all
accepted buttons/hold times. Never expose its control port to a LAN or Internet
without authentication and transport security.

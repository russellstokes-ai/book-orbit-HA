/* Touch-only input for the authentic Flipper Zero framebuffer.
   Translate gestures into the SIX EXISTING Flipper hardware events.
   The firmware and its original UI assets are never modified. */
(function (root) {
  "use strict";
  const KEYS = new Set(["ok", "back", "up", "down", "left", "right"]);

  function gestureToCommand(g) {
    const w = Math.max(1, Number(g.width) || 1);
    const dx = Number(g.dx) || 0, dy = Number(g.dy) || 0;
    const duration = Math.max(0, Number(g.durationMs) || 0);
    const threshold = Math.max(26, Math.min(w * 0.12, 55));
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= threshold) {
      if (Number(g.startX) <= w * 0.14 && dx > threshold &&
          Math.abs(dx) > Math.abs(dy) * 1.2)
        return {key: "back", hold_ms: 120, gesture: "edge-back"};
      if (Math.abs(dx) > Math.abs(dy) * 1.2)
        return {key: dx > 0 ? "right" : "left", hold_ms: 120, gesture: "horizontal-swipe"};
      if (Math.abs(dy) >= Math.abs(dx))
        return {key: dy > 0 ? "down" : "up", hold_ms: 120, gesture: "vertical-swipe"};
      return null; // An ambiguous diagonal should not accidentally select something.
    }
    if (duration >= 550)
      return {key: "ok", hold_ms: Math.min(1200, Math.round(duration)), gesture: "long-press"};
    return {key: "ok", hold_ms: 120, gesture: "tap"};
  }

  const api = {gestureToCommand, KEYS};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FlipperPhoneZeroTouch = api;

  if (typeof document === "undefined") return;

  function attach() {
    const lcd = document.querySelector("#lcd");
    const connection = document.querySelector("#connection");
    const activity = document.querySelector("#activity");
    const backButton = document.querySelector("#back");
    const selectButton = document.querySelector("#select");
    if (!lcd || !connection || !activity) return;

    let pointer = null, lastFrameUrl = null, refreshTimer = null;
    let operation = Promise.resolve();
    let closed = false;

    function notice(message, error = false) {
      activity.textContent = message;
      activity.dataset.error = String(error);
    }
    function command(key, hold_ms = 120, gesture = "button") {
      if (!KEYS.has(key)) return Promise.reject(new Error("Invalid Flipper key"));
      // Serialise key presses so sequences cannot overlap on the QEMU monitor.
      operation = operation.catch(() => {}).then(async () => {
        const response = await fetch("/key", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({key, hold_ms})
        });
        if (!response.ok) throw new Error("Emulator rejected input: HTTP " + response.status);
        const data = await response.json();
        if (!data.ok || data.key !== key) throw new Error("Emulator did not acknowledge " + key);
        notice(gesture + " → " + key.toUpperCase() + " (" + hold_ms + " ms)");
      }).catch(err => {
        notice("Input unavailable: " + err.message, true);
        throw err;
      });
      // UI handlers consume errors; retaining a catch inside command lets tests
      // distinguish rejected commands if called directly.
      return operation;
    }
    function send(key, hold_ms = 120, gesture = "button") {
      command(key, hold_ms, gesture).catch(() => {});
    }

    async function refresh() {
      if (closed) return;
      try {
        const response = await fetch("/frame.png", {cache: "no-store"});
        if (!response.ok) throw new Error("HTTP " + response.status);
        const blob = await response.blob();
        if (!blob.type.includes("image/png")) throw new Error("Not an original LCD PNG");
        const objectUrl = URL.createObjectURL(blob);
        try {
          // Decode before swapping, to avoid a blank panel during each refresh.
          const tmp = new Image();
          tmp.src = objectUrl;
          await tmp.decode();
          if (closed) { URL.revokeObjectURL(objectUrl); return; }
          lcd.src = objectUrl;
          if (lastFrameUrl) URL.revokeObjectURL(lastFrameUrl);
          lastFrameUrl = objectUrl;
          lcd.dataset.frames = String((Number(lcd.dataset.frames) || 0) + 1);
          connection.textContent = "LIVE";
          connection.dataset.state = "online";
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          throw err;
        }
      } catch (err) {
        connection.textContent = "OFFLINE";
        connection.dataset.state = "offline";
        notice("Screen connection: " + err.message, true);
      } finally {
        if (!closed) refreshTimer = setTimeout(refresh, 450);
      }
    }

    lcd.addEventListener("pointerdown", ev => {
      if (pointer) return;
      ev.preventDefault();
      const rect = lcd.getBoundingClientRect();
      pointer = {id: ev.pointerId, x: ev.clientX, y: ev.clientY,
        startX: ev.clientX - rect.left, width: rect.width, at: performance.now()};
      if (typeof lcd.setPointerCapture === "function")
        lcd.setPointerCapture(ev.pointerId);
    });
    lcd.addEventListener("pointercancel", () => {pointer = null;});
    lcd.addEventListener("pointerup", ev => {
      if (!pointer || pointer.id !== ev.pointerId) return;
      ev.preventDefault();
      const p = pointer;
      pointer = null;
      const cmd = gestureToCommand({dx: ev.clientX - p.x, dy: ev.clientY - p.y,
        durationMs: performance.now() - p.at, startX: p.startX, width: p.width});
      if (cmd) send(cmd.key, cmd.hold_ms, cmd.gesture);
    });

    backButton.addEventListener("click", () => send("back", 120, "back button"));
    selectButton.addEventListener("click", () => send("ok", 120, "select button"));
    lcd.addEventListener("keydown", ev => {
      const keys = {Enter: "ok", " ": "ok", Escape: "back",
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right"};
      const key = keys[ev.key];
      if (!key) return;
      ev.preventDefault();
      if (!ev.repeat) send(key, 120, "accessibility keyboard");
    });
    root.addEventListener("pagehide", () => {
      closed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (lastFrameUrl) URL.revokeObjectURL(lastFrameUrl);
    }, {once: true});
    refresh();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", attach, {once: true});
  else attach();
})(typeof window !== "undefined" ? window : globalThis);

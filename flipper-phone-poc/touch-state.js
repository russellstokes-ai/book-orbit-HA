/* Version 2: state-aware touch input for the genuine Flipper One interface.
   Real Rust/Slint framebuffer remains unchanged. Menu selections and dynamic
   filtering are read from the test-only /state endpoint, never guessed locally. */
(function (root) {
  "use strict";
  const W = 256, H = 144, PITCH = 21, MAIN_Y = 25, SUBMENU_Y = 28;
  const DEFAULT_WAIT = 1800;

  function menuRowAt(clientY, rect, state) {
    if (!state || state.screen !== "menu" || !rect || rect.height <= 0) return -1;
    const y = (clientY - rect.top) * H / rect.height;
    const top = state.level > 1 ? SUBMENU_Y : MAIN_Y;
    const relative = Math.floor((y - top) / PITCH);
    const visible = Math.min(state.visible_rows ?? 5, state.total - state.scroll);
    return y >= top && relative >= 0 && relative < visible ? relative : -1;
  }

  function createStateTouchAdapter(post, readState, opts = {}) {
    const sleep = opts.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const holdMs = opts.holdMs ?? 65;
    const settleMs = opts.settleMs ?? 65;
    const waitMs = opts.waitMs ?? DEFAULT_WAIT;
    let tail = Promise.resolve();

    function serial(job) {
      const result = tail.then(job);
      tail = result.catch(() => {}); // Failed tap must not poison future taps.
      return result;
    }
    async function snapshot() {
      const state = await readState();
      if (!state || typeof state.screen !== "string" ||
          !Number.isInteger(state.selected) || !Number.isInteger(state.scroll) ||
          !Number.isInteger(state.total) || !Number.isInteger(state.level)) {
        throw new Error("Flipper navigation-state endpoint unavailable");
      }
      return state;
    }
    async function pulse(key) {
      await post(key, true);
      await sleep(holdMs);
      await post(key, false);
      await sleep(settleMs);
    }
    async function until(test, meaning) {
      const end = Date.now() + waitMs;
      do {
        const s = await snapshot();
        if (test(s)) return s;
        await sleep(40);
      } while (Date.now() < end);
      throw new Error("Flipper did not confirm " + meaning);
    }
    async function ensureMenu() {
      const s = await snapshot();
      if (s.screen === "menu") return s;
      if (s.screen !== "idle") throw new Error("Open MENU only from Flipper's idle screen");
      await pulse("view");
      return until(s => s.screen === "menu", "menu opening");
    }
    function openMenu() { return serial(ensureMenu); }
    function navigateAndTap(visibleRow) {
      return serial(async () => {
        let s = await snapshot();
        if (s.screen !== "menu") throw new Error("Menu is not currently displayed");
        const maxVisible = Math.min(s.visible_rows ?? 5, s.total - s.scroll);
        if (!Number.isInteger(visibleRow) || visibleRow < 0 || visibleRow >= maxVisible) {
          throw new RangeError("Tapped outside actual visible Flipper menu rows");
        }
        const wanted = s.scroll + visibleRow;
        let safety = Math.max(0, s.total) + 1;
        while (s.selected !== wanted && safety-- > 0) {
          const oldSelection = s.selected;
          await pulse(wanted > s.selected ? "down" : "up");
          s = await until(next => next.screen === "menu" && next.level === s.level &&
            next.selected !== oldSelection, "menu selection change");
        }
        if (s.selected !== wanted) throw new Error("Could not reach desired menu row safely");
        const previousLevel = s.level;
        await pulse("ok");
        // Some options open a different screen; some toggle while remaining in menu.
        // Do not claim navigation unless the actual backend reports a transition.
        const result = await snapshot();
        return { from: s, to: result, navigated: result.screen !== "menu" || result.level !== previousLevel };
      });
    }
    function back() {
      return serial(async () => {
        const before = await snapshot();
        await pulse("back");
        return until(s => s.screen !== before.screen || s.level !== before.level,
            "Back action");
      });
    }
    function swipe(direction) {
      return serial(async () => {
        const before = await snapshot();
        if (before.screen !== "menu" || before.total < 2)
          throw new Error("Swipe navigation currently supports Flipper menus only");
        const key = direction > 0 ? "down" : "up";
        await pulse(key);
        return until(s => s.screen === "menu" &&
          (s.selected !== before.selected || s.scroll !== before.scroll), "swipe selection");
      });
    }
    return { openMenu, tapVisibleRow:navigateAndTap, back, swipe, snapshot, menuRowAt };
  }
  root.FlipperPhoneStateTouch = { createStateTouchAdapter, menuRowAt };
  if (typeof module !== "undefined" && module.exports) module.exports = root.FlipperPhoneStateTouch;
})(typeof window !== "undefined" ? window : globalThis);

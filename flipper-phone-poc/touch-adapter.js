/* Experimental touchscreen adapter. Real FlipCTL binary, original UI frame and
   original HTTP input API remain unchanged. No virtual D-pad. */
(function (root) {
  "use strict";
  const PANEL_W = 256, PANEL_H = 144;
  const MENU_FIRST_Y = 25, MENU_ROW_PITCH = 21, MENU_ROWS_VISIBLE = 5;
  function rowFromPointer(clientY, rect) {
    if (!rect || rect.height <= 0) return -1;
    const y = (clientY - rect.top) * PANEL_H / rect.height;
    const row = Math.floor((y - MENU_FIRST_Y) / MENU_ROW_PITCH);
    return y >= MENU_FIRST_Y && row >= 0 && row < MENU_ROWS_VISIBLE ? row : -1;
  }
  function createTouchAdapter(post, opts = {}) {
    const sleep = opts.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    let selected = 0, menuOpen = false;
    let tail = Promise.resolve();
    async function pulse(key) {
      await post(key, true);
      await sleep(60);
      await post(key, false);
      await sleep(60);
    }
    function serial(action) {
      // Touch events must never race previous key releases.
      tail = tail.then(action);
      return tail;
    }
    function openMenu() {
      return serial(async () => {
        if (!menuOpen) {
          await pulse("view");
          selected = 0;
          menuOpen = true;
        }
      });
    }
    function tapMenuRow(row) {
      return serial(async () => {
        if (!Number.isInteger(row) || row < 0 || row >= MENU_ROWS_VISIBLE) {
          throw new RangeError("menu row outside visible viewport");
        }
        if (!menuOpen) {
          await pulse("view");
          selected = 0;
          menuOpen = true;
        }
        while (selected < row) { await pulse("down"); selected++; }
        while (selected > row) { await pulse("up"); selected--; }
        await pulse("ok");
        menuOpen = false; // submenu may open; future backend state API will track it
      });
    }
    function back() {
      return serial(async () => { await pulse("back"); menuOpen = false; });
    }
    function scroll(delta) {
      return serial(async () => {
        await pulse(delta > 0 ? "down" : "up");
        if (menuOpen) selected = Math.max(0, Math.min(5, selected + Math.sign(delta)));
      });
    }
    return { openMenu, tapMenuRow, back, scroll, rowFromPointer, state: () => ({ selected, menuOpen }) };
  }
  root.FlipperPhoneTouch = { createTouchAdapter, rowFromPointer };
  if (typeof module !== "undefined" && module.exports) module.exports = root.FlipperPhoneTouch;
})(typeof window !== "undefined" ? window : globalThis);

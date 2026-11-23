const test = require("node:test");
const assert = require("node:assert/strict");
const {gestureToCommand, KEYS} = require("./zero-touch.js");

test("short tap activates the real OK input, not a mock menu", () => {
  assert.deepEqual(gestureToCommand({dx:2,dy:3,width:380,startX:180,durationMs:120}),
    {key:"ok",hold_ms:120,gesture:"tap"});
});
test("swipes map to existing Flipper directions", () => {
  for (const [dx,dy,key] of [[0,-80,"up"],[0,80,"down"],[-90,0,"left"],[90,0,"right"]]) {
    const result = gestureToCommand({dx,dy,width:380,startX:190,durationMs:210});
    assert.equal(result.key,key);
    assert(KEYS.has(result.key));
  }
});
test("left-edge inward swipe means Back, not Right", () => {
  assert.equal(gestureToCommand({dx:110,dy:3,width:380,startX:12,durationMs:230}).key,"back");
  assert.equal(gestureToCommand({dx:110,dy:3,width:380,startX:220,durationMs:230}).key,"right");
});
test("long press emits held OK, capped for safety", () => {
  assert.equal(gestureToCommand({dx:1,dy:1,width:380,startX:200,durationMs:800}).hold_ms,800);
  assert.equal(gestureToCommand({dx:0,dy:0,width:380,startX:200,durationMs:3200}).hold_ms,1200);
});
test("ambiguous diagonal does nothing", () => {
  assert.equal(gestureToCommand({dx:49,dy:43,width:380,startX:200,durationMs:150}),null);
});
test("small hand tremor is treated as tap", () => {
  assert.equal(gestureToCommand({dx:6,dy:7,width:380,startX:190,durationMs:220}).key,"ok");
});

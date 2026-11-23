const test = require("node:test");
const assert = require("node:assert/strict");
const {createTouchAdapter, rowFromPointer} = require("./touch-adapter.js");

test("real 256x144 list geometry scales into a phone viewport", () => {
  const rect = {top:100, height:288}; // 2x scale of original panel
  assert.equal(rowFromPointer(100 + (25 + 10)*2, rect),0);
  assert.equal(rowFromPointer(100 + (25 + 3*21 + 9)*2, rect),3);
  assert.equal(rowFromPointer(100 + (25 + 4*21 + 10)*2, rect),4);
  assert.equal(rowFromPointer(99,rect),-1);
  assert.equal(rowFromPointer(100 + 141*2,rect),-1);
});
test("single direct tap navigates via original input events: no D-pad", async() => {
  const events=[];
  const adapter=createTouchAdapter(async(key,down)=>events.push([key,down]),{sleep:async()=>{}});
  await adapter.openMenu();
  await adapter.tapMenuRow(3); // Network is fourth row in actual Flipper MAIN menu
  assert.deepEqual(events.filter(e=>e[1]).map(e=>e[0]),["view","down","down","down","ok"]);
  for(let i=0;i<events.length;i+=2)assert.deepEqual(events[i+1],[events[i][0],false]);
  assert.equal(adapter.state().menuOpen,false);
});
test("concurrent taps serialized; invalid rows rejected",async()=>{
  const events=[];
  const adapter=createTouchAdapter(async(k,d)=>{events.push([k,d]);},{sleep:async()=>{}});
  await Promise.all([adapter.openMenu(),adapter.tapMenuRow(1)]);
  assert.deepEqual(events.filter(e=>e[1]).map(e=>e[0]),["view","down","ok"]);
  await assert.rejects(adapter.tapMenuRow(5),RangeError);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {chromium} from "playwright-core";

const proof = process.env.ZERO_TOUCH_PROOF || "flipper-phone-poc/zero-touch-proof";
const base = process.env.ZERO_TOUCH_URL || "http://127.0.0.1:8878";
const output = path.join(proof, "browser-touch-mock.png");
const eventLog = path.join(proof, "browser-events.jsonl");
fs.mkdirSync(proof, {recursive:true});

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
try {
  const context = await browser.newContext({
    viewport: {width:390,height:844}, isMobile:true, hasTouch:true,
    deviceScaleFactor:1
  });
  const page = await context.newPage();
  const errors=[];
  page.on("pageerror", e=> errors.push(e.message));

  await page.goto(base, {waitUntil:"domcontentloaded"});
  await page.waitForFunction(() => Number(document.querySelector("#lcd")?.dataset.frames) > 0,
    null, {timeout:15000});
  assert.equal(await page.locator("h1").textContent(), "Flipper Phone");
  assert.equal(await page.locator(".dpad, [data-k]").count(), 0, "no D-pad");
  assert.equal(await page.locator("#connection").textContent(), "LIVE");

  const panel = page.locator("#lcd");
  const box = await panel.boundingBox();
  assert(box && box.width > 150 && box.height > 50);

  function events(){
    if (!fs.existsSync(eventLog)) return [];
    return fs.readFileSync(eventLog,"utf8").trim().split("\n").filter(Boolean).map(s=>JSON.parse(s));
  }
  async function awaitEvents(n){
    for (let k=0;k<60;k++){
      if (events().length >= n) return events();
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error("Expected " + n + " hardware button events; got " + JSON.stringify(events()));
  }
  async function swipe(x1,y1,x2,y2){
    await page.mouse.move(x1,y1);
    await page.mouse.down();
    await page.mouse.move(x2,y2,{steps:5});
    await page.mouse.up();
  }

  // Actual Playwright touch tap through browser DOM -> local bridge -> mock monitor.
  await panel.tap();
  let seen=await awaitEvents(1);
  assert.equal(seen[0].key,"ok");

  await swipe(box.x+box.width/2,box.y+box.height*.70,
    box.x+box.width/2,box.y+box.height*.15);
  seen=await awaitEvents(2);
  assert.equal(seen[1].key,"up");

  await swipe(box.x+8,box.y+box.height*.50,box.x+105,box.y+box.height*.50);
  seen=await awaitEvents(3);
  assert.equal(seen[2].key,"back", "left-edge swipe must not be interpreted as right");

  await page.mouse.move(box.x+box.width*.50,box.y+box.height*.50);
  await page.mouse.down();
  await new Promise(resolve=>setTimeout(resolve,660));
  await page.mouse.up();
  seen=await awaitEvents(4);
  assert.equal(seen[3].key,"ok");
  assert(seen[3].hold_ms>=550 && seen[3].hold_ms<=1200);

  await page.locator("#back").tap();
  seen=await awaitEvents(5);
  assert.equal(seen[4].key,"back");

  await page.screenshot({path:output,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log("PASS: browser touch tap, vertical swipe, edge back, long press, Back button");
  console.log("PASS: authentic framebuffer viewer layout without D-pad (browser mock only)");
  console.log("EXPLICIT: browser test uses a mock monitor; ARM64 workflow exercises REAL firmware separately");
  await context.close();
} finally {
  await browser.close();
}

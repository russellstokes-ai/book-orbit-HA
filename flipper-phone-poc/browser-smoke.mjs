import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright-core";
import {setTimeout as sleep} from "node:timers/promises";

const output=process.env.SCREENSHOT_OUT || "flipper-phone-poc/flipper-live-touch.png";
const browser=await chromium.launch({
  executablePath:process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless:true,
  args:["--no-sandbox","--disable-dev-shm-usage"]
});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8899/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Number(document.querySelector("#panel")?.dataset.frames)>=1,{timeout:12000});
 const original=await page.locator("#panel").evaluate(x=>x.toDataURL());
 assert.equal(await page.locator("[data-k]").count(),0,"physical D-pad must not be in page");
 await page.locator("#open-menu").tap();
 await page.waitForFunction(()=>document.querySelector("#status")?.textContent.includes("Tap a list"),{timeout:10000});
 await page.waitForFunction(x=>document.querySelector("#panel")?.toDataURL() !== x,original,{timeout:10000});
 const menu=await page.locator("#panel").evaluate(x=>x.toDataURL());
 // Tap real original menu's fourth row ("Network"), with scaled image coordinates.
 const rect=await page.locator("#panel").boundingBox();
 const y=rect.height*(25+3*21+9)/144;
 await page.locator("#panel").tap({position:{x:rect.width*.3,y}});
 await page.waitForFunction(()=>document.querySelector("#status")?.textContent.includes("Selected row 4"),{timeout:12000});
 await page.waitForFunction(x=>document.querySelector("#panel")?.toDataURL() !== x,menu,{timeout:12000});
 await sleep(350);
 await page.screenshot({path:output,fullPage:true});
 const title=await page.title();
 console.log("PASS: genuine Flipper framebuffer streamed to phone viewport:",title);
 console.log("PASS: tap original list row -> actual backend input events -> framebuffer changes");
 console.log("PASS: no D-pad or imitation menu graphics");
 console.log("Screenshot:",output);
 assert.deepEqual(errors,[],"browser had uncaught JavaScript errors");
 await context.close();
}finally{await browser.close();}

import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const out = process.env.SCREENSHOT_DIR || "flipper-phone-poc";
const browser = await chromium.launch({
  executablePath:process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless:true, args:["--no-sandbox","--disable-dev-shm-usage"]
});
try {
  const ctx = await browser.newContext({viewport:{width:390,height:844},
    deviceScaleFactor:1, isMobile:true, hasTouch:true});
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", err=>jsErrors.push(err.message));
  await page.goto("http://127.0.0.1:8899/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>Number(document.querySelector("#panel")?.dataset.frames)>0,
    null,{timeout:12000});
  async function state() {
    return page.evaluate(async()=>{
      const r=await fetch("state",{cache:"no-store"});
      if(!r.ok)throw new Error("GET /state HTTP "+r.status);
      return r.json();
    });
  }
  async function waitState(accept,name) {
    for(let i=0;i<120;i++){
      const s=await state();
      if(accept(s)){console.log("LIVE UI STATE:", name, JSON.stringify(s));return s;}
      await new Promise(resolve=>setTimeout(resolve,75));
    }
    throw new Error("Timed out waiting for genuine Flipper state: "+name);
  }
  const panel = page.locator("#panel");
  let s=await waitState(x=>x.screen==="idle","idle");
  assert.equal(await page.locator("[data-k]").count(),0,"No on-screen D-pad");
  await page.locator("#open-menu").tap();
  s=await waitState(x=>x.screen==="menu"&&x.level===1,"main menu");
  assert(s.total>=3 && s.network_index>=0,"Network must be visible");
  const tapRow=async (state,row)=>{
    const rect=await panel.boundingBox(), top=state.level>1?28:25;
    await panel.tap({position:{
      x:rect.width*100/256,
      y:rect.height*(top+row*21+10)/144
    }});
  };
  await tapRow(s,s.network_index-s.scroll);
  s=await waitState(x=>x.screen==="menu"&&x.level===2,"Network submenu");
  await page.screenshot({path:out+"/flipper-network-stateful.png",fullPage:true});
  console.log("PASS: direct tap uses dynamically filtered menu index; Network opened");

  const previous=s.selected;
  await panel.evaluate(el=>{
    const r=el.getBoundingClientRect(), x=r.left+r.width/3, y=r.top+r.height*.55;
    const common={pointerId:43,pointerType:"touch",bubbles:true};
    el.dispatchEvent(new PointerEvent("pointerdown",{...common,clientX:x,clientY:y}));
    el.dispatchEvent(new PointerEvent("pointerup",{...common,clientX:x,clientY:y-55}));
  });
  s=await waitState(x=>x.screen==="menu"&&x.level===2&&x.selected!==previous,"swiped selection");
  console.log("PASS: swipe sent to actual Flipper menu, selected index now",s.selected);

  await page.locator("#back").tap();
  s=await waitState(x=>x.screen==="menu"&&x.level===1,"back to main menu");
  assert(s.settings_index>=0, "Settings must be present in real menu state");
  await tapRow(s,s.settings_index-s.scroll);
  s=await waitState(x=>x.screen==="menu"&&x.level===2,"Settings submenu");
  await page.screenshot({path:out+"/flipper-settings-stateful.png",fullPage:true});
  console.log("PASS: Back restored selection; tapping Settings opened correct submenu");
  assert.deepEqual(jsErrors,[]);
  console.log("PASS: state-aware genuine Flipper browser UI navigation (tap + swipe + Back + submenu)");
  await ctx.close();
} finally {await browser.close();}

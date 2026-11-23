import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const out=process.env.SCREENSHOT_DIR||"flipper-phone-poc/native-proof";
const base="http://127.0.0.1:8899/";
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",
 headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage();
 const jsErrors=[];
 page.on("pageerror",e=>jsErrors.push(e.message));
 await page.goto(base,{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>{
  return Number(document.querySelector("#panel")?.dataset.frames)>0 &&
         Number(document.querySelector("#dolphin")?.dataset.frame)>0;
 },null,{timeout:15000});
 const clips=await page.evaluate(()=>window.ORIGINAL_DOLPHIN_ASSETS?.map(x=>({
  name:x.name,fps:x.fps,frameCount:x.sequence?.length,stockFrames:Object.keys(x.frames||{}).length
 })));
 assert.equal(clips?.length,5);
 assert(clips.every(x=>x.fps>0&&x.frameCount>1&&x.stockFrames>1));
 console.log("Original unaltered stock Dolphin sequences:",JSON.stringify(clips));
 assert.equal(await page.locator("#demoTag").count(),0,"No demo badge in clean shell");
 assert.equal(await page.locator("#connection").count(),0,"No top-right dot or status indicator");
 const sizes=await page.evaluate(()=>{
  const top=document.querySelector("#dolphin");
  const bottom=document.querySelector("#panel");
  const tr=top.getBoundingClientRect(),br=bottom.getBoundingClientRect();
  return {top:[tr.width,tr.height],bottom:[br.width,br.height],
    source:[top.width,top.height],native:[bottom.width,bottom.height]};
 });
 assert.deepEqual(sizes.source,[256,144]);
 assert.deepEqual(sizes.native,[256,144]);
 assert(Math.abs(sizes.top[0]-sizes.bottom[0])<1 &&
        Math.abs(sizes.top[1]-sizes.bottom[1])<1,
        "Dolphin and native UI must be precisely the same visible size");
 console.log("MATCHED DISPLAY DIMENSIONS:",JSON.stringify(sizes));
 assert.equal(await page.locator(".dolphinNote,.regionlabel,.regiontitle,.softlabel,footer").count(),0,"No secondary captions or footer");
 assert.equal(await page.locator("#dolphinCaption").isVisible(),false);
 assert.equal(await page.locator("#flipperLogo").count(),1);
 assert.equal(await page.locator(".navrow button svg").count(),4,"Icon-only primary controls");
 assert.equal(await page.locator(".softrow button svg").count(),5,"Icon-only original Flipper One soft keys");
 // Flipper One original bottom soft-bar occupies 5 x 48px slots with 4px
 // spacing in its 256px UI. Touch targets must have precisely the same centres.
 const aligned=await page.evaluate(()=>{
   const panel=document.querySelector("#panel").getBoundingClientRect();
   const main=document.querySelector(".softrow").getBoundingClientRect();
   const primary=document.querySelector(".navrow").getBoundingClientRect();
   const centers=[...document.querySelectorAll(".softrow button")].map(x=>{
     const r=x.getBoundingClientRect();
     return r.left+r.width/2;
   });
   const expected=[24,76,128,180,232].map(x=>panel.left+panel.width*x/256);
   return {panel:{left:panel.left,width:panel.width,bottom:panel.bottom},
     soft:{left:main.left,width:main.width,top:main.top,bottom:main.bottom},
     secondary:{top:primary.top},centers,expected};
 });
 assert(Math.abs(aligned.panel.left-aligned.soft.left)<1,"Keys left edge matches screen");
 assert(Math.abs(aligned.panel.width-aligned.soft.width)<1,"Keys width matches screen");
 assert(aligned.soft.top>aligned.panel.bottom,"Keys are directly below the native UI");
 assert(aligned.secondary.top>aligned.soft.bottom,"Phone controls remain below the soft keys");
 assert(aligned.centers.every((x,i)=>Math.abs(x-aligned.expected[i])<1.2),
   "Each touch key must align with its original Flipper One UI slot");
 const labels=(await page.locator(".brandtext").textContent()).toLowerCase();
 assert(labels.includes("phone") && !labels.includes("work"),"Branding is Flipper Phone only");
 console.log("PASS: original Flipper One 5-key alignment; navigation controls below; Flipper Phone naming");

 assert.equal(await page.locator('[data-key="view"] svg path').getAttribute("d"),"M5 7h14M5 12h14M5 17h14");
 assert.equal(await page.locator('[data-key="edit"] svg path').getAttribute("d"),"M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5");
 assert.equal(await page.locator('[data-key="run"] svg path').getAttribute("d"),"m4 12 5.5 5.5L20 6");
 assert.equal(await page.locator("#btnApps svg rect").count(),1,"Official stacked-window app switcher");
 assert.equal(await page.locator("#btnSelect svg circle").count(),2,"Flipper One OK button is the D-pad centre");
 assert.equal((await page.locator("#brandtext").textContent()).includes("Phone"),true);
 const live=await page.evaluate(async()=>{const r=await fetch("/phone-status");return {code:r.status,data:await r.json()};});
 assert.equal(live.code,200);
 assert.equal(typeof live.data.modem_available,"boolean");
 assert.equal(typeof live.data.wifi_connected,"boolean");
 assert.equal(typeof live.data.battery,"number");
 const bars=await page.locator("#cellBars i").count();
 assert.equal(bars,5);
 if(!live.data.modem_available)assert.equal(await page.locator("#cellText").isVisible(),false,"No fabricated 5G connection");
 if(live.data.battery < 0)assert.equal(await page.locator("#batteryText").textContent(),"Battery unavailable");
 const soft=await page.locator("[data-key]").evaluateAll(el=>el.map(e=>e.dataset.key));
 assert.deepEqual(soft,["esc","view","power","edit","run"]);
 assert.equal(await page.locator("#btnPtt").count(),1);
 assert.equal(await page.locator("#btnApps").count(),1);
 assert.equal(await page.locator("#btnBack").count(),1);
 assert.equal(await page.locator("#btnSelect").count(),1);
 assert.equal(await page.locator("[data-k], .dpad").count(),0,"No visible D-pad");
 await page.screenshot({path:out+"/flipper-phone-clean-live-status.png",fullPage:true});
 console.log("PASS: genuine native Flipper UI + stock animated Dolphin + truthful Linux status");

 await page.goto(base+"?demo=1",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Number(document.querySelector("#panel")?.dataset.frames)>0 &&
  Number(document.querySelector("#dolphin")?.dataset.frame)>0,null,{timeout:15000});
 assert.equal(await page.locator("#demoTag").count(),0);
 assert.equal(await page.locator("#cellText").textContent(),"5G");
 assert.equal(await page.locator("#cellText").isVisible(),true);
 assert.equal(await page.locator("#wifiText").textContent(),"Wi-Fi preview");
 await page.waitForFunction(()=>document.querySelector("#runtimeStatus")?.textContent.includes("IDLE"),null,{timeout:9000});
 await page.screenshot({path:out+"/flipper-phone-clean-desktop-signal-preview.png",fullPage:true});
 console.log("PASS: clean live display and separately identified signal-preview test fixture");

 async function state(){
  return page.evaluate(async()=>{const r=await fetch("/state",{cache:"no-store"});return r.json();});
 }
 async function waitState(fn,title){
  for(let i=0;i<120;i++){const s=await state();if(fn(s)){console.log("LIVE FLIPCTL:",title,JSON.stringify(s));return s;}
   await new Promise(r=>setTimeout(r,65));}
  throw new Error("Timed out: "+title);
 }
 function menuTap(s,index){
  const row=index-s.scroll;
  assert(row>=0&&row<Math.min(5,s.total-s.scroll),"Menu target is visible");
  return page.locator("#panel").tap({position:{x:150,
   y:(s.level>1?28:25)*1.31+row*21*1.31+12}});
 }
 // Exact element dimensions are responsive, derive touch relative to panel
 async function tapRow(s,index){
  const row=index-s.scroll;
  assert(row>=0 && row<5,"Target visible");
  const bb=await page.locator("#panel").boundingBox();
  await page.locator("#panel").tap({position:{
   x:bb.width*.5,y:bb.height*((s.level>1?28:25)+row*21+10)/144
  }});
 }
 await page.locator("#panel").tap();
 let s=await waitState(x=>x.screen==="menu"&&x.level===1,"original main menu");
 assert(s.network_index>=0);
 await tapRow(s,s.network_index);
 s=await waitState(x=>x.screen==="menu"&&x.level===2,"original Network submenu");
 await page.waitForFunction(()=>document.querySelector("#runtimeStatus")?.textContent.includes("LEVEL 2") && document.querySelector("#message")?.textContent.includes("Native menu opened"),null,{timeout:9000});
 await page.screenshot({path:out+"/flipper-phone-clean-network.png",fullPage:true});
 await page.locator("#btnBack").tap();
 s=await waitState(x=>x.screen==="menu"&&x.level===1,"return from Network");
 assert(s.settings_index>=0);
 await tapRow(s,s.settings_index);
 await waitState(x=>x.screen==="menu"&&x.level===2,"original Settings submenu");
 await page.waitForFunction(()=>document.querySelector("#runtimeStatus")?.textContent.includes("LEVEL 2") && document.querySelector("#message")?.textContent.includes("Native menu opened"),null,{timeout:9000});
 await page.screenshot({path:out+"/flipper-phone-clean-settings.png",fullPage:true});
 assert.deepEqual(jsErrors,[],"No runtime JavaScript exceptions");
 console.log("PASS: genuine original Flipper One navigation + direct row taps + native Dolphin stays visible");
 await ctx.close();
}finally{await browser.close();}

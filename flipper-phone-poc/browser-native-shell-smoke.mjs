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
 assert.equal(await page.locator("#demoTag").isVisible(),false,"Live status cannot show demo readings");
 const live=await page.evaluate(async()=>{const r=await fetch("/phone-status");return {code:r.status,data:await r.json()};});
 assert.equal(live.code,200);
 assert.equal(typeof live.data.modem_available,"boolean");
 assert.equal(typeof live.data.wifi_connected,"boolean");
 assert.equal(typeof live.data.battery,"number");
 const bars=await page.locator("#cellBars i").count();
 assert.equal(bars,5);
 if(!live.data.modem_available)assert.equal(await page.locator("#cellText").textContent(),"No service");
 const soft=await page.locator("[data-key]").evaluateAll(el=>el.map(e=>e.dataset.key));
 assert.deepEqual(soft,["esc","view","power","edit","run"]);
 assert.equal(await page.locator("#btnPtt").count(),1);
 assert.equal(await page.locator("#btnApps").count(),1);
 assert.equal(await page.locator("#btnBack").count(),1);
 assert.equal(await page.locator("#btnSelect").count(),1);
 assert.equal(await page.locator("[data-k], .dpad").count(),0,"No visible D-pad");
 await page.screenshot({path:out+"/flipper-phone-native-live-status.png",fullPage:true});
 console.log("PASS: genuine native Flipper UI + stock animated Dolphin + truthful Linux status");

 await page.goto(base+"?demo=1",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Number(document.querySelector("#panel")?.dataset.frames)>0 &&
  Number(document.querySelector("#dolphin")?.dataset.frame)>0,null,{timeout:15000});
 assert.equal(await page.locator("#demoTag").isVisible(),true);
 assert.equal(await page.locator("#cellText").textContent(),"5G");
 assert.equal(await page.locator("#wifiText").textContent(),"Wi-Fi");
 await page.screenshot({path:out+"/flipper-phone-native-desktop-demo-signals.png",fullPage:true});
 console.log("PASS: UI demo clearly labelled, not mistaken for actual phone signal");

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
 await page.locator("#openMenu").tap();
 let s=await waitState(x=>x.screen==="menu"&&x.level===1,"original main menu");
 assert(s.network_index>=0);
 await tapRow(s,s.network_index);
 s=await waitState(x=>x.screen==="menu"&&x.level===2,"original Network submenu");
 await page.screenshot({path:out+"/flipper-phone-native-network.png",fullPage:true});
 await page.locator("#btnBack").tap();
 s=await waitState(x=>x.screen==="menu"&&x.level===1,"return from Network");
 assert(s.settings_index>=0);
 await tapRow(s,s.settings_index);
 await waitState(x=>x.screen==="menu"&&x.level===2,"original Settings submenu");
 await page.screenshot({path:out+"/flipper-phone-native-settings.png",fullPage:true});
 assert.deepEqual(jsErrors,[],"No runtime JavaScript exceptions");
 console.log("PASS: genuine original Flipper One navigation + direct row taps + native Dolphin stays visible");
 await ctx.close();
}finally{await browser.close();}

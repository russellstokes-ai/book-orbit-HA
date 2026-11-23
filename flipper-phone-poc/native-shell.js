/* Flipper Phone native/Linux UI shell: genuine Flipper One stream and stock Dolphin frames.
   The production architecture is native FlipCTL; this test harness is a touchscreen
   browser presentation of its unchanged Rust/Slint renderer, NOT a Flipper emulator. */
(() => {
  "use strict";
  const q = x => document.querySelector(x);
  const canvas = q("#panel");
  const status = q("#message");
  const conn = q("#connection");
  const modeLabel = q("#modeLabel");
  const api = FlipperPhoneStateTouch;
  const stream = new GreyBlitter(canvas.getContext("2d"), 256, 144, [255, 130, 0]);
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  const catalog = window.ORIGINAL_DOLPHIN_ASSETS || [];
  let doing = Promise.resolve(), lastMenu = null, pointer = null;
  let currentAnimation = 0, active = false, activeFrames = 0, frameCursor = 0;
  let frameTimer = null, switchTimer = null;
  let displayedAnimation = "";

  async function post(key, down) {
    const response = await fetch("input", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({key,down})
    });
    if (!response.ok) throw new Error("Key rejected: "+ key+" HTTP "+response.status);
  }
  const state = async () => {
    const response = await fetch("state", {cache:"no-store"});
    if(!response.ok) throw new Error("State unavailable");
    return response.json();
  };
  const adapter = api.createStateTouchAdapter(post,state);
  const sleep = ms => new Promise(r => setTimeout(r,ms));
  function report(message, bad=false) {
    status.textContent = message;
    status.classList.toggle("error",!!bad);
  }
  function action(job) {
    const outcome = doing.catch(()=>{}).then(job);
    doing = outcome.catch(e=>report(e.message,true));
    return doing;
  }
  async function pulse(key, hold=70) {
    await post(key,true);
    try { await sleep(hold); }
    finally { await post(key,false); }
    await sleep(75);
  }
  const input = (key, label) => action(async () => {
    await pulse(key);
    report((label || key.toUpperCase())+" · original Flipper One input");
  });
  const modeNames = {idle:"Desktop",menu:"Navigation",detail:"Detail",apps:"Applications"};
  async function refreshState(){
    try {
      const s=await state();
      lastMenu=s;
      modeLabel.textContent=modeNames[s.screen]||s.screen;
      q("#runtimeStatus").textContent=s.screen==="menu"
        ? "SELECTED "+(s.selected+1)+" / "+s.total+" · LEVEL "+s.level
        : "GENUINE FLIPCTL · "+s.screen.toUpperCase();
    }catch(e){modeLabel.textContent="Offline";}
  }
  q("#btnBack").addEventListener("click",()=>input("back","Back"));
  q("#btnApps").addEventListener("click",()=>input("appsw","App Switcher"));
  q("#btnSelect").addEventListener("click",()=>input("ok","Select"));
  q("#btnPtt").addEventListener("pointerdown",ev=>{
    ev.preventDefault(); ev.currentTarget.setPointerCapture(ev.pointerId);
    action(()=>post("ptt",true));
  });
  const releasePtt=()=>action(()=>post("ptt",false));
  q("#btnPtt").addEventListener("pointerup",releasePtt);
  q("#btnPtt").addEventListener("pointercancel",releasePtt);
  document.querySelectorAll("[data-key]").forEach(button=>{
    button.addEventListener("click",()=>input(button.dataset.key,button.textContent.trim()));
  });
  q("#openMenu").addEventListener("click",()=>action(async()=>{
    await adapter.openMenu();await refreshState();report("Opened genuine Flipper One menu");
  }));
  canvas.addEventListener("pointerdown",e=>{
    if(pointer)return;
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointercancel",()=>{pointer=null;});
  canvas.addEventListener("pointerup",e=>{
    if(!pointer || pointer.id!==e.pointerId)return;
    const delta=e.clientY-pointer.y,deltaX=e.clientX-pointer.x;
    pointer=null;
    action(async()=>{
      const s=await adapter.snapshot();
      if(Math.abs(delta)>24 || Math.abs(deltaX)>38){
        if(Math.abs(deltaX)>Math.abs(delta)){
          await pulse(deltaX>0?"right":"left");
        }else if(s.screen==="menu"){
          await adapter.swipe(delta<0?1:-1);
        }else{
          await pulse(delta<0?"up":"down");
        }
        report("Native navigation swipe");
      }else if(s.screen==="menu"){
        const row=api.menuRowAt(e.clientY,canvas.getBoundingClientRect(),s);
        if(row>=0){
          const result=await adapter.tapVisibleRow(row);
          report(result.navigated?"Opened original menu item":"Original menu selection activated");
        }
      }else if(s.screen==="idle"){
        await adapter.openMenu();
        report("Opened native Flipper menu");
      }else{
        await pulse("ok");report("Original OK input");
      }
      await refreshState();
    });
  });

  // Stock PNG frames, original Flipper Zero firmware asset bytes; supplied
  // by a pinned-source build script. No drawn, generated or inferred animations.
  const dolphin=q("#dolphin");
  const dc=dolphin.getContext("2d",{alpha:false});
  dc.imageSmoothingEnabled=false;
  const imageCache=new Map();
  function loadImage(src){
    if(!imageCache.has(src)){
      const im=new Image();im.src=src;imageCache.set(src,im);
    }
    return imageCache.get(src);
  }
  function playNext(){
    if(!catalog.length){q("#dolphinCaption").textContent="Stock frames unavailable";return;}
    const animation=catalog[currentAnimation%catalog.length];
    if(!animation)return;
    displayedAnimation=animation.name;
    q("#dolphinCaption").textContent="ORIGINAL • "+animation.label;
    const sequence=animation.sequence||[];
    const passive=animation.passive||sequence.length;
    let frameIndex=0, tick=0;
    const step=async()=>{
      if(displayedAnimation!==animation.name)return;
      const idx=sequence[frameIndex%sequence.length];
      const src=animation.frames[idx];
      if(!src)return;
      const img=loadImage(src);
      if(!img.complete){
        await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;});
      }
      dc.fillStyle="#ffffff";dc.fillRect(0,0,128,64);
      if(img.naturalWidth&&img.naturalHeight){
        // Source pixels are preserved; only the 1-bit screen palette is
        // converted from the original white/black PNG to Flipper amber/black.
        dc.drawImage(img,0,Math.floor((64-img.naturalHeight)/2));
        const pixels=dc.getImageData(0,0,128,64);
        for(let p=0;p<pixels.data.length;p+=4){
          const v=pixels.data[p];
          pixels.data[p]=v;
          pixels.data[p+1]=Math.round(v*130/255);
          pixels.data[p+2]=0;
        }
        dc.putImageData(pixels,0,0);
        dolphin.dataset.frame=String(tick+1);
        dolphin.dataset.animation=animation.name;
      }
      frameIndex=(frameIndex+1)%sequence.length;
      tick++;
    };
    clearInterval(frameTimer);
    step().catch(e=>report("Original animation: "+e.message,true));
    frameTimer=setInterval(()=>step().catch(e=>report(e.message,true)),
      Math.round(1000/Math.max(1,Math.min(30,animation.fps||2))));
    clearTimeout(switchTimer);
    // Original frame rate and sequence; the phone shell cycles between
    // original clips rather than keeping a 3600-second stock animation open.
    switchTimer=setTimeout(()=>{
      currentAnimation=(currentAnimation+1)%catalog.length;
      playNext();
    },14000);
  }
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){clearInterval(frameTimer);clearTimeout(switchTimer);}
    else playNext();
  });
  playNext();

  function drawBars(element,level){
    element.innerHTML="";
    for(let i=0;i<5;i++){
      const x=document.createElement("i");
      x.style.height=(5+i*3)+"px";
      if(level!==null && i<Math.ceil(level/20))x.classList.add("on");
      element.append(x);
    }
  }
  async function loadStatus(){
    if(demo){
      q("#demoTag").hidden=false;
      q("#wifiText").textContent="Wi-Fi";drawBars(q("#wifiBars"),76);
      q("#cellText").textContent="5G";drawBars(q("#cellBars"),68);
      q("#batteryText").textContent="82%";
      return;
    }
    try{
      const r=await fetch("phone-status",{cache:"no-store"});
      if(!r.ok)throw new Error("No native status");
      const d=await r.json();
      q("#demoTag").hidden=true;
      if(d.wifi_connected){
        q("#wifiText").textContent="Wi-Fi";
        drawBars(q("#wifiBars"),d.wifi_quality);
      }else{
        q("#wifiText").textContent="Wi-Fi off";
        drawBars(q("#wifiBars"),null);
      }
      if(d.modem_available&&d.access_tech!=="--"){
        q("#cellText").textContent=d.access_tech;
        drawBars(q("#cellBars"),d.modem_quality);
      }else{
        q("#cellText").textContent="No service";
        drawBars(q("#cellBars"),null);
      }
      q("#batteryText").textContent=d.battery>=0?d.battery+"%":"--%";
      q("#batteryIcon").classList.toggle("charging",!!d.charging);
    }catch(e){
      q("#wifiText").textContent="Wi-Fi --"; drawBars(q("#wifiBars"),null);
      q("#cellText").textContent="No service";drawBars(q("#cellBars"),null);
      q("#batteryText").textContent="--%";
    }
  }
  loadStatus();
  setInterval(loadStatus,2500);
  refreshState();
  setInterval(refreshState,1000);
  flipperStream((grey,x,y,w,h)=>{
    stream.draw(grey,x,y,w,h);
    canvas.dataset.frames=String((Number(canvas.dataset.frames)||0)+1);
  },(text,ok)=>{
    conn.textContent=ok?"CONNECTED":text.toUpperCase();
    conn.dataset.active=ok?"true":"false";
  });
})();
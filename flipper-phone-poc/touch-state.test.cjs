const test = require("node:test");
const assert = require("node:assert/strict");
const { createStateTouchAdapter, menuRowAt } = require("./touch-state.js");

function sim() {
  // Deliberately filtered real-like main menu: Apps and old testing screen absent.
  const pages = [
    {screen:"menu", labels:["Desktop Computer","Files","Network","Settings"], selected:0,scroll:0,level:1},
    {screen:"menu", labels:["Airplane mode","Routing info","5G Modem","Wi-Fi","Ethernet","Network info"],selected:0,scroll:0,level:2}
  ];
  let screen="idle", level=0, selected=0, scroll=0, mainPick=0;
  const events =[];
  function state(){
    const page=pages[Math.max(0,level-1)];
    return {screen,level,selected,scroll,total:screen==="menu"?page.labels.length:0,visible_rows:5,
      network_index: screen==="menu"&&level===1 ? 2:-1,
      settings_index: screen==="menu"&&level===1 ? 3:-1};
  }
  async function post(key,down){
    events.push({key,down});
    if(!down) return;
    if(key==="view" && screen==="idle"){screen="menu";level=1;selected=0;scroll=0;return;}
    if(screen!=="menu")return;
    const n=state().total;
    if(key==="up")selected=(selected+n-1)%n;
    if(key==="down")selected=(selected+1)%n;
    if(selected>=scroll+5) scroll=selected-4;
    if(selected<scroll)scroll=selected;
    if(key==="ok"&&level===1&&selected===2){mainPick=selected;level=2;selected=0;scroll=0;}
    if(key==="ok"&&level===1&&selected===3){mainPick=selected;level=2;selected=0;scroll=0;}
    if(key==="back"){
      if(level===2){level=1;selected=mainPick;scroll=0;}
      else{level=0;screen="idle";}
    }
  }
  return {post,state,events};
}

test("direct tap uses *live* selected index, not assumed zero",async()=>{
  const s=sim();
  const ui=createStateTouchAdapter(s.post,async()=>s.state(),{sleep:async()=>{}});
  const menu=await ui.openMenu();
  assert.equal(menu.screen,"menu");
  const target=menu.network_index;
  const outcome=await ui.tapVisibleRow(target);
  assert.equal(outcome.navigated,true);
  assert.equal(s.state().level,2);
  assert.deepEqual(s.events.filter(e=>e.down).map(e=>e.key),["view","down","down","ok"]);
  await ui.swipe(1);
  assert.equal(s.state().selected,1);
  await ui.back();
  assert.equal(s.state().level,1);
  assert.equal(s.state().selected,2);
  const settings=await ui.tapVisibleRow(s.state().settings_index);
  assert.equal(settings.navigated,true);
  assert.deepEqual(s.events.filter(e=>e.down).slice(-2).map(e=>e.key),["down","ok"]);
});

test("scroll and offset hit-testing follow actual submenu geometry",async()=>{
  const s=sim();
  const ui=createStateTouchAdapter(s.post,async()=>s.state(),{sleep:async()=>{}});
  await ui.openMenu();
  await ui.tapVisibleRow(s.state().network_index);
  for(let n=0;n<5;n++) await ui.swipe(1);
  assert.equal(s.state().selected,5);
  assert.equal(s.state().scroll,1);
  // Submenu starts at 28px in the real Flipper 256x144 panel.
  const rect={top:100,height:288};
  assert.equal(menuRowAt(100+(28+4*21+8)*2,rect,s.state()),4);
  assert.equal(menuRowAt(105,rect,s.state()),-1);
});

test("invalid touch is rejected, and next touch can still execute",async()=>{
 const s=sim();
 const ui=createStateTouchAdapter(s.post,async()=>s.state(),{sleep:async()=>{}});
 await ui.openMenu();
 await assert.rejects(ui.tapVisibleRow(9),RangeError);
 const res=await ui.tapVisibleRow(2);
 assert.equal(res.to.level,2);
});

test("nonmenu panels are protected against accidental row tapping",async()=>{
 const s=sim();
 const ui=createStateTouchAdapter(s.post,async()=>s.state(),{sleep:async()=>{}});
 assert.equal(menuRowAt(200,{top:100,height:288},s.state()),-1);
 await assert.rejects(ui.tapVisibleRow(1),/Menu is not/);
 await ui.openMenu();
 assert.equal(s.state().screen,"menu");
});

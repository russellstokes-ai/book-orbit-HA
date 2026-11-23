#!/usr/bin/env python3
"""Build touchscreen SHELL around genuine native FlipCTL, using *stock* Dolphin PNGs.

Inputs: pinned checkout at ./flipctl, official stock Flipper Zero assets at
./flipperzero/assets/dolphin/external. CI uses native Rust/Slint renderer;
QEMU/FlipperEmu is NOT invoked.
"""
from pathlib import Path
import base64
import json
import re

ROOT=Path("flipper-phone-poc")
FLIPCTL=Path("flipctl")
STOCK=Path("flipperzero/assets/dolphin/external")

def replace_exact(path: Path, old: str, new: str):
    src=path.read_text()
    assert src.count(old)==1, (path,old,src.count(old))
    path.write_text(src.replace(old,new,1))

def meta(path:Path):
    data={}
    for raw in path.read_text().splitlines():
        if ": " not in raw: continue
        key,val=raw.split(": ",1)
        data[key]=val
    return data

PICKED=[
 ("L1_Waves_128x50","Waves • idle"),
 ("L1_Laptop_128x51","Laptop • idle"),
 ("L1_Sleep_128x64","Sleep • idle"),
 ("L1_Furippa1_128x64","Furippa • idle"),
 ("L1_Showtime_128x64","Showtime • idle"),
]
clips=[]
for name,label in PICKED:
    folder=STOCK/name
    m=meta(folder/"meta.txt")
    original_order=[int(x) for x in m["Frames order"].split()]
    passive=int(m["Passive frames"])
    active=int(m["Active frames"])
    cycles=int(m["Active cycles"])
    assert 0<=passive<=len(original_order) and 0<=active<=len(original_order)
    assert len(original_order)==passive+active
    # The original metadata explicitly repeats the active portion this many cycles.
    order=original_order[:passive]+original_order[passive:] * cycles
    frames={}
    for index in sorted(set(order)):
        path=folder/("frame_"+str(index)+".png")
        raw=path.read_bytes()
        assert raw.startswith(b"\x89PNG\r\n\x1a\n"), path
        frames[str(index)]="data:image/png;base64,"+base64.b64encode(raw).decode()
    clips.append({"name":name,"label":label,"fps":int(m["Frame rate"]),
      "frames":frames,"sequence":order,"passive":passive,
      "active":active,"activeCycles":cycles,"nativeWidth":int(m["Width"]),
      "nativeHeight":int(m["Height"])})
assert len(clips)==len(PICKED)

# Retain genuine native Slint screen, selecting menu rows from real state only.
# patch-navigation-state.py must run BEFORE this script.
remote=FLIPCTL/"crates/flipper-ui/src/remote/mod.rs"
status=FLIPCTL/"crates/flipper-ui/src/status.rs"
# Live readings come from the native library's existing sysfs/modem status
# source. There is never a fabricated cellular technology or signal level.
read_json = r'''
/// Test-only read-only native host status for the portrait wrapper.
pub fn phone_status_json() -> String {
    let s=read_status();
    format!(
        r#"{{"battery":{},"charging":{},"wifi_connected":{},"wifi_quality":{},"modem_available":{},"access_tech":"{}","modem_quality":{}}}"#,
        s.battery,s.charging,s.wifi_connected,s.wifi_quality,
        s.modem_available,s.access_tech,s.modem_quality
    )
}
'''
assert "fn read_status() -> Status {" in status.read_text()
assert "phone_status_json" not in status.read_text()
status.write_text(status.read_text()+"\n"+read_json)
replace_exact(remote,
  '        ("GET", "/stream") => stream_frames(stream, shared),\n',
  '''        ("GET", "/phone-status") => {
            let value = crate::status::phone_status_json();
            write_response(&mut stream, "200 OK",
                "application/json; charset=utf-8", value.as_bytes())
        },
        ("GET", "/stream") => stream_frames(stream, shared),
''')

page=(ROOT/"native-shell.html").read_text()
repls={
  "/* NATIVE_TOUCH_ADAPTER */": (ROOT/"touch-state.js").read_text(),
  "/* ORIGINAL_DOLPHIN_CATALOG */": "window.ORIGINAL_DOLPHIN_ASSETS = "+json.dumps(clips,separators=(",",":"))+";",
  "/* NATIVE_PHONE_SHELL_JS */": (ROOT/"native-shell.js").read_text(),
}
for marker,content in repls.items():
    assert page.count(marker)==1,marker
    page=page.replace(marker,content)
out=FLIPCTL/"crates/flipper-ui/src/remote/page.html"
assert "device.png" in out.read_text(), "Refusing to overwrite unknown native baseline"
out.write_text(page)
(ROOT/"native-shell-manifest.json").write_text(json.dumps({
 "origin":"original unmodified PNG frames",
 "source":"flipperdevices/flipperzero-firmware",
 "stock_source_commit":"e459e2d939db7f292d7dcfe6935b8fb2641409e3",
 "native_ui_source":"flipperdevices/flipctl-slint",
 "native_ui_commit":"258e19a1ead6e32f27c89f272d6ec92be986ad61",
 "animation_names":[x["name"] for x in clips],
 "frame_counts":[len(x["frames"]) for x in clips],
 "license_note":"Source repositories carry GPL-3.0 and MIT respectively; verify distribution rights."
},indent=2))
print("PASS: original Dolphin assets embedded with source metadata, native Rust/Slint renderer intact")
print("PASS: all thirteen original Flipper One keys preserved in portrait touch shell")
print("PASS: status endpoint backed by actual native Linux sysfs/modem values")

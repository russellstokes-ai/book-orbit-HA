#!/usr/bin/env python3
"""Apply an isolated navigation-state probe to freshly checked-out Flipper source.

This is a *test-only* patch for the GitHub runner. Upstream Flipper code remains
unchanged in its original repository and on all user project main branches.
"""
from pathlib import Path

remote = Path("flipctl/crates/flipper-ui/src/remote/mod.rs")
main = Path("flipctl/bin/flipctl/src/main.rs")

def replace_one(path, old, new):
    data = path.read_text()
    count = data.count(old)
    assert count == 1, f"{path}: anchor occurs {count} times, expected 1"
    path.write_text(data.replace(old, new, 1))
    print(f"Patched {path}: {old[:75]!r}")

replace_one(remote,
    "    running: Mutex<Vec<String>>,\n",
    "    running: Mutex<Vec<String>>,\n"
    "    /// Test-only state snapshot for direct-touch navigation.\n"
    "    nav_state: Mutex<String>,\n")
replace_one(remote,
    "            running: Mutex::new(Vec::new()),\n",
    '            running: Mutex::new(Vec::new()),\n'
    '            nav_state: Mutex::new(r#"{\"screen\":\"unknown\"}"#.into()),\n')
replace_one(remote,
    "    pub fn set_running(&self, names: Vec<String>) {\n",
    "    pub fn set_nav_state(&self, snapshot: String) {\n"
    "        if let Ok(mut state) = self.shared.nav_state.lock() {\n"
    "            *state = snapshot;\n"
    "        }\n"
    "    }\n\n"
    "    pub fn set_running(&self, names: Vec<String>) {\n")
replace_one(remote,
    '        ("GET", "/stream") => stream_frames(stream, shared),\n',
    '        ("GET", "/state") => {\n'
    '            let value = shared.nav_state.lock().map(|s| s.clone())\n'
    '                .unwrap_or_else(|_| "{}".to_string());\n'
    '            write_response(&mut stream, "200 OK",\n'
    '                "application/json; charset=utf-8", value.as_bytes())\n'
    '        },\n'
    '        ("GET", "/stream") => stream_frames(stream, shared),\n')

replace_one(main,
    "        screen.set_scroll(scroll);\n",
    """        screen.set_scroll(scroll);
        // Test-only metadata: read from the *real* menu state after runtime filtering.
        // This does not change the genuine Slint renderer or any UI assets.
        #[cfg(feature = "remote")]
        if let Some(view) = web.as_mut() {
            let kind = format!("{:?}", screen.get_screen()).to_ascii_lowercase();
            let rows = if kind == "menu" {
                demo::rows(stack.last().unwrap().0)
            } else {
                Vec::new()
            };
            let total = rows.len();
            let network_index = rows.iter()
                .position(|r| r.label == "Network")
                .map_or(-1i32, |i| i as i32);
            let settings_index = rows.iter()
                .position(|r| r.label == "Settings")
                .map_or(-1i32, |i| i as i32);
            let snapshot = format!(
                r#"{{"screen":"{}","selected":{},"scroll":{},"total":{},"level":{},"visible_rows":5,"network_index":{},"settings_index":{}}}"#,
                kind, selected, scroll, total, stack.len(), network_index, settings_index
            );
            view.set_nav_state(snapshot);
        }
""")
print("Test-only navigation-state API ready. Flipper's UI assets and menus untouched.")

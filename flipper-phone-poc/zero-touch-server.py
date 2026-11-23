#!/usr/bin/env python3
"""Local-only HTTP/touch bridge for the REAL Flipper Zero firmware in FlipperEmu.

The displayed PNG is the QEMU framebuffer captured through FlipperEmu's
upstream fe_monitor.Monitor class. Button events are sent to that same
monitor: no rewritten firmware, UI assets, or pretend device state.

Usage (after the emulator starts):
  python3 flipper-phone-poc/zero-touch-server.py \
    --monitor flipperemu/devices/touchproof/monitor.sock \
    --fe-monitor flipperemu/scripts/fe_monitor.py
Then open http://127.0.0.1:8877 on the SAME machine.
"""
from __future__ import annotations
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import tempfile
from io import BytesIO
from PIL import Image
import threading
from urllib.parse import urlsplit

ALLOWED_KEYS = frozenset(("ok", "back", "up", "down", "left", "right"))
ROOT = Path(__file__).resolve().parent


class FlipperBridge:
    def __init__(self, monitor_path: Path, upstream_monitor: Path, event_log: Path | None):
        self.monitor_path = str(monitor_path.resolve())
        spec = importlib.util.spec_from_file_location("flipperemu_fe_monitor", upstream_monitor)
        if spec is None or spec.loader is None:
            raise RuntimeError("Cannot load pinned FlipperEmu monitor module")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.monitor_cls = module.Monitor
        self.lock = threading.Lock()
        self.event_log = event_log
        if self.event_log:
            self.event_log.parent.mkdir(parents=True, exist_ok=True)

    def _connect(self):
        return self.monitor_cls(self.monitor_path, timeout=5.0)

    def healthy(self) -> bool:
        with self.lock:
            mon = self._connect()
            try:
                return "running" in mon.cmd("info status").lower()
            finally:
                mon.close()

    def frame(self) -> bytes:
        with self.lock, tempfile.TemporaryDirectory(prefix="flipper-lcd-") as tmp:
            mon = self._connect()
            try:
                output = Path(tmp) / "real-lcd.png"
                mon.screenshot(str(output))
                # FlipperEmu's QEMU screenshot is 544x312: a 512x256
                # 4x-native LCD plus a bezel and battery/status strip.
                # Crop ONLY the genuine display pixels; never stretch it.
                with Image.open(output) as screenshot:
                    if screenshot.size == (544, 312):
                        display = screenshot.crop((16, 16, 528, 272))
                    elif screenshot.size in ((512, 256), (128, 64)):
                        display = screenshot.copy()
                    else:
                        raise RuntimeError("Unknown QEMU framebuffer size: " +
                                           str(screenshot.size))
                    buffer = BytesIO()
                    display.save(buffer, format="PNG")
                    result = buffer.getvalue()
                if not result.startswith(b"\x89PNG\r\n\x1a\n") or len(result) < 100:
                    raise RuntimeError("FlipperEmu returned invalid display data")
                return result
            finally:
                mon.close()

    def press(self, key: str, hold_ms: int):
        with self.lock:
            mon = self._connect()
            try:
                mon.press(key, hold_ms)
            finally:
                mon.close()
            if self.event_log:
                with self.event_log.open("a", encoding="utf-8") as file:
                    file.write(json.dumps({"key": key, "hold_ms": hold_ms}) + "\n")


class TouchHandler(BaseHTTPRequestHandler):
    server_version = "FlipperPhoneTouch/0.1"

    def _response(self, status: int, mime: str, data: bytes):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' blob:; "
                         "style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; "
                         "base-uri 'none'; object-src 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(data)

    def _json(self, status: int, obj):
        self._response(status, "application/json; charset=utf-8",
                       json.dumps(obj, separators=(",", ":")).encode("utf-8"))

    def _valid_host(self):
        host = self.headers.get("Host", "").split(":")[0].lower()
        return host in ("127.0.0.1", "localhost")

    def _valid_origin(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True  # curl/CLI checks do not send Origin
        port = self.server.server_address[1]
        return origin in (f"http://127.0.0.1:{port}", f"http://localhost:{port}")

    def do_GET(self):
        if not self._valid_host():
            return self._json(403, {"error": "Localhost only"})
        path = urlsplit(self.path).path
        if path == "/":
            return self._response(200, "text/html; charset=utf-8",
                                  (ROOT / "zero-touch.html").read_bytes())
        if path == "/zero-touch.js":
            return self._response(200, "text/javascript; charset=utf-8",
                                  (ROOT / "zero-touch.js").read_bytes())
        if path == "/health":
            try:
                live = self.server.bridge.healthy()
                return self._json(200 if live else 503, {
                    "ok": live, "source": "genuine FlipperEmu QEMU monitor"})
            except (OSError, RuntimeError, ConnectionError) as err:
                return self._json(503, {"ok": False, "error": type(err).__name__})
        if path == "/frame.png":
            try:
                return self._response(200, "image/png", self.server.bridge.frame())
            except (OSError, RuntimeError, ConnectionError) as err:
                return self._json(503, {"ok": False, "error": type(err).__name__})
        return self._json(404, {"error": "Not found"})

    def do_POST(self):
        if not self._valid_host() or not self._valid_origin():
            return self._json(403, {"error": "Same-origin localhost required"})
        if urlsplit(self.path).path != "/key":
            return self._json(404, {"error": "Not found"})
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            return self._json(415, {"error": "JSON required"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= 256:
                return self._json(413, {"error": "Invalid JSON size"})
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("JSON object required")
            key, hold_ms = payload.get("key"), payload.get("hold_ms", 120)
            if key not in ALLOWED_KEYS or type(hold_ms) is not int or not 80 <= hold_ms <= 1200:
                return self._json(400, {"error": "Invalid button or hold duration"})
            self.server.bridge.press(key, hold_ms)
            return self._json(200, {"ok": True, "key": key, "hold_ms": hold_ms})
        except (ValueError, TypeError, json.JSONDecodeError):
            return self._json(400, {"error": "Malformed command"})
        except (OSError, RuntimeError, ConnectionError) as err:
            return self._json(503, {"ok": False, "error": type(err).__name__})

    def log_message(self, fmt, *args):
        # Diagnostic output has endpoint names, never any personal information.
        print("touch-http", self.address_string(), fmt % args, flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--monitor", required=True, type=Path, help="FlipperEmu monitor.sock path")
    ap.add_argument("--fe-monitor", required=True, type=Path,
                    help="Pinned upstream FlipperEmu scripts/fe_monitor.py path")
    ap.add_argument("--event-log", type=Path, help="Optional JSONL of accepted keys for QA")
    ap.add_argument("--port", type=int, default=8877)
    args = ap.parse_args()
    bridge = FlipperBridge(args.monitor, args.fe_monitor, args.event_log)
    # Do not publish a powerful hardware-control API to the local network.
    server = ThreadingHTTPServer(("127.0.0.1", args.port), TouchHandler)
    server.bridge = bridge
    print(f"Flipper Phone genuine LCD/touch at http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

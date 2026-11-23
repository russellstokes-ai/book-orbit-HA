#!/usr/bin/env python3
"""End-to-end checks against actual FlipperEmu, not a simulated firmware UI."""
from pathlib import Path
import json
import os
import struct
import urllib.error
import urllib.request

ROOT = os.environ.get("ZERO_TOUCH_URL", "http://127.0.0.1:8877")
OUT = Path(os.environ.get("ZERO_TOUCH_PROOF", "flipper-phone-poc/zero-touch-proof"))
OUT.mkdir(parents=True, exist_ok=True)


def request(path, payload=None, origin=None):
    headers = {}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if origin is not None:
        headers["Origin"] = origin
    req = urllib.request.Request(
        ROOT + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers=headers,
        method="POST" if payload is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as err:
        return err.code, err.headers, err.read()


def frame(name):
    status, headers, data = request("/frame.png")
    assert status == 200, (name, status, data[:150])
    assert headers.get_content_type() == "image/png", headers
    assert data.startswith(b"\x89PNG\r\n\x1a\n"), name
    width, height = struct.unpack(">II", data[16:24])
    assert 64 <= width <= 1920 and 32 <= height <= 1080, (width, height)
    assert len(data) > 200, (name, len(data))
    (OUT / name).write_bytes(data)
    print("Genuine Flipper framebuffer:", name, width, height, len(data), "bytes")


def main():
    status, _, data = request("/health")
    assert status == 200 and json.loads(data)["ok"], (status, data)
    for path, expected in (("/", b'id="lcd"'), ("/zero-touch.js", b"gestureToCommand")):
        status, _, data = request(path)
        assert status == 200 and expected in data, (path, status)
    frame("genuine-idle.png")

    keys = ["ok", "down", "up", "right", "left", "back"]
    for key in keys:
        status, _, data = request("/key", {"key": key, "hold_ms": 120},
                                  origin=ROOT)
        response = json.loads(data)
        assert status == 200 and response.get("ok") and response.get("key") == key, (status, data)
        print("QEMU hardware input accepted:", key)

    frame("genuine-after-gestures.png")

    for invalid in ({"key": "poweroff", "hold_ms": 120},
                    {"key": "ok", "hold_ms": 20000},
                    {"key": "ok", "hold_ms": True}):
        status, _, data = request("/key", invalid)
        assert status == 400, (invalid, status, data)
    status, _, _ = request("/key", {"key": "ok", "hold_ms": 120},
                            origin="https://unexpected.example")
    assert status == 403, status

    log = OUT / "events.jsonl"
    events = [json.loads(row) for row in log.read_text().splitlines()]
    assert [e["key"] for e in events] == keys, events
    assert all(e["hold_ms"] == 120 for e in events)
    print("PASS: authentic Flipper Zero ARM64 framebuffer, QEMU inputs, and local API safety")


if __name__ == "__main__":
    main()

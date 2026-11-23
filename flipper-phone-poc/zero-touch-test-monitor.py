"""Test-only substitute for FlipperEmu's QEMU monitor; NEVER real firmware."""
from pathlib import Path
from PIL import Image, ImageDraw

class Monitor:
    def __init__(self, path, timeout=5.0):
        self.path = path

    def close(self):
        pass

    def cmd(self, line):
        assert line == "info status"
        return "VM status: running"

    def press(self, key, hold_ms=120):
        assert key in ("up", "down", "left", "right", "ok", "back")

    def screenshot(self, path):
        im = Image.new("RGB", (128, 64), "#ff9f44")
        draw = ImageDraw.Draw(im)
        draw.rectangle([0, 0, 127, 63], outline="#241c19", width=2)
        draw.text((10, 23), "BROWSER MOCK", fill="#241c19")
        im.save(path)
        return path

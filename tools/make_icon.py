"""Draws the pack icon (a film frame around a crafting table) into both packs."""
import pathlib
from PIL import Image, ImageDraw

root = pathlib.Path(__file__).resolve().parent.parent
img = Image.new("RGBA", (128, 128), (18, 18, 24, 255))
d = ImageDraw.Draw(img)
# letterbox bars with film perforations
for y0 in (0, 108):
    d.rectangle([0, y0, 127, y0 + 19], fill=(0, 0, 0, 255))
    for x in range(6, 128, 16):
        d.rectangle([x, y0 + 6, x + 7, y0 + 13], fill=(70, 70, 80, 255))
# crafting table
d.rectangle([34, 34, 94, 94], fill=(140, 96, 52, 255))
d.rectangle([34, 34, 94, 46], fill=(178, 128, 74, 255))
for x in (44, 64, 84):
    d.line([x, 34, x, 46], fill=(110, 74, 40, 255), width=2)
d.rectangle([44, 56, 60, 72], fill=(96, 64, 34, 255))
d.rectangle([68, 56, 84, 72], fill=(96, 64, 34, 255))
# warm key light
d.polygon([(100, 22), (127, 22), (127, 50)], fill=(255, 200, 90, 160))
for pack in ("CinematicInteractions_BP", "CinematicInteractions_RP"):
    img.save(root / pack / "pack_icon.png")
print("icons written")

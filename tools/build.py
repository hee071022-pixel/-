"""Builds dist/*.mcpack and dist/CinematicInteractions.mcaddon."""
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
dist = root / "dist"
dist.mkdir(exist_ok=True)
packs = ["CinematicInteractions_BP", "CinematicInteractions_RP"]

for pack in packs:
    for f in (root / pack).rglob("*.json"):
        json.loads(f.read_text(encoding="utf-8"))  # fail fast on bad JSON


def add_pack(zf, pack, prefix):
    for f in sorted((root / pack).rglob("*")):
        if f.is_file():
            zf.write(f, prefix + f.relative_to(root / pack).as_posix())


for pack in packs:
    with zipfile.ZipFile(dist / f"{pack}.mcpack", "w", zipfile.ZIP_DEFLATED) as zf:
        add_pack(zf, pack, "")

with zipfile.ZipFile(dist / "CinematicInteractions.mcaddon", "w", zipfile.ZIP_DEFLATED) as zf:
    for pack in packs:
        add_pack(zf, pack, pack + "/")

print("built:", ", ".join(p.name for p in sorted(dist.iterdir())))

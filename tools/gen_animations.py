"""Generates CinematicInteractions_RP/animations/cinematic.animation.json.

Rotations are additive on top of the vanilla player pose. Negative X on an arm
swings it forward/up. Molang trig functions take degrees.
"""
import json
import pathlib

T = "query.anim_time"


def rot(x="0", y="0", z="0"):
    return {"rotation": [x, y, z]}


LOOPS = {
    # Crafting table / loom / cartography table: alternating hands working the surface.
    "craft": {
        "head": rot("22"),
        "body": rot("6", f"math.sin({T} * 90) * 4"),
        "rightArm": rot(f"-62 + math.sin({T} * 540) * 18", "-8", "4"),
        "leftArm": rot(f"-55 - math.sin({T} * 540) * 14", "10", "-4"),
    },
    # Furnace / smoker / blast furnace: feeding fuel, slow pushing motion.
    "smelt": {
        "head": rot("18"),
        "body": rot("10"),
        "rightArm": rot(f"-58 + math.sin({T} * 160) * 12", "-6", "0"),
        "leftArm": rot("-35", "12", "-6"),
    },
    # Anvil / smithing table: heavy hammer strikes.
    "hammer": {
        "head": rot("24"),
        "body": rot(f"6 + math.abs(math.sin({T} * 200)) * 6"),
        "rightArm": rot(f"-150 + math.abs(math.sin({T} * 200)) * 105", "-10", "6"),
        "leftArm": rot("-48", "18", "-6"),
    },
    # Enchanting table: both hands hovering above the book, slow float.
    "enchant": {
        "head": rot(f"12 + math.sin({T} * 60) * 3"),
        "rightArm": rot(f"-82 + math.sin({T} * 90) * 6", "-14", f"6 + math.sin({T} * 70) * 4"),
        "leftArm": rot(f"-82 + math.cos({T} * 90) * 6", "14", f"-6 - math.sin({T} * 70) * 4"),
    },
    # Lectern: holding pages open, occasional page flick with the right hand.
    "read": {
        "head": rot(f"26 + math.sin({T} * 40) * 2", f"math.sin({T} * 30) * 6"),
        "rightArm": rot("-52", f"-20 + math.pow(math.abs(math.sin({T} * 45)), 8) * 45", "8"),
        "leftArm": rot("-52", "20", "-8"),
    },
    # Campfire: warming hands, rubbing palms.
    "warm": {
        "head": rot("16"),
        "body": rot("8"),
        "rightArm": rot("-68", f"-18 + math.sin({T} * 420) * 7", "4"),
        "leftArm": rot("-68", f"18 + math.sin({T} * 420) * 7", "-4"),
    },
    # Beacon: looking up, arms raised toward the beam.
    "beacon": {
        "head": rot(f"-38 + math.sin({T} * 50) * 3"),
        "body": rot("-4"),
        "rightArm": rot(f"-158 + math.sin({T} * 70) * 5", "0", "14"),
        "leftArm": rot(f"-158 + math.cos({T} * 70) * 5", "0", "-14"),
    },
    # Grindstone: cranking the wheel in circles.
    "grind": {
        "head": rot("18"),
        "rightArm": rot(f"-60 + math.sin({T} * 300) * 26", f"math.cos({T} * 300) * 18", "4"),
        "leftArm": rot("-40", "14", "-6"),
    },
    # Stonecutter: careful two-handed sliding.
    "cut": {
        "head": rot("24"),
        "body": rot("6"),
        "rightArm": rot(f"-56 + math.sin({T} * 220) * 10", f"-12 + math.sin({T} * 220) * 10", "0"),
        "leftArm": rot(f"-56 + math.sin({T} * 220) * 10", f"12 + math.sin({T} * 220) * 10", "0"),
    },
    # Brewing stand: gentle stirring/pouring.
    "brew": {
        "head": rot("20"),
        "rightArm": rot(f"-70 + math.sin({T} * 130) * 6", "-10", f"math.sin({T} * 260) * 8"),
        "leftArm": rot("-32", "16", "-8"),
    },
}

ONESHOT = {
    # Jukebox: reach in, place disc, pull back.
    "jukebox": {
        "length": 2.0,
        "bones": {
            "head": {"rotation": {"0.0": [0, 0, 0], "0.4": [22, 0, 0], "1.5": [18, 0, 0], "2.0": [0, 0, 0]}},
            "rightArm": {"rotation": {
                "0.0": [0, 0, 0], "0.5": [-85, -10, 0], "0.9": [-70, -10, 0],
                "1.4": [-25, 0, 0], "2.0": [0, 0, 0]}},
            "leftArm": {"rotation": {"0.0": [0, 0, 0], "0.6": [-20, 8, 0], "2.0": [0, 0, 0]}},
        },
    },
}

anims = {}
for name, bones in LOOPS.items():
    anims[f"animation.cinematic_interactions.{name}"] = {"loop": True, "bones": bones}
for name, data in ONESHOT.items():
    anims[f"animation.cinematic_interactions.{name}"] = {
        "animation_length": data["length"],
        "bones": data["bones"],
    }
# Short empty animation used to replace a looping one on the same controller.
anims["animation.cinematic_interactions.reset"] = {"animation_length": 0.05}

out = pathlib.Path(__file__).resolve().parent.parent / "CinematicInteractions_RP/animations/cinematic.animation.json"
out.write_text(json.dumps({"format_version": "1.8.0", "animations": anims}, indent=2, ensure_ascii=False) + "\n")
print(f"wrote {out}")

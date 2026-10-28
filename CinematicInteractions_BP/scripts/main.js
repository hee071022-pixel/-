import { world, system, EasingType, Player } from "@minecraft/server";

// ---------------------------------------------------------------------------
// Station table
//   anim  : animation suffix defined in the resource pack
//   ui    : true if the block opens a screen; the shot is held until the
//           player moves or looks around again (i.e. the screen was closed)
//   ticks : shot length for blocks without a screen
//   sound : extra ambience played once when the shot starts
// ---------------------------------------------------------------------------
const STATIONS = {
  "minecraft:crafting_table": { anim: "craft", ui: true, sound: "dig.wood" },
  "minecraft:loom": { anim: "craft", ui: true, sound: "dig.wood" },
  "minecraft:cartography_table": { anim: "craft", ui: true, sound: "dig.wood" },
  "minecraft:furnace": { anim: "smelt", ui: true, sound: "block.furnace.lit" },
  "minecraft:lit_furnace": { anim: "smelt", ui: true, sound: "block.furnace.lit" },
  "minecraft:smoker": { anim: "smelt", ui: true, sound: "block.smoker.smoke" },
  "minecraft:lit_smoker": { anim: "smelt", ui: true, sound: "block.smoker.smoke" },
  "minecraft:blast_furnace": { anim: "smelt", ui: true, sound: "block.blastfurnace.fire_crackle" },
  "minecraft:lit_blast_furnace": { anim: "smelt", ui: true, sound: "block.blastfurnace.fire_crackle" },
  "minecraft:anvil": { anim: "hammer", ui: true, sound: "random.anvil_use" },
  "minecraft:chipped_anvil": { anim: "hammer", ui: true, sound: "random.anvil_use" },
  "minecraft:damaged_anvil": { anim: "hammer", ui: true, sound: "random.anvil_use" },
  "minecraft:smithing_table": { anim: "hammer", ui: true, sound: "smithing_table.use" },
  "minecraft:enchanting_table": { anim: "enchant", ui: true, sound: "block.enchanting_table.use" },
  "minecraft:lectern": { anim: "read", ui: true, sound: "item.book.page_turn" },
  "minecraft:beacon": { anim: "beacon", ui: true, sound: "beacon.ambient" },
  "minecraft:grindstone": { anim: "grind", ui: true, sound: "grindstone.use" },
  "minecraft:stonecutter_block": { anim: "cut", ui: true, sound: "dig.stone" },
  "minecraft:brewing_stand": { anim: "brew", ui: true, sound: "random.pop" },
  "minecraft:jukebox": { anim: "jukebox", ui: false, ticks: 50 },
  "minecraft:campfire": { anim: "warm", ui: false, ticks: 80, sound: "block.campfire.crackle" },
  "minecraft:soul_campfire": { anim: "warm", ui: false, ticks: 80, sound: "block.campfire.crackle" },
};

const ANIM_PREFIX = "animation.cinematic_interactions.";
const ANIM_CONTROLLER = "cinematic_interactions";

const EASE_IN_SECONDS = 0.9;
const DRIFT_SECONDS = 12;
const EASE_OUT_SECONDS = 0.6;
const UI_GRACE_TICKS = 6; // ignore small adjustments right after the click
const UI_MAX_TICKS = 20 * 60 * 3; // safety net: never hold a shot longer than 3 min
const MAX_DISTANCE = 8;

// Player settings (dynamic properties)
const PROP_ENABLED = "ci:enabled";
const PROP_STYLE = "ci:style"; // "orbit" | "shoulder" | "front"
const PROP_HUD = "ci:hide_hud";
const STYLES = ["orbit", "shoulder", "front"];

/** @type {Map<string, Shot>} player id -> active shot */
const shots = new Map();

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const lerp = (a, b, t) => add(a, scale(sub(b, a), t));
const len = (a) => Math.hypot(a.x, a.y, a.z);

function flatDir(from, to) {
  const d = { x: to.x - from.x, y: 0, z: to.z - from.z };
  const l = Math.hypot(d.x, d.z);
  return l < 1e-4 ? { x: 0, y: 0, z: 1 } : { x: d.x / l, y: 0, z: d.z / l };
}

function rotateY(v, deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c };
}

function angleDelta(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function getSetting(player, key, fallback) {
  const v = player.getDynamicProperty(key);
  return v === undefined ? fallback : v;
}

function isEnabled(player) {
  return getSetting(player, PROP_ENABLED, true) === true;
}

// ---------------------------------------------------------------------------
// Camera placement
// ---------------------------------------------------------------------------
function isClear(dimension, pos) {
  try {
    const block = dimension.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
    return !block || block.isAir || block.isLiquid;
  } catch {
    return false; // unloaded / out of world
  }
}

function hasLineOfSight(dimension, from, to, skip) {
  const steps = Math.max(2, Math.ceil(len(sub(to, from)) * 2));
  for (let i = 1; i < steps; i++) {
    const p = lerp(from, to, i / steps);
    const key = `${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;
    if (skip.has(key)) continue;
    if (!isClear(dimension, p)) return false;
  }
  return true;
}

/**
 * Picks a camera position that frames both the player and the station.
 * Tries a list of angles around the pair and returns the first one with a
 * clear view, falling back to an over-the-shoulder shot.
 */
function planShot(player, block, style) {
  const dim = player.dimension;
  const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
  const feet = player.location;
  const head = player.getHeadLocation();
  const forward = flatDir(feet, center); // player -> block
  const back = scale(forward, -1);

  const focus = { ...lerp(head, center, 0.55), y: (head.y + center.y) / 2 };

  // The player's own blocks and the station never block the view.
  const skip = new Set([
    `${block.location.x},${block.location.y},${block.location.z}`,
    `${Math.floor(feet.x)},${Math.floor(feet.y)},${Math.floor(feet.z)}`,
    `${Math.floor(head.x)},${Math.floor(head.y)},${Math.floor(head.z)}`,
  ]);

  // [yaw offset from behind the player, distance, height above focus]
  const plans = {
    orbit: [[55, 3.4, 1.3], [-55, 3.4, 1.3], [80, 3.0, 1.1], [-80, 3.0, 1.1], [35, 2.8, 1.6], [-35, 2.8, 1.6]],
    shoulder: [[22, 2.2, 0.9], [-22, 2.2, 0.9], [40, 2.0, 0.8], [-40, 2.0, 0.8]],
    front: [[150, 3.0, 1.0], [-150, 3.0, 1.0], [120, 3.0, 1.2], [-120, 3.0, 1.2]],
  };
  const candidates = [...(plans[style] ?? plans.orbit), ...plans.shoulder, [0, 1.4, 0.6]];

  for (const [yaw, dist, height] of candidates) {
    const dir = rotateY(back, yaw);
    const pos = add(add(focus, scale(dir, dist)), { x: 0, y: height, z: 0 });
    if (!isClear(dim, pos) || !hasLineOfSight(dim, pos, focus, skip)) continue;

    // Slow dolly for the "held" part of the shot: drift a bit further around.
    const driftDir = rotateY(back, yaw + Math.sign(yaw || 1) * 14);
    const drift = add(add(focus, scale(driftDir, dist * 0.92)), { x: 0, y: height * 0.9, z: 0 });
    const useDrift = isClear(dim, drift) && hasLineOfSight(dim, drift, focus, skip);
    return { pos, drift: useDrift ? drift : undefined, focus };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Shot lifecycle
// ---------------------------------------------------------------------------
class Shot {
  constructor(player, block, station, plan) {
    this.player = player;
    this.station = station;
    this.blockType = block.typeId;
    this.blockLoc = { ...block.location };
    this.plan = plan;
    this.age = 0;
    this.startLoc = { ...player.location };
    this.startRot = player.getRotation();
    this.hidHud = false;
    this.ending = false;
  }

  start() {
    const { player, plan, station } = this;
    player.camera.setCamera("minecraft:free", {
      location: plan.pos,
      facingLocation: plan.focus,
      easeOptions: { easeTime: EASE_IN_SECONDS, easeType: EasingType.InOutSine },
    });

    if (getSetting(player, PROP_HUD, true) === true) {
      this.hidHud = runQuiet(player, "hud @s hide all");
    }

    player.playAnimation(ANIM_PREFIX + station.anim, {
      controller: ANIM_CONTROLLER,
      blendOutTime: 0.35,
      stopExpression: station.ui ? "0" : undefined,
    });

    if (station.sound) {
      player.dimension.playSound(station.sound, this.blockLoc, { volume: 0.6, pitch: 0.9 + Math.random() * 0.2 });
    }
  }

  tick() {
    const { player, plan, station } = this;
    this.age++;

    if (this.age === Math.round(EASE_IN_SECONDS * 20) && plan.drift) {
      player.camera.setCamera("minecraft:free", {
        location: plan.drift,
        facingLocation: plan.focus,
        easeOptions: { easeTime: DRIFT_SECONDS, easeType: EasingType.Linear },
      });
    }

    if (!station.ui) {
      return this.age < station.ticks;
    }

    if (this.age < UI_GRACE_TICKS) {
      // Rotation/position can still settle right after the click.
      this.startLoc = { ...player.location };
      this.startRot = player.getRotation();
      return true;
    }
    if (this.age > UI_MAX_TICKS) return false;

    // While a screen is open the player can neither move nor turn, so any
    // movement means the screen was closed.
    const rot = player.getRotation();
    if (angleDelta(rot.x, this.startRot.x) > 6 || angleDelta(rot.y, this.startRot.y) > 6) return false;
    if (len(sub(player.location, this.startLoc)) > 0.25) return false;
    if (player.isSneaking || player.isJumping) return false;

    // Station broken or player pushed away.
    try {
      const block = player.dimension.getBlock(this.blockLoc);
      if (!block || block.typeId !== this.blockType) return false;
    } catch {
      return false;
    }
    if (len(sub(player.location, this.blockLoc)) > MAX_DISTANCE) return false;

    return true;
  }

  end(immediate = false) {
    if (this.ending) return;
    this.ending = true;
    const { player } = this;
    if (!player.isValid) return;

    player.playAnimation(ANIM_PREFIX + "reset", { controller: ANIM_CONTROLLER, blendOutTime: 0.3 });
    if (this.hidHud) runQuiet(player, "hud @s reset all");

    if (immediate) {
      player.camera.clear();
      return;
    }

    // Glide back into the player's eyes, then hand control back.
    const head = player.getHeadLocation();
    const view = player.getViewDirection();
    player.camera.setCamera("minecraft:free", {
      location: head,
      facingLocation: add(head, scale(view, 4)),
      easeOptions: { easeTime: EASE_OUT_SECONDS, easeType: EasingType.InOutSine },
    });
    system.runTimeout(() => {
      if (player.isValid && !shots.has(player.id)) player.camera.clear();
    }, Math.round(EASE_OUT_SECONDS * 20));
  }
}

function runQuiet(player, command) {
  try {
    player.runCommand(command);
    return true;
  } catch {
    return false;
  }
}

function stopShot(player, immediate = false) {
  const shot = shots.get(player.id);
  if (!shot) return;
  shots.delete(player.id);
  shot.end(immediate);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
  if (ev.isFirstEvent === false) return; // holding the use button repeats the event
  const { player, block } = ev;
  const station = STATIONS[block.typeId];
  if (!station || player.isSneaking || !isEnabled(player)) return;

  const existing = shots.get(player.id);
  if (existing && !existing.ending) {
    const sameBlock =
      existing.blockLoc.x === block.location.x &&
      existing.blockLoc.y === block.location.y &&
      existing.blockLoc.z === block.location.z;
    if (sameBlock) return;
    stopShot(player, true);
  }

  const style = getSetting(player, PROP_STYLE, "orbit");
  const plan = planShot(player, block, style);
  if (!plan) return;

  const shot = new Shot(player, block, station, plan);
  shots.set(player.id, shot);
  shot.start();
});

system.runInterval(() => {
  for (const [id, shot] of shots) {
    if (!shot.player.isValid) {
      shots.delete(id);
      continue;
    }
    let keep = false;
    try {
      keep = shot.tick();
    } catch (e) {
      console.warn(`[Cinematic Interactions] ${e}`);
    }
    if (!keep) stopShot(shot.player);
  }
});

world.afterEvents.entityHurt.subscribe((ev) => {
  if (ev.hurtEntity instanceof Player) stopShot(ev.hurtEntity, true);
});

world.afterEvents.playerLeave.subscribe((ev) => shots.delete(ev.playerId));

world.afterEvents.playerSpawn.subscribe((ev) => {
  // Clean state after death/rejoin in case a shot was interrupted.
  if (!ev.initialSpawn) return;
  ev.player.camera.clear();
  runQuiet(ev.player, "hud @s reset all");
});

// ---------------------------------------------------------------------------
// Settings via /scriptevent
//   /scriptevent ci:toggle            on/off
//   /scriptevent ci:style orbit|shoulder|front
//   /scriptevent ci:hud               toggle hiding the HUD during shots
// ---------------------------------------------------------------------------
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  const player = ev.sourceEntity;
  if (!(player instanceof Player)) return;
  const arg = ev.message.trim().toLowerCase();

  switch (ev.id) {
    case "ci:toggle": {
      const next = !isEnabled(player);
      player.setDynamicProperty(PROP_ENABLED, next);
      if (!next) stopShot(player, true);
      player.sendMessage(`§6[Cinematic Interactions]§r ${next ? "§a켜짐" : "§c꺼짐"}`);
      break;
    }
    case "ci:style": {
      if (!STYLES.includes(arg)) {
        player.sendMessage(`§6[Cinematic Interactions]§r 사용법: /scriptevent ci:style <${STYLES.join("|")}>`);
        break;
      }
      player.setDynamicProperty(PROP_STYLE, arg);
      player.sendMessage(`§6[Cinematic Interactions]§r 카메라 스타일: §b${arg}`);
      break;
    }
    case "ci:hud": {
      const next = !getSetting(player, PROP_HUD, true);
      player.setDynamicProperty(PROP_HUD, next);
      player.sendMessage(`§6[Cinematic Interactions]§r 연출 중 HUD 숨기기: ${next ? "§a켜짐" : "§c꺼짐"}`);
      break;
    }
  }
});

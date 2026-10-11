# AGENTS.md — Rudy Dres rd4: project context

Read this before touching the repo. Companion file: [FEATURES.md](FEATURES.md) (feature/progress tracker).

## What this game is

A browser-based 2D side-scrolling beat-'em-up. You play **Rudy** ("rudy dres" = a red tracksuit guy), who walks through city streets (Polish setting: `ulica-01`, "Podwórze", "Zaułek"), fights street enemies, does simple missions, and fights bosses. Tone: gritty Polish street humor. Player-facing names and error messages are Polish.

## Game world model

- The world consists of **streets** (starting with one), each street made up of **sections** (starting with two). Sections form a sequence the player traverses back and forth — a section is a segment of the street that can be revisited, e.g. `01 → 02 → 01 → 02`.
- **On entering a section** (the `Section.enter()` pipeline):
  1. load image → 2. set boundaries → 3. generate standard NPCs → 4. generate enemies → 5. check boss conditions → 6. check interactions.
- **On exiting a section**: standard NPCs → reset, standard enemies → reset, bodies → reset. Quests, inventory, money and world flags → **do not reset** (they live in the global `State`, along with stats).
- This deliberately sets up moments like *"Oh, I came back here and things are different now."* — what spawns in a section can depend on quests and world flags (see boss `conditions` in the street JSON).
- Section backgrounds are loaded from PNGs named `<street_name>_<section_number>.png`.

## Tech stack

- Vanilla JavaScript ES modules, Canvas 2D. **No build step, no framework, no tests, no lint.**
- Run via any static file server from the repo root (the game `fetch`es JSON, so `file://` won't work). Open `index.html`.
- Canvas is fixed 1600x800, centered on a black page.

## Architecture map

| File | Responsibility |
|---|---|
| `index.html` | Canvas shell only. |
| `src/main.js` | Bootstrap: loads street `ulica-01`, enters route index 0, spawns Rudy at (50, 598), starts loop. |
| `src/game/game.js` | `Game`: rAF loop with delta time (ms), state machine (`changeState`). |
| `src/game/play-state.js` | The gameplay state: draws bg → enemies → player, feeds input/boundaries to actors, handles section exits and shop door. |
| `src/game/shop-entry.js` | Scripted walk into a shop door (enter → hidden inside w/ sound → exit). Player has no control while active. |
| `src/world/world-manager.js` | Loads a street JSON; the street is a **route** of section ids, which may repeat (e.g. `["01","02","01"]`). One section active at a time. |
| `src/world/section.js` | One section: background, boundaries, NPCs, enemies, boss check, interactions. Transient data rebuilt on `enter()`, wiped on `leave()`. |
| `src/actors/actor.js` | Base for all characters: position, hitbox, sprite-sheet animation, `tryMove` vs solids, punch animation. |
| `src/actors/player.js` | Rudy: arrow-key movement, Space punch (holds at full extension until release). |
| `src/actors/enemy.js` | Patrol enemy: walks left from spawn, turns at first solid or at spawn point. |
| `src/input/keyboard.js` | Held keys + one-shot `consumePress`, by `e.code`. |
| `src/render/sprite-sheet.js` | Fixed square frames in rows; one row = one animation. |
| `src/save/state.js` | Persistent `State`: quests, inventory, money, flags, per-character stats (Rudy has hp/mp/etc.). Not yet serialized anywhere. |
| `src/data/streets/*.json` | Street/section definitions (see schema below). |
| `assets/bg/<street>_<section>.png` | Section backgrounds (naming convention is hardcoded in `Section`). |
| `assets/sprites/*.png` | Character sprite sheets. |
| `assets/sounds/*.mp3` | SFX. |

## Conventions (follow these, don't invent new ones)

- **Sprite sheets**: 150x150 px frames ("initially, all frames are 150x150px"), one animation per row. Row 0 = walk (8 frames). **Each attack = 4 frames**; a character has one to several attacks, packed sequentially in the attack row (row 1 currently holds 2: 0–3 right-hand punch, 4–7 left-hand punch). Walk 80 ms/frame, punch 17.5 ms/frame. `facing = -1` mirrors horizontally.
- **Combat is universal**: the same combat logic serves Rudy, standard NPCs and bosses — they differ only in their parameters (stats, attack set).
- **Hitbox**: feet area of the 150x150 frame: `{ x: 50, y: 120, w: 50, h: 25 }` (player and enemies alike).
- **Delta time is milliseconds** throughout.
- **Persistent vs transient**: quests/flags/inventory/money/stats live in global `State` and survive section changes; NPCs/enemies/boss/corpses live in `Section` and are rebuilt from JSON on every `enter()`.
- **Street JSON schema** (`src/data/streets/ulica-01.json`):
  - `street`, `route: [sectionId, ...]` (ids may repeat),
  - `sections[id]`: `name`, `exitLeft`/`exitRight` (booleans; open edges allow route traversal), `boundaries` (solid rects), `npcs`, `enemies` (`id`, `type`, `x`, `y`), `boss` (`type`, `x`, `y`, `conditions: { flagsTrue, flagsFalse }`), `interactions` (`type`: `shop` | `chest` | `door`, rect, `action`, optional `sound`).
- **Enemy types** are registered in `ENEMY_TYPES` in `src/actors/enemy.js`. Types not registered (`rat`, `thug`, `boss`) are silently skipped at spawn — data may reference them ahead of implementation.
- Coordinates: actor `x`/`y` are the **frame top-left** in world px; the section bg is drawn stretched to the full 1600x800 canvas.
- Errors and code comments are English; user-facing strings and error `throw`s are Polish.

## Content pipeline (goal)

Ultimately the game must be **configurable via files** — new content should not require code changes:

- **New section** = background PNG + section JSON + add/select characters + add quest/conditions + add audio = new section.
- **New street** = new directory under `data/streets/` (e.g. `data/streets/street-02/`). Target layout; today a street is a single JSON file at `src/data/streets/<street>.json`.

## Controls

- ← / →: walk; Space: punch (stands still while punching); ↑ at a highlighted shop door: enter shop.

## Current status (2026-10-11)

Working: walking + collision vs boundaries, section transitions along the route (Rudy re-enters at x=50 from the left / x=1450 from the right), the `lysyblokers` patrol enemy in `ulica-01/01`, punch animation + miss sound (no damage yet), shop-door highlight + scripted entry with sound (no shop UI yet).

Not implemented yet (data or scaffolding exists, behavior does not): combat damage/HP/death, other enemy types (`rat`, `thug`, boss fight), NPCs (spawned as data, never drawn), chest/door interactions, dialogue, missions/quests, HUD, save/load. Details and tracking in [FEATURES.md](FEATURES.md).

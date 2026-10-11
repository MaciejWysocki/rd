# AGENTS.md — Rudy Dres rd4: project context

Read this before touching the repo. Companion files: [FEATURES.md](FEATURES.md) (feature/progress tracker) and [PLAN.md](PLAN.md) (phased implementation plan — the workable plan to implement against).

## What this game is

A simple browser-based "karate" game — a beat-'em-up in the style of Amiga titles like *Renegade* or *Final Fight* — launched in a web browser (no installation) and played on **desktop with a keyboard**. The only playable character is **Rudy** ("rudy dres" = a red tracksuit guy), on a **real street in the owner's city** (Polish names: `ulica-01`, "Podwórze", "Zaułek"): fight enemies, complete missions, fight bosses. The two pillars are **combat and questing**. Tone: gritty Polish street humor. Player-facing names and error messages are Polish.

## Game world model

- The world consists of **streets** (starting with one), each street made up of **sections** (starting with two). Sections form a sequence the player traverses back and forth — a section is a segment of the street that can be revisited, e.g. `01 → 02 → 01 → 02`.
- **No continuous scrolling**: each section is a **static background screen** (side-view street imagery with a flat street/sidewalk strip at the bottom where characters move); the game switches screens when the player reaches a section edge (like the Atari game *Ninja*). At the **ends of the street the boundary blocks Rudy and he walks in place**.
- **On entering a section** (the `Section.enter()` pipeline):
  1. load image → 2. set boundaries → 3. generate standard NPCs → 4. generate enemies → 5. check boss conditions → 6. check interactions.
- **On exiting a section**: standard NPCs → reset, standard enemies → reset, bodies → reset. Quests, inventory, money and world flags → **do not reset** (they live in the global `State`, along with stats). There is **no save system** (session-only play): Rudy's defeat shows a game over screen with statistics, death music and a restart button (owner decision 2026-10-11; supersedes the earlier "save in the browser" expectation).
- This deliberately sets up moments like *"Oh, I came back here and things are different now."* — what spawns in a section can depend on quests and world flags (see boss `conditions` in the street JSON).
- **Missions**: one **main mission** spanning the entire street (all its sections) plus **one side quest per individual section**.
- **Bosses**: each section can have its own boss — sometimes linked to its side quest, sometimes to the main mission, or with no mission at all (just a particularly dangerous spot).
- Section backgrounds are loaded from PNGs named `<street_name>_<section_number>.png` — real **photographs** of that part of the actual street, supplied by the owner.

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

- **Sprite sheets**: 150x150 px frames ("initially, all frames are 150x150px"), one animation per row. Row 0 = walk (8 frames). **Each move/attack = its own row of 4 frames**. Walk 80 ms/frame, punch 17.5 ms/frame. `facing = -1` mirrors horizontally.
- **Moves are data-configured**: a character's config maps input keys → sprite rows (`{ key, row, type: punch|kick|headbutt }`), never hardcoded per character (PLAN.md P0.1).
- **Combat is universal**: the same combat logic serves Rudy, standard NPCs and bosses — they differ only in their parameters (stats, attack set).
- **Combat timing**: the hit is resolved at the **finish of the attack animation (full stretch)**; retreat/jump before the finish → miss (dodges are unbuffered); attack finishes within **~100 ms** of each other → RPS tie-break (headbutt > punch > kick > headbutt). Movement and attack speeds are per character.
- **No XP, no leveling**: progression and items are tied to missions; each mission gives a slight stat boost (`level`/`experience` in `State.stats` are dead weight — remove them, PLAN.md P0.7).
- **Audio layering**: street ambient → section music (overrides ambient) → boss music (overrides section music). The highest active layer wins.
- **Art and audio are produced by the owner**: frame-by-frame 2D sprites (following the sprite-sheet convention), sound effects and music. Code selects assets by naming convention only and must never depend on specific asset content.
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

Ultimately the game must be **configurable via files**: sections, enemies, NPCs and missions are defined in configuration files, and assets are selected based on **naming conventions**. The architecture must make expansion easy — adding more sections and streets later is expected to be routine.

- **New section** = background photo + section JSON + add/select characters + add quest/conditions + add audio = new section (pure file work, no code changes).
- **New street** = new directory under `data/streets/` (e.g. `data/streets/street-02/`). Target layout; today a street is a single JSON file at `src/data/streets/<street>.json`.

## Controls

Desktop keyboard; keys are **mapped per move in the character config** (PLAN.md P0.1). Current defaults:

- ← / →: walk; Space: punch (stands still while punching); ↑ at a highlighted shop door: enter shop.
- Planned (Phase 1): jump / retreat keys for timed evasion.

## Current status (2026-10-11)

Working: walking + collision vs boundaries, section transitions along the route (Rudy re-enters at x=50 from the left / x=1450 from the right), the `lysyblokers` patrol enemy in `ulica-01/01`, punch animation + miss sound (no damage yet), shop-door highlight + scripted entry with sound (no shop UI yet).

Not implemented yet (data or scaffolding exists, behavior does not): combat damage/HP/death, other enemy types (`rat`, `thug`, boss fight), NPCs (spawned as data, never drawn), chest/door interactions, dialogue, missions/quests, HUD, save/load. Details and tracking in [FEATURES.md](FEATURES.md). Next up: **Phase 0 (PoC)** in [PLAN.md](PLAN.md) — two sections, single-blow combat with HP, beer → bum boss, congratulatory message, game over screen (stats + death music + restart).

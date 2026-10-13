# AGENTS.md — Rudy Dres rd4: project context

Read this before touching the repo. Companion files: [FEATURES.md](FEATURES.md) (feature/progress tracker) and [PLAN.md](PLAN.md) (phased implementation plan — the workable plan to implement against).

## What this game is

A simple browser-based "karate" game — a beat-'em-up in the style of Amiga titles like *Renegade* or *Final Fight* — launched in a web browser (no installation) and played on **desktop with a keyboard**. The only playable character is **Rudy** ("rudy dres" = a red tracksuit guy), on a **real street in the owner's city** (Polish names: `ulica-01`, "Podwórze", "Zaułek"): fight enemies, complete missions, fight bosses. The two pillars are **combat and questing**. Tone: gritty Polish street humor. Player-facing names and error messages are Polish.

## Game world model

- The world consists of **streets** (starting with one), each street made up of **sections** (starting with two). Sections form a sequence the player traverses back and forth — a section is a segment of the street that can be revisited, e.g. `01 → 02 → 01 → 02`.
- **No continuous scrolling**: each section is a **static background screen** (side-view street imagery with a flat street/sidewalk strip at the bottom where characters move); the game switches screens when the player reaches a section edge (like the Atari game *Ninja*). At the **ends of the street the boundary blocks Rudy and he walks in place**.
- **On entering a section** (the `Section.enter()` pipeline):
  1. load image → 2. set boundaries → 3. generate standard NPCs → 4. generate enemies → 5. check boss conditions → 6. check interactions.
- **On exiting a section**: standard NPCs → reset, **living** enemies → reset. **Defeated enemies persist as corpses** (with where they fell) in the global `State` — re-entering the section still shows the body instead of a fresh enemy. Quests, inventory, money, world flags and stats → do not reset (they live in the global `State`, along with stats). There is **no save system** (session-only play): Rudy's defeat shows a game over screen with statistics, death music and a restart button (owner decision 2026-10-11; supersedes the earlier "save in the browser" expectation).
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
|`src/game/play-state.js`|The gameplay state: draws bg → enemies → player, feeds input/boundaries to actors, resolves combat, triggers the boss fight, handles section exits and the shop door.|
|`src/game/game-over-state.js`|Game over screen: statistics + death music (`game-over.mp3`) + restart button (fresh game, no saves).|
|`src/game/shop-entry.js`|Scripted walk into a shop door (enter → hidden inside w/ sound → exit). **Money-driven**: with coins the door's `sound` plays (the beer purchase) and the moment Rudy comes out the `beer` lands in the inventory and 1 coin is charged — same instant; broke, the `soundNoMoney` plays and the stay inside is only 1 s. Player has no control while active.|
| `src/world/world-manager.js` | Loads a street JSON; the street is a **route** of section ids, which may repeat (e.g. `["01","02","01"]`). One section active at a time. |
| `src/world/section.js` | One section: background, boundaries, NPCs, enemies, boss check, interactions. Transient data rebuilt on `enter()`, wiped on `leave()`. |
|`src/actors/actor.js`|Base for all characters: position, hitbox, sprite-sheet animation, `tryMove` vs solids, punch animation, HP/defeat (`takeDamage`, lying pose on death).|
|`src/actors/combat.js`|Universal strike resolution: the blow connects at the attack's full extension (hitbox-edge to hitbox-edge reach + facing vs hitboxes), 1 damage, hit interrupts the defender's blow; recovery per character (`recoveryMs`).|
|`src/actors/player.js`|Rudy: arrow-key movement (debug: holding **Shift** moves him **4× faster**), Space punch (holds at full extension until release). **No delays**: every press is a punch (`recoveryMs: 0`), presses during a blow queue up and fire right after it.|
|`src/actors/enemy.js`|Patrol enemy: walks left from spawn, turns at first solid or at spawn point; breaks the patrol to fight the player when he comes close (face → approach → attack).|
|`src/actors/boss.js`|Section boss (`boss_zul`): stands idle until its `trigger` conditions are met — while idle, an `idleOverlay` pose draws in the background instead of the sprite's first frame — then fights like an enemy and never gives up the chase; cannot be struck before the fight; defeat sets the `<id>_defeated` world flag.|
| `src/input/keyboard.js` | Held keys + one-shot `consumePress`, by `e.code`. |
| `src/render/sprite-sheet.js` | Fixed square frames in rows; one row = one animation. |
|`src/render/hud.js`|HUD overlay: hearts (1 per 1 HP) top-left, coins (1 per money unit) below, one row per carried item type below those (`assets/hud/<itemId>.png`, 1 per unit); a zero row draws nothing and collapses. **Top-right corner: the HP of the enemy in fight mode** (hearts, `isFighting`).|
|`src/save/state.js`|`State` shared across sections: quests, inventory, money, flags, runtime stats (stats and starting money seeded from the character config via `resetForNewGame`), `matchesConditions` for world-entity conditions, `defeatedEnemies` (persisted kills → corpses). No save system — session-only.|
| `src/audio/audio.js` | Convention-based sound playback (attack miss/hit, section ambient loop, boss intro + boss music, game-over death music); every file optional. |
| `src/actors/character-defs.js` | Loads `data/characters/<type>.json`; a type without a config is not implemented and is skipped at spawn. |
| `data/characters/*.json` | Character configs: stats (hp, money, walk/attack speed, `recoveryMs`, `attackHoldMs`), hitbox, sprite name, move set (key + sprite row). |
| `data/streets/*.json` | Street/section definitions (see schema below). |
| `assets/bg/<street>_<section>.png` | Section backgrounds (naming convention is hardcoded in `Section`). |
| `assets/sprites/*.png` | Character sprite sheets. |
| `assets/sounds/*.mp3` | SFX. |

## Conventions (follow these, don't invent new ones)

- **Sprite sheets**: 150x150 px frames ("initially, all frames are 150x150px"), one animation per row. Row 0 = walk (8 frames). **Each move/attack = its own row of 4 frames**. Walk 80 ms/frame, punch 17.5 ms/frame. `facing = -1` mirrors horizontally. A sheet may also carry a **death row** (`deathRow` in the character config): 4 fall frames played on defeat while the body slides a little back (opposite the facing) — e.g. `lysyblokers` row 2. Sheets without a death row fall back to a rotated placeholder pose.
- **Moves are data-configured**: a character's config maps input keys → sprite rows (`{ key, row, type: punch|kick|headbutt }`), never hardcoded per character (`data/characters/*.json`, loaded via `character-defs.js`). A move with `"alternate": true` switches between the row's two 4-frame groups on **every other attack** (e.g. Rudy's punch: frames 0–3 right hand, 4–7 left hand); without it the animation is always the same.
- **Combat is universal**: the same combat logic serves Rudy, standard NPCs and bosses — they differ only in their parameters (stats, attack set).
- **Combat timing**: the hit is resolved at the **finish of the attack animation (full stretch)**; retreat/jump before the finish → miss (dodges are unbuffered); attack finishes within **~100 ms** of each other → RPS tie-break (headbutt > punch > kick > headbutt). Movement and attack speeds are per character. **PoC rules** (`src/actors/combat.js`): 1 damage per blow and the hit interrupts the defender's blow. Recovery is per character (`recoveryMs`, default 0.7 s); **Rudy has none — every Space press is a punch and presses during a blow queue up** (owner 2026-10-12: no player delays, keep the game dynamic). Enemies hold the full-stretch frame before returning straight (`attackHoldMs`, default 0.15 s; `lysyblokers` = **0.5 s** with a slower headbutt `attackFrameMs: 75`).
- **No XP, no leveling**: progression and items are tied to missions; each mission gives a slight stat boost.
- **Audio layering**: street ambient → section music (overrides ambient) → boss music (overrides section music). The highest active layer wins.
- **Audio by convention** (`src/audio/audio.js`, files in `assets/sounds/`): `player-attack-miss`/`player-attack-hit` and `<enemyName>-attack-miss`/`<enemyName>-attack-hit` on attacks; `<who>-jump` (e.g. `player-jump`) when jumping; `<street>_<section>-ambient` loops per section (e.g. `ulica-01_01-ambient`); `boss-intro` on the boss fight intro. **Every convention file is optional — a missing file means silence.**
- **Art and audio are produced by the owner**: frame-by-frame 2D sprites (following the sprite-sheet convention), sound effects and music. Code selects assets by naming convention only and must never depend on specific asset content.
- **Hitbox**: feet area of the 150x150 frame, defined per character config (conventionally `{ x: 55, y: 120, w: 40, h: 25 }` — narrowed from 50 wide on 2026-10-13; combat measures hitbox-edge to hitbox-edge, see `combat.js`).
- **Delta time is milliseconds** throughout.
- **Persistent vs transient**: quests/flags/inventory/money/stats live in global `State` and survive section changes; NPCs/enemies/boss live in `Section` and are rebuilt from JSON on every `enter()` — except **kills**, which are persisted in `State` (`defeatedEnemies`, id → where the body lies) and reappear as corpses on re-entry.
- **Street JSON schema** (`data/streets/ulica-01.json`):
  - `street`, `route: [sectionId, ...]` (ids may repeat),
  - `sections[id]`: `name`, `exitLeft`/`exitRight` (booleans; open edges allow route traversal), `boundaries` (solid rects), `npcs`, `enemies` (`id`, `type`, `x`, `y`), `boss` (`id`, `type`, `x`, `y`, `conditions: { flagsTrue, flagsFalse, hasItem }` — spawn gate evaluated against `State`, `trigger` — same shape, gates the fight start, e.g. `{ "hasItem": ["beer"] }`, optional `idleOverlay: { image, x, y }` — boss idle pose drawn at its fixed position in the background instead of the sprite's first frame while the boss waits for its `trigger`), `interactions` (`type`: `shop` | `chest` | `door`, rect, `action`, optional `sound`/`soundNoMoney` (shop jingles: buy / no coins), optional `highlight: { image, x, y }` — shop overlay drawn at its fixed position while the player stands at the door).
- **Enemy types** are defined by `data/characters/<type>.json` (stats + move set). Types without a config file (`rat`, `thug`) are silently skipped at spawn — street JSON may reference them ahead of implementation.
- Coordinates: actor `x`/`y` are the **frame top-left** in world px; the section bg is drawn stretched to the full 1600x800 canvas.
- Errors and code comments are English; user-facing strings and error `throw`s are Polish.

## Content pipeline (goal)

Ultimately the game must be **configurable via files**: sections, enemies, NPCs and missions are defined in configuration files, and assets are selected based on **naming conventions**. The architecture must make expansion easy — adding more sections and streets later is expected to be routine.

- **New section** = background photo + section JSON + add/select characters + add quest/conditions + add audio = new section (pure file work, no code changes).
- **New street** = new directory under `data/streets/` (e.g. `data/streets/street-02/`). Target layout; today a street is a single JSON file at `src/data/streets/<street>.json`.

## Controls

Desktop keyboard; keys are **mapped per move in the character config** (`jumpKey` lives there too). Current defaults:

- ← / →: walk (keeps walking in place when blocked); Space: punch (stands still while attacking, alternating hands); ↑: jump (walk cycle plays in the air; **holding ↑ keeps hopping**; plays `player-jump.mp3`; side arrows stay live mid-jump) — **except** at a highlighted shop door, where ↑ enters the shop instead (highlight stays visible through the whole enter/inside/exit sequence).
- **Debug**: holding **Shift** (either one) moves Rudy **4× faster** while walking — including the mid-jump drift (`DEBUG_SPEED_MULTIPLIER` in `src/actors/player.js`).
- Planned (Phase 1): retreat key for timed evasion.

## Current status (2026-10-12)

**Phase 0 (PoC) of [PLAN.md](PLAN.md) is complete and browser-verified.** Working: walking + collision, section transitions along the route, the `lysyblokers` patrol enemy (who breaks patrol to trade blows), **simple combat** (the blow resolves at the attack's full extension: 1 damage, hit interrupts the defender's blow, recovery before the next one; HP 0 → the defeated lie on the ground until section exit), the jump (↑, `player-jump.mp3`, walk cycle in the air, arrows live mid-jump), the money-driven invisible shop (coin → `ulica-01_01-sklep.mp3`; on coming out of the shop **the `beer` appears and the coin disappears in the same moment**; broke → `ulica-01-01-sklep2.mp3` + out after 1 s) with its highlight overlay, the **HUD** (hearts per HP → coins per money unit → **one row per carried item** (e.g. `beer.png`), zero rows collapse), the **bum boss `boss_zul`** (idle and unstrikingable without beer — waiting in the background as the `ulica-01_02-zul.png` pose at 1379, 611 via the boss `idleOverlay` config; carrying `beer` triggers `boss-intro` + boss music + the fight; his defeat shows "Gratulacje! Pokonałeś żula!" and sets `boss_zul_defeated`) and the **game over screen** (stats + `game-over.mp3` death music + restart button → fresh game; no saves). Everything is config-driven: character stats/hitbox/moves in `data/characters/*.json`, streets/sections in `data/streets/*.json` (boss `conditions` + `trigger`), audio resolved by naming convention (`src/audio/audio.js`).

Not implemented yet (data or scaffolding exists, behavior does not): RPS tie-break and timed dodge semantics (Phase 1), blood VFX, other enemy types (`rat`, `thug` — skipped until they get character configs), chest/door interactions, dialogue, missions/quests, objective display, boss intro cutscene, audio layering menu. Placeholder art/audio (`boss_zul.png`, `hud/beer.png`, `*-attack-hit`, `boss-intro`, `boss-music`, `game-over`) are duplicates awaiting owner assets. Details and tracking in [FEATURES.md](FEATURES.md). Next up: **Phase 1 (full combat system)** in [PLAN.md](PLAN.md) — P1.1 RPS tie-break.

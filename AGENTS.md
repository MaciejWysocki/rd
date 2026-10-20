# AGENTS.md — Rudy Dres rd4: project context

Read this before touching the repo. Companion files: [FEATURES.md](FEATURES.md) (feature/progress tracker) and [PLAN.md](PLAN.md) (phased implementation plan — the workable plan to implement against).

## What this game is

A simple browser-based "karate" game — a beat-'em-up in the style of Amiga titles like *Renegade* or *Final Fight* — launched in a web browser (no installation) and played on **desktop with a keyboard**. The only playable character is **Rudy** ("rudy dres" = a red tracksuit guy), on a **real street in the owner's city** (Polish names: `01-narutowicza`, "Zielona 3", "Narutowicza 6"): fight enemies, complete missions, fight bosses. The two pillars are **combat and questing**. Tone: gritty Polish street humor. Player-facing names and error messages are Polish.

## Game world model

- The world consists of **streets**, each street made up of **sections**. The streets are played **one after another, in file-name order** (`01-narutowicza`, then `02-…`, `03-…`); the game ends when the **last** street is finished. A street is a single JSON file: `data/streets/<number>-<name>.json`.
- A street's **sections are placed from left to right** and can be traversed back and forth — the player walks into the neighbouring section and may return. There is **no route** any more: the section list in the config *is* the street.
- **No continuous scrolling**: each section is a **static background screen** (side-view street imagery with a flat street/sidewalk strip at the bottom where characters move); the game switches screens when the player reaches a section edge (like the Atari game *Ninja*). At the **ends of the street the boundary blocks Rudy and he walks in place**.
- **On entering a section** (`Section.enter()` in `src/world/section.js`): 1. load the background → 2. build the boundaries (walls) → 3. apply the section's `onEnter` triggers (the mission may move on) → 4. spawn the hostiles (`enemies` + `bosses`) → 5. load the walkable interactions. The triggers run first, so what is in the world matches the state the player just walked into.
- **On exiting a section**: the **hostiles keep their state** in the session — a **living** hostile stands where the player left it when the section is entered again (it does not jump back to its post), a **defeated** one still lies where it fell (the body instead of a fresh enemy). The mission, inventory, money, world flags and stats → do not reset (they live in the `Session`). There is **no save system** (session-only play): Rudy's defeat — like winning the game — shows a shared end screen with statistics and a restart button (click or Enter — Space does not restart; `game-over` on defeat / `<street>-congratulations` on victory, each played once — no loop; owner decisions 2026-10-11 to 2026-10-15; supersedes the earlier "save in the browser" expectation).
- This deliberately sets up moments like *"Oh, I came back here and things are different now."* — what spawns in a section can depend on the **mission stage** (see `presentWhen` in the street JSON).
- **Missions**: every street has **one main mission** — the `mission` field of the street config, an array of log lines where the index is the mission stage. The stage moves on through the **effects** of the config's triggers (a `{"mission": 2}` effect sets the stage). The HUD shows the street's opening objective on the first log row and the current objective on the second one. Side quests per section are still planned.
- **Hostiles**: every section holds a list of `enemies` and a list of `bosses` — the **role** (enemy / boss) comes from the list the entity is in. Every entity may carry a `presentWhen` condition: it exists in the world only while the condition holds (this is what the old boss-only `"mission": [1, 2]` did). Its `fight` trigger (`always` / `distance` / `hit`) decides when the fight starts. The `presentWhen` condition is evaluated when the section is entered — the entity is spawned only while the condition holds.
- **When a street ends** (the rule of 2026-10-19): the street is finished when the **mission is on its last stage** *and* **no boss of the street is still standing**. A boss that is not present any more (its `presentWhen` no longer holds) does not block the street. The old rule (the flag `<street>_<bossId>_defeated`) is **gone** — the state of the hostiles lives in the session (`hostileStates`) and the conditions read the kills with `when.defeated`.
- Section backgrounds are loaded from PNGs named `<street>-<section>.png` (e.g. `01-narutowicza-1.png`) — real **photographs** of that part of the actual street, supplied by the owner.

## Tech stack

- Vanilla JavaScript ES modules, Canvas 2D. **No build step, no framework, no tests, no lint.**
- Run via any static file server from the repo root (the game `fetch`es JSON, so `file://` won't work). Open `index.html`.
- Canvas is fixed 1600x800, centered on a black page.
- All page and Canvas text uses the bundled root `PressStart2P-Regular.ttf` as **Press Start 2P**. `index.html` declares the face; `src/main.js` waits for it before starting the game. End-screen text sizes are fitted to the pixel font.

## Architecture map (2026-10-19 DDD refactor)

The game was restructured into explicit layers. **The gameplay behaviour did not change** — the same mechanics, the same timings, the same sounds, the same assets. What changed is the structure and the config schema.

| File | Responsibility |
|---|---|
| `index.html` | Canvas shell only. |
| `src/main.js` | **The composition root**: wires the `ContentRepository`, the `Session`, the `World`, the `Player`, the `Keyboard`, the `Game` and the screens together and starts the loop. `startFreshGame()` is both the boot path and the restart from the end screen (there are no saves). Rudy spawns at (50, 598). |
| `src/app/game.js` | `Game`: the rAF loop with delta time (ms) and the screen switch (`changeState`). It holds the session. |
| `src/app/play-screen.js` | The gameplay screen: input, the section transitions, the fight (the `arbitrate` events → sounds + blood), the HUD, the overlays, the boss music/intro and the drawing. It ends the street when `world.isStreetComplete()` is true and ends the game on the last street. |
| `src/app/end-screen.js` | The shared end screen (defeat / victory): the frozen scene, the 2/3-screen panel, the statistics, the ZAGRAJ PONOWNIE button (click or Enter → a fresh game — **Space does NOT restart**, owner 2026-10-15), `game-over` on defeat / `<street>-congratulations` on victory, each played once. |
| `src/app/walkable-interaction.js` | The scripted sequence of a walkable spot: walk in (`ENTER_MS` 1000) → hidden for the trigger's `stay` → walk out (`EXIT_MS` 1000). The exchange (the mission, the item, the price) happens **300 ms** (`MISSION_LEAD_MS`) before Rudy leaves the spot. The player has no control while it runs. |
| `src/domain/content/asset-conventions.js` | **The one and only place where an asset path or a sound track name is built** — every naming rule of the game, in one file. |
| `src/domain/content/character-schema.js` | `data/characters/<type>.json` → the **Character** model (normalization + validation, Polish errors). |
| `src/domain/content/street-schema.js` | `data/streets/<street>.json` → the **Street** model (schema **v2**: sections, overlays, interactions, enemies, bosses, triggers, conditions, effects). |
| `src/domain/content/content-repository.js` | File access + caching. **The only module in the domain that may call `fetch`** (streets, characters). |
| `src/domain/quest/mission.js` | The mission of the current street: the stages and their log lines (`advanceTo` sets the stage — absolute, not a transition map). |
| `src/domain/quest/triggers.js` | The unified trigger model: `matchesCondition`, `applyEffects`, `selectTrigger`. |
| `src/domain/quest/session.js` | The session aggregate: the mission, the items, the money, the flags, the stats, the play timer and the state of the hostiles (where they stand, where they fell). |
| `src/domain/actors/actor.js` | The base actor: position, hitbox, row-based animation, HP/defeat. The sprite sheet is **injected** (the domain must not touch the DOM). |
| `src/domain/actors/player.js` | Rudy: the arrow keys, the jump, the queued punches, the debug speed multiplier, the `hidden` state of the walkable interaction. |
| `src/domain/actors/enemy.js` | **ONE class for every hostile** (the old enemy + the old boss): the patrol behaviour, the sentry behaviour, the fight trigger, the ranged attack. |
| `src/domain/combat/combat.js` | The strike rules (pure): reach, the RPS arbitration, 1 damage, the knockback. It returns the outcome — it plays no sound. |
| `src/domain/combat/arena.js` | The chronological arbitration (pure): it returns the events (`hit` / `miss` / `draw` / `ranged`). |
| `src/world/world.js` | The streets and the sections: navigation, the street list, the **street completion rule**. |
| `src/world/section.js` | The runtime of one section: background, walls, the hostiles, the walkable spots; the enter pipeline. |
| `src/world/entity-hues.js` | The hue plan of the hostiles of a section: the first hostile of a type keeps the original colors, every further copy takes one of the random hues of the game. |
| `src/render/sprite-sheet.js` | Fixed square frames in rows; one row = one animation. It can bake a hue shift into the sheet. |
| `src/render/hue.js` | The hue shift of a drawn image: the pixels are rotated once, when the image is loaded (the sprites and the HUD icons). |
| `src/render/hud.js` | HUD overlay: hearts, coins, item rows, the two mission-log rows, one row of hearts per hostile in fight mode (the row of a hostile carries its hue shift). |
| `src/render/blood.js` | Procedural blood: every landed blow sprays 3x3 px red squares that arc down and land on the struck character's feet line. |
| `src/render/vomit.js` | The ranged burst of a `ranged` character (the boss's green vomit). |
| `src/audio/audio.js` | Convention-based sound playback. It only **plays** the track names that `asset-conventions.js` builds; every file is optional. |
| `src/input/keyboard.js` | Held keys + one-shot `consumePress`, by `e.code`. |
| `data/characters/*.json` | Character configs (see the schema below). |
| `data/streets/*.json` | Street/section definitions (see the schema below). |
| `assets/bg/`, `assets/sprites/`, `assets/sounds/`, `assets/hud/` | The assets (see the asset conventions). |

### The dependency rule

- `src/domain/` is **pure**: no `document`, no `window`, no `Image`, no `Audio`, no `fetch`, no canvas. It receives what it needs (the sprite sheet is injected into the actors; the sounds are played by the app layer).
- `src/domain/content/` is the **only** layer that knows the JSON files exist. Everything else works with the normalized models.
- `src/app/` and `src/world/` know everything; `src/render/`, `src/audio/` and `src/input/` are adapters.

## Conventions (follow these, don't invent new ones)

- **Sprite sheets**: 150x150 px frames ("initially, all frames are 150x150px"), one animation per row. Row 0 = walk (8 frames). **Each move/attack = its own row of 4 frames**. Walk 80 ms/frame, punch 17.5 ms/frame. `facing = -1` mirrors horizontally. A sheet may also carry a **death row** (`deathRow` + `deathFrames` in the character config, default 4 frames) played on defeat while the body slides a little back (opposite the facing) — e.g. `lysy-blokers` row 2 (4 frames), `zul-mietek` row 2 (4 frames), **Rudy's `rudy_dres` row 2 uses all 8 frames** (owner 2026-10-15). The end screen waits for the fall to finish before freezing the scene. Sheets without a death row fall back to a rotated placeholder pose.
- **Moves are data-configured**: a character's config maps input keys → sprite rows (`{ key, row, type: punch|kick|headbutt|vomit }`), never hardcoded per character (`data/characters/*.json`, normalized by `character-schema.js`). A move with `"alternate": true` switches between the row's two 4-frame groups on **every other attack** (e.g. Rudy's punch: frames 0–3 right hand, 4–7 left hand); without it the animation is always the same. The boss's combined ranged move is explicitly `type: vomit`, excluded from melee RPS — a character with a `vomit` move is a **ranged** character (`attackKind: "ranged"`), it spits instead of trading blows.
- **Combat is universal**: the same combat logic serves Rudy, standard NPCs and bosses — they differ only in their parameters (stats, attack set) and their `behavior`.
- **Combat timing** (P1.1/P1.2, verified 2026-10-18): hits resolve at **full extension**, in finish-time order. Already-started opposing melee attacks finishing within **100 ms inclusive** use headbutt > punch > kick > headbutt, without delaying single strikes; a later winner still must finish and reach its target. Equal move types favor the earlier finish; identical finish times draw. Jump/retreat can interrupt Rudy's windup immediately; an airborne target dodges melee/vomit. Evasions are not buffered and cannot undo damage already taken. **The retreat was removed on 2026-10-19** (↓ does nothing now) — the jump is the only evasion. **1 damage per hit**, interrupting the defender's blow; recovery is per character (`recoveryMs`).
- **Hit knockback** (P1.5): landed melee hits move their target away from the source by `HIT_KNOCKBACK_PX` = **100 px** (`src/domain/combat/combat.js`), clipped flush to solids/street-end walls. **Ranged attacks such as vomit do not apply knockback or use this constant** (owner 2026-10-18). Misses and RPS draws do not push; lethal melee hits persist the displaced corpse position. The existing death-animation slide is separate.
- **No XP, no leveling**: progression and items are tied to missions; each mission gives a slight stat boost (planned).
- **Audio layering**: street ambient → section music (overrides ambient) → boss music (overrides section music). The highest active layer wins.
- **Art and audio are produced by the owner**: frame-by-frame 2D sprites (following the sprite-sheet convention), sound effects and music. Code selects assets by naming convention only and must never depend on specific asset content.
- **Hitbox**: feet area of the 150x150 frame, defined per character config — `{ x: 55, y: 120, w: 20, h: 25 }` for Rudy and `lysy-blokers` (**20 px wide**), `w: 40` for `zul-mietek`; combat measures hitbox-edge to hitbox-edge, see `combat.js`.
- **Blood VFX** (`src/render/blood.js`, owner 2026-10-14): every landed blow sprays 3x3 px red squares out of the struck character (player and enemies alike); they fly away from the blow, arc down and land on the ground line (the struck character's feet), staining it until the section is left — transient, like the hostiles. An attacker can switch bleeding OFF (`"bloodOnTarget": false` in its character config): `zul-mietek` never makes the player bleed (owner 2026-10-15) — the player still bleeds zul with every landed punch.
- **Boss ranged attack** (`src/render/vomit.js`, owner 2026-10-15): ONE combined attack — the boss plays its attack animation and at full extension a burst of green vomit (5x5 px squares, 40 per burst, **twice as slow** since 2026-10-15) flies out; there is no separate melee blow. The burst hurts the player (1 damage) within about **300 px** of the mouth and the squares land on the ground at about **600 px** (both doubled by the owner on 2026-10-15), staining it until the section is left. Vomit never draws blood — the green squares are the whole effect. **Jumping over the spray dodges it** (owner 2026-10-15): a player in the air is not hit.
- **Delta time is milliseconds** throughout.
- **Persistent vs transient**: the mission/flags/inventory/money/stats live in the `Session` and survive section changes (the mission is replaced when the next street starts); the hostiles live in the `Section` and are rebuilt from JSON on every `enter()` — but their **state is persisted** in the session (`hostileStates`, keyed `<street>/<section>/<role>/<id>#<slot>` → where the hostile stands and whether it lies dead), so a **living** hostile is still where the player left it and a **dead** one still lies where it fell. The **role** is the list the entity comes from (`enemies` / `bosses`) and the **slot** is its place in that list: two entities that share an id (e.g. two `lysy-blokers`) keep their own body, and the same id in two sections keeps its own place.
- **One trigger model everywhere** (sections, interactions and, later, the entities): a list of `{ "when": <condition>, "stay": <ms>, "effects": [...] }`. The **first** trigger whose condition holds wins; a trigger without a condition is the fallback and belongs last.
- **Duplicates look different**: two hostiles of the same type in the same section share one sprite sheet, so **the first hostile of a type keeps the original colors** and every further copy of that type takes one of the **random hues of the game** (`src/world/entity-hues.js` picks them from the session's **hue pool** — the hues are at least 45° away from the original colors and from each other). The shift is baked into the sheet's pixels when it is loaded (`src/render/hue.js`) and the **HUD tints the hostile's heart row with the same shift**, so the row belongs to the hostile of that color. The hue pool is **drawn anew for every game** (`session.huePool`, re-drawn by `resetForNewGame`) and stays for the whole playthrough: the street looks different in every game, but a hostile keeps its colors within one (a corpse keeps the colors of the enemy that fell).
- Errors and code comments are English; user-facing strings and error `throw`s are Polish.

## Street JSON schema (v2) — `data/streets/<number>-<name>.json`

One file per street; the file name (without `.json`) is the street id used by every asset convention. **The old v1 shape is gone** (`trigger`, `highlight`, `give`/`cost`, the `mission` transition maps `{"0": 1}`, the single `boss` object): a config with an unknown key is **refused** with a Polish error naming the file and the JSON path — no silent misreads.

A complete, valid example (this is the shape of `data/streets/01-narutowicza.json`):

```jsonc
{
  "name": "Narutowicza",
  "mission": ["Kup piwo", "Znajdź ustronne miejsce aby wypić piwo", "Pokonaj żula"],
  "sections": [
    {
      "name": "Zielona 3",
      "overlays": [
        { "x": 158, "y": 288, "when": { "position": [400, 500] } }
      ],
      "interactions": [
        {
          "id": "sklep",
          "type": "walkable",
          "x1": 400,
          "x2": 500,
          "triggers": [
            {
              "when": { "mission": [0] },
              "stay": 3000,
              "effects": [ { "mission": 1 }, { "item": "beer" }, { "money": -1 } ]
            },
            { "stay": 1000 }
          ]
        }
      ],
      "enemies": [
        {
          "id": "lysy-blokers",
          "type": "lysy-blokers",
          "x": 1450,
          "y": 598,
          "fight": { "type": "distance", "distance": 300 }
        }
      ],
      "bosses": [
        {
          "id": "zul-mietek",
          "type": "zul-mietek",
          "x": 1450,
          "y": 598,
          "fight": { "type": "always" },
          "presentWhen": { "mission": [1, 2] }
        }
      ]
    },
    {
      "name": "Narutowicza 6",
      "onEnter": [
        { "when": { "mission": [1] }, "effects": [ { "mission": 2 } ] }
      ],
      "overlays": [
        { "x": 1427, "y": 573, "when": { "mission": [0] } }
      ]
    }
  ]
}
```

### The keys

| Level | Keys |
|---|---|
| Street | `name` (defaults to the id), `mission` (an array of log lines, one per stage), `sections` (a non-empty array) |
| Section | `name` (defaults to `<street> <n>`), `onEnter` (the triggers fired on entry), `overlays`, `interactions`, `enemies`, `bosses` |
| Overlay | `x`, `y` (numbers), `when` (a condition) — the image is `assets/bg/<street>-<n>-<i>.png`, the index is 1-based |
| Interaction | `id` (required), `type` (`"walkable"`), `x1`/`x2` (the stretch of the section), `triggers` |
| Trigger | `when` (a condition, optional), `stay` (ms, optional), `effects` (an array) |
| Entity (`enemies` / `bosses`) | `id` (required), `type` (a character type, required), `x`, `y` (required numbers), `fight`, `presentWhen` |
| Fight | `type` (`"always"` \| `"distance"` \| `"hit"`), `distance` (required and > 0 for `"distance"`) |

- The **role** (enemy / boss) comes from the list the entity is in — there is no `role` key in the config.
- `presentWhen` — the entity exists in the world only while the condition holds.
- A **type without a character config is not an error** — the spawn skips it (`rat`, `thug`).
- `sections` are 1-based: the section number is the one in the asset names.

### The conditions (`when`)

All the fields are optional; **all the fields that are present must hold**.

| Condition | Meaning |
|---|---|
| `mission: [0, 1]` | the mission is on one of these stages |
| `flags: { "name": true }` | every listed world flag has exactly the listed value |
| `items: { "beer": 1 }` | the inventory holds **at least** the listed count of each item |
| `money: 1` | the purse holds at least this much |
| `defeated: ["id", "id#slot"]` | these entities are defeated **in the current street** (`"id"` = any slot, `"id#slot"` = that one) |
| `position: [400, 500]` | the player's x is within `[x1, x2]` (inclusive) |

### The effects

| Effect | Meaning |
|---|---|
| `{ "mission": 2 }` | set the mission stage (absolute) |
| `{ "item": "beer", "count": 1 }` | add items (a negative count takes them away) |
| `{ "money": -1 }` | change the purse (a negative amount spends) |
| `{ "flag": "name", "value": true }` | set a world flag |

## Character config — `data/characters/<type>.json`

The file name is the character's **type**; the `name` field is the character name — it is the **sound prefix** (`player-attack-hit`) and the default sprite name; `sprite` overrides the sprite-sheet name (`player` → `rudy_dres`). Unchanged in shape, plus one new field.

| Field | Meaning |
|---|---|
| `name` | the character name (required) |
| `sprite` | the sprite-sheet base name (defaults to `name`) |
| `hp` / `maxHp` | the hit points (`maxHp` defaults to `hp`) |
| `money` | the starting purse (the player) |
| `walkSpeed` / `walkFrameMs` / `attackFrameMs` / `attackHoldMs` / `recoveryMs` | the movement and the attack timings |
| `hitbox` | `{ x, y, w, h }` — the feet box of the 150x150 frame |
| `deathRow` / `deathFrames` | the fall animation (row + frame count) |
| `bloodOnTarget` | `false` = this character's blows do not make the target bleed |
| **`behavior`** | **`"patrol"`** (the default: it walks its stretch until the fight) or **`"sentry"`** (it stands still, untouchable, until the fight starts — `zul-mietek` is a sentry) |
| `moves` | `[{ key, row, type, alternate }]` — `key` is null for the AI-driven moves |
| `jumpKey` / `jumpDurationMs` / `jumpHeightPx` | the jump of the player |
| **`attackKind`** | **derived, not in the file**: `"ranged"` when any move has `type: "vomit"`, otherwise `"melee"` |

Example (`data/characters/lysy-blokers.json`):

```jsonc
{
  "name": "lysy-blokers",
  "sprite": "lysy-blokers",
  "hp": 9,
  "walkSpeed": 100,
  "walkFrameMs": 80,
  "attackFrameMs": 75,
  "attackHoldMs": 500,
  "recoveryMs": 700,
  "deathRow": 2,
  "hitbox": { "x": 55, "y": 120, "w": 20, "h": 25 },
  "moves": [ { "row": 1, "type": "headbutt" } ]
}
```

## Asset conventions

Every path and every track name is built by `src/domain/content/asset-conventions.js` — **never assemble one by hand**.

| File name pattern | Used for |
|---|---|
| `assets/bg/<street>-<n>.png` | the background of the section |
| `assets/bg/<street>-<n>-<i>.png` | the background overlays of the section (1-based index) |
| `assets/sprites/<sprite>.png` | a character sprite sheet (150x150 frames) |
| `assets/hud/hp.png` | the heart (one per HP) |
| `assets/hud/money.png` | the coin (one per money unit) |
| `assets/hud/<itemId>.png` | an item icon (one per carried unit) |
| `assets/hud/endgame-frame.png` | the frame of the end screen |
| `assets/sounds/<who>-attack.mp3` | the attack release of a character |
| `assets/sounds/<who>-attack-hit.mp3` / `<who>-attack-miss.mp3` | the outcome of a blow |
| `assets/sounds/<who>-jump.mp3` | the jump (e.g. `player-jump.mp3`) |
| `assets/sounds/<street>-<n>-ambient.mp3` | the looping ambience of a section |
| `assets/sounds/ambience.mp3` | the default street ambience (fallback) |
| `assets/sounds/<street>-boss-music.mp3` | the fight music of a street (loop) |
| `assets/sounds/<street>-boss-intro.mp3` | the boss's introduction sentence (once, on top of the music) |
| `assets/sounds/<street>-<interaction>-<index>.mp3` | the sound of a walkable interaction (the trigger index) |
| `assets/sounds/<street>-congratulations.mp3` | the victory jingle (once) |
| `assets/sounds/game-over.mp3` | the death music (once) |

**Every audio file is optional — a missing file means silence.** The ambience starts **automatically at boot** (owner 2026-10-15): plain `play()`, then a muted start that unmutes once running (browsers block audible playback before the first gesture), then the first key press/click as the last resort.

## Content pipeline (goal)

Ultimately the game must be **configurable via files**: sections, enemies, NPCs and missions are defined in configuration files, and assets are selected based on **naming conventions**. The architecture must make expansion easy — adding more sections and streets later is expected to be routine.

- **New section** = background photo + a section entry in the street JSON + characters + triggers + audio = new section (pure file work, no code changes).
- **New street** = a new file `data/streets/<number>-<name>.json` (+ its assets). The game finds the streets by name and plays them one after another — no code change, no registration.

## Controls

Desktop keyboard; the move and `jumpKey` mappings live in the character config. Current defaults:

- ← / →: walk (keeps walking in place when blocked); Space: punch (stands still while attacking, alternating hands); ↑: jump (walk cycle plays in the air; **holding ↑ keeps hopping**; plays `player-jump.mp3`; side arrows stay live mid-jump) — **except** at a walkable spot, where ↑ enters the interaction instead (Rudy walks in, disappears for the trigger's `stay` and walks back out; the overlay stays visible through the whole sequence).
- **Debug**: holding **Shift** (either one) moves Rudy **4× faster** while walking — including the mid-jump drift (`DEBUG_SPEED_MULTIPLIER` in `src/domain/actors/player.js`).
- ↓: **does nothing** — the backward step (the "retreat"/moonwalk) was removed by the owner on 2026-10-19; the jump is the only evasion. The key is still swallowed so the page does not scroll.

## Current status (2026-10-20)

**The game was restructured into explicit layers (the DDD refactor) and the street/mission configuration was migrated to the new schema (v2).** The old `src/game/`, `src/actors/`, `src/save/` and the old `State` are gone: the code lives in `src/app/`, `src/domain/`, `src/world/`, `src/render/`, `src/audio/` and `src/input/`, and the state that survives a screen change is the `Session`. **The gameplay behaviour did not change** — the same mechanics, the same timings, the same sounds, the same assets.

Working (verified in the browser before and after the refactor):
- **The street sequence**: the game finds the street files in `data/streets/` (by name — the directory listing, or the optional manifest `streets.json`) and plays them one after another — `01-narutowicza` today; the game ends when the **last** street is finished. A finished street hands over to the next one (the mission is replaced, the player starts at the beginning of the new street, the HP/money carry over).
- **The mission from the config**: `mission: ["Kup piwo", "Znajdź ustronne miejsce aby wypić piwo", "Pokonaj żula"]` — the index is the stage. Row 1 of the HUD always shows `mission[0]`, row 2 the current objective (once the mission moved on). The stage moves on through the **effects** of the config: the shop (`{"mission": 1}`) and the section (`onEnter` → `{"mission": 2}`) — verified: shop → stage 1 ("Znajdź ustronne miejsce…"), entering "Narutowicza 6" → stage 2 ("Pokonaj żula").
- **The walkable shop**: the stretch `x1`…`x2` of the section; ↑ walks Rudy in, the sound `assets/sounds/01-narutowicza-sklep-0.mp3` plays when he disappears, Rudy stays hidden for the trigger's `stay` (3000 ms on stage 0, 1000 ms on the later stages) and walks back out; the **exchange** (the mission, the beer, the price) happens **300 ms** before he leaves. The overlay `assets/bg/01-narutowicza-1-1.png` is shown while the player stands in the spot.
- **The sections**: a chain, no route — the player walks into the neighbouring section and back; the ends of the street are walled by convention (the first section a left wall, the last one a right wall). Section backgrounds: `assets/bg/01-narutowicza-<n>.png`.
- **The hostiles**: the fight trigger comes from the config — `always`, `distance` (the `lysy-blokers` waits until the player is closer than 300 px) or `hit` (peaceful until punched). The boss `zul-mietek` is a **sentry** (`behavior: "sentry"`) and exists only while his `presentWhen` holds (`{ "mission": [1, 2] }`); before that he waits in the background as the `01-narutowicza-2-1.png` pose (a section overlay with `when: { "mission": [0] }`); with the fight on, `<street>-boss-music` loops and `<street>-boss-intro` plays once on top of it.
- **The street ends** when the mission is on its last stage and no boss is standing; the next street follows, and after the last one the victory screen appears.
- **The duplicates look different** (2026-10-20): the two `lysy-blokers` of the first section are no longer the same sprite — **the first keeps the original colors**, the extra copy gets a **random hue of the game** (at least 45° away from the original colors and from the other copies). The **HP row of a hostile in the HUD carries the same hue**, so the row of hearts belongs to the hostile of that color. The hues are drawn anew for every game and stay for the whole playthrough (a corpse keeps the colors of the enemy that fell). Verified in the browser: the first thug's pixels are the sheet's own (79–82% in the sheet's palette, shift 0), the copy's pixels are exactly the rotated ones, four games in a row gave four different hues, the hue survived a section round trip unchanged, and the heart row of the copy is exactly the rotated heart icon.
- **The hostiles keep their place** (2026-10-20): the state of every hostile is persisted in the session (`hostileStates`, keyed `<street>/<section>/<role>/<id>#<slot>`), so leaving a section and coming back finds the **living** enemies exactly where the player left them (the position, the facing and the patrol direction — not back at their post) and the **dead** ones still lying where they fell. The key is the hostile's identity: the street, the section, the list it comes from (`enemies` / `bosses`), its label and its place in that list — so the same label in two sections keeps its own place (the old key `<street>/<id>#<slot>` mixed them up). Their **HP is not persisted** — a wounded hostile comes back at full HP. Verified in the browser: the two thugs left section 1 at x=1154/762 came back at x=1154/762 (not 1450/1050), after a knockback they came back at the pushed-back spot, the corpse still lay where it fell, and a corpse re-entered from the session is no longer counted as a new kill.
- Everything from before still works: the universal combat (P1.1/P1.2/P1.5, knockback **100 px**), the blood VFX and the corpses, the jump, the HUD, the two-row mission log, the pixel font, the shared end screen (`game-over` on defeat, `<street>-congratulations` on victory, played once) and the restart (click or Enter — Space never restarts). **The retreat (↓) was removed on 2026-10-19** — the jump is the only evasion now.

Not implemented yet: the **side quests** (the conditions and the effects are expressible in JSON now, but the side quests themselves are not written), the **dialogue** (and the NPC townsfolk), the **audio layering** (ambient → section music → boss music), the **mission stat boosts** (no XP/leveling), the **boss intro cutscene**, the mission-based move unlocks (P1.3), the other enemy types (`rat`, `thug` — skipped until they get character configs) and the collapsible menu. Placeholder art/audio (`zul-mietek.png`, `hud/beer.png`, `*-attack-hit`, `*-boss-intro`, `*-boss-music`, `game-over`) are duplicates awaiting owner assets. Details and tracking in [FEATURES.md](FEATURES.md). Next up: **P1.3 — Move sets & per-character speeds** in [PLAN.md](PLAN.md).

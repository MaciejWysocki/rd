# AGENTS.md — how to work on this project

Rudy Dres is a browser "karate" beat-'em-up: Rudy walks a real street in the owner's city, fights the thugs and the bosses and works through the street missions. Vanilla JavaScript ES modules and Canvas 2D — **no build step, no framework, no tests, no lint**. Desktop and keyboard only.

**This file is the working context — how the code is built and the rules to follow.** It does not describe what the game contains:

| File | What is in it |
|---|---|
| [FEATURES.md](FEATURES.md) | **What the game contains** — every implemented feature, the world data, the assets and the changelog. |
| [PLAN.md](PLAN.md) | **The checklist** of what is done and the **Todo** table for what comes next. |
| AGENTS.md (this file) | **How the code is built**: the architecture, the conventions, the config reference and the traps. |

## Before you touch anything

- **Run it**: serve the repo root and open `index.html` — `python -m http.server 8000` from the repo root, then <http://127.0.0.1:8000/index.html>. The game `fetch`es the JSON, so `file://` will not work.
- **Verify it in the browser.** There is no test suite and none is planned: a change is verified by playing it (walk, punch, enter the shop, fight the boss, reach the end screen). The scripted playthrough (boot → shop → thugs → section 2 → the boss → section 3 → the entrance → the victory screen, plus the defeat and the restart) is the regression check for a big change — run it before and after and compare the state.
- **Do not add a build step, a bundler, a framework, a test runner or a linter.** The game is served as it is.
- **The canvas is fixed at 1600×800** — `index.html` and `src/world/layout.js` must agree.

## The architecture

### The layers and the dependency rule

- `src/domain/` is **pure**: no `document`, no `window`, no `Image`, no `Audio`, no `fetch`, no canvas. It receives what it needs (the sprite sheet is injected into the actors; the sounds are played by the app layer).
- `src/domain/content/` is the **only** layer that knows the JSON files exist. Everything else works with the normalized models.
- `src/app/` and `src/world/` know everything; `src/render/`, `src/audio/` and `src/input/` are adapters.
- **The vocabulary lives with the model it describes**: the condition fields and the effect types are in `src/domain/quest/trigger-vocabulary.js`, the AI behaviours in `src/domain/actors/behavior.js`. The config schema (the adapter that reads the JSON) validates against those lists — the model never imports the schema.

### The file map

**The page and the composition root**

| File | Responsibility |
|---|---|
| `index.html` | The page shell: the canvas and the **mission log element above the game area** (`#missionLogs`). |
| `src/main.js` | **The composition root**: wires the `ContentRepository`, the `Session`, the `World`, the `Player`, the `Keyboard`, the `Game` and the screens and starts the loop. `startFreshGame()` is both the boot path and the restart from the end screen (there are no saves); it leaves the old section **before** the session reset, so the state of the hostiles is wiped with it. It also exports `game`, `session` and `world` so the running game can be inspected from the outside. |

**`src/app/` — the screens and the loop**

| File | Responsibility |
|---|---|
| `game.js` | The rAF loop with delta time (ms) and the screen switch (`changeState`). The loop is bound once. |
| `play-screen.js` | The gameplay screen: the input, the section transitions, the combat, the boss trigger, the street completion and the drawing. A **boss fight locks the player on his section** and the **invisible barriers of the visible area** hold the player and the hostiles inside the screen. It ends the street when `world.isStreetComplete()` is true and ends the game on the last street. |
| `end-screen.js` | The shared end screen (defeat / victory): the frozen scene, the 2/3-screen panel, the statistics, the restart button (click or Enter → a fresh game — **Space does NOT restart**), `game-over` on defeat / `<street>-congratulations` on victory, each played once. |
| `walkable-interaction.js` | The scripted sequence of a walkable spot: walk in → hidden for the trigger's `stay` → walk out. The exchange (the mission, the item, the price) happens **300 ms** before Rudy leaves the spot. The player has no control while it runs. The way Rudy looks while he walks in follows the side of the screen the spot is on. When the exchange ends the street, Rudy **stays inside**. |
| `combat-feedback.js` | What the combat events look and sound like: the attack sounds and the blood. The one place that turns the events of the arbitration into the effects. |

**`src/domain/` — the pure model**

| File | Responsibility |
|---|---|
| `content/asset-conventions.js` | **The one and only place where an asset path or a sound track name is built** — every naming rule of the game, in one file. |
| `content/character-schema.js` | `data/characters/<type>.json` → the **Character** model (normalization + validation, Polish errors). |
| `content/street-schema.js` | `data/streets/<street>.json` → the **Street** model (schema **v2**). |
| `content/content-repository.js` | File access + caching. **The only module in the domain that may call `fetch`**. |
| `quest/mission.js` | The mission of the current street: the stages and their log lines (`advanceTo` sets the stage — absolute, not a transition map). |
| `quest/trigger-vocabulary.js` | The condition fields and the effect types — the contract between the schema and the engine. |
| `quest/triggers.js` | The unified trigger model: `matchesCondition`, `applyEffects`, `selectTrigger`. Every condition field and every effect type is **one entry of a registry**. |
| `quest/hostile-states.js` | The store of the hostile states: where a hostile stands and whether it lies dead. It owns the **identity** of a hostile and the key built from it. |
| `quest/session.js` | The session aggregate: the mission, the items, the money, the flags, the stats, the play timer and the state of the hostiles. |
| `actors/actor.js` | The base actor: position, hitbox, row-based animation, HP/defeat. The sprite sheet is **injected**. `advance(dt)` is the shared animation step; `update(dt, env)` is the uniform step of every actor. |
| `actors/hitbox.js` | The collision box of an actor in world coordinates — **one place** for the rectangle arithmetic the combat, the knockback and the AI all use. |
| `actors/behavior.js` | The AI behaviours of the hostiles (**Strategy**): `patrol` and `sentry` are strategy objects. A new behaviour is a new object here — the `Enemy` class does not change. |
| `actors/player.js` | Rudy: the arrow keys, the jump, the queued punches, the debug speed multiplier, the `hidden` state of the walkable interaction. |
| `actors/enemy.js` | **ONE class for every hostile**: the movement, the fight trigger, the ranged attack and retaliation against a neutral that hits it. The **behaviour** is a strategy. |
| `actors/neutral.js` | A neutral pedestrian: reuses enemy movement and combat, but retaliates only against the character that last hit it while it survived. |
| `combat/combat.js` | The strike rules (pure): reach, the RPS arbitration, 1 damage, the knockback, the knockback direction. It returns the outcome — it plays no sound. |
| `combat/arena.js` | The chronological arbitration (pure): it returns the events (`hit` / `miss` / `draw` / `ranged`). |

**`src/world/` — the streets and the sections**

| File | Responsibility |
|---|---|
| `world.js` | The streets and the sections: navigation, the street list, the **street completion rule**. It also owns the **trigger context** — there is exactly one builder of it (`context()`). |
| `section.js` | The runtime of one section: background, walls, the hostiles, the walkable spots; the enter pipeline. `solids(fighting)` adds the **invisible barriers of the visible area** while a boss fight is on. |
| `entity-hues.js` | The hue plan of the hostiles of a section: the first hostile of a type keeps the original colors, every further copy takes one of the random hues of the game. |
| `layout.js` | The geometry of the world: the canvas size, the ground line, the walls, the entry points. |

**`src/render/`, `src/audio/`, `src/input/` — the adapters**

| File | Responsibility |
|---|---|
| `render/sprite-sheet.js` | Fixed square frames in rows; one row = one animation. It can bake a hue shift into the sheet. |
| `render/hue.js` | The hue shift of a drawn image: the pixels are rotated once, when the image is loaded. |
| `render/image-cache.js` | The shared cache of the loaded images (the HUD icons and the section overlays). |
| `render/hud.js` | The HUD overlay: hearts, coins, item rows (left) and one row of hearts per hostile in fight mode (top-right). `drawMissionLogs()` writes the mission logs into the `#missionLogs` element **above the game area**. |
| `render/overlays.js` | The background overlays of a section: the "back" ones with the scenery, the "front" ones over the characters. |
| `render/particles.js` | The shared particle field: little squares that fly out, arc down and land on a ground line. |
| `render/blood.js` | The blood spray of a landed blow. |
| `render/vomit.js` | The ranged burst of a `ranged` character (the boss's green spit). |
| `audio/audio.js` | Convention-based sound playback. It only **plays** the track names that `asset-conventions.js` builds; every file is optional. |
| `input/keyboard.js` | Held keys and one-shot `consumePress`, by `e.code`. |

## The rules to follow

- **One vocabulary, one builder**: a name that both the config and the engine must know (a condition field, an effect type, an AI behaviour) is declared **once**, in the model; the schema imports it. The same goes for the **trigger context** — `World.context()` is the only builder of it, so the sections, the entities and the play screen all read the same world.
- **A registry instead of a growing if-chain**: a set of variants (the conditions, the effects, the behaviours) is a table of small objects, one entry per variant. A new variant is a new entry — not a new branch in a shared function.
- **One place for the arithmetic**: a formula that more than one module needs (the hitbox rectangle, the knockback direction, the particle physics, the world geometry, the image cache) lives in one module and is imported by the others.
- **Every actor is stepped the same way**: `update(dt, env)`, where `env` carries the world around it (`keyboard`, `solids`, `target`). `Actor.advance(dt)` is the shared animation step. The subclasses add their own input handling; the callers do not need to know the type.
- **A hostile is addressed by its identity, not by five arguments**: `{streetId, section, role, id, slot}` — the state store builds its key from it.
- **The domain stays pure**: no DOM, no `Audio`, no `fetch` in `src/domain/`. Inject what is needed instead.
- **The asset paths are built only in `asset-conventions.js`** — never assemble one by hand.
- **Errors and code comments are English; user-facing strings and error `throw`s are Polish.**
- **The content is data**: a new section, a new street, a new hostile or a new move is a JSON edit, not a code change.

## The world model as the code implements it

- A **street** is a JSON file (`data/streets/<number>-<name>.json`); its **sections** are placed from left to right and can be traversed back and forth — the section list in the config *is* the street. There is **no route**. The streets are played one after another in file-name order and the game ends after the last one.
- **No continuous scrolling**: each section is a **static background screen** with a flat street strip at the bottom where the characters move; the screen switches when the player reaches a section edge. At the **ends of the street the boundary blocks Rudy and he walks in place**.
- **Entering a section** (`Section.enter()` in `src/world/section.js`), in this order: 1. load the background → 2. build the walls → 3. apply the section's `onEnter` triggers (the mission may move on) → 4. spawn the actors (`enemies` + `neutrals` + `bosses`) → 5. load the walkable interactions. The triggers run first, so what is in the world matches the state the player just walked into.
- **Leaving a section**: the hostiles are rebuilt from the config on the next entry, but their **state is persisted in the session** — a living hostile stands where the player left it, a defeated one still lies where it fell. A body stays on the street **even when its `presentWhen` no longer holds**.
- **The mission**: every street has one main mission — the `mission` field, an array of log lines where the index is the stage. The stage moves on through the **effects** of the config's triggers (`{"mission": 2}` sets the stage). A **defeated boss advances the stage by one**; it does not end the street.
- **When a street ends**: the mission has been advanced **PAST its last stage** (a stage with no log line of its own — that is how a config ends a street) *and* **no boss of the street is still standing**. A boss that is not present any more does not block the street.
- **A boss fight locks the player on his section** — he cannot walk into the neighbouring one until the boss is down, and the invisible barriers of the visible area hold the player and the hostiles inside the screen. The boss's death gives the street ambience back.
- **Persistent vs transient**: the mission, the flags, the inventory, the money and the stats live in the `Session` and survive a section change; the hostiles live in the `Section` and are rebuilt on every `enter()` — their state is persisted in the session (`hostileStates`, keyed `<street>/<section>/<role>/<id>#<slot>`). The **HP of a hostile is not persisted** — a wounded one comes back at full HP.
- **There is no save system** (session-only play). Rudy's defeat — like winning — shows the shared end screen with the statistics and a restart button.

## The config reference

### The street JSON (schema v2) — `data/streets/<number>-<name>.json`

One file per street; the file name (without `.json`) is the street id used by every asset convention. **The old v1 shape is gone** (`trigger`, `highlight`, `give`/`cost`, the `mission` transition maps `{"0": 1}`, the single `boss` object): a config with an unknown key is **refused** with a Polish error naming the file and the JSON path — no silent misreads.

| Level | Keys |
|---|---|
| Street | `name` (defaults to the id), `mission` (an array of log lines, one per stage), `sections` (a non-empty array) |
| Section | `name` (defaults to `<street> <n>`), `onEnter` (the triggers fired on entry), `overlays`, `interactions`, `enemies`, `neutrals`, `bosses` |
| Overlay | `x`, `y` (numbers), `when` (a condition), `position` (`"back"` — the default — or `"front"`) — the image is `assets/bg/<street>-<n>-<i>.png`, the index is 1-based |
| Interaction | `id` (required), `type` (`"walkable"`), `x1`/`x2` (the stretch of the section), `when` (a condition), `triggers` |
| Trigger | `when` (a condition, optional), `stay` (ms, optional), `effects` (an array) |
|Entity (`enemies` / `neutrals` / `bosses`)|`id` (required), `type` (a character type, required), `x`, `y` (required numbers), `facing`, `fight`, `presentWhen`|
|Fight|`type` (`"always"` \|`"distance"` \|`"hit"`), `distance` (required and > 0 for `"distance"`)|

- The **role** (enemy / neutral / boss) comes from the list the entity is in — there is no `role` key in the config. A neutral only fights back against the last attacker that hit it while it survived; its `fight` trigger is ignored.
- `facing` — `"left"` (the default, like every hostile) or `"right"`: the way the hostile spawns facing **and sets off walking**. A patrol bounces across the **whole section** (edge to edge of the screen) wherever it spawns — `x` is only where it starts.
- `presentWhen` — the entity exists in the world only while the condition holds.
- The **overlay `position`**: `"back"` is drawn with the background, `"front"` is drawn **over the player and the enemies** — a street light standing in the foreground.
- The **interaction `when`**: while the condition does not hold, the spot is **not interactive at all** — the player walks over it and ↑ jumps as usual.
- A **type without a character config is not an error** — the spawn skips it.
- `sections` are 1-based: the section number is the one in the asset names.
- The living example is `data/streets/01-narutowicza.json` — copy its shape.

#### The conditions (`when`)

All the fields are optional; **all the fields that are present must hold**.

| Condition | Meaning |
|---|---|
| `mission: [0, 1]` | the mission is on one of these stages |
| `flags: { "name": true }` | every listed world flag has exactly the listed value |
| `items: { "beer": 1 }` | the inventory holds **at least** the listed count of each item |
| `money: 1` | the purse holds at least this much |
| `defeated: ["id", "id#slot"]` | these entities are defeated **in the current street** (`"id"` = any slot, `"id#slot"` = that one) |
| `position: [400, 500]` | the player's x is within `[x1, x2]` (inclusive) |

#### The effects

| Effect | Meaning |
|---|---|
| `{ "mission": 2 }` | set the mission stage (absolute) |
| `{ "item": "beer", "count": 1 }` | add items (a **negative count takes them away** — the last one leaves the inventory, so the item disappears from the HUD) |
| `{ "money": -1 }` | change the purse (a negative amount spends) |
| `{ "flag": "name", "value": true }` | set a world flag |

### The character config — `data/characters/<type>.json`

The file name is the character's **type**; the `name` field is the character name — it is the **sound prefix** (`player-attack-hit`) and the default sprite name; `sprite` overrides the sprite-sheet name (`player` → `rudy_dres`).

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
| `behavior` | `"patrol"` (the default: it walks its stretch until the fight) or `"sentry"` (it stands still, untouchable, until the fight starts) |
| `moves` | `[{ key, row, type, frames, hitFrame, alternate }]` — `key` is null for the AI-driven moves; `type` is `punch` / `kick` / `headbutt` / `vomit`; `frames` is the number of frames the attack plays (default 4); `hitFrame` is the zero-based impact frame (default last frame) |
| `jumpKey` / `jumpDurationMs` / `jumpHeightPx` | the jump of the player |
| `attackKind` | **derived, not in the file**: `"ranged"` when any move has `type: "vomit"`, otherwise `"melee"` |

**The sprite-sheet convention**: 150×150 px frames, one animation per row. Row 0 = the walk cycle (8 frames). **Each move is its own row, 4 frames per attack by default** — the move's `frames` key overrides the count (the red robol's kick plays all 8 of its row). `hitFrame` may put the impact before the final frame; the animation still plays through its remaining frames. `"alternate": true` uses the row's two frame groups of that size and switches on every other attack (Rudy's punch: frames 0–3 the right hand, 4–7 the left). A sheet may also carry a **death row** (`deathRow` + `deathFrames`, default 4) played on defeat while the body slides a little back. `facing = -1` mirrors horizontally.

## The asset conventions

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
| `assets/sounds/ambience.mp3` | the default street ambience (the fallback) |
| `assets/sounds/<street>-boss-music.mp3` | the fight music of a street (loop) |
| `assets/sounds/<street>-boss-intro.mp3` | the boss's introduction sentence (once, on top of the music) |
| `assets/sounds/<street>-<interaction>-<index>.mp3` | the sound of a walkable interaction (the trigger index) |
| `assets/sounds/<street>-congratulations.mp3` | the victory jingle (once) |
| `assets/sounds/game-over.mp3` | the death music (once) |

**Every audio file is optional — a missing file means silence.** Only the assets named explicitly in a JSON file (e.g. the section background) report an error. The ambience starts **automatically at boot**: plain `play()`, then a muted start that unmutes once running (browsers block audible playback before the first gesture), then the first key press or click as the last resort.

## The numbers of the game

Change these only deliberately — the timings are what the game feels like.

| Constant | Value | Where |
|---|---|---|
| the canvas | 1600×800 | `src/world/layout.js` (+ `index.html`) |
| the ground line | y = 598 | `src/world/layout.js` |
| the entry points | x = 50 (left) / x = 1450 (right) | `src/world/layout.js` |
| the street-end wall | 40 px | `src/world/layout.js` |
| the patrol stretch | the whole section: x = 0…1450 | `src/world/layout.js` |
| the walk cycle | 80 ms per frame, 8 frames | the character config / `asset-conventions.js` |
| the punch | 17.5 ms per frame, 4 frames per move (`moves[].frames` overrides) | the character config |
| the strike reach | 80 px (hitbox edge to hitbox edge) | `src/domain/combat/combat.js` |
| the RPS tie window | 100 ms inclusive | `src/domain/combat/combat.js` |
| the damage | 1 per blow | `src/domain/combat/combat.js` |
| the hit knockback | 100 px (melee only — never the vomit) | `src/domain/combat/combat.js` |
| the recovery | per character (`recoveryMs`); the player has none | the character config |
| the hitbox | `{ x: 55, y: 120, w: 20, h: 25 }` (`w: 40` for the boss) | the character config |
| the walkable sequence | 1000 ms in, the trigger's `stay`, 1000 ms out, the exchange 300 ms before the exit | `src/app/walkable-interaction.js` |
| the blood | 3×3 px squares, 12 per blow | `src/render/blood.js` |
| the spit | 5×5 px squares, 40 per burst, hits within 300 px, lands at 600 px | `src/render/vomit.js` |
| the hue distance | at least 45° from the original colors and from each other | `src/world/entity-hues.js` |
| the hue pool | 48 hues, drawn anew for every game | `src/domain/quest/session.js` |
| the debug speed | ×4 while Shift is held | `src/domain/actors/player.js` |

## The controls

Desktop keyboard. The move and the jump keys live in the character config.

- ← / →: walk (he keeps walking in place when blocked).
- Space: punch (he stands still while attacking, alternating hands).
- ↑: jump (the walk cycle plays in the air; holding ↑ keeps hopping) — **except** at a walkable spot, where ↑ enters the interaction instead.
- ↓: **does nothing** — the backward step (the "moonwalk") was removed by the owner on 2026-10-19; the jump is the only evasion. The key is still swallowed so the page does not scroll.
- Shift (either one): a debug run — 4× faster while walking.
- On the end screen: click the button or press **Enter** to restart (Space does not).

## Where the behaviour lives

The fastest way into the code. FEATURES.md describes *what* each of these does; this table says *where*.

| Question | File |
|---|---|
| How is the game assembled? | `src/main.js` |
| How does the loop and the screen switch work? | `src/app/game.js` |
| How does a frame of the gameplay work? | `src/app/play-screen.js` |
| How does the player move, jump and punch? | `src/domain/actors/player.js` |
| How does a hostile behave and fight? | `src/domain/actors/enemy.js` + `src/domain/actors/behavior.js` |
| How is a blow resolved and arbitrated? | `src/domain/combat/combat.js` + `src/domain/combat/arena.js` |
| How is the geometry of a character computed? | `src/domain/actors/hitbox.js` |
| How do the conditions and the effects work? | `src/domain/quest/triggers.js` + `src/domain/quest/trigger-vocabulary.js` |
| Where do the hostiles' positions and corpses live? | `src/domain/quest/hostile-states.js` + `src/domain/quest/session.js` |
| How does a section load, spawn and unload? | `src/world/section.js` |
| How does a street end and the mission advance? | `src/world/world.js` + `src/domain/quest/mission.js` |
| How does a walkable spot work? | `src/app/walkable-interaction.js` |
| What does the HUD and the mission log draw? | `src/render/hud.js` |
| How are the overlays drawn? | `src/render/overlays.js` |
| How do the blood and the spit work? | `src/render/particles.js` + `src/render/blood.js` + `src/render/vomit.js` |
| How are the sounds played? | `src/audio/audio.js` |
| How is a config read and validated? | `src/domain/content/street-schema.js`, `character-schema.js`, `content-repository.js` |
| How is an asset path built? | `src/domain/content/asset-conventions.js` |

## Known gaps

What is **not** in the game yet is tracked in the **Todo** table of [PLAN.md](PLAN.md) — that is the one place for it, so it never drifts from the owner's list. Everything that **is** in the game is listed in [FEATURES.md](FEATURES.md).

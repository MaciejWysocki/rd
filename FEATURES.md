# FEATURES.md — feature set & progress tracker

Status legend: **done** (works in game) · **partial** (some behavior exists) · **data-only** (JSON/scaffolding exists, no behavior) · **planned** (expected, nothing yet).

Keep this file up to date when a feature lands or changes. Context in [AGENTS.md](AGENTS.md).

## Core gameplay

| Feature | Status | Notes |
|---|---|---|
| Walking (←/→) with collision | done | `player.js`, solids from section `boundaries`; blocked → walks in place |
| Punching (Space) | done | **Every press is a punch** (owner 2026-10-12): no player delays (`recoveryMs: 0`), presses during a blow queue up and fire right after it; alternates hands every other punch (frames 0–3 / 4–7, configurable via move `alternate`); the blow is resolved at full extension — 1 damage per hit, hit/miss sounds (`player-attack-hit`/`-miss`). Reach is measured **hitbox-edge to hitbox-edge** over slightly **narrowed hitboxes** (`x 55, w 40`, owner 2026-10-13) |
| Combat: first-to-strike + timed evasion | partial | **First-to-strike done** (P0.2): the hit resolves at attack-animation finish, interrupts the defender's blow; enemies recover between blows (`recoveryMs`), **the player has no delays** (owner 2026-10-12). Timed retreat/jump dodges = P1.2 (walking away already works as the retreat) |
| RPS tie-break on simultaneous strikes | planned | ~100 ms tie buffer counted at animation finish: headbutt > punch > kick > headbutt |
| Move sets per character (key + sprite row) | done | `data/characters/*.json`; e.g. `lysyblokers` = headbutt only; Rudy gains headbutt/kick via missions |
| Character stats via config files | done | `data/characters/*.json`: hp, walk/attack speed, hitbox, sprite name, moves |
| Audio by convention | done | `player-attack-miss`/`-hit` and `<enemyName>-attack-miss`/`-hit` on every resolved blow, `<who>-jump`, `<street>_<section>-ambient` loop, `boss-intro` + `boss-music` on the boss fight, `game-over` death music; all files optional (missing = silence) |
| Universal combat system (Rudy = NPCs = bosses) | done | `src/actors/combat.js`: one strike resolution for the player, enemies and bosses; they differ only in stats, speeds and move sets |
| Taking damage / HP / defeat | done | HP is a character param (`data/characters/*.json`), 1 damage per blow, 0 = defeat; the defeated plays the **fall animation** (4 frames of the sheet's `deathRow`, body slides a little back) and the corpse persists across section visits |
| Blood VFX + corpses | partial | **Corpses done** (P0.2 + owner 2026-10-13): the defeated fall and lie **where they fell, persisting across section visits** (kills recorded in `State.defeatedEnemies`, session-only); blood VFX = P1.4 |
| Section transitions along street route | done | Open edges (`exitLeft`/`exitRight`) in street JSON |
| Patrol enemy (`lysyblokers`) | done | Paces spawn-point ↔ first solid; breaks patrol to fight when the player comes close (aggro 350 px, attacks in reach). Slow telegraphed headbutt (`attackFrameMs: 75`) and he **lingers in the full stretch for 0.5 s** before straightening (`attackHoldMs: 500`) — owner 2026-10-12 |
| Enemy: `rat` | planned | Skipped at spawn until it has a character config |
| Enemy: `thug` | planned | No character config yet; a type without one is skipped at spawn |
| PoC boss (`boss_zul`, the bum, in `ulica-01/02`) | done | Stands idle without beer (and cannot be struck) — shown as the **`ulica-01_02-zul.png` idle pose** (128×128 at 1379, 611, boss `idleOverlay` config) in the background instead of the sprite's first frame; carrying `beer` (`trigger.hasItem`) fires `boss-intro` + boss music and the fight starts (walking, fighting sprite as before); defeat → congratulatory message + world flag `boss_zul_defeated` (P0.4/P0.5) |
| Boss intro cutscene (anim + sound, immobilizes player) | planned | Generalize the `shop-entry.js` scripted-sequence pattern |
| Main mission (spans the whole street) | planned | One mission across all sections; `State.quests` is the only trace so far |
| Side quest (one per section) | planned | Each section gets its own local quest |
| Section bosses (quest-linked or standalone) | data-only | Boss slot + flag conditions exist; a boss may tie to a side quest, the main mission, or no mission at all |
| NPC townsfolk + dialogue | planned | Example NPCs (`babcia_kasia`, `pijak_jozef`) removed from the street JSON — not part of the current plan |
| Chest interaction (`giveItem`) | planned | Example `skrzynka_1` removed from street JSON; type stays in the schema, no code handles it |
| Shop | done | **Automated & invisible**: `ulica-01_01-sklep.png` overlay (512x512 at 158, 288) highlights the shop while the player stands at the door **and through the whole enter/inside/exit sequence**; **money-driven** (owner 2026-10-12): with coins → `ulica-01_01-sklep.mp3` (buys beer) and, **the moment he comes out of the shop, +`beer` in the inventory and −1 coin at the same instant** (owner 2026-10-12: both HUD rows change together), broke → `ulica-01-01-sklep2.mp3` and back out after only **1 second** (no other logic); no UI |
| Door interaction (`goToRoute`) | data-only | `door` type stays in the schema; no code handles it (example removed from street JSON in P0.7) |
| HUD (HP, money, items) | done | Top-left corner (owner 2026-10-12): **hearts** — one `assets/hud/hp.png` per 1 HP (Rudy: 5) — **coins** below — one `assets/hud/money.png` per coin (5 PLN) — and **one row per carried item type** below the coins (owner: beer as the 3rd row), one `assets/hud/<itemId>.png` icon per unit. A zero row disappears entirely and the rows below collapse. **Top-right corner: the enemy's HP as hearts while it is in fight mode** (owner 2026-10-13). Counters live in `State` and update live |
| Game over screen (stats + death music + restart button) | done | On Rudy's HP 0 (P0.6): statistics (game time, defeated enemies, coins) + `game-over.mp3` death music + **ZAGRAJ PONOWNIE** button (also Enter/Space) → fresh game (`State.resetForNewGame`). **No saves — session-only play** |
| Data-driven content (configurable via files) | partial | Street JSON works; goal: new section/street = files only (see AGENTS.md "Content pipeline") |
| Jump (walk cycle in the air) | done | **↑ (ArrowUp)** — shop door entry takes priority there; the regular walk animation plays through the hop ("walking in the air"); **holding ↑ keeps hopping** (restarts on landing); `player-jump.mp3`; side arrows stay live mid-jump; configurable `jumpKey`/`jumpDurationMs`/`jumpHeightPx` |
| Retreat (timed evasion) | planned | Phase 1 dodge; jump gains its combat semantics there too |
| Neutral pedestrians (GTA-like: flee / fight / take a beating) | planned | Post-PoC (Phase 3) |
| Dialogue MP3s + random catchphrase loops | planned | Most characters silent; objectives as very brief text |
| Collapsible menu (stats, missions, street status, timer) | planned | Congratulatory message on street completion (Phase 4) |
| Mission stat boosts (no XP / leveling) | planned | Each mission slightly boosts stats |
| Item-driven spawns (beer → boss in another section) | done | `State.matchesConditions` (`flagsTrue`/`flagsFalse`/`hasItem`) gates the boss spawn; the boss `trigger` (`hasItem: ["beer"]`) starts the fight — the PoC beer → bum mechanic (P0.4) |
| Audio layering (ambient → section music → boss music) | planned | Highest active layer wins |

## World data

| Street | Sections | Route | Content status |
|---|---|---|---|
| `ulica-01` | `01` Podwórze, `02` Zaułek | `01 → 02 → 01` | **PoC content fully playable**: section 01 = `lysyblokers` (patrol + combat) + the beer shop; section 02 = the bum boss `boss_zul` (idle without beer, fight on `beer`) |

## Assets

| Asset | Used for |
|---|---|
| `assets/sprites/rudy_dres.png` | Player sheet (walk row 0; punch = row 1, frames 0–3) |
| `assets/sprites/lysyblokers.png` | Patrol enemy sheet |
| `assets/sprites/boss_zul.png` | Boss sheet — **placeholder**: duplicate of `lysyblokers.png`, replace with real art |
| `assets/bg/ulica-01_01.png`, `ulica-01_02.png` | Section backgrounds |
| `assets/bg/ulica-01_02-zul.png` | Boss idle pose overlay (128×128 at 1379, 611) — the bum waiting in the Zaułek background before the fight |
| `assets/hud/hp.png`, `assets/hud/money.png` | HUD icons (64×64) — one heart per HP, one coin per money unit |
| `assets/hud/beer.png` | HUD item icon — **placeholder**: duplicate of `hp.png`, replace with real art |
| `assets/sounds/player-attack-miss.mp3`, `player-attack-hit.mp3` | Rudy's blow, whether it landed (`-hit` is a placeholder copy of `-miss`) |
| `assets/sounds/lysyblokers-attack-miss/-hit.mp3`, `boss_zul-attack-miss/-hit.mp3` | Enemy/boss blows — **placeholder** copies of `player-attack-miss.mp3` |
| `assets/sounds/player-jump.mp3` | The ↑ hop |
| `assets/sounds/ulica-01_01-sklep.mp3` | Shop jingle — played when entering with coins (the beer purchase) |
| `assets/sounds/ulica-01-01-sklep2.mp3` | No-coin shop jingle (name taken verbatim from the 2026-10-12 instruction; configured as `soundNoMoney`) |
| `assets/sounds/boss-intro.mp3`, `boss-music.mp3` | Boss fight trigger + fight music — **placeholder** copies (`player-jump`/`ulica-01_01-sklep`), replace with real audio |
| `assets/sounds/game-over.mp3` | Death music on the game over screen — **placeholder** copy of `ulica-01_01-sklep.mp3` |

Backgrounds will be **real photographs of the actual street** (owner-supplied), scaled to the 1600x800 canvas. Sprites and audio are **produced by the owner**: frame-by-frame 2D sprites and own sound effects / music.

## Confirmed design (from the owner)

- **Genre & look**: simple "karate" beat-'em-up in the style of Amiga titles like *Renegade* / *Final Fight*; single static background screens switched on area exit (like the Atari game *Ninja*), no continuous scrolling.
- **Setting**: a specific real street in the owner's city; section backgrounds are photographs of its various sections.
- **Pillars**: combat and questing — main mission across the whole street, one side quest per section, per-section boss optionally linked to either quest or to nothing.
- **Assets**: owner-made frame-by-frame 2D sprites; owner-made sound effects and music.
- **World**: streets (starting with one), each made of sections (starting with two) forming a sequence traversed back and forth — a section can be revisited, e.g. `01 → 02 → 01 → 02`.
- **Section enter pipeline**: load image → set boundaries → generate standard NPCs → generate enemies → check boss conditions → check interactions. **Exit**: standard NPCs / enemies / bodies reset; quests, inventory, money, world flags and stats do not reset → enables "Oh, I came back here and things are different now."
- **Combat**: universal logic for Rudy, standard NPCs and bosses; they differ only in their parameters. Each character has one to several attacks.
- **Sprites**: initially all frames 150x150px — 8 frames walking, 4 frames per attack.
- **Content**: ultimately configurable via files; new section = image + section JSON + characters + quests/conditions + audio; new street = `data/streets/<street>/` directory.
- **Full mechanics spec & phased implementation plan**: [PLAN.md](PLAN.md) — combat (first-to-strike, RPS tie-break at animation finish, timed retreat/jump, per-character move sets & speeds), HP/death/blood/corpses, game over screen (no saves), items & mission inventory, three boss types, dialogue, audio layering, UI menu, PoC scope.

## Decisions answered (owner, 2026-10-11)

All four open questions are answered and folded into PLAN.md ("Former 'Open decisions' — answered" + phases):

1. **Player defeat** → game over screen with statistics, death music, restart button; **no saves, no saving capability**.
2. **Combat timing** → ~100 ms tie buffer counted at attack-animation finish (full stretch); per-character movement/attack speeds; retreat/jump unbuffered — dodge before the animation finish and you are not hit.
3. **Shop** → fully automated and invisible (entrance is part of the background); entry mp3, different mp3 after buying beer (piwo).
4. **Objectives / HP / info display** → subject of PoC testing (P0.8 experiment); owner decides after playtests.

⚠ One contradiction to confirm: the earlier expectation said "mission status saved in the browser, with reset option"; the new answer says **no saving capability**. The docs and plan follow the new answer (session-only play).

## Changelog

- 2026-10-11: file created. Baseline: walking, collisions, section transitions, `lysyblokers` patrol, punch animation, shop entry sequence.
- 2026-10-11: owner-confirmed design folded in (world model, enter/exit reset semantics, universal combat, 4-frames-per-attack sprites, file-configurable content); "more streets" question resolved.
- 2026-10-11: owner vision folded in: Amiga-style "karate" beat-'em-up (*Renegade*/*Final Fight*) on a real photographed street, static screens switched on exit (Atari *Ninja* style), combat+questing pillars (main mission + per-section side quest, flexible bosses), owner-made art/audio, config-driven architecture goal.
- 2026-10-11: final expectations (21 points) folded into **PLAN.md** — phased workable plan (Phase 0 PoC first: single-blow combat, beer → bum boss, congrats, browser save + reset). Combat spec locked (first-to-strike, RPS tie-break headbutt>punch>kick>headbutt, timed retreat/jump, key+sprite-row move config); X-only movement, browser save + reset, no XP/leveling confirmed; open questions reduced to 4 non-blocking ones.
- 2026-10-12: owner answered the open decisions (game over screen + death music + restart, **no saves**; ~100 ms tie buffer at animation finish, unbuffered dodges, per-character speeds; automated invisible shop with two mp3s; info display TBD via testing). PLAN.md reworked into a **markable task list** (stable IDs P0.1–P5.3, checkbox + status emojis, Status board). ⚠ "No saves" supersedes the earlier browser-save expectation — flagged for confirmation.
- 2026-10-12: **pre-PoC refactor**: game data extracted to config files (`data/characters/*.json` with stats/hitbox/moves; streets at `data/streets/*.json`), convention-based audio (`player-attack-miss`, `<enemy>-attack-*`, `<street>_<section>-ambient`, `boss-intro`; all optional), simplified attack model (one move = one 4-frame row), dead code removed (`State.serialize`, `level`/`experience`, `ENEMY_TYPES`, `ArrowDown`), example NPCs (`babcia_kasia`, `pijak_jozef`) dropped, `boss_kozak` → `boss_zul`, `rudy_dres-punch-miss.mp3` → `player-attack-miss.mp3`. Covers PLAN.md P0.1.
- 2026-10-12: **changes**: removed `szczur_1` + `skrzynka_1` examples from the street JSON; fixed section 02's right wall (full height at x=1550) so Rudy is blocked flush with the viewport at the street end; alternating punch hands (frames 0–3 / 4–7) via move flag `alternate`; player **jump** (config `jumpKey` default KeyZ, `player-jump.mp3`, first walk frame, draw-offset hop).
- 2026-10-12: **jump rework**: jump moved to **↑ (ArrowUp)** with shop-door entry taking priority; side arrows stay live during the hop (drift left/right on the fly); blocked movement now **walks in place** (walls and world ends).
- 2026-10-12: **polish**: jump now plays the **regular walk animation** ("walking in the air", arrows keep it cycling); shop highlight is the `ulica-01_01-sklep.png` overlay (512x512) at **x 158, y 288** via the interaction's `highlight` config — the yellow rectangle is gone.
- 2026-10-12: shop highlight now stays visible **through the whole shop sequence** (enter, inside, exit); **holding ↑ keeps hopping** (jump restarts on landing; shop entry still wins at the door on the press).
- 2026-10-12: **HUD + shop economy**: top-left HUD — hearts (one `assets/hud/hp.png` per 1 HP, Rudy starts at 5) and coins below (one `assets/hud/money.png` per coin = 5 PLN, Rudy starts with 1; a zero row disappears entirely); both counters live in `State` (`stats.hp`, `money`) and are seeded from `data/characters/player.json`. Shop visits are **money-driven** (owner instruction; supersedes "different mp3 after buying beer"): with coins → `ulica-01_01-sklep.mp3` (buys beer, **−1 coin when the player exits**), broke → `ulica-01-01-sklep2.mp3` and back out after only **1 second**.
- 2026-10-12: **Phase 0 (PoC) complete** (PLAN.md P0.2–P0.8, all verified in the browser):
  - **P0.2** trading single blows: `src/actors/combat.js` resolves every blow at the attack's full extension (1 damage, hit/miss sounds, the hit interrupts the defender's blow, ~0.7 s recovery for both); HP counts down to 0 = defeat, the defeated lie on the ground until section exit. `lysyblokers` breaks its patrol to fight (aggro 350 px). Rudy beat him and was beaten by him in playtests.
  - **P0.3** the shop's beer lands in the inventory on purchase (paid on exit, as before).
  - **P0.4** conditional boss: `State.matchesConditions` (`flagsTrue`/`flagsFalse`/`hasItem`) gates the boss spawn, the boss `trigger` (`hasItem: ["beer"]`) starts the fight (`boss-intro` + `boss-music`, new `src/actors/boss.js`); without beer the bum stands idle and cannot be struck; his defeat sets `boss_zul_defeated`.
  - **P0.5** victory message "Gratulacje! Pokonałeś żula!" on the bum's defeat (brief, shown once).
  - **P0.6** game over screen (`src/game/game-over-state.js`): statistics (game time, defeated enemies, coins) + `game-over.mp3` death music + **ZAGRAJ PONOWNIE** button (click/Enter/Space) → fresh game via `State.resetForNewGame` (no saves).
  - **P0.7** street JSON = PoC content only (boss on the ground strip with `conditions` + `trigger`; unused `door` example removed); `level`/`experience` confirmed gone from `State.stats`.
  - **P0.8** HUD gains **item rows below the coins** (owner: beer as the 3rd row) — one `assets/hud/<itemId>.png` per unit (placeholder `beer.png`), empty rows collapse.
  - Placeholder assets added for later replacement: `boss_zul.png` (copy of `lysyblokers.png`), `hud/beer.png` (copy of `hp.png`), `player-attack-hit`, `lysyblokers-attack-*`, `boss_zul-attack-*`, `boss-intro`, `boss-music`, `game-over` (copies of existing mp3s).
- 2026-10-12: **owner changes**: stamina is gone from the game and all plans for good — the game must stay dynamic and stamina made it slow (PLAN.md P5.1 removed, phase 5 is now "Expansion & polish"; there was no stamina code). Shop timing fixed: the `beer` appears in the inventory and the coin disappears **in the same moment Rudy comes out of the shop** (was: beer at purchase inside, coin only at the end of the walk-out).
- 2026-10-12: **owner changes (dynamic combat)**: **every Space press is a punch** — the player's recovery is gone (`recoveryMs: 0`) and presses made during a blow queue up instead of being dropped (no player delays at all). `lysyblokers` hits **slower** (`attackFrameMs: 25 → 75`) and **lingers in the full headbutt stretch for half a second** before straightening (`attackHoldMs: 500`; the hold is a per-character parameter, default 0.15 s).
- 2026-10-12: **death animation**: the rotation placeholder is gone for sheets with a fall row — on defeat the character plays **4 frames of its `deathRow`** (`lysyblokers` = row 2 of `lysyblokers.png`, which presents the fall) while the body **slides a little back**, then holds the lying frame until section exit. `boss_zul` uses the same row (his sheet is an identical placeholder copy). Sheets without a death row (Rudy today) keep the rotated placeholder.
- 2026-10-13: **owner changes**: the HUD shows **the enemy's HP as hearts in the top-right corner while it is in fight mode** (patrol broken / boss fight started). **Kills are persisted in the game state** (`State.defeatedEnemies`, id → where the body lies): going to section 02 and back still shows the corpse where it fell instead of a fresh enemy. **Hit detection tuned**: a brief centre-based rule proved too narrow and was reverted to the plain **hitbox-edge to hitbox-edge** measure; the fine-tuning is **slightly narrower character hitboxes** (`{ x: 55, y: 120, w: 40, h: 25 }`, was 50 wide).
- 2026-10-13: **boss idle pose** (owner): entering `ulica-01/02` without beer no longer shows the boss sprite's first frame — the bum waits **in the background** as the `ulica-01_02-zul.png` pose (128×128 at **1379, 611**), configured via the boss's `idleOverlay: { image, x, y }` in the street JSON (same shape as the shop `highlight`). Entering with `beer` is unchanged: `boss-intro` + boss music and the walking, fighting sprite.
- 2026-10-13: **debug run** (owner): holding **Shift** (either one) moves Rudy **4× faster** while walking — the walk cycle scales with the speed (`|vx|`) and the mid-jump drift is boosted too. Testing aid in `src/actors/player.js` (`DEBUG_SPEED_MULTIPLIER`).

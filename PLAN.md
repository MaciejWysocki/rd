# PLAN.md — implementation plan (for future agents)

Companion docs: [AGENTS.md](AGENTS.md) (context & conventions — read first), [FEATURES.md](FEATURES.md) (status tracker).

## 🗺 How to use this plan (markable task list)

- Every task has a **stable ID** (`P0.2`, `P1.1`, …) and a name. Reference tasks by ID or name in commits, notes and chat — e.g. *"rework P0.2"* or *"rework simple combat"*.
- Work on the **first task with status ⬜ in the lowest-numbered phase**. Do not skip ahead unless told to.
- Status emojis live in the task checkbox lines and must stay in sync with the checkboxes:

| Mark | Meaning |
|---|---|
| ⬜ | not started — `- [ ]` |
| 🔄 | in progress — `- [ ]` |
| 🔁 | rework requested/underway (task was done or needs change) — `- [ ]` |
| ⏸ | blocked (write a note why) — `- [ ]` |
| ✅ | done — acceptance criteria verified in a real browser run — `- [x]` |

- **Finishing a task**: verify acceptance by actually playing the game (serve the repo root, open `index.html`), check the box `[x]`, set ✅, update the **Status board**, and add a FEATURES.md changelog line naming the task ID. If a convention changed, update AGENTS.md too.
- **Reworking a task**: set its status to 🔁, reference it by ID/name, fix, re-verify, mark ✅ again.

## 📊 Status board

| Phase | Scope | Progress | Status |
|---|---|---|---|
| 🧪 0 | PoC — mechanics test bed (**PRIORITY**) | 8/8 | ✅ |
| ⚔️ 1 | Full combat system | 0/4 | ⬜ |
| 📜 2 | Questing & world-state engine | 0/3 | ⬜ |
| 🚶 3 | NPCs & dialogue | 0/2 | ⬜ |
| 👑 4 | Boss framework, audio layering, UI menu | 0/3 | ⬜ |
| 🧰 5 | Expansion & polish | 0/2 | ⬜ |

Overall: 🔄 — **Phase 0 (PoC) complete and verified in the browser (2026-10-12)**: trading single blows with HP/defeat, the money-driven shop with `beer` → inventory, the beer-triggered bum boss (`boss_zul`) with intro + boss music, the congratulatory message on his defeat, the game over screen (stats + death music + restart) and the HUD (hearts / coins / item rows). Next up: Phase 1 (full combat system) — P1.1.

## 🔒 Locked design decisions (owner; includes answers from 2026-10-11)

### Platform & presentation
- Desktop play, keyboard only; launched via web browser, no installation.
- One **static background image per section** — no scrolling at all; the image only changes between sections.
- Backgrounds: side-view street imagery (buildings/scenery behind) with a **flat street/sidewalk strip at the bottom where characters move**.
- The only playable character is **Rudy dres** (tracksuit guy).

### Movement & world
- Rudy moves **left/right (X axis only)** and interacts with the environment at mission-specific locations; enemies appear at designated spots; combat is real-time.
- Section transition happens when the player reaches a section edge. At the **ends of the street the boundary blocks him and he walks in place**.
- Sections can be revisited; mission progress can change a previously visited section (e.g. spawn a different character type).

### Combat
- **First to strike lands the hit.** The defender can evade by **retreat or jump**.
- The hit is resolved **at the finish of the attack animation (full stretch of the punch/headbutt/kick)**: if you see the attack and retreat/jump **before the animation finishes**, you are **not hit**. Retreat and jump are **not buffered**.
- If both attack animations finish within a **~100 ms tie buffer**, resolve Rock-Paper-Scissors: **headbutt beats punch, punch beats kick, kick beats headbutt**.
- Range attacks like vomit never tie, they always hit unless retreated/jumped away.
- **Movement and attack speeds differ per character** (parameters — players and enemies alike).
- Move sets are configured per character by **key mapping + sprite row number** (`{ key, row, type: punch|kick|headbutt|vomit }`) — never hardcoded. Often just one move (the bald thug `lysyblokers` only headbutts); Rudy starts with a punch and gains headbutt + kick later, via missions.
- PoC simplification: **trading single blows**, HP counts down from a few points to zero.

### Health, death, effects
- **HP is a character parameter; HP 0 = defeat.**
- **Player defeat → game over screen**: statistics + **death music** in the background + **restart button** (restarts a fresh game).
- **No saves, no saving capability** — game state is session-only. ⚠ *This supersedes the earlier expectation "mission status saved in the browser + reset option"; if persistence is wanted again later, the owner must say so.*
- Blood is a visual effect only; defeated characters **lie on the ground and persist across section visits** — the kill is recorded in the global `State` (`defeatedEnemies`, session-only) and the corpse reappears where it fell (owner 2026-10-13).
- **No XP, no leveling.** Progression and items are tied to missions; **each mission gives a slight stat boost** (`level`/`experience` in `State.stats` are dead weight — remove them, P0.7).

### Items & economy
- The shop is **fully automated and invisible** — its entrance is part of the background art. The visit is **money-driven** (owner 2026-10-12): entering with coins plays `ulica-01_01-sklep.mp3` (the beer purchase) and the moment he **comes out of the shop the beer appears in the inventory and the coin disappears — same instant** (owner 2026-10-12, both HUD rows change together); entering with no coins plays `ulica-01-01-sklep2.mp3` and sends the player back out after **1 second** (no other logic). There is no shop UI at all.
- **Mission items** stay in the inventory for the duration of the task (e.g. documents taken from someone and delivered elsewhere).
- Items can drive the world: **possessing beer triggers the bum boss to spawn in another section**.

### Quests & world state
- Two pillars: **combat and questing**.
- One **main street mission** spanning all sections — deliberately **non-linear** (not 01 → 02 → …); moving back and forth is encouraged and progress may alter previously visited sections.
- **One side quest per section**, independent of the others, scoped to the player's current section.
- Tasks **alter world state**: e.g. helping a shopkeeper makes the shop open later — enter, get an item, or bypass a fight.

### Bosses
- A boss lives in a **fixed section**; copying the config entity creates a **separate boss instance**; `"boss": null` = no boss in that section.
- Three types: (a) **section boss** — a dangerous spot where entering triggers the fight; (b) **side-mission boss** — appears in select sections, tied to a side quest; (c) **street-mission boss** — appears only after **all street-mission tasks for that section are completed** and specific conditions are met.
- A boss fight opens with a **special animation + sound effect ("cutscene") that immobilizes the player** — generalize the existing `shop-entry.js` scripted-timeline pattern.
- Sections also contain **neutral pedestrians (GTA-like)** whom the player may choose to fight.

### NPCs & dialogue
- Random passersby (later): may flee, start a fight, or simply take a beating if attacked.
- **MP3-based dialogue**: most characters stay silent or have a catchphrase that triggers randomly on a loop. Mission objectives are shown as **very brief text** describing the next step.

### Audio (layered — highest active layer wins)
1. street ambient sound
2. section music (overrides the ambient)
3. boss music (overrides the section music)

### UI
- **Game over screen**: statistics + death music + restart button (see Health).
- **HP / money: top-left HUD** (owner decision 2026-10-12) — hearts (one `assets/hud/hp.png` per 1 HP) and coins below (one `assets/hud/money.png` per 5 PLN coin); **objectives / other information remain TBD through testing** (P0.8 experiment).
- A **collapsible menu** at the side/corner: stats, list of completed missions, current "street mission" status, and a **game timer**. Completing the street shows a **congratulatory message** (Phase 4).

## ✅ Former "Open decisions" — answered (owner, 2026-10-11)

1. **Player defeat** → game over screen with statistics, death music in the background, and a restart button. **No saves, no saving capability.** (⚠ supersedes the earlier "save in browser + reset" expectation — see flag above.)
2. **Combat timing** → tie buffer very low, **~100 ms**, counted from the **end of the attack animation (full stretch)**. Player and enemies have **different movement and attack speeds**. Jump and retreat are **not buffered**; the hitbox is checked at the finish of the attack animation — dodge before the finish and you are not hit.
3. **Shop** → fully automated and invisible; the entrance is part of the background; entering plays an mp3 and buying beer (piwo) plays a different mp3.
4. **Objectives / HP / info display** → subject of testing; the best solution is yet to be discovered (treated as an experiment in P0.8).

## 🧪 Phase 0 — PoC: two sections, mechanics test bed (PRIORITY)

Owner's scope: section 1 (`ulica-01/01`) holds **one enemy — `lysyblokers` — plus the shop**; section 2 (`ulica-01/02`) holds the **bum boss**. Without beer in the inventory the bum **stands there and does not react**; with beer he **triggers an audio clip, boss music starts, and the fight begins**. Combat is **trading single blows** with a simple HP counter (a few points) down to zero. Defeating him shows a **congratulatory message**.

- [x] ✅ **P0.1 — Character & move configuration (data-driven)** *(done in the 2026-10-12 pre-PoC refactor)*
  - Files: `data/characters/*.json` (`player`, `lysyblokers`, `boss_zul`), `src/actors/character-defs.js`, `src/actors/actor.js`, `src/actors/player.js`, `src/actors/enemy.js`, `src/main.js`.
  - Move set per character: `{ key, row, type: punch|kick|headbutt }` (4 frames per move row; `"alternate": true` alternates the row's two 4-frame groups on every other attack — Rudy's punch: 0–3 / 4–7 hands); walk stays row 0 (8 frames); per-character movement and attack speed parameters; player config also carries `jumpKey`/`jumpDurationMs`/`jumpHeightPx`. PoC moves: Rudy → punch (row 1), `lysyblokers` → headbutt, `boss_zul` → headbutt.
  - Acceptance (verified in browser 2026-10-12): the game runs on configs alone; changing a move's key/row/type or a character's speeds is a JSON-only edit.
- [x] ✅ **P0.2 — Simple combat (trading single blows)** *(done + verified in browser 2026-10-12)*
  - Files: `src/actors/*` (new `combat.js`), `src/game/play-state.js`.
  - First-to-strike lands the hit; damage applies at the finish of the attack animation; HP is a few points counting down; HP 0 → character defeated, lying on the ground until section exit. A landed hit interrupts the defender's blow. Recovery is per character (`recoveryMs`) — **the player has none: every Space press is a punch** (owner 2026-10-12, no player delays); enemies hold the full-stretch frame (`attackHoldMs`) before recovering.
  - Acceptance (verified 2026-10-12): Rudy beat `lysyblokers` (3 blows, retreat between strikes); Rudy was defeated by him (→ P0.6 screen). Damage is observable at full extension.
- [x] ✅ **P0.3 — Automated invisible shop (beer)** *(done + verified in browser 2026-10-12)*
  - Files: `src/game/shop-entry.js`, `src/game/play-state.js`, street JSON (`sound`, `soundNoMoney`), `src/render/hud.js`.
  - **Money-driven** (owner instruction 2026-10-12, supersedes the earlier "different mp3 after buying beer" wording): entering with coins plays the purchase mp3 (`assets/sounds/ulica-01_01-sklep.mp3`); entering with no coins plays `ulica-01-01-sklep2.mp3`, keeps the player inside only **1 second** and exits — nothing else. No UI.
  - Done (owner 2026-10-12): the moment Rudy **comes out of the shop**, the `beer` appears in the inventory and the coin disappears — **same instant** (both HUD rows change together).
  - Acceptance (verified 2026-10-12): visit with a coin → purchase jingle + beer/coin swap at the coming-out moment; the next visit broke → second jingle + exit after 1 second. Inventory holds `beer` afterwards.
- [x] ✅ **P0.4 — Conditional boss (`boss_zul`, the bum) triggered by beer** *(done + verified in browser 2026-10-12)*
  - Files: street JSON (section 02 `boss`), `src/world/section.js`, `src/actors/boss.js`, `src/game/play-state.js`.
  - Boss conditions extend from flags to **items** (`hasItem: ["beer"]`): `conditions` gates the spawn (evaluated by `State.matchesConditions`), `trigger` gates the fight. Without beer: stands idle, no reaction (and cannot be struck). With beer: the `boss-intro` audio (by convention) + boss music + the fight starts. Defeat sets the world flag `<id>_defeated` so he stays down on later visits.
  - Acceptance (verified 2026-10-12): both paths observable in-game (no beer → idle bum, punches whiff; with beer → fight starts and he attacks).
- [x] ✅ **P0.5 — Victory message** *(done + verified in browser 2026-10-12)*
  - On boss defeat: congratulatory message (brief text, shown once for 5 s).
  - Acceptance (verified 2026-10-12): "Gratulacje! Pokonałeś żula!" appears once, exactly on the bum's defeat.
- [x] ✅ **P0.6 — Game over screen** *(done + verified in browser 2026-10-12)*
  - On Rudy's HP 0: game over screen with **statistics** (game time, defeated enemies, coins) + **death music** (`game-over.mp3`, optional by convention) + **restart button** (also Enter/Space) that starts a fresh game (`State.resetForNewGame` rebuilds everything). No save/load anywhere.
  - Acceptance (verified 2026-10-12): defeat → screen with stats and music; the button restarts the game cleanly (Rudy at the start, 5 HP, 1 coin, empty inventory).
- [x] ✅ **P0.7 — Config cleanup** *(done + verified in browser 2026-10-12)*
  - Street JSON reflects the PoC (boss = the bum on the ground strip with `conditions` + `trigger`; shop sells beer; the unused `door` example is out); `level`/`experience` were already gone from `State.stats` (no XP/leveling) — confirmed absent.
  - Acceptance (verified 2026-10-12): clean load with only PoC content active.
- [x] ✅ **P0.8 — Minimal in-game info display (experiment)** *(HP + money HUD done 2026-10-12; item rows added + verified 2026-10-12)*
  - Show minimal HP / objective feedback during play. **HP/money placement decided by the owner (2026-10-12)**: top-left corner — hearts (one `assets/hud/hp.png` per HP) and coins below (one `assets/hud/money.png` per coin). **Items get their own row below the coins** (owner: beer as a 3rd HUD row) — one `assets/hud/<itemId>.png` icon per unit; empty rows collapse. The rest stays experimental, owner evaluates during playtests.
  - Acceptance (verified 2026-10-12): the owner can evaluate an info display during PoC playtests (hearts → coins → item rows observed in-game).

## ⚔️ Phase 1 — Full combat system

- [ ] ⬜ **P1.1 — RPS tie-break + arbitration**
  - ~100 ms tie buffer counted from attack-animation finish (full stretch); simultaneous finishes → headbutt > punch > kick > headbutt.
  - Acceptance: simultaneous strikes resolve by the RPS table; single earlier strike always wins.
- [ ] ⬜ **P1.2 — Timed evasion (retreat + jump)**
  - Unbuffered dodges; the hitbox check at animation finish respects evasion — dodge before the finish → no hit, too late → hit. (The jump hop itself exists since 2026-10-12 — it already dodges the boss's vomit (owner 2026-10-15); this task adds its melee dodge semantics plus the retreat move.)
  - Acceptance: dodging just before the finish avoids damage; dodging after getting hit still takes it.
- [ ] ⬜ **P1.3 — Move sets & per-character speeds**
  - Multiple moves per character with mission-based unlocks (Rudy gains headbutt, then kick); per-move animation rows and hit feedback; distinct movement/attack speeds per character.
  - Acceptance: two characters with different move sets and speeds fight correctly against each other.
- [x] ✅ **P1.4 — Blood VFX + corpse polish** *(done + verified in browser 2026-10-14)*
  - Blood as a visual effect (`src/render/blood.js`, owner 2026-10-14): every landed blow sprays 3×3 px red squares out of the struck character; they fly away from the blow, arc down and land on the ground line (the struck character's feet), staining it until the section is left. Corpses already persist where they fell across section visits (kill recorded in the game state — owner 2026-10-13).
  - Acceptance (verified 2026-10-14): blood shows on hits; corpses lie where they fell on re-entry.

## 📜 Phase 2 — Questing & world-state engine

- [ ] ⬜ **P2.1 — Quest config schema**
  - Main street mission (non-linear, cross-section) + one side quest per section; triggers at mission-specific interaction points; conditions on flags/items/quests; **effects** (spawn changes, shop opens, fight bypassed, item granted/taken).
  - Acceptance: the beer → boss pattern is expressible purely in quest/effect config.
- [ ] ⬜ **P2.2 — Mission items & stat boosts**
  - Mission inventory (e.g. documents to deliver); slight stat boost per completed mission.
  - Acceptance: a mission item can be taken, carried and delivered; completing a quest visibly raises a stat.
- [ ] ⬜ **P2.3 — Section re-entry effects + objective text**
  - Quest-driven spawns applied on re-entry ("came back and things are different"); brief objective text (placement experimental until the owner decides).
  - Acceptance: completing a side quest visibly changes its section after leaving and re-entering.

## 🚶 Phase 3 — NPCs & dialogue

- [ ] ⬜ **P3.1 — Neutral pedestrians (GTA-like)**
  - May flee, start a fight, or simply take a beating when attacked.
  - Acceptance: a pedestrian reacts differently to being attacked vs ignored.
- [ ] ⬜ **P3.2 — MP3 dialogue & catchphrases**
  - Silent by default; random catchphrase loops; interaction at mission locations.
  - Acceptance: a catchphrase plays randomly on loop; mission NPCs respond at their locations.

## 👑 Phase 4 — Boss framework, audio layering, UI menu

- [ ] ⬜ **P4.1 — Three boss types as config**
  - Section / side-mission / street-mission bosses; copied config entity = new instance; `"boss": null` allowed; street-mission boss appears only after its section's street-mission tasks are done + conditions met.
  - Acceptance: all three types demonstrable via config alone.
- [ ] ⬜ **P4.2 — Generic intro cutscene**
  - Special animation + sound immobilizing the player (`shop-entry.js` generalized into a scripted-sequence runner).
  - Acceptance: player cannot act during the intro; the fight starts when it ends.
- [ ] ⬜ **P4.3 — Audio layering + collapsible menu**
  - Ambient → section music → boss music (highest wins); menu with stats, completed missions, street-mission status, game timer; congratulatory message on completing the street.
  - Acceptance: audio switches layers correctly during play; menu shows live state; street completion shows the message.

## 🧰 Phase 5 — Expansion & polish

- [ ] ⬜ **P5.2 — Content expansion**
  - More sections and streets via `data/streets/<street>/` directories (target layout in AGENTS.md); background photo crop/scale for the flat bottom strip.
  - Acceptance: a new section is addable as files only; a new street loads from its own directory.
- [ ] ⬜ **P5.3 — Random passersby & polish**
  - Passersby randomness; general polish.
  - Acceptance: passersby appear and react variably.

## 📎 Asset dependencies (owner-supplied; code picks by naming convention / config paths)
- Naming conventions (implemented in `src/audio/audio.js`): `player-attack-miss` / `player-attack-hit`, `<enemyName>-attack-miss` / `<enemyName>-attack-hit`, `<who>-jump` (e.g. `player-jump`), `<street>_<section>-ambient` (loop; falls back to the default street ambience `ambience.mp3`, which plays automatically at boot — owner 2026-10-14/15), `boss-intro` (the boss's introduction sentence, played once on top of `boss-music`), `boss-music` (loop), `game-over` (played once on defeat, no loop), `<street>-congratulations` (victory jingle, played once — owner 2026-10-15). **Every audio file is optional — a missing file means silence.**
- **PoC**: `player-jump.mp3`, `player-attack-hit.mp3`, `lysyblokers-attack-miss/-hit.mp3`, the "beer bought" (piwo) mp3, death music (`game-over.mp3`), `boss-intro.mp3`, boss music (`boss-music.mp3`). (`player-attack-miss.mp3` and `ulica-01_01-sklep.mp3` exist.)
- **Later**: `ulica-01_01-ambient`-style street ambient loops, section music, catchphrase mp3s, dialogue mp3s.
- **Sprites**: headbutt row for `lysyblokers`, `boss_zul` sheet, Rudy's headbutt + kick rows (Phase 1). The PoC works with existing sheets (a move = the first 4 frames of a row). Rudy's death row (`rudy_dres` row 2, all 8 frames) and the boss's (`boss_zul` row 2, first 4 frames) are in use — owner 2026-10-15.
- Convention-based sounds are always optional (silence when absent); only sounds explicitly configured in a JSON file (e.g. the shop `sound` field) report errors like other assets.

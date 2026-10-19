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
| ⚔️ 1 | Full combat system | 4/5 | 🔄 |
| 📜 2 | Questing & world-state engine | 0/3 | 🔄 |
| 🚶 3 | NPCs & dialogue | 0/2 | ⬜ |
| 👑 4 | Boss framework, audio layering, UI menu | 0/3 | ⬜ |
| 🧰 5 | Expansion & polish | 0/2 | ⬜ |

Overall: 🔄 — **Phase 0 (PoC) complete. P1.1, P1.2 and P1.5 implemented and browser-verified (2026-10-18)**: finish-time RPS arbitration, immediate jump evasion and collision-aware **100 px** knockback (the retreat was removed on 2026-10-19 — ↓ does nothing). P1.4 blood/corpses is also complete. **The street/mission configuration was migrated to the new schema and browser-verified (2026-10-19)**: the streets are played one after another by name, the mission (its stages and log lines) comes from the street config alone, the sections form a chain, the interactions are walkable spots and the hostiles take their fight trigger from the config. **The code was restructured into explicit layers on 2026-10-19 (the DDD refactor)** — a pure domain (`src/domain/`), the app layer (`src/app/`), the world (`src/world/`) and the adapters (`src/render/`, `src/audio/`, `src/input/`); the street config schema is **v2** (the unified trigger model with conditions and effects) and a street now ends when the mission is on its last stage and no boss is standing. **The gameplay behaviour did not change.** Next up: **P1.3 — Move sets & per-character speeds**, including mission-based unlocks.

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
- **First to strike lands the hit.** The defender can evade by **jumping** (the retreat was removed on 2026-10-19 — ↓ does nothing).
- The hit is resolved **at the finish of the attack animation (full stretch of the punch/headbutt/kick)**: if you see the attack and jump **before the animation finishes**, you are **not hit**. The jump is **not buffered**.
- If both attack animations finish within a **~100 ms tie buffer**, resolve Rock-Paper-Scissors: **headbutt beats punch, punch beats kick, kick beats headbutt**.
- Range attacks like vomit never tie, they always hit unless jumped away.
- **Movement and attack speeds differ per character** (parameters — players and enemies alike).
- Move sets are configured per character by **key mapping + sprite row number** (`{ key, row, type: punch|kick|headbutt|vomit }`) — never hardcoded. Often just one move (the bald thug `lysy-blokers` only headbutts); Rudy starts with a punch and gains headbutt + kick later, via missions.
- PoC simplification: **trading single blows**, HP counts down from a few points to zero.

### Health, death, effects
- **HP is a character parameter; HP 0 = defeat.**
- **Player defeat → game over screen**: statistics + **death music** in the background + **restart button** (restarts a fresh game).
- **No saves, no saving capability** — game state is session-only. ⚠ *This supersedes the earlier expectation "mission status saved in the browser + reset option"; if persistence is wanted again later, the owner must say so.*
- Blood is a visual effect only; defeated characters **lie on the ground and persist across section visits** — the kill is recorded in the **session** (`defeatedEntities`, session-only) and the corpse reappears where it fell (owner 2026-10-13).
- **No XP, no leveling.** Progression and items are tied to missions; **each mission gives a slight stat boost** (`level`/`experience` in the session stats are dead weight — removed, P0.7).

### Items & economy
- The shop is **fully automated and invisible** — its entrance is part of the background art. The visit is a **walkable interaction** of the section (owner 2026-10-19): ↑ walks Rudy into the spot, the sound `assets/sounds/<street>-<interaction>-<index>.mp3` plays when he disappears there, he stays for the trigger's `stay` and walks back out. The trigger of the interaction is the first one whose **`when` condition** holds; its **effects** may move the mission on and hand out an item for a price (`{"item": "beer"}` / `{"money": -1}`) — the exchange happens **300 ms** before he leaves. There is no shop UI at all.
- **Mission items** stay in the inventory for the duration of the task (e.g. documents taken from someone and delivered elsewhere).
- Items can drive the world: the **mission stage** decides what is in the world (which boss exists, which overlays are shown).

### Quests & world state
- Two pillars: **combat and questing**.
- One **main street mission** spanning all sections — the `mission` field of the street config: an array of log lines where the index is the mission stage. The stage moves on through the **effects of the config's triggers** (a `{"mission": N}` effect sets the stage; the old transition maps are gone); the HUD shows the street's opening objective and the current one. Moving back and forth between the sections is encouraged and progress may alter previously visited sections.
- **One side quest per section**, independent of the others, scoped to the player's current section.
- Tasks **alter world state**: e.g. helping a shopkeeper makes the shop open later — enter, get an item, or bypass a fight.

### Bosses
- A boss lives in a **fixed section**; copying the config entity creates a **separate boss instance**; no entry in a section's `bosses` list = no boss there.
- The boss exists while its **`presentWhen`** condition holds (e.g. `{ "mission": [1, 2] }`); its `fight` trigger (`always` / `distance` / `hit`) starts the fight. The **street ends** when the mission is on its last stage and no boss of the street is still standing.
- Three types: (a) **section boss** — a dangerous spot where entering triggers the fight; (b) **side-mission boss** — appears in select sections, tied to a side quest; (c) **street-mission boss** — appears only on the street-mission stages of its section.
- A boss fight opens with a **special animation + sound effect ("cutscene") that immobilizes the player** — generalize the existing `walkable-interaction.js` scripted-timeline pattern.
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
- **HP / money: top-left HUD** (owner decision 2026-10-12): hearts (one `assets/hud/hp.png` per HP) and coins below (one `assets/hud/money.png` per 5 PLN coin). **Mission logs: two reserved rows at top-right above enemy HP** (implemented + browser-verified 2026-10-19): row 1 shows the street's opening objective (`mission[0]`, e.g. "Kup piwo"), row 2 the current objective once the mission moved on ("Znajdź ustronne miejsce aby wypić piwo", later "Pokonaj żula"). The logs come from the street config only, survive section changes, are replaced with the next street's mission and reset on restart.
- **Typography** (implemented + browser-verified 2026-10-19): all page and Canvas text uses the bundled `PressStart2P-Regular.ttf` (Press Start 2P); bootstrap loads it before gameplay. End-screen labels are sized to fit the pixel font.
- A **collapsible menu** at the side/corner: stats, list of completed missions, current "street mission" status, and a **game timer**. Completing the street shows a **congratulatory message** (Phase 4).

## ✅ Former "Open decisions" — answered (owner, 2026-10-11)

1. **Player defeat** → game over screen with statistics, death music in the background, and a restart button. **No saves, no saving capability.** (⚠ supersedes the earlier "save in browser + reset" expectation — see flag above.)
2. **Combat timing** → tie buffer very low, **~100 ms**, counted from the **end of the attack animation (full stretch)**. Player and enemies have **different movement and attack speeds**. The jump is **not buffered** (the retreat was removed on 2026-10-19); the hitbox is checked at the finish of the attack animation — dodge before the finish and you are not hit.
3. **Shop** → fully automated and invisible; the entrance is part of the background; entering plays an mp3 and buying beer (piwo) plays a different mp3.
4. **Objectives / HP / info display** → subject of testing; the best solution is yet to be discovered (treated as an experiment in P0.8).

## 🧪 Phase 0 — PoC: two sections, mechanics test bed (PRIORITY)

Owner's scope: section 1 (`01-narutowicza`, "Zielona 3") holds **the `lysy-blokers` patrol enemies — plus the shop**; section 2 ("Narutowicza 6") holds the **bum boss**. Before the mission reaches stage 1 the bum **stands there and does not react**; from stage 1 on he **triggers an audio clip, boss music starts, and the fight begins**. Combat is **trading single blows** with a simple HP counter (a few points) down to zero. Defeating him ends the street — the next street follows, and after the last one a **congratulatory message**.

- [x] ✅ **P0.1 — Character & move configuration (data-driven)** *(done in the 2026-10-12 pre-PoC refactor)*
  - Files: `data/characters/*.json` (`player`, `lysy-blokers`, `zul-mietek`), `src/domain/content/character-schema.js`, `src/domain/content/content-repository.js`, `src/domain/actors/actor.js`, `src/domain/actors/player.js`, `src/domain/actors/enemy.js`, `src/main.js`.
  - Move set per character: `{ key, row, type: punch|kick|headbutt|vomit }` (4 frames per move row; `"alternate": true` alternates the row's two 4-frame groups on every other attack — Rudy's punch: 0–3 / 4–7 hands); walk stays row 0 (8 frames); per-character movement and attack speed parameters; player config also carries `jumpKey`/`jumpDurationMs`/`jumpHeightPx`. PoC moves: Rudy → punch (row 1), `lysy-blokers` → headbutt, `zul-mietek` → vomit (the ranged move, row 1).
  - Acceptance (verified in browser 2026-10-12): the game runs on configs alone; changing a move's key/row/type or a character's speeds is a JSON-only edit.
- [x] ✅ **P0.2 — Simple combat (trading single blows)** *(done + verified in browser 2026-10-12)*
  - Files: `src/domain/combat/combat.js`, `src/domain/combat/arena.js`, `src/app/play-screen.js`.
  - First-to-strike lands the hit; damage applies at the finish of the attack animation; HP is a few points counting down; HP 0 → character defeated, lying on the ground until section exit. A landed hit interrupts the defender's blow. Recovery is per character (`recoveryMs`) — **the player has none: every Space press is a punch** (owner 2026-10-12, no player delays); enemies hold the full-stretch frame (`attackHoldMs`) before recovering.
  - Acceptance (verified 2026-10-12): Rudy beat `lysyblokers` (3 blows, retreat between strikes); Rudy was defeated by him (→ P0.6 screen). Damage is observable at full extension.
- [x] ✅ **P0.3 — Automated invisible shop (beer)** *(done + verified in browser 2026-10-12; **reworked 2026-10-19 into the config-driven walkable interaction**)*
  - Files: `src/app/walkable-interaction.js`, `src/app/play-screen.js`, the street JSON (`interactions[].triggers`), `src/render/hud.js`.
  - **Walkable interaction** (owner 2026-10-19): the shop is a spot of the section (`x1`…`x2`); ↑ walks Rudy in, he disappears for the trigger's `stay` and walks back out. The sound (`assets/sounds/<street>-<interaction>-<index>.mp3`) plays **when Rudy disappears in the spot**, not when the walk-in starts. The trigger is picked by the first trigger whose `when` condition holds; the **exchange** — the mission, the item and the price, as the effects of the trigger — happens **300 ms before he leaves**, so buying the beer swaps the money icon for the beer icon and the new objective appears in the same instant.
  - Acceptance (verified 2026-10-19): ↑ in the spot → the sound of the stage's trigger when he disappears, the 3 s stay on stage 0 (and 1 s later), the mission moving from stage 0 to 1 and the coin turning into a beer 300 ms before the exit.
- [x] ✅ **P0.4 — Conditional boss (`zul-mietek`, the bum) gated by the mission** *(done + verified in browser 2026-10-12; **reworked 2026-10-19 to the mission stages**)*
  - Files: street JSON (the `bosses` of the section), `src/world/section.js`, `src/domain/actors/enemy.js`, `src/app/play-screen.js`.
  - The boss's `presentWhen` (`{ "mission": [1, 2] }`) gates his existence (the mission decides what is in the world); before that he waits in the background as a section overlay (`when: { "mission": [0] }`). His `fight` trigger (`always` / `distance` / `hit`) starts the fight: then the `<street>-boss-intro` audio (by convention) + the boss music + the fight. His defeat **ends the street** — the next street follows once the mission is on its last stage and no boss is standing (the old `<street>_<id>_defeated` world flag is gone; the defeated hostiles live in the session).
  - Acceptance (verified 2026-10-19): on stage 0 the boss is not in the section (only his waiting pose in the background); from stage 1 he appears and the fight starts with the music and the introduction sentence; his defeat ends the street.
- [x] ✅ **P0.5 — Victory message** *(done + verified in browser 2026-10-12; **reworked 2026-10-19 to the street sequence**)*
  - A finished street hands over to the next one; the **victory screen** comes after the **last** street of the game ("GRATULACJE! WYGRAŁEŚ GRĘ!" + "Ukończyłeś wszystkie ulice!").
  - Acceptance (verified 2026-10-19): the boss's defeat ends the street, the next street loads (its own mission, the player at its beginning); after the last street the victory screen appears.
- [x] ✅ **P0.6 — Game over screen** *(done + verified in browser 2026-10-12)*
  - On Rudy's HP 0: game over screen with **statistics** (game time, defeated enemies, coins) + **death music** (`game-over.mp3`, optional by convention) + **restart button** (click or Enter — Space does not restart, owner 2026-10-15) that starts a fresh game (`session.resetForNewGame` rebuilds everything and the game starts at the first street). No save/load anywhere.
  - Acceptance (verified 2026-10-12): defeat → screen with stats and music; the button restarts the game cleanly (Rudy at the start, 5 HP, 1 coin, empty inventory).
- [x] ✅ **P0.7 — Config cleanup** *(done + verified in browser 2026-10-12; **the new street schema landed 2026-10-19**)*
  - The street JSON is now the whole street: `mission`, `sections[]` (with `onEnter`, `overlays`, `interactions`, `enemies`, `bosses`) — no `route`, no `exitLeft`/`exitRight`, no `boundaries`, no `conditions`, no `idleOverlay`. The old v1 keys (`trigger`, `highlight`, `give`/`cost`, the `mission` transition maps, the single `boss` object) are **refused** by the schema v2 validation (`src/domain/content/street-schema.js`) with a Polish error naming the file and the path. `level`/`experience` are gone from the session stats (no XP/leveling).
  - Acceptance (verified 2026-10-19): `data/streets/01-narutowicza.json` alone drives the game; the old `ulica-01.json` is removed.
- [x] ✅ **P0.8 — Minimal in-game info display (experiment)** *(HP + money HUD done 2026-10-12; item rows added + verified 2026-10-12; mission logs config-driven 2026-10-19)*
  - Show minimal HP / objective feedback during play. **HP/money placement decided by the owner (2026-10-12)**: top-left corner — hearts (one `assets/hud/hp.png` per HP) and coins below (one `assets/hud/money.png` per coin). **Items get their own row below the coins** — one `assets/hud/<itemId>.png` icon per unit; empty rows collapse (no item is carried in the current street, so the rows stay empty). The mission logs (two rows top-right) come from the street config. The rest stays experimental, owner evaluates during playtests.
  - Acceptance (verified 2026-10-12): the owner can evaluate an info display during PoC playtests (hearts → coins → item rows observed in-game).

## ⚔️ Phase 1 — Full combat system

- [x] ✅ **P1.1 — RPS tie-break + arbitration** *(done + verified in browser 2026-10-18)*
  - 100 ms inclusive tie window counted from full extension; already-started opposing melee attacks use headbutt > punch > kick > headbutt. Finish times are compared without adding a delay; a later winner still lands only at its own extension and must pass the hit check then.
  - Ready attacks resolve chronologically, not player-first. Equal move types favor the earlier finish; exactly equal finishes draw without damage. Vomit is configured as `type: vomit` and never participates in RPS; launched bursts still require contact and can be jumped over or escaped.
  - Acceptance (verified 2026-10-18): all six RPS matchups; lysyblokers' headbutt beats Rudy's punch on a tie; 99/100 ms ties and the 101 ms first-strike boundary; earlier enemy attacks win regardless of update order; same-type ties and ranged hits checked.
- [x] ✅ **P1.2 — Timed evasion (jump)** *(done + verified in browser 2026-10-18; **the retreat half was removed 2026-10-19**)*
  - The jump immediately cancels Rudy's windup and dodges melee as well as vomit. **↓ (ArrowDown) does nothing any more** — the backward step (the "moonwalk") and its `retreatKey`/`retreatDurationMs`/`retreatDistancePx` config fields are gone (owner 2026-10-19); the jump is the only evasion.
  - Evasion presses during the interaction sequence are discarded, not buffered. Holding ↑ still repeats hops; the interaction entry retains priority at the spot. Queued punches, alternating hands and zero player recovery remain intact.
  - Acceptance (verified 2026-10-18, re-checked 2026-10-19): a before-finish jump avoids contact; an after-contact dodge does not undo damage; the jump and the punch still work and ↓ does nothing.
- [ ] ⬜ **P1.3 — Move sets & per-character speeds**
  - Multiple moves per character with mission-based unlocks (Rudy gains headbutt, then kick); per-move animation rows and hit feedback; distinct movement/attack speeds per character.
  - **Done (2026-10-19)**: the move sets and the per-character speeds are already data-driven (`data/characters/*.json` — `moves`, `walkSpeed`, `attackFrameMs`, `attackHoldMs`, `recoveryMs`); the character config now also carries the `behavior` (`patrol` / `sentry`) and the derived `attackKind` (`ranged` when a move has `type: "vomit"`). Still missing: the **mission-based unlock** of the moves and the hit feedback per move.
  - Acceptance: two characters with different move sets and speeds fight correctly against each other.
- [x] ✅ **P1.4 — Blood VFX + corpse polish** *(done + verified in browser 2026-10-14)*
  - Blood as a visual effect (`src/render/blood.js`, owner 2026-10-14): every landed blow sprays 3×3 px red squares out of the struck character; they fly away from the blow, arc down and land on the ground line (the struck character's feet), staining it until the section is left. Corpses already persist where they fell across section visits (kill recorded in the game state — owner 2026-10-13).
  - Acceptance (verified 2026-10-14): blood shows on hits; corpses lie where they fell on re-entry.
- [x] ✅ **P1.5 — Hit player or enemy is moved back 100 px** *(done + verified in browser 2026-10-18)*
  - Landed melee hits move the target away from the source by `HIT_KNOCKBACK_PX` (**100 px**, `src/domain/combat/combat.js`), clipped flush to solid boundaries. Ranged attacks such as vomit deal damage without knockback. Misses and RPS draws do not move anyone. Lethal melee hits persist the displaced corpse position; the existing death-animation slide remains separate.
  - Acceptance (verified 2026-10-18): player/enemy displacement in both directions, left/right wall clipping, no displacement on a miss and persisted lethal-hit position.
  - Owner update (2026-10-18): ranged damage no longer applies knockback or uses `HIT_KNOCKBACK_PX`; tests not run for this adjustment, as requested.

## 📜 Phase 2 — Questing & world-state engine

- [ ] ⬜ **P2.1 — Quest config schema**
  - Main street mission (non-linear, cross-section) + one side quest per section; triggers at mission-specific interaction points; conditions on flags/items/quests; **effects** (spawn changes, shop opens, fight bypassed, item granted/taken).
  - **Done (2026-10-19)**: the main street mission — its stages and its log lines — is config-driven (`mission` + the `{"mission": N}` effect of a trigger), and the mission gates what is in the world (the hostiles' `presentWhen`, the overlays' `when`). The **unified trigger model** landed with the refactor: one list of `{ "when": <condition>, "stay": <ms>, "effects": [...] }` for the sections (`onEnter`), the interactions and (later) the entities — the conditions `mission` / `flags` / `items` / `money` / `defeated` / `position` and the effects `mission` / `item` / `money` / `flag`. Still missing: **the side quests themselves** and the content that would use them.
  - Acceptance: the beer → boss pattern is expressible purely in quest/effect config.
- [ ] ⬜ **P2.2 — Mission items & stat boosts**
  - Mission inventory (e.g. documents to deliver); slight stat boost per completed mission.
  - **Done (2026-10-19)**: the **items** and the **money** of the quest engine already work through the effects of the config (`{"item": "beer", "count": 1}` adds, a negative count takes away; `{"money": -1}` spends) and live in the session (the inventory, the purse, the world flags). Still missing: the **stat boosts** — no effect raises a stat yet, and no XP/leveling is planned.
  - Acceptance: a mission item can be taken, carried and delivered; completing a quest visibly raises a stat.
- [ ] ⬜ **P2.3 — Section re-entry effects + objective text**
  - Quest-driven spawns applied on re-entry ("came back and things are different now"); brief objective text. **Done (2026-10-19)**: the mission decides what is in a section (an entity exists while its `presentWhen` holds, the overlays follow their `when` condition) and the objective text is the config's mission log; the side-quest effects remain planned.
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
  - Section / side-mission / street-mission bosses; copied config entity = new instance; a section without an entry in its `bosses` list has none; the street-mission boss appears only while his `presentWhen` holds.
  - Acceptance: all three types demonstrable via config alone.
- [ ] ⬜ **P4.2 — Generic intro cutscene**
  - Special animation + sound immobilizing the player (`walkable-interaction.js` generalized into a scripted-sequence runner).
  - Acceptance: player cannot act during the intro; the fight starts when it ends.
- [ ] ⬜ **P4.3 — Audio layering + collapsible menu**
  - Ambient → section music → boss music (highest wins); menu with stats, completed missions, street-mission status, game timer; congratulatory message on completing the street.
  - Acceptance: audio switches layers correctly during play; menu shows live state; street completion shows the message.

## 🧰 Phase 5 — Expansion & polish

- [ ] ⬜ **P5.2 — Content expansion**
  - More sections and streets via new files in `data/streets/` (the game finds them by name and plays them one after another); background photo crop/scale for the flat bottom strip.
  - Acceptance: a new section is addable as files only; a new street loads from its own file.
- [ ] ⬜ **P5.3 — Random passersby & polish**
  - Passersby randomness; general polish.
  - Acceptance: passersby appear and react variably.

## 📎 Asset dependencies (owner-supplied; code picks by naming convention / config paths)
- Naming conventions (the names are built in `src/domain/content/asset-conventions.js`, the playback in `src/audio/audio.js`): `player-attack-miss` / `player-attack-hit`, `<enemyName>-attack-miss` / `<enemyName>-attack-hit`, `<who>-jump` (e.g. `player-jump`), `<street>-<section>-ambient` (loop; falls back to the default street ambience `ambience.mp3`, which plays automatically at boot — owner 2026-10-14/15), `<street>-boss-intro` (the boss's introduction sentence, played once on top of `<street>-boss-music`), `<street>-boss-music` (loop), `<street>-<interaction>-<index>` (the sound of an interaction — the index of the trigger), `game-over` (played once on defeat, no loop), `<street>-congratulations` (victory jingle, played once — owner 2026-10-15). **Every audio file is optional — a missing file means silence.**
- Pictures: `assets/bg/<street>-<section>.png` (the section background) and `assets/bg/<street>-<section>-<i>.png` (the overlays of a section — the 1-based index of the `overlays` entry).
- **The config schema changed on 2026-10-19 (the file names did not)**: the street JSON now has `sections[].onEnter`, `sections[].overlays`, `sections[].interactions[].triggers`, `sections[].enemies`, `sections[].bosses`, an entity's `fight` and `presentWhen` — the asset names these sections point at are unchanged.
- **PoC**: `player-jump.mp3`, `player-attack-hit.mp3`, `lysy-blokers-attack-hit.mp3`, the shop sounds (`01-narutowicza-sklep-0/-1.mp3`), death music (`game-over.mp3`), `01-narutowicza-boss-intro.mp3`, boss music (`01-narutowicza-boss-music.mp3`). (`player-attack-miss.mp3` exists.)
- **Later**: `<street>-<section>-ambient`-style street ambient loops, section music, catchphrase mp3s, dialogue mp3s.
- **Sprites**: headbutt row for `lysy-blokers`, the `zul-mietek` sheet, Rudy's headbutt + kick rows (Phase 1). The PoC works with existing sheets (a move = the first 4 frames of a row). Rudy's death row (`rudy_dres` row 2, all 8 frames) and the boss's (`zul-mietek` row 2, first 4 frames) are in use — owner 2026-10-15.
- Convention-based sounds are always optional (silence when absent); only the assets named explicitly in a JSON file (e.g. the section background) report errors like other assets.

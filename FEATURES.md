# FEATURES.md — feature set & progress tracker

Status legend: **done** (works in game) · **partial** (some behavior exists) · **data-only** (JSON/scaffolding exists, no behavior) · **planned** (expected, nothing yet).

Keep this file up to date when a feature lands or changes. Context in [AGENTS.md](AGENTS.md).

## Core gameplay

| Feature | Status | Notes |
|---|---|---|
| Walking (←/→) with collision | done | `player.js`, solids from section `boundaries`; blocked → walks in place |
| Punching (Space) | partial | Alternates hands every other punch (frames 0–3 / 4–7, configurable via move `alternate`); animation + miss sound only — **no hit detection, no damage** |
| Combat: first-to-strike + timed evasion | planned | Hit resolved at attack-animation finish (full stretch); retreat/jump before finish → miss, unbuffered (PLAN.md) |
| RPS tie-break on simultaneous strikes | planned | ~100 ms tie buffer counted at animation finish: headbutt > punch > kick > headbutt |
| Move sets per character (key + sprite row) | done | `data/characters/*.json`; e.g. `lysyblokers` = headbutt only; Rudy gains headbutt/kick via missions |
| Character stats via config files | done | `data/characters/*.json`: hp, walk/attack speed, hitbox, sprite name, moves |
| Audio by convention | partial | `player-attack-miss` plays (hit/miss resolution = P0.2); ambient loop + `boss-intro` wired; all files optional |
| Universal combat system (Rudy = NPCs = bosses) | planned | Same logic, different parameters (stats, move set) |
| Taking damage / HP / defeat | planned | HP is a character param, 0 = defeat; `State.stats.Rudy.hp` exists but is unused |
| Blood VFX + corpses until section exit | planned | Corpse reset on `leave()` already matches the data model |
| Stamina (attack fatigue) | planned (later version, not PoC) | Character-stat-driven; hard attacking slows movement, recovers after a pause |
| Section transitions along street route | done | Open edges (`exitLeft`/`exitRight`) in street JSON |
| Patrol enemy (`lysyblokers`) | done | Paces spawn-point ↔ first solid; no combat behavior |
| Enemy: `rat` | planned | Example `szczur_1` removed from street JSON; skipped at spawn until it has a character config |
| Enemy: `thug` | data-only | In `ulica-01/02` JSON, skipped at spawn (no character config) |
| PoC boss (`boss_zul`, the bum, in `ulica-01/02`) | data-only | Character config + street slot in place; without beer he stands idle, with beer → `boss-intro` + boss music + fight; defeat → congratulatory message (Phase 0 target) |
| Boss intro cutscene (anim + sound, immobilizes player) | planned | Generalize the `shop-entry.js` scripted-sequence pattern |
| Main mission (spans the whole street) | planned | One mission across all sections; `State.quests` is the only trace so far |
| Side quest (one per section) | planned | Each section gets its own local quest |
| Section bosses (quest-linked or standalone) | data-only | Boss slot + flag conditions exist; a boss may tie to a side quest, the main mission, or no mission at all |
| NPC townsfolk + dialogue | planned | Example NPCs (`babcia_kasia`, `pijak_jozef`) removed from the street JSON — not part of the current plan |
| Chest interaction (`giveItem`) | planned | Example `skrzynka_1` removed from street JSON; type stays in the schema, no code handles it |
| Shop | partial | **Automated & invisible**: `ulica-01_01-sklep.png` overlay (512x512 at 158, 288) highlights the shop while the player stands at the door **and through the whole enter/inside/exit sequence**; walk-in plays an mp3, buying beer (piwo) plays a second mp3; no UI |
| Door interaction (`goToRoute`) | data-only | `drzwi_1` in JSON; no code handles it |
| HUD (HP, money, etc.) | planned | — |
| Game over screen (stats + death music + restart button) | planned | On Rudy's HP 0; **no saves — session-only play** (supersedes the earlier browser-save expectation) |
| Data-driven content (configurable via files) | partial | Street JSON works; goal: new section/street = files only (see AGENTS.md "Content pipeline") |
| Jump (walk cycle in the air) | done | **↑ (ArrowUp)** — shop door entry takes priority there; the regular walk animation plays through the hop ("walking in the air"); **holding ↑ keeps hopping** (restarts on landing); `player-jump.mp3`; side arrows stay live mid-jump; configurable `jumpKey`/`jumpDurationMs`/`jumpHeightPx` |
| Retreat (timed evasion) | planned | Phase 1 dodge; jump gains its combat semantics there too |
| Neutral pedestrians (GTA-like: flee / fight / take a beating) | planned | Post-PoC (Phase 3) |
| Dialogue MP3s + random catchphrase loops | planned | Most characters silent; objectives as very brief text |
| Collapsible menu (stats, missions, street status, timer) | planned | Congratulatory message on street completion (Phase 4) |
| Mission stat boosts (no XP / leveling) | planned | Each mission slightly boosts stats |
| Item-driven spawns (beer → boss in another section) | planned | Phase 0 target mechanic |
| Audio layering (ambient → section music → boss music) | planned | Highest active layer wins |

## World data

| Street | Sections | Route | Content status |
|---|---|---|---|
| `ulica-01` | `01` Podwórze, `02` Zaułek | `01 → 02 → 01` | Section 01 playable (1 real enemy + shop); section 02 walkable but its enemies/boss/NPC/door are data-only |

## Assets

| Asset | Used for |
|---|---|
| `assets/sprites/rudy_dres.png` | Player sheet (walk row 0; punch = row 1, frames 0–3) |
| `assets/sprites/lysyblokers.png` | Patrol enemy sheet |
| `assets/bg/ulica-01_01.png`, `ulica-01_02.png` | Section backgrounds |
| `assets/sounds/player-attack-miss.mp3` | Attack whoosh (renamed from `rudy_dres-punch-miss.mp3` to match the audio convention) |
| `assets/sounds/ulica-01_01-sklep.mp3` | Shop entry jingle |

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

All five open questions are answered and folded into PLAN.md ("Former 'Open decisions' — answered" + phases):

1. **Player defeat** → game over screen with statistics, death music, restart button; **no saves, no saving capability**.
2. **Combat timing** → ~100 ms tie buffer counted at attack-animation finish (full stretch); per-character movement/attack speeds; retreat/jump unbuffered — dodge before the animation finish and you are not hit.
3. **Stamina** → later version, not PoC; character-stat-driven slowdown with recovery after a pause.
4. **Shop** → fully automated and invisible (entrance is part of the background); entry mp3, different mp3 after buying beer (piwo).
5. **Objectives / HP / info display** → subject of PoC testing (P0.8 experiment); owner decides after playtests.

⚠ One contradiction to confirm: the earlier expectation said "mission status saved in the browser, with reset option"; the new answer says **no saving capability**. The docs and plan follow the new answer (session-only play).

## Changelog

- 2026-10-11: file created. Baseline: walking, collisions, section transitions, `lysyblokers` patrol, punch animation, shop entry sequence.
- 2026-10-11: owner-confirmed design folded in (world model, enter/exit reset semantics, universal combat, 4-frames-per-attack sprites, file-configurable content); "more streets" question resolved.
- 2026-10-11: owner vision folded in: Amiga-style "karate" beat-'em-up (*Renegade*/*Final Fight*) on a real photographed street, static screens switched on exit (Atari *Ninja* style), combat+questing pillars (main mission + per-section side quest, flexible bosses), owner-made art/audio, config-driven architecture goal.
- 2026-10-11: final expectations (21 points) folded into **PLAN.md** — phased workable plan (Phase 0 PoC first: single-blow combat, beer → bum boss, congrats, browser save + reset). Combat spec locked (first-to-strike, RPS tie-break headbutt>punch>kick>headbutt, timed retreat/jump, key+sprite-row move config); X-only movement, browser save + reset, no XP/leveling confirmed; open questions reduced to 5 non-blocking ones.
- 2026-10-12: owner answered the 5 open decisions (game over screen + death music + restart, **no saves**; ~100 ms tie buffer at animation finish, unbuffered dodges, per-character speeds; stamina later/stat-driven; automated invisible shop with two mp3s; info display TBD via testing). PLAN.md reworked into a **markable task list** (stable IDs P0.1–P5.3, checkbox + status emojis, Status board). ⚠ "No saves" supersedes the earlier browser-save expectation — flagged for confirmation.
- 2026-10-12: **pre-PoC refactor**: game data extracted to config files (`data/characters/*.json` with stats/hitbox/moves; streets at `data/streets/*.json`), convention-based audio (`player-attack-miss`, `<enemy>-attack-*`, `<street>_<section>-ambient`, `boss-intro`; all optional), simplified attack model (one move = one 4-frame row), dead code removed (`State.serialize`, `level`/`experience`, `ENEMY_TYPES`, `ArrowDown`), example NPCs (`babcia_kasia`, `pijak_jozef`) dropped, `boss_kozak` → `boss_zul`, `rudy_dres-punch-miss.mp3` → `player-attack-miss.mp3`. Covers PLAN.md P0.1.
- 2026-10-12: **changes**: removed `szczur_1` + `skrzynka_1` examples from the street JSON; fixed section 02's right wall (full height at x=1550) so Rudy is blocked flush with the viewport at the street end; alternating punch hands (frames 0–3 / 4–7) via move flag `alternate`; player **jump** (config `jumpKey` default KeyZ, `player-jump.mp3`, first walk frame, draw-offset hop).
- 2026-10-12: **jump rework**: jump moved to **↑ (ArrowUp)** with shop-door entry taking priority; side arrows stay live during the hop (drift left/right on the fly); blocked movement now **walks in place** (walls and world ends).
- 2026-10-12: **polish**: jump now plays the **regular walk animation** ("walking in the air", arrows keep it cycling); shop highlight is the `ulica-01_01-sklep.png` overlay (512x512) at **x 158, y 288** via the interaction's `highlight` config — the yellow rectangle is gone.
- 2026-10-12: shop highlight now stays visible **through the whole shop sequence** (enter, inside, exit); **holding ↑ keeps hopping** (jump restarts on landing; shop entry still wins at the door on the press).

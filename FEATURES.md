# FEATURES.md — feature set & progress tracker

Status legend: **done** (works in game) · **partial** (some behavior exists) · **data-only** (JSON/scaffolding exists, no behavior) · **planned** (expected, nothing yet).

Keep this file up to date when a feature lands or changes. Context in [AGENTS.md](AGENTS.md).

## Core gameplay

| Feature | Status | Notes |
|---|---|---|
| Walking (←/→) with collision | done | `player.js`, solids from section `boundaries` |
| Punching (Space) | partial | Animation + miss sound only; **no hit detection, no damage** |
| Universal combat system (Rudy = NPCs = bosses) | planned | Design confirmed: same logic, different parameters; 1–several attacks per character, 4 sprite frames each |
| Taking damage / HP / death | planned | `State.stats.Rudy.hp` exists but nothing reads/writes it |
| Section transitions along street route | done | Open edges (`exitLeft`/`exitRight`) in street JSON |
| Patrol enemy (`lysyblokers`) | done | Paces spawn-point ↔ first solid; no combat behavior |
| Enemy: `rat` | data-only | In `ulica-01/01` JSON, skipped at spawn (no sprite/behavior) |
| Enemy: `thug` | data-only | In `ulica-01/02` JSON, skipped at spawn |
| Boss fight (`boss_kozak` in `ulica-01/02`) | data-only | Spawn gated on flags `quest_rudy_started` (true) & `boss_kozak_defeated` (false); no boss actor/behavior/fight |
| Missions / quests | planned | `State.quests` + boss flag conditions are the only traces |
| NPC townsfolk + dialogue | data-only | `babcia_kasia`, `pijak_jozef` with dialogue ids in JSON; never drawn, no dialogue system |
| Chest interaction (`giveItem`) | data-only | `skrzynka_1` in JSON; no code handles it |
| Shop | partial | Door highlight + scripted walk-in/out with sound (`shop-entry.js`); **no shop UI, no buy/sell** |
| Door interaction (`goToRoute`) | data-only | `drzwi_1` in JSON; no code handles it |
| HUD (HP, money, etc.) | planned | — |
| Save / load | planned | `State.serialize()` exists, unused |
| Data-driven content (configurable via files) | partial | Street JSON works; goal: new section/street = files only (see AGENTS.md "Content pipeline") |
| Player vertical movement (↑/↓) | planned? | `ArrowDown` is in `GAME_KEYS` but unused — see questions below |

## World data

| Street | Sections | Route | Content status |
|---|---|---|---|
| `ulica-01` | `01` Podwórze, `02` Zaułek | `01 → 02 → 01` | Section 01 playable (1 real enemy + shop); section 02 walkable but its enemies/boss/NPC/door are data-only |

## Assets

| Asset | Used for |
|---|---|
| `assets/sprites/rudy_dres.png` | Player sheet (walk row + 2-hand punch row) |
| `assets/sprites/lysyblokers.png` | Patrol enemy sheet |
| `assets/bg/ulica-01_01.png`, `ulica-01_02.png` | Section backgrounds |
| `assets/sounds/rudy_dres-punch-miss.mp3` | Punch whoosh |
| `assets/sounds/ulica-01_01-sklep.mp3` | Shop entry jingle |

## Confirmed design (from the owner)

- **World**: streets (starting with one), each made of sections (starting with two) forming a sequence traversed back and forth — a section can be revisited, e.g. `01 → 02 → 01 → 02`.
- **Section enter pipeline**: load image → set boundaries → generate standard NPCs → generate enemies → check boss conditions → check interactions. **Exit**: standard NPCs / enemies / bodies reset; quests, inventory, money, world flags and stats do not reset → enables "Oh, I came back here and things are different now."
- **Combat**: universal logic for Rudy, standard NPCs and bosses; they differ only in their parameters. Each character has one to several attacks.
- **Sprites**: initially all frames 150x150px — 8 frames walking, 4 frames per attack.
- **Content**: ultimately configurable via files; new section = image + section JSON + characters + quests/conditions + audio; new street = `data/streets/<street>/` directory.

## Open questions

1. **Combat resolution** — how does a punch connect (hitbox in front of Rudy at full extension?), damage formula, knockback? How do enemies attack back? For >2 attacks, do the 4-frame groups continue in the attack row or start new rows?
2. **Player health / game over** — what happens at 0 HP? Respawn, reload, game over screen?
3. **Missions** — how are quests started (talking to NPCs?) and tracked? Is `quest_rudy_started` set by a specific NPC/dialogue?
4. **Boss fight** — how does `boss_kozak` differ beyond parameters (phases, arena, conditions to start)? What does defeating him set/do?
5. **Shop** — what can be bought/sold? Is the current walk-in/out sequence meant to lead to a shop screen?
6. **NPCs & dialogue** — dialogue format for `dialogue_kasia_01` / `dialogue_jozef_01`? Interaction key (↑ like the shop door)?
7. **Movement plane** — strictly side-scrolling (X only) or is there ↑/↓ movement on the street?
8. **Save / load** — needed? When (manual, autosave on section change)?

## Changelog

- 2026-10-11: file created. Baseline: walking, collisions, section transitions, `lysyblokers` patrol, punch animation, shop entry sequence.
- 2026-10-11: owner-confirmed design folded in (world model, enter/exit reset semantics, universal combat, 4-frames-per-attack sprites, file-configurable content); "more streets" question resolved.

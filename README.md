# Geometry Dash Web

A browser **rhythm-platformer built in the style of Geometry Dash** — same physics feel,
same object set, same menu flow (level carousel, icon kit, shop, creator, editor) — running
on plain HTML5 canvas with **zero dependencies, zero build step and zero downloads**.

Open `index.html` and play. It also works offline and from `file://`.

```
Geometry Dash/
├── games/
│   └── README.md              notes on standalone game projects
├── index.html                  ← open this
├── tools/
│   └── README.md              notes on optional developer utilities
└── website/
    ├── css/
    │   └── style.css           page chrome, scaling, boot loader
    ├── js/
    │   ├── util.js             constants, physics tuning, colour + text helpers, save data
    │   ├── textures.js         every sprite, drawn procedurally at boot
    │   ├── levels.js           object catalogue, 6 built-in levels, song definitions
    │   ├── audio.js            Web Audio synth: music scheduler + 17 sound effects
    │   ├── game.js             the run itself: physics, collisions, cameras, HUD
    │   ├── editor.js           level editor (place / move / delete / test / export)
    │   ├── ui.js               menus, carousel, icon kit, shop, settings, stats, medals
    │   └── boot.js             canvas scaling, input, main loop
    └── assets/
        ├── textures/           favicon + notes on swapping in your own art
        ├── audio/              notes on the synthesised soundtrack
        ├── fonts/              notes on the font stack
        └── levels/             importable example level + the level file format
```

---

## A note on assets and copyright

You asked for a 1:1 copy of Geometry Dash and for its sprites/music from
The Spriters Resource. **I can't ship RobTop's copyrighted artwork or music**, so this is a
faithful *clone of the game itself* rather than a copy of its files:

* **every sprite** (blocks, spikes, saws, pads, orbs, portals, coins, ground, all 8 player
  forms, UI faces, the logo) is drawn from scratch with the Canvas 2D API at start-up,
  matched to GD's chunky vector look — see `website/assets/textures/README.md` for how to
  swap in your own PNGs if you have art you're allowed to use;
* **the music** is an original chiptune synth engine — bass, lead, arpeggio, pads and drums
  generated live from patterns in `levels.js`. No audio files, nothing ripped. You can point
  it at your own tracks instead (`website/assets/audio/README.md`).

## What is 1:1 with Geometry Dash

| Feature | Status |
| --- | --- |
| Cube physics — 2.6 block jump, ~0.46 s air time, 5 speeds (slow → fastest) | ✅ measured in tests |
| All 8 forms: cube, ship, ball, UFO, wave, robot, spider, swing | ✅ each with its own control model |
| Ball/spider gravity flips, spider surface teleport, robot variable-height jump | ✅ |
| Orbs (yellow/pink/blue/green/red/black/purple), rings, dash orbs, pads (4 colours) | ✅ |
| Portals: mode, speed, gravity, size, dual, ceiling, teleporter pairs | ✅ |
| Spikes, mini spikes, ceiling spikes, small/large saws, moving blocks, count blocks, invisible hazard blocks, jump arrows | ✅ |
| Secret coins (3 per level), mana orb economy, stars per difficulty | ✅ |
| Progress bar + best-%, practice mode with checkpoints and timeline scrub, attempt counter | ✅ |
| Menu flow: level carousel with difficulty faces, icon kit, shop, creator, stats, medals, settings | ✅ |
| Level editor with object palette, place/move/delete, undo/redo, test play, JSON export & import | ✅ |
| Beat-synced background pulse, camera shake, particles, screen flash, icon rotation | ✅ |
| Dual mode (two players, split input) | ✅ split-screen touch or arrow keys |
| Online level browser, friends, comments, daily chests | ❌ (needs a server — the "daily" tab is a local daily level) |

## Levels

| # | Level | Difficulty | Stars | Length | Sections |
| --- | --- | --- | --- | --- | --- |
| 1 | Stereo Bounce | Easy | 2 | ~470 blocks | cube → ship → cube |
| 2 | Polargeist | Normal | 3 | ~630 blocks | cube → ball → wave |
| 3 | Dry Out | Hard | 4 | ~690 blocks | cube → UFO → spider |
| 4 | Base After Base | Harder | 5 | ~660 blocks | cube → robot → ship |
| 5 | Hex Force | Insane | 6 | ~850 blocks | everything, faster |
| 6 | Cyber Loop | Normal (daily) | 3 | ~260 blocks | cube → UFO |

Each has its own palette, its own synthesised song (BPM, key, chords, lead/bass patterns)
and three secret coins.

**Every level is verified completable**: an autoplayer that searches hold/release decisions
against the real physics solves all six (plus the example custom level) from the start to
the end wall.

## Controls

| Action | Keys |
| --- | --- |
| Jump / fly / flip / teleport (context-sensitive) | `Space`, `↑`, `W`, mouse click, or touch |
| Player 2 (dual sections) | `↓` or the right half of a touchscreen |
| Pause | `Esc` or the pause button |
| Quick restart | `R` (or just tap after dying) |
| Practice mode | `P`, then `Z` to place a checkpoint and `X` to remove one |
| Mute music | `M` |
| Hitboxes | `H` |
| Editor | `1`/`2`/`3` tools, `Q` cycle colour, arrows pan, `Ctrl+Z`/`Ctrl+Y` undo/redo, `Esc` exit |

## Physics (the numbers the game actually runs)

```
block                 36 px            jump height   2.60 blocks
speeds (blocks/s)     4.7 / 5.77 / 7.7 / 9.9 / 12.3   air time  0.46 s
gravity               ~98 b/s²         jump reach    2.65 / 3.5 / 4.6 / 5.7 blocks
pads                  yellow 4.5 · pink 2.4 · blue flip · red 7.9 blocks of rise
orbs                  same as a jump, per colour, refreshable in mid-air
```

These limits are why no level asks you to climb a 3-block wall without stairs, a pad or an
orb — there's a validator for that (below).

## Development & verification

All the logic in this repo was exercised headlessly (the sandbox has no browser, so the
canvas/Web Audio environment was mocked and the real game files were driven for thousands of
frames):

* **Physics tests** — jump height/air time/speed, spike lethality, landing on steps, ceiling
  containment, gravity portals, pad and orb heights, wave diagonals, dual spawn, floor
  stability at every speed.
* **Reachability validator** — scans each level's hazard fields and step heights against the
  measured jump envelope and fails on anything impossible.
* **Beam-search autoplayer** — proves each level (and the example custom level) can be
  finished; its solutions are replayed to test the completion flow, mana award, coins,
  records and the "progress only moves forward" invariant.
* **Functional tests** — save/load round trip, shop purchases, icon kit, colour pickers,
  practice checkpoints + scrub, editor save/test-play/export/import, the audio scheduler.
* **Render geometry tests** — the player icon lands on the camera anchor, the ground tiles
  across the viewport, world→screen mapping for objects is correct, and no canvas call is
  fed a non-finite or negative-radius argument.

## Editing levels

Open **Creator → + CREATE LEVEL**. Pick objects from the bottom palette, click to place,
switch to MOVE to drag, DELETE to remove, then **TEST** to play instantly. **SAVE** keeps it
in your browser; **EXPORT JSON** downloads a shareable file and Creator → **IMPORT LEVEL**
loads one (the format is documented in `website/assets/levels/README.md`).

## Save data

Progress (best %, coins, icons, colours, unlocks, mana, medals, custom levels, settings)
lives in `localStorage` under `gdweb.save.v1`. Settings → RESET PROGRESS wipes it.

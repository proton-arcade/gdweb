# Levels

The six built-in levels live as compact JavaScript in `website/js/levels.js` (object arrays
of `[x, y, type, width, height, options]` in block units, `y = 0` is the floor). They are
generated there rather than being loaded from disk so the game also works from `file://`.

## example-custom-level.json

An importable example in the editor's save format, with a cube intro, a yellow-pad launch,
an orb hop over spikes, a ship corridor, stairs and a speed change. It is verified to be
completable by the physics used in the game.

To play or edit it:

1. **Creator → IMPORT LEVEL (.json)** and pick this file, or
2. open the editor and use **EXPORT JSON** to produce your own shareable file.

## Format

```jsonc
{
  "id": "custom_1234",
  "name": "My Level",
  "artist": "You",
  "difficulty": "normal",        // auto | easy | normal | hard | harder | insane | demon
  "baseSpeed": 1,                // 0 slow .. 4 fastest
  "songName": "bounce",          // bounce | polar | dry | base | hex | menu
  "theme": "cyber",              // stereo | polar | dry | base | hex | cyber
  "seed": 4242,
  "endX": 189,                   // level ends here (blocks); the end wall is placed here
  "objs": [
    [8, 0, "spike", 1, 1, null],
    [27, 0, "pad", 1, 0.5, { "kind": "yellow" }],
    [30, 2, "block", 1, 1, null],
    [53, 2, "p_mode", 1.4, 3.4, { "mode": 1 }]
  ]
}
```

### Object types (the `type` field)

| Type | Meaning | Useful options |
| --- | --- | --- |
| `block`, `half`, `slope`, `slope_r` | solid terrain | `{ pal: "blue" }` |
| `spike`, `spike_d`, `spike_s` | hazards (up / down / mini) | |
| `saw`, `saw_s` | rotating blade (big / small) | |
| `pad` | jump pad | `{ kind: "yellow"\|"pink"\|"blue"\|"red" }` |
| `orb`, `ring` | tap-in-air jump | `{ kind: ... }` |
| `dash` | dash orb (fast forward burst) | `{ kind: "yellow" }` |
| `coin` | collectable | `{ idx: 0, secret: false }` |
| `p_mode` | mode portal | `{ mode: 0..7 }` cube/ship/ball/ufo/wave/robot/spider/swing |
| `p_speed` | speed portal | `{ speed: 0..4 }` |
| `p_grav` | gravity portal | `{ up: 0\|1 }` |
| `p_size` | size portal | `{ mini: 0\|1 }` |
| `p_dual` | dual portal | |
| `p_ceil` | set ceiling height (required before flight sections) | `{ h: 10 }` |
| `p_tele` | teleporter | `{ tx, ty, color }` |
| `move` | moving platform | `{ dx, dy, period }` |
| `count` | count block (materialises after N touches) | `{ target: 3 }` |
| `collision` | invisible hazard block | |
| `jump` | jump arrow | `{ down: 1 }` |

### Verified reachability limits

Levels are checked against the physics the game actually runs (see the project README):

* a cube jumps **2.6 blocks high** and covers **2.65 / 3.5 / 4.6 / 5.7 blocks** at slow /
  normal / fast / faster speed — so a 2-block step is the tallest thing you can climb
  unaided, and 3-block walls need stairs, a pad or an orb;
* floor hazard fields are clearable up to ~2.5 blocks at slow speed and ~4.4 at fast speed
  (a pad, orb or ring anywhere in the field makes it fair);
* yellow pads rise 4.5 blocks, pink 2.4, red 7.9 — place the landing platform 2-3 blocks
  after the pad.

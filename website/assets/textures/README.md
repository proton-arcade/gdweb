# Textures

**Every sprite in this game is drawn procedurally in the browser at start-up** by
`website/js/textures.js`. Nothing in here is ripped or downloaded — no RobTop/Geometry Dash
artwork is used or redistributed.

The block, spike, saw, pad, orb, portal, coin, ground, icon and UI sprites are all built
once with the Canvas 2D API into offscreen canvases and cached (`gd.tex.TEX`).

## What lives here

| File | Purpose |
| --- | --- |
| `favicon.svg` | Page icon (a GD-style cube inside the menu gradient). |

## Adding your own art

You can drop your own PNGs in this folder and use them instead of the generated sprites.
Load them before `gd.tex.build()` runs (see `index.html`) and assign them into the texture
table, for example:

```js
const img = new Image();
img.src = 'website/assets/textures/my-block.png';
img.onload = () => { gd.tex.TEX.block['#3b7ef0'][0] = img; };   // 36x36 px, one block
```

Sprite slots worth knowing about (`gd.tex.TEX`):

| Slot | Size (px) | Notes |
| --- | --- | --- |
| `block[palette][variant]` | 36x36 | 4 visual variants per palette colour, keyed by hex |
| `spike[palette]`, `spikeDown[palette]` | 36x36 | |
| `saw[palette]`, `sawSmall[palette]` | 79 / 50 | rotating blades |
| `pad[kind]` | 39x16 | yellow / pink / blue / red |
| `orb[kind]`, `ring[kind]`, `dash[kind]` | 34-38 | |
| `portal.mode[i]`, `portal.speed[i]`, `portal.grav*` | ~61x130 | |
| `coin`, `secretCoin` | 41 | |
| `ground[palette]`, `groundSpike[palette]` | 144x144 | tiling floor |
| `face[difficulty]`, `star.on/off`, `arrow.*`, `logo` | various | UI |

Player icons are rendered on demand by `gd.tex.icon(kind, colour1, colour2, glow, variant, size)`
so the icon kit can recolour them instantly.

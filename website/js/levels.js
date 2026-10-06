/* ============================================================
   levels.js - level format, object catalogue, song definitions
   and the six built-in levels (hand-authored patterns).

   Object arrays are stored as:  [x, y, type, w, h, opts]
   x / y are in blocks.  y = 0 means "sitting on the floor",
   positive y is upward.  w/h default to 1.
   ============================================================ */
window.gd = window.gd || {};

(function (gd) {
  'use strict';
  const U = gd.util, C = gd.C;

  /* ---------------- object types ---------------- */
  const T = {
    BLOCK: 'block', HALF: 'half', SLOPE: 'slope', SLOPE_R: 'slope_r',
    PILLAR: 'pillar', OUTLINE: 'outline', SPIKE: 'spike', SPIKE_D: 'spike_d',
    SPIKE_S: 'spike_s', SAW: 'saw', SAW_S: 'saw_s',
    PAD: 'pad', ORB: 'orb', RING: 'ring', DASH: 'dash',
    PORTAL_MODE: 'p_mode', PORTAL_SPEED: 'p_speed', PORTAL_GRAV: 'p_grav',
    PORTAL_SIZE: 'p_size', PORTAL_DUAL: 'p_dual', PORTAL_CEIL: 'p_ceil', PORTAL_TELE: 'p_tele',
    COIN: 'coin', JUMP_ARROW: 'jump', MOVE: 'move', COUNT: 'count',
    COLLISION: 'collision', TRIGGER: 'trigger', END: 'end', DECOR: 'decor'
  };

  const MODE_BY_PORTAL = { 0: C.MODE.CUBE, 1: C.MODE.SHIP, 2: C.MODE.BALL, 3: C.MODE.UFO,
                           4: C.MODE.WAVE, 5: C.MODE.ROBOT, 6: C.MODE.SPIDER, 7: C.MODE.SWING };

  /* ---------------- palette keys ---------------- */
  const PAL = {
    blue: '#3b7ef0', red: '#f0563b', green: '#3bf07a', yellow: '#f0c93b',
    purple: '#a24bf0', cyan: '#4bd8f0', pink: '#f04bb4', white: '#e8e8f0', dark: '#2b2b3a'
  };

  /* ---------------- object helpers ---------------- */
  function o(x, y, type, w, h, opts) { const a = [x, y, type]; if (w !== undefined) a.push(w); if (h !== undefined) a.push(h); if (opts) a.push(opts); return a; }
  function block(x, y, w, h, pal) { return o(x, y, T.BLOCK, w || 1, h || 1, pal ? { pal } : null); }
  function blocks(x, y, w, h, pal) {
    const out = [];
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) out.push(o(x + i, y + j, T.BLOCK, 1, 1, pal ? { pal } : null));
    return out;
  }
  function spike(x, y, down) { return o(x, y, down ? T.SPIKE_D : T.SPIKE); }
  function spikes(x, y, n, gap) {
    gap = gap === undefined ? 1 : gap;
    const out = []; for (let i = 0; i < n; i++) out.push(o(x + i * gap, y, T.SPIKE)); return out;
  }
  function saw(x, y, big, pal) { return o(x, y, big ? T.SAW : T.SAW_S, 1, 1, pal ? { pal } : null); }
  function pad(x, y, kind) { return o(x, y, T.PAD, 1, .5, { kind: kind || 'yellow' }); }
  function orb(x, y, kind) { return o(x, y, T.ORB, 1, 1, { kind: kind || 'yellow' }); }
  function ring(x, y, kind) { return o(x, y, T.RING, 1, 1, { kind: kind || 'yellow' }); }
  function dash(x, y, kind) { return o(x, y, T.DASH, 1, 1, { kind: kind || 'yellow' }); }
  function pMode(x, y, m, h) { return o(x, y, T.PORTAL_MODE, 1.4, h || 3.4, { mode: m }); }
  function pSpeed(x, y, s, h) { return o(x, y, T.PORTAL_SPEED, 1.2, h || 3.0, { speed: s }); }
  function pGrav(x, y, up, h) { return o(x, y, T.PORTAL_GRAV, 1.2, h || 3.0, { up: !!up }); }
  function pSize(x, y, mini, h) { return o(x, y, T.PORTAL_SIZE, 1.0, h || 2.4, { mini: !!mini }); }
  function pDual(x, y, h) { return o(x, y, T.PORTAL_DUAL, 1.0, h || 2.8, {}); }
  function pCeil(x, y, hgt) { return o(x, y, T.PORTAL_CEIL, 1.0, 3.0, { h: hgt === undefined ? 11 : hgt }); }
  function pTele(x, y, tx, ty, color) { return o(x, y, T.PORTAL_TELE, 1.1, 2.8, { tx, ty, color: color || 'blue' }); }
  function coin(x, y, idx, secret) { return o(x, y, T.COIN, 1, 1, { idx, secret: !!secret }); }
  function jumpArrow(x, y, down) { return o(x, y, T.JUMP_ARROW, 1, 1, down ? { down: 1 } : null); }
  function mover(x, y, w, h, dx, dy, period, pal) {
    return o(x, y, T.MOVE, w || 2, h || 1, { dx: dx || 0, dy: dy || 0, period: period || 2, pal });
  }
  function countBlock(x, y, w, h, target) { return o(x, y, T.COUNT, w || 1, h || 1, { target: target || 3 }); }
  function collisionBlock(x, y, w, h) { return o(x, y, T.COLLISION, w || 1, h || 1, null); }
  function decor(x, y, kind, w, h, pal) { return o(x, y, T.DECOR, w || 1, h || 1, { kind, pal }); }
  function endWall(x) { return o(x, 0, T.END, 1, 40, null); }

  /* ---------------- reusable platforming patterns ---------------- */
  const P = {
    /* n single spikes on the floor, spaced by `gap` */
    spikeRun(x, n, gap, y) { return spikes(x, y || 0, n, gap); },

    /* a block you must jump onto, spikes underneath for pressure */
    blockHop(x, h, len, spiked) {
      const out = blocks(x, 0, len || 1, h || 1);
      if (spiked) out.push(spike(x + (len || 1) + 1, 0));
      return out;
    },

    /* staircase of `n` steps, each `h` tall */
    stairs(x, n, h, up) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const hh = up === false ? (n - i) * h : (i + 1) * h;
        for (let j = 0; j < hh; j++) out.push(block(x + i, j));
      }
      return out;
    },

    /* floating platform with spikes on the floor below */
    platform(x, y, len, floorSpikes) {
      const out = blocks(x, y, len, 1);
      if (floorSpikes) for (let i = 0; i < len; i++) out.push(spike(x + i, 0));
      return out;
    },

    /* corridor: ceiling of blocks at `top`, spikes on the floor */
    corridor(x, len, top, spikesOnFloor) {
      const out = blocks(x, top, len, 1);
      if (spikesOnFloor) for (let i = 0; i < len; i += 2) out.push(spike(x + i, 0));
      return out;
    },

    /* spike on top of a block (classic 1-block + spike) */
    spikeBlock(x, h) { return blocks(x, 0, 1, h || 1).concat([spike(x, h || 1)]); },

    /* two spikes with a block between them */
    gapJump(x, gap) { return [spike(x, 0)].concat(spikes(x + (gap || 3), 0, 1)); },

    /* saw sitting on the floor */
    floorSaw(x, y) { return [o(x, y || 0, T.SAW, 1, 1, { pal: 'white' })]; },

    /* slope piece */
    slope(x, y, right) { return [o(x, y, right ? T.SLOPE_R : T.SLOPE, 1, 1, { pal: 'white' })]; },

    /* pad launch onto a high platform */
    padLaunch(x, padKind, platY, platLen, platX) {
      const out = [pad(x, 0, padKind)];
      out.push.apply(out, blocks(platX === undefined ? x + 4 : platX, platY, platLen || 3, 1));
      return out;
    },

    /* orb chain over a spike pit */
    orbChain(x, y, kinds, step) {
      const out = [];
      kinds.forEach((k, i) => out.push(orb(x + i * (step || 4), y, k)));
      for (let i = 0; i < kinds.length * (step || 4); i += 1) out.push(spike(x + i, 0));
      return out;
    },

    /* wave corridor of blocks (top & bottom walls) */
    waveCorridor(x, len, top, bottom, teeth) {
      const out = [];
      for (let i = 0; i < len; i++) {
        out.push(block(x + i, top));
        out.push(block(x + i, bottom));
      }
      if (teeth) {
        teeth.forEach(t => {
          if (t[2] === 'up') out.push(spike(x + t[0], bottom + 1));
          else out.push(spike(x + t[0], top - 1, true));
        });
      }
      return out;
    },

    /* ship section: pillars from floor / ceiling */
    shipPillars(x, spec, ceil) {
      const out = [];
      spec.forEach(s => {
        if (s[1] === 'floor') for (let j = 0; j < s[2]; j++) out.push(block(x + s[0], j));
        else for (let j = 0; j < s[2]; j++) out.push(block(x + s[0], ceil - 1 - j));
      });
      return out;
    },

    /* ufo: platforms with spikes between */
    ufoStep(x, y, len) { return blocks(x, y, len || 2, 1); },

    /* ball: two parallel corridors */
    ballLane(x, len, ceil) {
      const out = [];
      for (let i = 0; i < len; i += 3) { out.push(spike(x + i, 0)); out.push(spike(x + i, ceil - 1, true)); }
      return out;
    }
  };

  function push(list, add) { for (let i = 0; i < add.length; i++) list.push(add[i]); return list; }

  /* ============================================================
     SONGS - original chiptune patterns, synthesised at runtime.
     ============================================================ */
  function song(o) {
    return Object.assign({
      bpm: 128, bars: 48, lead: 0.16, bass: 0.22, pad: 0.06,
      leadWave: 'square', bassWave: 'sawtooth', padWave: 'triangle',
      swing: 0, drums: 'std', arp: 0.0, filter: 1200, endBar: null
    }, o);
  }

  const SONGS = {
    bounce: song({
      bpm: 128, bars: 44, key: 'A',
      scale: [57, 59, 60, 62, 64, 65, 67],
      chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]],
      bassPat: [0, null, 0, null, 7, null, 0, null, 0, null, 0, null, 7, null, 5, null],
      leadPat: [12, null, 14, 12, null, 9, null, 12, 14, null, 16, 14, null, 12, null, null],
      arp: 0.07, leadWave: 'square', bassWave: 'sawtooth', drums: 'std', filter: 1600
    }),
    polar: song({
      bpm: 140, bars: 48, key: 'E',
      scale: [52, 54, 55, 57, 59, 60, 62],
      chords: [[0, 2, 4], [3, 5, 0], [5, 0, 2], [4, 6, 1]],
      bassPat: [0, 0, null, 0, 7, null, 0, null, 0, 0, null, 7, null, 5, null, 7],
      leadPat: [12, 14, null, 16, null, 14, 12, null, 9, null, 12, null, 14, null, 12, null],
      arp: 0.09, leadWave: 'square', bassWave: 'square', drums: 'drive', filter: 2200
    }),
    dry: song({
      bpm: 132, bars: 50, key: 'D',
      scale: [50, 52, 53, 55, 57, 58, 60],
      chords: [[0, 2, 4], [4, 6, 1], [3, 5, 0], [5, 0, 2]],
      bassPat: [0, null, 7, null, 0, null, 7, null, 5, null, 12, null, 7, null, 3, null],
      leadPat: [null, 12, null, 15, 14, null, 12, null, null, 9, null, 12, 14, null, 16, null],
      arp: 0.06, leadWave: 'triangle', bassWave: 'sawtooth', drums: 'std', filter: 1400
    }),
    base: song({
      bpm: 145, bars: 52, key: 'C',
      scale: [48, 50, 51, 53, 55, 56, 58],
      chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [2, 4, 6]],
      bassPat: [0, 0, 12, 0, null, 0, 7, null, 0, 0, 12, 0, null, 7, 5, null],
      leadPat: [12, null, 16, null, 19, null, 16, 14, 12, null, 14, null, 16, null, 19, null],
      arp: 0.10, leadWave: 'square', bassWave: 'square', drums: 'drive', filter: 2600
    }),
    hex: song({
      bpm: 155, bars: 56, key: 'F#',
      scale: [54, 56, 57, 59, 61, 62, 64],
      chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [5, 0, 2]],
      bassPat: [0, null, 0, 7, null, 0, null, 7, 0, null, 12, null, 7, null, 5, null],
      leadPat: [16, 14, 12, null, 14, null, 16, null, 19, null, 16, 14, null, 12, null, 14],
      arp: 0.12, leadWave: 'square', bassWave: 'sawtooth', drums: 'drive', filter: 3000
    }),
    menu: song({
      bpm: 112, bars: 16, key: 'G',
      scale: [55, 57, 59, 60, 62, 64, 66],
      chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]],
      bassPat: [0, null, null, 7, null, null, 0, null, null, 7, null, null, 5, null, null, null],
      leadPat: [12, null, null, null, 14, null, 16, null, null, 14, null, null, 12, null, null, null],
      arp: 0.05, leadWave: 'triangle', bassWave: 'triangle', drums: 'soft', filter: 900
    })
  };

  /* ============================================================
     LEVEL BUILDERS
     ============================================================ */

  /* ------------------------------------------------------------
     SAFE CHUNK LIBRARY
     All numbers here respect the measured cube physics:
     jump rise 2.6 blocks, air time 0.46 s, horizontal reach
     2.65 b (slow) / 3.5 b (normal) / 4.6 b (fast) + fleece margins.
     ------------------------------------------------------------ */
  const CH = {
    /* n spikes on the floor. At slow speed only 2 in a row are clearable. */
    spike(x, n, gap) { return spikes(x, 0, n || 1, gap === undefined ? 1 : gap); },

    /* a 1 or 2 block tall step you hop on top of */
    step(x, h) {
      const out = blocks(x, 0, 1, h);
      out.push(spike(x + h + 1, 0));
      return out;
    },

    /* a staircase of single-block steps (always climbable, +1 per step) */
    stairs(x, n, up) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const hh = up === false ? (n - i) : (i + 1);
        for (let j = 0; j < hh; j++) out.push(block(x + i, j));
      }
      return out;
    },

    /* stairs up followed immediately by stairs down: no unclimbable wall */
    pyramid(x, n) {
      const out = [];
      for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) out.push(block(x + i, j));
      for (let i = 0; i < n; i++) for (let j = 0; j < (n - i); j++) out.push(block(x + n + i, j));
      return out;
    },

    /* low platform (top 2 blocks up) over floor spikes */
    platform(x, len) {
      const out = blocks(x, 1, len, 1);
      for (let i = 0; i < len; i++) out.push(spike(x + i, 0));
      return out;
    },

    /* pad followed by an elevated platform it can actually reach.
       Yellow pad rises 4.5 blocks over ~0.2-0.4 s, so the landing surface
       has to sit 2-3 blocks after the pad at grid y=2 (top 3.0). */
    padRise(x, platY, platLen, padKind, dx) {
      const out = [pad(x, 0, padKind || 'yellow')];
      push(out, blocks(x + (dx || 2), platY === undefined ? 2 : platY, platLen || 3, 1));
      return out;
    },

    /* orb hovering over a hazard field: jump, tap the orb, fly on */
    orbCross(x, y, n, orbY) {
      const out = [orb(x + 1, orbY === undefined ? 2 : orbY, 'yellow')];
      for (let i = 0; i < n; i++) out.push(spike(x + i, 0));
      return out;
    },

    /* saw on the floor (1.5 block wide hazard) */
    saw(x) { return [o(x, 0, T.SAW, 1, 1, { pal: 'white' })]; },

    /* ceiling of blocks over a runway: keeps headroom of `gap` blocks */
    roof(x, len, gap) { return blocks(x, gap, len, 1, 'white'); },

    /* ship corridor: gaps are always >= 4 blocks.
       `spec` entries are [dx, 'f'|'c', height]; the first 8 blocks stay open
       so the ship has room to climb straight after the portal. */
    shipRun(x, ceil, spec) {
      const out = [];
      spec.forEach(s => {
        const dx = s[0] + 8;
        if (s[1] === 'f') for (let j = 0; j < Math.min(s[2], 2); j++) out.push(block(x + dx, j));
        else for (let j = 0; j < s[2]; j++) out.push(block(x + dx, ceil - 1 - j));
      });
      return out;
    }
  };

  /* ---- 1. Stereo Bounce (Easy) : cube -> ship -> cube ---- */
  function buildStereoBounce() {
    const L = [];
    let x = 8;
    push(L, CH.spike(x, 1)); x += 6;
    push(L, CH.spike(x, 1)); x += 6;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.step(x, 1)); x += 6;
    push(L, CH.pyramid(x, 3)); x += 8;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.platform(x, 3)); x += 8;
    push(L, CH.spike(x, 1)); x += 6;
    push(L, CH.step(x, 2)); x += 7;
    push(L, [coin(x, 3, 0)]); push(L, CH.spike(x, 2)); x += 8;
    push(L, CH.padRise(x, 2, 3, 'yellow', 4)); x += 10;
    push(L, CH.spike(x, 1)); x += 5;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 8;
    push(L, CH.stairs(x, 2, true)); x += 5;
    push(L, CH.spike(x, 2)); x += 8;

    /* ship */
    push(L, [pCeil(x - 2, 0, 10), pMode(x, 2, 1)]); x += 3;
    const ceil = 10;
    push(L, CH.shipRun(x, ceil, [[0, 'f', 3], [5, 'c', 4], [10, 'f', 4], [15, 'c', 3],
                                 [20, 'f', 2], [25, 'c', 5], [30, 'f', 3]]));
    push(L, [coin(x + 18, 6, 1)]);
    x += 36;
    push(L, CH.shipRun(x, ceil, [[0, 'f', 5], [6, 'c', 5], [11, 'f', 2], [16, 'c', 3]]));
    x += 20;
    push(L, [pMode(x, 2, 0), pCeil(x + 3, 0, 0)]); x += 5;

    push(L, CH.spike(x, 1)); x += 6;
    push(L, CH.step(x, 1)); x += 6;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 2, 3, 1)); x += 9;
    push(L, CH.spike(x, 1)); x += 6;
    push(L, CH.platform(x, 3)); x += 8;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.stairs(x, 3, true)); x += 6;
    push(L, [coin(x, 5, 2)]); x += 5;
    push(L, CH.spike(x, 1)); x += 6;
    push(L, CH.orbCross(x, 0, 2, 2)); x += 7;
    push(L, CH.step(x, 2)); x += 7;
    push(L, CH.spike(x, 2)); x += 9;
    return { objs: L, endX: x + 6 };
  }

  /* ---- 2. Polargeist (Normal) : cube -> ball -> wave ---- */
  function buildPolargeist() {
    const L = [];
    let x = 8;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.stairs(x, 3, true)); x += 6;
    push(L, CH.saw(x)); x += 6;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, CH.step(x, 2)); x += 7;
    push(L, [coin(x, 5, 0)]); push(L, CH.padRise(x - 1, 3, 3, 'yellow', 4)); x += 10;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.roof(x, 8, 5)); push(L, CH.spike(x + 2, 1)); push(L, CH.spike(x + 5, 1)); x += 11;
    push(L, CH.stairs(x, 2, true)); x += 5;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 9;
    push(L, CH.spike(x, 2)); x += 8;

    /* ball */
    push(L, [pCeil(x - 2, 0, 9), pMode(x, 2, 2)]); x += 3;
    const bc = 9;
    for (let i = 0; i < 5; i++) {
      push(L, blocks(x, 0, 2, 1));
      push(L, blocks(x + 2, bc - 1, 2, 1));
      push(L, [spike(x + 5, 0)]);
      x += 8;
    }
    push(L, [coin(x - 6, 4, 1)]);
    push(L, [pMode(x, 2, 0), pCeil(x + 3, 0, 0)]); x += 5;

    push(L, CH.spike(x, 1)); x += 6;
    push(L, CH.stairs(x, 4, true)); x += 7;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.step(x, 1)); x += 6;
    push(L, CH.saw(x)); push(L, CH.spike(x + 3, 1)); x += 8;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 9;
    push(L, CH.platform(x, 3)); x += 8;

    /* wave */
    push(L, [pSpeed(x, 2, 1), pCeil(x - 2, 0, 10), pMode(x + 2, 3, 4)]); x += 4;
    push(L, P.waveCorridor(x, 30, 9, 0, [[6, 0, 'up'], [13, 0, 'down'], [20, 0, 'up'], [26, 0, 'down']]));
    push(L, [coin(x + 23, 5, 2)]);
    x += 33;
    push(L, P.waveCorridor(x, 16, 8, 1, [[6, 0, 'up'], [13, 0, 'down']]));
    x += 18;
    push(L, [pMode(x, 3, 0), pSpeed(x + 2, 2, 2), pCeil(x + 3, 0, 0)]); x += 6;

    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.step(x, 2)); x += 7;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 2, 3, 1)); x += 10;
    push(L, CH.orbCross(x, 0, 2, 2)); x += 8;
    push(L, CH.spike(x, 2)); x += 9;
    return { objs: L, endX: x + 6 };
  }

  /* ---- 3. Dry Out (Hard) : cube -> ufo -> spider ---- */
  function buildDryOut() {
    const L = [];
    let x = 8;
    push(L, CH.spike(x, 2)); x += 6;
    push(L, CH.step(x, 1)); x += 5;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, CH.stairs(x, 3, true)); x += 6;
    push(L, CH.saw(x)); x += 6;
    push(L, [coin(x, 4, 0)]); x += 4;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.roof(x, 7, 5)); push(L, CH.spike(x + 2, 1)); push(L, CH.spike(x + 4, 1)); x += 10;
    push(L, CH.step(x, 2)); x += 6;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 9;
    push(L, CH.spike(x, 2)); x += 8;

    /* ufo */
    push(L, [pCeil(x - 2, 0, 11), pMode(x, 3, 3), pSpeed(x - 2, 2, 2)]); x += 4;
    const uc = 11;
    for (let i = 0; i < 5; i++) {
      const py = (i % 2 === 0) ? 2 : 4;
      push(L, blocks(x, py, 3, 1));
      push(L, [spike(x + 4, 0)]);
      x += 7;
    }
    push(L, [coin(x - 8, 6, 1)]);
    push(L, blocks(x, 3, 4, 1)); x += 7;
    push(L, [pMode(x, 3, 0), pCeil(x + 3, 0, 0)]); x += 5;

    push(L, CH.spike(x, 2)); x += 6;
    push(L, CH.stairs(x, 3, true)); x += 6;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.saw(x)); push(L, CH.spike(x + 3, 1)); x += 8;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 9;

    /* spider */
    push(L, [pCeil(x - 2, 0, 9), pMode(x, 2, 6)]); x += 3;
    const sc = 9;
    for (let i = 0; i < 4; i++) {
      push(L, blocks(x, 0, 3, 1));
      push(L, blocks(x + 4, sc - 1, 3, 1));
      push(L, [spike(x + 7, 1)]);
      x += 10;
    }
    push(L, [coin(x - 6, 4, 2)]);
    push(L, [pMode(x, 2, 0), pCeil(x + 3, 0, 0)]); x += 5;

    push(L, CH.spike(x, 2)); x += 6;
    push(L, CH.step(x, 1)); x += 6;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.pyramid(x, 3)); x += 8;
    push(L, CH.spike(x, 2)); x += 9;
    return { objs: L, endX: x + 6 };
  }

  /* ---- 4. Base After Base (Harder) : robot -> ship ---- */
  function buildBaseAfterBase() {
    const L = [];
    let x = 8;
    push(L, CH.spike(x, 2)); x += 6;
    push(L, CH.stairs(x, 4, true)); x += 7;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, CH.step(x, 2)); x += 6;
    push(L, [coin(x, 4, 0)]); x += 4;
    push(L, CH.saw(x)); x += 5;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.roof(x, 7, 5)); push(L, CH.spike(x + 2, 1)); push(L, CH.spike(x + 4, 1)); x += 10;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 9;
    push(L, CH.spike(x, 2)); x += 8;

    /* robot */
    push(L, [pMode(x, 2, 5), pSpeed(x - 2, 2, 2)]); x += 3;
    push(L, CH.step(x, 1)); x += 6;
    push(L, blocks(x, 0, 1, 2)); push(L, [spike(x + 3, 0)]); x += 7;
    push(L, CH.stairs(x, 3, true)); x += 6;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); push(L, [coin(x + 5, 5, 1)]); x += 10;
    push(L, CH.saw(x)); push(L, CH.spike(x + 3, 1)); x += 8;
    push(L, CH.orbCross(x, 0, 2, 2)); x += 8;
    push(L, [pMode(x, 2, 0)]); x += 3;

    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.stairs(x, 3, true)); x += 6;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.saw(x)); push(L, CH.orbCross(x + 3, 0, 2, 2)); x += 10;

    /* ship */
    push(L, [pCeil(x - 2, 0, 12), pMode(x, 3, 1), pSpeed(x, 2, 3)]); x += 4;
    const shc = 12;
    push(L, CH.shipRun(x, shc, [[0, 'f', 4], [5, 'c', 6], [10, 'f', 6], [15, 'c', 4],
                                [20, 'f', 3], [25, 'c', 7], [31, 'f', 5], [37, 'c', 4],
                                [42, 'f', 6]]));
    push(L, [coin(x + 30, 6, 2)]);
    x += 48;
    push(L, [pMode(x, 3, 0), pSpeed(x, 2, 2), pCeil(x + 3, 0, 0)]); x += 6;

    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.step(x, 1)); x += 6;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.orbCross(x, 0, 2, 2)); x += 8;
    push(L, CH.spike(x, 2)); x += 9;
    return { objs: L, endX: x + 6 };
  }

  /* ---- 5. Hex Force (Insane) : everything, fast ---- */
  function buildHexForce() {
    const L = [];
    let x = 8;
    push(L, [pSpeed(x, 2, 3)]); x += 2;
    push(L, CH.spike(x, 3)); x += 8;
    push(L, CH.step(x, 1)); x += 7;
    push(L, CH.step(x, 2)); x += 8;
    push(L, CH.spike(x, 3, 2)); x += 10;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 9;
    push(L, CH.saw(x)); push(L, CH.spike(x + 3, 2)); x += 8;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.stairs(x, 4, true)); x += 7;
    push(L, [coin(x, 6, 0)]); x += 3;
    push(L, CH.spike(x, 3)); x += 9;

    /* wave gauntlet */
    push(L, [pMode(x, 3, 4), pCeil(x - 2, 0, 11), pSpeed(x - 2, 2, 4)]); x += 4;
    push(L, P.waveCorridor(x, 34, 10, 0, [[5, 0, 'up'], [12, 0, 'down'], [19, 0, 'up'], [26, 0, 'down'], [31, 0, 'up']]));
    push(L, [coin(x + 23, 5, 1)]);
    x += 37;
    push(L, P.waveCorridor(x, 20, 9, 1, [[6, 0, 'up'], [14, 0, 'down']]));
    x += 22;
    push(L, [pMode(x, 4, 0), pSpeed(x, 2, 3), pCeil(x + 3, 0, 0)]); x += 6;

    push(L, CH.spike(x, 3)); x += 8;
    push(L, CH.step(x, 2)); x += 6;
    push(L, CH.spike(x, 3, 2)); x += 9;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;

    /* swing */
    push(L, [pCeil(x - 2, 0, 11), pMode(x, 3, 7)]); x += 4;
    const wc = 11;
    for (let i = 0; i < 4; i++) {
      push(L, blocks(x, i % 2 ? wc - 3 : 1, 3, 1));
      push(L, [spike(x + 5, 0)]);
      x += 9;
    }
    push(L, [coin(x - 8, 6, 2)]);
    push(L, [pMode(x, 3, 0), pCeil(x + 3, 0, 0)]); x += 6;

    push(L, CH.spike(x, 3)); x += 8;
    push(L, CH.orbCross(x, 0, 4, 2)); x += 11;
    push(L, CH.stairs(x, 5, true)); x += 8;
    push(L, CH.spike(x, 3, 2)); x += 9;
    push(L, CH.saw(x)); push(L, CH.saw(x + 4)); x += 9;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); x += 10;
    push(L, CH.spike(x, 3)); x += 8;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 9;
    push(L, CH.spike(x, 2)); x += 9;
    return { objs: L, endX: x + 6 };
  }

  /* ---- 6. Cyber Loop (Normal, daily) ---- */
  function buildCyberLoop() {
    const L = [];
    let x = 8;
    push(L, CH.spike(x, 1)); x += 6;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.stairs(x, 3, true)); x += 6;
    push(L, CH.spike(x, 1)); x += 6;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 2, 3, 1)); push(L, [coin(x + 5, 4, 0)]); x += 10;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.orbCross(x, 0, 2, 2)); x += 8;
    push(L, CH.step(x, 2)); x += 7;

    /* ufo */
    push(L, [pCeil(x - 2, 0, 10), pMode(x, 2, 3)]); x += 3;
    for (let i = 0; i < 4; i++) {
      push(L, blocks(x, i % 2 ? 3 : 2, 3, 1));
      push(L, [spike(x + 4, 0)]);
      x += 7;
    }
    push(L, [coin(x - 6, 6, 1)]);
    push(L, [pMode(x, 2, 0), pCeil(x + 3, 0, 0)]); x += 5;

    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.step(x, 1)); x += 6;
    push(L, CH.spike(x, 2, 2)); x += 8;
    push(L, CH.platform(x, 3)); x += 8;
    push(L, [pad(x, 0, 'yellow')]); push(L, blocks(x + 4, 3, 3, 1)); push(L, [coin(x + 5, 5, 2)]); x += 10;
    push(L, CH.spike(x, 2)); x += 7;
    push(L, CH.stairs(x, 3, true)); x += 6;
    push(L, CH.orbCross(x, 0, 3, 2)); x += 9;
    push(L, CH.saw(x)); push(L, CH.spike(x + 3, 1)); x += 8;
    push(L, CH.spike(x, 2)); x += 9;
    return { objs: L, endX: x + 6 };
  }

  /* ============================================================
     THEMES
     ============================================================ */
  function theme(name, stops) {
    return { name, stops };
  }
  const THEMES = {
    stereo: theme('Stereo', [
      { x: 0,   bg: '#1b3fb0', bg2: '#0d1f6b', ground: '#1c2a63', line: '#7fd4ff', obj: '#3b7ef0' },
      { x: 260, bg: '#6b1bb0', bg2: '#2b0d6b', ground: '#3a1c63', line: '#ff9be0', obj: '#a24bf0' },
      { x: 520, bg: '#0f7a5a', bg2: '#063f33', ground: '#12463a', line: '#8affd4', obj: '#3bf07a' }
    ]),
    polar: theme('Polar', [
      { x: 0,   bg: '#0e5f8a', bg2: '#052c46', ground: '#0d3a55', line: '#a8f0ff', obj: '#4bd8f0' },
      { x: 200, bg: '#123a7a', bg2: '#061c3f', ground: '#122a55', line: '#9bb8ff', obj: '#3b7ef0' },
      { x: 430, bg: '#6a1250', bg2: '#33061f', ground: '#4a1238', line: '#ff9bd4', obj: '#f04bb4' },
      { x: 640, bg: '#0e5f8a', bg2: '#052c46', ground: '#0d3a55', line: '#a8f0ff', obj: '#4bd8f0' }
    ]),
    dry: theme('Dry Out', [
      { x: 0,   bg: '#a8560f', bg2: '#5a2a05', ground: '#6b3a12', line: '#ffd48a', obj: '#f0c93b' },
      { x: 180, bg: '#8a1f0e', bg2: '#460a05', ground: '#55180d', line: '#ff9b7f', obj: '#f0563b' },
      { x: 400, bg: '#3a2a8a', bg2: '#180f46', ground: '#241c55', line: '#b8a0ff', obj: '#a24bf0' },
      { x: 620, bg: '#a8560f', bg2: '#5a2a05', ground: '#6b3a12', line: '#ffd48a', obj: '#f0c93b' }
    ]),
    base: theme('Base', [
      { x: 0,   bg: '#12664a', bg2: '#05301f', ground: '#0d4632', line: '#8affc4', obj: '#3bf07a' },
      { x: 210, bg: '#0f3f7a', bg2: '#051c46', ground: '#0d2a55', line: '#8ac4ff', obj: '#3b7ef0' },
      { x: 450, bg: '#7a1230', bg2: '#46051a', ground: '#55101f', line: '#ff8aa8', obj: '#f0563b' },
      { x: 680, bg: '#12664a', bg2: '#05301f', ground: '#0d4632', line: '#8affc4', obj: '#3bf07a' }
    ]),
    hex: theme('Hex', [
      { x: 0,   bg: '#2b0f5a', bg2: '#120530', ground: '#1c0d46', line: '#c48aff', obj: '#a24bf0' },
      { x: 170, bg: '#5a0f2b', bg2: '#300512', ground: '#460d1c', line: '#ff8ac4', obj: '#f04bb4' },
      { x: 380, bg: '#0f2b5a', bg2: '#051230', ground: '#0d1c46', line: '#8ac4ff', obj: '#3b7ef0' },
      { x: 560, bg: '#0f5a2b', bg2: '#053012', ground: '#0d461c', line: '#8affc4', obj: '#3bf07a' },
      { x: 760, bg: '#5a2b0f', bg2: '#301205', ground: '#461c0d', line: '#ffc48a', obj: '#f0c93b' }
    ]),
    cyber: theme('Cyber', [
      { x: 0,   bg: '#0f4f6b', bg2: '#052530', ground: '#0d3646', line: '#8af0ff', obj: '#4bd8f0' },
      { x: 160, bg: '#3f0f6b', bg2: '#1a0530', ground: '#2a0d46', line: '#d48aff', obj: '#a24bf0' },
      { x: 340, bg: '#0f6b3f', bg2: '#05301a', ground: '#0d462a', line: '#8affd4', obj: '#3bf07a' },
      { x: 500, bg: '#0f4f6b', bg2: '#052530', ground: '#0d3646', line: '#8af0ff', obj: '#4bd8f0' }
    ])
  };

  /* ============================================================
     LEVEL TABLE
     ============================================================ */
  function makeLevel(def) {
    const built = def.build();
    const song = SONGS[def.song];
    const seconds = (song.bars * 4 * 60) / song.bpm;
    // custom levels end where the creator put the last object; built-in levels
    // are stretched to fill their song so the wall lines up with the music
    const length = def.exactLength ? built.endX
      : Math.max(built.endX, Math.round(seconds * C.SPEEDS[def.baseSpeed] * 0.99));
    built.objs.push(endWall(length));
    // decorate the floor with background pillars for depth
    const rng = U.mulberry(def.seed || 1234);
    for (let dx = 10; dx < length - 6; dx += 6 + Math.floor(rng() * 9)) {
      const h = 1 + Math.floor(rng() * 3);
      built.objs.push(decor(dx, 0, 'pillar', 1, h));
    }
    built.objs.sort((a, b) => a[0] - b[0]);
    return {
      id: def.id, name: def.name, artist: def.artist, difficulty: def.difficulty,
      stars: C.DIFF[def.difficulty].stars, baseSpeed: def.baseSpeed, song, seconds, length,
      theme: THEMES[def.theme], objs: built.objs, endX: length, coins: 3,
      seed: def.seed || 1234, desc: def.desc, daily: !!def.daily
    };
  }

  const LEVEL_DEFS = [
    { id: 'stereo',  name: 'Stereo Bounce',   artist: 'DJ-Nexus', difficulty: 'easy',    baseSpeed: 1, song: 'bounce', theme: 'stereo', seed: 1001, build: buildStereoBounce,
      desc: 'A bright warm-up. Learn the jump, then take the ship out for a spin.' },
    { id: 'polar',   name: 'Polargeist',      artist: 'Step',     difficulty: 'normal',  baseSpeed: 2, song: 'polar',  theme: 'polar',  seed: 2002, build: buildPolargeist,
      desc: 'Ice-blue corridors, a ball flip section and a tight wave tunnel.' },
    { id: 'dryout',  name: 'Dry Out',         artist: 'DJ-Nexus', difficulty: 'hard',    baseSpeed: 2, song: 'dry',    theme: 'dry',    seed: 3003, build: buildDryOut,
      desc: 'Desert heat. UFO hops, saw blades and a spider crawl.' },
    { id: 'base',    name: 'Base After Base', artist: 'Step',     difficulty: 'harder',  baseSpeed: 2, song: 'base',   theme: 'base',   seed: 4004, build: buildBaseAfterBase,
      desc: 'Robot steps, a long ship run and triple-speed timing.' },
    { id: 'hex',     name: 'Hex Force',       artist: 'F-777',    difficulty: 'insane',  baseSpeed: 3, song: 'hex',    theme: 'hex',    seed: 5005, build: buildHexForce,
      desc: 'Everything at once, at speed. Good luck.' },
    { id: 'cyber',   name: 'Cyber Loop',      artist: 'Waterflame', difficulty: 'normal', baseSpeed: 2, song: 'menu', theme: 'cyber', seed: 6006, build: buildCyberLoop, daily: true,
      desc: 'The daily level. Short, sharp and neon.' }
  ];

  const LEVELS = LEVEL_DEFS.map(makeLevel);

  function byId(id) { for (const l of LEVELS) if (l.id === id) return l; return null; }
  function daily() { return LEVELS.find(l => l.daily); }
  function mainLevels() { return LEVELS.filter(l => !l.daily); }

  /* level record accessor (per-level save data) */
  function rec(level) {
    const s = gd.save.levels[level.id] || (gd.save.levels[level.id] = {
      best: 0, attempts: 0, jumps: 0, time: 0, normalPct: 0, practicePct: 0,
      coins: [false, false, false], completed: false, starsAwarded: false
    });
    return s;
  }

  gd.levels = { T, PAL, MODE_BY_PORTAL, SONGS, THEMES, LEVELS, byId, daily, mainLevels, rec, P, makeLevel, helpers: { o, block, blocks, spike, spikes, saw, pad, orb, ring, dash, pMode, pSpeed, pGrav, pSize, pDual, pCeil, pTele, coin, jumpArrow, mover, countBlock, collisionBlock, decor, endWall, push } };
})(window.gd);

/* ============================================================
   util.js - constants, math helpers, colour palette, storage
   ============================================================ */
window.gd = window.gd || {};

(function (gd) {
  'use strict';

  /* ---------- logical screen ---------- */
  const W = 1280, H = 720;
  const B = 36;                       // one "block" in pixels
  const GROUND_Y = 560;               // top surface of the floor (world px)
  const CEIL_MAX = 11;                // max ceiling height in blocks (ship sections)
  const CAM_X_OFF = 0.34 * W;         // player screen x

  /* ---------- physics ---------- */
  const SPEEDS = [4.7, 5.77, 7.7, 9.9, 12.3, 15.4];   // blocks / second (slow..fastest)
  const JUMP_H = 2.6;                                  // blocks
  const JUMP_T = 0.46;                                // total air time (s)
  const GRAV = (2 * JUMP_H) / ((JUMP_T / 2) * (JUMP_T / 2));   // ~55.2 b/s^2
  const JUMP_V = GRAV * (JUMP_T / 2);                          // ~11.9 b/s

  // Note: jump height scales with velocity squared, so these factors are
  // sqrt(heightFactor) relative to a normal cube jump (2.6 blocks).
  const PAD = {
    yellow: JUMP_V * 1.32,    // ~4.5 blocks
    pink:   JUMP_V * 0.96,    // ~2.4 blocks
    red:    JUMP_V * 1.74,    // ~7.9 blocks
    blue:   JUMP_V * 0.90     // blue pad = gravity flip + push
  };
  const ORB = {
    yellow: JUMP_V * 1.00,    // ~2.6 blocks
    pink:   JUMP_V * 1.14,    // ~3.4 blocks
    blue:   JUMP_V * 0.90,
    green:  JUMP_V * 0.85,
    red:    JUMP_V * 1.22,    // ~3.9 blocks
    black:  JUMP_V * 0.78,
    purple: JUMP_V * 1.00
  };
  const DASH_SPEED = 13.0;   // blocks/s for dash orbs / rings

  /* ---------- modes ---------- */
  const MODE = { CUBE: 0, SHIP: 1, BALL: 2, UFO: 3, WAVE: 4, ROBOT: 5, SPIDER: 6, SWING: 7 };
  const MODE_NAME = ['Cube', 'Ship', 'Ball', 'UFO', 'Wave', 'Robot', 'Spider', 'Swing'];

  /* ---------- persistence ---------- */
  const SAVE_KEY = 'gdweb.save.v1';

  const DEFAULT_SAVE = {
    name: 'Player',
    icons: { cube: 0, ship: 0, ball: 0, ufo: 0, wave: 0, robot: 0, spider: 0, swing: 0, death: 0 },
    colors: { p1: 0, p2: 3, glow: 15 },
    settings: {
      music: 0.65, sfx: 0.85, quality: 'high',
      showFps: false, showHitboxes: false, shake: true,
      groundPulse: true, bgEffect: true, smoothRotate: true, lowDetail: false
    },
    levels: {},          // id -> {best, attempts, jumps, time, normalPct, practicePct, coins:[b,b,b], completed, verified}
    unlocked: [],        // shop icon ids
    secretCoins: [],     // 'levelId:idx'
    mana: 0,
    achievements: [],
    custom: [],          // created levels
    stats: { jumps: 0, attempts: 0, deaths: 0, orbs: 0, pads: 0, coins: 0, blocksBroken: 0, playTime: 0 }
  };

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return clone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw);
      return merge(clone(DEFAULT_SAVE), parsed);
    } catch (e) { return clone(DEFAULT_SAVE); }
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(gd.save)); } catch (e) { /* private mode */ }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, over) {
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
          base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  }

  /* ---------- math ---------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (a, b, step) => a < b ? Math.min(a + step, b) : Math.max(a - step, b);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const sign = Math.sign;
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }
  function fmtTime(sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60), ms = Math.floor((sec * 100) % 100);
    return m + ':' + String(s).padStart(2, '0') + '.' + String(ms).padStart(2, '0');
  }

  /* ---------- seeded RNG (level decoration etc.) ---------- */
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- colour helpers ---------- */
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbStr(c, a) {
    return a === undefined ? 'rgb(' + (c.r | 0) + ',' + (c.g | 0) + ',' + (c.b | 0) + ')'
                           : 'rgba(' + (c.r | 0) + ',' + (c.g | 0) + ',' + (c.b | 0) + ',' + a + ')';
  }
  function shade(hex, amt) {           // amt -1..1
    const c = hexToRgb(hex);
    if (amt >= 0) { c.r += (255 - c.r) * amt; c.g += (255 - c.g) * amt; c.b += (255 - c.b) * amt; }
    else { c.r *= (1 + amt); c.g *= (1 + amt); c.b *= (1 + amt); }
    return rgbStr({ r: clamp(c.r, 0, 255), g: clamp(c.g, 0, 255), b: clamp(c.b, 0, 255) });
  }
  function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbStr({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) });
  }
  function withAlpha(hex, a) { return rgbStr(hexToRgb(hex), a); }

  /* GD-like player colour swatches (original palette) */
  const PALETTE = [
    '#31a7ff', '#1a6fe0', '#0d3fa8', '#7a2ee8', '#a63bd6', '#e0348f',
    '#ff3b3b', '#e8641a', '#ffb020', '#ffe14d', '#c9f227', '#5ce35c',
    '#1fc46a', '#12a08c', '#20d8d8', '#ffffff', '#c8c8d2', '#8a8a99',
    '#4a4a5a', '#22222c', '#ff8ab5', '#b0ff8a', '#8affff', '#ffd9a0'
  ];

  /* difficulty faces */
  const DIFF = {
    auto:    { name: 'Auto',    face: '#39d0ff', stars: 0,  key: 'auto' },
    easy:    { name: 'Easy',    face: '#4ade80', stars: 1,  key: 'easy' },
    normal:  { name: 'Normal',  face: '#ffd93b', stars: 2,  key: 'normal' },
    hard:    { name: 'Hard',    face: '#ff9f43', stars: 3,  key: 'hard' },
    harder:  { name: 'Harder',  face: '#ff5e78', stars: 4,  key: 'harder' },
    insane:  { name: 'Insane',  face: '#c56bff', stars: 5,  key: 'insane' },
    demon:   { name: 'Demon',   face: '#ff2b3d', stars: 10, key: 'demon' },
    harddemon:{ name: 'Hard Demon', face: '#ff2b3d', stars: 10, key: 'demon' }
  };

  /* ---------- text drawing (chunky arcade look) ---------- */
  function drawText(ctx, text, x, y, opt) {
    opt = opt || {};
    const size = opt.size || 22;
    const fam = opt.font || 'Impact, "Arial Black", Haettenschweiler, sans-serif';
    ctx.save();
    ctx.font = size + 'px ' + fam;
    ctx.textAlign = opt.align || 'center';
    ctx.textBaseline = opt.baseline || 'middle';
    if (opt.skew) { ctx.translate(x, y); ctx.transform(1, 0, opt.skew, 1, 0, 0); ctx.translate(-x, -y); }
    if (opt.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = opt.shadowBlur || 8;
      ctx.shadowOffsetY = opt.shadowY || 3;
    }
    const sw = opt.stroke === undefined ? Math.max(2, size * 0.13) : opt.stroke;
    if (sw > 0) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = opt.strokeColor || '#000';
      ctx.lineWidth = sw;
      ctx.strokeText(text, x, y);
    }
    if (opt.glow) { ctx.shadowColor = opt.glow; ctx.shadowBlur = opt.glowSize || 18; ctx.shadowOffsetY = 0; }
    if (opt.gradient) {
      const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      g.addColorStop(0, opt.gradient[0]);
      g.addColorStop(1, opt.gradient[1]);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = opt.fill || '#fff';
    }
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function textWidth(ctx, text, size, fam) {
    ctx.save();
    ctx.font = size + 'px ' + (fam || 'Impact, "Arial Black", sans-serif');
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  }

  /* ---------- input snapshot ---------- */
  const input = {
    down: false,          // current frame held
    pressed: false,       // edge this frame
    released: false,
    p2down: false, p2pressed: false, p2released: false,
    mouse: { x: 0, y: 0, down: false, clicked: false, right: false },
    wheel: 0,
    keys: Object.create(null),
    keyPressed: Object.create(null),
    touchSplit: false
  };

  /* ---------- rounded rect ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  gd.C = {
    W, H, B, GROUND_Y, CEIL_MAX, CAM_X_OFF,
    SPEEDS, JUMP_H, JUMP_T, GRAV, JUMP_V, PAD, ORB, DASH_SPEED,
    MODE, MODE_NAME, PALETTE, DIFF, SAVE_KEY, DEFAULT_SAVE
  };
  gd.util = {
    clamp, lerp, approach, rand, randi, sign, aabb, circleRect, fmtTime,
    mulberry, hexToRgb, rgbStr, shade, mix, withAlpha,
    drawText, textWidth, rr, clone, merge
  };
  gd.input = input;
  gd.save = loadSave();
  gd.saveSave = writeSave;

})(window.gd);

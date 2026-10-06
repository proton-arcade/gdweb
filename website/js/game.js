/* ============================================================
   game.js - the actual game: simulation, collisions, rendering
   of a level run (normal + practice mode), particles, camera,
   HUD, pause and level-complete overlays.
   ============================================================ */
window.gd = window.gd || {};

(function (gd) {
  'use strict';
  const U = gd.util, C = gd.C, TEX = gd.tex.TEX;
  const T = gd.levels.T, MODE = C.MODE;
  const B = C.B;

  const DT = 1 / 240;              // physics substep (s)
  const SUB_MAX = 12;
  const MAX_PARTICLES = 900;

  /* ---------------- runtime state ---------------- */
  const S = {
    active: false, level: null, mode: 'normal',      // 'normal' | 'practice'
    objs: [], solids: [], hazards: [], interact: [], decorList: [],
    objPtr: 0,
    attempt: 1, jumps: 0, runTime: 0, totalTime: 0,
    pct: 0, bestPct: 0, dead: false, done: false,
    deathTimer: 0, doneTimer: 0, flash: 0, shake: 0,
    particles: [], trail: [], checkpoints: [],
    coinsRun: [false, false, false],
    camY: 0, ceiling: 0, time: 0,
    paused: false, pauseTab: 'main',
    scrub: 0,
    inputLatch: false, inputLatch2: false,
    hitStop: 0,
    endWallX: 0,
    dual: false,
    themeNow: null,
    showComplete: false,
    stats: { orbs: 0, pads: 0 }
  };

  function newPlayer(x) {
    return {
      x: x || 0, y: 0, vx: 0, vy: 0,
      mode: MODE.CUBE, speed: 1, size: 1, grav: 1,
      onGround: false, rot: 0, rotV: 0, spinning: false,
      prevY: 0, prevX: 0, groundedSolid: null,
      holdT: 0, jumpQueued: false, flipCd: 0,
      dashT: 0, dashDir: 1, dashVy: 0,
      dead: false, phase: 0, waveFlip: 1,
      coyote: 0, lastGroundY: 0
    };
  }
  let P1 = newPlayer(), P2 = null;

  /* ---------------- theme sampling ---------------- */
  function themeAt(level, xb) {
    const stops = level.theme.stops;
    let i = 0;
    while (i + 1 < stops.length && stops[i + 1].x <= xb) i++;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    if (a === b || b.x === a.x) return a;
    const t = U.clamp((xb - a.x) / (b.x - a.x), 0, 1);
    const e = t * t * (3 - 2 * t);
    return {
      bg: U.mix(a.bg, b.bg, e), bg2: U.mix(a.bg2, b.bg2, e),
      ground: U.mix(a.ground, b.ground, e), line: U.mix(a.line, b.line, e),
      obj: U.mix(a.obj, b.obj, e)
    };
  }

  /* ---------------- object preparation ---------------- */
  const SOLID_TYPES = new Set([T.BLOCK, T.HALF, T.SLOPE, T.SLOPE_R, T.MOVE, T.COUNT]);
  const HAZARD_TYPES = new Set([T.SPIKE, T.SPIKE_D, T.SPIKE_S, T.SAW, T.SAW_S, T.COLLISION]);

  function prepare(level) {
    S.objs.length = 0; S.solids.length = 0; S.hazards.length = 0; S.interact.length = 0; S.decorList.length = 0;
    for (let i = 0; i < level.objs.length; i++) {
      const a = level.objs[i];
      const ob = {
        i: i, x: a[0], y: a[1], type: a[2],
        w: (a[3] === undefined ? 1 : a[3]), h: (a[4] === undefined ? 1 : a[4]),
        o: a[5] || null,
        used: false, active: false, hits: 0, anim: Math.random() * 10,
        px: 0, py: 0, hw: 0, hh: 0,          // visual rect (px)
        cx: 0, cy: 0, hx: 0, hy: 0, hw2: 0, hh2: 0, // hit rect
        ox: 0, oy: 0, pvx: 0, pvy: 0          // mover offsets / velocity
      };
      computeRects(ob);
      if (ob.type === T.DECOR) S.decorList.push(ob);
      else if (ob.type === T.END) { S.endWallX = ob.x * B; }
      else {
        S.objs.push(ob);
        if (SOLID_TYPES.has(ob.type)) S.solids.push(ob);
        else if (HAZARD_TYPES.has(ob.type)) S.hazards.push(ob);
        else S.interact.push(ob);
      }
    }
    S.objs.sort((a, b) => a.x - b.x);
    S.solids.sort((a, b) => a.x - b.x);
    S.hazards.sort((a, b) => a.x - b.x);
    S.interact.sort((a, b) => a.x - b.x);
    S.decorList.sort((a, b) => a.x - b.x);
    S.objPtr = 0;
  }

  function computeRects(ob) {
    const t = ob.type, w = ob.w * B, h = ob.h * B;
    ob.hw = w; ob.hh = h;
    ob.px = ob.x * B;
    ob.py = C.GROUND_Y - ob.y * B - h;
    switch (t) {
      case T.SPIKE:
      case T.SPIKE_D:
        ob.hx = ob.px + w * 0.27; ob.hy = ob.py + h * (t === T.SPIKE ? 0.40 : 0.00);
        ob.hw2 = w * 0.46; ob.hh2 = h * 0.60;
        break;
      case T.SPIKE_S:
        ob.hx = ob.px + w * 0.27; ob.hy = ob.py + h * 0.40;
        ob.hw2 = w * 0.46; ob.hh2 = h * 0.60;
        break;
      case T.SAW: case T.SAW_S: {
        const R = (t === T.SAW ? 1.05 : 0.66) * B * 0.5;
        ob.hx = ob.px + w / 2 - R * 0.72; ob.hy = ob.py + h / 2 - R * 0.72;
        ob.hw2 = R * 1.44; ob.hh2 = R * 1.44;
        ob.R = R; ob.big = t === T.SAW;
        break;
      }
      case T.PORTAL_MODE: case T.PORTAL_SPEED: case T.PORTAL_GRAV:
      case T.PORTAL_SIZE: case T.PORTAL_DUAL: case T.PORTAL_CEIL: case T.PORTAL_TELE: {
        // portals must always be entered, so the trigger spans from the top of
        // the portal down toward the floor (never a "walk past it" gap)
        ob.hx = ob.px + w * 0.10;
        ob.hw2 = w * 0.80;
        ob.hy = ob.py;
        ob.hh2 = Math.min(C.GROUND_Y - ob.py, h + 3.6 * B);
        break;
      }
      case T.PAD:
        ob.hx = ob.px + w * 0.08; ob.hy = ob.py + h * 0.25;
        ob.hw2 = w * 0.84; ob.hh2 = h * 0.9;
        break;
      case T.ORB: case T.RING: case T.DASH:
        ob.hx = ob.px + w * 0.03; ob.hy = ob.py + h * 0.03;
        ob.hw2 = w * 0.94; ob.hh2 = h * 0.94;
        break;
      case T.COIN:
        ob.hx = ob.px + w * 0.15; ob.hy = ob.py + h * 0.15;
        ob.hw2 = w * 0.7; ob.hh2 = h * 0.7;
        break;
      case T.COUNT:
        ob.hx = ob.px; ob.hy = ob.py; ob.hw2 = w; ob.hh2 = h;
        break;
      default:
        ob.hx = ob.px; ob.hy = ob.py; ob.hw2 = w; ob.hh2 = h;
    }
  }

  function solidRect(ob) {
    let x = ob.hx, y = ob.hy, w = ob.hw2, h = ob.hh2;
    if (ob.type === T.MOVE) { x += ob.ox; y += ob.oy; }
    return { x, y, w, h };
  }

  /* ---------------- entering a level ---------------- */
  function enter(level, mode) {
    S.time = 0;
    S.level = level;
    S.mode = mode || 'normal';
    S.active = true;
    S.paused = false; S.pauseTab = 'main';
    S.dead = false; S.done = false; S.showComplete = false;
    S.deathTimer = 0; S.doneTimer = 0; S.flash = 0; S.shake = 0;
    S.particles.length = 0; S.trail.length = 0; S.checkpoints.length = 0;
    S.runTime = 0; S.jumps = 0; S.pct = 0; S.time = 0;
    S.dual = false; S.ceiling = 0;
    S.coinsRun = [false, false, false];
    S.stats.orbs = 0; S.stats.pads = 0;
    S.attempt = 1;
    prepare(level);
    const rec = gd.levels.rec(level);
    S.bestPct = rec.best || 0;
    S.totalTime = rec.time || 0;
    rec.attempts = (rec.attempts || 0);
    resetRun(true);
    gd.audio.stopSong();
    gd.audio.playSong(level.song, { delay: 0.12 });
  }

  function resetRun(first) {
    S.attemptT = 0;
    P1 = newPlayer(0);
    P1.speed = S.level.baseSpeed;
    P2 = null; S.dual = false;
    S.ceiling = 0;
    S.dead = false; S.done = false; S.deathTimer = 0; S.doneTimer = 0;
    S.particles.length = 0; S.trail.length = 0;
    S.pct = 0; S.runTime = 0; S.jumps = 0;
    S.coinsRun = [false, false, false];
    S.inputLatch = false; S.inputLatch2 = false;
    S.objPtr = 0;
    S.camY = 0;
    S.flash = 0; S.shake = 0;
    for (let i = 0; i < S.objs.length; i++) {
      const ob = S.objs[i];
      ob.used = false; ob.active = false; ob.hits = 0; ob.ox = 0; ob.oy = 0; ob.pvx = 0; ob.pvy = 0;
    }
    if (!first) {
      S.attempt++;
      gd.save.stats.attempts++;
      const rec = gd.levels.rec(S.level);
      rec.attempts = (rec.attempts || 0) + 1;
    } else {
      gd.save.stats.attempts++;
      const rec = gd.levels.rec(S.level);
      rec.attempts = (rec.attempts || 0) + 1;
    }
    gd.saveSave();
  }

  function restart() {
    if (S.mode === 'practice' && S.checkpoints.length) restoreCheckpoint(S.checkpoints[S.checkpoints.length - 1]);
    else {
      resetRun(false);
      gd.audio.stopSong();
      gd.audio.playSong(S.level.song, { delay: 0.06 });
    }
  }

  function exit() {
    S.active = false;
    gd.audio.stopSong();
  }

  /* ---------------- practice checkpoints ---------------- */
  function snapshot() {
    return {
      x: P1.x, y: P1.y, vx: P1.vx, vy: P1.vy, mode: P1.mode, speed: P1.speed,
      size: P1.size, grav: P1.grav, rot: P1.rot, onGround: P1.onGround,
      dual: S.dual, ceiling: S.ceiling, coins: S.coinsRun.slice(),
      p2: (S.dual && P2) ? { x: P2.x, y: P2.y, vx: P2.vx, vy: P2.vy, grav: P2.grav, rot: P2.rot, mode: P2.mode, size: P2.size, speed: P2.speed } : null,
      used: S.objs.filter(o => o.used).map(o => o.i),
      active: S.objs.filter(o => o.active).map(o => o.i),
      pct: S.pct, jumpCount: S.jumps
    };
  }
  function restoreCheckpoint(cp) {
    for (let i = 0; i < S.objs.length; i++) { S.objs[i].used = false; S.objs[i].active = false; S.objs[i].ox = 0; S.objs[i].oy = 0; }
    cp.used.forEach(i => { const ob = S.objs.find(o => o.i === i); if (ob) ob.used = true; });
    cp.active.forEach(i => { const ob = S.objs.find(o => o.i === i); if (ob) ob.active = true; });
    P1 = newPlayer(0);
    Object.assign(P1, { x: cp.x, y: cp.y, vx: cp.vx, vy: cp.vy, mode: cp.mode, speed: cp.speed, size: cp.size, grav: cp.grav, rot: cp.rot, onGround: cp.onGround });
    S.dual = cp.dual; S.ceiling = cp.ceiling; S.coinsRun = cp.coins.slice();
    if (S.dual && cp.p2) {
      P2 = newPlayer(0);
      Object.assign(P2, cp.p2);
    } else P2 = null;
    S.dead = false; S.deathTimer = 0; S.pct = cp.pct; S.jumps = cp.jumpCount;
    S.particles.length = 0; S.trail.length = 0;
    S.inputLatch = false; S.inputLatch2 = false;
    S.camY = clampCamY(P1.y * B - 170);
    gd.audio.sfx('checkpoint');
  }
  function addCheckpoint() {
    if (S.mode !== 'practice') return;
    S.checkpoints.push(snapshot());
    if (S.checkpoints.length > 200) S.checkpoints.shift();
    for (let i = 0; i < 18; i++) {
      spawnParticle(P1.x * B + B / 2, C.GROUND_Y - P1.y * B, U.rand(-90, 90), U.rand(-160, 40), '#5ce35c', U.rand(.3, .7), U.rand(2, 5));
    }
    gd.audio.sfx('checkpoint');
  }
  function removeCheckpoint() {
    if (S.checkpoints.length) { S.checkpoints.pop(); gd.audio.sfx('back'); }
  }
  function scrubTo(pct) {
    const cp = {
      x: pct * S.level.length, y: 0, vx: 0, vy: 0, mode: MODE.CUBE, speed: S.level.baseSpeed,
      size: 1, grav: 1, rot: 0, onGround: true, dual: false, ceiling: 0,
      coins: [false, false, false], p2: null, used: [], active: [], pct: pct * 100, jumpCount: 0
    };
    // activate every portal passed so mode/speed/ceiling are right
    for (const ob of S.objs) {
      if (ob.x > cp.x) break;
      if (ob.type === T.PORTAL_MODE || ob.type === T.PORTAL_SPEED || ob.type === T.PORTAL_GRAV ||
          ob.type === T.PORTAL_SIZE || ob.type === T.PORTAL_DUAL || ob.type === T.PORTAL_CEIL) {
        applyPortal(ob, P1, true);
        cp.used.push(ob.i);
        if (ob.type === T.PORTAL_CEIL) cp.ceiling = S.ceiling;
        if (ob.type === T.PORTAL_MODE) cp.mode = P1.mode;
        if (ob.type === T.PORTAL_SPEED) cp.speed = P1.speed;
        if (ob.type === T.PORTAL_GRAV) cp.grav = P1.grav;
        if (ob.type === T.PORTAL_SIZE) cp.size = P1.size;
        if (ob.type === T.PORTAL_DUAL) cp.dual = S.dual;
      }
    }
    P1.mode = cp.mode; P1.speed = cp.speed; P1.size = cp.size; P1.grav = cp.grav;
    restoreCheckpoint(cp);
    S.mode = 'practice';
  }

  /* ---------------- particles ---------------- */
  function spawnParticle(x, y, vx, vy, color, life, size, kind) {
    if (S.particles.length >= MAX_PARTICLES) S.particles.shift();
    S.particles.push({ x, y, vx, vy, color, life, max: life, size: size || 3, kind: kind || 'square', rot: Math.random() * 6.28, vr: U.rand(-8, 8) });
  }
  function burst(x, y, n, color, spread, speed, life, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = U.rand(speed * .25, speed);
      spawnParticle(x, y, Math.cos(a) * s * (spread || 1), Math.sin(a) * s, color, U.rand(life * .5, life), U.rand(2, 6), kind);
    }
  }

  /* ---------------- main update ---------------- */
  function update(dtReal, inp) {
    if (!S.active || S.paused) return;
    S.time += dtReal;

    if (S.done) {
      S.doneTimer += dtReal;
      updateParticles(dtReal);
      if (S.doneTimer > 1.1 && !S.showComplete) { S.showComplete = true; gd.ui.onLevelComplete(); }
      return;
    }
    if (S.dead) {
      S.deathTimer += dtReal;
      updateParticles(dtReal);
      S.shake = Math.max(0, S.shake - dtReal * 40);
      S.flash = Math.max(0, S.flash - dtReal * 3.2);
      if (S.deathTimer > 0.85 && inp.press) { restart(); }
      else if (S.deathTimer > 2.6) restart();
      return;
    }

    // fixed-step physics (even split so we never run a zero-length substep,
    // which used to cancel out pad / orb impulses on the frame they fired)
    const acc = Math.min(dtReal, 0.1);
    let n = Math.ceil(acc / DT - 1e-6);
    if (n < 1) n = 1;
    if (n > SUB_MAX) n = SUB_MAX;
    const h = acc / n;
    for (let i = 0; i < n; i++) step(h, inp);
    updateParticles(dtReal);
    S.shake = Math.max(0, S.shake - dtReal * 22);
    S.flash = Math.max(0, S.flash - dtReal * 3.0);

    // trail
    const px = P1.x * B, py = C.GROUND_Y - P1.y * B;
    if (S.trail.length === 0 || Math.hypot(px - S.trail[S.trail.length - 1].x, py - S.trail[S.trail.length - 1].y) > 5) {
      S.trail.push({ x: px, y: py, life: 0.42, size: P1.size * B * 0.30, grav: P1.grav });
      if (S.trail.length > 60) S.trail.shift();
    }
    for (let i = S.trail.length - 1; i >= 0; i--) {
      S.trail[i].life -= dtReal;
      if (S.trail[i].life <= 0) S.trail.splice(i, 1);
    }

    // progress
    S.pct = U.clamp(P1.x / S.level.length, 0, 1) * 100;
    S.runTime += dtReal;
    S.attemptT = (S.attemptT || 0) + dtReal;
    S.totalTime += dtReal;
    if (S.pct > S.bestPct) S.bestPct = S.pct;

    if (P1.x * B >= S.endWallX - B * 0.2) complete();   // endWallX is in px
  }

  function updateParticles(dt) {
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.life -= dt;
      if (p.life <= 0) { S.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 620 * dt;
      p.vx *= (1 - 1.4 * dt);
      p.rot += p.vr * dt;
    }
  }

  /* ---------------- one physics substep ---------------- */
  function step(h, inp) {
    if (!(h > 0)) return;
    updateMovers(h);
    advancePtr();

    const press1 = inp.press && !S.inputLatch;
    if (inp.press) S.inputLatch = true;
    if (!inp.down) S.inputLatch = false;
    const press2 = inp.p2pressed && !S.inputLatch2;
    if (inp.p2pressed) S.inputLatch2 = true;
    if (!inp.p2down) S.inputLatch2 = false;

    stepPlayer(P1, h, inp.down, press1, false);
    if (S.dual && P2) stepPlayer(P2, h, inp.p2down || inp.down, press2 || press1, true);

    // camera
    const target = camTarget(P1);
    S.camY += (target - S.camY) * Math.min(1, h * 9);
  }

  function camTarget(p) {
    const py = C.GROUND_Y - p.y * B;
    if (p.mode === MODE.CUBE || p.mode === MODE.ROBOT || p.mode === MODE.SPIDER || p.mode === MODE.BALL) {
      return clampCamY(C.GROUND_Y - 540 + (p.y > 6 ? -(p.y - 6) * B * 0.55 : 0));
    }
    return clampCamY(py - 400);
  }
  function clampCamY(v) {
    const ceilPx = C.GROUND_Y - S.ceiling * B;
    const minY = Math.min(C.GROUND_Y - 540, ceilPx - 540 + 40);
    return U.clamp(v, minY, C.GROUND_Y - 540);
  }

  function updateMovers(h) {
    for (let i = 0; i < S.solids.length; i++) {
      const ob = S.solids[i];
      if (ob.type !== T.MOVE || !ob.o) continue;
      const per = ob.o.period || 2;
      const w = Math.PI * 2 / per;
      const ph = w * S.time + (ob.o.phase || 0);
      const nx = Math.sin(ph) * (ob.o.dx || 0) * B;
      const ny = -Math.sin(ph) * (ob.o.dy || 0) * B;
      ob.pvx = (nx - ob.ox) / h; ob.pvy = (ny - ob.oy) / h;
      ob.ox = nx; ob.oy = ny;
    }
  }

  function advancePtr() {
    const limit = P1.x * B - B * 6;
    while (S.objPtr < S.objs.length && S.objs[S.objPtr].px < limit) S.objPtr++;
  }

  function sizeOf(p) { return B * p.size * (p.mode === MODE.WAVE ? 0.78 : 0.9); }

  function playerRect(p) {
    const s = sizeOf(p);
    return { x: p.x * B - s / 2, y: C.GROUND_Y - p.y * B - s / 2, w: s, h: s };
  }

  function stepPlayer(p, h, held, pressed, isDual) {
    if (p.dead) return;
    p.prevX = p.x * B; p.prevY = C.GROUND_Y - p.y * B;
    const g = p.grav;
    p.flipCd = Math.max(0, p.flipCd - h);
    if (p.dashT > 0) p.dashT -= h;
    p.phase += h * (p.onGround ? 14 : 4);

    /* ---- horizontal ---- */
    let vx = C.SPEEDS[p.speed];
    if (p.dashT > 0) vx = C.DASH_SPEED * p.dashDir;
    p.vx = vx;
    p.x += vx * h;

    /* ---- mode specific vertical ---- */
    const gravity = C.GRAV * p.size;
    switch (p.mode) {
      case MODE.CUBE:
      case MODE.ROBOT:
      case MODE.SPIDER:
      case MODE.BALL:
      case MODE.SWING: {
        if (p.onGround && pressed) doJump(p, held);
        else if (!p.onGround && p.mode === MODE.ROBOT && held && p.holdT < 0.26) {
          p.holdT += h;
          p.vy += g * gravity * 0.52 * h;      // reduced gravity while holding
        } else {
          p.vy -= g * gravity * h;
        }
        if (p.mode === MODE.BALL && pressed && !p.onGround && p.flipCd <= 0) { flipGravity(p); p.flipCd = 0.16; }
        if (p.mode === MODE.SWING && pressed && p.flipCd <= 0) {
          flipGravity(p); p.flipCd = 0.14;
          p.vy = g * C.JUMP_V * 0.55 * p.size;
          gd.audio.sfx('flip');
          burst(p.x * B, C.GROUND_Y - p.y * B, 8, '#a24bf0', 1, 150, .4);
        }
        if (p.mode === MODE.SPIDER && pressed && !p.onGround && p.flipCd <= 0) { spiderTeleport(p); p.flipCd = 0.14; }
        if (p.onGround && p.mode !== MODE.ROBOT) p.holdT = 0;
        p.vy = U.clamp(p.vy, -34, 34);
        break;
      }
      case MODE.SHIP: {
        const thrust = 62 * p.size;
        if (held) p.vy += g * thrust * h;
        p.vy -= g * (gravity * 0.60) * h;
        p.vy = U.clamp(p.vy, -13 * p.size, 13 * p.size);
        break;
      }
      case MODE.UFO: {
        if (pressed) {
          p.vy = g * C.JUMP_V * 0.62 * p.size;
          gd.audio.sfx('jump');
          burst(p.x * B, C.GROUND_Y - p.y * B + g * 10, 6, '#ffffff', 1, 90, .3);
        }
        p.vy -= g * (gravity * 0.78) * h;
        p.vy = U.clamp(p.vy, -13 * p.size, 11 * p.size);
        break;
      }
      case MODE.WAVE: {
        // the wave moves diagonally; flipping gravity flips the controls too
        p.vy = (held ? 1 : -1) * vx * 0.92 * p.grav;
        break;
      }
    }

    /* ---- integrate vertical ---- */
    p.y += p.vy * h;   // vy already carries the gravity sign through the mode logic above

    /* ---- rotation ---- */
    if (p.mode === MODE.CUBE || p.mode === MODE.ROBOT || p.mode === MODE.BALL || p.mode === MODE.SPIDER) {
      if (!p.onGround) {
        const spin = (p.mode === MODE.BALL ? 430 : p.mode === MODE.SPIDER ? 0 : 400) * g;
        p.rot += spin * h * (Math.PI / 180);
        p.spinning = true;
      } else if (p.spinning) {
        const target = Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2);
        if (gd.save.settings.smoothRotate) p.rot = U.approach(p.rot, target, h * 22);
        else p.rot = target;
        if (Math.abs(p.rot - target) < 0.02) { p.rot = target; p.spinning = false; }
      }
    } else if (p.mode === MODE.SHIP || p.mode === MODE.UFO || p.mode === MODE.SWING) {
      const target = U.clamp(p.vy * g, -12, 12) * (Math.PI / 180) * 3.0 * g;
      p.rot += (U.clamp(target, -0.75, 0.75) - p.rot) * Math.min(1, h * 12);
    } else if (p.mode === MODE.WAVE) {
      const target = (held ? -0.72 : 0.72) * g;
      p.rot += (target - p.rot) * Math.min(1, h * 26);
    }

    /* ---- collisions ---- */
    resolveCollisions(p, h, isDual);
  }

  function doJump(p, held) {
    if (p.mode === MODE.SPIDER) { spiderTeleport(p); return; }
    const v = C.JUMP_V * p.size;
    p.vy = p.grav * v;
    p.onGround = false;
    p.spinning = true;
    p.holdT = 0;
    if (!S.dual || p === P1) {
      S.jumps++;
      gd.save.stats.jumps++;
    }
    gd.audio.sfx('jump');
    const py = C.GROUND_Y - p.y * B;
    for (let i = 0; i < 6; i++) {
      spawnParticle(p.x * B + U.rand(-8, 8), py + p.grav * sizeOf(p) / 2, U.rand(-70, 20), -p.grav * U.rand(10, 70),
        'rgba(255,255,255,.7)', U.rand(.18, .35), U.rand(2, 4));
    }
  }

  function flipGravity(p) {
    p.grav = -p.grav;
    p.onGround = false;
    p.rot += Math.PI;
    gd.audio.sfx('flip');
  }

  function spiderTeleport(p) {
    const s = sizeOf(p);
    const r = playerRect(p);
    const newG = -p.grav;
    // scan for the first surface in the new gravity direction
    let best = null;
    const dir = newG > 0 ? 1 : -1;     // 1 = upward in world px? (grav 1 means "down")
    // gravity 1 => falls downward (screen +y). Search downward.
    const searchDir = newG > 0 ? 1 : -1; // in screen px
    let sy = r.y + r.h / 2;
    const maxScan = 16 * B;
    for (let d = 0; d < maxScan; d += 2) {
      const yy = sy + searchDir * d;
      // ground / ceiling bounds
      if (searchDir > 0 && yy + s / 2 >= C.GROUND_Y) { best = C.GROUND_Y - s / 2; break; }
      if (S.ceiling > 0) {
        const ceilPx = C.GROUND_Y - S.ceiling * B;
        if (searchDir < 0 && yy - s / 2 <= ceilPx) { best = ceilPx + s / 2; break; }
      } else if (searchDir < 0 && yy - s / 2 <= -B * 4) break;
      for (let i = 0; i < S.solids.length; i++) {
        const ob = S.solids[i];
        if (ob.px > r.x + r.w + B * 2) break;
        if (ob.px + ob.hw2 < r.x - B * 2) continue;
        if (ob.type === T.COUNT && !ob.active) continue;
        const sr = solidRect(ob);
        if (r.x < sr.x + sr.w && r.x + r.w > sr.x) {
          if (searchDir > 0 && yy + s / 2 >= sr.y && sy + s / 2 <= sr.y + 2) { best = sr.y - s / 2; break; }
          if (searchDir < 0 && yy - s / 2 <= sr.y + sr.h && sy - s / 2 >= sr.y + sr.h - 2) { best = sr.y + sr.h + s / 2; break; }
        }
      }
      if (best !== null) break;
    }
    p.grav = newG;
    p.vy = 0;
    p.rot += Math.PI;
    if (best !== null) {
      const oldY = C.GROUND_Y - p.y * B;
      p.y = (C.GROUND_Y - best) / B;
      gd.audio.sfx('flip');
      burst(p.x * B, oldY, 10, '#e8e8f0', 1, 170, .4);
      burst(p.x * B, best, 10, '#e8e8f0', 1, 170, .4);
      p.onGround = true;
    } else {
      gd.audio.sfx('flip');
    }
  }

  /* ---------------- collision resolution ---------------- */
  function resolveCollisions(p, h, isDual) {
    const r = playerRect(p);
    const s = r.w;
    let grounded = false, groundVy = 0;
    p.groundedSolid = null;

    const minX = r.x - B * 3, maxX = r.x + r.w + B * 3;

    /* --- solids --- */
    for (let i = 0; i < S.solids.length; i++) {
      const ob = S.solids[i];
      if (ob.px > maxX) break;
      if (ob.px + ob.hw2 < minX) continue;
      if (ob.type === T.COUNT && !ob.active) continue;
      const sr = solidRect(ob);
      if (!U.aabb(r.x, r.y, r.w, r.h, sr.x, sr.y, sr.w, sr.h)) continue;

      const overlapTop = (r.y + r.h) - sr.y;        // pushing up out of top
      const overlapBot = (sr.y + sr.h) - r.y;       // pushing down out of bottom
      const movingDown = p.vy * p.grav < 0 || p.vy === 0 ? p.grav > 0 : p.vy < 0;

      if (p.grav > 0) {
        // normal gravity: can land on top
        if (p.prevY + s * 0.5 <= sr.y + 7 && p.vy <= 0.5) {
          const fix = overlapTop;
          if (fix < s * 0.85) {
            r.y -= fix; p.y = (C.GROUND_Y - (r.y + s / 2)) / B;
            p.vy = 0; grounded = true; p.groundedSolid = ob;
            groundVy = ob.pvy || 0;
            continue;
          }
        }
        if (p.prevY - s * 0.5 >= sr.y + sr.h - 7 && p.vy > 0) {
          const fix = overlapBot;
          if (fix < s * 0.85) {
            if (p.mode === MODE.SHIP || p.mode === MODE.UFO || p.mode === MODE.WAVE || p.mode === MODE.SWING) {
              r.y += fix; p.y = (C.GROUND_Y - (r.y + s / 2)) / B; p.vy = 0; continue;
            }
            return kill(p, isDual, ob);
          }
        }
      } else {
        // inverted gravity: lands on undersides
        if (p.prevY - s * 0.5 >= sr.y + sr.h - 7 && p.vy >= -0.5) {
          const fix = overlapBot;
          if (fix < s * 0.85) {
            r.y += fix; p.y = (C.GROUND_Y - (r.y + s / 2)) / B;
            p.vy = 0; grounded = true; p.groundedSolid = ob;
            groundVy = ob.pvy || 0;
            continue;
          }
        }
        if (p.prevY + s * 0.5 <= sr.y + 7 && p.vy < 0) {
          const fix = overlapTop;
          if (fix < s * 0.85) {
            if (p.mode === MODE.SHIP || p.mode === MODE.UFO || p.mode === MODE.WAVE || p.mode === MODE.SWING) {
              r.y -= fix; p.y = (C.GROUND_Y - (r.y + s / 2)) / B; p.vy = 0; continue;
            }
            return kill(p, isDual, ob);
          }
        }
      }
      // side hit
      if (p.mode === MODE.WAVE) return kill(p, isDual, ob);
      return kill(p, isDual, ob);
    }

    /* --- floor / ceiling --- */
    if (p.grav > 0) {
      if (r.y + s >= C.GROUND_Y) {
        r.y = C.GROUND_Y - s; p.y = (C.GROUND_Y - (r.y + s / 2)) / B;
        p.vy = 0; grounded = true; p.groundedSolid = null;
      }
    } else {
      if (S.ceiling > 0) {
        const ceilPx = C.GROUND_Y - S.ceiling * B;
        if (r.y <= ceilPx) {
          r.y = ceilPx; p.y = (C.GROUND_Y - (r.y + s / 2)) / B;
          p.vy = 0; grounded = true; p.groundedSolid = null;
        }
      } else if (r.y <= -B * 6) {
        return kill(p, isDual, null);
      }
    }
    // ceiling smash for grounded modes
    if (S.ceiling > 0 && (p.mode === MODE.CUBE || p.mode === MODE.ROBOT || p.mode === MODE.BALL || p.mode === MODE.SPIDER)) {
      const ceilPx = C.GROUND_Y - S.ceiling * B;
      if (r.y < ceilPx) return kill(p, isDual, null);
    }
    if (p.grav > 0 && S.ceiling === 0 && p.y > 30) { /* flew too high, fine */ }

    /* riding a mover */
    if (grounded && p.groundedSolid && p.groundedSolid.type === T.MOVE) {
      p.y -= (p.groundedSolid.pvy * h) / B;
    }

    const wasGrounded = p.onGround;
    p.onGround = grounded;
    if (grounded && !wasGrounded && p.mode !== MODE.SHIP) {
      gd.audio.sfx('land', { vol: .5 });
      const py = C.GROUND_Y - p.y * B + p.grav * s / 2;
      for (let i = 0; i < 5; i++) {
        spawnParticle(p.x * B + U.rand(-8, 8), py, U.rand(-110, -20), -p.grav * U.rand(5, 60),
          'rgba(255,255,255,.6)', U.rand(.15, .3), U.rand(2, 4));
      }
    }

    /* --- interactive objects --- */
    for (let i = 0; i < S.interact.length; i++) {
      const ob = S.interact[i];
      if (ob.px > maxX + B) break;
      if (ob.px + ob.hw < minX - B) continue;
      handleInteract(ob, p, r, isDual);
    }

    /* --- hazards --- */
    for (let i = 0; i < S.hazards.length; i++) {
      const ob = S.hazards[i];
      if (ob.px > maxX) break;
      if (ob.px + ob.hw < minX) continue;
      if (ob.type === T.SAW || ob.type === T.SAW_S) {
        if (U.circleRect(ob.px + ob.hw / 2, ob.py + ob.hh / 2, ob.R * 0.72, r.x, r.y, r.w, r.h)) return kill(p, isDual, ob);
      } else if (ob.type === T.COLLISION) {
        if (U.aabb(r.x, r.y, r.w, r.h, ob.hx, ob.hy, ob.hw2, ob.hh2)) return kill(p, isDual, ob);
      } else {
        if (U.aabb(r.x + r.w * 0.12, r.y + r.h * 0.12, r.w * 0.76, r.h * 0.76, ob.hx, ob.hy, ob.hw2, ob.hh2)) return kill(p, isDual, ob);
      }
    }
  }

  function handleInteract(ob, p, r, isDual) {
    const hit = U.aabb(r.x, r.y, r.w, r.h, ob.hx, ob.hy, ob.hw2, ob.hh2);
    switch (ob.type) {
      case T.PAD: {
        if (!hit) { if (ob.active) ob.active = false; return; }
        if (ob.used) return;
        ob.used = true; ob.active = true;
        const kind = (ob.o && ob.o.kind) || 'yellow';
        const v = C.PAD[kind] * p.size;
        if (kind === 'blue') { p.grav = -p.grav; p.vy = p.grav * v; p.rot += Math.PI; }
        else { p.grav = p.grav; p.vy = p.grav * v; }
        p.onGround = false; p.spinning = true;
        S.stats.pads++; gd.save.stats.pads++;
        gd.audio.sfx('pad');
        const col = { yellow: '#ffe14d', pink: '#ff6fb5', blue: '#4bb3ff', red: '#ff4b4b' }[kind];
        burst(ob.px + ob.hw / 2, ob.py, 14, col, 1.4, 240, .45);
        S.shake = Math.max(S.shake, 3);
        break;
      }
      case T.ORB: case T.RING: case T.DASH: {
        if (!hit) { ob.active = false; return; }
        if (isDual) return;
        const kind = (ob.o && ob.o.kind) || 'yellow';
        const held = gd.input.down || gd.input.p2down;
        if (!held) { ob.active = false; return; }
        if (ob.used) return;
        ob.used = true; ob.active = true;
        S.stats.orbs++; gd.save.stats.orbs++;
        const col = { yellow: '#ffe14d', pink: '#ff6fb5', blue: '#4bb3ff', green: '#5ce35c', red: '#ff4b4b', black: '#2b2b3a', purple: '#a24bf0' }[kind];
        if (ob.type === T.DASH) {
          p.dashT = 0.34; p.dashDir = kind === 'pink' ? -1 : 1;
          p.vy = 0;
          gd.audio.sfx('dash');
          burst(ob.px + ob.hw / 2, ob.py + ob.hh / 2, 18, col, 2.2, 320, .5);
        } else if (ob.type === T.RING) {
          const v = C.ORB[kind] * p.size;
          if (kind === 'blue') { p.grav = -p.grav; p.rot += Math.PI; }
          p.vy = p.grav * v; p.onGround = false; p.spinning = true;
          gd.audio.sfx('ring');
          burst(ob.px + ob.hw / 2, ob.py + ob.hh / 2, 14, col, 1.6, 250, .5);
        } else {
          const v = C.ORB[kind] * p.size;
          if (kind === 'blue') { p.grav = -p.grav; p.rot += Math.PI; }
          p.vy = p.grav * v; p.onGround = false; p.spinning = true;
          gd.audio.sfx('orb');
          burst(ob.px + ob.hw / 2, ob.py + ob.hh / 2, 12, col, 1.4, 210, .45);
        }
        S.shake = Math.max(S.shake, 2.5);
        break;
      }
      case T.PORTAL_MODE: case T.PORTAL_SPEED: case T.PORTAL_GRAV:
      case T.PORTAL_SIZE: case T.PORTAL_DUAL: case T.PORTAL_CEIL: {
        if (!hit) return;
        if (ob.used) return;
        ob.used = true; ob.active = true;
        applyPortal(ob, p, isDual);
        break;
      }
      case T.PORTAL_TELE: {
        if (!hit || ob.used) return;
        ob.used = true;
        const o = ob.o || {};
        const oldX = p.x * B, oldY = C.GROUND_Y - p.y * B;
        p.x = o.tx; p.y = o.ty;
        burst(oldX, oldY, 16, o.color === 'orange' ? '#ff8a2f' : '#2f7bff', 1.4, 260, .5);
        burst(o.tx * B, C.GROUND_Y - o.ty * B, 16, o.color === 'orange' ? '#ff8a2f' : '#2f7bff', 1.4, 260, .5);
        gd.audio.sfx('portal');
        break;
      }
      case T.COIN: {
        if (!hit) return;
        if (isDual) return;
        const idx = (ob.o && ob.o.idx) || 0;
        if (S.coinsRun[idx]) return;
        S.coinsRun[idx] = true; ob.used = true; ob.active = true;
        gd.save.stats.coins++;
        gd.audio.sfx('coin');
        burst(ob.px + ob.hw / 2, ob.py + ob.hh / 2, 26, ob.o && ob.o.secret ? '#c48aff' : '#ffd23b', 1.5, 300, .7);
        S.flash = Math.max(S.flash, .25);
        break;
      }
      case T.JUMP_ARROW: {
        if (!hit || ob.used) return;
        ob.used = true; ob.active = true;
        const down = ob.o && ob.o.down;
        p.vy = (down ? -1 : 1) * p.grav * C.JUMP_V * p.size * 1.15;
        p.onGround = false; p.spinning = true;
        gd.audio.sfx('pad');
        break;
      }
      case T.COUNT: {
        if (!hit) return;
        ob.hits++;
        if (ob.hits >= ((ob.o && ob.o.target) || 3)) { ob.active = true; gd.audio.sfx('place'); }
        break;
      }
      case T.TRIGGER: {
        if (!hit || ob.used) return;
        ob.used = true;
        const o = ob.o || {};
        if (o.spawn !== undefined && S.objs[o.spawn]) { S.objs[o.spawn].active = true; }
        break;
      }
      case T.END: break;
    }
  }

  function applyPortal(ob, p, silent) {
    const o = ob.o || {};
    switch (ob.type) {
      case T.PORTAL_MODE:
        p.mode = MODE_BY(o.mode);
        p.vy = 0; p.onGround = false; p.spinning = false; p.rot = 0;
        if (p.mode === MODE.WAVE || p.mode === MODE.SHIP) p.holdT = 0;
        break;
      case T.PORTAL_SPEED: p.speed = U.clamp(o.speed | 0, 0, C.SPEEDS.length - 1); break;
      case T.PORTAL_GRAV:
        if ((o.up ? -1 : 1) !== p.grav) { p.grav = o.up ? -1 : 1; p.rot += Math.PI; }
        break;
      case T.PORTAL_SIZE: p.size = o.mini ? 0.62 : 1.18; break;
      case T.PORTAL_DUAL:
        S.dual = !S.dual;
        if (S.dual && !P2) {
          P2 = newPlayer(p.x);
          Object.assign(P2, { y: p.y + 4, vy: p.vy, mode: p.mode, speed: p.speed, size: p.size, grav: -p.grav });
        } else if (!S.dual) P2 = null;
        break;
      case T.PORTAL_CEIL: S.ceiling = o.h || 0; break;
    }
    if (!silent) {
      gd.audio.sfx('portal');
      const col = portalColor(ob);
      burst(ob.px + ob.hw / 2, ob.py + ob.hh / 2, 22, col, 1.1, 260, .6);
      S.flash = Math.max(S.flash, .18);
    }
  }
  function MODE_BY(m) { return gd.levels.MODE_BY_PORTAL[m] !== undefined ? gd.levels.MODE_BY_PORTAL[m] : MODE.CUBE; }
  function portalColor(ob) {
    const o = ob.o || {};
    if (ob.type === T.PORTAL_SPEED) return ['#ff6fb5', '#5ce35c', '#ff9f43', '#ff4b4b', '#4bb3ff'][o.speed | 0] || '#fff';
    if (ob.type === T.PORTAL_MODE) return ['#3bf07a', '#f0563b', '#f0c93b', '#a24bf0', '#4bd8f0', '#ff6fb5', '#e8e8f0', '#f04bb4'][o.mode | 0] || '#fff';
    if (ob.type === T.PORTAL_GRAV) return o.up ? '#ffe14d' : '#4bb3ff';
    if (ob.type === T.PORTAL_SIZE) return o.mini ? '#5ce35c' : '#ff4b4b';
    if (ob.type === T.PORTAL_DUAL) return '#a24bf0';
    if (ob.type === T.PORTAL_CEIL) return '#7fd4ff';
    return '#ffffff';
  }

  /* ---------------- death / completion ---------------- */
  function kill(p, isDual, ob) {
    if (S.dead || S.done) return;
    if (S.mode === 'practice') {
      // practice mode: no death, respawn at last checkpoint
      S.dead = true; S.deathTimer = 0;
      deathFx(p);
      setTimeout(() => {
        if (!S.active) return;
        if (S.checkpoints.length) restoreCheckpoint(S.checkpoints[S.checkpoints.length - 1]);
        else { S.dead = false; S.deathTimer = 0; }
      }, 260);
      return;
    }
    S.dead = true; S.deathTimer = 0;
    gd.save.stats.deaths++;
    gd.saveSave();
    deathFx(p);
    gd.audio.sfx('death');
    gd.audio.stopSong();
    S.shake = gd.save.settings.shake ? 16 : 4;
    S.flash = 0.85;
    const rec = gd.levels.rec(S.level);
    rec.best = Math.max(rec.best || 0, Math.floor(S.pct));
    rec.time = (rec.time || 0) + S.runTime;
    if (S.mode === 'normal') rec.normalPct = Math.max(rec.normalPct || 0, Math.floor(S.pct));
    else rec.practicePct = Math.max(rec.practicePct || 0, Math.floor(S.pct));
    gd.saveSave();
  }

  function deathFx(p) {
    const x = p.x * B, y = C.GROUND_Y - p.y * B;
    const cols = gd.ui ? gd.ui.playerColors() : { p1: '#31a7ff', p2: '#ffffff', gc: '#31a7ff' };
    burst(x, y, 26, cols.p1, 1.6, 420, .85, 'square');
    burst(x, y, 18, cols.p2, 1.4, 340, .7, 'square');
    burst(x, y, 14, '#ffffff', 1.2, 260, .5, 'spark');
    S.deathFx = { x, y, t: 0, p1: cols.p1, p2: cols.p2, gc: cols.gc };
  }

  function complete() {
    if (S.done) return;
    S.done = true; S.doneTimer = 0; S.pct = 100;
    S.flash = 1;
    gd.audio.sfx('complete');
    const rec = gd.levels.rec(S.level);
    rec.best = 100; rec.completed = true;
    rec.normalPct = S.mode === 'normal' ? 100 : (rec.normalPct || 0);
    rec.practicePct = S.mode === 'practice' ? 100 : (rec.practicePct || 0);
    rec.jumps = (rec.jumps || 0) + S.jumps;
    rec.time = (rec.time || 0) + S.runTime;
    let newCoins = 0;
    S.coinsRun.forEach((c, i) => { if (c && !rec.coins[i]) { rec.coins[i] = true; newCoins++; } });
    // mana reward
    let mana = 0;
    if (!rec.starsAwarded && S.mode === 'normal') { mana += S.level.stars * 10 + 25; rec.starsAwarded = true; }
    mana += newCoins * 15;
    gd.save.mana += mana;
    S.rewardMana = mana;
    S.newCoins = newCoins;
    gd.saveSave();
    // confetti
    for (let i = 0; i < 90; i++) {
      spawnParticle(U.rand(0, C.W) + P1.x * B - C.W / 2, C.GROUND_Y - U.rand(60, 500),
        U.rand(-60, 60), U.rand(-40, 120),
        ['#ffe14d', '#4bb3ff', '#ff6fb5', '#5ce35c', '#ffffff'][i % 5], U.rand(1.2, 2.4), U.rand(3, 7));
    }
    if (gd.save.achievements.indexOf('complete1') < 0) gd.save.achievements.push('complete1');
  }

  /* ============================================================
     RENDERING
     ============================================================ */
  function camX() { return P1.x * B - C.CAM_X_OFF; }

  function draw(ctx, dt) {
    const level = S.level;
    if (!level) return;
    const th = themeAt(level, P1.x);
    S.themeNow = th;
    const beat = gd.save.settings.groundPulse ? gd.audio.beatPhase() : 0;
    const cx = camX();
    const shakeX = S.shake ? U.rand(-S.shake, S.shake) : 0;
    const shakeY = S.shake ? U.rand(-S.shake, S.shake) : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground(ctx, th, cx, beat);
    drawDecor(ctx, th, cx);
    drawGround(ctx, th, cx, beat);
    drawCeiling(ctx, th, cx, beat);
    drawObjects(ctx, th, cx);
    drawCheckpoints(ctx, cx);
    drawTrail(ctx, cx);
    drawPlayer(ctx, P1, cx, false);
    if (S.dual && P2) drawPlayer(ctx, P2, cx, true);
    drawDeathFx(ctx, cx);
    drawParticles(ctx, cx);
    drawEndWall(ctx, th, cx);
    ctx.restore();

    if (S.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (S.flash * .55).toFixed(3) + ')';
      ctx.fillRect(0, 0, C.W, C.H);
    }
    drawHud(ctx);
    if (S.paused) gd.ui.drawPause(ctx, S);
    if (S.showComplete) gd.ui.drawComplete(ctx, S);
    if (S.dead && !S.paused) drawDeadHint(ctx);
  }

  /* ---- background ---- */
  function drawBackground(ctx, th, cx, beat) {
    const g = ctx.createLinearGradient(0, 0, 0, C.H);
    g.addColorStop(0, U.shade(th.bg2, -.15));
    g.addColorStop(.55, th.bg);
    g.addColorStop(1, U.shade(th.bg, -.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.W, C.H);

    if (!gd.save.settings.bgEffect) return;
    // parallax decoration band
    const par = cx * 0.35;
    const cell = 220;
    const off = -((par % cell) + cell) % cell;
    ctx.save();
    ctx.globalAlpha = .16 + beat * .07;
    for (let i = -1; i < C.W / cell + 2; i++) {
      const bx = off + i * cell;
      const idx = Math.abs(Math.floor((par + i * cell) / cell)) % TEX.bgShape.length;
      const img = TEX.bgShape[idx];
      const yy = 90 + ((i * 53) % 260);
      ctx.drawImage(img, bx, yy, 150, 150);
    }
    ctx.restore();

    // soft horizon glow
    const hg = ctx.createLinearGradient(0, C.GROUND_Y - 260, 0, C.GROUND_Y);
    hg.addColorStop(0, U.withAlpha(th.line, 0));
    hg.addColorStop(1, U.withAlpha(th.line, .10 + beat * .06));
    ctx.fillStyle = hg;
    ctx.fillRect(0, C.GROUND_Y - 260, C.W, 260);

    // beat pulse vignette
    if (beat > 0) {
      const rg = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * .25, C.W / 2, C.H / 2, C.H * .95);
      rg.addColorStop(0, 'rgba(255,255,255,0)');
      rg.addColorStop(1, U.withAlpha(th.line, beat * .12));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, C.W, C.H);
    }
  }

  function drawDecor(ctx, th, cx) {
    const par = cx * 0.82;
    ctx.save();
    ctx.globalAlpha = .22;
    for (let i = 0; i < S.decorList.length; i++) {
      const ob = S.decorList[i];
      const sx = ob.px - par;
      if (sx > C.W + 40) break;
      if (sx + ob.hw < -40) continue;
      const sy = C.GROUND_Y - ob.y * B - ob.hh;
      ctx.fillStyle = U.shade(th.bg2, -.25);
      ctx.fillRect(sx, sy, ob.hw, ob.hh + 200);
      ctx.fillStyle = U.withAlpha('#000', .35);
      ctx.fillRect(sx, sy, ob.hw, 4);
    }
    ctx.restore();
  }

  function drawGround(ctx, th, cx, beat) {
    const key = nearestPal(th.ground);
    const tile = TEX.ground[key] || TEX.ground['#1c2a63'];
    const tw = tile.width;
    const off = -((cx % tw) + tw) % tw;
    const depth = C.H - C.GROUND_Y;
    // base fill
    ctx.fillStyle = U.shade(th.ground, -.55);
    ctx.fillRect(0, C.GROUND_Y, C.W, depth);
    ctx.save();
    ctx.globalAlpha = 1;
    for (let x = off - tw; x < C.W + tw; x += tw) ctx.drawImage(tile, x, C.GROUND_Y, tw, Math.min(depth, tile.height));
    ctx.restore();
    // tint to current theme
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
    // top glow line
    const lg = ctx.createLinearGradient(0, C.GROUND_Y - 6, 0, C.GROUND_Y + 14);
    lg.addColorStop(0, U.withAlpha(th.line, 0));
    lg.addColorStop(.45, U.withAlpha(th.line, .85 + beat * .15));
    lg.addColorStop(1, U.withAlpha(th.line, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(0, C.GROUND_Y - 6, C.W, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, C.GROUND_Y - 1.5, C.W, 3);
    // dark fade under
    const dg = ctx.createLinearGradient(0, C.GROUND_Y + 90, 0, C.H);
    dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = dg; ctx.fillRect(0, C.GROUND_Y + 90, C.W, depth - 90);
  }

  function drawCeiling(ctx, th, cx, beat) {
    if (S.ceiling <= 0) return;
    const ceilPx = C.GROUND_Y - S.ceiling * B;
    if (ceilPx < -40) return;
    const key = nearestPal(th.ground);
    const tile = TEX.ground[key] || TEX.ground['#1c2a63'];
    const tw = tile.width;
    const off = -((cx % tw) + tw) % tw;
    ctx.save();
    ctx.fillStyle = U.shade(th.ground, -.55);
    ctx.fillRect(0, -10, C.W, ceilPx + 10);
    for (let x = off - tw; x < C.W + tw; x += tw) {
      ctx.save();
      ctx.translate(x, ceilPx);
      ctx.scale(1, -1);
      ctx.drawImage(tile, 0, 0, tw, Math.min(ceilPx + 10, tile.height));
      ctx.restore();
    }
    const lg = ctx.createLinearGradient(0, ceilPx - 14, 0, ceilPx + 6);
    lg.addColorStop(0, U.withAlpha(th.line, 0));
    lg.addColorStop(.55, U.withAlpha(th.line, .8 + beat * .15));
    lg.addColorStop(1, U.withAlpha(th.line, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(0, ceilPx - 14, C.W, 20);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, ceilPx - 1.5, C.W, 3);
    ctx.restore();
  }

  const PAL_KEYS = Object.keys(gd.levels.PAL).map(k => gd.levels.PAL[k]);
  function nearestPal(col) {
    const c = U.hexToRgb(col);
    let best = PAL_KEYS[0], bd = 1e9;
    for (const k of PAL_KEYS) {
      const d = U.hexToRgb(k);
      const dist = (d.r - c.r) ** 2 + (d.g - c.g) ** 2 + (d.b - c.b) ** 2;
      if (dist < bd) { bd = dist; best = k; }
    }
    return best;
  }

  /* ---- objects ---- */
  function drawObjects(ctx, th, cx) {
    const pal = nearestPal(th.obj);
    const detail = !gd.save.settings.lowDetail;
    for (let i = 0; i < S.objs.length; i++) {
      const ob = S.objs[i];
      let sx = ob.px - cx;
      if (sx > C.W + 80) break;
      const w = ob.hw;
      if (sx + w < -80) continue;
      let sy = ob.py;
      if (ob.type === T.MOVE) { sx += ob.ox; sy += ob.oy; }
      drawObject(ctx, ob, sx, sy, pal, th, detail);
    }
  }

  function blockTex(palKey, variant) {
    const set = TEX.block[palKey] || TEX.block['#3b7ef0'];
    return set[variant % set.length];
  }

  function drawObject(ctx, ob, sx, sy, pal, th, detail) {
    const w = ob.hw, h = ob.hh;
    const o = ob.o || {};
    switch (ob.type) {
      case T.BLOCK:
      case T.COUNT: {
        const key = o.pal ? (gd.levels.PAL[o.pal] || pal) : pal;
        const nk = nearestPal(key);
        if (ob.type === T.COUNT && !ob.active) ctx.globalAlpha = 0.35;
        for (let i = 0; i < ob.w; i++) for (let j = 0; j < ob.h; j++) {
          const t = blockTex(nk, (i + j) % 4);
          ctx.drawImage(t, sx + i * B, sy + (ob.h - 1 - j) * B, B, B);
        }
        ctx.globalAlpha = 1;
        if (ob.type === T.COUNT) {
          const left = Math.max(0, (o.target || 3) - ob.hits);
          U.drawText(ctx, String(left), sx + w / 2, sy + h / 2, { size: Math.min(w, h) * .5, fill: '#fff', stroke: 2 });
        }
        break;
      }
      case T.HALF: {
        const key = o.pal ? (gd.levels.PAL[o.pal] || pal) : pal;
        const t = blockTex(nearestPal(key), 0);
        ctx.save(); ctx.beginPath(); ctx.rect(sx, sy + h / 2, w, h / 2); ctx.clip();
        ctx.drawImage(t, sx, sy + h / 2, w, h); ctx.restore();
        break;
      }
      case T.SLOPE: case T.SLOPE_R: {
        const key = o.pal ? (gd.levels.PAL[o.pal] || pal) : pal;
        const t = (ob.type === T.SLOPE ? TEX.slope : TEX.slopeR)[nearestPal(key)] || TEX.slope['#3b7ef0'];
        for (let i = 0; i < ob.w; i++) for (let j = 0; j < ob.h; j++)
          ctx.drawImage(t, sx + i * B, sy + (ob.h - 1 - j) * B, B, B);
        break;
      }
      case T.PILLAR: case T.OUTLINE: {
        ctx.save();
        ctx.globalAlpha = ob.type === T.OUTLINE ? .55 : 1;
        ctx.strokeStyle = U.withAlpha('#fff', .5); ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, sy + 1, w - 2, h - 2);
        ctx.restore();
        break;
      }
      case T.SPIKE: case T.SPIKE_D: {
        const key = o.pal ? gd.levels.PAL[o.pal] : null;
        const t = ob.type === T.SPIKE ? (TEX.spike[key] || TEX.spike['#ffffff']) : (TEX.spikeDown[key] || TEX.spikeDown['#ffffff']);
        for (let i = 0; i < ob.w; i++) ctx.drawImage(t, sx + i * B, sy, B, h);
        break;
      }
      case T.SPIKE_S:
        ctx.drawImage(TEX.spikeSmall, sx + w * .2, sy + h * .4, w * .6, h * .6);
        break;
      case T.SAW: case T.SAW_S: {
        const key = o.pal ? gd.levels.PAL[o.pal] : '#e8e8f0';
        const set = ob.type === T.SAW ? TEX.saw : TEX.sawSmall;
        const t = set[nearestPal(key)] || set['#e8e8f0'];
        const R = ob.R;
        ctx.save();
        ctx.translate(sx + w / 2, sy + h / 2);
        ctx.rotate((ob.type === T.SAW ? -1 : 1) * S.time * 5.2 + ob.anim);
        ctx.drawImage(t, -R, -R, R * 2, R * 2);
        ctx.restore();
        break;
      }
      case T.PAD: {
        const t = TEX.pad[o.kind || 'yellow'];
        ctx.save();
        if (ob.active) { ctx.globalAlpha = .45; }
        ctx.drawImage(t, sx - w * .05, sy + h - t.height, t.width, t.height);
        ctx.restore();
        break;
      }
      case T.ORB: case T.RING: case T.DASH: {
        const set = ob.type === T.ORB ? TEX.orb : ob.type === T.RING ? TEX.ring : TEX.dash;
        const t = set[o.kind || 'yellow'];
        const pulse = ob.used ? .35 : 1 + Math.sin(S.time * 5 + ob.anim) * .06;
        const tw = t.width * pulse, thh = t.height * pulse;
        ctx.save();
        if (ob.used) ctx.globalAlpha = .3;
        ctx.drawImage(t, sx + w / 2 - tw / 2, sy + h / 2 - thh / 2, tw, thh);
        ctx.restore();
        break;
      }
      case T.PORTAL_MODE: case T.PORTAL_SPEED: case T.PORTAL_GRAV:
      case T.PORTAL_SIZE: case T.PORTAL_DUAL: case T.PORTAL_CEIL: case T.PORTAL_TELE: {
        let t;
        if (ob.type === T.PORTAL_MODE) t = TEX.portal.mode[o.mode | 0];
        else if (ob.type === T.PORTAL_SPEED) t = TEX.portal.speed[o.speed | 0];
        else if (ob.type === T.PORTAL_GRAV) t = o.up ? TEX.portal.gravityUp : TEX.portal.gravityDown;
        else if (ob.type === T.PORTAL_SIZE) t = o.mini ? TEX.portal.mini : TEX.portal.big;
        else if (ob.type === T.PORTAL_DUAL) t = TEX.portal.dual;
        else t = o.color === 'orange' ? TEX.portal.teleOrange : TEX.portal.teleBlue;
        if (ob.type === T.PORTAL_CEIL) {
          // ceiling height event: draw a soft marker column instead of a portal
          const hh2 = ob.h * B;
          ctx.save();
          ctx.globalAlpha = 0.35 + Math.sin(S.time * 2 + ob.anim) * 0.08;
          const cg = ctx.createLinearGradient(0, sy - hh2, 0, sy + 40);
          cg.addColorStop(0, U.withAlpha('#7fd4ff', .55));
          cg.addColorStop(1, U.withAlpha('#7fd4ff', 0));
          ctx.fillStyle = cg;
          ctx.fillRect(sx, sy - hh2, w, hh2 + 40);
          ctx.setLineDash([8, 7]);
          ctx.strokeStyle = U.withAlpha('#bde9ff', .8);
          ctx.lineWidth = 2;
          ctx.strokeRect(sx + 1, sy - hh2, w - 2, hh2);
          ctx.setLineDash([]);
          ctx.restore();
          break;
        }
        const hh = ob.h * B;
        const bob = Math.sin(S.time * 3 + ob.anim) * 2;
        ctx.save();
        ctx.globalAlpha = ob.used ? .45 : 1;
        ctx.drawImage(t, sx + w / 2 - t.width / 2, sy + h / 2 - hh / 2 + bob, t.width, hh);
        // inner swirl
        if (detail && !ob.used) {
          ctx.globalAlpha = .35;
          ctx.strokeStyle = portalColor(ob);
          ctx.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            const p = ((S.time * .8 + k / 3 + ob.anim) % 1);
            ctx.beginPath();
            ctx.ellipse(sx + w / 2, sy + h / 2 + bob, t.width * .28, hh * .42 * (1 - p * .8), 0, 0, 7);
            ctx.stroke();
          }
        }
        ctx.restore();
        break;
      }
      case T.COIN: {
        const t = o.secret ? TEX.secretCoin : TEX.coin;
        if (ob.used) {
          ctx.save(); ctx.globalAlpha = .22;
          ctx.drawImage(t, sx + w / 2 - t.width / 2, sy + h / 2 - t.height / 2);
          ctx.restore();
        } else {
          const bob = Math.sin(S.time * 3.4 + ob.anim) * 3;
          const sc = 1 + Math.sin(S.time * 5 + ob.anim) * .05;
          ctx.save();
          ctx.translate(sx + w / 2, sy + h / 2 + bob);
          ctx.rotate(Math.sin(S.time * 1.6 + ob.anim) * .16);
          ctx.scale(sc, sc);
          ctx.drawImage(t, -t.width / 2, -t.height / 2);
          ctx.restore();
        }
        break;
      }
      case T.JUMP_ARROW: {
        ctx.save();
        ctx.translate(sx + w / 2, sy + h / 2);
        if (o.down) ctx.scale(1, -1);
        ctx.globalAlpha = ob.used ? .3 : .95;
        const s = B * .42;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
        for (let k = 0; k < 2; k++) {
          const yy = k * s * .7 - s * .3;
          ctx.beginPath();
          ctx.moveTo(-s, yy + s * .5); ctx.lineTo(0, yy - s * .3); ctx.lineTo(s, yy + s * .5);
          ctx.lineTo(s * .55, yy + s * .5); ctx.lineTo(0, yy + s * .05); ctx.lineTo(-s * .55, yy + s * .5);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case T.MOVE: {
        const key = o.pal ? gd.levels.PAL[o.pal] : th.obj;
        const t = blockTex(nearestPal(key), 1);
        for (let i = 0; i < ob.w; i++) for (let j = 0; j < ob.h; j++)
          ctx.drawImage(t, sx + i * B, sy + (ob.h - 1 - j) * B, B, B);
        ctx.save();
        ctx.globalAlpha = .8;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        const ax = sx + w / 2, ay = sy + h / 2;
        ctx.beginPath();
        if (o.dx) { ctx.moveTo(ax - 12, ay); ctx.lineTo(ax + 12, ay); ctx.moveTo(ax + 6, ay - 5); ctx.lineTo(ax + 12, ay); ctx.lineTo(ax + 6, ay + 5); }
        else { ctx.moveTo(ax, ay - 12); ctx.lineTo(ax, ay + 12); ctx.moveTo(ax - 5, ay + 6); ctx.lineTo(ax, ay + 12); ctx.lineTo(ax + 5, ay + 6); }
        ctx.stroke();
        ctx.restore();
        break;
      }
      case T.COLLISION: {
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = 'rgba(255,90,90,.9)'; ctx.lineWidth = 2.4;
        ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,60,60,.12)';
        ctx.fillRect(sx + 2, sy + 2, w - 4, h - 4);
        ctx.restore();
        break;
      }
      case T.TRIGGER: {
        ctx.save();
        ctx.globalAlpha = .5;
        ctx.strokeStyle = '#8affc4'; ctx.lineWidth = 2;
        ctx.strokeRect(sx + 3, sy + 3, w - 6, h - 6);
        ctx.restore();
        break;
      }
    }
  }

  function drawEndWall(ctx, th, cx) {
    const sx = S.endWallX - cx;
    if (sx > C.W + 200 || sx < -200) return;
    ctx.save();
    const g = ctx.createLinearGradient(sx - 90, 0, sx + 40, 0);
    g.addColorStop(0, U.withAlpha(th.line, 0));
    g.addColorStop(1, U.withAlpha(th.line, .55));
    ctx.fillStyle = g;
    ctx.fillRect(sx - 90, 0, 130, C.H);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(sx - 2, 0, 4, C.H);
    ctx.shadowColor = th.line; ctx.shadowBlur = 24;
    ctx.fillRect(sx - 2, 0, 4, C.H);
    ctx.restore();
  }

  function drawCheckpoints(ctx, cx) {
    if (S.mode !== 'practice') return;
    for (let i = 0; i < S.checkpoints.length; i++) {
      const cp = S.checkpoints[i];
      const sx = cp.x * B - cx;
      if (sx < -40 || sx > C.W + 40) continue;
      const sy = C.GROUND_Y - cp.y * B;
      ctx.save();
      ctx.strokeStyle = i === S.checkpoints.length - 1 ? '#5ce35c' : 'rgba(92,227,92,.55)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, 11 + Math.sin(S.time * 4 + i) * 1.6, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(92,227,92,.25)';
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  function drawTrail(ctx, cx) {
    const cols = gd.ui ? gd.ui.playerColors() : { p1: '#31a7ff', p2: '#fff', gc: '#31a7ff' };
    for (let i = 0; i < S.trail.length; i++) {
      const t = S.trail[i];
      const a = U.clamp(t.life / .42, 0, 1);
      const sx = t.x - cx, sy = t.y;
      if (sx < -60 || sx > C.W + 60) continue;
      ctx.save();
      ctx.globalAlpha = a * .45;
      ctx.fillStyle = cols.gc;
      ctx.beginPath();
      ctx.arc(sx, sy, t.size * a, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer(ctx, p, cx, isDual) {
    if (p.dead) return;
    const cols = gd.ui ? gd.ui.playerColors() : { p1: '#31a7ff', p2: '#ffffff', gc: '#31a7ff' };
    const p1 = cols.p1, p2 = isDual ? U.shade(cols.p2, -.15) : cols.p2, gc = cols.gc;
    const s = sizeOf(p);
    const sx = p.x * B - cx, sy = C.GROUND_Y - p.y * B;
    if (sx < -120 || sx > C.W + 120) return;

    const icons = gd.save.icons;
    const variant = { cube: icons.cube, ship: icons.ship, ball: icons.ball, ufo: icons.ufo, wave: icons.wave, robot: icons.robot, spider: icons.spider, swing: icons.swing }[modeKey(p.mode)] || 0;

    ctx.save();
    ctx.translate(sx, sy);
    // glow
    if (!gd.save.settings.lowDetail) {
      const gr = ctx.createRadialGradient(0, 0, s * .2, 0, 0, s * 1.5);
      gr.addColorStop(0, U.withAlpha(gc, .38));
      gr.addColorStop(1, U.withAlpha(gc, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(0, 0, s * 1.5, 0, 7); ctx.fill();
    }
    ctx.rotate(p.rot);
    if (p.grav < 0) ctx.scale(1, -1);

    const key = modeKey(p.mode);
    if (key === 'robot') {
      gd.tex.drawRobotIcon(ctx, -s / 2, -s / 2, s, p1, p2, gc, variant, p.phase);
    } else {
      const img = gd.tex.icon(key, p1, p2, gc, variant, Math.round(s * 2) / 2);
      if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
    }
    if (key === 'ship') {
      gd.tex.drawShipFlame(ctx, -s * .95, -s * .28, s * .42, s * .56, gc, S.time);
    }
    if (key === 'wave') {
      ctx.save();
      ctx.globalAlpha = .55;
      gd.tex.drawWaveTrail(ctx, -s * 1.9, -s * .15, s * 1.5, s * .3, gc, .55);
      ctx.restore();
    }
    ctx.restore();

    if (gd.save.settings.showHitboxes) {
      const r = playerRect(p);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,255,120,.9)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x - cx, r.y, r.w, r.h);
      ctx.restore();
    }
  }

  function modeKey(m) {
    return ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing'][m] || 'cube';
  }

  function drawDeathFx(ctx, cx) {
    if (!S.dead || !S.deathFx) return;
    const f = S.deathFx;
    f.t += 1 / 60;
    const t = f.t;
    if (t > .9) return;
    const sx = f.x - cx, sy = f.y;
    ctx.save();
    ctx.globalAlpha = U.clamp(1 - t / .7, 0, 1);
    // expanding rings
    for (let i = 0; i < 3; i++) {
      const r = (t * 260) * (1 + i * .35);
      ctx.strokeStyle = i % 2 ? f.p2 : f.gc;
      ctx.lineWidth = 6 - i * 1.6;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.stroke();
    }
    // shards
    const img = gd.tex.icon('death', f.p1, f.p2, f.gc, 0, B);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + t * 2;
      const d = t * 190;
      ctx.save();
      ctx.translate(sx + Math.cos(a) * d, sy + Math.sin(a) * d);
      ctx.rotate(a + t * 6);
      ctx.globalAlpha *= .8;
      ctx.drawImage(img, -B * .3, -B * .3, B * .6, B * .6);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawParticles(ctx, cx) {
    for (let i = 0; i < S.particles.length; i++) {
      const p = S.particles[i];
      const a = U.clamp(p.life / p.max, 0, 1);
      const sx = p.x - cx, sy = p.y;
      if (sx < -30 || sx > C.W + 30) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(sx, sy);
      if (p.kind === 'spark') {
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 1.6, -p.size * .35, p.size * 3.2, p.size * .7);
      } else {
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  /* ---- HUD ---- */
  function drawHud(ctx) {
    const level = S.level;
    // progress bar
    const bw = 420, bh = 12, bx = (C.W - bw) / 2, by = 26;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    U.rr(ctx, bx - 2, by - 2, bw + 4, bh + 4, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2;
    U.rr(ctx, bx - 2, by - 2, bw + 4, bh + 4, 7); ctx.stroke();
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#5ce35c'); g.addColorStop(.6, '#ffe14d'); g.addColorStop(1, '#ff6fb5');
    ctx.fillStyle = g;
    U.rr(ctx, bx, by, Math.max(2, bw * (S.pct / 100)), bh, 5); ctx.fill();
    // best marker
    if (S.bestPct > 1 && S.bestPct < 100) {
      const mx = bx + bw * (S.bestPct / 100);
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx, by - 5); ctx.lineTo(mx, by + bh + 5); ctx.stroke();
    }
    ctx.restore();
    U.drawText(ctx, Math.floor(S.pct) + '%', C.W / 2, by - 12, { size: 20, fill: '#fff', stroke: 3, strokeColor: 'rgba(0,0,0,.8)' });

    // attempt counter (pops in at the start of every attempt)
    const at = S.attemptT || 0;
    const aScale = at < .45 ? 1 + (1 - U.clamp(at / .45, 0, 1)) * .55 : 1;
    const aAlpha = U.clamp((1.8 - at) * 1.4, 0, 1);
    if (aAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = aAlpha;
      ctx.translate(C.W / 2, C.H * .30);
      ctx.scale(aScale, aScale);
      U.drawText(ctx, 'Attempt ' + S.attempt, 0, 0, {
        size: 40, fill: '#ffffff', stroke: 5, strokeColor: 'rgba(0,0,0,.8)',
        gradient: ['#ffffff', '#cfe4ff']
      });
      ctx.restore();
    }
    // secret coin slots for this run
    for (let i = 0; i < 3; i++) {
      const cx2 = 34 + i * 34, cy2 = 112;
      ctx.save();
      ctx.globalAlpha = S.coinsRun[i] ? 1 : .32;
      ctx.drawImage(S.coinsRun[i] ? TEX.secretCoin : TEX.coin, cx2 - 13, cy2 - 13, 26, 26);
      ctx.restore();
    }
    // level name
    U.drawText(ctx, level.name, 34, 76, { size: 20, fill: '#fff', align: 'left', stroke: 3, strokeColor: 'rgba(0,0,0,.75)' });
    if (S.mode === 'practice') {
      U.drawText(ctx, 'PRACTICE MODE', C.W / 2, 62, {
        size: 20, fill: '#5ce35c', stroke: 3, strokeColor: 'rgba(0,0,0,.7)'
      });
    }
    // pause button
    drawPauseBtn(ctx, C.W - 58, 26, 40, 40);
    if (S.mode === 'practice') drawPracticeBtns(ctx);
    if (gd.save.settings.showFps) {
      U.drawText(ctx, 'FPS ' + (gd.boot ? gd.boot.fps() : 0), C.W - 60, C.H - 22, { size: 16, fill: '#fff', stroke: 2, align: 'right' });
    }
  }

  function drawPauseBtn(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    U.rr(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.4;
    U.rr(ctx, x, y, w, h, 8); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * .30, y + h * .26, w * .13, h * .48);
    ctx.fillRect(x + w * .57, y + h * .26, w * .13, h * .48);
    ctx.restore();
    S.pauseBtn = { x, y, w, h };
  }
  function drawPracticeBtns(ctx) {
    const y = C.H - 58, w = 44, h = 44;
    const mkBtn = (x, label, color) => {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      U.rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2.4;
      U.rr(ctx, x, y, w, h, 8); ctx.stroke();
      U.drawText(ctx, label, x + w / 2, y + h / 2, { size: 22, fill: '#fff', stroke: 2 });
      ctx.restore();
      return { x, y, w, h };
    };
    S.cpBtn = mkBtn(20, '+', '#5ce35c');
    S.cpDelBtn = mkBtn(70, '-', '#ff6f6f');
  }

  function drawDeadHint(ctx) {
    if (S.deathTimer < .12 || S.deathTimer > 2.2) return;
    const a = U.clamp((S.deathTimer - .12) * 4, 0, 1) * U.clamp((2.2 - S.deathTimer) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * .8;
    U.drawText(ctx, 'Tap to restart', C.W / 2, C.H * .62, { size: 22, fill: '#fff', stroke: 3 });
    ctx.restore();
  }

  /* ---------------- pause / complete interactions ---------------- */
  function clickPause(mx, my) {
    if (!S.active) return false;
    if (!S.paused && !S.showComplete && S.pauseBtn && hit(S.pauseBtn, mx, my)) {
      S.paused = true; gd.audio.pauseSong(); gd.audio.sfx('click'); return true;
    }
    if (S.mode === 'practice' && !S.paused) {
      if (S.cpBtn && hit(S.cpBtn, mx, my)) { addCheckpoint(); return true; }
      if (S.cpDelBtn && hit(S.cpDelBtn, mx, my)) { removeCheckpoint(); return true; }
    }
    return false;
  }
  function hit(r, x, y) { return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  /* ---------------- compact state (used by tests / autoplay) ---------------- */
  function saveState() {
    const n = S.objs.length, arr = new Int16Array(n * 3);
    for (let i = 0; i < n; i++) {
      const o = S.objs[i];
      arr[i * 3] = o.used ? 1 : 0;
      arr[i * 3 + 1] = o.active ? 1 : 0;
      arr[i * 3 + 2] = o.hits;
    }
    const pack = p => p ? [p.x, p.y, p.vx, p.vy, p.grav, p.mode, p.speed, p.size, p.rot,
                           p.onGround ? 1 : 0, p.holdT, p.flipCd, p.dashT, p.spinning ? 1 : 0] : null;
    return {
      p: pack(P1), p2: pack(P2), objArr: arr,
      ceiling: S.ceiling, dual: S.dual, dead: S.dead, done: S.done,
      jumps: S.jumps, runTime: S.runTime, pct: S.pct, time: S.time,
      coins: S.coinsRun.slice()
    };
  }
  function restoreState(st) {
    const unp = (p, a) => {
      if (!a) return;
      p.x = a[0]; p.y = a[1]; p.vx = a[2]; p.vy = a[3]; p.grav = a[4]; p.mode = a[5];
      p.speed = a[6]; p.size = a[7]; p.rot = a[8]; p.onGround = !!a[9]; p.holdT = a[10];
      p.flipCd = a[11]; p.dashT = a[12]; p.spinning = !!a[13]; p.dead = false;
    };
    if (!P1) P1 = newPlayer(0);
    unp(P1, st.p);
    if (st.p2) { if (!P2) P2 = newPlayer(0); unp(P2, st.p2); } else P2 = null;
    const n = S.objs.length;
    for (let i = 0; i < n; i++) {
      const o = S.objs[i];
      o.used = !!st.objArr[i * 3]; o.active = !!st.objArr[i * 3 + 1]; o.hits = st.objArr[i * 3 + 2];
    }
    S.ceiling = st.ceiling; S.dual = st.dual; S.dead = st.dead; S.done = st.done;
    S.jumps = st.jumps; S.runTime = st.runTime; S.pct = st.pct; S.time = st.time;
    S.coinsRun = st.coins.slice();
    S.particles.length = 0; S.trail.length = 0;
    S.deathTimer = 0; S.doneTimer = 0;
  }

  gd.game = {
    S, P1: () => P1, P2: () => P2, saveState, restoreState,
    setTime: t => { S.time = t; },
    enter, exit, update, draw, restart, resetRun,
    addCheckpoint, removeCheckpoint, scrubTo, snapshot, restoreCheckpoint,
    clickPause, hit, themeAt, playerRect, sizeOf, modeKey, applyPortal, portalColor,
    complete, kill, drawObject, spawnParticle, drawHud, prepare, nearestPal, themeAtRaw: themeAt,
    get paused() { return S.paused; },
    set paused(v) { S.paused = v; if (v) gd.audio.pauseSong(); else gd.audio.unpauseSong(); }
  };
})(window.gd);

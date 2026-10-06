/* ============================================================
   boot.js - canvas sizing, input plumbing, the main loop and
   the initial texture/menu boot sequence.
   ============================================================ */
window.gd = window.gd || {};

(function (gd) {
  'use strict';
  const U = gd.util, C = gd.C;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  gd._ctx = ctx;

  /* ---------------- hi-dpi scaling ---------------- */
  let scale = 1, dpr = 1;
  function resize() {
    const availW = window.innerWidth, availH = window.innerHeight;
    scale = Math.min(availW / C.W, availH / C.H);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.round(C.W * scale), cssH = Math.round(C.H * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(C.W * scale * dpr);
    canvas.height = Math.round(C.H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  function toLogical(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) / (r.width / C.W),
      y: (clientY - r.top) / (r.height / C.H)
    };
  }

  /* ---------------- input ---------------- */
  const inp = gd.input;
  let lastMouse = { x: C.W / 2, y: C.H / 2 };
  let rawPress = false, rawDown = false, rawRelease = false;
  let touches = { left: false, right: false };
  inp.mouse.dx = 0; inp.mouse.dy = 0;

  function pointerDown(x, y, button, id) {
    const p = toLogical(x, y);
    // split-screen touch: right half = player 2 (dual mode)
    if (id !== undefined && S_dualActive()) {
      if (p.x < C.W / 2) { touches.left = true; } else { touches.right = true; }
    }
    inp.mouse.x = p.x; inp.mouse.y = p.y;
    if (button === 2) inp.mouse.right = true;
    else rawPress = true;
    rawDown = true;
    inp.mouse.down = true;
  }
  function pointerMove(x, y) {
    const p = toLogical(x, y);
    inp.mouse.dx = p.x - inp.mouse.x;
    inp.mouse.dy = p.y - inp.mouse.y;
    inp.mouse.x = p.x; inp.mouse.y = p.y;
  }
  function pointerUp(x, y, button, id) {
    if (id !== undefined) { touches.left = false; touches.right = false; }
    if (button === 2) inp.mouse.right = false;
    else { rawRelease = true; rawDown = false; inp.mouse.down = false; }
  }
  function S_dualActive() { return gd.game && gd.game.S && gd.game.S.dual; }

  canvas.addEventListener('mousedown', e => { e.preventDefault(); pointerDown(e.clientX, e.clientY, e.button); });
  window.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', e => pointerUp(e.clientX, e.clientY, e.button));
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); inp.wheel = Math.sign(e.deltaY); }, { passive: false });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) pointerDown(t.clientX, t.clientY, 0, t.identifier);
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) pointerMove(t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) pointerUp(t.clientX, t.clientY, 0, t.identifier);
  }, { passive: false });
  canvas.addEventListener('touchcancel', e => {
    for (const t of e.changedTouches) pointerUp(t.clientX, t.clientY, 0, t.identifier);
  });

  /* keyboard */
  const KEYBLOCK = { ' ': 1, 'ArrowUp': 1, 'ArrowDown': 1, 'ArrowLeft': 1, 'ArrowRight': 1, 'Tab': 1 };
  window.addEventListener('keydown', e => {
    const k = e.key;
    if (KEYBLOCK[k]) e.preventDefault();
    inp.keys[k] = true;
    if (!e.repeat) inp.keyPressed[k] = true;
    // global keys
    if (k === 'Escape') {
      if (gd.game.S.active) {
        if (gd.game.S.showComplete) { /* ignore */ }
        else { gd.game.S.paused = !gd.game.S.paused; gd.audio.sfx('click'); if (gd.game.S.paused) gd.audio.pauseSong(); else gd.audio.unpauseSong(); }
      } else if (gd.ui.UI.screen !== 'menu') {
        gd.ui.UI.screen = 'menu';
      }
    }
    if (k === 'm' || k === 'M') {
      gd.save.settings.music = gd.save.settings.music > 0 ? 0 : 0.65;
      gd.audio.setVolumes(); gd.saveSave();
    }
    if (k === 'p' || k === 'P') {
      if (gd.game.S.active && !gd.game.S.showComplete && gd.game.S.mode !== 'practice') {
        gd.game.S.mode = 'practice';
        gd.game.S.checkpoints.length = 0;
        gd.game.resetRun(false);
        gd.audio.stopSong(); gd.audio.playSong(gd.game.S.level.song, { delay: .06 });
      }
    }
    if (k === 'z' || k === 'Z') { if (gd.game.S.active && gd.game.S.mode === 'practice') gd.game.addCheckpoint(); }
    if (k === 'x' || k === 'X') { if (gd.game.S.active && gd.game.S.mode === 'practice') gd.game.removeCheckpoint(); }
    if (k === 'h' || k === 'H') { gd.save.settings.showHitboxes = !gd.save.settings.showHitboxes; gd.saveSave(); }
    if (k === 'r' || k === 'R') { if (gd.game.S.active && !gd.game.S.paused) gd.game.restart(); }
    gd.audio.resume();
  });
  window.addEventListener('keyup', e => {
    inp.keys[e.key] = false;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') inp.p2pressed = true;
  });
  window.addEventListener('blur', () => {
    rawDown = false; inp.mouse.down = false; for (const k in inp.keys) inp.keys[k] = false;
  });
  // any click also unlocks audio (browser autoplay policy)
  window.addEventListener('pointerdown', () => gd.audio.resume(), { once: false });

  /* ---------------- frame state ---------------- */
  let last = performance.now(), fpsSmooth = 60, frames = 0, acc = 0;
  const FIXED = 1 / 60;

  function beginInput() {
    inp.pressed = rawPress;
    inp.down = rawDown;
    inp.released = rawRelease;
    inp.p2pressed = inp.p2pressed || (S_dualActive() && touches.right && !inp._tr);
    inp.p2down = S_dualActive() ? touches.right : inp.keys['ArrowDown'];
    inp._tr = touches.right;
    if (touches.left && S_dualActive()) inp.pressed = true;
    inp.mouse.clicked = rawPress;
    rawPress = false; rawRelease = false;
    inp.mouse.moved = false;
  }
  function endInput() {
    for (const k in inp.keyPressed) delete inp.keyPressed[k];
    inp.wheel = 0;
    inp.mouse.dx = 0; inp.mouse.dy = 0;
  }

  const hooks = [];
  function addHook(fn) { hooks.push(fn); }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    fpsSmooth = fpsSmooth * 0.92 + (1 / Math.max(dt, 1e-4)) * 0.08;
    frames++; acc += dt;

    beginInput();

    // 1. ui / editor consume clicks
    const consumed = gd.ui.update(dt, inp);
    if (gd.editor && gd.editor.active) gd.editor.update(dt, inp);
    if (!gd.editor.active && gd.game.S.active && !gd.game.S.paused) {
      // pause/menu screens already handled; game gets the rest
    }
    if (consumed) { inp.press = false; inp.pressed = false; }

    // 2. game simulation
    gd.game.update(dt, inp);

    // 3. render
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, C.W, C.H);
    if (gd.game.S.active) gd.game.draw(ctx, dt);
    else gd.ui.draw(ctx);
    hooks.forEach(h => h(ctx, dt));

    endInput();

    // background music for the menus
    if (!gd.game.S.active && !gd.audio.isPlaying() && audioReady && !gd.editor.active) {
      gd.audio.playSong(gd.levels.SONGS.menu, { loop: true, delay: .05, vol: .85 });
    }
    if ((gd.game.S.active || gd.editor.active) && gd.audio.currentSong() === gd.levels.SONGS.menu) {
      gd.audio.stopSong();
    }
  }

  let audioReady = false;

  /* ---------------- boot ---------------- */
  function boot() {
    resize();
    const fill = document.getElementById('loader-fill');
    const status = document.getElementById('loader-status');
    const steps = [
      ['Generating textures', () => gd.tex.build()],
      ['Building levels', () => { gd.levels.LEVELS.length; }],
      ['Warming up audio', () => gd.audio.init()],
      ['Ready', () => { }]
    ];
    let i = 0;
    function next() {
      if (i >= steps.length) {
        const ld = document.getElementById('loader');
        ld.classList.add('hidden');
        setTimeout(() => ld.style.display = 'none', 500);
        audioReady = true;
        requestAnimationFrame(frame);
        return;
      }
      const [label, fn] = steps[i];
      status.textContent = label + '...';
      fill.style.width = Math.round((i / steps.length) * 100) + '%';
      try { fn(); } catch (e) { console.error(e); }
      i++;
      setTimeout(next, 60);
    }
    next();

    // track play time
    setInterval(() => {
      gd.save.stats.playTime = (gd.save.stats.playTime || 0) + 30;
      gd.saveSave();
    }, 30000);
  }

  gd.boot = {
    boot, addHook, resize, canvas, ctx,
    fps: () => Math.round(fpsSmooth)
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 30);
  else window.addEventListener('DOMContentLoaded', boot);
})(window.gd);

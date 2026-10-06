/* ============================================================
   editor.js - the level editor.  Place / move / delete objects
   on a grid, scrub the timeline, save custom levels to
   localStorage and test-play them.
   ============================================================ */
window.gd = window.gd || {};

(function (gd) {
  'use strict';
  const U = gd.util, C = gd.C, TEX = gd.tex.TEX, B = C.B;
  const T = gd.levels.T, PAL = gd.levels.PAL;
  const H = gd.levels.helpers;

  const PAL_KEYS = Object.keys(PAL);

  /* object palette entries */
  const CATALOG = [
    { id: 'block', type: T.BLOCK, label: 'Block' },
    { id: 'half', type: T.HALF, label: 'Half' },
    { id: 'slope', type: T.SLOPE, label: 'Slope' },
    { id: 'spike', type: T.SPIKE, label: 'Spike' },
    { id: 'spike_d', type: T.SPIKE_D, label: 'Spike Down' },
    { id: 'saw', type: T.SAW, label: 'Saw' },
    { id: 'saw_s', type: T.SAW_S, label: 'Small Saw' },
    { id: 'pad', type: T.PAD, label: 'Pad', opts: { kind: 'yellow' } },
    { id: 'orb', type: T.ORB, label: 'Orb', opts: { kind: 'yellow' } },
    { id: 'ring', type: T.RING, label: 'Ring', opts: { kind: 'yellow' } },
    { id: 'dash', type: T.DASH, label: 'Dash Orb', opts: { kind: 'yellow' } },
    { id: 'coin', type: T.COIN, label: 'Coin', opts: { idx: 0 } },
    { id: 'jump', type: T.JUMP_ARROW, label: 'Jump Arrow' },
    { id: 'move', type: T.MOVE, label: 'Moving Block', opts: { dx: 3, dy: 0, period: 2 } },
    { id: 'collision', type: T.COLLISION, label: 'Hazard Block' },
    { id: 'count', type: T.COUNT, label: 'Count Block', opts: { target: 3 } },
    { id: 'p_mode', type: T.PORTAL_MODE, label: 'Mode Portal', opts: { mode: 1 } },
    { id: 'p_speed', type: T.PORTAL_SPEED, label: 'Speed Portal', opts: { speed: 2 } },
    { id: 'p_grav', type: T.PORTAL_GRAV, label: 'Gravity Portal', opts: { up: 0 } },
    { id: 'p_size', type: T.PORTAL_SIZE, label: 'Size Portal', opts: { mini: 1 } },
    { id: 'p_dual', type: T.PORTAL_DUAL, label: 'Dual Portal' },
    { id: 'p_ceil', type: T.PORTAL_CEIL, label: 'Ceiling', opts: { h: 10 } },
    { id: 'p_tele', type: T.PORTAL_TELE, label: 'Teleporter', opts: { tx: 20, ty: 2, color: 'blue' } },
    { id: 'spike_s', type: T.SPIKE_S, label: 'Mini Spike' }
  ];

  const MODE_NAMES = ['Cube', 'Ship', 'Ball', 'UFO', 'Wave', 'Robot', 'Spider', 'Swing'];

  const E = {
    active: false, level: null, name: 'My Level', artist: 'You',
    difficulty: 'normal', song: 'bounce', themeName: 'stereo', baseSpeed: 1,
    objs: [], sel: 0, palIdx: 0, subIdx: 0,
    camX: 0, camY: 0, scroll: 0, snap: 1,
    tool: 'place',           // place | delete | move
    selObj: null, drag: null,
    playing: false, playPtr: 0, testLevel: null,
    showHelp: true, savedFlash: 0, msg: '', msgT: 0,
    undo: [], redo: [], gridH: 0
  };

  /* ---------------- open / close ---------------- */
  function open(existing, isNew) {
    gd.ui.UI.screen = 'editor';
    E.active = true;
    if (existing) {
      E.level = existing;
      E.name = existing.name || 'My Level';
      E.difficulty = existing.difficulty || 'normal';
      E.song = existing.songName || 'bounce';
      E.themeName = existing.theme || 'stereo';
      E.baseSpeed = existing.baseSpeed || 1;
      E.objs = (existing.objs || []).map(a => a.slice());
      E.sel = 0;
    } else {
      E.level = null;
      E.name = 'My Level';
      E.objs = [];
      E.baseSpeed = 1;
      E.difficulty = 'normal';
      E.song = 'bounce';
      E.themeName = 'stereo';
    }
    E.camX = 100; E.camY = 0;
    E.undo = []; E.redo = [];
    E.tool = 'place'; E.selObj = null; E.drag = null;
    E.playing = false;
    E.msg = '';
    gd.audio.stopSong();
  }
  function close() {
    E.active = false;
    gd.audio.stopSong();
    gd.ui.UI.screen = 'creator';
  }

  function snapshotUndo() {
    E.undo.push(JSON.stringify(E.objs));
    if (E.undo.length > 60) E.undo.shift();
    E.redo.length = 0;
  }
  function undo() {
    if (!E.undo.length) { gd.audio.sfx('deny'); return; }
    E.redo.push(JSON.stringify(E.objs));
    E.objs = JSON.parse(E.undo.pop());
    gd.audio.sfx('click');
  }
  function redo() {
    if (!E.redo.length) { gd.audio.sfx('deny'); return; }
    E.undo.push(JSON.stringify(E.objs));
    E.objs = JSON.parse(E.redo.pop());
    gd.audio.sfx('click');
  }

  /* ---------------- coordinate helpers ---------------- */
  const CAM_X_OFF = 0.30 * C.W;
  function screenToWorld(sx, sy) {
    return { x: (sx + E.camX * B - 0) / 1, y: 0 };
  }
  function worldToScreen(wx, wy) {
    return { x: wx * B - E.camX * B, y: C.GROUND_Y - wy * B + E.camY * B };
  }
  function cellAt(mx, my) {
    const wx = (mx + E.camX * B) / B;
    const wy = ((C.GROUND_Y + E.camY * B) - my) / B;
    return { x: Math.floor(wx), y: Math.floor(wy) };
  }

  /* ---------------- object creation from catalog ---------------- */
  function makeObject(cat, cx, cy) {
    const o = cat.opts ? JSON.parse(JSON.stringify(cat.opts)) : {};
    let w = 1, h = 1;
    switch (cat.type) {
      case T.SAW: w = 1; h = 1; break;
      case T.PAD: w = 1; h = .5; break;
      case T.PORTAL_MODE: w = 1.4; h = 3.4; break;
      case T.PORTAL_SPEED: w = 1.2; h = 3; break;
      case T.PORTAL_GRAV: w = 1.2; h = 3; break;
      case T.PORTAL_SIZE: w = 1; h = 2.4; break;
      case T.PORTAL_DUAL: w = 1; h = 2.8; break;
      case T.PORTAL_CEIL: w = 1; h = 3; break;
      case T.PORTAL_TELE: w = 1.1; h = 2.8; break;
      case T.MOVE: w = 2; h = 1; o.dx = o.dx || 3; o.period = o.period || 2; break;
      case T.COUNT: o.target = o.target || 3; break;
      case T.BLOCK: if (E.palIdx >= 0) o.pal = PAL_KEYS[E.palIdx]; break;
      case T.SPIKE: case T.SPIKE_D: case T.SAW: case T.SAW_S: if (E.palIdx >= 0) o.pal = PAL_KEYS[E.palIdx]; break;
    }
    return [cx, cy, cat.type, w, h, Object.keys(o).length ? o : null];
  }

  /* ---------------- update ---------------- */
  function update(dt, inp) {
    if (!E.active) return false;
    if (E.savedFlash > 0) E.savedFlash -= dt;
    if (E.msgT > 0) E.msgT -= dt;

    const m = inp.mouse;
    const consumed = { click: false };

    // keyboard
    if (inp.keyPressed['Escape']) { close(); return true; }
    if (inp.keyPressed['z'] && (inp.keys['Control'] || inp.keys['Meta'])) undo();
    if (inp.keyPressed['y'] && (inp.keys['Control'] || inp.keys['Meta'])) redo();
    if (inp.keyPressed['ArrowLeft']) E.camX -= 6;
    if (inp.keyPressed['ArrowRight']) E.camX += 6;
    if (inp.keyPressed['ArrowUp']) E.camY += 1;
    if (inp.keyPressed['ArrowDown']) E.camY -= 1;
    if (inp.keyPressed['Delete'] && E.selObj) { snapshotUndo(); removeObj(E.selObj); E.selObj = null; }
    if (inp.keyPressed['q']) E.palIdx = (E.palIdx + 1) % (PAL_KEYS.length + 1) - 1;
    if (inp.keyPressed['1']) E.tool = 'place';
    if (inp.keyPressed['2']) E.tool = 'delete';
    if (inp.keyPressed['3']) E.tool = 'move';

    // wheel = zoom-ish scroll (just pans)
    if (inp.wheel) { E.camX += inp.wheel * 0.6; }

    if (inp.down && E.drag) {
      const c = cellAt(m.x, m.y);
      E.drag.ob[0] = c.x - E.drag.gx;
      E.drag.ob[1] = c.y - E.drag.gy;
      return true;
    }
    if (inp.down && (m.right || inp.keys['Shift'])) {
      E.camX -= (m.dx || 0) / B;
      E.camY -= (m.dy || 0) / B;
      return true;
    }
    if (!inp.down) E.drag = null;
    return false;
  }

  function removeObj(ob) {
    const i = E.objs.indexOf(ob);
    if (i >= 0) E.objs.splice(i, 1);
  }

  function handleClick(mx, my, m) {
    if (!E.active) return false;
    // buttons are handled by the immediate-mode registry in draw()
    const tool = E.tool;
    const c = cellAt(mx, my);
    if (my > C.H - 120) return false;      // toolbar area
    if (tool === 'place') {
      const cat = CATALOG[E.sel];
      if (!cat) return true;
      snapshotUndo();
      const ob = makeObject(cat, c.x, cat.type === T.PAD ? c.y : c.y);
      E.objs.push(ob);
      gd.audio.sfx('place');
      return true;
    }
    if (tool === 'delete') {
      const hit = pick(mx, my);
      if (hit) { snapshotUndo(); removeObj(hit); gd.audio.sfx('back'); }
      return true;
    }
    if (tool === 'move') {
      const hit = pick(mx, my);
      if (hit) {
        E.selObj = hit;
        const c = cellAt(mx, my);
        E.drag = { ob: hit, ox: hit[0], oy: hit[1], gx: c.x - hit[0], gy: c.y - hit[1] };
        snapshotUndo();
      }
      return true;
    }
    return false;
  }

  function pick(mx, my) {
    let best = null, bestArea = 1e9;
    for (let i = 0; i < E.objs.length; i++) {
      const a = E.objs[i];
      const p = worldToScreen(a[0], a[1]);
      const w = (a[3] || 1) * B, h = (a[4] || 1) * B;
      if (mx >= p.x && mx <= p.x + w && my >= p.y && my <= p.y + h) {
        const area = w * h;
        if (area < bestArea) { bestArea = area; best = a; }
      }
    }
    return best;
  }

  /* ---------------- export / import ---------------- */
  function download(level) {
    const json = JSON.stringify(level, null, 1);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = String(level.name || 'level').replace(/[^a-z0-9\-_ ]/gi, '_') + '.json';
      if (document.body) document.body.appendChild(a);
      a.click();
      if (document.body && document.body.removeChild) document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      E.msg = 'Exported ' + a.download; E.msgT = 2.5;
    } catch (err) {
      E.msg = 'Export failed - copy the JSON from the console';
      E.msgT = 3;
      console.log(json);
    }
  }

  function importFromFile(file, cb) {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (!data || !Array.isArray(data.objs)) throw new Error('not a level file');
          data.id = data.id || 'imported_' + Date.now();
          data.name = data.name || 'Imported level';
          gd.save.custom.push(data);
          gd.saveSave();
          if (cb) cb(data);
          E.msg = 'Imported ' + data.name; E.msgT = 2.5;
        } catch (err) {
          E.msg = 'Could not read that file';
          E.msgT = 3;
        }
      };
      reader.readAsText(file);
    } catch (err) { /* no FileReader: ignore */ }
  }

  /* ---------------- test play ---------------- */
  function buildTestLevel() {
    const objs = E.objs.map(a => a.slice());
    let maxX = 40;
    objs.forEach(a => { maxX = Math.max(maxX, a[0] + (a[3] || 1) + 20); });
    objs.push(H.endWall(maxX));
    objs.sort((a, b) => a[0] - b[0]);
    return {
      id: 'test_' + (E.level ? E.level.id : 'new'),
      name: E.name, artist: E.artist, difficulty: E.difficulty,
      stars: C.DIFF[E.difficulty].stars, baseSpeed: E.baseSpeed,
      song: gd.levels.SONGS[E.song] || gd.levels.SONGS.bounce,
      seconds: 60, length: maxX, theme: gd.levels.THEMES[E.themeName] || gd.levels.THEMES.stereo,
      objs: objs, endX: maxX, coins: 3, seed: 1, desc: 'Test play'
    };
  }
  function testPlay() {
    save(true);
    const lvl = buildTestLevel();
    E.playing = true;
    gd.game.enter(lvl, 'normal');
    gd.ui.UI.screen = 'game';
    E.savedFromTest = true;
  }

  function save(silent) {
    const objs = E.objs.map(a => a.slice());
    let maxX = 40;
    objs.forEach(a => { maxX = Math.max(maxX, a[0] + (a[3] || 1) + 20); });
    let rec = E.level;
    const data = {
      id: rec ? rec.id : 'custom_' + Date.now(),
      name: E.name || 'Untitled',
      artist: 'You',
      difficulty: E.difficulty,
      baseSpeed: E.baseSpeed,
      songName: E.song,
      theme: E.themeName,
      seed: rec ? rec.seed : Math.floor(Math.random() * 99999),
      objs: objs,
      endX: maxX,
      desc: 'Custom level'
    };
    if (rec) {
      rec.name = data.name; rec.difficulty = data.difficulty; rec.baseSpeed = data.baseSpeed;
      rec.songName = data.songName; rec.theme = data.theme; rec.objs = data.objs; rec.endX = data.endX;
    } else {
      gd.save.custom.push(data);
      E.level = data;
    }
    gd.saveSave();
    if (gd.save.achievements.indexOf('creator1') < 0 && objs.length > 4) gd.save.achievements.push('creator1');
    if (!silent) { E.savedFlash = 1.4; gd.audio.sfx('complete'); }
    return data;
  }

  /* ---------------- drawing ---------------- */
  function draw(ctx) {
    if (!E.active) return;
    const th = (gd.levels.THEMES[E.themeName] || gd.levels.THEMES.stereo).stops[0];
    drawEditorBg(ctx, th);
    drawGrid(ctx, th);
    drawObjects(ctx, th);
    drawCursor(ctx);
    drawToolbar(ctx);
    if (E.showHelp) drawHelp(ctx);
    if (E.savedFlash > 0) {
      ctx.save();
      ctx.globalAlpha = U.clamp(E.savedFlash, 0, 1);
      U.drawText(ctx, 'SAVED', C.W / 2, 120, { size: 40, fill: '#5ce35c', stroke: 5 });
      ctx.restore();
    }
    if (E.msgT > 0) {
      ctx.save();
      ctx.globalAlpha = U.clamp(E.msgT, 0, 1);
      U.drawText(ctx, E.msg, C.W / 2, 170, { size: 24, fill: '#ffe14d', stroke: 4 });
      ctx.restore();
    }
  }

  function drawEditorBg(ctx, th) {
    const g = ctx.createLinearGradient(0, 0, 0, C.H);
    g.addColorStop(0, U.shade(th.bg2, 0));
    g.addColorStop(1, U.shade(th.bg, -.2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.W, C.H);
    // ground
    const gy = C.GROUND_Y + E.camY * B;
    const key = nearestPal(th.ground);
    const tile = TEX.ground[key] || TEX.ground['#1c2a63'];
    const off = -(((E.camX * B) % tile.width) + tile.width) % tile.width;
    ctx.fillStyle = U.shade(th.ground, -.5);
    ctx.fillRect(0, gy, C.W, C.H - gy);
    for (let x = off - tile.width; x < C.W + tile.width; x += tile.width)
      ctx.drawImage(tile, x, gy, tile.width, Math.min(C.H - gy, tile.height));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, gy - 2, C.W, 3);
  }

  function nearestPal(col) {
    const keys = ['#3b7ef0', '#f0563b', '#3bf07a', '#f0c93b', '#a24bf0', '#4bd8f0', '#f04bb4', '#e8e8f0', '#2b2b3a'];
    const c = U.hexToRgb(col);
    let best = keys[0], bd = 1e9;
    keys.forEach(k => {
      const d = U.hexToRgb(k);
      const dist = (d.r - c.r) ** 2 + (d.g - c.g) ** 2 + (d.b - c.b) ** 2;
      if (dist < bd) { bd = dist; best = k; }
    });
    return best;
  }

  function drawGrid(ctx, th) {
    const gy = C.GROUND_Y + E.camY * B;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 1;
    const startX = -((E.camX * B) % B);
    for (let x = startX; x < C.W; x += B) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.H); ctx.stroke();
    }
    for (let y = gy; y > -B; y -= B) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.W, y); ctx.stroke();
    }
    // every 5 blocks, brighter
    ctx.strokeStyle = 'rgba(255,255,255,.20)';
    const s5 = -((E.camX * B) % (B * 5));
    for (let x = s5; x < C.W; x += B * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.H); ctx.stroke();
    }
    ctx.restore();
    // ceiling guides at y=10..12
    const cguide = C.GROUND_Y - 10 * B + E.camY * B;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(127,212,255,.35)';
    ctx.beginPath(); ctx.moveTo(0, cguide); ctx.lineTo(C.W, cguide); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawObjects(ctx, th) {
    const pal = nearestPal(th.obj);
    const list = E.objs;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const p = worldToScreen(a[0], a[1]);
      if (p.x > C.W + 200) break;
      const w = (a[3] || 1) * B, h = (a[4] || 1) * B;
      if (p.x + w < -200) continue;
      const ob = { x: a[0], y: a[1], type: a[2], w: a[3] || 1, h: a[4] || 1, o: a[5] || null, hw: w, hh: h, px: a[0] * B, py: C.GROUND_Y - a[1] * B - h, used: false, active: false, hits: 0, anim: i, ox: 0, oy: 0, R: (h / 2) * .98, big: a[2] === T.SAW };
      gd.game && gd.game.drawObject ? gd.game.drawObject(ctx, ob, p.x, p.y, pal, th, true) : null;
      if (!gd.game.drawObject) fallbackDraw(ctx, a, p.x, p.y, w, h, pal);
      // marker for selected
      if (a === E.selObj) {
        ctx.save();
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3;
        ctx.setLineDash([7, 5]);
        ctx.strokeRect(p.x - 2, p.y - 2, w + 4, h + 4);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  function fallbackDraw(ctx, a, x, y, w, h, pal) {
    ctx.save();
    const t = a[2];
    if (t === T.BLOCK || t === T.MOVE) {
      const set = TEX.block[nearestPal(a[5] && a[5].pal ? PAL[a[5].pal] : pal)] || TEX.block['#3b7ef0'];
      for (let i = 0; i < (a[3] || 1); i++) for (let j = 0; j < (a[4] || 1); j++)
        ctx.drawImage(set[0], x + i * B, y + ((a[4] || 1) - 1 - j) * B, B, B);
    } else if (t === T.SPIKE || t === T.SPIKE_D) {
      const img = t === T.SPIKE ? TEX.spike['#ffffff'] : TEX.spikeDown['#ffffff'];
      ctx.drawImage(img, x, y, w, h);
    } else if (t === T.SAW) {
      ctx.drawImage(TEX.saw['#e8e8f0'], x, y, w, h);
    } else {
      ctx.fillStyle = 'rgba(255,120,220,.8)';
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function drawCursor(ctx) {
    const m = gd.input.mouse;
    if (m.y > C.H - 120) return;
    const c = cellAt(m.x, m.y);
    const p = worldToScreen(c.x, c.y);
    ctx.save();
    ctx.globalAlpha = .55;
    ctx.strokeStyle = E.tool === 'delete' ? '#ff6f6f' : '#7fffc4';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + .5, p.y + .5, B - 1, B - 1);
    ctx.globalAlpha = .12;
    ctx.fillStyle = E.tool === 'delete' ? '#ff6f6f' : '#7fffc4';
    ctx.fillRect(p.x, p.y, B, B);
    ctx.restore();
    if (E.tool === 'place') {
      const cat = CATALOG[E.sel];
      if (cat) {
        const tmp = makeObject(cat, c.x, c.y);
        const ob = { x: tmp[0], y: tmp[1], type: tmp[2], w: tmp[3], h: tmp[4], o: tmp[5], hw: tmp[3] * B, hh: tmp[4] * B, px: tmp[0] * B, py: C.GROUND_Y - tmp[1] * B - tmp[4] * B, used: false, active: false, hits: 0, anim: 0, ox: 0, oy: 0, R: tmp[4] * B / 2 * .98, big: tmp[2] === T.SAW };
        ctx.save();
        ctx.globalAlpha = .6;
        gd.game.drawObject(ctx, ob, p.x, p.y, nearestPal(gd.levels.THEMES[E.themeName].stops[0].obj), gd.levels.THEMES[E.themeName].stops[0], true);
        ctx.restore();
      }
    }
  }

  /* ---------------- toolbar ---------------- */
  function drawToolbar(ctx) {
    const y0 = C.H - 118;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,30,.93)';
    ctx.fillRect(0, y0, C.W, 118);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(C.W, y0); ctx.stroke();
    ctx.restore();

    // top-left overlay: name + controls
    U.drawText(ctx, E.name, 20, 30, { size: 24, fill: '#fff', align: 'left', stroke: 3 });
    U.drawText(ctx, E.objs.length + ' objects   ·   x=' + Math.round(E.camX) + '   ·   ' + ['Slow', 'Normal', 'Fast', 'Faster', 'Fastest'][E.baseSpeed], 20, 58, { size: 15, fill: '#9fb6e0', align: 'left', stroke: 2 });

    // object palette (scrollable row)
    const cell = 64, gap = 6, x0 = 16, y = y0 + 44;
    const vis = Math.floor((C.W - 360) / (cell + gap));
    const start = 0;
    for (let i = 0; i < CATALOG.length; i++) {
      const x = x0 + i * (cell + gap);
      if (x > C.W - 350) break;
      const cat = CATALOG[i];
      const sel = i === E.sel;
      ctx.save();
      gd.tex.drawButton(ctx, cell, cell, sel ? '#2fbc5a' : (UI_hover(x, y, cell, cell) ? '#3b4790' : '#2a2f5e'), UI_hover(x, y, cell, cell) && gd.input.down ? 'down' : 'up');
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      drawCatalogIcon(ctx, cat, cell / 2, cell / 2, 40);
      ctx.restore();
      gd.ui.UI.buttons.push({ id: 'cat_' + i, x, y, w: cell, h: cell });
    }
    U.drawText(ctx, '◀ scroll with the ◀ ▶ arrows on your keyboard', x0, y0 + 22, { size: 13, fill: '#8fa8d0', align: 'left', stroke: 2 });

    // right side controls
    const rx = C.W - 340;
    let ry = y0 + 14;
    BTN(ctx, 'e_tool_place', rx, ry, 100, 40, E.tool === 'place' ? 'PLACE ✓' : 'PLACE', { color: E.tool === 'place' ? '#2fbc5a' : '#4a4f6b', size: 17 });
    BTN(ctx, 'e_tool_del', rx + 106, ry, 100, 40, E.tool === 'delete' ? 'DEL ✓' : 'DELETE', { color: E.tool === 'delete' ? '#e0402f' : '#4a4f6b', size: 17 });
    BTN(ctx, 'e_tool_move', rx + 212, ry, 110, 40, E.tool === 'move' ? 'MOVE ✓' : 'MOVE', { color: E.tool === 'move' ? '#f08a1f' : '#4a4f6b', size: 17 });
    ry += 46;
    BTN(ctx, 'e_undo', rx, ry, 64, 36, 'UNDO', { color: '#4a4f6b', size: 15 });
    BTN(ctx, 'e_redo', rx + 70, ry, 64, 36, 'REDO', { color: '#4a4f6b', size: 15 });
    BTN(ctx, 'e_test', rx + 140, ry, 90, 36, 'TEST', { color: '#7b3bf0', size: 16 });
    BTN(ctx, 'e_save', rx + 236, ry, 90, 36, 'SAVE', { color: '#2fbc5a', size: 16 });
    ry += 42;
    BTN(ctx, 'e_back', rx, ry, 90, 32, 'EXIT', { color: '#e0402f', size: 15 });
    BTN(ctx, 'e_help', rx + 96, ry, 90, 32, 'HELP', { color: '#4a4f6b', size: 15 });
    BTN(ctx, 'e_export', rx + 192, ry, 134, 32, 'EXPORT JSON', { color: '#2f7bff', size: 14 });

    // settings row above the palette
    const sy = y0 + 8;
    let sx2 = 16;
    BTN(ctx, 'e_diff', sx2, sy, 150, 28, 'DIFF: ' + C.DIFF[E.difficulty].name.toUpperCase(), { color: '#4a4f6b', size: 13 });
    BTN(ctx, 'e_song', sx2 + 156, sy, 170, 28, 'SONG: ' + E.song.toUpperCase(), { color: '#4a4f6b', size: 13 });
    BTN(ctx, 'e_theme', sx2 + 332, sy, 170, 28, 'THEME: ' + E.themeName.toUpperCase(), { color: '#4a4f6b', size: 13 });
    BTN(ctx, 'e_name', sx2 + 508, sy, 150, 28, 'RENAME', { color: '#4a4f6b', size: 13 });
  }

  function UI_hover(x, y, w, h) {
    const m = gd.input.mouse;
    return m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
  }

  function BTN(ctx, id, x, y, w, h, label, opts) {
    const hov = UI_hover(x, y, w, h);
    gd.tex.button(ctx, w, h, x, y, w, h, opts.color, hov ? (gd.input.down ? 'down' : 'hover') : 'up');
    U.drawText(ctx, label, x + w / 2, y + h / 2, { size: opts.size || 16, fill: '#fff', stroke: 2.4 });
    gd.ui.UI.buttons.push({ id, x, y, w, h });
  }

  function drawCatalogIcon(ctx, cat, x, y, size) {
    const pal = PAL[PAL_KEYS[Math.max(0, E.palIdx)] ] || '#3b7ef0';
    const ob = { x: 0, y: 0, type: cat.type, w: 1, h: 1, o: Object.assign({}, cat.opts, cat.type === T.BLOCK ? { pal: PAL_KEYS[Math.max(0, E.palIdx)] } : {}), hw: size, hh: size, px: 0, py: 0, used: false, active: false, hits: 0, anim: 0, ox: 0, oy: 0, R: size * .49, big: cat.type === T.SAW };
    if (cat.type === T.PORTAL_MODE) ob.h = 3;
    if (cat.type === T.SAW_S) ob.R = size * .33;
    const th = { obj: pal, line: '#fff' };
    try { gd.game.drawObject(ctx, ob, x - size / 2, y - size / 2, nearestPal(pal), th, true); }
    catch (e) { ctx.fillStyle = pal; ctx.fillRect(x - size / 2, y - size / 2, size, size); }
  }

  function drawHelp(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,10,26,.86)';
    ctx.fillRect(0, 0, C.W, C.H);
    ctx.restore();
    const lines = [
      ['EDITOR CONTROLS', 34],
      ['Click an object in the bottom bar, then click in the world to place it.', 20],
      ['1 / 2 / 3  —  switch between PLACE, DELETE and MOVE tools', 20],
      ['MOVE tool: click an object to select it, then drag it. Delete key removes it.', 20],
      ['Ctrl+Z / Ctrl+Y  —  undo / redo', 20],
      ['Arrow keys  —  move the camera     Q  —  cycle block colour', 20],
      ['TEST  —  saves and instantly plays your level', 20],
      ['SAVE  —  stores the level in your browser (Creator menu)', 20],
      ['', 10],
      ['TIP: y=0 is the floor. Grid lines are one block (36px).', 19],
      ['Mode portals change the player form: cube → ship → ball → UFO → wave → robot → spider → swing.', 19],
      ['Place a Ceiling portal before flight sections so the player has a roof.', 19],
      ['Speed portals: 0 slow · 1 normal · 2 fast · 3 faster · 4 fastest. Place them on the left of a section.', 19]
    ];
    let y = 150;
    lines.forEach((l, i) => {
      U.drawText(ctx, l[0], C.W / 2, y, { size: l[1], fill: i === 0 ? '#ffe14d' : '#fff', stroke: 3 });
      y += l[1] + 16;
    });
    U.drawText(ctx, 'click anywhere to close', C.W / 2, C.H - 80, { size: 20, fill: '#9fd0ff', stroke: 3 });
  }

  /* ---------------- button actions ---------------- */
  function action(id) {
    if (id.indexOf('cat_') === 0) { E.sel = parseInt(id.slice(4), 10); E.tool = 'place'; gd.audio.sfx('click'); return true; }
    switch (id) {
      case 'e_tool_place': E.tool = 'place'; gd.audio.sfx('click'); return true;
      case 'e_tool_del': E.tool = 'delete'; gd.audio.sfx('click'); return true;
      case 'e_tool_move': E.tool = 'move'; gd.audio.sfx('click'); return true;
      case 'e_undo': undo(); return true;
      case 'e_redo': redo(); return true;
      case 'e_test': testPlay(); return true;
      case 'e_save': save(); return true;
      case 'e_back': save(true); close(); return true;
      case 'e_help': E.showHelp = !E.showHelp; gd.audio.sfx('click'); return true;
      case 'e_speed': E.baseSpeed = (E.baseSpeed + 1) % C.SPEEDS.length; gd.audio.sfx('click'); return true;
      case 'e_export': download(save(true)); gd.audio.sfx('click'); return true;
      case 'e_diff': {
        const keys = ['auto', 'easy', 'normal', 'hard', 'harder', 'insane', 'demon'];
        const cur = keys.indexOf(E.difficulty);
        E.difficulty = keys[(cur + 1) % keys.length];
        gd.audio.sfx('click'); return true;
      }
      case 'e_song': {
        const keys = Object.keys(gd.levels.SONGS).filter(k => k !== 'menu');
        const cur = keys.indexOf(E.song);
        E.song = keys[(cur + 1) % keys.length];
        gd.audio.sfx('click'); return true;
      }
      case 'e_theme': {
        const keys = Object.keys(gd.levels.THEMES);
        const cur = keys.indexOf(E.themeName);
        E.themeName = keys[(cur + 1) % keys.length];
        gd.audio.sfx('click'); return true;
      }
      case 'e_name': {
        const n = window.prompt('Level name', E.name);
        if (n !== null && n.trim()) E.name = n.trim().slice(0, 28);
        return true;
      }
    }
    return false;
  }

  gd.editor = {
    E, CATALOG, open, close, draw, update, action, handleClick, save, testPlay, pick,
    download, importFromFile,
    cellAt, worldToScreen, screenToWorld, snapshotUndo, undo, redo,
    get active() { return E.active; },
    set active(v) { E.active = v; }
  };
})(window.gd);

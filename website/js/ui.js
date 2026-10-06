/* ============================================================
   ui.js - every screen outside of a level run:
   main menu, level carousel, icon kit, shop, settings, stats,
   creator list, pause overlay and the level-complete overlay.
   Immediate-mode buttons: draw registers hit rects, and the next
   frame's update tests clicks against them.
   ============================================================ */
window.gd = window.gd || {};

(function (gd) {
  'use strict';
  const U = gd.util, C = gd.C, TEX = gd.tex.TEX;
  const MODE = C.MODE;
  const MODE_KEYS = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing'];

  const PREMIUM_COLORS = ['#ff5ec4', '#5effd0', '#fff45e', '#5e7bff', '#ff8a5e', '#b0ff5e', '#5ecfff', '#ff5e5e'];

  function palette(i) {
    if (i < C.PALETTE.length) return C.PALETTE[i];
    return PREMIUM_COLORS[i - C.PALETTE.length] || '#ffffff';
  }
  function paletteCount() { return C.PALETTE.length + PREMIUM_COLORS.length; }

  const SHOP_ITEMS = [
    { id: 'mode_wave',   name: 'Wave Mode',    desc: 'Unlock the wave icon',      price: 600,  kind: 'mode', mode: 'wave' },
    { id: 'mode_robot',  name: 'Robot Mode',   desc: 'Unlock the robot icon',     price: 900,  kind: 'mode', mode: 'robot' },
    { id: 'mode_spider', name: 'Spider Mode',  desc: 'Unlock the spider icon',    price: 1500, kind: 'mode', mode: 'spider' },
    { id: 'mode_swing',  name: 'Swing Mode',   desc: 'Unlock the swing icon',     price: 2000, kind: 'mode', mode: 'swing' },
    { id: 'death_1',     name: 'Death Burst',  desc: 'Alternate explosion',       price: 400,  kind: 'death', v: 1 },
    { id: 'death_2',     name: 'Death Spiral', desc: 'Alternate explosion',       price: 700,  kind: 'death', v: 2 },
    { id: 'death_3',     name: 'Death Star',   desc: 'Alternate explosion',       price: 1000, kind: 'death', v: 3 },
    { id: 'col_24',      name: 'Neon Pink',    desc: 'Premium player colour',     price: 200,  kind: 'color', v: 24 },
    { id: 'col_25',      name: 'Mint',         desc: 'Premium player colour',     price: 200,  kind: 'color', v: 25 },
    { id: 'col_26',      name: 'Laser Lemon',  desc: 'Premium player colour',     price: 200,  kind: 'color', v: 26 },
    { id: 'col_27',      name: 'Ultraviolet',  desc: 'Premium player colour',     price: 200,  kind: 'color', v: 27 },
    { id: 'col_28',      name: 'Coral',        desc: 'Premium player colour',     price: 200,  kind: 'color', v: 28 },
    { id: 'col_29',      name: 'Acid',         desc: 'Premium player colour',     price: 200,  kind: 'color', v: 29 },
    { id: 'col_30',      name: 'Glacier',      desc: 'Premium player colour',     price: 200,  kind: 'color', v: 30 },
    { id: 'col_31',      name: 'Blood Moon',   desc: 'Premium player colour',     price: 200,  kind: 'color', v: 31 }
  ];

  const ACHIEVEMENTS = [
    { id: 'complete1', name: 'First Steps',    desc: 'Complete your first level',              icon: 'star' },
    { id: 'jump1000',  name: 'Jumpmaster',     desc: 'Jump 1000 times',                        icon: 'star' },
    { id: 'attempt100',name: 'Persistent',     desc: 'Start 100 attempts',                     icon: 'star' },
    { id: 'coin1',     name: 'Treasure Hunter',desc: 'Collect your first secret coin',         icon: 'coin' },
    { id: 'coinall',   name: 'Completionist',  desc: 'Collect every coin in one level',        icon: 'coin' },
    { id: 'creator1',  name: 'Architect',      desc: 'Build a level in the editor',            icon: 'hammer' },
    { id: 'demons',    name: 'Demon Slayer',   desc: 'Finish an Insane level',                 icon: 'demon' },
    { id: 'nodes',     name: 'Precision',      desc: 'Reach 50% on any level',                 icon: 'star' }
  ];

  const UI = {
    screen: 'menu', time: 0, buttons: [], hover: null,
    levelSel: 0, tab: 'main', kitMode: 0, kitsel: {},
    shopScroll: 0, statsScroll: 0, creatorScroll: 0,
    confirmReset: false, flash: 0, subPreview: 0,
    cycleDir: 0, lastComplete: null,
    consumed: false
  };

  /* ---------------- helpers ---------------- */
  function register(id, x, y, w, h, data) {
    const btn = { id, x, y, w, h, data };
    UI.buttons.push(btn);
    return btn;
  }
  function hovered(id, x, y, w, h) {
    const m = gd.input.mouse;
    return m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
  }
  function BTN(id, x, y, w, h, label, opts) {
    opts = opts || {};
    const hov = hovered(id, x, y, w, h);
    const state = hov ? (gd.input.down ? 'down' : 'hover') : (opts.state || 'up');
    gd.tex.button(gd._ctx, w, h, x, y, w, h, opts.color || '#2f7bff', state);
    if (label) {
      U.drawText(gd._ctx, label, x + w / 2, y + h / 2 + (state === 'down' ? 2 : 0), {
        size: opts.size || Math.min(30, h * .42),
        fill: opts.textColor || '#fff',
        stroke: opts.stroke === undefined ? Math.max(2, Math.min(30, h * .42) * .13) : opts.stroke,
        strokeColor: 'rgba(0,0,0,.85)'
      });
    }
    register(id, x, y, w, h, opts.data);
    if (hov) UI.hover = id;
    return hov;
  }
  function ICONBTN(id, x, y, s, drawIcon, label, color) {
    const hov = hovered(id, x, y, s, s);
    const state = hov ? (gd.input.down ? 'down' : 'hover') : 'up';
    gd.tex.button(gd._ctx, s, s, x, y, s, s, color || '#2f7bff', state);
    drawIcon(gd._ctx, x + s / 2, y + s / 2 + (state === 'down' ? 2 : 0), s * .58);
    if (label) U.drawText(gd._ctx, label, x + s / 2, y + s + 16, { size: 16, fill: '#fff', stroke: 3 });
    register(id, x, y, s, s);
    if (hov) UI.hover = id;
    return hov;
  }
  function toggle(id, x, y, w, h, label, on) {
    const hov = hovered(id, x, y, w, h);
    const ctx = gd._ctx;
    ctx.save();
    gd.tex.drawCheck(ctx, x + w - h, y, h, h, on);
    ctx.restore();
    U.drawText(ctx, label, x, y + h / 2, { size: 20, fill: hov ? '#fff9c4' : '#fff', align: 'left', stroke: 3 });
    register(id, x, y, w, h);
    if (hov) UI.hover = id;
  }
  function slider(id, x, y, w, h, label, t) {
    const ctx = gd._ctx;
    U.drawText(ctx, label, x, y - 14, { size: 18, fill: '#e8f0ff', align: 'left', stroke: 3 });
    const hov = hovered(id, x - 16, y - 16, w + 32, h + 32);
    ctx.save();
    ctx.translate(x, y);
    gd.tex.drawSlider(ctx, w, h, t, hov ? '#7fd4ff' : '#4bb3ff');
    ctx.restore();
    register(id, x, y, w, h);
    if (hov) UI.hover = id;
    U.drawText(ctx, Math.round(t * 100) + '%', x + w + 26, y + h / 2, { size: 18, fill: '#fff', align: 'left', stroke: 3 });
  }

  /* ---------------- shared chrome ---------------- */
  function drawBg(ctx, scrollX, tint) {
    const t = UI.time;
    const g = ctx.createLinearGradient(0, 0, 0, C.H);
    g.addColorStop(0, tint ? U.shade(tint, .10) : '#22358f');
    g.addColorStop(.55, tint || '#1b2470');
    g.addColorStop(1, tint ? U.shade(tint, -.45) : '#080c2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.W, C.H);

    // parallax shapes
    ctx.save();
    ctx.globalAlpha = .22;
    for (let i = 0; i < TEX.bgShape.length; i++) {
      const s = TEX.bgShape[i];
      const bx = ((i * 173 - scrollX * .18) % (C.W + 300) + C.W + 300) % (C.W + 300) - 150;
      const by = 60 + ((i * 97) % 420) + Math.sin(t * .6 + i) * 12;
      const sz = 90 + (i % 4) * 34;
      ctx.drawImage(s, bx, by, sz, sz);
    }
    ctx.restore();

    // moving grid floor
    const gy = C.H - 150;
    ctx.save();
    ctx.globalAlpha = .5;
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) {
      const x = ((i * 70 - scrollX * .5) % (C.W + 140) + C.W + 140) % (C.W + 140) - 70;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x - 60, C.H); ctx.stroke();
    }
    for (let j = 0; j < 5; j++) {
      const y = gy + j * j * 6 + 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.W, y); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, gy, C.W, C.H - gy);
    const lg = ctx.createLinearGradient(0, gy - 6, 0, gy + 8);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(.5, 'rgba(180,220,255,.7)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, gy - 6, C.W, 14);
    return gy;
  }

  function topBar(ctx) {
    // mana orbs
    const x = C.W - 30, y = 34;
    ctx.save();
    const g = ctx.createRadialGradient(x - 90, y, 3, x - 90, y, 20);
    g.addColorStop(0, '#bff3ff'); g.addColorStop(1, '#3ea8ff');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x - 90, y, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    U.drawText(ctx, String(gd.save.mana), x - 68, y, { size: 24, fill: '#fff', align: 'left', stroke: 3 });

    // stars
    ctx.save();
    ctx.drawImage(TEX.star.on, x - 226, y - 13, 26, 26);
    ctx.restore();
    let stars = 0;
    gd.levels.LEVELS.forEach(l => { const r = gd.levels.rec(l); if (r.completed) stars += l.stars; });
    U.drawText(ctx, String(stars), x - 196, y, { size: 24, fill: '#fff', align: 'left', stroke: 3 });

    // secret coins
    ctx.save();
    ctx.drawImage(TEX.secretCoin, x - 306, y - 15, 30, 30);
    ctx.restore();
    U.drawText(ctx, String(gd.save.secretCoins.length), x - 272, y, { size: 24, fill: '#fff', align: 'left', stroke: 3 });
  }

  function backButton(id) {
    const x = 30, y = 26, s = 52;
    return ICONBTN(id || 'back', x, y, s, (ctx, cx, cy, sz) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.drawImage(TEX.arrow.l, -sz * .35, -sz * .45, sz * .7, sz * .9);
      ctx.restore();
    }, null, '#4a4f6b');
  }

  function playerColors() {
    const col = gd.save.colors;
    return { p1: palette(col.p1), p2: palette(col.p2), gc: palette(col.glow === undefined ? 15 : col.glow) };
  }
  function isModeUnlocked(key) {
    if (key === 'cube' || key === 'ship' || key === 'ball' || key === 'ufo') return true;
    return gd.save.unlocked.indexOf('mode_' + key) >= 0;
  }
  function modeVariant(key) {
    const v = gd.save.icons[MODE_KEYS.indexOf(key) >= 0 ? key : 'cube'];
    return v === undefined ? 0 : v;
  }

  function drawPlayerIcon(ctx, key, x, y, size, rot, phase) {
    const cols = playerColors();
    if (key === 'robot') { gd.tex.drawRobotIcon(ctx, x, y, size, cols.p1, cols.p2, cols.gc, modeVariant(key), phase || UI.time * 8); return; }
    const img = gd.tex.icon(key, cols.p1, cols.p2, cols.gc, modeVariant(key), Math.round(size));
    if (!img) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  function drawDeathIcon(ctx, x, y, size, variant) {
    const cols = playerColors();
    const img = gd.tex.icon('death', cols.p1, cols.p2, cols.gc, variant || gd.save.icons.death || 0, Math.round(size));
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  /* ============================================================
     MAIN MENU
     ============================================================ */
  function drawMenu(ctx) {
    const gy = drawBg(ctx, UI.time * 40);
    // logo
    const lw = 560, lh = 150;
    ctx.save();
    ctx.translate(C.W / 2 - lw / 2, 60 + Math.sin(UI.time * 1.4) * 5);
    ctx.drawImage(TEX.logo, 0, 0, lw, lh);
    ctx.restore();

    // preview icon on the podium
    ctx.save();
    const bob = Math.sin(UI.time * 3) * 8;
    const s = 74;
    ctx.translate(200, C.H - 250 + bob);
    ctx.rotate(Math.sin(UI.time * 1.2) * .12);
    drawPlayerIcon(ctx, 'cube', 0, 0, s, 0, UI.time * 6);
    ctx.restore();
    // podium
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.beginPath();
    ctx.ellipse(200, C.H - 190, 90, 18, 0, 0, 7);
    ctx.fill();
    ctx.restore();
    U.drawText(ctx, 'ICON KIT PREVIEW', 200, C.H - 160, { size: 15, fill: '#cfe0ff', stroke: 3 });
    U.drawText(ctx, gd.save.name || 'Player', 200, C.H - 132, { size: 22, fill: '#fff', stroke: 3 });
    U.drawText(ctx, 'Attempts ' + (gd.save.stats.attempts || 0), 200, C.H - 106, { size: 15, fill: '#9fb6e0', stroke: 3 });

    // buttons
    const cx = 700, bw = 300, bh = 62;
    let y = 200;
    BTN('play', cx - bw / 2, y, bw, bh + 14, 'PLAY', { color: '#2fbc5a', size: 40 });
    y += bh + 40;
    const bw2 = 148;
    ICONBTN('creator', cx - bw / 2, y, bw2, (c, x, cy, sz) => drawHammer(c, x, cy, sz), 'CREATOR', '#7b3bf0');
    ICONBTN('kit', cx - bw / 2 + bw2 + 4, y, bw2, (c, x, cy, sz) => {
      const cols = playerColors();
      const img = gd.tex.icon('cube', cols.p1, cols.p2, cols.gc, gd.save.icons.cube || 0, Math.round(sz));
      if (img) c.drawImage(img, x - sz / 2, cy - sz / 2, sz, sz);
    }, 'ICON KIT', '#f08a1f');
    y += bw2 + 44;
    ICONBTN('shop', cx - bw / 2, y, bw2, (c, x, cy, sz) => drawBag(c, x, cy, sz), 'SHOP', '#e0402f');
    ICONBTN('stats', cx - bw / 2 + bw2 + 4, y, bw2, (c, x, cy, sz) => drawChart(c, x, cy, sz), 'STATS', '#2f7bff');
    y += bw2 + 44;
    BTN('settings', cx - bw / 2 + bw2 / 2 + 2 - bw2 / 2, y, bw2, 48, 'SETTINGS', { color: '#4a4f6b', size: 20 });
    BTN('ach', cx - bw / 2 + bw2 + 4, y, bw2, 48, 'MEDALS', { color: '#4a4f6b', size: 20 });

    topBar(ctx);
    U.drawText(ctx, 'A browser rhythm-platformer in the style of Geometry Dash  •  all art & music generated at runtime', C.W / 2, C.H - 24, { size: 15, fill: 'rgba(220,235,255,.75)', stroke: 2 });
  }

  function drawHammer(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.5);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2.4;
    ctx.fillRect(-s * .09, -s * .05, s * .18, s * .55); ctx.strokeRect(-s * .09, -s * .05, s * .18, s * .55);
    U.rr(ctx, -s * .34, -s * .42, s * .68, s * .34, 4); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawBag(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2.4;
    U.rr(ctx, -s * .38, -s * .18, s * .76, s * .56, 5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * .18, s * .22, Math.PI, 0); ctx.lineWidth = s * .09;
    ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }
  function drawChart(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2;
    const bars = [[-.3, .3], [-.02, .62], [.26, .95]];
    bars.forEach(b => { ctx.fillRect(s * b[0], s * (.45 - b[1]), s * .18, s * b[1]); ctx.strokeRect(s * b[0], s * (.45 - b[1]), s * .18, s * b[1]); });
    ctx.restore();
  }

  /* ============================================================
     LEVEL CAROUSEL
     ============================================================ */
  function currentLevel() {
    const list = gd.levels.LEVELS;
    UI.levelSel = ((UI.levelSel % list.length) + list.length) % list.length;
    return list[UI.levelSel];
  }

  function drawLevels(ctx) {
    const level = currentLevel();
    const th = level.theme.stops[0];
    drawBg(ctx, UI.time * 30 + UI.levelSel * 400, th.bg);
    backButton('back');
    U.drawText(ctx, 'SELECT LEVEL', C.W / 2, 52, { size: 34, fill: '#fff', stroke: 4, gradient: ['#ffffff', '#bfd8ff'] });

    const cardW = 760, cardH = 470, cx = (C.W - cardW) / 2, cy = 118;

    // arrows
    ICONBTN('prev', cx - 120, cy + cardH / 2 - 40, 84, (c, x, yy, sz) => {
      c.drawImage(TEX.arrow.l, x - sz * .3, yy - sz * .45, sz * .6, sz * .9);
    }, null, '#4a4f6b');
    ICONBTN('next', cx + cardW + 36, cy + cardH / 2 - 40, 84, (c, x, yy, sz) => {
      c.drawImage(TEX.arrow.r, x - sz * .3, yy - sz * .45, sz * .6, sz * .9);
    }, null, '#4a4f6b');

    // card
    ctx.save();
    ctx.translate(cx, cy);
    gd.tex.drawPanel(ctx, cardW, cardH, U.shade(th.bg, -.28), .96);
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    // accent strip
    ctx.save();
    ctx.beginPath(); U.rr(ctx, 0, 0, cardW, cardH, 14); ctx.clip();
    const ag = ctx.createLinearGradient(0, 0, cardW, 120);
    ag.addColorStop(0, U.withAlpha(th.line, .30));
    ag.addColorStop(1, U.withAlpha(th.line, 0));
    ctx.fillStyle = ag;
    ctx.fillRect(0, 0, cardW, 130);
    ctx.restore();

    const rec = gd.levels.rec(level);
    // title
    U.drawText(ctx, level.name, cardW / 2, 62, { size: 52, fill: '#fff', stroke: 5, strokeColor: 'rgba(0,0,0,.8)', gradient: ['#ffffff', '#cfe4ff'] });
    U.drawText(ctx, 'by ' + level.artist, cardW / 2, 104, { size: 20, fill: '#cfe0ff', stroke: 3 });

    // difficulty
    ctx.drawImage(TEX.face[level.difficulty], 46, 40, 76, 76);
    U.drawText(ctx, C.DIFF[level.difficulty].name, 84, 132, { size: 18, fill: '#fff', stroke: 3 });
    // stars
    ctx.drawImage(TEX.star.on, cardW - 130, 42, 30, 30);
    U.drawText(ctx, String(C.DIFF[level.difficulty].stars), cardW - 92, 58, { size: 24, fill: '#fff', stroke: 3, align: 'left' });
    // coins
    for (let i = 0; i < 3; i++) {
      const got = rec.coins[i];
      ctx.save();
      ctx.globalAlpha = got ? 1 : .30;
      ctx.drawImage(got ? TEX.secretCoin : TEX.coin, cardW - 190 + i * 44, 96, 36, 36);
      ctx.restore();
    }

    // best % bar
    const bw = cardW - 120, bx = 60, by = 172;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    U.rr(ctx, bx, by, bw, 24, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; U.rr(ctx, bx, by, bw, 24, 12); ctx.stroke();
    const g2 = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g2.addColorStop(0, '#5ce35c'); g2.addColorStop(.6, '#ffe14d'); g2.addColorStop(1, '#ff6fb5');
    ctx.fillStyle = g2;
    U.rr(ctx, bx + 2, by + 2, Math.max(2, (bw - 4) * ((rec.best || 0) / 100)), 20, 10); ctx.fill();
    ctx.restore();
    U.drawText(ctx, 'BEST ' + (rec.best || 0) + '%', bx + 8, by + 12, { size: 16, fill: '#fff', align: 'left', stroke: 3 });
    U.drawText(ctx, 'ATTEMPTS ' + (rec.attempts || 0), bx + bw - 8, by + 12, { size: 16, fill: '#fff', align: 'right', stroke: 3 });

    // description
    U.drawText(ctx, level.desc || '', cardW / 2, 228, { size: 19, fill: '#dbe8ff', stroke: 3 });

    // preview strip: show the icon and a mini waveform of the level
    const py = 268, ph = 78, pw = cardW - 120;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    U.rr(ctx, 60, py, pw, ph, 10); ctx.fill();
    ctx.clip();
    // level "layout" preview
    ctx.globalAlpha = .9;
    const scl = pw / level.length;
    for (let i = 0; i < level.objs.length; i += 3) {
      const a = level.objs[i];
      const px = 60 + a[0] * scl;
      const hgt = Math.max(2, (a[4] || 1) * 3.2);
      const ty = py + ph - 6 - (a[1] || 0) * 3.2;
      if (a[2] === 'spike' || a[2] === 'spike_d' || a[2] === 'saw') ctx.fillStyle = '#ff7b7b';
      else if (a[2] === 'orb' || a[2] === 'pad' || a[2] === 'ring' || a[2] === 'dash') ctx.fillStyle = '#ffe14d';
      else if (a[2] === 'coin') ctx.fillStyle = '#ffcf33';
      else if (a[2].indexOf('p_') === 0) ctx.fillStyle = '#7fd4ff';
      else ctx.fillStyle = U.withAlpha(th.line, .55);
      ctx.fillRect(px, ty, Math.max(1.5, (a[3] || 1) * scl), hgt);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // buttons
    const by2 = 372;
    BTN('level_play', 60, by2, 220, 72, 'PLAY', { color: '#2fbc5a', size: 34 });
    BTN('level_practice', 296, by2, 200, 72, 'PRACTICE', { color: '#f08a1f', size: 24 });
    BTN('level_edit', 512, by2, 92, 72, 'EDIT', { color: '#7b3bf0', size: 22 });
    BTN('level_info', 620, by2, bw - 440, 72, 'INFO', { color: '#4a4f6b', size: 22 });
    ctx.restore();

    // dots
    const list = gd.levels.LEVELS;
    const total = list.length;
    const dw = 18, gap = 10;
    const startX = C.W / 2 - (total * (dw + gap) - gap) / 2;
    for (let i = 0; i < total; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(startX + i * (dw + gap) + dw / 2, C.H - 42, i === UI.levelSel ? 8 : 5, 0, 7);
      ctx.fillStyle = i === UI.levelSel ? '#fff' : 'rgba(255,255,255,.35)';
      ctx.fill();
      ctx.restore();
    }
    U.drawText(ctx, (UI.levelSel + 1) + ' / ' + total, C.W / 2, C.H - 70, { size: 16, fill: '#cfe0ff', stroke: 3 });
    topBar(ctx);
  }

  /* ============================================================
     LEVEL INFO PANEL
     ============================================================ */
  function drawInfo(ctx) {
    const level = currentLevel();
    const th = level.theme.stops[0];
    drawBg(ctx, UI.time * 20, th.bg);
    backButton('back');
    const rec = gd.levels.rec(level);
    const w = 820, h = 520, x = (C.W - w) / 2, y = 90;
    ctx.save();
    ctx.translate(x, y);
    gd.tex.drawPanel(ctx, w, h, U.shade(th.bg, -.3), .97);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    U.drawText(ctx, level.name, w / 2, 56, { size: 44, fill: '#fff', stroke: 4, gradient: ['#fff', '#cfe4ff'] });
    U.drawText(ctx, 'by ' + level.artist, w / 2, 96, { size: 20, fill: '#cfe0ff', stroke: 3 });
    ctx.drawImage(TEX.face[level.difficulty], 40, 30, 70, 70);

    const rows = [
      ['Difficulty', C.DIFF[level.difficulty].name + '  (' + level.stars + ' stars)'],
      ['Best', (rec.best || 0) + '%'],
      ['Attempts', String(rec.attempts || 0)],
      ['Jumps', String(rec.jumps || 0)],
      ['Time spent', U.fmtTime(rec.time || 0)],
      ['Coins', rec.coins.map(c => c ? 'Yes' : 'No').join('  /  ')],
      ['Completed', rec.completed ? 'Yes' : 'No'],
      ['Objects', String(level.objs.length)],
      ['Length', Math.round(level.length) + ' blocks  ·  ' + Math.round(level.seconds) + 's'],
      ['Song', level.song.bpm + ' BPM  ·  ' + level.song.key + '  ·  ' + level.song.bars + ' bars'],
      ['Speed', ['Slow', 'Normal', 'Fast', 'Faster', 'Fastest'][level.baseSpeed] || 'Normal']
    ];
    rows.forEach((r, i) => {
      const yy = 150 + i * 32;
      U.drawText(ctx, r[0], 60, yy, { size: 20, fill: '#9fc0ff', align: 'left', stroke: 3 });
      U.drawText(ctx, r[1], w - 60, yy, { size: 20, fill: '#fff', align: 'right', stroke: 3 });
    });
    U.drawText(ctx, level.desc || '', w / 2, 150 + rows.length * 32 + 14, { size: 18, fill: '#cfe0ff', stroke: 3 });
    ctx.restore();
    topBar(ctx);
  }

  /* ============================================================
     ICON KIT
     ============================================================ */
  function drawKit(ctx) {
    drawBg(ctx, UI.time * 25, '#3a2a7a');
    backButton('back');
    U.drawText(ctx, 'ICON KIT', C.W / 2, 50, { size: 36, fill: '#fff', stroke: 4, gradient: ['#fff', '#ffd98a'] });

    // mode tabs
    const tabs = MODE_KEYS.concat(['death']);
    const tw = 104, th = 74, gap = 8;
    const totalW = tabs.length * tw + (tabs.length - 1) * gap;
    const startX = (C.W - totalW) / 2;
    const locked = { robot: !isModeUnlocked('robot'), spider: !isModeUnlocked('spider'), swing: !isModeUnlocked('swing'), wave: !isModeUnlocked('wave') };
    tabs.forEach((k, i) => {
      const x = startX + i * (tw + gap), y = 96;
      const sel = UI.kitMode === i;
      const isLocked = !!locked[k];
      ctx.save();
      gd.tex.drawButton(ctx, tw, th, k === 'death' ? '#7b3bf0' : (sel ? '#2fbc5a' : '#4a4f6b'), sel ? 'hover' : 'up');
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      if (isLocked) {
        ctx.globalAlpha = .85;
        drawLock(ctx, tw / 2, th / 2 - 4, 30);
      } else if (k === 'death') {
        drawDeathIcon(ctx, tw / 2, th / 2 - 2, 44, gd.save.icons.death || 0);
      } else {
        drawPlayerIcon(ctx, k, tw / 2, th / 2 - 2, 44, 0, UI.time * 5);
      }
      ctx.restore();
      register('tab_' + k, x, y, tw, th);
      if (hovered('tab_' + k, x, y, tw, th)) UI.hover = 'tab_' + k;
    });

    const cur = tabs[UI.kitMode];
    const curLocked = !!locked[cur];

    // icon grid
    const gx = 60, gy = 210, cols = 7, cell = 96, cgap = 12;
    const count = cur === 'death' ? 4 : 12;
    for (let i = 0; i < count; i++) {
      const x = gx + (i % cols) * (cell + cgap);
      const y = gy + Math.floor(i / cols) * (cell + cgap);
      const sel = cur === 'death' ? (gd.save.icons.death || 0) === i : modeVariant(cur) === i;
      const avail = cur === 'death' ? (i === 0 || gd.save.unlocked.indexOf('death_' + i) >= 0)
                                    : (i < 10 || true);
      ctx.save();
      gd.tex.drawButton(ctx, cell, cell, sel ? '#2fbc5a' : '#3b4170', hovered('ic_' + i, x, y, cell, cell) ? 'hover' : 'up');
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = avail ? 1 : .35;
      if (cur === 'death') drawDeathIcon(ctx, cell / 2, cell / 2, 56, i);
      else {
        const cols = playerColors();
        if (cur === 'robot') gd.tex.drawRobotIcon(ctx, cell / 2, cell / 2, 56, cols.p1, cols.p2, cols.gc, i, UI.time * 5);
        else {
          const img = gd.tex.icon(cur, cols.p1, cols.p2, cols.gc, i, 56);
          if (img) ctx.drawImage(img, -28, -28, 56, 56);
        }
      }
      ctx.restore();
      if (!avail) drawLock(ctx, x + cell / 2, y + cell / 2, 30);
      register('ic_' + i, x, y, cell, cell);
      if (hovered('ic_' + i, x, y, cell, cell) && avail) UI.hover = 'ic_' + i;
    }

    // right panel: preview + colours
    const px = 800, pw = 420;
    ctx.save();
    ctx.translate(px, 200);
    gd.tex.drawPanel(ctx, pw, 400, '#2a2f5e', .95);
    ctx.restore();
    ctx.save();
    ctx.translate(px, 200);
    U.drawText(ctx, 'PREVIEW', pw / 2, 24, { size: 22, fill: '#fff', stroke: 3 });
    // preview stage
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    U.rr(ctx, 40, 48, pw - 80, 150, 12); ctx.fill();
    ctx.strokeStyle = U.withAlpha('#7fd4ff', .4); ctx.lineWidth = 2;
    U.rr(ctx, 40, 48, pw - 80, 150, 12); ctx.stroke();
    const bob = Math.sin(UI.time * 3) * 6;
    ctx.save();
    ctx.translate(pw / 2, 128 + bob);
    ctx.rotate(Math.sin(UI.time * 1.5) * .18);
    const pk = cur === 'death' ? 'cube' : cur;
    drawPlayerIcon(ctx, pk, 0, 0, 76, 0, UI.time * 6);
    ctx.restore();
    ctx.restore();
    // colour pickers
    const colsPerRow = 8, sw = 44, sgap = 4;
    const total = paletteCount();
    const lockedColor = i => i >= C.PALETTE.length && gd.save.unlocked.indexOf('col_' + i) < 0;
    ['p1', 'p2', 'glow'].forEach((key, row) => {
      const ry = 228 + row * 60;
      U.drawText(ctx, key === 'p1' ? 'PRIMARY' : key === 'p2' ? 'SECONDARY' : 'GLOW', 20, ry + 8, { size: 15, fill: '#cfe0ff', align: 'left', stroke: 3 });
      for (let i = 0; i < total; i++) {
        const x = 130 + (i % colsPerRow) * (sw + sgap);
        const y = ry - 20 + Math.floor(i / colsPerRow) * (sw + sgap);
        const selIdx = key === 'glow' ? (gd.save.colors.glow === undefined ? 15 : gd.save.colors.glow) : gd.save.colors[key];
        const sel = selIdx === i;
        ctx.save();
        ctx.globalAlpha = lockedColor(i) ? .35 : 1;
        ctx.fillStyle = palette(i);
        U.rr(ctx, x, y, sw - 6, sw - 6, 6); ctx.fill();
        ctx.lineWidth = sel ? 4 : 1.6;
        ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,.65)';
        U.rr(ctx, x, y, sw - 6, sw - 6, 6); ctx.stroke();
        if (sel) { ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; U.rr(ctx, x + 3, y + 3, sw - 12, sw - 12, 4); ctx.stroke(); }
        ctx.restore();
        const id = 'col_' + key + '_' + i;
        register(id, x, y, sw - 6, sw - 6);
        if (hovered(id, x, y, sw - 6, sw - 6)) UI.hover = id;
      }
    });
    ctx.restore();

    if (curLocked) {
      ctx.save();
      ctx.fillStyle = 'rgba(6,8,24,.72)';
      U.rr(ctx, 40, 190, 660, 380, 16); ctx.fill();
      ctx.restore();
      drawLock(ctx, 370, 340, 90);
      U.drawText(ctx, MODE_KEYS[UI.kitMode].toUpperCase() + ' IS LOCKED', 370, 430, { size: 30, fill: '#fff', stroke: 4 });
      U.drawText(ctx, 'Buy it in the Shop to use this icon', 370, 468, { size: 20, fill: '#cfe0ff', stroke: 3 });
    }
    topBar(ctx);
  }

  function drawLock(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.arc(0, 0, s * .62, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, s * .62, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = s * .13;
    ctx.beginPath(); ctx.arc(0, -s * .18, s * .26, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#ffd23b';
    U.rr(ctx, -s * .30, -s * .16, s * .60, s * .48, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.beginPath(); ctx.arc(0, s * .06, s * .07, 0, 7); ctx.fill();
    ctx.fillRect(-s * .035, s * .06, s * .07, s * .16);
    ctx.restore();
  }

  /* ============================================================
     SHOP
     ============================================================ */
  function drawShop(ctx) {
    drawBg(ctx, UI.time * 22, '#2a4a3a');
    backButton('back');
    U.drawText(ctx, 'SHOP', C.W / 2, 50, { size: 36, fill: '#fff', stroke: 4, gradient: ['#fff', '#8affc4'] });
    U.drawText(ctx, 'Mana orbs are earned by completing levels, collecting coins and setting records.', C.W / 2, 86, { size: 16, fill: '#bfe8d0', stroke: 3 });

    const cols = 5, cw = 216, ch = 178, gap = 16;
    const startX = (C.W - (cols * cw + (cols - 1) * gap)) / 2;
    const startY = 118;
    SHOP_ITEMS.forEach((item, i) => {
      const x = startX + (i % cols) * (cw + gap);
      const y = startY + Math.floor(i / cols) * (ch + gap);
      const owned = gd.save.unlocked.indexOf(item.id) >= 0;
      const afford = gd.save.mana >= item.price;
      ctx.save();
      ctx.translate(x, y);
      gd.tex.drawPanel(ctx, cw, ch, owned ? '#2a5a3a' : (afford ? '#2f3f7a' : '#3a2f3f'), .95);
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      // preview
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      U.rr(ctx, 16, 16, cw - 32, 86, 10); ctx.fill();
      ctx.translate(cw / 2, 59);
      if (item.kind === 'mode') drawPlayerIcon(ctx, item.mode, 0, 0, 60, 0, UI.time * 5);
      else if (item.kind === 'death') drawDeathIcon(ctx, 0, 0, 60, item.v);
      else {
        ctx.fillStyle = palette(item.v);
        U.rr(ctx, -30, -30, 60, 60, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; U.rr(ctx, -30, -30, 60, 60, 10); ctx.stroke();
      }
      ctx.restore();
      U.drawText(ctx, item.name, cw / 2, 122, { size: 20, fill: '#fff', stroke: 3 });
      U.drawText(ctx, item.desc, cw / 2, 144, { size: 14, fill: '#cfe0ff', stroke: 3 });
      if (owned) {
        U.drawText(ctx, 'OWNED', cw / 2, 168, { size: 18, fill: '#5ce35c', stroke: 3 });
      } else {
        ctx.save();
        const c = ctx.createRadialGradient(cw / 2 - 42, 166, 2, cw / 2 - 42, 166, 12);
        c.addColorStop(0, '#bff3ff'); c.addColorStop(1, '#3ea8ff');
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(cw / 2 - 42, 166, 11, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
        U.drawText(ctx, String(item.price), cw / 2 + 10, 166, { size: 20, fill: afford ? '#fff' : '#ff8a8a', stroke: 3 });
      }
      ctx.restore();
      register('buy_' + item.id, x, y, cw, ch);
      if (hovered('buy_' + item.id, x, y, cw, ch)) UI.hover = 'buy_' + item.id;
    });
    topBar(ctx);
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  function drawSettings(ctx) {
    drawBg(ctx, UI.time * 18, '#2a2f4a');
    backButton('back');
    U.drawText(ctx, 'SETTINGS', C.W / 2, 50, { size: 36, fill: '#fff', stroke: 4 });
    const s = gd.save.settings;
    const x = 240, w = 420, h = 24;
    let y = 130;
    slider('music', x, y, w, h, 'Music volume', s.music); y += 62;
    slider('sfx', x, y, w, h, 'SFX volume', s.sfx); y += 62;
    slider('shakeAmt', x, y, w, h, 'Screen shake', s.shake ? 1 : 0); y += 62;

    const toggles = [
      ['groundPulse', 'Ground pulse to the music'],
      ['bgEffect', 'Background effects'],
      ['smoothRotate', 'Smooth icon rotation'],
      ['lowDetail', 'Low detail mode'],
      ['showFps', 'Show FPS'],
      ['showHitboxes', 'Show hitboxes']
    ];
    toggles.forEach(t => {
      toggle('tg_' + t[0], x, y, w + 120, 30, t[1], !!s[t[0]]);
      y += 48;
    });

    // quality
    U.drawText(ctx, 'Quality', x, y - 6, { size: 18, fill: '#e8f0ff', align: 'left', stroke: 3 });
    ['low', 'med', 'high'].forEach((q, i) => {
      BTN('q_' + q, x + 110 + i * 130, y - 22, 120, 44, q.toUpperCase(), {
        color: s.quality === q ? '#2fbc5a' : '#4a4f6b', size: 20
      });
    });
    y += 50;

    BTN('rename', x, y, 240, 52, 'PLAYER: ' + (gd.save.name || 'Player').toUpperCase(), { color: '#7b3bf0', size: 18 });
    BTN('reset', x + 260, y, 240, 52, 'RESET PROGRESS', { color: UI.confirmReset ? '#e0402f' : '#7a2f4a', size: 20 });
    if (UI.confirmReset) {
      U.drawText(ctx, 'Are you sure? This deletes all progress.', x, y + 46, { size: 18, fill: '#ff9b9b', align: 'left', stroke: 3 });
      BTN('reset_yes', x, y + 66, 140, 44, 'YES', { color: '#e0402f', size: 20 });
      BTN('reset_no', x + 152, y + 66, 140, 44, 'NO', { color: '#4a4f6b', size: 20 });
    }
    U.drawText(ctx, 'Geometry Dash Web — original fan-made engine. No RobTop assets used.', C.W / 2, C.H - 120, { size: 16, fill: 'rgba(220,235,255,.75)', stroke: 2 });
    U.drawText(ctx, 'Auto-generated textures + synthesised chiptune music.', C.W / 2, C.H - 96, { size: 16, fill: 'rgba(220,235,255,.75)', stroke: 2 });
    topBar(ctx);
  }

  /* ============================================================
     STATS / ACHIEVEMENTS
     ============================================================ */
  function drawStats(ctx) {
    drawBg(ctx, UI.time * 16, '#1a2f5a');
    backButton('back');
    U.drawText(ctx, 'STATS', C.W / 2, 50, { size: 36, fill: '#fff', stroke: 4 });
    const st = gd.save.stats;
    const lvls = gd.levels.LEVELS;
    let stars = 0, completed = 0, coins = 0, attempts = 0;
    lvls.forEach(l => {
      const r = gd.levels.rec(l);
      if (r.completed) { stars += l.stars; completed++; }
      coins += r.coins.filter(Boolean).length;
      attempts += r.attempts || 0;
    });
    const rows = [
      ['Levels completed', completed + ' / ' + lvls.length, 0],
      ['Stars earned', String(stars), 1],
      ['Secret coins', String(coins), 0],
      ['Total attempts', String(st.attempts || 0), 0],
      ['Total jumps', String(st.jumps || 0), 1],
      ['Deaths', String(st.deaths || 0), 0],
      ['Mana orbs', String(gd.save.mana), 1],
      ['Orbs used', String(st.orbs || 0), 0],
      ['Pads used', String(st.pads || 0), 0],
      ['Play time', U.fmtTime(st.playTime || 0), 0],
      ['Custom levels', String(gd.save.custom.length), 0]
    ];
    const w = 560, x = 100;
    rows.forEach((r, i) => {
      const y = 120 + i * 38;
      ctx.save();
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.22)';
      U.rr(ctx, x - 12, y - 16, w, 32, 6); ctx.fill();
      ctx.restore();
      U.drawText(ctx, r[0], x, y, { size: 20, fill: '#cfe0ff', align: 'left', stroke: 3 });
      U.drawText(ctx, r[1], x + w - 40, y, { size: 22, fill: r[2] ? '#ffe14d' : '#fff', align: 'right', stroke: 3 });
    });

    // achievements
    const ax = 720;
    ctx.save();
    ctx.translate(ax, 118);
    gd.tex.drawPanel(ctx, 460, 520, '#2a2f5e', .95);
    ctx.restore();
    ctx.save();
    ctx.translate(ax, 118);
    U.drawText(ctx, 'MEDALS', 230, 26, { size: 26, fill: '#fff', stroke: 3 });
    ACHIEVEMENTS.forEach((a, i) => {
      const y = 70 + i * 52;
      const got = gd.save.achievements.indexOf(a.id) >= 0;
      ctx.save();
      ctx.globalAlpha = got ? 1 : .42;
      ctx.fillStyle = got ? 'rgba(255,210,59,.16)' : 'rgba(0,0,0,.25)';
      U.rr(ctx, 20, y - 22, 420, 46, 8); ctx.fill();
      ctx.strokeStyle = got ? '#ffd23b' : 'rgba(255,255,255,.3)';
      ctx.lineWidth = 2;
      U.rr(ctx, 20, y - 22, 420, 46, 8); ctx.stroke();
      ctx.drawImage(got ? TEX.star.on : TEX.star.off, 32, y - 13, 26, 26);
      ctx.restore();
      U.drawText(ctx, a.name, 70, y - 8, { size: 19, fill: '#fff', align: 'left', stroke: 3 });
      U.drawText(ctx, a.desc, 70, y + 11, { size: 14, fill: '#bcd2ff', align: 'left', stroke: 2 });
    });
    ctx.restore();
    topBar(ctx);
  }

  /* ============================================================
     CREATOR (my levels)
     ============================================================ */
  function drawCreator(ctx) {
    drawBg(ctx, UI.time * 24, '#3a2a6a');
    backButton('back');
    U.drawText(ctx, 'CREATOR', C.W / 2, 50, { size: 36, fill: '#fff', stroke: 4, gradient: ['#fff', '#d0a8ff'] });

    BTN('newlevel', C.W - 300, 30, 260, 56, '+ CREATE LEVEL', { color: '#2fbc5a', size: 22 });
    BTN('import', C.W - 300, 96, 260, 44, 'IMPORT LEVEL (.json)', { color: '#2f7bff', size: 18 });

    const list = gd.save.custom;
    if (!list.length) {
      U.drawText(ctx, 'No levels yet.', C.W / 2, 320, { size: 30, fill: '#cfe0ff', stroke: 4 });
      U.drawText(ctx, 'Hit CREATE LEVEL to open the editor, then press SAVE when you are done.', C.W / 2, 366, { size: 20, fill: '#9fb6e0', stroke: 3 });
      topBar(ctx);
      return;
    }
    const cols = 3, cw = 340, ch = 170, gap = 24;
    const startX = (C.W - (cols * cw + (cols - 1) * gap)) / 2;
    list.forEach((lvl, i) => {
      const x = startX + (i % cols) * (cw + gap);
      const y = 140 + Math.floor(i / cols) * (ch + gap);
      ctx.save();
      ctx.translate(x, y);
      gd.tex.drawPanel(ctx, cw, ch, '#2f2a5e', .95);
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      U.drawText(ctx, lvl.name, cw / 2, 34, { size: 24, fill: '#fff', stroke: 3 });
      U.drawText(ctx, (lvl.objs ? lvl.objs.length : 0) + ' objects  ·  ' + (lvl.difficulty || 'normal'), cw / 2, 62, { size: 15, fill: '#cfe0ff', stroke: 3 });
      BTN('cplay_' + i, 24, 92, 92, 52, 'PLAY', { color: '#2fbc5a', size: 18 });
      BTN('cedit_' + i, 126, 92, 92, 52, 'EDIT', { color: '#7b3bf0', size: 18 });
      BTN('cdel_' + i, 228, 92, 88, 52, 'DEL', { color: '#e0402f', size: 18 });
      ctx.restore();
    });
    topBar(ctx);
  }

  /* ============================================================
     PAUSE + COMPLETE OVERLAYS (drawn from game.draw)
     ============================================================ */
  function drawPause(ctx, S) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,8,22,.72)';
    ctx.fillRect(0, 0, C.W, C.H);
    const w = 520, h = 460, x = (C.W - w) / 2, y = (C.H - h) / 2;
    ctx.save();
    ctx.translate(x, y);
    gd.tex.drawPanel(ctx, w, h, '#26306e', .98);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    U.drawText(ctx, 'PAUSED', w / 2, 52, { size: 44, fill: '#fff', stroke: 5, gradient: ['#fff', '#ffd98a'] });
    U.drawText(ctx, S.level.name, w / 2, 96, { size: 20, fill: '#cfe0ff', stroke: 3 });
    // progress
    const bw = w - 100;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    U.rr(ctx, 50, 122, bw, 22, 11); ctx.fill();
    const g = ctx.createLinearGradient(50, 0, 50 + bw, 0);
    g.addColorStop(0, '#5ce35c'); g.addColorStop(.6, '#ffe14d'); g.addColorStop(1, '#ff6fb5');
    ctx.fillStyle = g;
    U.rr(ctx, 52, 124, Math.max(2, (bw - 4) * (S.pct / 100)), 18, 9); ctx.fill();
    ctx.restore();
    U.drawText(ctx, Math.floor(S.pct) + '%', w / 2, 172, { size: 30, fill: '#fff', stroke: 4 });
    U.drawText(ctx, 'Best ' + Math.floor(S.bestPct) + '%', w / 2, 204, { size: 18, fill: '#cfe0ff', stroke: 3 });
    U.drawText(ctx, 'Attempt ' + S.attempt + '   ·   Jumps ' + S.jumps + '   ·   ' + U.fmtTime(S.runTime), w / 2, 232, { size: 18, fill: '#cfe0ff', stroke: 3 });

    BTN('p_resume', w / 2 - 190, 268, 170, 62, 'RESUME', { color: '#2fbc5a', size: 24 });
    BTN('p_restart', w / 2 + 20, 268, 170, 62, 'RESTART', { color: '#f08a1f', size: 24 });
    BTN('p_practice', w / 2 - 190, 344, 380, 56, S.mode === 'practice' ? 'EXIT PRACTICE MODE' : 'PRACTICE MODE', { color: '#7b3bf0', size: 22 });
    BTN('p_menu', w / 2 - 190, 410, 380, 52, 'QUIT TO MENU', { color: '#e0402f', size: 22 });
    ctx.restore();
    ctx.restore();
  }

  function drawComplete(ctx, S) {
    const t = Math.min(1, S.doneTimer / 0.6);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = 'rgba(6,10,30,.78)';
    ctx.fillRect(0, 0, C.W, C.H);
    const w = 560, h = 470, x = (C.W - w) / 2, y = (C.H - h) / 2 - 10 + (1 - t) * 40;
    const sc = 0.92 + t * .08;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(sc, sc);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.translate(x, y);
    gd.tex.drawPanel(ctx, w, h, '#2f7a4a', .98);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    U.drawText(ctx, 'LEVEL COMPLETE!', w / 2, 56, { size: 40, fill: '#fff', stroke: 5, gradient: ['#fff6b0', '#ffae1f'] });
    U.drawText(ctx, S.level.name, w / 2, 100, { size: 22, fill: '#e8ffe8', stroke: 3 });
    // stars + coins
    const stars = S.level.stars;
    const totalW = stars * 44;
    for (let i = 0; i < stars; i++) {
      ctx.save();
      ctx.globalAlpha = U.clamp((S.doneTimer - i * .12) * 3, 0, 1);
      ctx.drawImage(TEX.star.on, w / 2 - totalW / 2 + i * 44, 126, 40, 40);
      ctx.restore();
    }
    for (let i = 0; i < 3; i++) {
      const got = S.coinsRun[i];
      ctx.save();
      ctx.globalAlpha = got ? U.clamp((S.doneTimer - .3 - i * .15) * 3, 0, 1) : .25;
      ctx.drawImage(got ? TEX.secretCoin : TEX.coin, w / 2 - 60 + i * 44, 178, 38, 38);
      ctx.restore();
    }
    const rec = gd.levels.rec(S.level);
    const rows = [
      ['Attempts', String(S.attempt)],
      ['Jumps', String(S.jumps)],
      ['Time', U.fmtTime(S.runTime)],
      ['Mana earned', '+' + (S.rewardMana || 0)],
      ['Total mana', String(gd.save.mana)]
    ];
    rows.forEach((r, i) => {
      const yy = 244 + i * 32;
      U.drawText(ctx, r[0], 90, yy, { size: 20, fill: '#cfffe0', align: 'left', stroke: 3 });
      U.drawText(ctx, r[1], w - 90, yy, { size: 22, fill: '#fff', align: 'right', stroke: 3 });
    });
    BTN('c_retry', w / 2 - 200, 400, 190, 60, 'RETRY', { color: '#f08a1f', size: 24 });
    BTN('c_menu', w / 2 + 10, 400, 190, 60, 'MENU', { color: '#4a4f6b', size: 24 });
    ctx.restore();
    ctx.restore();
  }

  /* ============================================================
     UPDATE / INPUT
     ============================================================ */
  function clickButton(inp) {
    if (!inp.press) return null;
    for (let i = UI.buttons.length - 1; i >= 0; i--) {
      const b = UI.buttons[i];
      const m = inp.mouse;
      if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) return b;
    }
    return null;
  }

  function update(dt, inp) {
    UI.time += dt;
    UI.buttons.length = 0;
    if (UI.flash > 0) UI.flash -= dt;
    if (!gd._ctx) return false;

    const S = gd.game.S;
    if (S.active) {
      // in a level: pause overlay / complete overlay / practice buttons
      if (S.paused || S.showComplete) {
        const pb = clickButton(inp);
        if (pb) { handleClick(pb, inp); return true; }
      } else if (inp.press) {
        if (gd.game.clickPause(inp.mouse.x, inp.mouse.y)) return true;
      }
      return false;
    }

    const b = clickButton(inp);
    if (b) {
      if (UI.screen === 'editor') { if (gd.editor && gd.editor.action(b.id)) return true; }
      else { handleClick(b, inp); return true; }
    } else if (UI.screen === 'editor' && inp.press) {
      gd.editor && gd.editor.handleClick(inp.mouse.x, inp.mouse.y, inp.mouse);
      return true;
    }
    if (inp.down && UI.screen === 'settings') handleDrag(inp);
    return !!b;
  }

  function handleDrag(inp) {
    const m = inp.mouse;
    const s = gd.save.settings;
    const x = 240, w = 420;
    if (UI.screen === 'settings') {
      const rows = ['music', 'sfx', 'shakeAmt'];
      rows.forEach((key, i) => {
        const y = 130 + i * 62;
        if (Math.abs(m.y - (y + 12)) < 30 && m.x > x - 20 && m.x < x + w + 20) {
          const t = U.clamp((m.x - x) / w, 0, 1);
          if (key === 'shakeAmt') s.shake = t > .5;
          else s[key] = t;
          gd.audio.setVolumes();
          gd.saveSave();
        }
      });
    }
  }

  function handleClick(b, inp) {
    gd.audio.sfx('click');
    UI.flash = .2;
    const id = b.id;
    const S = gd.game.S;
    if (id.indexOf('col_') === 0) {
      const parts = id.split('_');
      const key = parts[1], idx = parseInt(parts[2], 10);
      if (idx >= C.PALETTE.length && gd.save.unlocked.indexOf('col_' + idx) < 0) { gd.audio.sfx('deny'); return; }
      if (key === 'glow') gd.save.colors.glow = idx;
      else gd.save.colors[key] = idx;
      gd.saveSave();
      return;
    }
    if (id.indexOf('tab_') === 0) {
      const k = id.slice(4);
      const tabs = MODE_KEYS.concat(['death']);
      UI.kitMode = Math.max(0, tabs.indexOf(k));
      return;
    }
    if (id.indexOf('ic_') === 0) {
      const i = parseInt(id.slice(3), 10);
      const cur = MODE_KEYS.concat(['death'])[UI.kitMode];
      if (cur === 'death') {
        if (i === 0 || gd.save.unlocked.indexOf('death_' + i) >= 0) gd.save.icons.death = i;
        else gd.audio.sfx('deny');
      } else gd.save.icons[cur] = i;
      gd.saveSave();
      return;
    }
    if (id.indexOf('buy_') === 0) {
      const item = SHOP_ITEMS.find(s => 'buy_' + s.id === id);
      if (!item) return;
      if (gd.save.unlocked.indexOf(item.id) >= 0) return;
      if (gd.save.mana < item.price) { gd.audio.sfx('deny'); return; }
      gd.save.mana -= item.price;
      gd.save.unlocked.push(item.id);
      if (item.kind === 'mode') gd.save.icons[item.mode] = 0;
      if (item.kind === 'death') gd.save.icons.death = item.v;
      gd.audio.sfx('coin');
      gd.saveSave();
      return;
    }
    if (id.indexOf('tg_') === 0) {
      const k = id.slice(3);
      gd.save.settings[k] = !gd.save.settings[k];
      gd.saveSave();
      return;
    }
    if (id.indexOf('q_') === 0) { gd.save.settings.quality = id.slice(2); gd.saveSave(); return; }

    switch (id) {
      case 'back':
        gd.audio.sfx('back');
        if (UI.screen === 'levels' || UI.screen === 'kit' || UI.screen === 'shop' ||
            UI.screen === 'settings' || UI.screen === 'stats' || UI.screen === 'creator' ||
            UI.screen === 'editor' || UI.screen === 'info') UI.screen = 'menu';
        else UI.screen = 'menu';
        break;
      case 'play': UI.screen = 'levels'; break;
      case 'creator': UI.screen = 'creator'; break;
      case 'kit': UI.screen = 'kit'; break;
      case 'shop': UI.screen = 'shop'; break;
      case 'settings': UI.screen = 'settings'; break;
      case 'stats': UI.screen = 'stats'; break;
      case 'ach': UI.screen = 'stats'; break;
      case 'prev': UI.levelSel--; gd.audio.sfx('whoosh'); break;
      case 'next': UI.levelSel++; gd.audio.sfx('whoosh'); break;
      case 'level_play': startLevel(currentLevel(), 'normal'); break;
      case 'level_practice': startLevel(currentLevel(), 'practice'); break;
      case 'level_info': UI.screen = 'info'; break;
      case 'level_edit': UI.screen = 'editor'; gd.editor && gd.editor.open(null); break;
      case 'newlevel':
        UI.screen = 'editor';
        gd.editor && gd.editor.open(null, true);
        break;
      case 'import': {
        try {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          if (document.body && document.body.appendChild) document.body.appendChild(input);
          input.onchange = () => {
            const f = input.files && input.files[0];
            if (f && gd.editor) gd.editor.importFromFile(f);
          };
          input.click();
        } catch (e) { /* ignore */ }
        break;
      }
      case 'rename': {
        const n = window.prompt('Player name', gd.save.name || 'Player');
        if (n !== null && n.trim()) { gd.save.name = n.trim().slice(0, 18); gd.saveSave(); }
        break;
      }
      case 'reset':
        UI.confirmReset = true; break;
      case 'reset_yes':
        localStorage.removeItem(C.SAVE_KEY);
        gd.save = JSON.parse(JSON.stringify(C.DEFAULT_SAVE));
        UI.confirmReset = false;
        break;
      case 'reset_no': UI.confirmReset = false; break;
      case 'p_resume': S.paused = false; gd.audio.unpauseSong(); break;
      case 'p_restart': S.paused = false; gd.audio.stopSong(); gd.game.restart(); gd.audio.unpauseSong(); break;
      case 'p_practice':
        S.mode = S.mode === 'practice' ? 'normal' : 'practice';
        S.paused = false;
        gd.audio.stopSong();
        gd.game.resetRun(false);
        gd.game.S.checkpoints.length = 0;
        gd.audio.playSong(S.level.song, { delay: .08 });
        gd.audio.unpauseSong();
        break;
      case 'p_menu':
        S.paused = false;
        gd.game.exit();
        UI.screen = 'menu';
        break;
      case 'c_retry':
        S.showComplete = false; S.done = false; S.doneTimer = 0;
        gd.game.restart();
        break;
      case 'c_menu':
        S.showComplete = false;
        if (S.level && String(S.level.id).indexOf('test_') === 0 && gd.editor) {
          gd.game.exit();
          if (gd.editor.E.testLevel) gd.editor.E.testLevel = null;
          UI.screen = 'editor';
          gd.editor.E.playing = false;
        } else {
          gd.game.exit();
          UI.screen = 'menu';
        }
        break;
    }
    if (id.indexOf('cplay_') === 0) {
      const lvl = gd.save.custom[parseInt(id.slice(6), 10)];
      if (lvl) startLevel(gd.levels.makeLevel({
        id: lvl.id, name: lvl.name, artist: lvl.artist || 'You', difficulty: lvl.difficulty || 'normal',
        baseSpeed: lvl.baseSpeed || 1, song: lvl.songName || 'bounce', theme: lvl.theme || 'stereo',
        seed: lvl.seed || 7, desc: lvl.desc || '', exactLength: true,
        build: () => ({ objs: JSON.parse(JSON.stringify(lvl.objs)), endX: lvl.endX })
      }), 'normal');
    }
    if (id.indexOf('cedit_') === 0) { UI.screen = 'editor'; gd.editor && gd.editor.open(gd.save.custom[parseInt(id.slice(6), 10)]); }
    if (id.indexOf('cdel_') === 0) {
      gd.save.custom.splice(parseInt(id.slice(5), 10), 1);
      gd.saveSave();
    }
  }

  function startLevel(level, mode) {
    gd.game.exit();
    gd.game.enter(level, mode);
    UI.screen = 'game';
  }

  function onLevelComplete() {
    const S = gd.game.S;
    UI.lastComplete = S.level.id;
    if (S.mode === 'normal' && S.level.difficulty === 'insane' && gd.save.achievements.indexOf('demons') < 0)
      gd.save.achievements.push('demons');
    if (S.coinsRun.every(Boolean) && gd.save.achievements.indexOf('coinall') < 0)
      gd.save.achievements.push('coinall');
    if (S.coinsRun.some(Boolean) && gd.save.achievements.indexOf('coin1') < 0)
      gd.save.achievements.push('coin1');
    gd.saveSave();
  }

  gd.ui = {
    UI, update, handleClick, drawPause, drawComplete, playerColors, palette, paletteCount,
    isModeUnlocked, drawPlayerIcon, drawDeathIcon, startLevel, onLevelComplete,
    SHOP_ITEMS, ACHIEVEMENTS, MODE_KEYS, drawLock,
    draw(ctx) {
      UI.buttons.length = 0;
      UI.hover = null;
      const S = gd.game.S;
      if (S.active) return;    // in-level HUD handled by game.js
      switch (UI.screen) {
        case 'menu': drawMenu(ctx); break;
        case 'levels': drawLevels(ctx); break;
        case 'info': drawInfo(ctx); break;
        case 'kit': drawKit(ctx); break;
        case 'shop': drawShop(ctx); break;
        case 'settings': drawSettings(ctx); break;
        case 'stats': drawStats(ctx); break;
        case 'creator': drawCreator(ctx); break;
        case 'editor': gd.editor && gd.editor.draw(ctx); break;
        default: drawMenu(ctx);
      }
    }
  };
})(window.gd);

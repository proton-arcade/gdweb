/* ============================================================
   textures.js - every sprite in the game is drawn procedurally
   at boot into offscreen canvases, in a chunky vector style
   inspired by Geometry Dash.  Nothing is downloaded: no ripped
   sprite sheets, no copyrighted art.
   ============================================================ */
window.gd = window.gd || {};

(function (gd) {
  'use strict';
  const U = gd.util, C = gd.C, B = C.B;
  const TEX = Object.create(null);

  /* helper: make an offscreen canvas */
  function mk(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    draw(x, c.width, c.height);
    return c;
  }

  function glow(x, color, blur) { x.shadowColor = color; x.shadowBlur = blur; }
  function noGlow(x) { x.shadowBlur = 0; x.shadowColor = 'transparent'; }

  /* ------------------------------------------------------------
     BLOCKS
     ------------------------------------------------------------ */
  function drawBlock(x, w, h, base, opts) {
    opts = opts || {};
    const light = U.shade(base, .30), dark = U.shade(base, -.38);
    // body
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, U.shade(base, .16));
    g.addColorStop(.55, base);
    g.addColorStop(1, dark);
    x.fillStyle = g;
    U.rr(x, 1, 1, w - 2, h - 2, 3); x.fill();

    // inner recessed square (the classic GD block look)
    const pad = Math.round(Math.min(w, h) * 0.16);
    x.save();
    U.rr(x, pad, pad, w - pad * 2, h - pad * 2, 3);
    const g2 = x.createLinearGradient(0, pad, 0, h - pad);
    g2.addColorStop(0, U.shade(base, -.12));
    g2.addColorStop(1, U.shade(base, -.42));
    x.fillStyle = g2; x.fill();
    x.strokeStyle = U.withAlpha('#000', .35); x.lineWidth = 1.5; x.stroke();
    x.restore();

    // top-left bevel highlight
    x.strokeStyle = light; x.lineWidth = 2;
    x.beginPath();
    x.moveTo(2.5, h - 4); x.lineTo(2.5, 2.5); x.lineTo(w - 4, 2.5);
    x.stroke();
    // bottom-right shadow bevel
    x.strokeStyle = U.shade(base, -.55); x.lineWidth = 2;
    x.beginPath();
    x.moveTo(w - 2.5, 5); x.lineTo(w - 2.5, h - 2.5); x.lineTo(5, h - 2.5);
    x.stroke();

    // outer white-ish outline
    x.strokeStyle = U.withAlpha('#ffffff', opts.outline === false ? 0 : .55);
    x.lineWidth = 1.4;
    U.rr(x, .8, .8, w - 1.6, h - 1.6, 3.5); x.stroke();
  }

  function drawBlockDetail(x, w, h, base, variant) {
    const light = U.shade(base, .45), dark = U.shade(base, -.5);
    x.save();
    x.lineWidth = 2;
    switch (variant % 4) {
      case 0: break;
      case 1: // cross brace
        x.strokeStyle = U.withAlpha(light, .5);
        x.beginPath(); x.moveTo(w * .2, h * .8); x.lineTo(w * .8, h * .2);
        x.moveTo(w * .8, h * .8); x.lineTo(w * .2, h * .2); x.stroke();
        break;
      case 2: // centre diamond
        x.strokeStyle = U.withAlpha(light, .6);
        x.beginPath();
        x.moveTo(w / 2, h * .24); x.lineTo(w * .76, h / 2);
        x.lineTo(w / 2, h * .76); x.lineTo(w * .24, h / 2); x.closePath(); x.stroke();
        break;
      case 3: // rivets
        x.fillStyle = U.withAlpha(light, .55);
        [[.22, .22], [.78, .22], [.22, .78], [.78, .78]].forEach(p => {
          x.beginPath(); x.arc(w * p[0], h * p[1], 2.1, 0, 7); x.fill();
        });
        break;
    }
    x.restore();
  }

  /* ------------------------------------------------------------
     SPIKES  ------------------------------------------------------------ */
  function drawSpike(x, w, h, base, up) {
    const light = U.shade(base, .38), dark = U.shade(base, -.45);
    x.save();
    if (!up) { x.translate(0, h); x.scale(1, -1); }
    x.beginPath();
    x.moveTo(w * .5, h * .03);
    x.lineTo(w * .96, h * .99);
    x.lineTo(w * .04, h * .99);
    x.closePath();
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, light); g.addColorStop(.5, base); g.addColorStop(1, dark);
    x.fillStyle = g; x.fill();
    x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#000', .8); x.lineWidth = 2.4; x.stroke();
    // bright left facet
    x.beginPath();
    x.moveTo(w * .5, h * .06); x.lineTo(w * .17, h * .95); x.lineTo(w * .42, h * .95); x.closePath();
    x.fillStyle = U.withAlpha('#ffffff', .22); x.fill();
    // rim light
    x.beginPath();
    x.moveTo(w * .5, h * .05); x.lineTo(w * .88, h * .92);
    x.strokeStyle = U.withAlpha('#fff', .35); x.lineWidth = 1.6; x.stroke();
    x.restore();
  }

  /* ------------------------------------------------------------
     SAW BLADE  ------------------------------------------------------------ */
  function drawSaw(x, w, h, base, teeth, inner) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 1;
    teeth = teeth || 12;
    x.save();
    x.translate(cx, cy);
    // teeth ring
    x.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + .5) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      x.lineTo(Math.cos(a0) * R * .80, Math.sin(a0) * R * .80);
      x.lineTo(Math.cos(a1) * R * 1.00, Math.sin(a1) * R * 1.00);
      x.lineTo(Math.cos(a2) * R * .80, Math.sin(a2) * R * .80);
    }
    x.closePath();
    const g = x.createRadialGradient(0, 0, R * .15, 0, 0, R);
    g.addColorStop(0, U.shade(base, .35));
    g.addColorStop(.6, base);
    g.addColorStop(1, U.shade(base, -.45));
    x.fillStyle = g; x.fill();
    x.strokeStyle = U.withAlpha('#000', .75); x.lineWidth = 2; x.stroke();

    // hub
    const ir = inner === undefined ? R * .46 : inner;
    x.beginPath(); x.arc(0, 0, ir, 0, 7);
    x.fillStyle = U.shade(base, -.55); x.fill();
    x.strokeStyle = U.withAlpha('#fff', .30); x.lineWidth = 2; x.stroke();
    // spokes
    x.strokeStyle = U.withAlpha('#000', .45); x.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      x.beginPath();
      x.moveTo(Math.cos(a) * ir * .35, Math.sin(a) * ir * .35);
      x.lineTo(Math.cos(a) * R * .74, Math.sin(a) * R * .74);
      x.stroke();
    }
    x.beginPath(); x.arc(0, 0, ir * .30, 0, 7);
    x.fillStyle = U.shade(base, .5); x.fill();
    x.restore();
  }

  /* ------------------------------------------------------------
     PADS  ------------------------------------------------------------ */
  function drawPad(x, w, h, color, dir) {
    x.save();
    x.translate(w / 2, h);
    if (dir < 0) x.scale(1, -1);
    const R = w * .48;
    glow(x, color, 14);
    // base plate
    x.beginPath();
    x.ellipse(0, -h * .22, R, h * .34, 0, Math.PI, 0);
    const g = x.createLinearGradient(0, -h, 0, 0);
    g.addColorStop(0, U.shade(color, .55));
    g.addColorStop(1, color);
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.strokeStyle = U.withAlpha('#000', .6); x.lineWidth = 1.8; x.stroke();
    // chevrons
    x.fillStyle = U.withAlpha('#ffffff', .92);
    for (let i = 0; i < 2; i++) {
      const yy = -h * (.48 + i * .28), s = R * (.46 - i * .10);
      x.beginPath();
      x.moveTo(-s, yy); x.lineTo(0, yy - s * .8); x.lineTo(s, yy);
      x.lineTo(s * .55, yy); x.lineTo(0, yy - s * .42); x.lineTo(-s * .55, yy);
      x.closePath(); x.fill();
    }
    x.restore();
  }

  /* ------------------------------------------------------------
     ORBS  ------------------------------------------------------------ */
  function drawOrb(x, w, h, color, kind) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 1;
    x.save();
    glow(x, color, 16);
    // outer ring
    x.beginPath(); x.arc(cx, cy, R, 0, 7);
    const g = x.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R);
    g.addColorStop(0, U.shade(color, .6));
    g.addColorStop(.55, color);
    g.addColorStop(1, U.shade(color, -.4));
    x.fillStyle = g; x.fill();
    x.lineWidth = 2.4; x.strokeStyle = U.withAlpha('#000', .65); x.stroke();
    noGlow(x);
    x.beginPath(); x.arc(cx, cy, R * .78, 0, 7);
    x.strokeStyle = U.withAlpha('#fff', .55); x.lineWidth = 2; x.stroke();

    x.fillStyle = U.withAlpha('#ffffff', .95);
    if (kind === 'ring') {
      x.beginPath(); x.arc(cx, cy, R * .62, 0, 7);
      x.strokeStyle = U.withAlpha('#fff', .95); x.lineWidth = R * .22; x.stroke();
    } else if (kind === 'dash') {
      const s = R * .55;
      x.beginPath();
      x.moveTo(cx - s, cy - s * .5); x.lineTo(cx + s * .35, cy - s * .5);
      x.lineTo(cx + s * .35, cy - s); x.lineTo(cx + s, cy);
      x.lineTo(cx + s * .35, cy + s); x.lineTo(cx + s * .35, cy + s * .5);
      x.lineTo(cx - s, cy + s * .5); x.closePath(); x.fill();
    } else {
      const s = R * .42;
      x.beginPath();
      x.moveTo(cx - s, cy + s * .1); x.lineTo(cx - s * .15, cy - s);
      x.lineTo(cx + s, cy + s * .1); x.lineTo(cx + s * .35, cy + s * .1);
      x.lineTo(cx - s * .15, cy - s * .4); x.lineTo(cx - s * .55, cy + s * .1);
      x.closePath(); x.fill();
    }
    // specular
    x.beginPath(); x.ellipse(cx - R * .28, cy - R * .35, R * .26, R * .16, -.6, 0, 7);
    x.fillStyle = U.withAlpha('#fff', .5); x.fill();
    x.restore();
  }

  /* ------------------------------------------------------------
     PORTALS  ------------------------------------------------------------ */
  function drawPortal(x, w, h, color, inner) {
    const cx = w / 2, cy = h / 2;
    const rx = w / 2 - 2, ry = h / 2 - 2;
    x.save();
    // outer glow field
    const gg = x.createRadialGradient(cx, cy, ry * .2, cx, cy, ry * 1.05);
    gg.addColorStop(0, U.withAlpha(color, .55));
    gg.addColorStop(.7, U.withAlpha(color, .18));
    gg.addColorStop(1, U.withAlpha(color, 0));
    x.fillStyle = gg;
    x.beginPath(); x.ellipse(cx, cy, rx * 1.15, ry * 1.05, 0, 0, 7); x.fill();

    glow(x, color, 18);
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7);
    x.lineWidth = w * .16;
    x.strokeStyle = color; x.stroke();
    noGlow(x);
    x.beginPath(); x.ellipse(cx, cy, rx * .96, ry * .985, 0, 0, 7);
    x.lineWidth = 2; x.strokeStyle = U.withAlpha('#fff', .8); x.stroke();
    x.beginPath(); x.ellipse(cx, cy, rx * .78, ry * .93, 0, 0, 7);
    x.lineWidth = 2; x.strokeStyle = U.withAlpha('#000', .35); x.stroke();

    if (inner) {
      x.save();
      x.translate(cx, cy);
      const s = Math.min(rx, ry) * .58;
      x.fillStyle = U.withAlpha('#fff', .95);
      x.strokeStyle = U.withAlpha('#000', .5); x.lineWidth = 1.6;
      inner(x, s);
      x.restore();
    }
    x.restore();
  }

  function chevrons(x, s, n, dir) {
    x.beginPath();
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * s * .55;
      x.moveTo(-s * .55, o + s * .28 * dir);
      x.lineTo(0, o - s * .28 * dir);
      x.lineTo(s * .55, o + s * .28 * dir);
    }
    x.lineWidth = s * .22; x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#fff', .95); x.stroke();
    x.lineCap = 'butt';
  }

  /* ------------------------------------------------------------
     COIN  ------------------------------------------------------------ */
  function drawCoin(x, w, h, secret) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 1.5;
    x.save();
    const base = secret ? '#b06bff' : '#ffcf33';
    glow(x, base, 18);
    x.beginPath(); x.arc(cx, cy, R, 0, 7);
    const g = x.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R);
    g.addColorStop(0, '#fff8d0'); g.addColorStop(.45, base); g.addColorStop(1, U.shade(base, -.5));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.lineWidth = 2.6; x.strokeStyle = U.withAlpha('#000', .7); x.stroke();
    x.beginPath(); x.arc(cx, cy, R * .74, 0, 7);
    x.lineWidth = 2; x.strokeStyle = U.withAlpha('#fff', .5); x.stroke();
    // star / S
    x.fillStyle = secret ? '#2b0a4d' : '#7a4a00';
    if (secret) {
      U.drawText(x, 'S', cx, cy + 1, { size: R * 1.25, fill: '#3a0f66', stroke: 1.5, strokeColor: '#fff' });
    } else {
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const r = i % 2 ? R * .30 : R * .62;
        x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      x.closePath();
      x.fillStyle = '#8a5a00'; x.fill();
      x.strokeStyle = U.withAlpha('#fff', .55); x.lineWidth = 1.4; x.stroke();
    }
    x.beginPath(); x.ellipse(cx - R * .3, cy - R * .38, R * .28, R * .16, -.6, 0, 7);
    x.fillStyle = U.withAlpha('#fff', .65); x.fill();
    x.restore();
  }

  /* ------------------------------------------------------------
     GROUND / BACKGROUND pieces
     ------------------------------------------------------------ */
  function drawGroundTile(x, w, h, base, line) {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, U.shade(base, -.25));
    g.addColorStop(.14, U.shade(base, -.45));
    g.addColorStop(1, U.shade(base, -.68));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // subtle diagonal weave
    x.save();
    x.globalAlpha = .06; x.strokeStyle = '#fff'; x.lineWidth = 1;
    for (let i = -h; i < w; i += 12) {
      x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke();
    }
    x.restore();
    // grid
    x.strokeStyle = U.withAlpha('#000', .30); x.lineWidth = 1.5;
    for (let i = 0; i <= w; i += B) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (let j = 0; j <= h; j += B) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
    x.strokeStyle = U.withAlpha('#fff', .07); x.lineWidth = 1;
    for (let i = 1; i < w / B; i++) { x.beginPath(); x.moveTo(i * B + 2, 2); x.lineTo(i * B + 2, h); x.stroke(); }
    // bright top edge
    const lg = x.createLinearGradient(0, 0, 0, 7);
    lg.addColorStop(0, line || '#ffffff');
    lg.addColorStop(1, U.withAlpha(line || '#ffffff', 0));
    x.fillStyle = lg; x.fillRect(0, 0, w, 7);
  }

  function drawGroundSpikeStrip(x, w, h, color) {
    x.save();
    x.fillStyle = U.shade(color, -.55);
    const step = B / 2;
    for (let i = 0; i < w; i += step) {
      x.beginPath();
      x.moveTo(i, h); x.lineTo(i + step / 2, h * .25); x.lineTo(i + step, h);
      x.closePath(); x.fill();
    }
    x.strokeStyle = U.withAlpha('#000', .5); x.lineWidth = 1.4;
    for (let i = 0; i < w; i += step) {
      x.beginPath();
      x.moveTo(i, h); x.lineTo(i + step / 2, h * .25); x.lineTo(i + step, h);
      x.stroke();
    }
    x.restore();
  }

  /* ============================================================
     PLAYER ICONS
     Every icon is drawn at exactly one block (B x B) so the
     game can scale it by the current player size.
     ============================================================ */
  function iconFrame(x, w, h, p1, p2, glowCol, radius) {
    // glow halo
    if (glowCol) {
      glow(x, glowCol, 12);
      U.rr(x, 1.5, 1.5, w - 3, h - 3, radius || 5);
      x.fillStyle = U.withAlpha(glowCol, .35); x.fill();
      noGlow(x);
    }
    // body
    const g = x.createLinearGradient(0, 0, w * .3, h);
    g.addColorStop(0, U.shade(p1, .22));
    g.addColorStop(.5, p1);
    g.addColorStop(1, U.shade(p1, -.22));
    U.rr(x, 1.5, 1.5, w - 3, h - 3, radius || 5);
    x.fillStyle = g; x.fill();
    x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#000', .85); x.lineWidth = 2.2; x.stroke();
    x.strokeStyle = U.withAlpha('#fff', .18); x.lineWidth = 1;
    U.rr(x, 3, 3, w - 6, h - 6, (radius || 5) - 1); x.stroke();
    return { x: 1.5, y: 1.5, w: w - 3, h: h - 3 };
  }

  /* ---- cube faces (variants) ---- */
  const CUBE_FACES = [
    function face0(x, b, p2) {           // two square eyes + mouth
      x.fillStyle = p2;
      x.fillRect(b.x + b.w * .20, b.y + b.h * .26, b.w * .20, b.h * .20);
      x.fillRect(b.x + b.w * .60, b.y + b.h * .26, b.w * .20, b.h * .20);
      x.fillRect(b.x + b.w * .28, b.y + b.h * .62, b.w * .44, b.h * .12);
      x.fillStyle = U.withAlpha('#000', .55);
      x.fillRect(b.x + b.w * .24, b.y + b.h * .30, b.w * .10, b.h * .12);
      x.fillRect(b.x + b.w * .64, b.y + b.h * .30, b.w * .10, b.h * .12);
    },
    function face1(x, b, p2) {           // single visor
      x.fillStyle = p2;
      U.rr(x, b.x + b.w * .16, b.y + b.h * .30, b.w * .68, b.h * .22, 4); x.fill();
      x.fillStyle = U.withAlpha('#fff', .5);
      x.fillRect(b.x + b.w * .20, b.y + b.h * .33, b.w * .18, b.h * .06);
      x.fillStyle = p2;
      x.fillRect(b.x + b.w * .34, b.y + b.h * .66, b.w * .32, b.h * .09);
    },
    function face2(x, b, p2) {           // angry eyes
      x.fillStyle = p2;
      x.beginPath();
      x.moveTo(b.x + b.w * .14, b.y + b.h * .24); x.lineTo(b.x + b.w * .44, b.y + b.h * .38);
      x.lineTo(b.x + b.w * .14, b.y + b.h * .46); x.closePath(); x.fill();
      x.beginPath();
      x.moveTo(b.x + b.w * .86, b.y + b.h * .24); x.lineTo(b.x + b.w * .56, b.y + b.h * .38);
      x.lineTo(b.x + b.w * .86, b.y + b.h * .46); x.closePath(); x.fill();
      x.fillRect(b.x + b.w * .30, b.y + b.h * .64, b.w * .40, b.h * .12);
    },
    function face3(x, b, p2) {           // cross / plus
      x.fillStyle = p2;
      x.fillRect(b.x + b.w * .42, b.y + b.h * .18, b.w * .16, b.h * .64);
      x.fillRect(b.x + b.w * .18, b.y + b.h * .42, b.w * .64, b.h * .16);
    },
    function face4(x, b, p2) {           // round eyes + smile
      x.fillStyle = p2;
      x.beginPath(); x.arc(b.x + b.w * .32, b.y + b.h * .36, b.w * .10, 0, 7); x.fill();
      x.beginPath(); x.arc(b.x + b.w * .68, b.y + b.h * .36, b.w * .10, 0, 7); x.fill();
      x.beginPath(); x.arc(b.x + b.w * .5, b.y + b.h * .58, b.w * .22, .25, Math.PI - .25);
      x.lineWidth = b.w * .09; x.strokeStyle = p2; x.stroke();
    },
    function face5(x, b, p2) {           // diagonal stripes
      x.save(); x.beginPath(); U.rr(x, b.x, b.y, b.w, b.h, 4); x.clip();
      x.strokeStyle = p2; x.lineWidth = b.w * .13;
      for (let i = -2; i < 6; i++) {
        x.beginPath();
        x.moveTo(b.x + i * b.w * .25, b.y + b.h); x.lineTo(b.x + i * b.w * .25 + b.h, b.y);
        x.stroke();
      }
      x.restore();
    },
    function face6(x, b, p2) {           // concentric squares
      for (let i = 0; i < 3; i++) {
        const p = .18 + i * .17;
        x.strokeStyle = i % 2 ? U.shade(p2, .3) : p2;
        x.lineWidth = b.w * .055;
        U.rr(x, b.x + b.w * p, b.y + b.h * p, b.w * (1 - p * 2), b.h * (1 - p * 2), 3); x.stroke();
      }
    },
    function face7(x, b, p2) {           // star
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = b.w * .34;
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .45 : R;
        x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      x.closePath(); x.fillStyle = p2; x.fill();
      x.strokeStyle = U.withAlpha('#000', .35); x.lineWidth = 1.2; x.stroke();
    },
    function face8(x, b, p2) {           // arrow head
      x.fillStyle = p2;
      x.beginPath();
      x.moveTo(b.x + b.w * .22, b.y + b.h * .30); x.lineTo(b.x + b.w * .78, b.y + b.h * .50);
      x.lineTo(b.x + b.w * .22, b.y + b.h * .70); x.closePath(); x.fill();
    },
    function face9(x, b, p2) {           // circuit
      x.strokeStyle = p2; x.lineWidth = b.w * .06;
      x.beginPath();
      x.moveTo(b.x + b.w * .2, b.y + b.h * .5); x.lineTo(b.x + b.w * .4, b.y + b.h * .5);
      x.lineTo(b.x + b.w * .5, b.y + b.h * .3); x.lineTo(b.x + b.w * .8, b.y + b.h * .3);
      x.moveTo(b.x + b.w * .5, b.y + b.h * .7); x.lineTo(b.x + b.w * .8, b.y + b.h * .7);
      x.stroke();
      x.fillStyle = p2;
      x.beginPath(); x.arc(b.x + b.w * .2, b.y + b.h * .5, b.w * .07, 0, 7); x.fill();
      x.beginPath(); x.arc(b.x + b.w * .8, b.y + b.h * .3, b.w * .07, 0, 7); x.fill();
      x.beginPath(); x.arc(b.x + b.w * .8, b.y + b.h * .7, b.w * .07, 0, 7); x.fill();
    }
  ];

  function drawCube(x, w, h, p1, p2, gc, variant) {
    const b = iconFrame(x, w, h, p1, p2, gc, 6);
    x.save();
    U.rr(x, b.x, b.y, b.w, b.h, 6); x.clip();
    (CUBE_FACES[variant % CUBE_FACES.length])(x, b, p2);
    // inner border
    U.rr(x, b.x + b.w * .10, b.y + b.h * .10, b.w * .8, b.h * .8, 4);
    x.strokeStyle = U.withAlpha(p2, .55); x.lineWidth = 1.6; x.stroke();
    x.restore();
    // top specular
    x.save();
    U.rr(x, b.x, b.y, b.w, b.h, 6); x.clip();
    const sp = x.createLinearGradient(0, b.y, 0, b.y + b.h * .4);
    sp.addColorStop(0, U.withAlpha('#fff', .28)); sp.addColorStop(1, U.withAlpha('#fff', 0));
    x.fillStyle = sp; x.fillRect(b.x, b.y, b.w, b.h * .45);
    x.restore();
  }

  function drawShip(x, w, h, p1, p2, gc, variant) {
    x.save();
    if (gc) { glow(x, gc, 10); }
    const hh = h * .62, top = h * .19;
    // hull
    x.beginPath();
    x.moveTo(w * .04, top + hh);
    x.lineTo(w * .04, top + hh * .45);
    x.quadraticCurveTo(w * .30, top - hh * .12, w * .70, top + hh * .12);
    x.lineTo(w * .97, top + hh * .55);
    x.lineTo(w * .97, top + hh);
    x.closePath();
    const g = x.createLinearGradient(0, top, 0, top + hh);
    g.addColorStop(0, U.shade(p1, .3)); g.addColorStop(.5, p1); g.addColorStop(1, U.shade(p1, -.35));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#000', .85); x.lineWidth = 2.1; x.stroke();

    // cockpit dome
    x.beginPath();
    x.ellipse(w * .52, top + hh * .30, w * .19, hh * .30, 0, Math.PI, 0);
    x.closePath();
    const dg = x.createLinearGradient(0, top - hh * .1, 0, top + hh * .5);
    dg.addColorStop(0, U.shade(p2, .55)); dg.addColorStop(1, p2);
    x.fillStyle = dg; x.fill();
    x.strokeStyle = U.withAlpha('#000', .6); x.lineWidth = 1.6; x.stroke();
    x.beginPath(); x.ellipse(w * .46, top + hh * .18, w * .07, hh * .10, -.4, 0, 7);
    x.fillStyle = U.withAlpha('#fff', .55); x.fill();

    // fins / detail by variant
    x.fillStyle = p2;
    x.strokeStyle = U.withAlpha('#000', .55); x.lineWidth = 1.5;
    if (variant % 3 === 0) {
      x.beginPath();
      x.moveTo(w * .06, top + hh * .55); x.lineTo(w * .26, top - hh * .05);
      x.lineTo(w * .30, top + hh * .55); x.closePath(); x.fill(); x.stroke();
    } else if (variant % 3 === 1) {
      x.beginPath();
      x.moveTo(w * .70, top + hh); x.lineTo(w * .84, top + hh * 1.35);
      x.lineTo(w * .95, top + hh); x.closePath(); x.fill(); x.stroke();
    } else {
      x.fillRect(w * .10, top + hh * .62, w * .30, hh * .16); x.strokeRect(w * .10, top + hh * .62, w * .30, hh * .16);
    }
    // engine
    x.beginPath();
    U.rr(x, w * .02, top + hh * .55, w * .10, hh * .40, 2);
    x.fillStyle = U.shade(p1, -.5); x.fill();
    x.restore();
  }

  function drawShipFlame(x, px, py, w, h, gc, t) {
    x.save();
    x.translate(px + w, py);
    const len = w * (1.25 + Math.sin(t * 40) * .18);
    const g = x.createLinearGradient(0, 0, -len, 0);
    g.addColorStop(0, U.withAlpha(gc || '#ffd45e', .95));
    g.addColorStop(.45, U.withAlpha(gc || '#ff9b2f', .55));
    g.addColorStop(1, U.withAlpha(gc || '#ff5a2f', 0));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -h * .34); x.lineTo(-len, 0); x.lineTo(0, h * .34); x.closePath();
    x.fill();
    x.restore();
  }

  function drawBall(x, w, h, p1, p2, gc, variant) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 1.6;
    x.save();
    if (gc) glow(x, gc, 12);
    x.beginPath(); x.arc(cx, cy, R, 0, 7);
    const g = x.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
    g.addColorStop(0, U.shade(p1, .35)); g.addColorStop(.6, p1); g.addColorStop(1, U.shade(p1, -.4));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.lineWidth = 2.2; x.strokeStyle = U.withAlpha('#000', .85); x.stroke();
    x.save();
    x.beginPath(); x.arc(cx, cy, R - .8, 0, 7); x.clip();
    x.fillStyle = p2;
    if (variant % 3 === 0) {
      x.fillRect(cx - R, cy - R * .22, R * 2, R * .44);
      x.fillRect(cx - R * .22, cy - R, R * .44, R * 2);
    } else if (variant % 3 === 1) {
      x.beginPath(); x.arc(cx, cy, R * .55, 0, 7); x.fill();
      x.fillStyle = p1; x.beginPath(); x.arc(cx, cy, R * .3, 0, 7); x.fill();
    } else {
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        x.beginPath();
        x.moveTo(cx, cy);
        x.arc(cx, cy, R, a - .45, a + .45);
        x.closePath(); x.fill();
      }
    }
    x.restore();
    x.beginPath(); x.ellipse(cx - R * .32, cy - R * .38, R * .30, R * .18, -.6, 0, 7);
    x.fillStyle = U.withAlpha('#fff', .45); x.fill();
    x.restore();
  }

  function drawUfo(x, w, h, p1, p2, gc, variant) {
    x.save();
    if (gc) glow(x, gc, 10);
    // dome
    x.beginPath();
    x.ellipse(w * .5, h * .48, w * .21, h * .26, 0, Math.PI, 0);
    x.closePath();
    const dg = x.createLinearGradient(0, h * .18, 0, h * .5);
    dg.addColorStop(0, U.shade(p2, .6)); dg.addColorStop(1, p2);
    x.fillStyle = dg; x.fill();
    x.strokeStyle = U.withAlpha('#000', .7); x.lineWidth = 1.8; x.stroke();
    // saucer
    x.beginPath();
    x.moveTo(w * .06, h * .52);
    x.quadraticCurveTo(w * .5, h * .34, w * .94, h * .52);
    x.quadraticCurveTo(w * .78, h * .74, w * .5, h * .74);
    x.quadraticCurveTo(w * .22, h * .74, w * .06, h * .52);
    x.closePath();
    const g = x.createLinearGradient(0, h * .34, 0, h * .74);
    g.addColorStop(0, U.shade(p1, .35)); g.addColorStop(.5, p1); g.addColorStop(1, U.shade(p1, -.4));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#000', .85); x.lineWidth = 2.1; x.stroke();
    // lights
    for (let i = 0; i < 3 + (variant % 3); i++) {
      const t = (i + .5) / (3 + (variant % 3));
      x.beginPath(); x.arc(w * (.22 + t * .56), h * .63, w * .045, 0, 7);
      x.fillStyle = i % 2 ? U.shade(p2, .4) : '#fff3b0'; x.fill();
      x.strokeStyle = U.withAlpha('#000', .5); x.lineWidth = 1; x.stroke();
    }
    // beam hint
    x.beginPath();
    x.moveTo(w * .34, h * .73); x.lineTo(w * .26, h); x.lineTo(w * .74, h); x.lineTo(w * .66, h * .73);
    x.closePath();
    x.fillStyle = U.withAlpha(gc || p2, .16); x.fill();
    x.restore();
  }

  function drawWave(x, w, h, p1, p2, gc, variant) {
    x.save();
    x.translate(w / 2, h / 2);
    if (gc) glow(x, gc, 14);
    const R = Math.min(w, h) * .30;
    // dart body
    x.beginPath();
    x.moveTo(w * .46, 0);
    x.lineTo(-w * .18, -R);
    x.lineTo(-w * .06, 0);
    x.lineTo(-w * .18, R);
    x.closePath();
    const g = x.createLinearGradient(-w * .2, -R, w * .2, R);
    g.addColorStop(0, U.shade(p1, .4)); g.addColorStop(1, U.shade(p1, -.3));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#000', .85); x.lineWidth = 2; x.stroke();
    // wings
    x.fillStyle = p2;
    x.beginPath();
    x.moveTo(-w * .10, -R * .55); x.lineTo(-w * .38, -R * 1.35); x.lineTo(-w * .20, -R * .25);
    x.closePath(); x.fill(); x.stroke();
    x.beginPath();
    x.moveTo(-w * .10, R * .55); x.lineTo(-w * .38, R * 1.35); x.lineTo(-w * .20, R * .25);
    x.closePath(); x.fill(); x.stroke();
    if (variant % 2) {
      x.beginPath(); x.arc(w * .12, 0, R * .34, 0, 7);
      x.fillStyle = U.withAlpha('#fff', .6); x.fill();
    }
    x.restore();
  }

  function drawWaveTrail(x, px, py, w, h, gc, alpha) {
    x.save();
    const g = x.createLinearGradient(px, 0, px + w, 0);
    g.addColorStop(0, U.withAlpha(gc, 0));
    g.addColorStop(1, U.withAlpha(gc, alpha));
    x.fillStyle = g;
    x.fillRect(px, py + h * .3, w, h * .4);
    x.restore();
  }

  function drawRobot(x, w, h, p1, p2, gc, variant, phase) {
    x.save();
    const headH = h * .44, headY = h * .04;
    if (gc) glow(x, gc, 9);
    // legs
    x.strokeStyle = U.shade(p1, -.45); x.lineWidth = w * .13; x.lineCap = 'round';
    const sw = Math.sin(phase || 0) * w * .16;
    x.beginPath(); x.moveTo(w * .40, headY + headH); x.lineTo(w * .34 + sw, h * .96); x.stroke();
    x.beginPath(); x.moveTo(w * .60, headY + headH); x.lineTo(w * .66 - sw, h * .96); x.stroke();
    x.lineCap = 'butt';
    // head
    U.rr(x, w * .10, headY, w * .80, headH, 5);
    const g = x.createLinearGradient(0, headY, 0, headY + headH);
    g.addColorStop(0, U.shade(p1, .3)); g.addColorStop(1, U.shade(p1, -.25));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.strokeStyle = U.withAlpha('#000', .85); x.lineWidth = 2.1; x.stroke();
    // visor
    U.rr(x, w * .18, headY + headH * .26, w * .64, headH * .42, 3);
    x.fillStyle = p2; x.fill();
    x.strokeStyle = U.withAlpha('#000', .5); x.lineWidth = 1.4; x.stroke();
    x.fillStyle = U.withAlpha('#fff', .45);
    x.fillRect(w * .22, headY + headH * .30, w * .16, headH * .10);
    // antenna
    if (variant % 2) {
      x.strokeStyle = U.shade(p1, -.5); x.lineWidth = 2;
      x.beginPath(); x.moveTo(w * .5, headY); x.lineTo(w * .5, headY - h * .10); x.stroke();
      x.beginPath(); x.arc(w * .5, headY - h * .12, w * .05, 0, 7);
      x.fillStyle = p2; x.fill();
    }
    // body
    U.rr(x, w * .22, headY + headH, w * .56, h * .34, 4);
    x.fillStyle = U.shade(p1, -.18); x.fill();
    x.strokeStyle = U.withAlpha('#000', .7); x.lineWidth = 1.8; x.stroke();
    x.restore();
  }

  function drawSpider(x, w, h, p1, p2, gc, variant) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .27;
    x.save();
    if (gc) glow(x, gc, 11);
    // legs
    x.strokeStyle = U.shade(p1, -.4); x.lineWidth = w * .07; x.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = -.55 + i * .37;
      for (const s of [-1, 1]) {
        x.beginPath();
        x.moveTo(cx + s * R * .5, cy);
        x.lineTo(cx + s * R * 1.9, cy + Math.sin(a) * R * 1.2 - R * .2);
        x.stroke();
      }
    }
    x.lineCap = 'butt';
    // body
    x.beginPath(); x.arc(cx, cy, R, 0, 7);
    const g = x.createRadialGradient(cx - R * .3, cy - R * .4, R * .1, cx, cy, R);
    g.addColorStop(0, U.shade(p1, .35)); g.addColorStop(1, U.shade(p1, -.35));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.strokeStyle = U.withAlpha('#000', .85); x.lineWidth = 2; x.stroke();
    // eyes
    x.fillStyle = p2;
    x.beginPath(); x.ellipse(cx - R * .34, cy - R * .12, R * .22, R * .30, -.2, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx + R * .34, cy - R * .12, R * .22, R * .30, .2, 0, 7); x.fill();
    x.fillStyle = '#111';
    x.beginPath(); x.arc(cx - R * .34, cy - R * .05, R * .09, 0, 7); x.fill();
    x.beginPath(); x.arc(cx + R * .34, cy - R * .05, R * .09, 0, 7); x.fill();
    if (variant % 2) {
      x.strokeStyle = p2; x.lineWidth = 1.6;
      x.beginPath(); x.arc(cx, cy + R * .45, R * .35, .3, Math.PI - .3); x.stroke();
    }
    x.restore();
  }

  function drawSwing(x, w, h, p1, p2, gc, variant) {
    x.save();
    if (gc) glow(x, gc, 10);
    x.beginPath();
    x.moveTo(w * .92, h * .5);
    x.quadraticCurveTo(w * .5, h * .16, w * .08, h * .42);
    x.quadraticCurveTo(w * .42, h * .52, w * .08, h * .62);
    x.quadraticCurveTo(w * .5, h * .86, w * .92, h * .5);
    x.closePath();
    const g = x.createLinearGradient(0, h * .2, 0, h * .8);
    g.addColorStop(0, U.shade(p1, .35)); g.addColorStop(1, U.shade(p1, -.3));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#000', .85); x.lineWidth = 2; x.stroke();
    x.beginPath(); x.ellipse(w * .62, h * .48, w * .13, h * .13, 0, 0, 7);
    x.fillStyle = p2; x.fill();
    x.strokeStyle = U.withAlpha('#000', .5); x.lineWidth = 1.4; x.stroke();
    if (variant % 2) {
      x.strokeStyle = U.withAlpha('#fff', .4); x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(w * .2, h * .5); x.lineTo(w * .8, h * .5); x.stroke();
    }
    x.restore();
  }

  function drawDeathEffect(x, w, h, p1, p2, gc) {
    x.save();
    x.translate(w / 2, h / 2);
    glow(x, gc || p1, 14);
    x.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const r1 = w * .48, r2 = w * .20;
      x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      x.lineTo(Math.cos(a + Math.PI / 12) * r2, Math.sin(a + Math.PI / 12) * r2);
    }
    x.closePath();
    x.fillStyle = p1; x.fill();
    noGlow(x);
    x.strokeStyle = U.withAlpha('#000', .6); x.lineWidth = 1.6; x.stroke();
    x.restore();
  }

  /* ============================================================
     UI CHROME
     ============================================================ */
  function drawButton(x, w, h, base, state) {
    const lift = state === 'down' ? 2 : 0;
    const top = U.shade(base, state === 'hover' ? .30 : .16);
    const bot = U.shade(base, -.42);
    x.save();
    // drop shadow
    x.fillStyle = 'rgba(0,0,0,.45)';
    U.rr(x, 2, 5 + lift, w - 4, h - 6, 8); x.fill();
    // body
    const g = x.createLinearGradient(0, lift, 0, h + lift);
    g.addColorStop(0, top); g.addColorStop(.5, base); g.addColorStop(1, bot);
    U.rr(x, 1.5, 1.5 + lift, w - 3, h - 4, 8);
    x.fillStyle = g; x.fill();
    x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#000', .8); x.lineWidth = 2.4; x.stroke();
    x.strokeStyle = U.withAlpha('#fff', .30); x.lineWidth = 1.4;
    U.rr(x, 3.4, 3.4 + lift, w - 6.8, h - 8, 6); x.stroke();
    // glossy top
    x.save();
    U.rr(x, 1.5, 1.5 + lift, w - 3, h - 4, 8); x.clip();
    const sp = x.createLinearGradient(0, lift, 0, h * .55 + lift);
    sp.addColorStop(0, U.withAlpha('#fff', .30)); sp.addColorStop(1, U.withAlpha('#fff', 0));
    x.fillStyle = sp; x.fillRect(0, lift, w, h * .55);
    x.restore();
    x.restore();
  }

  function drawPanel(x, w, h, base, alpha) {
    x.save();
    x.fillStyle = 'rgba(0,0,0,.45)';
    U.rr(x, 5, 8, w - 6, h - 6, 14); x.fill();
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, U.withAlpha(U.shade(base, .18).replace('rgb(', '').length ? base : base, alpha || 1));
    g.addColorStop(1, U.withAlpha(base, alpha || 1));
    U.rr(x, 2, 2, w - 4, h - 6, 14);
    const gg = x.createLinearGradient(0, 0, 0, h);
    gg.addColorStop(0, U.shade(base, .22)); gg.addColorStop(1, U.shade(base, -.22));
    x.globalAlpha = alpha === undefined ? 1 : alpha;
    x.fillStyle = gg; x.fill();
    x.globalAlpha = 1;
    x.lineJoin = 'round';
    x.strokeStyle = U.withAlpha('#000', .85); x.lineWidth = 3; x.stroke();
    x.strokeStyle = U.withAlpha('#fff', .28); x.lineWidth = 1.6;
    U.rr(x, 5, 5, w - 10, h - 13, 11); x.stroke();
    x.restore();
  }

  function drawScroll(x, w, h, color) {
    x.save();
    U.rr(x, 0, 0, w, h, w / 2);
    x.fillStyle = U.withAlpha('#000', .4); x.fill();
    x.strokeStyle = U.withAlpha('#fff', .25); x.lineWidth = 1.4; x.stroke();
    U.rr(x, 2, 2, w - 4, h - 4, (w - 4) / 2);
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, U.shade(color, .3)); g.addColorStop(1, U.shade(color, -.2));
    x.fillStyle = g; x.fill();
    x.restore();
  }

  /* difficulty face icon */
  function drawFace(x, w, h, kind, color) {
    x.save();
    x.translate(w / 2, h / 2);
    const R = Math.min(w, h) / 2 - 1;
    glow(x, color, 10);
    x.beginPath(); x.arc(0, 0, R, 0, 7);
    const g = x.createRadialGradient(-R * .3, -R * .4, R * .1, 0, 0, R);
    g.addColorStop(0, U.shade(color, .45)); g.addColorStop(1, U.shade(color, -.25));
    x.fillStyle = g; x.fill();
    noGlow(x);
    x.lineWidth = 2.2; x.strokeStyle = U.withAlpha('#000', .8); x.stroke();

    x.fillStyle = '#141428'; x.strokeStyle = '#141428';
    const ex = R * .34, ey = -R * .16, er = R * .13;
    if (kind === 'auto') {
      x.lineWidth = R * .12; x.beginPath(); x.arc(0, R * .06, R * .38, .2, Math.PI - .2); x.stroke();
      x.beginPath(); x.arc(-ex, ey, er, 0, 7); x.fill();
      x.beginPath(); x.arc(ex, ey, er, 0, 7); x.fill();
    } else if (kind === 'easy') {
      x.beginPath(); x.arc(-ex, ey, er * 1.15, 0, 7); x.fill();
      x.beginPath(); x.arc(ex, ey, er * 1.15, 0, 7); x.fill();
      x.lineWidth = R * .13; x.lineCap = 'round';
      x.beginPath(); x.arc(0, R * .12, R * .40, .25, Math.PI - .25); x.stroke();
      x.lineCap = 'butt';
    } else if (kind === 'normal') {
      x.fillRect(-ex - er, ey - er, er * 2, er * 2);
      x.fillRect(ex - er, ey - er, er * 2, er * 2);
      x.lineWidth = R * .12; x.lineCap = 'round';
      x.beginPath(); x.moveTo(-R * .3, R * .38); x.lineTo(R * .3, R * .38); x.stroke();
      x.lineCap = 'butt';
    } else if (kind === 'hard' || kind === 'harder') {
      x.beginPath(); x.arc(-ex, ey, er * 1.1, 0, 7); x.fill();
      x.beginPath(); x.arc(ex, ey, er * 1.1, 0, 7); x.fill();
      x.lineWidth = R * .14; x.lineCap = 'round';
      const tilt = kind === 'harder' ? R * .22 : R * .14;
      x.beginPath(); x.moveTo(-ex - er * 1.6, ey - er * 1.5 - tilt); x.lineTo(-ex + er * 1.5, ey - er * 1.4); x.stroke();
      x.beginPath(); x.moveTo(ex + er * 1.6, ey - er * 1.5 - tilt); x.lineTo(ex - er * 1.5, ey - er * 1.4); x.stroke();
      x.beginPath(); x.arc(0, R * .58, R * .30, Math.PI + .35, -.35); x.stroke();
      x.lineCap = 'butt';
    } else if (kind === 'insane') {
      x.beginPath(); x.arc(-ex, ey, er * 1.15, 0, 7); x.fill();
      x.beginPath(); x.arc(ex, ey, er * 1.15, 0, 7); x.fill();
      x.lineWidth = R * .15; x.lineCap = 'round';
      x.beginPath(); x.moveTo(-R * .58, ey - R * .38); x.lineTo(-R * .10, ey - R * .22); x.stroke();
      x.beginPath(); x.moveTo(R * .58, ey - R * .38); x.lineTo(R * .10, ey - R * .22); x.stroke();
      x.beginPath(); x.moveTo(-R * .30, R * .40); x.lineTo(R * .30, R * .30); x.stroke();
      x.lineCap = 'butt';
    } else { // demon
      x.fillStyle = '#0b0b14';
      x.beginPath();
      x.moveTo(-ex - er * 1.5, ey - er * 1.9); x.lineTo(-ex + er * 1.4, ey - er * .4);
      x.lineTo(-ex - er * 1.5, ey + er * 1.2); x.closePath(); x.fill();
      x.beginPath();
      x.moveTo(ex + er * 1.5, ey - er * 1.9); x.lineTo(ex - er * 1.4, ey - er * .4);
      x.lineTo(ex + er * 1.5, ey + er * 1.2); x.closePath(); x.fill();
      x.fillStyle = kind === 'demon' ? '#ffd23b' : '#fff';
      x.beginPath(); x.arc(-ex, ey + er * .1, er * .45, 0, 7); x.fill();
      x.beginPath(); x.arc(ex, ey + er * .1, er * .45, 0, 7); x.fill();
      x.strokeStyle = '#0b0b14'; x.lineWidth = R * .12; x.lineCap = 'round';
      x.beginPath(); x.moveTo(-R * .34, R * .44); x.lineTo(R * .34, R * .44); x.stroke();
      x.beginPath(); x.moveTo(-R * .18, R * .30); x.lineTo(-R * .18, R * .56); x.stroke();
      x.beginPath(); x.moveTo(R * .18, R * .30); x.lineTo(R * .18, R * .56); x.stroke();
      x.lineCap = 'butt';
    }
    x.restore();
  }

  /* star */
  function drawStar(x, w, h, filled) {
    x.save();
    x.translate(w / 2, h / 2);
    const R = Math.min(w, h) / 2 - 1;
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .44 : R;
      x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
    if (filled) {
      glow(x, '#ffdf5e', 10);
      const g = x.createLinearGradient(0, -R, 0, R);
      g.addColorStop(0, '#fff6c0'); g.addColorStop(.5, '#ffd23b'); g.addColorStop(1, '#e08b00');
      x.fillStyle = g; x.fill();
      noGlow(x);
    } else {
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fill();
    }
    x.lineJoin = 'round';
    x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 2; x.stroke();
    x.restore();
  }

  function drawArrow(x, w, h, dir, color) {
    x.save();
    x.translate(w / 2, h / 2);
    if (dir < 0) x.scale(-1, 1);
    const s = Math.min(w, h) * .34;
    x.beginPath();
    x.moveTo(-s * .55, -s); x.lineTo(s * .6, 0); x.lineTo(-s * .55, s);
    x.lineTo(-s * .55, s * .38); x.lineTo(-s * .05, 0); x.lineTo(-s * .55, -s * .38);
    x.closePath();
    x.fillStyle = color || '#fff';
    glow(x, color || '#fff', 8); x.fill(); noGlow(x);
    x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
    x.restore();
  }

  function drawCheck(x, w, h, on) {
    x.save();
    const s = Math.min(w, h) * .40;
    x.translate(w / 2, h / 2);
    U.rr(x, -s, -s, s * 2, s * 2, 5);
    x.fillStyle = on ? '#3ddc6b' : 'rgba(0,0,0,.5)'; x.fill();
    x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 2.4; x.stroke();
    if (on) {
      x.strokeStyle = '#fff'; x.lineWidth = s * .42; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(-s * .55, 0); x.lineTo(-s * .1, s * .48); x.lineTo(s * .62, -s * .45); x.stroke();
    }
    x.restore();
  }

  function drawSlider(x, w, h, t, color) {
    x.save();
    const ty = h / 2;
    U.rr(x, 4, ty - 5, w - 8, 10, 5);
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1.4; x.stroke();
    U.rr(x, 5, ty - 4, (w - 10) * U.clamp(t, 0, 1), 8, 4);
    const g = x.createLinearGradient(0, ty - 4, 0, ty + 4);
    g.addColorStop(0, U.shade(color, .4)); g.addColorStop(1, U.shade(color, -.2));
    x.fillStyle = g; x.fill();
    const kx = 5 + (w - 10) * U.clamp(t, 0, 1);
    x.beginPath(); x.arc(kx, ty, 11, 0, 7);
    glow(x, color, 10);
    x.fillStyle = '#fff'; x.fill(); noGlow(x);
    x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 2; x.stroke();
    x.restore();
  }

  /* menu background decoration shapes */
  function drawBgShape(x, w, h, color, kind, alpha) {
    x.save();
    x.globalAlpha = alpha;
    x.translate(w / 2, h / 2);
    x.fillStyle = color;
    x.strokeStyle = U.shade(color, .35);
    x.lineWidth = 3;
    if (kind === 0) { // square outline
      U.rr(x, -w * .38, -h * .38, w * .76, h * .76, 6); x.fill(); x.stroke();
      U.rr(x, -w * .24, -h * .24, w * .48, h * .48, 4);
      x.fillStyle = U.shade(color, -.3); x.fill();
    } else if (kind === 1) { // triangle
      x.beginPath(); x.moveTo(0, -h * .42); x.lineTo(w * .40, h * .34); x.lineTo(-w * .40, h * .34);
      x.closePath(); x.fill(); x.stroke();
    } else if (kind === 2) { // ring
      x.beginPath(); x.arc(0, 0, Math.min(w, h) * .38, 0, 7); x.fill(); x.stroke();
      x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.arc(0, 0, Math.min(w, h) * .24, 0, 7); x.fill();
    } else { // cross
      x.fillRect(-w * .12, -h * .40, w * .24, h * .80);
      x.fillRect(-w * .40, -h * .12, w * .80, h * .24);
      x.strokeRect(-w * .12, -h * .40, w * .24, h * .80);
      x.strokeRect(-w * .40, -h * .12, w * .80, h * .24);
    }
    x.restore();
  }

  function drawLogo(x, w, h) {
    x.save();
    const cx = w / 2;
    x.translate(cx, h * .42);
    x.transform(1, 0, -.16, 1, 0, 0);
    const size = h * .46;
    U.drawText(x, 'GEOMETRY', 0, -size * .42, {
      size: size, fill: '#fff', stroke: size * .10, strokeColor: '#12204f',
      gradient: ['#ffffff', '#b9d8ff'], glow: 'rgba(120,190,255,.75)', glowSize: 26
    });
    U.drawText(x, 'DASH', 0, size * .52, {
      size: size * 1.24, fill: '#ffe14d', stroke: size * .11, strokeColor: '#5e2402',
      gradient: ['#fff6b0', '#ffae1f'], glow: 'rgba(255,180,50,.8)', glowSize: 30
    });
    x.restore();
    // underline swoosh
    x.save();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3;
    x.beginPath();
    x.moveTo(w * .16, h * .80); x.quadraticCurveTo(w * .5, h * .92, w * .84, h * .78);
    x.stroke();
    x.restore();
  }

  /* ============================================================
     BUILD ALL TEXTURES
     ============================================================ */
  function build() {
    // blocks in a handful of tintable bases
    const blockBases = ['#3b7ef0', '#f0563b', '#3bf07a', '#f0c93b', '#a24bf0', '#4bd8f0', '#f04bb4', '#e8e8f0', '#2b2b3a'];
    TEX.block = {};
    blockBases.forEach(b => {
      TEX.block[b] = [];
      for (let v = 0; v < 4; v++) {
        TEX.block[b].push(mk(B, B, (x, w, h) => { drawBlock(x, w, h, b); drawBlockDetail(x, w, h, b, v); }));
      }
    });
    TEX.blockBases = blockBases;

    // half / slope pieces
    TEX.slope = {};
    TEX.slopeR = {};
    blockBases.forEach(b => {
      TEX.slope[b] = mk(B, B, (x, w, h) => {
        drawBlock(x, w, h, b);
        x.globalCompositeOperation = 'destination-out';
        x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0); x.lineTo(w, h); x.closePath(); x.fill();
        x.globalCompositeOperation = 'source-over';
      });
      TEX.slopeR[b] = mk(B, B, (x, w, h) => {
        drawBlock(x, w, h, b);
        x.globalCompositeOperation = 'destination-out';
        x.beginPath(); x.moveTo(w, 0); x.lineTo(0, 0); x.lineTo(0, h); x.closePath(); x.fill();
        x.globalCompositeOperation = 'source-over';
      });
    });

    TEX.spike = {};
    TEX.spikeDown = {};
    blockBases.concat(['#ffffff']).forEach(b => {
      TEX.spike[b] = mk(B, B, (x, w, h) => drawSpike(x, w, h, b, true));
      TEX.spikeDown[b] = mk(B, B, (x, w, h) => drawSpike(x, w, h, b, false));
    });
    TEX.spikeSmall = mk(B * .6, B * .6, (x, w, h) => drawSpike(x, w, h, '#ffffff', true));

    TEX.saw = {};
    TEX.sawSmall = {};
    ['#3b7ef0', '#f0563b', '#3bf07a', '#f0c93b', '#a24bf0', '#e8e8f0'].forEach(b => {
      TEX.saw[b] = mk(B * 2.2, B * 2.2, (x, w, h) => drawSaw(x, w, h, b, 14));
      TEX.sawSmall[b] = mk(B * 1.4, B * 1.4, (x, w, h) => drawSaw(x, w, h, b, 10));
    });

    TEX.pad = {};
    const padCols = { yellow: '#ffe14d', pink: '#ff6fb5', blue: '#4bb3ff', red: '#ff4b4b' };
    for (const k in padCols) TEX.pad[k] = mk(B * 1.1, B * .45, (x, w, h) => drawPad(x, w, h, padCols[k], 1));

    const orbCols = { yellow: '#ffe14d', pink: '#ff6fb5', blue: '#4bb3ff', green: '#5ce35c', red: '#ff4b4b', black: '#2b2b3a', purple: '#a24bf0' };
    TEX.orb = {}; TEX.ring = {}; TEX.dash = {};
    for (const k in orbCols) {
      TEX.orb[k] = mk(B * .95, B * .95, (x, w, h) => drawOrb(x, w, h, orbCols[k], 'orb'));
      TEX.ring[k] = mk(B * 1.05, B * 1.05, (x, w, h) => drawOrb(x, w, h, orbCols[k], 'ring'));
      TEX.dash[k] = mk(B * 1.05, B * 1.05, (x, w, h) => drawOrb(x, w, h, orbCols[k], 'dash'));
    }

    TEX.portal = {};
    TEX.portal.speed = {};
    const speedCols = { 0: '#ff6fb5', 1: '#5ce35c', 2: '#ff9f43', 3: '#ff4b4b', 4: '#4bb3ff' };
    for (const s in speedCols) {
      TEX.portal.speed[s] = mk(B * 1.6, B * 3.1, (x, w, h) => drawPortal(x, w, h, speedCols[s], (xx, ss) => chevrons(xx, ss, 1, -1)));
    }
    TEX.portal.mode = {};
    const modeCols = ['#3bf07a', '#f0563b', '#f0c93b', '#a24bf0', '#4bd8f0', '#ff6fb5', '#e8e8f0', '#f04bb4'];
    modeCols.forEach((c, i) => {
      TEX.portal.mode[i] = mk(B * 1.7, B * 3.6, (x, w, h) => drawPortal(x, w, h, c, (xx, ss) => {
        const s = ss * .95;
        xx.save();
        xx.scale(s / (B / 2), s / (B / 2));
        const iconMk = mk(B, B, (ix, iw, ih) => {
          switch (i) {
            case 0: drawCube(ix, iw, ih, '#fff', '#222', null, 0); break;
            case 1: drawShip(ix, iw, ih, '#fff', '#222', null, 0); break;
            case 2: drawBall(ix, iw, ih, '#fff', '#222', null, 0); break;
            case 3: drawUfo(ix, iw, ih, '#fff', '#222', null, 0); break;
            case 4: drawWave(ix, iw, ih, '#fff', '#222', null, 0); break;
            case 5: drawRobot(ix, iw, ih, '#fff', '#222', null, 0, 0); break;
            case 6: drawSpider(ix, iw, ih, '#fff', '#222', null, 0); break;
            case 7: drawSwing(ix, iw, ih, '#fff', '#222', null, 0); break;
          }
        });
        xx.drawImage(iconMk, -B / 2, -B / 2, B, B);
        xx.restore();
      }));
    });
    TEX.portal.gravityDown = mk(B * 1.5, B * 3.2, (x, w, h) => drawPortal(x, w, h, '#4bb3ff', (xx, s) => chevrons(xx, s, 1, 1)));
    TEX.portal.gravityUp = mk(B * 1.5, B * 3.2, (x, w, h) => drawPortal(x, w, h, '#ffe14d', (xx, s) => chevrons(xx, s, 1, -1)));
    TEX.portal.mini = mk(B * 1.3, B * 2.6, (x, w, h) => drawPortal(x, w, h, '#5ce35c', (xx, s) => {
      chevrons(xx, s * .7, 1, 1);
    }));
    TEX.portal.big = mk(B * 1.3, B * 2.6, (x, w, h) => drawPortal(x, w, h, '#ff4b4b', (xx, s) => {
      chevrons(xx, s * .7, 1, -1);
    }));
    TEX.portal.dual = mk(B * 1.3, B * 3.0, (x, w, h) => drawPortal(x, w, h, '#a24bf0', (xx, s) => {
      xx.fillStyle = 'rgba(255,255,255,.92)';
      xx.fillRect(-s * .55, -s * .55, s * .45, s * .45);
      xx.fillRect(s * .10, s * .10, s * .45, s * .45);
      xx.strokeStyle = 'rgba(0,0,0,.5)'; xx.lineWidth = 1.4;
      xx.strokeRect(-s * .55, -s * .55, s * .45, s * .45);
      xx.strokeRect(s * .10, s * .10, s * .45, s * .45);
    }));
    TEX.portal.teleBlue = mk(B * 1.4, B * 3.0, (x, w, h) => drawPortal(x, w, h, '#2f7bff', null));
    TEX.portal.teleOrange = mk(B * 1.4, B * 3.0, (x, w, h) => drawPortal(x, w, h, '#ff8a2f', null));

    TEX.coin = mk(B * 1.15, B * 1.15, (x, w, h) => drawCoin(x, w, h, false));
    TEX.secretCoin = mk(B * 1.15, B * 1.15, (x, w, h) => drawCoin(x, w, h, true));

    TEX.ground = {};
    TEX.groundSpike = {};
    blockBases.concat(['#1c2a63', '#5a2a86', '#2a5a4a']).forEach(b => {
      TEX.ground[b] = mk(B * 4, B * 4, (x, w, h) => drawGroundTile(x, w, h, b));
      TEX.groundSpike[b] = mk(B * 4, B * .7, (x, w, h) => drawGroundSpikeStrip(x, w, h, b));
    });

    TEX.ui = {
      btnBlue:   (w, h, s) => mk(w, h, (x, ww, hh) => drawButton(x, ww, hh, '#2f7bff', s)),
      btnGreen:  (w, h, s) => mk(w, h, (x, ww, hh) => drawButton(x, ww, hh, '#2fbc5a', s)),
      btnOrange: (w, h, s) => mk(w, h, (x, ww, hh) => drawButton(x, ww, hh, '#f08a1f', s)),
      btnRed:    (w, h, s) => mk(w, h, (x, ww, hh) => drawButton(x, ww, hh, '#e0402f', s)),
      btnPurple: (w, h, s) => mk(w, h, (x, ww, hh) => drawButton(x, ww, hh, '#7b3bf0', s)),
      btnGray:   (w, h, s) => mk(w, h, (x, ww, hh) => drawButton(x, ww, hh, '#4a4f6b', s))
    };
    TEX.face = {}; TEX.star = {}; TEX.arrow = {};
    ['auto', 'easy', 'normal', 'hard', 'harder', 'insane', 'demon'].forEach(k => {
      TEX.face[k] = mk(B * 1.5, B * 1.5, (x, w, h) => drawFace(x, w, h, k, C.DIFF[k].face));
    });
    TEX.star.on = mk(26, 26, (x, w, h) => drawStar(x, w, h, true));
    TEX.star.off = mk(26, 26, (x, w, h) => drawStar(x, w, h, false));
    TEX.arrow.r = mk(30, 40, (x, w, h) => drawArrow(x, w, h, 1, '#ffffff'));
    TEX.arrow.l = mk(30, 40, (x, w, h) => drawArrow(x, w, h, -1, '#ffffff'));
    TEX.arrow.d = mk(40, 30, (x, w, h) => { x.translate(0, 0); x.save(); drawArrow(x, w, h, 1, '#fff'); x.restore(); });
    TEX.logo = mk(560, 150, (x, w, h) => drawLogo(x, w, h));
    TEX.bgShape = [];
    ['#3b7ef0', '#f0563b', '#3bf07a', '#f0c93b', '#a24bf0', '#4bd8f0'].forEach((c, i) => {
      for (let k = 0; k < 4; k++) TEX.bgShape.push(mk(120, 120, (x, w, h) => drawBgShape(x, w, h, c, k, .30)));
    });
  }

  /* runtime icon renderer (colours chosen in the icon kit) */
  function icon(kind, p1, p2, gc, variant, size, phase) {
    size = size || B;
    const key = kind + '|' + p1 + '|' + p2 + '|' + gc + '|' + variant + '|' + Math.round(size);
    if (kind === 'robot') {
      // animated -> draw directly each frame; return null to signal that
      return null;
    }
    if (!TEX._iconCache) TEX._iconCache = Object.create(null);
    if (TEX._iconCache[key]) return TEX._iconCache[key];
    let c;
    switch (kind) {
      case 'ship':   c = mk(size, size, (x, w, h) => drawShip(x, w, h, p1, p2, gc, variant)); break;
      case 'ball':   c = mk(size, size, (x, w, h) => drawBall(x, w, h, p1, p2, gc, variant)); break;
      case 'ufo':    c = mk(size, size, (x, w, h) => drawUfo(x, w, h, p1, p2, gc, variant)); break;
      case 'wave':   c = mk(size, size, (x, w, h) => drawWave(x, w, h, p1, p2, gc, variant)); break;
      case 'spider': c = mk(size, size, (x, w, h) => drawSpider(x, w, h, p1, p2, gc, variant)); break;
      case 'swing':  c = mk(size, size, (x, w, h) => drawSwing(x, w, h, p1, p2, gc, variant)); break;
      case 'death':  c = mk(size, size, (x, w, h) => drawDeathEffect(x, w, h, p1, p2, gc)); break;
      default:       c = mk(size, size, (x, w, h) => drawCube(x, w, h, p1, p2, gc, variant)); break;
    }
    TEX._iconCache[key] = c;
    return c;
  }

  function drawRobotIcon(x, px, py, size, p1, p2, gc, variant, phase) {
    x.save();
    x.translate(px - size / 2, py - size / 2);
    drawRobot(x, size, size, p1, p2, gc, variant, phase);
    x.restore();
  }

  /* live helpers used by the UI without caching */
  function button(x, w, h, bx, by, bw, bh, color, state) {
    x.save(); x.translate(bx, by); drawButton(x, bw, bh, color, state); x.restore();
  }

  gd.tex = {
    TEX, build, icon, drawRobotIcon, button,
    drawBlock, drawSpike, drawSaw, drawPad, drawOrb, drawPortal, drawCoin,
    drawCube, drawShip, drawShipFlame, drawBall, drawUfo, drawWave, drawWaveTrail,
    drawRobot, drawSpider, drawSwing, drawDeathEffect,
    drawButton, drawPanel, drawScroll, drawFace, drawStar, drawArrow, drawCheck,
    drawSlider, drawBgShape, drawLogo, mk, CUBE_FACES
  };
})(window.gd);

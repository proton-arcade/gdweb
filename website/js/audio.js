/* ============================================================
   audio.js - WebAudio engine.

   Music is generated note-by-note from the song definitions in
   levels.js (bass / lead / arp / pads / drums), so there are no
   audio files and no copyrighted tracks.  All SFX are synthesised.
   ============================================================ */
window.gd = window.gd || {};

(function (gd) {
  'use strict';
  const U = gd.util;

  let ctx = null;
  let master = null, musicBus = null, sfxBus = null;
  let musicGainNode = null, sfxGainNode = null;
  let noiseBuf = null;
  let started = false;

  /* scheduler state */
  let cur = null;            // { song, step, nextTime, spb16, playing, startCtxTime }
  let lookahead = null;
  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD = 0.18;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    // gentle limiter so stacked square waves do not clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 22; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ctx.destination);

    musicGainNode = ctx.createGain();
    musicGainNode.gain.value = gd.save.settings.music;
    musicBus = ctx.createGain();
    musicBus.connect(musicGainNode); musicGainNode.connect(master);

    sfxGainNode = ctx.createGain();
    sfxGainNode.gain.value = gd.save.settings.sfx;
    sfxBus = ctx.createGain();
    sfxBus.connect(sfxGainNode); sfxGainNode.connect(master);

    // white noise buffer for percussion
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  function setVolumes() {
    if (!ctx) return;
    musicGainNode.gain.setTargetAtTime(gd.save.settings.music, ctx.currentTime, .05);
    sfxGainNode.gain.setTargetAtTime(gd.save.settings.sfx, ctx.currentTime, .05);
  }

  /* ---------------- note helpers ---------------- */
  const KEY_OFFSET = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function rootMidi(song) { return 36 + (KEY_OFFSET[song.key] || 0); }  // low octave root
  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function scaleNote(song, degree, octave) {
    const n = song.scale.length;
    const idx = ((degree % n) + n) % n;
    const oct = Math.floor(degree / n) + (octave || 0);
    return rootMidi(song) + song.scale[idx] - song.scale[0] + oct * 12;
  }

  function env(node, t, a, d, s, r, peak) {
    const g = node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak * s), t + a + d);
    return { holdUntil: t + a + d, release: r, g };
  }

  function tone(dest, type, f0, t, dur, vol, opts) {
    opts = opts || {};
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (opts.f1 && opts.f1 !== f0) {
      if (opts.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t + dur);
      else osc.frequency.setValueAtTime(opts.f1, t + dur * (opts.glideAt || .5));
    }
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, t);

    const g = ctx.createGain();
    const peak = vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * (opts.sustain || .6)), t + (opts.attack || .006) + (opts.decay || dur * .3));
    g.gain.setValueAtTime(Math.max(0.0002, peak * (opts.sustain || .6)), t + dur * .8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (opts.release || .05));

    let node = g;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filterType || 'lowpass';
      f.frequency.setValueAtTime(opts.filter, t);
      if (opts.filterEnd) f.frequency.exponentialRampToValueAtTime(opts.filterEnd, t + dur);
      f.Q.value = opts.q || 1;
      g.connect(f); node = f;
    }
    osc.connect(g);
    node.connect(dest);
    osc.start(t);
    osc.stop(t + dur + (opts.release || .05) + .05);
    return osc;
  }

  function noise(dest, t, dur, vol, opts) {
    opts = opts || {};
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = opts.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'highpass';
    f.frequency.setValueAtTime(opts.freq || 6000, t);
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + dur);
    f.Q.value = opts.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t); src.stop(t + dur + .02);
  }

  /* ---------------- drums ---------------- */
  function kick(t, vol) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + .12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + .24);
    osc.connect(g); g.connect(musicBus);
    osc.start(t); osc.stop(t + .28);
    noise(musicBus, t, .02, vol * .25, { type: 'lowpass', freq: 900 });
  }
  function snare(t, vol) {
    noise(musicBus, t, .16, vol * .7, { type: 'bandpass', freq: 1900, q: 1.1, freqEnd: 900 });
    tone(musicBus, 'triangle', 190, t, .10, vol * .35, { sustain: .2, release: .04 });
  }
  function hat(t, vol, open) {
    noise(musicBus, t, open ? .16 : .045, vol * (open ? .30 : .22), { type: 'highpass', freq: open ? 7000 : 9000 });
  }
  function clap(t, vol) {
    for (let i = 0; i < 3; i++) noise(musicBus, t + i * .012, .07, vol * .4, { type: 'bandpass', freq: 1500, q: 1.6 });
    noise(musicBus, t + .03, .16, vol * .35, { type: 'bandpass', freq: 1300, q: .9 });
  }

  /* ---------------- song scheduler ---------------- */
  function playSong(song, opt) {
    init(); if (!ctx) return;
    opt = opt || {};
    stopSong();
    const spb = 60 / song.bpm;
    cur = {
      song, step: 0, spb16: spb / 4, bars: song.bars,
      nextTime: ctx.currentTime + (opt.delay || 0.08),
      muted: !!opt.muted, vol: opt.vol === undefined ? 1 : opt.vol,
      loop: opt.loop !== false, onEnd: opt.onEnd || null, ended: false,
      startTime: ctx.currentTime
    };
    lookahead = setInterval(schedule, LOOKAHEAD_MS);
    schedule();
  }

  function stopSong() {
    if (lookahead) { clearInterval(lookahead); lookahead = null; }
    cur = null;
  }

  function pauseSong() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }
  function unpauseSong() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function schedule() {
    if (!cur || !ctx) return;
    while (cur.nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const s = cur.song, st = cur.step;
      const totalSteps = cur.bars * 16;
      if (st >= totalSteps) {
        if (cur.loop) { cur.step = 0; }
        else {
          if (!cur.ended) { cur.ended = true; if (cur.onEnd) cur.onEnd(); }
          stopSong();
          return;
        }
      }
      scheduleStep(cur.song, cur.step, cur.nextTime, cur.vol);
      cur.step++;
      cur.nextTime += cur.spb16;
    }
  }

  function scheduleStep(s, step, t, vol) {
    const bar = Math.floor(step / 16), inBar = step % 16;
    const chordIdx = bar % s.chords.length;
    const chord = s.chords[chordIdx];
    const root = rootMidi(s);
    const isFill = (bar % 4 === 3) && inBar >= 12;

    /* ---- drums ---- */
    if (s.drums !== 'none') {
      const soft = s.drums === 'soft';
      const dv = soft ? .5 : 1;
      if (s.drums === 'drive') {
        if (inBar % 4 === 0) kick(t, .85 * dv * vol);
        if (inBar === 6 || inBar === 14) kick(t, .5 * dv * vol);
        if (inBar === 4 || inBar === 12) snare(t, .55 * dv * vol);
        if (inBar % 2 === 1) hat(t, .5 * dv * vol, inBar === 15);
        if (isFill && inBar % 2 === 0) snare(t, .30 * dv * vol);
      } else {
        if (inBar === 0 || inBar === 8 || (inBar === 10 && !soft)) kick(t, (soft ? .55 : .85) * dv * vol);
        if (inBar === 4 || inBar === 12) (soft ? hat(t, .7 * dv * vol, true) : snare(t, .5 * dv * vol));
        if (!soft && inBar % 2 === 0) hat(t, .38 * dv * vol, false);
        if (soft && inBar % 4 === 2) hat(t, .3 * dv * vol, false);
        if (isFill && !soft) snare(t, .22 * dv * vol);
      }
    }

    /* ---- bass ---- */
    const bn = s.bassPat[inBar];
    if (bn !== null && bn !== undefined) {
      const oct = bn >= 12 ? 1 : 0;
      const midi = root + s.scale[((bn + chord[0]) % s.scale.length + s.scale.length) % s.scale.length]
                   + Math.floor((bn + chord[0]) / s.scale.length) * 12 + oct * 12;
      const f = freq(midi);
      tone(musicBus, s.bassWave, f, t, s.spb16 ? 0.16 : 0.16, s.bass * vol, {
        attack: .005, decay: .07, sustain: .55, release: .05,
        filter: Math.min(4000, s.filter * .55), q: 3
      });
    }

    /* ---- arp ---- */
    if (s.arp > 0) {
      const deg = chord[step % chord.length] + (Math.floor(step / chord.length) % 2) * 7;
      const midi = root + 24 + s.scale[((deg % s.scale.length) + s.scale.length) % s.scale.length]
                   + Math.floor(deg / s.scale.length) * 12;
      tone(musicBus, 'square', freq(midi), t, .09, s.arp * vol, {
        attack: .004, decay: .04, sustain: .3, release: .04, filter: s.filter, q: 1
      });
    }

    /* ---- pad on bar starts ---- */
    if (inBar === 0 && s.pad > 0) {
      const dur = (60 / s.bpm) * 4 * .95;
      chord.forEach((deg, i) => {
        const midi = root + 12 + s.scale[((deg % s.scale.length) + s.scale.length) % s.scale.length]
                     + Math.floor(deg / s.scale.length) * 12;
        tone(musicBus, s.padWave, freq(midi), t, dur, s.pad * vol * (i === 0 ? 1 : .7), {
          attack: .18, decay: dur * .4, sustain: .8, release: .35, filter: Math.min(2600, s.filter * .8), q: .7, detune: (i - 1) * 6
        });
      });
    }

    /* ---- lead ---- */
    const ln = s.leadPat[inBar];
    if (ln !== null && ln !== undefined && (bar % 2 === 1 || bar >= s.chords.length)) {
      const deg = chord[0] + ln;
      const midi = root + 12 + s.scale[((deg % s.scale.length) + s.scale.length) % s.scale.length]
                   + Math.floor(deg / s.scale.length) * 12;
      const dur = (60 / s.bpm) / 4 * 1.7;
      tone(musicBus, s.leadWave, freq(midi), t, dur, s.lead * vol, {
        attack: .006, decay: dur * .35, sustain: .45, release: .09, filter: s.filter, q: 2
      });
      // harmony a third up, quieter
      const deg2 = deg + 2;
      const midi2 = root + 12 + s.scale[((deg2 % s.scale.length) + s.scale.length) % s.scale.length]
                    + Math.floor(deg2 / s.scale.length) * 12;
      tone(musicBus, s.leadWave, freq(midi2), t, dur * .8, s.lead * vol * .38, {
        attack: .008, decay: dur * .35, sustain: .35, release: .08, filter: s.filter * .8, q: 1
      });
    }
  }

  function songElapsed() {
    if (!cur || !ctx) return 0;
    return ctx.currentTime - cur.startTime;
  }

  /* ============================================================
     SFX
     ============================================================ */
  function sfx(name, opt) {
    init(); if (!ctx || ctx.state === 'suspended') return;
    opt = opt || {};
    const t = ctx.currentTime + (opt.delay || 0);
    const v = opt.vol === undefined ? 1 : opt.vol;
    switch (name) {
      case 'jump':
        tone(sfxBus, 'square', 620, t, .07, .16 * v, { f1: 940, glide: true, attack: .003, decay: .04, sustain: .3, release: .03, filter: 3200 });
        break;
      case 'land':
        noise(sfxBus, t, .05, .10 * v, { type: 'lowpass', freq: 1200 });
        break;
      case 'pad':
        tone(sfxBus, 'square', 500, t, .16, .20 * v, { f1: 1500, glide: true, attack: .003, decay: .08, sustain: .35, release: .05, filter: 5000 });
        break;
      case 'orb':
        tone(sfxBus, 'triangle', 880, t, .14, .18 * v, { f1: 1760, glide: true, attack: .004, decay: .06, sustain: .4, release: .06, filter: 6000 });
        tone(sfxBus, 'square', 1320, t + .01, .10, .07 * v, { attack: .004, decay: .05, sustain: .2, release: .05, filter: 6000 });
        break;
      case 'ring':
        tone(sfxBus, 'sine', 1200, t, .3, .18 * v, { f1: 2400, glide: true, attack: .005, decay: .15, sustain: .2, release: .14, filter: 8000 });
        break;
      case 'dash':
        noise(sfxBus, t, .22, .16 * v, { type: 'bandpass', freq: 700, freqEnd: 4200, q: 1.2 });
        tone(sfxBus, 'sawtooth', 220, t, .2, .12 * v, { f1: 900, glide: true, attack: .004, decay: .1, sustain: .3, release: .08, filter: 3000 });
        break;
      case 'portal':
        tone(sfxBus, 'sawtooth', 300, t, .28, .16 * v, { f1: 1400, glide: true, attack: .01, decay: .14, sustain: .3, release: .14, filter: 2600, q: 4 });
        tone(sfxBus, 'sine', 150, t, .3, .10 * v, { f1: 700, glide: true, attack: .01, decay: .2, sustain: .2, release: .1 });
        break;
      case 'coin':
        tone(sfxBus, 'square', 1046, t, .09, .17 * v, { attack: .003, decay: .05, sustain: .5, release: .04, filter: 7000 });
        tone(sfxBus, 'square', 1568, t + .075, .22, .17 * v, { attack: .003, decay: .12, sustain: .4, release: .12, filter: 7000 });
        break;
      case 'death':
        noise(sfxBus, t, .45, .30 * v, { type: 'lowpass', freq: 3200, freqEnd: 240, q: 1 });
        tone(sfxBus, 'sawtooth', 420, t, .42, .20 * v, { f1: 55, glide: true, attack: .004, decay: .2, sustain: .25, release: .2, filter: 2200 });
        tone(sfxBus, 'square', 210, t + .02, .3, .10 * v, { f1: 40, glide: true, attack: .004, decay: .15, sustain: .2, release: .14 });
        break;
      case 'checkpoint':
        tone(sfxBus, 'triangle', 660, t, .09, .15 * v, { attack: .003, decay: .05, sustain: .4, release: .05 });
        tone(sfxBus, 'triangle', 990, t + .07, .12, .13 * v, { attack: .003, decay: .06, sustain: .4, release: .06 });
        break;
      case 'click':
        tone(sfxBus, 'square', 760, t, .05, .13 * v, { attack: .002, decay: .03, sustain: .3, release: .02, filter: 4000 });
        break;
      case 'back':
        tone(sfxBus, 'square', 520, t, .07, .13 * v, { f1: 320, glide: true, attack: .002, decay: .04, sustain: .3, release: .03, filter: 4000 });
        break;
      case 'complete': {
        const notes = [523, 659, 784, 1046, 1318];
        notes.forEach((f, i) => {
          tone(sfxBus, 'square', f, t + i * .085, .30, .16 * v, { attack: .004, decay: .12, sustain: .5, release: .16, filter: 7000 });
          tone(sfxBus, 'triangle', f * 2, t + i * .085, .22, .06 * v, { attack: .004, decay: .1, sustain: .4, release: .12 });
        });
        noise(sfxBus, t + .42, .5, .10 * v, { type: 'highpass', freq: 5000 });
        break;
      }
      case 'whoosh':
        noise(sfxBus, t, .28, .12 * v, { type: 'bandpass', freq: 500, freqEnd: 3000, q: .8 });
        break;
      case 'flip':
        tone(sfxBus, 'square', 400, t, .08, .13 * v, { f1: 1000, glide: true, attack: .003, decay: .04, sustain: .3, release: .04, filter: 4000 });
        break;
      case 'deny':
        tone(sfxBus, 'square', 200, t, .12, .13 * v, { f1: 140, glide: true, attack: .003, decay: .06, sustain: .3, release: .05, filter: 1200 });
        break;
      case 'place':
        tone(sfxBus, 'square', 900, t, .04, .10 * v, { attack: .002, decay: .02, sustain: .3, release: .02, filter: 5000 });
        break;
    }
  }

  /* beat pulse value 0..1 used by the renderer */
  function beatPhase() {
    if (!cur || !ctx) return 0;
    const spb = 60 / cur.song.bpm;
    const e = ctx.currentTime - cur.startTime;
    const p = (e % spb) / spb;
    return Math.max(0, 1 - p * 3.2);
  }
  function barPhase() {
    if (!cur || !ctx) return 0;
    const spb = 60 / cur.song.bpm;
    const e = ctx.currentTime - cur.startTime;
    return (e % (spb * 4)) / (spb * 4);
  }
  function isPlaying() { return !!cur && !!lookahead; }
  function currentSong() { return cur ? cur.song : null; }
  function songSeconds() {
    if (!cur || !ctx) return 0;
    const spb = 60 / cur.song.bpm;
    return cur.step * spb / 4;
  }

  gd.audio = {
    init, resume, playSong, stopSong, pauseSong, unpauseSong,
    sfx, setVolumes, beatPhase, barPhase, isPlaying, currentSong, songElapsed, songSeconds,
    get ctx() { return ctx; },
    get ready() { return !!ctx; }
  };
})(window.gd);

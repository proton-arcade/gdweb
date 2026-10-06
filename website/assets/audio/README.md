# Audio

**All music and sound effects in this game are synthesised live with the Web Audio API** by
`website/js/audio.js`. There are no audio files here and no copyrighted tracks are used or
distributed.

## How the music works

Each level picks a song from `gd.levels.SONGS` (in `website/js/levels.js`). A song is a small
data description, not an audio file:

```js
bounce: {
  bpm: 128, bars: 44, key: 'A',
  scale: [57, 59, 60, 62, 64, 65, 67],     // minor scale degrees
  chords: [[0,2,4], [5,0,2], [3,5,0], [4,6,1]],   // one chord per bar
  bassPat: [...],  leadPat: [...],          // 16th-note patterns, null = rest
  arp: 0.07, leadWave: 'square', bassWave: 'sawtooth', drums: 'std'
}
```

`gd.audio.playSong(song)` runs a look-ahead scheduler (25 ms tick, 180 ms horizon) that
converts each 16th note into oscillators: square/triangle/saw leads with a third-above
harmony, a filtered bass, arpeggios, sustained pads and synthesised drums (sine-sweep kick,
band-passed noise snare, high-passed noise hats).

## Sound effects

`gd.audio.sfx(name)` has 17 synthesised effects: `jump, land, pad, orb, ring, dash, portal,
coin, death, checkpoint, click, back, complete, whoosh, flip, deny, place`.

## Swapping in your own music

If you own audio files you may use them instead — put them here and start them yourself:

```js
gd.audio.stopSong();                       // silence the generated track
const el = new Audio('website/assets/audio/my-song.mp3');
el.volume = gd.save.settings.music;
el.play();
```

The beat-reactive background and ground pulse read from `gd.audio.beatPhase()`, so a
replacement track simply means that pulse stops unless you drive it yourself.

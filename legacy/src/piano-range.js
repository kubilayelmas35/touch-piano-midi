/** 88 tuşlu piyano aralığı (A0 – C8) */
const PianoRange = (() => {
  const MIN_MIDI = 21;
  const MAX_MIDI = 108;
  const MIN_START_OCTAVE = 0;
  const MAX_START_OCTAVE = 8;
  const MAX_OCTAVES = 7;

  function startMidiFromOctave(octave) {
    return (Number(octave) + 1) * 12;
  }

  function clampRange(startOctave, octaveCount) {
    let startOct = Number(startOctave);
    let startMidi = startMidiFromOctave(startOct);
    let count = Math.max(1, Math.min(MAX_OCTAVES, Number(octaveCount)));
    let endMidi = startMidi + count * 12 - 1;

    if (startMidi < MIN_MIDI) {
      startMidi = MIN_MIDI;
      endMidi = startMidi + count * 12 - 1;
      startOct = Math.max(MIN_START_OCTAVE, Math.floor(startMidi / 12) - 1);
    }
    if (endMidi > MAX_MIDI) {
      endMidi = MAX_MIDI;
      const maxCount = Math.floor((MAX_MIDI - startMidi + 1) / 12);
      count = Math.max(1, maxCount);
      endMidi = startMidi + count * 12 - 1;
      if (endMidi > MAX_MIDI) endMidi = MAX_MIDI;
    }

    return {
      startOctave: startOct,
      octaveCount: count,
      startMidi,
      endMidi,
    };
  }

  function getStartOctaveOptions() {
    const opts = [];
    for (let o = MIN_START_OCTAVE; o <= MAX_START_OCTAVE; o++) {
      const midi = startMidiFromOctave(o);
      if (midi > MAX_MIDI - 12) continue;
      const name = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midi % 12];
      const label = `Oktav ${o} (${name}${o})`;
      opts.push({ value: o, label });
    }
    return opts;
  }

  /** Şarkı notalarına göre klavye aralığı (C tabanlı tam oktavlar) */
  function fitRangeToNotes(notes, paddingSemitones = 2) {
    if (!notes?.length) return null;
    let minMidi = MAX_MIDI;
    let maxMidi = MIN_MIDI;
    for (const n of notes) {
      minMidi = Math.min(minMidi, n.midi);
      maxMidi = Math.max(maxMidi, n.midi);
    }
    minMidi = Math.max(MIN_MIDI, minMidi - paddingSemitones);
    maxMidi = Math.min(MAX_MIDI, maxMidi + paddingSemitones);

    let startMidi = minMidi;
    while (startMidi > MIN_MIDI && startMidi % 12 !== 0) startMidi--;

    let count = Math.ceil((maxMidi - startMidi + 1) / 12);
    count = Math.max(1, Math.min(MAX_OCTAVES, count));
    const startOctave = Math.floor(startMidi / 12) - 1;
    return clampRange(startOctave, count);
  }

  function getOctaveCountOptions(startOctave) {
    const opts = [];
    const startMidi = Math.max(MIN_MIDI, startMidiFromOctave(startOctave));
    for (let c = 1; c <= MAX_OCTAVES; c++) {
      const end = startMidi + c * 12 - 1;
      if (end > MAX_MIDI) break;
      opts.push({ value: c, label: `${c} oktav` });
    }
    return opts.length ? opts : [{ value: 1, label: "1 oktav" }];
  }

  return {
    MIN_MIDI,
    MAX_MIDI,
    MAX_OCTAVES,
    clampRange,
    startMidiFromOctave,
    getStartOctaveOptions,
    getOctaveCountOptions,
    fitRangeToNotes,
  };
})();

window.PianoRange = PianoRange;

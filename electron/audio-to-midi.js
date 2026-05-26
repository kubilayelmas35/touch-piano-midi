/**
 * MP3/WAV → MIDI (Spotify Basic Pitch)
 * Ana süreçte çalışır; ilerleme callback ile bildirilir.
 */
const path = require("path");
const fs = require("fs");
const { pathToFileURL, fileURLToPath } = require("url");

const TARGET_RATE = 22050;
const MODEL_JSON = path.join(
  path.dirname(require.resolve("@spotify/basic-pitch/package.json")),
  "model",
  "model.json"
);

let basicPitchInstance = null;
let decodeAudio = null;

let fileFetchInstalled = false;

/** Node’da file:// ile TF model yüklemek için */
function installFileFetchPolyfill() {
  if (fileFetchInstalled) return;
  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith("file:")) {
      return originalFetch(input, init);
    }
    const fp = fileURLToPath(url);
    const buf = fs.readFileSync(fp);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const text = buf.toString("utf8");
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => ab,
      json: async () => JSON.parse(text),
    };
  };
  fileFetchInstalled = true;
}

async function getDecode() {
  if (!decodeAudio) {
    const mod = await import("audio-decode");
    decodeAudio = mod.default || mod;
  }
  return decodeAudio;
}

function normalizeDecoded(decoded) {
  if (decoded instanceof Float32Array) {
    return { sampleRate: TARGET_RATE, mono: decoded };
  }
  if (decoded?.channelData?.length) {
    const channels = decoded.channelData;
    const rate = decoded.sampleRate || TARGET_RATE;
    const len = channels[0].length;
    if (channels.length === 1) {
      return { sampleRate: rate, mono: channels[0] };
    }
    const mono = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      let sum = 0;
      for (const ch of channels) sum += ch[i];
      mono[i] = sum / channels.length;
    }
    return { sampleRate: rate, mono };
  }
  if (typeof decoded?.getChannelData === "function") {
    const ch0 = decoded.getChannelData(0);
    if (decoded.numberOfChannels === 1) {
      return { sampleRate: decoded.sampleRate, mono: ch0 };
    }
    const mono = new Float32Array(ch0.length);
    const ch1 = decoded.getChannelData(1);
    for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) * 0.5;
    return { sampleRate: decoded.sampleRate, mono };
  }
  return null;
}

function resample(mono, fromRate, toRate = TARGET_RATE) {
  if (fromRate === toRate) return mono;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(mono.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const idx = Math.floor(src);
    const frac = src - idx;
    const a = mono[idx] ?? 0;
    const b = mono[idx + 1] ?? a;
    out[i] = a * (1 - frac) + b * frac;
  }
  return out;
}

async function getBasicPitch() {
  if (!basicPitchInstance) {
    installFileFetchPolyfill();
    const {
      BasicPitch,
      outputToNotesPoly,
      addPitchBendsToNoteEvents,
      noteFramesToTime,
    } = require("@spotify/basic-pitch");
    const { generateFileData } = require("@spotify/basic-pitch/cjs/toMidi");

    const modelUrl = pathToFileURL(MODEL_JSON).href;
    const bp = new BasicPitch(modelUrl);
    await bp.model;

    basicPitchInstance = {
      bp,
      outputToNotesPoly,
      addPitchBendsToNoteEvents,
      noteFramesToTime,
      generateFileData,
    };
  }
  return basicPitchInstance;
}

/**
 * @param {string} filePath
 * @param {(pct: number, message: string) => void} [onProgress]
 */
async function transcribeAudioFile(filePath, onProgress, options = {}) {
  const maxDurationSec = options.maxDurationSec ?? 360;
  const report = (pct, message) => {
    if (typeof onProgress === "function") onProgress(Math.min(1, Math.max(0, pct)), message);
  };

  report(0.02, "Ses dosyası okunuyor…");
  const buf = fs.readFileSync(filePath);
  const decode = await getDecode();
  const decoded = await decode(buf);
  const audio = normalizeDecoded(decoded);
  if (!audio?.mono?.length) throw new Error("Ses dosyası çözülemedi.");

  report(0.12, "Mono 22.05 kHz'e dönüştürülüyor…");
  const mono = resample(audio.mono, audio.sampleRate, TARGET_RATE);
  const durationSecIn = mono.length / TARGET_RATE;
  if (durationSecIn > maxDurationSec) {
    throw new Error(
      `Ses çok uzun (${Math.round(durationSecIn)} sn). En fazla ${maxDurationSec} saniye desteklenir.`
    );
  }

  report(0.18, "Yapay zeka modeli yükleniyor…");
  const {
    bp,
    outputToNotesPoly,
    addPitchBendsToNoteEvents,
    noteFramesToTime,
    generateFileData,
  } = await getBasicPitch();

  const frames = [];
  const onsets = [];
  const contours = [];

  report(0.22, "Notalar analiz ediliyor (bu biraz sürebilir)…");
  await bp.evaluateModel(
    mono,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p) => report(0.22 + p * 0.65, "Notalar analiz ediliyor…")
  );

  report(0.9, "MIDI oluşturuluyor…");
  let noteEvents = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.5, 0.45, 9)
    )
  );

  noteEvents = mergeTranscribedNotes(noteEvents);

  if (!noteEvents.length) {
    throw new Error(
      "Hiç nota bulunamadı. Tek enstrümanlı veya vokal kayıt deneyin; karmaşık miksler zor olabilir."
    );
  }

  const midiBuffer = generateFileData(noteEvents);
  const durationSec = noteEvents.reduce(
    (max, n) => Math.max(max, n.startTimeSeconds + n.durationSeconds),
    0
  );

  report(1, "Tamamlandı");

  return {
    midiBuffer,
    noteCount: noteEvents.length,
    durationSec,
    sourceName: path.parse(filePath).name,
  };
}

/** Aynı perdeye yakın kısa parçaları tek notada birleştir */
function mergeTranscribedNotes(events) {
  const sorted = [...events].sort(
    (a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi
  );
  const out = [];
  const maxGap = 0.2;
  const minDur = 0.1;

  for (const e of sorted) {
    const last = out[out.length - 1];
    const end = last ? last.startTimeSeconds + last.durationSeconds : 0;
    if (
      last &&
      last.pitchMidi === e.pitchMidi &&
      e.startTimeSeconds - end <= maxGap
    ) {
      const newEnd = Math.max(end, e.startTimeSeconds + e.durationSeconds);
      last.durationSeconds = Math.max(minDur, newEnd - last.startTimeSeconds);
      last.amplitude = Math.max(last.amplitude || 0, e.amplitude || 0);
      continue;
    }
    if ((e.durationSeconds || 0) >= minDur * 0.5) {
      out.push({ ...e });
    }
  }
  let merged = out.filter((n) => n.durationSeconds >= minDur);
  merged = mergeOverlappingEvents(merged);
  return merged;
}

function mergeOverlappingEvents(events) {
  const groups = new Map();
  for (const e of events) {
    if (!groups.has(e.pitchMidi)) groups.set(e.pitchMidi, []);
    groups.get(e.pitchMidi).push(e);
  }
  const out = [];
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    let cur = { ...arr[0] };
    for (let i = 1; i < arr.length; i++) {
      const n = arr[i];
      const end = cur.startTimeSeconds + cur.durationSeconds;
      if (n.startTimeSeconds < end + 0.05) {
        const newEnd = Math.max(end, n.startTimeSeconds + n.durationSeconds);
        cur.durationSeconds = newEnd - cur.startTimeSeconds;
        cur.amplitude = Math.max(cur.amplitude || 0, n.amplitude || 0);
      } else {
        out.push(cur);
        cur = { ...n };
      }
    }
    out.push(cur);
  }
  return out.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

module.exports = { transcribeAudioFile, TARGET_RATE, MODEL_JSON, mergeTranscribedNotes };

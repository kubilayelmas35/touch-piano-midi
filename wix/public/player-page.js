/**
 * Wix sayfa kodu — Piyano sayfası (#pianoHtml = HTML iframe / Embed).
 *
 * Kütüphane + MIDI: sayfa kodunda wix-data (Media webMethod kullanılmaz).
 */
import wixData from "wix-data";
import { currentMember } from "wix-members-frontend";

/** GitHub Pages kök origin — sonunda / olmadan */
const GITHUB_PAGES_ORIGIN = "https://kubilayelmas35.github.io";

const COLLECTION = "UserPianoData";
const MSG_IN = "touch-piano";
const MSG_OUT = "touch-piano-wix";
/** Tek MIDI ~400 KB (base64 dahil) — CMS metin alanı limiti */
const MAX_MIDI_BYTES = 400000;

function pagesOrigin() {
  const o = (GITHUB_PAGES_ORIGIN || "").replace(/\/$/, "");
  return o || "*";
}

function formatCmsError(where, err) {
  const msg = err?.message || String(err);
  if (msg.includes("WDE0027") || msg.includes("WDE0177") || msg.includes("permission")) {
    return `CMS izin hatası (${COLLECTION}). CMS → Permissions → Create/Update: Site member author veya Anyone.`;
  }
  if (msg.includes("WDE0007") || msg.toLowerCase().includes("not found")) {
    return `CMS koleksiyonu bulunamadı: "${COLLECTION}".`;
  }
  return `${where}: ${msg}`;
}

async function requireMemberId() {
  const member = await currentMember.getMember();
  if (!member?._id) {
    throw new Error("Üye girişi gerekli. Wix sitesinde giriş yapıp sayfayı yenileyin.");
  }
  return member._id;
}

async function loadLibraries() {
  const memberId = await requireMemberId();
  const result = await wixData
    .query(COLLECTION)
    .eq("memberId", memberId)
    .limit(1)
    .find();

  if (!result.items.length) {
    return { libraries: [] };
  }

  const row = result.items[0];
  const raw =
    typeof row.librariesJson === "string"
      ? JSON.parse(row.librariesJson)
      : row.librariesJson;

  if (raw && Array.isArray(raw.libraries)) {
    return { libraries: raw.libraries };
  }
  if (Array.isArray(raw)) {
    return { libraries: raw };
  }
  return { libraries: [] };
}

async function saveLibraries(libraries) {
  if (!Array.isArray(libraries)) {
    throw new Error("libraries dizi olmalı");
  }

  const memberId = await requireMemberId();
  const librariesJson = JSON.stringify({ libraries });

  const existing = await wixData
    .query(COLLECTION)
    .eq("memberId", memberId)
    .limit(1)
    .find();

  if (existing.items.length) {
    await wixData.update(COLLECTION, {
      _id: existing.items[0]._id,
      memberId,
      librariesJson,
    });
  } else {
    await wixData.insert(COLLECTION, { memberId, librariesJson });
  }
}

async function deleteSong(payload) {
  const { songId, libraryId, midiUrl } = payload || {};
  const data = await loadLibraries();
  let removed = false;

  for (const lib of data.libraries) {
    if (libraryId && lib.id !== libraryId) continue;
    const before = lib.songs?.length || 0;
    lib.songs = (lib.songs || []).filter((s) => {
      if (songId && s.id === songId) {
        removed = true;
        return false;
      }
      if (midiUrl && s.midiUrl === midiUrl) {
        removed = true;
        return false;
      }
      return true;
    });
    if (lib.songs.length !== before) {
      removed = true;
    }
  }

  if (!removed) {
    throw new Error("Şarkı bulunamadı");
  }

  await saveLibraries(data.libraries);
  return { ok: true };
}

/** MIDI metadata döner; kayıt iframe tarafında importSongs + saveLibraries ile yapılır */
function prepareMidiEntry({ fileName, base64, name }) {
  if (!fileName || !base64) {
    throw new Error("fileName ve base64 gerekli");
  }
  const approxBytes = Math.floor((String(base64).length * 3) / 4);
  if (approxBytes > MAX_MIDI_BYTES) {
    throw new Error(
      `MIDI çok büyük (~${Math.round(approxBytes / 1024)} KB). En fazla ~${Math.round(MAX_MIDI_BYTES / 1024)} KB desteklenir.`
    );
  }
  const safeName = String(fileName).replace(/[<>:"/\\|?*]/g, "_");
  return {
    id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || safeName).replace(/\.(mid|midi)$/i, ""),
    fileName: safeName,
    midiBase64: String(base64),
  };
}

async function sendSession(html) {
  try {
    const member = await currentMember.getMember();
    if (!member?._id) return;
    html.postMessage(
      {
        source: MSG_OUT,
        type: "WIX_SESSION",
        memberId: member._id,
        email: member.loginEmail || "",
      },
      pagesOrigin()
    );
  } catch (e) {
    console.error("sendSession", e);
  }
}

async function handleApi(html, data) {
  const { id, action, payload } = data;
  try {
    let result;
    switch (action) {
      case "pianoGetLibraries":
        result = await loadLibraries();
        break;
      case "pianoSaveLibraries":
        await saveLibraries(payload?.libraries);
        result = { ok: true };
        break;
      case "pianoUploadMidi":
        result = prepareMidiEntry(payload || {});
        break;
      case "pianoDeleteSong":
        result = await deleteSong(payload);
        break;
      default:
        throw new Error(`Bilinmeyen işlem: ${action}`);
    }
    html.postMessage({ source: MSG_OUT, id, result }, pagesOrigin());
  } catch (err) {
    const message = formatCmsError(action, err);
    console.error(`[player-page] ${action}:`, err);
    html.postMessage(
      { source: MSG_OUT, id, error: message },
      pagesOrigin()
    );
  }
}

$w.onReady(() => {
  const html = $w("#pianoHtml");
  if (!html) {
    console.error('Sayfada ID="pianoHtml" olan Embed/HTML bileşeni yok.');
    return;
  }

  html.onMessage(async (event) => {
    const data = event.data;
    if (!data || data.source !== MSG_IN) return;

    if (data.type === "PING") {
      await sendSession(html);
      return;
    }

    if (data.id && data.action) {
      await handleApi(html, data);
    }
  });

  sendSession(html);
});

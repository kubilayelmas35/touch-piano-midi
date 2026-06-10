/**
 * Wix sayfa kodu — Piyano sayfası (#pianoHtml = HTML iframe / Embed).
 *
 * CMS işlemleri backend webMethod ile (suppressAuth).
 */
import { currentMember } from "wix-members-frontend";
import {
  pianoCmsGetLibraries,
  pianoCmsSaveLibraries,
  pianoCmsUploadMidi,
  pianoCmsGetMidi,
  pianoCmsDeleteSong,
} from "backend/pianoMidiCms.web";

/** GitHub Pages kök origin — sonunda / olmadan */
const GITHUB_PAGES_ORIGIN = "https://kubilayelmas35.github.io";

const MSG_IN = "touch-piano";
const MSG_OUT = "touch-piano-wix";

function pagesOrigin() {
  const o = (GITHUB_PAGES_ORIGIN || "").replace(/\/$/, "");
  return o || "*";
}

function formatApiError(where, err) {
  const msg = err?.message || String(err);
  if (msg.includes("WDE0027") || msg.includes("WDE0177") || msg.includes("permission")) {
    return `CMS izin hatası. UserPianoData ve UserPianoMidi için Create/Update açın.`;
  }
  if (msg.includes("WDE0007") || msg.toLowerCase().includes("not found")) {
    return `CMS koleksiyonu bulunamadı. UserPianoData ve UserPianoMidi oluşturun.`;
  }
  if (msg.includes("Üye girişi")) {
    return msg;
  }
  return `${where}: ${msg}`;
}

async function sendSession(html) {
  try {
    let member = null;
    try {
      member = await currentMember.getMember();
    } catch {
      /* misafir */
    }
    html.postMessage(
      {
        source: MSG_OUT,
        type: "WIX_SESSION",
        memberId: member?._id || null,
        email: member?.loginEmail || "",
        isGuest: !member?._id,
      },
      pagesOrigin()
    );
  } catch (e) {
    console.error("sendSession", e);
    html.postMessage(
      {
        source: MSG_OUT,
        type: "WIX_SESSION",
        memberId: null,
        email: "",
        isGuest: true,
      },
      pagesOrigin()
    );
  }
}

async function handleApi(html, data) {
  const { id, action, payload } = data;
  try {
    let result;
    switch (action) {
      case "pianoGetLibraries":
        result = await pianoCmsGetLibraries();
        break;
      case "pianoSaveLibraries":
        await pianoCmsSaveLibraries(payload?.libraries);
        result = { ok: true };
        break;
      case "pianoUploadMidi":
        result = await pianoCmsUploadMidi(payload || {});
        break;
      case "pianoGetMidi":
        result = await pianoCmsGetMidi(payload || {});
        break;
      case "pianoDeleteSong":
        result = await pianoCmsDeleteSong(payload || {});
        break;
      default:
        throw new Error(`Bilinmeyen işlem: ${action}`);
    }
    html.postMessage({ source: MSG_OUT, id, result }, pagesOrigin());
  } catch (err) {
    const message = formatApiError(action, err);
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

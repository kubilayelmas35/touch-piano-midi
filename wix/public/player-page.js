/**
 * Wix sayfa kodu — Piyano sayfası (#pianoHtml = HTML iframe / Embed bileşeni).
 *
 * 1. Site Ayarları → Üyeler: Members açık, kayıt/giriş sayfaları hazır.
 * 2. Bu sayfaya Embed/HTML bileşeni ekleyin, ID: pianoHtml
 * 3. Embed URL: GitHub Pages (ör. https://KULLANICI.github.io/touch-piano-midi/)
 * 4. GITHUB_PAGES_ORIGIN aşağıyı güncelleyin.
 */
import { currentMember } from "wix-members-frontend";
import {
  pianoGetLibraries,
  pianoSaveLibraries,
  pianoUploadMidi,
  pianoDeleteSong,
} from "backend/pianoLibrary.web";

/** GitHub Pages kök origin — sonunda / olmadan */
const GITHUB_PAGES_ORIGIN = "https://KULLANICI.github.io";

const MSG_IN = "touch-piano";
const MSG_OUT = "touch-piano-wix";

function pagesOrigin() {
  const o = (GITHUB_PAGES_ORIGIN || "").replace(/\/$/, "");
  return o || "*";
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
        result = await pianoGetLibraries();
        break;
      case "pianoSaveLibraries":
        result = await pianoSaveLibraries(payload?.libraries);
        break;
      case "pianoUploadMidi":
        result = await pianoUploadMidi(payload);
        break;
      case "pianoDeleteSong":
        result = await pianoDeleteSong(payload);
        break;
      default:
        throw new Error(`Bilinmeyen işlem: ${action}`);
    }
    html.postMessage({ source: MSG_OUT, id, result }, pagesOrigin());
  } catch (err) {
    html.postMessage(
      { source: MSG_OUT, id, error: err.message || String(err) },
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

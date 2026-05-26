const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;
const { transcribeAudioFile } = require("./audio-to-midi");

const MAX_AUDIO_SEC = 360;
const AUDIO_EXT = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "webm", "wma", "opus"];

const DATA_DIR = path.join(app.getPath("userData"), "libraries");
const LIBRARIES_FILE = path.join(app.getPath("userData"), "libraries.json");
const DEMO_LIB_ID = "lib-demo";
const SEED_MIDI = path.join(__dirname, "..", "assets", "bach_846.mid");

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(LIBRARIES_FILE);
  } catch {
    await fsp.writeFile(LIBRARIES_FILE, JSON.stringify({ libraries: [] }, null, 2));
  }
}

async function readLibraries() {
  await ensureDataDir();
  const raw = await fsp.readFile(LIBRARIES_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeLibraries(data) {
  await fsp.writeFile(LIBRARIES_FILE, JSON.stringify(data, null, 2));
}

async function seedDemoLibrary() {
  let data;
  try {
    data = await readLibraries();
  } catch {
    data = { libraries: [] };
  }

  const hasDemo = data.libraries.some((l) => l.id === DEMO_LIB_ID);
  const midiSrc = fs.existsSync(SEED_MIDI)
    ? SEED_MIDI
    : "F:\\İndirilenler\\bach_846.mid";

  if (!fs.existsSync(midiSrc)) {
    console.warn("Demo MIDI bulunamadı:", midiSrc);
    return;
  }

  const destDir = path.join(DATA_DIR, DEMO_LIB_ID);
  await fsp.mkdir(destDir, { recursive: true });
  const destFile = path.join(destDir, "bach_846.mid");
  await fsp.copyFile(midiSrc, destFile);

  const songEntry = {
    id: "song-bach-846",
    name: "bach_846",
    fileName: "bach_846.mid",
    relativePath: `${DEMO_LIB_ID}/bach_846.mid`.replace(/\\/g, "/"),
  };

  if (hasDemo) {
    const lib = data.libraries.find((l) => l.id === DEMO_LIB_ID);
    if (!lib.songs.some((s) => s.fileName === "bach_846.mid")) {
      lib.songs.push(songEntry);
    }
    lib.name = "Demo Kütüphane";
  } else {
    data.libraries.unshift({
      id: DEMO_LIB_ID,
      name: "Demo Kütüphane",
      songs: [songEntry],
      createdAt: new Date().toISOString(),
    });
  }

  await writeLibraries(data);
  console.log("Demo kütüphane hazır:", LIBRARIES_FILE);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    fullscreenable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "src", "index.html"));
  return win;
}

async function runSmokeTest() {
  await ensureDataDir();
  await seedDemoLibrary();
  const win = createWindow();
  await new Promise((resolve) => {
    win.webContents.once("did-finish-load", resolve);
  });
  await new Promise((r) => setTimeout(r, 2000));
  const state = await win.webContents.executeJavaScript(`({
    Piano: !!window.Piano,
    keys: document.querySelectorAll(".piano-keys .key").length,
    libs: window.LibraryStore?.getLibraries?.()?.length ?? 0,
    active: window.LibraryStore?.getActiveLibraryId?.(),
    notes: window.Game?.hasNotes?.(),
    boot: window.__bootStatus || "yok",
    toast: document.getElementById("toast")?.textContent || ""
  })`);
  console.log("SMOKE:", JSON.stringify(state));
  app.exit(state.Piano && state.keys > 10 && state.libs > 0 && state.notes ? 0 : 1);
}

app.whenReady().then(async () => {
  await ensureDataDir();
  await seedDemoLibrary();
  if (process.env.SMOKE_TEST === "1") {
    await runSmokeTest();
    return;
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle("libraries:get", async () => readLibraries());

ipcMain.handle("libraries:save", async (_e, data) => {
  if (!data || !Array.isArray(data.libraries)) {
    throw new Error("Geçersiz kütüphane verisi");
  }
  await writeLibraries(data);
  return true;
});

ipcMain.handle("midi:import", async (event, { libraryId }) => {
  const win = getWindow(event);
  const result = await dialog.showOpenDialog(win, {
    title: "MIDI dosyası seç",
    filters: [{ name: "MIDI", extensions: ["mid", "midi"] }],
    properties: ["openFile", "multiSelections"],
  });
  if (result.canceled || !result.filePaths.length) return [];
  return copyMidiFiles(result.filePaths, libraryId);
});

ipcMain.handle("midi:importPaths", async (_e, { libraryId, paths }) => {
  if (!Array.isArray(paths) || !paths.length) return [];
  return copyMidiFiles(paths, libraryId);
});

function sendAudioProgress(win, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("audio:progress", payload);
  }
}

async function saveMidiToLibrary(libraryId, midiBuffer, baseName) {
  const safeLib = String(libraryId).replace(/[<>:"/\\|?*]/g, "_");
  let destName = `${baseName}.mid`;
  let dest = path.join(DATA_DIR, safeLib, destName);
  let n = 1;
  while (fs.existsSync(dest)) {
    destName = `${baseName}_${n}.mid`;
    dest = path.join(DATA_DIR, safeLib, destName);
    n++;
  }
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.writeFile(dest, midiBuffer);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: baseName,
    fileName: destName,
    relativePath: path.join(safeLib, destName).replace(/\\/g, "/"),
  };
}

ipcMain.handle("audio:import", async (event, { libraryId }) => {
  const win = getWindow(event);
  const result = await dialog.showOpenDialog(win, {
    title: "MP3 / ses dosyası seç (MIDI'ye dönüştürülür)",
    filters: [
      { name: "Ses dosyaları", extensions: AUDIO_EXT },
      { name: "Tüm dosyalar", extensions: ["*"] },
    ],
    properties: ["openFile", "multiSelections"],
  });
  if (result.canceled || !result.filePaths.length) return [];

  const imported = [];
  for (const src of result.filePaths) {
    const fileName = path.basename(src);
    sendAudioProgress(win, { pct: 0, message: "Başlıyor…", file: fileName });

    const { midiBuffer, sourceName, noteCount, durationSec } = await transcribeAudioFile(
      src,
      (pct, message) => sendAudioProgress(win, { pct, message, file: fileName }),
      { maxDurationSec: MAX_AUDIO_SEC }
    );

    const baseName = `${sourceName}_midi`;
    const entry = await saveMidiToLibrary(libraryId, midiBuffer, baseName);
    entry.transcribedFrom = fileName;
    entry.noteCount = noteCount;
    entry.durationSec = durationSec;
    imported.push(entry);
  }

  sendAudioProgress(win, { pct: 1, message: "Bitti", file: "", done: true });
  return imported;
});

async function copyMidiFiles(filePaths, libraryId) {
  const safeLib = String(libraryId).replace(/[<>:"/\\|?*]/g, "_");
  const imported = [];

  for (const src of filePaths) {
    if (!fs.existsSync(src)) continue;
    const base = path.basename(src);
    let destName = base;
    let dest = path.join(DATA_DIR, safeLib, destName);
    let n = 1;
    while (fs.existsSync(dest)) {
      destName = `${path.parse(base).name}_${n}${path.extname(base)}`;
      dest = path.join(DATA_DIR, safeLib, destName);
      n++;
    }
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(src, dest);
    imported.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: path.parse(destName).name,
      fileName: destName,
      relativePath: path.join(safeLib, destName).replace(/\\/g, "/"),
    });
  }
  return imported;
}

ipcMain.handle("midi:read", async (_e, relativePath) => {
  const safe = relativePath.replace(/\.\./g, "");
  const full = path.join(DATA_DIR, safe);
  const buf = await fsp.readFile(full);
  return Array.from(new Uint8Array(buf));
});

ipcMain.handle("midi:delete", async (_e, relativePath) => {
  const safe = relativePath.replace(/\.\./g, "");
  const full = path.join(DATA_DIR, safe);
  await fsp.unlink(full);
  return true;
});

ipcMain.handle("window:toggleFullscreen", async (event) => {
  const win = getWindow(event);
  if (!win) return false;
  const next = !win.isFullScreen();
  win.setFullScreen(next);
  return next;
});

ipcMain.handle("window:isFullscreen", async (event) => {
  const win = getWindow(event);
  return win ? win.isFullScreen() : false;
});

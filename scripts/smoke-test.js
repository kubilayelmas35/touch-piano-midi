const { app, BrowserWindow } = require("electron");
const path = require("path");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const logs = [];
  win.webContents.on("console-message", (_e, level, msg) => {
    logs.push({ level, msg });
  });

  await win.loadFile(path.join(__dirname, "..", "src", "index.html"));
  await new Promise((r) => setTimeout(r, 2500));

  const state = await win.webContents.executeJavaScript(`({
    mainJsOk: !!window.mainJsOk,
    pianoApi: !!window.pianoApi,
    Piano: !!window.Piano,
    Game: !!window.Game,
    LibraryStore: !!window.LibraryStore,
    keyCount: document.querySelectorAll(".piano-keys .key").length,
    libCount: window.LibraryStore ? window.LibraryStore.getLibraries().length : -1,
    activeLib: window.LibraryStore ? window.LibraryStore.getActiveLibraryId() : null,
    songCount: document.querySelectorAll("#songList li:not(.hint)").length,
    toast: document.getElementById("toast")?.textContent,
    apiError: !document.getElementById("apiError")?.classList.contains("hidden"),
    playDisabled: document.getElementById("btnPlay")?.disabled
  })`);

  console.log("STATE:", JSON.stringify(state, null, 2));
  const errors = logs.filter((l) => l.level >= 2);
  if (errors.length) {
    console.log("CONSOLE ERRORS:");
    errors.forEach((e) => console.log(" ", e.msg));
  }

  app.exit(state.Piano && state.keyCount > 0 && state.libCount > 0 ? 0 : 1);
});

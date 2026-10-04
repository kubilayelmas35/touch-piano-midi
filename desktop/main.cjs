// Sonatrio desktop app (Windows / macOS / Linux, Steam build). Serves the built web app from app://sonatrio/.
const { app, BrowserWindow, protocol, net, ipcMain, shell, session, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { initSteam } = require("./steam.cjs");

const WEB_ROOT = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..", "docs");
const HOST = "sonatrio";
const BOUNDS_FILE = path.join(app.getPath("userData"), "window.json");

// Steam has to hook in before the app is ready (overlay needs GPU flags).
const steam = initSteam();

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

// sonatrio:// links bring Google/Apple sign-in back from the system browser.
const LINK_SCHEME = "sonatrio";
if (process.defaultApp) app.setAsDefaultProtocolClient(LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
else app.setAsDefaultProtocolClient(LINK_SCHEME);
const findLink = (argv) => argv.find((a) => a.startsWith(`${LINK_SCHEME}://`)) ?? null;
let pendingLink = findLink(process.argv);

function deliverLink(url) {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    pendingLink = url;
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  win.webContents.send("desktop:link", url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const link = findLink(argv);
    if (link) return deliverLink(link);
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.on("open-url", (e, url) => {
    e.preventDefault();
    deliverLink(url);
  });
}

function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(BOUNDS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveBounds(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(BOUNDS_FILE, JSON.stringify({ ...b, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }));
  } catch {
    /* read-only profile: start with defaults next time */
  }
}

function serveApp() {
  protocol.handle("app", (req) => {
    const url = new URL(req.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = path.normalize(path.join(WEB_ROOT, rel));
    if (!file.startsWith(WEB_ROOT)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function allowDevices() {
  const allowed = new Set(["midi", "midiSysex", "fullscreen", "clipboard-sanitized-write"]);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
}

function createWindow() {
  const saved = loadBounds();
  const win = new BrowserWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 800,
    x: saved?.x,
    y: saved?.y,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: "#0a0d1f",
    title: "Sonatrio",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      // Keep note timing steady when the window is in the background (playing along to the metronome).
      backgroundThrottling: false,
      additionalArguments: [`--sonatrio-steam=${steam.active ? 1 : 0}`, `--sonatrio-version=${app.getVersion()}`],
    },
  });
  if (saved?.maximized) win.maximize();
  if (saved?.fullscreen) win.setFullScreen(true);
  win.once("ready-to-show", () => win.show());
  win.on("close", () => saveBounds(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(`app://${HOST}/`)) {
      e.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11" || (input.alt && input.key === "Enter")) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (!app.isPackaged && input.control && input.shift && input.key.toLowerCase() === "i") {
      win.webContents.toggleDevTools();
    }
  });

  void win.loadURL(`app://${HOST}/index.html`);
  return win;
}

ipcMain.handle("desktop:fullscreen", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return false;
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});
ipcMain.handle("desktop:isFullscreen", (e) => BrowserWindow.fromWebContents(e.sender)?.isFullScreen() ?? false);
ipcMain.handle("desktop:achievement", (_e, id) => steam.unlock(String(id)));
ipcMain.handle("desktop:takeLink", () => {
  const link = pendingLink;
  pendingLink = null;
  return link;
});
ipcMain.on("desktop:quit", () => app.quit());

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  serveApp();
  allowDevices();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

const { contextBridge, ipcRenderer } = require("electron");

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? "";

contextBridge.exposeInMainWorld("sonatrioDesktop", {
  platform: process.platform,
  version: arg("sonatrio-version"),
  steam: arg("sonatrio-steam") === "1",
  toggleFullscreen: () => ipcRenderer.invoke("desktop:fullscreen"),
  isFullscreen: () => ipcRenderer.invoke("desktop:isFullscreen"),
  unlockAchievement: (id) => ipcRenderer.invoke("desktop:achievement", id),
  onLink: (cb) => {
    ipcRenderer.on("desktop:link", (_e, url) => cb(url));
    void ipcRenderer.invoke("desktop:takeLink").then((url) => url && cb(url));
  },
  quit: () => ipcRenderer.send("desktop:quit"),
});

// Steamworks bridge: achievements and the in-game overlay when the app is started from Steam.
// Stays inactive (and the app works normally) without Steam or without an App ID.
const fs = require("node:fs");
const path = require("node:path");

function readAppId() {
  if (process.env.SONATRIO_STEAM_APP_ID) return Number(process.env.SONATRIO_STEAM_APP_ID);
  const candidates = [
    path.join(path.dirname(process.execPath), "steam_appid.txt"),
    path.join(__dirname, "steam_appid.txt"),
  ];
  for (const file of candidates) {
    try {
      const id = Number(fs.readFileSync(file, "utf8").trim());
      if (id > 0) return id;
    } catch {
      /* not there */
    }
  }
  return 0;
}

function initSteam() {
  const off = { active: false, unlock: async () => false };
  const appId = readAppId();
  if (!appId) return off;
  let steamworks;
  try {
    steamworks = require("steamworks.js");
  } catch (e) {
    console.warn("[steam] steamworks.js unavailable:", e?.message);
    return off;
  }
  let client;
  try {
    client = steamworks.init(appId);
    steamworks.electronEnableSteamOverlay();
  } catch (e) {
    // Steam not running or the user doesn't own the app.
    console.warn("[steam] init failed:", e?.message);
    return off;
  }
  console.log("[steam] ready for", client.localplayer.getName());
  return {
    active: true,
    async unlock(id) {
      try {
        if (client.achievement.isActivated(id)) return true;
        return client.achievement.activate(id);
      } catch {
        return false;
      }
    },
  };
}

module.exports = { initSteam };

// After `cap sync ios`: drop packaged mp4s from the iOS bundle.
// In-app playback uses https://sonatrio.com (Capacitor's local bridge can't Range-serve large mp4).
// Promo also must stay out (ends on a Google Play card — App Review).
import { readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../ios/App/App/public/videos/", import.meta.url));
for (const name of readdirSync(dir)) {
  if (name.endsWith(".mp4")) rmSync(dir + name);
}

// After `cap sync ios`: the promo video isn't offered in the iOS app (it ends on a Google Play card), so it stays out
// of the package. The tutorial ships with the app and plays offline.
import { readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../ios/App/App/public/videos/", import.meta.url));
for (const name of readdirSync(dir)) {
  if (name.startsWith("promo-")) rmSync(dir + name);
}

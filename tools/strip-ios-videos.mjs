// After `cap sync ios`: the tutorial and promo videos are streamed from sonatrio.com, so they stay out of the app package.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

rmSync(fileURLToPath(new URL("../ios/App/App/public/videos/", import.meta.url)), { recursive: true, force: true });

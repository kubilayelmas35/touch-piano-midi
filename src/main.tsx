import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installErrorReporting } from "./lib/errors";
import { platform } from "./lib/platform";
import { installTouchGuard } from "./lib/touchGuard";
import "./styles.css";

installErrorReporting();
installTouchGuard();
// Before the first paint, so the edge-to-edge layout doesn't jump in after launch.
if (platform === "ios") document.documentElement.classList.add("ios-app");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

import { supabase } from "../auth/account";
import { useApp } from "../state/store";
import { platform } from "./platform";

export type ErrorKind = "crash" | "error" | "promise";

const MAX_PER_SESSION = 10;
const seen = new Set<string>();

/** Browser noise that says nothing about the app: extensions, cross-origin scripts, flaky networks. */
const IGNORED = [
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/i,
  /AbortError|The operation was aborted|The user aborted a request/i,
  /play\(\) (request|failed)|NotAllowedError/i,
];

function describe(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack ?? "" };
  if (typeof error === "string") return { message: error, stack: "" };
  try {
    return { message: JSON.stringify(error) ?? String(error), stack: "" };
  } catch {
    return { message: String(error), stack: "" };
  }
}

/** Sends a first-party error log; repeats and noise are dropped, and nothing leaves dev builds. */
export function reportError(kind: ErrorKind, error: unknown): void {
  if (!supabase || import.meta.env.DEV) return;
  const { message, stack } = describe(error);
  if (!message || IGNORED.some((re) => re.test(message))) return;
  if (/chrome-extension:|moz-extension:|safari-extension:/.test(stack)) return;
  const key = `${kind}|${message}`;
  if (seen.has(key) || seen.size >= MAX_PER_SESSION) return;
  seen.add(key);
  void supabase
    .rpc("log_error", {
      p_kind: kind,
      p_message: message.slice(0, 500),
      p_stack: stack.slice(0, 4000) || null,
      p_url: location.pathname.slice(0, 200),
      p_app_version: __APP_VERSION__,
      p_platform: platform,
      p_language: useApp.getState().settings.language,
      p_device: `${navigator.userAgent} · ${screen.width}x${screen.height}`.slice(0, 300),
    })
    .then(({ error: e }) => e && console.warn("[errors] not sent", e.message));
}

export function installErrorReporting(): void {
  window.addEventListener("error", (e) => {
    if (e.error || e.message) reportError("error", e.error ?? e.message);
  });
  window.addEventListener("unhandledrejection", (e) => reportError("promise", e.reason));
}

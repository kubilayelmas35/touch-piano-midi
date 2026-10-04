import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setPanel, toast, useApp } from "../state/store";
import { SITE_URL, desktop, isApp, isNativeApp } from "../lib/platform";
import { tNow } from "../i18n";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null until the project keys are configured; accounts and the Pro gate stay off without it. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } }) : null;

/** Store pages for buying Pro; empty until the apps are published. */
export const STORE_LINKS = {
  googlePlay: "",
  appStore: "",
};

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,24}$/;

/** Where Google/Apple return to inside the packaged apps; must be in Supabase's redirect URL allow list. */
const APP_CALLBACK = isNativeApp ? "com.sonatrio.app://auth" : "sonatrio://auth";

function redirectUrl(): string {
  return isApp ? SITE_URL : window.location.origin + window.location.pathname;
}

async function loadProfile(userId: string, email: string | null): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase
    .from("profiles")
    .select("username, pro, cloud, cloud_quota_mb, is_admin")
    .eq("id", userId)
    .maybeSingle();
  const hadCloud = useApp.getState().account.cloud;
  useApp.setState((s) => ({
    account: {
      ...s.account,
      status: "signedIn",
      email,
      username: (data?.username as string | null) ?? null,
      pro: data?.pro === true,
      cloud: data?.cloud === true,
      cloudQuotaMb: Number(data?.cloud_quota_mb ?? 0),
      isAdmin: data?.is_admin === true,
    },
  }));
  if (data?.cloud === true && !hadCloud) void import("./cloud").then((m) => m.syncCloud({ quiet: true }));
}

async function loadProviders(): Promise<void> {
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } });
    const ext = (await res.json())?.external ?? {};
    useApp.setState((s) => ({ account: { ...s.account, providers: { google: ext.google === true, apple: ext.apple === true } } }));
  } catch {
    /* offline: keep the buttons hidden */
  }
}

export async function initAuth(): Promise<void> {
  if (!supabase) return;
  useApp.setState((s) => ({ account: { ...s.account, status: "loading" } }));
  void loadProviders();
  if (isApp) void listenForAppSignIn();
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      useApp.setState((s) => ({ account: { ...s.account, recovery: true } }));
      setPanel("account");
    }
    const user = session?.user;
    if (user) {
      // Defer: Supabase forbids awaiting other calls inside this callback.
      window.setTimeout(() => void loadProfile(user.id, user.email ?? null), 0);
    } else {
      useApp.setState((s) => ({
        account: { ...s.account, status: "signedOut", email: null, username: null, pro: false, cloud: false, cloudQuotaMb: 0, isAdmin: false, recovery: false },
        cloudIds: [],
        cloudBytes: 0,
        panel: s.panel === "admin" ? null : s.panel,
      }));
    }
  });
  const { data } = await supabase.auth.getSession();
  if (!data.session) useApp.setState((s) => ({ account: { ...s.account, status: "signedOut" } }));
}

/** Whether importing MIDI files is allowed (always, when accounts aren't configured). */
export function canImport(): boolean {
  if (!supabase) return true;
  const a = useApp.getState().account;
  return a.pro || a.cloud;
}

export async function refreshAccount(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (data.user) await loadProfile(data.user.id, data.user.email ?? null);
}

export type AuthResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(error: unknown): AuthResult {
  const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : String(error);
  return { ok: false, error: msg };
}

export async function signInWithPassword(identifier: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const id = identifier.trim();
  if (id.includes("@")) {
    const { error } = await supabase.auth.signInWithPassword({ email: id, password });
    return error ? fail(error) : { ok: true };
  }
  // Username login runs server-side so the account's e-mail is never revealed.
  const { data, error } = await supabase.functions.invoke("username-login", { body: { username: id, password } });
  if (error) return fail(error);
  if (!data?.access_token) return fail(data?.error ?? "invalid");
  const { error: setErr } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  return setErr ? fail(setErr) : { ok: true };
}

export async function usernameAvailable(username: string): Promise<boolean> {
  if (!supabase) return true;
  const { data, error } = await supabase.rpc("username_available", { name: username });
  return !error && data === true;
}

export async function signUp(email: string, password: string, username: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username: username.trim() }, emailRedirectTo: redirectUrl() },
  });
  if (error) return fail(error);
  return { ok: true, message: data.session ? undefined : "confirm" };
}

export async function signInWithProvider(provider: "google" | "apple"): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  if (!isApp) {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl() } });
    return error ? fail(error) : { ok: true };
  }
  // Google refuses sign-in inside an embedded WebView, so it runs in the system browser and comes back via APP_CALLBACK.
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: APP_CALLBACK, skipBrowserRedirect: true } });
  if (error || !data.url) return fail(error ?? "no url");
  if (isNativeApp) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url });
  } else {
    window.open(data.url, "_blank");
  }
  return { ok: true, message: "browser" };
}

/** Completes Google/Apple sign-in when the browser hands the result back to the app. */
async function finishAppSignIn(link: string): Promise<void> {
  if (!supabase || !link.startsWith(APP_CALLBACK)) return;
  if (isNativeApp) void import("@capacitor/browser").then(({ Browser }) => Browser.close()).catch(() => {});
  const u = new URL(link);
  const params = new URLSearchParams(u.search || u.hash.slice(1));
  const code = params.get("code");
  const failure = params.get("error_description") ?? params.get("error");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) toast(error.message, "error");
    else {
      toast(tNow("welcomeBack"), "success");
      setPanel(null);
    }
  } else if (failure) {
    toast(failure, "error");
  }
}

async function listenForAppSignIn(): Promise<void> {
  if (isNativeApp) {
    const { App } = await import("@capacitor/app");
    await App.addListener("appUrlOpen", ({ url: link }) => void finishAppSignIn(link));
  } else {
    desktop?.onLink((link) => void finishAppSignIn(link));
  }
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
  return error ? fail(error) : { ok: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error);
  useApp.setState((s) => ({ account: { ...s.account, recovery: false } }));
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

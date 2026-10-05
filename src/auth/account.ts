import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
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

/** Last known Pro status per user, so Pro features keep working offline. */
const PRO_CACHE = "sonatrio-pro-v1";
const AVATARS = "avatars";
/** Profile pictures are stored as squares this many pixels wide. */
const AVATAR_PX = 256;

function cachedPro(userId: string): Record<string, unknown> | null {
  try {
    const c = JSON.parse(localStorage.getItem(PRO_CACHE) ?? "null");
    return c?.id === userId ? c : null;
  } catch {
    return null;
  }
}

/** Public address of a stored profile picture. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!supabase || !path) return null;
  return supabase.storage.from(AVATARS).getPublicUrl(path).data.publicUrl;
}

async function loadProfile(user: User): Promise<void> {
  if (!supabase) return;
  const userId = user.id;
  const res = await supabase
    .from("profiles")
    .select("username, pro, cloud, cloud_quota_mb, is_admin, avatar_path, username_changed_at")
    .eq("id", userId)
    .maybeSingle();
  let data: Record<string, unknown> | null = res.data;
  if (res.error) data = cachedPro(userId);
  else
    try {
      const { pro, cloud, username, avatar_path } = data ?? {};
      localStorage.setItem(PRO_CACHE, JSON.stringify({ id: userId, pro: pro === true, cloud: cloud === true, username, avatar_path }));
    } catch {
      /* storage full or blocked */
    }
  const prev = useApp.getState().account;
  const hadCloud = prev.status === "signedIn" && (prev.cloud || prev.pro);
  useApp.setState((s) => ({
    account: {
      ...s.account,
      status: "signedIn",
      email: user.email ?? null,
      username: (data?.username as string | null) ?? null,
      avatar: avatarUrl(data?.avatar_path as string | null),
      usernameChangedAt: (data?.username_changed_at as string | null) ?? null,
      hasPassword: (user.identities ?? []).some((i) => i.provider === "email"),
      pro: data?.pro === true,
      cloud: data?.cloud === true,
      cloudQuotaMb: Number(data?.cloud_quota_mb ?? 0),
      isAdmin: data?.is_admin === true,
    },
  }));
  if ((data?.cloud === true || data?.pro === true) && !hadCloud) void import("./cloud").then((m) => m.syncCloud({ quiet: true }));
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
      window.setTimeout(() => void loadProfile(user), 0);
    } else {
      useApp.setState((s) => ({
        account: {
          ...s.account,
          status: "signedOut",
          email: null,
          username: null,
          avatar: null,
          usernameChangedAt: null,
          hasPassword: false,
          pro: false,
          cloud: false,
          cloudQuotaMb: 0,
          isAdmin: false,
          recovery: false,
        },
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

function proOf(a: { status: string; pro: boolean; cloud: boolean }): boolean {
  // While the account is still loading, Pro members shouldn't see their features flicker off.
  return !supabase || a.status === "loading" || a.pro || a.cloud;
}

/** Whether Pro features (microphone, MIDI keyboard, friends, all designs) are unlocked. */
export function hasPro(): boolean {
  return proOf(useApp.getState().account);
}

export function useHasPro(): boolean {
  return useApp((s) => proOf(s.account));
}

/** For a Pro feature: true when it may be used, otherwise opens the upgrade dialog. */
export function requirePro(): boolean {
  if (hasPro()) return true;
  setPanel("pro");
  return false;
}

export async function refreshAccount(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (data.user) await loadProfile(data.user);
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

/** When the username may change again (six months after the last change), or null if it may now. */
export function nextUsernameChange(changedAt: string | null): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt);
  next.setMonth(next.getMonth() + 6);
  return next.getTime() > Date.now() ? next : null;
}

export async function changeUsername(name: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const { data, error } = await supabase.rpc("change_username", { p_name: name.trim() });
  if (error) return fail(error);
  useApp.setState((s) => ({ account: { ...s.account, username: name.trim(), usernameChangedAt: (data as string | null) ?? null } }));
  void import("../social/social").then((m) => m.loadSocial());
  return { ok: true };
}

/** Changes the password; an account that already has one must confirm the current one first. */
export async function changePassword(current: string, next: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const { email, hasPassword } = useApp.getState().account;
  if (hasPassword) {
    if (!email) return { ok: false, error: "invalid" };
    const { error } = await supabase.auth.signInWithPassword({ email, password: current });
    if (error) return { ok: false, error: "wrong_password" };
  }
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return fail(error);
  useApp.setState((s) => ({ account: { ...s.account, hasPassword: true } }));
  return { ok: true };
}

/** Center-crops and scales a picture into a small square WebP (JPEG where WebP can't be encoded). */
async function squareImage(file: Blob): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  bmp.close();
  const encode = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.85));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await encode("image/jpeg");
  if (!jpg) throw new Error("encode");
  return { blob: jpg, ext: "jpg" };
}

async function clearOldAvatars(userId: string, keep: string | null): Promise<void> {
  const { data } = await supabase!.storage.from(AVATARS).list(userId, { limit: 100 });
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase!.storage.from(AVATARS).remove(old);
}

export async function uploadAvatar(file: Blob): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: "not_signed_in" };
  let img: { blob: Blob; ext: string };
  try {
    img = await squareImage(file);
  } catch {
    return { ok: false, error: "bad_image" };
  }
  const path = `${userId}/${Date.now()}.${img.ext}`;
  const up = await supabase.storage.from(AVATARS).upload(path, img.blob, { contentType: img.blob.type, upsert: false });
  if (up.error) return fail(up.error);
  const { error } = await supabase.rpc("set_avatar", { p_path: path });
  if (error) return fail(error);
  useApp.setState((s) => ({ account: { ...s.account, avatar: avatarUrl(path) } }));
  void clearOldAvatars(userId, path);
  void import("../social/social").then((m) => m.loadSocial());
  return { ok: true };
}

export async function removeAvatar(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: "not_signed_in" };
  const { error } = await supabase.rpc("set_avatar", { p_path: null });
  if (error) return fail(error);
  useApp.setState((s) => ({ account: { ...s.account, avatar: null } }));
  void clearOldAvatars(userId, null);
  void import("../social/social").then((m) => m.loadSocial());
  return { ok: true };
}

/** Permanently deletes the signed-in account and everything stored with it (cloud MIDIs, settings, progress). */
export async function deleteOwnAccount(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: "disabled" };
  const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: true } });
  if (error) return fail(error);
  if (data?.error) return fail(data.error);
  await supabase.auth.signOut({ scope: "local" });
  return { ok: true };
}

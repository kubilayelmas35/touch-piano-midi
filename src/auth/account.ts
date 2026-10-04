import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setPanel, useApp } from "../state/store";

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

function redirectUrl(): string {
  return window.location.origin + window.location.pathname;
}

async function loadProfile(userId: string, email: string | null): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.from("profiles").select("username, pro").eq("id", userId).maybeSingle();
  useApp.setState({
    account: {
      status: "signedIn",
      email,
      username: (data?.username as string | null) ?? null,
      pro: data?.pro === true,
      recovery: useApp.getState().account.recovery,
    },
  });
}

export async function initAuth(): Promise<void> {
  if (!supabase) return;
  useApp.setState((s) => ({ account: { ...s.account, status: "loading" } }));
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
      useApp.setState({ account: { status: "signedOut", email: null, username: null, pro: false, recovery: false } });
    }
  });
  const { data } = await supabase.auth.getSession();
  if (!data.session) useApp.setState((s) => ({ account: { ...s.account, status: "signedOut" } }));
}

/** Whether importing MIDI files is allowed (always, when accounts aren't configured). */
export function canImport(): boolean {
  if (!supabase) return true;
  return useApp.getState().account.pro;
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
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl() } });
  return error ? fail(error) : { ok: true };
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

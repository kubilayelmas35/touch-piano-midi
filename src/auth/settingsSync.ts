import { markSettingsChanged, sanitizeSettings, settingsChangedAt, type Settings } from "../state/settings";
import { useApp } from "../state/store";
import { supabase } from "./account";

/** Keeps a copy of the settings on the member's account so they follow them to other devices. */

/** Tied to this device's hardware / screen, so never copied between devices. */
const DEVICE_ONLY = ["midiInput", "micSensitivity", "micDevice", "instrumentHeight", "lockHeight", "keyZoom"] as const satisfies readonly (keyof Settings)[];

let apply: (s: Settings) => void = () => {};
let pushTimer = 0;
let pulledFor: string | null = null;

function signedInUser(): Promise<string | null> {
  if (!supabase || useApp.getState().account.status !== "signedIn") return Promise.resolve(null);
  return supabase.auth.getSession().then(({ data }) => data.session?.user.id ?? null);
}

function shared(s: Settings): Partial<Settings> {
  const out: Partial<Settings> = { ...s };
  for (const k of DEVICE_ONLY) delete out[k];
  return out;
}

async function upload(s: Settings, at: number): Promise<void> {
  const user = await signedInUser();
  if (!user) return;
  const { error } = await supabase!
    .from("user_settings")
    .upsert({ user_id: user, data: shared(s), updated_at: new Date(at).toISOString() }, { onConflict: "user_id" });
  if (error) console.warn("[settings] upload failed", error.message);
}

/** On sign-in: takes the account copy when it's newer than this device's, otherwise uploads ours. */
async function pull(): Promise<void> {
  const user = await signedInUser();
  if (!user || pulledFor === user) return;
  pulledFor = user;
  const { data, error } = await supabase!.from("user_settings").select("data, updated_at").eq("user_id", user).maybeSingle();
  if (error) {
    pulledFor = null;
    console.warn("[settings] download failed", error.message);
    return;
  }
  const local = useApp.getState().settings;
  const remoteAt = data ? Date.parse(data.updated_at as string) || 0 : 0;
  if (data && remoteAt >= settingsChangedAt()) {
    const next = sanitizeSettings({ ...local, ...(data.data as object) });
    for (const k of DEVICE_ONLY) (next as unknown as Record<string, unknown>)[k] = local[k];
    markSettingsChanged(remoteAt);
    apply(next);
  } else {
    const at = settingsChangedAt() || Date.now();
    markSettingsChanged(at);
    await upload(local, at);
  }
}

export function initSettingsSync(onRemote: (s: Settings) => void): void {
  apply = onRemote;
  useApp.subscribe((s, prev) => {
    if (s.account.status === prev.account.status) return;
    if (s.account.status === "signedIn") void pull();
    else if (s.account.status === "signedOut") pulledFor = null;
  });
  if (useApp.getState().account.status === "signedIn") void pull();
}

/** Called after every local settings change; uploads shortly after the last one. */
export function pushSettings(s: Settings): void {
  const at = Date.now();
  markSettingsChanged(at);
  if (!supabase || useApp.getState().account.status !== "signedIn") return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void upload(s, at), 1200);
}

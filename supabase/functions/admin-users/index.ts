// Admin-only account actions that need the service role: ban / unban and delete.
// Deploy with verify_jwt = false; the caller's access token is verified here and must belong to an admin.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: "unauthorized" }, 401);
  const { data: me } = await admin.from("profiles").select("is_admin").eq("id", caller.user.id).maybeSingle();
  if (!me?.is_admin) return json({ error: "forbidden" }, 403);

  let body: { action?: string; userId?: string; hours?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const { action, userId } = body;
  if (!userId || !UUID_RE.test(userId)) return json({ error: "bad_request" }, 400);
  if (userId === caller.user.id) return json({ error: "self" }, 400);

  const audit = (act: string, detail: Record<string, unknown> = {}) =>
    admin.from("admin_audit").insert({ admin_id: caller.user.id, target_id: action === "delete" ? null : userId, action: act, detail });

  if (action === "ban") {
    const hours = Math.max(1, Math.min(876000, Math.round(Number(body.hours) || 876000)));
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: `${hours}h` });
    if (error) return json({ error: error.message }, 400);
    await audit("ban", { hours });
    return json({ ok: true });
  }
  if (action === "unban") {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (error) return json({ error: error.message }, 400);
    await audit("unban");
    return json({ ok: true });
  }
  if (action === "delete") {
    const { data: target } = await admin.auth.admin.getUserById(userId);
    const { data: files } = await admin.storage.from("midis").list(userId, { limit: 1000 });
    if (files?.length) await admin.storage.from("midis").remove(files.map((f) => `${userId}/${f.name}`));
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);
    await audit("delete_user", { email: target?.user?.email ?? null, userId });
    return json({ ok: true });
  }
  return json({ error: "bad_request" }, 400);
});

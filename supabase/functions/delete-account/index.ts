// Lets a signed-in user permanently delete their own account: cloud MIDI files, then the auth user
// (profiles, settings, progress and cloud_midis rows go with it via on delete cascade).
// Deploy with verify_jwt = false; the caller's access token is verified here.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: "unauthorized" }, 401);
  const userId = caller.user.id;

  let body: { confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (body.confirm !== true) return json({ error: "bad_request" }, 400);

  for (;;) {
    const { data: files, error } = await admin.storage.from("midis").list(userId, { limit: 1000 });
    if (error) return json({ error: error.message }, 500);
    if (!files?.length) break;
    const { error: rmErr } = await admin.storage.from("midis").remove(files.map((f) => `${userId}/${f.name}`));
    if (rmErr) return json({ error: rmErr.message }, 500);
    if (files.length < 1000) break;
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return json({ error: error.message }, 400);
  await admin.from("admin_audit").insert({ admin_id: null, target_id: null, action: "self_delete", detail: { userId } });
  return json({ ok: true });
});

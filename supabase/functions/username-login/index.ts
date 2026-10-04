// Signs a user in by username without revealing which e-mail the username belongs to.
// Deploy with verify_jwt = false: callers are signed out and send only the publishable key.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const USERNAME_RE = /^[A-Za-z0-9_.]{3,24}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = String(body?.username ?? "").trim();
    password = String(body?.password ?? "");
  } catch {
    return json({ error: "invalid" });
  }
  if (!USERNAME_RE.test(username) || !password) return json({ error: "invalid" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await admin.from("profiles").select("id").ilike("username", username.replace(/[_%\\]/g, "\\$&")).maybeSingle();
  if (!profile) return json({ error: "invalid" });

  const { data: userData } = await admin.auth.admin.getUserById(profile.id);
  const email = userData?.user?.email;
  if (!email) return json({ error: "invalid" });

  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const notConfirmed = error?.message?.toLowerCase().includes("not confirmed");
    return json({ error: notConfirmed ? "Email not confirmed" : "invalid" });
  }
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});

// Verifies a Google Play purchase of Sonatrio Pro with the Play Developer API, acknowledges it and unlocks Pro
// on the caller's account. Deploy with verify_jwt = false; the caller's access token is verified here.
// Secret GOOGLE_PLAY_SERVICE_ACCOUNT: the JSON key of a service account invited to Play Console
// with the "View financial data" and "Manage orders and subscriptions" permissions.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PACKAGE = "com.sonatrio.app";
const PRODUCTS = new Set(["sonatrio_pro"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const b64url = (bytes: Uint8Array | string) => {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let s = "";
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function googleToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT") ?? "null");
  if (!sa?.client_email || !sa?.private_key) throw new Error("not_configured");
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  const out = await res.json();
  if (!out.access_token) throw new Error("google_auth");
  return out.access_token;
}

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

  let body: { productId?: unknown; purchaseToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const productId = String(body.productId ?? "");
  const purchaseToken = String(body.purchaseToken ?? "");
  if (!PRODUCTS.has(productId) || !purchaseToken || purchaseToken.length > 4096) return json({ error: "bad_request" }, 400);

  const { data: owner } = await admin.from("purchases").select("user_id").eq("purchase_token", purchaseToken).maybeSingle();
  if (owner && owner.user_id !== userId) return json({ error: "other_account" }, 409);

  let access: string;
  try {
    access = await googleToken();
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(base, { headers: { Authorization: `Bearer ${access}` } });
  if (res.status === 404 || res.status === 400) return json({ error: "invalid_token" }, 400);
  if (!res.ok) return json({ error: "google_api", status: res.status }, 502);
  const p = await res.json();

  if (p.purchaseState === 2) return json({ error: "pending" }, 202);
  if (p.purchaseState !== 0) return json({ error: "not_purchased" }, 400);
  if (p.obfuscatedExternalAccountId && p.obfuscatedExternalAccountId !== userId) return json({ error: "other_account" }, 409);

  const { error: insErr } = await admin
    .from("purchases")
    .upsert({ purchase_token: purchaseToken, user_id: userId, store: "google_play", product_id: productId, order_id: p.orderId ?? null });
  if (insErr) return json({ error: insErr.message }, 500);

  if (p.acknowledgementState !== 1) {
    const ack = await fetch(`${base}:acknowledge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!ack.ok) return json({ error: "acknowledge" }, 502);
  }

  const { data: prof } = await admin.from("profiles").select("pro, pro_since").eq("id", userId).maybeSingle();
  const { error: upErr } = await admin
    .from("profiles")
    .update({ pro: true, pro_source: "google_play", pro_since: prof?.pro_since ?? new Date().toISOString() })
    .eq("id", userId);
  if (upErr) return json({ error: upErr.message }, 500);
  await admin.from("admin_audit").insert({ admin_id: null, target_id: userId, action: "pro_purchase", detail: { store: "google_play", productId, orderId: p.orderId ?? null } });
  return json({ ok: true });
});

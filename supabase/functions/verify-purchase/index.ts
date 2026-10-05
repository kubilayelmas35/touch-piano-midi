// Verifies a store purchase of Sonatrio Pro and unlocks Pro on the caller's account.
// Deploy with verify_jwt = false; the caller's access token is verified here.
//
// Google Play: the Play Developer API checks the purchase token, then the purchase is acknowledged.
//   Secret GOOGLE_PLAY_SERVICE_ACCOUNT: the JSON key of a service account invited to Play Console
//   with the "View financial data" and "Manage orders and subscriptions" permissions.
// App Store: the App Store Server API looks up the StoreKit transaction id (production, then sandbox).
//   Secrets APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID, APPLE_IAP_PRIVATE_KEY: an In-App Purchase key from
//   App Store Connect > Users and Access > Integrations > In-App Purchase (the .p8 file's contents).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

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

const pemBody = (pem: string) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));

async function googleToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT") ?? "null");
  if (!sa?.client_email || !sa?.private_key) throw new Error("not_configured");
  const key = await crypto.subtle.importKey("pkcs8", pemBody(String(sa.private_key)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
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

/** ES256 token for the App Store Server API. WebCrypto's ECDSA signature is already the raw r||s form JWS wants. */
async function appleToken(): Promise<string> {
  const issuer = Deno.env.get("APPLE_IAP_ISSUER_ID");
  const kid = Deno.env.get("APPLE_IAP_KEY_ID");
  const pem = Deno.env.get("APPLE_IAP_PRIVATE_KEY");
  if (!issuer || !kid || !pem) throw new Error("not_configured");
  const key = await crypto.subtle.importKey("pkcs8", pemBody(pem.replace(/\\n/g, "\n")), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid, typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: issuer, iat: now, exp: now + 1200, aud: "appstoreconnect-v1", bid: PACKAGE }));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${head}.${claims}`)));
  return `${head}.${claims}.${b64url(sig)}`;
}

/** Payload of a JWS fetched straight from Apple over TLS. */
function jwsPayload(jws: string): Record<string, unknown> {
  const part = jws.split(".")[1] ?? "";
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
}

async function unlock(admin: SupabaseClient, userId: string, store: "google_play" | "app_store", productId: string, orderId: string | null) {
  const { data: prof } = await admin.from("profiles").select("pro, pro_since").eq("id", userId).maybeSingle();
  const { error } = await admin
    .from("profiles")
    .update({ pro: true, pro_source: store, pro_since: prof?.pro_since ?? new Date().toISOString() })
    .eq("id", userId);
  if (error) return json({ error: error.message }, 500);
  await admin.from("admin_audit").insert({ admin_id: null, target_id: userId, action: "pro_purchase", detail: { store, productId, orderId } });
  return json({ ok: true });
}

async function verifyGoogle(admin: SupabaseClient, userId: string, productId: string, purchaseToken: string): Promise<Response> {
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
  return unlock(admin, userId, "google_play", productId, p.orderId ?? null);
}

async function verifyApple(admin: SupabaseClient, userId: string, productId: string, transactionId: string): Promise<Response> {
  if (!/^\d{1,32}$/.test(transactionId)) return json({ error: "bad_request" }, 400);
  let token: string;
  try {
    token = await appleToken();
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }
  // Review and TestFlight purchases live in the sandbox; a production lookup answers 404 for them.
  let signed: string | null = null;
  for (const host of ["https://api.storekit.itunes.apple.com", "https://api.storekit-sandbox.itunes.apple.com"]) {
    const res = await fetch(`${host}/inApps/v1/transactions/${transactionId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) continue;
    if (!res.ok) return json({ error: "apple_api", status: res.status }, 502);
    signed = (await res.json()).signedTransactionInfo ?? null;
    break;
  }
  if (!signed) return json({ error: "invalid_token" }, 400);
  const t = jwsPayload(signed);

  if (t.bundleId !== PACKAGE || t.productId !== productId) return json({ error: "invalid_token" }, 400);
  if (t.revocationDate) return json({ error: "not_purchased" }, 400);
  const account = typeof t.appAccountToken === "string" ? t.appAccountToken.toLowerCase() : null;
  if (account && account !== userId.toLowerCase()) return json({ error: "other_account" }, 409);

  // Restores and Family Sharing hand out new transaction ids; the original one identifies the purchase.
  const key = `apple:${String(t.originalTransactionId ?? t.transactionId)}`;
  const { data: owner } = await admin.from("purchases").select("user_id").eq("purchase_token", key).maybeSingle();
  if (owner && owner.user_id !== userId) return json({ error: "other_account" }, 409);
  const { error: insErr } = await admin
    .from("purchases")
    .upsert({ purchase_token: key, user_id: userId, store: "app_store", product_id: productId, order_id: String(t.transactionId ?? transactionId) });
  if (insErr) return json({ error: insErr.message }, 500);
  return unlock(admin, userId, "app_store", productId, String(t.transactionId ?? transactionId));
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

  let body: { store?: unknown; productId?: unknown; purchaseToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const store = String(body.store ?? "google_play");
  const productId = String(body.productId ?? "");
  const purchaseToken = String(body.purchaseToken ?? "");
  if (!PRODUCTS.has(productId) || !purchaseToken || purchaseToken.length > 4096) return json({ error: "bad_request" }, 400);

  if (store === "app_store") return verifyApple(admin, userId, productId, purchaseToken);
  if (store === "google_play") return verifyGoogle(admin, userId, productId, purchaseToken);
  return json({ error: "bad_request" }, 400);
});

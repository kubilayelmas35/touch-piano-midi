import { platform } from "../lib/platform";
import { tNow } from "../i18n";
import { toast, useApp } from "../state/store";
import { refreshAccount, supabase } from "./account";

export const PRO_PRODUCT_ID = "sonatrio_pro";

/** Pro is bought in the apps (Google Play Billing, App Store in-app purchase); other platforms unlock it via the account. */
export const canBuyInApp = platform === "android" || platform === "ios";
const store = platform === "ios" ? "app_store" : "google_play";

type VerifyResult = "ok" | "pending" | "other_account" | "failed";

/** The localized Pro price from the store (e.g. "$1.99"), or null when the store can't be reached. */
export async function proPrice(): Promise<string | null> {
  if (!canBuyInApp) return null;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await import("@capgo/native-purchases");
    const { product } = await NativePurchases.getProduct({ productIdentifier: PRO_PRODUCT_ID, productType: PURCHASE_TYPE.INAPP });
    return product.priceString || null;
  } catch {
    return null;
  }
}

/** Google Play: the purchase token. App Store: the StoreKit transaction id. */
async function verify(purchaseToken: string): Promise<VerifyResult> {
  if (!supabase) return "failed";
  const { data, error } = await supabase.functions.invoke("verify-purchase", { body: { store, productId: PRO_PRODUCT_ID, purchaseToken } });
  if (data?.ok) return "ok";
  const code = data?.error ?? (await errorCode(error));
  if (code === "pending") return "pending";
  if (code === "other_account") return "other_account";
  return "failed";
}

/** StoreKit keeps a transaction in its queue until the app finishes it; Google Play purchases are acknowledged by the server. */
async function finishTransaction(transactionId: string): Promise<void> {
  if (store !== "app_store") return;
  try {
    const { NativePurchases } = await import("@capgo/native-purchases");
    await NativePurchases.acknowledgePurchase({ purchaseToken: transactionId });
  } catch {
    // Already finished.
  }
}

/** supabase-js puts non-2xx bodies on `error.context` (a Response). */
async function errorCode(error: unknown): Promise<string | null> {
  const res = (error as { context?: Response } | null)?.context;
  if (!res || typeof res.json !== "function") return null;
  try {
    return (await res.clone().json())?.error ?? null;
  } catch {
    return null;
  }
}

async function finish(result: VerifyResult): Promise<boolean> {
  if (result === "ok") {
    await refreshAccount();
    toast(tNow("proUnlocked"), "success");
    return true;
  }
  if (result === "pending") toast(tNow("proPending"), "info", 6000);
  else if (result === "other_account") toast(tNow("proOtherAccount"), "error", 6000);
  else toast(tNow("proVerifyFailed"), "error", 6000);
  return false;
}

function isCancel(err: unknown): boolean {
  const msg = String((err as { message?: string } | null)?.message ?? err).toLowerCase();
  return msg.includes("cancel");
}

/** Opens the store's purchase sheet for Pro and unlocks it on the signed-in account. */
export async function buyPro(): Promise<boolean> {
  const userId = (await supabase?.auth.getUser())?.data.user?.id;
  if (!canBuyInApp || !userId) return false;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await import("@capgo/native-purchases");
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    if (!isBillingSupported) {
      toast(tNow("proBillingUnavailable"), "error", 5000);
      return false;
    }
    const tx = await NativePurchases.purchaseProduct({
      productIdentifier: PRO_PRODUCT_ID,
      productType: PURCHASE_TYPE.INAPP,
      appAccountToken: userId,
      autoAcknowledgePurchases: false,
    });
    if (store === "app_store") {
      if (!tx.transactionId) return finish("failed");
      const result = await verify(tx.transactionId);
      if (result === "ok") await finishTransaction(tx.transactionId);
      return finish(result);
    }
    if (tx.purchaseState && tx.purchaseState !== "1") return finish("pending");
    if (!tx.purchaseToken) return finish("failed");
    return finish(await verify(tx.purchaseToken));
  } catch (err) {
    if (!isCancel(err)) toast(tNow("proBuyFailed"), "error", 5000);
    return false;
  }
}

/** Re-sends this store account's Pro purchase to the server (new phone, reinstall, payment that was pending). */
export async function restorePro(): Promise<boolean> {
  if (!canBuyInApp || useApp.getState().account.status !== "signedIn") return false;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await import("@capgo/native-purchases");
    if (store === "app_store") await NativePurchases.restorePurchases();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    const pro = purchases.find((p) => p.productIdentifier === PRO_PRODUCT_ID && (store === "app_store" ? p.transactionId : p.purchaseToken));
    const token = store === "app_store" ? pro?.transactionId : pro?.purchaseToken;
    if (!token) {
      toast(tNow("proNothingToRestore"), "info", 5000);
      return false;
    }
    const result = await verify(token);
    if (result === "ok") await finishTransaction(token);
    return finish(result);
  } catch {
    toast(tNow("proBuyFailed"), "error", 5000);
    return false;
  }
}

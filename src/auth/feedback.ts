import { supabase } from "./account";
import { platform } from "../lib/platform";
import { useApp } from "../state/store";

export type FeedbackKind = "suggestion" | "complaint" | "bug" | "other";
export const FEEDBACK_KINDS: FeedbackKind[] = ["suggestion", "complaint", "bug", "other"];
export const FEEDBACK_MAX = 4000;

export type FeedbackError = "disabled" | "short" | "rate" | "network";

export async function sendFeedback(kind: FeedbackKind, message: string, email: string): Promise<FeedbackError | null> {
  if (!supabase) return "disabled";
  const text = message.trim();
  if (text.length < 3) return "short";
  const { error } = await supabase.rpc("submit_feedback", {
    p_kind: kind,
    p_message: text.slice(0, FEEDBACK_MAX),
    p_email: email.trim() || null,
    p_platform: platform,
    p_app_version: __APP_VERSION__,
    p_language: useApp.getState().settings.language,
    p_device: `${navigator.userAgent} · ${screen.width}x${screen.height}`.slice(0, 300),
  });
  if (!error) return null;
  if (error.message.includes("rate_limited")) return "rate";
  if (error.message.includes("too_short")) return "short";
  return "network";
}

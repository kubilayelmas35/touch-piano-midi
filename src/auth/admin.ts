import { supabase } from "./account";

export interface DayCount {
  day: string;
  n: number;
}

export interface AdminStats {
  users: number;
  pro: number;
  cloud: number;
  admins: number;
  unconfirmed: number;
  banned: number;
  new7: number;
  new30: number;
  active1: number;
  active7: number;
  active30: number;
  files: number;
  bytes: number;
  providers: Record<string, number>;
  proSources: Record<string, number>;
  signups: DayCount[];
  actives: DayCount[];
  trial: number;
  trialEnded: number;
  trialConverted: number;
  referrals: number;
  referrals7: number;
  reportsOpen: number;
  errors24: number;
  errorUsers24: number;
  purchases7: number;
  purchases30: number;
  avatars: number;
  friendships: number;
  duels7: number;
  feedbackNew: number;
  /** Where errors came from in the last 7 days. */
  platforms: Record<string, number>;
  /** This week's most played songs on the friends boards. */
  topSongs: { song: string; players: number; best: number }[];
  purchases: DayCount[];
  errors: DayCount[];
}

export interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  providers: string[];
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  banned: boolean;
  banned_until: string | null;
  pro: boolean;
  pro_source: string | null;
  pro_since: string | null;
  cloud: boolean;
  cloud_quota_mb: number;
  files: number;
  bytes: number;
  is_admin: boolean;
  admin_note: string | null;
  trial_until: string | null;
  avatar_path: string | null;
  open_reports: number;
  referrals: number;
  total: number;
}

export interface UserExtra {
  trial_until: string | null;
  referral_days: number | null;
  username_changed_at: string | null;
  referred_by: { id: string; username: string | null } | null;
  referrals: { id: string; username: string | null; at: string }[];
  friends: number;
  blocks_made: number;
  blocked_by: number;
  reports_made: number;
  reports: { id: number; reason: ReportReason; details: string | null; status: ReportStatus; at: string; reporter: string | null }[];
  duels: number;
  weekly_songs: number;
  purchases: { store: string; product: string; order: string | null; at: string }[];
  errors: { created_at: string; kind: string; message: string; app_version: string | null; platform: string | null }[];
  practice_seconds: number;
  runs: number;
  notes: number;
  songs_played: number;
  practice_days: number;
  last_practice: string | null;
  synced_at: string | null;
}

export type ReportReason = "avatar" | "username" | "harassment" | "cheating" | "spam" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";

export interface AdminReport {
  id: number;
  created_at: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  admin_note: string | null;
  resolved_at: string | null;
  target_id: string | null;
  target_username: string | null;
  target_email: string | null;
  target_avatar: string | null;
  /** Name and picture at the moment of the report, in case they changed since. */
  reported_username: string | null;
  reported_avatar: string | null;
  target_banned: boolean;
  target_reports: number;
  reporter_id: string | null;
  reporter_username: string | null;
  reporter_email: string | null;
  resolved_by_email: string | null;
}

export interface ErrorGroup {
  fingerprint: string;
  kind: string;
  message: string;
  stack: string | null;
  url: string | null;
  device: string | null;
  count: number;
  users: number;
  first_seen: string;
  last_seen: string;
  versions: string[] | null;
  platforms: string[] | null;
}

export interface ReferralStats {
  top: { id: string; username: string | null; email: string | null; n: number; referral_days: number | null; last_at: string }[];
  recent: { id: string; username: string | null; email: string | null; at: string; pro: boolean; inviter_id: string; inviter: string | null }[];
}

export interface AdminFile {
  id: string;
  user_id: string;
  email: string | null;
  username: string | null;
  song_id: string;
  title: string;
  file_name: string | null;
  size_bytes: number;
  duration: number | null;
  note_count: number | null;
  path: string;
  created_at: string;
}

export interface StorageUser {
  user_id: string;
  email: string | null;
  username: string | null;
  files: number;
  bytes: number;
  quota_mb: number;
}

export interface AuditEntry {
  id: number;
  at: string;
  admin_email: string | null;
  target_id: string | null;
  target_email: string | null;
  action: string;
  detail: Record<string, unknown>;
}

export type FeedbackStatus = "new" | "read" | "done";

export interface FeedbackEntry {
  id: number;
  created_at: string;
  user_id: string | null;
  account_email: string | null;
  username: string | null;
  email: string | null;
  kind: "suggestion" | "complaint" | "bug" | "other";
  message: string;
  platform: string | null;
  app_version: string | null;
  language: string | null;
  device: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
}

export type FeedbackCounts = Record<FeedbackStatus | "all", number>;

export type UserFilter = "all" | "pro" | "trial" | "free" | "cloud" | "admin" | "reported" | "referrers" | "unconfirmed" | "banned";
export type UserSort = "new" | "old" | "active" | "storage" | "name" | "reports" | "referrals";

export interface UserPatch {
  pro?: boolean;
  pro_source?: string;
  cloud?: boolean;
  cloud_quota_mb?: number;
  is_admin?: boolean;
  admin_note?: string;
}

function client() {
  if (!supabase) throw new Error("disabled");
  return supabase;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function fetchStats(): Promise<AdminStats> {
  return check(await client().rpc("admin_stats")) as AdminStats;
}

export async function listUsers(q: {
  search: string;
  filter: UserFilter;
  sort: UserSort;
  limit: number;
  offset: number;
}): Promise<{ users: AdminUser[]; total: number }> {
  const users = check(
    await client().rpc("admin_list_users", {
      p_search: q.search.trim(),
      p_filter: q.filter,
      p_sort: q.sort,
      p_limit: q.limit,
      p_offset: q.offset,
    })
  ) as AdminUser[];
  return { users, total: users[0]?.total ?? 0 };
}

export async function getUser(id: string): Promise<AdminUser | null> {
  const { users } = await listUsers({ search: id, filter: "all", sort: "new", limit: 1, offset: 0 });
  return users.find((u) => u.id === id) ?? null;
}

export async function updateUser(id: string, patch: UserPatch): Promise<void> {
  check(await client().rpc("admin_update_user", { p_user: id, p_patch: patch }));
}

export async function listFiles(userId: string | null, limit = 100): Promise<AdminFile[]> {
  return check(await client().rpc("admin_files", { p_user: userId, p_limit: limit })) as AdminFile[];
}

export async function storageByUser(limit = 10): Promise<StorageUser[]> {
  return check(await client().rpc("admin_storage_by_user", { p_limit: limit })) as StorageUser[];
}

export async function deleteFile(file: AdminFile): Promise<void> {
  const sb = client();
  await sb.storage.from("midis").remove([file.path]);
  check(await sb.rpc("admin_delete_file", { p_id: file.id }));
}

export async function downloadFile(file: AdminFile): Promise<void> {
  const { data, error } = await client().storage.from("midis").download(file.path);
  if (error || !data) throw new Error(error?.message ?? "download");
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.file_name || `${file.title}.mid`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function auditLog(userId: string | null, limit = 100): Promise<AuditEntry[]> {
  return check(await client().rpc("admin_audit_log", { p_user: userId, p_limit: limit })) as AuditEntry[];
}

export async function listFeedback(status: FeedbackStatus | "open" | "all", limit = 200): Promise<FeedbackEntry[]> {
  return check(await client().rpc("admin_feedback_list", { p_status: status, p_limit: limit })) as FeedbackEntry[];
}

export async function feedbackCounts(): Promise<FeedbackCounts> {
  return check(await client().rpc("admin_feedback_counts")) as FeedbackCounts;
}

export async function updateFeedback(id: number, patch: { status?: FeedbackStatus; note?: string }): Promise<void> {
  check(
    await client().rpc("admin_feedback_update", { p_id: id, p_status: patch.status ?? null, p_note: patch.note ?? null })
  );
}

export async function deleteFeedback(id: number): Promise<void> {
  check(await client().rpc("admin_feedback_delete", { p_id: id }));
}

export async function userExtra(id: string): Promise<UserExtra> {
  return check(await client().rpc("admin_user_extra", { p_user: id })) as UserExtra;
}

/** Adds days to the free trial; 0 ends it now. Returns the new end. */
export async function setTrial(id: string, days: number): Promise<string> {
  return check(await client().rpc("admin_set_trial", { p_user: id, p_days: days })) as string;
}

/** Clears an offensive username; the member is asked to pick a new one. */
export async function resetUsername(id: string): Promise<void> {
  check(await client().rpc("admin_reset_username", { p_user: id }));
}

export async function listReports(status: ReportStatus | "all", limit = 200): Promise<AdminReport[]> {
  return check(await client().rpc("admin_reports", { p_status: status, p_limit: limit })) as AdminReport[];
}

export async function updateReport(id: number, patch: { status?: ReportStatus; note?: string }): Promise<void> {
  check(await client().rpc("admin_report_update", { p_id: id, p_status: patch.status ?? null, p_note: patch.note ?? null }));
}

export async function listErrors(days: number, limit = 150): Promise<ErrorGroup[]> {
  return check(await client().rpc("admin_errors", { p_days: days, p_limit: limit })) as ErrorGroup[];
}

export async function resolveError(fingerprint: string): Promise<number> {
  return check(await client().rpc("admin_error_resolve", { p_fingerprint: fingerprint })) as number;
}

export async function referralStats(limit = 100): Promise<ReferralStats> {
  return check(await client().rpc("admin_referrals", { p_limit: limit })) as ReferralStats;
}

/** Ban / unban / delete / remove_avatar go through an edge function because they need the service role. */
export async function userAction(action: "ban" | "unban" | "delete" | "remove_avatar", userId: string, hours?: number): Promise<void> {
  const { data, error } = await client().functions.invoke("admin-users", { body: { action, userId, hours } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
}

export function usersCsv(users: AdminUser[]): string {
  const cols: (keyof AdminUser)[] = [
    "id",
    "email",
    "username",
    "providers",
    "created_at",
    "last_sign_in_at",
    "confirmed",
    "banned",
    "pro",
    "pro_source",
    "pro_since",
    "trial_until",
    "cloud",
    "cloud_quota_mb",
    "files",
    "bytes",
    "open_reports",
    "referrals",
    "is_admin",
  ];
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("|") : v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...users.map((u) => cols.map((c) => cell(u[c])).join(","))].join("\n");
}

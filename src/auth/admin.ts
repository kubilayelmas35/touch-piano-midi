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
  total: number;
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

export type UserFilter = "all" | "pro" | "free" | "cloud" | "admin" | "unconfirmed" | "banned";
export type UserSort = "new" | "old" | "active" | "storage" | "name";

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

/** Ban / unban / delete go through an edge function because they need the service role. */
export async function userAction(action: "ban" | "unban" | "delete", userId: string, hours?: number): Promise<void> {
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
    "cloud",
    "cloud_quota_mb",
    "files",
    "bytes",
    "is_admin",
  ];
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("|") : v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...users.map((u) => cols.map((c) => cell(u[c])).join(","))].join("\n");
}

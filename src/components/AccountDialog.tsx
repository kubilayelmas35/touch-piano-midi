import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  REFERRAL_MAX_DAYS,
  STORE_LINKS,
  TRIAL_DAYS,
  USERNAME_RE,
  changePassword,
  changeUsername,
  deleteOwnAccount,
  nextUsernameChange,
  proOrTrial,
  refreshAccount,
  removeAvatar,
  uploadAvatar,
  sendPasswordReset,
  signInWithPassword,
  signInWithProvider,
  signOut,
  signUp,
  trialActive,
  trialDaysLeft,
  updatePassword,
  usernameAvailable,
  type AuthResult,
} from "../auth/account";
import { PRO_CLOUD_SONGS } from "../auth/cloud";
import { buyPro, canBuyInApp, proPrice, restorePro } from "../auth/purchase";
import { useT, type TFn } from "../i18n";
import { isNativeApp, platform } from "../lib/platform";
import { inviteLink } from "../social/social";
import { shareLink } from "../studio/share";
import { setPanel, toast, useApp } from "../state/store";
import { IconApple, IconCamera, IconCheck, IconCloud, IconCrown, IconGift, IconGoogle, IconShare, IconShield, IconUser } from "../ui/icons";
import { Button, Dialog, Segmented, cx } from "../ui/primitives";
import { LegalLinks } from "./LegalLinks";
import { UserAvatar } from "./UserAvatar";

function errorText(t: TFn, r: AuthResult): string {
  if (r.ok) return "";
  const e = r.error.toLowerCase();
  if (e.includes("invalid login") || e.includes("invalid credentials") || e === "invalid") return t("authInvalid");
  if (e.includes("already registered") || e.includes("already exists")) return t("authExists");
  if (e.includes("not confirmed")) return t("authNotConfirmed");
  if (e.includes("provider") && (e.includes("not enabled") || e.includes("unsupported"))) return t("authProviderOff");
  return t("authError", { msg: r.error });
}

function Field({
  label,
  hint,
  ...rest
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-mist-300">{label}</span>
      <input
        {...rest}
        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none placeholder:text-mist-500 focus:border-brand-400/70"
      />
      {hint && <span className="mt-1 block text-[11px] text-mist-400">{hint}</span>}
    </label>
  );
}

function ProviderButton({ onClick, icon, children, dark }: { onClick: () => void; icon: ReactNode; children: ReactNode; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex h-11 w-full items-center justify-center gap-2.5 rounded-xl text-sm font-semibold transition-colors",
        dark ? "bg-black text-white hover:bg-black/80 ring-1 ring-white/15" : "bg-white text-[#1f1f1f] hover:bg-white/90"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SignedOut() {
  const t = useT();
  const providers = useApp((s) => s.account.providers);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const run = async (fn: () => Promise<AuthResult>, onOk?: (r: AuthResult & { ok: true }) => void) => {
    setBusy(true);
    setError("");
    setInfo("");
    const r = await fn();
    setBusy(false);
    if (r.ok) onOk?.(r);
    else setError(errorText(t, r));
  };

  const providerStarted = (r: AuthResult & { ok: true }) => {
    if (r.message === "browser") setInfo(t("continueInBrowser"));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
      void run(() => signInWithPassword(identifier, password), () => {
        toast(t("welcomeBack"), "success");
        setPanel(null);
      });
    } else if (mode === "signup") {
      if (!USERNAME_RE.test(username.trim())) return setError(t("usernameHint"));
      void run(async () => {
        if (!(await usernameAvailable(username.trim()))) return { ok: false, error: t("usernameTaken") };
        return signUp(email, password, username);
      }, (r) => {
        if (r.message === "confirm") setInfo(t("confirmEmail"));
        else {
          toast(t("welcomeBack"), "success");
          setPanel(null);
        }
      });
    } else {
      void run(() => sendPasswordReset(email), () => setInfo(t("resetSent")));
    }
  };

  return (
    <div className="space-y-4">
      {mode !== "reset" && (
        <>
          <Segmented
            label={t("account")}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setError("");
              setInfo("");
            }}
            className="w-full"
            options={[
              { value: "signin", label: t("signIn") },
              { value: "signup", label: t("signUp") },
            ]}
          />
          {(providers.google || providers.apple) && (
            <>
              <div className="space-y-2">
                {providers.google && (
                  <ProviderButton onClick={() => void run(() => signInWithProvider("google"), providerStarted)} icon={<IconGoogle />}>
                    {t("continueGoogle")}
                  </ProviderButton>
                )}
                {providers.apple && (
                  <ProviderButton onClick={() => void run(() => signInWithProvider("apple"), providerStarted)} icon={<IconApple />} dark>
                    {t("continueApple")}
                  </ProviderButton>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-mist-400">
                <span className="h-px flex-1 bg-white/10" />
                {t("orDivider")}
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </>
          )}
        </>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === "signin" && (
          <>
            <Field label={t("emailOrUsername")} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
            <Field label={t("password")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </>
        )}
        {mode === "signup" && (
          <>
            <Field label={t("username")} hint={t("usernameHint")} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="nickname" required maxLength={24} />
            <Field label={t("email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Field label={t("password")} hint={t("passwordHint")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
            <p className="flex items-center gap-2 rounded-xl bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
              <IconCrown size={14} className="shrink-0 text-amber-300" /> {t("trialSignUpHint", { n: TRIAL_DAYS })}
            </p>
          </>
        )}
        {mode === "reset" && <Field label={t("email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}

        {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        {info && <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{info}</p>}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {mode === "signin" ? t("signIn") : mode === "signup" ? t("signUp") : t("sendResetLink")}
        </Button>
        {mode !== "reset" && (
          <div className="space-y-1 text-center">
            <p className="text-[11px] leading-relaxed text-mist-400">{t("agreeNotice")}</p>
            <LegalLinks className="justify-center" />
          </div>
        )}
        <div className="text-center">
          {mode === "signin" ? (
            <button type="button" className="text-xs font-semibold text-brand-300 hover:text-brand-200" onClick={() => setMode("reset")}>
              {t("forgotPassword")}
            </button>
          ) : mode === "reset" ? (
            <button type="button" className="text-xs font-semibold text-brand-300 hover:text-brand-200" onClick={() => setMode("signin")}>
              {t("back")}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Recovery() {
  const t = useT();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void updatePassword(password).then((r) => {
          setBusy(false);
          if (r.ok) toast(t("passwordUpdated"), "success");
          else setError(errorText(t, r));
        });
      }}
    >
      <Field label={t("newPassword")} hint={t("passwordHint")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
      {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {t("savePassword")}
      </Button>
    </form>
  );
}

function ProfilePicture() {
  const t = useT();
  const account = useApp((s) => s.account);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const name = account.username ?? account.email ?? "";
  const pick = (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    void uploadAvatar(file).then((r) => {
      setBusy(false);
      if (r.ok) toast(t("avatarSaved"), "success");
      else toast(r.error === "bad_image" ? t("avatarBadImage") : errorText(t, r), "error", 5000);
    });
  };
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label={t("avatarChange")}
        title={t("avatarChange")}
        className="group relative block rounded-full"
      >
        <UserAvatar url={account.avatar} name={name} me className={cx("h-16 w-16 text-2xl", busy && "opacity-50")} />
        <span className="absolute -right-0.5 -bottom-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white ring-2 ring-ink-900 group-hover:bg-brand-400">
          <IconCamera size={13} />
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function UsernameEditor() {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const account = useApp((s) => s.account);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = nextUsernameChange(account.usernameChangedAt);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n === account.username) return setEditing(false);
    if (!USERNAME_RE.test(n)) return setError(t("usernameHint"));
    setBusy(true);
    setError("");
    const r = await changeUsername(n);
    setBusy(false);
    if (r.ok) {
      setEditing(false);
      toast(t("usernameChanged"), "success");
    } else {
      const e2 = r.error;
      setError(e2.includes("username_taken") ? t("usernameTaken") : e2.includes("username_cooldown") ? t("usernameCooldown") : errorText(t, r));
    }
  };
  if (!editing) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-mist-400">{t("username")}</div>
          <div className="truncate text-sm font-bold">{account.username ? `@${account.username}` : "—"}</div>
          <div className="mt-0.5 text-[11px] text-mist-400">
            {next ? t("usernameNextChange", { date: next.toLocaleDateString(lang) }) : t("usernameChangeRule")}
          </div>
        </div>
        <Button
          size="sm"
          disabled={!!next}
          onClick={() => {
            setName(account.username ?? "");
            setError("");
            setEditing(true);
          }}
        >
          {account.username ? t("change") : t("usernamePick")}
        </Button>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => void save(e)} className="space-y-2 py-2">
      <Field
        label={t("username")}
        hint={account.username ? t("usernameChangeWarn") : t("usernameHint")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="nickname"
        maxLength={24}
        autoFocus
        required
      />
      {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditing(false)} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={busy}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

function PasswordEditor() {
  const t = useT();
  const hasPassword = useApp((s) => s.account.hasPassword);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-mist-400">{t("password")}</div>
          <div className="text-sm font-bold tracking-widest">{hasPassword ? "••••••••" : "—"}</div>
          {!hasPassword && <div className="mt-0.5 text-[11px] text-mist-400">{t("passwordSetHint")}</div>}
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          {hasPassword ? t("change") : t("passwordSet")}
        </Button>
      </div>
    );
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== again) return setError(t("passwordMismatch"));
    setBusy(true);
    setError("");
    const r = await changePassword(current, next);
    setBusy(false);
    if (r.ok) {
      toast(t("passwordUpdated"), "success");
      setOpen(false);
      setCurrent("");
      setNext("");
      setAgain("");
    } else setError(r.error === "wrong_password" ? t("passwordWrong") : errorText(t, r));
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2 py-2">
      {hasPassword && (
        <Field label={t("passwordCurrent")} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      )}
      <Field label={t("newPassword")} hint={t("passwordHint")} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={8} />
      <Field label={t("passwordAgain")} type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required minLength={8} />
      {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={busy}>
          {t("savePassword")}
        </Button>
      </div>
    </form>
  );
}

function TrialCard() {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const account = useApp((s) => s.account);
  if (account.pro || !trialActive(account)) return null;
  const days = trialDaysLeft(account);
  return (
    <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.12] to-orange-500/[0.08] p-3">
      <div className="flex items-center gap-2.5">
        <IconCrown size={18} className="shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-amber-100">{t("trialActiveTitle", { n: days })}</div>
          <div className="text-[11px] text-amber-100/70">
            {t("trialEnds", { date: new Date(account.trialUntil!).toLocaleDateString(lang, { day: "numeric", month: "long" }) })}
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, (days / TRIAL_DAYS) * 100)}%` }} />
      </div>
    </div>
  );
}

function InviteCard() {
  const t = useT();
  const account = useApp((s) => s.account);
  if (!account.username) return null;
  const earned = account.referralDays;
  const share = async () => {
    const r = await shareLink(t("friendsInviteTitle"), t("referralShareText", { name: account.username! }), inviteLink(account.username!));
    if (r === "copied") toast(t("linkCopied"), "success");
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sky-300/15 bg-sky-400/[0.06] p-3">
      <IconGift size={22} className="shrink-0 text-sky-300" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{t("referralTitle")}</div>
        <div className="text-[11px] leading-snug text-mist-400">
          {earned >= REFERRAL_MAX_DAYS ? t("referralMaxed") : t("referralBody")}
          {earned > 0 && ` · ${t("referralEarned", { n: earned, max: REFERRAL_MAX_DAYS })}`}
        </div>
      </div>
      <Button size="sm" onClick={() => void share()}>
        <IconShare size={14} /> {t("friendsInvite")}
      </Button>
    </div>
  );
}

function SignedIn() {
  const t = useT();
  const account = useApp((s) => s.account);
  const cloudCount = useApp((s) => s.cloudIds.length);
  const [removing, setRemoving] = useState(false);
  const trial = !account.pro && trialActive(account);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
        <ProfilePicture />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{account.username ? `@${account.username}` : t("signedInAs")}</div>
          <div className="truncate text-xs text-mist-400">{account.email}</div>
          {account.avatar && (
            <button
              type="button"
              disabled={removing}
              className="mt-1 text-[11px] font-semibold text-mist-400 hover:text-rose-200"
              onClick={() => {
                setRemoving(true);
                void removeAvatar().then((r) => {
                  setRemoving(false);
                  if (!r.ok) toast(errorText(t, r), "error");
                });
              }}
            >
              {t("avatarRemove")}
            </button>
          )}
        </div>
        {(account.pro || trial) && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-300/15 px-2 py-1 text-xs font-bold text-amber-200">
            <IconCrown size={13} /> {account.pro ? "PRO" : t("trialBadge")}
          </span>
        )}
      </div>
      <TrialCard />
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-1 divide-y divide-white/[0.05]">
        <h3 className="pt-2 pb-1 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("personalSettings")}</h3>
        <UsernameEditor />
        <PasswordEditor />
      </section>
      <InviteCard />
      {(account.cloud || proOrTrial(account)) && (
        <div className="flex items-center gap-2 rounded-2xl border border-sky-300/15 bg-sky-400/[0.07] px-3 py-2.5 text-sm text-sky-100">
          <IconCloud size={16} className="shrink-0 text-sky-300" />
          <span className="min-w-0 flex-1">{t("cloudOn")}</span>
          <span className="text-xs text-mist-400">
            {account.cloud ? `${account.cloudQuotaMb} MB` : t("cloudSongsOf", { n: cloudCount, max: PRO_CLOUD_SONGS })}
          </span>
        </div>
      )}
      <p className="flex items-center gap-2 px-1 text-xs text-mist-400">
        <IconCloud size={14} className="shrink-0 text-mist-400" />
        {t("settingsSynced")}
      </p>
      {!account.pro && !account.cloud && (
        <Button variant="primary" className="w-full" onClick={() => setPanel("pro")}>
          <IconCrown size={16} /> {trial ? t("trialKeepPro") : t("getPro")}
        </Button>
      )}
      {account.isAdmin && (
        <Button className="w-full" onClick={() => setPanel("admin")}>
          <IconShield size={16} className="text-amber-300" /> {t("adminPanel")}
        </Button>
      )}
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          void signOut().then(() => toast(t("signedOut")));
        }}
      >
        {t("signOut")}
      </Button>
      <DeleteAccount />
      <LegalLinks className="justify-center" />
    </div>
  );
}

/** "sil", "SIL" and "SİL" all match. */
const norm = (s: string) => s.trim().toLocaleUpperCase("tr").replace(/İ/g, "I");

function DeleteAccount() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const word = t("deleteConfirmWord");
  const confirmed = norm(typed) === norm(word);
  if (!open) {
    return (
      <div className="text-center">
        <button type="button" className="text-xs font-semibold text-rose-300/80 hover:text-rose-200" onClick={() => setOpen(true)}>
          {t("deleteAccount")}
        </button>
      </div>
    );
  }
  return (
    <form
      className="space-y-3 rounded-2xl border border-rose-400/25 bg-rose-500/[0.07] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirmed) return;
        setBusy(true);
        setError("");
        void deleteOwnAccount().then((r) => {
          setBusy(false);
          if (r.ok) {
            toast(t("accountDeleted"), "success", 5000);
            setPanel(null);
          } else setError(errorText(t, r));
        });
      }}
    >
      <p className="text-sm font-bold text-rose-100">{t("deleteAccount")}</p>
      <p className="text-xs leading-relaxed text-rose-100/80">{t("deleteAccountBody")}</p>
      <Field label={t("deleteConfirmLabel", { word })} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" required />
      {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          variant="danger"
          className="flex-1"
          disabled={busy || !confirmed}
        >
          {busy ? "…" : t("deleteForever")}
        </Button>
      </div>
    </form>
  );
}

export function AccountDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "account");
  const account = useApp((s) => s.account);
  return (
    <Dialog open={open} onClose={() => setPanel(null)} title={t("account")} width="max-w-sm" closeLabel={t("close")}>
      {account.recovery ? <Recovery /> : account.status === "signedIn" ? <SignedIn /> : account.status === "loading" ? (
        <p className="py-6 text-center text-sm text-mist-400">…</p>
      ) : (
        <SignedOut />
      )}
    </Dialog>
  );
}

function StoreButton({ href, label, soon }: { href: string; label: string; soon: string }) {
  const disabled = !href;
  return (
    <a
      href={href || undefined}
      target="_blank"
      rel="noreferrer"
      aria-disabled={disabled}
      onClick={(e) => disabled && e.preventDefault()}
      className={cx(
        "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
        disabled ? "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-mist-400" : "border-white/10 bg-white/[0.07] hover:bg-white/[0.12]"
      )}
    >
      {label}
      {disabled && <span className="rounded-md bg-white/10 px-1.5 text-[10px] font-bold">{soon}</span>}
    </a>
  );
}

function PlayPurchase() {
  const t = useT();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  useEffect(() => {
    let alive = true;
    void proPrice().then((p) => alive && setPrice(p));
    return () => {
      alive = false;
    };
  }, []);
  const run = (kind: "buy" | "restore") => {
    setBusy(kind);
    void (kind === "buy" ? buyPro() : restorePro()).then((ok) => {
      setBusy(null);
      if (ok) setPanel(null);
    });
  };
  return (
    <div className="space-y-2">
      <Button variant="primary" className="w-full" disabled={busy !== null} onClick={() => run("buy")}>
        <IconCrown size={16} /> {price ? t("proBuyNow", { price }) : t("proBuyPlain")}
      </Button>
      <p className="text-center text-xs leading-relaxed text-mist-400">{t(platform === "ios" ? "proAppStoreHowTo" : "proPlayHowTo")}</p>
      <Button variant="ghost" className="w-full" disabled={busy !== null} onClick={() => run("restore")}>
        {t("proRestore")}
      </Button>
    </div>
  );
}

export function ProDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "pro");
  const account = useApp((s) => s.account);
  const [checking, setChecking] = useState(false);
  const midiOff = useApp((s) => isNativeApp && !s.midiSupported);
  const perks = [
    t("proPerkMic"),
    ...(midiOff ? [] : [t("proPerkMidi")]),
    t("proPerkFriends"),
    t("proPerkDesigns"),
    t("proPerk1"),
    t("proPerk4"),
    t("proPerk5"),
    t("proPerk6"),
    t("proPerk8"),
    t("proPerk7"),
    t("proPerk2"),
    t("proPerk3"),
  ];
  return (
    <Dialog open={open} onClose={() => setPanel(null)} width="max-w-sm" closeLabel={t("close")} title="">
      <div className="pt-1 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-ink-950 shadow-[0_10px_30px_-10px_rgba(251,191,36,0.8)]">
          <IconCrown size={28} />
        </div>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight">
          Sonatrio <span className="text-amber-300">Pro</span>
        </h2>
        <p className="mt-1 text-sm text-mist-300">{account.pro ? t("proActive") : t("proBody")}</p>
        {!account.pro && trialActive(account) && (
          <p className="mt-2 inline-block rounded-lg bg-amber-300/15 px-2.5 py-1 text-xs font-bold text-amber-200">
            {t("trialActiveTitle", { n: trialDaysLeft(account) })}
          </p>
        )}
      </div>
      <ul className="my-4 space-y-2">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm">
            <IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" />
            {p}
          </li>
        ))}
      </ul>
      {account.pro ? null : account.status !== "signedIn" ? (
        <div className="space-y-2">
          <p className="rounded-xl bg-amber-300/10 px-3 py-2 text-center text-sm font-semibold text-amber-100">
            {t("trialSignUpHint", { n: TRIAL_DAYS })}
          </p>
          <p className="text-center text-xs text-mist-400">{t("proSignInFirst")}</p>
          <Button variant="primary" className="w-full" onClick={() => setPanel("account")}>
            <IconUser size={16} /> {t("signIn")} / {t("signUp")}
          </Button>
        </div>
      ) : canBuyInApp ? (
        <PlayPurchase />
      ) : (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <StoreButton href={STORE_LINKS.googlePlay} label={t("proBuyGoogle")} soon={t("proStoreSoon")} />
            <StoreButton href={STORE_LINKS.appStore} label={t("proBuyApple")} soon={t("proStoreSoon")} />
          </div>
          <p className="text-center text-xs leading-relaxed text-mist-400">{t("proHowTo")}</p>
          <Button
            variant="ghost"
            className="w-full"
            disabled={checking}
            onClick={() => {
              setChecking(true);
              void refreshAccount().then(() => {
                setChecking(false);
                if (useApp.getState().account.pro) toast(t("proUnlocked"), "success");
                else toast(t("proStillLocked"), "info", 4500);
              });
            }}
          >
            {t("proRefresh")}
          </Button>
        </div>
      )}
    </Dialog>
  );
}

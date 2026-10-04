import { useState, type FormEvent, type ReactNode } from "react";
import {
  STORE_LINKS,
  USERNAME_RE,
  refreshAccount,
  sendPasswordReset,
  signInWithPassword,
  signInWithProvider,
  signOut,
  signUp,
  updatePassword,
  usernameAvailable,
  type AuthResult,
} from "../auth/account";
import { useT, type TFn } from "../i18n";
import { setPanel, toast, useApp } from "../state/store";
import { IconApple, IconCheck, IconCloud, IconCrown, IconGoogle, IconShield, IconUser } from "../ui/icons";
import { Button, Dialog, Segmented, cx } from "../ui/primitives";

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
                  <ProviderButton onClick={() => void run(() => signInWithProvider("google"))} icon={<IconGoogle />}>
                    {t("continueGoogle")}
                  </ProviderButton>
                )}
                {providers.apple && (
                  <ProviderButton onClick={() => void run(() => signInWithProvider("apple"))} icon={<IconApple />} dark>
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
          </>
        )}
        {mode === "reset" && <Field label={t("email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}

        {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        {info && <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{info}</p>}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {mode === "signin" ? t("signIn") : mode === "signup" ? t("signUp") : t("sendResetLink")}
        </Button>
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

function SignedIn() {
  const t = useT();
  const account = useApp((s) => s.account);
  const name = account.username ?? account.email ?? "";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-brand-600 text-lg font-extrabold">
          {name.slice(0, 1).toUpperCase() || <IconUser size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{account.username ?? t("signedInAs")}</div>
          <div className="truncate text-xs text-mist-400">{account.email}</div>
        </div>
        {account.pro && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-300/15 px-2 py-1 text-xs font-bold text-amber-200">
            <IconCrown size={13} /> PRO
          </span>
        )}
      </div>
      {account.cloud && (
        <div className="flex items-center gap-2 rounded-2xl border border-sky-300/15 bg-sky-400/[0.07] px-3 py-2.5 text-sm text-sky-100">
          <IconCloud size={16} className="shrink-0 text-sky-300" />
          <span className="min-w-0 flex-1">{t("cloudOn")}</span>
          <span className="text-xs text-mist-400">{account.cloudQuotaMb} MB</span>
        </div>
      )}
      <p className="flex items-center gap-2 px-1 text-xs text-mist-400">
        <IconCloud size={14} className="shrink-0 text-mist-400" />
        {t("settingsSynced")}
      </p>
      {!account.pro && !account.cloud && (
        <Button variant="primary" className="w-full" onClick={() => setPanel("pro")}>
          <IconCrown size={16} /> {t("getPro")}
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
    </div>
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

export function ProDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "pro");
  const account = useApp((s) => s.account);
  const [checking, setChecking] = useState(false);
  const perks = [t("proPerk1"), t("proPerk2"), t("proPerk3")];
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
          <p className="text-center text-xs text-mist-400">{t("proSignInFirst")}</p>
          <Button variant="primary" className="w-full" onClick={() => setPanel("account")}>
            <IconUser size={16} /> {t("signIn")} / {t("signUp")}
          </Button>
        </div>
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

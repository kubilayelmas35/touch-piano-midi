import { useEffect, useState } from "react";
import { FEEDBACK_KINDS, FEEDBACK_MAX, sendFeedback, type FeedbackKind } from "../auth/feedback";
import { useT } from "../i18n";
import { setPanel, toast, useApp } from "../state/store";
import { Button, Dialog, Segmented } from "../ui/primitives";

export function FeedbackDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "feedback");
  const accountEmail = useApp((s) => s.account.email);
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !email && accountEmail) setEmail(accountEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountEmail]);

  const close = () => setPanel(null);

  const submit = async () => {
    setBusy(true);
    const err = await sendFeedback(kind, message, email);
    setBusy(false);
    if (!err) {
      toast(t("feedbackSent"), "success", 4200);
      setMessage("");
      close();
      return;
    }
    const msg = {
      disabled: t("feedbackErrDisabled"),
      short: t("feedbackErrShort"),
      rate: t("feedbackErrRate"),
      network: t("feedbackErrNetwork"),
    }[err];
    toast(msg, "error", 4200);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("feedbackTitle")}
      closeLabel={t("close")}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t("cancel")}
          </Button>
          <Button variant="primary" disabled={busy || message.trim().length < 3} onClick={() => void submit()}>
            {t("feedbackSend")}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-mist-300">{t("feedbackIntro")}</p>
      <div className="mb-1.5 text-xs font-semibold text-mist-400">{t("feedbackKind")}</div>
      <Segmented
        className="mb-4 w-full"
        label={t("feedbackKind")}
        value={kind}
        onChange={setKind}
        options={FEEDBACK_KINDS.map((k) => ({ value: k, label: t(`feedbackKind_${k}`) }))}
      />
      <label className="block">
        <span className="mb-1.5 flex justify-between text-xs font-semibold text-mist-400">
          {t("feedbackMessage")}
          <span className="tabular-nums">
            {message.length}/{FEEDBACK_MAX}
          </span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, FEEDBACK_MAX))}
          placeholder={t("feedbackPlaceholder")}
          rows={6}
          className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-brand-400"
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-semibold text-mist-400">{t("feedbackEmail")}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          maxLength={320}
          className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-brand-400"
        />
      </label>
      <p className="mt-3 text-xs text-mist-500">{t("feedbackDeviceNote")}</p>
    </Dialog>
  );
}

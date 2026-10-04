import { useT } from "../i18n";
import { askReminderPermission, remindersSupported } from "../lib/reminders";
import { updateSettings } from "../state/actions";
import { useApp } from "../state/store";
import { IconBell } from "../ui/icons";
import { Switch } from "../ui/primitives";

const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function fromTime(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  return m ? Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2])) : null;
}

async function setReminder(on: boolean): Promise<void> {
  if (on && !(await askReminderPermission())) return;
  updateSettings({ reminder: on });
}

function TimeInput() {
  const t = useT();
  const at = useApp((s) => s.settings.reminderAt);
  return (
    <input
      type="time"
      value={toTime(at)}
      aria-label={t("reminderTime")}
      onChange={(e) => {
        const v = fromTime(e.target.value);
        if (v !== null) updateSettings({ reminderAt: v });
      }}
      className="h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-mist-100 tabular-nums outline-none focus:border-brand-400/60 [color-scheme:dark]"
    />
  );
}

/** Progress panel streak card: turn the daily reminder on, or change its time. App only. */
export function ReminderToggle() {
  const t = useT();
  const on = useApp((s) => s.settings.reminder);
  if (!remindersSupported) return null;
  if (on) return <TimeInput />;
  return (
    <button
      type="button"
      onClick={() => void setReminder(true)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-orange-100 transition-colors hover:bg-white/15"
    >
      <IconBell size={14} />
      {t("reminderTurnOn")}
    </button>
  );
}

/** Settings: the daily reminder switch and its time. App only. */
export function ReminderSettings() {
  const t = useT();
  const on = useApp((s) => s.settings.reminder);
  if (!remindersSupported) return null;
  return (
    <>
      <Switch label={t("reminder")} hint={t("reminderHint")} checked={on} onChange={(v) => void setReminder(v)} />
      {on && (
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-sm font-medium">{t("reminderTime")}</span>
          <TimeInput />
        </div>
      )}
    </>
  );
}

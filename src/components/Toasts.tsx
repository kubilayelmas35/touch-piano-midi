import { useApp } from "../state/store";
import { cx } from "../ui/primitives";

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={cx(
            "glass pointer-events-auto max-w-md rounded-2xl px-4 py-2.5 text-sm font-medium shadow-xl animate-slide-up",
            t.kind === "error" && "border-rose-400/30 text-rose-100",
            t.kind === "success" && "border-emerald-400/30 text-emerald-100"
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

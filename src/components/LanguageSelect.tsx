import { useEffect, useId, useRef, useState } from "react";
import { LANGUAGE_OPTIONS } from "../i18n";
import type { Language } from "../state/settings";
import { IconChevronDown } from "../ui/icons";
import { cx } from "../ui/primitives";

/** Compact language picker — works with 70+ locales without wrapping into a chip wall. */
export function LanguageSelect({
  value,
  onChange,
  label,
  className,
}: {
  value: Language;
  onChange: (v: Language) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = LANGUAGE_OPTIONS.find((o) => o.value === value) ?? LANGUAGE_OPTIONS[0];
  const filtered = q.trim()
    ? LANGUAGE_OPTIONS.filter(
        (o) =>
          o.label.toLowerCase().includes(q.trim().toLowerCase()) ||
          o.value.toLowerCase().includes(q.trim().toLowerCase())
      )
    : LANGUAGE_OPTIONS;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <div ref={root} className={cx("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 max-w-[14rem] items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 text-sm font-semibold text-mist-100 shadow-inner transition hover:border-brand-400/40 hover:bg-black/50"
      >
        <span className="truncate">{current.label}</span>
        <IconChevronDown size={14} className={cx("shrink-0 text-mist-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
          role="presentation"
        >
          <div className="border-b border-white/8 p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={label}
              className="h-9 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-brand-400/50"
            />
          </div>
          <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
            {filtered.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cx(
                      "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                      active
                        ? "bg-brand-500/25 text-brand-100"
                        : "text-mist-200 hover:bg-white/[0.06] hover:text-white"
                    )}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-mist-500">{o.value}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-mist-500">{label}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

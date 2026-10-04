import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { IconClose } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "ghost" | "subtle" | "danger";

export function Button({
  variant = "subtle",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background,box-shadow,transform,color] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 select-none whitespace-nowrap",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" &&
          "bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.8)] hover:from-brand-300 hover:to-brand-500",
        variant === "subtle" && "bg-white/[0.06] text-mist-100 hover:bg-white/[0.11] border border-white/[0.06]",
        variant === "ghost" && "text-mist-300 hover:text-mist-100 hover:bg-white/[0.06]",
        variant === "danger" && "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 border border-rose-400/20",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  active,
  className,
  children,
  size = "md",
  showLabel,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.94] select-none",
        size === "sm" && "h-8 min-w-8 px-1.5",
        size === "md" && "h-10 min-w-10 px-2",
        size === "lg" && "h-12 min-w-12 px-3",
        active
          ? "bg-brand-500/25 text-brand-300 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.45)]"
          : "text-mist-300 hover:text-mist-100 hover:bg-white/[0.07]",
        className
      )}
      {...rest}
    >
      {children}
      {showLabel && <span className="text-[13px] font-semibold">{label}</span>}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <div className="text-sm font-medium text-mist-100">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-mist-400">{hint}</div>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand-500" : "bg-white/15"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-mist-100">
          {label}
        </label>
        <span className="text-xs font-semibold tabular-nums text-brand-300">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <div className="text-xs text-mist-400">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex rounded-xl bg-black/30 p-1 border border-white/[0.06]", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-150 whitespace-nowrap",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
            value === o.value
              ? "bg-gradient-to-b from-brand-400/90 to-brand-600/90 text-white shadow"
              : "text-mist-300 hover:text-mist-100"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const OVERLAY_EVENT = "sonatrio:overlay";

/** Tells the app a dialog or menu opened, so playback can pause behind it. */
function overlayOpened(): void {
  window.dispatchEvent(new Event(OVERLAY_EVENT));
}

/** Modal built on <dialog> for focus trapping and Esc handling. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  toolbar,
  width = "max-w-lg",
  side,
  labelledBy,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Fixed content between the title and the scrolling body (e.g. tabs). */
  toolbar?: ReactNode;
  width?: string;
  side?: "left" | "right";
  labelledBy?: string;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      overlayOpened();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        side ? "m-0 h-dvh max-h-dvh" : "m-auto w-[calc(100vw-24px)]",
        side === "left" && "mr-auto",
        side === "right" && "ml-auto",
        side ? "w-[min(420px,100vw)]" : width
      )}
    >
      {open && (
        <div
          className={cx(
            "glass flex flex-col overflow-hidden text-mist-100",
            side ? "h-full rounded-none sm:rounded-r-3xl" : "max-h-[min(86dvh,760px)] rounded-3xl animate-pop",
            side === "left" && "animate-slide-left border-l-0",
            side === "right" && "animate-slide-left border-r-0 sm:rounded-r-none sm:rounded-l-3xl"
          )}
        >
          {title !== undefined && (
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
              <h2 id={titleId} className="min-w-0 truncate text-lg font-bold tracking-tight">
                {title}
              </h2>
              <IconButton label={closeLabel} onClick={onClose} size="sm">
                <IconClose size={18} />
              </IconButton>
            </div>
          )}
          {toolbar && <div className="px-5 pb-4">{toolbar}</div>}
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function useClickOutside(refs: RefObject<HTMLElement | null>[], onOutside: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      onOutside();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOutside();
    };
    document.addEventListener("pointerdown", handler, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", handler, true);
      document.removeEventListener("keydown", key);
    };
  }, [enabled, onOutside, refs]);
}

/** Small anchored popover panel. */
export function Popover({
  trigger,
  children,
  align = "center",
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: RefObject<HTMLButtonElement | null> }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "center" | "end";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const refs = useRef([btn, panel]).current as RefObject<HTMLElement | null>[];
  const close = useRef(() => setOpen(false)).current;
  useClickOutside(refs, close, open);
  return (
    <div className="relative">
      {trigger({
        open,
        toggle: () => {
          if (!open) overlayOpened();
          setOpen(!open);
        },
        ref: btn,
      })}
      {open && (
        <div
          ref={panel}
          role="dialog"
          data-popover-open=""
          aria-label={label}
          className={cx(
            "glass absolute top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-16px)] rounded-2xl p-3 animate-pop",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "start" && "left-0",
            align === "end" && "right-0"
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

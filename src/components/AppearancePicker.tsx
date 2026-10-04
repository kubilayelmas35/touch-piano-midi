import type { CSSProperties, ReactNode } from "react";
import type { Background, EffectStyle, NoteStyle } from "../render/appearance";
import { cx } from "../ui/primitives";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  preview: ReactNode;
}

/** A row of picture cards; the preview shows what each option looks like. */
export function ChoiceCards<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cx("py-2", disabled && "pointer-events-none opacity-40")}>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cx(
                "overflow-hidden rounded-xl border text-left transition",
                active ? "border-brand-400/80 ring-2 ring-brand-400/35" : "border-white/10 hover:border-white/25"
              )}
            >
              <div className="relative h-14 w-full overflow-hidden bg-ink-950">{o.preview}</div>
              <div className={cx("truncate px-2 py-1.5 text-xs font-semibold", active ? "text-mist-100" : "text-mist-300")}>{o.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const BG_PREVIEW: Record<Background, string> = {
  night:
    "radial-gradient(1px 1px at 20% 30%, #c8d2ff 50%, transparent), radial-gradient(1px 1px at 70% 60%, #c8d2ff 50%, transparent), linear-gradient(#070a1a, #121633)",
  space:
    "radial-gradient(1.5px 1.5px at 15% 25%, #fff 50%, transparent), radial-gradient(1px 1px at 60% 15%, #fff 50%, transparent), radial-gradient(1px 1px at 85% 70%, #fff 50%, transparent), radial-gradient(circle at 30% 35%, rgba(124,58,237,0.65), transparent 50%), radial-gradient(circle at 78% 70%, rgba(37,99,235,0.55), transparent 45%), radial-gradient(circle at 60% 20%, rgba(219,39,119,0.35), transparent 40%), #02030b",
  aurora:
    "linear-gradient(165deg, transparent 18%, rgba(52,211,153,0.6) 32%, transparent 52%), linear-gradient(195deg, transparent 32%, rgba(167,139,250,0.5) 48%, transparent 68%), linear-gradient(#020712, #0a1024)",
  synth:
    "radial-gradient(circle at 50% 42%, rgba(253,224,71,0.85) 0 16%, transparent 17%), repeating-linear-gradient(0deg, rgba(236,72,153,0.55) 0 1px, transparent 1px 7px) bottom / 100% 55% no-repeat, linear-gradient(#07021a, #2a0a3e)",
  plain: "#090b17",
};

export function BackgroundSwatch({ bg }: { bg: Background }) {
  return <div className="absolute inset-0" style={{ background: BG_PREVIEW[bg] }} />;
}

function swatchNote(style: NoteStyle, color: string, light: string): { head: CSSProperties; tail: CSSProperties } {
  switch (style) {
    case "neon":
      return {
        head: { height: "34%", border: `2px solid ${light}`, background: "rgba(8,10,26,0.8)", borderRadius: 6, boxShadow: `0 0 8px ${color}` },
        tail: { width: "46%", border: `1.5px solid ${color}`, background: `linear-gradient(transparent, ${color}55)`, borderRadius: 99 },
      };
    case "classic":
      return {
        head: { height: "100%", background: `linear-gradient(${color}44, ${color} 60%, ${light})`, borderRadius: 8, boxShadow: `0 0 10px ${color}88` },
        tail: { display: "none" },
      };
    case "minimal":
      return {
        head: { height: "30%", background: color, borderRadius: 5 },
        tail: { width: "52%", background: `${color}88`, borderRadius: 99 },
      };
    default:
      return {
        head: { height: "32%", background: `linear-gradient(${light}, ${color} 55%, ${color}aa)`, borderRadius: 7, boxShadow: `0 0 10px ${color}` },
        tail: { width: "74%", background: `linear-gradient(90deg, ${color}66, ${light}, ${color}66)`, opacity: 0.9, borderRadius: 6 },
      };
  }
}

export function NoteSwatch({ style }: { style: NoteStyle }) {
  const notes: [string, string, string, string][] = [
    ["#38d6ff", "#bdf3ff", "22%", "70%"],
    ["#c084fc", "#ecd9ff", "56%", "88%"],
  ];
  return (
    <div className="absolute inset-0 bg-[linear-gradient(#070a1a,#121633)]">
      {notes.map(([color, light, left, h]) => {
        const s = swatchNote(style, color, light);
        return (
          <div key={color} className="absolute bottom-1 flex w-[22%] flex-col items-center justify-end" style={{ left, height: h }}>
            <div className="w-full flex-1" style={{ ...s.tail, marginBottom: -4 }} />
            <div className="w-full" style={s.head} />
          </div>
        );
      })}
    </div>
  );
}

export function EffectSwatch({ style }: { style: EffectStyle }) {
  const base = "absolute inset-0 bg-[linear-gradient(#070a1a,#121633)]";
  if (style === "fire") {
    return (
      <div className={base}>
        <div className="absolute inset-x-0 bottom-0 h-full" style={{ background: "radial-gradient(ellipse 45% 70% at 50% 100%, #fff7c2, #fde047 25%, #fb923c 50%, rgba(239,68,68,0.5) 70%, transparent 80%)" }} />
      </div>
    );
  }
  if (style === "glow") {
    return (
      <div className={base}>
        <div className="absolute inset-x-0 bottom-0 h-full" style={{ background: "radial-gradient(ellipse 40% 60% at 50% 100%, #ffffff, rgba(167,139,250,0.7) 40%, transparent 75%)" }} />
        <div className="absolute bottom-1 left-1/2 h-3 w-14 -translate-x-1/2 rounded-[50%] border-2 border-violet-300/80" />
      </div>
    );
  }
  const rays = style === "sparks" ? [-60, -40, -20, 20, 40, 60, -75, 75] : [];
  const stars: [string, string, number][] = style === "stars" ? [["18%", "30%", 10], ["70%", "22%", 12], ["40%", "12%", 8], ["82%", "55%", 9], ["28%", "58%", 7]] : [];
  return (
    <div className={base}>
      <div className="absolute inset-x-0 bottom-0 h-full" style={{ background: "radial-gradient(ellipse 30% 45% at 50% 100%, #ffffff, rgba(56,214,255,0.6) 45%, transparent 75%)" }} />
      {rays.map((a, i) => (
        <span
          key={a}
          className="absolute bottom-1 left-1/2 h-[2px] origin-left rounded-full"
          style={{ width: 14 + (i % 3) * 6, transform: `rotate(${a - 90}deg) translateX(${10 + (i % 2) * 6}px)`, background: i % 2 ? "#fff" : "#7dd3fc" }}
        />
      ))}
      {stars.map(([left, top, size]) => (
        <span key={left} className="absolute text-white" style={{ left, top, fontSize: size, textShadow: "0 0 6px #a5f3fc" }}>
          ✦
        </span>
      ))}
    </div>
  );
}

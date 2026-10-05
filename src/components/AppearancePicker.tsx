import type { CSSProperties, ReactNode } from "react";
import {
  COLOR_PRESETS,
  paletteColor,
  type ApproachStyle,
  type Background,
  type ColorChoice,
  type DustStyle,
  type EffectStyle,
  type NoteColor,
  type NoteStyle,
} from "../render/appearance";
import { HAND_INK, STAFF_THEMES, type StaffStyle } from "../render/staffThemes";
import { cx } from "../ui/primitives";

/** A bit of the scrolling staff in the given look: five lines, a few notes, the playhead. */
export function StaffSwatch({ style }: { style: StaffStyle }) {
  const th = STAFF_THEMES[style];
  const notes: [number, number, boolean, string][] = [
    [30, 34, false, th.judged.perfect],
    [48, 26, false, th.handColors ? HAND_INK[0] : th.ink],
    [66, 30, true, th.handColors ? HAND_INK[0] : th.ink],
    [84, 38, false, th.handColors ? HAND_INK[1] : th.ink],
  ];
  return (
    <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`staff-${style}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={th.bg[0]} />
          <stop offset="1" stopColor={th.bg[1]} />
        </linearGradient>
      </defs>
      <rect width="100" height="56" fill={`url(#staff-${style})`} />
      {[14, 22, 30, 38, 46].map((y) => (
        <rect key={y} x="0" y={y} width="100" height="0.8" fill={th.line} />
      ))}
      <rect x="57" y="14" width="0.8" height="32" fill={th.bar} />
      <rect x="37" y="0" width="12" height="56" fill={th.playheadGlow} opacity="0.5" />
      {notes.map(([x, y, hollow, color]) => (
        <g key={x} transform={`rotate(-19 ${x} ${y})`} style={th.glow ? { filter: `drop-shadow(0 0 2px ${color})` } : undefined}>
          <ellipse cx={x} cy={y} rx="4.6" ry="3.2" fill={hollow ? "none" : color} stroke={color} strokeWidth={hollow ? 1.4 : 0} />
        </g>
      ))}
      {notes.map(([x, y, , color]) => (
        <rect key={`s${x}`} x={x + 3.6} y={y - 17} width="0.9" height="17" fill={color} />
      ))}
      <rect x="42.6" y="0" width="1.4" height="56" fill={th.playhead} />
    </svg>
  );
}

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
  haze:
    "radial-gradient(1px 1px at 20% 30%, #c4b5fd 50%, transparent), radial-gradient(1px 1px at 40% 70%, #a78bfa 50%, transparent), radial-gradient(1px 1px at 75% 45%, #c4b5fd 50%, transparent), radial-gradient(1px 1px at 88% 20%, #a78bfa 50%, transparent), radial-gradient(circle at 30% 75%, rgba(124,58,237,0.5), transparent 45%), radial-gradient(circle at 75% 60%, rgba(139,92,246,0.4), transparent 40%), #05030c",
  ocean:
    "linear-gradient(160deg, transparent 30%, rgba(125,211,252,0.18) 40%, transparent 50%), linear-gradient(200deg, transparent 45%, rgba(125,211,252,0.12) 55%, transparent 62%), radial-gradient(circle at 50% 0%, rgba(56,189,248,0.4), transparent 60%), linear-gradient(#04304d, #010a17)",
  sunset:
    "radial-gradient(circle at 50% 62%, #fff1c1 0 9%, transparent 10%), linear-gradient(170deg, transparent 58%, #3a1640 59%) bottom / 100% 100% no-repeat, linear-gradient(#140b2e, #8a2c6b 45%, #f59e5b 62%, #200d2c 63%)",
  city:
    "radial-gradient(circle at 80% 22%, #e9ecff 0 6%, transparent 7%), linear-gradient(90deg, #06071a 0 14%, transparent 14% 18%, #06071a 18% 34%, transparent 34% 40%, #06071a 40% 52%, transparent 52% 58%, #06071a 58% 78%, transparent 78% 82%, #06071a 82%) bottom / 100% 45% no-repeat, linear-gradient(#03050f, #2a1450)",
  matrix:
    "repeating-linear-gradient(90deg, transparent 0 9px, rgba(34,197,94,0.35) 9px 11px, transparent 11px 22px), linear-gradient(transparent, rgba(34,197,94,0.15)), #010604",
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
    case "block":
      return {
        head: { height: "100%", background: color, borderRadius: 3, boxShadow: `inset 0 -2px 0 ${light}` },
        tail: { display: "none" },
      };
    case "glass":
      return {
        head: { height: "32%", background: `linear-gradient(rgba(255,255,255,0.35), ${color}99)`, border: "1.5px solid rgba(255,255,255,0.7)", borderRadius: 7 },
        tail: { width: "60%", background: `linear-gradient(transparent, ${color}55)`, border: "1px solid rgba(255,255,255,0.25)", borderRadius: 6 },
      };
    case "capsule":
      return {
        head: { height: "100%", background: `linear-gradient(90deg, ${color}aa, ${light}, ${color}aa)`, borderRadius: 99, boxShadow: `0 0 8px ${color}88` },
        tail: { display: "none" },
      };
    case "pixel":
      return {
        head: { height: "30%", background: color, boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.5), inset -2px -2px 0 rgba(0,0,0,0.3)" },
        tail: { width: "46%", background: `repeating-linear-gradient(${color}bb 0 6px, transparent 6px 8px)` },
      };
    case "candy":
      return {
        head: { height: "32%", background: `repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 4px, transparent 4px 8px), linear-gradient(${light}, ${color})`, borderRadius: 8 },
        tail: { width: "60%", background: `repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0 4px, transparent 4px 8px), ${color}aa`, borderRadius: 99 },
      };
    case "crystal":
      return {
        head: { height: "36%", background: `linear-gradient(135deg, ${light}, ${color} 50%, ${color}88)`, clipPath: "polygon(50% 0, 100% 30%, 100% 70%, 50% 100%, 0 70%, 0 30%)" },
        tail: { width: "18%", background: `linear-gradient(transparent, ${color})`, borderRadius: 99 },
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

/** Deterministic scatter of [left%, top%, size, colour index] for swatch particles. */
const SCATTER: [number, number, number, number][] = [
  [12, 30, 5, 0], [24, 60, 4, 1], [33, 18, 6, 2], [44, 46, 4, 3], [52, 12, 5, 4], [61, 64, 6, 5],
  [70, 28, 4, 0], [79, 52, 5, 1], [87, 20, 4, 2], [18, 80, 4, 3], [83, 78, 5, 4], [40, 74, 4, 5],
];

function Bits({ colors, shape }: { colors: string[]; shape: (size: number, color: string, i: number) => CSSProperties }) {
  return (
    <>
      {SCATTER.map(([left, top, size, c], i) => (
        <span key={i} className="absolute" style={{ left: `${left}%`, top: `${top}%`, ...shape(size, colors[c % colors.length], i) }} />
      ))}
    </>
  );
}

export function EffectSwatch({ style }: { style: EffectStyle }) {
  const base = "absolute inset-0 bg-[linear-gradient(#070a1a,#121633)]";
  if (style === "notes") {
    return (
      <div className={base}>
        {(["♪", "♫", "♩", "♬", "♪"] as const).map((g, i) => (
          <span key={i} className="absolute font-bold" style={{ left: `${12 + i * 17}%`, top: `${[40, 12, 52, 20, 5][i]}%`, fontSize: 12 + (i % 3) * 3, color: i % 2 ? "#fff" : "#7dd3fc", textShadow: "0 0 6px #38d6ff" }}>
            {g}
          </span>
        ))}
      </div>
    );
  }
  if (style === "confetti") {
    return (
      <div className={base}>
        <Bits colors={["#f472b6", "#facc15", "#38d6ff", "#4ade80", "#a78bfa", "#fb923c"]} shape={(s, c, i) => ({ width: s + 2, height: s / 2, background: c, transform: `rotate(${i * 37}deg)` })} />
      </div>
    );
  }
  if (style === "bubbles") {
    return (
      <div className={base}>
        <Bits colors={["#7dd3fc", "#ffffff", "#a5f3fc"]} shape={(s, c) => ({ width: s * 1.8, height: s * 1.8, borderRadius: 99, border: `1px solid ${c}` })} />
      </div>
    );
  }
  if (style === "lightning") {
    return (
      <div className={base}>
        <svg viewBox="0 0 100 56" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="50,56 44,40 54,32 42,18 50,10 44,0" fill="none" stroke="#a5b4fc" strokeWidth="4" opacity="0.5" />
          <polyline points="50,56 44,40 54,32 42,18 50,10 44,0" fill="none" stroke="#fff" strokeWidth="1.5" />
          <polyline points="56,56 64,44 58,36 70,24" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.8" />
        </svg>
      </div>
    );
  }
  if (style === "petals") {
    return (
      <div className={base}>
        <Bits colors={["#fbcfe8", "#f9a8d4", "#fda4af", "#ffffff"]} shape={(s, c, i) => ({ width: s + 3, height: (s + 3) / 2, borderRadius: "50%", background: c, transform: `rotate(${i * 53}deg)` })} />
      </div>
    );
  }
  if (style === "pixels") {
    return (
      <div className={base}>
        <Bits colors={["#38d6ff", "#ffffff", "#c084fc"]} shape={(s, c) => ({ width: s > 5 ? 6 : 4, height: s > 5 ? 6 : 4, background: c })} />
      </div>
    );
  }
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

/** [left %, top %] of the sample columns; top also drives gradient palettes. */
const COLUMNS: [number, number][] = [
  [8, 8],
  [30, 48],
  [52, 22],
  [74, 58],
];

const SAMPLE_MIDI = [60, 66, 69, 50];

export function ColorSwatch({ color, choice }: { color: NoteColor; choice: ColorChoice }) {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(#070a1a,#121633)]">
      {COLUMNS.map(([left, top], i) => {
        const hand = i % 2 ? "#c084fc" : "#38d6ff";
        const midi = color === "rainbow" ? 60 + i * 3 : color === "octave" ? 36 + i * 12 : SAMPLE_MIDI[i];
        const c = color === "auto" ? hand : paletteColor(color, hand, midi, i === 1, (top + 15) / 80, choice);
        return <div key={i} className="absolute h-[30%] w-[16%] rounded-[4px]" style={{ left: `${left}%`, top: `${top}%`, background: c, boxShadow: `0 0 8px ${c}88` }} />;
      })}
    </div>
  );
}

/** Preset colour dots plus a free colour wheel (native colour input). */
export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <div className="py-2">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <span className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-white/30" style={{ background: value }} />
        {label}
      </div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={c}
            onClick={() => onChange(c)}
            className={cx(
              "h-8 w-8 rounded-full transition",
              value === c ? "ring-2 ring-white ring-offset-2 ring-offset-ink-900" : "ring-1 ring-white/15 hover:scale-110"
            )}
            style={{ background: c, boxShadow: `0 0 10px ${c}55` }}
          />
        ))}
        <label
          className={cx(
            "relative h-8 w-8 cursor-pointer overflow-hidden rounded-full transition hover:scale-110",
            !(COLOR_PRESETS as readonly string[]).includes(value) ? "ring-2 ring-white ring-offset-2 ring-offset-ink-900" : "ring-1 ring-white/15"
          )}
          style={{ background: "conic-gradient(#f43f5e, #facc15, #4ade80, #22d3ee, #6366f1, #e879f9, #f43f5e)" }}
          title={label}
        >
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

const DUST_PREVIEW: Record<DustStyle, string> = {
  off: "none",
  smoke:
    "radial-gradient(1px 1px at 30% 30%, #c4b5fd 50%, transparent), radial-gradient(1px 1px at 66% 22%, #a78bfa 50%, transparent), radial-gradient(1px 1px at 72% 62%, #c4b5fd 50%, transparent), radial-gradient(1px 1px at 26% 70%, #a78bfa 50%, transparent), radial-gradient(ellipse 30% 55% at 42% 60%, rgba(139,92,246,0.4), transparent 75%), radial-gradient(ellipse 28% 50% at 60% 35%, rgba(124,58,237,0.32), transparent 75%)",
  sparkle:
    "radial-gradient(1.5px 1.5px at 30% 40%, #fff 50%, transparent), radial-gradient(1.5px 1.5px at 62% 30%, #c4b5fd 50%, transparent), radial-gradient(1.5px 1.5px at 70% 66%, #fff 50%, transparent), radial-gradient(1.5px 1.5px at 22% 70%, #a78bfa 50%, transparent), radial-gradient(1.5px 1.5px at 44% 18%, #c4b5fd 50%, transparent), radial-gradient(ellipse 40% 45% at 50% 85%, rgba(139,92,246,0.35), transparent 75%)",
  nebula:
    "radial-gradient(1.5px 1.5px at 70% 25%, #fff 50%, transparent), radial-gradient(circle at 30% 40%, rgba(236,72,153,0.45), transparent 40%), radial-gradient(circle at 68% 60%, rgba(59,130,246,0.45), transparent 42%), radial-gradient(circle at 50% 25%, rgba(168,85,247,0.4), transparent 40%)",
  fog: "radial-gradient(ellipse 70% 22% at 50% 82%, rgba(199,210,254,0.45), transparent 75%), radial-gradient(ellipse 60% 18% at 35% 68%, rgba(167,139,250,0.3), transparent 75%)",
  embers:
    "radial-gradient(2px 2px at 30% 60%, #fde68a 50%, transparent), radial-gradient(2px 2px at 60% 35%, #fb923c 50%, transparent), radial-gradient(2px 2px at 72% 70%, #fde68a 50%, transparent), radial-gradient(2px 2px at 42% 20%, #f97316 50%, transparent), radial-gradient(2px 2px at 20% 30%, #fb923c 50%, transparent), radial-gradient(ellipse 40% 30% at 50% 100%, rgba(251,146,60,0.35), transparent 75%)",
  stardust: "radial-gradient(ellipse 40% 60% at 50% 70%, rgba(196,181,253,0.18), transparent 75%)",
  fountain: "radial-gradient(ellipse 35% 25% at 50% 95%, rgba(139,92,246,0.4), transparent 75%)",
  plume:
    "radial-gradient(ellipse 22% 26% at 46% 30%, rgba(167,139,250,0.45), transparent 75%), radial-gradient(ellipse 26% 30% at 56% 55%, rgba(139,92,246,0.4), transparent 75%), radial-gradient(ellipse 30% 25% at 50% 85%, rgba(124,58,237,0.35), transparent 75%)",
  rays: "radial-gradient(ellipse 30% 20% at 50% 100%, rgba(196,181,253,0.35), transparent 75%)",
};

/** [angle from vertical (deg), length %, opacity] of the streaks drawn for the jet styles. */
const JETS: Record<"fountain" | "plume" | "rays", [number, number, number][]> = {
  fountain: [[-38, 42, 0.7], [-20, 70, 0.9], [-6, 86, 1], [10, 78, 0.9], [26, 58, 0.8], [44, 38, 0.6], [-52, 28, 0.5], [56, 26, 0.5]],
  plume: [[-24, 64, 0.8], [-8, 80, 0.9], [14, 70, 0.8], [30, 50, 0.6]],
  rays: [[-14, 96, 0.8], [-6, 100, 1], [2, 96, 0.9], [9, 100, 0.8], [16, 90, 0.7]],
};

export function DustSwatch({ style }: { style: DustStyle }) {
  return (
    <div className="absolute inset-0 bg-[#05030c]">
      <div className="absolute inset-0" style={{ background: DUST_PREVIEW[style] }} />
      {style === "stardust" &&
        SCATTER.slice(0, 7).map(([left, top, size], i) => (
          <span key={i} className="absolute text-white" style={{ left: `${left}%`, top: `${top}%`, fontSize: size + 3, textShadow: "0 0 5px #c4b5fd" }}>
            ✦
          </span>
        ))}
      {(style === "fountain" || style === "plume" || style === "rays") &&
        JETS[style].map(([deg, len, op], i) => (
          <span
            key={i}
            className="absolute bottom-[36%] left-1/2 w-[1.5px] origin-bottom rounded-full"
            style={{
              height: `${len * 0.6}%`,
              opacity: op,
              transform: `translateX(-50%) rotate(${deg}deg)`,
              background: `linear-gradient(${i % 2 ? "#ffffff" : "#c4b5fd"}, transparent)`,
            }}
          />
        ))}
      {style === "fountain" &&
        SCATTER.slice(0, 8).map(([left, top], i) => (
          <span key={`d${i}`} className="absolute h-[2px] w-[2px] rounded-full bg-violet-200" style={{ left: `${left}%`, top: `${top * 0.6}%`, opacity: 0.8 }} />
        ))}
      <div
        className={cx(
          "absolute bottom-0 left-1/2 w-[14%] -translate-x-1/2 rounded-t-[3px] bg-violet-500/90",
          style === "fountain" || style === "plume" || style === "rays" ? "h-[38%]" : "h-[70%]"
        )}
      />
    </div>
  );
}

/** A falling note above the hit line with the lane effect between them. */
export function ApproachSwatch({ style }: { style: ApproachStyle }) {
  const c = "#38d6ff";
  return (
    <div className="absolute inset-0 bg-[linear-gradient(#070a1a,#121633)]">
      <div className="absolute inset-x-0 bottom-1 h-[2px] bg-violet-400/80" />
      {style === "beam" && <div className="absolute bottom-1 left-[40%] h-[60%] w-[20%]" style={{ background: `linear-gradient(transparent, ${c}99)` }} />}
      {style === "arrows" &&
        [34, 54, 74].map((top) => (
          <span key={top} className="absolute left-1/2 -translate-x-1/2 text-[9px] leading-none" style={{ top: `${top}%`, color: c, opacity: 0.3 + top / 120 }}>
            ▼
          </span>
        ))}
      {style === "comet" &&
        [6, 12, 2, 16].map((dy, i) => (
          <span key={i} className="absolute h-1 w-1 rounded-full bg-white" style={{ left: `${42 + i * 5}%`, top: `${dy}%`, opacity: 0.4 + i * 0.12, boxShadow: `0 0 4px ${c}` }} />
        ))}
      {style === "ring" && <div className="absolute bottom-0 left-1/2 h-3 w-10 -translate-x-1/2 rounded-[50%] border-2" style={{ borderColor: c }} />}
      {style === "keyglow" && (
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `radial-gradient(ellipse 22% 70% at 50% 100%, ${c}, transparent 80%)` }} />
      )}
      <div className="absolute left-[40%] top-[22%] h-[22%] w-[20%] rounded-md" style={{ background: `linear-gradient(#bdf3ff, ${c})`, boxShadow: `0 0 8px ${c}` }} />
    </div>
  );
}

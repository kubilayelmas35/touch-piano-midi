import { useState } from "react";
import { cx } from "../ui/primitives";

/** A member's profile picture, or the first letter of their name on a coloured disc. */
export function UserAvatar({ url, name, className, me }: { url?: string | null; name?: string | null; className?: string; me?: boolean }) {
  const [broken, setBroken] = useState<string | null>(null);
  const show = url && broken !== url;
  return (
    <span
      className={cx(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold uppercase",
        !show && (me ? "bg-gradient-to-br from-sky-400 to-brand-600 text-white" : "bg-white/[0.08] text-mist-200"),
        className
      )}
    >
      {show ? (
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} onError={() => setBroken(url)} />
      ) : (
        (name ?? "?").slice(0, 1)
      )}
    </span>
  );
}

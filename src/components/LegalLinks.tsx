import { Fragment } from "react";
import { useT } from "../i18n";
import { openLegal, type LegalPage } from "../lib/legal";
import { useApp } from "../state/store";
import { cx } from "../ui/primitives";

const PAGES: { page: LegalPage; key: "privacyPolicy" | "termsOfUse" | "licenses" }[] = [
  { page: "privacy", key: "privacyPolicy" },
  { page: "terms", key: "termsOfUse" },
  { page: "licenses", key: "licenses" },
];

export function LegalLinks({ className }: { className?: string }) {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  return (
    <p className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist-400", className)}>
      {PAGES.map(({ page, key }, i) => (
        <Fragment key={page}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <button type="button" className="font-semibold text-brand-300 hover:text-brand-200 hover:underline" onClick={() => void openLegal(page, lang)}>
            {t(key)}
          </button>
        </Fragment>
      ))}
    </p>
  );
}

import { SITE_URL, isApp, isNativeApp } from "./platform";

export const CONTACT_EMAIL = "sonatriowebraining@gmail.com";

export type LegalPage = "privacy" | "terms" | "licenses" | "delete-account";

/** The packaged apps open the public site so the pages match what the stores link to. */
export function legalUrl(page: LegalPage, lang: string): string {
  return isApp ? `${SITE_URL}${page}/#${lang}` : `${import.meta.env.BASE_URL}${page}/index.html#${lang}`;
}

export async function openLegal(page: LegalPage, lang: string): Promise<void> {
  const url = legalUrl(page, lang);
  if (isNativeApp) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}

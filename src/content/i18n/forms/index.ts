import "server-only";

import { keepBanglaSuffixes, type Locale } from "@/lib/i18n/config";
import { withOverrides } from "@/lib/i18n/copy-overrides";
import { formsBn } from "./bn";
import { formsEn, type FormText } from "./en";

export type { FormText };

const formsBnDisplay = keepBanglaSuffixes(formsBn);

/**
 * Form text for a language (Server Components only). Pages pass the section a Client
 * Component needs as a prop, so only one language reaches the browser.
 */
export const formText = (locale: Locale): FormText =>
  locale === "bn" ? withOverrides("forms", "bn", formsBnDisplay, keepBanglaSuffixes) : withOverrides("forms", "en", formsEn);

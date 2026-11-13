/**
 * Render-only line-break help. The words never change: a space becomes non-breaking, or an
 * invisible word joiner (U+2060) is added, so a short phrase can't be split across two lines.
 *
 * - a service name that reads as one ("Wash & Iron", "ওয়াশ ও আয়রন");
 * - "(optional)" stays with the word before it;
 * - a number range ("3–4", "১–১৮") and a number with its unit ("48 hours", "৪৮ ঘণ্টা").
 *
 * Use it only where text is displayed, never on values that are posted, compared or put in links.
 */
const NBSP = " ";
const WORD_JOINER = "⁠";
const PHRASES = ["Wash & Iron", "ওয়াশ ও আয়রন"];
const DIGIT = "[0-9০-৯]";

export function keepTogether(text: string): string {
  let out = text;
  for (const phrase of PHRASES) out = out.split(phrase).join(phrase.replace(/ /g, NBSP));
  return out
    .replace(/ \((optional|ঐচ্ছিক)\)/g, `${NBSP}($1)`)
    .replace(new RegExp(`(${DIGIT})–(?=${DIGIT})`, "g"), `$1–${WORD_JOINER}`)
    .replace(new RegExp(`(${DIGIT}) (?=(?:hours?|days?|minutes?|weeks?)(?![A-Za-z])|ঘণ্টা|দিন|মিনিট|সপ্তাহ)`, "g"), `$1${NBSP}`);
}

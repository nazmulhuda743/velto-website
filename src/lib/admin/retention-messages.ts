/**
 * WhatsApp messages staff send from the Bring-back list. Pure, so it is unit-tested.
 *
 * Plain, personal, no offers or promises: a question about their last order and an easy
 * "just reply" next step. Staff can still edit the text in WhatsApp before sending.
 */
import { greetingName, normaliseBdPhone } from "../customer/validation";

export type RetentionBucket = "second" | "due" | "winback";
export type MessageLang = "bn" | "en";

export type MessageFacts = {
  name: string | null;
  lastOrderNumber: string | null;
  lastServices: string[];
  daysSince: number;
};

const services = (list: string[], lang: MessageLang) =>
  list.map((s) => s.replace("Wash + Iron", lang === "en" ? "Wash & Iron" : "ওয়াশ ও আয়রন").replace("Dry Cleaning", lang === "en" ? "Dry Cleaning" : "ড্রাই ক্লিনিং").replace("Ironing", lang === "en" ? "Ironing" : "আয়রন")).join(", ");

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bnNum = (n: number) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

export function retentionMessage(bucket: RetentionBucket, f: MessageFacts, lang: MessageLang): string {
  const first = greetingName(f.name);
  const svc = services(f.lastServices, lang);
  if (lang === "en") {
    const hi = first ? `Hi ${first}, this is Velto.` : "Hi, this is Velto.";
    if (bucket === "second") {
      const order = f.lastOrderNumber ? ` (${f.lastOrderNumber})` : "";
      return `${hi} We'd love to hear how your first order${order} went. Whenever your next laundry is ready, just reply here and we'll arrange a pickup.`;
    }
    if (bucket === "due") {
      const what = svc ? ` (${svc})` : "";
      return `${hi} It's been about ${f.daysSince} days since your last laundry${what}. Would you like a pickup this week? Just reply and we'll arrange a time.`;
    }
    return `${hi} We haven't collected your laundry in a while. If anything about your last order wasn't right, we'd like to hear it. Whenever you need a pickup, just reply here.`;
  }
  const hi = first ? `হ্যালো ${first}, Velto থেকে বলছি।` : "হ্যালো, Velto থেকে বলছি।";
  if (bucket === "second") {
    const order = f.lastOrderNumber ? ` (${f.lastOrderNumber})` : "";
    return `${hi} আপনার প্রথম অর্ডারটি${order} কেমন লেগেছে জানালে খুব খুশি হব। পরের লন্ড্রির জন্য পিকআপ লাগলে শুধু এই মেসেজের উত্তর দিন, আমরা সময় ঠিক করে নেব।`;
  }
  if (bucket === "due") {
    const what = svc ? ` (${svc})` : "";
    return `${hi} আপনার আগের লন্ড্রি${what} প্রায় ${bnNum(f.daysSince)} দিন আগে নেওয়া হয়েছিল। এই সপ্তাহে পিকআপ লাগবে? উত্তর দিলেই আমরা সময় ঠিক করে নেব।`;
  }
  return `${hi} অনেকদিন আপনার লন্ড্রি নেওয়ার সুযোগ হয়নি। আগের অর্ডারে কোনো সমস্যা হয়ে থাকলে জানাবেন, আমরা শুনতে চাই। আবার পিকআপ লাগলে এই মেসেজের উত্তর দিন।`;
}

/** wa.me link for a Bangladeshi mobile number, or null when the number isn't one. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const local = normaliseBdPhone(phone ?? "");
  return local ? `https://wa.me/88${local}?text=${encodeURIComponent(text)}` : null;
}

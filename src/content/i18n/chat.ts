import type { Locale } from "@/lib/i18n/config";

/**
 * The website chat. Quick questions open with the website's own approved FAQ answers (no wait);
 * anything typed is answered by the chat service, which only states what the website states.
 * It is named "Velto", never presented as a person, and a person is always one tap away.
 */
const en = {
  launcher: "Ask Velto",
  launcherLabel: "Open the Velto chat",
  title: "Velto",
  subtitle: "Usually answers in seconds",
  close: "Close chat",
  restart: "Start again",
  welcome: "Hi! Ask us anything about Velto: prices, pickup and delivery, how long it takes, or which service suits a garment.",
  quickTitle: "Popular questions",
  quick: {
    price: "Check a price",
    turnaround: "How long does it take?",
    area: "Where do you pick up?",
    free: "When is delivery free?",
    stains: "Can every stain come out?",
    person: "Talk to a person",
  },
  priceAsk: "Sure. Which item is it? For example a shirt, saree, blazer or comforter.",
  personReply: "Of course. A person from the Velto team is on WhatsApp.",
  personButton: "Open WhatsApp",
  placeholder: "Type your question…",
  send: "Send",
  typing: "Velto is typing",
  footer: "Automatic replies from Velto.",
  footerPerson: "Talk to a person",
  failed: "Sorry, that didn't go through. Try again, or ask us on WhatsApp.",
  limited: "You're sending messages quickly. Give it a minute, or ask us on WhatsApp.",
  offline: "Typed questions aren't available right now. The quick questions above still work, and the team is on WhatsApp.",
  tooLong: "Please keep it under {n} characters.",
};

export type ChatText = typeof en;

const bn: ChatText = {
  launcher: "Velto-কে জিজ্ঞেস করুন",
  launcherLabel: "Velto চ্যাট খুলুন",
  title: "Velto",
  subtitle: "সাধারণত সেকেন্ডেই উত্তর দেয়",
  close: "চ্যাট বন্ধ করুন",
  restart: "নতুন করে শুরু",
  welcome: "হ্যালো! Velto নিয়ে যা জানতে চান জিজ্ঞেস করুন: দাম, পিকআপ ও ডেলিভারি, কত সময় লাগে, বা কোন পোশাকে কোন সার্ভিস।",
  quickTitle: "জনপ্রিয় প্রশ্ন",
  quick: {
    price: "দাম দেখুন",
    turnaround: "কত সময় লাগে?",
    area: "কোথায় পিকআপ হয়?",
    free: "ডেলিভারি কখন ফ্রি?",
    stains: "সব দাগ কি ওঠে?",
    person: "মানুষের সাথে কথা বলুন",
  },
  priceAsk: "অবশ্যই। কোন আইটেম? যেমন শার্ট, শাড়ি, ব্লেজার বা কমফোর্টার।",
  personReply: "অবশ্যই। Velto টিমের একজন WhatsApp-এ আছেন।",
  personButton: "WhatsApp খুলুন",
  placeholder: "আপনার প্রশ্ন লিখুন…",
  send: "পাঠান",
  typing: "Velto লিখছে",
  footer: "Velto-র স্বয়ংক্রিয় উত্তর।",
  footerPerson: "মানুষের সাথে কথা বলুন",
  failed: "দুঃখিত, পাঠানো যায়নি। আবার চেষ্টা করুন, বা WhatsApp-এ জিজ্ঞেস করুন।",
  limited: "খুব দ্রুত মেসেজ যাচ্ছে। এক মিনিট পর চেষ্টা করুন, বা WhatsApp-এ জিজ্ঞেস করুন।",
  offline: "লিখে প্রশ্ন করা এই মুহূর্তে বন্ধ। ওপরের জনপ্রিয় প্রশ্নগুলো কাজ করছে, আর টিম WhatsApp-এ আছে।",
  tooLong: "অনুগ্রহ করে {n} অক্ষরের মধ্যে লিখুন।",
};

export const chatText = (locale: Locale): ChatText => (locale === "bn" ? bn : en);

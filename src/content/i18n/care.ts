import type { Locale } from "@/lib/i18n/config";

/**
 * Care approval (wash-risk advisory) on the website: the order page section and the account home
 * banner. Risk types come from Velto Ops (order_risks.risk_type) and are shown in customer words.
 */
const en = {
  title: "Your approval is needed",
  intro: "While checking in your order we noticed something that needs your decision before we clean it. Nothing is cleaned until you choose.",
  garments: (n: number) => (n === 1 ? "1 garment" : `${n} garments`),
  photo: (n: number) => `Photo ${n}`,
  approve: "Yes, go ahead",
  approveHint: "Velto cleans these as planned. I understand the risk shown above.",
  decline: "No, don't clean these",
  declineHint: "Velto holds them and contacts you about returning them.",
  questions: "Not sure? Ask us on WhatsApp before you decide.",
  approved: "You approved. We'll clean these as planned.",
  declined: "You chose not to clean these. We'll contact you about returning them.",
  decidedWebsite: "Recorded on the website",
  decidedVelto: "Recorded by Velto",
  change: "Changed your mind? Message us on WhatsApp.",
  failed: "That didn't go through. Try again, or message us on WhatsApp.",
  banner: (n: number) => (n === 1 ? "One order needs your approval" : `${n} orders need your approval`),
  bannerBody: "Nothing is cleaned until you decide.",
  review: "Review",
  types: {
    "Colour may bleed / run": "Colour may run",
    "Dark or red / indigo — loose dye": "Loose dye (dark, red or indigo)",
    "Dust or dirt on collar / cuffs (sets if ironed)": "Dirt on the collar or cuffs may set when ironed",
    "Delicate — beads / sequins / zari work": "Delicate work (beads, sequins or zari)",
    "Dry-clean only — no water wash": "Dry-clean only",
    "Shrinkage risk": "May shrink",
    "Pre-existing damage may worsen": "Existing damage may get worse",
    "Colour-fastness uncertain — needs test": "The colour may not be fast",
    "Embroidery / print may lift": "Embroidery or print may lift",
    "Other — see note": "See the note",
  } as Record<string, string>,
};

export type CareText = typeof en;

const bn: CareText = {
  title: "আপনার সিদ্ধান্ত দরকার",
  intro: "অর্ডার চেক করার সময় এমন কিছু দেখেছি যার জন্য পরিষ্কারের আগে আপনার সিদ্ধান্ত লাগবে। আপনি না বলা পর্যন্ত কিছুই পরিষ্কার হবে না।",
  garments: (n) => `${String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)])}টি কাপড়`,
  photo: (n) => `ছবি ${String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)])}`,
  approve: "হ্যাঁ, পরিষ্কার করুন",
  approveHint: "Velto এগুলো স্বাভাবিকভাবে পরিষ্কার করবে। ওপরের ঝুঁকিটা আমি বুঝেছি।",
  decline: "না, এগুলো পরিষ্কার করবেন না",
  declineHint: "Velto এগুলো রেখে দেবে, আর ফেরত দেওয়ার বিষয়ে আপনার সাথে যোগাযোগ করবে।",
  questions: "নিশ্চিত না? সিদ্ধান্তের আগে WhatsApp-এ জিজ্ঞেস করুন।",
  approved: "আপনি অনুমতি দিয়েছেন। এগুলো স্বাভাবিকভাবে পরিষ্কার হবে।",
  declined: "আপনি এগুলো পরিষ্কার না করতে বলেছেন। ফেরত দেওয়ার বিষয়ে আমরা যোগাযোগ করব।",
  decidedWebsite: "ওয়েবসাইটে লেখা হয়েছে",
  decidedVelto: "Velto লিখে রেখেছে",
  change: "মত বদলেছেন? WhatsApp-এ জানান।",
  failed: "হয়নি। আবার চেষ্টা করুন, বা WhatsApp-এ জানান।",
  banner: (n) => (n === 1 ? "একটা অর্ডারে আপনার সিদ্ধান্ত দরকার" : `${String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)])}টি অর্ডারে আপনার সিদ্ধান্ত দরকার`),
  bannerBody: "আপনি না বলা পর্যন্ত কিছুই পরিষ্কার হবে না।",
  review: "দেখুন",
  types: {
    "Colour may bleed / run": "রং ছড়াতে পারে",
    "Dark or red / indigo — loose dye": "গাঢ়, লাল বা নীল রং উঠতে পারে",
    "Dust or dirt on collar / cuffs (sets if ironed)": "কলার বা হাতার ময়লা আয়রনে বসে যেতে পারে",
    "Delicate — beads / sequins / zari work": "নাজুক কাজ (পুঁতি, চুমকি বা জরি)",
    "Dry-clean only — no water wash": "শুধু ড্রাই ক্লিন",
    "Shrinkage risk": "ছোট হয়ে যেতে পারে",
    "Pre-existing damage may worsen": "আগের ক্ষতি বাড়তে পারে",
    "Colour-fastness uncertain — needs test": "রং পাকা কিনা নিশ্চিত নয়",
    "Embroidery / print may lift": "এমব্রয়ডারি বা প্রিন্ট উঠে যেতে পারে",
    "Other — see note": "নোট দেখুন",
  },
};

export const careText = (locale: Locale): CareText => (locale === "bn" ? bn : en);

import type { Locale } from "../../lib/i18n/config";

/**
 * Copy for the blanket landing page (/blanket-cleaning-uttara). English is the owner's locked copy.
 * Rules (unit-tested with B999_BANNED): no em dashes, no discount or savings wording, never
 * "Wash + Iron" for blankets, no superlative claims. Prices are filled from src/lib/campaigns/b999.ts.
 */
const en = {
  metaTitle: "Blanket Cleaning in Uttara | 3 Blankets ৳999 | Velto",
  metaDescription: "Book doorstep blanket cleaning in Uttara with Velto. 3 regular blankets for ৳999 with pickup and delivery.",
  heroEyebrow: "Blanket cleaning in Uttara",
  heroTitle: "3 Regular Blankets",
  heroSupport: "We pick them up from your Uttara home, wash, dry, fold and pack them, then deliver them back.",
  heroQualifier: "Regular/Medium blankets only. Heavy or oversized blankets are ৳{heavy} each.",
  pickupIncluded: "Pickup & Delivery Included",
  bookPickup: "Book Pickup",
  whatsappUs: "WhatsApp Us",
  heroFacts: ["Uttara Sectors 1 to 18", "Pay at delivery"],

  howTitle: "How it works",
  howSteps: ["Book", "Pickup", "Check, clean, dry", "Fold, pack", "Deliver"],

  qualifyTitle: "Does your blanket qualify?",
  regularTitle: "Regular/Medium",
  regularPrice: "৳{package} for 3",
  regularPoints: ["Normal single or double-bed blanket", "Normal thickness", "Machine-washable", "Not unusually thick, weighted or oversized"],
  heavyTitle: "Heavy/Large",
  heavyPrice: "৳{heavy} each",
  heavyPoints: ["Large or heavy blanket", "Very thick mink or Korean-style blanket"],
  notPartTitle: "Not part of this package",
  notPartPoints: ["Weighted blanket", "Comforter", "Quilt", "Duvet inner", "Specialist-material bedding"],
  notPartNote: "Message us and we'll tell you the price.",
  notSure: "Not sure? Send us a photo",

  pricingTitle: "Clear pricing",
  pricingRows: [
    ["3 Regular/Medium", "৳{package}"],
    ["Each extra Regular", "৳{regular}"],
    ["Each Heavy/Large", "৳{heavy}"],
    ["Heavy in your 3-pack", "+৳{addon} each"],
    ["Only 1 or 2 blankets", "Regular pricing, message us"],
  ] as [string, string][],
  fewerNote: "Have only 1 or 2 blankets? Regular pricing applies. Message us on WhatsApp.",

  promiseTitle: "Our price promise",
  promise:
    "If an item looks heavier or larger than the regular category, we'll confirm the final price with you before processing. We never increase the price without your approval. If you'd rather not upgrade, we return that blanket with your delivery at no charge.",

  detailsTitle: "Practical details",
  details: [
    ["Turnaround", "Usually {min}–{max} days"],
    ["Payment", "At delivery, cash or bKash"],
    ["Area", "Uttara Sectors 1 to 18"],
  ] as [string, string][],

  trustTitle: "Why Velto",
  trustPoints: [
    "Velto outlet in Uttara Sector 11",
    "Every item is tagged at pickup",
    "Each blanket is checked when it arrives",
    "Quality check before it is packed",
    "Our own team picks up and delivers",
  ],

  summaryTitle: "Your booking",
  summaryItems: "3 x Regular/Medium Blankets",
  summaryTotal: "Package total",
  summaryPay: "Pay at delivery",
  summarySmall: "Heavy blankets are ৳{heavy} each and confirmed with you before processing.",

  formTitle: "Book your pickup",
  name: "Name",
  phone: "Phone",
  phoneHint: "Bangladesh mobile number, for example 01712 345678",
  sector: "Sector",
  sectorPlaceholder: "Choose your sector",
  sectorOption: "Sector {n}",
  outside: "Outside Uttara",
  address: "Pickup address",
  addressHint: "House, road and any landmark",
  date: "Pickup date",
  dateHint: "We'll call to confirm the pickup time.",
  noDays: "All pickup days for this package are full right now. Message us on WhatsApp and we'll help.",
  submit: "Book 3 Blankets for ৳{package}",
  sending: "Sending…",
  errors: {
    name: "Write your name.",
    phone: "Enter a Bangladesh mobile number, for example 01712 345678.",
    sector: "Choose your sector.",
    address: "Add your house and road so we can find you.",
    date: "Choose a pickup date.",
    day_full: "That pickup day is full. Please choose the next available day.",
    rate_limited: "We've already received a few requests from this number. Message us on WhatsApp and we'll help.",
    unavailable: "We couldn't send your booking just now. Please try again, or message us on WhatsApp.",
    closed: "This package isn't available right now. Message us on WhatsApp and we'll help.",
  },
  outsideTitle: "We currently serve Uttara Sectors 1 to 18.",
  outsideBody: "Message us on WhatsApp and we'll check availability for your area.",

  successTitle: "Pickup request received.",
  successBody: "We'll confirm your pickup details shortly.",
  successRef: "Booking ID",
  successAddress: "Pickup address",
  successDate: "Pickup date",
  continueWhatsapp: "Continue on WhatsApp",

  faqTitle: "Questions",
  faq: [
    ["What counts as a regular blanket?", "A normal single or double-bed blanket of normal thickness that can be machine-washed. If you're not sure, send us a photo on WhatsApp."],
    ["What if one of my blankets is heavy?", "We confirm the price with you before processing. A heavy blanket in your 3-pack adds ৳{addon}. If you'd rather not, we return it with your delivery at no charge."],
    ["How long does it take?", "Usually {min}–{max} days from pickup to delivery."],
    ["How do I pay?", "At delivery, in cash or by bKash."],
  ] as [string, string][],

  sticky: "Book 3 Blankets for ৳{package}",
  unavailableTitle: "This package is not available right now.",
  unavailableBody: "Message us on WhatsApp and we'll help with your blankets.",
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tomorrow: "Tomorrow",
};

export type B999Text = typeof en;

const bn: B999Text = {
  metaTitle: "উত্তরায় কম্বল পরিষ্কার | ৩টি কম্বল ৳৯৯৯ | Velto",
  metaDescription: "Velto দিয়ে উত্তরায় ঘরে বসে কম্বল পরিষ্কার বুক করুন। পিকআপ ও ডেলিভারিসহ ৩টি রেগুলার কম্বল ৳৯৯৯।",
  heroEyebrow: "উত্তরায় কম্বল পরিষ্কার",
  heroTitle: "৩টি রেগুলার কম্বল",
  heroSupport: "উত্তরায় আপনার বাসা থেকে নিয়ে আসি, ধুয়ে, শুকিয়ে, ভাঁজ করে প্যাক করি, তারপর ফেরত দিয়ে যাই।",
  heroQualifier: "শুধু রেগুলার/মিডিয়াম কম্বল। ভারী বা বড় কম্বল প্রতিটি ৳{heavy}।",
  pickupIncluded: "পিকআপ ও ডেলিভারি সহ",
  bookPickup: "পিকআপ বুক করুন",
  whatsappUs: "WhatsApp করুন",
  heroFacts: ["উত্তরা সেক্টর ১ থেকে ১৮", "ডেলিভারিতে পেমেন্ট"],

  howTitle: "কীভাবে হয়",
  howSteps: ["বুক", "পিকআপ", "চেক, পরিষ্কার, শুকানো", "ভাঁজ, প্যাক", "ডেলিভারি"],

  qualifyTitle: "আপনার কম্বল কি এই প্যাকেজে পড়ে?",
  regularTitle: "রেগুলার/মিডিয়াম",
  regularPrice: "৩টি ৳{package}",
  regularPoints: ["সাধারণ সিঙ্গেল বা ডাবল বেডের কম্বল", "সাধারণ পুরুত্ব", "মেশিনে ধোয়া যায়", "অস্বাভাবিক মোটা, ওজনদার বা খুব বড় নয়"],
  heavyTitle: "ভারী/বড়",
  heavyPrice: "প্রতিটি ৳{heavy}",
  heavyPoints: ["বড় বা ভারী কম্বল", "খুব মোটা মিঙ্ক বা কোরিয়ান কম্বল"],
  notPartTitle: "এই প্যাকেজে পড়ে না",
  notPartPoints: ["ওয়েটেড কম্বল", "কমফোর্টার", "লেপ/কাঁথা", "ডুভেট ইনার", "বিশেষ ম্যাটেরিয়ালের বিছানাপত্র"],
  notPartNote: "মেসেজ করুন, আমরা দাম জানিয়ে দেব।",
  notSure: "নিশ্চিত নন? একটা ছবি পাঠান",

  pricingTitle: "পরিষ্কার দাম",
  pricingRows: [
    ["৩টি রেগুলার/মিডিয়াম", "৳{package}"],
    ["প্রতিটি অতিরিক্ত রেগুলার", "৳{regular}"],
    ["প্রতিটি ভারী/বড়", "৳{heavy}"],
    ["৩টির মধ্যে ভারী থাকলে", "প্রতিটিতে +৳{addon}"],
    ["শুধু ১ বা ২টি কম্বল", "সাধারণ দাম, মেসেজ করুন"],
  ],
  fewerNote: "শুধু ১ বা ২টি কম্বল? সাধারণ দাম প্রযোজ্য। WhatsApp-এ মেসেজ করুন।",

  promiseTitle: "আমাদের দামের প্রতিশ্রুতি",
  promise:
    "কোনো কম্বল রেগুলারের চেয়ে ভারী বা বড় মনে হলে, কাজ শুরুর আগেই আপনার সাথে চূড়ান্ত দাম নিশ্চিত করব। আপনার অনুমতি ছাড়া আমরা কখনো দাম বাড়াই না। আপগ্রেড না চাইলে, সেই কম্বলটি আপনার ডেলিভারির সাথে বিনা খরচে ফেরত দেব।",

  detailsTitle: "দরকারি তথ্য",
  details: [
    ["সময়", "সাধারণত {min}–{max} দিন"],
    ["পেমেন্ট", "ডেলিভারিতে, ক্যাশ বা বিকাশ"],
    ["এলাকা", "উত্তরা সেক্টর ১ থেকে ১৮"],
  ],

  trustTitle: "কেন Velto",
  trustPoints: [
    "উত্তরা সেক্টর ১১-এ Velto-র আউটলেট",
    "পিকআপের সময় প্রতিটি আইটেমে ট্যাগ",
    "পৌঁছানোর পর প্রতিটি কম্বল চেক করা হয়",
    "প্যাক করার আগে মান যাচাই",
    "আমাদের নিজস্ব টিম পিকআপ ও ডেলিভারি করে",
  ],

  summaryTitle: "আপনার বুকিং",
  summaryItems: "৩ x রেগুলার/মিডিয়াম কম্বল",
  summaryTotal: "প্যাকেজের মোট",
  summaryPay: "ডেলিভারিতে পেমেন্ট",
  summarySmall: "ভারী কম্বল প্রতিটি ৳{heavy}, কাজ শুরুর আগে আপনার সাথে নিশ্চিত করা হয়।",

  formTitle: "আপনার পিকআপ বুক করুন",
  name: "নাম",
  phone: "ফোন",
  phoneHint: "বাংলাদেশি মোবাইল নম্বর, যেমন ০১৭১২ ৩৪৫৬৭৮",
  sector: "সেক্টর",
  sectorPlaceholder: "সেক্টর বেছে নিন",
  sectorOption: "সেক্টর {n}",
  outside: "উত্তরার বাইরে",
  address: "পিকআপের ঠিকানা",
  addressHint: "বাসা, রোড আর কোনো ল্যান্ডমার্ক",
  date: "পিকআপের তারিখ",
  dateHint: "পিকআপের সময় নিশ্চিত করতে আমরা ফোন করব।",
  noDays: "এই প্যাকেজের সব পিকআপের দিন এখন পূর্ণ। WhatsApp-এ মেসেজ করুন, আমরা সাহায্য করব।",
  submit: "৩টি কম্বল ৳{package}-এ বুক করুন",
  sending: "পাঠানো হচ্ছে…",
  errors: {
    name: "আপনার নাম লিখুন।",
    phone: "বাংলাদেশি মোবাইল নম্বর দিন, যেমন ০১৭১২ ৩৪৫৬৭৮।",
    sector: "আপনার সেক্টর বেছে নিন।",
    address: "বাসা আর রোড লিখুন, যাতে আমরা খুঁজে পাই।",
    date: "পিকআপের তারিখ বেছে নিন।",
    day_full: "ওই পিকআপের দিনটি পূর্ণ। পরের খালি দিনটি বেছে নিন।",
    rate_limited: "এই নম্বর থেকে আগেই কয়েকটি অনুরোধ এসেছে। WhatsApp-এ মেসেজ করুন, আমরা সাহায্য করব।",
    unavailable: "এই মুহূর্তে বুকিং পাঠানো যায়নি। আবার চেষ্টা করুন, অথবা WhatsApp-এ মেসেজ করুন।",
    closed: "এই প্যাকেজটি এখন পাওয়া যাচ্ছে না। WhatsApp-এ মেসেজ করুন, আমরা সাহায্য করব।",
  },
  outsideTitle: "আমরা এখন উত্তরা সেক্টর ১ থেকে ১৮-তে সার্ভিস দিই।",
  outsideBody: "WhatsApp-এ মেসেজ করুন, আপনার এলাকায় পারব কিনা দেখে জানাব।",

  successTitle: "পিকআপের অনুরোধ পেয়েছি।",
  successBody: "শীঘ্রই পিকআপের বিস্তারিত নিশ্চিত করব।",
  successRef: "বুকিং আইডি",
  successAddress: "পিকআপের ঠিকানা",
  successDate: "পিকআপের তারিখ",
  continueWhatsapp: "WhatsApp-এ চালিয়ে যান",

  faqTitle: "প্রশ্ন",
  faq: [
    ["রেগুলার কম্বল কোনটা?", "সাধারণ পুরুত্বের সিঙ্গেল বা ডাবল বেডের কম্বল, যা মেশিনে ধোয়া যায়। নিশ্চিত না হলে WhatsApp-এ একটা ছবি পাঠান।"],
    ["আমার একটা কম্বল ভারী হলে?", "কাজ শুরুর আগে আপনার সাথে দাম নিশ্চিত করব। ৩টির মধ্যে একটি ভারী হলে ৳{addon} যোগ হয়। না চাইলে, সেটি ডেলিভারির সাথে বিনা খরচে ফেরত দেব।"],
    ["কত দিন লাগে?", "পিকআপ থেকে ডেলিভারি সাধারণত {min}–{max} দিন।"],
    ["পেমেন্ট কীভাবে?", "ডেলিভারির সময়, ক্যাশে বা বিকাশে।"],
  ],

  sticky: "৩টি কম্বল ৳{package}-এ বুক করুন",
  unavailableTitle: "এই প্যাকেজটি এখন পাওয়া যাচ্ছে না।",
  unavailableBody: "WhatsApp-এ মেসেজ করুন, আপনার কম্বলের ব্যাপারে সাহায্য করব।",
  weekdays: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"],
  months: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
  tomorrow: "আগামীকাল",
};

export const b999Text = (locale: Locale): B999Text => (locale === "bn" ? bn : en);

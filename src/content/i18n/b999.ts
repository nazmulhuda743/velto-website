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
  metaTitle: "Uttara Blanket Cleaning | ৩টা Blanket ৳৯৯৯ | Velto",
  metaDescription: "Uttara-য় বাসা থেকে pickup, ৩টা Regular blanket ৳৯৯৯, delivery পর্যন্ত সব included। Velto-তে আজই book করুন।",
  heroEyebrow: "Uttara Blanket Cleaning",
  heroTitle: "৩টা Regular Blanket",
  heroSupport: "বাসা থেকে নিয়ে যাই, ধুয়ে পুরো শুকিয়ে, fold & pack করে আবার বাসায় পৌঁছে দিই।",
  heroQualifier: "Offerটি Regular/Medium blanket-এর জন্য। Heavy/Large blanket ৳{heavy}/টি।",
  pickupIncluded: "Pickup & Delivery Included",
  bookPickup: "Book Pickup",
  whatsappUs: "WhatsApp Us",
  heroFacts: ["Uttara Sector 1–18", "Payment at Delivery"],

  howTitle: "কীভাবে কাজ করে",
  howSteps: ["Book", "Pickup", "Check, Wash, Dry", "Fold & Pack", "Delivery"],

  qualifyTitle: "কোন কম্বল এই অফারে থাকবে?",
  regularTitle: "Regular / Medium",
  regularPrice: "৩টা ৳{package}",
  regularPoints: ["সাধারণ single বা double bed-এর কম্বল", "Normal thickness", "Machine-এ wash করা যায়", "খুব মোটা, weighted বা oversized না"],
  heavyTitle: "Heavy / Large",
  heavyPrice: "৳{heavy}/টি",
  heavyPoints: ["বড় সাইজ বা ভারী কম্বল", "খুব মোটা mink বা Korean কম্বল"],
  notPartTitle: "এই অফারের মধ্যে নেই",
  notPartPoints: ["Weighted blanket", "Comforter", "লেপ / কাঁথা", "Duvet inner", "Special material-এর bedding"],
  notPartNote: "WhatsApp-এ জানান, price বলে দেবো।",
  notSure: "Sure না? WhatsApp-এ একটা ছবি পাঠান",

  pricingTitle: "Price Breakdown",
  pricingRows: [
    ["৩টা Regular/Medium", "৳{package}"],
    ["Extra Regular, প্রতিটি", "৳{regular}"],
    ["Heavy/Large, প্রতিটি", "৳{heavy}"],
    ["৩টার মধ্যে Heavy থাকলে", "+৳{addon}/টি"],
    ["শুধু ১ বা ২টা কম্বল", "Regular price, WhatsApp করুন"],
  ],
  fewerNote: "শুধু ১ বা ২টা কম্বল? তাহলে regular price। WhatsApp-এ মেসেজ করুন, ব্যবস্থা করে দেবো।",

  promiseTitle: "Price change হলে আগে জানাবো",
  promise:
    "কম্বল Heavy/Large হলে processing-এর আগে exact price জানাবো। আপনার confirmation ছাড়া price change হবে না। আপনি না চাইলে itemটি wash না করে delivery-এর সাথে ফেরত দেওয়া হবে।",

  detailsTitle: "Booking Details",
  details: [
    ["Delivery time", "সাধারণত {min}–{max} দিন"],
    ["Payment", "Delivery-র সময়, cash বা bKash"],
    ["Area", "Uttara Sector 1–18"],
  ],

  trustTitle: "কেন Velto",
  trustPoints: [
    "Uttara Sector 11-এ Velto outlet",
    "Pickup-এর সময় প্রতিটি item-এ tag লাগানো হয়",
    "Outlet-এ পৌঁছার পর প্রতিটি কম্বল check করা হয়",
    "Pack করার আগে quality check",
    "Pickup আর delivery করে আমাদের নিজের team",
  ],

  summaryTitle: "আপনার Booking",
  summaryItems: "৩ x Regular/Medium Blanket",
  summaryTotal: "Package total",
  summaryPay: "Payment at Delivery",
  summarySmall: "Heavy blanket ৳{heavy}/টি। Processing-এর আগে আপনার সাথে confirm করে নেওয়া হয়।",

  formTitle: "Pickup Book করুন",
  name: "নাম",
  phone: "Phone",
  phoneHint: "বাংলাদেশি mobile number, যেমন ০১৭১২ ৩৪৫৬৭৮",
  sector: "Sector",
  sectorPlaceholder: "আপনার sector বেছে নিন",
  sectorOption: "Sector {n}",
  outside: "Uttara-র বাইরে",
  address: "Pickup address",
  addressHint: "বাসা নম্বর, রোড আর কাছের কোনো landmark",
  date: "Pickup date",
  dateHint: "Pickup-এর সময় confirm করতে আমরা call করবো।",
  noDays: "এই package-এর সব pickup day এখন full। WhatsApp-এ মেসেজ করুন, ব্যবস্থা করে দেবো।",
  submit: "৩টা Blanket ৳{package}-এ Book করুন",
  sending: "পাঠানো হচ্ছে…",
  errors: {
    name: "আপনার নাম লিখুন।",
    phone: "একটা বাংলাদেশি mobile number দিন, যেমন ০১৭১২ ৩৪৫৬৭৮।",
    sector: "আপনার sector বেছে নিন।",
    address: "বাসা নম্বর আর রোড লিখুন, যাতে rider সহজে খুঁজে পায়।",
    date: "Pickup date বেছে নিন।",
    day_full: "এই দিনের pickup slot full হয়ে গেছে। পরের খালি দিনটা বেছে নিন।",
    rate_limited: "এই number থেকে আগেই কয়েকটা request এসেছে। WhatsApp-এ মেসেজ করুন, আমরা দেখে নিচ্ছি।",
    unavailable: "এই মুহূর্তে booking পাঠানো যায়নি। আবার try করুন, অথবা WhatsApp-এ মেসেজ করুন।",
    closed: "এই package এখন available নেই। WhatsApp-এ মেসেজ করুন, ব্যবস্থা করে দেবো।",
  },
  outsideTitle: "আমরা এখন Uttara Sector 1–18-এ service দিচ্ছি।",
  outsideBody: "WhatsApp-এ মেসেজ করুন, আপনার এলাকায় পারবো কি না দেখে জানাবো।",

  successTitle: "Booking received",
  successBody: "অল্প সময়ের মধ্যে call করে pickup-এর সময় confirm করবো।",
  successRef: "Booking ID",
  successAddress: "Pickup address",
  successDate: "Pickup date",
  continueWhatsapp: "WhatsApp-এ কথা বলুন",

  faqTitle: "সাধারণ প্রশ্ন",
  faq: [
    ["Regular blanket বলতে কোনটা?", "Normal thickness-এর single বা double bed-এর কম্বল, যেটা machine-এ wash করা যায়। Sure না হলে WhatsApp-এ একটা ছবি পাঠান।"],
    ["আমার একটা কম্বল Heavy হলে?", "Processing-এর আগে আপনার সাথে price confirm করবো। ৩টার মধ্যে একটা Heavy হলে ৳{addon} যোগ হয়। না চাইলে ওটা wash না করে delivery-র সাথে ফেরত দিয়ে দেবো, কোনো charge নেই।"],
    ["কত দিন লাগে?", "Pickup থেকে delivery সাধারণত {min}–{max} দিন।"],
    ["Payment কীভাবে?", "Delivery-র সময়, cash বা bKash-এ।"],
  ],

  sticky: "৩টা Blanket ৳{package}-এ Book করুন",
  unavailableTitle: "এই package এখন available নেই।",
  unavailableBody: "WhatsApp-এ মেসেজ করুন, আপনার কম্বলের ব্যবস্থা করে দেবো।",
  weekdays: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"],
  months: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
  tomorrow: "আগামীকাল",
};

export const b999Text = (locale: Locale): B999Text => (locale === "bn" ? bn : en);

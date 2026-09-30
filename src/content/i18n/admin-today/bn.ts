import { toBanglaDigits } from "@/lib/i18n/config";
import type { TodayText } from "./en";

const d = toBanglaDigits;

/**
 * Bangla for the admin "Today" page, in the short spoken style Dhaka laundry staff use
 * ("রাইডার", "অর্ডার", "ডেলিভারি" stay as they say them). Digits are Bangla. DRAFT for owner
 * review: see docs/content/BANGLA-REVIEW.md. Order numbers, names and rider names from Velto
 * Ops are shown as they are.
 */
export const todayBn: TodayText = {
  title: "আজ",
  tabs: { call: "কল", assign: "রাইডার", deliver: "ডেলিভারি", route: "রুট" },
  windows: { morning: "সকাল ৯–১২", afternoon: "দুপুর ১২–৪", evening: "সন্ধ্যা ৪–৮" },
  nextUp: "এখন করুন",
  then: "এরপর",
  lateNote: (n) => `${d(n)} জন গ্রাহক ৩০ মিনিটের বেশি অপেক্ষায়`,
  confirmFor: (window) => `নিশ্চিত: ${window}`,
  call: "কল",
  whatsapp: "WhatsApp",
  noAnswer: "ফোন ধরেনি",
  waitingMin: (m) => `${d(m)} মি.`,
  chooseRider: "রাইডার বাছুন",
  planDelivery: "ডেলিভারি প্ল্যান",
  readySince: (t) => `প্রস্তুত ${d(t)} থেকে`,
  assignTo: (name) => `${name}-এর রাইডার`,
  assignHint: "রাইডার দেখবেন Velto Ops → আমার কাজ-এ।",
  sector: (area) => `সেক্টর ${d(area)}`,
  mostFree: "সবচেয়ে ফাঁকা",
  full: "পূর্ণ",
  offToday: "আজ ছুটি",
  free: "ফাঁকা",
  stopsOf: (a, b) => `${d(a)}/${d(b)} স্টপ`,
  pickup: "পিকআপ",
  delivery: "ডেলিভারি",
  routeHint: "রাইডারে চাপ দিলে স্টপ দেখা যাবে।",
  allDone: "এখানে সব শেষ",
  allDoneSub: "এই তালিকায় আর কিছু নেই।",
  opsDown: (t) => `এখন Velto Ops-এ যাওয়া যাচ্ছে না। ${d(t)}-এর তালিকা দেখানো হচ্ছে।`,
  retry: "আবার চেষ্টা করুন",
  firstOrder: "ওয়েবসাইটে প্রথম অর্ডার · ১০% ছাড়",
  callback: "কল-ব্যাক",
  weekly: "সাপ্তাহিক",
  changedTime: "সময় বদলেছেন",
  pickedUp: "পিকআপ হয়েছে",
  delivered: "ডেলিভারি হয়েছে",
  markedPicked: "পিকআপ হয়েছে বলে মার্ক করা হলো",
  markedDelivered: "ডেলিভারি হয়েছে বলে মার্ক করা হলো",
  cancelBooking: "বুকিং বাতিল",
  whichOrder: "কোন অর্ডার?",
  help: "ওপর থেকে নিচে কাজ করুন: নতুন গ্রাহকদের কল করুন, প্রতিটি কাজে রাইডার দিন, প্রস্তুত অর্ডারের ডেলিভারি প্ল্যান করুন। রাইডাররা নিজেদের কাজ দেখবেন Velto Ops-এ।",
};

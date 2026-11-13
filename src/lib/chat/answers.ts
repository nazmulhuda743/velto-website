/**
 * The chat's own answers: works with no AI and no API key. A typed question is matched against
 * a fixed list of Velto's common questions (English, Bangla and Banglish words), and a question
 * about an item's price is answered from the live price list. Every answer restates what the
 * website already says (site.ts, the FAQ, the service pages); nothing here is a new claim.
 * Pure and runtime-neutral (tests/command-center/chat.test.cjs).
 */

export type ChatLang = "en" | "bn";

type Entry = {
  id: string;
  /** Lowercase words or phrases. Latin ones match at a word start; Bangla ones anywhere. A leading "!" marks a word that names the topic outright (it counts five). */
  keys: string[];
  en: string;
  bn: string;
};

const WA = "/go/whatsapp";

/** The questions customers ask most, with the website's answers. Order breaks ties. */
export const ANSWERS: Entry[] = [
  {
    id: "human",
    keys: ["!human", "!real person", "person", "!bot", "!robot", "!manush", "!মানুষ", "বট", "রোবট", "agent", "staff", "talk to", "call me", "kotha bolte", "কথা বলতে"],
    en: `This is Velto's automatic help on the website. A person from the team is on WhatsApp: [message Velto](${WA}) or [call us](/go/call).`,
    bn: `এটি ওয়েবসাইটে Velto-র স্বয়ংক্রিয় সাহায্য। টিমের একজন মানুষ WhatsApp-এ আছেন: [Velto-কে মেসেজ করুন](${WA}) বা [কল করুন](/go/call)।`,
  },
  {
    id: "turnaround",
    keys: ["how long", "how many days", "turnaround", "when ready", "when will", "time take", "takes", "days", "hours", "koto din", "kotodin", "koto somoy", "kobe pabo", "kobe dibe", "somoy", "কত দিন", "কতদিন", "কত সময়", "কবে পাব", "কবে দেবেন", "কবে দিবেন", "সময় লাগে", "ঘণ্টা", "দিনে"],
    en: "General orders are usually around 48 hours. Wash & Iron and Dry Cleaning are usually around 72 hours. Special garments, household items and unusual conditions may take longer.",
    bn: "সাধারণ অর্ডারে সাধারণত প্রায় ৪৮ ঘণ্টা লাগে। ওয়াশ ও আয়রন এবং ড্রাই ক্লিনিংয়ে সাধারণত প্রায় ৭২ ঘণ্টা লাগে। বিশেষ পোশাক, ঘরোয়া আইটেম বা অস্বাভাবিক অবস্থার ক্ষেত্রে বেশি সময় লাগতে পারে।",
  },
  {
    id: "express",
    keys: ["!express", "!urgent", "!same day", "today", "fast", "quick", "tomorrow", "joruri", "jaldi", "taratari", "ajkei", "আজকেই", "!জরুরি", "তাড়াতাড়ি", "!এক্সপ্রেস", "আজই", "কালকে"],
    en: "Express is sometimes available. It depends on the item, the service and the current workload, so please confirm with Velto before booking: [ask on WhatsApp](" + WA + ").",
    bn: "এক্সপ্রেস কখনো কখনো পাওয়া যায়। এটি আইটেম, সার্ভিস ও বর্তমান কাজের চাপের ওপর নির্ভর করে, তাই বুক করার আগে Velto-র সাথে নিশ্চিত হয়ে নিন: [WhatsApp-এ জিজ্ঞেস করুন](" + WA + ")।",
  },
  {
    id: "area",
    keys: ["area", "where do you", "pick up from", "pickup area", "which sector", "sector", "uttara", "deliver to", "my area", "location", "kothay", "kon area", "kon jaygay", "কোথায়", "এলাকা", "সেক্টর", "উত্তরা", "আসেন", "আসবেন"],
    en: "We pick up and deliver across Uttara, Sectors 1–18. If you are outside that area, ask us before booking: [message Velto](" + WA + ").",
    bn: "আমরা উত্তরা, সেক্টর ১–১৮ জুড়ে পিকআপ ও ডেলিভারি দিই। আপনি এই এলাকার বাইরে থাকলে বুক করার আগে আমাদের জিজ্ঞেস করুন: [Velto-কে মেসেজ করুন](" + WA + ")।",
  },
  {
    id: "delivery",
    keys: ["free", "delivery charge", "delivery fee", "pickup charge", "charge", "minimum", "shipping", "delivery cost", "free delivery", "fri", "delivery koto", "চার্জ", "ফ্রি", "ডেলিভারি খরচ", "ডেলিভারি চার্জ", "সর্বনিম্ন"],
    en: "Orders of **৳499+** get free pickup and delivery. On a fixed weekly or fortnightly pickup, regular orders of **৳300+** qualify. Smaller orders have a pickup and delivery charge; we tell you the amount when we confirm your pickup.",
    bn: "**৳৪৯৯** বা তার বেশি অর্ডারে পিকআপ ও ডেলিভারি ফ্রি। সাপ্তাহিক বা পাক্ষিক নির্দিষ্ট পিকআপে **৳৩০০** বা তার বেশি নিয়মিত অর্ডারে ফ্রি। ছোট অর্ডারে পিকআপ ও ডেলিভারি চার্জ থাকে; পিকআপ নিশ্চিত করার সময় আমরা পরিমাণটি জানিয়ে দিই।",
  },
  {
    id: "offer",
    keys: ["!offer", "!discount", "promo", "!coupon", "code", "first order", "new customer", "deal", "less", "chhar", "char", "!ছাড়", "!অফার", "!ডিসকাউন্ট", "কুপন", "প্রথম অর্ডার"],
    en: "Your first booking on the website gets **10% off**, whatever the amount. No code is needed: we apply it when your order is created. [Book a pickup](/book)",
    bn: "ওয়েবসাইটে আপনার প্রথম বুকিংয়ে **১০% ছাড়**, অর্ডার যত টাকারই হোক। কোনো কোড লাগবে না: অর্ডার তৈরির সময় আমরা ছাড়টি দিয়ে দিই। [পিকআপ বুক করুন](/book)",
  },
  {
    id: "book",
    keys: ["book", "booking", "order", "how to order", "place an order", "schedule", "pickup", "pick up", "collect", "come and take", "nite asben", "niye jan", "order dite", "order korbo", "bukin", "বুক", "অর্ডার করব", "অর্ডার দিতে", "পিকআপ", "নিয়ে যান", "নিতে আসবেন"],
    en: "Book a pickup on the website, or message us on WhatsApp. Tell us where to collect from, what you are sending and a pickup time that suits you; we call or message to confirm. [Book a pickup](/book)",
    bn: "ওয়েবসাইটে পিকআপ বুক করুন, অথবা WhatsApp-এ মেসেজ দিন। কোথা থেকে নেব, কী পাঠাচ্ছেন আর আপনার সুবিধামতো পিকআপের সময় জানান; আমরা কল বা মেসেজ করে নিশ্চিত করব। [পিকআপ বুক করুন](/book)",
  },
  {
    id: "track",
    keys: ["!track", "status", "where is my order", "my order", "!order status", "ready yet", "is it ready", "order ki", "amar order", "অর্ডারের অবস্থা", "আমার অর্ডার", "!ট্র্যাক", "রেডি হয়েছে"],
    en: "You can see your order's status with your order number and phone number: [track an order](/track). For anything about a specific order, [message Velto](" + WA + ").",
    bn: "অর্ডার নম্বর ও ফোন নম্বর দিয়ে অর্ডারের অবস্থা দেখতে পারবেন: [অর্ডার ট্র্যাক করুন](/track)। নির্দিষ্ট কোনো অর্ডার নিয়ে কিছু জানতে [Velto-কে মেসেজ করুন](" + WA + ")।",
  },
  {
    id: "outlets",
    keys: ["!outlet", "!shop", "!store", "!branch", "!address", "visit", "drop off", "drop", "!open", "!opening", "hours", "close", "closing", "timing", "!dokan", "khola", "bondho", "!দোকান", "!শাখা", "!ঠিকানা", "!খোলা", "বন্ধ", "!আউটলেট"],
    en: "We have two outlets in Uttara:\n- **Sector 11**: House 2, Road 14. Open 9:00 AM–10:00 PM.\n- **Sector 18**: RUAP, North Side of Gate 1, Poncoboti Bazar. Open 10:00 AM–9:00 PM.\n[See locations and directions](/locations)",
    bn: "উত্তরায় আমাদের দুটি আউটলেট:\n- **সেক্টর ১১**: বাড়ি ২, রোড ১৪। খোলা সকাল ৯টা থেকে রাত ১০টা।\n- **সেক্টর ১৮**: RUAP, গেট ১-এর উত্তর পাশ, পঞ্চবটি বাজার। খোলা সকাল ১০টা থেকে রাত ৯টা।\n[লোকেশন ও দিকনির্দেশনা দেখুন](/locations)",
  },
  {
    id: "stains",
    keys: ["!stain", "!stains", "spot", "mark", "oil", "ink", "turmeric", "!dag", "!daag", "!দাগ", "হলুদ", "তেল"],
    en: "We check visible stains and treat them according to the garment and the service, but no laundry should promise that every stain will come out. Send a photo on WhatsApp if you'd like us to take a look first: [message Velto](" + WA + ").",
    bn: "আমরা দৃশ্যমান দাগ দেখে পোশাক ও সার্ভিস অনুযায়ী চিকিৎসা করি, তবে কোনো লন্ড্রিরই সব দাগ উঠে যাওয়ার প্রতিশ্রুতি দেওয়া উচিত নয়। আগে দেখাতে চাইলে WhatsApp-এ ছবি পাঠান: [Velto-কে মেসেজ করুন](" + WA + ")।",
  },
  {
    id: "household",
    keys: ["curtain", "curtains", "carpet", "carpets", "rug", "blanket", "comforter", "quilt", "duvet", "bedding", "porda", "kombol", "lep", "পর্দা", "কার্পেট", "কম্বল", "লেপ", "কমফোর্টার", "তোশক"],
    en: "Curtains and carpets are priced by size, material and condition, and blankets and comforters mainly by type and size. Share approximate measurements (and a photo if you can) and we confirm the price: [get a quote](/quote).",
    bn: "পর্দা ও কার্পেটের দাম মাপ, উপাদান ও অবস্থার ওপর, আর কম্বল ও কমফোর্টারের দাম মূলত ধরন ও মাপের ওপর নির্ভর করে। আনুমানিক মাপ (সম্ভব হলে একটি ছবি) দিন, আমরা দাম নিশ্চিত করে জানাব: [কোট নিন](/quote)।",
  },
  {
    id: "which",
    keys: ["!which service", "!difference", "dry clean or", "wash or", "recommend", "suit", "should i", "!kon service", "kon ta", "!কোন সার্ভিস", "!পার্থক্য", "কোনটা"],
    en: "In short:\n- **Wash & Iron**: washed, dried, ironed and packed.\n- **Ironing**: ironed, finished and packed; you wash at home.\n- **Dry Cleaning**: assessed, dry cleaned, pressed and packed, for suits, blazers, saris, sherwanis and delicate garments.\nNot sure? Send a photo on WhatsApp and we'll help you choose: [message Velto](" + WA + ").",
    bn: "সংক্ষেপে:\n- **ওয়াশ ও আয়রন**: ধোয়া, শুকানো, আয়রন করে প্যাক।\n- **আয়রন**: আয়রন ও ফিনিশ করে প্যাক; ধোয়া আপনি বাসায় করবেন।\n- **ড্রাই ক্লিনিং**: যাচাই করে ড্রাই ক্লিন, প্রেস ও প্যাক; স্যুট, ব্লেজার, শাড়ি, শেরওয়ানি ও নাজুক পোশাকের জন্য।\nবুঝতে না পারলে WhatsApp-এ ছবি পাঠান, আমরা বেছে নিতে সাহায্য করব: [Velto-কে মেসেজ করুন](" + WA + ")।",
  },
  {
    id: "services",
    keys: ["services", "what do you do", "what do you clean", "do you clean", "do you wash", "laundry", "dry cleaning", "ironing", "iron", "wash", "dhulai", "istri", "ki ki", "সার্ভিস", "ধোয়া", "আয়রন", "ইস্ত্রি", "ড্রাই ক্লিন", "লন্ড্রি"],
    en: "We do Dry Cleaning, Wash & Iron and Ironing, plus curtains, carpets, and blankets and comforters, with pickup from your door in Uttara. [See all services](/services)",
    bn: "আমরা ড্রাই ক্লিনিং, ওয়াশ ও আয়রন এবং আয়রন করি; সাথে পর্দা, কার্পেট এবং কম্বল ও কমফোর্টার। উত্তরায় আপনার দরজা থেকে পিকআপ। [সব সার্ভিস দেখুন](/services)",
  },
  {
    id: "regular",
    keys: ["!regular", "!weekly", "!every week", "!monthly", "!subscription", "!recurring", "routine", "fortnight", "!proti soptahe", "!প্রতি সপ্তাহে", "!নিয়মিত", "!সাপ্তাহিক", "মাসিক"],
    en: "Yes: regular laundry and ironing can be a recurring pickup on a day that suits you, agreed with you once. On a fixed weekly or fortnightly pickup, orders of ৳300+ get free pickup and delivery. [Set up regular pickup](/regular-laundry)",
    bn: "হ্যাঁ: নিয়মিত লন্ড্রি ও আয়রন আপনার সুবিধামতো দিনে নিয়মিত পিকআপে করা যায়, একবার ঠিক করে নিলেই হয়। সাপ্তাহিক বা পাক্ষিক নির্দিষ্ট পিকআপে ৳৩০০ বা তার বেশি অর্ডারে পিকআপ ও ডেলিভারি ফ্রি। [নিয়মিত পিকআপ ঠিক করুন](/regular-laundry)",
  },
  {
    id: "process",
    keys: ["process", "how does it work", "how it works", "safe", "lost", "mix up", "mixed", "tag", "quality", "care", "kivabe", "কীভাবে", "কিভাবে", "নিরাপদ", "হারাবে", "ট্যাগ"],
    en: "Every order is checked in and counted, and each item is tagged so it stays with your order. We look over fabric, condition and stains before choosing the treatment, then clean, finish, check again and pack. [How it works](/how-it-works)",
    bn: "প্রতিটি অর্ডার গুনে চেক-ইন করা হয়, আর প্রতিটি আইটেমে ট্যাগ দেওয়া হয় যাতে আপনার অর্ডারের সাথেই থাকে। ট্রিটমেন্ট বেছে নেওয়ার আগে কাপড়, অবস্থা ও দাগ দেখি, তারপর পরিষ্কার, ফিনিশ, আবার চেক করে প্যাক করি। [কীভাবে কাজ করে](/how-it-works)",
  },
  {
    id: "payment",
    keys: ["pay", "!payment", "!bkash", "!nagad", "cash", "card", "taka dibo", "payment kivabe", "!বিকাশ", "!নগদ", "!পেমেন্ট", "ক্যাশ", "টাকা দেব"],
    en: "We go through the amount when we confirm your pickup. For payment options, please [ask on WhatsApp](" + WA + ") and the team will tell you.",
    bn: "পিকআপ নিশ্চিত করার সময় আমরা পরিমাণটি জানিয়ে দিই। পেমেন্টের উপায় জানতে [WhatsApp-এ জিজ্ঞেস করুন](" + WA + "), টিম জানিয়ে দেবে।",
  },
  {
    id: "problem",
    keys: ["!complain", "!complaint", "!damage", "!damaged", "!missing", "!refund", "problem", "issue", "wrong", "not happy", "bad", "!cancel", "change my", "!reschedule", "late", "osubidha", "!nosto", "!অভিযোগ", "সমস্যা", "!নষ্ট", "!হারিয়ে", "!বাতিল", "পরিবর্তন", "দেরি", "ফেরত"],
    en: "I'm sorry to hear that. Please message the team on WhatsApp with your order number and they will sort it out with you: [message Velto](" + WA + ").",
    bn: "শুনে খারাপ লাগল। অর্ডার নম্বরসহ WhatsApp-এ টিমকে মেসেজ দিন, তারা আপনার সাথে বিষয়টি সমাধান করবে: [Velto-কে মেসেজ করুন](" + WA + ")।",
  },
  {
    id: "contact",
    keys: ["contact", "phone", "number", "whatsapp", "call", "mobile", "nombor", "ফোন", "নম্বর", "যোগাযোগ", "কল"],
    en: "You can reach the team on WhatsApp or by phone: [message Velto](" + WA + ") or [call us](/go/call).",
    bn: "WhatsApp বা ফোনে টিমের সাথে যোগাযোগ করুন: [Velto-কে মেসেজ করুন](" + WA + ") বা [কল করুন](/go/call)।",
  },
  {
    id: "reviews",
    keys: ["review", "reviews", "rating", "google", "trust", "good", "reliable", "রিভিউ", "রেটিং", "ভালো"],
    en: "Our Sector 11 outlet is rated 5.0 on Google from 100+ reviews. You can read them on our [locations page](/locations).",
    bn: "আমাদের সেক্টর ১১ আউটলেটের Google রেটিং ৫.০, ১০০+ রিভিউ। রিভিউগুলো পড়তে পারেন [লোকেশন পেজে](/locations)।",
  },
  {
    id: "thanks",
    keys: ["thank", "thanks", "thx", "ok", "okay", "great", "dhonnobad", "ধন্যবাদ", "আচ্ছা", "ঠিক আছে"],
    en: "You're welcome. Anything else, just ask.",
    bn: "আপনাকেও ধন্যবাদ। আর কিছু জানতে চাইলে জিজ্ঞেস করুন।",
  },
  {
    id: "hello",
    keys: ["hi", "hello", "hey", "salam", "assalamu", "good morning", "good evening", "হ্যালো", "সালাম", "আসসালামু"],
    en: "Hello! Ask us anything: a price, pickup and delivery, how long it takes, or which service suits a garment.",
    bn: "হ্যালো! যা জানতে চান জিজ্ঞেস করুন: দাম, পিকআপ ও ডেলিভারি, কত সময় লাগে, বা কোন পোশাকে কোন সার্ভিস।",
  },
];

/** Bangla, Banglish and common spellings → the word the price list uses (substring search). */
const ITEMS: [string[], string][] = [
  [["shirt", "shart", "শার্ট"], "shirt"],
  [["t-shirt", "tshirt", "t shirt", "গেঞ্জি", "টি-শার্ট", "টিশার্ট"], "t-shirt"],
  [["pant", "pants", "trouser", "trousers", "jeans", "প্যান্ট", "জিন্স", "ট্রাউজার"], "pant"],
  [["saree", "sari", "shari", "sharee", "শাড়ি", "শাড়ী"], "sari"],
  [["panjabi", "punjabi", "পাঞ্জাবি", "পাঞ্জাবী"], "panjabi"],
  [["blazer", "ব্লেজার"], "blazer"],
  [["suit", "স্যুট", "কোট"], "suit"],
  [["sherwani", "শেরওয়ানি"], "sherwani"],
  [["kurta", "kurti", "কুর্তা", "কুর্তি"], "kurta"],
  [["salwar", "kameez", "three piece", "3 piece", "thri pis", "থ্রি পিস", "সালোয়ার", "কামিজ"], "salwar"],
  [["lehenga", "lehanga", "lahanga", "লেহেঙ্গা"], "lahanga"],
  [["jacket", "জ্যাকেট"], "jacket"],
  [["sweater", "সোয়েটার"], "sweater"],
  [["shawl", "শাল"], "shawl"],
  [["bed sheet", "bedsheet", "বেডশিট", "চাদর"], "bed sheet"],
  [["pillow", "বালিশ"], "pillow"],
  [["blanket", "kombol", "কম্বল"], "blanket"],
  [["comforter", "কমফোর্টার"], "comforter"],
  [["quilt", "lep", "লেপ"], "quilt"],
  [["towel", "তোয়ালে", "গামছা"], "towel"],
  [["tie", "টাই"], "tie"],
  [["abaya", "borka", "burqa", "বোরকা", "আবায়া"], "abaya"],
  [["lungi", "লুঙ্গি"], "lungi"],
  [["frock", "gown", "dress", "ফ্রক", "গাউন"], "gown"],
];

const PRICE_WORDS = ["price", "prices", "cost", "how much", "rate", "charge for", "dam", "daam", "koto taka", "দাম", "কত টাকা", "খরচ", "রেট"];

const BANGLA = /[ঀ-৿]/;
/** Banglish markers: Bangla said in English letters. */
const BANGLISH = /\b(ki|koto|kothay|kobe|ache|achhe|nai|korbo|korte|chai|dite|niben|diben|apnara|amar|amr|taka|dam|din|kivabe|hobe|jabe|pabo|bhai|vai|apu)\b/;

/** Which language to answer in: the question's own, else the page's. */
export function replyLang(text: string, page: ChatLang): ChatLang {
  if (BANGLA.test(text)) return "bn";
  if (BANGLISH.test(text.toLowerCase())) return "bn";
  return /[a-z]/i.test(text) ? "en" : page;
}

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim()} `;

/** Bangla: anywhere (suffixes join the word). Latin: at a word start; short words ("dam", "ok") only whole. */
const has = (text: string, key: string) => {
  if (BANGLA.test(key)) return text.includes(key);
  if (key.length <= 4) return text.includes(` ${key} `) || text.includes(` ${key}s `);
  return text.includes(` ${key}`);
};

/** Items named in a question, as price-list search words (at most three). */
export function itemsIn(question: string): string[] {
  const t = norm(question);
  const found: string[] = [];
  for (const [words, query] of ITEMS) if (words.some((w) => has(t, w)) && !found.includes(query)) found.push(query);
  // "t-shirt" also contains "shirt": keep the more specific one.
  return found.filter((q) => !(q === "shirt" && found.includes("t-shirt"))).slice(0, 3);
}

export const asksPrice = (question: string) => {
  const t = norm(question);
  return PRICE_WORDS.some((w) => has(t, w));
};

/** The best answer for a question, or null. Longer key phrases count more. */
export function matchAnswer(question: string): Entry | null {
  return scoreAnswer(question).entry;
}

function scoreAnswer(question: string): { entry: Entry | null; score: number } {
  const t = norm(question);
  let best: Entry | null = null;
  let bestScore = 0;
  for (const e of ANSWERS) {
    let score = 0;
    for (const raw of e.keys) {
      const strong = raw.startsWith("!");
      const k = strong ? raw.slice(1) : raw;
      if (has(t, k)) score += strong ? 5 : k.includes(" ") ? 2 : 1;
    }
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return { entry: best, score: bestScore };
}

/**
 * How to answer a question without AI: an item's price, a fixed answer, a question back, or
 * "didn't catch that". A named item is a price question unless the words clearly ask something
 * else ("how long does a saree take" is about time).
 */
export type Plan = { kind: "price"; items: string[] } | { kind: "answer"; id: string; text: string } | { kind: "ask-item"; text: string } | { kind: "none"; text: string };

export function planAnswer(question: string, lang: ChatLang): Plan {
  const items = itemsIn(question);
  const price = asksPrice(question);
  const { entry } = scoreAnswer(question);
  const priceTopic = !entry || ["household", "services", "which", "book", "hello", "thanks"].includes(entry.id);
  if (items.length && (price || priceTopic)) return { kind: "price", items };
  if (entry && !(price && entry.id === "hello")) return { kind: "answer", id: entry.id, text: entry[lang] };
  if (price) return { kind: "ask-item", text: askItem(lang) };
  return { kind: "none", text: noMatch(lang) };
}

/** What to say when nothing matched. */
export const noMatch = (lang: ChatLang) =>
  lang === "bn"
    ? `এটা ঠিক বুঝতে পারিনি। আমি দাম, পিকআপ এলাকা, ডেলিভারি চার্জ, কত সময় লাগে, অফার, আউটলেট আর সার্ভিস নিয়ে জানাতে পারি। অন্য কিছু হলে টিম WhatsApp-এ আছে: [Velto-কে মেসেজ করুন](${WA})।`
    : `I didn't quite catch that. I can help with prices, the pickup area, delivery charges, how long it takes, offers, outlets and services. For anything else, the team is on WhatsApp: [message Velto](${WA}).`;

export const askItem = (lang: ChatLang) =>
  lang === "bn"
    ? "কোন আইটেমের দাম জানতে চান? যেমন শার্ট, শাড়ি, ব্লেজার বা পাঞ্জাবি। সব দাম দেখতে পারেন [প্রাইস পেজে](/pricing)।"
    : "Which item is it? For example a shirt, saree, blazer or panjabi. You can also search every item on the [pricing page](/pricing).";

const SERVICE_BN: Record<string, string> = { "dry-cleaning": "ড্রাই ক্লিনিং", "wash-and-iron": "ওয়াশ ও আয়রন", ironing: "আয়রন" };

export type PriceRow = { name: string; services: { slug: string; name: string; price: string | null }[] };

/** Price-list results as a reply. `price` is already formatted ("৳120 per piece"); null means after assessment. */
export function priceReply(rows: PriceRow[], asked: string[], lang: ChatLang): string {
  if (!rows.length) {
    return lang === "bn"
      ? `প্রাইস লিস্টে এই আইটেমটি খুঁজে পাইনি। [প্রাইস পেজে](/pricing) খুঁজে দেখুন, অথবা [WhatsApp-এ জিজ্ঞেস করুন](${WA})।`
      : `I couldn't find that item in the price list. Try the [pricing page](/pricing), or [ask on WhatsApp](${WA}).`;
  }
  const after = lang === "bn" ? "দেখে জানানো হবে" : "after assessment";
  const lines = rows.slice(0, 5).map((r) => `- **${r.name}**: ${r.services.map((s) => `${lang === "bn" ? (SERVICE_BN[s.slug] ?? s.name) : s.name} ${s.price ?? after}`).join(" · ")}`);
  const head = lang === "bn" ? "Velto-র এখনকার দাম:" : "Velto's current prices:";
  const tail =
    lang === "bn"
      ? `৳৪৯৯ বা তার বেশি অর্ডারে পিকআপ ও ডেলিভারি ফ্রি। [পিকআপ বুক করুন](/book)`
      : `Orders of ৳499+ get free pickup and delivery. [Book a pickup](/book)`;
  void asked;
  return [head, ...lines, tail].join("\n");
}

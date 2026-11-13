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


/** The questions customers ask most, with the website's answers. Order breaks ties. */
export const ANSWERS: Entry[] = [
  {
    id: "human",
    keys: ["!human", "!real person", "person", "!bot", "!robot", "!manush", "!মানুষ", "বট", "রোবট", "agent", "staff", "talk to", "call me", "kotha bolte", "কথা বলতে"],
    en: "This is Velto's automatic help. A person from our team is on WhatsApp. [Message Velto](/go/whatsapp) [Call us](/go/call)",
    bn: "এটি Velto-র স্বয়ংক্রিয় সাহায্য। আমাদের টিমের একজন WhatsApp-এ আছেন। [মেসেজ করুন](/go/whatsapp) [কল করুন](/go/call)",
  },
  {
    id: "turnaround",
    keys: ["how long", "how many days", "turnaround", "when ready", "when will", "time take", "takes", "days", "hours", "koto din", "kotodin", "koto somoy", "kobe pabo", "kobe dibe", "somoy", "কত দিন", "কতদিন", "কত সময়", "কবে পাব", "কবে দেবেন", "কবে দিবেন", "সময় লাগে", "ঘণ্টা", "দিনে"],
    en: "Usually around 48 hours. Wash & Iron and Dry Cleaning take around 72 hours. Special items can take a little longer.",
    bn: "সাধারণত প্রায় ৪৮ ঘণ্টা। ওয়াশ ও আয়রন এবং ড্রাই ক্লিনিংয়ে প্রায় ৭২ ঘণ্টা। বিশেষ পোশাকে একটু বেশি সময় লাগতে পারে।",
  },
  {
    id: "express",
    keys: ["!express", "!urgent", "!same day", "today", "fast", "quick", "tomorrow", "joruri", "jaldi", "taratari", "ajkei", "আজকেই", "!জরুরি", "তাড়াতাড়ি", "!এক্সপ্রেস", "আজই", "কালকে"],
    en: "Express is sometimes possible, depending on the item and our workload. Please check with us before booking. [Ask on WhatsApp](/go/whatsapp)",
    bn: "আইটেম ও কাজের চাপ বুঝে কখনো কখনো এক্সপ্রেস করা যায়। বুক করার আগে আমাদের সাথে কথা বলে নিন। [WhatsApp-এ জিজ্ঞেস করুন](/go/whatsapp)",
  },
  {
    id: "area",
    keys: ["area", "where do you", "pick up from", "pickup area", "which sector", "sector", "uttara", "deliver to", "my area", "location", "kothay", "kon area", "kon jaygay", "কোথায়", "এলাকা", "সেক্টর", "উত্তরা", "আসেন", "আসবেন"],
    en: "We pick up and deliver across Uttara Sector 1 to 18. Outside that area, please ask us first. [Message Velto](/go/whatsapp)",
    bn: "উত্তরা সেক্টর ১ থেকে ১৮ পর্যন্ত আমরা পিকআপ ও ডেলিভারি দিই। এর বাইরে হলে আগে আমাদের জিজ্ঞেস করুন। [মেসেজ করুন](/go/whatsapp)",
  },
  {
    id: "delivery",
    keys: ["free", "delivery charge", "delivery fee", "pickup charge", "charge", "minimum", "shipping", "delivery cost", "free delivery", "fri", "delivery koto", "চার্জ", "ফ্রি", "ডেলিভারি খরচ", "ডেলিভারি চার্জ", "সর্বনিম্ন"],
    en: "Pickup and delivery are free on orders of ৳499 or more. Regular weekly or fortnightly orders qualify from ৳300. Smaller orders have a delivery charge, which we confirm when we call.",
    bn: "৳৪৯৯ বা তার বেশি অর্ডারে পিকআপ ও ডেলিভারি ফ্রি। সাপ্তাহিক বা পাক্ষিক নিয়মিত অর্ডারে ৳৩০০ থেকেই ফ্রি। ছোট অর্ডারে ডেলিভারি চার্জ আছে, কল করে জানিয়ে দিই।",
  },
  {
    id: "offer",
    keys: ["!offer", "!discount", "promo", "!coupon", "code", "first order", "new customer", "deal", "less", "chhar", "char", "!ছাড়", "!অফার", "!ডিসকাউন্ট", "কুপন", "প্রথম অর্ডার"],
    en: "Your first booking on the website gets 10% off, whatever the amount. No code needed. [Book a pickup](/book)",
    bn: "ওয়েবসাইটে প্রথম বুকিংয়ে ১০% ছাড়, যত টাকারই অর্ডার হোক। কোনো কোড লাগবে না। [পিকআপ বুক করুন](/book)",
  },
  {
    id: "book",
    keys: ["book", "booking", "order", "how to order", "place an order", "schedule", "pickup", "pick up", "collect", "come and take", "nite asben", "niye jan", "order dite", "order korbo", "bukin", "বুক", "অর্ডার করব", "অর্ডার দিতে", "পিকআপ", "নিয়ে যান", "নিতে আসবেন"],
    en: "Book online or message us on WhatsApp. We call to confirm your pickup time. [Book a pickup](/book) [WhatsApp](/go/whatsapp)",
    bn: "অনলাইনে বুক করুন অথবা WhatsApp-এ মেসেজ দিন। পিকআপের সময় আমরা কল করে নিশ্চিত করি। [পিকআপ বুক করুন](/book) [WhatsApp](/go/whatsapp)",
  },
  {
    id: "track",
    keys: ["!track", "status", "where is my order", "my order", "!order status", "ready yet", "is it ready", "order ki", "amar order", "অর্ডারের অবস্থা", "আমার অর্ডার", "!ট্র্যাক", "রেডি হয়েছে"],
    en: "Track your order with your order number and phone number. [Track an order](/track)",
    bn: "অর্ডার নম্বর আর ফোন নম্বর দিয়ে অর্ডার ট্র্যাক করুন। [অর্ডার ট্র্যাক করুন](/track)",
  },
  {
    id: "outlets",
    keys: ["!outlet", "!shop", "!store", "!branch", "!address", "visit", "drop off", "drop", "!open", "!opening", "hours", "close", "closing", "timing", "!dokan", "khola", "bondho", "!দোকান", "!শাখা", "!ঠিকানা", "!খোলা", "বন্ধ", "!আউটলেট"],
    en: "Sector 11, House 2, Road 14. Open 9 AM to 10 PM.\nSector 18, RUAP, Poncoboti Bazar. Open 10 AM to 9 PM. [See on the map](/locations)",
    bn: "সেক্টর ১১, বাড়ি ২, রোড ১৪। খোলা সকাল ৯টা থেকে রাত ১০টা।\nসেক্টর ১৮, RUAP, পঞ্চবটি বাজার। খোলা সকাল ১০টা থেকে রাত ৯টা। [ম্যাপে দেখুন](/locations)",
  },
  {
    id: "stains",
    keys: ["!stain", "!stains", "spot", "mark", "oil", "ink", "turmeric", "!dag", "!daag", "!দাগ", "হলুদ", "তেল"],
    en: "We check and treat visible stains, but no laundry can promise every stain will come out. Send us a photo and we'll take a look. [Send a photo](/go/whatsapp)",
    bn: "আমরা দাগ দেখে যত্ন করে পরিষ্কার করি, তবে সব দাগ উঠে যাবে এমন কথা কোনো লন্ড্রিই দিতে পারে না। ছবি পাঠালে আমরা দেখে জানাব। [ছবি পাঠান](/go/whatsapp)",
  },
  {
    id: "household",
    keys: ["curtain", "curtains", "carpet", "carpets", "rug", "blanket", "comforter", "quilt", "duvet", "bedding", "porda", "kombol", "lep", "পর্দা", "কার্পেট", "কম্বল", "লেপ", "কমফোর্টার", "তোশক"],
    en: "Curtains and carpets are priced by size, material and condition. Share rough measurements and we confirm the price. [Get a quote](/quote)",
    bn: "পর্দা ও কার্পেটের দাম মাপ, কাপড় ও অবস্থার ওপর নির্ভর করে। আনুমানিক মাপ দিন, আমরা দাম জানিয়ে দেব। [দাম জানুন](/quote)",
  },
  {
    id: "which",
    keys: ["!which service", "!difference", "dry clean or", "wash or", "recommend", "suit", "should i", "!kon service", "kon ta", "!কোন সার্ভিস", "!পার্থক্য", "কোনটা"],
    en: "Wash & Iron for everyday clothes. Ironing if you wash at home. Dry Cleaning for suits, saris, blazers and delicate pieces. Not sure? Send us a photo. [Ask on WhatsApp](/go/whatsapp)",
    bn: "রোজকার কাপড়ে ওয়াশ ও আয়রন। বাসায় ধুলে শুধু আয়রন। স্যুট, শাড়ি, ব্লেজার ও নাজুক পোশাকে ড্রাই ক্লিনিং। বুঝতে না পারলে ছবি পাঠান। [WhatsApp-এ জিজ্ঞেস করুন](/go/whatsapp)",
  },
  {
    id: "services",
    keys: ["services", "what do you do", "what do you clean", "do you clean", "do you wash", "laundry", "dry cleaning", "ironing", "iron", "wash", "dhulai", "istri", "ki ki", "সার্ভিস", "ধোয়া", "আয়রন", "ইস্ত্রি", "ড্রাই ক্লিন", "লন্ড্রি"],
    en: "We do Dry Cleaning, Wash & Iron and Ironing, plus curtains, carpets and bedding, with pickup from your door. [See all services](/services)",
    bn: "আমরা ড্রাই ক্লিনিং, ওয়াশ ও আয়রন, আয়রন, আর পর্দা, কার্পেট ও বিছানার কাপড় করি, বাসা থেকে পিকআপসহ। [সব সার্ভিস দেখুন](/services)",
  },
  {
    id: "regular",
    keys: ["!regular", "!weekly", "!every week", "!monthly", "!subscription", "!recurring", "routine", "fortnight", "!proti soptahe", "!প্রতি সপ্তাহে", "!নিয়মিত", "!সাপ্তাহিক", "মাসিক"],
    en: "Yes. We can pick up on the same day every week or fortnight. Regular orders of ৳300 or more get free pickup and delivery. [Set up regular pickup](/regular-laundry)",
    bn: "হ্যাঁ। প্রতি সপ্তাহে বা দুই সপ্তাহে একই দিনে পিকআপ করা যায়। নিয়মিত ৳৩০০ বা তার বেশি অর্ডারে পিকআপ ও ডেলিভারি ফ্রি। [নিয়মিত পিকআপ ঠিক করুন](/regular-laundry)",
  },
  {
    id: "process",
    keys: ["process", "how does it work", "how it works", "safe", "lost", "mix up", "mixed", "tag", "quality", "care", "kivabe", "কীভাবে", "কিভাবে", "নিরাপদ", "হারাবে", "ট্যাগ"],
    en: "Every item is tagged so it stays with your order. We check it before cleaning and again before packing. [How it works](/how-it-works)",
    bn: "প্রতিটি আইটেমে ট্যাগ দেওয়া হয়, তাই আপনার অর্ডারের সাথেই থাকে। পরিষ্কারের আগে আর প্যাক করার আগে দুইবার চেক করি। [কীভাবে কাজ করে](/how-it-works)",
  },
  {
    id: "payment",
    keys: ["pay", "!payment", "!bkash", "!nagad", "cash", "card", "taka dibo", "payment kivabe", "!বিকাশ", "!নগদ", "!পেমেন্ট", "ক্যাশ", "টাকা দেব"],
    en: "We confirm the amount when we call. For payment options, please ask us on WhatsApp. [Message Velto](/go/whatsapp)",
    bn: "কল করার সময় আমরা মোট টাকা জানিয়ে দিই। পেমেন্টের উপায় জানতে WhatsApp-এ জিজ্ঞেস করুন। [মেসেজ করুন](/go/whatsapp)",
  },
  {
    id: "problem",
    keys: ["!complain", "!complaint", "!damage", "!damaged", "!missing", "!refund", "problem", "issue", "wrong", "not happy", "bad", "!cancel", "change my", "!reschedule", "late", "osubidha", "!nosto", "!অভিযোগ", "সমস্যা", "!নষ্ট", "!হারিয়ে", "!বাতিল", "পরিবর্তন", "দেরি", "ফেরত"],
    en: "Sorry about that. Please message us with your order number and we'll sort it out. [Message Velto](/go/whatsapp)",
    bn: "দুঃখিত। অর্ডার নম্বরসহ আমাদের মেসেজ দিন, আমরা সমাধান করে দেব। [মেসেজ করুন](/go/whatsapp)",
  },
  {
    id: "contact",
    keys: ["contact", "phone", "number", "whatsapp", "call", "mobile", "nombor", "ফোন", "নম্বর", "যোগাযোগ", "কল"],
    en: "You can reach our team on WhatsApp or by phone. [WhatsApp](/go/whatsapp) [Call us](/go/call)",
    bn: "WhatsApp বা ফোনে আমাদের টিমকে পাবেন। [WhatsApp](/go/whatsapp) [কল করুন](/go/call)",
  },
  {
    id: "reviews",
    keys: ["review", "reviews", "rating", "google", "trust", "good", "reliable", "রিভিউ", "রেটিং", "ভালো"],
    en: "Our Sector 11 outlet is rated 5.0 on Google from over 100 reviews. [Read the reviews](/locations)",
    bn: "Google-এ আমাদের সেক্টর ১১ আউটলেটের রেটিং ৫.০, ১০০টির বেশি রিভিউ। [রিভিউ পড়ুন](/locations)",
  },
  {
    id: "thanks",
    keys: ["thank", "thanks", "thx", "ok", "okay", "great", "dhonnobad", "ধন্যবাদ", "আচ্ছা", "ঠিক আছে"],
    en: "Happy to help. Ask anytime.",
    bn: "আপনাকেও ধন্যবাদ। যেকোনো সময় জিজ্ঞেস করবেন।",
  },
  {
    id: "hello",
    keys: ["hi", "hello", "hey", "salam", "assalamu", "good morning", "good evening", "হ্যালো", "সালাম", "আসসালামু"],
    en: "Hi! Ask about prices, pickup, delivery or our services.",
    bn: "হ্যালো! দাম, পিকআপ, ডেলিভারি বা সার্ভিস নিয়ে জিজ্ঞেস করুন।",
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
    ? "দুঃখিত, ঠিক বুঝতে পারিনি। দাম, পিকআপ বা ডেলিভারি নিয়ে জিজ্ঞেস করুন, অথবা টিমকে মেসেজ দিন। [মেসেজ করুন](/go/whatsapp)"
    : "Sorry, I didn't get that. Try asking about a price, pickup or delivery, or message our team. [Message Velto](/go/whatsapp)";

export const askItem = (lang: ChatLang) =>
  lang === "bn"
    ? "কোন আইটেম? যেমন শার্ট, শাড়ি, ব্লেজার বা পাঞ্জাবি। [সব দাম দেখুন](/pricing)"
    : "Which item? For example a shirt, saree, blazer or panjabi. [See all prices](/pricing)";

const SERVICE: Record<string, Record<ChatLang, string>> = {
  "wash-and-iron": { en: "Wash & Iron", bn: "ওয়াশ ও আয়রন" },
  ironing: { en: "Ironing", bn: "আয়রন" },
  "dry-cleaning": { en: "Dry Cleaning", bn: "ড্রাই ক্লিনিং" },
};
const SERVICE_ORDER = ["wash-and-iron", "ironing", "dry-cleaning"];

export type PriceRow = { name: string; services: { slug: string; name: string; price: string | null }[] };

/**
 * A price card line in a reply: "[[price]]Item|Service=৳100|Service=৳80". The chat draws it as a
 * small card (item, then each service and its price); it never shows the marks themselves.
 */
export const PRICE_LINE = "[[price]]";

/** Price-list results as a reply: up to three item cards and one short line. */
export function priceReply(rows: PriceRow[], asked: string[], lang: ChatLang): string {
  void asked;
  if (!rows.length) {
    return lang === "bn"
      ? "এই আইটেমটি প্রাইস লিস্টে পাইনি। প্রাইস পেজে খুঁজে দেখুন, অথবা আমাদের জিজ্ঞেস করুন। [সব দাম দেখুন](/pricing) [WhatsApp](/go/whatsapp)"
      : "I couldn't find that item in our price list. Try the pricing page or ask us. [See all prices](/pricing) [WhatsApp](/go/whatsapp)";
  }
  const after = lang === "bn" ? "দেখে দাম জানানো হবে" : "After assessment";
  const clean = (x: string) => x.replace(/[|=\n]/g, " ").trim();
  const cards = rows.slice(0, 3).map((r) => {
    const services = [...r.services].sort((a, b) => SERVICE_ORDER.indexOf(a.slug) - SERVICE_ORDER.indexOf(b.slug));
    return `${PRICE_LINE}${clean(r.name)}|${services.map((x) => `${clean(SERVICE[x.slug]?.[lang] ?? x.name)}=${clean(x.price ?? after)}`).join("|")}`;
  });
  const tail = lang === "bn" ? "৳৪৯৯ বা তার বেশি অর্ডারে পিকআপ ও ডেলিভারি ফ্রি। [পিকআপ বুক করুন](/book)" : "Free pickup and delivery on orders of ৳499 or more. [Book a pickup](/book)";
  return [...cards, tail].join("\n");
}

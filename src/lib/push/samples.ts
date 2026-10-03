import type { PushContext, PushLang, PushStateId } from "./catalog";

/**
 * Realistic sample details for each notification design (admin gallery and staff test sends). The
 * order number, window and amounts are examples, never a real customer's.
 */
export function sampleContext(id: PushStateId, lang: PushLang): PushContext {
  const bn = lang === "bn";
  const base: PushContext = {
    orderNumber: "VEL-01482",
    garments: 18,
    amount: 460,
    window: bn ? "আজ সন্ধ্যা ৬–৮টা" : "today, 6–8 PM",
    returnDay: bn ? "বৃহস্পতিবার" : "Thursday",
    service: bn ? "আয়রন" : "Iron Only",
    bookPath: bn ? "/bn/book" : "/book",
  };
  if (id === "P02") return { ...base, window: bn ? "আজ সন্ধ্যা ৬–৮টার মধ্যে" : "today between 6–8 PM" };
  if (id === "P07") return { ...base, orderNumber: "VEL-01491" };
  if (id === "P14r") return { ...base, reason: bn ? "bKash নম্বর মেলেনি" : "The bKash number did not match" };
  if (id === "P17") return { ...base, window: bn ? "আগামীকাল সন্ধ্যা ৬–৮টা" : "tomorrow, 6–8 PM" };
  return base;
}

import { WHATSAPP_URL } from "@/content/site";

/** A WhatsApp link with the message prefilled (the /go/whatsapp redirect adds Velto's number). */
export const waHref = (text: string) => `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`;

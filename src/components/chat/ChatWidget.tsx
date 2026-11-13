"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { CloseIcon, WhatsAppIcon } from "@/components/ui/icons";
import { dictionary } from "@/content/i18n";
import { chatText } from "@/content/i18n/chat";
import { WHATSAPP_URL } from "@/content/site";
import { CHAT_LIMITS, parseReply, type ChatTurn, type ReplyPart } from "@/lib/chat/shared";
import { localizeHref, type Locale } from "@/lib/i18n/config";

type Msg = ChatTurn & { id: number; person?: boolean };
type Quick = "price" | "turnaround" | "area" | "free" | "stains" | "person";

const QUICK: Quick[] = ["price", "turnaround", "area", "free", "stains", "person"];
/** The quick questions answered with the website's approved FAQ words (dictionary().faqs). */
const FAQ_INDEX: Partial<Record<Quick, number>> = { turnaround: 0, area: 1, free: 2, stains: 3 };
const STORE = "velto_chat_v1";
/** Fixed bars at the bottom of the screen the launcher must sit above. */
const BOTTOM_BARS = "[data-mobile-bar], [data-app-tabs], [data-total-bar]";
const TEXT_ENTRY = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select";

type Saved = { conversation: string; messages: Msg[] };

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    const v = raw ? (JSON.parse(raw) as Saved) : null;
    return v && typeof v.conversation === "string" && Array.isArray(v.messages) ? v : null;
  } catch {
    return null;
  }
}

function save(v: Saved) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(v));
  } catch {
    // Private mode or full storage: the chat still works for this page.
  }
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "");

function Parts({ parts, locale }: { parts: ReplyPart[]; locale: Locale }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "link" ? (
          <a
            key={i}
            href={p.href.startsWith("/") && !p.external ? localizeHref(p.href, locale) : p.href}
            {...(p.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="font-semibold text-action underline decoration-action/40 underline-offset-[3px] hover:decoration-action"
            data-analytics={p.href === WHATSAPP_URL ? "whatsapp_click" : "chat_link_click"}
            data-placement="chat"
          >
            {p.text}
          </a>
        ) : p.bold ? (
          <strong key={i} className="font-semibold text-navy">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function Reply({ text, locale }: { text: string; locale: Locale }) {
  return (
    <div className="space-y-2">
      {parseReply(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            <Parts parts={b.parts} locale={locale} />
          </p>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-secondary">
            {b.items.map((item, k) => (
              <li key={k}>
                <Parts parts={item} locale={locale} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** The official Velto mark (the app icon, public/icons): never redrawn. */
function Mark({ className = "size-9" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 192px static icon; next/image adds nothing here
    <img src="/icons/icon-192.png" alt="" width={36} height={36} className={`shrink-0 rounded-full ${className}`} />
  );
}

function ChatIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12.5a7.5 7.5 0 0 1-11.1 6.6L4 20l1-4.4A7.5 7.5 0 1 1 20 12.5z" />
      <path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" strokeWidth="2.8" />
    </svg>
  );
}

/**
 * The website chat: a "Ask Velto" button bottom right, a panel on desktop and a full screen on
 * phones. Quick questions answer at once from the website's FAQ; typed questions stream from
 * /api/chat. The conversation lasts for the browser tab (sessionStorage). WhatsApp is always
 * one tap away, and the footer says the replies are automatic.
 */
export function ChatWidget() {
  const locale = useLocale();
  const t = chatText(locale);
  const faqs = dictionary(locale).faqs;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversation, setConversation] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [lift, setLift] = useState(0);
  const [hideLauncher, setHideLauncher] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seq = useRef(1);

  // This tab's conversation comes back when the chat is opened (sessionStorage).
  const restored = useRef(false);
  const openChat = () => {
    if (!restored.current) {
      restored.current = true;
      const saved = load();
      if (saved) {
        setConversation(saved.conversation);
        setMessages(saved.messages);
        seq.current = saved.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      } else setConversation(newId());
    }
    setOpen(true);
  };

  useEffect(() => {
    if (conversation && !busy) save({ conversation, messages });
  }, [conversation, messages, busy]);

  // Sit above the page's own bottom bars; step aside for the cookie banner and while typing in a page form.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let h = 0;
        document.querySelectorAll<HTMLElement>(BOTTOM_BARS).forEach((el) => {
          const r = el.getBoundingClientRect();
          const visible = getComputedStyle(el).visibility !== "hidden" && r.height > 0 && r.top < window.innerHeight - 4;
          if (visible) h = Math.max(h, window.innerHeight - r.top);
        });
        setLift(h);
        const active = document.activeElement;
        const typingInPage = !!active?.matches?.(TEXT_ENTRY) && !active.closest("[data-chat-panel]") && window.innerWidth < 768;
        setHideLauncher(!!document.querySelector("[data-consent-banner]") || typingInPage);
      });
    };
    measure();
    const mo = new MutationObserver(measure);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    document.addEventListener("focusin", measure);
    document.addEventListener("focusout", measure);
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      document.removeEventListener("focusin", measure);
      document.removeEventListener("focusout", measure);
    };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, waiting, open]);

  // Escape closes; on phones the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const small = window.matchMedia("(max-width: 767px)").matches;
    const prev = document.body.style.overflow;
    if (small) document.body.style.overflow = "hidden";
    if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus({ preventScroll: true });
  };

  const push = useCallback((m: Omit<Msg, "id">) => {
    const id = seq.current++;
    setMessages((list) => [...list, { ...m, id }]);
    return id;
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;
      if (text.length > CHAT_LIMITS.messageChars) {
        setNotice(t.tooLong.replace("{n}", String(CHAT_LIMITS.messageChars)));
        return;
      }
      setNotice(null);
      setDraft("");
      const history: ChatTurn[] = [...messages.filter((m) => !m.person).map(({ role, text: x }) => ({ role, text: x })), { role: "user", text }];
      push({ role: "user", text });
      setBusy(true);
      setWaiting(true);
      const controller = new AbortController();
      abortRef.current = controller;
      let replyId = 0;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang: locale, conversation, page: location.pathname, messages: history }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          if (res.status === 503) setOffline(true);
          setNotice(res.status === 429 ? t.limited : res.status === 503 ? t.offline : t.failed);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (!acc) continue;
          setWaiting(false);
          if (!replyId) replyId = push({ role: "assistant", text: acc });
          else setMessages((list) => list.map((m) => (m.id === replyId ? { ...m, text: acc } : m)));
        }
        if (!acc) setNotice(t.failed);
      } catch {
        if (!controller.signal.aborted) setNotice(t.failed);
      } finally {
        setBusy(false);
        setWaiting(false);
        abortRef.current = null;
      }
    },
    [busy, conversation, locale, messages, push, t],
  );

  const quick = (q: Quick) => {
    if (busy) return;
    setNotice(null);
    push({ role: "user", text: t.quick[q] });
    if (q === "person") {
      push({ role: "assistant", text: t.personReply, person: true });
      return;
    }
    if (q === "price") {
      push({ role: "assistant", text: t.priceAsk });
      inputRef.current?.focus();
      return;
    }
    const faq = faqs[FAQ_INDEX[q] ?? -1];
    if (faq) push({ role: "assistant", text: faq.a.join(" ") });
  };

  const restart = () => {
    abortRef.current?.abort();
    setMessages([]);
    setNotice(null);
    const id = newId();
    setConversation(id);
    save({ conversation: id, messages: [] });
  };

  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.text));
  const chips = QUICK.filter((q) => !asked.has(t.quick[q]));

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={openChat}
        aria-label={t.launcherLabel}
        aria-expanded={open}
        aria-controls="velto-chat"
        data-analytics="chat_open"
        data-chat-launcher
        style={{ bottom: `calc(${lift ? `${Math.round(lift)}px + 12px` : "16px + env(safe-area-inset-bottom)"})` }}
        className={`fixed right-4 z-[35] inline-flex h-14 items-center gap-2 rounded-full bg-navy pl-4 pr-4 text-white shadow-[0_10px_28px_-8px_rgba(0,49,83,0.55)] transition-[opacity,transform] duration-200 hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action motion-reduce:transition-none md:right-6 md:pr-5 ${
          open || hideLauncher ? "pointer-events-none translate-y-2 opacity-0" : "opacity-100"
        }`}
      >
        <ChatIcon className="size-6" />
        <span className="hidden text-[15px] font-semibold md:inline">{t.launcher}</span>
      </button>

      <section
        id="velto-chat"
        role="dialog"
        aria-modal="false"
        aria-labelledby="velto-chat-title"
        hidden={!open}
        data-chat-panel
        lang={locale}
        className="fixed inset-0 z-[55] flex flex-col bg-white md:inset-auto md:bottom-6 md:right-6 md:h-[min(640px,calc(100dvh-48px))] md:w-[400px] md:overflow-hidden md:rounded-xl md:border md:border-line md:shadow-[0_24px_60px_-18px_rgba(0,49,83,0.35)]"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] md:pt-3">
          <Mark />
          <div className="min-w-0 flex-1">
            <h2 id="velto-chat-title" className="text-[16px] font-semibold leading-tight text-navy">
              {t.title}
            </h2>
            <p className="truncate text-[13px] text-secondary">{t.subtitle}</p>
          </div>
          {messages.length ? (
            <button type="button" onClick={restart} className="rounded-md px-2 py-1.5 text-[13px] font-semibold text-secondary hover:bg-soft hover:text-navy">
              {t.restart}
            </button>
          ) : null}
          <button type="button" onClick={close} aria-label={t.close} className="inline-grid size-10 place-items-center rounded-full text-navy hover:bg-soft">
            <CloseIcon className="size-5" />
          </button>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain bg-soft/60 px-4 py-4" aria-live="polite" aria-relevant="additions text">
          <div className="flex items-end gap-2">
            <Mark className="size-7" />
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-body shadow-[0_1px_0_rgba(0,49,83,0.06)]">
              {t.welcome}
            </div>
          </div>

          <ol className="mt-3 space-y-3">
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-action px-3.5 py-2.5 text-[15px] leading-relaxed text-white">{m.text}</p>
                </li>
              ) : (
                <li key={m.id} className="flex items-end gap-2">
                  <Mark className="size-7" />
                  <div className="max-w-[85%] break-words rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-body shadow-[0_1px_0_rgba(0,49,83,0.06)]">
                    <Reply text={m.text} locale={locale} />
                    {m.person ? (
                      <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex h-10 items-center gap-2 rounded-md border border-line px-3.5 text-[14px] font-semibold text-navy hover:border-navy"
                        data-analytics="whatsapp_click"
                        data-placement="chat"
                      >
                        <WhatsAppIcon className="size-4 text-whatsapp" />
                        {t.personButton}
                      </a>
                    ) : null}
                  </div>
                </li>
              ),
            )}
            {waiting ? (
              <li className="flex items-end gap-2">
                <Mark className="size-7" />
                <span role="status" aria-label={t.typing} className="inline-flex h-10 items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 shadow-[0_1px_0_rgba(0,49,83,0.06)]">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" style={{ animationDelay: `${i * 180}ms` }} />
                  ))}
                </span>
              </li>
            ) : null}
          </ol>

          {chips.length && !busy ? (
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-secondary">{t.quickTitle}</p>
              <div className="flex flex-wrap gap-2">
                {chips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => quick(q)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-left text-[14px] font-medium text-navy hover:border-navy"
                    data-analytics="chat_quick"
                    data-placement={q}
                  >
                    {q === "person" ? <WhatsAppIcon className="size-4 text-whatsapp" /> : null}
                    {t.quick[q]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {notice ? (
            <p role="alert" className="mt-4 rounded-md border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[14px] text-navy">
              {notice}{" "}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-[3px]" data-analytics="whatsapp_click" data-placement="chat">
                WhatsApp
              </a>
            </p>
          ) : null}
        </div>

        <form
          className="border-t border-line bg-white px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-3 md:pb-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          {/* One rounded field: the field itself takes no outline; the frame tints softly while typing. */}
          <div className="flex items-end gap-1.5 rounded-[26px] border border-line bg-soft py-1.5 pl-4 pr-1.5 transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-action/60 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(0,120,188,0.10)] motion-reduce:transition-none">
            <label htmlFor="velto-chat-input" className="sr-only">
              {t.placeholder}
            </label>
            <textarea
              id="velto-chat-input"
              ref={inputRef}
              rows={1}
              value={draft}
              disabled={offline}
              maxLength={CHAT_LIMITS.messageChars + 50}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void ask(draft);
                }
              }}
              placeholder={t.placeholder}
              className="max-h-32 min-h-9 flex-1 resize-none self-center border-0 bg-transparent py-1.5 text-[16px] leading-snug text-navy outline-none placeholder:text-muted focus:outline-none focus-visible:outline-none md:text-[15px]"
              style={{ fieldSizing: "content", outline: "none" } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={busy || offline || !draft.trim()}
              aria-label={t.send}
              className="inline-grid size-10 shrink-0 place-items-center rounded-full bg-action text-white transition-colors hover:bg-action-hover focus-visible:outline-offset-2 disabled:bg-line disabled:text-white"
            >
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </button>
          </div>
          <p className="mt-2 flex items-center justify-between gap-2 px-1 text-[12px] text-secondary">
            <span>{t.footer}</span>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-navy hover:underline" data-analytics="whatsapp_click" data-placement="chat_footer">
              <WhatsAppIcon className="size-3.5 text-whatsapp" />
              {t.footerPerson}
            </a>
          </p>
        </form>
      </section>
    </>
  );
}

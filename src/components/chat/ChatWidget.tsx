"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { CloseIcon, WhatsAppIcon } from "@/components/ui/icons";
import { chatText } from "@/content/i18n/chat";
import { WHATSAPP_URL } from "@/content/site";
import { ANSWERS } from "@/lib/chat/answers";
import { CHAT_LIMITS, parseReply, type ChatTurn, type ReplyLink, type ReplyPart } from "@/lib/chat/shared";
import { localizeHref, type Locale } from "@/lib/i18n/config";

type Msg = ChatTurn & { id: number; person?: boolean };
type Quick = "price" | "turnaround" | "area" | "free" | "stains" | "person";

const QUICK: Quick[] = ["price", "turnaround", "area", "free", "stains", "person"];
/** Quick questions answered with the chat's own short answers (src/lib/chat/answers.ts). */
const ANSWER_ID: Partial<Record<Quick, string>> = { turnaround: "turnaround", area: "area", free: "delivery", stains: "stains" };
const STORE = "velto_chat_v1";
/** The greeting bubble beside the button: once per visit, and never after the chat was opened. */
const GREETED = "velto_chat_greeted";
const GREET_AFTER_MS = 6000;
/** Fixed bars at the bottom of the screen the launcher must sit above. */
const BOTTOM_BARS = "[data-mobile-bar], [data-app-tabs], [data-total-bar]";
const TEXT_ENTRY = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select";

/** How long "Velto is typing" shows before a reply: longer replies take a little longer, like a person. */
const typingMs = (text: string) => Math.min(1900, Math.max(850, 450 + text.length * 9));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function flag(key: string, set?: boolean): boolean {
  try {
    if (set) sessionStorage.setItem(key, "1");
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "");

const hrefFor = (l: ReplyLink, locale: Locale) => (l.href.startsWith("/") && !l.external ? localizeHref(l.href, locale) : l.href);

function Parts({ parts, locale }: { parts: ReplyPart[]; locale: Locale }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "link" ? (
          <a
            key={i}
            href={hrefFor(p, locale)}
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

function PhoneIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h3l1.5 4.5-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2L20 16v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" />
    </svg>
  );
}

/** A reply's closing links, as buttons: booking is the main one, WhatsApp and call carry their icon. */
function Actions({ actions, locale }: { actions: ReplyLink[]; locale: Locale }) {
  if (!actions.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((a, i) => {
        const wa = a.href === WHATSAPP_URL;
        const call = a.href === "/go/call";
        const primary = a.href.startsWith("/book");
        return (
          <a
            key={`${a.href}-${i}`}
            href={hrefFor(a, locale)}
            {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${
              primary ? "bg-action text-white hover:bg-action-hover" : "border border-line-strong bg-white text-navy hover:border-navy"
            }`}
            data-analytics={wa ? "whatsapp_click" : call ? "call_click" : "chat_link_click"}
            data-placement="chat"
          >
            {wa ? <WhatsAppIcon className="size-4 text-whatsapp" /> : call ? <PhoneIcon className="size-4 text-action" /> : null}
            {a.text}
          </a>
        );
      })}
    </div>
  );
}

function Reply({ text, locale }: { text: string; locale: Locale }) {
  const { blocks, actions } = parseReply(text);
  return (
    <>
      <div className="space-y-2">
        {blocks.map((b, i) =>
          b.kind === "price" ? (
            <div key={i} className="rounded-xl border border-line bg-soft/70 p-3">
              <p className="font-semibold leading-snug text-navy">{b.item}</p>
              <dl className="mt-2 grid grid-cols-3 gap-1.5">
                {b.rows.map((r) => (
                  <div key={r.label} className="flex flex-col justify-between rounded-lg bg-white px-2 py-1.5 text-center">
                    <dt className="text-[11.5px] leading-tight text-secondary">{r.label}</dt>
                    <dd className="mt-0.5 text-[14.5px] font-semibold leading-tight text-navy">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : b.kind === "p" ? (
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
      <Actions actions={actions} locale={locale} />
    </>
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
 * The website chat: an "Ask Velto" button bottom right that slides in after the page settles,
 * with a one-time greeting beside it; a panel on desktop and a full screen on phones. Quick
 * questions and typed questions get short answers after a brief "typing" pause, prices as small
 * cards, and next steps as buttons. The conversation lasts for the browser tab (sessionStorage).
 * WhatsApp is always one tap away, and the footer says the replies are automatic.
 */
export function ChatWidget() {
  const locale = useLocale();
  const t = chatText(locale);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversation, setConversation] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lift, setLift] = useState(0);
  const [hideLauncher, setHideLauncher] = useState(false);
  const [shown, setShown] = useState(false);
  const [greet, setGreet] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
    setGreet(false);
    flag(GREETED, true);
    setOpen(true);
  };

  // The button slides in once the page has settled; the greeting follows a few seconds later.
  useEffect(() => {
    const a = setTimeout(() => setShown(true), 900);
    const b = setTimeout(() => {
      if (!flag(GREETED)) {
        flag(GREETED, true);
        setGreet(true);
      }
    }, GREET_AFTER_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

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

  // Keep the newest message in view: a long reply is shown from its start, not its end.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const all = el.querySelectorAll<HTMLElement>("[data-msg]");
    const last = all[all.length - 1];
    if (last && last.dataset.role === "assistant" && last.offsetHeight > el.clientHeight * 0.6) {
      el.scrollTop = last.offsetTop - 12;
    } else el.scrollTop = el.scrollHeight;
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

  /** Shows "typing" for a moment, then the reply. */
  const reply = useCallback(
    async (m: Omit<Msg, "id" | "role">, started = Date.now()) => {
      setWaiting(true);
      await wait(Math.max(0, typingMs(m.text) - (Date.now() - started)));
      setWaiting(false);
      push({ role: "assistant", ...m });
    },
    [push],
  );

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
      setMoreOpen(false);
      const history: ChatTurn[] = [...messages.filter((m) => !m.person).map(({ role, text: x }) => ({ role, text: x })), { role: "user", text }];
      push({ role: "user", text });
      setBusy(true);
      setWaiting(true);
      const started = Date.now();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang: locale, conversation, page: location.pathname, messages: history }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setWaiting(false);
          setNotice(res.status === 429 ? t.limited : t.failed);
          return;
        }
        const answer = (await res.text()).trim();
        if (!answer) {
          setWaiting(false);
          setNotice(t.failed);
          return;
        }
        await reply({ text: answer }, started);
      } catch {
        setWaiting(false);
        if (!controller.signal.aborted) setNotice(t.failed);
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, conversation, locale, messages, push, reply, t],
  );

  const quick = async (q: Quick) => {
    if (busy) return;
    setNotice(null);
    setMoreOpen(false);
    push({ role: "user", text: t.quick[q] });
    setBusy(true);
    if (q === "person") await reply({ text: `${t.personReply} [${t.personButton}](${WHATSAPP_URL})`, person: true });
    else if (q === "price") {
      await reply({ text: t.priceAsk });
      inputRef.current?.focus({ preventScroll: true });
    } else {
      const a = ANSWERS.find((x) => x.id === ANSWER_ID[q]);
      if (a) await reply({ text: a[locale] });
    }
    setBusy(false);
  };

  const restart = () => {
    abortRef.current?.abort();
    setMessages([]);
    setNotice(null);
    setMoreOpen(false);
    const id = newId();
    setConversation(id);
    save({ conversation: id, messages: [] });
  };

  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.text));
  const chips = QUICK.filter((q) => !asked.has(t.quick[q]));
  const showChips = !busy && chips.length > 0 && (messages.length === 0 || moreOpen);
  const launcherOff = open || hideLauncher || !shown;

  return (
    <>
      <div
        data-chat-launcher-wrap
        style={{ bottom: `calc(${lift ? `${Math.round(lift)}px + 12px` : "16px + env(safe-area-inset-bottom)"})` }}
        className={`fixed right-4 z-[35] flex flex-col items-end gap-2 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none md:right-6 ${
          launcherOff ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {greet && !launcherOff ? (
          <div className="chat-greet relative max-w-[270px] rounded-2xl rounded-br-md bg-white py-3 pl-4 pr-9 text-[14.5px] leading-snug text-navy shadow-[0_12px_32px_-10px_rgba(0,49,83,0.35)] ring-1 ring-line" role="status">
            <button type="button" onClick={openChat} className="text-left" data-analytics="chat_open" data-placement="greeting">
              <span className="block font-semibold">{t.greetTitle}</span>
              <span className="mt-0.5 block text-[13.5px] text-secondary">{t.greetBody}</span>
            </button>
            <button
              type="button"
              onClick={() => setGreet(false)}
              aria-label={t.greetClose}
              className="absolute right-1.5 top-1.5 inline-grid size-7 place-items-center rounded-full text-secondary hover:bg-soft hover:text-navy"
            >
              <CloseIcon className="size-3.5" />
            </button>
          </div>
        ) : null}
        <button
          ref={launcherRef}
          type="button"
          onClick={openChat}
          aria-label={t.launcherLabel}
          aria-expanded={open}
          aria-controls="velto-chat"
          data-analytics="chat_open"
          data-chat-launcher
          className={`relative inline-flex h-14 items-center gap-2 rounded-full bg-navy pl-4 pr-4 text-white shadow-[0_10px_28px_-8px_rgba(0,49,83,0.55)] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action motion-reduce:transition-none md:pr-5 ${
            greet ? "chat-ring" : ""
          }`}
        >
          <ChatIcon className="chat-wave size-6" />
          <span className="hidden text-[15px] font-semibold md:inline">{t.launcher}</span>
        </button>
      </div>

      <section
        id="velto-chat"
        role="dialog"
        aria-modal="false"
        aria-labelledby="velto-chat-title"
        hidden={!open}
        data-chat-panel
        lang={locale}
        className="chat-panel fixed inset-0 z-[55] flex flex-col bg-white md:inset-auto md:bottom-6 md:right-6 md:h-[min(640px,calc(100dvh-48px))] md:w-[400px] md:overflow-hidden md:rounded-xl md:border md:border-line md:shadow-[0_24px_60px_-18px_rgba(0,49,83,0.35)]"
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

        <div ref={listRef} className="relative flex-1 overflow-y-auto overscroll-contain bg-soft/60 px-4 py-4" aria-live="polite" aria-relevant="additions text">
          <div className="flex items-end gap-2">
            <Mark className="size-7" />
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-body shadow-[0_1px_0_rgba(0,49,83,0.06)]">{t.welcome}</div>
          </div>

          <ol className="mt-3 space-y-3">
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} data-msg data-role="user" className="chat-in flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-action px-3.5 py-2.5 text-[15px] leading-relaxed text-white">{m.text}</p>
                </li>
              ) : (
                <li key={m.id} data-msg data-role="assistant" className="chat-in flex items-end gap-2">
                  <Mark className="size-7" />
                  <div className="max-w-[85%] break-words rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-body shadow-[0_1px_0_rgba(0,49,83,0.06)]">
                    <Reply text={m.text} locale={locale} />
                  </div>
                </li>
              ),
            )}
            {waiting ? (
              <li className="chat-in flex items-end gap-2">
                <Mark className="size-7" />
                <span role="status" aria-label={t.typing} className="inline-flex h-10 items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 shadow-[0_1px_0_rgba(0,49,83,0.06)]">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="chat-dot size-1.5 rounded-full bg-secondary" style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </span>
              </li>
            ) : null}
          </ol>

          {showChips ? (
            <div className="chat-in mt-4">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-secondary">{t.quickTitle}</p>
              <div className="flex flex-wrap gap-2">
                {chips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void quick(q)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-left text-[14px] font-medium text-navy transition-colors hover:border-navy"
                    data-analytics="chat_quick"
                    data-placement={q}
                  >
                    {q === "person" ? <WhatsAppIcon className="size-4 text-whatsapp" /> : null}
                    {t.quick[q]}
                  </button>
                ))}
              </div>
            </div>
          ) : !busy && chips.length && messages.length ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="chat-in mt-4 inline-flex h-9 items-center gap-1.5 rounded-full px-1 text-[14px] font-semibold text-action hover:text-action-hover"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t.more}
            </button>
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
              maxLength={CHAT_LIMITS.messageChars + 50}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void ask(draft);
                }
              }}
              placeholder={t.placeholder}
              className="max-h-32 min-h-9 flex-1 resize-none self-center border-0 bg-transparent py-1.5 text-[16px] leading-snug text-navy outline-none placeholder:text-muted md:text-[15px]"
              style={{ fieldSizing: "content", outline: "none" } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={t.send}
              className="inline-grid size-10 shrink-0 place-items-center rounded-full bg-action text-white transition-colors hover:bg-action-hover disabled:bg-line disabled:text-white"
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

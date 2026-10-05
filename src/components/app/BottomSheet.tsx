"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * The app's bottom sheet: a native modal <dialog> (focus trap, Escape, inert page) pinned to the
 * bottom, with a drag handle, the title, Close top right, and an optional footer that stays in
 * view. Focus returns to whatever opened it. Styles: dialog[data-app-sheet] in app-shell.css.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  sub,
  closeLabel,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  closeLabel: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const closed = () => {
      onClose();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
    d.addEventListener("close", closed);
    return () => d.removeEventListener("close", closed);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-app-sheet
      // A tap on the scrim (the dialog box itself, outside the panel) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="px-5 pb-3 pt-2.5">
          <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-line-strong" />
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="a-section">
                {title}
              </h2>
              {sub ? <p className="mt-0.5 a-cap text-muted">{sub}</p> : null}
            </div>
            <button type="button" onClick={() => ref.current?.close()} className="-mr-2 -mt-1 min-h-11 px-2 a-sec font-semibold text-action">
              {closeLabel}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer ? <div className="border-t border-line bg-app-card px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">{footer}</div> : null}
      </div>
    </dialog>
  );
}

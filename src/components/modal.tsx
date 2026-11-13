"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { EASE_SHEET } from "./motion";

/**
 * A sheet on phones (rises from the bottom, within thumb reach) and a centred dialog on wider screens.
 * Focus moves into it on open and returns to the trigger on close.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus();
    });
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
      before?.focus?.();
    };
  }, [open, onClose, busy]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16 } }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="absolute inset-0 bg-[rgba(15,27,61,.42)]" onClick={() => !busy && onClose()} aria-hidden />
          <motion.div
            ref={panel}
            data-panel
            tabIndex={-1}
            className={`glass-strong relative flex max-h-[92dvh] w-full flex-col rounded-b-none outline-none sm:rounded-b-[var(--r)] ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
            style={{ borderStartStartRadius: 28, borderStartEndRadius: 28 }}
            initial={reduce ? { opacity: 0 } : { y: "24%", opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: "12%", opacity: 0, transition: { duration: 0.16, ease: "easeIn" } }}
            transition={{ duration: 0.36, ease: EASE_SHEET }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/15 sm:hidden" aria-hidden />
            <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-3 sm:pt-5">
              <h2 className="text-[18px] font-bold">{title}</h2>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} disabled={busy} aria-label="إغلاق">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="scroll-thin overflow-y-auto px-5 pb-5">{children}</div>
            {footer && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-ink/10 px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

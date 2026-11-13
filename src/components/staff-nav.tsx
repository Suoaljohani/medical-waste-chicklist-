"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { House, ListChecks, ScanLine } from "lucide-react";
import { cx } from "@/lib/utils";
import { Scanner } from "./scanner";

export const LAST_DEPT = "chk_last_dept";

/**
 * Floating dock for phones: home, scan, and the round in progress. Scan sits in the middle, largest,
 * because it is how every round starts. Hidden from sm up, where the page header carries the same actions.
 */
export function StaffNav() {
  const path = usePathname();
  const [dept, setDept] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const close = useCallback(() => setScan(false), []);
  useEffect(() => {
    try {
      const d = localStorage.getItem(LAST_DEPT);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage once after mount
      if (d) setDept(`/d/${d}`);
    } catch {}
  }, [path]);

  const side = "flex min-h-12 min-w-[76px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[12px] font-bold";
  const onRound = path.startsWith("/d/");
  return (
    <>
      <nav
        className="glass-thin fixed inset-x-4 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center justify-between gap-2 p-2 sm:hidden"
        style={{ borderRadius: 26 }}
        aria-label="التنقل الرئيسي"
      >
        <Link href="/" className={cx(side, path === "/" ? "text-sky" : "text-ink-2")} aria-current={path === "/" ? "page" : undefined}>
          <House className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden />
          الرئيسية
        </Link>
        <button type="button" className="btn btn-primary h-[52px] flex-1 rounded-[18px] text-[15px]" onClick={() => setScan(true)}>
          <ScanLine className="h-5 w-5" aria-hidden />
          مسح باركود القسم
        </button>
        {dept ? (
          <Link href={dept} className={cx(side, onRound ? "text-sky" : "text-ink-2")} aria-current={onRound ? "page" : undefined}>
            <ListChecks className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden />
            جولتي
          </Link>
        ) : (
          <span className={cx(side, "text-ink-3 opacity-60")} aria-disabled="true">
            <ListChecks className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden />
            جولتي
          </span>
        )}
      </nav>
      <Scanner open={scan} onClose={close} />
    </>
  );
}

/** Same action for wider screens and for the home page's main call to action. */
export function ScanButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [scan, setScan] = useState(false);
  const close = useCallback(() => setScan(false), []);
  return (
    <>
      <button type="button" className={className ?? "btn btn-primary"} onClick={() => setScan(true)}>
        <ScanLine className="h-5 w-5" aria-hidden />
        {children ?? "مسح باركود القسم"}
      </button>
      <Scanner open={scan} onClose={close} />
    </>
  );
}

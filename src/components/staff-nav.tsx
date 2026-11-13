"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { House, ListChecks, ScanLine } from "lucide-react";
import { cx } from "@/lib/utils";
import { Scanner } from "./scanner";

export const LAST_DEPT = "chk_last_dept";

/** Height of the bar itself, without the device's safe area. Pages reserve this plus their own bars. */
export const NAV_H = 64;

/**
 * Inspector navigation for phones: الرئيسية، مسح، جولتي. Docked to the bottom on glass, with the safe area
 * below it. «جولتي» stays active while a container of the round is being inspected.
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

  const onRound = path.startsWith("/d/");
  const item = (active: boolean) =>
    cx(
      "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[13px] font-bold transition-colors duration-[140ms]",
      active ? "text-ink" : "text-ink-2",
    );
  const mark = (active: boolean) => (active ? <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-[var(--action)]" aria-hidden /> : null);

  return (
    <>
      <nav
        className="glass-nav fixed inset-x-0 bottom-0 z-40 rounded-b-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] sm:hidden"
        aria-label="تنقل الفاحص"
      >
        <div className="mx-auto flex max-w-md items-stretch" style={{ height: NAV_H }}>
          <Link href="/" className={item(path === "/")} aria-current={path === "/" ? "page" : undefined}>
            {mark(path === "/")}
            <House className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
            الرئيسية
          </Link>
          <button type="button" className={item(false)} onClick={() => setScan(true)}>
            <span className="grid h-9 w-14 place-items-center rounded-[12px] bg-[var(--action)] text-[var(--action-text)]">
              <ScanLine className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
            </span>
            مسح
          </button>
          {dept ? (
            <Link href={dept} className={item(onRound)} aria-current={onRound ? "page" : undefined}>
              {mark(onRound)}
              <ListChecks className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
              جولتي
            </Link>
          ) : (
            <span className={cx(item(false), "opacity-60")} aria-disabled="true" title="غير متاح حتى تفتح قسمًا">
              <ListChecks className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
              جولتي
            </span>
          )}
        </div>
      </nav>
      <Scanner open={scan} onClose={close} />
    </>
  );
}

/** Same scan action for wider screens and inside pages. */
export function ScanButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [scan, setScan] = useState(false);
  const close = useCallback(() => setScan(false), []);
  return (
    <>
      <button type="button" className={className ?? "btn btn-primary"} onClick={() => setScan(true)}>
        <ScanLine className="h-5 w-5" aria-hidden />
        {children ?? "مسح رمز القسم"}
      </button>
      <Scanner open={scan} onClose={close} />
    </>
  );
}

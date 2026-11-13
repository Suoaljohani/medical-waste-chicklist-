"use client";

import { useEffect, useState } from "react";
import { zoned } from "@/lib/utils";

export function useNow(interval = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs once after mount (browser-only value / data fetch)
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

/** Day, date and time in hospital time. Updates once a minute; there is nothing to gain from seconds. */
export function LiveClock({ className = "" }: { className?: string }) {
  const now = useNow(30_000);
  const z = now ? zoned(now) : null;
  return (
    <p className={`text-[13.5px] text-ink-2 ${className}`}>
      {z ? (
        <>
          {z.dayAr} <span className="num" dir="ltr">{z.date}</span> — <span className="num">{z.timeAr}</span>
        </>
      ) : (
        "…"
      )}
    </p>
  );
}

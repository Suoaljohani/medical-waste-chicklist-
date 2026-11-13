"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { EASE } from "./motion";

export function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${Math.round(v).toLocaleString("en-US")}${suffix}`);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.6, ease: EASE });
    return () => c.stop();
  }, [value, mv, reduce]);
  return <motion.span className="num">{text}</motion.span>;
}

/** Completion dial. `tone="ink"` is for use on the navy glass pane. */
export function Ring({
  pct,
  size = 112,
  stroke = 9,
  label,
  tone = "light",
}: {
  pct: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  tone?: "light" | "ink";
}) {
  const r = 50 - stroke / 2 - 1;
  const C = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(p * 100)}%`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={tone === "ink" ? "rgba(255,255,255,.22)" : "rgba(15,27,61,.1)"} strokeWidth={stroke} />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={tone === "ink" ? "#7fd4f7" : "var(--sky)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - p) }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center" aria-hidden>
        {label ?? (
          <span className="font-bold" style={{ fontSize: size * 0.24 }}>
            <Counter value={Math.round(p * 100)} suffix="%" />
          </span>
        )}
      </div>
    </div>
  );
}

/** Round progress as a row of marks, one per container: filled when inspected, amber when it has an open note. */
export function Scale({ marks, label }: { marks: ("on" | "issue" | "off")[]; label: string }) {
  return (
    <div className="scale" role="img" aria-label={label}>
      {marks.map((m, i) => (
        <i key={i} className={m === "off" ? undefined : m} />
      ))}
    </div>
  );
}

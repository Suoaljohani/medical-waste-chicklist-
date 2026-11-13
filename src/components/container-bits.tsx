import { Check, CheckCheck, Circle, PencilLine, TriangleAlert } from "lucide-react";
import { KIND } from "@/lib/containers";
import type { ContainerKind } from "@/lib/types";
import { cx } from "@/lib/utils";
import { FloorBin, SharpsBox } from "./icon";

/** Coloured tile with the container's glyph. Shape tells the two kinds apart; colour only supports it. */
export function KindTile({ kind, size = 48 }: { kind: ContainerKind; size?: number }) {
  const G = kind === "floor" ? FloorBin : SharpsBox;
  return (
    <span
      className="grid shrink-0 place-items-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: kind === "floor" ? "linear-gradient(150deg,#0a8f9c,#057590)" : "linear-gradient(150deg,#3a4fa6,#283a83)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
      }}
      title={KIND[kind].ar}
    >
      <G className="h-[56%] w-[56%]" strokeWidth={1.7} />
    </span>
  );
}

export function CodeBadge({ code, className }: { code: string; className?: string }) {
  return (
    <span translate="no" className={cx("code rounded-lg bg-ink/[0.07] px-2 py-0.5 text-[12.5px] text-ink-2", className)}>
      {code}
    </span>
  );
}

export type RoundState = { count: number; nonCompliant: number; open: number; last_at: string; by: string } | undefined;

/**
 * Where a container stands today. Three separate facts, never merged: was it inspected, did every item
 * comply, and is a recorded note still waiting for follow-up.
 */
export function RoundChip({ state, draft }: { state: RoundState; draft?: boolean }) {
  if (!state)
    return draft ? (
      <span className="chip chip-info">
        <PencilLine className="h-3.5 w-3.5" aria-hidden /> مسودة لم تُحفظ
      </span>
    ) : (
      <span className="chip">
        <Circle className="h-3 w-3" aria-hidden /> لم تُفحص بعد
      </span>
    );
  if (state.nonCompliant === 0)
    return (
      <span className="chip chip-ok">
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden /> فُحصت · مطابقة
      </span>
    );
  if (state.open > 0)
    return (
      <span className="chip chip-warn">
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> فُحصت · ملاحظة مفتوحة
      </span>
    );
  return (
    <span className="chip chip-info">
      <CheckCheck className="h-3.5 w-3.5" aria-hidden /> فُحصت · الملاحظة عولجت
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="chip chip-warn" title="هذه بيانات توضيحية للمعاينة وليست بيانات المستشفى">
      بيانات توضيحية للمعاينة
    </span>
  );
}

import { Check, CheckCheck, Circle, PencilLine, TriangleAlert } from "lucide-react";
import { KIND } from "@/lib/containers";
import type { ContainerKind } from "@/lib/types";
import { cx } from "@/lib/utils";
import { FloorBin, SharpsBox } from "./icon";

/**
 * Container type mark: the glyph shape tells floor and sharps apart; a thin biohazard-yellow lip echoes the
 * real containers in the photograph. Colour never carries the meaning alone; the type is always written beside it.
 */
export function KindTile({ kind, size = 48 }: { kind: ContainerKind; size?: number }) {
  const G = kind === "floor" ? FloorBin : SharpsBox;
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden border border-[var(--control-border)] bg-[var(--glass-inset)] text-ink"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
      aria-hidden
    >
      <span className="absolute inset-x-0 top-0 h-[3px] bg-[#e3c14f]" />
      <G className="h-[60%] w-[60%]" strokeWidth={1.75} />
    </span>
  );
}

export function CodeBadge({ code, className }: { code: string; className?: string }) {
  return (
    <bdi translate="no" className={cx("code rounded-[8px] border border-[var(--divider)] bg-[var(--glass-inset)] px-2 py-0.5 text-[14px] text-ink", className)}>
      {code}
    </bdi>
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
        <PencilLine className="h-3.5 w-3.5" aria-hidden /> مسودة
      </span>
    ) : (
      <span className="chip">
        <Circle className="h-3 w-3" aria-hidden /> لم يبدأ
      </span>
    );
  if (state.nonCompliant === 0)
    return (
      <span className="chip chip-ok">
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden /> مطابق
      </span>
    );
  if (state.open > 0)
    return (
      <span className="chip chip-warn">
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> ملاحظة مفتوحة
      </span>
    );
  return (
    <span className="chip chip-info">
      <CheckCheck className="h-3.5 w-3.5" aria-hidden /> عولجت الملاحظة
    </span>
  );
}

export function KindLabel({ kind }: { kind: ContainerKind }) {
  return <>{KIND[kind].short === "أدوات حادة" ? "أدوات حادة" : "أرضية"}</>;
}

export function DemoBadge() {
  return (
    <span className="chip chip-warn" title="هذه بيانات توضيحية للمعاينة وليست بيانات المستشفى">
      بيانات توضيحية
    </span>
  );
}

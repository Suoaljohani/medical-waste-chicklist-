import { connection } from "next/server";
import { isContainer } from "@/lib/containers";
import { observationsOf } from "@/lib/observations";
import { store } from "@/lib/store";
import { zoned } from "@/lib/utils";

export async function GET() {
  await connection();
  const s = store();
  const [deps, checklists, recent, settings, quarter] = await Promise.all([
    s.list("departments"),
    s.list("checklists"),
    s.submissions({ from: new Date(Date.now() - 36 * 3600e3).toISOString() }),
    s.getSettings(),
    s.submissions({ from: new Date(Date.now() - 90 * 86400e3).toISOString(), limit: 20000 }),
  ]);
  const today = zoned(new Date()).dayKey;
  const doneIds = new Set(recent.filter((r) => zoned(r.submitted_at).dayKey === today).map((r) => r.checklist_id));
  const visible = deps.filter((d) => d.active);
  const activeLists = checklists.filter((c) => c.active && visible.some((d) => d.id === c.department_id));
  const count = (rows: typeof activeLists) => ({ total: rows.length, done: rows.filter((c) => doneIds.has(c.id)).length });
  return Response.json({
    demo: !!settings.demo,
    departments: visible.map((d) => {
      const mine = activeLists.filter((c) => c.department_id === d.id);
      return { ...d, containers: count(mine.filter(isContainer)), lists: count(mine.filter((c) => !isContainer(c))) };
    }),
    today: count(activeLists.filter(isContainer)),
    // Notes recorded in the last 90 days that are not closed yet. A count only; details stay behind admin sign-in.
    open_notes: (() => {
      const byId = new Map(checklists.map((c) => [c.id, c]));
      return quarter.flatMap((x) => observationsOf(x, byId.get(x.checklist_id))).filter((o) => o.status !== "closed").length;
    })(),
  });
}

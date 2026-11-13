import { connection } from "next/server";
import { isContainer } from "@/lib/containers";
import { store } from "@/lib/store";
import { zoned } from "@/lib/utils";

export async function GET() {
  await connection();
  const s = store();
  const [deps, checklists, recent, settings] = await Promise.all([
    s.list("departments"),
    s.list("checklists"),
    s.submissions({ from: new Date(Date.now() - 36 * 3600e3).toISOString() }),
    s.getSettings(),
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
  });
}

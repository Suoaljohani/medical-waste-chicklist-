import { connection, type NextRequest } from "next/server";
import { toClient } from "@/lib/entities";
import { summarize } from "@/lib/observations";
import { store } from "@/lib/store";
import { zoned } from "@/lib/utils";

export type TodayState = { count: number; nonCompliant: number; open: number; last_at: string; by: string };

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/public/departments/[slug]">) {
  await connection();
  const { slug } = await ctx.params;
  const s = store();
  const department = (await s.list("departments")).find((d) => d.slug === slug && d.active);
  if (!department) return Response.json({ error: "Not found" }, { status: 404 });
  const checklists = (await s.list("checklists")).filter((c) => c.department_id === department.id && c.active);
  const byId = new Map(checklists.map((c) => [c.id, c]));
  const today = zoned(new Date()).dayKey;
  const recent = await s.submissions({ department_id: department.id, from: new Date(Date.now() - 36 * 3600e3).toISOString() });
  const doneToday: Record<string, number> = {};
  // Latest inspection of each container/checklist today: is it compliant, and is anything still open?
  const state: Record<string, TodayState> = {};
  for (const r of recent) {
    if (zoned(r.submitted_at).dayKey !== today) continue;
    doneToday[r.checklist_id] = (doneToday[r.checklist_id] ?? 0) + 1;
    if (state[r.checklist_id]) {
      state[r.checklist_id].count++;
      continue; // rows come newest first; keep the latest
    }
    state[r.checklist_id] = { count: 1, ...summarize(r, byId.get(r.checklist_id)), last_at: r.submitted_at, by: r.employee_name };
  }
  return Response.json({ department, checklists: checklists.map(toClient), doneToday, state });
}

import { connection, type NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { observationsOf } from "@/lib/observations";
import { store } from "@/lib/store";

/** Every non-compliant item recorded in the last N days (default 90), newest first. */
export async function GET(req: NextRequest) {
  await connection();
  if (!(await isAdmin())) return unauthorized();
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 90));
  const s = store();
  const [deps, checklists, subs] = await Promise.all([
    s.list("departments"),
    s.list("checklists"),
    s.submissions({ from: new Date(Date.now() - days * 86400e3).toISOString(), limit: 20000 }),
  ]);
  const byId = new Map(checklists.map((c) => [c.id, c]));
  const depById = new Map(deps.map((d) => [d.id, d]));
  return Response.json({
    days,
    departments: deps.map((d) => ({ id: d.id, name: d.name_ar || d.name_en })),
    observations: subs.flatMap((x) => observationsOf(x, byId.get(x.checklist_id), depById.get(x.department_id))),
  });
}

import { connection, type NextRequest } from "next/server";
import { store } from "@/lib/store";

/**
 * Short, permanent link printed in checklist QR codes: /c/<checklist id>.
 * Looks up the department at scan time, so QR codes keep working if a department link changes.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/c/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const s = store();
  const checklist = await s.get("checklists", id);
  const department = checklist ? await s.get("departments", checklist.department_id) : null;
  // Scanning a printed code is proof of being in the department, so it lands on the round with qr=1.
  const to =
    checklist?.active && department?.active
      ? `/d/${department.slug}?qr=1&next=${encodeURIComponent(checklist.id)}`
      : department?.active
        ? `/d/${department.slug}?qr=1`
        : "/";
  return Response.redirect(new URL(to, req.url), 307);
}

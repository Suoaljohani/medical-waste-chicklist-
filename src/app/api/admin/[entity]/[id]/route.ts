import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { store } from "@/lib/store";
import { sanitize, isEntity, toClient } from "@/lib/entities";
import { isFlagged } from "@/lib/utils";
import type { Submission } from "@/lib/types";

/** One record in full (with signature and photos), plus the checklist it belongs to. Submissions only. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/admin/[entity]/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { entity, id } = await ctx.params;
  if (entity !== "submissions") return Response.json({ error: "Not found" }, { status: 404 });
  const submission = await store().get("submissions", id);
  if (!submission) return Response.json({ error: "Not found" }, { status: 404 });
  const checklist = await store().get("checklists", submission.checklist_id);
  const department = await store().get("departments", submission.department_id);
  return Response.json({ submission, checklist: checklist ? toClient(checklist) : null, department });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/[entity]/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { entity, id } = await ctx.params;
  if (!isEntity(entity)) return Response.json({ error: "Not found" }, { status: 404 });
  const existing = await store().get(entity, id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  const result = sanitize(entity, await req.json(), existing);
  if ("error" in result) return Response.json(result, { status: 400 });
  const patch = result.row as Record<string, unknown>;
  if (entity === "departments") {
    const clash = (await store().list("departments")).some((d) => d.id !== id && d.slug === patch.slug);
    if (clash) return Response.json({ error: "رمز الرابط مستخدم لقسم آخر" }, { status: 400 });
  }
  if (entity === "employees") {
    const clash = (await store().list("employees")).some((e) => e.id !== id && e.employee_no === patch.employee_no);
    if (clash) return Response.json({ error: "الرقم الوظيفي مستخدم لموظف آخر" }, { status: 400 });
  }
  if (entity === "submissions") {
    const sub = { ...(existing as Submission), ...patch } as Submission;
    const checklist = await store().get("checklists", sub.checklist_id);
    if (checklist) patch.flagged = isFlagged(checklist, sub.values);
  }
  delete patch.id;
  return Response.json(toClient(await store().update(entity, id, patch as never)));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/admin/[entity]/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { entity, id } = await ctx.params;
  if (!isEntity(entity)) return Response.json({ error: "Not found" }, { status: 404 });
  await store().remove(entity, id);
  return Response.json({ ok: true });
}

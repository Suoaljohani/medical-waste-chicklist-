import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { containerInput } from "@/lib/container-admin";
import { isContainer } from "@/lib/containers";
import { toClient } from "@/lib/entities";
import { store } from "@/lib/store";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/containers/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const existing = await store().get("checklists", id);
  if (!existing || !isContainer(existing)) return Response.json({ error: "الحاوية غير موجودة" }, { status: 404 });
  const result = await containerInput(await req.json(), existing);
  if ("error" in result) return Response.json(result, { status: 400 });
  const patch = { ...result.row };
  delete patch.id;
  return Response.json(toClient(await store().update("checklists", id, patch)));
}

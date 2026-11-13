import { isAdmin, unauthorized } from "@/lib/auth";
import { containerInput } from "@/lib/container-admin";
import { toClient } from "@/lib/entities";
import { store } from "@/lib/store";
import type { Checklist } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const result = await containerInput(await req.json(), null);
  if ("error" in result) return Response.json(result, { status: 400 });
  return Response.json(toClient(await store().insert("checklists", result.row as Checklist)));
}

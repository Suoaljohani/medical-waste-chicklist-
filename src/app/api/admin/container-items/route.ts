import { connection } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { applyItems, cleanItems } from "@/lib/container-admin";
import { itemsFor } from "@/lib/containers";
import { store } from "@/lib/store";

export async function GET() {
  await connection();
  if (!(await isAdmin())) return unauthorized();
  const settings = await store().getSettings();
  return Response.json({ floor: itemsFor("floor", settings), sharps: itemsFor("sharps", settings), custom: !!settings.container_items });
}

/** Save the items of one kind and apply them to every container of that kind. */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = (await req.json()) as { kind?: string; items?: unknown };
  if (body.kind !== "floor" && body.kind !== "sharps") return Response.json({ error: "نوع الحاوية غير معروف" }, { status: 400 });
  const items = cleanItems(body.items);
  if (typeof items === "string") return Response.json({ error: items }, { status: 400 });
  const s = store();
  const cur = await s.getSettings();
  const container_items = { floor: itemsFor("floor", cur), sharps: itemsFor("sharps", cur), [body.kind]: items };
  await s.putSettings({ ...cur, container_items });
  const applied = await applyItems(body.kind, items);
  return Response.json({ ok: true, applied });
}

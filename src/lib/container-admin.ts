import "server-only";
import { containerOf, containerRow, itemsFor, type ContainerInfo } from "./containers";
import { store } from "./store";
import type { Checklist, ContainerKind, Field } from "./types";
import { uid } from "./utils";

type In = Record<string, unknown>;
const str = (v: unknown, max: number) => (v === undefined || v === null ? "" : String(v).trim().slice(0, max));

/** Validate a container form and return the checklist row that stores it. */
export async function containerInput(b: In, existing: Checklist | null): Promise<{ row: Partial<Checklist> } | { error: string }> {
  const s = store();
  const prev = containerOf(existing);
  const kind: ContainerKind = b.kind === "sharps" || b.kind === "floor" ? b.kind : (prev?.kind ?? "floor");
  const code = str(b.code ?? prev?.code, 30).replace(/\s+/g, "-").toUpperCase();
  const location = str(b.location ?? prev?.location, 100);
  const department_id = str(b.department_id ?? existing?.department_id, 80);
  if (!department_id || !(await s.get("departments", department_id))) return { error: "اختر القسم" };
  if (!code) return { error: "رقم الحاوية مطلوب" };
  if (!location) return { error: "موقع الحاوية مطلوب" };
  const all = await s.list("checklists");
  if (all.some((c) => c.id !== existing?.id && containerOf(c)?.code === code)) return { error: `الرقم ${code} مستخدم لحاوية أخرى` };
  const info: ContainerInfo = { kind, code, location };
  // Keep this container's items when only its details change; a new container takes the current template.
  const items = existing && prev?.kind === kind ? existing.fields.filter((f) => f.type !== "container") : itemsFor(kind, await s.getSettings());
  return {
    row: {
      id: existing?.id ?? uid("ctn"),
      department_id,
      ...containerRow(info, items),
      range_note: existing?.range_note ?? "",
      footer_note: existing?.footer_note ?? "",
      lock_hash: existing?.lock_hash ?? "",
      sort: b.sort === undefined || Number.isNaN(Number(b.sort)) ? (existing?.sort ?? all.filter((c) => c.department_id === department_id).length + 1) : Number(b.sort),
      active: b.active === undefined ? (existing?.active ?? true) : Boolean(b.active),
      created_at: existing?.created_at ?? new Date().toISOString(),
    },
  };
}

/** Clean a list of inspection items coming from the admin editor. */
export function cleanItems(v: unknown): Field[] | string {
  if (!Array.isArray(v) || !v.length) return "أضف بندًا واحدًا على الأقل";
  const seen = new Set<string>();
  const out: Field[] = [];
  for (const raw of v.slice(0, 40) as In[]) {
    const label_ar = str(raw.label_ar, 100);
    if (!label_ar) return "كل بند يحتاج إلى نص عربي";
    let key = str(raw.key, 40).replace(/[^a-z0-9_]/gi, "") || `i_${uid().slice(0, 8)}`;
    while (seen.has(key)) key += "_2";
    seen.add(key);
    out.push({ key, label_ar, label_en: str(raw.label_en, 100) || label_ar, type: "check", required: true });
  }
  return out;
}

/** Write a kind's items onto every container of that kind. */
export async function applyItems(kind: ContainerKind, items: Field[]) {
  const s = store();
  const rows = (await s.list("checklists")).filter((c) => containerOf(c)?.kind === kind);
  for (const c of rows) {
    const info = containerOf(c)!;
    await s.update("checklists", c.id, { fields: containerRow(info, items).fields });
  }
  return rows.length;
}

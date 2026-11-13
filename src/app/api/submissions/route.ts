import { accountsRequired, currentEmployee, isLocked, readUnlockToken } from "@/lib/auth";
import { containerOf } from "@/lib/containers";
import { obsKey } from "@/lib/observations";
import { store } from "@/lib/store";
import type { FieldValue, Submission } from "@/lib/types";
import { isFlagged, uid } from "@/lib/utils";

const MAX_SIGNATURE = 400_000;
const MAX_PHOTO = 900_000;
const isJpeg = (s: string) => s.startsWith("data:image/jpeg;base64,") && s.length <= MAX_PHOTO;

export async function POST(req: Request) {
  let body: {
    checklist_id?: string;
    employee_name?: string;
    employee_no?: string;
    values?: Record<string, FieldValue>;
    signature?: string;
    photos?: Record<string, string>;
    note?: string;
    unlock?: string;
    /** How the employee reached the department: scanned its QR code, or picked it from the list. */
    entry?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const s = store();
  const checklist = body.checklist_id ? await s.get("checklists", body.checklist_id) : null;
  if (!checklist || !checklist.active) return Response.json({ error: "هذا البند غير متاح" }, { status: 404 });
  const container = containerOf(checklist);

  // Locked checklists: the record belongs to the employee who entered their password to open it.
  let unlockedBy: string | null = null;
  if (isLocked(checklist)) {
    unlockedBy = readUnlockToken(checklist.id, body.unlock);
    if (!unlockedBy) return Response.json({ error: "القائمة مقفلة. أدخل كلمة مرورك مرة أخرى.", locked: true }, { status: 403 });
  }

  // With staff accounts, the name comes from the account, not the form.
  let name = (body.employee_name ?? "").trim().slice(0, 80);
  let employeeNo = (body.employee_no ?? "").trim().slice(0, 30);
  if (unlockedBy || (await accountsRequired())) {
    const signedIn = await currentEmployee();
    const e = unlockedBy ? (signedIn?.id === unlockedBy ? signedIn : null) : signedIn;
    if (!e) return Response.json({ error: "سجّل الدخول مرة أخرى", signin: true }, { status: 401 });
    name = e.name;
    employeeNo = e.employee_no;
  }
  if (!name) return Response.json({ error: "أدخل اسمك" }, { status: 400 });
  const sig = body.signature ?? "";
  if (!sig.startsWith("data:image/png;base64,") || sig.length > MAX_SIGNATURE)
    return Response.json({ error: "التوقيع مطلوب" }, { status: 400 });

  const values: Record<string, FieldValue> = {};
  const photos: Record<string, string> = {};
  for (const f of checklist.fields) {
    if (f.type === "heading" || f.type === "container") continue;
    const label = f.label_ar || f.label_en;
    let v = body.values?.[f.key] ?? null;
    if (f.type === "number" && v !== null && v !== "") {
      const n = Number(v);
      if (Number.isNaN(n)) return Response.json({ error: `«${label}» يجب أن يكون رقمًا` }, { status: 400 });
      v = n;
    } else if (f.type === "yesno" || f.type === "check") {
      v = v === null ? null : Boolean(v);
    } else if (v !== null) {
      v = String(v).slice(0, 500);
    }
    if (f.required && (v === null || v === "")) return Response.json({ error: `«${label}» مطلوب` }, { status: 400 });
    values[f.key] = v;
    const ph = body.photos?.[f.key] ?? "";
    if (f.photo && v === true) {
      if (!isJpeg(ph)) return Response.json({ error: `التقط صورة لـ «${label}»` }, { status: 400 });
      photos[f.key] = ph;
    }
    // A non-compliant item carries what the employee saw, what they did, and an optional photo.
    if ((f.type === "check" || f.type === "yesno") && v === false) {
      const note = String(body.values?.[obsKey(f.key, "note")] ?? "").trim().slice(0, 500);
      const action = String(body.values?.[obsKey(f.key, "action")] ?? "").trim().slice(0, 300);
      if (container && note.length < 3) return Response.json({ error: `اكتب الملاحظة على «${label}»` }, { status: 400 });
      if (note) values[obsKey(f.key, "note")] = note;
      if (action) values[obsKey(f.key, "action")] = action;
      if (ph && isJpeg(ph)) photos[f.key] = ph;
    }
  }
  if (body.entry === "qr" || body.entry === "manual") values.__entry = body.entry;

  const row: Submission = {
    id: uid(),
    checklist_id: checklist.id,
    department_id: checklist.department_id,
    employee_name: name,
    employee_no: employeeNo,
    submitted_at: new Date().toISOString(),
    values,
    signature: sig,
    ...(Object.keys(photos).length ? { photos } : {}),
    flagged: isFlagged(checklist, values),
    note: (body.note ?? "").trim().slice(0, 500),
  };
  await s.insert("submissions", row);
  return Response.json({ ok: true, id: row.id, submitted_at: row.submitted_at, flagged: row.flagged });
}

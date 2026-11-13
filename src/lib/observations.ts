import { containerOf } from "./containers";
import type { Checklist, Department, Field, FieldValue, Observation, ObservationStatus, Submission } from "./types";
import { isOutOfRange } from "./utils";

/**
 * A non-compliant item keeps its documentation and follow-up next to its answer, inside the submission's values:
 *   <key>          false (✗), or an out-of-range number
 *   <key>__note    what the employee saw
 *   <key>__action  what the employee did on the spot
 *   <key>__st      follow-up state set by the admin: open (default) → progress → closed
 *   <key>__fu      the admin's follow-up note
 *   <key>__at      when the follow-up state last changed
 */
export const obsKey = (key: string, part: "note" | "action" | "st" | "fu" | "at") => `${key}__${part}`;

export const OBS_STATUS: Record<ObservationStatus, { ar: string }> = {
  open: { ar: "مفتوحة" },
  progress: { ar: "قيد المعالجة" },
  closed: { ar: "مغلقة" },
};

export function isNonCompliant(f: Field, v: FieldValue | undefined) {
  if (f.type === "check" || f.type === "yesno") return v === false;
  return isOutOfRange(f, v ?? null);
}

export function statusOf(values: Record<string, FieldValue>, key: string): ObservationStatus {
  const s = values[obsKey(key, "st")];
  return s === "progress" || s === "closed" ? s : "open";
}

const text = (v: FieldValue | undefined) => (typeof v === "string" ? v : "");

/** Every non-compliant item of a submission, with its follow-up state. */
export function observationsOf(sub: Submission, checklist: Checklist | undefined, department?: Department): Observation[] {
  if (!checklist) return [];
  const container = containerOf(checklist);
  const out: Observation[] = [];
  for (const f of checklist.fields) {
    if (!isNonCompliant(f, sub.values[f.key])) continue;
    const at = text(sub.values[obsKey(f.key, "at")]);
    out.push({
      id: `${sub.id}:${f.key}`,
      submission_id: sub.id,
      key: f.key,
      label_ar: f.label_ar || f.label_en,
      label_en: f.label_en,
      note: text(sub.values[obsKey(f.key, "note")]) || (f.type === "number" ? `القراءة ${sub.values[f.key]}${f.unit ?? ""} خارج المدى` : ""),
      action: text(sub.values[obsKey(f.key, "action")]),
      status: statusOf(sub.values, f.key),
      followup: text(sub.values[obsKey(f.key, "fu")]),
      updated_at: at || null,
      has_photo: !!sub.photos?.[f.key],
      checklist_id: checklist.id,
      checklist_title: checklist.title_ar || checklist.title_en,
      container,
      department_id: sub.department_id,
      department: department?.name_ar || department?.name_en || "",
      employee_name: sub.employee_name,
      submitted_at: sub.submitted_at,
    });
  }
  return out;
}

/** Counts used wherever a submission is summarised. Completion, compliance and follow-up stay separate. */
export function summarize(sub: Pick<Submission, "values">, checklist: Checklist | undefined) {
  let nonCompliant = 0;
  let open = 0;
  if (checklist)
    for (const f of checklist.fields) {
      if (!isNonCompliant(f, sub.values[f.key])) continue;
      nonCompliant++;
      if (statusOf(sub.values, f.key) !== "closed") open++;
    }
  return { nonCompliant, open };
}

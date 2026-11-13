import { containerRow, DEFAULT_ITEMS } from "./containers";
import { obsKey } from "./observations";
import { defaultSettings, seedChecklists } from "./seed";
import type { FileDb } from "./store";
import type { Checklist, ContainerKind, Department, FieldValue, Submission } from "./types";
import { zoned } from "./utils";

/*
 * Preview data only (DEMO_DATA=1 with the local file store). Departments, containers, names and
 * inspections here are made up so the screens can be reviewed; none of it is hospital data and it is
 * never written to the production database.
 */

const DAY = 86400e3;
// A drawn squiggle standing in for a signature in the preview data.
const SIG = "data:image/png;base64,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";

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

/*
 * Matches the worked example in the design specification: Emergency 14 of 16, Laboratory 9 of 12, Clinics 13 of 20
 * inspected today (36 of 48, 75%), with 1, 0 and 2 open notes. `skip` lists the containers not inspected yet today,
 * `issues` the ones inspected today with a non-compliant item.
 */
const DEPS: { id: string; slug: string; ar: string; en: string; icon: string; prefix: string; floor: string[]; sharps: string[]; skip: string[]; issues: string[] }[] = [
  {
    id: "demo-er", slug: "er", ar: "الطوارئ", en: "Emergency", icon: "Siren", prefix: "ER",
    floor: ["غرفة الفرز", "غرفة الإنعاش", "ممر الملاحظة", "غرفة الضماد", "محطة التمريض", "غرفة العزل", "غرفة الإجراءات", "مستودع المستهلكات", "ممر الإسعاف"],
    sharps: ["غرفة الفرز · الجدار الأيمن", "غرفة الإنعاش · السرير 1", "بجانب غرفة الإجراءات", "غرفة الضماد", "غرفة العزل", "عربة الأدوية", "غرفة الإنعاش · السرير 2"],
    skip: ["ER-SH-03", "ER-SH-06"],
    issues: ["ER-FL-04"],
  },
  {
    id: "demo-lab", slug: "lab", ar: "المختبر", en: "Laboratory", icon: "FlaskConical", prefix: "LB",
    floor: ["استلام العينات", "قسم الكيمياء", "قسم الأحياء الدقيقة", "بنك الدم", "قسم الدم", "غرفة التعقيم"],
    sharps: ["سحب العينات · الكرسي 1", "سحب العينات · الكرسي 2", "قسم الدم", "بنك الدم", "قسم الكيمياء", "غرفة التعقيم"],
    skip: ["LB-FL-05", "LB-SH-04", "LB-SH-06"],
    issues: [],
  },
  {
    id: "demo-opd", slug: "opd", ar: "العيادات", en: "Outpatient clinics", icon: "Stethoscope", prefix: "OP",
    floor: ["عيادة 1", "عيادة 2", "عيادة 3", "عيادة 4", "عيادة الأسنان", "غرفة الحقن", "غرفة الضماد", "الاستقبال", "عيادة الأطفال", "عيادة النساء", "ممر العيادات"],
    sharps: ["غرفة الحقن", "عيادة الأسنان", "غرفة سحب العينات", "غرفة الضماد", "عيادة الأطفال", "عيادة النساء", "عيادة 1", "عيادة 2", "عيادة 3"],
    skip: ["OP-FL-08", "OP-FL-10", "OP-FL-11", "OP-SH-06", "OP-SH-07", "OP-SH-08", "OP-SH-09"],
    issues: ["OP-FL-02", "OP-SH-03"],
  },
];

const STAFF = ["سارة العنزي", "محمد الشمري", "نورة الرويلي", "خالد الجهني"];

const NOTES: Record<string, { note: string; action: string }[]> = {
  fill_level: [{ note: "الحاوية ممتلئة وتحتاج تفريغًا", action: "تم إبلاغ عامل النظافة" }],
  lid_pedal: [{ note: "الدواسة لا ترفع الغطاء", action: "طُلب استبدال الحاوية" }],
  clean_no_leak: [{ note: "آثار تسرب أسفل الحاوية", action: "تم التنظيف والتطهير" }],
  no_sharps: [{ note: "وُجدت إبرة داخل الكيس", action: "نُقلت بملقط إلى حاوية الأدوات الحادة" }],
  label: [{ note: "الملصق غير واضح", action: "" }],
  bag_colour: [{ note: "كيس أسود في حاوية نفايات معدية", action: "تم استبدال الكيس" }],
  secured: [{ note: "الحاوية غير مثبتة على الحامل", action: "" }],
  fill_line: [{ note: "المحتوى تجاوز خط التعبئة", action: "أُغلقت الحاوية وطُلب بديل" }],
  lid_closed: [{ note: "الغطاء المؤقت مفتوح", action: "تم إغلاقه" }],
  start_date: [{ note: "لا يوجد تاريخ بدء على الحاوية", action: "تم تدوين التاريخ" }],
  intact: [{ note: "تشقق في جسم الحاوية", action: "طُلب استبدالها" }],
};

export function demoDb(): FileDb {
  const now = new Date();
  const created = new Date(now.getTime() - 40 * DAY).toISOString();
  const rand = rng(20261112);

  const departments: Department[] = DEPS.map((d, i) => ({ id: d.id, slug: d.slug, name_ar: d.ar, name_en: d.en, icon: d.icon, sort: i + 1, active: true, created_at: created }));

  const containers: (Checklist & { skip: boolean; issue: boolean })[] = [];
  for (const d of DEPS) {
    const add = (kind: ContainerKind, locs: string[]) =>
      locs.forEach((location, i) => {
        const code = `${d.prefix}-${kind === "floor" ? "FL" : "SH"}-${String(i + 1).padStart(2, "0")}`;
        containers.push({
          id: `demo-${code.toLowerCase()}`,
          department_id: d.id,
          ...containerRow({ kind, code, location }, DEFAULT_ITEMS[kind]),
          range_note: "",
          footer_note: "",
          lock_hash: "",
          sort: containers.length + 1,
          active: true,
          created_at: created,
          skip: d.skip.includes(code),
          issue: d.issues.includes(code),
        });
      });
    add("floor", d.floor);
    add("sharps", d.sharps);
  }

  const submissions: Submission[] = [];
  let n = 0;
  for (let back = 13; back >= 0; back--) {
    const isToday = back === 0;
    // Today's round starts at 07:30 hospital time, or two hours ago if the preview is opened earlier than that.
    const day = zoned(new Date(now.getTime() - back * DAY)).dayKey;
    const start = new Date(`${day}T04:30:00.000Z`).getTime();
    const dayStart = isToday ? Math.min(start, now.getTime() - 2 * 3600e3) : start;
    const span = isToday ? Math.max(20 * 60e3, now.getTime() - dayStart - 5 * 60e3) : 6 * 3600e3;
    for (const c of containers) {
      if (isToday ? c.skip : rand() > 0.94) continue;
      const peers = containers.filter((x) => x.department_id === c.department_id);
      const order = peers.indexOf(c);
      const at = new Date(dayStart + (isToday ? (order / peers.length) * span : rand() * span));
      if (at.getTime() > now.getTime()) continue;
      const values: Record<string, FieldValue> = { __entry: rand() < 0.85 ? "qr" : "manual" };
      const items = c.fields.filter((f) => f.type === "check");
      for (const f of items) values[f.key] = true;
      // Today: exactly the listed containers have an open note. Earlier days: a few notes, all handled and closed.
      if (isToday ? c.issue : rand() < 0.07) {
        const f = items[(order + back) % items.length];
        const doc = NOTES[f.key]?.[0] ?? { note: "ملاحظة توضيحية", action: "" };
        values[f.key] = false;
        values[obsKey(f.key, "note")] = doc.note;
        if (doc.action) values[obsKey(f.key, "action")] = doc.action;
        if (!isToday) {
          values[obsKey(f.key, "st")] = "closed";
          values[obsKey(f.key, "fu")] = "تمت المعالجة والتحقق";
          values[obsKey(f.key, "at")] = new Date(at.getTime() + 5 * 3600e3).toISOString();
        }
      }
      submissions.push({
        id: `demo-s${++n}`,
        checklist_id: c.id,
        department_id: c.department_id,
        employee_name: STAFF[(DEPS.findIndex((d) => d.id === c.department_id) + (back % 2)) % STAFF.length],
        employee_no: "",
        submitted_at: at.toISOString(),
        values,
        signature: SIG,
        flagged: items.some((f) => values[f.key] === false),
        note: "",
      });
    }
  }

  // Ordinary checklists from the project seed, attached to the first preview department.
  const lists = seedChecklists.slice(0, 2).map((c) => ({ ...c, department_id: DEPS[0].id }));

  return {
    departments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- drop the helper fields
    checklists: [...containers.map(({ skip, issue, ...c }) => c), ...lists],
    submissions,
    employees: [],
    settings: { ...defaultSettings, demo: true, demo_day: zoned(now).dayKey },
  };
}

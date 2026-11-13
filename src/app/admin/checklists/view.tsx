"use client";

import { useState } from "react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileText, LoaderCircle, Lock, LockOpen, Pencil, Plus, Printer, QrCode, Trash2, X } from "lucide-react";
import { Icon, ICONS } from "@/components/icon";
import { Modal } from "@/components/modal";
import { EASE } from "@/components/motion";
import type { Checklist, Department, Field } from "@/lib/types";
import { TEMPLATES, type Template } from "@/lib/templates";
import { cx, rangeLabel } from "@/lib/utils";
import { useToast } from "../admin-shell";
import { QrDialog, type QrKind } from "./qr-card";
import { api, PageTitle, useData } from "../use-data";
import { containerOf } from "@/lib/containers";

const COLORS = ["#1691D0", "#2BAAE2", "#3AC0C3", "#04A67A", "#9ECC3B", "#283A83", "#7A5AF8", "#E9A23B", "#E0475B", "#51938B"];

type Draft = Omit<Checklist, "id" | "created_at"> & { id?: string };

const blankField = (): Field & { _k: string } => ({
  _k: Math.random().toString(36).slice(2),
  key: "",
  label_en: "",
  label_ar: "",
  type: "number",
  unit: "°C",
  min: null,
  max: null,
  required: true,
});

export function ChecklistsPage() {
  const toast = useToast();
  // Containers are managed on their own page; this page keeps the other checklists.
  const { data: all, reload, setData } = useData<Checklist[]>("/api/admin/checklists");
  const data = all?.filter((c) => !containerOf(c)) ?? null;
  const { data: deps } = useData<Department[]>("/api/admin/departments");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [qr, setQr] = useState<{ c: Checklist; kind: QrKind } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheet, setSheet] = useState<{ kind: QrKind; done: number; total: number } | null>(null);

  async function makeSheet(kind: QrKind) {
    if (!data || !deps || sheet) return;
    setSheet({ kind, done: 0, total: 0 });
    try {
      const { downloadQrSheet } = await import("./qr-sheet");
      const n = await downloadQrSheet(data, deps, kind, (done, total) => setSheet({ kind, done, total }));
      toast(n ? `نُزّل ملف PDF فيه ${n} باركود` : "لا توجد قوائم ظاهرة", n ? "ok" : "error");
    } catch (e) {
      console.error(e);
      toast("تعذّر إنشاء ملف PDF", "error");
    } finally {
      setSheet(null);
    }
  }

  function create() {
    setDraft({
      department_id: deps?.[0]?.id ?? "",
      title_en: "",
      title_ar: "",
      icon: "ClipboardCheck",
      color: COLORS[0],
      fields: [blankField()],
      range_note: "",
      footer_note: "Infection Prevention and Control Department",
      orientation: "portrait",
      sort: (data?.length ?? 0) + 1,
      active: true,
    });
  }

  async function toggle(c: Checklist) {
    setData((d) => d?.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)) ?? null);
    try {
      await api(`/api/admin/checklists/${c.id}`, "PATCH", { active: !c.active });
      toast(c.active ? "أُخفيت عن الموظفين" : "أصبحت ظاهرة للموظفين");
    } catch (e) {
      toast((e as Error).message, "error");
      reload();
    }
  }

  async function toggleLock(c: Checklist) {
    const locked = !c.locked;
    if (
      !confirm(
        locked
          ? `قفل «${c.title_ar || c.title_en}»؟\nسيُطلب من الموظف كلمة مرور حسابه كل مرة يفتحها.`
          : `فتح قفل «${c.title_ar || c.title_en}»؟\nسيفتحها الموظف دون كلمة مرور.`,
      )
    )
      return;
    setData((d) => d?.map((x) => (x.id === c.id ? { ...x, locked } : x)) ?? null);
    try {
      await api(`/api/admin/checklists/${c.id}`, "PATCH", { locked });
      toast(locked ? "قُفلت، تُطلب كلمة مرور الموظف" : "فُتح القفل");
    } catch (e) {
      toast((e as Error).message, "error");
      reload();
    }
  }

  async function move(i: number, dir: -1 | 1) {
    if (!data) return;
    const j = i + dir;
    if (j < 0 || j >= data.length) return;
    const next = [...data];
    [next[i], next[j]] = [next[j], next[i]];
    setData(next);
    await Promise.all(next.map((c, k) => (c.sort !== k + 1 ? api(`/api/admin/checklists/${c.id}`, "PATCH", { sort: k + 1 }) : null)));
    reload();
  }

  async function remove(c: Checklist) {
    if (!confirm(`حذف «${c.title_ar || c.title_en}» وجميع سجلاتها؟ لا يمكن التراجع.\n\nلإخفائها مؤقتًا استخدم زر العين.`)) return;
    try {
      await api(`/api/admin/checklists/${c.id}`, "DELETE");
      setData((d) => d?.filter((x) => x.id !== c.id) ?? null);
      toast("حُذفت القائمة");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageTitle title="القوائم الأخرى" sub="قوائم التشييك غير المرتبطة بحاوية، مثل قوائم المشروع السابقة. الحاويات تُدار من صفحة الحاويات.">
        <button className="btn btn-ghost btn-sm" onClick={() => setSheetOpen(true)} disabled={!data?.length}>
          <Printer className="h-4 w-4" aria-hidden /> كل الباركودات (PDF)
        </button>
        <button className="btn btn-primary btn-sm" onClick={create} disabled={!deps?.length}>
          <Plus className="h-4 w-4" aria-hidden /> قائمة جديدة
        </button>
      </PageTitle>

      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {data?.map((c, i) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: EASE }}
              className={cx("glass flex flex-wrap items-center gap-4 p-4", !c.active && "opacity-60")}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: c.color }}>
                <Icon name={c.icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-snug">
                  {c.title_ar || c.title_en}
                  {c.locked && (
                    <span className="chip chip-warn ms-2 align-middle">
                      <Lock className="h-3 w-3" aria-hidden /> مقفلة
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-3">
                  {deps?.find((d) => d.id === c.department_id)?.name_ar ?? "—"} —{" "}
                  {c.fields.filter((f) => f.type !== "heading").length > 6
                    ? `${c.fields.filter((f) => f.type !== "heading").length} بندًا`
                    : c.fields.map((f) => `${f.label_ar || f.label_en}${rangeLabel(f) ? ` (${rangeLabel(f)})` : ""}`).join("، ")}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="نقل للأعلى">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, 1)} disabled={i === data.length - 1} aria-label="نقل للأسفل">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setQr({ c, kind: "open" })} aria-label="باركود فتح القائمة">
                  <QrCode className="h-4 w-4" />
                </button>
                <button
                  className="btn btn-ghost btn-sm btn-icon relative"
                  onClick={() => setQr({ c, kind: "report" })}
                  aria-label="باركود آخر تقرير"
                >
                  <QrCode className="h-4 w-4" />
                  <FileText className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-sm bg-[#283A83] p-px text-white" strokeWidth={2.4} />
                </button>
                <button
                  className={cx("btn btn-sm btn-icon", c.locked ? "border border-warn/40 bg-warn/15 text-warn" : "btn-ghost")}
                  onClick={() => toggleLock(c)}
                  aria-label={c.locked ? "فتح القفل" : "قفل بكلمة مرور الموظف"}
                  aria-pressed={!!c.locked}
                >
                  {c.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => toggle(c)} aria-label={c.active ? "إخفاء عن الموظفين" : "إظهار للموظفين"} aria-pressed={!c.active}>
                  {c.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => setDraft({ ...c, fields: c.fields.map((f) => ({ ...f, _k: f.key })) as Field[] })}
                  aria-label="تعديل"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(c)} aria-label="حذف">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {data?.length === 0 && <p className="glass p-10 text-center text-ink-3">لا توجد قوائم أخرى. الحاويات تُضاف من صفحة الحاويات.</p>}
        {!data && <div className="glass h-24 animate-pulse" />}
      </div>

      <Modal open={sheetOpen} onClose={() => !sheet && setSheetOpen(false)} title="كل الباركودات (PDF)">
        <p className="mb-4 text-[13px] text-ink-3">
          ملف PDF واحد فيه كل القوائم الظاهرة، 9 رموز في كل صفحة A4 مع خطوط القص. اطبعه بمقاس 100%.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["open", "رموز فتح القوائم", "للموظفين", "المسح يفتح القائمة لتعبئتها.", QrCode],
            ["report", "رموز التقارير", "للمشرفين", "المسح يفتح آخر تقرير بصيغة PDF.", FileText],
          ] as const).map(([kind, en, ar, sub, Ico]) => (
            <button
              key={kind}
              type="button"
              onClick={() => makeSheet(kind)}
              disabled={!!sheet}
              className="flex flex-col items-start gap-1.5 rounded-2xl border border-[var(--control-border)] bg-[var(--glass-inset)] p-4 text-start transition-colors hover:bg-raised disabled:opacity-60"
            >
              <span className="flex items-center gap-2 font-semibold">
                {sheet?.kind === kind ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ico className="h-4 w-4" />} {en}
              </span>
              <span className="text-[13px] text-ink-2">{ar}</span>
              <span className="text-[12px] text-ink-3">
                {sheet?.kind === kind && sheet.total ? `جارٍ الإنشاء… ${sheet.done}/${sheet.total}` : sub}
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <QrDialog
        checklist={qr?.c ?? null}
        kind={qr?.kind ?? "open"}
        department={deps?.find((d) => d.id === qr?.c.department_id)}
        onClose={() => setQr(null)}
      />

      <Editor
        draft={draft}
        deps={deps ?? []}
        onClose={() => setDraft(null)}
        onSaved={(msg) => {
          setDraft(null);
          reload();
          toast(msg);
        }}
      />
    </div>
  );
}

function Editor({ draft, deps, onClose, onSaved }: { draft: Draft | null; deps: Department[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [d, setD] = useState<Draft | null>(null);
  const [src, setSrc] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState("");
  if (draft !== src) {
    setSrc(draft);
    setD(draft);
    setErr("");
    setPicked("");
  }
  if (!d) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const fields = d.fields as (Field & { _k?: string })[];
  const setField = (i: number, patch: Partial<Field>) => setD({ ...d, fields: fields.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  function applyTemplate(t: Template | null) {
    if (!d || !draft) return;
    setPicked(t?.name ?? "");
    if (!t) return setD({ ...draft });
    setD({
      ...d,
      title_en: t.title_en,
      title_ar: t.title_ar,
      icon: t.icon,
      color: t.color,
      range_note: t.range_note,
      orientation: t.orientation,
      fields: t.fields.map((f) => ({ ...f, options: f.options && [...f.options], _k: Math.random().toString(36).slice(2) })),
    });
  }

  async function save() {
    if (!d) return;
    setBusy(true);
    setErr("");
    try {
      const body = { ...d, layout: d.layout ?? null, fields: fields.map((f) => ({ ...f, _k: undefined })) };
      if (d.id) await api(`/api/admin/checklists/${d.id}`, "PATCH", body);
      else await api(`/api/admin/checklists`, "POST", body);
      onSaved(d.id ? "حُفظت القائمة" : "أُنشئت القائمة");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      wide
      title={d.id ? "تعديل القائمة" : "قائمة جديدة"}
      footer={
        <>
          {err && <p className="mr-auto self-center text-[13px] text-danger">{err}</p>}
          <button className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {d.id ? "حفظ" : "إنشاء"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!d.id && (
          <div className="sm:col-span-2">
            <p className="label">البدء من قالب</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyTemplate(null)}
                className={cx("btn btn-sm border", !picked ? "border-[var(--action)] bg-raised text-ink" : "border-[var(--control-border)] bg-[var(--glass-inset)] text-ink-2")}
              >
                <Plus className="h-3.5 w-3.5" /> Blank
              </button>
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className={cx("btn btn-sm border", picked === t.name ? "border-[var(--action)] bg-raised text-ink" : "border-[var(--control-border)] bg-[var(--glass-inset)] text-ink-2")}
                >
                  <Icon name={t.icon} className="h-3.5 w-3.5" /> {t.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-3">يملأ العنوان والبنود. يمكنك تعديل أي شيء قبل الحفظ، وتحقق من مطابقة البنود لسياسة المستشفى.</p>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label">العنوان بالإنجليزية <span className="font-normal text-ink-3">(اختياري، للتقارير)</span></label>
          <input className="field sm" value={d.title_en} onChange={(e) => setD({ ...d, title_en: e.target.value })} dir="ltr" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">العنوان</label>
          <input className="field sm" dir="rtl" value={d.title_ar} onChange={(e) => setD({ ...d, title_ar: e.target.value })} />
        </div>
        <div>
          <label className="label">القسم</label>
          <select className="field sm" value={d.department_id} onChange={(e) => setD({ ...d, department_id: e.target.value })}>
            {deps.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name_en}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="label">اتجاه صفحة PDF</p>
          <div className="grid grid-cols-2 gap-2">
            {(["portrait", "landscape"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setD({ ...d, orientation: o })}
                className={cx("btn btn-sm border capitalize", d.orientation === o ? "border-[var(--action)] bg-raised text-ink" : "border-[var(--control-border)] bg-[var(--glass-inset)] text-ink-2")}
              >
                {o === "portrait" ? "عمودي" : "أفقي"}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl bg-ink/[0.04] p-3 text-[14px] text-ink-2 sm:col-span-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--action)]" checked={!!d.locked} onChange={(e) => setD({ ...d, locked: e.target.checked })} />
          <span>
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <Lock className="h-3.5 w-3.5" aria-hidden /> مقفلة
            </span>
            يدخل الموظف كلمة مرور حسابه كل مرة يفتح القائمة. يتطلب حسابات موظفين.
          </span>
        </label>

        <div className="sm:col-span-2">
          <p className="label">شكل التقرير</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              [undefined, "تلقائي"],
              ["table", "صف لكل إدخال"],
              ["grid", "قائمة بنود (شبكة ورقية)"],
            ] as const).map(([v, l]) => (
              <button
                key={l}
                type="button"
                onClick={() => setD({ ...d, layout: v ?? null })}
                className={cx("btn btn-sm border", (d.layout ?? undefined) === v ? "border-[var(--action)] bg-raised text-ink" : "border-[var(--control-border)] bg-[var(--glass-inset)] text-ink-2")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <p className="label">الأيقونة</p>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]">
            {Object.keys(ICONS).map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => setD({ ...d, icon: name })}
                className={cx(
                  "grid aspect-square place-items-center rounded-xl transition-colors",
                  d.icon === name ? "text-white" : "bg-[var(--glass-inset)] text-ink-2 hover:bg-raised",
                )}
                style={d.icon === name ? { background: d.color } : undefined}
              >
                <Icon name={name} className="h-[18px] w-[18px]" />
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="label">اللون</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setD({ ...d, color: c })}
                aria-label={c}
                className={cx("h-8 w-8 rounded-full transition-transform", d.color === c && "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[rgba(13,33,56,.25)]")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="label mb-0">البنود التي يعبئها الموظف</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setD({ ...d, fields: [...fields, blankField()] })}>
              <Plus className="h-4 w-4" /> Add field
            </button>
          </div>
          <p className="mb-3 text-[12px] text-ink-3">التاريخ واليوم والوقت والوردية والاسم والتوقيع تُضاف تلقائيًا.</p>
          <Reorder.Group axis="y" values={fields} onReorder={(f) => setD({ ...d, fields: f })} className="flex flex-col gap-2">
            {fields.map((f, i) => (
              <Reorder.Item key={f._k ?? f.key} value={f} className="rounded-2xl border border-[var(--divider)] bg-[var(--glass-inset)] p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_130px_auto]">
                  <input className="field sm" placeholder="النص بالإنجليزية (اختياري)" dir="ltr" value={f.label_en} onChange={(e) => setField(i, { label_en: e.target.value })} />
                  <input className="field sm" dir="rtl" placeholder="نص البند" value={f.label_ar} onChange={(e) => setField(i, { label_ar: e.target.value })} />
                  <select className="field sm" value={f.type} onChange={(e) => setField(i, { type: e.target.value as Field["type"] })}>
                    <option value="number">رقم</option>
                    <option value="text">نص</option>
                    <option value="select">اختيار</option>
                    <option value="yesno">نعم / لا</option>
                    <option value="check">بند مطابق / غير مطابق</option>
                    <option value="heading">عنوان قسم</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={() => setD({ ...d, fields: fields.filter((_, k) => k !== i) })}
                    disabled={fields.filter((x) => x.type !== "heading").length === 1 && f.type !== "heading"}
                    aria-label="حذف البند"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {f.type === "number" && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input className="field sm" placeholder="الوحدة (°C، %)" value={f.unit ?? ""} onChange={(e) => setField(i, { unit: e.target.value })} />
                    <input className="field sm" inputMode="decimal" placeholder="الحد الأدنى" value={f.min ?? ""} onChange={(e) => setField(i, { min: e.target.value === "" ? null : (e.target.value as unknown as number) })} />
                    <input className="field sm" inputMode="decimal" placeholder="الحد الأعلى" value={f.max ?? ""} onChange={(e) => setField(i, { max: e.target.value === "" ? null : (e.target.value as unknown as number) })} />
                  </div>
                )}
                {f.type === "select" && (
                  <input
                    className="field sm mt-2"
                    placeholder="الخيارات، مفصولة بفواصل"
                    value={Array.isArray(f.options) ? f.options.join(", ") : ""}
                    onChange={(e) => setField(i, { options: e.target.value.split(",").map((s) => s.trimStart()) })}
                  />
                )}
                {f.type === "check" && (
                  <input className="field sm mt-2" placeholder="الكمية (اختياري)" value={f.qty ?? ""} onChange={(e) => setField(i, { qty: e.target.value })} />
                )}
                {f.type !== "heading" && (
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    <label className="flex items-center gap-2 text-[13px] text-ink-2">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--action)]" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} />
                      مطلوب
                    </label>
                    {(f.type === "check" || f.type === "yesno") && (
                      <label className="flex items-center gap-2 text-[13px] text-ink-2">
                        <input type="checkbox" className="h-4 w-4 accent-[var(--action)]" checked={!!f.photo} onChange={(e) => setField(i, { photo: e.target.checked })} />
                        تُفتح الكاميرا عند الإجابة بنعم (تُرفق صورة)
                      </label>
                    )}
                  </div>
                )}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>

        <div className="sm:col-span-2">
          <label className="label">ملاحظة المدى (تُطبع أسفل الجدول)</label>
          <input className="field sm" value={d.range_note} onChange={(e) => setD({ ...d, range_note: e.target.value })}  />
        </div>
        <div className="sm:col-span-2">
          <label className="label">التذييل (يُطبع أسفل ملف PDF)</label>
          <input className="field sm" value={d.footer_note} onChange={(e) => setD({ ...d, footer_note: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, ListChecks, LoaderCircle, Pencil, Plus, Printer, QrCode, Search, Trash2 } from "lucide-react";
import { CodeBadge, KindTile } from "@/components/container-bits";
import { Modal } from "@/components/modal";
import { containerOf, KIND, KINDS, type ContainerInfo } from "@/lib/containers";
import type { Checklist, ContainerKind, Department, Field } from "@/lib/types";
import { cx } from "@/lib/utils";
import { useToast } from "../admin-shell";
import { api, PageTitle, useData } from "../use-data";
import { PrintLabels, useQr, type Label } from "./qr";

type Row = Checklist & { info: ContainerInfo };
type Form = { id?: string; kind: ContainerKind; code: string; location: string; department_id: string; active: boolean };

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
export const deptUrl = (d: Pick<Department, "slug">) => `${origin()}/d/${d.slug}?qr=1`;
export const containerUrl = (c: Pick<Checklist, "id">) => `${origin()}/c/${c.id}`;

export function Containers() {
  const toast = useToast();
  const lists = useData<Checklist[]>("/api/admin/checklists");
  const deps = useData<Department[]>("/api/admin/departments");
  const [dep, setDep] = useState("");
  const [kind, setKind] = useState<"" | ContainerKind>("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState(false);
  const [qr, setQr] = useState<Label | null>(null);
  const [printing, setPrinting] = useState<{ labels: Label[]; cols: number } | null>(null);
  const donePrinting = useCallback(() => setPrinting(null), []);

  const depById = useMemo(() => new Map((deps.data ?? []).map((d) => [d.id, d])), [deps.data]);
  const rows: Row[] = useMemo(
    () =>
      (lists.data ?? [])
        .flatMap((c) => (containerOf(c) ? [{ ...c, info: containerOf(c)! }] : []))
        .sort((a, b) => (depById.get(a.department_id)?.sort ?? 0) - (depById.get(b.department_id)?.sort ?? 0) || a.sort - b.sort),
    [lists.data, depById],
  );
  const shown = rows.filter(
    (r) =>
      (!dep || r.department_id === dep) &&
      (!kind || r.info.kind === kind) &&
      (!q.trim() || r.info.code.includes(q.trim().toUpperCase()) || r.info.location.includes(q.trim())),
  );
  const groups = (deps.data ?? []).map((d) => ({ d, rows: shown.filter((r) => r.department_id === d.id) })).filter((g) => g.rows.length || (!kind && !q && (!dep || dep === g.d.id)));

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const body = { kind: form.kind, code: form.code, location: form.location, department_id: form.department_id, active: form.active };
      if (form.id) await api(`/api/admin/containers/${form.id}`, "PATCH", body);
      else await api("/api/admin/containers", "POST", body);
      toast(form.id ? "حُفظت الحاوية" : "أُضيفت الحاوية");
      setForm(null);
      lists.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: Row) {
    if (!confirm(`حذف الحاوية ${r.info.code}؟ ستُحذف معها سجلات فحصها. لإيقافها مؤقتًا استخدم «موقوفة» بدلًا من الحذف.`)) return;
    try {
      await api(`/api/admin/checklists/${r.id}`, "DELETE");
      toast("حُذفت الحاوية");
      setForm(null);
      lists.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function move(r: Row, dir: -1 | 1) {
    const peers = rows.filter((x) => x.department_id === r.department_id);
    const i = peers.findIndex((x) => x.id === r.id);
    const other = peers[i + dir];
    if (!other) return;
    try {
      await Promise.all([api(`/api/admin/containers/${r.id}`, "PATCH", { sort: other.sort }), api(`/api/admin/containers/${other.id}`, "PATCH", { sort: r.sort === other.sort ? r.sort + dir : r.sort })]);
      lists.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const deptLabel = (d: Department): Label => ({ key: d.id, title: d.name_ar || d.name_en, sub: "باركود القسم — يُثبَّت عند المدخل", url: deptUrl(d) });
  const ctnLabel = (r: Row): Label => ({ key: r.id, title: r.info.location, sub: `${KIND[r.info.kind].ar} — ${depById.get(r.department_id)?.name_ar ?? ""}`, code: r.info.code, url: containerUrl(r) });

  return (
    <div>
      <PageTitle title="الحاويات والباركود" sub="كل حاوية مرتبطة بقسم. الموظف يمسح باركود القسم ثم يفحص حاوياته.">
        <button className="btn btn-ghost btn-sm" onClick={() => setItems(true)}>
          <ListChecks className="h-4 w-4" aria-hidden /> بنود الفحص
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={!deps.data?.length}
          onClick={() => setPrinting({ labels: (deps.data ?? []).filter((d) => d.active).map(deptLabel), cols: 2 })}
        >
          <Printer className="h-4 w-4" aria-hidden /> طباعة باركودات الأقسام
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!deps.data?.length}
          onClick={() => setForm({ kind: "floor", code: "", location: "", department_id: dep || deps.data?.[0]?.id || "", active: true })}
        >
          <Plus className="h-4 w-4" aria-hidden /> إضافة حاوية
        </button>
      </PageTitle>

      <div className="glass flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <select className="field sm md:w-56" value={dep} onChange={(e) => setDep(e.target.value)} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {deps.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name_ar || d.name_en}
            </option>
          ))}
        </select>
        <div className="seg md:w-80" role="group" aria-label="نوع الحاوية">
          {(
            [
              ["", "الكل"],
              ["floor", "أرضية"],
              ["sharps", "أدوات حادة"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {l} <span className="num text-ink-3">{rows.filter((r) => !k || r.info.kind === k).length}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <span className="sr-only">بحث</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field sm ps-9" type="search" placeholder="رقم الحاوية أو موقعها" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {deps.data?.length === 0 && <p className="glass mt-4 p-6 text-center text-ink-2">أضف قسمًا أولًا من صفحة الأقسام، ثم أضف حاوياته هنا.</p>}
      {!lists.data && <div className="skeleton mt-4 h-64" />}

      <div className="mt-4 grid gap-4">
        {groups.map(({ d, rows: rs }) => (
          <section key={d.id} className="glass-strong overflow-hidden" aria-label={d.name_ar || d.name_en}>
            <header className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <h2 className="text-[17px]">{d.name_ar || d.name_en}</h2>
              {!d.active && <span className="chip">القسم موقوف</span>}
              <span className="text-[13px] text-ink-3">
                <span className="num">{rows.filter((r) => r.department_id === d.id && r.info.kind === "floor").length}</span> أرضية —{" "}
                <span className="num">{rows.filter((r) => r.department_id === d.id && r.info.kind === "sharps").length}</span> أدوات حادة
              </span>
              <span className="flex-1" />
              <button className="btn btn-ghost btn-sm" onClick={() => setQr(deptLabel(d))}>
                <QrCode className="h-4 w-4" aria-hidden /> باركود القسم
              </button>
              {rs.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setPrinting({ labels: rs.map(ctnLabel), cols: 3 })}>
                  <Printer className="h-4 w-4" aria-hidden /> ملصقات الحاويات
                </button>
              )}
            </header>
            {rs.length === 0 ? (
              <p className="border-t border-ink/[0.07] px-5 py-6 text-center text-[14px] text-ink-2">لا توجد حاويات في هذا القسم.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table min-w-[720px]">
                  <thead>
                    <tr>
                      <th>الحاوية</th>
                      <th>الرقم</th>
                      <th>بنود الفحص</th>
                      <th>الحالة</th>
                      <th>
                        <span className="sr-only">إجراءات</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rs.map((r, i) => (
                      <tr key={r.id} className={cx(!r.active && "opacity-60")}>
                        <td>
                          <span className="flex items-center gap-3">
                            <KindTile kind={r.info.kind} size={36} />
                            <span>
                              <span className="block font-bold">{r.info.location}</span>
                              <span className="text-[12.5px] text-ink-3">{KIND[r.info.kind].ar}</span>
                            </span>
                          </span>
                        </td>
                        <td>
                          <CodeBadge code={r.info.code} />
                        </td>
                        <td className="num">{r.fields.filter((f) => f.type === "check").length}</td>
                        <td>{r.active ? <span className="chip chip-ok">نشطة</span> : <span className="chip">موقوفة</span>}</td>
                        <td>
                          <span className="flex justify-end gap-1">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(r, -1)} disabled={i === 0 || !!q || !!kind} aria-label={`نقل ${r.info.code} للأعلى`}>
                              <ArrowUp className="h-4 w-4" aria-hidden />
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(r, 1)} disabled={i === rs.length - 1 || !!q || !!kind} aria-label={`نقل ${r.info.code} للأسفل`}>
                              <ArrowDown className="h-4 w-4" aria-hidden />
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setQr(ctnLabel(r))} aria-label={`باركود ${r.info.code}`}>
                              <QrCode className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setForm({ id: r.id, kind: r.info.kind, code: r.info.code, location: r.info.location, department_id: r.department_id, active: r.active })}
                            >
                              <Pencil className="h-4 w-4" aria-hidden /> تعديل
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        busy={busy}
        title={form?.id ? "تعديل الحاوية" : "إضافة حاوية"}
        footer={
          <>
            {form?.id && (
              <button className="btn btn-danger me-auto" onClick={() => remove(rows.find((r) => r.id === form.id)!)} disabled={busy}>
                <Trash2 className="h-4 w-4" aria-hidden /> حذف
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setForm(null)} disabled={busy}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} حفظ
            </button>
          </>
        }
      >
        {form && (
          <div className="grid gap-4">
            <fieldset>
              <legend className="label">نوع الحاوية</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={form.kind === k}
                    onClick={() => setForm({ ...form, kind: k })}
                    className={cx("flex items-center gap-3 rounded-2xl border p-3 text-start transition-colors", form.kind === k ? "border-sky bg-sky/[0.07]" : "border-ink/12 bg-white/70")}
                  >
                    <KindTile kind={k} size={40} />
                    <span className="font-bold">{KIND[k].ar}</span>
                  </button>
                ))}
              </div>
              {form.id && <p className="mt-2 text-[12.5px] text-ink-3">تغيير النوع يستبدل بنود فحص الحاوية ببنود النوع الجديد.</p>}
            </fieldset>
            <div>
              <label htmlFor="c-dep" className="label">
                القسم
              </label>
              <select id="c-dep" className="field" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                {deps.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_ar || d.name_en}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <div>
                <label htmlFor="c-loc" className="label">
                  الموقع داخل القسم
                </label>
                <input id="c-loc" className="field" placeholder="مثال: غرفة الفرز" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <label htmlFor="c-code" className="label">
                  رقم الحاوية
                </label>
                <input
                  id="c-code"
                  className="field code w-full"
                  dir="ltr"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="ER-F-01"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-2.5">
              <input type="checkbox" className="h-5 w-5 accent-[#0c6fae]" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              مفعّلة وتظهر في جولة القسم
            </label>
          </div>
        )}
      </Modal>

      <QrModal label={qr} onClose={() => setQr(null)} onPrint={(l) => setPrinting({ labels: [l], cols: 1 })} />
      <ItemsEditor open={items} onClose={() => setItems(false)} onSaved={lists.reload} />
      <PrintLabels labels={printing?.labels ?? null} cols={printing?.cols} onDone={donePrinting} />
    </div>
  );
}

function QrModal({ label, onClose, onPrint }: { label: Label | null; onClose: () => void; onPrint: (l: Label) => void }) {
  const src = useQr(label?.url ?? null);
  return (
    <Modal
      open={!!label}
      onClose={onClose}
      title={label?.code ? "باركود الحاوية" : "باركود القسم"}
      footer={
        label && (
          <>
            {src && (
              <a className="btn btn-ghost" href={src} download={`qr-${label.code || label.title}.png`}>
                <Download className="h-4 w-4" aria-hidden /> تنزيل
              </a>
            )}
            <button className="btn btn-primary" onClick={() => onPrint(label)}>
              <Printer className="h-4 w-4" aria-hidden /> طباعة
            </button>
          </>
        )
      }
    >
      {label && (
        <div className="text-center">
          <p className="text-[18px] font-bold">{label.title}</p>
          <p className="text-[13.5px] text-ink-2">{label.sub}</p>
          <div className="mx-auto mt-4 grid aspect-square w-60 place-items-center rounded-2xl bg-white p-3 ring-1 ring-ink/10">
            {src ? <img src={src} alt={`باركود ${label.title}`} className="h-full w-full" /> : <LoaderCircle className="h-6 w-6 animate-spin text-ink-3" aria-hidden />}
          </div>
          {label.code && <CodeBadge code={label.code} className="mt-3 text-[15px]" />}
          <p className="mt-3 break-all text-[12px] text-ink-3" dir="ltr">
            {label.url}
          </p>
        </div>
      )}
    </Modal>
  );
}

function ItemsEditor({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data, reload } = useData<Record<ContainerKind, Field[]> & { custom: boolean }>(open ? "/api/admin/container-items" : null);
  const [kind, setKind] = useState<ContainerKind>("floor");
  const [draft, setDraft] = useState<Record<ContainerKind, Field[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const list = draft?.[kind] ?? data?.[kind] ?? [];
  const edit = (next: Field[]) => setDraft({ floor: draft?.floor ?? data?.floor ?? [], sharps: draft?.sharps ?? data?.sharps ?? [], [kind]: next });

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ applied: number }>("/api/admin/container-items", "PUT", { kind, items: list });
      toast(`حُفظت البنود وطُبّقت على ${r.applied} حاوية`);
      setDraft((d) => (d ? { ...d, [kind]: list } : d));
      reload();
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      wide
      title="بنود الفحص"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            إغلاق
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !list.length}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} حفظ وتطبيق على {KIND[kind].short}
          </button>
        </>
      }
    >
      <p className="text-[14px] text-ink-2">
        البنود تُطبَّق على كل حاويات النوع. الفحوص المحفوظة سابقًا لا تتغيّر. البنود المبدئية مأخوذة من قوائم المشروع الحالية، وتحتاج اعتماد إدارة مكافحة العدوى قبل الاستخدام.
      </p>
      <div className="seg mt-4" role="tablist" aria-label="نوع الحاوية">
        {KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
            {KIND[k].ar}
          </button>
        ))}
      </div>
      <ol className="mt-4 grid gap-2">
        {list.map((f, i) => (
          <li key={f.key} className="flex items-center gap-2">
            <span className="num w-6 text-center text-[13px] text-ink-3">{i + 1}</span>
            <input
              className="field sm flex-1"
              aria-label={`نص البند ${i + 1}`}
              value={f.label_ar}
              onChange={(e) => edit(list.map((x, j) => (j === i ? { ...x, label_ar: e.target.value, label_en: e.target.value } : x)))}
            />
            <button className="btn btn-ghost btn-sm btn-icon" disabled={i === 0} onClick={() => edit(list.map((x, j) => (j === i - 1 ? list[i] : j === i ? list[i - 1] : x)))} aria-label="للأعلى">
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" disabled={list.length === 1} onClick={() => edit(list.filter((_, j) => j !== i))} aria-label={`حذف البند ${i + 1}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
        {!data && <li className="skeleton h-40" />}
      </ol>
      <button className="btn btn-ghost btn-sm mt-3" onClick={() => edit([...list, { key: `i_${Date.now().toString(36)}`, label_ar: "", label_en: "", type: "check", required: true }])}>
        <Plus className="h-4 w-4" aria-hidden /> إضافة بند
      </button>
    </Modal>
  );
}

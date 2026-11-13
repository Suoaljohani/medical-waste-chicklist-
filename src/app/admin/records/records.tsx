/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, LoaderCircle, Pencil, ScanLine, Search, Trash2, TriangleAlert, X } from "lucide-react";
import { CodeBadge, KindTile } from "@/components/container-bits";
import { Modal } from "@/components/modal";
import { containerOf, isInfoField, KIND } from "@/lib/containers";
import { obsKey, OBS_STATUS, statusOf, summarize } from "@/lib/observations";
import type { Checklist, Department, FieldValue, Submission } from "@/lib/types";
import { currentMonth, cx, formatValue, isOutOfRange, monthRange, SHIFT_AR, shiftOf, zoned } from "@/lib/utils";
import { useToast } from "../admin-shell";
import { api, PageTitle, useData } from "../use-data";

type Detail = { submission: Submission; checklist: Checklist | null; department: Department | null };

export function Records() {
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const { data: checklists } = useData<Checklist[]>("/api/admin/checklists");
  const { data: deps } = useData<Department[]>("/api/admin/departments");
  const [dep, setDep] = useState("");
  const [chk, setChk] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [q, setQ] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [limit, setLimit] = useState(150);
  const range = month ? monthRange(month) : null;
  const url = `/api/admin/submissions?limit=3000${chk ? `&checklist=${chk}` : ""}${dep ? `&department=${dep}` : ""}${range ? `&from=${range.from}&to=${range.to}` : ""}`;
  const { data, error, reload, setData } = useData<Submission[]>(url, 30_000);
  const openId = params.get("open");

  const byId = useMemo(() => new Map((checklists ?? []).map((c) => [c.id, c])), [checklists]);
  const depById = useMemo(() => new Map((deps ?? []).map((d) => [d.id, d])), [deps]);
  const rows = (data ?? []).filter((r) => {
    const c = byId.get(r.checklist_id);
    if (issuesOnly && !r.flagged) return false;
    const s = q.trim();
    if (!s) return true;
    const info = containerOf(c);
    return r.employee_name.includes(s) || (info && (info.code.includes(s.toUpperCase()) || info.location.includes(s))) || (c?.title_ar ?? "").includes(s);
  });
  const setOpen = (id: string | null) => router.replace(id ? `/admin/records?open=${id}` : "/admin/records", { scroll: false });

  async function remove(id: string) {
    if (!confirm("حذف هذا الفحص نهائيًا؟ ستُحذف معه ملاحظاته. لا يمكن التراجع.")) return;
    try {
      await api(`/api/admin/submissions/${id}`, "DELETE");
      setData((d) => d?.filter((x) => x.id !== id) ?? null);
      setOpen(null);
      toast("حُذف الفحص");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageTitle title="سجل الفحوص" sub={data ? `${rows.length} فحص في الفترة المختارة` : "…"} />

      <div className="glass mb-4 grid gap-3 p-3 md:grid-cols-[1fr_1fr_auto_1fr_auto] md:items-center">
        <select className="field sm" value={dep} onChange={(e) => (setDep(e.target.value), setChk(""))} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {deps?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name_ar || d.name_en}
            </option>
          ))}
        </select>
        <select className="field sm" value={chk} onChange={(e) => setChk(e.target.value)} aria-label="الحاوية أو القائمة">
          <option value="">كل الحاويات والقوائم</option>
          {checklists
            ?.filter((c) => !dep || c.department_id === dep)
            .map((c) => {
              const info = containerOf(c);
              return (
                <option key={c.id} value={c.id}>
                  {info ? `${info.code} — ${info.location}` : c.title_ar || c.title_en}
                </option>
              );
            })}
        </select>
        <input type="month" className="field sm num" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="الشهر" />
        <label className="relative">
          <span className="sr-only">بحث</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field sm ps-9" type="search" placeholder="اسم الفاحص أو رقم الحاوية" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-[14px] text-ink-2">
          <input type="checkbox" className="h-5 w-5 accent-[#975a00]" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
          بها عدم مطابقة
        </label>
      </div>

      {error && !data && (
        <p className="glass p-6 text-center" role="alert">
          تعذّر تحميل السجل. <button className="font-bold text-sky underline" onClick={reload}>إعادة المحاولة</button>
        </p>
      )}

      <div className="glass-strong overflow-x-auto">
        <table className="table min-w-[820px]">
          <thead>
            <tr>
              <th>التاريخ والوقت</th>
              <th>الحاوية أو القائمة</th>
              <th>القسم</th>
              <th>النتيجة</th>
              <th>الفاحص</th>
              <th>
                <span className="sr-only">فتح</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!data &&
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td colSpan={6}>
                    <div className="skeleton h-9" />
                  </td>
                </tr>
              ))}
            {rows.slice(0, limit).map((r) => {
              const c = byId.get(r.checklist_id);
              const info = containerOf(c);
              const z = zoned(r.submitted_at);
              const sum = summarize(r, c);
              return (
                <tr key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
                  <td className="whitespace-nowrap">
                    <span className="num block font-bold" dir="ltr">
                      {z.date}
                    </span>
                    <span className="text-[12.5px] text-ink-3">
                      {z.dayAr} — <span className="num">{z.timeAr}</span>
                    </span>
                  </td>
                  <td>
                    {info ? (
                      <span className="flex items-center gap-2.5">
                        <KindTile kind={info.kind} size={32} />
                        <span>
                          <span className="block font-bold">{info.location}</span>
                          <CodeBadge code={info.code} />
                        </span>
                      </span>
                    ) : (
                      <span className="font-bold">{c?.title_ar || c?.title_en || "قائمة محذوفة"}</span>
                    )}
                  </td>
                  <td>{depById.get(r.department_id)?.name_ar ?? "—"}</td>
                  <td>
                    {sum.nonCompliant === 0 ? (
                      <span className="chip chip-ok">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden /> مطابقة
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        <span className="chip chip-warn">
                          <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> <span className="num">{sum.nonCompliant}</span> غير مطابق
                        </span>
                        {sum.open > 0 ? <span className="chip">{sum.open} تنتظر المعالجة</span> : <span className="chip chip-info">عولجت</span>}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="block font-bold">{r.employee_name}</span>
                    {r.values.__entry === "qr" && (
                      <span className="flex items-center gap-1 text-[12px] text-green">
                        <ScanLine className="h-3.5 w-3.5" aria-hidden /> بمسح الباركود
                      </span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm btn-icon" aria-label="تفاصيل الفحص" onClick={(e) => (e.stopPropagation(), setOpen(r.id))}>
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
            {data && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-2">
                  لا توجد فحوص تطابق التصفية.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > limit && (
        <div className="mt-4 text-center">
          <button className="btn btn-ghost" onClick={() => setLimit((n) => n + 300)}>
            عرض المزيد ({rows.length - limit} متبقٍ)
          </button>
        </div>
      )}

      <RecordDetail id={openId} onClose={() => setOpen(null)} onDelete={remove} onSaved={reload} />
    </div>
  );
}

function RecordDetail({ id, onClose, onDelete, onSaved }: { id: string | null; onClose: () => void; onDelete: (id: string) => void; onSaved: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ employee_name: string; note: string; values: Record<string, FieldValue> } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when another record opens
    setD(null);
    setFailed(false);
    setEditing(false);
    if (!id) return;
    fetch(`/api/admin/submissions/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setFailed(true));
  }, [id]);

  const s = d?.submission;
  const c = d?.checklist ?? undefined;
  const info = containerOf(c);
  const z = s ? zoned(s.submitted_at) : null;

  async function save() {
    if (!s || !form) return;
    setBusy(true);
    try {
      const sub = await api<Submission>(`/api/admin/submissions/${s.id}`, "PATCH", form);
      setD((x) => (x ? { ...x, submission: { ...x.submission, ...sub } } : x));
      setEditing(false);
      toast("حُفظ التصحيح");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      busy={busy}
      wide
      title={info ? `فحص ${info.code}` : "تفاصيل الفحص"}
      footer={
        s && (
          <>
            <button className="btn btn-danger me-auto" onClick={() => onDelete(s.id)} disabled={busy}>
              <Trash2 className="h-4 w-4" aria-hidden /> حذف
            </button>
            {editing ? (
              <>
                <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
                  إلغاء
                </button>
                <button className="btn btn-primary" onClick={save} disabled={busy}>
                  {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} حفظ التصحيح
                </button>
              </>
            ) : (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setForm({ employee_name: s.employee_name, note: s.note, values: { ...s.values } });
                  setEditing(true);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden /> تصحيح
              </button>
            )}
          </>
        )
      }
    >
      {failed && <p className="p-6 text-center text-ink-2">تعذّر تحميل الفحص، قد يكون حُذف.</p>}
      {!s && !failed && <div className="skeleton h-64" />}
      {s && z && (
        <div className="grid gap-5 md:grid-cols-[1fr_240px]">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {info && <KindTile kind={info.kind} size={44} />}
              <div>
                <p className="font-bold">{info ? info.location : c?.title_ar || c?.title_en}</p>
                <p className="text-[13px] text-ink-3">
                  {d?.department?.name_ar} {info && `— ${KIND[info.kind].ar}`}
                </p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-ink/[0.07] rounded-2xl bg-white/70 ring-1 ring-ink/[0.06]">
              {c?.fields
                .filter((f) => !isInfoField(f))
                .map((f) => {
                  const v = (editing ? form?.values : s.values)?.[f.key];
                  const bad = v === false || isOutOfRange(f, v ?? null);
                  return (
                    <li key={f.key} className="px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[14.5px]">{f.label_ar || f.label_en}</span>
                        {editing && form ? (
                          f.type === "check" || f.type === "yesno" ? (
                            <select
                              className="field sm w-36"
                              value={v === null || v === undefined ? "" : String(v)}
                              onChange={(e) => setForm({ ...form, values: { ...form.values, [f.key]: e.target.value === "" ? null : e.target.value === "true" } })}
                              aria-label={f.label_ar}
                            >
                              <option value="">—</option>
                              <option value="true">{f.type === "yesno" ? "نعم" : "مطابق"}</option>
                              <option value="false">{f.type === "yesno" ? "لا" : "غير مطابق"}</option>
                            </select>
                          ) : (
                            <input className="field sm w-36" value={(v as string | number | null) ?? ""} onChange={(e) => setForm({ ...form, values: { ...form.values, [f.key]: e.target.value } })} aria-label={f.label_ar} />
                          )
                        ) : f.type === "check" || f.type === "yesno" ? (
                          v === true ? (
                            <span className="chip chip-ok">
                              <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden /> {f.type === "yesno" ? "نعم" : "مطابق"}
                            </span>
                          ) : v === false ? (
                            <span className="chip chip-warn">
                              <X className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden /> {f.type === "yesno" ? "لا" : "غير مطابق"}
                            </span>
                          ) : (
                            <span className="chip">—</span>
                          )
                        ) : (
                          <span className={cx("num font-bold", bad && "text-warn")}>{formatValue(f, v ?? null) || "—"}</span>
                        )}
                      </div>
                      {!editing && v === false && (
                        <div className="mt-2 rounded-xl bg-[rgba(214,138,14,.08)] p-2.5 text-[13.5px]">
                          {s.values[obsKey(f.key, "note")] && <p>{String(s.values[obsKey(f.key, "note")])}</p>}
                          {s.values[obsKey(f.key, "action")] && <p className="text-ink-2">الإجراء: {String(s.values[obsKey(f.key, "action")])}</p>}
                          <p className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="chip">{OBS_STATUS[statusOf(s.values, f.key)].ar}</span>
                            {s.values[obsKey(f.key, "fu")] && <span className="text-ink-2">{String(s.values[obsKey(f.key, "fu")])}</span>}
                          </p>
                          {s.photos?.[f.key] && (
                            <a href={s.photos[f.key]} target="_blank" rel="noreferrer">
                              <img src={s.photos[f.key]} alt={`صورة: ${f.label_ar}`} className="mt-2 h-24 w-24 rounded-xl object-cover" />
                            </a>
                          )}
                        </div>
                      )}
                      {!editing && v === true && s.photos?.[f.key] && (
                        <a href={s.photos[f.key]} target="_blank" rel="noreferrer">
                          <img src={s.photos[f.key]} alt={`صورة: ${f.label_ar}`} className="mt-2 h-20 w-20 rounded-xl object-cover" />
                        </a>
                      )}
                    </li>
                  );
                })}
            </ul>
            {editing && form && (
              <div className="mt-4 grid gap-3">
                <div>
                  <label htmlFor="r-name" className="label">
                    اسم الفاحص
                  </label>
                  <input id="r-name" className="field sm" value={form.employee_name} onChange={(e) => setForm({ ...form, employee_name: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="r-note" className="label">
                    ملاحظة عامة
                  </label>
                  <textarea id="r-note" className="field" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
                <p className="text-[12.5px] text-ink-3">التاريخ والوقت والتوقيع لا تُعدَّل، ليبقى السجل موثوقًا.</p>
              </div>
            )}
            {!editing && s.note && <p className="mt-3 text-[14px] text-ink-2">ملاحظة عامة: {s.note}</p>}
          </div>
          <dl className="grid content-start gap-3 text-[14px]">
            <div>
              <dt className="text-[12.5px] text-ink-3">التاريخ</dt>
              <dd className="font-bold">
                {z.dayAr} <span className="num" dir="ltr">{z.date}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-ink-3">الوقت والوردية</dt>
              <dd className="font-bold">
                <span className="num">{z.timeAr}</span> — {SHIFT_AR[shiftOf(s.submitted_at)]}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-ink-3">الفاحص</dt>
              <dd className="font-bold">
                {s.employee_name} {s.employee_no && <span className="num text-ink-3">#{s.employee_no}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-ink-3">الوصول للقسم</dt>
              <dd>{s.values.__entry === "qr" ? "بمسح الباركود" : s.values.__entry === "manual" ? "اختيار يدوي" : "غير مسجّل"}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-ink-3">التوقيع</dt>
              <dd>{s.signature ? <img src={s.signature} alt={`توقيع ${s.employee_name}`} className="mt-1 h-16 w-full rounded-xl bg-white object-contain ring-1 ring-ink/10" /> : "—"}</dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  );
}

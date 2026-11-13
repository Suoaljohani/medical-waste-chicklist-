"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, Clock, PanelLeftOpen, RefreshCw, ScanLine, TriangleAlert } from "lucide-react";
import { CodeBadge, DemoBadge, KindTile } from "@/components/container-bits";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/modal";
import { OBS_STATUS } from "@/lib/observations";
import { agoAr, cx, zoned } from "@/lib/utils";
import type { Overview } from "../api/admin/overview/route";
import { PageTitle, useData } from "./use-data";

type Dep = Overview["departments"][number];

const pctOf = (done: number, total: number) => (total ? Math.round((done / total) * 100) : null);

export function Dashboard() {
  const [date, setDate] = useState("");
  const [dep, setDep] = useState("");
  const [open, setOpen] = useState<Dep | null>(null);
  const { data, error, reload } = useData<Overview>(`/api/admin/overview${date ? `?date=${date}` : ""}`, 20_000);

  const z = data ? zoned(new Date(`${data.date}T12:00:00Z`)) : null;
  const all = (data?.departments ?? []).filter((d) => d.total > 0);
  const rows = dep ? all.filter((d) => d.id === dep) : all;
  // Totals come from the same rows the table shows, so the summary always adds up.
  const required = rows.reduce((n, d) => n + d.total, 0);
  const inspected = rows.reduce((n, d) => n + d.done, 0);
  const openNotes = rows.reduce((n, d) => n + d.open, 0);
  const compliant = rows.reduce((n, d) => n + d.containers.filter((c) => c.inspected && c.nonCompliant === 0).length, 0);
  const coverage = pctOf(inspected, required);
  const compliance = pctOf(compliant, inspected);
  const notes = (data?.observations ?? []).filter((o) => !dep || o.department_id === dep);
  const period = z ? `${data!.is_today ? "اليوم" : ""} ${z.dayAr} ${z.date}`.trim() : "…";

  return (
    <div>
      <PageTitle title="متابعة الجولات" sub={`الفترة: ${period}`}>
        {data?.demo && <DemoBadge />}
        <label className="relative">
          <span className="sr-only">اليوم</span>
          <CalendarDays className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden />
          <input type="date" className="field sm code ps-9" max={data?.is_today ? data.date : undefined} value={date || data?.date || ""} onChange={(e) => setDate(e.target.value)} />
        </label>
        {date && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDate("")}>
            اليوم
          </button>
        )}
        <select className="field sm w-auto min-w-40" value={dep} onChange={(e) => setDep(e.target.value)} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {all.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </PageTitle>

      {error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-[rgb(255_180_171/40%)] bg-[var(--danger-surface)] p-3" role="alert">
          <p className="flex-1 text-[15px] text-[var(--danger)]">تعذّر تحديث لوحة المتابعة. {data ? "المعروض آخر بيانات وصلت." : ""}</p>
          <button className="btn btn-ghost btn-sm" onClick={reload}>
            <RefreshCw className="h-4 w-4" aria-hidden /> إعادة المحاولة
          </button>
        </div>
      )}

      {/* One line: inspected of required, remaining, open notes. */}
      <section className="glass-toolbar flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4" aria-label="ملخص الفترة">
        <Metric label="المفحوص من المطلوب" value={data ? <>{inspected} <span className="text-[20px] font-normal text-ink-2">من</span> {required}</> : "…"} hint={coverage === null ? "لا توجد حاويات مطلوبة" : <>تغطية <bdi dir="ltr">{coverage}%</bdi></>} />
        <Metric label="المتبقي" value={data ? String(required - inspected) : "…"} hint="حاوية" />
        <Metric label="الملاحظات المفتوحة" value={data ? String(openNotes) : "…"} hint="في فحوص الفترة" tone={openNotes ? "warn" : undefined} />
        <Metric label="المطابقة" value={compliance === null ? "—" : <bdi dir="ltr">{compliance}%</bdi>} hint={inspected ? `${compliant} من ${inspected} حاوية مفحوصة` : "لا فحوص بعد"} />
      </section>
      <p className="on-photo mt-2 px-1 text-[13px] text-ink-2">
        التغطية = الحاويات المطلوبة التي لها فحص محفوظ في الفترة ÷ الحاويات المطلوبة. المطابقة مقياس مستقل: الحاويات المفحوصة بلا بند غير مطابق ÷ الحاويات المفحوصة.
      </p>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_var(--observation-rail)]">
        <section className="glass overflow-hidden" aria-labelledby="deps-h">
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
            <h2 id="deps-h" className="text-[22px]">
              الأقسام
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-[680px]">
              <thead>
                <tr>
                  <th>القسم</th>
                  <th>تغطية الفحص</th>
                  <th>الملاحظات المفتوحة</th>
                  <th>آخر فحص</th>
                  <th>
                    <span className="sr-only">التفاصيل</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!data &&
                  [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td colSpan={5}>
                        <div className="skeleton h-9" />
                      </td>
                    </tr>
                  ))}
                {data && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-ink-2">
                      لا توجد أقسام بها حاويات. أضفها من صفحة الحاويات والباركود.
                    </td>
                  </tr>
                )}
                {rows.map((d) => {
                  const p = pctOf(d.done, d.total) ?? 0;
                  return (
                    <tr key={d.id}>
                      <td>
                        <span className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-[var(--divider)] bg-raised text-sky">
                            <Icon name={d.icon} className="h-5 w-5" strokeWidth={1.75} />
                          </span>
                          <span>
                            <span className="block font-bold">{d.name}</span>
                            <span className="whitespace-nowrap text-[13px] text-ink-2">{d.done === d.total ? "اكتملت الجولة" : d.done ? "قيد الفحص" : "لم تبدأ"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="min-w-[200px]">
                        <span className="flex items-baseline justify-between gap-2 text-[14px]">
                          <span className="num">
                            {d.done} من {d.total}
                          </span>
                          <bdi dir="ltr" className="num font-bold">{p}%</bdi>
                        </span>
                        <span className="meter mt-1.5 block" aria-hidden>
                          <i style={{ transform: `scaleX(${p / 100})` }} />
                        </span>
                      </td>
                      <td>
                        {d.open > 0 ? (
                          <span className="chip chip-warn">
                            <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> <span className="num">{d.open}</span> مفتوحة
                          </span>
                        ) : (
                          <span className="text-ink-2">لا توجد</span>
                        )}
                      </td>
                      <td className="text-[14px] text-ink-2">{d.last_at ? `${agoAr(d.last_at)}${d.staff[0] ? ` — ${d.staff[0]}` : ""}` : "—"}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(d)}>
                          <PanelLeftOpen className="h-4 w-4" aria-hidden /> التفاصيل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 1 && (
                <tfoot>
                  <tr className="bg-raised font-bold">
                    <td>الإجمالي</td>
                    <td className="num">
                      {inspected} من {required} — <bdi dir="ltr">{coverage ?? 0}%</bdi>
                    </td>
                    <td className="num">{openNotes}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <aside className="glass p-4" aria-labelledby="notes-h">
          <div className="flex items-center justify-between gap-2">
            <h2 id="notes-h" className="text-[20px]">
              ملاحظات تنتظر المعالجة
            </h2>
            <Link href="/admin/observations" className="btn btn-ghost btn-sm shrink-0">
              الكل <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <p className="text-[13px] text-ink-2">الأقدم أولًا</p>
          <ul className="mt-3 grid gap-2">
            {data && notes.length === 0 && <li className="rounded-[12px] border border-[var(--divider)] bg-[var(--success-surface)] p-4 text-center text-[15px] text-[var(--success)]">لا توجد ملاحظات مفتوحة.</li>}
            {notes.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/observations?id=${encodeURIComponent(o.id)}`} className="row-hit block rounded-[12px] border border-[var(--divider)] bg-[var(--glass-inset)] p-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cx("chip", o.status === "open" ? "chip-warn" : "chip-info")}>{OBS_STATUS[o.status].ar}</span>
                    <span className="flex items-center gap-1 text-[13px] text-ink-2">
                      <Clock className="h-3.5 w-3.5" aria-hidden /> {agoAr(o.submitted_at)}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[15px] font-bold leading-snug">{o.label_ar}</span>
                  {o.note && <span className="block text-[14px] text-ink-2">{o.note}</span>}
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                    {o.department}
                    {o.container && <CodeBadge code={o.container.code} className="!text-[13px]" />}
                  </span>
                </Link>
              </li>
            ))}
            {!data && [0, 1].map((i) => <li key={i} className="skeleton h-24" />)}
          </ul>
        </aside>
      </div>

      {data && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_var(--observation-rail)]">
          <section className="glass overflow-x-auto" aria-labelledby="recent-h">
            <h2 id="recent-h" className="px-5 pt-4 text-[20px]">
              آخر الفحوص
            </h2>
            {data.recent.length === 0 ? (
              <p className="px-5 py-6 text-ink-2">لا توجد فحوص في هذه الفترة.</p>
            ) : (
              <table className="table mt-2 min-w-[640px]">
                <thead>
                  <tr>
                    <th>الحاوية</th>
                    <th>القسم</th>
                    <th>الفاحص</th>
                    <th>الوقت</th>
                    <th>النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/admin/records?open=${r.id}`} className="flex items-center gap-2.5 font-bold hover:text-sky">
                          {r.kind && <KindTile kind={r.kind} size={32} />}
                          {r.title} {r.code && <CodeBadge code={r.code} />}
                        </Link>
                      </td>
                      <td>{r.department}</td>
                      <td>{r.employee_name}</td>
                      <td className="num">{zoned(r.submitted_at).timeAr}</td>
                      <td>
                        {r.nonCompliant === 0 ? (
                          <span className="chip chip-ok">مطابق</span>
                        ) : (
                          <span className="chip chip-bad">
                            <span className="num">{r.nonCompliant}</span> غير مطابق
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="glass p-4" aria-labelledby="trend-h">
            <h2 id="trend-h" className="text-[20px]">
              آخر 14 يومًا
            </h2>
            <p className="text-[13px] text-ink-2">الحاويات المفحوصة يوميًا؛ الجزء البرتقالي ما كان به عدم مطابقة</p>
            <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label="رسم الحاويات المفحوصة يوميًا خلال 14 يومًا">
              {data.trend.map((d) => {
                const max = Math.max(1, ...data.trend.map((x) => x.inspected));
                return (
                  <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.inspected} فُحصت، ${d.non_compliant} بها عدم مطابقة`}>
                    <div className="flex flex-col overflow-hidden rounded-t-[4px]" style={{ height: `${(d.inspected / max) * 100}%` }}>
                      <div className="bg-[var(--warning)]" style={{ height: `${d.inspected ? (d.non_compliant / d.inspected) * 100 : 0}%` }} />
                      <div className="flex-1 bg-[var(--action)] opacity-80" />
                    </div>
                  </div>
                );
              })}
            </div>
            <table className="sr-only">
              <caption>الحاويات المفحوصة يوميًا</caption>
              <tbody>
                {data.trend.map((d) => (
                  <tr key={d.date}>
                    <th>{d.date}</th>
                    <td>{d.inspected}</td>
                    <td>{d.non_compliant}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 flex justify-between text-[13px] text-ink-2">
              <span className="code">{data.trend[0]?.date.slice(5)}</span>
              <span className="code">{data.trend.at(-1)?.date.slice(5)}</span>
            </div>
          </section>
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `تفاصيل ${open.name}` : ""} wide>
        {open && (
          <div>
            <p className="text-[15px] text-ink-2">
              فُحصت <span className="num font-bold text-ink">{open.done}</span> من <span className="num">{open.total}</span> — أرضية{" "}
              <span className="num">
                {open.floor.done}/{open.floor.total}
              </span>{" "}
              — أدوات حادة{" "}
              <span className="num">
                {open.sharps.done}/{open.sharps.total}
              </span>
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[...open.containers]
                .sort((a, b) => Number(a.inspected) - Number(b.inspected))
                .map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--divider)] bg-[var(--glass-inset)] p-3">
                    <KindTile kind={c.kind} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <CodeBadge code={c.code} />
                        <span className="truncate text-[15px] font-bold">{c.location}</span>
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-2">
                        {c.inspected ? (
                          <>
                            {c.by} — {zoned(c.at!).timeAr}
                            {c.entry === "qr" && <ScanLine className="ms-1 inline h-3.5 w-3.5 text-[var(--success)]" aria-label="عبر رمز القسم" />}
                          </>
                        ) : (
                          "لم يبدأ"
                        )}
                      </p>
                    </div>
                    {c.inspected &&
                      (c.nonCompliant === 0 ? (
                        <span className="chip chip-ok">مطابق</span>
                      ) : c.open > 0 ? (
                        <span className="chip chip-warn">ملاحظة مفتوحة</span>
                      ) : (
                        <span className="chip chip-info">عولجت</span>
                      ))}
                    {c.submission_id && (
                      <Link href={`/admin/records?open=${c.submission_id}`} className="btn btn-ghost btn-sm btn-icon" aria-label={`فحص ${c.code}`}>
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </Link>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "warn" }) {
  return (
    <div>
      <p className="text-[14px] text-ink-2">{label}</p>
      <p className={cx("num text-[28px] font-bold leading-[1.1] md:text-[32px]", tone === "warn" && "text-[var(--warning)]")}>{value}</p>
      {hint && <p className="text-[13px] text-ink-2">{hint}</p>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CalendarDays, ChevronDown, ChevronLeft, Clock, RefreshCw, ScanLine, TriangleAlert } from "lucide-react";
import { CodeBadge, DemoBadge, KindTile } from "@/components/container-bits";
import { Icon } from "@/components/icon";
import { Rise } from "@/components/motion";
import { Counter, Scale } from "@/components/ring";
import { OBS_STATUS } from "@/lib/observations";
import { agoAr, cx, zoned } from "@/lib/utils";
import type { Overview } from "../api/admin/overview/route";
import { PageTitle, useData } from "./use-data";

export function Dashboard() {
  const [date, setDate] = useState("");
  const { data, error, reload } = useData<Overview>(`/api/admin/overview${date ? `?date=${date}` : ""}`, 20_000);
  const [open, setOpen] = useState<string | null>(null);

  if (error && !data)
    return (
      <div className="glass p-8 text-center">
        <p className="font-bold">تعذّر تحميل لوحة المتابعة</p>
        <button className="btn btn-primary mt-4" onClick={reload}>
          <RefreshCw className="h-4 w-4" aria-hidden /> إعادة المحاولة
        </button>
      </div>
    );

  const t = data?.totals;
  const z = data ? zoned(new Date(`${data.date}T12:00:00Z`)) : null;
  const pct = t && t.containers ? t.inspected / t.containers : 0;
  const maxTrend = Math.max(1, ...(data?.trend.map((d) => d.inspected) ?? [1]));

  return (
    <div>
      <PageTitle title="لوحة المتابعة" sub={z ? `${data!.is_today ? "اليوم" : "يوم"} ${z.dayAr} ${z.date}` : "…"}>
        {data?.demo && <DemoBadge />}
        <label className="relative">
          <span className="sr-only">اختر اليوم</span>
          <CalendarDays className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="date"
            className="field sm ps-9 num"
            dir="ltr"
            max={data?.is_today ? data.date : undefined}
            value={date || data?.date || ""}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {date && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDate("")}>
            اليوم
          </button>
        )}
      </PageTitle>

      {/* The one dark pane: how far today's rounds have got. */}
      <Rise className="glass-ink grid gap-5 p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-[1.4fr_1fr_1fr_1fr] xl:items-end">
        <div className="sm:col-span-3 xl:col-span-1">
          <p className="muted text-[14px]">الحاويات المفحوصة</p>
          <p className="mt-1 text-[40px] font-bold leading-none">
            {t ? <Counter value={t.inspected} /> : "–"} <span className="text-[20px] font-normal text-white/75">من {t ? <span className="num">{t.containers}</span> : "–"}</span>
          </p>
          <div className="mt-4">
            <div className="h-3 overflow-hidden rounded-full bg-white/20" role="img" aria-label={`${Math.round(pct * 100)}% من الحاويات فُحصت`}>
              <div className="h-full rounded-full bg-[#7fd4f7] transition-transform duration-500 ease-out" style={{ width: "100%", transform: `scaleX(${pct})`, transformOrigin: "right" }} />
            </div>
            <p className="muted mt-2 text-[13px]">
              <span className="num">{Math.round(pct * 100)}%</span> — متبقٍ <span className="num">{t ? t.containers - t.inspected : "–"}</span> حاوية
            </p>
          </div>
        </div>
        <Stat label="أقسام اكتملت جولتها" value={t ? `${t.departments_done} من ${t.departments}` : "–"} />
        <Stat label="حاويات بها عدم مطابقة" value={t ? String(t.non_compliant) : "–"} hint="في فحوص هذا اليوم" />
        <Stat label="ملاحظات تنتظر المعالجة" value={t ? String(t.obs_open + t.obs_progress) : "–"} hint={t ? `${t.obs_open} مفتوحة · ${t.obs_progress} قيد المعالجة` : ""} />
      </Rise>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <Rise i={1} className="glass-strong overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
            <h2 className="text-[18px]">الجولات حسب القسم</h2>
            <p className="text-[13px] text-ink-3">اضغط القسم لعرض حاوياته</p>
          </div>
          {!data && (
            <div className="grid gap-2 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-14" />
              ))}
            </div>
          )}
          {data?.departments.length === 0 && <p className="p-6 text-center text-ink-2">لا توجد أقسام بها حاويات بعد. أضفها من صفحة الحاويات.</p>}
          <ul>
            {data?.departments
              .filter((d) => d.total > 0)
              .map((d) => {
                const expanded = open === d.id;
                const marks = [...d.containers]
                  .sort((a, b) => Number(b.inspected) - Number(a.inspected))
                  .map((c) => (!c.inspected ? "off" : c.open > 0 ? "issue" : "on") as "on" | "issue" | "off");
                return (
                  <li key={d.id} className="border-t border-ink/[0.07]">
                    <button
                      type="button"
                      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 text-start transition-colors duration-150 hover:bg-sky/[0.04] md:grid-cols-[auto_minmax(150px,1fr)_minmax(180px,1.4fr)_auto_auto]"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : d.id)}
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky/10 text-sky">
                        <Icon name={d.icon} className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{d.name}</span>
                        <span className="block text-[12.5px] text-ink-3">
                          {d.last_at ? `آخر فحص ${agoAr(d.last_at)}${d.staff.length ? ` — ${d.staff.join("، ")}` : ""}` : "لم تبدأ الجولة"}
                        </span>
                      </span>
                      <span className="col-span-3 md:col-span-1">
                        <Scale marks={marks} label={`${d.done} من ${d.total}`} />
                        <span className="mt-1 flex gap-3 text-[12.5px] text-ink-2">
                          <span>
                            أرضية <span className="num">{d.floor.done}/{d.floor.total}</span>
                          </span>
                          <span>
                            أدوات حادة <span className="num">{d.sharps.done}/{d.sharps.total}</span>
                          </span>
                        </span>
                      </span>
                      <span className="hidden text-end md:block">
                        <span className="num block text-[18px] font-bold">
                          {d.done}/{d.total}
                        </span>
                        {d.open > 0 ? (
                          <span className="chip chip-warn mt-0.5">
                            <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> <span className="num">{d.open}</span> مفتوحة
                          </span>
                        ) : d.done === d.total ? (
                          <span className="chip chip-ok mt-0.5">اكتملت</span>
                        ) : null}
                      </span>
                      <ChevronDown className={cx("h-5 w-5 text-ink-3 transition-transform duration-200", expanded && "rotate-180")} aria-hidden />
                    </button>
                    {expanded && (
                      <div className="settle grid gap-2 bg-ink/[0.025] px-5 py-4 sm:grid-cols-2 2xl:grid-cols-3">
                        {d.containers.map((c) => (
                          <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white/85 p-3 ring-1 ring-ink/[0.06]">
                            <KindTile kind={c.kind} size={40} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14.5px] font-bold">{c.location}</p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                                <CodeBadge code={c.code} />
                                {c.inspected ? (
                                  <span>
                                    {c.by} — {zoned(c.at!).timeAr}
                                    {c.entry === "qr" && <ScanLine className="ms-1 inline h-3.5 w-3.5 text-green" aria-label="بمسح الباركود" />}
                                  </span>
                                ) : (
                                  <span>لم تُفحص</span>
                                )}
                              </p>
                            </div>
                            {c.inspected &&
                              (c.nonCompliant === 0 ? (
                                <span className="chip chip-ok">مطابقة</span>
                              ) : c.open > 0 ? (
                                <span className="chip chip-warn">ملاحظة مفتوحة</span>
                              ) : (
                                <span className="chip chip-info">عولجت</span>
                              ))}
                            {c.submission_id && (
                              <Link href={`/admin/records?open=${c.submission_id}`} className="btn btn-ghost btn-sm btn-icon" aria-label={`تفاصيل فحص ${c.code}`}>
                                <ChevronLeft className="h-4 w-4" aria-hidden />
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </Rise>

        <div className="grid content-start gap-5">
          <Rise i={2} className="glass p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px]">ملاحظات تنتظر المعالجة</h2>
              <Link href="/admin/observations" className="btn btn-ghost btn-sm">
                الكل <ArrowLeft className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <p className="text-[13px] text-ink-3">الأقدم أولًا</p>
            <ul className="mt-3 grid gap-2">
              {data?.observations.length === 0 && <li className="rounded-2xl bg-[rgba(6,122,91,.08)] p-4 text-center text-[14px] text-green">لا توجد ملاحظات مفتوحة.</li>}
              {data?.observations.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/observations?id=${encodeURIComponent(o.id)}`} className="block rounded-2xl bg-white/80 p-3 ring-1 ring-ink/[0.06] transition-colors duration-150 hover:bg-white">
                    <span className="flex items-center gap-2">
                      <span className={cx("chip", o.status === "open" ? "chip-warn" : "chip-info")}>{OBS_STATUS[o.status].ar}</span>
                      <span className="flex items-center gap-1 text-[12.5px] text-ink-3">
                        <Clock className="h-3.5 w-3.5" aria-hidden /> {agoAr(o.submitted_at)}
                      </span>
                    </span>
                    <span className="mt-1.5 block text-[14.5px] font-bold">{o.label_ar}</span>
                    {o.note && <span className="block truncate text-[13.5px] text-ink-2">{o.note}</span>}
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                      {o.department}
                      {o.container && (
                        <>
                          <span aria-hidden>—</span> {o.container.location} <CodeBadge code={o.container.code} />
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
              {!data && [0, 1, 2].map((i) => <li key={i} className="skeleton h-24" />)}
            </ul>
          </Rise>

          <Rise i={3} className="glass p-5">
            <h2 className="text-[18px]">آخر 14 يومًا</h2>
            <p className="text-[13px] text-ink-3">عدد الحاويات المفحوصة يوميًا، والجزء البرتقالي ما كان به عدم مطابقة</p>
            <div className="mt-4 flex h-28 items-end gap-1.5" role="img" aria-label="رسم الحاويات المفحوصة يوميًا خلال 14 يومًا">
              {data?.trend.map((d) => (
                <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.inspected} فُحصت، ${d.non_compliant} بها عدم مطابقة`}>
                  <div className="flex flex-col overflow-hidden rounded-t-md" style={{ height: `${(d.inspected / maxTrend) * 100}%` }}>
                    <div className="bg-[#d68a0e]" style={{ height: `${d.inspected ? (d.non_compliant / d.inspected) * 100 : 0}%` }} />
                    <div className="flex-1 bg-sky/70" />
                  </div>
                </div>
              ))}
            </div>
            {data && (
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
            )}
            <div className="mt-1 flex justify-between text-[12px] text-ink-3">
              <span className="num" dir="ltr">{data?.trend[0]?.date.slice(5)}</span>
              <span className="num" dir="ltr">{data?.trend.at(-1)?.date.slice(5)}</span>
            </div>
          </Rise>

          {t && t.lists.total > 0 && (
            <Rise i={4} className="glass p-5">
              <h2 className="text-[16px]">القوائم الأخرى</h2>
              <p className="mt-1 text-[14px] text-ink-2">
                سُجّلت <span className="num font-bold">{t.lists.done}</span> من <span className="num">{t.lists.total}</span> قوائم في هذا اليوم.
              </p>
            </Rise>
          )}
        </div>
      </div>

      {data && data.recent.length > 0 && (
        <Rise i={4} className="glass-strong mt-5 overflow-x-auto">
          <h2 className="px-5 pt-4 text-[18px]">آخر الفحوص</h2>
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
                      {r.kind && <KindTile kind={r.kind} size={30} />}
                      {r.title} {r.code && <CodeBadge code={r.code} />}
                    </Link>
                  </td>
                  <td>{r.department}</td>
                  <td>{r.employee_name}</td>
                  <td className="num">{zoned(r.submitted_at).timeAr}</td>
                  <td>
                    {r.nonCompliant === 0 ? (
                      <span className="chip chip-ok">مطابقة</span>
                    ) : (
                      <span className="chip chip-warn">
                        <span className="num">{r.nonCompliant}</span> غير مطابق{r.open ? ` · ${r.open} مفتوحة` : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Rise>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-t border-white/15 pt-3 sm:[&:not(:nth-child(2))]:border-s sm:[&:not(:nth-child(2))]:ps-5 xl:border-s xl:border-t-0 xl:ps-5 xl:pt-0">
      <p className="muted text-[13.5px]">{label}</p>
      <p className="num mt-1 text-[28px] font-bold leading-tight">{value}</p>
      {hint && <p className="muted mt-0.5 text-[12.5px]">{hint}</p>}
    </div>
  );
}

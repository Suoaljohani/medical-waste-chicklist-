"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ClipboardList, History, RefreshCw, ShieldUser } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { useNow } from "@/components/clock";
import { CodeBadge, DemoBadge } from "@/components/container-bits";
import { latestDraft, type Draft, type DraftMeta } from "@/components/drafts";
import { Icon } from "@/components/icon";
import { useStaff } from "@/components/staff";
import { ScanButton, StaffNav } from "@/components/staff-nav";
import type { Department } from "@/lib/types";
import { agoAr, zoned } from "@/lib/utils";

type Count = { total: number; done: number };
type Dep = Department & { containers: Count; lists: Count };
type Data = { demo: boolean; departments: Dep[]; today: Count; open_notes: number };
type Resume = Draft & { id: string; meta: DraftMeta };

/** Inspector home: today's round, resume, scan, a modest summary, then the departments. */
export function HomeView() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const { staff, ready } = useStaff();
  const [resume, setResume] = useState<Resume | null>(null);
  const now = useNow(60_000);
  const z = now ? zoned(now) : null;

  const load = () => {
    setLoading(true);
    fetch("/api/public/departments", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set when the request settles
    load();
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafts live in browser storage
    if (ready && staff) setResume(latestDraft(staff.name));
  }, [ready, staff]);

  const deps = data?.departments;
  const t = data?.today ?? { total: 0, done: 0 };
  const left = Math.max(0, t.total - t.done);

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pb-10">
      <header className="glass-toolbar flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <Wordmark />
        <Link href="/admin" className="btn btn-ghost btn-sm shrink-0">
          <ShieldUser className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">الإدارة</span>
          <span className="sr-only sm:hidden">الإدارة</span>
        </Link>
      </header>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-6">
        {/* Today's round */}
        <section className="glass p-4 sm:p-6" aria-labelledby="round-title">
          <p className="text-[14px] text-ink-2">
            {z ? (
              <>
                {z.dayAr} <span className="code">{z.date}</span>
              </>
            ) : (
              "…"
            )}
          </p>
          <h1 id="round-title" className="mt-1 text-[24px] sm:text-[32px]">
            جولة اليوم
          </h1>
          <p className="mt-1 text-[16px] text-ink-2">امسح رمز القسم لعرض حاوياته وبدء الفحص.</p>

          {resume && (
            <Link
              href={`/d/${resume.meta.slug}/${resume.id}`}
              className="mt-5 flex items-center gap-3 rounded-[12px] border border-[rgb(139_200_248/40%)] bg-[var(--info-surface)] p-3 ps-4 transition-colors duration-[140ms] hover:border-[var(--info)]"
            >
              <History className="h-6 w-6 shrink-0 text-[var(--info)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">استئناف الجولة</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[14px] text-ink-2">
                  {resume.meta.department} — {resume.meta.title}
                  {resume.meta.code && <CodeBadge code={resume.meta.code} />}
                  <span>مسودة {agoAr(new Date(resume.at).toISOString())}</span>
                </span>
              </span>
              <ChevronLeft className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
            </Link>
          )}

          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
            <ScanButton className="btn btn-primary w-full" />
            <a href="#deps" className="btn btn-ghost min-h-[56px]">
              اختيار القسم
            </a>
          </div>

          {/* Three separate facts, each with its own meaning. */}
          <dl className="mt-5 grid grid-cols-3 divide-x divide-x-reverse divide-[var(--divider)] rounded-[12px] border border-[var(--divider)] bg-[var(--glass-inset)] py-3 text-center">
            <div className="px-2">
              <dt className="text-[14px] text-ink-2">فُحصت اليوم</dt>
              <dd className="num mt-0.5 text-[22px] font-bold leading-tight">
                {data ? (
                  <>
                    {t.done}
                    <span className="text-[15px] font-normal text-ink-2"> من {t.total}</span>
                  </>
                ) : (
                  "…"
                )}
              </dd>
            </div>
            <div className="px-2">
              <dt className="text-[14px] text-ink-2">المتبقي</dt>
              <dd className="num mt-0.5 text-[22px] font-bold leading-tight">{data ? left : "…"}</dd>
            </div>
            <div className="px-2">
              <dt className="text-[14px] text-ink-2">ملاحظات مفتوحة</dt>
              <dd className={`num mt-0.5 text-[22px] font-bold leading-tight ${data?.open_notes ? "text-[var(--warning)]" : ""}`}>{data ? data.open_notes : "…"}</dd>
            </div>
          </dl>
          {data && t.total === 0 && <p className="mt-3 text-[14px] text-ink-2">لا توجد حاويات مسجّلة بعد، لذا لا تُحسب نسبة للجولة. تضيفها الإدارة من صفحة الحاويات.</p>}
          {data && t.total > 0 && left === 0 && <p className="mt-3 text-[14px] text-[var(--success)]">اكتمل فحص جميع الحاويات اليوم.</p>}
          {data?.demo && (
            <p className="mt-3">
              <DemoBadge />
            </p>
          )}
        </section>

        {/* Departments */}
        <section id="deps" aria-labelledby="deps-title" className="glass scroll-mt-4 overflow-hidden">
          <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
            <div>
              <h2 id="deps-title" className="text-[20px] sm:text-[22px]">
                الأقسام
              </h2>
              <p className="text-[14px] text-ink-2">الدخول من القائمة يُسجَّل اختيارًا يدويًا.</p>
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-[rgb(255_180_171/40%)] bg-[var(--danger-surface)] p-3 sm:mx-6" role="alert">
              <p className="flex-1 text-[15px] text-[var(--danger)]">تعذّر تحميل الأقسام. {data ? "المعروض آخر بيانات وصلت." : "تحقق من الاتصال."}</p>
              <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
                <RefreshCw className="h-4 w-4" aria-hidden /> إعادة المحاولة
              </button>
            </div>
          )}

          <ul className="divide-y divide-[var(--divider)] border-t border-[var(--divider)]" aria-busy={!data && !error}>
            {!data &&
              !error &&
              [0, 1, 2].map((i) => (
                <li key={i} className="flex min-h-[80px] items-center gap-4 px-4 sm:px-6">
                  <span className="skeleton h-12 w-12 shrink-0" />
                  <span className="flex-1">
                    <span className="skeleton block h-5 w-40" />
                    <span className="skeleton mt-2 block h-2 w-full" />
                  </span>
                </li>
              ))}
            {deps?.map((d) => {
              const c = d.containers;
              const pct = c.total ? c.done / c.total : 0;
              return (
                <li key={d.id}>
                  <Link href={`/d/${d.slug}`} className="row-hit flex min-h-[80px] items-center gap-4 px-4 py-3 sm:px-6">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] border border-[var(--divider)] bg-raised text-sky">
                      <Icon name={d.icon} className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[17px] font-bold leading-snug">{d.name_ar || d.name_en}</span>
                        {c.total > 0 && (
                          <span className={`num shrink-0 text-[14px] font-bold ${c.done === c.total ? "text-[var(--success)]" : "text-ink-2"}`}>
                            {c.done === c.total ? "اكتمل" : <bdi dir="ltr">{Math.round(pct * 100)}%</bdi>}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[14px] text-ink-2">
                        {c.total === 0 ? (
                          "لا توجد حاويات مسجّلة"
                        ) : (
                          <>
                            فُحصت <span className="num">{c.done}</span> من <span className="num">{c.total}</span> حاوية
                          </>
                        )}
                        {d.lists.total > 0 && (
                          <>
                            {" "}
                            — <span className="num">{d.lists.total}</span> سجلات تشغيلية
                          </>
                        )}
                      </span>
                      {c.total > 0 && (
                        <span className="meter mt-2 block" role="img" aria-label={`فُحصت ${c.done} من ${c.total}`}>
                          <i style={{ transform: `scaleX(${pct})` }} />
                        </span>
                      )}
                    </span>
                    <ChevronLeft className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {deps?.length === 0 && (
            <p className="flex items-center gap-2 border-t border-[var(--divider)] px-6 py-8 text-ink-2">
              <ClipboardList className="h-5 w-5" aria-hidden /> لا توجد أقسام بعد. تضيفها الإدارة من لوحة التحكم.
            </p>
          )}
        </section>
      </div>

      <StaffNav />
    </main>
  );
}

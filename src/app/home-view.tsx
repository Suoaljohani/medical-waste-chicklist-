"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ShieldUser } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { LiveClock } from "@/components/clock";
import { DemoBadge } from "@/components/container-bits";
import { Icon } from "@/components/icon";
import { Rise } from "@/components/motion";
import { Ring } from "@/components/ring";
import { ScanButton, StaffNav } from "@/components/staff-nav";
import type { Department } from "@/lib/types";

type Count = { total: number; done: number };
type Dep = Department & { containers: Count; lists: Count };
type Data = { demo: boolean; departments: Dep[]; today: Count };

export function HomeView() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/public/departments", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setData(d);
          setError(false);
        })
        .catch(() => setError(true));
    load();
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  const deps = data?.departments;
  const today = data?.today ?? { total: 0, done: 0 };
  const pct = today.total ? today.done / today.total : 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-[max(14px,env(safe-area-inset-top))] sm:px-6 sm:pb-8">
      <header className="flex items-center justify-between gap-3 py-2">
        <Wordmark />
        <Link href="/admin" className="btn btn-ghost btn-sm">
          <ShieldUser className="h-4 w-4" aria-hidden />
          الإدارة
        </Link>
      </header>

      <div className="mt-5 grid gap-5 md:grid-cols-[1.1fr_1fr] md:items-stretch">
        <Rise className="glass-ink flex flex-col justify-between gap-6 p-5 sm:p-7">
          <div>
            <LiveClock className="!text-white/80" />
            <h1 className="mt-2 text-[30px] sm:text-[38px]">جولة فحص الحاويات</h1>
            <p className="muted mt-2 max-w-md text-[15.5px]">
              ادخل القسم وامسح الباركود المثبّت عند مدخله، ثم افحص حاوياته الأرضية وحاويات الأدوات الحادة المعلّقة.
            </p>
          </div>
          <ScanButton className="btn hidden h-[54px] bg-white px-6 text-[16px] text-[#0c4f86] sm:inline-flex sm:self-start" />
        </Rise>

        <Rise i={1} className="glass flex items-center gap-5 p-5 sm:p-6">
          <Ring pct={pct} size={108} />
          <div className="min-w-0">
            <p className="eyebrow">حاويات اليوم في كل الأقسام</p>
            <p className="mt-1 text-[22px] font-bold">
              {data ? (
                <>
                  تم فحص <span className="num">{today.done}</span> من <span className="num">{today.total}</span>
                </>
              ) : (
                <span className="skeleton inline-block h-7 w-40 align-middle" />
              )}
            </p>
            <p className="mt-1 text-[14px] text-ink-2">
              {data && today.total === 0
                ? "لم تُسجَّل حاويات بعد. تضيفها الإدارة من لوحة التحكم."
                : data && today.done === today.total
                  ? "اكتمل فحص جميع الحاويات اليوم."
                  : "المتبقي يظهر داخل كل قسم."}
            </p>
            {data?.demo && (
              <p className="mt-2">
                <DemoBadge />
              </p>
            )}
          </div>
        </Rise>
      </div>

      <section aria-labelledby="deps" className="mt-8">
        <div className="mb-3 px-1">
          <h2 id="deps" className="text-[19px]">
            الأقسام
          </h2>
          <p className="text-[13px] text-ink-3">الدخول من هنا يُسجَّل اختيارًا يدويًا. المسح يؤكد وجودك في القسم.</p>
        </div>

        {error && (
          <p className="glass p-5 text-center text-ink-2" role="alert">
            تعذّر تحميل الأقسام. تحقق من الاتصال ثم أعد فتح الصفحة.
          </p>
        )}
        {!deps && !error && (
          <div className="glass divide-y divide-ink/[0.07]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <span className="skeleton h-12 w-12 shrink-0 rounded-[14px]" />
                <span className="skeleton h-5 w-40" />
              </div>
            ))}
          </div>
        )}
        {deps && deps.length > 0 && (
          <Rise i={2}>
            <ul className="glass divide-y divide-ink/[0.07] overflow-hidden">
              {deps.map((d) => {
                const c = d.containers;
                const done = c.total > 0 && c.done === c.total;
                return (
                  <li key={d.id}>
                    <Link href={`/d/${d.slug}`} className="flex min-h-[76px] items-center gap-4 px-4 py-3 transition-colors duration-150 active:bg-ink/[0.05] sm:px-5">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-sky/10 text-sky">
                        <Icon name={d.icon} className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16.5px] font-bold">{d.name_ar || d.name_en}</span>
                        <span className="mt-0.5 block text-[13.5px] text-ink-2">
                          {c.total === 0 ? (
                            "لا توجد حاويات مسجّلة"
                          ) : (
                            <>
                              <span className="num">{c.done}</span> من <span className="num">{c.total}</span> حاوية فُحصت اليوم
                            </>
                          )}
                          {d.lists.total > 0 && (
                            <>
                              {" "}
                              — <span className="num">{d.lists.total}</span> قوائم أخرى
                            </>
                          )}
                        </span>
                      </span>
                      {c.total > 0 && (
                        <span className={done ? "chip chip-ok" : "chip"}>
                          {done ? "اكتملت" : <span className="num">{Math.round((c.done / c.total) * 100)}%</span>}
                        </span>
                      )}
                      <ChevronLeft className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Rise>
        )}
        {deps?.length === 0 && <p className="glass p-6 text-center text-ink-2">لا توجد أقسام بعد. تضيفها الإدارة من لوحة التحكم.</p>}
      </section>

      <StaffNav />
    </main>
  );
}

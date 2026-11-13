"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ClipboardList, Lock, ScanLine } from "lucide-react";
import { LogoTile } from "@/components/brand";
import { LiveClock, useNow } from "@/components/clock";
import { CodeBadge, DemoBadge, KindTile, RoundChip, type RoundState } from "@/components/container-bits";
import { draftIds } from "@/components/drafts";
import { Icon } from "@/components/icon";
import { Rise } from "@/components/motion";
import { Scale } from "@/components/ring";
import { markScanned, wasScanned } from "@/components/scanner";
import { useStaff } from "@/components/staff";
import { StaffGate } from "@/components/staff-gate";
import { LAST_DEPT, ScanButton, StaffNav } from "@/components/staff-nav";
import { containerOf, KIND, type ContainerInfo } from "@/lib/containers";
import type { Checklist, Department } from "@/lib/types";
import { agoAr, cx, zoned } from "@/lib/utils";

type Data = { department: Department; checklists: Checklist[]; doneToday: Record<string, number>; state: Record<string, NonNullable<RoundState>> };
type Filter = "left" | "all" | "floor" | "sharps";
type Row = { c: Checklist; info: ContainerInfo };

export function DepartmentView() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const { staff, ready } = useStaff();
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [filter, setFilter] = useState<Filter>("left");
  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  const [demo, setDemo] = useState(false);

  // Arriving from a printed QR code confirms the department for this visit.
  useEffect(() => {
    if (params.get("qr") === "1") {
      markScanned(slug);
      router.replace(`/d/${slug}${next ? `?next=${encodeURIComponent(next)}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read session storage after mount
    setScanned(params.get("qr") === "1" || wasScanned(slug));
    try {
      localStorage.setItem(LAST_DEPT, slug);
    } catch {}
  }, [params, slug, router, next]);

  useEffect(() => {
    const load = () =>
      fetch(`/api/public/departments/${slug}`, { cache: "no-store" })
        .then((r) => {
          if (r.status === 404) setMissing(true);
          return r.ok ? r.json() : Promise.reject();
        })
        .then((d: Data) => {
          setData(d);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    load();
    fetch("/api/public/departments", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDemo(!!j.demo))
      .catch(() => {});
    // Coming back from an inspection (or unlocking the phone) refreshes the round.
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
    };
  }, [slug]);

  // A QR code printed for one container leads here first when nobody is signed in yet.
  useEffect(() => {
    if (ready && staff && next && /^[\w-]+$/.test(next)) router.replace(`/d/${slug}/${next}`);
  }, [ready, staff, next, router, slug]);

  const rows: Row[] = useMemo(
    () => (data?.checklists ?? []).flatMap((c) => (containerOf(c) ? [{ c, info: containerOf(c)! }] : [])),
    [data],
  );
  const lists = useMemo(() => (data?.checklists ?? []).filter((c) => !containerOf(c)), [data]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after data arrives
    if (staff) setDrafts(draftIds(rows.map((r) => r.c.id), staff.name));
  }, [rows, staff]);

  const st = data?.state ?? {};
  const done = rows.filter((r) => st[r.c.id]);
  const left = rows.filter((r) => !st[r.c.id]);
  const issues = done.filter((r) => st[r.c.id].open > 0).length;
  const count = (k: ContainerInfo["kind"]) => rows.filter((r) => r.info.kind === k).length;
  const shown = [...(filter === "left" ? left : filter === "all" ? rows : rows.filter((r) => r.info.kind === filter))].sort(
    // Not yet inspected first, then by kind and number, so the list reads in walking order.
    (a, b) => Number(!!st[a.c.id]) - Number(!!st[b.c.id]) || a.c.sort - b.c.sort,
  );
  const marks = [...rows]
    .sort((a, b) => Number(!st[a.c.id]) - Number(!st[b.c.id]) || a.c.sort - b.c.sort)
    .map((r) => (!st[r.c.id] ? "off" : st[r.c.id].open > 0 ? "issue" : "on") as "on" | "issue" | "off");
  const nextUp = [...left].sort((a, b) => a.c.sort - b.c.sort)[0];
  const name = data?.department.name_ar || data?.department.name_en;
  const now = useNow(60_000);
  const today = now ? zoned(now) : null;

  if (missing)
    return (
      <main className="mx-auto grid w-full max-w-md flex-1 place-items-center px-4">
        <div className="glass p-8 text-center">
          <p className="text-[18px] font-bold">القسم غير موجود</p>
          <p className="mt-1 text-ink-2">قد يكون الباركود قديمًا أو القسم موقوفًا. اختر القسم من القائمة.</p>
          <Link href="/" className="btn btn-primary mt-5">
            قائمة الأقسام
          </Link>
        </div>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pb-10">
      <header className="flex items-center gap-3 py-2">
        <Link href="/" className="btn btn-ghost btn-sm btn-icon" aria-label="رجوع إلى الأقسام">
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <LiveClock className="hidden min-w-0 flex-1 sm:block" />
        <span className="flex-1 sm:hidden" />
        <ScanButton className="btn btn-ghost btn-sm hidden sm:inline-flex">مسح باركود</ScanButton>
        <LogoTile size={40} />
      </header>

      <Rise className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          {scanned ? (
            <span className="chip chip-ok">
              <ScanLine className="h-3.5 w-3.5" aria-hidden /> تم التأكد من القسم بمسح الباركود
            </span>
          ) : (
            <span className="chip">اختيار يدوي — امسح باركود القسم لتأكيده</span>
          )}
          {demo && <DemoBadge />}
        </div>
        <h1 className="mt-2 text-[28px] sm:text-[34px]">{name ?? <span className="skeleton inline-block h-9 w-56 align-middle" />}</h1>
      </Rise>

      <div className="mt-4 grid gap-3">
        <Rise i={1}>
          <StaffGate />
        </Rise>

        {rows.length > 0 && (
          <Rise i={2} className="glass-ink p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="muted text-[13.5px]">جولة اليوم{today ? ` — ${today.dayAr} ${today.date}` : ""}</p>
                <p className="mt-0.5 text-[22px] font-bold">
                  فُحصت <span className="num">{done.length}</span> من <span className="num">{rows.length}</span> حاوية
                </p>
              </div>
              <p className="muted text-end text-[13px]">
                {left.length === 0 ? "اكتملت الجولة" : <>متبقٍ <span className="num">{left.length}</span></>}
                {issues > 0 && (
                  <>
                    <br />
                    <span className="num">{issues}</span> بملاحظة مفتوحة
                  </>
                )}
              </p>
            </div>
            <div className="mt-3">
              <Scale marks={marks} label={`فُحصت ${done.length} من ${rows.length}`} />
            </div>
            {nextUp && staff && (
              <Link
                href={`/d/${slug}/${nextUp.c.id}`}
                className="btn mt-4 h-[52px] w-full bg-white text-[15.5px] text-[#0c4f86] sm:w-auto sm:px-6"
              >
                {drafts.has(nextUp.c.id) ? "أكمل" : "ابدأ"} فحص {nextUp.info.location}
                <CodeBadge code={nextUp.info.code} className="bg-[#0c4f86]/10 text-[#0c4f86]" />
              </Link>
            )}
          </Rise>
        )}
      </div>

      {failed && (
        <p className="glass mt-4 p-4 text-center text-ink-2" role="alert">
          تعذّر تحديث الجولة. تحقق من الاتصال؛ ستتحدّث تلقائيًا عند عودتك للصفحة.
        </p>
      )}

      {(rows.length > 0 || !data) && (
        <section aria-labelledby="ctn" className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <h2 id="ctn" className="text-[19px]">
              الحاويات
            </h2>
          </div>
          <div className="seg mb-3" role="group" aria-label="تصفية الحاويات">
            {(
              [
                ["left", "المتبقية", left.length],
                ["all", "الكل", rows.length],
                ["floor", "أرضية", count("floor")],
                ["sharps", "أدوات حادة", count("sharps")],
              ] as const
            ).map(([k, label, n]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label} <span className="num text-ink-3">{n}</span>
              </button>
            ))}
          </div>

          {!data ? (
            <div className="glass divide-y divide-ink/[0.07]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3.5">
                  <span className="skeleton h-12 w-12 rounded-[14px]" />
                  <span className="skeleton h-5 w-44" />
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="glass p-6 text-center text-ink-2">
              {filter === "left" ? "لا توجد حاويات متبقية في هذا القسم اليوم." : "لا توجد حاويات من هذا النوع."}
            </p>
          ) : (
            <ul className="glass divide-y divide-ink/[0.07] overflow-hidden">
              {shown.map(({ c, info }) => {
                const s = st[c.id];
                const body = (
                  <>
                    <KindTile kind={info.kind} size={48} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[16px] font-bold">{info.location}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
                        <span>{KIND[info.kind].ar}</span>
                        <CodeBadge code={info.code} />
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <RoundChip state={s} draft={drafts.has(c.id)} />
                        {s && (
                          <span className="text-[12.5px] text-ink-3">
                            {s.by} — {agoAr(s.last_at)}
                          </span>
                        )}
                        {c.locked && !s && (
                          <span className="chip">
                            <Lock className="h-3 w-3" aria-hidden /> بكلمة المرور
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronLeft className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
                  </>
                );
                const cls = cx("flex min-h-[84px] w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-150 active:bg-ink/[0.05] sm:px-4");
                return (
                  <li key={c.id}>
                    {staff ? (
                      <Link href={`/d/${slug}/${c.id}`} className={cls}>
                        {body}
                      </Link>
                    ) : (
                      <button type="button" className={cls} onClick={() => document.getElementById("sg-name")?.focus() ?? document.getElementById("sg-no")?.focus()}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {lists.length > 0 && (
        <section aria-labelledby="lists" className="mt-7">
          <h2 id="lists" className="mb-3 px-1 text-[17px]">
            قوائم أخرى في القسم
          </h2>
          <ul className="glass divide-y divide-ink/[0.07] overflow-hidden">
            {lists.map((c) => (
              <li key={c.id}>
                <Link href={staff ? `/d/${slug}/${c.id}` : "#"} aria-disabled={!staff} className="flex min-h-[64px] items-center gap-3 px-4 py-3 active:bg-ink/[0.05]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky/10 text-sky">
                    <Icon name={c.icon || "ClipboardList"} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">{c.title_ar || c.title_en}</span>
                  {(data?.doneToday[c.id] ?? 0) > 0 ? <span className="chip chip-ok">سُجّلت اليوم</span> : <ClipboardList className="h-4 w-4 text-ink-3" aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && rows.length === 0 && lists.length === 0 && <p className="glass mt-6 p-6 text-center text-ink-2">لا توجد حاويات مسجّلة لهذا القسم. تضيفها الإدارة من صفحة الحاويات.</p>}

      <StaffNav />
    </main>
  );
}

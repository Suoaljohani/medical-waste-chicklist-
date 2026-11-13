"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ClipboardList, Hand, Lock, RefreshCw, ScanLine, TriangleAlert } from "lucide-react";
import { LogoTile } from "@/components/brand";
import { useNow } from "@/components/clock";
import { CodeBadge, DemoBadge, KindTile, RoundChip, type RoundState } from "@/components/container-bits";
import { draftIds } from "@/components/drafts";
import { Icon } from "@/components/icon";
import { markScanned, wasScanned } from "@/components/scanner";
import { useStaff } from "@/components/staff";
import { StaffGate } from "@/components/staff-gate";
import { LAST_DEPT, ScanButton, StaffNav } from "@/components/staff-nav";
import { containerOf, type ContainerInfo } from "@/lib/containers";
import type { Checklist, Department } from "@/lib/types";
import { agoAr, cx, zoned } from "@/lib/utils";

type Data = { department: Department; checklists: Checklist[]; doneToday: Record<string, number>; state: Record<string, NonNullable<RoundState>> };
type Status = "left" | "all" | "drafts";
type Kind = "all" | "floor" | "sharps";
type Row = { c: Checklist; info: ContainerInfo };

const SCROLL_KEY = (slug: string) => `mw_round_scroll:${slug}`;

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
  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  const [demo, setDemo] = useState(false);
  const restored = useRef(false);
  const now = useNow(60_000);
  const z = now ? zoned(now) : null;

  // Filters live in the address, so returning from an inspection brings them back.
  const status: Status = params.get("s") === "all" || params.get("s") === "drafts" ? (params.get("s") as Status) : "left";
  const kind: Kind = params.get("k") === "floor" || params.get("k") === "sharps" ? (params.get("k") as Kind) : "all";
  const setFilter = (s: Status, k: Kind) => {
    const q = new URLSearchParams();
    if (s !== "left") q.set("s", s);
    if (k !== "all") q.set("k", k);
    router.replace(`/d/${slug}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  // Arriving from a printed code confirms the department for this visit.
  useEffect(() => {
    if (params.get("qr") === "1") {
      markScanned(slug);
      router.replace(`/d/${slug}${next ? `?next=${encodeURIComponent(next)}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session storage is browser-only
    setScanned(params.get("qr") === "1" || wasScanned(slug));
    try {
      localStorage.setItem(LAST_DEPT, slug);
    } catch {}
  }, [params, slug, router, next]);

  const load = useCallback(() => {
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
  }, [slug]);

  useEffect(() => {
    load();
    fetch("/api/public/departments", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDemo(!!j.demo))
      .catch(() => {});
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
    };
  }, [load]);

  // Put the list back where it was once the rows are on screen.
  useEffect(() => {
    if (!data || restored.current) return;
    restored.current = true;
    try {
      const y = Number(sessionStorage.getItem(SCROLL_KEY(slug)));
      if (y > 0) requestAnimationFrame(() => window.scrollTo({ top: y }));
    } catch {}
  }, [data, slug]);
  const rememberScroll = () => {
    try {
      sessionStorage.setItem(SCROLL_KEY(slug), String(window.scrollY));
    } catch {}
  };

  // A printed container code leads here first when nobody is identified yet.
  useEffect(() => {
    if (ready && staff && next && /^[\w-]+$/.test(next)) router.replace(`/d/${slug}/${next}`);
  }, [ready, staff, next, router, slug]);

  const rows: Row[] = useMemo(() => (data?.checklists ?? []).flatMap((c) => (containerOf(c) ? [{ c, info: containerOf(c)! }] : [])), [data]);
  const lists = useMemo(() => (data?.checklists ?? []).filter((c) => !containerOf(c)), [data]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafts live in browser storage
    if (staff) setDrafts(draftIds(rows.map((r) => r.c.id), staff.name));
  }, [rows, staff]);

  const st = data?.state ?? {};
  const done = rows.filter((r) => st[r.c.id]);
  const left = rows.filter((r) => !st[r.c.id]);
  const openNotes = done.reduce((n, r) => n + st[r.c.id].open, 0);
  const pct = rows.length ? done.length / rows.length : 0;
  const ofKind = (k: Kind) => (k === "all" ? rows : rows.filter((r) => r.info.kind === k));
  const ofStatus = (s: Status, list: Row[]) => (s === "all" ? list : s === "drafts" ? list.filter((r) => drafts.has(r.c.id)) : list.filter((r) => !st[r.c.id]));
  const shown = [...ofStatus(status, ofKind(kind))].sort((a, b) => Number(!!st[a.c.id]) - Number(!!st[b.c.id]) || a.c.sort - b.c.sort);
  const name = data?.department.name_ar || data?.department.name_en;

  if (missing)
    return (
      <main className="mx-auto grid w-full max-w-md flex-1 place-items-center px-4">
        <div className="glass p-8 text-center" role="alert">
          <p className="text-[20px] font-bold">القسم غير متاح</p>
          <p className="mt-1 text-ink-2">قد يكون الرمز قديمًا أو القسم موقوفًا. اختر القسم من القائمة.</p>
          <Link href="/#deps" className="btn btn-primary mt-5">
            العودة إلى الأقسام
          </Link>
        </div>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-[880px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pb-10">
      <header className="glass-toolbar flex items-center gap-3 px-2 py-2 sm:px-3">
        <Link href="/" className="btn btn-ghost btn-sm btn-icon shrink-0" aria-label="العودة إلى الرئيسية">
          <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] leading-tight sm:text-[24px]">{name ?? <span className="skeleton inline-block h-6 w-40 align-middle" />}</h1>
          <p className="text-[13px] text-ink-2">{z ? <>جولة {z.dayAr} <span className="code">{z.date}</span></> : "…"}</p>
        </div>
        <ScanButton className="btn btn-ghost btn-sm hidden shrink-0 sm:inline-flex">مسح رمز</ScanButton>
        <LogoTile size={48} />
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {scanned ? (
          <span className="chip chip-ok">
            <ScanLine className="h-3.5 w-3.5" aria-hidden /> عبر رمز القسم
          </span>
        ) : (
          <span className="chip">
            <Hand className="h-3.5 w-3.5" aria-hidden /> اختيار يدوي
          </span>
        )}
        {demo && <DemoBadge />}
      </div>

      <div className="mt-3 grid gap-3">
        <StaffGate />

        {rows.length > 0 && (
          <section className="glass p-4 sm:p-5" aria-label="تقدم جولة القسم">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <p className="text-[18px] font-bold">
                فُحصت <span className="num">{done.length}</span> من <span className="num">{rows.length}</span> حاوية
              </p>
              <p className="text-[14px] text-ink-2">
                متبقٍ <span className="num font-bold text-ink">{left.length}</span>
              </p>
            </div>
            <div className="meter mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={done.length} aria-label="الحاويات المفحوصة">
              <i style={{ transform: `scaleX(${pct})` }} />
            </div>
            <p className={cx("mt-3 flex items-center gap-1.5 text-[15px]", openNotes ? "text-[var(--warning)]" : "text-ink-2")}>
              <TriangleAlert className="h-4 w-4" aria-hidden />
              {openNotes ? (
                <>
                  <span className="num font-bold">{openNotes}</span> ملاحظة مفتوحة في فحوص اليوم
                </>
              ) : (
                "لا توجد ملاحظات مفتوحة في فحوص اليوم"
              )}
            </p>
          </section>
        )}
      </div>

      {failed && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-[rgb(255_180_171/40%)] bg-[var(--danger-surface)] p-3" role="alert">
          <p className="flex-1 text-[15px] text-[var(--danger)]">تعذّر تحديث الجولة. {data ? "المعروض آخر بيانات وصلت." : "تحقق من الاتصال."}</p>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw className="h-4 w-4" aria-hidden /> إعادة المحاولة
          </button>
        </div>
      )}

      {(rows.length > 0 || !data) && (
        <section aria-labelledby="ctn" className="mt-5">
          <h2 id="ctn" className="mb-3 px-1 text-[20px] sm:text-[22px]">
            الحاويات
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="seg" role="group" aria-label="حالة الفحص">
              {(
                [
                  ["left", "المتبقية", left.length],
                  ["all", "الكل", rows.length],
                  ...(drafts.size ? ([["drafts", "المسودات", drafts.size]] as const) : []),
                ] as const
              ).map(([k, label, n]) => (
                <button key={k} type="button" aria-pressed={status === k} onClick={() => setFilter(k, kind)}>
                  {label} <span className="num text-ink-2">{n}</span>
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="نوع الحاوية">
              {(
                [
                  ["all", "الكل"],
                  ["floor", "أرضية"],
                  ["sharps", "أدوات حادة"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setFilter(status, k)}>
                  {label} <span className="num text-ink-2">{ofKind(k).length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass mt-3 overflow-hidden">
            {!data ? (
              <div className="divide-y divide-[var(--divider)]">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex min-h-[80px] items-center gap-3 px-4">
                    <span className="skeleton h-12 w-12" />
                    <span className="skeleton h-5 w-44" />
                  </div>
                ))}
              </div>
            ) : shown.length === 0 ? (
              status === "left" && kind === "all" ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[18px] font-bold text-[var(--success)]">اكتمل فحص حاويات القسم</p>
                  {openNotes > 0 && (
                    <p className="mt-1 text-[15px] text-[var(--warning)]">
                      ما زالت <span className="num">{openNotes}</span> ملاحظة مفتوحة بانتظار المتابعة.
                    </p>
                  )}
                  <button className="btn btn-ghost btn-sm mt-4" onClick={() => setFilter("all", kind)}>
                    عرض كل الحاويات
                  </button>
                </div>
              ) : (
                <div className="px-5 py-8 text-center">
                  <p className="text-ink-2">لا توجد حاويات تطابق المرشحات الحالية.</p>
                  <button className="btn btn-ghost btn-sm mt-3" onClick={() => setFilter("left", "all")}>
                    مسح المرشحات
                  </button>
                </div>
              )
            ) : (
              <ul className="divide-y divide-[var(--divider)]">
                {shown.map(({ c, info }) => {
                  const s = st[c.id];
                  const draft = drafts.has(c.id);
                  const action = draft ? "استئناف" : s ? "فحص جديد" : "ابدأ الفحص";
                  const body = (
                    <>
                      <KindTile kind={info.kind} size={48} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <CodeBadge code={info.code} />
                          <span className="text-[14px] text-ink-2">{info.kind === "floor" ? "أرضية" : "أدوات حادة"}</span>
                        </span>
                        <span className="mt-1 block text-[16px] font-bold leading-snug">{info.location}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                          <RoundChip state={s} draft={draft} />
                          {s && (
                            <span className="text-[14px] text-ink-2">
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
                      <span className={cx("hidden shrink-0 rounded-[10px] px-3 py-2 text-[14px] font-bold sm:block", s && !draft ? "border border-[var(--control-border)] text-ink-2" : "bg-[var(--action)] text-[var(--action-text)]")}>
                        {action}
                      </span>
                      <ChevronLeft className="h-5 w-5 shrink-0 text-ink-2 sm:hidden" aria-hidden />
                    </>
                  );
                  const cls = "row-hit flex min-h-[80px] w-full items-center gap-3 px-4 py-3 text-start";
                  return (
                    <li key={c.id}>
                      {staff ? (
                        <Link href={`/d/${slug}/${c.id}`} className={cls} onClick={rememberScroll} aria-label={`${action}: ${info.code}، ${info.location}`}>
                          {body}
                        </Link>
                      ) : (
                        <button type="button" className={cls} onClick={() => (document.getElementById("sg-name") ?? document.getElementById("sg-no"))?.focus()}>
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {lists.length > 0 && (
        <section aria-labelledby="lists" className="mt-6">
          <h2 id="lists" className="mb-3 px-1 text-[20px]">
            السجلات التشغيلية للقسم
          </h2>
          <ul className="glass divide-y divide-[var(--divider)] overflow-hidden">
            {lists.map((c) => (
              <li key={c.id}>
                <Link href={staff ? `/d/${slug}/${c.id}` : "#"} aria-disabled={!staff} className="row-hit flex min-h-[64px] items-center gap-3 px-4 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-[var(--divider)] bg-raised text-sky">
                    <Icon name={c.icon || "ClipboardList"} className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 font-bold leading-snug">{c.title_ar || c.title_en}</span>
                  {(data?.doneToday[c.id] ?? 0) > 0 ? <span className="chip chip-ok">سُجّل اليوم</span> : <ClipboardList className="h-5 w-5 text-ink-2" aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && rows.length === 0 && lists.length === 0 && (
        <p className="glass mt-5 p-6 text-center text-ink-2">لا توجد حاويات مسجّلة لهذا القسم. تضيفها الإدارة من صفحة الحاويات والباركود.</p>
      )}

      <StaffNav />
    </main>
  );
}

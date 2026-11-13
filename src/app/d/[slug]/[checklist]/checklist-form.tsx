"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Camera, Check, CircleAlert, CloudOff, HardDriveDownload, KeyRound, ListChecks, LoaderCircle, Lock, RotateCcw, ScanLine, TriangleAlert, UserRound, X } from "lucide-react";
import { LogoTile } from "@/components/brand";
import { useNow } from "@/components/clock";
import { CodeBadge, KindTile } from "@/components/container-bits";
import { clearDraft, readDraft, writeDraft } from "@/components/drafts";
import { Icon } from "@/components/icon";
import { EASE, Rise } from "@/components/motion";
import { wasScanned } from "@/components/scanner";
import { SignatureSheet } from "@/components/signature-sheet";
import { useStaff } from "@/components/staff";
import { StaffNav } from "@/components/staff-nav";
import { containerOf, isInfoField } from "@/lib/containers";
import { obsKey } from "@/lib/observations";
import type { Checklist, Department, Field, FieldValue } from "@/lib/types";
import { cx, isOutOfRange, rangeLabel, SHIFT_AR, shiftOf, zoned } from "@/lib/utils";

type Data = { checklist: Checklist; department: Department };
type Saved = { at: string; compliant: number; nonCompliant: number };
type Next = { id: string; location: string; code: string } | null;
type DraftState = "none" | "local" | "full";

const answered = (v: FieldValue | undefined) => v !== undefined && v !== null && v !== "";

export function ChecklistForm() {
  const { slug, checklist: id } = useParams<{ slug: string; checklist: string }>();
  const router = useRouter();
  const { staff, ready, setStaff } = useStaff();
  const now = useNow(30_000);
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [locked, setLocked] = useState<{ c: Pick<Checklist, "title_en" | "title_ar" | "icon" | "color">; accounts: boolean } | null>(null);
  // Proof the employee entered their password for this visit. In memory only: leaving the page locks it again.
  const [unlock, setUnlock] = useState("");
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [next, setNext] = useState<Next>(null);
  const [draft, setDraft] = useState<DraftState>("none");
  const [restored, setRestored] = useState(false);
  const [scanned, setScanned] = useState(false);
  const touched = useRef(false);
  const inFlight = useRef(false);

  const load = useCallback(
    (token = "") => {
      fetch(`/api/public/checklists/${id}`, { cache: "no-store", headers: token ? { "x-unlock": token } : undefined })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (r.status === 403 && j.locked) {
            setUnlock("");
            setLocked({ c: j.checklist, accounts: !!j.accounts });
            return;
          }
          if (!r.ok) throw new Error();
          setUnlock(token);
          setLocked(null);
          setData(j);
        })
        .catch(() => setMissing(true));
    },
    [id],
  );
  useEffect(() => load(), [load]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session storage is browser-only
    setScanned(wasScanned(slug));
  }, [slug]);

  useEffect(() => {
    if (ready && !staff) router.replace(`/d/${slug}?next=${encodeURIComponent(id)}`);
  }, [ready, staff, router, slug, id]);

  // Bring back unsaved answers from this phone, once.
  useEffect(() => {
    if (!data || !staff || restored) return;
    const d = readDraft(id, staff.name);
    if (d) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
      setValues(d.values);
      setPhotos(d.photos);
      setNote(d.note);
      setDraft("local");
    }
    setRestored(true);
  }, [data, staff, id, restored]);

  // Keep a draft on the phone while answering: shortly after each change, and at once when the page is
  // left (back button, app switch, screen lock), so a quick exit never loses answers.
  const latest = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!restored || !staff || saved || !touched.current) {
      latest.current = null;
      return;
    }
    const meta = data
      ? { slug, department: data.department.name_ar || data.department.name_en, title: containerOf(data.checklist)?.location || data.checklist.title_ar || data.checklist.title_en, code: containerOf(data.checklist)?.code }
      : undefined;
    const write = () => setDraft(writeDraft(id, { values, photos, note, at: Date.now(), by: staff.name, meta }) ? "local" : "full");
    latest.current = write;
    const t = setTimeout(write, 250);
    return () => clearTimeout(t);
  }, [values, photos, note, restored, staff, id, saved, data, slug]);
  useEffect(() => {
    const flush = () => latest.current?.();
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  const c = data?.checklist;
  const info = containerOf(c);
  const fields = useMemo(() => (c ? c.fields.filter((f) => !isInfoField(f)) : []), [c]);
  const total = fields.length;
  const done = fields.filter((f) => answered(values[f.key])).length;
  const nonCompliant = fields.filter((f) => (f.type === "check" || f.type === "yesno") && values[f.key] === false);

  const set = (k: string, v: FieldValue) => {
    touched.current = true;
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => {
      if (!(k in e)) return e;
      const n = { ...e };
      delete n[k];
      return n;
    });
  };
  const setPhoto = (k: string, jpeg: string | null) => {
    touched.current = true;
    setPhotos((p) => {
      const n = { ...p };
      if (jpeg) n[k] = jpeg;
      else delete n[k];
      return n;
    });
    setErrors((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
  };

  function review(e: React.FormEvent) {
    e.preventDefault();
    if (!c) return;
    const bad: Record<string, string> = {};
    for (const f of fields) {
      const v = values[f.key];
      const label = f.label_ar || f.label_en;
      if (f.required && !answered(v)) bad[f.key] = "اختر الإجابة";
      else if (f.type === "number" && answered(v) && Number.isNaN(Number(v))) bad[f.key] = "أدخل رقمًا";
      else if (f.photo && v === true && !photos[f.key]) bad[f.key] = "التقط صورة";
      else if (info && v === false && String(values[obsKey(f.key, "note")] ?? "").trim().length < 3) bad[f.key] = `اكتب ما لاحظته في «${label}»`;
    }
    setErrors(bad);
    setFailure("");
    const first = fields.find((f) => bad[f.key]);
    if (first) {
      const el = document.getElementById(`f-${first.key}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
      return;
    }
    setSigning(true);
  }

  const closeSheet = useCallback(() => setSigning(false), []);

  async function submit(signature: string) {
    if (!c || !staff || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure("");
    try {
      // Only send what belongs to an item that is still marked non-compliant.
      const body: Record<string, FieldValue> = {};
      for (const f of fields) {
        body[f.key] = values[f.key] ?? null;
        if (values[f.key] === false) {
          body[obsKey(f.key, "note")] = values[obsKey(f.key, "note")] ?? "";
          body[obsKey(f.key, "action")] = values[obsKey(f.key, "action")] ?? "";
        }
      }
      const pics = Object.fromEntries(Object.entries(photos).filter(([k]) => values[k] === false || fields.find((f) => f.key === k)?.photo));
      const r = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checklist_id: c.id, employee_name: staff.name, employee_no: staff.no, values: body, signature, photos: pics, note, unlock, entry: scanned ? "qr" : "manual" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 && j.signin) {
        setStaff(null);
        router.replace(`/d/${slug}?next=${encodeURIComponent(id)}`);
        return;
      }
      if (r.status === 403 && j.locked) {
        setSigning(false);
        setData(null);
        load();
        return;
      }
      if (!r.ok) throw new Error(j.error || "تعذّر حفظ الفحص");
      latest.current = null;
      clearDraft(id);
      setSigning(false);
      setSaved({ at: j.submitted_at, compliant: fields.filter((f) => values[f.key] === true).length, nonCompliant: nonCompliant.length });
      window.scrollTo({ top: 0 });
      // Find the next container still waiting in this department.
      fetch(`/api/public/departments/${slug}`, { cache: "no-store" })
        .then((x) => x.json())
        .then((d: { checklists: Checklist[]; state: Record<string, unknown> }) => {
          const n = d.checklists
            .filter((x) => containerOf(x) && x.id !== id && !d.state[x.id])
            .sort((a, b) => a.sort - b.sort)[0];
          const ni = containerOf(n);
          setNext(n && ni ? { id: n.id, location: ni.location, code: ni.code } : null);
        })
        .catch(() => {});
    } catch (err) {
      setSigning(false);
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      // A thrown TypeError means the request never reached the server; anything else carries the server's own Arabic message.
      const reason = err instanceof TypeError ? "تعذّر الوصول إلى الخادم" : (err as Error).message;
      setFailure(offline ? "تعذر الإرسال لعدم وجود اتصال. إجاباتك باقية، أعد المحاولة عند عودة الشبكة." : err instanceof TypeError ? "تعذر الإرسال. إجاباتك باقية، أعد المحاولة." : `${reason}. إجاباتك باقية، أعد المحاولة.`);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (missing)
    return (
      <main className="mx-auto grid w-full max-w-md flex-1 place-items-center px-4">
        <div className="glass p-8 text-center">
          <p className="text-[18px] font-bold">هذه الحاوية غير متاحة</p>
          <p className="mt-1 text-ink-2">قد تكون أُوقفت أو حُذفت.</p>
          <Link href={`/d/${slug}`} className="btn btn-primary mt-5">
            العودة إلى الجولة
          </Link>
        </div>
      </main>
    );

  if (locked)
    return (
      <LockScreen
        slug={slug}
        id={id}
        c={locked.c}
        accounts={locked.accounts}
        staffName={staff?.name}
        onUnlocked={(token) => load(token)}
        onSignIn={() => {
          setStaff(null);
          router.replace(`/d/${slug}?next=${encodeURIComponent(id)}`);
        }}
      />
    );

  if (saved && c) return <SavedView c={c} saved={saved} next={next} slug={slug} department={data?.department.name_ar || data?.department.name_en || ""} />;

  const z = now ? zoned(now) : null;
  const title = info ? info.location : c?.title_ar || c?.title_en;
  const missingCount = fields.filter((f) => f.required && !answered(values[f.key])).length;
  const pct = total ? done / total : 0;

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pb-[calc(176px+env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pb-10">
      <header className="glass-toolbar flex items-center gap-3 px-2 py-2 sm:px-3">
        <Link href={`/d/${slug}`} className="btn btn-ghost btn-sm min-w-0" aria-label={`العودة إلى ${data?.department.name_ar || "القسم"}`}>
          <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
          <span className="truncate">{data?.department.name_ar || data?.department.name_en || "القسم"}</span>
        </Link>
        <span className="flex-1" />
        <LogoTile size={48} />
      </header>

      {/* Container identity */}
      <section className="glass mt-3 p-4 sm:p-6" aria-labelledby="ctn-title">
        <div className="flex items-start gap-4">
          {info ? (
            <KindTile kind={info.kind} size={48} />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] border border-[var(--divider)] bg-raised text-sky">{c && <Icon name={c.icon} className="h-6 w-6" strokeWidth={1.75} />}</span>
          )}
          <div className="min-w-0 flex-1">
            {info && (
              <p className="flex flex-wrap items-center gap-2">
                <CodeBadge code={info.code} className="text-[16px]" />
                <span className="text-[15px] text-ink">{info.kind === "floor" ? "حاوية أرضية" : "حاوية أدوات حادة"}</span>
              </p>
            )}
            <h1 id="ctn-title" className="mt-1 text-[24px] sm:text-[32px]">
              {title ?? <span className="skeleton inline-block h-7 w-48 align-middle" />}
            </h1>
            <p className="text-[14px] text-ink-2">{data?.department.name_ar || data?.department.name_en}{!info && c ? " — سجل تشغيلي" : ""}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Meta k="التاريخ" v={z ? <span className="code">{z.date}</span> : "…"} />
          <Meta k="الوقت" v={z ? <span className="num">{z.timeAr}</span> : "…"} />
          <Meta k="الوردية" v={now ? SHIFT_AR[shiftOf(now)] : "…"} />
          <Meta k="الفاحص" v={staff?.name ?? "…"} />
        </dl>
        <p className="mt-3">
          {scanned ? (
            <span className="chip chip-ok">
              <ScanLine className="h-3.5 w-3.5" aria-hidden /> عبر رمز القسم
            </span>
          ) : (
            <span className="chip">اختيار يدوي</span>
          )}
        </p>
      </section>

      {/* Progress of this form only (not of the department round). */}
      {c && total > 0 && (
        <div className="glass mt-3 px-4 py-3 sm:px-6" role="status" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[16px] font-bold">
              أُجيب عن <span className="num">{done}</span> من <span className="num">{total}</span> {total === 1 ? "بند" : total <= 10 ? "بنود" : "بندًا"}
            </p>
            <p className="num text-[14px] text-ink-2"><bdi dir="ltr">{Math.round(pct * 100)}%</bdi></p>
          </div>
          <div className="meter mt-2" aria-hidden>
            <i style={{ transform: `scaleX(${pct})` }} />
          </div>
        </div>
      )}

      <form onSubmit={review} noValidate className="mt-3 flex flex-col gap-3">
        <section className="glass divide-y divide-[var(--divider)] overflow-hidden" aria-label="بنود الفحص">
          {!c && (
            <div className="grid gap-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[112px]" />
              ))}
            </div>
          )}
          {c &&
            c.fields
              .filter((f) => f.type !== "container")
              .map((f) =>
                f.type === "heading" ? (
                  <h2 key={f.key} className="bg-raised px-4 py-2 text-[16px] text-ink sm:px-6">
                    {f.label_ar || f.label_en}
                  </h2>
                ) : f.type === "check" || f.type === "yesno" ? (
                  <ItemRow
                    key={f.key}
                    f={f}
                    n={fields.indexOf(f) + 1}
                    values={values}
                    error={errors[f.key]}
                    photo={photos[f.key]}
                    container={!!info}
                    onChange={set}
                    onPhoto={(p) => setPhoto(f.key, p)}
                  />
                ) : (
                  <FieldInput key={f.key} f={f} value={values[f.key]} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
                ),
              )}
        </section>

        {!info && c && (
          <div className="glass p-4 sm:p-6">
            <label htmlFor="note" className="label">
              ملاحظة عامة <span className="font-normal text-ink-3">(اختياري)</span>
            </label>
            <textarea id="note" rows={2} className="field resize-none" value={note} onChange={(e) => (touched.current = true, setNote(e.target.value))} />
          </div>
        )}
        {c?.range_note && <p className="px-1 text-[14px] text-ink-2">{c.range_note}</p>}

        {failure && (
          <div className="flex items-start gap-3 rounded-[16px] border border-[rgb(255_180_171/45%)] bg-[var(--danger-surface)] p-4" role="alert">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]" aria-hidden />
            <p className="min-w-0 flex-1 text-[16px] text-[var(--danger)]">{failure}</p>
          </div>
        )}

        {/* Save bar: fixed above the bottom navigation on phones, sticky at the bottom on wider screens. */}
        <div
          data-savebar
          className="glass-toolbar fixed inset-x-0 z-30 rounded-none border-x-0 px-4 py-3 sm:sticky sm:inset-x-auto sm:bottom-4 sm:mt-1 sm:rounded-[18px] sm:border-x"
          style={{ bottom: `calc(64px + env(safe-area-inset-bottom))` }}
        >
          <div className="mx-auto flex max-w-[720px] items-center gap-3">
            <p className="min-w-0 flex-1 text-[14px] leading-snug text-ink-2" aria-live="polite">
              {busy ? (
                <span className="text-ink">جارٍ حفظ الفحص…</span>
              ) : missingCount > 0 ? (
                <span className={Object.keys(errors).length ? "font-bold text-[var(--danger)]" : ""}>{missingText(missingCount)}</span>
              ) : draft !== "none" ? (
                <span className="flex items-center gap-1.5">
                  <HardDriveDownload className="h-4 w-4 shrink-0 text-sky" aria-hidden />
                  {draft === "full" ? "المسودة محفوظة على هذا الجهاز دون الصور" : "المسودة محفوظة على هذا الجهاز"}
                </span>
              ) : (
                "جاهز للحفظ"
              )}
              {nonCompliant.length > 0 && (
                <span className="block text-[var(--warning)]">
                  <span className="num">{nonCompliant.length}</span> غير مطابق
                </span>
              )}
            </p>
            <button className="btn btn-primary shrink-0 px-6" disabled={!c || busy} aria-describedby={undefined}>
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : failure ? <RotateCcw className="h-5 w-5" aria-hidden /> : <Check className="h-5 w-5" strokeWidth={2.6} aria-hidden />}
              {busy ? "جارٍ الحفظ…" : failure ? "إعادة المحاولة" : "حفظ الفحص"}
            </button>
          </div>
        </div>
      </form>

      <SignatureSheet open={signing} busy={busy} name={staff?.name ?? ""} onClose={closeSheet} onConfirm={submit} />
      <StaffNav />
    </main>
  );
}

function missingText(n: number) {
  if (n === 1) return "بقي بند واحد مطلوب";
  if (n === 2) return "بقي بندان مطلوبان";
  if (n <= 10) return `بقيت ${n} بنود مطلوبة`;
  return `بقي ${n} بندًا مطلوبًا`;
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[var(--divider)] bg-[var(--glass-inset)] px-3 py-2">
      <dt className="text-[14px] text-ink-2">{k}</dt>
      <dd className="truncate text-[16px] font-bold">{v}</dd>
    </div>
  );
}

/** Hidden camera input. Phones open the rear camera directly. Preparing the photo can fail; that is reported on its own. */
function useCamera(onPhoto: (jpeg: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      tabIndex={-1}
      aria-hidden
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setBusy(true);
        setFailed(false);
        try {
          onPhoto(await compress(file));
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { open: () => ref.current?.click(), input, busy, failed };
}

async function compress(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.naturalWidth * scale);
    cv.height = Math.round(img.naturalHeight * scale);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    let q = 0.75;
    let out = cv.toDataURL("image/jpeg", q);
    while (out.length > 850_000 && q > 0.3) out = cv.toDataURL("image/jpeg", (q -= 0.15));
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoSlot({ photo, cam, onRemove, required }: { photo?: string; cam: ReturnType<typeof useCamera>; onRemove: () => void; required?: boolean }) {
  if (photo)
    return (
      <div className="flex items-center gap-3 rounded-[12px] border border-[var(--divider)] bg-[var(--glass-inset)] p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="الصورة المرفقة" width={64} height={64} className="h-16 w-16 rounded-[10px] object-cover" />
        <span className="flex-1 text-[14px] font-bold text-[var(--success)]">
          <Check className="inline h-4 w-4" strokeWidth={2.6} aria-hidden /> صورة مرفقة
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={cam.open}>
          <RotateCcw className="h-4 w-4" aria-hidden /> إعادة التصوير
        </button>
        {!required && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onRemove} aria-label="حذف الصورة">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    );
  return (
    <div>
      <button type="button" className={cx("btn w-full", required ? "btn-primary" : "btn-ghost")} onClick={cam.open} disabled={cam.busy}>
        {cam.busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
        {cam.busy ? "جارٍ تجهيز الصورة…" : required ? "التقط صورة (مطلوبة)" : "إرفاق صورة (اختياري)"}
      </button>
      {cam.failed && (
        <p className="mt-2 text-[14px] font-bold text-[var(--danger)]" role="alert">
          تعذّر تجهيز الصورة. بقية الإجابات محفوظة؛ أعد التصوير.
        </p>
      )}
    </div>
  );
}

/**
 * One inspection item: a native single-choice group (radio inputs), nothing pre-selected, and
 * documentation fields that appear under the item when it does not comply.
 */
function ItemRow({
  f,
  n,
  values,
  error,
  photo,
  container,
  onChange,
  onPhoto,
}: {
  f: Field;
  n: number;
  values: Record<string, FieldValue>;
  error?: string;
  photo?: string;
  container: boolean;
  onChange: (k: string, v: FieldValue) => void;
  onPhoto: (p: string | null) => void;
}) {
  const reduce = useReducedMotion();
  const cam = useCamera((p) => onPhoto(p));
  const value = values[f.key];
  const label = f.label_ar || f.label_en;
  const id = `f-${f.key}`;
  const options = [
    { v: true, text: f.type === "yesno" ? "نعم" : "مطابق", Ico: Check, on: "border-[var(--success)] bg-[var(--success-surface)] text-[var(--success)]" },
    { v: false, text: f.type === "yesno" ? "لا" : "غير مطابق", Ico: X, on: "border-[var(--danger)] bg-[var(--danger-surface)] text-[var(--danger)]" },
  ];
  return (
    <fieldset id={id} tabIndex={-1} className={cx("p-4 outline-none sm:px-6", error && "bg-[rgb(54_31_38/55%)]")} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-e` : undefined}>
      <legend className="float-start mb-3 flex w-full gap-2.5 text-[18px] font-bold leading-[1.6]">
        <span className="num mt-1 grid h-6 min-w-6 shrink-0 place-items-center rounded-full border border-[var(--divider)] px-1 text-[13px] text-ink-2" aria-hidden>
          {n}
        </span>
        <span>
          {label}
          {f.qty && <span className="ms-2 text-[14px] font-normal text-ink-2">الكمية {f.qty}</span>}
          {f.photo && <Camera className="ms-1.5 inline h-4 w-4 text-ink-2" aria-label="يتطلب صورة" />}
        </span>
      </legend>
      <div className="clear-both grid grid-cols-2 gap-2">
        {options.map((o) => {
          const checked = value === o.v;
          return (
            <label
              key={String(o.v)}
              className={cx(
                "relative flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border px-3 py-2 text-center text-[16px] font-bold transition-colors duration-[160ms] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]",
                checked ? o.on : "border-[var(--control-border)] bg-[var(--glass-inset)] text-ink hover:border-ink-2",
              )}
            >
              <input
                type="radio"
                name={f.key}
                className="sr-only"
                checked={checked}
                onChange={() => {
                  onChange(f.key, o.v);
                  if (o.v && f.photo && !photo) cam.open();
                }}
              />
              {/* Unselected answers show no tick, so nothing looks chosen until the inspector chooses it. */}
              {checked ? <o.Ico className="h-5 w-5 shrink-0" strokeWidth={2.6} aria-hidden /> : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--control-border)]" aria-hidden />}
              {o.text}
            </label>
          );
        })}
      </div>
      {cam.input}
      {f.photo && value === true && (
        <div className="mt-3">
          <PhotoSlot photo={photo} cam={cam} onRemove={() => onPhoto(null)} required />
        </div>
      )}
      {value === false && (
        <motion.div
          className="mt-3 grid gap-3 rounded-[12px] border border-[rgb(255_180_171/30%)] bg-[rgb(54_31_38/55%)] p-3"
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          aria-label={`ملاحظة على: ${label}`}
          role="group"
        >
          <div>
            <label htmlFor={`${id}-n`} className="label">
              وصف الملاحظة {container ? <span className="text-[var(--danger)]">*</span> : <span className="font-normal text-ink-2">(اختياري)</span>}
            </label>
            {container && (
              <p id={`${id}-nh`} className="-mt-1 mb-1.5 text-[14px] text-ink-2">
                مطلوب لأن البند غير مطابق، حتى تتمكن الإدارة من متابعته.
              </p>
            )}
            <textarea
              id={`${id}-n`}
              rows={2}
              className="field resize-none"
              enterKeyHint="next"
              aria-describedby={container ? `${id}-nh` : undefined}
              value={String(values[obsKey(f.key, "note")] ?? "")}
              onChange={(e) => onChange(obsKey(f.key, "note"), e.target.value)}
              aria-invalid={(!!error && error !== "اختر الإجابة") || undefined}
            />
          </div>
          <div>
            <label htmlFor={`${id}-a`} className="label">
              الإجراء الفوري <span className="font-normal text-ink-2">(اختياري)</span>
            </label>
            <input id={`${id}-a`} className="field" enterKeyHint="done" value={String(values[obsKey(f.key, "action")] ?? "")} onChange={(e) => onChange(obsKey(f.key, "action"), e.target.value)} />
          </div>
          {!f.photo && <PhotoSlot photo={photo} cam={cam} onRemove={() => onPhoto(null)} />}
        </motion.div>
      )}
      {error && (
        <p id={`${id}-e`} className="mt-2 flex items-center gap-1.5 text-[14px] font-bold text-[var(--danger)]" role="alert">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </fieldset>
  );
}

function FieldInput({ f, value, error, onChange }: { f: Field; value: FieldValue | undefined; error?: string; onChange: (v: FieldValue) => void }) {
  const id = `f-${f.key}`;
  const out = isOutOfRange(f, value ?? null);
  const range = rangeLabel(f);
  return (
    <div className="p-4 sm:px-6">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="mb-2 block text-[18px] font-bold leading-[1.6] text-ink">
          {f.label_ar || f.label_en}
          {f.required && <span className="text-[var(--danger)]"> *</span>}
        </label>
        {range && (
          <span className="text-[14px] text-ink-2">
            المدى <span className="code">{range}</span>
          </span>
        )}
      </div>
      {f.type === "number" && (
        <div className="relative">
          <input
            id={id}
            className="field num font-bold"
            dir="ltr"
            inputMode="decimal"
            step="any"
            type="number"
            value={(value as string | number | undefined) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error || undefined}
          />
          {f.unit && <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-2">{f.unit === "kg" ? "كجم" : f.unit}</span>}
        </div>
      )}
      {f.type === "text" && <input id={id} className="field" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} />}
      {f.type === "select" && (
        <select id={id} className="field" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined}>
          <option value="">اختر…</option>
          {f.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
      {out && (
        <p className="mt-2 flex items-center gap-1.5 text-[14px] font-bold text-[var(--warning)]">
          <TriangleAlert className="h-4 w-4" aria-hidden /> خارج المدى المعتمد، ستُسجَّل ملاحظة للمتابعة
        </p>
      )}
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[14px] font-bold text-[var(--danger)]" role="alert">
          <CircleAlert className="h-4 w-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

/** After the service confirms: what was recorded, kept apart from what still needs follow-up, and where to go next. */
function SavedView({ c, saved, next, slug, department }: { c: Checklist; saved: Saved; next: Next; slug: string; department: string }) {
  const info = containerOf(c);
  const reduce = useReducedMotion();
  const z = zoned(saved.at);
  return (
    <main className="mx-auto grid w-full max-w-[520px] flex-1 content-center px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-10">
      <motion.section
        className="glass p-6"
        role="status"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--success-surface)] text-[var(--success)]">
            <Check className="h-7 w-7" strokeWidth={2.6} aria-hidden />
          </span>
          <h1 className="text-[24px]">حُفظ الفحص</h1>
        </div>
        <dl className="mt-5 grid gap-3 text-[16px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">الحاوية</dt>
            <dd className="flex items-center gap-2 font-bold">
              {info ? (
                <>
                  {info.location} <CodeBadge code={info.code} />
                </>
              ) : (
                c.title_ar || c.title_en
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">القسم</dt>
            <dd className="font-bold">{department}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">الوقت</dt>
            <dd className="font-bold">
              <span className="code">{z.date}</span> <span className="num">{z.timeAr}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">النتيجة</dt>
            <dd className="flex flex-wrap justify-end gap-2">
              <span className="chip chip-ok">
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden /> <span className="num">{saved.compliant}</span> مطابق
              </span>
              {saved.nonCompliant > 0 && (
                <span className="chip chip-bad">
                  <X className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden /> <span className="num">{saved.nonCompliant}</span> غير مطابق
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">الملاحظات</dt>
            <dd>
              {saved.nonCompliant > 0 ? (
                <span className="chip chip-warn">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> <span className="num">{saved.nonCompliant}</span> ملاحظة مفتوحة
                </span>
              ) : (
                <span className="text-ink-2">لا توجد</span>
              )}
            </dd>
          </div>
        </dl>
        {saved.nonCompliant > 0 && <p className="mt-4 text-[14px] text-ink-2">اكتمل الفحص، وتبقى الملاحظة مفتوحة لدى الإدارة حتى تُعالج وتُغلق.</p>}
        <div className="mt-6 grid gap-2">
          {next ? (
            <Link href={`/d/${slug}/${next.id}`} className="btn btn-primary">
              الحاوية التالية: {next.location}
            </Link>
          ) : (
            <p className="text-center text-[15px] text-[var(--success)]">لا توجد حاويات متبقية في هذا القسم.</p>
          )}
          <Link href={`/d/${slug}`} className={next ? "btn btn-ghost" : "btn btn-primary"}>
            <ListChecks className="h-5 w-5" aria-hidden /> العودة للقسم
          </Link>
        </div>
      </motion.section>
      <StaffNav />
    </main>
  );
}

function LockScreen({
  slug,
  id,
  c,
  accounts,
  staffName,
  onUnlocked,
  onSignIn,
}: {
  slug: string;
  id: string;
  c: Pick<Checklist, "title_en" | "title_ar" | "icon" | "color">;
  accounts: boolean;
  staffName?: string;
  onUnlocked: (token: string) => void;
  onSignIn: () => void;
}) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/public/checklists/${id}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 && j.signin) return onSignIn();
      if (!r.ok) throw new Error(j.error || "كلمة المرور غير صحيحة");
      onUnlocked(j.token);
    } catch (x) {
      setErr((x as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <header className="py-2">
        <Link href={`/d/${slug}`} className="btn btn-ghost btn-sm">
          <ArrowRight className="h-4 w-4" aria-hidden /> العودة إلى الجولة
        </Link>
      </header>
      <Rise className="glass-strong mt-6 p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] border border-[var(--divider)] bg-raised text-sky">
          <Lock className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-[20px]">{c.title_ar || c.title_en}</h1>
        {accounts ? (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <p className="text-[14.5px] text-ink-2">هذا البند مقفل. أدخل كلمة مرورك لفتحه.</p>
            {staffName && (
              <p className="flex items-center justify-center gap-1.5 font-bold">
                <UserRound className="h-4 w-4 text-ink-3" aria-hidden /> {staffName}
              </p>
            )}
            <input
              className="field text-center"
              type="password"
              autoComplete="current-password"
              autoFocus
              aria-label="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {err && (
              <p className="text-[14px] font-bold text-danger" role="alert">
                {err}
              </p>
            )}
            <button className="btn btn-primary h-[52px]" disabled={busy || !password}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />} فتح
            </button>
            <button type="button" className="btn btn-ghost btn-sm mx-auto" onClick={onSignIn}>
              لست {staffName ?? "أنت"}؟ سجّل الدخول بحسابك
            </button>
          </form>
        ) : (
          <p className="mt-4 rounded-[12px] bg-[var(--warning-surface)] p-4 text-[15px] text-[var(--warning)]">
            هذا البند يحتاج حساب موظف. اطلب من الإدارة إنشاء حسابك ثم سجّل الدخول.
          </p>
        )}
      </Rise>
    </main>
  );
}

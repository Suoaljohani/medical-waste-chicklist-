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
import { containerOf, isInfoField, KIND } from "@/lib/containers";
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
    const write = () => setDraft(writeDraft(id, { values, photos, note, at: Date.now(), by: staff.name }) ? "local" : "full");
    latest.current = write;
    const t = setTimeout(write, 250);
    return () => clearTimeout(t);
  }, [values, photos, note, restored, staff, id, saved]);
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
    if (!c || !staff) return;
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
      setFailure(offline ? "لا يوجد اتصال بالشبكة. إجاباتك محفوظة على الجهاز؛ أعد المحاولة عند عودة الاتصال." : `${reason}. إجاباتك محفوظة على الجهاز؛ أعد المحاولة.`);
    } finally {
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

  if (saved && c) return <SavedView c={c} saved={saved} next={next} slug={slug} />;

  const z = now ? zoned(now) : null;
  const title = info ? info.location : c?.title_ar || c?.title_en;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-[max(12px,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center gap-3 py-2">
        <Link href={`/d/${slug}`} className="btn btn-ghost btn-sm" aria-label="العودة إلى الجولة">
          <ArrowRight className="h-4 w-4" aria-hidden />
          <span className="max-w-[46vw] truncate">{data?.department.name_ar || data?.department.name_en || "الجولة"}</span>
        </Link>
        <span className="flex-1" />
        <LogoTile size={40} />
      </header>

      <Rise className="glass mt-3 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {info ? (
            <KindTile kind={info.kind} size={60} />
          ) : (
            <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-[18px] bg-sky/10 text-sky">{c && <Icon name={c.icon} className="h-7 w-7" />}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] text-ink-2">{info ? KIND[info.kind].ar : c ? "قائمة تشييك" : "\u00a0"}</p>
            <h1 className="text-[23px] leading-snug sm:text-[26px]">{title ?? <span className="skeleton inline-block h-7 w-48 align-middle" />}</h1>
            {info && (
              <p className="mt-1.5">
                <CodeBadge code={info.code} className="text-[14px]" />
              </p>
            )}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-[13.5px] sm:grid-cols-4">
          <Meta k="التاريخ" v={z ? <span className="num" dir="ltr">{z.date}</span> : "…"} />
          <Meta k="الوقت" v={z ? <span className="num">{z.timeAr}</span> : "…"} />
          <Meta k="الوردية" v={now ? SHIFT_AR[shiftOf(now)] : "…"} />
          <Meta k="الفاحص" v={staff?.name ?? "…"} />
        </dl>
        <p className="mt-3">
          {scanned ? (
            <span className="chip chip-ok">
              <ScanLine className="h-3.5 w-3.5" aria-hidden /> القسم مؤكَّد بمسح الباركود
            </span>
          ) : (
            <span className="chip">القسم مختار يدويًا</span>
          )}
        </p>
      </Rise>

      <form onSubmit={review} noValidate className="mt-4 flex flex-col gap-3 pb-6">
        {draft !== "none" && done > 0 && (
          <p className="flex items-center gap-2 px-1 text-[13px] text-ink-2" role="status">
            <HardDriveDownload className="h-4 w-4 shrink-0 text-sky" aria-hidden />
            {draft === "full" ? "مساحة الجهاز ممتلئة: الإجابات محفوظة دون الصور حتى الحفظ النهائي." : "الإجابات محفوظة مؤقتًا على هذا الجهاز ولم تُرسل بعد."}
          </p>
        )}

        <section className="glass p-2 sm:p-3" aria-label="بنود الفحص">
          {!c && (
            <div className="grid gap-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[104px]" />
              ))}
            </div>
          )}
          {c &&
            c.fields
              .filter((f) => f.type !== "container")
              .map((f) =>
                f.type === "heading" ? (
                  <h2 key={f.key} className="px-3 pb-1 pt-3 text-[14.5px] text-sky">
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
          <div className="glass p-4">
            <label htmlFor="note" className="label">
              ملاحظة عامة <span className="font-normal text-ink-3">(اختياري)</span>
            </label>
            <textarea id="note" rows={2} className="field resize-none" value={note} onChange={(e) => (touched.current = true, setNote(e.target.value))} />
          </div>
        )}
        {c?.range_note && <p className="px-1 text-[13px] text-ink-3">{c.range_note}</p>}

        {failure && (
          <div className="glass-strong flex items-start gap-3 p-4" role="alert">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-danger">لم يُحفظ الفحص</p>
              <p className="mt-0.5 text-[14px] text-ink-2">{failure}</p>
            </div>
          </div>
        )}

        <div className="glass-thin sticky bottom-[max(10px,env(safe-area-inset-bottom))] z-10 mt-2 flex items-center gap-3 p-2.5 ps-4" style={{ borderRadius: 22 }}>
          <p className="min-w-0 flex-1 text-[13.5px] leading-tight text-ink-2" aria-live="polite">
            أُجيب <span className="num font-bold text-ink">{done}</span> من <span className="num">{total}</span>
            {nonCompliant.length > 0 && (
              <>
                <br />
                <span className="text-warn">
                  <span className="num">{nonCompliant.length}</span> غير مطابق
                </span>
              </>
            )}
          </p>
          <button className="btn btn-primary h-[52px] px-6 text-[15.5px]" disabled={!c || busy}>
            {failure ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />}
            {failure ? "إعادة المحاولة" : "حفظ الفحص"}
          </button>
        </div>
      </form>

      <SignatureSheet open={signing} busy={busy} name={staff?.name ?? ""} onClose={closeSheet} onConfirm={submit} />
    </main>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-ink/[0.045] px-3 py-2">
      <dt className="text-[12px] text-ink-3">{k}</dt>
      <dd className="truncate font-bold">{v}</dd>
    </div>
  );
}

/** Hidden camera input. Phones open the rear camera directly. */
function useCamera(onPhoto: (jpeg: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
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
        try {
          onPhoto(await compress(file));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { open: () => ref.current?.click(), input, busy };
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
      <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-2 ring-1 ring-ink/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="الصورة المرفقة" className="h-16 w-16 rounded-xl object-cover" />
        <span className="flex-1 text-[13.5px] font-bold text-green">
          <Check className="inline h-4 w-4" strokeWidth={2.6} aria-hidden /> صورة مرفقة
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={cam.open}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> إعادة
        </button>
        {!required && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onRemove} aria-label="حذف الصورة">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    );
  return (
    <button type="button" className={cx("btn w-full", required ? "btn-primary" : "btn-ghost")} onClick={cam.open} disabled={cam.busy}>
      {cam.busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
      {required ? "التقط صورة (مطلوبة)" : "إرفاق صورة (اختياري)"}
    </button>
  );
}

/** One inspection item: two large answers, and documentation when it does not comply. */
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
  const yes = f.type === "yesno" ? "نعم" : "مطابق";
  const no = f.type === "yesno" ? "لا" : "غير مطابق";
  const id = `f-${f.key}`;
  return (
    <div
      id={id}
      tabIndex={-1}
      className={cx(
        "rounded-[18px] p-3 outline-none transition-colors duration-200",
        error ? "bg-danger/[0.06] ring-1 ring-danger/40" : value === false ? "bg-[rgba(214,138,14,.07)]" : "",
      )}
    >
      <p className="flex gap-2.5 text-[16px] font-bold leading-snug" id={`${id}-l`}>
        <span className="num mt-0.5 grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-ink/[0.07] px-1 text-[12px] text-ink-2" aria-hidden>
          {n}
        </span>
        <span>
          {label}
          {f.qty && <span className="ms-2 text-[13px] font-normal text-ink-3">الكمية {f.qty}</span>}
          {f.photo && <Camera className="ms-1.5 inline h-4 w-4 text-ink-3" aria-label="يتطلب صورة" />}
        </span>
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby={`${id}-l`} aria-invalid={!!error || undefined}>
        {[true, false].map((v) => {
          const on = value === v;
          return (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                onChange(f.key, v);
                if (v && f.photo && !photo) cam.open();
              }}
              className={cx(
                "btn h-[54px] border text-[15.5px]",
                on
                  ? v
                    ? "border-green/40 bg-[rgba(6,122,91,.12)] text-green"
                    : "border-[#d68a0e]/50 bg-[rgba(214,138,14,.16)] text-warn"
                  : "border-ink/12 bg-white/75 text-ink-2",
              )}
            >
              {v ? <Check className="h-5 w-5" strokeWidth={2.6} aria-hidden /> : <X className="h-5 w-5" strokeWidth={2.6} aria-hidden />}
              {v ? yes : no}
            </button>
          );
        })}
      </div>
      {cam.input}
      {f.photo && value === true && (
        <div className="mt-2.5">
          <PhotoSlot photo={photo} cam={cam} onRemove={() => onPhoto(null)} required />
        </div>
      )}
      {value === false && (
        <motion.div
          className="mt-3 grid gap-2.5"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          <div>
            <label htmlFor={`${id}-n`} className="label">
              ماذا لاحظت؟ {container ? <span className="text-danger">*</span> : <span className="font-normal text-ink-3">(اختياري)</span>}
            </label>
            <textarea
              id={`${id}-n`}
              rows={2}
              className="field resize-none"
              enterKeyHint="next"
              value={String(values[obsKey(f.key, "note")] ?? "")}
              onChange={(e) => onChange(obsKey(f.key, "note"), e.target.value)}
              aria-invalid={(!!error && error !== "اختر الإجابة") || undefined}
            />
          </div>
          <div>
            <label htmlFor={`${id}-a`} className="label">
              الإجراء المتخذ في الموقع <span className="font-normal text-ink-3">(اختياري)</span>
            </label>
            <input id={`${id}-a`} className="field" enterKeyHint="done" value={String(values[obsKey(f.key, "action")] ?? "")} onChange={(e) => onChange(obsKey(f.key, "action"), e.target.value)} />
          </div>
          {!f.photo && <PhotoSlot photo={photo} cam={cam} onRemove={() => onPhoto(null)} />}
        </motion.div>
      )}
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-bold text-danger" role="alert">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

function FieldInput({ f, value, error, onChange }: { f: Field; value: FieldValue | undefined; error?: string; onChange: (v: FieldValue) => void }) {
  const id = `f-${f.key}`;
  const out = isOutOfRange(f, value ?? null);
  const range = rangeLabel(f);
  return (
    <div className="p-3">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label !text-[15.5px] !text-ink">
          {f.label_ar || f.label_en}
          {f.required && <span className="text-danger"> *</span>}
        </label>
        {range && (
          <span className="text-[12.5px] text-ink-3">
            المدى <span className="num" dir="ltr">{range}</span>
          </span>
        )}
      </div>
      {f.type === "number" && (
        <div className="relative">
          <input
            id={id}
            className="field num text-[19px] font-bold"
            dir="ltr"
            inputMode="decimal"
            step="any"
            type="number"
            value={(value as string | number | undefined) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error || undefined}
          />
          {f.unit && <span className="pointer-events-none absolute end-auto start-4 top-1/2 -translate-y-1/2 text-ink-3">{f.unit}</span>}
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
        <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-bold text-warn">
          <TriangleAlert className="h-4 w-4" aria-hidden /> خارج المدى المعتمد، ستُسجَّل ملاحظة للمتابعة
        </p>
      )}
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-bold text-danger" role="alert">
          <CircleAlert className="h-4 w-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

/** After saving: what was recorded, kept apart from what still needs follow-up, and where to go next. */
function SavedView({ c, saved, next, slug }: { c: Checklist; saved: Saved; next: Next; slug: string }) {
  const info = containerOf(c);
  const reduce = useReducedMotion();
  const z = zoned(saved.at);
  return (
    <main className="mx-auto grid w-full max-w-md flex-1 content-center px-4 py-10">
      <motion.section
        className="glass-strong p-6 text-center"
        role="status"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <svg viewBox="0 0 64 64" className="mx-auto h-16 w-16" aria-hidden>
          <circle cx="32" cy="32" r="29" fill="rgba(6,122,91,.12)" />
          <motion.path
            d="M20 33 L28.5 41.5 L45 24"
            fill="none"
            stroke="var(--green)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.32, ease: EASE, delay: 0.08 }}
          />
        </svg>
        <h1 className="mt-3 text-[23px]">حُفظ الفحص</h1>
        <p className="mt-1 text-ink-2">
          {info ? (
            <>
              {info.location} <CodeBadge code={info.code} />
            </>
          ) : (
            c.title_ar || c.title_en
          )}
        </p>
        <p className="mt-1 text-[13px] text-ink-3">
          {z.dayAr} <span className="num" dir="ltr">{z.date}</span> — <span className="num">{z.timeAr}</span>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="chip chip-ok">
            <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden /> <span className="num">{saved.compliant}</span> مطابق
          </span>
          {saved.nonCompliant > 0 && (
            <span className="chip chip-warn">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> <span className="num">{saved.nonCompliant}</span> غير مطابق
            </span>
          )}
        </div>
        {saved.nonCompliant > 0 && (
          <p className="mt-3 rounded-xl bg-[rgba(214,138,14,.12)] px-3 py-2 text-[13.5px] text-warn">
            اكتمل الفحص، وسُجّلت الملاحظات مفتوحة لدى الإدارة حتى تُعالَج.
          </p>
        )}
        <div className="mt-6 grid gap-2">
          {next && (
            <Link href={`/d/${slug}/${next.id}`} className="btn btn-primary h-[54px] text-[15.5px]">
              الحاوية التالية: {next.location}
            </Link>
          )}
          <Link href={`/d/${slug}`} className={next ? "btn btn-ghost" : "btn btn-primary h-[54px]"}>
            <ListChecks className="h-4 w-4" aria-hidden /> العودة إلى الجولة
          </Link>
        </div>
      </motion.section>
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
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-sky/10 text-sky">
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
          <p className="mt-4 rounded-xl bg-[rgba(214,138,14,.12)] p-4 text-[14.5px] text-warn">
            هذا البند يحتاج حساب موظف. اطلب من الإدارة إنشاء حسابك ثم سجّل الدخول.
          </p>
        )}
      </Rise>
    </main>
  );
}

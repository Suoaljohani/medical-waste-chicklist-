/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Camera, CheckCheck, ChevronLeft, Clock, LoaderCircle, Search, TriangleAlert, Wrench } from "lucide-react";
import { CodeBadge, KindTile } from "@/components/container-bits";
import { Modal } from "@/components/modal";
import { obsKey, OBS_STATUS } from "@/lib/observations";
import type { Observation, ObservationStatus, Submission } from "@/lib/types";
import { agoAr, cx, zoned } from "@/lib/utils";
import { useToast } from "../admin-shell";
import { api, PageTitle, useData } from "../use-data";

type Data = { days: number; departments: { id: string; name: string }[]; observations: Observation[] };
type Filter = "pending" | ObservationStatus | "all";

const STATUS_ICON = { open: TriangleAlert, progress: Wrench, closed: CheckCheck };
const STATUS_CHIP = { open: "chip-warn", progress: "chip-info", closed: "chip-ok" };

export function Observations() {
  const params = useSearchParams();
  const router = useRouter();
  const [days, setDays] = useState(30);
  const { data, error, reload } = useData<Data>(`/api/admin/observations?days=${days}`);
  const [filter, setFilter] = useState<Filter>("pending");
  const [dep, setDep] = useState("");
  const [q, setQ] = useState("");
  const selected = params.get("id");

  const rows = useMemo(() => {
    const s = q.trim();
    return (data?.observations ?? [])
      .filter((o) => (filter === "all" ? true : filter === "pending" ? o.status !== "closed" : o.status === filter))
      .filter((o) => !dep || o.department_id === dep)
      .filter((o) => !s || [o.label_ar, o.note, o.action, o.followup, o.employee_name, o.container?.code ?? "", o.container?.location ?? ""].some((x) => x.includes(s) || x.toLowerCase().includes(s.toLowerCase())))
      .sort((a, b) => (filter === "pending" ? (a.submitted_at < b.submitted_at ? -1 : 1) : a.submitted_at < b.submitted_at ? 1 : -1));
  }, [data, filter, dep, q]);

  const count = (f: Filter) => (data?.observations ?? []).filter((o) => (f === "all" ? true : f === "pending" ? o.status !== "closed" : o.status === f)).length;
  const current = data?.observations.find((o) => o.id === selected) ?? null;
  const select = (id: string | null) => router.replace(id ? `/admin/observations?id=${encodeURIComponent(id)}` : "/admin/observations", { scroll: false });

  return (
    <div>
      <PageTitle title="الملاحظات والمتابعة" sub="كل بند غير مطابق يبقى هنا حتى تُغلق متابعته. اكتمال الفحص لا يغلق الملاحظة.">
        <select className="field sm w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="الفترة">
          <option value={7}>آخر 7 أيام</option>
          <option value={30}>آخر 30 يومًا</option>
          <option value={90}>آخر 90 يومًا</option>
        </select>
      </PageTitle>

      <div className="glass flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="seg scroll-thin shrink-0 overflow-x-auto [&>button]:flex-none [&>button]:px-3.5" role="group" aria-label="حالة المتابعة">
          {(
            [
              ["pending", "تنتظر المعالجة"],
              ["open", "مفتوحة"],
              ["progress", "قيد المعالجة"],
              ["closed", "مغلقة"],
              ["all", "الكل"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {l} <span className="num text-ink-3">{data ? count(k) : ""}</span>
            </button>
          ))}
        </div>
        <select className="field sm md:w-56" value={dep} onChange={(e) => setDep(e.target.value)} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {data?.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <label className="relative flex-1">
          <span className="sr-only">بحث</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field sm ps-9" type="search" placeholder="بحث برقم الحاوية أو الموقع أو النص" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {error && !data && (
        <p className="glass mt-4 p-6 text-center" role="alert">
          تعذّر تحميل الملاحظات. <button className="font-bold text-sky underline" onClick={reload}>إعادة المحاولة</button>
        </p>
      )}

      <div className="glass-strong mt-4 overflow-x-auto">
        <table className="table min-w-[860px]">
          <thead>
            <tr>
              <th>الحالة</th>
              <th>البند والملاحظة</th>
              <th>الحاوية</th>
              <th>القسم</th>
              <th>سُجّلت</th>
              <th>
                <span className="sr-only">فتح</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!data &&
              [0, 1, 2, 3].map((i) => (
                <tr key={i}>
                  <td colSpan={6}>
                    <div className="skeleton h-10" />
                  </td>
                </tr>
              ))}
            {data && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-ink-2">
                  {filter === "pending" ? "لا توجد ملاحظات تنتظر المعالجة في هذه الفترة." : "لا توجد ملاحظات تطابق التصفية."}
                </td>
              </tr>
            )}
            {rows.map((o) => {
              const I = STATUS_ICON[o.status];
              return (
                <tr key={o.id} className={cx("cursor-pointer", selected === o.id && "bg-sky/[0.06]")} onClick={() => select(o.id)}>
                  <td>
                    <span className={cx("chip", STATUS_CHIP[o.status])}>
                      <I className="h-3.5 w-3.5" aria-hidden /> {OBS_STATUS[o.status].ar}
                    </span>
                  </td>
                  <td className="max-w-[340px]">
                    <p className="font-bold">{o.label_ar}</p>
                    {o.note && <p className="truncate text-[13.5px] text-ink-2">{o.note}</p>}
                    {o.has_photo && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-ink-3">
                        <Camera className="h-3.5 w-3.5" aria-hidden /> صورة مرفقة
                      </span>
                    )}
                  </td>
                  <td>
                    {o.container ? (
                      <span className="flex items-center gap-2">
                        <KindTile kind={o.container.kind} size={30} />
                        <span>
                          <span className="block text-[13.5px] font-bold">{o.container.location}</span>
                          <CodeBadge code={o.container.code} />
                        </span>
                      </span>
                    ) : (
                      <span className="text-[13.5px]">{o.checklist_title}</span>
                    )}
                  </td>
                  <td>{o.department}</td>
                  <td className="whitespace-nowrap text-[13.5px]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-ink-3" aria-hidden /> {agoAr(o.submitted_at)}
                    </span>
                    <span className="text-ink-3">{o.employee_name}</span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`متابعة: ${o.label_ar}`} onClick={() => select(o.id)}>
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FollowUp o={current} onClose={() => select(null)} onSaved={reload} />
    </div>
  );
}

function FollowUp({ o, onClose, onSaved }: { o: Observation | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<ObservationStatus>("open");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<Submission | null>(null);

  useEffect(() => {
    if (!o) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form for the chosen note
    setStatus(o.status);
    setText(o.followup);
    setSub(null);
    fetch(`/api/admin/submissions/${o.submission_id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSub(j?.submission ?? null))
      .catch(() => {});
  }, [o]);

  async function save() {
    if (!o) return;
    if (status === "closed" && !text.trim()) return toast("اكتب ما تم قبل إغلاق الملاحظة", "error");
    setBusy(true);
    try {
      await api(`/api/admin/submissions/${o.submission_id}`, "PATCH", {
        values: { [obsKey(o.key, "st")]: status, [obsKey(o.key, "fu")]: text.trim(), [obsKey(o.key, "at")]: new Date().toISOString() },
      });
      toast(status === "closed" ? "أُغلقت الملاحظة" : "حُفظت المتابعة");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const photo = o && sub?.photos?.[o.key];
  return (
    <Modal
      open={!!o}
      onClose={onClose}
      busy={busy}
      title="متابعة الملاحظة"
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            حفظ المتابعة
          </button>
        </>
      }
    >
      {o && (
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div>
            <div className="flex items-center gap-3">
              {o.container && <KindTile kind={o.container.kind} size={44} />}
              <div>
                <p className="font-bold">{o.container ? o.container.location : o.checklist_title}</p>
                <p className="flex items-center gap-2 text-[13px] text-ink-3">
                  {o.department} {o.container && <CodeBadge code={o.container.code} />}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-[14.5px]">
              <div>
                <dt className="text-[12.5px] text-ink-3">البند غير المطابق</dt>
                <dd className="font-bold">{o.label_ar}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-ink-3">ملاحظة الموظف</dt>
                <dd>{o.note || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-ink-3">الإجراء في الموقع</dt>
                <dd>{o.action || "لم يُسجَّل إجراء"}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-ink-3">سجّلها</dt>
                <dd>
                  {o.employee_name} — {zoned(o.submitted_at).dayAr} <span className="num" dir="ltr">{zoned(o.submitted_at).date}</span> {zoned(o.submitted_at).timeAr}
                </dd>
              </div>
            </dl>
            <Link href={`/admin/records?open=${o.submission_id}`} className="btn btn-ghost btn-sm mt-3">
              عرض الفحص كاملًا
            </Link>
          </div>
          <div>
            {photo ? (
              <a href={photo} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl ring-1 ring-ink/10">
                <img src={photo} alt={`صورة: ${o.label_ar}`} className="aspect-square w-full object-cover" />
              </a>
            ) : (
              <div className="grid aspect-square place-items-center rounded-2xl bg-ink/[0.04] text-center text-[13.5px] text-ink-3">{o.has_photo && !sub ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="جارٍ تحميل الصورة" /> : "لا توجد صورة"}</div>
            )}
          </div>
          <fieldset className="md:col-span-2">
            <legend className="label">حالة المتابعة</legend>
            <div className="seg" role="radiogroup" aria-label="حالة المتابعة">
              {(["open", "progress", "closed"] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)}>
                  {OBS_STATUS[s].ar}
                </button>
              ))}
            </div>
            <label htmlFor="fu" className="label mt-4">
              ما الذي تم؟ {status === "closed" && <span className="text-danger">*</span>}
            </label>
            <textarea id="fu" rows={3} className="field resize-none" value={text} onChange={(e) => setText(e.target.value)} />
            {o.updated_at && <p className="mt-1.5 text-[12.5px] text-ink-3">آخر تحديث {agoAr(o.updated_at)}</p>}
          </fieldset>
        </div>
      )}
    </Modal>
  );
}

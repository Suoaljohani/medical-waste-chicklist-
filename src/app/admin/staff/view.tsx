"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, Pencil, Plus, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { Modal } from "@/components/modal";
import { EASE } from "@/components/motion";
import type { Employee } from "@/lib/types";
import { cx } from "@/lib/utils";
import { useToast } from "../admin-shell";
import { api, PageTitle, useData } from "../use-data";

type Draft = Partial<Employee> & { password?: string };

export function StaffPage() {
  const toast = useToast();
  const { data, reload, setData } = useData<Employee[]>("/api/admin/employees");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const rows = (data ?? []).filter(
    (e) => !q || `${e.name} ${e.name_ar} ${e.employee_no} ${e.job_title}`.toLowerCase().includes(q.toLowerCase()),
  );
  const activeCount = (data ?? []).filter((e) => e.active).length;

  async function save() {
    if (!draft) return;
    setErr("");
    setBusy(true);
    try {
      const body = { ...draft, password: draft.password || undefined };
      if (draft.id) await api(`/api/admin/employees/${draft.id}`, "PATCH", body);
      else await api("/api/admin/employees", "POST", body);
      toast(draft.id ? "حُفظ الموظف" : "أُضيف الموظف");
      setDraft(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(e: Employee) {
    setData((x) => x?.map((y) => (y.id === e.id ? { ...y, active: !e.active } : y)) ?? null);
    try {
      await api(`/api/admin/employees/${e.id}`, "PATCH", { active: !e.active });
      toast(e.active ? "أُوقف الحساب" : "فُعّل الحساب");
    } catch (x) {
      toast((x as Error).message, "error");
      reload();
    }
  }

  async function remove(e: Employee) {
    if (!confirm(`حذف حساب ${e.name}؟ تبقى فحوصه السابقة محفوظة.`)) return;
    try {
      await api(`/api/admin/employees/${e.id}`, "DELETE");
      setData((x) => x?.filter((y) => y.id !== e.id) ?? null);
      toast("حُذف الحساب");
    } catch (x) {
      toast((x as Error).message, "error");
    }
  }

  return (
    <div>
      <PageTitle title="الموظفون" sub={data ? `${activeCount} حساب مفعّل` : "حسابات الموظفين"}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setErr("");
            setDraft({ name: "", name_ar: "", employee_no: "", job_title: "", password: "", active: true });
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> إضافة موظف
        </button>
      </PageTitle>

      <div className="glass mb-4 flex items-start gap-3 p-4 text-[14px] text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky" aria-hidden />
        {activeCount > 0 ? (
          <p>يدخل الموظف برقمه الوظيفي وكلمة المرور قبل الجولة، ويُسجَّل اسمه مع كل فحص تلقائيًا.</p>
        ) : (
          <p>لا توجد حسابات بعد، فيكتب الموظف اسمه فقط. عند إضافة أول موظف يصبح الدخول بالحساب إلزاميًا للجميع.</p>
        )}
      </div>

      {(data?.length ?? 0) > 6 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field sm ps-9" type="search" aria-label="بحث" placeholder="الاسم أو الرقم الوظيفي" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {rows.map((e) => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={cx("glass flex flex-wrap items-center gap-3 p-3.5 sm:gap-4", !e.active && "opacity-60")}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky/10 text-[16px] font-bold text-sky" aria-hidden>
                {e.name.trim().slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {e.name}
                  {e.name_ar && <span className="ms-2 font-normal text-ink-3">{e.name_ar}</span>}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-3">
                  <span className="num">#{e.employee_no}</span>
                  {e.job_title && ` — ${e.job_title}`}
                  {!e.active && " — موقوف"}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => toggle(e)}
                  aria-label={e.active ? `إيقاف حساب ${e.name}` : `تفعيل حساب ${e.name}`}
                  aria-pressed={!e.active}
                >
                  {e.active ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                </button>
                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => {
                    setErr("");
                    setDraft({ ...e, password: "" });
                  }}
                  aria-label={`تعديل ${e.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(e)} aria-label={`حذف ${e.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {data?.length === 0 && <p className="glass p-8 text-center text-ink-3">لا توجد حسابات موظفين بعد.</p>}
        {!data && <div className="glass h-20 animate-pulse" />}
      </div>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "تعديل الموظف" : "إضافة موظف"}
        footer={
          <>
            {err && <p className="me-auto self-center text-[14px] font-bold text-danger" role="alert">{err}</p>}
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {draft?.id ? "حفظ" : "إضافة"}
            </button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="e-name" className="label">الاسم</label>
              <input id="e-name" className="field" autoComplete="off" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="e-ar" className="label">الاسم كما يظهر في التقارير <span className="font-normal text-ink-3">(اختياري)</span></label>
              <input id="e-ar" className="field" autoComplete="off" value={draft.name_ar ?? ""} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} />
            </div>
            <div>
              <label htmlFor="e-no" className="label">الرقم الوظيفي</label>
              <input
                id="e-no"
                dir="ltr"
                className="field num"
                inputMode="numeric"
                autoComplete="off"
                value={draft.employee_no ?? ""}
                onChange={(e) => setDraft({ ...draft, employee_no: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="e-job" className="label">
                المسمى الوظيفي <span className="font-normal text-ink-3">(اختياري)</span>
              </label>
              <input id="e-job" className="field" value={draft.job_title ?? ""} onChange={(e) => setDraft({ ...draft, job_title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="e-pw" className="label">{draft.id ? "كلمة مرور جديدة" : "كلمة المرور"}</label>
              <input
                id="e-pw"
                className="field"
                type="password"
                autoComplete="new-password"
                placeholder={draft.id ? "اتركها فارغة للإبقاء على الحالية" : "4 أحرف على الأقل"}
                value={draft.password ?? ""}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
            </div>
            <label className="flex min-h-11 items-center gap-2.5 text-[14.5px] text-ink-2 sm:col-span-2">
              <input type="checkbox" className="h-5 w-5 accent-[var(--action)]" checked={draft.active ?? true} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              الحساب مفعّل ويمكنه الدخول
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

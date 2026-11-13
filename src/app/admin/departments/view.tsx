"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Eye, EyeOff, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Icon, ICONS } from "@/components/icon";
import { Modal } from "@/components/modal";
import { containerOf } from "@/lib/containers";
import type { Checklist, Department } from "@/lib/types";
import { cx, slugify } from "@/lib/utils";
import { useToast } from "../admin-shell";
import { api, PageTitle, useData } from "../use-data";

type Draft = Partial<Department>;

export function DepartmentsPage() {
  const toast = useToast();
  const { data, reload, setData } = useData<Department[]>("/api/admin/departments");
  const lists = useData<Checklist[]>("/api/admin/checklists");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft) return;
    setErr("");
    setBusy(true);
    try {
      if (draft.id) await api(`/api/admin/departments/${draft.id}`, "PATCH", draft);
      else await api("/api/admin/departments", "POST", draft);
      toast(draft.id ? "حُفظ القسم" : "أُضيف القسم");
      setDraft(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(d: Department) {
    setData((x) => x?.map((y) => (y.id === d.id ? { ...y, active: !d.active } : y)) ?? null);
    await api(`/api/admin/departments/${d.id}`, "PATCH", { active: !d.active }).catch(() => reload());
  }

  async function remove(d: Department) {
    if (!confirm(`حذف «${d.name_ar || d.name_en}» مع حاوياته وجميع سجلات فحصها؟ لا يمكن التراجع. لإخفائه مؤقتًا استخدم زر الإيقاف.`)) return;
    try {
      await api(`/api/admin/departments/${d.id}`, "DELETE");
      setData((x) => x?.filter((y) => y.id !== d.id) ?? null);
      toast("حُذف القسم");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const counts = (id: string) => {
    const mine = (lists.data ?? []).filter((c) => c.department_id === id);
    return { containers: mine.filter((c) => containerOf(c)).length, lists: mine.filter((c) => !containerOf(c)).length };
  };

  return (
    <div>
      <PageTitle title="الأقسام" sub="لكل قسم باركود يُثبَّت عند مدخله وصفحة جولة خاصة به">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setErr("");
            setDraft({ name_ar: "", name_en: "", slug: "", icon: "Building2", sort: (data?.length ?? 0) + 1, active: true });
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> إضافة قسم
        </button>
      </PageTitle>

      {!data && <div className="skeleton h-40" />}
      {data?.length === 0 && <p className="glass p-6 text-center text-ink-2">لا توجد أقسام بعد.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((d) => {
          const n = counts(d.id);
          return (
            <div key={d.id} className={cx("glass flex items-center gap-4 p-4", !d.active && "opacity-60")}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky/10 text-sky">
                <Icon name={d.icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {d.name_ar || d.name_en} {!d.active && <span className="chip ms-1">موقوف</span>}
                </p>
                <p className="truncate text-[13px] text-ink-3">
                  <span className="num">{n.containers}</span> حاوية
                  {n.lists > 0 && (
                    <>
                      {" "}
                      — <span className="num">{n.lists}</span> قوائم
                    </>
                  )}{" "}
                  — <span className="code">/d/{d.slug}</span>
                </p>
              </div>
              <Link href={`/d/${d.slug}`} target="_blank" className="btn btn-ghost btn-sm btn-icon" aria-label={`فتح صفحة جولة ${d.name_ar}`}>
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => toggle(d)} aria-label={d.active ? `إيقاف ${d.name_ar}` : `تفعيل ${d.name_ar}`} aria-pressed={!d.active}>
                {d.active ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
              </button>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => {
                  setErr("");
                  setDraft(d);
                }}
                aria-label={`تعديل ${d.name_ar}`}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(d)} aria-label={`حذف ${d.name_ar}`}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        busy={busy}
        title={draft?.id ? "تعديل القسم" : "إضافة قسم"}
        footer={
          <>
            {err && (
              <p className="me-auto self-center text-[14px] font-bold text-danger" role="alert">
                {err}
              </p>
            )}
            <button className="btn btn-ghost" onClick={() => setDraft(null)} disabled={busy}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} حفظ
            </button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="d-ar" className="label">
                اسم القسم
              </label>
              <input id="d-ar" className="field" value={draft.name_ar ?? ""} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} />
            </div>
            <div>
              <label htmlFor="d-en" className="label">
                الاسم بالإنجليزية <span className="font-normal text-ink-3">(للتقارير، اختياري)</span>
              </label>
              <input
                id="d-en"
                className="field"
                dir="ltr"
                value={draft.name_en ?? ""}
                onChange={(e) => setDraft({ ...draft, name_en: e.target.value, slug: draft.id ? draft.slug : slugify(e.target.value).slice(0, 30) })}
              />
            </div>
            <div>
              <label htmlFor="d-slug" className="label">
                رمز الرابط <span className="font-normal text-ink-3">(أحرف إنجليزية، يُطبع في الباركود)</span>
              </label>
              <div className="flex items-center gap-2" dir="ltr">
                <span className="code text-[14px] text-ink-3">/d/</span>
                <input id="d-slug" className="field code" value={draft.slug ?? ""} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              </div>
              {draft.id && <p className="mt-1.5 text-[12.5px] text-warn">تغيير الرمز يُبطل باركود القسم المطبوع؛ باركودات الحاويات تبقى صالحة.</p>}
            </div>
            <fieldset>
              <legend className="label">الأيقونة</legend>
              <div className="grid grid-cols-8 gap-1.5">
                {Object.keys(ICONS).map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={name}
                    aria-pressed={draft.icon === name}
                    onClick={() => setDraft({ ...draft, icon: name })}
                    className={cx("grid aspect-square place-items-center rounded-xl", draft.icon === name ? "bg-[var(--action)] text-[var(--action-text)]" : "bg-ink/[0.05] text-ink-2 hover:bg-ink/10")}
                  >
                    <Icon name={name} className="h-[18px] w-[18px]" />
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </Modal>
    </div>
  );
}

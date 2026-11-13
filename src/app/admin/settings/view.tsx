"use client";

import { useState } from "react";
import type { Settings } from "@/lib/types";
import { useToast } from "../admin-shell";
import { api, PageTitle, useData } from "../use-data";

export function SettingsPage() {
  const toast = useToast();
  const { data } = useData<Settings>("/api/admin/settings");
  const [form, setForm] = useState<{ en: string; ar: string; owner: string } | null>(null);
  const [pw, setPw] = useState({ a: "", b: "" });

  if (data && !form) setForm({ en: data.header_en.join("\n"), ar: data.header_ar.join("\n"), owner: data.copyright_owner });

  async function saveHeader() {
    if (!form) return;
    try {
      await api("/api/admin/settings", "PUT", {
        header_en: form.en.split("\n").map((s) => s.trim()).filter(Boolean),
        header_ar: form.ar.split("\n").map((s) => s.trim()).filter(Boolean),
        copyright_owner: form.owner,
      });
      toast("حُفظت الإعدادات");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function savePw() {
    if (pw.a !== pw.b) return toast("كلمتا المرور غير متطابقتين", "error");
    try {
      await api("/api/admin/settings", "PUT", { new_password: pw.a });
      setPw({ a: "", b: "" });
      toast("تغيّرت كلمة المرور");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="max-w-3xl">
      <PageTitle title="الإعدادات" sub="ترويسة التقارير، حقوق النشر وكلمة مرور الإدارة" />

      <section className="glass p-5" aria-labelledby="hdr">
        <h2 id="hdr" className="text-[17px]">
          ترويسة التقارير
        </h2>
        <p className="mt-0.5 text-[13.5px] text-ink-3">تُطبع أعلى كل تقرير PDF وWord، سطر لكل جهة.</p>
        {form && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-ar" className="label">
                بالعربية (الجهة اليمنى)
              </label>
              <textarea id="s-ar" className="field" rows={4} value={form.ar} onChange={(e) => setForm({ ...form, ar: e.target.value })} />
            </div>
            <div>
              <label htmlFor="s-en" className="label">
                بالإنجليزية (الجهة اليسرى)
              </label>
              <textarea id="s-en" className="field" dir="ltr" rows={4} value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="s-own" className="label">
                صاحب حقوق النشر
              </label>
              <input id="s-own" className="field" dir="ltr" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <button className="btn btn-primary" onClick={saveHeader}>
                حفظ
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="glass mt-4 p-5" aria-labelledby="pw">
        <h2 id="pw" className="text-[17px]">
          كلمة مرور الإدارة
        </h2>
        <p className="mt-0.5 text-[13.5px] text-ink-3">6 أحرف على الأقل، وتُستخدم في الدخول القادم.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="pw-a" className="label">
              كلمة المرور الجديدة
            </label>
            <input id="pw-a" type="password" autoComplete="new-password" className="field" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
          </div>
          <div>
            <label htmlFor="pw-b" className="label">
              تأكيدها
            </label>
            <input id="pw-b" type="password" autoComplete="new-password" className="field" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
          </div>
          <button className="btn btn-ghost" onClick={savePw} disabled={pw.a.length < 6}>
            تغيير
          </button>
        </div>
      </section>
    </div>
  );
}

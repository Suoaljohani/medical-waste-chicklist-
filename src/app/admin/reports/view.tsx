"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { FileSpreadsheet, FileText, FileType2, LoaderCircle } from "lucide-react";
import { PAGE, ReportPage, reportPages, type ReportInput } from "@/components/paper-form";
import { EASE } from "@/components/motion";
import type { Checklist, Department, Settings, Submission } from "@/lib/types";
import { containerOf } from "@/lib/containers";
import { currentMonth, monthRange } from "@/lib/utils";
import { useToast } from "../admin-shell";
import { PageTitle, useData } from "../use-data";

export function ReportsPage() {
  const toast = useToast();
  const { data: checklists } = useData<Checklist[]>("/api/admin/checklists");
  const { data: deps } = useData<Department[]>("/api/admin/departments");
  const { data: settings } = useData<Settings>("/api/admin/settings");
  const [picked, setChkId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [busy, setBusy] = useState<"" | "pdf" | "xlsx" | "docx">("");
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);


  const chkId = picked || checklists?.[0]?.id || "";
  const range = monthRange(month || currentMonth());
  const { data: subs } = useData<Submission[]>(
    chkId ? `/api/admin/submissions?signatures=1&checklist=${chkId}&from=${range.from}&to=${range.to}` : null,
  );

  const checklist = checklists?.find((c) => c.id === chkId);
  const input: ReportInput | null = useMemo(
    () =>
      checklist && settings && subs
        ? {
            checklist,
            department: deps?.find((d) => d.id === checklist.department_id),
            settings,
            month,
            rows: [...subs].sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1)),
          }
        : null,
    [checklist, settings, subs, deps, month],
  );
  const P = checklist ? PAGE[checklist.orientation] : PAGE.portrait;
  const pages = useMemo(() => (input ? reportPages(input) : []), [input]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / P.w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [P.w]);

  async function run(kind: "pdf" | "xlsx" | "docx") {
    if (!input) return;
    setBusy(kind);
    try {
      const ex = await import("@/lib/exporters");
      if (kind === "pdf") await ex.exportPdf(input, pageRefs.current.slice(0, pages.length).filter(Boolean) as HTMLElement[]);
      if (kind === "xlsx") await ex.exportExcel(input);
      if (kind === "docx") await ex.exportWord(input);
      toast(`نُزّل ملف ${kind === "pdf" ? "PDF" : kind === "xlsx" ? "Excel" : "Word"}`);
    } catch (e) {
      console.error(e);
      toast("تعذّر التصدير. حاول مرة أخرى.", "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <PageTitle title="التقارير والتصدير" sub="تنزيل فحوص شهر لحاوية أو قائمة بصيغة PDF (بشكل النموذج الورقي) أو Excel أو Word" />

      <div className="glass mb-4 grid gap-3 p-4 lg:grid-cols-[1fr_200px_auto] lg:items-end">
        <div>
          <label htmlFor="rp-c" className="label">
            الحاوية أو القائمة
          </label>
          <select id="rp-c" className="field sm" value={chkId} onChange={(e) => setChkId(e.target.value)}>
            {deps?.map((d) => (
              <optgroup key={d.id} label={d.name_ar || d.name_en}>
                {checklists
                  ?.filter((c) => c.department_id === d.id)
                  .map((c) => {
                    const info = containerOf(c);
                    return (
                      <option key={c.id} value={c.id}>
                        {info ? `${info.code} — ${info.location}` : c.title_ar || c.title_en}
                      </option>
                    );
                  })}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rp-m" className="label">
            الشهر
          </label>
          <input id="rp-m" type="month" dir="ltr" className="field sm num" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ExportBtn onClick={() => run("pdf")} busy={busy === "pdf"} disabled={!input || !!busy} icon={<FileText className="h-4 w-4" />} label="PDF" tint="#bf2e3b" />
          <ExportBtn onClick={() => run("xlsx")} busy={busy === "xlsx"} disabled={!input || !!busy} icon={<FileSpreadsheet className="h-4 w-4" />} label="Excel" tint="#067a5b" />
          <ExportBtn onClick={() => run("docx")} busy={busy === "docx"} disabled={!input || !!busy} icon={<FileType2 className="h-4 w-4" />} label="Word" tint="#0c6fae" />
        </div>
      </div>

      <p className="mb-3 px-1 text-[13px] text-ink-3">
        {input ? `${input.rows.length} فحص — ${pages.length} صفحة — معاينة ملف PDF` : "جارٍ التحميل…"}
      </p>

      <div ref={wrapRef} dir="ltr" className="flex flex-col items-center gap-5">
        {input &&
          pages.map((page, i) => (
            <motion.div
              key={`${chkId}-${month}-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: EASE, delay: Math.min(i, 3) * 0.05 }}
              className="overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_rgba(15,27,61,.08),0_24px_50px_-24px_rgba(24,52,112,.45)]"
              style={{ width: P.w * scale, height: P.h * scale }}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: P.w, height: P.h }}>
                <ReportPage
                  ref={(el) => {
                    pageRefs.current[i] = el;
                  }}
                  {...input}
                  page={page}
                  index={i}
                  total={pages.length}
                />
              </div>
            </motion.div>
          ))}
      </div>
    </div>
  );
}

function ExportBtn({ onClick, busy, disabled, icon, label, tint }: { onClick: () => void; busy: boolean; disabled: boolean; icon: React.ReactNode; label: string; tint: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn btn-ghost h-[44px] px-3" style={{ color: tint }}>
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      <span className="text-ink">{label}</span>
    </button>
  );
}

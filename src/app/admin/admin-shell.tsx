"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Building2,
  ClipboardList,
  FileDown,
  House,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Lock,
  LogOut,
  MessageSquareWarning,
  Settings,
  TriangleAlert,
  Users,
} from "lucide-react";
import { LogoTile, Wordmark } from "@/components/brand";
import { FloorBin } from "@/components/icon";
import { EASE } from "@/components/motion";
import { cx } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "المتابعة",
    items: [
      { href: "/admin", label: "لوحة المتابعة", icon: LayoutDashboard },
      { href: "/admin/observations", label: "الملاحظات", icon: MessageSquareWarning },
      { href: "/admin/records", label: "سجل الفحوص", icon: ClipboardList },
      { href: "/admin/reports", label: "التقارير والتصدير", icon: FileDown },
    ],
  },
  {
    group: "الإعداد",
    items: [
      { href: "/admin/containers", label: "الحاويات والباركود", icon: FloorBin },
      { href: "/admin/departments", label: "الأقسام", icon: Building2 },
      { href: "/admin/checklists", label: "القوائم الأخرى", icon: ListChecks },
      { href: "/admin/staff", label: "الموظفون", icon: Users },
      { href: "/admin/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];
const ALL = NAV.flatMap((g) => g.items);
const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  const [backend, setBackend] = useState<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const path = usePathname();
  const reduce = useReducedMotion();

  const check = useCallback(() => {
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setBackend(j.backend);
        setState(j.admin ? "in" : "out");
      })
      .catch(() => setState("out"));
  }, []);
  useEffect(check, [check]);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setState("out");
  }

  if (state === "loading")
    return (
      <div className="grid flex-1 place-items-center" role="status" aria-label="جارٍ التحميل">
        <LoaderCircle className="h-6 w-6 animate-spin text-ink-3" aria-hidden />
      </div>
    );
  if (state === "out") return <Login onDone={check} />;

  const fileNote = backend === "file" && (
    <p className="flex gap-2 rounded-xl bg-[rgba(214,138,14,.13)] p-3 text-[12.5px] leading-snug text-warn">
      <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
      تخزين محلي للمعاينة. اربط Supabase لحفظ البيانات بشكل دائم.
    </p>
  );

  return (
    <ToastCtx.Provider value={toast}>
      <div className="mx-auto flex w-full max-w-[1480px] flex-1 gap-5 px-3 pt-3 sm:px-5 sm:pt-5">
        <aside className="glass-thin sticky top-5 hidden h-[calc(100dvh-40px)] w-64 shrink-0 flex-col p-4 lg:flex" aria-label="أقسام لوحة الإدارة">
          <div className="px-1 pb-5">
            <Wordmark compact href="/admin" />
          </div>
          <nav className="scroll-thin flex flex-col gap-5 overflow-y-auto">
            {NAV.map((g) => (
              <div key={g.group}>
                <p className="mb-1.5 px-3 text-[12.5px] font-bold text-ink-3">{g.group}</p>
                <ul className="flex flex-col gap-0.5">
                  {g.items.map((n) => {
                    const active = isActive(path, n.href);
                    return (
                      <li key={n.href}>
                        <Link
                          href={n.href}
                          aria-current={active ? "page" : undefined}
                          className={cx(
                            "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-bold transition-colors duration-150",
                            active ? "text-sky" : "text-ink-2 hover:bg-ink/[0.05] hover:text-ink",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId={reduce ? undefined : "nav-pill"}
                              className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_3px_rgba(15,27,61,.12)]"
                              transition={{ duration: 0.22, ease: EASE }}
                            />
                          )}
                          <n.icon className="relative h-[19px] w-[19px]" strokeWidth={1.8} />
                          <span className="relative">{n.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 pt-4">
            {fileNote}
            <Link href="/" className="btn btn-ghost btn-sm w-full">
              <House className="h-4 w-4" aria-hidden /> واجهة الموظف
            </Link>
            <button onClick={logout} className="btn btn-ghost btn-sm w-full">
              <LogOut className="h-4 w-4" aria-hidden /> تسجيل الخروج
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-10">
          <div className="mb-4 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Wordmark compact href="/admin" />
              <button onClick={logout} className="btn btn-ghost btn-sm">
                <LogOut className="h-4 w-4" aria-hidden /> خروج
              </button>
            </div>
            <nav className="scroll-thin -mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 pb-1" aria-label="أقسام لوحة الإدارة">
              {ALL.map((n) => {
                const active = isActive(path, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-bold",
                      active ? "bg-white text-sky shadow-[0_1px_3px_rgba(15,27,61,.14)]" : "bg-ink/[0.05] text-ink-2",
                    )}
                  >
                    <n.icon className="h-4 w-4" strokeWidth={1.9} />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            {fileNote && <div className="mt-3">{fileNote}</div>}
          </div>
          {children}
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.24, ease: EASE }}
              className={cx("glass-strong rounded-full px-5 py-2.5 text-[14.5px] font-bold", t.tone === "error" ? "text-danger" : "text-ink")}
              role={t.tone === "error" ? "alert" : "status"}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) return onDone();
      setErr((await r.json().catch(() => ({}))).error || "تعذّر تسجيل الدخول");
      setPw("");
    } catch {
      setErr("تعذّر الاتصال. تحقق من الشبكة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <form onSubmit={submit} className="glass-strong settle w-full max-w-sm p-7">
        <div className="flex justify-center">
          <LogoTile size={76} />
        </div>
        <h1 className="mt-5 text-center text-[22px]">لوحة إدارة تشييك الحاويات</h1>
        <p className="mt-1 text-center text-[14px] text-ink-3">مستشفى الحديثة العام</p>
        <label htmlFor="admin-pw" className="label mt-6">
          كلمة مرور الإدارة
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input id="admin-pw" type="password" className="field ps-11" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err || undefined} />
        </div>
        {err && (
          <p className="mt-2 text-[14px] font-bold text-danger" role="alert">
            {err}
          </p>
        )}
        <button className="btn btn-primary mt-4 h-[52px] w-full" disabled={busy || !pw}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} دخول
        </button>
        <Link href="/" className="btn btn-ghost btn-sm mt-3 w-full">
          العودة إلى واجهة الموظف
        </Link>
      </form>
    </main>
  );
}

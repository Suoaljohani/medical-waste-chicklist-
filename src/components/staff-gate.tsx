"use client";

import { useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { LoaderCircle, LogOut, PencilLine, UserRound } from "lucide-react";
import { clearSavedSignature, useStaff } from "./staff";

/**
 * Who is doing the round. With staff accounts the person signs in with employee number and password;
 * without them they type their name once on this phone.
 */
export function StaffGate({ onReady }: { onReady?: () => void }) {
  const { staff, setStaff, ready, mode, signIn, signOut } = useStaff();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [no, setNo] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const shake = useAnimationControls();
  const reduce = useReducedMotion();

  function nudge(msg: string) {
    setErr(msg);
    if (!reduce) shake.start({ x: [0, -6, 5, -3, 0], transition: { duration: 0.32 } });
    first.current?.focus();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (mode === "accounts") {
      if (!no.trim() || !password) return nudge("أدخل الرقم الوظيفي وكلمة المرور");
      setBusy(true);
      try {
        await signIn(no.trim(), password);
        clearSavedSignature();
        setPassword("");
        onReady?.();
      } catch (x) {
        setPassword("");
        nudge((x as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!name.trim()) return nudge("اكتب اسمك ليُسجَّل مع الفحص");
    if (staff && staff.name.trim() !== name.trim()) clearSavedSignature();
    setStaff({ name: name.trim(), no: no.trim() });
    setEditing(false);
    onReady?.();
  }

  if (!ready) return <div className="glass skeleton h-[76px]" />;

  if (staff && !editing)
    return (
      <div className="glass flex items-center gap-3 p-3 ps-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-sky/10 text-sky">
          <UserRound className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-ink-2">القائم بالجولة</p>
          <p className="truncate font-bold">{staff.name}</p>
        </div>
        {mode === "accounts" ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              clearSavedSignature();
              await signOut();
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden /> خروج
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setName(staff.name);
              setNo(staff.no);
              setEditing(true);
            }}
          >
            <PencilLine className="h-4 w-4" aria-hidden /> تغيير
          </button>
        )}
      </div>
    );

  return (
    <motion.form animate={shake} onSubmit={save} className="glass-strong flex flex-col gap-3 p-4 sm:p-5" noValidate>
      <p className="font-bold">{mode === "accounts" ? "سجّل الدخول لبدء الجولة" : "من يقوم بالجولة؟"}</p>
      {mode === "accounts" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sg-no" className="label">
              الرقم الوظيفي
            </label>
            <input id="sg-no" ref={first} className="field num" dir="ltr" inputMode="numeric" autoComplete="username" enterKeyHint="next" value={no} onChange={(e) => setNo(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sg-pw" className="label">
              كلمة المرور
            </label>
            <input id="sg-pw" type="password" className="field" autoComplete="current-password" enterKeyHint="go" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div>
            <label htmlFor="sg-name" className="label">
              الاسم
            </label>
            <input id="sg-name" ref={first} className="field" autoComplete="name" enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sg-no" className="label">
              الرقم الوظيفي <span className="font-normal text-ink-3">(اختياري)</span>
            </label>
            <input id="sg-no" className="field num" dir="ltr" inputMode="numeric" enterKeyHint="done" value={no} onChange={(e) => setNo(e.target.value)} />
          </div>
        </div>
      )}
      {err && (
        <p className="text-[14px] font-bold text-danger" role="alert">
          {err}
        </p>
      )}
      <button className="btn btn-primary h-[52px]" disabled={busy}>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
        {mode === "accounts" ? "دخول" : "متابعة"}
      </button>
    </motion.form>
  );
}

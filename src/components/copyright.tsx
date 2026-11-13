"use client";

import { useEffect, useState } from "react";

export function Copyright() {
  const [year, setYear] = useState(2026);
  const [owner, setOwner] = useState("Talanize");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs once after mount (browser-only value / data fetch)
    setYear(new Date().getFullYear());
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s?.copyright_owner && setOwner(s.copyright_owner))
      .catch(() => {});
  }, []);

  return (
    <footer className="px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-10 text-center text-[12.5px] text-ink-3 print:hidden">
      <p>
        © <span className="num">{year}</span> <span className="code text-ink-2">{owner}</span> — جميع الحقوق محفوظة
      </p>
      <p className="mt-0.5">مستشفى الحديثة العام</p>
    </footer>
  );
}

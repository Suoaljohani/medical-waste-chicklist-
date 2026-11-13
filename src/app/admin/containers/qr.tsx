/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type Label = { key: string; title: string; sub: string; code?: string; url: string };

export async function qrPng(url: string, size = 640) {
  const QR = (await import("qrcode")).default;
  return QR.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: size, color: { dark: "#0f1b3d", light: "#ffffff" } });
}

export function useQr(url: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    qrPng(url).then((s) => live && setSrc(s));
    return () => {
      live = false;
    };
  }, [url]);
  return url ? src : null;
}

/**
 * Printable labels. Rendered into the page only while printing; everything else is hidden by the print
 * stylesheet. Text is real HTML so Arabic shapes correctly in Janna LT.
 */
export function PrintLabels({ labels, cols = 2, onDone }: { labels: Label[] | null; cols?: number; onDone: () => void }) {
  const [imgs, setImgs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!labels?.length) return;
    let live = true;
    Promise.all(labels.map(async (l) => [l.key, await qrPng(l.url, 520)] as const)).then((pairs) => {
      if (!live) return;
      setImgs(Object.fromEntries(pairs));
      // Let the images paint, then open the print dialog.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.print();
          onDone();
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [labels, onDone]);
  if (!labels?.length || typeof document === "undefined") return null;
  return createPortal(
    <div className="print-area" style={{ ["--cols" as string]: cols }} aria-hidden>
      {labels.map((l) => (
        <div key={l.key} className="qr-tile">
          <img src="/brand/logo.svg" alt="" style={{ height: "14mm", margin: "0 auto" }} />
          <p style={{ fontSize: cols > 2 ? "11pt" : "14pt", fontWeight: 700, marginTop: "3mm" }}>{l.title}</p>
          <p style={{ fontSize: cols > 2 ? "9pt" : "11pt" }}>{l.sub}</p>
          {imgs[l.key] && <img src={imgs[l.key]} alt="" style={{ width: cols > 2 ? "40mm" : "60mm", margin: "3mm auto" }} />}
          {l.code && (
            <p dir="ltr" style={{ fontSize: cols > 2 ? "12pt" : "16pt", fontWeight: 700, letterSpacing: "0.04em" }}>
              {l.code}
            </p>
          )}
          <p style={{ fontSize: "8pt", color: "#5c6a8e" }}>امسح الباركود بكاميرا الجوال لبدء الفحص</p>
        </div>
      ))}
    </div>,
    document.body,
  );
}

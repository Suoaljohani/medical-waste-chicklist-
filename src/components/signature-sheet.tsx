/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eraser, LoaderCircle, PenLine } from "lucide-react";
import type SignaturePadType from "signature_pad";
import { Modal } from "./modal";
import { getSavedSignature, saveSignature } from "./staff";

export function SignatureSheet({
  open,
  busy,
  name,
  confirmLabel = "تأكيد وحفظ الفحص",
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  name: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (png: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadType | null>(null);
  const [empty, setEmpty] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [mode, setMode] = useState<"saved" | "draw">("draw");
  const [remember, setRemember] = useState(true);
  const [wasOpen, setWasOpen] = useState(false);

  // Each time the sheet opens, offer the saved signature for this name if there is one.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const png = getSavedSignature(name);
      setSaved(png);
      setMode(png ? "saved" : "draw");
      setRemember(true);
    }
  }

  useEffect(() => {
    if (!open || mode !== "draw") return;
    let pad: SignaturePadType | null = null;
    let cancelled = false;
    const resize = () => {
      const c = canvasRef.current;
      if (!c || !pad) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      c.width = c.offsetWidth * ratio;
      c.height = c.offsetHeight * ratio;
      c.getContext("2d")!.scale(ratio, ratio);
      pad.clear();
      pad.fromData(data);
    };
    import("signature_pad").then(({ default: SignaturePad }) => {
      if (cancelled || !canvasRef.current) return;
      pad = new SignaturePad(canvasRef.current, {
        penColor: "#0f1b3d",
        minWidth: 0.9,
        maxWidth: 2.6,
        velocityFilterWeight: 0.6,
        backgroundColor: "rgba(0,0,0,0)",
      });
      pad.addEventListener("endStroke", () => setEmpty(pad!.isEmpty()));
      padRef.current = pad;
      setEmpty(true);
      requestAnimationFrame(resize);
    });
    window.addEventListener("resize", resize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      pad?.off();
      padRef.current = null;
    };
  }, [open, mode]);

  function clear() {
    padRef.current?.clear();
    setEmpty(true);
  }

  function confirm() {
    if (mode === "saved" && saved) return onConfirm(saved);
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    const png = trimmed(canvasRef.current!);
    if (remember) saveSignature(name, png);
    onConfirm(png);
  }

  const ready = mode === "saved" ? !!saved : !empty;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={mode === "saved" ? "التوقيع المحفوظ" : "وقّع بإصبعك"}
      footer={
        <>
          {mode === "saved" ? (
            <button className="btn btn-ghost" onClick={() => setMode("draw")} disabled={busy}>
              <PenLine className="h-4 w-4" aria-hidden /> توقيع جديد
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={clear} disabled={busy || empty}>
              <Eraser className="h-4 w-4" aria-hidden /> مسح
            </button>
          )}
          <button className="btn btn-primary flex-1" onClick={confirm} disabled={busy || !ready}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />}
            {busy ? "جارٍ الحفظ…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[14.5px] text-ink-2">
        التوقيع يؤكد أن الفحص أجراه <span className="font-bold text-ink">{name}</span>.
      </p>

      {mode === "saved" && saved ? (
        <div className="relative mt-4 flex h-[200px] items-center justify-center overflow-hidden rounded-2xl border border-ink/15 bg-white p-6 sm:h-[230px]">
          <img src={saved} alt={`توقيع ${name} المحفوظ`} className="max-h-full max-w-full object-contain" />
          <span className="chip chip-ok absolute start-3 top-3">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> محفوظ على هذا الجهاز
          </span>
        </div>
      ) : (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-ink/15 bg-white">
          <canvas ref={canvasRef} className="block h-[200px] w-full touch-none sm:h-[230px]" aria-label="مساحة التوقيع" />
          <div className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-dashed border-ink/25" aria-hidden />
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-3">
              <PenLine className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              <span className="text-[14px]">وقّع هنا</span>
            </div>
          )}
        </div>
      )}

      {mode === "draw" && (
        <label className="mt-4 flex min-h-11 items-center gap-2.5 text-[14.5px] text-ink-2">
          <input type="checkbox" className="h-5 w-5 accent-[#0c6fae]" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} />
          احفظ توقيعي على هذا الجهاز لبقية الجولة
        </label>
      )}
    </Modal>
  );
}

/** Crop the transparent margins so the signature fits report cells nicely. */
function trimmed(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (px[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 <= x0 || y1 <= y0) return canvas.toDataURL("image/png");
  const pad = 12;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width, x1 + pad); y1 = Math.min(height, y1 + pad);
  const w = x1 - x0, h = y1 - y0;
  const scale = Math.min(1, 600 / w, 240 / h);
  const out = document.createElement("canvas");
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  out.getContext("2d")!.drawImage(canvas, x0, y0, w, h, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

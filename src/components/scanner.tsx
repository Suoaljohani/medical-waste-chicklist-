"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CameraOff, LoaderCircle, ScanLine } from "lucide-react";
import { Modal } from "./modal";

type State = "starting" | "scanning" | "denied" | "unsupported";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Remembered for the visit so each inspection can record that the department was confirmed by scanning. */
export const QR_FLAG = "mw_qr";
export function markScanned(slug: string) {
  try {
    sessionStorage.setItem(`${QR_FLAG}:${slug}`, String(Date.now()));
  } catch {}
}
export function wasScanned(slug: string) {
  try {
    const at = Number(sessionStorage.getItem(`${QR_FLAG}:${slug}`));
    return at > 0 && Date.now() - at < 4 * 3600e3;
  } catch {
    return false;
  }
}

/** A printed code is ours if it points at a department, a container/checklist or a report. */
export function scanTarget(text: string): string | null {
  try {
    const u = new URL(text.trim(), window.location.origin);
    if (!/^\/(d|c)\/[\w-]+(\/[\w-]+)?\/?$/.test(u.pathname) && !/^\/r\/[\w-]+\/?$/.test(u.pathname)) return null;
    if (u.pathname.startsWith("/r/")) return u.pathname + u.search;
    return `${u.pathname}?qr=1`;
  } catch {
    return null;
  }
}

/**
 * In-app QR scanner. Uses the browser's BarcodeDetector where it exists and falls back to jsQR
 * (loaded only when needed) elsewhere, which covers Safari on iPhone.
 */
export function Scanner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>("starting");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset each time the camera opens
    setState("starting");
    setWrong(false);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return setState("unsupported");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      } catch {
        return setState("denied");
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      setState("scanning");

      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      let detector: Detector | null = null;
      try {
        detector = BD ? new BD({ formats: ["qr_code"] }) : null;
      } catch {
        detector = null;
      }
      const jsQR = detector ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (stopped) return;
        const v = video.current;
        let text = "";
        if (v && v.readyState >= 2 && v.videoWidth) {
          try {
            if (detector) text = (await detector.detect(v))[0]?.rawValue ?? "";
            else if (jsQR && ctx) {
              const w = Math.min(640, v.videoWidth);
              const h = Math.round((w / v.videoWidth) * v.videoHeight);
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(v, 0, 0, w, h);
              text = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? "";
            }
          } catch {}
        }
        if (text) {
          const to = scanTarget(text);
          if (to) {
            stopped = true;
            navigator.vibrate?.(40);
            onClose();
            router.push(to);
            return;
          }
          setWrong(true);
        }
        timer = setTimeout(tick, 180);
      };
      tick();
    }
    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onClose, router]);

  return (
    <Modal open={open} onClose={onClose} title="مسح باركود القسم">
      {state === "denied" || state === "unsupported" ? (
        <div className="rounded-2xl bg-ink/[0.05] p-5 text-center">
          <CameraOff className="mx-auto h-8 w-8 text-ink-3" strokeWidth={1.6} aria-hidden />
          <p className="mt-3 font-bold">{state === "denied" ? "لم يُسمح باستخدام الكاميرا" : "الكاميرا غير متاحة في هذا المتصفح"}</p>
          <p className="mt-1 text-[14px] text-ink-2">
            {state === "denied" ? "اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح، أو" : "يمكنك"} مسح الباركود بتطبيق كاميرا الجوال، أو اختيار القسم من القائمة.
          </p>
          <Link href="/" className="btn btn-primary mt-4 w-full" onClick={onClose}>
            اختيار القسم من القائمة
          </Link>
        </div>
      ) : (
        <>
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[22px] bg-[#0f1b3d]">
            <video ref={video} className="h-full w-full object-cover" playsInline muted aria-label="معاينة الكاميرا" />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/85 shadow-[0_0_0_999px_rgba(15,27,61,.35)]" aria-hidden />
            {state === "starting" && (
              <div className="absolute inset-0 grid place-items-center text-white">
                <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden />
              </div>
            )}
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-[14.5px] text-ink-2" role="status" aria-live="polite">
            <ScanLine className="h-4 w-4 shrink-0 text-sky" aria-hidden />
            {wrong ? "هذا الباركود ليس من باركودات النظام. جرّب باركود القسم." : "وجّه الكاميرا إلى باركود القسم المثبّت عند المدخل"}
          </p>
        </>
      )}
    </Modal>
  );
}

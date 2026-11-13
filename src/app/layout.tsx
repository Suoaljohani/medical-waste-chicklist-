import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Copyright } from "@/components/copyright";
import "./globals.css";

// Janna LT, supplied by the hospital. Two weights only: regular for reading, bold for emphasis.
const janna = localFont({
  variable: "--font-janna",
  display: "swap",
  src: [
    { path: "../fonts/JannaLT-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/JannaLT-Bold.ttf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: { default: "جولات النفايات الطبية · مستشفى الحديثة العام", template: "%s · جولات النفايات الطبية" },
  description: "فحص الحاويات والسجلات التشغيلية للنفايات الطبية في مستشفى الحديثة العام.",
};

export const viewport: Viewport = {
  themeColor: "#061b24",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${janna.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#content"
          className="sr-only z-[70] rounded-xl bg-raised px-4 py-3 font-bold text-ink shadow-lg focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
        >
          تخطَّ إلى المحتوى
        </a>
        <div className="backdrop" aria-hidden />
        <div id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
        <Copyright />
      </body>
    </html>
  );
}

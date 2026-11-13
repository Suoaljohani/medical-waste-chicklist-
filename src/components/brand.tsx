import Image from "next/image";
import Link from "next/link";

/** The hospital's logo on its own white tile, as supplied. Never recoloured or redrawn. */
export function LogoTile({ size = 44 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[12px] bg-white shadow-[0_0_0_1px_rgb(232_242_238/12%),0_8px_20px_rgb(0_0_0/25%)]"
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/logo.svg"
        alt="شعار مستشفى الحديثة العام"
        width={Math.round(size * 0.8)}
        height={Math.round(size * 0.8)}
        style={{ width: Math.round(size * 0.8), height: "auto" }}
        priority
      />
    </span>
  );
}

/** Logo, service name and description, in the same order on every page. */
export function Wordmark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-3 rounded-2xl" aria-label="جولات النفايات الطبية · مستشفى الحديثة العام">
      <LogoTile size={compact ? 40 : 44} />
      <span className="min-w-0 leading-tight">
        <span className={compact ? "block text-[15px] font-bold leading-snug text-ink" : "block truncate text-[16px] font-bold text-ink"}>جولات النفايات الطبية</span>
        <span className={compact ? "block text-[13px] leading-snug text-ink-2" : "block truncate text-[13px] text-ink-2"}>
          مستشفى الحديثة العام
          {!compact && <span className="hidden md:inline"> · فحص الحاويات والسجلات التشغيلية</span>}
        </span>
      </span>
    </Link>
  );
}

export function HospitalBadge({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoTile size={size + 4} />
      <span className="hidden leading-tight sm:block">
        <span className="block text-[14px] font-bold">مستشفى الحديثة العام</span>
        <span className="block text-[13px] text-ink-2">جولات النفايات الطبية</span>
      </span>
    </span>
  );
}

export { Wordmark as BrandMark };

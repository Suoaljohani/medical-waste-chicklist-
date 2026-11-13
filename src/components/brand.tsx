import Image from "next/image";
import Link from "next/link";

/** The hospital's logo on a white tile, as supplied. Never recoloured or redrawn. */
export function LogoTile({ size = 44 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[14px] bg-white shadow-[0_0_0_1px_rgba(15,27,61,.06),0_8px_18px_-10px_rgba(24,52,112,.5)]"
      style={{ width: size, height: size }}
    >
      <Image src="/brand/logo.svg" alt="شعار مستشفى الحديثة العام" width={Math.round(size * 0.78)} height={Math.round(size * 0.78)} style={{ width: Math.round(size * 0.78), height: "auto" }} priority />
    </span>
  );
}

/** Logo plus the product name. */
export function Wordmark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl" aria-label="الرئيسية · تشييك حاويات النفايات الطبية">
      <LogoTile size={compact ? 40 : 46} />
      <span className="leading-tight">
        <span className={compact ? "block text-[15px] font-bold" : "block text-[17px] font-bold"}>تشييك الحاويات</span>
        <span className="block text-[12.5px] text-ink-3">النفايات الطبية</span>
      </span>
    </Link>
  );
}

export function HospitalBadge({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoTile size={size + 6} />
      <span className="hidden leading-tight sm:block">
        <span className="block text-[13.5px] font-bold">مستشفى الحديثة العام</span>
        <span className="block text-[12px] text-ink-3" dir="ltr">
          Alhadithah General Hospital
        </span>
      </span>
    </span>
  );
}

export { Wordmark as BrandMark };

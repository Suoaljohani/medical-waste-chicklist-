import {
  Activity,
  Ambulance,
  Baby,
  Bandage,
  BedDouble,
  Biohazard,
  Box,
  Brain,
  Building2,
  ClipboardCheck,
  Cylinder,
  Droplet,
  Droplets,
  Flame,
  FlaskConical,
  Gauge,
  Hand,
  HeartPulse,
  Hospital,
  Lightbulb,
  Microscope,
  Package,
  Pill,
  Recycle,
  Refrigerator,
  ShieldCheck,
  Siren,
  Snowflake,
  SprayCan,
  Stethoscope,
  Syringe,
  Tablets,
  Thermometer,
  ThermometerSnowflake,
  Trash2,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  ClipboardCheck,
  Thermometer,
  ThermometerSnowflake,
  Refrigerator,
  Snowflake,
  Droplets,
  Droplet,
  Package,
  Box,
  Syringe,
  Pill,
  Tablets,
  HeartPulse,
  Activity,
  Zap,
  Stethoscope,
  ShieldCheck,
  Ambulance,
  Siren,
  BedDouble,
  Hospital,
  Building2,
  FlaskConical,
  Microscope,
  Wind,
  Cylinder,
  Gauge,
  Hand,
  SprayCan,
  Biohazard,
  Trash2,
  Recycle,
  Bandage,
  Baby,
  Brain,
  Flame,
  Lightbulb,
};

type GlyphProps = { className?: string; strokeWidth?: number };
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Floor-standing pedal bin. Drawn for this product so the two container kinds differ by shape, not only by colour. */
export function FloorBin({ className, strokeWidth = 1.6 }: GlyphProps) {
  return (
    <svg {...svg} strokeWidth={strokeWidth} className={className} aria-hidden>
      <path d="M4 8h16" />
      <path d="M9 8V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2V8" />
      <path d="M6 8l.95 10.4A1.8 1.8 0 0 0 8.74 20h6.52a1.8 1.8 0 0 0 1.79-1.6L18 8" />
      <circle cx="12" cy="13.6" r="2.1" />
      <path d="M8.5 22.4h7" />
    </svg>
  );
}

/** Wall-mounted sharps box: brackets either side, a drop slot on top. */
export function SharpsBox({ className, strokeWidth = 1.6 }: GlyphProps) {
  return (
    <svg {...svg} strokeWidth={strokeWidth} className={className} aria-hidden>
      <rect x="5.5" y="8" width="13" height="12.5" rx="2" />
      <path d="M7.5 8V6.6A2.6 2.6 0 0 1 10.1 4h3.8a2.6 2.6 0 0 1 2.6 2.6V8" />
      <path d="M9.2 11.6h5.6" />
      <path d="M12 11.6v5.2" />
      <path d="m10.3 15.2 1.7 1.7 1.7-1.7" />
      <path d="M2.8 10.5v5M21.2 10.5v5" />
    </svg>
  );
}

const GLYPHS: Record<string, (p: GlyphProps) => React.ReactNode> = { FloorBin, SharpsBox };

export function Icon({ name, className, strokeWidth = 1.6 }: { name: string; className?: string; strokeWidth?: number }) {
  const G = GLYPHS[name];
  if (G) return <G className={className} strokeWidth={strokeWidth} />;
  const C = ICONS[name] ?? ClipboardCheck;
  return <C className={className} strokeWidth={strokeWidth} aria-hidden />;
}

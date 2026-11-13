import type { Checklist, ContainerKind, Field } from "./types";

export const CONTAINER_KEY = "__container";

export const KINDS: ContainerKind[] = ["floor", "sharps"];

export const KIND: Record<ContainerKind, { ar: string; short: string; en: string; color: string; icon: string }> = {
  floor: { ar: "حاوية أرضية", short: "أرضية", en: "Floor container", color: "#057590", icon: "FloorBin" },
  sharps: { ar: "حاوية أدوات حادة معلقة", short: "أدوات حادة", en: "Sharps container", color: "#283A83", icon: "SharpsBox" },
};

export type ContainerInfo = { kind: ContainerKind; code: string; location: string };

/** The container a checklist row describes, or null for an ordinary checklist. */
export function containerOf(c: { fields?: Field[] } | null | undefined): ContainerInfo | null {
  const f = c?.fields?.find((x) => x.type === "container");
  if (!f || (f.kind !== "floor" && f.kind !== "sharps")) return null;
  return { kind: f.kind, code: f.code ?? "", location: f.location ?? "" };
}

export const isContainer = (c: { fields?: Field[] } | null | undefined) => containerOf(c) !== null;

/** Fields that never hold a value: section headings and the container descriptor. */
export const isInfoField = (f: Field) => f.type === "heading" || f.type === "container";

export function descriptor(info: ContainerInfo): Field {
  return {
    key: CONTAINER_KEY,
    type: "container",
    label_en: info.code,
    label_ar: info.location,
    required: false,
    kind: info.kind,
    code: info.code,
    location: info.location,
  };
}

/** The parts of a checklist row that are derived from the container descriptor and the item template. */
export function containerRow(info: ContainerInfo, items: Field[]): Pick<Checklist, "title_en" | "title_ar" | "icon" | "color" | "fields" | "layout" | "orientation"> {
  const k = KIND[info.kind];
  return {
    title_en: `${k.en} ${info.code}${info.location ? ` · ${info.location}` : ""}`.slice(0, 140),
    title_ar: `${k.ar} ${info.code}${info.location ? ` · ${info.location}` : ""}`.slice(0, 140),
    icon: k.icon,
    color: k.color,
    fields: [descriptor(info), ...items],
    layout: "grid",
    orientation: "portrait",
  };
}

const item = (key: string, label_ar: string, label_en: string): Field => ({ key, label_ar, label_en, type: "check", required: true });

/**
 * Starting inspection items. Taken from the items already used in this project's segregation and sharps
 * checklists, without numeric limits. The admin edits them under الحاويات ← بنود الفحص; they need the
 * hospital's approval before use.
 */
export const DEFAULT_ITEMS: Record<ContainerKind, Field[]> = {
  floor: [
    item("bag_colour", "الكيس باللون المخصص لنوع النفايات", "Bag colour matches the waste type"),
    item("fill_level", "مستوى التعبئة ضمن الحد المعتمد", "Fill level within the approved limit"),
    item("lid_pedal", "الحاوية مغطاة والدواسة تعمل", "Container lidded and pedal working"),
    item("clean_no_leak", "الحاوية نظيفة ولا يوجد تسرب", "Container clean with no leakage"),
    item("no_sharps", "لا توجد أدوات حادة داخل الكيس", "No sharps inside the bag"),
    item("label", "الملصق التعريفي موجود وواضح", "Identification label present and legible"),
  ],
  sharps: [
    item("secured", "الحاوية مثبتة في مكانها", "Container mounted and secured"),
    item("fill_line", "المحتوى لم يتجاوز خط التعبئة", "Contents below the fill line"),
    item("lid_closed", "الغطاء المؤقت مغلق عند عدم الاستخدام", "Temporary lid closed when not in use"),
    item("start_date", "تاريخ بدء الاستخدام مدوّن على الحاوية", "Start date written on the container"),
    item("intact", "الحاوية سليمة ولا يوجد تلف أو تسرب", "Container intact, no damage or leakage"),
  ],
};

export function itemsFor(kind: ContainerKind, settings: { container_items?: Record<ContainerKind, Field[]> }): Field[] {
  const saved = settings.container_items?.[kind];
  return saved?.length ? saved : DEFAULT_ITEMS[kind];
}

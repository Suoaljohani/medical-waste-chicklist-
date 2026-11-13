import { wasteForms } from "./forms";
import type { Checklist, Department, Settings } from "./types";

const now = "2026-11-12T00:00:00.000Z";

export const seedDepartments: Department[] = [
  {
    id: "dep-waste",
    slug: "waste",
    name_en: "Medical Waste Management",
    name_ar: "إدارة النفايات الطبية",
    icon: "Biohazard",
    sort: 1,
    active: true,
    created_at: now,
  },
];

export const seedChecklists: Checklist[] = [...wasteForms];

export const defaultSettings: Settings = {
  header_en: [
    "Kingdom of Saudi Arabia",
    "Ministry of Health",
    "Gurayat Health Affairs",
    "Haditha General Hospital",
  ],
  header_ar: [
    "المملكة العربية السعودية",
    "وزارة الصحة",
    "الشئون الصحية بمحافظة القريات",
    "مستشفى الحديثة العام",
  ],
  copyright_owner: "Talanize",
  timezone: "Asia/Riyadh",
};

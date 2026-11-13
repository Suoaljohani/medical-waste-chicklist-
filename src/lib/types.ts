/**
 * check = item compliant ✓ / not compliant ✗; heading = section title only (no value);
 * container = descriptor of a waste container (kind, code, location). Holds no value and is never shown as an input.
 */
export type FieldType = "number" | "text" | "select" | "yesno" | "check" | "heading" | "container";

/** floor = floor-standing waste container; sharps = wall-mounted sharps container. */
export type ContainerKind = "floor" | "sharps";

export type Field = {
  key: string;
  label_en: string;
  label_ar: string;
  type: FieldType;
  unit?: string;
  min?: number | null;
  max?: number | null;
  required: boolean;
  options?: string[];
  /** Expected quantity printed next to the item, e.g. "2 each". */
  qty?: string;
  /** check / yesno: open the camera when ticked and attach the photo. */
  photo?: boolean;
  /** type "container" only. */
  kind?: ContainerKind;
  code?: string;
  location?: string;
};

export type Department = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  icon: string;
  sort: number;
  active: boolean;
  created_at: string;
};

export type Checklist = {
  id: string;
  department_id: string;
  title_en: string;
  title_ar: string;
  icon: string;
  color: string;
  fields: Field[];
  range_note: string;
  footer_note: string;
  orientation: "portrait" | "landscape";
  /** Report style. table = one row per entry; grid = items down the side, entries across (like the paper forms). */
  layout?: "table" | "grid" | null;
  /** Hash of the code staff must enter to open this checklist. Empty = not locked. Never sent to the browser. */
  lock_hash?: string;
  /** Sent to the browser instead of lock_hash. */
  locked?: boolean;
  sort: number;
  active: boolean;
  created_at: string;
};

export type FieldValue = string | number | boolean | null;

export type Submission = {
  id: string;
  checklist_id: string;
  department_id: string;
  employee_name: string;
  employee_no: string;
  submitted_at: string;
  values: Record<string, FieldValue>;
  signature: string;
  /** Photos taken for fields, keyed by field key (JPEG data URLs). Left out of list views. */
  photos?: Record<string, string>;
  flagged: boolean;
  note: string;
};

export type Settings = {
  header_en: string[];
  header_ar: string[];
  copyright_owner: string;
  timezone: string;
  admin_password_hash?: string;
  /** Inspection items applied to every container of a kind. */
  container_items?: Record<ContainerKind, Field[]>;
  /** True only for the local preview data set. Never set in production. */
  demo?: boolean;
  demo_day?: string;
};

/** Follow-up state of a non-compliant item. Separate from whether the inspection itself is complete. */
export type ObservationStatus = "open" | "progress" | "closed";

export type Observation = {
  /** `${submission_id}:${key}` */
  id: string;
  submission_id: string;
  key: string;
  label_ar: string;
  label_en: string;
  note: string;
  action: string;
  status: ObservationStatus;
  followup: string;
  updated_at: string | null;
  has_photo: boolean;
  checklist_id: string;
  checklist_title: string;
  container: { kind: ContainerKind; code: string; location: string } | null;
  department_id: string;
  department: string;
  employee_name: string;
  submitted_at: string;
};

export type Employee = {
  id: string;
  name: string;
  name_ar: string;
  employee_no: string;
  job_title: string;
  /** Never sent to the browser. */
  password_hash?: string;
  active: boolean;
  sort: number;
  created_at: string;
};

export type EntityName = "departments" | "checklists" | "submissions" | "employees";

export type Stats = {
  generated_at: string;
  totals: { today: number; week: number; month: number; all: number; flagged_month: number };
  compliance_today: { done: number; expected: number };
  trend: { date: string; count: number; flagged: number }[];
  per_checklist: {
    id: string;
    title_en: string;
    title_ar: string;
    icon: string;
    color: string;
    department: string;
    done_today: boolean;
    month_count: number;
    last_at: string | null;
    series: { at: string; value: number | null }[];
    primary_label: string;
    primary_unit: string;
    min: number | null;
    max: number | null;
  }[];
  recent: {
    id: string;
    checklist: string;
    icon: string;
    color: string;
    employee_name: string;
    submitted_at: string;
    flagged: boolean;
    summary: string;
  }[];
  top_staff: { name: string; count: number }[];
};

import { connection, type NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { containerOf } from "@/lib/containers";
import { observationsOf, summarize } from "@/lib/observations";
import { store } from "@/lib/store";
import type { ContainerKind, Observation } from "@/lib/types";
import { zoned } from "@/lib/utils";

const DAY = 86400e3;

export type ContainerState = {
  id: string;
  kind: ContainerKind;
  code: string;
  location: string;
  inspected: boolean;
  submission_id: string | null;
  at: string | null;
  by: string;
  entry: string;
  nonCompliant: number;
  open: number;
};

export type Overview = {
  generated_at: string;
  date: string;
  is_today: boolean;
  demo: boolean;
  totals: {
    containers: number;
    inspected: number;
    non_compliant: number;
    departments: number;
    departments_done: number;
    obs_open: number;
    obs_progress: number;
    lists: { total: number; done: number };
  };
  departments: {
    id: string;
    slug: string;
    name: string;
    icon: string;
    floor: { total: number; done: number };
    sharps: { total: number; done: number };
    total: number;
    done: number;
    non_compliant: number;
    open: number;
    last_at: string | null;
    staff: string[];
    containers: ContainerState[];
  }[];
  trend: { date: string; inspected: number; non_compliant: number }[];
  recent: {
    id: string;
    title: string;
    kind: ContainerKind | null;
    code: string;
    department: string;
    employee_name: string;
    submitted_at: string;
    nonCompliant: number;
    open: number;
  }[];
  observations: Observation[];
};

export async function GET(req: NextRequest) {
  await connection();
  if (!(await isAdmin())) return unauthorized();
  const s = store();
  const now = new Date();
  const todayKey = zoned(now).dayKey;
  const asked = req.nextUrl.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= todayKey ? asked : todayKey;

  const [deps, checklists, subs, settings] = await Promise.all([
    s.list("departments"),
    s.list("checklists"),
    s.submissions({ from: new Date(now.getTime() - 90 * DAY).toISOString(), limit: 20000 }),
    s.getSettings(),
  ]);
  const byId = new Map(checklists.map((c) => [c.id, c]));
  const depById = new Map(deps.map((d) => [d.id, d]));
  const keyed = subs.map((x) => ({ sub: x, day: zoned(x.submitted_at).dayKey }));
  const onDate = keyed.filter((x) => x.day === date).map((x) => x.sub); // newest first

  const visible = deps.filter((d) => d.active);
  const active = checklists.filter((c) => c.active && depById.get(c.department_id)?.active);
  const containers = active.filter((c) => containerOf(c));
  const lists = active.filter((c) => !containerOf(c));
  const latest = new Map<string, (typeof onDate)[number]>();
  for (const x of onDate) if (!latest.has(x.checklist_id)) latest.set(x.checklist_id, x);

  const departments: Overview["departments"] = visible
    .map((d) => {
      const mine = containers.filter((c) => c.department_id === d.id);
      const states: ContainerState[] = mine.map((c) => {
        const info = containerOf(c)!;
        const sub = latest.get(c.id);
        const sum = sub ? summarize(sub, c) : { nonCompliant: 0, open: 0 };
        return {
          id: c.id,
          ...info,
          inspected: !!sub,
          submission_id: sub?.id ?? null,
          at: sub?.submitted_at ?? null,
          by: sub?.employee_name ?? "",
          entry: typeof sub?.values.__entry === "string" ? sub.values.__entry : "",
          ...sum,
        };
      });
      const part = (kind: ContainerKind) => {
        const rows = states.filter((x) => x.kind === kind);
        return { total: rows.length, done: rows.filter((x) => x.inspected).length };
      };
      const done = states.filter((x) => x.inspected);
      return {
        id: d.id,
        slug: d.slug,
        name: d.name_ar || d.name_en,
        icon: d.icon,
        floor: part("floor"),
        sharps: part("sharps"),
        total: states.length,
        done: done.length,
        non_compliant: done.filter((x) => x.nonCompliant > 0).length,
        open: done.reduce((n, x) => n + x.open, 0),
        last_at: done.map((x) => x.at!).sort().at(-1) ?? null,
        staff: [...new Set(done.map((x) => x.by))].slice(0, 4),
        containers: states,
      };
    })
    .filter((d) => d.total > 0 || lists.some((c) => c.department_id === d.id));

  const withContainers = departments.filter((d) => d.total > 0);

  const trend: Overview["trend"] = [];
  for (let i = 13; i >= 0; i--) {
    const k = zoned(new Date(now.getTime() - i * DAY)).dayKey;
    const seen = new Map<string, number>();
    for (const x of keyed) {
      if (x.day !== k || seen.has(x.sub.checklist_id)) continue;
      const c = byId.get(x.sub.checklist_id);
      if (!c || !containerOf(c)) continue;
      seen.set(x.sub.checklist_id, summarize(x.sub, c).nonCompliant);
    }
    trend.push({ date: k, inspected: seen.size, non_compliant: [...seen.values()].filter((n) => n > 0).length });
  }

  const observations = subs.flatMap((x) => observationsOf(x, byId.get(x.checklist_id), depById.get(x.department_id)));
  const pending = observations.filter((o) => o.status !== "closed");

  const overview: Overview = {
    generated_at: now.toISOString(),
    date,
    is_today: date === todayKey,
    demo: !!settings.demo,
    totals: {
      containers: containers.length,
      inspected: containers.filter((c) => latest.has(c.id)).length,
      non_compliant: withContainers.reduce((n, d) => n + d.non_compliant, 0),
      departments: withContainers.length,
      departments_done: withContainers.filter((d) => d.done === d.total).length,
      obs_open: pending.filter((o) => o.status === "open").length,
      obs_progress: pending.filter((o) => o.status === "progress").length,
      lists: { total: lists.length, done: lists.filter((c) => latest.has(c.id)).length },
    },
    departments,
    trend,
    recent: onDate.slice(0, 8).map((x) => {
      const c = byId.get(x.checklist_id);
      const info = containerOf(c);
      return {
        id: x.id,
        title: info ? info.location : (c?.title_ar || c?.title_en || "قائمة محذوفة"),
        kind: info?.kind ?? null,
        code: info?.code ?? "",
        department: depById.get(x.department_id)?.name_ar || depById.get(x.department_id)?.name_en || "",
        employee_name: x.employee_name,
        submitted_at: x.submitted_at,
        ...summarize(x, c),
      };
    }),
    // Oldest first: the ones waiting longest come to the top.
    observations: pending.sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1)).slice(0, 6),
  };
  return Response.json(overview);
}

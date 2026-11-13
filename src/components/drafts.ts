"use client";

import type { FieldValue } from "@/lib/types";

/**
 * Unsaved answers kept on this phone, per container, so leaving the page (or losing signal) never loses
 * work. A draft is only a draft: it is not an inspection until the server accepts it.
 */
export type Draft = { values: Record<string, FieldValue>; photos: Record<string, string>; note: string; at: number; by: string };

const key = (id: string) => `mw_draft:${id}`;
const DAY = 86400e3;

export function readDraft(id: string, by: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key(id)) ?? "null") as Draft | null;
    if (!d || Date.now() - d.at > DAY || d.by !== by) return null;
    return d;
  } catch {
    return null;
  }
}

/** Returns false when the phone's storage is full (photos are large); answers then stay in memory only. */
export function writeDraft(id: string, d: Draft) {
  try {
    localStorage.setItem(key(id), JSON.stringify(d));
    return true;
  } catch {
    try {
      localStorage.setItem(key(id), JSON.stringify({ ...d, photos: {} }));
    } catch {}
    return false;
  }
}

export function clearDraft(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {}
}

export function draftIds(ids: string[], by: string) {
  return new Set(ids.filter((id) => readDraft(id, by)));
}

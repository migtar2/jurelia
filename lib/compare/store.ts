import type { CompareDecision, CompareSelection } from "./types";

const STORAGE_KEY = "jurelia-compare";

/* ── Internal helpers ── */

function read(): CompareSelection {
  if (typeof window === "undefined") return { a: null, b: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { a: null, b: null };
  } catch {
    return { a: null, b: null };
  }
}

function write(sel: CompareSelection): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
}

/* ── Public API ── */

export function getSelection(): CompareSelection {
  return read();
}

export function isSelected(roj: string): "a" | "b" | null {
  const sel = read();
  if (sel.a?.roj === roj) return "a";
  if (sel.b?.roj === roj) return "b";
  return null;
}

export function count(): number {
  const sel = read();
  return (sel.a ? 1 : 0) + (sel.b ? 1 : 0);
}

export function toggle(decision: CompareDecision): "added_a" | "added_b" | "removed" | "full" {
  const sel = read();

  // Check if already selected — remove it
  if (sel.a?.roj === decision.roj) {
    sel.a = null;
    write(sel);
    return "removed";
  }
  if (sel.b?.roj === decision.roj) {
    sel.b = null;
    write(sel);
    return "removed";
  }

  // Add to first available slot
  if (!sel.a) {
    sel.a = decision;
    write(sel);
    return "added_a";
  }
  if (!sel.b) {
    // Duplicate detection: same ROJ = same decision
    if (decision.roj === sel.a.roj) return "removed";
    sel.b = decision;
    write(sel);
    return "added_b";
  }

  return "full";
}

export function remove(position: "a" | "b"): void {
  const sel = read();
  sel[position] = null;
  write(sel);
}

export function clear(): void {
  write({ a: null, b: null });
}

export function isFull(): boolean {
  const sel = read();
  return sel.a !== null && sel.b !== null;
}
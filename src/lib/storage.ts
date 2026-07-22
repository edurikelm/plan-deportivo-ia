import type { GeneratedPlan } from "./types";
import { MAX_HISTORY } from "./types";

const STRUCTURE_KEY = "pd:structure";
const HISTORY_KEY = "pd:history";

export function getStructure(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STRUCTURE_KEY);
  } catch {
    return null;
  }
}

export function setStructure(value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STRUCTURE_KEY, value);
  } catch {}
}

export function getHistory(): GeneratedPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addToHistory(plan: GeneratedPlan): void {
  const current = getHistory();
  const next = [plan, ...current].slice(0, MAX_HISTORY);
  try {
    const value = JSON.stringify(next);
    localStorage.setItem(HISTORY_KEY, value);
    notifyInTab(HISTORY_KEY, value);
  } catch {}
}

export function removeFromHistory(id: string): void {
  const current = getHistory();
  const next = current.filter((p) => p.id !== id);
  try {
    const value = JSON.stringify(next);
    localStorage.setItem(HISTORY_KEY, value);
    notifyInTab(HISTORY_KEY, value);
  } catch {}
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
    notifyInTab(HISTORY_KEY, null);
  } catch {}
}

function notifyInTab(key: string, newValue: string | null): void {
  if (typeof window === "undefined") return;
  // Storage events NO se disparan en la misma pestaña; los disparamos
  // manualmente para que otros componentes con `useLocalStorage` se enteren.
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue,
      storageArea: window.localStorage,
    }),
  );
}

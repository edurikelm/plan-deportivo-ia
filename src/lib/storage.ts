import type { Clase, Idea } from "./types";

const CLASSES_KEY = "pd:classes";
const IDEAS_KEY = "pd:ideas";

function dispatchStorage(key: string, newValue: string): void {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue,
      storageArea: window.localStorage,
    }),
  );
}

// ─── Classes ──────────────────────────────────────────────────────────────────

export function getClasses(): Clase[] {
  try {
    const raw = localStorage.getItem(CLASSES_KEY);
    return raw ? (JSON.parse(raw) as Clase[]) : [];
  } catch {
    return [];
  }
}

export function setClasses(classes: Clase[]): void {
  const json = JSON.stringify(classes);
  localStorage.setItem(CLASSES_KEY, json);
  dispatchStorage(CLASSES_KEY, json);
}

export function addClass(clase: Clase): void {
  setClasses([...getClasses(), clase]);
}

export function updateClass(updated: Clase): void {
  setClasses(
    getClasses().map((c) => (c.id === updated.id ? updated : c)),
  );
}

export function removeClass(id: string): void {
  setClasses(getClasses().filter((c) => c.id !== id));
  // Cascade: remove all ideas belonging to this class
  removeIdeasByClass(id);
}

// ─── Ideas ────────────────────────────────────────────────────────────────────

export function getIdeas(): Idea[] {
  try {
    const raw = localStorage.getItem(IDEAS_KEY);
    return raw ? (JSON.parse(raw) as Idea[]) : [];
  } catch {
    return [];
  }
}

export function setIdeas(ideas: Idea[]): void {
  const json = JSON.stringify(ideas);
  localStorage.setItem(IDEAS_KEY, json);
  dispatchStorage(IDEAS_KEY, json);
}

export function addIdea(idea: Idea): void {
  setIdeas([...getIdeas(), idea]);
}

export function updateIdea(updated: Idea): void {
  setIdeas(
    getIdeas().map((i) => (i.id === updated.id ? updated : i)),
  );
}

/** Remove all ideas whose classId matches (cascade after removeClass). */
export function removeIdeasByClass(classId: string): void {
  setIdeas(getIdeas().filter((i) => i.classId !== classId));
}

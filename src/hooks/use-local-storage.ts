"use client";

import { useCallback, useSyncExternalStore } from "react";

type Listener = () => void;

const subs = new Map<string, Set<Listener>>();

function subscribeKey(key: string, listener: Listener): () => void {
  let set = subs.get(key);
  if (!set) {
    set = new Set();
    subs.set(key, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

function notify(key: string): void {
  subs.get(key)?.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key) notify(e.key);
  });
}

const SENTINEL = "__PD_LS_SENTINEL__";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  const getSnapshot = useCallback((): string => {
    return window.localStorage.getItem(key) ?? SENTINEL;
  }, [key]);

  const getServerSnapshot = useCallback((): string => SENTINEL, []);

  const subscribe = useCallback(
    (onChange: () => void) => subscribeKey(key, onChange),
    [key],
  );

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  let value: T;
  if (raw === SENTINEL) {
    value = initialValue;
  } else {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initialValue;
    }
  }

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const computed =
        typeof next === "function" ? (next as (p: T) => T)(value) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(computed));
        notify(key);
      } catch {}
    },
    [key, value],
  );

  return [value, setValue] as const;
}

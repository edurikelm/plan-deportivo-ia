"use client";

import { useCallback, useSyncExternalStore } from "react";

const SENTINEL = "__PD_USE_LOCAL_STORAGE_SENTINEL__";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) onStoreChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key],
  );

  const getSnapshot = useCallback((): string => {
    return window.localStorage.getItem(key) ?? SENTINEL;
  }, [key]);

  const getServerSnapshot = useCallback((): string => SENTINEL, []);

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
      const json = JSON.stringify(computed);
      window.localStorage.setItem(key, json);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: json,
          storageArea: window.localStorage,
        }),
      );
    },
    [key, value],
  );

  return [value, setValue] as const;
}

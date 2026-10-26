"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny localStorage-backed store for React (wishlist, Squish Box drafts,
 * quiz results). Values stay in this browser only. Tabs stay in sync via the
 * `storage` event. If storage is blocked (private mode), it still works for
 * the current visit.
 */
export interface LocalStore<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
  getServerSnapshot(): T;
}

export function createLocalStore<T>(key: string, parse: (raw: string | null) => T, empty: T): LocalStore<T> {
  let value = empty;
  let loaded = false;
  const listeners = new Set<() => void>();

  const read = () => {
    try {
      value = parse(localStorage.getItem(key));
    } catch {
      value = empty;
    }
  };
  const notify = () => listeners.forEach((l) => l());
  const onStorage = (e: StorageEvent) => {
    if (e.key !== key) return;
    read();
    notify();
  };

  return {
    get() {
      if (!loaded) {
        read();
        loaded = true;
      }
      return value;
    },
    set(next) {
      value = next;
      loaded = true;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep it in memory for this visit */
      }
      notify();
    },
    subscribe(listener) {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    getServerSnapshot: () => empty,
  };
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServerSnapshot);
}

const noop = () => () => {};

/** False during server render and hydration, true afterwards (avoids "empty" flashes). */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

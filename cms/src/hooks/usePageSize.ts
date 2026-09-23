import { useSyncExternalStore } from "react";

/**
 * How many rows every paginated list in the CMS asks the API for.
 *
 * One setting for the whole CMS, kept in localStorage so it survives a reload.
 * Held in a small store rather than per component state so that changing it on
 * one list is picked up by any other list already mounted.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50];

const STORAGE_KEY = "cms_page_size";
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

// localStorage is per browser and can throw outright in a locked down one, so
// every touch of it falls back to the default instead of breaking the list.
const readStored = () => {
  try {
    const stored = parseInt(localStorage.getItem(STORAGE_KEY) ?? "");
    return PAGE_SIZE_OPTIONS.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
};

let pageSize = readStored();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setPageSize = (size: number) => {
  if (!PAGE_SIZE_OPTIONS.includes(size) || size === pageSize) return;
  pageSize = size;
  try {
    localStorage.setItem(STORAGE_KEY, size.toString());
  } catch {
    // not saved, but still applied for this session
  }
  listeners.forEach((listener) => listener());
};

export const usePageSize = () =>
  useSyncExternalStore(subscribe, () => pageSize);

import { ANONYMOUS_ID_KEY } from "@/lib/constants";

/**
 * Same-tab writes don't fire `storage`, so identity changes announce
 * themselves on this event instead. `useStoredIdentity` listens for both.
 */
export const IDENTITY_EVENT = "planet-identity";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateAnonymousId(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem(ANONYMOUS_ID_KEY, id);
  window.dispatchEvent(new Event(IDENTITY_EVENT));
  return id;
}

/** Read-only peek. Unlike `getOrCreateAnonymousId`, this never writes. */
export function getAnonymousId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ANONYMOUS_ID_KEY);
}

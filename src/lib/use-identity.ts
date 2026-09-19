"use client";

import { useSyncExternalStore } from "react";
import { IDENTITY_EVENT, getAnonymousId } from "@/lib/identity";

/** localStorage changes under us from another tab, or from this one on save. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(IDENTITY_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(IDENTITY_EVENT, onChange);
  };
}

const serverAnonymousId = () => null;
const clientHydrated = () => true;
const serverHydrated = () => false;

/**
 * Who this device is, straight out of localStorage.
 *
 * Read through `useSyncExternalStore` rather than an effect so the value is
 * there on the first client render. `hydrated` is false until then — without
 * it a read-only page can't tell "nothing saved" apart from "not read yet"
 * and flashes the wrong empty state.
 */
export function useStoredIdentity(): {
  anonymousId: string | null;
  hydrated: boolean;
} {
  const anonymousId = useSyncExternalStore(
    subscribe,
    getAnonymousId,
    serverAnonymousId,
  );
  const hydrated = useSyncExternalStore(
    subscribe,
    clientHydrated,
    serverHydrated,
  );

  return { anonymousId, hydrated };
}

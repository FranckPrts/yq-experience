/**
 * Messages between the participant-frontend editor and its preview iframe.
 * Same origin both ways; each side checks origin and source before reading.
 */

export type PreviewScreen =
  | "intro"
  | "questions"
  | "tune"
  | "done"
  | "closed"
  | "notReady";

/** Editor → preview. Drafts are unsaved and unvalidated; the preview coerces. */
export type ToPreview =
  | { type: "yq-preview:draft"; theme: unknown; lexicon: unknown; copy: unknown }
  | { type: "yq-preview:show"; screen: PreviewScreen };

/** Preview → editor. */
export type FromPreview =
  | { type: "yq-preview:ready"; hasScript: boolean; hasQuestions: boolean }
  | { type: "yq-preview:screen"; screen: PreviewScreen };

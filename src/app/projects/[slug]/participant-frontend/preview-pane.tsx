"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectLexicon, ProjectTheme } from "@/lib/theme/project-theme";
import type { ProjectCopy } from "@/lib/theme/project-copy";
import type {
  FromPreview,
  PreviewScreen,
  ToPreview,
} from "./preview/protocol";

/**
 * The real participant page, in an iframe so it lays itself out against a real
 * viewport: at desktop width it is the side-by-side layout, at phone width the
 * stacked one — and it is scaled down to fit this column rather than squeezed,
 * which would show neither.
 */
const DEVICES = {
  desktop: { width: 1024, height: 680 },
  phone: { width: 390, height: 760 },
} as const;
type Device = keyof typeof DEVICES;

const SCREENS: { key: PreviewScreen; label: string }[] = [
  { key: "intro", label: "welcome" },
  { key: "questions", label: "questions" },
  { key: "tune", label: "tuning" },
  { key: "done", label: "saved" },
  { key: "closed", label: "closed" },
  { key: "notReady", label: "not ready" },
];

export default function PreviewPane({
  slug,
  theme,
  lexicon,
  copy,
}: {
  slug: string;
  theme: ProjectTheme;
  lexicon: ProjectLexicon;
  copy: ProjectCopy;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [screen, setScreen] = useState<PreviewScreen>(
    copy.introEnabled ? "intro" : "questions",
  );
  const [frame, setFrame] = useState<{
    hasScript: boolean;
    hasQuestions: boolean;
  } | null>(null);
  const [width, setWidth] = useState(0);

  // Read by the message handler, which outlives any one render.
  const latest = useRef({ theme, lexicon, copy, screen });
  useEffect(() => {
    latest.current = { theme, lexicon, copy, screen };
  });

  function send(message: ToPreview) {
    frameRef.current?.contentWindow?.postMessage(
      message,
      window.location.origin,
    );
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as FromPreview;
      if (data?.type === "yq-preview:ready") {
        // Also on a reload of the frame: it starts from what is saved, so
        // bring it back to the drafts and the screen being looked at.
        const { theme, lexicon, copy, screen } = latest.current;
        send({ type: "yq-preview:draft", theme, lexicon, copy });
        send({ type: "yq-preview:show", screen });
        setFrame({ hasScript: data.hasScript, hasQuestions: data.hasQuestions });
      } else if (data?.type === "yq-preview:screen") {
        setScreen(data.screen);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (frame) send({ type: "yq-preview:draft", theme, lexicon, copy });
  }, [frame, theme, lexicon, copy]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  function show(next: PreviewScreen) {
    setScreen(next);
    send({ type: "yq-preview:show", screen: next });
  }

  // Mirrors the preview's own fall-through, so the highlighted tab is the
  // screen actually on show.
  const hasQuestions = frame?.hasQuestions ?? false;
  let shown = screen;
  if (shown === "intro" && !copy.introEnabled) shown = hasQuestions ? "questions" : "tune";
  if (shown === "questions" && !hasQuestions) shown = "tune";
  const available = SCREENS.filter(
    ({ key }) =>
      (key !== "intro" || copy.introEnabled) &&
      (key !== "questions" || hasQuestions),
  );

  const size = DEVICES[device];
  const scale = width ? Math.min(1, width / size.width) : 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-xs text-dim">preview</h2>
        <div className="flex gap-3 text-[11px]">
          {(Object.keys(DEVICES) as Device[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              className={
                device === key
                  ? "text-paper underline underline-offset-4"
                  : "text-dim hover:text-paper"
              }
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {available.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => show(key)}
            className={
              shown === key
                ? "text-paper underline underline-offset-4"
                : "text-dim hover:text-paper"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div ref={boxRef} className="w-full">
        <div
          className="overflow-hidden border border-paper/10"
          style={{
            width: size.width * scale,
            height: size.height * scale,
            margin: device === "phone" ? "0 auto" : undefined,
          }}
        >
          <iframe
            ref={frameRef}
            src={`/projects/${slug}/participant-frontend/preview`}
            title="Participant page preview"
            style={{
              width: size.width,
              height: size.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-dim">
        The participant page itself, with your unsaved changes and the latest
        script. Nothing here signs anyone in or saves an avatar. The background
        behind the avatar is drawn by the script, not by the palette.
      </p>
    </section>
  );
}

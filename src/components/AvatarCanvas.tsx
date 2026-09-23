"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ParamValues } from "@/lib/params/coerce";

/** Matches the version YouQuantified's own iframe loads — see the plan, 5B. */
const P5_CDN = "https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js";

export type SketchLog = {
  message: string;
  stack?: string;
  lineno?: number;
  type: "error" | "log";
};

type AvatarCanvasProps = {
  /** The delivered p5 script, global mode. */
  code: string;
  /** Render values only — `text` answers don't belong here. */
  params: ParamValues;
  /**
   * Host-supplied knobs the participant never sees: `intensity`, `center_y`,
   * `size`. Merged over `params` on the way out, so the declaration stays a
   * description of what a *participant* controls and never has to grow a field
   * to accommodate the page that renders it.
   *
   * `intensity` is the one that matters here — every sketch eases toward it, so
   * holding it at 0 until the avatar is known lets the real one fade in rather
   * than having a default sit there pretending.
   */
  host?: ParamValues;
  extensions?: { url: string }[];
  className?: string;
  onLog?: (log: SketchLog) => void;
};

/**
 * Anything interpolated into an inline `<script>` has to be unable to close it.
 * Tenant p5 is arbitrary text; `</script>` inside a string literal would end the
 * element and drop the rest of the sketch into the document as markup.
 */
function inlineScript(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

export default function AvatarCanvas({
  code,
  params,
  host,
  extensions = [],
  className = "",
  onLog,
}: AvatarCanvasProps) {
  // Host knobs win: a declaration cannot override the page's own composition.
  // Compared by value, like `extensions` — an inline `{ intensity: 1 }` would
  // otherwise be a fresh object every render and re-post the params each time.
  const hostKey = JSON.stringify(host ?? null);
  const payload = useMemo(
    () => (host ? { ...params, ...(JSON.parse(hostKey) as ParamValues) } : params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, hostKey],
  );
  const frameRef = useRef<HTMLIFrameElement>(null);
  const onLogRef = useRef(onLog);
  useEffect(() => {
    onLogRef.current = onLog;
  });

  /**
   * The frame is booted once with whatever params it had at mount; everything
   * after that arrives by message. Snapshotting through a state initializer
   * keeps `params` out of the memo's dependencies, so a slider move cannot
   * rebuild the document and restart the sketch.
   */
  const [initialParams] = useState(() => payload);

  /**
   * Extensions are compared by value, not identity. A caller passing an inline
   * `[{…}]` would otherwise hand us a fresh array every render, bust the memo,
   * and tear the sketch down on each keystroke.
   */
  const extensionsKey = JSON.stringify(extensions);

  const srcDoc = useMemo(() => {
    const scripts = (JSON.parse(extensionsKey) as { url: string }[])
      .map(
        (extension) =>
          `<script src="${extension.url}" crossorigin="anonymous"></script>`,
      )
      .join("\n");

    /*
     * The transport, and the one place this deviates from YouQuantified's
     * p5window.js. Their frame runs with `allow-same-origin`, so a bare
     * `postMessage(msg)` — whose targetOrigin defaults to "/" — happens to
     * match. Ours is sandboxed to an opaque origin, where "/" can never match
     * and every message would be dropped in silence. Hence the explicit "*"
     * at both ends.
     *
     * "*" is not a loosening here, because neither side authenticates by
     * origin: the frame has none to compare against, and ours would be "null"
     * to it. Both directions check the *identity* of the window instead, which
     * is not forgeable — only this page holds a reference to the frame, and
     * only the frame's own parent is this page.
     */
    const bootstrap = `
      var data = ${inlineScript(JSON.stringify(initialParams))};

      function sendEvent(message) {
        if (typeof message === 'object' && message !== null) {
          window.parent.postMessage(JSON.stringify(message), '*');
        }
      }

      window.addEventListener('message', function (event) {
        if (event.source !== window.parent) return;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          sendEvent({ log: { message: 'Bad params payload', type: 'error' } });
        }
      });

      window.addEventListener('error', function (event) {
        sendEvent({ log: {
          message: (event.error && event.error.message) || event.message || 'Unknown error',
          stack: (event.error && event.error.stack) || '',
          lineno: event.lineno || 0,
          type: 'error'
        }});
      });
    `;

    return /* html */ `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="${P5_CDN}" crossorigin="anonymous"></script>
    ${scripts}
    <style>
      html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #14100e; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script>${bootstrap}</script>
    <script>
      try {
        ${inlineScript(code)}
        if (typeof window.setup === 'function') {
          var originalSetup = window.setup;
          window.setup = function () {
            try {
              return originalSetup.apply(this, arguments);
            } catch (error) {
              sendEvent({ log: { message: 'Error in setup: ' + (error.message || String(error)), stack: error.stack || '', type: 'error' } });
              throw error;
            }
          };
        }
        if (typeof window.draw === 'function') {
          var originalDraw = window.draw;
          window.draw = function () {
            try {
              return originalDraw.apply(this, arguments);
            } catch (error) {
              sendEvent({ log: { message: 'Error in draw: ' + (error.message || String(error)), stack: error.stack || '', type: 'error' } });
              throw error;
            }
          };
        }
      } catch (error) {
        sendEvent({ log: { message: error.message || String(error), stack: error.stack || '', type: 'error' } });
      }
    </script>
  </body>
</html>`;
  }, [code, extensionsKey, initialParams]);

  // Hand new params to the running sketch without tearing it down.
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify(payload), "*");
  }, [payload]);

  // Inbound: the frame's origin is opaque, so `event.origin` arrives as "null"
  // and is worthless as a check. Identity of the sender is what still means
  // something — nothing but our own frame can satisfy it.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      let incoming: { log?: SketchLog } | null = null;
      try {
        incoming =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return; // untrusted data, not a protocol
      }
      if (incoming?.log) onLogRef.current?.(incoming.log);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      title="avatar"
      srcDoc={srcDoc}
      // No `allow-same-origin`: with it, tenant p5 reaches this document and
      // the session cookies it carries. Dropping it is what makes the explicit
      // targetOrigin above necessary.
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className={`block border-0 bg-void ${className}`}
    />
  );
}

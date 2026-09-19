"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import StarCanvasClient from "@/components/StarCanvasClient";
import { TermLoading } from "@/components/terminal";
import { getPlanet } from "@/lib/planets";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import type { Planet } from "@/lib/types/planet";
import { STAR_KEYS, hueToCss, starInkColor } from "@/lib/types/star";

/** Matches the editor so a planet looks the same on both screens. */
const STAR_CENTER_Y = 0.4;

export default function StarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [planet, setPlanet] = useState<Planet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPlanet(id)
      .then((row) => {
        if (!cancelled) {
          setPlanet(row);
          if (!row) setError("star not found");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <TermLoading />;

  if (error || !planet) {
    return (
      <div
        className="font-terminal flex min-h-dvh flex-col items-center justify-center gap-4"
        style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
      >
        <p className="text-red-300">{error ?? "not found"}</p>
        <Link
          href="/admin"
          className="text-sm text-dim underline underline-offset-4"
        >
          back to admin
        </Link>
      </div>
    );
  }

  const ink = starInkColor(planet.params.hue);
  const inkBright = hueToCss(planet.params.hue, 45, 90);

  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient params={planet.params} centerY={STAR_CENTER_Y} />
      </div>

      {/* Sinks the star back into the void behind the readout. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-[52vh] bg-gradient-to-t from-void via-void/90 to-transparent" />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8 pt-6">
        <header className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="text-sm" style={{ color: ink }}>
              star_name :
            </span>
            <span
              className="truncate text-lg"
              style={{ color: inkBright }}
              title={planet.name}
            >
              {planet.name}
            </span>
          </div>
          <Link
            href="/admin"
            className="shrink-0 text-xs text-dim underline underline-offset-4 hover:text-paper/80"
          >
            admin
          </Link>
        </header>

        <p className="mt-2 text-sm text-dim">
          by {planet.creator_name}
          {planet.is_staged ? " · staged" : ""}
        </p>

        <div className="min-h-[38vh] flex-1" />

        <div className="flex flex-col gap-1">
          {STAR_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2 py-1.5">
              <span className="w-[11ch] shrink-0 text-sm" style={{ color: ink }}>
                {key}
              </span>
              <span className="shrink-0 text-sm" style={{ color: ink }}>
                :
              </span>
              <span className="pl-2 text-sm">{planet.params[key]}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

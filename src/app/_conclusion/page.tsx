import Link from "next/link";
import ConclusionCharts from "@/components/ConclusionCharts";
import StarCanvasClient from "@/components/StarCanvasClient";
import { parseConclusionSearchParams } from "@/lib/conclusion-params";
import { loadSessionScoreRowsFromCsv } from "@/lib/session-scores-csv";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";

/**
 * Post-experience conclusion: score distribution from the exported CSV,
 * optionally personalized via ?run= and ?planet= from /results.
 */
export default async function ConclusionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rows = loadSessionScoreRowsFromCsv();
  const personalization = parseConclusionSearchParams(await searchParams);

  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient intensity={0} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 pb-16 pt-6">
        <header className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg">conclusion</h1>
          <Link
            href="/results"
            className="shrink-0 text-xs text-dim underline underline-offset-4 hover:text-paper/80"
          >
            your results
          </Link>
        </header>
        <h3 className="mt-6 text-sm text-dim">score distribution</h3>

        <ConclusionCharts
          rows={rows}
          runIds={personalization.runIds}
          planetIds={personalization.planetIds}
        />
      </main>
    </div>
  );
}

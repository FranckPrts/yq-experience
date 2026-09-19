"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import PlanetEditor from "@/components/PlanetEditor";
import { TermLoading } from "@/components/terminal";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import { useMyPlanets } from "@/lib/use-my-planets";

/**
 * Coming back to one star from the list — rename it, retune it.
 *
 * Only stars made on this device are editable here: the id has to be one of
 * this anonymous id's own, or the page is a dead end rather than a way into
 * someone else's star. `/p/[id]` stays the read-only view of any of them.
 */
export default function EditPlanetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { myPlanets, creator, anonymousId, loading, error } = useMyPlanets();

  if (loading) return <TermLoading />;

  const planet = myPlanets.find((row) => row.id === id) ?? null;

  if (!planet || !creator || !anonymousId) {
    return (
      <div
        className="font-terminal flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
      >
        <p className="max-w-[34ch] text-sm leading-relaxed text-dim">
          {error ?? "this star wasn't made on this device"}
        </p>
        <Link href="/" className="text-sm underline underline-offset-4">
          your stars
        </Link>
      </div>
    );
  }

  return (
    <PlanetEditor
      mode="edit"
      planet={planet}
      creatorName={creator.name}
      creatorEmail={creator.email}
      anonymousId={anonymousId}
      onCancel={() => router.push("/")}
      onDone={() => router.push("/")}
    />
  );
}

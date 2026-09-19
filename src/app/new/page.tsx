"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PlanetEditor from "@/components/PlanetEditor";
import { TermLoading } from "@/components/terminal";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import { useMyPlanets } from "@/lib/use-my-planets";

/**
 * Another star for someone who already has one. Name and email are settled
 * — this picks up at naming, and lands back on the list.
 *
 * Reaching it with no stars at all means no identity to inherit, so it points
 * home, where the intro asks for one.
 */
export default function NewPlanetPage() {
  const router = useRouter();
  const { creator, anonymousId, loading, error } = useMyPlanets();

  if (loading) return <TermLoading />;

  if (!creator || !anonymousId) {
    return (
      <div
        className="font-terminal flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
      >
        <p className="max-w-[34ch] text-sm leading-relaxed text-dim">
          {error ?? "no star on this device yet — start with your first one"}
        </p>
        <Link href="/" className="text-sm underline underline-offset-4">
          create your star
        </Link>
      </div>
    );
  }

  return (
    <PlanetEditor
      mode="new"
      creatorName={creator.name}
      creatorEmail={creator.email}
      anonymousId={anonymousId}
      onCancel={() => router.push("/")}
      onDone={() => router.push("/")}
    />
  );
}

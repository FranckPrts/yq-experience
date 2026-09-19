"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import PlanetEditor from "@/components/PlanetEditor";
import StarCanvasClient from "@/components/StarCanvasClient";
import {
  TermButton,
  TermField,
  TermGhostLinkButton,
  TermLinkButton,
  TermLoading,
  TermRule,
} from "@/components/terminal";
import { getOrCreateAnonymousId } from "@/lib/identity";
import { formatScore, summarizePlanet } from "@/lib/leaderboard";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import { useMyPlanets, type Creator } from "@/lib/use-my-planets";
import type { Planet } from "@/lib/types/planet";
import type { SessionScore } from "@/lib/types/session-score";
import { DEFAULT_STAR_PARAMS, hueToCss, starInkColor } from "@/lib/types/star";

/**
 * The participant's home.
 *
 * Everyone lands on their star list — one row or five, it's the same screen,
 * and it's where creating and editing start from. Someone with no stars yet
 * never sees the list: they get the intro instead, and arrive at it with their
 * first star already on it.
 *
 * "Star" is the participant-facing word throughout; the rows are still
 * `planets` in the database and in the types, which admin and YQ both speak.
 */

const IDENTITY_INK = starInkColor(DEFAULT_STAR_PARAMS.hue);

/** TODO: the lab's page. Kept inert until there's somewhere to point it. */
const LAB_URL = "https://docs.google.com/presentation/d/1qN0DVo8qp8470tybFpexpE6f0giwSPi4s3w4CrMs618";

/** Name and email, asked once and then fixed — every star row carries them. */
function IdentityStep({
  creator,
  onSubmit,
}: {
  creator: Creator;
  onSubmit: (creator: Creator) => void;
}) {
  const [name, setName] = useState(creator.name);
  const [email, setEmail] = useState(creator.email);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("first_name is required");
      return;
    }
    setError(null);
    onSubmit({ name: name.trim(), email: email.trim() });
  }

  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      {/* Grain only — the star arrives with the sliders, a screen later. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient intensity={0} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8 pt-6">
        <form onSubmit={submit} className="flex flex-1 flex-col">
          <p className="max-w-[34ch] pt-[16vh] text-sm leading-relaxed text-dim">
            welcome! before creating your star, we want to know about you
          </p>

          <div className="mt-16 flex flex-col gap-12">
            <TermField
              label="first_name:"
              value={name}
              onChange={setName}
              inkColor={IDENTITY_INK}
              autoComplete="name"
              required
            />
            <TermField
              label="email (optional):"
              type="email"
              value={email}
              onChange={setEmail}
              inkColor={IDENTITY_INK}
              autoComplete="email"
            />
          </div>

          {error && <p className="mt-6 text-sm text-red-300">{error}</p>}

          <div className="mt-auto mb-[22vh] flex justify-end">
            <TermButton type="submit">next</TermButton>
          </div>
        </form>
      </main>
    </div>
  );
}

/** One star in the list: its name, in its own ink, and how it has scored. */
function PlanetRow({
  planet,
  scores,
}: {
  planet: Planet;
  scores: SessionScore[];
}) {
  const { runs, best } = summarizePlanet(scores, planet.id);

  return (
    <li>
      <TermRule />
      <Link
        href={`/p/${planet.id}/edit`}
        className="flex items-center gap-4 py-4 transition-opacity hover:opacity-80"
      >
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-base"
            style={{ color: hueToCss(planet.params.hue, 45, 90) }}
            title={planet.name}
          >
            {planet.name}
          </p>
          <p className="mt-1 text-xs tabular-nums text-dim">
            {best === null
              ? "no runs yet"
              : `best ${formatScore(best)} · ${runs} ${runs === 1 ? "run" : "runs"}`}
          </p>
        </div>
        <span className="shrink-0 text-xs text-dim underline underline-offset-4">
          edit
        </span>
      </Link>
    </li>
  );
}

/** `label : value`, the readout idiom the star controls use. */
function IdentityLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="w-[6ch] shrink-0 text-sm text-dim">{label}</span>
      <span className="shrink-0 text-sm text-dim">:</span>
      <span className="min-w-0 flex-1 truncate pl-2 text-sm">{value}</span>
    </div>
  );
}

function PlanetList({
  planets,
  creator,
  scores,
}: {
  planets: Planet[];
  creator: Creator | null;
  scores: SessionScore[];
}) {
  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      {/* The same noisy void the flow sits on, with no star drawn in it —
          here the names carry the color instead. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient intensity={0} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-16 pt-6">
        <header>
          <h1 className="text-lg">your stars</h1>
        </header>

        <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-dim">
          {planets.length === 1
            ? "your star — tap it to tune it, or make another"
            : `${planets.length} stars, all of them yours — tap one to tune it`}
        </p>

        {creator && (
          <div className="mt-8 flex flex-col">
            <IdentityLine label="name" value={creator.name} />
            {creator.email && (
              <IdentityLine label="email" value={creator.email} />
            )}
          </div>
        )}

        <ul className="mt-8">
          {planets.map((planet) => (
            <PlanetRow key={planet.id} planet={planet} scores={scores} />
          ))}
        </ul>
        <TermRule />

        {/*
         * The board first, and filled: everyone should find their way to it.
         * Making another star is the quieter, outlined choice under it.
         */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <TermLinkButton
            href="/results"
            className="w-full max-w-[16rem] text-center"
          >
            your results
          </TermLinkButton>
          <TermGhostLinkButton
            href="/new"
            className="w-full max-w-[16rem] text-center"
          >
            create a new star
          </TermGhostLinkButton>
        </div>

        <a
          href={LAB_URL}
          target="_blank"
          className="mt-10 self-center text-xs text-dim underline underline-offset-4 hover:text-paper/80"
        >
          more about our lab
        </a>
      </main>
    </div>
  );
}

export default function HomePage() {
  const { myPlanets, creator, anonymousId, scores, loading, error } =
    useMyPlanets();

  /**
   * Identity for the very first planet, held only until that planet exists —
   * from then on it's read off a row. Kept while they step back and forth so
   * backing out of naming doesn't wipe what they typed.
   */
  const [draftCreator, setDraftCreator] = useState<Creator>({
    name: "",
    email: "",
  });
  const [creatingFirst, setCreatingFirst] = useState(false);
  /**
   * The planet just written, kept until the live list catches up — without it
   * the intro would flash back for as long as the realtime insert takes.
   */
  const [justCreated, setJustCreated] = useState<Planet | null>(null);

  // Same as before: this device gets its id on arrival, not on save.
  useEffect(() => {
    getOrCreateAnonymousId();
  }, []);

  const planets = useMemo(() => {
    if (!justCreated) return myPlanets;
    if (myPlanets.some((planet) => planet.id === justCreated.id)) {
      return myPlanets;
    }
    return [...myPlanets, justCreated];
  }, [myPlanets, justCreated]);

  if (loading) return <TermLoading />;

  if (planets.length === 0) {
    if (!creatingFirst) {
      return (
        <IdentityStep
          creator={draftCreator}
          onSubmit={(entered) => {
            setDraftCreator(entered);
            setCreatingFirst(true);
          }}
        />
      );
    }

    return (
      <PlanetEditor
        mode="first"
        creatorName={draftCreator.name}
        creatorEmail={draftCreator.email}
        anonymousId={anonymousId ?? getOrCreateAnonymousId()}
        onCancel={() => setCreatingFirst(false)}
        onSaved={setJustCreated}
        onDone={() => setCreatingFirst(false)}
      />
    );
  }

  return (
    <>
      <PlanetList planets={planets} creator={creator} scores={scores} />
      {error && (
        <p className="fixed inset-x-0 bottom-4 z-20 text-center text-sm text-red-300">
          {error}
        </p>
      )}
    </>
  );
}

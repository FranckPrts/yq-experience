"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AvatarCanvas from "@/components/AvatarCanvas";
import { renderValues } from "@/lib/params/coerce";
import {
  hueDegrees,
  isNumeric,
  type NumericParameter,
  type Parameter,
} from "@/lib/params/types";
import { normalizeAvatar, type Avatar } from "@/lib/spoke/avatars";
import type { ProjectLexicon } from "@/lib/theme/project-theme";
import { stageAction, unstageAllAction } from "./actions";

const MAX_STAGED = 2;
const SCORE_POLL_MS = 10_000;

type Score = {
  id: string;
  yq_session_id: string;
  avatar_a_id: string;
  avatar_b_id: string;
  score: number;
  duration: number | null;
  recorded_at: string;
};

/**
 * A cheap stand-in for a live sketch, built from the declaration's own hue
 * parameters. One iframe per row is out of the question — browsers cap WebGL
 * contexts at around sixteen — so rows get a gradient and the selected avatar
 * gets the real thing in the preview.
 */
function Swatch({
  avatar,
  hues,
  noun,
}: {
  avatar: Avatar;
  hues: NumericParameter[];
  noun: string;
}) {
  if (hues.length === 0) {
    return (
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-paper/20 text-[10px] text-dim"
      >
        {(avatar.name || noun).slice(0, 1).toUpperCase()}
      </span>
    );
  }
  const stops = hues.slice(0, 2).map((p) => {
    const deg = hueDegrees(p, Number(avatar.params[p.name] ?? p.default));
    return `hsl(${deg.toFixed(0)} 80% 60%)`;
  });
  const [inner, outer = inner] = stops;
  return (
    <span
      aria-hidden
      className="h-8 w-8 shrink-0 rounded-full"
      style={{ background: `radial-gradient(circle, ${inner} 0%, ${outer} 70%, transparent 72%)` }}
    />
  );
}

function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function OpsConsole({
  slug,
  projectUrl,
  publishableKey,
  parameters,
  code,
  scriptVersion,
  lexicon,
  canStage,
}: {
  slug: string;
  projectUrl: string;
  publishableKey: string;
  parameters: Parameter[];
  code: string | null;
  scriptVersion: number | null;
  lexicon: ProjectLexicon;
  canStage: boolean;
}) {
  const [avatars, setAvatars] = useState<Map<string, Avatar>>(new Map());
  const [scores, setScores] = useState<Score[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const clientRef = useRef<SupabaseClient | null>(null);

  const hues = useMemo(
    () =>
      parameters.filter(
        (p): p is NumericParameter => isNumeric(p) && p.display === "hue",
      ),
    [parameters],
  );

  useEffect(() => {
    // Its own client, with no persisted session: an operator watching the room
    // must not take out an anonymous participant identity by doing so. Reads
    // and Realtime work on the publishable key alone, because provisioning made
    // both tables readable to it.
    const client = createClient(projectUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientRef.current = client;
    let cancelled = false;

    async function loadAvatars() {
      const { data, error } = await client
        .from("avatars")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLive("offline");
        return;
      }
      setAvatars(
        new Map((data ?? []).map((row) => {
          const a = normalizeAvatar(row, parameters);
          return [a.id, a];
        })),
      );
    }

    async function loadScores() {
      const { data } = await client
        .from("session_scores")
        .select("id,yq_session_id,avatar_a_id,avatar_b_id,score,duration,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (!cancelled && data) setScores(data as Score[]);
    }

    void loadAvatars();
    void loadScores();

    // Avatars change constantly during an event and are in the realtime
    // publication; scores arrive once a run, minutes apart, and are not — a
    // ten-second poll is plenty and needs no schema change.
    const channel = client
      .channel(`ops-${slug}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "avatars" },
        (payload) => {
          setAvatars((prev) => {
            const next = new Map(prev);
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              if (id) next.delete(id);
            } else {
              const a = normalizeAvatar(payload.new, parameters);
              next.set(a.id, a);
            }
            return next;
          });
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setLive("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setLive("offline");
      });

    const poll = setInterval(loadScores, SCORE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
      void client.removeChannel(channel);
    };
  }, [projectUrl, publishableKey, parameters, slug]);

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return [...avatars.values()]
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [avatars, filter]);

  // Staged in the order the scene will read them: first staged, first shown.
  const staged = useMemo(
    () =>
      [...avatars.values()]
        .filter((a) => a.is_staged)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at)),
    [avatars],
  );

  const current = selected ? avatars.get(selected) ?? null : null;
  const previewParams = useMemo(
    () => (current ? renderValues(parameters, current.params) : {}),
    [current, parameters],
  );
  const nameOf = (id: string) => avatars.get(id)?.name || "(unnamed)";

  function stage(avatar: Avatar, on: boolean) {
    setError(null);
    const form = new FormData();
    form.set("slug", slug);
    form.set("id", avatar.id);
    form.set("staged", on ? "true" : "false");
    startTransition(async () => {
      const result = await stageAction(form);
      if (result.error) setError(result.error);
    });
  }

  function clearStage() {
    setError(null);
    const form = new FormData();
    form.set("slug", slug);
    startTransition(async () => {
      const result = await unstageAllAction(form);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xs text-dim">
              on stage · {staged.length} of {MAX_STAGED}
            </h2>
            <span className="text-[11px] text-dim">
              <span
                className={
                  live === "live"
                    ? "text-emerald-400"
                    : live === "offline"
                      ? "text-red-400"
                      : ""
                }
              >
                ●
              </span>{" "}
              {live}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: MAX_STAGED }, (_, i) => {
              const a = staged[i];
              return (
                <div
                  key={i}
                  className="flex min-h-14 items-center gap-3 rounded border border-paper/15 p-3"
                >
                  {a ? (
                    <>
                      <Swatch avatar={a} hues={hues} noun={lexicon.noun} />
                      <button
                        type="button"
                        onClick={() => setSelected(a.id)}
                        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                      >
                        {a.name || "(unnamed)"}
                      </button>
                      {canStage && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => stage(a, false)}
                          className="shrink-0 text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
                        >
                          take off
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-dim">empty</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] leading-relaxed text-dim">
              The scene reads these two and clears them itself when a run ends —
              so a pair can leave the stage without anyone here touching it.
            </p>
            {canStage && staged.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={clearStage}
                className="shrink-0 text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
              >
                clear stage
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-xs text-amber-400/90">
              {error}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xs text-dim">
              {lexicon.nounPlural} · {avatars.size}
            </h2>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="search by name"
              className="term-input w-40 border-b border-paper/20 text-xs"
            />
          </div>

          {list.length === 0 ? (
            <p className="text-xs text-dim">
              {avatars.size === 0
                ? `No ${lexicon.nounPlural} yet. They appear here as participants save them.`
                : "Nothing matches."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {list.map((a) => {
                const full = !a.is_staged && staged.length >= MAX_STAGED;
                return (
                  <li
                    key={a.id}
                    className={`flex items-center gap-3 border-b border-paper/10 py-2 ${
                      selected === a.id ? "bg-paper/5" : ""
                    }`}
                  >
                    <Swatch avatar={a} hues={hues} noun={lexicon.noun} />
                    <button
                      type="button"
                      onClick={() => setSelected(a.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm">
                        {a.name || "(unnamed)"}
                        {a.is_staged && <span className="text-emerald-400"> · on stage</span>}
                      </span>
                      <span className="text-[11px] text-dim">
                        {ago(a.created_at)}
                        {a.updated_at !== a.created_at && ` · edited ${ago(a.updated_at)}`}
                      </span>
                    </button>
                    {canStage && (
                      <button
                        type="button"
                        disabled={pending || full}
                        title={full ? "Two are already on stage" : undefined}
                        onClick={() => stage(a, !a.is_staged)}
                        className="shrink-0 text-xs text-dim underline-offset-4 hover:text-paper hover:underline disabled:opacity-30 disabled:no-underline"
                      >
                        {a.is_staged ? "take off" : "stage"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="flex w-full flex-col gap-6 lg:w-[24rem] lg:shrink-0">
        <section className="flex flex-col gap-2">
          <h2 className="text-xs text-dim">preview</h2>
          <div className="relative aspect-square w-full overflow-hidden rounded border border-paper/10 bg-void">
            {current && code ? (
              <AvatarCanvas
                key={`${scriptVersion}-${current.id}`}
                code={code}
                params={previewParams}
                className="h-full w-full"
              />
            ) : (
              <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-dim">
                Select a {lexicon.noun} to see it as the participant made it.
              </p>
            )}
          </div>
          {current && (
            <div className="flex flex-col gap-1 text-xs">
              <p className="text-sm">{current.name || "(unnamed)"}</p>
              {Object.entries(current.answers).map(([k, v]) => (
                <p key={k} className="text-dim">
                  {k}: {v || "—"}
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs text-dim">latest scores</h2>
          {scores.length === 0 ? (
            <p className="text-xs text-dim">
              None yet. The scene writes one when each run ends.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs">
              {scores.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-3 border-b border-paper/10 pb-1"
                >
                  <span className="min-w-0 truncate">
                    {nameOf(s.avatar_a_id)} × {nameOf(s.avatar_b_id)}
                  </span>
                  <span className="shrink-0 text-dim">
                    {Number(s.score).toFixed(1)}
                    {s.duration != null && ` · ${Number(s.duration).toFixed(1)}s`}
                    {" · "}
                    {ago(s.recorded_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

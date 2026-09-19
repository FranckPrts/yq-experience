"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import StarSliders from "@/components/StarSliders";
import StarSwatch from "@/components/StarSwatch";
import { ADMIN_SESSION_KEY, MAX_STAGED } from "@/lib/constants";
import { createClient } from "@/utils/supabase/client";
import {
  listPlanets,
  normalizePlanet,
  replaceStagedPlanets,
  updatePlanet,
} from "@/lib/planets";
import {
  createSessionScore,
  deleteSessionScore,
  listSessionScores,
  updateSessionScore,
} from "@/lib/session-scores";
import type { Planet, PlanetUpdate } from "@/lib/types/planet";
import type {
  SessionScore,
  SessionScoreInsert,
  SessionScoreUpdate,
} from "@/lib/types/session-score";
import { clampStar, type StarKey } from "@/lib/types/star";

type SessionScoreDraft = {
  yq_session_id: string;
  planet_a_id: string;
  planet_b_id: string;
  score: number;
  strategy: string | null;
  duration: number | null;
  recorded_at: string;
};

type PlanetStageFilter = "all" | "live" | "pending" | "unstaged";
type PlanetSort = "newest" | "oldest" | "name";
type ScoreSort = "recent" | "oldest" | "high" | "low";

const NO_STRATEGY = "__none__";

function newSessionScoreDraft(planets: Planet[]): SessionScoreDraft {
  const a = planets[0]?.id ?? "";
  const b = planets.find((p) => p.id !== a)?.id ?? "";
  return {
    yq_session_id: `manual-${crypto.randomUUID()}`,
    planet_a_id: a,
    planet_b_id: b,
    score: 0,
    strategy: null,
    duration: null,
    recorded_at: new Date().toISOString(),
  };
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sortScoresByRecordedAt(scores: SessionScore[]): SessionScore[] {
  return [...scores].sort(
    (a, b) =>
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );
}

function planetOptionLabel(planet: Planet): string {
  return `${planet.name} (${planet.creator_name})`;
}

function PlanetSearchSelect({
  label,
  planets,
  value,
  onChange,
  required,
}: {
  label: string;
  planets: Planet[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = planets.find((p) => p.id === value);
  const displayLabel = selected
    ? planetOptionLabel(selected)
    : value
      ? `${value} (missing)`
      : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return planets;
    return planets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.creator_name.toLowerCase().includes(q) ||
        p.creator_email.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [planets, query]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(id: string) {
    onChange(id);
    close();
  }

  return (
    <div className="form-control">
      <span className="label-text">{label}</span>
      <div className="relative" ref={rootRef}>
        <input type="hidden" value={value} required={required} />
        <input
          className="input input-bordered w-full"
          value={open ? query : displayLabel}
          placeholder="Search by name, creator, or id…"
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        />
        {open && (
          <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-box border border-base-300 bg-base-100 py-1 shadow-lg">
            {!selected && value ? (
              <li>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-base-200"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(value)}
                >
                  <span className="font-mono text-xs opacity-70">
                    {value} (missing)
                  </span>
                </button>
              </li>
            ) : null}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-base-200 ${
                    p.id === value ? "bg-base-200" : ""
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p.id)}
                >
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="truncate text-xs opacity-60">
                    {p.creator_name}
                    {p.creator_email ? ` · ${p.creator_email}` : ""}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm opacity-60">No matches</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function PlanetSummaryCard({
  label,
  planet,
  planetId,
}: {
  label: string;
  planet: Planet | undefined;
  planetId: string;
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase opacity-60">
          {label}
        </span>
        <Link
          href={`/p/${planetId}`}
          className="link link-primary text-xs"
          target="_blank"
        >
          Open
        </Link>
      </div>
      {planet ? (
        <div className="flex gap-3">
          <StarSwatch params={planet.params} size={64} className="shrink-0" />
          <div className="min-w-0 text-sm">
            <div className="font-medium truncate">{planet.name}</div>
            <div className="opacity-70 truncate">{planet.creator_name}</div>
            <div className="opacity-50 truncate text-xs">
              {planet.creator_email}
            </div>
            <div className="mt-1 text-xs opacity-70">
              Answer: {formatJsonValue(planet.answers.answer1) || "—"}
            </div>
            <div className="text-xs opacity-50">
              {planet.is_staged ? "Staged" : "Not staged"}
            </div>
          </div>
        </div>
      ) : (
        <p className="font-mono text-xs opacity-60">{planetId}</p>
      )}
    </div>
  );
}

function ScoreSpotlightCard({
  kind,
  score,
  planetAName,
  planetBName,
  emphasized,
  onEdit,
}: {
  kind: "Latest" | "Previous";
  score: SessionScore;
  planetAName: string;
  planetBName: string;
  emphasized?: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-box border p-4 ${
        emphasized
          ? "border-primary bg-primary/10"
          : "border-base-300 bg-base-200/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-xs font-bold uppercase tracking-wide ${
              emphasized ? "text-primary" : "opacity-60"
            }`}
          >
            {kind}
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums leading-none">
            {score.score}
          </div>
        </div>
        <button
          type="button"
          className={`btn btn-sm shrink-0 ${
            emphasized ? "btn-primary" : "btn-outline"
          }`}
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
      <div className="min-w-0 text-sm">
        <div className="font-medium truncate">
          {planetAName}
          <span className="mx-1.5 opacity-40">×</span>
          {planetBName}
        </div>
        <div className="mt-1 text-xs opacity-60">
          Recorded {formatDate(score.recorded_at)}
        </div>
        {score.strategy ? (
          <div className="mt-0.5 truncate text-xs opacity-50">
            {score.strategy}
            {score.duration != null ? ` · ${score.duration}s` : ""}
          </div>
        ) : score.duration != null ? (
          <div className="mt-0.5 text-xs opacity-50">{score.duration}s</div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [sessionScores, setSessionScores] = useState<SessionScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [staging, setStaging] = useState(false);
  const [pendingStageIds, setPendingStageIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Planet | null>(null);
  const [viewingScore, setViewingScore] = useState<SessionScore | null>(null);
  const [creatingScore, setCreatingScore] = useState<SessionScoreDraft | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [scoreSaving, setScoreSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"planets" | "scores">("planets");
  const [query, setQuery] = useState("");
  const [planetStageFilter, setPlanetStageFilter] =
    useState<PlanetStageFilter>("all");
  const [planetSort, setPlanetSort] = useState<PlanetSort>("newest");
  const [scoreStrategyFilter, setScoreStrategyFilter] = useState("all");
  const [scoreSort, setScoreSort] = useState<ScoreSort>("recent");

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== "1") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/session", {
          credentials: "same-origin",
        });
        if (cancelled) return;
        if (res.ok) {
          setAuthed(true);
        } else {
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
          setAuthed(false);
        }
      } catch {
        if (!cancelled) {
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
          setAuthed(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planetsResult, scoresResult] = await Promise.allSettled([
        listPlanets(),
        listSessionScores(),
      ]);

      if (planetsResult.status === "fulfilled") {
        setPlanets(planetsResult.value);
        setPendingStageIds(
          planetsResult.value.filter((p) => p.is_staged).map((p) => p.id),
        );
      } else {
        setError(
          planetsResult.reason instanceof Error
            ? planetsResult.reason.message
            : "Failed to load planets.",
        );
      }

      if (scoresResult.status === "fulfilled") {
        setSessionScores(scoresResult.value);
      } else {
        setSessionScores([]);
        if (planetsResult.status === "fulfilled") {
          setError(
            scoresResult.reason instanceof Error
              ? `Session scores unavailable: ${scoresResult.reason.message}`
              : "Session scores unavailable.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load planets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void load();

    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;

    try {
      supabase = createClient();
      channel = supabase
        .channel("admin-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "planets" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const row = normalizePlanet(payload.new);
              setPlanets((prev) => {
                if (prev.some((p) => p.id === row.id)) return prev;
                return [row, ...prev];
              });
            } else if (payload.eventType === "UPDATE") {
              const row = normalizePlanet(payload.new);
              setPlanets((prev) =>
                prev.map((p) => (p.id === row.id ? row : p)),
              );
            } else if (payload.eventType === "DELETE") {
              const row = payload.old as Planet;
              setPlanets((prev) => prev.filter((p) => p.id !== row.id));
              setPendingStageIds((prev) => prev.filter((id) => id !== row.id));
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "session_scores" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as SessionScore;
              setSessionScores((prev) => {
                if (prev.some((s) => s.id === row.id)) {
                  return sortScoresByRecordedAt(
                    prev.map((s) => (s.id === row.id ? row : s)),
                  );
                }
                return sortScoresByRecordedAt([row, ...prev]);
              });
              setViewingScore((prev) => (prev?.id === row.id ? row : prev));
            } else if (payload.eventType === "UPDATE") {
              const row = payload.new as SessionScore;
              setSessionScores((prev) =>
                sortScoresByRecordedAt(
                  prev.map((s) => (s.id === row.id ? row : s)),
                ),
              );
              setViewingScore((prev) => (prev?.id === row.id ? row : prev));
            } else if (payload.eventType === "DELETE") {
              const row = payload.old as SessionScore;
              setSessionScores((prev) => prev.filter((s) => s.id !== row.id));
              setViewingScore((prev) => (prev?.id === row.id ? null : prev));
            }
          },
        )
        .subscribe();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Realtime subscription failed.",
      );
    }

    return () => {
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [authed, load]);

  const liveStaged = useMemo(
    () => planets.filter((p) => p.is_staged),
    [planets],
  );

  const planetById = useMemo(() => {
    const map = new Map<string, Planet>();
    for (const p of planets) map.set(p.id, p);
    return map;
  }, [planets]);

  const pendingStaged = useMemo(
    () =>
      pendingStageIds
        .map((id) => planetById.get(id))
        .filter((p): p is Planet => Boolean(p)),
    [pendingStageIds, planetById],
  );

  const isDirty = useMemo(() => {
    const live = new Set(liveStaged.map((p) => p.id));
    const pending = new Set(pendingStageIds);
    if (live.size !== pending.size) return true;
    for (const id of pending) {
      if (!live.has(id)) return true;
    }
    return false;
  }, [liveStaged, pendingStageIds]);

  const latestScore = sessionScores[0] ?? null;
  const previousScore = sessionScores[1] ?? null;

  function planetLabel(id: string) {
    return planetById.get(id)?.name ?? id.slice(0, 8);
  }

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPlanets = useMemo(() => {
    const pending = new Set(pendingStageIds);
    const matched = planets.filter((planet) => {
      if (planetStageFilter === "live" && !planet.is_staged) return false;
      if (planetStageFilter === "pending" && !pending.has(planet.id)) {
        return false;
      }
      if (
        planetStageFilter === "unstaged" &&
        (planet.is_staged || pending.has(planet.id))
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return [
        planet.name,
        planet.creator_name,
        planet.creator_email,
        planet.id,
        formatJsonValue(planet.answers.answer1),
      ].some((field) => field.toLowerCase().includes(normalizedQuery));
    });

    return matched.sort((a, b) => {
      if (planetSort === "name") return a.name.localeCompare(b.name);
      const delta =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return planetSort === "oldest" ? delta : -delta;
    });
  }, [
    planets,
    pendingStageIds,
    planetStageFilter,
    planetSort,
    normalizedQuery,
  ]);

  const strategyOptions = useMemo(() => {
    const values = new Set<string>();
    for (const score of sessionScores) {
      if (score.strategy) values.add(score.strategy);
    }
    // Keep a selected strategy listed even if its last score just disappeared.
    if (scoreStrategyFilter !== "all" && scoreStrategyFilter !== NO_STRATEGY) {
      values.add(scoreStrategyFilter);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [sessionScores, scoreStrategyFilter]);

  const filteredScores = useMemo(() => {
    const matched = sessionScores.filter((score) => {
      if (scoreStrategyFilter === NO_STRATEGY && score.strategy) return false;
      if (
        scoreStrategyFilter !== "all" &&
        scoreStrategyFilter !== NO_STRATEGY &&
        score.strategy !== scoreStrategyFilter
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      const a = planetById.get(score.planet_a_id);
      const b = planetById.get(score.planet_b_id);
      return [
        score.yq_session_id,
        score.strategy ?? "",
        String(score.score),
        score.planet_a_id,
        score.planet_b_id,
        a?.name ?? "",
        a?.creator_name ?? "",
        b?.name ?? "",
        b?.creator_name ?? "",
      ].some((field) => field.toLowerCase().includes(normalizedQuery));
    });

    return matched.sort((a, b) => {
      if (scoreSort === "high") return b.score - a.score;
      if (scoreSort === "low") return a.score - b.score;
      const delta =
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime();
      return scoreSort === "oldest" ? delta : -delta;
    });
  }, [
    sessionScores,
    planetById,
    scoreStrategyFilter,
    scoreSort,
    normalizedQuery,
  ]);

  const filtersActive =
    normalizedQuery.length > 0 ||
    (activeTab === "planets"
      ? planetStageFilter !== "all" || planetSort !== "newest"
      : scoreStrategyFilter !== "all" || scoreSort !== "recent");

  function clearFilters() {
    setQuery("");
    if (activeTab === "planets") {
      setPlanetStageFilter("all");
      setPlanetSort("newest");
    } else {
      setScoreStrategyFilter("all");
      setScoreSort("recent");
    }
  }

  function openScoreEdit(score: SessionScore) {
    setActiveTab("scores");
    setViewingScore({ ...score });
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLoginError(data.error ?? "Login failed");
        return;
      }
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      setAuthed(true);
    } catch {
      setLoginError("Login failed");
    }
  }

  function togglePendingStage(planet: Planet) {
    setStageError(null);
    setPendingStageIds((prev) => {
      if (prev.includes(planet.id)) {
        return prev.filter((id) => id !== planet.id);
      }
      if (prev.length >= MAX_STAGED) {
        setStageError(
          `Already staging ${MAX_STAGED} planets. Unstage one before staging another.`,
        );
        return prev;
      }
      return [...prev, planet.id];
    });
  }

  async function fireStaging() {
    setStageError(null);
    setStaging(true);
    try {
      const updated = await replaceStagedPlanets(pendingStageIds);
      setPlanets(updated);
      setPendingStageIds(
        updated.filter((p) => p.is_staged).map((p) => p.id),
      );
    } catch (err) {
      setStageError(
        err instanceof Error ? err.message : "Failed to update staging.",
      );
    } finally {
      setStaging(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const payload: PlanetUpdate = {
        name: editing.name,
        creator_name: editing.creator_name,
        creator_email: editing.creator_email,
        answers: {
          answer1:
            editing.answers.answer1 === null ||
            editing.answers.answer1 === undefined
              ? ""
              : typeof editing.answers.answer1 === "string"
                ? editing.answers.answer1
                : JSON.stringify(editing.answers.answer1),
        },
        params: editing.params,
      };

      await updatePlanet(editing.id, payload);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function saveScoreEdit(e: FormEvent) {
    e.preventDefault();
    if (!viewingScore) return;
    setScoreSaving(true);
    setError(null);
    try {
      const payload: SessionScoreUpdate = {
        score: viewingScore.score,
        planet_a_id: viewingScore.planet_a_id,
        planet_b_id: viewingScore.planet_b_id,
        recorded_at: viewingScore.recorded_at,
        strategy: viewingScore.strategy?.trim()
          ? viewingScore.strategy.trim()
          : null,
        duration:
          viewingScore.duration == null ||
          !Number.isFinite(viewingScore.duration)
            ? null
            : viewingScore.duration,
      };
      const updated = await updateSessionScore(viewingScore.id, payload);
      setSessionScores((prev) =>
        sortScoresByRecordedAt(
          prev.map((s) => (s.id === updated.id ? updated : s)),
        ),
      );
      setViewingScore(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save session score.",
      );
    } finally {
      setScoreSaving(false);
    }
  }

  async function saveScoreCreate(e: FormEvent) {
    e.preventDefault();
    if (!creatingScore) return;
    if (!creatingScore.planet_a_id || !creatingScore.planet_b_id) {
      setError("Select both Planet A and Planet B.");
      return;
    }
    if (creatingScore.planet_a_id === creatingScore.planet_b_id) {
      setError("Planet A and Planet B must be distinct.");
      return;
    }
    setScoreSaving(true);
    setError(null);
    try {
      const payload: SessionScoreInsert = {
        yq_session_id: creatingScore.yq_session_id.trim(),
        planet_a_id: creatingScore.planet_a_id,
        planet_b_id: creatingScore.planet_b_id,
        score: creatingScore.score,
        recorded_at: creatingScore.recorded_at,
        strategy: creatingScore.strategy?.trim()
          ? creatingScore.strategy.trim()
          : null,
        duration:
          creatingScore.duration == null ||
          !Number.isFinite(creatingScore.duration)
            ? null
            : creatingScore.duration,
      };
      const created = await createSessionScore(payload);
      setSessionScores((prev) =>
        sortScoresByRecordedAt(
          prev.some((s) => s.id === created.id) ? prev : [created, ...prev],
        ),
      );
      setCreatingScore(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create session score.";
      if (message === "Unauthorized") {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setAuthed(false);
        setCreatingScore(null);
        setLoginError("Session expired. Please log in again.");
      }
      setError(message);
    } finally {
      setScoreSaving(false);
    }
  }

  async function onDeleteScore(score: SessionScore) {
    const label = `${score.score} · ${score.yq_session_id}`;
    if (!confirm(`Delete session score ${label}?`)) return;
    setScoreSaving(true);
    setError(null);
    try {
      await deleteSessionScore(score.id);
      setSessionScores((prev) => prev.filter((s) => s.id !== score.id));
      setViewingScore((prev) => (prev?.id === score.id ? null : prev));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete session score.",
      );
    } finally {
      setScoreSaving(false);
    }
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base-200 p-6">
        <form
          onSubmit={onLogin}
          className="card w-full max-w-sm bg-base-100 shadow-xl"
        >
          <div className="card-body gap-4">
            <h1 className="card-title">Admin</h1>
            <p className="text-sm opacity-70">
              Enter the shared admin password to monitor planets.
            </p>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {loginError && <p className="text-sm text-error">{loginError}</p>}
            <button type="submit" className="btn btn-primary">
              Enter
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold">Planet Sync Admin</h1>
            <p className="text-xs opacity-60">
              Live monitor · edit · stage up to {MAX_STAGED}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>
        </div>
        {latestScore && (
          <div className="mx-auto grid max-w-7xl gap-3 px-4 pb-4 sm:grid-cols-2">
            <ScoreSpotlightCard
              kind="Latest"
              score={latestScore}
              planetAName={planetLabel(latestScore.planet_a_id)}
              planetBName={planetLabel(latestScore.planet_b_id)}
              emphasized
              onEdit={() => openScoreEdit(latestScore)}
            />
            {previousScore ? (
              <ScoreSpotlightCard
                kind="Previous"
                score={previousScore}
                planetAName={planetLabel(previousScore.planet_a_id)}
                planetBName={planetLabel(previousScore.planet_b_id)}
                onEdit={() => openScoreEdit(previousScore)}
              />
            ) : (
              <div className="flex items-center rounded-box border border-dashed border-base-300 px-4 py-6 text-sm opacity-50">
                No previous session score yet.
              </div>
            )}
          </div>
        )}
      </header>

      {staging && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-info text-sm gap-2">
            <span className="loading loading-spinner loading-sm" />
            Updating stage…
          </div>
        </div>
      )}

      <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
        {stageError && (
          <div className="alert alert-warning text-sm">{stageError}</div>
        )}
        {error && <div className="alert alert-error text-sm">{error}</div>}

        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Staging for experiment</h2>
              <p className="text-xs opacity-60">
                Pre-select up to {MAX_STAGED} planets, then fire to set live{" "}
                <code className="text-xs">is_staged</code> for YouQuantified.
              </p>
            </div>
            <div
              className={`badge badge-lg ${
                pendingStaged.length >= MAX_STAGED
                  ? "badge-warning"
                  : "badge-neutral"
              }`}
            >
              {pendingStaged.length}/{MAX_STAGED}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: MAX_STAGED }, (_, slot) => {
              const planet = pendingStaged[slot];
              if (!planet) {
                return (
                  <div
                    key={`empty-${slot}`}
                    className="flex min-h-20 items-center justify-center rounded-box border border-dashed border-base-300 text-sm opacity-50"
                  >
                    Empty slot
                  </div>
                );
              }
              return (
                <div
                  key={planet.id}
                  className="flex items-center gap-3 rounded-box border border-base-300 px-3 py-2"
                >
                  <StarSwatch params={planet.params} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{planet.name}</div>
                    <div className="truncate text-xs opacity-60">
                      {planet.creator_name}
                    </div>
                    {planet.is_staged && (
                      <span className="badge badge-warning badge-xs mt-1">
                        Live
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    disabled={staging}
                    onClick={() => togglePendingStage(planet)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          {isDirty && liveStaged.length > 0 && (
            <p className="mt-3 text-xs opacity-60">
              Currently live:{" "}
              {liveStaged.map((p) => p.name).join(", ")} — will be replaced on
              fire.
            </p>
          )}
          {isDirty && liveStaged.length === 0 && pendingStaged.length > 0 && (
            <p className="mt-3 text-xs opacity-60">
              Nothing live yet — fire to stage the selection.
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="btn btn-warning"
              disabled={!isDirty || staging}
              onClick={() => void fireStaging()}
            >
              {staging ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Fire staging"
              )}
            </button>
          </div>
        </section>

        <div role="tablist" className="tabs tabs-box w-fit">
          <button
            type="button"
            role="tab"
            className={`tab ${activeTab === "planets" ? "tab-active" : ""}`}
            aria-selected={activeTab === "planets"}
            onClick={() => setActiveTab("planets")}
          >
            Planets
            <span className="ml-1.5 opacity-60">{planets.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${activeTab === "scores" ? "tab-active" : ""}`}
            aria-selected={activeTab === "scores"}
            onClick={() => setActiveTab("scores")}
          >
            Session scores
            <span className="ml-1.5 opacity-60">{sessionScores.length}</span>
          </button>
        </div>

        <div className="rounded-box border border-base-300 bg-base-100 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="input input-bordered input-sm flex flex-1 items-center gap-2">
              <span aria-hidden className="opacity-50">
                ⌕
              </span>
              <input
                type="search"
                className="grow"
                value={query}
                placeholder={
                  activeTab === "planets"
                    ? "Search planets by name, creator, email, answer, or id…"
                    : "Search scores by session id, strategy, score, or planet…"
                }
                aria-label={
                  activeTab === "planets"
                    ? "Search planets"
                    : "Search session scores"
                }
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            {activeTab === "planets" ? (
              <>
                <select
                  className="select select-bordered select-sm"
                  aria-label="Filter by staging"
                  value={planetStageFilter}
                  onChange={(e) =>
                    setPlanetStageFilter(e.target.value as PlanetStageFilter)
                  }
                >
                  <option value="all">All staging</option>
                  <option value="live">Live</option>
                  <option value="pending">Pre-staged</option>
                  <option value="unstaged">Unstaged</option>
                </select>
                <select
                  className="select select-bordered select-sm"
                  aria-label="Sort planets"
                  value={planetSort}
                  onChange={(e) => setPlanetSort(e.target.value as PlanetSort)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name A–Z</option>
                </select>
              </>
            ) : (
              <>
                <select
                  className="select select-bordered select-sm"
                  aria-label="Filter by strategy"
                  value={scoreStrategyFilter}
                  onChange={(e) => setScoreStrategyFilter(e.target.value)}
                >
                  <option value="all">All strategies</option>
                  <option value={NO_STRATEGY}>No strategy</option>
                  {strategyOptions.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategy}
                    </option>
                  ))}
                </select>
                <select
                  className="select select-bordered select-sm"
                  aria-label="Sort session scores"
                  value={scoreSort}
                  onChange={(e) => setScoreSort(e.target.value as ScoreSort)}
                >
                  <option value="recent">Most recent</option>
                  <option value="oldest">Oldest first</option>
                  <option value="high">Highest score</option>
                  <option value="low">Lowest score</option>
                </select>
              </>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!filtersActive}
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>

          <p className="mt-2 text-xs opacity-60">
            {activeTab === "planets"
              ? `Showing ${filteredPlanets.length} of ${planets.length} planets`
              : `Showing ${filteredScores.length} of ${sessionScores.length} session scores`}
          </p>
        </div>

        {loading && planets.length === 0 && sessionScores.length === 0 ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : activeTab === "planets" ? (
          <section>
            {planets.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 p-12 text-center opacity-60">
                No planets yet. Waiting for mobile submissions…
              </div>
            ) : filteredPlanets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-box border border-dashed border-base-300 p-12 text-center">
                <span className="text-sm opacity-60">
                  No planets match the current search or filters.
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Link</th>
                      <th>Pre-stage</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlanets.map((planet) => (
                      <tr key={planet.id} className="hover">
                        <td>
                          <StarSwatch params={planet.params} size={72} />
                        </td>
                        <td>
                          <div className="font-medium">{planet.name}</div>
                          <div className="text-xs opacity-60">
                            {planet.creator_name}
                          </div>
                          {planet.is_staged && (
                            <span className="badge badge-warning badge-xs mt-1">
                              Live
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-sm">
                          <div>{formatDate(planet.created_at)}</div>
                          <div className="text-xs opacity-50">
                            upd {formatDate(planet.updated_at)}
                          </div>
                        </td>
                        <td>
                          <Link
                            href={`/p/${planet.id}`}
                            className="link link-primary text-sm"
                            target="_blank"
                          >
                            Open
                          </Link>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            className="toggle toggle-warning toggle-sm"
                            disabled={staging}
                            checked={pendingStageIds.includes(planet.id)}
                            onChange={() => togglePendingStage(planet)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditing({ ...planet });
                              setStageError(null);
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={planets.length < 2}
                title={
                  planets.length < 2
                    ? "Need at least two planets to create a pair score"
                    : undefined
                }
                onClick={() => {
                  setError(null);
                  setCreatingScore(newSessionScoreDraft(planets));
                }}
              >
                Create
              </button>
            </div>
            {sessionScores.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 p-8 text-center text-sm opacity-60">
                No session scores yet.
              </div>
            ) : filteredScores.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-box border border-dashed border-base-300 p-8 text-center">
                <span className="text-sm opacity-60">
                  No session scores match the current search or filters.
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Score</th>
                      <th>Strategy</th>
                      <th>Duration</th>
                      <th>YQ session</th>
                      <th>Planet A</th>
                      <th>Planet B</th>
                      <th>Recorded</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScores.map((score) => (
                      <tr
                        key={score.id}
                        className={`hover ${
                          score.id === latestScore?.id ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{score.score}</span>
                            {score.id === latestScore?.id ? (
                              <span className="badge badge-primary badge-sm">
                                Latest
                              </span>
                            ) : score.id === previousScore?.id ? (
                              <span className="badge badge-ghost badge-sm">
                                Previous
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-[10rem] truncate text-sm">
                          {score.strategy ?? "—"}
                        </td>
                        <td className="text-sm">
                          {score.duration == null ? "—" : score.duration}
                        </td>
                        <td>
                          <span className="font-mono text-xs">
                            {score.yq_session_id.length > 24
                              ? `${score.yq_session_id.slice(0, 24)}…`
                              : score.yq_session_id}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/p/${score.planet_a_id}`}
                            className="link link-primary text-sm"
                            target="_blank"
                          >
                            {planetLabel(score.planet_a_id)}
                          </Link>
                        </td>
                        <td>
                          <Link
                            href={`/p/${score.planet_b_id}`}
                            className="link link-primary text-sm"
                            target="_blank"
                          >
                            {planetLabel(score.planet_b_id)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-sm">
                          {formatDate(score.recorded_at)}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openScoreEdit(score)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm text-error"
                              disabled={scoreSaving}
                              onClick={() => void onDeleteScore(score)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {editing && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-lg font-bold">Edit planet</h3>
            <form onSubmit={saveEdit} className="mt-4 flex flex-col gap-3">
              <label className="form-control">
                <span className="label-text">Name</span>
                <input
                  className="input input-bordered"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Creator name</span>
                <input
                  className="input input-bordered"
                  value={editing.creator_name}
                  onChange={(e) =>
                    setEditing({ ...editing, creator_name: e.target.value })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Creator email</span>
                <input
                  type="email"
                  className="input input-bordered"
                  value={editing.creator_email}
                  onChange={(e) =>
                    setEditing({ ...editing, creator_email: e.target.value })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Planet name answer</span>
                <input
                  className="input input-bordered"
                  value={
                    editing.answers.answer1 === null ||
                    editing.answers.answer1 === undefined
                      ? ""
                      : typeof editing.answers.answer1 === "string"
                        ? editing.answers.answer1
                        : JSON.stringify(editing.answers.answer1)
                  }
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      answers: { answer1: e.target.value },
                    })
                  }
                />
              </label>

              <div className="flex items-start gap-4">
                <StarSwatch
                  params={editing.params}
                  size={96}
                  className="shrink-0"
                />
                <StarSliders
                  className="min-w-0 flex-1"
                  params={editing.params}
                  onChange={(key: StarKey, value) =>
                    setEditing({
                      ...editing,
                      params: {
                        ...editing.params,
                        [key]: clampStar(key, value),
                      },
                    })
                  }
                  onOrbitModeChange={(mode) =>
                    setEditing({
                      ...editing,
                      params: { ...editing.params, orbit_mode: mode },
                    })
                  }
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setEditing(null)}>
              close
            </button>
          </form>
        </dialog>
      )}

      {creatingScore && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="text-lg font-bold">Create session score</h3>
            <p className="mt-1 text-sm opacity-60">
              Pair two planets and set a score. Session id is generated and
              editable.
            </p>

            <form
              onSubmit={saveScoreCreate}
              className="mt-4 flex flex-col gap-3"
            >
              <label className="form-control">
                <span className="label-text">Session id</span>
                <input
                  className="input input-bordered font-mono text-sm"
                  value={creatingScore.yq_session_id}
                  onChange={(e) =>
                    setCreatingScore({
                      ...creatingScore,
                      yq_session_id: e.target.value,
                    })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Score</span>
                <input
                  type="number"
                  step="any"
                  className="input input-bordered"
                  value={creatingScore.score}
                  onChange={(e) =>
                    setCreatingScore({
                      ...creatingScore,
                      score: Number(e.target.value),
                    })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Strategy</span>
                <input
                  className="input input-bordered"
                  value={creatingScore.strategy ?? ""}
                  onChange={(e) =>
                    setCreatingScore({
                      ...creatingScore,
                      strategy:
                        e.target.value.length === 0 ? null : e.target.value,
                    })
                  }
                  placeholder="Optional"
                />
              </label>
              <label className="form-control">
                <span className="label-text">Duration (seconds)</span>
                <input
                  type="number"
                  step="any"
                  className="input input-bordered"
                  value={creatingScore.duration ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCreatingScore({
                      ...creatingScore,
                      duration: raw === "" ? null : Number(e.target.value),
                    });
                  }}
                  placeholder="Optional"
                />
              </label>
              <label className="form-control">
                <span className="label-text">Recorded at</span>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={toDatetimeLocalValue(creatingScore.recorded_at)}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (Number.isNaN(d.getTime())) return;
                    setCreatingScore({
                      ...creatingScore,
                      recorded_at: d.toISOString(),
                    });
                  }}
                  required
                />
              </label>
              <PlanetSearchSelect
                label="Planet A"
                planets={planets}
                value={creatingScore.planet_a_id}
                onChange={(id) =>
                  setCreatingScore({
                    ...creatingScore,
                    planet_a_id: id,
                  })
                }
                required
              />
              <PlanetSearchSelect
                label="Planet B"
                planets={planets}
                value={creatingScore.planet_b_id}
                onChange={(id) =>
                  setCreatingScore({
                    ...creatingScore,
                    planet_b_id: id,
                  })
                }
                required
              />

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCreatingScore(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={scoreSaving}
                >
                  {scoreSaving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setCreatingScore(null)}>
              close
            </button>
          </form>
        </dialog>
      )}

      {viewingScore && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="text-lg font-bold">Session score</h3>
            <p className="mt-1 font-mono text-xs opacity-60 break-all">
              id {viewingScore.id}
            </p>
            <p className="font-mono text-xs opacity-60 break-all">
              yq {viewingScore.yq_session_id}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PlanetSummaryCard
                label="Planet A"
                planet={planetById.get(viewingScore.planet_a_id)}
                planetId={viewingScore.planet_a_id}
              />
              <PlanetSummaryCard
                label="Planet B"
                planet={planetById.get(viewingScore.planet_b_id)}
                planetId={viewingScore.planet_b_id}
              />
            </div>

            <form
              onSubmit={saveScoreEdit}
              className="mt-4 flex flex-col gap-3"
            >
              <label className="form-control">
                <span className="label-text">Score</span>
                <input
                  type="number"
                  step="any"
                  className="input input-bordered"
                  value={viewingScore.score}
                  onChange={(e) =>
                    setViewingScore({
                      ...viewingScore,
                      score: Number(e.target.value),
                    })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Strategy</span>
                <input
                  className="input input-bordered"
                  value={viewingScore.strategy ?? ""}
                  onChange={(e) =>
                    setViewingScore({
                      ...viewingScore,
                      strategy:
                        e.target.value.length === 0 ? null : e.target.value,
                    })
                  }
                  placeholder="Optional"
                />
              </label>
              <label className="form-control">
                <span className="label-text">Duration (seconds)</span>
                <input
                  type="number"
                  step="any"
                  className="input input-bordered"
                  value={viewingScore.duration ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setViewingScore({
                      ...viewingScore,
                      duration:
                        raw === "" ? null : Number(e.target.value),
                    });
                  }}
                  placeholder="Optional"
                />
              </label>
              <label className="form-control">
                <span className="label-text">Recorded at</span>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={toDatetimeLocalValue(viewingScore.recorded_at)}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (Number.isNaN(d.getTime())) return;
                    setViewingScore({
                      ...viewingScore,
                      recorded_at: d.toISOString(),
                    });
                  }}
                  required
                />
              </label>
              <PlanetSearchSelect
                label="Planet A"
                planets={planets}
                value={viewingScore.planet_a_id}
                onChange={(id) =>
                  setViewingScore({
                    ...viewingScore,
                    planet_a_id: id,
                  })
                }
                required
              />
              <PlanetSearchSelect
                label="Planet B"
                planets={planets}
                value={viewingScore.planet_b_id}
                onChange={(id) =>
                  setViewingScore({
                    ...viewingScore,
                    planet_b_id: id,
                  })
                }
                required
              />

              <div className="text-xs opacity-50">
                Created {formatDate(viewingScore.created_at)} · Updated{" "}
                {formatDate(viewingScore.updated_at)}
              </div>

              <div className="mt-2 flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  className="btn btn-error btn-outline"
                  disabled={scoreSaving}
                  onClick={() => void onDeleteScore(viewingScore)}
                >
                  Delete
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setViewingScore(null)}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={scoreSaving}
                  >
                    {scoreSaving ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setViewingScore(null)}>
              close
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}

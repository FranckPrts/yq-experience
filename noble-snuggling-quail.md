# Constellation as a tenant setup-and-runtime surface over MindHive

## Context

Today this app is one experience hardwired to one database: a single Supabase project
(build-time env vars), a single vocabulary ("star"), six fixed params, one hardcoded
question, one p5 sketch compiled into the bundle, and RLS policies that are frankly
`using (true)` with a comment admitting it was a one-day install tradeoff.

The target is a multi-tenant platform where **MindHive is the system of record** and this
repo is the surface a tenant actually touches.

### The division of responsibility

**MindHive (Keystone) owns** tenants, and the three artefacts that together constitute an
*experience*:

1. the tenant's Supabase connection,
2. styling & language,
3. p5 assets — including their editing, which stays in MindHive's Visuals editor.

**This repo does three jobs, and stores nothing of its own:**

1. **Set up** the tenant's three artefacts — the UI and flows that author them into MindHive.
2. **Open** the experience to participants, and run it.
3. **Provision** the tenant's Supabase so it can hold participants and their sync-session
   records under real RLS.

Everything below follows from that split. Where this repo needs state, it reads or writes
MindHive; where participants need data, it is the tenant's own project.

### What is hardwired today, and where it goes

| Hardwired thing | Location | Becomes |
| --- | --- | --- |
| Supabase project (build-time env) | `src/utils/supabase/*.ts` | artefact 1, per experience |
| Params, ranges, labels | `src/lib/types/star.ts` (`STAR_CONTROLS`, `clampStar`) | artefact 3, from `Visual.parameters` |
| The one question | `src/lib/constants.ts` (`QUESTIONS`) | artefact 3, same list |
| Palette | `src/lib/theme.ts`, `globals.css` `@theme` | artefact 2 |
| The sketch | `src/components/StarCanvas.tsx` | artefact 3, a `Visual` |
| Participant identity | `src/lib/identity.ts` — localStorage UUID | Supabase anonymous auth in the spoke |
| Param shape in SQL | `003_planets_answers_params.sql` CHECK | app-side, schema-driven |

### Hub primitives that already exist — reuse, don't rebuild

From `mindhive_local/mindhive/keystone/`: **`Organization`** (the tenant — unique name,
`admins`, `members`, `logo`), **`Profile`** + **`Permission`** (`permissionFields` in
`schemas/fields.ts`), **`Visual`** (the p5 asset — `code` file, `parameters` json,
`extensions`, `privacy`), and **`Study`** as the precedent for a slugged, publishable,
participant-facing thing. Auth is `keystone/auth.ts`: stateless iron-session cookie,
`domain: .mindhive.science`, `sameSite: "strict"`.

## Key decisions

### 0. Settled by the tenant (2026-09-18)

- **Domain.** This app moves to **`experience.mindhive.science`** and abandons
  `constellation.youquantified.com`. It becomes another frontend on the MindHive apex, so
  the existing Keystone iron-session cookie authenticates tenants here with no separate
  session system. This closes the §3.4 cookie question below.
- **Hub access.** Participant-facing server reads go through a **shared-secret custom
  mutation** in `keystone/mutations/`. Tenant-facing reads forward the tenant's own cookie.
  See decision 5.
- **Repo split.** Keystone-side files are written into `hub-schema/` in *this* repo for
  hand-off; the tenant lands them in `mindhive_local` and reviews them there. MindHive owns
  authoring and managing Visuals; this repo renders p5 only inside the participant's
  avatar-building flow.
- **p5 is pinned to 1.11.3** — see decision 4.

### 1. Participant identity is Supabase anonymous auth in the tenant's own project

Participants sign in anonymously to the **tenant's** Supabase. RLS becomes honest
(`auth.uid() = owner`) instead of today's `using (true)`. The tenant owns participant
identity outright, and no participant data touches MindHive. This replaces
`src/lib/identity.ts` and `src/lib/use-identity.ts`.

Anonymous sign-ins must be enabled on the tenant project — provisioning attempts this via
the Management API auth-config endpoint, with a manual instruction as fallback.

**Operational limits the tenant must see at setup time.** Supabase rate-limits anonymous
sign-ins per IP (default ~30/hour), which is precisely the failure mode of a room full of
participants behind one conference NAT — the CCN deployment this codebase grew out of would
have hit it. Anonymous users also accrue in the tenant's `auth.users` against their plan's
MAU, and the session lives in browser storage, so it is no more durable than today's
localStorage UUID. The setup UI links Supabase's own docs on both, and the provisioning step
surfaces the rate limit as a number the tenant can raise before an event, not a surprise
during one. **If these limits bind hard enough, they are the argument for moving this
experience off Supabase entirely** — so keep the participant data path behind
`src/lib/spoke/` narrow enough that the provider is replaceable.

### 2. The data path splits by audience

| Audience | Path | Why |
| --- | --- | --- |
| **Participant** | Direct to the tenant's Supabase, publishable key + their own anon session | RLS is the boundary, as Supabase intends. **Realtime works natively — no relay needed.** |
| **Tenant setup / admin** | Strictly server-side | OAuth tokens, Management API calls and the secret key must never reach a browser |

This refines PRD §3.2/§3.3: the secrecy requirement is about the *tenant's credentials*,
not about a participant's own session. The publishable key is public by design and is what
makes the participant path work at all.

Consequence: the tenant-facing admin view reads across all participants, which RLS
deliberately forbids from the browser — so admin alone is server-proxied and needs the SSE
relay. The participant path does not.

### 3. Secrets: a necessary deviation from PRD §3.3

The PRD specifies Supabase Vault / `pgsodium`. The Hub is Keystone on Prisma/Postgres —
there is no Vault there. Same guarantee, different mechanism: application-level envelope
encryption (AES-256-GCM, master key from env/KMS) on the connection fields, with
`access: { read: () => false }` so they never appear in the GraphQL schema at all, and
decryption only in this app's server process at client-instantiation time.

### 3b. Two callers reach the Hub, and only one of them has a cookie

Moving to `experience.mindhive.science` means a **tenant** arrives carrying the Keystone
session cookie: this app forwards it and acts as that tenant, so their own private `Visual`
and `YQExperience` are readable through ordinary access control. Job 1 needs nothing more.

A **participant** carries no cookie. That is mostly fine — `YQVisual.ts`'s filter already
answers anonymous callers with `public` and `unlisted` visuals, and the `code` file is served
by an unauthenticated static route (`keystone.ts`, `serverRoute: "/yq-code"`), which is how
YouQuantified renders visuals to logged-out visitors today. Two things it does *not* cover:

1. The tenant's Supabase URL and publishable key. `access: { read: () => false }` is absolute
   over GraphQL — no session gets past it, by design (decision 3). Only code running *inside*
   Keystone, with `context.sudo()`, can decrypt them.
2. A tenant should not have to flip their Visual to `public`/`unlisted` — a meaningful choice
   in YQ's own editor — merely to open a Constellation experience.

So Phase 1 ships **one shared-secret resolver**, `resolveExperienceRuntime(org, slug)`,
callable only from this app's server (the `YQ_API_SECRET` pattern already in
`src/app/api/session-scores/route.ts` is the precedent). It checks `openForParticipation`,
and returns exactly what a participant render needs:

```
{ theme, lexicon, visual: { codeUrl, parameters, extensions }, supabase: { url, publishableKey } }
```

The secret key, OAuth access token and refresh token are **not** in that payload. They come
from a second, narrower resolver used only by provisioning (Phase 3) and the admin relay
(Phase 5). Gating the render on the *experience* being open, rather than on the visual being
public, is the whole point of routing it through here.

### 4. The p5 asset contract — reuse the proven one

YouQuantified already runs tenant p5 code, at
`You-Quantified/frontend/src/components/visuals/dashboard/p5window/`:

- `p5iframe.js` — sketch runs in `<iframe srcDoc>`, p5 from CDN, `extensions` injected as
  `<script src>`, `setup`/`draw` wrapped in try/catch, errors relayed to the parent.
- `p5window.js` — params arrive via `postMessage(JSON.stringify(params))`; the sketch reads
  a global `data` keyed by parameter `name`; `sendEvent({...})` posts back.
- `Visual.parameters` is `[{name, suggested[]}]`; `data` is `{[name]: value}`.

We reuse the *shape* of this exactly. Two things change, and the first is larger than it
looks.

**Deviation A — the sandbox, and the transport that depends on it.** YQ's iframe sets
`sandbox="allow-same-origin allow-scripts ..."`, and that pair together does not sandbox:
framed code reaches the parent origin. On `experience.mindhive.science` our pages carry
MindHive session cookies, so tenant-supplied sketch code must not be same-origin with them.
The frame drops `allow-same-origin`, or is served from a distinct origin.

That single attribute breaks the message channel in **both** directions, because YQ's
transport quietly relies on same-origin:

- the frame checks `if (event.origin === "<parent origin>")` before accepting params;
- `sendEvent` calls `window.parent.postMessage(JSON.stringify(m))` with **no**
  `targetOrigin`, and the parent likewise posts in with no `targetOrigin`.

A one-argument `postMessage` defaults `targetOrigin` to `"/"` — *sender's own origin only*.
Once the frame's origin is opaque or different, params never arrive at the sketch and
`sendEvent` dies silently, taking the error relay with it. So our version passes an explicit
`"*"` on both sides, and replaces the origin string check with an identity check
(`event.source === iframeRef.current.contentWindow` on the way in). Payloads crossing that
boundary are untrusted data either way. **This is Phase 4's first task, not a footnote.**

**Deviation B — none; p5 stays pinned at 1.11.3.** The CDN version YQ's iframe loads is what
tenant visuals are authored against, so it is what runs here. The cost lands entirely on our
port: `StarCanvas.tsx` is written against this repo's p5 **2.3.2**, in instance mode, in
TypeScript, with two `createFilterShader` passes over a WEBGL canvas and module-level imports
of `SKETCH_DEFAULTS`. Porting means global mode, one self-contained JS file, and whatever
1.x↔2.x shader and filter differences surface.

> **Note for a later step.** The pin is a compatibility decision, not an endorsement — p5
> 1.11.3 is old and the repo's own `package.json` is already on 2.3.2. Revisiting it means
> migrating YQ's iframe and every existing tenant visual together, so it is a
> YouQuantified-side project, not something this repo can do alone. Re-open it once the
> Visuals editor ships. Until then, **`p5` stays a dependency here only for whatever is left
> rendering outside the iframe** — if nothing is, drop it.

`Visual.parameters` is extended **additively** (nothing reads unknown keys today, so the
existing editor keeps working): each entry gains `type` (`number` | `enum` | `hue` |
`text`), `label`, `description`, `min`/`max`/`step`/`default`/`options`, and `role`
(`participant` | `stream` | `fixed`). That one list drives **both** the avatar controls and
the participant questions — which is what makes question count and nature arbitrary per
tenant. It is where `STAR_CONTROLS` and `QUESTIONS` both end up. The editing UI for it
belongs to MindHive's Visuals editor, not here.

## Framework notes (Next.js 16.3, verified in `node_modules/next/dist/docs/`)

- `middleware.ts` is **deprecated, renamed to `proxy.ts`** in v16; this repo already uses
  `src/proxy.ts`. Proxy defaults to the **Node.js runtime**; setting `runtime` there throws.
- Proxy is documented as *not* for data fetching, and fetch cache options have no effect in
  it. **This adjusts PRD §3.4**: the proxy does a cheap subdomain → rewrite with no I/O,
  and the experience layout (a server component) loads config and inlines CSS variables.
  Flicker is still prevented — the vars ship in the SSR'd HTML — without a Hub round trip
  in front of every asset request.
- Cookie constraint — **settled.** Keystone's session is `sameSite: "strict"` on
  `.mindhive.science` (`keystone/auth.ts`), so tenant-facing pages must live under that apex.
  The app therefore moves to `experience.mindhive.science`; PRD §3.4's `tenantA.platform.com`
  does not apply. Two consequences worth holding onto:
  - Tenants are distinguished by **path** (`/e/[org]/[experience]`) rather than by their own
    subdomain, unless we later add per-tenant subdomains *under* the same apex. The proxy
    rewrite in Phase 4 stays as planned; it just has less to do.
  - Our origin now receives MindHive session cookies on **every** request, including the page
    hosting the participant's p5 iframe. This is what makes deviation A above non-negotiable.
- Keystone production disables GraphQL introspection and caps query depth at 10
  (`keystone.ts`). Hand-write the Hub queries; no codegen against production.
- Local dev: MindHive's Keystone runs on **`:4444`** (`/api/graphql`, sqlite, introspection
  on), driven by another process — do not restart it. Its dev CORS origin is
  `localhost:3000`, which is also where MindHive's own frontend sits, so `next dev` here will
  take 3001. Irrelevant to Hub calls (server-to-server), and localhost cookies ignore port, so
  tenant auth still works in dev.

## Implementation

### Phase 0 — Groundwork
`git init` and an initial commit before any edit (user is handling this).

### Phase 0.5 — Port the star sketch *(this repo — do this first)*
Moved ahead of Phase 1 deliberately. Porting `StarCanvas.tsx` into a standalone p5 1.11.3
global-mode file, driven only through the fixed `postMessage` transport and a `parameters`
list, is what **discovers** the extended parameter schema that Phase 1 then stores. Doing it
last means designing the schema blind and rediscovering it as rework. It is also the riskiest
single item in the plan (deviation B), so it should fail early if it is going to.

Output: the sketch as a `Visual`-shaped asset, plus a first honest draft of the parameter
entry shape. No Hub, no Supabase, no tenancy — a local harness is enough.

### Phase 1 — Hub storage for the three artefacts *(files written to `hub-schema/` here)*
Written into `hub-schema/` in this repo with a README mapping each file to its destination
under `keystone/schemas/` and `keystone/mutations/`; the tenant lands and reviews them in
`mindhive_local`. New lists follow the conventions in `YQVisual.ts` and `Study.ts` and are
registered in `schema.ts`:

- **`YQExperience`** — `organization`, `slug` (reuse `Study.ts`'s slugify-on-create hook
  verbatim), `title`, `visual` (→ `Visual`, artefact 3), `theme` + `lexicon` json
  (artefact 2), `openForParticipation` checkbox, `author`/`collaborators`, `status`.
- **`YQSupabaseConnection`** (artefact 1) — `organization`, `projectRef`, encrypted
  access/refresh token and resolved keys, all `access: { read: () => false }`.
- Relationship additions: `Organization.experiences`, `Visual.experiences`.
- **`resolveExperienceRuntime`** and its narrower credentials sibling — the two shared-secret
  resolvers from decision 3b, in `keystone/mutations/`, registered through the existing
  `extendGraphqlSchema` in `mutations/index.ts`. These are the only code that decrypts, and
  the only door past `read: () => false`. They ship **with** the schema, not after it:
  without them Phase 4 cannot read a single credential.

Access control mirrors `YQVisual.ts`: org admins own it, collaborators edit content, others
read only what's public.

### Phase 2 — Job 1: tenant setup UI *(this repo)*
The flows a tenant uses to author the three artefacts into MindHive.

- `src/lib/hub/client.ts` — server-side Keystone GraphQL client (server-to-server, so no
  CORS involvement), with caching and a defined failure mode when the Hub is unreachable.
  It speaks in **two modes**: forwarding the tenant's Keystone session cookie for everything
  tenant-facing, and presenting the shared secret for the two participant-runtime resolvers.
  Nothing else gets the secret.
- **Artefact 1 — connection.** `src/app/api/connect/supabase/start` (PKCE S256 + `state` in
  an httpOnly cookie → `api.supabase.com/v1/oauth/authorize`) and `.../callback` (exchange
  at `POST /v1/oauth/token` with HTTP Basic, encrypt, store).
  `src/lib/hub/management-api.ts` covers `GET /v1/projects` (picker),
  `GET /v1/projects/{ref}/api-keys`, and refresh-on-expiry.
- **Artefact 2 — styling & language.** A form writing `theme` + `lexicon` json: the palette
  that currently lives in `src/lib/theme.ts`, plus the noun ("star" / "tree", singular and
  plural) and screen copy that is currently inline in `PlanetEditor`.
- **Artefact 3 — p5 asset.** A *picker* over the tenant's `Visual`s, linking out to
  MindHive's editor. No editing here.

### Phase 3 — Job 3: provision the tenant's Supabase *(this repo)*
`src/lib/spoke/provision.ts` — render the schema, apply it through the Management API query
endpoint, and fall back to copy-pasteable SQL when DDL is refused. Also attempts to enable
anonymous sign-ins via the auth-config endpoint — and, in the same step, reports the
project's current anonymous sign-in rate limit back to the tenant with a link to Supabase's
docs on it and on MAU accrual, so an event-scale limit is a number they chose rather than one
they discover mid-event (decision 1).

The schema is the RLS-honest, generic descendant of today's migrations:

- `avatars` — `owner uuid references auth.users default auth.uid()`, `name`,
  `answers jsonb`, `params jsonb` (shape varies per Visual, so **no CHECK constraint** —
  validation is app-side against the parameter schema), `is_staged`, timestamps.
- `sync_sessions` — the generic descendant of `session_scores`: external session id, the
  two avatar references, score, strategy, duration, recorded_at. The table and its RLS ship
  now; the report that visualises it stays parked.
- RLS that actually constrains: participants insert and update only rows where
  `auth.uid() = owner`; reads are as wide as the experience needs; `sync_sessions` writes
  are restricted to an elevated role.
- Realtime publication and the `updated_at` trigger carry over from
  `001_planets.sql`, which already has both patterns worth keeping.

### Phase 4 — Job 2: open the experience, and run it *(this repo)*
**First task: the `postMessage` transport from deviation A** — explicit `"*"` both ways, an
`event.source` identity check inbound, `allow-same-origin` dropped. Everything else in this
phase renders through it, so it cannot be discovered late.

- `src/proxy.ts` — rewrite to `/e/[org]/[experience]/...`. Pure string work, and less of it
  than originally planned now that tenants are path-scoped under one apex rather than each
  holding a subdomain. Note this file currently does a Supabase session refresh
  (`utils/supabase/middleware.ts`) that goes away with the build-time env vars.
- `src/app/e/[org]/[experience]/layout.tsx` — server component; loads the experience from
  the Hub and inlines `--color-void` / `--color-paper` / `--color-dim` / fonts as CSS vars.
  `src/lib/theme.ts`'s constants become fallback defaults, and `globals.css`'s `@theme`
  block keeps the same names so every `text-dim` / `bg-void` utility already in the markup
  resolves to tenant values unchanged.
- `src/lib/spoke/browser-client.ts` — builds a Supabase browser client from the
  experience's project URL + publishable key, and signs the participant in anonymously.
- `src/lib/avatars.ts` replaces `src/lib/planets.ts` — same function shapes
  (`listAvatars`, `getAvatar`, `upsertAvatarById`), still browser-side as today, but
  experience-scoped and under RLS. `normalizePlanet`'s normalize-on-read pattern is kept;
  fixed-shape `toStarParams` gives way to schema-driven coercion.
- `src/lib/visuals/` — adapter over `Visual`: code URL, `parameters`, `extensions` →
  `VisualDefinition`; plus `coerce.ts`, which generalizes `clampStar` / `toStarParams` to
  clamp and default any value against its declared parameter.
- `src/components/AvatarCanvas.tsx` — replaces `StarCanvas` / `StarCanvasClient`; the
  sandboxed iframe contract above.
- `src/components/AvatarControls.tsx` — replaces `StarControls` + `StarSliders`, rendering
  rows generically from the parameter list. The hue ramp and terminal styling in
  `globals.css` are kept, keyed off `type: "hue"`.
- `src/components/AvatarEditor.tsx` — `PlanetEditor` generalized: the name/tune/done flow
  survives, the naming step becomes *N* questions from the schema, and every "star" string
  comes from the lexicon.
- Wire the **Phase 0.5** sketch port in as a real `Visual` so the CCN experience still
  renders. The port itself has already happened by now; what this step tests is the
  abstraction around it — schema-driven params, lexicon, theme, RLS — end to end.

### Phase 5 — Admin (tenant-facing, server-side)
Lowest priority; it is the one place that needs the relay.

- `src/app/api/e/[org]/[experience]/stream/route.ts` — server holds the Spoke Realtime
  subscription and pushes rows as SSE, since a tenant view reading across all participants
  cannot use the participant's RLS-scoped session.
- `src/lib/use-realtime-relay.ts` replaces the direct `.channel()` subscriptions in
  `src/app/admin/page.tsx`; that file is 1827 lines and is the largest single job here.
  Staging (`is_staged`, `MAX_STAGED`) carries over.
- `StarSwatch` becomes a generic thumbnail. Its reason for existing — browsers cap WebGL
  contexts near 16, so list rows can't each host a live sketch — applies even harder to
  iframes, so the cheap CSS stand-in stays.

### Parked (left on disk, unrouted)
`app/conclusion/`, `app/results/`, `app/leaderboard/`, `ConclusionCharts.tsx`,
`ScoreHistogram.tsx`, `Leaderboard.tsx`, `lib/conclusion-*.ts`, `lib/leaderboard.ts`,
`lib/session-scores*.ts`, `app/api/admin/session-scores/`.
The `sync_sessions` table ships in Phase 3, so unparking is later a UI job, not a data job.

**`app/api/session-scores/` is not parked — it is an open question.** That endpoint is how
YouQuantified posts scores *into* this app (shared secret, `YQ_API_SECRET`), so it is a live
integration rather than report plumbing. Multi-tenancy breaks its contract in two places: YQ
must say *which experience* it is posting to, and this app must fetch that tenant's secret
key to write the row. Ship `sync_sessions` and its RLS in Phase 3 as planned, but the
ingest contract needs a decision before the table is useful to anyone.

## Verification

1. `npm run build` and `npm run lint` clean; the Keystone migration applies and
   `schema.graphql` regenerates without unrelated drift.
2. **Hub:** connection secrets absent from the GraphQL schema and unreadable through the
   API; a non-admin of an org cannot read that org's experiences.
3. **Setup:** run the OAuth flow against a real Supabase account — project list loads, keys
   resolve, tokens stored encrypted, an expired token refreshes. Author theme, lexicon and
   a Visual choice, and confirm they land on the `YQExperience` record.
4. **Provisioning:** against a fresh empty project, auto-apply and confirm tables, RLS,
   triggers and realtime publication land, and anonymous sign-ins get enabled; then force
   the failure path and confirm the fallback SQL produces an identical schema.
5. **RLS is real** — the test today's policies would fail. As participant A, attempt to
   update participant B's avatar row directly and confirm it is refused, not merely hidden.
6. **Participant runtime:** open the experience cold; an anonymous session is created, an
   avatar saves, and it survives a reload. A second browser gets a distinct participant.
7. **Two tenants, one codebase.** Seed org A as "stars" with the ported CCN sketch, and org
   B as "trees" with a different sketch, palette, and a *different number* of questions.
   On each subdomain: create, tune, save, reload. Both work with no branching on tenant.
8. No tenant secret in any client bundle or payload — grep the built output for the token
   and secret-key prefixes. The publishable key *is* expected there; nothing else is.
9. The avatar iframe cannot reach the parent origin (`window.parent.document` from a test
   sketch must throw) — **and the transport still works across that boundary**: params reach
   the sketch, `sendEvent` reaches the parent, and a deliberate error in `draw` still surfaces
   in the error relay. The second half is what the `targetOrigin` change exists for, and it
   fails silently if wrong, so test it explicitly rather than inferring it from a render.
10. **SSE:** open admin, create an avatar in another browser, confirm it appears live.
11. **The ported sketch runs under p5 1.11.3**, not 2.x — both `createFilterShader` passes
    render, and the star is visually indistinguishable from today's `StarCanvas`.
12. **Anonymous sign-in rate limit** is understood before it matters: confirm the tenant
    project's configured limit, and that many participants joining from one IP degrades with
    a legible message rather than a blank experience.

## Risks and open questions

- **Management API DDL access is the main external unknown.** Supabase's docs say only some
  Management API features are available pending fine-grained access control. The SQL
  fallback is what keeps onboarding alive if DDL or the auth-config write is refused —
  build it first, not last.
- **This plan edits two repos** — *resolved.* Keystone-side files are written to
  `hub-schema/` here; the tenant lands and reviews them in `mindhive_local`. Nothing in this
  plan writes to `mindhive_local` directly, and the Keystone dev server on `:4444` belongs to
  another process.
- **The Visuals editor hasn't shipped.** Until it learns the extended `parameters` fields,
  they must be seeded by hand — which gates how self-serve artefact 3 really is.
- **Cookie domain** — *resolved*: the app moves to `experience.mindhive.science`. The cost is
  that `constellation.youquantified.com` is retired and any link to it needs redirecting.
- **Supabase may not be the long-term participant backend.** The anonymous-auth rate limit
  and MAU accrual (decision 1) are real constraints on event-scale use. Keep `src/lib/spoke/`
  narrow enough that the provider is swappable, and surface Supabase's own documentation on
  both limits during tenant setup rather than letting a tenant meet them live.
- **The p5 1.11.3 pin is a compatibility decision to revisit** once the Visuals editor ships;
  moving it is a YouQuantified-side migration, not a change this repo can make alone.
- **The YQ → app score ingest contract is undecided** under multi-tenancy (see Parked).
- **Tenant-supplied p5 is the security boundary of this product.** The sandbox deviation is
  not optional polish.
- Admin is the largest porting job and the least essential to milestone 1; if something
  slips, it should slip alone.

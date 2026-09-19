# Planet Sync (Nowadays · CCN 2026)

Companion app for [YouQuantified](https://github.com/mindhiveproject/You-Quantified): participants create and tune personal stars; those stars are staged into live sync sessions; scores come back into this app for results and wrap-up.

Built by [MindHive](https://mindhive.science) for **social hours** around the [Cognitive Computational Neuroscience (CCN) 2026](https://2026.ccneuro.org) conference at NYU (August 3–6, 2026).

**Live app:**  [https://constellation.youquantified.com/](https://constellation.youquantified.com/)
**Source:** [mindhiveproject/nowadays-ccn-2026](https://github.com/mindhiveproject/nowadays-ccn-2026)

## Archival notice

After the CCN 2026 social-hours experience ends, **this application’s database will be archived and deactivated**. Participant stars, staging state, and session scores will no longer be writable, but will be kept live. The codebase and this README remain as a record of what ran for YouQuantified at the event.

## Links

| What | Where |
| --- | --- |
| [MindHive](https://mindhive.science) | Citizen-science platform behind the lab |
| [YouQuantified](https://github.com/mindhiveproject/You-Quantified) | EEG / MoBI sync experience this app feeds |
| [Admin UI](https://constellation.youquantified.com/admin) | Constellation Admin UI |
| [Conclusion page](https://constellation.youquantified.com/conclusion) | Final result! |
| [CCN 2026](https://2026.ccneuro.org) | Conference host for this deployment |
| [About the lab (slides)](https://docs.google.com/presentation/d/1qN0DVo8qp8470tybFpexpE6f0giwSPi4s3w4CrMs618) | Linked from the participant UI |
| [About Constellation)](https://www.figma.com/deck/W5lG6bnmaCNL7BTBiqWwTI) | Figma slide |

## What it does

1. **Create** — Guests name themselves, then design a star (params + live p5 preview). Rows are stored as `planets` in Supabase.
2. **Stage** — Ops pick up to two stars (`is_staged`) for the YouQuantified session.
3. **Score** — YouQuantified posts pair scores (and strategy metadata) to this app’s API after each IRL run.
4. **Reflect** — Participants see their runs, a global scoreboard, and a conclusion view of the score distribution.

## App endpoints

Base URL: `https://constellation.youquantified.com`

### Participant pages

| Path | Purpose |
| --- | --- |
| [`/`](https://constellation.youquantified.com/) | Identity + first star, or your star list |
| [`/new`](https://constellation.youquantified.com/new) | Create another star |
| [`/p/[id]`](https://constellation.youquantified.com/p/) | View one star |
| [`/p/[id]/edit`](https://constellation.youquantified.com/p/) | Tune / rename a star |
| [`/results`](https://constellation.youquantified.com/results) | Your runs and pair scores |
| [`/leaderboard`](https://constellation.youquantified.com/leaderboard) | Global best-run scoreboard |
| [`/conclusion`](https://constellation.youquantified.com/conclusion) | Score distribution / wrap-up |

### Admin

| Path | Purpose |
| --- | --- |
| [`/admin`](https://constellation.youquantified.com/admin) | Password-gated monitor: edit planets, stage pairs, manage scores |

### API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/session-scores` | YouQuantified score webhook (`Bearer YQ_API_SECRET`) |
| `POST` | `/api/admin/login` | Admin password → session cookie |
| `GET` | `/api/admin/session` | Check admin session |
| `GET` / `POST` | `/api/admin/session-scores` | List / create scores (admin) |
| `PATCH` / `DELETE` | `/api/admin/session-scores/[id]` | Update / delete a score (admin) |

## Quick how-to

### Participants

1. Open [`/`](https://constellation.youquantified.com/) on your phone.
2. Enter your first name (email optional).
3. Name your star, then tune core, frequency, scatter, and colors until it feels right — save when done.
4. Join the IRL YouQuantified sync when ops stage your star with a partner.
5. After runs land, open [`/results`](https://constellation.youquantified.com/results) for your scores, [`/leaderboard`](https://constellation.youquantified.com/leaderboard) for the room, and [`/conclusion`](https://constellation.youquantified.com/conclusion) for the wrap-up charts.
6. Use the same device/browser if you want your star list again (identity is keyed to an anonymous id in local storage).

### Admins

1. Open [`/admin`](https://constellation.youquantified.com/admin) and sign in with `ADMIN_PASSWORD`.
2. Watch new planets arrive in realtime; filter / search as needed.
3. Pre-select or stage **up to two** stars (`is_staged`) for the next YouQuantified pair.
4. Confirm scores as YQ posts them (or enter/edit scores manually if needed).
5. Unstage and restage between pairs; keep the live list synced with the floor.

### Developers

1. Clone [the repo](https://github.com/mindhiveproject/nowadays-ccn-2026), copy `.env.example` → `.env.local`, and fill in values:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
# Prefer sb_secret_... from Dashboard → Settings → API Keys
SUPABASE_SECRET_KEY=your-secret-key
# Legacy fallback (JWT service_role) — optional during migration
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=change-me
YQ_API_SECRET=change-me-yq-shared-secret
```

2. Apply migrations under `supabase/migrations/` to your project.
3. `npm install` then `npm run dev` → [http://localhost:3000](http://localhost:3000).
4. Participant UI hits Supabase with the publishable key; YQ writes via `POST /api/session-scores` (service role + shared secret).
5. Stack: Next.js · Supabase (Realtime) · p5.

## Status

Built and run for live YouQuantified sessions at CCN 2026 social hours. Participant flow, admin staging/monitor, and the YQ score webhook are in place. Post-event, expect the database to be archived and deactivated (see above).

## Thank you everyone

To everyone who named a star, tuned a corona, and synced up with a stranger at CCN!
We’re glad you showed up, stay bright!!
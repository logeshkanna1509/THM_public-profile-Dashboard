# THM Public Profile Dashboard

A minimalist, web-based **TryHackMe student monitoring dashboard** for educational
institutions. Built with **Next.js (App Router)**, **Tailwind CSS**, and
**Supabase**, optimized for hosting on **Vercel**.

- **`/`** — ultra-minimal search: enter a TryHackMe username or profile link.
- **`/dashboard/[username]`** — gamified student dashboard (avatar, rank, level,
  points, badges, completed rooms, milestone bars).
- **`/roster`** — read-only, sortable history of every student ever searched,
  with the time they were added and last searched.

---

## Architecture

```
app/
  page.tsx                 Home (form + Server Action)
  actions.ts               Server Action: validate → save → redirect
  dashboard/[username]/    Student dashboard (server component, scrapes + saves)
  roster/page.tsx          Sortable roster table (client sort)
  api/profile/route.ts     GET API: scrape + save, returns JSON
components/
  MetricCard.tsx           Presentational metric tile
  SortableRoster.tsx       Client-side sortable table
lib/
  thm.ts                   TryHackMe scraper/parser (cheerio)
  db.ts                    Supabase upsert layer (+ in-memory dev fallback)
  types.ts                 Shared types
supabase/schema.sql        Table + RLS policies
```

The scraping + DB-insert logic is exposed **both** as a Server Action (home form)
and a Route Handler (`/api/profile`) so you can choose whichever fits.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Database (Supabase)

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql).
   This creates the `students` table (`username` unique, `added_at`,
   `last_searched`) and safe public RLS policies.
3. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; bypasses RLS)

> **Local dev without a database?** If those vars are absent, the app falls
> back to an in-memory store so `npm run dev` works immediately. It is **not
> persisted** and is disabled in production.

### 3. Run

```bash
npm run dev      # http://localhost:3000
npm run build && npm start
```

### 4. Deploy (Vercel)

Import the repo into Vercel, add the `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` environment variables, and deploy. No extra config
needed — `next.config.mjs` already allows TryHackMe avatar images.

---

## ⚠️ Important: TryHackMe bot protection

TryHackMe public profiles sit behind **Vercel’s “Security Checkpoint”** (HTTP 429
bot protection). Automated server-side requests can be rate-limited or challenged.

This codebase handles that gracefully:

- The scraper detects the checkpoint page and returns a friendly
  `rate_limited` state instead of crashing.
- Responses are cached for 1 hour (`revalidate`) to minimize repeat hits.
- The v2 `badges` endpoint is used as a best-effort enrichment layer when a
  numeric `userPublicId` is present in the markup.

If you deploy and see persistent 429s, mitigation options:

1. **Proxy the fetch** through a轮换 IP / rotating proxy in `lib/thm.ts`.
2. **Cache aggressively** and/or pre-warm profiles via a scheduled job.
3. **Ask students to provide their numeric badge ID** (the v2 endpoint accepts
   `userPublicId`) to skip the HTML scrape entirely.

---

## API

```
GET /api/profile?username=<name-or-link>
```

Returns the parsed `THMProfile` JSON, or an error status:

| Status | Meaning                |
| ------ | ---------------------- |
| 200    | OK — profile returned  |
| 404    | User not found         |
| 429    | TryHackMe rate limited |
| 502    | Unexpected error       |

---

## Environment variables

| Variable                     | Required | Purpose                              |
| ---------------------------- | -------- | ------------------------------------ |
| `SUPABASE_URL`               | prod     | Supabase project URL                 |
| `SUPABASE_SERVICE_ROLE_KEY`  | prod     | Server-side writes (bypasses RLS)    |
| `SUPABASE_ANON_KEY`          | optional | Fallback if service role unset       |
| `NEXT_PUBLIC_APP_URL`        | optional | Canonical app URL                    |

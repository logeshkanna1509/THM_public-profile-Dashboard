# THM Profile Dashboard

A minimalist, web-based **TryHackMe profile viewer**. Enter any public
TryHackMe username (or profile link) and get a clean, gamified dashboard of
their rank, level, badges, points, and progress. No database, no login — just
viewing.

Built with **Next.js (App Router)**, **Tailwind CSS**, and **cheerio**, and
deployed on **Vercel**.

## Pages

- **`/`** — search: enter a TryHackMe username or profile link.
- **`/dashboard/[username]`** — gamified profile dashboard (avatar, rank,
  level, points, badges, completed rooms, milestone bars).
- **`/api/profile?username=<name>`** — JSON API: scrape + return the profile.

## How scraping works

TryHackMe sits behind bot-protection that blocks datacenter IPs (including
Vercel's). To scrape reliably from a deployed server, route the fetch through a
proxy / scraping API via `THM_PROXY_URL` (e.g. ScrapingBee). The scraper
detects rate-limit / checkpoint pages and returns a friendly state instead of
crashing. Profiles are cached for 1 hour.

## Setup

```bash
npm install
cp .env.example .env.local   # set THM_PROXY_URL (recommended on Vercel)
npm run dev                  # http://localhost:3000
```

## Environment variables

| Variable           | Required | Purpose                                              |
| ------------------ | -------- | ---------------------------------------------------- |
| `THM_PROXY_URL`    | prod     | Proxy/scraping API URL with a `__URL__` placeholder  |
| `NEXT_PUBLIC_APP_URL` | optional | Canonical app URL (metadata)                      |

## Deploy (Vercel)

```bash
vercel env add THM_PROXY_URL production   # paste your proxy URL
vercel deploy --prod
```

No database is required — the app only reads public TryHackMe profiles.

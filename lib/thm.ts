import * as cheerio from "cheerio";
import { normalizeUsername, profileUrlFor } from "./normalize";
import type { ScrapeResult, THMProfile } from "./types";

// Re-export so existing server-side imports keep working.
export { normalizeUsername, profileUrlFor };

/**
 * TryHackMe public-profile scraper.
 *
 * IMPORTANT — TryHackMe sits behind Vercel's "Security Checkpoint" bot
 * protection. Server-side requests are frequently answered with HTTP 429 and a
 * checkpoint page. This module detects that case explicitly and returns
 * `rate_limited` so the UI can show a friendly message instead of crashing.
 *
 * How the metrics are obtained
 * -----------------------------
 * TryHackMe's public profile page is a client-rendered React app: the server
 * HTML only contains the avatar (via og:image). The numeric stats (Rank,
 * Badges, Completed rooms, Streak, Level, Country) are fetched by the browser
 * after hydration. To capture them when proxying, we tell the proxy to
 * RENDER JAVASCRIPT (e.g. ScrapingBee `render_js=True&wait=networkidle`) so the
 * post-hydration DOM — with the stat boxes — is what we parse.
 *
 * Note: TryHackMe no longer exposes a user's *points* on public profiles, so
 * `points` is always null. Use `rank` (a percentile like "Top 15%") instead.
 *
 * Strategy:
 *   1. Fetch the public profile HTML at /p/<username> (primary source). If
 *      THM_PROXY_URL is set, the request is routed through a proxy / scraping
 *      API to bypass the WAF (required when hosted on a datacenter like Vercel).
 *   2. Parse avatar + the stat boxes with resilient class/substring selectors.
 */

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Referer": "https://tryhackme.com/",
  "sec-ch-ua": '"Chromium";v="120", "Google Chrome";v="120", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// Optional upstream proxy / scraping API (e.g. ScrapingBee, ZenRows) used to
// bypass TryHackMe's bot-protection, which blocks datacenter IPs (including
// Vercel's). Set THM_PROXY_URL with a __URL__ placeholder, e.g.
//   https://app.scrapingbee.com/api/v1?api_key=KEY&url=__URL__
// or a plain ?url= endpoint. Leave empty to fetch TryHackMe directly.
const THM_PROXY_URL = process.env.THM_PROXY_URL?.trim() || "";

type HtmlFetch =
  | { status: "ok"; html: string }
  | { status: "not_found" }
  | { status: "rate_limited" }
  | { status: "error"; message: string };

/** Build the final upstream URL, appending JS-render params for ScrapingBee. */
function buildProxyUrl(targetUrl: string): string {
  const withUrl = THM_PROXY_URL.includes("__URL__")
    ? THM_PROXY_URL.replace("__URL__", encodeURIComponent(targetUrl))
    : `${THM_PROXY_URL}${THM_PROXY_URL.includes("?") ? "&" : "?"}url=${encodeURIComponent(targetUrl)}`;

  // Render JS so client-fetched stats appear in the returned HTML.
  if (/scrapingbee\.com/i.test(THM_PROXY_URL) && !/[?&]render_js=/i.test(withUrl)) {
    const sep = withUrl.includes("?") ? "&" : "?";
    return `${withUrl}${sep}render_js=True&wait=5000`;
  }
  return withUrl;
}

async function fetchThm(
  targetUrl: string,
): Promise<{ httpStatus: number; html: string }> {
  const url = THM_PROXY_URL ? buildProxyUrl(targetUrl) : targetUrl;

  const res = await fetch(url, {
    headers: THM_PROXY_URL ? {} : BROWSER_HEADERS,
    redirect: "follow",
    cache: "no-store",
  });

  const ct = res.headers.get("content-type") || "";
  let html = "";
  if (ct.includes("application/json")) {
    try {
      const json = await res.json();
      const wrapped =
        json?.contents ?? json?.html ?? json?.body ?? json?.data ?? json?.result;
      html = typeof wrapped === "string" ? wrapped : JSON.stringify(json);
    } catch {
      html = await res.text();
    }
  } else {
    html = await res.text();
  }

  return { httpStatus: res.status, html };
}

async function fetchProfileHtml(targetUrl: string): Promise<HtmlFetch> {
  let fetched: { httpStatus: number; html: string };
  try {
    fetched = await fetchThm(targetUrl);
  } catch (err) {
    try {
      fetched = await fetchThm(targetUrl);
    } catch (err2) {
      return { status: "error", message: (err2 as Error).message };
    }
  }

  const { httpStatus, html } = fetched;

  // Status shortcuts only apply to direct (non-proxy) requests; a proxy
  // typically returns 200 and embeds the real status in the HTML.
  if (httpStatus === 404) return { status: "not_found" };
  if (THM_PROXY_URL && httpStatus >= 400)
    return { status: "error", message: `Proxy returned HTTP ${httpStatus}.` };

  if (/Vercel Security Checkpoint/i.test(html) || /security checkpoint/i.test(html))
    return { status: "rate_limited" };
  if (/user (not found|does not exist)|couldn'?t find that user/i.test(html))
    return { status: "not_found" };
  if (!THM_PROXY_URL && httpStatus >= 400)
    return { status: "error", message: `TryHackMe returned HTTP ${httpStatus}.` };

  return { status: "ok", html };
}

/* ────────────────────────────────────────────────────────────────────────── */

function parseProfileHtml(
  username: string,
  profileUrl: string,
  html: string,
): THMProfile {
  const $ = cheerio.load(html);

  const avatarUrl =
    $('meta[property="og:image"]').attr("content") ||
    $("img.avatar").attr("src") ||
    $('[class*="avatar"] img').first().attr("src") ||
    null;

  let level: number | null = toNumber($('[data-testid="level"]').first().text().trim());
  let rank: string | null = null;
  let badges: number | null = null;
  let roomsCompleted: number | null = null;
  let streak: number | null = null;
  // TryHackMe no longer publishes a user's points on public profiles.
  const points: number | null = null;

  // Stat boxes:  <div class="*StyledStatisticsBoxText*">LABEL</div>
  //              <div class="*StyledStatisticsBoxIconNumberContainer*">
  //                ... <div class="*StyledStatisticsBoxNumber*">VALUE</div>
  $('[class*="StyledStatisticsBoxText"]').each((_, el) => {
    const label = $(el).text().trim().toLowerCase();
    const numText = $(el)
      .next()
      .find('[class*="StyledStatisticsBoxNumber"]')
      .first()
      .text()
      .trim();
    const num = toNumber(numText);
    switch (label) {
      case "rank":
        rank = numText || rank; // e.g. "Top 15%"
        break;
      case "badges":
        badges = num ?? badges;
        break;
      case "completed rooms":
        roomsCompleted = num ?? roomsCompleted;
        break;
      case "streak":
        streak = num ?? streak;
        break;
      case "level":
        level = num ?? level;
        break;
      default:
        break;
    }
  });

  return {
    username,
    avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl) : null,
    level,
    rank,
    points,
    badges,
    roomsCompleted,
    streak,
    profileUrl,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */

export async function scrapeProfile(raw: string): Promise<ScrapeResult> {
  const username = normalizeUsername(raw);
  if (!username) return { status: "error", message: "Invalid username provided." };

  const profileUrl = profileUrlFor(username);
  const fetched = await fetchProfileHtml(profileUrl);

  if (fetched.status === "rate_limited") return { status: "rate_limited" };
  if (fetched.status === "not_found") return { status: "not_found" };
  if (fetched.status === "error")
    return { status: "error", message: fetched.message };

  const profile = parseProfileHtml(username, profileUrl, fetched.html);
  return { status: "ok", profile };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* small parsing helpers                                                     */

function toNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v.replace(/[,\s%]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toAbsoluteUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `https://tryhackme.com${src}`;
  return src;
}

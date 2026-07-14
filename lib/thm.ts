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
 * Strategy:
 *   1. Fetch the public profile HTML at /p/<username> (primary source). If
 *      THM_PROXY_URL is set, the request is routed through a proxy / scraping
 *      API to bypass the WAF (required when hosted on a datacenter like Vercel).
 *   2. Parse avatar / level / rank / points / badges / rooms with several
 *      resilient selectors + regex fallbacks (markup changes over time).
 *   3. Best-effort enrichment from the v2 "badges" endpoint when a numeric
 *      userPublicId can be located in the page markup.
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

// We deliberately do NOT cache (no-store) so a transient 429 / checkpoint
// block is never served stale to other visitors for an extended period.

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

/**
 * Fetch a TryHackMe URL, optionally through THM_PROXY_URL. Returns the raw
 * response body (some proxies wrap HTML in JSON, e.g. { contents: "..." }).
 */
async function fetchThm(
  targetUrl: string,
): Promise<{ httpStatus: number; html: string }> {
  const url = THM_PROXY_URL
    ? THM_PROXY_URL.includes("__URL__")
      ? THM_PROXY_URL.replace("__URL__", encodeURIComponent(targetUrl))
      : `${THM_PROXY_URL}${THM_PROXY_URL.includes("?") ? "&" : "?"}url=${encodeURIComponent(targetUrl)}`
    : targetUrl;

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
    // Retry once on a transient network error.
    try {
      fetched = await fetchThm(targetUrl);
    } catch (err2) {
      return { status: "error", message: (err2 as Error).message };
    }
  }

  const { httpStatus, html } = fetched;

  // Status shortcuts only apply to direct (non-proxy) requests; a proxy
  // typically returns 200 and embeds the real status in the HTML.
  if (!THM_PROXY_URL && httpStatus === 429) return { status: "rate_limited" };
  if (!THM_PROXY_URL && httpStatus === 404) return { status: "not_found" };
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
  const bodyText = $("body").text();

  const avatarUrl =
    $('meta[property="og:image"]').attr("content") ||
    $("img.avatar").attr("src") ||
    $('[class*="avatar"] img').first().attr("src") ||
    null;

  const level = firstNumber(bodyText, /level[:\s]*(\d+)/i) ?? countByClass($, "level");
  const rank =
    firstCapture(bodyText, /rank[:\s]*([A-Za-z0-9 ]+?)(?:\n|$)/i) ||
    $("span.rank-title").first().text().trim() ||
    null;
  const points =
    firstNumber(bodyText, /([\d,]+)\s*points?/i) ??
    firstNumber(bodyText, /points?[:\s]*([\d,]+)/i);
  const badges =
    firstNumber(bodyText, /badges?[:\s]*(\d+)/i) ?? countByClass($, "badge");
  const roomsCompleted =
    firstNumber(bodyText, /(\d+)\s*rooms?\s*(?:completed|done)/i) ??
    firstNumber(bodyText, /completed\s*rooms?[:\s]*(\d+)/i);

  return {
    username,
    avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl) : null,
    level,
    rank: rank ? rank : null,
    points,
    badges,
    roomsCompleted,
    profileUrl,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Enrich from the v2 "badges" endpoint. It returns HTML spans
 * (class `details-text`) in the order: Rank, Streak, Badges, CompletedRooms,
 * Level, plus a profile image URL in inline CSS. Requires the numeric
 * userPublicId, which we try to discover in the profile markup.
 */
async function enrichFromV2(
  html: string,
  base: THMProfile,
): Promise<THMProfile> {
  const idMatch =
    html.match(/userPublicId["'=:\s]+(\d+)/i) ||
    html.match(/user_id["'=:\s]+(\d+)/i);
  if (!idMatch) return base;

  try {
    const url = `https://tryhackme.com/api/v2/badges/public-profile?userPublicId=${encodeURIComponent(
      idMatch[1],
    )}`;
    const { httpStatus, html: v2 } = await fetchThm(url);
    if (THM_PROXY_URL ? httpStatus >= 400 : !httpStatus.toString().startsWith("2"))
      return base;
    if (/Vercel Security Checkpoint/i.test(v2)) return base;

    const $ = cheerio.load(v2);
    const details = $("span.details-text")
      .map((_, el) => $(el).text().trim())
      .get();

    const pfp =
      v2.match(/background-image:\s*url\((['"]?)([^'")]+)\1\)/i)?.[2] ||
      v2.match(/https?:\/\/[^"')\s]+\.(?:png|jpe?g|webp)/i)?.[0] ||
      null;

    const extra: THMProfile = {
      ...base,
      rank: details[0] || base.rank,
      badges: details[2] ? toNumber(details[2]) ?? base.badges : base.badges,
      roomsCompleted: details[3]
        ? toNumber(details[3]) ?? base.roomsCompleted
        : base.roomsCompleted,
      level: details[4] ? toNumber(details[4]) ?? base.level : base.level,
      avatarUrl: pfp ? toAbsoluteUrl(pfp) : base.avatarUrl,
    };
    return extra;
  } catch {
    return base;
  }
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

  let profile = parseProfileHtml(username, profileUrl, fetched.html);
  profile = await enrichFromV2(fetched.html, profile);
  return { status: "ok", profile };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* small parsing helpers                                                     */

function firstNumber(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? toNumber(m[1]) : null;
}

function firstCapture(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function toNumber(value: string): number | null {
  const n = Number(value.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function countByClass($: cheerio.CheerioAPI, klass: string): number | null {
  const count = $(`[class*="${klass}"]`).length;
  return count > 0 ? count : null;
}

function toAbsoluteUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `https://tryhackme.com${src}`;
  return src;
}

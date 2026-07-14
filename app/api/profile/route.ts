import { NextResponse, type NextRequest } from "next/server";
import { scrapeProfile } from "@/lib/thm";

// cheerio + fetch require the Node.js runtime (not Edge).
export const runtime = "nodejs";

const HTTP_STATUS: Record<string, number> = {
  ok: 200,
  not_found: 404,
  rate_limited: 429,
  error: 502,
};

/**
 * GET /api/profile?username=<name-or-link>
 *
 * Scrapes the public TryHackMe profile and returns the parsed profile as JSON.
 * Useful for client-side refresh or integration with other tools.
 */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json(
      { error: "Missing 'username' query parameter." },
      { status: 400 },
    );
  }

  const result = await scrapeProfile(username);

  if (result.status !== "ok") {
    const body =
      result.status === "error" ? { error: result.message } : { error: result.status };
    return NextResponse.json(body, { status: HTTP_STATUS[result.status] ?? 500 });
  }

  return NextResponse.json(result.profile, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

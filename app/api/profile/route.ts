import { NextResponse, type NextRequest } from "next/server";
import { saveStudent } from "@/lib/db";
import { profileUrlFor, scrapeProfile } from "@/lib/thm";

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
 * Scrapes the public TryHackMe profile, records the student in the roster, and
 * returns the parsed profile as JSON. Useful for client-side refresh or
 * integration with other tools.
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
    return NextResponse.json(
      { error: result.status },
      { status: HTTP_STATUS[result.status] ?? 500 },
    );
  }

  try {
    await saveStudent({
      username: result.profile.username,
      profileUrl: profileUrlFor(result.profile.username),
    });
  } catch (err) {
    console.error("[api/profile] failed to save student:", err);
  }

  return NextResponse.json(result.profile, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

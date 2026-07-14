// Pure, dependency-free helpers shared by client and server code.
// Kept separate from lib/thm.ts so client components don't import cheerio.

export function normalizeUsername(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  // Extract username from a full profile link, e.g.
  // https://tryhackme.com/p/example_user  ->  example_user
  const linkMatch = s.match(/tryhackme\.com\/p\/([A-Za-z0-9_\-.]+)/i);
  if (linkMatch) s = linkMatch[1];

  // Strip a leading @ and any surrounding whitespace.
  s = s.replace(/^@/, "").trim();

  // TryHackMe usernames: letters, digits, underscore, hyphen, dot.
  if (!/^[A-Za-z0-9_\-.]{1,40}$/.test(s)) return null;
  return s;
}

export function profileUrlFor(username: string): string {
  return `https://tryhackme.com/p/${username}`;
}

export interface THMProfile {
  username: string;
  avatarUrl: string | null;
  level: number | null;
  rank: string | null;
  points: number | null;
  badges: number | null;
  roomsCompleted: number | null;
  streak: number | null;
  profileUrl: string;
}

export type ScrapeStatus = "ok" | "not_found" | "rate_limited" | "error";

export type ScrapeResult =
  | { status: "ok"; profile: THMProfile }
  | { status: "not_found" }
  | { status: "rate_limited" }
  | { status: "error"; message: string };

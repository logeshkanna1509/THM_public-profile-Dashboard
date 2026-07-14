import type { Metadata } from "next";
import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { profileUrlFor, scrapeProfile } from "@/lib/thm";
import type { THMProfile } from "@/lib/types";

// Revalidate each profile for an hour so we don't hammer TryHackMe on every view.
export const revalidate = 3600;

type Params = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${decodeURIComponent(username)}`,
    description: `TryHackMe progress dashboard for ${decodeURIComponent(username)}.`,
  };
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// Minimalist milestone bars — normalize known metrics against round targets.
function StandingBars({ profile }: { profile: THMProfile }) {
  const bars: { label: string; value: number; target: number; color: string }[] = [
    { label: "Badges", value: profile.badges ?? 0, target: 50, color: "bg-cyber" },
    { label: "Rooms", value: profile.roomsCompleted ?? 0, target: 100, color: "bg-zinc-300" },
    { label: "Streak", value: profile.streak ?? 0, target: 30, color: "bg-accent" },
  ];

  return (
    <div className="card">
      <p className="metric-label mb-5">Current standing</p>
      <div className="space-y-5">
        {bars.map((b) => {
          const pct = Math.min(100, Math.round((b.value / b.target) * 100));
          return (
            <div key={b.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">{b.label}</span>
                <span className="font-mono text-zinc-300">
                  {b.value}
                  <span className="text-zinc-600"> / {b.target}</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${b.color} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-zinc-600">
        Bars show progress toward common milestones, not a global maximum.
      </p>
    </div>
  );
}

function StateBlock({
  title,
  body,
  tone = "default",
}: {
  title: string;
  body: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="card mx-auto mt-16 max-w-lg text-center">
      <h1
        className={`text-2xl font-bold ${
          tone === "warn" ? "text-accent-soft" : "text-zinc-100"
        }`}
      >
        {title}
      </h1>
      <p className="mt-3 text-sm text-zinc-400">{body}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
      >
        ← Back to search
      </Link>
    </div>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username: encoded } = await params;
  const username = decodeURIComponent(encoded);

  const result = await scrapeProfile(username);

  if (result.status === "not_found") {
    return (
      <StateBlock
        title="User not found"
        body={`We couldn’t find a public TryHackMe profile for “${username}”. Double-check the spelling and try again.`}
      />
    );
  }

  if (result.status === "rate_limited") {
    return (
      <StateBlock
        tone="warn"
        title="TryHackMe rate limit reached"
        body="TryHackMe is temporarily blocking automated requests (HTTP 429 / Security Checkpoint). This usually clears within a few minutes — please try again shortly."
      />
    );
  }

  if (result.status === "error") {
    return (
      <StateBlock
        tone="warn"
        title="Something went wrong"
        body={result.message}
      />
    );
  }

  const p = result.profile;

  return (
    <section className="animate-fade-up">
      {/* Profile header */}
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.avatarUrl}
            alt={`${p.username} avatar`}
            width={88}
            height={88}
            className="h-20 w-20 rounded-2xl border border-white/10 object-cover"
          />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-2xl border border-white/10 bg-white/5 font-mono text-2xl font-bold text-zinc-300">
            {initials(p.username)}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="truncate text-3xl font-bold tracking-tight text-zinc-50">
              {p.username}
            </h1>
            {p.level != null ? (
              <span className="pill border-accent/30 bg-accent/10 text-accent-soft">
                Level {p.level}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-400 sm:justify-start">
            {p.rank ? <span className="text-zinc-300">{p.rank}</span> : null}
            <a
              href={p.profileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="link-accent"
            >
              View on TryHackMe ↗
            </a>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Rank" value={p.rank ?? "—"} accent="accent" />
        <MetricCard
          label="Badges"
          value={p.badges != null ? p.badges : "—"}
          accent="cyber"
        />
        <MetricCard
          label="Streak"
          value={p.streak != null ? p.streak : "—"}
        />
        <MetricCard
          label="Rooms Done"
          value={p.roomsCompleted != null ? p.roomsCompleted : "—"}
        />
      </div>

      {/* standing */}
      <div className="mt-4">
        <StandingBars profile={p} />
      </div>
    </section>
  );
}

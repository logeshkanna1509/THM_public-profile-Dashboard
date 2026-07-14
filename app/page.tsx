"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeUsername } from "@/lib/normalize";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = query.trim();
    if (!value) {
      setError("Enter a TryHackMe username or profile link.");
      return;
    }
    const username = normalizeUsername(value);
    if (!username) {
      setError("That doesn’t look like a valid TryHackMe username.");
      return;
    }
    setError(null);
    router.push(`/dashboard/${encodeURIComponent(username)}`);
  }

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="pill mb-6 animate-fade-up">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        TryHackMe profile monitoring
      </p>

      <h1 className="animate-fade-up text-balance text-4xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
        Track a student&rsquo;s
        <span className="text-accent"> hacking journey</span>
      </h1>

      <p className="mt-5 max-w-xl animate-fade-up text-balance text-zinc-400">
        Enter a TryHackMe username or profile link to pull up a clean,
        gamified dashboard of their rank, level, badges, and progress.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex w-full max-w-xl animate-fade-up flex-col gap-3 sm:flex-row"
      >
        <input
          type="text"
          name="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          placeholder="e.g.  username  or  tryhackme.com/p/username"
          aria-label="TryHackMe username or profile link"
          className="h-12 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-accent px-6 font-semibold text-white transition hover:bg-accent-soft"
        >
          Track
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-accent-soft">{error}</p>
      ) : null}

      <p className="mt-8 text-xs text-zinc-600">
        Public profiles only · no login required
      </p>
    </section>
  );
}

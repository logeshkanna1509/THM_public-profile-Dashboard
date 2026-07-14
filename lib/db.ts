import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StudentRow } from "./types";

/**
 * Database layer for the student roster.
 *
 * Production: uses Supabase (Postgres). Run supabase/schema.sql once, then set
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Upserting on the unique `username`
 * column prevents duplicate entries while keeping `added_at` (first seen) intact
 * and bumping `last_searched` on every lookup.
 *
 * Local/dev fallback: when the env vars are absent we keep an in-memory map so
 * `npm run dev` works without any external setup. This is NOT persisted and is
 * intended for development only — it is disabled in production.
 */

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
if (url && serviceKey) {
  client = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// In-memory store, attached to globalThis so it survives hot-reloads in dev.
const globalForDev = globalThis as unknown as {
  __devStudents?: Map<string, StudentRow>;
};
const devStore: Map<string, StudentRow> =
  globalForDev.__devStudents ?? (globalForDev.__devStudents = new Map());

export const usingDatabase = Boolean(client);

export interface SaveStudentInput {
  username: string;
  profileUrl: string;
}

export async function saveStudent(input: SaveStudentInput): Promise<void> {
  const username = input.username.toLowerCase();

  if (client) {
    const { error } = await client.from("students").upsert(
      {
        username,
        profile_url: input.profileUrl,
        last_searched: new Date().toISOString(),
      },
      { onConflict: "username" },
    );
    if (error) throw error;
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Database not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const now = new Date().toISOString();
  const existing = devStore.get(username);
  devStore.set(username, {
    username,
    profile_url: input.profileUrl,
    added_at: existing?.added_at ?? now,
    last_searched: now,
  });
}

export async function listStudents(): Promise<StudentRow[]> {
  if (client) {
    const { data, error } = await client
      .from("students")
      .select("username, profile_url, added_at, last_searched")
      .order("last_searched", { ascending: false });
    if (error) throw error;
    return data as StudentRow[];
  }

  return [...devStore.values()].sort((a, b) =>
    b.last_searched.localeCompare(a.last_searched),
  );
}

export async function getStudent(
  username: string,
): Promise<StudentRow | null> {
  const key = username.toLowerCase();
  if (client) {
    const { data, error } = await client
      .from("students")
      .select("username, profile_url, added_at, last_searched")
      .eq("username", key)
      .maybeSingle();
    if (error) throw error;
    return (data as StudentRow) ?? null;
  }
  return devStore.get(key) ?? null;
}

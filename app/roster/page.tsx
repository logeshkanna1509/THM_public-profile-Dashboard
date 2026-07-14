import type { Metadata } from "next";
import { SortableRoster } from "@/components/SortableRoster";
import { listStudents } from "@/lib/db";
import type { StudentRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Roster",
  description: "Historical record of every TryHackMe student entered into the dashboard.",
};

// Always reflect the latest roster on visit.
export const dynamic = "force-dynamic";

export default async function RosterPage() {
  let rows: StudentRow[] = [];
  let error: string | null = null;
  try {
    rows = await listStudents();
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <section className="animate-fade-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Roster</h1>
        <p className="mt-2 text-sm text-zinc-400">
          A complete, read-only history of every student ever searched. Click a
          name to open their dashboard.
        </p>
      </div>

      {error ? (
        <div className="card text-sm text-accent-soft">
          Could not load the roster: {error}
        </div>
      ) : (
        <SortableRoster rows={rows} />
      )}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { StudentRow } from "@/lib/types";

type SortKey = "username" | "added_at" | "last_searched";
type SortDir = "asc" | "desc";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SortableRoster({ rows }: { rows: StudentRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("last_searched");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "username") cmp = a.username.localeCompare(b.username);
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "username" ? "asc" : "desc");
    }
  }

  const arrow = (key: SortKey) =>
    key === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  if (rows.length === 0) {
    return (
      <div className="card text-center text-sm text-zinc-500">
        No students have been added yet. Search a username from the home page to
        start building your roster.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3 font-medium">
                <button
                  onClick={() => toggle("username")}
                  className="hover:text-zinc-200"
                >
                  Username{arrow("username")}
                </button>
              </th>
              <th className="px-5 py-3 font-medium">Profile</th>
              <th className="px-5 py-3 font-medium">
                <button
                  onClick={() => toggle("added_at")}
                  className="hover:text-zinc-200"
                >
                  Added{arrow("added_at")}
                </button>
              </th>
              <th className="px-5 py-3 font-medium">
                <button
                  onClick={() => toggle("last_searched")}
                  className="hover:text-zinc-200"
                >
                  Last searched{arrow("last_searched")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.username}
                className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-5 py-3">
                  <a
                    href={`/dashboard/${encodeURIComponent(row.username)}`}
                    className="link-accent font-medium"
                  >
                    {row.username}
                  </a>
                </td>
                <td className="px-5 py-3">
                  <a
                    href={row.profile_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                  >
                    tryhackme.com/p/{row.username}
                  </a>
                </td>
                <td className="px-5 py-3 text-zinc-400">
                  {formatDate(row.added_at)}
                </td>
                <td className="px-5 py-3 text-zinc-400">
                  {formatDate(row.last_searched)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/10 px-5 py-3 text-xs text-zinc-600">
        {rows.length} student{rows.length === 1 ? "" : "s"} tracked
      </div>
    </div>
  );
}

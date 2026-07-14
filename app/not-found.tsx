import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-20 max-w-lg text-center">
      <h1 className="text-2xl font-bold text-zinc-100">Page not found</h1>
      <p className="mt-3 text-sm text-zinc-400">
        That route doesn’t exist. Head back and search for a student.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
      >
        ← Back to search
      </Link>
    </div>
  );
}

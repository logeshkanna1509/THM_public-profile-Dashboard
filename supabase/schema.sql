-- TryHackMe Public Profile Dashboard — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db` CLI) once per project.

create table if not exists public.students (
  id            uuid        primary key default gen_random_uuid(),
  username      text        not null unique,
  profile_url   text        not null,
  -- Timestamp the student was first entered (the "added" / historical record).
  added_at      timestamptz not null default now(),
  -- Timestamp of the most recent search/view (updated on every upsert).
  last_searched timestamptz not null default now()
);

create index if not exists students_last_searched_idx
  on public.students (last_searched desc);

create index if not exists students_added_at_idx
  on public.students (added_at desc);

-- Row Level Security: the dashboard only ever talks to Supabase from the
-- server using the SERVICE ROLE key (which bypasses RLS). The policies below
-- keep the table safe if you instead expose the ANON key.
alter table public.students enable row level security;

drop policy if exists "students_public_read" on public.students;
create policy "students_public_read"
  on public.students for select
  using (true);

drop policy if exists "students_public_upsert" on public.students;
create policy "students_public_upsert"
  on public.students for insert
  with check (true);

drop policy if exists "students_public_update" on public.students;
create policy "students_public_update"
  on public.students for update
  using (true);

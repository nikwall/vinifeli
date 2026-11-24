-- Adventskette der App vinifeli: Geschenke (fz_advent_dinge) und ihre Päckchen (fz_advent_kette).
-- Einmal im SQL-Editor des Supabase-Projekts ausführen. Fasst nur die eigenen fz_advent-Tabellen an
-- und lässt sich gefahrlos wiederholen.
-- Wie bei Likes und Kommentaren: Jede Person mit dem Link kann lesen und schreiben.

create table if not exists public.fz_advent_dinge (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  anzahl integer check (anzahl between 1 and 999), -- leer = beliebig auf Päckchen verteilbar
  erstellt timestamptz not null default now()
);

create table if not exists public.fz_advent_kette (
  id uuid primary key default gen_random_uuid(),
  tag smallint not null check (tag between 1 and 24),
  kind text not null check (kind in ('lilly', 'felice')),
  ding uuid not null references public.fz_advent_dinge (id) on delete cascade,
  notiz text check (char_length(notiz) <= 80),
  erstellt timestamptz not null default now()
);

alter table public.fz_advent_dinge enable row level security;
alter table public.fz_advent_kette enable row level security;

do $$
declare t text; a text;
begin
  foreach t in array array['fz_advent_dinge', 'fz_advent_kette'] loop
    foreach a in array array['select', 'insert', 'update', 'delete'] loop
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ' ' || a) then
        if a = 'insert' then
          execute format('create policy %I on public.%I for insert to anon with check (true)', t || ' ' || a, t);
        elsif a = 'update' then
          execute format('create policy %I on public.%I for update to anon using (true) with check (true)', t || ' ' || a, t);
        else
          execute format('create policy %I on public.%I for %s to anon using (true)', t || ' ' || a, t, a);
        end if;
      end if;
    end loop;
  end loop;
end $$;

grant select, insert, update, delete on public.fz_advent_dinge to anon;
grant select, insert, update, delete on public.fz_advent_kette to anon;

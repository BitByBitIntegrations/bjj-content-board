create table if not exists cards (
  id          uuid        primary key default gen_random_uuid(),
  label       text        not null,
  description text,
  link        text,
  tag         text        not null check (tag in ('brainrot','training','comp','highlight')),
  stage       text        not null default 'imagined' check (stage in ('imagined','filmed','edited','shared')),
  position    int         not null default 0,
  created_at  timestamptz not null default now()
);

-- Allow realtime on this table
alter publication supabase_realtime add table cards;

-- Permissive RLS for private single-user board (tighten if shared)
alter table cards enable row level security;

create policy "allow all" on cards for all using (true) with check (true);

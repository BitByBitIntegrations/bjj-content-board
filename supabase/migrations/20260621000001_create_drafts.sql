create table if not exists drafts (
  id          uuid        primary key default gen_random_uuid(),
  chat_id     bigint      not null,
  label       text        not null,
  description text,
  link        text,
  tag         text        not null,
  created_at  timestamptz not null default now()
);

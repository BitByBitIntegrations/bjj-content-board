-- Add link2 and link3 columns to cards
alter table cards add column if not exists link2 text;
alter table cards add column if not exists link3 text;

-- Add link2 and link3 to drafts too
alter table drafts add column if not exists link2 text;
alter table drafts add column if not exists link3 text;

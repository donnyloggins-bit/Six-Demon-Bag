-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)
-- for the Boyds Alterations app.

create table if not exists alterations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  hanger_tag_number text not null,
  destination_store text not null check (destination_store in ('Chestnut Street', 'Wayne')),
  salesperson text,
  fitter text,
  date_sold date,
  date_due date,
  item_1 text,
  item_2 text,
  item_3 text,
  item_4 text,
  completed boolean not null default false,
  completed_at timestamptz,
  picked_up boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to re-run: adds the new columns if this table was created before they existed.
alter table alterations add column if not exists salesperson text;
alter table alterations add column if not exists fitter text;
alter table alterations add column if not exists completed boolean not null default false;
alter table alterations add column if not exists completed_at timestamptz;

create index if not exists alterations_date_due_idx on alterations (date_due);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists alterations_set_updated_at on alterations;
create trigger alterations_set_updated_at
  before update on alterations
  for each row
  execute function set_updated_at();

create or replace function set_completed_at()
returns trigger as $$
begin
  if new.completed and not old.completed then
    new.completed_at = now();
  elsif not new.completed then
    new.completed_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists alterations_set_completed_at on alterations;
create trigger alterations_set_completed_at
  before update on alterations
  for each row
  execute function set_completed_at();

-- This is an internal shop tool with no login: every staff member uses the
-- same public anon key, so RLS is opened up fully rather than per-user.
-- Anyone with the project URL + anon key can read/write this table.
alter table alterations enable row level security;

drop policy if exists "Allow all access" on alterations;
create policy "Allow all access" on alterations
  for all
  using (true)
  with check (true);

-- Enable realtime so every staff member's changes show up live for everyone else.
alter publication supabase_realtime add table alterations;

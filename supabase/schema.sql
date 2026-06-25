-- ============================================================
--  Camp Store Register — Supabase schema
--  Run this FIRST, then functions.sql, then (optional) seed.sql
-- ============================================================

-- Extensions ------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ============================================================
--  PRODUCTS  (shared across all weeks)
-- ============================================================
create table products (
  id              uuid primary key default gen_random_uuid(),
  name            text    not null,
  category        text    not null check (category in ('merch','food')),
  price           numeric(10,2) not null check (price >= 0),
  track_quantity  boolean not null default true,   -- false for food/snacks
  quantity        integer,                          -- null when not tracked
  active          boolean not null default true,    -- archived = false
  image_url       text,                              -- product photo (Supabase Storage public URL)
  sizes           jsonb,                             -- [{id,label,quantity}] when sized; null = no sizes
  square_catalog_id text,                            -- optional Square catalog link
  created_at      timestamptz not null default now()
);
create index on products (category) where active;

-- ============================================================
--  WEEKS  (each = a round of campers)
-- ============================================================
create table weeks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('kids','family')),
  start_date  date,
  end_date    date,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
--  TABS  (family tabs; settled at end of week)
-- ============================================================
create table tabs (
  id          uuid primary key default gen_random_uuid(),
  week_id     uuid not null references weeks(id) on delete cascade,
  name        text not null,
  balance     numeric(10,2) not null default 0,  -- amount currently owed
  settled     boolean not null default false,
  settled_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on tabs (week_id);

-- ============================================================
--  CAMPERS
-- ============================================================
create table campers (
  id                 uuid primary key default gen_random_uuid(),
  week_id            uuid not null references weeks(id) on delete cascade,
  tab_id             uuid references tabs(id) on delete set null,
  first_name         text not null,
  last_name          text not null,
  age                integer,
  cabin              text,
  notes              text,                              -- allergies / notes
  allow_purchase     boolean not null default true,
  allow_over_balance boolean not null default false,
  balance            numeric(10,2) not null default 0,  -- prepaid balance
  cashed_out         boolean not null default false,
  cashed_out_at      timestamptz,
  created_at         timestamptz not null default now()
);
create index on campers (week_id);
create index on campers (tab_id);

-- ============================================================
--  TRANSACTIONS  (the immutable ledger)
--  kind: sale (+), return (-), deposit (balance load), cashout (payout)
--  items is a JSON snapshot so price edits never alter history:
--    [{ "product_id": "...", "name": "Camp T-Shirt", "category": "merch",
--       "qty": 2, "unit_price": 18.00, "line_total": 36.00 }, ...]
-- ============================================================
create table transactions (
  id                uuid primary key default gen_random_uuid(),
  week_id           uuid not null references weeks(id) on delete cascade,
  kind              text not null check (kind in ('sale','return','deposit','cashout')),
  payer_type        text not null check (payer_type in ('camper','tab')),
  camper_id         uuid references campers(id) on delete set null,
  tab_id            uuid references tabs(id) on delete set null,
  items             jsonb not null default '[]',
  total             numeric(10,2) not null,            -- negative for returns
  method            text not null check (method in ('balance','cash','card','tab','deposit')),
  ref_of            uuid references transactions(id),  -- return -> original sale
  returned          boolean not null default false,    -- set true on the original sale
  square_payment_id text,                               -- Square charge id when method=card
  created_at        timestamptz not null default now()
);
create index on transactions (week_id);
create index on transactions (camper_id);
create index on transactions (tab_id);
create index on transactions (kind);
-- a transaction always points at exactly one payer
alter table transactions add constraint payer_present check (
  (payer_type = 'camper' and camper_id is not null) or
  (payer_type = 'tab'    and tab_id    is not null)
);

-- ============================================================
--  SETTINGS  (single row)
-- ============================================================
create table settings (
  id         boolean primary key default true check (id),  -- only one row
  camp_name  text not null default 'Camp Store',
  low_stock  integer not null default 10,
  currency   text not null default 'USD'
);
insert into settings (id) values (true) on conflict do nothing;

-- ============================================================
--  ROW LEVEL SECURITY
--  Single-tenant camp: any authenticated staff user has full access.
--  (For per-staff roles, see INTEGRATION.md.)
-- ============================================================
alter table products     enable row level security;
alter table weeks        enable row level security;
alter table tabs         enable row level security;
alter table campers      enable row level security;
alter table transactions enable row level security;
alter table settings     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['products','weeks','tabs','campers','transactions','settings']
  loop
    execute format(
      'create policy "staff full access" on %I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
--  STORAGE  — product photos uploaded from the Stock Station
--  Public bucket so <img src> works; only authenticated staff write.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "staff upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "staff update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

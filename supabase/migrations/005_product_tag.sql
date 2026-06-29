-- ============================================================
--  Migration 005 — product tag (free-text grouping)
--  Adds a lowercase tag used to group products into sections on
--  the register. Idempotent; safe to run anytime.
-- ============================================================
alter table products add column if not exists tag text;

-- normalize any existing values to lowercase/trimmed (no-op on fresh data)
update products set tag = nullif(lower(trim(tag)), '') where tag is not null;

-- optional: speeds up grouping/filtering if the catalog grows large
create index if not exists products_tag_idx on products (tag);

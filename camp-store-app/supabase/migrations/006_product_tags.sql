-- ============================================================
--  Migration 006 — multi-tag products + register tag order
--  Products can belong to several tags; settings stores the
--  staff-defined tag display order for the register.
--  Idempotent; safe to run anytime.
-- ============================================================

-- products.tags: array of lowercase tags (replaces the single `tag`)
alter table products add column if not exists tags text[] default '{}';

-- backfill from the old single tag (migration 005), if present
update products
   set tags = array[tag]
 where tag is not null
   and (tags is null or tags = '{}');

-- settings.tag_order: ordered list of tags shown first on the register
alter table settings add column if not exists tag_order text[] default '{}';

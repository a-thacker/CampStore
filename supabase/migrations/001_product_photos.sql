-- ============================================================
--  Migration 001 — product photos (Stock Station + register)
--  Safe to run on an existing database. Idempotent.
-- ============================================================

-- 1) photo URL column on products
alter table products add column if not exists image_url text;

-- 2) public storage bucket to hold the uploaded photos
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- 3) storage policies: anyone can view, only signed-in staff can upload/replace
create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "staff upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "staff update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

-- 4) (optional) set the camp name if you haven't already
update settings set camp_name = 'Camp Lawroweld'
where camp_name in ('Camp Store', 'Pinewood Camp');

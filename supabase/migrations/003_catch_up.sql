-- ============================================================
--  Migration 003 — consolidated catch-up to current schema
--  Fully IDEMPOTENT: safe to run on any prior deployment, any
--  number of times. Brings the database up to the version the
--  app currently expects. No security changes are required for
--  the hardened Square functions — those only read existing rows.
-- ============================================================

-- ------------------------------------------------------------
-- 1) products: columns the current app uses
-- ------------------------------------------------------------
alter table products add column if not exists image_url         text;
alter table products add column if not exists sizes             jsonb;
alter table products add column if not exists square_catalog_id text;

-- ------------------------------------------------------------
-- 2) storage bucket + policies for product photos
--    (drop-then-create so re-running never errors)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read product images"   on storage.objects;
drop policy if exists "staff upload product images"   on storage.objects;
drop policy if exists "staff update product images"   on storage.objects;

create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "staff upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "staff update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

-- ------------------------------------------------------------
-- 3) size-aware stock helper + sale/return functions
--    (create or replace = idempotent)
-- ------------------------------------------------------------
create or replace function _adjust_product_stock(
  p_product_id uuid,
  p_size_id    text,
  p_qty_delta  int
) returns void
language plpgsql security definer as $$
declare
  v_prod  products%rowtype;
  v_sizes jsonb;
  v_total int;
begin
  select * into v_prod from products where id = p_product_id for update;
  if v_prod.id is null or not coalesce(v_prod.track_quantity, false) then
    return;
  end if;

  if v_prod.sizes is not null
     and jsonb_array_length(v_prod.sizes) > 0
     and p_size_id is not null then
    select jsonb_agg(
             case when (s->>'id') = p_size_id
               then jsonb_set(s, '{quantity}',
                      to_jsonb(greatest(0, (s->>'quantity')::int + p_qty_delta)))
               else s end)
      into v_sizes
      from jsonb_array_elements(v_prod.sizes) s;
    select coalesce(sum((s->>'quantity')::int), 0)
      into v_total from jsonb_array_elements(v_sizes) s;
    update products set sizes = v_sizes, quantity = v_total where id = p_product_id;
  else
    update products
       set quantity = greatest(0, coalesce(quantity, 0) + p_qty_delta)
     where id = p_product_id;
  end if;
end $$;

create or replace function record_sale(
  p_week_id    uuid,
  p_payer_type text,
  p_payer_id   uuid,
  p_items      jsonb,
  p_method     text,
  p_square_payment_id text default null
) returns transactions
language plpgsql security definer as $$
declare
  v_total   numeric(10,2);
  v_item    jsonb;
  v_camper  campers%rowtype;
  v_txn     transactions%rowtype;
begin
  select coalesce(sum((i->>'line_total')::numeric), 0) into v_total
  from jsonb_array_elements(p_items) i;

  if p_payer_type = 'camper' then
    select * into v_camper from campers where id = p_payer_id for update;
    if v_camper.cashed_out then
      raise exception 'Account is cashed out';
    end if;
    if not v_camper.allow_purchase then
      raise exception 'Purchases are paused for this camper';
    end if;
    if p_method = 'balance'
       and (v_camper.balance - v_total) < 0
       and not v_camper.allow_over_balance then
      raise exception 'Insufficient balance and over-balance not allowed';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    perform _adjust_product_stock(
      (v_item->>'product_id')::uuid,
      v_item->>'size_id',
      -((v_item->>'qty')::int));
  end loop;

  insert into transactions (week_id, kind, payer_type, camper_id, tab_id,
                            items, total, method, square_payment_id)
  values (p_week_id, 'sale', p_payer_type,
          case when p_payer_type = 'camper' then p_payer_id end,
          case when p_payer_type = 'tab'    then p_payer_id end,
          p_items, v_total, p_method, p_square_payment_id)
  returning * into v_txn;

  if p_payer_type = 'camper' and p_method = 'balance' then
    update campers set balance = balance - v_total where id = p_payer_id;
  elsif p_payer_type = 'tab' and p_method = 'tab' then
    update tabs set balance = balance + v_total where id = p_payer_id;
  end if;

  return v_txn;
end $$;

create or replace function process_return(p_txn_id uuid)
returns transactions
language plpgsql security definer as $$
declare
  v_orig  transactions%rowtype;
  v_item  jsonb;
  v_ret   transactions%rowtype;
  v_items jsonb;
begin
  select * into v_orig from transactions where id = p_txn_id for update;
  if v_orig.id is null then raise exception 'Transaction not found'; end if;
  if v_orig.kind <> 'sale' then raise exception 'Only sales can be returned'; end if;
  if v_orig.returned then raise exception 'Already returned'; end if;

  update transactions set returned = true where id = p_txn_id;

  for v_item in select * from jsonb_array_elements(v_orig.items) loop
    perform _adjust_product_stock(
      (v_item->>'product_id')::uuid,
      v_item->>'size_id',
      (v_item->>'qty')::int);
  end loop;

  select jsonb_agg(
           jsonb_set(
             jsonb_set(i, '{qty}', to_jsonb(-((i->>'qty')::int))),
             '{line_total}', to_jsonb(-((i->>'line_total')::numeric)))
         ) into v_items
  from jsonb_array_elements(v_orig.items) i;

  insert into transactions (week_id, kind, payer_type, camper_id, tab_id,
                            items, total, method, ref_of)
  values (v_orig.week_id, 'return', v_orig.payer_type, v_orig.camper_id, v_orig.tab_id,
          coalesce(v_items, '[]'), -v_orig.total, v_orig.method, v_orig.id)
  returning * into v_ret;

  if v_orig.method = 'balance' and v_orig.camper_id is not null then
    update campers set balance = balance + v_orig.total where id = v_orig.camper_id;
  elsif v_orig.method = 'tab' and v_orig.tab_id is not null then
    update tabs set balance = balance - v_orig.total where id = v_orig.tab_id;
  end if;

  return v_ret;
end $$;

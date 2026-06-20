-- ============================================================
--  Camp Store Register — transactional RPC functions
--  Run AFTER schema.sql. Call these from the front-end via
--  supabase.rpc('record_sale', { ... }) etc. Each runs in a
--  single transaction so stock + balances never drift.
-- ============================================================

-- ------------------------------------------------------------
--  record_sale
--  Records a sale, decrements merch stock, and adjusts the
--  payer's balance/tab. Enforces purchase + over-balance rules.
--
--  p_items shape (jsonb array):
--    [{ "product_id":"uuid", "name":"...", "category":"merch|food",
--       "qty":2, "unit_price":18.00, "line_total":36.00 }, ...]
-- ------------------------------------------------------------
create or replace function record_sale(
  p_week_id    uuid,
  p_payer_type text,           -- 'camper' | 'tab'
  p_payer_id   uuid,
  p_items      jsonb,
  p_method     text,           -- 'balance' | 'cash' | 'card' | 'tab'
  p_square_payment_id text default null
) returns transactions
language plpgsql security definer as $$
declare
  v_total   numeric(10,2);
  v_item    jsonb;
  v_camper  campers%rowtype;
  v_txn     transactions%rowtype;
begin
  -- total from the snapshot lines
  select coalesce(sum((i->>'line_total')::numeric), 0) into v_total
  from jsonb_array_elements(p_items) i;

  -- validate camper rules
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

  -- decrement merch stock (food has track_quantity = false -> skipped)
  for v_item in select * from jsonb_array_elements(p_items) loop
    update products
       set quantity = greatest(0, quantity - (v_item->>'qty')::int)
     where id = (v_item->>'product_id')::uuid
       and track_quantity;
  end loop;

  -- write the ledger row
  insert into transactions (week_id, kind, payer_type, camper_id, tab_id,
                            items, total, method, square_payment_id)
  values (p_week_id, 'sale', p_payer_type,
          case when p_payer_type = 'camper' then p_payer_id end,
          case when p_payer_type = 'tab'    then p_payer_id end,
          p_items, v_total, p_method, p_square_payment_id)
  returning * into v_txn;

  -- move money
  if p_payer_type = 'camper' and p_method = 'balance' then
    update campers set balance = balance - v_total where id = p_payer_id;
  elsif p_payer_type = 'tab' and p_method = 'tab' then
    update tabs set balance = balance + v_total where id = p_payer_id;
  end if;

  return v_txn;
end $$;

-- ------------------------------------------------------------
--  process_return
--  Reverses a sale: flags the original, restocks merch, refunds
--  to the original method, and writes a negative 'return' row.
-- ------------------------------------------------------------
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

  -- restock merch
  for v_item in select * from jsonb_array_elements(v_orig.items) loop
    update products
       set quantity = quantity + (v_item->>'qty')::int
     where id = (v_item->>'product_id')::uuid
       and track_quantity;
  end loop;

  -- negate the line snapshot for the return record
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

  -- refund to original method
  if v_orig.method = 'balance' and v_orig.camper_id is not null then
    update campers set balance = balance + v_orig.total where id = v_orig.camper_id;
  elsif v_orig.method = 'tab' and v_orig.tab_id is not null then
    update tabs set balance = balance - v_orig.total where id = v_orig.tab_id;
  end if;
  -- cash/card refunds are handed back at the register (and via Square refund API for cards)

  return v_ret;
end $$;

-- ------------------------------------------------------------
--  deposit_balance  (load prepaid funds; negative = correction)
-- ------------------------------------------------------------
create or replace function deposit_balance(p_camper_id uuid, p_amount numeric)
returns transactions
language plpgsql security definer as $$
declare v_txn transactions%rowtype; v_week uuid;
begin
  select week_id into v_week from campers where id = p_camper_id;
  update campers set balance = balance + p_amount where id = p_camper_id;
  insert into transactions (week_id, kind, payer_type, camper_id, items, total, method)
  values (v_week, 'deposit', 'camper', p_camper_id, '[]', p_amount, 'deposit')
  returning * into v_txn;
  return v_txn;
end $$;

-- ------------------------------------------------------------
--  cash_out_camper  (return remaining balance, close account)
-- ------------------------------------------------------------
create or replace function cash_out_camper(p_camper_id uuid)
returns transactions
language plpgsql security definer as $$
declare v_bal numeric(10,2); v_week uuid; v_txn transactions%rowtype;
begin
  select balance, week_id into v_bal, v_week from campers where id = p_camper_id for update;
  insert into transactions (week_id, kind, payer_type, camper_id, items, total, method)
  values (v_week, 'cashout', 'camper', p_camper_id, '[]', v_bal, 'cash')
  returning * into v_txn;
  update campers
     set balance = 0, cashed_out = true, cashed_out_at = now(), allow_purchase = false
   where id = p_camper_id;
  return v_txn;
end $$;

-- ------------------------------------------------------------
--  settle_tab  (mark a family tab paid)
-- ------------------------------------------------------------
create or replace function settle_tab(p_tab_id uuid)
returns tabs
language plpgsql security definer as $$
declare v_tab tabs%rowtype;
begin
  update tabs set settled = true, settled_at = now(), balance = 0
   where id = p_tab_id returning * into v_tab;
  return v_tab;
end $$;

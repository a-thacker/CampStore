-- ============================================================
-- 008_family_tabs.sql
-- Family tabs get a settlement mode + shared over-balance flag,
-- and transactions can note which family member was at the
-- register. All additive / idempotent — safe to run any time.
-- ============================================================

alter table tabs add column if not exists mode text not null default 'settle';
alter table tabs add column if not exists allow_over_balance boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tabs_mode_check') then
    alter table tabs add constraint tabs_mode_check check (mode in ('settle', 'prepaid'));
  end if;
end $$;

alter table transactions add column if not exists member_id uuid references campers(id) on delete set null;

-- ------------------------------------------------------------
--  record_sale — now mode-aware for family tabs:
--    'settle'  : purchases always post to the tab (settled later)
--    'prepaid' : purchases deduct from the family's prepaid
--                balance, honoring tabs.allow_over_balance
--  Also accepts an optional p_member_id (who's at the register)
--  and enforces that member's allow_purchase flag.
-- ------------------------------------------------------------
create or replace function record_sale(
  p_week_id    uuid,
  p_payer_type text,           -- 'camper' | 'tab'
  p_payer_id   uuid,
  p_items      jsonb,
  p_method     text,           -- 'balance' | 'cash' | 'card' | 'tab'
  p_square_payment_id text default null,
  p_member_id  uuid default null
) returns transactions
language plpgsql security definer as $$
declare
  v_total   numeric(10,2);
  v_item    jsonb;
  v_camper  campers%rowtype;
  v_tab     tabs%rowtype;
  v_member  campers%rowtype;
  v_txn     transactions%rowtype;
begin
  select coalesce(sum((i->>'line_total')::numeric), 0) into v_total
  from jsonb_array_elements(p_items) i;

  if p_payer_type = 'camper' then
    select * into v_camper from campers where id = p_payer_id for update;
    if v_camper.cashed_out then raise exception 'Account is cashed out'; end if;
    if not v_camper.allow_purchase then raise exception 'Purchases are paused for this camper'; end if;
    if p_method = 'balance'
       and (v_camper.balance - v_total) < 0
       and not v_camper.allow_over_balance then
      raise exception 'Insufficient balance and over-balance not allowed';
    end if;
  elsif p_payer_type = 'tab' then
    select * into v_tab from tabs where id = p_payer_id for update;
    if p_member_id is not null then
      select * into v_member from campers where id = p_member_id;
      if v_member.id is not null and not v_member.allow_purchase then
        raise exception 'Purchases are paused for that family member';
      end if;
    end if;
    if v_tab.mode = 'prepaid' and p_method = 'tab'
       and (v_tab.balance - v_total) < 0
       and not v_tab.allow_over_balance then
      raise exception 'Insufficient family balance and over-balance not allowed';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    perform _adjust_product_stock(
      (v_item->>'product_id')::uuid,
      v_item->>'size_id',
      -((v_item->>'qty')::int));
  end loop;

  insert into transactions (week_id, kind, payer_type, camper_id, tab_id,
                            items, total, method, square_payment_id, member_id)
  values (p_week_id, 'sale', p_payer_type,
          case when p_payer_type = 'camper' then p_payer_id end,
          case when p_payer_type = 'tab'    then p_payer_id end,
          p_items, v_total, p_method, p_square_payment_id,
          case when p_payer_type = 'tab' then p_member_id end)
  returning * into v_txn;

  if p_payer_type = 'camper' and p_method = 'balance' then
    update campers set balance = balance - v_total where id = p_payer_id;
  elsif p_payer_type = 'tab' and p_method = 'tab' then
    update tabs set balance = (case when v_tab.mode = 'prepaid' then balance - v_total else balance + v_total end)
     where id = p_payer_id;
  end if;

  return v_txn;
end $$;

-- ------------------------------------------------------------
--  process_return — mode-aware refund back to a family tab
-- ------------------------------------------------------------
create or replace function process_return(p_txn_id uuid)
returns transactions
language plpgsql security definer as $$
declare
  v_orig  transactions%rowtype;
  v_item  jsonb;
  v_ret   transactions%rowtype;
  v_items jsonb;
  v_tab   tabs%rowtype;
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
                            items, total, method, ref_of, member_id)
  values (v_orig.week_id, 'return', v_orig.payer_type, v_orig.camper_id, v_orig.tab_id,
          coalesce(v_items, '[]'), -v_orig.total, v_orig.method, v_orig.id, v_orig.member_id)
  returning * into v_ret;

  if v_orig.method = 'balance' and v_orig.camper_id is not null then
    update campers set balance = balance + v_orig.total where id = v_orig.camper_id;
  elsif v_orig.method = 'tab' and v_orig.tab_id is not null then
    select * into v_tab from tabs where id = v_orig.tab_id;
    update tabs set balance = (case when v_tab.mode = 'prepaid' then balance + v_orig.total else balance - v_orig.total end)
     where id = v_orig.tab_id;
  end if;

  return v_ret;
end $$;

-- ------------------------------------------------------------
--  load_tab_balance — add prepaid funds to a family tab
--  (negative amount = correction), mirrors deposit_balance
-- ------------------------------------------------------------
create or replace function load_tab_balance(p_tab_id uuid, p_amount numeric)
returns transactions
language plpgsql security definer as $$
declare v_txn transactions%rowtype; v_week uuid;
begin
  select week_id into v_week from tabs where id = p_tab_id;
  update tabs set balance = balance + p_amount where id = p_tab_id;
  insert into transactions (week_id, kind, payer_type, tab_id, items, total, method)
  values (v_week, 'deposit', 'tab', p_tab_id, '[]', p_amount, 'deposit')
  returning * into v_txn;
  return v_txn;
end $$;

-- ------------------------------------------------------------
--  settle_tab — close out a family tab. Settle-mode: marks the
--  owed balance paid. Prepaid-mode: refunds/collects whatever
--  remains. Either way it's zeroed, marked settled, and logged.
-- ------------------------------------------------------------
create or replace function settle_tab(p_tab_id uuid)
returns tabs
language plpgsql security definer as $$
declare v_tab tabs%rowtype; v_week uuid;
begin
  select * into v_tab from tabs where id = p_tab_id for update;
  if v_tab.balance <> 0 then
    insert into transactions (week_id, kind, payer_type, tab_id, items, total, method)
    values (v_tab.week_id, 'cashout', 'tab', p_tab_id, '[]', v_tab.balance, 'cash');
  end if;
  update tabs set settled = true, settled_at = now(), balance = 0
   where id = p_tab_id returning * into v_tab;
  return v_tab;
end $$;

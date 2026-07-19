-- ============================================================
-- 009_partial_returns_walkup.sql
--   1. Walk-up (no-account) sales: cash/card transactions not
--      tied to a camper or family, so inventory stays accurate.
--   2. Item-level (partial) returns: send back some units of a
--      sale instead of the whole ticket.
-- All additive / idempotent — safe to run any time.
-- ============================================================

-- ---- 1. allow payer_type = 'walkup' (no camper, no tab) ----
alter table transactions drop constraint if exists transactions_payer_type_check;
alter table transactions add constraint transactions_payer_type_check
  check (payer_type in ('camper', 'tab', 'walkup'));

alter table transactions drop constraint if exists payer_present;
alter table transactions add constraint payer_present check (
  (payer_type = 'camper' and camper_id is not null) or
  (payer_type = 'tab'    and tab_id    is not null) or
  (payer_type = 'walkup' and camper_id is null and tab_id is null)
);
-- record_sale (from 008) already leaves camper_id/tab_id null and moves no
-- money for any payer_type other than 'camper'/'tab', so walk-up sales just
-- work once the constraints above permit them.

-- ---- 2. item-level partial returns ----
-- p_selections shape (jsonb array): [{ "index": 0, "qty": 1 }, ...]
--   index = position in the original sale's items[]; qty = units to return.
-- Restocks only what's returned, refunds proportionally to the original
-- method, records returned_qty back on each original line, and flags the
-- sale returned=true only once every line is exhausted.
create or replace function process_partial_return(p_txn_id uuid, p_selections jsonb)
returns transactions
language plpgsql security definer as $$
declare
  v_orig      transactions%rowtype;
  v_sel       jsonb;
  v_idx       int;
  v_qty       int;
  v_line      jsonb;
  v_items     jsonb;
  v_ret_lines jsonb := '[]'::jsonb;
  v_refund    numeric(10,2) := 0;
  v_ret       transactions%rowtype;
  v_all_done  boolean;
  v_tab       tabs%rowtype;
  v_bought    int;
  v_already   int;
  v_can       int;
  v_rq        int;
  v_unit      numeric(10,2);
begin
  select * into v_orig from transactions where id = p_txn_id for update;
  if v_orig.id is null then raise exception 'Transaction not found'; end if;
  if v_orig.kind <> 'sale' then raise exception 'Only sales can be returned'; end if;
  if v_orig.returned then raise exception 'Already fully returned'; end if;

  v_items := v_orig.items;

  for v_sel in select * from jsonb_array_elements(p_selections) loop
    v_idx := (v_sel->>'index')::int;
    v_qty := (v_sel->>'qty')::int;
    v_line := v_items->v_idx;
    if v_line is null or v_qty <= 0 then continue; end if;
    v_bought  := (v_line->>'qty')::int;
    v_already := coalesce((v_line->>'returned_qty')::int, 0);
    v_can     := v_bought - v_already;
    v_rq      := least(v_qty, v_can);
    if v_rq <= 0 then continue; end if;
    v_unit := (v_line->>'unit_price')::numeric;

    perform _adjust_product_stock((v_line->>'product_id')::uuid, v_line->>'size_id', v_rq);

    v_items := jsonb_set(v_items, array[v_idx::text, 'returned_qty'], to_jsonb(v_already + v_rq));

    v_ret_lines := v_ret_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_line->'product_id',
      'name',       v_line->'name',
      'category',   v_line->'category',
      'size_id',    v_line->'size_id',
      'size_label', v_line->'size_label',
      'unit_price', v_line->'unit_price',
      'qty',        -v_rq,
      'line_total', -round(v_unit * v_rq, 2)
    ));
    v_refund := v_refund + round(v_unit * v_rq, 2);
  end loop;

  if jsonb_array_length(v_ret_lines) = 0 then raise exception 'Nothing to return'; end if;

  select bool_and(coalesce((l->>'returned_qty')::int, 0) >= (l->>'qty')::int)
    into v_all_done from jsonb_array_elements(v_items) l;

  update transactions set items = v_items, returned = v_all_done where id = p_txn_id;

  insert into transactions (week_id, kind, payer_type, camper_id, tab_id,
                            items, total, method, ref_of, member_id)
  values (v_orig.week_id, 'return', v_orig.payer_type, v_orig.camper_id, v_orig.tab_id,
          v_ret_lines, -v_refund, v_orig.method, v_orig.id, v_orig.member_id)
  returning * into v_ret;

  if v_orig.method = 'balance' and v_orig.camper_id is not null then
    update campers set balance = balance + v_refund where id = v_orig.camper_id;
  elsif v_orig.method = 'tab' and v_orig.tab_id is not null then
    select * into v_tab from tabs where id = v_orig.tab_id;
    update tabs set balance = (case when v_tab.mode = 'prepaid' then balance + v_refund else balance - v_refund end)
     where id = v_orig.tab_id;
  end if;

  return v_ret;
end $$;

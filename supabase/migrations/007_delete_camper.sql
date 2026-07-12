-- ============================================================
--  Migration 007 — hard-delete a camper and all their records
--  Removes every transaction belonging to the camper (deposits,
--  sales, returns, cash-outs) and then the camper row, atomically.
--  Without this, deleting a camper only nulled camper_id and left
--  their history orphaned in the ledger.
--  Idempotent; safe to run anytime.
-- ============================================================
create or replace function delete_camper(p_camper_id uuid)
returns void
language plpgsql security definer as $$
begin
  -- wipe the camper's own ledger entries (tab purchases are not touched)
  delete from transactions
   where payer_type = 'camper' and camper_id = p_camper_id;
  -- remove the camper
  delete from campers where id = p_camper_id;
end $$;

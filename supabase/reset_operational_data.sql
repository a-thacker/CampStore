-- ============================================================
--  Reset operational data — wipe weeks, campers, tabs, transactions
--  KEEPS products (catalog is correct as loaded).
--  Run in the Supabase SQL editor before entering real data.
--  Wrapped in a transaction; deletes in FK-safe order.
-- ============================================================
begin;

delete from transactions;   -- references weeks / campers / tabs
delete from campers;        -- references weeks / tabs
delete from tabs;           -- references weeks
delete from weeks;

commit;

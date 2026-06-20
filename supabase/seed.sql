-- ============================================================
--  Optional sample data — run AFTER schema.sql + functions.sql
--  Mirrors a slice of the prototype seed so you can click around.
-- ============================================================

-- Settings
update settings set camp_name = 'Pinewood Camp', low_stock = 10 where id = true;

-- A few products (merch tracks quantity, food does not) ------
insert into products (name, category, price, track_quantity, quantity) values
  ('Camp T-Shirt',        'merch', 18, true, 64),
  ('Crewneck Sweatshirt', 'merch', 38, true, 30),
  ('Sweatpants',          'merch', 36, true, 22),
  ('Tote Bag',            'merch', 16, true, 28),
  ('Water Bottle',        'merch', 20, true, 41),
  ('Sticker Pack',        'merch',  6, true, 90),
  ('Carabiner',           'merch',  4, true, 70);

insert into products (name, category, price, track_quantity, quantity) values
  ('Candy Bar',           'food', 2.0, false, null),
  ('Slushie',             'food', 3.0, false, null),
  ('Soda',                'food', 2.0, false, null),
  ('Ice Cream Sandwich',  'food', 3.0, false, null),
  ('Bottled Water',       'food', 1.0, false, null);

-- Weeks ------------------------------------------------------
insert into weeks (name, type, start_date, end_date, sort_order) values
  ('Junior Camp',  'kids',   '2026-06-08', '2026-06-12', 1),
  ('Trailblazers', 'kids',   '2026-06-15', '2026-06-19', 2),
  ('Family Camp',  'family', '2026-06-22', '2026-06-26', 3);

-- Campers for week 1 ----------------------------------------
insert into campers (week_id, first_name, last_name, age, cabin, balance, allow_over_balance, notes)
select id, 'Mason', 'Reyes', 10, 'Cedar', 24.50, false, '' from weeks where name = 'Junior Camp';
insert into campers (week_id, first_name, last_name, age, cabin, balance, allow_over_balance, notes)
select id, 'Sofia', 'Martinez', 10, 'Willow', 38.00, false, 'Peanut allergy' from weeks where name = 'Junior Camp';
insert into campers (week_id, first_name, last_name, age, cabin, balance, allow_purchase, notes)
select id, 'Liam', 'Nguyen', 11, 'Cedar', 0, false, 'Parent set spending pause' from weeks where name = 'Junior Camp';

-- A family tab for week 3 -----------------------------------
insert into tabs (week_id, name)
select id, 'The Johnson Family' from weeks where name = 'Family Camp';

insert into campers (week_id, tab_id, first_name, last_name, age, cabin, allow_over_balance)
select w.id, t.id, 'Robert', 'Johnson', 41, 'Lakeside 2', true
from weeks w join tabs t on t.name = 'The Johnson Family' where w.name = 'Family Camp';
insert into campers (week_id, tab_id, first_name, last_name, age, cabin)
select w.id, t.id, 'Tyler', 'Johnson', 8, 'Lakeside 2'
from weeks w join tabs t on t.name = 'The Johnson Family' where w.name = 'Family Camp';

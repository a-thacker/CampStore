-- ============================================================
--  Data load — replace merchandise with Camp Store 2026 inventory
--  Source: "Camp Store 2026 - Inventory.csv"  (quantities = Remaining)
--  53 products  ·  31 sized  ·  22 count-only  ·  1202 units total
--  Run in the Supabase SQL editor. Wrapped in a transaction.
-- ============================================================
begin;

-- Wipe existing catalog. Transactions keep their own JSON snapshots,
-- so historical sales are unaffected by removing product rows.
delete from products;

insert into products (name, category, price, track_quantity, quantity, sizes) values
  ('Grey/Navy Lake Crew', 'merch', 40.00, true, 56, '[{"id":"ffd5cb5a-59c3-4f6e-bb63-80eed60abb30","label":"XS","quantity":10},{"id":"2d4fadbb-3211-437a-b71e-3afd265025b1","label":"S","quantity":9},{"id":"0c294e6e-99bd-42e4-aad5-8f20d29870dc","label":"M","quantity":10},{"id":"d29dbca0-b3c5-4720-bb10-82f3059423cb","label":"L","quantity":7},{"id":"e8ffc8d3-2b3e-485a-84dc-9d88e7f67923","label":"XL","quantity":10},{"id":"3f29e306-a4b0-4d13-bf03-35938d296eef","label":"2XL","quantity":5},{"id":"df4e4f7b-211c-4ca6-adc1-e91b4cb1f716","label":"3XL","quantity":5}]'::jsonb),
  ('Blue/White Lake Crew', 'merch', 40.00, true, 49, '[{"id":"63058e63-c9fc-4bd9-9f91-d087bc46fa53","label":"S","quantity":10},{"id":"1ff21174-03c3-4248-a7ea-32c4bf2c452c","label":"M","quantity":10},{"id":"42b7b9e2-e936-43bc-b6b4-e8266cad15a0","label":"L","quantity":9},{"id":"eee9f940-5c3d-4a18-8d67-275215749160","label":"XL","quantity":10},{"id":"93457cf6-6301-4858-9eb6-946eef2af2a6","label":"2XL","quantity":5},{"id":"027c41ae-a96c-450c-8ace-91c2125751a1","label":"3XL","quantity":5}]'::jsonb),
  ('Burgundy Youth Lake Crew', 'merch', 30.00, true, 24, '[{"id":"08c2e66b-006d-41d3-89e3-27913ed09b75","label":"XS","quantity":5},{"id":"12ab3bdb-c4b4-4182-8271-41662d0d84fe","label":"S","quantity":5},{"id":"9373c14f-45e1-457b-b52d-5e23e3043314","label":"M","quantity":5},{"id":"f68d94ef-aacc-4f97-8e40-d2fb04fba788","label":"L","quantity":5},{"id":"192ebe03-b06f-482e-abc0-914b1fd4d503","label":"XL","quantity":4}]'::jsonb),
  ('Blue Youth Lake Crew', 'merch', 30.00, true, 25, '[{"id":"2944dd33-7d0b-4682-a304-c2cb7dc61314","label":"XS","quantity":5},{"id":"8cf19276-58c7-46a4-aa84-cca50cc86134","label":"S","quantity":5},{"id":"88d7b630-95b1-4cf4-adf7-e9b38ce313be","label":"M","quantity":5},{"id":"04304fd6-1cbc-44ec-9cf7-9eb067f6a56d","label":"L","quantity":5},{"id":"19a8c8d5-e769-42e8-b56b-3d2579bb8707","label":"XL","quantity":5}]'::jsonb),
  ('Light Grey Canoe Crew', 'merch', 40.00, true, 17, '[{"id":"7db7a015-0a70-4f08-868a-a6543332e47f","label":"XS","quantity":7},{"id":"b920193e-8bc4-4d00-a1f5-9afed015a3ee","label":"S","quantity":5},{"id":"fc63d62b-be37-410f-b3f3-f9e3cc1a8e6f","label":"L","quantity":1},{"id":"10359fc8-fbb8-410a-8e67-6f10d213b6ec","label":"XL","quantity":2},{"id":"bf14c984-4d16-4802-8104-b02346816058","label":"3XL","quantity":2}]'::jsonb),
  ('Grey CL Crew', 'merch', 25.00, true, 24, '[{"id":"164282cd-7083-40ee-9c52-0535204e679f","label":"XS","quantity":8},{"id":"ffd26173-bf3b-4eb8-a18a-abb7eadb368f","label":"S","quantity":12},{"id":"c6f364f1-3713-48f8-941d-4d6e6f58a48f","label":"M","quantity":2},{"id":"f7845ccc-1d75-40d0-90c7-9b84f1ddd5e8","label":"XL","quantity":2}]'::jsonb),
  ('Black Logo Hoodie', 'merch', 30.00, true, 7, '[{"id":"587f7a8f-5250-440d-8f57-f22313550559","label":"XL","quantity":2},{"id":"1a642366-8b85-4618-9f8a-6e37660c477a","label":"2XL","quantity":5}]'::jsonb),
  ('Grey Logo Hoodie', 'merch', 30.00, true, 13, '[{"id":"0a41f880-836e-45a5-8203-77de789a8cc8","label":"S","quantity":4},{"id":"cbe8f83e-7193-4b3e-b2b6-9d3252289030","label":"M","quantity":4},{"id":"2cab5dae-a57c-4e58-87bf-11333299c7e4","label":"XL","quantity":4},{"id":"d29384d9-78ab-4471-84f5-77444d3819ab","label":"2XL","quantity":1}]'::jsonb),
  ('Blue Mtn Hoodie', 'merch', 25.00, true, 1, '[{"id":"33e7c2aa-ce90-48bb-9a53-89b5e30374c6","label":"2XL","quantity":1}]'::jsonb),
  ('Purple Lodge Hoodie', 'merch', 40.00, true, 1, '[{"id":"e47ea1aa-4515-412f-931b-36e1321605fc","label":"XL","quantity":0},{"id":"00a6111b-9669-452b-b206-43535c27dbac","label":"3XL","quantity":1}]'::jsonb),
  ('Brown Lodge Hoodie', 'merch', 40.00, true, 1, '[{"id":"420d6121-880f-4a3c-855a-13d0432f2b7e","label":"3XL","quantity":1}]'::jsonb),
  ('Light Grey Logo Sweats', 'merch', 35.00, true, 1, '[{"id":"f911c6a6-816d-478e-a218-389b6099a68e","label":"M","quantity":0},{"id":"59dec4e0-fa44-4fa6-9abb-727f0d3352c9","label":"L","quantity":1}]'::jsonb),
  ('Dark Grey Lawroweld Sweats', 'merch', 35.00, true, 4, '[{"id":"cabbb593-30ce-4975-a6ad-f603a3722617","label":"L","quantity":4}]'::jsonb),
  ('Dark Grey Logo Sweats', 'merch', 35.00, true, 2, '[{"id":"38520d29-e37f-4de5-b2d5-e99caf600fa7","label":"L","quantity":2}]'::jsonb),
  ('Blueberry Tank', 'merch', 15.00, true, 33, '[{"id":"54c9bb1d-d160-4adb-939d-0c0330b82b44","label":"S","quantity":6},{"id":"a81c70c8-a06a-49bf-8622-4ea5f422c9a5","label":"M","quantity":9},{"id":"9228c960-1abc-4c11-8773-e61923f61b0d","label":"L","quantity":8},{"id":"58175b79-1db2-4715-ba4f-870a4896912f","label":"XL","quantity":10}]'::jsonb),
  ('CL Blue T-shirt', 'merch', 10.00, true, 25, '[{"id":"db587e10-4046-4472-927e-0168a976290d","label":"XS","quantity":5},{"id":"8f76f31a-7743-47a4-a306-3650e7f536b1","label":"S","quantity":9},{"id":"2b6d40c0-94e0-4653-beff-2908ed4aa954","label":"M","quantity":2},{"id":"522bf43b-b2a8-479e-af3c-1ce9da8fb07d","label":"L","quantity":6},{"id":"998af3cd-b7ab-4e7d-bdee-a2aa6601b1e7","label":"XL","quantity":3}]'::jsonb),
  ('CL Green T-Shirt', 'merch', 10.00, true, 2, '[{"id":"ffbbb272-d20b-4f6b-a03d-313fabe4e769","label":"XS","quantity":1},{"id":"df0c1612-9f69-4078-bd23-b0cf877a1039","label":"M","quantity":1}]'::jsonb),
  ('Pink icon T-Shirt', 'merch', 15.00, true, 23, '[{"id":"fdd568c6-4628-4b1f-9976-3b2d67eccc87","label":"XS","quantity":5},{"id":"ff0b52b5-c190-4553-961c-161fef4dca23","label":"S","quantity":8},{"id":"dec7e288-c057-4735-937c-bc515b949ede","label":"M","quantity":7},{"id":"ef449f0d-078f-4156-992f-2233c2490436","label":"2XL","quantity":3}]'::jsonb),
  ('Maroon icon T-Shirt', 'merch', 15.00, true, 27, '[{"id":"cf7b30fb-41ff-4135-877e-b57688e00ccb","label":"XS","quantity":9},{"id":"42605cbe-4e8a-4b65-9e1f-66a13d03f74f","label":"S","quantity":5},{"id":"5989a08a-6839-42b4-8baf-b392c48da64b","label":"M","quantity":6},{"id":"8ef5f58d-6276-4767-a607-04d0c5d7b08d","label":"L","quantity":3},{"id":"6ef8d960-f11c-43e8-8727-cb896a0fb802","label":"2XL","quantity":4}]'::jsonb),
  ('Tan Mtn T-Shirt', 'merch', 10.00, true, 43, '[{"id":"4dc63339-85f9-49df-991b-74287447125a","label":"XS","quantity":7},{"id":"dc369d9f-58f1-4c7b-8de3-62102cd6a64d","label":"S","quantity":12},{"id":"50f16ccf-ec15-4725-bff1-6e480e050ae2","label":"M","quantity":10},{"id":"e05c296c-1d27-4f92-8ec7-f8148dc86ad5","label":"L","quantity":10},{"id":"c5c708bd-3418-41ba-afbf-c294c85626f8","label":"XL","quantity":4}]'::jsonb),
  ('Grey Mtn T-Shirt', 'merch', 10.00, true, 43, '[{"id":"0b56208b-66dd-4c7a-bbc5-8743f9b7594f","label":"XS","quantity":6},{"id":"1d7ec68e-8d4b-473e-9e42-ba83b919488e","label":"S","quantity":12},{"id":"aad9f37b-0912-49a7-8c4c-452e953dced9","label":"M","quantity":9},{"id":"d19ae998-1412-4241-b577-20651f2d867d","label":"L","quantity":8},{"id":"bf1f1f97-e0de-4872-a66d-a2729db0a231","label":"XL","quantity":8}]'::jsonb),
  ('Maroon/White T-Shirt', 'merch', 20.00, true, 98, '[{"id":"2f096850-4a4d-4123-85eb-9c00c8e31717","label":"XS","quantity":7},{"id":"52d240b9-b9ae-4606-bb3b-97dc679e03ac","label":"S","quantity":21},{"id":"20f81120-895e-4abe-882c-d974e9eee941","label":"M","quantity":28},{"id":"bd6a89c1-ebc7-4ff3-bae7-f5f596354dfe","label":"L","quantity":18},{"id":"0ce06e1d-24d7-4c2e-8960-8d308dd6610e","label":"XL","quantity":20},{"id":"c8545913-4e05-4b49-ad4f-2d742316aab8","label":"3XL","quantity":4}]'::jsonb),
  ('Green Moose T-Shirt', 'merch', 20.00, true, 84, '[{"id":"02098123-c032-4706-bfba-8fcc492bbf8d","label":"XS","quantity":8},{"id":"1550b3fd-3c72-4720-8fd5-8455bb22e66f","label":"S","quantity":15},{"id":"7b017ef1-bce5-4399-ba06-d3857ee20ced","label":"M","quantity":29},{"id":"b6b07c6d-5bb6-45cf-9eeb-ac95835d3e24","label":"L","quantity":13},{"id":"a559910b-6378-46b5-a244-fa83663ba7f7","label":"XL","quantity":10},{"id":"1ebf7536-f091-4900-bff8-7bf55b0fc25a","label":"2XL","quantity":5},{"id":"7daceed9-1c1e-4648-ae7c-46172f0d8802","label":"3XL","quantity":4}]'::jsonb),
  ('Light Blue Surf T-Shirt', 'merch', 10.00, true, 28, '[{"id":"573f1679-f01d-44be-8303-2dd250a0bb54","label":"XS","quantity":1},{"id":"18824150-4748-482b-a757-990b4b4e39db","label":"S","quantity":11},{"id":"00b06d18-9922-4672-ad10-220b9827af9c","label":"M","quantity":7},{"id":"22048b8c-b347-4db3-8e94-acb004a38a8c","label":"L","quantity":7},{"id":"238bf42e-732a-4f8d-bf49-ffa761730dda","label":"XL","quantity":2}]'::jsonb),
  ('Blue Needoh', 'merch', 3.00, true, 47, null),
  ('Youth White Tree Wave T-Shirt', 'merch', 18.00, true, 25, '[{"id":"86884338-5a65-4968-ad75-484de72f7c33","label":"XS","quantity":5},{"id":"7a7461cd-63d2-49d1-b373-3e6852b271f6","label":"S","quantity":5},{"id":"e0aa7ac5-425b-4954-80ab-83d4ee4e7116","label":"M","quantity":5},{"id":"5a50a036-cb5e-46c4-8273-102007285114","label":"L","quantity":5},{"id":"16c5e698-8b44-44bd-a5c5-482a1b99c014","label":"XL","quantity":5}]'::jsonb),
  ('Youth Green Tree Wave T-Shirt', 'merch', 18.00, true, 25, '[{"id":"f1ebefa3-8f38-42ab-84d7-6e844eee5388","label":"XS","quantity":5},{"id":"6083a787-709b-4f13-8920-d0ce81b4d50d","label":"S","quantity":5},{"id":"cf4d9926-aaf7-47f3-ad74-ca69c3eecaf6","label":"M","quantity":5},{"id":"645bde3d-4082-421e-99aa-5d0a4eb564ee","label":"L","quantity":5},{"id":"9bce4c4d-49aa-4cb8-9da5-172613691668","label":"XL","quantity":5}]'::jsonb),
  ('White Tree Wave T-Shirt', 'merch', 20.00, true, 68, '[{"id":"e46ac80f-1611-41fd-baa5-31b50175ffea","label":"XS","quantity":10},{"id":"d320b24e-bf62-4f69-b81d-e5470e2e1631","label":"S","quantity":15},{"id":"ec2b67b8-c7d0-45ba-89e2-cd6649c692c9","label":"M","quantity":14},{"id":"9b88f648-f99d-43ec-ba53-5bd0d8ef5c51","label":"L","quantity":9},{"id":"38c7162b-1221-45cc-8106-4e53a374047f","label":"XL","quantity":10},{"id":"7d0ee0f3-358d-4d9c-bd5d-a2655a7118af","label":"2XL","quantity":5},{"id":"6cc42f91-7dcb-4d5c-8c24-f1da0296ee03","label":"3XL","quantity":5}]'::jsonb),
  ('Green Tree Wave T-Shirt', 'merch', 20.00, true, 70, '[{"id":"ebadda2b-1799-4b0e-9bb4-f555d33583ce","label":"XS","quantity":10},{"id":"55923ef2-fffd-4515-b2a3-65dd364cd0ff","label":"S","quantity":15},{"id":"734b76fd-273b-4b5f-ab99-5e5df2ae8ef5","label":"M","quantity":15},{"id":"1a97f183-0fed-42c7-b825-638be906d3be","label":"L","quantity":10},{"id":"8cf01bfb-b4f0-4320-bb5a-8c0294b2d7e3","label":"XL","quantity":10},{"id":"753ee96f-7800-4b71-b128-c84ca790920b","label":"2XL","quantity":5},{"id":"8800b876-dd3f-4393-ad22-aec87de9b97e","label":"3XL","quantity":5}]'::jsonb),
  ('Toddler Cabin Flag Shirt', 'merch', 18.00, true, 20, '[{"id":"6e2e6cf3-f801-4d3d-ba90-431283c8e285","label":"2-5T","quantity":20}]'::jsonb),
  ('Youth Cabin Flag Shirt', 'merch', 18.00, true, 50, '[{"id":"6018ec84-f433-42c7-a6e5-87ad94b846c4","label":"XS","quantity":10},{"id":"bda91b81-da95-452d-85b2-c304ca3d8222","label":"S","quantity":10},{"id":"acd3c8ed-5f0b-4a21-9dc4-6d032e9a1677","label":"M","quantity":10},{"id":"57dcf8be-a864-4912-9e66-dde40ca16147","label":"L","quantity":10},{"id":"c043e69f-1faf-43d9-8aae-e925b2317ed7","label":"XL","quantity":10}]'::jsonb),
  ('Cabin Flag Shirt', 'merch', 20.00, true, 81, '[{"id":"9eef4425-93f2-4e9d-959a-7edd9fe24bb7","label":"XS","quantity":10},{"id":"0244db6d-c910-4161-8897-d1b7fd0a9089","label":"S","quantity":20},{"id":"4cb9c91d-ab6f-4b66-8c9d-b6a92b09f7dc","label":"M","quantity":16},{"id":"220bdda3-f113-489e-a7cc-c9bef870e8fd","label":"L","quantity":15},{"id":"ea659205-5a2b-414c-a50c-e4a6d598e462","label":"XL","quantity":10},{"id":"d2a5a1e6-ab7f-4c8a-b638-6c078ac8cbc0","label":"2XL","quantity":5},{"id":"358b22ac-f498-4488-bd21-294d39ef9593","label":"3XL","quantity":5}]'::jsonb),
  ('Blue Still Leading Hat', 'merch', 25.00, true, 5, null),
  ('Blue Maine State Hat', 'merch', 25.00, true, 11, null),
  ('Grey Maine State Hat', 'merch', 25.00, true, 19, null),
  ('White Still Leading Hat', 'merch', 25.00, true, 7, null),
  ('White Canoe Hat', 'merch', 25.00, true, 16, null),
  ('White Cordurory Still Leading Hat', 'merch', 25.00, true, 13, null),
  ('Army Green Lawroweld Hat', 'merch', 25.00, true, 20, null),
  ('Orange/Blue Mtn Hat', 'merch', 25.00, true, 37, null),
  ('Swing Hat', 'merch', 25.00, true, 16, null),
  ('Yellow Canoe Hat', 'merch', 25.00, true, 16, null),
  ('Blue Lodge Hat', 'merch', 25.00, true, 6, null),
  ('Camo Lawroweld Hat', 'merch', 25.00, true, 5, null),
  ('Grey Moose Hat', 'merch', 25.00, true, 2, null),
  ('Brown Logo Beanie', 'merch', 25.00, true, 8, null),
  ('Maroon Moose Beanie', 'merch', 25.00, true, 4, null),
  ('Sunglasses', 'merch', 5.00, true, 0, null),
  ('Lanyard', 'merch', 2.00, true, 0, null),
  ('Staff Cards', 'merch', 2.00, true, 0, null),
  ('Mugs', 'merch', 20.00, true, 0, null),
  ('Plushie', 'merch', 20.00, true, 0, null),
  ('Tote Bag', 'merch', 20.00, true, 0, null);

commit;

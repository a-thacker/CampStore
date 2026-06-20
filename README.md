# Camp Store Register — React App

A real, deployable build of the prototype: **React (Vite)** + **Supabase** (Postgres + auth) + **Square** (card payments), hosted on **Netlify**.

This is the actual app — not a mockup. It reads and writes a live database, signs staff in, and charges real cards through Square. It ships with the same UI as the prototype.

---

## Quick start (local)

```bash
npm install
cp .env.example .env        # then fill in your keys (see below)
```

**1. Set up the database** — in your Supabase project's SQL editor, run in order:
1. `supabase/schema.sql`   (tables, indexes, Row Level Security)
2. `supabase/functions.sql` (the atomic RPCs: record_sale, process_return, …)
3. `supabase/seed.sql`     (optional sample products/weeks to click around)

Then create a staff login: Supabase → Authentication → Users → **Add user** (email + password).

**2. Fill in `.env`** (all keys explained inside `.env.example`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase → Settings → API
- `VITE_SQUARE_APP_ID`, `VITE_SQUARE_LOCATION_ID`, `VITE_SQUARE_ENVIRONMENT` — Square Developer dashboard
- `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT` — server-only secrets for the Netlify function

**3. Run it** (with the Netlify CLI so the Square function runs alongside Vite):
```bash
npm i -g netlify-cli
netlify dev
```
Or front-end only (card charging disabled): `npm run dev`.

Open the local URL, sign in with the staff user you created, and the register loads.

---

## Deploy to Netlify

1. Push this folder to a GitHub repo.
2. Netlify → **Add new site → Import an existing project**, pick the repo.
3. Build settings are read from `netlify.toml` (build `npm run build`, publish `dist`, functions `netlify/functions`).
4. Add all the env vars from `.env` under **Site settings → Environment variables**.
5. Deploy. Test a full sale in **Square sandbox** (test card `4111 1111 1111 1111`), then flip `SQUARE_ENVIRONMENT` / `VITE_SQUARE_ENVIRONMENT` to `production`.

---

## How it's built

| Layer | File(s) | Notes |
|---|---|---|
| Entry | `src/main.jsx`, `src/App.jsx` | Auth gate → loads `useStore` → renders the shell + 4 views. |
| Auth | `src/auth/Login.jsx` | Supabase email/password. Sign-out is in the sidebar. |
| Data | `src/store.js` | `useStore(session)` loads every table, maps DB snake_case → app camelCase, and exposes `api.*` mutations. CRUD goes through `supabase.from(...)`; sales/returns/cash-outs/deposits/settles go through Postgres **RPCs** so stock + balances are updated atomically. After each mutation it refetches (the dataset is small). |
| Selectors | `src/lib/helpers.js` | Pure read helpers (`Store.weekSales`, etc.) over the in-memory snapshot — same signatures the views already used. |
| Supabase | `src/lib/supabase.js` | The client. |
| Square | `src/lib/square.js` | Lazy-loads the Web Payments SDK, mounts the card field, tokenizes, and calls the Netlify function. |
| Card charge | `netlify/functions/square-payment.js` | Server-side charge with the secret token. `square-refund.js` refunds a returned card sale. |
| UI | `src/components.jsx`, `src/views/*.jsx`, `src/index.css` | Identical look to the prototype. |

### The money rules live in SQL (`supabase/functions.sql`)
- `record_sale` validates `allow_purchase` / `allow_over_balance` / cashed-out, decrements merch stock (food is skipped), writes the ledger row, and moves balance/tab — all in one transaction.
- `process_return` flags the original, restocks, refunds to the original method, writes a negative row.
- `cash_out_camper`, `deposit_balance`, `settle_tab` round out the ledger.

Because the rules are enforced in the database, a second register (or a bug in the UI) can't corrupt balances or stock.

---

## Stock Station (`/stock`)

A phone-first, foolproof page for updating inventory — make a QR code that points at `https://YOUR-SITE.netlify.app/stock`.

- Big **− / +** buttons and tap-to-set counts for every merch item; **photo upload** per item (camera or library).
- Photos upload to a Supabase **Storage** bucket (`product-images`) created by `schema.sql`; the public URL is saved on the product and shows in the register too.
- It uses the same staff login — sign in once and the session persists, so the QR just opens the board.
- Routing is path-based (`src/main.jsx`): `/stock` renders the station, everything else renders the register. Netlify's SPA redirect makes the deep link work.

> After running `schema.sql`, confirm **Storage → product-images** exists and is public (Supabase dashboard).

## Notes & next steps
- **RLS** currently grants any signed-in user full access (right for one shared camp login). For per-staff attribution or an admin-only area, see `../Camp Store — Real Build Handoff/INTEGRATION.md` §5.
- **Card refunds**: `process_return` reverses the ledger; to also refund the card in Square, call `/.netlify/functions/square-refund` with the sale's `square_payment_id` when its method was `card`.
- **Realtime** (two registers at once): subscribe to `transactions`/`products` changes and call `api.reload()` — snippet in INTEGRATION.md §6.

> I built and statically verified the module structure here; it needs **your** Supabase + Square keys to run, so plug those into `.env` first.

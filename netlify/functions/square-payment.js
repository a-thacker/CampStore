/**
 * Netlify Function — Square card charge  (HARDENED)
 * ----------------------------------------------------------------
 * POST /.netlify/functions/square-payment
 * Headers: Authorization: Bearer <supabase access token>
 * Body:    { items: [{ product_id, size_id?, qty }], note?: string }
 *
 * Security model
 *  - The browser tokenizes the card with Square's Web Payments SDK and
 *    sends ONLY the one-time `sourceId` here — never the card number.
 *  - The caller MUST be a signed-in staff member: we verify their
 *    Supabase JWT before doing anything.
 *  - The amount is NOT trusted from the client. We recompute the total
 *    server-side from current `products.price` rows (service-role read),
 *    so a tampered browser can't charge $0.01 for a $40 cart.
 *  - Only the allowlisted site origin(s) may call this.
 *  - The SECRET access token never leaves the server.
 *
 * Requires (Netlify env vars):
 *   SQUARE_ACCESS_TOKEN          — secret token (sandbox or production)
 *   SQUARE_LOCATION_ID           — your Square location
 *   SQUARE_ENVIRONMENT           — 'sandbox' | 'production'
 *   SUPABASE_URL                 — your project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — service-role key (SECRET, server only)
 *   ALLOWED_ORIGINS              — comma-separated site origins
 */
const { Client, Environment } = require('square');
const { randomUUID } = require('crypto');
const { requireUser, originAllowed, adminClient, json } = require('./lib/guard');

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? Environment.Production
      : Environment.Sandbox,
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {}, event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, event);
  if (!originAllowed(event)) return json(403, { error: 'Origin not allowed' }, event);

  // 1) must be a signed-in staff member
  const { user, error: authErr } = await requireUser(event);
  if (authErr) return json(401, { error: authErr }, event);

  // 2) parse
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' }, event);
  }
  const { sourceId, items, note } = body;
  if (!sourceId) return json(400, { error: 'sourceId is required' }, event);
  if (!Array.isArray(items) || items.length === 0) {
    return json(400, { error: 'items[] is required' }, event);
  }

  // 3) authoritative server-side pricing (ignore any client-sent amount)
  let amountCents;
  try {
    amountCents = await priceCart(items);
  } catch (e) {
    return json(400, { error: e.message }, event);
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return json(400, { error: 'Computed total is invalid' }, event);
  }

  // 4) charge
  try {
    const { result } = await client.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: randomUUID(), // prevents accidental double-charges
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      locationId: process.env.SQUARE_LOCATION_ID,
      note: note ? String(note).slice(0, 500) : 'Camp Store sale',
    });
    return json(200, {
      paymentId: result.payment.id,
      status: result.payment.status, // 'COMPLETED'
      amountCents,                    // authoritative amount actually charged
    }, event);
  } catch (err) {
    const detail = err?.errors?.[0]?.detail || err.message || 'Payment failed';
    return json(402, { error: detail }, event);
  }
};

/**
 * Recompute the cart total in cents from live DB prices.
 * Throws on unknown/inactive products or bad quantities.
 */
async function priceCart(items) {
  const ids = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  if (ids.length === 0) throw new Error('No valid products in cart');

  const { data, error } = await adminClient()
    .from('products')
    .select('id, price, active')
    .in('id', ids);
  if (error) throw new Error('Could not price cart');

  const byId = new Map((data || []).map((p) => [p.id, p]));
  let cents = 0;
  for (const line of items) {
    const p = byId.get(line.product_id);
    if (!p) throw new Error('Unknown product in cart');
    if (p.active === false) throw new Error('Inactive product in cart');
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('Invalid quantity');
    cents += Math.round(Number(p.price) * 100) * qty;
  }
  return cents;
}

/**
 * Netlify Function — Square refund  (HARDENED)
 * ----------------------------------------------------------------
 * POST /.netlify/functions/square-refund
 * Headers: Authorization: Bearer <supabase access token>
 * Body:    { paymentId: string, reason?: string }
 *
 * Security model
 *  - Caller MUST be a signed-in staff member (Supabase JWT verified).
 *  - Optionally admin-only: set REFUND_ADMIN_ONLY=true and give trusted
 *    users app_metadata.role='admin' in Supabase. Without it, any
 *    signed-in staff member may refund (single shared camp login).
 *  - The refund amount is NOT trusted from the client. We look the
 *    payment up in our own `transactions` ledger, confirm it's a real
 *    card SALE, and refund exactly that recorded total — so nobody can
 *    POST an arbitrary paymentId+amount to drain the account.
 *  - Only the allowlisted site origin(s) may call this.
 *
 * Requires the same env vars as square-payment.js, plus optional
 *   REFUND_ADMIN_ONLY = 'true' | 'false'
 */
const { Client, Environment } = require('square');
const { randomUUID } = require('crypto');
const { requireUser, originAllowed, adminClient, json } = require('./lib/guard');

const REFUND_ADMIN_ONLY = String(process.env.REFUND_ADMIN_ONLY || '').toLowerCase() === 'true';

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

  // 1) auth
  const { user, error: authErr } = await requireUser(event);
  if (authErr) return json(401, { error: authErr }, event);
  if (REFUND_ADMIN_ONLY && user.app_metadata?.role !== 'admin') {
    return json(403, { error: 'Refunds are restricted to admins' }, event);
  }

  // 2) parse
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' }, event);
  }
  const { paymentId, reason } = body;
  if (!paymentId) return json(400, { error: 'paymentId is required' }, event);

  // 3) verify the payment maps to a real card sale, and take the amount
  //    from OUR ledger — never from the client.
  const { data: sale, error: qErr } = await adminClient()
    .from('transactions')
    .select('id, total, method, kind, square_payment_id')
    .eq('square_payment_id', paymentId)
    .eq('kind', 'sale')
    .eq('method', 'card')
    .maybeSingle();
  if (qErr) return json(500, { error: 'Could not verify payment' }, event);
  if (!sale) return json(404, { error: 'No matching card sale for this payment' }, event);

  const amountCents = Math.round(Number(sale.total) * 100);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return json(400, { error: 'Recorded sale amount is invalid' }, event);
  }

  // 4) refund
  try {
    const { result } = await client.refundsApi.refundPayment({
      idempotencyKey: randomUUID(),
      paymentId,
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      reason: reason ? String(reason).slice(0, 192) : 'Camp Store return',
    });
    return json(200, {
      refundId: result.refund.id,
      status: result.refund.status,
      amountCents,
    }, event);
  } catch (err) {
    const detail = err?.errors?.[0]?.detail || err.message || 'Refund failed';
    return json(402, { error: detail }, event);
  }
};

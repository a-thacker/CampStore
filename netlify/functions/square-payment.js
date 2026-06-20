/**
 * Netlify Function — Square card charge
 * ----------------------------------------------------------------
 * POST /.netlify/functions/square-payment
 * Body: { sourceId: string, amountCents: number, note?: string }
 *
 * The browser tokenizes the card with Square's Web Payments SDK and
 * sends only the one-time `sourceId` here. The SECRET access token
 * never leaves the server. On success we return { paymentId } and the
 * front-end then records the sale via the Supabase `record_sale` RPC
 * with method='card' and square_payment_id=paymentId.
 *
 * Requires (Netlify env vars):
 *   SQUARE_ACCESS_TOKEN   — secret token (sandbox or production)
 *   SQUARE_LOCATION_ID    — your Square location
 *   SQUARE_ENVIRONMENT    — 'sandbox' | 'production'
 *
 * Install: npm i square
 */
const { Client, Environment } = require('square');
const { randomUUID } = require('crypto');

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? Environment.Production
      : Environment.Sandbox,
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { sourceId, amountCents, note } = body;
  if (!sourceId || !Number.isInteger(amountCents) || amountCents <= 0) {
    return json(400, { error: 'sourceId and a positive integer amountCents are required' });
  }

  try {
    const { result } = await client.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: randomUUID(),       // prevents accidental double-charges
      amountMoney: {
        amount: BigInt(amountCents),       // cents, e.g. $18.00 -> 1800
        currency: 'USD',
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      note: note ? String(note).slice(0, 500) : 'Camp Store sale',
    });

    return json(200, {
      paymentId: result.payment.id,
      status: result.payment.status,      // 'COMPLETED'
    });
  } catch (err) {
    const detail = err?.errors?.[0]?.detail || err.message || 'Payment failed';
    return json(402, { error: detail });
  }
};

// BigInt-safe JSON response helper
function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  };
}

/* ----------------------------------------------------------------
 * REFUNDS (for returning a card sale): create a sibling function
 * `square-refund.js` calling client.refundsApi.refundPayment({
 *   idempotencyKey, paymentId, amountMoney:{ amount, currency:'USD' }
 * }). Trigger it from process_return when the original method=card.
 * ---------------------------------------------------------------- */

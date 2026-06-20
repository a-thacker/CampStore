/**
 * Netlify Function — Square refund (for returning a card sale)
 * ----------------------------------------------------------------
 * POST /.netlify/functions/square-refund
 * Body: { paymentId: string, amountCents: number, reason?: string }
 *
 * Call this from your front-end when process_return() reverses a sale
 * whose original method was 'card', passing the stored square_payment_id.
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
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { paymentId, amountCents, reason } = body;
  if (!paymentId || !Number.isInteger(amountCents) || amountCents <= 0) {
    return json(400, { error: 'paymentId and a positive integer amountCents are required' });
  }

  try {
    const { result } = await client.refundsApi.refundPayment({
      idempotencyKey: randomUUID(),
      paymentId,
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      reason: reason ? String(reason).slice(0, 192) : 'Camp Store return',
    });
    return json(200, { refundId: result.refund.id, status: result.refund.status });
  } catch (err) {
    const detail = err?.errors?.[0]?.detail || err.message || 'Refund failed';
    return json(402, { error: detail });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  };
}

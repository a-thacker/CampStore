/* ============================================================
   Square Web Payments SDK loader + card charge helper.
   The SDK script URL differs by environment. We load it lazily
   the first time a card payment is attempted.
   ============================================================ */
import { supabase } from './supabase.js';

const ENV = import.meta.env.VITE_SQUARE_ENVIRONMENT || 'sandbox';
const APP_ID = import.meta.env.VITE_SQUARE_APP_ID;
const LOCATION_ID = import.meta.env.VITE_SQUARE_LOCATION_ID;

const SDK_URL = ENV === 'production'
  ? 'https://web.squarecdn.com/v1/square.js'
  : 'https://sandbox.web.squarecdn.com/v1/square.js';

export function squareConfigured() {
  return Boolean(APP_ID && LOCATION_ID);
}

let sdkPromise = null;
function loadSdk() {
  if (window.Square) return Promise.resolve(window.Square);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.onload = () => resolve(window.Square);
    s.onerror = () => reject(new Error('Failed to load Square SDK'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

let paymentsPromise = null;
export async function getPayments() {
  const Square = await loadSdk();
  if (!paymentsPromise) paymentsPromise = Square.payments(APP_ID, LOCATION_ID);
  return paymentsPromise;
}

/**
 * Attach a Square card form into `container` (a DOM node).
 * Returns the card instance; call card.tokenize() to get a one-time token.
 */
export async function mountCard(container) {
  const payments = await getPayments();
  const card = await payments.card();
  await card.attach(container);
  return card;
}

// Attach the signed-in staff member's Supabase session token so the
// Netlify function can verify the caller. Throws if the session expired.
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Your session has expired — please sign in again');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/**
 * Tokenize a mounted card and charge it via our Netlify function.
 * We send the CART (product ids + quantities), not a dollar amount —
 * the server recomputes the authoritative total from DB prices, so the
 * charge can't be tampered with client-side.
 * Returns { paymentId, amountCents } on success, throws on failure.
 */
export async function chargeCard(card, { cart, note }) {
  const result = await card.tokenize();
  if (result.status !== 'OK') {
    throw new Error('Card entry incomplete');
  }
  const items = (cart || []).map((l) => ({
    product_id: l.productId,
    size_id: l.sizeId || null,
    qty: l.qty,
  }));
  const res = await fetch('/.netlify/functions/square-payment', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ sourceId: result.token, items, note }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Payment failed');
  return { paymentId: data.paymentId, amountCents: data.amountCents };
}

/**
 * Refund a card sale via our Netlify function. Pass the stored
 * square_payment_id; the server looks up the recorded sale and refunds
 * exactly that amount (the client can't specify an amount).
 * Returns { refundId, amountCents }.
 */
export async function refundCard(paymentId, reason) {
  const res = await fetch('/.netlify/functions/square-refund', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ paymentId, reason }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Refund failed');
  return { refundId: data.refundId, amountCents: data.amountCents };
}

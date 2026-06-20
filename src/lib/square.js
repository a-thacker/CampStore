/* ============================================================
   Square Web Payments SDK loader + card charge helper.
   The SDK script URL differs by environment. We load it lazily
   the first time a card payment is attempted.
   ============================================================ */
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

/**
 * Tokenize a mounted card and charge it via our Netlify function.
 * Returns { paymentId } on success, throws on failure.
 */
export async function chargeCard(card, amountCents, note) {
  const result = await card.tokenize();
  if (result.status !== 'OK') {
    throw new Error('Card entry incomplete');
  }
  const res = await fetch('/.netlify/functions/square-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId: result.token, amountCents, note }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Payment failed');
  return { paymentId: data.paymentId };
}

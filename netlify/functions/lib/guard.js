/* ============================================================
   Shared guards for the Square Netlify Functions.
   (This file lives in a `lib/` subfolder whose name doesn't
   match the filename, so Netlify does NOT deploy it as its own
   endpoint — it's a helper module the functions `require`.)

   Provides:
     - corsHeaders(event)  → CORS headers locked to ALLOWED_ORIGINS
     - originAllowed(event) → boolean origin allowlist check
     - requireUser(event)  → verifies the caller's Supabase JWT
     - adminClient()       → service-role Supabase client (server only)
     - json(status, obj, event) → BigInt-safe JSON response w/ CORS
   ============================================================ */
const { createClient } = require('@supabase/supabase-js');

// Comma-separated list of allowed site origins, e.g.
//   ALLOWED_ORIGINS=https://camp-store.netlify.app,https://store.mycamp.org
// Leave empty to disable the origin check (dev convenience only).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function reqOrigin(event) {
  const h = event.headers || {};
  return h.origin || h.Origin || '';
}

function corsHeaders(event) {
  const origin = reqOrigin(event);
  // Echo the origin only when it's on the allowlist; otherwise fall back to
  // the first configured origin (or '' when the check is disabled).
  const allow = ALLOWED_ORIGINS.length === 0
    ? (origin || '*')
    : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function originAllowed(event) {
  if (ALLOWED_ORIGINS.length === 0) return true;   // check disabled
  const origin = reqOrigin(event);
  if (!origin) return true;                         // same-origin (no Origin header)
  return ALLOWED_ORIGINS.includes(origin);
}

let _admin = null;
function adminClient() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

/**
 * Verify the Supabase session JWT sent by the browser in the
 * `Authorization: Bearer <token>` header. Returns { user } on success
 * or { error } when missing/invalid/expired.
 */
async function requireUser(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return { error: 'Not authenticated' };
  try {
    const { data, error } = await adminClient().auth.getUser(token);
    if (error || !data || !data.user) return { error: 'Invalid or expired session' };
    return { user: data.user };
  } catch (e) {
    return { error: 'Auth check failed' };
  }
}

// BigInt-safe JSON response with CORS headers attached.
function json(statusCode, obj, event) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...(event ? corsHeaders(event) : {}) },
    body: JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  };
}

module.exports = { corsHeaders, originAllowed, requireUser, adminClient, json };

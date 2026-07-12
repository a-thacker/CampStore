/* ============ Login (Supabase email/password) ============ */
import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Icon, Field } from '../components.jsx';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setErr(error.message); setBusy(false); }
    // on success, onAuthStateChange in App swaps to the register
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark" style={{ width: 48, height: 48, margin: '0 auto 16px' }}><Icon name="sun" size={28} /></div>
        <h1 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', letterSpacing: '-.02em' }}>Camp Store Register</h1>
        <p className="muted" style={{ textAlign: 'center', fontSize: 14, marginTop: 4, marginBottom: 22 }}>Sign in to open the register</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Email">
            <input className="input lg" type="email" value={email} autoFocus required
              onChange={(e) => setEmail(e.target.value)} placeholder="you@camp.org" />
          </Field>
          <Field label="Password">
            <input className="input lg" type="password" value={password} required
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {err && <div className="co-note err"><Icon name="alert" size={16} /> {err}</div>}
          <button className="btn primary lg block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}

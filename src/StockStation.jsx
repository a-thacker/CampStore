/* ============================================================
   Stock Station (React) — phone-first, QR-friendly page at /stock.
   Same auth as the register; once a staffer is signed in the
   session persists so the QR just opens. Photos upload to
   Supabase Storage; counts write straight to the products table.
   ============================================================ */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase.js';
import { useStore } from './store.js';
import { Store } from './lib/helpers.js';
import { processImageToBlob } from './lib/image.js';
import { Icon, Badge, Search, Field, Modal, EmptyState, useToast, ToastHost } from './components.jsx';
import { Login } from './auth/Login.jsx';

export default function StockStation() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Center>Loading…</Center>;
  if (session === null) return <Login />;
  return <Station session={session} />;
}

function Center({ children }) {
  return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontWeight: 600 }}>{children}</div>;
}

function Station({ session }) {
  const { db, error, api } = useStore(session);
  const [cat, setCat] = useState('merch');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  if (error) return <Center>{error}</Center>;
  if (!db) return <Center>Loading store…</Center>;

  const list = db.products.filter((p) => p.active && p.category === cat &&
    p.name.toLowerCase().includes(q.toLowerCase()));
  const lowCount = db.products.filter((p) => p.active && p.trackQuantity && p.quantity <= db.settings.lowStock).length;
  const wrap = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message); } };

  const bump = (p, d) => p.trackQuantity && wrap(() => api.adjustStock(p.id, Math.max(0, (p.quantity || 0) + d)),
    (d > 0 ? '+' + d : d) + ' · ' + p.name);
  const setQty = (p, n) => wrap(() => api.adjustStock(p.id, Math.max(0, n)));
  const startTracking = (p) => wrap(() => api.setTracking(p.id, true, p.quantity || 0), 'Now counting ' + p.name);
  const setPhoto = async (p, file) => {
    if (!file) return;
    try { const blob = await processImageToBlob(file); await api.uploadProductImage(p.id, blob); toast('Photo saved · ' + p.name); }
    catch (e) { toast(e.message); }
  };
  const addProduct = (prod) => wrap(() => api.addProduct({
    name: prod.name, category: prod.category, price: prod.price,
    trackQuantity: prod.category === 'merch', quantity: prod.quantity || 0,
  }), prod.name + ' added');

  return (
    <div className="stock">
      <header className="stock-top">
        <div className="stock-top-row">
          <div className="brand-mark"><Icon name="sun" size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stock-title">{db.settings.campName}</div>
            <div className="stock-sub">Stock Station</div>
          </div>
          <a className="stock-back" href="/" title="Open register"><Icon name="register" size={18} /></a>
        </div>
        <p className="stock-help">Tap a photo to set it. Use <b>−</b> and <b>+</b> to update counts — changes save instantly.</p>
      </header>

      <div className="stock-bar">
        <div className="chip-tabs" style={{ width: '100%' }}>
          <button className={'chip-tab' + (cat === 'merch' ? ' active' : '')} style={{ flex: 1 }} onClick={() => setCat('merch')}>Merch</button>
          <button className={'chip-tab' + (cat === 'food' ? ' active' : '')} style={{ flex: 1 }} onClick={() => setCat('food')}>Food &amp; Snacks</button>
        </div>
        <Search value={q} onChange={setQ} placeholder={'Search ' + cat + '…'} />
        {cat === 'merch' && lowCount > 0 && <div className="stock-low"><Icon name="alert" size={14} /> <span>{lowCount} item{lowCount !== 1 ? 's' : ''} at or below {db.settings.lowStock}</span></div>}
      </div>

      <div className="stock-grid">
        {list.map((p) => (
          <StockCard key={p.id} p={p} lowStock={db.settings.lowStock}
            onBump={bump} onSet={setQty} onPhoto={setPhoto} onTrack={startTracking} />
        ))}
        {list.length === 0 && <div style={{ gridColumn: '1/-1' }}><EmptyState icon="box" title="Nothing here" sub="Try the other tab or search." /></div>}
      </div>

      <div className="stock-add-wrap">
        <button className="btn lg block" onClick={() => setAdding(true)}><Icon name="plus" size={20} /> Add a new {cat === 'merch' ? 'merch item' : 'food item'}</button>
      </div>

      {adding && <QuickAddModal cat={cat} onAdd={(p) => { addProduct(p); setAdding(false); }} onClose={() => setAdding(false)} />}
      <ToastHost />
    </div>
  );
}

function StockCard({ p, lowStock, onBump, onSet, onPhoto, onTrack }) {
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const out = p.trackQuantity && p.quantity <= 0;
  const low = p.trackQuantity && p.quantity > 0 && p.quantity <= lowStock;

  function openSet() { setDraft(String(p.quantity ?? 0)); setEditing(true); }
  function commit() { const n = parseInt(draft); if (!isNaN(n)) onSet(p, Math.max(0, n)); setEditing(false); }

  return (
    <div className={'scard' + (out ? ' out' : '')}>
      <button className="scard-photo" onClick={() => fileRef.current.click()}>
        {p.image
          ? <img src={p.image} alt={p.name} />
          : <span className="scard-photo-empty"><Icon name={busy ? 'image' : 'camera'} size={24} /><span>{busy ? 'Uploading…' : 'Add photo'}</span></span>}
        <span className="scard-photo-edit"><Icon name="camera" size={14} /></span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
        onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) { setBusy(true); await onPhoto(p, f); setBusy(false); } }} />

      <div className="scard-body">
        <div className="scard-name">{p.name}</div>
        <div className="scard-price tnum">{Store.money(p.price)}</div>

        {p.trackQuantity ? (
          <>
            <div className="scard-status">
              {out ? <Badge kind="out">Out of stock</Badge> : low ? <Badge kind="low">Low · {p.quantity} left</Badge> : <Badge kind="ok">{p.quantity} in stock</Badge>}
            </div>
            {editing ? (
              <div className="scard-setrow">
                <input className="input lg tnum" autoFocus inputMode="numeric" value={draft}
                  onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} />
                <button className="btn primary lg" onClick={commit}>Set</button>
              </div>
            ) : (
              <div className="scard-qtyrow">
                <button className="qbtn minus" onClick={() => onBump(p, -1)} disabled={out} aria-label="Remove one"><Icon name="minus" size={26} /></button>
                <button className="scard-count tnum" onClick={openSet} title="Tap to set exact count">{p.quantity}</button>
                <button className="qbtn plus" onClick={() => onBump(p, +1)} aria-label="Add one"><Icon name="plus" size={26} /></button>
              </div>
            )}
          </>
        ) : (
          <div className="scard-untracked">
            <Badge kind="muted">Not counted</Badge>
            <button className="btn sm" onClick={() => onTrack(p)}>Start counting</button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAddModal({ cat, onAdd, onClose }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const valid = name.trim() && price !== '' && !isNaN(+price) && +price >= 0;
  return (
    <Modal title={'Add ' + (cat === 'merch' ? 'merch item' : 'food item')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!valid} onClick={() => onAdd({ name: name.trim(), price: +(+price).toFixed(2), category: cat, quantity: +quantity || 0 })}>Add item</button></>}>
      <Field label="Item name"><input className="input lg" value={name} onChange={(e) => setName(e.target.value)} placeholder={cat === 'merch' ? 'e.g. Camp Hoodie' : 'e.g. Ice Cream'} autoFocus /></Field>
      <div className="row">
        <Field label="Price">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: 13, color: 'var(--ink-3)', fontWeight: 700 }}>$</span>
            <input className="input lg tnum" style={{ paddingLeft: 26 }} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" inputMode="decimal" />
          </div>
        </Field>
        {cat === 'merch' && <Field label="Starting count"><input className="input lg tnum" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" /></Field>}
      </div>
      <div className="muted" style={{ fontSize: 13 }}>You can add a photo right after it appears on the board.</div>
    </Modal>
  );
}

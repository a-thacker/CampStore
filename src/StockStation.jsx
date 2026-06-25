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
  const lowCount = db.products.filter((p) => p.active && p.trackQuantity && Store.totalQty(p) <= db.settings.lowStock).length;
  const wrap = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message); } };

  // write a new count for one size (or the whole product when sizeId is null)
  function writeQty(p, n, sizeId) {
    const next = Math.max(0, n);
    if (sizeId && Store.isSized(p)) {
      const sizes = p.sizes.map((z) => z.id === sizeId ? { ...z, quantity: next } : z);
      return api.setSizes(p.id, sizes);
    }
    return api.adjustStock(p.id, next);
  }
  const bump = (p, d, sizeId) => {
    if (!p.trackQuantity) return;
    if (Store.isSized(p)) {
      if (!sizeId) return;
      const z = Store.findSize(p, sizeId);
      return wrap(() => writeQty(p, (z ? z.quantity : 0) + d, sizeId),
        (d > 0 ? '+' + d : d) + ' · ' + p.name + (z ? ' · ' + z.label : ''));
    }
    return wrap(() => writeQty(p, (p.quantity || 0) + d), (d > 0 ? '+' + d : d) + ' · ' + p.name);
  };
  const setQty = (p, n, sizeId) => wrap(() => writeQty(p, Math.max(0, n), sizeId));
  const startTracking = (p) => wrap(() => api.setTracking(p.id, true, p.quantity || 0), 'Now counting ' + p.name);
  const setPhoto = async (p, file) => {
    if (!file) return;
    try { const blob = await processImageToBlob(file); await api.uploadProductImage(p.id, blob); toast('Photo saved · ' + p.name); }
    catch (e) { toast(e.message); }
  };
  const addProduct = (prod) => wrap(() => api.addProduct({
    name: prod.name, category: prod.category, price: prod.price,
    trackQuantity: prod.category === 'merch',
    quantity: prod.sizes && prod.sizes.length ? prod.sizes.reduce((s, z) => s + (z.quantity || 0), 0) : (prod.quantity || 0),
    sizes: prod.sizes && prod.sizes.length ? prod.sizes : null,
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
  const sized = Store.isSized(p);
  const [sel, setSel] = useState(sized ? p.sizes[0].id : null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  // keep selected size valid as sizes change between renders
  const selSize = sized ? (Store.findSize(p, sel) || p.sizes[0]) : null;
  const total = Store.totalQty(p);
  const out = p.trackQuantity && total <= 0;
  const low = p.trackQuantity && total > 0 && total <= lowStock;
  const shownQty = sized ? (selSize ? selSize.quantity : 0) : p.quantity;
  const selOut = sized && shownQty <= 0;

  function openSet() { setDraft(String(shownQty ?? 0)); setEditing(true); }
  function commit() { const n = parseInt(draft); if (!isNaN(n)) onSet(p, Math.max(0, n), sized ? selSize.id : null); setEditing(false); }

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
              {out ? <Badge kind="out">Out of stock</Badge>
                : low ? <Badge kind="low">Low · {total}{sized ? ' total' : ' left'}</Badge>
                : <Badge kind="ok">{total} in stock{sized ? ' · all sizes' : ''}</Badge>}
            </div>

            {sized && (
              <div className="size-chips">
                {p.sizes.map((z) => (
                  <button key={z.id} type="button"
                    className={'size-chip' + (z.id === selSize.id ? ' active' : '') + (z.quantity <= 0 ? ' empty' : '')}
                    onClick={() => { setSel(z.id); setEditing(false); }}>
                    <span className="size-chip-label">{z.label}</span>
                    <span className="size-chip-qty tnum">{z.quantity}</span>
                  </button>
                ))}
              </div>
            )}

            {editing ? (
              <div className="scard-setrow">
                <input className="input lg tnum" autoFocus inputMode="numeric" value={draft}
                  onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} />
                <button className="btn primary lg" onClick={commit}>{sized ? 'Set ' + selSize.label : 'Set'}</button>
              </div>
            ) : (
              <div className="scard-qtyrow">
                <button className="qbtn minus" onClick={() => onBump(p, -1, sized ? selSize.id : null)} disabled={sized ? selOut : out} aria-label="Remove one"><Icon name="minus" size={26} /></button>
                <button className="scard-count tnum" onClick={openSet} title="Tap to set exact count">
                  {sized
                    ? <span className="scard-count-stack"><span className="scard-count-num">{shownQty}</span><span className="scard-count-sub">size {selSize.label}</span></span>
                    : shownQty}
                </button>
                <button className="qbtn plus" onClick={() => onBump(p, +1, sized ? selSize.id : null)} aria-label="Add one"><Icon name="plus" size={26} /></button>
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
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [sizeStr, setSizeStr] = useState('');
  const sizeLabels = sizeStr.split(',').map((s) => s.trim()).filter(Boolean);
  const sized = cat === 'merch' && sizeLabels.length > 0;
  const valid = name.trim() && price !== '' && !isNaN(+price) && +price >= 0;
  function submit() {
    onAdd({
      name: name.trim(), price: +(+price).toFixed(2), category: cat,
      quantity: +quantity || 0,
      sizes: sized ? sizeLabels.map((label) => ({ id: uid('size'), label, quantity: 0 })) : null,
    });
  }
  return (
    <Modal title={'Add ' + (cat === 'merch' ? 'merch item' : 'food item')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!valid} onClick={submit}>Add item</button></>}>
      <Field label="Item name"><input className="input lg" value={name} onChange={(e) => setName(e.target.value)} placeholder={cat === 'merch' ? 'e.g. Camp Hoodie' : 'e.g. Ice Cream'} autoFocus /></Field>
      <div className="row">
        <Field label="Price">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: 13, color: 'var(--ink-3)', fontWeight: 700 }}>$</span>
            <input className="input lg tnum" style={{ paddingLeft: 26 }} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" inputMode="decimal" />
          </div>
        </Field>
        {cat === 'merch' && !sized && <Field label="Starting count"><input className="input lg tnum" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" /></Field>}
      </div>
      {cat === 'merch' && (
        <Field label="Sizes (optional)">
          <input className="input lg" value={sizeStr} onChange={(e) => setSizeStr(e.target.value)} placeholder="e.g. S, M, L, XL — leave blank for no sizes" />
        </Field>
      )}
      <div className="muted" style={{ fontSize: 13 }}>{sized ? 'Sizes start at 0 — set each count on the board after adding.' : 'You can add a photo right after it appears on the board.'}</div>
    </Modal>
  );
}

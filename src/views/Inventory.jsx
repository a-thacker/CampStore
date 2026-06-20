/* ============ Inventory view ============ */
import React, { useState } from 'react';
import { Store } from '../lib/helpers.js';
import { Icon, Badge, Toggle, Field, Search, Modal, EmptyState } from '../components.jsx';

export function InventoryView({ db, api, toast }) {
  const [cat, setCat] = useState('merch');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // product or {new:true}

  const list = db.products.filter((p) => p.category === cat && p.name.toLowerCase().includes(q.toLowerCase()));
  const lowCount = Store.lowStock(db).length;

  async function saveProduct(prod) {
    try {
      if (prod.id) await api.updateProduct(prod.id, prod);
      else await api.addProduct(prod);
      toast(prod.id ? 'Product updated' : 'Product added');
      setEditing(null);
    } catch (e) { toast(e.message); }
  }
  async function adjustQty(p, delta) {
    try { await api.adjustStock(p.id, Math.max(0, (p.quantity || 0) + delta)); }
    catch (e) { toast(e.message); }
  }
  async function archive(p) {
    try { await api.archiveProduct(p.id); toast(p.name + ' archived'); setEditing(null); }
    catch (e) { toast(e.message); }
  }

  return (
    <div className="content-pad">
      <div className="inv-head">
        <div className="chip-tabs">
          <button className={'chip-tab' + (cat === 'merch' ? ' active' : '')} onClick={() => setCat('merch')}>Merch</button>
          <button className={'chip-tab' + (cat === 'food' ? ' active' : '')} onClick={() => setCat('food')}>Food &amp; Snacks</button>
        </div>
        <div style={{ flex: 1, maxWidth: 340 }}><Search value={q} onChange={setQ} placeholder="Search products…" /></div>
        <div style={{ flex: 1 }} />
        {lowCount > 0 && <Badge kind="low"><Icon name="alert" size={13} /> {lowCount} low stock</Badge>}
        <button className="btn primary" onClick={() => setEditing({ category: cat, trackQuantity: cat === 'merch', price: '', name: '', quantity: 0 })}>
          <Icon name="plus" size={18} /> Add product
        </button>
      </div>

      <div className="card" style={{ marginTop: 16, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Product</th>
              <th className="right">Price</th>
              {cat === 'merch' && <th className="right" style={{ width: 200 }}>In stock</th>}
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const out = p.trackQuantity && p.quantity <= 0;
              const low = p.trackQuantity && p.quantity > 0 && p.quantity <= db.settings.lowStock;
              return (
                <tr key={p.id} className={p.active ? '' : 'archived'}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700 }}>{p.name}</span>
                      {!p.active && <Badge kind="muted">Archived</Badge>}
                      {out && <Badge kind="out">Out</Badge>}
                      {low && <Badge kind="low">Low</Badge>}
                    </div>
                  </td>
                  <td className="right tnum" style={{ fontWeight: 700 }}>{Store.money(p.price)}</td>
                  {cat === 'merch' && (
                    <td className="right">
                      {p.trackQuantity ? (
                        <div className="qty-inline">
                          <button onClick={() => adjustQty(p, -1)}><Icon name="minus" size={14} /></button>
                          <span className="tnum" style={{ color: out ? 'var(--red)' : low ? 'var(--amber)' : 'var(--ink)' }}>{p.quantity}</span>
                          <button onClick={() => adjustQty(p, +1)}><Icon name="plus" size={14} /></button>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                  )}
                  <td className="right">
                    <button className="btn ghost icon sm" onClick={() => setEditing(p)}><Icon name="edit" size={17} /></button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={4}><EmptyState icon="box" title="No products" sub="Add your first product." /></td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <ProductModal product={editing} onSave={saveProduct} onArchive={editing.id ? archive : null} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProductModal({ product, onSave, onArchive, onClose }) {
  const [name, setName] = useState(product.name || '');
  const [price, setPrice] = useState(product.price === '' ? '' : String(product.price));
  const [category, setCategory] = useState(product.category || 'merch');
  const [trackQuantity, setTrack] = useState(product.trackQuantity ?? (category === 'merch'));
  const [quantity, setQuantity] = useState(String(product.quantity ?? 0));
  const isNew = !product.id;

  const valid = name.trim() && price !== '' && !isNaN(+price) && +price >= 0;

  function submit() {
    onSave({
      id: product.id, name: name.trim(), price: +(+price).toFixed(2), category,
      trackQuantity, quantity: trackQuantity ? Math.max(0, parseInt(quantity || '0')) : null,
    });
  }

  return (
    <Modal title={isNew ? 'Add product' : 'Edit product'} onClose={onClose}
      footer={
        <>
          {onArchive && <button className="btn danger" onClick={() => onArchive(product)} style={{ marginRight: 'auto' }}><Icon name="trash" size={16} /> Archive</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={!valid}>{isNew ? 'Add product' : 'Save changes'}</button>
        </>
      }>
      <Field label="Product name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Camp T-Shirt" autoFocus /></Field>
      <div className="row">
        <Field label="Price">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ink-3)', fontWeight: 700 }}>$</span>
            <input className="input tnum" style={{ paddingLeft: 24 }} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" inputMode="decimal" />
          </div>
        </Field>
        <Field label="Category">
          <select className="select" value={category} onChange={(e) => { setCategory(e.target.value); if (e.target.value === 'food') setTrack(false); }}>
            <option value="merch">Merch</option>
            <option value="food">Food &amp; Snacks</option>
          </select>
        </Field>
      </div>
      <div style={{ padding: '4px 2px' }}>
        <Toggle checked={trackQuantity} onChange={setTrack} label="Track inventory quantity" />
        <div className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.4 }}>
          {trackQuantity ? 'Stock count decreases with each sale and shows low-stock warnings.' : 'No quantity tracking — good for snacks staff may grab freely.'}
        </div>
      </div>
      {trackQuantity && (
        <Field label="Quantity in stock"><input className="input tnum" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" /></Field>
      )}
      {!isNew && (
        <div className="co-note"><Icon name="tag" size={15} /> Price changes apply to all future sales. Past transactions keep the price they were sold at.</div>
      )}
    </Modal>
  );
}

export { ProductModal };

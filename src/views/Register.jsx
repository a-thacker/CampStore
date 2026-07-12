/* ============ Register / Checkout view ============ */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Store } from '../lib/helpers.js';
import { Icon, Badge, Field, Search, Modal, Avatar, EmptyState } from '../components.jsx';
import { squareConfigured, mountCard, chargeCard } from '../lib/square.js';

export function RegisterView({ db, api, week, toast }) {
  const [cat, setCat] = useState('merch');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]); // {productId, name, category, unitPrice, qty}
  const [payerId, setPayerId] = useState(null); // camper id OR tab id
  const [memberId, setMemberId] = useState(null); // when payer is a family tab: who's at the register
  const [pickOpen, setPickOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [sizeFor, setSizeFor] = useState(null); // product awaiting a size choice

  // reset payer/cart when week changes
  useEffect(() => { setCart([]); setPayerId(null); setMemberId(null); }, [week && week.id]);

  // ----- tag sections: multi-tag, custom order, collapsible, drag-reorder -----
  const COLLAPSE_KEY = 'camp_collapsed_tags';
  const [collapsed, setCollapsed] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch (e) { return new Set(); } });
  const [drag, setDrag] = useState(null);            // tag currently being dragged
  const [indicator, setIndicator] = useState(null);  // insertion slot index
  const sectionEls = useRef({});
  const isCollapsed = (t) => collapsed.has(cat + ':' + t);
  const toggleCollapse = (t) => setCollapsed((prev) => {
    const n = new Set(prev); const k = cat + ':' + t;
    if (n.has(k)) n.delete(k); else n.add(k);
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...n])); return n;
  });
  const saveTagOrder = (order) => api.setTagOrder(order);

  const ql = q.trim().toLowerCase();
  const outSort = (a, b) => ((a.trackQuantity && a.quantity <= 0) ? 1 : 0) - ((b.trackQuantity && b.quantity <= 0) ? 1 : 0);
  const inCat = db.products.filter((p) => p.active && p.category === cat);
  const matchQ = (p) => !ql || p.name.toLowerCase().includes(ql) || (p.tags || []).some((t) => t.includes(ql));
  const allTags = [...new Set(inCat.flatMap((p) => p.tags || []))];
  const orderPref = db.settings.tagOrder || [];
  const orderedTags = [
    ...orderPref.filter((t) => allTags.includes(t)),
    ...allTags.filter((t) => !orderPref.includes(t)).sort(),
  ];
  const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const tagSections = [];
  orderedTags.forEach((t) => {
    const items = inCat.filter((p) => (p.tags || []).includes(t) && matchQ(p)).slice().sort(outSort);
    if (items.length) tagSections.push({ key: t, label: titleCase(t), items });
  });
  const untaggedItems = inCat.filter((p) => !(p.tags && p.tags.length) && matchQ(p)).slice().sort(outSort);
  const otherSection = untaggedItems.length ? { label: tagSections.length ? 'Other' : null, items: untaggedItems } : null;
  const anyVisible = tagSections.length > 0 || !!otherSection;

  // pointer-based vertical reorder: capture section midpoints once, then track
  function startDrag(e, tag) {
    e.preventDefault();
    const nodes = tagSections.map((s) => s.key);
    const mids = nodes.map((k) => { const r = sectionEls.current[k].getBoundingClientRect(); return r.top + r.height / 2; });
    const fromIndex = nodes.indexOf(tag);
    let toIndex = fromIndex;
    setDrag(tag); setIndicator(fromIndex);
    document.body.style.userSelect = 'none';
    const onMove = (ev) => {
      const y = ev.clientY; let idx = 0;
      for (let i = 0; i < mids.length; i++) { if (y > mids[i]) idx = i + 1; }
      toIndex = idx; setIndicator(idx);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      if (toIndex !== fromIndex && toIndex !== fromIndex + 1) {
        const a = nodes.slice(); const [x] = a.splice(fromIndex, 1);
        a.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, x);
        const prev = db.settings.tagOrder || [];
        saveTagOrder([...a, ...prev.filter((t) => !a.includes(t))]);
      }
      setDrag(null); setIndicator(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const renderProduct = (p) => {
    const sized = Store.isSized(p);
    const out = p.trackQuantity && p.quantity <= 0;
    const low = p.trackQuantity && p.quantity > 0 && p.quantity <= db.settings.lowStock;
    return (
      <button key={p.id} className={'prod has-photo' + (out ? ' out' : '')} onClick={() => onProductClick(p)} disabled={out}>
        <div className={'prod-thumb' + (p.image ? '' : ' empty')}>
          {p.image ? <img src={p.image} alt="" /> : <Icon name="image" size={26} />}
        </div>
        <div className="prod-top">
          <span className="prod-name">{p.name}</span>
          {out ? <Badge kind="out">Out</Badge> : low ? <Badge kind="low">{p.quantity} left</Badge> : sized ? <Badge kind="muted">Sizes</Badge> : null}
        </div>
        <div className="prod-bottom">
          <span className="prod-price tnum">{Store.money(p.price)}</span>
          {p.trackQuantity && !out && !low && <span className="prod-stock tnum">{p.quantity} in stock</span>}
          {!p.trackQuantity && <span className="prod-stock">snack</span>}
        </div>
      </button>
    );
  };

  const campers = Store.weekCampers(db, week.id);
  const tabs = Store.weekTabs(db, week.id);
  const payer = useMemo(() => {
    if (!payerId) return null;
    const c = campers.find((x) => x.id === payerId);
    if (c) return { kind: 'camper', ...c };
    const t = tabs.find((x) => x.id === payerId);
    if (t) return { kind: 'tab', ...t };
    return null;
  }, [payerId, db]);
  const familyMembers = payer && payer.kind === 'tab' ? campers.filter((c) => c.tabId === payer.id) : [];
  const activeMember = memberId ? familyMembers.find((m) => m.id === memberId) : null;
  const memberBlocked = !!(activeMember && !activeMember.allowPurchase);

  function onProductClick(p) {
    if (Store.isSized(p)) { setSizeFor(p); return; }
    add(p);
  }
  function add(p, size) {
    const avail = !p.trackQuantity ? Infinity : (size ? size.quantity : p.quantity);
    if (p.trackQuantity && avail <= 0) { toast(p.name + (size ? ' (' + size.label + ')' : '') + ' is out of stock'); return; }
    const key = p.id + '|' + (size ? size.id : '');
    setCart((c) => {
      const ex = c.find((l) => l.key === key);
      if (ex) {
        if (p.trackQuantity && ex.qty >= avail) { toast('Only ' + avail + ' in stock' + (size ? ' · ' + size.label : '')); return c; }
        return c.map((l) => l.key === key ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...c, { key, productId: p.id, sizeId: size ? size.id : null, sizeLabel: size ? size.label : null, name: p.name, category: p.category, unitPrice: p.price, qty: 1, trackQuantity: p.trackQuantity }];
    });
  }
  function setQty(key, d) {
    setCart((c) => c.map((l) => l.key === key ? { ...l, qty: Math.max(0, l.qty + d) } : l).filter((l) => l.qty > 0));
  }
  function removeLine(key) { setCart((c) => c.filter((l) => l.key !== key)); }

  const subtotal = +cart.reduce((s, l) => s + l.unitPrice * l.qty, 0).toFixed(2);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="reg">
      {/* catalog */}
      <div className="reg-catalog">
        <div className="reg-catalog-bar">
          <div className="chip-tabs">
            <button className={'chip-tab' + (cat === 'merch' ? ' active' : '')} onClick={() => setCat('merch')}>Merch</button>
            <button className={'chip-tab' + (cat === 'food' ? ' active' : '')} onClick={() => setCat('food')}>Food &amp; Snacks</button>
          </div>
          <Search value={q} onChange={setQ} placeholder={'Search ' + (cat === 'merch' ? 'merch' : 'snacks') + '…'} />
        </div>
        {!anyVisible ? (
          <EmptyState icon="search" title="No products found" sub="Try a different search." />
        ) : (
          <>
            {tagSections.map((sec, di) => {
              const collapsedSec = isCollapsed(sec.key);
              return (
                <React.Fragment key={sec.key}>
                  {drag && indicator === di && <div className="prod-drop-line" />}
                  <div className={'prod-section' + (collapsedSec ? ' collapsed' : '') + (drag === sec.key ? ' dragging' : '')}
                    ref={(el) => { sectionEls.current[sec.key] = el; }}>
                    <div className="prod-section-head">
                      <button className="prod-section-toggle" onClick={() => toggleCollapse(sec.key)}>
                        <span className={'sec-chev' + (collapsedSec ? ' closed' : '')}><Icon name="chevron" size={15} /></span>
                        <span>{sec.label}</span>
                        <span className="prod-section-count">{sec.items.length}</span>
                      </button>
                      <span className="prod-section-grip" onPointerDown={(e) => startDrag(e, sec.key)} title="Drag to reorder">
                        <Icon name="grip" size={16} stroke={2.5} />
                      </span>
                    </div>
                    {!collapsedSec && <div className="prod-grid">{sec.items.map(renderProduct)}</div>}
                  </div>
                </React.Fragment>
              );
            })}
            {drag && indicator === tagSections.length && <div className="prod-drop-line" />}
            {otherSection && (
              <div className="prod-section">
                {otherSection.label && (
                  <div className="prod-section-head">
                    <span className="prod-section-toggle" style={{ cursor: 'default' }}>
                      <span>{otherSection.label}</span>
                      <span className="prod-section-count">{otherSection.items.length}</span>
                    </span>
                  </div>
                )}
                <div className="prod-grid">{otherSection.items.map(renderProduct)}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* cart */}
      <div className="reg-cart card">
        <div className="cart-payer">
          {payer ? (
            <div className="payer-row" onClick={() => setPickOpen(true)}>
              <Avatar name={payer.kind === 'tab' ? payer.name : payer.first + ' ' + payer.last} tab={payer.kind === 'tab'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="payer-name">
                  {payer.kind === 'tab' ? payer.name : payer.first + ' ' + payer.last}
                  {payer.kind === 'tab' && <Badge kind="tab">{payer.mode === 'prepaid' ? 'Family · Prepaid' : 'Family Tab'}</Badge>}
                </div>
                <div className="payer-meta tnum">
                  {payer.kind === 'tab'
                    ? (payer.mode === 'prepaid' ? 'Balance: ' : 'Owed: ') + Store.money(payer.balance)
                    : 'Balance: ' + Store.money(payer.balance) + '  ·  ' + (payer.cabin || 'No cabin')}
                </div>
              </div>
              <button className="btn ghost icon"><Icon name="chevron" size={18} /></button>
            </div>
          ) : (
            <button className="payer-empty" onClick={() => setPickOpen(true)}>
              <Icon name="user" size={19} />
              <span>Select camper or family</span>
              <Icon name="chevron" size={18} />
            </button>
          )}
          {payer && payer.kind === 'tab' && familyMembers.length > 0 && (
            <div className="payer-members">
              <button className={'payer-member-chip' + (!memberId ? ' active' : '')} onClick={() => setMemberId(null)}>Anyone in family</button>
              {familyMembers.map((m) => (
                <button key={m.id} className={'payer-member-chip' + (memberId === m.id ? ' active' : '')} onClick={() => setMemberId(m.id)}>
                  {m.first} {!m.allowPurchase && <Icon name="alert" size={12} />}
                </button>
              ))}
            </div>
          )}
          {payer && payer.kind === 'camper' && payer.cashedOut && (
            <div className="payer-warn"><Icon name="alert" size={15} /> This camper has been cashed out — account closed</div>
          )}
          {payer && payer.kind === 'camper' && !payer.cashedOut && !payer.allowPurchase && (
            <div className="payer-warn"><Icon name="alert" size={15} /> Purchases are paused for this camper</div>
          )}
          {memberBlocked && (
            <div className="payer-warn"><Icon name="alert" size={15} /> Purchases are paused for {activeMember.first}</div>
          )}
        </div>

        <div className="cart-lines">
          {cart.length === 0 ? (
            <EmptyState icon="register" title="Cart is empty" sub="Tap products to add them." />
          ) : cart.map((l) => (
            <div key={l.key} className="cart-line">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cart-line-name">{l.name}{l.sizeLabel && <span className="cart-line-size">{l.sizeLabel}</span>}</div>
                <div className="cart-line-price tnum muted">{Store.money(l.unitPrice)} each</div>
              </div>
              <div className="qty-ctrl">
                <button onClick={() => setQty(l.key, -1)}><Icon name="minus" size={15} /></button>
                <span className="tnum">{l.qty}</span>
                <button onClick={() => setQty(l.key, +1)}><Icon name="plus" size={15} /></button>
              </div>
              <div className="cart-line-total tnum">{Store.money(l.unitPrice * l.qty)}</div>
            </div>
          ))}
        </div>

        <div className="cart-foot">
          <div className="cart-total-row">
            <span>Total <span className="muted tnum" style={{ fontWeight: 600 }}>· {count} item{count !== 1 ? 's' : ''}</span></span>
            <span className="tnum">{Store.money(subtotal)}</span>
          </div>
          <button className="btn primary lg block" disabled={cart.length === 0 || !payer || (payer.kind === 'camper' && !payer.allowPurchase) || memberBlocked}
            onClick={() => setCheckout(true)}>
            <Icon name="check" size={20} /> Charge {Store.money(subtotal)}
          </button>
        </div>
      </div>

      {pickOpen && (
        <PayerPicker db={db} week={week} onPick={(id) => { setPayerId(id); setMemberId(null); setPickOpen(false); }} onClose={() => setPickOpen(false)} />
      )}
      {sizeFor && (
        <SizePicker product={sizeFor} onPick={(z) => { add(sizeFor, z); setSizeFor(null); }} onClose={() => setSizeFor(null)} />
      )}
      {checkout && payer && (
        <CheckoutModal db={db} api={api} week={week} payer={payer} member={activeMember} cart={cart} subtotal={subtotal} toast={toast}
          onClose={() => setCheckout(false)}
          onDone={() => { setCheckout(false); setCart([]); toast('Sale complete'); }} />
      )}
    </div>
  );
}

/* ---- size picker ---- */
function SizePicker({ product, onPick, onClose }) {
  return (
    <Modal title={product.name + ' · pick a size'} onClose={onClose}>
      <div className="size-pick-grid">
        {product.sizes.map((z) => {
          const out = z.quantity <= 0;
          return (
            <button key={z.id} className={'size-pick' + (out ? ' out' : '')} disabled={out} onClick={() => onPick(z)}>
              <span className="size-pick-label">{z.label}</span>
              <span className="size-pick-qty tnum">{out ? 'Out' : z.quantity + ' left'}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/* ---- account picker ---- */
function PayerPicker({ db, week, onPick, onClose }) {
  const [q, setQ] = useState('');
  const campers = Store.weekCampers(db, week.id).filter((c) => !c.tabId);
  const tabs = Store.weekTabs(db, week.id);
  const ql = q.toLowerCase();
  const fc = campers.filter((c) => (c.first + ' ' + c.last + ' ' + (c.cabin || '')).toLowerCase().includes(ql));
  const ft = tabs.filter((t) => t.name.toLowerCase().includes(ql));
  return (
    <Modal title="Select account" onClose={onClose}>
      <Search value={q} onChange={setQ} placeholder="Search by name or cabin…" autoFocus />
      <div style={{ maxHeight: 380, overflowY: 'auto', margin: '0 -4px' }}>
        {week.type === 'family' && ft.length > 0 && (
          <>
            <div className="pick-group">Families</div>
            {ft.map((t) => (
              <button key={t.id} className="pick-row" onClick={() => onPick(t.id)}>
                <Avatar name={t.name} tab />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pick-name">{t.name}</div>
                  <div className="pick-meta tnum muted">{t.mode === 'prepaid' ? 'Balance' : 'Owed'} {Store.money(t.balance)}</div>
                </div>
                <Badge kind="tab">{t.mode === 'prepaid' ? 'Prepaid' : 'Tab'}</Badge>
              </button>
            ))}
            <div className="pick-group">Individuals</div>
          </>
        )}
        {fc.map((c) => (
          <button key={c.id} className="pick-row" onClick={() => onPick(c.id)} disabled={!c.allowPurchase}>
            <Avatar name={c.first + ' ' + c.last} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pick-name">{c.first} {c.last} {c.cashedOut ? <Badge kind="out">Cashed out</Badge> : !c.allowPurchase && <Badge kind="muted">Paused</Badge>}</div>
              <div className="pick-meta tnum muted">Balance {Store.money(c.balance)} · {c.cabin || 'No cabin'} · Age {c.age}</div>
            </div>
          </button>
        ))}
        {fc.length === 0 && ft.length === 0 && <EmptyState icon="users" title="No matches" />}
      </div>
    </Modal>
  );
}

/* ---- checkout ---- */
function CheckoutModal({ db, api, week, payer, member, cart, subtotal, toast, onClose, onDone }) {
  const isTab = payer.kind === 'tab';
  const prepaid = isTab && payer.mode === 'prepaid';
  const [method, setMethod] = useState(isTab ? 'tab' : 'balance');
  const [processing, setProcessing] = useState(false);
  const cardRef = useRef(null);       // DOM node for Square card form
  const cardInst = useRef(null);      // Square card instance
  const [cardReady, setCardReady] = useState(false);
  const hasSquare = squareConfigured();

  const bal = payer.balance || 0;
  const afterBal = +(bal - subtotal).toFixed(2);
  const overBalance = ((!isTab && method === 'balance') || (prepaid && method === 'tab')) && afterBal < 0;
  const blockedOver = overBalance && !payer.allowOverBalance;

  const methods = isTab
    ? [['tab', prepaid ? 'Family Balance' : 'Add to Tab', prepaid ? 'wallet' : 'tab'], ['cash', 'Cash', 'cash'], ['card', 'Card', 'card']]
    : [['balance', 'Prepaid Balance', 'wallet'], ['cash', 'Cash', 'cash'], ['card', 'Card', 'card']];

  // mount / tear down the Square card form when 'card' is selected
  useEffect(() => {
    let cancelled = false;
    if (method === 'card' && hasSquare && cardRef.current && !cardInst.current) {
      mountCard(cardRef.current)
        .then((card) => { if (!cancelled) { cardInst.current = card; setCardReady(true); } })
        .catch((e) => toast(e.message));
    }
    return () => {
      cancelled = true;
      if (method !== 'card' && cardInst.current) {
        cardInst.current.destroy?.();
        cardInst.current = null;
        setCardReady(false);
      }
    };
  }, [method, hasSquare]);

  async function confirm() {
    setProcessing(true);
    try {
      let squarePaymentId = null;
      if (method === 'card') {
        if (!hasSquare) throw new Error('Square is not configured');
        if (!cardInst.current) throw new Error('Card form not ready');
        const note = (isTab ? payer.name : payer.first + ' ' + payer.last) + ' · ' + week.name;
        ({ paymentId: squarePaymentId } = await chargeCard(cardInst.current, { cart, note }));
      }
      await api.recordSale({
        weekId: week.id, payerType: payer.kind, payerId: payer.id,
        items: cart, method, squarePaymentId, memberId: isTab && member ? member.id : null,
      });
      onDone();
    } catch (e) {
      toast(e.message);
      setProcessing(false);
    }
  }

  const footer = (
    <>
      <button className="btn" onClick={onClose} disabled={processing}>Cancel</button>
      <button className="btn primary" onClick={confirm} disabled={blockedOver || processing || (method === 'card' && hasSquare && !cardReady)}>
        {processing ? 'Processing…' : isTab && method === 'tab' && !prepaid ? 'Add to Tab' : 'Complete Sale'}
      </button>
    </>
  );

  return (
    <Modal title="Checkout" onClose={processing ? () => {} : onClose} footer={footer}>
      <div className="co-summary">
        <div className="co-payer">
          <Avatar name={isTab ? payer.name : payer.first + ' ' + payer.last} tab={isTab} />
          <div>
            <div style={{ fontWeight: 700 }}>{isTab ? payer.name : payer.first + ' ' + payer.last}{isTab && member ? ' · for ' + member.first : ''}</div>
            <div className="muted tnum" style={{ fontSize: 13 }}>
              {isTab ? (prepaid ? 'Current balance ' : 'Current tab ') + Store.money(payer.balance) : 'Balance ' + Store.money(bal)}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Total</div>
            <div className="tnum" style={{ fontSize: 24, fontWeight: 800 }}>{Store.money(subtotal)}</div>
          </div>
        </div>
      </div>

      <Field label="Payment method">
        <div className="pay-methods">
          {methods.map(([m, label, icon]) => (
            <button key={m} className={'pay-method' + (method === m ? ' active' : '')} onClick={() => setMethod(m)}>
              <Icon name={icon} size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </Field>

      {method === 'balance' && !isTab && (
        <div className={'co-note' + (blockedOver ? ' err' : overBalance ? ' warn' : '')}>
          {blockedOver ? (
            <><Icon name="alert" size={16} /> Insufficient balance. This camper isn’t allowed to go over balance — use cash or card, or load more funds.</>
          ) : overBalance ? (
            <><Icon name="alert" size={16} /> Balance will go negative to <b className="tnum">{Store.money(afterBal)}</b> (over-balance allowed).</>
          ) : (
            <><Icon name="wallet" size={16} /> New balance after sale: <b className="tnum">{Store.money(afterBal)}</b></>
          )}
        </div>
      )}
      {method === 'tab' && !prepaid && (
        <div className="co-note"><Icon name="tab" size={16} /> Tab will increase to <b className="tnum">{Store.money(payer.balance + subtotal)}</b>, settled at end of week.</div>
      )}
      {method === 'tab' && prepaid && (
        <div className={'co-note' + (blockedOver ? ' err' : overBalance ? ' warn' : '')}>
          {blockedOver ? (
            <><Icon name="alert" size={16} /> Insufficient family balance. This family isn’t allowed to go over balance — use cash or card, or load more funds.</>
          ) : overBalance ? (
            <><Icon name="alert" size={16} /> Family balance will go negative to <b className="tnum">{Store.money(afterBal)}</b> (over-balance allowed).</>
          ) : (
            <><Icon name="wallet" size={16} /> New family balance after sale: <b className="tnum">{Store.money(afterBal)}</b></>
          )}
        </div>
      )}
      {method === 'card' && (
        <div className="co-note" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="card" size={16} /> <span>Card is processed securely through <b>Square</b>.</span>
          </div>
          {hasSquare
            ? <div ref={cardRef} className="sq-card" />
            : <div className="muted" style={{ fontSize: 13 }}>Set <code>VITE_SQUARE_APP_ID</code> and <code>VITE_SQUARE_LOCATION_ID</code> in your environment to enable card entry.</div>}
        </div>
      )}
      {method === 'cash' && (
        <div className="co-note"><Icon name="cash" size={16} /> Recorded as a cash sale.</div>
      )}
    </Modal>
  );
}

export { PayerPicker, CheckoutModal };

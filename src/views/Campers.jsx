/* ============ Campers + Family Tabs view ============ */
import React, { useState, useMemo } from 'react';
import { Store } from '../lib/helpers.js';
import { Icon, Badge, Toggle, Field, Search, Modal, Avatar, EmptyState } from '../components.jsx';

export function CampersView({ db, api, week, toast }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [tabModal, setTabModal] = useState(null);
  const [loadFor, setLoadFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [cashOutFor, setCashOutFor] = useState(null);

  const campers = Store.weekCampers(db, week.id);
  const tabs = Store.weekTabs(db, week.id);
  const ql = q.toLowerCase();
  const filtered = campers.filter((c) => (c.first + ' ' + c.last + ' ' + (c.cabin || '')).toLowerCase().includes(ql));
  const wrap = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message); } };

  async function saveCamper(c) {
    await wrap(() => (c.id ? api.updateCamper(c.id, c) : api.addCamper(week.id, c)), c.id ? 'Camper updated' : 'Camper added');
    setEditing(null);
  }
  async function deleteCamper(c) {
    await wrap(() => api.deleteCamper(c.id), 'Camper removed'); setEditing(null);
  }
  async function loadBalance(c, amount) {
    await wrap(() => api.loadBalance(c.id, amount),
      Store.money(amount) + (amount < 0 ? ' adjusted on ' : ' added to ') + c.first + '’s balance');
    setLoadFor(null);
  }
  async function returnTransaction(txn) {
    await wrap(() => api.processReturn(txn.id), 'Returned — ' + Store.money(txn.total) + ' refunded');
  }
  async function cashOut(camper) {
    await wrap(() => api.cashOut(camper.id), camper.first + ' cashed out');
    setCashOutFor(null);
  }
  async function reopenCamper(c) {
    await wrap(() => api.reopenCamper(c.id), c.first + '’s account reopened');
  }
  async function bulkAdd(rows) {
    await wrap(() => api.bulkAddCampers(week.id, rows), rows.length + ' campers added');
    setBulk(false);
  }
  async function saveTab(t) {
    await wrap(() => api.saveTab({ id: t.id, name: t.name, members: t.members, weekId: week.id }),
      t.id ? 'Tab updated' : 'Family tab created');
    setTabModal(null);
  }
  async function settleTab(t) {
    await wrap(() => api.settleTab(t.id), t.name + ' tab settled');
  }

  return (
    <div className="content-pad">
      <div className="inv-head">
        <div style={{ flex: 1, maxWidth: 360 }}><Search value={q} onChange={setQ} placeholder="Search campers or cabins…" /></div>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontWeight: 700, fontSize: 13 }}>{campers.length} campers</span>
        <button className="btn" onClick={() => setBulk(true)}><Icon name="users" size={17} /> Bulk add</button>
        {week.type === 'family' && <button className="btn" onClick={() => setTabModal({ name: '', members: [] })}><Icon name="tab" size={17} /> New tab</button>}
        <button className="btn primary" onClick={() => setEditing({ first: '', last: '', age: '', cabin: '', allowPurchase: true, allowOverBalance: false, notes: '' })}>
          <Icon name="plus" size={18} /> Add camper
        </button>
      </div>

      {/* family tabs */}
      {week.type === 'family' && tabs.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="section-label">Family Tabs</div>
          <div className="tab-grid">
            {tabs.map((t) => {
              const members = campers.filter((c) => c.tabId === t.id);
              return (
                <div key={t.id} className="card tab-card">
                  <div className="tab-card-h">
                    <Avatar name={t.name} tab />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{t.name}</div>
                      <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{members.length} members</div>
                    </div>
                    <button className="btn ghost icon sm" onClick={() => setTabModal({ id: t.id, name: t.name, members: members.map((m) => m.id) })}><Icon name="edit" size={16} /></button>
                  </div>
                  <div className="tab-members">
                    {members.map((m) => <span key={m.id} className="member-chip">{m.first} {m.last}</span>)}
                    {members.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No members yet</span>}
                  </div>
                  <div className="tab-card-f">
                    <div>
                      <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>Tab owed</div>
                      <div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: t.settled ? 'var(--green-600)' : t.balance > 0 ? 'var(--ink)' : 'var(--ink-3)' }}>{Store.money(t.balance)}</div>
                    </div>
                    {t.settled ? <Badge kind="ok"><Icon name="check" size={13} /> Settled</Badge>
                      : <button className="btn dark sm" disabled={t.balance <= 0} onClick={() => settleTab(t)}>Settle tab</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* campers */}
      <div style={{ marginTop: 18 }}>
        {week.type === 'family' && <div className="section-label">All Individuals</div>}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Camper</th><th>Cabin</th><th className="right">Age</th>
                <th className="right">Balance</th><th>Status</th><th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const tab = c.tabId ? tabs.find((t) => t.id === c.tabId) : null;
                return (
                  <tr key={c.id} className={'clickable' + (c.cashedOut ? ' archived' : '')} onClick={() => setEditing(c)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <Avatar name={c.first + ' ' + c.last} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.first} {c.last}</div>
                          {c.notes && <div className="muted" style={{ fontSize: 12 }}>{c.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{c.cabin || <span className="muted">—</span>}</td>
                    <td className="right tnum">{c.age || '—'}</td>
                    <td className="right tnum" style={{ fontWeight: 700, color: c.balance < 0 ? 'var(--red)' : 'var(--ink)' }}>
                      {tab ? <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>on tab</span> : Store.money(c.balance)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.cashedOut && <Badge kind="out">Cashed out</Badge>}
                        {!c.cashedOut && !c.allowPurchase && <Badge kind="muted">Paused</Badge>}
                        {!c.cashedOut && c.allowOverBalance && <Badge kind="ok">Over-balance OK</Badge>}
                        {tab && <Badge kind="tab">{tab.name.replace('The ', '')}</Badge>}
                      </div>
                    </td>
                    <td className="right" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => setHistoryFor(c)} title="Purchase history"><Icon name="receipt" size={16} /></button>
                        {!c.tabId && !c.cashedOut && <button className="btn ghost sm" onClick={() => setLoadFor(c)} title="Load balance"><Icon name="wallet" size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={6}><EmptyState icon="users" title="No campers yet" sub="Add campers individually or paste a roster." action={<button className="btn primary" onClick={() => setEditing({ first: '', last: '', age: '', cabin: '', allowPurchase: true, allowOverBalance: false, notes: '' })}><Icon name="plus" size={17} /> Add camper</button>} /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <CamperModal camper={editing} week={week} onSave={saveCamper} onDelete={editing.id ? deleteCamper : null}
        onClose={() => setEditing(null)}
        onHistory={editing.id ? () => { const c = editing; setEditing(null); setHistoryFor(c); } : null}
        onCashOut={editing.id && !editing.tabId && !editing.cashedOut ? () => { const c = editing; setEditing(null); setCashOutFor(c); } : null}
        onReopen={editing.cashedOut ? () => { reopenCamper(editing); setEditing(null); } : null} />}
      {bulk && <BulkModal onAdd={bulkAdd} onClose={() => setBulk(false)} />}
      {tabModal && <TabModal tab={tabModal} campers={campers} onSave={saveTab} onClose={() => setTabModal(null)} />}
      {loadFor && <LoadBalanceModal camper={loadFor} onLoad={loadBalance} onClose={() => setLoadFor(null)} />}
      {historyFor && <HistoryModal db={db} camper={historyFor} onReturn={returnTransaction}
        onLoad={() => { const c = historyFor; setHistoryFor(null); setLoadFor(c); }}
        onCashOut={!historyFor.tabId && !historyFor.cashedOut ? () => { const c = historyFor; setHistoryFor(null); setCashOutFor(c); } : null}
        onClose={() => setHistoryFor(null)} />}
      {cashOutFor && <CashOutModal camper={cashOutFor} onConfirm={cashOut} onClose={() => setCashOutFor(null)} />}
    </div>
  );
}

function CamperModal({ camper, week, onSave, onDelete, onClose, onHistory, onCashOut, onReopen }) {
  const [f, setF] = useState({
    first: camper.first || '', last: camper.last || '', age: camper.age ?? '',
    cabin: camper.cabin || '', notes: camper.notes || '',
    allowPurchase: camper.allowPurchase !== false, allowOverBalance: !!camper.allowOverBalance,
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.first.trim() && f.last.trim();
  const isNew = !camper.id;

  function submit() {
    onSave({ id: camper.id, first: f.first.trim(), last: f.last.trim(),
      age: f.age === '' ? null : parseInt(f.age), cabin: f.cabin.trim(),
      notes: f.notes.trim(), allowPurchase: f.allowPurchase, allowOverBalance: f.allowOverBalance });
  }

  return (
    <Modal title={isNew ? 'Add camper' : f.first + ' ' + f.last} onClose={onClose}
      footer={
        <>
          {onDelete && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(camper)}><Icon name="trash" size={16} /> Remove</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={!valid}>{isNew ? 'Add camper' : 'Save'}</button>
        </>
      }>
      {!isNew && (
        <div className="camper-actions">
          {onHistory && <button className="btn sm" onClick={onHistory}><Icon name="receipt" size={16} /> Purchase history</button>}
          {onCashOut && <button className="btn sm" onClick={onCashOut}><Icon name="cash" size={16} /> Cash out</button>}
          {onReopen && <button className="btn sm" onClick={onReopen}><Icon name="check" size={16} /> Reopen account</button>}
        </div>
      )}
      {camper.cashedOut && (
        <div className="co-note warn"><Icon name="alert" size={15} /> This account was cashed out{camper.cashedOutAt ? ' on ' + new Date(camper.cashedOutAt).toLocaleDateString() : ''} and is closed to purchases.</div>
      )}
      <div className="row">
        <Field label="First name"><input className="input" value={f.first} onChange={(e) => set('first', e.target.value)} autoFocus /></Field>
        <Field label="Last name"><input className="input" value={f.last} onChange={(e) => set('last', e.target.value)} /></Field>
      </div>
      <div className="row">
        <Field label="Age"><input className="input tnum" value={f.age} onChange={(e) => set('age', e.target.value)} inputMode="numeric" placeholder="—" /></Field>
        <Field label="Cabin"><input className="input" value={f.cabin} onChange={(e) => set('cabin', e.target.value)} placeholder="e.g. Cedar" /></Field>
      </div>
      <Field label="Notes / allergies"><textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Peanut allergy, spending limits, etc." /></Field>
      <div className="divider" />
      <div className="perm-row">
        <div><div style={{ fontWeight: 700, fontSize: 14 }}>Allowed to make purchases</div><div className="muted" style={{ fontSize: 12.5 }}>Turn off to pause all spending</div></div>
        <Toggle checked={f.allowPurchase} onChange={(v) => set('allowPurchase', v)} />
      </div>
      <div className="perm-row">
        <div><div style={{ fontWeight: 700, fontSize: 14 }}>Allowed to go over balance</div><div className="muted" style={{ fontSize: 12.5 }}>Permit balance to go negative</div></div>
        <Toggle checked={f.allowOverBalance} onChange={(v) => set('allowOverBalance', v)} />
      </div>
      {!isNew && camper.tabId == null && (
        <div className="co-note"><Icon name="wallet" size={15} /> Current prepaid balance: <b className="tnum">{Store.money(camper.balance)}</b>. Use the wallet button on the roster to load funds.</div>
      )}
    </Modal>
  );
}

function LoadBalanceModal({ camper, onLoad, onClose }) {
  const [amt, setAmt] = useState('');
  const presets = [10, 20, 25, 50];
  const valid = amt !== '' && !isNaN(+amt) && +amt !== 0;
  return (
    <Modal title={'Load balance · ' + camper.first + ' ' + camper.last} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!valid} onClick={() => onLoad(camper, +(+amt).toFixed(2))}>Add {valid ? Store.money(+amt) : 'funds'}</button></>}>
      <div className="co-note"><Icon name="wallet" size={15} /> Current balance: <b className="tnum">{Store.money(camper.balance)}</b></div>
      <Field label="Amount to add" help="Use a negative amount to correct or refund. Loading funds is recorded as a deposit, not a sale.">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 13, top: 13, color: 'var(--ink-3)', fontWeight: 700 }}>$</span>
          <input className="input lg tnum" style={{ paddingLeft: 26 }} value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" inputMode="decimal" autoFocus />
        </div>
      </Field>
      <div style={{ display: 'flex', gap: 8 }}>
        {presets.map((p) => <button key={p} className="btn" style={{ flex: 1 }} onClick={() => setAmt(String(p))}>${p}</button>)}
      </div>
    </Modal>
  );
}

function BulkModal({ onAdd, onClose }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => {
    return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(/[,\t]/).map((s) => s.trim());
      const nameParts = (parts[0] || '').split(/\s+/);
      const first = nameParts[0] || '';
      const last = nameParts.slice(1).join(' ') || '';
      const age = parts[1] && !isNaN(+parts[1]) ? parseInt(parts[1]) : null;
      const cabin = parts[2] || '';
      return { first, last, age, cabin };
    }).filter((r) => r.first);
  }, [text]);
  return (
    <Modal title="Bulk add campers" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={parsed.length === 0} onClick={() => onAdd(parsed)}>Add {parsed.length} camper{parsed.length !== 1 ? 's' : ''}</button></>}>
      <Field label="Paste roster — one camper per line" help="Format: Name, Age, Cabin (comma or tab separated). Age and cabin are optional. Works with pasted spreadsheet columns.">
        <textarea className="textarea" style={{ minHeight: 160, fontFamily: 'inherit' }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'First Last, Age, Cabin\nMason Reyes, 10, Cedar\nAva Thompson, 9, Birch\nLiam Nguyen'} autoFocus />
      </Field>
      {parsed.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="section-label" style={{ padding: '10px 14px 4px' }}>Preview · {parsed.length}</div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            <table className="tbl">
              <tbody>
                {parsed.slice(0, 50).map((r, i) => (
                  <tr key={i}><td style={{ fontWeight: 700 }}>{r.first} {r.last}</td><td className="tnum">{r.age || '—'}</td><td>{r.cabin || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TabModal({ tab, campers, onSave, onClose }) {
  const [name, setName] = useState(tab.name || '');
  const [members, setMembers] = useState(tab.members || []);
  const toggle = (id) => setMembers((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);
  const available = campers.filter((c) => !c.tabId || tab.members.includes(c.id));
  return (
    <Modal title={tab.id ? 'Edit family tab' : 'New family tab'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!name.trim()} onClick={() => onSave({ id: tab.id, name: name.trim(), members })}>{tab.id ? 'Save tab' : 'Create tab'}</button></>}>
      <Field label="Family / tab name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Johnson Family" autoFocus /></Field>
      <Field label="Members">
        <div className="card" style={{ maxHeight: 240, overflowY: 'auto' }}>
          {available.map((c) => (
            <button key={c.id} className="pick-row" onClick={() => toggle(c.id)} style={{ borderRadius: 0 }}>
              <div className={'checkbox' + (members.includes(c.id) ? ' on' : '')}>{members.includes(c.id) && <Icon name="check" size={13} />}</div>
              <Avatar name={c.first + ' ' + c.last} />
              <div style={{ flex: 1 }}><div className="pick-name">{c.first} {c.last}</div><div className="pick-meta muted">Age {c.age || '—'} · {c.cabin || 'No cabin'}</div></div>
            </button>
          ))}
          {available.length === 0 && <div className="muted" style={{ padding: 16, textAlign: 'center', fontSize: 13 }}>No available campers. Add campers first.</div>}
        </div>
      </Field>
    </Modal>
  );
}

/* ---- Purchase history + returns ---- */
function HistoryModal({ db, camper, onReturn, onLoad, onCashOut, onClose }) {
  const ledger = Store.ledgerFor(db, 'camper', camper.id);
  const spent = Store.camperSpent(db, camper.id);
  const methodLabel = { balance: 'Balance', cash: 'Cash', card: 'Card', tab: 'Tab', deposit: 'Deposit' };
  const kindMeta = {
    sale: { label: 'Purchase', cls: 'merch' },
    return: { label: 'Return', cls: 'out' },
    deposit: { label: 'Balance loaded', cls: 'ok' },
    cashout: { label: 'Cashed out', cls: 'muted' },
  };
  return (
    <Modal title={'History · ' + camper.first + ' ' + camper.last} wide onClose={onClose}
      footer={
        <>
          {!camper.tabId && !camper.cashedOut && <button className="btn" style={{ marginRight: 'auto' }} onClick={onLoad}><Icon name="wallet" size={16} /> Load balance</button>}
          {onCashOut && <button className="btn dark" onClick={onCashOut}><Icon name="cash" size={16} /> Cash out</button>}
          <button className="btn primary" onClick={onClose}>Done</button>
        </>
      }>
      <div className="hist-summary">
        <div><div className="stat-label">Net spent</div><div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{Store.money(spent)}</div></div>
        {!camper.tabId && <div><div className="stat-label">Balance</div><div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: camper.balance < 0 ? 'var(--red)' : 'var(--ink)' }}>{Store.money(camper.balance)}</div></div>}
        <div><div className="stat-label">Transactions</div><div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{ledger.length}</div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 380, overflowY: 'auto', margin: '0 -2px' }}>
        {ledger.length === 0 && <EmptyState icon="receipt" title="No activity yet" sub="Purchases and deposits will show here." />}
        {ledger.map((t) => {
          const meta = kindMeta[t.kind] || kindMeta.sale;
          const canReturn = t.kind === 'sale' && !t.returned;
          return (
            <div key={t.id} className={'hist-row' + (t.returned ? ' returned' : '')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge kind={meta.cls}>{meta.label}</Badge>
                  {t.returned && <Badge kind="muted">Refunded</Badge>}
                  <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{new Date(t.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {methodLabel[t.method] || t.method}</span>
                </div>
                {t.items.length > 0 && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {t.items.map((l) => Math.abs(l.qty) + '× ' + l.name + (l.sizeLabel ? ' (' + l.sizeLabel + ')' : '')).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="tnum" style={{ fontWeight: 800, fontSize: 15, color: t.total < 0 ? 'var(--red)' : t.kind === 'deposit' ? 'var(--green-600)' : 'var(--ink)' }}>
                  {t.total < 0 ? '−' : t.kind === 'deposit' ? '+' : ''}{Store.money(Math.abs(t.total))}
                </span>
                {canReturn && <button className="btn sm danger" onClick={() => { if (confirm('Return this purchase? Items are restocked and ' + Store.money(t.total) + ' is refunded to ' + methodLabel[t.method] + '.')) onReturn(t, camper); }}>Return</button>}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ---- Cash out ---- */
function CashOutModal({ camper, onConfirm, onClose }) {
  const balance = camper.balance || 0;
  const owes = balance < 0;
  return (
    <Modal title={'Cash out · ' + camper.first + ' ' + camper.last} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn dark" onClick={() => onConfirm(camper, +balance.toFixed(2))}><Icon name="cash" size={16} /> Confirm cash out</button></>}>
      <div className={'co-note' + (owes ? ' err' : '')}>
        <Icon name={owes ? 'alert' : 'cash'} size={16} />
        {owes
          ? <span>This camper’s balance is negative. Collect <b className="tnum">{Store.money(Math.abs(balance))}</b> before closing the account.</span>
          : balance > 0
            ? <span>Return <b className="tnum">{Store.money(balance)}</b> of remaining balance to the camper.</span>
            : <span>Balance is <b className="tnum">$0.00</b> — nothing to return.</span>}
      </div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
        Cashing out sets the balance to <b>$0.00</b>, records a cash-out in their history, and <b>closes the account to further purchases</b> for the rest of the week. You can reopen it later from the camper’s details.
      </div>
    </Modal>
  );
}

export { CamperModal, LoadBalanceModal, BulkModal, TabModal, HistoryModal, CashOutModal };

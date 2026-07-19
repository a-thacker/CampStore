/* ============ Campers + Family Tabs view ============ */
import React, { useState, useMemo } from 'react';
import { Store } from '../lib/helpers.js';
import { Icon, Badge, Toggle, Field, Search, Modal, Avatar, EmptyState } from '../components.jsx';

export function CampersView({ db, api, week, toast }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [familyModal, setFamilyModal] = useState(null);
  const [memberFor, setMemberFor] = useState(null);
  const [loadFor, setLoadFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [cashOutFor, setCashOutFor] = useState(null);

  const campers = Store.weekCampers(db, week.id);
  const tabs = Store.weekTabs(db, week.id);
  const individuals = campers.filter((c) => !c.tabId);
  const ql = q.toLowerCase();
  const filtered = individuals.filter((c) => (c.first + ' ' + c.last + ' ' + (c.cabin || '')).toLowerCase().includes(ql));
  const wrap = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message); } };

  async function saveCamper(c) {
    await wrap(() => (c.id ? api.updateCamper(c.id, c) : api.addCamper(week.id, c)), c.id ? 'Camper updated' : 'Camper added');
    setEditing(null);
  }
  async function deleteCamper(c) {
    const txns = db.transactions.filter((t) => t.payerType === 'camper' && t.payerId === c.id).length;
    const detail = txns ? ' and permanently erase their ' + txns + ' transaction record' + (txns !== 1 ? 's' : '') : '';
    if (!confirm('Delete ' + c.first + ' ' + c.last + '?\n\nThis will remove the camper' + detail + '. This cannot be undone.')) return;
    await wrap(() => api.deleteCamper(c.id), c.first + ' ' + c.last + ' deleted');
    setEditing(null); setMemberFor(null);
  }
  async function removeFromFamily(c) {
    await wrap(() => api.updateCamper(c.id, { ...c, tabId: null }), c.first + ' removed from the family — now an individual');
    setMemberFor(null);
  }
  async function loadBalance(target, amount) {
    await wrap(() => target.kind === 'tab' ? api.loadTabBalance(target.entity.id, amount) : api.loadBalance(target.entity.id, amount),
      Store.money(amount) + (amount < 0 ? ' adjusted on ' : ' added to ') + target.entity.name + '’s balance');
    setLoadFor(null);
  }
  async function returnTransaction(txn, selections) {
    await wrap(() => api.processPartialReturn(txn.id, selections), 'Return processed — refund issued');
  }
  async function cashOut(target) {
    await wrap(() => target.kind === 'tab' ? api.settleTab(target.entity.id) : api.cashOut(target.entity.id),
      target.entity.name + (target.kind === 'tab' ? ' tab closed' : ' cashed out'));
    setCashOutFor(null);
  }
  async function reopenCamper(c) {
    await wrap(() => api.reopenCamper(c.id), c.first + '’s account reopened');
  }
  async function bulkAdd(rows) {
    await wrap(() => api.bulkAddCampers(week.id, rows), rows.length + ' campers added');
    setBulk(false);
  }
  async function saveFamily(payload) {
    await wrap(() => api.saveFamily({ ...payload, weekId: week.id }), payload.id ? 'Family updated' : 'Family registered');
    setFamilyModal(null);
  }
  async function settleTab(t) {
    if (t.mode === 'prepaid' && t.balance !== 0) { setCashOutFor({ kind: 'tab', entity: { id: t.id, name: t.name, balance: t.balance } }); return; }
    await wrap(() => api.settleTab(t.id), t.name + ' tab settled');
  }

  return (
    <div className="content-pad">
      <div className="inv-head">
        <div style={{ flex: 1, maxWidth: 360 }}><Search value={q} onChange={setQ} placeholder="Search campers or cabins…" /></div>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontWeight: 700, fontSize: 13 }}>{campers.length} campers</span>
        <button className="btn" onClick={() => setBulk(true)}><Icon name="users" size={17} /> Bulk add</button>
        <button className="btn primary" onClick={() => setFamilyModal({ id: null })}><Icon name="tab" size={17} /> New family</button>
        <button className="btn ghost" onClick={() => setEditing({ first: '', last: '', age: '', cabin: '', allowPurchase: true, allowOverBalance: false, notes: '' })} title="Rarely needed — give one camper their own individual tab">
          <Icon name="plus" size={18} /> Add individual tab
        </button>
      </div>

      {tabs.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="section-label">Families</div>
          <div className="tab-grid">
            {tabs.map((t) => {
              const members = campers.filter((c) => c.tabId === t.id);
              const prepaid = t.mode === 'prepaid';
              return (
                <div key={t.id} className="card tab-card">
                  <div className="tab-card-h">
                    <Avatar name={t.name} tab />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{t.name}</div>
                      <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{members.length} member{members.length !== 1 ? 's' : ''} · {prepaid ? 'Prepaid balance' : 'Settles at week’s end'}</div>
                    </div>
                    <button className="btn ghost sm" onClick={() => setHistoryFor({ kind: 'tab', entity: t })} title="Tab history"><Icon name="receipt" size={16} /></button>
                    <button className="btn ghost icon sm" onClick={() => setFamilyModal({ id: t.id })}><Icon name="edit" size={16} /></button>
                  </div>
                  <div className="tab-members">
                    {members.map((m) => (
                      <button key={m.id} className="member-chip clickable" onClick={() => setMemberFor(m)}>
                        {m.first} {m.last}{!m.allowPurchase && <Icon name="alert" size={12} />}
                      </button>
                    ))}
                    {members.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No members yet</span>}
                  </div>
                  <div className="tab-card-f">
                    <div>
                      <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>{prepaid ? 'Balance' : 'Owed'}</div>
                      <div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: t.settled ? 'var(--green-600)' : (prepaid && t.balance < 0) ? 'var(--red)' : (!prepaid && t.balance > 0) ? 'var(--ink)' : 'var(--ink-3)' }}>{Store.money(t.balance)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {prepaid && !t.settled && <button className="btn sm" onClick={() => setLoadFor({ kind: 'tab', entity: { id: t.id, name: t.name, balance: t.balance } })}><Icon name="wallet" size={15} /> Load</button>}
                      {t.settled ? <Badge kind="ok"><Icon name="check" size={13} /> Settled</Badge>
                        : <button className="btn dark sm" disabled={!prepaid && t.balance <= 0} onClick={() => settleTab(t)}>{prepaid ? 'Close & settle' : 'Settle tab'}</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        {tabs.length > 0 && <div className="section-label">Individual tabs (not part of a family)</div>}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Camper</th><th>Cabin</th><th className="right">Age</th>
                <th className="right">Balance</th><th>Status</th><th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
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
                  <td className="right tnum" style={{ fontWeight: 700, color: c.balance < 0 ? 'var(--red)' : 'var(--ink)' }}>{Store.money(c.balance)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.cashedOut && <Badge kind="out">Cashed out</Badge>}
                      {!c.cashedOut && !c.allowPurchase && <Badge kind="muted">Paused</Badge>}
                      {!c.cashedOut && c.allowOverBalance && <Badge kind="ok">Over-balance OK</Badge>}
                    </div>
                  </td>
                  <td className="right" onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <button className="btn ghost sm" onClick={() => setHistoryFor({ kind: 'camper', entity: c })} title="Purchase history"><Icon name="receipt" size={16} /></button>
                      {!c.cashedOut && <button className="btn ghost sm" onClick={() => setLoadFor({ kind: 'camper', entity: { id: c.id, name: c.first + ' ' + c.last, balance: c.balance } })} title="Load balance"><Icon name="wallet" size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState icon="users" title={tabs.length > 0 ? 'No individual tabs' : 'No families yet'}
                    sub={tabs.length > 0 ? 'Most people register as a family. Individual tabs are only for the rare camper who has their own.' : 'Register everyone as a family. Occasionally you can give a single camper their own individual tab.'}
                    action={<button className="btn primary" onClick={() => setFamilyModal({ id: null })}><Icon name="tab" size={17} /> New family</button>} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <CamperModal camper={editing} onSave={saveCamper} onDelete={editing.id ? deleteCamper : null}
        onClose={() => setEditing(null)}
        onHistory={editing.id ? () => { const c = editing; setEditing(null); setHistoryFor({ kind: 'camper', entity: c }); } : null}
        onCashOut={editing.id && !editing.cashedOut ? () => { const c = editing; setEditing(null); setCashOutFor({ kind: 'camper', entity: { id: c.id, name: c.first + ' ' + c.last, balance: c.balance } }); } : null}
        onReopen={editing.cashedOut ? () => { reopenCamper(editing); setEditing(null); } : null} />}
      {bulk && <BulkModal onAdd={bulkAdd} onClose={() => setBulk(false)} />}
      {familyModal && (
        <FamilyModal
          tab={familyModal.id ? tabs.find((t) => t.id === familyModal.id) : null}
          members={familyModal.id ? campers.filter((c) => c.tabId === familyModal.id) : []}
          unassigned={individuals}
          onSave={saveFamily}
          onClose={() => setFamilyModal(null)}
        />
      )}
      {memberFor && (
        <MemberModal member={memberFor}
          onSave={(m) => { wrap(() => api.updateCamper(m.id, m), 'Member updated'); setMemberFor(null); }}
          onRemoveFromFamily={() => removeFromFamily(memberFor)}
          onDelete={() => deleteCamper(memberFor)}
          onHistory={() => { const m = memberFor; setMemberFor(null); setHistoryFor({ kind: 'camper', entity: m }); }}
          onClose={() => setMemberFor(null)} />
      )}
      {loadFor && <LoadBalanceModal target={loadFor} onLoad={loadBalance} onClose={() => setLoadFor(null)} />}
      {historyFor && (
        <HistoryModal db={db} target={historyFor} onReturn={returnTransaction}
          onLoad={historyFor.kind === 'camper' && historyFor.entity.cashedOut ? null : () => { const t = historyFor; setHistoryFor(null); setLoadFor(t.kind === 'tab' ? { kind: 'tab', entity: { id: t.entity.id, name: t.entity.name, balance: t.entity.balance } } : { kind: 'camper', entity: { id: t.entity.id, name: t.entity.first + ' ' + t.entity.last, balance: t.entity.balance } }); }}
          onCashOut={historyFor.kind === 'camper' && !historyFor.entity.cashedOut ? () => { const t = historyFor; setHistoryFor(null); setCashOutFor({ kind: 'camper', entity: { id: t.entity.id, name: t.entity.first + ' ' + t.entity.last, balance: t.entity.balance } }); } : null}
          onClose={() => setHistoryFor(null)} />
      )}
      {cashOutFor && <CashOutModal target={cashOutFor} onConfirm={cashOut} onClose={() => setCashOutFor(null)} />}
    </div>
  );
}

function CamperModal({ camper, onSave, onDelete, onClose, onHistory, onCashOut, onReopen }) {
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
    <Modal title={isNew ? 'Add individual camper' : f.first + ' ' + f.last} onClose={onClose}
      footer={
        <>
          {onDelete && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(camper)}><Icon name="trash" size={16} /> Delete camper</button>}
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
      {!isNew && (
        <div className="co-note"><Icon name="wallet" size={15} /> Current prepaid balance: <b className="tnum">{Store.money(camper.balance)}</b>. Use the wallet button on the roster to load funds.</div>
      )}
    </Modal>
  );
}

function MemberModal({ member, onSave, onRemoveFromFamily, onDelete, onHistory, onClose }) {
  const [f, setF] = useState({
    first: member.first || '', last: member.last || '', age: member.age ?? '',
    cabin: member.cabin || '', notes: member.notes || '', allowPurchase: member.allowPurchase !== false,
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.first.trim() && f.last.trim();
  function submit() {
    onSave({ id: member.id, first: f.first.trim(), last: f.last.trim(),
      age: f.age === '' ? null : parseInt(f.age), cabin: f.cabin.trim(), notes: f.notes.trim(), allowPurchase: f.allowPurchase });
  }
  return (
    <Modal title={f.first + ' ' + f.last} onClose={onClose}
      footer={<>
        <button className="btn danger" style={{ marginRight: 'auto' }} onClick={onDelete}><Icon name="trash" size={16} /> Delete</button>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit} disabled={!valid}>Save</button>
      </>}>
      <div className="camper-actions">
        <button className="btn sm" onClick={onHistory}><Icon name="receipt" size={16} /> Purchase history</button>
        <button className="btn sm" onClick={onRemoveFromFamily}><Icon name="x" size={16} /> Remove from family</button>
      </div>
      <div className="row">
        <Field label="First name"><input className="input" value={f.first} onChange={(e) => set('first', e.target.value)} autoFocus /></Field>
        <Field label="Last name"><input className="input" value={f.last} onChange={(e) => set('last', e.target.value)} /></Field>
      </div>
      <div className="row">
        <Field label="Age"><input className="input tnum" value={f.age} onChange={(e) => set('age', e.target.value)} inputMode="numeric" placeholder="—" /></Field>
        <Field label="Cabin"><input className="input" value={f.cabin} onChange={(e) => set('cabin', e.target.value)} placeholder="e.g. Cedar" /></Field>
      </div>
      <Field label="Notes / allergies"><textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Peanut allergy, etc." /></Field>
      <div className="divider" />
      <div className="perm-row">
        <div><div style={{ fontWeight: 700, fontSize: 14 }}>Allowed to make purchases</div><div className="muted" style={{ fontSize: 12.5 }}>Turn off to pause spending just for this person</div></div>
        <Toggle checked={f.allowPurchase} onChange={(v) => set('allowPurchase', v)} />
      </div>
      <div className="co-note"><Icon name="tab" size={15} /> This member spends from the family’s shared tab. Balance and over-balance settings are managed on the family, not per person.</div>
    </Modal>
  );
}

function LoadBalanceModal({ target, onLoad, onClose }) {
  const [amt, setAmt] = useState('');
  const presets = [10, 20, 25, 50];
  const valid = amt !== '' && !isNaN(+amt) && +amt !== 0;
  return (
    <Modal title={'Load balance · ' + target.entity.name} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!valid} onClick={() => onLoad(target, +(+amt).toFixed(2))}>Add {valid ? Store.money(+amt) : 'funds'}</button></>}>
      <div className="co-note"><Icon name="wallet" size={15} /> Current balance: <b className="tnum">{Store.money(target.entity.balance)}</b></div>
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
      const balRaw = (parts[3] || '').replace(/[$,\s]/g, '');
      const balance = balRaw && !isNaN(+balRaw) ? Math.round(parseFloat(balRaw) * 100) / 100 : 0;
      return { first, last, age, cabin, balance };
    }).filter((r) => r.first);
  }, [text]);
  return (
    <Modal title="Bulk add campers" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={parsed.length === 0} onClick={() => onAdd(parsed)}>Add {parsed.length} camper{parsed.length !== 1 ? 's' : ''}</button></>}>
      <Field label="Paste roster — one camper per line" help={'Format: Name, Age, Cabin, Starting balance (comma or tab separated). Every field after the name is optional — leave a slot empty to skip it, e.g. \u201cJohn Smith,,,60\u201d adds John with $60 and no age or cabin.'}>
        <textarea className="textarea" style={{ minHeight: 160, fontFamily: 'inherit' }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'Name, Age, Cabin, Balance\nMason Reyes, 10, Cedar, 50\nAva Thompson, 9, Birch\nJohn Smith,,,60'} autoFocus />
      </Field>
      {parsed.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="section-label" style={{ padding: '10px 14px 4px' }}>Preview · {parsed.length}</div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            <table className="tbl">
              <tbody>
                {parsed.slice(0, 50).map((r, i) => (
                  <tr key={i}><td style={{ fontWeight: 700 }}>{r.first} {r.last}</td><td className="tnum">{r.age || '—'}</td><td>{r.cabin || '—'}</td><td className="right tnum" style={{ fontWeight: 700, color: r.balance ? 'var(--green-700)' : 'var(--ink-3)' }}>{r.balance ? Store.money(r.balance) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function FamilyModal({ tab, members, unassigned, onSave, onClose }) {
  const [name, setName] = useState(tab ? tab.name : '');
  const [mode, setMode] = useState(tab ? tab.mode : 'settle');
  const [allowOverBalance, setAllowOverBalance] = useState(tab ? !!tab.allowOverBalance : false);
  const [startingBalance, setStartingBalance] = useState('');
  const [rows, setRows] = useState(() => members.length
    ? members.map((m) => ({ key: m.id, camperId: m.id, first: m.first, last: m.last, age: m.age ?? '', cabin: m.cabin || '', allowPurchase: m.allowPurchase !== false }))
    : [{ key: 'r0', camperId: null, first: '', last: '', age: '', cabin: '', allowPurchase: true }]);
  const [removedIds, setRemovedIds] = useState([]);
  const [pickOpen, setPickOpen] = useState(false);
  const rowKey = () => 'r' + Math.random().toString(36).slice(2, 8);

  const set = (key, k, v) => setRows((r) => r.map((row) => row.key === key ? { ...row, [k]: v } : row));
  const addRow = () => setRows((r) => [...r, { key: rowKey(), camperId: null, first: '', last: '', age: '', cabin: '', allowPurchase: true }]);
  const removeRow = (row) => { if (row.camperId) setRemovedIds((ids) => [...ids, row.camperId]); setRows((r) => r.filter((x) => x.key !== row.key)); };
  const attachExisting = (c) => { setRows((r) => [...r, { key: rowKey(), camperId: c.id, first: c.first, last: c.last, age: c.age ?? '', cabin: c.cabin || '', allowPurchase: c.allowPurchase !== false }]); setPickOpen(false); };

  const validRows = rows.filter((r) => r.first.trim() && r.last.trim());
  const valid = name.trim() && validRows.length > 0;

  function submit() {
    onSave({
      id: tab ? tab.id : null, name: name.trim(), mode, allowOverBalance,
      startingBalance: mode === 'prepaid' ? (+startingBalance || 0) : 0,
      members: validRows.map((r) => ({ camperId: r.camperId, first: r.first.trim(), last: r.last.trim(), age: r.age === '' ? null : parseInt(r.age), cabin: r.cabin.trim(), allowPurchase: r.allowPurchase })),
      removedIds,
    });
  }

  return (
    <Modal title={tab ? 'Edit family' : 'Register a family'} wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!valid} onClick={submit}>{tab ? 'Save family' : 'Register family'}</button></>}>
      <Field label="Family name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Johnson Family" autoFocus /></Field>

      <Field label="How will this family pay?">
        <div className="pay-methods" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button type="button" className={'pay-method' + (mode === 'settle' ? ' active' : '')} onClick={() => setMode('settle')}>
            <Icon name="tab" size={20} /><span>Settle at week’s end</span>
          </button>
          <button type="button" className={'pay-method' + (mode === 'prepaid' ? ' active' : '')} onClick={() => setMode('prepaid')}>
            <Icon name="wallet" size={20} /><span>Prepaid balance</span>
          </button>
        </div>
      </Field>
      {mode === 'settle' && (
        <div className="co-note"><Icon name="tab" size={15} /> Purchases accumulate as a tab owed by the family; you’ll collect payment and settle it at the end of the week. This is the most common choice.</div>
      )}
      {mode === 'prepaid' && (
        <>
          {!tab && (
            <Field label="Starting balance (optional)">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: 13, color: 'var(--ink-3)', fontWeight: 700 }}>$</span>
                <input className="input lg tnum" style={{ paddingLeft: 26 }} value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} placeholder="0.00" inputMode="decimal" />
              </div>
            </Field>
          )}
          <div className="perm-row">
            <div><div style={{ fontWeight: 700, fontSize: 14 }}>Allow this family to go over balance</div><div className="muted" style={{ fontSize: 12.5 }}>Permit the shared balance to go negative</div></div>
            <Toggle checked={allowOverBalance} onChange={setAllowOverBalance} />
          </div>
        </>
      )}

      <div className="divider" />
      <Field label={'Family members' + (validRows.length ? ' · ' + validRows.length : '')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row) => (
            <div key={row.key} className="member-row">
              <input className="input" style={{ flex: 1.2 }} value={row.first} onChange={(e) => set(row.key, 'first', e.target.value)} placeholder="First name" />
              <input className="input" style={{ flex: 1.2 }} value={row.last} onChange={(e) => set(row.key, 'last', e.target.value)} placeholder="Last name" />
              <input className="input tnum" style={{ flex: .6 }} value={row.age} onChange={(e) => set(row.key, 'age', e.target.value)} placeholder="Age" inputMode="numeric" />
              <input className="input" style={{ flex: 1 }} value={row.cabin} onChange={(e) => set(row.key, 'cabin', e.target.value)} placeholder="Cabin" />
              <button type="button" className={'member-toggle' + (row.allowPurchase ? ' on' : '')} onClick={() => set(row.key, 'allowPurchase', !row.allowPurchase)} title={row.allowPurchase ? 'Can make purchases' : 'Purchases paused'}>
                {row.allowPurchase ? <Icon name="check" size={14} /> : <Icon name="x" size={14} />} Can buy
              </button>
              <button type="button" className="btn ghost icon sm" onClick={() => removeRow(row)}><Icon name="x" size={15} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn sm" onClick={addRow}><Icon name="plus" size={15} /> Add family member</button>
          {unassigned.length > 0 && <button type="button" className="btn sm ghost" onClick={() => setPickOpen((v) => !v)}><Icon name="users" size={15} /> Attach existing camper</button>}
        </div>
        {pickOpen && (
          <div className="card" style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8 }}>
            {unassigned.filter((c) => !rows.some((r) => r.camperId === c.id)).map((c) => (
              <button type="button" key={c.id} className="pick-row" style={{ borderRadius: 0 }} onClick={() => attachExisting(c)}>
                <Avatar name={c.first + ' ' + c.last} />
                <div style={{ flex: 1 }}><div className="pick-name">{c.first} {c.last}</div><div className="pick-meta muted">Age {c.age || '—'} · {c.cabin || 'No cabin'}</div></div>
              </button>
            ))}
          </div>
        )}
      </Field>
    </Modal>
  );
}

/* ---- Purchase history + returns (campers or family tabs) ---- */
function HistoryModal({ db, target, onReturn, onLoad, onCashOut, onClose }) {
  const [returning, setReturning] = useState(null);
  const isTab = target.kind === 'tab';
  const e = target.entity;
  const name = isTab ? e.name : e.first + ' ' + e.last;
  const ledger = Store.ledgerFor(db, target.kind, e.id);
  const spent = Store.spentBy(db, target.kind, e.id);
  const methodLabel = { balance: 'Balance', cash: 'Cash', card: 'Card', tab: isTab ? 'Family tab' : 'Tab', deposit: 'Deposit' };
  const kindMeta = {
    sale: { label: 'Purchase', cls: 'merch' },
    return: { label: 'Return', cls: 'out' },
    deposit: { label: 'Balance loaded', cls: 'ok' },
    cashout: { label: isTab ? 'Settled' : 'Cashed out', cls: 'muted' },
  };
  return (
    <Modal title={'History · ' + name} wide onClose={onClose}
      footer={
        <>
          {onLoad && <button className="btn" style={{ marginRight: 'auto' }} onClick={onLoad}><Icon name="wallet" size={16} /> Load balance</button>}
          {onCashOut && <button className="btn dark" onClick={onCashOut}><Icon name="cash" size={16} /> Cash out</button>}
          <button className="btn primary" onClick={onClose}>Done</button>
        </>
      }>
      <div className="hist-summary">
        <div><div className="stat-label">Net spent</div><div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{Store.money(spent)}</div></div>
        <div><div className="stat-label">{isTab ? (e.mode === 'prepaid' ? 'Balance' : 'Owed') : 'Balance'}</div><div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: e.balance < 0 ? 'var(--red)' : 'var(--ink)' }}>{Store.money(e.balance)}</div></div>
        <div><div className="stat-label">Transactions</div><div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{ledger.length}</div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 380, overflowY: 'auto', margin: '0 -2px' }}>
        {ledger.length === 0 && <EmptyState icon="receipt" title="No activity yet" sub="Purchases and deposits will show here." />}
        {ledger.map((t) => {
          const meta = kindMeta[t.kind] || kindMeta.sale;
          const canReturn = Store.isReturnable(t);
          const partial = t.kind === 'sale' && t.partialReturn && !t.returned;
          return (
            <div key={t.id} className={'hist-row' + (t.returned ? ' returned' : '')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge kind={meta.cls}>{meta.label}</Badge>
                  {t.returned && <Badge kind="muted">Refunded</Badge>}
                  {partial && <Badge kind="low">Partly returned</Badge>}
                  <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{new Date(t.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {methodLabel[t.method] || t.method}</span>
                </div>
                {t.items.length > 0 && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {t.items.map((l) => Math.abs(l.qty) + '× ' + l.name + (l.sizeLabel ? ' (' + l.sizeLabel + ')' : '') + (l.returnedQty ? ' · ' + l.returnedQty + ' returned' : '')).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="tnum" style={{ fontWeight: 800, fontSize: 15, color: t.total < 0 ? 'var(--red)' : t.kind === 'deposit' ? 'var(--green-600)' : 'var(--ink)' }}>
                  {t.total < 0 ? '−' : t.kind === 'deposit' ? '+' : ''}{Store.money(Math.abs(t.total))}
                </span>
                {canReturn && <button className="btn sm danger" onClick={() => setReturning(t)}>Return…</button>}
              </div>
            </div>
          );
        })}
      </div>
      {returning && <ReturnModal txn={returning} onConfirm={(sel) => { onReturn(returning, sel); setReturning(null); }} onClose={() => setReturning(null)} />}
    </Modal>
  );
}

/* ---- Item-level return: pick how many of each line to send back ---- */
function ReturnModal({ txn, onConfirm, onClose }) {
  const lines = txn.items.map((l, index) => ({ index, l, remaining: Store.remainingQty(l) }));
  const [qty, setQty] = useState(() => {
    const init = {};
    lines.forEach(({ index, remaining }) => { init[index] = remaining; }); // default: full return
    return init;
  });
  const methodLabel = { balance: 'balance', cash: 'cash', card: 'card', tab: 'the family tab', deposit: 'deposit' };
  const set = (i, v) => setQty((s) => ({ ...s, [i]: v }));
  const refund = +lines.reduce((s, { index, l }) => s + l.unitPrice * (qty[index] || 0), 0).toFixed(2);
  const anySelected = lines.some(({ index }) => (qty[index] || 0) > 0);
  const allSelected = lines.every(({ index, remaining }) => (qty[index] || 0) >= remaining);
  const selectAll = () => setQty(() => { const n = {}; lines.forEach(({ index, remaining }) => { n[index] = remaining; }); return n; });
  const selectNone = () => setQty(() => { const n = {}; lines.forEach(({ index }) => { n[index] = 0; }); return n; });

  function submit() {
    onConfirm(lines.filter(({ index }) => (qty[index] || 0) > 0).map(({ index }) => ({ index, qty: qty[index] })));
  }

  return (
    <Modal title="Return items" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn danger" disabled={!anySelected} onClick={submit}>Refund {Store.money(refund)}</button></>}>
      <div className="co-note"><Icon name="receipt" size={15} /> Pick how many of each item to return. Stock is restored and the refund goes back to <b>{methodLabel[txn.method] || txn.method}</b>.</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <button className="btn sm" onClick={selectAll} disabled={allSelected}>Return all</button>
        <button className="btn sm ghost" onClick={selectNone} disabled={!anySelected}>Clear</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map(({ index, l, remaining }) => {
          const fully = remaining <= 0;
          const q = qty[index] || 0;
          return (
            <div key={index} className="ret-line" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, opacity: fully ? .55 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{l.name}{l.sizeLabel ? ' (' + l.sizeLabel + ')' : ''}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{Store.money(l.unitPrice)} each · bought {l.qty}{l.returnedQty ? ' · ' + l.returnedQty + ' already returned' : ''}</div>
              </div>
              {fully ? <Badge kind="muted">Returned</Badge> : (
                <div className="qty-ctrl">
                  <button onClick={() => set(index, Math.max(0, q - 1))} disabled={q <= 0}><Icon name="minus" size={15} /></button>
                  <span className="tnum">{q}</span>
                  <button onClick={() => set(index, Math.min(remaining, q + 1))} disabled={q >= remaining}><Icon name="plus" size={15} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ---- Cash out / settle-and-close (campers or family tabs) ---- */
function CashOutModal({ target, onConfirm, onClose }) {
  const isTab = target.kind === 'tab';
  const balance = target.entity.balance || 0;
  const owes = balance < 0;
  return (
    <Modal title={(isTab ? 'Close family tab · ' : 'Cash out · ') + target.entity.name} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn dark" onClick={() => onConfirm(target)}><Icon name="cash" size={16} /> {owes ? 'Confirm & collect' : 'Confirm cash out'}</button></>}>
      <div className={'co-note' + (owes ? ' err' : '')}>
        <Icon name={owes ? 'alert' : 'cash'} size={16} />
        {owes
          ? <span>This {isTab ? 'family’s balance' : 'camper’s balance'} is negative. Collect <b className="tnum">{Store.money(Math.abs(balance))}</b> before closing.</span>
          : balance > 0
            ? <span>Return <b className="tnum">{Store.money(balance)}</b> of remaining balance{isTab ? ' to the family' : ' to the camper'}.</span>
            : <span>Balance is <b className="tnum">$0.00</b> — nothing to return.</span>}
      </div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
        {isTab
          ? <>Closing sets the family’s balance to <b>$0.00</b>, records the settlement, and marks the tab <b>settled</b>.</>
          : <>Cashing out sets the balance to <b>$0.00</b>, records a cash-out in their history, and <b>closes the account to further purchases</b> for the rest of the week. You can reopen it later from the camper’s details.</>}
      </div>
    </Modal>
  );
}

export { CamperModal, MemberModal, LoadBalanceModal, BulkModal, FamilyModal, HistoryModal, CashOutModal, ReturnModal };

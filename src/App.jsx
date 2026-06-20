/* ============ App root (real build) ============ */
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import { useStore } from './store.js';
import { Store } from './lib/helpers.js';
import { Icon, Badge, Field, Modal, useToast, ToastHost } from './components.jsx';
import { RegisterView } from './views/Register.jsx';
import { InventoryView } from './views/Inventory.jsx';
import { CampersView } from './views/Campers.jsx';
import { ReportsView } from './views/Reports.jsx';
import { Login } from './auth/Login.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <FullScreen>Loading…</FullScreen>;
  if (session === null) return <Login />;
  return <Shell session={session} />;
}

function FullScreen({ children }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontWeight: 600 }}>
      {children}
    </div>
  );
}

function Shell({ session }) {
  const { db, error, api } = useStore(session);
  const [view, setView] = useState('register');
  const [weekModal, setWeekModal] = useState(false);
  const toast = useToast();

  if (error) return <FullScreen><div style={{ textAlign: 'center', maxWidth: 420 }}>
    <div style={{ fontWeight: 800, color: 'var(--red)', marginBottom: 8 }}>Couldn’t reach the database</div>
    <div style={{ fontSize: 14 }}>{error}</div>
    <div style={{ fontSize: 13, marginTop: 12 }}>Check your Supabase URL/key in <code>.env</code> and that the schema is installed.</div>
  </div></FullScreen>;
  if (!db) return <FullScreen>Loading store…</FullScreen>;

  const weeks = [...db.weeks].sort((a, b) => a.order - b.order);
  const week = db.weeks.find((w) => w.id === db.activeWeekId) || weeks[0];

  const nav = [
    ['register', 'Register', 'register'],
    ['inventory', 'Inventory', 'box'],
    ['campers', 'Campers', 'users'],
    ['reports', 'Reports', 'chart'],
  ];
  const titles = { register: 'Register', inventory: 'Inventory', campers: 'Campers & Tabs', reports: 'Reports' };

  if (!week) return <FullScreen><div style={{ textAlign: 'center' }}>
    <div style={{ fontWeight: 800, marginBottom: 10 }}>No weeks yet</div>
    <button className="btn primary" onClick={() => setWeekModal(true)}><Icon name="plus" size={18} /> Create your first week</button>
    {weekModal && <WeekManager db={db} api={api} toast={toast} onClose={() => setWeekModal(false)} />}
    <ToastHost />
  </div></FullScreen>;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="sun" size={22} /></div>
          <div>
            <div className="brand-name">{db.settings.campName}</div>
            <div className="brand-sub">Store Register</div>
          </div>
        </div>
        <nav className="nav">
          {nav.map(([id, label, icon]) => (
            <button key={id} className={'nav-item' + (view === id ? ' active' : '')} onClick={() => setView(id)}>
              <Icon name={icon} size={20} /> {label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="nav-item" onClick={() => setWeekModal(true)}><Icon name="settings" size={20} /> Manage weeks</button>
          <button className="nav-item" onClick={() => supabase.auth.signOut()}><Icon name="user" size={20} /> Sign out</button>
        </nav>
        <div className="nav-foot">Signed in as {session.user.email}</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{titles[view]}</h1>
          <div className="spacer" />
          <div className="weeksel">
            <Icon name="sun" size={16} />
            <select value={week.id} onChange={(e) => api.setActiveWeek(e.target.value)}>
              {weeks.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <Badge kind={week.type}>{week.type === 'kids' ? 'Kids' : 'Family'}</Badge>
            <button className="btn ghost icon sm" onClick={() => setWeekModal(true)} title="Manage weeks"><Icon name="settings" size={17} /></button>
          </div>
        </header>
        <div className="content">
          {view === 'register' && <RegisterView db={db} api={api} week={week} toast={toast} />}
          {view === 'inventory' && <InventoryView db={db} api={api} toast={toast} />}
          {view === 'campers' && <CampersView db={db} api={api} week={week} toast={toast} />}
          {view === 'reports' && <ReportsView db={db} week={week} toast={toast} />}
        </div>
      </div>

      <nav className="mobile-nav">
        {nav.map(([id, label, icon]) => (
          <button key={id} className={'nav-item' + (view === id ? ' active' : '')} onClick={() => setView(id)}>
            <Icon name={icon} size={21} /> {label}
          </button>
        ))}
      </nav>

      {weekModal && <WeekManager db={db} api={api} toast={toast} onClose={() => setWeekModal(false)} />}
      <ToastHost />
    </div>
  );
}

function WeekManager({ db, api, toast, onClose }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('kids');
  const weeks = [...db.weeks].sort((a, b) => a.order - b.order);

  async function createWeek() {
    if (!name.trim()) return;
    try { await api.addWeek({ name: name.trim(), type }); toast('Week created'); setName(''); setAdding(false); }
    catch (e) { toast(e.message); }
  }
  async function removeWeek(w) {
    const n = Store.weekCampers(db, w.id).length;
    if (!confirm('Delete "' + w.name + '"? This removes ' + n + ' campers and their transactions.')) return;
    try { await api.deleteWeek(w.id); toast('Week deleted'); } catch (e) { toast(e.message); }
  }

  return (
    <Modal title="Manage weeks" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>Each week is its own round of campers. Inventory and products carry across all weeks; sales are tracked per week.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {weeks.map((w) => {
          const active = w.id === db.activeWeekId;
          return (
            <div key={w.id} className={'week-row' + (active ? ' active' : '')}>
              <button className="week-pick" onClick={() => api.setActiveWeek(w.id)}>
                <div className={'week-dot' + (active ? ' on' : '')}>{active && <Icon name="check" size={13} />}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{w.name}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{Store.weekCampers(db, w.id).length} campers · {Store.money(Store.weekSales(db, w.id))} sales</div>
                </div>
              </button>
              <Badge kind={w.type}>{w.type === 'kids' ? 'Kids' : 'Family'}</Badge>
              {weeks.length > 1 && <button className="btn ghost icon sm" onClick={() => removeWeek(w)}><Icon name="trash" size={16} /></button>}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Field label="Week name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Week 4 — Adventure Camp" autoFocus /></Field>
          <Field label="Week type">
            <div className="pay-methods" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button className={'pay-method' + (type === 'kids' ? ' active' : '')} onClick={() => setType('kids')}><Icon name="users" size={20} /><span>Kids</span></button>
              <button className={'pay-method' + (type === 'family' ? ' active' : '')} onClick={() => setType('family')}><Icon name="tab" size={20} /><span>Family (tabs)</span></button>
            </div>
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn primary" onClick={createWeek} disabled={!name.trim()}>Create week</button>
          </div>
        </div>
      ) : (
        <button className="btn block" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> New week</button>
      )}
    </Modal>
  );
}

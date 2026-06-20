/* ============ Reports view ============ */
import React, { useState } from 'react';
import { Store } from '../lib/helpers.js';
import { Icon, Badge, EmptyState } from '../components.jsx';

export function ReportsView({ db, week, toast }) {
  const [scope, setScope] = useState('week'); // 'week' | 'all'
  const weeks = [...db.weeks].sort((a, b) => a.order - b.order);

  const sales = scope === 'week' ? Store.weekSales(db, week.id) : Store.allSales(db);
  const tx = (scope === 'week' ? Store.weekTx(db, week.id) : db.transactions.filter((t) => t.kind === 'sale'));
  const outstanding = Store.outstandingTabs(db, scope === 'week' ? week.id : null);
  const txCount = tx.length;
  const avg = txCount ? sales / txCount : 0;

  // payment method split
  const byMethod = { balance: 0, cash: 0, card: 0, tab: 0 };
  tx.forEach((t) => { byMethod[t.method] = (byMethod[t.method] || 0) + t.total; });

  // top sellers
  const prodMap = {};
  tx.forEach((t) => t.items.forEach((l) => {
    if (!prodMap[l.productId]) prodMap[l.productId] = { name: l.name, qty: 0, rev: 0, category: l.category };
    prodMap[l.productId].qty += l.qty; prodMap[l.productId].rev += l.lineTotal;
  }));
  const top = Object.values(prodMap).sort((a, b) => b.rev - a.rev).slice(0, 6);
  const maxRev = top.length ? top[0].rev : 1;

  const recent = [...tx].sort((a, b) => b.ts - a.ts).slice(0, 12);
  const nameFor = (t) => {
    if (t.payerType === 'tab') { const x = db.tabs.find((i) => i.id === t.payerId); return x ? x.name : 'Tab'; }
    const c = db.campers.find((i) => i.id === t.payerId); return c ? c.first + ' ' + c.last : 'Camper';
  };
  const weekName = (id) => { const w = db.weeks.find((x) => x.id === id); return w ? w.name : ''; };
  const methodLabel = { balance: 'Balance', cash: 'Cash', card: 'Card', tab: 'Tab' };

  const allTimeTotal = Store.allSales(db);
  const maxWeekSales = Math.max(1, ...weeks.map((w) => Store.weekSales(db, w.id)));

  return (
    <div className="content-pad">
      <div className="inv-head">
        <div className="chip-tabs">
          <button className={'chip-tab' + (scope === 'week' ? ' active' : '')} onClick={() => setScope('week')}>This week</button>
          <button className={'chip-tab' + (scope === 'all' ? ' active' : '')} onClick={() => setScope('all')}>All weeks</button>
        </div>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontWeight: 700, fontSize: 13 }}>{scope === 'week' ? week.name : weeks.length + ' weeks total'}</span>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 16 }}>
        <div className="stat">
          <div className="stat-label">{scope === 'week' ? 'Week sales' : 'All-time sales'}</div>
          <div className="stat-val tnum">{Store.money(sales)}</div>
          <div className="stat-sub">{txCount} transaction{txCount !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Outstanding tabs</div>
          <div className="stat-val tnum" style={{ color: outstanding > 0 ? 'var(--amber)' : 'var(--ink)' }}>{Store.money(outstanding)}</div>
          <div className="stat-sub">{scope === 'week' ? 'this week' : 'across all weeks'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Avg. sale</div>
          <div className="stat-val tnum">{Store.money(avg)}</div>
          <div className="stat-sub">per transaction</div>
        </div>
        <div className="stat">
          <div className="stat-label">Low stock items</div>
          <div className="stat-val tnum" style={{ color: Store.lowStock(db).length ? 'var(--amber)' : 'var(--ink)' }}>{Store.lowStock(db).length}</div>
          <div className="stat-sub">at or below {db.settings.lowStock}</div>
        </div>
      </div>

      <div className="rep-cols">
        {/* left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* sales by week */}
          <div className="card">
            <div className="panel-h"><h2 style={{ flex: 1 }}>Sales by week</h2><span className="muted tnum" style={{ fontWeight: 700, fontSize: 13 }}>{Store.money(allTimeTotal)} all-time</span></div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
              {weeks.map((w) => {
                const s = Store.weekSales(db, w.id);
                return (
                  <div key={w.id} className="bar-row">
                    <div className="bar-label">
                      <span style={{ fontWeight: 700 }}>{w.name}</span>
                      <Badge kind={w.type}>{w.type === 'kids' ? 'Kids' : 'Family'}</Badge>
                    </div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: Math.max(2, (s / maxWeekSales) * 100) + '%' }} /></div>
                    <div className="tnum bar-val">{Store.money(s)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* top sellers */}
          <div className="card">
            <div className="panel-h"><h2>Top sellers</h2></div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {top.length === 0 && <div className="muted" style={{ fontSize: 14, padding: '10px 0' }}>No sales yet.</div>}
              {top.map((p, i) => (
                <div key={i} className="bar-row">
                  <div className="bar-label" style={{ minWidth: 150 }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    <span className="muted tnum" style={{ fontSize: 12.5 }}>×{p.qty}</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill alt" style={{ width: Math.max(2, (p.rev / maxRev) * 100) + '%' }} /></div>
                  <div className="tnum bar-val">{Store.money(p.rev)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* payment split */}
          <div className="card">
            <div className="panel-h"><h2>Payment methods</h2></div>
            <div style={{ padding: '16px 18px' }}>
              <div className="split-bar">
                {['balance', 'cash', 'card', 'tab'].map((m) => byMethod[m] > 0 && (
                  <div key={m} className={'split-seg ' + m} style={{ flex: byMethod[m] }} title={methodLabel[m]} />
                ))}
                {sales === 0 && <div className="split-seg empty" style={{ flex: 1 }} />}
              </div>
              <div className="split-legend">
                {['balance', 'cash', 'card', 'tab'].map((m) => (
                  <div key={m} className="legend-item">
                    <span className={'legend-dot ' + m} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{methodLabel[m]}</span>
                    <span className="tnum muted" style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13 }}>{Store.money(byMethod[m] || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* recent transactions */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="panel-h"><h2 style={{ flex: 1 }}>Recent transactions</h2></div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table className="tbl">
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{nameFor(t)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{t.items.reduce((s, l) => s + l.qty, 0)} items{scope === 'all' ? ' · ' + weekName(t.weekId) : ''}</div>
                      </td>
                      <td><Badge kind={t.method === 'tab' ? 'tab' : t.method === 'card' ? 'merch' : 'muted'}>{methodLabel[t.method]}</Badge></td>
                      <td className="right tnum" style={{ fontWeight: 700 }}>{Store.money(t.total)}</td>
                    </tr>
                  ))}
                  {recent.length === 0 && <tr><td><div className="muted" style={{ padding: 16, fontSize: 14 }}>No transactions yet.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => { exportCSV(tx, db, scope === 'all'); toast('CSV exported'); }}><Icon name="download" size={17} /> Export {scope === 'week' ? 'week' : 'all'} sales (CSV)</button>
      </div>
    </div>
  );
}

function exportCSV(tx, db, includeWeek) {
  const nameFor = (t) => {
    if (t.payerType === 'tab') { const x = db.tabs.find((i) => i.id === t.payerId); return x ? x.name : 'Tab'; }
    const c = db.campers.find((i) => i.id === t.payerId); return c ? c.first + ' ' + c.last : 'Camper';
  };
  const weekName = (id) => { const w = db.weeks.find((x) => x.id === id); return w ? w.name : ''; };
  const rows = [['Date', 'Account', 'Items', 'Method', 'Total', ...(includeWeek ? ['Week'] : [])]];
  [...tx].sort((a, b) => b.ts - a.ts).forEach((t) => {
    rows.push([
      new Date(t.ts).toLocaleDateString(), nameFor(t),
      '"' + t.items.map((l) => l.qty + '× ' + l.name).join(', ') + '"',
      t.method, t.total.toFixed(2), ...(includeWeek ? [weekName(t.weekId)] : []),
    ]);
  });
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'camp-store-sales.csv';
  a.click();
}

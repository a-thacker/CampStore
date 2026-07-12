/* ============ Shared UI primitives ============ */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/* ---- Icons (inline stroke SVG) ---- */
function Icon({ name, size = 20, stroke = 2 }) {
  const p = {
    register: 'M3 9h18M3 9l1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.5L21 9M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M9 13h6',
    box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
    users: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM3 21v-1a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v1',
    chart: 'M3 3v18h18M7 15l3-4 3 3 4-6',
    search: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    x: 'M18 6 6 18M6 6l12 12',
    check: 'M20 6 9 17l-5-5',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
    trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    chevron: 'M6 9l6 6 6-6',
    cash: 'M2 7h20v10H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    card: 'M2 6h20v12H2zM2 10h20',
    wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M21 12a2 2 0 0 0-2-2h-4a2 2 0 0 0 0 4h4a2 2 0 0 0 2-2z',
    tab: 'M4 4h16v16H4zM4 9h16M9 4v16',
    tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7 7h.01',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
    settings: 'M11.08 3.5a1 1 0 0 1 1.84 0l.66 1.58a1 1 0 0 0 1.3.54l1.6-.66a1 1 0 0 1 1.3 1.3l-.66 1.6a1 1 0 0 0 .54 1.3l1.58.66a1 1 0 0 1 0 1.84l-1.58.66a1 1 0 0 0-.54 1.3l.66 1.6a1 1 0 0 1-1.3 1.3l-1.6-.66a1 1 0 0 0-1.3.54l-.66 1.58a1 1 0 0 1-1.84 0l-.66-1.58a1 1 0 0 0-1.3-.54l-1.6.66a1 1 0 0 1-1.3-1.3l.66-1.6a1 1 0 0 0-.54-1.3l-1.58-.66a1 1 0 0 1 0-1.84l1.58-.66a1 1 0 0 0 .54-1.3l-.66-1.6a1 1 0 0 1 1.3-1.3l1.6.66a1 1 0 0 0 1.3-.54zM12 13.75a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    receipt: 'M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5zM8 8h8M8 12h8',
    alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    camera: 'M3 8a2 2 0 0 1 2-2h1.5l1-1.5a1 1 0 0 1 .8-.5h5.4a1 1 0 0 1 .8.5l1 1.5H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
    grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.2 9.3a3 3 0 0 1 5.6 1.3c0 2-3 2.7-3 4M12 17.5h.01',
    arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={p} />
    </svg>
  );
}

function Badge({ kind, children }) { return <span className={'badge ' + kind}>{children}</span>; }

function HelpTip({ text }) {
  if (!text) return null;
  return (
    <span className="helptip" tabIndex={0} role="button" aria-label="More info">
      <Icon name="help" size={15} stroke={2} />
      <span className="helptip-bubble" role="tooltip">{text}</span>
    </span>
  );
}

function Toggle({ checked, onChange, label, help }) {
  return (
    <label className="toggle">
      <span className={'toggle-track' + (checked ? ' on' : '')} onClick={(e) => { e.preventDefault(); onChange(!checked); }}>
        <span className="toggle-knob" />
      </span>
      {label && <span className="toggle-label">{label}{help && <HelpTip text={help} />}</span>}
    </label>
  );
}

function Field({ label, help, children }) {
  return <div className="field">{label && <label>{label}{help && <HelpTip text={help} />}</label>}{children}</div>;
}

function Search({ value, onChange, placeholder, autoFocus }) {
  return (
    <div className="search" style={{ flex: 1 }}>
      <Icon name="search" size={18} />
      <input value={value} autoFocus={autoFocus} placeholder={placeholder || 'Search…'} onChange={(e) => onChange(e.target.value)} />
      {value && <button className="btn ghost icon sm" onClick={() => onChange('')}><Icon name="x" size={16} /></button>}
    </div>
  );
}

function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')}>
        <div className="modal-h">
          <h3 style={{ flex: 1 }}>{title}</h3>
          <button className="btn ghost icon" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

function Avatar({ name, tab }) {
  const initials = tab
    ? '\u2302'
    : name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <div className={'avatar' + (tab ? ' tab' : '')}>{initials}</div>;
}

function EmptyState({ icon, title, sub, action }) {
  return (
    <div className="empty">
      <Icon name={icon || 'box'} size={40} stroke={1.5} />
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink-2)' }}>{title}</div>
      {sub && <div style={{ marginTop: 5, fontSize: 14 }}>{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/* multi-tag chip input: type + Enter/comma to add, Backspace to remove */
function TagInput({ value = [], onChange, suggestions = [] }) {
  const [text, setText] = useState('');
  const norm = (s) => s.trim().toLowerCase();
  const commit = (raw) => {
    const parts = raw.split(',').map(norm).filter(Boolean);
    if (!parts.length) { setText(''); return; }
    const next = [...value];
    parts.forEach((t) => { if (!next.includes(t)) next.push(t); });
    onChange(next); setText('');
  };
  const remove = (t) => onChange(value.filter((x) => x !== t));
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(text); }
    else if (e.key === 'Backspace' && !text && value.length) { remove(value[value.length - 1]); }
  };
  const avail = suggestions.filter((s) => !value.includes(s));
  return (
    <div>
      <div className="tag-input" onClick={(e) => e.currentTarget.querySelector('input').focus()}>
        {value.map((t) => (
          <span key={t} className="tag-chip">{t}<button type="button" onClick={() => remove(t)} aria-label={'Remove ' + t}><Icon name="x" size={12} /></button></span>
        ))}
        <input value={text} placeholder={value.length ? '' : 'e.g. shirts, hats'}
          onChange={(e) => { const v = e.target.value; if (v.includes(',')) commit(v); else setText(v); }}
          onKeyDown={onKey} onBlur={() => commit(text)} />
      </div>
      {avail.length > 0 && (
        <div className="tag-suggest">
          {avail.slice(0, 12).map((s) => <button type="button" key={s} className="chip-add" onClick={() => commit(s)}><Icon name="plus" size={12} /> {s}</button>)}
        </div>
      )}
    </div>
  );
}

/* toast helper via custom event */
function useToast() {
  return useCallback((msg) => {
    window.dispatchEvent(new CustomEvent('toast', { detail: msg }));
  }, []);
}
function ToastHost() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    const h = (e) => {
      setMsg(e.detail);
      clearTimeout(window.__toastT);
      window.__toastT = setTimeout(() => setMsg(null), 2400);
    };
    window.addEventListener('toast', h);
    return () => window.removeEventListener('toast', h);
  }, []);
  if (!msg) return null;
  return <div className="toast"><Icon name="check" size={18} />{msg}</div>;
}

export { Icon, Badge, Toggle, Field, Search, Modal, Avatar, EmptyState, TagInput, HelpTip, useToast, ToastHost };

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase.js';

/* ---------- row mappers: Supabase (snake) -> app shape (camel) ---------- */
const mapProduct = (r) => ({
  id: r.id, name: r.name, category: r.category, price: Number(r.price),
  trackQuantity: r.track_quantity, quantity: r.quantity, active: r.active,
  image: r.image_url, squareCatalogId: r.square_catalog_id, tags: Array.isArray(r.tags) ? r.tags : [],
  sizes: Array.isArray(r.sizes) && r.sizes.length ? r.sizes : null,
});
const mapWeek = (r) => ({
  id: r.id, name: r.name, type: r.type, start: r.start_date, end: r.end_date, order: r.sort_order,
});
const mapTab = (r) => ({
  id: r.id, weekId: r.week_id, name: r.name, balance: Number(r.balance), settled: r.settled,
  mode: r.mode || 'settle', allowOverBalance: !!r.allow_over_balance,
});
const mapCamper = (r) => ({
  id: r.id, weekId: r.week_id, tabId: r.tab_id, first: r.first_name, last: r.last_name,
  age: r.age, cabin: r.cabin, notes: r.notes, allowPurchase: r.allow_purchase,
  allowOverBalance: r.allow_over_balance, balance: Number(r.balance),
  cashedOut: r.cashed_out, cashedOutAt: r.cashed_out_at,
});
const mapItems = (items) => (items || []).map((l) => ({
  productId: l.product_id, name: l.name, category: l.category, qty: l.qty,
  sizeId: l.size_id || null, sizeLabel: l.size_label || null,
  returnedQty: l.returned_qty || 0,
  unitPrice: Number(l.unit_price), lineTotal: Number(l.line_total),
}));
const mapTxn = (r) => ({
  id: r.id, weekId: r.week_id, kind: r.kind, payerType: r.payer_type,
  payerId: r.camper_id || r.tab_id, items: mapItems(r.items), total: Number(r.total),
  method: r.method, refOf: r.ref_of, returned: r.returned, memberId: r.member_id || null,
  ts: new Date(r.created_at).getTime(), squarePaymentId: r.square_payment_id,
  partialReturn: !r.returned && (r.items || []).some((l) => (l.returned_qty || 0) > 0),
});

// app cart line -> RPC item snapshot (snake)
const toRpcItem = (l) => ({
  product_id: l.productId, name: l.name, category: l.category,
  size_id: l.sizeId || null, size_label: l.sizeLabel || null,
  qty: l.qty, unit_price: l.unitPrice, line_total: +(l.unitPrice * l.qty).toFixed(2),
});

const ACTIVE_WEEK_KEY = 'camp_active_week';
const check = ({ error }) => { if (error) throw new Error(error.message); };

export function useStore(session) {
  const [db, setDb] = useState(null);          // null until first load
  const [error, setError] = useState(null);
  const activeRef = useRef(localStorage.getItem(ACTIVE_WEEK_KEY) || null);

  const load = useCallback(async () => {
    try {
      const [settings, products, weeks, tabs, campers, transactions] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('products').select('*').order('name'),
        supabase.from('weeks').select('*').order('sort_order'),
        supabase.from('tabs').select('*'),
        supabase.from('campers').select('*').order('first_name'),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      ]);
      [settings, products, weeks, tabs, campers, transactions].forEach(check);

      const weekRows = weeks.data.map(mapWeek);
      let active = activeRef.current;
      if (!active || !weekRows.find((w) => w.id === active)) active = weekRows[0]?.id || null;
      activeRef.current = active;
      if (active) localStorage.setItem(ACTIVE_WEEK_KEY, active);

      setDb({
        settings: {
          campName: settings.data.camp_name,
          lowStock: settings.data.low_stock,
          currency: settings.data.currency,
          tagOrder: settings.data.tag_order || [],
        },
        activeWeekId: active,
        products: products.data.map(mapProduct),
        weeks: weekRows,
        tabs: tabs.data.map(mapTab),
        campers: campers.data.map(mapCamper),
        transactions: transactions.data.map(mapTxn),
      });
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { if (session) load(); }, [session, load]);

  // refetch after any mutation (camp dataset is small; keeps state consistent)
  const after = async (p) => { const r = await p; check(r); await load(); return r.data; };

  const api = {
    reload: load,

    setActiveWeek(id) {
      activeRef.current = id;
      localStorage.setItem(ACTIVE_WEEK_KEY, id);
      setDb((d) => (d ? { ...d, activeWeekId: id } : d));
    },

    setTagOrder: (order) => after(supabase.from('settings').update({ tag_order: order }).eq('id', true)),

    /* ----- products ----- */
    addProduct: (p) => after(supabase.from('products').insert({
      name: p.name, category: p.category, price: p.price, tags: p.tags || [],
      track_quantity: p.trackQuantity, quantity: p.trackQuantity ? (p.quantity || 0) : null, active: true,
      sizes: p.trackQuantity && p.sizes && p.sizes.length ? p.sizes : null,
    })),
    updateProduct: (id, p) => after(supabase.from('products').update({
      name: p.name, category: p.category, price: p.price, tags: p.tags || [],
      track_quantity: p.trackQuantity, quantity: p.trackQuantity ? (p.quantity || 0) : null,
      sizes: p.trackQuantity && p.sizes && p.sizes.length ? p.sizes : null,
    }).eq('id', id)),
    archiveProduct: (id) => after(supabase.from('products').update({ active: false }).eq('id', id)),
    adjustStock: (id, quantity) => after(supabase.from('products').update({ quantity }).eq('id', id)),
    // replace a sized product's sizes[] and keep quantity = sum(sizes)
    setSizes: (id, sizes) => after(supabase.from('products').update({
      sizes, quantity: (sizes || []).reduce((s, z) => s + (parseInt(z.quantity) || 0), 0),
    }).eq('id', id)),
    setTracking: (id, on, quantity = 0) => after(supabase.from('products')
      .update({ track_quantity: on, quantity: on ? quantity : null, sizes: on ? undefined : null }).eq('id', id)),
    // upload a (downscaled) image blob to Storage, save its public URL on the product
    uploadProductImage: async (productId, blob) => {
      const path = `${productId}-${Date.now()}.jpg`;
      const up = await supabase.storage.from('product-images')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw new Error(up.error.message);
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      return after(supabase.from('products').update({ image_url: data.publicUrl }).eq('id', productId));
    },

    /* ----- weeks ----- */
    addWeek: async ({ name, type }) => {
      const max = Math.max(0, ...(db?.weeks || []).map((w) => w.order));
      const { data, error } = await supabase.from('weeks')
        .insert({ name, type, sort_order: max + 1 }).select().single();
      if (error) throw new Error(error.message);
      api.setActiveWeek(data.id);
      await load();
      return data;
    },
    deleteWeek: (id) => after(supabase.from('weeks').delete().eq('id', id)),

    /* ----- campers ----- */
    addCamper: (weekId, c) => after(supabase.from('campers').insert({
      week_id: weekId, first_name: c.first, last_name: c.last, age: c.age,
      cabin: c.cabin, notes: c.notes, allow_purchase: c.allowPurchase,
      allow_over_balance: c.allowOverBalance,
    })),
    updateCamper: (id, c) => after(supabase.from('campers').update({
      first_name: c.first, last_name: c.last, age: c.age, cabin: c.cabin, notes: c.notes,
      allow_purchase: c.allowPurchase, allow_over_balance: c.allowOverBalance,
    }).eq('id', id)),
    deleteCamper: (id) => after(supabase.rpc('delete_camper', { p_camper_id: id })),
    bulkAddCampers: (weekId, rows) => after(supabase.from('campers').insert(
      rows.map((r) => ({
        week_id: weekId, first_name: r.first, last_name: r.last,
        age: r.age, cabin: r.cabin, balance: r.balance || 0, allow_purchase: true, allow_over_balance: false,
      })),
    )),
    reopenCamper: (id) => after(supabase.from('campers')
      .update({ cashed_out: false, cashed_out_at: null, allow_purchase: true }).eq('id', id)),

    /* ----- family tabs ----- */
    // register or update an entire family (tab + all its members) in one step
    saveFamily: async ({ id, name, mode, allowOverBalance, startingBalance, members, removedIds, weekId }) => {
      let tabId = id;
      if (!tabId) {
        const { data, error } = await supabase.from('tabs')
          .insert({ week_id: weekId, name, mode, allow_over_balance: allowOverBalance, balance: mode === 'prepaid' ? (startingBalance || 0) : 0 })
          .select().single();
        if (error) throw new Error(error.message);
        tabId = data.id;
        if (mode === 'prepaid' && startingBalance) {
          check(await supabase.from('transactions').insert({
            week_id: weekId, kind: 'deposit', payer_type: 'tab', tab_id: tabId, items: [], total: startingBalance, method: 'deposit',
          }));
        }
      } else {
        check(await supabase.from('tabs').update({ name, mode, allow_over_balance: allowOverBalance }).eq('id', tabId));
      }
      for (const m of members) {
        if (m.camperId) {
          check(await supabase.from('campers').update({
            first_name: m.first, last_name: m.last, age: m.age, cabin: m.cabin, allow_purchase: m.allowPurchase, tab_id: tabId,
          }).eq('id', m.camperId));
        } else {
          check(await supabase.from('campers').insert({
            week_id: weekId, first_name: m.first, last_name: m.last, age: m.age, cabin: m.cabin,
            allow_purchase: m.allowPurchase, allow_over_balance: false, tab_id: tabId,
          }));
        }
      }
      if (removedIds && removedIds.length) {
        check(await supabase.from('campers').update({ tab_id: null }).in('id', removedIds));
      }
      await load();
    },
    loadTabBalance: (tabId, amount) => after(supabase.rpc('load_tab_balance', { p_tab_id: tabId, p_amount: amount })),
    settleTab: (id) => after(supabase.rpc('settle_tab', { p_tab_id: id })),

    /* ----- money movements (RPCs) ----- */
    loadBalance: (camperId, amount) => after(supabase.rpc('deposit_balance', { p_camper_id: camperId, p_amount: amount })),
    cashOut: (camperId) => after(supabase.rpc('cash_out_camper', { p_camper_id: camperId })),

    /* ----- the sale ----- */
    recordSale: ({ weekId, payerType, payerId, items, method, squarePaymentId = null, memberId = null }) =>
      after(supabase.rpc('record_sale', {
        p_week_id: weekId, p_payer_type: payerType, p_payer_id: payerId,
        p_items: items.map(toRpcItem), p_method: method, p_square_payment_id: squarePaymentId,
        p_member_id: memberId,
      })),
    processReturn: (txnId) => after(supabase.rpc('process_return', { p_txn_id: txnId })),
    processPartialReturn: (txnId, selections) => after(supabase.rpc('process_partial_return', { p_txn_id: txnId, p_selections: selections })),
  };

  return { db, error, api };
}

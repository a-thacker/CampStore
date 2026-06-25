/* ============================================================
   Selectors — pure functions over the in-memory `db` snapshot.
   Signatures match the prototype's window.Store so the view code
   that calls Store.weekCampers(db, id) etc. is unchanged.
   ============================================================ */
export const money = (n) => '$' + (n < 0 ? '-' : '') + Math.abs(Number(n) || 0).toFixed(2);

const SALEKINDS = ['sale', 'return'];

/* ----- sizes: a product is "sized" when it has a non-empty sizes[] ----- */
function isSized(p) { return Array.isArray(p.sizes) && p.sizes.length > 0; }
function sizeTotal(p) { return (p.sizes || []).reduce((s, z) => s + (parseInt(z.quantity) || 0), 0); }
function totalQty(p) { return isSized(p) ? sizeTotal(p) : (p.quantity || 0); }
function findSize(p, sizeId) { return (p.sizes || []).find((z) => z.id === sizeId) || null; }

function weekCampers(db, weekId) { return db.campers.filter((c) => c.weekId === weekId); }
function weekTabs(db, weekId) { return db.tabs.filter((t) => t.weekId === weekId); }
function weekTx(db, weekId) { return db.transactions.filter((t) => t.weekId === weekId && SALEKINDS.includes(t.kind)); }

function weekSales(db, weekId) {
  return +weekTx(db, weekId).reduce((s, t) => s + t.total, 0).toFixed(2);
}
function allSales(db) {
  return +db.transactions.filter((t) => SALEKINDS.includes(t.kind)).reduce((s, t) => s + t.total, 0).toFixed(2);
}
function outstandingTabs(db, weekId) {
  return +db.tabs.filter((t) => (weekId ? t.weekId === weekId : true) && !t.settled)
    .reduce((s, t) => s + t.balance, 0).toFixed(2);
}
function lowStock(db) {
  return db.products.filter((p) => p.active && p.trackQuantity && p.quantity <= db.settings.lowStock);
}
function camperSpent(db, camperId) {
  return +db.transactions.filter((t) => SALEKINDS.includes(t.kind) && t.payerType === 'camper' && t.payerId === camperId)
    .reduce((s, t) => s + t.total, 0).toFixed(2);
}
function ledgerFor(db, payerType, payerId) {
  return db.transactions.filter((t) => t.payerType === payerType && t.payerId === payerId)
    .sort((a, b) => b.ts - a.ts);
}

export const Store = {
  money, isSized, sizeTotal, totalQty, findSize,
  weekCampers, weekTabs, weekTx, weekSales, allSales,
  outstandingTabs, lowStock, camperSpent, ledgerFor,
};

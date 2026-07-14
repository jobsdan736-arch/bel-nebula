/**
 * Minimal in-memory store so payment references can't be processed twice
 * (e.g. once from the frontend's /verify call and again from the Paystack
 * webhook). This resets whenever the server restarts.
 *
 * For a real deployment, swap this for a proper database table
 * (reference, package_id, mac, phone, status, username, created_at).
 * Everything that touches `transactions` lives in this one file, so
 * that swap only means editing here.
 */

const transactions = new Map();

function savePending(reference, data) {
  transactions.set(reference, { status: 'pending', ...data });
}

function get(reference) {
  return transactions.get(reference);
}

function markFulfilled(reference, extra = {}) {
  const existing = transactions.get(reference) || {};
  transactions.set(reference, { ...existing, status: 'fulfilled', ...extra });
}

function isFulfilled(reference) {
  const tx = transactions.get(reference);
  return !!tx && tx.status === 'fulfilled';
}

module.exports = { savePending, get, markFulfilled, isFulfilled };

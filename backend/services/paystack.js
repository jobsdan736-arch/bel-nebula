const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const client = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Starts a transaction and returns Paystack's access_code, which the
 * frontend feeds into the Paystack Inline popup. Amount must be in kobo
 * (Naira x 100).
 */
async function initializeTransaction({ email, amountNaira, reference, metadata }) {
  const { data } = await client.post('/transaction/initialize', {
    email,
    amount: Math.round(amountNaira * 100),
    reference,
    metadata,
  });
  return data.data; // { authorization_url, access_code, reference }
}

/**
 * Confirms a transaction really succeeded. Never trust the frontend's word
 * for this — always re-check with Paystack before granting hotspot access.
 */
async function verifyTransaction(reference) {
  const { data } = await client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data.data; // includes status, amount, metadata, etc.
}

module.exports = { initializeTransaction, verifyTransaction };

const express = require('express');
const crypto = require('crypto');

const { listPackages, getPackage } = require('../config/packages');
const paystack = require('../services/paystack');
const mikrotik = require('../services/mikrotik');
const store = require('../services/store');
const { buildUsername, buildPassword, buildReference } = require('../utils/credentials');

const router = express.Router();

// GET /api/packages — used by the frontend to render the package cards
// from one source of truth instead of hardcoding prices twice.
router.get('/packages', (req, res) => {
  res.json({ packages: listPackages() });
});

// POST /api/payment/initialize
// body: { packageId, email, phone, mac }
router.post('/payment/initialize', async (req, res) => {
  try {
    const { packageId, email, phone, mac } = req.body;

    const pkg = getPackage(packageId);
    if (!pkg) {
      return res.status(400).json({ error: 'Unknown package selected.' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const reference = buildReference();
    // Paystack requires an email; students usually won't have one handy on
    // a captive portal, so we synthesize one from their phone number.
    const billingEmail = email || `${phone.replace(/\D/g, '')}@belnebula.customer`;

    const tx = await paystack.initializeTransaction({
      email: billingEmail,
      amountNaira: pkg.priceNaira,
      reference,
      metadata: { packageId, phone, mac: mac || null },
    });

    store.savePending(reference, { packageId, phone, mac: mac || null });

    res.json({
      reference,
      accessCode: tx.access_code,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
      amountNaira: pkg.priceNaira,
    });
  } catch (err) {
    console.error('initialize error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not start payment. Please try again.' });
  }
});

// Does the actual "payment confirmed -> create hotspot user" work.
// Shared by both the frontend's /verify call and the Paystack webhook so
// whichever one fires first wins, and the second is a safe no-op.
async function fulfil(reference) {
  if (store.isFulfilled(reference)) {
    return store.get(reference);
  }

  const pending = store.get(reference);
  const packageId = pending?.packageId;
  const pkg = getPackage(packageId);
  if (!pkg) throw new Error(`No matching package for reference ${reference}`);

  const verified = await paystack.verifyTransaction(reference);
  if (verified.status !== 'success') {
    throw new Error(`Payment not successful (status: ${verified.status})`);
  }
  if (Math.round(verified.amount) !== Math.round(pkg.priceNaira * 100)) {
    throw new Error('Paid amount does not match package price.');
  }

  const mac = pending?.mac || verified.metadata?.mac;
  const username = buildUsername(mac);
  const password = buildPassword();

  await mikrotik.createHotspotUser({
    username,
    password,
    profile: pkg.mikrotikProfile,
    limitUptime: pkg.limitUptime,
  });

  const expiresAt = new Date(Date.now() + pkg.durationSeconds * 1000).toISOString();

  store.markFulfilled(reference, { username, password, packageId, expiresAt });
  return store.get(reference);
}

// POST /api/payment/verify — called by the frontend right after the
// Paystack popup reports success, so we can hand back hotspot credentials
// immediately without waiting on the webhook round trip.
router.post('/payment/verify', async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ error: 'Reference is required.' });

    const result = await fulfil(reference);
    const pkg = getPackage(result.packageId);

    res.json({
      status: 'success',
      username: result.username,
      password: result.password,
      package: pkg.label,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    console.error('verify error:', err.message);
    res.status(400).json({ error: err.message || 'Could not verify payment.' });
  }
});

// POST /api/webhook/paystack — the trustworthy server-to-server path.
// Configure this URL in your Paystack dashboard. Signature check stops
// anyone but Paystack from triggering a "fake payment".
router.post('/webhook/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest('hex');

    if (signature !== expected) {
      return res.status(401).end();
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      await fulfil(event.data.reference).catch((err) =>
        console.error('webhook fulfil error:', err.message)
      );
    }

    res.sendStatus(200); // always ack quickly so Paystack doesn't retry forever
  } catch (err) {
    console.error('webhook error:', err.message);
    res.sendStatus(200);
  }
});

module.exports = router;

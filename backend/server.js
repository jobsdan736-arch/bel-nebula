require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const paymentRoutes = require('./routes/payment');
const { isMock } = require('./services/mikrotik');

const app = express();

app.use(cors()); // captive portal page may be served from a different host than the API
app.use(morgan('tiny'));

// Capture the raw request body (needed to verify the Paystack webhook
// signature) while still parsing JSON for every route.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mikrotikMockMode: isMock });
});

app.use('/api', paymentRoutes);

// Fallback error handler so unexpected exceptions return JSON, not an HTML
// stack trace, to a phone browser.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Bel-Nebula backend listening on port ${PORT}`);
  if (isMock) {
    console.log('MikroTik is in MOCK MODE — no router is configured yet. Set MIKROTIK_HOST in .env when ready.');
  }
});

const { RouterOSAPI } = require('node-routeros');

/**
 * Talks to the MikroTik router's API (port 8728, or 8729 for API-SSL) to
 * create a hotspot user after a payment succeeds.
 *
 * MOCK MODE: if MIKROTIK_HOST is not set, or MIKROTIK_MOCK=true, this
 * service logs what it *would* do instead of connecting to a real router.
 * That lets you build/test the payment flow end-to-end before the router
 * is wired up. Once you configure MikroTik, just set the env vars below
 * and mock mode turns off automatically.
 */
const isMock = !process.env.MIKROTIK_HOST || process.env.MIKROTIK_MOCK === 'true';

function getClient() {
  return new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASSWORD,
    port: Number(process.env.MIKROTIK_PORT || 8728),
    timeout: 8,
  });
}

/**
 * Creates (or refreshes) a hotspot user with a time budget.
 *
 * @param {Object} opts
 * @param {string} opts.username
 * @param {string} opts.password
 * @param {string} opts.profile        - hotspot user profile name on the router
 * @param {string} opts.limitUptime    - RouterOS duration, e.g. "1d", "7d"
 */
async function createHotspotUser({ username, password, profile, limitUptime }) {
  if (isMock) {
    console.log(
      `[mikrotik:mock] would create hotspot user "${username}" ` +
        `profile="${profile}" limit-uptime="${limitUptime}"`
    );
    return { mocked: true, username };
  }

  const conn = getClient();
  try {
    await conn.connect();

    // If the user already exists (e.g. they topped up again), remove the
    // old entry first so the uptime limit resets cleanly.
    const existing = await conn.write('/ip/hotspot/user/print', [
      `?name=${username}`,
    ]);
    if (existing.length > 0) {
      await conn.write('/ip/hotspot/user/remove', [`=.id=${existing[0]['.id']}`]);
    }

    await conn.write('/ip/hotspot/user/add', [
      `=name=${username}`,
      `=password=${password}`,
      `=profile=${profile}`,
      `=limit-uptime=${limitUptime}`,
      '=comment=bel-nebula:auto',
    ]);

    return { mocked: false, username };
  } finally {
    conn.close();
  }
}

/**
 * Optional housekeeping: removes hotspot users whose uptime limit has
 * long expired, so the user list doesn't grow forever. Safe to call on a
 * schedule (e.g. a daily cron) — RouterOS itself already blocks expired
 * users from re-authenticating, this just tidies the list.
 */
async function removeExpiredUsers() {
  if (isMock) {
    console.log('[mikrotik:mock] would sweep expired hotspot users');
    return { mocked: true };
  }
  // Left as a stub: RouterOS doesn't expose "expired" directly via API,
  // so a real implementation should track expiry timestamps in your own
  // database and remove the matching router users when they pass.
  return { mocked: false, note: 'implement using your own expiry records' };
}

module.exports = { createHotspotUser, removeExpiredUsers, isMock };

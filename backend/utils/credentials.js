const crypto = require('crypto');

/**
 * Builds a hotspot username/password pair for a paying student.
 *
 * We prefer the student's device MAC address as the username when the
 * router supplied one (this is what MikroTik's "MAC as username" hotspot
 * mode expects, and it stops one payment being shared across devices).
 * If no MAC is available (e.g. someone testing the page directly), we
 * fall back to a short random handle.
 */
function buildUsername(mac) {
  if (mac) return mac.toUpperCase();
  return 'bn-' + crypto.randomBytes(4).toString('hex');
}

function buildPassword() {
  return crypto.randomBytes(4).toString('hex'); // 8 hex chars, easy to type if ever needed
}

function buildReference(prefix = 'BN') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

module.exports = { buildUsername, buildPassword, buildReference };

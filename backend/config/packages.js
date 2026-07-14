/**
 * Bel-Nebula package catalogue.
 *
 * `mikrotikProfile` should match a Hotspot User Profile you create on the
 * router later (Setup guide will cover this). If you keep these exact
 * names when you configure MikroTik, the backend will work with zero changes.
 *
 * `limitUptime` is written to the MikroTik hotspot user's "limit-uptime"
 * field, which is what actually cuts the student off when their time is up
 * (format is RouterOS duration syntax, e.g. "3h", "1d", "7d", "30d").
 */

const PACKAGES = {
  '3hrs': {
    id: '3hrs',
    label: '3 Hours',
    description: 'Quick session',
    priceNaira: 250,
    durationSeconds: 3 * 60 * 60,
    limitUptime: '3h',
    mikrotikProfile: 'pkg-3hrs',
  },
  '24hrs': {
    id: '24hrs',
    label: '24 Hours',
    description: 'Unlimited for a full day',
    priceNaira: 500,
    durationSeconds: 24 * 60 * 60,
    limitUptime: '1d',
    mikrotikProfile: 'pkg-24hrs',
  },
  '1week': {
    id: '1week',
    label: '1 Week',
    description: 'Unlimited for 7 days',
    priceNaira: 3000,
    durationSeconds: 7 * 24 * 60 * 60,
    limitUptime: '7d',
    mikrotikProfile: 'pkg-1week',
  },
  '1month': {
    id: '1month',
    label: '1 Month',
    description: 'Unlimited for 30 days',
    priceNaira: 15000,
    durationSeconds: 30 * 24 * 60 * 60,
    limitUptime: '30d',
    mikrotikProfile: 'pkg-1month',
  },
};

function getPackage(id) {
  return PACKAGES[id] || null;
}

function listPackages() {
  return Object.values(PACKAGES);
}

module.exports = { PACKAGES, getPackage, listPackages };

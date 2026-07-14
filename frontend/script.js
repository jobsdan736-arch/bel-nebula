(function () {
  'use strict';

  // ---------- MikroTik hands us these via the redirect URL ----------
  // When a student's phone opens this page because MikroTik intercepted
  // their traffic, the router appends query params such as:
  //   ?mac=AA:BB:CC:DD:EE:FF&link-login-only=http://10.x.x.x/login&link-orig=...
  // We capture them so that after payment we can silently submit the
  // router's own login form instead of leaving the student stuck on our
  // "success" screen while still offline.
  const params = new URLSearchParams(window.location.search);
  const clientMac = params.get('mac');
  const linkLoginOnly = params.get('link-login-only') || params.get('link-login');
  const linkOrig = params.get('link-orig');

  // ---------- Elements ----------
  const packageListEl = document.getElementById('packageList');
  const phoneInputEl = document.getElementById('phoneInput');
  const payButtonEl = document.getElementById('payButton');
  const payBarLabelEl = document.getElementById('payBarLabel');
  const payBarPriceEl = document.getElementById('payBarPrice');
  const statusLineEl = document.getElementById('statusLine');
  const errorLineEl = document.getElementById('errorLine');

  const pickPanelEl = document.getElementById('pickPanel');
  const phonePanelEl = document.getElementById('phonePanel');
  const successPanelEl = document.getElementById('successPanel');
  const payBarEl = document.getElementById('payBar');

  const successPackageLabelEl = document.getElementById('successPackageLabel');
  const countdownValueEl = document.getElementById('countdownValue');
  const credUsernameEl = document.getElementById('credUsername');
  const credPasswordEl = document.getElementById('credPassword');

  let packages = [];
  let selectedPackageId = null;
  let countdownTimer = null;

  // ---------- Helpers ----------
  function showError(message) {
    errorLineEl.textContent = message;
    errorLineEl.hidden = false;
  }
  function clearError() {
    errorLineEl.hidden = true;
    errorLineEl.textContent = '';
  }

  function formatNaira(amount) {
    return '₦' + Number(amount).toLocaleString('en-NG');
  }

  function isValidPhone(value) {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10;
  }

  function updatePayBar() {
    const pkg = packages.find((p) => p.id === selectedPackageId);
    const phoneOk = isValidPhone(phoneInputEl.value);

    if (!pkg) {
      payBarLabelEl.textContent = 'Select a package';
      payBarPriceEl.textContent = '₦0';
      payButtonEl.disabled = true;
      return;
    }

    payBarLabelEl.textContent = pkg.label;
    payBarPriceEl.textContent = formatNaira(pkg.priceNaira);
    payButtonEl.disabled = !phoneOk;
  }

  // ---------- Render packages ----------
  function renderPackages() {
    packageListEl.innerHTML = '';
    packages.forEach((pkg) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'package-card';
      card.dataset.packageId = pkg.id;
      card.innerHTML =
        '<span class="package-card__label">' + pkg.label + '</span>' +
        '<span class="package-card__desc">' + pkg.description + '</span>' +
        '<span class="package-card__price">' + formatNaira(pkg.priceNaira) + '</span>';

      card.addEventListener('click', function () {
        selectedPackageId = pkg.id;
        Array.from(packageListEl.children).forEach((c) =>
          c.classList.toggle('is-selected', c.dataset.packageId === pkg.id)
        );
        updatePayBar();
      });

      packageListEl.appendChild(card);
    });
  }

  async function loadPackages() {
    try {
      const res = await fetch(API_BASE_URL + '/api/packages');
      const data = await res.json();
      packages = data.packages;
      renderPackages();
    } catch (err) {
      showError('Could not reach Bel-Nebula servers. Check your connection and reload this page.');
    }
  }

  // ---------- Payment flow ----------
  async function startPayment() {
    clearError();
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (!pkg) return showError('Choose a package first.');
    if (!isValidPhone(phoneInputEl.value)) return showError('Enter a valid phone number.');

    payButtonEl.disabled = true;
    payButtonEl.textContent = 'Starting payment…';

    try {
      const res = await fetch(API_BASE_URL + '/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          phone: phoneInputEl.value.trim(),
          mac: clientMac,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start payment.');

      openPaystackPopup(data);
    } catch (err) {
      showError(err.message);
      payButtonEl.disabled = false;
      payButtonEl.textContent = 'Pay & connect';
    }
  }

  function openPaystackPopup(initData) {
    const popup = new PaystackPop();
    popup.resumeTransaction(initData.accessCode, {
      onSuccess: function (transaction) {
        verifyPayment(transaction.reference || initData.reference);
      },
      onCancel: function () {
        payButtonEl.disabled = false;
        payButtonEl.textContent = 'Pay & connect';
      },
      onError: function (err) {
        showError('Payment failed: ' + (err.message || 'please try again.'));
        payButtonEl.disabled = false;
        payButtonEl.textContent = 'Pay & connect';
      },
    });
  }

  async function verifyPayment(reference) {
    payButtonEl.textContent = 'Confirming payment…';
    try {
      const res = await fetch(API_BASE_URL + '/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment could not be confirmed.');

      showSuccess(data);
    } catch (err) {
      showError(err.message + ' If you were charged, contact support with reference ' + reference + '.');
      payButtonEl.disabled = false;
      payButtonEl.textContent = 'Pay & connect';
    }
  }

  // ---------- Success screen ----------
  function showSuccess(data) {
    pickPanelEl.hidden = true;
    phonePanelEl.hidden = true;
    payBarEl.hidden = true;
    successPanelEl.hidden = false;

    statusLineEl.textContent = 'Connected';
    statusLineEl.classList.add('is-live');

    successPackageLabelEl.textContent = data.package + ' — unlimited';
    credUsernameEl.textContent = data.username;
    credPasswordEl.textContent = data.password;

    startCountdown(new Date(data.expiresAt).getTime());
    attemptHotspotLogin(data.username, data.password);
  }

  function startCountdown(expiresAtMs) {
    function tick() {
      const remainingMs = expiresAtMs - Date.now();
      if (remainingMs <= 0) {
        countdownValueEl.textContent = '00:00:00';
        clearInterval(countdownTimer);
        return;
      }
      const totalSeconds = Math.floor(remainingMs / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (n) => String(n).padStart(2, '0');
      countdownValueEl.textContent = days > 0
        ? days + 'd ' + pad(hours) + ':' + pad(minutes) + ':' + pad(seconds)
        : pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // ---------- Auto-login to the MikroTik hotspot ----------
  // MikroTik's own login form lives at `link-login-only` (a URL on the
  // router itself). Submitting it with the freshly created hotspot
  // username/password is what actually opens the student's internet
  // access — our "success" screen alone doesn't do that.
  function attemptHotspotLogin(username, password) {
    if (!linkLoginOnly) return; // page was opened directly, not through the router — nothing to submit

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = linkLoginOnly;
    form.style.display = 'none';

    const fields = { username: username, password: password, dst: linkOrig || '' };
    Object.keys(fields).forEach((name) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = fields[name];
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  }

  // ---------- Wire up events ----------
  phoneInputEl.addEventListener('input', updatePayBar);
  payButtonEl.addEventListener('click', startPayment);

  loadPackages();
})();

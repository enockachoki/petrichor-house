// M-Pesa payment pop-up, shared by the main site and the order tracking page.
// PetrichorPay.open({ kind, ref, amount, phone, title }) resolves to 'paid' or 'closed'.
window.PetrichorPay = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const kes = (n) => 'KES ' + Number(n).toLocaleString('en-KE');

  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  // Same rule as the server: Safaricom 07xx / 01xx numbers in any common spelling.
  const normal = (raw) => {
    const d = String(raw || '').replace(/[^\d]/g, '');
    const n = /^0[17]\d{8}$/.test(d) ? '254' + d.slice(1) : /^[17]\d{8}$/.test(d) ? '254' + d : d;
    return /^254[17]\d{8}$/.test(n) ? n : null;
  };
  const pretty = (n) => '0' + n.slice(3, 6) + ' ' + n.slice(6, 9) + ' ' + n.slice(9);

  const PHONE_SVG = `<svg class="pp-phone-ico" viewBox="0 0 64 96" aria-hidden="true"><rect x="6" y="2" width="52" height="92" rx="9" fill="#121212"/><rect x="11" y="12" width="42" height="68" rx="3" fill="#2a7d2e"/><text x="32" y="44" text-anchor="middle" font-size="9" font-family="Jost,sans-serif" fill="#fff" font-weight="500">M-PESA</text><rect x="19" y="52" width="26" height="6" rx="3" fill="#fff" opacity=".75"/><circle cx="32" cy="87" r="3" fill="#444"/></svg>`;

  let root;
  function mount() {
    if (root) return root;
    root = document.createElement('div');
    root.className = 'modal pay-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="modal-backdrop"></div><div class="modal-card pay-card"><button class="modal-close" aria-label="Close">×</button><div class="pay-body"></div></div>`;
    document.body.appendChild(root);
    return root;
  }

  function open({ kind, ref, amount, phone, title = 'Pay with M-Pesa' }) {
    mount();
    const body = $('.pay-body', root);
    let timer = null;
    let done;
    const result = new Promise((r) => (done = r));
    let paid = false;

    const close = () => {
      clearTimeout(timer);
      root.classList.remove('open');
      document.body.classList.remove('pay-open');
      done(paid ? 'paid' : 'closed');
    };
    $('.modal-close', root).onclick = close;
    $('.modal-backdrop', root).onclick = () => !paid && close();

    function askNumber(err = '') {
      body.innerHTML = `
        <p class="eyebrow">Lipa na M-Pesa</p>
        <h3>${esc(title)}</h3>
        <div class="pay-amount"><span>${kes(amount)}</span><small>to THE PETRICHOR · ref ${esc(ref)}</small></div>
        <form class="pay-form">
          <label class="field">Which M-Pesa number should we send the prompt to?
            <input name="phone" inputmode="tel" autocomplete="tel" placeholder="07xx xxx xxx" value="${esc(phone || '')}" required />
          </label>
          <p class="pay-hint">You'll get a pop-up on that phone asking for your M-Pesa PIN. It can be any Safaricom number, not just your own.</p>
          <div class="error">${esc(err)}</div>
          <button class="btn pay-go" type="submit">Send M-Pesa prompt</button>
        </form>`;
      const input = $('input', body);
      input.focus();
      $('form', body).onsubmit = async (e) => {
        e.preventDefault();
        const n = normal(input.value);
        if (!n) return askNumber('Enter a Safaricom number, like 0712 345 678.');
        phone = input.value;
        const btn = $('button', body);
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
          const pay = await api('/api/payments', { method: 'POST', body: { kind, ref, phone: n } });
          waiting(pay, n);
        } catch (err2) {
          askNumber(err2.message);
        }
      };
    }

    function waiting(pay, n) {
      const demo = pay.mode === 'demo';
      body.innerHTML = `
        <p class="eyebrow">Prompt sent</p>
        <h3>Check ${esc(pretty(n))}</h3>
        <div class="pp-stage">
          ${demo ? `
          <div class="stk" role="group" aria-label="M-Pesa prompt preview">
            <div class="stk-notch"></div>
            <div class="stk-dialog">
              <p>Do you want to pay <b>Ksh ${Number(pay.amount).toLocaleString('en-KE')}</b> to <b>${esc(pay.payee)}</b>? Account no. ${esc(pay.targetRef)}</p>
              <p>Enter M-PESA PIN:</p>
              <input class="stk-pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••" aria-label="Demo PIN" />
              <div class="stk-btns"><button type="button" data-a="cancel">Cancel</button><button type="button" data-a="pay">OK</button></div>
            </div>
          </div>` : `<div class="pp-ring">${PHONE_SVG}<i></i><i></i><i></i></div>`}
        </div>
        <p class="pay-hint">${demo
          ? 'Demo mode: no money moves. This is what the prompt looks like on the phone. Type any 4 digits and press OK.'
          : 'Unlock the phone, enter your M-Pesa PIN and press OK. We’ll confirm here as soon as Safaricom tells us.'}</p>
        <div class="actions"><button class="btn ghost small" type="button" data-again>Use another number</button><span class="pp-wait">Waiting for payment<span class="dots3"><i>.</i><i>.</i><i>.</i></span></span></div>`;
      $('[data-again]', body).onclick = () => { clearTimeout(timer); askNumber(); };
      if (demo) {
        const pin = $('.stk-pin', body);
        pin.focus();
        body.querySelectorAll('.stk-btns button').forEach((b) => (b.onclick = async () => {
          if (b.dataset.a === 'pay' && !/^\d{4}$/.test(pin.value)) {
            pin.classList.add('shake');
            return setTimeout(() => pin.classList.remove('shake'), 500);
          }
          b.disabled = true;
          try {
            const r = await api(`/api/payments/${pay.id}/simulate`, { method: 'POST', body: { action: b.dataset.a } });
            settle(r);
          } catch (e) {
            askNumber(e.message);
          }
        }));
      }
      const poll = async () => {
        try {
          const r = await api(`/api/payments/${pay.id}`);
          if (r.status !== 'pending') return settle(r);
        } catch {}
        timer = setTimeout(poll, 3000);
      };
      timer = setTimeout(poll, 3000);
    }

    function settle(r) {
      clearTimeout(timer);
      if (r.status === 'paid') {
        paid = true;
        body.innerHTML = `
          <div class="pp-ok">
            <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36" /><path d="M24 41l11 11 22-24" /></svg>
            <h3>Paid, thank you</h3>
            <p>${kes(r.amount)} received${r.receipt ? ` · M-Pesa code <b>${esc(r.receipt)}</b>` : ''}</p>
            <button class="btn" type="button" data-done>Continue</button>
          </div>`;
        $('[data-done]', body).onclick = close;
      } else {
        body.innerHTML = `
          <p class="eyebrow">Not paid</p>
          <h3>The payment didn't go through</h3>
          <p class="pay-hint">${esc(r.resultDesc || 'The prompt was cancelled or timed out.')} Nothing was taken from your account.</p>
          <div class="actions"><button class="btn ghost" type="button" data-close>Later</button><button class="btn" type="button" data-retry>Try again</button></div>`;
        $('[data-retry]', body).onclick = () => askNumber();
        $('[data-close]', body).onclick = close;
      }
    }

    askNumber();
    root.classList.add('open');
    document.body.classList.add('pay-open');
    return result;
  }

  return { open, normal };
})();

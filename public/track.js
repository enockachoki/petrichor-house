// The Petrichor: order tracking page. Shows an order's items, payment and progress, with the kitchen at work.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const kes = (n) => 'KES ' + Number(n).toLocaleString('en-KE');
  const fmtDate = (date) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

  const recentKey = 'petrichor-orders';
  const recent = () => { try { return JSON.parse(localStorage.getItem(recentKey) || '[]'); } catch { return []; } };
  const remember = (r) => { try { localStorage.setItem(recentKey, JSON.stringify([r, ...recent().filter((x) => x !== r)].slice(0, 8))); } catch {} };

  // ---------- the kitchen, drawn ----------
  const SCENES = {
    pay: `<div class="scene scene-pay"><div class="pp-ring"><svg class="pp-phone-ico" viewBox="0 0 64 96" aria-hidden="true"><rect x="6" y="2" width="52" height="92" rx="9" fill="#121212" stroke="#d9a866" stroke-width="2"/><rect x="11" y="12" width="42" height="68" rx="3" fill="#2a7d2e"/><text x="32" y="44" text-anchor="middle" font-size="9" font-family="Jost,sans-serif" fill="#fff" font-weight="500">M-PESA</text><rect x="19" y="52" width="26" height="6" rx="3" fill="#fff" opacity=".75"/></svg><i></i><i></i><i></i></div></div>`,
    cook: `<div class="scene scene-cook">
      <svg viewBox="0 0 320 260" aria-hidden="true">
        <defs>
          <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
          <linearGradient id="panG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#151515"/></linearGradient>
        </defs>
        <ellipse class="glow" cx="160" cy="214" rx="120" ry="36" fill="url(#glow)"/>
        <g class="steam" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round">
          <path class="s1" d="M128 120c-10-14 10-22 0-38s8-24 0-36"/>
          <path class="s2" d="M160 116c-10-14 10-22 0-38s8-24 0-36"/>
          <path class="s3" d="M192 120c-10-14 10-22 0-38s8-24 0-36"/>
        </g>
        <g class="pan">
          <path d="M80 164h160c0 22-26 34-80 34s-80-12-80-34z" fill="url(#panG)"/>
          <ellipse cx="160" cy="164" rx="80" ry="12" fill="#2b2b2b" stroke="#4a4a4a" stroke-width="3"/>
          <g class="food">
            <g class="bit b1"><rect x="116" y="150" width="26" height="16" rx="7" fill="#7a3b1e"/><rect x="122" y="154" width="6" height="8" rx="2" fill="#a2522b"/></g>
            <g class="bit b2"><ellipse cx="164" cy="160" rx="22" ry="8" fill="#5b2c17"/><ellipse cx="164" cy="157" rx="17" ry="4" fill="#8a4626"/></g>
            <g class="bit b3"><path d="M190 152c8-6 18-2 18 6s-10 10-18 4z" fill="#3b7a2a"/></g>
            <g class="bit b4"><circle cx="146" cy="154" r="6" fill="#c0392b"/></g>
            <g class="bit b5"><path d="M180 150l12 2-5 9z" fill="#e8c08a"/></g>
          </g>
          <rect x="236" y="158" width="74" height="12" rx="6" fill="#8e5a2b"/>
          <rect x="236" y="158" width="18" height="12" rx="3" fill="#444"/>
        </g>
        <g class="flames">
          <path class="f1" d="M120 232c-10-14 2-22 6-34 4 12 16 18 6 34z" fill="#ff7a1a"/>
          <path class="f2" d="M152 234c-12-18 2-28 8-44 6 16 20 24 8 44z" fill="#ffb23c"/>
          <path class="f3" d="M188 232c-10-14 2-22 6-34 4 12 16 18 6 34z" fill="#ff7a1a"/>
          <path class="f4" d="M140 234c-6-8 2-14 4-20 2 6 10 12 4 20z" fill="#fff1b0"/>
          <path class="f5" d="M172 234c-6-8 2-14 4-20 2 6 10 12 4 20z" fill="#fff1b0"/>
        </g>
        <rect x="92" y="234" width="136" height="10" rx="5" fill="#2a2a2a"/>
      </svg>
      <div class="sizzle"><span>sizzle</span><span>tss</span><span>sizzle</span></div>
    </div>`,
    ride: `<div class="scene scene-ride">
      <svg viewBox="0 0 320 220" aria-hidden="true">
        <g class="road" stroke="#d9a866" stroke-width="4" stroke-linecap="round" stroke-dasharray="22 18"><line x1="-40" y1="196" x2="380" y2="196"/></g>
        <g class="wind" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"><line x1="30" y1="96" x2="80" y2="96"/><line x1="10" y1="122" x2="70" y2="122"/><line x1="40" y1="148" x2="84" y2="148"/></g>
        <g class="bike">
          <rect x="112" y="78" width="54" height="46" rx="6" fill="#8e2232"/><path d="M118 92h42" stroke="#e8c08a" stroke-width="3"/>
          <path d="M120 150h86l18-30h-30l-20 22h-54z" fill="#e8e6e1"/>
          <path d="M206 120l14-34" stroke="#e8e6e1" stroke-width="6" stroke-linecap="round"/><path d="M212 86h20" stroke="#121212" stroke-width="6" stroke-linecap="round"/>
          <circle cx="178" cy="62" r="14" fill="#3b7a2a"/><path d="M168 76h22l10 34h-36z" fill="#d9a866"/>
          <g class="wheel"><circle cx="128" cy="168" r="22" fill="#121212" stroke="#555" stroke-width="5"/><path d="M128 150v36M110 168h36" stroke="#777" stroke-width="2"/></g>
          <g class="wheel"><circle cx="226" cy="168" r="22" fill="#121212" stroke="#555" stroke-width="5"/><path d="M226 150v36M208 168h36" stroke="#777" stroke-width="2"/></g>
        </g>
      </svg>
    </div>`,
    done: `<div class="scene scene-done">
      <svg viewBox="0 0 320 240" aria-hidden="true">
        <g class="sparks" fill="#e8c08a"><circle cx="70" cy="70" r="5"/><circle cx="252" cy="58" r="4"/><circle cx="270" cy="128" r="5"/><circle cx="52" cy="140" r="4"/><path d="M160 20l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/></g>
        <ellipse cx="160" cy="196" rx="120" ry="18" fill="#e8e6e1"/>
        <ellipse cx="160" cy="190" rx="92" ry="11" fill="#fff"/>
        <g class="dish"><ellipse cx="160" cy="180" rx="50" ry="12" fill="#7a3b1e"/><circle cx="140" cy="172" r="7" fill="#3b7a2a"/><circle cx="178" cy="170" r="6" fill="#c0392b"/></g>
        <g class="cloche"><path d="M74 182a86 86 0 0 1 172 0z" fill="#d9a866"/><path d="M90 170a70 70 0 0 1 40-52" stroke="#fff" stroke-opacity=".5" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="160" cy="92" r="9" fill="#b8874a"/></g>
      </svg>
    </div>`,
    off: `<div class="scene scene-off"><svg viewBox="0 0 320 220" aria-hidden="true"><ellipse cx="160" cy="150" rx="110" ry="22" fill="#2a2a2a"/><ellipse cx="160" cy="144" rx="84" ry="12" fill="#3a3a3a"/></svg></div>`,
  };

  const STEPS = [
    ['awaiting_payment', 'Paid', 'M-Pesa payment received'],
    ['received', 'In the kitchen', 'Your ticket is on the rail'],
    ['preparing', 'Cooking', 'On the grill and in the pan'],
    ['out_for_delivery', 'On the way', 'Riding out to you'],
    ['delivered', 'Delivered', 'Enjoy your meal'],
  ];
  const STAGE = {
    awaiting_payment: ['pay', 'Waiting for payment', 'Pay with M-Pesa to send your order to the kitchen.'],
    received: ['cook', 'The kitchen has your order', 'Your ticket is in. The pans are heating up.'],
    preparing: ['cook', 'Cooking now', 'Sizzling away. It leaves with the next run.'],
    out_for_delivery: ['ride', 'On the way to you', 'Our rider is out with your food.'],
    delivered: ['done', 'Delivered. Karibu!', 'Enjoy your meal. Thank you for ordering from The Petrichor.'],
    cancelled: ['off', 'This order was cancelled', 'Call us if you think this is a mistake.'],
  };

  let current = null;
  let timer = null;
  let shownScene = null;

  function drawRecent(active) {
    const list = recent();
    $('#recent').innerHTML = list.length ? `<span>On this device:</span>` + list.map((r) => `<a href="?ref=${esc(r)}" class="${r === active ? 'on' : ''}">${esc(r)}</a>`).join('') : '';
  }

  function render(o) {
    current = o;
    const [scene, title, lede] = STAGE[o.status] || STAGE.received;
    $('#tTitle').textContent = title;
    $('#tLede').innerHTML = `${esc(lede)} <span class="ref-chip">${esc(o.ref)}</span>`;
    if (shownScene !== scene) {
      $('#stage').innerHTML = SCENES[scene];
      shownScene = scene;
    }
    $('#details').hidden = false;

    const at = o.status === 'cancelled' ? -1 : STEPS.findIndex(([s]) => s === o.status);
    $('#timeline').innerHTML = STEPS.map(([, name, sub], i) => {
      const state = o.status === 'cancelled' ? '' : i < at || (i === 0 && o.paid) || (i === at && o.status === 'delivered') ? 'done' : i === at ? 'now' : '';
      return `<li class="${state}"><i></i><b>${name}</b><small>${sub}</small></li>`;
    }).join('');

    $('#items').innerHTML = o.items.map((i) => `<li><span><b class="q">${i.qty}×</b> ${esc(i.name)}<small>${kes(i.price)} each</small></span><span>${kes(i.line)}</span></li>`).join('');
    $('#sums').innerHTML = `
      <div><span>Subtotal</span><span>${kes(o.subtotal)}</span></div>
      <div><span>Delivery</span><span>${o.fee ? kes(o.fee) : 'Free'}</span></div>
      <div class="grand"><span>Total</span><span>${kes(o.total)}</span></div>`;
    const dest = o.destination.type === 'room' ? `Studio ${esc(o.destination.room)}` : esc(o.destination.address);
    $('#facts').innerHTML = `
      <li><span>Delivery run</span><b>${fmtDate(o.date)}, leaves at ${esc(o.slot)}</b></li>
      <li><span>To</span><b>${dest}</b></li>
      <li><span>Name</span><b>${esc(o.name)}</b></li>
      ${o.notes ? `<li><span>Notes</span><b>${esc(o.notes)}</b></li>` : ''}
      <li><span>Ordered</span><b>${new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</b></li>`;
    $('#payBox').innerHTML = o.paid
      ? `<p class="paid-badge">Paid by M-Pesa${o.receipt ? ` · ${esc(o.receipt)}` : ''}</p>`
      : o.status === 'awaiting_payment'
        ? `<p class="pay-note">Not paid yet. Your place on the run is held for 15 minutes from ordering.</p><button class="btn" id="payNow">Pay ${kes(o.total)} with M-Pesa</button>`
        : '';
    if ($('#payNow')) $('#payNow').onclick = async () => {
      if ((await window.PetrichorPay.open({ kind: 'order', ref: o.ref, amount: o.total, phone: o.phone, title: 'Pay to confirm your order' })) === 'paid') load(o.ref);
    };
    $('#waLink').href = `https://wa.me/254796306263?text=${encodeURIComponent(`Hello The Petrichor, about my order ${o.ref}`)}`;
    document.title = `${o.ref} · ${title} · The Petrichor`;
    drawRecent(o.ref);
  }

  async function load(r) {
    clearTimeout(timer);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(r)}`);
      const o = await res.json();
      if (!res.ok) throw new Error(o.error || 'Order not found');
      remember(o.ref);
      render(o);
      // Keep watching until the food arrives.
      if (!['delivered', 'cancelled'].includes(o.status)) timer = setTimeout(() => load(o.ref), 15000);
    } catch (e) {
      $('#tTitle').textContent = 'Order not found';
      $('#tLede').textContent = `${e.message}. Check the reference (it starts with DL) or call +254 796 306 263.`;
      $('#stage').innerHTML = SCENES.off;
      shownScene = 'off';
      $('#details').hidden = true;
    }
  }

  $('#trackForm').onsubmit = (e) => {
    e.preventDefault();
    const r = e.target.ref.value.trim().toUpperCase();
    history.replaceState(null, '', `?ref=${encodeURIComponent(r)}`);
    load(r);
  };

  const start = new URLSearchParams(location.search).get('ref');
  drawRecent(start);
  if (start) {
    $('#trackForm').ref.value = start.toUpperCase();
    load(start);
  } else {
    $('#stage').innerHTML = SCENES.cook;
    shownScene = 'cook';
  }
})();

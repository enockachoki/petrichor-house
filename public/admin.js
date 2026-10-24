// The Petrichor Kakamega: staff dashboard.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const kes = (n) => 'KES ' + Number(n).toLocaleString('en-KE');
  const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  const addDays = (date, n) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const paidCell = (x) => (x.paid || x.payment === 'paid' ? `${pill('paid')}${x.receipt ? `<br><small>${esc(x.receipt)}</small>` : ''}` : x.payment === 'on_site' ? pill('on_site') : pill('unpaid'));
  const pill = (s) => `<span class="pill ${esc(s)}">${esc(String(s).replace(/_/g, ' '))}</span>`;

  let token = null;
  try { token = sessionStorage.getItem('ph-token'); } catch {}

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api/admin' + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') { signOut(); throw new Error('Please sign in again'); }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  const attempt = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message); } };

  function signOut() {
    token = null;
    try { sessionStorage.removeItem('ph-token'); } catch {}
    $('#shell').style.display = 'none';
    $('#login').style.display = 'grid';
  }

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/login', { method: 'POST', body: { password: e.target.password.value } });
      token = r.token;
      try { sessionStorage.setItem('ph-token', token); } catch {}
      start();
    } catch (err) {
      $('#loginError').textContent = err.message;
    }
  };
  $('#logout').onclick = signOut;

  let current = 'overview';
  function start() {
    $('#login').style.display = 'none';
    $('#shell').style.display = 'grid';
    $$('aside [data-view]').forEach((b) => (b.onclick = () => show(b.dataset.view)));
    show(current);
  }
  async function show(view) {
    current = view;
    $$('aside [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    try {
      await VIEWS[view]($('#view'));
    } catch (e) {
      $('#view').innerHTML = `<p class="error">${esc(e.message)}</p>`;
    }
  }
  const refresh = () => show(current);

  const statusSelect = (kind, rec, options) =>
    `<select data-status="${kind}" data-id="${rec.id}">${options.map((o) => `<option value="${o}" ${o === rec.status ? 'selected' : ''}>${o.replace(/_/g, ' ')}</option>`).join('')}</select>`;
  function bindStatus(root) {
    $$('[data-status]', root).forEach((s) => (s.onchange = () => attempt(async () => { await api(`/${s.dataset.status}/${s.dataset.id}`, { method: 'PATCH', body: { status: s.value } }); refresh(); }, 'Status updated')));
  }

  const VIEWS = {
    async payments(el) {
      const list = await api('/payments');
      const f = VIEWS.payments.filter || 'all';
      const shown = list.filter((x) => f === 'all' || x.status === f);
      const total = list.filter((x) => x.status === 'paid').reduce((s, x) => s + x.amount, 0);
      const what = { order: 'Food order', reservation: 'Table pre-order', booking: 'Room' };
      el.innerHTML = `
        <h1>M-Pesa payments</h1><p class="sub">Every STK prompt sent from the website. ${kes(total)} received in all.</p>
        <div class="filters"><label class="field">Show<select id="pFilter">${['all', 'paid', 'pending', 'failed'].map((x) => `<option ${x === f ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
        <div class="card">${shown.length ? `<table class="data"><tr><th>When</th><th>For</th><th>Reference</th><th>Phone</th><th>Amount</th><th>M-Pesa code</th><th>Status</th></tr>
          ${shown.map((x) => `<tr><td><small>${new Date(x.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></td><td>${what[x.kind] || x.kind}${x.mode === 'demo' ? ' <small>(demo)</small>' : ''}</td><td><b>${esc(x.targetRef)}</b></td><td>${esc(x.phone)}</td><td>${kes(x.amount)}</td><td>${esc(x.receipt) || '<small>–</small>'}</td><td>${pill(x.status)}${x.resultDesc && x.status !== 'paid' ? `<br><small>${esc(x.resultDesc)}</small>` : ''}</td></tr>`).join('')}
        </table>` : '<p class="empty">No payments yet.</p>'}</div>`;
      $('#pFilter').onchange = (e) => { VIEWS.payments.filter = e.target.value; refresh(); };
    },

    async overview(el) {
      const o = await api('/overview');
      el.innerHTML = `
        <h1>Good day</h1><p class="sub">${fmtDate(o.today)} · Kakamega time</p>
        ${o.paymentMode === 'demo' ? '<p class="banner">M-Pesa is in <b>demo mode</b>: payments on the website are pretend and no money moves. Add your Daraja details in <code>mpesa.json</code> to take real payments.</p>' : ''}
        <div class="kpis">
          <div class="kpi"><span>Occupancy tonight</span><b>${o.occupancy}%</b></div>
          <div class="kpi"><span>Rooms occupied</span><b>${o.rooms.occupiedTonight} / ${o.rooms.active}</b></div>
          <div class="kpi"><span>Arrivals today</span><b>${o.arrivals.length}</b></div>
          <div class="kpi"><span>Tables today</span><b>${o.reservationsToday.length}</b></div>
          <div class="kpi"><span>Deliveries today</span><b>${o.ordersToday.length}</b></div>
          <div class="kpi"><span>New event enquiries</span><b>${o.newEnquiries.length}</b></div>
          <div class="kpi"><span>M-Pesa today</span><b style="font-size:1.7rem">${kes(o.paidToday)}</b></div>
          <div class="kpi"><span>Booked revenue</span><b style="font-size:1.7rem">${kes(o.revenue)}</b></div>
        </div>
        <div class="two">
          <div class="card"><h3>Arrivals</h3>${o.arrivals.length ? `<table class="data"><tr><th>Ref</th><th>Guest</th><th>Room</th><th></th></tr>${o.arrivals.map((b) => `<tr><td>${b.ref}</td><td>${esc(b.name)}</td><td>${esc(b.roomNumber)} · ${esc(b.typeName)}</td><td><button class="mini primary" data-checkin="${b.id}">Check in</button></td></tr>`).join('')}</table>` : '<p class="empty">No arrivals today.</p>'}</div>
          <div class="card"><h3>Departures</h3>${o.departures.length ? `<table class="data"><tr><th>Ref</th><th>Guest</th><th>Room</th><th></th></tr>${o.departures.map((b) => `<tr><td>${b.ref}</td><td>${esc(b.name)}</td><td>${esc(b.roomNumber)}</td><td><button class="mini primary" data-checkout="${b.id}">Check out</button></td></tr>`).join('')}</table>` : '<p class="empty">No departures today.</p>'}</div>
        </div>
        <div class="two">
          <div class="card"><h3>Today's tables</h3>${o.reservationsToday.length ? `<table class="data"><tr><th>Time</th><th>Guest</th><th>Party</th><th>Table</th><th>Status</th></tr>${o.reservationsToday.map((r) => `<tr><td>${r.time}</td><td>${esc(r.name)}<br><small>${esc(r.phone)}</small></td><td>${r.partySize}</td><td>${esc(r.tableName)}</td><td>${pill(r.status)}</td></tr>`).join('')}</table>` : '<p class="empty">No table bookings today.</p>'}</div>
          <div class="card"><h3>Delivery runs today</h3><table class="data"><tr><th>Run</th><th>Orders</th><th>Places left</th><th></th></tr>${o.deliverySlots.map((s) => `<tr><td>${s.time}</td><td>${o.ordersToday.filter((x) => x.slot === s.time).length}</td><td>${s.remaining}</td><td>${s.closed ? pill('closed') : pill('active')}</td></tr>`).join('')}</table></div>
        </div>`;
      $$('[data-checkin]', el).forEach((b) => (b.onclick = () => attempt(async () => { await api(`/bookings/${b.dataset.checkin}`, { method: 'PATCH', body: { status: 'checked_in' } }); refresh(); }, 'Guest checked in')));
      $$('[data-checkout]', el).forEach((b) => (b.onclick = () => attempt(async () => { await api(`/bookings/${b.dataset.checkout}`, { method: 'PATCH', body: { status: 'checked_out' } }); refresh(); }, 'Guest checked out')));
    },

    async calendar(el) {
      VIEWS.calendar.start ||= new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
      const start = VIEWS.calendar.start;
      const [cal, bookings, rooms] = await Promise.all([api(`/calendar?start=${start}&days=21`), api('/bookings'), api('/rooms')]);
      const end = addDays(start, 21);
      const live = bookings.filter((b) => !['cancelled', 'checked_out'].includes(b.status) && b.checkIn < end && b.checkOut > start);
      el.innerHTML = `
        <h1>Room availability</h1><p class="sub">Open rooms per night, and who is in each room.</p>
        <div class="filters"><button class="mini" id="cPrev">← 3 weeks</button><input type="date" id="cStart" value="${start}" class="mini" /><button class="mini" id="cNext">3 weeks →</button></div>
        <div class="card admin-cal"><div class="cal-wrap"><table class="cal">
          <thead><tr><th></th>${cal.dates.map((d) => `<th>${fmtDate(d).split(' ')[0]}<b>${d.slice(8)}</b></th>`).join('')}</tr></thead>
          <tbody>${cal.types.map((t) => `<tr><th>${esc(t.name)}<small>${t.total} room${t.total === 1 ? "" : "s"}</small></th>${t.free.map((n) => `<td><button disabled class="${n === 0 ? 'full' : n <= Math.max(1, Math.floor(t.total / 3)) ? 'low' : 'open'}" style="cursor:default"><span class="n">${n}</span></button></td>`).join('')}</tr>`).join('')}</tbody>
        </table></div></div>
        <div class="card"><h3>Room grid</h3><div class="cal-wrap" style="border-color:var(--line)"><table class="data">
          <tr><th>Room</th>${cal.dates.map((d) => `<th style="text-align:center">${d.slice(8)}</th>`).join('')}</tr>
          ${rooms.map((r) => `<tr><td><b>${esc(r.number)}</b> ${r.status === 'maintenance' ? pill('maintenance') : ''}</td>${cal.dates.map((d) => {
            const b = live.find((x) => x.roomId === r.id && x.checkIn <= d && x.checkOut > d);
            return `<td title="${b ? esc(b.name + ' · ' + b.ref) : 'free'}" style="padding:4px;background:${b ? (b.status === 'checked_in' ? '#e9d6ad' : '#c9dcc4') : r.status === 'maintenance' ? '#f2e0dc' : 'transparent'};border-left:1px solid var(--line);font-size:.7rem;text-align:center">${b && b.checkIn === d ? esc(b.name.split(' ')[0]) : ''}</td>`;
          }).join('')}</tr>`).join('')}
        </table></div><p class="sub" style="margin:12px 0 0">Green: confirmed · Gold: checked in · Red: maintenance. Hover a cell for the guest.</p></div>`;
      $('#cPrev').onclick = () => { VIEWS.calendar.start = addDays(start, -21); refresh(); };
      $('#cNext').onclick = () => { VIEWS.calendar.start = addDays(start, 21); refresh(); };
      $('#cStart').onchange = (e) => { VIEWS.calendar.start = e.target.value; refresh(); };
    },

    async bookings(el) {
      const list = await api('/bookings');
      const f = VIEWS.bookings.filter || 'active';
      const shown = list.filter((b) => f === 'all' || (f === 'active' ? ['confirmed', 'checked_in'].includes(b.status) : b.status === f));
      el.innerHTML = `
        <h1>Room bookings</h1><p class="sub">${list.length} total. Change a status to check guests in or out, or cancel.</p>
        <div class="filters"><label class="field">Show<select id="bFilter">${['active', 'all', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].map((x) => `<option ${x === f ? 'selected' : ''} value="${x}">${x.replace('_', ' ')}</option>`).join('')}</select></label></div>
        <div class="card">${shown.length ? `<table class="data"><tr><th>Ref</th><th>Guest</th><th>Room</th><th>Stay</th><th>Total</th><th>Payment</th><th>Requests</th><th>Status</th></tr>
          ${shown.map((b) => `<tr><td><b>${b.ref}</b></td><td>${esc(b.name)}<br><small>${esc(b.phone)} · ${esc(b.email)}</small></td><td>${esc(b.roomNumber)}<br><small>${esc(b.typeName)}</small></td><td>${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}<br><small>${b.nights} nights · ${b.guests} guests</small></td><td>${kes(b.total)}</td><td>${paidCell(b)}${b.payment !== 'paid' && b.status !== 'cancelled' ? `<br><button class="mini" data-markpaid="${b.id}" style="margin-top:4px">Mark paid</button>` : ''}</td><td><small>${esc(b.requests)}</small></td><td>${statusSelect('bookings', b, ['confirmed', 'checked_in', 'checked_out', 'cancelled'])}</td></tr>`).join('')}
        </table>` : '<p class="empty">No bookings match.</p>'}</div>`;
      $('#bFilter').onchange = (e) => { VIEWS.bookings.filter = e.target.value; refresh(); };
      $$('[data-markpaid]', el).forEach((b) => (b.onclick = () => attempt(async () => { await api(`/bookings/${b.dataset.markpaid}`, { method: 'PATCH', body: { payment: 'paid' } }); refresh(); }, 'Marked as paid')));
      bindStatus(el);
    },

    async rooms(el) {
      const [types, rooms] = await Promise.all([api('/room-types'), api('/rooms')]);
      el.innerHTML = `
        <h1>Rooms &amp; rates</h1><p class="sub">Set nightly rates, add rooms, or take a room out for maintenance. Changes show on the website immediately.</p>
        <div class="card"><h3>Room types</h3><table class="data"><tr><th>Name</th><th>Rate (KES)</th><th>Sleeps</th><th>Size m²</th><th>Rooms</th><th></th></tr>
          ${types.map((t) => `<tr data-type="${t.id}"><td><input data-f="name" value="${esc(t.name)}" /></td><td><input data-f="price" type="number" min="0" value="${t.price}" /></td><td><input data-f="capacity" type="number" min="1" value="${t.capacity}" /></td><td><input data-f="size" type="number" min="0" value="${t.size}" /></td><td>${rooms.filter((r) => r.typeId === t.id).length}</td><td class="row-actions"><button class="mini primary" data-save-type>Save</button><button class="mini danger" data-del-type>Delete</button></td></tr>`).join('')}
        </table>
        <form class="addform" id="addType"><label class="field">New type name<input name="name" required /></label><label class="field">Rate KES<input name="price" type="number" min="0" required /></label><label class="field">Sleeps<input name="capacity" type="number" min="1" value="2" required /></label><label class="field">Size m²<input name="size" type="number" min="0" value="40" /></label><label class="field">View<input name="view" value="Garden" /></label><button class="btn small">Add type</button></form></div>
        <div class="card"><h3>Rooms</h3><table class="data"><tr><th>Number</th><th>Type</th><th>Status</th><th></th></tr>
          ${rooms.map((r) => `<tr data-room="${r.id}"><td><input data-f="number" value="${esc(r.number)}" /></td><td><select data-f="typeId">${types.map((t) => `<option value="${t.id}" ${t.id === r.typeId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></td><td><select data-f="status"><option ${r.status === 'active' ? 'selected' : ''}>active</option><option ${r.status === 'maintenance' ? 'selected' : ''}>maintenance</option></select></td><td class="row-actions"><button class="mini primary" data-save-room>Save</button><button class="mini danger" data-del-room>Delete</button></td></tr>`).join('')}
        </table>
        <form class="addform" id="addRoom"><label class="field">Room number<input name="number" required /></label><label class="field">Type<select name="typeId">${types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label><button class="btn small">Add room</button></form></div>`;
      const fields = (tr) => Object.fromEntries($$('[data-f]', tr).map((i) => [i.dataset.f, i.value]));
      $$('[data-save-type]', el).forEach((b) => (b.onclick = () => { const tr = b.closest('tr'); attempt(() => api(`/room-types/${tr.dataset.type}`, { method: 'PUT', body: fields(tr) }), 'Room type saved'); }));
      $$('[data-del-type]', el).forEach((b) => (b.onclick = () => confirm('Delete this room type?') && attempt(async () => { await api(`/room-types/${b.closest('tr').dataset.type}`, { method: 'DELETE' }); refresh(); }, 'Deleted')));
      $$('[data-save-room]', el).forEach((b) => (b.onclick = () => { const tr = b.closest('tr'); attempt(async () => { await api(`/rooms/${tr.dataset.room}`, { method: 'PUT', body: fields(tr) }); refresh(); }, 'Room saved'); }));
      $$('[data-del-room]', el).forEach((b) => (b.onclick = () => confirm('Delete this room?') && attempt(async () => { await api(`/rooms/${b.closest('tr').dataset.room}`, { method: 'DELETE' }); refresh(); }, 'Deleted')));
      $('#addType').onsubmit = (e) => { e.preventDefault(); attempt(async () => { await api('/room-types', { method: 'POST', body: { ...Object.fromEntries(new FormData(e.target)), bed: 'King', tagline: '', description: 'A new room at The Petrichor.' } }); refresh(); }, 'Room type added'); };
      $('#addRoom').onsubmit = (e) => { e.preventDefault(); attempt(async () => { await api('/rooms', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); refresh(); }, 'Room added'); };
    },

    async reservations(el) {
      VIEWS.reservations.date ||= new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
      const d = VIEWS.reservations.date;
      const [list, tables] = await Promise.all([api('/reservations'), api('/tables')]);
      const day = list.filter((r) => d === 'all' || r.date === d).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      el.innerHTML = `
        <h1>Table bookings</h1><p class="sub">Garden, terrace and rooftop bar. Each seating holds a table for 90 minutes.</p>
        <div class="filters"><label class="field">Date<input type="date" id="rDate" value="${d === 'all' ? '' : d}" /></label><button class="mini" id="rAll">Show all dates</button></div>
        <div class="card">${day.length ? `<table class="data"><tr><th>Ref</th><th>Date</th><th>Time</th><th>Guest</th><th>Party</th><th>Table</th><th>Pre-order</th><th>Notes</th><th>Status</th></tr>
          ${day.map((r) => `<tr><td><b>${r.ref}</b></td><td>${fmtDate(r.date)}</td><td>${r.time}<br><small>${r.service}</small></td><td>${esc(r.name)}<br><small>${esc(r.phone)}</small></td><td>${r.partySize}</td><td>${esc(r.tableName)}<br><small>${esc(r.area)}</small></td><td><small>${(r.items || []).map((i) => `${i.qty}× ${esc(i.name)}`).join('<br>')}</small>${r.total ? `<br>${kes(r.total)} ${paidCell(r)}` : ''}</td><td><small>${esc(r.notes)}</small></td><td>${statusSelect('reservations', r, ['awaiting_payment', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'])}</td></tr>`).join('')}
        </table>` : '<p class="empty">No table bookings for this date.</p>'}</div>
        <div class="card"><h3>Floor for ${d === 'all' ? 'all dates' : fmtDate(d)}</h3><table class="data"><tr><th>Table</th><th>Seats</th><th>Area</th><th>Booked times</th></tr>
          ${tables.map((t) => `<tr><td>${esc(t.name)}</td><td>${t.capacity}</td><td>${esc(t.area)}</td><td>${day.filter((r) => r.tableId === t.id && r.status !== 'cancelled').map((r) => `${r.time} (${r.partySize})`).join(', ') || '<small>free</small>'}</td></tr>`).join('')}
        </table></div>`;
      $('#rDate').onchange = (e) => { VIEWS.reservations.date = e.target.value || 'all'; refresh(); };
      $('#rAll').onclick = () => { VIEWS.reservations.date = 'all'; refresh(); };
      bindStatus(el);
    },

    async enquiries(el) {
      const list = await api('/enquiries');
      const f = VIEWS.enquiries.filter || 'open';
      const shown = list.filter((e) => f === 'all' || (f === 'open' ? ['new', 'contacted'].includes(e.status) : e.status === f)).sort((a, b) => a.date.localeCompare(b.date));
      el.innerHTML = `
        <h1>Event enquiries</h1><p class="sub">Free venue requests from the website. Call the guest, then mark the request contacted, confirmed or declined. A confirmed event blocks that venue on that date.</p>
        <div class="filters"><label class="field">Show<select id="eFilter">${['open', 'all', 'new', 'contacted', 'confirmed', 'declined'].map((x) => `<option ${x === f ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
        <div class="card">${shown.length ? `<table class="data"><tr><th>Ref</th><th>Event date</th><th>Venue</th><th>Event</th><th>Guests</th><th>Contact</th><th>Notes</th><th>Status</th></tr>
          ${shown.map((e) => `<tr><td><b>${e.ref}</b></td><td>${fmtDate(e.date)}</td><td>${esc(e.venueName)}</td><td>${esc(e.eventType)}</td><td>${e.guests}</td><td>${esc(e.name)}<br><small><a href="tel:${esc(e.phone)}">${esc(e.phone)}</a>${e.email ? ' · ' + esc(e.email) : ''}</small><br><a class="mini" style="display:inline-block;margin-top:4px;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/${esc(e.phone.replace(/[^0-9]/g, '').replace(/^0/, '254'))}">WhatsApp</a></td><td><small>${esc(e.notes)}</small></td><td>${statusSelect('enquiries', e, ['new', 'contacted', 'confirmed', 'declined'])}</td></tr>`).join('')}
        </table>` : '<p class="empty">No enquiries match.</p>'}</div>`;
      $('#eFilter').onchange = (e) => { VIEWS.enquiries.filter = e.target.value; refresh(); };
      bindStatus(el);
    },

    async venues(el) {
      const venues = await api('/venues');
      el.innerHTML = `
        <h1>Grounds &amp; venues</h1><p class="sub">These show in the "Host your event" section. To use a real photo, put it in <code>public/photos/</code> and type its file name (for example <code>forest.jpg</code>); leave it empty for the drawn placeholder.</p>
        <div class="card"><table class="data"><tr><th>Name</th><th>Type</th><th>Capacity</th><th>Description</th><th>Photo file</th><th>Shown</th><th></th></tr>
          ${venues.map((v) => `<tr data-id="${v.id}"><td><input data-f="name" value="${esc(v.name)}" /></td><td><input data-f="kind" value="${esc(v.kind)}" /></td><td style="width:100px"><input data-f="capacity" type="number" min="1" value="${v.capacity}" /></td><td><input data-f="description" value="${esc(v.description)}" /></td><td><input data-f="photo" value="${esc(v.photo || '')}" placeholder="none" /></td><td><select data-f="active"><option value="true" ${v.active ? 'selected' : ''}>Yes</option><option value="false" ${!v.active ? 'selected' : ''}>No</option></select></td><td class="row-actions"><button class="mini primary" data-save>Save</button><button class="mini danger" data-del>Delete</button></td></tr>`).join('')}
        </table>
        <form class="addform" id="addVenue"><label class="field">Name<input name="name" required /></label><label class="field">Type<input name="kind" value="Outdoor ground" required /></label><label class="field">Capacity<input name="capacity" type="number" min="1" value="100" required /></label><label class="field">Description<input name="description" /></label><button class="btn small">Add venue</button></form></div>`;
      const fields = (tr) => Object.fromEntries($$('[data-f]', tr).map((i) => [i.dataset.f, i.value]));
      $$('[data-save]', el).forEach((b) => (b.onclick = () => { const tr = b.closest('tr'); attempt(() => api(`/venues/${tr.dataset.id}`, { method: 'PUT', body: fields(tr) }), 'Venue saved'); }));
      $$('[data-del]', el).forEach((b) => (b.onclick = () => confirm('Delete this venue?') && attempt(async () => { await api(`/venues/${b.closest('tr').dataset.id}`, { method: 'DELETE' }); refresh(); }, 'Deleted')));
      $('#addVenue').onsubmit = (e) => { e.preventDefault(); attempt(async () => { await api('/venues', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); refresh(); }, 'Venue added'); };
    },

    async tables(el) {
      const tables = await api('/tables');
      el.innerHTML = `
        <h1>Tables</h1><p class="sub">Inactive tables are hidden from online booking.</p>
        <div class="card"><table class="data"><tr><th>Name</th><th>Seats</th><th>Area</th><th>Bookable</th><th></th></tr>
          ${tables.map((t) => `<tr data-id="${t.id}"><td><input data-f="name" value="${esc(t.name)}" /></td><td><input data-f="capacity" type="number" min="1" value="${t.capacity}" /></td><td><input data-f="area" value="${esc(t.area)}" /></td><td><select data-f="active"><option value="true" ${t.active ? 'selected' : ''}>Yes</option><option value="false" ${!t.active ? 'selected' : ''}>No</option></select></td><td class="row-actions"><button class="mini primary" data-save>Save</button><button class="mini danger" data-del>Delete</button></td></tr>`).join('')}
        </table>
        <form class="addform" id="addTable"><label class="field">Name<input name="name" required placeholder="T10" /></label><label class="field">Seats<input name="capacity" type="number" min="1" value="4" required /></label><label class="field">Area<input name="area" value="Main Dining Room" required /></label><button class="btn small">Add table</button></form></div>`;
      const fields = (tr) => Object.fromEntries($$('[data-f]', tr).map((i) => [i.dataset.f, i.value]));
      $$('[data-save]', el).forEach((b) => (b.onclick = () => { const tr = b.closest('tr'); attempt(() => api(`/tables/${tr.dataset.id}`, { method: 'PUT', body: fields(tr) }), 'Table saved'); }));
      $$('[data-del]', el).forEach((b) => (b.onclick = () => confirm('Delete this table?') && attempt(async () => { await api(`/tables/${b.closest('tr').dataset.id}`, { method: 'DELETE' }); refresh(); }, 'Deleted')));
      $('#addTable').onsubmit = (e) => { e.preventDefault(); attempt(async () => { await api('/tables', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); refresh(); }, 'Table added'); };
    },

    async orders(el) {
      const list = await api('/orders');
      VIEWS.orders.date ||= new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
      const d = VIEWS.orders.date;
      const shown = list.filter((o) => d === 'all' || o.date === d).sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
      const slots = [...new Set(shown.map((o) => `${o.date} ${o.slot}`))];
      el.innerHTML = `
        <h1>Delivery orders</h1><p class="sub">Grouped by delivery run. Move orders through preparing → out for delivery → delivered.</p>
        <div class="filters"><label class="field">Date<input type="date" id="oDate" value="${d === 'all' ? '' : d}" /></label><button class="mini" id="oAll">Show all dates</button></div>
        ${slots.length ? slots.map((s) => {
          const [date, slot] = s.split(' ');
          const os = shown.filter((o) => o.date === date && o.slot === slot);
          return `<div class="card"><h3>${fmtDate(date)} · ${slot} run <small style="font-family:var(--sans);font-size:.8rem;color:var(--muted)">${os.length} orders</small></h3><table class="data"><tr><th>Ref</th><th>Guest</th><th>Deliver to</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr>
            ${os.map((o) => `<tr><td><b>${o.ref}</b></td><td>${esc(o.name)}<br><small>${esc(o.phone)}</small></td><td>${o.destination.type === 'room' ? 'Room ' + esc(o.destination.room) : esc(o.destination.address)}${o.notes ? `<br><small>${esc(o.notes)}</small>` : ''}</td><td><small>${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join('<br>')}</small></td><td>${kes(o.total)}</td><td>${paidCell(o)}</td><td>${statusSelect('orders', o, ['awaiting_payment', 'received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'])}</td></tr>`).join('')}
          </table></div>`;
        }).join('') : '<div class="card"><p class="empty">No delivery orders for this date.</p></div>'}`;
      $('#oDate').onchange = (e) => { VIEWS.orders.date = e.target.value || 'all'; refresh(); };
      $('#oAll').onclick = () => { VIEWS.orders.date = 'all'; refresh(); };
      bindStatus(el);
    },

    async menu(el) {
      const items = await api('/menu');
      const cats = [...new Set(items.map((m) => m.category))];
      el.innerHTML = `
        <h1>Menu &amp; prices</h1><p class="sub">Prices in KES. Hide an item when it runs out; untick delivery for dine-in only dishes.</p>
        ${cats.map((c) => `<div class="card"><h3>${esc(c)}</h3><table class="data"><tr><th>Dish</th><th>Description</th><th>Price</th><th>On menu</th><th>Delivery</th><th></th></tr>
          ${items.filter((m) => m.category === c).map((m) => `<tr data-id="${m.id}"><td><input data-f="name" value="${esc(m.name)}" /></td><td><input data-f="description" value="${esc(m.description)}" /></td><td style="width:120px"><input data-f="price" type="number" min="0" value="${m.price}" /></td><td><select data-f="available"><option value="true" ${m.available ? 'selected' : ''}>Yes</option><option value="false" ${!m.available ? 'selected' : ''}>No</option></select></td><td><select data-f="deliverable"><option value="true" ${m.deliverable ? 'selected' : ''}>Yes</option><option value="false" ${!m.deliverable ? 'selected' : ''}>No</option></select></td><td class="row-actions"><button class="mini primary" data-save>Save</button><button class="mini danger" data-del>Delete</button></td></tr>`).join('')}
        </table></div>`).join('')}
        <div class="card"><h3>Add a dish</h3><form class="addform" id="addDish" style="border:0;margin:0;padding:0"><label class="field">Category<input name="category" list="cats" required /><datalist id="cats">${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</datalist></label><label class="field">Name<input name="name" required /></label><label class="field">Description<input name="description" /></label><label class="field">Price KES<input name="price" type="number" min="0" required /></label><label class="field">Tags<input name="tags" placeholder="Vegan, Local" /></label><button class="btn small">Add dish</button></form></div>`;
      const fields = (tr) => Object.fromEntries($$('[data-f]', tr).map((i) => [i.dataset.f, i.value]));
      $$('[data-save]', el).forEach((b) => (b.onclick = () => { const tr = b.closest('tr'); attempt(() => api(`/menu/${tr.dataset.id}`, { method: 'PUT', body: fields(tr) }), 'Dish saved'); }));
      $$('[data-del]', el).forEach((b) => (b.onclick = () => confirm('Delete this dish?') && attempt(async () => { await api(`/menu/${b.closest('tr').dataset.id}`, { method: 'DELETE' }); refresh(); }, 'Deleted')));
      $('#addDish').onsubmit = (e) => { e.preventDefault(); attempt(async () => { await api('/menu', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); refresh(); }, 'Dish added'); };
    },

    async delivery(el) {
      const c = await api('/delivery-config');
      el.innerHTML = `
        <h1>Delivery settings</h1><p class="sub">Delivery runs leave every three hours by default. Adjust the runs, capacity and fees here.</p>
        <form class="card" id="dForm" style="display:grid;gap:16px;max-width:640px">
          <label class="field">Delivery runs (comma separated, 24h)<input name="slots" value="${c.slots.join(', ')}" /></label>
          <div class="grid-2">
            <label class="field">Orders per run<input name="capacityPerSlot" type="number" min="0" value="${c.capacityPerSlot}" /></label>
            <label class="field">Order cutoff (minutes before run)<input name="cutoffMinutes" type="number" min="0" value="${c.cutoffMinutes}" /></label>
            <label class="field">Fee outside the hotel (KES)<input name="feeOutside" type="number" min="0" value="${c.feeOutside}" /></label>
            <label class="field">Minimum order (KES)<input name="minimumOrder" type="number" min="0" value="${c.minimumOrder}" /></label>
          </div>
          <label class="field">In-room delivery<select name="freeInRoom"><option value="true" ${c.freeInRoom ? 'selected' : ''}>Free</option><option value="false" ${!c.freeInRoom ? 'selected' : ''}>Charge the fee</option></select></label>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn small">Save settings</button><button type="button" class="btn ghost small" id="every3">Reset to every 3 hours (06:00–21:00)</button></div>
        </form>`;
      $('#every3').onclick = () => ($('#dForm').slots.value = '06:00, 09:00, 12:00, 15:00, 18:00, 21:00');
      $('#dForm').onsubmit = (e) => { e.preventDefault(); attempt(async () => { await api('/delivery-config', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); refresh(); }, 'Delivery settings saved'); };
    },
  };

  if (token) start();
})();

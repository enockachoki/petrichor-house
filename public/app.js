// The Petrichor Kakamega: public site.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const kes = (n) => 'KES ' + Number(n).toLocaleString('en-KE');

  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  const addDays = (date, n) => {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const fmtDate = (date, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
  }

  let hotel, roomTypes = [], menu = [], TODAY;

  // ---------- ambience ----------
  function rain() {
    const c = $('#rain');
    if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = c.getContext('2d');
    let drops = [], w, h;
    const resize = () => {
      w = c.width = c.offsetWidth * devicePixelRatio;
      h = c.height = c.offsetHeight * devicePixelRatio;
      drops = Array.from({ length: Math.round((w * h) / 9000) }, () => ({ x: Math.random() * w, y: Math.random() * h, l: 8 + Math.random() * 22, v: 6 + Math.random() * 10, o: 0.08 + Math.random() * 0.25 }));
    };
    resize();
    addEventListener('resize', resize);
    (function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const d of drops) {
        ctx.strokeStyle = `rgba(212,180,124,${d.o})`;
        ctx.lineWidth = devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.l * 0.15, d.y + d.l);
        ctx.stroke();
        d.y += d.v;
        d.x -= d.v * 0.15;
        if (d.y > h) { d.y = -d.l; d.x = Math.random() * w * 1.1; }
      }
      requestAnimationFrame(frame);
    })();
  }

  function chrome() {
    const nav = $('#nav');
    const onScroll = () => nav.classList.toggle('solid', scrollY > 40);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    $('#menuToggle').onclick = () => $('#navLinks').classList.toggle('open');
    $$('#navLinks a').forEach((a) => (a.onclick = () => $('#navLinks').classList.remove('open')));
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.12 });
    $$('.reveal').forEach((el) => io.observe(el));
    $('#year').textContent = new Date().getFullYear();
  }

  // Generated artwork per room type, used until real photos are added to public/photos/.
  function roomArt(t, i) {
    const [a, b] = t.palette || ['#3f6b4a', '#c9c3b8'];
    const g = `g${i}`;
    const scenes = [
      // studio: garden window, double bed, desk, kitchenette, hanging plant
      `<rect x="40" y="40" width="150" height="130" fill="#8fae84" opacity=".55" stroke="#e4e1db" stroke-width="5"/><line x1="115" y1="40" x2="115" y2="170" stroke="#e4e1db" stroke-width="3"/>
       <g fill="#3f6b4a" opacity=".8"><ellipse cx="80" cy="150" rx="40" ry="26"/><ellipse cx="150" cy="140" rx="36" ry="30"/></g>
       <rect x="40" y="190" width="200" height="60" fill="#e9e6df"/><rect x="40" y="182" width="200" height="14" rx="4" fill="#a06e46"/><rect x="56" y="196" width="66" height="20" rx="8" fill="#f5f3ef"/><rect x="134" y="196" width="66" height="20" rx="8" fill="#f5f3ef"/><rect x="40" y="226" width="200" height="24" fill="${a}"/>
       <rect x="262" y="150" width="100" height="100" fill="#8a5a38"/><rect x="262" y="146" width="100" height="8" fill="#c9c3b8"/><rect x="276" y="168" width="32" height="70" fill="#a06e46" stroke="#6f4a2e"/><rect x="316" y="168" width="32" height="70" fill="#a06e46" stroke="#6f4a2e"/><rect x="282" y="122" width="22" height="24" fill="#c9c3b8"/>
       <path d="M330 0v60" stroke="#c9c3b8" stroke-width="2"/><ellipse cx="330" cy="66" rx="16" ry="9" fill="#c9c3b8"/><g stroke="#4f7d58" stroke-width="4" fill="none"><path d="M318 68c-6 16-4 30 0 40"/><path d="M330 72c0 16 2 28 0 44"/><path d="M342 68c6 14 4 28-2 38"/></g>`,
      // dining hall: tall windows, hanging plants, tables
      `<g fill="#3a4c43"><rect x="40" y="30" width="80" height="170"/><rect x="160" y="30" width="80" height="170"/><rect x="280" y="30" width="80" height="170"/></g>
       <g fill="#8fae84" opacity=".5"><rect x="40" y="120" width="80" height="80"/><rect x="160" y="120" width="80" height="80"/><rect x="280" y="120" width="80" height="80"/></g>
       <g fill="#a06e46"><rect x="60" y="220" width="90" height="8"/><rect x="250" y="220" width="90" height="8"/></g>
       <g stroke="#4f7d58" stroke-width="4" fill="none"><path d="M140 0v40M140 40c-8 16-6 30 0 44M140 40c8 16 6 30 0 44M260 0v50M260 50c-8 16-6 30 0 44M260 50c8 16 6 30 0 44"/></g>`,
    ];
    const lines = Array.from({ length: 24 }, (_, k) => {
      const x = (k * 53 + i * 31) % 400, y = (k * 37 + i * 19) % 300;
      return `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 18}"/>`;
    }).join('');
    return `<svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9d5ce"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="#8f897f"/></linearGradient></defs>
      <rect width="400" height="280" fill="url(#${g})"/>
      ${scenes[i % scenes.length]}
      <g stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2">${lines}</g>
    </svg>`;
  }

  // Real photos live in public/photos/ and replace the drawn artwork wherever they exist.
  const GALLERY = [
    ['rooftop-bar', 'The rooftop bar'],
    ['garden', 'Garden seating'],
    ['courtyard', 'The courtyard'],
    ['terrace', 'The terrace'],
    ['grill', 'The outdoor grill'],
    ['lounge', 'Studio lounge & kitchenette'],
  ];
  const FOOD = [
    ['food-plate', 'The Petrichor burger plate'],
    ['food-beef-kebabs', 'Beef kebabs'],
    ['food-chicken-kebabs', 'Chicken tikka kebabs'],
    ['food-burger', 'Double beef burger'],
  ];
  let found = {};
  async function findPhotos() {
    found = await api('/api/photos').catch(() => ({}));
  }
  const photoTag = (name, alt, extra = '') => `<img src="${found[name]}" alt="${esc(alt)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${extra}" />`;
  function applyPhotos() {
    if (found.exterior) {
      const hero = $('.hero');
      hero.classList.add('has-photo');
      hero.style.backgroundImage = `linear-gradient(180deg, rgba(10,10,10,.72), rgba(10,10,10,.45) 45%, rgba(10,10,10,.9)), url(${found.exterior})`;
      hero.style.backgroundSize = 'cover';
      hero.style.backgroundPosition = 'center';
    }
    const story = found.terrace ? 'terrace' : found.exterior ? 'exterior' : null;
    if (story) {
      $('.story-art svg').outerHTML = photoTag(story, 'The terrace at The Petrichor');
      $('.story-art .caption').style.cssText = 'color:var(--cream);text-shadow:0 2px 12px rgba(0,0,0,.6)';
    }
    // Studio card: cross-fade between the bedroom and the lounge.
    const shots = ['studio', 'lounge'].filter((n) => found[n]);
    if (shots.length) {
      $$('.room-art svg').forEach((svg) => {
        const art = svg.parentElement;
        svg.outerHTML = shots.map((n, k) => photoTag(n, 'Garden studio', `transition:opacity 1.6s ease;opacity:${k ? 0 : 1}`)).join('');
        if (shots.length > 1) {
          let on = 0;
          setInterval(() => {
            on = (on + 1) % shots.length;
            $$('img', art).forEach((img, k) => (img.style.opacity = k === on ? 1 : 0));
          }, 4500);
        }
      });
    }
    const gal = GALLERY.filter(([n]) => found[n]);
    if (gal.length) {
      $('#gallery').hidden = false;
      $('#galleryGrid').innerHTML = gal.map(([n, c]) => `<figure class="shot">${photoTag(n, c)}<figcaption>${c}</figcaption></figure>`).join('');
    }
    const food = FOOD.filter(([n]) => found[n]);
    if (food.length) {
      $('#foodStrip').hidden = false;
      $('#foodStrip').innerHTML = food.map(([n, c]) => `<figure><img src="${found[n]}" alt="${esc(c)}" loading="lazy" /><figcaption>${c}</figcaption></figure>`).join('');
    }
  }

  // ---------- rooms ----------
  function renderRooms() {
    $('#roomsGrid').classList.toggle('single', roomTypes.length === 1);
    $('#roomsGrid').innerHTML = roomTypes
      .map(
        (t, i) => `
      <article class="room-card reveal in">
        <div class="room-art">${roomArt(t, i)}<span class="badge">${esc(t.view)} view</span></div>
        <div class="room-body">
          <h3>${esc(t.name)}</h3>
          <div class="tagline">${esc(t.tagline || '')}</div>
          <div class="specs"><span>${t.size} m²</span><span>Sleeps ${t.capacity}</span><span>${esc(t.bed)}</span><span>${t.rooms} studio${t.rooms === 1 ? '' : 's'}</span></div>
          <p>${esc(t.description)}</p>
          <div class="amenities">${(t.amenities || []).map((a) => `<span>${esc(a)}</span>`).join('')}</div>
          <div class="room-foot">
            <div class="price">${kes(t.price)} <small>/ night, B&amp;B</small></div>
            <button class="btn small" data-book-type="${t.id}">Reserve</button>
          </div>
        </div>
      </article>`
      )
      .join('');
    $$('[data-book-type]').forEach((b) => (b.onclick = () => openBooking({ typeId: b.dataset.bookType })));
  }

  // ---------- availability calendar ----------
  let calStart;
  async function renderCalendar() {
    $('#calStart').value = calStart;
    const cal = await api(`/api/availability/calendar?start=${calStart}&days=14`);
    const head = cal.dates.map((d) => `<th>${fmtDate(d, { weekday: 'short' })}<b>${fmtDate(d, { day: 'numeric' })}</b>${fmtDate(d, { month: 'short' })}</th>`).join('');
    const rows = cal.types
      .map(
        (t) => `<tr><th>${esc(t.name)}<small>${kes(t.price)} · ${t.total} room${t.total === 1 ? '' : 's'}</small></th>${t.free
          .map((n, i) => {
            const cls = n === 0 ? 'full' : n <= Math.max(1, Math.floor(t.total / 3)) ? 'low' : 'open';
            return `<td><button class="${cls}" ${n === 0 ? 'disabled' : ''} data-cal-type="${t.id}" data-cal-date="${cal.dates[i]}" title="${n} of ${t.total} open"><span class="n">${n}</span><span class="l">${n === 0 ? 'full' : 'open'}</span></button></td>`;
          })
          .join('')}</tr>`
      )
      .join('');
    $('#calendar').innerHTML = `<thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody>`;
    $$('[data-cal-type]').forEach((b) => (b.onclick = () => openBooking({ typeId: b.dataset.calType, checkIn: b.dataset.calDate, checkOut: addDays(b.dataset.calDate, 1) })));
  }
  function calendarControls() {
    calStart = TODAY;
    $('#calStart').min = TODAY;
    $('#calPrev').onclick = () => { calStart = addDays(calStart, -14) < TODAY ? TODAY : addDays(calStart, -14); renderCalendar(); };
    $('#calNext').onclick = () => { calStart = addDays(calStart, 14); renderCalendar(); };
    $('#calStart').onchange = (e) => { calStart = e.target.value < TODAY ? TODAY : e.target.value; renderCalendar(); };
  }

  // ---------- booking modal ----------
  const bk = { checkIn: null, checkOut: null, guests: 2, typeId: null, step: 1 };
  const modal = () => $('#bookingModal');
  function setStep(n, title) {
    bk.step = n;
    $$('#bookingModal .steps span').forEach((s, i) => s.classList.toggle('on', i < n));
    $('#bkTitle').textContent = title;
  }
  function openBooking(pre = {}) {
    Object.assign(bk, { checkIn: bk.checkIn || TODAY, checkOut: bk.checkOut || addDays(TODAY, 2) }, pre);
    if (bk.checkOut <= bk.checkIn) bk.checkOut = addDays(bk.checkIn, 1);
    modal().classList.add('open');
    document.body.style.overflow = 'hidden';
    stepDates();
  }
  function closeBooking() {
    modal().classList.remove('open');
    document.body.style.overflow = '';
  }
  $$('#bookingModal [data-close]').forEach((el) => (el.onclick = closeBooking));
  addEventListener('keydown', (e) => e.key === 'Escape' && closeBooking());

  async function stepDates() {
    setStep(1, 'Choose your dates & suite');
    $('#bkBody').innerHTML = `
      <div class="grid-3">
        <label class="field">Arrive<input type="date" id="bkIn" min="${TODAY}" value="${bk.checkIn}" /></label>
        <label class="field">Depart<input type="date" id="bkOut" min="${addDays(bk.checkIn, 1)}" value="${bk.checkOut}" /></label>
        <label class="field">Guests<select id="bkGuests">${Array.from({ length: Math.max(...roomTypes.map((t) => t.capacity), 1) }, (_, k) => k + 1).map((n) => `<option ${n == bk.guests ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
      <div class="type-options" id="bkTypes"><p class="empty">Checking open rooms…</p></div>
      <div class="error" id="bkError"></div>
      <div class="actions"><span></span><button class="btn" id="bkNext" disabled>Continue</button></div>`;
    const refresh = async () => {
      bk.checkIn = $('#bkIn').value;
      if (!bk.checkOut || bk.checkOut <= bk.checkIn) bk.checkOut = addDays(bk.checkIn, 1);
      $('#bkOut').min = addDays(bk.checkIn, 1);
      $('#bkOut').value = bk.checkOut;
      bk.guests = Number($('#bkGuests').value);
      try {
        const list = await api(`/api/availability/rooms?checkIn=${bk.checkIn}&checkOut=${bk.checkOut}&guests=${bk.guests}`);
        $('#bkError').textContent = '';
        if (bk.typeId && !list.find((t) => t.id === bk.typeId && t.available > 0)) bk.typeId = null;
        $('#bkTypes').innerHTML = list
          .map((t) => {
            const cls = t.available === 0 ? 'none' : t.available <= 2 ? 'low' : 'ok';
            const label = !t.fits ? `Sleeps ${t.capacity} max` : t.available === 0 ? 'Fully booked' : t.available <= 2 ? `Only ${t.available} left` : `${t.available} available`;
            return `<button type="button" class="type-opt ${bk.typeId === t.id ? 'selected' : ''}" data-type="${t.id}" ${t.available === 0 ? 'disabled' : ''}>
              <span><b>${esc(t.name)}</b><small>${kes(t.price)} × ${t.nights} night${t.nights > 1 ? 's' : ''}</small></span>
              <span style="text-align:right"><span class="price" style="font-size:1.3rem">${kes(t.total)}</span><br><span class="avail ${cls}">${label}</span></span>
            </button>`;
          })
          .join('');
        $$('#bkTypes .type-opt').forEach((b) => (b.onclick = () => { bk.typeId = b.dataset.type; $$('#bkTypes .type-opt').forEach((x) => x.classList.toggle('selected', x === b)); $('#bkNext').disabled = false; }));
        $('#bkNext').disabled = !bk.typeId;
      } catch (e) {
        $('#bkError').textContent = e.message;
      }
    };
    $('#bkIn').onchange = refresh;
    $('#bkOut').onchange = () => { bk.checkOut = $('#bkOut').value; refresh(); };
    $('#bkGuests').onchange = refresh;
    $('#bkNext').onclick = stepDetails;
    refresh();
  }

  function stepDetails() {
    const t = roomTypes.find((x) => x.id === bk.typeId);
    const nights = Math.round((Date.parse(bk.checkOut) - Date.parse(bk.checkIn)) / 864e5);
    setStep(2, 'Your details');
    $('#bkBody').innerHTML = `
      <div class="summary">
        <div><span>${esc(t.name)}</span><span>${bk.guests} guest${bk.guests > 1 ? 's' : ''}</span></div>
        <div><span>${fmtDate(bk.checkIn)} → ${fmtDate(bk.checkOut)}</span><span>${nights} night${nights > 1 ? 's' : ''}</span></div>
        <div><span>Breakfast cooked to order</span><span>Included</span></div>
        <div class="total"><span>Total</span><span>${kes(t.price * nights)}</span></div>
      </div>
      <form id="bkForm">
        <div class="grid-2">
          <label class="field">Full name<input name="name" required autocomplete="name" /></label>
          <label class="field">Phone<input name="phone" required placeholder="+254…" autocomplete="tel" /></label>
        </div>
        <label class="field" style="margin-top:14px">Email<input name="email" type="email" required autocomplete="email" /></label>
        <label class="field" style="margin-top:14px">Special requests<textarea name="requests" placeholder="Arrival time, airport pickup, celebrations…"></textarea></label>
        <div class="error" id="bkError"></div>
        <div class="actions"><button type="button" class="btn ghost" id="bkBack">Back</button><button class="btn" type="submit">Confirm reservation</button></div>
      </form>`;
    $('#bkBack').onclick = stepDates;
    $('#bkForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const btn = e.target.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const b = await api('/api/bookings', { method: 'POST', body: { ...f, typeId: bk.typeId, checkIn: bk.checkIn, checkOut: bk.checkOut, guests: bk.guests } });
        stepDone(b);
        renderCalendar();
      } catch (err) {
        $('#bkError').textContent = err.message;
        btn.disabled = false;
      }
    };
  }

  function stepDone(b) {
    setStep(3, 'You are booked');
    $('#bkBody').innerHTML = `
      <div class="confirm">
        <p class="eyebrow">Booking reference</p>
        <div class="ref">${esc(b.ref)}</div>
        <p>${esc(b.typeName)}, room ${esc(b.roomNumber)} · ${fmtDate(b.checkIn)} to ${fmtDate(b.checkOut)}</p>
        <p class="price">${kes(b.total)}</p>
        <p style="color:var(--muted)">Payment is taken on arrival. Check-in from 2:00 pm. Keep your reference to manage the booking or order in-room dining.</p>
        <button class="btn" data-close>Done</button>
      </div>`;
    $('#bkBody [data-close]').onclick = closeBooking;
    bk.typeId = null;
  }

  function heroSearch() {
    const f = $('#heroSearch');
    f.checkIn.min = TODAY;
    f.checkIn.value = TODAY;
    f.checkOut.min = addDays(TODAY, 1);
    f.checkOut.value = addDays(TODAY, 2);
    f.checkIn.onchange = () => {
      f.checkOut.min = addDays(f.checkIn.value, 1);
      if (f.checkOut.value <= f.checkIn.value) f.checkOut.value = addDays(f.checkIn.value, 1);
    };
    f.onsubmit = (e) => {
      e.preventDefault();
      openBooking({ checkIn: f.checkIn.value, checkOut: f.checkOut.value, guests: Number(f.guests.value) });
    };
    $$('[data-open-booking]').forEach((b) => (b.onclick = () => openBooking()));
  }

  // ---------- restaurant ----------
  let tSel = null;
  function dining() {
    $('#hours').innerHTML = hotel.dining.services.map((s) => `<li><span>${esc(s.name)}</span><span>${s.start} – ${s.end} seatings</span></li>`).join('') + `<li><span>Rooftop Bar</span><span>11:00 – late</span></li><li><span>Grill &amp; Pizzeria</span><span>12:00 – 22:00</span></li>`;
    $('#tDate').min = TODAY;
    $('#tDate').value = TODAY;
    $('#tParty').innerHTML = Array.from({ length: 8 }, (_, i) => `<option ${i === 1 ? 'selected' : ''}>${i + 1}</option>`).join('');
    $('#tDate').onchange = $('#tParty').onchange = loadSlots;
    $('#tForm').onsubmit = async (e) => {
      e.preventDefault();
      if (!tSel) return;
      const f = Object.fromEntries(new FormData(e.target));
      const btn = e.target.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const r = await api('/api/reservations', { method: 'POST', body: { ...f, date: $('#tDate').value, time: tSel, partySize: Number($('#tParty').value) } });
        e.target.reset();
        $('#tForm').style.display = 'none';
        tSel = null;
        $('#tSlots').innerHTML = `<div class="confirm"><p class="eyebrow">Table reference</p><div class="ref">${esc(r.ref)}</div><p>${fmtDate(r.date)} at ${r.time} · ${r.partySize} guests · ${esc(r.area)}</p><button class="btn ghost small" id="tAgain">Book another</button></div>`;
        $('#tAgain').onclick = loadSlots;
      } catch (err) {
        $('#tError').textContent = err.message;
        loadSlots(true);
      } finally {
        btn.disabled = false;
      }
    };
    loadSlots();
  }
  async function loadSlots(keepForm) {
    if (keepForm !== true) { tSel = null; $('#tForm').style.display = 'none'; $('#tError').textContent = ''; }
    const slots = await api(`/api/dining/availability?date=${$('#tDate').value}&party=${$('#tParty').value}`);
    const groups = {};
    slots.forEach((s) => (groups[s.service] ||= []).push(s));
    $('#tSlots').innerHTML = Object.entries(groups)
      .map(([name, list]) => `<div class="slot-group"><h5>${esc(name)}</h5><div class="chips">${list
        .map((s) => `<button type="button" class="chip ${tSel === s.time ? 'selected' : ''}" data-time="${s.time}" ${s.open ? '' : 'disabled'}><b>${s.time}</b><small>${s.past ? 'passed' : s.open ? `${s.open} table${s.open > 1 ? 's' : ''} open` : 'full'}</small></button>`)
        .join('')}</div></div>`)
      .join('');
    $$('#tSlots .chip').forEach((c) => (c.onclick = () => {
      tSel = c.dataset.time;
      $$('#tSlots .chip').forEach((x) => x.classList.toggle('selected', x === c));
      $('#tForm').style.display = 'block';
      $('#tPick').textContent = `${fmtDate($('#tDate').value)} at ${tSel} for ${$('#tParty').value}`;
    }));
  }

  // ---------- menu ----------
  function renderMenu() {
    const cats = [...new Set(menu.map((m) => m.category))];
    let active = cats[0];
    const draw = () => {
      $('#menuTabs').innerHTML = cats.map((c) => `<button class="tab ${c === active ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
      $$('#menuTabs .tab').forEach((b) => (b.onclick = () => { active = b.dataset.cat; draw(); }));
      $('#menuList').innerHTML = menu
        .filter((m) => m.category === active)
        .map((m) => `<div class="dish"><div class="dish-top"><h4>${esc(m.name)}</h4><span class="dots"></span><span class="p">${kes(m.price)}</span></div><p>${esc(m.description)}</p>${m.tags?.length ? `<div class="tags">${m.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div>`)
        .join('');
    };
    draw();
  }

  // ---------- delivery ----------
  const order = { date: null, slot: null, dest: 'room', items: {} };
  function delivery() {
    const cfg = hotel.delivery;
    $('#deliveryIntro').textContent = `Our kitchen sends a delivery run every three hours: ${cfg.slots.join(', ')}. Order at least ${cfg.cutoffMinutes} minutes before a run. Free to your room, ${kes(cfg.feeOutside)} anywhere in Kakamega town. Minimum order ${kes(cfg.minimumOrder)}.`;
    const days = [0, 1, 2].map((n) => addDays(TODAY, n));
    order.date = TODAY;
    const drawDays = () => {
      $('#dDay').innerHTML = days.map((d, i) => `<button type="button" class="${d === order.date ? 'active' : ''}" data-day="${d}">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'long' })}</button>`).join('');
      $$('#dDay button').forEach((b) => (b.onclick = () => { order.date = b.dataset.day; order.slot = null; drawDays(); loadDeliverySlots(); }));
    };
    drawDays();
    loadDeliverySlots();

    const deliverable = menu.filter((m) => m.deliverable);
    const cats = [...new Set(deliverable.map((m) => m.category))];
    $('#orderMenu').innerHTML = cats
      .map((c) => `<div class="order-cat">${esc(c)}</div>` + deliverable.filter((m) => m.category === c).map((m) => `
        <div class="order-item"><div><h5>${esc(m.name)}</h5><small>${kes(m.price)}</small></div>
          <div class="qty"><button type="button" data-dec="${m.id}" aria-label="Remove one">−</button><span id="q-${m.id}">0</span><button type="button" data-inc="${m.id}" aria-label="Add one">+</button></div></div>`).join(''))
      .join('');
    $$('[data-inc]').forEach((b) => (b.onclick = () => { order.items[b.dataset.inc] = (order.items[b.dataset.inc] || 0) + 1; drawBasket(); }));
    $$('[data-dec]').forEach((b) => (b.onclick = () => { const k = b.dataset.dec; order.items[k] = Math.max(0, (order.items[k] || 0) - 1); if (!order.items[k]) delete order.items[k]; drawBasket(); }));

    $$('#destSeg button').forEach((b) => (b.onclick = () => {
      order.dest = b.dataset.dest;
      $$('#destSeg button').forEach((x) => x.classList.toggle('active', x === b));
      $('#roomField').style.display = order.dest === 'room' ? '' : 'none';
      $('#addrField').style.display = order.dest === 'address' ? '' : 'none';
      drawBasket();
    }));

    $('#oForm').onsubmit = async (e) => {
      e.preventDefault();
      $('#oError').textContent = '';
      if (!order.slot) return ($('#oError').textContent = 'Choose a delivery run above');
      const f = Object.fromEntries(new FormData(e.target));
      const btn = $('#oSubmit');
      btn.disabled = true;
      try {
        const o = await api('/api/orders', {
          method: 'POST',
          body: { ...f, date: order.date, slot: order.slot, destinationType: order.dest, items: Object.entries(order.items).map(([id, qty]) => ({ id, qty })) },
        });
        order.items = {};
        order.slot = null;
        e.target.reset();
        drawBasket();
        loadDeliverySlots();
        $('#basketLines').innerHTML = `<li style="display:block;text-align:center;border:0"><p class="eyebrow">Order reference</p><div class="confirm"><div class="ref" style="font-size:2rem">${esc(o.ref)}</div><p>${kes(o.total)} · ${fmtDate(o.date)}, ${o.slot} run</p></div></li>`;
        toast(`Order ${o.ref} received. It leaves the kitchen at ${o.slot}.`);
      } catch (err) {
        $('#oError').textContent = err.message;
        loadDeliverySlots();
      } finally {
        btn.disabled = false;
      }
    };
    drawBasket();
  }

  async function loadDeliverySlots() {
    const { slots } = await api(`/api/delivery/slots?date=${order.date}`);
    $('#dSlots').innerHTML = slots
      .map((s) => {
        const open = !s.closed && s.remaining > 0;
        return `<button type="button" class="slot-card ${order.slot === s.time ? 'selected' : ''}" data-slot="${s.time}" ${open ? '' : 'disabled'}><span class="t">${s.time}</span><span class="s">${s.closed ? 'Closed' : s.remaining ? `${s.remaining} places left` : 'Full'}</span></button>`;
      })
      .join('');
    if (order.slot && !slots.find((s) => s.time === order.slot && !s.closed && s.remaining)) order.slot = null;
    $$('#dSlots .slot-card').forEach((b) => (b.onclick = () => { order.slot = b.dataset.slot; $$('#dSlots .slot-card').forEach((x) => x.classList.toggle('selected', x === b)); drawBasket(); }));
  }

  function drawBasket() {
    const cfg = hotel.delivery;
    const lines = Object.entries(order.items).map(([id, qty]) => ({ m: menu.find((x) => x.id === id), qty }));
    menu.filter((m) => m.deliverable).forEach((m) => { const q = $(`#q-${m.id}`); if (q) q.textContent = order.items[m.id] || 0; });
    const sub = lines.reduce((s, l) => s + l.m.price * l.qty, 0);
    const fee = order.dest === 'room' && cfg.freeInRoom ? 0 : cfg.feeOutside;
    $('#basketLines').innerHTML = lines.length ? lines.map((l) => `<li><span>${l.qty} × ${esc(l.m.name)}</span><span>${kes(l.m.price * l.qty)}</span></li>`).join('') : '<li class="empty" style="border:0">Add dishes from the list.</li>';
    $('#totals').innerHTML = `
      <div><span>Delivery run</span><span>${order.slot ? `${fmtDate(order.date)}, ${order.slot}` : 'Not chosen'}</span></div>
      <div><span>Subtotal</span><span>${kes(sub)}</span></div>
      <div><span>Delivery</span><span>${fee ? kes(fee) : 'Free'}</span></div>
      <div class="grand"><span>Total</span><span>${kes(sub + (lines.length ? fee : 0))}</span></div>
      ${lines.length && sub < cfg.minimumOrder ? `<small style="color:var(--warn)">Add ${kes(cfg.minimumOrder - sub)} more to reach the minimum order.</small>` : ''}`;
    $('#oSubmit').disabled = !lines.length || sub < cfg.minimumOrder;
  }

  // ---------- lookup ----------
  function lookup() {
    $('#lookupForm').onsubmit = async (e) => {
      e.preventDefault();
      const r = e.target.ref.value.trim().toUpperCase();
      const out = $('#lookupResult');
      const kind = r.startsWith('PH') ? 'bookings' : r.startsWith('TB') ? null : r.startsWith('DL') ? 'orders' : null;
      if (r.startsWith('TB')) return (out.innerHTML = `<p>Table bookings are confirmed by phone on the day. To change one, call +254 700 000 000 quoting <b>${esc(r)}</b>.</p>`);
      if (!kind) return (out.innerHTML = '<p>References start with PH (stays), TB (tables) or DL (deliveries).</p>');
      try {
        const x = await api(`/api/${kind}/${encodeURIComponent(r)}`);
        const status = x.status.replace(/_/g, ' ');
        out.innerHTML =
          kind === 'bookings'
            ? `<div class="summary" style="color:var(--ink)"><div><b>${esc(x.typeName)}, room ${esc(x.roomNumber)}</b><span class="avail ok">${esc(status)}</span></div><div><span>${fmtDate(x.checkIn)} → ${fmtDate(x.checkOut)}</span><span>${x.nights} nights · ${x.guests} guests</span></div><div class="total"><span>Total</span><span>${kes(x.total)}</span></div></div>`
            : `<div class="summary" style="color:var(--ink)"><div><b>Delivery ${esc(x.ref)}</b><span class="avail ok">${esc(status)}</span></div><div><span>${fmtDate(x.date)}, ${x.slot} run</span><span>${x.destination.type === 'room' ? 'Room ' + esc(x.destination.room) : esc(x.destination.address)}</span></div>${x.items.map((i) => `<div><span>${i.qty} × ${esc(i.name)}</span><span>${kes(i.line)}</span></div>`).join('')}<div class="total"><span>Total</span><span>${kes(x.total)}</span></div></div>`;
      } catch (err) {
        out.innerHTML = `<p>${esc(err.message)}</p>`;
      }
    };
  }

  // ---------- boot ----------
  async function boot() {
    rain();
    chrome();
    try {
      [hotel, roomTypes, menu] = await Promise.all([api('/api/hotel'), api('/api/room-types'), api('/api/menu')]);
    } catch (e) {
      toast('Could not reach the hotel server. Is it running?');
      return;
    }
    TODAY = hotel.today;
    renderRooms();
    findPhotos().then(applyPhotos);
    calendarControls();
    renderCalendar();
    heroSearch();
    dining();
    renderMenu();
    delivery();
    lookup();
  }
  boot();
})();

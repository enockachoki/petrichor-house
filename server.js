// The Petrichor Kakamega: hotel website + booking API.
// Zero dependencies: needs only Node.js 18 or newer. Data lives in data/db.json.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const seed = require('./seed');
const mpesa = require('./mpesa');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'petrichor-admin';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const TZ_OFFSET_MIN = 180; // Kenya is UTC+3 all year.

// ---------- storage ----------

function loadDb() {
  if (process.argv.includes('--reset') || !fs.existsSync(DB_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fresh = seed();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  // Older databases miss collections added later (e.g. venues): fill them in from the defaults.
  const defaults = seed();
  for (const k of Object.keys(defaults)) if (data[k] === undefined) data[k] = defaults[k];
  return data;
}

let db = loadDb();

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ---------- helpers ----------

const id = (prefix) => `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
const ref = (prefix) => `${prefix}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

// "Now" in Nairobi, as { date: 'YYYY-MM-DD', minutes: minutes since midnight }.
function nairobiNow() {
  const d = new Date(Date.now() + TZ_OFFSET_MIN * 60000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseDate(s, field) {
  if (!DATE_RE.test(s || '') || isNaN(Date.parse(s + 'T00:00:00Z'))) throw bad(`${field} must be a date (YYYY-MM-DD)`);
  return s;
}
function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function nightsBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function requireFields(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') throw bad(`${f} is required`);
  }
}
const clean = (s, max = 200) => String(s ?? '').trim().slice(0, max);

// ---------- rooms ----------

const overlaps = (aIn, aOut, bIn, bOut) => aIn < bOut && aOut > bIn;
const liveBookings = () => db.bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'checked_out');

function freeRooms(typeId, checkIn, checkOut) {
  const taken = new Set(
    liveBookings()
      .filter((b) => overlaps(checkIn, checkOut, b.checkIn, b.checkOut))
      .map((b) => b.roomId)
  );
  return db.rooms.filter((r) => r.typeId === typeId && r.status === 'active' && !taken.has(r.id));
}

function roomCalendar(start, days) {
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  return {
    dates,
    types: db.roomTypes.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      total: db.rooms.filter((r) => r.typeId === t.id && r.status === 'active').length,
      free: dates.map((d) => freeRooms(t.id, d, addDays(d, 1)).length),
    })),
  };
}

function createBooking(body) {
  requireFields(body, ['typeId', 'checkIn', 'checkOut', 'name', 'email', 'phone']);
  const checkIn = parseDate(body.checkIn, 'checkIn');
  const checkOut = parseDate(body.checkOut, 'checkOut');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw bad('Check-out must be after check-in');
  if (nights > 30) throw bad('Stays are limited to 30 nights online. Please call us for longer stays.');
  if (checkIn < nairobiNow().date) throw bad('Check-in cannot be in the past');
  const type = db.roomTypes.find((t) => t.id === body.typeId);
  if (!type) throw bad('Unknown room type');
  const guests = Number(body.guests) || 1;
  if (guests < 1 || guests > type.capacity) throw bad(`${type.name} sleeps up to ${type.capacity} guests`);
  const payOption = body.payOption === 'now' ? 'now' : 'on_site';
  const [room] = freeRooms(type.id, checkIn, checkOut);
  if (!room) throw new HttpError(409, `Sorry, ${type.name} is fully booked for those dates`);
  const booking = {
    id: id('bk'),
    ref: ref('PH'),
    roomId: room.id,
    roomNumber: room.number,
    typeId: type.id,
    typeName: type.name,
    checkIn,
    checkOut,
    nights,
    guests,
    rate: type.price,
    total: type.price * nights,
    name: clean(body.name, 100),
    email: clean(body.email, 120),
    phone: clean(body.phone, 30),
    requests: clean(body.requests, 500),
    status: 'confirmed',
    payment: payOption === 'now' ? 'pending' : 'on_site',
    createdAt: new Date().toISOString(),
  };
  db.bookings.push(booking);
  save();
  return booking;
}

// ---------- restaurant ----------

// Turns [{ id, qty }] into priced lines from the menu. `forDelivery` also refuses dishes we don't deliver.
function priceItems(list, forDelivery) {
  if (!Array.isArray(list) || list.length === 0) throw bad(forDelivery ? 'Your basket is empty' : 'Add at least one dish or drink to confirm your table');
  return list.map((it) => {
    const mi = db.menu.find((x) => x.id === it.id);
    const qty = Math.floor(Number(it.qty));
    if (!mi || !mi.available || (forDelivery && !mi.deliverable)) throw bad(forDelivery ? 'An item in your basket is not available for delivery' : 'An item you chose is no longer on the menu');
    if (!(qty >= 1 && qty <= 20)) throw bad('Quantities must be between 1 and 20');
    return { id: mi.id, name: mi.name, price: mi.price, qty, line: mi.price * qty };
  });
}

function seatingTimes() {
  const { services, intervalMinutes } = db.diningConfig;
  const out = [];
  for (const s of services) {
    for (let t = toMin(s.start); t <= toMin(s.end); t += intervalMinutes) out.push({ service: s.name, time: toHHMM(t) });
  }
  return out;
}

function freeTables(date, time, party) {
  const span = db.diningConfig.seatingMinutes;
  const t = toMin(time);
  const busy = new Set(
    db.reservations
      .filter((r) => r.date === date && r.status !== 'cancelled' && Math.abs(toMin(r.time) - t) < span)
      .map((r) => r.tableId)
  );
  return db.tables
    .filter((tb) => tb.active && tb.capacity >= party && !busy.has(tb.id))
    .sort((a, b) => a.capacity - b.capacity);
}

function diningAvailability(date, party) {
  const now = nairobiNow();
  return seatingTimes().map((s) => {
    const past = date < now.date || (date === now.date && toMin(s.time) <= now.minutes + 30);
    const tables = past ? [] : freeTables(date, s.time, party);
    return { ...s, open: tables.length, past };
  });
}

function createReservation(body) {
  requireFields(body, ['date', 'time', 'partySize', 'name', 'phone']);
  const date = parseDate(body.date, 'date');
  const party = Number(body.partySize);
  if (!(party >= 1 && party <= 20)) throw bad('Party size must be between 1 and 20');
  const slot = diningAvailability(date, party).find((s) => s.time === body.time);
  if (!slot) throw bad('That is not a seating time');
  if (slot.past) throw bad('That seating time has passed');
  const items = priceItems(body.items, false);
  const [table] = freeTables(date, body.time, party);
  if (!table) throw new HttpError(409, 'No table is free for that time. Please pick another slot.');
  const r = {
    id: id('rs'),
    ref: ref('TB'),
    tableId: table.id,
    tableName: table.name,
    area: table.area,
    date,
    time: body.time,
    service: slot.service,
    partySize: party,
    name: clean(body.name, 100),
    phone: clean(body.phone, 30),
    email: clean(body.email, 120),
    notes: clean(body.notes, 500),
    items,
    total: items.reduce((s, i) => s + i.line, 0),
    // The table is held while the guest pays for their pre-order; unpaid holds lapse after HOLD_MINUTES.
    status: 'awaiting_payment',
    createdAt: new Date().toISOString(),
  };
  db.reservations.push(r);
  save();
  return r;
}

// ---------- delivery ----------

function deliverySlots(date) {
  const cfg = db.deliveryConfig;
  const now = nairobiNow();
  return cfg.slots.map((time) => {
    const used = db.orders.filter((o) => o.date === date && o.slot === time && o.status !== 'cancelled').length;
    const closed = date < now.date || (date === now.date && toMin(time) - cfg.cutoffMinutes <= now.minutes);
    return { time, remaining: Math.max(0, cfg.capacityPerSlot - used), closed };
  });
}

function createOrder(body) {
  requireFields(body, ['date', 'slot', 'name', 'phone', 'destinationType']);
  const date = parseDate(body.date, 'date');
  const cfg = db.deliveryConfig;
  const slot = deliverySlots(date).find((s) => s.time === body.slot);
  if (!slot) throw bad('That is not a delivery slot');
  if (slot.closed) throw bad(`Orders for the ${body.slot} run close ${cfg.cutoffMinutes} minutes before departure`);
  if (slot.remaining < 1) throw new HttpError(409, 'That delivery run is full. Please choose the next one.');
  const items = priceItems(body.items, true);
  const subtotal = items.reduce((s, i) => s + i.line, 0);
  if (subtotal < cfg.minimumOrder) throw bad(`Minimum delivery order is KES ${cfg.minimumOrder.toLocaleString()}`);

  let destination;
  if (body.destinationType === 'room') {
    requireFields(body, ['room']);
    const room = db.rooms.find((r) => r.number.toLowerCase() === clean(body.room).toLowerCase());
    if (!room) throw bad('We could not find that room number');
    destination = { type: 'room', room: room.number };
  } else if (body.destinationType === 'address') {
    requireFields(body, ['address']);
    destination = { type: 'address', address: clean(body.address, 300) };
  } else throw bad('Choose in-room or Kakamega address delivery');

  const fee = destination.type === 'room' && cfg.freeInRoom ? 0 : cfg.feeOutside;
  const order = {
    id: id('od'),
    ref: ref('DL'),
    items,
    subtotal,
    fee,
    total: subtotal + fee,
    date,
    slot: body.slot,
    destination,
    name: clean(body.name, 100),
    phone: clean(body.phone, 30),
    notes: clean(body.notes, 300),
    status: 'awaiting_payment',
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  save();
  return order;
}

// ---------- payments ----------

const HOLD_MINUTES = 15;

// Orders and tables that were never paid for give their place back after HOLD_MINUTES.
function expireUnpaid() {
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60000).toISOString();
  let changed = false;
  for (const list of [db.orders, db.reservations]) {
    for (const x of list) {
      if (x.status === 'awaiting_payment' && x.createdAt < cutoff) {
        x.status = 'cancelled';
        x.cancelReason = 'Payment not completed';
        changed = true;
      }
    }
  }
  for (const pay of db.payments) {
    if (pay.status === 'pending' && pay.createdAt < cutoff) {
      pay.status = 'failed';
      pay.resultDesc = 'No answer from the phone';
      changed = true;
    }
  }
  if (changed) save();
}

const PAY_KINDS = {
  order: { list: () => db.orders, label: 'Food order', due: (x) => x.status === 'awaiting_payment' && x.total },
  reservation: { list: () => db.reservations, label: 'Table pre-order', due: (x) => x.status === 'awaiting_payment' && x.total },
  booking: { list: () => db.bookings, label: 'Room booking', due: (x) => x.status !== 'cancelled' && x.payment !== 'paid' && x.total },
};

function payTarget(kind, refCode) {
  const k = PAY_KINDS[kind];
  if (!k) throw bad('Unknown payment type');
  const target = k.list().find((x) => x.ref === String(refCode || '').toUpperCase());
  if (!target) throw new HttpError(404, 'We could not find that reference');
  return target;
}

const publicPayment = (p) => ({ id: p.id, ref: p.ref, kind: p.kind, targetRef: p.targetRef, amount: p.amount, phone: p.phone.replace(/^(\d{6})\d{3}/, '$1***'), status: p.status, mode: p.mode, receipt: p.receipt, resultDesc: p.resultDesc, payee: mpesa.cfg.accountName });

async function startPayment(body) {
  requireFields(body, ['kind', 'ref', 'phone']);
  const target = payTarget(body.kind, body.ref);
  const amount = PAY_KINDS[body.kind].due(target);
  if (!amount) throw new HttpError(409, target.status === 'cancelled' ? 'This was cancelled because payment was not completed in time. Please start again.' : 'This is already paid');
  const phone = mpesa.normalisePhone(body.phone);
  if (!phone) throw bad('Enter a Safaricom M-Pesa number, like 0712 345 678');
  for (const old of db.payments) {
    if (old.targetRef === target.ref && old.status === 'pending') Object.assign(old, { status: 'failed', resultDesc: 'Replaced by a new prompt' });
  }
  const pay = {
    id: id('py'),
    ref: ref('PY'),
    kind: body.kind,
    targetRef: target.ref,
    amount,
    phone,
    status: 'pending',
    mode: mpesa.cfg.live ? 'live' : 'demo',
    receipt: '',
    resultDesc: '',
    createdAt: new Date().toISOString(),
  };
  if (pay.mode === 'live') {
    const r = await mpesa.stkPush({ phone, amount, account: target.ref, description: PAY_KINDS[body.kind].label });
    Object.assign(pay, r);
  }
  db.payments.push(pay);
  if (body.kind === 'booking') target.payment = 'pending';
  save();
  return publicPayment(pay);
}

function settlePayment(pay, state, desc, receipt) {
  if (pay.status !== 'pending') return;
  pay.status = state;
  pay.resultDesc = desc || (state === 'paid' ? 'Paid' : 'Not paid');
  pay.receipt = receipt || '';
  pay.updatedAt = new Date().toISOString();
  if (state === 'paid') {
    const target = PAY_KINDS[pay.kind].list().find((x) => x.ref === pay.targetRef);
    if (target) {
      target.paid = true;
      target.receipt = pay.receipt;
      target.paidAt = pay.updatedAt;
      if (pay.kind === 'order' && target.status === 'awaiting_payment') target.status = 'received';
      if (pay.kind === 'reservation' && target.status === 'awaiting_payment') target.status = 'confirmed';
      if (pay.kind === 'booking') target.payment = 'paid';
    }
  }
  save();
}

async function paymentStatus(payId) {
  const pay = db.payments.find((x) => x.id === payId);
  if (!pay) throw new HttpError(404, 'Payment not found');
  // Safaricom normally calls us back; on a computer it can't reach (like localhost) we ask instead.
  if (pay.mode === 'live' && pay.status === 'pending' && pay.checkoutRequestId && Date.now() - Date.parse(pay.lastQuery || pay.createdAt) > 5000) {
    pay.lastQuery = new Date().toISOString();
    try {
      const q = await mpesa.stkQuery(pay.checkoutRequestId);
      if (q.state !== 'pending') settlePayment(pay, q.state, q.desc);
    } catch (e) {
      console.warn('  M-Pesa status check failed:', e.message);
    }
  }
  return publicPayment(pay);
}

// ---------- venues & events ----------

const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate / meeting', 'Conference / training', 'Church / fellowship', 'Graduation', 'Family gathering', 'Other'];

function createEnquiry(body) {
  requireFields(body, ['venueId', 'date', 'guests', 'eventType', 'name', 'phone']);
  const venue = db.venues.find((v) => v.id === body.venueId && v.active);
  if (!venue) throw bad('Please choose a venue');
  const date = parseDate(body.date, 'date');
  if (date < nairobiNow().date) throw bad('The event date cannot be in the past');
  const guests = Math.floor(Number(body.guests));
  if (!(guests >= 1)) throw bad('Number of guests must be at least 1');
  if (guests > venue.capacity) throw bad(`${venue.name} holds up to ${venue.capacity} guests`);
  if (!EVENT_TYPES.includes(body.eventType)) throw bad('Please choose an event type');
  if (db.enquiries.some((e) => e.venueId === venue.id && e.date === date && e.status === 'confirmed'))
    throw new HttpError(409, `${venue.name} is already booked on that date. Please pick another date or venue.`);
  const e = {
    id: id('ev'),
    ref: ref('EV'),
    venueId: venue.id,
    venueName: venue.name,
    date,
    guests,
    eventType: body.eventType,
    name: clean(body.name, 100),
    phone: clean(body.phone, 30),
    email: clean(body.email, 120),
    notes: clean(body.notes, 800),
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  db.enquiries.push(e);
  save();
  return e;
}

// ---------- admin ----------

const sessions = new Map(); // token -> expiry
function isAdmin(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function overview() {
  const today = nairobiNow().date;
  const activeRooms = db.rooms.filter((r) => r.status === 'active');
  const occupied = liveBookings().filter((b) => b.checkIn <= today && b.checkOut > today);
  const revenue =
    db.bookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.total, 0) +
    db.orders.filter((o) => o.paid && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0) +
    db.reservations.filter((r) => r.paid).reduce((s, r) => s + (r.total || 0), 0);
  return {
    today,
    rooms: { total: db.rooms.length, active: activeRooms.length, occupiedTonight: occupied.length },
    occupancy: activeRooms.length ? Math.round((occupied.length / activeRooms.length) * 100) : 0,
    arrivals: db.bookings.filter((b) => b.checkIn === today && b.status === 'confirmed'),
    departures: db.bookings.filter((b) => b.checkOut === today && b.status === 'checked_in'),
    reservationsToday: db.reservations.filter((r) => r.date === today && r.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time)),
    ordersToday: db.orders.filter((o) => o.date === today && o.status !== 'cancelled'),
    paymentMode: mpesa.cfg.live ? 'live' : 'demo',
    paidToday: db.payments.filter((x) => x.status === 'paid' && (x.updatedAt || '').slice(0, 10) === today).reduce((s, x) => s + x.amount, 0),
    newEnquiries: db.enquiries.filter((e) => e.status === 'new').sort((a, b) => a.date.localeCompare(b.date)),
    deliverySlots: deliverySlots(today),
    revenue,
  };
}

// Generic editable collections for the admin dashboard.
const COLLECTIONS = {
  'room-types': {
    key: 'roomTypes',
    prefix: 'rt',
    fields: { name: 'string', tagline: 'string', description: 'string', price: 'number', capacity: 'number', size: 'number', bed: 'string', view: 'string', amenities: 'list', palette: 'list' },
    canDelete: (rec) => !db.rooms.some((r) => r.typeId === rec.id) || 'Move or delete the rooms of this type first',
  },
  rooms: {
    key: 'rooms',
    prefix: 'room',
    fields: { number: 'string', typeId: 'string', status: ['active', 'maintenance'] },
    validate: (rec) => {
      if (!db.roomTypes.some((t) => t.id === rec.typeId)) throw bad('Unknown room type');
      if (db.rooms.some((r) => r.id !== rec.id && r.number.toLowerCase() === String(rec.number).toLowerCase())) throw bad('Room number already exists');
    },
    canDelete: (rec) => !liveBookings().some((b) => b.roomId === rec.id) || 'This room has upcoming bookings. Set it to maintenance instead.',
  },
  tables: {
    key: 'tables',
    prefix: 't',
    fields: { name: 'string', capacity: 'number', area: 'string', active: 'boolean' },
    canDelete: (rec) => !db.reservations.some((r) => r.tableId === rec.id && r.status === 'confirmed' && r.date >= nairobiNow().date) || 'This table has upcoming reservations. Deactivate it instead.',
  },
  venues: {
    key: 'venues',
    prefix: 'v',
    fields: { name: 'string', kind: 'string', capacity: 'number', description: 'string', features: 'list', photo: 'string', active: 'boolean' },
    canDelete: (rec) => !db.enquiries.some((e) => e.venueId === rec.id && ['new', 'contacted', 'confirmed'].includes(e.status) && e.date >= nairobiNow().date) || 'This venue has open enquiries. Deactivate it instead.',
  },
  menu: {
    key: 'menu',
    prefix: 'm',
    fields: { category: 'string', name: 'string', description: 'string', price: 'number', tags: 'list', available: 'boolean', deliverable: 'boolean' },
  },
};

function coerce(fields, body, partial) {
  const out = {};
  for (const [k, type] of Object.entries(fields)) {
    if (body[k] === undefined) {
      if (!partial && type === 'string' && ['name', 'number', 'typeId', 'category', 'area'].includes(k)) throw bad(`${k} is required`);
      continue;
    }
    const v = body[k];
    if (Array.isArray(type)) {
      if (!type.includes(v)) throw bad(`${k} must be one of ${type.join(', ')}`);
      out[k] = v;
    } else if (type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw bad(`${k} must be a positive number`);
      out[k] = n;
    } else if (type === 'boolean') out[k] = v === true || v === 'true';
    else if (type === 'list') out[k] = (Array.isArray(v) ? v : String(v).split(',')).map((s) => clean(s, 80)).filter(Boolean);
    else out[k] = clean(v, 1000);
  }
  return out;
}

const STATUS = {
  bookings: ['confirmed', 'checked_in', 'checked_out', 'cancelled'],
  reservations: ['awaiting_payment', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'],
  orders: ['awaiting_payment', 'received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
  payments: ['pending', 'paid', 'failed'],
  enquiries: ['new', 'contacted', 'confirmed', 'declined'],
};

// ---------- http ----------

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) reject(bad('Request too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(bad('Invalid JSON'));
      }
    });
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp' };

function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname === '/admin' ? '/admin.html' : pathname;
  const full = path.normalize(path.join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}

async function api(req, res, url) {
  const p = url.pathname;
  const q = Object.fromEntries(url.searchParams);
  const method = req.method;
  const parts = p.split('/').filter(Boolean); // ['api', ...]
  expireUnpaid();

  // ----- public -----
  if (method === 'GET' && p === '/api/hotel')
    return send(res, 200, {
      name: 'The Petrichor Kakamega',
      location: 'Shiyunzu, Kakamega–Mumias Road, Kakamega, Kenya',
      checkIn: '14:00',
      checkOut: '10:30',
      phone: '+254796306263',
      payments: { mode: mpesa.cfg.live ? 'live' : 'demo', payee: mpesa.cfg.accountName, holdMinutes: HOLD_MINUTES },
      today: nairobiNow().date,
      delivery: db.deliveryConfig,
      dining: db.diningConfig,
    });
  if (method === 'GET' && p === '/api/photos') {
    // Real photos dropped into public/photos/ (exterior.jpg, studio.jpg, ...), keyed by name.
    const dir = path.join(PUBLIC_DIR, 'photos');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)) : [];
    return send(res, 200, Object.fromEntries(files.map((f) => [f.replace(/\.[^.]+$/, '').toLowerCase(), `/photos/${encodeURIComponent(f)}`])));
  }
  if (method === 'GET' && p === '/api/room-types')
    return send(res, 200, db.roomTypes.map((t) => ({ ...t, rooms: db.rooms.filter((r) => r.typeId === t.id && r.status === 'active').length })));
  if (method === 'GET' && p === '/api/availability/calendar') {
    const start = q.start ? parseDate(q.start, 'start') : nairobiNow().date;
    const days = Math.min(Math.max(Number(q.days) || 14, 1), 60);
    return send(res, 200, roomCalendar(start, days));
  }
  if (method === 'GET' && p === '/api/availability/rooms') {
    const checkIn = parseDate(q.checkIn, 'checkIn');
    const checkOut = parseDate(q.checkOut, 'checkOut');
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) throw bad('Check-out must be after check-in');
    const guests = Number(q.guests) || 1;
    return send(
      res,
      200,
      db.roomTypes.map((t) => ({ id: t.id, name: t.name, price: t.price, capacity: t.capacity, nights, total: t.price * nights, available: t.capacity >= guests ? freeRooms(t.id, checkIn, checkOut).length : 0, fits: t.capacity >= guests }))
    );
  }
  if (method === 'POST' && p === '/api/bookings') return send(res, 201, createBooking(await readBody(req)));
  if (method === 'POST' && parts[1] === 'bookings' && parts[3] === 'pay-on-site') {
    const b = payTarget('booking', parts[2]);
    if (b.payment !== 'paid') b.payment = 'on_site';
    save();
    return send(res, 200, b);
  }
  if (method === 'POST' && p === '/api/payments') return send(res, 201, await startPayment(await readBody(req)));
  if (method === 'GET' && parts[1] === 'payments' && parts[2] && !parts[3]) return send(res, 200, await paymentStatus(parts[2]));
  if (method === 'POST' && parts[1] === 'payments' && parts[3] === 'simulate') {
    // Demo mode only: stands in for the customer typing their PIN on the phone.
    const pay = db.payments.find((x) => x.id === parts[2]);
    if (!pay || pay.mode !== 'demo') throw new HttpError(404, 'Payment not found');
    const { action } = await readBody(req);
    settlePayment(pay, action === 'pay' ? 'paid' : 'failed', action === 'pay' ? 'Paid (demo)' : 'Cancelled on the phone', action === 'pay' ? 'DEMO' + crypto.randomBytes(3).toString('hex').toUpperCase() : '');
    return send(res, 200, publicPayment(pay));
  }
  if (method === 'POST' && p === '/api/mpesa/callback') {
    const cb = mpesa.parseCallback(await readBody(req));
    const pay = cb && db.payments.find((x) => x.checkoutRequestId === cb.checkoutRequestId);
    if (pay) settlePayment(pay, cb.state, cb.desc, cb.receipt);
    return send(res, 200, { ResultCode: 0, ResultDesc: 'Accepted' });
  }
  if (method === 'GET' && parts[1] === 'bookings' && parts[2]) {
    const b = db.bookings.find((x) => x.ref === parts[2].toUpperCase());
    return b ? send(res, 200, b) : send(res, 404, { error: 'Booking not found' });
  }
  if (method === 'GET' && p === '/api/dining/availability') {
    const date = parseDate(q.date, 'date');
    return send(res, 200, diningAvailability(date, Number(q.party) || 2));
  }
  if (method === 'POST' && p === '/api/reservations') return send(res, 201, createReservation(await readBody(req)));
  if (method === 'GET' && parts[1] === 'reservations' && parts[2]) {
    const r = db.reservations.find((x) => x.ref === parts[2].toUpperCase());
    return r ? send(res, 200, r) : send(res, 404, { error: 'Table booking not found' });
  }
  if (method === 'GET' && p === '/api/venues') return send(res, 200, { venues: db.venues.filter((v) => v.active), eventTypes: EVENT_TYPES });
  if (method === 'POST' && p === '/api/enquiries') return send(res, 201, createEnquiry(await readBody(req)));
  if (method === 'GET' && p === '/api/menu') return send(res, 200, db.menu.filter((x) => x.available));
  if (method === 'GET' && p === '/api/delivery/slots') {
    const date = q.date ? parseDate(q.date, 'date') : nairobiNow().date;
    return send(res, 200, { date, config: db.deliveryConfig, slots: deliverySlots(date) });
  }
  if (method === 'POST' && p === '/api/orders') return send(res, 201, createOrder(await readBody(req)));
  if (method === 'GET' && parts[1] === 'orders' && parts[2]) {
    const o = db.orders.find((x) => x.ref === parts[2].toUpperCase());
    return o ? send(res, 200, o) : send(res, 404, { error: 'Order not found' });
  }

  // ----- admin -----
  if (method === 'POST' && p === '/api/admin/login') {
    const { password } = await readBody(req);
    const a = Buffer.from(String(password || ''));
    const b = Buffer.from(ADMIN_PASSWORD);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Wrong password');
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, Date.now() + 12 * 3600 * 1000);
    return send(res, 200, { token });
  }
  if (parts[1] !== 'admin') throw new HttpError(404, 'Not found');
  if (!isAdmin(req)) throw new HttpError(401, 'Please sign in');

  const resource = parts[2];
  const recId = parts[3];

  if (method === 'GET' && resource === 'overview') return send(res, 200, overview());
  if (method === 'GET' && resource === 'calendar') {
    const start = q.start ? parseDate(q.start, 'start') : nairobiNow().date;
    return send(res, 200, roomCalendar(start, Math.min(Number(q.days) || 14, 60)));
  }

  if (STATUS[resource]) {
    const list = db[resource];
    if (method === 'GET') return send(res, 200, [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    if (method === 'PATCH' && recId) {
      const rec = list.find((x) => x.id === recId);
      if (!rec) throw new HttpError(404, 'Not found');
      const { status, payment } = await readBody(req);
      if (resource === 'payments') throw bad('Payments are updated by M-Pesa');
      if (resource === 'bookings' && payment !== undefined) {
        if (!['on_site', 'pending', 'paid'].includes(payment)) throw bad('payment must be on_site, pending or paid');
        rec.payment = payment;
      } else {
        if (!STATUS[resource].includes(status)) throw bad(`status must be one of ${STATUS[resource].join(', ')}`);
        rec.status = status;
      }
      rec.updatedAt = new Date().toISOString();
      save();
      return send(res, 200, rec);
    }
  }

  if (resource === 'delivery-config') {
    if (method === 'GET') return send(res, 200, db.deliveryConfig);
    if (method === 'PUT') {
      const body = await readBody(req);
      const cfg = { ...db.deliveryConfig };
      if (body.slots !== undefined) {
        const slots = (Array.isArray(body.slots) ? body.slots : String(body.slots).split(',')).map((s) => s.trim()).filter(Boolean);
        if (!slots.length || slots.some((s) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) throw bad('Slots must be times like 06:00, 09:00');
        cfg.slots = [...new Set(slots)].sort();
      }
      for (const k of ['capacityPerSlot', 'cutoffMinutes', 'feeOutside', 'minimumOrder']) {
        if (body[k] !== undefined) {
          const n = Number(body[k]);
          if (!Number.isFinite(n) || n < 0) throw bad(`${k} must be a positive number`);
          cfg[k] = n;
        }
      }
      if (body.freeInRoom !== undefined) cfg.freeInRoom = body.freeInRoom === true || body.freeInRoom === 'true';
      db.deliveryConfig = cfg;
      save();
      return send(res, 200, cfg);
    }
  }

  const col = COLLECTIONS[resource];
  if (col) {
    const list = db[col.key];
    if (method === 'GET') return send(res, 200, list);
    if (method === 'POST') {
      const rec = { id: id(col.prefix), ...coerce(col.fields, await readBody(req), false) };
      if ((col.key === 'tables' || col.key === 'venues') && rec.active === undefined) rec.active = true;
      if (col.key === 'venues') rec.features = rec.features || [];
      if (col.key === 'rooms' && !rec.status) rec.status = 'active';
      if (col.key === 'menu') {
        rec.available = rec.available ?? true;
        rec.deliverable = rec.deliverable ?? true;
        rec.tags = rec.tags || [];
      }
      if (col.key === 'roomTypes') {
        rec.amenities = rec.amenities || [];
        rec.palette = rec.palette?.length ? rec.palette : ['#2f4a3a', '#b08d57'];
      }
      col.validate?.(rec);
      list.push(rec);
      save();
      return send(res, 201, rec);
    }
    const idx = list.findIndex((x) => x.id === recId);
    if (idx < 0) throw new HttpError(404, 'Not found');
    if (method === 'PUT' || method === 'PATCH') {
      const next = { ...list[idx], ...coerce(col.fields, await readBody(req), true) };
      col.validate?.(next);
      list[idx] = next;
      save();
      return send(res, 200, next);
    }
    if (method === 'DELETE') {
      const ok = col.canDelete ? col.canDelete(list[idx]) : true;
      if (ok !== true) throw new HttpError(409, ok);
      list.splice(idx, 1);
      save();
      return send(res, 200, { ok: true });
    }
  }
  throw new HttpError(404, 'Not found');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    serveStatic(req, res, url.pathname);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'Something went wrong on our side' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n  The Petrichor is open at http://localhost:${PORT}`);
    console.log(`  M-Pesa payments:        ${mpesa.cfg.live ? `live (${mpesa.cfg.env}, shortcode ${mpesa.cfg.shortcode})` : 'demo mode (no real money; see mpesa.example.json)'}`);
    console.log(`  Admin dashboard:        http://localhost:${PORT}/admin  (password: ${process.env.ADMIN_PASSWORD ? '[from ADMIN_PASSWORD]' : ADMIN_PASSWORD})\n`);
  });
}

module.exports = server;

// End-to-end smoke test: starts the server on a temp data dir and exercises every flow.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'petrichor-'));
const server = require('./server');

const seedMenu = require('./seed')().menu;
const menuId = (name) => seedMenu.find((m) => m.name === name).id;
const pre = (name = 'Masala Chai') => [{ id: menuId(name), qty: 1 }];
const day = (n) => new Date(Date.now() + 3 * 36e5 + n * 864e5).toISOString().slice(0, 10);

server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, p, body, token) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
  };
  const ok = (name) => console.log('  ✓', name);
  try {
    let r = await call('GET', '/api/room-types');
    assert.equal(r.data.length, 1); assert.equal(r.data[0].rooms, 4); ok('garden studios listed');

    const guest = { name: 'Achieng Test', email: 'a@test.ke', phone: '+254700000001' };
    let bookingId;
    for (let i = 0; i < 4; i++) {
      r = await call('POST', '/api/bookings', { typeId: 'rt-studio', checkIn: day(5), checkOut: day(7), guests: 2, ...guest });
      assert.equal(r.status, 201); assert.equal(r.data.total, 15000);
      bookingId ||= r.data.id;
    }
    ok('all 4 studios booked for 2 nights at KES 7,500');
    r = await call('POST', '/api/bookings', { typeId: 'rt-studio', checkIn: day(6), checkOut: day(8), guests: 2, ...guest });
    assert.equal(r.status, 409); ok('fifth overlapping booking refused');
    r = await call('POST', '/api/bookings', { typeId: 'rt-studio', checkIn: day(7), checkOut: day(8), guests: 2, payOption: 'now', ...guest });
    assert.equal(r.status, 201); assert.equal(r.data.payment, 'pending'); ok('back-to-back booking on checkout day allowed, pay now');
    const payNow = r.data;
    r = await call('POST', `/api/bookings/${payNow.ref}/pay-on-site`);
    assert.equal(r.data.payment, 'on_site'); ok('guest can switch to pay on arrival');
    let bp = (await call('POST', '/api/payments', { kind: 'booking', ref: payNow.ref, phone: '0110000000' })).data;
    assert.equal(bp.amount, 7500);
    await call('POST', `/api/payments/${bp.id}/simulate`, { action: 'pay' });
    r = await call('GET', `/api/bookings/${payNow.ref}`);
    assert.equal(r.data.payment, 'paid'); ok('room paid by M-Pesa');
    r = await call('POST', '/api/bookings', { typeId: 'rt-studio', checkIn: day(1), checkOut: day(2), guests: 3, ...guest });
    assert.equal(r.status, 400); ok('over-capacity booking refused');
    r = await call('GET', `/api/availability/calendar?start=${day(5)}&days=3`);
    assert.deepEqual(r.data.types[0].free, [0, 0, 3]); ok('calendar shows studios full, then 3 open');

    r = await call('GET', `/api/dining/availability?date=${day(1)}&party=8`);
    assert(r.data.every((s) => s.open === 1)); ok('only the long garden table fits 8');
    r = await call('POST', '/api/reservations', { date: day(1), time: '19:00', partySize: 8, name: 'Big', phone: '07', items: pre() });
    assert.equal(r.status, 201); assert.equal(r.data.tableName, 'G4'); assert.equal(r.data.status, 'awaiting_payment'); ok('long garden table held until paid');
    const table = r.data;
    r = await call('POST', '/api/reservations', { date: day(2), time: '19:00', partySize: 2, name: 'NoFood', phone: '07' });
    assert.equal(r.status, 400); ok('table needs at least one dish or drink');
    r = await call('POST', '/api/reservations', { date: day(1), time: '20:00', partySize: 8, name: 'Big2', phone: '07', items: pre() });
    assert.equal(r.status, 409); ok('table held for the 90-minute seating');
    r = await call('POST', '/api/reservations', { date: day(1), time: '20:30', partySize: 8, name: 'Big3', phone: '07', items: pre() });
    assert.equal(r.status, 201); ok('table free again after 90 minutes');

    r = await call('GET', `/api/delivery/slots?date=${day(1)}`);
    assert.deepEqual(r.data.slots.map((s) => s.time), ['09:00', '12:00', '15:00', '18:00', '21:00']); ok('delivery runs every 3 hours');
    r = await call('POST', '/api/orders', { date: day(1), slot: '12:00', name: 'A', phone: '07', destinationType: 'address', address: 'Milimani, Kakamega', items: [{ id: menuId('Petrichor Special'), qty: 1 }] });
    assert.equal(r.status, 201); assert.equal(r.data.total, 1600 + 200); assert.equal(r.data.status, 'awaiting_payment'); ok('address delivery charged the fee, waits for payment');
    const order = r.data;

    r = await call('POST', '/api/payments', { kind: 'order', ref: order.ref, phone: '12345' });
    assert.equal(r.status, 400); ok('non-M-Pesa number refused');
    r = await call('POST', '/api/payments', { kind: 'order', ref: order.ref, phone: '0712 345 678' });
    assert.equal(r.status, 201); assert.equal(r.data.mode, 'demo'); assert.equal(r.data.amount, 1800); assert.equal(r.data.phone, '254712***678'); ok('STK prompt sent to the chosen number');
    let pay = r.data;
    r = await call('POST', `/api/payments/${pay.id}/simulate`, { action: 'cancel' });
    assert.equal(r.data.status, 'failed');
    r = await call('GET', `/api/orders/${order.ref}`);
    assert.equal(r.data.status, 'awaiting_payment'); ok('cancelled prompt leaves the order unpaid');
    pay = (await call('POST', '/api/payments', { kind: 'order', ref: order.ref, phone: '+254712345678' })).data;
    await call('POST', `/api/payments/${pay.id}/simulate`, { action: 'pay' });
    r = await call('GET', `/api/orders/${order.ref}`);
    assert.equal(r.data.status, 'received'); assert(r.data.paid); assert(r.data.receipt); ok('paid order goes to the kitchen');
    r = await call('POST', '/api/payments', { kind: 'order', ref: order.ref, phone: '0712345678' });
    assert.equal(r.status, 409); ok('cannot pay twice');
    pay = (await call('POST', '/api/payments', { kind: 'reservation', ref: table.ref, phone: '0712345678' })).data;
    assert.equal(pay.amount, 150);
    await call('POST', `/api/payments/${pay.id}/simulate`, { action: 'pay' });
    r = await call('GET', `/api/reservations/${table.ref}`);
    assert.equal(r.data.status, 'confirmed'); ok('paid pre-order confirms the table');
    r = await call('POST', '/api/orders', { date: day(1), slot: '12:00', name: 'A', phone: '07', destinationType: 'room', room: '999', items: [{ id: menuId('Petrichor Special'), qty: 1 }] });
    assert.equal(r.status, 400); ok('unknown room refused');
    r = await call('POST', '/api/orders', { date: day(1), slot: '12:00', name: 'A', phone: '07', destinationType: 'room', room: 'S1', items: [{ id: menuId('Tusker Lager'), qty: 1 }] });
    assert.equal(r.status, 400); ok('alcohol not deliverable');
    r = await call('POST', '/api/orders', { date: day(-1), slot: '12:00', name: 'A', phone: '07', destinationType: 'room', room: 'S1', items: [{ id: menuId('Petrichor Special'), qty: 1 }] });
    assert.equal(r.status, 400); ok('past runs closed');

    r = await call('GET', '/api/venues');
    assert.equal(r.data.venues.length, 5); ok('5 grounds and venues listed');
    const ev = { venueId: 'v-forest', date: day(10), guests: 150, eventType: 'Wedding', name: 'Wanjiku', phone: '0796306263' };
    r = await call('POST', '/api/enquiries', ev);
    assert.equal(r.status, 201); assert.equal(r.data.status, 'new'); ok('free event enquiry received');
    const evId = r.data.id;
    r = await call('POST', '/api/enquiries', { ...ev, guests: 400 });
    assert.equal(r.status, 400); ok('over-capacity event refused');
    r = await call('POST', '/api/enquiries', { ...ev, eventType: 'Rave' });
    assert.equal(r.status, 400); ok('unknown event type refused');
    r = await call('GET', '/api/admin/overview');
    assert.equal(r.status, 401); ok('admin requires sign-in');
    r = await call('POST', '/api/admin/login', { password: 'wrong' });
    assert.equal(r.status, 401);
    const { data: { token } } = await call('POST', '/api/admin/login', { password: 'petrichor-admin' });
    r = await call('PUT', '/api/admin/room-types/rt-studio', { price: 8000 }, token);
    assert.equal(r.data.price, 8000); ok('admin changes a rate');
    r = await call('PUT', '/api/admin/rooms/room-S4', { status: 'maintenance' }, token);
    r = await call('GET', `/api/availability/calendar?start=${day(20)}&days=1`);
    assert.equal(r.data.types[0].free[0], 3); ok('maintenance room leaves availability');
    r = await call('DELETE', '/api/admin/rooms/room-S1', null, token);
    assert.equal(r.status, 409); ok('room with bookings cannot be deleted');
    r = await call('POST', '/api/admin/tables', { name: 'T6', capacity: 8, area: 'Dining Hall' }, token);
    assert.equal(r.status, 201); ok('admin adds a table');
    r = await call('PATCH', `/api/admin/enquiries/${evId}`, { status: 'confirmed' }, token);
    assert.equal(r.data.status, 'confirmed');
    r = await call('POST', '/api/enquiries', ev);
    assert.equal(r.status, 409); ok('confirmed event blocks that venue and date');
    r = await call('PATCH', `/api/admin/bookings/${bookingId}`, { status: 'cancelled' }, token);
    assert.equal(r.data.status, 'cancelled'); ok('admin cancels a booking');
    r = await call('PUT', '/api/admin/delivery-config', { slots: '06:00, 09:00, 12:00, 15:00, 18:00, 21:00' }, token);
    assert.equal(r.data.slots.length, 6); ok('admin edits delivery runs');
    r = await call('PUT', `/api/admin/menu/${menuId('Beef Kebabs')}`, { available: false }, token);
    r = await call('GET', '/api/menu');
    assert(!r.data.find((m) => m.name === 'Beef Kebabs')); ok('hidden dish leaves the menu');

    console.log('\nAll tests passed.');
  } catch (e) {
    console.error('\nTest failed:', e);
    process.exitCode = 1;
  } finally {
    server.close();
    fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  }
});

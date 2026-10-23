// End-to-end smoke test: starts the server on a temp data dir and exercises every flow.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'petrichor-'));
const server = require('./server');

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
    r = await call('POST', '/api/bookings', { typeId: 'rt-studio', checkIn: day(7), checkOut: day(8), guests: 2, ...guest });
    assert.equal(r.status, 201); ok('back-to-back booking on checkout day allowed');
    r = await call('POST', '/api/bookings', { typeId: 'rt-studio', checkIn: day(1), checkOut: day(2), guests: 3, ...guest });
    assert.equal(r.status, 400); ok('over-capacity booking refused');
    r = await call('GET', `/api/availability/calendar?start=${day(5)}&days=3`);
    assert.deepEqual(r.data.types[0].free, [0, 0, 3]); ok('calendar shows studios full, then 3 open');

    r = await call('GET', `/api/dining/availability?date=${day(1)}&party=8`);
    assert(r.data.every((s) => s.open === 1)); ok('only the garden terrace long table fits 8');
    r = await call('POST', '/api/reservations', { date: day(1), time: '19:00', partySize: 8, name: 'Big', phone: '07' });
    assert.equal(r.status, 201); assert.equal(r.data.tableName, 'G3'); ok('long table reserved');
    r = await call('POST', '/api/reservations', { date: day(1), time: '20:00', partySize: 8, name: 'Big2', phone: '07' });
    assert.equal(r.status, 409); ok('table held for the 90-minute seating');
    r = await call('POST', '/api/reservations', { date: day(1), time: '20:30', partySize: 8, name: 'Big3', phone: '07' });
    assert.equal(r.status, 201); ok('table free again after 90 minutes');

    r = await call('GET', `/api/delivery/slots?date=${day(1)}`);
    assert.deepEqual(r.data.slots.map((s) => s.time), ['09:00', '12:00', '15:00', '18:00', '21:00']); ok('delivery runs every 3 hours');
    r = await call('POST', '/api/orders', { date: day(1), slot: '12:00', name: 'A', phone: '07', destinationType: 'address', address: 'Milimani, Kakamega', items: [{ id: 'm-10', qty: 1 }] });
    assert.equal(r.status, 201); assert.equal(r.data.total, 1600 + 200); ok('address delivery charged the fee');
    r = await call('POST', '/api/orders', { date: day(1), slot: '12:00', name: 'A', phone: '07', destinationType: 'room', room: '999', items: [{ id: 'm-10', qty: 1 }] });
    assert.equal(r.status, 400); ok('unknown room refused');
    r = await call('POST', '/api/orders', { date: day(1), slot: '12:00', name: 'A', phone: '07', destinationType: 'room', room: 'S1', items: [{ id: 'm-26', qty: 1 }] });
    assert.equal(r.status, 400); ok('alcohol not deliverable');
    r = await call('POST', '/api/orders', { date: day(-1), slot: '12:00', name: 'A', phone: '07', destinationType: 'room', room: 'S1', items: [{ id: 'm-10', qty: 1 }] });
    assert.equal(r.status, 400); ok('past runs closed');

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
    r = await call('PATCH', `/api/admin/bookings/${bookingId}`, { status: 'cancelled' }, token);
    assert.equal(r.data.status, 'cancelled'); ok('admin cancels a booking');
    r = await call('PUT', '/api/admin/delivery-config', { slots: '06:00, 09:00, 12:00, 15:00, 18:00, 21:00' }, token);
    assert.equal(r.data.slots.length, 6); ok('admin edits delivery runs');
    r = await call('PUT', '/api/admin/menu/m-1', { available: false }, token);
    r = await call('GET', '/api/menu');
    assert(!r.data.find((m) => m.id === 'm-1')); ok('hidden dish leaves the menu');

    console.log('\nAll tests passed.');
  } catch (e) {
    console.error('\nTest failed:', e);
    process.exitCode = 1;
  } finally {
    server.close();
    fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  }
});

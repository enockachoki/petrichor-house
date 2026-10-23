// Default data for a fresh install. Used when data/db.json does not exist,
// or when you run `npm run reset`.

const roomTypes = [
  {
    id: 'rt-garden',
    name: 'Garden Deluxe',
    tagline: 'Rain-washed lawns at your door',
    description:
      'Our signature garden-view room, individually furnished with hand-loomed throws, a writing desk and a private kitchenette. Wake to birdsong from the Isukha gardens.',
    price: 18500,
    capacity: 2,
    size: 38,
    bed: 'King or twin',
    view: 'Garden',
    amenities: ['Cooked-to-order breakfast', 'Kitchenette', '55" smart TV', 'Rain shower', 'Fibre Wi-Fi', 'Nespresso'],
    palette: ['#2f4a3a', '#7a9a6b'],
  },
  {
    id: 'rt-forest',
    name: 'Forest Junior Suite',
    tagline: 'A lounge that looks into the canopy',
    description:
      'A generous suite with a separate lounge, freestanding stone bath and a balcony facing the green ridge toward Kakamega Forest. Turndown with local forest-honey treats.',
    price: 28000,
    capacity: 3,
    size: 56,
    bed: 'Super king',
    view: 'Forest ridge',
    amenities: ['Separate lounge', 'Stone soaking tub', 'Balcony', 'Butler on call', 'Minibar', 'Bose sound'],
    palette: ['#1f3b30', '#4f7a5a'],
  },
  {
    id: 'rt-pavilion',
    name: 'Rain Pavilion Suite',
    tagline: 'Glass walls, tin roof, the sound of rain',
    description:
      'A free-standing pavilion with a glass-walled bedroom, outdoor rain shower and private deck. Designed for the afternoon downpours Kakamega is famous for.',
    price: 45000,
    capacity: 4,
    size: 84,
    bed: 'Super king + daybed',
    view: 'Private garden',
    amenities: ['Private deck', 'Outdoor rain shower', 'Fireplace', 'Personal butler', 'In-room dining priority', 'Airport transfer'],
    palette: ['#203530', '#8a7a55'],
  },
  {
    id: 'rt-isukha',
    name: 'Isukha Presidential Villa',
    tagline: 'Two bedrooms, a plunge pool and total privacy',
    description:
      'Our most exclusive address: two bedrooms, a heated plunge pool, a private chef kitchen and a guided Kakamega Forest dawn walk for every stay.',
    price: 95000,
    capacity: 6,
    size: 210,
    bed: '2 super kings',
    view: 'Panoramic',
    amenities: ['Heated plunge pool', 'Private chef', 'Two bedrooms', 'Dawn forest walk', 'Chauffeured transfers', 'Champagne on arrival'],
    palette: ['#1a2a24', '#b08d57'],
  },
];

const rooms = [
  ...['101', '102', '103', '104', '105', '106', '107', '108'].map((n) => ({ id: `room-${n}`, number: n, typeId: 'rt-garden', status: 'active' })),
  ...['201', '202', '203', '204', '205'].map((n) => ({ id: `room-${n}`, number: n, typeId: 'rt-forest', status: 'active' })),
  ...['P1', 'P2', 'P3'].map((n) => ({ id: `room-${n}`, number: n, typeId: 'rt-pavilion', status: 'active' })),
  { id: 'room-V1', number: 'V1', typeId: 'rt-isukha', status: 'active' },
];

const tables = [
  { id: 't-1', name: 'T1', capacity: 2, area: 'Rain Garden Terrace', active: true },
  { id: 't-2', name: 'T2', capacity: 2, area: 'Rain Garden Terrace', active: true },
  { id: 't-3', name: 'T3', capacity: 2, area: 'Rain Garden Terrace', active: true },
  { id: 't-4', name: 'T4', capacity: 4, area: 'Rain Garden Terrace', active: true },
  { id: 't-5', name: 'T5', capacity: 4, area: 'Main Dining Room', active: true },
  { id: 't-6', name: 'T6', capacity: 4, area: 'Main Dining Room', active: true },
  { id: 't-7', name: 'T7', capacity: 6, area: 'Main Dining Room', active: true },
  { id: 't-8', name: 'T8', capacity: 6, area: 'Fireside Bar', active: true },
  { id: 't-9', name: 'Chef\'s Table', capacity: 10, area: 'Private Room', active: true },
];

let m = 0;
const item = (category, name, description, price, tags = [], deliverable = true) => ({
  id: `m-${++m}`,
  category,
  name,
  description,
  price,
  tags,
  available: true,
  deliverable,
});

const menu = [
  item('Breakfast', 'Petrichor Full Breakfast', 'Cooked to order: free-range eggs, beef sausage, roast tomato, mushrooms, sourdough and Kakamega honey.', 1800, ['Signature']),
  item('Breakfast', 'Mandazi & Chai Basket', 'Warm cardamom mandazi with spiced masala chai for two.', 950, ['Vegetarian']),
  item('Breakfast', 'Arrowroot & Sweet Potato Plate', 'Steamed nduma and viazi vitamu, avocado, boiled eggs, fresh passion juice.', 1200, ['Vegetarian', 'Local']),
  item('Starters', 'Omena Crisp', 'Lake Victoria silver cyprinid, flash-fried with lime, chilli salt and kachumbari.', 1100, ['Local']),
  item('Starters', 'Smoked Tilapia Croquettes', 'With pickled red onion and dhania aioli.', 1350),
  item('Starters', 'Garden Greens Soup', 'Tsisaka, managu and pumpkin, finished with cream and toasted seeds.', 900, ['Vegetarian']),
  item('Mains', 'Ingokho ya Kienyeji', 'The Luhya classic: slow-cooked free-range chicken in its own broth, served with obusuma (ugali) and traditional greens.', 2600, ['Signature', 'Local']),
  item('Mains', 'Whole Lake Tilapia', 'Wet-fry or charcoal-grilled, with ugali, sukuma and tomato relish.', 2900, ['Local']),
  item('Mains', 'Nyama Choma Platter', 'Roast goat ribs and leg, mukimo, kachumbari and pili pili. Serves two.', 4200, ['To share']),
  item('Mains', 'Beef Fillet, Forest Mushroom', '250g grass-fed fillet, wild mushroom jus, matoke purée.', 4800),
  item('Mains', 'Coconut Bean Curry', 'Njahi and red kidney beans in coconut, chapati and kachumbari.', 1700, ['Vegan']),
  item('Mains', 'Pilau ya Mbuzi', 'Coastal-spiced goat pilau with raita and fresh chilli.', 2400),
  item('Desserts', 'Kakamega Honey Panna Cotta', 'Forest honey, roast pineapple and macadamia brittle.', 950, ['Signature']),
  item('Desserts', 'Dark Chocolate & Coffee Tart', 'Made with Kenyan AA coffee and Madagascan cocoa.', 1100),
  item('Desserts', 'Tropical Fruit Plate', 'Mango, pawpaw, passion and pineapple from western Kenya farms.', 750, ['Vegan']),
  item('Drinks', 'Kenyan AA Pour-Over', 'Single-origin, brewed at your table.', 450),
  item('Drinks', 'Masala Chai Pot', 'Kericho tea, ginger, cardamom, whole milk.', 400),
  item('Drinks', 'Fresh Passion & Mint', 'Pressed to order.', 450, ['Vegan']),
  item('Drinks', 'Petrichor Dawa', 'Vodka, lime, Kakamega honey and crushed ice: our house twist on the Kenyan classic.', 1200, ['Signature', '18+'], false),
  item('Drinks', 'Tusker Lager', 'Ice cold, 500ml.', 450, ['18+'], false),
];

const deliveryConfig = {
  // Delivery runs leave the kitchen every 3 hours through the day.
  slots: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
  capacityPerSlot: 12,
  cutoffMinutes: 45,
  feeOutside: 250,
  minimumOrder: 800,
  freeInRoom: true,
};

const diningConfig = {
  // Seating times every 30 minutes within each service; each seating holds a table for 2 hours.
  services: [
    { name: 'Breakfast', start: '07:00', end: '10:00' },
    { name: 'Lunch', start: '12:30', end: '14:30' },
    { name: 'Dinner', start: '18:30', end: '21:30' },
  ],
  intervalMinutes: 30,
  seatingMinutes: 120,
};

module.exports = function seed() {
  return {
    roomTypes,
    rooms,
    bookings: [],
    tables,
    reservations: [],
    menu,
    orders: [],
    deliveryConfig,
    diningConfig,
  };
};

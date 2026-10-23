// Default data for a fresh install. Used when data/db.json does not exist,
// or when you run `npm run reset`.
//
// Based on public listings for Petrichor House Kakamega (Shiyunzu, Kakamega–Mumias Road):
// self-contained garden-view studios on bed & breakfast, a restaurant and pizzeria, and an outdoor bar.
// Room count, rates and menu prices are placeholders: change them in the staff dashboard.

const roomTypes = [
  {
    id: 'rt-studio',
    name: 'Deluxe Double Studio, Garden View',
    tagline: 'Self-contained, quiet, and looking onto the garden',
    description:
      'Each studio is individually furnished and fully self-contained: a double bed, a work desk, a sofa corner, wooden cabinetry and a kitchenette, with a private shower room and a view over the garden. Breakfast, cooked to order, is included every morning.',
    price: 7500,
    capacity: 2,
    size: 28,
    bed: '1 double bed',
    view: 'Garden',
    amenities: ['Breakfast included', 'Kitchenette', 'Work desk', 'Smart TV', 'Free Wi-Fi', 'Private shower', 'Free toiletries', 'Bottled water', 'Daily housekeeping'],
    palette: ['#3f6b4a', '#c9c3b8'],
  },
];

const rooms = ['S1', 'S2', 'S3', 'S4'].map((n) => ({ id: `room-${n}`, number: n, typeId: 'rt-studio', status: 'active' }));

const tables = [
  { id: 't-1', name: 'T1', capacity: 2, area: 'Dining Hall', active: true },
  { id: 't-2', name: 'T2', capacity: 2, area: 'Dining Hall', active: true },
  { id: 't-3', name: 'T3', capacity: 4, area: 'Dining Hall', active: true },
  { id: 't-4', name: 'T4', capacity: 4, area: 'Dining Hall', active: true },
  { id: 't-5', name: 'T5', capacity: 6, area: 'Dining Hall', active: true },
  { id: 't-6', name: 'G1', capacity: 4, area: 'Garden Terrace', active: true },
  { id: 't-7', name: 'G2', capacity: 4, area: 'Garden Terrace', active: true },
  { id: 't-8', name: 'G3', capacity: 8, area: 'Garden Terrace', active: true },
  { id: 't-9', name: 'B1', capacity: 2, area: 'Outdoor Bar', active: true },
  { id: 't-10', name: 'B2', capacity: 2, area: 'Outdoor Bar', active: true },
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
  item('Breakfast', 'Petrichor Cooked Breakfast', 'Cooked to order: eggs your way, sausage, toast, baked beans, grilled tomato, fruit, and tea or coffee. Included for staying guests.', 750, ['House favourite']),
  item('Breakfast', 'Spanish Omelette & Toast', 'Three-egg omelette with onion, tomato and peppers.', 450, ['Vegetarian']),
  item('Breakfast', 'Pancakes & Fruit', 'Stack of pancakes with honey and seasonal fruit.', 500, ['Vegetarian']),
  item('Breakfast', 'Mandazi & Masala Chai', 'Two fresh mandazi with a pot of spiced chai.', 250, ['Vegetarian']),

  item('Pizzeria', 'Margherita', 'Tomato, mozzarella and basil. Simple and perfect.', 900, ['Vegetarian']),
  item('Pizzeria', 'Veggie Garden', 'Peppers, onion, mushroom, sweetcorn and olives.', 1100, ['Vegetarian']),
  item('Pizzeria', 'Hawaiian', 'Ham and pineapple.', 1200),
  item('Pizzeria', 'Chicken Tikka', 'Tikka-spiced chicken, red onion, green chilli and coriander.', 1300, ['Spicy']),
  item('Pizzeria', 'BBQ Beef', 'Smoky BBQ sauce, minced beef, onion and peppers.', 1400),
  item('Pizzeria', 'Petrichor Special', 'Chicken, beef, mushroom, peppers and extra cheese. Our signature pie.', 1600, ['Signature']),

  item('Mains', 'Kienyeji Chicken', 'Slow-cooked free-range chicken (quarter) with ugali or chips and greens.', 1100, ['Local']),
  item('Mains', 'Whole Fried Tilapia', 'Lake Victoria tilapia, wet or dry fry, with ugali and sukuma wiki.', 1200, ['Local']),
  item('Mains', 'Goat Nyama Choma', 'Half a kilo of roast goat with kachumbari and ugali.', 950, ['To share']),
  item('Mains', 'Beef Stew & Rice', 'Slow-braised beef in tomato gravy with pilau or white rice.', 750),
  item('Mains', 'Chicken & Chips', 'Quarter chicken, fried or grilled, with chips and salad.', 800),
  item('Mains', 'Vegetable Curry & Chapati', 'Mixed vegetables and beans in a mild coconut curry.', 600, ['Vegan']),

  item('Snacks', 'Chips Masala', 'Fries tossed in spicy masala sauce.', 350, ['Spicy']),
  item('Snacks', 'Beef Samosas (3)', 'With lemon and chilli dip.', 250),
  item('Snacks', 'Chicken Wings (6)', 'BBQ or peri-peri.', 650),

  item('Desserts', 'Fruit Salad', 'Pawpaw, mango, pineapple and passion.', 300, ['Vegan']),
  item('Desserts', 'Ice Cream (2 scoops)', 'Vanilla, chocolate or strawberry.', 300),

  item('Drinks', 'Kenyan Coffee', 'Freshly brewed.', 200),
  item('Drinks', 'Masala Chai', 'Spiced Kenyan tea with milk.', 150),
  item('Drinks', 'Fresh Juice', 'Passion, mango or pineapple.', 250, ['Vegan']),
  item('Drinks', 'Soda (500ml)', 'Coke, Fanta, Sprite or Stoney.', 100),
  item('Drinks', 'Tusker Lager', 'Ice cold from the outdoor bar.', 300, ['18+'], false),
  item('Drinks', 'House Wine (glass)', 'Red or white.', 500, ['18+'], false),
];

const deliveryConfig = {
  // Delivery runs leave the kitchen every 3 hours through the day.
  slots: ['09:00', '12:00', '15:00', '18:00', '21:00'],
  capacityPerSlot: 10,
  cutoffMinutes: 45,
  feeOutside: 200,
  minimumOrder: 500,
  freeInRoom: true,
};

const diningConfig = {
  // Seating times every 30 minutes within each service; each seating holds a table for 90 minutes.
  services: [
    { name: 'Breakfast', start: '07:30', end: '09:00' },
    { name: 'Lunch', start: '12:30', end: '14:30' },
    { name: 'Dinner', start: '18:30', end: '21:00' },
  ],
  intervalMinutes: 30,
  seatingMinutes: 90,
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

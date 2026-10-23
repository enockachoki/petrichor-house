# Petrichor House · Kakamega

A website for Petrichor House Kakamega, a boutique guest house in Shiyunzu on the Kakamega–Mumias Road, about 3 km from Kakamega town. It has garden-view studios on bed & breakfast, a restaurant and pizzeria, and an outdoor bar.

**Guests can:**
- Browse the garden-view studios (self-contained, breakfast included)
- See a live 14-day availability grid of open nights and book a room (the system assigns a free room and refuses double bookings)
- Reserve a table in the dining hall, garden terrace or outdoor bar, picking from open seating times for their party size
- Read the full menu (breakfast, pizzeria, Kenyan mains, drinks) with prices in KES
- Order food delivery to their room (free) or a Kakamega address (KES 200 fee) on runs that leave every 3 hours: 09:00, 12:00, 15:00, 18:00, 21:00
- Look up a booking or delivery by reference

**Staff (at `/admin`) can:**
- See today's occupancy, arrivals, departures, tables and delivery runs, and check guests in or out
- View a room-by-room occupancy grid
- Change room rates, add rooms or room types, and put rooms into maintenance
- Add, edit or deactivate restaurant tables, and manage table bookings
- Edit menu items and prices, hide sold-out dishes, mark dishes dine-in only
- Move delivery orders through preparing, out for delivery and delivered
- Change delivery run times, capacity per run, cutoff, fee and minimum order

## Run it

You need [Node.js](https://nodejs.org) 18 or newer. There is nothing to install.

```bash
npm start
```

Then open http://localhost:3000. The staff dashboard is at http://localhost:3000/admin, password `petrichor-admin`.

| Command | What it does |
| --- | --- |
| `npm start` | Start the site on port 3000 |
| `npm test` | Run the end-to-end test suite (uses a temporary database) |
| `npm run reset` | Start with a fresh database (wipes all bookings) |

Settings come from environment variables:

- `PORT`: port to listen on (default 3000)
- `ADMIN_PASSWORD`: staff dashboard password (change this before going live)
- `DATA_DIR`: where `db.json` is stored (default `./data`)

All times use Kenya time (EAT, UTC+3).

## Adding real photos

Put photos in `public/photos/` with these names and they appear on the site automatically, with no code changes:
`exterior.jpg` (also used behind the homepage heading), `studio.jpg`, `dining.jpg`, `bar.jpg`, `garden.jpg`, `pizza.jpg`.
Until then the site uses drawn artwork.

Room count, nightly rate and menu prices are placeholders. Change them in the staff dashboard.

## How it is built

- `server.js`: a dependency-free Node.js server with the JSON API and booking rules
- `seed.js`: the starting rooms, tables, menu and delivery settings
- `public/`: the guest site (`index.html`, `app.js`) and staff dashboard (`admin.html`, `admin.js`), sharing `styles.css`
- `data/db.json`: the database, created on first start

Before taking real guests you would want to add online payment (for example M-Pesa), email or SMS confirmations, and a proper database and staff accounts.

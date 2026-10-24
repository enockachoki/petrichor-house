# The Petrichor · Kakamega

A website for The Petrichor Kakamega, a boutique guest house in Shiyunzu on the Kakamega–Mumias Road, about 3 km from Kakamega town. It has garden-view studios on bed & breakfast, a restaurant with grill and pizzeria, a garden, a terrace and a rooftop bar.

**Guests can:**
- Browse the garden-view studios (self-contained, breakfast included)
- See a live 14-day availability grid of open nights and book a room (the system assigns a free room and refuses double bookings)
- Reserve a table in the garden, on the terrace or at the rooftop bar, picking from open seating times for their party size
- Read the full menu (breakfast, grill & burgers, pizzeria, Kenyan mains, drinks) with prices in KES
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

## Photos

The hotel's photos are in `public/photos/` (see the README there for which file goes where). Replace a file with the same name to change a photo, with no code changes.

Room count, nightly rate and menu prices are placeholders. Change them in the staff dashboard.

## How it is built

- `server.js`: a dependency-free Node.js server with the JSON API and booking rules
- `seed.js`: the starting rooms, tables, menu and delivery settings
- `public/`: the guest site (`index.html`, `app.js`) and staff dashboard (`admin.html`, `admin.js`), sharing `styles.css`
- `data/db.json`: the database, created on first start

Before taking real guests you would want to add online payment (for example M-Pesa), email or SMS confirmations, and a proper database and staff accounts.


## M-Pesa payments (STK push)

- **Food orders** go to the kitchen only once paid. The customer chooses which M-Pesa number gets the PIN prompt.
- **Table bookings** need at least one dish or drink pre-ordered and paid to confirm. Unpaid orders and tables are released after 15 minutes.
- **Room bookings** offer *Pay now with M-Pesa* or *Pay on arrival* (staff can "Mark paid" in Room bookings).
- **Track an order** at `/track.html?ref=DL…`: items, payment, progress and a little kitchen animation.

Out of the box payments run in **demo mode**: no money moves and the customer confirms a pretend PIN prompt on screen.

To take real money you need a Safaricom **Paybill or Till** with *Lipa na M-Pesa Online* enabled (an STK push can't pay into a personal number such as 0796 306 263), plus an app on https://developer.safaricom.co.ke. Copy `mpesa.example.json` to `mpesa.json`, fill it in, and restart. `callbackUrl` must be a public https address that reaches `/api/mpesa/callback`; on a PC without one the site asks Safaricom for the result every few seconds instead.

# Going live

The site is ready for real M-Pesa payments. Going from sandbox to live is a change to `mpesa.json` only.

## 1. Test on the sandbox (now)

`mpesa.json` in the project folder:

```json
{ "env": "sandbox", "consumerKey": "…", "consumerSecret": "…" }
```

Run `node mpesa.js` (should say *Signed in to Safaricom*), then `node server.js`. Prompts arrive on the phone number the guest types; sandbox money is not real.

## 2. Get production keys from Safaricom

1. On https://developer.safaricom.co.ke open **Go Live**, choose your Paybill or Till, and verify with the admin phone and OTP.
2. Safaricom creates a production app (consumer key and secret) and emails the **Lipa na M-Pesa Online passkey**.

## 3. Switch to live

Replace `mpesa.json` with the contents of `mpesa.production.example.json` and fill it in:

| Field | Paybill | Till (Buy Goods) |
|---|---|---|
| `shortcode` | Paybill number | Store number (HO) |
| `type` | `paybill` | `till` |
| `till` | leave empty | Till number |
| `callbackUrl` | `https://your-domain/api/mpesa/callback` | same |

Restart the server. The start-up line reads `M-Pesa payments: LIVE (shortcode …)`. Make one small real payment (e.g. a KES 150 chai pre-order) and check it in the staff dashboard under **M-Pesa payments**.

## 4. Put the site online

Safaricom's callback needs a public **https** address. Any Node 18+ host works (a small VPS with Nginx + Let's Encrypt, Render, Railway, etc.):

- Start command: `node server.js`. The port comes from `PORT`.
- Set `ADMIN_PASSWORD` to a strong password (the server warns if you forget, in production).
- Keep the `data/` folder on persistent storage and back it up: it holds every booking, order and payment.
- `mpesa.json` holds secrets: never commit it (it is in `.gitignore`). On hosts with no files, use environment variables instead: `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_TYPE`, `MPESA_TILL`, `MPESA_CALLBACK_URL`, `MPESA_ACCOUNT_NAME`.

## What protects the money

- Demo (pretend) payments only exist when no keys are set **and** `env` is not `production`. A production setup with missing keys switches online payment off instead.
- A payment is marked paid only by Safaricom: by the callback (matched on Safaricom's private CheckoutRequestID and the exact amount) or by asking Safaricom directly for the result.
- Guests can't send a second prompt to the same booking within 20 seconds, and unpaid orders and tables are released after 15 minutes.

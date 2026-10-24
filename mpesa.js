// M-Pesa STK push ("Lipa na M-Pesa Online") through Safaricom's Daraja API.
//
// Without credentials the site runs in DEMO mode: no money moves, and the customer
// confirms a pretend PIN prompt on screen. To take real payments, copy
// mpesa.example.json to mpesa.json and fill in the details Safaricom gives you
// (or set the same names as environment variables, e.g. MPESA_CONSUMER_KEY).

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'mpesa.json');
const KEYS = ['env', 'consumerKey', 'consumerSecret', 'shortcode', 'passkey', 'type', 'till', 'callbackUrl', 'accountName'];

function loadConfig() {
  let file = {};
  if (fs.existsSync(FILE)) {
    try {
      file = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      console.warn('  mpesa.json could not be read: check the commas and quotes. Using demo payments.');
    }
  }
  const cfg = {};
  for (const k of KEYS) {
    const envName = 'MPESA_' + k.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase();
    cfg[k] = process.env[envName] || file[k] || '';
  }
  cfg.env = cfg.env === 'production' ? 'production' : 'sandbox';
  cfg.type = cfg.type === 'till' ? 'till' : 'paybill';
  cfg.accountName = cfg.accountName || 'THE PETRICHOR';
  cfg.live = Boolean(cfg.consumerKey && cfg.consumerSecret && cfg.shortcode && cfg.passkey && cfg.callbackUrl);
  return cfg;
}

const cfg = loadConfig();
const host = () => (cfg.env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke');

// 0712345678, 712345678, +254712345678, 254712345678 -> 254712345678 (Safaricom 07xx and 01xx lines).
function normalisePhone(raw) {
  const d = String(raw || '').replace(/[^\d]/g, '');
  let n = d;
  if (/^0[17]\d{8}$/.test(d)) n = '254' + d.slice(1);
  else if (/^[17]\d{8}$/.test(d)) n = '254' + d;
  return /^254[17]\d{8}$/.test(n) ? n : null;
}

// Daraja wants Kenya time as YYYYMMDDHHmmss.
const timestamp = () => new Date(Date.now() + 3 * 3600e3).toISOString().replace(/[^\d]/g, '').slice(0, 14);
const password = (ts) => Buffer.from(cfg.shortcode + cfg.passkey + ts).toString('base64');

let token = null;
async function accessToken() {
  if (token && token.expires > Date.now()) return token.value;
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  const r = await fetch(`${host()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error('M-Pesa sign-in failed. Check the consumer key and secret in mpesa.json.');
  token = { value: data.access_token, expires: Date.now() + (Number(data.expires_in) - 60) * 1000 };
  return token.value;
}

async function daraja(pathname, body) {
  const r = await fetch(host() + pathname, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

// Sends the PIN prompt to the customer's phone. Returns { checkoutRequestId, merchantRequestId }.
async function stkPush({ phone, amount, account, description }) {
  const ts = timestamp();
  const data = await daraja('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: cfg.shortcode,
    Password: password(ts),
    Timestamp: ts,
    TransactionType: cfg.type === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
    Amount: Math.ceil(amount),
    PartyA: phone,
    PartyB: cfg.type === 'till' ? cfg.till || cfg.shortcode : cfg.shortcode,
    PhoneNumber: phone,
    CallBackURL: cfg.callbackUrl,
    AccountReference: String(account).slice(0, 12),
    TransactionDesc: String(description).slice(0, 13),
  });
  if (data.ResponseCode !== '0') throw new Error(data.errorMessage || data.ResponseDescription || 'M-Pesa did not accept the request. Please try again.');
  return { checkoutRequestId: data.CheckoutRequestID, merchantRequestId: data.MerchantRequestID };
}

// Asks Safaricom how a prompt ended. Returns { state: 'pending' | 'paid' | 'failed', desc }.
async function stkQuery(checkoutRequestId) {
  const ts = timestamp();
  const data = await daraja('/mpesa/stkpushquery/v1/query', { BusinessShortCode: cfg.shortcode, Password: password(ts), Timestamp: ts, CheckoutRequestID: checkoutRequestId });
  if (data.ResultCode === undefined) return { state: 'pending' };
  return { state: String(data.ResultCode) === '0' ? 'paid' : 'failed', desc: data.ResultDesc };
}

// Reads Safaricom's callback body into { checkoutRequestId, state, desc, receipt }.
function parseCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb) return null;
  const items = Object.fromEntries((cb.CallbackMetadata?.Item || []).map((i) => [i.Name, i.Value]));
  return { checkoutRequestId: cb.CheckoutRequestID, state: Number(cb.ResultCode) === 0 ? 'paid' : 'failed', desc: cb.ResultDesc, receipt: items.MpesaReceiptNumber || '' };
}

module.exports = { cfg, normalisePhone, stkPush, stkQuery, parseCallback };

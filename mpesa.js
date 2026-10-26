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
  // Safaricom's public sandbox Paybill, so a sandbox app only needs its key and secret.
  if (cfg.env === 'sandbox') {
    cfg.shortcode ||= '174379';
    cfg.passkey ||= 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
  }
  // Without a public address Safaricom can't call us back; the site then asks for the result instead.
  cfg.callbackUrl ||= 'https://example.com/api/mpesa/callback';
  cfg.live = Boolean(cfg.consumerKey && cfg.consumerSecret && cfg.shortcode && cfg.passkey);
  // Pretend payments are only allowed while testing: a production setup with missing keys takes no payments at all.
  cfg.mode = cfg.live ? 'live' : cfg.env === 'production' ? 'off' : 'demo';
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
  const r = await fetch(`${host()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(15000) });
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
    signal: AbortSignal.timeout(20000),
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

// Safaricom's result codes, in words a guest understands.
const RESULTS = {
  0: 'Paid',
  1: 'Not enough money in the M-Pesa account',
  1001: 'Another M-Pesa payment was in progress on that phone. Please try again in a moment.',
  1019: 'The prompt expired before it was answered',
  1025: 'M-Pesa could not send the prompt. Please try again.',
  1032: 'Cancelled on the phone',
  1037: 'The phone could not be reached or did not answer',
  2001: 'Wrong M-Pesa PIN',
};
const describe = (code, fallback) => RESULTS[Number(code)] || fallback || 'The payment did not go through';

// Asks Safaricom how a prompt ended. Returns { state: 'pending' | 'paid' | 'failed', desc }.
async function stkQuery(checkoutRequestId) {
  const ts = timestamp();
  const data = await daraja('/mpesa/stkpushquery/v1/query', { BusinessShortCode: cfg.shortcode, Password: password(ts), Timestamp: ts, CheckoutRequestID: checkoutRequestId });
  if (data.ResultCode === undefined) return { state: 'pending' };
  return { state: String(data.ResultCode) === '0' ? 'paid' : 'failed', desc: describe(data.ResultCode, data.ResultDesc) };
}

// Reads Safaricom's callback body into { checkoutRequestId, state, desc, receipt }.
function parseCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb) return null;
  const items = Object.fromEntries((cb.CallbackMetadata?.Item || []).map((i) => [i.Name, i.Value]));
  return { checkoutRequestId: cb.CheckoutRequestID, state: Number(cb.ResultCode) === 0 ? 'paid' : 'failed', desc: describe(cb.ResultCode, cb.ResultDesc), receipt: items.MpesaReceiptNumber || '', amount: Number(items.Amount) || 0 };
}

module.exports = { cfg, normalisePhone, stkPush, stkQuery, parseCallback };

// `node mpesa.js` checks the settings and signs in to Safaricom, without sending any prompt.
if (require.main === module) {
  if (!cfg.live) {
    console.log(cfg.mode === 'off' ? '\n  "env" is production but keys are missing in mpesa.json: payments are switched off.\n' : '\n  Demo mode: no consumerKey/consumerSecret found in mpesa.json.\n');
  } else {
    console.log(`\n  ${cfg.env} · shortcode ${cfg.shortcode} · ${cfg.type}`);
    accessToken()
      .then(() => console.log('  Signed in to Safaricom. M-Pesa is ready.\n'))
      .catch((e) => { console.log('  ' + e.message + '\n'); process.exitCode = 1; });
  }
}

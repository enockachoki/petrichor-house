// Staff passwords are stored as salted scrypt hashes, never as plain text.
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user?.salt || !user?.hash) return false;
  const a = crypto.scryptSync(String(password || ''), user.salt, 64);
  const b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function checkStrength(password) {
  const p = String(password || '');
  if (p.length < 8) return 'Passwords need at least 8 characters';
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return 'Use both letters and numbers in the password';
  return null;
}

// The owner's account, created on a fresh install. ADMIN_PASSWORD sets its first password.
function superAdmin(password = process.env.ADMIN_PASSWORD || 'petrichor-admin') {
  return { id: 'u-owner', username: 'admin', name: 'Owner', role: 'super', active: true, ...hashPassword(password), createdAt: new Date().toISOString() };
}

module.exports = { hashPassword, verifyPassword, checkStrength, superAdmin };

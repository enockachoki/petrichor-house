// Lost the super admin password? Stop the site, then run:
//   node reset-admin.js NewPassword123
// This sets the password of the "admin" account (creating it again if it was removed) and signs everyone out.
const fs = require('fs');
const path = require('path');
const { hashPassword, checkStrength, superAdmin } = require('./auth');

const DB_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'db.json');
const password = process.argv[2];
const problem = checkStrength(password);
if (problem) {
  console.log(`\n  ${problem}.\n  Usage: node reset-admin.js NewPassword123\n`);
  process.exit(1);
}
if (!fs.existsSync(DB_FILE)) {
  console.log('\n  No data yet. Start the site once with "node server.js", then run this again.\n');
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
db.users ||= [];
let owner = db.users.find((u) => u.username === 'admin');
if (!owner) db.users.push((owner = superAdmin(password)));
Object.assign(owner, { role: 'super', active: true, ...hashPassword(password), updatedAt: new Date().toISOString() });
fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 2));
fs.renameSync(DB_FILE + '.tmp', DB_FILE);
console.log('\n  Done. Sign in at /admin as "admin" with the new password. Restart the site if it was running.\n');

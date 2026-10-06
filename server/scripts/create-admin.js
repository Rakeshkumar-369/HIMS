// Creates (or resets) a platform super-admin account.
// Usage: npm run admin:create -- --email you@company.com --name "Your Name" --password "Str0ngPass!"
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const email = String(arg('email') || '').trim().toLowerCase();
const name = arg('name') || 'CareNest Admin';
const password = arg('password') || '';

if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error('Usage: npm run admin:create -- --email you@company.com --name "Your Name" --password "Str0ngPassword1"');
  console.error('Admin passwords need at least 10 characters with letters and numbers.');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(password, 12);
  const [rows] = await pool.query('SELECT id, role FROM users WHERE LOWER(email) = ?', [email]);
  if (rows.length && rows[0].role !== 'admin') throw new Error('That email belongs to a doctor/nurse account');
  if (rows.length) {
    await pool.query('UPDATE users SET password_hash = ?, full_name = ?, is_active = 1, token_version = token_version + 1, failed_logins = 0, locked_until = NULL WHERE id = ?',
      [hash, name, rows[0].id]);
    console.log(`✔ Admin ${email} updated.`);
  } else {
    await pool.query("INSERT INTO users (role, full_name, email, password_hash) VALUES ('admin', ?, ?, ?)", [name, email, hash]);
    console.log(`✔ Admin ${email} created.`);
  }
} catch (e) {
  console.error('✖', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

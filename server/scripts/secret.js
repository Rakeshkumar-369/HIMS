// Creates server/.env (from .env.example) if needed and fills JWT_SECRET with a strong random value.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) fs.copyFileSync(path.join(root, '.env.example'), envPath);

const secret = crypto.randomBytes(48).toString('hex');
let env = fs.readFileSync(envPath, 'utf8');
env = /^JWT_SECRET=.*$/m.test(env) ? env.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`) : `${env.trimEnd()}\nJWT_SECRET=${secret}\n`;
fs.writeFileSync(envPath, env);
console.log('✔ A new random JWT_SECRET was written to server/.env (everyone will need to sign in again).');

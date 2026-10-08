// Creates the database (if missing) and applies schema.sql.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dbName = process.env.DB_NAME || 'carenest_hims';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
  charset: 'utf8mb4_unicode_ci',
});

await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.query(`USE \`${dbName}\``);
await conn.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
await conn.end();
console.log(`✔ Database "${dbName}" is ready (schema applied).`);

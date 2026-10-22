import { config } from 'dotenv';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
config({ quiet: true });
if (!process.env.DATABASE_URL?.startsWith('file:'))
  throw new Error('请设置 SQLite DATABASE_URL（file:…）');
const file = process.env.DATABASE_URL.slice(5);
const full = path.isAbsolute(file) ? file : path.resolve('prisma', file);
mkdirSync(path.dirname(full), { recursive: true });
// Prisma 6 on Windows may fail to create the first SQLite database during migrate deploy.
if (!existsSync(full)) writeFileSync(full, '');
const r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});
process.exitCode = r.status ?? 1;

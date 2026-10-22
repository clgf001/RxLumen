import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';

const db = new PrismaClient();
const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:5178';
if (!/^https?:\/\//.test(origin) || new URL(origin).origin !== origin)
  throw new Error('APP_ORIGIN 必须为无路径的完整来源，如 https://rx.example.org');
const production = process.env.NODE_ENV === 'production';
if (production && origin.startsWith('https:') && process.env.COOKIE_SECURE !== 'true')
  throw new Error('HTTPS 部署请设置 COOKIE_SECURE=true');
const app = createApp(db, {
  password: process.env.ADMIN_PASSWORD || '',
  origin,
  secureCookie: process.env.COOKIE_SECURE === 'true',
  production,
});
await db.$connect();
const server = app.listen(Number(process.env.PORT || 3100), process.env.HOST || '127.0.0.1', () =>
  console.log(`RxLumen is ready on port ${process.env.PORT || 3100}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });

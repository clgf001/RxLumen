import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
// Test the compiled server artifact, not the TypeScript development entry point.
// @ts-expect-error Built JavaScript has no declaration file.
import { createApp } from '../../dist/server/src/app.js';

test('production build serves HTML, assets, JSON and security headers together', async () => {
  const db = new PrismaClient();
  const app = createApp(db, {
    password: 'production-smoke-test-only-123',
    origin: 'http://127.0.0.1:3100',
    secureCookie: false,
    production: true,
  });
  try {
    const index = await request(app).get('/').expect(200).expect('Content-Type', /html/);
    assert.match(index.text, /RxLumen/);
    assert.match(index.headers['content-security-policy'], /script-src 'self'/);
    const asset = /src="([^\"]+\.js)"/.exec(index.text)?.[1];
    assert.ok(asset, 'built HTML links a JavaScript bundle');
    await request(app)
      .get(asset)
      .expect(200)
      .expect('Content-Type', /javascript/);
    const sample = await request(app).get('/import-example.json').expect(200);
    assert.equal(sample.body.length, 2);
    assert.ok(sample.body.every((v: { isDemo: boolean }) => v.isDemo));
    await request(app).get('/api/health').expect(200);
    const data = await request(app).get('/api/manuals').expect(200);
    assert.equal(data.body.total, 0);
    await request(app).get('/api/not-a-route').expect(404).expect('Content-Type', /json/);
    await request(app).get('/a-client-route').expect(200).expect('Content-Type', /html/);
  } finally {
    await db.$disconnect();
  }
});

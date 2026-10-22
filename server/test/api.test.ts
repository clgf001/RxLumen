import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { readFileSync } from 'node:fs';

test('API integration: access, search, review, import, conflicts, persistence', async (t) => {
  const db = new PrismaClient();
  const app = createApp(db, {
    password: 'only-for-automated-tests-123456',
    origin: 'http://localhost:5173',
    secureCookie: false,
  });
  const agent = request.agent(app);
  const demo = JSON.parse(readFileSync('client/public/import-example.json', 'utf8'));
  try {
    await t.test('empty database and health', async () => {
      await request(app).get('/api/health').expect(200);
      const res = await request(app).get('/api/manuals').expect(200);
      assert.equal(res.body.total, 0);
      await request(app).get('/api/manuals?page=-1').expect(400);
      await request(app).get('/api/manuals?pageSize=1000').expect(400);
    });
    await t.test('anonymous and foreign-origin writes rejected', async () => {
      await request(app).post('/api/admin/manuals').send(demo[0]).expect(401);
      await request(app).get('/api/manuals?scope=admin').expect(401);
      await request(app)
        .post('/api/auth/login')
        .set('Origin', 'https://untrusted.example')
        .send({ password: 'only-for-automated-tests-123456' })
        .expect(403);
      await agent.post('/api/auth/login').send({ password: 'wrong' }).expect(401);
      const result = await agent
        .post('/api/auth/login')
        .send({ password: 'only-for-automated-tests-123456' })
        .expect(200);
      assert.match(result.headers['set-cookie'][0], /HttpOnly/);
      assert.match(result.headers['set-cookie'][0], /SameSite=Strict/);
    });
    await t.test('real publication requires review and valid sources', async () => {
      await agent
        .post('/api/admin/manuals')
        .send({
          genericName: '测试占位（非真实药品）',
          manufacturer: '虚构测试机构',
          approvalNumber: 'TEST-ONLY',
          status: 'published',
        })
        .expect(400);
      await agent
        .post('/api/admin/manuals')
        .send({ ...demo[0], sourceUrl: 'javascript:alert(1)' })
        .expect(400);
      await agent
        .post('/api/admin/manuals')
        .send({ ...demo[0], reviewedAt: '2026-02-30' })
        .expect(400);
      await agent
        .post('/api/admin/manuals')
        .send({ ...demo[0], genericName: '未标明演示名称' })
        .expect(400);
      await agent
        .post('/api/admin/manuals')
        .send({ ...demo[0], unknownField: 'reject me' })
        .expect(400);
    });
    await t.test('dry-run never writes, atomic import and duplicate protection', async () => {
      const preview = await agent
        .post('/api/admin/import')
        .send({ items: demo, dryRun: true })
        .expect(200);
      assert.equal(preview.body.count, 2);
      assert.equal(await db.manual.count(), 0);
      await agent
        .post('/api/admin/import')
        .send({ items: [demo[0], { ...demo[1], genericName: '' }], dryRun: false })
        .expect(400);
      assert.equal(await db.manual.count(), 0);
      await agent
        .post('/api/admin/import')
        .send({ items: [demo[0], demo[0]], dryRun: false })
        .expect(409);
      await agent.post('/api/admin/import').send({ items: demo, dryRun: false }).expect(200);
      await agent
        .post('/api/admin/import')
        .send({ items: [{ ...demo[0], approvalNumber: 'DEMO-NEW' }, demo[1]], dryRun: false })
        .expect(409);
      assert.equal(await db.manual.count(), 2);
      await agent
        .post('/api/admin/import')
        .send({
          items: Array.from({ length: 201 }, (_, i) => ({
            ...demo[0],
            approvalNumber: `DEMO-BATCH-${i}`,
          })),
          dryRun: false,
        })
        .expect(400);
    });
    await t.test(
      'search generic/trade name, pinyin, initials, manufacturer, approval and pagination',
      async () => {
        for (const q of ['星屿', '演示星屿', 'xingyu', 'XY', '虚构样例工坊', 'DEMO-ONLY-001']) {
          const res = await request(app).get('/api/manuals').query({ q }).expect(200);
          assert.equal(res.body.total, 1, q);
        }
        assert.equal(
          (await request(app).get('/api/manuals').query({ q: '云舟', field: 'manufacturer' })).body
            .total,
          1,
        );
        assert.equal((await request(app).get('/api/manuals?demo=real')).body.total, 0);
        assert.equal(
          (await request(app).get('/api/manuals?pageSize=1&page=2')).body.items.length,
          1,
        );
        assert.equal((await request(app).get('/api/manuals?q=不存在的样例')).body.total, 0);
      },
    );
    await t.test('draft privacy, edit optimistic locking and delete', async () => {
      const draft = {
        ...demo[0],
        genericName: '【虚构演示】草稿占位',
        approvalNumber: 'DEMO-DRAFT',
        status: 'draft',
      };
      const created = await agent.post('/api/admin/manuals').send(draft).expect(201);
      const id = created.body.id;
      await request(app).get(`/api/manuals/${id}`).expect(404);
      await agent.get(`/api/manuals/${id}`).expect(200);
      assert.equal((await request(app).get('/api/manuals')).body.total, 2);
      assert.equal((await agent.get('/api/manuals?scope=admin')).body.total, 3);
      await agent
        .put(`/api/admin/manuals/${id}`)
        .send({ version: 1, data: { ...draft, status: 'published' } })
        .expect(200);
      await request(app).get(`/api/manuals/${id}`).expect(200);
      await agent.put(`/api/admin/manuals/${id}`).send({ version: 1, data: draft }).expect(409);
      await agent.delete(`/api/admin/manuals/${id}`).send({ version: 1 }).expect(409);
      await agent.delete(`/api/admin/manuals/${id}`).send({ version: 2 }).expect(200);
      await request(app).get(`/api/manuals/${id}`).expect(404);
    });
    await t.test('persistence across clients and logout', async () => {
      const other = new PrismaClient();
      assert.equal(await other.manual.count(), 2);
      await other.$disconnect();
      await agent.post('/api/auth/logout').send({}).expect(200);
      assert.equal((await agent.get('/api/auth/me')).body.authenticated, false);
      await agent.post('/api/admin/manuals').send(demo[0]).expect(401);
    });
  } finally {
    await db.$disconnect();
  }
});

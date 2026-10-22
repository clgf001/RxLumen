import express, { type Request, type Response, type NextFunction } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { pinyin } from 'pinyin-pro';
import { z } from 'zod';
import { manualSchema, type ManualInput } from '../../shared/manual.js';

type Config = { password: string; origin: string; secureCookie: boolean; production?: boolean };
const normalize = (s: string) =>
  s.toLowerCase().replace(/[\s'’\-ü]/g, (m) => (m === 'ü' ? 'v' : ''));
function indexed(v: ManualInput) {
  const name = `${v.genericName} ${v.tradeName}`;
  return {
    ...v,
    pinyin: normalize(pinyin(name, { toneType: 'none' })),
    pinyinInitials: normalize(pinyin(name, { pattern: 'first', toneType: 'none' })),
  };
}
const editSchema = z.object({ version: z.number().int().positive(), data: manualSchema }).strict();
const importSchema = z
  .object({ items: z.array(manualSchema).min(1).max(200), dryRun: z.boolean().default(true) })
  .strict();

export function createApp(db: PrismaClient, config: Config) {
  if (config.password.length < 16)
    throw new Error('ADMIN_PASSWORD 至少 16 个字符，请先运行 npm run setup');
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      strictTransportSecurity: config.secureCookie ? undefined : false,
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'upgrade-insecure-requests': config.secureCookie ? [] : null,
        },
      },
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  const sessions = new Map<string, number>();
  const salt = randomBytes(16);
  const passwordHash = scryptSync(config.password, salt, 64);
  function isAdmin(req: Request) {
    const token = /(?:^|;\s*)rx_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!token) return false;
    const expires = sessions.get(token);
    if (!expires || expires < Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }
  const admin = (req: Request, res: Response, next: NextFunction) =>
    isAdmin(req) ? next() : void res.status(401).json({ error: '请先登录管理后台' });
  app.use('/api', (req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== config.origin
    ) {
      res.status(403).json({ error: '请求来源不受信任，请检查 APP_ORIGIN' });
      return;
    }
    next();
  });
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: '登录尝试过多，请 15 分钟后重试' },
  });
  app.post('/api/auth/login', loginLimit, (req, res) => {
    const parsed = z.object({ password: z.string().max(256) }).safeParse(req.body);
    if (
      !parsed.success ||
      !timingSafeEqual(scryptSync(parsed.data.password, salt, 64), passwordHash)
    ) {
      res.status(401).json({ error: '管理员密码不正确' });
      return;
    }
    for (const [token, expiry] of sessions) if (expiry < Date.now()) sessions.delete(token);
    if (sessions.size >= 20) sessions.delete(sessions.keys().next().value!);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
    res
      .cookie('rx_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: config.secureCookie,
        maxAge: 8 * 60 * 60 * 1000,
        path: '/api',
      })
      .json({ ok: true });
  });
  app.get('/api/auth/me', (req, res) => res.json({ authenticated: isAdmin(req) }));
  app.post('/api/auth/logout', (req, res) => {
    const token = /(?:^|;\s*)rx_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (token) sessions.delete(token);
    res
      .clearCookie('rx_session', {
        path: '/api',
        httpOnly: true,
        sameSite: 'strict',
        secure: config.secureCookie,
      })
      .json({ ok: true });
  });
  app.get('/api/health', async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });
  app.get('/api/manuals', async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().max(100).default(''),
        field: z.enum(['all', 'genericName', 'manufacturer', 'approvalNumber']).default('all'),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(12),
        demo: z.enum(['all', 'real', 'demo']).default('all'),
        scope: z.enum(['public', 'admin']).default('public'),
      })
      .parse(req.query);
    if (query.scope === 'admin' && !isAdmin(req)) {
      res.status(401).json({ error: '请先登录管理后台' });
      return;
    }
    const where: Prisma.ManualWhereInput = query.scope === 'admin' ? {} : { status: 'published' };
    if (query.demo !== 'all') where.isDemo = query.demo === 'demo';
    if (query.q) {
      if (query.field === 'all')
        where.OR = [
          ...['genericName', 'tradeName', 'manufacturer', 'approvalNumber'].map((key) => ({
            [key]: { contains: query.q },
          })),
          { pinyin: { contains: normalize(query.q) } },
          { pinyinInitials: { contains: normalize(query.q) } },
        ];
      else if (query.field === 'genericName')
        where.OR = [
          { genericName: { contains: query.q } },
          { tradeName: { contains: query.q } },
          { pinyin: { contains: normalize(query.q) } },
          { pinyinInitials: { contains: normalize(query.q) } },
        ];
      else Object.assign(where, { [query.field]: { contains: query.q } });
    }
    const [total, items, totalPublished, demoCount] = await db.$transaction([
      db.manual.count({ where }),
      db.manual.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.manual.count({ where: { status: 'published' } }),
      db.manual.count({ where: { status: 'published', isDemo: true } }),
    ]);
    res.json({
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPublished,
      demoCount,
    });
  });
  app.get('/api/manuals/:id', async (req, res) => {
    const item = await db.manual.findUnique({ where: { id: req.params.id as string } });
    if (!item || (item.status !== 'published' && !isAdmin(req))) {
      res.status(404).json({ error: '说明书不存在或尚未发布' });
      return;
    }
    res.json(item);
  });
  app.use(
    '/api/admin',
    admin,
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: '操作过于频繁，请稍后重试' },
    }),
  );
  app.post('/api/admin/manuals', async (req, res) =>
    res.status(201).json(await db.manual.create({ data: indexed(manualSchema.parse(req.body)) })),
  );
  app.put('/api/admin/manuals/:id', async (req, res) => {
    const { version, data } = editSchema.parse(req.body);
    const result = await db.manual.updateMany({
      where: { id: req.params.id as string, version },
      data: { ...indexed(data), version: { increment: 1 } },
    });
    if (!result.count) {
      res.status(409).json({ error: '记录已变更或已删除，请刷新后重新编辑' });
      return;
    }
    res.json({ ok: true });
  });
  app.delete('/api/admin/manuals/:id', async (req, res) => {
    const { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
    const result = await db.manual.deleteMany({ where: { id: req.params.id as string, version } });
    if (!result.count) {
      res.status(409).json({ error: '记录已变更或已删除，请刷新后重试' });
      return;
    }
    res.json({ ok: true });
  });
  app.post('/api/admin/import', async (req, res) => {
    const { items, dryRun } = importSchema.parse(req.body);
    const keys = items.map((v) => v.approvalNumber);
    if (new Set(keys).size !== keys.length) {
      res.status(409).json({ error: '文件内存在重复批准文号，未导入任何数据' });
      return;
    }
    const existing = await db.manual.findMany({
      where: { approvalNumber: { in: keys } },
      select: { approvalNumber: true },
    });
    if (existing.length) {
      res
        .status(409)
        .json({
          error: `批准文号已存在：${existing.map((v) => v.approvalNumber).join('、')}。导入仅支持新增，未写入任何数据。`,
        });
      return;
    }
    if (!dryRun) await db.$transaction(items.map((v) => db.manual.create({ data: indexed(v) })));
    res.json({ count: items.length, dryRun });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));
  if (config.production) {
    app.use(express.static(path.resolve('dist/web')));
    app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/web/index.html')));
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({
          error: '数据校验失败',
          details: error.issues.map((v) => `${v.path.join('.') || '记录'}：${v.message}`),
        });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: '批准文号已存在，未保存数据' });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'JSON 格式不正确' });
      return;
    }
    if ((error as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: '导入文件或请求超过 2 MB' });
      return;
    }
    console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: '服务暂不可用，请检查数据库连接或联系管理员' });
  });
  return app;
}

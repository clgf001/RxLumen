import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

if (!existsSync('.env')) {
  const password = randomBytes(24).toString('base64url');
  writeFileSync(
    '.env',
    readFileSync('.env.example', 'utf8').replace(
      'ADMIN_PASSWORD=""',
      `ADMIN_PASSWORD="${password}"`,
    ),
    { mode: 0o600 },
  );
  console.log('已创建 .env。请在本机文件中查看管理员密码，勿上传此文件。');
}
for (const args of [['node_modules/prisma/build/index.js', 'generate'], ['scripts/migrate.mjs']]) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log('初始化完成，数据库默认留空。运行 npm run dev 启动。');

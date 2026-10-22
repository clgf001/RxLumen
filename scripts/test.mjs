import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('work');
const production = process.argv.includes('--production');
if (production && !existsSync('dist/web/index.html'))
  throw new Error('请先运行 npm run build，再运行 npm run smoke');
mkdirSync(root, { recursive: true });
const dir = mkdtempSync(path.join(root, 'test-'));
writeFileSync(path.join(dir, 'test.db'), '');
const env = {
  ...process.env,
  DATABASE_URL: `file:${path.join(dir, 'test.db').replaceAll('\\', '/')}`,
};
try {
  for (const args of [
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    [
      '--import',
      'tsx',
      '--test',
      production ? 'server/test/production.test.ts' : 'server/test/api.test.ts',
    ],
  ]) {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      break;
    }
  }
} finally {
  if (!dir.startsWith(root + path.sep)) throw new Error('Unexpected test directory');
  rmSync(dir, { recursive: true, force: true });
}

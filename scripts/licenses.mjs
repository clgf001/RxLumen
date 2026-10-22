import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const permitted = new Set([
  'MIT',
  'Apache-2.0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'CC0-1.0',
  'CC-BY-4.0',
  'BlueOak-1.0.0',
  '(MIT OR CC0-1.0)',
  '(MIT OR Apache-2.0)',
  '(MIT AND Zlib)',
  'Python-2.0',
  'Unlicense',
]);
const records = [];
let notices =
  '# Third-party notices\n\n本项目原创代码使用 AGPL-3.0-only；以下依赖保留各自许可证及通知。本清单由锁文件与已安装包生成，包含开发依赖和可选平台包。未安装的可选平台包仅记录锁文件声明，不打包其内容。分发构建时请保留本文件及原始包中的完整通知。\n\n';
for (const [location, pkg] of Object.entries(lock.packages || {})) {
  if (!location) continue;
  const name = pkg.name || location.slice(location.lastIndexOf('node_modules/') + 13);
  const license =
    pkg.license ||
    (existsSync(path.join(location, 'package.json'))
      ? JSON.parse(readFileSync(path.join(location, 'package.json'), 'utf8')).license
      : 'UNKNOWN');
  if (!permitted.has(license))
    throw new Error(`需要人工审核的许可证: ${name}@${pkg.version}: ${license}`);
  const files = existsSync(location)
    ? readdirSync(location).filter((f) => /^(licen[sc]e|notice|copying)(\.|$)/i.test(f))
    : [];
  records.push({
    name,
    version: pkg.version,
    license,
    location,
    dev: !!pkg.dev,
    optional: !!pkg.optional,
    installed: existsSync(location),
    noticeFiles: files,
  });
  notices += `## ${name}@${pkg.version}\n\nLicense: ${license}\n\n`;
  if (name === 'caniuse-lite')
    notices +=
      'Attribution: caniuse-lite / Can I use browser compatibility data, by Ben Briggs, Alexis Deveria and contributors. Source: https://github.com/browserslist/caniuse-lite and https://caniuse.com/ . License: https://creativecommons.org/licenses/by/4.0/ . Used unchanged; this data retains CC-BY-4.0.\n\n';
  for (const file of files) {
    const full = path.join(location, file);
    try {
      notices += `### ${file}\n\n\u0060\u0060\u0060text\n${readFileSync(full, 'utf8')}\n\u0060\u0060\u0060\n\n`;
    } catch {
      /* A directory is not a license file. */
    }
  }
}
mkdirSync('docs', { recursive: true });
writeFileSync('docs/dependency-licenses.json', JSON.stringify(records, null, 2) + '\n');
writeFileSync('THIRD_PARTY_NOTICES.md', notices);
console.log(`已核查 ${records.length} 个锁定依赖，许可证均在已审核的宽松许可清单内。`);

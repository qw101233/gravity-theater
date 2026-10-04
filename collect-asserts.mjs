/**
 * collect-asserts.mjs — 跑两套验证，把真实断言数写进 slides-data.json
 *
 * 为什么单独一步：幻灯片里出现的每个数字都必须来自实测。
 * 手写过一次 "87"，实际是 95 —— 摆拍数字比没有数字更糟。
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const NODE = process.execPath;

function runCount(script) {
  const out = execFileSync(NODE, [join(__dir, script)], { encoding: 'utf8', maxBuffer: 1 << 24 });
  const m = out.match(/通过\s+(\d+)\s+失败\s+(\d+)\s+合计\s+(\d+)/);
  if (!m) throw new Error('未能从 ' + script + ' 输出中解析断言数');
  return { pass: +m[1], fail: +m[2], total: +m[3] };
}

const nodeAssert = runCount('test/verify-node.mjs');
const browserAssert = runCount('test/verify-browser.mjs');
if (nodeAssert.fail || browserAssert.fail) {
  console.error('有断言失败，拒绝写入断言数');
  process.exit(1);
}
const f = join(__dir, 'slides-data.json');
const D = JSON.parse(readFileSync(f, 'utf8'));
D.asserts = { node: nodeAssert, browser: browserAssert, total: nodeAssert.total + browserAssert.total };
writeFileSync(f, JSON.stringify(D, null, 2));
console.log(`物理断言 ${nodeAssert.total} + 浏览器断言 ${browserAssert.total} = ${D.asserts.total}（已写入 slides-data.json）`);

/**
 * shots-render.mjs — 把 slides/*.html 按 1080×1920 渲染成 PNG
 *
 * ⚠️ 两条实测踩过的坑：
 *  1. viewport 必须与 CSS 尺寸完全一致（1080×1920），否则截图尺寸不对。
 *  2. slides/*.html 里引 ../shots/*.png，路径以 HTML 文件位置为基准。
 *     这里用 file:// 加载，浏览器按 HTML 的真实目录解析，相对路径天然正确。
 */
import { createRequire } from 'module';
import { readdirSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/m/.workbuddy/binaries/node/workspace/node_modules/playwright');

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = __dir;          // 本脚本就在项目根目录
const SLIDES = join(ROOT, 'slides');
const OUT = join(ROOT, 'slides-png');
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SLIDES).filter(f => f.endsWith('.html')).sort();
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));

for (const f of files) {
  await page.goto(pathToFileURL(join(SLIDES, f)).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const out = join(OUT, f.replace('.html', '.png'));
  await page.screenshot({ path: out });
  /* 量「最后一个子元素底边」而不是 scrollHeight：
     .foot 是 position:absolute，不参与正常流，scrollHeight 量不到它，
     于是脚注压在卡片上时仍然报"无溢出"——这是自己踩的坑。 */
  const box = await page.evaluate(() => {
    const wrap = document.querySelector('.wrap');
    let bottom = 0;
    for (const el of wrap.children) {
      const r = el.getBoundingClientRect();
      bottom = Math.max(bottom, r.bottom);
    }
    const footTop = document.querySelector('.foot').getBoundingClientRect().top;
    return { w: 1080, bottom: Math.ceil(bottom), footTop: Math.ceil(footTop) };
  });
  const gap = box.footTop - box.bottom;
  console.log(`${f.padEnd(24)} → 内容底 ${box.bottom} / 脚注顶 ${box.footTop}` +
              (gap < 0 ? `  ⚠️ 重叠 ${-gap}px` : (gap < 20 ? `  ⚠️ 间距仅 ${gap}px` : '')));
}
await browser.close();
if (errs.length) { console.log('\n页面错误:'); errs.forEach(e => console.log('  ' + e)); }
console.log(`\n共 ${files.length} 张，已输出到 slides-png/`);

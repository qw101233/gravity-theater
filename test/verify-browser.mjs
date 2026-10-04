/*!
 * Gravity Arena · 引力剧场
 * test/verify-browser.mjs — 浏览器端验证（Playwright）
 *
 * 物理正确性由 verify-node.mjs 保证（纯 Node，快 20 倍）。
 * 本脚本只验"浏览器里真的能跑"：加载、渲染、交互、UI、截图。
 *
 * 运行：node test/verify-browser.mjs   （Playwright 路径已硬编码，见顶部 createRequire）
 */
/* ESM 不认 NODE_PATH（Node 的已知限制）——必须用绝对路径 import。
   这条与"Node 里的 CJS 能用 NODE_PATH"不同，别混。 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/m/.workbuddy/binaries/node/workspace/node_modules/playwright');
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const SHOTS = join(ROOT, 'shots');
mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const lines = [];
function check(name, cond, detail) {
  if (cond) { pass++; lines.push(`  ✅ ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; lines.push(`  ❌ ${name}${detail ? '  — ' + detail : ''}`); }
}
function section(t) { lines.push(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`); }

const browser = await chromium.launch({
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// fail-fast：任何 JS 错误立即中止
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const url = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/');
section('B1  页面加载（file:// 直开，不需服务器）');
try {
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  check('index.html 通过 file:// 加载', true, url.slice(0, 60) + '...');
} catch (e) {
  check('index.html 加载', false, e.message);
  process.exit(1);
}
await page.waitForTimeout(900);

check('无 JS 运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ') || '无');
check('无 console.error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || '无');

section('B2  核心 API 就绪');
const api = await page.evaluate(() => ({
  hasApp: typeof window.GA_APP !== 'undefined',
  hasGA: typeof window.GA !== 'undefined',
  version: window.GA && window.GA.VERSION,
  presets: window.GA ? window.GA.presetOrder.length : 0,
  integrators: window.GA ? window.GA.integratorOrder.length : 0,
  N: window.GA_APP ? window.GA_APP.app.sim.N : 0
}));
check('window.GA_APP 存在', api.hasApp);
check('window.GA 存在且版本号已填', api.hasGA && !!api.version, 'v' + api.version);
check('预设场景已注册', api.presets === 8, api.presets + ' 个');
check('积分器已注册', api.integrators === 4, api.integrators + ' 个');
check('默认场景已载入且有天体', api.N > 0, 'N=' + api.N);

section('B3  画布真的画出了东西（不是黑屏）');
/* 判据：不能只看"没报错"，要量像素。
   做法：读画布像素，统计非背景像素比例与颜色多样性。
   —— 这条断言是"画面是否正确"的唯一客观依据。 */
const px = await page.evaluate(() => {
  const cv = document.getElementById('view');
  const c2 = document.createElement('canvas');
  c2.width = cv.width; c2.height = cv.height;
  const cx = c2.getContext('2d');
  cx.drawImage(cv, 0, 0);
  const d = cx.getImageData(0, 0, c2.width, c2.height).data;
  let bright = 0, total = 0, sum = 0;
  const hist = new Set();
  for (let i = 0; i < d.length; i += 4 * 37) {   // 抽样，省时间
    const lum = d[i] * 0.3 + d[i + 1] * 0.6 + d[i + 2] * 0.1;
    sum += lum; total++;
    if (lum > 60) bright++;
    if (lum > 100) hist.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
  }
  return { brightFrac: bright / total, avgLum: sum / total, colors: hist.size, w: cv.width, h: cv.height };
});
check('画布尺寸正常', px.w > 800 && px.h > 400, px.w + '×' + px.h);
check('画面不是纯黑（平均亮度 > 3）', px.avgLum > 3, 'avgLum=' + px.avgLum.toFixed(2));
check('存在足够多的高亮像素（天体已渲染）', px.brightFrac > 0.0005, (px.brightFrac * 100).toFixed(3) + '% 亮像素');
check('颜色有层次（加性混合生效，非单色）', px.colors > 3, px.colors + ' 种色阶');

section('B4  时间推进与守恒量（浏览器内实测）');
const adv = await page.evaluate(() => {
  const A = window.GA_APP;
  A.setPlaying(false);
  A.load('figure8');
  const e0 = A.energy();
  A.advance(2000);
  const e1 = A.energy();
  const d = A.drift();
  return { e0, e1, dE: d.dE, t: A.stats().time };
});
check('推进 2000 步后时间已增加', adv.t > 0, 't=' + adv.t.toFixed(3));
check('八字编舞能量守恒（|ΔE/E| < 1e-6）', Math.abs(adv.dE) < 1e-6, 'ΔE/E=' + adv.dE.toExponential(2));

section('B5  全部 8 个场景都能加载并推进');
const presetRun = await page.evaluate(() => {
  const A = window.GA_APP;
  const out = [];
  for (const k of window.GA.presetOrder) {
    const n = A.load(k);
    A.advance(30);
    const st = A.stats();
    const finite = isFinite(st.E) && isFinite(st.time);
    out.push({ key: k, N: n, finite, E: st.E, dE: st.dE });
  }
  return out;
});
for (const p of presetRun) {
  check(`场景 ${p.key.padEnd(13)} N=${String(p.N).padStart(4)} 可加载可推进`,
        p.finite, `E=${Number(p.E).toExponential(2)}`);
}
check('所有场景能量均有限（无 NaN/Inf）', presetRun.every(p => p.finite));

section('B6  交互：积分器切换与辛/非辛对比（浏览器内）');
/* ⚠️ 每次切换积分器前必须重新加载场景：
   drift 是相对「上次 snapshot」的累积量，若在上一次的结果上继续跑，
   三种方法都会包含前一次的漂移，测出来几乎相同（首次实测三者都是 1.78e-4）。 */
const integ = await page.evaluate(() => {
  const A = window.GA_APP;
  const res = {};
  for (const g of ['euler', 'verlet', 'pefrl']) {
    A.load('figure8');            // ← 重置状态与参考基准
    A.setIntegrator(g);
    A.advance(6000);
    res[g] = Math.abs(A.drift().dE);
  }
  return res;
});
lines.push(`     |ΔE/E| (八字编舞, 6000 步)：Euler ${integ.euler.toExponential(2)} · Verlet ${integ.verlet.toExponential(2)} · PEFRL ${integ.pefrl.toExponential(2)}`);
check('辛方法(Verlet) 能量误差 < Euler/100', integ.verlet < integ.euler / 100,
      `${(integ.euler / integ.verlet).toExponential(1)}×`);
check('PEFRL 能量误差 < 1e-6', integ.pefrl < 1e-6, integ.pefrl.toExponential(2));

section('B7  交互：引力算法切换（Barnes–Hut ↔ 暴力）');
/* 注意：不能用 app.lastStepMs —— 它只在 rAF 主循环里更新，
   而本测试用 advance() 同步推进，必须自己计时。 */
const method = await page.evaluate(() => {
  const A = window.GA_APP;
  const time = (m, steps) => {
    A.load('starCluster'); A.setMethod(m); A.advance(3);
    const t0 = performance.now();
    A.advance(steps);
    return (performance.now() - t0) / steps;
  };
  const bh = time('bh', 25);
  const br = time('brute', 6);
  A.setMethod('bh');
  return { bhStep: bh, brStep: br, N: A.stats().N };
});
lines.push(`     N=${method.N}: BH ${method.bhStep.toFixed(2)}ms/步 vs 暴力 ${method.brStep.toFixed(2)}ms/步`);
check('N=2400 时 Barnes–Hut 明显快于暴力（浏览器内实测）', method.bhStep * 2 < method.brStep,
      `${(method.brStep / Math.max(method.bhStep, 0.001)).toFixed(1)}× 加速`);

section('B8  交互：UI 控件（点击真实 DOM 元素）');
// 前面 B6/B7 用 advance() 同步推进并把 playing 置 false，这里先恢复运行态
await page.evaluate(() => { window.GA_APP.setPlaying(true); window.GA_APP.load('figure8'); });
await page.waitForTimeout(300);
// 点场景按钮
await page.click('.preset-btn[data-key="chaos"]');
await page.waitForTimeout(250);
const afterClick = await page.evaluate(() => window.GA_APP.app.presetKey);
check('点击场景按钮切换成功', afterClick === 'chaos', '当前=' + afterClick);

// 暂停/播放
await page.click('#btn-play');
await page.waitForTimeout(120);
const paused = await page.evaluate(() => window.GA_APP.app.playing);
check('暂停按钮生效', paused === false);
await page.click('#btn-play');
await page.waitForTimeout(120);
const resumed = await page.evaluate(() => window.GA_APP.app.playing);
check('播放按钮生效', resumed === true);

// 速度滑块
await page.fill('#speed', '70');
await page.dispatchEvent('#speed', 'input');
const sp = await page.evaluate(() => window.GA_APP.app.speed);
check('速度滑块生效（对数映射）', sp > 5 && sp < 30, 'slider=70 → speed=' + sp.toFixed(2));

// θ 滑块
await page.fill('#theta', '0.3');
await page.dispatchEvent('#theta', 'input');
const th = await page.evaluate(() => window.GA_APP.app.sim.theta);
check('θ 滑块生效', Math.abs(th - 0.3) < 0.01, 'θ=' + th);

// 下拉选择
await page.selectOption('#method', 'brute');
const m = await page.evaluate(() => window.GA_APP.app.sim.method);
check('引力算法下拉生效', m === 'brute', 'method=' + m);
await page.selectOption('#method', 'bh');
await page.selectOption('#integrator', 'pefrl');
const ig = await page.evaluate(() => window.GA_APP.app.sim.integrator);
check('积分器下拉生效', ig === 'pefrl', 'integrator=' + ig);

// 滚轮缩放
const scaleBefore = await page.evaluate(() => window.GA_APP.app.renderer.view.scale);
await page.mouse.move(500, 400);
await page.mouse.wheel(0, -240);
await page.waitForTimeout(120);
const scaleAfter = await page.evaluate(() => window.GA_APP.app.renderer.view.scale);
check('滚轮缩放生效', scaleAfter > scaleBefore, `${scaleBefore.toFixed(1)} → ${scaleAfter.toFixed(1)}`);

section('B9  性能：实际帧率（真实 rAF 循环）');
const perf = await page.evaluate(async () => {
  const A = window.GA_APP;
  A.load('galaxyMerge');       // 最大的场景：N=4802
  A.setPlaying(true);
  A.setSpeed(1);
  await new Promise(r => setTimeout(r, 2500));
  const st = A.stats();
  return { N: st.N, fps: st.fps, stepMs: st.stepMs, method: st.method, integrator: st.integrator };
});
lines.push(`     星系并合 N=${perf.N}: ${perf.fps.toFixed(1)} FPS，物理 ${perf.stepMs.toFixed(1)}ms/步（${perf.method}+${perf.integrator}）`);
check('最大场景 N≈4800 仍能实时运行（>12 FPS）', perf.fps > 12, perf.fps.toFixed(1) + ' FPS');
check('物理单步耗时 < 25ms', perf.stepMs < 25, perf.stepMs.toFixed(1) + ' ms');

section('B10  截图产出（用于图文与 README）');
const shots = [
  /* wantT = 期望推进到的物理时间；boost = 快放倍率。
     为什么需要 boost：headless + swiftshader 下帧率只有 25~45 FPS，
     等真实秒数累积不出足够的轨迹（实测等 7 秒只推进 1.4 个时间单位）。
     轨迹是逐积分步打点的，所以只要 rAF 在跑、提高倍率就能加快累积。
     用「推进到目标物理时间」做终止条件，比猜等几秒可靠。 */
  { key: 'figure8', file: 'shot-figure8.png', wantT: 4.2, boost: 3, label: '八字编舞' },
  { key: 'galaxyMerge', file: 'shot-galaxy.png', wantT: 3.0, boost: 3, label: '星系并合' },
  { key: 'innerSolar', file: 'shot-solar.png', wantT: 6.5, boost: 4, label: '内太阳系' },  // 6.5 年 ≈ 地球 6.5 圈
  { key: 'lagrange', file: 'shot-lagrange.png', wantT: 6.0, boost: 2, label: '等边三角形' },
  { key: 'starCluster', file: 'shot-cluster.png', wantT: 2.2, boost: 3, label: '球状星团' },
  { key: 'accretion', file: 'shot-accretion.png', wantT: 1.8, boost: 3, label: '吸积盘' },
  { key: 'chaos', file: 'shot-chaos.png', wantT: 3.4, boost: 2, label: '三体混沌' },
  { key: 'binary', file: 'shot-binary.png', wantT: 5.0, boost: 2, label: '双星系统' }
];
for (const s of shots) {
  try {
    await page.evaluate(({ key, boost }) => {
      const A = window.GA_APP;
      A.load(key);
      A.fit(null, 1.1);
      A.setPlaying(true);
      A.setSpeed(A.app.speed * boost);   // 临时快放，快滚截图
    }, s);
    // 轮询直到推进到目标物理时间（带超时兜底）
    await page.waitForFunction(
      (want) => window.GA_APP.stats().time >= want,
      s.wantT, { timeout: 25000, polling: 120 }
    ).catch(() => {});
    await page.evaluate(() => window.GA_APP.setPlaying(false));
    await page.waitForTimeout(160);
    await page.screenshot({ path: join(SHOTS, s.file) });
    const st = await page.evaluate(() => window.GA_APP.stats());
    check(`截图 ${s.label.padEnd(6)} ${s.file}`, st.time > s.wantT * 0.5,
          `N=${st.N} t=${st.time.toFixed(2)}/${s.wantT} ${st.fps.toFixed(0)}FPS`);
  } catch (e) {
    check(`截图 ${s.label}`, false, e.message);
  }
}
// 全景一张（含 UI 面板）
await page.evaluate(() => {
  const A = window.GA_APP;
  A.load('galaxyMerge'); A.fit(); A.setPlaying(true); A.setSpeed(A.app.speed * 3);
});
await page.waitForFunction(() => window.GA_APP.stats().time >= 3.0, null, { timeout: 25000, polling: 120 }).catch(() => {});
await page.evaluate(() => window.GA_APP.setPlaying(false));
await page.waitForTimeout(140);
await page.screenshot({ path: join(SHOTS, 'ui-full.png') });
check('整页截图 ui-full.png（含控制面板）', true);

/* 结束时无累积错误 */
check('全程无 JS 错误累积', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ') || '无');

/* ================================================================
   竖版纯画布截图（给 9:16 幻灯片用）
   两个必须做的处理：
     ① 隐藏 #hud / #brand / #zoomhint —— 它们是画布容器上的绝对定位元素，
        用 elementHandle.screenshot() 截 #view 时会被一起框进去。
     ② 视口改成竖向比例（900×1180）—— 横图塞进 9:16 必然左右大留白。
   ================================================================ */
section('B11  竖版纯画布截图（幻灯片素材）');
{
  const vp = await browser.newContext({ viewport: { width: 900, height: 1180 }, deviceScaleFactor: 1 });
  const p2 = await vp.newPage();
  p2.on('pageerror', e => pageErrors.push(e.message));
  await p2.goto(url, { waitUntil: 'load' });
  await p2.waitForTimeout(900);
  await p2.addStyleTag({ content:
    '#hud,#brand,#zoomhint{display:none!important}#panel{display:none!important}' });
  /* ⚠️ 隐藏面板后必须手动触发 resize：Renderer.resize() 是在 window resize
     事件里调用的，而 addStyleTag 改布局不会触发该事件。
     不做这步，canvas 的 width/height 仍是隐藏前的值，截出来只有一小块。 */
  await p2.evaluate(() => {
    window.GA_APP.app.renderer.resize();
    window.dispatchEvent(new Event('resize'));
  });
  await p2.waitForTimeout(300);
  const tall = [
    // 八字编舞的轨道是 4:1.2 的横长条，竖版装不下 → zoomK=0.55 做特写
    { key: 'figure8', file: 'tall-figure8.png', wantT: 4.2, boost: 3, mode: 'cover', label: '八字编舞' },
    { key: 'galaxyMerge', file: 'tall-galaxy.png', wantT: 3.4, boost: 3, mode: 'contain', label: '星系并合' },
    // 等边三角形是圆形构型 → 必须 contain；t 取 2.6 让三角形形状可辨
    { key: 'lagrange', file: 'tall-lagrange.png', wantT: 2.6, boost: 2, mode: 'contain', label: '等边三角形' },
    { key: 'innerSolar', file: 'tall-solar.png', wantT: 6.5, boost: 4, mode: 'contain', label: '内太阳系' },
    { key: 'binary', file: 'tall-binary.png', wantT: 5.0, boost: 2, mode: 'contain', label: '双星系统' },
    { key: 'starCluster', file: 'tall-cluster.png', wantT: 2.4, boost: 3, mode: 'contain', label: '球状星团' },
    { key: 'chaos', file: 'tall-chaos.png', wantT: 3.4, boost: 2, mode: 'contain', label: '三体混沌' },
    { key: 'accretion', file: 'tall-accretion.png', wantT: 1.9, boost: 3, mode: 'contain', label: '吸积盘' }
  ];
  for (const s of tall) {
    await p2.evaluate(({ key, boost, zoomK, mode }) => {
      const A = window.GA_APP;
      A.load(key);
      /* 竖版画布装不下横长条内容（八字 4:1.2、内太阳系 1.5:0），
         必须用 cover 铺满 —— contain 会留 40% 空白。 */
      A.app.renderer.fit(A.app.sim, 1.1, mode || 'cover');
      if (zoomK) A.app.renderer.view.scale *= zoomK;
      A.setPlaying(true); A.setSpeed(A.app.speed * boost);
    }, s);
    await p2.waitForFunction((w) => window.GA_APP.stats().time >= w, s.wantT,
      { timeout: 25000, polling: 120 }).catch(() => {});
    await p2.evaluate(() => window.GA_APP.setPlaying(false));
    await p2.waitForTimeout(150);
    const cv = await p2.$('#view');
    await cv.screenshot({ path: join(SHOTS, s.file) });
    const st = await p2.evaluate(() => window.GA_APP.stats());
    check(`竖版 ${s.label.padEnd(6)} ${s.file}`, st.time > s.wantT * 0.5,
          `t=${st.time.toFixed(2)}/${s.wantT}`);
  }
  await vp.close();
}

await browser.close();

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║        Gravity Arena · 浏览器端验证报告                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
lines.forEach(l => console.log(l));
console.log(`\n──────────────────────────────────────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fail}   合计 ${pass + fail}`);
console.log(`──────────────────────────────────────────────────────────────`);
process.exit(fail === 0 ? 0 : 1);

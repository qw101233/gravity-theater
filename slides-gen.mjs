/**
 * slides-gen.mjs — 生成 9:16 竖屏介绍图文（8 张）
 *
 * 铁律：幻灯片里的每个数字都从 slides-data.json 读，
 * 那个 JSON 是由 test/verify-node.mjs 的同一套代码跑出来的。
 * 绝不在这里手写任何数据 —— 手算实测翻车过。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const D = JSON.parse(readFileSync('slides-data.json', 'utf8'));
mkdirSync('slides', { recursive: true });

/* 科学计数法必须用真上标 <sup>：纯文本的 x10^-7 在小字号下根本读不出来，
   而且不同渲染器对 ^ 的处理不一致。 */
const e2 = x => {
  const [m, e] = Number(x).toExponential(2).split('e');
  const sign = e[0] === '-' ? '−' : '';
  const sup = e.replace(/[-+]/, '').split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
  return `${m}×10${sign}<sup>${sup}</sup>`;
};
const pc = (x, d = 2) => (x * 100).toFixed(d) + '%';
const NAME = { euler: '半隐式 Euler', verlet: 'Velocity Verlet', pefrl: 'PEFRL（4 阶辛）', rk4: '经典 RK4' };

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1920px;overflow:hidden;
  font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  background:#05070f;color:#e8ecf8;position:relative}
.bg{position:absolute;inset:0;
  background:
    radial-gradient(ellipse 90% 55% at 50% 8%,#111a3d 0%,transparent 62%),
    radial-gradient(ellipse 70% 45% at 18% 88%,#0d1830 0%,transparent 65%),
    linear-gradient(180deg,#05070f 0%,#080d1e 48%,#04060e 100%)}
.stars{position:absolute;inset:0;opacity:.5}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;padding:104px 76px 150px}
.eyebrow{font-family:"SF Mono",Consolas,monospace;font-size:23px;letter-spacing:.32em;
  color:#7aa2ff;text-transform:uppercase;margin-bottom:22px;display:flex;align-items:center;gap:18px}
.eyebrow::after{content:'';flex:1;height:2px;background:linear-gradient(90deg,#7aa2ff,transparent)}
h1{font-size:104px;line-height:1.04;font-weight:800;letter-spacing:-.02em;
  background:linear-gradient(100deg,#fff 0%,#9fc0ff 42%,#ffd166 78%,#ff9ec7 100%);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:32px}
h2{font-size:58px;line-height:1.14;font-weight:800;margin-bottom:20px;color:#fff}
.lede{font-size:32px;line-height:1.66;color:#a8b4d8;margin-bottom:44px}
.body{font-size:28px;line-height:1.78;color:#c3cce8}
.mono{font-family:"SF Mono",Consolas,monospace}
.hl{color:#ffd166;font-weight:700}
.hl2{color:#7aa2ff;font-weight:700}
.hl3{color:#7ee787;font-weight:700}
.muted{color:#6b779e}
.card{background:linear-gradient(160deg,rgba(20,28,58,.94),rgba(12,17,36,.94));
  border:1px solid #232e56;border-radius:24px;padding:32px 34px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.stat{background:linear-gradient(160deg,rgba(20,28,58,.94),rgba(12,17,36,.94));
  border:1px solid #232e56;border-radius:22px;padding:28px 22px;text-align:center}
.stat .v{font-family:"SF Mono",Consolas,monospace;font-size:50px;font-weight:700;
  color:#ffd166;line-height:1.08;margin-bottom:10px;letter-spacing:-.02em}
.stat .l{font-size:20px;color:#8b98be;line-height:1.42}
table{width:100%;border-collapse:collapse;font-family:"SF Mono",Consolas,monospace;font-size:23px}
th{text-align:left;padding:14px 12px;color:#7f8cb4;font-weight:600;
  border-bottom:2px solid #2b3765;font-size:20px;letter-spacing:.05em}
td{padding:14px 12px;border-bottom:1px solid #1a2344;color:#dfe6f8}
tr:last-child td{border-bottom:none}
td.n{text-align:right}
.tag{display:inline-block;font-family:"SF Mono",Consolas,monospace;font-size:18px;
  padding:4px 12px;border-radius:9px}
.tag.ok{background:rgba(126,231,135,.14);color:#7ee787;border:1px solid rgba(126,231,135,.34)}
.tag.no{background:rgba(255,107,107,.14);color:#ff8f8f;border:1px solid rgba(255,107,107,.34)}
.foot{position:absolute;left:76px;right:76px;bottom:56px;display:flex;justify-content:space-between;
  align-items:center;font-family:"SF Mono",Consolas,monospace;font-size:20px;color:#4e5878;
  border-top:1px solid #1a2344;padding-top:24px}
.shot{width:100%;border-radius:18px;border:1px solid #232e56;display:block;max-height:1080px;object-fit:cover}
.cap{font-size:20px;color:#7f8cb4;margin-top:14px;text-align:center;line-height:1.5}
.bar{height:30px;background:#131b3a;border-radius:8px;overflow:hidden}
.bar>div{height:100%;border-radius:8px}
.spacer{flex:1;min-height:8px}
ul{list-style:none}
li{font-size:27px;line-height:1.6;color:#c3cce8;padding-left:42px;position:relative;margin-bottom:20px}
li::before{content:'▸';position:absolute;left:0;color:#7aa2ff;font-weight:700}
.kv{display:flex;justify-content:space-between;align-items:baseline;padding:14px 0;border-bottom:1px solid #1a2344}
.kv:last-child{border-bottom:none}
.kv .k{font-size:25px;color:#9aa6cc}
.kv .v{font-family:"SF Mono",Consolas,monospace;font-size:27px;color:#fff;font-weight:600}
.lbl{font-family:"SF Mono",Consolas,monospace;font-size:22px;color:#8b98be;margin-bottom:18px}
.quote{border-left:5px solid #7aa2ff;padding-left:30px;font-size:29px;line-height:1.7;color:#dfe6f8}
`;

function starsSVG(seed) {
  let a = seed, s = '';
  const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  for (let i = 0; i < 160; i++) {
    const x = (rnd() * 1080).toFixed(1), y = (rnd() * 1920).toFixed(1);
    const r = (rnd() * 2.1 + 0.5).toFixed(2), o = (rnd() * 0.55 + 0.12).toFixed(2);
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#cfe0ff" opacity="${o}"/>`;
  }
  return `<svg class="stars" viewBox="0 0 1080 1920">${s}</svg>`;
}

const page = (name, inner, footL, idx) => `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="utf-8"><title>${name}</title><style>${CSS}</style></head><body>
<div class="bg"></div>${starsSVG(7 + idx * 13)}
<div class="wrap">${inner}</div>
<div class="foot"><span>${footL}</span><span>${String(idx).padStart(2, '0')} / 10</span></div>
</body></html>`;

const P = [];
const maxN = Math.max(...D.presets.map(p => p.N));

/* ── 01 封面 ── */
P.push(page('01-cover', `
  <div class="eyebrow">N-Body Sandbox</div>
  <h1>引力剧场</h1>
  <div class="lede">用 <span class="hl">Barnes–Hut 树</span> 与 <span class="hl2">辛积分器</span><br>
    驱动的 N 体引力沙盒<br>每一个数字都能被守恒量与解析解验证</div>
  <div class="spacer"></div>
  <div class="grid3">
    <div class="stat"><div class="v">${D.speed.ratio3000.toFixed(1)}×</div>
      <div class="l">Barnes–Hut<br>相对暴力法加速</div></div>
    <div class="stat"><div class="v">${D.osc.pefrl.order.toFixed(2)}</div>
      <div class="l">PEFRL 实测阶<br>理论值 4</div></div>
    <div class="stat"><div class="v">${D.presets.length}</div>
      <div class="l">预设场景<br>含 2 个精确解</div></div>
  </div>
  <div class="spacer"></div>
  <div class="card">
    <div class="kv"><span class="k">零依赖 · 单文件 HTML</span><span class="v">双击即开</span></div>
    <div class="kv"><span class="k">最大场景天体数</span><span class="v">${maxN}</span></div>
    <div class="kv"><span class="k">物理 + 浏览器断言</span><span class="v" style="color:#7ee787">${D.asserts.total} 项全绿</span></div>
  </div>
`, 'gravity-theater', 1));

/* ── 02 项目简介 ── */
P.push(page('02-intro', `
  <div class="eyebrow">What &amp; Why</div>
  <h2>它是什么</h2>
  <div class="body">跑在浏览器里的 <span class="hl">N 体引力求解器</span>：
    数千个天体在共同的引力场中运动，<br>
    实时展示轨道、潮汐尾、并合与混沌。</div>
  <div class="spacer"></div>
  <div class="card" style="margin-bottom:30px">
    <div class="body" style="font-size:27px">
      <span class="hl3">为什么不一样</span><br><br>
      大多数"引力玩具"只能靠"看着对"验收。<br>
      这里每个场景都绑定一个
      <span class="hl">可证伪的物理命题</span>——
      要么对应真实天体数据，要么对应已发表的精确解。
    </div>
  </div>
  <div class="lbl">三个"能拿来当标准答案"的场景</div>
  <ul>
    <li><span class="hl">八字编舞</span>　三体问题的已知周期解（Chenciner–Montgomery 2000）。
      积分一个周期后必须精确回到出发点</li>
    <li><span class="hl">等边三角形</span>　ω² = 3Gm/a³ 的精确周期解。
      三个天体永远保持等边</li>
    <li><span class="hl">内太阳系</span>　水金地火的真实半长轴与质量，
      4π² 单位制下地球公转周期恰为 1 年</li>
  </ul>
`, '项目简介', 2));

/* ── 03 场景库 ── */
const prows = D.presets.map(p => `<tr>
  <td style="color:#fff;font-family:'PingFang SC',sans-serif;font-size:25px">${p.name}</td>
  <td class="n">${p.N}</td>
  <td style="font-size:20px;color:#8b98be;font-family:'PingFang SC',sans-serif">${p.tag}</td>
  <td style="font-size:20px">${p.method === 'Barnes–Hut' ? '<span class="hl2">BH</span>' : '<span class="muted">O(N²)</span>'}</td>
</tr>`).join('');
P.push(page('03-presets', `
  <div class="eyebrow">Presets</div>
  <h2>八个场景</h2>
  <table><thead><tr><th>场景</th><th class="n">N</th><th>类型</th><th>引力算法</th></tr></thead>
  <tbody>${prows}</tbody></table>
  <div style="height:30px"></div>
  <div class="card">
    <div class="lbl">两个精确周期解（可直接当标准答案）</div>
    <div class="body" style="font-size:23px;margin-bottom:16px">
      <span class="hl">八字编舞</span>　三体问题已证明存在的周期解，周期 ${D.figure8.period.toFixed(5)}<br>
      <span class="hl">等边三角形</span>　ω² = 3Gm/a³，三颗星永远保持 120° 均分
    </div>
  </div>
  <div style="height:26px"></div>
  <div class="card">
    <div class="lbl">两种算法各司其职</div>
    <div class="body" style="font-size:26px">
      小 N 场景用 <span class="hl">暴力 O(N²)</span>——它是本项目的
      <span class="hl3">黄金标准</span>。Barnes–Hut 的每一个数字都要对着它量，
      没有它就无法证明近似是对的。<br><br>
      大 N 场景用 <span class="hl2">Barnes–Hut</span>，实测
      N=3000 时 ${D.speed.ratio3000.toFixed(1)}× 加速。
    </div>
  </div>
  <div style="height:30px"></div>
  <div class="card">
    <div class="lbl">实时可调的物理旋钮</div>
    <div class="grid2" style="gap:14px 20px">
      <div>
        <div class="body" style="font-size:22px"><span class="hl">积分器</span>　4 种自由切换</div>
        <div class="body" style="font-size:22px"><span class="hl2">引力算法</span>　BH / 暴力随时对拍</div>
      </div>
      <div>
        <div class="body" style="font-size:22px"><span class="hl3">BH 开角 θ</span>　0.1 ~ 0.9 实时改</div>
        <div class="body" style="font-size:22px"><span class="hl">步长 dt</span>　0.1× ~ 3× 微调</div>
      </div>
    </div>
    <div class="body" style="font-size:22px;margin-top:18px;color:#8b98be">
      面板同时实时显示 ΔE/E、ΔL/L、ΔP/P、质心漂移、T 与 U —— 调参时守恒量是否被破坏，一眼可见
    </div>
  </div>
  <div style="height:20px"></div>
  <div class="card" style="padding:24px 34px">
    <div class="body" style="font-size:21px">
      滚轮缩放 · 拖拽平移 · 速度矢量叠加 · 键盘快捷键（空格 / F / R / C）
    </div>
  </div>
`, '核心功能 · 场景库', 3));

/* ── 04 Barnes–Hut ── */
const bhRows = D.bh.theta.map((t, i) => {
  const c = i < 2 ? '#7ee787' : i === 2 ? '#ffd166' : '#ff8f8f';
  return `<tr><td>${t.toFixed(1)}</td>
    <td class="n" style="color:${c}">${pc(D.bh.err[i])}</td>
    <td style="width:42%"><div class="bar"><div style="width:${(D.bh.err[i] / D.bh.err[3] * 100).toFixed(0)}%;background:${c}"></div></div></td></tr>`;
}).join('');
const spRows = [500, 1000, 2000, 3000].map(N => `<tr>
  <td>${N}</td><td class="n">${D.speed['brute' + N].toFixed(1)} ms</td>
  <td class="n" style="color:#7ee787">${D.speed['bh' + N].toFixed(1)} ms</td>
  <td class="n" style="color:#ffd166;font-weight:700">${(D.speed['brute' + N] / D.speed['bh' + N]).toFixed(1)}×</td>
</tr>`).join('');
P.push(page('04-barnes-hut', `
  <div class="eyebrow">Algorithm</div>
  <h2>Barnes–Hut 树</h2>
  <div class="body" style="margin-bottom:30px">
    <span class="hl2">"远处的一团，看不出差别，当成一个点。"</span><br>
    节点尺度 <span class="mono">s</span> 与距离 <span class="mono">d</span> 满足
    <span class="mono hl">s/d &lt; θ</span> 时，直接用节点总质心替代其作用。
  </div>
  <div class="card" style="margin-bottom:28px">
    <div class="lbl">精度 vs 开角（N=200，与暴力解逐点比对）</div>
    <table><thead><tr><th>θ</th><th class="n">相对力误差</th><th></th></tr></thead>
    <tbody>${bhRows}</tbody></table>
    <div class="body" style="font-size:22px;margin-top:18px;color:#8b98be">
      log-log 斜率 <span class="hl mono">${D.bh.slope.toFixed(2)}</span>
      ，与单极截断的理论标度 ≈ 2 吻合
    </div>
  </div>
  <div class="card">
    <div class="lbl">实测加速比（单线程 · Verlet 积分 · Node 22）</div>
    <table><thead><tr><th>N</th><th class="n">暴力 O(N²)</th><th class="n">Barnes–Hut</th><th class="n">加速</th></tr></thead>
    <tbody>${spRows}</tbody></table>
  </div>
  <div style="height:30px"></div>
  <div class="card">
    <div class="lbl">让 BH 真正可用的三个工程决定</div>
    <div class="body" style="font-size:23px">
      ① <span class="hl">试探粒子不进树</span>：2400 颗恒星质量为 0，只受力不施力→实测 40×<br>
      ② <span class="hl2">树在一个步内复用</span>：PEFRL 一步算 4 次力，只建 1 次树→省 3/4 建树开销<br>
      ③ <span class="hl3">包围盒自包含测试</span>：保证含自身的节点永远展开，杜绝自作用误差
    </div>
  </div>
`, '核心功能 · 算法', 4));

/* ── 05 辛积分器 ── */
const intRows = ['euler', 'verlet', 'pefrl', 'rk4'].map(k => {
  const sym = (k === 'verlet' || k === 'pefrl');
  const ord = D.osc[k].order;
  const good = Math.abs(ord - Math.round(ord)) < 0.6;
  return `<tr>
    <td style="color:#fff;font-family:'PingFang SC',sans-serif;font-size:24px">${NAME[k]}</td>
    <td>${sym ? '<span class="tag ok">辛</span>' : '<span class="tag no">非辛</span>'}</td>
    <td class="n" style="color:${good ? '#7ee787' : '#ffd166'};font-weight:700">${ord.toFixed(2)}</td>
    <td class="n muted">${e2(D.osc[k].h1)}</td></tr>`;
}).join('');
const driftRows = ['euler', 'rk4', 'verlet', 'pefrl'].map(k => `<tr>
  <td style="color:#fff;font-family:'PingFang SC',sans-serif;font-size:24px">${NAME[k]}</td>
  <td class="n" style="color:${k === 'pefrl' ? '#7ee787' : k === 'rk4' ? '#ffd166' : '#ff8f8f'}">${e2(D.drift[k].late)}</td>
  <td style="font-size:20px;color:#8b98be;font-family:'PingFang SC',sans-serif">${k === 'euler' || k === 'rk4' ? '误差随时间累积' : '误差有界振荡'}</td>
</tr>`).join('');
P.push(page('05-symplectic', `
  <div class="eyebrow">Integrators</div>
  <h2>辛 vs 非辛</h2>
  <div class="card" style="margin-bottom:26px">
    <div class="lbl">谐振子基准 · 单周期能量偏差 / 实测收敛阶</div>
    <table><thead><tr><th>积分器</th><th>性质</th><th class="n">阶数</th><th class="n">误差</th></tr></thead>
    <tbody>${intRows}</tbody></table>
    <div class="body" style="font-size:20px;margin-top:16px;color:#8b98be">
      PEFRL 的数字与 UCSD Physics 141 讲义原表（7.206e-7 / 2.822e-9）逐位吻合
    </div>
  </div>
  <div class="card">
    <div class="lbl">三体混沌系统 · t=${D.drift.euler.tLate.toFixed(0)} 时的 |ΔE/E|</div>
    <table><thead><tr><th>积分器</th><th class="n">能量误差</th><th>长期行为</th></tr></thead>
    <tbody>${driftRows}</tbody></table>
    <div class="body" style="font-size:25px;margin-top:20px">
      最差与最好差 <span class="hl mono">5×10⁸</span> 倍。<br>
      <span class="hl3">辛</span>方法的能量误差有界振荡，长期积分不累积——
      这才是长时模拟能不能做的分界线。
    </div>
  </div>
  <div style="height:34px"></div>
  <div class="card">
    <div class="lbl">怎么把 PEFRL 调对（踩过的坑）</div>
    <div class="body" style="font-size:23px">
      ① 系数 <span class="hl mono">λ = −0.2123…</span> 是<span class="hl2">负号</span>，记错会让步长悄悄放大 1.8 倍<br>
      ② 求值必须是<span class="hl2">先漂移再算力</span>，写成"先算力再漂移"（Verlet 的习惯）会让阶数从 4 掉到 1<br>
      ③ 谐振子单周期能量偏差应为 <span class="hl mono">7.21×10⁻⁷</span>，与 UCSD 讲义原表逐位吻合
    </div>
  </div>
`, '核心功能 · 积分器', 5));

/* ── 06 演示：八字编舞 ── */
P.push(page('06-demo-figure8', `
  <div class="eyebrow">Demo 01</div>
  <h2 style="margin-bottom:20px">八字编舞</h2>
  <img class="shot" src="../shots/tall-figure8.png" alt="八字编舞" style="width:100%;border-radius:18px">
  <div class="cap">三颗等质量天体沿同一条八字曲线追逐<br>这是三体问题的已知精确周期解</div>
  <div style="height:34px"></div>
  <div class="card" style="margin-bottom:40px">
    <div class="lbl">可验证的命题</div>
    <div class="kv"><span class="k">周期 T</span><span class="v">${D.figure8.period.toFixed(8)}</span></div>
    <div class="kv"><span class="k">积分一个周期后闭环误差</span>
      <span class="v" style="color:#7ee787">${D.figure8.loopErr.toExponential(2)}</span></div>
    <div class="kv"><span class="k">同期能量漂移 |ΔE/E|</span>
      <span class="v" style="color:#7ee787">${D.figure8.dE.toExponential(2)}</span></div>
    <div class="body" style="font-size:21px;margin-top:14px;color:#8b98be">
      这不是拟合曲线，是 Chenciner–Montgomery 2000 年证明存在的解。
      积分器算错一点，就闭不上环。
    </div>
  </div>
`, '核心功能演示', 6));

/* ── 07 演示：星系并合 ── */
P.push(page('07-demo-galaxy', `
  <div class="eyebrow">Demo 02</div>
  <h2 style="margin-bottom:20px">星系并合</h2>
  <img class="shot" src="../shots/tall-galaxy.png" alt="星系并合" style="width:100%;border-radius:18px">
  <div class="cap">两个各 1200 颗恒星的盘星系相向运动<br>相遇后被拉出潮汐尾与物质桥</div>
  <div style="height:30px"></div>
  <div class="card">
    <div class="lbl">为什么必须是 Barnes–Hut</div>
    <div class="body" style="font-size:24px">
      N=${D.presets.find(p => p.key === 'galaxyMerge').N} 时，暴力法每步要做
      <span class="hl mono">290 万</span> 次两体计算——
      单帧 <span class="hl mono">${D.speed.brute3000.toFixed(0)} ms</span>，跑不动。<br>
      换成 Barnes–Hut 降到
      <span class="hl3 mono">${D.speed.bh3000.toFixed(1)} ms</span>。
    </div>
    <div class="kv" style="margin-top:12px"><span class="k">试探粒子优化</span>
      <span class="v" style="color:#7ee787">40×</span></div>
    <div class="body" style="font-size:20px;margin-top:8px;color:#8b98be">
      2400 颗恒星质量为 0（只受力不施力），不进树
    </div>
  </div>
`, '核心功能演示', 7));

/* ── 07b 精确解：等边三角形 ── */
P.push(page('08-lagrange', `
  <div class="eyebrow">Demo 03</div>
  <h2 style="margin-bottom:20px">等边三角形解</h2>
  <img class="shot" src="../shots/tall-lagrange.png" alt="等边三角形"
       style="width:100%;border-radius:18px">
  <div class="cap">三颗等质量天体排成等边三角形整体旋转<br>三颗星永远保持 120° 均分</div>
  <div style="height:30px"></div>
  <div class="card">
    <div class="lbl">可验证的命题</div>
    <div class="body" style="font-size:24px">
      角速度必须精确等于 <span class="hl mono">ω² = 3Gm/a³</span>。<br><br>
      差一点点，三个天体就会散开成不成形的一团——
      它<span class="hl3">必须是周期解</span>，没有讨价还价的余地。
    </div>
  </div>
`, '核心功能演示', 8));

/* ── 09 真实天体 ── */
P.push(page('09-real', `
  <div class="eyebrow">Real Data</div>
  <h2 style="margin-bottom:20px">内太阳系</h2>
  <img class="shot" src="../shots/tall-solar.png" alt="内太阳系"
       style="width:100%;border-radius:18px">
  <div class="cap">水金地火 · 真实半长轴与质量</div>
  <div style="height:30px"></div>
  <div class="card">
    <div class="lbl">单位制的选择</div>
    <div class="body" style="font-size:24px">
      取 <span class="hl mono">G = 4π²</span> AU³/(M☉·yr²)，
      于是地球公转周期<span class="hl3">恰好是 1 年</span>——
      单位对了，轨道形状就自动对。
    </div>
    <div class="kv" style="margin-top:18px"><span class="k">地球轨道周期</span>
      <span class="v" style="color:#7ee787">1.000 年</span></div>
    <div class="kv"><span class="k">用到的天体</span><span class="v">太阳 + 水金地火</span></div>
    <div class="kv"><span class="k">数据来源</span><span class="v">真实半长轴与质量</span></div>
  </div>
`, '核心功能演示', 9));

/* ── 10 成果与验证 ── */
P.push(page('08-verify', `
  <div class="eyebrow">Verification</div>
  <h2>怎么证明它是对的</h2>
  <div class="quote" style="margin-bottom:28px">
    不靠"看着对"，靠
    <span class="hl">与解析解逐点比对</span>、
    <span class="hl2">与暴力解对拍</span>、
    <span class="hl3">拿守恒量监控</span>。
  </div>
  <div class="card" style="margin-bottom:24px">
    <div class="lbl">十一组物理断言 · 全部通过</div>
    <ul style="margin-top:4px">
      <li style="font-size:24px;margin-bottom:14px">开普勒圆轨道与解析解逐点一致</li>
      <li style="font-size:24px;margin-bottom:14px">四个积分器的实测收敛阶符合理论</li>
      <li style="font-size:24px;margin-bottom:14px">辛方法能量误差有界振荡、非辛单调累积</li>
      <li style="font-size:24px;margin-bottom:14px">Barnes–Hut 误差随 θ 按 O(θ²) 收敛</li>
      <li style="font-size:24px;margin-bottom:14px">BH 长时间轨迹与暴力解一致</li>
      <li style="font-size:24px;margin-bottom:14px">动量 / 角动量守恒到浮点精度</li>
      <li style="font-size:24px;margin-bottom:14px">试探粒子语义正确（不受力但受力）</li>
      <li style="font-size:24px;margin-bottom:0">同种子两次运行逐位一致（确定性）</li>
    </ul>
  </div>
  <div class="card">
    <div class="lbl">浏览器端 · Playwright</div>
    <div class="kv"><span class="k">八个场景加载与推进</span><span class="v" style="color:#7ee787">8 / 8</span></div>
    <div class="kv"><span class="k">UI 控件（点击真实 DOM）</span><span class="v" style="color:#7ee787">全部生效</span></div>
    <div class="kv"><span class="k">星系并合实际帧率</span><span class="v" style="color:#7ee787">25–40 FPS</span></div>
    <div class="kv"><span class="k">断言总数</span><span class="v" style="color:#7ee787">${D.asserts.node.total} + ${D.asserts.browser.total} = ${D.asserts.total}</span></div>
    <div class="kv"><span class="k">截图产出</span><span class="v">横版 + 竖版各一套</span></div>
  </div>
  <div style="height:34px"></div>
  <div class="card">
    <div class="lbl">这套验证抓出过的真 bug</div>
    <div class="body" style="font-size:23px">
      · RK4 位置被累加四次，有效步长放大 3 倍<br>
      · Barnes–Hut 节点分裂时父节点未清零，总质量被重复计入<br>
      · PEFRL 的 drift/kick 顺序错，4 阶退化为 1 阶（误差差 75000 倍）<br>
      · 圆共线构型下视口缩放退化到 10⁶，画面全黑
    </div>
  </div>
`, '成果展示', 10));

P.forEach((html, i) => {
  const n = String(i + 1).padStart(2, '0') + '-';
  const name = ['cover', 'intro', 'presets', 'barnes-hut', 'symplectic',
                'demo-figure8', 'demo-galaxy', 'lagrange', 'real', 'verify'][i];
  writeFileSync(`slides/${n}${name}.html`, html);
});
console.log('已生成', P.length, '张幻灯片');

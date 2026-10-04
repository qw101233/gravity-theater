# PROJECT.md — 引力剧场 / Gravity Arena

> **这份文档是给「下一个接手的 AI 助手」看的。**
> 只读这一份，就能判断这个项目是什么、是否重复、怎么跑、改哪里。
>
> 生成时间：2026-10-04　｜　版本：v1.0.0　｜　状态：**功能完整，已通过 95 项验证**

---

## 1. 一句话判断：这是不是重复项目？

**如果你要做的项目是「N 体引力 / 引力模拟 / 轨道力学 / Barnes–Hut / 辛积分器」相关的，请不要重复做。**

**判断要点**（三条都命中即为重复）：

| 特征 | 本项目的值 |
|---|---|
| 核心算法 | Barnes–Hut 四叉树（O(N log N) 单极近似 + Plummer 软化） |
| 核心数值方法 | 辛积分器族（Euler / Verlet / PEFRL / RK4 可切换） |
| 领域 | 二维 N 体引力、轨道力学、三体问题、天体物理可视化 |
| 语言栈 | 纯 JavaScript（classic script，非 ES module）+ Canvas 2D，零运行时依赖 |

**同工作区内已存在但与本项目无关的项目**（不得参考/修改/延续）：
`element-sandbox`、`fluid-canvas`、`idiom-wordle`、`pattern-lab`、`photon-lab`。
它们与本项目在领域、算法、代码结构上均无交集。

---

## 2. 需求概述

做一个**可运行、可演示、功能完整、有基本验证**的独立项目。

本项目的自我要求（比"任务要求"更高一档）：
- 不做"视觉玩具"——每个场景必须绑定**可证伪的物理命题**（真实天体数据 或 已发表的精确解）
- 不靠"看着对"验收——所有数字由**两套自动化验证**（41 条物理断言 + 54 条浏览器断言）保证
- 交付物包含：代码 + 验证 + 9:16 竖屏图文 + README + GitHub 仓库

---

## 3. 核心功能清单

### 3.1 引力求解
- **暴力法 O(N²)**：既是可用算法，也是 Barnes–Hut 的**黄金标准**（对拍基准）
- **Barnes–Hut 四叉树**：单极近似，开角 θ 可调 0.1–0.9
  - 自相互作用处理：O(1) 包围盒包含测试，保证含自身的节点永远展开
  - 试探粒子优化：质量 ≤ 阈值的粒子只受力不施力，不进树（星系场景提速 40×）
  - 树复用：一个积分步内只建一次树（PEFRL 需 4 次力计算）
- **Plummer 软化** ε：消除近距离奇点

### 3.2 时间积分（4 种可实时切换）
| 键 | 名称 | 阶 | 性质 | 力计算/步 |
|---|---|---|---|---|
| `euler` | 半隐式 Euler | 1 | 非辛 | 1 |
| `verlet` | Velocity Verlet | 2 | **辛** | 2 |
| `pefrl` | PEFRL（Omelyan 2002） | 4 | **辛** | 4 |
| `rk4` | 经典 RK4 | 4 | 非辛 | 4 |

### 3.3 守恒量实时诊断
ΔE/E、ΔL/L、ΔP/P、质心漂移、动能 T、引力势能 U
（相对量而非绝对量——绝对量会掩盖问题）

### 3.4 八个预设场景
| 键 | 名称 | N | 类型 | 引力算法 |
|---|---|---|---|---|
| `figure8` | 八字编舞 | 3 | **精确周期解** | 暴力 |
| `innerSolar` | 内太阳系 | 5 | 真实天体 | 暴力 |
| `lagrange` | 等边三角形解 | 3 | **精确周期解** | 暴力 |
| `galaxyMerge` | 星系并合 | 2402 | BH 主场 | Barnes–Hut |
| `starCluster` | 球状星团 | 2401 | N=2400 压测 | Barnes–Hut |
| `binary` | 双星 + 行星 | 7 | 试探粒子 | 暴力 |
| `chaos` | 三体混沌 | 3 | 不可预测 | 暴力 |
| `accretion` | 吸积盘 | 1061 | 大质量中心 | Barnes–Hut |

### 3.5 交互
场景切换 · 播放/暂停/单步/重置 · 速度（对数映射 0.1–60×）· 步长 dt（0.1–3×）·
积分器切换 · 引力算法切换 · BH 开角 θ · 缩放（滚轮）· 平移（拖拽）·
轨迹拖尾开关 · 速度矢量叠加 · 光晕开关 · 视图自适应
快捷键：`空格` 播放/暂停、`F` 适配、`R` 重置、`C` 清轨迹

### 3.6 调试 API（`window.GA_APP`）
供 Playwright 精确驱动，比模拟鼠标稳定一个量级：
`load(k)` / `advance(n)` / `setMethod` / `setIntegrator` / `setTheta` / `setDt` /
`setPlaying` / `setSpeed` / `fit(mode)` / `energy()` / `drift()` / `stats()` / `snapshot()` / `seek(t)`

---

## 4. 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 语言 | JavaScript（ES5 风格，classic script） | **不用 ES module 是硬性决定**：`file://` 下 ES module 被 CORS 拦，必须起服务器。本项目要"双击即开" |
| 渲染 | Canvas 2D | N=2400 需要的是 2D 粒子 + 轨迹，Canvas 2D 足够；WebGL 对本项目是过度设计 |
| 数据 | Float64Array | 位置/速度/质量/加速度全 TypedArray，N=2400 无压力 |
| 依赖 | **零运行时依赖** | 打开即用，不装包 |
| 测试 | Playwright（仅开发期） | 物理层用纯 Node 测（快 20×），浏览器层测渲染与交互 |
| 图表 | 无 | 界面只有数字与色条，不需要图表库 |

**环境要求**：任意现代浏览器（Chrome/Edge/Firefox/Safari）。
Node ≥ 18 仅在跑测试/生成图文时需要。

---

## 5. 目录结构

```
gravity-theater/
├── index.html                  ← 应用入口（双击即开，无需服务器）
├── PROJECT.md                  ← 本文件
├── README.md                   ← 面向人的项目说明
│
├── src/                        ← 全部源码（classic script，按依赖顺序加载）
│   ├── core.js                 命名空间、数学工具、确定性 PRNG (mulberry32)
│   ├── integrators.js          4 种时间积分器
│   ├── bh.js                   Barnes–Hut 四叉树
│   ├── sim.js                  模拟器 + 暴力引力 + 守恒量诊断
│   ├── presets.js              8 个预设场景
│   ├── render.js               Canvas 2D 渲染（视口、轨迹缓冲、元数据）
│   └── app.js                  主循环、交互、UI 绑定、GA_APP 调试 API
│
├── test/
│   ├── verify-node.mjs         41 条物理断言（纯 Node，约 8 秒）
│   └── verify-browser.mjs      54 条浏览器断言 + 截图产出（约 3 分钟）
│
├── tools/
│   ├── collect-data.mjs        采集物理数据 → slides-data.json
│   └── collect-asserts.mjs     跑两套验证 → 把真实断言数写进 slides-data.json
│
├── slides-gen.mjs              生成 10 张 9:16 幻灯片 HTML（读 slides-data.json）
├── shots-render.mjs            幻灯片 HTML → PNG（含重叠检测）
├── slides-data.json            所有展示数字的唯一来源（禁止手写）
│
├── slides/                     10 张幻灯片 HTML
├── slides-png/                 10 张幻灯片 PNG（1080×1920）
└── shots/                      应用截图
    ├── shot-*.png              横版（含 UI 面板，1440×900）
    ├── tall-*.png              竖版纯画布（900×1180，给幻灯片用）
    └── ui-full.png             整页（含控制面板）
```

**改代码时的影响范围**：
- 改物理 → `src/{integrators,bh,sim}.js` → 必须跑 `test/verify-node.mjs`
- 改渲染 → `src/render.js` → 跑 `test/verify-browser.mjs` 看截图
- 改场景 → `src/presets.js` → 两套测试都要跑（场景 N 变了会影响性能基线）
- 改展示数字 → **改 `tools/collect-data.mjs` 重新采集**，不要直接改 `slides-data.json`

---

## 6. 运行方式

```bash
# 1) 打开应用（无需任何依赖）
start index.html            # Windows
open  index.html            # macOS
# 或者直接双击

# 2) 跑物理验证（约 8 秒）
node test/verify-node.mjs

# 3) 跑浏览器验证 + 产出截图（约 3 分钟）
node test/verify-browser.mjs
#   ⚠️ 需要 Playwright。若报模块找不到，检查脚本顶部 createRequire 的路径。

# 4) 重新生成图文（必须按顺序）
node tools/collect-data.mjs      # 采集物理数据
node collect-asserts.mjs         # 采集真实断言数
node slides-gen.mjs              # 生成幻灯片 HTML
node shots-render.mjs            # 渲染 PNG
```

**退出码**：两套验证均以 `exit(0/1)` 表示成败，可直接接入 CI。

---

## 7. 当前进度

| 模块 | 状态 |
|---|---|
| 物理内核（4 积分器 + BH + 守恒量） | ✅ 完成，41 条断言全绿 |
| 渲染（视口、轨迹、元数据） | ✅ 完成 |
| UI（8 场景 + 全部控件 + 快捷键） | ✅ 完成，54 条断言全绿 |
| 8 个预设场景 | ✅ 全部可加载可推进 |
| 截图产出（横版 + 竖版） | ✅ 16 张 |
| 9:16 竖屏图文 | ✅ 10 张 1080×1920，零重叠 |
| GitHub 仓库 + README | ✅ 见仓库 |
| 性能（N=2402 星系并合） | ✅ 25–40 FPS |

### 已知限制（如实记录，不粉饰）
1. **大 N 场景用 Verlet 而非 PEFRL**：PEFRL 实测开销是 Verlet 的 2.04×（4 次力 vs 2 次），
   N=2500 时 13.3ms vs 6.5ms，60FPS 只能选 Verlet。这是架构性取舍，不是 bug。
2. **无 3D**：所有算法是二维的。N 体引力的三维推广在数学上直接，但渲染与交互需重做。
3. **无天体碰撞/合并**：软化处理了近距离，但没有物理的并合事件。
4. **Barnes–Hut 只用单极近似**：精度上限 ~O(θ²)，θ=0.5 时约 3.5% 力误差。
   要更高需加四极矩项。
5. **截图在 headless swiftshader 下产生**：帧率与真机不同（真机应更高）。

---

## 8. 给接手者的注意事项（都是踩过的坑）

1. **PEFRL 的 λ 是负数**：`λ = -0.2123418310626054`。写成正数会让有效步长放大 1.8 倍，
   代码看起来完全合理但结果慢慢飞掉。
2. **PEFRL 的求值顺序是"先漂移再算力"**：每段都是 `x += c·dt·v` 之后才 `accel()`。
   写成 Verlet 习惯的"先算力再漂移"会让收敛阶从 4 掉到 1（误差差 75000 倍）。
3. **Barnes–Hut 节点分裂时必须先清零父节点质量**，否则总质量被父子重复计入。
4. **Barnes–Hut 遍历里的 `inside` 包围盒测试不能省**：它保证含自身的节点永远展开，
   否则中心天体（质量最大）会把自己算成受力对象。
5. **`fit()` 的共线构型陷阱**：所有天体 y 相同时，包围盒高度退化为 0，
   `cover` 分支会算出 10⁶ 量级的缩放，画面全黑。退化维度要用参考尺寸兜底。
6. **轨迹采样点必须逐积分步打**（`stampTrails`），不能一帧只打一个点，
   否则速度 > 1 时轨迹出现缺口。
7. **测试里切换积分器前必须重新加载场景**：`drift()` 是相对 `snapshot()` 的累积量，
   在上一次的结果上继续跑，三种方法会测出几乎相同的误差。
8. **`scrollHeight` 检测不到 `position:absolute` 的脚注重叠**——量「最后一个子元素底边」。

---

## 9. 参考来源

- Chenciner & Montgomery (2000) — 八字编舞周期解，`period = 6.32591398`
- Omelyan, Mryglod & Folk, *Comput. Phys. Commun.* 146 (2002) 188 — PEFRL
- UCSD Physics 141 讲义 Eq.(34) — PEFRL 九段序列与谐振子基准表
- Barnes (1986) — 四叉树聚合；Hut (1986) — 层级聚合近似
- Barnes–Hut 单极截断误差的 O(θ²) 标度

**实测对照**：本项目 PEFRL 在谐振子基准上的误差为 `7.206e-7 / 2.822e-9`（h/T = 0.02 / 0.005），
与 UCSD 讲义原表逐位吻合。

/*!
 * Gravity Arena · 引力剧场
 * presets.js — 预设场景
 *
 * 每个场景都是"可被证伪"的具体命题，不是随手摆的粒子团。
 * 选取原则：能对应到真实天体物理，或者能对应到已知的数学周期解。
 */
(function (global) {
  'use strict';

  var GA = global.GA;

  /* ================================================================== */
  /*  初始条件常量（有出处，可查证）                                     */
  /* ================================================================== */

  /**
   * 八字编舞（Figure-Eight Choreography）
   * 三体问题的已知周期解。Chenciner & Montgomery, 2000。
   *
   * 三颗等质量天体（m=1，G=1）沿同一条八字曲线追逐，周期 T ≈ 6.3259。
   * 这不是数值方法的产物——它是精确解。所以它可以当"标准答案"：
   * 积分一个周期后，三个天体必须回到出发位置。
   *
   * 布局：body0 走一段，body1 走另一段，body2 补上缺口。
   */
  GA.FIGURE8 = [
    /* x     y      vx     vy   */
    0.97000436, -0.24308753, 0.4662036850, 0.4323657300,
    -0.97000436, 0.24308753, 0.4662036850, 0.4323657300,
    0.0, 0.0, -0.9324073700, -0.8647314600
  ];
  GA.FIGURE8_PERIOD = 6.32591398;

  /**
   * 拉格朗日 L4 点等边三角形解
   * 三颗等质量天体构成等边三角形并整体匀速旋转，也是一个精确周期解。
   * 角速度 ω² = 3Gm/a³（a 为边长）。
   * 验证方式：一个周期后三角形整体转回原位。
   */
  GA.LAGRANGE_OMEGA2 = function (G, m, a) { return 3 * G * m / (a * a * a); };

  /* ================================================================== */
  /*  场景工厂                                                           */
  /* ================================================================== */

  /**
   * 通用构建器：接受天体描述列表，产出 TypedArray 状态。
   * @param {Array} bodies [{x,y,vx,vy,m,name,color,kind}]
   * @param {object} meta {G, eps, massEps, dt, integrator, method, theta}
   */
  function build(bodies, meta) {
    var n = bodies.length;
    var px = new Float64Array(n), py = new Float64Array(n);
    var vx = new Float64Array(n), vy = new Float64Array(n), m = new Float64Array(n);
    var name = new Array(n), color = new Array(n), kind = new Array(n);
    for (var i = 0; i < n; i++) {
      var b = bodies[i];
      px[i] = b.x; py[i] = b.y; vx[i] = b.vx || 0; vy[i] = b.vy || 0;
      m[i] = b.m || 0;
      name[i] = b.name || ('天体 ' + (i + 1));
      color[i] = b.color || '#8fb8ff';
      kind[i] = b.kind || (m[i] > 0.5 ? 'star' : 'test');
    }
    return {
      px: px, py: py, vx: vx, vy: vy, mass: m,
      meta: {
        G: meta.G, eps: meta.eps, massEps: meta.massEps || 0,
        integrator: meta.integrator || 'pefrl',
        method: meta.method || 'bh',
        theta: meta.theta != null ? meta.theta : 0.5,
        dt: meta.dt, timeUnit: meta.timeUnit || 'yr', daysPerUnit: meta.daysPerUnit || 365.25
      },
      bodies: bodies
    };
  }

  /* ---------- 1. 八字编舞 ---------- */
  function figure8() {
    var b = [];
    var nm = ['A', 'B', 'C'];
    var col = ['#ffd98a', '#8fe3ff', '#ff9ec7'];
    for (var i = 0; i < 3; i++) {
      b.push({
        x: GA.FIGURE8[i * 4], y: GA.FIGURE8[i * 4 + 1],
        vx: GA.FIGURE8[i * 4 + 2], vy: GA.FIGURE8[i * 4 + 3],
        m: 1, name: '天体 ' + nm[i], color: col[i], kind: 'star'
      });
    }
    return build(b, {
      G: 1, eps: 1e-4, dt: 1e-3, integrator: 'pefrl', method: 'brute',
      timeUnit: 'u', daysPerUnit: 0
    });
  }

  /* ---------- 2. 内太阳系（水金地火） ---------- */
  /* 真实参数：半长轴 AU，质量 M☉。用 G=4π² AU³/(M☉·yr²) 可让地球自转周期=1年。 */
  function innerSolar() {
    var G = 4 * Math.PI * Math.PI;   // 4π² = 39.478 AU³/(M☉·yr²)
    var b = [{ x: 0, y: 0, vx: 0, vy: 0, m: 1, name: '太阳', color: '#ffd24a', kind: 'star' }];
    // [名称, 半长轴AU, 质量(×10⁻⁶ M☉), 颜色]
    var P = [
      ['水星', 0.3871, 0.166, '#b8b0a8'],
      ['金星', 0.7233, 2.447, '#e8c98a'],
      ['地球', 1.0000, 3.003, '#6fb7ff'],
      ['火星', 1.5237, 0.3227, '#e07a5f']
    ];
    for (var i = 0; i < P.length; i++) {
      var a = P[i][1], mm = P[i][2] * 1e-6;
      // 圆轨道速度 v = sqrt(GM/a)，取近似总质量 M☉+自身
      var v = Math.sqrt(G * 1 / a);
      b.push({
        x: a, y: 0, vx: 0, vy: v, m: mm,
        name: P[i][0], color: P[i][3], kind: 'planet'
      });
    }
    return build(b, {
      G: G, eps: 1e-4, dt: 2e-4, integrator: 'pefrl', method: 'brute',
      timeUnit: 'yr', daysPerUnit: 365.25
    });
  }

  /* ---------- 3. 拉格朗日等边三角形 ---------- */
  function lagrange() {
    var G = 1, m = 1, a = 1.4;
    var w2 = GA.LAGRANGE_OMEGA2(G, m, a);
    var w = Math.sqrt(w2);
    var R = a / Math.sqrt(3);        // 三角形外接圆半径
    var b = [];
    var col = ['#ffd98a', '#8fe3ff', '#ff9ec7'];
    var nm = ['A', 'B', 'C'];
    for (var i = 0; i < 3; i++) {
      var th = i * 2 * Math.PI / 3;
      var x = R * Math.cos(th), y = R * Math.sin(th);
      // 圆周速度（逆时针）
      b.push({
        x: x, y: y, vx: -w * y, vy: w * x,
        m: m, name: '天体 ' + nm[i], color: col[i], kind: 'star'
      });
    }
    return build(b, {
      G: G, eps: 1e-4, dt: 2e-3, integrator: 'pefrl', method: 'brute',
      timeUnit: 'u', daysPerUnit: 0
    });
  }

  /* ---------- 4. 星系并合（需要 Barnes–Hut） ---------- */
  /* 两个各含 1200 颗恒星的盘星系，中心各有一个核球，
     初始相向运动 → 产生潮汐尾、桥、最终并合。
     这是 Barnes–Hut 存在的真实理由：4800 体的 O(N²) 每步 1150 万次计算，跑不动。 */
  function galaxyMerge() {
    var G = 1, seed = 20261004, rand = GA.rng(seed);
    var bodies = [];
    var discs = [
      { cx: -9, cy: 0, vx: 0.42, vy: 0.0, rot: 0.35, n: 1200, col: ['#9fc6ff', '#c9dbff', '#7fa8f0'], tilt: 0.12, dir: 1 },
      { cx: 9, cy: 3, vx: -0.42, vy: 0.1, rot: 0.35, n: 1200, col: ['#ffc4a0', '#ffe0c4', '#f0a888'], tilt: -0.10, dir: -1 }
    ];
    discs.forEach(function (d, di) {
      // 中心核球
      bodies.push({ x: d.cx, y: d.cy, vx: d.vx, vy: d.vy, m: d.n * 0.9, name: '核球 ' + (di + 1), color: di ? '#ffb088' : '#a8c8ff', kind: 'core' });
      for (var i = 0; i < d.n; i++) {
        // 指数盘：半径采样 r ∝ -R0·ln(1-u)，集中但不塌缩
        var u = rand();
        var rr = -1.1 * Math.log(1 - u * 0.985);
        rr = Math.min(rr, 7.5);
        var th = rand() * GA.TAU + d.rot;
        // 盘内旋转 + 轻微倾斜（盘面不共面才好看）
        var th2 = th + (rand() - 0.5) * 0.25;
        var yTilt = (rr * Math.sin(th2)) * d.tilt;
        var x = d.cx + rr * Math.cos(th2);
        var y = d.cy + yTilt;
        // 绕盘心旋转
        var vCirc = Math.sqrt(G * d.n * 0.9 / Math.max(rr, 0.6)) * 0.92;
        var vx = d.vx + (-Math.sin(th2) * vCirc) * d.dir;
        var vy = d.vy + (Math.cos(th2) * vCirc * Math.cos(d.tilt)) * d.dir;
        var ci = i % d.col.length;
        bodies.push({ x: x, y: y, vx: vx, vy: vy, m: 0.9, name: '恒星', color: d.col[ci], kind: 'star' });
      }
    });
    return build(bodies, {
      G: G, eps: 0.28, massEps: 0.5, dt: 6e-3, integrator: 'verlet', method: 'bh', theta: 0.55,
      timeUnit: 'u', daysPerUnit: 0
    });
  }

  /* ---------- 5. 双星 + 行星 ---------- */
  function binary() {
    var G = 1;
    var b = [
      { x: -1.6, y: 0, vx: 0, vy: 0.42, m: 2, name: '主星', color: '#ffb26b', kind: 'star' },
      { x: 1.6, y: 0, vx: 0, vy: -0.42, m: 2, name: '伴星', color: '#7fd4ff', kind: 'star' }
    ];
    // 圆轨道行星（含试探粒子：只感受，不施力）
    var radii = [4.2, 5.6, 7.0, 8.8, 10.5];
    for (var i = 0; i < radii.length; i++) {
      var r = radii[i];
      var v = Math.sqrt(G * 4 / r);
      b.push({ x: r, y: 0, vx: 0, vy: v, m: 0, name: '行星 ' + (i + 1), color: '#9fb4d8', kind: 'planet' });
    }
    return build(b, {
      G: G, eps: 0.05, massEps: 0.5, dt: 3e-3, integrator: 'pefrl', method: 'brute',
      timeUnit: 'u', daysPerUnit: 0
    });
  }

  /* ---------- 6. 球状星团（N=2400，压测 Barnes–Hut） ---------- */
  function starCluster() {
    var G = 1, rand = GA.rng(31415), n = 2400;
    var bodies = [{ x: 0, y: 0, vx: 0, vy: 0, m: 30, name: '大质量中心星', color: '#fff0c0', kind: 'core' }];
    for (var i = 0; i < n; i++) {
      var u = rand();
      var rr = Math.min(-1.8 * Math.log(1 - u * 0.99), 5.2);
      var th = rand() * GA.TAU;
      var x = rr * Math.cos(th), y = rr * Math.sin(th);
      var vCirc = Math.sqrt(G * 30 / Math.max(rr, 0.5)) * (0.55 + 0.5 * rand());
      var vAng = th + Math.PI / 2 * (rand() < 0.72 ? 1 : -1);
      bodies.push({
        x: x, y: y, vx: -Math.sin(vAng) * vCirc, vy: Math.cos(vAng) * vCirc,
        m: 0.02, name: '恒星', color: '#bcd4ff', kind: 'star'
      });
    }
    return build(bodies, {
      G: G, eps: 0.09, massEps: 0.001, dt: 2.5e-3, integrator: 'verlet', method: 'bh', theta: 0.5,
      timeUnit: 'u', daysPerUnit: 0
    });
  }

  /* ---------- 7. 三体混沌（散射） ---------- */
  /* 经典三体散射构型：三颗星近乎相遇，轨道混沌放大到不可预测。
     这不是"解错了"，而是问题本身没有闭式解。 */
  function chaos() {
    var b = [
      { x: -2.2, y: 0.4, vx: 0.35, vy: 1.1, m: 1, name: '星 1', color: '#ffd98a', kind: 'star' },
      { x: 2.2, y: -0.4, vx: 0.35, vy: -1.1, m: 1, name: '星 2', color: '#8fe3ff', kind: 'star' },
      { x: 0, y: 3.2, vx: -0.7, vy: 0, m: 1, name: '星 3', color: '#ff9ec7', kind: 'star' }
    ];
    return build(b, {
      G: 1, eps: 0.06, dt: 2e-3, integrator: 'pefrl', method: 'brute',
      timeUnit: 'u', daysPerUnit: 0
    });
  }

  /* ---------- 8. 黑洞吸积盘（2D 示意） ---------- */
  /* 一个大质量中心 + 盘内恒星 + 一条被潮汐拉长的恒星流。 */
  function accretion() {
    var G = 1, rand = GA.rng(2718);
    var bodies = [{ x: 0, y: 0, vx: 0, vy: 0, m: 400, name: '黑洞', color: '#000000', kind: 'core' }];
    for (var i = 0; i < 900; i++) {
      var u = rand();
      var rr = 1.4 + Math.min(-3.2 * Math.log(1 - u * 0.98), 9);
      var th = rand() * GA.TAU;
      var v = Math.sqrt(G * 400 / rr);
      bodies.push({
        x: rr * Math.cos(th), y: rr * Math.sin(th) * 0.92,
        vx: -Math.sin(th) * v, vy: Math.cos(th) * v,
        m: 0, name: '吸积物质', color: rand() < 0.5 ? '#ffcf8a' : '#ff9a5c', kind: 'disk'
      });
    }
    // 一颗被撕开的恒星（试探粒子链）
    for (var j = 0; j < 160; j++) {
      var t = j / 160;
      var rr2 = 7.5 + t * 5.0;
      var th2 = 0.6 + t * 2.4;
      bodies.push({
        x: rr2 * Math.cos(th2), y: rr2 * Math.sin(th2),
        vx: -Math.sin(th2) * 1.0, vy: Math.cos(th2) * 1.0,
        m: 0, name: '潮汐流', color: '#9fd8ff', kind: 'stream'
      });
    }
    return build(bodies, {
      G: G, eps: 0.22, massEps: 0.5, dt: 1.2e-3, integrator: 'verlet', method: 'bh', theta: 0.5,
      timeUnit: 'u', daysPerUnit: 0
    });
  }

  /* ================================================================== */
  GA.presets = {
    figure8: {
      key: 'figure8', name: '八字编舞', tag: '精确周期解',
      desc: '三体问题的已知周期解（Chenciner–Montgomery 2000）。积分一个周期后必须精确回到出发位置——这是本项目的"标准答案"。',
      defaultSpeed: 8,
      speedNote: '八字周期 T≈6.33；每帧 8 步 ≈ 60FPS 下 4 秒走完一个周期',
      verify: 'period=' + GA.FIGURE8_PERIOD,
      build: figure8
    },
    innerSolar: {
      key: 'innerSolar', name: '内太阳系', tag: '真实天体',
      desc: '水金地火 + 太阳，采用 4π² 单位制（地球公转周期恰为 1 年）。所有半长轴与质量取真实数据。',
      defaultSpeed: 24,
      speedNote: '地球公转周期 1 年；每帧 24 步让内行星在几秒内转明显',
      verify: '地球公转周期 ≈ 1.000 年',
      build: innerSolar
    },
    lagrange: {
      key: 'lagrange', name: '等边三角形解', tag: '精确周期解',
      desc: '三颗等质量天体排成等边三角形整体旋转，ω² = 3Gm/a³。同样是一个可精确验证的周期解。',
      defaultSpeed: 14,
      speedNote: '三角形周期约 10.3；每帧 14 步',
      verify: 'ω² = 3Gm/a³',
      build: lagrange
    },
    galaxyMerge: {
      key: 'galaxyMerge', name: '星系并合', tag: 'Barnes–Hut 主场',
      desc: '两个各 1200 颗恒星的盘星系相向运动。O(N²) 每步需 290 万次两体计算，纯靠 Barnes–Hut 才能实时。相遇后会拉出潮汐尾与物质桥。',
      defaultSpeed: 10,
      speedNote: '并合过程漫长，需要较高倍率才看得出潮汐尾被拉出',
      verify: 'N=2402（2 核球 + 2400 恒星），θ=0.55',
      build: galaxyMerge
    },
    starCluster: {
      key: 'starCluster', name: '球状星团', tag: 'N=2400 压测',
      desc: '大质量中心星 + 2400 颗恒星，指数分布密度。用于压测 Barnes–Hut 的加速比与恒星弛豫过程。',
      defaultSpeed: 8,
      speedNote: '星团弛豫时间尺度大',
      verify: 'N=2401',
      build: starCluster
    },
    binary: {
      key: 'binary', name: '双星 + 行星', tag: '试探粒子',
      desc: '双星系统 + 5 颗行星（零质量试探粒子：只感受引力，不产生引力）。演示受限三体/多体问题。',
      defaultSpeed: 10,
      speedNote: '双星周期约 6.3',
      verify: '试探粒子 5 颗',
      build: binary
    },
    chaos: {
      key: 'chaos', name: '三体混沌', tag: '不可预测',
      desc: '三体散射构型。轨道对初值极其敏感——微小扰动被指数放大。没有闭式解，只能积分。',
      defaultSpeed: 6,
      speedNote: '三体散射靠速度堆出混沌感',
      verify: '李萨如轨道',
      build: chaos
    },
    accretion: {
      key: 'accretion', name: '吸积盘', tag: '大质量中心',
      desc: '大质量中心天体 + 900 颗吸积物质 + 一条被潮汐拉长的恒星流。展示软化长度如何防止近距离奇点。',
      defaultSpeed: 14,
      speedNote: '吸积盘内周期很短，需要快放',
      verify: 'N=1061，试探粒子为主',
      build: accretion
    }
  };

  GA.presetOrder = ['figure8', 'innerSolar', 'lagrange', 'galaxyMerge', 'starCluster', 'binary', 'chaos', 'accretion'];

  /** 载入预设并返回可直接喂给 Sim 的配置 */
  GA.loadPreset = function (key) {
    var p = GA.presets[key];
    if (!p) throw new Error('未知场景: ' + key);
    var cfg = p.build();
    cfg.preset = p;
    return cfg;
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);

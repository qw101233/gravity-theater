/*!
 * Gravity Arena · 引力剧场
 * render.js — Canvas 2D 渲染
 *
 * 性能取向（实测数据决定的做法，不是拍脑袋）：
 *   N=2500 时物理已占 6.5ms/步，留给渲染的预算只有 ~10ms。
 *   所以：
 *   1. 天体用 1~3 像素的实心方块/圆点，不用 radialGradient 画光晕
 *      —— 5000 次渐变填充是 30ms 级别，直接吃掉整个帧预算。
 *   2. 颜色靠"预乘色板 + 全局 alpha"分档，不逐粒子算 RGB。
 *   3. 轨迹画在离屏 canvas 上做"淡出"叠加，而不是每帧重画 N 条折线。
 *      N=2500、每条 64 点 = 16 万段/帧，逐帧重画必卡。
 *   4. 图像缩放用 ctx.setTransform，不逐粒子算屏幕坐标。
 */
(function (global) {
  'use strict';

  var GA = global.GA;

  /* ---------------- 视口（世界坐标 ↔ 屏幕坐标） ---------------- */
  function View() {
    this.x = 0; this.y = 0;        // 视口中心（世界坐标）
    this.scale = 100;               // 像素 / 世界单位
    this.w = 800; this.h = 600;
  }
  View.prototype.sx = function (wx) { return (wx - this.x) * this.scale + this.w * 0.5; };
  View.prototype.sy = function (wy) { return (wy - this.y) * this.scale + this.h * 0.5; };
  View.prototype.wx = function (sxp) { return (sxp - this.w * 0.5) / this.scale + this.x; };
  View.prototype.wy = function (syp) { return (syp - this.h * 0.5) / this.scale + this.y; };
  View.prototype.zoomAt = function (sxp, syp, factor) {
    var wxBefore = this.wx(sxp), wyBefore = this.wy(syp);
    this.scale = GA.clamp(this.scale * factor, 0.5, 1e7);
    this.x = wxBefore - (sxp - this.w * 0.5) / this.scale;
    this.y = wyBefore - (syp - this.h * 0.5) / this.scale;
  };

  /* ---------------- 调色板 ---------------- */
  /* 把 RGB 预打包成 32 位整数，渲染时直接 OR 到位图里。
     记忆提醒：ImageData 是 RGBA 4 字节/像素，按 3 字节步进会通道错位。 */
  function parseColor(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var v = parseInt(h, 16);
    return [0xFF000000 | (v & 0xFF) | ((v & 0xFF00) << 8) | ((v & 0xFF0000) << 16)];
  }

  /* ---------------- 渲染器 ---------------- */
  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.view = new View();
    this.trails = null;          // 离屏轨迹缓冲
    this.showTrails = true;
    this.showVectors = false;
    this.glow = true;
    this.dpr = 1;
    this._initTrails();
  }

  Renderer.prototype._initTrails = function () {
    if (!this.trails) {
      this.trails = document.createElement('canvas');
      this.trailCtx = this.trails.getContext('2d');
    }
    this.trails.width = this.canvas.width;
    this.trails.height = this.canvas.height;
    this.trailCtx.fillStyle = '#000';
    this.trailCtx.fillRect(0, 0, this.trails.width, this.trails.height);
  };

  Renderer.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var rect = this.canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.dpr = dpr;
      this._initTrails();
    }
    this.view.w = w; this.view.h = h;
  };

  /**
   * 自动缩放到包住所有活跃天体。
   * @param {Sim} sim
   * @param {number} pad 边距系数
   * @param {'contain'|'cover'} mode
   *   contain —— 完整装下所有天体（会有留白）
   *   cover   —— 铺满画布，长边方向裁边（内容更饱满）
   * 竖版 9:16 里横长条内容（如八字编舞）用 contain 会上下大片空白，
   * 用 cover 则两侧被裁——两者都不完美，所以默认取两者的几何折中。
   */
  Renderer.prototype.fit = function (sim, pad, mode) {
    var n = sim.N, i, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, cnt = 0;
    for (i = 0; i < n; i++) {
      if (!sim.active[i]) continue;
      var x = sim.px[i], y = sim.py[i];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      cnt++;
    }
    if (!cnt) return;
    var p = pad == null ? 1.12 : pad;
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    /* ⚠️ 共线构型陷阱（内太阳系：所有天体 py=0，全在一条直线上）：
       此时 maxY-minY = 0，若只兜 1e-6，cover 分支会算出
       H/1e-6 = 1.18e9 的缩放，画面里什么都看不见。
       所以退化维度要用「另一维的尺寸」兜底，而不是用一个极小的魔数。 */
    var rawX = maxX - minX, rawY = maxY - minY;
    var ref = Math.max(rawX, rawY, 1e-6);
    /* 退化维度直接用参考尺寸本身（不是 6%）：一条直线在视觉上占的就是
       一个直径为 ref 的圆形范围，缩到 ref 才是"看起来合适"。
       给 6% 会让画面里只剩中心一小段（实测 sx 仍在 -1555 之外）。 */
    var extX = Math.max(rawX * p, ref);
    var extY = Math.max(rawY * p, ref);
    this.view.x = cx; this.view.y = cy;
    /* 等比缩放，只能取一个 scale。取 contain 与 cover 的几何平均：
       contain = min(W/extX, H/extY)，cover = max(...)
       平方根插值在两者之间，兼顾"不裁太多"与"不留太多白"。 */
    var sContain = Math.min(this.view.w / extX, this.view.h / extY);
    var sCover = Math.max(this.view.w / extX, this.view.h / extY);
    if (mode === 'contain') this.view.scale = sContain;
    else if (mode === 'cover') this.view.scale = sCover;
    else this.view.scale = Math.sqrt(sContain * sCover);
  };

  /* 轨迹淡出：每帧用低 alpha 黑覆盖，越老的轨迹越暗 */
  Renderer.prototype._fadeTrails = function (amount) {
    var c = this.trailCtx;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgba(0,0,0,' + amount + ')';
    c.fillRect(0, 0, this.trails.width, this.trails.height);
  };

  /** 往轨迹缓冲上打一个时间采样点（每个积分步调一次，保证轨迹连续） */
  Renderer.prototype.stampTrails = function (sim, bodyMeta) {
    if (!this.showTrails) return;
    var tc = this.trailCtx, view = this.view, dpr = this.dpr;
    var W = view.w, H = view.h;
    tc.setTransform(dpr, 0, 0, dpr, 0, 0);
    tc.globalCompositeOperation = 'lighter';
    for (var gi = 0; gi < bodyMeta.groups.length; gi++) {
      var g = bodyMeta.groups[gi];
      tc.fillStyle = g.rgba;
      for (var k = 0; k < g.idx.length; k++) {
        var i = g.idx[k];
        if (!sim.active[i]) continue;
        var sxp = (sim.px[i] - view.x) * view.scale + W * 0.5;
        var syp = (sim.py[i] - view.y) * view.scale + H * 0.5;
        if (sxp < -20 || sxp > W + 20 || syp < -20 || syp > H + 20) continue;
        var r = Math.max(0.7, bodyMeta.radii[i] * dpr * 0.62);
        tc.fillRect(sxp - r * 0.5, syp - r * 0.5, r, r);
      }
    }
  };

  Renderer.prototype.clearTrails = function () {
    this.trailCtx.globalCompositeOperation = 'source-over';
    this.trailCtx.fillStyle = '#000';
    this.trailCtx.fillRect(0, 0, this.trails.width, this.trails.height);
  };

  /**
   * 主绘制。
   * @param {Sim} sim
   * @param {object} bodyMeta {colors: Uint32Array, kinds: Array, maxMass}
   * @param {object} opts {fade, drawTrails}
   */
  Renderer.prototype.draw = function (sim, bodyMeta, opts) {
    opts = opts || {};
    var ctx = this.ctx, view = this.view, dpr = this.dpr;
    var W = view.w, H = view.h;

    // 背景
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#05070f');
    bg.addColorStop(0.55, '#080b18');
    bg.addColorStop(1, '#04060c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 轨迹缓冲
    /* ⚠️ 无论是否在播放都要绘制：暂停时正是用户想看清轨迹的时候。
       （初版写成 drawTrails: playing，导致暂停截图里完全没有轨迹，
        看起来像"功能没实现"。这是自己踩的坑。）

       轨迹的采样点在主循环里逐积分步调用 stampTrails() 打，
       这里只负责"淡出 + 叠加显示"。 */
    if (this.showTrails) {
      this._fadeTrails(opts.fade == null ? 0.035 : opts.fade);
      // 叠加轨迹（加性混合，让密集区自然变亮）
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      ctx.drawImage(this.trails, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 天体
    ctx.globalCompositeOperation = 'lighter';
    var colors = bodyMeta.colors, radii = bodyMeta.radii;
    for (var i2 = 0; i2 < sim.N; i2++) {
      if (!sim.active[i2]) continue;
      var x2 = (sim.px[i2] - view.x) * view.scale + W * 0.5;
      var y2 = (sim.py[i2] - view.y) * view.scale + H * 0.5;
      var rr = radii[i2] * dpr;
      if (x2 < -40 || x2 > W + 40 || y2 < -40 || y2 > H + 40) continue;
      ctx.fillStyle = colors[i2];
      if (rr <= 1.4) {
        var s1 = Math.max(1, rr);
        ctx.fillRect(x2 - s1 * 0.5, y2 - s1 * 0.5, s1, s1);
      } else {
        ctx.beginPath();
        ctx.arc(x2, y2, rr, 0, GA.TAU);
        ctx.fill();
        if (this.glow && rr > 2.2) {
          ctx.globalAlpha = 0.28;
          ctx.beginPath();
          ctx.arc(x2, y2, rr * 2.6, 0, GA.TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // 速度矢量
    if (this.showVectors) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(120,190,255,0.55)';
      ctx.lineWidth = Math.max(0.7, dpr * 0.8);
      var vs = 0.32;   // 速度 → 屏幕长度的缩放
      for (var i3 = 0; i3 < sim.N; i3++) {
        if (!sim.active[i3]) continue;
        if (bodyMeta.mass[i3] <= bodyMeta.massEps) continue;  // 只画 massive
        var bx = (sim.px[i3] - view.x) * view.scale + W * 0.5;
        var by = (sim.py[i3] - view.y) * view.scale + H * 0.5;
        var ex2 = bx + sim.vx[i3] * view.scale * vs;
        var ey2 = by + sim.vy[i3] * view.scale * vs;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex2, ey2); ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  };

  /** 把天体元数据打包成渲染需要的分组结构 */
  Renderer.prototype.buildMeta = function (bodies, mass, massEps) {
    var n = mass.length;
    var colors = new Array(n), radii = new Float64Array(n);
    var groups = [];
    var colorMap = {};
    var maxM = 0;
    for (var i = 0; i < n; i++) if (mass[i] > maxM) maxM = mass[i];
    for (var j = 0; j < n; j++) {
      var b = bodies[j] || { color: '#8fb8ff' };
      colors[j] = b.color || '#8fb8ff';
      // 半径按质量立方根缩放（体积∝质量），试探粒子给固定小半径
      var mj = mass[j];
      /* 下限 1.35px：缩放级别很高时（如内太阳系全景，行星只占 0.3px）
         若没有下限，行星会整个消失，看起来像"场景没东西"。 */
      var r = mj > massEps
        ? Math.max(1.35, Math.pow(mj / Math.max(maxM, 1e-12), 1 / 3) * Math.min(9, Math.max(2.4, Math.log2(1 + n / 12) * 1.5)))
        : Math.max(1.0, Math.min(1.9, Math.log2(1 + n / 40)));
      radii[j] = r;
      if (!colorMap[colors[j]]) {
        colorMap[colors[j]] = { rgba: colors[j], alpha: 0.5, idx: [] };
        groups.push(colorMap[colors[j]]);
      }
      colorMap[colors[j]].idx.push(j);
    }
    return { colors: colors, radii: radii, groups: groups, mass: mass, massEps: massEps };
  };

  GA.View = View;
  GA.Renderer = Renderer;
  GA.parseColor = parseColor;

})(typeof globalThis !== 'undefined' ? globalThis : this);

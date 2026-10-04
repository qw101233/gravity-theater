/*!
 * Gravity Arena · 引力剧场
 * core.js — 命名空间、数学工具、确定性随机数
 *
 * 设计原则：
 *  1. 零依赖。所有文件是 classic script（不是 ES module），
 *     这样 index.html 用 file:// 双击就能打开，不需要起服务器。
 *  2. 每个模块往全局 GA 命名空间挂东西，不污染别的名字。
 *  3. 全部状态用 TypedArray，N=4000 也能 60FPS。
 */
(function (global) {
  'use strict';

  var GA = global.GA || (global.GA = {});
  GA.VERSION = '1.0.0';

  /* ---------------- 数学常量与工具 ---------------- */

  GA.TAU = Math.PI * 2;

  GA.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  /**
   * 确定性 PRNG（mulberry32）。
   * 为什么不用 Math.random：预设场景必须每次打开都一模一样，
   * 否则截图、回归测试、论文引用全都对不上。
   * @param {number} seed 32 位无符号整数
   * @returns {function():number} 返回 [0,1) 的函数
   */
  GA.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** Box–Muller 正态分布采样（用传入的 rng，保证可复现） */
  GA.gaussian = function (rand) {
    var u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(GA.TAU * v);
  };

  /** 均匀分布 [lo, hi) */
  GA.uniform = function (rand, lo, hi) { return lo + (hi - lo) * rand(); };

  /** 统计量：相对误差、RMS 误差，用于测试与诊断 */
  GA.relErr = function (a, b) {
    var d = Math.abs(b);
    return d > 1e-300 ? Math.abs(a - b) / d : Math.abs(a - b);
  };

  GA.rms = function (arr) {
    var s = 0, n = arr.length;
    for (var i = 0; i < n; i++) s += arr[i] * arr[i];
    return Math.sqrt(s / n);
  };

  /** log-log 线性拟合，返回斜率（用于验证误差的 θ² 标度） */
  GA.logLogSlope = function (xs, ys) {
    var n = xs.length;
    var lx = new Float64Array(n), ly = new Float64Array(n);
    for (var i = 0; i < n; i++) { lx[i] = Math.log(xs[i]); ly[i] = Math.log(ys[i]); }
    var mx = 0, my = 0, i2;
    for (i2 = 0; i2 < n; i2++) { mx += lx[i2]; my += ly[i2]; }
    mx /= n; my /= n;
    var num = 0, den = 0;
    for (i2 = 0; i2 < n; i2++) { num += (lx[i2] - mx) * (ly[i2] - my); den += (lx[i2] - mx) * (lx[i2] - mx); }
    return den > 1e-300 ? num / den : NaN;
  };

  /** 数值格式化：给 UI 用，避免到处写 toFixed */
  GA.fmt = function (v, digits) {
    if (!isFinite(v)) return String(v);
    var d = digits == null ? 3 : digits;
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-4 || a >= 1e6)) {
      var e = Math.floor(Math.log10(a));
      var m = v / Math.pow(10, e);
      return m.toFixed(Math.max(0, d - 1)) + 'e' + e;
    }
    return v.toFixed(d);
  };

  /** 高精度计时（毫秒） */
  GA.now = function () {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  };

  /* ---------------- 时间格式 ---------------- */

  /** 把内部时间单位格式化成"年/日"这类可读串（单位名由 preset 决定） */
  GA.fmtTime = function (t, unitName, daysPerUnit) {
    var s;
    if (unitName === 'yr' && daysPerUnit) {
      var days = t * daysPerUnit;
      if (days < 365.25 * 2) s = days.toFixed(1) + ' 天';
      else s = (days / 365.25).toFixed(2) + ' 年';
    } else {
      s = GA.fmt(t, 2);
    }
    return s;
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);

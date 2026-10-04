/*!
 * Gravity Arena · 引力剧场
 * integrators.js — 时间积分器族
 *
 * 为什么搞四个：不是为了炫技，是为了能量守恒行为可测。
 *   半隐式 Euler  : 1 阶非辛，能量单调漂移
 *   Velocity Verlet: 2 阶辛，能量有界振荡
 *   PEFRL         : 4 阶辛，能量误差小一个量级
 *   RK4           : 4 阶非辛，误差随时间累积（用来反证"高阶≠守恒"）
 *
 * 全部接口统一为 step(sim, dt)，sim 需提供：
 *   N, px, py, vx, vy, ax, ay (Float64Array), G, eps, force(sim, ax, ay)
 */
(function (global) {
  'use strict';

  var GA = global.GA;

  /* RK4 / PEFRL 需要的暂存缓冲，按 N 惰性分配并缓存 */
  var scratch = new WeakMap();

  function getScratch(sim) {
    var n = sim.N;
    var s = scratch.get(sim);
    if (!s || s.n !== n) {
      s = { n: n };
      // 最多 16 个 n 长向量，按名字懒分配
      var s2 = { n: n };
      for (var q = 0; q < 16; q++) s2['v' + q] = new Float64Array(n);
      scratch.set(sim, s2);
      s = s2;
    }
    return s;
  }

  function accel(sim) { sim.force(sim, sim.ax, sim.ay); }

  /* ---------------- 半隐式 Euler ---------------- */
  /* v += a·dt; x += v·dt。注意 v 先更新，所以叫"半隐式"。
     它只有 1 阶精度，但比显式 Euler 稳定得多。代价：能量非守恒。 */
  function euler(sim, dt) {
    var N = sim.N, px = sim.px, py = sim.py, vx = sim.vx, vy = sim.vy, ax = sim.ax, ay = sim.ay;
    accel(sim);
    var i;
    for (i = 0; i < N; i++) { vx[i] += ax[i] * dt; vy[i] += ay[i] * dt; px[i] += vx[i] * dt; py[i] += vy[i] * dt; }
    sim.evals++;
  }

  /* ---------------- Velocity Verlet（2 阶辛） ---------------- */
  /* 半步 kick → 全步 drift → 重新算 a → 半步 kick。
     辛映射保证能量误差不累积，只在有界范围内振荡。这是"守恒"的可观测定义。 */
  function verlet(sim, dt) {
    var N = sim.N, px = sim.px, py = sim.py, vx = sim.vx, vy = sim.vy, ax = sim.ax, ay = sim.ay;
    var h = 0.5 * dt, i;
    accel(sim);
    for (i = 0; i < N; i++) {
      vx[i] += h * ax[i]; vy[i] += h * ay[i];
      px[i] += dt * vx[i]; py[i] += dt * vy[i];
    }
    accel(sim);
    for (i = 0; i < N; i++) { vx[i] += h * ax[i]; vy[i] += h * ay[i]; }
    sim.evals += 2;
  }

  /* ---------------- PEFRL（Omelyan et al. 2002, 4 阶辛） ---------------- */
  /* 系数（照抄权威来源，勿凭记忆改写 —— 我第一次就是靠记忆写错的）：
       ξ = +0.1786178958448091
       λ = -0.2123418310626054     ← 注意是负号
       χ = -0.06626458266981849
     来源：Omelyan, Mryglod & Folk, Comput. Phys. Commun. 146 (2002) 188；
           UCSD Physics 141 讲义 Eq.(34)；MechanicsDSL / specfem2d 同形式。

     九段序列（4 次力计算）：
       x += ξ·dt·v          v += (1/2−λ)·dt·a
       x += χ·dt·v          v +=  λ    ·dt·a
       x += (1−2(χ+ξ))·dt·v v +=  λ    ·dt·a
       x += χ·dt·v          v += (1/2−λ)·dt·a
       x += ξ·dt·v                 ← 最后一段只有位置，没有 kick

     ⚠️⚠️ 最容易错、且错了不报任何错的地方：**求值顺序是"先漂移，再算力"**。
        每一段都是 `x += c·dt·v` 之后才调用 accel()，kick 用的是**漂移后**的 a。
        如果写成"先 accel 再漂移"（Verlet 的习惯），收敛阶会从 4 阶掉到 1 阶 ——
        实测 5.450e-2 vs 7.206e-7，差 75000 倍，而代码看起来完全合理。
        判据：谐振子单周期能量偏差应为 7.206e-7（h/T=0.02），与 UCSD 讲义原表一致。

     自检：位置系数和 = ξ+χ+(1−2(χ+ξ))+χ+ξ = 1（必须严格为 1，
     否则有效步长被悄悄放大，轨道会慢慢飞掉而不报任何错）。*/
  function pefrl(sim, dt) {
    var N = sim.N, px = sim.px, py = sim.py, vx = sim.vx, vy = sim.vy;
    var XI = 0.1786178958448091;
    var LAM = -0.2123418310626054;     // 负值！
    var CHI = -0.06626458266981849;
    var B0 = (0.5 - LAM) * dt;
    var BL = LAM * dt;
    var A1 = XI * dt, A2 = CHI * dt, A3 = (1 - 2 * (CHI + XI)) * dt;
    var i;

    for (i = 0; i < N; i++) { px[i] += A1 * vx[i]; py[i] += A1 * vy[i]; }
    accel(sim);
    for (i = 0; i < N; i++) { vx[i] += B0 * sim.ax[i]; vy[i] += B0 * sim.ay[i]; }

    for (i = 0; i < N; i++) { px[i] += A2 * vx[i]; py[i] += A2 * vy[i]; }
    accel(sim);
    for (i = 0; i < N; i++) { vx[i] += BL * sim.ax[i]; vy[i] += BL * sim.ay[i]; }

    for (i = 0; i < N; i++) { px[i] += A3 * vx[i]; py[i] += A3 * vy[i]; }
    accel(sim);
    for (i = 0; i < N; i++) { vx[i] += BL * sim.ax[i]; vy[i] += BL * sim.ay[i]; }

    for (i = 0; i < N; i++) { px[i] += A2 * vx[i]; py[i] += A2 * vy[i]; }
    accel(sim);
    for (i = 0; i < N; i++) { vx[i] += B0 * sim.ax[i]; vy[i] += B0 * sim.ay[i]; }

    for (i = 0; i < N; i++) { px[i] += A1 * vx[i]; py[i] += A1 * vy[i]; }
    sim.evals += 4;
  }

  /* ---------------- RK4（非辛，用于反证） ---------------- */
  /* y = (x, v), y' = (v, a(x))。关键：k 的计算需要 x 的"暂存值"，
     所以要把 x₀ 备份起来，最后一次性写回 x₀ + h/6·Σkᵢ。
     早期版本忘了备份，x 被累加 4 次，有效步长放大 3 倍——
     不报错，只是结果错到离谱。 */
  function rk4(sim, dt) {
    var N = sim.N, px = sim.px, py = sim.py, vx = sim.vx, vy = sim.vy, ax = sim.ax, ay = sim.ay;
    var s = getScratch(sim);
    var x0 = s.v0, y0 = s.v1;    // 备份起点
    var a2 = s.v2, a3 = s.v3;    // k2v
    var a4 = s.v4, a5 = s.v5;    // k3v
    var a6 = s.v6, a7 = s.v7;    // k4v
    var k2x = s.v8, k2y = s.v9, k3x = s.v10, k3y = s.v11, k4x = s.v12, k4y = s.v13;
    var h = dt * 0.5, h6 = dt / 6, i;

    for (i = 0; i < N; i++) { x0[i] = px[i]; y0[i] = py[i]; }
    accel(sim);                                        // k1v 已在 ax/ay，k1x = v

    for (i = 0; i < N; i++) {                          // x + h/2·k1x
      k2x[i] = vx[i] + h * ax[i]; k2y[i] = vy[i] + h * ay[i];
      px[i] = x0[i] + h * vx[i];   py[i] = y0[i] + h * vy[i];
    }
    sim.force(sim, a2, a3);                            // k2v
    for (i = 0; i < N; i++) {                          // x + h/2·k2x
      k3x[i] = vx[i] + h * a2[i]; k3y[i] = vy[i] + h * a3[i];
      px[i] = x0[i] + h * k2x[i];  py[i] = y0[i] + h * k2y[i];
    }
    sim.force(sim, a4, a5);                            // k3v
    for (i = 0; i < N; i++) {                          // x + h·k3x
      k4x[i] = vx[i] + dt * a4[i]; k4y[i] = vy[i] + dt * a5[i];
      px[i] = x0[i] + dt * k3x[i]; py[i] = y0[i] + dt * k3y[i];
    }
    sim.force(sim, a6, a7);                            // k4v

    for (i = 0; i < N; i++) {
      px[i] = x0[i] + h6 * (vx[i] + 2 * k2x[i] + 2 * k3x[i] + k4x[i]);
      py[i] = y0[i] + h6 * (vy[i] + 2 * k2y[i] + 2 * k3y[i] + k4y[i]);
      vx[i] += h6 * (ax[i] + 2 * a2[i] + 2 * a4[i] + a6[i]);
      vy[i] += h6 * (ay[i] + 2 * a3[i] + 2 * a5[i] + a7[i]);
    }
    sim.evals += 4;
  }

  /* ---------------- 注册表 ---------------- */

  GA.integrators = {
    euler:   { key: 'euler',   label: '半隐式 Euler',   order: 1, symplectic: false, evalsPerStep: 1, fn: euler,
               note: '1 阶非辛。最快，但能量单调漂移——用来演示"便宜的方法守不住"' },
    verlet:  { key: 'verlet',  label: 'Velocity Verlet', order: 2, symplectic: true, evalsPerStep: 2, fn: verlet,
               note: '2 阶辛。能量误差有界振荡，是天体力学的默认选择' },
    pefrl:   { key: 'pefrl',   label: 'PEFRL（4 阶辛）', order: 4, symplectic: true, evalsPerStep: 4, fn: pefrl,
               note: '4 阶辛，4 次力计算。步长可以放大 4 倍以上，长时间积分首选' },
    rk4:     { key: 'rk4',     label: '经典 RK4',        order: 4, symplectic: false, evalsPerStep: 4, fn: rk4,
               note: '4 阶非辛。短时极准，长时能量漂移——与 PEFRL 同台对照' }
  };

  GA.integratorOrder = ['euler', 'verlet', 'pefrl', 'rk4'];

})(typeof globalThis !== 'undefined' ? globalThis : this);

/*!
 * Gravity Arena · 引力剧场
 * app.js — 主程序：主循环、交互、UI 绑定、调试 API
 *
 * 暴露 window.GA_APP 供自动化验证使用（Playwright 靠它驱动，
 * 比模拟鼠标稳定一个量级——尤其是精细操作如"点击发射粒子"）。
 */
(function (global) {
  'use strict';

  var GA = global.GA;

  var app = {
    sim: null,
    renderer: null,
    presetKey: 'figure8',
    playing: true,
    speed: 1,              // 每帧步数倍率
    stepsPerFrame: 1,
    accumulator: 0,
    lastTs: 0,
    fps: 0,
    frameMs: 0,
    stepMs: 0,
    _fpsAcc: 0, _fpsCnt: 0,
    _diagAcc: 0
  };

  /* ---------------- DOM ---------------- */
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 载入场景 ---------------- */
  app.loadPreset = function (key) {
    var cfg = GA.loadPreset(key);
    app.presetKey = key;
    app.cfg = cfg;
    app.sim = new GA.Sim({
      px: cfg.px, py: cfg.py, vx: cfg.vx, vy: cfg.vy, mass: cfg.mass,
      G: cfg.meta.G, eps: cfg.meta.eps, massEps: cfg.meta.massEps,
      integrator: cfg.meta.integrator, method: cfg.meta.method,
      theta: cfg.meta.theta
    });
    app.sim.snapshot();
    app.dt = cfg.meta.dt;
    app.meta = cfg.meta;
    app.bodies = cfg.bodies;
    app.renderer.buildMeta(cfg.bodies, cfg.mass, cfg.meta.massEps || 0);
    app.renderer.fit(app.sim, 1.1);
    app.renderer.clearTrails();

    /* 每个场景有自己的默认速度。
       原因：各场景的 dt 与"值得看的运动"所需时间差两个数量级 ——
       内太阳系 dt=2e-4、要看地球绕一圈需要 ~5000 步；
       吸积盘 dt=1.2e-3、看一圈只要 ~500 步。
       统一速度会让前者看起来"卡住不动"。
       语义：每帧推进 speed × dt（speed=8 即每帧 8 步）。 */
    app.speed = cfg.preset.defaultSpeed || 1;
    var spEl = $('speed');
    if (spEl) spEl.value = app.speedToSlider ? String(app.speedToSlider(app.speed)) : '50';
    var spV = $('speed-val');
    if (spV) spV.textContent = (app.speed < 10 ? app.speed.toFixed(1) : app.speed.toFixed(0)) + '×';
    app.driftRef = { E: app.sim.energy(), t: app.sim.time };
    app.updateUI();
    app.updateDiag(true);
  };

  /* ---------------- 主循环 ---------------- */
  function frame(ts) {
    if (!app.lastTs) app.lastTs = ts;
    var dtReal = Math.min((ts - app.lastTs) / 1000, 0.1);   // 卡顿时不要让物理暴走
    app.lastTs = ts;

    if (app.playing && app.sim) {
      var t0 = GA.now();
      /* 速度语义 = "每帧推进多少个 dt"（而不是"每帧多少步"）。
         这样速度与 dt 解耦：用户把 dt 调大时，时间流逝加快但精度不变；
         dt × 速度 才是真正的每帧时间增量。
         初版写成"步数倍率"，于是 dt=1e-3 的场景在 60FPS 下 3 秒只走 0.18
         个时间单位，看起来像"没在动"——这是自己踩的坑。 */
      var steps = Math.max(1, Math.round(app.speed));
      // 自适应：若单帧物理耗时超预算，自动少走几步（保帧率，牺牲时间流速）
      if (app.lastStepMs > 13 && steps > 1) steps = Math.max(1, steps >> 1);
      /* 逐积分步打点：若一帧内推进 k 步却在最后只打一个点，
         轨迹上会出现 k-1 个缺口（轨迹变成虚线而不是连续曲线）。
         物理步进与打点必须同频。 */
      for (var i = 0; i < steps; i++) {
        GA.integrators[app.sim.integrator].fn(app.sim, app.dt);
        app.sim.time += app.dt;
        app.renderer.stampTrails(app.sim, app._getMeta());
      }
      app.lastStepMs = GA.now() - t0;
    }

    if (app.sim) {
      // 元数据只在场景/天体数变化时重建，不是每帧
      app.renderer.draw(app.sim, app._getMeta());
    }

    // FPS
    app._fpsAcc += dtReal; app._fpsCnt++;
    if (app._fpsAcc >= 0.4) { app.fps = app._fpsCnt / app._fpsAcc; app._fpsAcc = 0; app._fpsCnt = 0; }
    app.frameMs = GA.now() - ts;

    app._diagAcc += dtReal;
    if (app._diagAcc >= 0.25) { app._diagAcc = 0; app.updateDiag(false); }

    requestAnimationFrame(frame);
  }

  app._getMeta = function () {
    if (!this._meta || this._metaN !== this.sim.N) {
      this._meta = this.renderer.buildMeta(this.bodies, this.sim.mass, this.meta.massEps || 0);
      this._metaN = this.sim.N;
    }
    return this._meta;
  };

  /* ---------------- 诊断面板 ---------------- */
  app.updateDiag = function (force) {
    if (!app.sim) return;
    var s = app.sim, d = s.drift();
    var el;
    var set = function (id, v) { var n = $(id); if (n) n.textContent = v; };

    set('d-time', GA.fmtTime(s.time, app.meta.timeUnit, app.meta.daysPerUnit));
    set('d-fps', app.fps.toFixed(0));
    set('d-n', String(s.N));
    set('d-step', app.lastStepMs ? app.lastStepMs.toFixed(1) : '0.0');
    set('d-frame', app.frameMs.toFixed(1));

    // 能量漂移：相对量，符号表示方向
    var dE = d.dE;
    set('d-energy', (dE >= 0 ? '+' : '') + GA.fmt(dE * 100, 3) + '%');
    var en = $('d-energy'); if (en) {
      var mag = Math.min(1, Math.abs(dE) / 1e-3);
      en.style.color = mag > 0.6 ? '#ff6b6b' : (mag > 0.15 ? '#ffd166' : '#7ee787');
    }
    set('d-momentum', GA.fmt(d.dP * 100, 3) + '%');
    set('d-angmom', (d.dL >= 0 ? '+' : '') + GA.fmt(d.dL * 100, 3) + '%');
    set('d-com', GA.fmt(d.dCom, 3));
    set('d-ekin', GA.fmt(s.kinetic(), 4));
    set('d-epot', GA.fmt(s.potential(), 4));
    set('d-theta', s.method === 'bh' ? s.theta.toFixed(2) : '—');
    set('d-method', s.method === 'bh' ? 'Barnes–Hut' : '暴力 O(N²)');
    set('d-int', GA.integrators[s.integrator].label + '（' + GA.integrators[s.integrator].order + '阶' + (GA.integrators[s.integrator].symplectic ? '辛' : '非辛') + '）');

    void force;
  };

  /* ---------------- UI ---------------- */
  app.updateUI = function () {
    var p = GA.presets[app.presetKey];
    var el;
    var set = function (id, v) { var n = $(id); if (n) n.textContent = v; };
    set('preset-name', p.name);
    set('preset-tag', p.tag);
    set('preset-desc', p.desc);
    set('preset-verify', p.verify);

    // 场景按钮高亮
    var btns = document.querySelectorAll('.preset-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].dataset.key === app.presetKey);
    }
    set('cfg-n', String(app.sim.N));
    set('cfg-g', GA.fmt(app.meta.G, 4));
    set('cfg-eps', GA.fmt(app.meta.eps, 5));
    set('cfg-masseps', GA.fmt(app.meta.massEps, 3));
    set('cfg-dt', GA.fmt(app.dt, 6));
  };

  app.bindUI = function () {
    // 场景切换
    var wrap = $('preset-list');
    GA.presetOrder.forEach(function (key) {
      var p = GA.presets[key];
      var b = document.createElement('button');
      b.className = 'preset-btn';
      b.dataset.key = key;
      b.innerHTML = '<span class="pn">' + p.name + '</span><span class="pt">' + p.tag + '</span>';
      b.addEventListener('click', function () { app.loadPreset(key); });
      wrap.appendChild(b);
    });

    // 播放控制
    $('btn-play').addEventListener('click', function () {
      app.playing = !app.playing;
      this.textContent = app.playing ? '⏸ 暂停' : '▶ 播放';
      this.classList.toggle('paused', !app.playing);
    });
    $('btn-step').addEventListener('click', function () {
      for (var i = 0; i < 10; i++) GA.integrators[app.sim.integrator].fn(app.sim, app.dt);
      app.sim.time += app.dt * 10;
    });
    $('btn-reset').addEventListener('click', function () { app.loadPreset(app.presetKey); });
    $('btn-fit').addEventListener('click', function () { app.renderer.fit(app.sim, 1.1); app.renderer.clearTrails(); });
    $('btn-cleartrail').addEventListener('click', function () { app.renderer.clearTrails(); });

    // 速度：对数映射。滑块是线性的，但各场景需要的倍率跨两个数量级
    // （0.1 ~ 60），线性滑块会让低倍率段精度极差。
    var sp = $('speed');
    var SPEED_MIN = 0.1, SPEED_MAX = 60;
    app.speedToSlider = function (v) {
      return Math.round(100 * (Math.log(GA.clamp(v, SPEED_MIN, SPEED_MAX) / SPEED_MIN) /
                               Math.log(SPEED_MAX / SPEED_MIN)));
    };
    app.sliderToSpeed = function (p) {
      return SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, p / 100);
    };
    sp.addEventListener('input', function () {
      app.speed = app.sliderToSpeed(parseFloat(this.value));
      $('speed-val').textContent = (app.speed < 10 ? app.speed.toFixed(1) : app.speed.toFixed(0)) + '×';
    });

    // 积分器
    var sel = $('integrator');
    GA.integratorOrder.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = GA.integrators[k].label + ' · ' + GA.integrators[k].order + '阶' + (GA.integrators[k].symplectic ? '辛' : '非辛');
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      app.sim.integrator = this.value;
      app.sim.snapshot();
      app.driftRef = { E: app.sim.energy(), t: app.sim.time };
      $('int-note').textContent = GA.integrators[this.value].note;
    });

    // 方法
    var ms = $('method');
    ['bh', 'brute'].forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = k === 'bh' ? 'Barnes–Hut（O(N log N)）' : '暴力 O(N²)（黄金标准）';
      ms.appendChild(o);
    });
    ms.addEventListener('change', function () {
      app.sim.setMethod(this.value);
      app.updateDiag(true);
    });

    // θ 滑块
    var th = $('theta');
    th.addEventListener('input', function () {
      app.sim.theta = parseFloat(this.value);
      $('theta-val').textContent = app.sim.theta.toFixed(2);
    });

    // dt 滑块
    var dts = $('dt-slider');
    dts.addEventListener('input', function () {
      var base = app.cfg.meta.dt;
      app.dt = base * parseFloat(this.value);
      $('dt-val').textContent = GA.fmt(app.dt, 6);
    });

    // 显示开关
    $('opt-trails').addEventListener('change', function () { app.renderer.showTrails = this.checked; });
    $('opt-vectors').addEventListener('change', function () { app.renderer.showVectors = this.checked; });
    $('opt-glow').addEventListener('change', function () { app.renderer.glow = this.checked; });

    // 缩放
    var z = $('zoom');
    z.addEventListener('input', function () {
      app.renderer.view.scale = parseFloat(this.value);
      $('zoom-val').textContent = parseFloat(this.value).toFixed(0) + ' px/单位';
    });

    // 画布交互：滚轮缩放、拖拽平移
    var cv = $('view');
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = cv.getBoundingClientRect();
      var dpr = app.renderer.dpr;
      var f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      app.renderer.view.zoomAt((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr, f);
      $('zoom').value = String(GA.clamp(app.renderer.view.scale, 0.5, 1e7));
      $('zoom-val').textContent = app.renderer.view.scale.toFixed(0) + ' px/单位';
    }, { passive: false });

    var dragging = false, lx = 0, ly = 0;
    cv.addEventListener('mousedown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; cv.style.cursor = 'grabbing'; });
    global.addEventListener('mouseup', function () { dragging = false; cv.style.cursor = 'grab'; });
    cv.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dpr = app.renderer.dpr;
      app.renderer.view.x -= (e.clientX - lx) * dpr / app.renderer.view.scale;
      app.renderer.view.y -= (e.clientY - ly) * dpr / app.renderer.view.scale;
      lx = e.clientX; ly = e.clientY;
    });
    cv.style.cursor = 'grab';

    // 键盘
    global.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); $('btn-play').click(); }
      if (e.key === 'f') $('btn-fit').click();
      if (e.key === 'r') $('btn-reset').click();
      if (e.key === 'c') $('btn-cleartrail').click();
    });

    global.addEventListener('resize', function () { app.renderer.resize(); });
  };

  /* ---------------- 启动 ---------------- */
  app.start = function () {
    var cv = $('view');
    app.renderer = new GA.Renderer(cv);
    app.renderer.resize();
    app.bindUI();
    app.loadPreset(app.presetKey);
    // 同步 UI 初始值
    $('integrator').value = app.sim.integrator;
    $('method').value = app.sim.method;
    $('theta').value = String(app.sim.theta);
    $('theta-val').textContent = app.sim.theta.toFixed(2);
    $('int-note').textContent = GA.integrators[app.sim.integrator].note;
    var spInit = $('speed'), spvInit = $('speed-val');
    if (spInit && app.speedToSlider) spInit.value = String(app.speedToSlider(app.speed));
    if (spvInit) spvInit.textContent = (app.speed < 10 ? app.speed.toFixed(1) : app.speed.toFixed(0)) + '×';
    $('zoom-val').textContent = app.renderer.view.scale.toFixed(0) + ' px/单位';
    $('zoom').value = String(GA.clamp(app.renderer.view.scale, 0.5, 1e7));
    requestAnimationFrame(frame);
  };

  /* ---------------- 调试 / 自动化 API ---------------- */
  global.GA_APP = {
    app: app,
    GA: GA,
    /** 推进 n 步（不依赖 rAF，供测试精确控制） */
    advance: function (n, dt) {
      var d = dt || app.dt;
      for (var i = 0; i < n; i++) GA.integrators[app.sim.integrator].fn(app.sim, d);
      app.sim.time += d * n;
      return app.sim.time;
    },
    load: function (k) { app.loadPreset(k); return app.sim.N; },
    setMethod: function (m) { app.sim.setMethod(m); },
    setIntegrator: function (i) { app.sim.integrator = i; },
    setTheta: function (t) { app.sim.theta = t; },
    setDt: function (d) { app.dt = d; },
    setPlaying: function (b) { app.playing = b; },
    setSpeed: function (s) { app.speed = s; },
    fit: function (mode) { app.renderer.fit(app.sim, 1.1, mode); },
    energy: function () { return app.sim.energy(); },
    drift: function () { return app.sim.drift(); },
    stats: function () {
      return {
        N: app.sim.N, fps: app.fps, stepMs: app.lastStepMs || 0,
        method: app.sim.method, integrator: app.sim.integrator,
        theta: app.sim.theta, time: app.sim.time,
        dE: app.sim.drift().dE, dL: app.sim.drift().dL,
        E: app.sim.energy(), L: app.sim.angularMomentum()
      };
    },
    /** 截图用：把当前画布导出为 dataURL */
    snapshot: function () { return $('view').toDataURL('image/png'); },
    /** 供演示录制：设定一个"好看"的时刻 */
    seek: function (t) {
      var n = Math.round(t / app.dt);
      for (var i = 0; i < n; i++) GA.integrators[app.sim.integrator].fn(app.sim, app.dt);
      app.sim.time = t;
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', app.start);
  else app.start();

})(typeof globalThis !== 'undefined' ? globalThis : this);

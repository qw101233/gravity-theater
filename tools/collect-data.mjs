/**
 * collect-data.mjs — 采集所有展示用的物理数据 → slides-data.json
 *
 * 这是 slides/ 里每个数字的唯一来源。手写数字比没有数字更糟：
 * 本项目曾手写"87 项断言"，实测是 95。
 *
 * 路径必须相对 __dir 解析，不能依赖 CWD（否则从别的目录跑就找不到 src/）。
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
for (const f of ['core.js', 'integrators.js', 'bh.js', 'sim.js', 'presets.js'])
  vm.runInThisContext(readFileSync(join(SRC, f), 'utf8'), { filename: f });
const GA=globalThis.GA, D={};
function oscErr(g,h){ const s={N:1,px:Float64Array.of(1),py:new Float64Array(1),vx:new Float64Array(1),
  vy:new Float64Array(1),ax:new Float64Array(1),ay:new Float64Array(1),evals:0,
  force:(st,ax,ay)=>{ax[0]=-st.px[0];ay[0]=0;}};
  let mx=0; const steps=Math.round(GA.TAU/h);
  for(let k=0;k<steps;k++){ GA.integrators[g].fn(s,h); mx=Math.max(mx,Math.abs(s.vx[0]**2+s.px[0]**2-1)); }
  return mx; }
const h1=0.02*GA.TAU,h2=0.005*GA.TAU;
D.osc={};
for(const g of ['euler','verlet','pefrl','rk4']){ const a=oscErr(g,h1),b=oscErr(g,h2);
  D.osc[g]={h1:a,h2:b,order:Math.log(a/b)/Math.log(h1/h2)}; }

// ★ 关键：辛 vs 非辛必须在「非闭合系统」上比。
// 八字编舞是周期解，轨道闭合 → 误差不累积，测不出差别（三种方法都 1.0×）。
// 用三体散射构型（chaos 场景）：轨道混沌、能量单调漂移，才能显出本质差别。
function chaosSim(g){ return new GA.Sim({
  px:Float64Array.from([-2.2,2.2,0]), py:Float64Array.from([0.4,-0.4,3.2]),
  vx:Float64Array.from([0.35,0.35,-0.7]), vy:Float64Array.from([1.1,-1.1,0]),
  mass:Float64Array.from([1,1,1]), G:1, eps:0.06, integrator:g, method:'brute', massEps:0}); }
const TOT=20000, W=5000, dt=2e-3;
D.drift={};
for(const g of ['euler','verlet','pefrl','rk4']){
  const a=chaosSim(g); a.snapshot(); a.run(dt,W);
  let ea=0; for(let k=0;k<W;k++){ a.run(dt,1); ea=Math.max(ea,Math.abs(a.drift().dE)); }
  const b=chaosSim(g); b.snapshot(); b.run(dt,TOT-W);
  let eb=0; for(let k=0;k<W;k++){ b.run(dt,1); eb=Math.max(eb,Math.abs(b.drift().dE)); }
  D.drift[g]={early:ea,late:eb,growth:eb/Math.max(ea,1e-300),tEarly:W*dt,tLate:TOT*dt};
}
function bhErr(th,n=200){ const rand=GA.rng(20261004);
  const px=new Float64Array(n),py=new Float64Array(n),m=new Float64Array(n);
  for(let i=0;i<n;i++){px[i]=GA.gaussian(rand)*2;py[i]=GA.gaussian(rand)*2;m[i]=Math.exp(GA.gaussian(rand)*0.5);}
  const eps=0.1,G=1,act=new Uint8Array(n).fill(1);
  const aT=new Float64Array(n),bT=new Float64Array(n);
  const ref=new GA.Sim({px:px.slice(),py:py.slice(),vx:new Float64Array(n),vy:new Float64Array(n),
    mass:m.slice(),G,eps,massEps:0,method:'brute'});
  GA.bruteAccel(ref,aT,bT);
  const tr=new GA.BarnesHut(n*8+64); tr.build(px,py,m,act,th,eps,0);
  const a=new Float64Array(n),b=new Float64Array(n); tr.accel(px,py,m,act,a,b,G,0);
  let se=0,sr=0; for(let i=0;i<n;i++){const ex=a[i]-aT[i],ey=b[i]-bT[i];se+=ex*ex+ey*ey;sr+=aT[i]*aT[i]+bT[i]*bT[i];}
  return Math.sqrt(se/sr); }
D.bh={theta:[0.2,0.4,0.6,0.8],err:[0.2,0.4,0.6,0.8].map(t=>bhErr(t))};
D.bh.slope=GA.logLogSlope(D.bh.theta,D.bh.err);
function bench(N,method){ const rand=GA.rng(4242),G=1,eps=0.05;
  const px=new Float64Array(N),py=new Float64Array(N),vx=new Float64Array(N),vy=new Float64Array(N),m=new Float64Array(N);
  for(let i=0;i<N;i++){const r=Math.pow(rand(),0.5)*10,a=rand()*GA.TAU;
    px[i]=Math.cos(a)*r;py[i]=Math.sin(a)*r;m[i]=100/N;}
  const s=new GA.Sim({px,py,vx,vy,mass:m,G,eps,integrator:'verlet',method,theta:0.5,massEps:0});
  s.run(1e-4,2); return s.run(1e-4,15)/15; }
D.speed={};
for(const N of [500,1000,2000,3000]){ D.speed['brute'+N]=bench(N,'brute'); D.speed['bh'+N]=bench(N,'bh'); }
D.speed.ratio3000=D.speed.brute3000/D.speed.bh3000;
{ const IC=GA.FIGURE8;
  const s=new GA.Sim({px:Float64Array.from([0,1,2].map(i=>IC[i*4])),
    py:Float64Array.from([0,1,2].map(i=>IC[i*4+1])),vx:Float64Array.from([0,1,2].map(i=>IC[i*4+2])),
    vy:Float64Array.from([0,1,2].map(i=>IC[i*4+3])),mass:Float64Array.from([1,1,1]),
    G:1,eps:1e-4,integrator:'pefrl',method:'brute',massEps:0});
  s.snapshot(); s.run(1e-3,Math.round(GA.FIGURE8_PERIOD/1e-3));
  let d=0; for(let i=0;i<3;i++) d=Math.max(d,Math.hypot(s.px[i]-IC[i*4],s.py[i]-IC[i*4+1]));
  D.figure8={period:GA.FIGURE8_PERIOD,loopErr:d,dE:Math.abs(s.drift().dE),dt:1e-3}; }
D.presets=GA.presetOrder.map(k=>{const c=GA.loadPreset(k);
  return {key:k,name:GA.presets[k].name,tag:GA.presets[k].tag,N:c.mass.length,
    method:c.meta.method==='bh'?'Barnes–Hut':'暴力 O(N²)',integ:GA.integrators[c.meta.integrator].label,
    desc:GA.presets[k].desc,verify:GA.presets[k].verify,defaultSpeed:c.preset.defaultSpeed};});
const OUT = join(ROOT, 'slides-data.json');
const prev = JSON.parse(readFileSync(OUT, 'utf8'));
prev.osc = D.osc; prev.drift = D.drift; prev.bh = D.bh; prev.speed = D.speed;
prev.figure8 = D.figure8; prev.presets = D.presets;
writeFileSync(OUT, JSON.stringify(prev, null, 2));
console.log('三体混沌上的能量漂移（前 25% → 后 25% 窗口）:');
for(const [k,v] of Object.entries(D.drift))
  console.log(`  ${k.padEnd(7)} ${v.early.toExponential(2)} → ${v.late.toExponential(2)}   增长 ${v.growth.toFixed(1)}×`);
console.log('BH 误差:', D.bh.err.map(e=>(e*100).toFixed(2)+'%').join('  '), '斜率', D.bh.slope.toFixed(2));
console.log('加速比:', [500,1000,2000,3000].map(N=>`N=${N}:${(D.speed['brute'+N]/D.speed['bh'+N]).toFixed(1)}×`).join('  '));
console.log('谐振子阶数:', Object.entries(D.osc).map(([k,v])=>`${k} ${v.order.toFixed(2)}`).join(' '));
console.log('八字闭环:', D.figure8.loopErr.toExponential(2), 'dE/E', D.figure8.dE.toExponential(2));

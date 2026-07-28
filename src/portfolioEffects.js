export function initPortfolio() {
// =============================================
// LOADER
// =============================================
const loaderMessages = [
  'Initializing Systems...', 'Loading Neural Networks...', 'Compiling Experience...', 'Rendering Universe...'
];
let msgIdx = 0;
const loaderStatus = document.getElementById('loader-status');
const msgInterval = setInterval(() => {
  msgIdx = (msgIdx + 1) % loaderMessages.length;
  loaderStatus.textContent = loaderMessages[msgIdx];
}, 500);

const finishLoading = () => {
  clearInterval(msgInterval);
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 2200);
};

if (document.readyState === 'complete') {
  finishLoading();
} else {
  window.addEventListener('load', finishLoading, { once: true });
}

// =============================================
// SHARED PERF HELPER: pause/resume any rAF loop when its element
// (or the page tab) isn't visible. Cuts CPU/GPU cost to ~0 when off-screen.
// =============================================
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function gatedAnimationLoop(el, frameFn) {
  let running = false;
  let rafId = null;

  function frame(t) {
    if (!running) return;
    frameFn(t);
    rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (running || prefersReducedMotion) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) start(); else stop();
  }, { threshold: 0 });
  io.observe(el);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (el.getBoundingClientRect().top < innerHeight) start();
  });

  return { start, stop };
}

// =============================================
// CURSOR (cheap — one point, left running)
// =============================================
const cursor = document.getElementById('cursor');
const cursorRing = document.getElementById('cursor-ring');
let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

document.addEventListener('mousemove', e => {
  mouseX = e.clientX; mouseY = e.clientY;
  cursor.style.left = mouseX - 6 + 'px';
  cursor.style.top = mouseY - 6 + 'px';
}, { passive: true });

function animateCursor() {
  ringX += (mouseX - ringX - 20) * 0.12;
  ringY += (mouseY - ringY - 20) * 0.12;
  cursorRing.style.left = ringX + 'px';
  cursorRing.style.top = ringY + 'px';
  requestAnimationFrame(animateCursor);
}
if (!prefersReducedMotion) animateCursor();

document.querySelectorAll('a, button, .glass-card, .skill-chip').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.style.transform = 'scale(2)';
    cursorRing.style.width = '60px';
    cursorRing.style.height = '60px';
  });
  el.addEventListener('mouseleave', () => {
    cursor.style.transform = 'scale(1)';
    cursorRing.style.width = '40px';
    cursorRing.style.height = '40px';
  });
});

// =============================================
// SCROLL-DRIVEN 3D HERO TILT (CSS transform only — compositor thread,
// no layout/paint cost). rAF-coalesced so it never runs more than once/frame.
// =============================================
const heroTiltLayer = document.getElementById('heroTiltLayer');
let tiltTicking = false;

function updateHeroTilt() {
  const progress = Math.min(window.scrollY / window.innerHeight, 1); // 0 → 1 over first viewport
  if (heroTiltLayer && !prefersReducedMotion) {
    const rotateX = progress * 10;
    const translateZ = progress * -60;
    const opacity = 1 - progress * 0.6;
    heroTiltLayer.style.transform = `rotateX(${rotateX}deg) translateZ(${translateZ}px)`;
    heroTiltLayer.style.opacity = opacity;
  }
  tiltTicking = false;
}
window.addEventListener('scroll', () => {
  if (!tiltTicking) { requestAnimationFrame(updateHeroTilt); tiltTicking = true; }
}, { passive: true });
updateHeroTilt();

// =============================================
// REAL-TIME 3D BACKGROUND
// Tries Three.js (WebGL, GPU-instanced field, one draw call) first.
// Falls back to a lightweight 2D canvas only if WebGL is unavailable.
// =============================================
let mouse = { x: 0, y: 0 };
document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

async function startThreeBg() {
  const THREE = await import('three');
  const canvas = document.getElementById('bg-canvas-3d');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // never render >2x, no visual gain, real GPU cost

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = 12;

  const COUNT = 220;
  const geometry = new THREE.IcosahedronGeometry(0.045, 0);
  const material = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.55 });
  const field = new THREE.InstancedMesh(geometry, material, COUNT);

  const purpleMaterial = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.45 });
  const purpleGeometry = new THREE.IcosahedronGeometry(0.03, 0);
  const purpleField = new THREE.InstancedMesh(purpleGeometry, purpleMaterial, Math.round(COUNT * 0.4));

  const dummy = new THREE.Object3D();
  for (let i = 0; i < COUNT; i++) {
    dummy.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 11, (Math.random() - 0.5) * 8);
    dummy.updateMatrix();
    field.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < purpleField.count; i++) {
    dummy.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 11, (Math.random() - 0.5) * 8);
    dummy.updateMatrix();
    purpleField.setMatrixAt(i, dummy.matrix);
  }
  scene.add(field, purpleField);

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  const clock = new THREE.Clock();
  const bgLoop = gatedAnimationLoop(canvas, () => {
    const t = clock.getElapsedTime();
    // Ambient rotation — one matrix update per group, not per-particle physics
    field.rotation.y = t * 0.03;
    field.rotation.x = Math.sin(t * 0.05) * 0.1;
    purpleField.rotation.y = -t * 0.02;
    // Subtle parallax toward the cursor, coalesced into the same frame
    camera.position.x += ((mouse.x - innerWidth / 2) * 0.0006 - camera.position.x) * 0.05;
    camera.position.y += ((-(mouse.y - innerHeight / 2)) * 0.0006 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  });
  bgLoop.start();
  canvas.style.display = 'block';

  window.addEventListener('beforeunload', () => {
    field.geometry.dispose(); field.material.dispose();
    purpleField.geometry.dispose(); purpleField.material.dispose();
    renderer.dispose();
  });
}

function startLegacyBg() {
  // Lightweight 2D fallback for browsers without WebGL — reduced particle
  // count + squared-distance early-exit keeps this cheap even without a GPU.
  const bgCanvas = document.getElementById('bg-canvas');
  bgCanvas.style.display = 'block';
  const bgCtx = bgCanvas.getContext('2d');
  let bgW, bgH;

  function resizeBg() {
    bgW = bgCanvas.width = window.innerWidth;
    bgH = bgCanvas.height = window.innerHeight;
  }
  resizeBg();
  window.addEventListener('resize', resizeBg, { passive: true });

  const particles = [];
  const PARTICLE_COUNT = 70; // was 180 — quadratic connection cost, so this alone is ~6x cheaper
  const CONNECT_DIST = 100, CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;

  class BgParticle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * bgW; this.y = Math.random() * bgH;
      this.vx = (Math.random() - 0.5) * 0.4; this.vy = (Math.random() - 0.5) * 0.4;
      this.r = Math.random() * 1.5 + 0.3;
      this.alpha = Math.random() * 0.6 + 0.1;
      this.color = Math.random() > 0.6 ? '#00d4ff' : Math.random() > 0.5 ? '#a855f7' : '#ffffff';
    }
    update() {
      const dx = mouse.x - this.x, dy = mouse.y - this.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 22500) { // 150px radius, no sqrt needed for the threshold check
        const dist = Math.sqrt(distSq) || 1;
        this.vx -= dx / dist * 0.02; this.vy -= dy / dist * 0.02;
      }
      this.vx *= 0.99; this.vy *= 0.99;
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > bgW || this.y < 0 || this.y > bgH) this.reset();
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new BgParticle());

  function drawConnections(ctx) {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dSq = dx * dx + dy * dy;
        if (dSq < CONNECT_DIST_SQ) { // avoid sqrt for the vast majority of pairs that fail this check
          const d = Math.sqrt(dSq);
          ctx.save();
          ctx.globalAlpha = (1 - d / CONNECT_DIST) * 0.12;
          ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  const bgLoop = gatedAnimationLoop(bgCanvas, () => {
    bgCtx.clearRect(0, 0, bgW, bgH);
    drawConnections(bgCtx);
    particles.forEach(p => { p.update(); p.draw(bgCtx); });
  });
  bgLoop.start();
}

if (webglSupported() && !prefersReducedMotion) {
  startThreeBg().catch(() => startLegacyBg()); // network/CDN failure → graceful fallback
} else {
  startLegacyBg();
}

// =============================================
// SKILLS CANVAS
// =============================================
const skills = [
  { name: 'Java', pct: 90, color: '#f89820' },
  { name: 'Spring Boot', pct: 82, color: '#6db33f' },
  { name: 'Python', pct: 85, color: '#ffd43b' },
  { name: 'React', pct: 78, color: '#61dafb' },
  { name: 'Node.js', pct: 76, color: '#68a063' },
  { name: 'SQL/MySQL', pct: 80, color: '#00d4ff' },
  { name: 'Docker', pct: 72, color: '#2496ed' },
  { name: 'TensorFlow', pct: 75, color: '#ff6f00' },
  { name: 'scikit-learn', pct: 78, color: '#f7931e' },
  { name: 'FastAPI', pct: 74, color: '#009688' },
  { name: 'GCP', pct: 68, color: '#4285f4' },
  { name: 'Git/GitHub', pct: 88, color: '#f05032' },
  { name: 'GitHub Actions', pct: 70, color: '#a855f7' },
  { name: 'Linux', pct: 72, color: '#fcc624' },
  { name: 'OpenCV', pct: 70, color: '#00fff5' },
];

// Skill chips
const skillsDetail = document.querySelector('.skills-detail');
skills.forEach(s => {
  const chip = document.createElement('div');
  chip.className = 'skill-chip glass-card';
  chip.innerHTML = `
    <div class="skill-chip-name">${s.name}</div>
    <div class="skill-chip-bar"><div class="skill-chip-fill" data-pct="${s.pct/100}" style="background: linear-gradient(90deg, ${s.color}, #a855f7)"></div></div>
    <div class="skill-chip-pct">${s.pct}%</div>
  `;
  skillsDetail.appendChild(chip);
});

// Skills canvas — floating orb visualization
const sc = document.getElementById('skills-canvas');
const sctx = sc.getContext('2d');
let scW, scH;

function resizeSc() {
  scW = sc.width = sc.parentElement.offsetWidth;
  scH = sc.height = sc.parentElement.offsetHeight;
  initSkillOrbs();
}

let skillOrbs = [];
function initSkillOrbs() {
  skillOrbs = skills.map((s, i) => {
    const angle = (i / skills.length) * Math.PI * 2;
    const radius = Math.min(scW, scH) * 0.32;
    return {
      ...s,
      x: scW/2 + Math.cos(angle) * radius * (0.6 + Math.random()*0.4),
      y: scH/2 + Math.sin(angle) * radius * (0.6 + Math.random()*0.4),
      vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3,
      r: 6 + s.pct * 0.18,
      baseR: 6 + s.pct * 0.18,
      hovered: false,
      phase: Math.random() * Math.PI * 2,
      angle: angle
    };
  });
}

resizeSc();
window.addEventListener('resize', resizeSc);

let scMouse = { x: -9999, y: -9999 };
sc.parentElement.addEventListener('mousemove', e => {
  const rect = sc.getBoundingClientRect();
  scMouse.x = e.clientX - rect.left;
  scMouse.y = e.clientY - rect.top;
});
sc.parentElement.addEventListener('mouseleave', () => { scMouse.x = scMouse.y = -9999; });

function animateSc(t) {
  sctx.clearRect(0, 0, scW, scH);

  // Draw connections
  skillOrbs.forEach((a, i) => {
    skillOrbs.forEach((b, j) => {
      if (j <= i) return;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 180) {
        sctx.save();
        sctx.globalAlpha = (1 - d/180) * 0.15;
        sctx.strokeStyle = '#00d4ff';
        sctx.lineWidth = 1;
        sctx.beginPath(); sctx.moveTo(a.x, a.y); sctx.lineTo(b.x, b.y); sctx.stroke();
        sctx.restore();
      }
    });
  });

  skillOrbs.forEach(o => {
    // Soft float
    o.x += o.vx + Math.sin(t/1200 + o.phase) * 0.3;
    o.y += o.vy + Math.cos(t/1400 + o.phase) * 0.3;
    o.vx *= 0.98; o.vy *= 0.98;

    // Bounds
    const margin = o.r + 10;
    if (o.x < margin) o.vx += 0.2;
    if (o.x > scW - margin) o.vx -= 0.2;
    if (o.y < margin) o.vy += 0.2;
    if (o.y > scH - margin) o.vy -= 0.2;

    // Hover
    const dx = scMouse.x - o.x, dy = scMouse.y - o.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    o.hovered = d < o.r + 20;
    const targetR = o.hovered ? o.baseR * 1.5 : o.baseR;
    o.r += (targetR - o.r) * 0.1;

    // Draw orb
    const grd = sctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    grd.addColorStop(0, o.color + 'cc');
    grd.addColorStop(0.5, o.color + '44');
    grd.addColorStop(1, o.color + '00');
    sctx.beginPath();
    sctx.arc(o.x, o.y, o.r, 0, Math.PI*2);
    sctx.fillStyle = grd;
    sctx.fill();

    // Ring
    sctx.beginPath();
    sctx.arc(o.x, o.y, o.r * 0.55, 0, Math.PI*2);
    sctx.strokeStyle = o.color + (o.hovered ? 'ff' : '88');
    sctx.lineWidth = o.hovered ? 2 : 1;
    sctx.stroke();

    // Label
    sctx.save();
    sctx.globalAlpha = o.hovered ? 1 : 0.7;
    sctx.fillStyle = '#ffffff';
    sctx.font = `${o.hovered ? 600 : 400} ${Math.max(10, o.r * 0.6)}px 'Space Grotesk', sans-serif`;
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText(o.name, o.x, o.y);

    if (o.hovered) {
      sctx.font = `500 11px 'JetBrains Mono', monospace`;
      sctx.fillStyle = o.color;
      sctx.fillText(o.pct + '%', o.x, o.y + o.r * 0.65 + 12);
    }
    sctx.restore();
  });

  requestAnimationFrame(animateSc);
}
requestAnimationFrame(animateSc);

// =============================================
// PROJECT CANVASES
// =============================================
function makeProjectCanvas(id, drawFn) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }
  resize();

  let t = 0;
  function loop() {
    ctx.clearRect(0, 0, w, h);
    drawFn(ctx, w, h, t++);
    requestAnimationFrame(loop);
  }
  loop();
}

// P1: Cybercrime — neon network / data streams
makeProjectCanvas('proj-canvas-1', (ctx, w, h, t) => {
  ctx.fillStyle = 'rgba(0,4,12,0.85)';
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(0,212,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // Neural nodes
  const nodes = [
    {x:0.15,y:0.3}, {x:0.3,y:0.6}, {x:0.5,y:0.25}, {x:0.5,y:0.7},
    {x:0.7,y:0.4}, {x:0.85,y:0.2}, {x:0.85,y:0.7}, {x:0.2,y:0.8}
  ];
  const edges = [[0,2],[0,1],[1,3],[2,4],[3,4],[4,5],[4,6],[1,7]];

  edges.forEach(([a,b]) => {
    const ax = nodes[a].x*w, ay = nodes[a].y*h;
    const bx = nodes[b].x*w, by = nodes[b].y*h;
    // Animated pulse
    const prog = ((t * 1.5 + a * 40) % 120) / 120;
    const px = ax + (bx-ax)*prog, py = ay + (by-ay)*prog;

    ctx.strokeStyle = 'rgba(0,212,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();

    ctx.beginPath(); ctx.arc(px,py,3,0,Math.PI*2);
    ctx.fillStyle = '#00d4ff'; ctx.shadowBlur = 10; ctx.shadowColor = '#00d4ff';
    ctx.fill(); ctx.shadowBlur = 0;
  });

  nodes.forEach((n,i) => {
    const pulse = Math.sin(t/30 + i) * 3;
    const r = 7 + pulse;
    ctx.beginPath(); ctx.arc(n.x*w, n.y*h, r, 0, Math.PI*2);
    const g = ctx.createRadialGradient(n.x*w,n.y*h,0,n.x*w,n.y*h,r*2);
    g.addColorStop(0,'rgba(0,212,255,0.9)'); g.addColorStop(1,'rgba(0,212,255,0)');
    ctx.fillStyle = g; ctx.fill();
  });

  // Text streams
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(0,212,255,0.3)';
  const labels = ['CLASSIFY', 'NLP', '90%', 'TF-IDF', 'PREDICT'];
  labels.forEach((l,i) => {
    const x = (i/labels.length)*w*0.8 + 20;
    const y = (Math.sin(t/60 + i) * 0.1 + 0.5) * h;
    ctx.fillText(l, x, y);
  });
});

// P2: Emotion/ECG — waveform
makeProjectCanvas('proj-canvas-2', (ctx, w, h, t) => {
  ctx.fillStyle = 'rgba(2,8,20,0.88)';
  ctx.fillRect(0, 0, w, h);

  // Soft glow bg
  const cg = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,h*0.5);
  cg.addColorStop(0,'rgba(168,85,247,0.06)'); cg.addColorStop(1,'transparent');
  ctx.fillStyle = cg; ctx.fillRect(0,0,w,h);

  // ECG-style wave
  ctx.beginPath();
  ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
  ctx.shadowBlur = 12; ctx.shadowColor = '#a855f7';
  for (let x = 0; x < w; x++) {
    const phase = (x / w * 4 * Math.PI) + t/30;
    let y = h/2 + Math.sin(phase) * 30;
    if ((x % (w/4)) > (w/4)*0.6 && (x % (w/4)) < (w/4)*0.65) y = h/2 - 70;
    if ((x % (w/4)) > (w/4)*0.65 && (x % (w/4)) < (w/4)*0.7) y = h/2 + 40;
    if ((x % (w/4)) > (w/4)*0.7 && (x % (w/4)) < (w/4)*0.75) y = h/2;
    if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke(); ctx.shadowBlur = 0;

  // CNN layers representation
  const layers = [0.2, 0.38, 0.56, 0.74, 0.88];
  layers.forEach((lx, li) => {
    const x = lx * w;
    const lh = 20 + li * 10;
    for (let i = -2; i <= 2; i++) {
      const y = h/2 + i * (lh/2);
      const alpha = 0.3 + Math.sin(t/40 + li) * 0.2;
      ctx.fillStyle = `rgba(0,255,245,${alpha})`;
      ctx.fillRect(x-2, y-3, 4, 6);
    }
  });

  // Labels
  ctx.font = 'bold 11px Space Grotesk';
  ctx.fillStyle = 'rgba(168,85,247,0.7)';
  ['CNN', 'POOL', 'DENSE', 'SOFTMAX', 'OUT'].forEach((l,i) => {
    ctx.fillText(l, layers[i]*w - 12, h - 16);
  });
});

// P3: E-learning — clean data dashboard
makeProjectCanvas('proj-canvas-3', (ctx, w, h, t) => {
  ctx.fillStyle = 'rgba(2,10,18,0.88)';
  ctx.fillRect(0, 0, w, h);

  const cg = ctx.createRadialGradient(w*0.7,h*0.3,0,w*0.7,h*0.3,w*0.5);
  cg.addColorStop(0,'rgba(0,212,255,0.05)'); cg.addColorStop(1,'transparent');
  ctx.fillStyle = cg; ctx.fillRect(0,0,w,h);

  // Bar chart simulation
  const bars = [0.45, 0.72, 0.58, 0.89, 0.65, 0.94, 0.78];
  const bw = (w*0.55) / (bars.length * 1.4);
  bars.forEach((v, i) => {
    const bh = v * h * 0.55 * (0.9 + Math.sin(t/60+i)*0.1);
    const x = w*0.08 + i * bw * 1.4;
    const y = h * 0.82 - bh;
    const g = ctx.createLinearGradient(0,y,0,y+bh);
    g.addColorStop(0,'rgba(0,212,255,0.9)');
    g.addColorStop(1,'rgba(0,212,255,0.1)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, bw, bh);
  });

  // Baseline
  ctx.strokeStyle = 'rgba(0,212,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*0.06, h*0.82); ctx.lineTo(w*0.92, h*0.82); ctx.stroke();

  // Razorpay / auth badges
  const badges = ['✓ OAuth', '✓ Payments', '✓ GCP', '✓ Live'];
  badges.forEach((b,i) => {
    const x = w*0.62 + (i%2)*w*0.18;
    const y = h*0.18 + Math.floor(i/2)*40;
    const pulse = 0.6 + Math.sin(t/40 + i)*0.3;
    ctx.fillStyle = `rgba(0,255,136,${pulse*0.15})`;
    ctx.strokeStyle = `rgba(0,255,136,${pulse*0.6})`;
    ctx.lineWidth = 1;
    const bw2 = 90, bh2 = 26;
    ctx.fillRect(x, y, bw2, bh2);
    ctx.strokeRect(x, y, bw2, bh2);
    ctx.fillStyle = `rgba(0,255,136,${pulse})`;
    ctx.font = '10px JetBrains Mono';
    ctx.fillText(b, x+10, y+17);
  });
});

// =============================================
// CONTACT CANVAS — starfield + planet
// =============================================
const contactCanvas = document.getElementById('contact-canvas');
const cctx = contactCanvas.getContext('2d');
let ccW, ccH;

function resizeCc() {
  ccW = contactCanvas.width = contactCanvas.offsetWidth;
  ccH = contactCanvas.height = contactCanvas.offsetHeight;
}

const contactSection = document.getElementById('contact');
resizeCc();
window.addEventListener('resize', resizeCc);

const stars = Array.from({length: 200}, () => ({
  x: Math.random(), y: Math.random(),
  r: Math.random() * 1.5 + 0.3,
  alpha: Math.random() * 0.7 + 0.3,
  twinkle: Math.random() * Math.PI * 2
}));

let ccT = 0;
function animateCc() {
  cctx.clearRect(0, 0, ccW, ccH);

  // Stars
  stars.forEach(s => {
    const a = s.alpha * (0.7 + Math.sin(ccT/60 + s.twinkle) * 0.3);
    cctx.save();
    cctx.globalAlpha = a;
    cctx.fillStyle = '#ffffff';
    cctx.beginPath();
    cctx.arc(s.x*ccW, s.y*ccH, s.r, 0, Math.PI*2);
    cctx.fill();
    cctx.restore();
  });

  // Planet
  const px = ccW/2, py = ccH * 0.35, pr = Math.min(ccW, ccH) * 0.12;
  const pg = cctx.createRadialGradient(px-pr*0.3,py-pr*0.3,0,px,py,pr);
  pg.addColorStop(0,'rgba(0,180,220,0.3)');
  pg.addColorStop(0.5,'rgba(0,100,180,0.15)');
  pg.addColorStop(1,'rgba(0,50,100,0.05)');
  cctx.beginPath(); cctx.arc(px, py, pr, 0, Math.PI*2);
  cctx.fillStyle = pg; cctx.fill();

  // Planet ring
  cctx.save();
  cctx.translate(px, py);
  cctx.scale(1, 0.3);
  cctx.beginPath();
  cctx.arc(0, 0, pr*1.6, 0, Math.PI*2);
  cctx.strokeStyle = 'rgba(0,212,255,0.2)'; cctx.lineWidth = 6;
  cctx.stroke();
  cctx.restore();

  // Orbiting dots
  const orbColors = ['#00d4ff','#a855f7','#00ff88','#ffd43b'];
  orbColors.forEach((c,i) => {
    const angle = ccT/120 + (i/orbColors.length)*Math.PI*2;
    const or = pr * 2.2;
    const ox = px + Math.cos(angle)*or;
    const oy = py + Math.sin(angle)*or*0.35;
    cctx.beginPath(); cctx.arc(ox, oy, 5, 0, Math.PI*2);
    cctx.fillStyle = c; cctx.shadowBlur = 12; cctx.shadowColor = c;
    cctx.fill(); cctx.shadowBlur = 0;
  });

  ccT++;
  requestAnimationFrame(animateCc);
}
animateCc();

// =============================================
// SCROLL REVEAL
// =============================================
const revealEls = document.querySelectorAll('.reveal');
const timelineItems = document.querySelectorAll('.timeline-item');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.15 });

revealEls.forEach(el => observer.observe(el));
timelineItems.forEach(el => observer.observe(el));

// =============================================
// COUNTER ANIMATION
// =============================================
const counters = document.querySelectorAll('[data-count]');
const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting && !e.target.dataset.done) {
      e.target.dataset.done = '1';
      const target = parseInt(e.target.dataset.count);
      let current = 0;
      const step = target / 60;
      const interval = setInterval(() => {
        current = Math.min(current + step, target);
        e.target.textContent = Math.round(current) + (target > 9 ? '+' : '');
        if (current >= target) clearInterval(interval);
      }, 20);
    }
  });
}, { threshold: 0.5 });

counters.forEach(c => counterObs.observe(c));

// =============================================
// SKILL BARS ANIMATION
// =============================================
const skillBars = document.querySelectorAll('.skill-chip-fill');
const barObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.transform = `scaleX(${e.target.dataset.pct})`;
      barObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
skillBars.forEach(b => barObs.observe(b));

// =============================================
// SMOOTH SCROLL
// =============================================
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});
}


/* Reel Engine — deterministic 1080x1920 canvas animator.
 * Reel.load(spec) -> total seconds ; Reel.renderAt(t) draws frame at time t.
 * Same input + same t = same frame, so the renderer can capture frame by frame.
 * Visual language: cinematic silhouette characters on glowing gradient worlds,
 * kinetic word-by-word captions, slow camera push, punch-ins, flash/whip cuts,
 * grain + vignette finish. See style/style-profile.md for the rules.
 */
(function () {
  const W = 1080, H = 1920, GROUND = 1450;
  const canvas = document.getElementById('reel');
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;

  // ---------- utils ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOut = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const backOut = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hasDeva = s => /[ऀ-ॿ]/.test(s);

  // ---------- palettes / theme ----------
  const THEME = {
    ink: '#07070f',           // silhouette colour
    accent: '#FFD23F',        // highlighted caption word
    accent2: '#FF6B35',
    text: '#FFFFFF',
  };

  // ---------- backgrounds ----------
  function skyGrad(stops, y0 = -100, y1 = GROUND) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400);
  }
  function glow(x, y, r, color, alpha = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  function hills(baseY, amp, freq, phase, color, drift = 0) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-200, H + 200);
    for (let x = -200; x <= W + 200; x += 12) {
      const y = baseY - amp * (0.6 * Math.sin((x + drift) * freq + phase) + 0.4 * Math.sin((x + drift) * freq * 2.3 + phase * 1.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 200, H + 200); ctx.closePath(); ctx.fill();
  }
  function stars(seed, n, t, maxY = 1100) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * maxY, s = r() * 2.4 + .6, ph = r() * 6.28;
      ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(t * 1.3 + ph));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, s, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function skyline(seed, baseY, minH, maxH, color, windows, t) {
    const r = rng(seed); let x = -150;
    while (x < W + 150) {
      const w = 70 + r() * 120, h = minH + r() * (maxH - minH);
      ctx.fillStyle = color; ctx.fillRect(x, baseY - h, w, h + 400);
      if (windows) {
        for (let wy = baseY - h + 24; wy < baseY - 20; wy += 34) for (let wx = x + 14; wx < x + w - 16; wx += 26) {
          const v = r();
          if (v > .72) { ctx.fillStyle = v > .93 ? 'rgba(255,214,120,.95)' : 'rgba(255,200,100,.55)'; ctx.fillRect(wx, wy, 12, 16); }
        }
      }
      x += w + 6 + r() * 20;
    }
  }
  function particles(seed, n, t, color, rise = 40, size = 3) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x0 = r() * W, y0 = r() * H, sp = .4 + r(), ph = r() * 6.28;
      const y = ((y0 - t * rise * sp) % H + H) % H, x = x0 + Math.sin(t * .6 + ph) * 30;
      ctx.globalAlpha = .25 + .5 * Math.abs(Math.sin(t + ph)); ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, size * (.5 + r()), 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function godRays(cx, cy, t, color, n = 9, alpha = .10) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .03); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      ctx.rotate(6.283 / n); ctx.globalAlpha = alpha * (.6 + .4 * Math.sin(t * .8 + i));
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -1600); ctx.lineTo(60, -1600); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function streetLamp(x, t, color = 'rgba(255,190,110,1)') {
    ctx.fillStyle = THEME.ink; ctx.fillRect(x - 7, GROUND - 520, 14, 520); ctx.fillRect(x - 7, GROUND - 520, 90, 12);
    ctx.fillRect(x + 64, GROUND - 512, 34, 18);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, GROUND - 490, 0, GROUND);
    g.addColorStop(0, 'rgba(255,190,110,.35)'); g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + 70, GROUND - 494); ctx.lineTo(x + 92, GROUND - 494); ctx.lineTo(x + 260, GROUND); ctx.lineTo(x - 100, GROUND); ctx.closePath(); ctx.fill();
    ctx.restore(); glow(x + 81, GROUND - 490, 90, color, .7);
  }
  function stepTop(x) { // staircase ground function: steps rising left -> right
    const sw = 150, sh = 95, i = Math.floor((x + 40) / sw);
    return 1750 - i * sh;
  }

  const BG = {
    dawn_hills(t) {
      skyGrad([[0, '#141a46'], [.45, '#7a3d7a'], [.75, '#ff7e5f'], [1, '#ffc380']]);
      glow(540, 1260, 520, 'rgba(255,200,130,.9)'); godRays(540, 1300, t, 'rgba(255,220,160,1)');
      ctx.fillStyle = '#fff2d6'; ctx.beginPath(); ctx.arc(540, 1300, 120, 0, 6.28); ctx.fill();
      hills(1330, 70, .004, 1, '#6b3768', t * 6); hills(1390, 60, .006, 3, '#3d2150', t * 12); hills(1440, 40, .009, 5, '#1c1030', t * 20);
      ctx.fillStyle = THEME.ink; ctx.fillRect(-200, GROUND, W + 400, 700);
      particles(11, 40, t, 'rgba(255,230,180,1)', 25, 2.5);
    },
    night_city(t) {
      skyGrad([[0, '#03040d'], [.6, '#0d1640'], [1, '#2b3a7a']]);
      stars(7, 140, t, 900); glow(820, 380, 260, 'rgba(180,200,255,.55)');
      ctx.fillStyle = '#e9eeff'; ctx.beginPath(); ctx.arc(820, 380, 70, 0, 6.28); ctx.fill();
      skyline(3, 1250, 250, 650, '#121a3d', true, t); skyline(9, GROUND, 180, 520, '#080c22', true, t);
      ctx.fillStyle = THEME.ink; ctx.fillRect(-200, GROUND, W + 400, 700);
      streetLamp(840, t);
    },
    rain(t) {
      skyGrad([[0, '#0a0d14'], [.7, '#1c2533'], [1, '#33415a']]);
      skyline(5, 1300, 200, 600, '#141b28', true, t);
      ctx.fillStyle = THEME.ink; ctx.fillRect(-200, GROUND, W + 400, 700);
      streetLamp(170, t);
      const r = rng(21); ctx.strokeStyle = 'rgba(190,210,255,.35)'; ctx.lineWidth = 2.2;
      for (let i = 0; i < 220; i++) {
        const x = r() * (W + 300) - 150, sp = 1400 + r() * 900, y = ((r() * H + t * sp) % (H + 200)) - 100;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 14, y + 46); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(160,190,255,.07)'; ctx.fillRect(-200, GROUND, W + 400, 12);
    },
    room_night(t) {
      skyGrad([[0, '#0b0e20'], [1, '#161b38']], 0, H);
      // window
      ctx.fillStyle = '#1d2a5e'; ctx.fillRect(110, 380, 330, 430);
      ctx.save(); ctx.beginPath(); ctx.rect(110, 380, 330, 430); ctx.clip(); stars(4, 25, t, 820);
      ctx.fillStyle = '#e9eeff'; ctx.beginPath(); ctx.arc(330, 480, 46, 0, 6.28); ctx.fill(); ctx.restore();
      ctx.strokeStyle = THEME.ink; ctx.lineWidth = 16; ctx.strokeRect(110, 380, 330, 430);
      ctx.beginPath(); ctx.moveTo(275, 380); ctx.lineTo(275, 810); ctx.moveTo(110, 595); ctx.lineTo(440, 595); ctx.stroke();
      // wall clock
      ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(830, 520, 70, 0, 6.28); ctx.stroke();
      ctx.save(); ctx.translate(830, 520); ctx.lineWidth = 8; ctx.rotate(t * 1.2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -52); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(830, 520); ctx.lineWidth = 10; ctx.rotate(2.4 + t * .1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -34); ctx.stroke(); ctx.restore();
      // desk + laptop glow
      ctx.fillStyle = THEME.ink; ctx.fillRect(470, 1180, 560, 26); ctx.fillRect(500, 1200, 22, 260); ctx.fillRect(980, 1200, 22, 260);
      ctx.save(); ctx.translate(760, 1180); ctx.fillRect(-120, -8, 240, 10); ctx.rotate(-0.2); ctx.fillRect(-120, -170, 14, 170); ctx.restore();
      glow(700, 1080, 380, 'rgba(120,180,255,.55)', .6 + .1 * Math.sin(t * 3));
      ctx.fillStyle = THEME.ink; ctx.fillRect(-200, GROUND, W + 400, 700);
      particles(31, 25, t, 'rgba(150,190,255,1)', 10, 2);
    },
    mountain_peak(t) {
      skyGrad([[0, '#1b1446'], [.5, '#c4467a'], [.8, '#ff9a5a'], [1, '#ffd38a']], -100, 1500);
      glow(540, 900, 600, 'rgba(255,210,140,.7)'); godRays(540, 900, t, 'rgba(255,230,170,1)', 12, .12);
      ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.arc(540, 920, 100, 0, 6.28); ctx.fill();
      hills(1600, 140, .003, 2, '#5a2a5e', t * 5);
      ctx.fillStyle = THEME.ink; ctx.beginPath(); ctx.moveTo(-200, H + 200); ctx.lineTo(-200, 1820); ctx.lineTo(370, 1500); ctx.lineTo(540, 1420); ctx.lineTo(710, 1500); ctx.lineTo(1280, 1800); ctx.lineTo(1280, H + 200); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,230,.18)';
      for (let i = 0; i < 5; i++) { const cx = ((i * 330 + t * 30) % 1600) - 300; ctx.beginPath(); ctx.ellipse(cx, 1700 + i * 40, 260, 40, 0, 0, 6.28); ctx.fill(); }
      particles(13, 30, t, 'rgba(255,240,200,1)', 20, 2.5);
    },
    road(t) {
      const HZ = 1480;
      skyGrad([[0, '#20154a'], [.55, '#e0567a'], [1, '#ffb36b']], -100, HZ);
      glow(540, HZ - 30, 560, 'rgba(255,190,120,.85)'); godRays(540, HZ, t, 'rgba(255,220,170,1)', 9, .07);
      ctx.fillStyle = '#ffe9c4'; ctx.beginPath(); ctx.arc(540, HZ, 150, 3.14, 6.28); ctx.fill();
      hills(HZ, 26, .01, 1, '#2a1638', 0);
      ctx.fillStyle = '#0d0a17'; ctx.fillRect(-200, HZ, W + 400, 900);
      ctx.fillStyle = '#1d1729'; ctx.beginPath(); ctx.moveTo(525, HZ); ctx.lineTo(555, HZ); ctx.lineTo(1250, H + 100); ctx.lineTo(-170, H + 100); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,150,.85)';
      for (let i = 0; i < 12; i++) {
        const k = ((i / 12) + t * .25) % 1, z = k * k, y = HZ + z * 460, w = 3 + z * 22, h = 5 + z * 60;
        ctx.fillRect(540 - w / 2, y, w, h);
      }
    },
    staircase(t) {
      skyGrad([[0, '#0e1236'], [.6, '#3b2a78'], [1, '#e07b6a']], -100, 1700);
      glow(900, 500, 420, 'rgba(255,200,150,.55)'); stars(17, 60, t, 700);
      ctx.fillStyle = '#ffe1b8'; ctx.beginPath(); ctx.arc(900, 500, 80, 0, 6.28); ctx.fill();
      ctx.fillStyle = THEME.ink;
      for (let x = -150; x < W + 200; x += 150) { const y = stepTop(x + 1); ctx.fillRect(x - 40 + 0, y, 152, H - y + 300); }
      particles(19, 30, t, 'rgba(255,220,180,1)', 30, 2.5);
    },
    void(t) {
      ctx.fillStyle = '#040408'; ctx.fillRect(-200, -200, W + 400, H + 400);
      glow(540, 1050, 820, 'rgba(255,190,90,.24)'); glow(540, 1250, 420, 'rgba(255,220,150,.22)');
      particles(23, 60, t, 'rgba(255,210,150,1)', 18, 2.2);
      ctx.fillStyle = 'rgba(255,200,120,.06)'; ctx.beginPath(); ctx.ellipse(540, GROUND + 20, 320, 40, 0, 0, 6.28); ctx.fill();
    },
  };
  const RIM = { void: 'rgba(255,190,110,.75)', room_night: 'rgba(130,180,255,.6)', night_city: 'rgba(150,180,255,.55)', rain: 'rgba(170,200,255,.5)', road: 'rgba(255,170,120,.6)' };
  function groundAt(bg, x) {
    if (bg === 'staircase') return stepTop(x);
    if (bg === 'mountain_peak') return x < 540 ? lerp(1500, 1420, clamp((x - 370) / 170, 0, 1)) : lerp(1420, 1500, clamp((x - 540) / 170, 0, 1));
    if (bg === 'road') return 1760;
    return GROUND;
  }

  // ---------- characters (parametric silhouettes) ----------
  const L = { thigh: 115, shin: 112, torso: 155, neck: 16, head: 40, ua: 92, fa: 86 };
  const STATIC = {
    stand: { lean: 0, head: 0, ls: .10, le: .15, rs: -.06, re: .12, lh: .06, lk: 0, rh: -.06, rk: 0 },
    sad: { lean: .38, head: .55, ls: .02, le: .05, rs: -.02, re: .05, lh: .05, lk: .05, rh: -.04, rk: .05 },
    think: { lean: .02, head: .12, ls: .25, le: 2.55, rs: -.05, re: .2, lh: .06, lk: 0, rh: -.06, rk: 0 },
    look_up: { lean: -.12, head: -.55, ls: .12, le: .1, rs: -.1, re: .1, lh: .05, lk: 0, rh: -.08, rk: 0 },
    point: { lean: .05, head: -.05, ls: 1.5, le: 0, rs: -.1, re: .15, lh: .12, lk: 0, rh: -.12, rk: 0 },
    celebrate: { lean: -.12, head: -.35, ls: 2.75, le: -.15, rs: -2.75, re: .15, lh: .14, lk: 0, rh: -.14, rk: 0 },
    kneel: { lean: .45, head: .5, ls: .55, le: .2, rs: .2, re: .3, lh: 1.55, lk: 1.55, rh: .15, rk: 1.6, dy: 95 },
    sit: { lean: .12, head: .15, ls: 1.05, le: .55, rs: .95, re: .65, lh: 1.55, lk: 1.55, rh: 1.5, rk: 1.5, dy: 100 },
    reach: { lean: -.05, head: -.4, ls: 2.9, le: 0, rs: .1, re: .2, lh: .3, lk: .5, rh: -.1, rk: 0 },
  };
  function poseAt(name, t) {
    if (name === 'walk' || name === 'run' || name === 'climb') {
      const run = name === 'run', sp = run ? 9 : 5.2, p = t * sp, a = run ? .75 : .42;
      const s = Math.sin(p), c = Math.cos(p);
      return {
        lean: run ? .28 : (name === 'climb' ? .18 : .05), head: run ? -.05 : .02,
        ls: -a * s * (run ? 1.1 : 1), le: run ? 1.5 : .25, rs: a * s * (run ? 1.1 : 1), re: run ? 1.5 : .25,
        lh: a * s, lk: Math.max(0, -c) * (run ? 1.5 : .8) + .05, rh: -a * s, rk: Math.max(0, c) * (run ? 1.5 : .8) + .05,
        dy: -Math.abs(c) * (run ? 16 : 7),
      };
    }
    const base = Object.assign({}, STATIC[name] || STATIC.stand), br = Math.sin(t * 2.2);
    base.head += br * .02; base.ls += br * .03; base.rs -= br * .03;
    if (name === 'celebrate') { const pump = Math.abs(Math.sin(t * 4)) * .25; base.ls -= pump; base.rs += pump; base.dy = -Math.abs(Math.sin(t * 4)) * 14; }
    if (name === 'kneel') base.lean += Math.sin(t * 1.4) * .03;
    return base;
  }
  function limb(x, y, a1, l1, a2, l2, f, w) {
    const ex = x + Math.sin(a1) * l1 * f, ey = y + Math.cos(a1) * l1;
    const hx = ex + Math.sin(a1 + a2) * l2 * f, hy = ey + Math.cos(a1 + a2) * l2;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    return [hx, hy];
  }
  function drawFigure(c, t, bg) {
    const who = c.who || 'hero', f = c.face || 1, s = (c.scale || 1) * (SPEC.char_scale || 1.45);
    const pose = poseAt(c.pose || 'stand', t + (c.phase || 0));
    const x = c._x, gy = c.y != null ? c.y * H : groundAt(bg, x);
    const mentor = who === 'mentor';
    if (mentor) { pose.lean += .18; pose.head += .1; }
    ctx.save(); ctx.translate(x, gy); ctx.scale(s, s); ctx.translate(-x, -gy);
    const legLen = L.thigh + L.shin, hipX = x, hipY = gy - legLen + (pose.dy || 0);
    const col = who === 'crowd' ? 'rgba(10,10,20,.55)' : THEME.ink;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (who !== 'crowd') { ctx.shadowColor = RIM[bg] || 'rgba(255,200,140,.45)'; ctx.shadowBlur = 28; }
    if (c.pose === 'sit') { ctx.fillRect(hipX - 60, hipY + 18, 120, 18); ctx.fillRect(hipX - 10, hipY + 30, 20, gy - hipY - 30); ctx.fillRect(hipX - 60, gy - 12, 120, 12); }
    // legs
    limb(hipX, hipY, pose.rh, L.thigh, -pose.rk, L.shin, f, 30);
    limb(hipX, hipY, pose.lh, L.thigh, -pose.lk, L.shin, f, 30);
    // torso
    const tx = hipX + Math.sin(pose.lean) * L.torso * f, ty = hipY - Math.cos(pose.lean) * L.torso;
    ctx.lineWidth = 50; ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(tx, ty); ctx.stroke();
    if (mentor) { // long robe
      ctx.beginPath(); ctx.moveTo(tx - 30 * f, ty + 10); ctx.lineTo(tx + 30 * f, ty + 10); ctx.lineTo(hipX + 70 * f, hipY + 150); ctx.lineTo(hipX - 70 * f, hipY + 150); ctx.closePath(); ctx.fill();
    }
    if (who === 'hero') { // backpack = identity marker
      ctx.save(); ctx.translate((hipX + tx) / 2, (hipY + ty) / 2); ctx.rotate(pose.lean * f);
      ctx.beginPath(); ctx.roundRect(f > 0 ? -82 : 38, -62, 44, 110, 14); ctx.fill(); ctx.restore();
    }
    // head
    const ha = pose.lean + pose.head, nx = tx + Math.sin(pose.lean) * L.neck * f, ny = ty - Math.cos(pose.lean) * L.neck;
    const hx = nx + Math.sin(ha) * L.head * f, hy = ny - Math.cos(ha) * L.head;
    ctx.beginPath(); ctx.arc(hx, hy, L.head, 0, 6.28); ctx.fill();
    if (mentor) { // beard
      ctx.beginPath(); ctx.moveTo(hx + 10 * f, hy + 20); ctx.lineTo(hx + 40 * f, hy + 30); ctx.lineTo(hx + 12 * f, hy + 92); ctx.closePath(); ctx.fill();
    } else { // hair tuft
      ctx.beginPath(); ctx.moveTo(hx - 34 * f, hy - 18); ctx.quadraticCurveTo(hx - 10 * f, hy - 70, hx + 40 * f, hy - 28); ctx.lineTo(hx + 10 * f, hy - 30); ctx.closePath(); ctx.fill();
    }
    // arms
    const back = limb(tx, ty + 8, pose.rs, L.ua, pose.re, L.fa, f, 26);
    const front = limb(tx, ty + 8, pose.ls, L.ua, pose.le, L.fa, f, 26);
    if (mentor) { ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(front[0], front[1] - 30); ctx.lineTo(front[0] + 20 * f, gy); ctx.stroke(); }
    if (c.holds === 'phone') { ctx.save(); ctx.fillStyle = '#cfe3ff'; ctx.shadowColor = '#9cc3ff'; ctx.shadowBlur = 40; ctx.fillRect(front[0] - 14, front[1] - 30, 28, 48); ctx.restore(); }
    if (c.holds === 'flag') { ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(front[0], front[1] + 40); ctx.lineTo(front[0], front[1] - 260); ctx.stroke(); ctx.fillStyle = THEME.accent2; ctx.beginPath(); const w = Math.sin(t * 6) * 12; ctx.moveTo(front[0], front[1] - 260); ctx.quadraticCurveTo(front[0] + 70 * f, front[1] - 250 + w, front[0] + 140 * f, front[1] - 230); ctx.lineTo(front[0], front[1] - 180); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  // ---------- props ----------
  const PROPS = {
    door(p, t) { // glowing doorway = opportunity
      const x = p.x * W, y = groundAt(p._bg, x);
      glow(x, y - 210, 420, 'rgba(255,210,140,.75)', .8 + .1 * Math.sin(t * 2));
      ctx.fillStyle = '#fff3d6'; ctx.fillRect(x - 95, y - 420, 190, 420);
      ctx.strokeStyle = THEME.ink; ctx.lineWidth = 18; ctx.strokeRect(x - 104, y - 429, 208, 438);
    },
    coins(p, t) {
      const x = p.x * W, y = groundAt(p._bg, x), n = p.n || 5;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#f2b705' : '#ffd23f'; ctx.beginPath(); ctx.ellipse(x, y - 14 - i * 22, 70, 22, 0, 0, 6.28); ctx.fill(); ctx.fillStyle = '#c48a00'; ctx.fillRect(x - 70, y - 14 - i * 22, 140, 8); }
      glow(x, y - n * 11, 200, 'rgba(255,210,60,.5)');
    },
    trophy(p, t) {
      const x = p.x * W, y = (p.y != null ? p.y * H : groundAt(p._bg, x));
      glow(x, y - 140, 260, 'rgba(255,210,60,.6)');
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(x - 80, y - 240); ctx.lineTo(x + 80, y - 240); ctx.quadraticCurveTo(x + 70, y - 120, x, y - 100); ctx.quadraticCurveTo(x - 70, y - 120, x - 80, y - 240); ctx.fill();
      ctx.fillRect(x - 12, y - 110, 24, 70); ctx.fillRect(x - 60, y - 44, 120, 34);
    },
    wall(p, t) { // obstacle
      const x = p.x * W, y = groundAt(p._bg, x), h = (p.h || .25) * H;
      ctx.fillStyle = '#1b1b2a'; ctx.fillRect(x - 70, y - h, 140, h);
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 4;
      for (let yy = y - h; yy < y; yy += 50) { ctx.beginPath(); ctx.moveTo(x - 70, yy); ctx.lineTo(x + 70, yy); ctx.stroke(); }
    },
    chain(p, t) { // broken chain / shackles
      const x = p.x * W, y = groundAt(p._bg, x) - 30;
      ctx.strokeStyle = '#8a8fa8'; ctx.lineWidth = 12;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x - 120 + i * 70, y - (i % 2) * 6, 34, 20, i % 2 ? .3 : 0, 0, 6.28); ctx.stroke(); }
    },
  };

  // ---------- captions ----------
  function fontFor(str, px) { return `800 ${px}px ${hasDeva(str) ? "'NotoDeva', 'Poppins'" : "'Poppins', 'NotoDeva'"}`; }
  function layoutWords(words, px, maxW) {
    const lines = [[]]; let lw = 0;
    words.forEach(w => {
      ctx.font = fontFor(w.w, px); const ww = ctx.measureText(w.w + ' ').width;
      if (lw + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push(Object.assign({ width: ctx.measureText(w.w).width, space: ww - ctx.measureText(w.w).width }, w)); lw += ww;
    });
    return lines;
  }
  function chunkWords(words, maxWords = 4) { // split into on-screen chunks
    const chunks = []; let cur = [];
    words.forEach(w => { cur.push(w); if (cur.length >= maxWords || /[.,!?।]$/.test(w.w)) { chunks.push(cur); cur = []; } });
    if (cur.length) chunks.push(cur); return chunks;
  }
  function drawCaption(scene, lt) {
    if (!scene._words || !scene._words.length) return;
    const chunk = scene._chunks.find(ch => lt >= ch[0].start - .05 && lt < (ch._end)) || null;
    if (!chunk) return;
    const px = scene.caption_size || 86, lines = layoutWords(chunk, px, 900), lh = px * 1.28;
    let y = (scene.caption_y || .33) * H - (lines.length - 1) * lh / 2;
    lines.forEach(line => {
      const total = line.reduce((a, w) => a + w.width + w.space, 0) - line[line.length - 1].space;
      let x = W / 2 - total / 2;
      line.forEach(w => {
        const k = clamp((lt - w.start) / .22, 0, 1); if (k <= 0) { x += w.width + w.space; return; }
        const active = lt >= w.start && lt < w.end + .05, emph = w.emph;
        const sc = backOut(k) * (emph ? 1.12 : 1);
        ctx.save(); ctx.translate(x + w.width / 2, y); ctx.scale(sc, sc);
        ctx.font = fontFor(w.w, px); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(w.w, 0, 0);
        ctx.fillStyle = (emph || active) ? THEME.accent : THEME.text;
        if (emph) { ctx.shadowColor = THEME.accent; ctx.shadowBlur = 30; }
        ctx.globalAlpha = k; ctx.fillText(w.w, 0, 0); ctx.restore();
        x += w.width + w.space;
      });
      y += lh;
    });
  }
  function drawBigText(scene, lt) {
    const b = scene.bigtext; if (!b) return;
    const k = clamp((lt - (scene.bigtext_at || 0)) / .35, 0, 1); if (k <= 0) return;
    const px = scene.bigtext_size || 230, sc = lerp(1.6, 1, easeOut(k)) + Math.sin(lt * 2) * .01;
    ctx.save(); ctx.translate(W / 2, (scene.bigtext_y || .45) * H); ctx.scale(sc, sc); ctx.globalAlpha = k;
    ctx.font = fontFor(b, px); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = THEME.accent; ctx.shadowBlur = 60; ctx.fillStyle = THEME.accent; ctx.fillText(b, 0, 0);
    ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.strokeText(b, 0, 0); ctx.restore();
  }
  function drawKicker(scene, lt) { // small label above caption, e.g. "STORY • 1%"
    if (!scene.kicker) return; const k = clamp(lt / .4, 0, 1);
    ctx.save(); ctx.globalAlpha = k; ctx.font = fontFor(scene.kicker, 40); ctx.textAlign = 'center';
    const w = ctx.measureText(scene.kicker).width + 60, y = (scene.caption_y || .33) * H - 190;
    ctx.fillStyle = THEME.accent2; ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - 38, w, 70, 35); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(scene.kicker, W / 2, y - 2); ctx.restore();
  }

  // ---------- finish: vignette + grain ----------
  const grain = document.createElement('canvas'); grain.width = 512; grain.height = 512;
  (function () { const g = grain.getContext('2d'), id = g.createImageData(512, 512), r = rng(99); for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 22; } g.putImageData(id, 0, 0); })();
  function finish(t) {
    const v = ctx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const r = rng(Math.floor(t * 24) + 1), ox = -r() * 512, oy = -r() * 512;
    ctx.save(); ctx.globalCompositeOperation = 'overlay';
    for (let x = ox; x < W; x += 512) for (let y = oy; y < H; y += 512) ctx.drawImage(grain, x, y);
    ctx.restore();
  }

  // ---------- timeline ----------
  let SPEC = null, total = 0;
  function prepScene(s, i) {
    s.duration = s.duration || 3;
    let words = s.words;
    if (!words) { // spread caption words evenly, longer words get more time
      const toks = (s.caption || '').split(/\s+/).filter(Boolean);
      const weights = toks.map(w => .5 + w.length * .12), sum = weights.reduce((a, b) => a + b, 0) || 1;
      const span = Math.max(.5, s.duration - .45); let acc = .2;
      words = toks.map((w, j) => { const d = weights[j] / sum * span, o = { w, start: acc, end: acc + d }; acc += d; return o; });
    }
    const emph = (s.emphasis || []).map(e => e.toLowerCase());
    s._words = words.map(w => Object.assign({}, w, { emph: emph.includes(w.w.toLowerCase().replace(/[.,!?।"']/g, '')) }));
    s._chunks = chunkWords(s._words, s.chunk || 4);
    s._chunks.forEach((ch, j) => { const nxt = s._chunks[j + 1]; ch._end = nxt ? nxt[0].start - .02 : s.duration + 1; });
    s._punches = s._words.filter(w => w.emph).map(w => w.start);
  }
  function load(spec) {
    SPEC = spec; total = 0;
    if (spec.theme) Object.assign(THEME, spec.theme);
    spec.scenes.forEach((s, i) => { prepScene(s, i); s._t0 = total; total += s.duration; });
    return total;
  }
  function sceneAt(t) { const ss = SPEC.scenes; for (let i = 0; i < ss.length; i++) if (t < ss[i]._t0 + ss[i].duration) return [ss[i], i]; return [ss[ss.length - 1], ss.length - 1]; }

  function renderAt(t) {
    const [s, idx] = sceneAt(t), lt = t - s._t0, k = clamp(lt / s.duration, 0, 1);
    const cam = s.camera || {}, z0 = cam.zoom ? cam.zoom[0] : 1.0, z1 = cam.zoom ? cam.zoom[1] : 1.08;
    let zoom = lerp(z0, z1, easeInOut(k));
    s._punches.forEach(p => { const d = lt - p; if (d > 0 && d < .5) zoom += .05 * Math.sin(d / .5 * Math.PI); });
    let px = cam.pan ? lerp(cam.pan[0], cam.pan[1], easeInOut(k)) * W : 0, py = 0;
    const tr = s.transition || (idx === 0 ? 'none' : 'cut'), tk = clamp(lt / .35, 0, 1);
    if (tr === 'whip' && tk < 1) px += (1 - easeOut(tk)) * W * .9;
    if (tr === 'zoom' && tk < 1) zoom *= lerp(1.7, 1, easeOut(tk));
    if (cam.shake || (tr === 'flash' && lt < .3)) { const a = (cam.shake || 1) * 9 * (tr === 'flash' && lt < .3 ? (1 - lt / .3) * 3 : 1), r = rng(Math.floor(t * 30)); px += (r() - .5) * a * 2; py += (r() - .5) * a * 2; }
    const fx = cam.focus ? cam.focus[0] * W : W / 2, fy = cam.focus ? cam.focus[1] * H : H * .55;

    ctx.save(); ctx.clearRect(0, 0, W, H);
    if ((tr === 'whip' || tr === 'zoom') && tk < 1) ctx.filter = `blur(${(1 - tk) * 22}px)`;
    ctx.translate(fx + px, fy + py); ctx.scale(zoom, zoom); ctx.translate(-fx, -fy);
    (BG[s.bg] || BG.void)(t);
    (s.props || []).forEach(p => { p._bg = s.bg; (PROPS[p.type] || (() => { }))(p, t); });
    (s.characters || []).forEach(c => {
      const mk = c.move_ease === 'linear' ? k : easeInOut(k);
      c._x = lerp(c.x != null ? c.x : .5, c.to_x != null ? c.to_x : (c.x != null ? c.x : .5), mk) * W;
      drawFigure(c, lt, s.bg);
    });
    ctx.restore(); ctx.filter = 'none';

    drawKicker(s, lt); drawBigText(s, lt); drawCaption(s, lt);
    if (tr === 'flash' && lt < .3) { ctx.fillStyle = `rgba(255,255,255,${.9 * (1 - lt / .3)})`; ctx.fillRect(0, 0, W, H); }
    if (tr === 'fade' && lt < .45) { ctx.fillStyle = `rgba(0,0,0,${1 - lt / .45})`; ctx.fillRect(0, 0, W, H); }
    const outK = (s._t0 + s.duration) - t; // fade to black at very end
    if (idx === SPEC.scenes.length - 1 && outK < .5) { ctx.fillStyle = `rgba(0,0,0,${1 - outK / .5})`; ctx.fillRect(0, 0, W, H); }
    finish(t);
    if (SPEC.watermark) { ctx.save(); ctx.globalAlpha = .55; ctx.font = "600 34px 'Poppins'"; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(SPEC.watermark, W / 2, H - 330); ctx.restore(); }
  }

  window.Reel = { load, renderAt, get duration() { return total; }, W, H };
})();

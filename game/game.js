/**
 * Dark World — playable prototype
 *
 *   1. Save data (localStorage, optional)
 *   2. Art (soft-edged demon paintings)
 *   3. Map: Kensington + Fishtown, rifts along the El, simulated walking
 *   4. Fight: tap to attack, change lanes to dodge, abilities, AI hunters
 *   5. Results: XP, levels, loot, the Kensington war meter, the season finale
 *
 * Prototype limits: walking is simulated (no GPS) and the other hunters are AI.
 * Real GPS and real players need a game server; that is the next step.
 */

(function () {
  'use strict';

  /* ─── 1. SAVE DATA ───────────────────────────────────────────────────── */

  const SAVE_KEY = 'dark-world-save-v1';
  const fresh = () => ({ lvl: 1, xp: 0, gear: 0, war: 0, season: 1, wins: 0, pos: { x: 140, y: 400 }, items: [] });
  let save = fresh();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) save = Object.assign(fresh(), JSON.parse(raw));
  } catch (e) { /* storage blocked: play without saving */ }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }
  const xpNeed = lvl => 100 + 60 * (lvl - 1);

  /* ─── 2. ART ─────────────────────────────────────────────────────────── */

  const ART = window.DW_ART || {};
  const gateImg = loadImg(ART.gate);
  const bossArt = {};
  softEdge('wraith', ART.wraith, 0.46, 0.44, 0.5);
  softEdge('mask', ART.mask, 0.5, 0.36, 0.42);

  function loadImg(src) {
    const img = new Image();
    if (src) img.src = src;
    return img;
  }
  // Fade each painting's edges so the demon floats in the dark instead of sitting in a square.
  function softEdge(key, src, cx, cy, r) {
    const img = loadImg(src);
    img.onload = () => {
      const s = 512, off = document.createElement('canvas');
      off.width = off.height = s;
      const o = off.getContext('2d');
      o.drawImage(img, 0, 0, s, s);
      o.globalCompositeOperation = 'destination-in';
      const g = o.createRadialGradient(s * cx, s * cy, s * 0.06, s * cx, s * cy, s * r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = g;
      o.fillRect(0, 0, s, s);
      bossArt[key] = off;
    };
  }

  const BOSSES = {
    wraith: { name: 'Rift Wraith', art: 'wraith' },
    mask: { name: 'The Hollow Gentleman', art: 'mask' }
  };

  /* ─── 3. MAP ─────────────────────────────────────────────────────────── */

  // Placeholder names and spots, roughly where they sit along the El. Lore to come.
  const RIFTS = [
    { id: 'huntingdon', name: 'Huntingdon Station', place: 'Under the El', x: 165, y: 310, lvl: 1, boss: 'wraith', party: 4 },
    { id: 'somerset', name: 'Somerset Station', place: 'Under the El', x: 215, y: 225, lvl: 2, boss: 'wraith', party: 4 },
    { id: 'ka', name: 'Kensington & Allegheny', place: 'Under the El', x: 290, y: 95, lvl: 3, boss: 'mask', party: 4 },
    { id: 'frankford', name: 'Frankford & Girard', place: 'Fishtown', x: 222, y: 552, lvl: 2, boss: 'mask', party: 4 },
    { id: 'palmer', name: 'Palmer Burial Ground', place: 'Fishtown', x: 205, y: 470, lvl: 3, boss: 'wraith', party: 4 },
    { id: 'treaty', name: 'Penn Treaty Park', place: 'Greater rift · riverfront', x: 282, y: 505, lvl: 4, boss: 'wraith', party: 8, greater: true },
    { id: 'finale', name: 'The Last Night', place: 'Season finale', x: 92, y: 170, lvl: 6, boss: 'mask', party: 12, finale: true }
  ];
  const RANGE = 40;        // map units you must be within to join
  const METERS = 4;        // meters per map unit, for display

  const $ = id => document.getElementById(id);
  const svg = $('map');
  let selected = null, walking = null;

  function drawMap() {
    const streets = [];
    for (let i = -6; i < 26; i++) streets.push(`<line x1="-100" y1="${i * 30}" x2="500" y2="${i * 30 - 60}"/>`);
    for (let i = -6; i < 20; i++) streets.push(`<line x1="${i * 30}" y1="-40" x2="${i * 30 + 70}" y2="660"/>`);
    const riftEls = RIFTS.map(r => {
      const locked = r.finale && save.war < 100;
      const hot = r.finale ? '#ffd27a' : r.greater ? '#ff5a2a' : '#ff7a2e';
      const size = r.finale ? 13 : r.greater ? 11 : 8;
      return `<g class="rift${locked ? ' locked' : ''}" data-id="${r.id}" tabindex="0" role="button" aria-label="${r.name}">
        <circle cx="${r.x}" cy="${r.y}" r="${size * 4}" fill="url(#glow)" opacity="${locked ? 0.25 : 0.9}"/>
        <circle class="core" cx="${r.x}" cy="${r.y}" r="${size}" fill="${locked ? '#4a3a34' : hot}" stroke="#fff3d6" stroke-opacity=".6" stroke-width="1.2"/>
        <text x="${r.x}" y="${r.y + size + 14}" text-anchor="middle" class="rlabel" fill="${locked ? '#6d5d56' : '#efe6dc'}">${r.finale ? (locked ? 'The Last Night · locked' : 'The Last Night') : r.name}</text>
        <circle cx="${r.x}" cy="${r.y}" r="26" fill="transparent"/>
      </g>`;
    }).join('');
    svg.innerHTML = `
      <defs>
        <radialGradient id="glow"><stop offset="0" stop-color="#ff7a2e" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a2e" stop-opacity="0"/></radialGradient>
        <radialGradient id="me-glow"><stop offset="0" stop-color="#ffb15c" stop-opacity=".5"/><stop offset="1" stop-color="#ffb15c" stop-opacity="0"/></radialGradient>
        <style>
          .rlabel { font: 600 10.5px "IBM Plex Sans Condensed", Arial, sans-serif; letter-spacing: .02em; paint-order: stroke; stroke: #0d0909; stroke-width: 3px; }
          .hood { font: 500 10px "IBM Plex Mono", monospace; letter-spacing: .3em; fill: #5e4c46; }
          .st { font: 500 8.5px "IBM Plex Mono", monospace; letter-spacing: .08em; fill: #6d5d56; }
        </style>
      </defs>
      <clipPath id="frame"><rect width="390" height="600" rx="16"/></clipPath>
      <rect width="390" height="600" fill="#0d0909" rx="16"/>
      <g clip-path="url(#frame)">
      <g stroke="#1a1312" stroke-width="1">${streets.join('')}</g>
      <polygon points="230,600 390,400 390,600" fill="#0b1220" stroke="#1d2c47" stroke-width="2"/>
      <text class="hood" x="330" y="560" fill="#2c3d60" transform="rotate(-51 330 560)" style="fill:#2c3d60">DELAWARE RIVER</text>
      <line x1="0" y1="555" x2="236" y2="555" stroke="#2a1e1c" stroke-width="3"/>
      <text class="st" x="8" y="548">GIRARD AVE</text>
      <line x1="210" y1="600" x2="370" y2="260" stroke="#2a1e1c" stroke-width="3"/>
      <text class="st" x="318" y="352" transform="rotate(-64 318 352)">FRANKFORD AVE</text>
      <polyline points="120,600 120,560 122,470 125,380 165,310 215,225 290,95 330,28" fill="none" stroke="#2e2220" stroke-width="7" stroke-linejoin="round"/>
      <polyline points="120,600 120,560 122,470 125,380 165,310 215,225 290,95 330,28" fill="none" stroke="#6a4c42" stroke-width="1.5" stroke-dasharray="2 4" stroke-linejoin="round"/>
      <text class="st" x="68" y="474">BERKS</text>
      <text class="st" x="40" y="384">YORK-DAUPHIN</text>
      <text class="st" x="236" y="340" transform="rotate(-58 236 340)">THE EL · KENSINGTON AVE</text>
      <text class="hood" x="24" y="290">KENSINGTON</text>
      <text class="hood" x="40" y="512">FISHTOWN</text>
      </g>
      ${riftEls}
      <circle id="me-range" cx="${save.pos.x}" cy="${save.pos.y}" r="${RANGE}" fill="none" stroke="#ffb15c" stroke-opacity=".35" stroke-dasharray="3 5"/>
      <circle id="me-glow-c" cx="${save.pos.x}" cy="${save.pos.y}" r="22" fill="url(#me-glow)"/>
      <circle id="me" cx="${save.pos.x}" cy="${save.pos.y}" r="6" fill="#ffb15c" stroke="#0d0909" stroke-width="2"/>
    `;
    svg.querySelectorAll('.rift').forEach(g => {
      const open = () => openSheet(RIFTS.find(r => r.id === g.dataset.id));
      g.addEventListener('click', open);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  function setMe(x, y) {
    save.pos = { x, y };
    ['me', 'me-range', 'me-glow-c'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.setAttribute('cx', x); el.setAttribute('cy', y); }
    });
  }

  const dist = r => Math.hypot(r.x - save.pos.x, r.y - save.pos.y);

  function openSheet(r) {
    selected = r;
    $('sheet-kicker').textContent = r.place;
    $('sheet-title').textContent = r.name;
    const boss = BOSSES[r.boss];
    const chips = [
      `<span class="chip hot">Level ${r.lvl}</span>`,
      `<span class="chip cold">${r.finale ? 'Final demon' : 'Mini boss'}: ${boss.name}</span>`,
      `<span class="chip">${r.party - 1} hunters here</span>`
    ];
    const d = dist(r);
    if (d > RANGE) chips.push(`<span class="chip">${Math.round(d * METERS)} m away</span>`);
    if (r.lvl > save.lvl + 1 && !r.finale) chips.push('<span class="chip hot">Tough for your level</span>');
    $('sheet-meta').innerHTML = chips.join('');
    const go = $('sheet-go');
    if (r.finale && save.war < 100) {
      go.disabled = true;
      go.textContent = `Fill the war meter to unlock (${Math.floor(save.war)}%)`;
    } else if (d > RANGE) {
      go.disabled = false;
      go.textContent = 'Walk there';
    } else {
      go.disabled = false;
      go.textContent = r.finale ? 'Join the Last Night' : 'Join the fight';
    }
    $('sheet').hidden = false;
    $('foot').textContent = ' ';
  }

  function closeSheet() {
    $('sheet').hidden = true;
    selected = null;
    $('foot').textContent = 'Tap a rift on the map';
  }

  $('sheet-close').addEventListener('click', closeSheet);
  $('sheet-go').addEventListener('click', () => {
    if (!selected || walking) return;
    if (dist(selected) > RANGE) walkTo(selected);
    else startFight(selected);
  });

  // Simulated walking. Real builds use the phone's GPS here.
  function walkTo(r) {
    const from = { ...save.pos };
    const ang = Math.atan2(from.y - r.y, from.x - r.x);
    const to = { x: r.x + Math.cos(ang) * (RANGE * 0.5), y: r.y + Math.sin(ang) * (RANGE * 0.5) };
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    const dur = Math.min(2200, 500 + d * 6);
    const t0 = performance.now();
    walking = r;
    $('sheet-go').disabled = true;
    $('sheet-go').textContent = 'Walking…';
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setMe(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
      if (k < 1) requestAnimationFrame(step);
      else { walking = null; persist(); openSheet(r); }
    };
    requestAnimationFrame(step);
  }

  function refreshMeta() {
    $('lvl').textContent = 'Lv ' + save.lvl;
    $('xp').style.width = Math.min(100, save.xp / xpNeed(save.lvl) * 100) + '%';
    $('war').style.width = Math.min(100, save.war) + '%';
    $('war-pct').textContent = save.war >= 100 ? 'Last Night unlocked' : Math.floor(save.war) + '%';
  }

  function show(id) {
    ['map-screen', 'fight-screen', 'result-screen'].forEach(s => { $(s).hidden = s !== id; });
  }

  /* ─── 4. FIGHT ───────────────────────────────────────────────────────── */

  const cv = $('cv'), ctx = cv.getContext('2d'), arena = $('arena');
  const W = 390;
  let H = 640, scale = 1, dpr = 1;
  const LANES = [78, 195, 312];
  let f = null, raf = 0, last = 0;

  function sizeArena() {
    const r = arena.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = r.width / W;
    H = r.height / scale;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
  }
  window.addEventListener('resize', () => { if (f) sizeArena(); });

  const bossY = () => H * 0.34;
  const huntY = () => H - 64;
  const rand = (a, b) => a + Math.random() * (b - a);

  function playerBase() { return 9 + 2.2 * (save.lvl - 1) + save.gear; }

  function startFight(r) {
    closeSheet();
    show('fight-screen');
    sizeArena();
    const party = r.party;
    const maxHp = Math.round(2000 * Math.pow(1.45, r.lvl - 1) * (0.5 + party / 8));
    const allies = [];
    for (let i = 0; i < party - 1; i++) {
      const lane = i % 3;
      allies.push({ lane, x: LANES[lane] + rand(-30, 30), off: rand(-30, 30), hp: 100, down: 0, cd: rand(0.3, 1), depth: rand(0, 1) });
    }
    f = {
      rift: r,
      boss: { hp: maxHp, max: maxHp, flash: 0, shake: 0, stun: 0, dead: 0, enraged: false },
      t: 0,
      time: r.finale ? 150 : r.greater ? 100 : 75,
      me: { lane: 1, x: LANES[1], hp: 100, down: 0, fury: 0, shield: 0, tapCd: 0, hurt: 0 },
      allies,
      attacks: [],
      parts: [],
      floats: [],
      cds: { flare: 0, ward: 0 },
      nextAttack: 2.2,
      over: false,
      shake: 0
    };
    $('fplace').textContent = `${r.place} · ${r.name}`;
    $('bossname').textContent = BOSSES[r.boss].name;
    banner(r.finale ? 'The Last Night begins' : 'The rift tears open', false, 1.6);
    updateFightHud();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  let bannerTimer = 0;
  function banner(text, cold, secs) {
    const b = $('banner');
    b.textContent = text;
    b.classList.toggle('cold', !!cold);
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), (secs || 1.2) * 1000);
  }

  function spawn(x, y, kind, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (spread || 1) * rand(40, 200);
      f.parts.push({
        x, y, kind,
        vx: Math.cos(a) * sp * (kind === 'ember' ? 0.4 : 1),
        vy: kind === 'ember' ? rand(-120, -30) : Math.sin(a) * sp,
        life: 0,
        max: kind === 'spark' ? rand(0.3, 0.6) : rand(1, 2.4),
        r: kind === 'mist' ? rand(14, 36) : rand(1, 2.6)
      });
    }
  }
  function float(x, y, text, kind) { f.floats.push({ x, y, text, kind, life: 0 }); }

  function damageBoss(amount, x, y, big) {
    const b = f.boss;
    if (b.dead || f.over) return;
    b.hp = Math.max(0, b.hp - amount);
    b.flash = big ? 1 : Math.max(b.flash, 0.35);
    b.shake = Math.max(b.shake, big ? 12 : 3);
    spawn(x, y, 'spark', big ? 22 : 6, big ? 1.2 : 0.6);
    if (big) spawn(x, y, 'ember', 8);
    if (big || Math.random() < 0.35) float(x, y - 8, '-' + amount, big ? 'big' : 'small');
    if (!b.enraged && b.hp < b.max * 0.5) {
      b.enraged = true;
      banner('It’s enraged', true, 1.4);
      f.nextAttack = Math.min(f.nextAttack, f.t + 1.2);
    }
    if (b.hp <= 0) {
      b.dead = 0.001;
      f.attacks = [];
      for (let i = 0; i < 120; i++) spawn(W / 2 + rand(-120, 120), bossY() + rand(-130, 130), 'ash', 1, 0.5);
      banner(f.rift.finale ? 'Kensington holds' : 'Rift sealed', false, 2);
    }
  }

  function tapAttack(x, y) {
    const m = f.me;
    if (m.down > 0 || m.tapCd > 0 || f.boss.dead) return;
    m.tapCd = 0.16;
    const base = playerBase();
    const crit = Math.random() < 0.12;
    const dmg = Math.round(base * rand(0.85, 1.15) * (crit ? 2 : 1));
    damageBoss(dmg, x, y, crit);
    if (crit) float(x, y - 34, 'Crit', 'crit');
    m.fury = Math.min(100, m.fury + 6);
  }

  function useFlare() {
    if (!f || f.cds.flare > 0 || f.me.down > 0 || f.boss.dead) return;
    f.cds.flare = 7;
    const x = W / 2 + rand(-40, 40), y = bossY() + rand(-40, 40);
    damageBoss(Math.round(playerBase() * 6), x, y, true);
    for (let i = 0; i < 4; i++) spawn(f.me.x, huntY() - 40, 'ember', 6);
    f.me.fury = Math.min(100, f.me.fury + 12);
  }
  function useWard() {
    if (!f || f.cds.ward > 0 || f.me.down > 0 || f.boss.dead) return;
    f.cds.ward = 14;
    f.me.shield = 3;
    banner('Ward up', false, 0.8);
  }
  function useUlt() {
    if (!f || f.me.fury < 100 || f.me.down > 0 || f.boss.dead) return;
    f.me.fury = 0;
    f.boss.stun = 2.5;
    f.attacks = [];
    damageBoss(Math.round(playerBase() * 14), W / 2, bossY(), true);
    for (let i = 0; i < 5; i++) spawn(W / 2 + rand(-80, 80), bossY() + rand(-80, 80), 'spark', 14, 1.4);
    banner('Last Light', false, 1.2);
  }
  $('ab-flare').addEventListener('click', useFlare);
  $('ab-ward').addEventListener('click', useWard);
  $('ab-ult').addEventListener('click', useUlt);

  function moveLane(l) {
    if (!f || f.me.down > 0) return;
    f.me.lane = Math.max(0, Math.min(2, l));
  }

  // Touch: tap the demon to strike, tap low on the screen to move lanes, swipe to dodge.
  let down = null;
  cv.addEventListener('pointerdown', e => {
    if (!f || f.over) return;
    const r = cv.getBoundingClientRect();
    down = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale, t: performance.now() };
  });
  cv.addEventListener('pointerup', e => {
    if (!f || f.over || !down) return;
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
    const dx = x - down.x;
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(y - down.y)) {
      moveLane(f.me.lane + (dx > 0 ? 1 : -1));
    } else if (y > H * 0.66) {
      let best = 0;
      LANES.forEach((lx, i) => { if (Math.abs(lx - x) < Math.abs(LANES[best] - x)) best = i; });
      moveLane(best);
    } else {
      tapAttack(x, y);
    }
    down = null;
  });
  window.addEventListener('keydown', e => {
    if (!f || f.over || $('fight-screen').hidden) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') moveLane(f.me.lane - 1);
    else if (e.key === 'ArrowRight' || e.key === 'd') moveLane(f.me.lane + 1);
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tapAttack(W / 2 + rand(-60, 60), bossY() + rand(-60, 60)); }
    else if (e.key === '1') useFlare();
    else if (e.key === '2') useWard();
    else if (e.key === '3') useUlt();
  });

  function queueAttack() {
    const b = f.boss, lvl = f.rift.lvl;
    const pace = (b.enraged ? 1.7 : 2.5) * (1 - 0.04 * (lvl - 1));
    f.nextAttack = f.t + pace * rand(0.85, 1.15);
    const roll = Math.random();
    if (b.enraged && roll < 0.3) {
      const safe = Math.floor(Math.random() * 3);
      f.attacks.push({ kind: 'wail', lanes: [0, 1, 2].filter(l => l !== safe), warn: 1.6, t: 0, dmg: 26 + 5 * lvl, done: false });
      banner('Wail: find the safe lane', true, 1.2);
    } else if (roll < 0.65) {
      const lane = Math.random() < 0.6 ? f.me.lane : Math.floor(Math.random() * 3);
      f.attacks.push({ kind: 'claw', lanes: [lane], warn: 1.1, t: 0, dmg: 18 + 4 * lvl, done: false });
    } else {
      const skip = Math.floor(Math.random() * 3);
      f.attacks.push({ kind: 'sweep', lanes: [0, 1, 2].filter(l => l !== skip), warn: 1.35, t: 0, dmg: 14 + 3 * lvl, done: false });
    }
  }

  function resolveAttack(a) {
    const m = f.me;
    if (m.down <= 0 && a.lanes.includes(m.lane)) {
      if (m.shield > 0) {
        float(m.x, huntY() - 70, 'Blocked', 'block');
        spawn(m.x, huntY() - 50, 'spark', 10, 0.7);
      } else {
        m.hp = Math.max(0, m.hp - a.dmg);
        m.hurt = 1;
        f.shake = 10;
        float(m.x, huntY() - 70, '-' + a.dmg, 'hurt');
        if (m.hp <= 0) {
          m.down = 4;
          m.fury = Math.floor(m.fury / 2);
          banner('You’re down. Hunters are pulling you up', false, 1.6);
        }
      }
    }
    for (const al of f.allies) {
      if (al.down > 0 || !a.lanes.includes(al.lane)) continue;
      if (m.shield > 0) continue;
      al.hp -= a.dmg;
      if (al.hp <= 0) { al.down = 6; al.hp = 0; }
    }
    for (const l of a.lanes) spawn(LANES[l], huntY() - 20, a.kind === 'wail' ? 'mist' : 'spark', a.kind === 'wail' ? 4 : 8, 0.8);
  }

  function update(dt) {
    const b = f.boss, m = f.me;
    f.t += dt;
    if (!b.dead && !f.over) {
      f.time = Math.max(0, f.time - dt);
      if (f.time <= 0) { endFight(false); return; }
    }
    m.tapCd = Math.max(0, m.tapCd - dt);
    m.shield = Math.max(0, m.shield - dt);
    m.hurt = Math.max(0, m.hurt - dt * 3);
    f.cds.flare = Math.max(0, f.cds.flare - dt);
    f.cds.ward = Math.max(0, f.cds.ward - dt);
    if (m.down > 0) {
      m.down -= dt;
      if (m.down <= 0) { m.hp = 50; banner('Back on your feet', false, 0.9); }
    }
    m.x += (LANES[m.lane] - m.x) * Math.min(1, dt * 14);
    b.flash = Math.max(0, b.flash - dt * 4);
    b.shake = Math.max(0, b.shake - dt * 40);
    f.shake = Math.max(0, f.shake - dt * 40);
    b.stun = Math.max(0, b.stun - dt);

    if (b.dead) {
      b.dead += dt;
      if (b.dead > 2.2 && !f.over) { endFight(true); return; }
    } else {
      if (b.stun <= 0 && f.t > f.nextAttack) queueAttack();
      for (const a of f.attacks) {
        a.t += dt;
        // Allies see it coming and most of them dodge.
        if (!a.dodged && a.t > a.warn * 0.55) {
          a.dodged = true;
          const safe = [0, 1, 2].filter(l => !a.lanes.includes(l));
          for (const al of f.allies) {
            if (al.down <= 0 && a.lanes.includes(al.lane) && Math.random() < 0.7 && safe.length) {
              al.lane = safe[Math.floor(Math.random() * safe.length)];
            }
          }
        }
        if (!a.done && a.t >= a.warn) { a.done = true; resolveAttack(a); }
      }
      f.attacks = f.attacks.filter(a => a.t < a.warn + 0.3);
      // Ally damage
      const allyBase = 4 + 1.6 * f.rift.lvl;
      for (const al of f.allies) {
        al.x += (LANES[al.lane] + al.off - al.x) * Math.min(1, dt * 8);
        if (al.down > 0) {
          al.down -= dt;
          if (al.down <= 0) al.hp = 60;
          continue;
        }
        al.cd -= dt;
        if (al.cd <= 0) {
          al.cd = rand(0.7, 1.1);
          damageBoss(Math.round(allyBase * rand(0.8, 1.2)), W / 2 + rand(-90, 90), bossY() + rand(-90, 90), false);
        }
      }
    }

    // Particles and floating numbers
    for (const p of f.parts) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'ember') p.vx += Math.sin(p.life * 4 + p.y * 0.02) * 20 * dt;
      if (p.kind === 'spark') { p.vy += 380 * dt; p.vx *= 0.97; }
      if (p.kind === 'mist' || p.kind === 'ash') { p.vy -= 10 * dt; p.vx *= 0.99; p.vy *= 0.99; }
    }
    f.parts = f.parts.filter(p => p.life < p.max);
    if (f.parts.length > 900) f.parts.splice(0, f.parts.length - 900);
    for (const fl of f.floats) { fl.life += dt; fl.y -= 42 * dt; }
    f.floats = f.floats.filter(fl => fl.life < 1);

    // Ambient: embers from the rift, mist off the demon
    if (!b.dead && Math.random() < 0.6) spawn(W / 2 + rand(-150, 150), bossY() + rand(40, 160), 'ember', 1);
    if (!b.dead && Math.random() < (b.enraged ? 0.6 : 0.3)) spawn(W / 2 + rand(-110, 110), bossY() + rand(20, 120), 'mist', 1, 0.2);
  }

  function updateFightHud() {
    const m = f.me, b = f.boss;
    $('bosshp').style.width = (b.hp / b.max * 100) + '%';
    $('ftime').textContent = Math.ceil(f.time) + 's';
    $('hp').style.width = m.hp + '%';
    $('fury').style.width = m.fury + '%';
    const cdUi = (id, left, total, extra) => {
      const btn = $(id);
      btn.disabled = left > 0 || m.down > 0 || !!b.dead || !!extra;
      btn.querySelector('.cd').style.height = (left > 0 ? left / total * 100 : 0) + '%';
    };
    cdUi('ab-flare', f.cds.flare, 7);
    cdUi('ab-ward', f.cds.ward, 14);
    const ult = $('ab-ult');
    cdUi('ab-ult', 0, 1, m.fury < 100);
    ult.classList.toggle('ready', m.fury >= 100 && m.down <= 0 && !b.dead);
    ult.querySelector('small').textContent = m.fury >= 100 ? 'ready' : 'needs full fury';
  }

  /* drawing */

  function render() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const b = f.boss, m = f.me, by = bossY(), hy = huntY();
    const sx = f.shake ? rand(-1, 1) * f.shake * 0.6 : 0, sy = f.shake ? rand(-1, 1) * f.shake * 0.6 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // Background: the hellgate behind everything, dimmed
    ctx.fillStyle = '#080506';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    if (gateImg.complete && gateImg.naturalWidth) {
      const s = Math.max(W, H * 0.9) * (1.04 + 0.02 * Math.sin(f.t * 1.2));
      ctx.globalAlpha = 0.38;
      ctx.drawImage(gateImg, W / 2 - s / 2, by - s * 0.42, s, s);
      ctx.globalAlpha = 1;
    }
    const fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, 'rgba(8,5,6,.75)');
    fade.addColorStop(0.45, 'rgba(8,5,6,.15)');
    fade.addColorStop(0.75, 'rgba(8,5,6,.7)');
    fade.addColorStop(1, 'rgba(8,5,6,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);

    // Rift glow
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.85 + 0.15 * Math.sin(f.t * 8) * Math.sin(f.t * 2.1);
    const glow = ctx.createRadialGradient(W / 2, by + 60, 10, W / 2, by + 60, 300);
    glow.addColorStop(0, `rgba(255,110,40,${(b.dead ? 0.15 : 0.3) * pulse})`);
    glow.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // Lane floor marks
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === m.lane ? 'rgba(255,177,92,.35)' : 'rgba(255,255,255,.06)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(LANES[i], hy + 18, 48, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Telegraphs
    for (const a of f.attacks) {
      const k = Math.min(1, a.t / a.warn);
      const cold = a.kind === 'wail';
      for (const l of a.lanes) {
        const x = LANES[l] - 52;
        const top = by + 80;
        if (!a.done) {
          ctx.fillStyle = cold ? `rgba(110,140,255,${0.08 + 0.22 * k})` : `rgba(226,72,58,${0.08 + 0.24 * k})`;
          ctx.fillRect(x, top, 104, H - top);
          ctx.fillStyle = cold ? 'rgba(170,190,255,.8)' : 'rgba(255,120,90,.85)';
          ctx.fillRect(x, top + (H - top) * (1 - k), 104, 3);
          ctx.strokeStyle = cold ? 'rgba(126,162,255,.5)' : 'rgba(226,72,58,.55)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, top + 0.5, 103, H - top - 1);
        } else {
          const fl = 1 - (a.t - a.warn) / 0.3;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = cold ? `rgba(150,180,255,${0.5 * fl})` : `rgba(255,140,90,${0.55 * fl})`;
          ctx.fillRect(x, top, 104, H - top);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    drawBoss();

    // Hunters: allies further back, you in front
    const allies = f.allies.slice().sort((p, q) => p.depth - q.depth);
    for (const al of allies) drawHunter(al.x, hy - 26 - al.depth * 30, 0.62 + al.depth * 0.18, al.down > 0, false, al.hp / 100, false);
    drawHunter(m.x, hy, 1, m.down > 0, m.shield > 0, m.hp / 100, true);

    drawParticles();
    drawFloats();
    ctx.restore();

    // Hurt vignette
    if (m.hurt > 0) {
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
      v.addColorStop(0, 'rgba(226,72,58,0)');
      v.addColorStop(1, `rgba(226,72,58,${0.45 * m.hurt})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBoss() {
    const b = f.boss, art = bossArt[BOSSES[f.rift.boss].art];
    let alpha = 1, grow = 1;
    if (b.dead) { const k = Math.min(1, b.dead / 1.2); alpha = 1 - k; grow = 1 + k * 0.25; }
    if (alpha <= 0.01) return;
    const intro = Math.min(1, f.t / 1.4);
    const big = f.rift.finale ? 1.25 : f.rift.greater ? 1.12 : 1;
    const size = 320 * big * (0.6 + 0.4 * intro) * (1 + Math.sin(f.t * 1.7) * 0.025) * grow;
    const x = W / 2 + (b.shake ? rand(-1, 1) * b.shake : 0);
    const y = bossY() + Math.sin(f.t * 1.1) * 6 + (1 - intro) * 50 + (b.shake ? rand(-1, 1) * b.shake : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(f.t * 0.8) * (b.stun > 0 ? 0.01 : 0.05));
    ctx.globalAlpha = alpha * intro;
    ctx.globalCompositeOperation = 'screen';
    if (art) {
      ctx.drawImage(art, -size / 2, -size / 2, size, size);
      if (b.enraged) { ctx.globalAlpha = 0.35 * alpha; ctx.drawImage(art, -size / 2, -size / 2, size, size); }
      if (b.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = b.flash * 0.55 * alpha;
        ctx.drawImage(art, -size / 2, -size / 2, size, size);
      }
    } else {
      ctx.fillStyle = 'rgba(126,162,255,.5)';
      ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (b.stun > 0 && !b.dead) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,210,122,.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(W / 2, bossY() - 120, 46 + i * 6, 10 + i * 2, 0, f.t * 4 + i, f.t * 4 + i + 2.2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawHunter(x, y, s, isDown, shield, hpk, isMe) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (isDown) { ctx.globalAlpha = 0.35; ctx.rotate(1.3); }
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -30, 4, 0, -30, 64);
    g.addColorStop(0, isMe ? 'rgba(255,150,60,.35)' : 'rgba(255,120,40,.18)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-64, -94, 128, 128);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#040203';
    ctx.beginPath();
    ctx.moveTo(-21, 38);
    ctx.quadraticCurveTo(-17, -30, 0, -40);
    ctx.quadraticCurveTo(17, -30, 21, 38);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -51, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isMe ? 'rgba(255,190,110,.95)' : 'rgba(255,150,70,.5)';
    ctx.lineWidth = isMe ? 1.8 : 1.2;
    ctx.beginPath();
    ctx.arc(0, -51, 12, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-17, -10);
    ctx.quadraticCurveTo(-14, -30, 0, -39);
    ctx.stroke();
    if (shield) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,210,122,.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -10, 54, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,122,.08)';
      ctx.beginPath();
      ctx.arc(0, -10, 54, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!isMe && !isDown && hpk < 1) {
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      ctx.fillRect(x - 14, y - 74 * s, 28, 3);
      ctx.fillStyle = '#ff7a2e';
      ctx.fillRect(x - 14, y - 74 * s, 28 * Math.max(0, hpk), 3);
    }
    if (isMe) {
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = isDown ? '#8a7a72' : '#ffb15c';
      ctx.fillText(isDown ? 'DOWN' : 'YOU', x, y + 52);
    }
  }

  function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of f.parts) {
      const k = 1 - p.life / p.max;
      if (k <= 0) continue;
      if (p.kind === 'mist') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(110,140,255,${0.1 * k})`);
        g.addColorStop(1, 'rgba(110,140,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else if (p.kind === 'ash') {
        ctx.fillStyle = `rgba(170,190,255,${0.8 * k})`;
        ctx.fillRect(p.x, p.y, p.r * 1.4, p.r * 1.4);
      } else if (p.kind === 'spark') {
        ctx.fillStyle = `rgba(255,230,180,${k})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,${(120 + 80 * k) | 0},50,${0.9 * k})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k * 0.6), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFloats() {
    ctx.textAlign = 'center';
    for (const fl of f.floats) {
      const k = 1 - fl.life;
      const big = fl.kind === 'big' || fl.kind === 'crit';
      ctx.font = `700 ${big ? 30 : fl.kind === 'small' ? 17 : 24}px "Grenze Gotisch", serif`;
      ctx.fillStyle =
        fl.kind === 'hurt' ? `rgba(255,110,90,${k})` :
        fl.kind === 'block' ? `rgba(255,210,122,${k})` :
        fl.kind === 'crit' ? `rgba(255,243,214,${k})` :
        big ? `rgba(255,214,150,${k})` : `rgba(255,170,100,${0.75 * k})`;
      ctx.fillText(fl.text, fl.x, fl.y);
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!f) return;
    update(dt);
    if (!f) return;
    render();
    updateFightHud();
    raf = requestAnimationFrame(loop);
  }

  /* ─── 5. RESULTS ─────────────────────────────────────────────────────── */

  const ITEMS = ['Iron Knuckles', 'Ember Lantern', 'Ward Chain', 'Rail Spike', 'Ash Coat', 'Cinder Ring', 'Grave Bell', 'Smoke Hood'];

  function endFight(won) {
    if (f.over) return;
    f.over = true;
    cancelAnimationFrame(raf);
    const r = f.rift;
    const lines = [];
    let loot = null;
    let title, kicker;
    const lvlBefore = save.lvl;

    if (won) {
      const xp = r.finale ? 400 : 45 * r.lvl * (r.greater ? 1.6 : 1);
      const war = r.finale ? 0 : r.greater ? 16 : 6 + 2 * r.lvl;
      save.xp += Math.round(xp);
      save.wins += 1;
      kicker = r.name;
      if (r.finale) {
        title = `Season ${save.season} complete`;
        lines.push('<b>Kensington held.</b> The final demon fell on the Last Night.');
        lines.push('The war meter resets and a new season begins.');
        save.season += 1;
        save.war = 0;
      } else {
        title = r.greater ? 'Greater rift sealed' : 'Rift sealed';
        save.war = Math.min(100, save.war + war);
        lines.push(`<b>+${war}%</b> to the Kensington war meter`);
        if (save.war >= 100) lines.push('<b>The Last Night is unlocked</b> on the map');
      }
      lines.push(`<b>+${Math.round(xp)} XP</b>`);
      if (Math.random() < (r.finale ? 1 : 0.7)) {
        const roll = Math.random();
        const rar = r.finale || roll > 0.9 ? { name: 'Cursed', bonus: 4, color: '#c9d6ff' } : roll > 0.6 ? { name: 'Rare', bonus: 2, color: '#ffb15c' } : { name: 'Common', bonus: 1, color: '#b3a79f' };
        loot = { name: ITEMS[Math.floor(Math.random() * ITEMS.length)], rar };
        save.gear += rar.bonus;
        save.items.push(loot.name);
      }
    } else {
      kicker = r.name;
      title = 'The rift held';
      save.xp += 10 * r.lvl;
      lines.push('Time ran out before the demon fell.');
      lines.push(`<b>+${10 * r.lvl} XP</b> for showing up`);
    }
    while (save.xp >= xpNeed(save.lvl)) { save.xp -= xpNeed(save.lvl); save.lvl += 1; }
    if (save.lvl > lvlBefore) lines.push(`<b>Level up: ${save.lvl}</b>. You hit harder.`);
    persist();

    $('res-kicker').textContent = kicker;
    $('res-title').textContent = title;
    $('res-list').innerHTML = lines.map(l => `<li>${l}</li>`).join('');
    const lootEl = $('loot');
    if (loot) {
      lootEl.hidden = false;
      lootEl.innerHTML = `<span class="rar" style="color:${loot.rar.color}">${loot.rar.name} drop</span><span class="name">${loot.name}</span><span class="stat">+${loot.rar.bonus} damage on every hit</span>`;
    } else {
      lootEl.hidden = true;
    }
    $('res-go').textContent = won ? 'Back to the map' : 'Back to the map';
    setTimeout(() => show('result-screen'), won ? 0 : 400);
    f = null;
  }

  $('res-go').addEventListener('click', () => {
    show('map-screen');
    drawMap();
    refreshMeta();
  });

  /* ─── START ──────────────────────────────────────────────────────────── */

  drawMap();
  refreshMeta();
  show('map-screen');
})();

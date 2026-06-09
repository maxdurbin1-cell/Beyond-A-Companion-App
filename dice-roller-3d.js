/**
 * BEYOND: The Light - 3D Dice Roller
 * Professional animated dice with physics simulation, skins, and Fabled-style roll effects
 * Nat 20 → gold fireworks burst | Nat 1 → comical downward sprinkle
 * Collectible dice skin system with persistent selection
 */

(function() {
  'use strict';

  // ── Dice Skins ────────────────────────────────────────────────────────────
  const DICE_SKINS = {
    obsidian: {
      label: 'Obsidian',
      icon: '🖤',
      colors: { d4:'#3d3d4d', d6:'#2e2e40', d8:'#3a3a50', d10:'#464658', d12:'#3f3f55', d20:'#292940' },
      numberColor: '#e3bc5e',
      edgeColor: 'rgba(227,188,94,0.5)',
      glowColor: 'rgba(227,188,94,0.4)'
    },
    arcane: {
      label: 'Arcane',
      icon: '🔮',
      colors: { d4:'#5c2d91', d6:'#6b35a8', d8:'#7c42c2', d10:'#8a4dd4', d12:'#7038b8', d20:'#4a2280' },
      numberColor: '#c9f0ff',
      edgeColor: 'rgba(160,100,255,0.6)',
      glowColor: 'rgba(140,80,255,0.5)'
    },
    bloodForge: {
      label: 'Blood Forge',
      icon: '🔴',
      colors: { d4:'#6b1414', d6:'#7d1a1a', d8:'#8c2020', d10:'#9c2828', d12:'#8a1c1c', d20:'#5a0e0e' },
      numberColor: '#ffd0d0',
      edgeColor: 'rgba(220,60,60,0.6)',
      glowColor: 'rgba(200,40,40,0.5)'
    },
    voidWalker: {
      label: 'Void Walker',
      icon: '✨',
      colors: { d4:'#0a0a1a', d6:'#060614', d8:'#0c0c20', d10:'#08081c', d12:'#0a0a18', d20:'#040410' },
      numberColor: '#49c9bb',
      edgeColor: 'rgba(73,201,187,0.7)',
      glowColor: 'rgba(73,201,187,0.6)'
    },
    aurora: {
      label: 'Aurora',
      icon: '🌈',
      colors: { d4:'#1a5e4a', d6:'#1c4e6e', d8:'#3a1f6b', d10:'#5e2060', d12:'#6e1a2e', d20:'#1a3a5e' },
      numberColor: '#ffffff',
      edgeColor: 'rgba(120,220,200,0.5)',
      glowColor: 'rgba(140,200,255,0.4)'
    },
    classic: {
      label: 'Classic',
      icon: '🎲',
      colors: { d4:'#8b8b9a', d6:'#49c9bb', d8:'#7bc87b', d10:'#f0a840', d12:'#f0b028', d20:'#e05050' },
      numberColor: '#ffffff',
      edgeColor: 'rgba(255,255,255,0.2)',
      glowColor: 'rgba(255,255,255,0.15)'
    }
  };

  const SKIN_STORAGE_KEY = 'btl-dice-skin-v1';
  function getActiveSkin() {
    try { return DICE_SKINS[localStorage.getItem(SKIN_STORAGE_KEY)] || DICE_SKINS.classic; } catch(e) { return DICE_SKINS.classic; }
  }
  function setActiveSkin(key) {
    try { localStorage.setItem(SKIN_STORAGE_KEY, key); } catch(e) {}
  }

  // ── Base dice config (sides / range only — colours come from skin) ─────────
  const DICE_CONFIG = {
    d4: { sides: 4, color: '#8b8b9a', min: 1, max: 4 },
    d6: { sides: 6, color: '#49c9bb', min: 1, max: 6 },
    d8: { sides: 8, color: '#7bc87b', min: 1, max: 8 },
    d10: { sides: 10, color: '#f0a840', min: 1, max: 10 },
    d12: { sides: 12, color: '#f0b028', min: 1, max: 12 },
    d20: { sides: 20, color: '#e05050', min: 1, max: 20 }
  };

  const DICE_SETTINGS_STORAGE_KEY = 'btl-dice-settings-v1';
  const MAX_ROLL_LOG = 40;

  function loadDiceSettings() {
    try {
      const raw = localStorage.getItem(DICE_SETTINGS_STORAGE_KEY);
      if (!raw) return { deterministic: false, seed: '' };
      const parsed = JSON.parse(raw);
      return {
        deterministic: !!(parsed && parsed.deterministic),
        seed: String(parsed && parsed.seed || '')
      };
    } catch (_err) {
      return { deterministic: false, seed: '' };
    }
  }

  function saveDiceSettings(settings) {
    try {
      localStorage.setItem(DICE_SETTINGS_STORAGE_KEY, JSON.stringify({
        deterministic: !!(settings && settings.deterministic),
        seed: String(settings && settings.seed || '')
      }));
    } catch (_err) {}
  }

  function hashSeed(seedText) {
    const text = String(seedText || 'default-seed');
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }

  function formatSignedNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n === 0) return '';
    return n > 0 ? ` + ${n}` : ` - ${Math.abs(n)}`;
  }

  const SOUL_WIDGET_STATS = [
    { key: 'body', label: 'Body' },
    { key: 'strike', label: 'Strike' },
    { key: 'shoot', label: 'Shoot' },
    { key: 'mind', label: 'Mind' },
    { key: 'spirit', label: 'Spirit' },
    { key: 'defend', label: 'Defend' },
    { key: 'control', label: 'Control' },
    { key: 'lead', label: 'Lead' },
    { key: 'valor', label: 'Valor' }
  ];
  const DIE_STEPS = [4, 6, 8, 10, 12, 20];

  function clampDieStep(value) {
    const raw = Number(value || 6);
    if (DIE_STEPS.indexOf(raw) >= 0) return raw;
    let best = DIE_STEPS[0];
    let bestDist = Math.abs(raw - best);
    for (let i = 1; i < DIE_STEPS.length; i += 1) {
      const d = DIE_STEPS[i];
      const dist = Math.abs(raw - d);
      if (dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    }
    return best;
  }

  function stepDie(value, delta) {
    const die = clampDieStep(value);
    let idx = DIE_STEPS.indexOf(die);
    idx = Math.max(0, Math.min(DIE_STEPS.length - 1, idx + Number(delta || 0)));
    return DIE_STEPS[idx];
  }

  function getSoulStatDie(statKey) {
    const fallback = 6;
    const source = typeof window !== 'undefined' && window.S && window.S.stats ? window.S.stats : null;
    if (!source) return fallback;
    return clampDieStep(Number(source[statKey] || fallback));
  }

  function getConditionStepShift(statKey) {
    const s = typeof window !== 'undefined' && window.S ? window.S : null;
    const c = s && s.conditions ? s.conditions : null;
    if (!c) return 0;
    const key = String(statKey || '').toLowerCase();
    let shift = 0;
    if ((key === 'body' || key === 'strike' || key === 'shoot')) {
      if (c.empowered) shift += 1;
      if (c.weakened) shift -= 1;
    }
    if (key === 'defend') {
      if (c.protected) shift += 1;
      if (c.vulnerable) shift -= 1;
    }
    if (key === 'mind' || key === 'control') {
      if (c.focused) shift += 1;
      if (c.distracted) shift -= 1;
    }
    if (key === 'spirit' || key === 'lead') {
      if (c.bolstered) shift += 1;
      if (c.shaken) shift -= 1;
    }
    return shift;
  }

  function getSoulLabel(statKey) {
    const hit = SOUL_WIDGET_STATS.find((entry) => entry.key === statKey);
    return hit ? hit.label : 'Action';
  }

  function parseDiceNotation(notation) {
    const raw = String(notation || '').trim();
    if (!raw) return { ok: false, error: 'Enter a dice notation first.' };

    const normalized = raw.toLowerCase().replace(/\s+/g, '');
    const tokens = normalized.match(/[+\-]?[^+\-]+/g);
    if (!tokens || !tokens.length) return { ok: false, error: 'Invalid notation.' };

    const terms = [];
    let modifier = 0;
    let totalDice = 0;

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      let sign = 1;
      let body = token;
      if (body.charAt(0) === '+') body = body.slice(1);
      else if (body.charAt(0) === '-') {
        sign = -1;
        body = body.slice(1);
      }
      if (!body) return { ok: false, error: `Invalid token: ${token}` };

      const diceMatch = body.match(/^(\d*)d(\d+)(?:k([hl])(\d+))?$/);
      if (diceMatch) {
        const count = Math.max(1, Number(diceMatch[1] || 1));
        const sides = Math.max(2, Number(diceMatch[2] || 0));
        const keepKind = diceMatch[3] ? `k${diceMatch[3]}` : 'all';
        const keepCount = diceMatch[4] ? Math.max(1, Number(diceMatch[4] || 1)) : count;
        const key = `d${sides}`;
        if (!DICE_CONFIG[key]) {
          return { ok: false, error: `Unsupported die size d${sides}.` };
        }
        if (keepCount > count) {
          return { ok: false, error: `Cannot keep ${keepCount} from ${count}d${sides}.` };
        }
        totalDice += count;
        if (totalDice > 30) {
          return { ok: false, error: 'Too many dice in one roll (max 30).' };
        }
        terms.push({
          id: terms.length,
          sign,
          count,
          sides,
          keepKind,
          keepCount,
          raw: token
        });
        continue;
      }

      const intMatch = body.match(/^\d+$/);
      if (intMatch) {
        modifier += sign * Number(body);
        continue;
      }

      return { ok: false, error: `Invalid token: ${token}` };
    }

    if (!terms.length && modifier === 0) {
      return { ok: false, error: 'Notation has no rollable terms.' };
    }

    return {
      ok: true,
      notation: raw,
      terms,
      modifier
    };
  }

  // ── Particle / Effect helpers ─────────────────────────────────────────────
  const PARTICLE_POOL = [];

  function spawnParticles(ctx, cx, cy, count, opts) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = (opts.minSpeed || 2) + Math.random() * ((opts.maxSpeed || 8) - (opts.minSpeed || 2));
      PARTICLE_POOL.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (opts.gravityBias || 0),
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        size: (opts.minSize || 3) + Math.random() * ((opts.maxSize || 7) - (opts.minSize || 3)),
        color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
        shape: opts.shapes ? opts.shapes[Math.floor(Math.random() * opts.shapes.length)] : 'circle',
        gravity: opts.gravity || 0,
        spin: (Math.random() - 0.5) * 0.3
      });
    }
  }

  function updateAndDrawParticles(ctx) {
    for (let i = PARTICLE_POOL.length - 1; i >= 0; i--) {
      const p = PARTICLE_POOL[i];
      p.life -= p.decay;
      if (p.life <= 0) { PARTICLE_POOL.splice(i, 1); continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.97;
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin * (1 - p.life) * 10);
      if (p.shape === 'star') {
        drawStar(ctx, 0, 0, p.size);
      } else if (p.shape === 'confetti') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawStar(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outer = { x: x + r * Math.cos((Math.PI * 2 * i) / 5 - Math.PI / 2), y: y + r * Math.sin((Math.PI * 2 * i) / 5 - Math.PI / 2) };
      const inner = { x: x + r * 0.4 * Math.cos((Math.PI * 2 * i) / 5 - Math.PI / 2 + Math.PI / 5), y: y + r * 0.4 * Math.sin((Math.PI * 2 * i) / 5 - Math.PI / 2 + Math.PI / 5) };
      i === 0 ? ctx.moveTo(outer.x, outer.y) : ctx.lineTo(outer.x, outer.y);
      ctx.lineTo(inner.x, inner.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Nat-20 firework burst ──────────────────────────────────────────────────
  function triggerNat20Effect(ctx, cx, cy) {
    const colors = ['#e3bc5e','#ffd700','#ff9f00','#ffffff','#49c9bb','#ff6b6b','#c9a0ff'];
    spawnParticles(ctx, cx, cy, 60, {
      colors, minSpeed: 4, maxSpeed: 14, minSize: 4, maxSize: 9,
      shapes: ['star', 'circle', 'confetti'], gravity: 0.08, gravityBias: -2
    });
    // Second burst ring
    spawnParticles(ctx, cx, cy, 30, {
      colors: ['#ffffff','#fffacd','#ffd700'],
      minSpeed: 1, maxSpeed: 4, minSize: 2, maxSize: 4,
      shapes: ['circle'], gravity: 0.04, gravityBias: -1
    });
  }

  // ── Nat-1 comical sprinkle ─────────────────────────────────────────────────
  function triggerNat1Effect(ctx, cx, cy) {
    const colors = ['#888','#9fa7bc','#555','#777','#bbb'];
    spawnParticles(ctx, cx, cy, 28, {
      colors, minSpeed: 0.5, maxSpeed: 3, minSize: 2, maxSize: 5,
      shapes: ['circle', 'confetti'], gravity: 0.18, gravityBias: 3
    });
  }

  class Dice3DRoller {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.dice = [];
      this.isAnimating = false;
      this.animationFrameId = null;
      this.timeElapsed = 0;
      this.totalAnimationTime = 1200; // 1.2 seconds
      this.diceSize = 40;
      this.gravity = 0.0008;
      this.damping = 0.98;
      this.results = [];
      this.onComplete = null;
      this.effectPhase = null; // 'nat20' | 'nat1' | null
      this.effectTimer = 0;
      this.effectDuration = 1400;
      this.rollMode = 'sum';
      this.resultAggregator = null;
      this.rollPlan = null;
      this.lastBreakdown = '';
      this.rollLog = [];

      const settings = loadDiceSettings();
      this.deterministic = !!settings.deterministic;
      this.deterministicSeedText = String(settings.seed || '');
      this.randomState = hashSeed(this.deterministicSeedText || 'default-seed');
    }

    setDeterministicMode(enabled, seedText) {
      this.deterministic = !!enabled;
      this.deterministicSeedText = String(seedText || this.deterministicSeedText || 'default-seed');
      this.randomState = hashSeed(this.deterministicSeedText || 'default-seed');
      saveDiceSettings({ deterministic: this.deterministic, seed: this.deterministicSeedText });
    }

    nextRandom() {
      if (!this.deterministic) return Math.random();
      // Linear congruential generator for deterministic test rolls.
      this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
      return this.randomState / 0x100000000;
    }

    init() {
      const container = document.getElementById('diceRollerContainer');
      if (!container) this.createContainer();
      initDiceWindowSystem();
      
      this.canvas = document.getElementById('diceRollerCanvas');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'diceRollerCanvas';
        this.canvas.width = 640;
        this.canvas.height = 480;
        document.getElementById('diceRollerContainer').appendChild(this.canvas);
      }
      
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    }

    createContainer() {
      if (document.getElementById('diceRollerContainer')) return;
      
      const container = document.createElement('div');
      container.id = 'diceRollerContainer';
      container.innerHTML = `
        <div id="diceRollerModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:5300;backdrop-filter:blur(8px);">
          <div id="diceRollerWindow" style="position:fixed;left:50%;top:8vh;transform:translateX(-50%);background:rgba(11,12,26,.98);border:2px solid rgba(201,162,39,.4);border-radius:12px;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,.6),0 0 1px rgba(201,162,39,.3) inset;max-width:680px;width:90%;min-width:340px;min-height:260px;max-height:88vh;display:flex;flex-direction:column;">
            <div id="diceRollerHeader" style="background:linear-gradient(180deg,rgba(201,162,39,.12) 0%,rgba(201,162,39,.02) 100%);border-bottom:1px solid rgba(201,162,39,.2);padding:.75rem .85rem;display:flex;justify-content:space-between;align-items:flex-start;gap:.55rem;cursor:move;user-select:none;">
              <div style="font-family:'Cinzel',serif;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold2);">⚄ Dice Widget</div>
              <div style="display:flex;gap:.25rem;align-items:center;flex-wrap:wrap;">
                <button id="diceRollerDockLeft" class="btn btn-xs" type="button">Dock Left</button>
                <button id="diceRollerDockRight" class="btn btn-xs" type="button">Dock Right</button>
                <button id="diceRollerFullscreen" class="btn btn-xs" type="button">Fullscreen</button>
                <button id="diceRollerFloat" class="btn btn-xs" type="button">Float</button>
                <button onclick="closeDiceRoller()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:1.2rem;line-height:1;">✕</button>
              </div>
            </div>
            <div style="padding:1rem;background:rgba(6,7,14,.5);overflow:auto;flex:1;">
              <canvas id="diceRollerCanvas" width="640" height="480" style="max-width:100%;border-radius:8px;display:block;margin:0 auto;border:1px solid rgba(201,162,39,.15);"></canvas>
              <div id="diceRollerControls" style="margin-top:1rem;"></div>
            </div>
            <div style="background:linear-gradient(180deg,rgba(201,162,39,.02) 0%,rgba(201,162,39,.08) 100%);border-top:1px solid rgba(201,162,39,.2);padding:1rem;display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap;">
              <div id="diceRollerResult" style="flex:1;min-height:2rem;display:flex;align-items:center;font-size:.9rem;color:var(--teal);font-family:'Rajdhani',sans-serif;font-weight:600;"></div>
              <button onclick="closeDiceRoller()" class="btn btn-sm">Close</button>
            </div>
            <div id="diceRollerResizeHandle" style="position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 40%,rgba(232,192,80,.45) 40%,rgba(232,192,80,.45) 52%,transparent 52%,transparent 62%,rgba(232,192,80,.45) 62%,rgba(232,192,80,.45) 74%,transparent 74%);"></div>
          </div>
        </div>
      `;
      document.body.appendChild(container);
    }

    resizeCanvas() {
      if (!this.canvas) return;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = Math.floor(rect.width * window.devicePixelRatio);
      this.canvas.height = Math.floor(rect.height * window.devicePixelRatio);
      this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    }

    roll(diceString) {
      const parsed = parseDiceNotation(diceString);
      if (!parsed.ok) {
        console.error('Invalid dice string:', diceString, parsed.error);
        const resultEl = document.getElementById('diceRollerResult');
        if (resultEl) {
          resultEl.innerHTML = `<span style="color:var(--red2);">⚠ ${parsed.error}</span>`;
        }
        return null;
      }

      const pool = parsed.terms.map(term => ({
        sides: term.sides,
        count: term.count,
        label: `${term.sign < 0 ? '-' : ''}${term.count}d${term.sides}${term.keepKind === 'all' ? '' : `${term.keepKind}${term.keepCount}`}`,
        termId: term.id,
        termSign: term.sign,
        keepKind: term.keepKind,
        keepCount: term.keepCount
      }));

      this.initMixedRoll(pool, parsed.modifier, {
        mode: 'notation',
        rollPlan: parsed
      });
      return this;
    }

    initRoll(count, diceType, bonus = 0) {
      this.dice = [];
      this.results = [];
      this.timeElapsed = 0;
      this.isAnimating = true;
      this.bonus = bonus;
      this.diceType = diceType;
      this.presetValues = null;
      this.effectPhase = null;
      this.effectTimer = 0;
      this.rollMode = 'sum';
      this.resultAggregator = null;
      this.rollPlan = null;
      PARTICLE_POOL.length = 0;

      // Create dice with random initial velocities
      const startX = this.canvas.width / 2;
      const startY = this.canvas.height / 2;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const velocity = 8 + this.nextRandom() * 4;
        
        const die = {
          id: i,
          type: diceType,
          x: startX + Math.cos(angle) * 40,
          y: startY + Math.sin(angle) * 40,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity - 2,
          rotX: this.nextRandom() * Math.PI * 2,
          rotY: this.nextRandom() * Math.PI * 2,
          rotZ: this.nextRandom() * Math.PI * 2,
          angVelX: (this.nextRandom() - 0.5) * 0.3,
          angVelY: (this.nextRandom() - 0.5) * 0.3,
          angVelZ: (this.nextRandom() - 0.5) * 0.3,
          settled: false,
          settledValue: null
        };
        this.dice.push(die);
      }

      this.animate();
    }

    initMixedRoll(pool, bonus = 0, options = {}) {
      const safePool = Array.isArray(pool) ? pool.map(entry => {
        const sides = Math.max(2, Number(entry && entry.sides || entry || 20));
        const count = Math.max(1, Number(entry && entry.count || 1));
        return {
          sides,
          count,
          label: String(entry && entry.label || `d${sides}`)
        };
      }).filter(entry => entry.count > 0) : [];
      if (!safePool.length) return null;
      this.dice = [];
      this.results = [];
      this.timeElapsed = 0;
      this.isAnimating = true;
      this.bonus = Number(bonus || 0);
      this.diceType = 'mixed';
      this.presetValues = null;
      this.effectPhase = null;
      this.effectTimer = 0;
      this.rollMode = String(options.mode || 'sum');
      this.resultAggregator = typeof options.aggregate === 'function' ? options.aggregate : null;
      this.rollPlan = options.rollPlan && typeof options.rollPlan === 'object' ? options.rollPlan : null;
      PARTICLE_POOL.length = 0;

      const startX = this.canvas.width / 2;
      const startY = this.canvas.height / 2;
      const totalDice = safePool.reduce((sum, entry) => sum + entry.count, 0);
      let index = 0;
      safePool.forEach(entry => {
        for (let i = 0; i < entry.count; i++) {
          const angle = (Math.PI * 2 * index) / Math.max(1, totalDice);
          const velocity = 8 + this.nextRandom() * 4;
          const dieType = `d${entry.sides}`;
          const die = {
            id: index,
            type: dieType,
            x: startX + Math.cos(angle) * 40,
            y: startY + Math.sin(angle) * 40,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity - 2,
            rotX: this.nextRandom() * Math.PI * 2,
            rotY: this.nextRandom() * Math.PI * 2,
            rotZ: this.nextRandom() * Math.PI * 2,
            angVelX: (this.nextRandom() - 0.5) * 0.3,
            angVelY: (this.nextRandom() - 0.5) * 0.3,
            angVelZ: (this.nextRandom() - 0.5) * 0.3,
            settled: false,
            settledValue: null,
            poolLabel: entry.label,
            termId: Number(entry.termId),
            termSign: Number(entry.termSign || 1),
            keepKind: String(entry.keepKind || 'all'),
            keepCount: Math.max(1, Number(entry.keepCount || entry.count || 1))
          };
          this.dice.push(die);
          index += 1;
        }
      });

      this.animate();
      return this;
    }

    rollPreset(sides, values, bonus = 0) {
      if (Array.isArray(sides)) {
        const pool = sides;
        const mixedBonus = typeof values === 'number' ? values : Number(bonus || 0);
        const mixedOptions = values && typeof values === 'object' && !Array.isArray(values)
          ? values
          : {};
        return this.initMixedRoll(pool, mixedBonus, mixedOptions);
      }

      const safeSides = Math.max(2, Number(sides || 20));
      const safeValues = Array.isArray(values) ? values.map(v => Math.max(1, Math.min(safeSides, Number(v || 1)))) : [];
      if (!safeValues.length) return null;
      const diceKey = `d${safeSides}`;
      if (!DICE_CONFIG[diceKey]) return null;
      this.initRoll(safeValues.length, diceKey, Number(bonus || 0));
      this.presetValues = safeValues.slice();
      for (let i = 0; i < this.dice.length; i++) {
        if (!this.dice[i]) continue;
        this.dice[i].presetValue = this.presetValues[i % this.presetValues.length];
      }
      return this;
    }

    animate = () => {
      this.timeElapsed += 16; // ~60fps

      // Update physics
      this.dice.forEach(die => {
        if (die.settled) return;

        // Gravity
        die.vy += this.gravity * 100;

        // Damping
        die.vx *= this.damping;
        die.vy *= this.damping;

        // Position
        die.x += die.vx;
        die.y += die.vy;

        // Rotation
        die.rotX += die.angVelX;
        die.rotY += die.angVelY;
        die.rotZ += die.angVelZ;

        // Bouncing off walls
        if (die.x - this.diceSize / 2 < 20) {
          die.x = this.diceSize / 2 + 20;
          die.vx = Math.abs(die.vx) * 0.7;
        }
        if (die.x + this.diceSize / 2 > this.canvas.width - 20) {
          die.x = this.canvas.width - this.diceSize / 2 - 20;
          die.vx = -Math.abs(die.vx) * 0.7;
        }
        if (die.y - this.diceSize / 2 < 20) {
          die.y = this.diceSize / 2 + 20;
          die.vy = Math.abs(die.vy) * 0.7;
        }

        // Bottom floor - settle dice
        if (die.y + this.diceSize / 2 > this.canvas.height - 20) {
          die.y = this.canvas.height - this.diceSize / 2 - 20;
          die.vy = die.vy > 0 ? -die.vy * 0.6 : 0;
          die.vx *= 0.9;

          // Check if settled
          const speed = Math.sqrt(die.vx ** 2 + die.vy ** 2);
          if (speed < 0.3 && this.timeElapsed > 600) {
            die.settled = true;
            die.settledValue = this.getDiceResult(die);
          }
        }
      });

      // Draw
      this.draw();

      // Check if all settled or time exceeded
      const allSettled = this.dice.every(d => d.settled);
      if (allSettled || this.timeElapsed > this.totalAnimationTime) {
        this.isAnimating = false;
        this.finishRoll();
      } else {
        this.animationFrameId = requestAnimationFrame(this.animate);
      }
    }

    draw() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Background gradient
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, 'rgba(11,14,28,.2)');
      gradient.addColorStop(1, 'rgba(6,7,14,.4)');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Border
      this.ctx.strokeStyle = 'rgba(201,162,39,.15)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);

      // Draw floor line
      this.ctx.strokeStyle = 'rgba(201,162,39,.1)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, this.canvas.height - 20);
      this.ctx.lineTo(this.canvas.width, this.canvas.height - 20);
      this.ctx.stroke();

      // Draw particles (effects layer behind dice)
      updateAndDrawParticles(this.ctx);

      // Draw dice
      this.dice.forEach(die => {
        this.drawDice(die);
      });

      // Nat-20 flash overlay
      if (this.effectPhase === 'nat20') {
        const t = Math.min(1, this.effectTimer / 300);
        const alpha = t < 0.5 ? t * 2 * 0.35 : (1 - t) * 0.35;
        this.ctx.save();
        this.ctx.fillStyle = `rgba(227,188,94,${alpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = `bold ${Math.round(32 + t * 20)}px Cinzel, serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = `rgba(255,255,255,${Math.min(1, t * 3)})`;
        this.ctx.fillText('NAT 20!', this.canvas.width / 2, this.canvas.height / 2 - 20);
        this.ctx.restore();
      }

      // Nat-1 sad overlay
      if (this.effectPhase === 'nat1') {
        const t = Math.min(1, this.effectTimer / 300);
        const alpha = t < 0.5 ? t * 2 * 0.2 : (1 - t) * 0.2;
        this.ctx.save();
        this.ctx.fillStyle = `rgba(80,80,80,${alpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = `bold ${Math.round(26 + t * 10)}px Cinzel, serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = `rgba(200,200,200,${Math.min(1, t * 3)})`;
        this.ctx.fillText('Nat 1... 😬', this.canvas.width / 2, this.canvas.height / 2 - 20);
        this.ctx.restore();
      }
    }

    drawDice(die) {
      const skin = getActiveSkin();
      const baseColor = skin.colors[die.type] || DICE_CONFIG[die.type].color;
      const x = die.x;
      const y = die.y;
      const size = this.diceSize;

      this.ctx.save();
      this.ctx.translate(x, y);

      // Apply rotation
      this.ctx.rotate(die.rotZ);
      this.ctx.rotate(die.rotY);
      this.ctx.rotate(die.rotX);

      // Skin glow when settled
      if (die.settled && skin.glowColor) {
        this.ctx.shadowColor = skin.glowColor;
        this.ctx.shadowBlur = 14;
      }

      // Draw die cube with shading
      this.ctx.fillStyle = baseColor;
      this.ctx.strokeStyle = skin.edgeColor || 'rgba(255,255,255,.2)';
      this.ctx.lineWidth = die.settled ? 1.5 : 0.5;

      // Front face
      this.ctx.fillRect(-size / 2, -size / 2, size, size);
      this.ctx.strokeRect(-size / 2, -size / 2, size, size);

      // Top face (light)
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = this.lightenColor(baseColor, 0.3);
      this.ctx.beginPath();
      this.ctx.moveTo(-size / 2, -size / 2);
      this.ctx.lineTo(-size / 2 + size / 4, -size / 2 - size / 4);
      this.ctx.lineTo(size / 2 + size / 4, -size / 2 - size / 4);
      this.ctx.lineTo(size / 2, -size / 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Right face (darker)
      this.ctx.fillStyle = this.darkenColor(baseColor, 0.2);
      this.ctx.beginPath();
      this.ctx.moveTo(size / 2, -size / 2);
      this.ctx.lineTo(size / 2 + size / 4, -size / 2 - size / 4);
      this.ctx.lineTo(size / 2 + size / 4, size / 2 - size / 4);
      this.ctx.lineTo(size / 2, size / 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw pip/number indicator
      this.ctx.shadowBlur = 0;
      const skin2 = getActiveSkin();
      this.ctx.fillStyle = skin2.numberColor || '#fff';
      this.ctx.font = 'bold 14px Rajdhani, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      if (die.settledValue) {
        this.ctx.fillText(String(die.settledValue), 0, 0);
      } else {
        this.ctx.font = 'bold 12px Rajdhani, sans-serif';
        this.ctx.fillText('⚄', 0, 0);
      }

      this.ctx.restore();
    }

    getDiceResult(die) {
      if (die && Number.isFinite(Number(die.presetValue))) {
        const safe = Math.max(1, Math.min(DICE_CONFIG[die.type].sides, Number(die.presetValue)));
        return safe;
      }
      const config = DICE_CONFIG[die.type];
      return Math.floor(Math.random() * config.sides) + 1;
    }

    lightenColor(hex, percent) {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, (num >> 16) + percent * 255);
      const g = Math.min(255, ((num >> 8) & 0x00FF) + percent * 255);
      const b = Math.min(255, (num & 0x0000FF) + percent * 255);
      return `rgb(${r},${g},${b})`;
    }

    darkenColor(hex, percent) {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.max(0, (num >> 16) - percent * 255);
      const g = Math.max(0, ((num >> 8) & 0x00FF) - percent * 255);
      const b = Math.max(0, (num & 0x0000FF) - percent * 255);
      return `rgb(${r},${g},${b})`;
    }

    finishRoll() {
      // Calculate results
      this.results = this.dice.map(d => ({
        id: d.id,
        type: d.type,
        value: d.settledValue || this.getDiceResult(d),
        poolLabel: d.poolLabel || d.type,
        termId: Number.isFinite(Number(d.termId)) ? Number(d.termId) : null,
        termSign: Number(d.termSign || 1),
        keepKind: String(d.keepKind || 'all'),
        keepCount: Math.max(1, Number(d.keepCount || 1))
      }));

      const rollValues = this.results.map(r => Number(r.value || 0));
      let total = 0;
      let resultStr = '';
      let breakdownHtml = '';

      if (this.rollPlan && Array.isArray(this.rollPlan.terms) && this.rollPlan.terms.length) {
        const termLines = [];
        let termTotal = 0;
        this.rollPlan.terms.forEach(term => {
          const termRolls = this.results
            .filter(r => Number(r.termId) === Number(term.id))
            .map(r => Number(r.value || 0));
          let kept = termRolls.slice();
          if (term.keepKind === 'kh') {
            kept = termRolls.slice().sort((a, b) => b - a).slice(0, term.keepCount);
          } else if (term.keepKind === 'kl') {
            kept = termRolls.slice().sort((a, b) => a - b).slice(0, term.keepCount);
          }
          const keptSum = kept.reduce((sum, v) => sum + v, 0);
          termTotal += term.sign * keptSum;
          const keepInfo = term.keepKind === 'all' ? '' : ` (${term.keepKind}${term.keepCount}: ${kept.join(', ')})`;
          termLines.push(`${term.sign < 0 ? '-' : '+'} ${term.count}d${term.sides}${term.keepKind === 'all' ? '' : `${term.keepKind}${term.keepCount}`}: [${termRolls.join(', ')}]${keepInfo} => ${term.sign < 0 ? '-' : ''}${keptSum}`);
        });
        total = termTotal + Number(this.rollPlan.modifier || 0);
        resultStr = `${this.rollPlan.notation} = ${total}`;
        breakdownHtml = termLines.map(line => `<div style="margin-bottom:.2rem;">${line}</div>`).join('')
          + `<div style="margin-top:.3rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.25rem;">Modifier: ${Number(this.rollPlan.modifier || 0)} | Total: <strong>${total}</strong></div>`;
      } else {
        const totalBase = typeof this.resultAggregator === 'function'
          ? Number(this.resultAggregator(this.results, this.bonus) || 0)
          : this.rollMode === 'highest'
            ? (rollValues.length ? Math.max.apply(Math, rollValues) : 0) + this.bonus
            : rollValues.reduce((sum, r) => sum + r, 0) + this.bonus;
        total = Number(totalBase || 0);
        resultStr = this.rollMode === 'highest'
          ? `${rollValues.join(' / ')}${formatSignedNumber(this.bonus)} = ${total}`
          : `${rollValues.join(' + ')}${formatSignedNumber(this.bonus)} = ${total}`;
        breakdownHtml = `<div>Rolls: [${rollValues.join(', ')}]</div><div>Modifier: ${Number(this.bonus || 0)} | Total: <strong>${total}</strong></div>`;
      }
      this.lastBreakdown = breakdownHtml;

      // Detect nat 20 / nat 1 for d20 rolls
      const d20Results = this.results.filter(r => r.type === 'd20');
      const hasNat20 = d20Results.some(r => r.value === 20);
      const hasNat1  = d20Results.some(r => r.value === 1);

      // Trigger effect animation
      if (hasNat20 || hasNat1) {
        this.effectPhase = hasNat20 ? 'nat20' : 'nat1';
        this.effectTimer = 0;
        const cx = this.canvas.width / (window.devicePixelRatio || 1) / 2;
        const cy = this.canvas.height / (window.devicePixelRatio || 1) / 2;
        if (hasNat20) triggerNat20Effect(this.ctx, cx, cy);
        else triggerNat1Effect(this.ctx, cx, cy);

        const effectAnimate = () => {
          this.effectTimer += 16;
          this.draw();
          if (this.effectTimer < this.effectDuration) {
            requestAnimationFrame(effectAnimate);
          } else {
            this.effectPhase = null;
            PARTICLE_POOL.length = 0;
            this.draw();
          }
        };
        requestAnimationFrame(effectAnimate);
      }

      // Display result
      const resultEl = document.getElementById('diceRollerResult');
      if (resultEl) {
        let badge = '';
        if (hasNat20) badge = '<span style="color:#e3bc5e;font-weight:700;margin-left:.4rem;text-transform:uppercase;letter-spacing:.08em;font-size:.7rem;border:1px solid rgba(227,188,94,.5);padding:.1rem .35rem;border-radius:4px;">Nat 20 🎉</span>';
        else if (hasNat1) badge = '<span style="color:#9fa7bc;font-weight:700;margin-left:.4rem;text-transform:uppercase;letter-spacing:.08em;font-size:.7rem;border:1px solid rgba(159,167,188,.3);padding:.1rem .35rem;border-radius:4px;">Nat 1 😬</span>';
        resultEl.innerHTML = `<span style="color:var(--gold2);margin-right:.5rem;">📊</span>${resultStr}${badge}`;
      }

      const breakdownEl = document.getElementById('diceRollerBreakdown');
      if (breakdownEl) {
        breakdownEl.innerHTML = breakdownHtml;
      }

      this.rollLog.unshift({
        at: Date.now(),
        notation: this.rollPlan && this.rollPlan.notation ? this.rollPlan.notation : `${this.dice.length}${this.diceType}`,
        total,
        mode: this.deterministic ? `deterministic(${this.deterministicSeedText || 'default-seed'})` : 'random',
        summary: resultStr
      });
      if (this.rollLog.length > MAX_ROLL_LOG) this.rollLog.length = MAX_ROLL_LOG;
      renderDiceRollerLog(this.rollLog);

      if (this.onComplete) {
        this.onComplete({
          rolls: this.results,
          bonus: this.bonus,
          total,
          notation: this.rollPlan ? this.rollPlan.notation : '',
          deterministic: this.deterministic,
          seed: this.deterministic ? this.deterministicSeedText : '',
          breakdown: this.lastBreakdown
        });
      }
    }
  }

  // Global instance
  let diceRoller = null;
  const diceWindowState = {
    mode: 'floating',
    x: null,
    y: null,
    width: null,
    height: null,
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    resizing: false,
    resizeStartX: 0,
    resizeStartY: 0,
    resizeStartW: 0,
    resizeStartH: 0
  };

  function getDiceWindowEl() {
    return document.getElementById('diceRollerWindow');
  }

  function clampDiceWindow() {
    const panel = getDiceWindowEl();
    if (!panel || diceWindowState.mode !== 'floating') return;
    const width = Math.max(340, Math.min(window.innerWidth - 12, Number(diceWindowState.width || panel.offsetWidth || 680)));
    const height = Math.max(260, Math.min(window.innerHeight - 12, Number(diceWindowState.height || panel.offsetHeight || 620)));
    const maxX = Math.max(6, window.innerWidth - width - 6);
    const maxY = Math.max(6, window.innerHeight - height - 6);
    let x = Number(diceWindowState.x);
    let y = Number(diceWindowState.y);
    if (!Number.isFinite(x)) x = Math.max(6, (window.innerWidth - width) / 2);
    if (!Number.isFinite(y)) y = Math.max(6, Math.min(window.innerHeight * 0.08, (window.innerHeight - height) / 2));
    diceWindowState.width = width;
    diceWindowState.height = height;
    diceWindowState.x = Math.max(6, Math.min(maxX, x));
    diceWindowState.y = Math.max(6, Math.min(maxY, y));
  }

  function applyDiceWindowMode() {
    const panel = getDiceWindowEl();
    const resize = document.getElementById('diceRollerResizeHandle');
    if (!panel) return;
    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '';
    panel.style.transform = '';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.maxWidth = '';
    panel.style.maxHeight = '';
    panel.style.borderRadius = '12px';
    if (resize) resize.style.display = '';

    if (diceWindowState.mode === 'fullscreen') {
      panel.style.left = '0';
      panel.style.top = '0';
      panel.style.transform = 'none';
      panel.style.width = '100vw';
      panel.style.height = '100vh';
      panel.style.maxWidth = 'none';
      panel.style.maxHeight = 'none';
      panel.style.borderRadius = '0';
      if (resize) resize.style.display = 'none';
      return;
    }
    if (diceWindowState.mode === 'dock-left') {
      panel.style.left = '0';
      panel.style.top = '0';
      panel.style.transform = 'none';
      panel.style.width = 'min(460px, 100vw)';
      panel.style.height = '100vh';
      panel.style.maxWidth = 'none';
      panel.style.maxHeight = 'none';
      panel.style.borderRadius = '0';
      if (resize) resize.style.display = 'none';
      return;
    }
    if (diceWindowState.mode === 'dock-right') {
      panel.style.right = '0';
      panel.style.top = '0';
      panel.style.transform = 'none';
      panel.style.width = 'min(460px, 100vw)';
      panel.style.height = '100vh';
      panel.style.maxWidth = 'none';
      panel.style.maxHeight = 'none';
      panel.style.borderRadius = '0';
      if (resize) resize.style.display = 'none';
      return;
    }

    clampDiceWindow();
    panel.style.left = Math.round(Number(diceWindowState.x || 8)) + 'px';
    panel.style.top = Math.round(Number(diceWindowState.y || 8)) + 'px';
    panel.style.width = Math.round(Number(diceWindowState.width || 680)) + 'px';
    panel.style.height = Math.round(Number(diceWindowState.height || 620)) + 'px';
    panel.style.transform = 'none';
  }

  function setDiceWindowMode(mode) {
    const next = ['floating', 'fullscreen', 'dock-left', 'dock-right'].indexOf(String(mode || 'floating')) >= 0
      ? String(mode)
      : 'floating';
    const panel = getDiceWindowEl();
    if (panel && diceWindowState.mode === 'floating') {
      const rect = panel.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        diceWindowState.x = rect.left;
        diceWindowState.y = rect.top;
        diceWindowState.width = rect.width;
        diceWindowState.height = rect.height;
      }
    }
    diceWindowState.mode = next;
    applyDiceWindowMode();
    if (diceRoller) diceRoller.resizeCanvas();
  }

  function initDiceWindowSystem() {
    if (window._diceWindowSystemReady) return;
    window._diceWindowSystemReady = true;
    const panel = getDiceWindowEl();
    const header = document.getElementById('diceRollerHeader');
    const resize = document.getElementById('diceRollerResizeHandle');
    const dockLeft = document.getElementById('diceRollerDockLeft');
    const dockRight = document.getElementById('diceRollerDockRight');
    const fullscreen = document.getElementById('diceRollerFullscreen');
    const floatBtn = document.getElementById('diceRollerFloat');
    if (!panel) return;

    if (dockLeft) dockLeft.addEventListener('click', () => setDiceWindowMode('dock-left'));
    if (dockRight) dockRight.addEventListener('click', () => setDiceWindowMode('dock-right'));
    if (fullscreen) fullscreen.addEventListener('click', () => setDiceWindowMode(diceWindowState.mode === 'fullscreen' ? 'floating' : 'fullscreen'));
    if (floatBtn) floatBtn.addEventListener('click', () => setDiceWindowMode('floating'));

    if (header) {
      header.addEventListener('mousedown', (evt) => {
        const t = evt.target;
        if (t && t.closest && t.closest('button')) return;
        if (diceWindowState.mode !== 'floating') return;
        const rect = panel.getBoundingClientRect();
        diceWindowState.dragging = true;
        diceWindowState.dragOffsetX = evt.clientX - rect.left;
        diceWindowState.dragOffsetY = evt.clientY - rect.top;
        evt.preventDefault();
      });
    }

    if (resize) {
      resize.addEventListener('mousedown', (evt) => {
        if (diceWindowState.mode !== 'floating') return;
        const rect = panel.getBoundingClientRect();
        diceWindowState.resizing = true;
        diceWindowState.resizeStartX = evt.clientX;
        diceWindowState.resizeStartY = evt.clientY;
        diceWindowState.resizeStartW = rect.width;
        diceWindowState.resizeStartH = rect.height;
        evt.preventDefault();
      });
    }

    document.addEventListener('mousemove', (evt) => {
      if (diceWindowState.dragging && diceWindowState.mode === 'floating') {
        diceWindowState.x = evt.clientX - diceWindowState.dragOffsetX;
        diceWindowState.y = evt.clientY - diceWindowState.dragOffsetY;
        applyDiceWindowMode();
        if (diceRoller) diceRoller.resizeCanvas();
        return;
      }
      if (diceWindowState.resizing && diceWindowState.mode === 'floating') {
        diceWindowState.width = Math.max(340, diceWindowState.resizeStartW + (evt.clientX - diceWindowState.resizeStartX));
        diceWindowState.height = Math.max(260, diceWindowState.resizeStartH + (evt.clientY - diceWindowState.resizeStartY));
        applyDiceWindowMode();
        if (diceRoller) diceRoller.resizeCanvas();
      }
    });
    document.addEventListener('mouseup', () => {
      diceWindowState.dragging = false;
      diceWindowState.resizing = false;
    });
    window.addEventListener('resize', () => {
      applyDiceWindowMode();
      if (diceRoller) diceRoller.resizeCanvas();
    });
  }

  function initializeDiceRoller() {
    if (!diceRoller) {
      diceRoller = new Dice3DRoller();
      diceRoller.init();
    }
  }

  function openDiceRoller() {
    initializeDiceRoller();
    const modal = document.getElementById('diceRollerModal');
    if (modal) {
      modal.style.display = 'block';
      applyDiceWindowMode();
      if (diceRoller) diceRoller.resizeCanvas();
      renderDiceRollerControls();
    }
  }

  function closeDiceRoller() {
    const modal = document.getElementById('diceRollerModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function renderDiceRollerLog(log) {
    const logEl = document.getElementById('diceRollerLog');
    if (!logEl) return;
    const entries = Array.isArray(log) ? log : [];
    if (!entries.length) {
      logEl.innerHTML = '<div style="color:var(--muted2);font-size:.75rem;">No rolls yet.</div>';
      return;
    }
    logEl.innerHTML = entries.slice(0, 10).map(entry => {
      const stamp = new Date(Number(entry.at || Date.now())).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `<div style="padding:.3rem .4rem;border-bottom:1px solid rgba(255,255,255,.06);font-size:.74rem;">
        <div style="display:flex;justify-content:space-between;gap:.4rem;"><span style="color:var(--gold2);">${entry.notation || 'roll'}</span><span style="color:var(--muted2);">${stamp}</span></div>
        <div style="color:var(--text);">${entry.summary || ''}</div>
        <div style="color:var(--muted2);">${entry.mode || 'random'}</div>
      </div>`;
    }).join('');
  }

  function renderDiceRollerControls() {
    const controlsEl = document.getElementById('diceRollerControls');
    if (!controlsEl) return;

    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
    const counts = [1, 2, 3, 4, 5];
    const activeSkinKey = (() => { try { return localStorage.getItem(SKIN_STORAGE_KEY) || 'classic'; } catch(e) { return 'classic'; } })();
    const soulStatOptions = SOUL_WIDGET_STATS.map(entry => {
      const die = getSoulStatDie(entry.key);
      return `<option value="${entry.key}">${entry.label} (d${die})</option>`;
    }).join('');

    // ── Skin selector row ──────────────────────────────────────────────────
    let skinHtml = `<div style="margin-bottom:.8rem;">
      <div style="font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:.4rem;">Dice Skin</div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap;">`;
    Object.entries(DICE_SKINS).forEach(([key, skin]) => {
      const active = key === activeSkinKey;
      skinHtml += `<button class="dice-skin-btn" data-skin="${key}" title="${skin.label}" style="
        background:${active ? 'rgba(227,188,94,.22)' : 'rgba(255,255,255,.05)'};
        border:2px solid ${active ? 'rgba(227,188,94,.7)' : 'rgba(255,255,255,.12)'};
        color:var(--text);border-radius:6px;padding:.3rem .5rem;cursor:pointer;font-size:.78rem;
        transition:all .15s;">${skin.icon} ${skin.label}</button>`;
    });
    skinHtml += `</div></div>`;

    const deterministicChecked = diceRoller && diceRoller.deterministic ? 'checked' : '';
    const deterministicSeed = diceRoller && diceRoller.deterministicSeedText ? diceRoller.deterministicSeedText : '';

    let html = skinHtml + `
      <div style="margin-bottom:.8rem;display:grid;grid-template-columns:2fr 1fr auto;gap:.45rem;align-items:end;">
        <div>
          <label style="font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:.25rem;">Notation</label>
          <input id="diceNotationInput" type="text" placeholder="e.g. 2d20kh1 + 4 - 1d4" style="background:var(--surface);border:1px solid var(--border2);color:var(--text);padding:.45rem .55rem;border-radius:4px;width:100%;font-size:.82rem;">
        </div>
        <div>
          <label style="font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:.25rem;">Test Seed</label>
          <input id="diceDeterministicSeed" type="text" value="${deterministicSeed.replace(/"/g, '&quot;')}" placeholder="seed" style="background:var(--surface);border:1px solid var(--border2);color:var(--text);padding:.45rem .5rem;border-radius:4px;width:100%;font-size:.8rem;">
        </div>
        <label style="display:flex;align-items:center;gap:.35rem;font-size:.76rem;color:var(--text);margin-bottom:.1rem;">
          <input id="diceDeterministicToggle" type="checkbox" ${deterministicChecked}>
          Deterministic
        </label>
      </div>
      <div style="margin-bottom:1rem;border:1px solid rgba(232,192,80,.24);background:rgba(232,192,80,.05);border-radius:8px;padding:.65rem;">
        <div style="font-family:'Cinzel',serif;font-size:.69rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold2);margin-bottom:.45rem;">VTT Dice Widget</div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;">
          <div>
            <label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Soul Array Stat</label>
            <select id="diceWidgetSoulStat" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.35rem .45rem;border-radius:4px;width:100%;font-size:.8rem;">${soulStatOptions}</select>
          </div>
          <div>
            <label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Action Die Source</label>
            <select id="diceWidgetActionSource" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.35rem .45rem;border-radius:4px;width:100%;font-size:.8rem;">
              <option value="soul">Use Soul Stat Die</option>
              <option value="d4">d4</option>
              <option value="d6">d6</option>
              <option value="d8">d8</option>
              <option value="d10">d10</option>
              <option value="d12">d12</option>
              <option value="d20">d20</option>
            </select>
          </div>
          <div>
            <label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Dread Die</label>
            <select id="diceWidgetDreadDie" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.35rem .45rem;border-radius:4px;width:100%;font-size:.8rem;">
              <option value="4">d4</option>
              <option value="6">d6</option>
              <option value="8" selected>d8</option>
              <option value="10">d10</option>
              <option value="12">d12</option>
              <option value="20">d20</option>
            </select>
          </div>
          <div>
            <label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Action Dice Count</label>
            <input id="diceWidgetActionCount" type="number" min="1" max="5" value="1" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.35rem .45rem;border-radius:4px;width:100%;font-size:.8rem;">
          </div>
          <div>
            <label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Modifier</label>
            <input id="diceWidgetModifier" type="number" min="-20" max="20" value="0" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.35rem .45rem;border-radius:4px;width:100%;font-size:.8rem;">
          </div>
          <div>
            <label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Roll Mode</label>
            <select id="diceWidgetAdvMode" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.35rem .45rem;border-radius:4px;width:100%;font-size:.8rem;">
              <option value="none" selected>Normal</option>
              <option value="adv">Advantage</option>
              <option value="dis">Disadvantage</option>
            </select>
          </div>
        </div>
        <button id="diceWidgetRollBtn" class="btn btn-sm btn-teal" type="button" style="margin-top:.55rem;">Roll Widget Check</button>
        <div id="diceWidgetSummary" style="margin-top:.4rem;font-size:.74rem;color:var(--muted2);line-height:1.5;">Roll Body/Mind/etc vs a Dread die. Results auto-post to campaign shared chat when connected.</div>
      </div>
      <div style="margin-bottom:1rem;">
        <div style="font-family:'Cinzel',serif;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:.5rem;">Select Dice</div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:.4rem;">
    `;

    diceTypes.forEach(type => {
      const config = DICE_CONFIG[type];
      html += `
        <button class="dice-btn" data-type="${type}" style="
          background:${config.color};
          border:2px solid rgba(255,255,255,.1);
          color:#fff;
          padding:.5rem;
          font-weight:700;
          border-radius:6px;
          cursor:pointer;
          transition:all .15s;
          font-family:'Rajdhani',sans-serif;
        " onmouseover="this.style.borderColor='rgba(255,255,255,.4)'" onmouseout="this.style.borderColor='rgba(255,255,255,.1)'">${type}</button>
      `;
    });

    html += `
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;">
        <div>
          <label style="font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:.35rem;">Count</label>
          <div style="display:flex;gap:.25rem;flex-wrap:wrap;">
    `;

    counts.forEach(count => {
      html += `
        <button class="count-btn" data-count="${count}" style="
          background:rgba(46,196,182,.2);
          border:1px solid var(--teal);
          color:var(--teal);
          padding:.4rem .6rem;
          border-radius:4px;
          cursor:pointer;
          font-size:.8rem;
          font-weight:600;
          transition:all .15s;
        " onmouseover="this.style.background='rgba(46,196,182,.35)'" onmouseout="this.style.background='rgba(46,196,182,.2)'">${count}</button>
      `;
    });

    html += `
          </div>
        </div>
        <div>
          <label style="font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:.35rem;">Bonus</label>
          <input type="number" id="bonusInput" value="0" min="-10" max="20" style="
            background:var(--surface);
            border:1px solid var(--border2);
            color:var(--text);
            padding:.5rem;
            border-radius:4px;
            width:100%;
            font-size:.9rem;
          ">
        </div>
      </div>
      <button onclick="rollDiceFromUI()" style="
        margin-top:1rem;
        background:linear-gradient(180deg,rgba(73,201,187,.3) 0%,rgba(73,201,187,.1) 100%);
        border:2px solid var(--teal);
        color:var(--teal);
        padding:.7rem 1.5rem;
        border-radius:6px;
        font-family:'Cinzel',serif;
        font-size:.85rem;
        letter-spacing:.12em;
        text-transform:uppercase;
        cursor:pointer;
        font-weight:600;
        transition:all .2s;
        width:100%;
      " onmouseover="this.style.background='linear-gradient(180deg,rgba(73,201,187,.5) 0%,rgba(73,201,187,.2) 100%)';this.style.borderColor='rgba(73,201,187,.8)'" onmouseout="this.style.background='linear-gradient(180deg,rgba(73,201,187,.3) 0%,rgba(73,201,187,.1) 100%)';this.style.borderColor='var(--teal)'">
        🎲 Roll Dice
      </button>
      <div id="diceRollerBreakdown" style="margin-top:.7rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:.5rem .6rem;min-height:2.2rem;font-size:.76rem;color:var(--text2);"></div>
      <div style="margin-top:.6rem;">
        <div style="font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:.25rem;">Roll Log</div>
        <div id="diceRollerLog" style="max-height:180px;overflow:auto;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.08);border-radius:6px;"></div>
      </div>
    `;

    controlsEl.innerHTML = html;

    // Skin selection
    document.querySelectorAll('.dice-skin-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        setActiveSkin(this.dataset.skin);
        renderDiceRollerControls();
      });
    });

    // Setup event listeners
    let selectedDice = 'd20';
    let selectedCount = 1;

    document.querySelectorAll('.dice-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.dice-btn').forEach(b => b.style.opacity = '0.6');
        this.style.opacity = '1';
        selectedDice = this.dataset.type;
      });
    });

    document.querySelectorAll('.count-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.count-btn').forEach(b => b.style.background = 'rgba(46,196,182,.2)');
        this.style.background = 'rgba(46,196,182,.5)';
        selectedCount = parseInt(this.dataset.count);
      });
    });

    // Set defaults selected
    const defaultDiceBtn = document.querySelector('[data-type="d20"]');
    if (defaultDiceBtn) defaultDiceBtn.style.opacity = '1';
    const defaultCountBtn = document.querySelector('[data-count="1"]');
    if (defaultCountBtn) defaultCountBtn.style.background = 'rgba(46,196,182,.5)';

    const deterministicToggle = document.getElementById('diceDeterministicToggle');
    const deterministicSeedInput = document.getElementById('diceDeterministicSeed');
    if (deterministicToggle && deterministicSeedInput && diceRoller) {
      const applyDeterministicSettings = () => {
        diceRoller.setDeterministicMode(!!deterministicToggle.checked, deterministicSeedInput.value || 'default-seed');
      };
      deterministicToggle.addEventListener('change', applyDeterministicSettings);
      deterministicSeedInput.addEventListener('change', applyDeterministicSettings);
      deterministicSeedInput.addEventListener('blur', applyDeterministicSettings);
    }

    const widgetBtn = document.getElementById('diceWidgetRollBtn');
    if (widgetBtn) {
      widgetBtn.addEventListener('click', function () {
        rollDiceWidgetFromUI();
      });
    }

    if (diceRoller) {
      renderDiceRollerLog(diceRoller.rollLog);
      const breakdownEl = document.getElementById('diceRollerBreakdown');
      if (breakdownEl && diceRoller.lastBreakdown) breakdownEl.innerHTML = diceRoller.lastBreakdown;
    }
  }

  function rollDiceWidgetFromUI() {
    if (!diceRoller) initializeDiceRoller();

    const statKey = String(document.getElementById('diceWidgetSoulStat')?.value || 'body');
    const actionSource = String(document.getElementById('diceWidgetActionSource')?.value || 'soul');
    const dreadDie = clampDieStep(Number(document.getElementById('diceWidgetDreadDie')?.value || 8));
    const mode = String(document.getElementById('diceWidgetAdvMode')?.value || 'none');
    const actionCount = Math.max(1, Math.min(5, Number(document.getElementById('diceWidgetActionCount')?.value || 1)));
    const modifier = Number(document.getElementById('diceWidgetModifier')?.value || 0);

    const baseSoulDie = getSoulStatDie(statKey);
    const sourceDie = actionSource === 'soul' ? baseSoulDie : clampDieStep(Number(String(actionSource || 'd6').replace(/d/gi, '')));
    const conditionedDie = stepDie(sourceDie, getConditionStepShift(statKey));
    const actionDiceToRoll = (mode === 'adv' || mode === 'dis') ? Math.max(2, actionCount) : actionCount;

    const summaryEl = document.getElementById('diceWidgetSummary');
    if (summaryEl) {
      summaryEl.innerHTML = 'Rolling ' + actionDiceToRoll + 'd' + conditionedDie + ' vs d' + dreadDie + '...';
    }

    const priorOnComplete = diceRoller.onComplete;
    diceRoller.onComplete = function widgetComplete(payload) {
      const rolls = Array.isArray(payload && payload.rolls) ? payload.rolls : [];
      const actionRolls = rolls.filter((r) => Number(r && r.termId) === 7001).map((r) => Number(r.value || 0));
      const dreadRoll = rolls.find((r) => Number(r && r.termId) === 7002);
      const dreadTotal = Number(dreadRoll && dreadRoll.value || 0);
      const pickedAction = mode === 'adv'
        ? (actionRolls.length ? Math.max.apply(Math, actionRolls) : 0)
        : mode === 'dis'
          ? (actionRolls.length ? Math.min.apply(Math, actionRolls) : 0)
          : actionRolls.reduce((sum, val) => sum + val, 0);
      const actionTotal = pickedAction + modifier;
      const success = actionTotal >= dreadTotal;
      const modeLabel = mode === 'adv' ? 'Advantage' : mode === 'dis' ? 'Disadvantage' : 'Normal';
      const statLabel = getSoulLabel(statKey);
      const sourceLabel = actionSource === 'soul' ? `${statLabel} Soul Die` : `Manual d${sourceDie}`;
      const actor = (typeof window !== 'undefined' && window.S && window.S.name) ? String(window.S.name || 'Wayfarer') : 'Wayfarer';

      const resultEl = document.getElementById('diceRollerResult');
      if (resultEl) {
        resultEl.innerHTML = `<span style="color:var(--gold2);margin-right:.5rem;">⚔</span>${statLabel} ${modeLabel}: <strong style="color:${success ? 'var(--green2)' : 'var(--red2)'};">${actionTotal}</strong> vs Dread ${dreadTotal}`;
      }

      const breakdown = ''
        + `<div><strong>${statLabel}</strong> (${sourceLabel}) | Mode: ${modeLabel}</div>`
        + `<div>Action rolls: [${actionRolls.join(', ')}]${mode === 'none' ? ' (sum)' : (mode === 'adv' ? ' (highest kept)' : ' (lowest kept)')}</div>`
        + `<div>Picked action total: ${pickedAction}</div>`
        + `<div>Modifier: ${modifier >= 0 ? '+' : ''}${modifier}</div>`
        + `<div>Dread d${dreadDie}: ${dreadTotal}</div>`
        + `<div style="margin-top:.2rem;color:${success ? 'var(--green2)' : 'var(--red2)'};"><strong>${success ? 'SUCCESS' : 'FAILURE'}</strong> (${actionTotal} vs ${dreadTotal})</div>`;
      const breakdownEl = document.getElementById('diceRollerBreakdown');
      if (breakdownEl) breakdownEl.innerHTML = breakdown;

      const chatSummary = `${actor} | ${statLabel} ${modeLabel} | Action [${actionRolls.join(', ')}] => ${pickedAction}${modifier ? (modifier > 0 ? ' + ' + modifier : ' - ' + Math.abs(modifier)) : ''} = ${actionTotal} vs Dread d${dreadDie}=${dreadTotal} => ${success ? 'SUCCESS' : 'FAILURE'}`;
      if (summaryEl) {
        summaryEl.innerHTML = `${success ? 'Success' : 'Failure'} posted to campaign chat when connected.<br>${chatSummary}`;
      }

      if (typeof window !== 'undefined' && window.campaignSystem && typeof window.campaignSystem.broadcastRollResult === 'function') {
        window.campaignSystem.broadcastRollResult('Dice Widget', chatSummary);
      }

      if (typeof priorOnComplete === 'function') {
        try { priorOnComplete(payload); } catch (_err) {}
      }
      diceRoller.onComplete = priorOnComplete;
    };

    const pool = [
      {
        sides: conditionedDie,
        count: actionDiceToRoll,
        label: 'Action',
        termId: 7001,
        termSign: 1,
        keepKind: 'all',
        keepCount: actionDiceToRoll
      },
      {
        sides: dreadDie,
        count: 1,
        label: 'Dread',
        termId: 7002,
        termSign: 1,
        keepKind: 'all',
        keepCount: 1
      }
    ];
    diceRoller.initMixedRoll(pool, 0, { mode: 'sum' });
  }

  function rollDiceFromUI() {
    if (!diceRoller) initializeDiceRoller();

    const notationInput = document.getElementById('diceNotationInput');
    const notation = String(notationInput && notationInput.value || '').trim();
    if (notation) {
      diceRoller.roll(notation);
      return;
    }

    const selectedType = document.querySelector('.dice-btn[style*="opacity: 1"]')?.dataset.type || 'd20';
    const selectedCount = parseInt(document.querySelector('.count-btn[style*="background: rgba(46, 196, 182, 0.5)"]')?.dataset.count || 1);
    const bonus = parseInt(document.getElementById('bonusInput')?.value || 0);

    const diceString = `${selectedCount}${selectedType}${bonus ? '+' + bonus : ''}`;
    diceRoller.roll(diceString);
  }

  function rollMixed3DDice(pool, bonus, options, onComplete) {
    initializeDiceRoller();
    const modal = document.getElementById('diceRollerModal');
    if (modal) {
      modal.style.display = 'block';
      applyDiceWindowMode();
      if (diceRoller) diceRoller.resizeCanvas();
    }
    if (typeof onComplete === 'function') diceRoller.onComplete = onComplete;
    const safeOptions = options && typeof options === 'object' ? options : {};
    return diceRoller.initMixedRoll(pool, bonus || 0, safeOptions);
  }

  // Expose to window
  window.initializeDiceRoller = initializeDiceRoller;
  window.openDiceRoller = openDiceRoller;
  window.closeDiceRoller = closeDiceRoller;
  window.rollDiceFromUI = rollDiceFromUI;
  window.rollDiceWidgetFromUI = rollDiceWidgetFromUI;
  window.rollMixed3DDice = rollMixed3DDice;
  window.Dice3DRoller = Dice3DRoller;
  window.DICE_SKINS = DICE_SKINS;
  window.getDiceActiveSkin = getActiveSkin;
  window.setDiceActiveSkin = function(key) { setActiveSkin(key); renderDiceRollerControls(); };
  window.setDiceDeterministicMode = function(enabled, seed) {
    initializeDiceRoller();
    diceRoller.setDeterministicMode(!!enabled, String(seed || 'default-seed'));
    renderDiceRollerControls();
  };
  window.getDiceRollLog = function() {
    initializeDiceRoller();
    return (diceRoller.rollLog || []).slice();
  };
  window.rollPreset3DDice = function(sides, values, bonus, onComplete) {
    initializeDiceRoller();
    const modal = document.getElementById('diceRollerModal');
    if (modal) {
      modal.style.display = 'block';
      applyDiceWindowMode();
      if (diceRoller) diceRoller.resizeCanvas();
    }
    if (typeof onComplete === 'function') diceRoller.onComplete = onComplete;
      if (Array.isArray(sides)) {
        const mixedBonus = typeof values === 'number' ? values : Number(bonus || 0);
        const mixedOptions = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
        return diceRoller.initMixedRoll(sides, mixedBonus, mixedOptions);
      }
      return diceRoller.rollPreset(sides, values, bonus || 0);
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDiceRoller);
  } else {
    initializeDiceRoller();
  }
})();

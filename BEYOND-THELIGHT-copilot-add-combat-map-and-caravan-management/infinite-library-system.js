// infinite-library-system.js
(function () {
  function rollDie(max) {
    if (typeof roll === 'function') return roll(max);
    return 1 + Math.floor(Math.random() * max);
  }

  function statDie(stat) {
    if (typeof getEffectiveDie === 'function') return Math.max(4, Number(getEffectiveDie(stat) || 4));
    if (typeof getStat === 'function') return Math.max(4, Number(getStat(stat) || 4));
    return 6;
  }

  function pick(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return list[Math.floor(Math.random() * list.length)] || list[0];
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  var LIBRARY_TIERS = [4, 6, 8, 10, 12, 20];

  var LIBRARY_AXIAL_DIRECTIONS = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 }
  ];

  var LIBRARY_NODE_TYPES = [
    'Entrance Desk', 'Reading Room', 'Encounter Hex', 'Encounter Hex', 'Word Storm', 'Portal Niche',
    'Elevator Shaft', 'Spider Archive', 'Owl Cult Worksite', 'Mutable Wing', 'Sentence Forge', 'Stairwell'
  ];

  var LIBRARY_AREAS = [
    'Catalog Atrium', 'Broken Index', 'Basilica Stacks', 'Whisper Annex', 'Ink Reservoir', 'Trial Shelves', 'Null Reference Wing'
  ];

  var LIBRARY_MERCHANT_STASH = [
    'Med-Kit', 'Stimulant', 'Wound Salve', 'Ration Kit', 'Tool Kit'
  ];

  var LIBRARY_FLAVOR_LINES = [
    'Archive-Sighted: you notice routes hidden in marginalia.',
    'Ink-Lung: old paper and smoke calm your breathing under pressure.',
    'Shelf-Runner: movement through cluttered stacks feels effortless.',
    'Codex Ear: distant whispers become legible hints.'
  ];

  var LIBRARY_AMBIENCE = [
    'Shelves breathe in and out as if the room itself is reading.',
    'Candles relight behind you in the exact shape of your footprints.',
    'Ink drifts in the air and settles into temporary constellations.',
    'The architecture rearranges when nobody is looking directly at it.',
    'Whispers in three languages repeat your next sentence before you speak.'
  ];

  var BOOK_WEIRDNESS = [
    'A biography of someone who has not been born yet, but resembles your party.',
    'A legal code where every law applies only while read aloud.',
    'A romance written by two rival gods arguing in the margins.',
    'A map that redraws the room to match your emotional state.',
    'A hymnbook where each verse alters gravity for a heartbeat.',
    'A glossary that erases one noun from your memory each time you blink.'
  ];

  var ENVIRONMENT_SHIFTS = [
    'Aisles stretch into canyons of stacked atlases.',
    'All wood hardens into wax and slowly melts upward.',
    'Every unlabeled shelf grows black feathers.',
    'Loose words float free as neon glyphs near the ceiling.',
    'Floor tiles become index cards and slide underfoot.',
    'Rain falls indoors, but only on open books.'
  ];

  var LIBRARY_ENCOUNTERS = [
    { min: 1, max: 4, name: 'Elevator', depth: 'any', blurb: 'A brass lift clings to impossible shelves.' },
    { min: 5, max: 5, name: 'Portal', depth: 'any', blurb: 'Rune-plates hum; destination unknown.' },
    { min: 6, max: 6, name: 'Page Knights', depth: 'any', blurb: 'Book-bound guardians challenge your passage.' },
    { min: 7, max: 7, name: 'Owl Cultists', depth: 'shallow,deep', blurb: 'Masked delvers wire machinery deeper down.' },
    { min: 8, max: 8, name: 'Spider Archivist', depth: 'any', blurb: 'A wax archivist attempts to define and contain.' },
    { min: 9, max: 9, name: 'DeepReaders', depth: 'deep', blurb: 'Deep patrols that destroy rather than define.' },
    { min: 10, max: 10, name: 'BrowserLords', depth: 'deep', blurb: 'Half-spider lords who always know exit vectors.' },
    { min: 11, max: 11, name: 'The Written', depth: 'any', blurb: 'Ink-thralls hunt all loose text.' },
    { min: 12, max: 12, name: 'Blackhearted', depth: 'any', blurb: 'Word-hungry infected strip pages for sustenance.' },
    { min: 13, max: 13, name: 'Philophickers', depth: 'any', blurb: 'Walking Ideas argue reality into new shape.' },
    { min: 14, max: 14, name: 'Inkmites', depth: 'any', blurb: 'Tiny ink-eaters swarm exposed script and skin.' },
    { min: 15, max: 15, name: 'Giant Termites', depth: 'deep', blurb: 'Shelf-borers carve sudden shortcuts and collapses.' },
    { min: 16, max: 16, name: 'Skeleton Crew', depth: 'deep', blurb: 'Candle-lit skeletons march toward deeper halls.' },
    { min: 17, max: 17, name: 'Equillae', depth: 'deep', blurb: 'Biography ghosts seek bodies and exits.' },
    { min: 18, max: 18, name: 'Librarians', depth: 'deep', blurb: 'Empty robes puppet trespassers to find their book.' },
    { min: 19, max: 19, name: 'Bookworms', depth: 'any', blurb: 'Friendly giant caterpillar guides with bizarre advice.' },
    { min: 20, max: 20, name: 'Words Unbound', depth: 'deep', blurb: 'Loose words join into dangerous living sentences.' }
  ];

  var ELEVATOR_STATUS = [
    { min: 1, max: 4, text: 'Works fine.' },
    { min: 5, max: 8, text: 'Works fine, but only once.' },
    { min: 9, max: 10, text: 'Inoperable without repairs.' },
    { min: 11, max: 11, text: 'Only goes halfway.' },
    { min: 12, max: 12, text: 'Wires will snap if overloaded.' }
  ];

  var PORTAL_DESTINATIONS = [
    'Spidercombs', 'Black Candle', 'The Labra', 'The Boneyard', 'Shreddings', 'Double Down Drive',
    'Intestine Labyrinth', 'The Obliette', 'The Sway', 'Lawless', 'Labrys', 'Settle'
  ];

  function tierForDepth(depth) {
    return LIBRARY_TIERS[clamp(Math.floor((Math.max(1, Number(depth || 1)) - 1) / 3), 0, LIBRARY_TIERS.length - 1)] || 20;
  }

  function ensureLibraryState() {
    if (typeof S === 'undefined' || !S) return null;
    if (!S.infiniteLibrary || typeof S.infiniteLibrary !== 'object') {
      S.infiniteLibrary = {
        activeHexKey: '',
        depth: 1,
        deepestDepth: 1,
        delveCount: 0,
        roomIndex: 0,
        lastResult: '',
        lastEncounter: '',
        lastHook: '',
        floors: {},
        activeArea: 'Catalog Atrium',
        atmosphere: '',
        instability: 0,
        selectedNodeByDepth: {}
      };
    }
    var st = S.infiniteLibrary;
    if (!st.floors || typeof st.floors !== 'object') st.floors = {};
    if (!st.selectedNodeByDepth || typeof st.selectedNodeByDepth !== 'object') st.selectedNodeByDepth = {};
    if (!st.atmosphere) st.atmosphere = pick(LIBRARY_AMBIENCE);
    if (!st.activeArea) st.activeArea = 'Catalog Atrium';
    return st;
  }

  function getFloorKey(state, depth) {
    if (!state) return String(depth || 1);
    var area = String(state.activeArea || 'Catalog Atrium');
    return area + '|' + String(depth || 1);
  }

  function getProvinceHexByKey(key) {
    var parts = String(key || '').split(',');
    if (parts.length !== 2) return null;
    var col = Number(parts[0]);
    var row = Number(parts[1]);
    if (!isFinite(col) || !isFinite(row)) return null;
    if (typeof window.setProvinceSelectedKey === 'function') {
      try { window.setProvinceSelectedKey(col + ',' + row); } catch (_err) { console.error(_err); }
    }
    if (window.selectedHex && Number(window.selectedHex.col) === col && Number(window.selectedHex.row) === row) return window.selectedHex;
    return null;
  }

  function attachLibraryStateToHex(state) {
    if (!state || !state.activeHexKey) return;
    var hex = getProvinceHexByKey(state.activeHexKey);
    if (!hex) return;
    hex.data = hex.data || {};
    hex.data.infiniteLibrary = {
      depth: Number(state.depth || 1),
      deepestDepth: Number(state.deepestDepth || 1),
      roomIndex: Number(state.roomIndex || 0),
      delveCount: Number(state.delveCount || 0),
      lastResult: String(state.lastResult || ''),
      lastEncounter: String(state.lastEncounter || ''),
      lastHook: String(state.lastHook || ''),
      floors: state.floors,
      activeArea: String(state.activeArea || 'Catalog Atrium'),
      atmosphere: String(state.atmosphere || ''),
      instability: Number(state.instability || 0),
      selectedNodeByDepth: state.selectedNodeByDepth
    };
  }

  function readLibraryStateFromHex(state, key) {
    var hex = getProvinceHexByKey(key);
    if (!hex || !hex.data || !hex.data.infiniteLibrary) return;
    var hs = hex.data.infiniteLibrary;
    state.depth = Math.max(1, Number(hs.depth || state.depth || 1));
    state.deepestDepth = Math.max(state.depth, Number(hs.deepestDepth || state.deepestDepth || 1));
    state.roomIndex = Math.max(0, Number(hs.roomIndex || state.roomIndex || 0));
    state.delveCount = Math.max(0, Number(hs.delveCount || state.delveCount || 0));
    state.lastResult = String(hs.lastResult || state.lastResult || '');
    state.lastEncounter = String(hs.lastEncounter || state.lastEncounter || '');
    state.lastHook = String(hs.lastHook || state.lastHook || '');
    state.activeArea = String(hs.activeArea || state.activeArea || 'Catalog Atrium');
    state.atmosphere = String(hs.atmosphere || state.atmosphere || pick(LIBRARY_AMBIENCE));
    state.instability = Math.max(0, Number(hs.instability || state.instability || 0));
    if (hs.floors && typeof hs.floors === 'object') state.floors = hs.floors;
    if (hs.selectedNodeByDepth && typeof hs.selectedNodeByDepth === 'object') state.selectedNodeByDepth = hs.selectedNodeByDepth;
  }

  function nodeIcon(kind) {
    if (kind === 'Entrance Desk') return '🚪';
    if (kind === 'Reading Room') return '📖';
    if (kind === 'Encounter Hex') return '⚔';
    if (kind === 'Word Storm') return '🗯';
    if (kind === 'Portal Niche') return '◈';
    if (kind === 'Elevator Shaft') return '⇳';
    if (kind === 'Spider Archive') return '🕸';
    if (kind === 'Owl Cult Worksite') return '🦉';
    if (kind === 'Mutable Wing') return '✶';
    if (kind === 'Sentence Forge') return '✍';
    if (kind === 'Stairwell') return '⇣';
    return '⬡';
  }

  function createLibraryNode(depth, floorState, forcedKind) {
    var idx = (floorState.nodes || []).length + 1;
    var kind = forcedKind || pick(LIBRARY_NODE_TYPES);
    if (idx <= 2 && kind === 'Stairwell') kind = 'Reading Room';
    if (idx === 1) kind = 'Entrance Desk';
    return {
      idx: idx,
      kind: kind,
      discovered: idx === 1,
      cleared: idx === 1,
      hidden: false,
      pendingCombat: false,
      title: kind,
      detail: '',
      bookLine: kind === 'Reading Room' ? pick(BOOK_WEIRDNESS) : '',
      environmentShift: kind === 'Mutable Wing' ? pick(ENVIRONMENT_SHIFTS) : '',
      encounterSummary: ''
    };
  }

  function ensureFloorState(state, depth) {
    var key = getFloorKey(state, depth);
    if (!state.floors[key] || typeof state.floors[key] !== 'object') {
      state.floors[key] = {
        die: tierForDepth(depth),
        nodes: [createLibraryNode(depth, { nodes: [] }, 'Entrance Desk')],
        mutationLevel: Math.max(0, depth - 1),
        atmosphere: pick(LIBRARY_AMBIENCE),
        currentSentence: '',
        readings: 0
      };
    }
    var floor = state.floors[key];
    if (!Array.isArray(floor.nodes) || !floor.nodes.length) floor.nodes = [createLibraryNode(depth, { nodes: [] }, 'Entrance Desk')];
    if (typeof floor.readings !== 'number') floor.readings = 0;
    if (!floor.atmosphere) floor.atmosphere = pick(LIBRARY_AMBIENCE);
    return floor;
  }

  function findByRoll(list, value) {
    for (var i = 0; i < list.length; i++) {
      if (value >= Number(list[i].min) && value <= Number(list[i].max)) return list[i];
    }
    return list[0] || null;
  }

  function depthBand(depth) {
    var d = Math.max(1, Number(depth || 1));
    if (d <= 4) return 'shallow';
    if (d >= 8) return 'deep';
    return 'mid';
  }

  function depthAllowed(rule, band) {
    var r = String(rule || 'any').toLowerCase();
    if (r === 'any') return true;
    if (r.indexOf('shallow') >= 0 && band === 'shallow') return true;
    if (r.indexOf('deep') >= 0 && band === 'deep') return true;
    return false;
  }

  function rollEncounterForDepth(depth) {
    var band = depthBand(depth);
    var d20 = 0;
    var chosen = null;
    for (var i = 0; i < 30; i++) {
      d20 = rollDie(20);
      var e = findByRoll(LIBRARY_ENCOUNTERS, d20);
      if (e && depthAllowed(e.depth, band)) {
        chosen = e;
        break;
      }
    }
    if (!chosen) chosen = LIBRARY_ENCOUNTERS[0];
    var detail = '';
    if (chosen.name === 'Elevator') {
      var eRoll = rollDie(12);
      var eStatus = findByRoll(ELEVATOR_STATUS, eRoll);
      detail = 'Elevator d12=' + eRoll + ' · ' + (eStatus ? eStatus.text : 'Unknown.');
    }
    if (chosen.name === 'Portal') {
      var pRoll = rollDie(12);
      detail = 'Portal d12=' + pRoll + ' · ' + (PORTAL_DESTINATIONS[pRoll - 1] || PORTAL_DESTINATIONS[0]);
    }
    return {
      roll: d20,
      encounter: chosen,
      band: band,
      summary: 'd20=' + d20 + ' (' + band + ') · ' + chosen.name + ' · ' + chosen.blurb,
      detail: detail
    };
  }

  function runActionRoll(statKey, dreadDie, label) {
    var actionDie = statDie(statKey);
    var actionTotal;
    var dreadTotal;
    if (typeof explodingRoll === 'function') {
      var a = explodingRoll(actionDie, { type: 'action', major: true, label: label + ' AD' + actionDie });
      var d = explodingRoll(dreadDie, { type: 'dread', major: true, label: label + ' DD' + dreadDie });
      actionTotal = Number(a && a.total || 0);
      dreadTotal = Number(d && d.total || 0);
    } else {
      actionTotal = rollDie(actionDie);
      dreadTotal = rollDie(dreadDie);
    }
    return {
      actionDie: actionDie,
      dreadDie: dreadDie,
      actionTotal: actionTotal,
      dreadTotal: dreadTotal,
      success: actionTotal >= dreadTotal
    };
  }

  function getLibraryEncounterProfile(name, depth) {
    var d = Math.max(1, Number(depth || 1));
    var dd = tierForDepth(d);
    var key = String(name || '').toLowerCase();
    if (key === 'inkmites') return { count: 4 + rollDie(3), dread: Math.max(4, dd - 2), label: 'Inkmite Swarm', autoCombat: true, scene: 'A black tide of thumb-sized mites pours from open spines and strip-mines exposed script from skin and page.' };
    if (key === 'philophickers') return { count: 2 + rollDie(2), dread: Math.max(6, dd), label: 'Philophicker Chorus', autoCombat: true, scene: 'Translucent scholars in lacquered masks argue axioms in overlapping voices; every contradiction bends gravity and shelf geometry around you.' };
    if (key === 'page knights') return { count: 1 + rollDie(2), dread: Math.max(6, dd), label: 'Page Knights', autoCombat: true, scene: 'Armor of stitched folios clatters between stacks, each knight carrying a blade made from sharpened brass bookmarks.' };
    if (key === 'owl cultists') return { count: 2 + rollDie(2), dread: Math.max(6, dd), label: 'Owl Cult Delvers', autoCombat: true, scene: 'Masked delvers chalk ward-circles and trigger razor-wire traps across aisle choke points.' };
    if (key === 'spider archivist') return { count: 1, dread: Math.max(8, dd), label: 'Spider Archivist', autoCombat: true, scene: 'A wax-bodied archivist descends on silk index ribbons, filing you as "misplaced material."' };
    if (key === 'bookworms') return { count: 1, dread: Math.max(4, dd - 4), label: 'Bookworm Guide', autoCombat: false, scene: 'A giant caterpillar noses through bindings and points toward safer shelves with impatient chirps.' };
    if (key === 'elevator') return { count: 0, dread: Math.max(4, dd - 2), label: 'Elevator Chamber', autoCombat: false, scene: 'A brass cage-lift hangs over a shaft of impossible depth.' };
    if (key === 'portal') return { count: 0, dread: Math.max(4, dd - 2), label: 'Portal Niche', autoCombat: false, scene: 'Rune-plates spin around a doorway that has too many dimensions.' };
    return { count: 2 + rollDie(2), dread: Math.max(4, dd), label: String(name || 'Library Hostiles'), autoCombat: true, scene: 'The stacks erupt into immediate hostilities.' };
  }

  function canUseElevator(statusText, onceSpent) {
    if (!statusText) return false;
    if (onceSpent) return false;
    return String(statusText).toLowerCase().indexOf('inoperable') < 0;
  }

  function getLibraryNodeRelevantEffects(node) {
    var kind = String(node && node.kind || '').toLowerCase();
    if (/reading|sentence|word/.test(kind)) return ['Mind checks', 'Mental Stress risk', 'Instability +1 on shifts'];
    if (/encounter|spider|owl/.test(kind)) return ['Valor checks', 'Health risk', 'Combat escalation'];
    if (/mutable/.test(kind)) return ['Environment shift', 'Instability +1', 'Pathing changes'];
    if (/portal|elevator|stair/.test(kind)) return ['Depth transition', 'Area transition', 'Route volatility'];
    return ['Valor checks', 'Radiation exposure risk', 'Mental Stress risk'];
  }

  function startLibraryEncounterCombat(col, row, profile) {
    if (typeof window.startProvinceMonsterCombat !== 'function') return false;
    if (!isFinite(col) || !isFinite(row)) return false;
    if (!profile || !profile.autoCombat || Number(profile.count || 0) <= 0) return false;
    window.startProvinceMonsterCombat(col, row, 'library', Number(profile.count || 1), String(profile.label || 'Library Hostiles'), Number(profile.dread || 4), true);
    return true;
  }

  function getLibraryFailureMargin(actionTotal, dreadTotal) {
    return Math.max(1, Number(dreadTotal || 0) - Number(actionTotal || 0));
  }

  function applyFailureConsequence(kind, diff) {
    if (typeof S === 'undefined' || !S) return;
    var margin = Math.max(1, Number(diff || 0));
    var penalties = { mentalStress: 0, damage: 0, radiationExposure: 0 };
    if (typeof addTMWOnFail === 'function') addTMWOnFail();
    if (kind === 'read' || kind === 'word') {
      penalties.mentalStress = margin;
    } else if (kind === 'explore') {
      penalties.mentalStress = margin;
      penalties.damage = margin;
      penalties.radiationExposure = margin;
    } else {
      penalties.damage = margin;
    }
    if (penalties.mentalStress) S.mentalStress = Math.max(0, Number(S.mentalStress || 0) + penalties.mentalStress);
    if (penalties.damage) S.health = Math.max(0, Number(S.health || 0) - penalties.damage);
    if (penalties.radiationExposure) S.radiationExposure = Math.max(0, Number(S.radiationExposure || 0) + penalties.radiationExposure);
    if (typeof updateAllStatDisplays === 'function') updateAllStatDisplays();
    if (typeof renderQP === 'function') renderQP('hero');
    return penalties;
  }

  function getSpiralCoord(index) {
    var idx = Math.max(1, Number(index || 1));
    if (idx === 1) return { q: 0, r: 0 };
    var remaining = idx - 1;
    var ring = 1;
    while (remaining > 6 * ring) {
      remaining -= 6 * ring;
      ring += 1;
    }
    var q = -ring;
    var r = ring;
    for (var side = 0; side < 6; side++) {
      var dir = LIBRARY_AXIAL_DIRECTIONS[side];
      for (var step = 0; step < ring; step++) {
        if (remaining === 1) return { q: q, r: r };
        q += dir.q;
        r += dir.r;
        remaining -= 1;
      }
    }
    return { q: q, r: r };
  }

  function localHexPoints(cx, cy, size) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI / 180) * (60 * i - 30);
      var x = Math.round(cx + size * Math.cos(angle));
      var y = Math.round(cy + size * Math.sin(angle));
      pts.push(x + ',' + y);
    }
    return pts.join(' ');
  }

  function ensureLibraryFxStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('infinite-library-fx-style')) return;
    var style = document.createElement('style');
    style.id = 'infinite-library-fx-style';
    style.textContent = ''
      + '@keyframes libGlyphDrift { 0% { transform: translateY(0px); opacity: .2; } 50% { transform: translateY(-6px); opacity: .65; } 100% { transform: translateY(-12px); opacity: .12; } }\n'
      + '@keyframes libShelfParallaxNear { 0% { transform: translateX(0px); } 100% { transform: translateX(-24px); } }\n'
      + '@keyframes libShelfParallaxFar { 0% { transform: translateX(0px); } 100% { transform: translateX(-12px); } }\n'
      + '.library-fx-wrap { position: relative; }\n'
      + '.library-fx-glyph { animation: libGlyphDrift 5.6s linear infinite; transform-origin: center; }\n'
      + '.library-fx-shelf-near { animation: libShelfParallaxNear 10s linear infinite; }\n'
      + '.library-fx-shelf-far { animation: libShelfParallaxFar 14s linear infinite; }\n';
    document.head.appendChild(style);
  }

  function depthPalette(depth) {
    var d = Math.max(1, Number(depth || 1));
    var t = Math.min(1, (d - 1) / 14);
    var h = Math.round(210 - (95 * t));
    var h2 = Math.round(265 - (120 * t));
    return {
      glow: 'hsla(' + h + ', 88%, 68%, .36)',
      line: 'hsla(' + h + ', 92%, 74%, .74)',
      fillA: 'hsla(' + h2 + ', 66%, 22%, .86)',
      fillB: 'hsla(' + h + ', 70%, 12%, .95)',
      glyph: 'hsla(' + h + ', 96%, 78%, .85)'
    };
  }

  function getFloorFog(floor) {
    var nodes = Array.isArray(floor && floor.nodes) ? floor.nodes : [];
    var visibleMask = {};
    var frontierMask = {};
    var discovered = 0;
    var frontier = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i] || {};
      if (n.discovered) {
        visibleMask[i] = true;
        discovered += 1;
        if (nodes[i + 1] && !nodes[i + 1].discovered && !nodes[i + 1].hidden) {
          visibleMask[i + 1] = true;
          frontierMask[i + 1] = true;
          frontier += 1;
        }
      }
    }
    if (!discovered && nodes.length) {
      visibleMask[0] = true;
      discovered = 1;
    }
    return { visibleMask: visibleMask, frontierMask: frontierMask, discoveredCount: discovered, frontierCount: frontier };
  }

  function buildLibraryMiniMap(col, row, floor, selectedIdx) {
    var nodes = floor.nodes || [];
    var fog = getFloorFog(floor);
    var palette = depthPalette((typeof S !== 'undefined' && S && S.infiniteLibrary) ? S.infiniteLibrary.depth : 1);
    var spacing = 84;
    var size = 56;
    var iconFontSize = Math.max(13, Math.round(size * 0.26));
    var placed = nodes.map(function (_node, idx) {
      var c = getSpiralCoord(idx + 1);
      return {
        idx: idx,
        x: Math.round(c.q * spacing + 480),
        y: Math.round((c.r + c.q * 0.5) * (spacing * 0.94) + 300)
      };
    });

    var links = [];
    for (var i = 1; i < placed.length; i++) {
      if (!fog.visibleMask[i] || !fog.visibleMask[i - 1]) continue;
      links.push('<line x1="' + placed[i - 1].x + '" y1="' + placed[i - 1].y + '" x2="' + placed[i].x + '" y2="' + placed[i].y + '" stroke="rgba(156,184,255,.34)" stroke-width="1.4" />');
    }

    var cells = placed.map(function (p) {
      if (!fog.visibleMask[p.idx]) return '';
      var node = nodes[p.idx] || {};
      var isFrontier = !!fog.frontierMask[p.idx];
      var isSelected = p.idx === selectedIdx;
      var fill = isFrontier ? 'rgba(156,184,255,.05)' : (node.cleared ? 'rgba(46,196,182,.2)' : 'rgba(70,80,110,.35)');
      var stroke = isSelected ? '#9cb8ff' : (isFrontier ? 'rgba(156,184,255,.6)' : 'rgba(140,150,185,.55)');
      if (node.pendingCombat) {
        fill = 'rgba(224,80,80,.2)';
        stroke = 'rgba(224,80,80,.75)';
      }
      return '<g style="cursor:pointer;" onclick="selectInfiniteLibraryNode(' + col + ',' + row + ',' + p.idx + ')">'
        + '<polygon points="' + localHexPoints(p.x, p.y, size) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4"></polygon>'
        + '<text x="' + p.x + '" y="' + (p.y + Math.round(iconFontSize * 0.38)) + '" text-anchor="middle" font-size="' + iconFontSize + '" fill="var(--text)">' + nodeIcon(node.kind) + '</text>'
        + '<title>Hex ' + (p.idx + 1) + ' · ' + (node.kind || 'Unknown') + '</title>'
        + '</g>';
    }).join('');

    var glyphs = [];
    for (var gi = 0; gi < 16; gi++) {
      var gx = 24 + (gi * 61) % 900;
      var gy = 30 + (gi * 83) % 560;
      var glyph = (gi % 4 === 0) ? '⟡' : ((gi % 4 === 1) ? 'ᚠ' : ((gi % 4 === 2) ? '✶' : '◌'));
      glyphs.push('<text class="library-fx-glyph" x="' + gx + '" y="' + gy + '" text-anchor="middle" font-size="7" fill="' + palette.glyph + '" style="animation-delay:' + (gi * 0.22) + 's;">' + glyph + '</text>');
    }

    var shelvesFar = [];
    var shelvesNear = [];
    for (var sy = 0; sy < 10; sy++) shelvesFar.push('<line x1="-60" y1="' + (46 + sy * 66) + '" x2="1020" y2="' + (28 + sy * 66) + '" stroke="' + palette.glow + '" stroke-width="1" />');
    for (var sz = 0; sz < 8; sz++) shelvesNear.push('<line x1="-72" y1="' + (58 + sz * 82) + '" x2="1030" y2="' + (82 + sz * 82) + '" stroke="' + palette.line + '" stroke-opacity=".24" stroke-width="1.15" />');

    return '<div class="library-fx-wrap" style="border:1px solid ' + palette.line + ';background:linear-gradient(180deg,' + palette.fillA + ' 0%,' + palette.fillB + ' 100%);padding:.4rem;border-radius:4px;margin-bottom:.55rem;box-shadow:0 0 24px ' + palette.glow + ';">'
      + '<div style="font-size:.68rem;color:#9cb8ff;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.22rem;">Infinite Library Crawl Map</div>'
      + '<svg viewBox="0 0 960 620" style="width:100%;height:auto;display:block;">'
      + '<g class="library-fx-shelf-far">' + shelvesFar.join('') + '</g>'
      + '<g class="library-fx-shelf-near">' + shelvesNear.join('') + '</g>'
      + '<g>' + glyphs.join('') + '</g>'
      + links.join('') + cells
      + '</svg>'
      + '<div style="font-size:.68rem;color:var(--muted2);margin-top:.2rem;">Solid nodes are mapped. Outlined nodes are frontier hexes.</div>'
      + '</div>';
  }

  function buildNodeActions(col, row, node, depth, floor) {
    if (!node) return '';
    if (!node.discovered) {
      return '<button class="btn btn-xs btn-teal" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'scout\')">🔭 Scout Room</button>';
    }
    var actions = [];
    if (!node.cleared && !node.pendingCombat) actions.push('<button class="btn btn-xs btn-primary" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'explore\')">⚄ Resolve Hex</button>');
    if (node.kind === 'Reading Room' || node.kind === 'Sentence Forge') actions.push('<button class="btn btn-xs btn-teal" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'read\')">📖 Read A Dangerous Book</button>');
    if (node.kind === 'Mutable Wing') actions.push('<button class="btn btn-xs" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'mutate\')">✶ Embrace The Shift</button>');
    if (node.kind === 'Encounter Hex' && node.pendingCombat) {
      actions.push('<button class="btn btn-xs btn-primary" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'victory\')">Victory</button>');
      actions.push('<button class="btn btn-xs btn-red" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'fallback\')">Fall Back</button>');
    }
    if (node.elevatorStatus && canUseElevator(node.elevatorStatus, !!node.elevatorSpent)) {
      actions.push('<button class="btn btn-xs btn-warn" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'elevator_down\')">⇣ Ride Elevator Down</button>');
      actions.push('<button class="btn btn-xs" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'elevator_up\')">⇡ Ride Elevator Up</button>');
    }
    if (node.kind === 'Stairwell' && node.cleared && depth < LIBRARY_TIERS.length * 3) actions.push('<button class="btn btn-xs btn-warn" onclick="descendInfiniteLibraryFloor(' + col + ',' + row + ')">Take Stair Down</button>');
    if (node.portalDestination && !node.portalUsed) actions.push('<button class="btn btn-xs btn-teal" onclick="useLibraryPortal(' + col + ',' + row + ',' + (node.idx - 1) + ')">◈ Enter Portal → ' + String(node.portalDestination) + '</button>');
    if (node.cleared) actions.push('<button class="btn btn-xs" onclick="resolveInfiniteLibraryNode(' + col + ',' + row + ',' + (node.idx - 1) + ',\'hidden\')" title="Search for hidden rooms or secret lore fragments">🔍 Search Hidden Room</button>');
    if (actions.length === 0) return '<span style="font-size:.72rem;color:var(--green2);">✓ Hex stable.</span>';
    return actions.join(' ');
  }

  function buildNodeDetail(col, row, floor, depth, selectedIdx) {
    var node = floor.nodes[selectedIdx];
    if (!node) return '';
    var danger = tierForDepth(depth);
    var titleColor = node.pendingCombat ? 'var(--red2)' : (node.cleared ? 'var(--green2)' : '#9cb8ff');
    var status = !node.discovered ? 'Frontier (unscouted)' : (node.pendingCombat ? 'Hostiles active' : (node.cleared ? 'Cleared' : 'Unresolved'));
    var details = [];
    if (node.detail) details.push(node.detail);
    if (node.bookLine) details.push('<em>' + node.bookLine + '</em>');
    if (node.environmentShift) details.push('Shift: ' + node.environmentShift);
    details.push('Relevant effects: ' + getLibraryNodeRelevantEffects(node).join(' · '));

    return '<div class="room-block" style="margin-bottom:.45rem;border-left:3px solid ' + titleColor + ';padding-left:.5rem;">'
      + '<div class="rb-title" style="color:' + titleColor + ';">' + nodeIcon(node.kind) + ' Hex ' + node.idx + ' - ' + node.kind + '</div>'
      + '<div style="font-size:.68rem;color:' + titleColor + ';margin:.16rem 0 .24rem;text-transform:uppercase;letter-spacing:.05em;">' + status + '</div>'
      + '<div class="rb-text" style="font-size:.8rem;line-height:1.55;">' + (details.length ? details.join('<br>') : 'No details mapped yet.') + '</div>'
      + (node.result ? '<div style="margin-top:.28rem;padding:.25rem .4rem;background:rgba(255,255,255,.04);border-radius:3px;font-size:.76rem;color:var(--gold2);">' + node.result + '</div>' : '')
      + '<div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;">' + buildNodeActions(col, row, node, depth, floor) + '</div>'
      + '</div>';
  }

  function revealLibraryDoors(state, floor, fromIdx) {
    var reveals = 2;
    var created = 0;
    var idx = Math.max(0, Number(fromIdx || 0));
    while (created < reveals) {
      var targetIdx = idx + created + 1;
      while (targetIdx >= floor.nodes.length) floor.nodes.push(createLibraryNode(state.depth, floor));
      var next = floor.nodes[targetIdx];
      if (next && !next.discovered) {
        next.discovered = true;
        next.hidden = false;
        created += 1;
      } else {
        created += 1;
      }
    }
    if (rollDie(4) === 4) {
      var hiddenIdx = idx + reveals + 1;
      while (hiddenIdx >= floor.nodes.length) floor.nodes.push(createLibraryNode(state.depth, floor));
      var hiddenNode = floor.nodes[hiddenIdx];
      if (hiddenNode && !hiddenNode.discovered) {
        hiddenNode.hidden = true;
        hiddenNode.discovered = false;
      }
    }
  }

  function applyLibraryLoot(state) {
    var table = [
      function () {
        var gain = 1 + rollDie(10) - 1;
        if (typeof changeCounter === 'function') changeCounter('pathTokens', gain);
        else if (typeof S !== 'undefined' && S) S.pathTokens = Math.max(0, Number(S.pathTokens || 0) + gain);
        return '+' + gain + ' Path Tokens';
      },
      function () {
        var credits = 20 + (rollDie(6) * 10);
        rewardCredits(credits);
        return '+' + credits + ' Credits';
      },
      function () {
        var flavor = pick(LIBRARY_FLAVOR_LINES);
        if (typeof window.setFlavor === 'function') {
          try { window.setFlavor(flavor); } catch (_err) { if (typeof S !== 'undefined' && S) S.flavor = flavor; }
        } else if (typeof S !== 'undefined' && S) S.flavor = flavor;
        return 'Personal Flavor shift: ' + flavor;
      },
      function () {
        var item = pick(LIBRARY_MERCHANT_STASH);
        if (typeof addToBackpack === 'function') {
          try { addToBackpack(item); } catch (_err) { console.error(_err); }
        }
        return 'Merchant stash found: ' + item;
      }
    ];
    var fn = table[Math.floor(Math.random() * table.length)] || table[0];
    return fn();
  }

  function parseHexKey(key) {
    var parts = String(key || '').split(',');
    return { col: Number(parts[0]), row: Number(parts[1]) };
  }

  function openLibraryUI() {
    ensureLibraryFxStyles();
    var st = ensureLibraryState();
    if (!st || typeof openModal !== 'function') return false;
    var pos = parseHexKey(st.activeHexKey);
    var col = Number(pos.col);
    var row = Number(pos.row);
    var depth = Math.max(1, Number(st.depth || 1));
    var floor = ensureFloorState(st, depth);
    var selected = clamp(Number(st.selectedNodeByDepth[String(depth)] || 0), 0, Math.max(0, floor.nodes.length - 1));
    var fog = getFloorFog(floor);
    if (!fog.visibleMask[selected]) {
      var frontierIdx = floor.nodes.findIndex(function (_n, i) { return !!fog.frontierMask[i]; });
      selected = frontierIdx >= 0 ? frontierIdx : 0;
    }
    st.selectedNodeByDepth[String(depth)] = selected;
    var selectedNode = floor.nodes[selected] || null;
    var relevantEffectsLine = selectedNode ? getLibraryNodeRelevantEffects(selectedNode).join(' · ') : 'Valor checks · Radiation exposure risk · Mental Stress risk';

    var canAscend = depth > 1;
    var task = st.lastHook || ('Retrieve a depth-' + depth + ' volume from ' + String(st.activeArea || 'Catalog Atrium') + ' and get it out alive.');

    var header = '<div style="margin-bottom:.5rem;">'
      + '<div style="font-size:.72rem;color:#9cb8ff;margin-bottom:.2rem;">Depth ' + depth + ' · DD' + tierForDepth(depth) + ' · ' + String(st.activeArea || 'Catalog Atrium') + ' · Deepest ' + st.deepestDepth + ' · Delves ' + st.delveCount + '</div>'
      + '<div style="font-size:.74rem;color:var(--muted2);margin-bottom:.22rem;">Atmosphere: ' + (floor.atmosphere || st.atmosphere) + '</div>'
      + '<div style="font-size:.74rem;color:var(--muted2);margin-bottom:.3rem;">Instability: ' + st.instability + ' · Readings this floor: ' + Number(floor.readings || 0) + '</div>'
      + '<div style="font-size:.7rem;color:var(--gold2);margin-bottom:.24rem;">Relevant Effects: ' + relevantEffectsLine + '</div>'
      + '<div style="padding:.35rem .45rem;border:1px solid rgba(156,184,255,.3);background:rgba(156,184,255,.07);margin-bottom:.42rem;">'
      + '<div style="font-size:.68rem;color:#9cb8ff;text-transform:uppercase;letter-spacing:.08em;">Contract</div>'
      + '<div style="font-size:.8rem;color:var(--text2);">' + task + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.45rem;">'
      + '<button class="btn btn-sm btn-primary" onclick="generateInfiniteLibraryNode(' + col + ',' + row + ')">Press Deeper</button>'
      + '<button class="btn btn-sm" onclick="resolveInfiniteLibraryAction(\'hook\')">Generate Hook</button>'
      + (canAscend ? '<button class="btn btn-sm" onclick="ascendInfiniteLibraryFloor(' + col + ',' + row + ')">Return To Higher Depth</button>' : '')
      + '</div>'
      + '</div>';

    var miniMap = buildLibraryMiniMap(col, row, floor, selected);
    var detail = buildNodeDetail(col, row, floor, depth, selected);
    var footer = ''
      + (st.lastEncounter ? '<div style="font-size:.72rem;color:#9cb8ff;margin-top:.35rem;"><strong>Latest Encounter:</strong> ' + st.lastEncounter + '</div>' : '')
      + (st.lastResult ? '<div style="font-size:.72rem;color:var(--teal);margin-top:.22rem;"><strong>Last Result:</strong> ' + st.lastResult + '</div>' : '');

    attachLibraryStateToHex(st);
    openModal('📚 Infinite Library — Hexcrawl', header + miniMap + detail + footer);
    return true;
  }

  function rewardCredits(amount) {
    if (typeof S === 'undefined' || !S) return;
    S.credits = Math.max(0, Number(S.credits || 0) + Math.max(0, Number(amount || 0)));
    if (typeof updateCreditsUI === 'function') updateCreditsUI();
  }

  function generateBookFetchHook(state) {
    var depth = Math.max(1, Number(state.depth || 1));
    return String(state.activeArea || 'Catalog Atrium') + ' · Depth ' + depth + ': retrieve a forbidden text, survive one hostile wing shift, and extract via stairwell or portal.';
  }

  function runNodeExplore(state, floor, node, mode, col, row) {
    var depth = Number(state.depth || 1);
    var dd = tierForDepth(depth) + Math.min(4, Math.floor(Number(state.instability || 0) / 3));

    if (mode === 'scout') {
      var scoutRoll = runActionRoll('valor', dd, 'Library Scout');
      if (scoutRoll.success) {
        node.discovered = true;
        node.detail = pick(LIBRARY_AMBIENCE);
        node.scouted = true;
        state.lastResult = 'Scout: ' + String(node.kind || 'Unknown') + ' — room mapped.';
        rewardCredits(10 + dd);
      } else {
        node.discovered = true;
        state.lastResult = 'Scout inconclusive — hex shape visible, contents unknown.';
      }
      revealLibraryDoors(state, floor, node.idx - 1);
      return;
    }

    if (mode === 'read') {
      var readRoll = runActionRoll('mind', dd, 'Library Read');
      floor.readings = Number(floor.readings || 0) + 1;
      node.bookLine = pick(BOOK_WEIRDNESS);
      if (readRoll.success) {
        node.environmentShift = pick(ENVIRONMENT_SHIFTS);
        floor.currentSentence = 'Sentence effect: ' + pick(ENVIRONMENT_SHIFTS);
        node.result = 'You master the text. ' + floor.currentSentence;
        state.instability = Math.max(0, Number(state.instability || 0) + 1);
        rewardCredits(15 + dd);
        if (typeof toggleCond === 'function' && S && S.conditions && !S.conditions.focused) toggleCond('focused');
      } else {
        var readDiff = getLibraryFailureMargin(readRoll.actionTotal, readRoll.dreadTotal);
        var readPenalty = applyFailureConsequence('read', readDiff);
        node.result = 'The text reads you back. Take ' + readPenalty.mentalStress + ' Mental Stress backlash.';
      }
      state.lastResult = 'Read result: AD' + readRoll.actionDie + ' ' + readRoll.actionTotal + ' vs DD' + dd + ' ' + readRoll.dreadTotal + '.';
      node.cleared = true;
      revealLibraryDoors(state, floor, node.idx - 1);
      return;
    }

    if (mode === 'mutate') {
      node.environmentShift = pick(ENVIRONMENT_SHIFTS);
      floor.atmosphere = pick(LIBRARY_AMBIENCE);
      state.instability = Math.max(0, Number(state.instability || 0) + 1);
      node.result = 'The wing shifts. ' + node.environmentShift;
      node.cleared = true;
      state.lastResult = 'You let the library rewrite this hex.';
      revealLibraryDoors(state, floor, node.idx - 1);
      return;
    }

    if (mode === 'victory') {
      node.pendingCombat = false;
      node.cleared = true;
      node.result = 'Hostiles scattered. The shelf-route is clear.';
      rewardCredits(20 + dd);
      state.lastResult = 'Encounter marked as victory.';
      revealLibraryDoors(state, floor, node.idx - 1);
      return;
    }

    if (mode === 'fallback') {
      node.pendingCombat = false;
      var fallbackPenalty = applyFailureConsequence('fallback', dd);
      node.result = 'You fall back and lose ground in the stacks. Take ' + fallbackPenalty.damage + ' Damage.';
      state.lastResult = 'Encounter marked as fallback.';
      revealLibraryDoors(state, floor, node.idx - 1);
      return;
    }

    if (mode === 'hidden') {
      var hRoll = runActionRoll('valor', dd, 'Hidden Room Search');
      if (hRoll.success) {
        var hiddenNode = null;
        for (var hi = 0; hi < floor.nodes.length; hi++) {
          if (floor.nodes[hi] && floor.nodes[hi].hidden && !floor.nodes[hi].discovered) {
            hiddenNode = floor.nodes[hi];
            break;
          }
        }
        var lootText = applyLibraryLoot(state);
        if (hiddenNode) {
          hiddenNode.hidden = false;
          hiddenNode.discovered = true;
          node.result = 'Hidden shelf door revealed: Hex ' + hiddenNode.idx + '. Loot recovered: ' + lootText + '.';
          state.lastResult = 'Hidden search revealed a secret hex and loot.';
        } else {
          node.result = 'Concealed cache recovered: ' + lootText + '.';
          state.lastResult = 'Hidden search recovered loot.';
        }
      } else {
        node.result = 'Nothing concealed here — or it was already taken.';
        state.lastResult = 'Hidden search came up empty.';
      }
      return;
    }

    if (mode === 'elevator_down' || mode === 'elevator_up') {
      var statusText = String(node.elevatorStatus || '');
      if (!canUseElevator(statusText, !!node.elevatorSpent)) {
        node.result = 'Elevator refuses to move. ' + (statusText || 'The mechanism is unresponsive.');
        state.lastResult = 'Elevator travel failed.';
        return;
      }
      var currentDepth = Math.max(1, Number(state.depth || 1));
      var delta = mode === 'elevator_down' ? 1 : -1;
      var targetDepth = Math.max(1, currentDepth + delta);
      if (statusText.toLowerCase().indexOf('halfway') >= 0 && mode === 'elevator_down') {
        targetDepth = Math.max(1, currentDepth + (rollDie(2) === 1 ? 1 : 2));
      }
      if (targetDepth === currentDepth) {
        node.result = 'The elevator shudders but returns to the same shelf-band.';
        state.lastResult = 'Elevator failed to change depth.';
        return;
      }
      if (statusText.toLowerCase().indexOf('only once') >= 0) node.elevatorSpent = true;
      var candidates = LIBRARY_AREAS.filter(function (area) { return String(area) !== String(state.activeArea || ''); });
      if (candidates.length) state.activeArea = pick(candidates);
      state.depth = targetDepth;
      state.deepestDepth = Math.max(Number(state.deepestDepth || 1), targetDepth);
      ensureFloorState(state, targetDepth);
      state.selectedNodeByDepth[String(targetDepth)] = Number(state.selectedNodeByDepth[String(targetDepth)] || 0);
      node.result = 'Elevator transit complete. You arrive at ' + String(state.activeArea || 'Catalog Atrium') + ', Depth ' + targetDepth + '.';
      state.lastResult = 'Elevator moved from Depth ' + currentDepth + ' to Depth ' + targetDepth + ' and shifted area.';
      return;
    }

    var stat = node.kind === 'Word Storm' ? 'spirit' : (node.kind === 'Sentence Forge' ? 'mind' : 'valor');
    var exploreRoll = runActionRoll(stat, dd, 'Library ' + node.kind);
    node.discovered = true;
    if (exploreRoll.success) {
      node.cleared = true;
      node.detail = node.detail || pick(LIBRARY_AMBIENCE);
      if (node.kind === 'Encounter Hex' || node.kind === 'Spider Archive' || node.kind === 'Owl Cult Worksite') {
        var encounter = rollEncounterForDepth(depth);
        var profile = getLibraryEncounterProfile(encounter.encounter && encounter.encounter.name, depth);
        node.pendingCombat = !!profile.autoCombat;
        node.encounterSummary = encounter.summary + (encounter.detail ? (' | ' + encounter.detail) : '');
        state.lastEncounter = node.encounterSummary;
        node.result = profile.scene;
        if (encounter.encounter && encounter.encounter.name === 'Philophickers') {
          node.result += ' Their debate manifests as geometric guillotines of punctuation cutting through nearby stacks.';
        }
        if (encounter.encounter && encounter.encounter.name === 'Elevator') {
          var eRoll = rollDie(12);
          var eState = findByRoll(ELEVATOR_STATUS, eRoll) || { text: 'Unknown.' };
          node.elevatorStatus = String(eState.text || 'Unknown.');
          node.result += ' Elevator status: ' + node.elevatorStatus;
          node.pendingCombat = false;
        }
        if (encounter.encounter && encounter.encounter.name === 'Portal') {
          var pRoll = rollDie(12);
          var portalTarget = PORTAL_DESTINATIONS[pRoll - 1] || PORTAL_DESTINATIONS[0];
          node.portalDestination = portalTarget;
          node.result += ' Portal active — ' + portalTarget + '.';
          node.pendingCombat = false;
        }
        if (profile.autoCombat) {
          var started = startLibraryEncounterCombat(Number(col), Number(row), profile);
          if (started) {
            node.result += ' Combat roster seeded in Combat and Quick tabs (' + profile.count + 'x ' + profile.label + ', DD' + profile.dread + ').';
          } else {
            node.result += ' Mark as Victory/Fallback after resolving manually.';
          }
        }
      } else if (node.kind === 'Portal Niche') {
        var p = rollDie(12);
        var pDest = PORTAL_DESTINATIONS[p - 1] || PORTAL_DESTINATIONS[0];
        node.portalDestination = pDest;
        node.result = 'Portal active. Destination: ' + pDest + '.';
        state.lastEncounter = 'Portal destination: ' + pDest;
      } else if (node.kind === 'Elevator Shaft') {
        var e = rollDie(12);
        node.elevatorStatus = String((findByRoll(ELEVATOR_STATUS, e) || { text: 'Unknown' }).text || 'Unknown');
        node.result = 'Elevator status: ' + node.elevatorStatus + (canUseElevator(node.elevatorStatus, false) ? ' Use Ride Elevator to travel between depths.' : '');
      } else {
        node.result = 'Hex resolved cleanly.';
      }
      rewardCredits(12 + dd);
      revealLibraryDoors(state, floor, node.idx - 1);
    } else {
      var exploreDiff = getLibraryFailureMargin(exploreRoll.actionTotal, exploreRoll.dreadTotal);
      var explorePenalty = applyFailureConsequence('explore', exploreDiff);
      node.result = 'Failed to stabilize this hex. The archive lashes back: +' + explorePenalty.mentalStress + ' Mental Stress, ' + explorePenalty.damage + ' Damage, +' + explorePenalty.radiationExposure + ' Radiation Exposure.';
      state.instability = Math.max(0, Number(state.instability || 0) + 1);
      revealLibraryDoors(state, floor, node.idx - 1);
    }
    state.lastResult = 'Explore result: AD' + exploreRoll.actionDie + ' ' + exploreRoll.actionTotal + ' vs DD' + dd + ' ' + exploreRoll.dreadTotal + '.';
  }

  window.selectInfiniteLibraryNode = function (col, row, idx) {
    var st = ensureLibraryState();
    if (!st) return;
    var floor = ensureFloorState(st, st.depth);
    var fog = getFloorFog(floor);
    var safeIdx = clamp(Number(idx || 0), 0, Math.max(0, floor.nodes.length - 1));
    if (!fog.visibleMask[safeIdx]) return;
    st.selectedNodeByDepth[String(st.depth)] = safeIdx;
    attachLibraryStateToHex(st);
    openLibraryUI();
  };

  window.generateInfiniteLibraryNode = function (col, row) {
    var st = ensureLibraryState();
    if (!st) return;
    var floor = ensureFloorState(st, st.depth);
    var count = 2 + Math.floor(Math.random() * 2); // 2 or 3 new frontier hexes
    for (var i = 0; i < count; i++) {
      var newNode = createLibraryNode(st.depth, floor);
      if (rollDie(5) === 5) newNode.hidden = true;
      floor.nodes.push(newNode);
    }
    st.roomIndex = Math.max(0, Number(st.roomIndex || 0) + count);
    st.selectedNodeByDepth[String(st.depth)] = floor.nodes.length - 1;
    attachLibraryStateToHex(st);
    openLibraryUI();
  };

  window.useLibraryPortal = function (col, row, idx) {
    var st = ensureLibraryState();
    if (!st) return;
    var floor = ensureFloorState(st, st.depth);
    var node = floor.nodes[Number(idx || 0)];
    if (!node || !node.portalDestination) {
      if (typeof showNotif === 'function') showNotif('Portal has no confirmed destination.', 'warn');
      return;
    }
    var dest = node.portalDestination;
    var depthJump = 1 + Math.floor(Math.random() * 3);
    var newDepth = Math.max(1, Number(st.depth || 1) + depthJump);
    st.activeArea = String(dest || pick(LIBRARY_AREAS));
    st.depth = newDepth;
    st.deepestDepth = Math.max(Number(st.deepestDepth || 1), newDepth);
    ensureFloorState(st, newDepth);
    node.cleared = true;
    node.portalUsed = true;
    st.selectedNodeByDepth[String(newDepth)] = Number(st.selectedNodeByDepth[String(newDepth)] || 0);
    st.lastResult = 'Portal transit complete. Arrived at ' + dest + ' (Depth ' + newDepth + ').';
    if (typeof showNotif === 'function') showNotif('Portal: ' + dest + ' — Depth ' + newDepth, 'good');
    attachLibraryStateToHex(st);
    openLibraryUI();
  };

  window.resolveInfiniteLibraryNode = function (col, row, idx, mode) {
    var st = ensureLibraryState();
    if (!st) return;
    var floor = ensureFloorState(st, st.depth);
    var safeIdx = clamp(Number(idx || 0), 0, Math.max(0, floor.nodes.length - 1));
    var node = floor.nodes[safeIdx];
    if (!node) return;
    runNodeExplore(st, floor, node, String(mode || 'explore'), Number(col), Number(row));
    st.selectedNodeByDepth[String(st.depth)] = safeIdx;
    attachLibraryStateToHex(st);
    openLibraryUI();
  };

  window.descendInfiniteLibraryFloor = function (col, row) {
    var st = ensureLibraryState();
    if (!st) return;
    st.depth = Math.max(1, Number(st.depth || 1) + 1);
    st.deepestDepth = Math.max(st.deepestDepth || 1, st.depth);
    ensureFloorState(st, st.depth);
    st.selectedNodeByDepth[String(st.depth)] = Number(st.selectedNodeByDepth[String(st.depth)] || 0);
    st.lastResult = 'You descend. The shelves breathe differently down here.';
    attachLibraryStateToHex(st);
    openLibraryUI();
  };

  window.ascendInfiniteLibraryFloor = function (col, row) {
    var st = ensureLibraryState();
    if (!st) return;
    if (st.depth <= 1) {
      if (typeof showNotif === 'function') showNotif('You are already at the highest mapped depth.', 'info');
      return;
    }
    st.depth -= 1;
    st.lastResult = 'You retreat to a higher shelf-band.';
    attachLibraryStateToHex(st);
    openLibraryUI();
  };

  function resolveInfiniteLibraryAction(action) {
    var st = ensureLibraryState();
    if (!st) return false;

    if (action === 'encounter') {
      var rolled = rollEncounterForDepth(st.depth);
      st.lastEncounter = rolled.summary + (rolled.detail ? (' | ' + rolled.detail) : '');
      st.lastResult = 'Encounter rolled from current depth band.';
      attachLibraryStateToHex(st);
      return openLibraryUI();
    }

    if (action === 'hook') {
      st.lastHook = generateBookFetchHook(st);
      st.lastResult = 'New contract generated.';
      attachLibraryStateToHex(st);
      return openLibraryUI();
    }

    // Legacy compatibility with older button handlers.
    if (action === 'descend') return window.descendInfiniteLibraryFloor();
    if (action === 'search' || action === 'trace' || action === 'boss') {
      var floor = ensureFloorState(st, st.depth);
      var idx = clamp(Number(st.selectedNodeByDepth[String(st.depth)] || 0), 0, floor.nodes.length - 1);
      var mode = action === 'search' ? 'read' : 'explore';
      if (action === 'boss') mode = 'explore';
      return window.resolveInfiniteLibraryNode(0, 0, idx, mode);
    }

    return openLibraryUI();
  }

  function openInfiniteLibraryAtHex(col, row) {
    if (typeof col !== 'number' || typeof row !== 'number') return openLibraryUI();
    var hex = getProvinceHexByKey(String(col) + ',' + String(row));
    if (!hex) {
      if (typeof showNotif === 'function') showNotif('Library hex could not be resolved.', 'warn');
      return false;
    }
    if (String(hex.type || '').toLowerCase() !== 'library') {
      if (typeof showNotif === 'function') showNotif('This area is not the Infinite Library.', 'warn');
      return false;
    }

    var st = ensureLibraryState();
    if (!st) return false;
    st.activeHexKey = String(col) + ',' + String(row);
    readLibraryStateFromHex(st, st.activeHexKey);
    st.delveCount = Math.max(0, Number(st.delveCount || 0) + 1);
    ensureFloorState(st, st.depth);

    if (typeof S !== 'undefined' && S) {
      if (!S.soloGM || typeof S.soloGM !== 'object') {
        S.soloGM = { websiteCounters: { tradeRolls: 0, libraryDelves: 0, taskGenerations: 0 } };
      }
      if (!S.soloGM.websiteCounters || typeof S.soloGM.websiteCounters !== 'object') {
        S.soloGM.websiteCounters = { tradeRolls: 0, libraryDelves: 0, taskGenerations: 0 };
      }
      S.soloGM.websiteCounters.libraryDelves = Math.max(0, Number(S.soloGM.websiteCounters.libraryDelves || 0) + 1);
    }

    attachLibraryStateToHex(st);
    return openLibraryUI();
  }

  function openInfiniteLibrary() {
    var st = ensureLibraryState();
    if (!st) return false;
    if (!st.activeHexKey && typeof window.getProvinceSelectedKey === 'function') {
      try { st.activeHexKey = String(window.getProvinceSelectedKey() || ''); } catch (_err) { st.activeHexKey = ''; }
    }
    if (st.activeHexKey) readLibraryStateFromHex(st, st.activeHexKey);
    ensureFloorState(st, st.depth);
    attachLibraryStateToHex(st);
    return openLibraryUI();
  }

  window.openInfiniteLibrary = openInfiniteLibrary;
  window.openInfiniteLibraryAtHex = openInfiniteLibraryAtHex;
  window.resolveInfiniteLibraryAction = resolveInfiniteLibraryAction;
})();
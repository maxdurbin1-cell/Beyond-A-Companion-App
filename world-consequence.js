/**
 * world-consequence.js
 * Phase 1 — Normalize and Persist Consequences
 *
 * Provides:
 *   window.recordWorldConsequence(event)  — fulfilled stub expected by all existing callers
 *   window.applyWorldConsequence(event)   — alias; the single consequence pipeline
 *   window.getWorldStateHexOverlay(key)   — province map overlay data per hex key "col,row"
 *   window.getConsequenceMissionBias()    — mission generation bias from current world state
 *   window.triggerFactionTurn()           — lightweight faction simulation tick
 *   window.getWorldConsequenceFeed()      — last N consequence entries for the feed panel
 *   window.ensureWorldState()             — lazy initialiser (safe to call anywhere)
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var MAX_FEED = 20;
  var MAX_CRISES = 5;
  var MAX_HEX_HISTORY = 10;
  var RECENT_CHANGE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes — "recently changed" glow

  var FACTION_IDS = ['rebels', 'guilds', 'church', 'empire', 'syndicate', 'scholars'];

  var FACTION_OPERATIONS = [
    { op: 'expand',      label: 'expanded influence',  deltas: { stability: -1, factionHeat: 1  }, severity: 'medium', posture: 'expanding'    },
    { op: 'retaliate',   label: 'retaliated',           deltas: { stability: -2, factionHeat: 2  }, severity: 'high',   posture: 'retaliating'  },
    { op: 'secure',      label: 'secured a route',      deltas: { stability: 1,  factionHeat: -1 }, severity: 'info',   posture: 'entrenched'   },
    { op: 'destabilize', label: 'destabilized a rival', deltas: { stability: -1, rumor: 1        }, severity: 'medium', posture: 'expanding'    },
    { op: 'negotiate',   label: 'opened negotiations',  deltas: { stability: 1,  witness: 1      }, severity: 'info',   posture: 'negotiating'  },
    { op: 'weaken',      label: 'suffered losses',      deltas: { stability: -1, factionHeat: -1 }, severity: 'medium', posture: 'weakened'     }
  ];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function getS() {
    return (typeof window !== 'undefined' && window.S && typeof window.S === 'object') ? window.S : null;
  }

  function deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (_e) { return obj; }
  }

  function pickRandom(arr) {
    if (!arr || !arr.length) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v || 0)); }

  function normalizeWorldRegion(region) {
    var r = String(region || 'province').toLowerCase();
    return (['province', 'sea', 'galaxy', 'wtw', 'planet'].indexOf(r) >= 0) ? r : 'province';
  }

  function getDefaultGovernanceState() {
    return {
      patrolStance: 'balanced',
      tariffStance: 'balanced',
      routePriority: 'trade',
      updatedAt: 0
    };
  }

  // ---------------------------------------------------------------------------
  // World-state initialiser
  // ---------------------------------------------------------------------------
  function ensureWorldState() {
    var S = getS();
    if (!S) return null;
    if (!S.worldState || typeof S.worldState !== 'object') {
      S.worldState = {
        version: 1,
        regions: {
          province: { hexes: {}, routes: {}, settlements: {} },
          sea:      { hexes: {}, routes: {}, settlements: {} },
          galaxy:   { hexes: {}, routes: {}, settlements: {} },
          wtw:      { hexes: {}, districts: {}               },
          planet:   { cells: {}                               }
        },
        factions: {},
        economy: { priceMultiplier: 1, scarcity: 0 },
        governance: {
          province: {
            patrolStance: 'balanced',
            tariffStance: 'balanced',
            routePriority: 'trade',
            updatedAt: 0
          }
        },
        capabilities: {},
        activeCrises: [],
        consequenceFeed: []
      };
    }
    // Lazily ensure sub-keys so old saves don't break
    var ws = S.worldState;
    ws.regions     = ws.regions     || {};
    ws.factions    = ws.factions    || {};
    ws.economy     = ws.economy     || { priceMultiplier: 1, scarcity: 0 };
    // ⚡ Governance now supports all regions (was province-only)
    ws.governance  = ws.governance  || {};
    ['province','sea','galaxy','wtw','planet'].forEach(function (reg) {
      ws.governance[reg] = ws.governance[reg] || { patrolStance: 'balanced', tariffStance: 'balanced', routePriority: 'trade', updatedAt: 0 };
    });
    ws.capabilities = ws.capabilities || {};
    ws.activeCrises     = Array.isArray(ws.activeCrises) ? ws.activeCrises : [];
    ws.consequenceFeed  = Array.isArray(ws.consequenceFeed) ? ws.consequenceFeed : [];
    ['province','sea','galaxy','wtw','planet'].forEach(function (r) {
      ws.regions[r] = ws.regions[r] || {};
      ws.regions[r].hexes = ws.regions[r].hexes || {};
      ws.regions[r].routes = ws.regions[r].routes || {};
      ws.regions[r].settlements = ws.regions[r].settlements || {};
    });
    applyProgressionCapabilities(ws);
    return ws;
  }

  function ensureGovernanceState(ws) {
    var world = ws || ensureWorldState();
    if (!world) return null;
    world.governance = world.governance || {};
    // Ensure all regions have governance state
    ['province','sea','galaxy','wtw','planet'].forEach(function (reg) {
      world.governance[reg] = world.governance[reg] || {
        patrolStance: 'balanced',
        tariffStance: 'balanced',
        routePriority: 'trade',
        updatedAt: 0
      };
    });
    return world.governance;
  }

  function getProvinceGovernancePolicyState() {
    return getRegionGovernancePolicyState('province');
  }

  function setProvinceGovernancePolicyState(next) {
    return setRegionGovernancePolicyState('province', next);
  }

  // ⚡ Generic region governance getters/setters
  function getRegionGovernancePolicyState(region) {
    var ws = ensureWorldState();
    var r = normalizeWorldRegion(region);
    if (!ws) return getDefaultGovernanceState();
    ensureGovernanceState(ws);
    return deepClone(ws.governance[r] || getDefaultGovernanceState());
  }

  function setRegionGovernancePolicyState(region, next) {
    var ws = ensureWorldState();
    if (!ws) return null;
    var r = normalizeWorldRegion(region);
    ensureGovernanceState(ws);
    var state = ws.governance[r] || getDefaultGovernanceState();
    var patch = next && typeof next === 'object' ? next : {};
    var patrol = String(patch.patrolStance || state.patrolStance || 'balanced').toLowerCase();
    var tariff = String(patch.tariffStance || state.tariffStance || 'balanced').toLowerCase();
    var route = String(patch.routePriority || state.routePriority || 'trade').toLowerCase();
    state.patrolStance = patrol === 'strict' || patrol === 'open' ? patrol : 'balanced';
    state.tariffStance = tariff === 'extractive' || tariff === 'relief' ? tariff : 'balanced';
    state.routePriority = route === 'military' || route === 'civic' ? route : 'trade';
    state.updatedAt = Date.now();
    ws.governance[r] = state;
    return deepClone(state);
  }

  function ensureFactionWorldEntry(ws, factionId) {
    if (!factionId) return null;
    var id = String(factionId).toLowerCase();
    if (!ws.factions[id] || typeof ws.factions[id] !== 'object') {
      ws.factions[id] = {
        heatByRegion: {},
        controlByRegion: {},
        activeOperations: [],
        posture: 'entrenched'
      };
    }
    return ws.factions[id];
  }

  function ensureHexEntry(ws, region, key) {
    var r = String(region || 'province');
    ws.regions[r] = ws.regions[r] || { hexes: {}, routes: {}, settlements: {} };
    ws.regions[r].hexes = ws.regions[r].hexes || {};
    var k = String(key || '');
    if (!k) return null;
    if (!ws.regions[r].hexes[k] || typeof ws.regions[r].hexes[k] !== 'object') {
      ws.regions[r].hexes[k] = {
        control: '',
        tension: 0,
        prosperity: 0,
        safety: 0,
        tags: [],
        siteState: {
          discoveries: 0,
          threatsCleared: 0,
          failedExpeditions: 0,
          hiddenCaches: 0,
          npcRelationships: 0,
          infrastructure: 0
        },
        lastChange: 0,
        history: []
      };
    }
    if (!ws.regions[r].hexes[k].siteState || typeof ws.regions[r].hexes[k].siteState !== 'object') {
      ws.regions[r].hexes[k].siteState = {
        discoveries: 0,
        threatsCleared: 0,
        failedExpeditions: 0,
        hiddenCaches: 0,
        npcRelationships: 0,
        infrastructure: 0
      };
    }
    return ws.regions[r].hexes[k];
  }

  function applyProgressionCapabilities(ws) {
    var S = getS();
    if (!ws || !S) return;
    var renown = Number(S.renown || 0);
    var holding = !!(S.holding && S.holding.established);
    var caravanOwned = !!(S.caravan && S.caravan.owned);
    ws.capabilities = {
      shortcuts: renown >= 6 || caravanOwned,
      factionPermissions: renown >= 8,
      intelLayers: renown >= 5,
      saferRest: holding,
      alternateResolutions: renown >= 10 || holding,
      governance: renown >= 12 && holding
    };
  }

  function getProvinceAdjacentKeys(key) {
    var S = getS();
    if (!S || typeof window === 'undefined' || !Array.isArray(window.mapData)) return [];
    var parts = String(key || '').split(',');
    if (parts.length !== 2) return [];
    var col = Number(parts[0]);
    var row = Number(parts[1]);
    if (!isFinite(col) || !isFinite(row)) return [];
    var dirs = [
      { c: col - 1, r: row - 1 }, { c: col, r: row - 1 }, { c: col + 1, r: row - 1 },
      { c: col - 1, r: row },                               { c: col + 1, r: row },
      { c: col - 1, r: row + 1 }, { c: col, r: row + 1 }, { c: col + 1, r: row + 1 }
    ];
    return dirs.map(function (p) {
      var hex = window.mapData.find(function (h) { return h && h.col === p.c && h.row === p.r; });
      return hex ? (hex.col + ',' + hex.row) : '';
    }).filter(Boolean);
  }

  function pickAdjacentTargets(originKey, limit, exclude) {
    var omit = Array.isArray(exclude) ? exclude : [];
    var keys = getProvinceAdjacentKeys(originKey).filter(function (key) { return omit.indexOf(key) < 0; });
    var picked = [];
    while (keys.length && picked.length < Math.max(0, Number(limit || 0))) {
      var idx = Math.floor(Math.random() * keys.length);
      picked.push(keys.splice(idx, 1)[0]);
    }
    return picked;
  }

  function buildPropagationPlan(event, ws) {
    // ⚡ Allow propagation for all hex-grid regions (province, sea, galaxy, wtw)
    if (!event || !event.locationKey) return [];
    var region = String(event.region || 'province');
    if (['province','sea','galaxy','wtw'].indexOf(region) < 0) return [];
    var stage = Number(event.propagationStage || 0);
    if (stage >= 2) return [];
    var gov = getRegionGovernancePolicyState(region) || { patrolStance: 'balanced', tariffStance: 'balanced', routePriority: 'trade' };
    var tags = Array.isArray(event.tags) ? event.tags : [];
    var deltas = event.deltas || {};
    var stageLabel = stage === 0 ? '1-hop' : '2-hop';
    var primaryCount = stage === 0 ? 2 : 1;
    var targets = pickAdjacentTargets(event.locationKey, primaryCount, [String(event.sourceLocationKey || '')]);
    if (!targets.length) return [];

    function makePlan(targetKey, title, detail, spreadDeltas, spreadTags) {
      return {
        system: 'world-propagation',
        title: title,
        detail: detail,
        region: region,
        locationKey: targetKey,
        severity: stage === 0 ? 'medium' : 'info',
        factionId: event.factionId || '',
        deltas: spreadDeltas,
        tags: spreadTags,
        propagationStage: stage + 1,
        sourceLocationKey: event.locationKey,
        noFurtherPropagation: stage + 1 >= 2
      };
    }

    return targets.map(function (targetKey) {
      var spreadDeltas = {};
      var spreadTags = ['regional-ripple', 'propagation-' + stageLabel];
      var title = 'Regional ripple';
      var detail = 'Change spreads from nearby activity at ' + event.locationKey + '.';

      if (tags.indexOf('closed-border') >= 0 || tags.indexOf('border-closed') >= 0 || tags.indexOf('dangerous-road') >= 0) {
        spreadDeltas.scarcity = 1;
        spreadDeltas.tension = stage === 0 ? 1 : 0;
        spreadTags.push('route-friction', 'scarcity-ripple');
        title = 'Route shockwave';
        detail = 'Border friction near ' + event.locationKey + ' is choking nearby movement and supply.';
      } else if (tags.indexOf('opened-border') >= 0 || tags.indexOf('discovered-route') >= 0 || tags.indexOf('contract-signed') >= 0) {
        spreadDeltas.scarcity = -1;
        if (stage === 0) spreadDeltas.stability = 1;
        spreadTags.push('route-recovery', 'trade-ripple');
        title = 'Trade recovery';
        detail = 'A nearby route opening around ' + event.locationKey + ' is easing movement and commerce.';
      } else if (tags.indexOf('active-crisis') >= 0 || event.severity === 'high') {
        spreadDeltas.tension = 1;
        if (stage === 0) spreadDeltas.scarcity = 1;
        spreadTags.push('instability-ripple', 'unrest-ripple');
        title = 'Instability ripple';
        detail = 'A crisis centered on ' + event.locationKey + ' is unsettling neighboring ground.';
      } else if (tags.indexOf('patrol-deployed') >= 0 || tags.indexOf('sanctuary-granted') >= 0) {
        spreadDeltas.safety = 1;
        if (stage === 0) spreadDeltas.tension = -1;
        spreadTags.push('security-ripple');
        title = 'Security ripple';
        detail = 'Organized security around ' + event.locationKey + ' is calming nearby lanes.';
      } else if (typeof deltas.stability === 'number' && deltas.stability > 0) {
        spreadDeltas.safety = 1;
        spreadTags.push('stability-ripple');
        title = 'Stability ripple';
        detail = 'Improved order at ' + event.locationKey + ' is carrying into neighboring hexes.';
      } else if (typeof deltas.stability === 'number' && deltas.stability < 0) {
        spreadDeltas.tension = 1;
        spreadTags.push('instability-ripple');
        title = 'Instability ripple';
        detail = 'Loss of control at ' + event.locationKey + ' is spilling into nearby zones.';
      } else if (typeof deltas.scarcity === 'number' && deltas.scarcity !== 0) {
        spreadDeltas.scarcity = deltas.scarcity > 0 ? 1 : -1;
        spreadTags.push('supply-ripple');
        title = deltas.scarcity > 0 ? 'Supply strain' : 'Supply relief';
        detail = 'Nearby markets are reacting to shifts centered on ' + event.locationKey + '.';
      } else {
        spreadDeltas.tension = stage === 0 ? 1 : 0;
        spreadTags.push('general-ripple');
      }

      if (gov.patrolStance === 'strict' && spreadDeltas.tension > 0) {
        spreadDeltas.tension = Math.max(0, Number(spreadDeltas.tension || 0) - 1);
        spreadDeltas.safety = Number(spreadDeltas.safety || 0) + 1;
        spreadTags.push('strict-patrol-buffer');
      } else if (gov.patrolStance === 'open' && spreadDeltas.safety > 0) {
        spreadDeltas.safety = Math.max(0, Number(spreadDeltas.safety || 0) - 1);
        spreadDeltas.tension = Number(spreadDeltas.tension || 0) + 1;
        spreadTags.push('open-patrol-exposure');
      }

      if (gov.tariffStance === 'relief' && spreadDeltas.scarcity > 0) {
        spreadDeltas.scarcity = Math.max(0, Number(spreadDeltas.scarcity || 0) - 1);
        spreadDeltas.prosperity = Number(spreadDeltas.prosperity || 0) + 1;
        spreadTags.push('tariff-relief-buffer');
      } else if (gov.tariffStance === 'extractive' && spreadDeltas.scarcity >= 0) {
        spreadDeltas.scarcity = Number(spreadDeltas.scarcity || 0) + 1;
        spreadTags.push('extractive-tariff-ripple');
      }

      if (gov.routePriority === 'trade' && (spreadTags.indexOf('trade-ripple') >= 0 || spreadTags.indexOf('route-recovery') >= 0)) {
        spreadDeltas.prosperity = Number(spreadDeltas.prosperity || 0) + 1;
        spreadTags.push('trade-priority-ripple');
      } else if (gov.routePriority === 'military' && spreadTags.indexOf('security-ripple') >= 0) {
        spreadDeltas.safety = Number(spreadDeltas.safety || 0) + 1;
        spreadTags.push('military-route-ripple');
      } else if (gov.routePriority === 'civic' && (spreadTags.indexOf('stability-ripple') >= 0 || spreadTags.indexOf('trade-ripple') >= 0)) {
        spreadDeltas.stability = Number(spreadDeltas.stability || 0) + 1;
        spreadTags.push('civic-route-ripple');
      }

      return makePlan(targetKey, title, detail, spreadDeltas, spreadTags);
    });
  }

  // ---------------------------------------------------------------------------
  // Core consequence applicator
  // ---------------------------------------------------------------------------
  function applyWorldConsequence(rawEvent) {
    if (!rawEvent || typeof rawEvent !== 'object') return;
    var ws = ensureWorldState();
    if (!ws) return; // S not ready yet

    var now = Date.now();
    var event = {
      system:      String(rawEvent.system      || 'unknown'),
      title:       String(rawEvent.title       || 'World event'),
      detail:      String(rawEvent.detail      || ''),
      region:      String(rawEvent.region      || 'province').toLowerCase(),
      locationKey: String(rawEvent.locationKey || ''),
      severity:    String(rawEvent.severity    || 'info'),  // info | medium | high
      factionId:   String(rawEvent.factionId   || ''),
      deltas:      (rawEvent.deltas && typeof rawEvent.deltas === 'object') ? rawEvent.deltas : {},
      tags:        Array.isArray(rawEvent.tags) ? rawEvent.tags : [],
      propagationStage: Number(rawEvent.propagationStage || 0),
      sourceLocationKey: String(rawEvent.sourceLocationKey || ''),
      noFurtherPropagation: !!rawEvent.noFurtherPropagation,
      at:          now
    };

    applyProgressionCapabilities(ws);

    // If callers omit a province location, project onto current selected hex.
    if (!event.locationKey && event.region === 'province') {
      try {
        if (typeof window.getProvinceSelectedKey === 'function') {
          event.locationKey = String(window.getProvinceSelectedKey() || '');
        }
      } catch (_e0) {}
      if (!event.locationKey) {
        try {
          var sh = window.selectedHex;
          if (sh && typeof sh.col === 'number' && typeof sh.row === 'number') {
            event.locationKey = String(sh.col) + ',' + String(sh.row);
          }
        } catch (_e1) {}
      }
    }

    // ---- 1. Update hex state ------------------------------------------------
    if (event.locationKey) {
      var hexEntry = ensureHexEntry(ws, event.region, event.locationKey);
      if (hexEntry) {
        if (event.factionId) hexEntry.control = event.factionId;

        // Clamp numeric deltas
        var d = event.deltas;
        if (typeof d.tension    === 'number') hexEntry.tension    = clamp(hexEntry.tension    + d.tension,    -5, 10);
        if (typeof d.safety     === 'number') hexEntry.safety     = clamp(hexEntry.safety     + d.safety,      -5, 5);
        if (typeof d.prosperity === 'number') hexEntry.prosperity = clamp(hexEntry.prosperity + d.prosperity, -5, 5);

        // Translate generic deltas to hex fields
        if (typeof d.stability === 'number') hexEntry.safety     = clamp(hexEntry.safety + d.stability,     -5, 5);
        if (typeof d.factionHeat === 'number') hexEntry.tension  = clamp(hexEntry.tension + d.factionHeat,  -5, 10);

        // Tags
        event.tags.forEach(function (t) {
          if (hexEntry.tags.indexOf(t) < 0) hexEntry.tags.push(t);
        });
        if (hexEntry.tags.indexOf('recent-conflict') < 0 && event.severity === 'high') {
          hexEntry.tags.push('recent-conflict');
        }

        // Permanent site memory updates for revisits.
        var ss = hexEntry.siteState || {};
        if (event.tags.indexOf('discovery') >= 0) ss.discoveries = Number(ss.discoveries || 0) + 1;
        if (event.tags.indexOf('threat-cleared') >= 0) ss.threatsCleared = Number(ss.threatsCleared || 0) + 1;
        if (event.tags.indexOf('failed-expedition') >= 0) ss.failedExpeditions = Number(ss.failedExpeditions || 0) + 1;
        if (event.tags.indexOf('hidden-cache') >= 0) ss.hiddenCaches = Number(ss.hiddenCaches || 0) + 1;
        if (event.tags.indexOf('npc-relationship') >= 0) ss.npcRelationships = Number(ss.npcRelationships || 0) + 1;
        if (event.tags.indexOf('infrastructure') >= 0 || event.tags.indexOf('settled-holding') >= 0) ss.infrastructure = Number(ss.infrastructure || 0) + 1;
        hexEntry.siteState = ss;

        // Route and settlement projections used by map overlay layers.
        if (event.tags.indexOf('dangerous-road') >= 0) {
          ws.regions[event.region].routes[event.locationKey] = { status: 'danger', at: now };
        }
        if (event.tags.indexOf('discovered-route') >= 0) {
          ws.regions[event.region].routes[event.locationKey] = { status: 'discovered', at: now };
        }
        if (event.tags.indexOf('closed-border') >= 0 || event.tags.indexOf('border-closed') >= 0) {
          ws.regions[event.region].routes[event.locationKey] = { status: 'closed', at: now };
        }
        if (event.tags.indexOf('settled-holding') >= 0) {
          ws.regions[event.region].settlements[event.locationKey] = { status: 'holding', at: now };
        }
        if (event.tags.indexOf('closed-port') >= 0) {
          ws.regions[event.region].settlements[event.locationKey] = { status: 'closed-port', at: now };
        }
        if (event.tags.indexOf('active-crisis') >= 0) {
          ws.regions[event.region].settlements[event.locationKey] = { status: 'crisis', at: now };
        }
        if (event.tags.indexOf('exhausted-site') >= 0) {
          ws.regions[event.region].settlements[event.locationKey] = { status: 'exhausted', at: now };
        }

        hexEntry.lastChange = now;
        hexEntry.history.unshift({ at: now, title: event.title, detail: event.detail, severity: event.severity });
        if (hexEntry.history.length > MAX_HEX_HISTORY) hexEntry.history.length = MAX_HEX_HISTORY;
      }
    }

    // ---- 2. Update faction world entry -------------------------------------
    if (event.factionId) {
      var fe = ensureFactionWorldEntry(ws, event.factionId);
      if (fe) {
        var r = event.region;
        fe.heatByRegion[r]    = clamp((fe.heatByRegion[r]    || 0) + (event.deltas.factionHeat || 0), 0, 10);
        fe.controlByRegion[r] = clamp((fe.controlByRegion[r] || 0) + (event.deltas.stability   || 0), 0, 10);
        // posture already set by faction turn; don't overwrite here unless entry is neutral
      }
    }

    // ---- 2b. Economy pressure ----------------------------------------------
    if (typeof event.deltas.scarcity === 'number') {
      ws.economy.scarcity = clamp((ws.economy.scarcity || 0) + event.deltas.scarcity, -5, 10);
      ws.economy.priceMultiplier = clamp(1 + (ws.economy.scarcity * 0.05), 0.75, 2.0);
    }

    // ---- 3. Consequence feed -----------------------------------------------
    ws.consequenceFeed.unshift({ at: now, system: event.system, title: event.title, detail: event.detail, severity: event.severity, region: event.region, locationKey: event.locationKey });
    if (ws.consequenceFeed.length > MAX_FEED) ws.consequenceFeed.length = MAX_FEED;

    // ---- 4. Active crises ---------------------------------------------------
    if (event.severity === 'high' || event.tags.indexOf('active-crisis') >= 0) {
      ws.activeCrises.unshift({ at: now, title: event.title, region: event.region, locationKey: event.locationKey });
      if (ws.activeCrises.length > MAX_CRISES) ws.activeCrises.length = MAX_CRISES;
    }

    // ---- 5. Refresh province map overlay if Province tab is visible ---------
    if (event.region === 'province') {
      try {
        if (typeof window.renderHexMap === 'function') window.renderHexMap();
      } catch (_e) {}
    }

    if (!event.noFurtherPropagation) {
      var spreadPlan = buildPropagationPlan(event, ws);
      spreadPlan.forEach(function (spreadEvent) {
        applyWorldConsequence(spreadEvent);
        if (spreadEvent.locationKey) {
          addHexRumor(spreadEvent.locationKey, {
            text: spreadEvent.detail,
            tags: spreadEvent.tags,
            source: 'propagation'
          });
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Map overlay accessor  (called from renderHexMap per hex)
  // ---------------------------------------------------------------------------
  function getWorldStateHexOverlayForRegion(region, key) {
    var S = getS();
    if (!S || !S.worldState) return null;
    var r = normalizeWorldRegion(region);
    var regionState = (S.worldState.regions && S.worldState.regions[r]) || {};
    var hexes = regionState.hexes || {};
    var h = hexes[String(key || '')];
    if (!h) return null;
    var routeState = regionState.routes && regionState.routes[String(key || '')] ? regionState.routes[String(key || '')] : null;
    var settlementState = regionState.settlements && regionState.settlements[String(key || '')] ? regionState.settlements[String(key || '')] : null;
    var isCrisis = Array.isArray(S.worldState.activeCrises) && S.worldState.activeCrises.some(function(c){
      return c
        && String(c.region || 'province') === r
        && String(c.locationKey || '') === String(key || '');
    });
    var tags = Array.isArray(h.tags) ? h.tags : [];
    var caps = S.worldState.capabilities || {};
    return {
      control:      h.control     || '',
      tension:      h.tension     || 0,
      safety:       h.safety      || 0,
      prosperity:   h.prosperity  || 0,
      tags:         tags,
      dangerousRoad: !!(routeState && routeState.status === 'danger') || tags.indexOf('dangerous-road') >= 0,
      discoveredRoute: !!(routeState && routeState.status === 'discovered') || tags.indexOf('discovered-route') >= 0,
      closedBorder: !!(routeState && routeState.status === 'closed') || tags.indexOf('closed-border') >= 0 || tags.indexOf('border-closed') >= 0,
      exhaustedSite: !!(settlementState && settlementState.status === 'exhausted') || tags.indexOf('exhausted-site') >= 0,
      settledHolding: !!(settlementState && settlementState.status === 'holding') || tags.indexOf('settled-holding') >= 0,
      closedPort: !!(settlementState && settlementState.status === 'closed-port') || tags.indexOf('closed-port') >= 0,
      activeCrisis: !!isCrisis || tags.indexOf('active-crisis') >= 0,
      patrols: tags.indexOf('patrol-deployed') >= 0,
      capabilities: caps,
      siteState: h.siteState || null,
      recentChange: h.lastChange  ? (Date.now() - h.lastChange < RECENT_CHANGE_WINDOW_MS) : false,
      lastChange:   h.lastChange  || 0
    };
  }

  function getWorldStateHexOverlay(key) {
    return getWorldStateHexOverlayForRegion('province', key);
  }

  // ---------------------------------------------------------------------------
  // Hex rumor diffusion — lightweight word-of-mouth layer
  // ---------------------------------------------------------------------------
  var MAX_HEX_RUMORS = 6;

  function addHexRumor(key, rumor) {
    var ws = ensureWorldState();
    if (!ws || !key) return;
    var hexEntry = ensureHexEntry(ws, 'province', String(key));
    if (!hexEntry) return;
    if (!Array.isArray(hexEntry.rumors)) hexEntry.rumors = [];
    hexEntry.rumors.unshift({
      text:   String(rumor.text   || ''),
      tags:   Array.isArray(rumor.tags) ? rumor.tags : [],
      source: String(rumor.source || 'traveler'),
      day:    rumor.day != null ? Number(rumor.day) : Date.now()
    });
    if (hexEntry.rumors.length > MAX_HEX_RUMORS) hexEntry.rumors.length = MAX_HEX_RUMORS;
  }

  function getHexRumors(key) {
    var S = getS();
    if (!S || !S.worldState) return [];
    var hexes = (S.worldState.regions && S.worldState.regions.province && S.worldState.regions.province.hexes) || {};
    var h = hexes[String(key || '')];
    return (h && Array.isArray(h.rumors)) ? h.rumors.slice() : [];
  }

  // ---------------------------------------------------------------------------
  // Mission generation bias
  // ---------------------------------------------------------------------------
  function getConsequenceMissionBias() {
    var S = getS();
    if (!S || !S.worldState) return { focusRegion: '', difficultyShift: 0, rewardBonus: 0, preferredVerbs: [] };
    var crises = S.worldState.activeCrises || [];
    var focusRegion = crises.length ? String((crises[0] && crises[0].region) || 'province') : 'province';
    var gov = getRegionGovernancePolicyState(focusRegion) || getDefaultGovernanceState();
    if (!crises.length) {
      var quietPreferred = [];
      if (gov.routePriority === 'trade') quietPreferred = ['Escort', 'Deliver', 'Guide', 'Secure'];
      else if (gov.routePriority === 'civic') quietPreferred = ['Rebuild', 'Aid', 'Stabilize', 'Supply'];
      else quietPreferred = ['Guard', 'Patrol', 'Strike', 'Secure'];
      return {
        focusRegion: 'province',
        difficultyShift: gov.patrolStance === 'strict' ? 1 : 0,
        rewardBonus: gov.tariffStance === 'extractive' ? 40 : 0,
        preferredVerbs: quietPreferred
      };
    }
    var latest = crises[0];
    var preferred = ['Stabilize', 'Investigate', 'Reclaim', 'Escort'];
    var lowerTitle = String((latest && latest.title) || '').toLowerCase();
    if (lowerTitle.indexOf('border') >= 0 || lowerTitle.indexOf('faction') >= 0) preferred = ['Negotiate', 'Broker', 'Influence', 'Escort'];
    if (lowerTitle.indexOf('route') >= 0 || lowerTitle.indexOf('convoy') >= 0) preferred = ['Escort', 'Guard', 'Recover', 'Stabilize'];
    if (gov.routePriority === 'trade') preferred = preferred.concat(['Deliver', 'Transport', 'Escort']);
    if (gov.routePriority === 'civic') preferred = preferred.concat(['Aid', 'Rebuild', 'Stabilize']);
    if (gov.routePriority === 'military') preferred = preferred.concat(['Guard', 'Strike', 'Patrol']);
    if (gov.patrolStance === 'strict') preferred = preferred.concat(['Inspect', 'Suppress']);
    if (gov.tariffStance === 'extractive') preferred = preferred.concat(['Smuggle', 'Sabotage']);
    if (gov.tariffStance === 'relief') preferred = preferred.concat(['Supply', 'Deliver']);
    return {
      focusRegion:    String(latest.region || 'province'),
      difficultyShift: (crises.length >= 3 ? 1 : 0) + (gov.patrolStance === 'strict' ? 1 : 0),
      rewardBonus:     (crises.length >= 2 ? 50 : 0) + (gov.tariffStance === 'extractive' ? 25 : 0),
      preferredVerbs:  preferred
    };
  }

  // ---------------------------------------------------------------------------
  // Faction turn simulator
  // ---------------------------------------------------------------------------
  var _factionTurnBusy = false;
  var _lastFactionTurnAt = 0;
  var FACTION_TURN_COOLDOWN_MS = 2000; // debounce rapid calls

  function triggerFactionTurn() {
    if (_factionTurnBusy) return;
    var now = Date.now();
    if (now - _lastFactionTurnAt < FACTION_TURN_COOLDOWN_MS) return;
    _lastFactionTurnAt = now;
    _factionTurnBusy = true;
    try {
      runFactionTurn();
    } catch (_e) {}
    _factionTurnBusy = false;
  }

  function runFactionTurn() {
    var ws = ensureWorldState();
    if (!ws) return;

    // Gather live faction IDs from S.factionBases if available, fall back to built-in set
    var S = getS();
    var liveFactions = FACTION_IDS.slice();
    if (S && S.factionBases && typeof S.factionBases === 'object') {
      var bkeys = Object.keys(S.factionBases);
      if (bkeys.length) liveFactions = bkeys;
    }

    // Pick a faction to act
    var factionId = pickRandom(liveFactions);
    if (!factionId) return;

    // Determine faction posture: heat drives aggression
    var fe = ensureFactionWorldEntry(ws, factionId);
    var heat = (fe.heatByRegion && fe.heatByRegion.province) || 0;

    // Higher heat → more aggressive operations
    var pool;
    if (heat >= 5) {
      pool = FACTION_OPERATIONS.filter(function (o) { return o.op === 'retaliate' || o.op === 'destabilize'; });
    } else if (heat >= 3) {
      pool = FACTION_OPERATIONS.filter(function (o) { return o.op === 'expand' || o.op === 'retaliate' || o.op === 'secure'; });
    } else {
      pool = FACTION_OPERATIONS.filter(function (o) { return o.op === 'secure' || o.op === 'negotiate' || o.op === 'expand'; });
    }
    if (!pool.length) pool = FACTION_OPERATIONS;

    var operation = pickRandom(pool);
    if (!operation) return;

    // Update faction posture
    fe.posture = operation.posture;

    // Pick a region hex for the operation (biased by operation type)
    var locationKey = '';
    var regionLabel = 'province';
    if (typeof window !== 'undefined' && Array.isArray(window.mapData) && window.mapData.length) {
      var poolHexes = window.mapData.slice();
      if (operation.op === 'secure' || operation.op === 'destabilize') {
        var roads = window.mapData.filter(function (hx) { return hx && hx.type === 'trade'; });
        if (roads.length) poolHexes = roads;
      }
      if (operation.op === 'expand' || operation.op === 'negotiate') {
        var settlements = window.mapData.filter(function (hx) { return hx && (hx.type === 'dwelling' || hx.type === 'seat' || hx.type === 'holding'); });
        if (settlements.length) poolHexes = settlements;
      }
      var hex = pickRandom(poolHexes);
      if (hex) {
        locationKey = hex.col + ',' + hex.row;
        regionLabel  = 'province';
      }
    }

    // Record faction operation log
    fe.activeOperations = fe.activeOperations || [];
    fe.activeOperations.unshift({ at: Date.now(), op: operation.op, locationKey: locationKey });
    if (fe.activeOperations.length > 5) fe.activeOperations.length = 5;

    // Emit the consequence
    var opTags = ['faction-operation', operation.op];
    if (operation.op === 'retaliate' || operation.op === 'destabilize') opTags.push('active-crisis', 'dangerous-road', 'border-closed');
    if (operation.op === 'secure') opTags.push('discovered-route', 'patrol-deployed');
    if (operation.op === 'expand') opTags.push('settled-holding');
    if (operation.op === 'negotiate') opTags.push('opened-border');
    if (operation.op === 'weaken') opTags.push('closed-port', 'exhausted-site');

    applyWorldConsequence({
      system:      'faction-turn',
      title:       toTitle(factionId) + ' faction ' + operation.label,
      detail:      'Autonomous faction operation: ' + operation.op + (locationKey ? ' at ' + locationKey : '') + '.',
      region:      regionLabel,
      locationKey: locationKey,
      severity:    operation.severity,
      factionId:   factionId,
      deltas:      operation.deltas,
      tags:        opTags
    });

    // Optionally show a subtle notification only for high-severity turns
    if (operation.severity === 'high' && typeof window.showNotif === 'function') {
      try {
        window.showNotif('[World] ' + toTitle(factionId) + ' ' + operation.label + ' in ' + regionLabel + '.', 'warn');
      } catch (_e) {}
    }
  }

  function toTitle(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ---------------------------------------------------------------------------
  // Consequence feed accessor
  // ---------------------------------------------------------------------------
  function getWorldConsequenceFeed() {
    var S = getS();
    if (!S || !S.worldState) return [];
    return Array.isArray(S.worldState.consequenceFeed) ? S.worldState.consequenceFeed : [];
  }

  // ---------------------------------------------------------------------------
  // Bootstrap: ensure worldState when S is ready
  // ---------------------------------------------------------------------------
  function tryBootstrap() {
    var S = getS();
    if (S) { ensureWorldState(); return; }
    // S may not be initialised yet; retry briefly
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (getS()) { ensureWorldState(); clearInterval(timer); return; }
      if (attempts > 20) clearInterval(timer);
    }, 250);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryBootstrap);
    } else {
      tryBootstrap();
    }
  }

  // ---------------------------------------------------------------------------
  // Expose globals
  // ---------------------------------------------------------------------------
  window.ensureWorldState          = ensureWorldState;
  window.applyWorldConsequence     = applyWorldConsequence;
  window.recordWorldConsequence    = applyWorldConsequence; // satisfy existing callers
  window.getWorldStateHexOverlay   = getWorldStateHexOverlay;
  window.getWorldStateHexOverlayForRegion = getWorldStateHexOverlayForRegion;
  window.getConsequenceMissionBias = getConsequenceMissionBias;
  window.getProvinceGovernancePolicyState = getProvinceGovernancePolicyState;
  window.setProvinceGovernancePolicyState = setProvinceGovernancePolicyState;
  window.getRegionGovernancePolicyState   = getRegionGovernancePolicyState;   // ⚡ NEW: Works for any region
  window.setRegionGovernancePolicyState   = setRegionGovernancePolicyState;   // ⚡ NEW: Works for any region
  window.triggerFactionTurn        = triggerFactionTurn;
  window.getWorldConsequenceFeed   = getWorldConsequenceFeed;
  window.addHexRumor               = addHexRumor;
  window.getHexRumors              = getHexRumors;

})();

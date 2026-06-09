(function () {
  function ensureState() {
    if (typeof window === 'undefined' || typeof S === 'undefined' || !S) return null;
    if (!S.endgameArena || typeof S.endgameArena !== 'object') {
      S.endgameArena = {
        dayStamp: '',
        portalsByScope: {},
        gatesClosed: 0,
        lastBoss: '',
        closedByType: {
          hellscape: 0,
          celestial: 0
        },
        pinnacleOpenedByType: {
          hellscape: false,
          celestial: false
        }
      };
    }
    if (!S.endgameArena.portalsByScope || typeof S.endgameArena.portalsByScope !== 'object') {
      S.endgameArena.portalsByScope = {};
    }
    if (!S.endgameArena.closedByType || typeof S.endgameArena.closedByType !== 'object') {
      S.endgameArena.closedByType = { hellscape: 0, celestial: 0 };
    }
    S.endgameArena.closedByType.hellscape = Math.max(0, Number(S.endgameArena.closedByType.hellscape || 0));
    S.endgameArena.closedByType.celestial = Math.max(0, Number(S.endgameArena.closedByType.celestial || 0));
    if (!S.endgameArena.pinnacleOpenedByType || typeof S.endgameArena.pinnacleOpenedByType !== 'object') {
      S.endgameArena.pinnacleOpenedByType = { hellscape: false, celestial: false };
    }
    S.endgameArena.pinnacleOpenedByType.hellscape = !!S.endgameArena.pinnacleOpenedByType.hellscape;
    S.endgameArena.pinnacleOpenedByType.celestial = !!S.endgameArena.pinnacleOpenedByType.celestial;
    S.endgameArena.gatesClosed = Math.max(0, Number(S.endgameArena.gatesClosed || 0));
    return S.endgameArena;
  }

  function normalizeGateType(type) {
    return String(type || '').toLowerCase() === 'celestial' ? 'celestial' : 'hellscape';
  }

  function syncGateCountsToMissionDirector(closedType, nextCount) {
    if (!S || !S.missionDirector || !S.missionDirector.endgame || !S.missionDirector.endgame.gateWar) return;
    var gateWar = S.missionDirector.endgame.gateWar;
    if (closedType === 'celestial') gateWar.closedCelestial = Math.max(0, Number(nextCount || 0));
    else gateWar.closedHellscape = Math.max(0, Number(nextCount || 0));
  }

  function openArenaPopupSafe(payload, fallbackMessage) {
    function tryOpenPopup() {
      if (typeof window.openArenaCombatPopup !== 'function') return false;
      try {
        window.openArenaCombatPopup(payload || {});
        return true;
      } catch (_popupErr) {
        return false;
      }
    }

    var opened = tryOpenPopup();
    if (opened) return true;

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(function () {
        var retried = tryOpenPopup();
        if (!retried) {
          forceArenaFallbackSurface(payload || {});
          notifyArenaPopupUnavailable(fallbackMessage || 'Combat popup was blocked. Routed to Combat tab as fallback.');
        }
      });
      return true;
    }

    forceArenaFallbackSurface(payload || {});
    notifyArenaPopupUnavailable(fallbackMessage || 'Combat popup was blocked. Routed to Combat tab as fallback.');
    return false;
  }

  function withArenaRuntimeReady(runFn, unavailableMessage, attempt) {
    var tries = Math.max(0, Number(attempt || 0));
    var hasSeed = typeof window.seedArenaCombat === 'function';
    var hasPopup = typeof window.openArenaCombatPopup === 'function';
    if (hasSeed && hasPopup) {
      try {
        return runFn();
      } catch (_err) {
        notifyArenaPopupUnavailable(unavailableMessage || 'Arena runtime failed to open. Try again.');
        return false;
      }
    }
    if (tries < 8 && typeof window.setTimeout === 'function') {
      if (tries === 0 && typeof showNotif === 'function') {
        showNotif('Arena systems are initializing. Re-trying popup launch...', 'info');
      }
      window.setTimeout(function () {
        withArenaRuntimeReady(runFn, unavailableMessage, tries + 1);
      }, 120);
      return true;
    }
    notifyArenaPopupUnavailable(unavailableMessage || 'Arena systems are unavailable right now.');
    return false;
  }

  function getDayStamp() {
    var d = new Date();
    return String(d.getUTCFullYear()) + '-' + String(d.getUTCMonth() + 1) + '-' + String(d.getUTCDate());
  }

  function hashString(value) {
    var str = String(value || '');
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function pickPortalGateType(scope, key, idx) {
    var roll = hashString(String(scope || '') + '|' + String(key || '') + '|' + String(idx || 0)) % 2;
    return roll === 0 ? 'hellscape' : 'celestial';
  }

  function buildPortalSet(scope, allKeys) {
    var state = ensureState();
    if (!state) return [];
    var keys = Array.isArray(allKeys) ? allKeys.map(function (k) { return String(k || ''); }).filter(Boolean) : [];
    if (!keys.length) return [];

    var dayStamp = getDayStamp();
    var scopeKey = String(scope || 'province');
    var cache = state.portalsByScope[scopeKey];
    var signature = keys.slice().sort().join('|');
    if (cache && cache.dayStamp === dayStamp && cache.signature === signature && Array.isArray(cache.portals)) {
      return cache.portals;
    }

    var count = keys.length >= 40 ? 2 : 1;
    var used = {};
    var portals = [];
    for (var i = 0; i < count; i++) {
      var offset = hashString(dayStamp + '|' + scopeKey + '|' + signature + '|' + i);
      var key = keys[offset % keys.length];
      var guard = 0;
      while (used[key] && guard < keys.length) {
        offset += 7;
        key = keys[offset % keys.length];
        guard += 1;
      }
      if (used[key]) continue;
      used[key] = true;
      portals.push({
        key: key,
        gateType: pickPortalGateType(scopeKey, key, i),
        closed: false,
        puzzleAttempts: 0
      });
    }

    state.dayStamp = dayStamp;
    state.portalsByScope[scopeKey] = {
      dayStamp: dayStamp,
      signature: signature,
      keys: keys.slice(),
      portals: portals
    };
    return portals;
  }

  function getScopeHexKeys(scope, fallbackKeys) {
    var scoped = String(scope || 'province').toLowerCase();
    if (Array.isArray(fallbackKeys) && fallbackKeys.length) {
      return fallbackKeys.map(function (k) { return String(k || ''); }).filter(Boolean);
    }
    if (scoped === 'sea' && S && S.lastSea && Array.isArray(S.lastSea.map)) {
      return S.lastSea.map.filter(function (hex) { return !!hex; }).map(function (hex) { return String(hex.key || (String(hex.col) + ',' + String(hex.row))); });
    }
    if (scoped === 'province' && Array.isArray(window.mapData)) {
      return window.mapData.filter(function (hex) { return !!hex; }).map(function (hex) { return String(hex.col) + ',' + String(hex.row); });
    }
    return [];
  }

  function spawnReplacementPortal(flow) {
    var state = ensureState();
    if (!state || !state.portalsByScope) return null;
    var scope = String(flow && flow.gatePortal && flow.gatePortal.scope || 'province');
    var cache = state.portalsByScope[scope];
    if (!cache || !Array.isArray(cache.portals)) return null;

    var knownKeys = getScopeHexKeys(scope, cache.keys || []);
    if (!knownKeys.length) return null;
    var occupied = {};
    cache.portals.forEach(function (p) {
      if (!p) return;
      occupied[String(p.key || '')] = true;
    });

    var available = knownKeys.filter(function (k) {
      return !!k && !occupied[String(k)];
    });
    if (!available.length) return null;
    var roll = hashString(String(scope) + '|' + String(Date.now()) + '|' + String(state.gatesClosed || 0));
    var nextKey = available[roll % available.length];
    var gateType = pickPortalGateType(scope, nextKey, cache.portals.length + 1);
    var portal = {
      key: nextKey,
      gateType: gateType,
      closed: false,
      puzzleAttempts: 0
    };
    cache.portals.push(portal);
    return portal;
  }

  function getPortalMarker(scope, key, allKeys) {
    var portals = buildPortalSet(scope, allKeys);
    var markerKey = String(key || '');
    for (var i = 0; i < portals.length; i++) {
      if (String(portals[i].key) === markerKey && !portals[i].closed) return portals[i];
    }
    return null;
  }

  function enemySpecForGateType(type) {
    if (String(type || '') === 'celestial') {
      return {
        label: 'Celestial Gate',
        summary: '1 Seraphim (d12, 24 HP)',
        enemies: [{ name: 'Seraphim Gatekeeper', dread: 12, hp: 24 }]
      };
    }
    var cnt = 2 + Math.floor(Math.random() * 3);
    var enemies = [];
    var names = ['Abyss Imp', 'Hellchain Fiend', 'Rift Demon', 'Cinder Maw'];
    for (var i = 0; i < cnt; i++) {
      enemies.push({
        name: names[i % names.length] + ' #' + String(i + 1),
        dread: 4,
        hp: 8
      });
    }
    return {
      label: 'Hellscape Gate',
      summary: String(cnt) + ' Demons (d4, 8 HP each)',
      enemies: enemies
    };
  }

  function seedGateEnemies(gateType, flow) {
    var spec = enemySpecForGateType(gateType);
    if (!Array.isArray(S.enemies)) S.enemies = [];
    S.enemies = S.enemies.filter(function (enemy) { return enemy && enemy.ally; });
    var firstGateEnemyId = '';
    spec.enemies.forEach(function (enemy, idx) {
      var deathNumber = (window.BTLRules && typeof window.BTLRules.deathNumberForHealth === 'function')
        ? window.BTLRules.deathNumberForHealth(enemy.hp)
        : Math.max(1, Math.ceil(Math.max(1, Number(enemy.hp || 1)) / 2));
      var gateEnemyId = 'gate-' + String(gateType) + '-' + String(idx + 1) + '-' + String(Date.now());
      if (!firstGateEnemyId) firstGateEnemyId = gateEnemyId;
      S.enemies.push({
        id: gateEnemyId,
        name: enemy.name,
        dread: enemy.dread,
        stress: 0,
        maxStress: enemy.hp,
        health: enemy.hp,
        deathNumber: deathNumber,
        arena: true,
        arenaMode: 'gate',
        specialAction: {
          name: String(gateType === 'celestial' ? 'Radiant Burst' : 'Hellfire Lunge'),
          text: String(gateType === 'celestial' ? 'The seraphim flashes forward with a radiant cut.' : 'A demon lunges with chain-fire and ash.')
        }
      });
    });
    S.combat = S.combat || {};
    S.combat.enemyDread = spec.enemies.length ? Number(spec.enemies[0].dread || 4) : 4;
    if (flow) {
      flow.mode = 'gate';
      flow.queue = [Number(spec.enemies[0] && spec.enemies[0].dread || 4)];
      flow.index = 0;
      flow.enemy = spec.enemies[0] ? {
        id: 'gate-primary',
        name: spec.enemies[0].name,
        dread: spec.enemies[0].dread,
        maxStress: spec.enemies[0].hp,
        health: spec.enemies[0].hp,
        deathNumber: (window.BTLRules && typeof window.BTLRules.deathNumberForHealth === 'function')
          ? window.BTLRules.deathNumberForHealth(spec.enemies[0].hp)
          : Math.max(1, Math.ceil(Math.max(1, Number(spec.enemies[0].hp || 1)) / 2)),
        stress: 0,
        specialAction: {
          name: String(gateType === 'celestial' ? 'Radiant Burst' : 'Hellfire Lunge'),
          text: String(gateType === 'celestial' ? 'The seraphim flashes forward with a radiant cut.' : 'A demon lunges with chain-fire and ash.')
        }
      } : null;
      flow.gatePortal = flow.gatePortal || {};
      flow.gatePortal.type = String(gateType || 'hellscape');
      flow.gatePortal.spec = spec;
      flow.gatePortal.puzzleReady = false;
      flow.gatePortal.puzzleAttempts = Math.max(0, Number(flow.gatePortal.puzzleAttempts || 0));
      flow.selectedEnemyId = firstGateEnemyId;
      flow.selectedEnemyName = spec.enemies[0] ? String(spec.enemies[0].name || 'Gate Enemy') : '';
    }
    if (typeof updateCombatUI === 'function') updateCombatUI();
    if (typeof renderEnemies === 'function') renderEnemies();
    if (typeof renderCombatOptions === 'function') renderCombatOptions();
    return spec;
  }

  function livingHostiles() {
    if (!Array.isArray(S.enemies)) return 0;
    return S.enemies.filter(function (enemy) {
      return enemy && !enemy.ally && Number(enemy.stress || 0) < Number(enemy.maxStress || 0);
    }).length;
  }

  function notifyArenaPopupUnavailable(message) {
    if (typeof showNotif === 'function') {
      showNotif(String(message || 'Unable to open popup combat right now. Try again.'), 'warn');
    }
  }

  function forceArenaFallbackSurface(payload) {
    try {
      if (typeof switchTab === 'function') {
        var combatBtn = document.querySelector(".tab-btn[onclick*=\"switchTab('combat'\"]");
        switchTab('combat', combatBtn || null);
      }
      if (typeof updateCombatUI === 'function') updateCombatUI();
      if (typeof renderEnemies === 'function') renderEnemies();
      if (typeof renderQP === 'function') renderQP('combat');
      if (typeof renderCombatOptions === 'function') renderCombatOptions();
      if (payload && typeof payload.title === 'string' && typeof showNotif === 'function') {
        showNotif(String(payload.title) + ' active in Combat tab.', 'info');
      }
    } catch (_err) {}
  }

  function openSeaColosseumArena(mode, hexKey) {
    var arenaMode = String(mode || 'challenge');
    var title = arenaMode === 'endless' ? 'Sea Colosseum - Endless Mode' : 'Sea Colosseum - Challenge Mode';
    return withArenaRuntimeReady(function () {
      window.seedArenaCombat(arenaMode, { hexKey: String(hexKey || ''), title: title });
      openArenaPopupSafe({ mode: arenaMode, hexKey: String(hexKey || ''), title: title }, 'Colosseum combat popup was blocked. Re-open from the sea marker.');
      if (typeof showNotif === 'function') {
        showNotif('Arena opened: ' + (arenaMode === 'endless' ? 'Endless Mode' : 'Challenge Mode') + '.', 'good');
      }
      return true;
    }, 'Colosseum popup could not open. Re-open from the sea marker.');
  }

  function appendGateReinforcements(count, gateType, flow) {
    var wave = Math.max(1, Number(count || 1));
    var type = String(gateType || 'hellscape').toLowerCase();
    if (!Array.isArray(S.enemies)) S.enemies = [];
    var baseName = type === 'celestial' ? 'Gate Warden' : 'Rift Demon';
    var dread = type === 'celestial' ? 8 : 4;
    var hp = type === 'celestial' ? 16 : 8;
    var deathNumber = (window.BTLRules && typeof window.BTLRules.deathNumberForHealth === 'function')
      ? window.BTLRules.deathNumberForHealth(hp)
      : Math.max(1, Math.ceil(Math.max(1, Number(hp || 1)) / 2));
    var firstReinforcementId = '';
    for (var i = 0; i < wave; i++) {
      var reinforcementId = 'gate-reinforce-' + String(Date.now()) + '-' + String(i + 1);
      if (!firstReinforcementId) firstReinforcementId = reinforcementId;
      S.enemies.push({
        id: reinforcementId,
        name: baseName + ' Reinforcement #' + String(i + 1),
        dread: dread,
        stress: 0,
        maxStress: hp,
        health: hp,
        deathNumber: deathNumber,
        arena: true,
        arenaMode: 'gate',
        specialAction: {
          name: type === 'celestial' ? 'Radiant Lance' : 'Hellfire Lunge',
          text: type === 'celestial' ? 'A gate warden descends in a column of light.' : 'A demon rips through the unstable seal.'
        }
      });
    }
    S.combat = S.combat || {};
    S.combat.enemyDread = dread;
    if (flow) {
      flow.mode = 'gate';
      flow.enemy = {
        id: 'gate-reinforce-primary',
        name: baseName + ' Reinforcement',
        dread: dread,
        maxStress: hp,
        health: hp,
        deathNumber: deathNumber,
        stress: 0,
        specialAction: {
          name: type === 'celestial' ? 'Radiant Lance' : 'Hellfire Lunge',
          text: type === 'celestial' ? 'A gate warden descends in a column of light.' : 'A demon rips through the unstable seal.'
        }
      };
      flow.selectedEnemyId = firstReinforcementId;
      flow.selectedEnemyName = baseName + ' Reinforcement #1';
    }
    if (typeof updateCombatUI === 'function') updateCombatUI();
    if (typeof renderEnemies === 'function') renderEnemies();
    if (typeof renderCombatOptions === 'function') renderCombatOptions();
  }

  function closeGatePortalOnMap(flow) {
    var state = ensureState();
    var scopeCache = state && state.portalsByScope
      ? state.portalsByScope[String(flow && flow.gatePortal && flow.gatePortal.scope || 'province')]
      : null;
    if (!scopeCache || !Array.isArray(scopeCache.portals)) return;
    for (var i = 0; i < scopeCache.portals.length; i++) {
      if (String(scopeCache.portals[i].key) === String(flow && flow.gatePortal && flow.gatePortal.key || '')) {
        scopeCache.portals[i].closed = true;
      }
    }
  }

  function openEndgameGatePortal(scope, key, allKeys) {
    var portal = getPortalMarker(scope, key, allKeys);
    if (!portal) {
      if (typeof showNotif === 'function') showNotif('No active endgame gate at this hex today.', 'info');
      return false;
    }

    return withArenaRuntimeReady(function () {
      var flow = window.seedArenaCombat('challenge', {
        hexKey: String(key || ''),
        title: String(portal.gateType === 'celestial' ? 'Celestial Gate Breach' : 'Hellscape Gate Breach')
      });
      flow.gatePortal = flow.gatePortal || {};
      flow.gatePortal.scope = String(scope || 'province');
      flow.gatePortal.key = String(key || '');
      flow.gatePortal.type = String(portal.gateType || 'hellscape');
      flow.gatePortal.puzzleAttempts = Number(portal.puzzleAttempts || 0);
      flow.gatePortal.closed = false;
      seedGateEnemies(portal.gateType, flow);
      if (typeof renderCombatOptions === 'function') renderCombatOptions();

      openArenaPopupSafe({
        mode: 'gate',
        hexKey: String(key || ''),
        title: String(portal.gateType === 'celestial' ? 'Celestial Gate Breach' : 'Hellscape Gate Breach')
      }, 'Gate battle popup was blocked. Re-open the gate marker.');
      if (typeof renderCombatOptions === 'function') renderCombatOptions();
      if (typeof showNotif === 'function') showNotif('Gate portal opened. Defeat hostiles, then solve the seal puzzle.', 'warn');
      return true;
    }, 'Gate popup could not open. Re-open the gate marker.');
  }

  function resolveEndgameGatePuzzle() {
    var flow = S && S.combat && S.combat.arenaFlow ? S.combat.arenaFlow : null;
    if (!flow || !flow.gatePortal) return false;
    if (livingHostiles() > 0) {
      if (typeof showNotif === 'function') showNotif('Defeat all hostiles before attempting the gate seal puzzle.', 'warn');
      return false;
    }

    var state = ensureState();
    var gateType = String(flow.gatePortal.type || 'hellscape').toLowerCase();
    var raidPuzzleModes = gateType === 'hellscape'
      ? ['pipe_flow', 'chess_puzzle']
      : ['pipe_flow', 'chess_puzzle', 'sliding_tile'];
    var puzzleSeed = hashString(String(flow.gatePortal.key || '') + '|' + String(gateType) + '|' + String(flow.gatePortal.puzzleAttempts || 0));
    var selectedMode = raidPuzzleModes[puzzleSeed % raidPuzzleModes.length] || 'pipe_flow';
    var modeLabelMap = {
      pipe_flow: 'Pipe Flow Seal',
      chess_puzzle: 'Chess Relay Seal',
      sliding_tile: 'Sigil Plate Seal'
    };
    var promptByMode = {
      pipe_flow: gateType === 'celestial'
        ? 'Repair the radiant conduit: rotate pipe segments until light reaches the heaven-lock terminal.'
        : 'Repair the anti-abyss conduit: rotate pipe segments until purge flow reaches the rift core.',
      chess_puzzle: gateType === 'celestial'
        ? 'Seal lattice challenge: capture every marked sentry using legal chess movement to lock the gate.'
        : 'Hellscape lockboard challenge: capture every marked sentry using legal chess movement to collapse the rift.',
      sliding_tile: 'Shift sigil plates into proper alignment to complete the celestial lock sequence.'
    };
    var puzzleSpec = {
      mode: selectedMode,
      title: (gateType === 'celestial' ? 'Celestial Seal Conduit' : 'Hellscape Rift Conduit') + ' · ' + String(modeLabelMap[selectedMode] || 'Raid Puzzle'),
      prompt: String(promptByMode[selectedMode] || (gateType === 'celestial'
        ? 'Repair the seal conduit and route radiant flow to close Heaven\'s breach.'
        : 'Reconnect the anti-abyss conduit and route the purge flow to collapse the rift.'))
    };

    var finalize = function (result) {
      var success = result === 'success';
      if (success) {
        var closedType = normalizeGateType(gateType);
        var sideClosed = Math.max(0, Number(state.closedByType[closedType] || 0) + 1);
        state.closedByType[closedType] = sideClosed;
        state.gatesClosed = Math.max(0, Number(state.gatesClosed || 0) + 1);
        syncGateCountsToMissionDirector(closedType, sideClosed);
        closeGatePortalOnMap(flow);
        var replacement = spawnReplacementPortal(flow);
        var credits = 80;
        var renown = 1;
        S.credits = Math.max(0, Number(S.credits || 0) + credits);
        S.renown = Math.max(0, Number(S.renown || 0) + renown);
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        if (typeof updateRenown === 'function') updateRenown();
        if (typeof showNotif === 'function') {
          var nextGateText = replacement ? (' New gate detected at hex ' + String(replacement.key || '') + '.') : '';
          showNotif('Portal sealed. +' + credits + ' Credits, +' + renown + ' Renown. ' + (closedType === 'celestial' ? 'Heaven' : 'Hell') + ' seals: ' + sideClosed + '/10.' + nextGateText, 'good');
        }
        if (flow.gatePortal && typeof flow.gatePortal.onSealed === 'function') {
          try { flow.gatePortal.onSealed(); } catch (_sealErr) {}
        }
        if (sideClosed >= 10 && !state.pinnacleOpenedByType[closedType]) {
          state.pinnacleOpenedByType[closedType] = true;
          openPinnacleMegadungeonPopup(closedType);
        } else if (typeof window.renderArenaCombatPopup === 'function') {
          window.renderArenaCombatPopup();
        }
        return true;
      }

      flow.gatePortal.puzzleAttempts = Math.max(0, Number(flow.gatePortal.puzzleAttempts || 0) + 1);
      appendGateReinforcements(2, gateType, flow);
      if (typeof showNotif === 'function') showNotif('Puzzle failed: two more enemies breach the gate.', 'warn');
      if (typeof window.renderArenaCombatPopup === 'function') window.renderArenaCombatPopup();
      return false;
    };

    if (typeof window.openSharedPuzzleChallenge === 'function') {
      window.openSharedPuzzleChallenge({
        source: gateType === 'celestial' ? 'galaxy' : 'event',
        mode: puzzleSpec.mode,
        title: puzzleSpec.title,
        prompt: puzzleSpec.prompt,
        reward: { credits: 0, renown: 0, item: '' },
        onSuccess: function () { finalize('success'); },
        onFail: function () { finalize('failure'); }
      });
      return true;
    }

    // Fallback when puzzle system is unavailable.
    var actionDie = typeof getEffectiveDie === 'function' ? Math.max(4, Number(getEffectiveDie('mind') || 4)) : 4;
    var ad = typeof explodingRoll === 'function' ? explodingRoll(actionDie) : { total: 1 + Math.floor(Math.random() * actionDie) };
    var dd = typeof explodingRoll === 'function' ? explodingRoll(8) : { total: 1 + Math.floor(Math.random() * 8) };
    return finalize(Number(ad.total || 0) >= Number(dd.total || 0) ? 'success' : 'failure');
  }

  function openPinnacleMegadungeonPopup(sourceGateType) {
    var sourceType = normalizeGateType(sourceGateType);
    var boss = sourceType === 'celestial' ? 'Azrael' : 'Mephisto';
    var title = sourceType === 'celestial'
      ? 'Heaven Megadungeon - Azrael'
      : 'Hell Megadungeon - Mephisto';
    var state = ensureState();
    if (state) state.lastBoss = boss;
    return withArenaRuntimeReady(function () {
      window.seedArenaCombat('pinnacle', { hexKey: 'megadungeon', bossName: boss, title: title, sourceGateType: sourceType });
      window.openArenaCombatPopup({ mode: 'pinnacle', hexKey: 'megadungeon', title: title, sourceGateType: sourceType });
      if (typeof showNotif === 'function') showNotif('Themed Megadungeon unlocked: ' + title + '.', 'warn');
      return true;
    }, 'Pinnacle megadungeon popup could not open.');
  }

  window.getEndgamePortalMarker = function (scope, key, allKeys) {
    return getPortalMarker(scope, key, allKeys);
  };
  window.openSeaColosseumArena = openSeaColosseumArena;
  window.openEndgameGatePortal = openEndgameGatePortal;
  window.resolveEndgameGatePuzzle = resolveEndgameGatePuzzle;
  window.openPinnacleMegadungeonPopup = openPinnacleMegadungeonPopup;
})();

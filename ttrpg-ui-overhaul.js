(function () {
  var CHANNELS = [
    { id: 'ic', label: 'IC' },
    { id: 'ooc', label: 'OOC' },
    { id: 'whisper', label: 'Whisper' },
    { id: 'gm', label: 'GM' },
    { id: 'system', label: 'System' }
  ];

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeNotif(text, tone) {
    if (typeof window.showNotif === 'function') window.showNotif(text, tone || 'info');
  }

  function ensureState() {
    if (typeof window.S === 'undefined' || !window.S || typeof window.S !== 'object') return null;
    if (!window.S.identityForge || typeof window.S.identityForge !== 'object') window.S.identityForge = {};
    var i = window.S.identityForge;
    if (!i.appearance || typeof i.appearance !== 'object') i.appearance = {};
    if (!i.media || typeof i.media !== 'object') i.media = {};
    if (!i.social || typeof i.social !== 'object') i.social = {};
    if (!i.inventory || typeof i.inventory !== 'object') i.inventory = {};
    if (!i.mapTools || typeof i.mapTools !== 'object') i.mapTools = {};
    if (!Array.isArray(i.social.messages)) i.social.messages = [];
    if (typeof i.social.activeChannel !== 'string') i.social.activeChannel = 'ic';
    if (typeof i.social.open !== 'boolean') i.social.open = true;
    if (typeof i.social.whisperTarget !== 'string') i.social.whisperTarget = '';

    i.appearance.hair = i.appearance.hair || 'Ranger Sweep';
    i.appearance.skinTone = i.appearance.skinTone || '#d2ad89';
    i.appearance.eyeColor = i.appearance.eyeColor || '#66c4f8';
    i.appearance.tattoo = i.appearance.tattoo || '#4eb3f0';
    i.appearance.scar = i.appearance.scar || '#a74545';
    i.appearance.dyePrimary = i.appearance.dyePrimary || '#7b8caf';
    i.appearance.dyeSecondary = i.appearance.dyeSecondary || '#4aaea1';
    i.appearance.transmog = i.appearance.transmog || '';
    i.media.portrait = i.media.portrait || '';
    i.media.token = i.media.token || '';

    if (typeof i.inventory.dragEnabled !== 'boolean') i.inventory.dragEnabled = true;

    if (!Array.isArray(i.mapTools.pings)) i.mapTools.pings = [];
    if (!i.mapTools.statusByHex || typeof i.mapTools.statusByHex !== 'object') i.mapTools.statusByHex = {};
    if (!Array.isArray(i.mapTools.trails)) i.mapTools.trails = [];
    if (!i.mapTools.manualFogHidden || typeof i.mapTools.manualFogHidden !== 'object') i.mapTools.manualFogHidden = {};
    if (typeof i.mapTools.manualFogMode !== 'boolean') i.mapTools.manualFogMode = false;
    if (typeof i.mapTools.lastTrailKey !== 'string') i.mapTools.lastTrailKey = '';
    return i;
  }

  function readFileAsDataUrl(file, done) {
    if (!file || typeof FileReader === 'undefined') return;
    var reader = new FileReader();
    reader.onload = function () { done(String(reader.result || '')); };
    reader.readAsDataURL(file);
  }

  window.readFileAsDataUrl = readFileAsDataUrl;

  function parseSlotWeight(name) {
    var text = String(name || '').trim();
    if (!text) return 0;
    var stack = (typeof window.parseBackpackStack === 'function') ? window.parseBackpackStack(text) : { name: text, count: 1 };
    var count = Math.max(1, Number(stack.count || 1));
    var root = String(stack.name || text);
    var found = (typeof window.findShopItem === 'function') ? window.findShopItem(root) : null;
    var stat = found && found.item ? String(found.item.stat || '') : '';
    var desc = found && found.item ? String(found.item.desc || '') : '';
    var source = (stat + ' ' + desc + ' ' + root).toLowerCase();
    var sizeMatch = source.match(/size\s*(\d+)/i) || source.match(/(\d+)\s*slots?/i);
    var unit = sizeMatch ? Math.max(1, Number(sizeMatch[1] || 1)) : 1;
    return unit * count;
  }

  function getCarryCapacity() {
    if (typeof window.getBackpackCapacity === 'function') {
      return Math.max(6, Number(window.getBackpackCapacity() || 0) * 3);
    }
    var body = Number((window.S && window.S.stats && window.S.stats.body) || 4);
    return Math.max(6, body * 6);
  }

  function getTotalCarryWeight() {
    if (!window.S) return 0;
    var total = 0;
    if (Array.isArray(window.S.backpack)) {
      window.S.backpack.forEach(function (item) { total += parseSlotWeight(item); });
    }
    if (window.S.equipment && typeof window.S.equipment === 'object') {
      ['weapon1', 'weapon2', 'armor', 'readied'].forEach(function (k) { total += parseSlotWeight(window.S.equipment[k]); });
    }
    if (window.S.equipmentLayers && typeof window.S.equipmentLayers === 'object') {
      ['under', 'over', 'suit'].forEach(function (k) { total += parseSlotWeight(window.S.equipmentLayers[k]); });
    }
    return total;
  }

  function isWeaponLike(itemName) {
    var text = String(itemName || '').toLowerCase();
    var found = (typeof window.findShopItem === 'function') ? window.findShopItem(itemName) : null;
    if (found && ['weapons', 'melee_exp', 'ranged_exp'].indexOf(String(found.cat || '')) >= 0) return true;
    return /weapon|sword|axe|mace|spear|bow|rifle|pistol|gun|strike|shoot/.test(text);
  }

  function isShieldLike(itemName) {
    var text = String(itemName || '');
    var found = (typeof window.findShopItem === 'function') ? window.findShopItem(itemName) : null;
    var metadata = found && found.item
      ? [found.item.name, found.item.stat, found.item.desc].join(' ')
      : '';
    return /\bshield\b/i.test(text + ' ' + metadata);
  }

  function isArmorLike(itemName) {
    if (isShieldLike(itemName)) return false;
    var text = String(itemName || '').toLowerCase();
    var found = (typeof window.findShopItem === 'function') ? window.findShopItem(itemName) : null;
    if (found && ['armor', 'armor_exp', 'space_armor'].indexOf(String(found.cat || '')) >= 0) return true;
    return /armor|armour|cloak|mantle|suit|radsuit|vaccsuit|hydrosuit|defend/.test(text);
  }

  function getCosmeticSlotForItem(itemName) {
    var text = String(itemName || '');
    if (typeof window.getLayerSlotForItem === 'function') {
      var slot = window.getLayerSlotForItem(text);
      if (slot) return slot;
    }
    var lower = text.toLowerCase();
    if (/thermal|coolant|under/.test(lower)) return 'under';
    if (/exo|over/.test(lower)) return 'over';
    if (/suit|vacc|rad|hydro|transmog|mantle|cloak/.test(lower)) return 'suit';
    return '';
  }

  function ensureInventoryWeightHud() {
    var host = document.getElementById('inventoryWeightHud');
    if (host && host.parentElement) host.parentElement.removeChild(host);
  }

  function narrativeRangeFromDistance(distance) {
    var d = Math.max(0, Number(distance || 0));
    if (d <= 3) return 'Engaged';
    if (d <= 12) return 'Close';
    if (d <= 24) return 'Nearby';
    return 'Far';
  }

  function rangeFlavor(range) {
    if (range === 'Engaged') return 'Blades clash, breathing distance, immediate danger.';
    if (range === 'Close') return 'Short surge and strike; voices carry clearly.';
    if (range === 'Nearby') return 'Tactical repositioning space with ranged pressure.';
    return 'Long lane with dramatic movement and cover play.';
  }

  function ensureCombatHud() {
    if (!window.S || typeof window.S !== 'object') return;
    var tab = document.getElementById('tab-combat');
    if (!tab) return;
    var anchor = document.getElementById('combatCinematicHud');
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.id = 'combatCinematicHud';
      anchor.className = 'combat-cinematic-hud';
      tab.insertBefore(anchor, tab.firstChild);
    }
    if (!window.S.combat || typeof window.S.combat !== 'object') window.S.combat = {};
    if (typeof window.S.combat.cinematicDistance !== 'number') window.S.combat.cinematicDistance = 6;
    if (typeof window.S.combat.showRawDistance !== 'boolean') window.S.combat.showRawDistance = false;

    var dist = Math.max(0, Number(window.S.combat.cinematicDistance || 0));
    var range = narrativeRangeFromDistance(dist);
    window.S.combat.spacing = range;

    anchor.innerHTML = ''
      + '<div class="label">Cinematic Range Translator</div>'
      + '<div class="range-readout">' + range + (window.S.combat.showRawDistance ? (' · ' + dist + 'u') : '') + '</div>'
      + '<div class="range-help">' + esc(rangeFlavor(range)) + '</div>'
      + '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.4rem;align-items:center;margin-top:.34rem;">'
      + '<input id="cinematicDistanceInput" type="range" min="0" max="40" step="1" value="' + dist + '">'
      + '<button class="btn btn-xs" id="cinematicDistanceToggle">' + (window.S.combat.showRawDistance ? 'Hide Raw' : 'Show Raw') + '</button>'
      + '</div>';

    var slider = document.getElementById('cinematicDistanceInput');
    if (slider) {
      slider.oninput = function () {
        window.S.combat.cinematicDistance = Number(this.value || 0);
        ensureCombatHud();
      };
    }
    var toggle = document.getElementById('cinematicDistanceToggle');
    if (toggle) {
      toggle.onclick = function () {
        window.S.combat.showRawDistance = !window.S.combat.showRawDistance;
        ensureCombatHud();
      };
    }
  }

  function combatWorkshopRangeLabel(distance) {
    var d = Math.max(0, Number(distance || 0));
    if (d <= 0) return 'Engaged';
    if (d <= 1) return 'Close';
    if (d <= 2) return 'Nearby';
    return 'Far';
  }

  function ensureCombatSceneWorkshopState() {
    if (!window.S || typeof window.S !== 'object') return null;
    if (!window.S.combat || typeof window.S.combat !== 'object') window.S.combat = {};
    var combat = window.S.combat;
    if (!combat.sceneWorkshop || typeof combat.sceneWorkshop !== 'object') combat.sceneWorkshop = {};
    var ws = combat.sceneWorkshop;
    if (!Array.isArray(ws.tokens)) ws.tokens = [];
    if (!ws.features || typeof ws.features !== 'object') ws.features = {};
    if (!Array.isArray(ws.history)) ws.history = [];
    if (typeof ws.boardCols !== 'number') ws.boardCols = 7;
    if (typeof ws.boardRows !== 'number') ws.boardRows = 7;
    if (typeof ws.background !== 'string') ws.background = '';
    if (typeof ws.selectedTokenId !== 'string' && typeof ws.selectedTokenId !== 'number') ws.selectedTokenId = '';
    if (typeof ws.focusTokenId !== 'string' && typeof ws.focusTokenId !== 'number') ws.focusTokenId = '';
    if (typeof ws.paintMode !== 'string') ws.paintMode = 'move';
    if (typeof ws.autoRoll !== 'boolean') ws.autoRoll = !(window.settingsSystem && typeof window.settingsSystem.isManualRollMode === 'function' && window.settingsSystem.isManualRollMode());
    return ws;
  }

  function combatWorkshopLog(ws, message) {
    if (!ws || !message) return;
    ws.history.unshift({ stamp: Date.now(), text: String(message) });
    if (ws.history.length > 18) ws.history = ws.history.slice(0, 18);
  }

  function combatWorkshopCellKey(x, y) {
    return String(x) + ':' + String(y);
  }

  function combatWorkshopDistance(a, b) {
    if (!a || !b) return 0;
    return Math.max(Math.abs(Number(a.x || 0) - Number(b.x || 0)), Math.abs(Number(a.y || 0) - Number(b.y || 0)));
  }

  function combatWorkshopPlayerToken(ws) {
    if (!ws || !Array.isArray(ws.tokens) || !ws.tokens.length) return null;
    var playerName = String((window.S && window.S.name) || 'Wayfarer').trim() || 'Wayfarer';
    return ws.tokens.find(function (token) { return token && token.isPlayer; }) || ws.tokens.find(function (token) { return token && token.side === 'ally' && String(token.name || '') === playerName; }) || ws.tokens.find(function (token) { return token && token.side === 'ally'; }) || ws.tokens[0] || null;
  }

  function combatWorkshopFocusToken(ws) {
    if (!ws || !Array.isArray(ws.tokens) || !ws.tokens.length) return null;
    var focusId = String(ws.focusTokenId || '');
    var found = ws.tokens.find(function (token) { return token && String(token.id) === focusId; });
    if (found) return found;
    return ws.tokens.find(function (token) { return token && token.side === 'enemy'; }) || ws.tokens[0] || null;
  }

  function combatWorkshopSyncTokens(ws) {
    if (!ws || !window.S) return;
    var combatMapUnits = (window.S.combatMap && Array.isArray(window.S.combatMap.units)) ? window.S.combatMap.units : [];
    var existing = Array.isArray(ws.tokens) ? ws.tokens.slice() : [];
    var byKey = {};
    existing.forEach(function (token) {
      if (!token) return;
      if (token.sourceKey) byKey[token.sourceKey] = token;
      if (token.unitId !== undefined && token.unitId !== null) byKey['unit:' + String(token.unitId)] = token;
    });
    var next = [];
    var allyIndex = 0;
    var enemyIndex = 0;
    var playerName = String((window.S && window.S.name) || 'Wayfarer').trim() || 'Wayfarer';
    var identityPortrait = (window.S.identityForge && window.S.identityForge.media && window.S.identityForge.media.portrait) || '';
    combatMapUnits.forEach(function (unit) {
      if (!unit) return;
      var side = String(unit.side || 'enemy');
      var sourceKey = unit.trackerKey ? String(unit.trackerKey) : ('unit:' + String(unit.id));
      var token = byKey[sourceKey] || byKey['unit:' + String(unit.id)] || null;
      if (!token) {
        token = {
          id: String(unit.id || sourceKey),
          sourceKey: sourceKey,
          unitId: unit.id,
          side: side,
          name: String(unit.name || (side === 'ally' ? 'Ally' : 'Enemy')),
          x: side === 'ally' ? Math.max(2, 2 + allyIndex) : Math.max(2, 4 - enemyIndex),
          y: side === 'ally' ? 5 : 1,
          image: ''
        };
      }
      token.sourceKey = sourceKey;
      token.unitId = unit.id;
      token.side = side;
      token.name = String(unit.name || token.name || (side === 'ally' ? 'Ally' : 'Enemy'));
      if (token.x === undefined || token.y === undefined) {
        token.x = side === 'ally' ? Math.max(2, 2 + allyIndex) : Math.max(2, 4 - enemyIndex);
        token.y = side === 'ally' ? 5 : 1;
      }
      if (side === 'ally') allyIndex += 1; else enemyIndex += 1;
      if ((unit.isPlayer || token.name === playerName) && identityPortrait) token.image = token.image || identityPortrait;
      if (!token.image) token.image = side === 'ally' ? identityPortrait : '';
      next.push(token);
    });
    ws.tokens = next;
    if (!String(ws.selectedTokenId || '') && next.length) {
      var chosen = combatWorkshopPlayerToken(ws) || next[0];
      ws.selectedTokenId = chosen ? String(chosen.id) : '';
    }
    if (!String(ws.focusTokenId || '') && next.some(function (token) { return token && token.side === 'enemy'; })) {
      var enemy = next.find(function (token) { return token && token.side === 'enemy'; });
      ws.focusTokenId = enemy ? String(enemy.id) : '';
    }
    var player = combatWorkshopPlayerToken(ws);
    if (player) {
      ws.tokens.forEach(function (token) {
        if (!token) return;
        token.rangeFromPlayer = combatWorkshopRangeLabel(combatWorkshopDistance(player, token));
      });
    }
  }

  function combatWorkshopSetSelectedToken(tokenId) {
    var ws = ensureCombatSceneWorkshopState();
    if (!ws) return;
    ws.selectedTokenId = String(tokenId || '');
    renderCombatSceneWorkshop();
  }

  function combatWorkshopSetFocusToken(tokenId) {
    var ws = ensureCombatSceneWorkshopState();
    if (!ws) return;
    ws.focusTokenId = String(tokenId || '');
    renderCombatSceneWorkshop();
  }

  function combatWorkshopSetMode(mode) {
    var ws = ensureCombatSceneWorkshopState();
    if (!ws) return;
    ws.paintMode = String(mode || 'move');
    renderCombatSceneWorkshop();
  }

  function combatWorkshopToggleManualMode(forceManual) {
    if (!window.settingsSystem || typeof window.settingsSystem.toggleManualRollMode !== 'function') return;
    var current = !!(typeof window.settingsSystem.isManualRollMode === 'function' && window.settingsSystem.isManualRollMode());
    if (typeof forceManual === 'boolean' && current === forceManual) return;
    window.settingsSystem.toggleManualRollMode();
    renderCombatSceneWorkshop();
  }

  function combatWorkshopSetBoardBackground(dataUrl) {
    var ws = ensureCombatSceneWorkshopState();
    if (!ws) return;
    ws.background = String(dataUrl || '');
    combatWorkshopLog(ws, 'Board backdrop updated.');
    renderCombatSceneWorkshop();
  }

  function combatWorkshopTokenImageInput(tokenId) {
    var input = document.getElementById('combatWorkshopTokenImageInput');
    if (!input) return;
    input.setAttribute('data-token-id', String(tokenId || ''));
    input.click();
  }

  function combatWorkshopBoardImageInput() {
    var input = document.getElementById('combatWorkshopBoardImageInput');
    if (input) input.click();
  }

  function combatWorkshopMoveToken(tokenId, x, y, reason) {
    var ws = ensureCombatSceneWorkshopState();
    if (!ws || !Array.isArray(ws.tokens)) return;
    var token = ws.tokens.find(function (row) { return row && String(row.id) === String(tokenId); });
    if (!token) return;
    token.x = Math.max(0, Math.min(Number(ws.boardCols || 7) - 1, Number(x || 0)));
    token.y = Math.max(0, Math.min(Number(ws.boardRows || 7) - 1, Number(y || 0)));
    var player = combatWorkshopPlayerToken(ws);
    if (player) {
      ws.tokens.forEach(function (row) {
        if (!row) return;
        row.rangeFromPlayer = combatWorkshopRangeLabel(combatWorkshopDistance(player, row));
      });
    }
    combatWorkshopLog(ws, String(token.name || 'Token') + ' moved to ' + token.x + ',' + token.y + (reason ? (' (' + reason + ')') : '') + '.');
    renderCombatSceneWorkshop();
    if (typeof window.updateCombatUI === 'function') window.updateCombatUI();
  }

  function combatWorkshopApplyFeature(x, y) {
    var ws = ensureCombatSceneWorkshopState();
    if (!ws) return;
    var key = combatWorkshopCellKey(x, y);
    if (ws.paintMode === 'clear') {
      if (ws.features[key]) {
        delete ws.features[key];
        combatWorkshopLog(ws, 'Cleared feature at ' + key + '.');
      }
      renderCombatSceneWorkshop();
      return;
    }
    if (ws.paintMode === 'barrier') {
      ws.features[key] = { kind: 'barrier', label: 'Barrier' };
      combatWorkshopLog(ws, 'Barrier placed at ' + key + '.');
      renderCombatSceneWorkshop();
      return;
    }
    if (ws.paintMode === 'button') {
      ws.features[key] = { kind: 'interaction', label: 'Interact' };
      combatWorkshopLog(ws, 'Interactable placed at ' + key + '.');
      renderCombatSceneWorkshop();
      return;
    }
    var selected = ws.tokens.find(function (row) { return row && String(row.id) === String(ws.selectedTokenId || ''); });
    if (selected) combatWorkshopMoveToken(selected.id, x, y, 'placed');
  }

  function combatWorkshopInteractCell(x, y) {
    var ws = ensureCombatSceneWorkshopState();
    if (!ws) return;
    var key = combatWorkshopCellKey(x, y);
    var feature = ws.features[key];
    if (!feature || feature.kind !== 'interaction') return;
    var token = ws.tokens.find(function (row) { return row && String(row.id) === String(ws.selectedTokenId || ''); });
    if (!token || Number(token.x) !== Number(x) || Number(token.y) !== Number(y)) {
      combatWorkshopLog(ws, 'Move a token onto ' + key + ' to interact.');
      renderCombatSceneWorkshop();
      return;
    }
    var combat = window.S.combat || {};
    if (Number(combat.actionsLeft || 0) > 0) {
      combat.actionsLeft = Math.max(0, Number(combat.actionsLeft || 0) - 1);
      combatWorkshopLog(ws, String(token.name || 'Token') + ' interacts at ' + key + ' and spends 1 Action.');
      if (typeof window.updateCombatUI === 'function') window.updateCombatUI();
    } else {
      combatWorkshopLog(ws, String(token.name || 'Token') + ' interacts at ' + key + '.');
    }
    renderCombatSceneWorkshop();
  }

  function combatWorkshopAddToken(side) {
    var label = side === 'ally' ? 'Ally' : 'Enemy';
    var count = (window.S.enemies || []).filter(function (row) { return row && !!row.ally === (side === 'ally'); }).length;
    var name = label + ' ' + (count + 1);
    if (typeof window.addTrackedCombatantFromMap === 'function') {
      window.addTrackedCombatantFromMap(side, name, side === 'ally' ? 'Close' : 'Nearby');
      combatWorkshopLog(ensureCombatSceneWorkshopState(), name + ' added to scene.');
      renderCombatSceneWorkshop();
      return;
    }
    var ws = ensureCombatSceneWorkshopState();
    if (!ws) return;
    var id = String(Date.now() + Math.floor(Math.random() * 100000));
    ws.tokens.push({ id: id, sourceKey: 'scene:' + id, unitId: id, side: side, name: name, x: side === 'ally' ? 3 : 3, y: side === 'ally' ? 5 : 1, image: '' });
    if (side === 'ally') ws.selectedTokenId = id;
    combatWorkshopLog(ws, name + ' added to scene.');
    renderCombatSceneWorkshop();
  }

  function renderCombatSceneWorkshop() {
    if (!window.S || typeof window.S !== 'object') return;
    var host = document.getElementById('combatSceneWorkshop');
    if (!host) return;
    var ws = ensureCombatSceneWorkshopState();
    if (!ws) return;
    combatWorkshopSyncTokens(ws);
    var cols = Math.max(4, Number(ws.boardCols || 7));
    var rows = Math.max(4, Number(ws.boardRows || 7));
    var boardBg = ws.background ? ('background-image:url(' + esc(ws.background) + ');') : 'background:radial-gradient(circle at top, rgba(46,196,182,.12), rgba(8,12,22,.98));';
    var manualMode = !!(window.settingsSystem && typeof window.settingsSystem.isManualRollMode === 'function' && window.settingsSystem.isManualRollMode());
    var playerToken = combatWorkshopPlayerToken(ws);
    var focusToken = combatWorkshopFocusToken(ws);
    var rangeDistance = playerToken && focusToken ? combatWorkshopDistance(playerToken, focusToken) : 0;
    var rangeLabel = combatWorkshopRangeLabel(rangeDistance);
    var tokensByCell = {};
    ws.tokens.forEach(function (token) {
      if (!token) return;
      tokensByCell[combatWorkshopCellKey(token.x, token.y)] = token;
    });
    var cellsHtml = '';
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var key = combatWorkshopCellKey(x, y);
        var feature = ws.features[key] || null;
        var token = tokensByCell[key] || null;
        var cellStyle = 'position:relative;border:1px solid rgba(255,255,255,.08);border-radius:12px;clip-path:polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%);background:rgba(255,255,255,.02);box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);';
        if (feature && feature.kind === 'barrier') cellStyle += 'background:rgba(201,64,64,.16);border-color:rgba(201,64,64,.5);';
        if (feature && feature.kind === 'interaction') cellStyle += 'background:rgba(46,196,182,.12);border-color:rgba(46,196,182,.5);';
        cellsHtml += '<button type="button" class="combat-scene-cell" data-x="' + x + '" data-y="' + y + '" style="' + cellStyle + '" onclick="combatWorkshopApplyFeature(' + x + ',' + y + ')" ondragover="event.preventDefault()" ondrop="combatWorkshopDropToken(event,' + x + ',' + y + ')">'
          + '<span style="position:absolute;inset:.22rem .28rem auto auto;font-size:.58rem;color:var(--muted2);font-family:Cinzel,serif;letter-spacing:.08em;">' + x + ',' + y + '</span>'
          + (feature ? '<span style="position:absolute;left:.28rem;bottom:.22rem;font-size:.65rem;color:' + (feature.kind === 'barrier' ? 'var(--red2)' : 'var(--teal)') + ';font-family:Cinzel,serif;letter-spacing:.08em;text-transform:uppercase;">' + esc(feature.label || feature.kind) + '</span>' : '')
          + (feature && feature.kind === 'interaction' && token && Number(token.x) === x && Number(token.y) === y ? '<button type="button" class="btn btn-xs btn-teal" style="position:absolute;right:.18rem;bottom:.15rem;z-index:3;" onclick="event.stopPropagation();combatWorkshopInteractCell(' + x + ',' + y + ')">Interact</button>' : '')
          + '</button>';
      }
    }
    var tokenHtml = ws.tokens.map(function (token) {
      if (!token) return '';
      var sel = String(ws.selectedTokenId || '') === String(token.id) ? 'outline:2px solid var(--gold2);box-shadow:0 0 0 3px rgba(255,196,88,.22);' : '';
      var focus = String(ws.focusTokenId || '') === String(token.id) ? 'filter:drop-shadow(0 0 10px rgba(46,196,182,.5));' : '';
      var px = (Number(token.x || 0) / Math.max(1, cols - 1)) * 100;
      var py = (Number(token.y || 0) / Math.max(1, rows - 1)) * 100;
      var src = token.image || (token.side === 'ally' && window.S.identityForge && window.S.identityForge.media && window.S.identityForge.media.portrait) || '';
      var portrait = src ? '<img src="' + esc(src) + '" alt="' + esc(token.name || 'Token') + '" style="width:100%;height:100%;object-fit:cover;display:block;">' : '<div style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.03));font-family:Cinzel,serif;color:var(--text2);font-size:.68rem;">' + esc((token.name || 'T').slice(0, 2).toUpperCase()) + '</div>';
      return '<div draggable="true" ondragstart="combatWorkshopStartDragToken(event,\'' + esc(String(token.id)) + '\')" onclick="combatWorkshopSelectToken(\'' + esc(String(token.id)) + '\')" style="position:absolute;left:' + px + '%;top:' + py + '%;transform:translate(-50%,-50%);width:76px;z-index:4;cursor:grab;' + sel + focus + '">'
        + '<div style="position:relative;border:1px solid ' + (token.side === 'ally' ? 'rgba(46,196,182,.55)' : 'rgba(201,64,64,.6)') + ';border-radius:18px;overflow:hidden;background:rgba(6,10,18,.9);">'
        + '<div style="width:100%;aspect-ratio:1;">' + portrait + '</div>'
        + '<div style="position:absolute;left:0;right:0;bottom:0;padding:.14rem .2rem;background:linear-gradient(180deg,transparent,rgba(0,0,0,.82));font-size:.62rem;color:#fff;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(token.name || 'Token') + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    var tokenOptions = ws.tokens.map(function (token) {
      return '<option value="' + esc(String(token.id)) + '"' + (String(ws.selectedTokenId || '') === String(token.id) ? ' selected' : '') + '>' + esc(token.name || 'Token') + '</option>';
    }).join('');
    var focusOptions = ws.tokens.map(function (token) {
      return '<option value="' + esc(String(token.id)) + '"' + (String(ws.focusTokenId || '') === String(token.id) ? ' selected' : '') + '>' + esc(token.name || 'Token') + '</option>';
    }).join('');
    var turnOrder = Array.isArray(window.S.combat && window.S.combat.turnOrder) && window.S.combat.turnOrder.length ? window.S.combat.turnOrder.slice() : ws.tokens.map(function (token) { return token.name || 'Token'; });
    var turnIndex = Math.max(0, Math.min(Number(window.S.combat && window.S.combat.currentActorIndex || 0), Math.max(0, turnOrder.length - 1)));
    var historyHtml = ws.history.length ? ws.history.map(function (entry) {
      return '<div style="padding:.28rem .32rem;border-bottom:1px solid rgba(255,255,255,.05);font-size:.72rem;line-height:1.35;color:var(--text2);">' + esc(entry.text || '') + '</div>';
    }).join('') : '<div style="font-size:.74rem;color:var(--muted2);">No scene history yet.</div>';
    var featureModeLabel = ws.paintMode === 'barrier' ? 'Barrier' : ws.paintMode === 'button' ? 'Interactable' : ws.paintMode === 'clear' ? 'Clear' : 'Move';
    var bestiaryHtml = (window.S.enemies || []).filter(function (enemy) { return enemy && !enemy.ally; }).map(function (enemy) {
      var rel = ws.tokens.find(function (token) { return token && token.side === 'enemy' && String(token.name || '') === String(enemy.name || ''); }) || null;
      return '<div style="display:flex;gap:.38rem;align-items:center;padding:.28rem 0;border-bottom:1px solid rgba(255,255,255,.05);">'
        + '<div style="width:34px;height:34px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);">' + ((rel && rel.image) ? '<img src="' + esc(rel.image) + '" alt="' + esc(enemy.name || 'Enemy') + '" style="width:100%;height:100%;object-fit:cover;">' : '<div style="width:100%;height:100%;display:grid;place-items:center;color:var(--muted2);font-size:.65rem;">☠</div>') + '</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:.74rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(enemy.name || 'Enemy') + '</div>'
        + '<div style="font-size:.66rem;color:var(--muted2);">Dread d' + esc(String(enemy.dread || (window.S.combat && window.S.combat.enemyDread) || 8)) + ' · ' + esc(String((rel && rel.rangeFromPlayer) || 'Far')) + '</div>'
        + '</div>'
        + '<button class="btn btn-xs" onclick="combatWorkshopSelectToken(\'' + esc(String(rel ? rel.id : '')) + '\');combatWorkshopSetFocusToken(\'' + esc(String(rel ? rel.id : '')) + '\')">Focus</button>'
        + '</div>';
    }).join('') || '<div style="font-size:.74rem;color:var(--muted2);">No hostiles are currently tracked.</div>';

    host.innerHTML = ''
      + '<div class="card" style="margin:0;">'
      + '<div style="display:grid;grid-template-columns:minmax(0,1.55fr) minmax(290px,.95fr);gap:.75rem;align-items:start;">'
      + '<div style="min-width:0;">'
      + '<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.45rem;">'
      + '<div>'
      + '<div class="section-title" style="margin:0;">Combat Scene Editor</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);">Drag tokens, upload scene art, paint barriers, and place interactables on the combat board.</div>'
      + '</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;align-items:center;">'
      + '<button class="btn btn-xs btn-teal" onclick="combatWorkshopAddToken(\'ally\')">+ Ally Token</button>'
      + '<button class="btn btn-xs btn-red" onclick="combatWorkshopAddToken(\'enemy\')">+ Monster Token</button>'
      + '<button class="btn btn-xs" onclick="combatWorkshopBoardImageInput()">Upload Board Art</button>'
      + '<input id="combatWorkshopBoardImageInput" type="file" accept="image/*" style="display:none;" onchange="var file=this.files&&this.files[0];if(file&&typeof readFileAsDataUrl===\'function\'){readFileAsDataUrl(file,function(url){combatWorkshopSetBoardBackground(url);});this.value=\'\';}">'
      + '<input id="combatWorkshopTokenImageInput" type="file" accept="image/*" style="display:none;" onchange="var file=this.files&&this.files[0];var tokenId=this.getAttribute(\'data-token-id\');if(file&&typeof readFileAsDataUrl===\'function\'){readFileAsDataUrl(file,function(url){var ws=ensureCombatSceneWorkshopState();if(!ws)return;var token=ws&&ws.tokens.find(function(row){return row&&String(row.id)===String(tokenId);});if(token){token.image=url;combatWorkshopLog(ws,token.name+\' image updated.\');renderCombatSceneWorkshop();}});}this.value=\'\';">'
      + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.45rem;">'
      + '<button class="btn btn-xs' + (ws.paintMode === 'move' ? ' btn-teal' : '') + '" onclick="combatWorkshopSetMode(\'move\')">Move</button>'
      + '<button class="btn btn-xs' + (ws.paintMode === 'barrier' ? ' btn-teal' : '') + '" onclick="combatWorkshopSetMode(\'barrier\')">Barrier</button>'
      + '<button class="btn btn-xs' + (ws.paintMode === 'button' ? ' btn-teal' : '') + '" onclick="combatWorkshopSetMode(\'button\')">Interactable</button>'
      + '<button class="btn btn-xs' + (ws.paintMode === 'clear' ? ' btn-teal' : '') + '" onclick="combatWorkshopSetMode(\'clear\')">Clear Feature</button>'
      + '<button class="btn btn-xs" onclick="combatWorkshopToggleManualMode(true)">Manual Rolls</button>'
      + '<button class="btn btn-xs" onclick="combatWorkshopToggleManualMode(false)">Auto Rolls</button>'
      + '</div>'
      + '<div style="position:relative;min-height:560px;border:1px solid var(--border2);border-radius:14px;overflow:hidden;' + boardBg + 'background-size:cover;background-position:center;">'
      + '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.28));pointer-events:none;"></div>'
      + '<div style="position:absolute;inset:0;padding:12px;display:grid;grid-template-columns:repeat(' + cols + ', minmax(0,1fr));grid-template-rows:repeat(' + rows + ', minmax(0,1fr));gap:6px;">' + cellsHtml + '</div>'
      + '<div style="position:absolute;inset:0;pointer-events:none;">' + tokenHtml + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.35rem;margin-top:.45rem;">'
      + '<label style="font-size:.68rem;color:var(--muted2);">Selected Token<select id="combatWorkshopSelectedTokenSel" onchange="combatWorkshopSetSelectedToken(this.value)" style="width:100%;margin-top:.12rem;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .35rem;font-size:.76rem;">' + tokenOptions + '</select></label>'
      + '<label style="font-size:.68rem;color:var(--muted2);">Focus Token<select id="combatWorkshopFocusTokenSel" onchange="combatWorkshopSetFocusToken(this.value)" style="width:100%;margin-top:.12rem;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .35rem;font-size:.76rem;">' + focusOptions + '</select></label>'
      + '</div>'
      + '<div style="margin-top:.45rem;padding:.35rem .45rem;border:1px solid rgba(46,196,182,.35);background:rgba(46,196,182,.06);border-radius:10px;font-size:.74rem;color:var(--text2);line-height:1.45;">'
      + '<strong style="color:var(--gold2);">Cinematic Range Translator:</strong> ' + esc(String((playerToken && playerToken.name) || 'Your token')) + ' to ' + esc(String((focusToken && focusToken.name) || 'target')) + ' is <strong style="color:var(--teal);">' + esc(rangeLabel) + '</strong> (' + rangeDistance + ' cells).'
      + '</div>'
      + '</div>'
      + '<div style="min-width:0;display:grid;gap:.55rem;">'
      + '<div style="padding:.5rem .55rem;border:1px solid var(--border2);border-radius:12px;background:rgba(255,255,255,.02);">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:.35rem;margin-bottom:.25rem;">'
      + '<div style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;">Actions</div>'
      + '<span style="font-size:.68rem;color:var(--muted2);">Mode: ' + (manualMode ? 'Manual' : 'Auto') + ' / Scene: ' + featureModeLabel + '</span>'
      + '</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.35rem;">'
      + '<button class="btn btn-xs" onclick="if(window.settingsSystem&&typeof window.settingsSystem.toggleManualRollMode===\'function\')window.settingsSystem.toggleManualRollMode();renderCombatSceneWorkshop();">Toggle Roll Mode</button>'
      + '<button class="btn btn-xs" onclick="combatWorkshopSetMode(\'move\')">Move Token</button>'
      + '<button class="btn btn-xs" onclick="combatWorkshopSetMode(\'barrier\')">Paint Barrier</button>'
      + '<button class="btn btn-xs" onclick="combatWorkshopSetMode(\'button\')">Paint Button</button>'
      + '<button class="btn btn-xs" onclick="combatWorkshopSetMode(\'clear\')">Clear Tile</button>'
      + '</div>'
      + '<div style="font-size:.7rem;color:var(--muted2);margin-bottom:.3rem;">Selected: <strong style="color:var(--gold2);">' + esc(String((ws.tokens.find(function (token) { return token && String(token.id) === String(ws.selectedTokenId || ''); }) || {}).name || 'None')) + '</strong> · Focus: <strong style="color:var(--teal);">' + esc(String((focusToken && focusToken.name) || 'None')) + '</strong></div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.35rem;">'
      + '<button class="btn btn-xs btn-teal" onclick="if(window.S.identityForge&&window.S.identityForge.media&&window.S.identityForge.media.portrait){var ws=ensureCombatSceneWorkshopState();var token=ws&&ws.tokens.find(function(row){return row&&row.isPlayer;});if(token){token.image=window.S.identityForge.media.portrait;combatWorkshopLog(ws,\'Player token synced from identity portrait.\');renderCombatSceneWorkshop();}}">Sync Avatar</button>'
      + '<button class="btn btn-xs" onclick="var ws=ensureCombatSceneWorkshopState();if(ws){ws.features={};combatWorkshopLog(ws,\'Cleared all board features.\');renderCombatSceneWorkshop();}">Clear Features</button>'
      + '<button class="btn btn-xs" onclick="var ws=ensureCombatSceneWorkshopState();if(ws){ws.history=[];renderCombatSceneWorkshop();}">Clear History</button>'
      + '</div>'
      + '</div>'
      + '<div style="padding:.5rem .55rem;border:1px solid var(--border2);border-radius:12px;background:rgba(255,255,255,.02);">'
      + '<div style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">Turn Order</div>'
      + '<div style="display:grid;gap:.18rem;">' + (Array.isArray(turnOrder) && turnOrder.length ? turnOrder.map(function (entry, idx) {
        var active = idx === turnIndex ? 'border-color:rgba(255,196,88,.55);background:rgba(255,196,88,.08);' : '';
        return '<div style="padding:.24rem .3rem;border:1px solid rgba(255,255,255,.06);border-radius:8px;font-size:.72rem;color:var(--text2);' + active + '">' + esc(String(entry || 'Turn ' + (idx + 1))) + '</div>';
      }).join('') : '<div style="font-size:.74rem;color:var(--muted2);">No initiative order yet.</div>') + '</div>'
      + '</div>'
      + '<div style="padding:.5rem .55rem;border:1px solid var(--border2);border-radius:12px;background:rgba(255,255,255,.02);">'
      + '<div style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">Bestiary / Hostiles</div>'
      + '<div style="max-height:220px;overflow:auto;">' + bestiaryHtml + '</div>'
      + '</div>'
      + '<div style="padding:.5rem .55rem;border:1px solid var(--border2);border-radius:12px;background:rgba(255,255,255,.02);">'
      + '<div style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">History</div>'
      + '<div style="max-height:220px;overflow:auto;">' + historyHtml + '</div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '</div>';

    var selectedSel = document.getElementById('combatWorkshopSelectedTokenSel');
    if (selectedSel) selectedSel.value = String(ws.selectedTokenId || '');
    var focusSel = document.getElementById('combatWorkshopFocusTokenSel');
    if (focusSel) focusSel.value = String(ws.focusTokenId || '');
  }

  function combatWorkshopStartDragToken(ev, tokenId) {
    if (!ev || !ev.dataTransfer) return;
    ev.dataTransfer.setData('text/plain', String(tokenId || ''));
    ev.dataTransfer.effectAllowed = 'move';
  }

  function combatWorkshopDropToken(ev, x, y) {
    if (!ev || !ev.dataTransfer) return;
    ev.preventDefault();
    var tokenId = String(ev.dataTransfer.getData('text/plain') || '');
    if (tokenId) {
      combatWorkshopMoveToken(tokenId, x, y, 'dragged');
      return;
    }
    combatWorkshopApplyFeature(x, y);
  }

  window.renderCombatSceneWorkshop = renderCombatSceneWorkshop;
  window.combatWorkshopMoveToken = combatWorkshopMoveToken;
  window.combatWorkshopApplyFeature = combatWorkshopApplyFeature;
  window.combatWorkshopInteractCell = combatWorkshopInteractCell;
  window.combatWorkshopAddToken = combatWorkshopAddToken;
  window.combatWorkshopSetMode = combatWorkshopSetMode;
  window.combatWorkshopSetSelectedToken = combatWorkshopSetSelectedToken;
  window.combatWorkshopSetFocusToken = combatWorkshopSetFocusToken;
  window.combatWorkshopDropToken = combatWorkshopDropToken;
  window.combatWorkshopStartDragToken = combatWorkshopStartDragToken;
  window.combatWorkshopBoardImageInput = combatWorkshopBoardImageInput;
  window.combatWorkshopTokenImageInput = combatWorkshopTokenImageInput;
  window.combatWorkshopToggleManualMode = combatWorkshopToggleManualMode;
  window.combatWorkshopSetBoardBackground = combatWorkshopSetBoardBackground;
  window.ensureCombatSceneWorkshopState = ensureCombatSceneWorkshopState;
  window.combatWorkshopLog = combatWorkshopLog;

  function getWhisperCandidates() {
    if (!window.campaignSystem || typeof window.campaignSystem.getState !== 'function') return [];
    var cs = window.campaignSystem.getState();
    if (!cs || !cs.campaign || !Array.isArray(cs.campaign.roster)) return [];
    var me = String(cs.token || '');
    return cs.campaign.roster.filter(function (row) {
      return row && row.token && String(row.token) !== me;
    }).map(function (row) {
      return { token: String(row.token), name: String(row.name || 'Wayfarer') };
    });
  }

  function sendRoleplayMessage() {
    var forge = ensureState();
    if (!forge) return;
    var input = document.getElementById('roleplayDockInput');
    if (!input) return;
    var txt = String(input.value || '').trim();
    if (!txt) return;
    var active = forge.social.activeChannel || 'ic';
    var author = String((window.S && window.S.name) || 'Wayfarer').trim() || 'Wayfarer';
    var payload = {
      channel: active,
      author: author,
      text: txt,
      stamp: Date.now(),
      targetToken: active === 'whisper' ? String(forge.social.whisperTarget || '') : ''
    };

    if (active === 'whisper' && !payload.targetToken) {
      safeNotif('Choose a whisper target first.', 'warn');
      return;
    }

    forge.social.messages.push(payload);
    if (forge.social.messages.length > 80) forge.social.messages = forge.social.messages.slice(-80);

    if (window.campaignSystem && typeof window.campaignSystem.sendChatMessage === 'function') {
      window.campaignSystem.sendChatMessage({
        message: txt,
        channel: active,
        targetToken: payload.targetToken
      });
    }

    safeNotif('Sent ' + active.toUpperCase() + ' message.', 'good');
    input.value = '';
    renderRoleplayDock();
  }

  function renderRoleplayDock() {
    var forge = ensureState();
    if (!forge) return;
    var node = document.getElementById('roleplayDock');
    if (!node) {
      node = document.createElement('section');
      node.id = 'roleplayDock';
      node.className = 'roleplay-dock';
      document.body.appendChild(node);
    }

    var active = forge.social.activeChannel || 'ic';
    var open = forge.social.open !== false;
    var whispers = getWhisperCandidates();
    if (active === 'whisper' && !forge.social.whisperTarget && whispers.length) forge.social.whisperTarget = whispers[0].token;

    var visibleMessages = forge.social.messages.filter(function (m) {
      if (active === 'system') return true;
      if (String(m.channel || '') !== active) return false;
      if (active !== 'whisper') return true;
      var me = String(window.campaignSystem && window.campaignSystem.getState ? (window.campaignSystem.getState().token || '') : '');
      var target = String(m.targetToken || '');
      return !target || target === forge.social.whisperTarget || m.author === (window.S && window.S.name) || target === me;
    });

    node.innerHTML = ''
      + '<div class="rd-head">'
      + '<div class="rd-title">Roleplay Comms</div>'
      + '<button class="btn btn-xs" id="roleplayDockToggleBtn">' + (open ? 'Minimize' : 'Open') + '</button>'
      + '</div>'
      + (open ? ('<div class="rd-channels">' + CHANNELS.map(function (c) {
        var on = c.id === active;
        return '<button class="rd-chip ' + (on ? 'on' : '') + '" data-channel="' + c.id + '">' + esc(c.label) + '</button>';
      }).join('') + '</div>') : '')
      + (open && active === 'whisper' ? ('<div class="rd-send" style="grid-template-columns:minmax(0,1fr);border-top:none;padding-top:0;">'
        + '<select id="roleplayWhisperTarget" class="campaign-dock-input">'
        + whispers.map(function (w) {
          var on = String(w.token) === String(forge.social.whisperTarget || '');
          return '<option value="' + esc(w.token) + '" ' + (on ? 'selected' : '') + '>To: ' + esc(w.name) + '</option>';
        }).join('')
        + '</select>'
        + '</div>') : '')
      + (open ? ('<div class="rd-log">' + (visibleMessages.length ? visibleMessages.slice(-16).map(function (m) {
        var stamp = new Date(Number(m.stamp || Date.now())).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var whisperBit = (m.channel === 'whisper' && m.targetToken) ? (' -> ' + esc(m.targetToken.slice(-4))) : '';
        return '<div class="rd-line">'
          + '<div class="rd-meta">' + esc(String(m.channel || '').toUpperCase()) + whisperBit + ' · ' + esc(m.author || 'Wayfarer') + ' · ' + esc(stamp) + '</div>'
          + '<div>' + esc(m.text || '') + '</div>'
          + '</div>';
      }).join('') : '<div class="rd-line"><div class="rd-meta">No messages yet</div><div>Start with an in-character opener or tactical whisper.</div></div>') + '</div>') : '')
      + (open ? '<div class="rd-send"><input id="roleplayDockInput" type="text" maxlength="260" placeholder="Speak into the scene..."><button class="btn btn-xs btn-teal" id="roleplayDockSendBtn">Send</button></div>' : '');

    var toggleBtn = document.getElementById('roleplayDockToggleBtn');
    if (toggleBtn) {
      toggleBtn.onclick = function () {
        forge.social.open = !forge.social.open;
        renderRoleplayDock();
      };
    }

    var chips = node.querySelectorAll('[data-channel]');
    chips.forEach(function (chip) {
      chip.onclick = function () {
        forge.social.activeChannel = String(chip.getAttribute('data-channel') || 'ic');
        renderRoleplayDock();
      };
    });

    var targetSel = document.getElementById('roleplayWhisperTarget');
    if (targetSel) {
      targetSel.onchange = function () {
        forge.social.whisperTarget = String(targetSel.value || '');
      };
    }

    var sendBtn = document.getElementById('roleplayDockSendBtn');
    if (sendBtn) sendBtn.onclick = sendRoleplayMessage;
    var input = document.getElementById('roleplayDockInput');
    if (input) {
      input.onkeydown = function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          sendRoleplayMessage();
        }
      };
    }
  }

  function layerLabel(value, fallback) {
    var text = String(value || '').trim();
    return text || fallback;
  }

  function renderIdentityForge() {
    return false;
  }

  function currentDropPayload() {
    try {
      return JSON.parse(String(window.__coDragPayload || '{}'));
    } catch (_err) {
      return null;
    }
  }

  function setDropPayload(payload) {
    window.__coDragPayload = JSON.stringify(payload || {});
  }

  function clearDropPayload() {
    window.__coDragPayload = '';
  }

  function readSourceValue(source) {
    if (!window.S || !source || typeof source !== 'object') return '';
    if (source.kind === 'backpack') {
      return (Array.isArray(window.S.backpack) && window.S.backpack[source.index]) ? String(window.S.backpack[source.index]) : '';
    }
    if (source.kind === 'equip') {
      if (source.slot === 'under' || source.slot === 'over' || source.slot === 'suit') return String((window.S.equipmentLayers && window.S.equipmentLayers[source.slot]) || '');
      return String((window.S.equipment && window.S.equipment[source.slot]) || '');
    }
    return '';
  }

  function writeTargetValue(target, value) {
    if (!window.S || !target || typeof target !== 'object') return;
    if (target.kind === 'backpack') {
      if (!Array.isArray(window.S.backpack)) window.S.backpack = [];
      window.S.backpack[target.index] = String(value || '');
      return;
    }
    if (target.kind === 'equip') {
      if (target.slot === 'under' || target.slot === 'over' || target.slot === 'suit') {
        if (!window.S.equipmentLayers || typeof window.S.equipmentLayers !== 'object') window.S.equipmentLayers = { under: '', over: '', suit: '' };
        window.S.equipmentLayers[target.slot] = String(value || '');
        return;
      }
      if (!window.S.equipment || typeof window.S.equipment !== 'object') window.S.equipment = { weapon1: '', weapon2: '', armor: '', readied: '' };
      window.S.equipment[target.slot] = String(value || '');
    }
  }

  function parseTarget(raw) {
    var parts = String(raw || '').split(':');
    if (parts[0] === 'bp') return { kind: 'backpack', index: Number(parts[1] || 0) };
    if (parts[0] === 'equip') return { kind: 'equip', slot: String(parts[1] || '') };
    return null;
  }

  function canDropToTarget(itemText, target) {
    var raw = String(itemText || '').trim();
    if (!raw || !target) return false;
    if (target.kind === 'backpack') return true;
    if (target.kind !== 'equip') return false;
    var slot = target.slot;
    if (slot === 'weapon1') return isWeaponLike(raw) && !isShieldLike(raw);
    if (slot === 'weapon2') return isWeaponLike(raw) || isShieldLike(raw);
    if (slot === 'armor') return isArmorLike(raw);
    if (slot === 'under' || slot === 'over' || slot === 'suit') {
      return getCosmeticSlotForItem(raw) === slot;
    }
    return true;
  }

  function executeDrop(target, source) {
    var src = source || {};
    var tgt = target || {};
    var val = readSourceValue(src);
    if (!val) return;
    if (!canDropToTarget(val, tgt)) {
      safeNotif('Slot constraint blocks this item.', 'warn');
      return;
    }

    var sourceVal = val;
    var targetVal = readSourceValue(tgt);
    writeTargetValue(tgt, sourceVal);
    writeTargetValue(src, targetVal || '');

    if (getTotalCarryWeight() > getCarryCapacity()) {
      writeTargetValue(src, sourceVal);
      writeTargetValue(tgt, targetVal || '');
      safeNotif('Over capacity. Adjust load before moving this item.', 'warn');
      return;
    }

    if (typeof window.renderBackpackUI === 'function') window.renderBackpackUI();
    if (typeof window.renderWeaponModsPanel === 'function') window.renderWeaponModsPanel();
    if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
    if (typeof window.refreshArmorSlotMeta === 'function') window.refreshArmorSlotMeta();
    renderIdentityForge();
    ensureInventoryWeightHud();
    safeNotif('Item moved.', 'good');
  }

  function decorateInventoryDnd() {
    if (!window.S || !window.S.backpack) return;
    ensureInventoryWeightHud();

    var bpInputs = document.querySelectorAll('#backpackGrid .bp-input');
    bpInputs.forEach(function (input, idx) {
      var value = String(input.value || '').trim();
      input.setAttribute('data-drop-target', 'bp:' + idx);
      input.classList.add('co-drop-target');
      input.draggable = !!value;
      input.ondragstart = value ? function (ev) {
        var payload = { kind: 'backpack', index: idx };
        setDropPayload(payload);
        ev.dataTransfer.setData('text/plain', 'bp:' + idx);
      } : null;
      input.ondragover = function (ev) { ev.preventDefault(); input.classList.add('co-drop-over'); };
      input.ondragleave = function () { input.classList.remove('co-drop-over'); };
      input.ondrop = function (ev) {
        ev.preventDefault();
        input.classList.remove('co-drop-over');
        var source = currentDropPayload();
        if (!source) return;
        executeDrop({ kind: 'backpack', index: idx }, source);
        clearDropPayload();
      };
    });

    ['weapon1', 'weapon2', 'armor', 'readied'].forEach(function (slot) {
      var id = slot === 'weapon1' ? 'eqWeapon1' : slot === 'weapon2' ? 'eqWeapon2' : slot === 'armor' ? 'eqArmor' : 'eqReadied';
      var el = document.getElementById(id);
      if (!el) return;
      var value = String(el.value || '').trim();
      el.setAttribute('data-drop-target', 'equip:' + slot);
      el.classList.add('co-drop-target');
      el.draggable = !!value;
      el.ondragstart = value ? function (ev) {
        setDropPayload({ kind: 'equip', slot: slot });
        ev.dataTransfer.setData('text/plain', 'equip:' + slot);
      } : null;
      el.ondragover = function (ev) { ev.preventDefault(); el.classList.add('co-drop-over'); };
      el.ondragleave = function () { el.classList.remove('co-drop-over'); };
      el.ondrop = function (ev) {
        ev.preventDefault();
        el.classList.remove('co-drop-over');
        var source = currentDropPayload();
        if (!source) return;
        executeDrop({ kind: 'equip', slot: slot }, source);
        clearDropPayload();
      };
    });

    var cosSlots = document.querySelectorAll('[data-drop-target="equip:under"],[data-drop-target="equip:over"],[data-drop-target="equip:suit"]');
    cosSlots.forEach(function (slotEl) {
      slotEl.ondragover = function (ev) { ev.preventDefault(); slotEl.classList.add('co-drop-over'); };
      slotEl.ondragleave = function () { slotEl.classList.remove('co-drop-over'); };
      slotEl.ondrop = function (ev) {
        ev.preventDefault();
        slotEl.classList.remove('co-drop-over');
        var source = currentDropPayload();
        if (!source) return;
        var target = parseTarget(slotEl.getAttribute('data-drop-target'));
        executeDrop(target, source);
        clearDropPayload();
      };
    });
  }

  function detectHexByPoint(svg, event) {
    if (!svg || typeof window.hexToPixel !== 'function' || !Array.isArray(window.mapData)) return null;
    var pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    var loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    var best = null;
    var bestDist = Infinity;
    var maxDist = Number(window.HEX_SIZE || 30) * 0.95;
    window.mapData.forEach(function (hex) {
      var p = window.hexToPixel(hex.col, hex.row);
      var dx = loc.x - p.x;
      var dy = loc.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        best = hex;
      }
    });
    if (best && bestDist <= maxDist) return best;
    return null;
  }

  function mapKey(hex) {
    return hex ? (String(hex.col) + ',' + String(hex.row)) : '';
  }

  function addPing(hex) {
    var state = ensureState();
    if (!state || !hex) return;
    var key = mapKey(hex);
    var who = String((window.S && window.S.name) || 'Wayfarer').trim() || 'Wayfarer';
    state.mapTools.pings.push({ key: key, at: Date.now(), by: who });
    state.mapTools.pings = state.mapTools.pings.slice(-24);
    safeNotif('Ping at hex ' + key + '.', 'info');
    if (typeof window.renderHexMap === 'function') window.renderHexMap();
  }

  function cycleStatus(hex) {
    var state = ensureState();
    if (!state || !hex) return;
    var key = mapKey(hex);
    var current = String(state.mapTools.statusByHex[key] || '');
    var statuses = ['', 'guard', 'poison', 'burn', 'stun', 'hidden'];
    var idx = statuses.indexOf(current);
    var next = statuses[(idx + 1) % statuses.length];
    if (!next) delete state.mapTools.statusByHex[key];
    else state.mapTools.statusByHex[key] = next;
    safeNotif(next ? ('Status: ' + next + ' @ ' + key) : ('Status cleared @ ' + key), 'good');
    if (typeof window.renderHexMap === 'function') window.renderHexMap();
  }

  function trackMovementTrail() {
    var state = ensureState();
    if (!state || !window.selectedHex) return;
    var key = mapKey(window.selectedHex);
    if (!key || key === state.mapTools.lastTrailKey) return;
    state.mapTools.lastTrailKey = key;
    state.mapTools.trails.push({ key: key, at: Date.now() });
    state.mapTools.trails = state.mapTools.trails.slice(-18);
  }

  function clearMovementTrail() {
    var state = ensureState();
    if (!state) return;
    state.mapTools.trails = [];
    state.mapTools.lastTrailKey = '';
    safeNotif('Movement trail cleared.', 'good');
    if (typeof window.renderHexMap === 'function') window.renderHexMap();
  }

  function resolveMapRegionFromControls(controlsHost) {
    var panel = controlsHost && controlsHost.closest ? controlsHost.closest('.tab-panel') : null;
    var panelId = panel && panel.id ? String(panel.id) : '';
    if (!panelId) return 'province';
    if (panelId === 'tab-map') return 'province';
    return panelId.replace(/^tab-/, '');
  }

  function performMapLongRest() {
    if (!window.S || typeof window.S !== 'object') return;
    if (typeof window.clearStress === 'function') {
      window.clearStress();
    } else {
      window.S.stress = 0;
    }
    if (typeof window.clearAllConditions === 'function') {
      window.clearAllConditions();
    }
    if (typeof window.updateStressUI === 'function') {
      window.updateStressUI();
    }
    safeNotif('Long Rest complete: stress cleared and conditions removed.', 'good');
  }

  function ensureMapInteractionControls() {
    var controlsList = document.querySelectorAll('.map-controls');
    if (!controlsList || !controlsList.length) return;
    var state = ensureState();
    if (!state) return;

    Array.prototype.forEach.call(controlsList, function (controls) {
      var region = resolveMapRegionFromControls(controls);
      var fogConfig = typeof window.getMapFogConfig === 'function' ? window.getMapFogConfig(region) : null;
      var fogEnabled = fogConfig ? !!fogConfig.enabled : !!state.mapTools.manualFogMode;
      var campaignState = window.campaignSystem && typeof window.campaignSystem.getState === 'function'
        ? window.campaignSystem.getState()
        : null;
      var playerView = !!(campaignState && campaignState.code && campaignState.role === 'player');
      state.mapTools.manualFogMode = fogEnabled;
      var row = controls.querySelector('.map-interaction-controls');
      if (!row) {
        row = document.createElement('span');
        row.className = 'map-interaction-controls';
        controls.appendChild(row);
      }

      row.innerHTML = ''
        + '<button class="btn btn-sm ' + (fogEnabled ? 'btn-teal' : '') + ' coFogModeBtn"' + (playerView ? ' disabled title="Fog is controlled by the GM"' : '') + '>' + (playerView ? 'GM Fog' : 'Fog Manual') + ': ' + (fogEnabled ? 'On' : 'Off') + '</button>'
        + '<button class="btn btn-sm coTrailClearBtn">Clear Trail</button>'
        + '<button class="btn btn-sm btn-teal coLongRestBtn">Long Rest</button>';

      var modeBtn = row.querySelector('.coFogModeBtn');
      if (modeBtn) {
        modeBtn.onclick = function () {
          if (playerView) {
            safeNotif('Fog of war is controlled by the GM.', 'info');
            return;
          }
          if (typeof window.getMapFogConfig === 'function' && typeof window.toggleMapFogForRegion === 'function') {
            var cfg = window.getMapFogConfig(region);
            state.mapTools.manualFogMode = cfg ? !cfg.enabled : !state.mapTools.manualFogMode;
            window.toggleMapFogForRegion(region);
          } else {
            state.mapTools.manualFogMode = !state.mapTools.manualFogMode;
          }
          modeBtn.textContent = 'Fog Manual: ' + (state.mapTools.manualFogMode ? 'On' : 'Off');
          modeBtn.classList.toggle('btn-teal', state.mapTools.manualFogMode);
          if (typeof window.renderHexMap === 'function') window.renderHexMap();
        };
      }

      var clearTrailBtn = row.querySelector('.coTrailClearBtn');
      if (clearTrailBtn) {
        clearTrailBtn.onclick = function () {
          clearMovementTrail();
        };
      }

      var longRestBtn = row.querySelector('.coLongRestBtn');
      if (longRestBtn) {
        longRestBtn.onclick = function () {
          performMapLongRest();
        };
      }
    });
  }

  function renderMapOverlays() {
    var state = ensureState();
    if (!state) return;
    var svg = document.getElementById('hexMapSvg');
    if (!svg || typeof window.hexToPixel !== 'function') return;

    ensureMapInteractionControls();
    trackMovementTrail();

    var now = Date.now();
    state.mapTools.pings = state.mapTools.pings.filter(function (p) { return (now - Number(p.at || 0)) < 14000; });

    var old = document.getElementById('coMapOverlayLayer');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'coMapOverlayLayer');

    state.mapTools.pings.forEach(function (ping) {
      var parts = String(ping.key || '').split(',');
      var col = Number(parts[0]);
      var row = Number(parts[1]);
      if (!isFinite(col) || !isFinite(row)) return;
      var p = window.hexToPixel(col, row);
      var age = Math.max(0, now - Number(ping.at || now));
      var progress = Math.min(1, age / 14000);
      var ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', String(p.x));
      ring.setAttribute('cy', String(p.y));
      ring.setAttribute('r', String(8 + Math.round(progress * 20)));
      ring.setAttribute('fill', 'rgba(126,215,255,0.06)');
      ring.setAttribute('stroke', 'rgba(126,215,255,' + String(0.9 - progress * 0.7) + ')');
      ring.setAttribute('stroke-width', '2');
      ring.setAttribute('pointer-events', 'none');
      g.appendChild(ring);
    });

    Object.keys(state.mapTools.statusByHex || {}).forEach(function (key) {
      var status = String(state.mapTools.statusByHex[key] || '');
      if (!status) return;
      var parts = key.split(',');
      var p = window.hexToPixel(Number(parts[0]), Number(parts[1]));
      var icon = status === 'guard' ? '🛡' : status === 'poison' ? '☣' : status === 'burn' ? '🔥' : status === 'stun' ? '💫' : '🕶';
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', String(p.x - Number(window.HEX_SIZE || 30) * 0.58));
      t.setAttribute('y', String(p.y - Number(window.HEX_SIZE || 30) * 0.55));
      t.setAttribute('font-size', '12');
      t.setAttribute('pointer-events', 'none');
      t.textContent = icon;
      g.appendChild(t);
    });

    if (state.mapTools.trails.length > 1) {
      var points = state.mapTools.trails.map(function (step) {
        var parts = String(step.key || '').split(',');
        var p = window.hexToPixel(Number(parts[0]), Number(parts[1]));
        return String(p.x) + ',' + String(p.y);
      }).join(' ');
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('points', points);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', 'rgba(232,192,80,0.7)');
      line.setAttribute('stroke-width', '2.4');
      line.setAttribute('stroke-dasharray', '4 3');
      line.setAttribute('pointer-events', 'none');
      g.appendChild(line);
    }

    if (state.mapTools.manualFogMode) {
      Object.keys(state.mapTools.manualFogHidden || {}).forEach(function (key) {
        if (!state.mapTools.manualFogHidden[key]) return;
        var parts = key.split(',');
        var col = Number(parts[0]);
        var row = Number(parts[1]);
        if (!isFinite(col) || !isFinite(row)) return;
        var p = window.hexToPixel(col, row);
        var r = Math.max(6, Number(window.HEX_SIZE || 30) - 1);
        var pts = [];
        for (var i = 0; i < 6; i += 1) {
          var ang = ((60 * i - 30) * Math.PI) / 180;
          pts.push((p.x + r * Math.cos(ang)) + ',' + (p.y + r * Math.sin(ang)));
        }
        var fog = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        fog.setAttribute('points', pts.join(' '));
        fog.setAttribute('fill', 'rgba(6,10,16,0.74)');
        fog.setAttribute('stroke', 'rgba(155,170,198,0.32)');
        fog.setAttribute('stroke-width', '1.2');
        fog.setAttribute('pointer-events', 'none');
        g.appendChild(fog);
      });
    }

    svg.appendChild(g);

    if (!svg.dataset.coBound) {
      svg.dataset.coBound = '1';
      svg.addEventListener('click', function (ev) {
        var hex = detectHexByPoint(svg, ev);
        if (!hex) return;
        if (ev.altKey) {
          ev.preventDefault();
          ev.stopPropagation();
          addPing(hex);
          return;
        }
        if (ev.shiftKey) {
          ev.preventDefault();
          ev.stopPropagation();
          cycleStatus(hex);
        }
      }, true);
    }
  }

  function patchGlobalRenders() {
    if (typeof window.renderBackpackUI === 'function' && !window.renderBackpackUI.__coWrapped) {
      var oldBackpack = window.renderBackpackUI;
      window.renderBackpackUI = function () {
        var out = oldBackpack.apply(this, arguments);
        decorateInventoryDnd();
        ensureInventoryWeightHud();
        return out;
      };
      window.renderBackpackUI.__coWrapped = true;
    }

    if (typeof window.renderHexMap === 'function' && !window.renderHexMap.__coWrapped) {
      var oldHex = window.renderHexMap;
      window.renderHexMap = function () {
        var out = oldHex.apply(this, arguments);
        renderMapOverlays();
        return out;
      };
      window.renderHexMap.__coWrapped = true;
    }
  }

  function boot() {
    ensureState();
    patchGlobalRenders();
    renderIdentityForge();
    ensureCombatHud();
    renderRoleplayDock();
    decorateInventoryDnd();
    ensureInventoryWeightHud();
    renderMapOverlays();

    window.renderCompanionOverhaul = function () {
      renderIdentityForge();
      ensureCombatHud();
      renderRoleplayDock();
      decorateInventoryDnd();
      ensureInventoryWeightHud();
      renderMapOverlays();
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

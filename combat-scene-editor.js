(function () {
  var KEY = 'btl-combat-scene-editor-v1';
  var RECOVERY_KEY = KEY + '-recovery';
  var COMBAT_THEME_PRESETS = {
    obsidian: {
      accent: '#e3bc5e',
      accent2: '#49c9bb',
      surface: 'rgba(12, 14, 26, 0.86)',
      text: '#e9e0cf',
      muted: '#9fa7bc',
      border: 'rgba(227, 188, 94, 0.3)',
      danger: '#d05353',
      fog: 'rgba(2, 3, 7, 0.74)',
      ping: '#49c9bb',
      bgStart: '#070913',
      bgEnd: '#04050a'
    },
    dawn: {
      accent: '#b86f32',
      accent2: '#2b6b8f',
      surface: 'rgba(247, 241, 229, 0.92)',
      text: '#271d14',
      muted: '#6d6259',
      border: 'rgba(184, 111, 50, 0.28)',
      danger: '#a04034',
      fog: 'rgba(62, 45, 29, 0.42)',
      ping: '#2b6b8f',
      bgStart: '#f5e7d4',
      bgEnd: '#d9c4aa'
    },
    'high-contrast': {
      accent: '#ffe600',
      accent2: '#00f0ff',
      surface: 'rgba(0, 0, 0, 0.94)',
      text: '#ffffff',
      muted: '#d0d0d0',
      border: 'rgba(255, 255, 255, 0.42)',
      danger: '#ff4f4f',
      fog: 'rgba(0, 0, 0, 0.88)',
      ping: '#00f0ff',
      bgStart: '#050505',
      bgEnd: '#000000'
    }
  };
  var tokenContextMenuHideTimer = null;
  var applyingSharedCombatSceneEditorState = false;
  var campaignCombatVttSessionSyncTimer = null;
  var combatDragDebugState = {
    phase: 'idle',
    kind: '',
    payload: '',
    source: 'none',
    dropSource: 'none',
    clientX: null,
    clientY: null,
    q: null,
    r: null,
    at: 0
  };
  var lastCombatBoardHex = null;
  var SPELLCAST_DIRECTION_KEYS = ['e', 'ne', 'nw', 'w', 'sw', 'se'];

  function currentCombatDragPayloadSnapshot() {
    if (window.__combatAssetDragPayload && typeof window.__combatAssetDragPayload === 'object') {
      return {
        kind: String(window.__combatAssetDragPayload.kind || ''),
        payload: String(window.__combatAssetDragPayload.payload || ''),
        source: 'active'
      };
    }
    if (window.__combatAssetDragPayloadLastKnown && typeof window.__combatAssetDragPayloadLastKnown === 'object') {
      var ageMs = Date.now() - Number(window.__combatAssetDragPayloadLastKnown.at || 0);
      if (ageMs >= 0 && ageMs < 15000) {
        return {
          kind: String(window.__combatAssetDragPayloadLastKnown.kind || ''),
          payload: String(window.__combatAssetDragPayloadLastKnown.payload || ''),
          source: 'last-known'
        };
      }
    }
    return { kind: '', payload: '', source: 'none' };
  }

  function renderCombatDragDebugBanner(state) {
    var node = document.getElementById('combatDragDebugBanner');
    if (!node) return;
    var ui = normalizeCombatUi(state && state.ui);
    if (!ui.dragDebugBanner) {
      node.classList.remove('visible');
      return;
    }
    var payload = combatDragDebugState.kind
      ? String(combatDragDebugState.kind) + ':' + String(combatDragDebugState.payload || '')
      : '(none)';
    var pointer = Number.isFinite(Number(combatDragDebugState.clientX)) && Number.isFinite(Number(combatDragDebugState.clientY))
      ? Math.round(Number(combatDragDebugState.clientX)) + ',' + Math.round(Number(combatDragDebugState.clientY))
      : '--,--';
    var hex = Number.isFinite(Number(combatDragDebugState.q)) && Number.isFinite(Number(combatDragDebugState.r))
      ? toKey(Number(combatDragDebugState.q), Number(combatDragDebugState.r))
      : '--';
    var source = String(combatDragDebugState.source || 'none');
    var dropSource = String(combatDragDebugState.dropSource || 'none');
    var phase = String(combatDragDebugState.phase || 'idle');
    node.classList.add('visible');
    node.textContent = 'DnD Debug ON | phase=' + phase + ' | payload=' + payload + ' | pointer=' + pointer + ' | hex=' + hex + ' | source=' + source + ' | dropTarget=' + dropSource;
  }

  function setCombatDragDebugState(patch) {
    combatDragDebugState = Object.assign({}, combatDragDebugState, patch || {}, { at: Date.now() });
    renderCombatDragDebugBanner(store.getState());
  }

  function setCombatAssetDragPreview(preview) {
    store.setState({ assetDragPreview: preview || null });
    drawBoard();
  }

  function clearCombatAssetDragPreview() {
    setCombatAssetDragPreview(null);
  }

  function setCombatAssetUpload(upload) {
    store.setState(Object.assign({}, store.getState(), { assetUpload: upload || null }));
    updateUiPanels();
  }

  function setCombatAssetDrawerOpen(open) {
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.ui = normalizeCombatUi(Object.assign({}, state.ui || {}, { assetDrawerOpen: !!open }));
      persist(next);
      return next;
    });
    updateUiPanels();
  }

  function setCombatAssetDragGhost(ghost) {
    var root = document.getElementById('combatModeOverlay');
    var node = document.getElementById('combatAssetDragGhost');
    if (!root || !node) return;
    if (!ghost) {
      node.classList.remove('visible');
      node.textContent = '';
      return;
    }
    node.textContent = String(ghost.label || 'Dragging asset'); // Updated ghost label
    node.style.left = Number(ghost.x || 0) + 'px';
    node.style.top = Number(ghost.y || 0) + 'px';
    node.classList.add('visible');
  }

  function clearCombatAssetDragGhost() {
    setCombatAssetDragGhost(null);
  }

  function getDefaultAssetDropHex(state, selectedTokenId, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var preferSelection = !!opts.preferSelection;
    if (preferSelection) {
      if (lastCombatBoardHex && Number.isFinite(Number(lastCombatBoardHex.q)) && Number.isFinite(Number(lastCombatBoardHex.r))) {
        return { q: Number(lastCombatBoardHex.q || 0), r: Number(lastCombatBoardHex.r || 0), source: 'last-board-hex' };
      }
      var selectedMapItem = state && state.selectedMapItem && typeof state.selectedMapItem === 'object'
        ? state.selectedMapItem
        : null;
      if (selectedMapItem && selectedMapItem.key) {
        var selectedCoords = fromKeyString(String(selectedMapItem.key || '0,0'));
        return { q: Number(selectedCoords.q || 0), r: Number(selectedCoords.r || 0), source: 'selected-map-item' };
      }
    }
    var board = normalizeBoard(state && state.board);
    var token = byId(selectedTokenId);
    if (token) return { q: Number(token.q || 0) + 1, r: Number(token.r || 0) + 1, source: 'token' };
    var center = pixelToAxial(Number(board.panX || 0), Number(board.panY || 0), Number(board.size || 42) * Number(board.zoom || 1), Number(board.panX || 0), Number(board.panY || 0));
    return { q: Number(center.q || 0), r: Number(center.r || 0), source: 'board-center' };
  }

  function primeCombatAssetDragPayload(kind, payload, label) {
    var stamped = {
      kind: String(kind || ''),
      payload: String(payload || ''),
      label: String(label || 'Dragging asset'),
      at: Date.now()
    };
    window.__combatAssetDragPayload = stamped;
    window.__combatAssetDragPayloadLastKnown = stamped;
  }

  function primeCombatAssetDockDescriptor(kind, payload, label) {
    window.__combatAssetDockDescriptor = {
      kind: String(kind || ''),
      payload: String(payload || ''),
      label: String(label || 'Dragging asset'),
      at: Date.now()
    };
  }

  function applyCombatHoverLabels(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.slice.call(root.querySelectorAll('.combat-icon-btn, .combat-chip, .combat-panel-header, .combat-topbar .btn')).forEach(function (node) {
      if (!node || !node.setAttribute) return;
      var label = String(node.getAttribute('data-hover-label') || node.getAttribute('title') || node.getAttribute('aria-label') || node.textContent || '').replace(/\s+/g, ' ').trim();
      if (label) node.setAttribute('data-hover-label', label.replace(/\s+[◀✕X]$/, '').trim());
    });
  }

  function applyBattlemapFile(file, contextLabel) {
    if (!file || String(file.type || '').indexOf('image/') !== 0) return false;
    var reader = new FileReader();
    setCombatAssetUpload({
      name: String(file.name || 'image'),
      kind: 'battlemap',
      loaded: 0,
      total: Math.max(1, Number(file.size || 1)),
      pct: 0,
      status: 'Reading...'
    });
    reader.onprogress = function (ev) {
      var total = Math.max(1, Number(ev && ev.total || file.size || 1));
      var loaded = Math.max(0, Number(ev && ev.loaded || 0));
      setCombatAssetUpload({
        name: String(file.name || 'image'),
        kind: 'battlemap',
        loaded: loaded,
        total: total,
        pct: Math.max(0, Math.min(100, Math.round((loaded / total) * 100))),
        status: 'Uploading...'
      });
    };
    reader.onload = function () {
      captureUndoSnapshot('Drop Battlemap');
      store.setState(function (state) {
        var next = Object.assign({}, state);
        next.board = Object.assign({}, state.board || {}, { background: String(reader.result || '') });
        persist(next);
        return next;
      });
      setCombatAssetUpload({
        name: String(file.name || 'image'),
        kind: 'battlemap',
        loaded: Math.max(1, Number(file.size || 1)),
        total: Math.max(1, Number(file.size || 1)),
        pct: 100,
        status: 'Ready'
      });
      clearCombatAssetDragPreview();
      clearCombatAssetDragGhost();
      drawBoard();
      updateUiPanels();
      addHistory('Battlemap applied: ' + String(file.name || 'image') + '.');
      safeNotif('Battlemap applied from ' + String(contextLabel || 'asset upload') + '.', 'good');
      setTimeout(function () {
        var current = store.getState();
        if (current && current.assetUpload && String(current.assetUpload.name || '') === String(file.name || '')) {
          setCombatAssetUpload(null);
        }
      }, 1200);
    };
    reader.onerror = function () {
      setCombatAssetUpload({
        name: String(file.name || 'image'),
        kind: 'battlemap',
        loaded: 0,
        total: Math.max(1, Number(file.size || 1)),
        pct: 0,
        status: 'Failed'
      });
      safeNotif('Battlemap upload failed.', 'warn');
    };
    reader.readAsDataURL(file);
    return true;
  }

  function applyBattlemapDrop(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (file) {
      return file && String(file.type || '').indexOf('image/') === 0;
    });
    if (!files.length) return false;
    return applyBattlemapFile(files[0], 'dropped image');
  }

  function normalizeCombatAssetFolders(folders) {
    var src = folders && typeof folders === 'object' ? folders : {};
    var mapAssets = Array.isArray(src.mapAssets) ? src.mapAssets : [];
    var hexAssets = Array.isArray(src.hexAssets) ? src.hexAssets : [];
    function normalizeEntry(entry, prefix) {
      if (!entry || typeof entry !== 'object') return null;
      var id = String(entry.id || uid(prefix || 'asset'));
      var name = String(entry.name || 'Asset');
      var srcUrl = String(entry.src || '');
      if (!srcUrl) return null;
      return {
        id: id,
        name: name,
        src: srcUrl,
        uploadedAt: Number(entry.uploadedAt || Date.now())
      };
    }
    return {
      mapAssets: mapAssets.map(function (row) { return normalizeEntry(row, 'map'); }).filter(Boolean).slice(-60),
      hexAssets: hexAssets.map(function (row) { return normalizeEntry(row, 'hex'); }).filter(Boolean).slice(-120)
    };
  }

  function ensureCombatSceneRulesExtensions(rules) {
    var next = Object.assign({ rollMode: 'auto', defaultActionType: 'ranged', targetCoverOverrides: {}, lootDrops: {} }, rules && typeof rules === 'object' ? rules : {});
    next.lootDrops = Object.assign({}, next.lootDrops || {});
    next.targetCoverOverrides = Object.assign({}, next.targetCoverOverrides || {});
    next.mapLootCaches = Object.assign({}, next.mapLootCaches || {});
    next.hazardChecks = Object.assign({}, next.hazardChecks || {});
    next.mapItemMeta = Object.assign({}, next.mapItemMeta || {});
    next.aoeZones = Array.isArray(next.aoeZones) ? next.aoeZones.slice() : [];
    next.assetFolders = normalizeCombatAssetFolders(next.assetFolders || {});
    return next;
  }

  function isSelectableMapLayer(layerName) {
    return ['terrain', 'objects', 'hazards'].indexOf(String(layerName || '')) >= 0;
  }

  function normalizeMapItemSelection(selection, state) {
    if (!selection || typeof selection !== 'object') return null;
    var layer = String(selection.layer || '');
    var key = String(selection.key || '');
    if (!isSelectableMapLayer(layer) || !key) return null;
    if (state && (!state.layers || !state.layers[layer] || !state.layers[layer][key])) return null;
    return { layer: layer, key: key };
  }

  function mapItemMetaKey(layerName, key) {
    return String(layerName || '') + ':' + String(key || '');
  }

  function getMapItemMeta(state, layerName, key) {
    var rules = ensureCombatSceneRulesExtensions(state && state.sceneRules || {});
    return Object.assign({}, rules.mapItemMeta && rules.mapItemMeta[mapItemMetaKey(layerName, key)] || {});
  }

  function isMapItemLocked(state, layerName, key) {
    return !!getMapItemMeta(state, layerName, key).locked;
  }

  function describeMapItemLabel(layerName, value) {
    var layer = String(layerName || '');
    var raw = String(value || '').trim();
    if (!raw) return 'Map Item';
    if (layer === 'terrain' && raw.indexOf('hexasset:') === 0) return 'Hex Asset';
    return raw.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (chr) { return chr.toUpperCase(); });
  }

  function getMapItemValue(state, layerName, key) {
    return String(state && state.layers && state.layers[layerName] && state.layers[layerName][key] || '');
  }

  function getSelectedMapItemRecord(state) {
    var selection = normalizeMapItemSelection(state && state.selectedMapItem, state);
    if (!selection) return null;
    var value = getMapItemValue(state, selection.layer, selection.key);
    if (!value) return null;
    var coords = fromKeyString(selection.key);
    return {
      layer: selection.layer,
      key: selection.key,
      q: Number(coords.q || 0),
      r: Number(coords.r || 0),
      value: value,
      label: describeMapItemLabel(selection.layer, value),
      locked: isMapItemLocked(state, selection.layer, selection.key)
    };
  }

  function findSelectableMapItemAt(state, q, r) {
    var key = toKey(q, r);
    var hazard = getMapItemValue(state, 'hazards', key);
    if (hazard) {
      return { layer: 'hazards', key: key, q: Number(q || 0), r: Number(r || 0), value: hazard, label: describeMapItemLabel('hazards', hazard), locked: isMapItemLocked(state, 'hazards', key) };
    }
    var object = getMapItemValue(state, 'objects', key);
    if (object) {
      return { layer: 'objects', key: key, q: Number(q || 0), r: Number(r || 0), value: object, label: describeMapItemLabel('objects', object), locked: isMapItemLocked(state, 'objects', key) };
    }
    var terrain = getMapItemValue(state, 'terrain', key);
    if (terrain.indexOf('hexasset:') === 0) {
      return { layer: 'terrain', key: key, q: Number(q || 0), r: Number(r || 0), value: terrain, label: describeMapItemLabel('terrain', terrain), locked: isMapItemLocked(state, 'terrain', key) };
    }
    return null;
  }

  function clearMapItemSelection() {
    store.setState({ selectedMapItem: null, draggingMapItem: null });
  }

  function syncMapItemSupportForKey(rules, layerName, fromKey, toKey, value) {
    var nextRules = ensureCombatSceneRulesExtensions(rules);
    var metaMap = Object.assign({}, nextRules.mapItemMeta || {});
    var oldMetaKey = mapItemMetaKey(layerName, fromKey);
    var newMetaKey = mapItemMetaKey(layerName, toKey);
    if (metaMap[oldMetaKey]) {
      metaMap[newMetaKey] = Object.assign({}, metaMap[oldMetaKey]);
      delete metaMap[oldMetaKey];
    }
    nextRules.mapItemMeta = metaMap;
    if (String(layerName || '') === 'hazards') {
      var hazardChecks = Object.assign({}, nextRules.hazardChecks || {});
      if (hazardChecks[fromKey]) {
        hazardChecks[toKey] = Object.assign({}, hazardChecks[fromKey], { label: String(hazardChecks[fromKey].label || describeMapItemLabel(layerName, value)) });
        delete hazardChecks[fromKey];
      }
      nextRules.hazardChecks = hazardChecks;
    }
    if (String(layerName || '') === 'objects' && String(value || '') === 'loot-cache') {
      var caches = Object.assign({}, nextRules.mapLootCaches || {});
      if (caches[fromKey]) {
        var coords = fromKeyString(toKey);
        caches[toKey] = Object.assign({}, caches[fromKey], { q: Number(coords.q || 0), r: Number(coords.r || 0) });
        delete caches[fromKey];
      }
      nextRules.mapLootCaches = caches;
    }
    return nextRules;
  }

  function fromKeyString(key) {
    var parts = String(key || '0,0').split(',');
    return {
      q: Number(parts[0] || 0),
      r: Number(parts[1] || 0)
    };
  }

  function deleteMapItemAt(layerName, key, opts) {
    var state = store.getState();
    var layer = String(layerName || '');
    var current = getMapItemValue(state, layer, key);
    if (!current) return false;
    var options = opts && typeof opts === 'object' ? opts : {};
    if (isMapItemLocked(state, layer, key) && !options.force) {
      safeNotif('Unlock this map item before editing it.', 'warn');
      return false;
    }
    if (options.captureUndo !== false) captureUndoSnapshot('Delete Map Item');
    store.setState(function (inner) {
      var next = normalizeCombatSceneState(Object.assign({}, inner));
      next.layers[layer] = Object.assign({}, inner.layers && inner.layers[layer] || {});
      delete next.layers[layer][key];
      var rules = ensureCombatSceneRulesExtensions(inner.sceneRules);
      rules.mapItemMeta = Object.assign({}, rules.mapItemMeta || {});
      delete rules.mapItemMeta[mapItemMetaKey(layer, key)];
      if (layer === 'hazards') {
        rules.hazardChecks = Object.assign({}, rules.hazardChecks || {});
        delete rules.hazardChecks[key];
      }
      if (layer === 'objects' && current === 'loot-cache') {
        rules.mapLootCaches = Object.assign({}, rules.mapLootCaches || {});
        delete rules.mapLootCaches[key];
      }
      next.sceneRules = rules;
      if (next.selectedMapItem && String(next.selectedMapItem.layer || '') === layer && String(next.selectedMapItem.key || '') === String(key || '')) {
        next.selectedMapItem = null;
      }
      persist(next);
      return next;
    });
    addHistory(describeMapItemLabel(layer, current) + ' removed from ' + key + '.');
    drawBoard();
    updateUiPanels();
    return true;
  }

  function moveMapItemTo(layerName, fromKey, targetQ, targetR) {
    var state = store.getState();
    var layer = String(layerName || '');
    var value = getMapItemValue(state, layer, fromKey);
    if (!value) return false;
    if (isMapItemLocked(state, layer, fromKey)) {
      safeNotif('Unlock this map item before moving it.', 'warn');
      return false;
    }
    var targetKey = toKey(targetQ, targetR);
    if (targetKey === String(fromKey || '')) return false;
    if (getMapItemValue(state, layer, targetKey)) {
      safeNotif('That hex already has a ' + describeMapItemLabel(layer, value).toLowerCase() + ' on this layer.', 'warn');
      return false;
    }
    store.setState(function (inner) {
      var next = normalizeCombatSceneState(Object.assign({}, inner));
      next.layers[layer] = Object.assign({}, inner.layers && inner.layers[layer] || {});
      delete next.layers[layer][fromKey];
      next.layers[layer][targetKey] = value;
      next.sceneRules = syncMapItemSupportForKey(inner.sceneRules, layer, fromKey, targetKey, value);
      next.selectedMapItem = { layer: layer, key: targetKey };
      next.draggingMapItem = { layer: layer, key: targetKey };
      persist(next);
      return next;
    });
    drawBoard();
    updateUiPanels();
    return true;
  }

  function copySelectedMapItemToClipboard() {
    var state = store.getState();
    var item = getSelectedMapItemRecord(state);
    if (!item) {
      safeNotif('Select a map item first.', 'warn');
      return false;
    }
    var rules = ensureCombatSceneRulesExtensions(state.sceneRules);
    var payload = {
      layer: item.layer,
      value: item.value,
      label: item.label,
      meta: getMapItemMeta(state, item.layer, item.key)
    };
    if (item.layer === 'hazards' && rules.hazardChecks[item.key]) payload.hazardCheck = Object.assign({}, rules.hazardChecks[item.key]);
    if (item.layer === 'objects' && item.value === 'loot-cache' && rules.mapLootCaches[item.key]) payload.lootCache = Object.assign({}, rules.mapLootCaches[item.key]);
    store.setState(function (inner) {
      var next = Object.assign({}, inner, { clipboardMapItem: payload });
      persist(next);
      return next;
    });
    safeNotif(item.label + ' copied.', 'good');
    return true;
  }

  function pasteMapItemFromClipboard(targetQ, targetR) {
    var state = store.getState();
    var clip = state && state.clipboardMapItem && typeof state.clipboardMapItem === 'object' ? state.clipboardMapItem : null;
    if (!clip || !isSelectableMapLayer(clip.layer) || !String(clip.value || '')) {
      safeNotif('Map item clipboard is empty.', 'warn');
      return false;
    }
    var targetKey = toKey(targetQ, targetR);
    if (getMapItemValue(state, clip.layer, targetKey)) {
      safeNotif('That hex already has a map item on the ' + clip.layer + ' layer.', 'warn');
      return false;
    }
    captureUndoSnapshot('Paste Map Item');
    store.setState(function (inner) {
      var next = normalizeCombatSceneState(Object.assign({}, inner));
      next.layers[clip.layer] = Object.assign({}, inner.layers && inner.layers[clip.layer] || {});
      next.layers[clip.layer][targetKey] = String(clip.value || '');
      var rules = ensureCombatSceneRulesExtensions(inner.sceneRules);
      rules.mapItemMeta = Object.assign({}, rules.mapItemMeta || {});
      if (clip.meta && typeof clip.meta === 'object' && Object.keys(clip.meta).length) {
        rules.mapItemMeta[mapItemMetaKey(clip.layer, targetKey)] = Object.assign({}, clip.meta, { locked: false });
      }
      if (clip.layer === 'hazards' && clip.hazardCheck) {
        rules.hazardChecks = Object.assign({}, rules.hazardChecks || {});
        rules.hazardChecks[targetKey] = Object.assign({}, clip.hazardCheck, { label: String(clip.hazardCheck.label || describeMapItemLabel(clip.layer, clip.value)) });
      }
      if (clip.layer === 'objects' && clip.value === 'loot-cache' && clip.lootCache) {
        var coords = fromKeyString(targetKey);
        rules.mapLootCaches = Object.assign({}, rules.mapLootCaches || {});
        rules.mapLootCaches[targetKey] = Object.assign({}, clip.lootCache, { id: uid('cache'), q: Number(coords.q || 0), r: Number(coords.r || 0), stockedAt: Date.now() });
      }
      next.sceneRules = rules;
      next.selectedMapItem = { layer: clip.layer, key: targetKey };
      persist(next);
      return next;
    });
    addHistory((clip.label || 'Map item') + ' pasted at ' + targetKey + '.');
    drawBoard();
    updateUiPanels();
    return true;
  }

  function toggleSelectedMapItemLock(forceValue) {
    var state = store.getState();
    var item = getSelectedMapItemRecord(state);
    if (!item) {
      safeNotif('Select a map item first.', 'warn');
      return false;
    }
    captureUndoSnapshot('Toggle Map Item Lock');
    var nextLocked = typeof forceValue === 'boolean' ? forceValue : !item.locked;
    store.setState(function (inner) {
      var next = normalizeCombatSceneState(Object.assign({}, inner));
      var rules = ensureCombatSceneRulesExtensions(inner.sceneRules);
      rules.mapItemMeta = Object.assign({}, rules.mapItemMeta || {});
      rules.mapItemMeta[mapItemMetaKey(item.layer, item.key)] = Object.assign({}, rules.mapItemMeta[mapItemMetaKey(item.layer, item.key)] || {}, { locked: nextLocked });
      next.sceneRules = rules;
      persist(next);
      return next;
    });
    safeNotif(nextLocked ? 'Map item locked.' : 'Map item unlocked.', 'good');
    drawBoard();
    updateUiPanels();
    return true;
  }

  function saveHazardCheckConfigAt(q, r, config) {
    var cfg = Object.assign({}, config && typeof config === 'object' ? config : {});
    var state = store.getState();
    var profile = getLayerGameplayProfile(state, q, r);
    var current = getHazardCheckConfigAt(state, q, r, profile);
    var normalizedDie = String(cfg.dieKey || current.dieKey || 'defend').trim().toLowerCase();
    var allowed = getCombatActionDieOptions().map(function (entry) { return entry.key; });
    if (allowed.indexOf(normalizedDie) < 0) normalizedDie = 'defend';
    var label = String(cfg.label || current.label || 'Hazard').trim() || 'Hazard';
    var dd = Math.max(4, Math.min(20, Number(cfg.dd == null ? current.dd : cfg.dd)));
    var damage = Math.max(1, Math.min(10, Number(cfg.onFailDamage == null ? current.onFailDamage : cfg.onFailDamage)));
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var rules = ensureCombatSceneRulesExtensions(inner.sceneRules);
      rules.hazardChecks = Object.assign({}, rules.hazardChecks || {});
      rules.hazardChecks[toKey(q, r)] = {
        dd: dd,
        dieKey: normalizedDie,
        label: label,
        onFailDamage: damage
      };
      next.sceneRules = rules;
      persist(next);
      return next;
    });
    addHistory('Hazard check configured at ' + toKey(q, r) + ': DD' + dd + ', default ' + normalizedDie + ', fail ' + damage + ' damage.');
    safeNotif('Hazard check configured.', 'good');
    drawBoard();
    updateUiPanels();
    return true;
  }

  function clearHazardCheckConfigAt(q, r) {
    var key = toKey(q, r);
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var rules = ensureCombatSceneRulesExtensions(inner.sceneRules);
      rules.hazardChecks = Object.assign({}, rules.hazardChecks || {});
      delete rules.hazardChecks[key];
      next.sceneRules = rules;
      persist(next);
      return next;
    });
    addHistory('Hazard check cleared at ' + key + '.');
    safeNotif('Hazard check cleared.', 'info');
    drawBoard();
    updateUiPanels();
    return true;
  }

  function getRaidSoulforgeAffixPool() {
    return [
      'Keen', 'Swift', 'Sturdy', 'Brutal', 'Agile', 'Reinforce', 'Fierce', 'Nimble', 'Resilient', 'Balanced', 'Accuracy', 'Range', 'Stealth', 'Piercing', 'Lethal', 'Vicious', 'Silent', 'Distance',
      'Dragon\'s Breath', 'Stormcaller', 'Frostheart', 'Lifedrinker', 'Doombringer', 'Griffin', 'Valkyrie', 'Leviathan', 'Basilisk', 'Djinn', 'Phoenix\'s Resurgence', 'Gorgon\'s Glare', 'Thunderbird\'s Squall', 'Gryphon\'s Roar', 'Behemoth\'s Rage', 'Sphinx\'s Riddle', 'Minotaur\'s Strength', 'Basilisk\'s Venom', 'Pegasus\' Flight', 'Hydra\'s Growth',
      'Eternity\'s Edge', 'Void', 'Celestial', 'Abyssal', 'Primal', 'Ancestral', 'Ghost', 'Soul Eater', 'Arachnid\'s Web', 'Beholder\'s Gaze', 'Unicorn\'s Grace', 'Golem\'s Fist', 'Salamander\'s Flame', 'Roc\'s Wind', 'Basilisk\'s Stare', 'Chimera\'s Chaos', 'Phoenix\'s Ashes', 'Yeti\'s Cold', 'Siren\'s Song', 'Wendigo\'s Hunger'
    ];
  }

  function appendCombatAssetToFolder(folderKey, file, contextLabel, options) {
    if (!file || String(file.type || '').indexOf('image/') !== 0) return false;
    var cfg = options && typeof options === 'object' ? options : {};
    var applyAsBackground = !!cfg.applyAsBackground;
    var placeOnSelection = !!cfg.placeOnSelection;
    var reader = new FileReader();
    var kindLabel = folderKey === 'mapAssets' ? 'map folder' : 'hex folder';
    setCombatAssetUpload({
      name: String(file.name || 'image'),
      kind: folderKey === 'mapAssets' ? 'battlemap-folder' : 'hex-folder',
      loaded: 0,
      total: Math.max(1, Number(file.size || 1)),
      pct: 0,
      status: 'Reading...'
    });
    reader.onprogress = function (ev) {
      var total = Math.max(1, Number(ev && ev.total || file.size || 1));
      var loaded = Math.max(0, Number(ev && ev.loaded || 0));
      setCombatAssetUpload({
        name: String(file.name || 'image'),
        kind: folderKey === 'mapAssets' ? 'battlemap-folder' : 'hex-folder',
        loaded: loaded,
        total: total,
        pct: Math.max(0, Math.min(100, Math.round((loaded / total) * 100))),
        status: 'Uploading...'
      });
    };
    reader.onload = function () {
      var dataUrl = String(reader.result || '');
      if (!dataUrl) {
        safeNotif('Image upload failed.', 'warn');
        return;
      }
      captureUndoSnapshot('Upload ' + (folderKey === 'mapAssets' ? 'Map Asset' : 'Hex Asset'));
      store.setState(function (state) {
        var next = Object.assign({}, state);
        var rules = ensureCombatSceneRulesExtensions(state.sceneRules);
        var entry = {
          id: uid(folderKey === 'mapAssets' ? 'map' : 'hex'),
          name: String(file.name || (folderKey === 'mapAssets' ? 'Uploaded Map' : 'Uploaded Hex')),
          src: dataUrl,
          uploadedAt: Date.now()
        };
        var folder = normalizeCombatAssetFolders(rules.assetFolders || {});
        var rows = Array.isArray(folder[folderKey]) ? folder[folderKey].slice() : [];
        rows.unshift(entry);
        folder[folderKey] = rows.slice(0, folderKey === 'mapAssets' ? 60 : 120);
        rules.assetFolders = folder;
        next.sceneRules = rules;
        if (applyAsBackground && folderKey === 'mapAssets') {
          next.board = Object.assign({}, state.board || {}, { background: dataUrl });
        }
        persist(next);
        return next;
      });
      setCombatAssetUpload({
        name: String(file.name || 'image'),
        kind: folderKey === 'mapAssets' ? 'battlemap-folder' : 'hex-folder',
        loaded: Math.max(1, Number(file.size || 1)),
        total: Math.max(1, Number(file.size || 1)),
        pct: 100,
        status: applyAsBackground && folderKey === 'mapAssets' ? 'Stored + Applied' : 'Stored'
      });
      if (applyAsBackground && folderKey === 'mapAssets') {
        addHistory('Battlemap applied from uploaded map folder: ' + String(file.name || 'image') + '.');
        safeNotif('Battlemap uploaded and applied from ' + String(contextLabel || 'asset dock') + '.', 'good');
      } else {
        addHistory('Asset saved to ' + kindLabel + ': ' + String(file.name || 'image') + '.');
        safeNotif('Asset saved to ' + kindLabel + '. Drag it from the Terrain category onto any hex to place it.', 'good');
        // Pre-warm the sprite cache immediately so first placement renders instantly
        if (folderKey === 'hexAssets') {
          var newState = store.getState();
          var hexRows = newState && newState.sceneRules && newState.sceneRules.assetFolders && newState.sceneRules.assetFolders.hexAssets || [];
          var newestEntry = hexRows[0] || null;
          if (newestEntry && newestEntry.id) {
            getHexAssetSprite(newestEntry);
            if (placeOnSelection) {
              var targetState = store.getState();
              var targetHex = getDefaultAssetDropHex(targetState, targetState && targetState.selectedTokenId, { preferSelection: true });
              applyCombatAssetActionAt('set-tool', 'terrain:hexasset:' + String(newestEntry.id || ''), Number(targetHex.q || 0), Number(targetHex.r || 0), true);
              safeNotif('Uploaded hex placed at ' + toKey(Number(targetHex.q || 0), Number(targetHex.r || 0)) + '.', 'good');
            }
          }
        }
      }
      drawBoard();
      updateUiPanels();
      setTimeout(function () {
        var current = store.getState();
        if (current && current.assetUpload && String(current.assetUpload.name || '') === String(file.name || '')) {
          setCombatAssetUpload(null);
        }
      }, 1200);
    };
    reader.onerror = function () {
      setCombatAssetUpload({
        name: String(file.name || 'image'),
        kind: folderKey === 'mapAssets' ? 'battlemap-folder' : 'hex-folder',
        loaded: 0,
        total: Math.max(1, Number(file.size || 1)),
        pct: 0,
        status: 'Failed'
      });
      safeNotif('Asset upload failed.', 'warn');
    };
    reader.readAsDataURL(file);
    return true;
  }

  function handleCombatBoardDropEvent(ev, canvas, dropSourceLabel) {
    if (!canvas) return false;
    ev.preventDefault();
    var state = store.getState();
    if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length && applyBattlemapDrop(ev.dataTransfer.files)) {
      setCombatDragDebugState({
        phase: 'drop-applied',
        source: 'file-drop',
        dropSource: String(dropSourceLabel || 'board')
      });
      return true;
    }
    var rect = canvas.getBoundingClientRect();
    var size = Number(state.board.size || 42) * Number(state.board.zoom || 1);
    var insideCanvas = Number(ev.clientX || 0) >= rect.left && Number(ev.clientX || 0) <= rect.right && Number(ev.clientY || 0) >= rect.top && Number(ev.clientY || 0) <= rect.bottom;
    var ax = insideCanvas
      ? pixelToAxial(ev.clientX - rect.left, ev.clientY - rect.top, size, state.board.panX, state.board.panY)
      : pixelToAxial(Number(rect.width || 0) / 2, Number(rect.height || 0) / 2, size, state.board.panX, state.board.panY);
    var targetHex = getDefaultAssetDropHex(state, state && state.selectedTokenId, { preferSelection: true });
    var source = 'none';
    var assetKind = String(ev.dataTransfer && ev.dataTransfer.getData('text/combat-asset-kind') || '');
    var assetPayload = String(ev.dataTransfer && ev.dataTransfer.getData('text/combat-asset-payload') || '');
    if (assetKind) source = 'dataTransfer';
    if (!assetKind) {
      var textPayload = String(ev.dataTransfer && ev.dataTransfer.getData('text/plain') || '');
      var colonIndex = textPayload.indexOf(':');
      if (colonIndex > 0) {
        assetKind = textPayload.slice(0, colonIndex).trim();
        assetPayload = textPayload.slice(colonIndex + 1);
        source = 'text/plain';
      }
    }
    if (!assetKind && window.__combatAssetDragPayload && typeof window.__combatAssetDragPayload === 'object') {
      assetKind = String(window.__combatAssetDragPayload.kind || '');
      assetPayload = String(window.__combatAssetDragPayload.payload || '');
      source = 'active payload';
    }
    if (!assetKind && window.__combatAssetDragPayloadLastKnown && typeof window.__combatAssetDragPayloadLastKnown === 'object') {
      var ageMs = Date.now() - Number(window.__combatAssetDragPayloadLastKnown.at || 0);
      if (ageMs >= 0 && ageMs < 15000) {
        assetKind = String(window.__combatAssetDragPayloadLastKnown.kind || '');
        assetPayload = String(window.__combatAssetDragPayloadLastKnown.payload || '');
        source = 'last-known payload';
      }
    }
    if (!assetKind && window.__combatAssetDockDescriptor && typeof window.__combatAssetDockDescriptor === 'object') {
      var dockAgeMs = Date.now() - Number(window.__combatAssetDockDescriptor.at || 0);
      if (dockAgeMs >= 0 && dockAgeMs < 15000) {
        assetKind = String(window.__combatAssetDockDescriptor.kind || '');
        assetPayload = String(window.__combatAssetDockDescriptor.payload || '');
        source = 'dock-descriptor';
      }
    }
    setCombatDragDebugState({
      phase: 'drop-received',
      kind: assetKind,
      payload: assetPayload,
      source: source,
      dropSource: String(dropSourceLabel || 'board'),
      clientX: Number(ev.clientX || 0),
      clientY: Number(ev.clientY || 0),
      q: Number(ax.q || 0),
      r: Number(ax.r || 0)
    });
    if (assetKind) {
      var dropQ = insideCanvas ? Number(ax.q || 0) : Number(targetHex && targetHex.q || 0);
      var dropR = insideCanvas ? Number(ax.r || 0) : Number(targetHex && targetHex.r || 0);
      if (typeof window.applyCombatAssetActionAt === 'function') {
        window.applyCombatAssetActionAt(assetKind, assetPayload, dropQ, dropR, true);
      }
      setCombatDragDebugState({ phase: 'drop-applied', q: dropQ, r: dropR, source: source, dropSource: String(dropSourceLabel || 'board') });
      window.__combatAssetDragPayload = null;
      clearCombatAssetDragPreview();
      return true;
    }
    var bestiaryId = String(ev.dataTransfer && ev.dataTransfer.getData('text/combat-bestiary-id') || '');
    if (bestiaryId) {
      var profile = (state.codexBestiary || []).find(function (entry) { return String(entry.id) === bestiaryId; }) || null;
      if (profile) {
        spawnBestiaryToken(profile, ax.q, ax.r);
        setCombatDragDebugState({ phase: 'drop-applied', source: 'bestiary-id' });
        clearCombatAssetDragPreview();
        return true;
      }
    }
    setCombatDragDebugState({ phase: 'drop-ignored' });
    window.__combatAssetDragPayload = null;
    clearCombatAssetDragPreview();
    return false;
  }
  var COMBAT_TUTORIAL_KEY = KEY + '-tutorial';
  var COMBAT_UI_DEFAULTS = {
    motionMode: 'full',
    themePreset: 'obsidian',
    themeTokens: {},
    compactMode: 'auto',
    qualityMode: 'auto',
    dragDebugBanner: false,
    tutorialSeen: false,
    tutorialStep: 0,
    assetDrawerOpen: true
  };
  var tokenMotionCache = {};
  var tokenSpriteCache = {};
  var hexAssetSpriteCache = {}; // keyed by hex asset id, not data URL
  var drawFramePending = false;

  function getHexAssetSprite(assetEntry) {
    if (!assetEntry || !assetEntry.id || !assetEntry.src) return null;
    var id = String(assetEntry.id || '').toLowerCase();
    var cached = hexAssetSpriteCache[id];
    if (cached) return cached;
    var image = new Image();
    cached = hexAssetSpriteCache[id] = { image: image, loaded: false, errored: false };
    image.onload = function () { cached.loaded = true; drawBoard(); };
    image.onerror = function () { cached.errored = true; drawBoard(); };
    image.src = String(assetEntry.src);
    return cached;
  }

  function invalidateHexAssetSprite(assetId) {
    var id = String(assetId || '').toLowerCase();
    if (hexAssetSpriteCache[id]) delete hexAssetSpriteCache[id];
  }

  function normalizeCombatUi(ui) {
    var next = Object.assign({}, COMBAT_UI_DEFAULTS, ui && typeof ui === 'object' ? ui : {});
    try {
      var raw = localStorage.getItem(COMBAT_TUTORIAL_KEY);
      if (raw) {
        var persistedTutorial = JSON.parse(raw);
        if (persistedTutorial && typeof persistedTutorial === 'object') {
          if (typeof persistedTutorial.seen !== 'undefined') next.tutorialSeen = !!persistedTutorial.seen;
          if (typeof persistedTutorial.step !== 'undefined') next.tutorialStep = Number(persistedTutorial.step || 0);
        }
      }
    } catch (_err) {}
    var presetKey = String(next.themePreset || 'obsidian');
    if (!COMBAT_THEME_PRESETS[presetKey]) presetKey = 'obsidian';
    next.themePreset = presetKey;
    var mode = String(next.motionMode || 'full');
    if (['full', 'reduced', 'off'].indexOf(mode) < 0) mode = 'full';
    next.motionMode = mode;
    next.themeTokens = next.themeTokens && typeof next.themeTokens === 'object' ? Object.assign({}, next.themeTokens) : {};
    var compact = String(next.compactMode || 'auto');
    if (['auto', 'off', 'on'].indexOf(compact) < 0) compact = 'auto';
    next.compactMode = compact;
    var quality = String(next.qualityMode || 'auto');
    if (['auto', 'full', 'performance'].indexOf(quality) < 0) quality = 'auto';
    next.qualityMode = quality;
    next.dragDebugBanner = !!next.dragDebugBanner;
    next.tutorialSeen = !!next.tutorialSeen;
    next.tutorialStep = Math.max(0, Math.min(6, Number(next.tutorialStep || 0)));
    next.assetDrawerOpen = typeof next.assetDrawerOpen === 'boolean' ? next.assetDrawerOpen : true;
    return next;
  }

  function getCombatThemeTokens(ui) {
    var normalized = normalizeCombatUi(ui);
    var preset = Object.assign({}, COMBAT_THEME_PRESETS[normalized.themePreset] || COMBAT_THEME_PRESETS.obsidian);
    if (normalized.themeTokens.accent) preset.accent = String(normalized.themeTokens.accent);
    if (normalized.themeTokens.accent2) preset.accent2 = String(normalized.themeTokens.accent2);
    if (normalized.themeTokens.surface) preset.surface = String(normalized.themeTokens.surface);
    if (normalized.themeTokens.text) preset.text = String(normalized.themeTokens.text);
    if (normalized.themeTokens.fog) preset.fog = String(normalized.themeTokens.fog);
    if (normalized.themeTokens.ping) preset.ping = String(normalized.themeTokens.ping);
    if (normalized.themeTokens.danger) preset.danger = String(normalized.themeTokens.danger);
    return preset;
  }

  function getCombatMotionMode(state) {
    return String(state && state.ui && state.ui.motionMode || COMBAT_UI_DEFAULTS.motionMode);
  }

  function shouldAnimateCombatMotion(state) {
    return getCombatMotionMode(state) !== 'off';
  }

  function getCombatMotionDuration(state, fullMs, reducedMs) {
    var mode = getCombatMotionMode(state);
    if (mode === 'off') return 0;
    if (mode === 'reduced') return Number(reducedMs || Math.max(40, Math.round(Number(fullMs || 0) * 0.5)));
    return Number(fullMs || 0);
  }

  function applyCombatUiState(state) {
    var root = document.getElementById('combatModeOverlay');
    if (!root) return;
    var ui = normalizeCombatUi(state && state.ui);
    var theme = getCombatThemeTokens(ui);
    var compact = shouldUseCompactUi({ ui: ui }) ? 'on' : 'off';
    var quality = resolveRenderQualityMode({ ui: ui }, ((state && state.tokens) || []).length);
    root.setAttribute('data-theme', ui.themePreset);
    root.setAttribute('data-motion', ui.motionMode);
    root.setAttribute('data-compact', compact);
    root.setAttribute('data-quality', quality);
    root.style.setProperty('--combat-accent', theme.accent);
    root.style.setProperty('--combat-accent-2', theme.accent2);
    root.style.setProperty('--combat-surface', theme.surface);
    root.style.setProperty('--combat-text', theme.text);
    root.style.setProperty('--combat-muted', theme.muted);
    root.style.setProperty('--combat-border', theme.border);
    root.style.setProperty('--combat-danger', theme.danger);
    root.style.setProperty('--combat-fog', theme.fog);
    root.style.setProperty('--combat-ping', theme.ping);
    root.style.setProperty('--combat-bg-start', theme.bgStart);
    root.style.setProperty('--combat-bg-end', theme.bgEnd);
    renderCombatDragDebugBanner(state);
  }

  function triggerPageTransition(pageElement) {
    if (!pageElement) return;
    var duration = getCombatMotionDuration(window.CombatSceneStore && window.CombatSceneStore.getState && window.CombatSceneStore.getState(), 180, 90);
    pageElement.classList.remove('page-transition', 'active');
    if (!duration) return;
    pageElement.classList.add('page-transition');
    setTimeout(function () {
      pageElement.classList.add('active');
    }, 20);
    setTimeout(function () {
      pageElement.classList.remove('page-transition', 'active');
    }, duration + 60);
  }
  var RECOVERY_MAX = 3;
  var RECOVERY_MIN_INTERVAL_MS = 4000;
  var SQRT3 = Math.sqrt(3);
  var lastRecoveryPersistAt = 0;
  var lastRecoveryHash = '';
  var campaignSceneSyncTimer = null;
  var lastCampaignSceneSyncHash = '';

  function safeNotif(msg, tone) {
    if (typeof window.showNotif === 'function') window.showNotif(msg, tone || 'info');
    announceCombatEvent(msg);
  }

  function announceCombatEvent(msg) {
    var live = document.getElementById('combatAriaLive');
    if (!live) return;
    live.textContent = '';
    live.textContent = String(msg || '');
  }

  function shouldUseCompactUi(state) {
    var mode = String(state && state.ui && state.ui.compactMode || 'auto');
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    if (typeof window === 'undefined') return false;
    return window.matchMedia ? !!window.matchMedia('(max-width: 840px)').matches : window.innerWidth <= 840;
  }

  function resolveRenderQualityMode(state, tokenCount) {
    var mode = String(state && state.ui && state.ui.qualityMode || 'auto');
    if (mode === 'full' || mode === 'performance') return mode;
    return Number(tokenCount || 0) >= 100 ? 'performance' : 'full';
  }

  function getTokenSprite(src) {
    var key = String(src || '').trim();
    if (!key) return null;
    var cached = tokenSpriteCache[key];
    if (cached && cached.image) return cached;
    var image = new Image();
    cached = tokenSpriteCache[key] = { image: image, loaded: false, errored: false };
    image.onload = function () {
      cached.loaded = true;
      drawBoard();
    };
    image.onerror = function () {
      cached.errored = true;
    };
    image.src = key;
    return cached;
  }

  function formatClockTime(value) {
    var t = Number(value || 0);
    if (!t) return '--:--';
    try {
      return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_err) {
      return '--:--';
    }
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function deepCloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return null;
    }
  }

  function uid(prefix) {
    return String(prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 9999).toString(36);
  }

  function createStore(initial) {
    var state = initial;
    var listeners = [];
    return {
      getState: function () { return state; },
      setState: function (patch) {
        var next = typeof patch === 'function' ? patch(state) : patch;
        state = Object.assign({}, state, next || {});
        listeners.slice().forEach(function (fn) { fn(state); });
      },
      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          listeners = listeners.filter(function (entry) { return entry !== fn; });
        };
      }
    };
  }

  function togglePanel(panelId) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.toggle('collapsed');
    store.setState(function (state) {
      var collapsed = state.collapsedPanels || {};
      collapsed[panelId] = !collapsed[panelId];
      return { collapsedPanels: collapsed };
    });
  }

  // Header onclick handlers are inline in overlay markup.
  if (typeof window !== 'undefined') {
    window.togglePanel = togglePanel;
  }

  function hexLabel(distance) {
    var d = Math.max(0, Number(distance || 0));
    if (d <= 1) return 'Engaged';
    if (d === 2) return 'Close';
    if (d === 3) return 'Nearby';
    if (d === 4) return 'Far';
    return 'Out of Range';
  }

  function slug(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  var ALLOWED_DREAD_DICE = [4, 6, 8, 10, 12, 20];

  function normalizeDreadDie(value) {
    var val = Number(value || 0);
    if (!isFinite(val) || val <= 0) return 6;
    var best = ALLOWED_DREAD_DICE[0];
    var bestDiff = Math.abs(val - best);
    for (var i = 1; i < ALLOWED_DREAD_DICE.length; i++) {
      var die = ALLOWED_DREAD_DICE[i];
      var diff = Math.abs(val - die);
      if (diff < bestDiff || (diff === bestDiff && die > best)) {
        best = die;
        bestDiff = diff;
      }
    }
    return best;
  }

  function stripHtml(text) {
    return String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function flattenCodexBestiary() {
    var out = [];
    if (typeof NAMED_ENEMY_BESTIARY === 'object' && NAMED_ENEMY_BESTIARY) {
      Object.keys(NAMED_ENEMY_BESTIARY).forEach(function (region) {
        var list = NAMED_ENEMY_BESTIARY[region];
        if (!Array.isArray(list)) return;
        list.forEach(function (entry) {
          if (!entry) return;
          var dread = normalizeDreadDie(entry.dread || (Number(entry.health || entry.hp || 0) / 2));
          out.push({
            id: slug(region + '-' + (entry.name || 'beast')),
            region: String(region),
            name: String(entry.name || 'Unknown Beast'),
            desc: String(entry.desc || ''),
            dread: dread,
            hp: dread * 2,
            image: String(entry.image || ''),
            skills: Array.isArray(entry.skills) ? entry.skills.slice() : [],
            abilities: Array.isArray(entry.abilities) ? entry.abilities.slice() : [],
            moves: Array.isArray(entry.moves) ? entry.moves.slice() : [],
            tactic: String(entry.tactic || '')
          });
        });
      });
    }
    return out;
  }

  function hexDistance(a, b) {
    var aq = Number(a && a.q || 0);
    var ar = Number(a && a.r || 0);
    var bq = Number(b && b.q || 0);
    var br = Number(b && b.r || 0);
    return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs((aq + ar) - (bq + br)));
  }

  function getWeatherModifier(state, mode) {
    var name = String(state && state.board && state.board.weatherOverlay || 'none');
    var intensity = Math.max(0, Number(state && state.board && state.board.weatherIntensity || 0));
    if (name === 'none' || !intensity) return 0;
    if (mode === 'movement') {
      if (name === 'rain' || name === 'ash') return -Math.ceil(intensity / 2);
      if (name === 'storm') return -intensity;
      if (name === 'fog') return -Math.ceil(intensity / 2);
    }
    if (mode === 'ranged') {
      if (name === 'fog') return -intensity;
      if (name === 'storm') return -Math.ceil(intensity / 2);
    }
    if (mode === 'melee') {
      if (name === 'rain') return -Math.floor(intensity / 2);
      if (name === 'ash') return -Math.floor(intensity / 2);
    }
    return 0;
  }

  function layerTextValue(state, layerName, q, r) {
    return String(state && state.layers && state.layers[layerName] && state.layers[layerName][toKey(q, r)] || '').toLowerCase();
  }

  function getLayerGameplayProfile(state, q, r) {
    var terrain = layerTextValue(state, 'terrain', q, r);
    var object = layerTextValue(state, 'objects', q, r);
    var hazard = layerTextValue(state, 'hazards', q, r);
    var lighting = layerTextValue(state, 'lighting', q, r);
    var weather = layerTextValue(state, 'weather', q, r);
    var foreground = layerTextValue(state, 'foreground', q, r);
    var interactive = layerTextValue(state, 'interactives', q, r);
    var spawn = layerTextValue(state, 'spawns', q, r);

    var moveTax = 0;
    var cover = 0;
    var rangedMod = 0;
    var meleeMod = 0;
    var defendMod = 0;
    var blockMove = false;
    var blockLos = false;
    var hazardDamage = 0;

    if (/obstacle|wall|vision-blocker|collapsed|barrier/.test(object + ' ' + lighting + ' ' + foreground)) blockMove = true;
    if (/lava|chasm|void|pit/.test(terrain)) blockMove = true;

    if (/difficult|marsh|water|mud|snow|rubble|ash/.test(terrain + ' ' + weather)) moveTax += 1;
    if (/web|tangle|wreckage|debris/.test(object + ' ' + foreground)) moveTax += 1;

    if (/forest|ruins|crags|marsh|balcony|tree-canopy|high-ledge/.test(terrain + ' ' + object + ' ' + foreground)) cover += 1;
    if (/obstacle|door|turret|crate|pillar|barrier/.test(object)) cover += 1;

    if (/vision-blocker|wall|smoke|fog/.test(lighting + ' ' + weather + ' ' + foreground)) blockLos = true;
    if (/smoke|fog|ash|storm/.test(weather + ' ' + foreground)) rangedMod -= 1;

    if (/water|mud|marsh/.test(terrain)) meleeMod -= 1;
    if (/shrine|relay|cover-node/.test(interactive)) defendMod += 1;

    if (/trap|fire|acid|radiation|shock|lava/.test(hazard + ' ' + terrain)) hazardDamage = Math.max(1, /lava|fire|acid/.test(hazard + ' ' + terrain) ? 2 : 1);
    if (/spawn|ambush/.test(spawn) && /trap|mine/.test(hazard)) hazardDamage = Math.max(hazardDamage, 2);

    return {
      moveTax: Math.max(0, moveTax),
      cover: cover,
      rangedMod: rangedMod,
      meleeMod: meleeMod,
      defendMod: defendMod,
      blockMove: blockMove,
      blockLos: blockLos,
      hazardDamage: hazardDamage,
      interactive: interactive
    };
  }

  function getUploadedHexAssetById(state, assetId) {
    var id = String(assetId || '').toLowerCase();
    if (!id) return null;
    var rules = ensureCombatSceneRulesExtensions(state && state.sceneRules || {});
    var rows = rules.assetFolders && Array.isArray(rules.assetFolders.hexAssets) ? rules.assetFolders.hexAssets : [];
    for (var i = 0; i < rows.length; i++) {
      var entry = rows[i];
      if (!entry) continue;
      if (String(entry.id || '').toLowerCase() === id) return entry;
    }
    return null;
  }

  function isHexRevealed(state, q, r) {
    if (!state.fog || !state.fog.enabled) return true;
    var key = toKey(q, r);
    var visible = !!(state.fog.revealed && state.fog.revealed[key]);
    if (String(state.fog.revealMode || 'manual') === 'ordered') {
      var order = Number(state.fog.revealOrder && state.fog.revealOrder[key] || 0);
      var step = Math.max(0, Number(state.fog.revealStep || 0));
      if (order > 0 && order <= step) visible = true;
    }
    var selected = byId(state.selectedTokenId);
    if (!selected) return visible;
    var radius = Math.max(0, Number(state.fog.visionRadius || 0));
    if (!radius) return visible;
    var inVision = hexDistance({ q: q, r: r }, { q: selected.q, r: selected.r }) <= radius;
    if (inVision && String(state.fog.revealMode || 'manual') === 'los') {
      return !isSightBlocked(state, { q: Number(selected.q || 0), r: Number(selected.r || 0) }, { q: q, r: r }) || visible;
    }
    if (inVision && String(state.fog.revealMode || 'manual') !== 'ordered') return true;
    return visible;
  }

  function getLayerSetting(state, layerName) {
    var row = state && state.layerSettings && state.layerSettings[layerName] ? state.layerSettings[layerName] : null;
    return {
      visible: !row || row.visible !== false,
      locked: !!(row && row.locked),
      opacity: Math.max(0.1, Math.min(1, Number(row && row.opacity == null ? 1 : row && row.opacity))),
      gmOnly: !!(row && row.gmOnly)
    };
  }

  function isLayerVisible(state, layerName) {
    var row = getLayerSetting(state, layerName);
    if (!row.visible) return false;
    if (row.gmOnly && state && state.playMode) return false;
    return true;
  }

  function isLayerLocked(state, layerName) {
    return !!getLayerSetting(state, layerName).locked;
  }

  function getLayerOpacity(state, layerName) {
    return Number(getLayerSetting(state, layerName).opacity || 1);
  }

  function clampTokenOffset(value, size) {
    var limit = Math.max(8, Number(size || 42) * 0.72);
    return Math.max(-limit, Math.min(limit, Number(value || 0)));
  }

  function getTokenRenderPoint(token, size, panX, panY) {
    var center = axialToPixel(Number(token && token.q || 0), Number(token && token.r || 0), size, panX, panY);
    return {
      x: center.x + Number(token && token.offsetX || 0),
      y: center.y + Number(token && token.offsetY || 0)
    };
  }

  function getVisionSourceTokens(state) {
    var list = Array.isArray(state && state.tokens) ? state.tokens.filter(Boolean) : [];
    if (!list.length) return [];
    if (state && state.fog && state.fog.sharedVision) {
      var shared = list.filter(function (token) {
        return token && (token.isPlayer || String(token.faction || '') === 'player' || String(token.faction || '') === 'ally');
      });
      if (shared.length) return shared;
    }
    var selected = byId(state && state.selectedTokenId);
    if (selected) return [selected];
    return list.slice(0, 1);
  }

  function isHexInTokenVision(state, token, q, r) {
    if (!token) return false;
    var radius = Math.max(0, Number(token.visionRadius == null ? state.fog && state.fog.visionRadius || 0 : token.visionRadius));
    if (!radius) return false;
    var origin = { q: Number(token.q || 0), r: Number(token.r || 0) };
    var target = { q: Number(q || 0), r: Number(r || 0) };
    if (hexDistance(origin, target) > radius) return false;
    if (String(token.visionShape || 'radius') === 'cone') {
      var a = axialToPixel(origin.q, origin.r, 1, 0, 0);
      var b = axialToPixel(target.q, target.r, 1, 0, 0);
      var facing = (Number(token.rotation || 0) % 360) * (Math.PI / 180);
      var angle = Math.atan2(b.y - a.y, b.x - a.x);
      var delta = Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing));
      if (Math.abs(delta) > Math.PI / 3) return false;
    }
    if (String(state.fog && state.fog.revealMode || 'manual') === 'los') {
      return !isSightBlocked(state, origin, target);
    }
    return true;
  }

  function getFogVisionMap(state) {
    var current = {};
    var seen = Object.assign({}, state && state.fog && state.fog.seen || {}, state && state.fog && state.fog.revealed || {});
    if (!state || !state.fog || !state.fog.enabled) return { current: current, seen: seen };
    var sources = getVisionSourceTokens(state);
    for (var r = -Number(state.board && state.board.rows || 0); r <= Number(state.board && state.board.rows || 0); r++) {
      for (var q = -Number(state.board && state.board.cols || 0); q <= Number(state.board && state.board.cols || 0); q++) {
        var key = toKey(q, r);
        var manualVisible = !!(state.fog.revealed && state.fog.revealed[key]);
        if (String(state.fog.revealMode || 'manual') === 'ordered') {
          var order = Number(state.fog.revealOrder && state.fog.revealOrder[key] || 0);
          var step = Math.max(0, Number(state.fog.revealStep || 0));
          if (order > 0 && order <= step) manualVisible = true;
        }
        var dynamicVisible = sources.some(function (token) { return isHexInTokenVision(state, token, q, r); });
        if (manualVisible || dynamicVisible) current[key] = true;
        if (seen[key] || (state.fog.explorerMode && current[key])) seen[key] = true;
      }
    }
    return { current: current, seen: seen };
  }

  function syncFogExplorerMemory(state) {
    if (!state || !state.fog || !state.fog.enabled || !state.fog.explorerMode) return state;
    var vision = getFogVisionMap(state);
    var keys = Object.keys(vision.current || {});
    if (!keys.length) return state;
    var seen = Object.assign({}, state.fog.seen || {});
    var revealed = Object.assign({}, state.fog.revealed || {});
    var changed = false;
    keys.forEach(function (key) {
      if (!seen[key]) {
        seen[key] = true;
        changed = true;
      }
      if (!revealed[key]) {
        revealed[key] = true;
        changed = true;
      }
    });
    if (!changed) return state;
    state.fog = Object.assign({}, state.fog, { seen: seen, revealed: revealed });
    return state;
  }

  function toKey(q, r) {
    return String(q) + ',' + String(r);
  }

  function axialToPixel(q, r, size, panX, panY) {
    return {
      x: size * (SQRT3 * q + (SQRT3 / 2) * r) + panX,
      y: size * (1.5 * r) + panY
    };
  }

  function pixelToAxial(x, y, size, panX, panY) {
    var px = x - panX;
    var py = y - panY;
    var q = (SQRT3 / 3 * px - 1 / 3 * py) / size;
    var r = (2 / 3 * py) / size;
    var rounded = cubeRound(q, r);
    return { q: rounded.q, r: rounded.r };
  }

  function cubeRound(q, r) {
    var x = q;
    var z = r;
    var y = -x - z;
    var rx = Math.round(x);
    var ry = Math.round(y);
    var rz = Math.round(z);
    var xDiff = Math.abs(rx - x);
    var yDiff = Math.abs(ry - y);
    var zDiff = Math.abs(rz - z);

    if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
    else if (yDiff > zDiff) ry = -rx - rz;
    else rz = -rx - ry;

    return { q: rx, r: rz };
  }

  function WALL_DIRECTIONS() {
    return [
      { key: 'e', dq: 1, dr: 0, edge: [0, 1] },
      { key: 'ne', dq: 1, dr: -1, edge: [5, 0] },
      { key: 'nw', dq: 0, dr: -1, edge: [4, 5] },
      { key: 'w', dq: -1, dr: 0, edge: [3, 4] },
      { key: 'sw', dq: -1, dr: 1, edge: [2, 3] },
      { key: 'se', dq: 0, dr: 1, edge: [1, 2] }
    ];
  }

  function oppositeWallDirection(key) {
    var map = { e: 'w', ne: 'sw', nw: 'se', w: 'e', sw: 'ne', se: 'nw' };
    return map[String(key || '')] || '';
  }

  function wallDirectionBetween(a, b) {
    var dq = Number(b && b.q || 0) - Number(a && a.q || 0);
    var dr = Number(b && b.r || 0) - Number(a && a.r || 0);
    var dirs = WALL_DIRECTIONS();
    for (var i = 0; i < dirs.length; i++) {
      if (dirs[i].dq === dq && dirs[i].dr === dr) return dirs[i].key;
    }
    return '';
  }

  function axialLerp(a, b, t) {
    return {
      q: Number(a.q || 0) + (Number(b.q || 0) - Number(a.q || 0)) * t,
      r: Number(a.r || 0) + (Number(b.r || 0) - Number(a.r || 0)) * t
    };
  }

  function axialLine(a, b) {
    var dist = Math.max(1, hexDistance(a, b));
    var out = [];
    for (var i = 0; i <= dist; i++) {
      var t = i / dist;
      var lerped = axialLerp(a, b, t);
      out.push(cubeRound(lerped.q, lerped.r));
    }
    return out;
  }

  function hasSegmentWallBetween(state, fromHex, toHex) {
    var dir = wallDirectionBetween(fromHex, toHex);
    if (!dir) return false;
    var segs = state && state.layers && state.layers.wallSegments ? state.layers.wallSegments : {};
    var aKey = toKey(fromHex.q, fromHex.r);
    var bKey = toKey(toHex.q, toHex.r);
    var aSeg = segs[aKey] || {};
    var bSeg = segs[bKey] || {};
    if (aSeg[dir]) return true;
    var opp = oppositeWallDirection(dir);
    if (opp && bSeg[opp]) return true;
    return false;
  }

  function isSightBlocked(state, fromHex, toHex) {
    if (!state || !state.layers) return false;
    var line = axialLine(fromHex, toHex);
    for (var i = 1; i < line.length; i++) {
      var prev = line[i - 1];
      var cur = line[i];
      if (hasSegmentWallBetween(state, prev, cur)) return true;
      if (i < line.length - 1) {
        var key = toKey(cur.q, cur.r);
        var mark = String(state.layers.lighting && state.layers.lighting[key] || '').toLowerCase();
        if (mark === 'wall' || mark === 'vision-blocker' || mark === 'opaque') return true;
      }
    }
    return false;
  }

  function combatRandInt(min, max) {
    var lo = Math.min(Number(min || 0), Number(max || 0));
    var hi = Math.max(Number(min || 0), Number(max || 0));
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function combatPickOne(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return list[combatRandInt(0, list.length - 1)];
  }

  function combatShuffle(list) {
    var out = Array.isArray(list) ? list.slice() : [];
    for (var i = out.length - 1; i > 0; i -= 1) {
      var j = combatRandInt(0, i);
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function createEmptySceneLayers() {
    return {
      terrain: {},
      objects: {},
      hazards: {},
      elevation: {},
      lighting: {},
      wallSegments: {},
      weather: {},
      foreground: {},
      interactives: {},
      spawns: {},
      labels: {}
    };
  }

  function sceneInBounds(cols, rows, q, r) {
    return q >= 0 && r >= 0 && q < cols && r < rows;
  }

  function sceneNeighborHexes(q, r) {
    return [
      { q: q + 1, r: r },
      { q: q + 1, r: r - 1 },
      { q: q, r: r - 1 },
      { q: q - 1, r: r },
      { q: q - 1, r: r + 1 },
      { q: q, r: r + 1 }
    ];
  }

  function seedCellValue(bucket, key, value) {
    if (!bucket || !key) return;
    if (bucket[key]) return;
    bucket[key] = String(value || '');
  }

  function carveHexDisk(layers, cols, rows, centerQ, centerR, radius, terrainValue) {
    for (var dq = -radius; dq <= radius; dq += 1) {
      for (var dr = -radius; dr <= radius; dr += 1) {
        var q = centerQ + dq;
        var r = centerR + dr;
        if (!sceneInBounds(cols, rows, q, r)) continue;
        if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) > radius) continue;
        layers.terrain[toKey(q, r)] = String(terrainValue || 'ruins');
      }
    }
  }

  function paintHexLine(layers, start, finish, terrainValue) {
    var line = axialLine(start, finish);
    line.forEach(function (hex) {
      var key = toKey(hex.q, hex.r);
      layers.terrain[key] = String(terrainValue || 'road');
    });
    return line;
  }

  function generateProceduralDungeon(board) {
    var cols = Math.max(12, Number(board.cols || 18));
    var rows = Math.max(12, Number(board.rows || 14));
    var layers = createEmptySceneLayers();
    var roomTypes = [
      { label: 'Antechamber', terrain: 'ruins', object: 'door', interactive: 'console' },
      { label: 'Barracks', terrain: 'difficult terrain', object: 'obstacle', interactive: 'loot-cache' },
      { label: 'Shrine', terrain: 'ruins', object: 'altar', interactive: 'shrine' },
      { label: 'Vault', terrain: 'crags', object: 'pillar', interactive: 'chest' },
      { label: 'Forge', terrain: 'lava', object: 'obstacle', interactive: 'switch' }
    ];
    var roomCount = combatRandInt(6, 10);
    var roomCenters = [];

    for (var attempts = 0; attempts < 180 && roomCenters.length < roomCount; attempts += 1) {
      var q = combatRandInt(1, cols - 2);
      var r = combatRandInt(1, rows - 2);
      var crowded = roomCenters.some(function (room) {
        return hexDistance({ q: room.q, r: room.r }, { q: q, r: r }) < 3;
      });
      if (crowded) continue;
      roomCenters.push({ q: q, r: r, radius: combatRandInt(1, 2), grammar: roomTypes[roomCenters.length % roomTypes.length] });
    }

    roomCenters.forEach(function (room) {
      carveHexDisk(layers, cols, rows, room.q, room.r, room.radius, room.grammar.terrain);
      seedCellValue(layers.objects, toKey(room.q, room.r), room.grammar.object);
      seedCellValue(layers.interactives, toKey(room.q, room.r), room.grammar.interactive);
      layers.labels[toKey(room.q, room.r)] = String(room.grammar.label || 'Room');
    });

    var corridorCells = {};
    for (var i = 1; i < roomCenters.length; i += 1) {
      var line = paintHexLine(layers, roomCenters[i - 1], roomCenters[i], 'ruins');
      line.forEach(function (hex) {
        corridorCells[toKey(hex.q, hex.r)] = true;
      });
    }

    // Loop heuristics: add extra links between non-adjacent rooms to avoid linear hallways.
    var extraLoops = Math.max(1, Math.floor(roomCenters.length / 3));
    for (var loop = 0; loop < extraLoops; loop += 1) {
      if (roomCenters.length < 3) break;
      var a = roomCenters[combatRandInt(0, roomCenters.length - 1)];
      var b = roomCenters[combatRandInt(0, roomCenters.length - 1)];
      if (!a || !b || (a.q === b.q && a.r === b.r) || hexDistance(a, b) < 4) continue;
      var loopLine = paintHexLine(layers, a, b, 'ruins');
      loopLine.forEach(function (hex) {
        corridorCells[toKey(hex.q, hex.r)] = true;
      });
    }

    var corridorKeys = Object.keys(corridorCells);
    combatShuffle(corridorKeys).slice(0, combatRandInt(3, 6)).forEach(function (key) {
      layers.objects[key] = layers.objects[key] || 'door';
    });
    combatShuffle(corridorKeys).slice(0, combatRandInt(2, 4)).forEach(function (key) {
      layers.hazards[key] = 'trap';
    });

    var sortedRooms = roomCenters.slice().sort(function (a, b) {
      return Number(a.q + a.r) - Number(b.q + b.r);
    });
    if (sortedRooms[0]) layers.spawns[toKey(sortedRooms[0].q, sortedRooms[0].r)] = 'spawn';
    if (sortedRooms[sortedRooms.length - 1]) layers.spawns[toKey(sortedRooms[sortedRooms.length - 1].q, sortedRooms[sortedRooms.length - 1].r)] = 'spawn';

    return {
      board: { cols: cols, rows: rows },
      layers: layers,
      fog: { enabled: true, revealed: {} },
      label: 'dungeon procedural',
      editor: { layer: 'objects', tool: 'paint', paintValue: 'door' }
    };
  }

  function generateProceduralTown(board) {
    var cols = Math.max(12, Number(board.cols || 18));
    var rows = Math.max(10, Number(board.rows || 14));
    var layers = createEmptySceneLayers();
    var districts = [
      { name: 'Market', terrain: 'road', object: 'crate', interactive: 'chest' },
      { name: 'Docks', terrain: 'water', object: 'obstacle', interactive: 'switch' },
      { name: 'Temple', terrain: 'ruins', object: 'door', interactive: 'shrine' },
      { name: 'Barracks', terrain: 'cobblestone', object: 'turret', interactive: 'console' },
      { name: 'Residences', terrain: 'difficult terrain', object: 'obstacle', interactive: 'loot-cache' }
    ];

    var seeds = [];
    districts.forEach(function (district, idx) {
      var angle = (Math.PI * 2 * idx) / districts.length;
      var q = Math.round((cols / 2) + Math.cos(angle) * (cols * 0.28));
      var r = Math.round((rows / 2) + Math.sin(angle) * (rows * 0.24));
      seeds.push({ q: Math.max(1, Math.min(cols - 2, q)), r: Math.max(1, Math.min(rows - 2, r)), district: district });
    });

    for (var q = 0; q < cols; q += 1) {
      for (var r = 0; r < rows; r += 1) {
        var key = toKey(q, r);
        var nearest = null;
        var nearestDist = Infinity;
        seeds.forEach(function (seed) {
          var dist = hexDistance({ q: q, r: r }, seed);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = seed;
          }
        });
        if (!nearest) continue;
        layers.terrain[key] = nearestDist <= 1 ? nearest.district.terrain : (Math.random() < 0.75 ? nearest.district.terrain : 'road');
        if (nearestDist <= 1 && Math.random() < 0.28) layers.objects[key] = nearest.district.object;
        if (nearestDist <= 1 && Math.random() < 0.14) layers.interactives[key] = nearest.district.interactive;
      }
    }

    // Road graph rules: connect every district seed to central plaza + nearest neighbor.
    var center = { q: Math.round(cols / 2), r: Math.round(rows / 2) };
    seeds.forEach(function (seed) {
      paintHexLine(layers, seed, center, 'road');
      var nearestPeer = null;
      var nearestPeerDist = Infinity;
      seeds.forEach(function (peer) {
        if (peer === seed) return;
        var dist = hexDistance(seed, peer);
        if (dist < nearestPeerDist) {
          nearestPeerDist = dist;
          nearestPeer = peer;
        }
      });
      if (nearestPeer) paintHexLine(layers, seed, nearestPeer, 'road');
      layers.labels[toKey(seed.q, seed.r)] = seed.district.name;
    });

    layers.interactives[toKey(center.q, center.r)] = 'beacon';
    layers.labels[toKey(center.q, center.r)] = 'Central Plaza';
    layers.spawns[toKey(center.q, center.r)] = 'spawn';
    var edgeSpawn = { q: Math.max(0, cols - 2), r: Math.round(rows / 2) };
    layers.spawns[toKey(edgeSpawn.q, edgeSpawn.r)] = 'spawn';

    return {
      board: { cols: cols, rows: rows },
      layers: layers,
      fog: { enabled: true, revealed: {} },
      label: 'town procedural',
      editor: { layer: 'terrain', tool: 'paint', paintValue: 'road' }
    };
  }

  function generateProceduralWilderness(board) {
    var cols = Math.max(14, Number(board.cols || 20));
    var rows = Math.max(12, Number(board.rows || 16));
    var layers = createEmptySceneLayers();
    var biomeDefs = [
      { name: 'forest', terrain: 'forest', hazard: 'trap', poi: 'shrine' },
      { name: 'marsh', terrain: 'marsh', hazard: 'acid', poi: 'loot-cache' },
      { name: 'highlands', terrain: 'crags', hazard: 'trap', poi: 'beacon' },
      { name: 'lakes', terrain: 'water', hazard: 'trap', poi: 'chest' },
      { name: 'open', terrain: 'difficult terrain', hazard: 'trap', poi: 'switch' }
    ];
    var masks = biomeDefs.map(function (biome, idx) {
      return {
        biome: biome,
        q: combatRandInt(1, cols - 2),
        r: combatRandInt(1, rows - 2),
        bias: (idx % 2 === 0 ? 0.86 : 1.14)
      };
    });

    for (var q = 0; q < cols; q += 1) {
      for (var r = 0; r < rows; r += 1) {
        var key = toKey(q, r);
        var nearest = null;
        var nearestScore = Infinity;
        masks.forEach(function (mask) {
          var dist = hexDistance({ q: q, r: r }, mask);
          var score = dist * Number(mask.bias || 1);
          if (score < nearestScore) {
            nearestScore = score;
            nearest = mask;
          }
        });
        var biome = nearest ? nearest.biome : biomeDefs[0];
        layers.terrain[key] = biome.terrain;
        if (Math.random() < 0.12) layers.objects[key] = combatPickOne(['obstacle', 'wall', 'spawn']);
        if (Math.random() < 0.08) layers.hazards[key] = biome.hazard;
      }
    }

    // POI seeding: plant named landmarks across biome boundaries and edges.
    var poiCount = combatRandInt(5, 8);
    for (var i = 0; i < poiCount; i += 1) {
      var pq = combatRandInt(1, cols - 2);
      var pr = combatRandInt(1, rows - 2);
      var pKey = toKey(pq, pr);
      var localTerrain = String(layers.terrain[pKey] || 'forest');
      var localBiome = biomeDefs.find(function (row) { return row.terrain === localTerrain; }) || biomeDefs[0];
      layers.interactives[pKey] = localBiome.poi;
      layers.labels[pKey] = localBiome.name.toUpperCase() + ' POI';
      if (Math.random() < 0.45) layers.spawns[pKey] = 'spawn';
    }

    var trailStart = { q: 1, r: Math.round(rows / 2) };
    var trailEnd = { q: cols - 2, r: Math.round(rows / 2) };
    paintHexLine(layers, trailStart, trailEnd, 'road');
    layers.weather[toKey(Math.round(cols / 2), Math.round(rows / 2))] = combatPickOne(['rain', 'wind', 'storm']);

    return {
      board: { cols: cols, rows: rows },
      layers: layers,
      fog: { enabled: true, revealed: {} },
      label: 'wilderness procedural',
      editor: { layer: 'interactives', tool: 'paint', paintValue: 'shrine' }
    };
  }

  function buildProceduralSceneTemplate(kind, board) {
    var key = String(kind || 'quick').toLowerCase();
    if (key === 'quick') key = combatPickOne(['dungeon', 'town', 'wilderness']);
    if (key === 'urban') key = 'town';
    if (key === 'empty') {
      return {
        board: { cols: 10, rows: 10 },
        layers: createEmptySceneLayers(),
        fog: { enabled: false, revealed: {} },
        label: 'empty',
        editor: { layer: 'terrain', tool: 'paint', paintValue: 'road' }
      };
    }
    if (key === 'dungeon') return generateProceduralDungeon(board || {});
    if (key === 'town') return generateProceduralTown(board || {});
    if (key === 'wilderness') return generateProceduralWilderness(board || {});
    return null;
  }

  function applyPostGenerationEditorHooks(config, sceneId) {
    if (!config || !config.editor) return;
    var state = store.getState();
    if (sceneId && String(state.activeSceneId || '') !== String(sceneId || '')) return;
    var nextPatch = {
      activeLayer: String(config.editor.layer || 'terrain'),
      activeTool: String(config.editor.tool || 'paint'),
      paintValue: String(config.editor.paintValue || 'road')
    };
    store.setState(function (prev) {
      var next = Object.assign({}, prev, nextPatch);
      persist(next);
      return next;
    });
    updateUiPanels();
  }

  function loadPersisted() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return loadLatestRecoverySnapshot();
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
      return loadLatestRecoverySnapshot();
    } catch (_err) {
      return loadLatestRecoverySnapshot();
    }
  }

  function loadRecoveryStack() {
    try {
      var raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function loadLatestRecoverySnapshot() {
    var stack = loadRecoveryStack();
    if (!stack.length) return null;
    var latest = stack[stack.length - 1];
    if (!latest || !latest.data || typeof latest.data !== 'object') return null;
    return latest.data;
  }

  function writeRecoverySnapshot(slim) {
    if (!slim || typeof slim !== 'object') return;
    var now = Date.now();
    if (now - lastRecoveryPersistAt < RECOVERY_MIN_INTERVAL_MS) return;
    var hash = '';
    try {
      hash = JSON.stringify(slim);
    } catch (_err) {
      return;
    }
    if (!hash || hash === lastRecoveryHash) return;
    var stack = loadRecoveryStack();
    stack.push({ at: now, data: slim });
    while (stack.length > RECOVERY_MAX) stack.shift();
    try {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(stack));
      lastRecoveryPersistAt = now;
      lastRecoveryHash = hash;
    } catch (_err) {}
  }

  function getCampaignCombatSceneSession() {
    if (!window || !window.campaignSystem || typeof window.campaignSystem.getState !== 'function') return null;
    try {
      var cs = window.campaignSystem.getState();
      if (!cs || !cs.code) return null;
      return cs;
    } catch (_err) {
      return null;
    }
  }

  function normalizeCombatTokenNameKey(name) {
    return String(name || '').trim().toLowerCase();
  }

  function isCampaignScenePlayerSideToken(token) {
    return !!(token && (token.isPlayer || String(token.faction || '') === 'player' || String(token.faction || '') === 'ally' || token.ownerToken));
  }

  function getCampaignRosterForCombatScene() {
    if (!window || !window.campaignSystem) return [];
    try {
      if (typeof window.campaignSystem.buildPartyRoster === 'function') {
        var roster = window.campaignSystem.buildPartyRoster();
        if (Array.isArray(roster) && roster.length) return roster.slice();
      }
    } catch (_err) {}
    if (typeof window.campaignSystem.getSharedState !== 'function' || typeof window.campaignSystem.getState !== 'function') return [];
    try {
      var shared = window.campaignSystem.getSharedState() || {};
      var combat = shared && shared.campaignCombat && typeof shared.campaignCombat === 'object'
        ? shared.campaignCombat
        : null;
      var localState = window.campaignSystem.getState() || {};
      var members = localState && localState.campaign && (localState.campaign.roster || localState.campaign.members);
      var list = Array.isArray(combat && combat.participants)
        ? combat.participants.filter(function (entry) {
            return entry && !entry.isEnemy && String(entry.token || '').indexOf('enemy:') !== 0;
          })
        : [];
      if (!list.length) return [];
      return list.map(function (entry, idx) {
        var member = Array.isArray(members)
          ? (members.find(function (row) { return row && String(row.token || '') === String(entry && entry.token || ''); }) || null)
          : null;
        var character = member && member.character && typeof member.character === 'object' ? member.character : {};
        var fallbackName = String(
          character.name
          || (member && member.name)
          || (entry && entry.name)
          || ('Wayfarer ' + (idx + 1))
        );
        return {
          token: String(entry && entry.token || (member && member.token) || ('campaign-pc:' + idx)),
          name: String((member && member.name) || fallbackName),
          role: String((member && member.role) || (entry && entry.role) || 'player'),
          character: {
            name: fallbackName,
            health: Number.isFinite(Number(character.health)) ? Number(character.health) : 0,
            maxHealth: Math.max(1, Number(character.maxHealth || 10)),
            mentalStress: Math.max(0, Number(character.mentalStress || 0)),
            maxMentalStress: Math.max(1, Number(character.maxMentalStress || 20)),
            stats: character.stats && typeof character.stats === 'object' ? character.stats : {},
            backpack: Array.isArray(character.backpack) ? character.backpack.slice() : []
          }
        };
      });
    } catch (_err) {
      return [];
    }
  }

  function normalizeCampaignCombatSceneTokens(tokens) {
    var list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
    var session = getCampaignCombatSceneSession();
    var roster = getCampaignRosterForCombatScene();
    if (!session || !session.code || !roster.length || !list.length) return list.slice();
    var playerSide = list.filter(isCampaignScenePlayerSideToken);
    var nonPlayer = list.filter(function (token) { return !isCampaignScenePlayerSideToken(token); });
    var remaining = playerSide.slice();

    function claimExistingForParticipant(entry) {
      var exactName = normalizeCombatTokenNameKey(entry && entry.character && entry.character.name || entry && entry.name || '');
      var matchIdx = -1;
      if (exactName) {
        matchIdx = remaining.findIndex(function (token) {
          return normalizeCombatTokenNameKey(token && token.name) === exactName;
        });
      }
      if (matchIdx < 0) matchIdx = remaining.findIndex(function (token) {
        return String(token && token.ownerToken || '') === String(entry && entry.token || '');
      });
      if (matchIdx < 0) matchIdx = remaining.findIndex(function (token) { return !!token; });
      if (matchIdx < 0) return null;
      var matched = remaining[matchIdx] || null;
      remaining.splice(matchIdx, 1);
      return matched;
    }

    var rosterTokens = roster.map(function (entry, idx) {
      var matched = claimExistingForParticipant(entry);
      var character = entry && entry.character && typeof entry.character === 'object' ? entry.character : {};
      var maxHp = Math.max(1, Number(character.maxHealth || (matched && matched.maxHp) || (matched && matched.hp) || 10));
      var hpRaw = Number(character.health);
      var hp = Number.isFinite(hpRaw) ? Math.max(0, hpRaw) : Math.max(0, Number((matched && matched.hp) || maxHp));
      return Object.assign({}, matched || {}, {
        id: String((matched && matched.id) || ('campaign-pc:' + String(entry && entry.token || idx))),
        name: String(character.name || entry.name || ('Wayfarer ' + (idx + 1))),
        faction: 'player',
        hp: hp,
        maxHp: maxHp,
        status: Array.isArray(matched && matched.status) ? matched.status.slice() : [],
        q: matched ? Number(matched.q || 0) : 0,
        r: matched ? Number(matched.r || 0) : idx,
        size: Math.max(1, Number((matched && matched.size) || 1)),
        ownerToken: String(entry && entry.token || ''),
        campaignRole: String(entry && entry.role || 'player'),
        isPlayer: false
      });
    });

    return rosterTokens.concat(remaining).concat(nonPlayer).map(function (token) {
      if (!token) return token;
      var next = Object.assign({}, token);
      if (isCampaignScenePlayerSideToken(next)) {
        next.faction = 'player';
        next.isPlayer = false;
        if (!next.ownerToken) {
          var owner = roster.find(function (entry) {
            return normalizeCombatTokenNameKey(entry && entry.character && entry.character.name || entry && entry.name || '') === normalizeCombatTokenNameKey(next.name);
          }) || null;
          if (owner && owner.token) next.ownerToken = String(owner.token || '');
        }
        if (String(session.role || '') !== 'gm' && next.ownerToken && String(next.ownerToken) === String(session.token || '')) {
          next.isPlayer = true;
        }
      }
      return next;
    });
  }

  function normalizeCampaignCombatSceneState(state) {
    if (!state || typeof state !== 'object' || !Array.isArray(state.tokens)) return state;
    var next = Object.assign({}, state);
    next.tokens = normalizeCampaignCombatSceneTokens(state.tokens);
    return next;
  }

  function prepareCampaignCombatSeed(seed) {
    if (!seed || typeof seed !== 'object') return seed;
    var nextSeed = clone(seed) || seed;
    if (Array.isArray(nextSeed.tokens)) nextSeed.tokens = normalizeCampaignCombatSceneTokens(nextSeed.tokens);
    if (nextSeed.sceneEditorState && typeof nextSeed.sceneEditorState === 'object') {
      nextSeed.sceneEditorState = normalizeCampaignCombatSceneState(nextSeed.sceneEditorState);
    }
    return nextSeed;
  }

  function buildCampaignCombatSceneSyncPayload() {
    var combatState = deepCloneJson(window.S && window.S.combat || {}) || {};
    var defaultEnemyDread = Math.max(4, Number(combatState && combatState.enemyDread || 8));
    var enemyRows = Array.isArray(window.S && window.S.enemies)
      ? (deepCloneJson(window.S.enemies) || []).map(function (entry) {
          if (!entry || typeof entry !== 'object') return entry;
          var row = Object.assign({}, entry);
          if (!Number.isFinite(Number(row.dread)) || Number(row.dread) <= 0) {
            row.dread = defaultEnemyDread;
          }
          return row;
        })
      : [];
    return {
      syncMeta: {
        by: String(window.S && window.S.name || 'GM'),
        at: Date.now()
      },
      combat: combatState,
      enemies: enemyRows,
      naval: (window.S && window.S.naval && typeof window.S.naval === 'object') ? (deepCloneJson(window.S.naval) || null) : null,
      caravan: (window.S && window.S.caravan && typeof window.S.caravan === 'object') ? (deepCloneJson(window.S.caravan) || null) : null,
      combatMap: (window.S && window.S.combatMap && typeof window.S.combatMap === 'object') ? (deepCloneJson(window.S.combatMap) || null) : null,
      combatAugState: (window.S && window.S.combatAugState && typeof window.S.combatAugState === 'object') ? (deepCloneJson(window.S.combatAugState) || null) : null,
      sceneEditor: (window.S && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === 'object')
        ? (deepCloneJson(normalizeCampaignCombatSceneState(window.S.combat.sceneEditor)) || null)
        : null
    };
  }

  function syncCurrentCampaignCombatScene(reason, options) {
    var cs = getCampaignCombatSceneSession();
    if (!cs || String(cs.role || '') !== 'gm' || !cs.connected || !cs.code) return;
    if (!(window.S && window.S.combat && window.S.combat.active)) return;
    if (!window.campaignSystem || typeof window.campaignSystem.syncSharedPatch !== 'function' || typeof window.campaignSystem.getSharedState !== 'function') return;
    var opts = options && typeof options === 'object' ? options : {};
    var scene = buildCampaignCombatSceneSyncPayload();
    var sceneEditor = scene && scene.sceneEditor && typeof scene.sceneEditor === 'object' ? scene.sceneEditor : null;
    var activeSceneId = String(sceneEditor && sceneEditor.activeSceneId || 'campaign-shared-scene');
    var scenes = sceneEditor && Array.isArray(sceneEditor.scenes) ? sceneEditor.scenes : [];
    var activeScene = activeSceneId
      ? (scenes.find(function (entry) { return entry && String(entry.id || '') === activeSceneId; }) || null)
      : null;
    var shared = null;
    try {
      shared = window.campaignSystem.getSharedState() || null;
    } catch (_err) {
      shared = null;
    }
    var combatStateHost = shared && typeof shared === 'object'
      ? { campaignCombat: deepCloneJson(shared.campaignCombat) || {} }
      : { campaignCombat: {} };
    if (window.campaignSystem && typeof window.campaignSystem.ensureCampaignCombatState === 'function') {
      try {
        window.campaignSystem.ensureCampaignCombatState(combatStateHost);
      } catch (_err2) {}
    }
    var combatState = combatStateHost.campaignCombat && typeof combatStateHost.campaignCombat === 'object'
      ? (deepCloneJson(combatStateHost.campaignCombat) || {})
      : {};
    var patch = {
      combatScene: scene
    };
    if (opts.includeCombatSession !== false) {
      combatState.active = true;
      combatState.vttSession = {
        enteredAt: Date.now(),
        by: String(window.S && window.S.name || cs.playerName || 'GM'),
        sceneName: String(activeScene && activeScene.name || 'Campaign Shared Scene'),
        activeSceneId: activeSceneId
      };
      if (shared && typeof shared === 'object') {
        shared.campaignCombat = deepCloneJson(combatState) || combatState;
      }
      patch.campaignCombat = combatState;
    }
    var out = window.campaignSystem.syncSharedPatch(patch, String(reason || 'campaign-combat-mode-open'));
    if (out && typeof out.catch === 'function') out.catch(function () {});
    if (opts.includeCombatSession !== false) {
      queueCampaignCombatVttSessionReassert(combatState, String(reason || 'campaign-combat-mode-open'));
    }
  }

  function announceCampaignCombatModeOpen(reason) {
    syncCurrentCampaignCombatScene(reason, { includeCombatSession: true });
  }

  function queueCampaignCombatVttSessionReassert(combatState, reason) {
    var nextCombat = combatState && typeof combatState === 'object'
      ? (deepCloneJson(combatState) || combatState)
      : null;
    var nextSession = nextCombat && nextCombat.vttSession && typeof nextCombat.vttSession === 'object'
      ? nextCombat.vttSession
      : null;
    var sessionAt = Number(nextSession && nextSession.enteredAt || 0);
    if (!nextCombat || !nextCombat.active || !sessionAt) return;
    if (campaignCombatVttSessionSyncTimer) clearTimeout(campaignCombatVttSessionSyncTimer);
    campaignCombatVttSessionSyncTimer = setTimeout(function () {
      campaignCombatVttSessionSyncTimer = null;
      var cs = getCampaignCombatSceneSession();
      if (!cs || String(cs.role || '') !== 'gm' || !cs.connected || !cs.code) return;
      if (!(window.S && window.S.combat && window.S.combat.active)) return;
      if (!window.campaignSystem || typeof window.campaignSystem.syncSharedPatch !== 'function' || typeof window.campaignSystem.getSharedState !== 'function') return;
      var shared = null;
      try {
        shared = window.campaignSystem.getSharedState() || null;
      } catch (_err) {
        shared = null;
      }
      var currentCombat = shared && shared.campaignCombat && typeof shared.campaignCombat === 'object'
        ? shared.campaignCombat
        : null;
      var currentSession = currentCombat && currentCombat.vttSession && typeof currentCombat.vttSession === 'object'
        ? currentCombat.vttSession
        : null;
      var currentSessionAt = Number(currentSession && currentSession.enteredAt || 0);
      if (currentSessionAt > sessionAt) return;
      if (shared && typeof shared === 'object') {
        shared.campaignCombat = deepCloneJson(nextCombat) || nextCombat;
      }
      var retryOut = window.campaignSystem.syncSharedPatch({
        campaignCombat: deepCloneJson(nextCombat) || nextCombat
      }, String(reason || 'campaign-combat-vtt-reassert') + '-reassert');
      if (retryOut && typeof retryOut.catch === 'function') retryOut.catch(function () {});
    }, 320);
  }

  function queueCampaignCombatSceneSync(reason) {
    if (!window || !window.campaignSystem) return;
    if (typeof window.campaignSystem.getState !== 'function') return;
    if (typeof window.campaignSystem.syncSharedPatch !== 'function') return;
    if (campaignSceneSyncTimer) clearTimeout(campaignSceneSyncTimer);
    var syncGeneration = Math.max(0, Number(window.__campaignCombatSceneSyncGeneration || 0));
    campaignSceneSyncTimer = setTimeout(function () {
      campaignSceneSyncTimer = null;
      if (syncGeneration !== Math.max(0, Number(window.__campaignCombatSceneSyncGeneration || 0))) return;
      if (Number(window.__campaignCombatSceneAutoSyncSuppressUntil || 0) > Date.now()) return;
      var cs = null;
      try {
        cs = window.campaignSystem.getState();
      } catch (_err) {
        return;
      }
      if (!cs || !cs.connected || !cs.code || !canCurrentUserSyncCampaignCombatScene()) return;
      var scene = buildCampaignCombatSceneSyncPayload();
      var hash = '';
      try {
        hash = JSON.stringify(scene);
      } catch (_err2) {
        return;
      }
      if (!hash || hash === lastCampaignSceneSyncHash) return;
      lastCampaignSceneSyncHash = hash;
      var out = window.campaignSystem.syncSharedPatch({ combatScene: scene }, String(reason || 'combat-scene-editor-sync'));
      if (out && typeof out.catch === 'function') out.catch(function () {});
    }, 220);
  }

  function normalizeBoard(board) {
    var source = board && typeof board === 'object' ? board : {}
    ;
    return {
      cols: Math.max(1, Math.min(60, Number(source.cols || 22))),
      rows: Math.max(1, Math.min(60, Number(source.rows || 16))),
      size: Math.max(24, Math.min(80, Number(source.size || 42))),
      zoom: Math.max(0.4, Math.min(3, Number(source.zoom || 1))),
      snapThreshold: Math.max(0, Math.min(1, Number(source.snapThreshold == null ? 0.3 : source.snapThreshold))),
      panX: Number.isFinite(Number(source.panX)) ? Number(source.panX) : 640,
      panY: Number.isFinite(Number(source.panY)) ? Number(source.panY) : 340,
      background: String(source.background || ''),
      weatherOverlay: String(source.weatherOverlay || 'none'),
      weatherIntensity: Math.max(0, Math.min(10, Number(source.weatherIntensity || 1)))
    };
  }

  function normalizeLayerSettings(layerSettings) {
    var source = layerSettings && typeof layerSettings === 'object' ? layerSettings : {};
    var keys = ['terrain', 'objects', 'hazards', 'elevation', 'lighting', 'weather', 'foreground', 'interactives', 'spawns', 'labels', 'tokens', 'fx'];
    var out = {};
    keys.forEach(function (key) {
      var row = source[key] && typeof source[key] === 'object' ? source[key] : {};
      out[key] = {
        visible: row.visible !== false,
        locked: !!row.locked,
        opacity: Math.max(0.1, Math.min(1, Number(row.opacity == null ? 1 : row.opacity))),
        gmOnly: !!row.gmOnly
      };
    });
    return out;
  }

  function normalizeCombatLogEntries(entries, fallbackRound) {
    var list = Array.isArray(entries) ? entries : [];
    return list.map(function (entry, idx) {
      var source = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry : { message: String(entry || '') };
      var round = Math.max(1, Number(source.round || fallbackRound || 1));
      var eventType = String(source.eventType || source.type || 'note').toLowerCase();
      var tags = Array.isArray(source.tags) ? source.tags.map(function (tag) { return String(tag || '').toLowerCase(); }).filter(Boolean) : [];
      var actorName = String(source.actorName || source.actor || '');
      var targetName = String(source.targetName || source.target || '');
      var action = String(source.action || source.label || source.type || 'Note');
      var result = String(source.result || source.message || '');
      var roll = source.roll && typeof source.roll === 'object'
        ? {
          label: String(source.roll.label || ''),
          formula: String(source.roll.formula || ''),
          total: Number(source.roll.total || 0),
          breakdown: String(source.roll.breakdown || '')
        }
        : null;
      return {
        id: String(source.id || ('log-' + round + '-' + idx + '-' + Number(source.at || Date.now()))),
        at: Number(source.at || Date.now()),
        round: round,
        actorId: String(source.actorId || ''),
        actorName: actorName,
        action: action,
        targetId: String(source.targetId || ''),
        targetName: targetName,
        roll: roll,
        result: result,
        eventType: eventType,
        tags: tags,
        message: String(source.message || result || action || ''),
        focusTokenId: String(source.focusTokenId || source.targetId || source.actorId || '')
      };
    }).slice(0, 160);
  }

  function normalizeCombatSceneState(state) {
    var next = Object.assign({}, state || {});
    next.board = normalizeBoard(next.board);
    next.layers = Object.assign({
      terrain: {},
      objects: {},
      hazards: {},
      elevation: {},
      lighting: {},
      wallSegments: {},
      weather: {},
      foreground: {},
      interactives: {},
      spawns: {},
      labels: {}
    }, next.layers && typeof next.layers === 'object' ? next.layers : {});
    next.layers.terrain = Object.assign({}, next.layers.terrain || {});
    next.layers.objects = Object.assign({}, next.layers.objects || {});
    next.layers.hazards = Object.assign({}, next.layers.hazards || {});
    next.layers.elevation = Object.assign({}, next.layers.elevation || {});
    next.layers.lighting = Object.assign({}, next.layers.lighting || {});
    next.layers.wallSegments = Object.assign({}, next.layers.wallSegments || {});
    next.layers.weather = Object.assign({}, next.layers.weather || {});
    next.layers.foreground = Object.assign({}, next.layers.foreground || {});
    next.layers.interactives = Object.assign({}, next.layers.interactives || {});
    next.layers.spawns = Object.assign({}, next.layers.spawns || {});
    next.layers.labels = Object.assign({}, next.layers.labels || {});
    next.layerSettings = normalizeLayerSettings(next.layerSettings);
    next.fog = Object.assign({
      enabled: false,
      showMask: true,
      revealMode: 'manual',
      visionRadius: 3,
      sharedVision: true,
      explorerMode: true,
      softEdges: true,
      seen: {},
      revealed: {},
      revealOrder: {},
      revealSeq: 0,
      revealStep: 0
    }, next.fog && typeof next.fog === 'object' ? next.fog : {});
    next.fog.sharedVision = next.fog.sharedVision !== false;
    next.fog.explorerMode = next.fog.explorerMode !== false;
    next.fog.softEdges = next.fog.softEdges !== false;
    next.fog.seen = Object.assign({}, next.fog.seen || {});
    next.fog.revealed = Object.assign({}, next.fog.revealed || {});
    next.fog.revealOrder = Object.assign({}, next.fog.revealOrder || {});
    next.sceneRules = ensureCombatSceneRulesExtensions(next.sceneRules);
    next.rulerOptions = Object.assign({ shape: 'line', fadeDelay: 'linger', snapToGrid: true }, next.rulerOptions && typeof next.rulerOptions === 'object' ? next.rulerOptions : {});
    next.spellPreview = normalizeCombatSpellPreview(next.spellPreview);
    next.assetBrowser = Object.assign({ category: 'heroes', query: '' }, next.assetBrowser && typeof next.assetBrowser === 'object' ? next.assetBrowser : {});
    next.tokens = Array.isArray(next.tokens) ? next.tokens : [];
    next.tokens = next.tokens.map(function (token, idx) {
      var row = Object.assign({}, token || {});
      row.scale = Math.max(0.25, Math.min(2, Number(row.scale || 1)));
      row.rotation = Number.isFinite(Number(row.rotation)) ? Number(row.rotation) : 0;
      row.freeform = !!row.freeform;
      row.offsetX = Number.isFinite(Number(row.offsetX)) ? Number(row.offsetX) : 0;
      row.offsetY = Number.isFinite(Number(row.offsetY)) ? Number(row.offsetY) : 0;
      row.visionRadius = Math.max(0, Math.min(12, Number(row.visionRadius == null ? next.fog.visionRadius : row.visionRadius)));
      row.visionShape = String(row.visionShape || 'radius') === 'cone' ? 'cone' : 'radius';
      row.auraRadius = Math.max(0, Math.min(12, Number(row.auraRadius || 0)));
      row.auraColor = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(String(row.auraColor || '')) ? String(row.auraColor) : '#49c9bb';
      row.locked = !!row.locked;
      row.layer = String(row.layer || 'token');
      row.zIndex = Number.isFinite(Number(row.zIndex)) ? Number(row.zIndex) : idx;
      if (Array.isArray(row.enemySkills) && row.enemySkills.length) {
        // Migration pass for older saves that predate normalized enemy skill schema fields.
        row.enemySkills = row.enemySkills.map(function (skill, skillIdx) {
          return normalizeEnemySkillRow(skill, skillIdx, row.name || 'Enemy');
        }).filter(Boolean);
      }
      return row;
    });
    next.tokenRoundEffects = Array.isArray(next.tokenRoundEffects) ? next.tokenRoundEffects : [];
    next.selectedTokenIds = Array.isArray(next.selectedTokenIds) ? next.selectedTokenIds.map(function (id) { return String(id); }) : [];
    if (next.selectedTokenId && next.selectedTokenIds.indexOf(String(next.selectedTokenId)) < 0) {
      next.selectedTokenIds.unshift(String(next.selectedTokenId));
    }
    next.selectedMapItem = normalizeMapItemSelection(next.selectedMapItem, next);
    next.clipboardMapItem = next.clipboardMapItem && typeof next.clipboardMapItem === 'object' ? clone(next.clipboardMapItem) : null;
    next.draggingMapItem = normalizeMapItemSelection(next.draggingMapItem, next);
    next.clipboardTokens = Array.isArray(next.clipboardTokens) ? clone(next.clipboardTokens) : [];
    next.undoStack = Array.isArray(next.undoStack) ? clone(next.undoStack).slice(0, 40) : [];
    next.redoStack = Array.isArray(next.redoStack) ? clone(next.redoStack).slice(0, 40) : [];
    next.draggingGroupIds = Array.isArray(next.draggingGroupIds) ? next.draggingGroupIds.map(function (id) { return String(id); }) : [];
    next.dragTokenOrigins = next.dragTokenOrigins && typeof next.dragTokenOrigins === 'object' ? Object.assign({}, next.dragTokenOrigins) : {};
    var roundNum = Math.max(1, Number(next.round || 1));
    var appliedNum = Number(next.lastConditionRoundApplied);
    if (!Number.isFinite(appliedNum) || appliedNum <= 0) appliedNum = roundNum;
    next.lastConditionRoundApplied = Math.max(1, appliedNum);
    next.initiative = Array.isArray(next.initiative) ? next.initiative : [];
    next.actionHistory = Array.isArray(next.actionHistory) ? next.actionHistory : [];
    next.combatLog = normalizeCombatLogEntries(next.combatLog && next.combatLog.length ? next.combatLog : next.actionHistory, next.round || 1);
    next.logFilters = Object.assign({ round: 'all', actor: 'all', eventType: 'all' }, next.logFilters && typeof next.logFilters === 'object' ? next.logFilters : {});
    next.turnStates = Object.assign({}, next.turnStates || {});
    next.collapsedPanels = Object.assign({}, next.collapsedPanels || {});
    next.panelPos = Object.assign({
      tools: { x: 14, y: 58 },
      feed: { x: 980, y: 58 },
      actions: { x: 290, y: 560 }
    }, next.panelPos && typeof next.panelPos === 'object' ? next.panelPos : {});
    next.ui = normalizeCombatUi(next.ui);
    next.paintBrushSize = Math.max(1, Math.min(5, Number(next.paintBrushSize || 1)));
    next.drawColor = /^#([0-9a-f]{6})$/i.test(String(next.drawColor || '')) ? String(next.drawColor) : '#e3bc5e';
    return next;
  }

  function makeSceneSnapshot(state) {
    return {
      board: clone(state.board || {}),
      layers: clone(state.layers || {}),
      fog: clone(state.fog || {}),
      sceneRules: clone(state.sceneRules || {}),
      tokens: clone(state.tokens || []),
      tokenRoundEffects: clone(state.tokenRoundEffects || []),
      initiative: clone(state.initiative || []),
      actionHistory: clone((state.actionHistory || []).slice(0, 80)),
      combatLog: clone((state.combatLog || []).slice(0, 160)),
      turnStates: clone(state.turnStates || {})
    };
  }

  function getActiveSceneSnapshot(state) {
    var sceneState = state && typeof state === 'object' ? state : null;
    if (!sceneState || !Array.isArray(sceneState.scenes) || !sceneState.scenes.length) return null;
    var activeId = String(sceneState.activeSceneId || '');
    if (!activeId) return null;
    return sceneState.scenes.find(function (scene) {
      return scene && String(scene.id || '') === activeId;
    }) || null;
  }

  function hydrateActiveSceneState(state, options) {
    var sceneState = normalizeCombatSceneState(Object.assign({}, state || {}));
    var activeScene = getActiveSceneSnapshot(sceneState);
    if (!activeScene) return sceneState;
    var opts = options && typeof options === 'object' ? options : {};
    var topTokens = Array.isArray(sceneState.tokens) ? sceneState.tokens : [];
    var activeTokens = Array.isArray(activeScene.tokens) ? activeScene.tokens : [];
    var shouldHydrate = !!opts.force || (!topTokens.length && activeTokens.length);
    if (!shouldHydrate) return sceneState;
    sceneState.board = normalizeBoard(Object.assign({}, sceneState.board || {}, clone(activeScene.board || {})));
    sceneState.layers = clone(activeScene.layers || {});
    sceneState.fog = clone(activeScene.fog || {});
    sceneState.sceneRules = clone(activeScene.sceneRules || {});
    sceneState.tokens = clone(activeTokens);
    sceneState.tokenRoundEffects = clone(activeScene.tokenRoundEffects || sceneState.tokenRoundEffects || []);
    sceneState.initiative = clone(activeScene.initiative || []);
    sceneState.actionHistory = clone(activeScene.actionHistory || []);
    sceneState.combatLog = clone(activeScene.combatLog || sceneState.combatLog || []);
    sceneState.turnStates = clone(activeScene.turnStates || sceneState.turnStates || {});
    if (!sceneState.selectedTokenId && sceneState.tokens.length) {
      sceneState.selectedTokenId = String(sceneState.tokens[0] && sceneState.tokens[0].id || '');
    }
    return sceneState;
  }

  function withActiveSceneSnapshot(state) {
    if (!state || !Array.isArray(state.scenes) || !state.activeSceneId) return state;
    var sceneIdx = state.scenes.findIndex(function (scene) {
      return scene && String(scene.id) === String(state.activeSceneId);
    });
    if (sceneIdx < 0) {
      var appended = state.scenes.slice();
      appended.push(Object.assign({
        id: String(state.activeSceneId),
        name: 'Scene ' + String(appended.length + 1),
        createdAt: Date.now()
      }, makeSceneSnapshot(state), {
        updatedAt: Date.now()
      }));
      return Object.assign({}, state, { scenes: appended });
    }

    var nextScenes = state.scenes.slice();
    var currentScene = nextScenes[sceneIdx] || {};
    nextScenes[sceneIdx] = Object.assign({}, currentScene, makeSceneSnapshot(state), {
      id: String(currentScene.id || state.activeSceneId),
      name: String(currentScene.name || ('Scene ' + String(sceneIdx + 1))),
      updatedAt: Date.now()
    });
    return Object.assign({}, state, { scenes: nextScenes });
  }

  var persistWriteTimer = null;
  var persistQueuedSlim = null;
  var lastPersistJson = '';

  function flushPersistStorage() {
    persistWriteTimer = null;
    if (!persistQueuedSlim) return;
    try {
      var json = JSON.stringify(persistQueuedSlim);
      if (json !== lastPersistJson) {
        localStorage.setItem(KEY, json);
        writeRecoverySnapshot(persistQueuedSlim);
        lastPersistJson = json;
      }
    } catch (_err) {}
    persistQueuedSlim = null;
  }

  function queuePersistStorageWrite(slim) {
    persistQueuedSlim = slim;
    if (persistWriteTimer) return;
    persistWriteTimer = setTimeout(flushPersistStorage, 180);
  }

  function persist(state) {
    var synced = withActiveSceneSnapshot(state);
    var slim = {
      board: synced.board,
      layers: synced.layers,
      fog: synced.fog,
      sceneRules: synced.sceneRules,
      tokens: synced.tokens,
      tokenRoundEffects: synced.tokenRoundEffects,
      initiative: synced.initiative,
      actionHistory: synced.actionHistory,
      combatLog: synced.combatLog,
      turnStates: synced.turnStates,
      logFilters: synced.logFilters,
      panelPos: synced.panelPos,
      autoRoll: synced.autoRoll,
      round: synced.round,
      lastConditionRoundApplied: synced.lastConditionRoundApplied,
      initiativeIndex: synced.initiativeIndex,
      currentTurnIndex: synced.currentTurnIndex,
      collapsedPanels: synced.collapsedPanels,
      scenes: synced.scenes,
      activeSceneId: synced.activeSceneId,
      rulerOptions: synced.rulerOptions,
      assetBrowser: synced.assetBrowser,
      ui: synced.ui,
      paintBrushSize: synced.paintBrushSize,
      drawColor: synced.drawColor,
      selectedTokenIds: synced.selectedTokenIds,
      selectedMapItem: synced.selectedMapItem,
      clipboardMapItem: synced.clipboardMapItem,
      clipboardTokens: synced.clipboardTokens,
      undoStack: synced.undoStack,
      redoStack: synced.redoStack
    };
    queuePersistStorageWrite(slim);
    if (window.S) {
      if (!window.S.combat || typeof window.S.combat !== 'object') window.S.combat = {};
      window.S.combat.sceneEditor = clone(synced);
      syncWindowCombatMapFromSceneState(synced);
      if (!applyingSharedCombatSceneEditorState) {
        queueCampaignCombatSceneSync('combat-scene-editor-persist');
      }
    }
  }

  function sceneHexToCombatZone(token) {
    var q = Number(token && token.q || 0);
    if (q <= 1) return 'Engaged';
    if (q <= 3) return 'Close';
    if (q <= 5) return 'Nearby';
    return 'Far';
  }

  function buildCombatMapUnitFromSceneToken(token, index) {
    if (!token || typeof token !== 'object') return null;
    var faction = String(token.faction || 'neutral');
    var isEnemy = faction === 'monster' || faction === 'enemy';
    var trackerKey = token.trackerKey
      ? String(token.trackerKey || '')
      : (isEnemy && Number(token.sourceEnemyId || 0) > 0 ? ('enemy:' + String(token.sourceEnemyId || '')) : '');
    var fallbackId = isEnemy ? (500000 + Math.max(0, Number(index || 0))) : (900000 + Math.max(0, Number(index || 0)));
    var mappedId = isEnemy
      ? Math.max(1, Number(token.sourceEnemyId || token.mapUnitId || fallbackId))
      : Math.max(1, Number(token.mapUnitId || fallbackId));
    return {
      id: mappedId,
      name: String(token.name || (isEnemy ? 'Enemy' : 'Wayfarer')),
      side: isEnemy ? 'enemy' : 'ally',
      zone: sceneHexToCombatZone(token),
      isPlayer: !!token.isPlayer,
      fromTracker: !!trackerKey,
      trackerKey: trackerKey,
      hp: Math.max(0, Number(token.hp || 0)),
      maxHp: Math.max(1, Number(token.maxHp || token.hp || 1)),
      dead: !!token.dead || Number(token.hp || 0) <= 0,
      dread: Math.max(1, Number(token.dread || token.codexDread || token.deathNumber || 0)) || undefined,
      deathNumber: Math.max(1, Number(token.deathNumber || token.dread || token.codexDread || 1)),
      sourceEnemyId: Math.max(0, Number(token.sourceEnemyId || 0)),
      ownerToken: String(token.ownerToken || ''),
      status: Array.isArray(token.status) ? token.status.slice() : []
    };
  }

  function syncWindowCombatMapFromSceneState(sceneState) {
    if (!window.S || !sceneState || typeof sceneState !== 'object') return null;
    var hydrated = hydrateActiveSceneState(sceneState);
    var tokens = Array.isArray(hydrated.tokens) ? hydrated.tokens : [];
    if (!window.S.combatMap || typeof window.S.combatMap !== 'object') {
      window.S.combatMap = { units: [], aoeTemplates: [], aoeSeq: 0, activeAoeTemplateId: '' };
    }
    if (!Array.isArray(window.S.combatMap.aoeTemplates)) window.S.combatMap.aoeTemplates = [];
    if (!Number.isFinite(Number(window.S.combatMap.aoeSeq || 0))) window.S.combatMap.aoeSeq = 0;
    if (typeof window.S.combatMap.activeAoeTemplateId !== 'string') window.S.combatMap.activeAoeTemplateId = '';
    if (!tokens.length) return window.S.combatMap;
    window.S.combatMap.units = tokens.map(function (token, index) {
      return buildCombatMapUnitFromSceneToken(token, index);
    }).filter(Boolean);
    return window.S.combatMap;
  }

  function actionModeFor(action) {
    var value = String(action || '').toLowerCase();
    if (value === 'strike' || value === 'melee') return 'melee';
    if (value === 'shoot' || value === 'ranged') return 'ranged';
    return 'utility';
  }

  function coverOverridePenaltyForTarget(state, targetId) {
    if (!state || !targetId) return 0;
    var map = state.sceneRules && state.sceneRules.targetCoverOverrides && typeof state.sceneRules.targetCoverOverrides === 'object'
      ? state.sceneRules.targetCoverOverrides
      : {};
    var mode = String(map[targetId] || 'auto').toLowerCase();
    if (mode === 'none') return 0;
    if (mode === 'light') return -1;
    if (mode === 'heavy') return -2;
    return 0;
  }

  function coverPenaltyForTarget(state, actor, target, action) {
    if (!state || !actor || !target) return 0;
    if (actionModeFor(action) === 'melee') return 0;
    var key = toKey(target.q, target.r);
    var profile = getLayerGameplayProfile(state, target.q, target.r);
    var cover = Math.max(0, Number(profile.cover || 0));
    var actorElev = Number(state.layers && state.layers.elevation && state.layers.elevation[toKey(actor.q, actor.r)] || 0);
    var targetElev = Number(state.layers && state.layers.elevation && state.layers.elevation[key] || 0);
    if (actorElev > targetElev && cover > 0) cover -= 1;
    var range = hexDistance({ q: actor.q, r: actor.r }, { q: target.q, r: target.r });
    if (range <= 1 && cover > 0) cover -= 1;
    var terrainCover = -Math.max(0, cover);
    return terrainCover + coverOverridePenaltyForTarget(state, String(target.id || ''));
  }

  function losModifierForAction(state, actor, target, action) {
    if (!state || !actor || !target) return { blocked: false, mod: 0 };
    if (actionModeFor(action) !== 'ranged') return { blocked: false, mod: 0 };
    var targetProfile = getLayerGameplayProfile(state, target.q, target.r);
    var blocked = targetProfile.blockLos || isSightBlocked(state, { q: Number(actor.q || 0), r: Number(actor.r || 0) }, { q: Number(target.q || 0), r: Number(target.r || 0) });
    var mod = blocked ? -4 : Number(targetProfile.rangedMod || 0);
    return { blocked: blocked, mod: mod };
  }

  function defaultTokens() {
    var portrait = (window.S && window.S.identityForge && window.S.identityForge.media && window.S.identityForge.media.portrait) || '';
    var defaultEnemyDread = Math.max(4, Number(window.S && window.S.combat && window.S.combat.enemyDread || 6));
    var name = (window.S && window.S.name) || 'Wayfarer';
    var defendDie = getWayfarerEffectiveDie('defend', 6);
    var hpFromDefend = Math.max(1, defendDie * 2);
    return [
      { id: uid('pc'), name: String(name), faction: 'player', hp: hpFromDefend, maxHp: hpFromDefend, status: [], q: 0, r: 0, image: portrait, size: 1, isPlayer: true },
      { id: uid('mob'), name: 'Ghoul Ravager', faction: 'monster', hp: 10, maxHp: 10, status: [], q: 3, r: 0, image: '', size: 1 }
    ];
  }

  function canonicalWayfarerName() {
    return String(window.S && window.S.name || 'Wayfarer').trim() || 'Wayfarer';
  }

  function getWayfarerMaxHpByRules() {
    var defendDie = getWayfarerEffectiveDie('defend', 6);
    return Math.max(1, defendDie * 2);
  }

  function getWayfarerHealthSnapshot() {
    var maxHp = getWayfarerMaxHpByRules();
    var damageTaken = Math.max(0, Number(window.S && window.S.health || 0));
    var remaining = Math.max(0, maxHp - damageTaken);
    return { remaining: remaining, max: maxHp, damage: damageTaken };
  }

  function syncWayfarerTokenHealthFromSheet() {
    var state = store.getState();
    var snap = getWayfarerHealthSnapshot();
    var changed = false;
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      next.tokens = (inner.tokens || []).map(function (token) {
        if (!token || !token.isPlayer) return token;
        var hpNow = Math.max(0, Number(token.hp || 0));
        var maxNow = Math.max(1, Number(token.maxHp || hpNow || 1));
        if (hpNow === snap.remaining && maxNow === snap.max) return token;
        changed = true;
        return Object.assign({}, token, { hp: snap.remaining, maxHp: snap.max, dead: snap.remaining <= 0 });
      });
      if (changed) persist(next);
      return changed ? next : inner;
    });
    return changed;
  }

  function normalizeTokenActionBudgetToken(token) {
    return !!(token && !token.isPlayer && (String(token.faction) === 'player' || String(token.faction) === 'monster'));
  }

  function isWayfarerToken(token) {
    return !!(token && token.isPlayer);
  }

  function isPlayerFactionToken(token) {
    return !!(token && (token.isPlayer || String(token.faction || '') === 'player'));
  }

  function buildTurnOrder(tokens) {
    var list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
    var wayfarers = list.filter(function (t) { return !!t.isPlayer; });
    var allies = list.filter(function (t) { return !t.isPlayer && String(t.faction) === 'player'; });
    var enemies = list.filter(function (t) { return String(t.faction) === 'monster'; });
    var merged = wayfarers.concat(allies).concat(enemies);
    return merged.map(function (token, idx) {
      return { tokenId: token.id, name: token.name, init: Math.max(1, 100 - idx) };
    });
  }

  function seedFromCurrentCombat() {
    var tokens = [];
    if (window.S && window.S.combat && window.S.combat.sceneWorkshop && Array.isArray(window.S.combat.sceneWorkshop.tokens)) {
      tokens = window.S.combat.sceneWorkshop.tokens.map(function (token, idx) {
        if (!token) return null;
        return {
          id: String(token.id || uid('ws')),
          name: String(token.name || ('Token ' + (idx + 1))),
          faction: String(token.side || 'neutral') === 'ally' ? 'player' : 'monster',
          hp: 10,
          maxHp: 10,
          status: [],
          q: Number(token.x || 0),
          r: Number(token.y || 0),
          image: String(token.image || ''),
          size: 1,
          isPlayer: !!token.isPlayer
        };
      }).filter(Boolean);
    }

    if (!tokens.length && window.S && Array.isArray(window.S.enemies) && window.S.enemies.length) {
      tokens = window.S.enemies.map(function (enemy, idx) {
        var allied = !!enemy.ally;
        var dread = Math.max(4, Number(enemy.dread || 6));
        var hpByDread = dread * 2;
        return {
          id: uid(allied ? 'ally' : 'enm'),
          name: String(enemy.name || (allied ? 'Ally' : 'Enemy ' + (idx + 1))),
          faction: allied ? 'player' : 'monster',
          hp: allied ? Number(enemy.stress || hpByDread) : hpByDread,
          maxHp: allied ? Number(enemy.stress || hpByDread) : hpByDread,
          status: [],
          q: allied ? idx : idx + 3,
          r: allied ? 2 : 0,
          image: '',
          size: 1,
          isPlayer: false,
          dread: dread,
          deathNumber: dread,
          sourceEnemyId: Number(enemy.id || 0)
        };
      });
    }

    return tokens.length ? tokens : defaultTokens();
  }

  var persisted = normalizeCombatSceneState(loadPersisted());
  var store = createStore(Object.assign({
    open: false,
    entering: false,
    activeLayer: 'terrain',
    activeTool: 'select',
    fogBrush: 'reveal',
    paintValue: 'forest',
    paintBrushSize: 1,
    drawColor: '#e3bc5e',
    selectedTokenId: '',
    selectedTokenIds: [],
    selectedMapItem: null,
    draggingTokenId: '',
    draggingMapItem: null,
    draggingGroupIds: [],
    dragTokenOrigins: {},
    clipboardMapItem: null,
    clipboardTokens: [],
    undoStack: [],
    redoStack: [],
    playMode: true,
    autoRoll: true,
    initiativeIndex: 0,
    round: 1,
    currentTurnIndex: 0,
    collapsedPanels: { 'combatActionsPanel': false, 'combatEnemyLedger': true, 'combatWayfarerRulesPanel': true },
    ui: persisted.ui,
    scenes: [{ id: 'scene-1', name: 'Main Scene', isActive: true }],
    activeSceneId: 'scene-1',
    ruler: { active: false, start: null, end: null, distance: 0, label: 'Engaged' },
    rulerOptions: { shape: 'line', fadeDelay: 'linger', snapToGrid: true },
    spellPreview: normalizeCombatSpellPreview({ active: false }),
    board: {
      cols: 22,
      rows: 16,
      size: 42,
      zoom: 1,
      snapThreshold: 0.3,
      panX: 640,
      panY: 340,
      background: '',
      weatherOverlay: 'none',
      weatherIntensity: 1
    },
    fog: {
      enabled: false,
      showMask: true,
      revealMode: 'manual',
      visionRadius: 3,
      sharedVision: true,
      explorerMode: true,
      softEdges: true,
      seen: {},
      revealed: {},
      revealOrder: {},
      revealSeq: 0,
      revealStep: 0
    },
    layerSettings: normalizeLayerSettings(),
    sceneRules: {
      rollMode: 'auto',
      defaultActionType: 'ranged',
      targetCoverOverrides: {},
      lootDrops: {},
      mapLootCaches: {},
      hazardChecks: {},
      assetFolders: { mapAssets: [], hexAssets: [] }
    },
    layers: {
      terrain: {},
      objects: {},
      hazards: {},
      elevation: {},
      lighting: {},
      wallSegments: {},
      weather: {},
      foreground: {},
      interactives: {},
      spawns: {},
      labels: {}
    },
    codexBestiary: flattenCodexBestiary(),
    tokens: seedFromCurrentCombat(),
    tokenRoundEffects: [],
    lastConditionRoundApplied: 1,
    initiative: [],
    teamActions: {},
    actionHistory: ['Combat mode initialized.'],
    combatLog: [{
      id: 'combat-log-init',
      at: Date.now(),
      round: 1,
      actorId: '',
      actorName: 'System',
      action: 'Initialize',
      targetId: '',
      targetName: '',
      roll: null,
      result: 'Combat mode initialized.',
      eventType: 'system',
      tags: ['system'],
      message: 'Combat mode initialized.',
      focusTokenId: ''
    }],
    logFilters: { round: 'all', actor: 'all', eventType: 'all' },
    turnStates: {},
    panelPos: {
      tools: { x: 14, y: 58 },
      feed: { x: 980, y: 58 },
      actions: { x: 290, y: 560 }
    },
    mouse: { panning: false, lastX: 0, lastY: 0 },
    ping: null
  }, persisted || {}));

  store.setState(function (state) {
    var next = Object.assign({}, state);
    if (!next.assetBrowser || typeof next.assetBrowser !== 'object') {
      next.assetBrowser = { category: 'heroes', query: '' };
    } else {
      next.assetBrowser = Object.assign({ category: 'heroes', query: '' }, next.assetBrowser);
    }
    return next;
  });

  function ensureInitiative(state) {
    var expected = buildTurnOrder(state.tokens || []);
    var current = Array.isArray(state.initiative) ? state.initiative : [];
    var sameSize = current.length === expected.length;
    var sameOrder = sameSize && current.every(function (row, idx) {
      return row && String(row.tokenId || '') === String(expected[idx] && expected[idx].tokenId || '');
    });
    if (!sameOrder) state.initiative = expected;
    if (Number(state.initiativeIndex || 0) >= state.initiative.length) state.initiativeIndex = 0;
    return state;
  }

  function isCampaignModeActive() {
    try {
      if (window.campaignSystem && typeof window.campaignSystem.getState === 'function') {
        var st = window.campaignSystem.getState();
        return !!(st && st.activeMissionId);
      }
    } catch (_err) {}
    return false;
  }

  function ensureActionBudgetMap(state) {
    var next = Object.assign({}, state);
    var map = Object.assign({}, state.teamActions || {});
    (state.tokens || []).forEach(function (token) {
      if (!normalizeTokenActionBudgetToken(token)) return;
      if (typeof map[token.id] !== 'number') map[token.id] = 2;
    });
    next.teamActions = map;
    return next;
  }

  function spendUnitAction(tokenId) {
    var state = store.getState();
    var available = Number(state.teamActions && state.teamActions[tokenId] || 0);
    if (available <= 0) return false;
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      next.teamActions = Object.assign({}, inner.teamActions || {});
      next.teamActions[tokenId] = Math.max(0, Number(next.teamActions[tokenId] || 0) - 1);
      persist(next);
      return next;
    });
    return true;
  }

  function addHistory(line) {
    var text = String(line || '');
    var entry = addCombatLogEntry({ message: text, result: text });
    if (typeof window.combatChatPostSystem === 'function' && text) {
      try { window.combatChatPostSystem(text); } catch (_err) {}
    }
    return entry;
  }

  function inferCombatLogMetaFromLine(line) {
    var text = String(line || '').trim();
    var lower = text.toLowerCase();
    var out = { eventType: 'note', action: 'Note', tags: ['note'] };
    var m = null;
    if (!text) return out;
    if (/^turn:\s+/.test(lower)) {
      out.eventType = 'turn';
      out.action = 'Turn Start';
      out.tags = ['turn'];
      out.actorName = text.replace(/^turn:\s*/i, '').replace(/[.]$/, '');
      return out;
    }
    if ((m = text.match(/^(.+?) moved to /i))) {
      out.eventType = 'movement';
      out.action = 'Move';
      out.tags = ['movement'];
      out.actorName = String(m[1] || '').trim();
      return out;
    }
    if ((m = text.match(/^(.+?) hits? (.+?) /i))) {
      out.eventType = 'attack';
      out.action = 'Hit';
      out.tags = ['attack', 'hit'];
      out.actorName = String(m[1] || '').trim();
      out.targetName = String(m[2] || '').trim();
      return out;
    }
    if ((m = text.match(/^(.+?) misses? (.+?) /i))) {
      out.eventType = 'attack';
      out.action = 'Miss';
      out.tags = ['attack', 'miss'];
      out.actorName = String(m[1] || '').trim();
      out.targetName = String(m[2] || '').trim();
      return out;
    }
    if (/^dice:\s+/i.test(text)) {
      out.eventType = 'roll';
      out.action = 'Dice Roll';
      out.tags = ['roll'];
      return out;
    }
    if (/condition applied/i.test(lower)) {
      out.eventType = 'condition';
      out.action = 'Condition';
      out.tags = ['condition'];
      return out;
    }
    if (/scene started|scene restarted|new round/i.test(lower)) {
      out.eventType = 'system';
      out.action = 'Scene State';
      out.tags = ['system', 'round'];
      return out;
    }
    return out;
  }

  function resolveCombatLogTokenId(state, preferredId, preferredName) {
    if (preferredId) return String(preferredId);
    var name = String(preferredName || '').trim().toLowerCase();
    if (!name) return '';
    var token = (state.tokens || []).find(function (row) {
      return row && String(row.name || '').trim().toLowerCase() === name;
    }) || null;
    return token ? String(token.id || '') : '';
  }

  function addCombatLogEntry(entry) {
    var source = (entry && typeof entry === 'object') ? Object.assign({}, entry) : { message: String(entry || '') };
    var inferred = inferCombatLogMetaFromLine(source.message || source.result || source.action || '');
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var round = Math.max(1, Number(source.round || state.round || 1));
      var actorId = resolveCombatLogTokenId(state, source.actorId, source.actorName || inferred.actorName);
      var targetId = resolveCombatLogTokenId(state, source.targetId, source.targetName || inferred.targetName);
      var item = normalizeCombatLogEntries([Object.assign({}, inferred, source, {
        id: String(source.id || uid('clog')),
        at: Number(source.at || Date.now()),
        round: round,
        actorId: actorId,
        targetId: targetId,
        actorName: String(source.actorName || inferred.actorName || ''),
        targetName: String(source.targetName || inferred.targetName || ''),
        focusTokenId: String(source.focusTokenId || targetId || actorId || '')
      })], round)[0];
      next.combatLog = [item].concat(state.combatLog || []).slice(0, 160);
      next.actionHistory = [String(item.message || item.result || item.action || '')].concat((state.actionHistory || [])).slice(0, 80);
      persist(next);
      return next;
    });
    var speak = String(source.actorName || '') + ' ' + String(source.action || source.eventType || 'event') + ' ' + String(source.targetName || '');
    var fallback = String(source.message || source.result || '').trim();
    announceCombatEvent((speak.replace(/\s+/g, ' ').trim() || fallback || 'Combat log updated.'));
    return true;
  }

  function snapshotEditableState(state) {
    return {
      board: clone(state.board || {}),
      layers: clone(state.layers || {}),
      fog: clone(state.fog || {}),
      sceneRules: clone(state.sceneRules || {}),
      tokens: clone(state.tokens || []),
      tokenRoundEffects: clone(state.tokenRoundEffects || []),
      initiative: clone(state.initiative || []),
      initiativeIndex: Number(state.initiativeIndex || 0),
      currentTurnIndex: Number(state.currentTurnIndex || 0),
      round: Number(state.round || 1),
      selectedTokenId: String(state.selectedTokenId || ''),
      selectedTokenIds: clone(state.selectedTokenIds || []),
      selectedMapItem: clone(state.selectedMapItem || null),
      clipboardMapItem: clone(state.clipboardMapItem || null),
      activeSceneId: String(state.activeSceneId || ''),
      scenes: clone(state.scenes || [])
    };
  }

  function captureUndoSnapshot(label) {
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var undo = Array.isArray(state.undoStack) ? state.undoStack.slice() : [];
      undo.unshift({ label: String(label || 'Edit'), at: Date.now(), payload: snapshotEditableState(state) });
      next.undoStack = undo.slice(0, 40);
      next.redoStack = [];
      persist(next);
      return next;
    });
  }

  function restoreEditableSnapshot(snapshot, pushToRedo) {
    var target = snapshot && snapshot.payload ? snapshot.payload : snapshot;
    if (!target || typeof target !== 'object') return false;
    store.setState(function (state) {
      var next = normalizeCombatSceneState(Object.assign({}, state));
      if (pushToRedo) {
        var redo = Array.isArray(state.redoStack) ? state.redoStack.slice() : [];
        redo.unshift({ label: 'Redo', at: Date.now(), payload: snapshotEditableState(state) });
        next.redoStack = redo.slice(0, 40);
      }
      next.board = normalizeBoard(clone(target.board || next.board));
      next.layers = clone(target.layers || next.layers);
      next.fog = clone(target.fog || next.fog);
      next.sceneRules = clone(target.sceneRules || next.sceneRules);
      next.tokens = clone(target.tokens || []);
      next.tokenRoundEffects = clone(target.tokenRoundEffects || []);
      next.initiative = clone(target.initiative || []);
      next.initiativeIndex = Number(target.initiativeIndex || 0);
      next.currentTurnIndex = Number(target.currentTurnIndex || 0);
      next.round = Math.max(1, Number(target.round || 1));
      next.selectedTokenId = String(target.selectedTokenId || '');
      next.selectedTokenIds = Array.isArray(target.selectedTokenIds) ? clone(target.selectedTokenIds) : [];
      next.selectedMapItem = normalizeMapItemSelection(target.selectedMapItem, next);
      next.clipboardMapItem = target.clipboardMapItem && typeof target.clipboardMapItem === 'object' ? clone(target.clipboardMapItem) : null;
      next.activeSceneId = String(target.activeSceneId || next.activeSceneId || '');
      next.scenes = Array.isArray(target.scenes) ? clone(target.scenes) : clone(next.scenes || []);
      persist(next);
      return next;
    });
    drawBoard();
    updateUiPanels();
    return true;
  }

  function undoLastEdit() {
    var state = store.getState();
    var undo = Array.isArray(state.undoStack) ? state.undoStack.slice() : [];
    if (!undo.length) {
      safeNotif('Nothing to undo.', 'info');
      return false;
    }
    var snapshot = undo.shift();
    store.setState({ undoStack: undo });
    var ok = restoreEditableSnapshot(snapshot, true);
    if (ok) safeNotif('Undo applied.', 'good');
    return ok;
  }

  function redoLastEdit() {
    var state = store.getState();
    var redo = Array.isArray(state.redoStack) ? state.redoStack.slice() : [];
    if (!redo.length) {
      safeNotif('Nothing to redo.', 'info');
      return false;
    }
    var snapshot = redo.shift();
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      next.redoStack = redo;
      var undo = Array.isArray(inner.undoStack) ? inner.undoStack.slice() : [];
      undo.unshift({ label: 'Undo', at: Date.now(), payload: snapshotEditableState(inner) });
      next.undoStack = undo.slice(0, 40);
      return next;
    });
    var ok = restoreEditableSnapshot(snapshot, false);
    if (ok) safeNotif('Redo applied.', 'good');
    return ok;
  }

  function normalizeSelection(primaryId, selectedIds) {
    var state = store.getState();
    var valid = {};
    (state.tokens || []).forEach(function (token) {
      if (!token || !token.id) return;
      valid[String(token.id)] = true;
    });
    var list = Array.isArray(selectedIds) ? selectedIds.map(function (id) { return String(id); }).filter(function (id, idx, arr) {
      return !!valid[id] && arr.indexOf(id) === idx;
    }) : [];
    var lead = String(primaryId || '');
    if (!lead || !valid[lead]) lead = list[0] || '';
    if (lead && list.indexOf(lead) < 0) list.unshift(lead);
    store.setState({ selectedTokenId: lead, selectedTokenIds: list, selectedMapItem: null, draggingMapItem: null });
    return { primary: lead, list: list };
  }

  function selectedTokenIdSet() {
    var state = store.getState();
    var selected = Array.isArray(state.selectedTokenIds) && state.selectedTokenIds.length
      ? state.selectedTokenIds.map(function (id) { return String(id); })
      : (state.selectedTokenId ? [String(state.selectedTokenId)] : []);
    var set = {};
    selected.forEach(function (id) { set[id] = true; });
    return set;
  }

  function byId(id) {
    var state = store.getState();
    return (state.tokens || []).find(function (t) { return t && String(t.id) === String(id); }) || null;
  }

  function isTokenDead(token) {
    return !!(token && (token.dead || Number(token.hp || 0) <= 0));
  }

  function isSceneActive() {
    return !!(window.S && window.S.combat && window.S.combat.active);
  }

  function isGmController() {
    try {
      if (window.campaignSystem && typeof window.campaignSystem.getState === 'function') {
        var cs = window.campaignSystem.getState();
        if (cs && cs.code) return String(cs.role || '') === 'gm';
      }
    } catch (_err) {}
    return true;
  }

  function getCombatSceneManipulationDeniedMessage(token) {
    var cs = getCampaignCombatSceneSession();
    if (!cs || !cs.code) return 'You cannot move that token right now.';
    if (String(cs.role || '') === 'gm') return 'Campaign VTT: the GM only manipulates enemy-side tokens.';
    return 'Campaign VTT: you can only move your own Wayfarer token.';
  }

  function canCurrentUserManipulateToken(token) {
    var cs = getCampaignCombatSceneSession();
    if (!cs || !cs.code) return true;
    if (!token) return false;
    var faction = String(token.faction || '');
    var ownerToken = String(token.ownerToken || '');
    if (String(cs.role || '') === 'gm') {
      return faction !== 'player' && !token.isPlayer;
    }
    if (faction !== 'player' && !token.isPlayer) return false;
    return !!(ownerToken && String(cs.token || '') === ownerToken);
  }

  function getCampaignCombatTurnState() {
    var cs = getCampaignCombatSceneSession();
    if (!cs || !cs.code || !window.campaignSystem || typeof window.campaignSystem.getSharedState !== 'function') return null;
    try {
      var shared = window.campaignSystem.getSharedState() || null;
      var combat = shared && shared.campaignCombat && typeof shared.campaignCombat === 'object'
        ? shared.campaignCombat
        : null;
      return combat && combat.active ? combat : null;
    } catch (_err) {
      return null;
    }
  }

  function getCampaignCombatParticipantName(combatState, token) {
    var participants = combatState && Array.isArray(combatState.participants) ? combatState.participants : [];
    var row = participants.find(function (entry) {
      return String(entry && entry.token || '') === String(token || '');
    }) || null;
    return String(row && row.name || 'Wayfarer');
  }

  function canCurrentUserDriveTokenTurn(token) {
    var cs = getCampaignCombatSceneSession();
    if (!cs || !cs.code) return true;
    if (!canCurrentUserManipulateToken(token)) return false;
    if (String(cs.role || '') === 'gm') return true;
    var combatState = getCampaignCombatTurnState();
    if (!combatState) return true;
    if (String(combatState.phase || 'wayfarer') !== 'wayfarer') return false;
    return String(combatState.activeToken || '') === String(cs.token || '');
  }

  function getCampaignCombatTurnDeniedMessage(token) {
    if (!canCurrentUserManipulateToken(token)) {
      return getCombatSceneManipulationDeniedMessage(token);
    }
    var cs = getCampaignCombatSceneSession();
    if (!cs || !cs.code || String(cs.role || '') === 'gm') {
      return 'You cannot act with that token right now.';
    }
    var combatState = getCampaignCombatTurnState();
    if (!combatState) return 'Wait for the GM to prompt your turn in the shared VTT.';
    if (String(combatState.phase || 'wayfarer') === 'enemy') {
      return 'Enemy phase is active. Wait for the GM to resolve enemy actions.';
    }
    var activeToken = String(combatState.activeToken || '');
    if (!activeToken) {
      return 'The GM is choosing who acts next.';
    }
    if (activeToken !== String(cs.token || '')) {
      return 'Wait for the GM to prompt ' + getCampaignCombatParticipantName(combatState, activeToken) + ' before acting.';
    }
    return 'You cannot act with that token right now.';
  }

  function canCurrentUserSyncCampaignCombatScene() {
    var cs = getCampaignCombatSceneSession();
    if (!cs || !cs.connected || !cs.code) return false;
    if (String(cs.role || '') === 'gm') return true;
    var combatState = getCampaignCombatTurnState();
    if (!combatState) return false;
    if (String(combatState.phase || 'wayfarer') !== 'wayfarer') return false;
    return !!(combatState.activeToken && String(combatState.activeToken || '') === String(cs.token || ''));
  }

  function guardCampaignGmSceneControl(message) {
    var cs = getCampaignCombatSceneSession();
    if (!cs || !cs.code) return true;
    if (String(cs.role || '') === 'gm') return true;
    safeNotif(String(message || 'Only the GM can change that shared VTT control.'), 'warn');
    return false;
  }

  function ensureLootDrops(state) {
    var rules = ensureCombatSceneRulesExtensions(state && state.sceneRules || {});
    rules.lootDrops = Object.assign({}, rules.lootDrops || {});
    return rules;
  }

  function getLootDropForToken(state, tokenId) {
    if (!state || !state.sceneRules || !state.sceneRules.lootDrops) return null;
    var drop = state.sceneRules.lootDrops[String(tokenId)];
    return drop && typeof drop === 'object' ? drop : null;
  }

  function isTokenTurnActive(state, tokenId) {
    if (!state || !Array.isArray(state.initiative) || !state.initiative.length) return false;
    var active = state.initiative[Math.max(0, Number(state.initiativeIndex || 0))] || null;
    return !!(active && String(active.tokenId || '') === String(tokenId || ''));
  }

  function getMovementActionsAvailable(state, token) {
    if (!state || !token) return 0;
    if (!isSceneActive() || !state.playMode) return 0;
    var wayfarerToken = isWayfarerToken(token);
    var playerSideToken = isPlayerFactionToken(token);
    var tokenTurnActive = isTokenTurnActive(state, token.id);
    if (!tokenTurnActive) {
      var hasInitiative = !!(Array.isArray(state.initiative) && state.initiative.length);
      var playerActions = Math.max(0, Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0));
      // Keep reachable hexes visible for Wayfarer when initiative has not synced yet.
      if (!(wayfarerToken && (!hasInitiative || playerActions > 0))) return 0;
    }
    if (isTokenDead(token)) return 0;
    if (wayfarerToken) {
      return Math.max(0, Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0));
    }
    if (playerSideToken) {
      return Math.max(0, Number(state.teamActions && state.teamActions[token.id] || 0));
    }
    return Math.max(0, Number(state.teamActions && state.teamActions[token.id] || 0));
  }

  function getEnemyProfileByName(name) {
    if (!name || typeof window.NAMED_ENEMY_BESTIARY === 'undefined' || !window.NAMED_ENEMY_BESTIARY) return null;
    var bestiary = window.NAMED_ENEMY_BESTIARY;
    var needle = String(name || '').toLowerCase();
    var found = null;
    Object.keys(bestiary).some(function (region) {
      var list = Array.isArray(bestiary[region]) ? bestiary[region] : [];
      var row = list.find(function (entry) { return entry && String(entry.name || '').toLowerCase() === needle; });
      if (row) {
        found = row;
        return true;
      }
      return false;
    });
    return found;
  }

  function getEnemyProfileForToken(token) {
    if (!token) return null;
    var canonical = String(token.enemyProfileName || '').trim();
    if (canonical) {
      var byCanonical = getEnemyProfileByName(canonical);
      if (byCanonical) return byCanonical;
    }
    return getEnemyProfileByName(token.name);
  }

  function asEnemySkillRangeArray(skill) {
    if (!skill) return ['engaged'];
    if (Array.isArray(skill.range) && skill.range.length) {
      return skill.range.map(function (row) {
        return String(row || '').trim().toLowerCase();
      }).filter(Boolean);
    }
    var raw = String(skill.range || skill.rangeBand || skill.distance || '').trim();
    if (!raw) return ['engaged'];
    return raw.split(/[\/,|]/).map(function (part) {
      return String(part || '').trim().toLowerCase();
    }).filter(Boolean);
  }

  function normalizeEnemyRangeBandText(raw) {
    var txt = String(raw || '').trim().toLowerCase();
    if (txt === 'engaged') return 'engaged';
    if (txt === 'close') return 'close';
    if (txt === 'nearby') return 'nearby';
    if (txt === 'far') return 'far';
    return '';
  }

  function inferEnemySkillRangeBand(row, text) {
    var bands = asEnemySkillRangeArray(row).map(normalizeEnemyRangeBandText).filter(Boolean);
    if (bands.indexOf('far') >= 0) return 'far';
    if (bands.indexOf('nearby') >= 0) return 'nearby';
    if (bands.indexOf('close') >= 0) return 'close';
    if (bands.indexOf('engaged') >= 0) return 'engaged';

    var lower = String(text || '').toLowerCase();
    if (/\bfar\b|long range|distant/.test(lower)) return 'far';
    if (/\bnearby\b/.test(lower)) return 'nearby';
    if (/\bclose\b|mid range/.test(lower)) return 'close';
    if (/\bengaged\b|adjacent|melee/.test(lower)) return 'engaged';
    return 'close';
  }

  function getEnemyAoeBandDefaults(band) {
    var key = normalizeEnemyRangeBandText(band) || 'close';
    var table = {
      engaged: {
        lineLength: 2,
        ringInner: 0,
        ringOuter: 1,
        rounds: 1,
        stress: 2,
        stressBonus: 0,
        actionDown: true
      },
      close: {
        lineLength: 3,
        ringInner: 1,
        ringOuter: 2,
        rounds: 2,
        stress: 2,
        stressBonus: 0,
        actionDown: true
      },
      nearby: {
        lineLength: 4,
        ringInner: 2,
        ringOuter: 3,
        rounds: 2,
        stress: 1,
        stressBonus: 0,
        actionDown: false
      },
      far: {
        lineLength: 6,
        ringInner: 3,
        ringOuter: 5,
        rounds: 3,
        stress: 1,
        stressBonus: 0,
        actionDown: false
      }
    };
    return Object.assign({}, table[key] || table.close, { band: key });
  }

  function buildEnemyAoeRulesTableHtml() {
    var bands = ['engaged', 'close', 'nearby', 'far'];
    var rows = bands.map(function (band) {
      var rule = getEnemyAoeBandDefaults(band);
      var title = String(rule.band || band);
      var bandLabel = title.charAt(0).toUpperCase() + title.slice(1);
      return '<tr>'
        + '<td>' + bandLabel + '</td>'
        + '<td>' + Number(rule.lineLength || 0) + '</td>'
        + '<td>' + Number(rule.ringInner || 0) + '-' + Number(rule.ringOuter || 0) + '</td>'
        + '<td>' + Number(rule.rounds || 0) + '</td>'
        + '<td>' + Number(rule.stress || 0) + '</td>'
        + '<td>' + (rule.actionDown ? 'Yes (-1)' : 'No') + '</td>'
        + '</tr>';
    }).join('');
    return ''
      + '<table class="combat-rule-table"><thead><tr><th>Band</th><th>Line</th><th>Ring</th><th>Rounds</th><th>Stress</th><th>Action Loss</th></tr></thead><tbody>'
      + rows
      + '</tbody></table>';
  }

  function inferEnemySkillAoeTemplate(row, normalizedName, normalizedDesc) {
    var src = row && typeof row === 'object' ? row : {};
    if (src.aoeTemplate && typeof src.aoeTemplate === 'object') {
      return Object.assign({}, src.aoeTemplate);
    }

    var type = String(src.effectType || src.kind || '').toLowerCase();
    var text = (String(normalizedName || '') + ' ' + String(normalizedDesc || '') + ' ' + String(src.onFail || '') + ' ' + String(src.kind || '')).toLowerCase();
    var flagged = type.indexOf('aoe') >= 0 || text.indexOf('aoe') >= 0 || text.indexOf('area of effect') >= 0 || text.indexOf('ring of fire') >= 0 || text.indexOf('line of fire') >= 0;
    if (!flagged) return null;

    var band = inferEnemySkillRangeBand(src, text);
    var bandDefaults = getEnemyAoeBandDefaults(band);
    var rounds = Number(bandDefaults.rounds || 2);
    var lineHint = /line|beam|sweep|breath/.test(text) || type.indexOf('line') >= 0;
    var ringHint = /ring|aura|nearby|close|engaged|far/.test(text) || type.indexOf('ring') >= 0;

    if (lineHint && !ringHint) {
      var length = Math.max(2, Math.min(8, Number(bandDefaults.lineLength || 4)));
      return {
        shape: 'line',
        band: bandDefaults.band,
        length: length,
        rounds: rounds,
        tickOnEnter: true,
        tickOnRoundStart: true
      };
    }

    var inner = Math.max(0, Number(bandDefaults.ringInner || 0));
    var outer = Math.max(inner + 1, Number(bandDefaults.ringOuter || (inner + 1)));
    return {
      shape: 'ring',
      band: bandDefaults.band,
      innerRadius: Math.min(6, inner),
      outerRadius: Math.min(7, outer),
      rounds: rounds,
      tickOnEnter: true,
      tickOnRoundStart: true
    };
  }

  function normalizeEnemySkillRow(skill, idx, actorName) {
    var row = skill && typeof skill === 'object' ? skill : { name: String(skill || '') };
    var lowerActor = String(actorName || '').toLowerCase();
    var baseName = String(row.name || row.title || row.label || ('Skill ' + (Number(idx || 0) + 1))).trim();
    var defaultDesc = Number(idx || 0) === 0
      ? 'A brutal opener used to pressure nearby targets.'
      : 'A follow-up attack that keeps pressure on the Wayfarer.';
    var defaultFail = Number(idx || 0) === 0
      ? 'Apply distracted until end of next enemy turn.'
      : 'Take 1 stress.';
    var defaultSuccess = Number(idx || 0) === 0
      ? 'Resist the effect. No condition applied.'
      : 'Resist the effect. No condition applied.';

    var rawDamageMode = String(row.damageMode || row.onFailDamageMode || '').trim().toLowerCase();
    var normalizedDamageMode = rawDamageMode === 'flat' || rawDamageMode === 'margin' || rawDamageMode === 'margin_plus'
      ? rawDamageMode
      : '';
    var rawOnFailStress = Number(row.onFailStress == null ? row.failStress : row.onFailStress);
    var safeOnFailStress = Number.isFinite(rawOnFailStress)
      ? Math.max(0, Math.floor(rawOnFailStress))
      : (Number(idx || 0) === 0 ? 0 : 1);
    var rawStressBonus = Number(row.onFailStressBonus == null ? row.failStressBonus : row.onFailStressBonus);
    var safeStressBonus = Number.isFinite(rawStressBonus) ? Math.max(0, Math.floor(rawStressBonus)) : 0;

    if (!normalizedDamageMode) {
      if (safeOnFailStress > 0) normalizedDamageMode = 'flat';
      else normalizedDamageMode = Number(idx || 0) === 0 ? 'flat' : 'margin';
    }

    var normalized = {
      name: baseName,
      desc: String(row.desc || row.description || row.text || defaultDesc),
      save: String(row.save || row.saveStat || row.stat || (Number(idx || 0) === 0 ? 'mind' : 'defend')).toLowerCase(),
      range: asEnemySkillRangeArray(row),
      onFail: String(row.onFail || row.fail || row.failure || defaultFail),
      onSuccess: String(row.onSuccess || row.success || defaultSuccess),
      onFailCondition: String(row.onFailCondition || row.failCondition || '').trim(),
      damageMode: normalizedDamageMode,
      onFailStress: safeOnFailStress,
      onFailStressBonus: safeStressBonus,
      source: String(row.source || 'Combat Tab'),
      kind: String(row.kind || 'special'),
      effectType: String(row.effectType || row.kind || '').toLowerCase(),
      aoeTemplate: inferEnemySkillAoeTemplate(row, baseName, String(row.desc || row.description || row.text || defaultDesc)),
      dreadDie: Math.max(0, Number(row.dreadDie || row.dread || 0)),
      costActions: 1
    };

    if (normalized.aoeTemplate) {
      var aoeBandDefaults = getEnemyAoeBandDefaults(normalized.aoeTemplate.band || inferEnemySkillRangeBand(row, normalized.desc));
      normalized.damageMode = 'flat';
      normalized.onFailStress = Math.max(0, Number(aoeBandDefaults.stress || 0));
      normalized.onFailStressBonus = Math.max(0, Number(aoeBandDefaults.stressBonus || 0));
      if (!hasAoeActionDownEffect(normalized) && aoeBandDefaults.actionDown) {
        normalized.onFail = String(normalized.onFail || '').trim() + (String(normalized.onFail || '').trim() ? ' ' : '') + 'Lose 1 Action.';
      }
    }

    if (lowerActor.indexOf('bandit') >= 0 && Number(idx || 0) === 0) {
      normalized.name = 'Shock Snare';
      normalized.desc = 'A charged net overloads your senses.';
      normalized.save = 'mind';
      normalized.range = ['close'];
      normalized.onFail = 'Apply distracted until end of next enemy turn.';
      normalized.onFailCondition = 'distracted';
      normalized.damageMode = 'flat';
      normalized.onFailStress = 0;
      normalized.onFailStressBonus = 0;
      normalized.onSuccess = 'Resist the effect. No condition applied.';
      normalized.source = 'Combat Tab';
      normalized.kind = 'range: close';
    }
    return normalized;
  }

  function buildGeneratedEnemySkillsFromActor(actor, profile) {
    var sourceEntry = profile && typeof profile === 'object'
      ? profile
      : {
          name: String(actor && actor.name || 'Enemy'),
          dread: Math.max(4, Number(actor && (actor.dread || actor.codexDread) || 6)),
          desc: String(actor && actor.description || '')
        };
    if (typeof window.getBestiaryEntrySkillObjects === 'function') {
      try {
        var generated = window.getBestiaryEntrySkillObjects(sourceEntry);
        if (Array.isArray(generated) && generated.length) return generated.slice(0, 2);
      } catch (_err) {}
    }
    return [];
  }

  function getEnemySkillsForToken(actor) {
    var profile = actor ? getEnemyProfileForToken(actor) : null;
    var rawSkills = [];
    if (actor && Array.isArray(actor.enemySkills) && actor.enemySkills.length) rawSkills = actor.enemySkills.slice();
    else if (profile && Array.isArray(profile.skills) && profile.skills.length) rawSkills = profile.skills.slice();
    else if (profile && Array.isArray(profile.abilities) && profile.abilities.length) rawSkills = profile.abilities.slice();
    else if (profile && Array.isArray(profile.moves) && profile.moves.length) rawSkills = profile.moves.slice();
    if (!rawSkills.length) rawSkills = buildGeneratedEnemySkillsFromActor(actor, profile);
    var normalized = rawSkills.map(function (skill, idx) {
      return normalizeEnemySkillRow(skill, idx, actor && actor.name || 'Enemy');
    }).filter(Boolean);
    if (!normalized.length) {
      normalized = [
        normalizeEnemySkillRow({
          name: 'Shock Snare',
          desc: 'A charged net overloads your senses.',
          save: 'mind',
          range: ['close'],
          onFail: 'Apply distracted until end of next enemy turn.',
          onFailCondition: 'distracted',
          damageMode: 'flat',
          onFailStress: 0,
          onSuccess: 'Resist the effect. No condition applied.',
          source: 'Combat Tab',
          kind: 'range: close'
        }, 0, actor && actor.name || 'Enemy'),
        normalizeEnemySkillRow({
          name: 'Ring of Cinders',
          desc: 'Ignites a close ring of fire around the target. Entering or ending your round in it forces a Body save.',
          save: 'body',
          range: ['engaged', 'close'],
          onFail: 'Take 1 stress and lose 1 Action.',
          damageMode: 'flat',
          onFailStress: 2,
          onSuccess: 'Resist the flames. No effect.',
          source: 'Combat Tab',
          kind: 'aoe_ring',
          effectType: 'aoe_ring',
          aoeInnerRadius: 1,
          aoeOuterRadius: 2,
          aoeRounds: 2
        }, 1, actor && actor.name || 'Enemy')
      ];
    }
    if (normalized.length < 2) {
      normalized.push(normalizeEnemySkillRow({
        name: 'Linefire Sweep',
        desc: 'A burning line tears through six hexes at Nearby/Far range.',
        save: 'body',
        range: ['nearby', 'far'],
        onFail: 'Take 1 stress.',
        damageMode: 'flat',
        onFailStress: 1,
        onSuccess: 'Resist the flame line. No effect.',
        source: 'Combat Tab',
        kind: 'aoe_line',
        effectType: 'aoe_line',
        aoeLength: 6,
        aoeRounds: 3
      }, 1, actor && actor.name || 'Enemy'));
    }
    return normalized.slice(0, 2);
  }

  function parseSkillRangeMax(skill) {
    var rangeMap = { engaged: 1, close: 2, nearby: 4, far: 99 };
    var ranges = asEnemySkillRangeArray(skill);
    return ranges.reduce(function (mx, r) {
      return Math.max(mx, rangeMap[String(r || '').toLowerCase()] || 1);
    }, 1);
  }

  function getEnemySkillOptionsForToken(actor, target) {
    var skills = getEnemySkillsForToken(actor);
    if (!skills.length) return [];
    var dist = (actor && target) ? hexDistance({ q: actor.q, r: actor.r }, { q: target.q, r: target.r }) : null;
    return skills.map(function (skill, idx) {
      var maxR = parseSkillRangeMax(skill);
      var inRange = dist === null ? true : dist <= maxR;
      return {
        idx: idx,
        id: 'enemy_skill:' + idx,
        name: String(skill && skill.name || ('Skill ' + (idx + 1))),
        skill: skill,
        actionCost: Math.max(1, Number(skill && skill.costActions || 1)),
        maxRange: maxR,
        inRange: inRange,
        rangeLabel: asEnemySkillRangeArray(skill).join('/') || 'engaged'
      };
    });
  }

  function parseDefendAdvantageCount() {
    var count = 0;
    var armor = String(window.S && window.S.equipment && window.S.equipment.armor || '').toLowerCase();
    if (armor && armor.indexOf('advantage') >= 0 && armor.indexOf('defend') >= 0) count += 1;
    var affix = (typeof window.getEquippedAffixCombatBonuses === 'function') ? window.getEquippedAffixCombatBonuses() : null;
    if (affix) {
      if (Number(affix.defendAdv || 0) > 0) count += Number(affix.defendAdv || 0);
      if (Array.isArray(affix.defendAdvDice) && affix.defendAdvDice.length) count += affix.defendAdvDice.length;
    }
    return Math.max(0, Math.floor(count));
  }

  function parseArmorDefendAdvDice() {
    var armor = String(window.S && window.S.equipment && window.S.equipment.armor || '');
    var dice = [];
    var seen = {};
    var rx = /ad\s*(\d+)|advantage\s*d?\s*(\d+)/ig;
    var m;
    while ((m = rx.exec(armor))) {
      var raw = Number(m[1] || m[2] || 0);
      var d = Math.max(4, raw);
      if (d > 0 && !seen[d]) {
        seen[d] = true;
        dice.push(d);
      }
    }
    return dice;
  }

  function getWayfarerMaxActionsByRules() {
    var armor = String(window.S && window.S.equipment && window.S.equipment.armor || '');
    var m = armor.match(/(\d+)\s*actions?/i);
    if (m) {
      var parsed = Math.max(1, Number(m[1] || 0));
      if (parsed > 0) return parsed;
    }
    return Math.max(1, Number(window.S && window.S.combat && window.S.combat.maxActions || 3));
  }

  function syncWayfarerCombatActionBudget(resetCurrent) {
    if (!window.S || !window.S.combat) return;
    var maxByRules = getWayfarerMaxActionsByRules();
    window.S.combat.maxActions = maxByRules;
    if (resetCurrent) {
      window.S.combat.actionsLeft = maxByRules;
    } else {
      var current = Number(window.S.combat.actionsLeft);
      if (!Number.isFinite(current)) current = maxByRules;
      window.S.combat.actionsLeft = Math.min(maxByRules, Math.max(0, current));
    }
    if (typeof window.updateCombatUI === 'function') {
      try { window.updateCombatUI(); } catch (_err) {}
    }
  }

  function maybeAdvanceRoundAfterEnemyActions(actorTokenId) {
    var state = store.getState();
    var actor = byId(actorTokenId);
    if (!actor || String(actor.faction) !== 'monster') return false;
    var livingEnemies = (state.tokens || []).filter(function (t) {
      return t && String(t.faction) === 'monster' && !isTokenDead(t);
    });
    if (!livingEnemies.length) return false;
    var depleted = livingEnemies.every(function (t) {
      return Math.max(0, Number(state.teamActions && state.teamActions[t.id] || 0)) <= 0;
    });
    if (!depleted) return false;

    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var init = Array.isArray(inner.initiative) ? inner.initiative.slice() : [];
      var wayfarerRowIndex = init.findIndex(function (row) {
        var token = row ? byId(row.tokenId) : null;
        return !!(token && token.isPlayer);
      });
      if (wayfarerRowIndex < 0) wayfarerRowIndex = 0;
      next.round = Math.max(1, Number(inner.round || 1) + 1);
      next.initiativeIndex = wayfarerRowIndex;
      next.currentTurnIndex = wayfarerRowIndex;
      next.teamActions = {};
      (inner.tokens || []).forEach(function (t) {
        if (!normalizeTokenActionBudgetToken(t)) return;
        next.teamActions[t.id] = 2;
      });
      persist(next);
      return next;
    });

    syncWayfarerCombatActionBudget(true);
    addHistory('Enemy actions exhausted. New round begins. Wayfarer actions reset.');
    safeNotif('New round started: Wayfarer actions reset.', 'good');
    processRoundEffectsForCurrentRound();
    updateUiPanels();
    drawBoard();
    return true;
  }

  function rollDie(sides) {
    var s = Math.max(2, Number(sides || 6));
    return 1 + Math.floor(Math.random() * s);
  }

  function rollCombatDieTotal(sides, type, label) {
    var die = Math.max(2, Number(sides || 6));
    if (typeof window.explodingRoll === 'function') {
      var rolled = window.explodingRoll(die, {
        type: type || 'action',
        major: true,
        label: String(label || ('Combat d' + die))
      });
      return Math.max(1, Number(rolled && rolled.total || 1));
    }
    return rollDie(die);
  }

  function parseManualTotalExpression(rawValue) {
    var raw = String(rawValue == null ? '' : rawValue).trim();
    if (!raw) return null;
    if (!/^[+\-\d\s]+$/.test(raw)) return null;
    var compact = raw.replace(/\s+/g, '');
    if (!/^[+-]?\d+(?:[+-]\d+)*$/.test(compact)) return null;
    var parts = compact.match(/[+-]?\d+/g) || [];
    if (!parts.length) return null;
    var total = 0;
    for (var i = 0; i < parts.length; i++) total += Number(parts[i] || 0);
    if (!Number.isFinite(total)) return null;
    return Math.round(total);
  }

  function promptManualDieTotal(message, defaultValue, min, max) {
    var raw = window.prompt(String(message || 'Enter roll total:'), String(defaultValue || 1));
    if (raw === null) return null;
    var n = parseManualTotalExpression(raw);
    if (!Number.isFinite(n)) return null;
    var low = Math.max(1, Number(min || 1));
    return Math.max(low, Math.round(n));
  }

  function parseArmorDefendFlatBonus() {
    var armor = String(window.S && window.S.equipment && window.S.equipment.armor || '');
    if (!armor) return 0;
    var total = 0;
    var m;
    var rxLeading = /([+-]\d+)\s*defend/ig;
    while ((m = rxLeading.exec(armor))) {
      total += Number(m[1] || 0);
    }
    var rxTrailing = /defend\s*([+-]\d+)/ig;
    while ((m = rxTrailing.exec(armor))) {
      total += Number(m[1] || 0);
    }
    return Number.isFinite(total) ? total : 0;
  }

  function parseAffixDefendFlatBonus() {
    var affix = (typeof window.getEquippedAffixCombatBonuses === 'function') ? window.getEquippedAffixCombatBonuses() : null;
    if (!affix || typeof affix !== 'object') return 0;
    var total = 0;
    total += Number(affix.defendFlat || 0);
    total += Number(affix.defendBonus || 0);
    return Number.isFinite(total) ? total : 0;
  }

  function initializeSceneRoundState() {
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var ordered = buildTurnOrder(state.tokens || []);
      var wayfarerIndex = ordered.findIndex(function (row) {
        var token = row ? byId(row.tokenId) : null;
        return !!(token && token.isPlayer);
      });
      if (wayfarerIndex < 0) wayfarerIndex = 0;
      next.round = 1;
      next.initiative = ordered;
      next.initiativeIndex = wayfarerIndex;
      next.currentTurnIndex = wayfarerIndex;
      next.teamActions = {};
      (state.tokens || []).forEach(function (token) {
        if (!normalizeTokenActionBudgetToken(token)) return;
        next.teamActions[token.id] = 2;
      });
      persist(next);
      return next;
    });
    if (window.S && window.S.combat) {
      window.S.combat.round = 1;
      syncWayfarerCombatActionBudget(true);
    }
  }

  function isManualRollModeActive() {
    return !!(window.settingsSystem && typeof window.settingsSystem.isManualRollMode === 'function' && window.settingsSystem.isManualRollMode());
  }

  function skillRangeVerbatim(skill) {
    if (!skill) return 'Engaged';
    var ranges = asEnemySkillRangeArray(skill);
    if (ranges.length) {
      return ranges.map(function (r) {
        var raw = String(r || '').trim();
        if (!raw) return '';
        return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      }).filter(Boolean).join(' / ');
    }
    return 'Engaged';
  }

  function skillSourceVerbatim(skill) {
    if (!skill) return 'Combat Tab';
    var src = String(skill.source || 'Combat Tab').trim();
    var rangeTxt = skillRangeVerbatim(skill);
    var kind = String(skill.kind || 'special').trim();
    return src + ' · ' + kind + ' · Range: ' + rangeTxt.toLowerCase();
  }

  function getEnemySkillSaveLabel(skill) {
    var raw = String((skill && (skill.save || skill.saveStat || skill.stat)) || 'defend').toLowerCase();
    var map = {
      defend: 'Defend',
      body: 'Body',
      mind: 'Mind',
      spirit: 'Spirit',
      strike: 'Strike',
      shoot: 'Shoot',
      control: 'Control',
      lead: 'Lead'
    };
    if (map[raw]) return map[raw];
    if (raw === 'healthstrike' || raw === 'defendcheck') return 'Defend';
    if (raw === 'forcetrauma') return 'Mind';
    if (raw === 'radiation') return 'Spirit';
    if (raw === 'hack') return 'Control';
    return 'Defend';
  }

  function getEnemySkillSaveKey(skill) {
    return String(getEnemySkillSaveLabel(skill) || 'Defend').toLowerCase();
  }

  function getEnemySkillDreadDie(skill, fallback) {
    var fromSkill = Math.max(0, Number(skill && skill.dreadDie || 0));
    if (fromSkill > 0) return Math.max(4, fromSkill);
    return Math.max(4, Number(fallback || 6));
  }

  function getTargetSaveDieForSkill(target, skill) {
    var key = getEnemySkillSaveKey(skill);
    if (target && target.isPlayer) {
      return getWayfarerEffectiveDie(key, getWayfarerEffectiveDie('defend', 6));
    }
    if (target) {
      if (key === 'defend') return Math.max(4, Number(target.defend || target.dread || target.codexDread || 6));
      return Math.max(4, Number(target[key] || target.defend || target.dread || target.codexDread || 6));
    }
    return 6;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getWayfarerEffectiveDie(key, fallback) {
    var statKey = String(key || '').toLowerCase();
    try {
      if (typeof window.getEffectiveDie === 'function') {
        return Math.max(4, Number(window.getEffectiveDie(statKey) || fallback || 4));
      }
    } catch (_err) {}
    var stats = window.S && window.S.stats ? window.S.stats : {};
    return Math.max(4, Number(stats[statKey] || fallback || 4));
  }

  function getWayfarerConditionState() {
    var src = window.S && window.S.conditions && typeof window.S.conditions === 'object' ? window.S.conditions : {};
    return Object.assign({
      empowered: false,
      protected: false,
      focused: false,
      bolstered: false,
      weakened: false,
      vulnerable: false,
      distracted: false,
      shaken: false
    }, src);
  }

  function getCombatAssetGlyph(name, layer) {
    var lower = String(name || '').toLowerCase();
    var scope = String(layer || '').toLowerCase();
    if (scope === 'hazards') {
      if (lower.indexOf('trap') >= 0) return '⚠';
      if (lower.indexOf('fire') >= 0 || lower.indexOf('lava') >= 0) return '🔥';
      if (lower.indexOf('acid') >= 0 || lower.indexOf('poison') >= 0) return '☣';
      return '⚡';
    }
    if (scope === 'terrain') {
      if (lower.indexOf('forest') >= 0) return '🌲';
      if (lower.indexOf('marsh') >= 0 || lower.indexOf('swamp') >= 0) return '🌿';
      if (lower.indexOf('crag') >= 0 || lower.indexOf('rock') >= 0) return '⛰';
      if (lower.indexOf('lava') >= 0) return '🌋';
      if (lower.indexOf('ruin') >= 0) return '🏛';
      if (lower.indexOf('water') >= 0) return '🌊';
      if (lower.indexOf('road') >= 0) return '🛣';
      if (lower.indexOf('difficult') >= 0) return '🪨';
      return '🗺';
    }
    if (lower.indexOf('terrain-forest') >= 0 || lower.indexOf('forest') >= 0) return '🌲';
    if (lower.indexOf('terrain-marsh') >= 0 || lower.indexOf('marsh') >= 0 || lower.indexOf('swamp') >= 0) return '🌿';
    if (lower.indexOf('terrain-crags') >= 0 || lower.indexOf('terrain-crag') >= 0 || lower.indexOf('crag') >= 0 || lower.indexOf('rock') >= 0) return '⛰';
    if (lower.indexOf('terrain-lava') >= 0 || lower.indexOf('lava') >= 0) return '🌋';
    if (lower.indexOf('terrain-ruins') >= 0 || lower.indexOf('ruin') >= 0) return '🏛';
    if (lower.indexOf('terrain-water') >= 0 || lower.indexOf('water') >= 0) return '🌊';
    if (lower.indexOf('terrain-road') >= 0 || lower.indexOf('road') >= 0) return '🛣';
    if (lower.indexOf('door') >= 0) return '🚪';
    if (lower.indexOf('turret') >= 0) return '🔫';
    if (lower.indexOf('trap') >= 0) return '⚠';
    if (lower.indexOf('shrine') >= 0 || lower.indexOf('altar') >= 0) return '🕯';
    if (lower.indexOf('spawn') >= 0) return '✹';
    if (lower.indexOf('wall') >= 0) return '🧱';
    if (lower.indexOf('vision-blocker') >= 0) return '🌫';
    if (lower.indexOf('crate') >= 0 || lower.indexOf('loot-cache') >= 0 || lower.indexOf('loot') >= 0) return '📦';
    if (lower.indexOf('pillar') >= 0) return '🗿';
    if (lower.indexOf('barricade') >= 0) return '🚧';
    if (lower.indexOf('console') >= 0) return '💻';
    if (lower.indexOf('beacon') >= 0) return '📡';
    return '🧩';
  }

  function drawAssetGlyph(ctx, glyph, x, y, fillStyle, borderStyle) {
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = borderStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 11, 22, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(String(glyph || '•'), x, y + 0.5);
    ctx.restore();
  }

  function syncLegacyEnemyStressToTokens(targetTokenId) {
    if (!window.S || !Array.isArray(window.S.enemies)) return false;

    function enemyNameCanonicalKey(name) {
      return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*$/, '')
        .replace(/\s+#?\d+\s*$/, '')
        .trim();
    }

    function enemyNameOrdinal(name) {
      var m = String(name || '').trim().match(/(?:#|\s)(\d+)\s*$/);
      if (!m) return 0;
      return Math.max(0, Number(m[1] || 0));
    }

    var enemyMap = {};
    var enemyNameMap = {};
    var enemyCanonicalMap = {};
    window.S.enemies.forEach(function (enemy) {
      if (!enemy) return;
      var id = Number(enemy.id || 0);
      if (id > 0) enemyMap[id] = enemy;
      var nameKey = String(enemy.name || '').trim().toLowerCase();
      if (!enemy.ally && nameKey && !enemyNameMap[nameKey]) enemyNameMap[nameKey] = enemy;
      var canonicalKey = enemyNameCanonicalKey(enemy.name || '');
      if (!enemy.ally && canonicalKey) {
        if (!Array.isArray(enemyCanonicalMap[canonicalKey])) enemyCanonicalMap[canonicalKey] = [];
        enemyCanonicalMap[canonicalKey].push(enemy);
      }
    });
    Object.keys(enemyCanonicalMap).forEach(function (key) {
      enemyCanonicalMap[key].sort(function (a, b) {
        return Number(a && a.id || 0) - Number(b && b.id || 0);
      });
    });
    var changed = false;
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (row) {
        if (!row || String(row.faction || '') !== 'monster') return row;
        if (targetTokenId && String(row.id || '') !== String(targetTokenId)) return row;
        var sourceId = Number(row.sourceEnemyId || 0);
        var legacy = sourceId > 0 ? (enemyMap[sourceId] || null) : null;
        if (!legacy) {
          var rowNameKey = String(row.name || '').trim().toLowerCase();
          legacy = rowNameKey ? (enemyNameMap[rowNameKey] || null) : null;
        }
        if (!legacy) {
          var canonicalName = enemyNameCanonicalKey(row.name || '');
          var canonicalPool = canonicalName ? enemyCanonicalMap[canonicalName] : null;
          if (canonicalPool && canonicalPool.length) {
            if (canonicalPool.length === 1) {
              legacy = canonicalPool[0];
            } else {
              var ordinal = enemyNameOrdinal(row.name || '');
              if (ordinal > 0) legacy = canonicalPool[Math.max(0, Math.min(canonicalPool.length - 1, ordinal - 1))] || null;
            }
          }
        }
        if (!legacy) return row;
        var nextHp = 0;
        var nextMax = Math.max(1, Number(row.maxHp || row.hp || 1));
        var nextDead = true;
        nextMax = Math.max(1, Number(legacy.maxStress || nextMax));
        nextHp = Math.max(0, nextMax - Math.max(0, Number(legacy.stress || 0)));
        nextDead = nextHp <= 0;
        var nextSourceEnemyId = Number(row.sourceEnemyId || 0) || Number(legacy.id || 0);
        if (Number(row.hp || 0) === nextHp && Number(row.maxHp || 0) === nextMax && !!row.dead === nextDead && Number(row.sourceEnemyId || 0) === nextSourceEnemyId) return row;
        changed = true;
        return Object.assign({}, row, {
          hp: nextHp,
          maxHp: nextMax,
          dead: nextDead,
          sourceEnemyId: nextSourceEnemyId,
          dread: legacy ? Math.max(4, Number(legacy.dread || row.dread || 6)) : row.dread,
          deathNumber: legacy ? Math.max(1, Number(legacy.deathNumber || row.deathNumber || row.dread || 6)) : row.deathNumber
        });
      });
      if (!changed) return state;
      persist(next);
      return next;
    });
    if (changed) {
      drawBoard();
      updateUiPanels();
    }
    return changed;
  }

  function consumeWayfarerUtilityAction(actionLabel) {
    if (!isSceneActive()) return true;
    var actor = byId(store.getState().selectedTokenId);
    if (!actor || (!actor.isPlayer && String(actor.faction || '') !== 'player')) return true;
    if (typeof window.consumeCombatAction === 'function') {
      try {
        return !!window.consumeCombatAction(String(actionLabel || 'Utility Action'));
      } catch (_err) {
        return false;
      }
    }
    if (!window.S || !window.S.combat) return true;
    var left = Math.max(0, Number(window.S.combat.actionsLeft || 0));
    if (left <= 0) return false;
    window.S.combat.actionsLeft = left - 1;
    if (typeof window.updateCombatUI === 'function') {
      try { window.updateCombatUI(); } catch (_err2) {}
    }
    return true;
  }

  function getCombatActionDieOptions() {
    return [
      { key: 'strike', label: 'Strike' },
      { key: 'shoot', label: 'Shoot' },
      { key: 'defend', label: 'Defend' },
      { key: 'control', label: 'Control' },
      { key: 'body', label: 'Body' },
      { key: 'mind', label: 'Mind' },
      { key: 'spirit', label: 'Spirit' },
      { key: 'lead', label: 'Lead' }
    ];
  }

  function ensureLootCacheObjectAt(q, r) {
    var key = toKey(q, r);
    store.setState(function (state) {
      var current = String(state.layers && state.layers.objects && state.layers.objects[key] || '');
      if (current === 'loot-cache') return state;
      var next = Object.assign({}, state);
      next.layers = Object.assign({}, state.layers || {});
      next.layers.objects = Object.assign({}, state.layers && state.layers.objects || {});
      next.layers.objects[key] = 'loot-cache';
      persist(next);
      return next;
    });
  }

  function rollLootCacheAffixLabel() {
    var catalog = getRaidSoulforgeAffixPool();
    return String(catalog[Math.floor(Math.random() * catalog.length)] || 'Ashbound');
  }

  function buildLootCacheItems(config) {
    var cfg = Object.assign({ credits: true, items: true, affixes: true, tier: 8 }, config && typeof config === 'object' ? config : {});
    var out = [];
    var tier = Math.max(1, Number(cfg.tier || 8));
    if (cfg.credits) {
      var minCredits = Math.max(10, tier * 4);
      var maxCredits = Math.max(minCredits, tier * 10);
      var credits = Math.max(minCredits, minCredits + Math.floor(Math.random() * (maxCredits - minCredits + 1)));
      out.push('Credits x' + String(credits));
    }
    if (cfg.items) {
      var rolled = pickMerchantLootItemsForToken(tier);
      if (rolled.length) {
        rolled.forEach(function (entry) { out.push(entry); });
      } else {
        out.push('Traveler Supplies');
      }
    }
    if (cfg.affixes) {
      var affixCount = Math.max(1, Math.min(2, Math.ceil(tier / 8)));
      for (var i = 0; i < affixCount; i++) {
        out.push('Affix Sigil [' + rollLootCacheAffixLabel() + ']');
      }
    }
    return out;
  }

  function getHazardCheckConfigAt(state, q, r, profile) {
    var rules = ensureCombatSceneRulesExtensions(state && state.sceneRules || {});
    var key = toKey(q, r);
    var fromRules = rules.hazardChecks && rules.hazardChecks[key] || null;
    var objects = layerTextValue(state, 'objects', q, r);
    var hazards = layerTextValue(state, 'hazards', q, r);
    var hazardLabel = String(hazards || objects || 'Hazard').trim() || 'Hazard';
    var defaultDd = Math.max(4, Math.min(20, 4 + Math.max(1, Number(profile && profile.hazardDamage || 1)) * 2));
    return {
      key: key,
      label: String(fromRules && fromRules.label || hazardLabel),
      dd: Math.max(4, Math.min(20, Number(fromRules && fromRules.dd || defaultDd))),
      dieKey: String(fromRules && fromRules.dieKey || 'defend'),
      onFailDamage: Math.max(1, Number(fromRules && fromRules.onFailDamage || profile && profile.hazardDamage || 1))
    };
  }

  function buildHazardConfigModalHtml(q, r) {
    var state = store.getState();
    var profile = getLayerGameplayProfile(state, q, r);
    var current = getHazardCheckConfigAt(state, q, r, profile);
    var dieOptions = getCombatActionDieOptions().map(function (entry) {
      return '<option value="' + entry.key + '" ' + (entry.key === current.dieKey ? 'selected' : '') + '>' + escapeHtml(entry.label) + '</option>';
    }).join('');
    return ''
      + '<div class="combat-rules-shell" data-hazard-config-key="' + toKey(q, r) + '">'
      + '<div style="display:grid;gap:.5rem;">'
      + '<div class="combat-mini">Configure the hazard at <strong>' + toKey(q, r) + '</strong>. Players can choose which die to risk when the check resolves.</div>'
      + '<label style="display:grid;gap:.2rem;"><span class="combat-mini">Hazard Label</span><input id="combatHazardConfigLabel" class="combat-input" type="text" value="' + escapeHtml(String(current.label || 'Hazard')) + '"></label>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.45rem;">'
      + '<label style="display:grid;gap:.2rem;"><span class="combat-mini">Difficulty (DD)</span><input id="combatHazardConfigDd" class="combat-input" type="number" min="4" max="20" value="' + Number(current.dd || 4) + '"></label>'
      + '<label style="display:grid;gap:.2rem;"><span class="combat-mini">Fail Damage</span><input id="combatHazardConfigDamage" class="combat-input" type="number" min="1" max="10" value="' + Number(current.onFailDamage || 1) + '"></label>'
      + '</div>'
      + '<label style="display:grid;gap:.2rem;"><span class="combat-mini">Suggested Die</span><select id="combatHazardConfigDie" class="combat-select">' + dieOptions + '</select></label>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end;">'
      + '<button class="btn btn-xs" type="button" onclick="window.clearCombatHazardConfig&&window.clearCombatHazardConfig(' + Number(q || 0) + ',' + Number(r || 0) + ')">Clear</button>'
      + '<button class="btn btn-xs btn-primary" type="button" onclick="window.applyCombatHazardConfig&&window.applyCombatHazardConfig(' + Number(q || 0) + ',' + Number(r || 0) + ')">Apply Hazard</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function resolveHazardCheckForToken(tokenId, q, r, config) {
    var token = byId(tokenId);
    if (!token) {
      safeNotif('Select a token to run hazard checks.', 'warn');
      return false;
    }
    var state = store.getState();
    var profile = getLayerGameplayProfile(state, q, r);
    var cfg = getHazardCheckConfigAt(state, q, r, profile);
    var actionDice = getCombatActionDieOptions();
    var requestedDie = String(config && config.dieKey || cfg.dieKey || 'defend');
    var dieChoice = actionDice.find(function (entry) { return entry.key === requestedDie; }) || actionDice[0];
    var dieSides = Math.max(2, Number(getWayfarerEffectiveDie(dieChoice.key, 6) || 6));
    var manualMode = !state.autoRoll || isManualRollModeActive();
    var total = manualMode
      ? Number(config && config.manualTotal)
      : rollCombatDieTotal(dieSides, 'action', 'Hazard Check (' + dieChoice.label + ')');
    if (!Number.isFinite(total)) {
      safeNotif('Enter a valid hazard total before resolving.', 'warn');
      return false;
    }
    var success = Number(total) >= Number(cfg.dd);
    if (success) {
      addHistory(String(token.name || 'Token') + ' clears hazard check (' + cfg.label + ') with ' + dieChoice.label + ' ' + total + ' vs DD' + cfg.dd + '.');
      safeNotif('Hazard check passed.', 'good');
      return true;
    }
    var failDamage = Math.max(1, Number(config && config.failDamage || cfg.onFailDamage || profile && profile.hazardDamage || 1));
    applyDamageToToken(token.id, failDamage, 'Hazard');
    addHistory(String(token.name || 'Token') + ' fails hazard check (' + cfg.label + ') with ' + dieChoice.label + ' ' + total + ' vs DD' + cfg.dd + ' and takes ' + failDamage + ' damage.');
    safeNotif('Hazard check failed: ' + failDamage + ' damage.', 'warn');
    return false;
  }

  function buildHazardCheckModalHtml(token, q, r, profile, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = store.getState();
    var cfg = getHazardCheckConfigAt(state, q, r, profile || getLayerGameplayProfile(state, q, r));
    var actionDice = getCombatActionDieOptions().map(function (entry) {
      var sides = Math.max(2, Number(getWayfarerEffectiveDie(entry.key, 6) || 6));
      return '<option value="' + entry.key + '" ' + (entry.key === cfg.dieKey ? 'selected' : '') + '>' + escapeHtml(entry.label) + ' (d' + sides + ')</option>';
    }).join('');
    var manualMode = !state.autoRoll || isManualRollModeActive();
    return ''
      + '<div class="combat-rules-shell" data-hazard-check-key="' + toKey(q, r) + '">'
      + '<div style="display:grid;gap:.5rem;">'
      + '<div class="combat-mini"><strong>' + escapeHtml(String(token && token.name || 'Token')) + '</strong> is resolving <strong>' + escapeHtml(String(cfg.label || 'Hazard')) + '</strong> at ' + toKey(q, r) + ' against DD ' + Number(cfg.dd || 4) + '.</div>'
      + '<label style="display:grid;gap:.2rem;"><span class="combat-mini">Chosen Die</span><select id="combatHazardRunDie" class="combat-select">' + actionDice + '</select></label>'
      + '<label style="display:grid;gap:.2rem;"><span class="combat-mini">' + (manualMode ? 'Manual Total' : 'Override Total (optional)') + '</span><input id="combatHazardRunTotal" class="combat-input" type="number" min="1" value="' + (manualMode ? Math.max(1, Math.floor(Number(getWayfarerEffectiveDie(cfg.dieKey, 6) || 6) / 2)) : '') + '" placeholder="' + (manualMode ? 'Required in manual mode (1+, explode ok)' : 'Leave blank to auto-roll') + '"></label>'
      + '<div class="combat-mini">Fail damage: ' + Number(opts.failDamage || cfg.onFailDamage || 1) + '</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end;">'
      + '<button class="btn btn-xs" type="button" onclick="window.closeModal&&window.closeModal()">Cancel</button>'
      + '<button class="btn btn-xs btn-primary" id="combatHazardResolveBtn" type="button" onclick="window.resolveCombatHazardCheck&&window.resolveCombatHazardCheck(\'' + String(token && token.id || '').replace(/'/g, "\\'") + '\',' + Number(q || 0) + ',' + Number(r || 0) + ',' + Number(opts.failDamage || cfg.onFailDamage || 1) + ')">Resolve Check</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function openHazardCheckModal(token, q, r, profile, options) {
    if (!token) {
      safeNotif('Select a token to run hazard checks.', 'warn');
      return false;
    }
    if (typeof window.openModal === 'function') {
      window.openModal('Hazard Check', buildHazardCheckModalHtml(token, q, r, profile, options), null, { preventScroll: true, focusTrap: true });
      return true;
    }
    return false;
  }

  function buildLootCacheModalHtml(q, r) {
    var state = store.getState();
    var key = toKey(q, r);
    var rules = ensureCombatSceneRulesExtensions(state.sceneRules);
    var cache = rules.mapLootCaches && rules.mapLootCaches[key] || null;
    var items = cache && Array.isArray(cache.items) ? cache.items : [];
    var itemHtml = items.length
      ? '<div class="combat-feed" style="max-height:160px;">' + items.map(function (item) { return '<div class="combat-feed-line">' + escapeHtml(String(item || '')) + '</div>'; }).join('') + '</div>'
      : '<div class="combat-mini">No generated rewards yet. Stock the cache to seed raid and Soul Forge rewards.</div>';
    return ''
      + '<div class="combat-rules-shell" data-loot-cache-key="' + key + '">'
      + '<div style="display:grid;gap:.5rem;">'
      + '<div class="combat-mini">Manage the loot cache at <strong>' + key + '</strong>.</div>'
      + '<label style="display:grid;gap:.2rem;"><span class="combat-mini">Stocking Mode</span><select id="combatLootCacheMode" class="combat-select"><option value="balanced">Balanced</option><option value="credits">Credits Only</option><option value="items-affixes">Items + Affixes</option></select></label>'
      + '<label style="display:grid;gap:.2rem;"><span class="combat-mini">Tier</span><input id="combatLootCacheTier" class="combat-input" type="number" min="1" max="20" value="8"></label>'
      + '<div><div class="combat-mini" style="margin-bottom:.2rem;">Current Cache</div>' + itemHtml + '</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end;">'
      + '<button class="btn btn-xs" type="button" onclick="window.deleteCombatMapItemByKey&&window.deleteCombatMapItemByKey(\'objects\',\'' + key + '\')">Delete Cache</button>'
      + '<button class="btn btn-xs btn-primary" id="combatLootCacheStockBtn" type="button" onclick="window.applyCombatLootCacheModal&&window.applyCombatLootCacheModal(' + Number(q || 0) + ',' + Number(r || 0) + ')">Stock Cache</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function openLootCacheModal(q, r) {
    if (!isGmController()) {
      safeNotif('Only the GM can stock loot caches.', 'warn');
      return false;
    }
    ensureLootCacheObjectAt(q, r);
    if (typeof window.openModal === 'function') {
      window.openModal('Loot Cache Controls', buildLootCacheModalHtml(q, r), null, { preventScroll: true, focusTrap: true });
      return true;
    }
    return false;
  }

  // Player-facing: take items out of a map loot cache (by hex key).
  function takeLootFromMapCache(cacheKey, selectedIndexes) {
    var state = store.getState();
    var rules = ensureCombatSceneRulesExtensions(state.sceneRules || {});
    var cache = rules.mapLootCaches && rules.mapLootCaches[cacheKey] || null;
    if (!cache || !Array.isArray(cache.items) || !cache.items.length) {
      safeNotif('Cache is empty.', 'warn');
      closeLootPopup();
      return 0;
    }
    var items = cache.items.slice();
    var unique = {};
    var rawIdxs = Array.isArray(selectedIndexes) ? selectedIndexes : items.map(function (_r, i) { return i; });
    var idxs = rawIdxs.map(Number).filter(function (i) {
      return Number.isFinite(i) && i >= 0 && i < items.length && !unique[i] && (unique[i] = true);
    }).sort(function (a, b) { return a - b; });
    if (!idxs.length) { safeNotif('Pick at least one item.', 'warn'); return 0; }
    var taken = idxs.map(function (i) { return items[i]; });
    taken.forEach(function (item) {
      if (typeof window.addToBackpack === 'function') { try { window.addToBackpack(item); } catch (_e) {} }
    });
    var kept = items.filter(function (_item, i) { return idxs.indexOf(i) < 0; });
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var r2 = ensureCombatSceneRulesExtensions(inner.sceneRules || {});
      r2.mapLootCaches = Object.assign({}, r2.mapLootCaches || {});
      if (r2.mapLootCaches[cacheKey]) {
        r2.mapLootCaches[cacheKey] = Object.assign({}, r2.mapLootCaches[cacheKey], { items: kept });
      }
      next.sceneRules = r2;
      persist(next);
      return next;
    });
    addHistory('Looted cache ' + cacheKey + ': ' + taken.join(', ') + '.');
    safeNotif('Collected ' + taken.length + ' item' + (taken.length === 1 ? '' : 's') + ' from cache.', 'good');
    if (typeof window.renderBackpackUI === 'function') window.renderBackpackUI();
    if (typeof window.renderCombatBackpackPanel === 'function') window.renderCombatBackpackPanel();
    drawBoard();
    if (kept.length) openPlayerLootCacheAt(
      Number(state.board ? (cache.q !== undefined ? cache.q : 0) : 0),
      Number(state.board ? (cache.r !== undefined ? cache.r : 0) : 0)
    );
    else closeLootPopup();
    return taken.length;
  }

  // Open the shared loot popup to show a map cache's items.
  function openPlayerLootCacheAt(q, r, anchorX, anchorY) {
    var state = store.getState();
    var rules = ensureCombatSceneRulesExtensions(state.sceneRules || {});
    var key = toKey(q, r);
    var cache = rules.mapLootCaches && rules.mapLootCaches[key] || null;
    var items = cache && Array.isArray(cache.items) ? cache.items : [];
    var card = document.getElementById('combatLootPopupCard');
    var titleEl = document.getElementById('combatLootPopupTitle');
    var metaEl = document.getElementById('combatLootPopupMeta');
    var listEl = document.getElementById('combatLootPopupList');
    var takeAllBtn = document.getElementById('combatLootTakeAllBtn');
    var takeSelBtn = document.getElementById('combatLootTakeSelectedBtn');
    if (!card || !titleEl || !metaEl || !listEl) return;
    if (!items.length) { safeNotif('This cache is empty.', 'warn'); return; }
    // Tag the card as a cache popup (vs body-loot popup)
    card.dataset.tokenId = '';
    card.dataset.cacheKey = key;
    card.dataset.cacheQ = String(q || 0);
    card.dataset.cacheR = String(r || 0);
    titleEl.textContent = 'Loot Cache \u2014 ' + key;
    var bpCap = typeof window.getBackpackCapacity === 'function' ? window.getBackpackCapacity() : 6;
    var bpUsed = 0;
    if (window.S && Array.isArray(window.S.backpack)) {
      window.S.backpack.forEach(function (s) { if (s && s.trim()) bpUsed += getItemSlotCost(String(s).replace(/\s*x\d+$/i, '').trim()); });
    }
    var bpColor = bpUsed >= bpCap ? '#e05050' : bpUsed >= bpCap - 1 ? '#e3bc5e' : '#57d69b';
    metaEl.innerHTML = items.length + ' item' + (items.length === 1 ? '' : 's') + ' available'
      + ' &nbsp;<span style="font-size:.7rem;color:' + bpColor + ';">Backpack: ' + bpUsed + '/' + bpCap + ' slots</span>';
    listEl.innerHTML = items.map(function (item, idx) {
      var label = String(item || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var name = String(item || '').replace(/\s*x\d+$/i, '').trim();
      var cost = getItemSlotCost(name);
      var over = (bpUsed + cost) > bpCap;
      return '<label style="display:flex;align-items:center;gap:.3rem;padding:.12rem .14rem;border:1px solid rgba(255,255,255,.08);border-radius:6px;">'
        + '<input type="checkbox" data-loot-idx="' + idx + '">'
        + '<span style="flex:1;font:.8rem Rajdhani,sans-serif;color:' + (over ? '#e09070' : '#f7f7f7') + ';">' + label + '</span>'
        + '<span style="font-size:.63rem;color:' + (over ? '#e05050' : 'var(--muted2)') + ';background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:3px;padding:.03rem .18rem;">'
        + cost + (cost === 1 ? ' slot' : ' slots') + '</span>'
        + '</label>';
    }).join('');
    if (takeAllBtn) takeAllBtn.disabled = false;
    if (takeSelBtn) takeSelBtn.disabled = false;
    // Position
    card.style.display = 'block';
    card.style.position = 'fixed';
    var wrap = document.getElementById('combatCanvasWrap');
    var rect = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    var cx = typeof anchorX === 'number' ? anchorX + rect.left : rect.left + rect.width / 2;
    var cy = typeof anchorY === 'number' ? anchorY + rect.top : rect.top + rect.height / 2;
    card.style.left = Math.min(Math.max(8, cx + 14), window.innerWidth - 280) + 'px';
    card.style.top = Math.min(Math.max(8, cy + 14), window.innerHeight - 260) + 'px';
    card.setAttribute('tabindex', '-1');
    try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); }
  }

  function configureHazardCheckAt(q, r) {
    if (!isGmController()) {
      safeNotif('Only the GM can configure hazard checks.', 'warn');
      return false;
    }
    if (typeof window.openModal === 'function') {
      window.openModal('Hazard Configuration', buildHazardConfigModalHtml(q, r), null, { preventScroll: true, focusTrap: true });
      return true;
    }
    return false;
  }

  function runHazardCheckDialogForToken(token, q, r, profile, options) {
    return openHazardCheckModal(token, q, r, profile, options);
  }

  function stockLootCacheAt(q, r, options) {
    if (!isGmController()) {
      safeNotif('Only the GM can stock loot caches.', 'warn');
      return false;
    }
    var cfg = Object.assign({ credits: true, items: true, affixes: true, tier: 8 }, options && typeof options === 'object' ? options : {});
    var key = toKey(q, r);
    var stocked = [];
    ensureLootCacheObjectAt(q, r);
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var rules = ensureCombatSceneRulesExtensions(ensureLootDrops(state));
      rules.mapLootCaches = Object.assign({}, rules.mapLootCaches || {});
      stocked = buildLootCacheItems(cfg);
      if (!stocked.length) stocked = ['Credits x40', 'Traveler Supplies'];
      rules.mapLootCaches[key] = {
        id: uid('cache'),
        q: Number(q || 0),
        r: Number(r || 0),
        items: stocked.slice(),
        config: Object.assign({}, cfg),
        stockedAt: Date.now()
      };
      next.sceneRules = rules;
      persist(next);
      return next;
    });
    addHistory('Loot cache stocked at ' + key + ': ' + stocked.join(', ') + '.');
    safeNotif('Loot cache stocked with generated rewards.', 'good');
    return true;
  }

  function enemySkillCardHtml(entry, actorName, dreadDie, targetName, tacticText) {
    if (!entry || !entry.skill) return '';
    var skill = entry.skill;
    var title = escapeHtml(String(skill.name || 'Enemy Skill'));
    var description = escapeHtml(String(skill.desc || skill.description || skill.text || ''));
    var saveTxt = escapeHtml(getEnemySkillSaveLabel(skill));
    var rangeTxt = escapeHtml(skillRangeVerbatim(skill));
    var rollTxt = escapeHtml(saveTxt + ' vs Dread d' + Number(getEnemySkillDreadDie(skill, dreadDie || 6)));
    var failTxt = escapeHtml(String(skill.onFail || 'Apply effect.'));
    var successTxt = escapeHtml(String(skill.onSuccess || 'Resist the effect.'));
    var sourceTxt = escapeHtml(skillSourceVerbatim(skill));
    var costTxt = '1 Action';
    var actorTxt = escapeHtml(String(actorName || 'Enemy'));
    var targetTxt = escapeHtml(String(targetName || 'Target'));
    var stateBadge = entry.inRange
      ? '<span style="font-size:.68rem;color:#57d69b;">In Range</span>'
      : '<span style="font-size:.68rem;color:#e59b73;">Out of Range</span>';
    var tacticRow = tacticText
      ? ('<div style="margin-top:.22rem;font-size:.72rem;color:var(--muted2);"><strong style="color:var(--combat-accent-2);">Tactic:</strong> ' + escapeHtml(String(tacticText || '')) + '</div>')
      : '';
    return ''
      + '<div style="margin-top:.18rem;border:1px solid rgba(227,188,94,.35);background:rgba(9,13,24,.92);padding:.38rem .44rem;border-radius:8px;">'
      + '<div style="display:flex;justify-content:space-between;gap:.35rem;align-items:baseline;">'
      + '<div style="font-size:.84rem;font-weight:700;color:var(--combat-accent-2);">' + title + '</div>'
      + stateBadge
      + '</div>'
      + (description ? '<div style="margin-top:.16rem;font-size:.72rem;color:var(--text2);line-height:1.45;">' + description + '</div>' : '')
      + '<div style="font-size:.72rem;color:var(--text2);margin-top:.2rem;">'
      + '<div><strong>Save:</strong> ' + saveTxt + '</div>'
      + '<div><strong>Range:</strong> ' + rangeTxt + '</div>'
      + '<div><strong>Cost:</strong> ' + costTxt + '</div>'
      + '<div><strong>Roll:</strong> ' + rollTxt + '</div>'
      + '<div><strong>On Fail:</strong> ' + failTxt + '</div>'
      + '<div><strong>On Success:</strong> ' + successTxt + '</div>'
      + '<div><strong>Source:</strong> ' + sourceTxt + '</div>'
      + '</div>'
      + tacticRow
      + '<div style="margin-top:.18rem;font-size:.68rem;color:var(--muted2);">' + actorTxt + ' targeting ' + targetTxt + '</div>'
      + '</div>';
  }

  function pushEnemySkillNarration(actor, skill, dreadDie) {
    if (!actor || !skill) return;
    addHistory(String(actor.name || 'Enemy') + ' uses ' + String(skill.name || 'Enemy Skill'));
    addHistory('Save: ' + getEnemySkillSaveLabel(skill));
    addHistory('Range: ' + skillRangeVerbatim(skill));
    addHistory('Roll: ' + getEnemySkillSaveLabel(skill) + ' vs Dread d' + Number(getEnemySkillDreadDie(skill, dreadDie || 6)));
    addHistory('On Fail: ' + String(skill.onFail || 'Apply effect.'));
    addHistory('On Success: ' + String(skill.onSuccess || 'Resist the effect.'));
    addHistory('Source: ' + skillSourceVerbatim(skill));
  }

  function extractTimedConditionText(onFail) {
    var txt = String(onFail || '');
    var m = txt.match(/apply\s+([^\.]+?)(?:\.|$)/i);
    if (!m) return '';
    return String(m[1] || '').trim();
  }

  function resolveEnemySkillStress(skill, margin) {
    var row = skill && typeof skill === 'object' ? skill : {};
    var mode = String(row.damageMode || 'margin').toLowerCase();
    var base = Math.max(0, Number(row.onFailStress || 0));
    var bonus = Math.max(0, Number(row.onFailStressBonus || 0));
    var m = Math.max(1, Number(margin || 1));
    if (mode === 'flat') return Math.max(0, base + bonus);
    if (mode === 'margin_plus') return Math.max(1, m + bonus + (base > 0 ? base : 0));
    return Math.max(1, m + bonus);
  }

  function setTokenStatusFlag(tokenId, statusLabel) {
    var id = String(tokenId || '');
    var label = String(statusLabel || '').trim().toLowerCase();
    if (!id || !label) return false;
    var applied = false;
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (row) {
        if (!row || String(row.id) !== id) return row;
        var statuses = Array.isArray(row.status) ? row.status.slice() : [];
        if (statuses.indexOf(label) < 0) statuses.push(label);
        applied = true;
        return Object.assign({}, row, { status: statuses });
      });
      if (!applied) return state;
      persist(next);
      return next;
    });
    return applied;
  }

  function healTokenHp(tokenId, amount) {
    var id = String(tokenId || '');
    var heal = Math.max(0, Number(amount || 0));
    if (!id || !heal) return 0;
    var finalHp = 0;
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var changed = false;
      next.tokens = (state.tokens || []).map(function (row) {
        if (!row || String(row.id) !== id) return row;
        var maxHp = Math.max(1, Number(row.maxHp || row.hp || heal));
        var hpNow = Math.max(0, Number(row.hp || 0));
        finalHp = Math.min(maxHp, hpNow + heal);
        changed = true;
        return Object.assign({}, row, { hp: finalHp, dead: finalHp <= 0 });
      });
      if (!changed) return state;
      persist(next);
      return next;
    });
    return finalHp;
  }

  function isWayfarerSideToken(token) {
    return !!(token && !isTokenDead(token) && (token.isPlayer || String(token.faction || '') === 'player'));
  }

  function buildAoeZoneLineHexes(state, actor, center, length) {
    var out = [];
    var start = { q: Number(actor && actor.q || 0), r: Number(actor && actor.r || 0) };
    var target = { q: Number(center && center.q || 0), r: Number(center && center.r || 0) };
    var line = axialLine(start, target);
    var nextHex = line.length > 1 ? line[1] : target;
    var dq = Number(nextHex && nextHex.q || target.q) - Number(start.q || 0);
    var dr = Number(nextHex && nextHex.r || target.r) - Number(start.r || 0);
    if (!dq && !dr) {
      dq = 1;
      dr = 0;
    }
    for (var i = 1; i <= Math.max(1, Number(length || 4)); i++) {
      var q = Number(start.q || 0) + dq * i;
      var r = Number(start.r || 0) + dr * i;
      if (Math.abs(q) > Number(state && state.board && state.board.cols || 22)) continue;
      if (Math.abs(r) > Number(state && state.board && state.board.rows || 16)) continue;
      out.push({ q: q, r: r });
    }
    return out;
  }

  function buildAoeZoneRingHexes(state, center, innerRadius, outerRadius) {
    var out = [];
    var c = { q: Number(center && center.q || 0), r: Number(center && center.r || 0) };
    var minR = Math.max(0, Number(innerRadius || 0));
    var maxR = Math.max(minR, Number(outerRadius || minR));
    for (var q = c.q - maxR; q <= c.q + maxR; q++) {
      for (var r = c.r - maxR; r <= c.r + maxR; r++) {
        if (Math.abs(q) > Number(state && state.board && state.board.cols || 22)) continue;
        if (Math.abs(r) > Number(state && state.board && state.board.rows || 16)) continue;
        var dist = hexDistance(c, { q: q, r: r });
        if (dist < minR || dist > maxR) continue;
        out.push({ q: q, r: r });
      }
    }
    return out;
  }

  function buildAoeZoneBurstHexes(state, center, radius) {
    return buildAoeZoneRingHexes(state, center, 0, Math.max(0, Number(radius || 1)));
  }

  function getAxialDirectionKeyFromDelta(dq, dr) {
    var q = Number(dq || 0);
    var r = Number(dr || 0);
    if (q === 1 && r === 0) return 'e';
    if (q === 1 && r === -1) return 'ne';
    if (q === 0 && r === -1) return 'nw';
    if (q === -1 && r === 0) return 'w';
    if (q === -1 && r === 1) return 'sw';
    if (q === 0 && r === 1) return 'se';
    return 'e';
  }

  function stepAxialByDirection(origin, dirKey, stepCount) {
    var amount = Math.max(0, Number(stepCount || 0));
    var lookup = {
      e: { dq: 1, dr: 0 },
      ne: { dq: 1, dr: -1 },
      nw: { dq: 0, dr: -1 },
      w: { dq: -1, dr: 0 },
      sw: { dq: -1, dr: 1 },
      se: { dq: 0, dr: 1 }
    };
    var vec = lookup[String(dirKey || '').toLowerCase()] || lookup.e;
    return {
      q: Number(origin && origin.q || 0) + Number(vec.dq || 0) * amount,
      r: Number(origin && origin.r || 0) + Number(vec.dr || 0) * amount
    };
  }

  function buildAoeZoneConeHexes(state, actor, center, length, width) {
    var out = [];
    var keyMap = {};
    var start = { q: Number(actor && actor.q || 0), r: Number(actor && actor.r || 0) };
    var target = { q: Number(center && center.q || 0), r: Number(center && center.r || 0) };
    var line = axialLine(start, target);
    var nextHex = line.length > 1 ? line[1] : target;
    var dq = Number(nextHex && nextHex.q || target.q) - Number(start.q || 0);
    var dr = Number(nextHex && nextHex.r || target.r) - Number(start.r || 0);
    if (!dq && !dr) {
      dq = 1;
      dr = 0;
    }
    var dirKey = getAxialDirectionKeyFromDelta(dq, dr);
    var sideDirections = {
      e: ['ne', 'se'],
      ne: ['e', 'nw'],
      nw: ['ne', 'w'],
      w: ['nw', 'sw'],
      sw: ['w', 'se'],
      se: ['e', 'sw']
    };
    var sides = sideDirections[dirKey] || ['ne', 'se'];
    var maxLen = Math.max(1, Number(length || 4));
    var maxWidth = Math.max(0, Number(width || 2));

    function pushIfInBounds(hex) {
      if (!hex) return;
      var qNow = Number(hex.q || 0);
      var rNow = Number(hex.r || 0);
      if (Math.abs(qNow) > Number(state && state.board && state.board.cols || 22)) return;
      if (Math.abs(rNow) > Number(state && state.board && state.board.rows || 16)) return;
      var key = toKey(qNow, rNow);
      if (keyMap[key]) return;
      keyMap[key] = true;
      out.push({ q: qNow, r: rNow });
    }

    for (var i = 1; i <= maxLen; i++) {
      var core = { q: Number(start.q || 0) + dq * i, r: Number(start.r || 0) + dr * i };
      pushIfInBounds(core);
      var spread = Math.min(maxWidth, Math.max(0, Math.floor((i - 1) / 2) + 1));
      for (var w = 1; w <= spread; w++) {
        pushIfInBounds(stepAxialByDirection(core, sides[0], w));
        pushIfInBounds(stepAxialByDirection(core, sides[1], w));
      }
    }
    return out;
  }

  var SPELLCAST_PREVIEW_LIBRARY = [
    {
      id: 'thunder-lattice',
      label: 'Thunder Lattice',
      shape: 'line',
      range: 5,
      length: 5,
      rounds: 2,
      width: 0,
      targetMode: 'enemies',
      damageOnHit: true,
      onHitCondition: 'shaken',
      onHitActionDown: false,
      zoneEnabled: true,
      tickMode: 'margin',
      tickAmount: 0,
      tickCondition: '',
      zoneTickOnEnter: false,
      zoneTickOnRoundStart: false,
      previewColor: 'rgba(108,189,255,0.26)',
      previewBorder: 'rgba(164,223,255,0.95)'
    },
    {
      id: 'entropy-vault',
      label: 'Entropy Vault',
      shape: 'ring',
      range: 4,
      innerRadius: 1,
      outerRadius: 2,
      rounds: 2,
      width: 0,
      targetMode: 'enemies',
      damageOnHit: true,
      onHitCondition: 'vulnerable',
      onHitActionDown: false,
      zoneEnabled: true,
      tickMode: 'fixed',
      tickAmount: 1,
      tickCondition: 'weakened',
      zoneTickOnEnter: true,
      zoneTickOnRoundStart: true,
      previewColor: 'rgba(255,160,109,0.24)',
      previewBorder: 'rgba(255,214,168,0.9)'
    },
    {
      id: 'gravitic-fold',
      label: 'Gravitic Fold',
      shape: 'ring',
      range: 4,
      innerRadius: 1,
      outerRadius: 3,
      rounds: 2,
      width: 0,
      targetMode: 'enemies',
      damageOnHit: true,
      onHitCondition: 'vulnerable',
      onHitActionDown: false,
      zoneEnabled: true,
      tickMode: 'fixed',
      tickAmount: 1,
      tickCondition: '',
      zoneTickOnEnter: false,
      zoneTickOnRoundStart: false,
      pullToCenterRadius: 1,
      previewColor: 'rgba(173,142,255,0.22)',
      previewBorder: 'rgba(214,194,255,0.92)'
    },
    {
      id: 'mind-shear-cone',
      label: 'Mind Shear Cone',
      shape: 'cone',
      range: 4,
      length: 4,
      width: 2,
      rounds: 1,
      targetMode: 'enemies',
      damageOnHit: true,
      onHitCondition: 'distracted',
      onHitActionDown: true,
      zoneEnabled: false,
      tickMode: 'none',
      tickAmount: 0,
      tickCondition: '',
      zoneTickOnEnter: false,
      zoneTickOnRoundStart: false,
      previewColor: 'rgba(244,138,255,0.23)',
      previewBorder: 'rgba(252,195,255,0.93)'
    },
    {
      id: 'starfall-burst',
      label: 'Starfall Burst',
      shape: 'burst',
      range: 6,
      radius: 2,
      rounds: 1,
      width: 0,
      targetMode: 'enemies',
      damageOnHit: true,
      onHitCondition: '',
      onHitActionDown: false,
      zoneEnabled: false,
      tickMode: 'none',
      tickAmount: 0,
      tickCondition: '',
      zoneTickOnEnter: false,
      zoneTickOnRoundStart: false,
      previewColor: 'rgba(255,228,120,0.24)',
      previewBorder: 'rgba(255,243,178,0.95)'
    },
    {
      id: 'aegis-halo',
      label: 'Aegis Halo',
      shape: 'ring',
      range: 4,
      innerRadius: 0,
      outerRadius: 1,
      rounds: 2,
      width: 0,
      targetMode: 'allies',
      damageOnHit: false,
      onHitCondition: 'protected',
      onHitActionDown: false,
      zoneEnabled: false,
      tickMode: 'none',
      tickAmount: 0,
      tickCondition: '',
      zoneTickOnEnter: false,
      zoneTickOnRoundStart: false,
      previewColor: 'rgba(73,201,187,0.22)',
      previewBorder: 'rgba(139,239,224,0.94)'
    }
  ];

  function getSpellcastBandSpec(bandKey) {
    var map = {
      engaged: { key: 'engaged', label: 'Engaged', range: 1, lineLength: 2, ringMin: 0, ringMax: 1, rounds: 1 },
      close: { key: 'close', label: 'Close', range: 2, lineLength: 3, ringMin: 1, ringMax: 2, rounds: 2 },
      nearby: { key: 'nearby', label: 'Nearby', range: 3, lineLength: 4, ringMin: 2, ringMax: 3, rounds: 2 },
      far: { key: 'far', label: 'Far', range: 4, lineLength: 6, ringMin: 3, ringMax: 5, rounds: 3 }
    };
    var key = String(bandKey || 'close').toLowerCase();
    return map[key] || map.close;
  }

  function normalizeSpellcastBandKey(value) {
    var key = String(value || '').toLowerCase().trim();
    if (key === 'engaged' || key === 'close' || key === 'nearby' || key === 'far') return key;
    return 'close';
  }

  function stepSpellDieLocal(die, dir) {
    var chain = [4, 6, 8, 10, 12, 20];
    var d = Math.max(4, Number(die || 4));
    var idx = chain.indexOf(d);
    if (idx < 0) idx = 0;
    var next = idx + (Number(dir || 0) > 0 ? 1 : -1);
    if (next < 0) next = 0;
    if (next > chain.length - 1) next = chain.length - 1;
    return chain[next];
  }

  function resolveLegacySpellPreviewSelection(rawValue) {
    var value = String(rawValue || '').trim();
    var out = { spellId: value || 'thunder-lattice', overrides: {} };
    if (value.indexOf('legacy:') !== 0) return out;
    var presetKey = value.replace(/^legacy:/, '').trim().toLowerCase();
    var presets = Array.isArray(window.AOE_SPELL_PRESETS) ? window.AOE_SPELL_PRESETS : [];
    var row = presets.find(function (entry) {
      return String(entry && entry.key || '').toLowerCase() === presetKey;
    }) || null;
    if (!row) return out;
    var shape = String(row.shape || 'line').toLowerCase();
    var band = normalizeSpellcastBandKey(row.band || 'close');
    out.spellId = shape === 'ring' ? 'entropy-vault' : 'thunder-lattice';
    out.overrides = {
      spellLabel: String(row.name || 'AOE Template'),
      shape: shape,
      bandKey: band
    };
    return out;
  }

  function applySpellPreviewOverridesToTemplate(baseTemplate, overrides) {
    var tpl = Object.assign({}, baseTemplate || {});
    var patch = overrides && typeof overrides === 'object' ? overrides : {};
    if (patch.spellLabel) tpl.label = String(patch.spellLabel);
    if (patch.shape) tpl.shape = String(patch.shape).toLowerCase();
    if (patch.targetMode) tpl.targetMode = String(patch.targetMode || 'enemies');
    if (patch.tickMode) tpl.tickMode = String(patch.tickMode || 'none');
    if (Number.isFinite(Number(patch.tickAmount))) tpl.tickAmount = Math.max(0, Number(patch.tickAmount));
    if (patch.tickCondition != null) tpl.tickCondition = String(patch.tickCondition || '');
    if (patch.onHitCondition != null) tpl.onHitCondition = String(patch.onHitCondition || '');
    if (Number.isFinite(Number(patch.rounds))) tpl.rounds = Math.max(1, Number(patch.rounds));
    if (Number.isFinite(Number(patch.range))) tpl.range = Math.max(1, Number(patch.range));
    if (patch.damageOnHit != null) tpl.damageOnHit = !!patch.damageOnHit;
    if (patch.zoneEnabled != null) tpl.zoneEnabled = !!patch.zoneEnabled;
    if (patch.onHitActionDown != null) tpl.onHitActionDown = !!patch.onHitActionDown;
    if (patch.zoneTickOnEnter != null) tpl.zoneTickOnEnter = !!patch.zoneTickOnEnter;
    if (patch.zoneTickOnRoundStart != null) tpl.zoneTickOnRoundStart = !!patch.zoneTickOnRoundStart;
    if (Number.isFinite(Number(patch.pullToCenterRadius))) tpl.pullToCenterRadius = Math.max(0, Number(patch.pullToCenterRadius));

    var bandKey = normalizeSpellcastBandKey(patch.bandKey || '');
    if (patch.bandKey) {
      var band = getSpellcastBandSpec(bandKey);
      tpl.range = Math.max(1, Number(band.range || tpl.range || 2));
      tpl.rounds = Math.max(1, Number(band.rounds || tpl.rounds || 2));
      if (String(tpl.shape || '').toLowerCase() === 'line') {
        tpl.length = Math.max(1, Number(band.lineLength || tpl.length || 3));
      } else if (String(tpl.shape || '').toLowerCase() === 'ring') {
        tpl.innerRadius = Math.max(0, Number(band.ringMin || tpl.innerRadius || 0));
        tpl.outerRadius = Math.max(tpl.innerRadius, Number(band.ringMax || tpl.outerRadius || 1));
      }
    }

    if (String(tpl.shape || '').toLowerCase() === 'line') {
      tpl.length = Math.max(1, Number(patch.length || tpl.length || 3));
    }
    if (String(tpl.shape || '').toLowerCase() === 'cone') {
      tpl.length = Math.max(1, Number(patch.length || tpl.length || 4));
      tpl.width = Math.max(0, Number(patch.width || tpl.width || 2));
    }
    if (String(tpl.shape || '').toLowerCase() === 'ring') {
      tpl.innerRadius = Math.max(0, Number(patch.innerRadius == null ? tpl.innerRadius : patch.innerRadius));
      tpl.outerRadius = Math.max(tpl.innerRadius, Number(patch.outerRadius == null ? tpl.outerRadius : patch.outerRadius));
    }
    if (String(tpl.shape || '').toLowerCase() === 'burst') {
      tpl.radius = Math.max(0, Number(patch.radius == null ? tpl.radius : patch.radius));
    }
    return tpl;
  }

  function applyCombatSpellPullToCenter(tokens, centerQ, centerR, targetRadius) {
    var radius = Math.max(0, Number(targetRadius || 0));
    if (!radius || !Array.isArray(tokens) || !tokens.length) return;
    var center = { q: Number(centerQ || 0), r: Number(centerR || 0) };
    var state = store.getState();
    var tokenList = Array.isArray(state && state.tokens) ? state.tokens : [];
    var moverIds = {};
    var movers = tokens.map(function (token) {
      var id = String(token && token.id || '');
      if (!id || moverIds[id]) return null;
      var live = tokenList.find(function (row) { return row && String(row.id || '') === id; }) || token;
      if (!live) return null;
      moverIds[id] = true;
      return {
        id: id,
        q: Number(live.q || 0),
        r: Number(live.r || 0),
        key: toKey(Number(live.q || 0), Number(live.r || 0))
      };
    }).filter(Boolean);
    if (!movers.length) return;

    var staticOccupied = {};
    tokenList.forEach(function (token) {
      if (!token) return;
      var id = String(token.id || '');
      if (moverIds[id]) return;
      staticOccupied[toKey(Number(token.q || 0), Number(token.r || 0))] = true;
    });

    var maxDistance = movers.reduce(function (best, token) {
      return Math.max(best, hexDistance(center, { q: token.q, r: token.r }));
    }, radius);
    var maxSearch = Math.max(radius + 4, maxDistance + 1);
    var reserved = {};
    var assignments = {};

    function isHexFree(q, r) {
      var key = toKey(Number(q || 0), Number(r || 0));
      if (reserved[key]) return false;
      if (staticOccupied[key]) return false;
      if (isBlocked(Number(q || 0), Number(r || 0))) return false;
      return true;
    }

    function sortCandidates(candidates, preferred, origin) {
      return candidates.sort(function (a, b) {
        var ap = hexDistance(a, preferred);
        var bp = hexDistance(b, preferred);
        if (ap !== bp) return ap - bp;
        var ao = hexDistance(a, origin);
        var bo = hexDistance(b, origin);
        if (ao !== bo) return ao - bo;
        return toKey(a.q, a.r) < toKey(b.q, b.r) ? -1 : 1;
      });
    }

    function findFallbackHex(origin, preferred) {
      var wantedDistance = Math.max(radius, 1);
      for (var ring = wantedDistance; ring <= maxSearch; ring++) {
        var candidates = [];
        for (var q = center.q - ring; q <= center.q + ring; q++) {
          for (var r = center.r - ring; r <= center.r + ring; r++) {
            if (hexDistance(center, { q: q, r: r }) !== ring) continue;
            if (!isHexFree(q, r)) continue;
            candidates.push({ q: q, r: r });
          }
        }
        if (!candidates.length) continue;
        return sortCandidates(candidates, preferred, origin)[0];
      }
      return null;
    }

    // Pull the farthest targets first so distant enemies cannot block each other in tight rings.
    movers.sort(function (a, b) {
      var da = hexDistance(center, { q: a.q, r: a.r });
      var db = hexDistance(center, { q: b.q, r: b.r });
      if (da !== db) return db - da;
      return String(a.id || '') < String(b.id || '') ? -1 : 1;
    });

    movers.forEach(function (token) {
      var origin = { q: Number(token.q || 0), r: Number(token.r || 0) };
      var distance = hexDistance(center, origin);
      if (distance <= radius) return;
      var ray = axialLine(center, origin);
      if (!ray || !ray.length) return;

      var preferred = ray[Math.min(ray.length - 1, Math.max(1, radius))] || origin;
      var picked = null;
      if (isHexFree(preferred.q, preferred.r)) {
        picked = { q: Number(preferred.q || 0), r: Number(preferred.r || 0) };
      }

      if (!picked) {
        for (var i = Math.max(2, radius + 1); i < ray.length; i++) {
          var candidate = ray[i];
          if (!candidate) continue;
          if (!isHexFree(candidate.q, candidate.r)) continue;
          picked = { q: Number(candidate.q || 0), r: Number(candidate.r || 0) };
          break;
        }
      }

      if (!picked) {
        picked = findFallbackHex(origin, { q: Number(preferred.q || 0), r: Number(preferred.r || 0) });
      }

      if (!picked) return;
      var targetKey = toKey(picked.q, picked.r);
      reserved[targetKey] = true;
      assignments[token.id] = picked;
    });

    var movedIds = Object.keys(assignments);
    if (!movedIds.length) return;

    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      next.tokens = (inner.tokens || []).map(function (token) {
        if (!token) return token;
        var id = String(token.id || '');
        var target = assignments[id];
        if (!target) return token;
        return Object.assign({}, token, { q: Number(target.q || 0), r: Number(target.r || 0) });
      });
      next = syncFogExplorerMemory(next);
      persist(next);
      return next;
    });

    addHistory('Gravitic pull repositions ' + movedIds.length + ' target' + (movedIds.length === 1 ? '' : 's') + ' around ' + toKey(center.q, center.r) + '.');
  }

  function isUnifiedSpellPromptAvailable() {
    return typeof getSpellCircumstanceProfile === 'function'
      && typeof openSpellCircumstancePrompt === 'function'
      && typeof evaluateSpellCircumstances === 'function';
  }

  function getSpellcastTemplateById(spellId) {
    var bootstrapDefaults = [{
      id: 'thunder-lattice',
      label: 'Thunder Lattice',
      shape: 'line',
      range: 5,
      length: 5,
      rounds: 2,
      width: 0,
      targetMode: 'enemies',
      damageOnHit: true,
      onHitCondition: 'shaken',
      onHitActionDown: false,
      zoneEnabled: true,
      tickMode: 'margin',
      tickAmount: 0,
      tickCondition: '',
      zoneTickOnEnter: false,
      zoneTickOnRoundStart: false,
      previewColor: 'rgba(108,189,255,0.26)',
      previewBorder: 'rgba(164,223,255,0.95)'
    }];
    var library = Array.isArray(SPELLCAST_PREVIEW_LIBRARY) && SPELLCAST_PREVIEW_LIBRARY.length
      ? SPELLCAST_PREVIEW_LIBRARY
      : bootstrapDefaults;
    var wanted = String(spellId || '').trim().toLowerCase();
    var fallback = library[0];
    if (!wanted) return fallback;
    return library.find(function (entry) {
      return String(entry && entry.id || '').toLowerCase() === wanted;
    }) || fallback;
  }

  function normalizeCombatSpellPreview(preview) {
    var tpl = preview && preview.spellId ? getSpellcastTemplateById(preview.spellId) : getSpellcastTemplateById('thunder-lattice');
    var next = Object.assign({
      active: false,
      spellId: String(tpl && tpl.id || 'thunder-lattice'),
      spellLabel: String(tpl && tpl.label || 'Thunder Lattice'),
      casterTokenId: '',
      casterName: '',
      targetQ: 0,
      targetR: 0,
      distance: 0,
      rangeLimit: Math.max(1, Number(tpl && tpl.range || 4)),
      label: 'Engaged',
      shape: String(tpl && tpl.shape || 'line'),
      hexKeys: [],
      rounds: Math.max(1, Number(tpl && tpl.rounds || 2)),
      width: Math.max(0, Number(tpl && tpl.width || 0)),
      targetMode: String(tpl && tpl.targetMode || 'enemies'),
      damageOnHit: tpl && tpl.damageOnHit !== false,
      onHitCondition: String(tpl && tpl.onHitCondition || ''),
      onHitActionDown: !!(tpl && tpl.onHitActionDown),
      zoneEnabled: !!(tpl && tpl.zoneEnabled),
      tickMode: String(tpl && tpl.tickMode || 'none'),
      tickAmount: Math.max(0, Number(tpl && tpl.tickAmount || 0)),
      tickCondition: String(tpl && tpl.tickCondition || ''),
      zoneTickOnEnter: !!(tpl && tpl.zoneTickOnEnter),
      zoneTickOnRoundStart: !!(tpl && tpl.zoneTickOnRoundStart),
      pullToCenterRadius: Math.max(0, Number(tpl && tpl.pullToCenterRadius || 0)),
      directionKey: String(tpl && tpl.directionKey || 'e'),
      castMode: 'auto',
      color: String(tpl && tpl.previewColor || 'rgba(108,189,255,0.26)'),
      border: String(tpl && tpl.previewBorder || 'rgba(164,223,255,0.95)'),
      isValid: false,
      reason: 'Select a caster token.'
    }, preview && typeof preview === 'object' ? preview : {});
    next.active = !!next.active;
    next.spellId = String(next.spellId || 'thunder-lattice');
    next.spellLabel = String(next.spellLabel || 'Thunder Lattice');
    next.casterTokenId = String(next.casterTokenId || '');
    next.casterName = String(next.casterName || '');
    next.targetQ = Number(next.targetQ || 0);
    next.targetR = Number(next.targetR || 0);
    next.distance = Math.max(0, Number(next.distance || 0));
    next.rangeLimit = Math.max(1, Number(next.rangeLimit || 4));
    next.label = String(next.label || hexLabel(next.distance));
    next.shape = String(next.shape || 'line');
    next.hexKeys = Array.isArray(next.hexKeys) ? next.hexKeys.map(function (key) { return String(key || ''); }).filter(Boolean) : [];
    next.rounds = Math.max(1, Number(next.rounds || 2));
    next.width = Math.max(0, Number(next.width || 0));
    next.targetMode = String(next.targetMode || 'enemies');
    next.damageOnHit = next.damageOnHit !== false;
    next.onHitCondition = String(next.onHitCondition || '').trim().toLowerCase();
    next.onHitActionDown = !!next.onHitActionDown;
    next.zoneEnabled = !!next.zoneEnabled;
    next.tickMode = String(next.tickMode || 'none').toLowerCase();
    next.tickAmount = Math.max(0, Number(next.tickAmount || 0));
    next.tickCondition = String(next.tickCondition || '').trim().toLowerCase();
    next.zoneTickOnEnter = !!next.zoneTickOnEnter;
    next.zoneTickOnRoundStart = !!next.zoneTickOnRoundStart;
    next.pullToCenterRadius = Math.max(0, Number(next.pullToCenterRadius || 0));
    next.directionKey = SPELLCAST_DIRECTION_KEYS.indexOf(String(next.directionKey || '').toLowerCase()) >= 0
      ? String(next.directionKey || '').toLowerCase()
      : 'e';
    next.castMode = String(next.castMode || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto';
    next.color = String(next.color || 'rgba(108,189,255,0.26)');
    next.border = String(next.border || 'rgba(164,223,255,0.95)');
    next.isValid = !!next.isValid;
    next.reason = String(next.reason || 'Select a target hex to preview.');
    return next;
  }

  function pickSpellcastCasterToken(state, preferredTokenId) {
    var wanted = String(preferredTokenId || '');
    var tokens = Array.isArray(state && state.tokens) ? state.tokens : [];
    if (wanted) {
      var direct = tokens.find(function (token) { return token && String(token.id || '') === wanted; }) || null;
      if (direct && !isTokenDead(direct)) return direct;
    }
    var selected = byId(state && state.selectedTokenId);
    if (selected && !isTokenDead(selected)) return selected;
    return tokens.find(function (token) {
      return token && !isTokenDead(token) && (token.isPlayer || String(token.faction || '') === 'player');
    }) || tokens.find(function (token) {
      return token && !isTokenDead(token);
    }) || null;
  }

  function computeSpellPreviewState(state, caster, targetQ, targetR, spellCfg, previousPreview) {
    var tpl = spellCfg && typeof spellCfg === 'object' ? spellCfg : getSpellcastTemplateById('thunder-lattice');
    var prev = previousPreview && typeof previousPreview === 'object' ? normalizeCombatSpellPreview(previousPreview) : null;
    var casterToken = caster || null;
    var out = normalizeCombatSpellPreview({
      active: true,
      spellId: String(tpl.id || 'thunder-lattice'),
      spellLabel: String(tpl.label || 'Thunder Lattice'),
      casterTokenId: String(casterToken && casterToken.id || ''),
      casterName: String(casterToken && casterToken.name || ''),
      targetQ: Number(targetQ || 0),
      targetR: Number(targetR || 0),
      shape: String(tpl.shape || 'line'),
      rangeLimit: Math.max(1, Number(tpl.range || 4)),
      rounds: Math.max(1, Number(tpl.rounds || 2)),
      width: Math.max(0, Number(tpl.width || 0)),
      targetMode: String(tpl.targetMode || 'enemies'),
      damageOnHit: tpl.damageOnHit !== false,
      onHitCondition: String(tpl.onHitCondition || ''),
      onHitActionDown: !!tpl.onHitActionDown,
      zoneEnabled: !!tpl.zoneEnabled,
      tickMode: String(tpl.tickMode || 'none'),
      tickAmount: Math.max(0, Number(tpl.tickAmount || 0)),
      tickCondition: String(tpl.tickCondition || ''),
      zoneTickOnEnter: !!tpl.zoneTickOnEnter,
      zoneTickOnRoundStart: !!tpl.zoneTickOnRoundStart,
      pullToCenterRadius: Math.max(0, Number(tpl.pullToCenterRadius || 0)),
      directionKey: String(prev && prev.directionKey || 'e'),
      castMode: String(prev && prev.castMode || 'auto'),
      color: String(tpl.previewColor || 'rgba(108,189,255,0.26)'),
      border: String(tpl.previewBorder || 'rgba(164,223,255,0.95)')
    });
    if (!casterToken) {
      out.reason = 'Select a caster token first.';
      out.isValid = false;
      return out;
    }

    var target = { q: Number(targetQ || casterToken.q || 0), r: Number(targetR || casterToken.r || 0) };
    var dist = hexDistance({ q: Number(casterToken.q || 0), r: Number(casterToken.r || 0) }, target);
    if (dist > 0) {
      var line = axialLine({ q: Number(casterToken.q || 0), r: Number(casterToken.r || 0) }, target);
      var nextHex = line.length > 1 ? line[1] : target;
      var dq = Number(nextHex && nextHex.q || target.q) - Number(casterToken.q || 0);
      var dr = Number(nextHex && nextHex.r || target.r) - Number(casterToken.r || 0);
      out.directionKey = getAxialDirectionKeyFromDelta(dq, dr);
    }
    out.distance = dist;
    out.label = hexLabel(dist);

    var hexes = [];
    if (String(tpl.shape || '') === 'ring') {
      hexes = buildAoeZoneRingHexes(state, target, Number(tpl.innerRadius || 1), Number(tpl.outerRadius || 2));
    } else if (String(tpl.shape || '') === 'burst') {
      hexes = buildAoeZoneBurstHexes(state, target, Number(tpl.radius || 1));
    } else if (String(tpl.shape || '') === 'cone') {
      var coneCenter = target;
      if (dist <= 0) coneCenter = stepAxialByDirection(casterToken, out.directionKey, 1);
      hexes = buildAoeZoneConeHexes(state, casterToken, coneCenter, Math.max(1, Number(tpl.length || 4)), Math.max(0, Number(tpl.width || 2)));
    } else {
      var lineCenter = target;
      if (dist <= 0) lineCenter = stepAxialByDirection(casterToken, out.directionKey, 1);
      hexes = buildAoeZoneLineHexes(state, casterToken, lineCenter, Math.max(1, Number(tpl.length || 4)));
    }
    out.hexKeys = hexes.map(function (hex) { return toKey(Number(hex.q || 0), Number(hex.r || 0)); });

    if (!out.hexKeys.length) {
      out.reason = 'Template has no valid hexes at this position.';
      out.isValid = false;
      return out;
    }

    if (dist > out.rangeLimit) {
      out.reason = 'Out of range (' + dist + '/' + out.rangeLimit + ' hexes).';
      out.isValid = false;
      return out;
    }

    out.reason = 'Ready to cast.';
    out.isValid = true;
    return out;
  }

  function clearCombatSpellPreview(setToolSelect) {
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.spellPreview = normalizeCombatSpellPreview({ active: false });
      if (setToolSelect) next.activeTool = 'select';
      return next;
    });
    drawBoard();
    updateUiPanels();
  }

  function getSpellcastManualMindDie(castModePreview, circData, baseDie) {
    var die = Math.max(4, Number(baseDie || 4));
    if (circData && circData.stepUpAdvantage) return stepSpellDieLocal(die, 1);
    if (circData && circData.stepDownDisadvantage) return stepSpellDieLocal(die, -1);
    return die;
  }

  function getSpellcastManualValorDie(circData, baseDie) {
    var die = Math.max(4, Number(baseDie || 4));
    var steps = Number(circData && circData.valorStep || 0);
    var floorStepDowns = 0;
    while (steps !== 0) {
      if (steps > 0) {
        die = stepSpellDieLocal(die, 1);
        steps -= 1;
      } else {
        if (die <= 4) floorStepDowns += 1;
        else die = stepSpellDieLocal(die, -1);
        steps += 1;
      }
    }
    return { die: die, floorStepDowns: Math.max(0, floorStepDowns) };
  }

  function buildSpellcastManualPromptText(kind, preview, circData, die, modifierValue) {
    var dieText = 'd' + Math.max(4, Number(die || 4));
    var label = kind === 'valor' ? 'Valor' : 'Mind';
    var lines = [
      'Roll ' + label + ' Die ' + dieText + ' for ' + String(preview.spellLabel || 'this spell') + '.',
      'Enter the final total after adding or subtracting the spell circumstance modifiers.'
    ];
    if (kind === 'mind') {
      if (circData && circData.stepUpAdvantage) lines.push('This cast has Mind step-up: use the next larger die instead of your normal Mind Die.');
      if (circData && circData.stepDownDisadvantage) lines.push('This cast has Mind step-down: use the next smaller die instead of your normal Mind Die.');
    } else if (kind === 'valor' && Number(circData && circData.valorStep || 0) !== 0) {
      lines.push('This cast changes your Valor Die by ' + (Number(circData.valorStep || 0) > 0 ? '+' : '') + Number(circData.valorStep || 0) + ' step(s).');
      var vInfo = getSpellcastManualValorDie(circData, die);
      if (vInfo.floorStepDowns > 0) {
        lines.push('Valor step-down reached d4: roll d4 ' + (vInfo.floorStepDowns + 1) + 'x and keep the lowest.');
      }
    }
    if (Number(modifierValue || 0) !== 0) {
      lines.push('Flat circumstance modifier: ' + (Number(modifierValue || 0) > 0 ? '+' : '') + Number(modifierValue || 0) + '.');
    } else {
      lines.push('Flat circumstance modifier: +0.');
    }
    if (circData && Array.isArray(circData.modifierLines) && circData.modifierLines.length) {
      lines.push('Answers: ' + circData.modifierLines.join(' | '));
    }
    return lines.join('\n');
  }

  function clearCombatBoardAndEffects() {
    var state = store.getState();
    var removedTokens = Array.isArray(state.tokens) ? state.tokens.length : 0;
    var removedEffects = Array.isArray(state.tokenRoundEffects) ? state.tokenRoundEffects.length : 0;
    var removedZones = Array.isArray(state.sceneRules && state.sceneRules.aoeZones) ? state.sceneRules.aoeZones.length : 0;
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      next.layers = createEmptySceneLayers();
      next.tokens = [];
      next.selectedTokenId = '';
      next.selectedTokenIds = [];
      next.selectedMapItem = null;
      next.draggingTokenId = '';
      next.draggingGroupIds = [];
      next.dragTokenOrigins = {};
      next.initiative = [];
      next.initiativeIndex = 0;
      next.teamActions = {};
      next.tokenRoundEffects = [];
      next.lootDrops = [];
      next.ruler = { active: false, start: null, end: null, distance: 0, label: '' };
      next.rulerSegments = [];
      next.pings = [];
      next.mouse = { panning: false, lastX: 0, lastY: 0 };
      next.spellPreview = normalizeCombatSpellPreview({ active: false });
      next.activeTool = 'select';
      var fog = Object.assign({
        enabled: false,
        showMask: true,
        revealMode: 'manual',
        visionRadius: 3,
        revealed: {},
        revealOrder: {},
        revealSeq: 0,
        revealStep: 0
      }, inner.fog || {});
      fog.revealed = {};
      fog.revealOrder = {};
      fog.revealSeq = 0;
      fog.revealStep = 0;
      next.fog = fog;
      var rules = ensureCombatSceneRulesExtensions(inner.sceneRules || {});
      rules.aoeZones = [];
      next.sceneRules = rules;
      persist(next);
      return next;
    });
    addHistory('Board cleared: ' + removedTokens + ' token(s), ' + removedEffects + ' effect(s), ' + removedZones + ' zone(s) removed.');
    safeNotif('Board cleared for current scene. Scene card remains available.', 'good');
    drawBoard();
    updateUiPanels();
  }

  function startCombatSpellPreview(spellId, casterTokenId, options) {
    var state = store.getState();
    var caster = pickSpellcastCasterToken(state, casterTokenId);
    if (!caster) {
      safeNotif('No available caster token. Add or select a token first.', 'warn');
      return false;
    }
    var tpl = applySpellPreviewOverridesToTemplate(getSpellcastTemplateById(spellId), options);
    var targetQ = Number(caster.q || 0);
    var targetR = Number(caster.r || 0);
    var built = computeSpellPreviewState(state, caster, targetQ, targetR, tpl, null);
    store.setState({
      activeTool: 'spellcast',
      selectedTokenId: String(caster.id || ''),
      spellPreview: built
    });
    addHistory((caster.name || 'Caster') + ' prepares ' + built.spellLabel + '. Aim on the board, then cast.');
    safeNotif('Spell preview active: ' + built.spellLabel + '. Aim, then cast via toolbar Cast, C, or Shift+Click.', 'info');
    drawBoard();
    updateUiPanels();
    return true;
  }

  function updateCombatSpellPreviewTarget(q, r) {
    var state = store.getState();
    if (String(state.activeTool || '') !== 'spellcast') return;
    var preview = normalizeCombatSpellPreview(state.spellPreview);
    if (!preview.active) return;
    var caster = pickSpellcastCasterToken(state, preview.casterTokenId);
    var tpl = applySpellPreviewOverridesToTemplate(getSpellcastTemplateById(preview.spellId), preview);
    if (!caster) return;
    var nextPreview = computeSpellPreviewState(state, caster, Number(q || caster.q || 0), Number(r || caster.r || 0), tpl, preview);
    store.setState({ spellPreview: nextPreview });
    drawBoard();
    updateUiPanels();
  }

  function rotateCombatSpellPreviewDirection(step) {
    var state = store.getState();
    var preview = normalizeCombatSpellPreview(state.spellPreview);
    if (!preview.active) return false;
    var idx = SPELLCAST_DIRECTION_KEYS.indexOf(String(preview.directionKey || 'e'));
    var startIdx = idx < 0 ? 0 : idx;
    var nextIdx = (startIdx + (Number(step || 0) >= 0 ? 1 : -1) + SPELLCAST_DIRECTION_KEYS.length) % SPELLCAST_DIRECTION_KEYS.length;
    var nextDirection = SPELLCAST_DIRECTION_KEYS[nextIdx];
    var caster = pickSpellcastCasterToken(state, preview.casterTokenId);
    if (!caster) return false;
    var nextPreviewSeed = Object.assign({}, preview, { directionKey: nextDirection });
    var tpl = applySpellPreviewOverridesToTemplate(getSpellcastTemplateById(preview.spellId), nextPreviewSeed);
    var nextPreview = computeSpellPreviewState(state, caster, Number(preview.targetQ || caster.q || 0), Number(preview.targetR || caster.r || 0), tpl, nextPreviewSeed);
    nextPreview.directionKey = nextDirection;
    store.setState({ spellPreview: nextPreview });
    drawBoard();
    updateUiPanels();
    return true;
  }

  function castCombatSpellPreview() {
    var state = store.getState();
    var preview = normalizeCombatSpellPreview(state.spellPreview);
    if (!preview.active) {
      safeNotif('No active spell preview. Use Effects -> Spell Preview first.', 'warn');
      return false;
    }
    if (!preview.isValid) {
      safeNotif(preview.reason || 'Spell target is not valid yet.', 'warn');
      return false;
    }
    var caster = byId(preview.casterTokenId);
    if (!caster || isTokenDead(caster)) {
      safeNotif('Caster is unavailable.', 'warn');
      return false;
    }
    var tpl = getSpellcastTemplateById(preview.spellId);

    var manualMode = String(preview.castMode || 'auto') === 'manual';
    var circMeta = null;
    if (isUnifiedSpellPromptAvailable()) {
      var prompted = false;
      openSpellCircumstancePrompt({
        scrollName: String(preview.spellLabel || 'Spell'),
        scrollDesc: '',
        profile: getSpellCircumstanceProfile(String(preview.spellLabel || 'Spell'), ''),
        onCancel: function () {
          safeNotif('Spell cast cancelled.', 'info');
        },
        onResolve: function (resolved) {
          var profile = getSpellCircumstanceProfile(String(preview.spellLabel || 'Spell'), '');
          var circData = evaluateSpellCircumstances(profile, resolved && resolved.answers ? resolved.answers : []);
          castCombatSpellPreviewWithContext(preview, caster, manualMode, { profile: profile, circData: circData });
        }
      });
      prompted = true;
      if (prompted) return true;
    }
    return castCombatSpellPreviewWithContext(preview, caster, manualMode, circMeta);
  }

  function castCombatSpellPreviewWithContext(preview, caster, manualMode, spellMeta) {
    var state = store.getState();
    var meta = spellMeta && typeof spellMeta === 'object' ? spellMeta : null;
    var castTotal = 0;
    var resistTotal = 0;
    var mindDie = Math.max(4, Number(getWayfarerEffectiveDie('mind', 6) || 6));
    var valorDie = Math.max(4, Number(window.S && window.S.stats && window.S.stats.valor || 6));
    var finalValorDie = valorDie;
    var finalValorFloorStepDowns = 0;
    var finalMindDie = mindDie;
    if (meta && meta.circData) {
      var vAdjust = getSpellcastManualValorDie(meta.circData, finalValorDie);
      finalValorDie = Math.max(4, Number(vAdjust.die || finalValorDie));
      finalValorFloorStepDowns = Math.max(0, Number(vAdjust.floorStepDowns || 0));
      finalMindDie = getSpellcastManualMindDie(preview, meta.circData, mindDie);
    }
    if (manualMode) {
      var manualCast = promptManualDieTotal(buildSpellcastManualPromptText('mind', preview, meta && meta.circData, finalMindDie, meta && meta.circData ? meta.circData.mindFlat || 0 : 0), 10, 1, 9999);
      if (manualCast === null) {
        safeNotif('Spell cast cancelled.', 'info');
        return false;
      }
      var manualResist = promptManualDieTotal(buildSpellcastManualPromptText('valor', preview, meta && meta.circData, finalValorDie, 0), 8, 1, 9999);
      if (manualResist === null) {
        safeNotif('Spell cast cancelled.', 'info');
        return false;
      }
      castTotal = Math.max(1, Number(manualCast || 1));
      resistTotal = Math.max(1, Number(manualResist || 1));
    } else {
      castTotal = rollCombatDieTotal(mindDie, 'action', String(caster.name || 'Caster') + ' Mind d' + mindDie);
      if (meta && meta.circData) {
        castTotal += Number(meta.circData.mindFlat || 0);
        if (meta.circData.stepUpAdvantage) {
          var upRoll = rollCombatDieTotal(stepSpellDieLocal(mindDie, 1), 'action', 'Spell Step Up Advantage');
          castTotal = Math.max(castTotal, upRoll);
        } else if (meta.circData.stepDownDisadvantage) {
          var downRoll = rollCombatDieTotal(stepSpellDieLocal(mindDie, -1), 'action', 'Spell Step Down Disadvantage');
          castTotal = Math.min(castTotal, downRoll);
        }
        var spiritCounts = (typeof getSpellSpiritRollCounts === 'function')
          ? getSpellSpiritRollCounts(meta.circData)
          : { add: meta.circData.addSpiritBonus ? 1 : 0, sub: meta.circData.addSpiritPenalty ? 1 : 0 };
        if (Number(spiritCounts.add || 0) > 0 || Number(spiritCounts.sub || 0) > 0) {
          var spiritDie = Math.max(4, Number(getWayfarerEffectiveDie('spirit', 6) || 6));
          for (var spi = 0; spi < Number(spiritCounts.add || 0); spi++) {
            castTotal += rollCombatDieTotal(spiritDie, 'action', 'Spell Spirit Bonus d' + spiritDie + ' #' + (spi + 1));
          }
          for (var spj = 0; spj < Number(spiritCounts.sub || 0); spj++) {
            castTotal -= rollCombatDieTotal(spiritDie, 'action', 'Spell Spirit Penalty d' + spiritDie + ' #' + (spj + 1));
          }
        }
      }
      castTotal = Math.max(1, Number(castTotal || 1));
      if (finalValorFloorStepDowns > 0) {
        var resistRollsNeeded = Math.max(2, 1 + finalValorFloorStepDowns);
        var resistPick = null;
        for (var vr = 0; vr < resistRollsNeeded; vr++) {
          var attempt = rollCombatDieTotal(finalValorDie, 'dread', 'Valor resistance d' + finalValorDie + ' Step-Down ' + (vr + 1) + '/' + resistRollsNeeded);
          if (resistPick === null || attempt < resistPick) resistPick = attempt;
        }
        resistTotal = Math.max(1, Number(resistPick || 1));
      } else {
        resistTotal = rollCombatDieTotal(finalValorDie, 'dread', 'Valor resistance d' + finalValorDie);
      }
    }

    var margin = Math.max(-99, Number(castTotal || 0) - Number(resistTotal || 0));
    addHistory((caster.name || 'Caster') + ' casts ' + preview.spellLabel + ': Mind ' + castTotal + ' vs Valor ' + resistTotal + ' (' + (margin >= 0 ? '+' : '') + margin + ').');
    if (margin <= 0) {
      safeNotif(preview.spellLabel + ' fizzles.', 'warn');
      clearCombatSpellPreview(true);
      return false;
    }

    var burstStress = preview.damageOnHit ? Math.max(1, margin) : 0;
    var zoneTickStress = 0;
    if (preview.zoneEnabled) {
      if (String(preview.tickMode || 'none') === 'margin') zoneTickStress = Math.max(1, margin + Math.max(0, Number(preview.tickAmount || 0)));
      else if (String(preview.tickMode || 'none') === 'fixed') zoneTickStress = Math.max(0, Number(preview.tickAmount || 0));
    }
    var keyMap = {};
    preview.hexKeys.forEach(function (key) { if (key) keyMap[key] = true; });
    var impacted = (state.tokens || []).filter(function (token) {
      if (!token || isTokenDead(token)) return false;
      if (String(token.id || '') === String(caster.id || '')) return false;
      var sameFaction = String(token.faction || '') === String(caster.faction || '');
      if (preview.targetMode === 'allies' && !sameFaction) return false;
      if (preview.targetMode !== 'all' && preview.targetMode !== 'allies' && sameFaction) return false;
      return !!keyMap[toKey(Number(token.q || 0), Number(token.r || 0))];
    });

    if (Number(preview.pullToCenterRadius || 0) > 0) {
      applyCombatSpellPullToCenter(impacted, Number(preview.targetQ || 0), Number(preview.targetR || 0), Number(preview.pullToCenterRadius || 1));
    }

    impacted.forEach(function (token) {
      if (burstStress > 0) {
        applyDamageToToken(token.id, burstStress, preview.spellLabel);
      }
      if (preview.onHitCondition) {
        if (token.isPlayer && window.S) {
          if (!window.S.conditions || typeof window.S.conditions !== 'object') window.S.conditions = {};
          window.S.conditions[String(preview.onHitCondition)] = true;
          if (typeof window.updateConditionButtons === 'function') {
            try { window.updateConditionButtons(); } catch (_spellCondErr) {}
          }
        } else {
          setTokenStatusFlag(token.id, preview.onHitCondition);
        }
      }
      if (preview.onHitActionDown) {
        if (token.isPlayer && window.S && window.S.combat) {
          window.S.combat.actionsLeft = Math.max(0, Number(window.S.combat.actionsLeft || 0) - 1);
          if (typeof window.updateCombatUI === 'function') {
            try { window.updateCombatUI(); } catch (_spellActErr) {}
          }
        } else {
          setTokenStatusFlag(token.id, 'action-down');
        }
      }
      if (preview.zoneEnabled && zoneTickStress > 0) {
        addTokenRoundEffect(token.id, preview.spellLabel, zoneTickStress, Math.max(1, Number(preview.rounds || 2)), String(preview.border || '#a4dfff'));
      }
    });

    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var rules = ensureCombatSceneRulesExtensions(inner.sceneRules || {});
      var zones = Array.isArray(rules.aoeZones) ? rules.aoeZones.slice() : [];
      if (preview.zoneEnabled) {
        zones.push({
          id: uid('aoe'),
          label: preview.spellLabel + ' Zone',
          shape: String(preview.shape || 'line'),
          sourceTokenId: String(caster.id || ''),
          sourceName: String(caster.name || 'Caster'),
          centerQ: Number(preview.targetQ || caster.q || 0),
          centerR: Number(preview.targetR || caster.r || 0),
          hexKeys: preview.hexKeys.slice(),
          save: 'defend',
          dreadDie: valorDie,
          tickStress: Math.max(0, Number(zoneTickStress || 0)),
          tickActionDown: !!preview.onHitActionDown,
          tickCondition: String(preview.tickCondition || ''),
          roundsLeft: Math.max(1, Number(preview.rounds || 2)),
          tickOnEnter: !!preview.zoneTickOnEnter,
          tickOnRoundStart: !!preview.zoneTickOnRoundStart,
          color: String(preview.color || 'rgba(108,189,255,0.26)'),
          border: String(preview.border || 'rgba(164,223,255,0.95)')
        });
      }
      rules.aoeZones = zones.slice(-24);
      next.sceneRules = rules;
      next.spellPreview = normalizeCombatSpellPreview({ active: false });
      next.activeTool = 'select';
      persist(next);
      return next;
    });

    var summary = preview.spellLabel + ' hits ' + impacted.length + ' target' + (impacted.length === 1 ? '' : 's') + '.';
    if (burstStress > 0) summary += ' Burst damage = margin (' + burstStress + ').';
    if (preview.zoneEnabled) summary += ' Zone tick ' + zoneTickStress + '/round for ' + preview.rounds + ' rounds.';
    addHistory(summary);
    if (meta && meta.profile && typeof showUnifiedSpellResultModal === 'function') {
      showUnifiedSpellResultModal('Spell Manifestation - ' + String(preview.spellLabel || 'Spell'), meta.profile, {
        success: margin > 0,
        margin: Math.max(1, Math.abs(margin)),
        actionTotal: castTotal,
        dreadTotal: resistTotal,
        context: String(preview.spellLabel || 'Spell') + ' (VTT)',
        manual: !!manualMode,
        circData: meta.circData || null
      });
    }
    safeNotif(preview.spellLabel + ' cast complete' + (impacted.length ? (': ' + impacted.length + ' impacted.') : '.'), impacted.length ? 'good' : 'info');
    drawBoard();
    updateUiPanels();
    return true;
  }

  function hasAoeActionDownEffect(skill) {
    var row = skill && typeof skill === 'object' ? skill : {};
    var type = String(row.effectType || row.kind || '').toLowerCase();
    if (type === 'action_down') return true;
    var text = (String(row.onFail || '') + ' ' + String(row.desc || '') + ' ' + String(row.name || '')).toLowerCase();
    return /-1\s*action|lose\s+1\s+action/.test(text);
  }

  function createEnemySkillAoeZone(skill, actor, foe, margin, stressDealt) {
    var row = skill && typeof skill === 'object' ? skill : {};
    var tpl = row.aoeTemplate && typeof row.aoeTemplate === 'object' ? row.aoeTemplate : null;
    if (!tpl || !actor || !foe) return null;

    var state = store.getState();
    var shape = String(tpl.shape || '').toLowerCase();
    var center = { q: Number(foe.q || 0), r: Number(foe.r || 0) };
    var hexes = [];
    if (shape === 'line') {
      hexes = buildAoeZoneLineHexes(state, actor, center, Math.max(1, Number(tpl.length || 4)));
    } else if (shape === 'ring') {
      hexes = buildAoeZoneRingHexes(state, center, Number(tpl.innerRadius || 1), Number(tpl.outerRadius || 2));
    }
    if (!hexes.length) return null;

    var label = String(row.name || 'Enemy AoE') + ' Zone';
    var cond = String(row.onFailCondition || '').trim().toLowerCase();
    var zone = {
      id: uid('aoe'),
      label: label,
      shape: shape,
      sourceTokenId: String(actor.id || ''),
      sourceName: String(actor.name || 'Enemy'),
      centerQ: Number(center.q || 0),
      centerR: Number(center.r || 0),
      hexKeys: hexes.map(function (hex) { return toKey(hex.q, hex.r); }),
      save: String(getEnemySkillSaveKey(row) || 'defend').toLowerCase(),
      dreadDie: Math.max(4, Number(getEnemySkillDreadDie(row, actor.dread || actor.codexDread || 6))),
      tickStress: Math.max(0, Number(stressDealt || 0)),
      tickActionDown: hasAoeActionDownEffect(row),
      tickCondition: cond,
      roundsLeft: Math.max(1, Number(tpl.rounds || 2)),
      tickOnEnter: tpl.tickOnEnter !== false,
      tickOnRoundStart: tpl.tickOnRoundStart !== false,
      color: shape === 'line' ? 'rgba(255,124,86,0.28)' : 'rgba(255,159,92,0.24)',
      border: shape === 'line' ? 'rgba(255,132,96,0.9)' : 'rgba(255,190,122,0.86)'
    };

    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var rules = ensureCombatSceneRulesExtensions(inner.sceneRules || {});
      var zones = Array.isArray(rules.aoeZones) ? rules.aoeZones.slice() : [];
      zones.push(zone);
      rules.aoeZones = zones.slice(-24);
      next.sceneRules = rules;
      persist(next);
      return next;
    });

    addHistory(zone.label + ' created (' + zone.roundsLeft + ' rounds). Enter or stay requires a ' + String(getEnemySkillSaveLabel(row) || 'Defend') + ' save.');
    return zone;
  }

  function resolveEnemyAoeZoneSave(zone, token, triggerLabel) {
    if (!zone || !token || isTokenDead(token)) return { failed: false, damage: 0 };
    var targetDie = Math.max(4, Number(getTargetSaveDieForSkill(token, { save: zone.save }) || 6));
    var dreadDie = Math.max(4, Number(zone.dreadDie || 6));
    var saveRoll = rollCombatDieTotal(targetDie, 'action', String(token.name || 'Target') + ' ' + String(zone.save || 'defend') + ' save d' + targetDie);
    var dreadRoll = rollCombatDieTotal(dreadDie, 'dread', String(zone.sourceName || 'Enemy') + ' AoE Dread d' + dreadDie);
    var failed = Number(dreadRoll || 0) > Number(saveRoll || 0);
    var damage = 0;

    if (failed) {
      damage = Math.max(0, Number(zone.tickStress || 0));
      if (damage > 0) {
        applyDamageToToken(token.id, damage, String(zone.label || 'AoE'));
      }
      if (zone.tickActionDown && token.isPlayer && window.S && window.S.combat) {
        window.S.combat.actionsLeft = Math.max(0, Number(window.S.combat.actionsLeft || 0) - 1);
        if (typeof window.updateCombatUI === 'function') {
          try { window.updateCombatUI(); } catch (_aoeUiErr) {}
        }
      }
      if (zone.tickCondition) {
        if (token.isPlayer && window.S) {
          if (!window.S.conditions || typeof window.S.conditions !== 'object') window.S.conditions = {};
          window.S.conditions[String(zone.tickCondition)] = true;
          if (typeof window.updateConditionButtons === 'function') {
            try { window.updateConditionButtons(); } catch (_aoeCondErr) {}
          }
        } else {
          setTokenStatusFlag(token.id, zone.tickCondition);
        }
      }
    }

    addHistory(String(zone.label || 'AoE') + ' ' + String(triggerLabel || 'tick') + ': ' + String(token.name || 'Target')
      + ' rolled ' + Number(saveRoll || 0) + ' vs Dread ' + Number(dreadRoll || 0)
      + (failed ? (' and failed' + (damage > 0 ? (' (' + damage + ' damage)') : '')) : ' and resisted') + '.');

    return { failed: failed, damage: damage };
  }

  function triggerEnemyAoeEnterEffects(token, fromQ, fromR, toQ, toR) {
    if (!isWayfarerSideToken(token)) return;
    var state = store.getState();
    var rules = ensureCombatSceneRulesExtensions(state.sceneRules || {});
    var zones = Array.isArray(rules.aoeZones) ? rules.aoeZones.slice() : [];
    if (!zones.length) return;
    var fromKey = toKey(fromQ, fromR);
    var toKeyNow = toKey(toQ, toR);
    zones.forEach(function (zone) {
      if (!zone || !zone.tickOnEnter || Number(zone.roundsLeft || 0) <= 0) return;
      var keys = Array.isArray(zone.hexKeys) ? zone.hexKeys : [];
      var entered = keys.indexOf(toKeyNow) >= 0 && keys.indexOf(fromKey) < 0;
      if (!entered) return;
      resolveEnemyAoeZoneSave(zone, token, 'enter');
    });
  }

  function processEnemyAoeRoundHazards() {
    var state = store.getState();
    var rules = ensureCombatSceneRulesExtensions(state.sceneRules || {});
    var zones = Array.isArray(rules.aoeZones) ? rules.aoeZones.slice() : [];
    if (!zones.length) return;

    var targets = (state.tokens || []).filter(function (row) { return isWayfarerSideToken(row); });
    zones.forEach(function (zone) {
      if (!zone || !zone.tickOnRoundStart || Number(zone.roundsLeft || 0) <= 0) return;
      var keys = Array.isArray(zone.hexKeys) ? zone.hexKeys : [];
      targets.forEach(function (token) {
        if (!token || isTokenDead(token)) return;
        if (keys.indexOf(toKey(token.q, token.r)) < 0) return;
        resolveEnemyAoeZoneSave(zone, token, 'stay');
      });
    });

    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var nextRules = ensureCombatSceneRulesExtensions(inner.sceneRules || {});
      nextRules.aoeZones = (Array.isArray(nextRules.aoeZones) ? nextRules.aoeZones : []).map(function (zone) {
        if (!zone) return null;
        var copy = Object.assign({}, zone);
        copy.roundsLeft = Math.max(0, Number(copy.roundsLeft || 0) - 1);
        return copy;
      }).filter(function (zone) { return zone && Number(zone.roundsLeft || 0) > 0; });
      next.sceneRules = nextRules;
      persist(next);
      return next;
    });
  }

  function applyEnemySkillFailEffects(skill, actor, foe, margin, stressDealt) {
    var row = skill && typeof skill === 'object' ? skill : {};
    var type = String(row.effectType || row.kind || '').toLowerCase();
    var notes = [];
    var extraDamage = 0;
    var m = Math.max(1, Number(margin || 1));
    var bonus = Math.max(0, Number(row.effectBonus || row.onFailStressBonus || 0));
    var currentRound = Math.max(1, Number(window.S && window.S.combat && window.S.combat.round || 1));

    if (type === 'radiation') {
      var rad = Math.max(1, m + bonus);
      if (typeof window.changeCounter === 'function') window.changeCounter('radiation', rad);
      if (window.S) window.S.radiation = Math.max(0, Number(window.S.radiation || 0) + rad);
      if (typeof window.updateAllStatDisplays === 'function') {
        try { window.updateAllStatDisplays(); } catch (_radUiErr) {}
      }
      notes.push('Radiation +' + rad);
    } else if (type === 'action_down') {
      if (window.S && window.S.combat) {
        window.S.combat.actionsLeft = Math.max(0, Number(window.S.combat.actionsLeft || 0) - 1);
        notes.push('Wayfarer loses 1 Action');
      }
    } else if (type === 'lock_spell' || type === 'lock_hack' || type === 'lock_augmentation') {
      if (window.S && window.S.combat) {
        if (!window.S.combat.enemySkillLocks || typeof window.S.combat.enemySkillLocks !== 'object') {
          window.S.combat.enemySkillLocks = {};
        }
        var key = type === 'lock_spell' ? 'spellUntilRound' : (type === 'lock_hack' ? 'hackUntilRound' : 'augmentationUntilRound');
        window.S.combat.enemySkillLocks[key] = Math.max(Number(window.S.combat.enemySkillLocks[key] || 0), currentRound + 1);
        notes.push(type === 'lock_spell' ? 'Spellcasting locked until next turn' : (type === 'lock_hack' ? 'Hack casting locked until next turn' : 'Augmentation use locked until next turn'));
      }
    } else if (type === 'condition_negative' || type === 'savecondition') {
      var pool = ['weakened', 'vulnerable', 'shaken', 'distracted'];
      var cond = String(row.effectCondition || row.onFailCondition || '').trim().toLowerCase();
      if (pool.indexOf(cond) < 0) cond = pool[Math.max(0, m + bonus) % pool.length];
      if (foe && foe.isPlayer && window.S) {
        if (!window.S.conditions || typeof window.S.conditions !== 'object') window.S.conditions = {};
        window.S.conditions[cond] = true;
        if (typeof window.updateConditionButtons === 'function') window.updateConditionButtons();
        if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
      } else if (foe) {
        setTokenStatusFlag(foe.id, cond);
      }
      notes.push('Condition applied: ' + cond);
    } else if (type === 'mental_stress' || type === 'directstress') {
      var ms = Math.max(1, m + bonus);
      if (foe && foe.isPlayer) {
        if (typeof window.changeMentalStress === 'function') window.changeMentalStress(ms);
        else if (window.S) window.S.mentalStress = Math.max(0, Number(window.S.mentalStress || 0) + ms);
      } else {
        extraDamage += ms;
      }
      notes.push('Mental Stress +' + ms);
    } else if (type === 'damage' || type === 'healthstrike' || type === 'forcetrauma') {
      extraDamage += Math.max(1, m + bonus);
      notes.push('Extra damage +' + Math.max(1, m + bonus));
    } else if (type === 'self_heal') {
      var heal = Math.max(1, Number(row.dreadDie || actor && (actor.dread || actor.codexDread) || 6));
      if (actor) healTokenHp(actor.id, heal);
      notes.push((actor && actor.name ? actor.name : 'Enemy') + ' heals ' + heal);
    } else if (type === 'self_siphon') {
      var siphon = Math.max(1, Number(stressDealt || 0));
      if (actor) healTokenHp(actor.id, siphon);
      notes.push((actor && actor.name ? actor.name : 'Enemy') + ' siphon-heals ' + siphon);
    } else if (type === 'self_protected') {
      if (actor) setTokenStatusFlag(actor.id, 'protected');
      notes.push((actor && actor.name ? actor.name : 'Enemy') + ' gains Protected (1 round)');
    } else if (type === 'self_empowered') {
      if (actor) setTokenStatusFlag(actor.id, 'empowered');
      notes.push((actor && actor.name ? actor.name : 'Enemy') + ' gains Empowered (1 round)');
    } else if (type === 'self_invisible') {
      if (actor) setTokenStatusFlag(actor.id, 'invisible');
      notes.push((actor && actor.name ? actor.name : 'Enemy') + ' turns Invisible (1 round)');
    } else if (type === 'self_invincible') {
      if (actor) setTokenStatusFlag(actor.id, 'invincible');
      notes.push((actor && actor.name ? actor.name : 'Enemy') + ' turns Invincible (1 round)');
    }

    var zone = createEnemySkillAoeZone(row, actor, foe, m, Math.max(0, Number(stressDealt || 0)));
    if (zone) {
      notes.push('Created AoE zone: ' + String(zone.label || 'Zone') + ' (' + Number(zone.roundsLeft || 0) + ' rounds)');
      var stateNow = store.getState();
      var zoneKeys = Array.isArray(zone.hexKeys) ? zone.hexKeys : [];
      (stateNow.tokens || []).forEach(function (token) {
        if (!isWayfarerSideToken(token)) return;
        if (zoneKeys.indexOf(toKey(token.q, token.r)) < 0) return;
        resolveEnemyAoeZoneSave(zone, token, 'initial');
      });
    }

    return { extraDamage: Math.max(0, Number(extraDamage || 0)), notes: notes };
  }

  window.debugApplyEnemySkillEffect = function (effectType, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = store.getState();
    var actorId = String(opts.actorId || '');
    var foeId = String(opts.foeId || '');
    var actor = actorId ? byId(actorId) : null;
    var foe = foeId ? byId(foeId) : null;
    if (!actor) {
      actor = (state.tokens || []).find(function (row) {
        return row && String(row.faction || '') === 'monster' && !isTokenDead(row);
      }) || null;
    }
    if (!foe) {
      foe = (state.tokens || []).find(function (row) {
        return row && (row.isPlayer || String(row.faction || '') === 'player') && !isTokenDead(row);
      }) || null;
    }
    if (!actor || !foe) {
      return { ok: false, error: 'Missing actor or foe.' };
    }

    var skill = normalizeEnemySkillRow({
      name: String(opts.name || 'Debug Skill'),
      desc: String(opts.desc || 'Debug effect invocation.'),
      save: String(opts.save || 'defend'),
      range: Array.isArray(opts.range) && opts.range.length ? opts.range.slice() : ['engaged'],
      kind: String(effectType || opts.kind || 'damage'),
      effectType: String(effectType || opts.kind || 'damage'),
      effectCondition: String(opts.effectCondition || ''),
      damageMode: String(opts.damageMode || 'flat'),
      onFailStress: Math.max(0, Number(opts.onFailStress == null ? 1 : opts.onFailStress)),
      onFailStressBonus: Math.max(0, Number(opts.onFailStressBonus || 0)),
      dreadDie: Math.max(4, Number(opts.dreadDie || actor.dread || actor.codexDread || 6)),
      source: 'Debug',
      onFail: String(opts.onFail || 'Debug fail effect.'),
      onSuccess: String(opts.onSuccess || 'Debug success.')
    }, 0, actor.name || 'Enemy');

    var margin = Math.max(1, Number(opts.margin || 2));
    var baseStress = resolveEnemySkillStress(skill, margin);
    var effectOut = applyEnemySkillFailEffects(skill, actor, foe, margin, baseStress);
    var totalStress = Math.max(0, Number(baseStress || 0)) + Math.max(0, Number(effectOut && effectOut.extraDamage || 0));
    if (totalStress > 0 && !opts.skipDamage) {
      applyDamageToToken(foe.id, totalStress, actor.name || 'Enemy');
    }

    return {
      ok: true,
      actorId: String(actor.id || ''),
      foeId: String(foe.id || ''),
      totalStress: totalStress,
      notes: effectOut && Array.isArray(effectOut.notes) ? effectOut.notes.slice() : []
    };
  };

  function pickMerchantLootItemsForToken(dread) {
    var loot = [];
    var shopData = null;
    try {
      if (window && window.SHOP_DATA && typeof window.SHOP_DATA === 'object') shopData = window.SHOP_DATA;
      else if (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && typeof SHOP_DATA === 'object') shopData = SHOP_DATA;
    } catch (_err) {
      shopData = null;
    }
    if (!shopData) return loot;

    var categories = ['items', 'essentials', 'toolkits', 'remedies', 'scrolls', 'tradegoods'];
    var pool = [];
    categories.forEach(function (cat) {
      var list = Array.isArray(shopData[cat]) ? shopData[cat] : [];
      list.forEach(function (entry) {
        if (!entry) return;
        var label = String((entry.name || entry) || '').trim();
        if (label) pool.push(label);
      });
    });
    if (!pool.length) return loot;

    var rolls = Math.max(1, Math.min(3, Math.ceil(Math.max(1, Number(dread || 4)) / 4)));
    for (var i = 0; i < rolls; i++) {
      var pick = pool[Math.floor(Math.random() * pool.length)] || '';
      if (pick) loot.push(pick);
    }
    return loot;
  }

  function getMerchantLootNamePool() {
    var shopData = null;
    try {
      if (window && window.SHOP_DATA && typeof window.SHOP_DATA === 'object') shopData = window.SHOP_DATA;
      else if (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && typeof SHOP_DATA === 'object') shopData = SHOP_DATA;
    } catch (_err) {
      shopData = null;
    }
    if (!shopData) return [];
    var seen = {};
    var pool = [];
    Object.keys(shopData).forEach(function (cat) {
      var list = Array.isArray(shopData[cat]) ? shopData[cat] : [];
      list.forEach(function (entry) {
        if (!entry) return;
        var label = String((entry.name || entry) || '').trim();
        var key = label.toLowerCase();
        if (!label || seen[key]) return;
        seen[key] = true;
        pool.push(label);
      });
    });
    return pool;
  }

  // Enemy drops are always either 1-2 merchant items or 50-100 credits.
  function rollEnemyMerchantLoot() {
    if (Math.random() < 0.45) {
      return ['Credits x' + String(50 + Math.floor(Math.random() * 51))];
    }
    var pool = getMerchantLootNamePool();
    if (!pool.length) {
      return ['Credits x' + String(50 + Math.floor(Math.random() * 51))];
    }
    var picks = 1 + Math.floor(Math.random() * 2);
    var loot = [];
    for (var i = 0; i < picks; i++) {
      var pick = pool[Math.floor(Math.random() * pool.length)] || '';
      if (pick) loot.push(pick);
    }
    return loot.length ? loot : ['Credits x' + String(50 + Math.floor(Math.random() * 51))];
  }

  // ── TOKEN INVENTORY SEEDING ─────────────────────────────────────────────────
  // Returns how many backpack slots an item occupies based on SHOP_DATA stat field.
  function getItemSlotCost(itemNameRaw) {
    var name = String(itemNameRaw || '').replace(/\s*x\d+$/i, '').trim().toLowerCase();
    if (!name) return 1;
    var shopData = null;
    try {
      shopData = (window && window.SHOP_DATA) || (typeof SHOP_DATA !== 'undefined' ? SHOP_DATA : null);
    } catch (_e) { shopData = null; }
    if (!shopData) return 1;
    var cats = Object.keys(shopData);
    for (var ci = 0; ci < cats.length; ci++) {
      var list = Array.isArray(shopData[cats[ci]]) ? shopData[cats[ci]] : [];
      for (var ii = 0; ii < list.length; ii++) {
        var entry = list[ii];
        if (!entry || !entry.name) continue;
        var eName = String(entry.name || '').toLowerCase();
        if (eName !== name && eName.indexOf(name) < 0 && name.indexOf(eName) < 0) continue;
        var statStr = String(entry.stat || '');
        var m1 = statStr.match(/\b(\d+)\s+slot/i);
        if (m1) return Math.max(1, parseInt(m1[1], 10));
        var m2 = statStr.match(/[Ss]ize\s+(\d+)/);
        if (m2) return Math.max(1, parseInt(m2[1], 10));
        if (/heavy/i.test(statStr)) return 3;
        if (/medium/i.test(statStr)) return 2;
        return 1;
      }
    }
    return 1;
  }

  // Generates 2–3 loot items or 50–100 Credits for a newly-spawned non-player token.
  function seedTokenInventoryItems(factionHint, dreadOrTier) {
    var faction = String(factionHint || 'npc').toLowerCase();
    var tier = Math.max(1, Number(dreadOrTier || 4));
    if (faction === 'monster' || faction === 'enemy') {
      return rollEnemyMerchantLoot();
    }
    // 40% chance: credits-only drop
    if (Math.random() < 0.4) {
      var credits = 50 + Math.floor(Math.random() * 51);
      return ['Credits x' + credits];
    }
    var shopData = null;
    try {
      shopData = (window && window.SHOP_DATA) || (typeof SHOP_DATA !== 'undefined' ? SHOP_DATA : null);
    } catch (_e) { shopData = null; }
    var pool = [];
    if (shopData) {
      var cats = faction === 'monster'
        ? ['items', 'essentials', 'remedies', 'toolkits']
        : ['items', 'essentials', 'remedies', 'scrolls', 'toolkits'];
      cats.forEach(function (cat) {
        var catList = Array.isArray(shopData[cat]) ? shopData[cat] : [];
        catList.forEach(function (e) { if (e && e.name) pool.push(e.name); });
      });
    }
    if (!pool.length) pool = ['Healing Salve', 'Rations', 'Rope (50ft)', 'Torch', 'Antitoxin'];
    var count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    var items = [];
    for (var i = 0; i < count; i++) {
      items.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return items;
  }

  function ensureLootDropForToken(token, reason) {
    if (!token) return;
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var rules = ensureLootDrops(state);
      var key = String(token.id || '');
      if (!rules.lootDrops[key]) {
        var dread = Math.max(1, Number(token.dread || token.codexDread || 4));
        var faction = String(token.faction || 'npc').toLowerCase();
        var items = [];
        var enemyFaction = (faction === 'monster' || faction === 'enemy');
        if (enemyFaction) {
          // Enemies should always loot from Merchant-tab pools: 1-2 items or 50-100 credits.
          if (Array.isArray(token.inventory) && token.inventory.length) items = token.inventory.slice();
          else items = rollEnemyMerchantLoot();
        } else if (faction === 'ally' || faction === 'npc') {
          // Ally/NPC: seed with 2-3 items or credits
          items = seedTokenInventoryItems(faction, dread);
        } else {
          items.push(String(token.name || 'Wayfarer') + ' Kit');
        }
        if (!items.length) items = ['Credits x' + String(50 + Math.floor(Math.random() * 51))];
        rules.lootDrops[key] = {
          id: uid('loot'),
          tokenId: key,
          tokenName: String(token.name || 'Token'),
          q: Number(token.q || 0),
          r: Number(token.r || 0),
          items: items,
          claimed: false,
          droppedAt: Date.now(),
          reason: String(reason || 'defeated')
        };
      }
      next.sceneRules = rules;
      persist(next);
      return next;
    });
  }

  function generatePersonalLootForToken(tokenId, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var force = !!opts.force;
    var token = byId(tokenId);
    if (!token) return false;
    if (token.isPlayer || String(token.faction || '') === 'player') {
      safeNotif('Wayfarer tokens use the shared Backpack instead of personal loot rolls.', 'warn');
      return false;
    }
    var existing = Array.isArray(token.inventory) ? token.inventory.filter(Boolean) : [];
    if (existing.length && !force) {
      safeNotif(String(token.name || 'Token') + ' already has personal loot. Use reroll if desired.', 'info');
      return false;
    }
    var dread = Math.max(1, Number(token.dread || token.codexDread || 4));
    var faction = String(token.faction || 'npc').toLowerCase();
    var generated = seedTokenInventoryItems(faction, dread);
    if (!Array.isArray(generated) || !generated.length) generated = ['Credits x' + String(50 + Math.floor(Math.random() * 51))];
    var generatedList = generated.slice();

    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var updatedToken = null;
      next.tokens = (inner.tokens || []).map(function (row) {
        if (!row || String(row.id) !== String(tokenId)) return row;
        updatedToken = Object.assign({}, row, { inventory: generatedList.slice() });
        return updatedToken;
      });
      if (!updatedToken) return inner;

      if (isTokenDead(updatedToken)) {
        var rules = ensureLootDrops(inner);
        var key = String(updatedToken.id || '');
        var currentDrop = rules.lootDrops[key] || null;
        var currentItems = currentDrop && Array.isArray(currentDrop.items) ? currentDrop.items : [];
        if (!currentDrop || force || !currentItems.length) {
          rules.lootDrops[key] = {
            id: currentDrop && currentDrop.id ? String(currentDrop.id) : uid('loot'),
            tokenId: key,
            tokenName: String(updatedToken.name || 'Token'),
            q: Number(updatedToken.q || 0),
            r: Number(updatedToken.r || 0),
            items: generatedList.slice(),
            claimed: false,
            droppedAt: Date.now(),
            reason: 'manual-generate'
          };
        }
        next.sceneRules = rules;
      }
      persist(next);
      return next;
    });

    addHistory(String(token.name || 'Token') + ' personal loot ' + (force ? 'rerolled' : 'generated') + ': ' + generatedList.join(', ') + '.');
    safeNotif('Loot ready on ' + String(token.name || 'token') + ': ' + generatedList.join(', '), 'good');
    if (typeof window.refreshCombatSheetModalForToken === 'function') {
      try { window.refreshCombatSheetModalForToken(String(tokenId || '')); } catch (_e) {}
    }
    updateUiPanels();
    drawBoard();
    return true;
  }

  // Expose helpers immediately so sheet buttons are reliable even if UI-binding order shifts.
  window.generateCombatTokenLootFromButton = function (btn, force) {
    var tokenId = btn && typeof btn.getAttribute === 'function'
      ? String(btn.getAttribute('data-token-id') || '')
      : '';
    if (!tokenId) {
      safeNotif('Could not resolve token for loot generation.', 'warn');
      return false;
    }
    return generatePersonalLootForToken(tokenId, { force: !!force });
  };
  window.generateCombatTokenLoot = function (tokenId, force) {
    return generatePersonalLootForToken(String(tokenId || ''), { force: !!force });
  };

  function markTokenAsDead(tokenId, reason) {
    var token = byId(tokenId);
    if (!token) return;
    if (isTokenDead(token) && getLootDropForToken(store.getState(), tokenId)) return;
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (row) {
        if (!row || String(row.id) !== String(tokenId)) return row;
        return Object.assign({}, row, { hp: 0, dead: true });
      });
      persist(next);
      return next;
    });
    ensureLootDropForToken(Object.assign({}, token, { hp: 0, dead: true }), reason || 'defeated');
    addHistory(String(token.name || 'Token') + ' was defeated. Loot dropped on the body.');
  }

  function applyDamageToToken(tokenId, damage, sourceLabel) {
    var target = byId(tokenId);
    if (!target || isTokenDead(target)) return 0;
    var amount = Math.max(0, Number(damage || 0));
    if (!amount) return Math.max(0, Number(target.hp || 0));
    var newHp = Math.max(0, Number(target.hp || 0) - amount);
    
    // Create floating damage number
    var state = store.getState();
    var board = state.board;
    var size = Number(board.size || 42) * Number(board.zoom || 1);
    var p = axialToPixel(Number(target.q || 0), Number(target.r || 0), size, board.panX, board.panY);
    createFloatingNumber(p.x, p.y - 10, '-' + amount, 'damage');
    
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (row) {
        if (!row || String(row.id) !== String(tokenId)) return row;
        return Object.assign({}, row, { hp: newHp, dead: newHp <= 0 });
      });

      if (window.S && Array.isArray(window.S.enemies)) {
        var sourceId = Number(target.sourceEnemyId || 0);
        var targetName = String(target.name || '').trim().toLowerCase();
        next.enemies = Array.isArray(state.enemies) ? state.enemies.slice() : state.enemies;
        next.enemies = (window.S.enemies || []).map(function (enemy) {
          if (!enemy || enemy.ally) return enemy;
          var enemyId = Number(enemy.id || 0);
          var matchesSource = sourceId > 0 && enemyId === sourceId;
          var matchesName = !matchesSource && !sourceId && String(enemy.name || '').trim().toLowerCase() === targetName;
          if (!matchesSource && !matchesName) return enemy;
          var maxStress = Math.max(1, Number(enemy.maxStress || enemy.dread || target.maxHp || newHp || amount));
          var nextStress = Math.max(0, maxStress - newHp);
          return Object.assign({}, enemy, {
            stress: nextStress,
            maxStress: maxStress,
            hp: newHp,
            dead: newHp <= 0
          });
        });
        window.S.enemies = next.enemies.map(function (enemy) { return enemy ? Object.assign({}, enemy) : enemy; });
        if (typeof window.renderEnemies === 'function') {
          try { window.renderEnemies(); } catch (_err) {}
        }
      }

      persist(next);
      return next;
    });
    if (target.isPlayer && window.S) {
      // Core sheet health is tracked as damage taken, so incoming damage increments it.
      if (typeof window.setHealth === 'function') {
        window.setHealth(Number(window.S.health || 0) + amount);
      } else {
        window.S.health = Math.max(0, Number(window.S.health || 0) + amount);
      }
      if (typeof window.updateCombatUI === 'function') {
        try { window.updateCombatUI(); } catch (_err) {}
      }
    }
    addHistory((sourceLabel ? String(sourceLabel) + ' hits ' : '') + String(target.name || 'Target') + ' for ' + amount + ' damage (' + newHp + ' HP left).');
    if (newHp <= 0) markTokenAsDead(tokenId, sourceLabel || 'damage');
    drawBoard();
    return newHp;
  }

  function addTokenRoundEffect(targetTokenId, label, stressPerRound, rounds, color) {
    var target = byId(targetTokenId);
    if (!target) return false;
    var safeStress = Math.max(0, Number(stressPerRound || 0));
    var safeRounds = Math.max(1, Number(rounds || 1));
    var safeLabel = String(label || 'Condition').trim() || 'Condition';
    var tone = String(color || '#e3bc5e').trim() || '#e3bc5e';
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var list = Array.isArray(state.tokenRoundEffects) ? state.tokenRoundEffects.slice() : [];
      list.push({
        id: uid('cond'),
        targetTokenId: String(targetTokenId),
        label: safeLabel,
        stressPerRound: safeStress,
        roundsLeft: safeRounds,
        color: tone,
        sourceRound: Math.max(1, Number(state.round || 1))
      });
      next.tokenRoundEffects = list;
      persist(next);
      return next;
    });
    addHistory('Condition applied: ' + safeLabel + ' to ' + String(target.name || 'Token') + ' (' + safeStress + '/round for ' + safeRounds + ' rounds).');
    return true;
  }

  function removeCombatRoundEffect(effectId) {
    var removed = null;
    store.setState(function (state) {
      var list = Array.isArray(state.tokenRoundEffects) ? state.tokenRoundEffects.slice() : [];
      var kept = list.filter(function (effect) {
        var match = effect && String(effect.id || '') === String(effectId || '');
        if (match) removed = effect;
        return !match;
      });
      if (kept.length === list.length) return state;
      var next = Object.assign({}, state, { tokenRoundEffects: kept });
      persist(next);
      return next;
    });
    if (removed) {
      addHistory('Condition cleared: ' + String(removed.label || 'Condition') + '.');
      updateUiPanels();
      drawBoard();
      return true;
    }
    return false;
  }

  function processRoundEffectsForCurrentRound() {
    var st = store.getState();
    var currentRound = Math.max(1, Number(st.round || 1));
    var alreadyApplied = Math.max(0, Number(st.lastConditionRoundApplied || 0));
    if (currentRound <= alreadyApplied) return;

    var fallen = [];
    store.setState(function (state) {
      var roundNow = Math.max(1, Number(state.round || 1));
      var roundApplied = Math.max(0, Number(state.lastConditionRoundApplied || 0));
      if (roundNow <= roundApplied) return state;

      var next = Object.assign({}, state);
      var tokenIndex = {};
      var tokenCopies = (state.tokens || []).map(function (token) {
        var copy = Object.assign({}, token);
        tokenIndex[String(copy.id || '')] = copy;
        return copy;
      });
      var lines = [];
      var effects = (state.tokenRoundEffects || []).map(function (effect) {
        return Object.assign({}, effect);
      });

      effects.forEach(function (effect) {
        if (!effect || Number(effect.roundsLeft || 0) <= 0) return;
        var target = tokenIndex[String(effect.targetTokenId || '')];
        if (!target || isTokenDead(target)) {
          effect.roundsLeft = 0;
          return;
        }
        var tickDamage = Math.max(0, Number(effect.stressPerRound || 0));
        if (tickDamage > 0) {
          var before = Math.max(0, Number(target.hp || 0));
          var after = Math.max(0, before - tickDamage);
          target.hp = after;
          target.dead = after <= 0;
          if (target.isPlayer && window.S) {
            if (typeof window.setHealth === 'function') window.setHealth(Number(window.S.health || 0) + tickDamage);
            else window.S.health = Math.max(0, Number(window.S.health || 0) + tickDamage);
          }
          lines.push(String(effect.label || 'Condition') + ' deals ' + tickDamage + ' to ' + String(target.name || 'Token') + ' (' + after + ' HP).');
          if (after <= 0) {
            fallen.push(Object.assign({}, target));
          }
        }
        effect.roundsLeft = Math.max(0, Number(effect.roundsLeft || 0) - 1);
      });

      next.tokens = tokenCopies;
      next.tokenRoundEffects = effects.filter(function (effect) {
        return effect && Number(effect.roundsLeft || 0) > 0;
      });
      next.lastConditionRoundApplied = roundNow;
      if (lines.length) {
        var baseHistory = Array.isArray(state.actionHistory) ? state.actionHistory.slice() : [];
        next.actionHistory = lines.concat(baseHistory).slice(0, 80);
      }
      persist(next);
      return next;
    });

    if (fallen.length) {
      fallen.forEach(function (token) {
        ensureLootDropForToken(token, 'condition');
      });
    }
    if (typeof window.updateCombatUI === 'function') {
      try { window.updateCombatUI(); } catch (_err) {}
    }
    processEnemyAoeRoundHazards();
    syncWayfarerTokenHealthFromSheet();
    drawBoard();
    updateUiPanels();
  }

  function nearestTokenAt(q, r) {
    var state = store.getState();
    var list = state.tokens || [];
    for (var i = 0; i < list.length; i++) {
      var token = list[i];
      if (Number(token.q) === Number(q) && Number(token.r) === Number(r)) return token;
    }
    return null;
  }

  function findTokenAtCanvasPoint(state, canvasX, canvasY) {
    if (!state || !isLayerVisible(state, 'tokens')) return null;
    var board = state.board || {};
    var size = Number(board.size || 42) * Number(board.zoom || 1);
    var layerOrder = { background: 0, token: 1, foreground: 2 };
    var tokens = (state.tokens || []).slice().sort(function (a, b) {
      var la = layerOrder[String(a && a.layer || 'token')];
      var lb = layerOrder[String(b && b.layer || 'token')];
      if (la !== lb) return Number(lb || 1) - Number(la || 1);
      return Number(b && b.zIndex || 0) - Number(a && a.zIndex || 0);
    });
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (!token) continue;
      var p = getTokenRenderPoint(token, size, board.panX, board.panY);
      var tokenScale = Math.max(0.25, Math.min(2, Number(token.scale || 1)));
      var radius = Math.max(10, (size * 0.32) * Math.max(1, Number(token.size || 1)) * tokenScale);
      if (Math.hypot(Number(canvasX || 0) - p.x, Number(canvasY || 0) - p.y) <= radius + 8) return token;
    }
    return null;
  }

  function isBlocked(q, r) {
    var state = store.getState();
    var profile = getLayerGameplayProfile(state, q, r);
    return !!profile.blockMove;
  }

  function paintAt(q, r) {
    store.setState(function (state) {
      var layer = String(state.activeLayer || 'terrain');
      var tool = String(state.activeTool || 'select');
      if (!state.layers[layer]) return state;
      if (isLayerLocked(state, layer)) {
        safeNotif('Layer is locked.', 'warn');
        return state;
      }
      var next = Object.assign({}, state);
      next.layers = Object.assign({}, state.layers);
      next.layers[layer] = Object.assign({}, state.layers[layer]);
      next.layers.wallSegments = Object.assign({}, state.layers.wallSegments || {});
      var key = toKey(q, r);
      var brushRadius = Math.max(1, Math.min(5, Number(state.paintBrushSize || 1)));
      var brushTargets = [{ q: q, r: r, key: key }];
      if (brushRadius > 1 && !(layer === 'lighting' && /^wall-seg-/.test(String(state.paintValue || '')))) {
        brushTargets = [];
        for (var dr = -brushRadius + 1; dr <= brushRadius - 1; dr++) {
          for (var dq = -brushRadius + 1; dq <= brushRadius - 1; dq++) {
            var dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs((-dq) - dr));
            if (dist >= brushRadius) continue;
            var tq = Number(q || 0) + dq;
            var tr = Number(r || 0) + dr;
            brushTargets.push({ q: tq, r: tr, key: toKey(tq, tr) });
          }
        }
      }
      var paint = String(state.paintValue || 'forest');
      if (layer === 'foreground' && paint === 'draw-ink') {
        paint = 'ink:' + String(state.drawColor || '#e3bc5e') + ':' + String(brushRadius);
      }
      if (tool === 'erase') {
        if (layer === 'lighting' && /^wall-seg-/.test(paint)) {
          var segKey = paint.replace('wall-seg-', '');
          var wallMap = Object.assign({}, next.layers.wallSegments[key] || {});
          delete wallMap[segKey];
          if (Object.keys(wallMap).length) next.layers.wallSegments[key] = wallMap;
          else delete next.layers.wallSegments[key];
          addHistory('Removed wall segment ' + segKey + ' at ' + key + '.');
        } else {
          brushTargets.forEach(function (target) {
            delete next.layers[layer][target.key];
            if (layer === 'lighting') delete next.layers.wallSegments[target.key];
          });
          addHistory('Cleared ' + layer + ' at ' + key + (brushTargets.length > 1 ? ' (brush x' + brushRadius + ').' : '.'));
        }
      } else if (tool === 'paint') {
        if (layer === 'elevation') {
          brushTargets.forEach(function (target) {
            next.layers[layer][target.key] = Number(state.paintValue || 1);
          });
        } else if (layer === 'lighting' && /^wall-seg-/.test(paint)) {
          var seg = paint.replace('wall-seg-', '');
          var map = Object.assign({}, next.layers.wallSegments[key] || {});
          map[seg] = true;
          next.layers.wallSegments[key] = map;
        } else {
          brushTargets.forEach(function (target) {
            next.layers[layer][target.key] = paint;
          });
        }
      }
      persist(next);
      return next;
    });
  }

  function applyFogAt(q, r, brush) {
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.fog = Object.assign({
        enabled: true,
        showMask: true,
        revealMode: 'manual',
        visionRadius: 3,
        sharedVision: true,
        explorerMode: true,
        softEdges: true,
        seen: {},
        revealed: {},
        revealOrder: {},
        revealSeq: 0,
        revealStep: 0
      }, state.fog || {});
      next.fog.enabled = true;
      next.fog.revealed = Object.assign({}, next.fog.revealed || {});
      next.fog.revealOrder = Object.assign({}, next.fog.revealOrder || {});
      var brushRadius = Math.max(1, Math.min(5, Number(state.paintBrushSize || 1)));
      for (var dr = -brushRadius + 1; dr <= brushRadius - 1; dr++) {
        for (var dq = -brushRadius + 1; dq <= brushRadius - 1; dq++) {
          var dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs((-dq) - dr));
          if (dist >= brushRadius) continue;
          var key = toKey(Number(q || 0) + dq, Number(r || 0) + dr);
          if (String(brush || state.fogBrush) === 'hide') {
            delete next.fog.revealed[key];
            delete next.fog.revealOrder[key];
          } else {
            next.fog.revealed[key] = true;
            if (String(next.fog.revealMode || 'manual') === 'ordered') {
              next.fog.revealSeq = Math.max(0, Number(next.fog.revealSeq || 0)) + 1;
              next.fog.revealOrder[key] = next.fog.revealSeq;
              if (Number(next.fog.revealStep || 0) < next.fog.revealSeq) {
                next.fog.revealStep = next.fog.revealSeq;
              }
            }
          }
        }
      }
      persist(next);
      return next;
    });
  }

  function resolveActionForSelectedToken() {
    var state = store.getState();
    var actor = byId(state.selectedTokenId);
    if (!actor) {
      safeNotif('Select a token first.', 'warn');
      return;
    }
    if (!canCurrentUserDriveTokenTurn(actor)) {
      safeNotif(getCampaignCombatTurnDeniedMessage(actor), 'warn');
      return;
    }
    var actionType = String(state.sceneRules && state.sceneRules.defaultActionType || 'ranged');
    var manualMode = !state.autoRoll || isManualRollModeActive();
    var base = 0;
    if (manualMode) {
      var manualBase = promptManualDieTotal('Manual action roll total (1+; exploding totals allowed):', 10, 1, 9999);
      if (manualBase === null) {
        safeNotif('Manual action roll cancelled.', 'info');
        return;
      }
      base = manualBase;
    } else {
      base = Math.floor(Math.random() * 20) + 1;
    }
    base = Math.max(1, Number(base || 10));

    var foes = (state.tokens || []).filter(function (token) {
      return token && String(token.id) !== String(actor.id) && String(token.faction) !== String(actor.faction);
    });
    var target = foes.length ? foes[0] : null;
    var range = target ? hexDistance({ q: actor.q, r: actor.r }, { q: target.q, r: target.r }) : 0;

    var actorElev = Number(state.layers.elevation[toKey(actor.q, actor.r)] || 0);
    var targetElev = target ? Number(state.layers.elevation[toKey(target.q, target.r)] || 0) : 0;
    var elevationMod = 0;
    if (target) {
      if (actorElev > targetElev) elevationMod = 1;
      else if (actorElev < targetElev) elevationMod = -1;
    }

    var weatherMod = getWeatherModifier(state, actionType === 'melee' ? 'melee' : 'ranged');
    var terrainMod = 0;
    var actorProfile = getLayerGameplayProfile(state, actor.q, actor.r);
    var terrain = String(state.layers.terrain[toKey(actor.q, actor.r)] || '');
    if (terrain === 'difficult terrain') terrainMod = -1;
    if (terrain === 'water' && actionType === 'melee') terrainMod -= 1;
    if (actionType === 'melee' || actionType === 'strike') terrainMod += Number(actorProfile.meleeMod || 0);
    if (actionType === 'ranged' || actionType === 'shoot') terrainMod += Number(actorProfile.rangedMod || 0);
    if (actionType === 'defend') terrainMod += Number(actorProfile.defendMod || 0);
    var coverMod = target ? coverPenaltyForTarget(state, actor, target, actionType) : 0;
    var los = target ? losModifierForAction(state, actor, target, actionType) : { blocked: false, mod: 0 };
    var losMod = Number(los.mod || 0);
    var supportBonus = Math.max(0, Number(state.sceneRules && state.sceneRules.supportBonus || 0));
    var total = base + elevationMod + weatherMod + terrainMod + coverMod + losMod + supportBonus;
    var summary = (actor.name || 'Token') + ' action [' + actionType + '] base ' + base + ' + elevation ' + elevationMod + ' + weather ' + weatherMod + ' + terrain ' + terrainMod + ' + cover ' + coverMod + ' + los ' + losMod + ' + support ' + supportBonus + ' = ' + total;
    addHistory(summary);
    if (target) {
      var cin = hexLabel(range);
      var targetDread = Math.max(4, Number(target.dread || target.codexDread || 6));
      if (los.blocked && actionModeFor(actionType) === 'ranged') {
        addHistory((actor.name || 'Token') + ' cannot land a ranged hit on ' + (target.name || 'Target') + ': line of sight blocked.');
        updateUiPanels();
        return;
      }
      var hit = total >= targetDread;
      if (hit) {
        var damage = Math.max(1, total - targetDread);
        var deathNumber = Math.max(1, Number(target.deathNumber || targetDread));
        var autoKill = damage >= deathNumber;
        applyDamageToToken(target.id, autoKill ? Math.max(0, Number(target.hp || 0)) : damage, actor.name || 'Action');
        addHistory((actor.name || 'Token') + ' hits ' + (target.name || 'Target') + ' at ' + range + ' hexes (' + cin + ') for ' + damage + ' damage vs DD' + targetDread + '.' + (autoKill ? (' Death Number ' + deathNumber + ' reached: instant kill.') : ''));
      } else {
        addHistory((actor.name || 'Token') + ' misses ' + (target.name || 'Target') + ' at ' + range + ' hexes (' + cin + ') vs DD' + targetDread + '.');
      }
    }
    if (supportBonus > 0) {
      store.setState(function (inner) {
        var next = Object.assign({}, inner);
        next.sceneRules = Object.assign({}, inner.sceneRules, { supportBonus: 0 });
        persist(next);
        return next;
      });
    }
    updateUiPanels();
  }

  function resolveSharedSceneModifiers(actionKey, options) {
    var state = store.getState();
    var opts = options && typeof options === 'object' ? options : {};
    var action = String(actionKey || 'strike').toLowerCase();
    var actor = opts.actorTokenId ? byId(opts.actorTokenId) : null;
    if (!actor) {
      actor = byId(state.selectedTokenId)
        || (state.tokens || []).find(function (token) { return token && token.isPlayer; })
        || (state.tokens || []).find(function (token) { return token && String(token.faction) === 'player'; })
        || null;
    }
    if (!actor) {
      return { total: 0, elevation: 0, weather: 0, terrain: 0, summary: '', range: 0, cinematic: 'Engaged' };
    }

    var target = null;
    var targetId = opts.targetTokenId || '';
    if (targetId) target = byId(targetId);
    if (!target) {
      var foes = (state.tokens || []).filter(function (token) {
        return token && String(token.id) !== String(actor.id) && String(token.faction) !== String(actor.faction);
      });
      foes.sort(function (a, b) {
        return hexDistance({ q: actor.q, r: actor.r }, { q: a.q, r: a.r }) - hexDistance({ q: actor.q, r: actor.r }, { q: b.q, r: b.r });
      });
      target = foes[0] || null;
    }

    var actorElev = Number(state.layers.elevation[toKey(actor.q, actor.r)] || 0);
    var targetElev = target ? Number(state.layers.elevation[toKey(target.q, target.r)] || 0) : actorElev;
    var elevationMod = 0;
    if (target) {
      if (actorElev > targetElev) elevationMod = 1;
      else if (actorElev < targetElev) elevationMod = -1;
    }

    var weatherMode = 'movement';
    if (action === 'shoot' || action === 'ranged') weatherMode = 'ranged';
    else if (action === 'strike' || action === 'melee') weatherMode = 'melee';
    var weatherMod = getWeatherModifier(state, weatherMode);

    var terrainMod = 0;
    var actorProfile = getLayerGameplayProfile(state, actor.q, actor.r);
    var terrain = String(state.layers.terrain[toKey(actor.q, actor.r)] || '');
    if (terrain === 'difficult terrain') terrainMod -= 1;
    if (terrain === 'water' && (action === 'strike' || action === 'melee' || action === 'defend')) terrainMod -= 1;
    if (terrain === 'lava' && action === 'defend') terrainMod -= 1;
    if (action === 'shoot' || action === 'ranged') terrainMod += Number(actorProfile.rangedMod || 0);
    if (action === 'strike' || action === 'melee') terrainMod += Number(actorProfile.meleeMod || 0);
    if (action === 'defend') terrainMod += Number(actorProfile.defendMod || 0);
    var coverMod = target ? coverPenaltyForTarget(state, actor, target, action) : 0;
    var los = target ? losModifierForAction(state, actor, target, action) : { blocked: false, mod: 0 };
    var losMod = Number(los.mod || 0);

    var range = target ? hexDistance({ q: actor.q, r: actor.r }, { q: target.q, r: target.r }) : 0;
    var total = elevationMod + weatherMod + terrainMod + coverMod + losMod;
    var summary = 'Scene mods: elevation ' + elevationMod + ', weather ' + weatherMod + ', terrain ' + terrainMod + ', cover ' + coverMod + ', los ' + losMod + ' => ' + total;
    return {
      total: total,
      elevation: elevationMod,
      weather: weatherMod,
      terrain: terrainMod,
      cover: coverMod,
      los: losMod,
      losBlocked: !!los.blocked,
      range: range,
      cinematic: hexLabel(range),
      targetName: target ? String(target.name || 'Target') : '',
      actorName: String(actor.name || 'Actor'),
      summary: summary
    };
  }

  function buildCharacterSheetCombatSummary(targetTokenId) {
    var token = byId(targetTokenId);
    var strikeDie = getWayfarerEffectiveDie('strike', 4);
    var shootDie = getWayfarerEffectiveDie('shoot', 4);
    var defendDie = getWayfarerEffectiveDie('defend', 4);
    var controlDie = getWayfarerEffectiveDie('control', 4);
    var conditionState = getWayfarerConditionState();
    var tmw = Math.max(0, Number(window.S && window.S.tmw || 0));
    var hpSnap = getWayfarerHealthSnapshot();
    var health = hpSnap.remaining;
    var maxHealth = hpSnap.max;
    var flavor = String(window.S && window.S.flavor || '').trim();
    var allFlavors = [];
    if (window.S && Array.isArray(window.S.personalFlavors)) {
      window.S.personalFlavors.forEach(function (entry) {
        var txt = String(entry || '').trim();
        if (txt && allFlavors.indexOf(txt) < 0) allFlavors.push(txt);
      });
    }
    if (flavor && allFlavors.indexOf(flavor) < 0) allFlavors.push(flavor);

    var affix = (typeof window.getEquippedAffixCombatBonuses === 'function') ? window.getEquippedAffixCombatBonuses() : {};
    var wpStrike = (typeof window.parseWeaponBonuses === 'function') ? window.parseWeaponBonuses('strike') : { flat: 0, advDie: 0 };
    var wpShoot = (typeof window.parseWeaponBonuses === 'function') ? window.parseWeaponBonuses('shoot') : { flat: 0, advDie: 0 };
    var flStrike = (typeof window.getFlavorBonus === 'function') ? window.getFlavorBonus('strike') : { flat: 0, advDice: [] };
    var flShoot = (typeof window.getFlavorBonus === 'function') ? window.getFlavorBonus('shoot') : { flat: 0, advDice: [] };
    var mtStrike = (typeof window.getMutationBonus === 'function') ? window.getMutationBonus('strike') : { flat: 0, advDice: [] };
    var mtShoot = (typeof window.getMutationBonus === 'function') ? window.getMutationBonus('shoot') : { flat: 0, advDice: [] };
    var rollMod = window.S && window.S.rollMod ? window.S.rollMod : { flat: 0, advDice: [] };

    var strikeFlat = Number(wpStrike.flat || 0) + Number(flStrike.flat || 0) + Number(mtStrike.flat || 0) + Number(rollMod.flat || 0);
    var shootFlat = Number(wpShoot.flat || 0) + Number(flShoot.flat || 0) + Number(mtShoot.flat || 0) + Number(rollMod.flat || 0);
    if (Number(affix && affix.strikeFlat || 0)) strikeFlat += Number(affix.strikeFlat || 0);
    if (Number(affix && affix.shootFlat || 0)) shootFlat += Number(affix.shootFlat || 0);

    var strikeAdv = [];
    var shootAdv = [];
    strikeAdv = strikeAdv.concat((flStrike && flStrike.advDice) || []).concat((mtStrike && mtStrike.advDice) || []);
    shootAdv = shootAdv.concat((flShoot && flShoot.advDice) || []).concat((mtShoot && mtShoot.advDice) || []);
    if (Number(wpStrike && wpStrike.advDie || 0) > 0) strikeAdv.push(Number(wpStrike.advDie));
    if (Number(wpShoot && wpShoot.advDie || 0) > 0) shootAdv.push(Number(wpShoot.advDie));
    if (Array.isArray(rollMod && rollMod.advDice)) {
      strikeAdv = strikeAdv.concat(rollMod.advDice);
      shootAdv = shootAdv.concat(rollMod.advDice);
    }

    var defendAdvCount = parseDefendAdvantageCount();
    var defendArmorAdvDice = parseArmorDefendAdvDice();
    var defendAffixFlat = parseAffixDefendFlatBonus();
    var defendArmorFlat = parseArmorDefendFlatBonus();
    var defendFlat = defendAffixFlat + defendArmorFlat;
    var defendAdvParts = [];
    if (defendAdvCount > 0) defendAdvParts.push('+' + defendAdvCount + ' AD');
    if (defendArmorAdvDice.length) defendAdvParts.push('Armor AD ' + defendArmorAdvDice.map(function (die) { return 'd' + die; }).join(', '));

    var lines = [];
    lines.push('Your Actions: ' + Math.max(0, Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0)) + '/' + Math.max(1, Number(window.S && window.S.combat && window.S.combat.maxActions || 3)) + ' · Health: ' + health + '/' + maxHealth + ' · TMW: ' + tmw);
    lines.push('Dice: Strike d' + strikeDie + ' · Shoot d' + shootDie + ' · Defend d' + defendDie + ' · Control d' + controlDie);
    lines.push('Conditions: +' + ['Empowered', 'Protected', 'Focused', 'Bolstered'].filter(function (label) { return conditionState[label.toLowerCase()]; }).join(', ') + ' · -' + ['Weakened', 'Vulnerable', 'Distracted', 'Shaken'].filter(function (label) { return conditionState[label.toLowerCase()]; }).join(', '));
    lines.push('Strike math: ' + (strikeFlat >= 0 ? '+' : '') + strikeFlat + ' flat' + (strikeAdv.length ? (' · Advantage ' + strikeAdv.map(function (v) { return 'd' + v; }).join(', ')) : ''));
    lines.push('Shoot math: ' + (shootFlat >= 0 ? '+' : '') + shootFlat + ' flat' + (shootAdv.length ? (' · Advantage ' + shootAdv.map(function (v) { return 'd' + v; }).join(', ')) : ''));
    lines.push('Defend math: ' + (defendFlat >= 0 ? '+' : '') + defendFlat + ' flat' + (defendAdvParts.length ? (' · ' + defendAdvParts.join(' · ')) : ''));
    lines.push('Flavor: ' + (flavor || 'None selected') + (token ? (' · Token: ' + String(token.name || 'Token')) : ''));
    var equip = window.S && window.S.equipment ? window.S.equipment : {};
    var w1 = String(equip.weapon1 || '').trim();
    var w2 = String(equip.weapon2 || '').trim();
    var armor = String(equip.armor || '').trim();
    var augments = window.S && Array.isArray(window.S.augmentations) ? window.S.augmentations.filter(Boolean) : [];
    var hacks = window.S && Array.isArray(window.S.ownedHacks) ? window.S.ownedHacks.filter(Boolean) : [];
    var weaponMods = window.S && Array.isArray(window.S.weaponMods) ? window.S.weaponMods.filter(Boolean) : [];
    var backpack = window.S && Array.isArray(window.S.backpack) ? window.S.backpack.map(function (item) { return String(item || '').trim(); }).filter(Boolean) : [];
    lines.push('Weapon: ' + (w1 || 'None') + (w2 ? (' · Off-hand: ' + w2) : '') + ' · Armor: ' + (armor || 'None'));
    lines.push(
      'Loadout: Flavor ' + (allFlavors.length ? allFlavors.slice(0, 3).map(function (f) { return String(f).split(':')[0].trim(); }).join(', ') : 'None')
      + ' · Hacks ' + (hacks.length ? hacks.slice(0, 4).join(', ') : 'None')
      + ' · Augmentations ' + (augments.length ? augments.slice(0, 4).join(', ') : 'None')
      + ' · Weapon Mods ' + (weaponMods.length ? weaponMods.slice(0, 4).join(', ') : 'None')
      + ' · Backpack ' + (backpack.length ? backpack.slice(0, 3).join(', ') : 'Empty')
    );
    return lines;
  }

  function formatSoulArraySummary() {
    var soul = Array.isArray(window.S && window.S.soulArray) ? window.S.soulArray.slice() : [];
    if (!soul.length) return 'Not rolled yet';
    var labels = ['Body', 'Spirit', 'Lead', 'Control', 'Mind', 'Strike', 'Shoot', 'Defend'];
    return soul.map(function (die, idx) {
      var label = labels[idx] || ('Slot ' + (idx + 1));
      return label + ' d' + Math.max(4, Number(die || 4));
    }).join(', ');
  }

  function getWayfarerResourceSnapshot() {
    var stats = window.S && window.S.stats ? window.S.stats : {};
    var valorDie = Math.max(4, Number(stats.valor || 4));
    return {
      valorDie: valorDie,
      trauma: Math.max(0, Number(window.S && window.S.trauma || 0)),
      mentalStress: Math.max(0, Number(window.S && window.S.mentalStress || 0)),
      pathTokens: Math.max(0, Number(window.S && window.S.pathTokens || 0)),
      teamwork: Math.max(0, Number(window.S && window.S.tmw || 0))
    };
  }

  function buildWayfarerConditionControlHtml(token) {
    var cond = window.S && window.S.conditions ? window.S.conditions : {};
    var positive = ['empowered', 'protected', 'focused', 'bolstered'];
    var negative = ['weakened', 'vulnerable', 'distracted', 'shaken'];
    function chip(kind) {
      var on = !!cond[kind];
      return '<button class="btn btn-xs" style="padding:.08rem .34rem;' + (on ? 'border-color:rgba(73,201,187,.65);color:var(--combat-accent-2);' : '') + '" onclick="window.combatSheetToggleWayfarerCondition&&window.combatSheetToggleWayfarerCondition(\'' + kind + '\',\'' + String(token && token.id || '') + '\')">' + kind + (on ? ' ✓' : '') + '</button>';
    }
    return '<div style="display:grid;gap:.24rem;">'
      + '<div><div class="combat-mini" style="margin-bottom:.14rem;color:var(--combat-accent-2);">Positive</div><div style="display:flex;gap:.18rem;flex-wrap:wrap;">' + positive.map(chip).join('') + '</div></div>'
      + '<div><div class="combat-mini" style="margin-bottom:.14rem;color:var(--combat-danger);">Negative</div><div style="display:flex;gap:.18rem;flex-wrap:wrap;">' + negative.map(chip).join('') + '</div></div>'
      + '<div style="display:flex;gap:.18rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs" type="button" onclick="window.combatSheetClearWayfarerConditions&&window.combatSheetClearWayfarerConditions(\'negative\',\'' + String(token && token.id || '') + '\')">Clear Negative</button>'
      + '<button class="btn btn-xs" type="button" onclick="window.combatSheetClearWayfarerConditions&&window.combatSheetClearWayfarerConditions(\'all\',\'' + String(token && token.id || '') + '\')">Clear All</button>'
      + '</div>'
      + '</div>';
  }

  function buildWayfarerResourceControlHtml(token) {
    var snap = getWayfarerResourceSnapshot();
    var tokenId = String(token && token.id || '');
    function row(label, key, value) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:.28rem;padding:.12rem 0;border-bottom:1px solid rgba(255,255,255,.06);">'
        + '<div style="font-size:.74rem;">' + label + '</div>'
        + '<div style="display:flex;gap:.18rem;align-items:center;">'
        + '<button class="btn btn-xs" type="button" onclick="window.combatSheetAdjustWayfarerResource&&window.combatSheetAdjustWayfarerResource(\'' + key + '\',-1,\'' + tokenId + '\')">-</button>'
        + '<strong id="combatSheetRes-' + key + '" style="min-width:2ch;text-align:center;">' + value + '</strong>'
        + '<button class="btn btn-xs" type="button" onclick="window.combatSheetAdjustWayfarerResource&&window.combatSheetAdjustWayfarerResource(\'' + key + '\',1,\'' + tokenId + '\')">+</button>'
        + '</div></div>';
    }
    return '<div class="combat-rules-body">'
      + '<div class="combat-rules-line">Soul Array: <strong>' + escapeHtml(formatSoulArraySummary()) + '</strong></div>'
      + '<div class="combat-rules-line">Valor Die: <strong>d' + snap.valorDie + '</strong></div>'
      + row('Trauma', 'trauma', snap.trauma)
      + row('Mental Stress', 'mentalStress', snap.mentalStress)
      + row('Path Tokens', 'pathTokens', snap.pathTokens)
      + row('Teamwork', 'tmw', snap.teamwork)
      + '</div>';
  }

  function refreshCombatSheetWayfarerWidgets() {
    var snap = getWayfarerResourceSnapshot();
    var pairs = {
      trauma: snap.trauma,
      mentalStress: snap.mentalStress,
      pathTokens: snap.pathTokens,
      tmw: snap.teamwork
    };
    Object.keys(pairs).forEach(function (key) {
      var el = document.getElementById('combatSheetRes-' + key);
      if (el) el.textContent = String(pairs[key]);
    });
  }

  window.syncCombatSheetFromCharacterTab = function (tokenId) {
    var id = String(tokenId || '');
    if (typeof syncWayfarerTokenHealthFromSheet === 'function') syncWayfarerTokenHealthFromSheet();
    if (typeof window.updateConditionButtons === 'function') window.updateConditionButtons();
    if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
    if (id) normalizeSelection(id, [id]);
    refreshCombatSheetWayfarerWidgets();
    updateUiPanels();
    drawBoard();
    safeNotif('Combat sheet synced from Character tab.', 'good');
  };

  window.combatSheetAdjustWayfarerResource = function (key, delta, tokenId) {
    var amount = Number(delta || 0);
    if (!amount) return;
    if (key === 'trauma') {
      if (typeof window.changeTrauma === 'function') window.changeTrauma(amount);
      else if (window.S) window.S.trauma = Math.max(0, Number(window.S.trauma || 0) + amount);
    } else if (key === 'mentalStress') {
      if (typeof window.changeMentalStress === 'function') window.changeMentalStress(amount);
      else if (window.S) window.S.mentalStress = Math.max(0, Number(window.S.mentalStress || 0) + amount);
    } else if (key === 'pathTokens' || key === 'tmw') {
      if (typeof window.changeCounter === 'function') window.changeCounter(key, amount);
      else if (window.S) window.S[key] = Math.max(0, Number(window.S[key] || 0) + amount);
    }
    if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
    if (typeof syncWayfarerTokenHealthFromSheet === 'function') syncWayfarerTokenHealthFromSheet();
    if (tokenId) normalizeSelection(tokenId, [tokenId]);
    refreshCombatSheetWayfarerWidgets();
    updateUiPanels();
    drawBoard();
  };

  window.combatSheetToggleWayfarerCondition = function (conditionKey, tokenId) {
    var key = String(conditionKey || '');
    if (!key) return;
    if (typeof window.toggleCond === 'function') {
      window.toggleCond(key);
    } else if (window.S && window.S.conditions && Object.prototype.hasOwnProperty.call(window.S.conditions, key)) {
      window.S.conditions[key] = !window.S.conditions[key];
    }
    if (typeof window.updateConditionButtons === 'function') window.updateConditionButtons();
    if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
    if (tokenId) normalizeSelection(tokenId, [tokenId]);
    updateUiPanels();
    drawBoard();
    openTokenSheetQuickView(tokenId);
  };

  window.combatSheetClearWayfarerConditions = function (scope, tokenId) {
    var clearScope = String(scope || 'all').toLowerCase();
    var targets = clearScope === 'negative'
      ? ['weakened', 'vulnerable', 'distracted', 'shaken']
      : ['empowered', 'protected', 'focused', 'bolstered', 'weakened', 'vulnerable', 'distracted', 'shaken'];
    if (window.S && window.S.conditions) {
      targets.forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(window.S.conditions, key)) window.S.conditions[key] = false;
      });
    }
    if (typeof window.updateConditionButtons === 'function') window.updateConditionButtons();
    if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
    if (tokenId) normalizeSelection(tokenId, [tokenId]);
    updateUiPanels();
    drawBoard();
    openTokenSheetQuickView(tokenId);
  };

  function buildEnemyTokenQuickActions(token) {
    if (!token || token.isPlayer || String(token.faction || '') !== 'monster') return '';
    var state = store.getState();
    var target = (state.tokens || []).find(function (t) {
      return t && t.isPlayer && !isTokenDead(t);
    });
    if (!target || isTokenDead(token)) return '';
    var dist = hexDistance({ q: Number(token.q || 0), r: Number(token.r || 0) }, { q: Number(target.q || 0), r: Number(target.r || 0) });
    var html = '<div style="margin-top:.28rem;border-top:1px solid rgba(227,188,94,.2);padding-top:.22rem;">';
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--combat-accent-2);margin-bottom:.12rem;">Quick Actions</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.16rem;">';
    
    var skills = getEnemySkillOptionsForToken(token, target);
    if (skills.length) {
      var inRangeSkills = skills.filter(function (s) { return !!s.inRange; });
      if (inRangeSkills.length) {
        var firstSkill = inRangeSkills[0];
        var btnText = firstSkill.name.length > 12 ? firstSkill.name.substring(0, 11) + '…' : firstSkill.name;
        html += '<button class="btn btn-xs" style="font-size:.68rem;" onclick="(function(){var token=store.getState().tokens.find(t=>t&&t.id===\'' + String(token.id) + '\');if(token)executeEnemyTokenAction(token,null,\'' + String(firstSkill.id) + '\');updateUiPanels();drawBoard();})();">' + escapeHtml(btnText) + '</button>';
      }
    }
    
    var nearbyTarget = dist <= 1;
    if (nearbyTarget) {
      html += '<button class="btn btn-xs" style="font-size:.68rem;" onclick="(function(){var token=store.getState().tokens.find(t=>t&&t.id===\'' + String(token.id) + '\');if(token)addHistory(token.name+\' attempts melee engagement\');})();">Melee</button>';
    } else if (dist >= 2 && dist <= 3) {
      html += '<button class="btn btn-xs" style="font-size:.68rem;" onclick="(function(){var token=store.getState().tokens.find(t=>t&&t.id===\'' + String(token.id) + '\');if(token)addHistory(token.name+\' maintains ranged pressure\');})();">Range</button>';
    }
    
    if (!nearbyTarget && dist > 1) {
      var adjOptions = [
        [Number(token.q || 0) + 1, Number(token.r || 0)],
        [Number(token.q || 0) - 1, Number(token.r || 0)],
        [Number(token.q || 0), Number(token.r || 0) + 1],
        [Number(token.q || 0), Number(token.r || 0) - 1]
      ];
      var adjQr = adjOptions[Math.floor(Math.random() * adjOptions.length)] || [Number(token.q || 0), Number(token.r || 0)];
      html += '<button class="btn btn-xs" style="font-size:.68rem;" onclick="(function(){var token=store.getState().tokens.find(t=>t&&t.id===\'' + String(token.id) + '\');if(token)moveToken(token.id,' + Number(adjQr[0]) + ',' + Number(adjQr[1]) + ');updateUiPanels();drawBoard();})();">Advance</button>';
    }
    
    html += '<button class="btn btn-xs" style="font-size:.68rem;" onclick="(function(){var token=store.getState().tokens.find(t=>t&&t.id===\'' + String(token.id) + '\');if(token)spendUnitAction(token.id);updateUiPanels();drawBoard();})();">Pass</button>';
    html += '</div></div>';
    return html;
  }

  function buildEnemySkillInspector(token) {
    if (!token || token.isPlayer || String(token.faction || '') !== 'monster') return '';
    var state = store.getState();
    var target = (state.tokens || []).find(function (t) {
      return t && t.isPlayer && !isTokenDead(t);
    });
    if (!target || isTokenDead(token)) return '';
    var skills = getEnemySkillOptionsForToken(token, target);
    if (!skills.length) return '';
    var profile = getEnemyProfileForToken(token) || {};
    
    var dreadDie = Math.max(4, Number(token.dread || token.codexDread || 6));
    var html = '<div style="margin-top:.28rem;border-top:1px solid rgba(227,188,94,.2);padding-top:.22rem;">';
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--combat-accent-2);margin-bottom:.12rem;">Available Skills</div>';
    if (profile.desc || profile.tactic) {
      html += '<div style="margin:0 0 .22rem 0;font-size:.72rem;color:var(--muted2);line-height:1.45;">';
      if (profile.desc) html += '<div><strong style="color:var(--combat-accent-2);">Description:</strong> ' + escapeHtml(String(profile.desc || '')) + '</div>';
      if (profile.tactic) html += '<div><strong style="color:var(--combat-accent-2);">Tactic:</strong> ' + escapeHtml(String(profile.tactic || '')) + '</div>';
      html += '</div>';
    }
    
    skills.forEach(function (entry) {
      if (!entry || !entry.skill) return;
      html += enemySkillCardHtml(entry, token.name, dreadDie, target.name, profile.tactic || '');
      if (entry.inRange) {
        html += '<button class="btn btn-xs" style="margin-top:.12rem;width:100%;font-size:.65rem;padding:.08rem;" onclick="(function(){var token=store.getState().tokens.find(t=>t&&t.id===\'' + String(token.id) + '\');if(token)executeEnemyTokenAction(token,null,\'' + String(entry.id) + '\');updateUiPanels();drawBoard();})();">Execute Skill</button>';
      }
    });
    
    html += '</div>';
    return html;
  }

  function buildLootShortcuts(token) {
    if (!token) return '';
    var state = store.getState();
    var loot = getLootDropForToken(state, token.id);
    var personal = Array.isArray(token.inventory) ? token.inventory.filter(Boolean) : [];
    var isWayfarer = !!(token.isPlayer || String(token.faction || '') === 'player');
    if (!loot && !personal.length && isWayfarer) return '';
    var tokenIdAttr = escapeHtml(String(token.id || ''));
    
    var html = '<div style="margin-top:.28rem;border-top:1px solid rgba(227,188,94,.2);padding-top:.22rem;">';
    if (!isWayfarer) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:.3rem;margin-bottom:.12rem;">';
      html += '<div style="font-size:.72rem;font-weight:700;color:var(--combat-accent-2);">Personal Loot</div>';
      html += '<div style="display:flex;gap:.16rem;">';
      html += '<button class="btn btn-xs" style="font-size:.64rem;" data-token-id="' + tokenIdAttr + '" onclick="window.generateCombatTokenLootFromButton&&window.generateCombatTokenLootFromButton(this,false)">Generate</button>';
      html += '<button class="btn btn-xs" style="font-size:.64rem;" data-token-id="' + tokenIdAttr + '" onclick="window.generateCombatTokenLootFromButton&&window.generateCombatTokenLootFromButton(this,true)">Reroll</button>';
      html += '</div></div>';
      if (personal.length) {
        html += '<div style="font-size:.68rem;color:var(--muted2);margin-bottom:.16rem;">';
        html += personal.slice(0, 3).map(function (name) { return escapeHtml(String(name || '')); }).join(' · ');
        if (personal.length > 3) html += ' · +' + (personal.length - 3) + ' more';
        html += '</div>';
      } else {
        html += '<div style="font-size:.68rem;color:var(--muted2);margin-bottom:.16rem;">No personal loot rolled yet.</div>';
      }
    }
    if (loot) {
      html += '<div style="font-size:.72rem;font-weight:700;color:var(--combat-accent-2);margin-bottom:.12rem;">Loot Available</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.16rem;">';
      html += '<button class="btn btn-xs" style="font-size:.68rem;background:#2a5c3d;" onclick="(function(){var card=document.getElementById(\'combatLootPopupCard\');if(card){card.style.display=\'block\';card.style.left=\'50%\';card.style.top=\'50%\';card.style.transform=\'translate(-50%,-50%)\';var buttons=card.querySelectorAll(\'#combatLootTakeAllBtn\');if(buttons.length)buttons[0].click();}})();">Take All</button>';
      html += '<button class="btn btn-xs" style="font-size:.68rem;" onclick="(function(){var card=document.getElementById(\'combatLootPopupCard\');if(card)card.style.display=(card.style.display===\'none\'?\'block\':\'none\');})();">Inspect</button>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildCombatSheetCard(card, token, sectionKey) {
    var search = [String(sectionKey || ''), String(card && card.title || '')]
      .concat(card && card.chips || [])
      .concat(card && card.lines || [])
      .join(' ')
      .toLowerCase();
    var chips = (card && card.chips || []).map(function (chip) {
      return '<span class="combat-rules-chip">' + escapeHtml(String(chip || '')) + '</span>';
    }).join('');
    var lines = (card && card.lines || []).map(function (line) {
      return '<div class="combat-rules-line">' + escapeHtml(String(line || '')) + '</div>';
    }).join('');
    var html = card && card.html ? String(card.html) : '<div class="combat-rules-body">' + lines + '</div>';
    return ''
      + '<article class="combat-rules-card combat-sheet-card" data-sheet-card="true" data-sheet-search="' + escapeHtml(search) + '">'
      + '<div class="combat-rules-meta"><span class="combat-rules-icon">' + escapeHtml(String(card && card.icon || 'SHT')) + '</span><span class="combat-rules-section-label">' + escapeHtml(String(sectionKey || 'Sheet')) + '</span></div>'
      + '<div class="combat-rules-title">' + escapeHtml(String(card && card.title || 'Card')) + '</div>'
      + '<div class="combat-rules-chip-row">' + chips + '</div>'
      + html
      + '</article>';
  }

  function buildCombatSheetCards(token) {
    var cards = [];
    var lines = buildCharacterSheetCombatSummary(token && token.id);
    var activeEffects = (store.getState().tokenRoundEffects || []).filter(function (effect) {
      return effect && String(effect.targetTokenId || '') === String(token && token.id || '') && Number(effect.roundsLeft || 0) > 0;
    });
    var activeLabels = activeEffects.map(function (effect) {
      return String(effect.label || 'Effect') + ' (' + Math.max(1, Number(effect.roundsLeft || 1)) + 'r)';
    });
    if (token && (token.isPlayer || String(token.faction || '') === 'player')) {
      cards.push({
        title: 'Wayfarer Snapshot',
        icon: 'SHT',
        chips: [String(token.name || 'Wayfarer'), 'Player Token'],
        lines: [lines[0] || '', lines[1] || '']
      });
      cards.push({
        title: 'Attack Math',
        icon: 'DMG',
        chips: ['Strike', 'Shoot', 'Defend'],
        lines: [lines[3] || '', lines[4] || '', lines[5] || '']
      });
      cards.push({
        title: 'Loadout and Flavor',
        icon: 'KIT',
        chips: ['Equipment', 'Flavor', 'Utility'],
        lines: [lines[6] || '', lines[7] || '', lines[8] || '']
      });
      cards.push({
        title: 'Soul Array and Resources',
        icon: 'VAL',
        chips: ['Valor', 'Trauma', 'Mental Stress', 'Path', 'Teamwork'],
        html: buildWayfarerResourceControlHtml(token)
      });
      cards.push({
        title: 'Condition Controls',
        icon: 'CON',
        chips: ['Positive', 'Negative'],
        html: '<div class="combat-rules-body">' + buildWayfarerConditionControlHtml(token) + '</div>'
      });
      cards.push({
        title: 'Conditions and Effects',
        icon: 'FX',
        chips: activeLabels.length ? activeLabels : ['No active effects'],
        lines: activeLabels.length
          ? activeLabels.concat(['Use the context menu or quick effects to add, clear, and time conditions during a scene.'])
          : ['No active combat effects are running on this wayfarer.', 'Long Rest and recovery actions still use the province, sea region, and map systems outside the VTT.']
      });
    } else {
      var enemyProfile = getEnemyProfileForToken(token) || null;
      cards.push({
        title: 'Threat Snapshot',
        icon: 'MON',
        chips: [String(token && token.name || 'Enemy'), 'Enemy Token'],
        lines: [
          'Faction: ' + String(token && token.faction || 'monster'),
          'HP: ' + Math.max(0, Number(token && token.hp || 0)) + '/' + Math.max(1, Number(token && token.maxHp || token && token.hp || 1)),
          'Dread Die: d' + Math.max(4, Number(token && (token.dread || token.codexDread) || 6)),
          'Death Number: ' + Math.max(1, Number(token && (token.deathNumber || token.dread || token.codexDread) || 6)),
          enemyProfile && enemyProfile.desc ? 'Description: ' + String(enemyProfile.desc || '') : '',
          enemyProfile && enemyProfile.tactic ? 'Tactic: ' + String(enemyProfile.tactic || '') : ''
        ]
      });
      cards.push({
        title: 'Enemy Skill Inspector',
        icon: 'SKL',
        chips: ['Range checks', 'Save targets'],
        html: '<div class="combat-rules-body">' + buildEnemySkillInspector(token) + '</div>'
      });
      cards.push({
        title: 'Quick Actions',
        icon: 'ACT',
        chips: ['Advance', 'Skill', 'Pass'],
        html: '<div class="combat-rules-body">' + buildEnemyTokenQuickActions(token) + '</div>'
      });
      cards.push({
        title: 'Loot and Status',
        icon: 'LOOT',
        chips: activeLabels.length ? activeLabels : ['No active effects'],
        html: '<div class="combat-rules-body">'
          + (activeLabels.length ? activeLabels.map(function (line) { return '<div class="combat-rules-line">' + escapeHtml(line) + '</div>'; }).join('') : '<div class="combat-rules-line">No active timed effects on this enemy.</div>')
          + buildLootShortcuts(token)
          + '</div>'
      });
    }
    return cards;
  }

  function buildCombatSheetModalHtml(token) {
    var sectionKey = token && (token.isPlayer || String(token.faction || '') === 'player') ? 'Wayfarer Sheet' : 'Enemy Sheet';
    var cards = buildCombatSheetCards(token).map(function (card) {
      return buildCombatSheetCard(card, token, sectionKey);
    }).join('');
    return ''
      + '<div id="combatSheetModalPanel" class="combat-rules-panel combat-sheet-panel" data-token-id="' + escapeHtml(String(token && token.id || '')) + '">'
      + '<div class="combat-rules-toolbar">'
      + '<div>'
      + '<div class="combat-rules-kicker">Character Sheet</div>'
      + '<div class="combat-rules-heading">Fast-reference character and enemy cards for play. Search, inspect, and jump straight into the rules.</div>'
      + '</div>'
      + '<div class="combat-rules-actions">'
      + '<input id="combatSheetSearch" class="combat-rules-search" type="search" placeholder="Search sheet, strike, armor, loot, effects..." oninput="window.filterCombatSheetModal&&window.filterCombatSheetModal(this.value)">'
      + '<button class="btn btn-xs" type="button" onclick="window.syncCombatSheetFromCharacterTab&&window.syncCombatSheetFromCharacterTab(\'' + String(token && token.id || '') + '\')">Sync From Character Tab</button>'
      + '<button class="btn btn-xs" type="button" onclick="window.showCombatRulesReference&&window.showCombatRulesReference()">Rules</button>'
      + '</div>'
      + '</div>'
      + '<div class="combat-rules-summary">Showing <span id="combatSheetMatchCount">0</span> sheet cards for ' + escapeHtml(String(token && token.name || 'token')) + '.</div>'
      + '<div class="combat-rules-grid">' + cards + '</div>'
      + '</div>';
  }

  window.filterCombatSheetModal = function (query) {
    var panel = document.getElementById('combatSheetModalPanel');
    if (!panel) return;
    var value = String(query || '').toLowerCase();
    var cards = panel.querySelectorAll('[data-sheet-card]');
    var count = 0;
    for (var i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      var match = !value || String(card.getAttribute('data-sheet-search') || '').indexOf(value) >= 0;
      card.style.display = match ? '' : 'none';
      if (match) count += 1;
    }
    var countEl = document.getElementById('combatSheetMatchCount');
    if (countEl) countEl.textContent = String(count);
  };

  function openTokenSheetQuickView(tokenId) {
    var token = byId(tokenId);
    if (!token) return;
    if (typeof window.openModal === 'function') {
      window.openModal('Combat Sheet · ' + String(token.name || 'Token'), buildCombatSheetModalHtml(token), null, { preventScroll: true, focusTrap: true });
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          window.filterCombatSheetModal('');
          refreshCombatSheetWayfarerWidgets();
          var input = document.getElementById('combatSheetSearch');
          if (input) {
            try { input.focus({ preventScroll: true }); } catch (_err) { input.focus(); }
          }
        });
      }
    } else {
      safeNotif('Token Sheet: ' + String(token.name || 'Token'), 'info');
    }
  }

  window.refreshCombatSheetModalForToken = function (tokenId) {
    var panel = document.getElementById('combatSheetModalPanel');
    var modalContent = document.getElementById('modalContent');
    if (!panel || !modalContent) return false;
    var activeTokenId = String(panel.getAttribute('data-token-id') || '');
    if (!activeTokenId || String(tokenId || '') !== activeTokenId) return false;
    var token = byId(activeTokenId);
    if (!token) return false;
    var priorQuery = '';
    var priorInput = document.getElementById('combatSheetSearch');
    if (priorInput) priorQuery = String(priorInput.value || '');
    modalContent.innerHTML = buildCombatSheetModalHtml(token);
    window.filterCombatSheetModal(priorQuery);
    refreshCombatSheetWayfarerWidgets();
    var nextInput = document.getElementById('combatSheetSearch');
    if (nextInput) {
      nextInput.value = priorQuery;
      try { nextInput.focus({ preventScroll: true }); } catch (_err) { nextInput.focus(); }
    }
    return true;
  };

  function canActionReachTarget(actionValue, range) {
    var v = String(actionValue || '').toLowerCase();
    if (!v) return true;
    if (v.indexOf('strike') >= 0) return Number(range || 0) <= 1;
    if (v.indexOf('shoot') >= 0) {
      var r = Number(range || 0);
      // Shoot is a ranged option; engaged targets must be struck in melee.
      return r >= 2 && r <= 3;
    }
    return true;
  }

  function spawnBestiaryToken(profile, q, r) {
    if (!profile) return;
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var token = {
        id: uid('bst'),
        name: String(profile.name || 'Beast'),
        enemyProfileName: String(profile.name || ''),
        faction: 'monster',
        dread: Math.max(4, Number(profile.dread || 6)),
        deathNumber: Math.max(4, Number(profile.dread || 6)),
        hp: Math.max(1, Math.max(4, Number(profile.dread || 6)) * 2),
        maxHp: Math.max(1, Math.max(4, Number(profile.dread || 6)) * 2),
        status: [],
        q: Number(q || 0),
        r: Number(r || 0),
        image: String(profile.image || ''),
        size: Number(profile.size || 1),
        codexRegion: String(profile.region || 'province'),
        inventory: seedTokenInventoryItems('monster', Math.max(4, Number(profile.dread || 6))),
        enemySkills: (Array.isArray(profile.skills) && profile.skills.length ? profile.skills.slice(0, 2) : (Array.isArray(profile.abilities) && profile.abilities.length ? profile.abilities.slice(0, 2) : (Array.isArray(profile.moves) && profile.moves.length ? profile.moves.slice(0, 2) : [])))
      };
      next.tokens = (state.tokens || []).concat([token]);
      next.selectedTokenId = token.id;
      next.initiative = [];
      persist(next);
      return next;
    });
    addHistory('Spawned ' + String(profile.name || 'Beast') + ' from Codex bestiary preset.');
    drawBoard();
    updateUiPanels();
  }

  function consumeMovementAction(actor, distance) {
    if (!actor) return true;
    if (!isSceneActive()) return true;
    var wayfarerToken = isWayfarerToken(actor);
    var required = Math.max(1, Number(distance || 1));
    if (wayfarerToken) {
      if (!window.S || !window.S.combat) return true;
      var available = Math.max(0, Number(window.S.combat.actionsLeft || 0));
      if (available < required) {
        safeNotif('Not enough Actions to move. Movement cost includes terrain/layer tax.', 'warn');
        return false;
      }
      if (typeof window.consumeCombatAction === 'function') {
        for (var i = 0; i < required; i++) {
          if (!window.consumeCombatAction('Move 1 Hex')) return false;
        }
        return true;
      }
      window.S.combat.actionsLeft = Math.max(0, available - required);
      if (typeof window.updateCombatUI === 'function') {
        try { window.updateCombatUI(); } catch (_err) {}
      }
      return true;
    }
    var state = store.getState();
    var availableActor = Math.max(0, Number(state.teamActions && state.teamActions[actor.id] || 0));
    if (availableActor < required) {
      var actorLabel = isPlayerFactionToken(actor) ? 'Ally' : 'Enemy token';
      safeNotif(actorLabel + ' is out of actions for movement this turn.', 'warn');
      return false;
    }
    for (var j = 0; j < required; j++) {
      if (!spendUnitAction(actor.id)) return false;
    }
    return true;
  }

  function moveToken(tokenId, q, r, placement) {
    if (isBlocked(q, r)) {
      addHistory('Movement blocked by terrain collision at ' + toKey(q, r) + '.');
      return;
    }
    var state = store.getState();
    var actor = (state.tokens || []).find(function (token) { return token && String(token.id) === String(tokenId); }) || null;
    if (!actor) return;
    if (actor.locked) {
      safeNotif('Token is locked in place.', 'warn');
      return;
    }
    if (!canCurrentUserManipulateToken(actor)) {
      safeNotif(getCombatSceneManipulationDeniedMessage(actor), 'warn');
      return;
    }
    if (!canCurrentUserDriveTokenTurn(actor)) {
      safeNotif(getCampaignCombatTurnDeniedMessage(actor), 'warn');
      return;
    }
    if (isTokenDead(actor)) return;
    var fromQ = Number(actor.q || 0);
    var fromR = Number(actor.r || 0);
    var distance = hexDistance({ q: Number(actor.q || 0), r: Number(actor.r || 0) }, { q: Number(q), r: Number(r) });
    if (distance <= 0) return;
    var activeMovement = !!(state.playMode && isSceneActive());
    if (activeMovement && distance > 1) {
      addHistory('Movement limited to 1 hex per action in active scenes.');
      return;
    }
    var destinationProfile = getLayerGameplayProfile(state, q, r);
    var destinationObject = layerTextValue(state, 'objects', q, r);
    var hasObstacleCheck = /obstacle|trap|turret|barricade|crate|pillar/.test(destinationObject);
    var movementCost = Math.max(1, distance + Math.max(0, Number(destinationProfile.moveTax || 0)));
    var boardSize = Number(state.board && state.board.size || 42) * Number(state.board && state.board.zoom || 1);
    var offsetX = actor.freeform ? clampTokenOffset(placement && placement.offsetX, boardSize) : 0;
    var offsetY = actor.freeform ? clampTokenOffset(placement && placement.offsetY, boardSize) : 0;
    if (activeMovement && !consumeMovementAction(actor, movementCost)) {
      return;
    }
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (token) {
        if (!token || String(token.id) !== String(tokenId)) return token;
        return Object.assign({}, token, { q: Number(q), r: Number(r), offsetX: offsetX, offsetY: offsetY });
      });
      next.ruler = Object.assign({}, state.ruler, { active: false });
      next = syncFogExplorerMemory(next);
      persist(next);
      return next;
    });
    var token = byId(tokenId);
    if (token) {
      addHistory(String(token.name || 'Token') + ' moved to ' + toKey(q, r) + ' (cost ' + movementCost + ' action' + (movementCost === 1 ? '' : 's') + ').');
      triggerEnemyAoeEnterEffects(token, fromQ, fromR, Number(q), Number(r));
      if (Number(destinationProfile.hazardDamage || 0) > 0 || hasObstacleCheck) {
        var hz = Math.max(1, Number(destinationProfile.hazardDamage || 0) || (hasObstacleCheck ? 1 : 0));
        runHazardCheckDialogForToken(token, q, r, destinationProfile, { failDamage: hz });
      }
    }
    if (activeMovement && actor && String(actor.faction || '') === 'monster') {
      maybeAdvanceRoundAfterEnemyActions(actor.id);
    }
  }

  function moveTokenGroupToAnchor(groupIds, anchorId, targetQ, targetR) {
    var state = store.getState();
    var ids = Array.isArray(groupIds) ? groupIds.map(function (id) { return String(id); }) : [];
    if (!ids.length) return false;
    var anchor = (state.tokens || []).find(function (token) { return token && String(token.id) === String(anchorId); }) || null;
    if (!anchor) return false;
    if (!canCurrentUserManipulateToken(anchor)) {
      safeNotif(getCombatSceneManipulationDeniedMessage(anchor), 'warn');
      return false;
    }
    if (!canCurrentUserDriveTokenTurn(anchor)) {
      safeNotif(getCampaignCombatTurnDeniedMessage(anchor), 'warn');
      return false;
    }
    var blockedToken = (state.tokens || []).find(function (token) {
      return token && ids.indexOf(String(token.id || '')) >= 0 && !canCurrentUserManipulateToken(token);
    }) || null;
    if (blockedToken) {
      safeNotif(getCombatSceneManipulationDeniedMessage(blockedToken), 'warn');
      return false;
    }
    var dq = Number(targetQ) - Number(anchor.q || 0);
    var dr = Number(targetR) - Number(anchor.r || 0);
    if (!dq && !dr) return false;
    var moved = false;
    captureUndoSnapshot('Move Group');
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var idMap = {};
      ids.forEach(function (id) { idMap[id] = true; });
      var occupied = {};
      (inner.tokens || []).forEach(function (token) {
        if (!token || idMap[String(token.id)]) return;
        occupied[toKey(token.q, token.r)] = true;
      });
      next.tokens = (inner.tokens || []).map(function (token) {
        if (!token || !idMap[String(token.id)] || token.locked) return token;
        var nq = Number(token.q || 0) + dq;
        var nr = Number(token.r || 0) + dr;
        if (isBlocked(nq, nr)) return token;
        if (occupied[toKey(nq, nr)]) return token;
        moved = true;
        return Object.assign({}, token, { q: nq, r: nr });
      });
      next = syncFogExplorerMemory(next);
      persist(next);
      return next;
    });
    if (moved) {
      addHistory('Moved group of ' + ids.length + ' token(s).');
      drawBoard();
      updateUiPanels();
    }
    return moved;
  }

  function getSelectedTokensOrPrimary(fallbackTokenId) {
    var state = store.getState();
    var selected = Array.isArray(state.selectedTokenIds) && state.selectedTokenIds.length
      ? state.selectedTokenIds.slice()
      : (state.selectedTokenId ? [String(state.selectedTokenId)] : []);
    if (fallbackTokenId && selected.indexOf(String(fallbackTokenId)) < 0) selected = [String(fallbackTokenId)];
    var map = {};
    selected.forEach(function (id) { map[String(id)] = true; });
    return (state.tokens || []).filter(function (token) { return token && map[String(token.id)]; });
  }

  function copyTokensToClipboard(tokenId) {
    var rows = getSelectedTokensOrPrimary(tokenId);
    if (!rows.length) {
      safeNotif('Select token(s) first.', 'warn');
      return;
    }
    var anchor = rows[0];
    var payload = rows.map(function (token) {
      var copy = clone(token);
      copy._offsetQ = Number(token.q || 0) - Number(anchor.q || 0);
      copy._offsetR = Number(token.r || 0) - Number(anchor.r || 0);
      return copy;
    });
    store.setState(function (state) {
      var next = Object.assign({}, state, { clipboardTokens: payload });
      persist(next);
      return next;
    });
    safeNotif('Copied ' + payload.length + ' token(s).', 'good');
  }

  function pasteTokensFromClipboard(baseQ, baseR) {
    var state = store.getState();
    var clip = Array.isArray(state.clipboardTokens) ? state.clipboardTokens : [];
    if (!clip.length) {
      safeNotif('Clipboard is empty.', 'warn');
      return;
    }
    captureUndoSnapshot('Paste Tokens');
    var created = [];
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var taken = {};
      (inner.tokens || []).forEach(function (token) {
        if (!token) return;
        taken[toKey(token.q, token.r)] = true;
      });
      var add = clip.map(function (source, idx) {
        var col = idx % 4;
        var row = Math.floor(idx / 4);
        var q = Number(baseQ || 0) + Number(source._offsetQ || 0) + col;
        var r = Number(baseR || 0) + Number(source._offsetR || 0) + row;
        var safety = 0;
        while (taken[toKey(q, r)] && safety < 20) {
          q += 1;
          if (q % 2 === 0) r += 1;
          safety += 1;
        }
        taken[toKey(q, r)] = true;
        var token = Object.assign({}, source, {
          id: uid('tok'),
          q: q,
          r: r,
          locked: false
        });
        delete token._offsetQ;
        delete token._offsetR;
        created.push(String(token.id));
        return token;
      });
      next.tokens = (inner.tokens || []).concat(add);
      next.selectedTokenIds = created.slice();
      next.selectedTokenId = created[0] || '';
      next.initiative = [];
      persist(next);
      return next;
    });
    addHistory('Pasted ' + created.length + ' token(s) with auto spacing.');
    drawBoard();
    updateUiPanels();
  }

  function enumerateSelectedTokens(baseLabel) {
    var selected = getSelectedTokensOrPrimary('');
    if (!selected.length) {
      safeNotif('Select one or more tokens first.', 'warn');
      return;
    }
    var base = String(baseLabel || selected[0].name || 'Token').trim() || 'Token';
    captureUndoSnapshot('Enumerate Tokens');
    var ids = selected.map(function (token) { return String(token.id); });
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var idMap = {};
      ids.forEach(function (id) { idMap[id] = true; });
      var n = 1;
      next.tokens = (state.tokens || []).map(function (token) {
        if (!token || !idMap[String(token.id)]) return token;
        var out = Object.assign({}, token, { name: base + ' ' + n });
        n += 1;
        return out;
      });
      persist(next);
      return next;
    });
    addHistory('Enumerated ' + selected.length + ' token(s) as ' + base + ' 1..' + selected.length + '.');
    drawBoard();
    updateUiPanels();
  }

  function transformSelectedTokens(kind, value) {
    var selected = getSelectedTokensOrPrimary('');
    if (!selected.length) {
      safeNotif('Select token(s) first.', 'warn');
      return;
    }
    captureUndoSnapshot('Transform Tokens');
    var idMap = {};
    selected.forEach(function (token) { idMap[String(token.id)] = true; });
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (token) {
        if (!token || !idMap[String(token.id)]) return token;
        var out = Object.assign({}, token);
        if (kind === 'rotate') {
          out.rotation = Number(out.rotation || 0) + Number(value || 0);
        } else if (kind === 'scale') {
          out.scale = Math.max(0.25, Math.min(2, Number(value || out.scale || 1)));
        }
        return out;
      });
      persist(next);
      return next;
    });
    drawBoard();
    updateUiPanels();
  }

  function patchSelectedTokens(patch, opts) {
    var selected = getSelectedTokensOrPrimary('');
    if (!selected.length) return false;
    var options = opts && typeof opts === 'object' ? opts : {};
    var idMap = {};
    selected.forEach(function (token) { idMap[String(token.id)] = true; });
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (token) {
        if (!token || !idMap[String(token.id)]) return token;
        var delta = typeof patch === 'function' ? patch(token) : patch;
        if (!delta || typeof delta !== 'object') return token;
        var out = Object.assign({}, token, delta);
        out.scale = Math.max(0.25, Math.min(2, Number(out.scale || 1)));
        out.visionRadius = Math.max(0, Math.min(12, Number(out.visionRadius == null ? 3 : out.visionRadius)));
        out.visionShape = String(out.visionShape || 'radius') === 'cone' ? 'cone' : 'radius';
        out.auraRadius = Math.max(0, Math.min(12, Number(out.auraRadius || 0)));
        out.auraColor = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(String(out.auraColor || '')) ? String(out.auraColor) : '#49c9bb';
        out.offsetX = clampTokenOffset(out.freeform ? out.offsetX : 0, Number(state.board && state.board.size || 42) * Number(state.board && state.board.zoom || 1));
        out.offsetY = clampTokenOffset(out.freeform ? out.offsetY : 0, Number(state.board && state.board.size || 42) * Number(state.board && state.board.zoom || 1));
        return out;
      });
      next = syncFogExplorerMemory(next);
      persist(next);
      return next;
    });
    if (options.draw !== false) drawBoard();
    if (options.ui !== false) updateUiPanels();
    return true;
  }

  function toggleSelectedLock(forceValue) {
    var selected = getSelectedTokensOrPrimary('');
    if (!selected.length) {
      safeNotif('Select token(s) first.', 'warn');
      return;
    }
    var targetValue = typeof forceValue === 'boolean' ? forceValue : !selected.every(function (token) { return !!token.locked; });
    captureUndoSnapshot('Toggle Lock');
    var idMap = {};
    selected.forEach(function (token) { idMap[String(token.id)] = true; });
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (token) {
        if (!token || !idMap[String(token.id)]) return token;
        return Object.assign({}, token, { locked: targetValue });
      });
      persist(next);
      return next;
    });
    safeNotif(targetValue ? 'Placement locked.' : 'Placement unlocked.', 'good');
    drawBoard();
    updateUiPanels();
  }

  function reorderSelectedTokens(direction) {
    var selected = getSelectedTokensOrPrimary('');
    if (!selected.length) return;
    captureUndoSnapshot('Reorder Tokens');
    var ids = selected.map(function (token) { return String(token.id); });
    var idMap = {};
    ids.forEach(function (id) { idMap[id] = true; });
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var rest = (state.tokens || []).filter(function (token) { return token && !idMap[String(token.id)]; });
      var pick = (state.tokens || []).filter(function (token) { return token && idMap[String(token.id)]; });
      next.tokens = direction === 'front' ? rest.concat(pick) : pick.concat(rest);
      persist(next);
      return next;
    });
    drawBoard();
    updateUiPanels();
  }

  function cycleSelectedTokenLayer() {
    var selected = getSelectedTokensOrPrimary('');
    if (!selected.length) {
      safeNotif('Select token(s) first.', 'warn');
      return;
    }
    var order = ['background', 'token', 'foreground'];
    captureUndoSnapshot('Change Token Layer');
    var idMap = {};
    selected.forEach(function (token) { idMap[String(token.id)] = true; });
    store.setState(function (state) {
      var next = Object.assign({}, state);
      next.tokens = (state.tokens || []).map(function (token) {
        if (!token || !idMap[String(token.id)]) return token;
        var cur = String(token.layer || 'token');
        var idx = order.indexOf(cur);
        if (idx < 0) idx = 1;
        var layer = order[(idx + 1) % order.length];
        return Object.assign({}, token, { layer: layer });
      });
      persist(next);
      return next;
    });
    drawBoard();
    updateUiPanels();
  }

  function placePartyNear(q, r) {
    captureUndoSnapshot('Place Party');
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var team = (state.tokens || []).filter(function (token) {
        return token && (token.isPlayer || String(token.faction) === 'player');
      });
      var offsets = [
        { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
        { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }
      ];
      var idToPos = {};
      team.forEach(function (token, idx) {
        var off = offsets[idx % offsets.length];
        idToPos[String(token.id)] = { q: Number(q || 0) + off.q, r: Number(r || 0) + off.r };
      });
      next.tokens = (state.tokens || []).map(function (token) {
        if (!token) return token;
        var p = idToPos[String(token.id)];
        if (!p || token.locked) return token;
        return Object.assign({}, token, { q: p.q, r: p.r });
      });
      next.selectedTokenIds = team.map(function (token) { return String(token.id); });
      next.selectedTokenId = next.selectedTokenIds[0] || next.selectedTokenId;
      persist(next);
      return next;
    });
    addHistory('Placed party near ' + toKey(q, r) + '.');
    drawBoard();
    updateUiPanels();
  }

  function addTurnForToken(tokenId) {
    var target = byId(tokenId);
    if (!target) return;
    captureUndoSnapshot('Add Turn');
    store.setState(function (state) {
      var next = Object.assign({}, state);
      var list = Array.isArray(state.initiative) ? state.initiative.slice() : [];
      list.push({ tokenId: String(target.id), name: String(target.name || 'Token') });
      next.initiative = list;
      persist(next);
      return next;
    });
    addHistory('Added extra turn for ' + String(target.name || 'Token') + '.');
    updateUiPanels();
  }

  function ensureOverlayDom() {
    var existing = document.getElementById('combatModeOverlay');
    if (existing) return existing;
    var root = document.createElement('section');
    root.id = 'combatModeOverlay';
    root.className = 'combat-mode-overlay';
    root.setAttribute('tabindex', '-1');
    root.setAttribute('role', 'application');
    root.setAttribute('aria-label', 'Combat encounter workspace');
    setTimeout(function() {
      try { root.focus({ preventScroll: true }); } catch (e) { root.focus(); }
    }, 0);
    root.innerHTML = ''
      + '<div class="combat-entry-splash" id="combatEntrySplash">'
      + '<div class="combat-entry-card">'
      + '<div class="combat-entry-title">Entering Encounter...</div>'
      + '<div class="combat-entry-mode">COMBAT MODE</div>'
      + '</div>'
      + '</div>'
      + '<div class="combat-topbar">'
      + '<div>'
      + '<div class="combat-topbar-title">Page: <span id="combatActiveSceneName">Main Scene</span> · Round <span id="combatRoundDisplay">1</span></div>'
      + '<div class="combat-mini" id="combatTopMeta">No active scene. | Turn: <span id="combatTurnDisplay">Awaiting start</span> &middot; <span id="combatSharedSyncBadge">Sync --</span></div>'
      + '</div>'
      + '<div style="display:flex;gap:.28rem;align-items:center;">'
      + '<button class="btn btn-xs btn-primary" id="combatStartSceneBtn">Start Scene</button>'
      + '<button class="btn btn-xs" id="combatPlayModeBtn">Play View</button>'
      + '<button class="btn btn-xs" id="combatCompactModeBtn" title="Toggle compact panel layout">Compact: Auto</button>'
      + '<button class="btn btn-xs" id="combatAddWayfarerBtn" title="Add Wayfarer to board">+ Wayfarer</button>'
      + '<button class="btn btn-xs combat-editor-only" id="combatUploadMapBtn">Upload Battlemap</button>'
      + '<button class="btn btn-xs combat-editor-only" id="combatClearMapBtn">Remove Battlemap</button>'
      + '<button class="btn btn-xs combat-editor-only" id="combatClearBoardBtn" title="Clear tokens, placements, fog reveals, and active effects in this scene">Clear Board</button>'
      + '<button class="btn btn-xs combat-editor-only" id="combatAddTokenBtn">+ Add Enemy</button>'
      + '<select class="combat-select combat-editor-only" id="combatPageSelect" style="max-width:180px;"></select>'
      + '<button class="btn btn-xs combat-editor-only" id="combatCreatePageBtn" title="Create new map page">+ Create Page</button>'
      + '<button class="btn btn-xs combat-editor-only" id="combatBuildMapBtn" title="Build map page with auto-filled hexes">Build Map</button>'
      + '<button class="btn btn-xs btn-red" id="combatCloseBtn">End Scene</button>'
      + '<div style="display:flex;gap:.28rem;align-items:center;margin-left:.4rem;border-left:1px solid rgba(227,188,94,.2);padding-left:.4rem;">'
      + '<button class="btn btn-xs" id="combatRulesReferenceBtn" title="Combat Rules Reference">Rules</button>'
      + '<button class="btn btn-xs combat-editor-only" id="combatSaveSceneCardBtn" title="Save current scene as card">Save Scene</button>'
      + '<button class="btn btn-xs combat-editor-only" id="combatLoadSceneCardBtn" title="Load a saved scene card">Load Scene</button>'
      + '<button class="btn btn-xs combat-editor-only" id="combatNewSceneTemplateBtn" title="Create new scene from template">New Scene</button>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div id="combatDragDebugBanner" class="combat-drag-debug-banner" aria-live="polite"></div>'
      + '<input id="combatMapImageInput" type="file" accept="image/*" style="display:none;">'
      + '<input id="combatHexAssetImageInput" type="file" accept="image/*" style="display:none;">'
      + '<input id="combatTokenImageInput" type="file" accept="image/*" style="display:none;">'
      + '<input id="combatImportSceneInput" type="file" accept="application/json,.json" style="display:none;">'
      + '<div id="combatAriaLive" aria-live="polite" aria-atomic="true" class="combat-sr-only"></div>'
      + '<div class="combat-canvas-wrap" id="combatCanvasWrap"><canvas id="combatSceneCanvas"></canvas><input id="combatBubbleInlineInput" type="text" style="display:none;position:absolute;z-index:8;min-width:54px;height:20px;padding:0 .25rem;border:1px solid rgba(227,188,94,.8);background:rgba(4,6,12,.96);color:#fff;font-size:.72rem;"><div id="combatLootPopupCard" style="display:none;position:absolute;z-index:9;min-width:240px;max-width:300px;border:1px solid rgba(227,188,94,.65);background:rgba(5,8,16,.98);box-shadow:0 12px 28px rgba(0,0,0,.45);padding:.45rem .5rem;border-radius:10px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:.35rem;"><div id="combatLootPopupTitle" style="font:600 .83rem Rajdhani,sans-serif;color:var(--combat-accent-2);">Body Loot</div><button class="btn btn-xs" id="combatLootCloseBtn" style="padding:.08rem .3rem;">X</button></div><div id="combatLootPopupMeta" class="combat-mini" style="margin:.18rem 0 .28rem 0;"></div><div id="combatLootPopupList" style="display:grid;gap:.2rem;max-height:180px;overflow:auto;padding-right:.1rem;"></div><div style="display:flex;gap:.24rem;flex-wrap:wrap;margin-top:.34rem;"><button class="btn btn-xs" id="combatLootTakeSelectedBtn">Take Selected</button><button class="btn btn-xs" id="combatLootTakeAllBtn">Take All</button></div></div><div id="combatTokenContextMenu" class="combat-token-menu" style="display:none;"></div></div>'
      + '<div id="combatAssetDragGhost" class="combat-asset-drag-ghost" aria-hidden="true"></div>'
      + '<aside class="combat-icon-rail" id="combatIconRail">'
      + '<button class="combat-icon-btn" id="combatRailSelectBtn" title="Select Tool (V)"><span class="combat-svg-icon">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" aria-label="Select Tool"><path d="M12 2l4 8h-3v8h-2v-8H8z" fill="currentColor"/></svg>'
      + '</span></button>'
      + '<button class="combat-icon-btn" id="combatRailPanBtn" title="Pan Tool (Space)"><span class="combat-svg-icon">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" aria-label="Pan Tool"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2"/></svg>'
      + '</span></button>'
      + '<button class="combat-icon-btn" id="combatRailDrawBtn" title="Draw Tool (D)"><span class="combat-svg-icon">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" aria-label="Draw Tool"><path d="M4 20l16-16M14 4h6v6" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
      + '</span></button>'
      + '<button class="combat-icon-btn" id="combatRailTextBtn" title="Text Tool (T)"><span class="combat-svg-icon">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" aria-label="Text Tool"><path d="M4 6V4h16v2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 6v14" stroke="currentColor" stroke-width="2"/></svg>'
      + '</span></button>'
      + '<button class="combat-icon-btn" id="combatRailMeasureBtn" title="Measure Tool (M)"><span class="combat-svg-icon">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" aria-label="Measure Tool"><rect x="4" y="10" width="16" height="4" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 10v4M16 10v4" stroke="currentColor" stroke-width="2"/></svg>'
      + '</span></button>'
      + '<button class="combat-icon-btn" id="combatRailFogBtn" title="Fog Tool (F)"><span class="combat-svg-icon">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" aria-label="Fog Tool"><ellipse cx="12" cy="12" rx="8" ry="5" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="14" rx="6" ry="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
      + '</span></button>'
      + '<button class="combat-icon-btn" id="combatRailEffectsBtn" title="Effects Tool (E)"><span class="combat-svg-icon">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" aria-label="Effects Tool"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2"/></svg>'
      + '</span></button>'
      + '<button class="combat-icon-btn" id="combatRailDiceBtn" title="Dice Roller (R)"><span class="combat-svg-icon">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" aria-label="Dice Roller"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/></svg>'
      + '</span></button>'
      + '</aside>'
      + '<aside class="combat-floating-panel combat-left-tools combat-editor-only" id="combatToolsPanel">'
      + '<div class="combat-panel-header" data-drag="tools" onclick="togglePanel(\'combatToolsPanel\')">Combat Scene <span style="float:right;font-size:.7rem;cursor:pointer;">◀</span></div>'
      + '<div class="combat-panel-body">'
      + '<div class="combat-label">Layer</div>'
      + '<div class="combat-chip-row" id="combatLayerRow"></div>'
      + '<div class="combat-feed" id="combatLayerSettings" style="margin-top:.22rem;"></div>'
      + '<div class="combat-label" style="margin-top:.35rem;">Tool</div>'
      + '<div class="combat-chip-row" id="combatToolRow"></div>'
      + '<div class="combat-label" style="margin-top:.35rem;">VTT Toolbar</div>'
      + '<div class="combat-chip-row">'
      + '<button class="combat-chip" id="combatToolbarSelectBtn" title="Select Tool (V)">Select</button>'
      + '<button class="combat-chip" id="combatToolbarDrawBtn" title="Draw Tool (D)">Draw</button>'
      + '<button class="combat-chip" id="combatToolbarTextBtn" title="Text Tool (T)">Text</button>'
      + '<button class="combat-chip" id="combatToolbarMeasureBtn" title="Measure Tool (M)">Measure</button>'
      + '<button class="combat-chip" id="combatToolbarRulerBtn" title="Ruler Tool (R)">Ruler</button>'
      + '<button class="combat-chip" id="combatToolbarSpellCastBtn" title="Cast Selected Spell Preview">Cast</button>'
      + '<button class="combat-chip" id="combatToolbarPanBtn" title="Pan Tool (Space)">Pan</button>'
      + '<button class="combat-chip" id="combatToolbarPingBtn" title="Ping Tool (P)">Ping</button>'
      + '<button class="combat-chip" id="combatToolbarEffectsBtn" title="Effects Tool (E)">Effects</button>'
      + '<button class="combat-chip" id="combatToolbarDiceBtn" title="Dice Roller">Dice</button>'
      + '<button class="combat-chip" id="combatToolbarTurnOrderBtn" title="Turn Order">Turn</button>'
      + '<button class="combat-chip" id="combatToolbarZoomInBtn" title="Zoom In">Zoom+</button>'
      + '<button class="combat-chip" id="combatToolbarZoomOutBtn" title="Zoom Out">Zoom-</button>'
      + '<button class="combat-chip" id="combatToolbarZoomResetBtn" title="Reset Zoom">100%</button>'
      + '</div>'
      + '<div class="combat-mini" style="margin-top:.15rem;">Zoom</div>'
      + '<input id="combatZoomSlider" type="range" min="50" max="230" step="5" value="100" style="width:100%;">'
      + '<div class="combat-label" style="margin-top:.35rem;">Measurement</div>'
      + '<div class="combat-chip-row">'
      + '<button class="combat-chip" id="combatMeasureShapeLineBtn" title="Line Measure Mode">Line</button>'
      + '<button class="combat-chip" id="combatMeasureShapeConeBtn" title="Cone Measure Mode">Cone</button>'
      + '<button class="combat-chip" id="combatMeasureShapeRadiusBtn" title="Radius Measure Mode">Radius</button>'
      + '</div>'
      + '<div class="combat-chip-row" style="margin-top:.2rem;">'
      + '<button class="combat-chip" id="combatMeasureSnapBtn" title="Snap to grid">Snap: On</button>'
      + '<button class="combat-chip" id="combatMeasureFadeBtn" title="Fade style">Fade: Linger</button>'
      + '</div>'
      + '<div class="combat-mini" style="margin-top:.18rem;">Magnetic Snap Threshold</div>'
      + '<input id="combatSnapThresholdSlider" type="range" min="0" max="100" step="5" value="30" style="width:100%;">'
      + '<div class="combat-label" style="margin-top:.35rem;">Fog of War</div>'
      + '<div class="combat-chip-row"><button class="combat-chip" id="combatFogToggleBtn" title="Toggle Fog of War">Fog Off</button><button class="combat-chip" id="combatFogBrushBtn" title="Brush Reveal">Brush Reveal</button><button class="combat-chip" id="combatFogClearBtn" title="Clear All Fog">Clear Fog</button></div>'
      + '<div class="combat-chip-row" style="margin-top:.2rem;"><button class="combat-chip" id="combatFogModeBtn" title="Fog Mode">Mode: Manual</button><button class="combat-chip" id="combatFogAdvanceBtn" title="Advance Reveal">Advance Reveal</button><button class="combat-chip" id="combatFogResetOrderBtn" title="Reset Reveal Order">Reset Order</button></div>'
      + '<div class="combat-chip-row" style="margin-top:.2rem;"><button class="combat-chip" id="combatFogSharedBtn" title="Shared party vision">Party Vision</button><button class="combat-chip" id="combatFogMemoryBtn" title="Explorer memory">Explorer Memory</button><button class="combat-chip" id="combatFogSoftBtn" title="Soft edge fog">Soft Edges</button></div>'
      + '<div class="combat-mini" id="combatFogMeta">Revealed 0 hexes · Vision 3</div>'
      + '<div class="combat-label" style="margin-top:.35rem;">Terrain / Object</div>'
      + '<select class="combat-select" id="combatPaintValue">'
      + '<option value="forest">forest</option><option value="marsh">marsh</option><option value="crags">crags</option><option value="lava">lava</option><option value="ruins">ruins</option><option value="water">water</option><option value="difficult terrain">difficult terrain</option><option value="obstacle">obstacle</option><option value="trap">trap</option><option value="shrine">shrine</option><option value="turret">turret</option><option value="door">door</option><option value="spawn">spawn</option><option value="wall">wall</option><option value="vision-blocker">vision-blocker</option><option value="wall-seg-e">wall-seg-e</option><option value="wall-seg-ne">wall-seg-ne</option><option value="wall-seg-nw">wall-seg-nw</option><option value="wall-seg-w">wall-seg-w</option><option value="wall-seg-sw">wall-seg-sw</option><option value="wall-seg-se">wall-seg-se</option><option value="draw-ink">draw-ink</option><option value="1">elevation +1</option><option value="2">elevation +2</option><option value="3">elevation +3</option>'
      + '</select>'
      + '<div class="combat-chip-row" style="margin-top:.2rem;align-items:center;">'
      + '<label class="combat-mini" style="display:flex;align-items:center;gap:.24rem;">Color <input id="combatDrawColor" type="color" value="#e3bc5e"></label>'
      + '<label class="combat-mini" style="display:flex;align-items:center;gap:.24rem;">Brush <input id="combatPaintBrushSize" type="range" min="1" max="5" step="1" value="1" style="width:86px;"></label>'
      + '</div>'
      + '<div class="combat-mini">Hex editing modes: terrain, objects, hazards, lighting, weather, interactives, spawn points.</div>'
      + '<div class="combat-label" style="margin-top:.35rem;">Bestiary Drawer</div>'
      + '<div class="combat-feed" id="combatBestiaryDrawer"></div>'
      + '</div>'
      + '</aside>'
      + '<aside class="combat-floating-panel combat-right-rail" id="combatFeedPanel">'
      + '<div class="combat-panel-header" data-drag="feed" onclick="togglePanel(\'combatFeedPanel\')">Roll Checks <span style="float:right;font-size:.7rem;cursor:pointer;">◀</span></div>'
      + '<div class="combat-panel-body">'
      + '<div class="combat-chip-row" style="margin-bottom:.24rem;">'
      + '<button class="combat-chip" id="combatAssetsBtn" title="Toggle Asset Dock">Assets</button>'
      + '<button class="combat-chip" id="combatRailRulesBtn" title="Rules Reference">Rules</button>'
      + '<button class="combat-chip" id="combatSettingsBtn" title="Settings">Settings</button>'
      + '<button class="combat-chip" id="combatContentBladeBtn" title="Toggle Content Blade">Content</button>'
      + '</div>'
      + '<div id="combatInitiativeRibbon" class="combat-initiative-ribbon"></div>'
      + '<div id="combatInitiativeList"></div>'
      + '<div style="display:flex;gap:.24rem;align-items:center;justify-content:space-between;margin-top:.24rem;">'
      + '<button class="btn btn-xs" id="combatDelayTurnBtn">Delay</button>'
      + '<button class="btn btn-xs" id="combatHoldTurnBtn">Hold</button>'
      + '<div id="combatNextActorPreview" class="combat-mini" style="text-align:right;">Next: -</div>'
      + '</div>'
      + '<div style="display:flex;gap:.24rem;margin-top:.26rem;"><button class="btn btn-xs" id="combatNextTurnBtn">Next Turn</button><button class="btn btn-xs" id="combatRollModeBtn">Auto Roll</button></div>'
      + '<div class="combat-action-block">'
      + '<div class="combat-label">Scene Opener</div>'
      + '<div id="combatSceneOpenerSummary" class="combat-mini">No opener active.</div>'
      + '</div>'
      + '<div class="combat-action-block">'
      + '<div class="combat-label">Last Roll</div>'
      + '<div id="combatLegacyResultMirror" class="combat-result-mirror" style="font-size:.82rem;line-height:1.5;">Roll results appear here.</div>'
      + '<div id="combatLastNotification" class="combat-result-mirror" style="margin-top:.2rem;font-size:.78rem;color:var(--teal);"></div>'
      + '</div>'
      + '<div class="combat-action-block">'
      + '<div class="combat-label">Roll Context</div>'
      + '<div id="combatLegacyStatusMirror" class="combat-result-mirror">Status bridge idle.</div>'
      + '<div id="combatLegacyRollModMirror" class="combat-result-mirror">Roll modifiers: none.</div>'
      + '<div id="combatLegacyActionInfoMirror" class="combat-result-mirror">Action details appear here.</div>'
      + '<div id="combatLegacyFlavorMirror" class="combat-result-mirror"></div>'
      + '<div class="combat-feed" id="combatLegacyRowsMirror"></div>'
      + '<div style="display:grid;grid-template-columns:.9fr 1fr 1fr;gap:.24rem;margin-top:.2rem;">'
      + '<select class="combat-select" id="combatLogFilterRound"><option value="all">Round: all</option></select>'
      + '<select class="combat-select" id="combatLogFilterActor"><option value="all">Actor: all</option></select>'
      + '<select class="combat-select" id="combatLogFilterType"><option value="all">Type: all</option></select>'
      + '</div>'
      + '<div class="combat-feed" id="combatFeedLog" style="margin-top:.3rem;"></div>'
      + '</div>'
      + '</aside>'
      + '<aside class="combat-asset-dock" id="combatAssetDock">'
      + '<div class="combat-asset-dock-header">'
      + '<div><div class="combat-label">Asset Dock</div><div class="combat-mini" id="combatAssetDockMeta">Drag from the drawer straight onto the board.</div></div>'
      + '<div style="display:flex;gap:.24rem;align-items:center;">'
      + '<button class="btn btn-xs" id="combatAssetDockUploadBtn">Upload Map</button>'
      + '<button class="btn btn-xs" id="combatAssetDockUploadHexBtn">Upload Hex</button>'
      + '<button class="btn btn-xs" id="combatAssetDockToggleBtn" title="Collapse asset dock">Hide</button>'
      + '</div>'
      + '</div>'
      + '<div class="combat-asset-dock-body">'
      + '<div class="combat-chip-row" id="combatAssetCategoryRow"></div>'
      + '<input class="combat-input" id="combatAssetSearch" placeholder="Search assets, battlemaps, props..." style="margin-top:.24rem;">'
      + '<div class="combat-asset-upload" id="combatAssetUploadStatus"><div class="combat-asset-upload-bar"><span id="combatAssetUploadBar"></span></div><div class="combat-mini" id="combatAssetUploadLabel">No uploads running.</div></div>'
      + '<div class="combat-feed combat-asset-browser-feed" id="combatAssetBrowserFeed"></div>'
      + '</div>'
      + '</aside>'
      + '<aside class="combat-floating-panel combat-bottom-actions" id="combatActionsPanel">'
      + '<div class="combat-panel-header" data-drag="actions" onclick="togglePanel(\'combatActionsPanel\')">Token Actions <span style="float:right;font-size:.7rem;cursor:pointer;">◀</span></div>'
      + '<div class="combat-panel-body">'
      + '<div class="combat-action-block">'
      + '<div class="combat-label">Scene Snapshot</div>'
      + '<div id="combatSceneStatusGrid" class="combat-feed"></div>'
      + '</div>'
      + '<div class="combat-mini" style="margin:.1rem 0 .22rem 0;color:var(--muted2);">Build View keeps the active scene readable. Core token actions stay visible; advanced prep is tucked into collapsible sections.</div>'
      + '<div id="combatSelectedSummary" class="combat-mini">Select a token.</div>'
      + '<div class="combat-action-block" style="margin-top:.2rem;">'
      + '<div class="combat-label">Token Strategy</div>'
      + '<div id="combatTokenSheetMirror" class="combat-result-mirror">Select a token to load Character Sheet context.</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.24rem;margin-top:.2rem;">'
      + '<div><div class="combat-label">Target Enemy</div><select class="combat-select" id="combatTokenTargetSel"><option value="">Closest hostile</option></select></div>'
      + '<div><div class="combat-label">Token Action</div><select class="combat-select" id="combatTokenActionSel"><option value="">Choose action</option></select></div>'
      + '</div>'
      + '<div style="margin-top:.2rem;"><div class="combat-label">Cover Override</div><select class="combat-select" id="combatTargetCoverOverrideSel"><option value="auto">Auto (terrain/object)</option><option value="none">None (+0)</option><option value="light">Light (-1)</option><option value="heavy">Heavy (-2)</option></select></div>'
      + '<div style="display:flex;gap:.24rem;flex-wrap:wrap;margin-top:.2rem;">'
      + '<button class="btn btn-xs" id="combatTokenExecuteActionBtn">Execute</button>'
      + '<button class="btn btn-xs" id="combatGenerateLootBtn">Generate Loot</button>'
      + '<button class="btn btn-xs" id="combatLootBodyBtn">Loot Body</button>'
      + '</div>'
      + '<div id="combatTokenActionHelp" class="combat-mini" style="margin-top:.2rem;">No combat roll yet.</div>'
      + '</div>'
      + '<details open style="margin-top:.22rem;padding:.24rem .28rem;border:1px solid rgba(227,188,94,.18);border-radius:10px;background:rgba(255,255,255,.02);">'
      + '<summary class="combat-label" style="cursor:pointer;list-style:none;">Token Profile</summary>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:.24rem;align-items:end;margin-top:.22rem;">'
      + '<div><div class="combat-label">Token Name</div><input class="combat-input" id="combatSelectedName" type="text" maxlength="64" placeholder="Token name"></div>'
      + '<div><div class="combat-label">Dread</div><input class="combat-input" id="combatSelectedDread" type="number" min="1" max="20"></div>'
      + '<button class="btn btn-xs" id="combatSaveTokenBtn">Save</button>'
      + '<div><div class="combat-label">HP</div><input class="combat-input" id="combatSelectedHp" type="number" min="0"></div>'
      + '<div><div class="combat-label">Elevation</div><input class="combat-input" id="combatSelectedElevation" type="number" min="0" max="9"></div>'
      + '<button class="btn btn-xs" id="combatUploadTokenBtn">Portrait</button>'
      + '<button class="btn btn-xs btn-red" id="combatDeleteTokenBtn">Delete Selected</button>'
      + '</div>'
      + '</details>'
      + '<details style="margin-top:.22rem;padding:.24rem .28rem;border:1px solid rgba(73,201,187,.18);border-radius:10px;background:rgba(255,255,255,.02);">'
      + '<summary class="combat-label" style="cursor:pointer;list-style:none;">Scene Prep</summary>'
      + '<div style="display:grid;grid-template-columns:1.35fr .8fr .85fr;gap:.24rem;align-items:end;margin-top:.22rem;">'
      + '<div><div class="combat-label">Scale</div><input id="combatSelectedScale" type="range" min="25" max="200" step="5" value="100" style="width:100%;"></div>'
      + '<label class="combat-mini" style="display:flex;gap:.24rem;align-items:center;padding:.35rem .45rem;border:1px solid rgba(73,201,187,.22);border-radius:10px;background:rgba(73,201,187,.06);"><input id="combatSelectedFreeform" type="checkbox">Freeform</label>'
      + '<div><div class="combat-label">Vision</div><input class="combat-input" id="combatSelectedVisionRadius" type="number" min="0" max="12"></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr .9fr;gap:.24rem;align-items:end;margin-top:.24rem;">'
      + '<div><div class="combat-label">Vision Shape</div><select class="combat-select" id="combatSelectedVisionShape"><option value="radius">radius</option><option value="cone">cone</option></select></div>'
      + '<div><div class="combat-label">Aura Radius</div><input class="combat-input" id="combatSelectedAuraRadius" type="number" min="0" max="12"></div>'
      + '<div><div class="combat-label">Aura Color</div><input class="combat-input" id="combatSelectedAuraColor" type="color" value="#49c9bb"></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:.24rem;align-items:end;margin-top:.24rem;">'
      + '<div><div class="combat-label">Condition</div><input class="combat-input" id="combatRoundEffectName" type="text" maxlength="30" placeholder="Burning"></div>'
      + '<div><div class="combat-label">Color</div><input class="combat-input" id="combatRoundEffectColor" type="color" value="#e3bc5e"></div>'
      + '<div><div class="combat-label">Stress/Round</div><input class="combat-input" id="combatRoundEffectStress" type="number" min="0" max="20" value="1"></div>'
      + '<div><div class="combat-label">Rounds</div><input class="combat-input" id="combatRoundEffectRounds" type="number" min="1" max="20" value="2"></div>'
      + '<button class="btn btn-xs" id="combatApplyRoundEffectBtn">Apply Condition</button>'
      + '</div>'
      + '</details>'
      + '<div id="combatTokenRoundEffectsList" class="combat-feed" style="margin-top:.24rem;"></div>'
      + '<div class="combat-action-block" style="margin-top:.24rem;">'
      + '<div class="combat-label">AoE Rules</div>'
      + '<div id="combatAoeRulesMeta" class="combat-mini">Enemy AoE pacing by distance band.</div>'
      + '<div id="combatAoeRulesTable" style="margin-top:.22rem;"></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:.24rem;align-items:end;margin-top:.28rem;">'
      + '<div><div class="combat-label">Weather</div><select class="combat-select" id="combatWeatherSelect"><option value="none">none</option><option value="rain">rain</option><option value="storm">storm</option><option value="fog">fog</option><option value="ash">ash</option></select></div>'
      + '<div><div class="combat-label">Intensity</div><input class="combat-input" id="combatWeatherIntensity" type="number" min="0" max="5"></div>'
      + '<button class="btn btn-xs" id="combatApplyWeatherBtn">Apply Weather</button>'
      + '</div>'
      + '<div style="margin-top:.28rem;border:1px solid rgba(73,201,187,.35);padding:.28rem;background:rgba(73,201,187,.08);">'
      + '<div class="combat-label">Cinematic Distance</div>'
      + '<div id="combatRulerSummary" style="font-size:.84rem;color:var(--combat-accent-2);">Engaged</div>'
      + '</div>'
      + '<div style="display:flex;gap:.24rem;flex-wrap:wrap;margin-top:.28rem;">'
      + '<button class="btn btn-xs btn-teal" id="combatActivateCellBtn">Activate Mechanism</button>'
      + '<button class="btn btn-xs" id="combatZoomInBtn">Zoom +</button>'
      + '<button class="btn btn-xs" id="combatZoomOutBtn">Zoom -</button>'
      + '</div>'
      + '</div>'
      + '</aside>';
    applyCombatHoverLabels(root);
    document.body.appendChild(root);
    return root;
  }

  function drawHex(ctx, x, y, size) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var angle = Math.PI / 180 * (60 * i - 30);
      var px = x + size * Math.cos(angle);
      var py = y + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function colorForTerrain(name) {
    var n = String(name || '');
    if (n.indexOf('hexasset:') === 0) return 'rgba(96,158,196,.72)';
    var map = {
      forest: 'rgba(70,120,78,.35)',
      marsh: 'rgba(73,128,114,.35)',
      crags: 'rgba(122,122,132,.38)',
      lava: 'rgba(186,69,43,.46)',
      ruins: 'rgba(126,108,86,.35)',
      water: 'rgba(59,107,166,.38)',
      'difficult terrain': 'rgba(169,134,74,.35)',
      road: 'rgba(200,178,138,.50)',
      cobblestone: 'rgba(155,150,142,.52)'
    };
    return map[n] || 'rgba(200,200,200,.18)';
  }

  function parseQuickEditValue(current, raw) {
    var txt = String(raw || '').trim();
    if (!txt) return null;
    if (/^[+-]\d+$/.test(txt)) return Math.max(0, Number(current || 0) + Number(txt));
    if (/^\d+$/.test(txt)) return Math.max(0, Number(txt));
    return null;
  }

  function applyTokenQuickEdit(tokenId, statKey, rawValue) {
    var state = store.getState();
    var token = (state.tokens || []).find(function (entry) { return entry && String(entry.id) === String(tokenId); }) || null;
    if (!token) return false;
    var current = Number(token[statKey] || 0);
    var nextVal = parseQuickEditValue(current, rawValue);
    if (nextVal === null) {
      safeNotif('Invalid value. Use a number like 12 or delta like -5.', 'warn');
      return false;
    }
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      next.tokens = (inner.tokens || []).map(function (entry) {
        if (!entry || String(entry.id) !== String(tokenId)) return entry;
        var updated = Object.assign({}, entry);
        updated[statKey] = nextVal;
        if (statKey === 'hp') updated.maxHp = Math.max(Number(updated.maxHp || 0), nextVal);
        if (statKey === 'dread' && Number(updated.deathNumber || 0) < nextVal) updated.deathNumber = nextVal;
        return updated;
      });
      persist(next);
      return next;
    });
    addHistory((token.name || 'Token') + ' ' + statKey.toUpperCase() + ' set to ' + nextVal + '.');
    drawBoard();
    updateUiPanels();
    return true;
  }

  function currentPingIdentity() {
    return String(window.S && window.S.name || 'Wayfarer').trim() || 'Wayfarer';
  }

  function colorForPingIdentity(identity) {
    var theme = getCombatThemeTokens(store.getState() && store.getState().ui);
    var palette = [String(theme.ping || '#49c9bb'), String(theme.accent || '#e3bc5e'), String(theme.danger || '#d05353'), '#6aa8ff', '#9bdb5a', '#ff8a5b', '#c690ff'];
    var src = String(identity || 'table');
    var h = 0;
    for (var i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  function hexToRgb(hex) {
    var clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return { r: 73, g: 201, b: 187 };
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function rgbaStringToHex(value) {
    var src = String(value || '').trim();
    if (!src) return '#000000';
    if (src.charAt(0) === '#') {
      if (src.length === 4) return '#' + src.charAt(1) + src.charAt(1) + src.charAt(2) + src.charAt(2) + src.charAt(3) + src.charAt(3);
      return src.slice(0, 7);
    }
    var match = src.match(/rgba?\(([^)]+)\)/i);
    if (!match) return '#000000';
    var parts = match[1].split(',').map(function (part) { return Math.max(0, Math.min(255, Number(String(part).trim()) || 0)); });
    return '#' + parts.slice(0, 3).map(function (part) {
      var hex = Number(part).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function alphaColorFromHex(hex, alpha) {
    var rgb = hexToRgb(hex);
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + Number(alpha || 1) + ')';
  }

  function placeTablePing(q, r, sourceLabel) {
    var identity = String(sourceLabel || currentPingIdentity());
    var color = colorForPingIdentity(identity);
    store.setState(function (state) {
      var next = Object.assign({}, state, {
        ping: {
          q: Number(q || 0),
          r: Number(r || 0),
          at: Date.now(),
          source: identity,
          color: color
        }
      });
      persist(next);
      return next;
    });
    addHistory('Ping placed at ' + toKey(q, r) + ' by ' + identity + '.');
    safeNotif(identity + ' pinged tabletop.', 'info');
    (function animatePing() {
      var st = store.getState();
      var ping = st && st.ping;
      if (!ping) return;
      var age = Date.now() - Number(ping.at || 0);
      if (age > 1200) {
        store.setState(function (state) {
          var next = Object.assign({}, state, { ping: null });
          persist(next);
          return next;
        });
        drawBoard();
        return;
      }
      drawBoard();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(animatePing);
    })();
  }

  function hideTokenContextMenu() {
    var menu = document.getElementById('combatTokenContextMenu');
    if (!menu) return;
    if (tokenContextMenuHideTimer) {
      clearTimeout(tokenContextMenuHideTimer);
      tokenContextMenuHideTimer = null;
    }
    menu.classList.remove('open');
    var duration = getCombatMotionDuration(store.getState(), 120, 60);
    var cleanup = function () {
      menu.style.display = 'none';
      menu.innerHTML = '';
      menu.removeAttribute('data-token-id');
      menu.removeAttribute('data-opened-at');
      tokenContextMenuHideTimer = null;
    };
    if (!duration) {
      cleanup();
      return;
    }
    tokenContextMenuHideTimer = setTimeout(cleanup, duration);
  }

  function applyInitiativeTurnState(actionKey, tokenId) {
    var movedTokenId = String(tokenId || '');
    if (!movedTokenId) return false;
    var changed = false;
    store.setState(function (state) {
      var list = Array.isArray(state.initiative) ? state.initiative.slice() : [];
      if (!list.length) return state;
      var idx = list.findIndex(function (row) {
        return String(row && row.tokenId || '') === movedTokenId;
      });
      if (idx < 0) return state;

      var activeIdx = Math.max(0, Math.min(list.length - 1, Number(state.initiativeIndex || 0)));
      var activeRow = list[activeIdx] || null;
      var activeTokenId = String(activeRow && activeRow.tokenId || '');

      var row = list.splice(idx, 1)[0];
      var insertAt = idx;
      if (actionKey === 'delay-turn') {
        insertAt = Math.min(list.length, idx + 1);
        list.splice(insertAt, 0, row);
      } else {
        list.push(row);
        insertAt = list.length - 1;
      }

      var nextIdx = 0;
      if (activeTokenId === movedTokenId) {
        nextIdx = actionKey === 'delay-turn'
          ? Math.max(0, Math.min(list.length - 1, insertAt))
          : Math.max(0, Math.min(list.length - 1, idx));
      } else {
        var activeAfter = list.findIndex(function (entry) {
          return String(entry && entry.tokenId || '') === activeTokenId;
        });
        nextIdx = activeAfter >= 0 ? activeAfter : Math.max(0, Math.min(list.length - 1, activeIdx));
      }

      var next = Object.assign({}, state, { initiative: list, initiativeIndex: nextIdx, currentTurnIndex: nextIdx });
      next.turnStates = Object.assign({}, state.turnStates || {});
      next.turnStates[movedTokenId] = Object.assign({}, next.turnStates[movedTokenId] || {}, {
        held: actionKey === 'hold-turn',
        delayed: actionKey === 'delay-turn',
        holdUntilRound: actionKey === 'hold-turn' ? Math.max(1, Number(state.round || 1)) : 0
      });
      persist(next);
      changed = true;
      return next;
    });
    if (changed) {
      var movedToken = byId(movedTokenId);
      addCombatLogEntry({
        eventType: 'turn',
        action: actionKey === 'hold-turn' ? 'Hold Turn' : 'Delay Turn',
        actorId: movedTokenId,
        actorName: String(movedToken && movedToken.name || 'Token'),
        result: actionKey === 'hold-turn' ? 'Turn held to later in the round.' : 'Turn delayed to next slot.',
        tags: ['turn', actionKey === 'hold-turn' ? 'hold' : 'delay'],
        message: String(movedToken && movedToken.name || 'Token') + (actionKey === 'hold-turn' ? ' is holding their turn.' : ' delayed to the next initiative slot.')
      });
    }
    return changed;
  }

  function runTokenContextAction(actionKey, tokenId, q, r) {
    var token = byId(tokenId);
    if (!token) return;
    if (actionKey === 'ping') {
      placeTablePing(token.q, token.r, currentPingIdentity());
    } else if (actionKey === 'generate-loot') {
      generatePersonalLootForToken(token.id, { force: false });
    } else if (actionKey === 'reroll-loot') {
      generatePersonalLootForToken(token.id, { force: true });
    } else if (actionKey === 'focus-ping') {
      normalizeSelection(token.id, [token.id]);
      placeTablePing(token.q, token.r, 'Focus ' + currentPingIdentity());
      if (typeof openTokenSheetQuickView === 'function') openTokenSheetQuickView(token.id);
    } else if (actionKey === 'place-party') {
      placePartyNear(Number(q || token.q || 0), Number(r || token.r || 0));
    } else if (actionKey === 'copy') {
      copyTokensToClipboard(token.id);
    } else if (actionKey === 'paste') {
      pasteTokensFromClipboard(Number(q || token.q || 0), Number(r || token.r || 0));
    } else if (actionKey === 'undo') {
      undoLastEdit();
    } else if (actionKey === 'redo') {
      redoLastEdit();
    } else if (actionKey === 'sheet') {
      openTokenSheetQuickView(token.id);
    } else if (actionKey === 'hold-turn' || actionKey === 'delay-turn') {
      if (!applyInitiativeTurnState(actionKey, token.id)) {
        safeNotif('No initiative entry found for ' + String(token.name || 'token') + '.', 'warn');
      }
      updateUiPanels();
      drawBoard();
    } else if (actionKey === 'add-turn') {
      addTurnForToken(token.id);
    } else if (actionKey === 'vision') {
      var raw = window.prompt('Token vision radius (1-12):', String(Math.max(1, Number(store.getState().fog && store.getState().fog.visionRadius || 3))));
      if (raw !== null) {
        var vr = Math.max(1, Math.min(12, Number(raw || 3)));
        captureUndoSnapshot('Token Vision');
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.fog = Object.assign({}, state.fog || {}, { enabled: true, visionRadius: vr });
          next.selectedTokenId = String(token.id);
          next.selectedTokenIds = [String(token.id)];
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      }
    } else if (actionKey === 'reactions') {
      addHistory(String(token.name || 'Token') + ' is set to reaction-ready.');
      safeNotif('Reaction ready marker added to history.', 'good');
      updateUiPanels();
    } else if (actionKey === 'change-layer') {
      normalizeSelection(token.id, [token.id]);
      cycleSelectedTokenLayer();
    } else if (actionKey === 'front') {
      normalizeSelection(token.id, [token.id]);
      reorderSelectedTokens('front');
    } else if (actionKey === 'back') {
      normalizeSelection(token.id, [token.id]);
      reorderSelectedTokens('back');
    } else if (actionKey === 'lock') {
      normalizeSelection(token.id, [token.id]);
      toggleSelectedLock();
    } else if (actionKey === 'enumerate') {
      enumerateSelectedTokens(token.name);
    } else if (actionKey === 'rotate') {
      transformSelectedTokens('rotate', 45);
    } else if (actionKey === 'half') {
      transformSelectedTokens('scale', 0.5);
    } else if (actionKey === 'quarter') {
      transformSelectedTokens('scale', 0.25);
    }
  }

  function showTokenContextMenu(token, screenX, screenY, q, r) {
    var menu = document.getElementById('combatTokenContextMenu');
    if (!menu || !token) return;
    if (tokenContextMenuHideTimer) {
      clearTimeout(tokenContextMenuHideTimer);
      tokenContextMenuHideTimer = null;
    }
    var isWayfarer = !!(token.isPlayer || String(token.faction || '') === 'player' || /wayfarer/i.test(String(token.name || '')));
    var actions = [
      { key: 'ping', label: 'Ping' },
      { key: 'focus-ping', label: 'Focus Ping' },
      { key: 'place-party', label: 'Place Party' },
      { key: 'copy', label: 'Copy' },
      { key: 'paste', label: 'Paste' },
      { key: 'undo', label: 'Undo' },
      { key: 'redo', label: 'Redo' },
      { key: 'sheet', label: 'Character Sheet' },
      { key: 'hold-turn', label: 'Hold Turn' },
      { key: 'delay-turn', label: 'Delay Turn' },
      { key: 'add-turn', label: 'Add Turn' },
      { key: 'vision', label: 'Token Vision/Light' },
      { key: 'reactions', label: 'Reactions' },
      { key: 'change-layer', label: 'Change Layer' },
      { key: 'front', label: 'Bring to Front' },
      { key: 'back', label: 'Bring to Back' },
      { key: 'lock', label: token.locked ? 'Unlock Placement' : 'Lock Placement' },
      { key: 'enumerate', label: 'Enumerate Selected' },
      { key: 'rotate', label: 'Rotate +45°' },
      { key: 'half', label: 'Scale Half Hex' },
      { key: 'quarter', label: 'Scale Quarter Hex' }
    ];
    if (!isWayfarer) {
      actions = actions.filter(function (entry) { return entry.key !== 'open-inventory'; });
      actions.splice(7, 0,
        { key: 'generate-loot', label: 'Generate Loot' },
        { key: 'reroll-loot', label: 'Reroll Loot' }
      );
    }
    menu.innerHTML = actions.map(function (entry) {
      return '<button class="combat-token-menu-item" data-menu-action="' + entry.key + '">' + entry.label + '</button>';
    }).join('');
    menu.setAttribute('data-token-id', String(token.id));
    menu.setAttribute('data-opened-at', String(Date.now()));
    menu.style.display = 'grid';
    menu.style.left = Math.max(6, Number(screenX || 0)) + 'px';
    menu.style.top = Math.max(6, Number(screenY || 0)) + 'px';
    menu.classList.remove('open');
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { menu.classList.add('open'); });
    else menu.classList.add('open');
    Array.prototype.slice.call(menu.querySelectorAll('[data-menu-action]')).forEach(function (btn) {
      btn.onclick = function (ev) {
        ev.preventDefault();
        var action = String(btn.getAttribute('data-menu-action') || '');
        hideTokenContextMenu();
        runTokenContextAction(action, token.id, q, r);
      };
    });
  }

  function runMapItemContextAction(actionKey, mapItem, q, r) {
    if (!mapItem) return;
    if (actionKey === 'copy') {
      store.setState({ selectedMapItem: { layer: mapItem.layer, key: mapItem.key }, selectedTokenId: '', selectedTokenIds: [] });
      copySelectedMapItemToClipboard();
    } else if (actionKey === 'paste') {
      pasteMapItemFromClipboard(Number(q || mapItem.q || 0), Number(r || mapItem.r || 0));
    } else if (actionKey === 'lock') {
      store.setState({ selectedMapItem: { layer: mapItem.layer, key: mapItem.key }, selectedTokenId: '', selectedTokenIds: [] });
      toggleSelectedMapItemLock();
    } else if (actionKey === 'delete') {
      deleteMapItemAt(mapItem.layer, mapItem.key);
    } else if (actionKey === 'configure-hazard') {
      configureHazardCheckAt(mapItem.q, mapItem.r);
    } else if (actionKey === 'run-hazard') {
      var selectedToken = byId(store.getState().selectedTokenId);
      if (!selectedToken) safeNotif('Select a token to run hazard checks.', 'warn');
      else runHazardCheckDialogForToken(selectedToken, mapItem.q, mapItem.r, getLayerGameplayProfile(store.getState(), mapItem.q, mapItem.r));
    } else if (actionKey === 'manage-cache') {
      openLootCacheModal(mapItem.q, mapItem.r);
    } else if (actionKey === 'loot-cache') {
      var cacheQ = Number(q !== undefined ? q : mapItem.q || 0);
      var cacheR = Number(r !== undefined ? r : mapItem.r || 0);
      var stForCache = store.getState();
      var cacheRules = ensureCombatSceneRulesExtensions(stForCache.sceneRules || {});
      var cacheKey = toKey(cacheQ, cacheR);
      var cacheData = cacheRules.mapLootCaches && cacheRules.mapLootCaches[cacheKey] || null;
      var cacheItems = cacheData && Array.isArray(cacheData.items) ? cacheData.items : [];
      if (!cacheItems.length) { safeNotif('Cache at ' + cacheKey + ' is empty or not yet stocked.', 'warn'); return; }
      var playerAtCache = (stForCache.tokens || []).find(function (t) { return t && t.isPlayer; }) || null;
      if (playerAtCache) {
        var distToCache = hexDistance(
          { q: Number(playerAtCache.q || 0), r: Number(playerAtCache.r || 0) },
          { q: cacheQ, r: cacheR }
        );
        if (distToCache > 1) {
          safeNotif('Move within 1 hex of the cache to loot it (currently ' + distToCache + ' hex' + (distToCache === 1 ? '' : 'es') + ' away).', 'warn');
          return;
        }
      }
      openPlayerLootCacheAt(cacheQ, cacheR);
    }
  }

  function showMapItemContextMenu(mapItem, screenX, screenY) {
    var menu = document.getElementById('combatTokenContextMenu');
    if (!menu || !mapItem) return;
    if (tokenContextMenuHideTimer) {
      clearTimeout(tokenContextMenuHideTimer);
      tokenContextMenuHideTimer = null;
    }
    var actions = [
      { key: 'copy', label: 'Copy' },
      { key: 'paste', label: 'Paste Here' },
      { key: 'lock', label: mapItem.locked ? 'Unlock Placement' : 'Lock Placement' },
      { key: 'delete', label: 'Delete' }
    ];
    if (mapItem.layer === 'hazards') {
      actions.unshift({ key: 'run-hazard', label: 'Run Hazard Check' });
      actions.unshift({ key: 'configure-hazard', label: 'Configure Hazard' });
    }
    if (mapItem.layer === 'objects' && mapItem.value === 'loot-cache') {
      actions.unshift({ key: 'manage-cache', label: '⚙ Manage Cache (GM)' });
      actions.unshift({ key: 'loot-cache', label: '📦 Loot Cache' });
    }
    menu.innerHTML = actions.map(function (entry) {
      return '<button class="combat-token-menu-item" data-menu-action="' + entry.key + '">' + entry.label + '</button>';
    }).join('');
    menu.setAttribute('data-map-layer', String(mapItem.layer || ''));
    menu.setAttribute('data-map-key', String(mapItem.key || ''));
    menu.setAttribute('data-opened-at', String(Date.now()));
    menu.style.display = 'grid';
    menu.style.left = Math.max(6, Number(screenX || 0)) + 'px';
    menu.style.top = Math.max(6, Number(screenY || 0)) + 'px';
    menu.classList.remove('open');
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { menu.classList.add('open'); });
    else menu.classList.add('open');
    Array.prototype.slice.call(menu.querySelectorAll('[data-menu-action]')).forEach(function (btn) {
      btn.onclick = function (ev) {
        ev.preventDefault();
        var action = String(btn.getAttribute('data-menu-action') || '');
        hideTokenContextMenu();
        runMapItemContextAction(action, mapItem, mapItem.q, mapItem.r);
      };
    });
  }

  function showInlineBubbleEditor(hit, token, canvas) {
    var input = document.getElementById('combatBubbleInlineInput');
    if (!input || !hit || !token) return;
    input.dataset.tokenId = String(hit.tokenId);
    input.dataset.statKey = String(hit.statKey);
    input.dataset.current = String(token[hit.statKey] || 0);
    input.style.display = 'block';
    input.style.left = Math.round(hit.cx - (hit.w / 2)) + 'px';
    input.style.top = Math.round(hit.cy - 10) + 'px';
    input.value = String(token[hit.statKey] || 0);
    input.select();
    input.focus();
  }

  function hideInlineBubbleEditor(commit) {
    var input = document.getElementById('combatBubbleInlineInput');
    if (!input || input.style.display === 'none') return;
    if (commit) {
      var tokenId = String(input.dataset.tokenId || '');
      var statKey = String(input.dataset.statKey || '');
      var raw = String(input.value || '');
      if (tokenId && statKey) applyTokenQuickEdit(tokenId, statKey, raw);
    }
    input.style.display = 'none';
    input.value = '';
    input.dataset.tokenId = '';
    input.dataset.statKey = '';
    input.dataset.current = '';
  }

  function formatLootItemLabel(item) {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return String(item || 'Unknown Item');
    if (item.name) return String(item.name);
    if (item.id) return String(item.id);
    return String(item.label || 'Unknown Item');
  }

  function closeLootPopup() {
    var card = document.getElementById('combatLootPopupCard');
    if (!card) return;
    card.style.display = 'none';
    card.dataset.tokenId = '';
    card.dataset.cacheKey = '';
    card.dataset.cacheQ = '';
    card.dataset.cacheR = '';
  }

  function renderLootPopupForToken(tokenId) {
    var card = document.getElementById('combatLootPopupCard');
    var title = document.getElementById('combatLootPopupTitle');
    var meta = document.getElementById('combatLootPopupMeta');
    var listEl = document.getElementById('combatLootPopupList');
    var takeAllBtn = document.getElementById('combatLootTakeAllBtn');
    var takeSelectedBtn = document.getElementById('combatLootTakeSelectedBtn');
    if (!card || !title || !meta || !listEl || !takeAllBtn || !takeSelectedBtn) return false;
    var state = store.getState();
    var token = byId(tokenId);
    var drop = getLootDropForToken(state, tokenId);
    var items = drop && Array.isArray(drop.items) ? drop.items : [];
    if (token && isTokenDead(token) && (!drop || !items.length)) {
      ensureLootDropForToken(token, 'loot popup');
      state = store.getState();
      drop = getLootDropForToken(state, tokenId);
      items = drop && Array.isArray(drop.items) ? drop.items : [];
    }
    if (!token || !drop || drop.claimed || !items.length) {
      closeLootPopup();
      return false;
    }
    title.textContent = String(token.name || 'Body') + ' Loot';
    // Backpack capacity info
    var bpCap = (typeof window.getBackpackCapacity === 'function') ? window.getBackpackCapacity() : 6;
    var bpUsed = 0;
    if (window.S && Array.isArray(window.S.backpack)) {
      window.S.backpack.forEach(function (slotText) {
        if (!slotText || !slotText.trim()) return;
        bpUsed += getItemSlotCost(String(slotText || '').replace(/\s*x\d+$/i, '').trim());
      });
    }
    var bpFull = bpUsed >= bpCap;
    var bpColor = bpFull ? '#e05050' : bpUsed >= bpCap - 1 ? '#e3bc5e' : '#57d69b';
    meta.innerHTML = 'Hex ' + toKey(token.q, token.r) + ' &middot; ' + items.length + ' item' + (items.length === 1 ? '' : 's')
      + ' &nbsp;<span style="font-size:.7rem;color:' + bpColor + ';">Backpack: ' + bpUsed + '/' + bpCap + ' slots</span>';
    listEl.innerHTML = items.map(function (item, idx) {
      var label = formatLootItemLabel(item).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var itemName = String(item || '').replace(/\s*x\d+$/i, '').trim();
      var slotCost = getItemSlotCost(itemName);
      var wouldOverflow = (bpUsed + slotCost) > bpCap;
      var slotBadge = '<span style="font-size:.63rem;color:' + (wouldOverflow ? '#e05050' : 'var(--muted2)') + ';background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:3px;padding:.03rem .18rem;flex-shrink:0;">'
        + slotCost + (slotCost === 1 ? ' slot' : ' slots') + '</span>';
      return '<label style="display:flex;align-items:center;gap:.3rem;padding:.12rem .14rem;border:1px solid rgba(255,255,255,.08);border-radius:6px;">'
        + '<input type="checkbox" data-loot-idx="' + idx + '"' + (wouldOverflow ? ' title="May overflow backpack capacity"' : '') + '>'
        + '<span style="flex:1;font:.8rem Rajdhani,sans-serif;color:' + (wouldOverflow ? '#e09070' : '#f7f7f7') + ';">' + label + '</span>'
        + slotBadge
        + '</label>';
    }).join('');
    takeAllBtn.disabled = !items.length;
    takeSelectedBtn.disabled = !items.length;
    card.dataset.tokenId = String(tokenId || '');
    return true;
  }

  function openLootPopupForToken(tokenId, anchorX, anchorY) {
    var card = document.getElementById('combatLootPopupCard');
    var wrap = document.getElementById('combatCanvasWrap');
    if (!card || !wrap) return;
    var state = store.getState();
    var token = byId(tokenId);
    var drop = token ? getLootDropForToken(state, tokenId) : null;
    if (token && isTokenDead(token) && (!drop || !Array.isArray(drop.items) || !drop.items.length)) {
      ensureLootDropForToken(token, 'loot popup');
    }
    if (!renderLootPopupForToken(tokenId)) return;
    card.style.display = 'block';
    card.style.position = 'fixed'; // Ensure overlay is fixed to viewport
    // Calculate viewport-relative position
    var rect = wrap.getBoundingClientRect();
    var fallbackX = Math.round(rect.left + rect.width / 2);
    var fallbackY = Math.round(rect.top + rect.height / 2);
    var x = typeof anchorX === 'number' ? anchorX + rect.left : fallbackX;
    var y = typeof anchorY === 'number' ? anchorY + rect.top : fallbackY;
    var cw = Math.max(220, Number(card.offsetWidth || 260));
    var ch = Math.max(120, Number(card.offsetHeight || 220));
    var left = Math.min(Math.max(8, x + 14), window.innerWidth - cw - 8);
    var top = Math.min(Math.max(8, y + 14), window.innerHeight - ch - 8);
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.setAttribute('tabindex', '-1');
    try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); }
    // Prevent scroll jumps on open
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  }

  function takeLootFromTokenDrop(tokenId, selectedIndexes, sourceLabel) {
    var state = store.getState();
    var token = byId(tokenId);
    var drop = token ? getLootDropForToken(state, tokenId) : null;
    if (token && isTokenDead(token) && (!drop || !Array.isArray(drop.items) || !drop.items.length)) {
      ensureLootDropForToken(token, 'loot popup');
      state = store.getState();
      drop = getLootDropForToken(state, tokenId);
    }
    if (!token || !drop || drop.claimed) {
      safeNotif('No loot available on this body.', 'warn');
      closeLootPopup();
      return 0;
    }
    var items = Array.isArray(drop.items) ? drop.items.slice() : [];
    if (!items.length) {
      safeNotif('No loot available on this body.', 'warn');
      closeLootPopup();
      return 0;
    }
    var rawIndexes = Array.isArray(selectedIndexes) ? selectedIndexes.slice() : items.map(function (_row, idx) { return idx; });
    var unique = {};
    var indexes = rawIndexes.map(function (idx) { return Number(idx); }).filter(function (idx) {
      return Number.isFinite(idx) && idx >= 0 && idx < items.length && !unique[idx] && (unique[idx] = true);
    }).sort(function (a, b) { return a - b; });
    if (!indexes.length) {
      safeNotif('Pick at least one loot item.', 'warn');
      return 0;
    }
    var selectedItems = indexes.map(function (idx) { return items[idx]; });
    var movedToInventory = 0;
    var movedToBackpack = 0;
    var awardedCredits = 0;
    selectedItems.forEach(function (item) {
      var label = String(item || '').trim();
      var creditMatch = label.match(/^credits\s*x?\s*(\d+)$/i);
      if (creditMatch) {
        awardedCredits += Math.max(0, Number(creditMatch[1] || 0));
        return;
      }
      if (typeof window.addToBackpack === 'function') {
        try {
          if (window.addToBackpack(label)) {
            movedToBackpack += 1;
            return;
          }
        } catch (_bpErr) {}
      }
      if (typeof window.addToInventory === 'function') {
        try {
          if (window.addToInventory({ name: label, type: 'One-Time', effect: 'Looted from defeated token' })) movedToInventory += 1;
        } catch (_invErr) {}
      }
    });
    if (awardedCredits > 0) {
      if (window.S) window.S.credits = Math.max(0, Number(window.S.credits || 0) + awardedCredits);
      if (typeof window.updateCreditsUI === 'function') {
        try { window.updateCreditsUI(); } catch (_creditErr) {}
      }
      if (typeof window.updateAllStatDisplays === 'function') {
        try { window.updateAllStatDisplays(); } catch (_statsErr) {}
      }
    }
    var kept = items.filter(function (_item, idx) { return indexes.indexOf(idx) < 0; });
    store.setState(function (inner) {
      var next = Object.assign({}, inner);
      var rules = ensureLootDrops(inner);
      var key = String(tokenId);
      var row = rules.lootDrops[key] || null;
      if (row) {
        row.items = kept;
        row.claimed = !kept.length;
        rules.lootDrops[key] = row;
      }
      next.sceneRules = rules;
      persist(next);
      return next;
    });
    var pulledLabels = selectedItems.map(formatLootItemLabel);
    addHistory((sourceLabel || 'Loot') + ': ' + String(token.name || 'body') + ' -> ' + pulledLabels.join(', ') + '.');
    var summaryBits = [];
    if (awardedCredits > 0) summaryBits.push('+' + awardedCredits + ' Credits');
    if (movedToInventory > 0) summaryBits.push(movedToInventory + ' to Inventory');
    if (movedToBackpack > 0) summaryBits.push(movedToBackpack + ' to Backpack');
    safeNotif('Collected loot: ' + (summaryBits.length ? summaryBits.join(' · ') : (selectedItems.length + ' item' + (selectedItems.length === 1 ? '' : 's'))), 'good');
    drawBoard();
    updateUiPanels();
    if (kept.length) renderLootPopupForToken(tokenId);
    else closeLootPopup();
    return selectedItems.length;
  }

  var backgroundCache = { src: '', img: null };
  var bubbleHotspots = [];
  var floatingNumbers = [];

  function createFloatingNumber(x, y, text, type) {
    var id = uid('float');
    var num = {
      id: id,
      x: x,
      y: y,
      text: String(text || ''),
      type: String(type || 'damage'),
      createdAt: Date.now(),
      lifetime: 1200
    };
    floatingNumbers.push(num);
    return id;
  }

  function updateFloatingNumbers() {
    var now = Date.now();
    floatingNumbers = floatingNumbers.filter(function (num) {
      return (now - num.createdAt) < num.lifetime;
    });
  }

  function getConditionTypeForLabel(label) {
    var lower = String(label || '').toLowerCase();
    if (lower.indexOf('burn') >= 0) return 'burn';
    if (lower.indexOf('chill') >= 0 || lower.indexOf('freeze') >= 0 || lower.indexOf('cold') >= 0) return 'chill';
    if (lower.indexOf('stun') >= 0) return 'stun';
    if (lower.indexOf('poison') >= 0) return 'poison';
    if (lower.indexOf('fear') >= 0 || lower.indexOf('terrif') >= 0) return 'fear';
    if (lower.indexOf('bleed') >= 0) return 'bleed';
    return 'burn';
  }

  function drawBackground(ctx, board) {
    var src = String(board && board.background || '');
    if (!src) return;
    if (backgroundCache.src !== src || !backgroundCache.img) {
      backgroundCache.src = src;
      backgroundCache.img = new Image();
      backgroundCache.img.onload = function () { drawBoard(); };
      backgroundCache.img.onerror = function () { drawBoard(); };
      backgroundCache.img.src = src;
    }
    var img = backgroundCache.img;
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;

    var zoom = Number(board.zoom || 1);
    var drawW = img.naturalWidth * zoom;
    var drawH = img.naturalHeight * zoom;
    var originX = Number(board.panX || 0) - drawW / 2;
    var originY = Number(board.panY || 0) - drawH / 2;

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.drawImage(img, originX, originY, drawW, drawH);
    ctx.restore();
  }

  function getAnimatedTokenPoint(token, targetPoint, state) {
    var id = String(token && token.id || '');
    if (!id || !targetPoint) return targetPoint;
    var duration = getCombatMotionDuration(state, 180, 90);
    if (!duration || String(state.draggingTokenId || '') === id) {
      tokenMotionCache[id] = { startX: targetPoint.x, startY: targetPoint.y, targetX: targetPoint.x, targetY: targetPoint.y, at: Date.now(), x: targetPoint.x, y: targetPoint.y };
      return targetPoint;
    }
    var now = Date.now();
    var cache = tokenMotionCache[id];
    if (!cache) {
      tokenMotionCache[id] = { startX: targetPoint.x, startY: targetPoint.y, targetX: targetPoint.x, targetY: targetPoint.y, at: now, x: targetPoint.x, y: targetPoint.y };
      return targetPoint;
    }
    if (Math.abs(Number(cache.targetX || targetPoint.x) - targetPoint.x) > 0.5 || Math.abs(Number(cache.targetY || targetPoint.y) - targetPoint.y) > 0.5) {
      cache = tokenMotionCache[id] = {
        startX: Number(cache.x || cache.targetX || targetPoint.x),
        startY: Number(cache.y || cache.targetY || targetPoint.y),
        targetX: targetPoint.x,
        targetY: targetPoint.y,
        at: now,
        x: Number(cache.x || cache.targetX || targetPoint.x),
        y: Number(cache.y || cache.targetY || targetPoint.y)
      };
    }
    var progress = Math.min(1, Math.max(0, (now - Number(cache.at || now)) / duration));
    var eased = 1 - Math.pow(1 - progress, 3);
    var x = Number(cache.startX || targetPoint.x) + (targetPoint.x - Number(cache.startX || targetPoint.x)) * eased;
    var y = Number(cache.startY || targetPoint.y) + (targetPoint.y - Number(cache.startY || targetPoint.y)) * eased;
    cache.x = x;
    cache.y = y;
    if (progress < 1 && typeof requestAnimationFrame === 'function') requestAnimationFrame(drawBoard);
    return { x: x, y: y };
  }

  function renderBoardNow() {
    var canvas = document.getElementById('combatSceneCanvas');
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.floor(rect.width * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    var state = ensureInitiative(store.getState());
    var board = normalizeBoard(state.board);

    ctx.clearRect(0, 0, rect.width, rect.height);

    drawBackground(ctx, board);
    drawGridAndTokens(ctx, state, rect.width, rect.height);
  }

  function drawBoard(forceImmediate) {
    if (forceImmediate) {
      renderBoardNow();
      return;
    }
    if (drawFramePending) return;
    drawFramePending = true;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        drawFramePending = false;
        renderBoardNow();
      });
      return;
    }
    drawFramePending = false;
    renderBoardNow();
  }

  function drawGridAndTokens(ctx, state, w, h) {
    var board = state.board;
    var size = Number(board.size || 42) * Number(board.zoom || 1);
    var theme = getCombatThemeTokens(state && state.ui);
    var accentGlow = alphaColorFromHex(String(theme.accent2 || '#49c9bb'), 0.95);
    var accentFill = alphaColorFromHex(String(theme.accent2 || '#49c9bb'), 0.2);
    var accentSoft = alphaColorFromHex(String(theme.accent2 || '#49c9bb'), 0.14);
    var dangerStrong = alphaColorFromHex(String(theme.danger || '#d05353'), 0.82);
    var dangerFill = alphaColorFromHex(String(theme.danger || '#d05353'), 0.18);
    var dangerStroke = alphaColorFromHex(String(theme.danger || '#d05353'), 0.55);
    var fogMask = alphaColorFromHex(String(theme.fog || '#020307'), 0.74);
    var fogVision = getFogVisionMap(state);
    var rules = ensureCombatSceneRulesExtensions(state && state.sceneRules || {});
    var zoneLookup = {};
    (Array.isArray(rules.aoeZones) ? rules.aoeZones : []).forEach(function (zone) {
      if (!zone || Number(zone.roundsLeft || 0) <= 0) return;
      var fill = String(zone.color || 'rgba(255,159,92,0.24)');
      var border = String(zone.border || 'rgba(255,190,122,0.86)');
      (Array.isArray(zone.hexKeys) ? zone.hexKeys : []).forEach(function (key) {
        if (!key) return;
        if (!zoneLookup[key]) {
          zoneLookup[key] = { fill: fill, border: border, rounds: Number(zone.roundsLeft || 0) };
        }
      });
    });
    var activeSpellPreview = normalizeCombatSpellPreview(state.spellPreview);
    var previewLookup = {};
    if (activeSpellPreview.active) {
      activeSpellPreview.hexKeys.forEach(function (key) {
        if (key) previewLookup[key] = true;
      });
    }
    bubbleHotspots = [];
    for (var r = -board.rows; r <= board.rows; r++) {
      for (var q = -board.cols; q <= board.cols; q++) {
        var p = axialToPixel(q, r, size, board.panX, board.panY);
        if (p.x < -80 || p.y < -80 || p.x > w + 80 || p.y > h + 80) continue;

        var key = toKey(q, r);
        var terrain = state.layers.terrain[key] || '';
        var object = state.layers.objects[key] || '';
        var hazard = state.layers.hazards[key] || '';
        var lighting = String(state.layers.lighting[key] || '');
        var elevation = Number(state.layers.elevation[key] || 0);
        var currentVisible = !!(fogVision.current && fogVision.current[key]);
        var seenVisible = !!(fogVision.seen && fogVision.seen[key]);

        drawHex(ctx, p.x, p.y, size - 1.6);
        if (isLayerVisible(state, 'terrain')) {
          ctx.save();
          ctx.globalAlpha = getLayerOpacity(state, 'terrain');
          ctx.fillStyle = colorForTerrain(terrain);
          ctx.fill();
          if (terrain.indexOf('hexasset:') === 0) {
            var hexAssetId = terrain.split(':')[1] || '';
            var hexAssetEntry = getUploadedHexAssetById(state, hexAssetId);
            if (hexAssetEntry) {
              var hexSprite = getHexAssetSprite(hexAssetEntry);
              if (hexSprite && hexSprite.loaded && hexSprite.image && !hexSprite.errored) {
                ctx.save();
                drawHex(ctx, p.x, p.y, size - 1.6);
                ctx.clip();
                ctx.globalAlpha = getLayerOpacity(state, 'terrain');
                ctx.drawImage(hexSprite.image, p.x - size, p.y - size, size * 2, size * 2);
                ctx.restore();
              } else if (hexSprite && !hexSprite.errored) {
                // Loading placeholder: striped pattern so user knows something is there
                ctx.save();
                drawHex(ctx, p.x, p.y, size - 1.6);
                ctx.clip();
                ctx.globalAlpha = 0.55 * getLayerOpacity(state, 'terrain');
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 1.2;
                ctx.font = 'bold 9px Rajdhani, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.fillText('loading…', p.x, p.y + 3);
                ctx.restore();
              } else if (hexSprite && hexSprite.errored) {
                // Error placeholder
                ctx.save();
                drawHex(ctx, p.x, p.y, size - 1.6);
                ctx.clip();
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = 'rgba(200,60,60,0.55)';
                ctx.fill();
                ctx.fillStyle = 'rgba(255,200,200,0.95)';
                ctx.font = 'bold 9px Rajdhani, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('img err', p.x, p.y + 3);
                ctx.restore();
              }
            }
          }
          ctx.restore();
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.1)';
        ctx.stroke();

        if (state.selectedMapItem && String(state.selectedMapItem.key || '') === key) {
          var selectedLayer = String(state.selectedMapItem.layer || '');
          var highlightColor = selectedLayer === 'hazards' ? accentGlow : (selectedLayer === 'objects' ? dangerStrong : accentGlow);
          ctx.save();
          drawHex(ctx, p.x, p.y, size - 3.4);
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = highlightColor;
          ctx.stroke();
          ctx.restore();
        }

        if (zoneLookup[key]) {
          ctx.save();
          drawHex(ctx, p.x, p.y, size - 4.2);
          ctx.fillStyle = String(zoneLookup[key].fill || 'rgba(255,159,92,0.24)');
          ctx.fill();
          ctx.strokeStyle = String(zoneLookup[key].border || 'rgba(255,190,122,0.86)');
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }

        if (previewLookup[key]) {
          var pulse = (Math.sin(Date.now() / 210) + 1) / 2;
          ctx.save();
          drawHex(ctx, p.x, p.y, size - 4.8);
          ctx.fillStyle = String(activeSpellPreview.color || 'rgba(108,189,255,0.26)');
          ctx.globalAlpha = 0.58 + pulse * 0.18;
          ctx.fill();
          ctx.strokeStyle = String(activeSpellPreview.border || 'rgba(164,223,255,0.95)');
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 1.3 + pulse * 0.7;
          ctx.stroke();
          ctx.restore();
        }

        if (object && isLayerVisible(state, 'objects')) {
          ctx.save();
          ctx.globalAlpha = getLayerOpacity(state, 'objects');
          drawAssetGlyph(ctx, getCombatAssetGlyph(object, 'objects'), p.x, p.y, alphaColorFromHex(String(theme.danger || '#d05353'), 0.78), dangerStroke);
          ctx.restore();
        }
        if (hazard && isLayerVisible(state, 'hazards')) {
          ctx.save();
          ctx.globalAlpha = getLayerOpacity(state, 'hazards');
          drawAssetGlyph(ctx, getCombatAssetGlyph(hazard, 'hazards'), p.x, p.y, 'rgba(227,188,94,.88)', 'rgba(255,234,180,.8)');
          ctx.restore();
        }
        if (elevation > 0 && isLayerVisible(state, 'elevation')) {
          ctx.save();
          ctx.globalAlpha = getLayerOpacity(state, 'elevation');
          ctx.fillStyle = 'rgba(201,162,39,.95)';
          ctx.font = '10px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('+' + elevation, p.x, p.y + 4);
          ctx.restore();
        }

        if ((lighting === 'wall' || lighting === 'vision-blocker') && isLayerVisible(state, 'lighting')) {
          ctx.save();
          ctx.globalAlpha = getLayerOpacity(state, 'lighting');
          ctx.strokeStyle = lighting === 'wall' ? 'rgba(255,94,94,.95)' : 'rgba(122,88,210,.95)';
          ctx.lineWidth = 2.4;
          drawHex(ctx, p.x, p.y, size - 5.5);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,.65)';
          ctx.fillRect(p.x - 10, p.y - 8, 20, 16);
          ctx.fillStyle = '#fff';
          ctx.font = '10px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(lighting === 'wall' ? 'W' : 'VB', p.x, p.y + 3);
          ctx.restore();
        }

        var segMap = state.layers.wallSegments && state.layers.wallSegments[key] || null;
        if (segMap && typeof segMap === 'object' && isLayerVisible(state, 'lighting')) {
          var corners = [];
          for (var ci = 0; ci < 6; ci++) {
            var angle = Math.PI / 180 * (60 * ci - 30);
            corners.push({ x: p.x + (size - 3) * Math.cos(angle), y: p.y + (size - 3) * Math.sin(angle) });
          }
          var edgeMap = {
            e: [0, 1], se: [1, 2], sw: [2, 3], w: [3, 4], nw: [4, 5], ne: [5, 0]
          };
          Object.keys(segMap).forEach(function (k) {
            if (!segMap[k] || !edgeMap[k]) return;
            var pair = edgeMap[k];
            var a = corners[pair[0]];
            var b = corners[pair[1]];
            ctx.save();
            ctx.strokeStyle = 'rgba(255,94,94,.98)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
          });
        }

        if (state.fog && String(state.fog.revealMode || 'manual') === 'ordered' && state.fog.revealOrder && state.fog.revealOrder[key]) {
          ctx.save();
          ctx.fillStyle = accentGlow;
          ctx.font = '10px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(state.fog.revealOrder[key]), p.x, p.y - 10);
          ctx.restore();
        }

        if (state.fog && state.fog.enabled && state.fog.showMask && !currentVisible) {
          drawHex(ctx, p.x, p.y, size - 1.6);
          ctx.fillStyle = seenVisible && state.fog.softEdges ? alphaColorFromHex(String(theme.fog || '#020307'), 0.38) : fogMask;
          ctx.fill();
        }

        var labelText = String(state.layers && state.layers.labels && state.layers.labels[key] || '').trim();
        if (labelText && isLayerVisible(state, 'labels')) {
          ctx.save();
          ctx.globalAlpha = getLayerOpacity(state, 'labels');
          ctx.fillStyle = 'rgba(235,239,249,.96)';
          ctx.font = '11px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(labelText.slice(0, 28), p.x, p.y + 4);
          ctx.restore();
        }
      }
    }

    if (state.assetDragPreview && Number.isFinite(Number(state.assetDragPreview.q)) && Number.isFinite(Number(state.assetDragPreview.r))) {
      var previewPoint = axialToPixel(Number(state.assetDragPreview.q), Number(state.assetDragPreview.r), size, board.panX, board.panY);
      ctx.save();
      drawHex(ctx, previewPoint.x, previewPoint.y, size - 3.5);
      ctx.fillStyle = accentSoft;
      ctx.fill();
      ctx.strokeStyle = 'rgba(227,188,94,.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Highlight upload landing hex so placement intent is obvious.
    var uiState = normalizeCombatUi(state && state.ui);
    if (uiState.assetDrawerOpen) {
      var uploadTarget = getDefaultAssetDropHex(state, state && state.selectedTokenId, { preferSelection: true });
      if (uploadTarget && Number.isFinite(Number(uploadTarget.q)) && Number.isFinite(Number(uploadTarget.r))) {
        var uploadPoint = axialToPixel(Number(uploadTarget.q), Number(uploadTarget.r), size, board.panX, board.panY);
        var pulse = (Math.sin(Date.now() / 220) + 1) / 2;
        var ringRadius = Math.max(10, size * (0.58 + pulse * 0.12));
        ctx.save();
        ctx.strokeStyle = 'rgba(73,201,187,.95)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(uploadPoint.x, uploadPoint.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(227,188,94,.86)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(uploadPoint.x, uploadPoint.y, Math.max(6, ringRadius - 7), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(73,201,187,.9)';
        ctx.font = '10px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TARGET', uploadPoint.x, uploadPoint.y - Math.max(14, ringRadius + 4));
        ctx.restore();
      }
    }

    var selectedForMove = byId(state.selectedTokenId);
    var moveBudget = getMovementActionsAvailable(state, selectedForMove);
    if (selectedForMove && moveBudget > 0) {
      for (var mr = -moveBudget; mr <= moveBudget; mr++) {
        for (var mq = -moveBudget; mq <= moveBudget; mq++) {
          var targetQ = Number(selectedForMove.q || 0) + mq;
          var targetR = Number(selectedForMove.r || 0) + mr;
          var dist = hexDistance({ q: Number(selectedForMove.q || 0), r: Number(selectedForMove.r || 0) }, { q: targetQ, r: targetR });
          if (dist <= 0 || dist > moveBudget) continue;
          if (isBlocked(targetQ, targetR)) continue;
          if (nearestTokenAt(targetQ, targetR)) continue;
          var mp = axialToPixel(targetQ, targetR, size, board.panX, board.panY);
          ctx.save();
          drawHex(ctx, mp.x, mp.y, size - 4);
          ctx.fillStyle = String(selectedForMove.faction) === 'monster' ? dangerFill : accentFill;
          ctx.fill();
          ctx.strokeStyle = String(selectedForMove.faction) === 'monster' ? dangerStroke : alphaColorFromHex(String(theme.accent2 || '#49c9bb'), 0.62);
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    var selectedSet = selectedTokenIdSet();
    var layerOrder = { background: 0, token: 1, foreground: 2 };
    var tokensToDraw = (state.tokens || []).slice().sort(function (a, b) {
      var la = layerOrder[String(a && a.layer || 'token')];
      var lb = layerOrder[String(b && b.layer || 'token')];
      if (la !== lb) return Number(la || 1) - Number(lb || 1);
      return Number(a && a.zIndex || 0) - Number(b && b.zIndex || 0);
    });

    var renderQuality = resolveRenderQualityMode(state, tokensToDraw.length);
    var perfMode = renderQuality === 'performance';
    if (isLayerVisible(state, 'tokens')) tokensToDraw.forEach(function (token) {
      var targetPoint = getTokenRenderPoint(token, size, board.panX, board.panY);
      var p = getAnimatedTokenPoint(token, targetPoint, state);
      var tokenScale = Math.max(0.25, Math.min(2, Number(token.scale || 1)));
      var radius = Math.max(10, (size * 0.32) * Math.max(1, Number(token.size || 1)) * tokenScale);
      var dead = isTokenDead(token);
      var rotationRad = (Number(token.rotation || 0) % 360) * (Math.PI / 180);
      var tokenOpacity = getLayerOpacity(state, 'tokens');
      var badgeList = [];
      if (Array.isArray(token.status)) badgeList = badgeList.concat(token.status.filter(Boolean).map(function (entry) { return String(entry); }));
      ctx.save();
      ctx.globalAlpha = tokenOpacity;
      if (Number(token.auraRadius || 0) > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + Number(token.auraRadius || 0) * size * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = alphaColorFromHex(String(token.auraColor || '#49c9bb'), 0.16);
        ctx.strokeStyle = alphaColorFromHex(String(token.auraColor || '#49c9bb'), 0.45);
        ctx.lineWidth = 1.6;
        ctx.fill();
        ctx.stroke();
      }
      ctx.translate(p.x, p.y);
      if (rotationRad) ctx.rotate(rotationRad);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = String(token.faction) === 'monster' ? 'rgba(160,58,58,.92)' : 'rgba(47,154,144,.92)';
      if (dead) ctx.fillStyle = 'rgba(94,98,110,.7)';
      ctx.fill();
      if (token.image && !dead) {
        var sprite = getTokenSprite(token.image);
        if (sprite && sprite.loaded && sprite.image && !sprite.errored) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(sprite.image, -radius, -radius, radius * 2, radius * 2);
          ctx.restore();
        }
      }
      if (selectedSet[String(token.id)]) {
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = accentGlow;
        ctx.stroke();
      }
      if (String(state.selectedTokenId) === String(token.id)) {
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = 'rgba(227,188,94,.95)';
        ctx.stroke();
      }
      if (token.locked) {
        ctx.fillStyle = 'rgba(255,214,136,.95)';
        ctx.font = 'bold 11px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('L', 0, 3);
      }
      ctx.restore();

      if (token.freeform && (Number(token.offsetX || 0) || Number(token.offsetY || 0))) {
        var anchor = axialToPixel(Number(token.q || 0), Number(token.r || 0), size, board.panX, board.panY);
        ctx.save();
        ctx.strokeStyle = alphaColorFromHex(String(token.auraColor || '#49c9bb'), 0.45);
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (!perfMode) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(token.name || 'Token') + (dead ? ' [DEAD]' : ''), p.x, p.y - radius - 8);
        ctx.fillStyle = 'rgba(230,230,230,.95)';
        ctx.fillText('HP ' + Number(token.hp || 0) + '/' + Number(token.maxHp || token.hp || 0), p.x, p.y + radius + 12);
      }

      if (dead) {
        ctx.strokeStyle = 'rgba(255,96,96,.92)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - radius + 4, p.y - radius + 4);
        ctx.lineTo(p.x + radius - 4, p.y + radius - 4);
        ctx.moveTo(p.x + radius - 4, p.y - radius + 4);
        ctx.lineTo(p.x - radius + 4, p.y + radius - 4);
        ctx.stroke();
      }

      var drop = getLootDropForToken(state, token.id);
      if (drop && !drop.claimed && !perfMode) {
        ctx.fillStyle = 'rgba(227,188,94,.96)';
        ctx.font = '10px Rajdhani, sans-serif';
        ctx.fillText('LOOT', p.x, p.y + radius + 24);
      }

      // ===== HEALTH BAR =====
      var maxHp = Math.max(1, Number(token.maxHp || token.hp || 1));
      var currentHp = Math.max(0, Number(token.hp || 0));
      var hpPercent = maxHp > 0 ? currentHp / maxHp : 0;
      var healthBarWidth = radius * 2;
      var healthBarHeight = 5;
      var healthBarX = p.x - (healthBarWidth / 2);
      var healthBarY = p.y + radius + 4;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
      var hpColor = hpPercent > 0.5 ? 'rgba(45, 154, 123, 0.9)' : (hpPercent > 0.25 ? 'rgba(196, 97, 58, 0.9)' : alphaColorFromHex(String(theme.danger || '#d05353'), 0.95));
      ctx.fillStyle = hpColor;
      ctx.fillRect(healthBarX, healthBarY, healthBarWidth * hpPercent, healthBarHeight);
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
      ctx.restore();

      // ===== CONDITION ICONS =====
      var activeEffects = (state.tokenRoundEffects || []).filter(function (effect) {
        return effect && String(effect.targetTokenId || '') === String(token.id || '') && Number(effect.roundsLeft || 0) > 0;
      });
      if (activeEffects.length) badgeList = badgeList.concat(activeEffects.map(function (effect) { return String(effect.label || 'Condition'); }).slice(0, 3));
      if (badgeList.length && !perfMode) {
        var badgeY = p.y - radius - 24;
        var badgeHeight = 14;
        var badgeWidths = badgeList.slice(0, 3).map(function (label) { return Math.max(22, Math.min(68, label.length * 6 + 14)); });
        var badgeTotal = badgeWidths.reduce(function (sum, width) { return sum + width; }, 0) + Math.max(0, badgeWidths.length - 1) * 4;
        var badgeX = p.x - badgeTotal / 2;
        badgeList.slice(0, 3).forEach(function (label, idx) {
          var width = badgeWidths[idx];
          ctx.save();
          ctx.fillStyle = 'rgba(12,18,26,.82)';
          ctx.strokeStyle = alphaColorFromHex(String(token.auraColor || '#49c9bb'), 0.48);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, width, badgeHeight, 7);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#f5f7fb';
          ctx.font = '9px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(label).slice(0, 10), badgeX + width / 2, badgeY + 10);
          ctx.restore();
          badgeX += width + 4;
        });
      }
      if (activeEffects.length && !perfMode) {
        ctx.save();
        var iconSize = 14;
        var iconSpacing = 2;
        var totalIconWidth = (iconSize + iconSpacing) * activeEffects.length - iconSpacing;
        var iconStartX = p.x - (totalIconWidth / 2);
        var iconY = p.y + radius + 14;
        activeEffects.forEach(function (effect, idx) {
          var iconX = iconStartX + idx * (iconSize + iconSpacing);
          var color = String(effect.color || '#e3bc5e');
          ctx.beginPath();
          ctx.arc(iconX + (iconSize / 2), iconY, iconSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.3)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 9px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          var iconLabel = String(effect.label || '').charAt(0).toUpperCase();
          ctx.fillText(iconLabel, iconX + (iconSize / 2), iconY);
          if (Number(effect.roundsLeft || 0) > 0) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px Rajdhani, sans-serif';
            ctx.fillText(String(Math.max(0, Number(effect.roundsLeft || 0))) + 'r', iconX + (iconSize / 2), iconY + 8);
          }
        });
        ctx.restore();
      }

      // Quick-edit bubbles above token. Click bubble to edit with absolute or +/- delta.
      if (!perfMode) {
        var bubbleY = p.y - radius - 34;
        var bubbles = [
          { key: 'hp', label: 'HP ' + Number(token.hp || 0), color: 'rgba(47,154,144,.88)' }
        ];
        if (!dead && String(token.faction) === 'monster') {
          bubbles.push({ key: 'dread', label: 'DD ' + Math.max(4, Number(token.dread || token.codexDread || 6)), color: alphaColorFromHex(String(theme.danger || '#d05353'), 0.88) });
          bubbles.push({ key: 'deathNumber', label: 'DN ' + Math.max(1, Number(token.deathNumber || token.dread || 6)), color: 'rgba(227,188,94,.88)' });
        }
        var bw = 52;
        var bh = 16;
        var gap = 4;
        var totalW = bubbles.length * bw + (bubbles.length - 1) * gap;
        var sx = p.x - totalW / 2;
        bubbles.forEach(function (b, idx) {
          var bx = sx + idx * (bw + gap);
          ctx.save();
          ctx.fillStyle = b.color;
          ctx.strokeStyle = 'rgba(255,255,255,.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx, bubbleY, bw, bh, 7);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '10px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(b.label, bx + bw / 2, bubbleY + bh - 5);
          ctx.restore();
          bubbleHotspots.push({ tokenId: String(token.id), statKey: String(b.key), x: bx, y: bubbleY, w: bw, h: bh, cx: bx + (bw / 2), cy: bubbleY + (bh / 2) });
        });
      }

    });

    for (var fr = -board.rows; fr <= board.rows; fr++) {
      for (var fq = -board.cols; fq <= board.cols; fq++) {
        var fgKey = toKey(fq, fr);
        var fg = String(state.layers.foreground && state.layers.foreground[fgKey] || '').toLowerCase();
        if (!isLayerVisible(state, 'foreground')) continue;
        if (!fg) continue;
        var fp = axialToPixel(fq, fr, size, board.panX, board.panY);
        if (fp.x < -80 || fp.y < -80 || fp.x > w + 80 || fp.y > h + 80) continue;
        ctx.save();
        ctx.globalAlpha = getLayerOpacity(state, 'foreground');
        if (fg.indexOf('ink:') === 0) {
          var inkParts = fg.split(':');
          var inkColor = /^#([0-9a-f]{6})$/i.test(String(inkParts[1] || '')) ? String(inkParts[1]) : '#e3bc5e';
          var inkSize = Math.max(1, Math.min(5, Number(inkParts[2] || 1)));
          var inkRadius = Math.max(4, size * (0.12 + (inkSize * 0.045)));
          ctx.beginPath();
          ctx.arc(fp.x, fp.y, inkRadius, 0, Math.PI * 2);
          ctx.fillStyle = alphaColorFromHex(inkColor, 0.74);
          ctx.fill();
          ctx.strokeStyle = alphaColorFromHex(inkColor, 0.96);
          ctx.lineWidth = 1.4;
          ctx.stroke();
        } else if (fg.indexOf('canopy') >= 0 || fg.indexOf('tree') >= 0) {
          drawHex(ctx, fp.x, fp.y, size - 5.5);
          ctx.fillStyle = 'rgba(57,130,88,.34)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(134,219,171,.44)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = 'rgba(214,243,220,.95)';
          ctx.font = '10px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('CANOPY', fp.x, fp.y + 3);
        } else if (fg.indexOf('balcony') >= 0 || fg.indexOf('walkway') >= 0) {
          drawHex(ctx, fp.x, fp.y, size - 6.5);
          ctx.fillStyle = 'rgba(120,140,196,.25)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(175,196,255,.62)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.fillStyle = 'rgba(226,234,255,.95)';
          ctx.font = '10px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('BAL', fp.x, fp.y + 3);
        } else if (fg.indexOf('weather') >= 0 || fg.indexOf('fog') >= 0 || fg.indexOf('ash') >= 0 || fg.indexOf('storm') >= 0 || fg.indexOf('rain') >= 0) {
          drawHex(ctx, fp.x, fp.y, size - 3.8);
          ctx.fillStyle = 'rgba(206,223,245,.22)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(206,223,245,.38)';
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(226,236,250,.92)';
          ctx.font = '10px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('WX', fp.x, fp.y + 3);
        } else if (fg.indexOf('elev') >= 0 || fg.indexOf('ledge') >= 0 || fg.indexOf('high') >= 0) {
          drawHex(ctx, fp.x, fp.y, size - 6);
          ctx.strokeStyle = 'rgba(227,188,94,.78)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = 'rgba(245,225,164,.94)';
          ctx.font = '10px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('HIGH', fp.x, fp.y + 3);
        } else {
          drawHex(ctx, fp.x, fp.y, size - 5);
          ctx.fillStyle = 'rgba(200,200,200,.2)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(240,240,240,.4)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (state.ruler && state.ruler.active && state.ruler.start && state.ruler.end) {
      var opts = Object.assign({ shape: 'line' }, state.rulerOptions || {});
      var s = state.ruler.startPx && typeof state.ruler.startPx.x === 'number'
        ? { x: Number(state.ruler.startPx.x), y: Number(state.ruler.startPx.y) }
        : axialToPixel(state.ruler.start.q, state.ruler.start.r, size, board.panX, board.panY);
      var e = state.ruler.endPx && typeof state.ruler.endPx.x === 'number'
        ? { x: Number(state.ruler.endPx.x), y: Number(state.ruler.endPx.y) }
        : axialToPixel(state.ruler.end.q, state.ruler.end.r, size, board.panX, board.panY);
      ctx.strokeStyle = accentGlow;
      ctx.fillStyle = accentSoft;
      ctx.lineWidth = 2.2;
      if (String(opts.shape || 'line') === 'radius') {
        var radiusPx = Math.max(4, Math.hypot(e.x - s.x, e.y - s.y));
        ctx.beginPath();
        ctx.arc(s.x, s.y, radiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (String(opts.shape || 'line') === 'cone') {
        var ang = Math.atan2(e.y - s.y, e.x - s.x);
        var len = Math.max(8, Math.hypot(e.x - s.x, e.y - s.y));
        var spread = Math.PI / 6;
        var l = { x: s.x + Math.cos(ang - spread) * len, y: s.y + Math.sin(ang - spread) * len };
        var r = { x: s.x + Math.cos(ang + spread) * len, y: s.y + Math.sin(ang + spread) * len };
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(l.x, l.y);
        ctx.lineTo(r.x, r.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
      }
      ctx.fillStyle = accentGlow;
      ctx.font = '12px Rajdhani, sans-serif';
      ctx.fillText(String(state.ruler.distance) + ' hexes · ' + state.ruler.label, (s.x + e.x) / 2, (s.y + e.y) / 2 - 8);
    }

    if (activeSpellPreview.active) {
      var caster = byId(activeSpellPreview.casterTokenId);
      if (caster) {
        var casterPoint = axialToPixel(Number(caster.q || 0), Number(caster.r || 0), size, board.panX, board.panY);
        var targetPoint = axialToPixel(Number(activeSpellPreview.targetQ || caster.q || 0), Number(activeSpellPreview.targetR || caster.r || 0), size, board.panX, board.panY);
        var tPulse = (Math.sin(Date.now() / 240) + 1) / 2;
        ctx.save();
        ctx.strokeStyle = String(activeSpellPreview.border || 'rgba(164,223,255,0.95)');
        ctx.lineWidth = 1.6 + tPulse * 0.8;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(casterPoint.x, casterPoint.y);
        ctx.lineTo(targetPoint.x, targetPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = String(activeSpellPreview.border || 'rgba(164,223,255,0.95)');
        ctx.font = '12px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          activeSpellPreview.spellLabel + '  ' + activeSpellPreview.distance + '/' + activeSpellPreview.rangeLimit + ' hexes' + (activeSpellPreview.isValid ? '  [Cast Ready]' : '  [' + activeSpellPreview.reason + ']'),
          (casterPoint.x + targetPoint.x) / 2,
          (casterPoint.y + targetPoint.y) / 2 - 11
        );
        ctx.restore();
      }
    }

    if (state.ping && typeof state.ping === 'object') {
      var pingAge = Date.now() - Number(state.ping.at || 0);
      if (pingAge <= 1200) {
        var center = axialToPixel(Number(state.ping.q || 0), Number(state.ping.r || 0), size, board.panX, board.panY);
        var t = pingAge / 1200;
        var radiusPulse = 8 + t * 60;
        ctx.save();
        var rgb = hexToRgb(state.ping.color || String(theme.ping || '#49c9bb'));
        ctx.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (1 - t) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radiusPulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (1 - t) + ')';
        ctx.beginPath();
        ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ===== FLOATING NUMBERS OVERLAY =====
    updateFloatingNumbers();
    floatingNumbers.forEach(function (num) {
      var age = Date.now() - num.createdAt;
      var progress = age / num.lifetime;
      var offsetY = -60 * progress;
      var opacity = 1 - progress;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.font = 'bold 16px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      var color = '#ff6b6b';
      if (num.type === 'heal') color = '#7dd3ff';
      else if (num.type === 'crit') color = '#ffd688';
      else if (num.type === 'miss') color = '#9fa7bc';
      ctx.fillStyle = color;
      ctx.fillText(num.text, num.x, num.y + offsetY);
      ctx.restore();
    });
  }

  function setPanelPositions() {
    var state = store.getState();
    var tools = document.getElementById('combatToolsPanel');
    var feed = document.getElementById('combatFeedPanel');
    var actions = document.getElementById('combatActionsPanel');
    if (tools) { tools.style.left = state.panelPos.tools.x + 'px'; tools.style.top = state.panelPos.tools.y + 'px'; }
    if (feed) { feed.style.left = state.panelPos.feed.x + 'px'; feed.style.top = state.panelPos.feed.y + 'px'; }
    if (actions) { actions.style.left = state.panelPos.actions.x + 'px'; actions.style.top = state.panelPos.actions.y + 'px'; actions.style.transform = 'none'; }
  }

  function updateUiPanels() {
    syncWayfarerTokenHealthFromSheet();
    var state = ensureActionBudgetMap(ensureInitiative(normalizeCombatSceneState(store.getState())));
    syncWayfarerCombatActionBudget(false);
    var root = document.getElementById('combatModeOverlay');
    if (root) {
      if (state.playMode) root.classList.add('play-mode');
      else root.classList.remove('play-mode');
    }

    ['combatToolsPanel', 'combatFeedPanel', 'combatActionsPanel'].forEach(function (panelId) {
      var panel = document.getElementById(panelId);
      if (!panel) return;
      var isCollapsed = !!(state.collapsedPanels && state.collapsedPanels[panelId]);
      if (isCollapsed) panel.classList.add('collapsed');
      else panel.classList.remove('collapsed');
    });

    // Update round and turn display
    var roundDisplay = document.getElementById('combatRoundDisplay');
    if (roundDisplay) roundDisplay.textContent = String(Math.max(1, Number(state.round || 1)));

    var activeSceneName = document.getElementById('combatActiveSceneName');
    if (activeSceneName) {
      var activeScene = (state.scenes || []).find(function (scene) {
        return scene && String(scene.id || '') === String(state.activeSceneId || '');
      }) || null;
      activeSceneName.textContent = String(activeScene && activeScene.name || 'Main Scene');
    }

    var pageSelect = document.getElementById('combatPageSelect');
    if (pageSelect) {
      var scenes = Array.isArray(state.scenes) ? state.scenes : [];
      var prevPage = String(pageSelect.value || '');
      pageSelect.innerHTML = scenes.length
        ? scenes.map(function (scene, idx) {
          return '<option value="' + String(scene.id || '') + '">Page ' + (idx + 1) + ': ' + String(scene.name || ('Scene ' + (idx + 1))).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</option>';
        }).join('')
        : '<option value="">Page 1: Main Scene</option>';
      var hasPrev = Array.prototype.slice.call(pageSelect.options || []).some(function (opt) {
        return String(opt.value || '') === prevPage;
      });
      pageSelect.value = hasPrev ? prevPage : String(state.activeSceneId || (scenes[0] && scenes[0].id) || '');
    }

    var turnDisplay = document.getElementById('combatTurnDisplay');
    if (turnDisplay) {
      var current = state.initiative && state.initiative[state.initiativeIndex] || null;
      if (current) {
        turnDisplay.textContent = current.name || 'Awaiting start';
      } else {
        turnDisplay.textContent = 'Awaiting start';
      }
    }

    var playModeBtn = document.getElementById('combatPlayModeBtn');
    if (playModeBtn) {
      playModeBtn.textContent = state.playMode ? 'Build View' : 'Play View';
      playModeBtn.className = state.playMode ? 'btn btn-xs' : 'btn btn-xs btn-teal';
    }

    var compactBtn = document.getElementById('combatCompactModeBtn');
    if (compactBtn) {
      var compactMode = String(state.ui && state.ui.compactMode || 'auto');
      compactBtn.textContent = 'Compact: ' + (compactMode === 'on' ? 'On' : compactMode === 'off' ? 'Off' : 'Auto');
      compactBtn.className = compactMode === 'on' ? 'btn btn-xs btn-teal' : 'btn btn-xs';
      compactBtn.setAttribute('aria-pressed', compactMode === 'on' ? 'true' : 'false');
    }

    var layers = ['terrain', 'objects', 'hazards', 'elevation', 'lighting', 'weather', 'foreground', 'interactives', 'spawns'];
    var tools = ['select', 'paint', 'erase', 'text', 'fog', 'ruler', 'spellcast', 'pan', 'ping'];

    var layerRow = document.getElementById('combatLayerRow');
    if (layerRow) {
      layerRow.innerHTML = layers.map(function (layer) {
        var on = state.activeLayer === layer ? 'on' : '';
        return '<button class="combat-chip ' + on + '" data-layer="' + layer + '">' + layer + '</button>';
      }).join('');
      Array.prototype.slice.call(layerRow.querySelectorAll('[data-layer]')).forEach(function (btn) {
        btn.onclick = function () { store.setState({ activeLayer: String(btn.getAttribute('data-layer') || 'terrain') }); drawBoard(); updateUiPanels(); };
      });
    }

    var layerSettings = document.getElementById('combatLayerSettings');
    if (layerSettings) {
      var tacticalLayers = ['terrain', 'objects', 'tokens', 'foreground', 'lighting', 'hazards'];
      layerSettings.innerHTML = tacticalLayers.map(function (layerName) {
        var meta = getLayerSetting(state, layerName);
        return '<div class="combat-feed-line" style="display:grid;grid-template-columns:68px 1fr;gap:.35rem;align-items:center;">'
          + '<div><strong>' + layerName + '</strong><div class="combat-mini">' + Math.round(Number(meta.opacity || 1) * 100) + '%</div></div>'
          + '<div>'
          + '<div class="combat-chip-row">'
          + '<button class="combat-chip ' + (meta.visible ? 'on' : '') + '" data-layer-setting="visible" data-layer-name="' + layerName + '">' + (meta.visible ? 'Visible' : 'Hidden') + '</button>'
          + '<button class="combat-chip ' + (meta.locked ? 'on' : '') + '" data-layer-setting="locked" data-layer-name="' + layerName + '">' + (meta.locked ? 'Locked' : 'Unlocked') + '</button>'
          + '<button class="combat-chip ' + (meta.gmOnly ? 'on' : '') + '" data-layer-setting="gmOnly" data-layer-name="' + layerName + '">' + (meta.gmOnly ? 'GM Only' : 'Shared') + '</button>'
          + '</div>'
          + '<input type="range" min="10" max="100" step="5" value="' + Math.round(Number(meta.opacity || 1) * 100) + '" data-layer-opacity="' + layerName + '" style="width:100%;margin-top:.16rem;">'
          + '</div>'
          + '</div>';
      }).join('');
      Array.prototype.slice.call(layerSettings.querySelectorAll('[data-layer-setting]')).forEach(function (btn) {
        btn.onclick = function () {
          var layerName = String(btn.getAttribute('data-layer-name') || 'terrain');
          var settingKey = String(btn.getAttribute('data-layer-setting') || 'visible');
          store.setState(function (inner) {
            var next = Object.assign({}, inner);
            next.layerSettings = Object.assign({}, inner.layerSettings || {});
            var current = Object.assign({ visible: true, locked: false, opacity: 1, gmOnly: false }, next.layerSettings[layerName] || {});
            current[settingKey] = !current[settingKey];
            next.layerSettings[layerName] = current;
            persist(next);
            return next;
          });
          drawBoard();
          updateUiPanels();
        };
      });
      Array.prototype.slice.call(layerSettings.querySelectorAll('[data-layer-opacity]')).forEach(function (slider) {
        slider.oninput = function () {
          var layerName = String(slider.getAttribute('data-layer-opacity') || 'terrain');
          var opacity = Math.max(0.1, Math.min(1, Number(slider.value || 100) / 100));
          store.setState(function (inner) {
            var next = Object.assign({}, inner);
            next.layerSettings = Object.assign({}, inner.layerSettings || {});
            var current = Object.assign({ visible: true, locked: false, opacity: 1, gmOnly: false }, next.layerSettings[layerName] || {});
            current.opacity = opacity;
            next.layerSettings[layerName] = current;
            persist(next);
            return next;
          });
          drawBoard();
        };
      });
    }

    var toolRow = document.getElementById('combatToolRow');
    if (toolRow) {
      toolRow.innerHTML = tools.map(function (tool) {
        var on = state.activeTool === tool ? 'on' : '';
        return '<button class="combat-chip ' + on + '" data-tool="' + tool + '">' + tool + '</button>';
      }).join('');
      Array.prototype.slice.call(toolRow.querySelectorAll('[data-tool]')).forEach(function (btn) {
        btn.onclick = function () { setToolMode(String(btn.getAttribute('data-tool') || 'select')); drawBoard(); };
      });
    }

    var paintSel = document.getElementById('combatPaintValue');
    if (paintSel) {
      var options = getExpandedPaintOptions(state);
      var hash = options.join('|');
      if (paintSel.getAttribute('data-options-hash') !== hash) {
        paintSel.innerHTML = options.map(function (opt) {
          return '<option value="' + String(opt).replace(/"/g, '&quot;') + '">' + String(opt) + '</option>';
        }).join('');
        paintSel.setAttribute('data-options-hash', hash);
      }
      paintSel.value = String(state.paintValue || 'forest');
      paintSel.onchange = function () { store.setState({ paintValue: String(paintSel.value || 'forest') }); };
    }

    var drawColorInput = document.getElementById('combatDrawColor');
    if (drawColorInput) {
      drawColorInput.value = String(state.drawColor || '#e3bc5e');
      drawColorInput.oninput = function () {
        var value = String(drawColorInput.value || '#e3bc5e');
        if (!/^#([0-9a-f]{6})$/i.test(value)) return;
        store.setState(function (inner) {
          var next = Object.assign({}, inner, { drawColor: value });
          persist(next);
          return next;
        });
      };
    }

    var paintBrushSize = document.getElementById('combatPaintBrushSize');
    if (paintBrushSize) {
      paintBrushSize.value = String(Math.max(1, Math.min(5, Number(state.paintBrushSize || 1))));
      paintBrushSize.oninput = function () {
        var value = Math.max(1, Math.min(5, Number(paintBrushSize.value || 1)));
        store.setState(function (inner) {
          var next = Object.assign({}, inner, { paintBrushSize: value });
          persist(next);
          return next;
        });
      };
    }

    var fogMeta = document.getElementById('combatFogMeta');
    if (fogMeta) {
      var fogVision = getFogVisionMap(state);
      var revealedCount = Object.keys(fogVision.seen || {}).length;
      var visibleCount = Object.keys(fogVision.current || {}).length;
      var mode = String(state.fog && state.fog.revealMode || 'manual');
      var step = Math.max(0, Number(state.fog && state.fog.revealStep || 0));
      fogMeta.textContent = 'Seen ' + revealedCount + ' · Visible ' + visibleCount + ' · Vision ' + Number(state.fog && state.fog.visionRadius || 0) + ' · Mode ' + mode + (mode === 'ordered' ? (' · Step ' + step) : '');
    }

    var fogToggleBtn = document.getElementById('combatFogToggleBtn');
    if (fogToggleBtn) {
      fogToggleBtn.textContent = state.fog && state.fog.enabled ? 'Fog On' : 'Fog Off';
      fogToggleBtn.className = 'combat-chip ' + (state.fog && state.fog.enabled ? 'on' : '');
    }
    var fogBrushBtn = document.getElementById('combatFogBrushBtn');
    if (fogBrushBtn) {
      fogBrushBtn.textContent = 'Brush ' + (state.fogBrush === 'hide' ? 'Hide' : 'Reveal');
      fogBrushBtn.className = 'combat-chip on';
    }
    var fogModeBtn = document.getElementById('combatFogModeBtn');
    if (fogModeBtn) {
      var modeLabel = String(state.fog && state.fog.revealMode || 'manual');
      fogModeBtn.textContent = 'Mode: ' + modeLabel.charAt(0).toUpperCase() + modeLabel.slice(1);
    }
    var fogSharedBtn = document.getElementById('combatFogSharedBtn');
    if (fogSharedBtn) {
      fogSharedBtn.className = 'combat-chip ' + (state.fog && state.fog.sharedVision ? 'on' : '');
      fogSharedBtn.textContent = state.fog && state.fog.sharedVision ? 'Party Vision' : 'Single Vision';
    }
    var fogMemoryBtn = document.getElementById('combatFogMemoryBtn');
    if (fogMemoryBtn) {
      fogMemoryBtn.className = 'combat-chip ' + (state.fog && state.fog.explorerMode ? 'on' : '');
      fogMemoryBtn.textContent = state.fog && state.fog.explorerMode ? 'Explorer Memory' : 'No Memory';
    }
    var fogSoftBtn = document.getElementById('combatFogSoftBtn');
    if (fogSoftBtn) {
      fogSoftBtn.className = 'combat-chip ' + (state.fog && state.fog.softEdges ? 'on' : '');
      fogSoftBtn.textContent = state.fog && state.fog.softEdges ? 'Soft Edges' : 'Hard Edges';
    }

    var zoomSlider = document.getElementById('combatZoomSlider');
    if (zoomSlider) {
      zoomSlider.value = String(Math.round(Math.max(0.5, Math.min(2.3, Number(state.board && state.board.zoom || 1))) * 100));
    }
    var snapThresholdSlider = document.getElementById('combatSnapThresholdSlider');
    if (snapThresholdSlider) snapThresholdSlider.value = String(Math.round(Math.max(0, Math.min(1, Number(state.board && state.board.snapThreshold == null ? 0.3 : state.board.snapThreshold))) * 100));

    var measureShapeLineBtn = document.getElementById('combatMeasureShapeLineBtn');
    var measureShapeConeBtn = document.getElementById('combatMeasureShapeConeBtn');
    var measureShapeRadiusBtn = document.getElementById('combatMeasureShapeRadiusBtn');
    var measureSnapBtn = document.getElementById('combatMeasureSnapBtn');
    var measureFadeBtn = document.getElementById('combatMeasureFadeBtn');
    var ro = Object.assign({ shape: 'line', fadeDelay: 'linger', snapToGrid: true }, state.rulerOptions || {});
    if (measureShapeLineBtn) measureShapeLineBtn.className = 'combat-chip ' + (ro.shape === 'line' ? 'on' : '');
    if (measureShapeConeBtn) measureShapeConeBtn.className = 'combat-chip ' + (ro.shape === 'cone' ? 'on' : '');
    if (measureShapeRadiusBtn) measureShapeRadiusBtn.className = 'combat-chip ' + (ro.shape === 'radius' ? 'on' : '');
    if (measureSnapBtn) {
      measureSnapBtn.className = 'combat-chip ' + (ro.snapToGrid ? 'on' : '');
      measureSnapBtn.textContent = 'Snap: ' + (ro.snapToGrid ? 'On' : 'Off');
    }
    if (measureFadeBtn) {
      measureFadeBtn.className = 'combat-chip ' + (ro.fadeDelay === 'linger' ? 'on' : '');
      measureFadeBtn.textContent = 'Fade: ' + (ro.fadeDelay === 'linger' ? 'Linger' : 'Instant');
    }

    var railToolMap = {
      select: 'combatRailSelectBtn',
      pan: 'combatRailPanBtn',
      paint: 'combatRailDrawBtn',
      text: 'combatRailTextBtn',
      ruler: 'combatRailMeasureBtn',
      spellcast: 'combatRailMeasureBtn',
      fog: 'combatRailFogBtn'
    };
    Object.keys(railToolMap).forEach(function (toolKey) {
      var node = document.getElementById(railToolMap[toolKey]);
      if (!node) return;
      node.classList.toggle('active', String(state.activeTool || '') === toolKey);
    });
    var castBtn = document.getElementById('combatToolbarSpellCastBtn');
    var spellPreview = normalizeCombatSpellPreview(state.spellPreview);
    if (castBtn) {
      var canCast = !!(spellPreview.active && spellPreview.isValid);
      castBtn.className = 'combat-chip ' + (canCast ? 'on' : '');
      castBtn.textContent = canCast
        ? ('Cast: ' + String(spellPreview.spellLabel || 'Spell').replace(/\s+/g, ' ').slice(0, 16))
        : (spellPreview.active ? 'Aim Spell' : 'Cast');
      castBtn.title = canCast
        ? (spellPreview.reason || 'Cast now')
        : (spellPreview.active ? (spellPreview.reason || 'Aim to a valid target') : 'Open Effects and start a spell preview.');
      castBtn.disabled = !spellPreview.active;
    }

    var assetCategoryRow = document.getElementById('combatAssetCategoryRow');
    var assetSearch = document.getElementById('combatAssetSearch');
    var assetFeed = document.getElementById('combatAssetBrowserFeed');
    var assetDock = document.getElementById('combatAssetDock');
    var assetDockToggleBtn = document.getElementById('combatAssetDockToggleBtn');
    var assetDockMeta = document.getElementById('combatAssetDockMeta');
    var assetUploadStatus = document.getElementById('combatAssetUploadStatus');
    var assetUploadBar = document.getElementById('combatAssetUploadBar');
    var assetUploadLabel = document.getElementById('combatAssetUploadLabel');
    if (assetCategoryRow && assetSearch && assetFeed) {
      var cats = ['heroes', 'villains', 'townsfolk', 'battlemaps', 'objects', 'terrain', 'utilities'];
      var ab = Object.assign({ category: 'heroes', query: '' }, state.assetBrowser || {});
      var rules = ensureCombatSceneRulesExtensions(state.sceneRules);
      var folders = normalizeCombatAssetFolders(rules.assetFolders || {});
      var uiState = normalizeCombatUi(state.ui);
      if (assetDock) assetDock.classList.toggle('open', !!uiState.assetDrawerOpen);
      if (assetDockToggleBtn) assetDockToggleBtn.textContent = uiState.assetDrawerOpen ? 'Hide' : 'Show';
      if (assetDockMeta) assetDockMeta.textContent = uiState.assetDrawerOpen ? 'Drag from the drawer straight onto the board.' : 'Drawer collapsed. Reopen to browse and drag assets.';
      if (assetUploadStatus && assetUploadBar && assetUploadLabel) {
        var upload = state.assetUpload || null;
        assetUploadStatus.classList.toggle('active', !!upload);
        assetUploadBar.style.width = upload ? Math.max(0, Math.min(100, Number(upload.pct || 0))) + '%' : '0%';
        assetUploadLabel.textContent = upload ? (String(upload.name || 'Upload') + ' - ' + String(upload.status || 'Working') + ' (' + Math.max(0, Math.min(100, Number(upload.pct || 0))) + '%)') : 'No uploads running.';
      }
      assetCategoryRow.innerHTML = cats.map(function (c) {
        return '<button class="combat-chip ' + (ab.category === c ? 'on' : '') + '" data-asset-cat="' + c + '">' + c + '</button>';
      }).join('');
      Array.prototype.slice.call(assetCategoryRow.querySelectorAll('[data-asset-cat]')).forEach(function (btn) {
        btn.onclick = function () {
          var c = String(btn.getAttribute('data-asset-cat') || 'heroes');
          store.setState(function (inner) {
            var next = Object.assign({}, inner);
            next.assetBrowser = Object.assign({}, inner.assetBrowser || {}, { category: c });
            persist(next);
            return next;
          });
          updateUiPanels();
        };
      });

      assetSearch.value = String(ab.query || '');
      if (!assetSearch._boundAssetSearch) {
        assetSearch._boundAssetSearch = true;
        assetSearch.oninput = function () {
          var q = String(assetSearch.value || '');
          store.setState(function (inner) {
            var next = Object.assign({}, inner);
            next.assetBrowser = Object.assign({}, inner.assetBrowser || {}, { query: q });
            persist(next);
            return next;
          });
          updateUiPanels();
        };
      }

      var codex = Array.isArray(state.codexBestiary) ? state.codexBestiary : [];
      var heroAssets = [
        { id: 'hero-wayfarer', name: canonicalWayfarerName(), action: 'add-wayfarer' },
        { id: 'hero-ally-scout', name: 'Ally Scout', action: 'spawn-ally' },
        { id: 'hero-ally-warden', name: 'Ally Warden', action: 'spawn-ally' }
      ];
      function summarizeCodexSkills(entry) {
        if (!entry || typeof entry !== 'object') return '';
        var source = [];
        if (Array.isArray(entry.skills)) source = entry.skills;
        else if (Array.isArray(entry.abilities)) source = entry.abilities;
        else if (Array.isArray(entry.moves)) source = entry.moves;
        var labels = source.map(function (row) {
          if (!row) return '';
          if (typeof row === 'string') return row;
          return String(row.name || row.label || row.title || '').trim();
        }).filter(Boolean).slice(0, 3);
        return labels.join(' · ');
      }

      var villainAssets = codex.slice(0, 32).map(function (entry) {
        return {
          id: String(entry.id || uid('vill')),
          name: String(entry.name || 'Enemy'),
          action: 'spawn-villain',
          payload: entry,
          meta: summarizeCodexSkills(entry)
        };
      });
      if (!villainAssets.length) {
        villainAssets = [
          { id: 'vill-ash-raider', name: 'Ash Raider', action: 'spawn-villain', payload: { id: 'vill-ash-raider', name: 'Ash Raider', dread: 6, hp: 10, image: '' }, meta: 'Cleave · Bleed · Rush' },
          { id: 'vill-pale-hound', name: 'Pale Hound', action: 'spawn-villain', payload: { id: 'vill-pale-hound', name: 'Pale Hound', dread: 5, hp: 9, image: '' }, meta: 'Pounce · Pin · Howl' },
          { id: 'vill-void-acolyte', name: 'Void Acolyte', action: 'spawn-villain', payload: { id: 'vill-void-acolyte', name: 'Void Acolyte', dread: 7, hp: 11, image: '' }, meta: 'Hex Bolt · Shield Drain · Warp Step' },
          { id: 'vill-iron-wraith', name: 'Iron Wraith', action: 'spawn-villain', payload: { id: 'vill-iron-wraith', name: 'Iron Wraith', dread: 8, hp: 12, image: '' }, meta: 'Armor Break · Anchor · Fear Pulse' }
        ];
      }
      var townsfolkAssets = [
        { id: 'town-guide', name: 'Guide', action: 'spawn-npc' },
        { id: 'town-merchant', name: 'Merchant', action: 'spawn-npc' },
        { id: 'town-guard', name: 'Town Guard', action: 'spawn-npc' },
        { id: 'town-healer', name: 'Field Healer', action: 'spawn-npc' }
      ];
      var battlemapsAssets = [
        { id: 'map-blank', name: 'Blank Arena 15x15', action: 'map-preset', payload: { cols: 15, rows: 15, weather: 'none' } },
        { id: 'map-urban', name: 'Urban Grid 20x20', action: 'map-preset', payload: { cols: 20, rows: 20, weather: 'none' } },
        { id: 'map-fog', name: 'Fog Valley 18x12', action: 'map-preset', payload: { cols: 18, rows: 12, weather: 'fog' } },
        { id: 'map-storm', name: 'Storm Deck 18x10', action: 'map-preset', payload: { cols: 18, rows: 10, weather: 'storm' } }
      ].concat((folders.mapAssets || []).map(function (entry) {
        return { id: 'map-upload-' + String(entry.id || ''), name: String(entry.name || 'Uploaded Map'), action: 'map-uploaded', payload: String(entry.id || '') };
      }));
      var objectAssets = ['obstacle', 'door', 'turret', 'trap', 'shrine', 'spawn', 'wall', 'vision-blocker', 'crate', 'pillar', 'barricade', 'altar', 'console', 'loot-cache', 'beacon'].map(function (name) {
        return { id: 'obj-' + name, name: name, action: 'paint-object', payload: name };
      }).concat([
        { id: 'obj-terrain-road', name: 'terrain icon - road', action: 'paint-object', payload: 'terrain-road' },
        { id: 'obj-terrain-forest', name: 'terrain icon - forest', action: 'paint-object', payload: 'terrain-forest' },
        { id: 'obj-terrain-water', name: 'terrain icon - water', action: 'paint-object', payload: 'terrain-water' },
        { id: 'obj-terrain-crags', name: 'terrain icon - crags', action: 'paint-object', payload: 'terrain-crags' },
        { id: 'obj-terrain-lava', name: 'terrain icon - lava', action: 'paint-object', payload: 'terrain-lava' },
        { id: 'obj-terrain-ruins', name: 'terrain icon - ruins', action: 'paint-object', payload: 'terrain-ruins' }
      ]).concat([
        { id: 'obj-loot-cache-stocked', name: 'loot-cache (stocked)', action: 'stock-cache', payload: 'balanced' },
        { id: 'obj-loot-cache-credits', name: 'loot-cache (credits only)', action: 'stock-cache', payload: 'credits' }
      ]);
      var terrainAssets = ['road', 'forest', 'marsh', 'crags', 'water', 'lava', 'ruins', 'difficult terrain', 'cobblestone'].map(function (name) {
        return { id: 'terrain-' + name.replace(/\s+/g, '-'), name: name, action: 'paint-terrain', payload: name };
      }).concat((folders.hexAssets || []).map(function (entry) {
        return { id: 'hex-upload-' + String(entry.id || ''), name: 'hex · ' + String(entry.name || 'Uploaded Hex'), action: 'paint-terrain', payload: 'hexasset:' + String(entry.id || '') };
      }));
      var utilityAssets = [
        { id: 'util-hazard-check', name: 'Hazard Check Dialog', action: 'hazard-check', payload: '' },
        { id: 'util-config-hazard', name: 'Configure Hazard DD', action: 'hazard-config', payload: '' },
        { id: 'util-upload-map', name: 'Upload to Map Folder', action: 'upload-map-folder', payload: '' },
        { id: 'util-upload-hex', name: 'Upload to Hex Folder', action: 'upload-hex-folder', payload: '' }
      ];

      function assetEmoji(itemName, category) {
        var n = String(itemName || '').toLowerCase();
        if (category === 'battlemaps') {
          if (n.indexOf('urban') >= 0) return '🏙';
          if (n.indexOf('storm') >= 0) return '⛈';
          if (n.indexOf('fog') >= 0) return '🌫';
          if (n.indexOf('uploaded') >= 0) return '🖼';
          return '🗺';
        }
        if (category === 'terrain') return getCombatAssetGlyph(itemName, 'terrain');
        if (category === 'utilities') {
          if (n.indexOf('hazard') >= 0) return '☣';
          if (n.indexOf('upload') >= 0) return '⬆';
          return '🧰';
        }
        if (category === 'heroes') return '🛡';
        if (category === 'villains') return '☠';
        if (category === 'townsfolk') return '👥';
        if (category === 'objects') return getCombatAssetGlyph(itemName, 'objects');
        if (n.indexOf('door') >= 0) return '🚪';
        if (n.indexOf('turret') >= 0) return '🔫';
        if (n.indexOf('trap') >= 0) return '⚠';
        if (n.indexOf('shrine') >= 0 || n.indexOf('altar') >= 0) return '🕯';
        if (n.indexOf('crate') >= 0 || n.indexOf('loot') >= 0) return '📦';
        if (n.indexOf('wall') >= 0 || n.indexOf('barricade') >= 0) return '🧱';
        if (n.indexOf('console') >= 0 || n.indexOf('beacon') >= 0) return '📡';
        return '🧩';
      }

      var pool = heroAssets;
      if (ab.category === 'villains') pool = villainAssets;
      else if (ab.category === 'townsfolk') pool = townsfolkAssets;
      else if (ab.category === 'battlemaps') pool = battlemapsAssets;
      else if (ab.category === 'objects') pool = objectAssets;
      else if (ab.category === 'terrain') pool = terrainAssets;
      else if (ab.category === 'utilities') pool = utilityAssets;

      var qLower = String(ab.query || '').toLowerCase();
      var filtered = pool.filter(function (item) {
        return !qLower || String(item.name || '').toLowerCase().indexOf(qLower) >= 0;
      }).slice(0, 48);

      assetFeed.innerHTML = filtered.length
        ? filtered.map(function (item) {
          var icon = assetEmoji(item.name, ab.category);
          var helperText = String(item && item.meta || (ab.category === 'battlemaps' ? 'Click to apply or drag onto board.' : (ab.category === 'utilities' ? 'Click to run utility workflow.' : (ab.category === 'terrain' ? 'Click to arm painter. Drag onto a hex to stamp.' : 'Drag onto the board or click to place.'))));
          return '<article class="combat-feed-line combat-asset-card" draggable="true" title="Drag onto the battlemap to place this asset" aria-label="Drag ' + String(item.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + ' onto the battlemap" data-asset-action="' + String(item.action || '') + '" data-asset-id="' + String(item.id || '') + '" data-asset-label="' + String(item.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '">'
            + '<div class="combat-asset-card-main"><strong>' + icon + ' ' + String(item.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</strong><span class="combat-mini">' + helperText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span></div>'
            + '</article>';
        }).join('')
        : '<div class="combat-feed-line">No assets found.</div>';

      Array.prototype.slice.call(assetFeed.querySelectorAll('[data-asset-action]')).forEach(function (btn) {
        btn.onclick = function (evt) {
          if (evt && evt.stopPropagation) evt.stopPropagation();
          var action = String(btn.getAttribute('data-asset-action') || '');
          var id = String(btn.getAttribute('data-asset-id') || '');
          var useState = store.getState();
          var dropHex = getDefaultAssetDropHex(useState, useState.selectedTokenId, { preferSelection: true });
          var baseQ = Number(dropHex.q || 0);
          var baseR = Number(dropHex.r || 0);
          var chosen = filtered.find(function (item) { return String(item.id || '') === id; }) || null;
          if (!chosen) {
            var fallbackPayload = '';
            if (action === 'paint-object') fallbackPayload = String(id || '').replace(/^obj-/, '') || 'obstacle';
            else if (action === 'paint-terrain') {
              if (String(id || '').indexOf('hex-upload-') === 0) fallbackPayload = 'hexasset:' + String(id || '').replace(/^hex-upload-/, '');
              else fallbackPayload = String(id || '').replace(/^terrain-/, '').replace(/-/g, ' ') || 'road';
            }
            else if (action === 'stock-cache') fallbackPayload = String(id || '').indexOf('credits') >= 0 ? 'credits' : 'balanced';
            else if (action === 'map-uploaded') fallbackPayload = String(id || '').replace(/^map-upload-/, '');
            else if (action === 'map-preset') {
              if (String(id || '') === 'map-blank') fallbackPayload = { cols: 15, rows: 15, weather: 'none' };
              else if (String(id || '') === 'map-urban') fallbackPayload = { cols: 20, rows: 20, weather: 'none' };
              else if (String(id || '') === 'map-fog') fallbackPayload = { cols: 18, rows: 12, weather: 'fog' };
              else if (String(id || '') === 'map-storm') fallbackPayload = { cols: 18, rows: 10, weather: 'storm' };
            }
            else if (action === 'spawn-villain') fallbackPayload = { id: String(id || uid('vill')), name: String(btn.getAttribute('data-asset-label') || id || 'Enemy'), dread: 6, hp: 10, image: '' };
            chosen = { id: id, name: String(btn.getAttribute('data-asset-label') || id || ''), action: action, payload: fallbackPayload };
          }
          if (action === 'spawn-villain' && (!chosen.payload || typeof chosen.payload !== 'object')) {
            chosen = Object.assign({}, chosen, {
              payload: { id: String(id || uid('vill')), name: String(chosen.name || id || 'Enemy'), dread: 6, hp: 10, image: '' }
            });
          }
          if (action === 'map-preset' && (!chosen.payload || typeof chosen.payload !== 'object')) {
            if (String(id || '') === 'map-blank') chosen = Object.assign({}, chosen, { payload: { cols: 15, rows: 15, weather: 'none' } });
            else if (String(id || '') === 'map-urban') chosen = Object.assign({}, chosen, { payload: { cols: 20, rows: 20, weather: 'none' } });
            else if (String(id || '') === 'map-fog') chosen = Object.assign({}, chosen, { payload: { cols: 18, rows: 12, weather: 'fog' } });
            else if (String(id || '') === 'map-storm') chosen = Object.assign({}, chosen, { payload: { cols: 18, rows: 10, weather: 'storm' } });
          }
          if (action === 'add-wayfarer') {
            var addWayfarerBtn = document.getElementById('combatAddWayfarerBtn');
            if (addWayfarerBtn) addWayfarerBtn.click();
          } else if (action === 'spawn-ally') {
            store.setState(function (inner) {
              var next = Object.assign({}, inner);
              var t = { id: uid('ally'), name: String(chosen.name || 'Ally'), faction: 'player', hp: 10, maxHp: 10, status: [], q: baseQ, r: baseR, image: '', size: 1, isPlayer: false };
              next.tokens = (inner.tokens || []).concat([t]);
              next.selectedTokenId = t.id;
              persist(next);
              return next;
            });
            addHistory('Asset placed: ' + chosen.name + '.');
          } else if (action === 'spawn-villain' && chosen.payload) {
            spawnBestiaryToken(chosen.payload, baseQ, baseR);
          } else if (action === 'spawn-npc') {
            store.setState(function (inner2) {
              var next2 = Object.assign({}, inner2);
              var n = { id: uid('npc'), name: String(chosen.name || 'NPC'), faction: 'npc', hp: 8, maxHp: 8, status: [], q: baseQ, r: baseR, image: '', size: 1, inventory: seedTokenInventoryItems('npc', 4) };
              next2.tokens = (inner2.tokens || []).concat([n]);
              next2.selectedTokenId = n.id;
              persist(next2);
              return next2;
            });
            addHistory('Asset placed: ' + chosen.name + '.');
          } else if (action === 'map-preset' && chosen.payload) {
            store.setState(function (inner3) {
              var next3 = Object.assign({}, inner3);
              next3.board = Object.assign({}, inner3.board || {}, { cols: Number(chosen.payload.cols || 15), rows: Number(chosen.payload.rows || 15), weatherOverlay: String(chosen.payload.weather || 'none') });
              persist(next3);
              return next3;
            });
            addHistory('Battlemap preset applied: ' + chosen.name + '.');
          } else if (action === 'map-uploaded') {
            var selectedMap = (folders.mapAssets || []).find(function (entry) { return String(entry.id || '') === String(chosen.payload || ''); }) || null;
            if (selectedMap && selectedMap.src) {
              store.setState(function (innerMap) {
                var nextMap = Object.assign({}, innerMap);
                nextMap.board = Object.assign({}, innerMap.board || {}, { background: String(selectedMap.src || '') });
                persist(nextMap);
                return nextMap;
              });
              backgroundCache.src = '';
              backgroundCache.img = null;
              addHistory('Battlemap applied from folder: ' + String(selectedMap.name || 'Uploaded Map') + '.');
            }
          } else if (action === 'paint-object') {
            applyCombatAssetActionAt('set-tool', 'objects:' + String(chosen.payload || 'obstacle'), baseQ, baseR, true);
          } else if (action === 'stock-cache') {
            applyCombatAssetActionAt('stock-cache', String(chosen.payload || 'balanced'), baseQ, baseR, true);
          } else if (action === 'paint-terrain') {
            // directDrop=false arms the painter tool so the user can then click hexes to paint;
            // drag-to-board uses directDrop=true for immediate placement at the dropped hex.
            applyCombatAssetActionAt('set-tool', 'terrain:' + String(chosen.payload || 'road'), baseQ, baseR, false);
          } else if (action === 'hazard-check') {
            window.applyCombatAssetActionAt('hazard-check', '', baseQ, baseR, false);
          } else if (action === 'hazard-config') {
            window.applyCombatAssetActionAt('hazard-config', '', baseQ, baseR, false);
          } else if (action === 'upload-map-folder') {
            window.applyCombatAssetActionAt('upload-map-folder', '', baseQ, baseR, false);
          } else if (action === 'upload-hex-folder') {
            window.applyCombatAssetActionAt('upload-hex-folder', '', baseQ, baseR, false);
          }
          drawBoard();
          updateUiPanels();
        };
      });
      Array.prototype.slice.call(assetFeed.querySelectorAll('.combat-asset-card')).forEach(function (card) {
        function resolveDragDescriptor() {
          var action = String(card.getAttribute('data-asset-action') || '');
          var id = String(card.getAttribute('data-asset-id') || '');
          var chosen = filtered.find(function (item) { return String(item.id || '') === id; }) || null;
          if (!chosen) {
            var fallbackPayload = '';
            var fallbackName = String(card.getAttribute('data-asset-label') || id || 'Asset');
            if (action === 'paint-object') fallbackPayload = String(id || '').replace(/^obj-/, '') || 'obstacle';
            else if (action === 'paint-terrain') {
              if (String(id || '').indexOf('hex-upload-') === 0) fallbackPayload = 'hexasset:' + String(id || '').replace(/^hex-upload-/, '');
              else fallbackPayload = String(id || '').replace(/^terrain-/, '').replace(/-/g, ' ') || 'road';
            }
            else if (action === 'stock-cache') fallbackPayload = String(id || '').indexOf('credits') >= 0 ? 'credits' : 'balanced';
            else if (action === 'map-uploaded') fallbackPayload = String(id || '').replace(/^map-upload-/, '');
            else if (action === 'spawn-villain') fallbackPayload = { id: String(id || uid('vill')), name: fallbackName, dread: 6, hp: 10, image: '' };
            chosen = { id: id, name: fallbackName, action: action, payload: fallbackPayload };
          }
          var dragKind = '';
          var dragPayload = '';
          if (action === 'spawn-ally') {
            dragKind = 'spawn';
            dragPayload = 'player:' + String(chosen.name || 'Ally');
          } else if (action === 'spawn-npc') {
            dragKind = 'spawn';
            dragPayload = 'npc:' + String(chosen.name || 'NPC');
          } else if (action === 'spawn-villain') {
            dragKind = 'spawn-bestiary';
            dragPayload = String(chosen.id || '') + '|' + String(chosen.name || 'Enemy');
          } else if (action === 'map-preset') {
            dragKind = 'preset';
            var presetItemId = String(chosen.id || '');
            dragPayload = presetItemId.indexOf('storm') >= 0 ? 'storm' : presetItemId.indexOf('fog') >= 0 ? 'fog' : presetItemId.indexOf('blank') >= 0 ? 'blank' : 'urban';
          } else if (action === 'map-uploaded') {
            dragKind = 'set-map';
            dragPayload = String(chosen.payload || '');
          } else if (action === 'paint-object') {
            dragKind = 'set-tool';
            dragPayload = 'objects:' + String(chosen.payload || 'obstacle');
          } else if (action === 'paint-terrain') {
            dragKind = 'set-tool';
            dragPayload = 'terrain:' + String(chosen.payload || 'road');
          } else if (action === 'stock-cache') {
            dragKind = 'stock-cache';
            dragPayload = String(chosen.payload || 'balanced');
          }
          if (!dragKind) return null;
          return {
            kind: dragKind,
            payload: dragPayload,
            label: String(chosen.name || card.getAttribute('data-asset-label') || 'Dragging asset')
          };
        }
        card.onpointerdown = function () {
          var descriptor = resolveDragDescriptor();
          if (!descriptor) return;
          primeCombatAssetDragPayload(descriptor.kind, descriptor.payload, descriptor.label);
          primeCombatAssetDockDescriptor(descriptor.kind, descriptor.payload, descriptor.label);
        };
        card.onmousedown = function () {
          var descriptor = resolveDragDescriptor();
          if (!descriptor) return;
          primeCombatAssetDragPayload(descriptor.kind, descriptor.payload, descriptor.label);
          primeCombatAssetDockDescriptor(descriptor.kind, descriptor.payload, descriptor.label);
        };
        card.ondragstart = function (ev) {
          var descriptor = resolveDragDescriptor();
          if (descriptor) {
            primeCombatAssetDragPayload(descriptor.kind, descriptor.payload, descriptor.label);
            primeCombatAssetDockDescriptor(descriptor.kind, descriptor.payload, descriptor.label);
            window.startCombatAssetDrag(ev, descriptor.kind, descriptor.payload);
          }
        };
        card.ondragend = function () {
          setTimeout(function () {
            window.__combatAssetDragPayload = null;
          }, 750);
          setCombatDragDebugState({ phase: 'drag-end', dropSource: 'none' });
          clearCombatAssetDragGhost();
          clearCombatAssetDragPreview();
        };
      });
    }

    var bestiary = document.getElementById('combatBestiaryDrawer');
    if (bestiary) {
      var cards = (state.codexBestiary || []).slice(0, 36).map(function (entry) {
        var shortDesc = String(entry.desc || '').slice(0, 86);
        return '<div class="combat-feed-line" draggable="true" data-bestiary-id="' + String(entry.id) + '">'
          + '<strong>' + String(entry.name) + '</strong> · DD' + Number(entry.dread || 4) + ' · HP ' + Number(entry.hp || 8)
          + '<div class="combat-mini">' + shortDesc + '</div>'
          + '<button class="btn btn-xs" data-spawn-id="' + String(entry.id) + '">Spawn</button>'
          + '</div>';
      }).join('');
      bestiary.innerHTML = cards || '<div class="combat-mini">No codex bestiary entries found.</div>';
      Array.prototype.slice.call(bestiary.querySelectorAll('[data-spawn-id]')).forEach(function (btn) {
        btn.onclick = function () {
          var id = String(btn.getAttribute('data-spawn-id') || '');
          var profile = (state.codexBestiary || []).find(function (entry) { return String(entry.id) === id; }) || null;
          if (!profile) return;
          var actor = byId(state.selectedTokenId);
          var q = actor ? Number(actor.q || 0) + 2 : 2;
          var r = actor ? Number(actor.r || 0) : 0;
          spawnBestiaryToken(profile, q, r);
        };
      });
      Array.prototype.slice.call(bestiary.querySelectorAll('[data-bestiary-id]')).forEach(function (card) {
        card.ondragstart = function (ev) {
          var id = String(card.getAttribute('data-bestiary-id') || '');
          ev.dataTransfer.setData('text/combat-bestiary-id', id);
        };
      });
    }

    var initList = document.getElementById('combatInitiativeList');
    var initRibbon = document.getElementById('combatInitiativeRibbon');
    if (initList) {
      var wayfarers = (state.tokens || []).filter(function (token) { return token && token.isPlayer; });
      var allies = (state.tokens || []).filter(function (token) { return token && String(token.faction) === 'player' && !token.isPlayer; });
      var enemies = (state.tokens || []).filter(function (token) { return token && String(token.faction) === 'monster'; });
      var activeRowInit = state.initiative && state.initiative[state.initiativeIndex] || null;
      var activeIdInit = String(activeRowInit && activeRowInit.tokenId || '');
      function tokenActionsLeft(token) {
        if (!token) return 0;
        if (token.isPlayer) return Math.max(0, Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0));
        return Math.max(0, Number(state.teamActions && state.teamActions[token.id] || 0));
      }
      function cardForToken(token, laneLabel, color) {
        var isTurn = String(token && token.id || '') === activeIdInit;
        var cls = 'combat-turn-card' + (isTurn ? ' active' : '');
        var actionsLeft = tokenActionsLeft(token);
        var maxActions = 3;
        if (token && token.isPlayer && window.S && window.S.combat) {
          maxActions = Math.max(1, Number(window.S.combat.maxActions || 3));
        }
        var actionDots = '';
        for (var adx = 0; adx < maxActions; adx++) {
          var dotClass = adx < actionsLeft ? '' : ' spent';
          actionDots += '<span class="combat-turn-action-dot-small' + dotClass + '"></span>';
        }
        return '<button class="' + cls + '" data-turn-token="' + String(token.id || '') + '">'
          + '<span class="combat-turn-lane" style="color:' + color + ';">' + laneLabel + '</span>'
          + '<span class="combat-turn-name">' + String(token.name || 'Unit') + '</span>'
          + '<span class="combat-turn-meta">'
          + '<span class="combat-turn-action-indicator">' + actionDots + '</span>'
          + ' · hex ' + toKey(token.q, token.r) + (isTurn ? ' · TURN' : '') 
          + '</span>'
          + '</button>';
      }
      initList.innerHTML = ''
        + '<div class="combat-initiative-round-marker">Round ' + Math.max(1, Number(state.round || 1)) + '</div>'
        + wayfarers.map(function (token) { return cardForToken(token, 'Wayfarer', 'var(--combat-accent-2)'); }).join('')
        + allies.map(function (token) { return cardForToken(token, 'Ally', 'var(--combat-text)'); }).join('')
        + enemies.map(function (token) { return cardForToken(token, 'Enemy', 'var(--combat-danger)'); }).join('');
      if (!String(initList.innerHTML || '').trim()) {
        initList.innerHTML = '<div class="combat-feed-line">No combatants tracked.</div>';
      } else {
        Array.prototype.slice.call(initList.querySelectorAll('[data-turn-token]')).forEach(function (btn) {
          btn.onclick = function () {
            var tokenId = String(btn.getAttribute('data-turn-token') || '');
            if (!tokenId) return;
            store.setState({ selectedTokenId: tokenId });
            drawBoard();
            updateUiPanels();
          };
        });
      }
    }

    if (initRibbon) {
      var initRows = Array.isArray(state.initiative) ? state.initiative.slice() : [];
      var activeInitIdx = Math.max(0, Number(state.initiativeIndex || 0));
      var nextInitIdx = initRows.length ? ((activeInitIdx + 1) % initRows.length) : -1;
      initRibbon.innerHTML = initRows.map(function (row, idx) {
        var token = row ? byId(row.tokenId) : null;
        var held = !!(state.turnStates && state.turnStates[String(row.tokenId || '')] && state.turnStates[String(row.tokenId || '')].held);
        var delayed = !!(state.turnStates && state.turnStates[String(row.tokenId || '')] && state.turnStates[String(row.tokenId || '')].delayed);
        var cls = 'combat-turn-pill';
        if (idx === activeInitIdx) cls += ' active';
        else if (idx === nextInitIdx) cls += ' next';
        if (held) cls += ' held';
        if (delayed) cls += ' delayed';
        return '<button class="' + cls + '" data-turn-token="' + String(row && row.tokenId || '') + '" title="' + String(row && row.name || (token && token.name) || 'Token') + '">'
          + '<span>' + String((row && row.name) || (token && token.name) || 'Token').slice(0, 14) + '</span>'
          + (held ? '<small>H</small>' : (delayed ? '<small>D</small>' : ''))
          + '</button>';
      }).join('');
      Array.prototype.slice.call(initRibbon.querySelectorAll('[data-turn-token]')).forEach(function (btn) {
        btn.onclick = function () {
          var tokenId = String(btn.getAttribute('data-turn-token') || '');
          if (!tokenId) return;
          store.setState({ selectedTokenId: tokenId, selectedTokenIds: [tokenId] });
          drawBoard();
          updateUiPanels();
        };
      });
    }

    var nextPreview = document.getElementById('combatNextActorPreview');
    if (nextPreview) {
      var rows = Array.isArray(state.initiative) ? state.initiative : [];
      if (!rows.length) {
        nextPreview.textContent = 'Next: -';
      } else {
        var nextIdx = (Math.max(0, Number(state.initiativeIndex || 0)) + 1) % rows.length;
        var nextRow = rows[nextIdx] || null;
        nextPreview.textContent = 'Next: ' + String(nextRow && nextRow.name || 'Unknown');
      }
    }

    var log = document.getElementById('combatFeedLog');
    if (log) {
      var logRoundSel = document.getElementById('combatLogFilterRound');
      var logActorSel = document.getElementById('combatLogFilterActor');
      var logTypeSel = document.getElementById('combatLogFilterType');
      var filters = Object.assign({ round: 'all', actor: 'all', eventType: 'all' }, state.logFilters || {});
      var entries = Array.isArray(state.combatLog) ? state.combatLog.slice() : [];

      var rounds = ['all'].concat(Array.from(new Set(entries.map(function (entry) { return String(entry.round || '1'); }))));
      var actors = ['all'].concat(Array.from(new Set(entries.map(function (entry) { return String(entry.actorName || '').trim(); }).filter(Boolean))));
      var types = ['all'].concat(Array.from(new Set(entries.map(function (entry) { return String(entry.eventType || 'note'); }))));

      function setSelectOptions(select, values, prefix) {
        if (!select) return;
        var prior = String(select.value || 'all');
        select.innerHTML = values.map(function (value) {
          var label = value === 'all' ? (prefix + ': all') : value;
          return '<option value="' + value + '">' + label + '</option>';
        }).join('');
        select.value = values.indexOf(prior) >= 0 ? prior : 'all';
      }

      setSelectOptions(logRoundSel, rounds, 'Round');
      setSelectOptions(logActorSel, actors, 'Actor');
      setSelectOptions(logTypeSel, types, 'Type');

      function patchFilters(nextPatch) {
        store.setState(function (inner) {
          var next = Object.assign({}, inner);
          next.logFilters = Object.assign({ round: 'all', actor: 'all', eventType: 'all' }, inner.logFilters || {}, nextPatch || {});
          persist(next);
          return next;
        });
        updateUiPanels();
      }

      if (logRoundSel) logRoundSel.onchange = function () { patchFilters({ round: String(logRoundSel.value || 'all') }); };
      if (logActorSel) logActorSel.onchange = function () { patchFilters({ actor: String(logActorSel.value || 'all') }); };
      if (logTypeSel) logTypeSel.onchange = function () { patchFilters({ eventType: String(logTypeSel.value || 'all') }); };

      var filtered = entries.filter(function (entry) {
        if (!entry) return false;
        if (String(filters.round || 'all') !== 'all' && String(entry.round || '') !== String(filters.round)) return false;
        if (String(filters.actor || 'all') !== 'all' && String(entry.actorName || '') !== String(filters.actor)) return false;
        if (String(filters.eventType || 'all') !== 'all' && String(entry.eventType || '') !== String(filters.eventType)) return false;
        return true;
      }).slice(0, 40);

      log.innerHTML = filtered.map(function (entry) {
        var actor = String(entry.actorName || 'System');
        var target = String(entry.targetName || '');
        var roll = entry.roll && typeof entry.roll === 'object' ? (' · ' + String(entry.roll.formula || '') + ' = ' + Number(entry.roll.total || 0)) : '';
        var targetText = target ? (' -> ' + target) : '';
        var tagText = Array.isArray(entry.tags) && entry.tags.length ? (' [' + entry.tags.join(', ') + ']') : '';
        return '<button class="combat-feed-line combat-log-entry" data-log-focus="' + String(entry.focusTokenId || '') + '">'
          + '<strong>R' + Math.max(1, Number(entry.round || 1)) + '</strong> '
          + '<span style="color:var(--combat-accent-2);">' + actor + '</span> '
          + '<span>' + String(entry.action || entry.eventType || 'Note') + '</span>'
          + '<span>' + targetText + roll + '</span>'
          + '<span style="color:var(--combat-muted);">' + String(entry.result || entry.message || '') + tagText + '</span>'
          + '</button>';
      }).join('');

      Array.prototype.slice.call(log.querySelectorAll('[data-log-focus]')).forEach(function (btn) {
        btn.onclick = function () {
          var focusId = String(btn.getAttribute('data-log-focus') || '');
          if (!focusId) return;
          store.setState({ selectedTokenId: focusId, selectedTokenIds: [focusId] });
          drawBoard();
          updateUiPanels();
        };
      });
    }

    var selected = byId(state.selectedTokenId);
    var selectedSummary = document.getElementById('combatSelectedSummary');
    var selectedName = document.getElementById('combatSelectedName');
    var selectedDreadInput = document.getElementById('combatSelectedDread');
    var selectedHp = document.getElementById('combatSelectedHp');
    var selectedElevation = document.getElementById('combatSelectedElevation');
    var selectedScale = document.getElementById('combatSelectedScale');
    var selectedFreeform = document.getElementById('combatSelectedFreeform');
    var selectedVisionRadius = document.getElementById('combatSelectedVisionRadius');
    var selectedVisionShape = document.getElementById('combatSelectedVisionShape');
    var selectedAuraRadius = document.getElementById('combatSelectedAuraRadius');
    var selectedAuraColor = document.getElementById('combatSelectedAuraColor');
    var effectList = document.getElementById('combatTokenRoundEffectsList');
    if (selectedSummary) {
      var selectedDread = selected ? Math.max(4, Number(selected.dread || selected.codexDread || 0)) : 0;
      var selectedDeath = selected ? Math.max(1, Number(selected.deathNumber || selectedDread || 0)) : 0;
      var selectedActions = selected
        ? (selected.isPlayer
          ? Math.max(0, Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0))
          : Math.max(0, Number(state.teamActions && state.teamActions[selected.id] || 0)))
        : 0;
      var selectedThreat = selected && !selected.isPlayer && String(selected.faction || '') === 'monster' && selectedDread
        ? (' · DD d' + selectedDread + ' · DN ' + selectedDeath)
        : '';
      selectedSummary.textContent = selected
        ? (selected.name + ' · ' + selected.faction + ' · ' + selectedActions + 'A · hex ' + toKey(selected.q, selected.r) + selectedThreat)
        : 'Select a token.';
    }
    if (selectedHp) {
      selectedHp.value = selected ? Number(selected.hp || 0) : '';
    }
    if (selectedName) {
      selectedName.value = selected ? String(selected.name || '') : '';
    }
    if (selectedDreadInput) {
      selectedDreadInput.value = selected ? Math.max(1, Number(selected.dread || selected.codexDread || selected.deathNumber || 1)) : '';
    }
    if (selectedElevation) {
      selectedElevation.value = selected ? Number(state.layers.elevation[toKey(selected.q, selected.r)] || 0) : 0;
    }
    if (selectedScale) selectedScale.value = String(selected ? Math.round(Math.max(0.25, Math.min(2, Number(selected.scale || 1))) * 100) : 100);
    if (selectedFreeform) selectedFreeform.checked = !!(selected && selected.freeform);
    if (selectedVisionRadius) selectedVisionRadius.value = selected ? Math.max(0, Number(selected.visionRadius == null ? state.fog.visionRadius : selected.visionRadius)) : Number(state.fog && state.fog.visionRadius || 0);
    if (selectedVisionShape) selectedVisionShape.value = selected ? String(selected.visionShape || 'radius') : 'radius';
    if (selectedAuraRadius) selectedAuraRadius.value = selected ? Math.max(0, Number(selected.auraRadius || 0)) : 0;
    if (selectedAuraColor) selectedAuraColor.value = selected ? String(selected.auraColor || '#49c9bb') : '#49c9bb';
    if (effectList) {
      var effects = (state.tokenRoundEffects || []).filter(function (effect) {
        return effect && selected && String(effect.targetTokenId || '') === String(selected.id || '');
      });
      effectList.innerHTML = effects.length
        ? effects.map(function (effect) {
          var tone = String(effect.color || '#e3bc5e');
          return '<div class="combat-feed-line">'
            + '<strong style="display:inline-flex;align-items:center;gap:.35rem;"><span style="display:inline-block;width:.7rem;height:.7rem;border-radius:999px;background:' + tone + ';border:1px solid rgba(255,255,255,.25);"></span>' + String(effect.label || 'Condition') + '</strong>'
            + ' · Stress/Round: ' + Math.max(0, Number(effect.stressPerRound || 0))
            + ' · Rounds Left: ' + Math.max(0, Number(effect.roundsLeft || 0))
            + ' <button class="btn btn-xs" type="button" data-remove-round-effect="' + String(effect.id || '') + '">Clear</button>'
            + '</div>';
        }).join('')
        : '<div class="combat-feed-line">No active round conditions on selected token.</div>';
      Array.prototype.slice.call(effectList.querySelectorAll('[data-remove-round-effect]')).forEach(function (btn) {
        btn.onclick = function () {
          removeCombatRoundEffect(String(btn.getAttribute('data-remove-round-effect') || ''));
        };
      });
    }

    if (selectedScale) {
      selectedScale.oninput = function () {
        var nextScale = Math.max(0.25, Math.min(2, Number(selectedScale.value || 100) / 100));
        patchSelectedTokens({ scale: nextScale }, { ui: false });
      };
    }
    if (selectedFreeform) {
      selectedFreeform.onchange = function () {
        patchSelectedTokens(function (token) {
          return { freeform: !!selectedFreeform.checked, offsetX: selectedFreeform.checked ? Number(token.offsetX || 0) : 0, offsetY: selectedFreeform.checked ? Number(token.offsetY || 0) : 0 };
        });
      };
    }
    if (selectedVisionRadius) {
      selectedVisionRadius.onchange = function () {
        patchSelectedTokens({ visionRadius: Math.max(0, Math.min(12, Number(selectedVisionRadius.value || 0))) });
      };
    }
    if (selectedVisionShape) {
      selectedVisionShape.onchange = function () {
        patchSelectedTokens({ visionShape: String(selectedVisionShape.value || 'radius') });
      };
    }
    if (selectedAuraRadius) {
      selectedAuraRadius.onchange = function () {
        patchSelectedTokens({ auraRadius: Math.max(0, Math.min(12, Number(selectedAuraRadius.value || 0))) });
      };
    }
    if (selectedAuraColor) {
      selectedAuraColor.oninput = function () {
        patchSelectedTokens({ auraColor: String(selectedAuraColor.value || '#49c9bb') }, { ui: false });
      };
    }

    var weatherSelect = document.getElementById('combatWeatherSelect');
    var weatherIntensity = document.getElementById('combatWeatherIntensity');
    if (weatherSelect) weatherSelect.value = String(state.board.weatherOverlay || 'none');
    if (weatherIntensity) weatherIntensity.value = Number(state.board.weatherIntensity || 0);

    var ruler = document.getElementById('combatRulerSummary');
    if (ruler) {
      var focusEnemy = null;
      try {
        if (typeof window.getPrimaryCombatEnemy === 'function') focusEnemy = window.getPrimaryCombatEnemy();
      } catch (_err) {}
      var rel = '';
      try {
        if (typeof window.getPrimaryEnemyZoneRelative === 'function') rel = String(window.getPrimaryEnemyZoneRelative() || '');
      } catch (_err) {}
      var relLabel = rel ? (rel.charAt(0).toUpperCase() + rel.slice(1)) : 'Unknown';
      var actionsLeft = (window.S && window.S.combat) ? Math.max(0, Number(window.S.combat.actionsLeft || 0)) : 0;
      var selectedPlayer = (state.tokens || []).find(function (t) { return t && t.isPlayer; }) || (state.tokens || []).find(function (t) { return t && String(t.faction) === 'player'; }) || null;
      var focusedToken = null;
      if (focusEnemy) {
        focusedToken = (state.tokens || []).find(function (t) {
          return t && String(t.faction) === 'monster' && (
            Number(t.sourceEnemyId || 0) === Number(focusEnemy.id || 0)
            || String(t.name || '') === String(focusEnemy.name || '')
          );
        }) || null;
      }
      var hexBand = '';
      if (selectedPlayer && focusedToken) {
        var hexDist = hexDistance({ q: selectedPlayer.q, r: selectedPlayer.r }, { q: focusedToken.q, r: focusedToken.r });
        hexBand = hexLabel(hexDist) + ' (' + hexDist + ' hex' + (hexDist === 1 ? '' : 'es') + ')';
      }
      if (focusEnemy) {
        ruler.textContent = String(focusEnemy.name || 'Focused Enemy') + ' · ' + (hexBand || relLabel) + ' · Actions Left ' + actionsLeft;
      } else if (state.spellPreview && state.spellPreview.active) {
        var spellPreview = normalizeCombatSpellPreview(state.spellPreview);
        ruler.textContent = spellPreview.spellLabel + ' · ' + spellPreview.distance + '/' + spellPreview.rangeLimit + ' hexes · ' + (spellPreview.isValid ? 'Ready to Cast' : spellPreview.reason);
      } else if (state.ruler && state.ruler.distance) {
        ruler.textContent = state.ruler.distance + ' Hexes · ' + state.ruler.label;
      } else {
        ruler.textContent = 'Select/focus an enemy to sync Cinematic Distance.';
      }
    }

    var rollBtn = document.getElementById('combatRollModeBtn');
    if (rollBtn) rollBtn.textContent = state.autoRoll ? 'Auto Roll' : 'Manual Roll';

    var activeEntry = state.initiative && state.initiative[state.initiativeIndex] || null;
    var activeTokenId = String(activeEntry && activeEntry.tokenId || '');
    var activeToken = activeTokenId ? (state.tokens || []).find(function (token) {
      return token && String(token.id) === activeTokenId;
    }) : null;
    var playerTurn = !!(activeToken && (activeToken.isPlayer || String(activeToken.faction) === 'player'));

    var syncBadge = document.getElementById('combatSharedSyncBadge');
    if (syncBadge) {
      var badgeText = 'Sync Local';
      var badgeClass = 'sync-aging';
      if (window.campaignSystem && typeof window.campaignSystem.getSyncStatus === 'function') {
        var syncStatus = null;
        var sharedState = null;
        try { syncStatus = window.campaignSystem.getSyncStatus(); } catch (_err) { syncStatus = null; }
        try { sharedState = typeof window.campaignSystem.getSharedState === 'function' ? window.campaignSystem.getSharedState() : null; } catch (_err2) { sharedState = null; }
        var version = Math.max(0, Number(syncStatus && syncStatus.sharedVersion || 0));
        var sceneMeta = sharedState && sharedState.combatScene && sharedState.combatScene.syncMeta && typeof sharedState.combatScene.syncMeta === 'object'
          ? sharedState.combatScene.syncMeta
          : (window.S && window.S.combat && window.S.combat.sceneSyncMeta && typeof window.S.combat.sceneSyncMeta === 'object' ? window.S.combat.sceneSyncMeta : null);
        var by = sceneMeta && sceneMeta.by ? String(sceneMeta.by) : '-';
        var at = Number(sceneMeta && sceneMeta.at || 0);
        var ageSec = at ? Math.max(0, Math.floor((Date.now() - at) / 1000)) : 0;
        var freshness = at ? (ageSec <= 12 ? 'fresh' : (ageSec <= 30 ? 'aging' : 'stale')) : 'unknown';
        badgeText = 'Sync v' + version + ' · ' + by + ' · ' + formatClockTime(at) + ' · ' + freshness;
        badgeClass = freshness === 'fresh' ? 'sync-fresh' : (freshness === 'stale' ? 'sync-stale' : 'sync-aging');
      } else {
        badgeClass = 'sync-aging';
      }
      syncBadge.textContent = badgeText;
      syncBadge.className = badgeClass;
    }

    var startSceneBtn = document.getElementById('combatStartSceneBtn');
    if (startSceneBtn) {
      var sceneActive = !!(window.S && window.S.combat && window.S.combat.active);
      startSceneBtn.textContent = sceneActive ? 'Scene Active' : 'Start Scene';
      startSceneBtn.disabled = sceneActive;
      startSceneBtn.style.opacity = sceneActive ? '0.55' : '1';
    }

    var statusGrid = document.getElementById('combatSceneStatusGrid');
    if (statusGrid) {
      var playerActionsNow = Math.max(0, Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0));
      var playerActionsMax = Math.max(playerActionsNow, Number(window.S && window.S.combat && window.S.combat.maxActions || 3));
      var hpSnap = getWayfarerHealthSnapshot();
      var hpNow = hpSnap.remaining;
      var hpMax = hpSnap.max;
      var tmwNow = Math.max(0, Number(window.S && window.S.tmw || 0));
      var alliesCount = (state.tokens || []).filter(function (token) { return token && String(token.faction) === 'player' && !token.isPlayer; }).length;
      var enemiesCount = (state.tokens || []).filter(function (token) { return token && String(token.faction) === 'monster'; }).length;
      var activeEntryNow = state.initiative && state.initiative[state.initiativeIndex] || null;
      var activeTokenNow = activeEntryNow ? byId(activeEntryNow.tokenId) : null;
      var enemyPool = activeTokenNow && String(activeTokenNow.faction) === 'monster'
        ? Math.max(0, Number(state.teamActions && state.teamActions[activeTokenNow.id] || 0))
        : Math.max(0, enemiesCount ? 1 : 0);
      var enemyPoolMax = activeTokenNow && String(activeTokenNow.faction) === 'monster'
        ? Math.max(1, Number(activeTokenNow.actionsPerTurn || activeTokenNow.maxActions || 2))
        : Math.max(1, enemiesCount ? 2 : 1);
      var dreadDie = Math.max(4, Number(window.S && window.S.combat && window.S.combat.enemyDread || 8));
      var sceneLabel = (window.S && window.S.combat && window.S.combat.active) ? ('Round ' + Math.max(1, Number(window.S.combat.round || state.round || 1))) : 'Scene Not Started';
      statusGrid.innerHTML = ''
        + '<div class="combat-feed-line">Your Actions: <strong style="color:var(--combat-accent-2);">' + playerActionsNow + '/' + playerActionsMax + '</strong></div>'
        + '<div class="combat-feed-line">Health: <strong style="color:var(--combat-accent-2);">' + hpNow + '/' + hpMax + '</strong></div>'
        + '<div class="combat-feed-line">TMW: <strong style="color:var(--combat-accent-2);">' + tmwNow + '</strong></div>'
        + '<div class="combat-feed-line">Ally Actions: <strong style="color:var(--combat-accent-2);">' + alliesCount + '</strong></div>'
        + '<div class="combat-feed-line">Enemy Actions: <strong style="color:var(--combat-accent-2);">' + enemyPool + '/' + enemyPoolMax + '</strong></div>'
        + '<div class="combat-feed-line">Dread: <strong style="color:var(--combat-accent-2);">d' + dreadDie + '</strong></div>'
        + '<div class="combat-feed-line">' + sceneLabel + '</div>';
    }

    var tokenSheetMirror = document.getElementById('combatTokenSheetMirror');
    if (tokenSheetMirror) {
      if (!selected) {
        tokenSheetMirror.textContent = 'Select a token to load Character Sheet context.';
      } else if (selected.isPlayer || String(selected.faction) === 'player') {
        tokenSheetMirror.innerHTML = buildCharacterSheetCombatSummary(selected.id).map(function (line) {
          return '<div class="combat-feed-line">' + String(line) + '</div>';
        }).join('');
      } else {
        tokenSheetMirror.innerHTML = ''
          + '<div class="combat-feed-line">Combatant Name: ' + String(selected.name || 'Enemy') + '</div>'
          + '<div class="combat-feed-line">Dread Die: d' + Math.max(4, Number(selected.dread || selected.codexDread || 6)) + '</div>'
          + '<div class="combat-feed-line">Health: ' + Math.max(0, Number(selected.hp || 0)) + '/' + Math.max(1, Number(selected.maxHp || selected.hp || 1)) + '</div>';
      }
      // Append unique monster skills if available
      var enemyProfile = getEnemyProfileForToken(selected);
      if (!enemyProfile && selected && selected.name) {
        // fallback: search NAMED_ENEMY_BESTIARY directly
        var allBest = typeof window.NAMED_ENEMY_BESTIARY !== 'undefined' ? window.NAMED_ENEMY_BESTIARY : null;
        if (allBest) {
          Object.keys(allBest).some(function (k) {
            var found = (allBest[k] || []).find(function (e) { return e && String(e.name).toLowerCase() === String(selected.name).toLowerCase(); });
            if (found) { enemyProfile = found; return true; }
            return false;
          });
        }
      }
      if (selected && !selected.isPlayer && String(selected.faction) !== 'player') {
        var normalizedSkills = getEnemySkillsForToken(selected);
        if (normalizedSkills.length) {
        var tknSheetState = store.getState();
        var actorForDist = byId(tknSheetState.selectedTokenId) || (tknSheetState.tokens || []).find(function (t) { return t && (t.isPlayer || String(t.faction) === 'player'); });
        var distToActor = actorForDist ? hexDistance({ q: selected.q, r: selected.r }, { q: actorForDist.q, r: actorForDist.r }) : 999;
        var HEX_RANGE_MAP = { 'engaged': 1, 'close': 2, 'nearby': 4, 'far': 99 };
        var skillLines = normalizedSkills.map(function (sk) {
          var maxSkillRange = asEnemySkillRangeArray(sk).reduce(function (max, r) { return Math.max(max, HEX_RANGE_MAP[r] || 1); }, 0);
          var inRange = distToActor <= maxSkillRange;
          return '<div class="combat-feed-line" style="color:' + (inRange ? 'var(--accent-2)' : 'var(--muted2)') + ';">'
            + '⚡ ' + String(sk.name) + ' [1 Action · ' + asEnemySkillRangeArray(sk).join('/') + '] — ' + (inRange ? '✓ In Range' : '✗ Out of range')
            + '</div>'
            + '<div class="combat-feed-line" style="font-size:.72rem;color:var(--muted2);padding-left:.5rem;">' + String(sk.desc) + ' · On fail: ' + String(sk.onFail) + '</div>';
        }).join('');
        tokenSheetMirror.innerHTML += '<div style="margin-top:.3rem;border-top:1px solid var(--border2);padding-top:.25rem;">' + skillLines + '</div>';
        }
      }
    }

    var tokenTargetSel = document.getElementById('combatTokenTargetSel');
    var tokenActionSel = document.getElementById('combatTokenActionSel');
    var tokenCoverSel = document.getElementById('combatTargetCoverOverrideSel');
    var generateLootBtn = document.getElementById('combatGenerateLootBtn');
    var lootBodyBtn = document.getElementById('combatLootBodyBtn');
    var tokenActionHelp = document.getElementById('combatTokenActionHelp');
    if (tokenTargetSel) {
      var actorToken = byId(state.selectedTokenId);
      var hostiles = actorToken ? (state.tokens || []).filter(function (token) {
        return token && String(token.id) !== String(actorToken.id) && String(token.faction) !== String(actorToken.faction);
      }) : [];
      hostiles.sort(function (a, b) {
        return hexDistance({ q: actorToken && actorToken.q || 0, r: actorToken && actorToken.r || 0 }, { q: a.q, r: a.r }) - hexDistance({ q: actorToken && actorToken.q || 0, r: actorToken && actorToken.r || 0 }, { q: b.q, r: b.r });
      });
      var prevTarget = String(tokenTargetSel.value || '');
      tokenTargetSel.innerHTML = hostiles.length
        ? hostiles.map(function (t) {
          var dist = actorToken ? hexDistance({ q: actorToken.q, r: actorToken.r }, { q: t.q, r: t.r }) : 0;
          return '<option value="' + String(t.id) + '">' + String(t.name || 'Hostile') + ' · ' + hexLabel(dist) + ' (' + dist + 'h)</option>';
        }).join('')
        : '<option value="">Closest hostile</option>';
      var exists = Array.prototype.slice.call(tokenTargetSel.options || []).some(function (opt) { return String(opt.value || '') === prevTarget; });
      if (exists) tokenTargetSel.value = prevTarget;
      if (!tokenTargetSel._bound) {
        tokenTargetSel._bound = true;
        tokenTargetSel.onchange = function () {
          var actorNow = byId(store.getState().selectedTokenId);
          var targetNow = byId(String(tokenTargetSel.value || ''));
          if (actorNow && targetNow && (actorNow.isPlayer || String(actorNow.faction) === 'player') && typeof window.setCombatSpacing === 'function') {
            var dist = hexDistance({ q: actorNow.q, r: actorNow.r }, { q: targetNow.q, r: targetNow.r });
            var spacingLabel = dist <= 1
              ? 'Engaged (Strike)'
              : (dist <= 2 ? 'Close (Scrolls)' : (dist <= 4 ? 'Nearby (Shoot)' : 'Far (Out of Range)'));
            try { window.setCombatSpacing(spacingLabel, false); } catch (_spacingErr) {}
          }
          try {
            if (typeof window.updateWayfarerActionBtn === 'function') window.updateWayfarerActionBtn();
          } catch (_actionErr) {}
          updateUiPanels();
        };
      }
    }
    if (tokenCoverSel) {
      var targetId = String(tokenTargetSel && tokenTargetSel.value || '');
      var overrides = state.sceneRules && state.sceneRules.targetCoverOverrides && typeof state.sceneRules.targetCoverOverrides === 'object'
        ? state.sceneRules.targetCoverOverrides
        : {};
      tokenCoverSel.value = targetId ? String(overrides[targetId] || 'auto') : 'auto';
      tokenCoverSel.disabled = !targetId;
    }
    if (tokenActionSel) {
      var mirroredSel = document.getElementById('wayfarerActionSel');
      var actor = byId(state.selectedTokenId);
      var selectedTarget = String(tokenTargetSel && tokenTargetSel.value || '') ? byId(String(tokenTargetSel.value || '')) : null;
      var previous = String(tokenActionSel.value || '');
      if (actor && (actor.isPlayer || String(actor.faction) === 'player') && mirroredSel) {
        if (selectedTarget && typeof window.setCombatSpacing === 'function') {
          var targetDist = hexDistance({ q: actor.q, r: actor.r }, { q: selectedTarget.q, r: selectedTarget.r });
          var targetSpacingLabel = targetDist <= 1
            ? 'Engaged (Strike)'
            : (targetDist <= 2 ? 'Close (Scrolls)' : (targetDist <= 4 ? 'Nearby (Shoot)' : 'Far (Out of Range)'));
          try { window.setCombatSpacing(targetSpacingLabel, false); } catch (_spacingSyncErr) {}
        }
        try {
          if (typeof window.updateWayfarerActionBtn === 'function') window.updateWayfarerActionBtn();
        } catch (_mirrorErr) {}
        var mirroredOptions = Array.prototype.slice.call(mirroredSel.options || []).filter(function (opt) {
          if (!opt || !String(opt.value || '')) return false;
          if (!selectedTarget) return true;
          var actionValue = String(opt.value || '');
          var range = hexDistance({ q: actor.q, r: actor.r }, { q: selectedTarget.q, r: selectedTarget.r });
          return canActionReachTarget(actionValue, range);
        });
        if (!mirroredOptions.length) mirroredOptions = Array.prototype.slice.call(mirroredSel.options || []);
        tokenActionSel.innerHTML = mirroredOptions.map(function (opt) {
          var val = String(opt.value || '');
          return '<option value="' + val + '">' + String(opt.textContent || '') + '</option>';
        }).join('');
      } else if (actor && String(actor.faction) === 'monster') {
        var targetForSkills = String(tokenTargetSel && tokenTargetSel.value || '') ? byId(String(tokenTargetSel.value || '')) : null;
        var skillOpts = getEnemySkillOptionsForToken(actor, targetForSkills);
        var baseOpt = '<option value="enemy_action">Basic Enemy Action</option>';
        var visibleSkills = skillOpts.filter(function (entry) { return !!entry.inRange; });
        var extra = (visibleSkills.length ? visibleSkills : skillOpts).map(function (entry) {
          var suffix = entry.inRange ? ' \u00b7 In Range' : ' \u00b7 Out of Range';
          return '<option value="' + entry.id + '">' + entry.name + ' [1 Action · ' + entry.rangeLabel + ']' + suffix + '</option>';
        }).join('');
        tokenActionSel.innerHTML = baseOpt + extra;
      } else {
        tokenActionSel.innerHTML = '<option value="">Choose action</option>';
      }
      var stillExists = Array.prototype.slice.call(tokenActionSel.options || []).some(function (opt) { return String(opt.value || '') === previous; });
      if (stillExists) tokenActionSel.value = previous;
      if (!tokenActionSel._bound) {
        tokenActionSel._bound = true;
        tokenActionSel.onchange = function () { updateUiPanels(); };
      }
    }
    if (generateLootBtn) {
      var selectedLootToken = byId(state.selectedTokenId);
      var canLootGen = !!(selectedLootToken && !selectedLootToken.isPlayer && String(selectedLootToken.faction || '') !== 'player');
      var personalLootCount = canLootGen && Array.isArray(selectedLootToken.inventory) ? selectedLootToken.inventory.filter(Boolean).length : 0;
      generateLootBtn.style.display = '';
      generateLootBtn.disabled = !canLootGen;
      generateLootBtn.textContent = personalLootCount > 0 ? 'Reroll Loot' : 'Generate Loot';
      generateLootBtn.title = !canLootGen
        ? 'Select an enemy/NPC token first.'
        : (personalLootCount > 0 ? 'Replace this token\'s personal loot roll.' : 'Generate personal loot for this token.');
      generateLootBtn.style.opacity = canLootGen ? '1' : '0.45';
    }
    if (tokenActionHelp) {
      var selectedTargetId = String(tokenTargetSel && tokenTargetSel.value || '');
      var actorNow = byId(state.selectedTokenId);
      var targetNow = selectedTargetId ? byId(selectedTargetId) : null;
      var selectedAction = String(tokenActionSel && tokenActionSel.value || '');
      var selectedCoverOverride = String(tokenCoverSel && tokenCoverSel.value || 'auto');
      if (actorNow && String(actorNow.faction) === 'monster') {
        var targetForEnemy = selectedTargetId ? byId(selectedTargetId) : null;
        var skillState = getEnemySkillOptionsForToken(actorNow, targetForEnemy);
        var enemyProfileForHelp = getEnemyProfileForToken(actorNow);
        var tacticText = enemyProfileForHelp && enemyProfileForHelp.tactic ? String(enemyProfileForHelp.tactic) : '';
        var chosen = null;
        if (selectedAction.indexOf('enemy_skill:') === 0) {
          var chosenIdx = Number(selectedAction.split(':')[1]);
          chosen = skillState.find(function (s) { return Number(s.idx) === chosenIdx; }) || null;
        }
        if (chosen && chosen.skill) {
          tokenActionHelp.innerHTML = enemySkillCardHtml(
            chosen,
            actorNow.name,
            Math.max(4, Number(actorNow.dread || actorNow.codexDread || 6)),
            targetForEnemy && targetForEnemy.name || 'Target',
            tacticText
          );
        } else if (skillState.length) {
          var inRangeSkills = skillState.filter(function (s) { return s.inRange; });
          var preview = (inRangeSkills.length ? inRangeSkills : skillState).slice(0, 3).map(function (entry) {
            return enemySkillCardHtml(
              entry,
              actorNow.name,
              Math.max(4, Number(actorNow.dread || actorNow.codexDread || 6)),
              targetForEnemy && targetForEnemy.name || 'Target',
              ''
            );
          }).join('');
          tokenActionHelp.innerHTML = '<div style="font-size:.74rem;color:var(--muted2);margin-bottom:.15rem;">Enemy skills in range: ' + inRangeSkills.length + '/' + skillState.length + ' (select one in Token Action).</div>' + preview;
        } else {
          tokenActionHelp.textContent = 'No unique enemy skills found. Uses Basic Enemy Action (Dread vs Defend).';
        }
      } else if (actorNow && targetNow && selectedAction) {
        var distNow = hexDistance({ q: actorNow.q, r: actorNow.r }, { q: targetNow.q, r: targetNow.r });
        var reachable = canActionReachTarget(selectedAction, distNow);
        tokenActionHelp.textContent = 'Target ' + String(targetNow.name || 'Enemy') + ' · ' + hexLabel(distNow) + ' (' + distNow + 'h) · Cover override: ' + selectedCoverOverride + ' · ' + (reachable ? 'In range' : 'Out of range for this action') + '.';
      } else if (actorNow && (actorNow.isPlayer || String(actorNow.faction) === 'player')) {
        var actionCtxLines = [];
        var selAct = String(tokenActionSel && tokenActionSel.value || '');
        var equip2 = window.S && window.S.equipment ? window.S.equipment : {};
        var defendAdvNow = parseDefendAdvantageCount();
        var defendArmorDiceNow = parseArmorDefendAdvDice();
        var defendFlatNow = parseArmorDefendFlatBonus() + parseAffixDefendFlatBonus();
        var defendBitsNow = [];
        if (defendAdvNow > 0) defendBitsNow.push('+' + defendAdvNow + ' AD');
        if (defendArmorDiceNow.length) defendBitsNow.push('Armor AD ' + defendArmorDiceNow.map(function (die) { return 'd' + die; }).join(', '));
        actionCtxLines.push('Defend from armor/affixes: ' + (defendFlatNow >= 0 ? '+' : '') + defendFlatNow + ' flat' + (defendBitsNow.length ? (' · ' + defendBitsNow.join(' · ')) : ''));
        if (selAct.indexOf('personal_flavor') >= 0 || selAct.indexOf('flavor') >= 0) {
          var flavorList = [];
          if (window.S && Array.isArray(window.S.personalFlavors)) {
            window.S.personalFlavors.forEach(function (entry) {
              var text = String(entry || '').trim();
              if (text && flavorList.indexOf(text) < 0) flavorList.push(text);
            });
          }
          var activeFlavor = String(window.S && window.S.flavor || '').trim();
          if (activeFlavor && flavorList.indexOf(activeFlavor) < 0) flavorList.push(activeFlavor);
          actionCtxLines.push('Personal Flavor options: ' + (flavorList.length ? flavorList.map(function (entry) { return String(entry).split(':')[0].trim(); }).join(', ') : 'None selected'));
        } else if (selAct.indexOf('use_item') >= 0 || selAct.indexOf('item') >= 0 || selAct.indexOf('hack') >= 0 || selAct.indexOf('spell') >= 0) {
          var w1c = String(equip2.weapon1 || '').trim();
          var w2c = String(equip2.weapon2 || '').trim();
          var arc = String(equip2.armor || '').trim();
          actionCtxLines.push('Equipped — Weapon: ' + (w1c || 'None') + (w2c ? ' · Off-hand: ' + w2c : '') + ' · Armor: ' + (arc || 'None'));
          var items2 = window.S && window.S.items ? window.S.items : (window.S && window.S.backpack ? window.S.backpack : null);
          if (items2 && Array.isArray(items2) && items2.length) {
            actionCtxLines.push('Backpack: ' + items2.slice(0, 3).map(function (it) { return String(it && (it.name || it) || ''); }).filter(Boolean).join(', ') + (items2.length > 3 ? ' +more' : ''));
          }
          var hacks2 = window.S && Array.isArray(window.S.ownedHacks) ? window.S.ownedHacks.filter(Boolean) : [];
          if (hacks2.length) actionCtxLines.push('Hacks: ' + hacks2.slice(0, 4).join(', ') + (hacks2.length > 4 ? ' +more' : ''));
          var aug2 = window.S && Array.isArray(window.S.augmentations) ? window.S.augmentations.filter(Boolean) : [];
          if (aug2.length) actionCtxLines.push('Augmentations: ' + aug2.slice(0, 4).join(', ') + (aug2.length > 4 ? ' +more' : ''));
          var mods2 = window.S && Array.isArray(window.S.weaponMods) ? window.S.weaponMods.filter(Boolean) : [];
          if (mods2.length) actionCtxLines.push('Weapon Mods: ' + mods2.slice(0, 4).join(', ') + (mods2.length > 4 ? ' +more' : ''));
        } else {
          actionCtxLines.push('Quick Actions: choose target + action, then Execute.');
        }
        tokenActionHelp.textContent = actionCtxLines.join(' | ');
      } else {
        tokenActionHelp.textContent = 'No combat roll yet.';
      }
    }

    if (lootBodyBtn) {
      var selToken = byId(state.selectedTokenId);
      var selDrop = selToken ? getLootDropForToken(state, selToken.id) : null;
      var playerTokForLoot = (state.tokens || []).find(function (t) { return t && t.isPlayer; }) || null;
      var lootProxOk = !selToken || !playerTokForLoot ||
        hexDistance({ q: Number(playerTokForLoot.q || 0), r: Number(playerTokForLoot.r || 0) }, { q: Number(selToken.q || 0), r: Number(selToken.r || 0) }) <= 1;
      var lootAvail = !!(selToken && isTokenDead(selToken));
      lootBodyBtn.disabled = !(lootAvail && lootProxOk);
      lootBodyBtn.style.opacity = lootBodyBtn.disabled ? '0.45' : '1';
      lootBodyBtn.title = !lootAvail ? '' : !lootProxOk ? 'Move within 1 hex to loot this body' : 'Loot body';
    }
    var recoverySlotSel = document.getElementById('combatRecoverySlotSel');
    if (recoverySlotSel) {
      var stack = loadRecoveryStack();
      var prevVal = String(recoverySlotSel.value || '');
      if (!stack.length) {
        recoverySlotSel.innerHTML = '<option value="">No autosaves</option>';
        recoverySlotSel.disabled = true;
      } else {
        recoverySlotSel.disabled = false;
        recoverySlotSel.innerHTML = stack.map(function (entry, idx) {
          var slotNumber = idx + 1;
          var stamp = formatClockTime(Number(entry && entry.at || 0));
          return '<option value="' + idx + '">Snapshot #' + slotNumber + ' · ' + stamp + '</option>';
        }).join('');
        var stillExists2 = Array.prototype.slice.call(recoverySlotSel.options || []).some(function (opt) { return String(opt.value || '') === prevVal; });
        recoverySlotSel.value = stillExists2 ? prevVal : String(Math.max(0, stack.length - 1));
      }
    }

    var opener = document.getElementById('combatSceneOpenerSummary');
    if (opener) {
      var so = window.S && window.S.combat && window.S.combat.sceneOpener ? window.S.combat.sceneOpener : null;
      if (!so) {
        var csState = store.getState();
        var activeScId = csState && csState.activeSceneId;
        var activeScn = activeScId && Array.isArray(csState.scenes) ? csState.scenes.find(function (sc) { return sc && sc.id === activeScId; }) : null;
        if (activeScn && activeScn.sceneOpener) so = activeScn.sceneOpener;
      }
      if (so) {
        var zone = String(so.zone || so.zoneTerrain || so.terrain || 'Unknown');
        var cover = String(so.cover || so.coverDesc || so.coverTier || 'none');
        var react = String(so.enemyReaction || so.reaction || so.enemyIntent || 'Unknown');
        var activity = String(so.enemyActivity || so.activity || so.enemyMove || 'Unknown');
        opener.textContent = '🎬 ' + zone + ' · ' + cover + ' · ' + react + ' · ' + activity;
      } else {
        opener.textContent = 'No opener active.';
      }
    }

    var rulesTable = document.getElementById('combatWayfarerRulesTable');
    if (rulesTable && !rulesTable._seeded) {
      rulesTable._seeded = true;
      rulesTable.innerHTML = ''
        + '<table class="combat-rule-table"><thead><tr><th>Action</th><th>Cost</th><th>Effect</th></tr></thead><tbody>'
        + '<tr><td>Flourish</td><td>1</td><td>+1 Strike this turn.</td></tr>'
        + '<tr><td>Bandage</td><td>1</td><td>-1 Stress from target ally.</td></tr>'
        + '<tr><td>Reposition</td><td>1</td><td>Move ally and grant +1 Defend until next turn.</td></tr>'
        + '<tr><td>Break Grapple</td><td>1</td><td>Auto-disengage from grappled state.</td></tr>'
        + '<tr><td>Improvise Tool</td><td>1</td><td>Single-use +2 on item/flavor prompt.</td></tr>'
        + '<tr><td>Patch Cover</td><td>1</td><td>Repair one local cover segment.</td></tr>'
        + '</tbody></table>';
    }

    var aoeRulesMeta = document.getElementById('combatAoeRulesMeta');
    if (aoeRulesMeta) {
      aoeRulesMeta.textContent = 'Hard-locked values: Enter/Stay saves apply per active AoE zone.';
    }
    var aoeRulesTable = document.getElementById('combatAoeRulesTable');
    if (aoeRulesTable) {
      aoeRulesTable.innerHTML = buildEnemyAoeRulesTableHtml();
    }

    var mirror = document.getElementById('combatLegacyResultMirror');
    if (mirror) {
      var ids = ['attackResult', 'defendResult', 'traumaResult', 'enemyActionResult', 'wayfarerActionResult'];
      var text = '';
      for (var ii = 0; ii < ids.length; ii++) {
        var node = document.getElementById(ids[ii]);
        var raw = node ? stripHtml(node.textContent || node.innerText || '') : '';
        if (raw) { text = raw; break; }
      }
      mirror.textContent = text || 'Legacy combat output mirrors here.';
    }

    var statusMirror = document.getElementById('combatLegacyStatusMirror');
    if (statusMirror) {
      var statusText = stripHtml((document.getElementById('combatStatus') || {}).textContent || '');
      var actionHint = stripHtml((document.getElementById('maxActionsHint') || {}).textContent || '');
      statusMirror.textContent = (statusText || 'Status bridge idle.') + (actionHint ? (' ' + actionHint) : '');
    }

    var rollMirror = document.getElementById('combatLegacyRollModMirror');
    if (rollMirror) {
      var rollText = stripHtml((document.getElementById('rollModDisplay-combat') || {}).textContent || '');
      rollMirror.textContent = rollText ? ('Roll modifiers: ' + rollText) : 'Roll modifiers: none.';
    }

    var actionInfoMirror = document.getElementById('combatLegacyActionInfoMirror');
    if (actionInfoMirror) {
      var actionInfo = stripHtml((document.getElementById('wayfarerActionInfo') || {}).textContent || '');
      var distanceInfo = '';
      try {
        if (typeof window.getPrimaryEnemyZoneRelative === 'function') {
          var d = String(window.getPrimaryEnemyZoneRelative() || '');
          if (d) distanceInfo = 'Distance: ' + d.charAt(0).toUpperCase() + d.slice(1) + '.';
        }
      } catch (_err) {}
      var strikeShootRule = 'Strike: Engaged unless modifiers. Shoot: Nearby unless weapon/modifier/flavor overrides.';
      actionInfoMirror.textContent = (distanceInfo ? (distanceInfo + ' ') : '') + (actionInfo || 'Wayfarer action details appear here.') + ' ' + strikeShootRule;
    }

    var flavorMirror = document.getElementById('combatLegacyFlavorMirror');
    if (flavorMirror) {
      var flavorSource = document.getElementById('flavorPassiveCombatIndicator');
      if (flavorSource && String(flavorSource.style.display || '') !== 'none' && String(flavorSource.innerHTML || '').trim()) {
        flavorMirror.innerHTML = String(flavorSource.innerHTML || '');
      } else {
        flavorMirror.textContent = '';
      }
    }

    var rowsMirror = document.getElementById('combatLegacyRowsMirror');
    if (rowsMirror) {
      var rowMap = [
        { id: 'attackResult', label: 'Strike/Shoot' },
        { id: 'defendResult', label: 'Defend' },
        { id: 'traumaResult', label: 'Trauma' },
        { id: 'enemyActionResult', label: 'Enemy Action' },
        { id: 'wayfarerActionResult', label: 'Wayfarer Action' },
        { id: 'fleeResult', label: 'Escape/Morale' }
      ];
      var rowsHtml = rowMap.map(function (entry) {
        var node = document.getElementById(entry.id);
        var value = stripHtml(node ? (node.textContent || node.innerText || '') : '');
        if (!value) return '';
        return '<div class="combat-feed-line"><strong style="color:var(--combat-accent);">' + entry.label + ':</strong> ' + value + '</div>';
      }).filter(Boolean).join('');
      rowsMirror.innerHTML = rowsHtml || '<div class="combat-feed-line">No recent roll outputs yet.</div>';
    }

  }

  function bindCanvas() {
    var canvas = document.getElementById('combatSceneCanvas');
    if (!canvas || canvas._boundCombatEditor) return;
    canvas._boundCombatEditor = true;
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Combat map canvas. Use Tab to cycle tokens and arrow keys to move selected token.');
    canvas.style.touchAction = 'none';
    var pingHoldTimer = null;
    var touchGesture = { active: false, panX: 0, panY: 0, centerX: 0, centerY: 0, distance: 0, zoom: 1 };
    var touchTapState = { active: false, moved: false, startedAt: 0, x: 0, y: 0 };

    if (!window.__combatResizeAdaptiveBound) {
      window.__combatResizeAdaptiveBound = true;
      window.addEventListener('resize', function () {
        applyCombatUiState(store.getState());
        drawBoard();
      });
    }

    function clearPingHold() {
      if (pingHoldTimer) {
        clearTimeout(pingHoldTimer);
        pingHoldTimer = null;
      }
    }

    var inlineInput = document.getElementById('combatBubbleInlineInput');
    if (inlineInput && !inlineInput._bound) {
      inlineInput._bound = true;
      inlineInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          hideInlineBubbleEditor(true);
          ev.preventDefault();
        } else if (ev.key === 'Escape') {
          hideInlineBubbleEditor(false);
          ev.preventDefault();
        }
      });
      inlineInput.addEventListener('blur', function () {
        hideInlineBubbleEditor(true);
      });
    }

    var paintDragActive = false;
    var paintDragLastKey = '';

    canvas.addEventListener('mousedown', function (ev) {
      var state = store.getState();
      var rect = canvas.getBoundingClientRect();
      var board = state.board;
      var size = Number(board.size || 42) * Number(board.zoom || 1);
      var canvasX = ev.clientX - rect.left;
      var canvasY = ev.clientY - rect.top;
      var ax = pixelToAxial(canvasX, canvasY, size, board.panX, board.panY);
      lastCombatBoardHex = { q: Number(ax.q || 0), r: Number(ax.r || 0), at: Date.now() };
      if (ev.button === 2) {
        return;
      }
      hideTokenContextMenu();
      var lootCard = document.getElementById('combatLootPopupCard');
      if (lootCard && lootCard.style.display !== 'none') {
        var cardRect = lootCard.getBoundingClientRect();
        var inCard = ev.clientX >= cardRect.left && ev.clientX <= cardRect.right && ev.clientY >= cardRect.top && ev.clientY <= cardRect.bottom;
        if (!inCard) closeLootPopup();
      }
      var bubbleHit = bubbleHotspots.find(function (spot) {
        return canvasX >= spot.x && canvasX <= spot.x + spot.w && canvasY >= spot.y && canvasY <= spot.y + spot.h;
      }) || null;
      if (bubbleHit) {
        var token = byId(bubbleHit.tokenId);
        if (!token) return;
        showInlineBubbleEditor(bubbleHit, token, canvas);
        return;
      }

      clearPingHold();

      if (state.activeTool === 'ping') {
        placeTablePing(ax.q, ax.r, currentPingIdentity());
        return;
      }
      var clickedToken = findTokenAtCanvasPoint(state, canvasX, canvasY) || nearestTokenAt(ax.q, ax.r);
      var clickedMapItem = !clickedToken ? findSelectableMapItemAt(state, ax.q, ax.r) : null;

      if (clickedToken && isTokenDead(clickedToken) && state.activeTool === 'select') {
        var corpseDrop = getLootDropForToken(state, clickedToken.id);
        if (corpseDrop && !corpseDrop.claimed && Array.isArray(corpseDrop.items) && corpseDrop.items.length) {
          normalizeSelection(clickedToken.id, [clickedToken.id]);
          store.setState({ draggingTokenId: '' });
          openLootPopupForToken(clickedToken.id, canvasX, canvasY);
          updateUiPanels();
          drawBoard();
          return;
        }
      }

      if (state.activeTool === 'pan' || ev.button === 1) {
        store.setState({ mouse: { panning: true, lastX: ev.clientX, lastY: ev.clientY } });
        return;
      }

      if (clickedToken && state.activeTool === 'select' && (ev.ctrlKey || ev.metaKey)) {
        normalizeSelection(clickedToken.id, [String(clickedToken.id || '')]);
        showTokenContextMenu(clickedToken, canvasX, canvasY, ax.q, ax.r);
        updateUiPanels();
        drawBoard();
        return;
      }

      if (clickedToken && state.activeTool !== 'paint' && state.activeTool !== 'erase') {
        var selectedIds = Array.isArray(state.selectedTokenIds) ? state.selectedTokenIds.slice() : [];
        if (ev.shiftKey) {
          var tokenId = String(clickedToken.id || '');
          var idx = selectedIds.indexOf(tokenId);
          if (idx >= 0) selectedIds.splice(idx, 1);
          else selectedIds.push(tokenId);
          var normalized = normalizeSelection(tokenId, selectedIds);
          store.setState({ draggingTokenId: '', draggingGroupIds: normalized.list.slice(), dragTokenOrigins: {} });
          updateUiPanels();
          drawBoard();
          return;
        }
        var shouldGroupDrag = selectedIds.indexOf(String(clickedToken.id || '')) >= 0 && selectedIds.length > 1;
        var groupIds = shouldGroupDrag ? selectedIds.slice() : [String(clickedToken.id || '')];
        if (!canCurrentUserManipulateToken(clickedToken)) {
          normalizeSelection(clickedToken.id, [String(clickedToken.id || '')]);
          store.setState({ selectedTokenId: clickedToken.id, draggingTokenId: '', draggingGroupIds: [], dragTokenOrigins: {} });
          closeLootPopup();
          updateUiPanels();
          drawBoard();
          safeNotif(getCombatSceneManipulationDeniedMessage(clickedToken), 'warn');
          return;
        }
        groupIds = groupIds.filter(function (id) {
          var token = byId(id);
          return !!(token && canCurrentUserManipulateToken(token));
        });
        if (!groupIds.length) groupIds = [String(clickedToken.id || '')];
        normalizeSelection(clickedToken.id, groupIds);
        store.setState({ selectedTokenId: clickedToken.id, draggingTokenId: clickedToken.id, draggingGroupIds: groupIds, dragTokenOrigins: {} });
        closeLootPopup();
        if (String(clickedToken.faction || '') === 'monster' && typeof window.setCombatFocusEnemy === 'function') {
          var focusId = Number(clickedToken.sourceEnemyId || clickedToken.id || 0);
          if (focusId > 0) {
            try { window.setCombatFocusEnemy(focusId); } catch (_err) {}
          }
        }
        updateUiPanels();
        drawBoard();
        return;
      }

      if (clickedMapItem && state.activeTool === 'select') {
        store.setState({
          selectedTokenId: '',
          selectedTokenIds: [],
          selectedMapItem: { layer: clickedMapItem.layer, key: clickedMapItem.key },
          draggingMapItem: clickedMapItem.locked ? null : { layer: clickedMapItem.layer, key: clickedMapItem.key }
        });
        if (!clickedMapItem.locked) captureUndoSnapshot('Move Map Item');
        closeLootPopup();
        updateUiPanels();
        drawBoard();
        return;
      }

      if (!clickedMapItem && state.activeTool === 'select' && state.selectedMapItem) {
        clearMapItemSelection();
        drawBoard();
        updateUiPanels();
      }

      if (state.activeTool === 'paint' || state.activeTool === 'erase') {
        paintDragActive = true;
        paintDragLastKey = toKey(ax.q, ax.r);
        paintAt(ax.q, ax.r);
        drawBoard();
        updateUiPanels();
        return;
      }

      if (state.activeTool === 'text') {
        var existingLabel = String(state.layers && state.layers.labels && state.layers.labels[toKey(ax.q, ax.r)] || '');
        var entered = window.prompt('Text label for this hex (blank clears):', existingLabel);
        if (entered === null) return;
        store.setState(function (inner) {
          var next = Object.assign({}, inner);
          next.layers = Object.assign({}, inner.layers || {});
          next.layers.labels = Object.assign({}, (inner.layers && inner.layers.labels) || {});
          var key = toKey(ax.q, ax.r);
          var clean = String(entered || '').trim();
          if (!clean) delete next.layers.labels[key];
          else next.layers.labels[key] = clean;
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
        return;
      }

      if (state.activeTool === 'fog') {
        applyFogAt(ax.q, ax.r, state.fogBrush);
        drawBoard();
        updateUiPanels();
        return;
      }

      if (state.activeTool === 'ruler') {
        var ro = Object.assign({ snapToGrid: true }, state.rulerOptions || {});
        var selected = byId(state.selectedTokenId);
        var start = selected ? { q: Number(selected.q), r: Number(selected.r) } : { q: ax.q, r: ax.r };
        var dist = Math.max(Math.abs(start.q - ax.q), Math.abs(start.r - ax.r));
        var rulerState = { active: true, start: start, end: { q: ax.q, r: ax.r }, distance: dist, label: hexLabel(dist) };
        if (!ro.snapToGrid) {
          rulerState.startPx = selected
            ? axialToPixel(start.q, start.r, size, board.panX, board.panY)
            : { x: canvasX, y: canvasY };
          rulerState.endPx = { x: canvasX, y: canvasY };
          rulerState.distance = Math.max(0, Number((Math.hypot(0, 0) / Math.max(1, size)).toFixed(2)));
          rulerState.label = 'Free';
        }
        store.setState({ ruler: rulerState });
        drawBoard();
        updateUiPanels();
        return;
      }

      if (state.activeTool === 'spellcast') {
        var preview = normalizeCombatSpellPreview(state.spellPreview);
        if (!preview.active) {
          startCombatSpellPreview(preview.spellId || 'thunder-lattice', state.selectedTokenId);
        }
        updateCombatSpellPreviewTarget(ax.q, ax.r);
        if (ev.shiftKey) {
          var castPreview = normalizeCombatSpellPreview(store.getState().spellPreview);
          if (castPreview.active && castPreview.isValid) castCombatSpellPreview();
          else safeNotif((castPreview && castPreview.reason) || 'Aim to a valid target first.', 'warn');
        }
        return;
      }

      if (ev.button === 0) {
        pingHoldTimer = setTimeout(function () {
          placeTablePing(ax.q, ax.r, currentPingIdentity());
        }, 360);
      }
    });

    canvas.addEventListener('mousemove', function (ev) {
      var state = store.getState();
      if (paintDragActive && (state.activeTool === 'paint' || state.activeTool === 'erase')) {
        var rectPaint = canvas.getBoundingClientRect();
        var boardPaint = state.board;
        var sizePaint = Number(boardPaint.size || 42) * Number(boardPaint.zoom || 1);
        var axPaint = pixelToAxial(ev.clientX - rectPaint.left, ev.clientY - rectPaint.top, sizePaint, boardPaint.panX, boardPaint.panY);
        var paintKey = toKey(axPaint.q, axPaint.r);
        if (paintKey !== paintDragLastKey) {
          paintDragLastKey = paintKey;
          paintAt(axPaint.q, axPaint.r);
          drawBoard();
          updateUiPanels();
        }
        return;
      }
      if (state.mouse && state.mouse.panning) {
        clearPingHold();
        var dx = ev.clientX - Number(state.mouse.lastX || 0);
        var dy = ev.clientY - Number(state.mouse.lastY || 0);
        store.setState(function (prev) {
          var next = Object.assign({}, prev);
          next.mouse = { panning: true, lastX: ev.clientX, lastY: ev.clientY };
          next.board = Object.assign({}, prev.board, { panX: Number(prev.board.panX || 0) + dx, panY: Number(prev.board.panY || 0) + dy });
          persist(next);
          return next;
        });
        drawBoard();
        return;
      }

      if (state.draggingTokenId) {
        clearPingHold();
        var rect = canvas.getBoundingClientRect();
        var board = state.board;
        var size = Number(board.size || 42) * Number(board.zoom || 1);
        var rawX = ev.clientX - rect.left;
        var rawY = ev.clientY - rect.top;
        var ax = pixelToAxial(rawX, rawY, size, board.panX, board.panY);
        var draggedToken = byId(state.draggingTokenId);
        if (Array.isArray(state.draggingGroupIds) && state.draggingGroupIds.length > 1 && !isSceneActive()) {
          moveTokenGroupToAnchor(state.draggingGroupIds, state.draggingTokenId, ax.q, ax.r);
        } else if (draggedToken && draggedToken.freeform) {
          var snapCenter = axialToPixel(ax.q, ax.r, size, board.panX, board.panY);
          var thresholdPx = Math.max(0, Math.min(size, size * Number(board.snapThreshold == null ? 0.3 : board.snapThreshold)));
          var dx = rawX - snapCenter.x;
          var dy = rawY - snapCenter.y;
          var snapDistance = Math.hypot(dx, dy);
          moveToken(state.draggingTokenId, ax.q, ax.r, {
            offsetX: snapDistance <= thresholdPx ? 0 : dx,
            offsetY: snapDistance <= thresholdPx ? 0 : dy
          });
        } else {
          moveToken(state.draggingTokenId, ax.q, ax.r);
        }
        drawBoard();
        updateUiPanels();
        return;
      }

      if (state.draggingMapItem) {
        clearPingHold();
        var rectMap = canvas.getBoundingClientRect();
        var boardMap = state.board;
        var sizeMap = Number(boardMap.size || 42) * Number(boardMap.zoom || 1);
        var axMap = pixelToAxial(ev.clientX - rectMap.left, ev.clientY - rectMap.top, sizeMap, boardMap.panX, boardMap.panY);
        moveMapItemTo(state.draggingMapItem.layer, state.draggingMapItem.key, axMap.q, axMap.r);
        return;
      }

      if (state.activeTool === 'ruler' && state.ruler && state.ruler.active) {
        var rect2 = canvas.getBoundingClientRect();
        var board2 = state.board;
        var size2 = Number(board2.size || 42) * Number(board2.zoom || 1);
        var ax2 = pixelToAxial(ev.clientX - rect2.left, ev.clientY - rect2.top, size2, board2.panX, board2.panY);
        var start = state.ruler.start || { q: 0, r: 0 };
        var ro2 = Object.assign({ snapToGrid: true }, state.rulerOptions || {});
        if (ro2.snapToGrid) {
          var dist2 = Math.max(Math.abs(start.q - ax2.q), Math.abs(start.r - ax2.r));
          store.setState({ ruler: { active: true, start: start, end: { q: ax2.q, r: ax2.r }, distance: dist2, label: hexLabel(dist2) } });
        } else {
          var sx = state.ruler.startPx && typeof state.ruler.startPx.x === 'number' ? state.ruler.startPx.x : (ev.clientX - rect2.left);
          var sy = state.ruler.startPx && typeof state.ruler.startPx.y === 'number' ? state.ruler.startPx.y : (ev.clientY - rect2.top);
          var ex = ev.clientX - rect2.left;
          var ey = ev.clientY - rect2.top;
          var distPx = Math.hypot(ex - sx, ey - sy);
          var hexApprox = Math.max(0, Number((distPx / Math.max(1, size2)).toFixed(2)));
          store.setState({
            ruler: {
              active: true,
              start: start,
              end: { q: ax2.q, r: ax2.r },
              startPx: { x: sx, y: sy },
              endPx: { x: ex, y: ey },
              distance: hexApprox,
              label: 'Free'
            }
          });
        }
        drawBoard();
        updateUiPanels();
        return;
      }

      if (state.activeTool === 'spellcast') {
        var rectSpell = canvas.getBoundingClientRect();
        var boardSpell = state.board;
        var sizeSpell = Number(boardSpell.size || 42) * Number(boardSpell.zoom || 1);
        var axSpell = pixelToAxial(ev.clientX - rectSpell.left, ev.clientY - rectSpell.top, sizeSpell, boardSpell.panX, boardSpell.panY);
        updateCombatSpellPreviewTarget(axSpell.q, axSpell.r);
        return;
      }
    });

    function stopDrag() {
      clearPingHold();
      hideInlineBubbleEditor(false);
      paintDragActive = false;
      paintDragLastKey = '';
      var state = store.getState();
      if (state.mouse && state.mouse.panning) {
        store.setState({ mouse: { panning: false, lastX: 0, lastY: 0 } });
      }
      if (state.draggingTokenId) {
        store.setState({ draggingTokenId: '', draggingGroupIds: [], dragTokenOrigins: {} });
      }
      if (state.draggingMapItem) {
        store.setState({ draggingMapItem: null });
      }
      if (state.activeTool === 'ruler' && state.ruler && state.ruler.active) {
        var ro3 = Object.assign({ fadeDelay: 'linger' }, state.rulerOptions || {});
        if (String(ro3.fadeDelay || 'linger') === 'instant') {
          store.setState({ ruler: { active: false, start: null, end: null, distance: 0, label: 'Engaged' } });
          drawBoard();
        }
      }
    }

    canvas.addEventListener('mouseup', stopDrag);
    canvas.addEventListener('mouseleave', stopDrag);

    canvas.addEventListener('dblclick', function (ev) {
      var state = store.getState();
      var rect = canvas.getBoundingClientRect();
      var board = state.board;
      var size = Number(board.size || 42) * Number(board.zoom || 1);
      var ax = pixelToAxial(ev.clientX - rect.left, ev.clientY - rect.top, size, board.panX, board.panY);
      var clickedToken = findTokenAtCanvasPoint(state, ev.clientX - rect.left, ev.clientY - rect.top) || nearestTokenAt(ax.q, ax.r);
      if (!clickedToken) return;
      openTokenSheetQuickView(clickedToken.id);
      ev.preventDefault();
    });

    canvas.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      var state = store.getState();
      var rect = canvas.getBoundingClientRect();
      var board = state.board;
      var size = Number(board.size || 42) * Number(board.zoom || 1);
      var ax = pixelToAxial(ev.clientX - rect.left, ev.clientY - rect.top, size, board.panX, board.panY);
      var token = findTokenAtCanvasPoint(state, ev.clientX - rect.left, ev.clientY - rect.top) || nearestTokenAt(ax.q, ax.r);
      if (!token) {
        var mapItem = findSelectableMapItemAt(state, ax.q, ax.r);
        if (mapItem) {
          store.setState({ selectedMapItem: { layer: mapItem.layer, key: mapItem.key }, selectedTokenId: '', selectedTokenIds: [] });
          showMapItemContextMenu(mapItem, ev.clientX - rect.left, ev.clientY - rect.top);
          drawBoard();
          updateUiPanels();
          return;
        }
        hideTokenContextMenu();
        return;
      }
      var selected = Array.isArray(state.selectedTokenIds) ? state.selectedTokenIds.slice() : [];
      if (selected.indexOf(String(token.id || '')) < 0) normalizeSelection(token.id, [String(token.id || '')]);
      showTokenContextMenu(token, ev.clientX - rect.left, ev.clientY - rect.top, ax.q, ax.r);
      drawBoard();
      updateUiPanels();
    });

    if (!canvas._contextCloseBound) {
      canvas._contextCloseBound = true;
      window.addEventListener('mousedown', function (ev) {
        var menu = document.getElementById('combatTokenContextMenu');
        if (!menu || menu.style.display === 'none') return;
        var openedAt = Number(menu.getAttribute('data-opened-at') || 0);
        if (openedAt && (Date.now() - openedAt) < 140) return;
        if (!menu.contains(ev.target)) hideTokenContextMenu();
      });
    }

    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      store.setState(function (state) {
        var nextZoom = Number(state.board.zoom || 1) + (ev.deltaY < 0 ? 0.06 : -0.06);
        nextZoom = Math.max(0.5, Math.min(2.3, nextZoom));
        var next = Object.assign({}, state);
        next.board = Object.assign({}, state.board, { zoom: nextZoom });
        persist(next);
        return next;
      });
      drawBoard();
      updateUiPanels();
    }, { passive: false });

    canvas.addEventListener('touchstart', function (ev) {
      if (!ev.touches || !ev.touches.length) return;
      if (ev.touches.length === 1) {
        var solo = ev.touches[0];
        touchTapState.active = true;
        touchTapState.moved = false;
        touchTapState.startedAt = Date.now();
        touchTapState.x = Number(solo.clientX || 0);
        touchTapState.y = Number(solo.clientY || 0);
        return;
      }
      var t0 = ev.touches[0];
      var t1 = ev.touches[1];
      var state = store.getState();
      touchGesture.active = true;
      touchTapState.active = false;
      touchGesture.panX = Number(state.board && state.board.panX || 0);
      touchGesture.panY = Number(state.board && state.board.panY || 0);
      touchGesture.zoom = Number(state.board && state.board.zoom || 1);
      touchGesture.centerX = (Number(t0.clientX || 0) + Number(t1.clientX || 0)) / 2;
      touchGesture.centerY = (Number(t0.clientY || 0) + Number(t1.clientY || 0)) / 2;
      touchGesture.distance = Math.hypot(Number(t0.clientX || 0) - Number(t1.clientX || 0), Number(t0.clientY || 0) - Number(t1.clientY || 0));
      ev.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', function (ev) {
      if (touchTapState.active && ev.touches && ev.touches.length === 1) {
        var moveT = ev.touches[0];
        var dxTap = Number(moveT.clientX || 0) - Number(touchTapState.x || 0);
        var dyTap = Number(moveT.clientY || 0) - Number(touchTapState.y || 0);
        if (Math.hypot(dxTap, dyTap) > 12) touchTapState.moved = true;
      }
      if (!touchGesture.active || !ev.touches || ev.touches.length < 2) return;
      var t0 = ev.touches[0];
      var t1 = ev.touches[1];
      var centerX = (Number(t0.clientX || 0) + Number(t1.clientX || 0)) / 2;
      var centerY = (Number(t0.clientY || 0) + Number(t1.clientY || 0)) / 2;
      var distance = Math.max(1, Math.hypot(Number(t0.clientX || 0) - Number(t1.clientX || 0), Number(t0.clientY || 0) - Number(t1.clientY || 0)));
      var zoomRatio = distance / Math.max(1, touchGesture.distance || 1);
      var nextZoom = Math.max(0.5, Math.min(2.3, Number(touchGesture.zoom || 1) * zoomRatio));
      var dx = centerX - Number(touchGesture.centerX || 0);
      var dy = centerY - Number(touchGesture.centerY || 0);
      store.setState(function (state) {
        var next = Object.assign({}, state);
        next.board = Object.assign({}, state.board || {}, { zoom: nextZoom, panX: Number(touchGesture.panX || 0) + dx, panY: Number(touchGesture.panY || 0) + dy });
        persist(next);
        return next;
      });
      drawBoard();
      updateUiPanels();
      ev.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', function (ev) {
      if (ev.touches && ev.touches.length >= 2) return;

      var wasGesture = !!touchGesture.active;
      touchGesture.active = false;

      var shouldHandleTap = touchTapState.active && !touchTapState.moved && !wasGesture
        && (Date.now() - Number(touchTapState.startedAt || 0) <= 320)
        && ev.changedTouches && ev.changedTouches.length;
      if (!shouldHandleTap) {
        touchTapState.active = false;
        return;
      }

      var t = ev.changedTouches[0];
      var state = store.getState();
      var rect = canvas.getBoundingClientRect();
      var board = state.board || {};
      var size = Number(board.size || 42) * Number(board.zoom || 1);
      var canvasX = Number(t.clientX || 0) - rect.left;
      var canvasY = Number(t.clientY || 0) - rect.top;
      var ax = pixelToAxial(canvasX, canvasY, size, Number(board.panX || 0), Number(board.panY || 0));
      lastCombatBoardHex = { q: Number(ax.q || 0), r: Number(ax.r || 0), at: Date.now() };

      var clickedToken = findTokenAtCanvasPoint(state, canvasX, canvasY) || nearestTokenAt(ax.q, ax.r);
      var clickedMapItem = !clickedToken ? findSelectableMapItemAt(state, ax.q, ax.r) : null;

      if (clickedToken) {
        normalizeSelection(clickedToken.id, [String(clickedToken.id || '')]);
        updateUiPanels();
        drawBoard();
        touchTapState.active = false;
        return;
      }

      if (state.activeTool === 'select' && state.selectedMapItem && state.draggingMapItem) {
        moveMapItemTo(state.draggingMapItem.layer, state.draggingMapItem.key, ax.q, ax.r);
        store.setState({ draggingMapItem: null });
        updateUiPanels();
        drawBoard();
        touchTapState.active = false;
        return;
      }

      if (state.activeTool === 'select') {
        var selected = byId(state.selectedTokenId);
        if (selected) {
          moveToken(selected.id, ax.q, ax.r);
          updateUiPanels();
          drawBoard();
        }
      } else if (state.activeTool === 'spellcast') {
        updateCombatSpellPreviewTarget(ax.q, ax.r);
      }

      touchTapState.active = false;
    }, { passive: true });

    canvas.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
      var kindFromTransfer = String(ev.dataTransfer && ev.dataTransfer.getData('text/combat-asset-kind') || '');
      var payloadFromTransfer = String(ev.dataTransfer && ev.dataTransfer.getData('text/combat-asset-payload') || '');
      var snapshot = currentCombatDragPayloadSnapshot();
      var dockDescriptor = window.__combatAssetDockDescriptor && typeof window.__combatAssetDockDescriptor === 'object' ? window.__combatAssetDockDescriptor : null;
      var hasFileDrop = !!(ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length);
      var hasPayload = !!(kindFromTransfer || (snapshot && snapshot.kind) || (dockDescriptor && dockDescriptor.kind));
      if (!hasFileDrop && !hasPayload) {
        clearCombatAssetDragPreview();
        clearCombatAssetDragGhost();
        return;
      }
      var state = store.getState();
      var rect = canvas.getBoundingClientRect();
      var size = Number(state.board.size || 42) * Number(state.board.zoom || 1);
      var ax = pixelToAxial(ev.clientX - rect.left, ev.clientY - rect.top, size, state.board.panX, state.board.panY);
      var payload = { kind: kindFromTransfer || String(snapshot && snapshot.kind || dockDescriptor && dockDescriptor.kind || ''), payload: payloadFromTransfer || String(snapshot && snapshot.payload || dockDescriptor && dockDescriptor.payload || ''), source: kindFromTransfer ? 'dataTransfer' : (snapshot && snapshot.kind ? String(snapshot.source || 'active') : (dockDescriptor && dockDescriptor.kind ? 'dock-descriptor' : 'none')) };
      setCombatDragDebugState({
        phase: 'dragover',
        kind: payload.kind,
        payload: payload.payload,
        source: payload.source,
        dropSource: 'canvas',
        clientX: Number(ev.clientX || 0),
        clientY: Number(ev.clientY || 0),
        q: Number(ax.q || 0),
        r: Number(ax.r || 0)
      });
      setCombatAssetDragPreview({ q: ax.q, r: ax.r });
      setCombatAssetDragGhost({ label: 'Drop on battlemap', x: Number(ev.clientX || 0) + 18, y: Number(ev.clientY || 0) + 18 });
    });

    canvas.addEventListener('drop', function (ev) {
      handleCombatBoardDropEvent(ev, canvas, 'canvas');
      window.__combatAssetDragPayload = null;
      clearCombatAssetDragGhost();
    });

    canvas.addEventListener('dragleave', function () {
      setCombatDragDebugState({ phase: 'dragleave', dropSource: 'canvas' });
      clearCombatAssetDragPreview();
      clearCombatAssetDragGhost();
    });

    var rollModal = document.getElementById('rollModal');
    if (rollModal && !rollModal._combatAssetDropBound) {
      rollModal._combatAssetDropBound = true;
      rollModal.addEventListener('dragover', function (ev) {
        var kindFromTransfer = String(ev.dataTransfer && ev.dataTransfer.getData('text/combat-asset-kind') || '');
        var payloadFromTransfer = String(ev.dataTransfer && ev.dataTransfer.getData('text/combat-asset-payload') || '');
        var snapshot = currentCombatDragPayloadSnapshot();
        var dockDescriptor = window.__combatAssetDockDescriptor && typeof window.__combatAssetDockDescriptor === 'object' ? window.__combatAssetDockDescriptor : null;
        var hasFileDrop = !!(ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length);
        var hasPayload = !!(kindFromTransfer || (snapshot && snapshot.kind) || (dockDescriptor && dockDescriptor.kind));
        if (!hasFileDrop && !hasPayload) {
          clearCombatAssetDragPreview();
          clearCombatAssetDragGhost();
          return;
        }
        var state = store.getState();
        var rect = canvas.getBoundingClientRect();
        var size = Number(state.board.size || 42) * Number(state.board.zoom || 1);
        var ax = pixelToAxial(ev.clientX - rect.left, ev.clientY - rect.top, size, state.board.panX, state.board.panY);
        var payload = { kind: kindFromTransfer || String(snapshot && snapshot.kind || dockDescriptor && dockDescriptor.kind || ''), payload: payloadFromTransfer || String(snapshot && snapshot.payload || dockDescriptor && dockDescriptor.payload || ''), source: kindFromTransfer ? 'dataTransfer' : (snapshot && snapshot.kind ? String(snapshot.source || 'active') : (dockDescriptor && dockDescriptor.kind ? 'dock-descriptor' : 'none')) };
        ev.preventDefault();
        setCombatDragDebugState({
          phase: 'dragover',
          kind: payload.kind,
          payload: payload.payload,
          source: payload.source,
          dropSource: 'roll-modal',
          clientX: Number(ev.clientX || 0),
          clientY: Number(ev.clientY || 0),
          q: Number(ax.q || 0),
          r: Number(ax.r || 0)
        });
        setCombatAssetDragPreview({ q: ax.q, r: ax.r });
        setCombatAssetDragGhost({ label: 'Drop on battlemap', x: Number(ev.clientX || 0) + 18, y: Number(ev.clientY || 0) + 18 });
      });
      rollModal.addEventListener('drop', function (ev) {
        handleCombatBoardDropEvent(ev, canvas, 'roll-modal');
        clearCombatAssetDragGhost();
      });
      rollModal.addEventListener('dragleave', function () {
        setCombatDragDebugState({ phase: 'dragleave', dropSource: 'roll-modal' });
        clearCombatAssetDragPreview();
        clearCombatAssetDragGhost();
      });
    }

    var overlay = document.getElementById('combatModeOverlay');
    if (overlay && !overlay._combatAssetDropBound) {
      overlay._combatAssetDropBound = true;
      overlay.addEventListener('dragover', function (ev) {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
      });
      overlay.addEventListener('drop', function (ev) {
        handleCombatBoardDropEvent(ev, canvas, 'overlay');
        window.__combatAssetDragPayload = null;
        clearCombatAssetDragGhost();
      });
    }
  }

  function bindDragPanels() {
    var root = document.getElementById('combatModeOverlay');
    if (!root || root._dragBound) return;
    root._dragBound = true;
    var dragging = null;

    root.addEventListener('mousedown', function (ev) {
      var handle = ev.target && ev.target.closest && ev.target.closest('[data-drag]');
      if (!handle) return;
      var key = String(handle.getAttribute('data-drag') || 'tools');
      var panel = handle.parentElement;
      if (!panel) return;
      var rect = panel.getBoundingClientRect();
      dragging = { key: key, dx: ev.clientX - rect.left, dy: ev.clientY - rect.top };
      ev.preventDefault();
    });

    window.addEventListener('mousemove', function (ev) {
      if (!dragging) return;
      var x = Math.max(0, ev.clientX - dragging.dx);
      var y = Math.max(0, ev.clientY - dragging.dy);
      store.setState(function (state) {
        var next = Object.assign({}, state);
        next.panelPos = Object.assign({}, state.panelPos);
        next.panelPos[dragging.key] = { x: x, y: y };
        persist(next);
        return next;
      });
      setPanelPositions();
    });

    window.addEventListener('mouseup', function () { dragging = null; });
  }

  function getExpandedPaintOptions(state) {
    var base = [
      'forest', 'marsh', 'crags', 'lava', 'ruins', 'water', 'difficult terrain', 'sand', 'snow', 'ice', 'mud', 'road', 'cobblestone',
      'bridge', 'stairs', 'chasm', 'void', 'pit', 'acid', 'radiation', 'shock',
      'obstacle', 'trap', 'shrine', 'turret', 'door', 'spawn',
      'crate', 'pillar', 'barricade', 'altar', 'console', 'loot-cache', 'beacon',
      'wall', 'vision-blocker', 'wall-seg-e', 'wall-seg-ne', 'wall-seg-nw', 'wall-seg-w', 'wall-seg-sw', 'wall-seg-se',
      'draw-ink',
      '1', '2', '3',
      'tree-canopy', 'balcony', 'weather-overlay', 'high-ledge'
    ];
    var set = {};
    base.forEach(function (v) { set[v] = true; });
    var scenes = Array.isArray(state && state.scenes) ? state.scenes : [];
    function absorbLayerValues(layers) {
      if (!layers || typeof layers !== 'object') return;
      ['terrain', 'objects', 'hazards', 'weather', 'foreground', 'interactives', 'spawns', 'lighting'].forEach(function (layerName) {
        var layerMap = layers[layerName] || null;
        if (!layerMap || typeof layerMap !== 'object') return;
        Object.keys(layerMap).forEach(function (k) {
          var val = String(layerMap[k] || '').trim();
          if (val) set[val] = true;
        });
      });
    }
    scenes.forEach(function (scene) {
      absorbLayerValues(scene && scene.layers);
    });
    absorbLayerValues(state && state.layers);
    var customAssets = (window.S && (window.S.customTerrainAssets || window.S.terrainAssets || window.S.customAssets)) || null;
    if (Array.isArray(customAssets)) {
      customAssets.forEach(function (entry) {
        var label = typeof entry === 'string' ? entry : (entry && (entry.name || entry.id || entry.label));
        if (label) set[String(label)] = true;
      });
    } else if (customAssets && typeof customAssets === 'object') {
      Object.keys(customAssets).forEach(function (key) { set[String(key)] = true; });
    }
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  // Track action click counts for "2 clicks = 1 action" economy
  var __enemyActionClickCounts = {};
  
  function executeEnemyTokenAction(actor, target, actionId) {
    if (!actor || isTokenDead(actor)) {
      safeNotif('No valid enemy token selected.', 'warn');
      return false;
    }
    var state = store.getState();
    if (!isSceneActive()) {
      safeNotif('Start Scene before running enemy actions.', 'warn');
      return false;
    }
    // Allow manual token selection to execute actions without strict turn checks
    // Count clicks: every 2 Execute clicks = 1 action consumed from pool
    if (!isTokenTurnActive(state, actor.id)) {
      if (!__enemyActionClickCounts[actor.id]) __enemyActionClickCounts[actor.id] = 0;
      __enemyActionClickCounts[actor.id]++;
      // Only consume action from pool every 2 clicks
      if (__enemyActionClickCounts[actor.id] % 2 !== 0) {
        safeNotif('Queued action 1/2 for ' + (actor.name || 'Enemy') + '. Click again to execute.', 'info');
        return false;
      }
      // This is the 2nd click - will consume an action below via spendUnitAction
    }
    var foe = target || null;
    if (!foe || isTokenDead(foe) || String(foe.faction) === String(actor.faction)) {
      var foes = (state.tokens || []).filter(function (row) {
        return row && !isTokenDead(row) && String(row.faction) !== String(actor.faction);
      });
      foes.sort(function (a, b) {
        return hexDistance({ q: actor.q, r: actor.r }, { q: a.q, r: a.r }) - hexDistance({ q: actor.q, r: actor.r }, { q: b.q, r: b.r });
      });
      foe = foes[0] || null;
    }
    if (!foe) {
      addHistory((actor.name || 'Enemy') + ' has no living target.');
      return false;
    }
    var dist = hexDistance({ q: actor.q, r: actor.r }, { q: foe.q, r: foe.r });
    var skills = getEnemySkillOptionsForToken(actor, foe);
    var selected = null;
    if (actionId && String(actionId).indexOf('enemy_skill:') === 0) {
      var idx = Number(String(actionId).split(':')[1]);
      selected = skills.find(function (row) { return Number(row.idx) === idx; }) || null;
      if (selected && !selected.inRange) {
        var inRangeFallback = skills.filter(function (row) { return !!row.inRange; });
        if (inRangeFallback.length) {
          selected = inRangeFallback[0];
          addHistory((actor.name || 'Enemy') + ' swapped to in-range action: ' + selected.name + '.');
          safeNotif('Selected skill was out of range. Using an in-range skill instead.', 'warn');
        } else {
          addHistory((actor.name || 'Enemy') + ' tried ' + selected.name + ' but target is out of range.');
          safeNotif('Selected enemy skill is out of range.', 'warn');
          updateUiPanels();
          return false;
        }
      }
    }
    if (!selected) {
      var inRange = skills.filter(function (row) { return !!row.inRange; });
      selected = inRange[0] || null;
    }
    var actionName = selected ? selected.name : 'Basic Enemy Action';
    var skillRef = selected && selected.skill ? selected.skill : null;
    var saveLabel = getEnemySkillSaveLabel(skillRef);
    var saveKey = getEnemySkillSaveKey(skillRef);
    var dreadDie = getEnemySkillDreadDie(skillRef, Math.max(4, Number(actor.dread || actor.codexDread || 6)));
    var defendDie = Math.max(4, Number(getTargetSaveDieForSkill(foe, skillRef) || 6));

    function finalizeEnemyAction(resolution) {
      if (!spendUnitAction(actor.id)) {
        safeNotif(String(actor.name || 'Enemy') + ' has no actions remaining this turn.', 'warn');
        return false;
      }
      var enemyRoll = Math.max(1, Number(resolution && resolution.enemyRoll || 1));
      var defendRoll = Math.max(1, Number(resolution && resolution.defendRoll || 1));
      var defendBonus = Number(resolution && resolution.defendBonus || 0);
      var margin = enemyRoll - defendRoll;
      var hit = margin > 0;
      var stress = 0;
      if (hit) {
        if (selected && selected.skill) {
          stress = resolveEnemySkillStress(selected.skill, margin);
        } else {
          stress = Math.max(1, margin);
        }
        if (selected && selected.skill) {
          var skillEffects = applyEnemySkillFailEffects(selected.skill, actor, foe, margin, stress);
          if (skillEffects && Number(skillEffects.extraDamage || 0) > 0) {
            stress += Math.max(0, Number(skillEffects.extraDamage || 0));
          }
          if (skillEffects && Array.isArray(skillEffects.notes) && skillEffects.notes.length) {
            addHistory('Enemy skill effects: ' + skillEffects.notes.join(' · '));
          }
        }
        if (stress > 0) applyDamageToToken(foe.id, stress, actor.name || 'Enemy');
        if (selected && selected.skill) {
          var cond = String(selected.skill.onFailCondition || '').trim() || extractTimedConditionText(selected.skill.onFail || '');
          if (cond) {
            store.setState(function (inner) {
              var next = Object.assign({}, inner);
              next.tokens = (inner.tokens || []).map(function (row) {
                if (!row || String(row.id) !== String(foe.id)) return row;
                var statuses = Array.isArray(row.status) ? row.status.slice() : [];
                if (statuses.indexOf(cond) < 0) statuses.push(cond);
                return Object.assign({}, row, { status: statuses });
              });
              persist(next);
              return next;
            });
          }
        }
      }

      if (selected && selected.skill) pushEnemySkillNarration(actor, selected.skill, dreadDie);
      addHistory((actor.name || 'Enemy') + ' action result at ' + hexLabel(dist)
        + ' · Dread d' + dreadDie + ' = ' + enemyRoll
        + ' vs ' + String(foe.name || 'target') + ' ' + saveLabel + ' d' + defendDie + ' = ' + defendRoll
        + (defendBonus ? (' (includes +' + defendBonus + ' defend bonuses)') : '')
        + (hit ? (' · On Fail: ' + String(selected && selected.skill && selected.skill.onFail || ('Take ' + stress + ' Stress.'))) : (' · On Success: ' + String(selected && selected.skill && selected.skill.onSuccess || 'Resist the effect.'))));

      var notifEl = document.getElementById('combatLastNotification');
      if (notifEl) {
        notifEl.textContent = (actor.name || 'Enemy') + ' used ' + actionName + (hit ? (' · hit for ' + stress + ' stress') : ' · resisted') + ' · actions left ' + Math.max(0, Number(store.getState().teamActions && store.getState().teamActions[actor.id] || 0));
      }
      maybeAdvanceRoundAfterEnemyActions(actor.id);
      drawBoard();
      updateUiPanels();
      return true;
    }

    if (isManualRollModeActive()) {
      if (typeof window.openWtwManualActionDreadPrompt === 'function') {
        var manualModifierLines = [];
        if (typeof window.buildManualRollModifierLines === 'function') {
          try {
            manualModifierLines = window.buildManualRollModifierLines(saveKey, defendDie, {
              extraLines: ['Enter exploded totals where needed.', 'Compare resolves this enemy action immediately and applies outcomes automatically.']
            }) || [];
          } catch (_manualLineErr) {
            manualModifierLines = [];
          }
        }
        var advDiceNow = [];
        var advLabel = 'Advantage total (optional)';
        var defendFlatLabel = 'Defend additive bonuses (optional)';
        if (foe && foe.isPlayer && saveKey === 'defend') {
          var defendAdvCount = parseDefendAdvantageCount();
          var armorAdvNow = parseArmorDefendAdvDice();
          for (var i = 0; i < defendAdvCount; i++) advDiceNow.push(defendDie);
          armorAdvNow.forEach(function (d) { advDiceNow.push(Number(d || 0)); });
          advDiceNow = advDiceNow.filter(function (d) { return Number(d || 0) > 0; });
          if (advDiceNow.length) {
            advLabel = 'Advantage total (highest from ' + advDiceNow.map(function (d) { return 'd' + Number(d || 0); }).join(', ') + ')';
          }
        }
        window.openWtwManualActionDreadPrompt({
          title: 'Manual Roll — Enemy Action',
          context: (actor.name || 'Enemy') + ' using ' + actionName + ' on ' + String(foe.name || 'target'),
          statKey: saveKey,
          statLabel: saveLabel,
          actionDie: defendDie,
          dreadDie: dreadDie,
          advantageLabel: advLabel,
          bonus1Label: defendFlatLabel,
          bonus2Label: 'Other additive bonus (optional)',
          compareHint: 'Compare uses max(Base, Advantage) + additive bonuses vs Dread. Leave optional fields empty for Base vs Dread.',
          modifierLines: manualModifierLines,
          onResolve: function (outcome) {
            if (!outcome) return;
            finalizeEnemyAction({
              defendRoll: Number(outcome.actionTotal || 1),
              enemyRoll: Number(outcome.dreadTotal || 1),
              defendBonus: Number(outcome.bonusTotal || 0)
            });
          }
        });
        return true;
      }
      var fallbackDefend = promptManualDieTotal('Manual Defend total for ' + String(foe.name || 'target') + ' (1+; exploding totals allowed):', 8, 1, 9999);
      if (fallbackDefend === null) {
        safeNotif('Manual enemy action cancelled.', 'info');
        return false;
      }
      var fallbackEnemy = promptManualDieTotal('Manual Dread total for ' + String(actor.name || 'Enemy') + ' (1+; exploding totals allowed):', 8, 1, 9999);
      if (fallbackEnemy === null) {
        safeNotif('Manual enemy action cancelled.', 'info');
        return false;
      }
      return finalizeEnemyAction({ defendRoll: fallbackDefend, enemyRoll: fallbackEnemy, defendBonus: 0 });
    }

    var enemyRoll = rollCombatDieTotal(dreadDie, 'dread', String(actor.name || 'Enemy') + ' Dread d' + dreadDie);
    var defendRolls = [rollCombatDieTotal(defendDie, 'action', String(foe.name || 'Target') + ' Defend d' + defendDie)];
    var defendBonus = 0;
    if (foe && foe.isPlayer && saveKey === 'defend') {
      var defendAdv = parseDefendAdvantageCount();
      for (var advIdx = 0; advIdx < defendAdv; advIdx++) {
        defendRolls.push(rollCombatDieTotal(defendDie, 'action', 'Defend Advantage d' + defendDie));
      }
      var armorAdvDice = parseArmorDefendAdvDice();
      armorAdvDice.forEach(function (die) {
        defendRolls.push(rollCombatDieTotal(die, 'action', 'Armor Defend AD' + die));
      });
      defendBonus = parseArmorDefendFlatBonus() + parseAffixDefendFlatBonus();
    }
    var defendRoll = defendRolls.reduce(function (mx, val) { return Math.max(mx, val); }, 0) + defendBonus;
    return finalizeEnemyAction({ defendRoll: defendRoll, enemyRoll: enemyRoll, defendBonus: defendBonus });
  }

  function bindStaticControls() {
    bindSceneLibraryControls();

    function applyImportedSceneSnapshot(payload) {
      var source = payload && typeof payload === 'object' ? payload : {};
      var imported = source.schema && source.state && typeof source.state === 'object' ? source.state : source;
      store.setState(function (state) {
        var next = normalizeCombatSceneState(Object.assign({}, state, imported));
        persist(next);
        return next;
      });
      addHistory('Scene snapshot imported.');
      drawBoard();
      updateUiPanels();
    }

    var exportSceneBtn = document.getElementById('combatExportSceneBtn');
    if (exportSceneBtn && !exportSceneBtn._bound) {
      exportSceneBtn._bound = true;
      exportSceneBtn.onclick = function () {
        var state = store.getState();
        var payload = {
          schema: 'btl-combat-scene-v1',
          exportedAt: Date.now(),
          state: {
            board: clone(state.board || {}),
            layers: clone(state.layers || {}),
            fog: clone(state.fog || {}),
            sceneRules: clone(state.sceneRules || {}),
            tokens: clone(state.tokens || []),
            tokenRoundEffects: clone(state.tokenRoundEffects || []),
            initiative: clone(state.initiative || []),
            actionHistory: clone((state.actionHistory || []).slice(0, 200)),
            scenes: clone(state.scenes || []),
            activeSceneId: String(state.activeSceneId || ''),
            panelPos: clone(state.panelPos || {}),
            collapsedPanels: clone(state.collapsedPanels || {}),
            round: Number(state.round || 1),
            initiativeIndex: Number(state.initiativeIndex || 0),
            currentTurnIndex: Number(state.currentTurnIndex || 0),
            lastConditionRoundApplied: Number(state.lastConditionRoundApplied || state.round || 1),
            autoRoll: !!state.autoRoll
          }
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'combat-scene-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        safeNotif('Combat scene exported.', 'good');
      };
    }

    var importSceneBtn = document.getElementById('combatImportSceneBtn');
    var importSceneInput = document.getElementById('combatImportSceneInput');
    if (importSceneBtn && importSceneInput && !importSceneBtn._bound) {
      importSceneBtn._bound = true;
      importSceneBtn.onclick = function () { importSceneInput.click(); };
      importSceneInput.onchange = function () {
        var file = importSceneInput.files && importSceneInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var parsed = JSON.parse(String(reader.result || '{}'));
            applyImportedSceneSnapshot(parsed);
            safeNotif('Combat scene import complete.', 'good');
          } catch (_err) {
            safeNotif('Combat scene import failed: invalid JSON.', 'warn');
          }
        };
        reader.readAsText(file);
        importSceneInput.value = '';
      };
    }

    var recoverSceneBtn = document.getElementById('combatRecoverSceneBtn');
    if (recoverSceneBtn && !recoverSceneBtn._bound) {
      recoverSceneBtn._bound = true;
      recoverSceneBtn.onclick = function () {
        var sel = document.getElementById('combatRecoverySlotSel');
        var idx = Math.max(0, Number(sel && sel.value || 0));
        var stack = loadRecoveryStack();
        var chosen = stack[idx] || null;
        var chosenData = chosen && chosen.data && typeof chosen.data === 'object' ? chosen.data : null;
        if (!chosenData) {
          safeNotif('No autosave recovery snapshot available yet.', 'warn');
          return;
        }
        applyImportedSceneSnapshot(chosenData);
        safeNotif('Recovered combat scene from snapshot #' + String(idx + 1) + '.', 'good');
      };
    }

    var tokenTargetSel = document.getElementById('combatTokenTargetSel');
    var tokenCoverSel = document.getElementById('combatTargetCoverOverrideSel');
    if (tokenTargetSel && tokenCoverSel && !tokenCoverSel._bound) {
      tokenCoverSel._bound = true;
      tokenCoverSel.onchange = function () {
        var targetId = String(tokenTargetSel.value || '');
        if (!targetId) return;
        var mode = String(tokenCoverSel.value || 'auto');
        store.setState(function (state) {
          var next = Object.assign({}, state);
          var sceneRules = Object.assign({}, state.sceneRules || {});
          var overrides = Object.assign({}, sceneRules.targetCoverOverrides || {});
          if (mode === 'auto') delete overrides[targetId];
          else overrides[targetId] = mode;
          sceneRules.targetCoverOverrides = overrides;
          next.sceneRules = sceneRules;
          persist(next);
          return next;
        });
        updateUiPanels();
      };
    }

    var startSceneBtn = document.getElementById('combatStartSceneBtn');
    if (startSceneBtn && !startSceneBtn._bound) {
      startSceneBtn._bound = true;
      startSceneBtn.onclick = function () {
        if (!guardCampaignGmSceneControl('Only the GM can start or restart the shared VTT scene.')) return;
        var wasActive = !!(window.S && window.S.combat && window.S.combat.active);
        var state = store.getState();
        if ((!state.scenes || !state.scenes.length) && typeof window.createNewCombatScene === 'function') {
          try { window.createNewCombatScene(); } catch (_sceneErr) {}
        }
        store.setState(function (inner) {
          var hasWayfarer = (inner.tokens || []).some(function (t) { return t && t.isPlayer; });
          if (hasWayfarer) return inner;
          var next = Object.assign({}, inner);
          var maxHpByRules = getWayfarerMaxHpByRules();
          var portrait = (window.S && window.S.identityForge && window.S.identityForge.media && window.S.identityForge.media.portrait) || '';
          var wayfarer = {
            id: uid('player'),
            name: canonicalWayfarerName(),
            faction: 'player',
            hp: maxHpByRules,
            maxHp: maxHpByRules,
            status: [],
            q: 0,
            r: 0,
            image: portrait,
            size: 1,
            isPlayer: true
          };
          next.tokens = (inner.tokens || []).concat([wayfarer]);
          next.selectedTokenId = String(wayfarer.id || '');
          next.initiative = [];
          persist(next);
          return next;
        });
        initializeSceneRoundState();
        if (typeof window.startCombat === 'function') {
          if (!wasActive) {
            try { window.startCombat(); } catch (_err) {}
          }
          if (window.S && window.S.combat) window.S.combat.round = 1;
          addHistory((wasActive ? 'Scene restarted' : 'Scene started') + ' from Combat Mode at Round 1.');
          safeNotif(wasActive ? 'Scene restarted at Round 1.' : 'Scene started at Round 1.', 'good');
          updateUiPanels();
          drawBoard();
          return;
        }
        safeNotif('Start Scene is unavailable right now.', 'warn');
      };
    }

    var closeBtn = document.getElementById('combatCloseBtn');
    if (closeBtn && !closeBtn._bound) {
      closeBtn._bound = true;
      closeBtn.onclick = function () {
        try {
          if (window.S && window.S.combat && window.S.combat.active && typeof window.endCombat === 'function') {
            window.endCombat();
          }
        } catch (_err) {}
        closeOverlay();
      };
    }

    var playModeBtn = document.getElementById('combatPlayModeBtn');
    if (playModeBtn && !playModeBtn._bound) {
      playModeBtn._bound = true;
      playModeBtn.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state, { playMode: !state.playMode });
          persist(next);
          return next;
        });
        updateUiPanels();
      };
    }

    var compactModeBtn = document.getElementById('combatCompactModeBtn');
    if (compactModeBtn && !compactModeBtn._bound) {
      compactModeBtn._bound = true;
      compactModeBtn.onclick = function () {
        store.setState(function (state) {
          var current = String(state.ui && state.ui.compactMode || 'auto');
          var nextMode = current === 'auto' ? 'on' : (current === 'on' ? 'off' : 'auto');
          var next = Object.assign({}, state);
          next.ui = normalizeCombatUi(Object.assign({}, state.ui || {}, { compactMode: nextMode }));
          persist(next);
          return next;
        });
        applyCombatUiState(store.getState());
        updateUiPanels();
        drawBoard();
      };
    }

    var nextTurn = document.getElementById('combatNextTurnBtn');
    if (nextTurn && !nextTurn._bound) {
      nextTurn._bound = true;
      nextTurn.onclick = function () {
        if (!guardCampaignGmSceneControl('Only the GM can advance shared VTT turns.')) return;
        store.setState(function (state) {
          var size = Math.max(1, (state.initiative || []).length);
          var prevIdx = Number(state.initiativeIndex || 0);
          var idx = (prevIdx + 1) % size;
          var nextRound = Number(state.round || 1);
          if (idx === 0 && size > 0) nextRound += 1;
          var next = Object.assign({}, state, { initiativeIndex: idx, currentTurnIndex: idx, round: nextRound });
          next.teamActions = {};
          (state.tokens || []).forEach(function (token) {
            if (!normalizeTokenActionBudgetToken(token)) return;
            next.teamActions[token.id] = 2;
          });
          next.turnStates = Object.assign({}, state.turnStates || {});
          var arriving = next.initiative && next.initiative[idx] || null;
          var arrivingId = String(arriving && arriving.tokenId || '');
          if (arrivingId && next.turnStates[arrivingId]) {
            next.turnStates[arrivingId] = Object.assign({}, next.turnStates[arrivingId], { held: false, delayed: false, holdUntilRound: 0 });
          }
          persist(next);
          return next;
        });
        var st = store.getState();
        var active = st.initiative[st.initiativeIndex] || null;
        if (window.S && window.S.combat) window.S.combat.round = Math.max(1, Number(st.round || 1));
        if (active) {
          var activeToken = byId(active.tokenId);
          if (activeToken && activeToken.isPlayer) syncWayfarerCombatActionBudget(true);
        }
        if (active) addCombatLogEntry({
          eventType: 'turn',
          action: 'Turn Start',
          actorId: String(active.tokenId || ''),
          actorName: String(active.name || 'Token'),
          result: 'Turn started.',
          tags: ['turn', 'start'],
          message: 'Turn: ' + String(active.name || 'Token') + '.'
        });
        processRoundEffectsForCurrentRound();
        updateUiPanels();
      };
    }

    var delayTurnBtn = document.getElementById('combatDelayTurnBtn');
    if (delayTurnBtn && !delayTurnBtn._bound) {
      delayTurnBtn._bound = true;
      delayTurnBtn.onclick = function () {
        if (!guardCampaignGmSceneControl('Only the GM can reorder shared VTT turns.')) return;
        var st = store.getState();
        var active = st.initiative[st.initiativeIndex] || null;
        applyInitiativeTurnState('delay-turn', active && active.tokenId);
        updateUiPanels();
      };
    }

    var holdTurnBtn = document.getElementById('combatHoldTurnBtn');
    if (holdTurnBtn && !holdTurnBtn._bound) {
      holdTurnBtn._bound = true;
      holdTurnBtn.onclick = function () {
        if (!guardCampaignGmSceneControl('Only the GM can reorder shared VTT turns.')) return;
        var st = store.getState();
        var active = st.initiative[st.initiativeIndex] || null;
        applyInitiativeTurnState('hold-turn', active && active.tokenId);
        updateUiPanels();
      };
    }

    var rollMode = document.getElementById('combatRollModeBtn');
    if (rollMode && !rollMode._bound) {
      rollMode._bound = true;
      rollMode.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state, { autoRoll: !state.autoRoll });
          persist(next);
          return next;
        });
        updateUiPanels();
      };
    }

    var saveToken = document.getElementById('combatSaveTokenBtn');
    if (saveToken && !saveToken._bound) {
      saveToken._bound = true;
      saveToken.onclick = function () {
        if (!guardCampaignGmSceneControl('Only the GM can edit shared VTT token stats.')) return;
        var nameInput = document.getElementById('combatSelectedName');
        var dreadInput = document.getElementById('combatSelectedDread');
        var hpInput = document.getElementById('combatSelectedHp');
        var elevationInput = document.getElementById('combatSelectedElevation');
        var tokenName = String(nameInput && nameInput.value || '').trim();
        var dread = Math.max(1, Number(dreadInput && dreadInput.value || 0));
        var hp = Math.max(0, Number(hpInput && hpInput.value || 0));
        var elevation = Math.max(0, Number(elevationInput && elevationInput.value || 0));
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.tokens = (state.tokens || []).map(function (token) {
            if (!token || String(token.id) !== String(state.selectedTokenId || '')) return token;
            var updated = Object.assign({}, token, { hp: hp, maxHp: Math.max(hp, Number(token.maxHp || hp)) });
            if (tokenName) updated.name = tokenName;
            if (dread > 0) {
              updated.dread = dread;
              if (!updated.isPlayer && String(updated.faction || '') === 'monster') {
                updated.deathNumber = Math.max(1, dread);
              }
            }
            return updated;
          });
          var selected = byId(state.selectedTokenId);
          if (selected) {
            next.layers = Object.assign({}, state.layers);
            next.layers.elevation = Object.assign({}, state.layers.elevation);
            next.layers.elevation[toKey(selected.q, selected.r)] = elevation;
          }
          persist(next);
          return next;
        });
        addHistory('Updated selected token details.');
        drawBoard();
      };
    }

    var applyRoundEffectBtn = document.getElementById('combatApplyRoundEffectBtn');
    if (applyRoundEffectBtn && !applyRoundEffectBtn._bound) {
      applyRoundEffectBtn._bound = true;
      applyRoundEffectBtn.onclick = function () {
        if (!guardCampaignGmSceneControl('Only the GM can apply shared VTT conditions directly.')) return;
        var state = store.getState();
        var selectedToken = byId(state.selectedTokenId);
        var targetSel = document.getElementById('combatTokenTargetSel');
        var targetId = String(targetSel && targetSel.value || '') || String(selectedToken && selectedToken.id || '');
        if (!targetId) {
          safeNotif('Select a token or target first.', 'warn');
          return;
        }
        var effectNameInput = document.getElementById('combatRoundEffectName');
        var effectColorInput = document.getElementById('combatRoundEffectColor');
        var effectStressInput = document.getElementById('combatRoundEffectStress');
        var effectRoundsInput = document.getElementById('combatRoundEffectRounds');
        var label = String(effectNameInput && effectNameInput.value || 'Condition').trim() || 'Condition';
        var color = String(effectColorInput && effectColorInput.value || '#e3bc5e');
        var stress = Math.max(0, Number(effectStressInput && effectStressInput.value || 0));
        var rounds = Math.max(1, Number(effectRoundsInput && effectRoundsInput.value || 1));
        var applied = addTokenRoundEffect(targetId, label, stress, rounds, color);
        if (applied) {
          if (effectNameInput) effectNameInput.value = '';
          updateUiPanels();
          drawBoard();
        }
      };
    }

    var deleteTokenBtn = document.getElementById('combatDeleteTokenBtn');
    if (deleteTokenBtn && !deleteTokenBtn._bound) {
      deleteTokenBtn._bound = true;
      deleteTokenBtn.onclick = function () {
        if (!guardCampaignGmSceneControl('Only the GM can delete shared VTT tokens.')) return;
        var state = store.getState();
        var token = byId(state.selectedTokenId);
        if (!token) return;
        if (!window.confirm('Delete ' + String(token.name || 'selected token') + ' from this scene?')) return;
        store.setState(function (inner) {
          var next = Object.assign({}, inner);
          next.tokens = (inner.tokens || []).filter(function (t) { return t && String(t.id) !== String(token.id); });
          next.tokenRoundEffects = (inner.tokenRoundEffects || []).filter(function (effect) {
            return effect && String(effect.targetTokenId || '') !== String(token.id || '');
          });
          next.selectedTokenId = '';
          next.initiative = [];
          persist(next);
          return next;
        });
        if (window.S && Array.isArray(window.S.enemies)) {
          var sourceId = Number(token.sourceEnemyId || token.id || 0);
          if (sourceId > 0) {
            window.S.enemies = window.S.enemies.filter(function (e) { return !e || Number(e.id) !== sourceId; });
            if (typeof window.renderEnemies === 'function') {
              try { window.renderEnemies(); } catch (_err) {}
            }
            if (typeof window.updateCombatUI === 'function') {
              try { window.updateCombatUI(); } catch (_err2) {}
            }
          }
        }
        addHistory('Deleted token: ' + String(token.name || 'Token') + '.');
        drawBoard();
        updateUiPanels();
      };
    }

    var zoomIn = document.getElementById('combatZoomInBtn');
    if (zoomIn && !zoomIn._bound) {
      zoomIn._bound = true;
      zoomIn.onclick = function () {
        store.setState(function (state) {
          var z = Math.min(2.3, Number(state.board.zoom || 1) + 0.1);
          var next = Object.assign({}, state);
          next.board = Object.assign({}, state.board, { zoom: z });
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var zoomOut = document.getElementById('combatZoomOutBtn');
    if (zoomOut && !zoomOut._bound) {
      zoomOut._bound = true;
      zoomOut.onclick = function () {
        store.setState(function (state) {
          var z = Math.max(0.5, Number(state.board.zoom || 1) - 0.1);
          var next = Object.assign({}, state);
          next.board = Object.assign({}, state.board, { zoom: z });
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    function setToolMode(mode) {
      var nextMode = String(mode || 'select');
      store.setState(function (state) {
        var next = Object.assign({}, state, { activeTool: nextMode });
        if (nextMode !== 'spellcast' && state.spellPreview && state.spellPreview.active) {
          next.spellPreview = normalizeCombatSpellPreview({ active: false });
        }
        return next;
      });
      updateUiPanels();
    }

    function changeZoom(delta) {
      store.setState(function (state) {
        var z = Math.max(0.5, Math.min(2.3, Number(state.board.zoom || 1) + Number(delta || 0)));
        var next = Object.assign({}, state);
        next.board = Object.assign({}, state.board, { zoom: z });
        persist(next);
        return next;
      });
      drawBoard();
      updateUiPanels();
    }

    function openQuickEffectsModal() {
      var st = store.getState();
      var tokens = (st.tokens || []).filter(function (row) { return !!row; });
      if (!tokens.length) {
        safeNotif('No tokens are available for effects.', 'warn');
        return;
      }
      var token = byId(st.selectedTokenId) || tokens[0];
      var aoeJumpButton = (typeof window.openCombatAoeEffectTools === 'function')
        ? '<button class="btn btn-xs" onclick="if(typeof window.closeModal===\'function\')window.closeModal();window.openCombatAoeEffectTools();">Open AOE Effect Tools</button>'
        : '';
      var targetOptions = tokens.map(function (row) {
        var id = String(row.id || '');
        var selected = String(id) === String(token && token.id || '') ? ' selected' : '';
        var label = String(row.name || 'Token').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<option value="' + id + '"' + selected + '>' + label + '</option>';
      }).join('');
      var spellOptions = SPELLCAST_PREVIEW_LIBRARY.map(function (entry) {
        var selectedSpell = String(entry.id || '') === 'thunder-lattice' ? ' selected' : '';
        var shape = String(entry.shape || 'line').toUpperCase();
        var behavior = entry.damageOnHit === false ? 'support' : 'damage=margin';
        return '<option value="' + String(entry.id || '') + '"' + selectedSpell + '>' + String(entry.label || 'Spell') + ' [' + shape + ', ' + behavior + ']</option>';
      }).join('');
      var legacyPresetOptions = Array.isArray(window.AOE_SPELL_PRESETS)
        ? window.AOE_SPELL_PRESETS.map(function (row) {
          var key = String(row && row.key || '').trim();
          if (!key) return '';
          var shape = String(row && row.shape || 'line').toUpperCase();
          var band = normalizeSpellcastBandKey(row && row.band || 'close').toUpperCase();
          return '<option value="legacy:' + key + '">AOE: ' + String(row && row.name || key) + ' [' + shape + ', ' + band + ']</option>';
        }).filter(Boolean).join('')
        : '';
      if (legacyPresetOptions) {
        spellOptions += '<optgroup label="AOE Effect Tools Presets">' + legacyPresetOptions + '</optgroup>';
      }
      var html = '<div style="display:grid;gap:.28rem;">'
        + '<div style="font-size:.78rem;color:var(--text2);">Apply a timed effect to any active token.</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:.3rem;font-size:.68rem;color:var(--muted2);padding:.18rem .22rem;border:1px solid var(--combat-border);border-radius:8px;background:rgba(255,255,255,.02);">'
        + '<span>Need spell template placement? Use the AOE tools modal.</span>'
        + aoeJumpButton
        + '</div>'
        + '<div style="display:grid;gap:.24rem;padding:.22rem;border:1px solid rgba(164,223,255,.3);border-radius:9px;background:rgba(55,115,163,.12);">'
        + '<div class="combat-mini" style="color:var(--combat-accent-2);">Spellcaster Preview</div>'
        + '<label class="combat-mini">Spell Template</label>'
        + '<select id="combatSpellPreviewSelect" class="combat-select">' + spellOptions + '</select>'
        + '<label class="combat-mini">Cast Mode</label>'
        + '<select id="combatSpellCastMode" class="combat-select"><option value="auto" selected>Auto Roll</option><option value="manual">Manual Roll</option></select>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.24rem;">'
        + '<label style="display:grid;gap:.14rem;"><span class="combat-mini">Override Shape</span><select id="combatSpellShape" class="combat-select"><option value="">Preset Default</option><option value="line">Line</option><option value="ring">Ring</option><option value="cone">Cone</option><option value="burst">Burst</option></select></label>'
        + '<label style="display:grid;gap:.14rem;"><span class="combat-mini">Range Band</span><select id="combatSpellBand" class="combat-select"><option value="">Preset Default</option><option value="engaged">Engaged</option><option value="close">Close</option><option value="nearby">Nearby</option><option value="far">Far</option></select></label>'
        + '</div>'
        + '<label class="combat-mini">Caster Token</label>'
        + '<select id="combatSpellCaster" class="combat-select">' + targetOptions + '</select>'
        + '<div class="combat-mini" style="color:var(--muted2);">Flow: Start Preview -> move cursor on map -> cast directly via toolbar Cast, C key, or Shift+Click. Use Rotate for precise line/cone orientation.</div>'
        + '<div style="display:flex;gap:.24rem;flex-wrap:wrap;">'
        + '<button class="btn btn-xs" onclick="if(window.startCombatSpellPreviewFromModal)window.startCombatSpellPreviewFromModal();">Start Preview (Map Cast)</button>'
        + '<button class="btn btn-xs btn-primary" onclick="if(window.castCombatSpellPreviewFromModal)window.castCombatSpellPreviewFromModal();">Cast Current Preview</button>'
        + '<button class="btn btn-xs" onclick="if(window.rotateCombatSpellPreviewDirection)window.rotateCombatSpellPreviewDirection(-1);">Rotate Left</button>'
        + '<button class="btn btn-xs" onclick="if(window.rotateCombatSpellPreviewDirection)window.rotateCombatSpellPreviewDirection(1);">Rotate Right</button>'
        + '</div>'
        + '</div>'
        + '<label class="combat-mini">Target Token</label>'
        + '<select id="combatFxTarget" class="combat-select">' + targetOptions + '</select>'
        + '<label class="combat-mini">Condition Name</label>'
        + '<input id="combatFxName" class="combat-input" placeholder="Condition name (Burning)">'
        + '<div style="display:grid;grid-template-columns:1fr auto;gap:.24rem;align-items:end;"><input id="combatFxColor" class="combat-input" type="color" value="#e3bc5e"><div class="combat-mini" style="padding:.35rem .2rem;">Condition color</div></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.24rem;">'
        + '<label style="display:grid;gap:.18rem;"><span class="combat-mini">Stress/Round</span><input id="combatFxStress" class="combat-input" type="number" min="0" max="20" value="1"></label>'
        + '<label style="display:grid;gap:.18rem;"><span class="combat-mini">Rounds</span><input id="combatFxRounds" class="combat-input" type="number" min="1" max="20" value="2"></label>'
        + '</div>'
        + '<div class="combat-mini" style="color:var(--muted2);">Indicator guide: Stress/Round = damage applied each round. Rounds = total duration.</div>'
        + '<button class="btn btn-xs btn-primary" onclick="(function(){var t=document.getElementById(\'combatFxTarget\');var n=document.getElementById(\'combatFxName\');var c=document.getElementById(\'combatFxColor\');var s=document.getElementById(\'combatFxStress\');var r=document.getElementById(\'combatFxRounds\');if(window.applyCombatQuickEffectTo){window.applyCombatQuickEffectTo(String(t&&t.value||\'\'),String(n&&n.value||\'Condition\'),Number(s&&s.value||1),Number(r&&r.value||2),String(c&&c.value||\'#e3bc5e\'));}if(typeof window.closeModal===\'function\')window.closeModal();})();">Apply</button>'
        + '</div>';
      if (typeof window.openModal === 'function') {
        window.openModal('Combat Effects', html, null, { preventScroll: true, focusTrap: true });
        // Focus modal overlay for accessibility and scroll stability
        setTimeout(function() {
          var modal = document.getElementById('rollModal') || document.querySelector('.modal, .overlay, [role="dialog"]');
          if (modal) {
            modal.setAttribute('tabindex', '-1');
            try { modal.focus({ preventScroll: true }); } catch (e) { modal.focus(); }
          }
        }, 0);
      } else safeNotif('Effects modal requires modal support.', 'warn');
    }

    var COMBAT_ASSET_LIBRARY = [
      { kind: 'spawn', payload: 'npc:Guide', icon: 'NPC', label: 'Guide Token', chips: ['Token', 'Drop on hex'], description: 'Spawn a neutral guide exactly where you drop it.' },
      { kind: 'spawn', payload: 'npc:Merchant', icon: 'NPC', label: 'Merchant Token', chips: ['Token', 'Support'], description: 'Spawn a merchant or quartermaster near the party.' },
      { kind: 'set-tool', payload: 'terrain:forest', icon: 'MAP', label: 'Forest Tile', chips: ['Terrain', 'Paint on drop'], description: 'Drop onto a hex to stamp forest terrain, or click Use to place at board center.' },
      { kind: 'set-tool', payload: 'objects:obstacle', icon: 'OBJ', label: 'Obstacle', chips: ['Object', 'Cover'], description: 'Place an obstacle directly on a hex or click Use for immediate placement.' },
      { kind: 'set-tool', payload: 'hazards:trap', icon: 'TRP', label: 'Trap Marker', chips: ['Hazard', 'Trigger'], description: 'Drop a trap marker on a hex for immediate hazard setup.' },
      { kind: 'preset', payload: 'urban', icon: 'PRE', label: 'Urban Preset', chips: ['Board preset', '20x20'], description: 'Apply the urban board footprint and weather profile.' },
      { kind: 'preset', payload: 'storm', icon: 'PRE', label: 'Storm Preset', chips: ['Board preset', 'Weather'], description: 'Apply storm framing for naval or desperate road encounters.' }
    ];
    var COMBAT_TUTORIAL_STEPS = [
      { title: 'Board and Selection', body: ['Click a token to make it primary. Shift-click to multi-select and move formations together.', 'Right-click any token for ping, sheet, lock, layer, turn, and transform actions.'] },
      { title: 'Pages and Scene Beats', body: ['Use the page switcher to separate approach, clash, and aftermath into clean scenes.', 'Build Map creates linked encounter pages fast; rename them to match your actual beat structure.'] },
      { title: 'Rules Embedded in Play', body: ['Use the Rules button for searchable quick-reference cards, caravan procedures, and ship combat roles.', 'Character Sheet now mirrors that same card layout so the table stays inside the VTT.'] },
      { title: 'Assets and Drag Drop', body: ['Drag bestiary entries or asset cards directly onto the board.', 'Drop an image file onto the board to set a battlemap background without leaving Combat Mode.'] },
      { title: 'Fog and Vision', body: ['Set fog mode, vision radius, and reveal behavior from Combat Settings.', 'Use Fog and object layers together to control what players can realistically act on.'] },
      { title: 'Token Ops and Undo', body: ['Copy/paste auto-spaces tokens. Enumerate cleans up duplicate enemies. Rotate and scale help with occupied space.', 'Undo and redo are wired for scene editing so you can prep quickly and recover safely.'] },
      { title: 'Running the Encounter', body: ['Keep the active token selected so the sheet, actions, and log stay focused.', 'Long Rest and day progression still belong to the Province, Sea Region, and other world-map systems outside this VTT layer.'] }
    ];

    function writeCombatTutorialState(ui) {
      try {
        localStorage.setItem(COMBAT_TUTORIAL_KEY, JSON.stringify({ seen: !!ui.tutorialSeen, step: Math.max(0, Number(ui.tutorialStep || 0)) }));
      } catch (_err) {}
    }

    function buildCombatTutorialHtml(stepIndex) {
      var safeIndex = Math.max(0, Math.min(COMBAT_TUTORIAL_STEPS.length - 1, Number(stepIndex || 0)));
      var step = COMBAT_TUTORIAL_STEPS[safeIndex] || COMBAT_TUTORIAL_STEPS[0];
      var body = (step.body || []).map(function (line) {
        return '<div class="combat-rules-line">' + escapeHtml(String(line || '')) + '</div>';
      }).join('');
      return ''
        + '<div class="combat-rules-panel">'
        + '<div class="combat-rules-toolbar">'
        + '<div><div class="combat-rules-kicker">First-Run Tutorial</div><div class="combat-rules-heading">Step ' + (safeIndex + 1) + ' of ' + COMBAT_TUTORIAL_STEPS.length + ' · ' + escapeHtml(String(step.title || 'Combat Mode')) + '</div></div>'
        + '<div class="combat-rules-actions"><button class="btn btn-xs" onclick="window.deferCombatTutorial&&window.deferCombatTutorial()">Resume Later</button></div>'
        + '</div>'
        + '<article class="combat-rules-card combat-sheet-card">'
        + '<div class="combat-rules-meta"><span class="combat-rules-icon">TOUR</span><span class="combat-rules-section-label">Guided Setup</span></div>'
        + '<div class="combat-rules-title">' + escapeHtml(String(step.title || 'Combat Mode')) + '</div>'
        + '<div class="combat-rules-body">' + body + '</div>'
        + '</article>'
        + '<div style="display:flex;justify-content:space-between;gap:.35rem;flex-wrap:wrap;">'
        + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;">'
        + (safeIndex > 0 ? '<button class="btn btn-xs" onclick="window.stepCombatTutorial&&window.stepCombatTutorial(-1)">Back</button>' : '<button class="btn btn-xs" onclick="window.skipCombatTutorial&&window.skipCombatTutorial()">Skip Intro</button>')
        + '<button class="btn btn-xs" onclick="window.skipCombatTutorial&&window.skipCombatTutorial()">Do Not Auto-Open</button>'
        + '</div>'
        + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;">'
        + (safeIndex < COMBAT_TUTORIAL_STEPS.length - 1
          ? '<button class="btn btn-xs btn-primary" onclick="window.stepCombatTutorial&&window.stepCombatTutorial(1)">Next</button>'
          : '<button class="btn btn-xs btn-primary" onclick="window.finishCombatTutorial&&window.finishCombatTutorial()">Finish Tour</button>')
        + '</div>'
        + '</div>'
        + '</div>';
    }

    function updateCombatTutorialState(mutator) {
      store.setState(function (state) {
        var next = normalizeCombatSceneState(Object.assign({}, state));
        next.ui = normalizeCombatUi(Object.assign({}, next.ui || {}));
        if (typeof mutator === 'function') mutator(next.ui, next);
        persist(next);
        writeCombatTutorialState(next.ui);
        return next;
      });
    }

    window.openCombatTutorial = function (stepIndex) {
      var safeIndex = Math.max(0, Math.min(COMBAT_TUTORIAL_STEPS.length - 1, Number(stepIndex || 0)));
      updateCombatTutorialState(function (ui) {
        ui.tutorialStep = safeIndex;
      });
      if (typeof window.openModal === 'function') {
        window.openModal('Combat Mode Tour', buildCombatTutorialHtml(safeIndex), null, { preventScroll: true, focusTrap: true });
      }
    };

    window.stepCombatTutorial = function (delta) {
      var state = store.getState();
      var nextIndex = Math.max(0, Math.min(COMBAT_TUTORIAL_STEPS.length - 1, Number(state.ui && state.ui.tutorialStep || 0) + Number(delta || 0)));
      window.openCombatTutorial(nextIndex);
    };

    window.deferCombatTutorial = function () {
      updateCombatTutorialState(function (ui) {
        ui.tutorialSeen = false;
      });
      if (typeof window.closeModal === 'function') window.closeModal();
      safeNotif('Tutorial progress saved. Resume it from Combat Settings.', 'info');
    };

    window.skipCombatTutorial = function () {
      updateCombatTutorialState(function (ui) {
        ui.tutorialSeen = true;
      });
      if (typeof window.closeModal === 'function') window.closeModal();
      safeNotif('Tutorial auto-open disabled. You can reopen it from Combat Settings.', 'info');
    };

    window.finishCombatTutorial = function () {
      updateCombatTutorialState(function (ui) {
        ui.tutorialSeen = true;
        ui.tutorialStep = COMBAT_TUTORIAL_STEPS.length - 1;
      });
      if (typeof window.closeModal === 'function') window.closeModal();
      safeNotif('Combat tutorial complete.', 'good');
    };

    function buildCombatAssetsModalHtml() {
      var cards = COMBAT_ASSET_LIBRARY.map(function (entry) {
        return ''
          + '<article class="combat-rules-card combat-sheet-card" draggable="true" ondragstart="window.startCombatAssetDrag&&window.startCombatAssetDrag(event,\'' + String(entry.kind) + '\',\'' + String(entry.payload) + '\')">'
          + '<div class="combat-rules-meta"><span class="combat-rules-icon">' + escapeHtml(String(entry.icon || 'AST')) + '</span><span class="combat-rules-section-label">Asset</span></div>'
          + '<div class="combat-rules-title">' + escapeHtml(String(entry.label || 'Asset')) + '</div>'
          + '<div class="combat-rules-chip-row">' + (entry.chips || []).map(function (chip) { return '<span class="combat-rules-chip">' + escapeHtml(String(chip)) + '</span>'; }).join('') + '</div>'
          + '<div class="combat-rules-body"><div class="combat-rules-line">' + escapeHtml(String(entry.description || '')) + '</div></div>'
          + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.55rem;"><button class="btn btn-xs btn-primary" type="button" onclick="window.combatAssetAction&&window.combatAssetAction(\'' + String(entry.kind) + '\',\'' + String(entry.payload) + '\')">Use</button><span class="combat-rules-line" style="font-size:.72rem;">Drag onto the board to place directly.</span></div>'
          + '</article>';
      }).join('');
      return ''
        + '<div class="combat-rules-panel">'
        + '<div class="combat-rules-toolbar">'
        + '<div><div class="combat-rules-kicker">Asset Hub</div><div class="combat-rules-heading">Drag tokens, terrain stamps, and presets straight onto the board. Drop image files anywhere on the canvas to set battlemaps.</div></div>'
        + '<div class="combat-rules-actions"><button class="btn btn-xs" onclick="window.combatAssetAction&&window.combatAssetAction(\'upload-map\',\'\')">Upload Map</button><button class="btn btn-xs" onclick="window.combatAssetAction&&window.combatAssetAction(\'open-drawer\',\'\')">Bestiary Drawer</button></div>'
        + '</div>'
        + '<div class="combat-rules-grid">' + cards + '</div>'
        + '</div>';
    }

    function openCombatAssetsModal() {
      setCombatAssetDrawerOpen(true);
      var dock = document.getElementById('combatAssetDock');
      var search = document.getElementById('combatAssetSearch');
      if (dock && typeof dock.scrollIntoView === 'function') dock.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      if (search && typeof search.focus === 'function') search.focus({ preventScroll: true });
    }

    function openCombatSettingsHub() {
      var state = store.getState();
      var mode = String(state.fog && state.fog.revealMode || 'manual');
      var radius = Math.max(1, Math.min(8, Number(state.fog && state.fog.visionRadius || 3)));
      var ui = normalizeCombatUi(state.ui);
      var theme = getCombatThemeTokens(ui);
      var html = ''
        + '<div class="combat-rules-panel">'
        + '<div class="combat-rules-toolbar">'
        + '<div><div class="combat-rules-kicker">Combat Settings</div><div class="combat-rules-heading">Tune motion, theme tokens, tutorial behavior, fog, and auto-rolls for this VTT layer.</div></div>'
        + '<div class="combat-rules-actions"><button class="btn btn-xs" onclick="window.openCombatTutorial&&window.openCombatTutorial(' + Number(ui.tutorialStep || 0) + ')">Tutorial</button><button class="btn btn-xs" onclick="window.showCombatRulesReference&&window.showCombatRulesReference()">Rules</button></div>'
        + '</div>'
        + '<div class="combat-rules-grid">'
        + '<article class="combat-rules-card combat-sheet-card">'
        + '<div class="combat-rules-meta"><span class="combat-rules-icon">UI</span><span class="combat-rules-section-label">Motion</span></div>'
        + '<div class="combat-rules-title">Motion and Theme</div>'
        + '<div style="display:grid;gap:.45rem;">'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Motion Mode'
        + '<select id="combatSettingsMotionMode" class="combat-select" style="max-width:160px;">'
        + '<option value="full" ' + (ui.motionMode === 'full' ? 'selected' : '') + '>Full</option>'
        + '<option value="reduced" ' + (ui.motionMode === 'reduced' ? 'selected' : '') + '>Reduced</option>'
        + '<option value="off" ' + (ui.motionMode === 'off' ? 'selected' : '') + '>Off</option>'
        + '</select></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Theme Preset'
        + '<select id="combatSettingsThemePreset" class="combat-select" style="max-width:180px;">'
        + '<option value="obsidian" ' + (ui.themePreset === 'obsidian' ? 'selected' : '') + '>Obsidian</option>'
        + '<option value="dawn" ' + (ui.themePreset === 'dawn' ? 'selected' : '') + '>Dawn</option>'
        + '<option value="high-contrast" ' + (ui.themePreset === 'high-contrast' ? 'selected' : '') + '>High Contrast</option>'
        + '</select></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Compact Layout'
        + '<select id="combatSettingsCompactMode" class="combat-select" style="max-width:180px;">'
        + '<option value="auto" ' + (ui.compactMode === 'auto' ? 'selected' : '') + '>Auto</option>'
        + '<option value="on" ' + (ui.compactMode === 'on' ? 'selected' : '') + '>On</option>'
        + '<option value="off" ' + (ui.compactMode === 'off' ? 'selected' : '') + '>Off</option>'
        + '</select></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Render Quality'
        + '<select id="combatSettingsQualityMode" class="combat-select" style="max-width:180px;">'
        + '<option value="auto" ' + (ui.qualityMode === 'auto' ? 'selected' : '') + '>Auto</option>'
        + '<option value="full" ' + (ui.qualityMode === 'full' ? 'selected' : '') + '>Full</option>'
        + '<option value="performance" ' + (ui.qualityMode === 'performance' ? 'selected' : '') + '>Performance</option>'
        + '</select></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;"><input id="combatSettingsDragDebugBanner" type="checkbox" ' + (ui.dragDebugBanner ? 'checked' : '') + '> Show drag/drop debug banner</label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Accent <input id="combatSettingsAccent" type="color" value="' + escapeHtml(String(theme.accent || '#e3bc5e')) + '"></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Support Accent <input id="combatSettingsAccent2" type="color" value="' + escapeHtml(String(theme.accent2 || '#49c9bb')) + '"></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Surface <input id="combatSettingsSurface" type="color" value="' + escapeHtml(rgbaStringToHex(String(theme.surface || '#0c0e1a'))) + '"></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Text <input id="combatSettingsText" type="color" value="' + escapeHtml(rgbaStringToHex(String(theme.text || '#e9e0cf'))) + '"></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Fog <input id="combatSettingsFogColor" type="color" value="' + escapeHtml(rgbaStringToHex(String(theme.fog || '#020307'))) + '"></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Ping <input id="combatSettingsPing" type="color" value="' + escapeHtml(rgbaStringToHex(String(theme.ping || '#49c9bb'))) + '"></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Danger <input id="combatSettingsDanger" type="color" value="' + escapeHtml(rgbaStringToHex(String(theme.danger || '#d05353'))) + '"></label>'
        + '<div class="combat-mini">Keyboard: Tab select token, arrows move, N next turn, H hold, J delay, Enter opens sheet.</div>'
        + '</div>'
        + '</article>'
        + '<article class="combat-rules-card combat-sheet-card">'
        + '<div class="combat-rules-meta"><span class="combat-rules-icon">FOG</span><span class="combat-rules-section-label">Encounter</span></div>'
        + '<div class="combat-rules-title">Fog, Vision, and Dice</div>'
        + '<div style="display:grid;gap:.45rem;">'
        + '<label style="display:flex;align-items:center;gap:.4rem;"><input id="combatSettingsFogEnabled" type="checkbox" ' + ((state.fog && state.fog.enabled) ? 'checked' : '') + '> Fog of War enabled</label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;"><input id="combatSettingsAutoRoll" type="checkbox" ' + (state.autoRoll ? 'checked' : '') + '> Auto roll mode</label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Vision Radius'
        + '<input id="combatSettingsVisionRadius" class="combat-input" type="number" min="1" max="8" value="' + radius + '" style="max-width:76px;"></label>'
        + '<label style="display:flex;align-items:center;gap:.4rem;">Fog Mode'
        + '<select id="combatSettingsFogMode" class="combat-select" style="max-width:160px;">'
        + '<option value="manual" ' + (mode === 'manual' ? 'selected' : '') + '>Manual</option>'
        + '<option value="los" ' + (mode === 'los' ? 'selected' : '') + '>Line of Sight</option>'
        + '<option value="ordered" ' + (mode === 'ordered' ? 'selected' : '') + '>Ordered Reveal</option>'
        + '</select></label>'
        + '<div style="display:flex;gap:.24rem;flex-wrap:wrap;">'
        + '<button class="btn btn-xs" onclick="window.combatOpenAssetsHub&&window.combatOpenAssetsHub()">Assets</button>'
        + '</div>'
        + '</div>'
        + '</article>'
        + '</div>'
        + '<button class="btn btn-xs btn-primary" onclick="(function(){if(window.applyCombatSettingsFromModal)window.applyCombatSettingsFromModal();if(typeof window.closeModal===\'function\')window.closeModal();})();">Apply</button>'
        + '</div>';
      if (typeof window.openModal === 'function') {
        window.openModal('Combat Settings', html, null, { preventScroll: true, focusTrap: true });
      }
    }

    window.combatOpenAssetsHub = openCombatAssetsModal;
    window.startCombatAssetDrag = function (ev, kind, payload) {
      if (!ev) return;
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'copy';
        ev.dataTransfer.setData('text/combat-asset-kind', String(kind || ''));
        ev.dataTransfer.setData('text/combat-asset-payload', String(payload || ''));
        ev.dataTransfer.setData('text/plain', String(kind || '') + ':' + String(payload || ''));
      }
      primeCombatAssetDragPayload(kind, payload, 'Dragging asset');
      var source = ev.currentTarget || ev.target;
      var label = source && source.getAttribute && source.getAttribute('data-asset-label') || source && source.textContent || 'Dragging asset';
      if (window.__combatAssetDragPayload && typeof window.__combatAssetDragPayload === 'object') {
        window.__combatAssetDragPayload.label = String(label || 'Dragging asset');
      }
      setCombatDragDebugState({
        phase: 'drag-start',
        kind: String(kind || ''),
        payload: String(payload || ''),
        source: 'startCombatAssetDrag',
        dropSource: 'pending',
        clientX: Number(ev.clientX || 0),
        clientY: Number(ev.clientY || 0),
        q: null,
        r: null
      });
      // Do NOT call setCombatAssetDrawerOpen here — it triggers updateUiPanels() which rebuilds
      // the assetFeed innerHTML, removing the dragged element from the DOM mid-dragstart which
      // causes some browsers to silently cancel the drag operation.
      setCombatAssetDragGhost({ label: String(label || 'Dragging asset'), x: Number(ev.clientX || 0) + 18, y: Number(ev.clientY || 0) + 18 });
    };

    function applyCombatAssetActionAt(action, value, baseQ, baseR, directDrop) {
      var q = Number(baseQ || 0);
      var r = Number(baseR || 0);
      if (action === 'set-tool') {
        var rawValue = String(value || '');
        var firstSep = rawValue.indexOf(':');
        var layer = firstSep >= 0 ? String(rawValue.slice(0, firstSep) || 'terrain') : 'terrain';
        var paint = firstSep >= 0 ? String(rawValue.slice(firstSep + 1) || 'forest') : String(rawValue || 'forest');
        if (directDrop) {
          captureUndoSnapshot('Drop Asset');
          store.setState(function (inner) {
            var next = normalizeCombatSceneState(Object.assign({}, inner));
            next.layers[layer] = Object.assign({}, next.layers[layer] || {}, (function () { var out = {}; out[toKey(q, r)] = paint; return out; })());
            if (next.layerSettings && next.layerSettings[layer]) {
              next.layerSettings[layer] = Object.assign({}, next.layerSettings[layer], {
                visible: true,
                gmOnly: false,
                opacity: Math.max(0.35, Number(next.layerSettings[layer].opacity || 1))
              });
            }
            if (isSelectableMapLayer(layer)) next.selectedMapItem = { layer: layer, key: toKey(q, r) };
            persist(next);
            return next;
          });
          addHistory('Asset stamped: ' + paint + ' at ' + toKey(q, r) + '.');
          if (layer === 'terrain' && paint.indexOf('hexasset:') === 0) {
            var placedState = store.getState();
            var placedId = paint.split(':')[1] || '';
            var placedEntry = getUploadedHexAssetById(placedState, placedId);
            if (!placedEntry || !placedEntry.src) {
              safeNotif('Hex asset has no image — re-upload the image.', 'warn');
            } else {
              invalidateHexAssetSprite(placedId); // force fresh load on next draw
              var placedSprite = getHexAssetSprite(placedEntry); // start loading now
              if (placedSprite && placedSprite.errored) safeNotif('Hex image failed to load — re-upload the asset.', 'warn');
            }
          }
          safeNotif('Asset placed at ' + toKey(q, r) + '.', 'good');
        } else {
          store.setState(function (inner2) {
            var next2 = Object.assign({}, inner2, { activeLayer: layer, activeTool: 'paint', paintValue: paint });
            persist(next2);
            return next2;
          });
          safeNotif('Painter armed: ' + layer + ' · ' + paint + '.', 'good');
        }
      } else if (action === 'spawn') {
        var spawnParts = String(value || '').split(':');
        var faction = String(spawnParts[0] || 'npc');
        var name = String(spawnParts[1] || 'Token');
        captureUndoSnapshot('Spawn Asset');
        store.setState(function (inner3) {
          var next3 = Object.assign({}, inner3);
          var token = { id: uid(faction), name: name, faction: faction, hp: 8, maxHp: 8, status: [], q: q, r: r, image: '', size: 1 };
          next3.tokens = (inner3.tokens || []).concat([token]);
          next3.selectedTokenId = token.id;
          next3.selectedTokenIds = [token.id];
          persist(next3);
          return next3;
        });
        addHistory('Asset placed: ' + name + ' at ' + toKey(q, r) + '.');
      } else if (action === 'spawn-bestiary') {
        var rawBestiary = String(value || '');
        var splitAt = rawBestiary.indexOf('|');
        var bestiaryId = splitAt >= 0 ? rawBestiary.slice(0, splitAt) : rawBestiary;
        var bestiaryName = splitAt >= 0 ? rawBestiary.slice(splitAt + 1) : '';
        var bestiaryPool = Array.isArray(store.getState().codexBestiary) ? store.getState().codexBestiary : [];
        var bestiaryEntry = bestiaryPool.find(function (e) { return String(e.id || '') === String(bestiaryId || ''); }) || null;
        if (!bestiaryEntry && bestiaryName) {
          var lowerBestiaryName = String(bestiaryName || '').toLowerCase();
          bestiaryEntry = bestiaryPool.find(function (e) { return String(e && e.name || '').toLowerCase() === lowerBestiaryName; }) || null;
        }
        if (bestiaryEntry) {
          spawnBestiaryToken(bestiaryEntry, q, r);
        } else {
          var fallbackName = String(bestiaryName || bestiaryId || 'Enemy');
          applyCombatAssetActionAt('spawn', 'monster:' + fallbackName, q, r, true);
          safeNotif('Bestiary profile missing; spawned fallback token for ' + fallbackName + '.', 'warn');
        }
      } else if (action === 'preset') {
        var presets = {
          urban: { cols: 20, rows: 20, weather: 'none' },
          storm: { cols: 18, rows: 10, weather: 'storm' },
          fog: { cols: 18, rows: 12, weather: 'fog' },
          blank: { cols: 15, rows: 15, weather: 'none' }
        };
        var preset = presets[String(value || '')] || presets.urban;
        captureUndoSnapshot('Apply Preset');
        store.setState(function (inner4) {
          var next4 = Object.assign({}, inner4);
          next4.board = Object.assign({}, inner4.board || {}, { cols: Number(preset.cols || 15), rows: Number(preset.rows || 15), weatherOverlay: String(preset.weather || 'none') });
          persist(next4);
          return next4;
        });
        addHistory('Battlemap preset applied: ' + String(value || 'urban') + '.');
        safeNotif('Battlemap preset applied.', 'good');
      } else if (action === 'set-map') {
        var mapEntry = (ensureCombatSceneRulesExtensions(store.getState().sceneRules).assetFolders.mapAssets || []).find(function (entry) {
          return String(entry.id || '') === String(value || '');
        }) || null;
        if (mapEntry && mapEntry.src) {
          captureUndoSnapshot('Apply Uploaded Map');
          store.setState(function (innerSetMap) {
            var nextSetMap = Object.assign({}, innerSetMap);
            nextSetMap.board = Object.assign({}, innerSetMap.board || {}, { background: String(mapEntry.src || '') });
            persist(nextSetMap);
            return nextSetMap;
          });
          backgroundCache.src = '';
          backgroundCache.img = null;
          addHistory('Battlemap applied from uploaded folder: ' + String(mapEntry.name || 'Uploaded Map') + '.');
          safeNotif('Battlemap applied from asset dock.', 'good');
        }
      } else if (action === 'stock-cache') {
        ensureLootCacheObjectAt(q, r);
        if (String(value || '') === 'credits') stockLootCacheAt(q, r, { credits: true, items: false, affixes: false, tier: 8 });
        else stockLootCacheAt(q, r, { credits: true, items: true, affixes: true, tier: 8 });
      } else if (action === 'hazard-check') {
        var hazardToken = byId(store.getState().selectedTokenId);
        if (!hazardToken) safeNotif('Select a token to run hazard checks.', 'warn');
        else runHazardCheckDialogForToken(hazardToken, q, r, getLayerGameplayProfile(store.getState(), q, r));
      } else if (action === 'hazard-config') {
        configureHazardCheckAt(q, r);
      } else if (action === 'template') {
        if (typeof window.setupSceneTemplate === 'function') window.setupSceneTemplate(value || 'quick');
      } else if (action === 'upload-map') {
        var uploadMapBtn = document.getElementById('combatUploadMapBtn');
        setCombatAssetDrawerOpen(true);
        if (uploadMapBtn && typeof uploadMapBtn.click === 'function') uploadMapBtn.click();
      } else if (action === 'upload-map-folder') {
        var mapFolderInput = document.getElementById('combatMapImageInput');
        setCombatAssetDrawerOpen(true);
        if (mapFolderInput && typeof mapFolderInput.click === 'function') mapFolderInput.click();
      } else if (action === 'upload-hex-folder') {
        var hexFolderInput = document.getElementById('combatHexAssetImageInput');
        setCombatAssetDrawerOpen(true);
        if (hexFolderInput && typeof hexFolderInput.click === 'function') hexFolderInput.click();
      } else if (action === 'open-drawer') {
        setCombatAssetDrawerOpen(true);
        var drawer = document.getElementById('combatBestiaryDrawer');
        if (drawer && typeof drawer.scrollIntoView === 'function') drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      drawBoard();
      updateUiPanels();
    }

    window.applyCombatAssetActionAt = applyCombatAssetActionAt;

    window.applyCombatHazardConfig = function (q, r) {
      var labelEl = document.getElementById('combatHazardConfigLabel');
      var ddEl = document.getElementById('combatHazardConfigDd');
      var damageEl = document.getElementById('combatHazardConfigDamage');
      var dieEl = document.getElementById('combatHazardConfigDie');
      var ok = saveHazardCheckConfigAt(q, r, {
        label: String(labelEl && labelEl.value || ''),
        dd: Number(ddEl && ddEl.value || 4),
        onFailDamage: Number(damageEl && damageEl.value || 1),
        dieKey: String(dieEl && dieEl.value || 'defend')
      });
      if (ok && typeof window.closeModal === 'function') window.closeModal();
      return ok;
    };

    window.clearCombatHazardConfig = function (q, r) {
      var ok = clearHazardCheckConfigAt(q, r);
      if (ok && typeof window.closeModal === 'function') window.closeModal();
      return ok;
    };

    window.resolveCombatHazardCheck = function (tokenId, q, r, failDamage) {
      var dieEl = document.getElementById('combatHazardRunDie');
      var totalEl = document.getElementById('combatHazardRunTotal');
      var rawTotal = String(totalEl && totalEl.value || '').trim();
      var manualTotal = rawTotal ? Number(rawTotal) : NaN;
      var ok = resolveHazardCheckForToken(tokenId, q, r, {
        dieKey: String(dieEl && dieEl.value || 'defend'),
        manualTotal: manualTotal,
        failDamage: Number(failDamage || 1)
      });
      if (ok || Number.isFinite(manualTotal) || !isManualRollModeActive()) {
        if (typeof window.closeModal === 'function') window.closeModal();
      }
      return ok;
    };

    window.applyCombatLootCacheModal = function (q, r) {
      var modeEl = document.getElementById('combatLootCacheMode');
      var tierEl = document.getElementById('combatLootCacheTier');
      var mode = String(modeEl && modeEl.value || 'balanced');
      var tier = Math.max(1, Math.min(20, Number(tierEl && tierEl.value || 8)));
      var cfg = { credits: true, items: true, affixes: true, tier: tier };
      if (mode === 'credits') cfg = { credits: true, items: false, affixes: false, tier: tier };
      else if (mode === 'items-affixes') cfg = { credits: false, items: true, affixes: true, tier: tier };
      var ok = stockLootCacheAt(q, r, cfg);
      if (ok && typeof window.openModal === 'function') {
        window.openModal('Loot Cache Controls', buildLootCacheModalHtml(q, r), null, { preventScroll: true, focusTrap: true });
      }
      return ok;
    };

    window.deleteCombatMapItemByKey = function (layerName, key) {
      var ok = deleteMapItemAt(layerName, key, { force: true });
      if (ok && typeof window.closeModal === 'function') window.closeModal();
      return ok;
    };

    window.openCombatHazardConfigModal = configureHazardCheckAt;
    window.openCombatLootCacheModal = openLootCacheModal;
    if (typeof window.generateCombatTokenLootFromButton !== 'function') {
      window.generateCombatTokenLootFromButton = function (btn, force) {
        var tokenId = btn && typeof btn.getAttribute === 'function'
          ? String(btn.getAttribute('data-token-id') || '')
          : '';
        if (!tokenId) {
          safeNotif('Could not resolve token for loot generation.', 'warn');
          return false;
        }
        return generatePersonalLootForToken(tokenId, { force: !!force });
      };
    }
    if (typeof window.generateCombatTokenLoot !== 'function') {
      window.generateCombatTokenLoot = function (tokenId, force) {
        return generatePersonalLootForToken(String(tokenId || ''), { force: !!force });
      };
    }
    window.moveCombatMapItemByKey = moveMapItemTo;
    window.copySelectedCombatMapItem = copySelectedMapItemToClipboard;
    window.pasteCombatMapItemAt = pasteMapItemFromClipboard;

    window.combatAssetAction = function combatAssetAction(kind, payload) {
      var action = String(kind || '');
      var value = String(payload || '');
      var st = store.getState();
      var dropHex = getDefaultAssetDropHex(st, st.selectedTokenId);
      var placeNow = action === 'set-tool' || action === 'spawn' || action === 'spawn-bestiary' || action === 'stock-cache' || action === 'set-map' || action === 'preset';
      applyCombatAssetActionAt(action, value, Number(dropHex.q || 0), Number(dropHex.r || 0), placeNow);
      if (placeNow) {
        safeNotif('Placed ' + action + ' at ' + toKey(Number(dropHex.q || 0), Number(dropHex.r || 0)) + '.', 'good');
      }
    };

    var toolbarSelectBtn = document.getElementById('combatToolbarSelectBtn');
    if (toolbarSelectBtn && !toolbarSelectBtn._bound) {
      toolbarSelectBtn._bound = true;
      toolbarSelectBtn.onclick = function () { setToolMode('select'); };
    }

    var toolbarDrawBtn = document.getElementById('combatToolbarDrawBtn');
    if (toolbarDrawBtn && !toolbarDrawBtn._bound) {
      toolbarDrawBtn._bound = true;
      toolbarDrawBtn.onclick = function () { setToolMode('paint'); };
    }

    var toolbarTextBtn = document.getElementById('combatToolbarTextBtn');
    if (toolbarTextBtn && !toolbarTextBtn._bound) {
      toolbarTextBtn._bound = true;
      toolbarTextBtn.onclick = function () { setToolMode('text'); };
    }

    var toolbarMeasureBtn = document.getElementById('combatToolbarMeasureBtn');
    if (toolbarMeasureBtn && !toolbarMeasureBtn._bound) {
      toolbarMeasureBtn._bound = true;
      toolbarMeasureBtn.onclick = function () { setToolMode('ruler'); };
    }

    var toolbarRulerBtn = document.getElementById('combatToolbarRulerBtn');
    if (toolbarRulerBtn && !toolbarRulerBtn._bound) {
      toolbarRulerBtn._bound = true;
      toolbarRulerBtn.onclick = function () { setToolMode('ruler'); };
    }

    var toolbarSpellCastBtn = document.getElementById('combatToolbarSpellCastBtn');
    if (toolbarSpellCastBtn && !toolbarSpellCastBtn._bound) {
      toolbarSpellCastBtn._bound = true;
      toolbarSpellCastBtn.onclick = function () {
        var st3 = store.getState();
        var preview3 = normalizeCombatSpellPreview(st3.spellPreview);
        if (!preview3.active) {
          openQuickEffectsModal();
          return;
        }
        castCombatSpellPreview();
      };
    }

    var toolbarPanBtn = document.getElementById('combatToolbarPanBtn');
    if (toolbarPanBtn && !toolbarPanBtn._bound) {
      toolbarPanBtn._bound = true;
      toolbarPanBtn.onclick = function () { setToolMode('pan'); };
    }

    var toolbarPingBtn = document.getElementById('combatToolbarPingBtn');
    if (toolbarPingBtn && !toolbarPingBtn._bound) {
      toolbarPingBtn._bound = true;
      toolbarPingBtn.onclick = function () { setToolMode('ping'); };
    }

    var toolbarZoomInBtn = document.getElementById('combatToolbarZoomInBtn');
    if (toolbarZoomInBtn && !toolbarZoomInBtn._bound) {
      toolbarZoomInBtn._bound = true;
      toolbarZoomInBtn.onclick = function () { changeZoom(0.1); };
    }

    var toolbarZoomOutBtn = document.getElementById('combatToolbarZoomOutBtn');
    if (toolbarZoomOutBtn && !toolbarZoomOutBtn._bound) {
      toolbarZoomOutBtn._bound = true;
      toolbarZoomOutBtn.onclick = function () { changeZoom(-0.1); };
    }

    var toolbarZoomResetBtn = document.getElementById('combatToolbarZoomResetBtn');
    if (toolbarZoomResetBtn && !toolbarZoomResetBtn._bound) {
      toolbarZoomResetBtn._bound = true;
      toolbarZoomResetBtn.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.board = Object.assign({}, state.board, { zoom: 1 });
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var zoomSlider = document.getElementById('combatZoomSlider');
    if (zoomSlider && !zoomSlider._bound) {
      zoomSlider._bound = true;
      zoomSlider.value = String(Math.round(Number(store.getState().board && store.getState().board.zoom || 1) * 100));
      zoomSlider.oninput = function () {
        var pct = Math.max(50, Math.min(230, Number(zoomSlider.value || 100)));
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.board = Object.assign({}, state.board, { zoom: pct / 100 });
          persist(next);
          return next;
        });
        drawBoard();
      };
    }

    var snapThresholdSlider = document.getElementById('combatSnapThresholdSlider');
    if (snapThresholdSlider && !snapThresholdSlider._bound) {
      snapThresholdSlider._bound = true;
      snapThresholdSlider.oninput = function () {
        var pct = Math.max(0, Math.min(100, Number(snapThresholdSlider.value || 30)));
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.board = Object.assign({}, state.board, { snapThreshold: pct / 100 });
          persist(next);
          return next;
        });
        drawBoard();
      };
    }

    var toolbarEffectsBtn = document.getElementById('combatToolbarEffectsBtn');
    if (toolbarEffectsBtn && !toolbarEffectsBtn._bound) {
      toolbarEffectsBtn._bound = true;
      toolbarEffectsBtn.onclick = function () { openQuickEffectsModal(); };
    }

    var toolbarDiceBtn = document.getElementById('combatToolbarDiceBtn');
    if (toolbarDiceBtn && !toolbarDiceBtn._bound) {
      toolbarDiceBtn._bound = true;
      toolbarDiceBtn.onclick = function () {
        var expr = window.prompt('Dice roll (e.g. 1d20+4, 2d6!+1 for exploding):', '1d20');
        if (!expr) return;
        var m = String(expr).trim().match(/^(\d+)d(\d+)(!)?\s*([+-]\s*\d+)?$/i);
        if (!m) {
          safeNotif('Invalid dice format.', 'warn');
          return;
        }
        var count = Math.max(1, Math.min(20, Number(m[1] || 1)));
        var die = Math.max(2, Math.min(100, Number(m[2] || 20)));
        var exploding = !!m[3];
        var mod = Number(String(m[4] || '0').replace(/\s+/g, '')) || 0;
        var rolls = [];
        var total = mod;
        for (var i = 0; i < count; i++) {
          var roll = rollDie(die);
          rolls.push(roll);
          total += roll;
          if (exploding) {
            while (roll === die) {
              roll = rollDie(die);
              rolls.push(roll);
              total += roll;
            }
          }
        }
        addHistory('Dice: ' + expr + ' => [' + rolls.join(', ') + '] ' + (mod ? ((mod > 0 ? '+' : '') + mod + ' ') : '') + '= ' + total + '.');
        safeNotif('Rolled ' + expr + ' = ' + total + '.', 'good');
        updateUiPanels();
      };
    }

    var toolbarTurnOrderBtn = document.getElementById('combatToolbarTurnOrderBtn');
    if (toolbarTurnOrderBtn && !toolbarTurnOrderBtn._bound) {
      toolbarTurnOrderBtn._bound = true;
      toolbarTurnOrderBtn.onclick = function () {
        var panel = document.getElementById('combatFeedPanel');
        if (panel && panel.classList.contains('collapsed')) panel.classList.remove('collapsed');
        var list = document.getElementById('combatInitiativeList');
        if (list && typeof list.scrollIntoView === 'function') list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
    }

    var railSelectBtn = document.getElementById('combatRailSelectBtn');
    if (railSelectBtn && !railSelectBtn._bound) {
      railSelectBtn._bound = true;
      railSelectBtn.onclick = function () { setToolMode('select'); };
    }

    var railPanBtn = document.getElementById('combatRailPanBtn');
    if (railPanBtn && !railPanBtn._bound) {
      railPanBtn._bound = true;
      railPanBtn.onclick = function () { setToolMode('pan'); };
    }

    var railDrawBtn = document.getElementById('combatRailDrawBtn');
    if (railDrawBtn && !railDrawBtn._bound) {
      railDrawBtn._bound = true;
      railDrawBtn.onclick = function () { setToolMode('paint'); };
    }

    var railTextBtn = document.getElementById('combatRailTextBtn');
    if (railTextBtn && !railTextBtn._bound) {
      railTextBtn._bound = true;
      railTextBtn.onclick = function () { setToolMode('text'); };
    }

    var railMeasureBtn = document.getElementById('combatRailMeasureBtn');
    if (railMeasureBtn && !railMeasureBtn._bound) {
      railMeasureBtn._bound = true;
      railMeasureBtn.onclick = function () { setToolMode('ruler'); };
    }

    var railFogBtn = document.getElementById('combatRailFogBtn');
    if (railFogBtn && !railFogBtn._bound) {
      railFogBtn._bound = true;
      railFogBtn.onclick = function () { setToolMode('fog'); };
    }

    var railEffectsBtn = document.getElementById('combatRailEffectsBtn');
    if (railEffectsBtn && !railEffectsBtn._bound) {
      railEffectsBtn._bound = true;
      railEffectsBtn.onclick = function () { openQuickEffectsModal(); };
    }

    var railDiceBtn = document.getElementById('combatRailDiceBtn');
    if (railDiceBtn && !railDiceBtn._bound) {
      railDiceBtn._bound = true;
      railDiceBtn.onclick = function () {
        var toolbarDiceBtn = document.getElementById('combatToolbarDiceBtn');
        if (toolbarDiceBtn) toolbarDiceBtn.click();
      };
    }

    function patchRulerOptions(patch) {
      store.setState(function (state) {
        var next = Object.assign({}, state);
        next.rulerOptions = Object.assign({ shape: 'line', fadeDelay: 'linger', snapToGrid: true }, state.rulerOptions || {}, patch || {});
        persist(next);
        return next;
      });
      drawBoard();
      updateUiPanels();
    }

    var measureShapeLineBtn = document.getElementById('combatMeasureShapeLineBtn');
    if (measureShapeLineBtn && !measureShapeLineBtn._bound) {
      measureShapeLineBtn._bound = true;
      measureShapeLineBtn.onclick = function () { patchRulerOptions({ shape: 'line' }); };
    }

    var measureShapeConeBtn = document.getElementById('combatMeasureShapeConeBtn');
    if (measureShapeConeBtn && !measureShapeConeBtn._bound) {
      measureShapeConeBtn._bound = true;
      measureShapeConeBtn.onclick = function () { patchRulerOptions({ shape: 'cone' }); };
    }

    var measureShapeRadiusBtn = document.getElementById('combatMeasureShapeRadiusBtn');
    if (measureShapeRadiusBtn && !measureShapeRadiusBtn._bound) {
      measureShapeRadiusBtn._bound = true;
      measureShapeRadiusBtn.onclick = function () { patchRulerOptions({ shape: 'radius' }); };
    }

    var measureSnapBtn = document.getElementById('combatMeasureSnapBtn');
    if (measureSnapBtn && !measureSnapBtn._bound) {
      measureSnapBtn._bound = true;
      measureSnapBtn.onclick = function () {
        var st = store.getState();
        var current = !!(st.rulerOptions && st.rulerOptions.snapToGrid);
        patchRulerOptions({ snapToGrid: !current });
      };
    }

    var measureFadeBtn = document.getElementById('combatMeasureFadeBtn');
    if (measureFadeBtn && !measureFadeBtn._bound) {
      measureFadeBtn._bound = true;
      measureFadeBtn.onclick = function () {
        var st2 = store.getState();
        var current2 = String(st2.rulerOptions && st2.rulerOptions.fadeDelay || 'linger');
        patchRulerOptions({ fadeDelay: current2 === 'linger' ? 'instant' : 'linger' });
      };
    }

    var assetsBtn = document.getElementById('combatAssetsBtn');
    if (assetsBtn && !assetsBtn._bound) {
      assetsBtn._bound = true;
      assetsBtn.onclick = function () {
        var ui = normalizeCombatUi(store.getState().ui);
        setCombatAssetDrawerOpen(!ui.assetDrawerOpen);
      };
    }

    var railRulesBtn = document.getElementById('combatRailRulesBtn');
    if (railRulesBtn && !railRulesBtn._bound) {
      railRulesBtn._bound = true;
      railRulesBtn.onclick = function () { showCombatRulesReference(); };
    }

    var settingsBtn = document.getElementById('combatSettingsBtn');
    if (settingsBtn && !settingsBtn._bound) {
      settingsBtn._bound = true;
      settingsBtn.onclick = function () {
        openCombatSettingsHub();
      };
    }

    var contentBladeBtn = document.getElementById('combatContentBladeBtn');
    if (contentBladeBtn && !contentBladeBtn._bound) {
      contentBladeBtn._bound = true;
      contentBladeBtn.onclick = function () {
        var panel = document.getElementById('contentBladePanel');
        if (panel && panel.classList.contains('open')) {
          if (typeof window.toggleContentBlade === 'function') window.toggleContentBlade();
          return;
        }
        if (typeof window.openContentBlade === 'function') window.openContentBlade('rules');
      };
    }

    var activate = document.getElementById('combatActivateCellBtn');
    if (activate && !activate._bound) {
      activate._bound = true;
      activate.onclick = function () {
        var state = store.getState();
        var token = byId(state.selectedTokenId);
        if (!token) return;
        var key = toKey(token.q, token.r);
        var interactive = String(state.layers.interactives && state.layers.interactives[key] || '').toLowerCase();
        if (!interactive) {
          addHistory('No interactive object on current hex.');
          updateUiPanels();
          return;
        }
        var label = interactive;
        var used = false;
        if (/chest|cache|loot/.test(interactive)) {
          addHistory((token.name || 'Token') + ' opens ' + label + ' and secures supplies.');
          if (token.isPlayer && typeof window.changeCounter === 'function') {
            window.changeCounter('tmw', 1);
            if (typeof window.showNotif === 'function') window.showNotif('Loot cache: +1 Teamwork.', 'good');
          }
          used = true;
        } else if (/shrine|relay|beacon/.test(interactive)) {
          addHistory((token.name || 'Token') + ' channels ' + label + ' for battlefield stability.');
          if (token.isPlayer && typeof window.setHealth === 'function') {
            window.setHealth(Math.max(0, Number(window.S && window.S.health || 0) - 1));
            if (typeof window.showNotif === 'function') window.showNotif('Shrine effect: healed 1 damage.', 'good');
          }
          used = true;
        } else if (/switch|door|console/.test(interactive)) {
          addHistory((token.name || 'Token') + ' triggers ' + label + ' and changes map state.');
          store.setState(function (inner) {
            var next = Object.assign({}, inner);
            next.layers = Object.assign({}, inner.layers);
            next.layers.objects = Object.assign({}, inner.layers.objects);
            if (next.layers.objects[key] === 'door') delete next.layers.objects[key];
            else next.layers.objects[key] = 'door';
            persist(next);
            return next;
          });
          used = true;
        }
        if (!used) addHistory((token.name || 'Token') + ' activates ' + label + ' at ' + key + '.');
        updateUiPanels();
        drawBoard();
      };
    }

    var fogToggle = document.getElementById('combatFogToggleBtn');
    if (fogToggle && !fogToggle._bound) {
      fogToggle._bound = true;
      fogToggle.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          var fog = Object.assign({
            enabled: false,
            showMask: true,
            revealMode: 'manual',
            visionRadius: 3,
            sharedVision: true,
            explorerMode: true,
            softEdges: true,
            seen: {},
            revealed: {},
            revealOrder: {},
            revealSeq: 0,
            revealStep: 0
          }, state.fog || {});
          next.fog = Object.assign({}, fog, {
            enabled: !fog.enabled,
            seen: Object.assign({}, fog.seen || {}),
            revealed: Object.assign({}, fog.revealed || {}),
            revealOrder: Object.assign({}, fog.revealOrder || {})
          });
          next = syncFogExplorerMemory(next);
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var fogBrush = document.getElementById('combatFogBrushBtn');
    if (fogBrush && !fogBrush._bound) {
      fogBrush._bound = true;
      fogBrush.onclick = function () {
        store.setState({ fogBrush: store.getState().fogBrush === 'hide' ? 'reveal' : 'hide' });
        updateUiPanels();
      };
    }

    var fogClear = document.getElementById('combatFogClearBtn');
    if (fogClear && !fogClear._bound) {
      fogClear._bound = true;
      fogClear.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.fog = Object.assign({}, state.fog, { seen: {}, revealed: {}, revealOrder: {}, revealSeq: 0, revealStep: 0 });
          persist(next);
          return next;
        });
        addHistory('Fog reveal map cleared.');
        drawBoard();
        updateUiPanels();
      };
    }

    var fogModeBtn = document.getElementById('combatFogModeBtn');
    if (fogModeBtn && !fogModeBtn._bound) {
      fogModeBtn._bound = true;
      fogModeBtn.onclick = function () {
        store.setState(function (state) {
          var modes = ['manual', 'los', 'ordered'];
          var current = String(state.fog && state.fog.revealMode || 'manual');
          var idx = modes.indexOf(current);
          var nextMode = modes[(idx + 1) % modes.length];
          var next = Object.assign({}, state);
          next.fog = Object.assign({}, state.fog, { revealMode: nextMode });
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var fogAdvanceBtn = document.getElementById('combatFogAdvanceBtn');
    if (fogAdvanceBtn && !fogAdvanceBtn._bound) {
      fogAdvanceBtn._bound = true;
      fogAdvanceBtn.onclick = function () {
        store.setState(function (state) {
          if (String(state.fog && state.fog.revealMode || 'manual') !== 'ordered') return state;
          var maxSeq = Math.max(0, Number(state.fog && state.fog.revealSeq || 0));
          var step = Math.max(0, Number(state.fog && state.fog.revealStep || 0));
          var next = Object.assign({}, state);
          next.fog = Object.assign({}, state.fog, { revealStep: Math.min(maxSeq, step + 1) });
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var fogResetOrderBtn = document.getElementById('combatFogResetOrderBtn');
    if (fogResetOrderBtn && !fogResetOrderBtn._bound) {
      fogResetOrderBtn._bound = true;
      fogResetOrderBtn.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.fog = Object.assign({}, state.fog, { revealOrder: {}, revealSeq: 0, revealStep: 0 });
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var fogSharedBtn = document.getElementById('combatFogSharedBtn');
    if (fogSharedBtn && !fogSharedBtn._bound) {
      fogSharedBtn._bound = true;
      fogSharedBtn.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.fog = Object.assign({}, state.fog, { sharedVision: !(state.fog && state.fog.sharedVision) });
          next = syncFogExplorerMemory(next);
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var fogMemoryBtn = document.getElementById('combatFogMemoryBtn');
    if (fogMemoryBtn && !fogMemoryBtn._bound) {
      fogMemoryBtn._bound = true;
      fogMemoryBtn.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.fog = Object.assign({}, state.fog, { explorerMode: !(state.fog && state.fog.explorerMode) });
          next = syncFogExplorerMemory(next);
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var fogSoftBtn = document.getElementById('combatFogSoftBtn');
    if (fogSoftBtn && !fogSoftBtn._bound) {
      fogSoftBtn._bound = true;
      fogSoftBtn.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.fog = Object.assign({}, state.fog, { softEdges: !(state.fog && state.fog.softEdges) });
          persist(next);
          return next;
        });
        drawBoard();
        updateUiPanels();
      };
    }

    var applyWeather = document.getElementById('combatApplyWeatherBtn');
    if (applyWeather && !applyWeather._bound) {
      applyWeather._bound = true;
      applyWeather.onclick = function () {
        if (!guardCampaignGmSceneControl('Only the GM can change shared VTT weather.')) return;
        var weatherSelect = document.getElementById('combatWeatherSelect');
        var weatherIntensity = document.getElementById('combatWeatherIntensity');
        var weather = String(weatherSelect && weatherSelect.value || 'none');
        var intensity = Math.max(0, Math.min(5, Number(weatherIntensity && weatherIntensity.value || 0)));
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.board = Object.assign({}, state.board, { weatherOverlay: weather, weatherIntensity: intensity });
          persist(next);
          return next;
        });
        addHistory('Weather set to ' + weather + ' (intensity ' + intensity + ').');
        drawBoard();
        updateUiPanels();
      };
    }

    function runLegacyAction(kind) {
      var stateBefore = store.getState();
      var selectedActor = byId(stateBefore.selectedTokenId);
      if (kind === 'enemy' && selectedActor && String(selectedActor.faction) === 'monster') {
        var tokenTargetSelEnemy = document.getElementById('combatTokenTargetSel');
        var tIdEnemy = String(tokenTargetSelEnemy && tokenTargetSelEnemy.value || '');
        var targetEnemy = tIdEnemy ? byId(tIdEnemy) : null;
        var tokenActionSelEnemy = document.getElementById('combatTokenActionSel');
        var selectedEnemyAction = String(tokenActionSelEnemy && tokenActionSelEnemy.value || 'enemy_action');
        executeEnemyTokenAction(selectedActor, targetEnemy, selectedEnemyAction);
        return;
      }
      if (kind === 'enemy') {
        var activeRow = stateBefore.initiative && stateBefore.initiative[stateBefore.initiativeIndex] || null;
        var activeActor = activeRow ? byId(activeRow.tokenId) : null;
        if (activeActor && String(activeActor.faction) === 'monster') {
          executeEnemyTokenAction(activeActor, null, 'enemy_action');
          return;
        }
        var firstEnemy = (stateBefore.tokens || []).find(function (row) {
          return row && String(row.faction) === 'monster' && !isTokenDead(row);
        }) || null;
        if (firstEnemy) {
          safeNotif('Not enemy turn yet. Advance initiative to Enemy lane.', 'warn');
          return;
        }
      }
      var beforeSnapshot = captureLegacyCombatSnapshot();
      try {
        if (kind === 'strike' && typeof window.rollAttack === 'function') window.rollAttack('strike');
        else if (kind === 'shoot' && typeof window.rollAttack === 'function') window.rollAttack('shoot');
        else if (kind === 'defend' && typeof window.rollDefend === 'function') window.rollDefend();
        else if (kind === 'trauma' && typeof window.rollTraumaCheck === 'function') window.rollTraumaCheck();
        else if (kind === 'enemy' && typeof window.doEnemyTurn === 'function') window.doEnemyTurn();
      } catch (_err) {}
      resolveLegacyDamageBridge(kind, beforeSnapshot);
      updateUiPanels();
    }

    function captureLegacyCombatSnapshot() {
      var snap = {
        wayfarer: getWayfarerHealthSnapshot(),
        enemyStressById: {},
        enemyNameById: {}
      };
      if (window.S && Array.isArray(window.S.enemies)) {
        window.S.enemies.forEach(function (enemy) {
          if (!enemy || enemy.ally) return;
          var id = Number(enemy.id || 0);
          if (id <= 0) return;
          snap.enemyStressById[id] = Math.max(0, Number(enemy.stress || 0));
          snap.enemyNameById[id] = String(enemy.name || 'Enemy');
        });
      }
      return snap;
    }

    function resolveLegacyDamageBridge(kind, beforeSnapshot) {
      var before = beforeSnapshot && typeof beforeSnapshot === 'object'
        ? beforeSnapshot
        : captureLegacyCombatSnapshot();
      var afterWayfarer = getWayfarerHealthSnapshot();
      var wayfarerDamageDelta = Math.max(0,
        Number(afterWayfarer.damage || 0) - Number(before.wayfarer && before.wayfarer.damage || 0)
      );

      var wayfarerTokenChanged = syncWayfarerTokenHealthFromSheet();
      var enemyTokenChanged = syncLegacyEnemyStressToTokens();

      var topEnemyDelta = 0;
      var topEnemyName = '';
      if (window.S && Array.isArray(window.S.enemies)) {
        window.S.enemies.forEach(function (enemy) {
          if (!enemy || enemy.ally) return;
          var id = Number(enemy.id || 0);
          if (id <= 0) return;
          var prevStress = Math.max(0, Number(before.enemyStressById && before.enemyStressById[id] || 0));
          var nextStress = Math.max(0, Number(enemy.stress || 0));
          var delta = Math.max(0, nextStress - prevStress);
          if (delta > topEnemyDelta) {
            topEnemyDelta = delta;
            topEnemyName = String(enemy.name || (before.enemyNameById && before.enemyNameById[id]) || 'Enemy');
          }
        });
      }

      var notifEl = document.getElementById('combatLastNotification');
      if (notifEl) {
        if (wayfarerDamageDelta > 0 && topEnemyDelta > 0) {
          notifEl.textContent = 'Structured sync: Wayfarer takes ' + wayfarerDamageDelta + ' damage · ' + topEnemyName + ' takes ' + topEnemyDelta + ' stress.';
        } else if (wayfarerDamageDelta > 0) {
          notifEl.textContent = 'Structured sync: Wayfarer takes ' + wayfarerDamageDelta + ' damage.';
        } else if (topEnemyDelta > 0) {
          notifEl.textContent = 'Structured sync: ' + topEnemyName + ' takes ' + topEnemyDelta + ' stress.';
        } else if (wayfarerTokenChanged || enemyTokenChanged) {
          notifEl.textContent = 'Structured sync: token state refreshed from combat state.';
        }
      }

      drawBoard();
    }

    function enemyNameCanonicalKey(name) {
      return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*$/, '')
        .replace(/\s+#?\d+\s*$/, '')
        .trim();
    }

    function findLegacyEnemyForToken(token) {
      if (!token || !window.S || !Array.isArray(window.S.enemies)) return null;
      var hostiles = window.S.enemies.filter(function (enemy) {
        return enemy && !enemy.ally;
      });
      if (!hostiles.length) return null;
      var sourceId = Number(token.sourceEnemyId || 0);
      if (sourceId > 0) {
        var bySource = hostiles.find(function (enemy) { return Number(enemy.id || 0) === sourceId; });
        if (bySource) return bySource;
      }
      var exactName = String(token.name || '').trim().toLowerCase();
      if (exactName) {
        var byExact = hostiles.find(function (enemy) {
          return String(enemy.name || '').trim().toLowerCase() === exactName;
        });
        if (byExact) return byExact;
      }
      var canonical = enemyNameCanonicalKey(token.name || '');
      if (!canonical) return null;
      return hostiles.find(function (enemy) {
        return enemyNameCanonicalKey(enemy && enemy.name || '') === canonical;
      }) || null;
    }

    function parseWayfarerHitDamageFromResult() {
      var candidates = [
        document.getElementById('attackResult'),
        document.getElementById('wayfarerActionResult')
      ];
      for (var i = 0; i < candidates.length; i++) {
        var node = candidates[i];
        var text = String(node && (node.textContent || node.innerText) || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        var m = text.match(/HIT!\s*([0-9]+)\s*(?:Stress|Health\s*damage)/i);
        if (m) return Math.max(0, Number(m[1] || 0));
      }
      return 0;
    }

    var tokenExecuteBtn = document.getElementById('combatTokenExecuteActionBtn');
    if (tokenExecuteBtn && !tokenExecuteBtn._bound) {
      tokenExecuteBtn._bound = true;
      tokenExecuteBtn.onclick = function () {
        var tokenActionSel = document.getElementById('combatTokenActionSel');
        var tokenTargetSel = document.getElementById('combatTokenTargetSel');
        var actionVal = String(tokenActionSel && tokenActionSel.value || '');
        var targetVal = String(tokenTargetSel && tokenTargetSel.value || '');
        var actor = byId(store.getState().selectedTokenId);
        if (!actor) {
          safeNotif('Select a token first.', 'warn');
          return;
        }
        if (!canCurrentUserDriveTokenTurn(actor)) {
          safeNotif(getCampaignCombatTurnDeniedMessage(actor), 'warn');
          return;
        }
        if (String(actor.faction) === 'monster') {
          var directTarget = targetVal ? byId(targetVal) : null;
          executeEnemyTokenAction(actor, directTarget, actionVal || 'enemy_action');
          return;
        }
        if (!actor.isPlayer && String(actor.faction) === 'player') {
          if (!actionVal) {
            safeNotif('Choose a token action first.', 'warn');
            return;
          }
          if (!spendUnitAction(actor.id)) {
            safeNotif(String(actor.name || 'Ally') + ' has no actions left this turn.', 'warn');
            return;
          }

          var lowerActionAlly = String(actionVal || '').toLowerCase();
          if (/utility|use_item|backpack|hack|flavor|personal_flavor/.test(lowerActionAlly)) {
            store.setState(function (state) {
              var next = Object.assign({}, state);
              next.sceneRules = Object.assign({}, state.sceneRules, { supportBonus: 2 });
              persist(next);
              return next;
            });
            addHistory(String(actor.name || 'Ally') + ' used support utility: next action gets +2 scene bonus.');
            drawBoard();
            updateUiPanels();
            return;
          }

          if (lowerActionAlly.indexOf('defend') >= 0) {
            store.setState(function (state) {
              var next = Object.assign({}, state);
              var key = toKey(actor.q, actor.r);
              next.layers = Object.assign({}, state.layers);
              next.layers.objects = Object.assign({}, state.layers.objects);
              next.layers.objects[key] = 'obstacle';
              persist(next);
              return next;
            });
            addHistory(String(actor.name || 'Ally') + ' used Defend and fortified their position.');
            drawBoard();
            updateUiPanels();
            return;
          }

          var targetAlly = targetVal ? byId(targetVal) : null;
          if (!targetAlly || String(targetAlly.faction) === 'player' || isTokenDead(targetAlly)) {
            var nearest = (store.getState().tokens || []).filter(function (row) {
              return row && String(row.faction) === 'monster' && !isTokenDead(row);
            }).sort(function (a, b) {
              return hexDistance({ q: actor.q, r: actor.r }, { q: a.q, r: a.r }) - hexDistance({ q: actor.q, r: actor.r }, { q: b.q, r: b.r });
            });
            targetAlly = nearest[0] || null;
          }

          if (!targetAlly) {
            safeNotif('No living enemy target available for ally action.', 'warn');
            updateUiPanels();
            return;
          }

          var rangeToTarget = hexDistance({ q: actor.q, r: actor.r }, { q: targetAlly.q, r: targetAlly.r });
          if (!canActionReachTarget(actionVal, rangeToTarget)) {
            safeNotif('Target is out of range for this ally action.', 'warn');
            updateUiPanels();
            return;
          }

          var supportBonus = Number(store.getState().sceneRules && store.getState().sceneRules.supportBonus || 0);
          var attackRoll = rollDie(20) + supportBonus;
          var dreadDie = Math.max(4, Number(targetAlly.dread || targetAlly.codexDread || 6));
          var damage = Math.max(0, attackRoll - dreadDie);
          if (damage > 0) applyDamageToToken(targetAlly.id, Math.max(1, damage), actor.name || 'Ally');
          store.setState(function (state) {
            var next = Object.assign({}, state);
            next.sceneRules = Object.assign({}, state.sceneRules, { supportBonus: 0 });
            persist(next);
            return next;
          });
          addHistory(String(actor.name || 'Ally') + ' used ' + String(actionVal) + ' vs ' + String(targetAlly.name || 'Enemy') + ' (' + (damage > 0 ? ('hit for ' + Math.max(1, damage)) : 'miss') + ').');
          drawBoard();
          updateUiPanels();
          return;
        }
        if (!actionVal) {
          safeNotif('Choose a token action first.', 'warn');
          return;
        }
        var lowerAction = actionVal.toLowerCase();
        var utilityLike = /use_item|utility|backpack|hack|flavor|personal_flavor/.test(lowerAction);
        if (utilityLike) {
          if (typeof window.openCombatUtilityChooser === 'function') {
            try { window.openCombatUtilityChooser(); } catch (_chooserErr) {}
            addHistory('Wayfarer utility chooser opened from Combat Scene.');
            safeNotif('Select an item/hack/spell/flavor to spend the action and resolve.', 'good');
          } else if (typeof window.promptWayfarerBackpackOrFlavor === 'function') {
            try { window.promptWayfarerBackpackOrFlavor(); } catch (_promptErr) {}
            addHistory('Wayfarer utility menu opened from Combat Scene.');
            safeNotif('Select an item/hack/spell/flavor to spend the action and resolve.', 'good');
          } else {
            safeNotif('Utility actions are unavailable right now.', 'warn');
          }
          updateUiPanels();
          return;
        }
        if (targetVal) {
          var target = byId(targetVal);
          if (target && actor) {
            var dist = hexDistance({ q: actor.q, r: actor.r }, { q: target.q, r: target.r });
            if (typeof window.setCombatSpacing === 'function') {
              var spacingLabel = dist <= 1
                ? 'Engaged (Strike)'
                : (dist <= 2 ? 'Close (Scrolls)' : (dist <= 4 ? 'Nearby (Shoot)' : 'Far (Out of Range)'));
              try { window.setCombatSpacing(spacingLabel, false); } catch (_syncErr) {}
            }
            if (dist <= 1 && /shoot/i.test(actionVal)) {
              safeNotif('Target is engaged. Use Strike instead of Shoot.', 'warn');
              return;
            }
            if (!canActionReachTarget(actionVal, dist)) {
              safeNotif('Target is out of range for this action.', 'warn');
              return;
            }
          }
        }
        var legacySel = document.getElementById('wayfarerActionSel');
        var selectedTarget = targetVal ? byId(targetVal) : null;
        var targetHadLegacyBinding = false;
        if (selectedTarget && String(selectedTarget.faction || '') === 'monster') {
          var legacyEnemy = findLegacyEnemyForToken(selectedTarget);
          if (legacyEnemy) {
            targetHadLegacyBinding = true;
            if (typeof window.setCombatFocusEnemy === 'function') {
              try { window.setCombatFocusEnemy(Number(legacyEnemy.id || 0)); } catch (_focusErr) {}
            }
          }
        }
        var targetBeforeHp = selectedTarget ? Math.max(0, Number(selectedTarget.hp || 0)) : 0;
        var actionSnapshot = captureLegacyCombatSnapshot();
        if (legacySel) legacySel.value = actionVal;
        try {
          if (typeof window.updateWayfarerActionBtn === 'function') window.updateWayfarerActionBtn();
        } catch (_err) {}
        if (typeof window.executeWayfarerAction === 'function') {
          try { window.executeWayfarerAction(); } catch (_err2) {}
        }
        resolveLegacyDamageBridge('wayfarer', actionSnapshot);
        if (selectedTarget && String(selectedTarget.faction || '') === 'monster' && !targetHadLegacyBinding) {
          var targetAfter = byId(String(selectedTarget.id || ''));
          var targetAfterHp = targetAfter ? Math.max(0, Number(targetAfter.hp || 0)) : 0;
          if (targetBeforeHp > 0 && targetBeforeHp === targetAfterHp) {
            var inferredDamage = parseWayfarerHitDamageFromResult();
            if (inferredDamage > 0) {
              applyDamageToToken(String(selectedTarget.id || ''), inferredDamage, actor.name || 'Wayfarer');
              safeNotif('Applied ' + inferredDamage + ' damage directly to selected enemy token.', 'good');
            }
          }
        }
        var selectedOpt = legacySel && legacySel.options ? legacySel.options[legacySel.selectedIndex] : null;
        var actionLabel = selectedOpt ? String(selectedOpt.textContent || actionVal) : actionVal;
        var resultNode = document.getElementById('wayfarerActionResult')
          || document.getElementById('attackResult')
          || document.getElementById('defendResult');
        var resultSummary = String(resultNode && (resultNode.textContent || resultNode.innerText) || '').replace(/\s+/g, ' ').trim();
        addHistory('Wayfarer action executed (Combat Tab rules): ' + actionLabel + (resultSummary ? (' · ' + resultSummary) : '.') );
        updateUiPanels();
      };
    }

    // Enemy Action button removed - use Execute button instead

    var lootBodyBtn = document.getElementById('combatLootBodyBtn');
    var generateLootBtn = document.getElementById('combatGenerateLootBtn');
    if (generateLootBtn && !generateLootBtn._bound) {
      generateLootBtn._bound = true;
      generateLootBtn.onclick = function () {
        var st = store.getState();
        var token = byId(st.selectedTokenId);
        if (!token || token.isPlayer || String(token.faction || '') === 'player') {
          safeNotif('Select an enemy, ally, or NPC token to generate loot.', 'warn');
          return;
        }
        var hasLoot = Array.isArray(token.inventory) && token.inventory.some(Boolean);
        generatePersonalLootForToken(token.id, { force: hasLoot });
      };
    }
    if (lootBodyBtn && !lootBodyBtn._bound) {
      lootBodyBtn._bound = true;
      lootBodyBtn.onclick = function () {
        var st = store.getState();
        var token = byId(st.selectedTokenId);
        if (!token || !isTokenDead(token)) {
          safeNotif('Select a defeated token to loot the body.', 'warn');
          return;
        }
        // Proximity gate: player must be on or adjacent (≤1 hex) to the body
        var player = (st.tokens || []).find(function (t) { return t && t.isPlayer; }) || null;
        if (player && hexDistance({ q: Number(player.q || 0), r: Number(player.r || 0) }, { q: Number(token.q || 0), r: Number(token.r || 0) }) > 1) {
          safeNotif('Move within 1 hex of the body to loot it.', 'warn');
          return;
        }
        var drop = getLootDropForToken(st, token.id);
        if (!drop || !Array.isArray(drop.items) || !drop.items.length) {
          ensureLootDropForToken(token, 'loot body action');
          st = store.getState();
          drop = getLootDropForToken(st, token.id);
        }
        if (!drop || drop.claimed) {
          safeNotif('No loot available on this body.', 'warn');
          return;
        }
        var board = st.board || {};
        var size = Number(board.size || 42) * Number(board.zoom || 1);
        var pos = axialToPixel(Number(token.q || 0), Number(token.r || 0), size, Number(board.panX || 0), Number(board.panY || 0));
        openLootPopupForToken(token.id, pos.x, pos.y);
      };
    }

    var lootCloseBtn = document.getElementById('combatLootCloseBtn');
    if (lootCloseBtn && !lootCloseBtn._bound) {
      lootCloseBtn._bound = true;
      lootCloseBtn.onclick = function () { closeLootPopup(); };
    }

    var lootTakeAllBtn = document.getElementById('combatLootTakeAllBtn');
    if (lootTakeAllBtn && !lootTakeAllBtn._bound) {
      lootTakeAllBtn._bound = true;
      lootTakeAllBtn.onclick = function () {
        var card = document.getElementById('combatLootPopupCard');
        var cacheKey = String(card && card.dataset.cacheKey || '');
        if (cacheKey) {
          takeLootFromMapCache(cacheKey, null);
          return;
        }
        var tokenId = String(card && card.dataset.tokenId || '');
        if (!tokenId) {
          safeNotif('Open a body loot card first.', 'warn');
          return;
        }
        takeLootFromTokenDrop(tokenId, null, 'Take All');
      };
    }

    var lootTakeSelectedBtn = document.getElementById('combatLootTakeSelectedBtn');
    if (lootTakeSelectedBtn && !lootTakeSelectedBtn._bound) {
      lootTakeSelectedBtn._bound = true;
      lootTakeSelectedBtn.onclick = function () {
        var card = document.getElementById('combatLootPopupCard');
        var checks = card ? Array.prototype.slice.call(card.querySelectorAll('input[data-loot-idx]:checked')) : [];
        var indexes = checks.map(function (node) { return Number(node.getAttribute('data-loot-idx')); });
        var cacheKey = String(card && card.dataset.cacheKey || '');
        if (cacheKey) {
          takeLootFromMapCache(cacheKey, indexes);
          return;
        }
        var tokenId = String(card && card.dataset.tokenId || '');
        if (!tokenId) {
          safeNotif('Open a body loot card first.', 'warn');
          return;
        }
        takeLootFromTokenDrop(tokenId, indexes, 'Take Selected');
      };
    }

    var uploadMapBtn = document.getElementById('combatUploadMapBtn');
    var clearMapBtn = document.getElementById('combatClearMapBtn');
    var clearBoardBtn = document.getElementById('combatClearBoardBtn');
    var uploadMapInput = document.getElementById('combatMapImageInput');
    var uploadHexAssetInput = document.getElementById('combatHexAssetImageInput');
    var assetDockUploadBtn = document.getElementById('combatAssetDockUploadBtn');
    var assetDockUploadHexBtn = document.getElementById('combatAssetDockUploadHexBtn');
    var assetDockToggleBtn = document.getElementById('combatAssetDockToggleBtn');
    if (uploadMapBtn && uploadMapInput && !uploadMapBtn._bound) {
      uploadMapBtn._bound = true;
      uploadMapBtn.onclick = function () { uploadMapInput.click(); };
      uploadMapInput.onchange = function () {
        var file = uploadMapInput.files && uploadMapInput.files[0];
        if (!file) return;
        appendCombatAssetToFolder('mapAssets', file, 'asset dock upload', { applyAsBackground: true });
        uploadMapInput.value = '';
      };
    }

    if (assetDockUploadBtn && uploadMapInput && !assetDockUploadBtn._bound) {
      assetDockUploadBtn._bound = true;
      assetDockUploadBtn.onclick = function () {
        setCombatAssetDrawerOpen(true);
        uploadMapInput.click();
      };
    }

    if (assetDockUploadHexBtn && uploadHexAssetInput && !assetDockUploadHexBtn._bound) {
      assetDockUploadHexBtn._bound = true;
      assetDockUploadHexBtn.onclick = function () {
        setCombatAssetDrawerOpen(true);
        uploadHexAssetInput.click();
      };
    }

    if (uploadHexAssetInput && !uploadHexAssetInput._bound) {
      uploadHexAssetInput._bound = true;
      uploadHexAssetInput.onchange = function () {
        var file = uploadHexAssetInput.files && uploadHexAssetInput.files[0];
        if (!file) return;
        appendCombatAssetToFolder('hexAssets', file, 'asset dock upload', { applyAsBackground: false, placeOnSelection: true });
        uploadHexAssetInput.value = '';
      };
    }

    if (assetDockToggleBtn && !assetDockToggleBtn._bound) {
      assetDockToggleBtn._bound = true;
      assetDockToggleBtn.onclick = function () {
        var uiState = normalizeCombatUi(store.getState().ui);
        setCombatAssetDrawerOpen(!uiState.assetDrawerOpen);
      };
    }

    if (clearMapBtn && !clearMapBtn._bound) {
      clearMapBtn._bound = true;
      clearMapBtn.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          next.board = Object.assign({}, state.board, { background: '' });
          persist(next);
          return next;
        });
        backgroundCache.src = '';
        backgroundCache.img = null;
        addHistory('Battlemap removed.');
        safeNotif('Battlemap removed.', 'good');
        drawBoard();
        updateUiPanels();
      };
    }

    if (clearBoardBtn && !clearBoardBtn._bound) {
      clearBoardBtn._bound = true;
      clearBoardBtn.onclick = function () {
        if (!window.confirm('Clear this board now? This removes tokens, map placements, fog reveals, and active effects in the current scene.')) return;
        clearCombatBoardAndEffects();
      };
    }

    var uploadTokenBtn = document.getElementById('combatUploadTokenBtn');
    var uploadTokenInput = document.getElementById('combatTokenImageInput');
    if (uploadTokenBtn && uploadTokenInput && !uploadTokenBtn._bound) {
      uploadTokenBtn._bound = true;
      uploadTokenBtn.onclick = function () { uploadTokenInput.click(); };
      uploadTokenInput.onchange = function () {
        var file = uploadTokenInput.files && uploadTokenInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var data = String(reader.result || '');
          store.setState(function (state) {
            var next = Object.assign({}, state);
            next.tokens = (state.tokens || []).map(function (token) {
              if (!token || String(token.id) !== String(state.selectedTokenId || '')) return token;
              return Object.assign({}, token, { image: data });
            });
            persist(next);
            return next;
          });
          addHistory('Token portrait updated from image upload.');
          drawBoard();
        };
        reader.readAsDataURL(file);
        uploadTokenInput.value = '';
      };
    }

    var addTokenBtn = document.getElementById('combatAddTokenBtn');
    if (addTokenBtn && !addTokenBtn._bound) {
      addTokenBtn._bound = true;
      addTokenBtn.onclick = function () {
        store.setState(function (state) {
          var next = Object.assign({}, state);
          var player = (state.tokens || []).find(function (token) { return token && token.isPlayer; }) || null;
          var spawnQ = player ? Number(player.q || 0) + 2 : 2;
          var spawnR = player ? Number(player.r || 0) : 0;
          var t = { id: uid('tok'), name: 'Summon', faction: 'npc', hp: 8, maxHp: 8, status: [], q: spawnQ, r: spawnR, image: '', size: 1, inventory: seedTokenInventoryItems('npc', 4) };
          next.tokens = (state.tokens || []).concat([t]);
          next.selectedTokenId = t.id;
          next.initiative = [];
          persist(next);
          return next;
        });
        addHistory('Summon token added to the scene.');
        updateUiPanels();
        drawBoard();
      };
    }

    var addWayfarerBtn = document.getElementById('combatAddWayfarerBtn');
    if (addWayfarerBtn && !addWayfarerBtn._bound) {
      addWayfarerBtn._bound = true;
      addWayfarerBtn.onclick = function () {
        var state = store.getState();
        var existing = (state.tokens || []).find(function (t) { return t && t.isPlayer; });
        if (existing) {
          safeNotif('Wayfarer already on board at ' + toKey(existing.q, existing.r) + '.', 'warn');
          return;
        }
        store.setState(function (state) {
          var next = Object.assign({}, state);
          var wayfarerName = canonicalWayfarerName();
          var maxHpByRules = getWayfarerMaxHpByRules();
          var portrait = (window.S && window.S.identityForge && window.S.identityForge.media && window.S.identityForge.media.portrait) || '';
          var t = {
            id: uid('player'),
            name: wayfarerName,
            faction: 'player',
            hp: maxHpByRules,
            maxHp: maxHpByRules,
            status: [],
            q: 0,
            r: 0,
            image: portrait,
            size: 1,
            isPlayer: true
          };
          next.tokens = (state.tokens || []).concat([t]);
          next.selectedTokenId = t.id;
          next.initiative = [];
          persist(next);
          return next;
        });
        addHistory('Wayfarer placed on the board (Engaged zone).');
        updateUiPanels();
        drawBoard();
      };
    }

    var overlay = document.getElementById('combatModeOverlay');
    if (overlay && !overlay._shortcutsBound) {
      overlay._shortcutsBound = true;
      overlay.addEventListener('keydown', function (ev) {
        var tag = ev.target && ev.target.tagName ? String(ev.target.tagName).toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        var key = String(ev.key || '').toLowerCase();
        if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          var stLocal = store.getState();
          var localTokens = (stLocal.tokens || []).filter(function (token) { return !!token; });
          var selectedId = String(stLocal.selectedTokenId || '');
          if (key === 'tab') {
            if (localTokens.length) {
              var currentIndex = localTokens.findIndex(function (token) { return String(token.id) === selectedId; });
              var nextIndex = currentIndex < 0 ? 0 : ((currentIndex + (ev.shiftKey ? -1 : 1) + localTokens.length) % localTokens.length);
              var nextToken = localTokens[nextIndex];
              if (nextToken) {
                normalizeSelection(nextToken.id, [String(nextToken.id)]);
                updateUiPanels();
                drawBoard();
                announceCombatEvent('Selected ' + String(nextToken.name || 'token') + '.');
              }
            }
            ev.preventDefault();
            return;
          }
          if (key === 'enter') {
            if (selectedId) openTokenSheetQuickView(selectedId);
            ev.preventDefault();
            return;
          }
          if (key === 'c') {
            var previewCast = normalizeCombatSpellPreview(stLocal.spellPreview);
            if (previewCast.active) {
              castCombatSpellPreview();
              ev.preventDefault();
              return;
            }
          }
          if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
            var activeToken = byId(selectedId);
            if (activeToken) {
              var dq = 0;
              var dr = 0;
              if (key === 'arrowup') dr = -1;
              if (key === 'arrowdown') dr = 1;
              if (key === 'arrowleft') dq = -1;
              if (key === 'arrowright') dq = 1;
              moveToken(activeToken.id, Number(activeToken.q || 0) + dq, Number(activeToken.r || 0) + dr);
              drawBoard();
              updateUiPanels();
            }
            ev.preventDefault();
            return;
          }
          if (key === 'n') {
            var nextTurnBtn = document.getElementById('combatNextTurnBtn');
            if (nextTurnBtn && typeof nextTurnBtn.click === 'function') nextTurnBtn.click();
            ev.preventDefault();
            return;
          }
          if (key === 'h') {
            var stHold = store.getState();
            var activeHold = stHold.initiative && stHold.initiative[stHold.initiativeIndex];
            applyInitiativeTurnState('hold-turn', activeHold && activeHold.tokenId);
            ev.preventDefault();
            return;
          }
          if (key === 'j') {
            var stDelay = store.getState();
            var activeDelay = stDelay.initiative && stDelay.initiative[stDelay.initiativeIndex];
            applyInitiativeTurnState('delay-turn', activeDelay && activeDelay.tokenId);
            ev.preventDefault();
            return;
          }
          if (['v', 'd', 't', 'm', 'p', 'f'].indexOf(key) >= 0) {
            var toolByKey = { v: 'select', d: 'paint', t: 'text', m: 'ruler', p: 'pan', f: 'fog' };
            var toolName = toolByKey[key];
            if (toolName) {
              setToolMode(toolName);
              drawBoard();
            }
            ev.preventDefault();
            return;
          }
          if (key === 'delete' || key === 'backspace') {
            if (!selectedId && stLocal.selectedMapItem) {
              deleteMapItemAt(String(stLocal.selectedMapItem.layer || ''), String(stLocal.selectedMapItem.key || ''));
              ev.preventDefault();
              return;
            }
            var selectedIdsForDelete = Array.isArray(stLocal.selectedTokenIds) && stLocal.selectedTokenIds.length
              ? stLocal.selectedTokenIds.slice()
              : (selectedId ? [selectedId] : []);
            if (selectedIdsForDelete.length) {
              captureUndoSnapshot('Delete Tokens');
              store.setState(function (inner) {
                var next = Object.assign({}, inner);
                next.tokens = (inner.tokens || []).filter(function (token) {
                  return token && selectedIdsForDelete.indexOf(String(token.id || '')) < 0;
                });
                next.selectedTokenId = '';
                next.selectedTokenIds = [];
                persist(next);
                return next;
              });
              addHistory('Deleted ' + selectedIdsForDelete.length + ' selected token' + (selectedIdsForDelete.length === 1 ? '' : 's') + '.');
              drawBoard();
              updateUiPanels();
            }
            ev.preventDefault();
            return;
          }
        }
        if ((ev.ctrlKey || ev.metaKey) && key === 'c') {
          var st = store.getState();
          if (!st.selectedTokenId && st.selectedMapItem) {
            copySelectedMapItemToClipboard();
            ev.preventDefault();
            return;
          }
          copyTokensToClipboard(st.selectedTokenId || '');
          ev.preventDefault();
          return;
        }
        if ((ev.ctrlKey || ev.metaKey) && key === 'v') {
          var st2 = store.getState();
          if (!st2.selectedTokenId && st2.selectedMapItem) {
            var mapCoords = fromKeyString(String(st2.selectedMapItem.key || '0,0'));
            pasteMapItemFromClipboard(Number(mapCoords.q || 0) + 1, Number(mapCoords.r || 0) + 1);
            ev.preventDefault();
            return;
          }
          var anchor = byId(st2.selectedTokenId) || { q: 0, r: 0 };
          pasteTokensFromClipboard(Number(anchor.q || 0) + 1, Number(anchor.r || 0) + 1);
          ev.preventDefault();
          return;
        }
        if ((ev.ctrlKey || ev.metaKey) && key === 'z' && !ev.shiftKey) {
          undoLastEdit();
          ev.preventDefault();
          return;
        }
        if (((ev.ctrlKey || ev.metaKey) && key === 'y') || ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && key === 'z')) {
          redoLastEdit();
          ev.preventDefault();
          return;
        }
        if (key === '[' || key === '-') {
          var current = byId(store.getState().selectedTokenId);
          if (!current) return;
          patchSelectedTokens({ scale: Math.max(0.25, Number(current.scale || 1) - (ev.shiftKey ? 0.1 : 0.05)) });
          ev.preventDefault();
          return;
        }
        if (key === ']' || key === '=') {
          var current2 = byId(store.getState().selectedTokenId);
          if (!current2) return;
          patchSelectedTokens({ scale: Math.min(2, Number(current2.scale || 1) + (ev.shiftKey ? 0.1 : 0.05)) });
          ev.preventDefault();
          return;
        }
      });
    }
  }

  var COMBAT_RULES_REFERENCE_SECTIONS = [
    {
      key: 'core',
      label: 'Core',
      cards: [
        {
          title: 'Resolution Loop',
          icon: 'd20',
          chips: ['Action vs Dread', 'Beat to succeed'],
          body: [
            'Roll the relevant action or stat against the opposing Dread value.',
            'Each token normally acts once per round in initiative order.',
            'Use the VTT log and turn tracker to keep the whole table aligned.'
          ]
        },
        {
          title: 'Movement and Range',
          icon: 'HEX',
          chips: ['Terrain cost', 'Zone pressure'],
          body: [
            'Movement happens on the hex board. Terrain, hazards, and locks can increase the cost of repositioning.',
            'Strike pressure is strongest when engaged. Shoot pressure is best once you have lanes and distance.',
            'Use pings, focus ping, and layer controls to keep sightlines readable.'
          ]
        },
        {
          title: 'Recovery and Sync',
          icon: 'HP',
          chips: ['Sheet sync', 'Manual or auto dice'],
          body: [
            'Wayfarer health and actions in Combat Mode mirror the character sheet rules state.',
            'Manual mode supports physical dice at the table; auto mode resolves instantly in-app.',
            'Long Rest, sheet views, and rules all open as modal overlays on top of the VTT.'
          ]
        }
      ]
    },
    {
      key: 'tactical',
      label: 'Tactical',
      cards: [
        {
          title: 'Cover, Fog, and Layers',
          icon: 'MAP',
          chips: ['Objects', 'Terrain', 'Fog'],
          body: [
            'Treat terrain and object layers as tactical cover that can justify defense edges or blocked lines.',
            'Fog of war is your visibility tool: reveal what the party can actually press or react to.',
            'Use lock placement and front/back ordering so the board stays readable during dense fights.'
          ]
        },
        {
          title: 'Token Workflow',
          icon: 'TOK',
          chips: ['Multi-select', 'Copy/paste', 'Enumerate'],
          body: [
            'Shift-select tokens to move formations, rotate a whole squad, or scale tokens for half and quarter occupancy.',
            'Copy and paste auto-space tokens to avoid overlap, then enumerate duplicates to keep target calls clean.',
            'Use Character Sheet from the context menu when a player or enemy needs fast inspection mid-turn.'
          ]
        },
        {
          title: 'Turn Running',
          icon: 'INIT',
          chips: ['Add turn', 'Reaction-ready'],
          body: [
            'Add Turn is useful for elite enemies, reinforcements, summons, or staged boss phases.',
            'Use reaction-ready notes and the combat log to track interrupts without breaking initiative order.',
            'Keep the active token selected so the sheet mirror and action panels stay relevant.'
          ]
        }
      ]
    },
    {
      key: 'caravan',
      label: 'Caravan',
      cards: [
        {
          title: 'Run a Caravan Combat Scene',
          icon: 'CAR',
          chips: ['Driver Control', 'Chase zones'],
          body: [
            'Frame the caravan as the mobile objective. The Driver rolls Control versus enemy Dread to shift the chase zone.',
            'Other Wayfarers still take their own turns: protect cargo, board enemies, repair damage, or clear the route.',
            'Use the VTT page tools to split approach, pursuit, and final clash into linked scene cards.'
          ]
        },
        {
          title: 'Caravan Zone Reference',
          icon: 'ZON',
          chips: ['Engaged', 'Close', 'Nearby', 'Far'],
          body: [
            'Engaged: melee pressure and Strike actions.',
            'Close: spells, items, and immediate support plays.',
            'Nearby: ranged Shoot lanes open up. Far: enemies are outside immediate pressure unless the scene changes.'
          ]
        },
        {
          title: 'Caravan Stats and Damage',
          icon: 'DD',
          chips: ['Small 2/12/DD6', 'Medium 4/16/DD8', 'Large 6/20/DD10'],
          body: [
            'Small caravan: 2 crew, 12 cargo, DD6, 12 stress, 1 mod slot.',
            'Medium caravan: 4 crew, 16 cargo, DD8, 16 stress, 2 mod slots. Large caravan: 6 crew, 20 cargo, DD10, 20 stress, 3 mod slots.',
            'Heavy hits can cost cargo, wheels, Dread steps, or disable the transporter. Keep those outcomes visible on a side card while you play.'
          ]
        }
      ]
    },
    {
      key: 'starship',
      label: 'Starship',
      cards: [
        {
          title: 'Run a Ship or Starship Combat Scene',
          icon: 'NAV',
          chips: ['Crew roles', 'Hull pressure'],
          body: [
            'Ship combat works best when each round spotlights a role: Captain, Gunner, Navigator, and Engineer.',
            'Treat the ship as both battlefield and shared character. Crew actions should move range, repair systems, and create windows for strikes.',
            'Use separate pages for approach, broadside exchange, boarding, and escape so scene state stays clean.'
          ]
        },
        {
          title: 'Naval Role Reference',
          icon: 'ROL',
          chips: ['Captain Lead/Spirit', 'Gunner Strike/Shoot', 'Navigator Control/Mind', 'Engineer Body/Defend'],
          body: [
            'Captain drives morale, tactics, diplomacy, and command under pressure.',
            'Gunner runs short-barrel cannons at Close range and crossbows at Nearby range. Navigator moves between zones and threads hazards.',
            'Engineer repairs the ship, braces the hull, and absorbs incoming punishment.'
          ]
        },
        {
          title: 'Ship Stats and Break Rules',
          icon: 'HULL',
          chips: ['Hull Stress = 2x Defend', 'Break = Defend step down'],
          body: [
            'Hull Stress equals twice the ship\'s current Defend die.',
            'Cannons use Strike at Close. Crossbows use Shoot at Nearby.',
            'When the hull breaks, step Defend down and apply +1 crew Trauma. If a broken d4 hull breaks again, the ship is out of action.'
          ]
        }
      ]
    },
    {
      key: 'tools',
      label: 'Tools',
      cards: [
        {
          title: 'Fast GM Workflow',
          icon: 'GM',
          chips: ['Context menu', 'Pages', 'Assets'],
          body: [
            'Right-click tokens for ping, place party, copy/paste, turn edits, layers, locks, sheet access, and vision settings.',
            'Use Build Map for fast page generation, then rename pages to match scene beats.',
            'Keep assets and rules open in modal overlays so no one has to leave the VTT to answer a rules question.'
          ]
        },
        {
          title: 'Teach the Table',
          icon: 'REF',
          chips: ['Search', 'Cards', 'Sheet jump'],
          body: [
            'Use the search field to filter mechanics live while players are asking questions.',
            'Open the selected token sheet directly from this reference when a rule needs a character-specific answer.',
            'These cards are meant to explain the game in play, not just store disconnected lore text.'
          ]
        }
      ]
    }
  ];

  function buildCombatRulesReferenceHtml() {
    var sections = [{ key: 'all', label: 'All' }].concat(COMBAT_RULES_REFERENCE_SECTIONS.map(function (entry) {
      return { key: entry.key, label: entry.label };
    }));
    var buttons = sections.map(function (entry) {
      return '<button class="combat-rules-tab" type="button" data-rules-tab="' + entry.key + '" onclick="window.setCombatRulesReferenceTab&&window.setCombatRulesReferenceTab(\'' + entry.key + '\')">' + escapeHtml(entry.label) + '</button>';
    }).join('');
    var cards = COMBAT_RULES_REFERENCE_SECTIONS.map(function (section) {
      return (section.cards || []).map(function (card) {
        var search = [section.label, card.title].concat(card.chips || []).concat(card.body || []).join(' ').toLowerCase();
        var chips = (card.chips || []).map(function (chip) {
          return '<span class="combat-rules-chip">' + escapeHtml(String(chip || '')) + '</span>';
        }).join('');
        var body = (card.body || []).map(function (line) {
          return '<div class="combat-rules-line">' + escapeHtml(String(line || '')) + '</div>';
        }).join('');
        return ''
          + '<article class="combat-rules-card" data-rules-card="true" data-rules-section="' + escapeHtml(section.key) + '" data-search="' + escapeHtml(search) + '">'
          + '<div class="combat-rules-meta"><span class="combat-rules-icon">' + escapeHtml(String(card.icon || 'REF')) + '</span><span class="combat-rules-section-label">' + escapeHtml(section.label) + '</span></div>'
          + '<div class="combat-rules-title">' + escapeHtml(card.title) + '</div>'
          + '<div class="combat-rules-chip-row">' + chips + '</div>'
          + '<div class="combat-rules-body">' + body + '</div>'
          + '</article>';
      }).join('');
    }).join('');
    return ''
      + '<div id="combatRulesReferencePanel" class="combat-rules-panel">'
      + '<div class="combat-rules-toolbar">'
      + '<div>'
      + '<div class="combat-rules-kicker">Embedded Play Reference</div>'
      + '<div class="combat-rules-heading">Searchable rules, scene procedures, and quick stat cards for play at the table.</div>'
      + '</div>'
      + '<div class="combat-rules-actions">'
      + '<input id="combatRulesReferenceSearch" class="combat-rules-search" type="search" placeholder="Search rules, caravan, ship, fog, turns..." oninput="window.filterCombatRulesReference&&window.filterCombatRulesReference(this.value)">'
      + '<button class="btn btn-xs" type="button" onclick="window.openSelectedCombatSheetFromRulesReference&&window.openSelectedCombatSheetFromRulesReference()">Selected Sheet</button>'
      + '</div>'
      + '</div>'
      + '<div class="combat-rules-tab-row">' + buttons + '</div>'
      + '<div class="combat-rules-summary">Showing <span id="combatRulesReferenceMatchCount">0</span> quick-reference cards.</div>'
      + '<div class="combat-rules-grid">' + cards + '</div>'
      + '</div>';
  }

  function applyCombatRulesReferenceFilter(query) {
    var panel = document.getElementById('combatRulesReferencePanel');
    if (!panel) return;
    var searchValue = typeof query === 'string' ? query : String(window._combatRulesReferenceQuery || '');
    window._combatRulesReferenceQuery = searchValue;
    var activeTab = String(window._combatRulesReferenceTab || 'all');
    var cards = panel.querySelectorAll('[data-rules-card]');
    var matchCount = 0;
    for (var i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      var sectionKey = String(card.getAttribute('data-rules-section') || '');
      var haystack = String(card.getAttribute('data-search') || '').toLowerCase();
      var matchesTab = activeTab === 'all' || sectionKey === activeTab;
      var matchesSearch = !searchValue || haystack.indexOf(String(searchValue).toLowerCase()) >= 0;
      var visible = matchesTab && matchesSearch;
      card.style.display = visible ? '' : 'none';
      if (visible) matchCount += 1;
    }
    var buttons = panel.querySelectorAll('[data-rules-tab]');
    for (var j = 0; j < buttons.length; j += 1) {
      var btn = buttons[j];
      btn.setAttribute('data-active', String(btn.getAttribute('data-rules-tab') || '') === activeTab ? 'true' : 'false');
    }
    var countEl = document.getElementById('combatRulesReferenceMatchCount');
    if (countEl) countEl.textContent = String(matchCount);
  }

  window.setCombatRulesReferenceTab = function (tabKey) {
    window._combatRulesReferenceTab = String(tabKey || 'all');
    applyCombatRulesReferenceFilter(window._combatRulesReferenceQuery || '');
  };

  window.filterCombatRulesReference = function (query) {
    applyCombatRulesReferenceFilter(String(query || ''));
  };

  window.openSelectedCombatSheetFromRulesReference = function () {
    var state = store.getState();
    var selected = Array.isArray(state.selectedTokenIds) && state.selectedTokenIds.length
      ? state.selectedTokenIds
      : [state.selectedTokenId];
    var token = byId(selected[0]);
    if (!token) {
      safeNotif('Select a token in the VTT to open its Character Sheet.', 'info');
      return;
    }
    openTokenSheetQuickView(token.id);
  };

  function showCombatRulesReference() {
    if (typeof window.openModal === 'function') {
      window._combatRulesReferenceTab = String(window._combatRulesReferenceTab || 'all');
      window._combatRulesReferenceQuery = '';
      window.openModal('Combat Rules Reference', buildCombatRulesReferenceHtml(), null, { preventScroll: true, focusTrap: true });
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          applyCombatRulesReferenceFilter('');
          var input = document.getElementById('combatRulesReferenceSearch');
          if (input) {
            try { input.focus({ preventScroll: true }); } catch (_err) { input.focus(); }
          }
        });
      } else {
        applyCombatRulesReferenceFilter('');
      }
    } else {
      safeNotif('Combat rules reference is available in modal-enabled views.', 'info');
    }
  }

  function buildSceneSnapshotFromState(state, sceneId, sceneName) {
    var id = String(sceneId || uid('scene'));
    return {
      id: id,
      name: String(sceneName || ('Scene ' + id.slice(-4))),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      board: clone(state.board || { cols: 15, rows: 15, zoom: 1, panX: 0, panY: 0 }),
      layers: clone(state.layers || {}),
      fog: clone(state.fog || {}),
      sceneRules: clone(state.sceneRules || {}),
      tokens: clone(state.tokens || []),
      initiative: clone(state.initiative || []),
      actionHistory: clone((state.actionHistory || []).slice(0, 200)),
      sceneOpener: clone(state.sceneOpener || null)
    };
  }

  function saveSceneCard(sceneName) {
    var savedId = '';
    store.setState(function (state) {
      var next = normalizeCombatSceneState(Object.assign({}, state));
      var scenes = Array.isArray(next.scenes) ? next.scenes.slice() : [];
      var activeId = String(next.activeSceneId || '');
      var existingIdx = activeId
        ? scenes.findIndex(function (scene) { return scene && String(scene.id) === activeId; })
        : -1;
      var targetName = String(sceneName || '').trim();
      var snapshot;

      if (existingIdx >= 0) {
        var existing = scenes[existingIdx] || {};
        snapshot = buildSceneSnapshotFromState(next, existing.id, targetName || existing.name || 'Scene');
        snapshot.createdAt = Number(existing.createdAt || snapshot.createdAt || Date.now());
        scenes[existingIdx] = snapshot;
      } else {
        snapshot = buildSceneSnapshotFromState(next, uid('scene'), targetName || ('Scene ' + (scenes.length + 1)));
        scenes.push(snapshot);
      }

      savedId = String(snapshot.id || '');
      next.scenes = scenes;
      next.activeSceneId = savedId;
      persist(next);
      return next;
    });
    safeNotif('Scene saved.', 'good');
  }

  function loadSceneCard(sceneId) {
    var targetId = String(sceneId || '');
    if (!targetId) return;
    var wrap = document.getElementById('combatCanvasWrap');
    triggerPageTransition(wrap);
    var loaded = false;
    store.setState(function (state) {
      var next = normalizeCombatSceneState(Object.assign({}, state));
      var scenes = Array.isArray(next.scenes) ? next.scenes.slice() : [];
      var scene = scenes.find(function (entry) { return entry && String(entry.id) === targetId; }) || null;
      if (!scene) return next;

      next.activeSceneId = String(scene.id || '');
      next.board = normalizeBoard(Object.assign({}, next.board || {}, clone(scene.board || {})));
      next.layers = clone(scene.layers || {});
      next.fog = clone(scene.fog || {});
      next.sceneRules = clone(scene.sceneRules || {});
      next.tokens = clone(scene.tokens || []);
      next.initiative = clone(scene.initiative || []);
      next.actionHistory = clone(scene.actionHistory || []);
      next.selectedTokenId = next.tokens.length ? String((next.tokens[0] && next.tokens[0].id) || '') : '';
      next.currentTurnIndex = 0;
      next.initiativeIndex = 0;
      persist(next);
      loaded = true;
      return next;
    });

    if (!loaded) {
      safeNotif('Scene not found.', 'warn');
      return;
    }
    addHistory('Scene loaded from card library.');
    updateUiPanels();
    drawBoard();
    safeNotif('Scene loaded.', 'good');
  }

  function createSceneFromTemplate(templateKey) {
    var key = String(templateKey || 'blank').toLowerCase();
    var templateConfig = {
      blank: {
        board: { cols: 15, rows: 15, zoom: 1, panX: 0, panY: 0 },
        layers: createEmptySceneLayers(),
        fog: { enabled: false, revealed: {} },
        name: 'Blank Scene',
        editor: { layer: 'terrain', tool: 'paint', paintValue: 'road' }
      },
      spaceship: {
        board: { cols: 16, rows: 12, zoom: 1, panX: 0, panY: 0 },
        layers: {
          terrain: { '4,4': 'ruins', '5,4': 'ruins', '6,4': 'ruins' },
          objects: { '7,4': 'door', '8,4': 'wall' },
          hazards: { '10,5': 'trap' },
          elevation: {}, lighting: {}, wallSegments: {}, weather: {}, foreground: {},
          interactives: { '6,5': 'console' },
          spawns: { '3,5': 'spawn', '12,5': 'spawn' },
          labels: {}
        },
        fog: { enabled: true, revealed: {} },
        name: 'Space Ship Interior',
        editor: { layer: 'objects', tool: 'paint', paintValue: 'door' }
      },
      navalship: {
        board: { cols: 18, rows: 10, zoom: 1, panX: 0, panY: 0 },
        layers: {
          terrain: { '5,4': 'water', '6,4': 'water', '7,4': 'water' },
          objects: { '4,3': 'door', '9,3': 'obstacle' },
          hazards: { '11,5': 'trap' },
          elevation: {}, lighting: {}, wallSegments: {}, weather: { '0,0': 'storm' }, foreground: {},
          interactives: { '8,3': 'turret' },
          spawns: { '2,5': 'spawn', '14,5': 'spawn' },
          labels: {}
        },
        fog: { enabled: true, revealed: {} },
        name: 'Naval Vessel Deck',
        editor: { layer: 'objects', tool: 'paint', paintValue: 'obstacle' }
      }
    };

    var procedural = buildProceduralSceneTemplate(key, store.getState().board || {});
    var tpl = procedural || templateConfig[key] || templateConfig.blank;
    var templateNameMap = {
      dungeon: 'Dungeon Procedural',
      town: 'Town Procedural',
      wilderness: 'Wilderness Procedural',
      quick: 'Quick Procedural'
    };

    store.setState(function (state) {
      var next = normalizeCombatSceneState(Object.assign({}, state));
      next.board = normalizeBoard(Object.assign({}, next.board || {}, tpl.board || {}));
      next.layers = normalizeCombatSceneState({ layers: tpl.layers || createEmptySceneLayers() }).layers;
      next.fog = Object.assign({}, next.fog || {}, clone(tpl.fog || {}));
      next.tokens = [];
      next.initiative = [];
      next.actionHistory = [];
      next.selectedTokenId = '';
      next.selectedTokenIds = [];
      var newSceneId = uid('scene');
      var newScene = {
        id: newSceneId,
        name: String(tpl.name || templateNameMap[key] || 'Scene Template'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        board: clone(next.board),
        layers: clone(next.layers),
        fog: clone(next.fog),
        sceneRules: clone(next.sceneRules || {}),
        tokens: clone(next.tokens),
        initiative: clone(next.initiative),
        actionHistory: clone(next.actionHistory)
      };
      next.scenes = (next.scenes || []).concat([newScene]);
      next.activeSceneId = newSceneId;
      next.activeLayer = String(tpl.editor && tpl.editor.layer || next.activeLayer || 'terrain');
      next.activeTool = String(tpl.editor && tpl.editor.tool || next.activeTool || 'paint');
      next.paintValue = String(tpl.editor && tpl.editor.paintValue || next.paintValue || 'road');
      window._currentSceneEditId = newSceneId;
      persist(next);
      return next;
    });

    applyPostGenerationEditorHooks(tpl, store.getState().activeSceneId || '');
    addHistory('Scene template applied: ' + String(tpl.name || tpl.label || key) + '.');
    updateUiPanels();
    drawBoard();
    safeNotif('Template scene created: ' + String(tpl.name || tpl.label || key) + '.', 'good');
  }

  function bindSceneLibraryControls() {
    var rulesBtn = document.getElementById('combatRulesReferenceBtn');
    if (rulesBtn && !rulesBtn._bound) {
      rulesBtn._bound = true;
      rulesBtn.onclick = function () {
        showCombatRulesReference();
      };
    }

    var pageSelect = document.getElementById('combatPageSelect');
    if (pageSelect && !pageSelect._bound) {
      pageSelect._bound = true;
      pageSelect.onchange = function () {
        var id = String(pageSelect.value || '');
        if (!id) return;
        loadSceneCard(id);
      };
    }

    var createPageBtn = document.getElementById('combatCreatePageBtn');
    if (createPageBtn && !createPageBtn._bound) {
      createPageBtn._bound = true;
      createPageBtn.onclick = function () {
        createSceneFromTemplate('blank');
      };
    }

    var buildMapBtn = document.getElementById('combatBuildMapBtn');
    if (buildMapBtn && !buildMapBtn._bound) {
      buildMapBtn._bound = true;
      buildMapBtn.onclick = function () {
        captureUndoSnapshot('Build Map Pages');
        var buildOrder = [
          { label: 'Dungeon Wing', key: 'dungeon' },
          { label: 'Town District', key: 'town' },
          { label: 'Wilderness Frontier', key: 'wilderness' }
        ];
        var createdIds = [];
        buildOrder.forEach(function (entry) {
          createSceneFromTemplate(entry.key);
          var current = normalizeCombatSceneState(store.getState());
          var activeId = String(current.activeSceneId || '');
          if (!activeId) return;
          createdIds.push(activeId);
          store.setState(function (state) {
            var next = Object.assign({}, state);
            next.scenes = (state.scenes || []).map(function (scene) {
              if (!scene || String(scene.id) !== activeId) return scene;
              return Object.assign({}, scene, { name: entry.label });
            });
            persist(next);
            return next;
          });
        });
        if (createdIds.length) loadSceneCard(createdIds[0]);
        safeNotif('Built ' + createdIds.length + ' linked map pages.', 'good');
        updateUiPanels();
        drawBoard();
      };
    }

    var saveSceneBtn = document.getElementById('combatSaveSceneCardBtn');
    if (saveSceneBtn && !saveSceneBtn._bound) {
      saveSceneBtn._bound = true;
      saveSceneBtn.onclick = function () {
        saveSceneCard();
      };
    }

    var loadSceneBtn = document.getElementById('combatLoadSceneCardBtn');
    if (loadSceneBtn && !loadSceneBtn._bound) {
      loadSceneBtn._bound = true;
      loadSceneBtn.onclick = function () {
        var state = store.getState();
        var scenes = Array.isArray(state.scenes) ? state.scenes : [];
        if (!scenes.length) {
          safeNotif('No saved scenes yet. Create and save one first.', 'warn');
          return;
        }
        var options = scenes.map(function (scene, idx) {
          var updated = formatClockTime(Number(scene.updatedAt || scene.createdAt || 0));
          var name = String(scene.name || ('Scene ' + (idx + 1))).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return '<option value="' + String(scene.id) + '">' + name + ' · ' + updated + '</option>';
        }).join('');
        var modal = '<div style="font-size:.78rem;"><select id="sceneLoadSelect" style="width:100%;padding:.3rem;margin:.2rem 0;border:1px solid rgba(227,188,94,.5);background:rgba(9,13,24,.95);color:#fff;">' + options + '</select><div style="margin-top:.3rem;display:flex;gap:.2rem;"><button class="btn btn-xs btn-primary" onclick="(function(){var sel=document.getElementById(\'sceneLoadSelect\');if(sel&&window.loadSceneCard)window.loadSceneCard(sel.value);if(typeof window.closeModal===\'function\')window.closeModal();})();">Load</button><button class="btn btn-xs" onclick="if(typeof window.closeModal===\'function\')window.closeModal();">Cancel</button></div></div>';
        if (typeof window.openModal === 'function') {
          window.openModal('Load Scene Card', modal, null, { preventScroll: true, focusTrap: true });
        }
      };
    }

    var newSceneBtn = document.getElementById('combatNewSceneTemplateBtn');
    if (newSceneBtn && !newSceneBtn._bound) {
      newSceneBtn._bound = true;
      newSceneBtn.onclick = function () {
        var modal = '<div style="font-size:.78rem;display:grid;gap:.3rem;"><div style="margin-bottom:.15rem;">Choose a scene template:</div><button class="btn btn-xs btn-primary" style="width:100%;" onclick="if(window.createSceneFromTemplate)window.createSceneFromTemplate(\'quick\');if(typeof window.closeModal===\'function\')window.closeModal();">Quick Procedural (Random)</button><button class="btn btn-xs" style="width:100%;" onclick="if(window.createSceneFromTemplate)window.createSceneFromTemplate(\'blank\');if(typeof window.closeModal===\'function\')window.closeModal();">Blank Canvas</button><button class="btn btn-xs" style="width:100%;" onclick="if(window.createSceneFromTemplate)window.createSceneFromTemplate(\'dungeon\');if(typeof window.closeModal===\'function\')window.closeModal();">Dungeon Generator</button><button class="btn btn-xs" style="width:100%;" onclick="if(window.createSceneFromTemplate)window.createSceneFromTemplate(\'town\');if(typeof window.closeModal===\'function\')window.closeModal();">Town Generator</button><button class="btn btn-xs" style="width:100%;" onclick="if(window.createSceneFromTemplate)window.createSceneFromTemplate(\'wilderness\');if(typeof window.closeModal===\'function\')window.closeModal();">Wilderness Generator</button><button class="btn btn-xs" style="width:100%;" onclick="if(window.createSceneFromTemplate)window.createSceneFromTemplate(\'spaceship\');if(typeof window.closeModal===\'function\')window.closeModal();">Space Ship Interior</button><button class="btn btn-xs" style="width:100%;" onclick="if(window.createSceneFromTemplate)window.createSceneFromTemplate(\'navalship\');if(typeof window.closeModal===\'function\')window.closeModal();">Naval Vessel Deck</button><button class="btn btn-xs" style="width:100%;" onclick="if(typeof window.closeModal===\'function\')window.closeModal();">Cancel</button></div>';
        if (typeof window.openModal === 'function') {
          window.openModal('New Scene from Template', modal, null, { preventScroll: true, focusTrap: true });
        } else {
          createSceneFromTemplate('blank');
        }
      };
    }
  }

  function openOverlay(seed) {
    var root = ensureOverlayDom();
    bindCanvas();
    bindDragPanels();
    bindStaticControls();

    if (seed && typeof seed === 'object') {
      seed = prepareCampaignCombatSeed(seed);
    }

    if (seed && typeof seed === 'object') {
      if (seed.navalBoardingContext && typeof seed.navalBoardingContext === 'object') {
        window.__activeNavalBoardingSceneContext = Object.assign({}, seed.navalBoardingContext);
      } else {
        window.__activeNavalBoardingSceneContext = null;
      }
      store.setState(function (state) {
        if (seed.sceneEditorState && typeof seed.sceneEditorState === 'object') {
          var sharedSnapshot = hydrateActiveSceneState(
            normalizeCampaignCombatSceneState(normalizeCombatSceneState(Object.assign({}, state || {}, clone(seed.sceneEditorState) || {})))
          );
          persist(sharedSnapshot);
          return sharedSnapshot;
        }
        var next = normalizeCombatSceneState(Object.assign({}, state));
        var targetSceneId = String(seed.id || uid('scene'));
        next.activeSceneId = targetSceneId;
        var sceneName = String(seed.name || 'Scene');
        var scenes = Array.isArray(next.scenes) ? next.scenes.slice() : [];
        var sceneIdx = scenes.findIndex(function (scene) {
          return scene && String(scene.id || '') === targetSceneId;
        });
        var existingScene = sceneIdx >= 0 ? scenes[sceneIdx] : null;
        if (sceneIdx < 0) {
          scenes.push({
            id: targetSceneId,
            name: sceneName,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            board: clone(next.board || {}),
            layers: clone(next.layers || {}),
            fog: clone(next.fog || {}),
            sceneRules: clone(next.sceneRules || {}),
            tokens: clone(next.tokens || []),
            initiative: clone(next.initiative || []),
            actionHistory: clone(next.actionHistory || [])
          });
        } else {
          scenes[sceneIdx] = Object.assign({}, scenes[sceneIdx] || {}, {
            id: targetSceneId,
            name: sceneName,
            updatedAt: Date.now()
          });
        }
        next.scenes = scenes;
        if (existingScene) {
          next.board = normalizeBoard(Object.assign({}, next.board || {}, clone(existingScene.board || {})));
          next.layers = normalizeCombatSceneState({ layers: clone(existingScene.layers || {}) }).layers;
          next.fog = Object.assign({}, next.fog || {}, clone(existingScene.fog || {}));
          next.sceneRules = ensureCombatSceneRulesExtensions(Object.assign({}, next.sceneRules || {}, clone(existingScene.sceneRules || {})));
          next.tokens = clone(existingScene.tokens || []);
          next.initiative = clone(existingScene.initiative || []);
          next.actionHistory = clone(existingScene.actionHistory || []);
        } else {
          next.board = normalizeBoard(Object.assign({}, next.board || {}, { cols: 15, rows: 15, zoom: 1, panX: 640, panY: 340, background: '' }));
          next.layers = createEmptySceneLayers();
          next.fog = Object.assign({}, next.fog || {}, { enabled: false, revealed: {}, revealOrder: {}, revealSeq: 0, revealStep: 0 });
          next.sceneRules = ensureCombatSceneRulesExtensions(Object.assign({}, next.sceneRules || {}));
          next.tokens = [];
          next.initiative = [];
          next.actionHistory = [];
        }
        if (Array.isArray(seed.tokens) && seed.tokens.length) {
          var seedEnemyDread = Math.max(4, Number(window.S && window.S.combat && window.S.combat.enemyDread || 6));
          next.tokens = normalizeCampaignCombatSceneTokens(seed.tokens).map(function (token, idx) {
            var mergedToken = Object.assign({ id: uid('seed-' + idx), faction: 'npc', hp: 8, maxHp: 8, status: [], q: idx, r: 0, size: 1, image: '' }, token || {});
            if (String(mergedToken.faction || '') === 'monster') {
              if (!Number.isFinite(Number(mergedToken.dread)) || Number(mergedToken.dread) <= 0) {
                mergedToken.dread = seedEnemyDread;
              }
              if (!Number.isFinite(Number(mergedToken.deathNumber)) || Number(mergedToken.deathNumber) <= 0) {
                mergedToken.deathNumber = Math.max(1, Number(mergedToken.dread || seedEnemyDread || 6));
              }
            }
            return mergedToken;
          });
          next.initiative = [];
        }
        if (Array.isArray(seed.history) && seed.history.length) {
          next.actionHistory = seed.history.slice(0, 80);
        }
        if (seed.layers && typeof seed.layers === 'object') {
          next.layers = Object.assign({}, next.layers, seed.layers);
        }
        if (seed.fog && typeof seed.fog === 'object') {
          next.fog = Object.assign({}, next.fog, seed.fog);
        }
        if (seed.sceneRules && typeof seed.sceneRules === 'object') {
          next.sceneRules = Object.assign({}, next.sceneRules, seed.sceneRules);
        }
        if (seed.board && typeof seed.board === 'object') {
          next.board = normalizeBoard(Object.assign({}, next.board, seed.board));
        }
        persist(next);
        return next;
      });
    } else {
      window.__activeNavalBoardingSceneContext = null;
      store.setState(function (state) {
        var next = Object.assign({}, state);
        next.tokens = clone(state.tokens || []);
        next.initiative = clone(state.initiative || []);
        next.actionHistory = clone(state.actionHistory || []);
        next.tokenRoundEffects = [];
        next.board = normalizeBoard(Object.assign({}, state.board || {}, { cols: 15, rows: 15, zoom: 1, panX: 640, panY: 340 }));
        next.layers = Object.assign({
          terrain: {},
          objects: {},
          hazards: {},
          elevation: {},
          lighting: {},
          wallSegments: {},
          weather: {},
          foreground: {},
          interactives: {},
          spawns: {},
          labels: {}
        }, clone(state.layers || {}));
        next.fog = Object.assign({
          enabled: false,
          showMask: true,
          revealMode: 'manual',
          visionRadius: 3,
          revealed: {},
          revealOrder: {},
          revealSeq: 0,
          revealStep: 0
        }, clone(state.fog || {}));
        next.sceneRules = Object.assign({ rollMode: 'auto', defaultActionType: 'ranged', targetCoverOverrides: {}, lootDrops: {} }, clone(state.sceneRules || {}));
        next.selectedTokenId = '';
        if (!next.activeSceneId && Array.isArray(next.scenes) && next.scenes.length) next.activeSceneId = String(next.scenes[0].id || '');
        persist(next);
        return next;
      });
    }

    store.setState({ open: true, entering: true });
    var splash = document.getElementById('combatEntrySplash');
    applyCombatUiState(store.getState());
    if (splash) {
      splash.classList.remove('hidden');
      setTimeout(function () {
        splash.classList.add('hidden');
        store.setState({ entering: false });
      }, getCombatMotionDuration(store.getState(), 900, 450) || 20);
    }
    store.setState(function (state) {
      var activeCombat = !!(window.S && window.S.combat && window.S.combat.active);
      var next = Object.assign({}, state, { playMode: activeCombat ? true : !!state.playMode });
      persist(next);
      return next;
    });
    root.classList.add('open');
    setPanelPositions();
    try {
      updateUiPanels();
      drawBoard();
    } catch (_err) {
      store.setState({ entering: false });
      safeNotif('Combat scene opened with a fallback state because the saved scene data was invalid.', 'warn');
    }

    var hasExistingScene = !!(seed && typeof seed === 'object' && seed.id);
    addHistory('Entering encounter. Combat mode online.' + (hasExistingScene ? ' Scene loaded.' : ' Fresh canvas ready.'));
    setTimeout(function () {
      try { announceCampaignCombatModeOpen('campaign-combat-mode-open'); } catch (_err2) {}
    }, 60);
    if (!store.getState().ui || !store.getState().ui.tutorialSeen) {
      setTimeout(function () {
        var current = store.getState();
        if (current.open && (!current.ui || !current.ui.tutorialSeen) && typeof window.openCombatTutorial === 'function') {
          window.openCombatTutorial(Number(current.ui && current.ui.tutorialStep || 0));
        }
      }, getCombatMotionDuration(store.getState(), 980, 520) || 40);
    }
  }

  function buildSharedCampaignCombatSceneSeed() {
    var sharedState = window.S && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === 'object'
      ? (clone(window.S.combat.sceneEditor) || null)
      : null;
    if (!sharedState) return null;
    var activeSceneId = String(sharedState.activeSceneId || '');
    var scenes = Array.isArray(sharedState.scenes) ? sharedState.scenes : [];
    var activeScene = activeSceneId
      ? (scenes.find(function (scene) { return scene && String(scene.id || '') === activeSceneId; }) || null)
      : null;
    return {
      id: activeSceneId || 'campaign-shared-scene',
      name: String(activeScene && activeScene.name || 'Campaign Shared Scene'),
      sceneEditorState: sharedState
    };
  }

  function buildActiveSharedCampaignCombatSceneSeed() {
    var cs = getCampaignCombatSceneSession();
    if (!cs || !cs.code || !window.campaignSystem || typeof window.campaignSystem.getSharedState !== 'function') return null;
    var shared = null;
    try {
      shared = window.campaignSystem.getSharedState() || null;
    } catch (_err) {
      shared = null;
    }
    var combat = shared && shared.campaignCombat && typeof shared.campaignCombat === 'object'
      ? shared.campaignCombat
      : null;
    var vttSession = combat && combat.vttSession && typeof combat.vttSession === 'object'
      ? combat.vttSession
      : null;
    if (!combat || !combat.active || !Number(vttSession && vttSession.enteredAt || 0)) return null;
    var seed = buildSharedCampaignCombatSceneSeed();
    if (!seed) return null;
    seed.id = String(vttSession.activeSceneId || seed.id || 'campaign-shared-scene');
    seed.name = String(vttSession.sceneName || seed.name || 'Campaign Shared Scene');
    return seed;
  }

  function primeCampaignCombatVttSession(seed) {
    var cs = getCampaignCombatSceneSession();
    if (!cs || String(cs.role || '') !== 'gm' || !cs.code || !(window.S && window.S.combat && window.S.combat.active)) return null;
    if (!window.campaignSystem || typeof window.campaignSystem.getSharedState !== 'function' || typeof window.campaignSystem.syncSharedPatch !== 'function') return null;
    var shared = null;
    try {
      shared = window.campaignSystem.getSharedState() || null;
    } catch (_err) {
      shared = null;
    }
    if (!shared || typeof shared !== 'object') return null;
    var combatState = shared.campaignCombat && typeof shared.campaignCombat === 'object'
      ? (deepCloneJson(shared.campaignCombat) || {})
      : null;
    if (!combatState || !combatState.active) return null;
    combatState.vttSession = {
      enteredAt: Date.now(),
      by: String(window.S && window.S.name || cs.playerName || 'GM'),
      sceneName: String(seed && seed.name || 'Campaign Shared Scene'),
      activeSceneId: String(seed && seed.id || 'campaign-shared-scene')
    };
    shared.campaignCombat = deepCloneJson(combatState) || combatState;
    var patchOut = window.campaignSystem.syncSharedPatch({
      campaignCombat: deepCloneJson(shared.campaignCombat) || shared.campaignCombat
    }, 'campaign-combat-vtt-prime');
    if (patchOut && typeof patchOut.catch === 'function') patchOut.catch(function () {});
    return shared.campaignCombat.vttSession;
  }

  function resolveCombatModeEntrySeed() {
    var sharedSeed = buildActiveSharedCampaignCombatSceneSeed();
    if (sharedSeed) return sharedSeed;

    var cs = getCampaignCombatSceneSession();
    if (cs && cs.code && String(cs.role || '') !== 'gm' && window.campaignSystem && typeof window.campaignSystem.getSharedState === 'function') {
      var shared = null;
      try {
        shared = window.campaignSystem.getSharedState() || null;
      } catch (_err) {
        shared = null;
      }
      var combat = shared && shared.campaignCombat && typeof shared.campaignCombat === 'object'
        ? shared.campaignCombat
        : null;
      if (combat && combat.active) {
        var hasOpenSharedVtt = !!(combat.vttSession && typeof combat.vttSession === 'object' && Number(combat.vttSession.enteredAt || 0));
        if (hasOpenSharedVtt) {
          var fallbackSeed = expeditionSeed() || buildLiveCombatSeed() || buildSharedCampaignCombatSceneSeed();
          if (fallbackSeed) return fallbackSeed;
        }
        safeNotif('The GM has not opened the shared VTT yet. Stay on the Combat Tab or wait for the join prompt.', 'info');
        return false;
      }
    }

    return expeditionSeed() || buildLiveCombatSeed() || buildSharedCampaignCombatSceneSeed();
  }

  function syncCombatScenesTabNavigation() {
    if (typeof window.switchTab === 'function') {
      var btn = document.getElementById('tabnav-scenes') || document.querySelector('#mainNav .tab-btn[data-tab="scenes"]');
      try {
        window.__campaignSuppressNavigationSync = true;
        window.switchTab('scenes', btn || null);
      } catch (_err) {
        window.__campaignSuppressNavigationSync = false;
      }
    }
  }

  function applySharedCombatSceneEditorState(snapshot, options) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    var opts = options && typeof options === 'object' ? options : {};
    var cloned = clone(prepareCampaignCombatSeed(snapshot));
    if (!cloned) return false;
    var overlay = document.getElementById('combatModeOverlay');
    var overlayOpen = !!(overlay && overlay.classList.contains('open'));
    if (opts.autoOpen && !overlayOpen) {
      syncCombatScenesTabNavigation();
      openOverlay({
        id: String(cloned.activeSceneId || 'campaign-shared-scene'),
        name: String(opts.sceneName || 'Campaign Shared Scene'),
        sceneEditorState: cloned
      });
      return true;
    }
    applyingSharedCombatSceneEditorState = true;
    try {
      store.setState(function (state) {
        var merged = hydrateActiveSceneState(normalizeCombatSceneState(Object.assign({}, state || {}, cloned)));
        merged.open = !!(state && state.open);
        merged.entering = false;
        persist(merged);
        return merged;
      });
    } finally {
      applyingSharedCombatSceneEditorState = false;
    }
    if (overlayOpen || opts.refreshUi) {
      try { applyCombatUiState(store.getState()); } catch (_err) {}
      try { updateUiPanels(); } catch (_err2) {}
      try { drawBoard(); } catch (_err3) {}
    }
    return true;
  }

  function closeOverlay() {
    var root = document.getElementById('combatModeOverlay');
    if (!root) return;

    function finalizeClose() {
      root.classList.remove('open');
      store.setState({ open: false, entering: false, draggingTokenId: '' });
      persist(store.getState());
    }

    function buildBoardingDeltaLine(label, delta) {
      if (!delta || typeof delta !== 'object') {
        return '<li>' + label + ': no change.</li>';
      }
      var stress = Number(delta.stressApplied || 0);
      var hullSteps = Number(delta.hullStepDowns || 0);
      var hullFrom = Number(delta.hullFrom || 4);
      var hullTo = Number(delta.hullTo || hullFrom);
      var wrecked = !!delta.wreckedTo;
      var line = label + ': +' + stress + ' Stress';
      line += ', Hull d' + hullFrom + ' -> d' + hullTo;
      line += ' (' + hullSteps + ' step' + (hullSteps === 1 ? '' : 's') + ')';
      if (wrecked) line += ', Wrecked';
      return '<li>' + line + '</li>';
    }

    function showBoardingResolvePreviewModal(previewPlan, applyPayload) {
      if (!previewPlan || !previewPlan.ok) return false;
      if (typeof window.openModal !== 'function') return false;

      var traumaDelta = Number(previewPlan.crewTraumaDelta || 0);
      var traumaFrom = Number(previewPlan.crewTraumaFrom || 0);
      var traumaTo = Number(previewPlan.crewTraumaTo || 0);
      var traumaSign = traumaDelta > 0 ? '+' : '';
      var resultLabel = String(previewPlan.result || 'stalemate').toUpperCase();
      var endLine = previewPlan.combatEnds
        ? '<div style="margin-top:8px;color:#ffdca8;">Naval combat will end from this boarding outcome.</div>'
        : '';

      window.__combatPendingBoardingResolve = {
        payload: Object.assign({}, applyPayload),
        preview: Object.assign({}, previewPlan)
      };

      var html = ''
        + '<div style="display:grid;gap:8px;min-width:320px;">'
        + '<div><strong>Boarding Outcome Resolve Preview</strong></div>'
        + '<div>Result from board state: <strong>' + resultLabel + '</strong></div>'
        + '<ul style="margin:0;padding-left:18px;display:grid;gap:4px;">'
        + buildBoardingDeltaLine('Player Ship', previewPlan.player)
        + buildBoardingDeltaLine('Enemy Ship', previewPlan.enemy)
        + '<li>Crew Trauma: ' + traumaFrom + ' -> ' + traumaTo + ' (' + traumaSign + traumaDelta + ')</li>'
        + '</ul>'
        + endLine
        + '<div style="margin-top:10px;display:flex;justify-content:flex-end;gap:8px;">'
        + '<button class="btn btn-xs" onclick="window.cancelNavalBoardingResolveFromModal&&window.cancelNavalBoardingResolveFromModal()">Cancel</button>'
        + '<button class="btn btn-xs btn-primary" onclick="window.confirmNavalBoardingResolveFromModal&&window.confirmNavalBoardingResolveFromModal()">Apply & Close</button>'
        + '</div>'
        + '</div>';

      window.confirmNavalBoardingResolveFromModal = function () {
        try {
          var pending = window.__combatPendingBoardingResolve;
          if (pending && typeof window.resolveNavalBoardingOutcomeFromCombatScene === 'function') {
            window.resolveNavalBoardingOutcomeFromCombatScene(pending.payload || {});
          }
          window.__activeNavalBoardingSceneContext = null;
          window.__combatPendingBoardingResolve = null;
          if (typeof window.closeModal === 'function') {
            window.closeModal();
          }
          finalizeClose();
        } catch (_confirmBoardingErr) {
          try { console.error(_confirmBoardingErr); } catch (_noop) {}
          if (typeof window.showNotif === 'function') window.showNotif('Boarding outcome apply failed.', 'warn');
        }
      };

      window.cancelNavalBoardingResolveFromModal = function () {
        window.__combatPendingBoardingResolve = null;
        if (typeof window.closeModal === 'function') {
          window.closeModal();
        }
      };

      window.openModal('Resolve Boarding Outcome?', html, null, { preventScroll: true, focusTrap: true });
      return true;
    }

    var boardingCtx = window.__activeNavalBoardingSceneContext && typeof window.__activeNavalBoardingSceneContext === 'object'
      ? Object.assign({}, window.__activeNavalBoardingSceneContext)
      : null;
    if (boardingCtx && typeof window.resolveNavalBoardingOutcomeFromCombatScene === 'function') {
      try {
        var state = store.getState();
        var tokenList = Array.isArray(state && state.tokens) ? state.tokens : [];
        var alivePlayers = tokenList.filter(function (token) {
          return token && String(token.faction || '') === 'player' && !isTokenDead(token);
        }).length;
        var aliveEnemies = tokenList.filter(function (token) {
          return token && String(token.faction || '') === 'monster' && !isTokenDead(token);
        }).length;
        var result = 'stalemate';
        if (alivePlayers > 0 && aliveEnemies <= 0) result = 'victory';
        else if (aliveEnemies > 0 && alivePlayers <= 0) result = 'defeat';
        var resolvePayload = {
          result: result,
          alivePlayers: alivePlayers,
          aliveEnemies: aliveEnemies
        };
        var previewPlan = null;
        if (typeof window.previewNavalBoardingOutcomeFromCombatScene === 'function') {
          previewPlan = window.previewNavalBoardingOutcomeFromCombatScene(resolvePayload);
        }
        if (previewPlan && previewPlan.ok && showBoardingResolvePreviewModal(previewPlan, resolvePayload)) {
          return;
        }
        window.resolveNavalBoardingOutcomeFromCombatScene(resolvePayload);
      } catch (_boardingResolveErr) {
        try { console.error(_boardingResolveErr); } catch (_noop) {}
      }
      window.__activeNavalBoardingSceneContext = null;
    }

    finalizeClose();
  }

  function expeditionSeed() {
    if (typeof window.getHoldingCrucibleMatch !== 'function') return null;
    var match = window.getHoldingCrucibleMatch();
    if (!match || !Array.isArray(match.allies) || !Array.isArray(match.enemies)) return null;

    var allies = match.allies.filter(function (u) { return u && Number(u.hp || 0) > 0; }).map(function (u, idx) {
      return {
        id: String(u.id || uid('ally')),
        name: String(u.name || ('Ally ' + (idx + 1))),
        faction: 'player',
        hp: Number(u.hp || 8),
        maxHp: Number(u.maxHp || u.hp || 8),
        status: [],
        q: Number(u.position && u.position.q || idx),
        r: Number(u.position && u.position.r || 2),
        image: '',
        size: 1,
        isPlayer: !!u.isPlayer
      };
    });

    var enemies = match.enemies.filter(function (u) { return u && Number(u.hp || 0) > 0; }).map(function (u, idx) {
      var dread = Math.max(4, Number(u.dread || 6));
      return {
        id: String(u.id || uid('enm')),
        name: String(u.name || ('Enemy ' + (idx + 1))),
        faction: 'monster',
        hp: dread * 2,
        maxHp: dread * 2,
        status: [],
        q: Number(u.position && u.position.q || (idx + 3)),
        r: Number(u.position && u.position.r || 0),
        image: '',
        size: 1,
        dread: dread,
        deathNumber: dread
      };
    });

    var history = Array.isArray(match.log) ? match.log.slice(-40).reverse() : [];
    return { tokens: allies.concat(enemies), history: history };
  }

  function zoneToSeedHex(zoneName, laneIndex) {
    var z = String(zoneName || 'Nearby').toLowerCase();
    var lane = Math.max(0, Number(laneIndex || 0));
    var row = lane - 1;
    if (z.indexOf('engaged') >= 0) return { q: 0, r: row };
    if (z.indexOf('close') >= 0) return { q: 2, r: row };
    if (z.indexOf('nearby') >= 0) return { q: 4, r: row };
    if (z.indexOf('far') >= 0) return { q: 6, r: row };
    return { q: 4, r: row };
  }

  function getEnemyTrackerByName(name) {
    var needle = String(name || '').trim().toLowerCase();
    if (!needle || !window.S || !Array.isArray(window.S.enemies)) return null;
    return window.S.enemies.find(function (entry) {
      if (!entry || entry.ally) return false;
      return String(entry.name || '').trim().toLowerCase() === needle;
    }) || null;
  }

  function buildSeedFromCombatMapState() {
    if (!window.S || !window.S.combatMap || !Array.isArray(window.S.combatMap.units) || !window.S.combatMap.units.length) return null;
    var units = window.S.combatMap.units.slice();
    var zoneLane = {};
    var playerName = String(window.S && window.S.name || 'Wayfarer').trim() || 'Wayfarer';
    var maxHpByRules = getWayfarerMaxHpByRules();
    var defaultEnemyDread = Math.max(4, Number(window.S && window.S.combat && window.S.combat.enemyDread || 8));
    var portrait = (window.S && window.S.identityForge && window.S.identityForge.media && window.S.identityForge.media.portrait) || '';

    var tokens = units.map(function (unit, idx) {
      if (!unit) return null;
      var zone = String(unit.zone || 'Nearby');
      var laneKey = String(unit.side || 'enemy') + ':' + zone;
      zoneLane[laneKey] = Math.max(0, Number(zoneLane[laneKey] || 0)) + 1;
      var pos = zoneToSeedHex(zone, zoneLane[laneKey]);
      var isAlly = String(unit.side || 'enemy') !== 'enemy';
      var isPlayer = !!unit.isPlayer || String(unit.name || '').trim().toLowerCase() === playerName.toLowerCase();

      if (isAlly) {
        return {
          id: String(unit.id || uid('ally-' + idx)),
          name: String(unit.name || (isPlayer ? playerName : ('Ally ' + (idx + 1)))),
          faction: 'player',
          hp: isPlayer ? maxHpByRules : 10,
          maxHp: isPlayer ? maxHpByRules : 10,
          status: [],
          q: Number(pos.q || 0),
          r: Number(pos.r || 0),
          image: isPlayer ? String(portrait || '') : '',
          size: 1,
          isPlayer: !!isPlayer
        };
      }

      var trackerEnemy = getEnemyTrackerByName(unit.name);
      var dread = Math.max(4, Number((trackerEnemy && trackerEnemy.dread) || unit.dread || defaultEnemyDread || 6));
      var maxStress = Math.max(1, Number((trackerEnemy && trackerEnemy.maxStress) || (dread * 2)));
      var curStress = Math.max(0, Number((trackerEnemy && trackerEnemy.stress) || 0));
      return {
        id: String(unit.id || uid('enm-' + idx)),
        name: String(unit.name || ('Enemy ' + (idx + 1))),
        faction: 'monster',
        hp: Math.max(1, maxStress - curStress),
        maxHp: maxStress,
        status: [],
        q: Number(pos.q || 0),
        r: Number(pos.r || 0),
        image: '',
        size: 1,
        dread: dread,
        deathNumber: dread
      };
    }).filter(Boolean);

    if (!tokens.length) return null;
    return {
      name: 'Live Combat Map',
      tokens: tokens,
      history: ['Loaded from current Combat tab units and zone map layout.']
    };
  }

  function buildLiveCombatSeed() {
    var mapSeed = buildSeedFromCombatMapState();
    if (mapSeed) return mapSeed;
    var tokens = seedFromCurrentCombat();
    if (Array.isArray(tokens) && tokens.length) {
      return {
        name: 'Live Combat State',
        tokens: tokens,
        history: ['Loaded from current combat tracker state.']
      };
    }
    return null;
  }

  window.openCombatSceneEditor = function (seed) {
    syncCombatScenesTabNavigation();
    openOverlay(prepareCampaignCombatSeed(seed || buildActiveSharedCampaignCombatSceneSeed() || buildSharedCampaignCombatSceneSeed() || null));
    syncCurrentCampaignCombatScene('campaign-combat-mode-open-immediate', { includeCombatSession: true });
  };
  
  window.closeCombatSceneEditor = function () {
    closeOverlay();
  };

  window.closeCombatSceneEditor = function () {
    closeOverlay();
  };

  window.openCombatSceneEditorFromExpedition = function () {
    var seed = resolveCombatModeEntrySeed();
    if (seed === false) return;
    syncCombatScenesTabNavigation();
    openOverlay(prepareCampaignCombatSeed(seed || null));
    syncCurrentCampaignCombatScene('campaign-combat-mode-open-immediate', { includeCombatSession: true });
  };
  window.applySharedCombatSceneEditorState = applySharedCombatSceneEditorState;

  function wireStartCombatHook() {
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireStartCombatHook);
  } else {
    wireStartCombatHook();
  }

  // Scenes Tab Functions
  window._currentSceneEditId = null;

  window.createNewCombatScene = function () {
    var sceneId = uid('scene');
    var state = store.getState();
    var scenes = Array.isArray(state && state.scenes) ? state.scenes.slice() : [];
    
    var ZONE_TABLE = ['Clear Ground','Debris Field','Urban Alley','Dark Interior','Elevated Position','Flooded Zone','Trench Line','Open Field','Fortified Cover','Storm Zone'];
    var REACTION_TABLE = ['Aggressive','Aggressive','Aggressive','Cautious','Cautious','Fearful','Fearful','Neutral','Flanking','Ambush'];
    var ACTIVITY_TABLE = ['Patrolling','Holding Position','Pursuing','Retreating','Looting or scavenging','Setting Trap'];
    var zoneRoll = Math.floor(Math.random() * 10);
    var coverRoll = Math.floor(Math.random() * 4 + 1) + Math.floor(Math.random() * 20 + 1);
    var reactionRoll = Math.floor(Math.random() * 10);
    var activityRoll = Math.floor(Math.random() * 6);
    var coverLabel = coverRoll <= 9 ? 'No Cover' : coverRoll <= 14 ? 'Light Cover (+1 Defend)' : coverRoll <= 19 ? 'Medium Cover (+2 Defend)' : coverRoll <= 24 ? 'Heavy Cover (+2 Defend, Blocked Sight)' : 'Full Cover';
    var sceneOpener = {
      zone: ZONE_TABLE[zoneRoll],
      zoneDie: zoneRoll + 1,
      cover: coverLabel,
      coverDie: coverRoll,
      enemyReaction: REACTION_TABLE[reactionRoll],
      reactionDie: reactionRoll + 1,
      enemyActivity: ACTIVITY_TABLE[activityRoll],
      activityDie: activityRoll + 1
    };

    var newScene = {
      id: sceneId,
      name: 'New Scene ' + (scenes.length + 1),
      isActive: scenes.length === 0,
      createdAt: Date.now(),
      board: clone((state && state.board) || { cols: 15, rows: 15 }),
      layers: clone((state && state.layers) || {}),
      fog: clone((state && state.fog) || {}),
      sceneRules: clone((state && state.sceneRules) || {}),
      tokens: clone((state && state.tokens) || []),
      initiative: clone((state && state.initiative) || []),
      actionHistory: [],
      sceneOpener: sceneOpener
    };
    
    scenes.push(newScene);
    store.setState({
      scenes: scenes,
      activeSceneId: sceneId
    });
    
    window._currentSceneEditId = sceneId;
    renderScenesList();
    showSceneBuilder(sceneId);
    var openerSummary = '🎬 ' + sceneOpener.zone + ' · ' + sceneOpener.cover + ' · ' + sceneOpener.enemyReaction + ' · ' + sceneOpener.enemyActivity;
    safeNotif('Scene created: ' + newScene.name + ' — ' + openerSummary);
    var openerEl = document.getElementById('combatSceneOpenerSummary');
    if (openerEl) openerEl.textContent = openerSummary;
  };

  function renderScenesList() {
    var listEl = document.getElementById('scenesList');
    if (!listEl) return;
    
    var state = store.getState();
    var scenes = Array.isArray(state && state.scenes) ? state.scenes : [];
    
    if (scenes.length === 0) {
      listEl.innerHTML = '<div style="font-size:.75rem;color:var(--muted2);text-align:center;padding:.8rem;">No scenes yet. Create one to begin.</div>';
      return;
    }
    
    listEl.innerHTML = scenes.map(function (scene) {
      var isActive = scene.id === window._currentSceneEditId;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem .5rem;background:' + (isActive ? 'rgba(73,201,187,.1);border:1px solid var(--accent-2)' : 'transparent;border:1px solid var(--border2)') + ';border-radius:3px;cursor:pointer;" onclick="window.selectScene(\'' + String(scene.id).replace(/'/g, "\\'") + '\')">'
        + '<div>'
        + '<div style="font-size:.78rem;color:var(--text);">' + (scene.name || 'Unnamed Scene') + '</div>'
        + '<div style="font-size:.65rem;color:var(--muted);margin-top:.1rem;">' + (scene.board && scene.board.cols ? (scene.board.cols + 'x' + scene.board.rows + ' board') : 'No board') + '</div>'
        + '</div>'
        + '<button class="btn btn-xs" style="margin-left:.3rem;" onclick="event.stopPropagation();window.deleteScene(\'' + String(scene.id).replace(/'/g, "\\'") + '\')" title="Delete scene">✕</button>'
        + '</div>';
    }).join('');
  }

  window.selectScene = function (sceneId) {
    window._currentSceneEditId = sceneId;
    renderScenesList();
    showSceneBuilder(sceneId);
  };

  function showSceneBuilder(sceneId) {
    var state = store.getState();
    var scenes = Array.isArray(state && state.scenes) ? state.scenes : [];
    var scene = scenes.find(function (s) { return s.id === sceneId; });
    
    if (!scene) return;
    
    var builderEl = document.getElementById('sceneBuilderPanel');
    if (!builderEl) return;
    
    builderEl.style.display = 'block';
    document.getElementById('sceneEditName').textContent = scene.name;
    document.getElementById('sceneEditNameInput').value = scene.name;
    
    if (scene.board) {
      var sizeStr = (scene.board.cols || 15) + 'x' + (scene.board.rows || 15);
      var sizeSelect = document.getElementById('sceneMapSize');
      if (sizeSelect) {
        if (sizeStr === '10x10') sizeSelect.value = '10x10';
        else if (sizeStr === '15x15') sizeSelect.value = '15x15';
        else if (sizeStr === '20x20') sizeSelect.value = '20x20';
        else sizeSelect.value = 'custom';
      }
      
      var fogEl = document.getElementById('sceneFogOfWar');
      if (fogEl) fogEl.checked = !!(scene.fog && scene.fog.enabled);
    }
  }

  window.closeSceneBuilder = function () {
    var builderEl = document.getElementById('sceneBuilderPanel');
    if (builderEl) builderEl.style.display = 'none';
    window._currentSceneEditId = null;
    renderScenesList();
  };

  window.setupSceneTemplate = function (template) {
    if (!window._currentSceneEditId) return;

    var state = store.getState();
    var scenes = Array.isArray(state && state.scenes) ? state.scenes.slice() : [];
    var sceneIdx = scenes.findIndex(function (s) { return s.id === window._currentSceneEditId; });
    if (sceneIdx < 0) return;

    var scene = clone(scenes[sceneIdx]);
    var config = buildProceduralSceneTemplate(template, scene.board || state.board || {});
    if (!config) return;

    scene.board = normalizeBoard(Object.assign({}, scene.board || {}, config.board || {}));
    scene.layers = normalizeCombatSceneState({ layers: config.layers || createEmptySceneLayers() }).layers;
    scene.fog = Object.assign({}, scene.fog || {}, clone(config.fog || {}));
    scene.updatedAt = Date.now();

    scenes[sceneIdx] = scene;
    store.setState(function (prev) {
      var next = Object.assign({}, prev, {
        scenes: scenes,
        activeLayer: String(config.editor && config.editor.layer || prev.activeLayer || 'terrain'),
        activeTool: String(config.editor && config.editor.tool || prev.activeTool || 'paint'),
        paintValue: String(config.editor && config.editor.paintValue || prev.paintValue || 'road')
      });
      persist(next);
      return next;
    });

    applyPostGenerationEditorHooks(config, scene.id);
    showSceneBuilder(window._currentSceneEditId);
    updateUiPanels();
    drawBoard();
    safeNotif('Scene template applied: ' + String(config.label || template) + ' (procedural).', 'success');
  };

  window.launchCombatModeWithScene = function () {
    if (!window._currentSceneEditId) return;
    
    var state = store.getState();
    var scenes = Array.isArray(state && state.scenes) ? state.scenes : [];
    var scene = scenes.find(function (s) { return s.id === window._currentSceneEditId; });
    
    if (!scene) return;
    
    // Update scene name from input
    var nameInput = document.getElementById('sceneEditNameInput');
    var scenesNext = scenes.slice();
    var sceneIndex = scenesNext.findIndex(function (s) { return s && String(s.id) === String(scene.id); });
    if (nameInput && nameInput.value) {
      scene = Object.assign({}, scene, { name: String(nameInput.value || scene.name || 'Scene') });
      if (sceneIndex >= 0) scenesNext[sceneIndex] = scene;
    }

    var sizeSel = document.getElementById('sceneMapSize');
    if (sizeSel) {
      var raw = String(sizeSel.value || '15x15');
      var parts = raw.split('x');
      var cols = Math.max(6, Number(parts[0] || scene.board && scene.board.cols || 15));
      var rows = Math.max(6, Number(parts[1] || scene.board && scene.board.rows || 15));
      scene.board = Object.assign({}, scene.board || {}, { cols: cols, rows: rows });
      if (sceneIndex >= 0) scenesNext[sceneIndex] = scene;
    }

    var fogEl = document.getElementById('sceneFogOfWar');
    if (fogEl) {
      scene.fog = Object.assign({}, scene.fog || {}, { enabled: !!fogEl.checked });
      if (sceneIndex >= 0) scenesNext[sceneIndex] = scene;
    }

    store.setState(function (prev) {
      var next = Object.assign({}, prev, { scenes: scenesNext, activeSceneId: scene.id });
      persist(next);
      return next;
    });
    
    // Load scene board state and open combat mode
    if (typeof window.openCombatSceneEditor === 'function') {
      window.openCombatSceneEditor(scene);
      safeNotif('Loaded scene: ' + scene.name);
    }
  };

  window.deleteScene = function (sceneId) {
    if (!confirm('Delete this scene? This cannot be undone.')) return;
    
    var state = store.getState();
    var scenes = Array.isArray(state && state.scenes) ? state.scenes.slice() : [];
    var idx = scenes.findIndex(function (s) { return s.id === sceneId; });
    
    if (idx < 0) return;
    
    scenes.splice(idx, 1);
    
    var newActiveId = sceneId === state.activeSceneId && scenes.length > 0 ? scenes[0].id : (state.activeSceneId === sceneId ? null : state.activeSceneId);
    
    store.setState({
      scenes: scenes,
      activeSceneId: newActiveId
    });
    
    if (window._currentSceneEditId === sceneId) {
      window.closeSceneBuilder();
    } else {
      renderScenesList();
    }
    
    safeNotif('Scene deleted');
  };

  window.deleteCurrentScene = function () {
    if (window._currentSceneEditId) {
      window.deleteScene(window._currentSceneEditId);
    }
  };

  // Render scenes list on page load or tab switch
  window.renderScenesTabOnOpen = function () {
    renderScenesList();
    
    // Subscribe to store changes to keep UI in sync
    if (!window.__combatScenesTabSubscribed) {
      window.__combatScenesTabSubscribed = true;
      store.subscribe(function () {
        renderScenesList();
      });
    }
  };

  window.applyCombatQuickEffect = function (label, stress, rounds) {
    var st = store.getState();
    var token = byId(st.selectedTokenId);
    if (!token) {
      safeNotif('Select a token first.', 'warn');
      return;
    }
    addTokenRoundEffect(String(token.id), String(label || 'Condition'), Number(stress || 1), Number(rounds || 2), '#e3bc5e');
    updateUiPanels();
    drawBoard();
  };

  window.applyCombatQuickEffectTo = function (targetTokenId, label, stress, rounds, color) {
    var token = byId(targetTokenId);
    if (!token) {
      safeNotif('Pick a valid target token for effects.', 'warn');
      return;
    }
    store.setState({ selectedTokenId: String(token.id || '') });
    addTokenRoundEffect(String(token.id), String(label || 'Condition'), Number(stress || 1), Number(rounds || 2), String(color || '#e3bc5e'));
    updateUiPanels();
    drawBoard();
  };

  window.startCombatSpellPreview = startCombatSpellPreview;
  window.rotateCombatSpellPreviewDirection = rotateCombatSpellPreviewDirection;
  window.cancelCombatSpellPreview = function () {
    clearCombatSpellPreview(true);
  };
  window.castCombatSpellPreview = castCombatSpellPreview;
  window.openVttSpellPreviewFromScroll = function (scrollName, options) {
    var name = String(scrollName || '').trim();
    var lower = name.toLowerCase();
    var opts = options && typeof options === 'object' ? options : {};
    var shape = String(opts.shape || '').toLowerCase();
    var mode = String(opts.mode || 'standard').toLowerCase();
    var modeBand = mode === 'focused' ? 'close' : (mode === 'expanded' ? 'far' : 'nearby');
    var casterTokenId = String(opts.casterTokenId || store.getState().selectedTokenId || '');
    var spellId = 'thunder-lattice';
    var overrides = { bandKey: modeBand };

    if (/thunder\s*lattice/.test(lower)) {
      spellId = shape === 'ring' ? 'entropy-vault' : 'thunder-lattice';
      overrides.spellLabel = 'Thunder Lattice';
      overrides.shape = shape === 'ring' ? 'ring' : 'line';
      overrides.zoneEnabled = true;
      overrides.tickMode = 'margin';
      overrides.tickAmount = 0;
      overrides.tickCondition = '';
    } else if (/gravit|starwell|gravity/.test(lower)) {
      spellId = 'gravitic-fold';
      overrides.spellLabel = name || 'Gravitic Fold';
      overrides.shape = 'ring';
      overrides.zoneEnabled = true;
      overrides.tickMode = 'fixed';
      overrides.tickAmount = 1;
      overrides.pullToCenterRadius = 1;
      if (mode === 'focused') overrides.bandKey = 'close';
      else if (mode === 'expanded') overrides.bandKey = 'far';
      else overrides.bandKey = 'nearby';
    } else {
      if (shape === 'ring') {
        spellId = 'entropy-vault';
        overrides.shape = 'ring';
      } else if (shape === 'cone') {
        spellId = 'mind-shear-cone';
        overrides.shape = 'cone';
      } else if (shape === 'burst') {
        spellId = 'starfall-burst';
        overrides.shape = 'burst';
      } else {
        spellId = 'thunder-lattice';
        overrides.shape = 'line';
      }
      overrides.spellLabel = name || 'Spell';
    }

    return startCombatSpellPreview(spellId, casterTokenId, overrides);
  };
  window.startCombatSpellPreviewFromModal = function () {
    var spellSel = document.getElementById('combatSpellPreviewSelect');
    var casterSel = document.getElementById('combatSpellCaster');
    var castModeSel = document.getElementById('combatSpellCastMode');
    var shapeSel = document.getElementById('combatSpellShape');
    var bandSel = document.getElementById('combatSpellBand');
    var selectedSpellValue = String(spellSel && spellSel.value || 'thunder-lattice');
    var resolved = resolveLegacySpellPreviewSelection(selectedSpellValue);
    var spellId = String(resolved && resolved.spellId || 'thunder-lattice');
    var casterTokenId = String(casterSel && casterSel.value || '');
    var overrides = Object.assign({}, resolved && resolved.overrides || {});
    overrides.castMode = String(castModeSel && castModeSel.value || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto';
    var shapeOverride = String(shapeSel && shapeSel.value || '').trim().toLowerCase();
    var bandOverride = String(bandSel && bandSel.value || '').trim().toLowerCase();
    if (shapeOverride) overrides.shape = shapeOverride;
    if (bandOverride) overrides.bandKey = bandOverride;
    var ok = startCombatSpellPreview(spellId, casterTokenId, overrides);
    if (ok && typeof window.closeModal === 'function') window.closeModal();
  };
  window.castCombatSpellPreviewFromModal = function () {
    var state = store.getState();
    var preview = normalizeCombatSpellPreview(state.spellPreview);
    if (!preview.active) {
      var spellSel = document.getElementById('combatSpellPreviewSelect');
      var casterSel = document.getElementById('combatSpellCaster');
      var castModeSel = document.getElementById('combatSpellCastMode');
      var spellId = String(spellSel && spellSel.value || 'thunder-lattice');
      var casterTokenId = String(casterSel && casterSel.value || '');
      var castMode = String(castModeSel && castModeSel.value || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto';
      if (!startCombatSpellPreview(spellId, casterTokenId, { castMode: castMode })) return;
      if (typeof window.closeModal === 'function') window.closeModal();
      return;
    }
    var castModeActiveSel = document.getElementById('combatSpellCastMode');
    if (castModeActiveSel) {
      var nextMode = String(castModeActiveSel.value || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto';
      store.setState(function (inner) {
        var next = Object.assign({}, inner);
        next.spellPreview = normalizeCombatSpellPreview(Object.assign({}, inner.spellPreview || {}, { castMode: nextMode }));
        persist(next);
        return next;
      });
    }
    var castOk = castCombatSpellPreview();
    if (castOk && typeof window.closeModal === 'function') window.closeModal();
  };

  window.applyCombatSettingsFromModal = function () {
    var fogEnabled = !!(document.getElementById('combatSettingsFogEnabled') && document.getElementById('combatSettingsFogEnabled').checked);
    var autoRoll = !!(document.getElementById('combatSettingsAutoRoll') && document.getElementById('combatSettingsAutoRoll').checked);
    var fogModeEl = document.getElementById('combatSettingsFogMode');
    var fogMode = String(fogModeEl && fogModeEl.value || 'manual');
    var visionEl = document.getElementById('combatSettingsVisionRadius');
    var visionRadius = Math.max(1, Math.min(8, Number(visionEl && visionEl.value || 3)));
    var motionEl = document.getElementById('combatSettingsMotionMode');
    var motionMode = String(motionEl && motionEl.value || 'full');
    var themePresetEl = document.getElementById('combatSettingsThemePreset');
    var themePreset = String(themePresetEl && themePresetEl.value || 'obsidian');
    var compactModeEl = document.getElementById('combatSettingsCompactMode');
    var compactMode = String(compactModeEl && compactModeEl.value || 'auto');
    var qualityModeEl = document.getElementById('combatSettingsQualityMode');
    var qualityMode = String(qualityModeEl && qualityModeEl.value || 'auto');
    var dragDebugBanner = !!(document.getElementById('combatSettingsDragDebugBanner') && document.getElementById('combatSettingsDragDebugBanner').checked);
    var accentEl = document.getElementById('combatSettingsAccent');
    var accent2El = document.getElementById('combatSettingsAccent2');
    var surfaceEl = document.getElementById('combatSettingsSurface');
    var textEl = document.getElementById('combatSettingsText');
    var fogColorEl = document.getElementById('combatSettingsFogColor');
    var pingEl = document.getElementById('combatSettingsPing');
    var dangerEl = document.getElementById('combatSettingsDanger');
    store.setState(function (state) {
      var next = Object.assign({}, state, { autoRoll: autoRoll });
      next.fog = Object.assign({
        enabled: false,
        showMask: true,
        revealMode: 'manual',
        visionRadius: 3,
        revealed: {},
        revealOrder: {},
        revealSeq: 0,
        revealStep: 0
      }, state.fog || {}, { enabled: fogEnabled, revealMode: fogMode, visionRadius: visionRadius });
      next.ui = normalizeCombatUi(Object.assign({}, state.ui || {}, {
        motionMode: motionMode,
        themePreset: themePreset,
        compactMode: compactMode,
        qualityMode: qualityMode,
        dragDebugBanner: dragDebugBanner,
        themeTokens: Object.assign({}, state.ui && state.ui.themeTokens || {}, {
          accent: String(accentEl && accentEl.value || ''),
          accent2: String(accent2El && accent2El.value || ''),
          surface: String(surfaceEl && surfaceEl.value || ''),
          text: String(textEl && textEl.value || ''),
          fog: String(fogColorEl && fogColorEl.value || ''),
          ping: String(pingEl && pingEl.value || ''),
          danger: String(dangerEl && dangerEl.value || '')
        })
      }));
      persist(next);
      return next;
    });
    writeCombatTutorialState(store.getState().ui || {});
    applyCombatUiState(store.getState());
    drawBoard();
    updateUiPanels();
  };

  window.showCombatRulesReference = showCombatRulesReference;
  window.saveSceneCard = saveSceneCard;
  window.loadSceneCard = loadSceneCard;
  window.createSceneFromTemplate = createSceneFromTemplate;

  window.CombatSceneStore = {
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    addHistory: addHistory
  };

  window.debugCombatDropAsset = function (kind, payload, clientX, clientY) {
    var canvas = document.getElementById('combatSceneCanvas');
    if (!canvas) return false;
    var transfer = {
      files: [],
      getData: function (key) {
        if (String(key || '') === 'text/combat-asset-kind') return String(kind || '');
        if (String(key || '') === 'text/combat-asset-payload') return String(payload || '');
        return '';
      }
    };
    return handleCombatBoardDropEvent({
      preventDefault: function () {},
      clientX: Number(clientX || 0),
      clientY: Number(clientY || 0),
      dataTransfer: transfer
    }, canvas, 'debug-helper');
  };

  window.getCombatSceneSharedModifier = function (actionKey, options) {
    return resolveSharedSceneModifiers(actionKey, options);
  };

  window.sendCombatTablePing = function (identity, q, r) {
    var qq = Number(q || 0);
    var rr = Number(r || 0);
    placeTablePing(qq, rr, String(identity || currentPingIdentity()));
  };

  // ══════════════════════════════════════════════════════════════════════════
  // COMBAT CHAT SYSTEM — Interactive text chat with emoji reactions
  // Inspired by Fabled VTT's party chat with GIF-style emotes and reactions
  // ══════════════════════════════════════════════════════════════════════════
  (function () {
    var CHAT_KEY = 'btl-combat-chat-v1';
    var CHAT_MAX = 120;
    var EMOTE_REACTIONS = ['👍','🎲','⚔️','🛡️','💀','🔥','✨','😬','🎉','💀','❤️','🤔'];
    var QUICK_EMOTES = [
      { label: 'Attack!',  text: '⚔️ Attack!' },
      { label: 'Healing',  text: '✨ Healing the party!' },
      { label: 'Nat 20',   text: '🎉 NAT 20!' },
      { label: 'Help',     text: '🙋 Need help here!' },
      { label: 'Retreat',  text: '🏃 Retreat!' },
      { label: 'Loot',     text: '💰 Found loot!' }
    ];

    var chatMessages = (function () {
      try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); } catch (e) { return []; }
    })();

    function saveChat() {
      try { localStorage.setItem(CHAT_KEY, JSON.stringify(chatMessages.slice(-CHAT_MAX))); } catch (e) {}
    }

    function getPlayerName() {
      var state = store.getState();
      return String(state && state.playerName || 'Adventurer');
    }

    function addChatMessage(text, type, sender) {
      var msg = {
        id: uid('chat'),
        text: String(text || '').slice(0, 400),
        type: String(type || 'player'),   // 'player' | 'system' | 'roll'
        sender: String(sender || getPlayerName()),
        at: Date.now(),
        reactions: {}
      };
      chatMessages.push(msg);
      chatMessages = chatMessages.slice(-CHAT_MAX);
      saveChat();
      renderCombatChat();
      return msg;
    }

    function addReaction(msgId, emoji) {
      var msg = chatMessages.find(function (m) { return m.id === msgId; });
      if (!msg) return;
      msg.reactions = msg.reactions || {};
      msg.reactions[emoji] = (Number(msg.reactions[emoji] || 0) + 1);
      saveChat();
      renderCombatChat();
    }

    function renderCombatChat() {
      var panel = document.getElementById('combatChatPanel');
      if (!panel) return;
      var feed = document.getElementById('combatChatFeed');
      if (!feed) return;
      var msgs = chatMessages.slice(-50);
      feed.innerHTML = msgs.map(function (msg) {
        var isSystem = msg.type === 'system' || msg.type === 'roll';
        var timeStr = new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var reactionHtml = Object.keys(msg.reactions || {}).filter(function (e) { return msg.reactions[e] > 0; }).map(function (e) {
          return '<button class="chat-reaction-btn" onclick="window.combatChatAddReaction(\'' + String(msg.id || '').replace(/'/g,"'") + '\',\'' + e + '\')" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:.06rem .28rem;font-size:.72rem;cursor:pointer;color:var(--text);">' + e + ' ' + msg.reactions[e] + '</button>';
        }).join('');
        var emojiPickHtml = '<div class="chat-emoji-pick" style="display:none;position:absolute;bottom:100%;right:0;background:var(--surface);border:1px solid var(--border2);border-radius:8px;padding:.3rem;z-index:20;flex-wrap:wrap;gap:.15rem;width:160px;">' +
          EMOTE_REACTIONS.map(function (e) { return '<button onclick="window.combatChatAddReaction(\'' + String(msg.id || '').replace(/'/g,"'") + '\',\'' + e + '\');this.closest(\'.chat-emoji-pick\').style.display=\'none\'" style="background:none;border:none;cursor:pointer;font-size:1rem;padding:.1rem .15rem;">' + e + '</button>'; }).join('') +
          '</div>';
        return '<div class="combat-chat-msg' + (isSystem ? ' system' : '') + '" style="padding:.3rem .4rem;border-bottom:1px solid rgba(255,255,255,.04);position:relative;">' +
          (isSystem ? '' : '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.1rem;"><span style="font-size:.68rem;font-weight:700;color:var(--combat-accent);">' + escapeHtml(msg.sender) + '</span><span style="font-size:.6rem;color:var(--combat-muted);">' + timeStr + '</span></div>') +
          '<div style="font-size:.78rem;color:' + (isSystem ? 'var(--teal)' : 'var(--text)') + ';word-break:break-word;">' + escapeHtml(msg.text) + '</div>' +
          (reactionHtml ? '<div style="display:flex;flex-wrap:wrap;gap:.2rem;margin-top:.2rem;">' + reactionHtml + '</div>' : '') +
          '<div style="position:relative;display:inline-block;">' +
          '<button onclick="var p=this.nextElementSibling;p.style.display=p.style.display===\'flex\'?\'none\':\'flex\'" style="background:none;border:none;cursor:pointer;font-size:.7rem;color:var(--combat-muted);padding:0;margin-top:.12rem;">+ React</button>' +
          emojiPickHtml + '</div></div>';
      }).join('');
      feed.scrollTop = feed.scrollHeight;
    }

    function mountCombatChatPanel() {
      if (document.getElementById('combatChatPanel')) return;
      var root = document.getElementById('combatModeOverlay');
      if (!root) return;
      var panel = document.createElement('div');
      panel.id = 'combatChatPanel';
      panel.className = 'combat-chat-panel';
      panel.innerHTML =
        '<div class="combat-chat-header" onclick="window.toggleCombatChat()">' +
          '<span>💬 Party Chat</span>' +
          '<span id="combatChatUnread" class="combat-chat-unread" style="display:none;">0</span>' +
          '<span style="float:right;font-size:.7rem;cursor:pointer;" id="combatChatToggleArrow">▼</span>' +
        '</div>' +
        '<div class="combat-chat-body" id="combatChatBody">' +
          '<div class="combat-chat-feed" id="combatChatFeed"></div>' +
          '<div class="combat-chat-quick-row" id="combatChatQuickRow">' +
            QUICK_EMOTES.map(function (e) {
              return '<button class="combat-chip" onclick="window.combatChatSend(\'' + e.text.replace(/'/g, "\\'") + '\')" style="font-size:.7rem;">' + e.label + '</button>';
            }).join('') +
          '</div>' +
          '<div class="combat-chat-input-row">' +
            '<input id="combatChatInput" class="combat-input" type="text" maxlength="280" placeholder="Message party..." style="flex:1;">' +
            '<button class="btn btn-xs" onclick="window.combatChatSend()">Send</button>' +
          '</div>' +
        '</div>';
      root.appendChild(panel);

      var input = document.getElementById('combatChatInput');
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.combatChatSend(); }
        });
      }
      renderCombatChat();
    }

    window.combatChatSend = function (preset) {
      var input = document.getElementById('combatChatInput');
      var text = preset || (input && input.value.trim()) || '';
      if (!text) return;
      addChatMessage(text, 'player', getPlayerName());
      if (input && !preset) input.value = '';
    };

    window.combatChatAddReaction = addReaction;

    window.combatChatPostSystem = function (text) {
      addChatMessage(text, 'system', 'System');
    };

    window.toggleCombatChat = function () {
      var body = document.getElementById('combatChatBody');
      var arrow = document.getElementById('combatChatToggleArrow');
      if (!body) return;
      var collapsed = body.style.display === 'none';
      body.style.display = collapsed ? 'flex' : 'none';
      if (arrow) arrow.textContent = collapsed ? '▼' : '▲';
    };

    // Mount after overlay renders
    store.subscribe(function () { mountCombatChatPanel(); });
    if (document.readyState !== 'loading') {
      setTimeout(mountCombatChatPanel, 800);
    } else {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(mountCombatChatPanel, 800); });
    }
  })();

  // ══════════════════════════════════════════════════════════════════════════
  // CONTENT BLADE SYSTEM — Tabbed side panels (Fabled-style "Content Blades")
  // Quick-access tabbed drawer for Rules, Items, Bestiary, Notes, Loot Tables
  // ══════════════════════════════════════════════════════════════════════════
  (function () {
    var BLADE_STORAGE_KEY = 'btl-content-blade-v1';
    var bladeState = { open: false, activeTab: 'rules' };
    var BLADE_SHOP_CATEGORIES = [
      'weapons', 'melee_exp', 'ranged_exp', 'armor', 'armor_exp',
      'essentials', 'toolkits', 'items', 'scrolls', 'services',
      'remedies', 'strange', 'tradegoods', 'augmentations', 'os_hacks', 'weapon_mods'
    ];

    var BLADE_TABS = [
      { id: 'rules',    icon: '📖', label: 'Rules' },
      { id: 'items',    icon: '🗡️', label: 'Items' },
      { id: 'bestiary', icon: '🐉', label: 'Bestiary' },
      { id: 'notes',    icon: '📝', label: 'Notes' },
      { id: 'loot',     icon: '💰', label: 'Loot' }
    ];

    function saveBladeNotes(text) {
      try { localStorage.setItem(BLADE_STORAGE_KEY + '-notes', String(text || '')); } catch (e) {}
    }
    function loadBladeNotes() {
      try { return localStorage.getItem(BLADE_STORAGE_KEY + '-notes') || ''; } catch (e) { return ''; }
    }

    function getBladeShopData() {
      try {
        if (window && window.SHOP_DATA && typeof window.SHOP_DATA === 'object') return window.SHOP_DATA;
      } catch (_err) {}
      try {
        if (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && typeof SHOP_DATA === 'object') return SHOP_DATA;
      } catch (_err2) {}
      return null;
    }

    function getContentBladeItemRows(state) {
      var rows = [];
      var seen = Object.create(null);

      function pushRow(entry, fallbackType, sourceLabel) {
        if (!entry) return;
        var name = String(entry.name || entry.id || '').trim();
        if (!name) return;
        var type = String(entry.type || fallbackType || '').trim();
        var key = name.toLowerCase() + '|' + type.toLowerCase() + '|' + String(sourceLabel || '').toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        rows.push({
          name: name,
          type: type,
          effect: String(entry.effect || entry.desc || entry.description || '').trim(),
          stat: String(entry.stat || '').trim(),
          cost: Number(entry.cost || 0),
          source: String(sourceLabel || '').trim()
        });
      }

      (state.codexItems || []).forEach(function (entry) {
        pushRow(entry, entry && entry.type || 'Codex', 'Codex');
      });

      var shopData = getBladeShopData();
      if (shopData) {
        BLADE_SHOP_CATEGORIES.forEach(function (category) {
          var list = Array.isArray(shopData[category]) ? shopData[category] : [];
          list.forEach(function (entry) {
            pushRow(entry, category.replace(/_/g, ' '), 'Merchant');
          });
        });
      }

      rows.sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      return rows;
    }

    function renderBladeContent(tabId) {
      var body = document.getElementById('contentBladeBody');
      if (!body) return;
      var state = store.getState();

      if (tabId === 'rules') {
        body.innerHTML = '<div class="blade-section-title">Quick Rules Reference</div>' +
          '<input class="combat-input" id="bladeRulesSearch" placeholder="Search rules..." style="margin-bottom:.4rem;">' +
          '<div id="bladeRulesList" class="blade-scroll-list"></div>';
        var rules = [
            { h: 'Initiative', t: 'Combat starts by listing all tokens in turn order. The selected Wayfarer acts through the Combat tab or scene actions.' },
            { h: 'Actions per Turn', t: 'Your combat action budget is shown in the Combat tab. Some effects add or spend actions; movement and utilities are tracked separately.' },
            { h: 'Attack Roll', t: 'Roll your action die(s), including advantage dice and explosions, then compare the highest total to the target Dread die.' },
            { h: 'Damage', t: 'On a hit, subtract the target Dread total from your highest action total. That difference is the damage dealt.' },
            { h: 'Critical Hit', t: 'Exploding dice can push totals higher and can trigger extra effects when a weapon or skill says so.' },
            { h: 'Stress', t: 'Failed checks and enemy pressure add Stress. At max Stress, the character risks Trauma or a bigger condition penalty.' },
            { h: 'Cover', t: 'Cover and line-of-sight penalties are applied by the scene. The target selector shows whether an action is in range.' },
            { h: 'Elevation', t: 'Higher ground can add a modifier in scene combat depending on the map and target positioning.' },
            { h: 'Flanking', t: 'Some abilities or scene rules grant extra dice when allies pressure from multiple sides.' },
            { h: 'Conditions', t: 'Conditions such as Focused, Protected, Vulnerable, and Shaken are tracked on the character sheet and modify rolls.' },
            { h: 'Loot', t: 'Defeated enemies can leave a body loot cache. Open it to take items into the backpack, then manage them in the Character tab.' },
            { h: 'Hold / Delay', t: 'Hold and delay are turn-order tools in combat scenes; they move your token within the current round order.' }
        ];
        var searchInput = document.getElementById('bladeRulesSearch');
        var list = document.getElementById('bladeRulesList');
        function renderRules(filter) {
          var f = String(filter || '').toLowerCase();
          list.innerHTML = rules.filter(function (r) {
            return !f || r.h.toLowerCase().indexOf(f) >= 0 || r.t.toLowerCase().indexOf(f) >= 0;
          }).map(function (r) {
            return '<div class="blade-rule-entry"><div class="blade-rule-heading">' + escapeHtml(r.h) + '</div><div class="blade-rule-body">' + escapeHtml(r.t) + '</div></div>';
          }).join('');
        }
        renderRules('');
        if (searchInput) searchInput.addEventListener('input', function () { renderRules(this.value); });

      } else if (tabId === 'items') {
        var itemRows = getContentBladeItemRows(state).slice(0, 240);
        body.innerHTML = '<div class="blade-section-title">Item Compendium</div>' +
          '<input class="combat-input" id="bladeItemSearch" placeholder="Search items..." style="margin-bottom:.4rem;">' +
          '<div id="bladeItemList" class="blade-scroll-list"></div>';
        function renderItems(filter) {
          var f = String(filter || '').toLowerCase();
          var filtered = itemRows.filter(function (it) {
            var haystack = [it.name, it.type, it.effect, it.stat, it.source].join(' ').toLowerCase();
            return !f || haystack.indexOf(f) >= 0;
          });
          var list = document.getElementById('bladeItemList');
          if (!list) return;
          list.innerHTML = filtered.length
            ? filtered.map(function (it) {
              return '<div class="blade-item-row"><span class="blade-item-name">' + escapeHtml(String(it.name || it.id || '—')) + '</span>' +
                (it.type ? '<span class="blade-item-type">' + escapeHtml(String(it.type)) + '</span>' : '') +
                (it.stat ? '<span class="blade-item-type" style="margin-left:.2rem;">' + escapeHtml(String(it.stat)) + '</span>' : '') +
                (it.cost ? '<span class="blade-item-type" style="margin-left:.2rem;color:var(--teal);">' + Number(it.cost) + 'c</span>' : '') +
                (it.source ? '<span class="blade-item-type" style="margin-left:.2rem;">' + escapeHtml(String(it.source)) + '</span>' : '') +
                (it.effect ? '<div class="blade-item-effect">' + escapeHtml(String(it.effect)) + '</div>' : '') + '</div>';
            }).join('')
            : '<div class="blade-empty">No item entries found in codex or merchant catalog.</div>';
        }
        renderItems('');
        var si = document.getElementById('bladeItemSearch');
        if (si) si.addEventListener('input', function () { renderItems(this.value); });

      } else if (tabId === 'bestiary') {
        var beastRows = (state.codexBestiary || []).slice(0, 80);
        body.innerHTML = '<div class="blade-section-title">Bestiary</div>' +
          '<input class="combat-input" id="bladeBeastSearch" placeholder="Search creatures..." style="margin-bottom:.4rem;">' +
          '<div id="bladeBeastList" class="blade-scroll-list"></div>';
        function renderBeasts(filter) {
          var f = String(filter || '').toLowerCase();
          var filtered = beastRows.filter(function (b) { return !f || String(b.name || b.id || '').toLowerCase().indexOf(f) >= 0; });
          var list = document.getElementById('bladeBeastList');
          if (!list) return;
          list.innerHTML = filtered.length
            ? filtered.map(function (b) {
              return '<div class="blade-item-row"><span class="blade-item-name">' + escapeHtml(String(b.name || b.id || '—')) + '</span>' +
                (b.dread !== undefined ? '<span class="blade-item-type">Dread ' + b.dread + '</span>' : '') +
                (b.hp !== undefined ? '<span class="blade-item-type" style="margin-left:.2rem;">HP ' + b.hp + '</span>' : '') +
                (b.traits ? '<div class="blade-item-effect">' + escapeHtml(String(b.traits)) + '</div>' : '') + '</div>';
            }).join('')
            : '<div class="blade-empty">No bestiary entries yet.</div>';
        }
        renderBeasts('');
        var sb = document.getElementById('bladeBeastSearch');
        if (sb) sb.addEventListener('input', function () { renderBeasts(this.value); });

      } else if (tabId === 'notes') {
        body.innerHTML = '<div class="blade-section-title">GM Notes</div>' +
          '<textarea id="bladeNotesArea" class="blade-notes-area" placeholder="Freeform notes for this session...">' + escapeHtml(loadBladeNotes()) + '</textarea>' +
          '<button class="btn btn-xs" style="margin-top:.4rem;" onclick="window.saveBladeNotes()">Save Notes</button>';
        var ta = document.getElementById('bladeNotesArea');
        if (ta) ta.addEventListener('input', function () { saveBladeNotes(this.value); });

      } else if (tabId === 'loot') {
        body.innerHTML = '<div class="blade-section-title">Loot Tables</div>' +
          '<div id="bladeLootList" class="blade-scroll-list"></div>' +
          '<div style="margin-top:.6rem;"><div class="combat-label">New Loot Entry</div>' +
          '<div style="display:grid;grid-template-columns:1fr .6fr .5fr auto;gap:.24rem;align-items:end;">' +
          '<input class="combat-input" id="bladeLootName" placeholder="Item name" maxlength="60">' +
          '<input class="combat-input" id="bladeLootType" placeholder="Type" maxlength="30">' +
          '<input class="combat-input" id="bladeLootChance" type="number" min="1" max="100" value="50" title="Drop %">' +
          '<button class="btn btn-xs" onclick="window.addLootTableEntry()">Add</button>' +
          '</div></div>';
        renderLootTableBlade();
      }
    }

    function renderLootTableBlade() {
      var list = document.getElementById('bladeLootList');
      if (!list) return;
      var tables = getLootTables();
      list.innerHTML = tables.length
        ? tables.map(function (entry, idx) {
          return '<div class="blade-item-row" style="display:grid;grid-template-columns:1fr .5fr .4fr auto;gap:.3rem;align-items:center;">' +
            '<span class="blade-item-name">' + escapeHtml(String(entry.name || '—')) + '</span>' +
            '<span class="blade-item-type">' + escapeHtml(String(entry.type || '')) + '</span>' +
            '<span class="blade-item-type" style="color:var(--teal);">' + Number(entry.chance || 50) + '%</span>' +
            '<button class="btn btn-xs btn-red" onclick="window.removeLootTableEntry(' + idx + ')">✕</button>' +
            '</div>';
        }).join('')
        : '<div class="blade-empty">No loot table entries. Add items below.</div>';
    }

    function getLootTables() {
      try { return JSON.parse(localStorage.getItem('btl-loot-tables-v1') || '[]'); } catch (e) { return []; }
    }
    function saveLootTables(tables) {
      try { localStorage.setItem('btl-loot-tables-v1', JSON.stringify(tables.slice(0, 200))); } catch (e) {}
    }

    window.addLootTableEntry = function () {
      var name = (document.getElementById('bladeLootName') || {}).value || '';
      var type = (document.getElementById('bladeLootType') || {}).value || '';
      var chance = parseInt((document.getElementById('bladeLootChance') || {}).value || '50');
      if (!name.trim()) return;
      var tables = getLootTables();
      tables.push({ name: name.trim(), type: type.trim(), chance: Math.min(100, Math.max(1, chance || 50)) });
      saveLootTables(tables);
      var nameEl = document.getElementById('bladeLootName');
      if (nameEl) nameEl.value = '';
      renderLootTableBlade();
    };

    window.removeLootTableEntry = function (idx) {
      var tables = getLootTables();
      tables.splice(idx, 1);
      saveLootTables(tables);
      renderLootTableBlade();
    };

    window.rollLootTable = function (count) {
      var tables = getLootTables();
      if (!tables.length) { safeNotif('No loot table entries. Add items in the Loot blade.', 'warn'); return []; }
      var n = Math.max(1, Number(count || 1));
      var results = [];
      for (var i = 0; i < n; i++) {
        tables.forEach(function (entry) {
          if (Math.random() * 100 <= Number(entry.chance || 50)) {
            results.push(Object.assign({}, entry));
          }
        });
      }
      if (results.length) {
        safeNotif('Loot dropped: ' + results.map(function (r) { return r.name; }).join(', '), 'info');
        if (typeof window.combatChatPostSystem === 'function') {
          window.combatChatPostSystem('💰 Loot: ' + results.map(function (r) { return r.name; }).join(', '));
        }
      } else {
        safeNotif('No loot dropped this time.', 'info');
      }
      return results;
    };

    window.saveBladeNotes = function () {
      var ta = document.getElementById('bladeNotesArea');
      if (ta) saveBladeNotes(ta.value);
      safeNotif('Notes saved.', 'info');
    };

    function setBladeTab(tabId) {
      bladeState.activeTab = tabId;
      document.querySelectorAll('.blade-tab-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      });
      renderBladeContent(tabId);
    }

    function mountContentBlade() {
      if (document.getElementById('contentBladePanel')) return;
      var root = document.getElementById('combatModeOverlay');
      if (!root) return;

      var panel = document.createElement('div');
      panel.id = 'contentBladePanel';
      panel.className = 'content-blade-panel';
      panel.innerHTML =
        '<div class="content-blade-header">' +
          '<div style="display:flex;align-items:center;gap:.4rem;">' +
            '<span style="font-size:.78rem;font-family:\'Cinzel\',serif;letter-spacing:.06em;">Content Blade</span>' +
          '</div>' +
          '<button onclick="window.toggleContentBlade()" style="background:none;border:none;color:var(--text);cursor:pointer;font-size:.8rem;" id="contentBladeToggleBtn">◀</button>' +
        '</div>' +
        '<div class="content-blade-tabs" id="contentBladeTabs">' +
          BLADE_TABS.map(function (t) {
            return '<button class="blade-tab-btn' + (t.id === bladeState.activeTab ? ' active' : '') + '" data-tab="' + t.id + '" title="' + t.label + '">' + t.icon + '<span class="blade-tab-label"> ' + t.label + '</span></button>';
          }).join('') +
        '</div>' +
        '<div class="content-blade-body" id="contentBladeBody"></div>';

      root.appendChild(panel);

      document.querySelectorAll('.blade-tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { setBladeTab(this.dataset.tab); });
      });

      renderBladeContent(bladeState.activeTab);
    }

    window.toggleContentBlade = function () {
      var panel = document.getElementById('contentBladePanel');
      if (!panel) return;
      bladeState.open = !bladeState.open;
      panel.classList.toggle('open', bladeState.open);
      var btn = document.getElementById('contentBladeToggleBtn');
      if (btn) btn.textContent = bladeState.open ? '▶' : '◀';
    };

    window.openContentBlade = function (tabId) {
      var panel = document.getElementById('contentBladePanel');
      if (!panel) { mountContentBlade(); panel = document.getElementById('contentBladePanel'); }
      if (!panel) return;
      bladeState.open = true;
      panel.classList.add('open');
      var btn = document.getElementById('contentBladeToggleBtn');
      if (btn) btn.textContent = '▶';
      if (tabId) setBladeTab(tabId);
    };

    store.subscribe(function () { mountContentBlade(); });
    if (document.readyState !== 'loading') {
      setTimeout(mountContentBlade, 600);
    } else {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(mountContentBlade, 600); });
    }
  })();

  // ══════════════════════════════════════════════════════════════════════════
  // GRID INVENTORY SYSTEM — Visual drag-and-drop grid loot management
  // Inspired by Fabled VTT's grid-based inventory with loot tables
  // ══════════════════════════════════════════════════════════════════════════
  (function () {
    var INV_KEY = 'btl-grid-inventory-v1';
    var GRID_COLS = 8;
    var GRID_ROWS = 5;
    var TOTAL_SLOTS = GRID_COLS * GRID_ROWS;

    function loadInventory() {
      try { return JSON.parse(localStorage.getItem(INV_KEY) || '{}'); } catch (e) { return {}; }
    }
    function saveInventory(inv) {
      try { localStorage.setItem(INV_KEY, JSON.stringify(inv)); } catch (e) {}
    }

    function addItemToInventory(item) {
      var inv = loadInventory();
      for (var i = 0; i < TOTAL_SLOTS; i++) {
        if (!inv[String(i)]) {
          inv[String(i)] = Object.assign({ slotId: i }, item, { id: uid('inv') });
          saveInventory(inv);
          renderGridInventory();
          return true;
        }
      }
      safeNotif('Inventory full!', 'warn');
      return false;
    }

    function removeItemFromInventory(slotId) {
      var inv = loadInventory();
      delete inv[String(slotId)];
      saveInventory(inv);
      renderGridInventory();
    }

    function moveItem(fromSlot, toSlot) {
      var inv = loadInventory();
      var item = inv[String(fromSlot)];
      if (!item) return;
      if (inv[String(toSlot)]) {
        // Swap
        var temp = inv[String(toSlot)];
        inv[String(toSlot)] = Object.assign({}, item, { slotId: toSlot });
        inv[String(fromSlot)] = Object.assign({}, temp, { slotId: fromSlot });
      } else {
        inv[String(toSlot)] = Object.assign({}, item, { slotId: toSlot });
        delete inv[String(fromSlot)];
      }
      saveInventory(inv);
      renderGridInventory();
    }

    function renderGridInventory() {
      var container = document.getElementById('gridInventorySlots');
      if (!container) return;
      var inv = loadInventory();
      var html = '';
      for (var i = 0; i < TOTAL_SLOTS; i++) {
        var item = inv[String(i)];
        var slotId = i;
        if (item) {
          var typeColors = { 'One-Time': '#e3bc5e', 'Passive': '#49c9bb', 'Condition': '#c690ff', '': '#9fa7bc' };
          var color = typeColors[String(item.type || '')] || '#9fa7bc';
          html += '<div class="inv-slot occupied" draggable="true" data-slot="' + slotId + '" data-item-id="' + escapeHtml(String(item.id || '')) + '" title="' + escapeHtml(String(item.name || '')) + (item.effect ? '\n' + item.effect : '') + '">' +
            '<div class="inv-slot-icon" style="border-color:' + color + ';color:' + color + ';">' + escapeHtml((String(item.name || '?')[0] || '?').toUpperCase()) + '</div>' +
            '<div class="inv-slot-name">' + escapeHtml(String(item.name || '').slice(0, 10)) + '</div>' +
            '<button class="inv-slot-remove" onclick="window.removeInvItem(' + slotId + ')">✕</button>' +
            '</div>';
        } else {
          html += '<div class="inv-slot empty" data-slot="' + slotId + '"></div>';
        }
      }
      container.innerHTML = html;

      // Drag-and-drop wiring
      container.querySelectorAll('.inv-slot.occupied').forEach(function (el) {
        el.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/inv-slot', String(this.dataset.slot || ''));
        });
      });
      container.querySelectorAll('.inv-slot').forEach(function (el) {
        el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('drag-over'); });
        el.addEventListener('dragleave', function () { el.classList.remove('drag-over'); });
        el.addEventListener('drop', function (e) {
          e.preventDefault();
          el.classList.remove('drag-over');
          var from = e.dataTransfer.getData('text/inv-slot');
          var to = String(this.dataset.slot || '');
          if (from !== '' && to !== '' && from !== to) moveItem(Number(from), Number(to));
        });
      });
    }

    window.removeInvItem = function (slotId) { removeItemFromInventory(Number(slotId)); };
    window.addToInventory = addItemToInventory;

    window.lootAndAddToInventory = function (count) {
      var dropped = typeof window.rollLootTable === 'function' ? window.rollLootTable(count || 1) : [];
      dropped.forEach(function (item) { addItemToInventory(item); });
      if (dropped.length) openGridInventory();
    };

    function mountGridInventory() {
      if (document.getElementById('gridInventoryPanel')) return;
      var root = document.getElementById('combatModeOverlay') || document.body;
      if (!root) return;
      var panel = document.createElement('div');
      panel.id = 'gridInventoryPanel';
      panel.className = 'grid-inventory-panel';
      panel.style.display = 'none';
      if (root === document.body) {
        panel.style.position = 'fixed';
        panel.style.right = '1rem';
        panel.style.bottom = '4.2rem';
        panel.style.zIndex = '5600';
      }
      panel.innerHTML =
        '<div class="combat-chat-header" style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span>🎒 Inventory</span>' +
          '<div style="display:flex;gap:.4rem;align-items:center;">' +
            '<button class="btn btn-xs" onclick="window.lootAndAddToInventory(1)" title="Roll loot table and add result">Roll Loot</button>' +
            '<button class="btn btn-xs" onclick="window.openContentBlade(\'loot\')" title="Manage loot tables">Tables</button>' +
            '<button style="background:none;border:none;color:var(--text);cursor:pointer;" onclick="window.closeGridInventory()">✕</button>' +
          '</div>' +
        '</div>' +
        '<div style="padding:.4rem;">' +
          '<div class="inv-quick-add-row">' +
            '<input class="combat-input" id="invQuickAddName" placeholder="Item name" maxlength="60" style="flex:1;">' +
            '<select class="combat-select" id="invQuickAddType">' +
              '<option value="">Type</option><option>One-Time</option><option>Passive</option><option>Condition</option>' +
            '</select>' +
            '<button class="btn btn-xs" onclick="window.invQuickAdd()">Add</button>' +
          '</div>' +
          '<div class="grid-inventory-grid" id="gridInventorySlots"></div>' +
          '<div id="gridInventoryItemDetail" class="inv-item-detail" style="display:none;"></div>' +
        '</div>';
      root.appendChild(panel);
      renderGridInventory();
    }

    window.invQuickAdd = function () {
      var name = (document.getElementById('invQuickAddName') || {}).value || '';
      var type = (document.getElementById('invQuickAddType') || {}).value || '';
      if (!name.trim()) return;
      addItemToInventory({ name: name.trim(), type: type });
      var el = document.getElementById('invQuickAddName');
      if (el) el.value = '';
    };

    window.openGridInventory = function () {
      var panel = document.getElementById('gridInventoryPanel');
      if (!panel) { mountGridInventory(); panel = document.getElementById('gridInventoryPanel'); }
      if (!panel) {
        safeNotif('Inventory panel is unavailable right now.', 'warn');
        return;
      }
      panel.style.display = 'block';
      renderGridInventory();
    };
    window.closeGridInventory = function () {
      var panel = document.getElementById('gridInventoryPanel');
      if (panel) panel.style.display = 'none';
    };
    window.toggleGridInventory = function () {
      var panel = document.getElementById('gridInventoryPanel');
      if (!panel || panel.style.display === 'none') window.openGridInventory();
      else window.closeGridInventory();
    };

    store.subscribe(function () { mountGridInventory(); });
    if (document.readyState !== 'loading') {
      setTimeout(mountGridInventory, 700);
    } else {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(mountGridInventory, 700); });
    }
  })();

  // ══════════════════════════════════════════════════════════════════════════════
  // COMBAT BACKPACK PANEL — Live sync with Character Tab. Use items in combat.
  // ══════════════════════════════════════════════════════════════════════════════
  (function () {
    var BP_PREF_KEY = 'btl-combat-bp-panel-v1';
    var panelOpen = false;
    var panelTab = 'backpack';
    try { panelOpen = !!(JSON.parse(localStorage.getItem(BP_PREF_KEY) || '{}').open); } catch (_e) {}
    try {
      var bpPref = JSON.parse(localStorage.getItem(BP_PREF_KEY) || '{}');
      if (bpPref && (bpPref.tab === 'community' || bpPref.tab === 'backpack')) panelTab = bpPref.tab;
    } catch (_e2) {}
    function savePref() {
      try { localStorage.setItem(BP_PREF_KEY, JSON.stringify({ open: panelOpen, tab: panelTab })); } catch (_e) {}
    }

    function bpSlotCost(slotText) {
      return getItemSlotCost(String(slotText || '').replace(/\s*x\d+$/i, '').trim());
    }

    function getBpStats() {
      var items = (window.S && Array.isArray(window.S.backpack)) ? window.S.backpack : [];
      var used = 0;
      items.forEach(function (s) { if (s && s.trim()) used += bpSlotCost(s); });
      var cap = typeof window.getBackpackCapacity === 'function' ? window.getBackpackCapacity() : 6;
      return { used: used, cap: cap };
    }

    function getItemCombatEffect(itemName) {
      var name = String(itemName || '').trim().toLowerCase();
      var shopData = null;
      try { shopData = window.SHOP_DATA || null; } catch (_e) {}
      if (shopData) {
        var allCats = Object.keys(shopData);
        for (var ci = 0; ci < allCats.length; ci++) {
          var list = Array.isArray(shopData[allCats[ci]]) ? shopData[allCats[ci]] : [];
          for (var ii = 0; ii < list.length; ii++) {
            var entry = list[ii];
            if (!entry) continue;
            var eName = String(entry.name || '').toLowerCase();
            if (eName !== name && !name.startsWith(eName) && !eName.startsWith(name)) continue;
            var combined = (String(entry.desc || '') + ' ' + String(entry.stat || '')).toLowerCase();
            var mStress = combined.match(/restore[sd]?\s+(?:d(\d+)|(\d+))\s+stress/i) ||
                          combined.match(/clear\s+(\d+)\s+stress/i) ||
                          combined.match(/d(\d+)\s+stress/i);
            if (mStress) return { type: 'stress', amount: -(parseInt(mStress[1] || mStress[2] || 2, 10)), label: 'Restores Stress' };
            if (combined.indexOf('remove weakened') >= 0) return { type: 'condition', condition: 'weakened', label: 'Removes Weakened' };
            if (combined.indexOf('remove distracted') >= 0) return { type: 'condition', condition: 'distracted', label: 'Removes Distracted' };
            if (combined.indexOf('remove shaken') >= 0) return { type: 'condition', condition: 'shaken', label: 'Removes Shaken' };
            if (combined.indexOf('remove vulnerable') >= 0) return { type: 'condition', condition: 'vulnerable', label: 'Removes Vulnerable' };
            if (combined.indexOf('-1 trauma') >= 0 || combined.indexOf('reduces 1 trauma') >= 0) return { type: 'trauma', amount: -1, label: 'Reduces Trauma' };
            if (combined.indexOf('reduce trauma') >= 0 || combined.indexOf('trauma') >= 0) return { type: 'trauma', amount: -1, label: 'Reduces Trauma' };
          }
        }
      }
      // Heuristic fallbacks
      if (/salve|heal|potion|remedy|stimulant|tonic|broth|oil/.test(name)) return { type: 'stress', amount: -2, label: 'Restores Stress' };
      if (/depressant/.test(name)) return { type: 'trauma', amount: -1, label: 'Reduces Trauma' };
      return null;
    }

    function useCombatBackpackItem(slotIndex) {
      if (!window.S || !Array.isArray(window.S.backpack)) return;
      var raw = window.S.backpack[slotIndex] || '';
      if (!raw.trim()) return;
      if (typeof window.useBackpackItem === 'function') {
        window.useBackpackItem(Number(slotIndex || 0));
        renderCombatBackpackPanel();
        return;
      }
      var nameRaw = raw.replace(/\s*x\d+$/i, '').trim();
      var effect = getItemCombatEffect(nameRaw);
      if (!effect) { safeNotif(nameRaw + ' cannot be used directly in combat.', 'warn'); return; }

      if (effect.type === 'stress') {
        var delta = Number(effect.amount || -2);
        window.S.stress = Math.max(0, (window.S.stress || 0) + delta);
        if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
        safeNotif(nameRaw + ' used — ' + (delta < 0 ? 'restored ' + Math.abs(delta) + ' Stress' : 'applied ' + delta + ' Stress') + '.', 'good');
      } else if (effect.type === 'condition') {
        if (window.S && window.S.conditions) { window.S.conditions[effect.condition] = false; }
        if (window.S && window.S.traumaConditions) { window.S.traumaConditions[effect.condition] = false; }
        if (typeof window.updateConditionButtons === 'function') window.updateConditionButtons();
        if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
        safeNotif(nameRaw + ' used — ' + effect.label + '.', 'good');
      } else if (effect.type === 'trauma') {
        window.S.trauma = Math.max(0, (window.S.trauma || 0) - 1);
        if (typeof window.updateAllStatDisplays === 'function') window.updateAllStatDisplays();
        safeNotif(nameRaw + ' used — ' + effect.label + '.', 'good');
      }

      // Consume item
      if (typeof window.consumeBackpackItemByName === 'function') {
        window.consumeBackpackItemByName(nameRaw);
      } else {
        var countM = raw.match(/\s*x(\d+)$/i);
        var cnt = countM ? parseInt(countM[1], 10) : 1;
        window.S.backpack[slotIndex] = cnt > 1 ? (nameRaw + ' x' + (cnt - 1)) : '';
      }
      addHistory('Used ' + nameRaw + ' (combat): ' + effect.label);
      if (typeof window.renderBackpackUI === 'function') window.renderBackpackUI();
      renderCombatBackpackPanel();
    }
    window.useCombatBackpackItem = useCombatBackpackItem;
    window.inspectCombatBackpackItem = function (slotIndex) {
      if (typeof window.showBackpackItem === 'function') {
        window.showBackpackItem(Number(slotIndex || 0));
      }
    };
    window.combatBpSetTab = function (tabKey) {
      var key = String(tabKey || 'backpack').toLowerCase();
      panelTab = key === 'community' ? 'community' : 'backpack';
      savePref();
      renderCombatBackpackPanel();
    };
    window.combatShareBackpackItem = async function (slotIndex) {
      if (typeof window.shareBackpackItemToCommunity === 'function') {
        try { await window.shareBackpackItemToCommunity(Number(slotIndex || 0)); } catch (_err) {}
      } else if (typeof window.moveBackpackToStorage === 'function') {
        try { await window.moveBackpackToStorage(Number(slotIndex || 0), 'party'); } catch (_err2) {}
      }
      renderCombatBackpackPanel();
    };
    window.combatClaimCommunityItem = async function (stashIndex) {
      if (typeof window.claimCommunityBackpackItem === 'function') {
        try { await window.claimCommunityBackpackItem(Number(stashIndex || 0)); } catch (_err) {}
      } else if (window.campaignSystem && typeof window.campaignSystem.claimSharedItem === 'function') {
        try { await window.campaignSystem.claimSharedItem(Number(stashIndex || 0)); } catch (_err2) {}
      }
      renderCombatBackpackPanel();
    };
    function getCombatCommunityItems() {
      if (typeof window.getCommunityBackpackItems === 'function') {
        try { return window.getCommunityBackpackItems(); } catch (_err) {}
      }
      var shared = (window.campaignSystem && typeof window.campaignSystem.getSharedState === 'function') ? window.campaignSystem.getSharedState() : null;
      if (shared && Array.isArray(shared.partyStash)) return shared.partyStash.slice();
      if (window.S && Array.isArray(window.S.communityBackpack)) return window.S.communityBackpack.slice();
      return [];
    }

    function renderCombatBackpackPanel() {
      var panel = document.getElementById('combatBackpackPanel');
      if (!panel) return;
      var body = document.getElementById('combatBackpackPanelBody');
      var toggle = document.getElementById('combatBpToggleIcon');
      if (toggle) toggle.textContent = panelOpen ? '▼' : '▲';
      if (!body) return;
      if (!panelOpen) { body.style.display = 'none'; return; }
      body.style.display = 'block';

      var stats = getBpStats();
      var sColor = stats.used > stats.cap ? '#e05050' : stats.used >= stats.cap ? '#e3bc5e' : '#57d69b';
      var bpSlots = (window.S && Array.isArray(window.S.backpack)) ? window.S.backpack : [];
      var rows = bpSlots.map(function (slotText, idx) {
        if (!slotText || !slotText.trim()) return '';
        var nameRaw = slotText.replace(/\s*x\d+$/i, '').trim();
        var countM = slotText.match(/\s*x(\d+)$/i);
        var count = countM ? parseInt(countM[1], 10) : 1;
        var cost = bpSlotCost(slotText);
        var effect = getItemCombatEffect(nameRaw);
        var useBtn = '<button class="btn btn-xs" style="flex-shrink:0;font-size:.64rem;padding:.08rem .28rem;background:rgba(46,196,182,.15);border-color:rgba(46,196,182,.4);color:var(--teal);" onclick="window.useCombatBackpackItem(' + idx + ')">Use</button>';
        var infoBtn = '<button class="btn btn-xs" style="flex-shrink:0;font-size:.64rem;padding:.08rem .28rem;" onclick="window.inspectCombatBackpackItem(' + idx + ')">Info</button>';
        var shareBtn = '<button class="btn btn-xs" style="flex-shrink:0;font-size:.64rem;padding:.08rem .28rem;" onclick="window.combatShareBackpackItem(' + idx + ')">Share</button>';
        var effectHint = effect ? ('<div style="font-size:.62rem;color:var(--muted2);margin-top:.04rem;">' + escapeHtml(String(effect.label || 'Usable in combat')) + '</div>') : '';
        var costBadge = '<span style="font-size:.62rem;color:var(--muted2);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:3px;padding:.02rem .18rem;flex-shrink:0;">'
          + cost + (cost === 1 ? ' slot' : ' slots') + '</span>';
        return '<div style="display:flex;align-items:center;gap:.28rem;padding:.16rem .18rem;border-bottom:1px solid rgba(255,255,255,.04);">'
          + '<span style="flex:1;font-size:.78rem;font-family:Rajdhani,sans-serif;color:#f0f0f0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + escapeHtml(nameRaw) + (count > 1 ? '<span style="color:var(--teal);font-size:.7rem;"> ×' + count + '</span>' : '') + effectHint + '</span>'
          + costBadge
          + infoBtn
          + useBtn
          + shareBtn
          + '</div>';
      }).filter(Boolean).join('');

      var communityItems = getCombatCommunityItems();
      var communityRows = communityItems.map(function (item, idx) {
        var label = String(item || '').trim();
        if (!label) return '';
        return '<div style="display:flex;align-items:center;gap:.28rem;padding:.16rem .18rem;border-bottom:1px solid rgba(255,255,255,.04);">'
          + '<span style="flex:1;font-size:.78rem;font-family:Rajdhani,sans-serif;color:#f0f0f0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + escapeHtml(label) + '</span>'
          + '<button class="btn btn-xs btn-teal" style="flex-shrink:0;font-size:.64rem;padding:.08rem .28rem;" onclick="window.combatClaimCommunityItem(' + idx + ')">Take</button>'
          + '</div>';
      }).filter(Boolean).join('');

      var tabBtn = function (key, label) {
        var active = panelTab === key;
        return '<button class="btn btn-xs' + (active ? ' btn-teal' : '') + '" style="font-size:.63rem;padding:.08rem .32rem;" onclick="window.combatBpSetTab(\'' + key + '\')">' + label + '</button>';
      };

      var inner = '';
      if (panelTab === 'community') {
        inner = communityRows
          ? '<div style="max-height:172px;overflow-y:auto;">' + communityRows + '</div>'
          : '<div style="font-size:.74rem;color:var(--muted2);padding:.18rem 0;">Community Backpack is empty.</div>';
      } else {
        inner = rows
          ? '<div style="max-height:172px;overflow-y:auto;">' + rows + '</div>'
          : '<div style="font-size:.74rem;color:var(--muted2);padding:.18rem 0;">No items. Loot tokens or add via Character Tab.</div>';
      }

      body.innerHTML = '<div style="padding:.3rem .38rem;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.28rem;">'
        + '<div style="display:flex;gap:.2rem;align-items:center;">' + tabBtn('backpack', 'Backpack') + tabBtn('community', 'Community') + '</div>'
        + '<span style="font-size:.7rem;color:' + sColor + ';">' + stats.used + '/' + stats.cap + ' slots</span>'
        + '</div>'
        + inner
        + '</div>';
    }
    window.renderCombatBackpackPanel = renderCombatBackpackPanel;

    function mountCombatBackpackPanel() {
      if (document.getElementById('combatBackpackPanel')) { renderCombatBackpackPanel(); return; }
      var root = document.getElementById('combatModeOverlay');
      if (!root) return;
      var panel = document.createElement('div');
      panel.id = 'combatBackpackPanel';
      panel.style.cssText = 'position:absolute;bottom:3.2rem;right:.6rem;z-index:12;min-width:224px;max-width:280px;background:rgba(4,7,16,.97);border:1px solid rgba(201,162,39,.3);border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,.5);backdrop-filter:blur(6px);overflow:hidden;';
      panel.innerHTML = '<div id="combatBpHeader" style="display:flex;align-items:center;justify-content:space-between;padding:.28rem .45rem;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(201,162,39,.06);user-select:none;">'
        + '<span style="font-size:.72rem;font-family:\'Cinzel\',serif;letter-spacing:.05em;color:var(--combat-accent-2);">&#127920; Backpack</span>'
        + '<span id="combatBpToggleIcon" style="font-size:.62rem;color:var(--muted2);">' + (panelOpen ? '▼' : '▲') + '</span>'
        + '</div>'
        + '<div id="combatBackpackPanelBody" style="display:' + (panelOpen ? 'block' : 'none') + ';"></div>';
      root.appendChild(panel);
      document.getElementById('combatBpHeader').addEventListener('click', function () {
        panelOpen = !panelOpen;
        savePref();
        renderCombatBackpackPanel();
      });
      renderCombatBackpackPanel();
    }

    store.subscribe(function () { mountCombatBackpackPanel(); });
    if (document.readyState !== 'loading') {
      setTimeout(mountCombatBackpackPanel, 950);
    } else {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(mountCombatBackpackPanel, 950); });
    }
  })();

})();

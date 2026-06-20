// --- Custom Music Logic for Settings Audio Tab ---
window.playCustomMusicFromSettings = function() {
  var url = document.getElementById('customMusicUrl');
  var fileInput = document.getElementById('customMusicFile');
  var playerDiv = document.getElementById('customMusicPlayer');
  if (!playerDiv) return;
  playerDiv.innerHTML = '';
  var urlVal = url && url.value ? url.value.trim() : '';
  if (urlVal) {
    if (urlVal.includes('youtube.com') || urlVal.includes('youtu.be')) {
      var videoId = '';
      var ytMatch = urlVal.match(/(?:youtube\.com.*[?&]v=|youtu\.be\/)([\w-]+)/);
      if (ytMatch) videoId = ytMatch[1];
      if (videoId) {
        playerDiv.innerHTML = '<iframe width="100%" height="200" src="https://www.youtube.com/embed/' + videoId + '?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
        return;
      }
    } else if (urlVal.includes('spotify.com')) {
      var spMatch = urlVal.match(/spotify\.com\/(track|album|playlist)\/([\w]+)/);
      if (spMatch) {
        var type = spMatch[1], id = spMatch[2];
        playerDiv.innerHTML = '<iframe src="https://open.spotify.com/embed/' + type + '/' + id + '?utm_source=generator&autoplay=1" width="100%" height="80" frameborder="0" allowtransparency="true" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>';
        return;
      }
    } else if (urlVal.includes('music.apple.com')) {
      playerDiv.innerHTML = '<iframe allow="autoplay *; encrypted-media *;" frameborder="0" height="150" style="width:100%;max-width:660px;overflow:hidden;background:transparent;" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" src="' + urlVal.replace('music.apple.com', 'embed.music.apple.com') + '"></iframe>';
      return;
    } else if (urlVal.match(/\.(mp3|m4a|ogg|wav)$/i)) {
      playerDiv.innerHTML = '<audio controls autoplay style="width:100%"><source src="' + urlVal + '"></audio>';
      return;
    }
    playerDiv.innerHTML = '<div style="color:var(--red);font-size:.9rem;">Unrecognized or unsupported link.</div>';
    return;
  }
  if (fileInput && fileInput.files && fileInput.files[0]) {
    var file = fileInput.files[0];
    var urlObj = URL.createObjectURL(file);
    playerDiv.innerHTML = '<audio controls autoplay style="width:100%"><source src="' + urlObj + '"></audio>';
    return;
  }
  playerDiv.innerHTML = '<div style="color:var(--red);font-size:.9rem;">Please provide a link or upload an MP3.</div>';
};
// settings-system.js — Game Settings & Game Modes (Solo/GM/Campaign)
// Manages audio volume, game mode selection, and mode-specific UI features
(function () {
  const SETTINGS_ID = "settingsPanel";
  const COLORBLIND_PREVIEW_MS = 10000;
  const TERRAIN_ASSET_STORAGE_KEY = 'beyond-light-terrain-assets-v1';
  const TERRAIN_ASSET_DB_NAME = 'beyond-light-terrain-assets-db';
  const TERRAIN_ASSET_DB_VERSION = 1;
  const TERRAIN_ASSET_DB_STORE = 'terrain_assets';
  const TERRAIN_ASSET_DB_RECORD_KEY = 'payload';
  const TERRAIN_ASSET_LOCAL_CACHE_MAX_BYTES = 350000;
  const TERRAIN_ASSET_CATALOG = {
    province: ['marsh', 'forest', 'valley', 'lake', 'mountain', 'desert', 'hills', 'meadow', 'heath', 'crags', 'bog', 'glades', 'snowfield', 'dead_forest', 'ash_wastes', 'frost_marsh', 'rift', 'stones', 'desert_mountain', 'farm', 'desert_farm', 'desert_cave', 'ravine', 'city', 'town', 'snowy_town', 'snowy_fields', 'snowy_forest', 'snowy_swamp', 'dwelling', 'temple', 'library', 'depths', 'ruins', 'holding', 'trade_route', 'gate', 'event', 'peril', 'seat', 'trade', 'monument', 'lostcity'],
    sea: ['sea', 'open_sea', 'island', 'harbor', 'reef', 'storm', 'trench', 'shoal', 'peril', 'island_meadow', 'island_bluffs', 'island_heath', 'island_canopy', 'island_grove', 'island_mosswood', 'island_jungle', 'island_mangrove', 'island_rainridge', 'island_dunes', 'island_saltflat', 'island_sunrock', 'island_crags', 'island_highland', 'island_peakline', 'island_marsh', 'island_bog', 'island_reedbank', 'island_tundra', 'island_frostmoor', 'island_icefield', 'island_snowpack', 'island_glacier', 'island_frostcliff', 'island_badlands', 'island_shatterplain', 'island_drygorge', 'island_shore', 'island_inland'],
    space: ['empty', 'nothing', 'star', 'hub', 'planet', 'world_that_was', 'peril', 'dead_moon', 'derelict_ship', 'mystery', 'facility', 'skirmish', 'encounter', 'location', 'radio_task', 'station', 'anomaly', 'rift', 'star_core', 'hub_dock', 'hub_perimeter', 'hub_array', 'planet_orbit', 'planet_shadow', 'planet_signal', 'world_that_was_orbit', 'hazard_field', 'magnetic_storm', 'radiation_swell', 'dead_moon_cratered', 'dead_moon_ash', 'dead_moon_shattered', 'derelict_hulk', 'derelict_drifter', 'derelict_convoy', 'mystery_echo', 'mystery_relay', 'mystery_lens', 'facility_station', 'facility_shipyard', 'facility_array', 'skirmish_debris', 'skirmish_ion', 'skirmish_burnout', 'encounter_lane', 'encounter_checkpoint', 'encounter_signal', 'location_relic', 'location_gate', 'location_beacon', 'empty_inner_dust', 'empty_inner_shards', 'empty_middle_ion', 'empty_middle_reef', 'empty_outer_dark', 'empty_outer_frost'],
    wtw: ['district', 'cyber_hub', 'green_house', 'industrial_sector', 'neon_city', 'outskirts', 'residential_blocks', 'the_undercity', 'the_wastes', 'the_ports', 'cyber_hub_core', 'cyber_hub_market', 'cyber_hub_datastack', 'green_house_canopy', 'green_house_plaza', 'green_house_wetbeds', 'industrial_foundry', 'industrial_rail', 'industrial_scrapyard', 'neon_city_arcade', 'neon_city_tower', 'neon_city_alley', 'outskirts_badlands', 'outskirts_relay', 'outskirts_quarry', 'residential_blocks_habstack', 'residential_blocks_courtyard', 'residential_blocks_ruin', 'the_undercity_tunnels', 'the_undercity_floodline', 'the_undercity_sump', 'the_wastes_ashfields', 'the_wastes_craters', 'the_wastes_stormplain', 'the_ports_drydock', 'the_ports_container_yard', 'the_ports_ferry_spine'],
    planet: ['wilderness', 'trade_route', 'merchant_colony', 'empty_colony', 'wayfarer', 'seat', 'dwelling', 'temple', 'ruins', 'monument', 'peril', 'gate', 'barrier', 'hazardous', 'convoluted', 'biome_exotic', 'biome_irradiated', 'biome_volcanic', 'inhabited', 'easy_going', 'barren', 'frozen', 'water', 'lush', 'exotic', 'urban_ruins', 'scorched', 'toxic']
  };
  let colorBlindPreviewTimer = null;
  let colorBlindPreviewActive = false;
  let colorBlindPreviewEndsAt = 0;
  let terrainAssetsByRegion = {};
  let terrainAssetDbPromise = null;

  function getAccessibilityI18n() {
    if (typeof window === 'undefined' || !window.accessibilityI18n) return null;
    return window.accessibilityI18n;
  }

  function tr(key, fallback, params) {
    var i18n = getAccessibilityI18n();
    if (!i18n || typeof i18n.t !== 'function') {
      if (!params || typeof params !== 'object') return fallback || key;
      return String(fallback || key).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_full, token) {
        return Object.prototype.hasOwnProperty.call(params, token) ? String(params[token]) : '';
      });
    }
    return i18n.t(key, fallback, params);
  }

  function getOnOffLabel(value) {
    return value ? tr('common.on', 'On') : tr('common.off', 'Off');
  }

  function normalizeTerrainAssetKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function getTerrainAssetRegionKey(region) {
    const key = normalizeTerrainAssetKey(region);
    if (key === 'galaxy') return 'space';
    if (key === 'worldthatwas') return 'wtw';
    if (key === 'world_that_was') return 'wtw';
    return Object.prototype.hasOwnProperty.call(TERRAIN_ASSET_CATALOG, key) ? key : 'province';
  }

  function normalizeTerrainAssetPayload(payload) {
    const src = payload && typeof payload === 'object' ? payload : {};
    const out = {};
    Object.keys(src).forEach((region) => {
      const rk = getTerrainAssetRegionKey(region);
      const bucket = src[region] && typeof src[region] === 'object' ? src[region] : {};
      if (!out[rk]) out[rk] = {};
      Object.keys(bucket).forEach((terrain) => {
        const tk = normalizeTerrainAssetKey(terrain);
        const val = String(bucket[terrain] || '');
        if (tk && val.indexOf('data:image/') === 0) {
          out[rk][tk] = val;
        }
      });
    });
    return out;
  }

  function loadTerrainAssets() {
    try {
      const raw = JSON.parse(localStorage.getItem(TERRAIN_ASSET_STORAGE_KEY) || '{}');
      terrainAssetsByRegion = normalizeTerrainAssetPayload(raw);
    } catch (_err) {
      terrainAssetsByRegion = {};
    }
    loadTerrainAssetsFromIndexedDb().then(function (dbPayload) {
      if (!dbPayload || typeof dbPayload !== 'object') return;
      var merged = normalizeTerrainAssetPayload(terrainAssetsByRegion);
      Object.keys(dbPayload).forEach(function (region) {
        if (!merged[region] || typeof merged[region] !== 'object') merged[region] = {};
        var bucket = dbPayload[region] && typeof dbPayload[region] === 'object' ? dbPayload[region] : {};
        Object.keys(bucket).forEach(function (terrain) {
          merged[region][terrain] = bucket[terrain];
        });
      });
      terrainAssetsByRegion = merged;
      rerenderTerrainAssetConsumers();
    }).catch(function (_err) {
      // Non-fatal: local cache and in-memory tiles remain usable.
    });
  }

  function persistTerrainAssets() {
    var payload = normalizeTerrainAssetPayload(terrainAssetsByRegion);
    var payloadJson = '{}';
    try {
      payloadJson = JSON.stringify(payload);
    } catch (_err) {
      payloadJson = '{}';
    }
    var hasIndexedDb = typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

    if (hasIndexedDb) {
      saveTerrainAssetsToIndexedDb(payload).catch(function (err) {
        console.warn('Could not save terrain assets to IndexedDB:', err);
      });
    }

    try {
      if (hasIndexedDb && payloadJson.length > TERRAIN_ASSET_LOCAL_CACHE_MAX_BYTES) {
        localStorage.setItem(TERRAIN_ASSET_STORAGE_KEY, JSON.stringify({
          indexedDbBacked: true,
          count: countTerrainAssets(payload),
          updatedAt: Date.now()
        }));
      } else {
        localStorage.setItem(TERRAIN_ASSET_STORAGE_KEY, payloadJson);
      }
    } catch (err) {
      if (!hasIndexedDb) {
        console.warn('Could not save terrain assets:', err);
        if (typeof showNotif === 'function') {
          showNotif('Terrain tile storage is full. Enable IndexedDB or clear a few tiles and retry.', 'warn');
        }
      }
    }
  }

  function countTerrainAssets(payload) {
    var src = payload && typeof payload === 'object' ? payload : {};
    var total = 0;
    Object.keys(src).forEach(function (region) {
      var bucket = src[region] && typeof src[region] === 'object' ? src[region] : {};
      total += Object.keys(bucket).length;
    });
    return total;
  }

  function openTerrainAssetDb() {
    if (terrainAssetDbPromise) return terrainAssetDbPromise;
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      terrainAssetDbPromise = Promise.resolve(null);
      return terrainAssetDbPromise;
    }
    terrainAssetDbPromise = new Promise(function (resolve) {
      try {
        var req = window.indexedDB.open(TERRAIN_ASSET_DB_NAME, TERRAIN_ASSET_DB_VERSION);
        req.onupgradeneeded = function (event) {
          var db = event.target.result;
          if (!db.objectStoreNames.contains(TERRAIN_ASSET_DB_STORE)) {
            db.createObjectStore(TERRAIN_ASSET_DB_STORE);
          }
        };
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      } catch (_err) {
        resolve(null);
      }
    });
    return terrainAssetDbPromise;
  }

  function loadTerrainAssetsFromIndexedDb() {
    return openTerrainAssetDb().then(function (db) {
      return new Promise(function (resolve) {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          var tx = db.transaction(TERRAIN_ASSET_DB_STORE, 'readonly');
          var store = tx.objectStore(TERRAIN_ASSET_DB_STORE);
          var req = store.get(TERRAIN_ASSET_DB_RECORD_KEY);
          req.onsuccess = function () {
            var payload = req.result && req.result.payload ? req.result.payload : req.result;
            resolve(normalizeTerrainAssetPayload(payload || {}));
          };
          req.onerror = function () { resolve(null); };
        } catch (_err) {
          resolve(null);
        }
      });
    });
  }

  function saveTerrainAssetsToIndexedDb(payload) {
    return openTerrainAssetDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        if (!db) {
          resolve(false);
          return;
        }
        try {
          var tx = db.transaction(TERRAIN_ASSET_DB_STORE, 'readwrite');
          var store = tx.objectStore(TERRAIN_ASSET_DB_STORE);
          var req = store.put({ payload: normalizeTerrainAssetPayload(payload || {}), updatedAt: Date.now() }, TERRAIN_ASSET_DB_RECORD_KEY);
          req.onsuccess = function () { resolve(true); };
          req.onerror = function () { reject(req.error || new Error('IndexedDB write failed')); };
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  function rerenderTerrainAssetConsumers() {
    try {
      if (typeof renderHexMap === 'function') renderHexMap();
      if (typeof renderHexInfo === 'function' && typeof selectedHex !== 'undefined' && selectedHex) renderHexInfo(selectedHex);
      if (typeof renderLastSeaMap === 'function') renderLastSeaMap();
      if (typeof renderLastSeaInfo === 'function') renderLastSeaInfo();
      if (typeof renderStarSystemMap === 'function') renderStarSystemMap();
      if (typeof renderPlanetExplorationPanel === 'function') renderPlanetExplorationPanel();
      if (typeof renderWorldThatWasMap === 'function') renderWorldThatWasMap();
    } catch (_err) {
      // Rendering refresh is best-effort.
    }
  }

  function getTerrainTileAsset(region, terrainKey) {
    const rk = getTerrainAssetRegionKey(region);
    const tk = normalizeTerrainAssetKey(terrainKey);
    if (!tk) return '';
    const bucket = terrainAssetsByRegion[rk] && typeof terrainAssetsByRegion[rk] === 'object' ? terrainAssetsByRegion[rk] : {};
    return typeof bucket[tk] === 'string' ? bucket[tk] : '';
  }

  function setTerrainTileAsset(region, terrainKey, dataUrl) {
    const rk = getTerrainAssetRegionKey(region);
    const tk = normalizeTerrainAssetKey(terrainKey);
    const val = String(dataUrl || '');
    if (!tk || val.indexOf('data:image/') !== 0) return false;
    if (!terrainAssetsByRegion[rk] || typeof terrainAssetsByRegion[rk] !== 'object') terrainAssetsByRegion[rk] = {};
    terrainAssetsByRegion[rk][tk] = val;
    persistTerrainAssets();
    window.dispatchEvent(new CustomEvent('beyond:terrain-assets-changed', { detail: { region: rk, key: tk } }));
    return true;
  }

  function clearTerrainTileAsset(region, terrainKey) {
    const rk = getTerrainAssetRegionKey(region);
    const tk = normalizeTerrainAssetKey(terrainKey);
    if (!tk || !terrainAssetsByRegion[rk] || typeof terrainAssetsByRegion[rk] !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(terrainAssetsByRegion[rk], tk)) return false;
    delete terrainAssetsByRegion[rk][tk];
    persistTerrainAssets();
    window.dispatchEvent(new CustomEvent('beyond:terrain-assets-changed', { detail: { region: rk, key: tk } }));
    return true;
  }
  
  const Settings = {
    // Audio settings
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.6,
    musicConsent: false,
    
    // Game mode
    gameMode: 'solo', // 'solo' | 'gm' | 'campaign'
    gmRevealDC: true,
    gmRevealHiddenInfo: true,
    manualRollMode: false,
    tableSceneFocusLock: false,
    tableSceneLockedMode: 'exploration',
    colorBlindMode: false,
    monochromeMode: false,
    phoneLayoutMode: false,
    textSize: 'medium',
    terrainAssetRegion: 'province',
    activeTab: 'general',
    nightModeRates: {
      seaOpen: 42,
      seaIsland: 32,
      planetTrade: 34,
      planetHex: 28,
      wtw: 38
    },
    
    // Load from localStorage
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem('beyond-light-settings') || '{}');
        this.masterVolume = saved.masterVolume !== undefined ? saved.masterVolume : 0.7;
        this.musicVolume = saved.musicVolume !== undefined ? saved.musicVolume : 0.5;
        this.sfxVolume = saved.sfxVolume !== undefined ? saved.sfxVolume : 0.6;
        this.musicConsent = saved.musicConsent !== undefined ? !!saved.musicConsent : false;
        this.gameMode = 'solo'; // always default to Solo on load — not persisted
        this.gmRevealDC = saved.gmRevealDC !== undefined ? !!saved.gmRevealDC : true;
        this.gmRevealHiddenInfo = saved.gmRevealHiddenInfo !== undefined ? !!saved.gmRevealHiddenInfo : true;
        this.manualRollMode = saved.manualRollMode !== undefined ? !!saved.manualRollMode : false;
        this.tableSceneFocusLock = saved.tableSceneFocusLock !== undefined ? !!saved.tableSceneFocusLock : false;
        this.tableSceneLockedMode = ['narrative', 'exploration', 'combat'].indexOf(String(saved.tableSceneLockedMode || 'exploration').toLowerCase()) >= 0
          ? String(saved.tableSceneLockedMode || 'exploration').toLowerCase()
          : 'exploration';
        this.colorBlindMode = saved.colorBlindMode !== undefined ? !!saved.colorBlindMode : false;
        this.monochromeMode = saved.monochromeMode !== undefined ? !!saved.monochromeMode : false;
        this.phoneLayoutMode = saved.phoneLayoutMode !== undefined ? !!saved.phoneLayoutMode : false;
        this.textSize = saved.textSize || 'medium';
        this.terrainAssetRegion = getTerrainAssetRegionKey(saved.terrainAssetRegion || 'province');
        const defaults = { seaOpen: 42, seaIsland: 32, planetTrade: 34, planetHex: 28, wtw: 38 };
        const loadedRates = saved.nightModeRates && typeof saved.nightModeRates === 'object' ? saved.nightModeRates : {};
        this.nightModeRates = {
          seaOpen: Number(loadedRates.seaOpen),
          seaIsland: Number(loadedRates.seaIsland),
          planetTrade: Number(loadedRates.planetTrade),
          planetHex: Number(loadedRates.planetHex),
          wtw: Number(loadedRates.wtw)
        };
        Object.keys(defaults).forEach((k) => {
          const v = this.nightModeRates[k];
          this.nightModeRates[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : defaults[k];
        });
        this.applyAudioSettings();
        this.applyAccessibilitySettings();
      } catch (e) {
        console.warn('Could not load settings:', e);
      }
    },
    
    // Save to localStorage
    save() {
      try {
        localStorage.setItem('beyond-light-settings', JSON.stringify({
          masterVolume: this.masterVolume,
          musicVolume: this.musicVolume,
          sfxVolume: this.sfxVolume,
          musicConsent: this.musicConsent,
          gmRevealDC: this.gmRevealDC,
          gmRevealHiddenInfo: this.gmRevealHiddenInfo,
          manualRollMode: this.manualRollMode,
          tableSceneFocusLock: this.tableSceneFocusLock,
          tableSceneLockedMode: this.tableSceneLockedMode,
          colorBlindMode: this.colorBlindMode,
          monochromeMode: this.monochromeMode,
          phoneLayoutMode: this.phoneLayoutMode,
          textSize: this.textSize,
          terrainAssetRegion: this.terrainAssetRegion,
          nightModeRates: this.nightModeRates
        }));
      } catch (e) {
        console.warn('Could not save settings:', e);
      }
    },
    
    // Apply audio settings to audio manager
    applyAudioSettings() {
      if (typeof AudioManager !== 'undefined') {
        AudioManager.masterVolume = this.masterVolume;
        AudioManager.musicVolume = this.musicVolume;
        AudioManager.sfxVolume = this.sfxVolume;
        if (typeof AudioManager.setMusicConsent === 'function') {
          AudioManager.setMusicConsent(this.musicConsent);
        }
      }
    },
    
    // Set game mode
    setGameMode(mode, opts) {
      const options = opts || {};
      if (mode === 'solo' || mode === 'gm' || mode === 'campaign') {
        const campaignApi = window.campaignSystem;
        const campaignState = (campaignApi && typeof campaignApi.getState === 'function')
          ? (campaignApi.getState() || {})
          : {};
        const hasLiveCampaign = !!campaignState.code;
        if (mode === 'solo' && hasLiveCampaign && !options.silent && typeof campaignApi.leaveCampaign === 'function') {
          if (typeof showNotif === 'function') {
            showNotif('Leaving the live campaign and returning to Solo Mode...', 'info');
          }
          campaignApi.leaveCampaign();
          return;
        }
        if (this.gameMode === mode) {
          this.applyGameMode();
          syncGameModeUI();
          return;
        }
        this.gameMode = mode;
        this.save();
        this.applyGameMode();
        syncGameModeUI();
        if (!options.silent && typeof showNotif === 'function') {
          const label = mode === 'gm' ? 'GM Mode' : (mode === 'campaign' ? 'Campaign Mode' : 'Solo Mode');
          showNotif(`Switched to ${label}`, 'good');
        }
      }
    },
    
    // Apply game mode settings
    applyGameMode() {
      const body = document.body;
      if (this.gameMode === 'gm') {
        body.classList.add('gm-mode');
        body.classList.remove('solo-mode');
        body.classList.remove('campaign-mode');
      } else if (this.gameMode === 'campaign') {
        body.classList.add('campaign-mode');
        body.classList.remove('solo-mode');
        body.classList.remove('gm-mode');
      } else {
        body.classList.add('solo-mode');
        body.classList.remove('gm-mode');
        body.classList.remove('campaign-mode');
      }
    },
    
    // Check if we're in GM mode
    isGMMode() {
      return this.gameMode === 'gm';
    },

    shouldRevealDC() {
      return !this.isGMMode() || !!this.gmRevealDC;
    },

    shouldRevealHiddenInfo() {
      return !this.isGMMode() || !!this.gmRevealHiddenInfo;
    },

    getTableSceneFocusState() {
      return {
        locked: !!this.tableSceneFocusLock,
        mode: String(this.tableSceneLockedMode || 'exploration')
      };
    },

    setTableSceneLockedMode(mode, opts) {
      const options = opts || {};
      const key = String(mode || '').toLowerCase();
      if (['narrative', 'exploration', 'combat'].indexOf(key) === -1) return;
      this.tableSceneLockedMode = key;
      if (this.tableSceneFocusLock) {
        this.save();
        syncTableSceneFocusUI();
        if (window.campaignSystem && typeof window.campaignSystem.refreshSceneFocusState === 'function') {
          window.campaignSystem.refreshSceneFocusState();
        }
        if (!options.silent && typeof showNotif === 'function') {
          showNotif(`Focus Lock pinned to ${key}.`, 'good');
        }
      }
    },

    setTableSceneFocusLock(enabled, opts) {
      const options = opts || {};
      const next = !!enabled;
      if (next && ['narrative', 'exploration', 'combat'].indexOf(String(this.tableSceneLockedMode || '').toLowerCase()) === -1) {
        const bodyMode = document.body ? String(document.body.getAttribute('data-table-scene') || '') : '';
        const fallback = ['narrative', 'exploration', 'combat'].indexOf(bodyMode) >= 0 ? bodyMode : 'exploration';
        this.tableSceneLockedMode = fallback;
      }
      this.tableSceneFocusLock = next;
      if (options.mode && ['narrative', 'exploration', 'combat'].indexOf(String(options.mode).toLowerCase()) >= 0) {
        this.tableSceneLockedMode = String(options.mode).toLowerCase();
      }
      this.save();
      syncTableSceneFocusUI();
      if (typeof window.campaignSystem !== 'undefined' && window.campaignSystem && typeof window.campaignSystem.refreshSceneFocusState === 'function') {
        window.campaignSystem.refreshSceneFocusState();
      }
      if (!options.silent && typeof showNotif === 'function') {
        showNotif(this.tableSceneFocusLock
          ? `Focus Lock enabled (${this.tableSceneLockedMode}).`
          : 'Focus Lock disabled.',
          'good');
      }
    },

    applyAccessibilitySettings() {
      const body = document.body;
      if (!body) return;
      body.classList.toggle('colorblind-mode', !!this.colorBlindMode);
      body.classList.toggle('lowcolor-mode', !!this.monochromeMode);
      body.classList.toggle('phone-layout-mode', !!this.phoneLayoutMode);
      this.applyTextSize();
    },

    applyTextSize() {
      const sizes = { small: '14px', medium: '17px', large: '18px' };
      document.documentElement.style.fontSize = sizes[this.textSize] || '17px';
      ['text-size-small', 'text-size-medium', 'text-size-large'].forEach(cls => document.body.classList.remove(cls));
      document.body.classList.add('text-size-' + (this.textSize || 'medium'));
    }
  };

  function getModeQuickStartHtml() {
    if (Settings.gameMode === 'gm') {
      return ''
        + '<div class="mode-guidance-title">GM Flow</div>'
        + '<ol class="mode-guidance-list">'
        + '<li>Generate map layers and mission seeds, then open GM Dashboard for pacing tools.</li>'
        + '<li>Keep tension readable with Dread controls and Force Outcome only when pacing stalls.</li>'
        + '<li>Use Campaign tab to synchronize state and keep players on one shared timeline.</li>'
        + '</ol>';
    }
    if (Settings.gameMode === 'campaign') {
      return ''
        + '<div class="mode-guidance-title">Campaign Flow</div>'
        + '<ol class="mode-guidance-list">'
        + '<li>Open the Campaign tab to create or join a room before long sessions.</li>'
        + '<li>Confirm role, code, and sync status, then use Show Onboarding for team quickstart.</li>'
        + '<li>Use the Campaign dock for live rolls, chat, and timeline awareness during play.</li>'
        + '</ol>';
    }
    return ''
      + '<div class="mode-guidance-title">Solo Flow</div>'
      + '<ol class="mode-guidance-list">'
      + '<li>Pick a travel layer, then alternate Observe Adjacent, missions, and downtime choices.</li>'
      + '<li>Track progression through Missions, Factions, and Endings as your core loop.</li>'
      + '<li>Use Solo Reference anytime for quick reminders without breaking narrative momentum.</li>'
      + '</ol>';
  }

  function getAccessibilityLanguageOptionsHtml() {
    var i18n = getAccessibilityI18n();
    var current = i18n && typeof i18n.getLanguage === 'function' ? i18n.getLanguage() : 'en';
    var options = i18n && typeof i18n.getSupportedLanguages === 'function'
      ? i18n.getSupportedLanguages()
      : [{ code: 'en', label: 'English' }];
    return options.map(function (opt) {
      var code = String(opt && opt.code ? opt.code : 'en');
      var label = String(opt && opt.label ? opt.label : code.toUpperCase());
      var selected = code === current ? ' selected' : '';
      return '<option value="' + code + '"' + selected + '>' + label + '</option>';
    }).join('');
  }

  function setAccessibilityLanguage(lang) {
    var i18n = getAccessibilityI18n();
    if (!i18n || typeof i18n.setLanguage !== 'function') return;
    i18n.setLanguage(lang);
    var activePanel = document.querySelector('.tab-panel.active');
    if (activePanel && typeof i18n.translatePage === 'function') {
      i18n.translatePage(activePanel);
    }
    var settingsRoot = document.querySelector('#settingsPanel .settings-popup');
    if (settingsRoot && typeof i18n.translatePage === 'function') {
      i18n.translatePage(settingsRoot);
    }
    if (typeof i18n.schedulePageTranslation === 'function') {
      i18n.schedulePageTranslation(activePanel || null);
    }
    createSettingsPanel();
    syncGameModeUI();
    applySettingsTabVisibility();
  }
  
  function createSettingsPanel() {
    const container = document.getElementById(SETTINGS_ID);
    if (!container) return;
    
    container.innerHTML = `
      <div class="settings-popup">
        <div class="settings-header">
          <h3>Settings</h3>
          <button class="btn btn-icon btn-sm" onclick="window.settingsSystem.closeSettings()">✕</button>
        </div>

        <div class="settings-tabs" role="group" aria-label="Settings sections">
          <button id="settingsTab-general" class="settings-tab-btn active" onclick="window.settingsSystem.setActiveTab('general')" aria-controls="settingsTabPanel-general" aria-current="page">General</button>
          <button id="settingsTab-audio" class="settings-tab-btn" onclick="window.settingsSystem.setActiveTab('audio')" aria-controls="settingsTabPanel-audio">Audio</button>
          <button id="settingsTab-accessibility" class="settings-tab-btn" onclick="window.settingsSystem.setActiveTab('accessibility')" aria-controls="settingsTabPanel-accessibility">${tr('settings.accessibility.title', 'Accessibility')}</button>
          <button id="settingsTab-recovery" class="settings-tab-btn" onclick="window.settingsSystem.setActiveTab('recovery')" aria-controls="settingsTabPanel-recovery">Recovery</button>
          <button id="settingsTab-campaign" class="settings-tab-btn" onclick="window.settingsSystem.setActiveTab('campaign')" aria-controls="settingsTabPanel-campaign">Campaign</button>
        </div>

        <div id="settingsTabPanel-general" class="settings-tab-panel active" data-settings-tab="general" tabindex="0" aria-hidden="false">
          <div class="settings-section">
            <h4>Game Mode</h4>
            <div class="mode-current">
              Current Mode: <span id="currentModeLabel">${Settings.gameMode === 'gm' ? 'GM' : (Settings.gameMode === 'campaign' ? 'Campaign' : 'Solo')}</span>
            </div>
            <div class="setting-row mode-selector">
              <button class="mode-btn ${Settings.gameMode === 'solo' ? 'active' : ''}"
                onclick="window.settingsSystem.setGameMode('solo')">
                <span class="mode-icon">🎮</span>
                <span class="mode-name">Solo</span>
                <span class="mode-desc">Play as a character</span>
              </button>
              <button class="mode-btn ${Settings.gameMode === 'gm' ? 'active' : ''}"
                onclick="window.settingsSystem.setGameMode('gm')">
                <span class="mode-icon">👥</span>
                <span class="mode-name">GM</span>
                <span class="mode-desc">Orchestrate the story</span>
              </button>
              <button class="mode-btn ${Settings.gameMode === 'campaign' ? 'active' : ''}"
                onclick="window.settingsSystem.setGameMode('campaign')">
                <span class="mode-icon">🛰</span>
                <span class="mode-name">Campaign</span>
                <span class="mode-desc">Shared multiplayer world</span>
              </button>
            </div>

            <div id="modeQuickStart" class="mode-guidance">${getModeQuickStartHtml()}</div>

            <div id="gmToolsRow" style="margin-top:.55rem;display:${Settings.gameMode === 'gm' ? 'block' : 'none'};">
              <div style="font-family:'Cinzel',serif;font-size:.56rem;letter-spacing:.1em;color:var(--muted2);text-transform:uppercase;margin-bottom:.28rem;">GM Visibility</div>
              <div style="display:flex;gap:.3rem;flex-wrap:wrap;">
                <button id="gmRevealDCBtn" class="btn btn-xs" onclick="window.settingsSystem.toggleGMReveal('dc')">Reveal DC: ${Settings.gmRevealDC ? 'On' : 'Off'}</button>
                <button id="gmRevealHiddenBtn" class="btn btn-xs" onclick="window.settingsSystem.toggleGMReveal('hidden')">Reveal Hidden Info: ${Settings.gmRevealHiddenInfo ? 'On' : 'Off'}</button>
                <button class="btn btn-xs" onclick="if(typeof switchTab==='function'){switchTab('gmworldbuilder',document.getElementById('tabnav-gmworldbuilder'));}">GM Forge</button>
                <button class="btn btn-xs" onclick="if(typeof openGMStoryComposer==='function'){openGMStoryComposer();}">Story Composer</button>
                <button class="btn btn-xs" onclick="if(typeof openGMHexMarkerEditor==='function'){openGMHexMarkerEditor();}">Hex Marker</button>
                <button class="btn btn-xs" onclick="if(typeof openGMDreadDirector==='function'){openGMDreadDirector();}">Dread Director</button>
              </div>
            </div>

            <div style="margin-top:.6rem;display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;">
              <button id="manualRollModeBtn" class="btn btn-xs" onclick="window.settingsSystem.toggleManualRollMode()">Manual Roll Mode: ${Settings.manualRollMode ? 'On' : 'Off'}</button>
              <span class="campaign-muted">When enabled, all roll calls prompt for your physical dice result entry (d4, d6, d8, d10, d12, d20).</span>
            </div>

            <div style="margin-top:.65rem;border-top:1px solid var(--border2);padding-top:.55rem;">
              <div style="font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:.1em;color:var(--gold2);text-transform:uppercase;margin-bottom:.3rem;">Night Mode Encounter Rates</div>
              <div class="campaign-muted" style="margin-bottom:.35rem;">Tune bonus trigger chance per map without editing code.</div>
              <div style="display:grid;grid-template-columns:1fr;gap:.35rem;">
                <div class="setting-row" style="margin-bottom:0;">
                  <label for="nightRateSeaOpen">Sea Region · Open Water</label>
                  <div class="volume-control">
                    <input type="range" id="nightRateSeaOpen" min="0" max="100" value="${Settings.nightModeRates.seaOpen}" onchange="window.settingsSystem.setNightModeRate('seaOpen', this.value)" class="volume-slider">
                    <span id="nightRateSeaOpenLabel">${Settings.nightModeRates.seaOpen}%</span>
                  </div>
                </div>
                <div class="setting-row" style="margin-bottom:0;">
                  <label for="nightRateSeaIsland">Sea Region · Islands</label>
                  <div class="volume-control">
                    <input type="range" id="nightRateSeaIsland" min="0" max="100" value="${Settings.nightModeRates.seaIsland}" onchange="window.settingsSystem.setNightModeRate('seaIsland', this.value)" class="volume-slider">
                    <span id="nightRateSeaIslandLabel">${Settings.nightModeRates.seaIsland}%</span>
                  </div>
                </div>
                <div class="setting-row" style="margin-bottom:0;">
                  <label for="nightRatePlanetTrade">Planet · Trade Route</label>
                  <div class="volume-control">
                    <input type="range" id="nightRatePlanetTrade" min="0" max="100" value="${Settings.nightModeRates.planetTrade}" onchange="window.settingsSystem.setNightModeRate('planetTrade', this.value)" class="volume-slider">
                    <span id="nightRatePlanetTradeLabel">${Settings.nightModeRates.planetTrade}%</span>
                  </div>
                </div>
                <div class="setting-row" style="margin-bottom:0;">
                  <label for="nightRatePlanetHex">Planet · Hex Encounter</label>
                  <div class="volume-control">
                    <input type="range" id="nightRatePlanetHex" min="0" max="100" value="${Settings.nightModeRates.planetHex}" onchange="window.settingsSystem.setNightModeRate('planetHex', this.value)" class="volume-slider">
                    <span id="nightRatePlanetHexLabel">${Settings.nightModeRates.planetHex}%</span>
                  </div>
                </div>
                <div class="setting-row" style="margin-bottom:0;">
                  <label for="nightRateWtw">World That Was · District</label>
                  <div class="volume-control">
                    <input type="range" id="nightRateWtw" min="0" max="100" value="${Settings.nightModeRates.wtw}" onchange="window.settingsSystem.setNightModeRate('wtw', this.value)" class="volume-slider">
                    <span id="nightRateWtwLabel">${Settings.nightModeRates.wtw}%</span>
                  </div>
                </div>
              </div>
              <div style="margin-top:.4rem;display:flex;gap:.3rem;flex-wrap:wrap;">
                <button class="btn btn-xs" onclick="window.settingsSystem.resetNightModeRates()">Reset Defaults</button>
              </div>
            </div>
          </div>
        </div>
        
        <div id="settingsTabPanel-audio" class="settings-tab-panel" data-settings-tab="audio" tabindex="-1" aria-hidden="true">
          <div class="settings-section">
            <h4>Audio</h4>
            <div class="setting-row">
              <label>Custom Music</label>
              <div style="display:flex;flex-direction:column;gap:.3rem;min-width:0;width:100%;">
                <input type="text" id="customMusicUrl" placeholder="Paste YouTube, Spotify, Apple Music link, or direct MP3…" style="width:100%;max-width:420px;">
                <input type="file" id="customMusicFile" accept="audio/mp3,audio/mpeg" style="max-width:420px;">
                <div style="display:flex;gap:.5rem;justify-content:flex-end;">
                  <button class="btn btn-primary btn-xs" onclick="window.playCustomMusicFromSettings()">Play</button>
                </div>
                <div id="customMusicPlayer" style="margin-top:.7rem;"></div>
              </div>
            </div>
            <div class="setting-row">
              <label>Background Music</label>
              <div class="campaign-actions" style="margin:0;">
                <button id="musicConsentBtn" class="btn btn-xs" onclick="window.settingsSystem.toggleMusicConsent()">
                  ${Settings.musicConsent ? 'On' : 'Off'}
                </button>
                <span class="campaign-muted">Music stays off by default until you enable it.</span>
              </div>
            </div>
            <div class="setting-row">
              <label for="masterVol">Master Volume</label>
              <div class="volume-control">
                <input type="range" id="masterVol" min="0" max="100" value="${Settings.masterVolume * 100}" 
                  onchange="window.settingsSystem.setMasterVolume(this.value)" class="volume-slider">
                <span id="masterVolLabel">${Math.round(Settings.masterVolume * 100)}%</span>
              </div>
            </div>
            <div class="setting-row">
              <label for="musicVol">Music Volume</label>
              <div class="volume-control">
                <input type="range" id="musicVol" min="0" max="100" value="${Settings.musicVolume * 100}" 
                  onchange="window.settingsSystem.setMusicVolume(this.value)" class="volume-slider">
                <span id="musicVolLabel">${Math.round(Settings.musicVolume * 100)}%</span>
              </div>
            </div>
            <div class="setting-row">
              <label>Now Playing</label>
              <div id="settingsNowPlaying" class="campaign-muted">No track active</div>
            </div>
            <div class="setting-row" style="align-items:flex-start;">
              <label>Audio Credits</label>
              <div style="display:flex;flex-direction:column;gap:.25rem;min-width:0;">
                <div class="campaign-muted" style="font-size:.72rem;">Auto-generated from the active audio manifest.</div>
                <div id="settingsAudioCredits" class="campaign-muted" style="max-height:10.5rem;overflow:auto;border:1px solid var(--border2);background:var(--surface);padding:.45rem .5rem;min-width:16rem;">
                  No external tracks loaded.
                </div>
              </div>
            </div>
            <div class="setting-row">
              <label for="sfxVol">SFX Volume</label>
              <div class="volume-control">
                <input type="range" id="sfxVol" min="0" max="100" value="${Settings.sfxVolume * 100}" 
                  onchange="window.settingsSystem.setSFXVolume(this.value)" class="volume-slider">
                <span id="sfxVolLabel">${Math.round(Settings.sfxVolume * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div id="settingsTabPanel-accessibility" class="settings-tab-panel" data-settings-tab="accessibility" tabindex="-1" aria-hidden="true">
          <div class="settings-section">
            <h4>${tr('settings.accessibility.title', 'Accessibility')}</h4>
            <div class="setting-row">
              <label for="accessibilityLanguageSelect">${tr('settings.accessibility.language.label', 'Language')}</label>
              <div class="campaign-actions" style="margin:0;">
                <select id="accessibilityLanguageSelect" class="campaign-input" onchange="window.settingsSystem.setAccessibilityLanguage(this.value)" aria-label="${tr('settings.accessibility.language.aria', 'Accessibility language')}">
                  ${getAccessibilityLanguageOptionsHtml()}
                </select>
                <span class="campaign-muted">${tr('settings.accessibility.language.helper', 'Choose a language for accessibility labels and guidance.')}</span>
              </div>
            </div>
            <div class="setting-row">
              <label>${tr('settings.accessibility.palette.label', 'Color Blind Friendly Palette')}</label>
              <div class="campaign-actions" style="margin:0;">
                <button id="colorBlindModeBtn" class="btn btn-xs" onclick="window.settingsSystem.toggleColorBlindMode()">
                  ${Settings.colorBlindMode ? tr('common.on', 'On') : tr('common.off', 'Off')}
                </button>
                <button id="colorBlindPreviewBtn" class="btn btn-xs" onclick="window.settingsSystem.previewColorBlindMode()">
                  ${tr('settings.accessibility.palette.preview', 'Preview 10s')}
                </button>
                <span class="campaign-muted">${tr('settings.accessibility.palette.help', 'Uses higher-contrast, color-blind-safe accents.')}</span>
              </div>
              <div id="colorBlindPreviewStatus" class="campaign-muted" style="margin-top:.25rem;"></div>
            </div>
            <div class="setting-row">
              <label>${tr('settings.accessibility.monochrome.label', 'All-Color Difficulty Mode')}</label>
              <div class="campaign-actions" style="margin:0;">
                <button id="monochromeModeBtn" class="btn btn-xs" onclick="window.settingsSystem.toggleMonochromeMode()">
                  ${Settings.monochromeMode ? tr('common.on', 'On') : tr('common.off', 'Off')}
                </button>
                <span class="campaign-muted">${tr('settings.accessibility.monochrome.help', 'Forces a strict black-and-white palette with shape/text cues (no color reliance).')}</span>
              </div>
            </div>
            <div class="setting-row">
              <label>${tr('settings.accessibility.phoneLayout.label', 'Phone Layout')}</label>
              <div class="campaign-actions" style="margin:0;">
                <button id="phoneLayoutModeBtn" class="btn btn-xs" onclick="window.settingsSystem.togglePhoneLayoutMode()">
                  ${Settings.phoneLayoutMode ? tr('common.on', 'On') : tr('common.off', 'Off')}
                </button>
                <span class="campaign-muted">${tr('settings.accessibility.phoneLayout.help', 'Reflows navigation, settings, and campaign tools into a tighter single-column phone layout.')}</span>
              </div>
            </div>
            <div class="setting-row">
              <label>${tr('settings.accessibility.textSize.label', 'Text Size')}</label>
              <div class="campaign-actions" style="margin:0;">
                <button id="textSizeSmBtn" class="btn btn-xs ${Settings.textSize === 'small' ? 'active' : ''}" onclick="window.settingsSystem.setTextSize('small')">${tr('settings.accessibility.textSize.small', 'Small')}</button>
                <button id="textSizeMdBtn" class="btn btn-xs ${Settings.textSize === 'medium' ? 'active' : ''}" onclick="window.settingsSystem.setTextSize('medium')">${tr('settings.accessibility.textSize.medium', 'Medium')}</button>
                <button id="textSizeLgBtn" class="btn btn-xs ${Settings.textSize === 'large' ? 'active' : ''}" onclick="window.settingsSystem.setTextSize('large')">${tr('settings.accessibility.textSize.large', 'Large')}</button>
                <span class="campaign-muted">${tr('settings.accessibility.textSize.help', 'Scales all text across the app.')}</span>
              </div>
            </div>
            <div class="setting-row" style="align-items:flex-start;">
              <label>Visual Terrain Tiles</label>
              <div class="campaign-muted" style="font-size:.72rem;line-height:1.5;">Attach per-terrain art tiles for Province, Sea, Space, World That Was, and Planet maps. Uploads are stored locally in this browser.</div>
              <div class="settings-terrain-tools" style="margin-top:.3rem;">
                <select id="settingsTerrainRegionSel" class="campaign-input" onchange="window.settingsSystem.setTerrainAssetRegion(this.value)">
                  <option value="province" ${Settings.terrainAssetRegion === 'province' ? 'selected' : ''}>Province</option>
                  <option value="sea" ${Settings.terrainAssetRegion === 'sea' ? 'selected' : ''}>Sea</option>
                  <option value="space" ${Settings.terrainAssetRegion === 'space' ? 'selected' : ''}>Space</option>
                  <option value="wtw" ${Settings.terrainAssetRegion === 'wtw' ? 'selected' : ''}>World That Was</option>
                  <option value="planet" ${Settings.terrainAssetRegion === 'planet' ? 'selected' : ''}>Planet</option>
                </select>
                <button class="btn btn-xs" onclick="window.settingsSystem.clearTerrainAssetRegion()">Clear Region</button>
              </div>
              <div id="settingsTerrainAssetRows" class="settings-terrain-rows"></div>
            </div>
          </div>
        </div>

        <div id="settingsTabPanel-recovery" class="settings-tab-panel" data-settings-tab="recovery" tabindex="-1" aria-hidden="true">
          <div class="settings-section">
            <h4>Solo Recovery</h4>
            <div class="campaign-muted" style="margin-bottom:.45rem;">Discoverability shortcut for save/load safety tools.</div>
            <div id="settingsRecoverySummary" class="settings-recovery-summary">Loading recovery status…</div>
            <div class="settings-recovery-actions">
              <button class="btn btn-xs btn-teal" onclick="if(typeof loadCharacter==='function'){loadCharacter();} window.settingsSystem.refreshRecoveryPanel();">Load Best</button>
              <button class="btn btn-xs" onclick="if(typeof saveCharacter==='function'){saveCharacter();} window.settingsSystem.refreshRecoveryPanel();">Save + Checkpoint</button>
              <button class="btn btn-xs" onclick="if(typeof loadCharacterCheckpoint==='function'){loadCharacterCheckpoint();} window.settingsSystem.refreshRecoveryPanel();">Restore Latest Checkpoint</button>
              <button class="btn btn-xs" onclick="if(typeof restoreBackupAsPrimary==='function'){restoreBackupAsPrimary();} window.settingsSystem.refreshRecoveryPanel();">Promote Backup</button>
              <button class="btn btn-xs" onclick="if(typeof exportCharacterSave==='function'){exportCharacterSave();}">Export Save</button>
              <button class="btn btn-xs" onclick="if(typeof importCharacterSavePrompt==='function'){importCharacterSavePrompt();}">Import Save</button>
              <button class="btn btn-xs" onclick="if(typeof openSoloRecoveryCenter==='function'){openSoloRecoveryCenter();}">Open Recovery Center</button>
              <button class="btn btn-xs" onclick="if(typeof verifySoloSaveHealth==='function'){verifySoloSaveHealth();}">Run Save Health</button>
            </div>
          </div>
        </div>

        <div id="settingsTabPanel-campaign" class="settings-tab-panel" data-settings-tab="campaign" tabindex="-1" aria-hidden="true">
          <div class="settings-section">
            <h4>Campaign</h4>
            <div class="setting-row" style="margin-bottom:.4rem;align-items:flex-start;">
              <label>Focus Lock</label>
              <div style="display:flex;flex-direction:column;gap:.25rem;min-width:0;width:100%;">
                <div class="campaign-actions" style="margin:0;align-items:center;">
                  <button id="tableSceneFocusLockBtn" class="btn btn-xs" onclick="window.settingsSystem.toggleTableSceneFocusLock()">Focus Lock: ${Settings.tableSceneFocusLock ? 'On' : 'Off'}</button>
                  <span id="tableSceneFocusLockLabel" class="campaign-muted">${Settings.tableSceneFocusLock ? ('Pinned to ' + String(Settings.tableSceneLockedMode || 'exploration')) : 'Locks the current narrative/exploration/combat focus globally.'}</span>
                </div>
                <div class="campaign-muted" style="font-size:.72rem;">Use the dock scene buttons to change the pinned mode while lock is on.</div>
              </div>
            </div>
            <div class="campaign-muted">Campaign controls and multiplayer diagnostics live here.</div>
          </div>
        </div>
        
        <div class="settings-footer">
          <button class="btn btn-sm" onclick="window.settingsSystem.closeSettings()">Close</button>
        </div>
      </div>
    `;

    applySettingsTabVisibility();
    bindSettingsTabKeyboardNav();
  }

  function readRecoveryEnvelope(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && typeof parsed.data === 'object') {
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        return { data: parsed, savedAt: null, checksum: null, schema: 1 };
      }
      return null;
    } catch (_err) {
      return null;
    }
  }

  function formatRecoveryStamp(envelope) {
    if (!envelope || !envelope.savedAt) return '-';
    try {
      return new Date(envelope.savedAt).toLocaleString();
    } catch (_err) {
      return '-';
    }
  }

  function refreshRecoveryPanel() {
    const node = document.getElementById('settingsRecoverySummary');
    if (!node) return;

    const primary = readRecoveryEnvelope('beyond-light-character');
    const backup = readRecoveryEnvelope('beyond-light-character-backup');
    const cp1 = readRecoveryEnvelope('beyond-light-character-checkpoint-1') || readRecoveryEnvelope('beyond-light-character-checkpoint');
    const cp2 = readRecoveryEnvelope('beyond-light-character-checkpoint-2');
    const cp3 = readRecoveryEnvelope('beyond-light-character-checkpoint-3');

    node.innerHTML = ''
      + '<div class="settings-recovery-row"><strong>Primary</strong><span>' + (primary ? 'Ready' : 'Missing') + ' · ' + formatRecoveryStamp(primary) + '</span></div>'
      + '<div class="settings-recovery-row"><strong>Backup</strong><span>' + (backup ? 'Ready' : 'Missing') + ' · ' + formatRecoveryStamp(backup) + '</span></div>'
      + '<div class="settings-recovery-row"><strong>Checkpoint 1</strong><span>' + (cp1 ? 'Ready' : 'Empty') + ' · ' + formatRecoveryStamp(cp1) + '</span></div>'
      + '<div class="settings-recovery-row"><strong>Checkpoint 2</strong><span>' + (cp2 ? 'Ready' : 'Empty') + ' · ' + formatRecoveryStamp(cp2) + '</span></div>'
      + '<div class="settings-recovery-row"><strong>Checkpoint 3</strong><span>' + (cp3 ? 'Ready' : 'Empty') + ' · ' + formatRecoveryStamp(cp3) + '</span></div>';
  }

  function setActiveTab(tab) {
    const allowed = ['general', 'audio', 'accessibility', 'recovery', 'campaign'];
    if (allowed.indexOf(tab) === -1) return;
    Settings.activeTab = tab;
    applySettingsTabVisibility();
  }

  function applySettingsTabVisibility() {
    const active = Settings.activeTab || 'general';
    const tabs = document.querySelectorAll('#settingsPanel .settings-tab-btn');
    tabs.forEach((btn) => {
      const id = String(btn.id || '');
      const tabName = id.replace('settingsTab-', '');
      const isActive = tabName === active;
      btn.classList.toggle('active', tabName === active);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    const panels = document.querySelectorAll('#settingsPanel .settings-tab-panel');
    panels.forEach((panel) => {
      const tabName = String(panel.getAttribute('data-settings-tab') || '');
      const isActive = tabName === active;
      panel.classList.toggle('active', isActive);
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      panel.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    const campaignSection = document.getElementById('campaignSettingsSection');
    if (campaignSection) {
      campaignSection.setAttribute('data-settings-tab', 'campaign');
      campaignSection.style.display = active === 'campaign' ? '' : 'none';
    }
  }

  function bindSettingsTabKeyboardNav() {
    const tabList = document.querySelector('#settingsPanel .settings-tabs');
    if (!tabList) return;
    tabList.setAttribute('role', 'group');
    tabList.setAttribute('aria-label', 'Settings sections');
    const tabs = Array.from(document.querySelectorAll('#settingsPanel .settings-tab-btn'));
    tabs.forEach((btn, idx) => {
      const id = String(btn.id || '');
      const tabName = id.replace('settingsTab-', '');
      btn.setAttribute('aria-controls', 'settingsTabPanel-' + tabName);
      btn.dataset.tabIndex = String(idx);
      if (btn.dataset.tabKeyBound === '1') return;
      btn.dataset.tabKeyBound = '1';
      btn.addEventListener('keydown', function (evt) {
        const key = evt.key;
        const currentIndex = Number(btn.dataset.tabIndex || idx);
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          evt.preventDefault();
          const next = (currentIndex + 1) % tabs.length;
          tabs[next].focus();
          return;
        }
        if (key === 'ArrowLeft' || key === 'ArrowUp') {
          evt.preventDefault();
          const prev = (currentIndex - 1 + tabs.length) % tabs.length;
          tabs[prev].focus();
          return;
        }
        if (key === 'Home') {
          evt.preventDefault();
          tabs[0].focus();
          return;
        }
        if (key === 'End') {
          evt.preventDefault();
          tabs[tabs.length - 1].focus();
          return;
        }
        if (key === 'Enter' || key === ' ') {
          evt.preventDefault();
          const id = String(btn.id || '');
          const tabName = id.replace('settingsTab-', '');
          setActiveTab(tabName);
        }
      });
    });
  }

  function renderTerrainAssetRows() {
    const container = document.getElementById('settingsTerrainAssetRows');
    if (!container) return;
    const region = getTerrainAssetRegionKey(Settings.terrainAssetRegion || 'province');
    const terrainKeys = TERRAIN_ASSET_CATALOG[region] || [];
    container.innerHTML = terrainKeys.map((terrainKey) => {
      const key = normalizeTerrainAssetKey(terrainKey);
      const dataUrl = getTerrainTileAsset(region, key);
      const label = key.replace(/_/g, ' ');
      const preview = dataUrl
        ? '<div class="settings-terrain-preview" style="background-image:url(' + dataUrl.replace(/\)/g, '%29') + ');"></div>'
        : '<div class="settings-terrain-preview settings-terrain-preview-empty">No Tile</div>';
      return ''
        + '<div class="settings-terrain-row">'
        + '<div class="settings-terrain-key">' + label + '</div>'
        + preview
        + '<div class="settings-terrain-actions">'
        + '<button class="btn btn-xs" onclick="window.settingsSystem.promptTerrainAssetUpload(\'' + region + '\',\'' + key + '\')">Upload</button>'
        + '<button class="btn btn-xs" onclick="window.settingsSystem.clearTerrainAsset(\'' + region + '\',\'' + key + '\')">Clear</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function setTerrainAssetRegion(region) {
    Settings.terrainAssetRegion = getTerrainAssetRegionKey(region);
    Settings.save();
    renderTerrainAssetRows();
  }

  function promptTerrainAssetUpload(region, terrainKey) {
    const rk = getTerrainAssetRegionKey(region);
    const tk = normalizeTerrainAssetKey(terrainKey);
    if (!tk) return;
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.onchange = function () {
      const file = picker.files && picker.files[0] ? picker.files[0] : null;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        const ok = setTerrainTileAsset(rk, tk, String(reader.result || ''));
        if (!ok) return;
        renderTerrainAssetRows();
        if (typeof window.refreshAllHexMaps === 'function') window.refreshAllHexMaps();
        if (typeof showNotif === 'function') showNotif('Terrain tile uploaded for ' + rk + ' / ' + tk + '.', 'good');
      };
      reader.readAsDataURL(file);
    };
    picker.click();
  }

  function clearTerrainAsset(region, terrainKey) {
    const rk = getTerrainAssetRegionKey(region);
    const tk = normalizeTerrainAssetKey(terrainKey);
    if (!tk) return;
    if (!clearTerrainTileAsset(rk, tk)) return;
    renderTerrainAssetRows();
    if (typeof window.refreshAllHexMaps === 'function') window.refreshAllHexMaps();
    if (typeof showNotif === 'function') showNotif('Cleared terrain tile for ' + rk + ' / ' + tk + '.', 'info');
  }

  function clearTerrainAssetRegion() {
    const region = getTerrainAssetRegionKey(Settings.terrainAssetRegion || 'province');
    const keys = Object.keys((terrainAssetsByRegion[region] && typeof terrainAssetsByRegion[region] === 'object') ? terrainAssetsByRegion[region] : {});
    if (!keys.length) {
      if (typeof showNotif === 'function') showNotif('No terrain tiles set for this region.', 'info');
      return;
    }
    keys.forEach((k) => clearTerrainTileAsset(region, k));
    renderTerrainAssetRows();
    if (typeof window.refreshAllHexMaps === 'function') window.refreshAllHexMaps();
    if (typeof showNotif === 'function') showNotif('Cleared all terrain tiles for ' + region + '.', 'info');
  }

  function stopColorBlindPreview(options) {
    const opts = options || {};
    if (colorBlindPreviewTimer) {
      clearTimeout(colorBlindPreviewTimer);
      colorBlindPreviewTimer = null;
    }
    const wasActive = colorBlindPreviewActive;
    colorBlindPreviewActive = false;
    colorBlindPreviewEndsAt = 0;
    if (wasActive && opts.revert !== false && !Settings.colorBlindMode) {
      Settings.applyAccessibilitySettings();
    }
  }

  function syncTableSceneFocusUI() {
    const focusBtn = document.getElementById('tableSceneFocusLockBtn');
    const focusLabel = document.getElementById('tableSceneFocusLockLabel');
    if (focusBtn) {
      focusBtn.textContent = 'Focus Lock: ' + (Settings.tableSceneFocusLock ? 'On' : 'Off');
      focusBtn.style.borderColor = Settings.tableSceneFocusLock ? 'var(--teal)' : 'var(--border2)';
      focusBtn.style.color = Settings.tableSceneFocusLock ? 'var(--teal)' : 'var(--muted2)';
    }
    if (focusLabel) {
      focusLabel.textContent = Settings.tableSceneFocusLock
        ? ('Pinned to ' + String(Settings.tableSceneLockedMode || 'exploration'))
        : 'Locks the current narrative/exploration/combat focus globally.';
    }
  }

  function syncGameModeUI() {
    const isGM = Settings.gameMode === 'gm';
    const isCampaign = Settings.gameMode === 'campaign';
    const isSolo = !isGM && !isCampaign;
    const modeButtons = document.querySelectorAll('#settingsPanel .mode-btn');
    if (modeButtons.length >= 3) {
      modeButtons[0].classList.toggle('active', !isGM && !isCampaign);
      modeButtons[1].classList.toggle('active', isGM);
      modeButtons[2].classList.toggle('active', isCampaign);
    }

    const modeLabel = document.getElementById('currentModeLabel');
    if (modeLabel) {
      modeLabel.textContent = isGM ? 'GM' : (isCampaign ? 'Campaign' : 'Solo');
    }

    const gmToolsRow = document.getElementById('gmToolsRow');
    if (gmToolsRow) {
      gmToolsRow.style.display = isGM ? 'block' : 'none';
    }

    const modeQuickStart = document.getElementById('modeQuickStart');
    if (modeQuickStart) {
      modeQuickStart.innerHTML = getModeQuickStartHtml();
    }

    const gmRevealDCBtn = document.getElementById('gmRevealDCBtn');
    if (gmRevealDCBtn) {
      gmRevealDCBtn.textContent = 'Reveal DC: ' + (Settings.gmRevealDC ? 'On' : 'Off');
      gmRevealDCBtn.style.borderColor = Settings.gmRevealDC ? 'var(--teal)' : 'var(--border2)';
      gmRevealDCBtn.style.color = Settings.gmRevealDC ? 'var(--teal)' : 'var(--muted2)';
    }

    const gmRevealHiddenBtn = document.getElementById('gmRevealHiddenBtn');
    if (gmRevealHiddenBtn) {
      gmRevealHiddenBtn.textContent = 'Reveal Hidden Info: ' + (Settings.gmRevealHiddenInfo ? 'On' : 'Off');
      gmRevealHiddenBtn.style.borderColor = Settings.gmRevealHiddenInfo ? 'var(--teal)' : 'var(--border2)';
      gmRevealHiddenBtn.style.color = Settings.gmRevealHiddenInfo ? 'var(--teal)' : 'var(--muted2)';
    }

    const manualRollModeBtn = document.getElementById('manualRollModeBtn');
    if (manualRollModeBtn) {
      manualRollModeBtn.textContent = 'Manual Roll Mode: ' + (Settings.manualRollMode ? 'On' : 'Off');
      manualRollModeBtn.style.borderColor = Settings.manualRollMode ? 'var(--teal)' : 'var(--border2)';
      manualRollModeBtn.style.color = Settings.manualRollMode ? 'var(--teal)' : 'var(--muted2)';
    }

    syncTableSceneFocusUI();

    const settingsBtn = document.querySelector('#mainNav .settings-tab-btn');
    if (settingsBtn) {
      settingsBtn.textContent = isGM ? '⚙ GM Settings' : (isCampaign ? '⚙ Campaign Settings' : '⚙ Settings');
    }

    const soloBtn = document.querySelector('#mainNav .solo-reference-btn');
    if (soloBtn) {
      soloBtn.classList.toggle('on', isSolo);
      soloBtn.style.borderColor = isSolo ? 'var(--teal)' : '';
      soloBtn.style.color = isSolo ? 'var(--teal)' : '';
    }

    const gmBtn = document.querySelector('#mainNav .gm-dashboard-btn');
    if (gmBtn) {
      gmBtn.classList.toggle('on', isGM);
      gmBtn.style.borderColor = isGM ? 'var(--purple)' : '';
      gmBtn.style.color = isGM ? 'var(--purple)' : '';
    }

    if (typeof window.updateGmWorldbuilderVisibility === 'function') {
      window.updateGmWorldbuilderVisibility();
    }
    if (typeof window.syncMainNavGroups === 'function') {
      window.syncMainNavGroups();
    }
    if (typeof window.syncHomepageExperience === 'function') {
      window.syncHomepageExperience();
    }

    const colorBlindBtn = document.getElementById('colorBlindModeBtn');
    if (colorBlindBtn) {
      colorBlindBtn.textContent = getOnOffLabel(Settings.colorBlindMode);
      colorBlindBtn.style.borderColor = Settings.colorBlindMode ? 'var(--teal)' : 'var(--border2)';
      colorBlindBtn.style.color = Settings.colorBlindMode ? 'var(--teal)' : 'var(--muted2)';
    }

    const previewBtn = document.getElementById('colorBlindPreviewBtn');
    const previewStatus = document.getElementById('colorBlindPreviewStatus');
    if (previewBtn) {
      previewBtn.disabled = !!Settings.colorBlindMode || colorBlindPreviewActive;
      previewBtn.style.opacity = previewBtn.disabled ? '0.6' : '1';
      previewBtn.textContent = colorBlindPreviewActive
        ? tr('settings.accessibility.preview.running', 'Previewing...')
        : tr('settings.accessibility.palette.preview', 'Preview 10s');
    }
    if (previewStatus) {
      if (Settings.colorBlindMode) {
        previewStatus.textContent = tr('settings.accessibility.preview.enabled', 'Color-blind mode is enabled and saved.');
      } else if (colorBlindPreviewActive) {
        const secondsLeft = Math.max(1, Math.ceil((colorBlindPreviewEndsAt - Date.now()) / 1000));
        previewStatus.textContent = tr('settings.accessibility.preview.active', 'Preview active ({seconds}s remaining).', { seconds: secondsLeft });
      } else {
        previewStatus.textContent = tr('settings.accessibility.preview.ready', 'Preview applies temporarily for 10 seconds.');
      }
    }

    const monochromeBtn = document.getElementById('monochromeModeBtn');
    if (monochromeBtn) {
      monochromeBtn.textContent = getOnOffLabel(Settings.monochromeMode);
      monochromeBtn.style.borderColor = Settings.monochromeMode ? 'var(--teal)' : 'var(--border2)';
      monochromeBtn.style.color = Settings.monochromeMode ? 'var(--teal)' : 'var(--muted2)';
    }

    const phoneLayoutBtn = document.getElementById('phoneLayoutModeBtn');
    if (phoneLayoutBtn) {
      phoneLayoutBtn.textContent = getOnOffLabel(Settings.phoneLayoutMode);
      phoneLayoutBtn.style.borderColor = Settings.phoneLayoutMode ? 'var(--teal)' : 'var(--border2)';
      phoneLayoutBtn.style.color = Settings.phoneLayoutMode ? 'var(--teal)' : 'var(--muted2)';
    }

    ['small','medium','large'].forEach(function(sz) {
      const btn = document.getElementById('textSize' + sz.charAt(0).toUpperCase() + sz.slice(1) + 'Btn');
      if (!btn) return;
      const active = Settings.textSize === sz;
      btn.classList.toggle('active', active);
      btn.style.borderColor = active ? 'var(--teal)' : 'var(--border2)';
      btn.style.color = active ? 'var(--teal)' : 'var(--muted2)';
    });

    const musicConsentBtn = document.getElementById('musicConsentBtn');
    if (musicConsentBtn) {
      musicConsentBtn.textContent = Settings.musicConsent ? 'On' : 'Off';
      musicConsentBtn.style.borderColor = Settings.musicConsent ? 'var(--teal)' : 'var(--border2)';
      musicConsentBtn.style.color = Settings.musicConsent ? 'var(--teal)' : 'var(--muted2)';
    }

    refreshNowPlayingLabel();
    renderTerrainAssetRows();

    applySettingsTabVisibility();
    refreshRecoveryPanel();
    syncNightModeRateUI();
  }

  function refreshNowPlayingLabel() {
    const el = document.getElementById('settingsNowPlaying');
    if (!el) return;
    const audio = typeof window !== 'undefined' ? window.AudioManager : null;
    const label = audio && typeof audio.getNowPlayingLabel === 'function'
      ? audio.getNowPlayingLabel()
      : (Settings.musicConsent ? 'No track active' : 'Music disabled');
    const attribution = audio && typeof audio.getNowPlayingAttribution === 'function'
      ? String(audio.getNowPlayingAttribution() || '').trim()
      : '';
    el.textContent = label;
    el.title = attribution || label;
    el.style.color = Settings.musicConsent ? 'var(--text2)' : 'var(--muted2)';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function refreshAudioCreditsPanel() {
    const el = document.getElementById('settingsAudioCredits');
    if (!el) return;
    const audio = typeof window !== 'undefined' ? window.AudioManager : null;
    const entries = audio && typeof audio.getAssetPackAttributionEntries === 'function'
      ? audio.getAssetPackAttributionEntries()
      : [];
    if (!Array.isArray(entries) || !entries.length) {
      el.innerHTML = '<div style="font-size:.74rem;color:var(--muted2);">No external tracks loaded.</div>';
      return;
    }
    const rows = entries.map((entry) => {
      const title = escapeHtml(entry.title || entry.id || 'Untitled');
      const suite = escapeHtml(entry.suiteLabel || 'External');
      const style = escapeHtml(entry.style || 'Unspecified');
      const source = escapeHtml(entry.source || 'Unknown source');
      const artist = escapeHtml(entry.artist || 'Unknown artist');
      const license = escapeHtml(entry.license || 'Unspecified license');
      const licenseUrl = String(entry.licenseUrl || '').trim();
      const sourceUrl = String(entry.sourceUrl || '').trim();
      const id = escapeHtml(entry.id || '');
      const licenseHtml = licenseUrl
        ? '<a href="' + escapeHtml(licenseUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--teal);text-decoration:underline;">' + license + '</a>'
        : license;
      const sourceHtml = sourceUrl
        ? '<a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--gold2);text-decoration:underline;">Source Page</a>'
        : '';
      return '<div style="padding:.34rem 0;border-bottom:1px solid var(--border2);">'
        + '<div style="font-size:.78rem;color:var(--text2);font-weight:700;">' + title + '</div>'
        + '<div style="font-size:.67rem;color:var(--muted2);">' + suite + ' · ' + style + ' · ' + id + '</div>'
        + '<div style="font-size:.67rem;color:var(--muted2);">' + source + ' · ' + artist + ' · ' + licenseHtml + (sourceHtml ? (' · ' + sourceHtml) : '') + '</div>'
        + '</div>';
    }).join('');
    el.innerHTML = rows;
  }

  function toggleGMReveal(kind) {
    if (kind === 'dc') {
      Settings.gmRevealDC = !Settings.gmRevealDC;
    } else if (kind === 'hidden') {
      Settings.gmRevealHiddenInfo = !Settings.gmRevealHiddenInfo;
    }
    Settings.save();
    syncGameModeUI();
  }

  function toggleManualRollMode() {
    Settings.manualRollMode = !Settings.manualRollMode;
    Settings.save();
    syncGameModeUI();
    if (typeof showNotif === 'function') {
      showNotif(
        Settings.manualRollMode
          ? 'Manual Roll Mode enabled: major checks prompt for manual entry; lightweight checks may offer Auto Roll or Manual Roll.'
          : 'Manual Roll Mode disabled: all roll calls now use auto-rolls.',
        'info'
      );
    }
  }

  function toggleColorBlindMode() {
    if (colorBlindPreviewActive) {
      stopColorBlindPreview({ revert: false });
    }
    Settings.colorBlindMode = !Settings.colorBlindMode;
    Settings.applyAccessibilitySettings();
    Settings.save();
    syncGameModeUI();
  }

  function toggleMonochromeMode() {
    Settings.monochromeMode = !Settings.monochromeMode;
    Settings.applyAccessibilitySettings();
    Settings.save();
    syncGameModeUI();
  }

  function togglePhoneLayoutMode() {
    Settings.phoneLayoutMode = !Settings.phoneLayoutMode;
    Settings.applyAccessibilitySettings();
    Settings.save();
    syncGameModeUI();
  }

  function setTextSize(size) {
    if (size !== 'small' && size !== 'medium' && size !== 'large') return;
    Settings.textSize = size;
    Settings.applyTextSize();
    Settings.save();
    syncGameModeUI();
  }

  function toggleMusicConsent() {
    Settings.musicConsent = !Settings.musicConsent;
    Settings.applyAudioSettings();
    Settings.save();
    syncGameModeUI();
    if (typeof showNotif === 'function') {
      showNotif(
        Settings.musicConsent ? 'Background music enabled.' : 'Background music disabled.',
        Settings.musicConsent ? 'good' : 'info'
      );
    }
  }

  function previewColorBlindMode() {
    if (Settings.colorBlindMode) {
      if (typeof showNotif === 'function') {
        showNotif(tr('settings.accessibility.notif.previewAlreadyEnabled', 'Color-blind mode is already enabled.'), 'info');
      }
      return;
    }
    stopColorBlindPreview();
    colorBlindPreviewActive = true;
    colorBlindPreviewEndsAt = Date.now() + COLORBLIND_PREVIEW_MS;
    document.body.classList.add('colorblind-mode');
    syncGameModeUI();
    colorBlindPreviewTimer = setTimeout(function () {
      colorBlindPreviewActive = false;
      colorBlindPreviewEndsAt = 0;
      Settings.applyAccessibilitySettings();
      syncGameModeUI();
    }, COLORBLIND_PREVIEW_MS);
  }
  
  function openSettings() {
    const container = document.getElementById(SETTINGS_ID);
    if (container) {
      if (!container._escCloseHandler) {
        container._escCloseHandler = function (evt) {
          if (evt.key === 'Escape') closeSettings();
        };
        document.addEventListener('keydown', container._escCloseHandler);
      }
      Settings.activeTab = 'general';
      syncGameModeUI();
      applySettingsTabVisibility();
      refreshRecoveryPanel();
      container.classList.add('open');
    }
  }
  
  function closeSettings() {
    const container = document.getElementById(SETTINGS_ID);
    if (container) {
      container.classList.remove('open');
      // Remove Escape key handler if present
      if (container._escCloseHandler) {
        document.removeEventListener('keydown', container._escCloseHandler);
        delete container._escCloseHandler;
      }
    }
  }
  
  function toggleSettings() {
    const container = document.getElementById(SETTINGS_ID);
    if (container) {
      if (container.classList.contains('open')) {
        closeSettings();
      } else {
        openSettings();
      }
    }
  }
  
  function setMasterVolume(value) {
    const pct = value / 100;
    Settings.masterVolume = pct;
    Settings.applyAudioSettings();
    Settings.save();
    document.getElementById('masterVolLabel').textContent = value + '%';
  }
  
  function setMusicVolume(value) {
    const pct = value / 100;
    Settings.musicVolume = pct;
    Settings.applyAudioSettings();
    Settings.save();
    document.getElementById('musicVolLabel').textContent = value + '%';
    refreshNowPlayingLabel();
    refreshAudioCreditsPanel();
  }
  
  function setSFXVolume(value) {
    const pct = value / 100;
    Settings.sfxVolume = pct;
    Settings.applyAudioSettings();
    Settings.save();
    document.getElementById('sfxVolLabel').textContent = value + '%';
  }

  function normalizeNightModeRateValue(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function getDefaultNightModeRates() {
    return { seaOpen: 42, seaIsland: 32, planetTrade: 34, planetHex: 28, wtw: 38 };
  }

  function syncNightModeRateUI() {
    const keys = ['seaOpen', 'seaIsland', 'planetTrade', 'planetHex', 'wtw'];
    keys.forEach((key) => {
      const idCore = 'nightRate' + key.charAt(0).toUpperCase() + key.slice(1);
      const input = document.getElementById(idCore);
      const label = document.getElementById(idCore + 'Label');
      const val = Number(Settings.nightModeRates[key] || 0);
      if (input) input.value = String(val);
      if (label) label.textContent = String(val) + '%';
    });
  }

  function setNightModeRate(key, value) {
    const defaults = getDefaultNightModeRates();
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) return;
    Settings.nightModeRates[key] = normalizeNightModeRateValue(value, defaults[key]);
    Settings.save();
    syncNightModeRateUI();
  }

  function resetNightModeRates() {
    Settings.nightModeRates = getDefaultNightModeRates();
    Settings.save();
    syncNightModeRateUI();
  }

  function getNightModeRate(key) {
    const defaults = getDefaultNightModeRates();
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) return 0;
    return normalizeNightModeRateValue(Settings.nightModeRates[key], defaults[key]);
  }

  function getNightModeRates() {
    return {
      seaOpen: getNightModeRate('seaOpen'),
      seaIsland: getNightModeRate('seaIsland'),
      planetTrade: getNightModeRate('planetTrade'),
      planetHex: getNightModeRate('planetHex'),
      wtw: getNightModeRate('wtw')
    };
  }
  
  // GM Mode prompts for specific story beats
  function showGMPrompt(title, content, options = []) {
    if (!Settings.isGMMode()) return;
    
    const modal = document.getElementById('rollModal');
    if (!modal) return;
    
    let html = `<div class="gm-prompt" style="border-left:4px solid var(--purple);padding:.5rem;">
      <h3 style="color:var(--purple);margin-bottom:.3rem;">👥 GM Prompt: ${title}</h3>
      <div style="color:var(--text);font-size:.85rem;line-height:1.5;margin-bottom:.5rem;">${content}</div>`;
    
    if (options.length > 0) {
      html += '<div style="display:flex;gap:.3rem;flex-wrap:wrap;">';
      options.forEach(opt => {
        html += `<button class="btn btn-xs" onclick="${opt.action}">${opt.label}</button>`;
      });
      html += '</div>';
    }
    
    html += '</div>';
    
    document.getElementById('modalTitle').innerHTML = '👥 GM Mode';
    document.getElementById('modalContent').innerHTML = html;
    modal.style.display = 'flex';
  }
  
  // Initialize immediately and on page load
  function initSettings() {
    loadTerrainAssets();
    Settings.load();
    createSettingsPanel();
    Settings.applyGameMode();
    syncGameModeUI();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettings);
  } else {
    initSettings();
  }
  
  // Also run on page load with slight delay to ensure all elements exist
  window.addEventListener('load', initSettings);
  
  // Expose API
  window.settingsSystem = {
    openSettings,
    closeSettings,
    toggleSettings,
    setActiveTab,
    toggleColorBlindMode,
    toggleMonochromeMode,
    togglePhoneLayoutMode,
    setAccessibilityLanguage,
    getAccessibilityLanguage: () => {
      const i18n = getAccessibilityI18n();
      return i18n && typeof i18n.getLanguage === 'function' ? i18n.getLanguage() : 'en';
    },
    previewColorBlindMode,
    setMasterVolume,
    setMusicVolume,
    setSFXVolume,
    toggleMusicConsent,
    setTextSize,
    setGameMode: (mode, opts) => Settings.setGameMode(mode, opts),
    toggleGMReveal,
    toggleManualRollMode,
    showGMPrompt,
    isGMMode: () => Settings.isGMMode(),
    isCampaignMode: () => Settings.gameMode === 'campaign',
    isSoloMode: () => Settings.gameMode !== 'gm' && Settings.gameMode !== 'campaign',
    shouldRevealDC: () => Settings.shouldRevealDC(),
    shouldRevealHiddenInfo: () => Settings.shouldRevealHiddenInfo(),
    isManualRollMode: () => !!Settings.manualRollMode,
    getTableSceneFocusState: () => Settings.getTableSceneFocusState(),
    setTableSceneLockedMode: (mode, opts) => Settings.setTableSceneLockedMode(mode, opts),
    setTableSceneFocusLock: (enabled, opts) => Settings.setTableSceneFocusLock(enabled, opts),
    toggleTableSceneFocusLock: () => {
      const currentScene = document.body ? String(document.body.getAttribute('data-table-scene') || '').toLowerCase() : '';
      const sceneMode = ['narrative', 'exploration', 'combat'].indexOf(currentScene) >= 0
        ? currentScene
        : Settings.tableSceneLockedMode;
      Settings.setTableSceneFocusLock(!Settings.tableSceneFocusLock, { mode: sceneMode });
    },
    getSettings: () => ({
      masterVolume: Settings.masterVolume,
      musicVolume: Settings.musicVolume,
      sfxVolume: Settings.sfxVolume,
      musicConsent: Settings.musicConsent,
      gameMode: Settings.gameMode,
      gmRevealDC: Settings.gmRevealDC,
      gmRevealHiddenInfo: Settings.gmRevealHiddenInfo,
      manualRollMode: Settings.manualRollMode,
      tableSceneFocusLock: Settings.tableSceneFocusLock,
      tableSceneLockedMode: Settings.tableSceneLockedMode,
      colorBlindMode: Settings.colorBlindMode,
      monochromeMode: Settings.monochromeMode,
      phoneLayoutMode: Settings.phoneLayoutMode,
      textSize: Settings.textSize,
      terrainAssetRegion: Settings.terrainAssetRegion,
      activeTab: Settings.activeTab,
      nightModeRates: getNightModeRates()
    }),
    getTerrainAssetCatalog: () => JSON.parse(JSON.stringify(TERRAIN_ASSET_CATALOG)),
    getTerrainTileAsset: (region, terrainKey) => getTerrainTileAsset(region, terrainKey),
    setTerrainTileAsset: (region, terrainKey, dataUrl) => setTerrainTileAsset(region, terrainKey, dataUrl),
    setTerrainAssetRegion,
    clearTerrainAssetRegion,
    promptTerrainAssetUpload,
    clearTerrainAsset,
    renderTerrainAssetRows,
    getNightModeRate,
    getNightModeRates,
    setNightModeRate,
    resetNightModeRates,
    refreshRecoveryPanel,
    refreshNowPlayingLabel,
    initSettings // Expose for manual initialization if needed
  };

  window.addEventListener('beyond:now-playing-changed', refreshNowPlayingLabel);
  window.addEventListener('beyond:audio-asset-pack-changed', refreshAudioCreditsPanel);
  window.addEventListener('beyond:accessibility-language-changed', function () {
    createSettingsPanel();
    syncGameModeUI();
    applySettingsTabVisibility();
  });
  window.getTerrainTileAsset = getTerrainTileAsset;
  window.getTerrainAssetCatalog = function () { return JSON.parse(JSON.stringify(TERRAIN_ASSET_CATALOG)); };
  
  // Ensure it's initialized immediately
  if (document.readyState !== 'loading') {
    initSettings();
  }
})();

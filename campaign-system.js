// campaign-system.js — Multiplayer campaign rooms with session restore and dock UI
(function () {
  var SESSION_KEY = "beyond-light-campaign-session";
  var STALE_SYNC_MS = 12000;

  function getSessionStorageSafe() {
    try {
      return window.sessionStorage || null;
    } catch (_err) {
      return null;
    }
  }

  function getLocalStorageSafe() {
    try {
      return window.localStorage || null;
    } catch (_err) {
      return null;
    }
  }

  function readSessionPayload(storageArea) {
    if (!storageArea || typeof storageArea.getItem !== "function") return null;
    try {
      var raw = storageArea.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_err) {
      return null;
    }
  }

  var state = {
    socket: null,
    connected: false,
    ready: false,
    code: "",
    role: "",
    token: "",
    playerName: "",
    campaign: null,
    suppressTmwEmit: false,
    lastKnownTmw: null,
    suppressMentalStressEmit: false,
    lastKnownMentalStress: null,
    suppressCreditsEmit: false,
    lastKnownCredits: null,
    suppressRenownEmit: false,
    lastKnownRenown: null,
    activePromptId: "",
    lastAutoResolvedRollKey: "",
    autoRestoreTried: false,
    restoringSession: false,
    sessionPersistenceSuppressed: false,
    dockOpen: false,
    lastDockLogSize: 0,
    timelineFilter: "all",
    hiddenTimelineKeys: [],
    hiddenTimelineUndoBatches: [],
    lastCharacterHash: "",
    lastAppliedSelfCharacterAt: 0,
    characterSyncSuppressUntil: 0,
    gmIdea: "",
    gmWayfarerSort: "online",
    lastSharedHash: "",
    lastSharedVersion: 0,
    lastProgressHash: "",
    syncHealth: "idle",
    lastSyncAt: 0,
    syncText: "Idle",
    pendingSyncCount: 0,
    syncConflictCount: 0,
    lastSyncConflicts: [],
    lastCampaignStateAt: 0,
    lastServerStateVersion: 0,
    lastDisconnectAt: 0,
    reconnectGraceUntil: 0,
    waitingReconnectSnapshot: false,
    lastAuthoritativeAt: 0,
    syncInFlight: false,
    syncQueued: false,
    syncQueuedReason: "",
    lastResyncRequester: "",
    lastResyncRequestAt: 0,
    lastAutoRebroadcastAt: 0,
    lastAutoRebroadcastOk: null,
    lastAutoRebroadcastError: "",
    lastPlayerPatchGuardToastAt: 0,
    lastPlayerPatchGuardToastKey: "",
    localEconomyLedger: [],
    suppressEconomyLedgerAuto: false,
    applyingSharedState: false,
    uiDraft: {
      name: "",
      code: "",
      joinPassword: "",
      soundtrack: {
        mood: "custom",
        suiteId: "",
        styleName: "",
        ambienceA: "",
        ambienceB: "",
        dirty: false,
        activeControl: "",
        lastInteractionAt: 0
      }
    },
    activeRosterSheetToken: "",
    lastCampaignCombatPromptAt: 0,
    lastCampaignActorPromptKey: "",
    lastCampaignEnemyPromptKey: "",
    lastCampaignVttPromptAt: 0,
    lastCampaignScenePromptKey: "",
    lastCampaignAreaPromptKey: "",
    activeCampaignAreaSessionId: "",
    activeCampaignAreaRenderHash: "",
    sharedVttJoinRetryAt: 0,
    lastAppliedCampaignSoundtrackHash: "",
    lastCampaignTravelAppliedAt: 0,
    lastReadyCheckPromptId: "",
    lastAppliedPartyRestEventId: "",
    lastProvinceMapHash: "",
    lastProvinceSelectionsHash: "",
    lastProvinceFocusSyncAt: 0,
    provinceFocusSyncTimer: null,
    pendingProvinceFocusReason: "",
    lastCameraViewHash: "",
    lastCameraWorldSyncAt: 0,
    cameraSyncTimer: null,
    cameraSyncReason: "",
    cameraSyncWantsWorld: false,
    combatSceneSyncTimer: null,
    lastCombatSceneHash: "",
    combatSceneSyncGeneration: 0,
    combatSceneAutoSyncSuppressUntil: 0,
    lastPlayerDockSeed: "",
    lastDockActorKey: "",
    dockActorFlashUntil: 0,
    dockTimelinePinned: false,
    dockTimelineUnseen: 0,
    lastDockTimelineEntryKey: "",
    lastGlobalQuickAccessHash: "",
    tableSceneMode: "auto",
    effectiveTableSceneMode: "exploration",
    timelineFilterManual: false,
    pendingSettingsRender: false,
    settingsRenderTimer: null
  };

  var readyCheckCallbacks = {};
  var sceneCheckHandlers = {};

  var ROLE_ACTIONS = {
    gm: {
      callRoll: true,
      closeRoll: true,
      setPassword: true,
      archiveCampaign: true,
      deleteCampaign: true,
      forceAuthoritativeResync: true,
      clearProvinceSelections: true,
      adjustEconomy: true,
      exportSnapshot: true,
      importSnapshot: true
    },
    player: {
      requestResync: true,
      submitRoll: true,
      stashShare: true,
      stashClaim: true,
      savePrivateNote: true,
      sendChat: true,
      syncSharedWorld: true
    }
  };

  var CAMPAIGN_SOUNDTRACK_CONTROL_IDS = [
    "campaignMusicMood",
    "campaignMusicSuite",
    "campaignMusicStyle",
    "campaignMusicAmbienceA",
    "campaignMusicAmbienceB"
  ];

  var PLAYER_SHARED_PATCH_KEYS = {
    renown: true,
    credits: true,
    mentalStress: true,
    missionTokens: true,
    activeMissions: true,
    completedMissions: true,
    availableJobs: true,
    storyline: true,
    holding: true,
    caravan: true,
    factionWayfarerTasks: true,
    factionNarrative: true,
    factionRenown: true,
    factionBases: true,
    provinceSelections: true,
    partyStash: true,
    characterInventories: true,
    economyLedger: true,
    campaignCombat: true,
    combatScene: true,
    readyCheck: true,
    pendingChecks: true
  };

  // Explicitly local-only character domains (never synced through shared world patches).
  var PLAYER_LOCAL_ONLY_KEYS = {
    rival: true,
    rivals: true,
    backstory: true,
    background: true
  };

  var CAMPAIGN_SOUNDTRACK_PRESETS = [
    {
      id: "calm-travel",
      label: "Calm Travel",
      suiteId: "music-suite-caravan",
      styleName: "Folk Caravan",
      ambienceIds: ["amb-wind"]
    },
    {
      id: "province-expedition",
      label: "Province Expedition",
      suiteId: "music-suite-province",
      styleName: "Province Marches",
      ambienceIds: ["amb-wind"]
    },
    {
      id: "sea-voyage",
      label: "Sea Voyage",
      suiteId: "music-suite-sea",
      styleName: "Abyssal Sea",
      ambienceIds: ["amb-waves", "amb-ship-rumble"]
    },
    {
      id: "storm-dread",
      label: "Storm And Dread",
      suiteId: "music-suite-sea",
      styleName: "Stormglass Voyage",
      ambienceIds: ["amb-rain", "amb-thunder"]
    },
    {
      id: "cosmic-wonder",
      label: "Cosmic Wonder",
      suiteId: "music-suite-planet",
      styleName: "Planetfall Frontier",
      ambienceIds: ["amb-radio"]
    },
    {
      id: "city-noir",
      label: "City Noir",
      suiteId: "music-suite-space",
      styleName: "Orbital Noir",
      ambienceIds: ["amb-crowd", "amb-radio"]
    },
    {
      id: "combat-pressure",
      label: "Combat Pressure",
      suiteId: "music-suite-combat",
      styleName: "Iron Clash",
      ambienceIds: ["amb-weapon-fighting"]
    },
    {
      id: "victory-relief",
      label: "Victory And Relief",
      suiteId: "music-suite-character",
      styleName: "Heroic Thread",
      ambienceIds: ["amb-campfire"]
    }
  ];

  function safeNotif(msg, kind) {
    if (typeof window.showNotif === "function") {
      window.showNotif(msg, kind || "");
    }
  }

  function canUseSockets() {
    return typeof window.io === "function";
  }

  function resolveGameState() {
    try {
      if (typeof S !== "undefined" && S) {
        return S;
      }
    } catch (_err) {}
    try {
      return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
    } catch (_err) {
      return (typeof window.S !== "undefined" && window.S) ? window.S : null;
    }
  }

  function syncWindowStateAlias() {
    var gameState = resolveGameState();
    if (gameState && window.S !== gameState) {
      window.S = gameState;
    }
    return gameState;
  }

  function ensureName() {
    if (state.playerName) return state.playerName;
    var gameState = syncWindowStateAlias();
    var fromS = (gameState && gameState.name) ? String(gameState.name).trim() : "";
    state.playerName = fromS || "Wayfarer";
    return state.playerName;
  }

  function getCampaignRoleLabel(role) {
    return role === "gm" ? "GM" : "Player";
  }

  function emitWithAck(eventName, payload) {
    return new Promise(function (resolve) {
      if (!state.socket) {
        resolve({ ok: false, error: "Not connected to server." });
        return;
      }
      state.socket.emit(eventName, payload || {}, function (res) {
        resolve(res || { ok: false, error: "No response from server." });
      });
    });
  }

  function waitForSocketConnection(timeoutMs) {
    return new Promise(function (resolve) {
      if (state.connected) {
        resolve(true);
        return;
      }
      if (!state.socket) {
        resolve(false);
        return;
      }

      var settled = false;
      var timer = setTimeout(function () {
        finish(false);
      }, Math.max(400, Number(timeoutMs || 2600)));

      function cleanup() {
        clearTimeout(timer);
        try {
          if (typeof state.socket.off === "function") {
            state.socket.off("connect", onConnect);
            state.socket.off("connect_error", onError);
          }
        } catch (_err) {}
      }

      function finish(ok) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(!!ok);
      }

      function onConnect() {
        finish(true);
      }

      function onError() {
        finish(false);
      }

      if (typeof state.socket.on === "function") {
        state.socket.on("connect", onConnect);
        state.socket.on("connect_error", onError);
      }
    });
  }

  function formatCode(code) {
    return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  }

  function formatTimestamp(value) {
    var t = Number(value || 0);
    if (!t) return "";
    try {
      return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (_err) {
      return "";
    }
  }

  function formatDateTime(value) {
    var t = Number(value || 0);
    if (!t) return "";
    try {
      return new Date(t).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch (_err) {
      return "";
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function deepCloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return null;
    }
  }

  function setSyncHealth(mode, text) {
    var nextMode = String(mode || "idle");
    var nextText = String(text || "");
    var changed = state.syncHealth !== nextMode || state.syncText !== nextText;
    state.syncHealth = nextMode;
    state.syncText = nextText;
    return changed;
  }

  function getLastSnapshotAgeSeconds() {
    if (!state.lastCampaignStateAt) return 0;
    return Math.max(0, Math.floor((Date.now() - Number(state.lastCampaignStateAt || 0)) / 1000));
  }

  function refreshSyncHealth() {
    var now = Date.now();
    var remaining = state.reconnectGraceUntil
      ? Math.max(0, Math.ceil((Number(state.reconnectGraceUntil || 0) - now) / 1000))
      : 0;

    if (!state.connected) {
      if (state.code) {
        if (!state.lastDisconnectAt) state.lastDisconnectAt = now;
        if (!state.reconnectGraceUntil) state.reconnectGraceUntil = now + STALE_SYNC_MS;
        state.waitingReconnectSnapshot = true;
        return setSyncHealth("stale", remaining > 0 ? ("Reconnecting (" + remaining + "s)") : "Reconciling...");
      } else {
        state.waitingReconnectSnapshot = false;
        return setSyncHealth("offline", "Offline");
      }
    }
    if (!state.code) {
      state.waitingReconnectSnapshot = false;
      state.reconnectGraceUntil = 0;
      return setSyncHealth("online", "Connected");
    }
    if (state.waitingReconnectSnapshot) {
      return setSyncHealth("syncing", remaining > 0 ? ("Reconciling (" + remaining + "s)") : "Reconciling...");
    }
    if (state.syncInFlight || Number(state.pendingSyncCount || 0) > 0) {
      return setSyncHealth("syncing", "Syncing...");
    }
    if (Number(state.syncConflictCount || 0) > 0) {
      return setSyncHealth("stale", "Conflicts " + Number(state.syncConflictCount || 0));
    }
    var ageSec = getLastSnapshotAgeSeconds();
    if (state.lastCampaignStateAt && ageSec >= Math.floor(STALE_SYNC_MS / 1000)) {
      return setSyncHealth("stale", "Stale " + ageSec + "s");
    }
    return setSyncHealth("online", "Synced");
  }

  function isRecoveryOnlySyncState() {
    if (!state.code) return false;
    if (!state.connected) return true;
    var mode = String(state.syncHealth || "idle");
    if (mode === "stale") return true;
    if (mode === "syncing") {
      var text = String(state.syncText || "").toLowerCase();
      if (text.indexOf("reconnect") >= 0 || text.indexOf("reconcil") >= 0) return true;
    }
    return false;
  }

  function getCampaignTableState(sharedState) {
    var shared = sharedState || getCampaignSharedState() || {};
    var ready = shared.readyCheck && typeof shared.readyCheck === "object" ? shared.readyCheck : null;
    var combat = shared.campaignCombat && typeof shared.campaignCombat === "object" ? shared.campaignCombat : null;
    var travel = shared.campaignTravel && typeof shared.campaignTravel === "object" ? shared.campaignTravel : null;

    if (isRecoveryOnlySyncState()) {
      return { key: "reconnecting", label: "Reconnecting", recoveryOnly: true };
    }
    if (ready && ready.id && String(ready.status || "") === "pending") {
      return { key: "ready-check", label: "Ready Check", recoveryOnly: false };
    }
    if (combat && combat.active) {
      return { key: "combat", label: "Combat Active", recoveryOnly: false };
    }

    var travelAt = Number(travel && travel.updatedAt || 0);
    var travelReason = String(travel && travel.reason || "");
    if (travelAt && (Date.now() - travelAt) < 9000 && (travelReason.indexOf("travel") >= 0 || travelReason.indexOf("camera-lock") >= 0)) {
      return { key: "travel", label: "Travel Transition", recoveryOnly: false };
    }
    return { key: "exploration", label: "Exploration", recoveryOnly: false };
  }

  function getTableBadgeTone(tableState) {
    var key = String(tableState && tableState.key || "exploration");
    if (key === "reconnecting") return "stale";
    if (key === "combat") return "syncing";
    return "online";
  }

  function normalizeTableSceneMode(value) {
    var key = String(value || "auto").toLowerCase();
    if (["auto", "narrative", "exploration", "combat"].indexOf(key) === -1) return "auto";
    return key;
  }

  function deriveAutoTableSceneMode(sharedState, tableState, campaignState) {
    var tableKey = String(tableState && tableState.key || "exploration");
    if (tableKey === "combat") return "combat";
    if (tableKey === "travel" || tableKey === "reconnecting") return "exploration";

    var ready = sharedState && sharedState.readyCheck && typeof sharedState.readyCheck === "object"
      ? sharedState.readyCheck
      : null;
    if (ready && ready.id && String(ready.status || "") === "pending" && String(ready.type || "") !== "combat-start") {
      return "narrative";
    }

    var combinedTimeline = buildDockTimelineSource(
      campaignState && Array.isArray(campaignState.log) ? campaignState.log : [],
      sharedState && Array.isArray(sharedState.sessionTimeline) ? sharedState.sessionTimeline : []
    );
    var recent = combinedTimeline.slice(-10);
    var chatCount = 0;
    var rollCount = 0;
    recent.forEach(function (entry) {
      var kind = String(entry && entry.kind || "");
      if (kind === "chat") chatCount += 1;
      if (kind === "roll" || kind === "roll-result") rollCount += 1;
    });
    if (recent.length >= 4 && chatCount >= Math.max(3, rollCount + 2)) {
      return "narrative";
    }
    return "exploration";
  }

  function getTableSceneDescriptor(sceneMode) {
    var key = normalizeTableSceneMode(sceneMode === "auto" ? "exploration" : sceneMode);
    if (key === "combat") {
      return {
        label: "Combat",
        shortLabel: "Combat",
        copy: "Tactical focus active. Structure and read clarity take priority.",
        spotlight: "Initiative, roll requests, and outcome-critical state"
      };
    }
    if (key === "narrative") {
      return {
        label: "Narrative",
        shortLabel: "Story",
        copy: "Character conversation is in the foreground. Mechanics stay out of the way until called.",
        spotlight: "Dialogue, table cues, and roleplay pacing"
      };
    }
    return {
      label: "Exploration",
      shortLabel: "Explore",
      copy: "Low-clutter travel posture. The table can roam and discover with cinematic breathing room.",
      spotlight: "Travel context, discoveries, and lightweight updates"
    };
  }

  function resolveTableSceneState(sharedState, tableState, campaignState) {
    var settingsFocus = null;
    if (window.settingsSystem && typeof window.settingsSystem.getTableSceneFocusState === "function") {
      try {
        settingsFocus = window.settingsSystem.getTableSceneFocusState() || null;
      } catch (_err) {
        settingsFocus = null;
      }
    }
    var preferred = normalizeTableSceneMode(state.tableSceneMode);
    var autoMode = deriveAutoTableSceneMode(sharedState, tableState, campaignState);
    var focusLocked = !!(settingsFocus && settingsFocus.locked);
    var lockedMode = normalizeTableSceneMode(settingsFocus && settingsFocus.mode || "exploration");
    var effective = focusLocked ? lockedMode : (preferred === "auto" ? autoMode : preferred);
    return {
      preferred: preferred,
      auto: autoMode,
      locked: focusLocked,
      lockedMode: lockedMode,
      effective: effective,
      descriptor: getTableSceneDescriptor(effective)
    };
  }

  function applySceneTimelinePreset(mode, force) {
    if (state.role !== "gm") return;
    if (!force && state.timelineFilterManual) return;
    var desired = "all";
    if (mode === "combat") desired = "roll";
    if (mode === "narrative") desired = "chat";
    setTimelineFilter(desired, { systemPreset: true });
  }

  function setTableSceneMode(mode, options) {
    var opts = options || {};
    var next = normalizeTableSceneMode(mode);
    state.tableSceneMode = next;
    if (window.settingsSystem && typeof window.settingsSystem.getTableSceneFocusState === "function") {
      try {
        var focusState = window.settingsSystem.getTableSceneFocusState() || null;
        if (focusState && focusState.locked && next !== "auto" && typeof window.settingsSystem.setTableSceneLockedMode === "function") {
          window.settingsSystem.setTableSceneLockedMode(next, { silent: true });
        }
      } catch (_err) {}
    }
    if (!opts.skipTimelinePreset) {
      if (next === "auto") {
        applySceneTimelinePreset(state.effectiveTableSceneMode || "exploration", false);
      } else {
        applySceneTimelinePreset(next, true);
      }
    }
    renderDockPanel();
  }

  function applyGlobalSceneFocus(sceneMode) {
    var body = document.body;
    if (!body) return;
    var active = !!state.code && (body.classList.contains("campaign-mode") || body.classList.contains("gm-mode"));
    var modes = ["narrative", "exploration", "combat"];
    modes.forEach(function (key) {
      body.classList.toggle("table-scene-" + key, !!(active && sceneMode === key));
    });
    body.classList.toggle("table-scene-active", !!active);
    if (active && sceneMode) {
      body.setAttribute("data-table-scene", String(sceneMode));
    } else {
      body.removeAttribute("data-table-scene");
    }
  }

  function refreshSceneFocusState() {
    renderDockPanel();
  }

  function guardRiskySharedAction(actionLabel, callback) {
    var tableState = getCampaignTableState();
    if (!tableState || !tableState.recoveryOnly) return true;
    safeNotif("Cannot " + String(actionLabel || "run that action") + " while sync recovery is in progress. Use Reconnect/Fix Desync first.", "warn");
    if (callback) callback({ ok: false, error: "Sync recovery in progress." });
    return false;
  }

  function maybeDeterministicReconcile(trigger) {
    if (!state.code) return;
    if (!state.connected) return;
    var now = Date.now();
    if (now - Number(state.lastResyncRequestAt || 0) < 4000) return;
    state.lastResyncRequestAt = now;

    if (state.role === "gm") {
      syncSharedSilent("gm-reconcile-" + String(trigger || "drift")).then(function (res) {
        if (!res || !res.ok) {
          setSyncHealth("stale", "Reconcile failed");
          return;
        }
        state.lastSyncAt = Date.now();
        refreshSyncHealth();
      }).catch(function () {
        setSyncHealth("stale", "Reconcile failed");
      });
      return;
    }

    if (state.role === "player") {
      requestResync();
    }
  }

  function hasActionPermission(actionName) {
    var role = state.role === "gm" ? "gm" : (state.role ? "player" : "");
    if (!role || !actionName) return false;
    var table = ROLE_ACTIONS[role] || {};
    if (table[actionName]) return true;
    return !!((ROLE_ACTIONS.gm && role === "gm" && ROLE_ACTIONS.gm[actionName]) || false);
  }

  function getActiveContextId() {
    var btn = document.querySelector('.ctx-btn.on') || document.querySelector('.ctx-btn[aria-pressed="true"]');
    if (!btn) return "";
    return String(btn.getAttribute("data-ctx") || "");
  }

  function getActiveTabId() {
    var panel = document.querySelector(".tab-panel.active");
    if (!panel || !panel.id) return "";
    return String(panel.id).replace(/^tab-/, "");
  }

  function getCameraTravelLabel(tab, context) {
    var tabId = String(tab || "");
    var contextId = String(context || "");
    if (tabId === "map") return "Province Map";
    if (tabId === "lastsea") return "Last Sea";
    if (tabId === "galaxy") return "Galaxy";
    if (tabId === "worldthatwas") return "World That Was";
    if (tabId === "planet") return "Planet";
    if (tabId === "naval") return "Naval";
    if (contextId === "space") return "Space";
    if (contextId === "sea") return "Sea";
    if (contextId === "holding") return "Holding";
    return "Province Map";
  }

  function getCameraRegion(tab, context) {
    var tabId = String(tab || "");
    var contextId = String(context || "");
    if (tabId === "lastsea" || contextId === "sea") return "sea";
    if (tabId === "galaxy" || tabId === "worldthatwas" || tabId === "planet" || contextId === "space") return "space";
    return "province";
  }

  function isStrictGmCameraLockEnabled(sharedState) {
    var shared = sharedState || getCampaignSharedState();
    var settings = shared && shared.gmSettings && typeof shared.gmSettings === "object"
      ? shared.gmSettings
      : null;
    return !!(settings && settings.cameraLock === true);
  }

  function buildCameraViewSnapshot() {
    var context = getActiveContextId();
    var tab = getActiveTabId();
    var provinceKey = (typeof window.getProvinceSelectedKey === "function")
      ? String(window.getProvinceSelectedKey() || "")
      : "";
    return {
      context: context,
      tab: tab,
      provinceKey: provinceKey,
      region: getCameraRegion(tab, context),
      label: getCameraTravelLabel(tab, context)
    };
  }

  function cameraViewHash(view) {
    var snap = view || buildCameraViewSnapshot();
    return [
      String(snap.context || ""),
      String(snap.tab || ""),
      String(snap.provinceKey || ""),
      String(snap.region || "")
    ].join("|");
  }

  function isPlayerViewOutOfLock(travel) {
    if (!travel || typeof travel !== "object") return false;
    var activeContext = getActiveContextId();
    var activeTab = getActiveTabId();
    if (activeTab === "character" || activeTab === "shop") return false;
    var expectedContext = String(travel.context || "");
    var expectedTab = String(travel.tab || "");
    if (expectedContext && activeContext && expectedContext !== activeContext) return true;
    if (expectedTab && activeTab && expectedTab !== activeTab) return true;
    if (expectedTab === "map") {
      var expectedProvince = String(travel.provinceKey || "");
      var currentProvince = (typeof window.getProvinceSelectedKey === "function")
        ? String(window.getProvinceSelectedKey() || "")
        : "";
      if (expectedProvince && currentProvince !== expectedProvince) return true;
    }
    return false;
  }

  function scheduleGmCameraSync(reason, includeWorldSync) {
    if (!state.code || !state.connected || state.role !== "gm") return;
    if (!isStrictGmCameraLockEnabled()) return;
    state.cameraSyncReason = String(reason || state.cameraSyncReason || "camera-lock");
    state.cameraSyncWantsWorld = !!state.cameraSyncWantsWorld || !!includeWorldSync;
    if (state.cameraSyncTimer) return;
    state.cameraSyncTimer = setTimeout(function () {
      var why = String(state.cameraSyncReason || "camera-lock");
      var wantsWorld = !!state.cameraSyncWantsWorld;
      state.cameraSyncTimer = null;
      state.cameraSyncReason = "";
      state.cameraSyncWantsWorld = false;
      syncGmCameraView(why, { includeWorldSync: wantsWorld });
    }, 140);
  }

  async function syncGmCameraView(reason, options) {
    if (!state.code || !state.connected || state.role !== "gm") return { ok: false, error: "Not connected as GM." };
    if (!isStrictGmCameraLockEnabled()) return { ok: false, error: "GM camera lock disabled." };
    var opts = options || {};
    var view = buildCameraViewSnapshot();
    if (!view.tab) return { ok: false, error: "No active tab for camera view." };
    var nextHash = cameraViewHash(view);
    if (!opts.force && nextHash === state.lastCameraViewHash) {
      return { ok: true, skipped: true };
    }

    var now = Date.now();
    var travel = {
      region: view.region,
      context: view.context || "traveling",
      tab: view.tab,
      label: view.label,
      provinceKey: view.provinceKey,
      movedBy: String(state.playerName || ensureName() || "GM"),
      reason: String(reason || "gm-camera-lock"),
      phaseCost: 0,
      updatedAt: now
    };
    var patch = { campaignTravel: travel };
    var res = await syncSharedPatch(patch, "gm-camera-lock-" + String(reason || "view"));
    if (!res || !res.ok) return res || { ok: false, error: "Camera sync failed." };

    state.lastCameraViewHash = nextHash;
    if (view.tab === "map") {
      syncProvinceFocus("gm-camera-lock").catch(function () {});
    }
    if (opts.includeWorldSync && now - Number(state.lastCameraWorldSyncAt || 0) > 1200) {
      var tableState = getCampaignTableState();
      if (tableState && (tableState.key === "combat" || tableState.key === "ready-check")) {
        return res;
      }
      state.lastCameraWorldSyncAt = now;
      syncSharedSilent("gm-camera-visibility").catch(function () {});
    }
    return res;
  }

  function guardAction(actionName, errorText) {
    if (hasActionPermission(actionName)) return true;
    safeNotif(errorText || "You do not have permission for that action.", "warn");
    return false;
  }

  function isCampaignPlayerReadOnlyForSharedWorld() {
    return !!(state.code && state.role === "player");
  }

  function guardSharedWorldMutation(errorText, requestDetails) {
    if (!isCampaignPlayerReadOnlyForSharedWorld()) return true;
    if (requestDetails && requestSharedWorldAction(requestDetails).ok) return false;
    safeNotif(errorText || "Only the GM can change the shared world state in Campaign mode.", "warn");
    return false;
  }

  function requestSharedWorldAction(details) {
    if (!isConnectedCampaignPlayer()) {
      return { ok: false, handled: false, error: "Only connected players can request GM world actions." };
    }
    var spec = details && typeof details === "object" ? details : {};
    var label = String(spec.label || "Shared world action").trim() || "Shared world action";
    var message = String(spec.message || ("🧭 Requesting GM action: " + label + ".")).slice(0, 220);
    if (typeof sendChatMessage === "function") {
      try {
        sendChatMessage({ message: message, targetToken: "" });
      } catch (_err) {}
    }
    safeNotif(String(spec.playerNotice || ("Request sent to GM: " + label + ".")), "info");
    return { ok: true, handled: true, requested: true };
  }

  function cloneClientLocalStarState() {
    if (typeof window.S === "undefined" || !window.S || !window.S.starSystem || typeof window.S.starSystem !== "object") return null;
    return {
      currentHexId: (typeof window.S.starSystem.currentHexId === "number") ? window.S.starSystem.currentHexId : null,
      selectedRing: window.S.starSystem.selectedRing || "",
      activeFacility: deepCloneJson(window.S.starSystem.activeFacility || null),
      activeHub: deepCloneJson(window.S.starSystem.activeHub || null),
      activeMystery: deepCloneJson(window.S.starSystem.activeMystery || null),
      activeDeadMoon: deepCloneJson(window.S.starSystem.activeDeadMoon || null),
      activeDeadMoonMap: deepCloneJson(window.S.starSystem.activeDeadMoonMap || null),
      activeDerelict: deepCloneJson(window.S.starSystem.activeDerelict || null),
      activeTask: deepCloneJson(window.S.starSystem.activeTask || null),
      activePlanetHexId: (typeof window.S.starSystem.activePlanetHexId === "number") ? window.S.starSystem.activePlanetHexId : null
    };
  }

  function applyClientLocalStarState(snapshot) {
    if (!snapshot || typeof window.S === "undefined" || !window.S || !window.S.starSystem || typeof window.S.starSystem !== "object") return;
    if (snapshot.currentHexId !== null) window.S.starSystem.currentHexId = snapshot.currentHexId;
    if (snapshot.selectedRing) window.S.starSystem.selectedRing = snapshot.selectedRing;
    if (snapshot.activeFacility) window.S.starSystem.activeFacility = snapshot.activeFacility;
    if (snapshot.activeHub) window.S.starSystem.activeHub = snapshot.activeHub;
    if (snapshot.activeMystery) window.S.starSystem.activeMystery = snapshot.activeMystery;
    if (snapshot.activeDeadMoon) window.S.starSystem.activeDeadMoon = snapshot.activeDeadMoon;
    if (snapshot.activeDeadMoonMap) window.S.starSystem.activeDeadMoonMap = snapshot.activeDeadMoonMap;
    if (snapshot.activeDerelict) window.S.starSystem.activeDerelict = snapshot.activeDerelict;
    if (snapshot.activeTask) window.S.starSystem.activeTask = snapshot.activeTask;
    if (snapshot.activePlanetHexId !== null) window.S.starSystem.activePlanetHexId = snapshot.activePlanetHexId;
  }

  function cloneClientLocalWorldState() {
    if (typeof window.S === "undefined" || !window.S || !window.S.worldThatWas || typeof window.S.worldThatWas !== "object") return null;
    return {
      currentZone: window.S.worldThatWas.currentZone || "",
      selectedHexId: window.S.worldThatWas.selectedHexId || "",
      minimalMapMode: !!window.S.worldThatWas.minimalMapMode,
      ui: deepCloneJson(window.S.worldThatWas.ui || {}) || {}
    };
  }

  function applyClientLocalWorldState(snapshot) {
    if (!snapshot || typeof window.S === "undefined" || !window.S || !window.S.worldThatWas || typeof window.S.worldThatWas !== "object") return;
    if (snapshot.currentZone) window.S.worldThatWas.currentZone = snapshot.currentZone;
    if (snapshot.selectedHexId) window.S.worldThatWas.selectedHexId = snapshot.selectedHexId;
    window.S.worldThatWas.minimalMapMode = !!snapshot.minimalMapMode;
    if (snapshot.ui && typeof snapshot.ui === "object") {
      window.S.worldThatWas.ui = snapshot.ui;
    }
  }

  function resolveSharedCombatSceneName() {
    var sceneState = getSharedCombatSceneEditorSnapshot();
    if (!sceneState) {
      var sharedState = null;
      try {
        sharedState = typeof getCampaignSharedState === "function"
          ? getCampaignSharedState()
          : (window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
            ? window.campaignSystem.getSharedState()
            : null);
      } catch (_err) {
        sharedState = null;
      }
      var vttSession = sharedState && sharedState.campaignCombat && typeof sharedState.campaignCombat === "object"
        && sharedState.campaignCombat.vttSession && typeof sharedState.campaignCombat.vttSession === "object"
        ? sharedState.campaignCombat.vttSession
        : null;
      return String(vttSession && vttSession.sceneName || "Campaign Shared Scene");
    }
    var activeSceneId = String(sceneState.activeSceneId || "");
    var scenes = Array.isArray(sceneState.scenes) ? sceneState.scenes : [];
    var activeScene = activeSceneId
      ? (scenes.find(function (scene) { return scene && String(scene.id || "") === activeSceneId; }) || null)
      : null;
    return String(activeScene && activeScene.name || "Campaign Shared Scene");
  }

  function getActiveSharedCombatVttSession(sharedState) {
    var shared = sharedState && typeof sharedState === "object" ? sharedState : null;
    var combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
      ? shared.campaignCombat
      : null;
    var session = combat && combat.vttSession && typeof combat.vttSession === "object"
      ? combat.vttSession
      : null;
    return session && Number(session.enteredAt || 0) > 0 ? session : null;
  }

  function hasRenderableCombatSceneEditorSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return false;
    if (Array.isArray(snapshot.tokens) && snapshot.tokens.length) return true;
    var scenes = Array.isArray(snapshot.scenes) ? snapshot.scenes : [];
    return scenes.some(function (scene) {
      return !!(scene && Array.isArray(scene.tokens) && scene.tokens.length);
    });
  }

  function getCombatSceneEditorSnapshotActiveSceneId(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return "";
    var activeSceneId = String(snapshot.activeSceneId || "");
    if (activeSceneId) return activeSceneId;
    var scenes = Array.isArray(snapshot.scenes) ? snapshot.scenes : [];
    var fallbackScene = scenes.find(function (scene) {
      return !!(scene && Array.isArray(scene.tokens) && scene.tokens.length);
    }) || null;
    return String(fallbackScene && fallbackScene.id || "");
  }

  function getSharedCombatSceneEditorSnapshot() {
    var sharedState = null;
    try {
      sharedState = typeof getCampaignSharedState === "function"
        ? getCampaignSharedState()
        : (window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
          ? window.campaignSystem.getSharedState()
          : null);
    } catch (_err) {
      sharedState = null;
    }
    var sharedScene = sharedState && sharedState.combatScene && typeof sharedState.combatScene === "object"
      ? sharedState.combatScene
      : null;
    var expectedSession = getActiveSharedCombatVttSession(sharedState);
    var expectedSceneId = String(expectedSession && expectedSession.activeSceneId || "");
    var localScene = window.S && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object"
      ? window.S.combat.sceneEditor
      : null;
    var localSceneId = getCombatSceneEditorSnapshotActiveSceneId(localScene);
    if (expectedSession) {
      var expectedSnapshot = sharedScene && sharedScene.sceneEditor && typeof sharedScene.sceneEditor === "object"
        ? (deepCloneJson(sharedScene.sceneEditor) || sharedScene.sceneEditor)
        : null;
      var expectedSnapshotSceneId = getCombatSceneEditorSnapshotActiveSceneId(expectedSnapshot);
      if (!hasRenderableCombatSceneEditorSnapshot(expectedSnapshot)) return null;
      if (expectedSceneId && expectedSnapshotSceneId && expectedSnapshotSceneId !== expectedSceneId) return null;
      if (window.S && typeof window.S === "object") {
        if (!window.S.combat || typeof window.S.combat !== "object") {
          window.S.combat = {};
        }
        window.S.combat.sceneEditor = deepCloneJson(expectedSnapshot) || expectedSnapshot;
        return window.S.combat.sceneEditor;
      }
      return expectedSnapshot;
    }
    if (hasRenderableCombatSceneEditorSnapshot(localScene) && (!expectedSceneId || localSceneId === expectedSceneId)) {
      return localScene;
    }
    var snapshot = sharedScene && sharedScene.sceneEditor && typeof sharedScene.sceneEditor === "object"
      ? (deepCloneJson(sharedScene.sceneEditor) || sharedScene.sceneEditor)
      : null;
    var snapshotSceneId = getCombatSceneEditorSnapshotActiveSceneId(snapshot);
    if (!hasRenderableCombatSceneEditorSnapshot(snapshot)) {
      return expectedSceneId ? null : (hasRenderableCombatSceneEditorSnapshot(localScene) ? localScene : null);
    }
    if (expectedSceneId && snapshotSceneId && snapshotSceneId !== expectedSceneId) return null;
    if (window.S && typeof window.S === "object") {
      if (!window.S.combat || typeof window.S.combat !== "object") {
        window.S.combat = {};
      }
      window.S.combat.sceneEditor = deepCloneJson(snapshot) || snapshot;
      return window.S.combat.sceneEditor;
    }
    return snapshot;
  }

  function joinSharedCampaignCombatMode() {
    var sceneSnapshot = getSharedCombatSceneEditorSnapshot();
    if (!sceneSnapshot) {
      if (state.role === "player") {
        var retryAt = Date.now();
        var shouldRetry = retryAt - Number(state.sharedVttJoinRetryAt || 0) > 900;
        state.sharedVttJoinRetryAt = retryAt;
        if (shouldRetry) {
          try {
            var retryRequest = requestResync();
            if (retryRequest && typeof retryRequest.catch === "function") {
              retryRequest.catch(function () {});
            }
          } catch (_resyncErr) {}
          setTimeout(function () {
            try {
              if (state.role === "player" && state.code && Date.now() - Number(state.sharedVttJoinRetryAt || 0) < 2500) {
                joinSharedCampaignCombatMode();
              }
            } catch (_retryErr) {}
          }, 320);
        }
        safeNotif("The shared VTT is still syncing from the GM. Reconnecting now...", "warn");
        return false;
      }
      if (typeof window.openCombatSceneEditorFromExpedition === "function") {
        try {
          window.openCombatSceneEditorFromExpedition();
          var overlay = document.getElementById("combatModeOverlay");
          if (overlay && overlay.classList.contains("open")) {
            safeNotif("Joined the shared Combat Mode scene.", "good");
            return true;
          }
        } catch (_fallbackErr) {}
      }
      safeNotif("The shared VTT is still syncing. Try again in a moment.", "warn");
      return false;
    }
    if (typeof window.applySharedCombatSceneEditorState !== "function") {
      safeNotif("Combat Mode is unavailable right now.", "warn");
      return false;
    }
    try {
      var opened = window.applySharedCombatSceneEditorState(sceneSnapshot, {
        autoOpen: true,
        sceneName: resolveSharedCombatSceneName()
      });
      if (!opened) {
        if (state.role === "player") {
          try {
            var retryRequest2 = requestResync();
            if (retryRequest2 && typeof retryRequest2.catch === "function") {
              retryRequest2.catch(function () {});
            }
          } catch (_resyncErr2) {}
        }
        safeNotif("Could not join the shared Combat Mode scene.", "warn");
        return false;
      }
      state.sharedVttJoinRetryAt = 0;
      safeNotif("Joined the shared Combat Mode scene.", "good");
      return true;
    } catch (_err) {
      safeNotif("Could not join the shared Combat Mode scene.", "warn");
      return false;
    }
  }

  function promptCampaignCombatModeInvite(vttSession) {
    var session = vttSession && typeof vttSession === "object" ? vttSession : {};
    var sceneName = String(session.sceneName || resolveSharedCombatSceneName() || "Campaign Shared Scene");
    var by = String(session.by || "GM");
    if (typeof window.openModal !== "function") {
      safeNotif(by + " opened " + sceneName + ". Use Enter Combat Mode to join the shared VTT.", "info");
      return;
    }
    window.joinSharedCampaignCombatModeFromPrompt = function () {
      var ok = joinSharedCampaignCombatMode();
      if (ok && typeof window.closeModal === "function") window.closeModal();
      return ok;
    };
    window.dismissSharedCampaignCombatModePrompt = function () {
      if (typeof window.closeModal === "function") window.closeModal();
    };
    var html = ''
      + '<div style="font-size:.84rem;color:var(--text2);line-height:1.6;">'
      + '<div style="margin-bottom:.45rem;"><strong>' + escapeHtml(by) + '</strong> opened the shared VTT scene:</div>'
      + '<div style="margin-bottom:.55rem;color:var(--teal);font-weight:700;">' + escapeHtml(sceneName) + '</div>'
      + '<div style="margin-bottom:.65rem;color:var(--muted2);">Join now to see the same battlemap, tokens, and enemy updates.</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:.4rem;">'
      + '<button class="btn btn-sm" onclick="window.dismissSharedCampaignCombatModePrompt&&window.dismissSharedCampaignCombatModePrompt()">Stay on Combat Tab</button>'
      + '<button class="btn btn-sm btn-teal" onclick="window.joinSharedCampaignCombatModeFromPrompt&&window.joinSharedCampaignCombatModeFromPrompt()">Join VTT</button>'
      + '</div>'
      + '</div>';
    window.openModal("Join Shared Combat Mode", html, null, { preventScroll: true, focusTrap: true });
  }

  function maybePromptSharedCombatModeFromScene(sharedCombat, sceneEditorState, syncMeta) {
    if (state.role !== "player") return false;
    var combatState = sharedCombat && typeof sharedCombat === "object" ? sharedCombat : null;
    var sceneState = sceneEditorState && typeof sceneEditorState === "object" ? sceneEditorState : null;
    if (!sceneState) return false;
    var overlay = document.getElementById("combatModeOverlay");
    if (overlay && overlay.classList.contains("open")) return false;
    var activeSceneId = String(sceneState.activeSceneId || "campaign-shared-scene");
    var sceneName = resolveSharedCombatSceneName();
    var vttSession = combatState.vttSession && typeof combatState.vttSession === "object"
      ? combatState.vttSession
      : {
          enteredAt: Number(syncMeta && syncMeta.at || combatState && combatState.startedAt || Date.now()),
          by: String(syncMeta && syncMeta.by || combatState && combatState.startedBy || "GM"),
          sceneName: sceneName,
          activeSceneId: activeSceneId
        };
    var promptKeyBase = String(Math.max(0, Number(combatState && combatState.startedAt || 0)) || activeSceneId || "campaign-shared-scene");
    var promptKey = [
      promptKeyBase,
      activeSceneId
    ].join("|");
    if (!promptKey || promptKey === state.lastCampaignScenePromptKey) return false;
    state.lastCampaignScenePromptKey = promptKey;
    var promptAt = Number(vttSession && vttSession.enteredAt || 0);
    if (promptAt > state.lastCampaignVttPromptAt) {
      state.lastCampaignVttPromptAt = promptAt;
    }
    promptCampaignCombatModeInvite(vttSession);
    return true;
  }

  function normalizeCampaignAreaSession(sessionLike) {
    var session = sessionLike && typeof sessionLike === "object" ? sessionLike : {};
    var payload = session.payload && typeof session.payload === "object"
      ? (deepCloneJson(session.payload) || session.payload)
      : {};
    return {
      id: String(session.id || ""),
      status: String(session.status || "closed"),
      kind: String(session.kind || ""),
      label: String(session.label || session.title || "Shared Area"),
      title: String(session.title || session.label || "Shared Area"),
      by: String(session.by || ""),
      openedAt: Math.max(0, Number(session.openedAt || 0)),
      updatedAt: Math.max(0, Number(session.updatedAt || 0)),
      payload: payload
    };
  }

  function resolveCampaignAreaModalTitle(session) {
    var normalized = normalizeCampaignAreaSession(session);
    return String(normalized.title || normalized.label || "Shared Area");
  }

  function isCampaignAreaSessionCurrent(session, sharedState) {
    var normalized = normalizeCampaignAreaSession(session);
    if (!normalized.id || normalized.status !== "open") return false;
    var shared = sharedState && typeof sharedState === "object" ? sharedState : getCampaignSharedState();
    var travel = shared && shared.campaignTravel && typeof shared.campaignTravel === "object"
      ? shared.campaignTravel
      : null;
    var travelAt = Math.max(0, Number(travel && travel.updatedAt || 0));
    if (!travelAt) return true;
    if (normalized.updatedAt >= travelAt) return true;
    return String(state.activeCampaignAreaSessionId || "") === normalized.id;
  }

  function computeCampaignAreaRenderHash(session, sharedState) {
    var normalized = normalizeCampaignAreaSession(session);
    if (!normalized.id || normalized.status !== "open") return "";
    var shared = sharedState && typeof sharedState === "object" ? sharedState : getCampaignSharedState();
    if (normalized.kind === "settlement-area") {
      return safeJsonHash({
        id: normalized.id,
        title: normalized.title,
        holding: shared && shared.holding && typeof shared.holding === "object" ? shared.holding : null
      });
    }
    if (normalized.kind === "province-area") {
      var payload = normalized.payload && typeof normalized.payload === "object" ? normalized.payload : {};
      var provinceMap = shared && shared.provinceMap && typeof shared.provinceMap === "object"
        ? shared.provinceMap
        : null;
      var mapData = provinceMap && Array.isArray(provinceMap.mapData) ? provinceMap.mapData : [];
      var hex = mapData.find(function (entry) {
        return !!(
          entry
          && Number(entry.col) === Number(payload.col)
          && Number(entry.row) === Number(payload.row)
        );
      }) || null;
      return safeJsonHash({
        id: normalized.id,
        title: normalized.title,
        areaType: String(payload.areaType || ""),
        hex: hex
      });
    }
    if (normalized.kind === "sea-area") {
      var seaPayload = normalized.payload && typeof normalized.payload === "object" ? normalized.payload : {};
      var seaState = shared && shared.lastSea && typeof shared.lastSea === "object" ? shared.lastSea : null;
      var seaMap = seaState && Array.isArray(seaState.map) ? seaState.map : [];
      var seaHex = seaMap.find(function (entry) {
        return !!(
          entry
          && Number(entry.col) === Number(seaPayload.col)
          && Number(entry.row) === Number(seaPayload.row)
        );
      }) || null;
      return safeJsonHash({
        id: normalized.id,
        title: normalized.title,
        areaType: String(seaPayload.areaType || ""),
        hex: seaHex
      });
    }
    if (normalized.kind === "planet-area") {
      var planetPayload = normalized.payload && typeof normalized.payload === "object" ? normalized.payload : {};
      var starState = shared && shared.starSystem && typeof shared.starSystem === "object" ? shared.starSystem : null;
      var hexes = starState && Array.isArray(starState.hexes) ? starState.hexes : [];
      var activePlanetHex = hexes.find(function (entry) {
        return !!(entry && Number(entry.id) === Number(planetPayload.planetHexId));
      }) || null;
      var surface = activePlanetHex && activePlanetHex.surface && typeof activePlanetHex.surface === "object"
        ? activePlanetHex.surface
        : null;
      var cells = surface && Array.isArray(surface.cells) ? surface.cells : [];
      var planetCell = cells.find(function (entry) {
        return !!(entry && Number(entry.id) === Number(planetPayload.cellId));
      }) || null;
      return safeJsonHash({
        id: normalized.id,
        title: normalized.title,
        areaType: String(planetPayload.areaType || ""),
        planetHexId: Number(planetPayload.planetHexId || 0),
        cell: planetCell
      });
    }
    if (normalized.kind === "galaxy-area") {
      var galaxyPayload = normalized.payload && typeof normalized.payload === "object" ? normalized.payload : {};
      var galaxyState = shared && shared.starSystem && typeof shared.starSystem === "object" ? shared.starSystem : null;
      var galaxyAreaType = String(galaxyPayload.areaType || "");
      var galaxyView = null;
      if (galaxyAreaType === "facility") {
        galaxyView = galaxyState && galaxyState.activeFacility ? galaxyState.activeFacility : null;
      } else if (galaxyAreaType === "deadmoon") {
        galaxyView = {
          activeDeadMoon: galaxyState && galaxyState.activeDeadMoon ? galaxyState.activeDeadMoon : null,
          activeDeadMoonMap: galaxyState && galaxyState.activeDeadMoonMap ? galaxyState.activeDeadMoonMap : null
        };
      } else if (galaxyAreaType === "derelict") {
        galaxyView = galaxyState && galaxyState.activeDerelict ? galaxyState.activeDerelict : null;
      }
      return safeJsonHash({
        id: normalized.id,
        title: normalized.title,
        areaType: galaxyAreaType,
        hexId: Number(galaxyPayload.hexId || 0),
        view: galaxyView
      });
    }
    if (normalized.kind === "yessod-area") {
      var yessodPayload = normalized.payload && typeof normalized.payload === "object" ? normalized.payload : {};
      var sharedStar = shared && shared.starSystem && typeof shared.starSystem === "object" ? shared.starSystem : null;
      var yessodState = sharedStar && sharedStar.yessod && typeof sharedStar.yessod === "object"
        ? sharedStar.yessod
        : null;
      var yessodCells = yessodState && Array.isArray(yessodState.cells) ? yessodState.cells : [];
      var yessodCell = yessodCells.find(function (entry) {
        return !!(entry && Number(entry.id) === Number(yessodPayload.cellId || yessodState && yessodState.selectedCellId || 0));
      }) || null;
      return safeJsonHash({
        id: normalized.id,
        title: normalized.title,
        areaType: String(yessodPayload.areaType || "map"),
        currentStrata: Number(yessodState && yessodState.currentStrata || 1),
        currentWeather: yessodState && yessodState.currentWeather ? yessodState.currentWeather : null,
        selectedCellId: Number(yessodPayload.cellId || yessodState && yessodState.selectedCellId || 0),
        cell: yessodCell,
        lastEncounter: String(yessodState && yessodState.lastEncounter || "")
      });
    }
    return safeJsonHash(normalized);
  }

  function isCampaignAreaModalShowing(session) {
    var overlay = document.getElementById("rollModal");
    if (!overlay || !overlay.classList.contains("open")) return false;
    var titleEl = document.getElementById("modalTitle");
    var currentTitle = String(titleEl && titleEl.textContent || "");
    return currentTitle === resolveCampaignAreaModalTitle(session);
  }

  function openSharedCampaignAreaSession(session, opts) {
    var normalized = normalizeCampaignAreaSession(session);
    if (!normalized.id || normalized.status !== "open") return false;
    var options = opts && typeof opts === "object" ? opts : {};
    var payload = normalized.payload && typeof normalized.payload === "object" ? normalized.payload : {};
    var opened = false;
    try {
      if (normalized.kind === "settlement-area") {
        if (typeof window.openHoldingSettlementHexcrawlFromSharedState === "function") {
          window.openHoldingSettlementHexcrawlFromSharedState();
          opened = true;
        }
      } else if (normalized.kind === "province-area") {
        if (typeof window.openProvinceAreaFromSharedSession === "function") {
          opened = window.openProvinceAreaFromSharedSession(
            String(payload.areaType || ""),
            Number(payload.col || 0),
            Number(payload.row || 0)
          ) !== false;
        }
      } else if (normalized.kind === "sea-area") {
        if (typeof window.openSeaAreaFromSharedSession === "function") {
          opened = window.openSeaAreaFromSharedSession(
            String(payload.areaType || ""),
            Number(payload.col || 0),
            Number(payload.row || 0)
          ) !== false;
        }
      } else if (normalized.kind === "planet-area") {
        if (typeof window.openPlanetAreaFromSharedSession === "function") {
          opened = window.openPlanetAreaFromSharedSession(
            String(payload.areaType || ""),
            Number(payload.planetHexId || 0),
            Number(payload.cellId || 0)
          ) !== false;
        }
      } else if (normalized.kind === "galaxy-area") {
        if (typeof window.openGalaxyAreaFromSharedSession === "function") {
          opened = window.openGalaxyAreaFromSharedSession(
            String(payload.areaType || ""),
            Number(payload.hexId || 0)
          ) !== false;
        }
      } else if (normalized.kind === "yessod-area") {
        if (typeof window.openYessodAreaFromSharedSession === "function") {
          opened = window.openYessodAreaFromSharedSession(
            String(payload.areaType || "map"),
            Number(payload.cellId || 0)
          ) !== false;
        }
      }
    } catch (_err) {
      opened = false;
    }
    if (!opened) return false;
    state.activeCampaignAreaSessionId = normalized.id;
    state.activeCampaignAreaRenderHash = computeCampaignAreaRenderHash(normalized, getCampaignSharedState());
    if (!options.quiet) {
      safeNotif("Joined shared area: " + resolveCampaignAreaModalTitle(normalized) + ".", "good");
    }
    return true;
  }

  function joinSharedCampaignAreaSessionFromPrompt() {
    var shared = getCampaignSharedState();
    var session = shared && shared.areaSession && typeof shared.areaSession === "object"
      ? shared.areaSession
      : null;
    if (!session || String(session.status || "") !== "open") {
      safeNotif("The shared area is no longer active.", "warn");
      return false;
    }
    return openSharedCampaignAreaSession(session, { quiet: false });
  }

  function promptCampaignAreaSessionInvite(session) {
    var normalized = normalizeCampaignAreaSession(session);
    if (!normalized.id || normalized.status !== "open") return false;
    var areaTitle = resolveCampaignAreaModalTitle(normalized);
    window.joinSharedCampaignAreaSessionFromPrompt = joinSharedCampaignAreaSessionFromPrompt;
    if (typeof window.openCampaignAreaJoinPrompt === "function") {
      window.openCampaignAreaJoinPrompt(areaTitle, function () {
        return joinSharedCampaignAreaSessionFromPrompt();
      });
      return true;
    }
    if (typeof window.openModal !== "function") {
      safeNotif((normalized.by || "GM") + " opened " + areaTitle + ". Join the shared area to keep pace.", "info");
      return false;
    }
    var html = ''
      + '<div style="font-size:.84rem;color:var(--text2);line-height:1.6;">'
      + '<div style="margin-bottom:.45rem;"><strong>' + escapeHtml(String(normalized.by || "GM")) + '</strong> opened a shared area:</div>'
      + '<div style="margin-bottom:.55rem;color:var(--teal);font-weight:700;">' + escapeHtml(areaTitle) + '</div>'
      + '<div style="margin-bottom:.65rem;color:var(--muted2);">Join now to see the same shared exploration space the GM is using.</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:.4rem;">'
      + '<button class="btn btn-sm" onclick="window.closeModal&&window.closeModal()">Stay Here</button>'
      + '<button class="btn btn-sm btn-teal" onclick="window.closeModal&&window.closeModal();window.joinSharedCampaignAreaSessionFromPrompt&&window.joinSharedCampaignAreaSessionFromPrompt()">Join Area</button>'
      + '</div>'
      + '</div>';
    window.openModal("Join Shared Area", html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function maybeHandleSharedAreaSession(areaSession, sharedState) {
    var session = normalizeCampaignAreaSession(areaSession);
    if (!session.id || session.status !== "open") {
      if (String(state.activeCampaignAreaSessionId || "") === String(session.id || "")) {
        state.activeCampaignAreaSessionId = "";
        state.activeCampaignAreaRenderHash = "";
        if (state.role === "player" && isCampaignAreaModalShowing(session) && typeof window.closeModal === "function") {
          try { window.closeModal(); } catch (_err) {}
        }
      }
      return false;
    }
    if (!isCampaignAreaSessionCurrent(session, sharedState)) {
      if (String(state.activeCampaignAreaSessionId || "") === String(session.id || "")) {
        state.activeCampaignAreaSessionId = "";
        state.activeCampaignAreaRenderHash = "";
        if (state.role === "player" && isCampaignAreaModalShowing(session) && typeof window.closeModal === "function") {
          try { window.closeModal(); } catch (_err2) {}
        }
      }
      return false;
    }

    if (state.role === "player" && String(state.activeCampaignAreaSessionId || "") === session.id) {
      var supportsPassiveRefresh = session.kind === "galaxy-area" || session.kind === "yessod-area";
      if (!supportsPassiveRefresh && !isCampaignAreaModalShowing(session)) return false;
      var nextRenderHash = computeCampaignAreaRenderHash(session, sharedState);
      if (!nextRenderHash || nextRenderHash === String(state.activeCampaignAreaRenderHash || "")) return false;
      return openSharedCampaignAreaSession(session, { quiet: true });
    }

    if (state.role !== "player") return false;
    var promptKey = [String(session.id || ""), String(Math.max(0, Number(session.openedAt || 0)))].join("|");
    if (!promptKey || promptKey === state.lastCampaignAreaPromptKey) return false;
    state.lastCampaignAreaPromptKey = promptKey;
    return promptCampaignAreaSessionInvite(session);
  }

  function cloneClientLocalSeaState() {
    if (typeof window.S === "undefined" || !window.S || !window.S.lastSea || typeof window.S.lastSea !== "object") return null;
    return {
      selectedKey: window.S.lastSea.selectedKey || "",
      activeDungeon: deepCloneJson(window.S.lastSea.activeDungeon || null),
      activeEncounterKey: window.S.lastSea.activeEncounterKey || "",
      weather: deepCloneJson(window.S.lastSea.weather || null)
    };
  }

  function cloneClientLocalProvinceState() {
    var key = "";
    if (typeof window.getProvinceSelectedKey === "function") {
      try { key = String(window.getProvinceSelectedKey() || ""); } catch (_err) { key = ""; }
    }
    return {
      selectedKey: key
    };
  }

  function buildProvinceSharedSnapshot(selectedKey) {
    if (typeof window.getProvinceMapState !== "function") return null;
    try {
      var provinceMap = deepCloneJson(window.getProvinceMapState() || null);
      if (!provinceMap || !Array.isArray(provinceMap.mapData) || !provinceMap.mapData.length) {
        return null;
      }
      var resolvedKey = String(
        selectedKey
        || provinceMap.selectedKey
        || (typeof window.getProvinceSelectedKey === "function" ? window.getProvinceSelectedKey() || "" : "")
      );
      if (resolvedKey) {
        provinceMap.selectedKey = resolvedKey;
      }
      return provinceMap;
    } catch (_err) {
      return null;
    }
  }

  function applyClientLocalProvinceState(snapshot) {
    if (!snapshot || !snapshot.selectedKey) return;
    if (typeof window.setProvinceSelectedKey !== "function") return;
    try { window.setProvinceSelectedKey(String(snapshot.selectedKey || "")); } catch (_err) {}
  }

  function resolveProvinceSelectionKeyForSharedState(sharedState, localProvinceState, incomingProvinceMap) {
    var shared = sharedState && typeof sharedState === "object" ? sharedState : null;
    var travel = shared && shared.campaignTravel && typeof shared.campaignTravel === "object"
      ? shared.campaignTravel
      : null;
    var incoming = incomingProvinceMap && typeof incomingProvinceMap === "object"
      ? incomingProvinceMap
      : null;
    var localKey = localProvinceState && localProvinceState.selectedKey
      ? String(localProvinceState.selectedKey || "")
      : "";
    var travelKey = travel && String(travel.tab || "") === "map"
      ? String(travel.provinceKey || "")
      : "";

    if (state.role === "gm") {
      if (localKey) return localKey;
      if (travelKey) return travelKey;
      return incoming ? String(incoming.selectedKey || "") : "";
    }
    if (travelKey && isStrictGmCameraLockEnabled(shared)) {
      return travelKey;
    }
    if (localKey) return localKey;
    if (travelKey) return travelKey;
    return incoming ? String(incoming.selectedKey || "") : "";
  }

  function normalizeCombatSceneEnemiesForSharedState(enemies, combatState) {
    var list = Array.isArray(enemies) ? enemies : [];
    var defaultDread = Math.max(4, Number(combatState && combatState.enemyDread || 8));
    return list.map(function (entry) {
      if (!entry || typeof entry !== "object") return entry;
      var row = deepCloneJson(entry) || {};
      if (!Number.isFinite(Number(row.dread)) || Number(row.dread) <= 0) {
        row.dread = defaultDread;
      }
      return row;
    });
  }

  function getUniformHostileEnemyDread(enemies) {
    var list = Array.isArray(enemies) ? enemies : [];
    var uniform = 0;
    for (var i = 0; i < list.length; i += 1) {
      var enemy = list[i];
      if (!enemy || enemy.ally) continue;
      var dread = Math.max(0, Number(enemy.dread || 0));
      if (!dread) return 0;
      if (!uniform) {
        uniform = dread;
        continue;
      }
      if (uniform !== dread) return 0;
    }
    return uniform;
  }

  function resolveCombatEnemyDread(combatState, enemies) {
    var explicitDread = Math.max(0, Number(combatState && combatState.enemyDread || 0));
    if (explicitDread > 0) return explicitDread;
    return getUniformHostileEnemyDread(enemies);
  }

  function applyClientLocalSeaState(snapshot) {
    if (!snapshot || typeof window.S === "undefined" || !window.S || !window.S.lastSea || typeof window.S.lastSea !== "object") return;
    if (snapshot.selectedKey) window.S.lastSea.selectedKey = snapshot.selectedKey;
    if (snapshot.activeDungeon) window.S.lastSea.activeDungeon = snapshot.activeDungeon;
    if (snapshot.activeEncounterKey) window.S.lastSea.activeEncounterKey = snapshot.activeEncounterKey;
    if (snapshot.weather) window.S.lastSea.weather = snapshot.weather;
  }

  function applyCampaignTravelState(travelState, opts) {
    var travel = travelState && typeof travelState === "object" ? travelState : null;
    if (!travel) return;
    var options = opts || {};
    var travelAt = Number(travel.updatedAt || 0) || 0;
    if (!options.force && !travelAt) return;
    if (!options.force && travelAt && travelAt <= Number(state.lastCampaignTravelAppliedAt || 0)) return;

    var context = String(travel.context || "");
    var tab = String(travel.tab || "");
    var provinceKey = String(travel.provinceKey || "");
    var handledWorldThatWas = false;
    var activeContext = getActiveContextId();
    var activeTab = getActiveTabId();
    var activeProvinceKey = (typeof window.getProvinceSelectedKey === "function")
      ? String(window.getProvinceSelectedKey() || "")
      : "";
    var sharedCombat = getCampaignSharedState().campaignCombat && typeof getCampaignSharedState().campaignCombat === "object"
      ? getCampaignSharedState().campaignCombat
      : null;
    var playerSharedVttPrompt = false;
    var playerSharedVttSession = null;

    if (tab === "scenes" && state.role === "player" && sharedCombat && sharedCombat.active) {
      var sceneEditorState = window.S && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object"
        ? window.S.combat.sceneEditor
        : null;
      var fallbackSceneName = resolveSharedCombatSceneName();
      var fallbackSceneId = String(
        sceneEditorState && sceneEditorState.activeSceneId
          || (sharedCombat.vttSession && sharedCombat.vttSession.activeSceneId)
          || "campaign-shared-scene"
      );
      playerSharedVttPrompt = true;
      playerSharedVttSession = sharedCombat.vttSession && typeof sharedCombat.vttSession === "object"
        ? sharedCombat.vttSession
        : {
            enteredAt: travelAt || Date.now(),
            by: String(travel.movedBy || "GM"),
            sceneName: fallbackSceneName,
            activeSceneId: fallbackSceneId
          };
    }

    var preservePlayerCombatTab = state.role === "player"
      && sharedCombat
      && sharedCombat.active
      && activeTab === "combat"
      && tab
      && tab !== "combat"
      && tab !== "scenes";

    if (preservePlayerCombatTab) {
      if (travelAt) {
        state.lastCampaignTravelAppliedAt = travelAt;
      }
      return;
    }

    var preservePlayerPersonalTab = state.role === "player"
      && !options.force
      && !playerSharedVttPrompt
      && tab !== "combat"
      && tab !== "scenes"
      && Math.max(0, Number(travel.phaseCost || 0) || 0) <= 0
      && !isPlayerViewOutOfLock(travel);

    if (preservePlayerPersonalTab) {
      if (travelAt) {
        state.lastCampaignTravelAppliedAt = travelAt;
      }
      return;
    }

    if (context && context !== activeContext && typeof window.setContext === "function") {
      try {
        var ctxBtn = document.querySelector('.ctx-btn[data-ctx="' + context + '"]');
        window.setContext(context, ctxBtn || null);
      } catch (_err) {}
    }

    if (tab) {
      try {
        if (tab === "worldthatwas" && activeTab !== "worldthatwas" && typeof window.openWorldThatWasFromGalaxy === "function") {
          window.openWorldThatWasFromGalaxy();
          handledWorldThatWas = true;
        } else if (!playerSharedVttPrompt && tab !== activeTab && typeof window.switchTab === "function") {
          var btn = document.querySelector('#mainNav .tab-btn[onclick*="switchTab(\'' + tab + '\'"]');
          window.switchTab(tab, btn || null);
        }
      } catch (_err) {}
    }

    if (!handledWorldThatWas && tab === "worldthatwas" && typeof window.mountWorldThatWasPanel === "function") {
      try {
        window.mountWorldThatWasPanel();
        if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
      } catch (_err) {}
    }

    if (playerSharedVttPrompt) {
      var promptAt = Number(playerSharedVttSession && playerSharedVttSession.enteredAt || travelAt || 0);
      if (promptAt && promptAt !== state.lastCampaignVttPromptAt) {
        state.lastCampaignVttPromptAt = promptAt;
        promptCampaignCombatModeInvite(playerSharedVttSession);
      }
    } else if (tab === "scenes" && typeof window.applySharedCombatSceneEditorState === "function") {
      try {
        if (window.S && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object") {
          window.applySharedCombatSceneEditorState(window.S.combat.sceneEditor, {
            autoOpen: true,
            sceneName: resolveSharedCombatSceneName()
          });
        }
      } catch (_err) {}
    }

    if (provinceKey && provinceKey !== activeProvinceKey && typeof window.setProvinceSelectedKey === "function") {
      try { window.setProvinceSelectedKey(provinceKey); } catch (_err) {}
    }

    if (travelAt) {
      state.lastCampaignTravelAppliedAt = travelAt;
    }
  }

  function getNavigationSyncSuppressUntil() {
    return Math.max(
      Number(state.navigationSyncSuppressUntil || 0),
      Number(window.__campaignNavigationSyncSuppressUntil || 0)
    );
  }

  function isNavigationSyncSuppressed() {
    return getNavigationSyncSuppressUntil() > Date.now();
  }

  function suppressNavigationSync(durationMs) {
    var until = Date.now() + Math.max(0, Number(durationMs || 0));
    state.navigationSyncSuppressUntil = until;
    window.__campaignNavigationSyncSuppressUntil = until;
    return until;
  }

  function patchCameraLockHooks() {
    if (window._campaignPatchedCameraLockHooks) return;

    var pendingNavigationSync = null;
    var pendingNavigationTimer = 0;

    function syncCampaignNavigationState(nextContext, nextTab) {
      if (!state.socket || !state.connected || !state.code) return;
      if (state.role !== "gm") return;
      if (isNavigationSyncSuppressed()) return;
      if (state.applyingSharedState) {
        pendingNavigationSync = {
          context: String(nextContext || ""),
          tab: String(nextTab || "")
        };
        if (!pendingNavigationTimer) {
          pendingNavigationTimer = setTimeout(function () {
            pendingNavigationTimer = 0;
            var queued = pendingNavigationSync;
            pendingNavigationSync = null;
            if (!queued) return;
            syncCampaignNavigationState(queued.context, queued.tab);
          }, 80);
        }
        return;
      }
      var shared = getMutableCampaignSharedState();
      var travel = shared && shared.campaignTravel && typeof shared.campaignTravel === "object"
        ? shared.campaignTravel
        : ensureCampaignTravelState(shared);
      var context = String(nextContext || travel.context || "traveling");
      var tab = String(nextTab || travel.tab || "");
      travel.context = context;
      if (tab) travel.tab = tab;
      if (context === "space") travel.region = "space";
      else if (context === "sea") travel.region = "sea";
      else if (context === "holding") travel.region = "province";
      else travel.region = String(travel.region || "province");
      if (!travel.label || tab) {
        var tabBtn = tab ? document.getElementById("tabnav-" + tab) : null;
        travel.label = String((tabBtn && tabBtn.textContent) || travel.label || tab || "Province Map");
      }
      travel.movedBy = String(state.playerName || ensureName() || "GM");
      travel.reason = "navigation";
      travel.phaseCost = 0;
      if (String(travel.tab || "") !== "map") {
        travel.provinceKey = "";
      }
      travel.updatedAt = Date.now();
      var out = syncSharedPatch({ campaignTravel: deepCloneJson(travel) || travel }, "navigation-state");
      if (out && typeof out.catch === "function") out.catch(function () {});
    }

    if (typeof window.switchTab === "function") {
      var baseSwitchTab = window.switchTab;
      window.switchTab = function () {
        var suppressCampaignSync = !!window.__campaignSuppressNavigationSync || isNavigationSyncSuppressed();
        var out = baseSwitchTab.apply(this, arguments);
        if (!!window.__campaignSuppressNavigationSync) window.__campaignSuppressNavigationSync = false;
        if (state.applyingSharedState || suppressCampaignSync) return out;
        syncCampaignNavigationState(window._activeContext || "", String(arguments[0] || ""));
        scheduleGmCameraSync("switch-tab", true);
        return out;
      };
    }

    if (typeof window.setContext === "function") {
      var baseSetContext = window.setContext;
      window.setContext = function () {
        var suppressCampaignSync = !!window.__campaignSuppressNavigationSync || isNavigationSyncSuppressed();
        var out = baseSetContext.apply(this, arguments);
        if (!!window.__campaignSuppressNavigationSync) window.__campaignSuppressNavigationSync = false;
        if (state.applyingSharedState || suppressCampaignSync) return out;
        var currentTabBtn = document.querySelector('#mainNavTablist .tab-btn.active[data-tab]');
        syncCampaignNavigationState(String(arguments[0] || window._activeContext || ""), currentTabBtn ? String(currentTabBtn.getAttribute("data-tab") || "") : "");
        scheduleGmCameraSync("set-context", true);
        return out;
      };
    }

    if (typeof window.setProvinceSelectedKey === "function") {
      var baseSetProvinceSelectedKey = window.setProvinceSelectedKey;
      window.setProvinceSelectedKey = function () {
        var out = baseSetProvinceSelectedKey.apply(this, arguments);
        if (state.applyingSharedState) return out;
        if (out && state.role === "gm") {
          try {
            state.lastCameraViewHash = cameraViewHash(buildCameraViewSnapshot());
          } catch (_err) {}
          syncProvinceFocus("province-focus").catch(function () {});
        } else if (out) {
          scheduleGmCameraSync("province-focus", false);
        }
        return out;
      };
    }

    window._campaignPatchedCameraLockHooks = true;
  }

  function sanitizePlayerSharedPatch(patch) {
    if (!patch || typeof patch !== "object") return {};
    var sanitized = {};
    Object.keys(patch).forEach(function (key) {
      if (PLAYER_LOCAL_ONLY_KEYS[key]) return;
      if (!PLAYER_SHARED_PATCH_KEYS[key]) return;
      if ((key === "provinceMap" || key === "campaignCombat") && (!patch[key] || typeof patch[key] !== "object")) return;
      if (key === "campaignCombat") {
        var combatPatch = patch.campaignCombat && typeof patch.campaignCombat === "object"
          ? (deepCloneJson(patch.campaignCombat) || {})
          : null;
        var sharedCombat = ensureCampaignCombatState(getCampaignSharedState() || getMutableCampaignSharedState());
        var liveEnemyRequest = getCampaignEnemyActionRequest(sharedCombat);
        var incomingEnemyRequest = combatPatch && combatPatch.enemyActionRequest && typeof combatPatch.enemyActionRequest === "object"
          ? combatPatch.enemyActionRequest
          : null;
        var canResolveEnemyRequest = !!(
          combatPatch
          && incomingEnemyRequest
          && sharedCombat
          && sharedCombat.active
          && String(sharedCombat.phase || "wayfarer") === "enemy"
          && liveEnemyRequest
          && state.role === "player"
          && state.token
          && String(incomingEnemyRequest.id || "") === String(liveEnemyRequest.id || "")
          && isCampaignEnemyActionTargetToken(liveEnemyRequest, state.token)
        );
        if (!canResolveEnemyRequest) return;
        var nextEnemyRequest = deepCloneJson(liveEnemyRequest) || liveEnemyRequest;
        nextEnemyRequest.resolutionSummary = String(incomingEnemyRequest.resolutionSummary || "").trim().slice(0, 240);
        nextEnemyRequest.lastResolvedByToken = String(state.token || "");
        nextEnemyRequest.lastResolvedBy = String(state.playerName || ensureName() || "Wayfarer");
        nextEnemyRequest.lastResolvedAt = Date.now();
        if (String(nextEnemyRequest.mode || "single") === "aoe") {
          var resolvedMap = {};
          (Array.isArray(nextEnemyRequest.resolvedTokens) ? nextEnemyRequest.resolvedTokens : []).forEach(function (token) {
            var keyResolved = String(token || "");
            if (keyResolved) resolvedMap[keyResolved] = true;
          });
          resolvedMap[String(state.token || "")] = true;
          nextEnemyRequest.resolvedTokens = getCampaignEnemyActionTargetTokens(nextEnemyRequest).filter(function (token) {
            return !!resolvedMap[String(token || "")];
          });
          nextEnemyRequest.status = nextEnemyRequest.resolvedTokens.length >= getCampaignEnemyActionTargetTokens(nextEnemyRequest).length
            ? "resolved"
            : "pending";
        } else {
          nextEnemyRequest.resolvedByToken = String(state.token || "");
          nextEnemyRequest.resolvedBy = String(state.playerName || ensureName() || "Wayfarer");
          nextEnemyRequest.resolvedAt = Date.now();
          nextEnemyRequest.resolvedTokens = [String(state.token || "")];
          nextEnemyRequest.status = "resolved";
        }
        sanitized.campaignCombat = {
          enemyActionRequest: sanitizeCampaignEnemyActionRequest(nextEnemyRequest, sharedCombat)
        };
        return;
      }
      if (key === "combatScene") {
        var combatScenePatch = patch.combatScene && typeof patch.combatScene === "object"
          ? (deepCloneJson(patch.combatScene) || null)
          : null;
        var sharedForCombatScene = getCampaignSharedState();
        var sharedCombatState = sharedForCombatScene && sharedForCombatScene.campaignCombat && typeof sharedForCombatScene.campaignCombat === "object"
          ? sharedForCombatScene.campaignCombat
          : null;
        var activeCombatToken = String(getCampaignCombatActiveToken(sharedCombatState) || "");
        var canMutateCombatScene = !!(
          state.token
          && state.role === "player"
          && sharedCombatState
          && sharedCombatState.active
          && String(sharedCombatState.phase || "wayfarer") === "wayfarer"
          && activeCombatToken
          && activeCombatToken === String(state.token || "")
        );
        if (!combatScenePatch || !canMutateCombatScene) return;
        combatScenePatch.syncMeta = {
          by: String(state.playerName || ensureName() || "Wayfarer"),
          at: Date.now()
        };
        sanitized.combatScene = combatScenePatch;
        return;
      }
      if (key === "readyCheck") {
        var readyPatch = patch.readyCheck && typeof patch.readyCheck === "object" ? patch.readyCheck : null;
        var response = readyPatch && readyPatch.response && typeof readyPatch.response === "object" ? readyPatch.response : null;
        if (!readyPatch || !response) return;
        if (!state.token || String(response.token || "") !== String(state.token)) return;
        sanitized.readyCheck = {
          id: String(readyPatch.id || ""),
          response: {
            token: String(state.token),
            ready: !!response.ready,
            name: String(response.name || state.playerName || ensureName() || "Wayfarer"),
            at: Number(response.at || Date.now()) || Date.now()
          }
        };
        return;
      }
      if (key === "pendingChecks") {
        var pendingPatch = patch.pendingChecks && typeof patch.pendingChecks === "object" ? patch.pendingChecks : null;
        var submission = pendingPatch && pendingPatch.submission && typeof pendingPatch.submission === "object" ? pendingPatch.submission : null;
        if (!pendingPatch || !submission) return;
        if (!state.token || String(submission.token || state.token || "") !== String(state.token)) return;
        sanitized.pendingChecks = {
          id: String(pendingPatch.id || ""),
          submission: buildPendingCheckSubmission(submission)
        };
        return;
      }
      if (key === "characterInventories") {
        if (!state.token || !patch.characterInventories || typeof patch.characterInventories !== "object") return;
        if (!Object.prototype.hasOwnProperty.call(patch.characterInventories, state.token)) return;
        sanitized.characterInventories = {};
        sanitized.characterInventories[state.token] = deepCloneJson(patch.characterInventories[state.token]) || [];
        return;
      }
      sanitized[key] = deepCloneJson(patch[key]);
    });
    return sanitized;
  }

  function ensureCampaignTravelState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.campaignTravel || typeof sharedState.campaignTravel !== "object") {
      sharedState.campaignTravel = {
        region: "province",
        context: "traveling",
        tab: "map",
        label: "Province Map",
        provinceKey: "",
        movedBy: "",
        reason: "",
        phaseCost: 0,
        updatedAt: 0
      };
    }
    return sharedState.campaignTravel;
  }

  function collectCombatSceneState() {
    if (typeof window.S === "undefined" || !window.S) {
      return { combat: {}, enemies: [], naval: null, caravan: null, combatMap: null, combatAugState: null, sceneEditor: null, syncMeta: null };
    }
    var shared = getCampaignSharedState();
    var sharedScene = shared && shared.combatScene && typeof shared.combatScene === "object" ? shared.combatScene : null;
    var existingMeta = (window.S.combat && window.S.combat.sceneSyncMeta && typeof window.S.combat.sceneSyncMeta === "object")
      ? window.S.combat.sceneSyncMeta
      : (sharedScene && sharedScene.syncMeta && typeof sharedScene.syncMeta === "object" ? sharedScene.syncMeta : null);
    var combatSnapshot = deepCloneJson(window.S.combat || {}) || {};
    var normalizedEnemies = normalizeCombatSceneEnemiesForSharedState(window.S.enemies, combatSnapshot);
    var resolvedEnemyDread = resolveCombatEnemyDread(combatSnapshot, normalizedEnemies);
    if (resolvedEnemyDread > 0) {
      combatSnapshot.enemyDread = resolvedEnemyDread;
    }
    return {
      combat: combatSnapshot,
      enemies: normalizedEnemies,
      naval: window.S.naval ? (deepCloneJson(window.S.naval) || null) : null,
      caravan: window.S.caravan ? (deepCloneJson(window.S.caravan) || null) : null,
      combatMap: (window.S.combatMap && typeof window.S.combatMap === "object") ? (deepCloneJson(window.S.combatMap) || null) : null,
      combatAugState: (window.S.combatAugState && typeof window.S.combatAugState === "object") ? (deepCloneJson(window.S.combatAugState) || null) : null,
      sceneEditor: (window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object")
        ? (deepCloneJson(window.S.combat.sceneEditor) || null)
        : null,
      syncMeta: existingMeta ? (deepCloneJson(existingMeta) || null) : null
    };
  }

  function hashCombatSceneState(scene) {
    try {
      return JSON.stringify(scene || { combat: {}, enemies: [] });
    } catch (_err) {
      return "";
    }
  }

  function getCombatSceneAutoSyncSuppressUntil() {
    return Math.max(
      Number(state.combatSceneAutoSyncSuppressUntil || 0),
      Number(window.__campaignCombatSceneAutoSyncSuppressUntil || 0)
    );
  }

  function isCombatSceneAutoSyncSuppressed() {
    return getCombatSceneAutoSyncSuppressUntil() > Date.now();
  }

  function setCombatSceneAutoSyncSuppression(durationMs) {
    var until = Date.now() + Math.max(0, Number(durationMs || 0));
    state.combatSceneAutoSyncSuppressUntil = until;
    window.__campaignCombatSceneAutoSyncSuppressUntil = until;
    return until;
  }

  function bumpCombatSceneSyncGeneration() {
    state.combatSceneSyncGeneration = Math.max(0, Number(state.combatSceneSyncGeneration || 0)) + 1;
    window.__campaignCombatSceneSyncGeneration = state.combatSceneSyncGeneration;
    return state.combatSceneSyncGeneration;
  }

  function clearQueuedCombatSceneSync() {
    if (state.combatSceneSyncTimer) {
      clearTimeout(state.combatSceneSyncTimer);
      state.combatSceneSyncTimer = null;
    }
  }

  function attachCombatSceneSyncMeta(target, syncGeneration, isAutoSync) {
    if (!target || typeof target !== "object") return target;
    var generation = Math.max(0, Number(syncGeneration || 0));
    try {
      Object.defineProperty(target, "__combatSceneSyncGeneration", {
        value: generation,
        enumerable: false,
        configurable: true
      });
    } catch (_err) {}
    if (isAutoSync) {
      try {
        Object.defineProperty(target, "__combatSceneAutoSync", {
          value: true,
          enumerable: false,
          configurable: true
        });
      } catch (_err2) {}
    }
    return target;
  }

  function prepareOutgoingCombatScenePatch(patch) {
    if (!patch || typeof patch !== "object" || !patch.combatScene || typeof patch.combatScene !== "object") {
      return patch;
    }
    var isAutoSync = !!patch.__combatSceneAutoSync;
    clearQueuedCombatSceneSync();
    var syncGeneration = bumpCombatSceneSyncGeneration();
    setCombatSceneAutoSyncSuppression(350);
    var mergedPatch = mergeCombatScenePatchWithCurrent(patch);
    var mergedScene = mergedPatch && mergedPatch.combatScene && typeof mergedPatch.combatScene === "object"
      ? mergedPatch.combatScene
      : null;
    if (mergedScene) {
      state.lastCombatSceneHash = hashCombatSceneState(mergedScene);
    }
    return attachCombatSceneSyncMeta(mergedPatch, syncGeneration, isAutoSync);
  }

  function refreshSharedCombatSceneUI() {
    if (typeof window.setEnemyDread === "function") {
      try { window.setEnemyDread(Number(window.S && window.S.combat && window.S.combat.enemyDread || 8) || 8); } catch (_err) {}
    }
    if (typeof window.updateCombatUI === "function") {
      try { window.updateCombatUI(); } catch (_err) {}
    }
    if (typeof window.renderEnemies === "function") {
      try { window.renderEnemies(); } catch (_err) {}
    }
    if (typeof window.renderCombatMap === "function") {
      try { window.renderCombatMap(); } catch (_err) {}
    }
    if (typeof window.renderCombatOptions === "function") {
      try { window.renderCombatOptions(); } catch (_err) {}
    }
    if (typeof window.updateSkirmishActionUI === "function") {
      try { window.updateSkirmishActionUI("A"); } catch (_err) {}
      try { window.updateSkirmishActionUI("B"); } catch (_err) {}
    }
    if (typeof window.updateSkirmishRoundUI === "function") {
      try { window.updateSkirmishRoundUI(); } catch (_err) {}
    }
    if (typeof window.renderNaval === "function") {
      try { window.renderNaval(); } catch (_err) {}
    }
    if (typeof window.renderCaravanUI === "function") {
      try { window.renderCaravanUI(); } catch (_err) {}
    }
  }

  function queueCombatSceneSync(reason) {
    if (!state.socket || !state.connected || !state.code) return;
    if (state.applyingSharedState) return;
    if (isCombatSceneAutoSyncSuppressed()) return;
    clearQueuedCombatSceneSync();
    var syncGeneration = Math.max(0, Number(state.combatSceneSyncGeneration || 0));
    state.combatSceneSyncTimer = setTimeout(function () {
      state.combatSceneSyncTimer = null;
      if (!state.socket || !state.connected || !state.code || state.applyingSharedState) return;
      if (syncGeneration !== Math.max(0, Number(state.combatSceneSyncGeneration || 0))) return;
      if (isCombatSceneAutoSyncSuppressed()) return;
      var scene = collectCombatSceneState();
      var hash = hashCombatSceneState(scene);
      if (!hash || hash === state.lastCombatSceneHash) return;
      state.lastCombatSceneHash = hash;
      var patch = attachCombatSceneSyncMeta({ combatScene: scene }, syncGeneration, true);
      var out = syncSharedPatch(patch, reason || "combat-scene");
      if (out && typeof out.catch === "function") out.catch(function () {});
    }, 0);
  }

  function syncCombatSceneHeartbeat(reason) {
    if (state.role !== "gm" || !state.socket || !state.connected || !state.code || state.applyingSharedState) return;
    if (isCombatSceneAutoSyncSuppressed()) return;
    var scene = collectCombatSceneState();
    var hash = hashCombatSceneState(scene);
    if (!hash || hash === state.lastCombatSceneHash) return;
    state.lastCombatSceneHash = hash;
    var autoGeneration = Math.max(0, Number(state.combatSceneSyncGeneration || 0));
    var patch = attachCombatSceneSyncMeta({ combatScene: scene }, autoGeneration, true);
    var out = syncSharedPatch(patch, reason || "combat-scene-heartbeat");
    if (out && typeof out.catch === "function") out.catch(function () {});
  }

  function patchCombatSyncHooks() {
    if (window._campaignPatchedCombatSyncHooks) return;

    function wrap(fnName, reason) {
      if (typeof window[fnName] !== "function") return;
      var guardKey = "_campaignWrappedCombatSync_" + fnName;
      if (window[guardKey]) return;
      var original = window[fnName];
      window[fnName] = function () {
        var out = original.apply(this, arguments);
        queueCombatSceneSync(reason || fnName);
        return out;
      };
      window[guardKey] = true;
    }

    wrap("startCombat", "combat-start");
    wrap("endCombat", "combat-end");
    wrap("nextRound", "combat-next-round");
    wrap("setEnemyDread", "combat-dread");
    wrap("renderEnemies", "combat-enemies");
    wrap("updateCombatUI", "combat-ui");
    wrap("rollArmyStress", "skirmish-roll");
    wrap("skirmishAction", "skirmish-action");
    wrap("enemyPip", "combat-enemy-stress");
    wrap("removeEnemy", "combat-remove-enemy");
    wrap("enemyAttack", "combat-enemy-attack");
    wrap("applyStressToEnemy", "combat-apply-stress");
    wrap("rollAttack", "combat-roll-attack");
    wrap("executeWayfarerAction", "combat-wayfarer-action");
    wrap("triggerEnemyActionEvent", "combat-enemy-event");
    wrap("usePersonalFlavorAction", "combat-personal-flavor");
    wrap("setCombatSpacing", "combat-spacing");
    wrap("addCombatUnit", "combat-map-add-unit");
    wrap("moveCombatUnit", "combat-map-move-unit");
    wrap("removeCombatUnit", "combat-map-remove-unit");
    wrap("clearCombatMap", "combat-map-clear");
    // Naval Ship / Starship combat
    wrap("startNavalCombat", "naval-combat-start");
    wrap("nextNavalRound", "naval-next-round");
    wrap("navalAttack", "naval-attack");
    wrap("enemyNavalAttack", "naval-enemy-attack");
    wrap("navalRepair", "naval-repair");
    wrap("navalTactics", "naval-tactics");
    wrap("navalMorale", "naval-morale");
    wrap("navalSurvey", "naval-survey");
    wrap("adjustNavalZone", "naval-zone");
    wrap("applyPowerShift", "naval-power-shift");
    wrap("clearPowerShift", "naval-power-shift-clear");
    wrap("spawnEnemyShip", "naval-spawn-enemy");
    wrap("wreckEnemyShip", "naval-wreck-enemy");
    // Caravan chase combat
    wrap("startChase", "chase-start");
    wrap("nextChaseRound", "chase-next-round");
    wrap("endChase", "chase-end");
    wrap("rollChaseControl", "chase-control");
    wrap("rollChaseEnemyAttack", "chase-enemy-attack");
    wrap("adjustChaseZone", "chase-zone");
    wrap("setChaseEnemyDread", "chase-dread");
    wrap("changeCaravanStress", "caravan-stress");
    wrap("repairCaravan", "caravan-repair");

    window._campaignPatchedCombatSyncHooks = true;
  }

  function ensureSessionTimelineState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!Array.isArray(sharedState.sessionTimeline)) {
      sharedState.sessionTimeline = [];
    }
    return sharedState.sessionTimeline;
  }

  function ensureAreaSessionState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.areaSession || typeof sharedState.areaSession !== "object") {
      sharedState.areaSession = {
        id: "",
        status: "closed",
        kind: "",
        label: "",
        title: "",
        by: "",
        openedAt: 0,
        updatedAt: 0,
        payload: null
      };
    }
    return sharedState.areaSession;
  }

  function ensureReadyCheckState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.readyCheck || typeof sharedState.readyCheck !== "object") {
      sharedState.readyCheck = {
        id: "",
        status: "idle",
        type: "",
        label: "",
        requestedBy: "",
        requestedAt: 0,
        requiredTokens: [],
        responses: {},
        actionPayload: null,
        resolvedAt: 0
      };
    }
    return sharedState.readyCheck;
  }

  function ensurePartyRestEventState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.partyRestEvent || typeof sharedState.partyRestEvent !== "object") {
      sharedState.partyRestEvent = {
        id: "",
        boonKey: "",
        label: "",
        requestedBy: "",
        requestedAt: 0,
        appliedAt: 0,
        sourceKind: "",
        sourceRef: null,
        targetTokens: []
      };
    }
    if (!Array.isArray(sharedState.partyRestEvent.targetTokens)) {
      sharedState.partyRestEvent.targetTokens = [];
    }
    return sharedState.partyRestEvent;
  }

  function ensurePendingChecksState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.pendingChecks || typeof sharedState.pendingChecks !== "object") {
      sharedState.pendingChecks = { active: {}, history: [] };
    }
    if (!sharedState.pendingChecks.active || typeof sharedState.pendingChecks.active !== "object" || Array.isArray(sharedState.pendingChecks.active)) {
      sharedState.pendingChecks.active = {};
    }
    if (!Array.isArray(sharedState.pendingChecks.history)) {
      sharedState.pendingChecks.history = [];
    }
    if (sharedState.pendingChecks.history.length > 80) {
      sharedState.pendingChecks.history = sharedState.pendingChecks.history.slice(-80);
    }
    return sharedState.pendingChecks;
  }

  function ensureGmForgeState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.gmForge || typeof sharedState.gmForge !== "object") {
      sharedState.gmForge = { savedPresets: [], lastPresetId: "", updatedAt: 0 };
    }
    if (!Array.isArray(sharedState.gmForge.savedPresets)) {
      sharedState.gmForge.savedPresets = [];
    }
    if (sharedState.gmForge.savedPresets.length > 24) {
      sharedState.gmForge.savedPresets = sharedState.gmForge.savedPresets.slice(-24);
    }
    sharedState.gmForge.lastPresetId = String(sharedState.gmForge.lastPresetId || "");
    sharedState.gmForge.updatedAt = Math.max(0, Number(sharedState.gmForge.updatedAt || 0));
    return sharedState.gmForge;
  }

  function ensureCampaignChronicleState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!Array.isArray(sharedState.campaignChronicle)) {
      sharedState.campaignChronicle = [];
    }
    if (sharedState.campaignChronicle.length > 180) {
      sharedState.campaignChronicle = sharedState.campaignChronicle.slice(-180);
    }
    return sharedState.campaignChronicle;
  }

  function ensureCampaignHooksState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!Array.isArray(sharedState.unresolvedHooks)) {
      sharedState.unresolvedHooks = [];
    }
    if (sharedState.unresolvedHooks.length > 160) {
      sharedState.unresolvedHooks = sharedState.unresolvedHooks.slice(-160);
    }
    return sharedState.unresolvedHooks;
  }

  function sanitizeGmForgePreset(input) {
    var source = input && typeof input === "object" ? input : {};
    var draft = source.draft && typeof source.draft === "object" ? source.draft : {};
    return {
      id: String(source.id || ("forge-" + Date.now() + "-" + Math.floor(Math.random() * 100000))),
      name: String(source.name || source.label || draft.templateLabel || draft.title || "GM Forge Preset").slice(0, 64),
      summary: String(source.summary || draft.briefing || "").slice(0, 180),
      updatedAt: Number(source.updatedAt || Date.now()) || Date.now(),
      draft: {
        title: String(draft.title || "").slice(0, 80),
        diff: String(draft.diff || "medium").slice(0, 24),
        region: String(draft.region || "province").slice(0, 24),
        loc: String(draft.loc || "").slice(0, 80),
        fp: Math.max(0, Math.trunc(Number(draft.fp || 0) || 0)),
        briefing: String(draft.briefing || "").slice(0, 360),
        contact: String(draft.contact || "").slice(0, 100),
        threat: String(draft.threat || "").slice(0, 100),
        keyMarker: String(draft.keyMarker || "").slice(0, 100),
        enemy: String(draft.enemy || "").slice(0, 100),
        checkpoints: String(draft.checkpoints || "").slice(0, 320),
        gmNotes: String(draft.gmNotes || "").slice(0, 420),
        hooks: String(draft.hooks || "").slice(0, 360),
        templateId: String(draft.templateId || "").slice(0, 120),
        templateLabel: String(draft.templateLabel || "").slice(0, 80),
        missionType: String(draft.missionType || "job").slice(0, 40),
        presetId: String(draft.presetId || "").slice(0, 80),
        packId: String(draft.packId || "").slice(0, 80)
      }
    };
  }

  function buildCampaignChronicleEntry(input) {
    var source = input && typeof input === "object" ? input : {};
    return {
      id: String(source.id || ("chronicle-" + Date.now() + "-" + Math.floor(Math.random() * 100000))),
      title: String(source.title || source.label || "Campaign Note").slice(0, 80),
      text: String(source.text || source.body || "").slice(0, 500),
      kind: String(source.kind || "note").slice(0, 24),
      missionId: String(source.missionId || "").slice(0, 80),
      templateId: String(source.templateId || "").slice(0, 120),
      missionType: String(source.missionType || "").slice(0, 40),
      at: Number(source.at || Date.now()) || Date.now(),
      by: String(source.by || state.playerName || ensureName() || "GM").slice(0, 48)
    };
  }

  function buildCampaignHookEntry(input) {
    var source = input && typeof input === "object" ? input : {};
    return {
      id: String(source.id || ("hook-" + Date.now() + "-" + Math.floor(Math.random() * 100000))),
      text: String(source.text || source.title || "").slice(0, 220),
      source: String(source.source || source.title || "GM Forge").slice(0, 80),
      missionId: String(source.missionId || "").slice(0, 80),
      templateId: String(source.templateId || "").slice(0, 120),
      priority: String(source.priority || "normal").slice(0, 16),
      status: String(source.status || "open") === "resolved" ? "resolved" : "open",
      at: Number(source.at || Date.now()) || Date.now(),
      resolvedAt: Math.max(0, Number(source.resolvedAt || 0)),
      by: String(source.by || state.playerName || ensureName() || "GM").slice(0, 48)
    };
  }

  function getCampaignChronicleEntries() {
    var list = ensureCampaignChronicleState(getCampaignSharedState());
    return deepCloneJson(list) || [];
  }

  function getCampaignHooks() {
    var list = ensureCampaignHooksState(getCampaignSharedState());
    return deepCloneJson(list) || [];
  }

  function syncForgeAndChroniclePatch(patch, reason) {
    if (!state.code || !state.connected || state.role !== "gm") return;
    syncSharedPatch(patch, reason).catch(function () {});
  }

  function saveGmForgePreset(preset) {
    var next = sanitizeGmForgePreset(preset);
    var shared = getMutableCampaignSharedState();
    var forge = ensureGmForgeState(shared);
    var existing = (forge.savedPresets || []).filter(function (row) {
      return String(row && row.id || "") !== String(next.id || "");
    });
    existing.unshift(next);
    forge.savedPresets = existing.slice(0, 24);
    forge.lastPresetId = String(next.id || "");
    forge.updatedAt = Date.now();
    syncForgeAndChroniclePatch({ gmForge: deepCloneJson(forge) || forge }, "gm-forge-preset-save");
    return next;
  }

  function deleteGmForgePreset(presetId) {
    var id = String(presetId || "").trim();
    if (!id) return false;
    var shared = getMutableCampaignSharedState();
    var forge = ensureGmForgeState(shared);
    var before = forge.savedPresets.length;
    forge.savedPresets = forge.savedPresets.filter(function (row) {
      return String(row && row.id || "") !== id;
    });
    if (forge.lastPresetId === id) forge.lastPresetId = "";
    forge.updatedAt = Date.now();
    if (forge.savedPresets.length === before) return false;
    syncForgeAndChroniclePatch({ gmForge: deepCloneJson(forge) || forge }, "gm-forge-preset-delete");
    return true;
  }

  function setGmForgeLastPreset(presetId) {
    var id = String(presetId || "").trim();
    var shared = getMutableCampaignSharedState();
    var forge = ensureGmForgeState(shared);
    forge.lastPresetId = id;
    forge.updatedAt = Date.now();
    syncForgeAndChroniclePatch({ gmForge: deepCloneJson(forge) || forge }, "gm-forge-preset-last");
    return id;
  }

  function getGmForgePresets() {
    var forge = ensureGmForgeState(getCampaignSharedState());
    return deepCloneJson(forge.savedPresets) || [];
  }

  function addCampaignChronicleEntry(input) {
    var entry = buildCampaignChronicleEntry(input);
    if (!String(entry.title || "").trim() && !String(entry.text || "").trim()) return false;
    var shared = getMutableCampaignSharedState();
    var chronicle = ensureCampaignChronicleState(shared);
    chronicle.unshift(entry);
    if (chronicle.length > 180) shared.campaignChronicle = chronicle.slice(0, 180);
    appendSessionTimeline("chronicle", "Chronicle updated: " + String(entry.title || "Campaign Note") + ".", {
      chronicleId: entry.id,
      kind: entry.kind,
      missionId: entry.missionId
    });
    syncForgeAndChroniclePatch({
      campaignChronicle: deepCloneJson(shared.campaignChronicle || chronicle) || chronicle,
      sessionTimeline: deepCloneJson(shared.sessionTimeline || ensureSessionTimelineState(shared))
    }, "campaign-chronicle-add");
    return entry;
  }

  function addCampaignHook(input) {
    var hook = buildCampaignHookEntry(input);
    if (!String(hook.text || "").trim()) return false;
    var shared = getMutableCampaignSharedState();
    var hooks = ensureCampaignHooksState(shared);
    hooks.unshift(hook);
    if (hooks.length > 160) shared.unresolvedHooks = hooks.slice(0, 160);
    appendSessionTimeline("hook", "Open hook tracked: " + String(hook.text || "Open hook") + ".", {
      hookId: hook.id,
      source: hook.source,
      missionId: hook.missionId
    });
    syncForgeAndChroniclePatch({
      unresolvedHooks: deepCloneJson(shared.unresolvedHooks || hooks) || hooks,
      sessionTimeline: deepCloneJson(shared.sessionTimeline || ensureSessionTimelineState(shared))
    }, "campaign-hook-add");
    return hook;
  }

  function resolveCampaignHook(hookId) {
    var id = String(hookId || "").trim();
    if (!id) return false;
    var shared = getMutableCampaignSharedState();
    var hooks = ensureCampaignHooksState(shared);
    var changed = false;
    hooks.forEach(function (hook) {
      if (String(hook && hook.id || "") !== id || String(hook.status || "") === "resolved") return;
      hook.status = "resolved";
      hook.resolvedAt = Date.now();
      changed = true;
    });
    if (!changed) return false;
    appendSessionTimeline("hook", "Hook resolved.", { hookId: id });
    syncForgeAndChroniclePatch({
      unresolvedHooks: deepCloneJson(hooks) || hooks,
      sessionTimeline: deepCloneJson(shared.sessionTimeline || ensureSessionTimelineState(shared))
    }, "campaign-hook-resolve");
    return true;
  }

  function reopenCampaignHook(hookId) {
    var id = String(hookId || "").trim();
    if (!id) return false;
    var shared = getMutableCampaignSharedState();
    var hooks = ensureCampaignHooksState(shared);
    var changed = false;
    hooks.forEach(function (hook) {
      if (String(hook && hook.id || "") !== id || String(hook.status || "") !== "resolved") return;
      hook.status = "open";
      hook.resolvedAt = 0;
      changed = true;
    });
    if (!changed) return false;
    appendSessionTimeline("hook", "Hook reopened.", { hookId: id });
    syncForgeAndChroniclePatch({
      unresolvedHooks: deepCloneJson(hooks) || hooks,
      sessionTimeline: deepCloneJson(shared.sessionTimeline || ensureSessionTimelineState(shared))
    }, "campaign-hook-reopen");
    return true;
  }

  function getPendingChecks() {
    var checks = ensurePendingChecksState(getCampaignSharedState());
    return deepCloneJson(checks) || { active: {}, history: [] };
  }

  function mergePendingChecksState(currentLike, incomingLike) {
    var current = ensurePendingChecksState({ pendingChecks: deepCloneJson(currentLike) || currentLike });
    var incoming = ensurePendingChecksState({ pendingChecks: deepCloneJson(incomingLike) || incomingLike });
    var historyById = {};

    function upsertHistory(entry) {
      if (!entry || typeof entry !== "object") return;
      var id = String(entry.id || "").trim();
      if (!id) return;
      var prior = historyById[id] || null;
      var nextResolvedAt = Math.max(0, Number(entry.resolvedAt || entry.createdAt || 0));
      var priorResolvedAt = Math.max(0, Number(prior && (prior.resolvedAt || prior.createdAt) || 0));
      if (!prior || nextResolvedAt >= priorResolvedAt) {
        historyById[id] = deepCloneJson(entry) || entry;
      }
    }

    (Array.isArray(current.history) ? current.history : []).forEach(upsertHistory);
    (Array.isArray(incoming.history) ? incoming.history : []).forEach(upsertHistory);

    var resolvedIds = {};
    Object.keys(historyById).forEach(function (id) {
      resolvedIds[id] = true;
    });

    var active = {};
    var incomingActive = incoming.active && typeof incoming.active === "object" ? incoming.active : {};
    Object.keys(incomingActive).forEach(function (id) {
      if (!id || resolvedIds[id]) return;
      active[id] = deepCloneJson(incomingActive[id]) || incomingActive[id];
    });

    var history = Object.keys(historyById).map(function (id) {
      return historyById[id];
    }).sort(function (a, b) {
      var aAt = Math.max(0, Number((a && (a.resolvedAt || a.createdAt)) || 0));
      var bAt = Math.max(0, Number((b && (b.resolvedAt || b.createdAt)) || 0));
      return aAt - bAt;
    });

    if (history.length > 80) history = history.slice(-80);
    return { active: active, history: history };
  }

  function upsertPendingCheckSubmission(record, submission) {
    if (!record || typeof record !== "object") return false;
    var next = buildPendingCheckSubmission(submission);
    var token = String(next.token || "");
    if (!token) return false;
    if (!Array.isArray(record.submissions)) record.submissions = [];
    var replaced = false;
    for (var i = 0; i < record.submissions.length; i += 1) {
      if (String(record.submissions[i] && record.submissions[i].token || "") !== token) continue;
      record.submissions[i] = next;
      replaced = true;
      break;
    }
    if (!replaced) record.submissions.push(next);
    return true;
  }

  function isConnectedCampaignPlayer() {
    return !!(state.code && state.connected && state.role === "player");
  }

  function guardGmCheckResolution(specOrText) {
    if (!isConnectedCampaignPlayer()) return true;
    var label = (specOrText && typeof specOrText === "object")
      ? String(specOrText.label || specOrText.context || "this shared check")
      : String(specOrText || "this shared check");
    safeNotif("Ask the GM to resolve " + label + ". Shared campaign checks are GM-authoritative.", "warn");
    return false;
  }

  function normalizePendingCheckParticipants(input) {
    if (!Array.isArray(input)) return [];
    return input.map(function (entry) {
      if (!entry) return null;
      if (typeof entry === "string") {
        var tokenText = String(entry || "").trim();
        return tokenText ? { token: tokenText, name: "" } : null;
      }
      if (typeof entry !== "object") return null;
      var token = String(entry.token || "").trim();
      var name = String(entry.name || "").trim();
      if (!token && !name) return null;
      return { token: token, name: name };
    }).filter(Boolean);
  }

  function buildPendingCheckSubmission(entry) {
    var details = entry && typeof entry === "object" ? entry : {};
    var totals = {
      total: Math.max(0, Number(details.total || details.actionTotal || 0) || 0),
      dreadTotal: Math.max(0, Number(details.dreadTotal || details.ddTotal || 0) || 0),
      die: Math.max(1, Number(details.die || details.actionDie || 4) || 4)
    };
    return {
      token: String(details.token || state.token || "").trim(),
      name: String(details.name || state.playerName || ensureName() || "Wayfarer").slice(0, 48),
      role: String(details.role || state.role || "player") === "gm" ? "gm" : "player",
      total: totals.total,
      dreadTotal: totals.dreadTotal,
      die: totals.die,
      success: typeof details.success === "boolean" ? !!details.success : (totals.total >= totals.dreadTotal),
      method: String(details.method || (details.manual ? "manual" : "auto") || "auto").slice(0, 24),
      notes: String(details.notes || details.context || "").slice(0, 180),
      at: Number(details.at || Date.now()) || Date.now()
    };
  }

  function buildPendingCheckRecord(spec) {
    var details = spec && typeof spec === "object" ? spec : {};
    var id = "check-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
    var stat = String(details.stat || details.statKey || "").toLowerCase();
    var dread = Number(details.dread || details.dreadDie || details.dd || 0) || 0;
    var initialSubmissions = Array.isArray(details.submissions) ? details.submissions.map(buildPendingCheckSubmission).filter(function (row) {
      return !!String(row && row.token || "");
    }) : [];
    return {
      id: id,
      status: "pending",
      type: String(details.type || details.kind || "check"),
      scope: String(details.scope || details.map || "campaign"),
      label: String(details.label || details.context || "Shared Check").slice(0, 100),
      stat: stat,
      statOptions: Array.isArray(details.statOptions) ? details.statOptions.map(function (row) {
        return String(row || "").trim().toLowerCase();
      }).filter(Boolean).slice(0, 8) : (stat ? [stat] : []),
      dread: dread,
      stake: String(details.stake || details.stakes || "").slice(0, 180),
      context: String(details.context || details.label || "").slice(0, 180),
      payload: details.payload && typeof details.payload === "object" ? deepCloneJson(details.payload) || {} : {},
      calledBy: String(details.calledBy || state.playerName || ensureName() || "GM"),
      calledByToken: String(details.calledByToken || state.token || ""),
      participants: normalizePendingCheckParticipants(details.participants),
      submissions: initialSubmissions,
      createdAt: Date.now(),
      createdBy: String(state.playerName || ensureName() || "GM"),
      createdByToken: String(state.token || ""),
      resolvedAt: 0,
      resolvedBy: "",
      outcome: null,
      effectsApplied: null
    };
  }

  function normalizeSceneCheckRewardType(value) {
    var key = String(value || "").trim().toLowerCase();
    if (key === "successroll" || key === "success-roll" || key === "success_roll" || key === "successrolls" || key === "successfulrolls") {
      return "successRolls";
    }
    if (key === "pathtoken" || key === "path-token" || key === "path_token" || key === "pathtokens") {
      return "pathTokens";
    }
    if (key === "none" || !key) return "none";
    return "none";
  }

  function normalizeFailurePenaltyScale(value) {
    var key = String(value || "flat").trim().toLowerCase();
    if (key === "margin" || key === "failedby" || key === "failed-by" || key === "failed_by") return "margin";
    return "flat";
  }

  function normalizeSceneFailurePenaltyType(value) {
    var key = String(value || "mentalStress").trim().toLowerCase();
    if (key === "damage") return "health";
    if (key === "mentalstress" || key === "mental-stress" || key === "mental_stress") return "mentalStress";
    if (key === "health" || key === "radiation" || key === "none") return key;
    return "mentalStress";
  }

  function normalizeSceneCharacterDelta(input) {
    var source = input && typeof input === "object" ? input : {};
    return {
      health: Math.trunc(Number(source.health || 0) || 0),
      mentalStress: Math.trunc(Number(source.mentalStress || 0) || 0),
      radiation: Math.trunc(Number(source.radiation || source.rads || 0) || 0),
      pathTokens: Math.trunc(Number(source.pathTokens || 0) || 0),
      successRolls: Math.trunc(Number(source.successRolls || source.successRollCount || 0) || 0)
    };
  }

  function normalizeSceneSharedDelta(input) {
    var source = input && typeof input === "object" ? input : {};
    return {
      tmw: Math.trunc(Number(source.tmw || 0) || 0)
    };
  }

  function registerSceneCheckHandler(type, handler) {
    var key = String(type || "").trim().toLowerCase();
    if (!key || typeof handler !== "function") return false;
    if (!sceneCheckHandlers[key]) sceneCheckHandlers[key] = [];
    if (sceneCheckHandlers[key].indexOf(handler) >= 0) return true;
    sceneCheckHandlers[key].push(handler);
    return true;
  }

  function dispatchSceneCheckResolved(event) {
    var evt = event && typeof event === "object" ? event : {};
    var check = evt.check && typeof evt.check === "object" ? evt.check : {};
    var key = String(check.type || "").trim().toLowerCase();
    var handlers = key && Array.isArray(sceneCheckHandlers[key]) ? sceneCheckHandlers[key].slice() : [];
    for (var i = 0; i < handlers.length; i += 1) {
      try {
        handlers[i](evt);
      } catch (_err) {}
    }
    if (typeof window.handleCampaignSceneCheckResolved === "function") {
      try {
        window.handleCampaignSceneCheckResolved(evt);
      } catch (_err2) {}
    }
  }

  function applyLocalCharacterDeltaIfTargeted(targetTokens, rawDelta) {
    if (!window.S || !state.token || !Array.isArray(targetTokens) || targetTokens.indexOf(String(state.token || "")) < 0) return false;
    var characterDelta = normalizeSceneCharacterDelta(rawDelta);
    var changed = false;

    if (characterDelta.health !== 0) {
      var maxHealth = Math.max(1, Number(window.S.maxHealth || window.S.maxStress || 1) || 1);
      var nextHealth = Math.max(0, Math.min(maxHealth, Number(window.S.health || 0) + characterDelta.health));
      if (Number(window.S.health || 0) !== nextHealth) {
        window.S.health = nextHealth;
        window.S.stress = nextHealth;
        changed = true;
      }
    }

    if (characterDelta.mentalStress !== 0) {
      var maxMentalStress = Math.max(1, Number(window.S.maxMentalStress || window.S.mentalStressCap || window.S.stressCap || 20) || 20);
      var nextMentalStress = Math.max(0, Math.min(maxMentalStress, Number(window.S.mentalStress || 0) + characterDelta.mentalStress));
      if (Number(window.S.mentalStress || 0) !== nextMentalStress) {
        window.S.mentalStress = nextMentalStress;
        changed = true;
      }
    }

    if (characterDelta.radiation !== 0) {
      var currentRads = Math.max(0, Number(window.S.rads || 0) || 0);
      var nextRads = Math.max(0, currentRads + characterDelta.radiation);
      if (currentRads !== nextRads) {
        window.S.rads = nextRads;
        changed = true;
      }
    }

    if (characterDelta.pathTokens !== 0) {
      var nextPathTokens = Math.max(0, Number(window.S.pathTokens || 0) + characterDelta.pathTokens);
      if (Number(window.S.pathTokens || 0) !== nextPathTokens) {
        window.S.pathTokens = nextPathTokens;
        changed = true;
      }
    }

    if (characterDelta.successRolls !== 0) {
      var currentSuccessRolls = Math.max(0, Number(window.S.successRolls || window.S.successRollCount || 0) || 0);
      var nextSuccessRolls = Math.max(0, currentSuccessRolls + characterDelta.successRolls);
      if (nextSuccessRolls >= 3) {
        var grantedTokens = Math.floor(nextSuccessRolls / 3);
        nextSuccessRolls = nextSuccessRolls % 3;
        var nextGrantedPathTokens = Math.max(0, Number(window.S.pathTokens || 0) + grantedTokens);
        if (Number(window.S.pathTokens || 0) !== nextGrantedPathTokens) {
          window.S.pathTokens = nextGrantedPathTokens;
          changed = true;
        }
      }
      if (currentSuccessRolls !== nextSuccessRolls || Number(window.S.successRollCount || 0) !== nextSuccessRolls) {
        window.S.successRolls = nextSuccessRolls;
        window.S.successRollCount = nextSuccessRolls;
        changed = true;
      }
    }

    if (!changed) return false;
    if (typeof window.updateStressUI === "function") window.updateStressUI();
    if (typeof window.updateMentalStressUI === "function") window.updateMentalStressUI();
    if (typeof window.updateRadsUI === "function") window.updateRadsUI();
    var pathTokenEl = document.getElementById("pathTokensVal");
    if (pathTokenEl) pathTokenEl.textContent = String(window.S.pathTokens || 0);
    var successRollEl = document.getElementById("successRollsVal");
    if (successRollEl) successRollEl.textContent = String(window.S.successRolls || window.S.successRollCount || 0);
    if (typeof window.updateAllStatDisplays === "function") window.updateAllStatDisplays();
    state.lastCharacterHash = JSON.stringify(collectCharacterSummary());
    return true;
  }

  function requestSceneCheck(spec) {
    if (!state.code || !state.connected) return { ok: false, handled: false, error: "Not connected." };
    var details = spec && typeof spec === "object" ? spec : {};
    var label = String(details.label || details.context || "Scene Check").trim() || "Scene Check";
    var stat = String(details.stat || "valor").trim().toLowerCase() || "valor";
    var dread = Math.max(4, Number(details.dread || 6) || 6);

    if (state.role === "gm") {
      if (typeof window.openCampaignSceneCheckPrompt !== "function") {
        safeNotif("Scene check controls are unavailable.", "warn");
        return { ok: false, handled: true, error: "Scene check controls are unavailable." };
      }
      var opened = !!window.openCampaignSceneCheckPrompt(details);
      if (!opened) {
        safeNotif("Could not open the GM scene check prompt.", "warn");
        return { ok: false, handled: true, error: "Could not open the GM scene check prompt." };
      }
      return { ok: true, handled: true, role: "gm" };
    }

    if (state.role === "player") {
      if (typeof sendChatMessage === "function") {
        try {
          sendChatMessage({
            message: String(details.playerRequestMessage || ("🎲 Requesting GM scene check: " + label + " (" + stat.toUpperCase() + " vs d" + dread + ").")).slice(0, 220),
            targetToken: ""
          });
        } catch (_err) {}
      }
      safeNotif(String(details.playerNotice || "Tell the GM your approach. They can now assign the roll from their screen."), "info");
      return { ok: true, handled: true, role: "player", gmRequired: true };
    }

    return { ok: false, handled: false, error: "No campaign role is active." };
  }

  function syncPendingChecks(reason) {
    if (!state.code || !state.connected || state.role !== "gm") return;
    var shared = getMutableCampaignSharedState();
    var pending = ensurePendingChecksState(shared);
    syncSharedPatch({ pendingChecks: deepCloneJson(pending) || pending }, reason || "pending-checks").catch(function () {});
  }

  function submitPendingCheck(checkId, submission) {
    var id = String(checkId || "").trim();
    if (!id || !state.code || !state.connected) return Promise.resolve({ ok: false, error: "Not connected." });
    var nextSubmission = buildPendingCheckSubmission(submission);
    if (!nextSubmission.token) {
      nextSubmission.token = String(state.token || "");
    }
    if (!nextSubmission.token) return Promise.resolve({ ok: false, error: "Missing participant token." });

    if (state.role === "gm") {
      var shared = getMutableCampaignSharedState();
      var pending = ensurePendingChecksState(shared);
      var record = pending.active[id] && typeof pending.active[id] === "object" ? pending.active[id] : null;
      if (!record) return Promise.resolve({ ok: false, error: "Pending check not found." });
      if (!upsertPendingCheckSubmission(record, nextSubmission)) {
        return Promise.resolve({ ok: false, error: "Could not record submission." });
      }
      syncPendingChecks("pending-check-submit");
      return Promise.resolve({ ok: true, local: true, checkId: id });
    }

    return syncSharedPatch({
      pendingChecks: {
        id: id,
        submission: nextSubmission
      }
    }, "pending-check-submit");
  }

  function startGmPendingCheck(spec) {
    if (!state.code || !state.connected) return { ok: true, local: true, id: "" };
    if (state.role !== "gm") {
      guardGmCheckResolution(spec);
      return { ok: false, blocked: true, error: "Only the GM can resolve shared campaign checks." };
    }
    var shared = getMutableCampaignSharedState();
    var pending = ensurePendingChecksState(shared);
    var record = buildPendingCheckRecord(spec);
    pending.active[record.id] = record;
    appendSessionTimeline("check", "Pending check started: " + record.label + ".", {
      checkId: record.id,
      type: record.type,
      scope: record.scope,
      stat: record.stat,
      dread: record.dread
    });
    syncPendingChecks("pending-check-start");
    return { ok: true, id: record.id, record: deepCloneJson(record) || record };
  }

  function resolveGmPendingCheck(checkId, outcome) {
    var id = String(checkId || "");
    if (!id || !state.code || !state.connected || state.role !== "gm") return false;
    var shared = getMutableCampaignSharedState();
    var pending = ensurePendingChecksState(shared);
    var record = pending.active[id] && typeof pending.active[id] === "object" ? pending.active[id] : null;
    if (!record) {
      record = buildPendingCheckRecord({ label: "Shared Check", type: "check", scope: "campaign" });
      record.id = id;
    }
    record.status = "resolved";
    record.resolvedAt = Date.now();
    record.resolvedBy = String(state.playerName || ensureName() || "GM");
    record.outcome = outcome && typeof outcome === "object" ? deepCloneJson(outcome) || {} : {};
    record.effectsApplied = record.outcome && Object.prototype.hasOwnProperty.call(record.outcome, "effectsApplied")
      ? deepCloneJson(record.outcome.effectsApplied)
      : null;
    delete pending.active[id];
    pending.history.push(record);
    if (pending.history.length > 80) pending.history = pending.history.slice(-80);
    appendSessionTimeline("check", "Check resolved: " + String(record.label || "Shared Check") + " — " + (record.outcome && record.outcome.success ? "success" : "failure") + ".", {
      checkId: record.id,
      type: record.type,
      scope: record.scope,
      success: !!(record.outcome && record.outcome.success),
      margin: Number(record.outcome && (record.outcome.margin || record.outcome.failedBy || 0)) || 0
    });
    syncPendingChecks("pending-check-resolved");
    return true;
  }

  function runGmResolvedCheck(spec, resolver) {
    var pending = startGmPendingCheck(spec);
    if (!pending || pending.blocked) return pending || { ok: false };
    if (typeof resolver !== "function") return pending;
    try {
      var result = resolver(pending.id || "");
      if (result && typeof result.then === "function") {
        return result.then(function (outcome) {
          if (outcome && typeof outcome === "object") resolveGmPendingCheck(pending.id, outcome);
          return outcome;
        });
      }
      if (result && typeof result === "object") resolveGmPendingCheck(pending.id, result);
      return result;
    } catch (err) {
      resolveGmPendingCheck(pending.id, { success: false, error: err && err.message ? err.message : String(err) });
      throw err;
    }
  }

  function appendSessionTimeline(kind, text, meta) {
    if (!state.code) return;
    var shared = getMutableCampaignSharedState();
    var list = ensureSessionTimelineState(shared);
    list.push({
      id: "timeline-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
      kind: String(kind || "system"),
      text: String(text || ""),
      meta: meta && typeof meta === "object" ? deepCloneJson(meta) || {} : {},
      at: Date.now(),
      by: String(state.playerName || ensureName() || "Wayfarer")
    });
    if (list.length > 250) {
      shared.sessionTimeline = list.slice(-250);
    }
  }

  function findOnlinePlayerParticipantTokens() {
    var out = [];
    var seen = {};
    var participants = getCampaignParticipantRecords();
    var now = Date.now();

    participants.forEach(function (member) {
      if (!member || String(member.role || "player") === "gm") return;
      var token = String(member.token || "").trim();
      if (!token || seen[token]) return;
      var online = member.online !== false;
      var lastSeenAt = Number(member.lastSeenAt || 0);
      if (!online && (!lastSeenAt || (now - lastSeenAt) > 120000)) return;
      seen[token] = true;
      out.push(token);
    });

    if (!out.length && state.token) {
      out.push(String(state.token));
    }
    return out;
  }

  function getRosterCharacterUpdatedAt(token) {
    var wanted = String(token || "").trim();
    if (!wanted || !state.campaign || !Array.isArray(state.campaign.roster)) return 0;
    for (var i = 0; i < state.campaign.roster.length; i += 1) {
      var member = state.campaign.roster[i];
      if (!member || String(member.token || "") !== wanted || !member.character || typeof member.character !== "object") continue;
      return Math.max(0, Number(member.character.updatedAt || 0));
    }
    return 0;
  }

  function applyLocalRestBoonEffects(boonKey, label, options) {
    var opts = options && typeof options === "object" ? options : {};
    if (typeof window.S === "undefined" || !window.S) return false;

    if (typeof window.clearStress === "function") {
      window.clearStress();
    } else if (typeof window.changeStress === "function") {
      window.changeStress(-999);
    } else if (typeof window.clearHealth === "function") {
      window.clearHealth();
    }

    if (typeof window.clearMentalStress === "function") {
      window.clearMentalStress();
    } else if (typeof window.changeMentalStress === "function") {
      window.changeMentalStress(-999);
    } else {
      window.S.mentalStress = 0;
    }

    if (typeof window.clearAllConditions === "function") {
      window.clearAllConditions();
    } else if (window.S.conditions && typeof window.S.conditions === "object") {
      Object.keys(window.S.conditions).forEach(function (key) {
        window.S.conditions[key] = false;
      });
      if (typeof window.updateConditionButtons === "function") window.updateConditionButtons();
      if (typeof window.updateAllStatDisplays === "function") window.updateAllStatDisplays();
    }

    if (boonKey && window.S.conditions && Object.prototype.hasOwnProperty.call(window.S.conditions, boonKey)) {
      window.S.conditions[boonKey] = true;
      if (typeof window.updateConditionButtons === "function") window.updateConditionButtons();
      if (typeof window.updateAllStatDisplays === "function") window.updateAllStatDisplays();
    }

    if (Math.max(0, Number(opts.advanceDay || 0)) > 0 && typeof window.advanceDay === "function") {
      window.advanceDay(Math.max(1, Number(opts.advanceDay || 1)));
    }

    if (typeof window.updateStressUI === "function") window.updateStressUI();
    if (typeof window.updateMentalStressUI === "function") window.updateMentalStressUI();
    if (typeof window.renderQP === "function") {
      try { window.renderQP("char"); } catch (_err) {}
    }

    if (opts.preventStaleAuthoritativeOverwrite) {
      state.lastAppliedSelfCharacterAt = Math.max(
        Number(state.lastAppliedSelfCharacterAt || 0),
        Number(opts.authoritativeAt || 0),
        Date.now()
      );
    }
    state.lastCharacterHash = JSON.stringify(collectCharacterSummary());

    if (!opts.skipNotif) {
      safeNotif((label || "Rest") + ": Long Rest complete, boon gained, +1 day.", "good");
    }
    return true;
  }

  function applyCampaignPartyRestWorldState(actionPayload) {
    var payload = actionPayload && typeof actionPayload === "object" ? actionPayload : {};
    var sourceKind = String(payload.sourceKind || "").trim();
    var sourceRef = payload.sourceRef && typeof payload.sourceRef === "object" ? payload.sourceRef : {};
    var boonKey = String(payload.boonKey || "").trim();

    if (sourceKind === "province") {
      if (typeof renderHexInfo === "function" && typeof selectedHex !== "undefined" && selectedHex) {
        try { renderHexInfo(selectedHex); } catch (_err) {}
      }
      return;
    }

    if (sourceKind === "planet") {
      if (typeof getActivePlanetHex === "function" && typeof ensurePlanetSurfaceState === "function") {
        var activeHex = getActivePlanetHex();
        var planetState = ensurePlanetSurfaceState(activeHex);
        if (planetState && Array.isArray(planetState.cells)) {
          var cellId = Number(sourceRef.cellId);
          var cell = planetState.cells.find(function (entry) { return Number(entry && entry.id) === cellId; });
          if (cell) cell.boonUsed = boonKey || cell.boonUsed || "";
        }
      }
      if (typeof renderPlanetExplorationPanel === "function") {
        try { renderPlanetExplorationPanel(); } catch (_err) {}
      }
      return;
    }

    if (sourceKind === "sea-landmark" || sourceKind === "sea-dungeon") {
      var resultTitle = sourceKind === "sea-landmark"
        ? "Landmark - Protected Resting Place"
        : "Sea Ruins - Rest Boon";
      var resultBody = sourceKind === "sea-landmark"
        ? "You find respite at this sacred place. Long Rest complete, day advanced by 1, and Protected gained."
        : "You make camp among the ruins. Long Rest complete, day advanced by 1, and Empowered gained.";
      if (typeof seaHexByCoord === "function") {
        var seaHex = seaHexByCoord(Number(sourceRef.col), Number(sourceRef.row));
        if (seaHex) {
          seaHex.resultHtml = '<div class="sea-result-title">' + escapeHtml(resultTitle) + '</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">' + escapeHtml(resultBody) + '</div>';
          if (typeof renderLastSeaInfo === "function") {
            try { renderLastSeaInfo(seaHex); } catch (_err) {}
          }
        }
      }
      return;
    }

    if (typeof renderLastSeaInfo === "function") {
      try { renderLastSeaInfo(); } catch (_err) {}
    }
    if (typeof renderPlanetExplorationPanel === "function") {
      try { renderPlanetExplorationPanel(); } catch (_err) {}
    }
    if (typeof renderHexInfo === "function" && typeof selectedHex !== "undefined" && selectedHex) {
      try { renderHexInfo(selectedHex); } catch (_err) {}
    }
  }

  function applyApprovedPartyRestBoonReadyCheck(ready, shared) {
    var action = ready && ready.actionPayload && typeof ready.actionPayload === "object"
      ? ready.actionPayload
      : null;
    if (!action || String(action.kind || "") !== "party-rest-boon") return false;

    var targetTokens = Array.isArray(action.targetTokens)
      ? action.targetTokens.map(function (token) { return String(token || "").trim(); }).filter(Boolean)
      : [];
    if (!targetTokens.length) {
      targetTokens = findOnlinePlayerParticipantTokens();
    }

    if (typeof window.advanceDay === "function") {
      window.advanceDay(1);
    } else {
      advanceSharedGameDate(1);
    }

    applyCampaignPartyRestWorldState(action);

    var restEvent = ensurePartyRestEventState(shared);
    restEvent.id = "party-rest-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
    restEvent.boonKey = String(action.boonKey || "").trim();
    restEvent.label = String(action.label || "Rest").trim() || "Rest";
    restEvent.requestedBy = String(action.requestedBy || ready.requestedBy || "GM");
    restEvent.requestedAt = Math.max(0, Number(action.requestedAt || ready.requestedAt || Date.now()));
    restEvent.appliedAt = Date.now();
    restEvent.sourceKind = String(action.sourceKind || "").trim();
    restEvent.sourceRef = action.sourceRef && typeof action.sourceRef === "object"
      ? (deepCloneJson(action.sourceRef) || action.sourceRef)
      : null;
    restEvent.targetTokens = targetTokens.slice();

    appendSessionTimeline("rest", "Party rest completed: " + restEvent.label + ".", {
      restId: restEvent.id,
      boonKey: restEvent.boonKey,
      targets: targetTokens.length
    });
    safeNotif(restEvent.label + ": party rest approved.", "good");
    return true;
  }

  function getReadyCheckResponseCount(readyCheck) {
    if (!readyCheck || !readyCheck.responses || typeof readyCheck.responses !== "object") return 0;
    return Object.keys(readyCheck.responses).filter(function (token) {
      var row = readyCheck.responses[token];
      return !!(row && typeof row.ready === "boolean");
    }).length;
  }

  function isReadyCheckApproved(readyCheck) {
    if (!readyCheck || String(readyCheck.status || "") !== "pending") return false;
    var required = Array.isArray(readyCheck.requiredTokens) ? readyCheck.requiredTokens : [];
    if (!required.length) return false;
    var responses = readyCheck.responses && typeof readyCheck.responses === "object" ? readyCheck.responses : {};
    for (var i = 0; i < required.length; i++) {
      var token = String(required[i] || "");
      if (!token) continue;
      var row = responses[token];
      if (!row || row.ready !== true) return false;
    }
    return true;
  }

  function forEachCampaignParticipantSource(source, iteratee) {
    if (!source || typeof iteratee !== "function") return;
    if (typeof Map !== "undefined" && source instanceof Map) {
      source.forEach(function (value, key) {
        if (!value || typeof value !== "object") return;
        var row = Object.assign({}, value);
        if (!row.token && key != null) row.token = key;
        iteratee(row);
      });
      return;
    }
    if (Array.isArray(source)) {
      source.forEach(function (row) {
        if (!row || typeof row !== "object") return;
        iteratee(Object.assign({}, row));
      });
      return;
    }
    if (typeof source === "object") {
      Object.keys(source).forEach(function (key) {
        var value = source[key];
        if (!value || typeof value !== "object") return;
        var row = Object.assign({}, value);
        if (!row.token) row.token = key;
        iteratee(row);
      });
    }
  }

  function getCampaignParticipantRecords() {
    if (!state.campaign || typeof state.campaign !== "object") return [];
    var merged = {};
    var orderedTokens = [];

    function upsert(row) {
      if (!row || typeof row !== "object") return;
      var token = String(row.token || "").trim();
      if (!token) return;
      var existing = merged[token] && typeof merged[token] === "object" ? merged[token] : { token: token };
      var next = Object.assign({}, existing, row, { token: token });
      if (row.character && typeof row.character === "object") {
        next.character = row.character;
      } else if (existing.character && typeof existing.character === "object") {
        next.character = existing.character;
      }
      if (!next.name) {
        next.name = String(
          (next.character && next.character.name)
          || row.playerName
          || existing.playerName
          || "Wayfarer"
        );
      }
      next.role = String(next.role || existing.role || "player");
      if (typeof row.online === "boolean") {
        next.online = row.online;
      } else if (typeof existing.online === "boolean") {
        next.online = existing.online;
      } else {
        next.online = true;
      }
      var lastSeenAt = Number(row.lastSeenAt || existing.lastSeenAt || 0) || 0;
      if (lastSeenAt) next.lastSeenAt = lastSeenAt;
      merged[token] = next;
      if (orderedTokens.indexOf(token) === -1) orderedTokens.push(token);
    }

    forEachCampaignParticipantSource(state.campaign.members, upsert);
    forEachCampaignParticipantSource(state.campaign.participants, upsert);
    forEachCampaignParticipantSource(state.campaign.roster, upsert);

    return orderedTokens.map(function (token) {
      return merged[token];
    }).filter(Boolean);
  }

  function getCampaignParticipantRecord(token) {
    var wanted = String(token || "").trim();
    if (!wanted) return null;
    var rows = getCampaignParticipantRecords();
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (!row || String(row.token || "").trim() !== wanted) continue;
      return row;
    }
    return null;
  }

  function findOnlineParticipantTokens() {
    var out = [];
    var seen = {};
    var participants = getCampaignParticipantRecords();
    var now = Date.now();

    participants.forEach(function (member) {
      if (!member) return;
      var token = String(member.token || "").trim();
      if (!token || seen[token]) return;
      var online = member.online !== false;
      var lastSeenAt = Number(member.lastSeenAt || 0);
      if (!online && (!lastSeenAt || (now - lastSeenAt) > 120000)) return;
      seen[token] = true;
      out.push(token);
    });

    if (state.token && out.indexOf(state.token) < 0) out.push(String(state.token));
    return out;
  }

  function getRollPromptTargets() {
    var out = [];
    var seen = {};
    var roster = state.campaign && Array.isArray(state.campaign.roster) ? state.campaign.roster : [];
    var members = state.campaign && Array.isArray(state.campaign.members) ? state.campaign.members : [];

    function pushToken(token, name, role, online) {
      var t = String(token || "").trim();
      if (!t || seen[t]) return;
      seen[t] = true;
      out.push({
        token: t,
        name: String(name || "Wayfarer"),
        role: role === "gm" ? "gm" : "player",
        online: online !== false
      });
    }

    roster.forEach(function (row) {
      if (!row || String(row.role || "") !== "player") return;
      pushToken(row.token, row.name, row.role, row.online !== false);
    });

    members.forEach(function (row) {
      if (!row || String(row.role || "") !== "player") return;
      pushToken(row.token, row.name, row.role, true);
    });

    return out;
  }

  function getCampaignRosterMember(token) {
    return getCampaignParticipantRecord(token);
  }

  function getCampaignCharacterSnapshot(token) {
    var member = getCampaignRosterMember(token);
    return member && member.character && typeof member.character === "object" ? member.character : null;
  }

  function getCampaignCharacterName(token, fallback) {
    var wanted = String(token || "").trim();
    if (!wanted) return String(fallback || "Wayfarer");
    var member = getCampaignRosterMember(wanted);
    if (!member) return String(fallback || "Wayfarer");
    return String((member.character && member.character.name) || member.name || fallback || "Wayfarer");
  }

  function getCampaignCharacterDie(token, statKey, fallback) {
    var key = String(statKey || "valor").trim().toLowerCase();
    var minDie = Math.max(4, Number(fallback || 4) || 4);
    var snapshot = getCampaignCharacterSnapshot(token);
    if (!snapshot || !snapshot.stats || typeof snapshot.stats !== "object") return minDie;
    var stats = snapshot.stats;
    var next = Number(stats[key] || 0);
    if (!next && key === "defend") next = Number(stats.defend || stats.body || 0);
    if (!next && key === "valor") next = Number(stats.valor || 0);
    return Math.max(4, Number(next || minDie) || minDie);
  }

  function getPendingCheckById(checkId) {
    var id = String(checkId || "").trim();
    if (!id) return null;
    var checks = ensurePendingChecksState(getCampaignSharedState());
    if (checks.active && checks.active[id] && typeof checks.active[id] === "object") {
      return deepCloneJson(checks.active[id]) || checks.active[id];
    }
    var history = Array.isArray(checks.history) ? checks.history : [];
    for (var i = history.length - 1; i >= 0; i -= 1) {
      var row = history[i];
      if (!row || String(row.id || "") !== id) continue;
      return deepCloneJson(row) || row;
    }
    return null;
  }

  function buildSceneCheckTargetTokens(scope, targetValue, explicitTokens) {
    if (Array.isArray(explicitTokens) && explicitTokens.length) {
      return explicitTokens.map(function (token) {
        return String(token || "").trim();
      }).filter(Boolean);
    }
    var nextScope = String(scope || "").trim().toLowerCase();
    var wanted = String(targetValue || "").trim();
    if (nextScope === "individual" && wanted) return [wanted];
    if (nextScope === "party") {
      return getRollPromptTargets().map(function (row) {
        return String(row && row.token || "").trim();
      }).filter(Boolean);
    }
    return wanted ? [wanted] : [];
  }

  async function resolveSceneCheckOutcome(spec) {
    var details = spec && typeof spec === "object" ? spec : {};
    var checkId = String(details.checkId || "").trim();
    if (!checkId) return { ok: false, error: "Missing shared check id." };
    if (state.role !== "gm") {
      safeNotif("Only the GM can resolve shared check outcomes.", "warn");
      return { ok: false, error: "Only the GM can resolve shared check outcomes." };
    }

    var checkRecord = getPendingCheckById(checkId);
    if (!checkRecord) return { ok: false, error: "Shared check no longer exists." };

    var success = !!details.success;
    var scope = String(details.scope || checkRecord.scope || "individual").trim().toLowerCase();
    if (scope !== "party") scope = "individual";

    var targetTokens = buildSceneCheckTargetTokens(scope, details.targetValue, details.targetTokens);
    var defaultDreadTotal = Math.max(0, Number(checkRecord.dread || 0));
    var rawActionTotal = Number(details.actionTotal);
    var rawDreadTotal = Number(details.dreadTotal);
    var actionTotal = Number.isFinite(rawActionTotal) ? Math.max(0, rawActionTotal) : (success ? defaultDreadTotal : 0);
    var dreadTotal = Number.isFinite(rawDreadTotal) ? Math.max(0, rawDreadTotal) : defaultDreadTotal;
    var failedBy = success
      ? 0
      : Math.max(1, Number(details.failedBy || (dreadTotal - actionTotal)) || 1);
    var margin = success
      ? Math.max(0, Number(details.margin || (actionTotal - dreadTotal)) || 0)
      : failedBy;

    var successRewardType = normalizeSceneCheckRewardType(
      details.successRewardType || (checkRecord.payload && checkRecord.payload.successRewardType) || "successRolls"
    );
    var successRewardAmount = Math.max(1, parseInt(
      details.successRewardAmount != null
        ? details.successRewardAmount
        : ((checkRecord.payload && checkRecord.payload.successRewardAmount != null)
            ? checkRecord.payload.successRewardAmount
            : 1),
      10
    ) || 1);
    var failurePenaltyType = normalizeSceneFailurePenaltyType(
      details.failurePenaltyType != null
        ? details.failurePenaltyType
        : ((checkRecord.payload && checkRecord.payload.failurePenaltyType) || "mentalStress")
    );
    var failurePenaltyScale = normalizeFailurePenaltyScale(
      details.failurePenaltyScale || (checkRecord.payload && checkRecord.payload.failurePenaltyScale) || "margin"
    );
    var failTmw = Math.max(0, parseInt(
      details.failTmw != null
        ? details.failTmw
        : (checkRecord.payload && checkRecord.payload.failTmw),
      10
    ) || 0);

    var characterDelta = details.characterDelta && typeof details.characterDelta === "object"
      ? normalizeSceneCharacterDelta(details.characterDelta)
      : { health: 0, mentalStress: 0, radiation: 0, pathTokens: 0, successRolls: 0 };
    var sharedDelta = details.sharedDelta && typeof details.sharedDelta === "object"
      ? normalizeSceneSharedDelta(details.sharedDelta)
      : { tmw: 0 };

    if (!(details.characterDelta && typeof details.characterDelta === "object")) {
      if (success) {
        characterDelta.successRolls = Math.max(1, successRewardAmount || 1);
      } else {
        var scaledPenaltyAmount = failurePenaltyScale === "margin"
          ? Math.max(1, failedBy || 1)
          : Math.max(1, failedBy || 1);
        if (failurePenaltyType === "health") {
          characterDelta.health = -scaledPenaltyAmount;
        } else if (failurePenaltyType === "radiation") {
          characterDelta.radiation = scaledPenaltyAmount;
        } else if (failurePenaltyType === "mentalStress") {
          characterDelta.mentalStress = scaledPenaltyAmount;
        }
      }
    }
    if (!(details.sharedDelta && typeof details.sharedDelta === "object") && !success) {
      sharedDelta.tmw = failTmw;
    }

    var hasMechanicalEffect = targetTokens.length > 0 && (
      characterDelta.health !== 0 ||
      characterDelta.mentalStress !== 0 ||
      characterDelta.radiation !== 0 ||
      characterDelta.pathTokens !== 0 ||
      characterDelta.successRolls !== 0
    );
    if (sharedDelta.tmw !== 0) hasMechanicalEffect = true;

    var targetNames = targetTokens.map(function (token) {
      return getCampaignCharacterName(token, token);
    }).filter(Boolean);

    var appliedPayload = {
      checkId: checkId,
      label: String(checkRecord.label || details.label || "Shared Check"),
      outcome: success ? "success" : "failure",
      scope: scope,
      targetTokens: targetTokens.slice(),
      targetNames: targetNames.slice(),
      characterDelta: {
        health: characterDelta.health,
        mentalStress: characterDelta.mentalStress,
        radiation: characterDelta.radiation,
        pathTokens: characterDelta.pathTokens,
        successRolls: characterDelta.successRolls
      },
      sharedDelta: {
        tmw: sharedDelta.tmw
      }
    };

    if (hasMechanicalEffect) {
      var applied = await applyGmCheckOutcome({
        checkId: checkId,
        label: String(checkRecord.label || details.label || "Shared Check"),
        outcome: success ? "success" : "failure",
        scope: scope,
        targetTokens: targetTokens,
        characterDelta: characterDelta,
        sharedDelta: sharedDelta
      });
      if (!applied || !applied.ok) {
        return applied || { ok: false, error: "Could not apply campaign outcome." };
      }
      appliedPayload = applied.applied || appliedPayload;
    }

    var outcome = {
      success: success,
      actionTotal: actionTotal,
      dreadTotal: dreadTotal,
      margin: margin,
      failedBy: failedBy,
      manual: !!details.manual,
      resolvedVia: String(details.resolvedVia || "campaign-scene-check"),
      effectsApplied: appliedPayload
    };

    var resolved = resolveGmPendingCheck(checkId, outcome);
    if (!resolved) return { ok: false, error: "Could not resolve shared check." };

    dispatchSceneCheckResolved({
      check: checkRecord,
      outcome: outcome,
      applied: appliedPayload,
      request: details
    });

    return {
      ok: true,
      check: checkRecord,
      outcome: outcome,
      applied: appliedPayload
    };
  }

  function resolvePromptTargetFromMention(rawTarget) {
    var target = String(rawTarget || "").trim();
    if (!target) return { token: "", label: "table" };
    if (target.charAt(0) === "@") target = target.slice(1);
    var canonical = target.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!canonical) return { token: "", label: "table" };
    var targets = getRollPromptTargets();
    for (var i = 0; i < targets.length; i += 1) {
      var row = targets[i] || {};
      var token = String(row.token || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      var name = String(row.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (canonical === token || canonical === name) {
        return { token: String(row.token || ""), label: "@" + String(row.name || "Wayfarer") };
      }
    }
    return { token: "", label: "table", unresolved: String(rawTarget || "") };
  }

  function parsePromptSlashCommand(input) {
    var raw = String(input || "").trim();
    if (!raw || raw.charAt(0) !== "/") return null;
    var bits = raw.split(/\s+/);
    if (!bits.length || String(bits[0] || "").toLowerCase() !== "/prompt") return { command: "unknown" };

    var stat = "valor";
    var dread = 6;
    var targetMention = "";
    var contextParts = [];
    var statSeen = false;
    var validStats = {
      valor: true, body: true, mind: true, spirit: true, lead: true,
      strike: true, shoot: true, defend: true, control: true
    };

    for (var i = 1; i < bits.length; i += 1) {
      var token = String(bits[i] || "").trim();
      if (!token) continue;
      var lower = token.toLowerCase();
      if (!statSeen && validStats[lower]) {
        stat = lower;
        statSeen = true;
        continue;
      }
      if (/^d\d+$/i.test(lower)) {
        dread = Math.max(1, Number(lower.replace(/^d/i, "") || 6));
        continue;
      }
      if (!targetMention && lower.charAt(0) === "@") {
        targetMention = token;
        continue;
      }
      contextParts.push(token);
    }

    var resolvedTarget = resolvePromptTargetFromMention(targetMention);
    var context = contextParts.join(" ").trim();
    var label = (resolvedTarget.token ? (resolvedTarget.label + " · ") : "") + (context || "GM Check");
    return {
      command: "prompt",
      stat: stat,
      dread: dread,
      targetToken: resolvedTarget.token,
      targetLabel: resolvedTarget.token ? resolvedTarget.label : "table",
      targetUnresolved: resolvedTarget.unresolved || "",
      context: context,
      label: label
    };
  }

  function maybeResolveReadyCheck() {
    if (!state.code || state.role !== "gm") return;
    var shared = getMutableCampaignSharedState();
    var ready = ensureReadyCheckState(shared);
    if (!ready.id || String(ready.status || "") !== "pending") return;
    if (!isReadyCheckApproved(ready)) return;
    var cb = readyCheckCallbacks[ready.id];
    ready.status = "approved";
    ready.resolvedAt = Date.now();
    appendSessionTimeline("ready", "Ready check passed: " + String(ready.label || "Shared action") + ".", {
      checkId: ready.id,
      type: ready.type,
      required: Array.isArray(ready.requiredTokens) ? ready.requiredTokens.length : 0,
      responses: getReadyCheckResponseCount(ready)
    });
    if (typeof cb === "function") {
      try { cb(); } catch (_err) {}
    } else {
      applyApprovedPartyRestBoonReadyCheck(ready, shared);
    }
    delete readyCheckCallbacks[ready.id];
    syncSharedState("ready-check-approved");
  }

  function cancelReadyCheck(reason) {
    if (!state.code || state.role !== "gm") return;
    var shared = getMutableCampaignSharedState();
    var ready = ensureReadyCheckState(shared);
    if (!ready.id || String(ready.status || "") !== "pending") return;
    ready.status = "cancelled";
    ready.resolvedAt = Date.now();
    appendSessionTimeline("ready", "Ready check cancelled: " + String(ready.label || "Shared action") + ".", {
      checkId: ready.id,
      reason: String(reason || "cancelled")
    });
    delete readyCheckCallbacks[ready.id];
    syncSharedState("ready-check-cancelled");
  }

  function forceApproveReadyCheck() {
    if (!state.code || state.role !== "gm") return;
    var shared = getMutableCampaignSharedState();
    var ready = ensureReadyCheckState(shared);
    if (!ready.id || String(ready.status || "") !== "pending") return;
    var required = Array.isArray(ready.requiredTokens) ? ready.requiredTokens : [];
    if (!ready.responses || typeof ready.responses !== "object") ready.responses = {};
    required.forEach(function (token) {
      var t = String(token || "");
      if (!t || (ready.responses[t] && typeof ready.responses[t].ready === "boolean")) return;
      ready.responses[t] = {
        ready: true,
        name: "GM override",
        at: Date.now()
      };
    });
    appendSessionTimeline("ready", "Ready check force-approved by GM.", {
      checkId: ready.id,
      label: ready.label
    });
    maybeResolveReadyCheck();
  }

  function respondReadyCheck(readyValue, callback) {
    if (!state.code || !state.connected) {
      if (callback) callback({ ok: false, error: "Join a campaign first." });
      return;
    }
    var shared = getCampaignSharedState();
    var current = shared && shared.readyCheck && typeof shared.readyCheck === "object" ? shared.readyCheck : null;
    if (!current || !current.id || String(current.status || "") !== "pending") {
      if (callback) callback({ ok: false, error: "No active ready check." });
      return;
    }
    var token = String(state.token || "");
    if (!token) {
      if (callback) callback({ ok: false, error: "Missing participant token." });
      return;
    }

    var patch = {
      readyCheck: {
        id: String(current.id || ""),
        response: {
          token: token,
          ready: !!readyValue,
          name: String(state.playerName || ensureName() || "Wayfarer"),
          at: Date.now()
        }
      }
    };
    syncSharedPatch(patch, "ready-check-response").then(function (res) {
      if (callback) callback(res || { ok: false });
    });
  }

  function promptReadyCheckIfNeeded(readyCheck) {
    if (!readyCheck || typeof readyCheck !== "object") return;
    if (!readyCheck.id || String(readyCheck.status || "") !== "pending") return;
    if (state.lastReadyCheckPromptId === readyCheck.id) return;
    if (typeof window.openModal !== "function") return;
    if (!state.token) return;
    var responses = readyCheck.responses && typeof readyCheck.responses === "object" ? readyCheck.responses : {};
    if (responses[state.token] && typeof responses[state.token].ready === "boolean") return;

    state.lastReadyCheckPromptId = readyCheck.id;
    var label = String(readyCheck.label || "Shared action");
    var requester = String(readyCheck.requestedBy || "GM");
    var isPartyRest = String(readyCheck.type || "") === "rest-boon"
      || !!(readyCheck.actionPayload && String(readyCheck.actionPayload.kind || "") === "party-rest-boon");
    var introText = isPartyRest
      ? (escapeHtml(requester) + " wants the party to take <strong style=\"color:var(--gold2);\">" + escapeHtml(label) + "</strong> together.")
      : ("Party consent required before: <strong style=\"color:var(--gold2);\">" + escapeHtml(label) + "</strong>.");
    var helpText = isPartyRest
      ? "Accept Rest to stay on the same day phase and take the shared long rest boon."
      : "Choose ready or not ready. GM can proceed after all are ready.";
    var acceptLabel = isPartyRest ? "Accept Rest" : "Ready";
    var declineLabel = isPartyRest ? "Not Yet" : "Not Ready";
    var html = ''
      + '<div style="font-size:.84rem;color:var(--text2);line-height:1.6;margin-bottom:.5rem;">' + introText + '</div>'
      + '<div style="font-size:.76rem;color:var(--muted2);margin-bottom:.55rem;">' + helpText + '</div>'
      + '<div style="display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;">'
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.respondReadyCheck(true);closeModal();">' + acceptLabel + '</button>'
      + '<button class="btn btn-sm btn-warn" onclick="window.campaignSystem.respondReadyCheck(false);closeModal();">' + declineLabel + '</button>'
      + '</div>';
    window.openModal('Ready Check', html);
  }

  function startReadyCheck(spec, onApproved, callback) {
    if (!state.code || !state.connected || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only connected GM can start ready checks." });
      return;
    }
    var details = spec && typeof spec === "object" ? spec : {};
    var label = String(details.label || "Shared action");
    var required = Array.isArray(details.requiredTokens) && details.requiredTokens.length
      ? details.requiredTokens.map(function (token) { return String(token || ""); }).filter(Boolean)
      : findOnlineParticipantTokens();
    var shared = getMutableCampaignSharedState();
    var ready = ensureReadyCheckState(shared);
    ready.id = "ready-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
    ready.status = "pending";
    ready.type = String(details.type || "shared-action");
    ready.label = label;
    ready.requestedBy = String(state.playerName || ensureName() || "GM");
    ready.requestedAt = Date.now();
    ready.requiredTokens = required;
    ready.responses = {};
    ready.actionPayload = details.actionPayload && typeof details.actionPayload === "object"
      ? deepCloneJson(details.actionPayload) || null
      : null;
    ready.resolvedAt = 0;
    if (state.token) {
      ready.responses[state.token] = { ready: true, name: ready.requestedBy, at: Date.now() };
    }
    if (typeof onApproved === "function") {
      readyCheckCallbacks[ready.id] = onApproved;
    }
    appendSessionTimeline("ready", "Ready check started: " + label + ".", {
      checkId: ready.id,
      type: ready.type,
      required: required.length
    });
    syncSharedState("ready-check-start");
    // Resolve immediately when all required responses are already present (e.g., GM-only).
    maybeResolveReadyCheck();
    if (callback) callback({ ok: true, id: ready.id });
  }

  function requestSharedConsent(label, onApproved, callback) {
    if (typeof onApproved !== "function") {
      if (callback) callback({ ok: false, error: "Missing approval callback." });
      return;
    }
    if (!state.code || !state.connected) {
      onApproved();
      if (callback) callback({ ok: true, local: true });
      return;
    }
    if (state.role !== "gm") {
      onApproved();
      if (callback) callback({ ok: true, local: true });
      return;
    }
    var runApproved = function () {
      appendSessionTimeline("area", "Area joined: " + String(label || "Area") + ".", {
        label: String(label || "Area")
      });
      onApproved();
    };
    startReadyCheck({
      type: "area-entry",
      label: String(label || "Enter area"),
      actionPayload: { kind: "area-entry", label: String(label || "Enter area") }
    }, runApproved, callback);
  }

  async function requestPartyRestBoon(spec) {
    var details = spec && typeof spec === "object" ? spec : {};
    var label = String(details.label || "Rest").trim() || "Rest";
    var boonKey = String(details.boonKey || "").trim();
    var sourceKind = String(details.sourceKind || "").trim();
    var sourceRef = details.sourceRef && typeof details.sourceRef === "object"
      ? (deepCloneJson(details.sourceRef) || details.sourceRef)
      : {};

    if (!state.code || !state.connected || !state.socket) {
      return { ok: false, handled: false, local: true };
    }

    var targetTokens = findOnlinePlayerParticipantTokens();
    if (!targetTokens.length) {
      return { ok: false, handled: false, local: true };
    }

    if (state.role === "gm") {
      startReadyCheck({
        type: "rest-boon",
        label: label,
        requiredTokens: targetTokens,
        actionPayload: {
          kind: "party-rest-boon",
          boonKey: boonKey,
          label: label,
          sourceKind: sourceKind,
          sourceRef: sourceRef,
          targetTokens: targetTokens.slice(),
          requestedBy: String(state.playerName || ensureName() || "GM"),
          requestedAt: Date.now()
        }
      }, null, function (res) {
        if (!res || !res.ok) {
          safeNotif((res && res.error) || "Could not start shared rest.", "warn");
          return;
        }
        safeNotif(label + ": waiting for party acceptance.", "info");
      });
      return { ok: true, handled: true, campaign: true };
    }

    var res = await emitWithAck("campaign:requestPartyRestBoon", {
      boonKey: boonKey,
      label: label,
      sourceKind: sourceKind,
      sourceRef: sourceRef
    });
    if (!res || !res.ok) {
      safeNotif((res && res.error) || "Could not request shared rest.", "warn");
      return res || { ok: false, handled: true };
    }
    safeNotif(label + ": rest request sent to the table.", "info");
    return { ok: true, handled: true, campaign: true };
  }

  function advanceSharedGameDate(intervals) {
    var count = Math.max(1, Math.min(8, Number(intervals || 1) || 1));
    if (typeof window.S === "undefined" || !window.S) return count;
    if (!window.S.gameDate || typeof window.S.gameDate !== "object") {
      window.S.gameDate = { day: 1, month: 1, year: 1, phase: 0 };
    }
    var d = window.S.gameDate;
    for (var i = 0; i < count; i++) {
      if (typeof window.advanceProvincePhasePenalty === "function") {
        var beforePhase = Number(d.phase || 0) || 0;
        window.advanceProvincePhasePenalty(1);
        if ((Number(d.phase || 0) || 0) === beforePhase) {
          d.phase = beforePhase + 1;
          if (typeof window.updateDateUI === "function") {
            try { window.updateDateUI(); } catch (_err) {}
          }
        }
      } else {
        d.phase = (Number(d.phase || 0) + 1) % 4;
        if (d.phase === 0) {
          d.day = (Number(d.day || 1) + 1) % 29;
          if (d.day === 1) {
            d.month = (Number(d.month || 1) + 1) % 13;
            if (d.month === 1) {
              d.year = (Number(d.year || 1) + 1);
            }
          }
        }
      }
    }
    return count;
  }

  function suppressIntroForCampaignMode() {
    if (typeof window === "undefined") return;
    window.__BTL_SKIP_INTRO__ = true;
    window.__BTL_SKIP_INTRO_MULTIPLAYER__ = true;
    if (window.introSystem && typeof window.introSystem.suppressForMultiplayer === "function") {
      try {
        window.introSystem.suppressForMultiplayer();
        return;
      } catch (_err) {}
    }
    var introOverlay = document.getElementById("introPage");
    if (introOverlay) {
      introOverlay.style.display = "none";
    }
  }

  function refreshSettingsModeFromCampaign() {
    if (!window.settingsSystem || typeof window.settingsSystem.setGameMode !== "function") return;
    if (!state.code) {
      window.settingsSystem.setGameMode("solo", { silent: true });
      return;
    }
    suppressIntroForCampaignMode();
    if (state.role === "gm") {
      window.settingsSystem.setGameMode("gm", { silent: true });
      return;
    }
    if (state.role) {
      window.settingsSystem.setGameMode("campaign", { silent: true });
    }
  }

  function makeEconomyLedgerEvent(resource, delta, reason) {
    var token = String(state.token || "");
    var name = String(state.playerName || ensureName() || "Wayfarer");
    return {
      id: "eco-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
      resource: String(resource || "unknown"),
      delta: Number(delta || 0),
      reason: String(reason || "change"),
      token: token,
      name: name,
      at: Date.now()
    };
  }

  function recordEconomyDelta(resource, delta, reason) {
    var val = Number(delta || 0);
    if (!Number.isFinite(val) || val === 0) return;
    if (!state.code) return;
    var eventRow = makeEconomyLedgerEvent(resource, val, reason);
    state.localEconomyLedger.push(eventRow);
    if (state.localEconomyLedger.length > 120) {
      state.localEconomyLedger = state.localEconomyLedger.slice(-120);
    }
  }

  function mergeEconomyLedger(currentLedger) {
    var merged = [];
    var map = {};
    var base = Array.isArray(currentLedger) ? currentLedger : [];
    var local = Array.isArray(state.localEconomyLedger) ? state.localEconomyLedger : [];
    base.concat(local).forEach(function (entry) {
      if (!entry || typeof entry !== "object") return;
      var id = String(entry.id || "");
      if (!id || map[id]) return;
      map[id] = true;
      merged.push(entry);
    });
    merged.sort(function (a, b) { return Number(a.at || 0) - Number(b.at || 0); });
    if (merged.length > 180) merged = merged.slice(-180);
    return merged;
  }

  function getCampaignSharedState() {
    return state.campaign && state.campaign.shared && state.campaign.shared.state && typeof state.campaign.shared.state === "object"
      ? state.campaign.shared.state
      : {};
  }

  function safeJsonHash(value) {
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return "";
    }
  }

  function getMutableCampaignSharedState() {
    if (!state.campaign || typeof state.campaign !== "object") return {};
    if (!state.campaign.shared || typeof state.campaign.shared !== "object") {
      state.campaign.shared = { state: {}, tmw: 0, stateVersion: 0 };
    }
    if (!state.campaign.shared.state || typeof state.campaign.shared.state !== "object") {
      state.campaign.shared.state = {};
    }
    return state.campaign.shared.state;
  }

  function normalizeItemLabel(value) {
    if (typeof value === "string") {
      var txt = value.trim();
      return txt || "Item";
    }
    if (value && typeof value === "object") {
      var named = String(value.name || value.label || "").trim();
      if (named) return named;
      try {
        var raw = JSON.stringify(value);
        return raw && raw !== "{}" ? raw.slice(0, 80) : "Item";
      } catch (_err) {
        return "Item";
      }
    }
    var fallback = String(value || "").trim();
    return fallback || "Item";
  }

  function normalizeBackpackItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function (entry) { return normalizeItemLabel(entry); }).filter(Boolean).slice(0, 20);
  }

  function addItemToBackpack(itemName) {
    if (typeof window.S === "undefined" || !window.S) return false;
    var item = normalizeItemLabel(itemName);
    if (!item) return false;
    if (!Array.isArray(window.S.backpack)) {
      window.S.backpack = Array(10).fill("");
    }
    var slot = window.S.backpack.indexOf("");
    if (slot < 0) {
      return false;
    }
    window.S.backpack[slot] = item;
    if (typeof window.renderBackpackUI === "function") {
      window.renderBackpackUI();
    }
    return true;
  }

  function collectSharedState() {
    var gameState = syncWindowStateAlias();
    if (!gameState) return {};
    var current = getCampaignSharedState();
    var existingSelections = current && current.provinceSelections && typeof current.provinceSelections === "object"
      ? deepCloneJson(current.provinceSelections) || {}
      : {};
    var mySelection = (typeof window.getProvinceSelectedKey === "function") ? String(window.getProvinceSelectedKey() || "") : "";
    if (state.token) {
      if (mySelection) {
        existingSelections[state.token] = {
          key: mySelection,
          name: state.playerName || ensureName(),
          at: Date.now()
        };
      } else if (existingSelections[state.token]) {
        delete existingSelections[state.token];
      }
    }
    var shared = {
      credits: Math.max(0, Number(gameState.credits || 0)),
      renown: Math.max(0, Number(gameState.renown || 0)),
      mentalStress: Math.max(0, Number((typeof current.mentalStress === "number" ? current.mentalStress : gameState.mentalStress) || 0)),
      missionTokens: deepCloneJson(gameState.missionTokens || {}),
      activeMissions: deepCloneJson(gameState.activeMissions || []),
      completedMissions: deepCloneJson(gameState.completedMissions || []),
      availableJobs: deepCloneJson(gameState.availableJobs || []),
      storyline: deepCloneJson(gameState.storyline || {}),
      caravan: deepCloneJson(gameState.caravan || {}),
      holding: deepCloneJson(gameState.holding || {}),
      starship: deepCloneJson(gameState.starship || {}),
      factionRenown: deepCloneJson(gameState.factionRenown || {}),
      factionBases: deepCloneJson(gameState.factionBases || {}),
      factionWayfarerTasks: deepCloneJson(gameState.factionWayfarerTasks || []),
      factionNarrative: deepCloneJson(gameState.factionNarrative || {}),
      rival: deepCloneJson((gameState.rival && typeof gameState.rival === "object" ? gameState.rival : current.rival) || null),
      partyStash: Array.isArray(current.partyStash) ? current.partyStash.slice() : [],
      economyLedger: mergeEconomyLedger(current.economyLedger),
      provinceSelections: existingSelections,
      readyCheck: deepCloneJson(current.readyCheck || ensureReadyCheckState(current)),
      partyRestEvent: deepCloneJson(current.partyRestEvent || ensurePartyRestEventState(current)),
      pendingChecks: deepCloneJson(current.pendingChecks || ensurePendingChecksState(current)),
      sessionTimeline: deepCloneJson(current.sessionTimeline || ensureSessionTimelineState(current)),
      gmForge: deepCloneJson(current.gmForge || ensureGmForgeState(current)),
      campaignChronicle: deepCloneJson(current.campaignChronicle || ensureCampaignChronicleState(current)),
      unresolvedHooks: deepCloneJson(current.unresolvedHooks || ensureCampaignHooksState(current))
    };
    var shouldPushAuthoritativeMaps = (state.role === "gm") || !state.code;
    if (shouldPushAuthoritativeMaps) {
      shared.provinceMap = buildProvinceSharedSnapshot(mySelection);
    }
    if (shouldPushAuthoritativeMaps) {
      shared.mapFog = deepCloneJson(gameState.mapFog || {});
      shared.lastSea = deepCloneJson(gameState.lastSea || {});
      shared.starSystem = deepCloneJson(gameState.starSystem || {});
      shared.worldThatWas = deepCloneJson(gameState.worldThatWas || {});
      shared.gameDate = deepCloneJson(gameState.gameDate || {});
      shared.combatScene = collectCombatSceneState();
      shared.gmSettings = deepCloneJson(current.gmSettings || ensureGmSettings());
      shared.campaignCombat = deepCloneJson(current.campaignCombat || ensureCampaignCombatState());
      shared.areaSession = deepCloneJson(current.areaSession || ensureAreaSessionState(current));
      shared.campaignTravel = deepCloneJson(current.campaignTravel || ensureCampaignTravelState());
      shared.actionQueue = deepCloneJson(current.actionQueue || ensureActionQueue());
      shared.characterInventories = deepCloneJson(current.characterInventories || ensureCharacterInventories());
      shared.characterDeathStates = deepCloneJson(current.characterDeathStates || ensureCharacterDeathStates());
      shared.contestedRolls = deepCloneJson(current.contestedRolls || ensureContestedRolls());
      shared.characterDice = deepCloneJson(current.characterDice || ensureCharacterDice());
      if (gameState.worldState && typeof gameState.worldState === "object") {
        shared.worldState = deepCloneJson(gameState.worldState);
      }
    }
    return shared;
  }

  function collectProgressSharedPatch() {
    var gameState = syncWindowStateAlias();
    if (!gameState) return {};
    var patch = {
      renown: Math.max(0, Number(gameState.renown || 0)),
      credits: Math.max(0, Number(gameState.credits || 0)),
      mentalStress: Math.max(0, Number(gameState.mentalStress || 0)),
      missionTokens: deepCloneJson(gameState.missionTokens || {}),
      activeMissions: deepCloneJson(gameState.activeMissions || []),
      completedMissions: deepCloneJson(gameState.completedMissions || []),
      availableJobs: deepCloneJson(gameState.availableJobs || []),
      storyline: deepCloneJson(gameState.storyline || {}),
      holding: deepCloneJson(gameState.holding || {}),
      caravan: deepCloneJson(gameState.caravan || {}),
      factionWayfarerTasks: deepCloneJson(gameState.factionWayfarerTasks || []),
      rival: deepCloneJson(gameState.rival || {}),
      worldState: deepCloneJson(gameState.worldState || {})
    };
    if (state.role !== "player") {
      patch.factionNarrative = deepCloneJson(gameState.factionNarrative || {});
      patch.factionRenown = deepCloneJson(gameState.factionRenown || {});
      patch.factionBases = deepCloneJson(gameState.factionBases || {});
    }
    return patch;
  }

  function mergeCombatScenePatchWithCurrent(patch) {
    if (!patch || typeof patch !== "object" || !patch.combatScene || typeof patch.combatScene !== "object") return patch;
    var shared = getCampaignSharedState();
    var currentScene = shared && shared.combatScene && typeof shared.combatScene === "object"
      ? shared.combatScene
      : null;
    if (!currentScene) return patch;
    var nextPatch = deepCloneJson(patch) || {};
    var incomingScene = nextPatch.combatScene && typeof nextPatch.combatScene === "object"
      ? nextPatch.combatScene
      : {};
    var hasSceneEditor = Object.prototype.hasOwnProperty.call(incomingScene, "sceneEditor");
    var hasSyncMeta = Object.prototype.hasOwnProperty.call(incomingScene, "syncMeta");
    var mergedScene = Object.assign({}, deepCloneJson(currentScene) || {}, deepCloneJson(nextPatch.combatScene) || {});
    if (!hasSceneEditor && !mergedScene.sceneEditor && currentScene.sceneEditor && typeof currentScene.sceneEditor === "object") {
      mergedScene.sceneEditor = deepCloneJson(currentScene.sceneEditor) || currentScene.sceneEditor;
    }
    if (!hasSyncMeta && !mergedScene.syncMeta && currentScene.syncMeta && typeof currentScene.syncMeta === "object") {
      mergedScene.syncMeta = deepCloneJson(currentScene.syncMeta) || currentScene.syncMeta;
    }
    nextPatch.combatScene = mergedScene;
    return nextPatch;
  }

  function applyLocalSharedPatch(patch) {
    if (!patch || typeof patch !== "object") return;
    var current = getMutableCampaignSharedState();
    if (!current || typeof current !== "object") return;
    var nextPatch = deepCloneJson(patch) || {};
    if (nextPatch.combatScene && typeof nextPatch.combatScene === "object") {
      nextPatch = mergeCombatScenePatchWithCurrent(nextPatch);
    }
    Object.keys(nextPatch).forEach(function (key) {
      if (key === "__combatSceneSyncGeneration" || key === "__combatSceneAutoSync") return;
      current[key] = deepCloneJson(nextPatch[key]);
    });
  }

  function getProgressHash() {
    try {
      return JSON.stringify(collectProgressSharedPatch());
    } catch (_err) {
      return "";
    }
  }

  function refreshProgressHash() {
    state.lastProgressHash = getProgressHash();
  }

  function applySharedState(sharedState, sharedVersion, previousSharedState) {
    if (!sharedState || typeof sharedState !== "object") return;
    var nextVersion = Math.max(0, Number(sharedVersion || 0) || 0);
    if (nextVersion && nextVersion < state.lastSharedVersion) return;
    if (typeof window.S === "undefined" || !window.S) return;

    var previousShared = previousSharedState && typeof previousSharedState === "object"
      ? previousSharedState
      : null;
    var localStarState = cloneClientLocalStarState();
    var localWorldState = cloneClientLocalWorldState();
    var localSeaState = cloneClientLocalSeaState();
    var localProvinceState = cloneClientLocalProvinceState();
    var nextProvinceSelectionsHash = safeJsonHash(sharedState.provinceSelections || {});
    var provinceSelectionsChanged = nextProvinceSelectionsHash !== state.lastProvinceSelectionsHash;
    var prevMapFogHash = safeJsonHash(window.S.mapFog || {});
    var nextMapFogHash = safeJsonHash(sharedState.mapFog || {});
    var mapFogChanged = !!(sharedState.mapFog && typeof sharedState.mapFog === "object" && nextMapFogHash !== prevMapFogHash);

    state.applyingSharedState = true;
    try {
      if (typeof sharedState.credits === "number") {
        state.suppressCreditsEmit = true;
        window.S.credits = Math.max(0, Number(sharedState.credits || 0));
        state.lastKnownCredits = window.S.credits;
        setTimeout(function () { state.suppressCreditsEmit = false; }, 0);
      }
      if (typeof sharedState.renown === "number") {
        state.suppressRenownEmit = true;
        window.S.renown = Math.max(0, Number(sharedState.renown || 0));
        state.lastKnownRenown = window.S.renown;
        setTimeout(function () { state.suppressRenownEmit = false; }, 0);
      }
      if (typeof sharedState.mentalStress === "number") {
        state.suppressMentalStressEmit = true;
        window.S.mentalStress = Math.max(0, Number(sharedState.mentalStress || 0));
        state.lastKnownMentalStress = window.S.mentalStress;
        setTimeout(function () { state.suppressMentalStressEmit = false; }, 0);
      }
      if (sharedState.storyline && typeof sharedState.storyline === "object") {
        window.S.storyline = deepCloneJson(sharedState.storyline) || {};
      }
      if (sharedState.mapFog && typeof sharedState.mapFog === "object") {
        window.S.mapFog = deepCloneJson(sharedState.mapFog) || {};
      }
      if (sharedState.caravan && typeof sharedState.caravan === "object") {
        window.S.caravan = deepCloneJson(sharedState.caravan) || {};
      }
      if (sharedState.missionTokens && typeof sharedState.missionTokens === "object") {
        window.S.missionTokens = deepCloneJson(sharedState.missionTokens) || {};
      }
      if (Array.isArray(sharedState.activeMissions)) {
        window.S.activeMissions = deepCloneJson(sharedState.activeMissions) || [];
      }
      if (Array.isArray(sharedState.completedMissions)) {
        window.S.completedMissions = deepCloneJson(sharedState.completedMissions) || [];
      }
      if (Array.isArray(sharedState.availableJobs)) {
        window.S.availableJobs = deepCloneJson(sharedState.availableJobs) || [];
      }
      if (sharedState.holding && typeof sharedState.holding === "object") {
        window.S.holding = deepCloneJson(sharedState.holding) || {};
      }
      if (sharedState.starship && typeof sharedState.starship === "object") {
        window.S.starship = deepCloneJson(sharedState.starship) || {};
      }
      if (sharedState.factionRenown && typeof sharedState.factionRenown === "object") {
        window.S.factionRenown = deepCloneJson(sharedState.factionRenown) || {};
      }
      if (sharedState.factionBases && typeof sharedState.factionBases === "object") {
        window.S.factionBases = deepCloneJson(sharedState.factionBases) || {};
      }
      if (Array.isArray(sharedState.factionWayfarerTasks)) {
        window.S.factionWayfarerTasks = deepCloneJson(sharedState.factionWayfarerTasks) || [];
      }
      if (sharedState.factionNarrative && typeof sharedState.factionNarrative === "object") {
        window.S.factionNarrative = deepCloneJson(sharedState.factionNarrative) || {};
      }
      if (sharedState.rival && typeof sharedState.rival === "object") {
        window.S.rival = deepCloneJson(sharedState.rival) || {};
        if (typeof window.renderRivalCombatStatus === "function") {
          try { window.renderRivalCombatStatus(); } catch (_err) {}
        }
      }
      if (sharedState.lastSea && typeof sharedState.lastSea === "object") {
        window.S.lastSea = deepCloneJson(sharedState.lastSea) || {};
        applyClientLocalSeaState(localSeaState);
      }
      if (sharedState.starSystem && typeof sharedState.starSystem === "object") {
        window.S.starSystem = deepCloneJson(sharedState.starSystem) || {};
        if (window.S.starSystem && Array.isArray(window.S.starSystem.hexes) && window.S.starSystem.hexes.length) {
          window._lastGeneratedGalaxy = deepCloneJson(window.S.starSystem);
        }
        applyClientLocalStarState(localStarState);
      }
      if (sharedState.worldThatWas && typeof sharedState.worldThatWas === "object") {
        window.S.worldThatWas = deepCloneJson(sharedState.worldThatWas) || {};
        applyClientLocalWorldState(localWorldState);
      }
      if (sharedState.gameDate && typeof sharedState.gameDate === "object") {
        var current = getCampaignSharedState() || {};
        var previousGameDate = previousShared && previousShared.gameDate && typeof previousShared.gameDate === "object"
          ? previousShared.gameDate
          : null;
        var previousTravel = previousShared && previousShared.campaignTravel && typeof previousShared.campaignTravel === "object"
          ? previousShared.campaignTravel
          : null;
        var incomingTravel = sharedState.campaignTravel && typeof sharedState.campaignTravel === "object"
          ? sharedState.campaignTravel
          : null;
        var previousTravelAt = Math.max(0, Number(previousTravel && previousTravel.updatedAt || 0));
        var incomingTravelAt = Math.max(0, Number(incomingTravel && incomingTravel.updatedAt || 0));
        var keepPreviousGameDate = !!(
          state.role === "gm"
          && previousGameDate
          && previousTravelAt > 0
          && previousTravelAt > incomingTravelAt
        );
        window.S.gameDate = keepPreviousGameDate
          ? (deepCloneJson(previousGameDate) || {})
          : (deepCloneJson(sharedState.gameDate) || {});
        current.gameDate = deepCloneJson(window.S.gameDate) || {};
      }
      if (sharedState.combatScene && typeof sharedState.combatScene === "object") {
        var previousCombatSceneEditor = window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object"
          ? (deepCloneJson(window.S.combat.sceneEditor) || window.S.combat.sceneEditor)
          : null;
        var combatSceneHasSceneEditor = Object.prototype.hasOwnProperty.call(sharedState.combatScene, "sceneEditor");
        var combatSceneHasSyncMeta = Object.prototype.hasOwnProperty.call(sharedState.combatScene, "syncMeta");
        var combatSceneCombat = deepCloneJson(sharedState.combatScene.combat || {}) || {};
        var normalizedCombatSceneEnemies = normalizeCombatSceneEnemiesForSharedState(sharedState.combatScene.enemies, combatSceneCombat);
        var sharedEnemyDread = resolveCombatEnemyDread(combatSceneCombat, normalizedCombatSceneEnemies);
        if (sharedEnemyDread > 0) {
          combatSceneCombat.enemyDread = sharedEnemyDread;
        }
        window.S.combat = combatSceneCombat;
        window.S.enemies = normalizedCombatSceneEnemies;
        if (sharedState.combatScene.naval && typeof sharedState.combatScene.naval === "object") {
          window.S.naval = deepCloneJson(sharedState.combatScene.naval) || window.S.naval || null;
        }
        if (sharedState.combatScene.caravan && typeof sharedState.combatScene.caravan === "object") {
          window.S.caravan = deepCloneJson(sharedState.combatScene.caravan) || window.S.caravan || null;
        }
        if (sharedState.combatScene.combatMap && typeof sharedState.combatScene.combatMap === "object") {
          window.S.combatMap = deepCloneJson(sharedState.combatScene.combatMap) || window.S.combatMap || null;
        }
        if (sharedState.combatScene.combatAugState && typeof sharedState.combatScene.combatAugState === "object") {
          window.S.combatAugState = deepCloneJson(sharedState.combatScene.combatAugState) || window.S.combatAugState || null;
        }
        if (sharedState.combatScene.sceneEditor && typeof sharedState.combatScene.sceneEditor === "object") {
          window.S.combat.sceneEditor = deepCloneJson(sharedState.combatScene.sceneEditor) || null;
          if (typeof window.applySharedCombatSceneEditorState === "function") {
            try {
              window.applySharedCombatSceneEditorState(window.S.combat.sceneEditor, {
                refreshUi: true,
                preserveCombatMap: !!(sharedState.combatScene.combatMap && typeof sharedState.combatScene.combatMap === "object")
              });
            } catch (_err) {}
          }
        } else if (combatSceneHasSceneEditor) {
          window.S.combat.sceneEditor = null;
        } else if (previousCombatSceneEditor) {
          window.S.combat.sceneEditor = previousCombatSceneEditor;
        }
        if (sharedState.combatScene.syncMeta && typeof sharedState.combatScene.syncMeta === "object") {
          window.S.combat.sceneSyncMeta = deepCloneJson(sharedState.combatScene.syncMeta) || null;
        } else if (combatSceneHasSyncMeta) {
          window.S.combat.sceneSyncMeta = null;
        }
        state.lastCombatSceneHash = hashCombatSceneState(sharedState.combatScene);
        var current = getCampaignSharedState() || {};
        current.combatScene = deepCloneJson(sharedState.combatScene) || {
          combat: {},
          enemies: [],
          naval: null,
          caravan: null,
          combatMap: null,
          combatAugState: null,
          sceneEditor: null
        };
        if (state.role === "player" && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object") {
          var sharedCombatForPrompt = sharedState.campaignCombat && typeof sharedState.campaignCombat === "object"
            ? sharedState.campaignCombat
            : (current.campaignCombat && typeof current.campaignCombat === "object" ? current.campaignCombat : null);
          maybePromptSharedCombatModeFromScene(sharedCombatForPrompt, window.S.combat.sceneEditor, sharedState.combatScene.syncMeta);
        }
      }
      if (sharedState.gmSettings && typeof sharedState.gmSettings === "object") {
        var current = getCampaignSharedState() || {};
        if (!current.gmSettings) current.gmSettings = {};
        Object.assign(current.gmSettings, sharedState.gmSettings);
        ensureGmSettings(current);
        applyCampaignSoundtrackFromSharedState(current);
      }
      if (sharedState.areaSession && typeof sharedState.areaSession === "object") {
        var current = getCampaignSharedState() || {};
        current.areaSession = deepCloneJson(sharedState.areaSession) || ensureAreaSessionState(current);
      }
      if (sharedState.campaignCombat && typeof sharedState.campaignCombat === "object") {
        var current = getCampaignSharedState() || {};
        var incomingCombatState = sharedState.campaignCombat && typeof sharedState.campaignCombat === "object"
          ? (deepCloneJson(sharedState.campaignCombat) || {})
          : {};
        var previousCombat = current && current.campaignCombat && typeof current.campaignCombat === "object"
          ? (deepCloneJson(current.campaignCombat) || {})
          : {};
        var previousVttSession = previousCombat && previousCombat.vttSession && typeof previousCombat.vttSession === "object"
          ? (deepCloneJson(previousCombat.vttSession) || previousCombat.vttSession)
          : null;
        if (!current.campaignCombat) current.campaignCombat = {};
        Object.assign(
          current.campaignCombat,
          shouldPreferLocalCampaignCombat(previousCombat, incomingCombatState)
            ? previousCombat
            : incomingCombatState
        );
        var mergedCombat = ensureCampaignCombatState(current);
        if (mergedCombat.active && !mergedCombat.vttSession && previousVttSession) {
          var hasSharedSceneEditor = !!(current.combatScene && current.combatScene.sceneEditor && typeof current.combatScene.sceneEditor === "object");
          var hasLocalSceneEditor = !!(window.S && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object");
          if (hasSharedSceneEditor || hasLocalSceneEditor) {
            mergedCombat.vttSession = deepCloneJson(previousVttSession) || previousVttSession;
          }
        }
        var combatStartedAt = Number(mergedCombat.startedAt || 0);
        if (mergedCombat.active && combatStartedAt && combatStartedAt !== state.lastCampaignCombatPromptAt) {
          state.lastCampaignCombatPromptAt = combatStartedAt;
          safeNotif("Campaign combat started. The GM can now prompt each Wayfarer from the Combat tab.", "warn");
        }
        var vttSession = mergedCombat.vttSession && typeof mergedCombat.vttSession === "object" ? mergedCombat.vttSession : null;
        var vttAt = Number(vttSession && vttSession.enteredAt || 0);
        var sharedSceneEditorSnapshot = sharedState.combatScene && sharedState.combatScene.sceneEditor && typeof sharedState.combatScene.sceneEditor === "object"
          ? sharedState.combatScene.sceneEditor
          : null;
        var hasRenderableSharedScenePrompt = hasRenderableCombatSceneEditorSnapshot(sharedSceneEditorSnapshot);
        if (mergedCombat.active && state.role === "player" && vttAt && vttAt !== state.lastCampaignVttPromptAt && hasRenderableSharedScenePrompt) {
          state.lastCampaignVttPromptAt = vttAt;
          promptCampaignCombatModeInvite(vttSession);
        }
        var activeToken = String(getCampaignCombatActiveToken(mergedCombat) || "");
        var activePromptKey = [
          String(mergedCombat.phase || "wayfarer"),
          String(Math.max(1, Number(mergedCombat.round || 1))),
          activeToken
        ].join("|");
        var previousPromptKey = [
          String(previousCombat.phase || "wayfarer"),
          String(Math.max(1, Number(previousCombat.round || 1))),
          String(getCampaignCombatActiveToken(previousCombat) || "")
        ].join("|");
        if (mergedCombat.active && state.role === "player" && activeToken && activeToken !== getCampaignEnemyTurnToken() && activePromptKey !== previousPromptKey && activePromptKey !== state.lastCampaignActorPromptKey) {
          state.lastCampaignActorPromptKey = activePromptKey;
          if (String(state.token || "") === activeToken) {
            safeNotif("The GM prompted you to act in combat.", "good");
          }
        } else if (!activeToken) {
          state.lastCampaignActorPromptKey = "";
        }
        var enemyActionRequest = getCampaignEnemyActionRequest(mergedCombat);
        var enemyPromptKey = enemyActionRequest
          ? [
            String(enemyActionRequest.id || ""),
            String(enemyActionRequest.status || "pending"),
            (Array.isArray(enemyActionRequest.resolvedTokens) ? enemyActionRequest.resolvedTokens : []).join(",")
          ].join("|")
          : "";
        var enemyTargetedToMe = !!(state.role === "player" && state.token && enemyActionRequest && isCampaignEnemyActionTargetToken(enemyActionRequest, state.token));
        if (mergedCombat.active && enemyTargetedToMe && String(enemyActionRequest.status || "pending") === "pending" && enemyPromptKey && enemyPromptKey !== state.lastCampaignEnemyPromptKey) {
          state.lastCampaignEnemyPromptKey = enemyPromptKey;
          safeNotif("Enemy action targeting you. Click Enemy Action in the Combat tab to resolve it.", "warn");
        } else if (!enemyTargetedToMe || !enemyActionRequest || String(enemyActionRequest.status || "") === "resolved") {
          state.lastCampaignEnemyPromptKey = "";
        }
        if (!mergedCombat.active) {
          state.lastCampaignCombatPromptAt = 0;
          state.lastCampaignActorPromptKey = "";
          state.lastCampaignEnemyPromptKey = "";
          state.lastCampaignVttPromptAt = 0;
          state.lastCampaignScenePromptKey = "";
        }
      }
      if (sharedState.campaignTravel && typeof sharedState.campaignTravel === "object") {
        var current = getCampaignSharedState() || {};
        var previousTravel = previousShared && previousShared.campaignTravel && typeof previousShared.campaignTravel === "object"
          ? previousShared.campaignTravel
          : null;
        var incomingTravel = deepCloneJson(sharedState.campaignTravel) || {};
        var previousTravelAt = Math.max(0, Number(previousTravel && previousTravel.updatedAt || 0));
        var incomingTravelAt = Math.max(0, Number(incomingTravel.updatedAt || 0));
        var keepPreviousTravel = !!(
          state.role === "gm"
          && previousTravel
          && previousTravelAt > 0
          && previousTravelAt > incomingTravelAt
        );
        if (!current.campaignTravel) current.campaignTravel = {};
        Object.assign(current.campaignTravel, keepPreviousTravel
          ? (deepCloneJson(previousTravel) || {})
          : incomingTravel);
        applyCampaignTravelState(current.campaignTravel);
      }
      if (sharedState.readyCheck && typeof sharedState.readyCheck === "object") {
        var current = getCampaignSharedState() || {};
        var previousReadyCheck = previousShared && previousShared.readyCheck && typeof previousShared.readyCheck === "object"
          ? previousShared.readyCheck
          : null;
        var incomingReadyCheck = deepCloneJson(sharedState.readyCheck) || ensureReadyCheckState(current);
        var previousReadyStamp = Math.max(
          Number(previousReadyCheck && previousReadyCheck.requestedAt || 0),
          Number(previousReadyCheck && previousReadyCheck.resolvedAt || 0)
        );
        var incomingReadyStamp = Math.max(
          Number(incomingReadyCheck && incomingReadyCheck.requestedAt || 0),
          Number(incomingReadyCheck && incomingReadyCheck.resolvedAt || 0)
        );
        var keepPreviousReadyCheck = !!(
          state.role === "gm"
          && previousReadyCheck
          && String(previousReadyCheck.status || "") === "pending"
          && previousReadyStamp > 0
          && previousReadyStamp > incomingReadyStamp
          && String(previousReadyCheck.id || "") !== String(incomingReadyCheck.id || "")
        );
        current.readyCheck = keepPreviousReadyCheck
          ? (deepCloneJson(previousReadyCheck) || ensureReadyCheckState(current))
          : incomingReadyCheck;
        if (String(current.readyCheck.status || "") !== "pending") {
          state.lastReadyCheckPromptId = "";
        }
      }
      if (sharedState.partyRestEvent && typeof sharedState.partyRestEvent === "object") {
        var current = getCampaignSharedState() || {};
        current.partyRestEvent = deepCloneJson(sharedState.partyRestEvent) || ensurePartyRestEventState(current);
        var restEvent = current.partyRestEvent;
        var targetTokens = Array.isArray(restEvent.targetTokens) ? restEvent.targetTokens : [];
        var appliesToMe = !!(state.token && targetTokens.indexOf(String(state.token)) >= 0);
        var restEventId = String(restEvent.id || "");
        var restAppliedAt = Math.max(0, Number(restEvent.appliedAt || 0));
        var rosterUpdatedAt = getRosterCharacterUpdatedAt(state.token);
        if (
          restEventId
          && appliesToMe
          && restEventId !== String(state.lastAppliedPartyRestEventId || "")
          && (!rosterUpdatedAt || restAppliedAt > rosterUpdatedAt)
        ) {
          var applied = applyLocalRestBoonEffects(restEvent.boonKey, restEvent.label, {
            skipNotif: true,
            preventStaleAuthoritativeOverwrite: true,
            authoritativeAt: restAppliedAt
          });
          if (applied) {
            state.lastAppliedPartyRestEventId = restEventId;
            safeNotif((restEvent.label || "Rest") + ": party rest applied to your sheet.", "good");
            syncCharacterToCampaign(true);
          }
        } else if (restEventId && rosterUpdatedAt && restAppliedAt && rosterUpdatedAt >= restAppliedAt) {
          state.lastAppliedPartyRestEventId = restEventId;
        }
      }
      if (sharedState.pendingChecks && typeof sharedState.pendingChecks === "object") {
        var current = getCampaignSharedState() || {};
        current.pendingChecks = mergePendingChecksState(current.pendingChecks, sharedState.pendingChecks);
      }
      if (Array.isArray(sharedState.sessionTimeline)) {
        var current = getCampaignSharedState() || {};
        current.sessionTimeline = deepCloneJson(sharedState.sessionTimeline) || [];
      }
      if (sharedState.gmForge && typeof sharedState.gmForge === "object") {
        var current = getCampaignSharedState() || {};
        current.gmForge = deepCloneJson(sharedState.gmForge) || ensureGmForgeState(current);
        ensureGmForgeState(current);
      }
      if (Array.isArray(sharedState.campaignChronicle)) {
        var current = getCampaignSharedState() || {};
        current.campaignChronicle = deepCloneJson(sharedState.campaignChronicle) || [];
      }
      if (Array.isArray(sharedState.unresolvedHooks)) {
        var current = getCampaignSharedState() || {};
        current.unresolvedHooks = deepCloneJson(sharedState.unresolvedHooks) || [];
      }
      if (Array.isArray(sharedState.actionQueue)) {
        var current = getCampaignSharedState() || {};
        current.actionQueue = deepCloneJson(sharedState.actionQueue);
      }
      if (sharedState.characterInventories && typeof sharedState.characterInventories === "object") {
        var current = getCampaignSharedState() || {};
        current.characterInventories = deepCloneJson(sharedState.characterInventories);
      }
      if (sharedState.characterDeathStates && typeof sharedState.characterDeathStates === "object") {
        var current = getCampaignSharedState() || {};
        current.characterDeathStates = deepCloneJson(sharedState.characterDeathStates);
      }
      if (Array.isArray(sharedState.contestedRolls)) {
        var current = getCampaignSharedState() || {};
        current.contestedRolls = deepCloneJson(sharedState.contestedRolls);
      }
      if (sharedState.characterDice && typeof sharedState.characterDice === "object") {
        var current = getCampaignSharedState() || {};
        current.characterDice = deepCloneJson(sharedState.characterDice);
      }
      if (sharedState.provinceMap && typeof window.applyProvinceMapState === "function") {
        var current = getCampaignSharedState() || {};
        var previousProvinceMap = previousShared && previousShared.provinceMap && typeof previousShared.provinceMap === "object"
          ? previousShared.provinceMap
          : null;
        var incomingProvinceMap = deepCloneJson(sharedState.provinceMap) || {};
        var incomingTravel = sharedState.campaignTravel && typeof sharedState.campaignTravel === "object"
          ? sharedState.campaignTravel
          : null;
        var previousTravel = previousShared && previousShared.campaignTravel && typeof previousShared.campaignTravel === "object"
          ? previousShared.campaignTravel
          : null;
        var previousTravelAt = Math.max(0, Number(previousTravel && previousTravel.updatedAt || 0));
        var incomingTravelAt = Math.max(0, Number(incomingTravel && incomingTravel.updatedAt || 0));
        var keepPreviousProvinceMap = !!(
          state.role === "gm"
          && previousProvinceMap
          && previousTravelAt > 0
          && previousTravelAt > incomingTravelAt
        );
        var provincePayload = keepPreviousProvinceMap
          ? (deepCloneJson(previousProvinceMap) || {})
          : incomingProvinceMap;
        provincePayload.selectedKey = keepPreviousProvinceMap
          ? resolveProvinceSelectionKeyForSharedState(previousShared, localProvinceState, provincePayload)
          : resolveProvinceSelectionKeyForSharedState(sharedState, localProvinceState, provincePayload);
        current.provinceMap = deepCloneJson(provincePayload) || provincePayload;
        var nextProvinceMapHash = safeJsonHash(provincePayload);
        if (nextProvinceMapHash !== state.lastProvinceMapHash) {
          window.applyProvinceMapState(provincePayload, { skipSync: true });
          state.lastProvinceMapHash = nextProvinceMapHash;
        }
      }
      if (sharedState.worldState && typeof sharedState.worldState === "object") {
        window.S.worldState = deepCloneJson(sharedState.worldState);
        if (typeof window.ensureWorldState === "function") window.ensureWorldState();
      }
    } finally {
      state.applyingSharedState = false;
    }

    if (typeof window.updateCreditsUI === "function") window.updateCreditsUI();
    if (typeof window.updateRenown === "function") window.updateRenown();
    if (typeof window.updateMentalStressUI === "function") window.updateMentalStressUI();
    refreshSharedCombatSceneUI();
    if (typeof window.renderLastSeaMap === "function") window.renderLastSeaMap();
    if (typeof window.renderLastSeaInfo === "function") window.renderLastSeaInfo();
    if (typeof window.renderStarSystemMap === "function") window.renderStarSystemMap();
    if (typeof window.updateStarSystemReadouts === "function") window.updateStarSystemReadouts();
    if (typeof window.renderPlanetExplorationPanel === "function") {
      try { window.renderPlanetExplorationPanel(); } catch (_err) {}
    }
    if (typeof window.renderYessodPanel === "function") {
      try { window.renderYessodPanel(); } catch (_err) {}
    }
    if (window.S && window.S.starSystem && window.S.starSystem.activeSpaceEncounter && typeof window.renderSpaceEncounterPanel === "function") {
      try { window.renderSpaceEncounterPanel(); } catch (_err) {}
    }
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
    if ((provinceSelectionsChanged || mapFogChanged) && typeof window.renderHexMap === "function") window.renderHexMap();
    if (mapFogChanged && typeof window.renderHexInfo === "function" && typeof selectedHex !== "undefined" && selectedHex) {
      try { window.renderHexInfo(selectedHex); } catch (_err) {}
    }
    if (typeof window.renderCaravanUI === "function") {
      try { window.renderCaravanUI(); } catch (_err) {}
    }
    if (typeof window.renderHoldingUI === "function") {
      try { window.renderHoldingUI(); } catch (_err) {}
    }
    if (typeof window.updateStarshipUI === "function") {
      try { window.updateStarshipUI(); } catch (_err) {}
    }
    if (typeof window.renderMissionBoard === "function") window.renderMissionBoard();
    if (typeof window.renderMissionTracker === "function") window.renderMissionTracker();
    if (typeof window.renderCompletedMissions === "function") window.renderCompletedMissions();
    if (typeof window.renderCampaignInitiativePanel === "function") {
      try { window.renderCampaignInitiativePanel(); } catch (_err) {}
    }
    if (window.factionSystem && typeof window.factionSystem.setupFactionTab === "function") {
      try { window.factionSystem.setupFactionTab(); } catch (_err) {}
    }

    try {
      var shared = getCampaignSharedState();
      state.lastProvinceSelectionsHash = safeJsonHash(shared && shared.provinceSelections ? shared.provinceSelections : {});
      if (shared && shared.areaSession) {
        maybeHandleSharedAreaSession(shared.areaSession, shared);
      }
      if (shared && shared.readyCheck) {
        promptReadyCheckIfNeeded(shared.readyCheck);
        maybeResolveReadyCheck();
      }
    } catch (_err) {}

    state.lastSharedVersion = nextVersion || state.lastSharedVersion;
    state.lastSharedHash = JSON.stringify(sharedState);
    refreshProgressHash();
  }

  function announceSharedAreaSession(spec, reason) {
    if (!state.code || !state.connected || state.role !== "gm") return null;
    var details = spec && typeof spec === "object" ? spec : {};
    var kind = String(details.kind || "").trim();
    if (!kind) return null;
    var payload = details.payload && typeof details.payload === "object"
      ? (deepCloneJson(details.payload) || details.payload)
      : {};
    var shared = getMutableCampaignSharedState();
    var current = normalizeCampaignAreaSession(shared.areaSession || ensureAreaSessionState(shared));
    var payloadHash = safeJsonHash(payload);
    var currentPayloadHash = safeJsonHash(current.payload || {});
    var sameArea = !!(
      current.id
      && current.status === "open"
      && current.kind === kind
      && currentPayloadHash === payloadHash
    );
    var now = Date.now();
    var title = String(details.title || "").trim() || String((document.getElementById("modalTitle") || {}).textContent || "").trim() || String(details.label || "Shared Area");
    var session = {
      id: sameArea ? String(current.id || ("area-" + now)) : ("area-" + now + "-" + Math.floor(Math.random() * 100000)),
      status: "open",
      kind: kind,
      label: String(details.label || title || "Shared Area"),
      title: title,
      by: String(state.playerName || ensureName() || "GM"),
      openedAt: sameArea ? Math.max(0, Number(current.openedAt || now)) : now,
      updatedAt: now,
      payload: payload
    };
    shared.areaSession = deepCloneJson(session) || session;
    if (!sameArea) {
      appendSessionTimeline("area", "Shared area opened: " + session.title + ".", {
        areaId: session.id,
        kind: session.kind,
        label: session.label
      });
    }
    var out = syncSharedPatch({ areaSession: deepCloneJson(shared.areaSession) || shared.areaSession }, reason || "area-session-open");
    if (out && typeof out.catch === "function") out.catch(function () {});
    return session;
  }

  async function syncSharedState(reason) {
    if (!state.socket || !state.connected || !state.code) return;
    if (state.applyingSharedState) return;
    if (state.role === "player") return;
    if (state.syncInFlight) {
      state.syncQueued = true;
      state.syncQueuedReason = String(reason || state.syncQueuedReason || "queued");
      return;
    }
    var syncReason = String(reason || "auto");
    var shared = collectSharedState();
    if (syncReason === "tick" && shared && typeof shared === "object") {
      var currentShared = getCampaignSharedState();
      var liveCombat = currentShared && currentShared.campaignCombat && typeof currentShared.campaignCombat === "object"
        ? currentShared.campaignCombat
        : null;
      var localCombatSceneActive = !!(window.S && window.S.combat && typeof window.S.combat === "object" && window.S.combat.active);
      if ((liveCombat && liveCombat.active) || localCombatSceneActive) {
        delete shared.campaignCombat;
        delete shared.combatScene;
      }
    }
    if (shared && typeof shared === "object" && shared.combatScene && typeof shared.combatScene === "object") {
      attachCombatSceneSyncMeta(shared, Math.max(0, Number(state.combatSceneSyncGeneration || 0)), true);
    }
    var hash = JSON.stringify(shared);
    if (!hash || hash === state.lastSharedHash) return;
    var res = await pushSharedState(shared, syncReason);
    if (res && res.ok) {
      state.lastSharedHash = hash;
      state.lastSharedVersion = Math.max(state.lastSharedVersion, Number(res.stateVersion || 0));
    }
    if (state.syncQueued) {
      var queuedReason = state.syncQueuedReason || "queued";
      state.syncQueued = false;
      state.syncQueuedReason = "";
      setTimeout(function () {
        syncSharedState("queued-" + String(queuedReason));
      }, 0);
    }
  }

  function patchMapGenerationHooks() {
    if (window._campaignPatchedMapGenerationHooks) return;

    function wrap(fnName, reason) {
      if (typeof window[fnName] !== "function") return;
      var original = window[fnName];
      window[fnName] = function () {
        var out = original.apply(this, arguments);
        if (state.code && state.connected && state.role === "gm") {
          setTimeout(function () { syncSharedState(reason || fnName); }, 0);
        }
        return out;
      };
    }

    wrap("generateMap", "generate-province");
    wrap("generateLastSea", "generate-last-sea");
    wrap("generateStarSystemMap", "generate-galaxy");
    wrap("generateWorldThatWasMap", "generate-world-that-was");
    wrap("clearMap", "clear-province");

    window._campaignPatchedMapGenerationHooks = true;
  }

  function queueProgressSync(reason) {
    if (!state.socket || !state.connected || !state.code) return;
    var why = String(reason || "progress-update");
    setTimeout(function () {
      if (!state.socket || !state.connected || !state.code) return;
      if (state.role === "player") {
        syncPlayerSharedPatch(collectProgressSharedPatch(), why);
      } else {
        syncSharedState(why);
      }
    }, 0);
  }

  function patchSharedProgressHooks() {
    function wrapFunction(fnName, reason) {
      if (typeof window[fnName] !== "function") return;
      var key = "_campaignWrappedProgress_" + fnName;
      if (window[key]) return;
      var original = window[fnName];
      window[fnName] = function () {
        var out = original.apply(this, arguments);
        queueProgressSync(reason || fnName);
        return out;
      };
      window[key] = true;
    }

    function wrapObjectMethod(obj, methodName, reason) {
      if (!obj || typeof obj[methodName] !== "function") return;
      var key = "_campaignWrappedProgressObj_" + methodName;
      if (obj[key]) return;
      var base = obj[methodName];
      obj[methodName] = function () {
        var out = base.apply(this, arguments);
        queueProgressSync(reason || methodName);
        return out;
      };
      obj[key] = true;
    }

    [
      ["createMission", "mission-create"],
      ["generateTaskForHex", "task-generate"],
      ["completeTaskAtHex", "task-complete"],
      ["completeRoyalTask", "royal-task-complete"],
      ["resolveMission", "mission-resolve"],
      ["resolveMissionOutcome", "mission-outcome"],
      ["abandonMission", "mission-abandon"],
      ["rollProvinceHoldingDowntime", "holding-downtime-roll"],
      ["resolveProvinceHoldingDowntime", "holding-downtime-resolve"],
      ["runStoryOption", "story-option"],
      ["storyAcceptFail", "story-accept-fail"],
      ["storySpendTeamwork", "story-spend-teamwork"],
      ["storyPushLuck", "story-push-luck"],
      ["resolveEventAction", "event-action"],
      ["resolveEventLeadAction", "event-lead-action"],
      ["completeEventChallenge", "event-complete"],
      ["resolveProvinceMonsterCombatOutcome", "province-monster-outcome"]
    ].forEach(function (entry) {
      wrapFunction(entry[0], entry[1]);
    });

    if (window.factionSystem) {
      wrapObjectMethod(window.factionSystem, "acceptMission", "faction-mission-accept");
      wrapObjectMethod(window.factionSystem, "resolveMission", "faction-mission-resolve");
      wrapObjectMethod(window.factionSystem, "resolveEvent", "faction-event-resolve");
      wrapObjectMethod(window.factionSystem, "resolveMapTask", "faction-map-task");
      wrapObjectMethod(window.factionSystem, "startMonsterTask", "faction-monster-start");
      wrapObjectMethod(window.factionSystem, "finalizeMonsterTask", "faction-monster-finalize");
    }

  }

  function patchEncounterVisibilityHooks() {
    if (window._campaignPatchedEncounterVisibilityHooks) return;

    function wrap(fnName, reason) {
      if (typeof window[fnName] !== "function") return;
      var key = "_campaignWrappedEncounter_" + fnName;
      if (window[key]) return;
      var base = window[fnName];
      window[fnName] = function () {
        var out = base.apply(this, arguments);
        if (state.code && state.connected && state.role === "gm") {
          setTimeout(function () {
            syncSharedSilent(reason || fnName).catch(function () {});
          }, 0);
        }
        return out;
      };
      window[key] = true;
    }

    [
      ["rollHexEncounter", "province-encounter"],
      ["rollTradeRouteEncounter", "province-trade-encounter"],
      ["resolveProvinceShiftWeatherEncounter", "province-weather-encounter"],
      ["runGalaxyEncounterRoll", "galaxy-encounter-roll"],
      ["resolveSpaceEncounterOption", "galaxy-encounter-resolve"],
      ["rollPlanetHexEncounter", "planet-encounter-roll"],
      ["rollPlanetTradeRouteEncounter", "planet-trade-encounter"],
      ["rollPlanetObstacleTraversal", "planet-obstacle-encounter"],
      ["rollPlanetLostCityTravel", "planet-lostcity-travel"],
      ["rollPlanetLostCityIrradiatedPatrol", "planet-lostcity-patrol"],
      ["rollDistrictEncounter", "wtw-encounter-roll"],
      ["resolveDistrictEncounter", "wtw-encounter-resolve"],
      ["rollWorldCelebrationEvent", "wtw-downtime-roll"],
      ["resolveWorldCelebrationEvent", "wtw-downtime-resolve"]
    ].forEach(function (entry) {
      wrap(entry[0], entry[1]);
    });

    window._campaignPatchedEncounterVisibilityHooks = true;
  }

  function patchAreaSessionHooks() {
    if (window._campaignPatchedAreaSessionHooks) return;

    function wrap(fnName, reason, buildSpec) {
      if (typeof window[fnName] !== "function") return;
      var key = "_campaignWrappedAreaSession_" + fnName;
      if (window[key]) return;
      var base = window[fnName];
      window[fnName] = function () {
        var out = base.apply(this, arguments);
        if (state.code && state.connected && state.role === "gm") {
          var spec = null;
          try {
            spec = typeof buildSpec === "function" ? buildSpec.apply(this, arguments) : null;
          } catch (_err) {
            spec = null;
          }
          if (spec && spec.kind) {
            announceSharedAreaSession(spec, reason || fnName);
          }
        }
        return out;
      };
      window[key] = true;
    }

    function buildSettlementAreaSpec() {
      var crawl = window.S && window.S.holding && window.S.holding.settlementHexcrawl && typeof window.S.holding.settlementHexcrawl === "object"
        ? window.S.holding.settlementHexcrawl
        : null;
      return {
        kind: "settlement-area",
        label: String((document.getElementById("modalTitle") || {}).textContent || "Settlement Hexcrawl"),
        title: String((document.getElementById("modalTitle") || {}).textContent || "Settlement Hexcrawl"),
        payload: {
          mode: String(crawl && crawl.regionMode || "holding"),
          activeNodeId: crawl && crawl.activeNodeId != null ? String(crawl.activeNodeId) : "",
          holdingType: String(crawl && crawl.holdingType || (window.S && window.S.holding && window.S.holding.type) || "")
        }
      };
    }

    wrap("openHoldingSettlementHexcrawl", "area-settlement-open", buildSettlementAreaSpec);
    wrap("openRegionalSettlementHexcrawl", "area-regional-settlement-open", buildSettlementAreaSpec);
    wrap("openProvinceRuinPopup", "area-province-ruins-open", function (col, row) {
      return {
        kind: "province-area",
        label: "Province Ruins",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Province Ruins"),
        payload: { areaType: "ruins", col: Number(col || 0), row: Number(row || 0) }
      };
    });
    wrap("openProvinceDepthsPopup", "area-province-depths-open", function (col, row) {
      return {
        kind: "province-area",
        label: "Infinite Dungeon",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Infinite Dungeon"),
        payload: { areaType: "depths", col: Number(col || 0), row: Number(row || 0) }
      };
    });
    wrap("openLostCityBuildingHexcrawl", "area-lostcity-open", function (col, row) {
      return {
        kind: "province-area",
        label: "Lost City Building",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Lost City Building"),
        payload: { areaType: "lostcity", col: Number(col || 0), row: Number(row || 0) }
      };
    });
    wrap("openSeaDungeon", "area-sea-dungeon-open", function (col, row) {
      return {
        kind: "sea-area",
        label: "Sea Ruins",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Sea Ruins"),
        payload: { areaType: "dungeon", col: Number(col || 0), row: Number(row || 0) }
      };
    });
    wrap("openSeaDerelictHexcrawl", "area-sea-derelict-open", function () {
      var sea = window.S && window.S.lastSea && typeof window.S.lastSea === "object" ? window.S.lastSea : null;
      var map = sea && Array.isArray(sea.map) ? sea.map : [];
      var key = String(sea && sea.activeEncounterKey || "");
      var hex = key ? (map.find(function (entry) { return entry && String(entry.key || "") === key; }) || null) : null;
      if (!hex) return null;
      return {
        kind: "sea-area",
        label: "Derelict Ship Hexcrawl",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Derelict Ship Hexcrawl"),
        payload: { areaType: "derelict", col: Number(hex.col || 0), row: Number(hex.row || 0) }
      };
    });
    wrap("openPlanetRuinPopup", "area-planet-ruin-open", function (cellId) {
      var star = window.S && window.S.starSystem && typeof window.S.starSystem === "object" ? window.S.starSystem : null;
      return {
        kind: "planet-area",
        label: "Planet Ruins",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Planet Ruins"),
        payload: {
          areaType: "ruin",
          planetHexId: Number(star && star.activePlanetHexId || 0),
          cellId: Number(cellId || 0)
        }
      };
    });
    wrap("openPlanetLostCityBuildingExploration", "area-planet-lostcity-building-open", function () {
      var star = window.S && window.S.starSystem && typeof window.S.starSystem === "object" ? window.S.starSystem : null;
      var hexes = star && Array.isArray(star.hexes) ? star.hexes : [];
      var planetHex = hexes.find(function (entry) {
        return !!(entry && Number(entry.id) === Number(star && star.activePlanetHexId));
      }) || null;
      var surface = planetHex && planetHex.surface && typeof planetHex.surface === "object" ? planetHex.surface : null;
      return {
        kind: "planet-area",
        label: "Planet Lost City Building",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Planet Lost City Building"),
        payload: {
          areaType: "lostcity-building",
          planetHexId: Number(star && star.activePlanetHexId || 0),
          cellId: Number(surface && surface.selectedCellId || 0)
        }
      };
    });
    wrap("openPlanetLostCityHexcrawl", "area-planet-lostcity-district-open", function () {
      var star = window.S && window.S.starSystem && typeof window.S.starSystem === "object" ? window.S.starSystem : null;
      var hexes = star && Array.isArray(star.hexes) ? star.hexes : [];
      var planetHex = hexes.find(function (entry) {
        return !!(entry && Number(entry.id) === Number(star && star.activePlanetHexId));
      }) || null;
      var surface = planetHex && planetHex.surface && typeof planetHex.surface === "object" ? planetHex.surface : null;
      return {
        kind: "planet-area",
        label: "Planet Lost City District",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Planet Lost City District"),
        payload: {
          areaType: "lostcity-district",
          planetHexId: Number(star && star.activePlanetHexId || 0),
          cellId: Number(surface && surface.selectedCellId || 0)
        }
      };
    });
    wrap("openGalaxyFacilityArea", "area-galaxy-facility-open", function (hexId) {
      return {
        kind: "galaxy-area",
        label: "Galactic Facility",
        title: "Galactic Facility",
        payload: { areaType: "facility", hexId: Number(hexId || 0) }
      };
    });
    wrap("openGalaxyDeadMoonArea", "area-galaxy-deadmoon-open", function (hexId) {
      return {
        kind: "galaxy-area",
        label: "Dead Moon Landing Map",
        title: "Dead Moon Landing Map",
        payload: { areaType: "deadmoon", hexId: Number(hexId || 0) }
      };
    });
    wrap("openGalaxyDerelictArea", "area-galaxy-derelict-open", function (hexId) {
      return {
        kind: "galaxy-area",
        label: "Explore Derelict",
        title: "Explore Derelict",
        payload: { areaType: "derelict", hexId: Number(hexId || 0) }
      };
    });
    wrap("openYessodFromSun", "area-yessod-open", function () {
      var star = window.S && window.S.starSystem && typeof window.S.starSystem === "object" ? window.S.starSystem : null;
      var yessod = star && star.yessod && typeof star.yessod === "object" ? star.yessod : null;
      return {
        kind: "yessod-area",
        label: "Yessod",
        title: "Yessod",
        payload: {
          areaType: "map",
          cellId: Number(yessod && yessod.selectedCellId || 0)
        }
      };
    });
    wrap("yessodEnterHolding", "area-yessod-holding-open", function (cellId) {
      return {
        kind: "yessod-area",
        label: "Yessod Holding",
        title: String((document.getElementById("modalTitle") || {}).textContent || "Yessod Holding"),
        payload: {
          areaType: "holding",
          cellId: Number(cellId || 0)
        }
      };
    });

    window._campaignPatchedAreaSessionHooks = true;
  }

  async function syncSharedNow() {
    if (!state.socket || !state.connected || !state.code) {
      safeNotif("Join a campaign first.", "warn");
      return;
    }
    if (state.role === "player") {
      await requestResync();
      return;
    }
    var shared = collectSharedState();
    var res = await pushSharedState(shared, "manual");
    if (!res || !res.ok) {
      safeNotif((res && res.error) || "Shared world sync failed.", "warn");
      return;
    }
    safeNotif("Shared world synced (v" + Number(res.stateVersion || 0) + ").", "good");
  }

  async function syncSharedSilent(reason) {
    if (!state.socket || !state.connected || !state.code) return { ok: false, error: "Not connected." };
    if (state.role === "player") return { ok: false, error: "Only GM can broadcast shared world state." };
    var shared = collectSharedState();
    if (shared && typeof shared === "object" && shared.combatScene && typeof shared.combatScene === "object") {
      attachCombatSceneSyncMeta(shared, Math.max(0, Number(state.combatSceneSyncGeneration || 0)), true);
    }
    return pushSharedState(shared, reason || "silent");
  }

  async function pushSharedState(nextState, reason) {
    if (!state.socket || !state.connected || !state.code) {
      safeNotif("Join a campaign first.", "warn");
      setSyncHealth("offline", "Offline");
      return { ok: false };
    }
    if (state.syncInFlight) {
      // Queue behind the active sync and push this caller's snapshot once clear.
      var waited = 0;
      while (state.syncInFlight && waited < 20000) {
        await new Promise(function (resolve) { setTimeout(resolve, 40); });
        waited += 40;
      }
      if (state.syncInFlight) {
        return { ok: false, error: "Sync queue timeout." };
      }
    }
    var patchGeneration = Math.max(0, Number(nextState && nextState.__combatSceneSyncGeneration || 0));
    var isAutoSync = !!(nextState && nextState.__combatSceneAutoSync);
    if (isAutoSync && patchGeneration && patchGeneration < Math.max(0, Number(state.combatSceneSyncGeneration || 0))) {
      return { ok: false, skipped: true, error: "Stale combat scene sync." };
    }
    state.syncInFlight = true;
    state.pendingSyncCount = Math.max(0, Number(state.pendingSyncCount || 0)) + 1;
    setSyncHealth("syncing", "Syncing...");
    var sentLedgerIds = Array.isArray(nextState && nextState.economyLedger)
      ? nextState.economyLedger.map(function (entry) { return String(entry && entry.id || ""); })
      : [];
    var res;
    try {
      res = await emitWithAck("campaign:syncState", { state: nextState || {}, reason: reason || "manual" });
      if (res && res.ok) {
        state.lastSharedHash = JSON.stringify(nextState || {});
        state.lastSharedVersion = Math.max(state.lastSharedVersion, Number(res.stateVersion || 0));
        state.lastSyncAt = Date.now();
        if (res.authoritativeAt) {
          state.lastAuthoritativeAt = Number(res.authoritativeAt || 0) || state.lastAuthoritativeAt;
        }
        setSyncHealth("online", "Synced");
        state.lastSyncConflicts = Array.isArray(res.conflicts) ? res.conflicts : [];
        state.syncConflictCount = state.lastSyncConflicts.length;
        if (state.syncConflictCount) {
          safeNotif("Sync guardrails preserved GM authority: " + state.lastSyncConflicts.join(", ") + ".", "warn");
        }
        if (sentLedgerIds.length && Array.isArray(state.localEconomyLedger)) {
          var sentMap = {};
          sentLedgerIds.forEach(function (id) { if (id) sentMap[id] = true; });
          state.localEconomyLedger = state.localEconomyLedger.filter(function (entry) {
            var id = String(entry && entry.id || "");
            return !sentMap[id];
          });
        }
      } else {
        setSyncHealth("stale", "Pending sync");
      }
      return res || { ok: false, error: "No response." };
    } finally {
      state.pendingSyncCount = Math.max(0, Number(state.pendingSyncCount || 0) - 1);
      state.syncInFlight = false;
    }
  }

  function normalizeStoredSessionPayload(sessionLike) {
    var parsed = sessionLike && typeof sessionLike === "object" ? sessionLike : null;
    if (!parsed) return null;
    var code = formatCode(parsed.code || "");
    if (!code) return null;
    return {
      code: code,
      token: String(parsed.token || "").trim(),
      name: String(parsed.name || "").trim().slice(0, 32) || (parsed.role === "gm" ? "GM" : "Player"),
      role: parsed.role === "gm" ? "gm" : "player",
      savedAt: Math.max(0, Number(parsed.savedAt || parsed.updatedAt || 0)),
      lastSnapshotAt: Math.max(0, Number(parsed.lastSnapshotAt || 0)),
      lastAuthoritativeAt: Math.max(0, Number(parsed.lastAuthoritativeAt || 0)),
      lastSyncAt: Math.max(0, Number(parsed.lastSyncAt || 0)),
      lastSceneLabel: String(parsed.lastSceneLabel || "").trim().slice(0, 80),
      restoreError: String(parsed.restoreError || "").trim().slice(0, 220),
      restoreFailedAt: Math.max(0, Number(parsed.restoreFailedAt || 0)),
      source: String(parsed.source || "").trim()
    };
  }

  function readStoredSession(storageArea, source) {
    var normalized = normalizeStoredSessionPayload(readSessionPayload(storageArea));
    if (!normalized) return null;
    if (source) normalized.source = source;
    return normalized;
  }

  function writeSessionPayload(storageArea, payload) {
    if (!storageArea || typeof storageArea.setItem !== "function" || !payload) return false;
    try {
      storageArea.setItem(SESSION_KEY, JSON.stringify(payload));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function removeSessionPayload(storageArea) {
    if (!storageArea || typeof storageArea.removeItem !== "function") return;
    try {
      storageArea.removeItem(SESSION_KEY);
    } catch (_err) {}
  }

  function buildSessionPayload(base) {
    var existing = normalizeStoredSessionPayload(base) || {};
    var tableState = getCampaignTableState(getCampaignSharedState());
    return normalizeStoredSessionPayload({
      code: existing.code || state.code,
      token: Object.prototype.hasOwnProperty.call(existing, "token") ? existing.token : String(state.token || "").trim(),
      name: existing.name || state.playerName || ensureName(),
      role: existing.role === "gm" ? "gm" : (state.role === "gm" ? "gm" : "player"),
      savedAt: existing.savedAt || Date.now(),
      lastSnapshotAt: existing.lastSnapshotAt || Number(state.lastCampaignStateAt || 0),
      lastAuthoritativeAt: existing.lastAuthoritativeAt || Number(state.lastAuthoritativeAt || 0),
      lastSyncAt: existing.lastSyncAt || Number(state.lastSyncAt || 0),
      lastSceneLabel: existing.lastSceneLabel || String(tableState && tableState.label || ""),
      restoreError: existing.restoreError || "",
      restoreFailedAt: existing.restoreFailedAt || 0
    });
  }

  function loadSession(options) {
    var opts = options || {};
    var source = String(opts.source || "").toLowerCase();
    var sessionValue = source === "persistent" ? null : readStoredSession(getSessionStorageSafe(), "session");
    var persistentValue = source === "session" ? null : readStoredSession(getLocalStorageSafe(), "persistent");
    if (source === "session") return sessionValue;
    if (source === "persistent") return persistentValue;
    if (opts.preferPersistent) return persistentValue || sessionValue || null;
    return sessionValue || persistentValue || null;
  }

  function persistSession(options) {
    var opts = options || {};
    if (state.sessionPersistenceSuppressed && !opts.force) {
      return null;
    }
    var payload = buildSessionPayload(opts.payload || {});
    if (!payload || !payload.code) return null;
    if (!payload.token && !opts.allowWithoutToken) return null;
    if (!opts.persistentOnly) {
      writeSessionPayload(getSessionStorageSafe(), payload);
    }
    if (!opts.sessionOnly) {
      writeSessionPayload(getLocalStorageSafe(), payload);
    }
    return payload;
  }

  function clearSession(options) {
    var opts = options || {};
    if (!opts.skipSession) {
      removeSessionPayload(getSessionStorageSafe());
    }
    if (!opts.skipPersistent) {
      removeSessionPayload(getLocalStorageSafe());
    }
  }

  function markSessionRestoreFailure(sessionLike, errorText) {
    var payload = buildSessionPayload(sessionLike || loadSession({ preferPersistent: true }) || {});
    if (!payload) return null;
    payload.restoreError = String(errorText || "Saved campaign session could not be restored.").trim().slice(0, 220);
    payload.restoreFailedAt = Date.now();
    payload.savedAt = payload.savedAt || payload.restoreFailedAt;
    clearSession({ skipPersistent: true });
    persistSession({
      payload: payload,
      persistentOnly: true,
      allowWithoutToken: true
    });
    return payload;
  }

  function getSavedCampaignSessionSummary() {
    var session = loadSession({ preferPersistent: true });
    if (!session) {
      return {
        hasSaved: false,
        activeMatch: false,
        canResume: false,
        statusKey: "empty",
        statusLabel: "No saved seat",
        detail: "Join a campaign and this browser will remember your room, role, and seat for faster recovery.",
        session: null,
        roleLabel: "Player",
        savedAtText: "",
        lastActiveText: "",
        lastActiveAt: 0,
        badgeTone: "offline"
      };
    }

    var roleLabel = getCampaignRoleLabel(session.role);
    var activeMatch = !!(
      state.code
      && formatCode(state.code) === session.code
      && String(state.role || "") === String(session.role || "")
      && (!state.token || !session.token || String(state.token) === String(session.token))
    );
    var lastActiveAt = Math.max(
      Number(session.restoreFailedAt || 0),
      Number(session.lastSnapshotAt || 0),
      Number(session.lastAuthoritativeAt || 0),
      Number(session.lastSyncAt || 0),
      Number(session.savedAt || 0)
    );
    var failureText = String(session.restoreError || "").trim();
    var statusKey = activeMatch ? "active" : (failureText ? "attention" : "ready");
    var statusLabel = activeMatch
      ? "Active at table"
      : (failureText ? "Needs attention" : "Ready to resume");
    var detail = activeMatch
      ? ("You are already seated in " + session.code + " as " + roleLabel + ".")
      : (failureText
        ? failureText
        : ("Saved " + roleLabel.toLowerCase() + " seat ready for room " + session.code + "."));
    return {
      hasSaved: true,
      activeMatch: activeMatch,
      canResume: !!session.token,
      statusKey: statusKey,
      statusLabel: statusLabel,
      detail: detail,
      session: session,
      roleLabel: roleLabel,
      savedAtText: formatDateTime(session.savedAt),
      lastActiveText: formatDateTime(lastActiveAt),
      lastActiveAt: lastActiveAt,
      badgeTone: statusKey === "attention" ? "stale" : (activeMatch ? "online" : "syncing")
    };
  }

  // ========== PHASE 1: GM MODES & CAMPAIGN COMBAT ==========

  // Initialize or get default campaign combat state
  function ensureCampaignCombatState(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.campaignCombat) {
      sharedState.campaignCombat = {
        active: false,
        round: 0,
        turnOrder: [],
        currentActorIndex: -1,
        participants: [],
        phase: "wayfarer",
        activeToken: "",
        pendingWayfarers: [],
        actedWayfarers: [],
        enemyActionRequest: null,
        vttSession: null,
        updatedAt: 0
      };
    }
    if (!Array.isArray(sharedState.campaignCombat.turnOrder)) sharedState.campaignCombat.turnOrder = [];
    if (!Array.isArray(sharedState.campaignCombat.participants)) sharedState.campaignCombat.participants = [];
    if (!Array.isArray(sharedState.campaignCombat.pendingWayfarers)) sharedState.campaignCombat.pendingWayfarers = [];
    if (!Array.isArray(sharedState.campaignCombat.actedWayfarers)) sharedState.campaignCombat.actedWayfarers = [];
    if (sharedState.campaignCombat.phase !== "enemy") sharedState.campaignCombat.phase = "wayfarer";
    if (typeof sharedState.campaignCombat.activeToken !== "string") sharedState.campaignCombat.activeToken = "";
    if (sharedState.campaignCombat.enemyActionRequest && typeof sharedState.campaignCombat.enemyActionRequest !== "object") {
      sharedState.campaignCombat.enemyActionRequest = null;
    }
    if (!Number.isFinite(Number(sharedState.campaignCombat.currentActorIndex))) {
      sharedState.campaignCombat.currentActorIndex = -1;
    }
    if (!Number.isFinite(Number(sharedState.campaignCombat.updatedAt))) {
      sharedState.campaignCombat.updatedAt = 0;
    }
    sanitizeCampaignCombatTurnState(sharedState.campaignCombat);
    return sharedState.campaignCombat;
  }

  function hasCampaignCombatProgress(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    if (!stateRef) return false;
    return !!(
      stateRef.active
      || Number(stateRef.round || 0) > 0
      || String(stateRef.activeToken || "")
      || (Array.isArray(stateRef.turnOrder) && stateRef.turnOrder.length)
      || (Array.isArray(stateRef.pendingWayfarers) && stateRef.pendingWayfarers.length)
      || (Array.isArray(stateRef.actedWayfarers) && stateRef.actedWayfarers.length)
    );
  }

  function stampCampaignCombatUpdatedAt(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : ensureCampaignCombatState();
    stateRef.updatedAt = Date.now();
    return stateRef;
  }

  function shouldPreferLocalCampaignCombat(previousCombat, incomingCombat) {
    if (state.role !== "gm") return false;
    var prev = previousCombat && typeof previousCombat === "object" ? previousCombat : null;
    var incoming = incomingCombat && typeof incomingCombat === "object" ? incomingCombat : null;
    if (!prev) return false;
    var prevUpdatedAt = Math.max(0, Number(prev.updatedAt || 0));
    var incomingUpdatedAt = Math.max(0, Number(incoming && incoming.updatedAt || 0));
    if (prevUpdatedAt > 0 && incomingUpdatedAt > 0 && prevUpdatedAt > incomingUpdatedAt) return true;
    if (prevUpdatedAt > 0 && incomingUpdatedAt === 0 && hasCampaignCombatProgress(prev) && !hasCampaignCombatProgress(incoming)) {
      return true;
    }
    var prevStartedAt = Math.max(0, Number(prev.startedAt || 0));
    var incomingStartedAt = Math.max(0, Number(incoming && incoming.startedAt || 0));
    if (prev.active && prevStartedAt > 0 && (!incoming || !incoming.active) && incomingStartedAt < prevStartedAt) {
      return true;
    }
    return false;
  }

  function createDefaultCampaignSoundtrackSettings() {
    return {
      enabled: false,
      mood: "custom",
      suiteId: "",
      styleName: "",
      ambienceIds: []
    };
  }

  function normalizeCampaignSoundtrackSettings(config) {
    var fallback = createDefaultCampaignSoundtrackSettings();
    var raw = config && typeof config === "object" ? config : {};
    var suiteId = String(raw.suiteId || raw.musicId || "").trim();
    var styleName = String(raw.styleName || raw.style || "").trim();
    var mood = String(raw.mood || "custom").trim() || "custom";
    var seen = {};
    var ambienceIds = (Array.isArray(raw.ambienceIds) ? raw.ambienceIds : (raw.ambienceId ? [raw.ambienceId] : []))
      .map(function (entry) { return String(entry || "").trim(); })
      .filter(function (entry) {
        if (!entry || seen[entry]) return false;
        seen[entry] = true;
        return true;
      })
      .slice(0, 2);
    fallback.enabled = !!raw.enabled && !!suiteId;
    fallback.mood = mood;
    fallback.suiteId = fallback.enabled ? suiteId : "";
    fallback.styleName = fallback.enabled ? styleName : "";
    fallback.ambienceIds = fallback.enabled ? ambienceIds : [];
    return fallback;
  }

  // Get or initialize GM settings (gmMode, visibility, etc)
  function ensureGmSettings(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.gmSettings) {
      sharedState.gmSettings = {
        mode: "passive", // "passive" | "active" | "facilitative"
        travelMode: "gm-led", // who can initiate travel
        combatMode: "turn-based", // combat style
        cameraLock: true,
        soundtrack: createDefaultCampaignSoundtrackSettings()
      };
    }
    if (typeof sharedState.gmSettings.cameraLock !== "boolean") {
      sharedState.gmSettings.cameraLock = true;
    }
    sharedState.gmSettings.soundtrack = normalizeCampaignSoundtrackSettings(sharedState.gmSettings.soundtrack);
    return sharedState.gmSettings;
  }

  function getCampaignSoundtrackPresets() {
    return CAMPAIGN_SOUNDTRACK_PRESETS.map(function (preset) {
      return {
        id: String(preset.id || ""),
        label: String(preset.label || ""),
        suiteId: String(preset.suiteId || ""),
        styleName: String(preset.styleName || ""),
        ambienceIds: Array.isArray(preset.ambienceIds) ? preset.ambienceIds.slice() : []
      };
    });
  }

  function getCampaignSoundtrackPresetById(presetId) {
    var key = String(presetId || "").trim();
    if (!key || key === "custom") return null;
    var presets = getCampaignSoundtrackPresets();
    for (var i = 0; i < presets.length; i++) {
      if (presets[i].id === key) return presets[i];
    }
    return null;
  }

  function getCampaignSoundtrackCatalog() {
    var audio = typeof window !== "undefined" ? window.AudioManager : null;
    if (audio && typeof audio.getCampaignSoundtrackCatalog === "function") {
      try {
        return audio.getCampaignSoundtrackCatalog() || { suites: [], ambiences: [] };
      } catch (_err) {}
    }
    return { suites: [], ambiences: [] };
  }

  function renderCampaignSelectOptions(options, selectedValue, placeholderLabel) {
    var items = Array.isArray(options) ? options : [];
    var selected = String(selectedValue || "");
    var html = placeholderLabel
      ? ('<option value="">' + escapeHtml(String(placeholderLabel || "")) + "</option>")
      : "";
    items.forEach(function (option) {
      var id = String(option && option.id != null ? option.id : "");
      var label = String(option && option.label != null ? option.label : id);
      html += '<option value="' + escapeHtml(id) + '"' + (id === selected ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
    });
    return html;
  }

  function buildCampaignSoundtrackStyleOptions(suiteId, selectedStyle) {
    var catalog = getCampaignSoundtrackCatalog();
    var selectedSuite = String(suiteId || "");
    var suites = Array.isArray(catalog.suites) ? catalog.suites : [];
    for (var i = 0; i < suites.length; i++) {
      if (String(suites[i].id || "") !== selectedSuite) continue;
      return renderCampaignSelectOptions(suites[i].styles || [], selectedStyle, "Auto / Any Cue");
    }
    return renderCampaignSelectOptions([], "", "Auto / Any Cue");
  }

  function ensureCampaignSoundtrackDraftState() {
    if (!state.uiDraft || typeof state.uiDraft !== "object") state.uiDraft = {};
    if (!state.uiDraft.soundtrack || typeof state.uiDraft.soundtrack !== "object") {
      state.uiDraft.soundtrack = {
        mood: "custom",
        suiteId: "",
        styleName: "",
        ambienceA: "",
        ambienceB: "",
        dirty: false,
        activeControl: "",
        lastInteractionAt: 0
      };
    }
    if (!Number.isFinite(Number(state.uiDraft.soundtrack.lastInteractionAt || 0))) {
      state.uiDraft.soundtrack.lastInteractionAt = 0;
    }
    return state.uiDraft.soundtrack;
  }

  function setCampaignSoundtrackDraftFromConfig(config, options) {
    var draft = ensureCampaignSoundtrackDraftState();
    var normalized = normalizeCampaignSoundtrackSettings(config);
    var opts = options && typeof options === "object" ? options : {};
    draft.mood = String(normalized.mood || "custom");
    draft.suiteId = String(normalized.suiteId || "");
    draft.styleName = String(normalized.styleName || "");
    draft.ambienceA = String(normalized.ambienceIds && normalized.ambienceIds[0] || "");
    draft.ambienceB = String(normalized.ambienceIds && normalized.ambienceIds[1] || "");
    draft.dirty = !!opts.dirty;
    if (!opts.preserveActiveControl) draft.activeControl = "";
    if (!opts.preserveInteraction) draft.lastInteractionAt = 0;
    return draft;
  }

  function isCampaignSoundtrackControlId(controlId) {
    return CAMPAIGN_SOUNDTRACK_CONTROL_IDS.indexOf(String(controlId || "")) >= 0;
  }

  function isCampaignSettingsEditorVisible() {
    var settingsPanel = document.getElementById("settingsPanel");
    if (!settingsPanel || !settingsPanel.classList.contains("open")) return false;
    var campaignPanel = document.getElementById("settingsTabPanel-campaign");
    if (!campaignPanel) return false;
    return String(campaignPanel.getAttribute("aria-hidden") || "false") !== "true";
  }

  function markCampaignSoundtrackInteraction(controlId) {
    var draft = ensureCampaignSoundtrackDraftState();
    draft.lastInteractionAt = Date.now();
    if (isCampaignSoundtrackControlId(controlId)) {
      draft.activeControl = String(controlId || "");
    }
  }

  function isCampaignSoundtrackEditorBusy() {
    if (!isCampaignSettingsEditorVisible()) return false;
    var draft = ensureCampaignSoundtrackDraftState();
    var activeId = document.activeElement && document.activeElement.id
      ? String(document.activeElement.id || "")
      : "";
    var focusedControl = isCampaignSoundtrackControlId(activeId) || isCampaignSoundtrackControlId(draft.activeControl);
    var lastInteractionAt = Number(draft.lastInteractionAt || 0);
    var interactedRecently = lastInteractionAt > 0 && (Date.now() - lastInteractionAt) < 2500;
    return focusedControl || (!!draft.dirty && interactedRecently);
  }

  function flushDeferredSettingsRender() {
    if (!state.pendingSettingsRender) return;
    if (state.settingsRenderTimer) {
      clearTimeout(state.settingsRenderTimer);
      state.settingsRenderTimer = null;
    }
    if (isCampaignSoundtrackEditorBusy()) {
      scheduleDeferredSettingsRender();
      return;
    }
    state.pendingSettingsRender = false;
    renderSettingsSection({ bypassSoundtrackDeferral: true });
  }

  function scheduleDeferredSettingsRender() {
    state.pendingSettingsRender = true;
    if (state.settingsRenderTimer) return;
    state.settingsRenderTimer = setTimeout(function () {
      state.settingsRenderTimer = null;
      flushDeferredSettingsRender();
    }, 240);
  }

  function getCampaignSoundtrackDraftReference(referenceSoundtrack) {
    if (referenceSoundtrack && typeof referenceSoundtrack === "object") {
      return normalizeCampaignSoundtrackSettings(referenceSoundtrack);
    }
    var shared = getCampaignSharedState();
    var settings = ensureGmSettings(shared && typeof shared === "object" ? shared : getMutableCampaignSharedState());
    return normalizeCampaignSoundtrackSettings(settings.soundtrack);
  }

  function syncCampaignSoundtrackDraftDirtyFlag(referenceSoundtrack) {
    var draft = ensureCampaignSoundtrackDraftState();
    var normalized = getCampaignSoundtrackDraftReference(referenceSoundtrack);
    var dirty = String(draft.mood || "custom") !== String(normalized.mood || "custom")
      || String(draft.suiteId || "") !== String(normalized.suiteId || "")
      || String(draft.styleName || "") !== String(normalized.styleName || "")
      || String(draft.ambienceA || "") !== String(normalized.ambienceIds && normalized.ambienceIds[0] || "")
      || String(draft.ambienceB || "") !== String(normalized.ambienceIds && normalized.ambienceIds[1] || "");
    draft.dirty = dirty;
    return dirty;
  }

  function captureCampaignSoundtrackDraftInputs(referenceSoundtrack) {
    var draft = ensureCampaignSoundtrackDraftState();
    var ids = {
      campaignMusicMood: "mood",
      campaignMusicSuite: "suiteId",
      campaignMusicStyle: "styleName",
      campaignMusicAmbienceA: "ambienceA",
      campaignMusicAmbienceB: "ambienceB"
    };
    var hasControls = false;
    Object.keys(ids).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      hasControls = true;
      draft[ids[id]] = String(el.value || "");
    });
    var activeId = document.activeElement && document.activeElement.id
      ? String(document.activeElement.id || "")
      : "";
    draft.activeControl = ids[activeId] ? activeId : "";
    if (hasControls) syncCampaignSoundtrackDraftDirtyFlag(referenceSoundtrack);
  }

  function bindCampaignSoundtrackInputs(referenceSoundtrack) {
    var ids = CAMPAIGN_SOUNDTRACK_CONTROL_IDS.slice();
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.campaignSoundtrackBound === "1") return;
      el.dataset.campaignSoundtrackBound = "1";
      var update = function () {
        markCampaignSoundtrackInteraction(id);
        captureCampaignSoundtrackDraftInputs(referenceSoundtrack);
      };
      el.addEventListener("pointerdown", function () {
        markCampaignSoundtrackInteraction(id);
      });
      el.addEventListener("keydown", function () {
        markCampaignSoundtrackInteraction(id);
      });
      el.addEventListener("input", update);
      el.addEventListener("change", update);
      el.addEventListener("focus", function () {
        markCampaignSoundtrackInteraction(id);
      });
      el.addEventListener("blur", function () {
        setTimeout(function () {
          var draft = ensureCampaignSoundtrackDraftState();
          if (draft.activeControl === id && (!document.activeElement || document.activeElement.id !== id)) {
            draft.activeControl = "";
          }
          flushDeferredSettingsRender();
        }, 0);
      });
    });
  }

  function restoreCampaignSoundtrackDraftFocus() {
    var draft = ensureCampaignSoundtrackDraftState();
    var controlId = String(draft.activeControl || "");
    if (!controlId) return;
    var el = document.getElementById(controlId);
    if (!el) return;
    if (document.activeElement === el) return;
    try {
      el.focus({ preventScroll: true });
    } catch (_err) {
      try { el.focus(); } catch (_err2) {}
    }
  }

  function getCampaignSoundtrackEditorState(soundtrack) {
    var normalized = normalizeCampaignSoundtrackSettings(soundtrack);
    var draft = ensureCampaignSoundtrackDraftState();
    if (!draft.dirty) {
      setCampaignSoundtrackDraftFromConfig(normalized, { dirty: false, preserveActiveControl: true });
    }
    return {
      mood: String(draft.mood || "custom"),
      suiteId: String(draft.suiteId || ""),
      styleName: String(draft.styleName || ""),
      ambienceA: String(draft.ambienceA || ""),
      ambienceB: String(draft.ambienceB || "")
    };
  }

  function getCampaignSoundtrackSummary(soundtrack) {
    var config = normalizeCampaignSoundtrackSettings(soundtrack);
    var presets = getCampaignSoundtrackPresets();
    var catalog = getCampaignSoundtrackCatalog();
    var moodLabel = "Custom";
    for (var i = 0; i < presets.length; i++) {
      if (presets[i].id === config.mood) {
        moodLabel = presets[i].label;
        break;
      }
    }
    var suiteLabel = "Local soundtrack only";
    var styleLabel = "Auto";
    var ambienceLabels = [];
    if (config.enabled) {
      var suiteRow = null;
      var suites = Array.isArray(catalog.suites) ? catalog.suites : [];
      for (var si = 0; si < suites.length; si++) {
        if (String(suites[si].id || "") === config.suiteId) {
          suiteRow = suites[si];
          break;
        }
      }
      suiteLabel = suiteRow ? String(suiteRow.label || config.suiteId) : config.suiteId;
      styleLabel = config.styleName || "Auto / Any Cue";
      var ambiences = Array.isArray(catalog.ambiences) ? catalog.ambiences : [];
      ambienceLabels = (config.ambienceIds || []).map(function (ambienceId) {
        for (var ai = 0; ai < ambiences.length; ai++) {
          if (String(ambiences[ai].id || "") === String(ambienceId || "")) {
            return String(ambiences[ai].label || ambienceId);
          }
        }
        return String(ambienceId || "");
      }).filter(Boolean);
    }
    return {
      enabled: config.enabled,
      moodLabel: moodLabel,
      suiteLabel: suiteLabel,
      styleLabel: styleLabel,
      ambienceLabel: ambienceLabels.length ? ambienceLabels.join(" + ") : "None"
    };
  }

  function applyCampaignSoundtrackFromSharedState(sharedState) {
    var audio = typeof window !== "undefined" ? window.AudioManager : null;
    if (!audio) return;
    var settings = ensureGmSettings(sharedState && typeof sharedState === "object" ? sharedState : getCampaignSharedState());
    var soundtrack = normalizeCampaignSoundtrackSettings(settings.soundtrack);
    var nextHash = JSON.stringify(soundtrack);
    if (state.lastAppliedCampaignSoundtrackHash === nextHash) return;
    state.lastAppliedCampaignSoundtrackHash = nextHash;
    if (soundtrack.enabled && typeof audio.applyCampaignSoundtrack === "function") {
      audio.applyCampaignSoundtrack(soundtrack, { fadeIn: true });
      return;
    }
    if (typeof audio.clearCampaignSoundtrack === "function") {
      audio.clearCampaignSoundtrack({ fadeIn: true, forceRestore: true });
    }
  }

  function setGmSoundtrack(config, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can set table music" });
      return;
    }
    try {
      var requested = config && typeof config === "object" ? config : {};
      var nextSoundtrack = normalizeCampaignSoundtrackSettings(requested);
      if (requested.enabled && !nextSoundtrack.suiteId) {
        if (callback) callback({ ok: false, error: "Choose a playlist first" });
        safeNotif("Choose a playlist before syncing table music.", "warn");
        return;
      }
      var shared = getMutableCampaignSharedState();
      var settings = ensureGmSettings(shared);
      settings.soundtrack = nextSoundtrack;
      setCampaignSoundtrackDraftFromConfig(nextSoundtrack, { dirty: false });
      applyCampaignSoundtrackFromSharedState(shared);
      renderSettingsSection({ bypassSoundtrackDeferral: true });
      if (state.code && state.connected) {
        syncSharedPatch({ gmSettings: deepCloneJson(settings) || settings }, "set-gm-soundtrack").then(function (res) {
          if (!res || !res.ok) {
            safeNotif((res && res.error) || "Could not sync table music.", "warn");
            if (callback) callback(res || { ok: false });
            return;
          }
          safeNotif(nextSoundtrack.enabled ? "Table music updated." : "Table music cleared.", nextSoundtrack.enabled ? "good" : "info");
          if (callback) callback(res);
        }).catch(function (err) {
          if (callback) callback({ ok: false, error: String(err) });
        });
        return;
      }
      safeNotif(nextSoundtrack.enabled ? "Table music updated locally." : "Table music cleared locally.", nextSoundtrack.enabled ? "good" : "info");
      if (callback) callback({ ok: true, local: true, soundtrack: nextSoundtrack });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  function applyCampaignSoundtrackMoodFromUi(callback) {
    var moodId = readUiValue("campaignMusicMood").trim() || "custom";
    var preset = getCampaignSoundtrackPresetById(moodId);
    if (!preset) {
      safeNotif("Choose a named scene mood or use Play Custom Mix.", "info");
      if (callback) callback({ ok: false, error: "No soundtrack preset selected." });
      return;
    }
    setGmSoundtrack({
      enabled: true,
      mood: preset.id,
      suiteId: preset.suiteId,
      styleName: preset.styleName,
      ambienceIds: preset.ambienceIds
    }, callback);
  }

  function applyCampaignSoundtrackMixFromUi(callback) {
    var moodId = readUiValue("campaignMusicMood").trim() || "custom";
    var ambienceIds = [
      readUiValue("campaignMusicAmbienceA").trim(),
      readUiValue("campaignMusicAmbienceB").trim()
    ].filter(Boolean).filter(function (entry, index, list) {
      return list.indexOf(entry) === index;
    });
    setGmSoundtrack({
      enabled: true,
      mood: moodId,
      suiteId: readUiValue("campaignMusicSuite").trim(),
      styleName: readUiValue("campaignMusicStyle").trim(),
      ambienceIds: ambienceIds
    }, callback);
  }

  function clearCampaignSoundtrack(callback) {
    setGmSoundtrack(createDefaultCampaignSoundtrackSettings(), callback);
  }

  function refreshCampaignSoundtrackStyleOptions(selectedStyle) {
    var styleSelect = document.getElementById("campaignMusicStyle");
    if (!styleSelect) return;
    var suiteId = readUiValue("campaignMusicSuite").trim();
    var desired = typeof selectedStyle === "string" ? selectedStyle : String(styleSelect.value || "");
    styleSelect.innerHTML = buildCampaignSoundtrackStyleOptions(suiteId, desired);
    styleSelect.value = desired;
    if (desired && styleSelect.value !== desired) styleSelect.value = "";
    captureCampaignSoundtrackDraftInputs();
  }

  function syncCampaignSoundtrackMoodToEditor() {
    var moodId = readUiValue("campaignMusicMood").trim() || "custom";
    var preset = getCampaignSoundtrackPresetById(moodId);
    if (!preset) return;
    var suiteSelect = document.getElementById("campaignMusicSuite");
    var ambienceA = document.getElementById("campaignMusicAmbienceA");
    var ambienceB = document.getElementById("campaignMusicAmbienceB");
    if (suiteSelect) suiteSelect.value = preset.suiteId;
    refreshCampaignSoundtrackStyleOptions(preset.styleName);
    if (ambienceA) ambienceA.value = preset.ambienceIds[0] || "";
    if (ambienceB) ambienceB.value = preset.ambienceIds[1] || "";
    captureCampaignSoundtrackDraftInputs();
  }

  function resolveCharacterMaxHealth(character) {
    var c = character && typeof character === "object" ? character : {};
    var stats = c.stats && typeof c.stats === "object" ? c.stats : {};
    var explicit = Number(c.maxHealth || c.maxStress || 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.floor(explicit));
    var defendDie = Math.max(4, Number(stats.defend || stats.body || stats.valor || 4));
    var bonus = Math.max(0, Number(c.tempStressCapacityBonus || 0));
    return Math.max(1, (defendDie * 2) + bonus);
  }

  function resolveCharacterMaxMentalStress(character) {
    var c = character && typeof character === "object" ? character : {};
    var explicit = Number(c.maxMentalStress || c.mentalStressCap || c.stressCap || 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.floor(explicit));
    return 20;
  }

  function normalizeCharacterLoadout(character) {
    var c = character && typeof character === "object" ? character : {};
    var loadout = c.loadout && typeof c.loadout === "object" ? c.loadout : {};
    return {
      weapon1: String(loadout.weapon1 || c.weapon1 || "").trim(),
      weapon2: String(loadout.weapon2 || c.weapon2 || "").trim(),
      armor: String(loadout.armor || c.armor || "").trim(),
      readied: String(loadout.readied || c.readied || "").trim()
    };
  }

  function normalizeCharacterHacks(character) {
    var c = character && typeof character === "object" ? character : {};
    var list = Array.isArray(c.hacks) ? c.hacks : (Array.isArray(c.ownedHacks) ? c.ownedHacks : []);
    return list.map(function (name) { return String(name || "").trim(); }).filter(Boolean);
  }

  // Get party roster from campaign (all participants with character data)
  function buildPartyRoster() {
    var participants = getCampaignParticipantRecords();
    if (!participants.length) return [];
    var roster = [];
    participants.forEach(function (participant) {
      if (!participant.character) return;
      if (String(participant.role || "") === "gm") return;
      roster.push({
        token: participant.token,
        name: participant.name || "Player",
        role: participant.role || "player",
        character: {
          name: participant.character.name || "Wayfarer",
          health: Math.max(0, Number(participant.character.health || 0)),
          maxHealth: resolveCharacterMaxHealth(participant.character),
          mentalStress: Math.max(0, Number(participant.character.mentalStress || 0)),
          maxMentalStress: resolveCharacterMaxMentalStress(participant.character),
          look: String(participant.character.look || ""),
          stats: participant.character.stats || {},
          backpack: Array.isArray(participant.character.backpack) ? participant.character.backpack : [],
          loadout: normalizeCharacterLoadout(participant.character),
          hacks: normalizeCharacterHacks(participant.character)
        },
        lastSeenAt: Number(participant.lastSeenAt || Date.now())
      });
    });
    return roster;
  }

  function isCampaignWayfarerToken(combatState, token) {
    var key = String(token || "");
    if (!key || key === getCampaignEnemyTurnToken()) return false;
    var row = findCampaignCombatParticipant(combatState, key);
    if (!row || row.isEnemy) return false;
    return String(row.role || "player") !== "gm";
  }

  function getCampaignCombatWayfarerTokens(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    var source = stateRef && Array.isArray(stateRef.turnOrder) ? stateRef.turnOrder : [];
    return source.filter(function (token) {
      return isCampaignWayfarerToken(stateRef, token);
    });
  }

  function getCampaignCombatPendingWayfarers(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    if (!stateRef) return [];
    var pending = Array.isArray(stateRef.pendingWayfarers) ? stateRef.pendingWayfarers : [];
    return pending.filter(function (token) {
      return isCampaignWayfarerToken(stateRef, token);
    });
  }

  function getCampaignCombatActedWayfarers(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    if (!stateRef) return [];
    var acted = Array.isArray(stateRef.actedWayfarers) ? stateRef.actedWayfarers : [];
    return acted.filter(function (token) {
      return isCampaignWayfarerToken(stateRef, token);
    });
  }

  function getCampaignEnemyTurnToken() {
    return "enemy:phase";
  }

  function normalizeCampaignEnemyActionRange(range) {
    var key = String(range || "").trim().toLowerCase();
    if (key === "engaged" || key === "close" || key === "nearby" || key === "far") return key;
    return "engaged";
  }

  function getCampaignEnemyActionTargetTokens(request) {
    if (!request || typeof request !== "object") return [];
    if (Array.isArray(request.targetTokens)) {
      var seen = {};
      return request.targetTokens.map(function (entry) {
        return String(entry || "");
      }).filter(function (token) {
        if (!token || seen[token]) return false;
        seen[token] = true;
        return true;
      });
    }
    var single = String(request.targetToken || "");
    return single ? [single] : [];
  }

  function isCampaignEnemyActionTargetToken(request, token) {
    var key = String(token || "");
    if (!key) return false;
    return getCampaignEnemyActionTargetTokens(request).indexOf(key) >= 0;
  }

  function sanitizeCampaignEnemyActionRequest(request, combatState) {
    var raw = request && typeof request === "object" ? (deepCloneJson(request) || {}) : null;
    if (!raw || !raw.id) return null;
    var stateRef = combatState && typeof combatState === "object" ? combatState : ensureCampaignCombatState();
    var participantRows = Array.isArray(stateRef.participants) ? stateRef.participants : [];
    var participantNames = {};
    participantRows.forEach(function (row) {
      if (!row || !row.token || row.isEnemy || String(row.role || "player") === "gm") return;
      participantNames[String(row.token || "")] = String(row.name || row.token || "Wayfarer");
    });
    raw.mode = String(raw.mode || "single").toLowerCase() === "aoe" ? "aoe" : "single";
    raw.enemyId = String(raw.enemyId || "");
    raw.enemyName = String(raw.enemyName || "Enemy Turn");
    raw.rangeBand = normalizeCampaignEnemyActionRange(raw.rangeBand || raw.aoeBand || raw.targetBand);
    raw.targetZoneLabel = String(raw.targetZoneLabel || raw.rangeBand || "").trim();
    raw.requestedBy = String(raw.requestedBy || "GM");
    raw.requestedAt = Math.max(0, Number(raw.requestedAt || Date.now()));
    raw.round = Math.max(1, Number(raw.round || stateRef.round || 1));
    raw.resolutionSummary = String(raw.resolutionSummary || "").trim().slice(0, 240);
    raw.lastResolvedByToken = String(raw.lastResolvedByToken || "");
    raw.lastResolvedBy = String(raw.lastResolvedBy || "");
    raw.lastResolvedAt = Math.max(0, Number(raw.lastResolvedAt || 0));
    raw.resolvedByToken = String(raw.resolvedByToken || "");
    raw.resolvedBy = String(raw.resolvedBy || "");
    raw.resolvedAt = Math.max(0, Number(raw.resolvedAt || 0));

    if (raw.mode === "aoe") {
      raw.targetTokens = getCampaignEnemyActionTargetTokens(raw).filter(function (token) {
        return !!participantNames[token];
      });
      raw.targetNames = raw.targetTokens.map(function (token) {
        return participantNames[token] || token;
      });
      if (!raw.targetTokens.length) return null;
      var resolvedMap = {};
      (Array.isArray(raw.resolvedTokens) ? raw.resolvedTokens : []).forEach(function (token) {
        var resolvedToken = String(token || "");
        if (resolvedToken) resolvedMap[resolvedToken] = true;
      });
      raw.resolvedTokens = raw.targetTokens.filter(function (token) {
        return !!resolvedMap[String(token || "")];
      });
      raw.status = raw.resolvedTokens.length >= raw.targetTokens.length ? "resolved" : "pending";
      raw.targetToken = "";
      raw.targetName = raw.targetNames.length ? raw.targetNames.join(", ") : "Wayfarers";
      raw.aoeBand = raw.rangeBand;
      return raw;
    }

    raw.targetToken = String(raw.targetToken || getCampaignEnemyActionTargetTokens(raw)[0] || "");
    if (!raw.targetToken || !participantNames[raw.targetToken]) return null;
    raw.targetName = String(raw.targetName || participantNames[raw.targetToken] || raw.targetToken);
    raw.targetTokens = [raw.targetToken];
    raw.targetNames = [raw.targetName];
    raw.resolvedTokens = [];
    if (String(raw.status || "") === "resolved" || raw.resolvedByToken === raw.targetToken) {
      raw.status = "resolved";
      raw.resolvedTokens = [raw.targetToken];
      if (!raw.resolvedByToken) raw.resolvedByToken = raw.targetToken;
    } else {
      raw.status = "pending";
    }
    raw.aoeBand = "";
    return raw;
  }

  function getCampaignEnemyActionRequest(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : ensureCampaignCombatState();
    if (!stateRef) return null;
    var normalized = sanitizeCampaignEnemyActionRequest(stateRef.enemyActionRequest, stateRef);
    if (!normalized) return null;
    stateRef.enemyActionRequest = normalized;
    return stateRef.enemyActionRequest;
  }

  function clearCampaignEnemyActionRequest(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : ensureCampaignCombatState();
    if (!stateRef) return stateRef;
    stateRef.enemyActionRequest = null;
    return stateRef;
  }

  function sanitizeCampaignCombatTurnState(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    if (!stateRef) return stateRef;
    var enemyToken = getCampaignEnemyTurnToken();
    var participants = Array.isArray(stateRef.participants) ? stateRef.participants : [];
    var keepEnemyParticipant = false;
    stateRef.participants = participants.filter(function (row) {
      if (!row || !row.token) return false;
      var token = String(row.token || "");
      if (!token) return false;
      var isEnemy = !!row.isEnemy || token === enemyToken;
      if (isEnemy) {
        keepEnemyParticipant = true;
        return true;
      }
      return String(row.role || "player") !== "gm";
    });
    var participantMap = {};
    stateRef.participants.forEach(function (row) {
      if (!row || !row.token) return;
      participantMap[String(row.token || "")] = true;
    });
    var order = Array.isArray(stateRef.turnOrder) ? stateRef.turnOrder : [];
    var cleanedOrder = [];
    var sawEnemyTurn = false;
    order.forEach(function (entry) {
      var token = String(entry || "");
      if (!token) return;
      if (token === enemyToken) {
        if (!sawEnemyTurn) {
          cleanedOrder.push(enemyToken);
          sawEnemyTurn = true;
        }
        return;
      }
      if (participantMap[token]) cleanedOrder.push(token);
    });
    if (
      keepEnemyParticipant &&
      !sawEnemyTurn &&
      (stateRef.active || cleanedOrder.length || (Array.isArray(stateRef.pendingWayfarers) && stateRef.pendingWayfarers.length) || (Array.isArray(stateRef.actedWayfarers) && stateRef.actedWayfarers.length))
    ) {
      cleanedOrder.push(enemyToken);
    }
    stateRef.turnOrder = cleanedOrder;
    stateRef.pendingWayfarers = getCampaignCombatPendingWayfarers(stateRef);
    stateRef.actedWayfarers = getCampaignCombatActedWayfarers(stateRef);
    var activeToken = String(stateRef.activeToken || "");
    var phase = String(stateRef.phase || "wayfarer");
    if (phase === "enemy") {
      stateRef.activeToken = enemyToken;
    } else if (activeToken === enemyToken || (activeToken && !participantMap[activeToken])) {
      stateRef.activeToken = "";
    }
    if (phase !== "enemy") {
      clearCampaignEnemyActionRequest(stateRef);
    } else {
      stateRef.enemyActionRequest = sanitizeCampaignEnemyActionRequest(stateRef.enemyActionRequest, stateRef);
    }
    syncCampaignCombatCurrentActorIndex(stateRef);
    syncCampaignCombatParticipantFlags(stateRef);
    return stateRef;
  }

  function syncCampaignCombatParticipantFlags(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    if (!stateRef || !Array.isArray(stateRef.participants)) return stateRef;
    var actedMap = {};
    var acted = getCampaignCombatActedWayfarers(stateRef);
    acted.forEach(function (token) {
      var key = String(token || "");
      if (key) actedMap[key] = true;
    });
    var activeToken = String(stateRef.activeToken || "");
    var enemyToken = getCampaignEnemyTurnToken();
    stateRef.participants = stateRef.participants.map(function (row) {
      if (!row) return row;
      var token = String(row.token || "");
      if (!token) return row;
      var hasActed = token === enemyToken
        ? (String(stateRef.phase || "wayfarer") === "enemy" && activeToken !== enemyToken && Number(stateRef.round || 0) > 0)
        : !!actedMap[token];
      return Object.assign({}, row, { hasActed: hasActed });
    });
    return stateRef;
  }

  function syncCampaignCombatCurrentActorIndex(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    if (!stateRef) return stateRef;
    var order = Array.isArray(stateRef.turnOrder) ? stateRef.turnOrder : [];
    var activeToken = String(stateRef.activeToken || "");
    if (!order.length || !activeToken) {
      stateRef.currentActorIndex = -1;
      return stateRef;
    }
    var idx = order.indexOf(activeToken);
    stateRef.currentActorIndex = idx >= 0 ? idx : -1;
    return stateRef;
  }

  function resetCampaignCombatRoundState(combatState, rosterTokens) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    var nextRoster = Array.isArray(rosterTokens)
      ? rosterTokens.slice()
      : ((stateRef && Array.isArray(stateRef.turnOrder))
        ? getCampaignCombatWayfarerTokens(stateRef)
        : []);
    if (!stateRef) return stateRef;
    stateRef.phase = "wayfarer";
    stateRef.activeToken = "";
    stateRef.pendingWayfarers = nextRoster.slice();
    stateRef.actedWayfarers = [];
    stateRef.enemyActionRequest = null;
    syncCampaignCombatParticipantFlags(stateRef);
    syncCampaignCombatCurrentActorIndex(stateRef);
    return stateRef;
  }

  function setCampaignCombatActorToken(combatState, token) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : null;
    if (!stateRef) return stateRef;
    stateRef.activeToken = String(token || "");
    if (String(stateRef.phase || "wayfarer") !== "enemy") {
      stateRef.enemyActionRequest = null;
    }
    syncCampaignCombatCurrentActorIndex(stateRef);
    syncCampaignCombatParticipantFlags(stateRef);
    return stateRef;
  }

  function getCampaignCombatActiveToken(combatState) {
    var stateRef = combatState && typeof combatState === "object" ? combatState : ensureCampaignCombatState();
    if (!stateRef || !stateRef.active) return "";
    var activeToken = String(stateRef.activeToken || "");
    if (activeToken) return activeToken;
    if (String(stateRef.phase || "wayfarer") === "enemy") return getCampaignEnemyTurnToken();
    return "";
  }

  function persistCampaignCombatState(combatState, reason) {
    var stateRef = ensureCampaignCombatState();
    if (combatState && combatState !== stateRef) {
      var sharedState = getMutableCampaignSharedState();
      sharedState.campaignCombat = deepCloneJson(combatState) || combatState;
      stateRef = sharedState.campaignCombat;
    }
    stampCampaignCombatUpdatedAt(stateRef);
    syncCampaignCombatParticipantFlags(stateRef);
    syncCampaignCombatCurrentActorIndex(stateRef);
    if (state.code && state.connected) {
      var patchOut = syncSharedPatch({ campaignCombat: deepCloneJson(stateRef) || stateRef }, String(reason || "campaign-combat-update"));
      if (patchOut && typeof patchOut.catch === "function") patchOut.catch(function () {});
    }
    return stateRef;
  }

  // Start campaign combat: GM chooses the acting Wayfarer each round, then resolves one enemy phase.
  function startCampaignCombat(participants, callback, options) {
    if (!state.role) {
      if (callback) callback({ ok: false, error: "Join a campaign first" });
      return;
    }
    if (state.code && state.role !== "gm") {
      safeNotif("Only GM can start shared campaign combat.", "warn");
      if (callback) callback({ ok: false, error: "Only GM can start shared campaign combat." });
      return;
    }
    if (!guardRiskySharedAction("start combat", callback)) return;
    var opts = options && typeof options === "object" ? options : {};
    if (state.role === "gm" && state.code && state.connected && !opts.skipReadyCheck) {
      var shared = getCampaignSharedState();
      var currentReady = shared && shared.readyCheck && typeof shared.readyCheck === "object" ? shared.readyCheck : null;
      if (currentReady && currentReady.id && String(currentReady.status || "") === "pending" && String(currentReady.type || "") === "combat-start") {
        safeNotif("Combat start is already awaiting ready-check responses.", "info");
        if (callback) callback({ ok: false, error: "Combat ready check already pending." });
        return;
      }
      startReadyCheck({
        type: "combat-start",
        label: "Start Campaign Combat",
        actionPayload: { kind: "combat-start" }
      }, function () {
        startCampaignCombat(participants, callback, { skipReadyCheck: true });
      }, function (res) {
        if (callback && (!res || !res.ok)) callback(res || { ok: false, error: "Could not start ready check." });
      });
      return;
    }
    try {
      var sharedState = getMutableCampaignSharedState();
      var combatState = ensureCampaignCombatState(sharedState);
      var roster = (Array.isArray(participants) ? participants : buildPartyRoster()).slice().filter(function (participant) {
        return participant && String(participant.role || "player") !== "gm";
      });
      if (!roster.length) {
        if (callback) callback({ ok: false, error: "No Wayfarers are available for campaign combat." });
        return;
      }
      var wayfarerTokens = roster.map(function (p) { return String(p.token || ""); }).filter(Boolean);

      combatState.active = true;
      combatState.round = 1;
      combatState.turnOrder = wayfarerTokens.concat([getCampaignEnemyTurnToken()]);
      combatState.phase = "wayfarer";
      combatState.activeToken = "";
      combatState.pendingWayfarers = wayfarerTokens.slice();
      combatState.actedWayfarers = [];
      combatState.enemyActionRequest = null;
      combatState.currentActorIndex = -1;
      combatState.vttSession = null;
      stampCampaignCombatUpdatedAt(combatState);

      var wayfarers = roster.map(function(p) {
        return {
          token: p.token,
          name: p.character ? p.character.name : p.name,
          role: p.role || "player",
          isEnemy: false,
          isDead: false,
          hasActed: false
        };
      });

      combatState.participants = wayfarers.concat([{
        token: getCampaignEnemyTurnToken(),
        name: "Enemy Turn",
        role: "enemy",
        isEnemy: true,
        isDead: false,
        hasActed: false
      }]);
      combatState.startedAt = Date.now();
      combatState.startedBy = String(state.playerName || ensureName() || "Wayfarer");
      syncCampaignCombatParticipantFlags(combatState);
      sharedState.campaignCombat = deepCloneJson(combatState) || combatState;
      sharedState.combatScene = collectCombatSceneState();
      if (sharedState.combatScene && typeof sharedState.combatScene === "object") {
        sharedState.combatScene.sceneEditor = null;
        sharedState.combatScene.syncMeta = null;
      }
      var combatTravel = ensureCampaignTravelState(sharedState);
      var combatContext = String(getActiveContextId() || combatTravel.context || "traveling");
      combatTravel.context = combatContext;
      combatTravel.region = getCameraRegion("combat", combatContext);
      combatTravel.tab = "combat";
      combatTravel.label = "Combat";
      combatTravel.provinceKey = "";
      combatTravel.movedBy = String(state.playerName || ensureName() || "GM");
      combatTravel.reason = "combat-start";
      combatTravel.phaseCost = 0;
      combatTravel.updatedAt = Date.now();
      sharedState.campaignTravel = deepCloneJson(combatTravel) || combatTravel;
      if (window.S && window.S.combat && typeof window.S.combat === "object") {
        window.S.combat.sceneEditor = null;
        window.S.combat.sceneSyncMeta = null;
      }
      appendSessionTimeline("combat", "Campaign combat started.", {
        startedBy: combatState.startedBy,
        participants: wayfarerTokens.length
      });

      if (state.code && state.connected) {
        if (state.role === "player") {
          syncPlayerSharedPatch({ campaignCombat: deepCloneJson(combatState) || {} }, "start-campaign-combat-player");
        } else {
          var startPatch = syncSharedPatch({
            campaignCombat: sharedState.campaignCombat,
            combatScene: sharedState.combatScene,
            campaignTravel: sharedState.campaignTravel
          }, "start-campaign-combat");
          if (startPatch && typeof startPatch.catch === "function") {
            startPatch.catch(function () {});
          }
        }
        broadcastRollResult(
          "Campaign Combat",
          "Combat opened by " + combatState.startedBy + ". The GM now chooses which Wayfarer acts each round before the enemy turn."
        );
      }
      if (typeof window.switchTab === "function") {
        try {
          window.__campaignSuppressNavigationSync = true;
          window.switchTab("combat", document.getElementById("tabnav-combat") || null);
        } catch (_navErr) {
          window.__campaignSuppressNavigationSync = false;
        }
      }
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Get current actor in turn order
  function getCurrentCombatActor() {
    var combatState = ensureCampaignCombatState();
    var token = getCampaignCombatActiveToken(combatState);
    return token || null;
  }

  function setCombatActor(token, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can choose the acting Wayfarer" });
      return;
    }
    if (!guardRiskySharedAction("choose combat actor", callback)) return;
    try {
      var combatState = ensureCampaignCombatState();
      if (!combatState.active) {
        if (callback) callback({ ok: false, error: "No active combat" });
        return;
      }
      if (String(combatState.phase || "wayfarer") !== "wayfarer") {
        if (callback) callback({ ok: false, error: "Enemy phase is active" });
        return;
      }
      var target = String(token || "");
      if (!target) {
        if (callback) callback({ ok: false, error: "Choose a Wayfarer first" });
        return;
      }
      if (getCampaignCombatPendingWayfarers(combatState).indexOf(target) === -1) {
        if (callback) callback({ ok: false, error: "That Wayfarer has already acted this round" });
        return;
      }
      setCampaignCombatActorToken(combatState, target);
      persistCampaignCombatState(combatState, "set-combat-actor");
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  function promptEnemyAction(request, callback) {
    var isGm = !state.role || state.role === "gm";
    if (!isGm) {
      if (callback) callback({ ok: false, error: "Only GM can prompt enemy actions." });
      return;
    }
    if (!guardRiskySharedAction("prompt enemy action", callback)) return;
    try {
      var combatState = ensureCampaignCombatState();
      if (!combatState.active) {
        if (callback) callback({ ok: false, error: "No active combat" });
        return;
      }
      if (String(combatState.phase || "wayfarer") !== "enemy") {
        if (callback) callback({ ok: false, error: "Enemy phase is not active" });
        return;
      }
      var raw = request && typeof request === "object" ? request : {};
      var normalized = sanitizeCampaignEnemyActionRequest({
        id: raw.id || ("enemy-action:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8)),
        mode: raw.mode,
        enemyId: raw.enemyId,
        enemyName: raw.enemyName,
        rangeBand: raw.rangeBand,
        aoeBand: raw.aoeBand,
        targetZoneLabel: raw.targetZoneLabel,
        targetToken: raw.targetToken,
        targetName: raw.targetName,
        targetTokens: raw.targetTokens,
        targetNames: raw.targetNames,
        requestedBy: String(state.playerName || ensureName() || "GM"),
        requestedAt: Date.now(),
        round: Math.max(1, Number(combatState.round || 1)),
        resolutionSummary: "",
        resolvedTokens: [],
        status: "pending"
      }, combatState);
      if (!normalized) {
        if (callback) callback({ ok: false, error: "Choose a valid target before prompting the enemy action." });
        return;
      }
      if (normalized.rangeBand === "far") {
        if (callback) callback({ ok: false, error: "That target is out of range. Move or retarget first." });
        return;
      }
      combatState.enemyActionRequest = normalized;
      persistCampaignCombatState(combatState, "prompt-enemy-action");
      if (callback) callback({ ok: true, request: normalized });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  function clearEnemyActionRequest(callback) {
    var isGm = !state.role || state.role === "gm";
    if (!isGm) {
      if (callback) callback({ ok: false, error: "Only GM can clear enemy prompts." });
      return;
    }
    if (!guardRiskySharedAction("clear enemy action prompt", callback)) return;
    try {
      var combatState = ensureCampaignCombatState();
      clearCampaignEnemyActionRequest(combatState);
      persistCampaignCombatState(combatState, "clear-enemy-action");
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  function resolveEnemyActionRequest(resolution, callback) {
    var payload = resolution && typeof resolution === "object" ? resolution : {};
    var combatState = ensureCampaignCombatState();
    var liveEnemyRequest = getCampaignEnemyActionRequest(combatState);
    if (!liveEnemyRequest) {
      if (callback) callback({ ok: false, error: "No pending enemy action request." });
      return;
    }
    if (state.role === "player") {
      if (!state.token || !isCampaignEnemyActionTargetToken(liveEnemyRequest, state.token)) {
        if (callback) callback({ ok: false, error: "This enemy action targets another Wayfarer." });
        return;
      }
      emitWithAck("campaign:resolveEnemyAction", {
        id: String(payload.id || liveEnemyRequest.id || ""),
        resolutionSummary: String(payload.resolutionSummary || "").trim().slice(0, 240)
      }).then(function (res) {
        if (callback) callback(res || { ok: false, error: "Could not resolve enemy action." });
      }).catch(function (err) {
        if (callback) callback({ ok: false, error: String(err) });
      });
      return;
    }
    if (!guardRiskySharedAction("resolve enemy action", callback)) return;
    try {
      var nextEnemyRequest = deepCloneJson(liveEnemyRequest) || liveEnemyRequest;
      nextEnemyRequest.status = "resolved";
      nextEnemyRequest.resolvedAt = Date.now();
      nextEnemyRequest.resolvedBy = String(state.playerName || ensureName() || "GM");
      nextEnemyRequest.resolvedByToken = String(state.token || "gm");
      nextEnemyRequest.resolvedTokens = getCampaignEnemyActionTargetTokens(nextEnemyRequest);
      nextEnemyRequest.resolutionSummary = String(payload.resolutionSummary || nextEnemyRequest.resolutionSummary || "").trim().slice(0, 240);
      combatState.enemyActionRequest = sanitizeCampaignEnemyActionRequest(nextEnemyRequest, combatState);
      persistCampaignCombatState(combatState, "resolve-enemy-action-gm");
      if (callback) callback({ ok: true, request: combatState.enemyActionRequest });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Advance campaign combat from the current acting Wayfarer to the next prompt, or from enemy phase to a new round.
  function nextCombatActor(callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can advance turns" });
      return;
    }
    if (!guardRiskySharedAction("advance turns", callback)) return;
    try {
      var combatState = ensureCampaignCombatState();
      if (!combatState.active || !Array.isArray(combatState.turnOrder) || combatState.turnOrder.length === 0) {
        if (callback) callback({ ok: false, error: "No active combat" });
        return;
      }

      if (String(combatState.phase || "wayfarer") === "enemy") {
        combatState.round = Math.max(1, Number(combatState.round || 1)) + 1;
        resetCampaignCombatRoundState(combatState);
        persistCampaignCombatState(combatState, "campaign-round-reset");
        if (callback) callback({ ok: true });
        return;
      }

      var actorToken = String(combatState.activeToken || "");
      if (actorToken) {
        combatState.pendingWayfarers = getCampaignCombatPendingWayfarers(combatState).filter(function (entry) {
          return String(entry || "") !== actorToken;
        });
        if (getCampaignCombatActedWayfarers(combatState).indexOf(actorToken) === -1) {
          combatState.actedWayfarers = getCampaignCombatActedWayfarers(combatState).concat([actorToken]);
        }
      }
      if (getCampaignCombatPendingWayfarers(combatState).length > 0) {
        setCampaignCombatActorToken(combatState, "");
      } else {
        combatState.phase = "enemy";
        setCampaignCombatActorToken(combatState, getCampaignEnemyTurnToken());
        combatState.enemyActionRequest = null;
      }
      persistCampaignCombatState(combatState, "next-combat-turn");
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // End campaign combat
  function endCampaignCombat(callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can end combat" });
      return;
    }
    if (!guardRiskySharedAction("end combat", callback)) return;
    try {
      var combatState = ensureCampaignCombatState();
      combatState.active = false;
      combatState.round = 0;
      combatState.turnOrder = [];
      combatState.currentActorIndex = -1;
      combatState.participants = [];
      combatState.phase = "wayfarer";
      combatState.activeToken = "";
      combatState.pendingWayfarers = [];
      combatState.actedWayfarers = [];
      combatState.enemyActionRequest = null;
      combatState.vttSession = null;
      stampCampaignCombatUpdatedAt(combatState);
      appendSessionTimeline("combat", "Campaign combat ended.", {});

      if (state.code && state.connected) {
        syncSharedState("end-campaign-combat");
      }
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // GM-controlled travel: move entire party to new region
  function gmInitiateTravel(destination, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can initiate travel" });
      return;
    }
    if (!guardRiskySharedAction("initiate travel", callback)) return;
    try {
      var next = (destination && typeof destination === "object") ? destination : { label: String(destination || "").trim() };
      if (!next.label) {
        if (callback) callback({ ok: false, error: "Invalid destination" });
        return;
      }
      if (String(next.reason || "").indexOf("smoke-") === 0) {
        next.skipReadyCheck = true;
      }
      if (!next.skipReadyCheck) {
        var readyPayload = deepCloneJson(next) || {};
        delete readyPayload.skipReadyCheck;
        startReadyCheck({
          type: "travel",
          label: "Travel to " + String(next.label || "Destination"),
          actionPayload: { kind: "travel", destination: readyPayload }
        }, function () {
          readyPayload.skipReadyCheck = true;
          gmInitiateTravel(readyPayload, callback);
        }, function (res) {
          if (callback && (!res || !res.ok)) callback(res || { ok: false, error: "Could not start ready check." });
        });
        return;
      }

      var travelState = ensureCampaignTravelState();
      travelState.region = String(next.region || (next.tab === "lastsea" ? "sea" : (next.tab === "galaxy" || next.tab === "worldthatwas" ? "space" : "province")));
      travelState.context = String(next.context || (next.tab === "lastsea" ? "sea" : (next.tab === "galaxy" || next.tab === "worldthatwas" ? "space" : "traveling")));
      travelState.tab = String(next.tab || "map");
      travelState.label = String(next.label || "Province Map");
      travelState.provinceKey = String(next.provinceKey || "");
      travelState.reason = String(next.reason || "campaign-travel");
      travelState.phaseCost = Math.max(0, Math.min(4, Number(next.phaseCost || 1) || 1));
      travelState.movedBy = String(state.playerName || ensureName() || "GM");
      travelState.updatedAt = Date.now();
      appendSessionTimeline("travel", "Party traveled to " + travelState.label + ".", {
        region: travelState.region,
        tab: travelState.tab,
        phaseCost: travelState.phaseCost
      });

      if (travelState.phaseCost > 0) {
        advanceSharedGameDate(travelState.phaseCost);
        var mutableShared = getMutableCampaignSharedState();
        mutableShared.gameDate = deepCloneJson(window.S && window.S.gameDate || {}) || {};
      }
      suppressNavigationSync(700);
      applyCampaignTravelState(travelState, { force: true });

      safeNotif("Party travel: " + travelState.label + (travelState.phaseCost ? (" (" + travelState.phaseCost + " phase)") : ""), "info");

      if (state.code && state.connected) {
        syncSharedState("gm-travel");
      }
      if (callback) callback({ ok: true, destination: deepCloneJson(travelState) || travelState });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // GM-controlled rest: advance time for party
  function gmAdvanceTime(intervals, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can advance time" });
      return;
    }
    if (!guardRiskySharedAction("advance time", callback)) return;
    try {
      intervals = Math.max(1, Math.min(4, Number(intervals || 1)));
      advanceSharedGameDate(intervals);
      var mutableShared = getMutableCampaignSharedState();
      mutableShared.gameDate = deepCloneJson(window.S && window.S.gameDate || {}) || {};

      if (state.code && state.connected) {
        syncSharedState("gm-advance-time");
      }
      if (callback) callback({ ok: true, intervals: intervals });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  function promptCampaignTravel() {
    if (!state.role || state.role !== "gm") {
      safeNotif("Only GM can move the party.", "warn");
      return;
    }
    if (!guardRiskySharedAction("open travel prompt")) return;
    if (typeof window.openModal !== "function") {
      safeNotif("Travel prompt unavailable.", "warn");
      return;
    }
    var provinceKey = (typeof window.getProvinceSelectedKey === "function") ? String(window.getProvinceSelectedKey() || "") : "";
    var html = ''
      + '<div style="font-size:.82rem;color:var(--muted2);line-height:1.6;margin-bottom:.55rem;">Move the shared party destination and spend an explicit travel phase.</div>'
      + '<div style="display:grid;gap:.35rem;">'
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.gmInitiateTravel({ label: \'Province Map\', region: \'province\', context: \'traveling\', tab: \'map\', provinceKey: \'" + escapeHtml(provinceKey) + "\', phaseCost: 1, reason: \'travel-province\' }); closeModal();">Province Map (1 Phase)</button>'
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.gmInitiateTravel({ label: \'Last Sea\', region: \'sea\', context: \'sea\', tab: \'lastsea\', phaseCost: 1, reason: \'travel-last-sea\' }); closeModal();">Last Sea (1 Phase)</button>'
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.gmInitiateTravel({ label: \'Galaxy\', region: \'space\', context: \'space\', tab: \'galaxy\', phaseCost: 1, reason: \'travel-galaxy\' }); closeModal();">Galaxy (1 Phase)</button>'
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.gmInitiateTravel({ label: \'World That Was\', region: \'space\', context: \'space\', tab: \'worldthatwas\', phaseCost: 1, reason: \'travel-world-that-was\' }); closeModal();">World That Was (1 Phase)</button>'
      + '</div>'
      + '<div style="font-size:.74rem;color:var(--muted);margin-top:.5rem;">Province travel will keep the currently selected shared hex when one is selected.</div>';
    window.openModal("Campaign Travel", html);
  }

  // Set GM mode (passive/active/facilitative)
  function setGmMode(mode, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can set GM mode" });
      return;
    }
    try {
      var validModes = ["passive", "active", "facilitative"];
      if (validModes.indexOf(mode) === -1) {
        if (callback) callback({ ok: false, error: "Invalid GM mode" });
        return;
      }

      var settings = ensureGmSettings();
      settings.mode = mode;

      if (state.code && state.connected) {
        syncSharedState("set-gm-mode");
      }
      safeNotif("GM Mode: " + mode.charAt(0).toUpperCase() + mode.slice(1));
      if (callback) callback({ ok: true, mode: mode });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  function setGmCameraLock(enabled, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can set camera lock" });
      return;
    }
    try {
      var shared = getMutableCampaignSharedState();
      var settings = ensureGmSettings(shared);
      settings.cameraLock = !!enabled;
      if (state.code && state.connected) {
        syncSharedPatch({ gmSettings: deepCloneJson(settings) || settings }, "set-gm-camera-lock").then(function (res) {
          if (res && res.ok && enabled) {
            syncGmCameraView("enable-camera-lock", { force: true, includeWorldSync: true }).catch(function () {});
          }
          if (callback) callback(res || { ok: false });
        }).catch(function (err) {
          if (callback) callback({ ok: false, error: String(err) });
        });
      } else if (callback) {
        callback({ ok: true, cameraLock: !!enabled, local: true });
      }
      safeNotif("GM Camera Lock " + (enabled ? "enabled" : "disabled") + ".", enabled ? "good" : "info");
      renderSettingsSection();
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // ========== PHASE 2: SEAMLESS EXPERIENCE ==========

  // Initialize or get action queue
  function ensureActionQueue(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.actionQueue || !Array.isArray(sharedState.actionQueue)) {
      sharedState.actionQueue = [];
    }
    return sharedState.actionQueue;
  }

  function maybeNotifyPlayerPatchGuardrail(reason) {
    var now = Date.now();
    var key = String(reason || "player-patch");
    if (state.lastPlayerPatchGuardToastKey === key && (now - Number(state.lastPlayerPatchGuardToastAt || 0)) < 15000) return;
    state.lastPlayerPatchGuardToastAt = now;
    state.lastPlayerPatchGuardToastKey = key;
    if (!state.connected || !state.code) return;
    safeNotif("That player sync update had no permitted shared fields, so it was ignored.", "warn");
  }

  async function syncPlayerSharedPatch(patch, reason, options) {
    if (!state.socket || !state.connected || !state.code) return { ok: false, error: "Not connected." };
    if (!patch || typeof patch !== "object") return { ok: false, error: "Invalid patch." };
    var opts = options && typeof options === "object" ? options : {};
    var safePatch = sanitizePlayerSharedPatch(patch);
    if (!Object.keys(safePatch).length) {
      maybeNotifyPlayerPatchGuardrail(reason || "player-patch");
      return { ok: false, error: "No permitted player patch keys." };
    }
    var gmSettings = ensureGmSettings();
    if (!opts.bypassQueue && String(gmSettings.mode || "passive") === "active") {
      var queue = ensureActionQueue();
      queue.push({
        id: String(Math.random()).slice(2, 10),
        token: state.token,
        playerName: state.playerName || ensureName(),
        type: "player-patch",
        data: {
          patch: deepCloneJson(safePatch) || {},
          reason: String(reason || "player-patch")
        },
        submittedAt: Date.now(),
        status: "pending"
      });
      var queued = await emitWithAck("campaign:syncState", {
        state: { actionQueue: queue },
        reason: "queue-player-patch"
      });
      if (!queued || !queued.ok) {
        safeNotif((queued && queued.error) || "Could not queue update for GM approval.", "warn");
        return queued || { ok: false };
      }
      safeNotif("Action queued for GM approval.", "info");
      return queued;
    }
    var out = await emitWithAck("campaign:syncState", {
      state: safePatch,
      reason: reason || "player-patch"
    });
    if (!out || !out.ok) {
      safeNotif((out && out.error) || "Could not sync player update.", "warn");
      return out || { ok: false };
    }
    return out;
  }

  async function syncSharedPatch(patch, reason) {
    if (!state.socket || !state.connected || !state.code) return { ok: false, error: "Not connected." };
    if (!patch || typeof patch !== "object") return { ok: false, error: "Invalid patch." };
    if (state.role === "player") {
      return syncPlayerSharedPatch(patch, reason || "player-shared-patch");
    }
    var outgoingPatch = prepareOutgoingCombatScenePatch(patch);
    var res = await pushSharedState(outgoingPatch, reason || "gm-shared-patch");
    if (res && res.ok) {
      applyLocalSharedPatch(outgoingPatch);
    }
    return res;
  }

  // Player submits action (add to queue for GM approval if in active mode)
  function submitPlayerAction(actionType, actionData, callback) {
    if (!state.token) {
      if (callback) callback({ ok: false, error: "Not connected to campaign" });
      return;
    }
    try {
      var settings = ensureGmSettings();
      var queue = ensureActionQueue();
      
      var action = {
        id: String(Math.random()).slice(2, 10),
        token: state.token,
        playerName: state.playerName || "Player",
        type: String(actionType || "generic"),
        data: actionData || {},
        submittedAt: Date.now(),
        status: "pending" // pending | approved | rejected | executed
      };

      if (settings.mode === "passive") {
        // In passive mode, execute immediately
        action.status = "executed";
        executePlayerAction(action);
      } else if (settings.mode === "active" || settings.mode === "facilitative") {
        // In active/facilitative modes, queue for GM approval
        queue.push(action);
      }

      if (state.code && state.connected) {
        if (state.role === "player") {
          emitWithAck("campaign:syncState", {
            state: { actionQueue: queue },
            reason: "player-action-submit"
          });
        } else {
          syncSharedState("player-action-submit");
        }
      }
      if (callback) callback({ ok: true, actionId: action.id });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Internal: execute action (modify state based on action type)
  function executePlayerAction(action) {
    if (!action || !action.type) return;
    
    // Action execution hooks - extend based on game systems
    switch (String(action.type)) {
      case "player-patch":
        if (action.data && action.data.patch && typeof action.data.patch === "object") {
          var current = getMutableCampaignSharedState();
          var safePatch = sanitizePlayerSharedPatch(action.data.patch);
          Object.keys(safePatch).forEach(function (k) {
            current[k] = deepCloneJson(safePatch[k]);
          });
        }
        break;
      case "use-item":
        // Example: action.data = { itemIndex: number }
        break;
      case "take-damage":
        // Example: action.data = { amount: number }
        break;
      case "cast-spell":
        // Example: action.data = { spellName: string }
        break;
    }
  }

  // GM approves pending action (executes it)
  function gmApproveAction(actionId, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can approve actions" });
      return;
    }
    try {
      var queue = ensureActionQueue();
      var actionIndex = -1;
      for (var i = 0; i < queue.length; i++) {
        if (queue[i] && String(queue[i].id) === String(actionId)) {
          actionIndex = i;
          break;
        }
      }
      
      if (actionIndex === -1) {
        if (callback) callback({ ok: false, error: "Action not found" });
        return;
      }

      var action = queue[actionIndex];
      action.status = "approved";
      action.approvedAt = Date.now();
      
      executePlayerAction(action);
      action.status = "executed";
      queue.splice(actionIndex, 1);

      if (state.code && state.connected) {
        syncSharedState("gm-approve-action");
      }
      safeNotif("Approved action from " + escapeHtml(action.playerName));
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // GM rejects pending action (removes from queue)
  function gmRejectAction(actionId, reason, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can reject actions" });
      return;
    }
    try {
      var queue = ensureActionQueue();
      var actionIndex = -1;
      for (var i = 0; i < queue.length; i++) {
        if (queue[i] && String(queue[i].id) === String(actionId)) {
          actionIndex = i;
          break;
        }
      }
      
      if (actionIndex === -1) {
        if (callback) callback({ ok: false, error: "Action not found" });
        return;
      }

      var action = queue[actionIndex];
      action.status = "rejected";
      action.rejectedAt = Date.now();
      action.rejectionReason = String(reason || "Rejected by GM");
      
      queue.splice(actionIndex, 1);

      if (state.code && state.connected) {
        syncSharedState("gm-reject-action");
      }
      safeNotif("Rejected action from " + escapeHtml(action.playerName));
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Get pending actions in queue
  function getPendingActions() {
    var queue = ensureActionQueue();
    return queue.filter(function(a) { return a && a.status === "pending"; });
  }

  // Get character's current status (health, stress, conditions)
  function getCharacterStatus(token) {
    var participant = getCampaignParticipantRecord(token);
    if (!participant || !participant.character) return null;
    
    return {
      token: token,
      name: participant.character.name || participant.name || "Wayfarer",
      health: Math.max(0, Number(participant.character.health || 0)),
      maxHealth: resolveCharacterMaxHealth(participant.character),
      mentalStress: Math.max(0, Number(participant.character.mentalStress || 0)),
      maxMentalStress: resolveCharacterMaxMentalStress(participant.character),
      conditions: participant.character.conditions || [],
      isDead: !!(participant.character.isDead),
      role: participant.role || "player",
      lastSeenAt: Number(participant.lastSeenAt || Date.now())
    };
  }

  // Get all party members' status (for party status panel)
  function getPartyStatus() {
    var participants = getCampaignParticipantRecords();
    if (!participants.length) return [];
    var statuses = [];
    participants.forEach(function (participant) {
      if (participant.character) {
        statuses.push(getCharacterStatus(participant.token));
      }
    });
    return statuses;
  }

  // Initialize per-character inventories
  function ensureCharacterInventories(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.characterInventories || typeof sharedState.characterInventories !== "object") {
      sharedState.characterInventories = {};
    }
    return sharedState.characterInventories;
  }

  // Add item to specific character's inventory
  function addItemToCharacterInventory(token, item, callback) {
    if (!state.token) {
      if (callback) callback({ ok: false, error: "Not connected" });
      return;
    }
    try {
      var inventories = ensureCharacterInventories();
      if (!Array.isArray(inventories[token])) {
        inventories[token] = [];
      }
      
      inventories[token].push(normalizeItemLabel(item));
      
      if (state.code && state.connected) {
        if (state.role === "player") {
          syncPlayerSharedPatch({ characterInventories: getMutableCampaignSharedState().characterInventories }, "char-inventory-add");
        } else {
          syncSharedState("char-inventory-add");
        }
      }
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Remove item from character's inventory by index
  function removeItemFromCharacterInventory(token, itemIndex, callback) {
    if (!state.token) {
      if (callback) callback({ ok: false, error: "Not connected" });
      return;
    }
    try {
      var inventories = ensureCharacterInventories();
      if (!Array.isArray(inventories[token])) {
        if (callback) callback({ ok: false, error: "No inventory for character" });
        return;
      }
      
      if (itemIndex < 0 || itemIndex >= inventories[token].length) {
        if (callback) callback({ ok: false, error: "Invalid item index" });
        return;
      }
      
      inventories[token].splice(itemIndex, 1);
      
      if (state.code && state.connected) {
        if (state.role === "player") {
          syncPlayerSharedPatch({ characterInventories: getMutableCampaignSharedState().characterInventories }, "char-inventory-remove");
        } else {
          syncSharedState("char-inventory-remove");
        }
      }
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Get character's inventory
  function getCharacterInventory(token) {
    var inventories = ensureCharacterInventories();
    return Array.isArray(inventories[token]) ? inventories[token].slice() : [];
  }

  // Get all character inventories
  function getAllCharacterInventories() {
    var inventories = ensureCharacterInventories();
    var result = {};
    for (var token in inventories) {
      if (inventories.hasOwnProperty(token)) {
        result[token] = Array.isArray(inventories[token]) ? inventories[token].slice() : [];
      }
    }
    return result;
  }

  // ========== PHASE 3: EDGE CASES & ROBUSTNESS ==========

  // Initialize death/incapacitation state
  function ensureCharacterDeathStates(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.characterDeathStates || typeof sharedState.characterDeathStates !== "object") {
      sharedState.characterDeathStates = {};
    }
    return sharedState.characterDeathStates;
  }

  // Mark character as dead/incapacitated when health reaches 0
  function setCharacterDead(token, isDead, reason, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can change death status" });
      return;
    }
    try {
      var deathStates = ensureCharacterDeathStates();
      if (isDead) {
        deathStates[token] = {
          dead: true,
          at: Date.now(),
          reason: String(reason || "Health reached 0")
        };
      } else {
        if (deathStates[token]) {
          deathStates[token].dead = false;
          deathStates[token].revivedAt = Date.now();
        }
      }

      if (state.code && state.connected) {
        syncSharedState("set-character-dead");
      }
      var p = getCampaignParticipantRecord(token);
      var pname = p ? (p.name || "Character") : "Character";
      safeNotif((isDead ? "DEATH: " : "Revived: ") + escapeHtml(pname));
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Check if character is dead
  function isCharacterDead(token) {
    var deathStates = ensureCharacterDeathStates();
    var state = deathStates[token];
    return !!(state && state.dead);
  }

  // Get all dead characters
  function getDeadCharacters() {
    var deathStates = ensureCharacterDeathStates();
    var dead = [];
    for (var token in deathStates) {
      if (deathStates.hasOwnProperty(token) && deathStates[token] && deathStates[token].dead) {
        dead.push({
          token: token,
          deadAt: deathStates[token].at,
          reason: deathStates[token].reason
        });
      }
    }
    return dead;
  }

  // Prevent dead characters from acting in combat
  function canCharacterAct(token) {
    return !isCharacterDead(token);
  }

  // Initialize contested rolls
  function ensureContestedRolls(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!Array.isArray(sharedState.contestedRolls)) {
      sharedState.contestedRolls = [];
    }
    return sharedState.contestedRolls;
  }

  // Start a contested roll (player vs player or player vs environment)
  function startContestedRoll(challenger, defender, challengeType, dread, callback) {
    if (!state.role || state.role !== "gm") {
      if (callback) callback({ ok: false, error: "Only GM can start contested rolls" });
      return;
    }
    try {
      var rolls = ensureContestedRolls();
      var contested = {
        id: String(Math.random()).slice(2, 10),
        challenger: String(challenger || ""),
        defender: String(defender || ""),
        type: String(challengeType || "opposed"),
        dread: Math.max(1, Number(dread || 8)),
        createdAt: Date.now(),
        challengerRoll: null,
        defenderRoll: null,
        winner: null,
        status: "pending" // pending | resolved
      };

      rolls.push(contested);

      if (state.code && state.connected) {
        syncSharedState("contested-roll-start");
      }
      safeNotif("Contested roll started: " + challengeType);
      if (callback) callback({ ok: true, contestedId: contested.id });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Submit roll for contested roll
  function submitContestedRoll(contestedId, playerToken, rollResult, dieSize, callback) {
    if (!state.token) {
      if (callback) callback({ ok: false, error: "Not connected" });
      return;
    }
    try {
      var rolls = ensureContestedRolls();
      var contested = null;
      for (var i = 0; i < rolls.length; i++) {
        if (rolls[i] && String(rolls[i].id) === String(contestedId)) {
          contested = rolls[i];
          break;
        }
      }

      if (!contested) {
        if (callback) callback({ ok: false, error: "Contested roll not found" });
        return;
      }

      if (String(contested.challenger) === String(playerToken) && !contested.challengerRoll) {
        contested.challengerRoll = { value: Number(rollResult || 0), die: Number(dieSize || 4), submittedAt: Date.now() };
      } else if (String(contested.defender) === String(playerToken) && !contested.defenderRoll) {
        contested.defenderRoll = { value: Number(rollResult || 0), die: Number(dieSize || 4), submittedAt: Date.now() };
      } else {
        if (callback) callback({ ok: false, error: "Player already submitted or roll not applicable" });
        return;
      }

      // Auto-resolve if both submitted
      if (contested.challengerRoll && contested.defenderRoll) {
        var cTotal = contested.challengerRoll.value;
        var dTotal = contested.defenderRoll.value;
        if (cTotal > dTotal) {
          contested.winner = "challenger";
        } else if (dTotal > cTotal) {
          contested.winner = "defender";
        } else {
          contested.winner = "tie";
        }
        contested.status = "resolved";
      }

      if (state.code && state.connected) {
        if (state.role === "player") {
          syncPlayerSharedPatch({ contestedRolls: rolls }, "contested-roll-submit");
        } else {
          syncSharedState("contested-roll-submit");
        }
      }
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Get a specific contested roll
  function getContestedRoll(contestedId) {
    var rolls = ensureContestedRolls();
    for (var i = 0; i < rolls.length; i++) {
      if (rolls[i] && String(rolls[i].id) === String(contestedId)) {
        return rolls[i];
      }
    }
    return null;
  }

  // Initialize character dice (for dice visibility & turn order)
  function ensureCharacterDice(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.characterDice || typeof sharedState.characterDice !== "object") {
      sharedState.characterDice = {};
    }
    return sharedState.characterDice;
  }

  // Track character's die sizes (for Wayfarer's Lead and visibility)
  function setCharacterDice(token, diceConfig, callback) {
    if (!state.token) {
      if (callback) callback({ ok: false, error: "Not connected" });
      return;
    }
    try {
      var dice = ensureCharacterDice();
      dice[token] = {
        valor: Math.max(4, Number((diceConfig && (diceConfig.valor)) || 4)),
        body: Math.max(4, Number((diceConfig && diceConfig.body) || 4)),
        mind: Math.max(4, Number((diceConfig && diceConfig.mind) || 4)),
        spirit: Math.max(4, Number((diceConfig && diceConfig.spirit) || 4)),
        control: Math.max(4, Number((diceConfig && diceConfig.control) || 4)),
        strike: Math.max(4, Number((diceConfig && diceConfig.strike) || 4)),
        shoot: Math.max(4, Number((diceConfig && diceConfig.shoot) || 4)),
        defend: Math.max(4, Number((diceConfig && diceConfig.defend) || 4)),
        wayfarersLead: Math.max(1, Number((diceConfig && diceConfig.wayfarersLead) || 1)),
        updatedAt: Date.now()
      };

      if (state.code && state.connected) {
        if (state.role === "player") {
          syncPlayerSharedPatch({ characterDice: dice }, "set-character-dice");
        } else {
          syncSharedState("set-character-dice");
        }
      }
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Get character's dice configuration
  function getCharacterDice(token) {
    var dice = ensureCharacterDice();
    return dice[token] || {
      valor: 4, body: 4, mind: 4, spirit: 4, control: 4,
      strike: 4, shoot: 4, defend: 4, wayfarersLead: 1
    };
  }

  // Get the largest die size across all players (actual Wayfarer's Lead die)
  function getLargestWayfarersLeadDie() {
    var allDice = ensureCharacterDice();
    var largest = 1;
    for (var token in allDice) {
      if (allDice.hasOwnProperty(token)) {
        var die = Number(allDice[token].wayfarersLead || 1);
        if (die > largest) largest = die;
      }
    }
    return largest;
  }

  // Get all character dice (for display/reference)
  function getAllCharacterDice() {
    return ensureCharacterDice();
  }

  function getTmwValue() {
    if (typeof window.S === "undefined" || !window.S) return 0;
    return Math.max(0, Number(window.S.tmw || 0));
  }

  function getCreditsValue() {
    if (typeof window.S === "undefined" || !window.S) return 0;
    return Math.max(0, Number(window.S.credits || 0));
  }

  function getRenownValue() {
    if (typeof window.S === "undefined" || !window.S) return 0;
    return Math.max(0, Number(window.S.renown || 0));
  }

  function setLocalTmw(value) {
    if (typeof window.S === "undefined" || !window.S) return;
    state.suppressTmwEmit = true;
    window.S.tmw = Math.max(0, Number(value || 0));
    if (typeof window.updateTMWPool === "function") {
      window.updateTMWPool();
    }
    state.lastKnownTmw = window.S.tmw;
    setTimeout(function () { state.suppressTmwEmit = false; }, 0);
  }

  async function syncCurrentTmw(reason) {
    if (!state.connected || !state.code) return;
    if (state.suppressTmwEmit) return;
    var tmw = getTmwValue();
    if (state.lastKnownTmw === tmw) return;
    state.lastKnownTmw = tmw;
    await emitWithAck("campaign:setTmw", { value: tmw, reason: reason || "sync" });
  }

  async function syncMentalStressDelta(delta, reason) {
    if (!state.connected || !state.code) return;
    var val = Number(delta || 0);
    if (!Number.isFinite(val) || val === 0) return;
    await emitWithAck("campaign:deltaMentalStress", { delta: val, reason: reason || "sync" });
  }

  async function syncCreditsDelta(delta, reason) {
    if (!state.connected || !state.code) return;
    if (state.applyingSharedState || state.suppressCreditsEmit) return;
    var val = Number(delta || 0);
    if (!Number.isFinite(val) || val === 0) return;
    await emitWithAck("campaign:deltaCredits", { delta: val, reason: reason || "sync" });
  }

  async function syncRenownDelta(delta, reason) {
    if (!state.connected || !state.code) return;
    if (state.applyingSharedState || state.suppressRenownEmit) return;
    var val = Number(delta || 0);
    if (!Number.isFinite(val) || val === 0) return;
    await emitWithAck("campaign:deltaRenown", { delta: val, reason: reason || "sync" });
  }

  function patchTmwHooks() {
    if (window._campaignPatchedTmwHooks) return;
    if (typeof window.updateTMWPool !== "function") return;

    var originalUpdate = window.updateTMWPool;
    window.updateTMWPool = function () {
      var before = getTmwValue();
      var result = originalUpdate.apply(this, arguments);
      var after = getTmwValue();
      if (before !== after || state.lastKnownTmw !== after) {
        if (!state.suppressTmwEmit) {
          if (!state.suppressEconomyLedgerAuto) {
            recordEconomyDelta("tmw", after - before, "updateTMWPool");
          }
        }
        syncCurrentTmw("updateTMWPool");
      }
      return result;
    };

    if (typeof window.changeCounter === "function") {
      var originalCounter = window.changeCounter;
      window.changeCounter = function (key, delta) {
        var result = originalCounter.apply(this, arguments);
        if (key === "tmw") {
          syncCurrentTmw("changeCounter");
        }
        return result;
      };
    }

    window._campaignPatchedTmwHooks = true;
  }

  function patchMentalStressHooks() {
    if (window._campaignPatchedMentalStressHooks) return;
    if (typeof window.changeMentalStress !== "function") return;

    var originalMental = window.changeMentalStress;
    window.changeMentalStress = function (delta) {
      var before = (typeof window.S !== "undefined" && window.S) ? Number(window.S.mentalStress || 0) : 0;
      var result = originalMental.apply(this, arguments);
      var after = (typeof window.S !== "undefined" && window.S) ? Number(window.S.mentalStress || 0) : before;
      var appliedDelta = after - before;
      if (!state.suppressMentalStressEmit && appliedDelta !== 0) {
        state.lastKnownMentalStress = after;
        syncMentalStressDelta(appliedDelta, "changeMentalStress");
      }
      return result;
    };

    window._campaignPatchedMentalStressHooks = true;
  }

  function patchSharedEconomyHooks() {
    if (window._campaignPatchedSharedEconomyHooks) return;

    if (typeof window.updateCreditsUI === "function") {
      var originalCredits = window.updateCreditsUI;
      window.updateCreditsUI = function () {
        var before = getCreditsValue();
        var result = originalCredits.apply(this, arguments);
        var after = getCreditsValue();
        var appliedDelta = after - before;
        if (!state.suppressCreditsEmit && appliedDelta !== 0) {
          state.lastKnownCredits = after;
          if (!state.suppressEconomyLedgerAuto) {
            recordEconomyDelta("credits", appliedDelta, "updateCreditsUI");
          }
          syncCreditsDelta(appliedDelta, "updateCreditsUI");
        }
        if (state.lastKnownCredits === null) state.lastKnownCredits = after;
        return result;
      };
    }

    if (typeof window.updateRenown === "function") {
      var originalRenown = window.updateRenown;
      window.updateRenown = function () {
        var before = getRenownValue();
        var result = originalRenown.apply(this, arguments);
        var after = getRenownValue();
        var appliedDelta = after - before;
        if (!state.suppressRenownEmit && appliedDelta !== 0) {
          state.lastKnownRenown = after;
          if (!state.suppressEconomyLedgerAuto) {
            recordEconomyDelta("renown", appliedDelta, "updateRenown");
          }
          syncRenownDelta(appliedDelta, "updateRenown");
        }
        if (state.lastKnownRenown === null) state.lastKnownRenown = after;
        return result;
      };
    }

    if (typeof window.changeCounter === "function") {
      var originalCounter = window.changeCounter;
      window.changeCounter = function (key, delta) {
        var beforeCredits = getCreditsValue();
        var beforeRenown = getRenownValue();
        var result = originalCounter.apply(this, arguments);
        var afterCredits = getCreditsValue();
        var afterRenown = getRenownValue();
        if (key === "credits") {
          syncCreditsDelta(afterCredits - beforeCredits, "changeCounter");
        }
        return result;
      };
    }

    window._campaignPatchedSharedEconomyHooks = true;
  }

  function renderMembers(list) {
    if (!Array.isArray(list) || !list.length) {
      return '<div class="campaign-muted">No connected members.</div>';
    }
    return list.map(function (m) {
      var roleTag = m.role === "gm" ? "<span class=\"campaign-pill gm\">GM</span>" : "<span class=\"campaign-pill\">Player</span>";
      return '<div class="campaign-member-row"><span>' + escapeHtml(m.name || "Player") + '</span>' + roleTag + "</div>";
    }).join("");
  }

  function renderCharacterRoster(list, canViewSheets) {
    if (!Array.isArray(list) || !list.length) {
      return '<div class="campaign-muted">No campaign wayfarers yet.</div>';
    }
    var items = list.slice();
    if (state.gmWayfarerSort === "updated") {
      items.sort(function (a, b) {
        var au = a && a.character && a.character.updatedAt ? Number(a.character.updatedAt) : Number(a && a.lastSeenAt || 0);
        var bu = b && b.character && b.character.updatedAt ? Number(b.character.updatedAt) : Number(b && b.lastSeenAt || 0);
        return bu - au;
      });
    } else {
      items.sort(function (a, b) {
        var ao = a && a.online ? 1 : 0;
        var bo = b && b.online ? 1 : 0;
        if (ao !== bo) return bo - ao;
        var au = a && a.character && a.character.updatedAt ? Number(a.character.updatedAt) : Number(a && a.lastSeenAt || 0);
        var bu = b && b.character && b.character.updatedAt ? Number(b.character.updatedAt) : Number(b && b.lastSeenAt || 0);
        return bu - au;
      });
    }

    return items.map(function (p) {
      var c = p && p.character ? p.character : null;
      var nm = c && c.name ? c.name : (p && p.name ? p.name : "Wayfarer");
      var hp = c && typeof c.health === "number" ? c.health : 0;
      var backpackItems = c && Array.isArray(c.backpack) ? normalizeBackpackItems(c.backpack) : [];
      var look = c && c.look ? String(c.look).slice(0, 120) : "No look set";
      var updatedAt = c && c.updatedAt ? Number(c.updatedAt) : Number(p && p.lastSeenAt || 0);
      var initials = String(nm || "W").trim().split(/\s+/).slice(0, 2).map(function (part) {
        return part ? part.charAt(0).toUpperCase() : "";
      }).join("") || "W";
      var lookTags = [];
      if (look && look !== "No look set") {
        String(look).split(/\s+/).forEach(function (word) {
          var cleaned = String(word || "").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
          if (!cleaned || cleaned.length < 4) return;
          if (lookTags.indexOf(cleaned) === -1) lookTags.push(cleaned);
        });
      }
      var tagsHtml = lookTags.slice(0, 3).map(function (tag) {
        return '<span class="campaign-look-tag">' + escapeHtml(tag) + '</span>';
      }).join("");
      var roleText = (p && p.role === "gm") ? "GM" : "Player";
      var onlineText = p && p.online ? "Online" : "Offline";
      var tokenValue = String(p && p.token || "").replace(/'/g, "\\'");
      return ''
        + '<div class="campaign-wayfarer-row">'
        + '<div class="campaign-wayfarer-main">'
        + '<div class="campaign-portrait">' + escapeHtml(initials) + '</div>'
        + '<div class="campaign-wayfarer-info">'
        + '<div><strong>' + escapeHtml(nm) + '</strong> <span class="campaign-muted">HP ' + Number(hp) + '</span></div>'
        + '<div class="campaign-look-tags">' + (backpackItems.length
          ? backpackItems.slice(0, 3).map(function (item, idx) {
              return '<button class="btn btn-xs" style="margin:0 .2rem .2rem 0;" onclick="window.campaignSystem.copyRosterItem(\'' + tokenValue + '\',' + idx + ')">Copy ' + escapeHtml(item) + '</button>';
            }).join("")
          : '<span class="campaign-look-tag">no shared items</span>') + '</div>'
        + '<div class="campaign-look-tags">' + (tagsHtml || '<span class="campaign-look-tag">untyped</span>') + '</div>'
        + '<div class="campaign-muted">' + escapeHtml(look) + '</div>'
        + '<div class="campaign-muted">Updated ' + escapeHtml(formatTimestamp(updatedAt) || "-") + '</div>'
        + (canViewSheets
          ? ('<div style="margin-top:.25rem;"><button class="btn btn-xs btn-teal" onclick="window.campaignSystem.viewRosterSheet(\'' + tokenValue + '\')">View Sheet</button></div>')
          : '')
        + '</div>'
        + '</div>'
        + '<div class="campaign-wayfarer-pills">'
        + '<span class="campaign-pill ' + ((p && p.role === "gm") ? 'gm' : '') + '">' + escapeHtml(roleText) + '</span>'
        + '<span class="campaign-pill ' + ((p && p.online) ? 'online' : '') + '">' + escapeHtml(onlineText) + '</span>'
        + '</div>'
        + '</div>';
    }).join("");
  }

  function buildRosterSheetHtml(member) {
    var c = member && member.character ? member.character : null;
    if (!c) {
      return '<div class="campaign-muted">No synced character sheet is available for this wayfarer yet.</div>';
    }
    var stats = c && c.stats && typeof c.stats === "object" ? c.stats : {};
    var backpack = Array.isArray(c.backpack) ? c.backpack.filter(Boolean) : [];
    var loadout = c && c.loadout && typeof c.loadout === "object" ? c.loadout : {};
    var hacks = Array.isArray(c.hacks) ? c.hacks.filter(Boolean) : [];
    var conditions = c && c.conditions && typeof c.conditions === "object" ? c.conditions : {};
    var activeConditions = Object.keys(conditions).filter(function (key) { return !!conditions[key]; });
    var updatedAt = c && c.updatedAt ? Number(c.updatedAt) : Number(member && member.lastSeenAt || 0);
    var stress = Math.max(0, Number(c.stress != null ? c.stress : c.mentalStress || 0));
    var maxStress = Math.max(1, Number(c.maxMentalStress || c.mentalStressCap || c.stressCap || 20));
    var health = Math.max(0, Number(c.health || 0));
    var maxHealth = Math.max(1, Number(c.maxHealth || c.maxStress || resolveCharacterMaxHealth(c)));
    var pathTokens = Math.max(0, Number(c.pathTokens || 0));
    var statRows = [
      ["Body", stats.body],
      ["Mind", stats.mind],
      ["Spirit", stats.spirit],
      ["Control", stats.control],
      ["Lead", stats.lead],
      ["Valor", stats.valor]
    ];
    return ''
      + '<div style="display:grid;gap:.55rem;">'
      + '<div style="font-size:.82rem;color:var(--muted2);line-height:1.6;">'
      + '<strong style="color:var(--gold2);">' + escapeHtml(c.name || member.name || "Wayfarer") + '</strong>'
      + ' · ' + escapeHtml(member && member.online ? 'Online' : 'Offline')
      + ' · Updated ' + escapeHtml(formatTimestamp(updatedAt) || "-")
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,minmax(110px,1fr));gap:.35rem;">'
      + statRows.map(function (row) {
          return '<div class="info-cell"><span class="ic-label">' + escapeHtml(row[0]) + '</span>d' + Math.max(4, Number(row[1] || 4)) + '</div>';
        }).join('')
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;">'
      + '<div class="info-cell"><span class="ic-label">Health</span>' + health + '/' + maxHealth + '</div>'
      + '<div class="info-cell"><span class="ic-label">Mental Stress</span>' + stress + '/' + maxStress + '</div>'
      + '<div class="info-cell"><span class="ic-label">Path Tokens</span>' + pathTokens + '</div>'
      + '</div>'
      + '<div class="info-cell"><span class="ic-label">Loadout</span>'
      + escapeHtml([loadout.weapon1, loadout.weapon2, loadout.armor, loadout.readied].filter(Boolean).join(' | ') || 'No loadout synced')
      + '</div>'
      + '<div class="info-cell"><span class="ic-label">OS Hacks</span>'
      + (hacks.length ? hacks.map(function (hack) { return '<span class="campaign-look-tag" style="margin:0 .2rem .2rem 0;display:inline-block;">' + escapeHtml(String(hack)) + '</span>'; }).join('') : '<span class="campaign-muted">No hacks synced.</span>')
      + '</div>'
      + '<div class="info-cell"><span class="ic-label">Conditions</span>'
      + (activeConditions.length ? escapeHtml(activeConditions.join(", ")) : '<span class="campaign-muted">No active conditions.</span>')
      + '</div>'
      + '<div class="info-cell"><span class="ic-label">Look / Flavor</span>' + escapeHtml(c.look || 'No look shared') + '</div>'
      + '<div class="info-cell"><span class="ic-label">Backpack</span>'
      + (backpack.length ? backpack.map(function (item) { return '<span class="campaign-look-tag" style="margin:0 .2rem .2rem 0;display:inline-block;">' + escapeHtml(String(item)) + '</span>'; }).join('') : '<span class="campaign-muted">No backpack items synced.</span>')
      + '</div>'
      + '</div>';
  }

  function viewRosterSheet(token) {
    if (state.role !== "gm") {
      safeNotif("Only the GM can inspect roster character sheets.", "warn");
      return;
    }
    var roster = state.campaign && Array.isArray(state.campaign.roster) ? state.campaign.roster : [];
    var target = roster.find(function (member) { return String(member.token || "") === String(token || ""); });
    if (!target) {
      safeNotif("That wayfarer is no longer in the campaign roster.", "warn");
      return;
    }
    state.activeRosterSheetToken = String(target.token || "");
    if (typeof openModal === "function") {
      openModal("Campaign Character Sheet", buildRosterSheetHtml(target));
      return;
    }
    safeNotif("Character sheet ready, but modal UI is unavailable.", "warn");
  }

  function setWayfarerSort(mode) {
    var next = String(mode || "online");
    if (["online", "updated"].indexOf(next) === -1) next = "online";
    state.gmWayfarerSort = next;
    renderSettingsSection();
  }

  function collectCharacterSummary() {
    var stats = (typeof window.S !== "undefined" && window.S && window.S.stats) ? window.S.stats : {};
    var hp = (typeof window.S !== "undefined" && window.S)
      ? ((typeof window.S.health === "number") ? window.S.health : 0)
      : 0;
    var mentalStress = (typeof window.S !== "undefined" && window.S)
      ? ((typeof window.S.mentalStress === "number") ? window.S.mentalStress : 0)
      : 0;
    var look = (typeof window.S !== "undefined" && window.S)
      ? (window.S.look || window.S.flavor || window.S.reason || "")
      : "";
    var defendDie = Math.max(4, Number(stats.defend || stats.body || 4));
    var tempStressBonus = Math.max(0, Number((typeof window.S !== "undefined" && window.S && window.S.tempStressCapacityBonus) || 0));
    var maxHealth = (typeof window.S !== "undefined" && window.S && Number(window.S.maxHealth) > 0)
      ? Math.max(1, Number(window.S.maxHealth))
      : Math.max(1, defendDie * 2 + tempStressBonus);
    var maxMentalStress = (typeof window.S !== "undefined" && window.S && Number(window.S.maxMentalStress) > 0)
      ? Math.max(1, Number(window.S.maxMentalStress))
      : 20;
    var equipment = (typeof window.S !== "undefined" && window.S && window.S.equipment && typeof window.S.equipment === "object")
      ? window.S.equipment
      : {};
    var ownedHacks = (typeof window.S !== "undefined" && window.S && Array.isArray(window.S.ownedHacks))
      ? window.S.ownedHacks
      : [];
    var conditions = (typeof window.S !== "undefined" && window.S && window.S.conditions && typeof window.S.conditions === "object")
      ? window.S.conditions
      : {};
    return {
      name: ensureName(),
      health: Math.max(0, Number(hp || 0)),
      maxHealth: maxHealth,
      mentalStress: Math.max(0, Number(mentalStress || 0)),
      maxMentalStress: maxMentalStress,
      stress: Math.max(0, Number(mentalStress || 0)),
      rads: Math.max(0, Number((typeof window.S !== "undefined" && window.S && window.S.rads) || 0)),
      pathTokens: Math.max(0, Number((typeof window.S !== "undefined" && window.S && window.S.pathTokens) || 0)),
      successRolls: Math.max(0, Number((typeof window.S !== "undefined" && window.S && (window.S.successRolls || window.S.successRollCount)) || 0)),
      successRollCount: Math.max(0, Number((typeof window.S !== "undefined" && window.S && (window.S.successRolls || window.S.successRollCount)) || 0)),
      look: String(look || "").slice(0, 180),
      stats: {
        body: Number(stats.body || 4),
        mind: Number(stats.mind || 4),
        spirit: Number(stats.spirit || 4),
        control: Number(stats.control || 4),
        lead: Number(stats.lead || 4),
        defend: Number(stats.defend || 4),
        strike: Number(stats.strike || 4),
        shoot: Number(stats.shoot || 4),
        valor: Number((stats.valor) || 4)
      },
      loadout: {
        weapon1: String(equipment.weapon1 || "").trim(),
        weapon2: String(equipment.weapon2 || "").trim(),
        armor: String(equipment.armor || "").trim(),
        readied: String(equipment.readied || "").trim()
      },
      conditions: {
        empowered: !!conditions.empowered,
        protected: !!conditions.protected,
        focused: !!conditions.focused,
        bolstered: !!conditions.bolstered,
        weakened: !!conditions.weakened,
        vulnerable: !!conditions.vulnerable,
        distracted: !!conditions.distracted,
        shaken: !!conditions.shaken
      },
      hacks: ownedHacks.map(function (name) { return String(name || "").trim(); }).filter(Boolean),
      backpack: normalizeBackpackItems(window.S && window.S.backpack)
    };
  }

  function findRosterCharacterSnapshot(snapshot, token) {
    if (!snapshot || !Array.isArray(snapshot.roster)) return null;
    var wanted = String(token || "").trim();
    if (!wanted) return null;
    for (var i = 0; i < snapshot.roster.length; i += 1) {
      var entry = snapshot.roster[i];
      if (!entry || String(entry.token || "") !== wanted || !entry.character || typeof entry.character !== "object") continue;
      return entry.character;
    }
    return null;
  }

  function applyAuthoritativeSelfCharacterFromSnapshot(snapshot) {
    if (!snapshot || state.role !== "player" || !state.token || typeof window.S === "undefined" || !window.S) return false;
    var character = findRosterCharacterSnapshot(snapshot, state.token);
    if (!character) return false;

    var updatedAt = Number(character.updatedAt || 0) || 0;
    if (updatedAt && updatedAt <= Number(state.lastAppliedSelfCharacterAt || 0)) return false;

    var nextHealth = Math.max(0, Number(character.health || 0));
    var nextMentalStress = Math.max(0, Number((typeof character.mentalStress === "number" ? character.mentalStress : character.stress) || 0));
    var nextRads = Math.max(0, Number(character.rads || character.radiation || 0));
    var nextPathTokens = Math.max(0, Number(character.pathTokens || 0));
    var nextSuccessRolls = Math.max(0, Number(character.successRolls || character.successRollCount || 0));
    var nextConditions = character.conditions && typeof character.conditions === "object"
      ? character.conditions
      : null;
    var changed = false;

    if (Number(window.S.health || 0) !== nextHealth) {
      window.S.health = nextHealth;
      window.S.stress = nextHealth;
      changed = true;
    }
    if (Number(window.S.mentalStress || 0) !== nextMentalStress) {
      window.S.mentalStress = nextMentalStress;
      changed = true;
    }
    if (Number(window.S.rads || 0) !== nextRads) {
      window.S.rads = nextRads;
      changed = true;
    }
    if (Number(window.S.pathTokens || 0) !== nextPathTokens) {
      window.S.pathTokens = nextPathTokens;
      changed = true;
    }
    if (Number(window.S.successRolls || window.S.successRollCount || 0) !== nextSuccessRolls) {
      window.S.successRolls = nextSuccessRolls;
      window.S.successRollCount = nextSuccessRolls;
      changed = true;
    }
    if (nextConditions && window.S.conditions && typeof window.S.conditions === "object") {
      var nextConditionHash = JSON.stringify({
        empowered: !!nextConditions.empowered,
        protected: !!nextConditions.protected,
        focused: !!nextConditions.focused,
        bolstered: !!nextConditions.bolstered,
        weakened: !!nextConditions.weakened,
        vulnerable: !!nextConditions.vulnerable,
        distracted: !!nextConditions.distracted,
        shaken: !!nextConditions.shaken
      });
      var currentConditionHash = JSON.stringify({
        empowered: !!window.S.conditions.empowered,
        protected: !!window.S.conditions.protected,
        focused: !!window.S.conditions.focused,
        bolstered: !!window.S.conditions.bolstered,
        weakened: !!window.S.conditions.weakened,
        vulnerable: !!window.S.conditions.vulnerable,
        distracted: !!window.S.conditions.distracted,
        shaken: !!window.S.conditions.shaken
      });
      if (nextConditionHash !== currentConditionHash) {
        window.S.conditions.empowered = !!nextConditions.empowered;
        window.S.conditions.protected = !!nextConditions.protected;
        window.S.conditions.focused = !!nextConditions.focused;
        window.S.conditions.bolstered = !!nextConditions.bolstered;
        window.S.conditions.weakened = !!nextConditions.weakened;
        window.S.conditions.vulnerable = !!nextConditions.vulnerable;
        window.S.conditions.distracted = !!nextConditions.distracted;
        window.S.conditions.shaken = !!nextConditions.shaken;
        changed = true;
      }
    }

    state.lastAppliedSelfCharacterAt = updatedAt || Date.now();
    state.lastCharacterHash = JSON.stringify(collectCharacterSummary());

    if (!changed) return false;
    if (typeof window.updateStressUI === "function") window.updateStressUI();
    if (typeof window.updateMentalStressUI === "function") window.updateMentalStressUI();
    if (typeof window.updateRadsUI === "function") window.updateRadsUI();
    if (typeof window.updateConditionButtons === "function") window.updateConditionButtons();
    var pathTokenEl = document.getElementById("pathTokensVal");
    if (pathTokenEl) pathTokenEl.textContent = String(window.S.pathTokens || 0);
    var successRollEl = document.getElementById("successRollsVal");
    if (successRollEl) successRollEl.textContent = String(window.S.successRolls || window.S.successRollCount || 0);
    if (typeof window.updateAllStatDisplays === "function") window.updateAllStatDisplays();
    return true;
  }

  async function applyGmCheckOutcome(spec) {
    if (!state.socket || !state.connected || !state.code) {
      return { ok: false, error: "Not connected." };
    }
    if (state.role !== "gm") {
      safeNotif("Only the GM can apply shared check outcomes.", "warn");
      return { ok: false, error: "Only the GM can apply shared check outcomes." };
    }

    var details = spec && typeof spec === "object" ? spec : {};
    var targetTokens = Array.isArray(details.targetTokens)
      ? details.targetTokens.map(function (token) { return String(token || "").trim(); }).filter(Boolean)
      : [];
    var characterDelta = details.characterDelta && typeof details.characterDelta === "object"
      ? normalizeSceneCharacterDelta(details.characterDelta)
      : {};
    var sharedDelta = details.sharedDelta && typeof details.sharedDelta === "object"
      ? normalizeSceneSharedDelta(details.sharedDelta)
      : {};

    var requestPayload = {
      checkId: String(details.checkId || "").slice(0, 80),
      label: String(details.label || "Campaign Check").slice(0, 120),
      outcome: String(details.outcome || "success").toLowerCase() === "failure" ? "failure" : "success",
      scope: String(details.scope || (targetTokens.length > 1 ? "party" : "individual")).slice(0, 24),
      targetTokens: targetTokens,
      characterDelta: {
        health: Number(characterDelta.health || 0) || 0,
        mentalStress: Number(characterDelta.mentalStress || 0) || 0,
        radiation: Number(characterDelta.radiation || characterDelta.rads || 0) || 0,
        pathTokens: Number(characterDelta.pathTokens || 0) || 0,
        successRolls: Number(characterDelta.successRolls || characterDelta.successRollCount || 0) || 0
      },
      sharedDelta: {
        tmw: Number(sharedDelta.tmw || 0) || 0
      }
    };

    return emitWithAck("campaign:gmApplyCheckOutcome", requestPayload).then(function (res) {
      if (res && res.ok) {
        applyLocalCharacterDeltaIfTargeted(targetTokens, requestPayload.characterDelta);
      }
      return res;
    });
  }

  async function shareBackpackItem(slotIndex) {
    if (typeof window.S === "undefined" || !window.S) return { ok: false, error: "Missing character state." };
    if (!Array.isArray(window.S.backpack)) {
      safeNotif("No backpack items to share.", "warn");
      return { ok: false, error: "No backpack items to share." };
    }
    var idx = Math.max(0, Number(slotIndex || 0));
    var item = normalizeItemLabel(window.S.backpack[idx]);
    if (!item) {
      safeNotif("That backpack slot is empty.", "warn");
      return { ok: false, error: "That backpack slot is empty." };
    }
    state.characterSyncSuppressUntil = Date.now() + 1200;
    var res = await emitWithAck("campaign:stashShare", { item: item });
    if (!res.ok) {
      safeNotif(res.error || "Could not share item.", "warn");
      return { ok: false, error: res.error || "Could not share item." };
    }
    var sharedState = getMutableCampaignSharedState();
    if (!Array.isArray(sharedState.partyStash)) sharedState.partyStash = [];
    sharedState.partyStash = sharedState.partyStash.slice();
    sharedState.partyStash.push(item);
    window.S.backpack[idx] = "";
    if (typeof window.renderBackpackUI === "function") window.renderBackpackUI();
    await syncCharacterToCampaign(true);
    safeNotif("Shared item to party stash: " + item, "good");
    return {
      ok: true,
      item: item,
      backpack: Array.isArray(window.S.backpack) ? window.S.backpack.slice() : []
    };
  }

  async function claimSharedItem(stashIndex) {
    var hasSlot = Array.isArray(window.S && window.S.backpack) && window.S.backpack.indexOf("") >= 0;
    if (!hasSlot) {
      safeNotif("Backpack full.", "warn");
      return { ok: false, error: "Backpack full." };
    }
    var shared = getCampaignSharedState();
    var list = Array.isArray(shared.partyStash) ? shared.partyStash.slice() : [];
    var idx = Math.max(0, Number(stashIndex || 0));
    // Capture item name locally before the server removes it from the stash.
    var localItem = normalizeItemLabel(list[idx]);
    if (!localItem) {
      safeNotif("That party stash item is no longer available.", "warn");
      return { ok: false, error: "That party stash item is no longer available." };
    }
    state.characterSyncSuppressUntil = Date.now() + 1200;
    var res = await emitWithAck("campaign:stashClaim", { index: idx });
    if (!res.ok) {
      safeNotif(res.error || "Could not claim party item.", "warn");
      return { ok: false, error: res.error || "Could not claim party item." };
    }
    // Prefer server-confirmed item name; fall back to the locally-read value so the
    // slot text is never blank even if the server ack arrives before the state snapshot.
    var claimedItem = normalizeItemLabel((res && res.item) || localItem);
    if (!claimedItem) {
      safeNotif("Claimed item, but item name was empty. Check your backpack.", "warn");
      return { ok: false, error: "Claimed item name was empty." };
    }
    if (!addItemToBackpack(claimedItem)) {
      safeNotif("Claimed item, but backpack storage failed.", "warn");
      return { ok: false, error: "Claimed item, but backpack storage failed." };
    }
    var nextSharedState = getMutableCampaignSharedState();
    var nextPartyStash = Array.isArray(nextSharedState.partyStash) ? nextSharedState.partyStash.slice() : [];
    if (idx >= 0 && idx < nextPartyStash.length && normalizeItemLabel(nextPartyStash[idx]) === claimedItem) {
      nextPartyStash.splice(idx, 1);
    } else {
      var localIdx = nextPartyStash.findIndex(function (entry) {
        return normalizeItemLabel(entry) === claimedItem;
      });
      if (localIdx >= 0) nextPartyStash.splice(localIdx, 1);
    }
    nextSharedState.partyStash = nextPartyStash;
    // Re-render manually in case the incoming state snapshot clears the slot before renderBackpackUI.
    if (typeof window.renderBackpackUI === "function") {
      setTimeout(function () { window.renderBackpackUI(); }, 80);
    }
    await syncCharacterToCampaign(true);
    safeNotif("Claimed from party stash: " + claimedItem, "good");
    return {
      ok: true,
      item: claimedItem,
      backpack: Array.isArray(window.S.backpack) ? window.S.backpack.slice() : []
    };
  }

  function copyRosterItem(token, itemIndex) {
    var roster = state.campaign && Array.isArray(state.campaign.roster) ? state.campaign.roster : [];
    var target = roster.find(function (member) { return String(member.token || "") === String(token || ""); });
    var item = target && target.character && Array.isArray(target.character.backpack)
      ? String(target.character.backpack[Math.max(0, Number(itemIndex || 0))] || "").trim()
      : "";
    if (!item) {
      safeNotif("Item is no longer available on that wayfarer.", "warn");
      return;
    }
    if (!addItemToBackpack(item)) {
      safeNotif("Backpack full.", "warn");
      return;
    }
    syncCharacterToCampaign(true);
    safeNotif("Shared from wayfarer sheet: " + item, "good");
  }

  async function syncCharacterToCampaign(force) {
    if (!state.socket || !state.connected || !state.code) return;
    if (!force && Number(state.characterSyncSuppressUntil || 0) > Date.now()) return;
    var summary = collectCharacterSummary();
    var hash = JSON.stringify(summary);
    if (!force && hash === state.lastCharacterHash) return;
    var res = await emitWithAck("campaign:updateCharacter", { character: summary });
    if (res && res.ok) {
      state.lastCharacterHash = hash;
    }
  }

  function generateWayfarerIdea() {
    var first = ["Rhea", "Kade", "Nira", "Sable", "Tarin", "Mira", "Voss", "Ena", "Jax", "Pell"];
    var last = ["Drift", "Blackwire", "Vale", "Meridian", "Ash", "Quill", "Rune", "Dune"];
    var looks = [
      "scarred pilot coat and bright lens visor",
      "salt-cured cloak with brass breathing mask",
      "patched synth-leathers and copper braids",
      "ceramic half-mask with weathered naval tattoos"
    ];
    var drives = [
      "recover a vanished convoy logbook",
      "pay off a family debt to dock syndicates",
      "map safe lanes through cyclone season",
      "hunt raiders who burned their first ship"
    ];
    var name = first[Math.floor(Math.random() * first.length)] + " " + last[Math.floor(Math.random() * last.length)];
    var look = looks[Math.floor(Math.random() * looks.length)];
    var drive = drives[Math.floor(Math.random() * drives.length)];
    state.gmIdea = name + " - " + look + ". Drive: " + drive + ".";
    renderSettingsSection();
  }

  function renderLog(log, limit) {
    if (!Array.isArray(log) || !log.length) {
      return '<div class="campaign-muted">No events yet.</div>';
    }
    return log.slice(-(limit || 8)).reverse().map(function (entry) {
      var kind = escapeHtml(entry.kind || "system");
      var text = escapeHtml(entry.text || "");
      return '<div class="campaign-log-row"><span class="campaign-log-kind">' + kind + '</span><span>' + text + "</span></div>";
    }).join("");
  }

  function renderEconomyLedger(log, limit) {
    if (!Array.isArray(log) || !log.length) {
      return '<div class="campaign-muted">No economy changes yet.</div>';
    }
    return log.slice(-(limit || 12)).reverse().map(function (entry) {
      var resource = String(entry && entry.resource || "value");
      var delta = Number(entry && entry.delta || 0);
      var deltaText = (delta > 0 ? "+" : "") + delta;
      var who = String(entry && entry.name || "Wayfarer");
      var why = String(entry && entry.reason || "sync");
      return '<div class="campaign-log-row">'
        + '<span class="campaign-log-kind">' + escapeHtml(resource) + " " + escapeHtml(deltaText) + '</span>'
        + '<span>' + escapeHtml(who + " · " + why) + '</span>'
        + "</div>";
    }).join("");
  }

  function renderSessionTimeline(log, limit) {
    if (!Array.isArray(log) || !log.length) {
      return '<div class="campaign-muted">No recap entries yet.</div>';
    }
    return log.slice(-(limit || 16)).reverse().map(function (entry) {
      var kind = String(entry && entry.kind || "system");
      var ts = formatTimestamp(entry && entry.at);
      var by = String(entry && entry.by || "GM");
      var text = String(entry && entry.text || "");
      return '<div class="campaign-log-row">'
        + '<span class="campaign-log-kind">' + escapeHtml(kind) + '</span>'
        + '<span>' + escapeHtml(text + ' · ' + by + ' · ' + ts) + '</span>'
        + '</div>';
    }).join("");
  }

  function buildSessionRecapHighlights(sessionTimeline, chronicle, hooks) {
    var lines = [];
    var latestTimeline = Array.isArray(sessionTimeline) && sessionTimeline.length ? sessionTimeline[sessionTimeline.length - 1] : null;
    var latestChronicle = Array.isArray(chronicle) && chronicle.length ? chronicle[0] : null;
    var openHooks = Array.isArray(hooks) ? hooks.filter(function (hook) { return String(hook && hook.status || "open") !== "resolved"; }) : [];
    if (latestChronicle) {
      lines.push("Latest chronicle: " + String(latestChronicle.title || "Campaign Note") + ".");
    }
    if (latestTimeline) {
      lines.push("Latest table event: " + String(latestTimeline.text || "Recent activity") + ".");
    }
    if (openHooks.length) {
      lines.push(openHooks.length + " open hook" + (openHooks.length === 1 ? "" : "s") + " still hanging over the table.");
    } else {
      lines.push("No open hooks are currently tracked.");
    }
    return lines.slice(0, 4);
  }

  function renderCampaignChronicle(log, limit) {
    if (!Array.isArray(log) || !log.length) {
      return '<div class="campaign-muted">No chronicle entries yet.</div>';
    }
    return log.slice(0, limit || 10).map(function (entry) {
      var title = String(entry && entry.title || "Campaign Note");
      var text = String(entry && entry.text || "");
      var by = String(entry && entry.by || "GM");
      var ts = formatTimestamp(entry && entry.at);
      return '<div class="campaign-log-row" style="display:block;">'
        + '<div style="display:flex;justify-content:space-between;gap:.35rem;flex-wrap:wrap;">'
        + '<span class="campaign-log-kind">' + escapeHtml(title) + '</span>'
        + '<span class="campaign-muted">' + escapeHtml(by + " · " + ts) + '</span>'
        + '</div>'
        + '<div class="campaign-muted" style="margin-top:.18rem;color:var(--text2);">' + escapeHtml(text || "No details recorded.") + '</div>'
        + '</div>';
    }).join("");
  }

  function renderCampaignHooks(hooks, canManage) {
    if (!Array.isArray(hooks) || !hooks.length) {
      return '<div class="campaign-muted">No hooks tracked yet.</div>';
    }
    return hooks.slice(0, 16).map(function (hook) {
      var status = String(hook && hook.status || "open");
      var title = String(hook && hook.text || hook && hook.title || "Open hook");
      var source = String(hook && hook.source || "GM Forge");
      var id = String(hook && hook.id || "");
      var actions = "";
      if (canManage && id) {
        actions = status === "resolved"
          ? '<button class="btn btn-xs" onclick="window.campaignSystem.reopenCampaignHook(\'' + escapeHtml(id) + '\')">Reopen</button>'
          : '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.resolveCampaignHook(\'' + escapeHtml(id) + '\')">Resolve</button>';
      }
      return '<div class="campaign-log-row" style="display:flex;justify-content:space-between;align-items:flex-start;gap:.45rem;">'
        + '<div style="min-width:0;">'
        + '<span class="campaign-log-kind">' + escapeHtml(status) + '</span>'
        + '<div class="campaign-muted" style="margin-top:.18rem;color:var(--text2);">' + escapeHtml(title) + '</div>'
        + '<div class="campaign-muted" style="margin-top:.12rem;">' + escapeHtml(source) + '</div>'
        + '</div>'
        + actions
        + '</div>';
    }).join("");
  }

  function buildDockTimelineSource(campaignLog, sessionTimeline) {
    var left = Array.isArray(campaignLog) ? campaignLog.slice() : [];
    var right = Array.isArray(sessionTimeline) ? sessionTimeline.map(function (entry) {
      return {
        id: String(entry && entry.id || ""),
        kind: "recap",
        text: String(entry && entry.text || ""),
        at: Number(entry && entry.at || 0),
        sourceToken: ""
      };
    }) : [];
    return left.concat(right).sort(function (a, b) {
      return Number(a && a.at || 0) - Number(b && b.at || 0);
    });
  }

  function renderDockTimeline(log) {
    if (!Array.isArray(log) || !log.length) {
      return '<div class="campaign-dock-empty">No timeline yet.</div>';
    }
    return log.slice(-40).map(function (entry) {
      var kind = String(entry.kind || "system");
      var text = escapeHtml(entry.text || "");
      var ts = formatTimestamp(entry.at);
      var rowClass = "campaign-dock-line";
      if (kind === "chat") rowClass += " chat";
      if (kind === "roll" || kind === "roll-result") rowClass += " roll";
      return ''
        + '<div class="' + rowClass + '">'
        + '<span class="campaign-dock-kind">' + escapeHtml(kind) + '</span>'
        + '<span class="campaign-dock-text">' + text + '</span>'
        + '<span class="campaign-dock-time">' + escapeHtml(ts) + '</span>'
        + "</div>";
    }).join("");
  }

  function getTimelineEntryKey(entry) {
    var e = entry && typeof entry === "object" ? entry : {};
    var id = String(e.id || "").trim();
    if (id) return id;
    return String(e.kind || "system") + "|" + Number(e.at || 0) + "|" + String(e.text || "");
  }

  function filterTimeline(log) {
    var source = Array.isArray(log) ? log : [];
    var hidden = Array.isArray(state.hiddenTimelineKeys) ? state.hiddenTimelineKeys : [];
    if (hidden.length) {
      source = source.filter(function (entry) {
        return hidden.indexOf(getTimelineEntryKey(entry)) === -1;
      });
    }
    function isTriggerDebug(entry) {
      var text = String(entry && entry.text || "");
      return text.indexOf("GM Trigger Debug") >= 0 || text.indexOf("Trigger:") >= 0 || text.indexOf("hex-enter") >= 0;
    }
    if (state.role !== "gm") return source;
    var mode = String(state.timelineFilter || "all");
    if (mode === "all") return source.filter(function (entry) { return !isTriggerDebug(entry); });
    if (mode === "chat") {
      return source.filter(function (entry) { return String(entry && entry.kind || "") === "chat"; });
    }
    if (mode === "roll") {
      return source.filter(function (entry) {
        var k = String(entry && entry.kind || "");
        return k === "roll" || k === "roll-result";
      });
    }
    if (mode === "system") {
      return source.filter(function (entry) {
        var k = String(entry && entry.kind || "");
        return (k === "system" || k === "tmw" || k === "note") && !isTriggerDebug(entry);
      });
    }
    if (mode === "recap") {
      return source.filter(function (entry) {
        return String(entry && entry.kind || "") === "recap";
      });
    }
    return source.filter(function (entry) { return !isTriggerDebug(entry); });
  }

  function ensureSettingsSection() {
    var panel = document.getElementById("settingsPanel");
    if (!panel) return;
    var popup = panel.querySelector(".settings-popup");
    if (!popup) return;

    var existing = document.getElementById("campaignSettingsSection");
    if (!existing) {
      var section = document.createElement("div");
      section.id = "campaignSettingsSection";
      section.className = "settings-section";
      section.setAttribute("data-settings-tab", "campaign");
      var footer = popup.querySelector(".settings-footer");
      if (footer) popup.insertBefore(section, footer);
      else popup.appendChild(section);
      renderSettingsSection();
      return;
    }
  }

  function captureDraftInputs() {
    var nameEl = document.getElementById("campaignNameInput");
    var codeEl = document.getElementById("campaignCodeInput");
    var passEl = document.getElementById("campaignPasswordInput");
    if (nameEl) state.uiDraft.name = String(nameEl.value || "");
    if (codeEl) state.uiDraft.code = String(codeEl.value || "");
    if (passEl) state.uiDraft.joinPassword = String(passEl.value || "");
    captureCampaignSoundtrackDraftInputs();
  }

  function bindDraftInputs() {
    ["campaignNameInput", "campaignCodeInput", "campaignPasswordInput"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.campaignDraftBound === "1") return;
      el.dataset.campaignDraftBound = "1";
      el.addEventListener("input", function () {
        if (id === "campaignNameInput") state.uiDraft.name = String(el.value || "");
        if (id === "campaignCodeInput") state.uiDraft.code = String(el.value || "");
        if (id === "campaignPasswordInput") state.uiDraft.joinPassword = String(el.value || "");
      });
    });
    bindCampaignSoundtrackInputs();
  }

  async function ensureCampaignConnectionReady() {
    if (!ensureSocket()) {
      safeNotif("Multiplayer requires running the local campaign server.", "warn");
      return false;
    }
    if (state.connected) return true;
    try {
      if (state.socket && typeof state.socket.connect === "function") {
        state.socket.connect();
      }
    } catch (_err) {}
    var connected = await waitForSocketConnection(3200);
    if (!connected) {
      safeNotif("Could not reach the campaign server. Try again in a moment.", "warn");
      renderSettingsSection();
      renderDockPanel();
      return false;
    }
    return true;
  }

  function buildCampaignRecoveryCardHtml() {
    var summary = getSavedCampaignSessionSummary();
    if (!summary.hasSaved) {
      return ''
        + '<div class="campaign-card">'
        + '<div class="campaign-card-title">Campaign Resume</div>'
        + '<div class="campaign-muted">No saved campaign seat yet. Once you join a room, this browser will remember the code, role, and seat so you can resume or rejoin without rebuilding the table state by hand.</div>'
        + '<div class="campaign-actions" style="margin-top:.35rem;">'
        + '<button class="btn btn-xs" onclick="window.campaignSystem.openCampaignRecoveryCenter()">How Resume Works</button>'
        + '</div>'
        + '</div>';
    }

    var session = summary.session;
    var sceneLabel = String(session.lastSceneLabel || "Campaign");
    var savedAtText = summary.savedAtText || "-";
    var lastActiveText = summary.lastActiveText || "-";
    var primaryLabel = summary.activeMatch
      ? "Reconnect This Seat"
      : (summary.canResume ? ("Resume " + summary.roleLabel + " Seat") : "Rejoin This Room");
    var primaryAction = summary.activeMatch
      ? 'window.campaignSystem.reconnectNow()'
      : (summary.canResume
        ? 'window.campaignSystem.resumeSavedCampaignSession()'
        : 'window.campaignSystem.rejoinSavedCampaignSession()');

    return ''
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Campaign Resume</div>'
      + '<div class="campaign-status-row">'
      + '<span class="campaign-badge ' + escapeHtml(summary.badgeTone) + '">' + escapeHtml(summary.statusLabel) + '</span>'
      + '<span class="campaign-muted">Room <strong style="color:var(--teal);">' + escapeHtml(session.code) + '</strong></span>'
      + '<span class="campaign-muted">' + escapeHtml(summary.roleLabel) + ' · ' + escapeHtml(session.name) + '</span>'
      + '</div>'
      + '<div class="campaign-muted" style="margin-top:.24rem;">' + escapeHtml(summary.detail) + '</div>'
      + '<div class="campaign-muted" style="margin-top:.22rem;">Last saved: <strong style="color:var(--text2);">' + escapeHtml(savedAtText) + '</strong> · Scene <strong style="color:var(--gold2);">' + escapeHtml(sceneLabel) + '</strong></div>'
      + '<div class="campaign-muted" style="margin-top:.22rem;">Last table activity: <strong style="color:var(--text2);">' + escapeHtml(lastActiveText) + '</strong></div>'
      + '<div class="campaign-actions" style="margin-top:.35rem;">'
      + '<button class="btn btn-xs btn-teal" onclick="' + primaryAction + '">' + escapeHtml(primaryLabel) + '</button>'
      + (!summary.activeMatch ? '<button class="btn btn-xs" onclick="window.campaignSystem.rejoinSavedCampaignSession()">Rejoin Fresh</button>' : '')
      + '<button class="btn btn-xs" onclick="window.campaignSystem.openCampaignRecoveryCenter()">Details</button>'
      + '<button class="btn btn-xs btn-red" onclick="window.campaignSystem.forgetSavedCampaignSession()">Forget Saved Seat</button>'
      + '</div>'
      + '</div>';
  }

  function openCampaignRecoveryCenter() {
    var summary = getSavedCampaignSessionSummary();
    if (typeof window.openModal !== "function") {
      if (window.settingsSystem && typeof window.settingsSystem.openSettings === "function") {
        window.settingsSystem.openSettings();
        if (typeof window.settingsSystem.setActiveTab === "function") {
          window.settingsSystem.setActiveTab("campaign");
        }
      }
      safeNotif(summary.hasSaved ? "Campaign resume details are in Settings > Campaign." : "Join a campaign to enable resume/rejoin tools.", "info");
      return;
    }

    var html = '';
    if (!summary.hasSaved) {
      html = ''
        + '<div style="display:flex;flex-direction:column;gap:.55rem;">'
        + '<div style="font-size:.84rem;color:var(--muted2);line-height:1.55;">Campaign resume stores your room code, role, and seat in this browser after you join a table. When you come back, you can resume the same seat or rejoin the room fresh without rebuilding the campaign by hand.</div>'
        + '<div style="display:flex;justify-content:flex-end;gap:.35rem;margin-top:.2rem;">'
        + '<button class="btn btn-sm" onclick="closeModal()">Close</button>'
        + '</div>'
        + '</div>';
      window.openModal("Campaign Resume", html);
      return;
    }

    var session = summary.session;
    html = ''
      + '<div style="display:flex;flex-direction:column;gap:.65rem;">'
      + '<div style="padding:.65rem;border:1px solid rgba(60,150,150,.32);border-radius:.55rem;background:rgba(10,22,24,.42);display:flex;flex-direction:column;gap:.28rem;">'
      + '<div style="display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;">'
      + '<span class="campaign-badge ' + escapeHtml(summary.badgeTone) + '">' + escapeHtml(summary.statusLabel) + '</span>'
      + '<span style="font-size:.8rem;color:var(--muted2);">Room <strong style="color:var(--teal);">' + escapeHtml(session.code) + '</strong></span>'
      + '<span style="font-size:.8rem;color:var(--muted2);">' + escapeHtml(summary.roleLabel) + ' · ' + escapeHtml(session.name) + '</span>'
      + '</div>'
      + '<div style="font-size:.82rem;color:var(--muted2);line-height:1.5;">' + escapeHtml(summary.detail) + '</div>'
      + '<div style="font-size:.78rem;color:var(--muted2);">Last saved: <strong style="color:var(--text2);">' + escapeHtml(summary.savedAtText || "-") + '</strong></div>'
      + '<div style="font-size:.78rem;color:var(--muted2);">Last scene: <strong style="color:var(--gold2);">' + escapeHtml(String(session.lastSceneLabel || "Campaign")) + '</strong></div>'
      + '<div style="font-size:.78rem;color:var(--muted2);">Last table activity: <strong style="color:var(--text2);">' + escapeHtml(summary.lastActiveText || "-") + '</strong></div>'
      + '</div>'
      + '<div style="font-size:.8rem;color:var(--muted2);line-height:1.55;">'
      + (summary.canResume
        ? 'Resume Saved Seat reconnects to the same saved GM or player seat. Rejoin Fresh uses the same room code and name, but asks the server for a new seat instead.'
        : 'This saved room no longer has a reusable seat token, so rejoin creates a fresh seat in the same room code.')
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:.35rem;flex-wrap:wrap;">'
      + (summary.canResume
        ? '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.resumeSavedCampaignSessionFromModal()">Resume Saved Seat</button>'
        : '')
      + '<button class="btn btn-sm" onclick="window.campaignSystem.rejoinSavedCampaignSessionFromModal()">Rejoin Fresh</button>'
      + '<button class="btn btn-sm btn-red" onclick="window.campaignSystem.forgetSavedCampaignSessionFromModal()">Forget Saved Seat</button>'
      + '<button class="btn btn-sm" onclick="closeModal()">Close</button>'
      + '</div>'
      + '</div>';
    window.openModal("Campaign Resume", html);
  }

  async function resumeSavedCampaignSession(options) {
    var opts = options && typeof options === "object" ? options : {};
    var summary = getSavedCampaignSessionSummary();
    var session = summary.session;
    if (!session || !session.code) {
      safeNotif("No saved campaign session to resume.", "warn");
      return { ok: false, error: "No saved campaign session." };
    }

    state.playerName = String(session.name || state.playerName || ensureName());
    state.uiDraft.name = state.playerName;
    state.uiDraft.code = session.code;
    state.uiDraft.joinPassword = "";
    renderSettingsSection();

    var connected = await ensureCampaignConnectionReady();
    if (!connected) {
      return { ok: false, error: "Could not connect to server." };
    }

    var joinResult = await joinCampaign(session.role, {
      code: session.code,
      name: session.name,
      token: opts.fresh ? "" : String(session.token || ""),
      fresh: !!opts.fresh,
      silent: !!opts.silent
    });

    if (!joinResult || !joinResult.ok) {
      if (!opts.fresh) {
        markSessionRestoreFailure(session, (joinResult && joinResult.error) || "Saved campaign session could not be restored.");
        renderSettingsSection();
        renderDockPanel();
      }
      return joinResult || { ok: false, error: "Could not resume session." };
    }

    return joinResult;
  }

  async function rejoinSavedCampaignSession() {
    return resumeSavedCampaignSession({ fresh: true });
  }

  async function resumeSavedCampaignSessionFromModal() {
    var res = await resumeSavedCampaignSession();
    if (res && res.ok && typeof window.closeModal === "function") {
      window.closeModal();
    }
    return res;
  }

  async function rejoinSavedCampaignSessionFromModal() {
    var res = await rejoinSavedCampaignSession();
    if (res && res.ok && typeof window.closeModal === "function") {
      window.closeModal();
    }
    return res;
  }

  function forgetSavedCampaignSession() {
    clearSession();
    state.sessionPersistenceSuppressed = !!(state.code && state.role);
    renderSettingsSection();
    renderDockPanel();
    safeNotif(
      state.sessionPersistenceSuppressed
        ? "Forgot this campaign seat for this browser. It will stay unsaved until you join again."
        : "Forgot saved campaign seat for this browser.",
      "good"
    );
  }

  function forgetSavedCampaignSessionFromModal() {
    forgetSavedCampaignSession();
    if (typeof window.closeModal === "function") {
      window.closeModal();
    }
  }

  function renderSettingsSection(options) {
    var section = document.getElementById("campaignSettingsSection");
    if (!section) {
      ensureSettingsSection();
      section = document.getElementById("campaignSettingsSection");
    }
    if (!section) return;

    captureDraftInputs();
    var opts = options && typeof options === "object" ? options : {};
    if (!opts.bypassSoundtrackDeferral && isCampaignSoundtrackEditorBusy()) {
      scheduleDeferredSettingsRender();
      return;
    }
    state.pendingSettingsRender = false;
    if (state.settingsRenderTimer) {
      clearTimeout(state.settingsRenderTimer);
      state.settingsRenderTimer = null;
    }

    var ioReady = canUseSockets();
    var campaign = state.campaign;
    var sharedState = getCampaignSharedState();
    var sharedTmw = campaign && campaign.shared ? Number(campaign.shared.tmw || 0) : getTmwValue();
    var sharedCredits = Math.max(0, Number(sharedState.credits != null ? sharedState.credits : ((window.S && window.S.credits) || 0)));
    var sharedRenown = Math.max(0, Number(sharedState.renown != null ? sharedState.renown : ((window.S && window.S.renown) || 0)));
    var economyLedger = Array.isArray(sharedState.economyLedger) ? sharedState.economyLedger : [];
    var syncLabel = state.syncText || (state.syncHealth === "syncing"
      ? "Syncing"
      : (state.syncHealth === "stale" ? "Pending" : (state.syncHealth === "online" ? "Synced" : "Offline")));
    var syncConflictText = state.syncConflictCount > 0 ? ("Conflicts " + state.syncConflictCount) : "";
    var tableState = getCampaignTableState(sharedState);
    var tableBadgeTone = getTableBadgeTone(tableState);
    var recoveryOnly = !!(tableState && tableState.recoveryOnly);
    var riskyDisabledAttr = recoveryOnly
      ? ' disabled title="Sync recovery in progress. Use recovery actions first."'
      : '';
    var authoritativeStamp = formatTimestamp(state.lastAuthoritativeAt) || formatTimestamp(state.lastSyncAt) || "-";
    var snapshotAgeText = state.lastCampaignStateAt ? (getLastSnapshotAgeSeconds() + "s ago") : "-";
    var gmResyncRequester = state.lastResyncRequester ? String(state.lastResyncRequester) : "-";
    var gmResyncRequestAt = formatTimestamp(state.lastResyncRequestAt) || "-";
    var gmAutoRebroadcastAt = formatTimestamp(state.lastAutoRebroadcastAt) || "-";
    var gmAutoRebroadcastStatus = state.lastAutoRebroadcastOk === null
      ? "No auto-rebroadcast yet"
      : (state.lastAutoRebroadcastOk ? "Success" : "Failed");
    var gmAutoRebroadcastDetail = state.lastAutoRebroadcastOk === false && state.lastAutoRebroadcastError
      ? (" · " + String(state.lastAutoRebroadcastError))
      : "";
    var partyStash = Array.isArray(sharedState.partyStash) ? sharedState.partyStash : [];
    var campaignTravel = sharedState && sharedState.campaignTravel && typeof sharedState.campaignTravel === "object"
      ? sharedState.campaignTravel
      : ensureCampaignTravelState(sharedState);
    var gmSettings = ensureGmSettings(sharedState);
    var soundtrackSettings = normalizeCampaignSoundtrackSettings(gmSettings.soundtrack);
    var soundtrackEditor = getCampaignSoundtrackEditorState(soundtrackSettings);
    var soundtrackSummary = getCampaignSoundtrackSummary(soundtrackSettings);
    var soundtrackCatalog = getCampaignSoundtrackCatalog();
    var soundtrackSuites = Array.isArray(soundtrackCatalog.suites) ? soundtrackCatalog.suites : [];
    var soundtrackAmbiences = Array.isArray(soundtrackCatalog.ambiences) ? soundtrackCatalog.ambiences : [];
    var soundtrackPresets = [{ id: "custom", label: "Custom" }].concat(getCampaignSoundtrackPresets().map(function (preset) {
      return { id: preset.id, label: preset.label };
    }));
    var soundtrackMoodOptionsHtml = renderCampaignSelectOptions(soundtrackPresets, soundtrackEditor.mood, "");
    var soundtrackSuiteOptionsHtml = renderCampaignSelectOptions(soundtrackSuites, soundtrackEditor.suiteId, "Choose Playlist");
    var soundtrackStyleOptionsHtml = buildCampaignSoundtrackStyleOptions(soundtrackEditor.suiteId, soundtrackEditor.styleName);
    var soundtrackPrimaryAmbience = String(soundtrackEditor.ambienceA || "");
    var soundtrackSecondaryAmbience = String(soundtrackEditor.ambienceB || "");
    var soundtrackAmbienceOptionsHtml = renderCampaignSelectOptions(soundtrackAmbiences, soundtrackPrimaryAmbience, "No Ambience");
    var soundtrackAmbienceOptionsHtmlSecondary = renderCampaignSelectOptions(soundtrackAmbiences, soundtrackSecondaryAmbience, "No Ambience");
    var strictCameraLock = !!(gmSettings && gmSettings.cameraLock);
    var isGm = state.role === "gm";
    var sessionTimeline = Array.isArray(sharedState.sessionTimeline)
      ? sharedState.sessionTimeline
      : ensureSessionTimelineState(sharedState);
    var campaignChronicle = Array.isArray(sharedState.campaignChronicle)
      ? sharedState.campaignChronicle
      : ensureCampaignChronicleState(sharedState);
    var unresolvedHooks = Array.isArray(sharedState.unresolvedHooks)
      ? sharedState.unresolvedHooks
      : ensureCampaignHooksState(sharedState);
    var gmForge = sharedState && sharedState.gmForge && typeof sharedState.gmForge === "object"
      ? sharedState.gmForge
      : ensureGmForgeState(sharedState);
    var recapHighlights = buildSessionRecapHighlights(sessionTimeline, campaignChronicle, unresolvedHooks);
    var openHookCount = unresolvedHooks.filter(function (hook) {
      return String(hook && hook.status || "open") !== "resolved";
    }).length;
    var readyCheck = sharedState && sharedState.readyCheck && typeof sharedState.readyCheck === "object"
      ? sharedState.readyCheck
      : ensureReadyCheckState(sharedState);
    var travelStatusText = escapeHtml(String(campaignTravel.label || "Province Map"))
      + ' · ' + escapeHtml(String(campaignTravel.movedBy || "-"))
      + ' · ' + escapeHtml(formatTimestamp(campaignTravel.updatedAt) || "-");
    var tableStateLine = 'Table state: <strong style="color:var(--gold2);">' + escapeHtml(String(tableState && tableState.label || "Exploration")) + '</strong>';
    if (recoveryOnly) {
      tableStateLine += ' · Risky actions locked until sync recovers.';
    }
    var readyRequiredCount = Array.isArray(readyCheck.requiredTokens) ? readyCheck.requiredTokens.length : 0;
    var readyResponseCount = getReadyCheckResponseCount(readyCheck);
    var readyStatusText = String(readyCheck.status || "idle");
    var combatReadyPending = !!(readyCheck && readyCheck.id
      && readyStatusText === "pending"
      && String(readyCheck.type || "") === "combat-start");
    var combatReadyHintHtml = combatReadyPending
      ? ('<span class="campaign-muted" style="font-size:.74rem;align-self:center;">Ready check pending... ' + readyResponseCount + '/' + readyRequiredCount + '</span>')
      : '';
    var canRespondReady = !!(state.token && readyCheck && readyCheck.responses && !readyCheck.responses[state.token]);
    var readyCheckCardHtml = '';
    if (readyCheck && readyCheck.id && readyStatusText !== "idle") {
      readyCheckCardHtml = ''
        + '<div class="campaign-card">'
        + '<div class="campaign-card-title">Ready Check</div>'
        + '<div class="campaign-muted"><strong>' + escapeHtml(String(readyCheck.label || "Shared action")) + '</strong></div>'
        + '<div class="campaign-muted" style="margin-top:.25rem;">Status: ' + escapeHtml(readyStatusText) + ' · Responses ' + readyResponseCount + '/' + readyRequiredCount + '</div>'
        + (readyStatusText === "pending" && canRespondReady
          ? '<div class="campaign-actions" style="margin-top:.35rem;"><button class="btn btn-xs btn-teal" onclick="window.campaignSystem.respondReadyCheck(true)">Ready</button><button class="btn btn-xs btn-warn" onclick="window.campaignSystem.respondReadyCheck(false)">Not Ready</button></div>'
          : '')
        + (readyStatusText === "pending" && isGm
          ? '<div class="campaign-actions" style="margin-top:.35rem;"><button class="btn btn-xs btn-teal" onclick="window.campaignSystem.forceApproveReadyCheck()">Force Approve</button><button class="btn btn-xs" onclick="window.campaignSystem.cancelReadyCheck()">Cancel</button></div>'
          : '')
        + '</div>';
    }
    var localBackpackSlots = Array.isArray(window.S && window.S.backpack)
      ? window.S.backpack.map(function (item, idx) {
          return { item: String(item || "").trim(), idx: idx };
        }).filter(function (entry) { return !!entry.item; })
      : [];
    var active = campaign && campaign.activeRollRequest;
    var privateNote = campaign && campaign.me ? String(campaign.me.privateNote || "") : "";
    var nameValue = state.uiDraft.name || state.playerName || ensureName();
    var codeValue = state.uiDraft.code || state.code || "";
    var joinPasswordValue = state.uiDraft.joinPassword || "";
    var recoveryCardHtml = buildCampaignRecoveryCardHtml();
    var noteSummaries = campaign && Array.isArray(campaign.notesSummary) ? campaign.notesSummary : [];
    var roster = campaign && Array.isArray(campaign.roster) ? campaign.roster : [];
    var quickStartRole = isGm ? "GM" : (state.role === "player" ? "Player" : "Unassigned");
    var quickStartItems = [];
    if (!state.code) {
      quickStartItems = [
        "Enter your display name so reconnect and notes are easy to track.",
        "Create (GM) to host a new room, or use Join Player/Join GM with a shared code.",
        "After joining, use Show Onboarding for map generation and sync workflow."
      ];
    } else if (isGm) {
      quickStartItems = [
        "Confirm everyone appears in Online Members before starting scene play.",
        "Generate at least one map layer, then Broadcast Authoritative State if players drift.",
        "Use GM Roll Call and Campaign dock to keep pacing and response visibility tight."
      ];
    } else {
      quickStartItems = [
        "Watch Campaign dock for active roll calls, timeline updates, and chat.",
        "Use Sync Shared World or Request Resync if your state looks stale.",
        "Keep Private Notes updated so your goals stay visible between sessions."
      ];
    }
    var quickStartHtml = '<div class="campaign-card">'
      + '<div class="campaign-card-title">Session Quickstart</div>'
      + '<div class="campaign-muted">Role: <strong style="color:var(--gold2);">' + escapeHtml(quickStartRole) + '</strong></div>'
      + '<ol class="campaign-quickstart-list">' + quickStartItems.map(function (item) {
          return '<li>' + escapeHtml(item) + '</li>';
        }).join('') + '</ol>'
      + '<div class="campaign-actions" style="margin-top:.35rem;">'
      + (!isGm && state.code ? '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.openDock()">Open Live Dock</button>' : '')
      + '<button class="btn btn-xs" onclick="window.campaignSystem.showOnboarding(true)">Open Onboarding</button>'
      + (state.code ? '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.syncSharedNow()">Sync Check</button>' : '')
      + '</div>'
      + '</div>';
    var playerLiveTableHtml = (!isGm && state.code)
      ? ('<div class="campaign-card campaign-player-live-card">'
        + '<div class="campaign-card-title">Live Table</div>'
        + '<div class="campaign-muted">Keep rolls, chat, ready checks, and the live timeline open like a real table session while sync tools stay one tap away.</div>'
        + '<div class="campaign-actions" style="margin-top:.35rem;">'
        + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.openDock()">Open Roll / Chat Dock</button>'
        + '<button class="btn btn-xs" onclick="window.campaignSystem.syncSharedNow()">Sync Shared World</button>'
        + '<button class="btn btn-xs" onclick="window.campaignSystem.requestResync()">Request Resync</button>'
        + '</div>'
        + '</div>')
      : '';
    var summaryHtml = isGm && noteSummaries.length
      ? ('<div class="campaign-muted" style="margin-top:.35rem;">' + noteSummaries.map(function (n) {
          var stamp = n.updatedAt ? (" @ " + formatTimestamp(n.updatedAt)) : "";
          return escapeHtml(n.name + (n.hasNote ? stamp : " (no note)"));
        }).join(" · ") + '</div>')
      : '';
    var playerCameraLockBannerHtml = (!isGm && strictCameraLock)
      ? ('<div class="campaign-card" style="border-color:rgba(232,192,80,.45);background:rgba(232,192,80,.08);">'
        + '<div class="campaign-card-title">GM Camera Lock Active</div>'
        + '<div class="campaign-muted">Your map tabs auto-follow the GM for a unified table view.</div>'
        + '<div class="campaign-muted" style="margin-top:.22rem;">You can still open <strong style="color:var(--gold2);">Character</strong> or <strong style="color:var(--gold2);">Merchant</strong> any time for personal sheet and shopping actions.</div>'
        + '</div>')
      : '';
    var playerLiteEnabled = isPlayerLiteModeEnabled();
    var playerLiteCardHtml = state.code
      ? ('<div class="campaign-card">'
        + '<div class="campaign-card-title">Mobile / Player-Lite</div>'
        + '<div class="campaign-muted">Player-lite keeps the table readable on phones and touch laptops by collapsing dense campaign cards and making action rows easier to tap.</div>'
        + '<div class="campaign-actions" style="margin-top:.35rem;">'
        + '<button class="btn btn-xs ' + (playerLiteEnabled ? 'btn-teal' : '') + '" onclick="window.campaignSystem.setPlayerLiteMode(' + (!playerLiteEnabled) + ')">' + (playerLiteEnabled ? 'Player-Lite ON' : 'Player-Lite OFF') + '</button>'
        + '<button class="btn btn-xs" onclick="window.settingsSystem.togglePhoneLayoutMode()">Toggle Phone Layout</button>'
        + '</div>'
        + '<div class="campaign-muted" style="margin-top:.22rem;">Phone layout restructures the whole app. Player-lite only changes the campaign surfaces.</div>'
        + '</div>')
      : '';
    var forgeSummaryCardHtml = isGm && state.code
      ? ('<div class="campaign-card">'
        + '<div class="campaign-card-title">GM Forge Library</div>'
        + '<div class="campaign-muted">Saved presets in this campaign: <strong style="color:var(--gold2);">' + String(Array.isArray(gmForge.savedPresets) ? gmForge.savedPresets.length : 0) + '</strong></div>'
        + '<div class="campaign-muted" style="margin-top:.2rem;">Last preset: <strong style="color:var(--text2);">' + escapeHtml(String(gmForge.lastPresetId || "None")) + '</strong></div>'
        + '<div class="campaign-muted" style="margin-top:.2rem;">Open the GM Dashboard to load packs, save reusable setups, and seed missions fast.</div>'
        + '</div>')
      : '';
    var diagnosticsCardHtml = state.code
      ? ('<div class="campaign-card">'
        + '<div class="campaign-card-title">Bug Report & Diagnostics</div>'
        + '<div class="campaign-muted">Capture a diagnostics bundle with sync state, roster, combat context, and ' + (isGm ? 'an authoritative snapshot.' : 'your local seat context.') + '</div>'
        + '<div class="campaign-actions" style="margin-top:.35rem;">'
        + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.exportDiagnosticsBundle()">Export Diagnostics</button>'
        + '<button class="btn btn-xs" onclick="window.campaignSystem.copyDiagnosticsSummary()">Copy Summary</button>'
        + '</div>'
        + '</div>')
      : '';

    section.innerHTML = ""
      + '<h4>Campaign (Multiplayer)</h4>'
      + '<div class="campaign-status-row">'
      + '<span class="campaign-badge ' + (state.connected ? "online" : "offline") + '">' + (state.connected ? "Online" : (ioReady ? "Offline" : "Server Script Missing")) + "</span>"
      + '<span class="campaign-badge ' + escapeHtml(state.syncHealth || "idle") + '">' + escapeHtml(syncLabel) + '</span>'
      + '<span class="campaign-badge ' + escapeHtml(tableBadgeTone) + '">' + escapeHtml(String(tableState && tableState.label || "Exploration")) + '</span>'
      + (syncConflictText ? ('<span class="campaign-muted">' + escapeHtml(syncConflictText) + '</span>') : '')
      + '<span class="campaign-muted">Code: <strong style="color:var(--teal);">' + escapeHtml(state.code || "-") + "</strong></span>"
      + "</div>"
      + '<div class="setting-row">'
      + '<label>Display Name</label>'
      + '<input id="campaignNameInput" class="campaign-input" type="text" maxlength="32" value="' + escapeHtml(nameValue) + '" placeholder="Wayfarer Name">'
      + "</div>"
      + '<div class="setting-row">'
      + '<label>Campaign Code</label>'
      + '<input id="campaignCodeInput" class="campaign-input" type="text" maxlength="12" placeholder="ABC123" value="' + escapeHtml(codeValue) + '">' 
      + "</div>"
      + '<div class="setting-row">'
      + '<label>Join Password (Optional)</label>'
      + '<input id="campaignPasswordInput" class="campaign-input" type="password" maxlength="120" placeholder="Campaign password if set" value="' + escapeHtml(joinPasswordValue) + '">'
      + "</div>"
      + '<div class="campaign-actions">'
      + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.createCampaign()">Create (GM)</button>'
      + '<button class="btn btn-xs" onclick="window.campaignSystem.joinCampaign(\'player\')">Join Player</button>'
      + '<button class="btn btn-xs" onclick="window.campaignSystem.joinCampaign(\'gm\')">Join GM</button>'
      + '<button class="btn btn-xs btn-red" onclick="window.campaignSystem.leaveCampaign()">Leave</button>'
      + "</div>"
      + recoveryCardHtml
      + playerCameraLockBannerHtml
      + quickStartHtml
      + playerLiveTableHtml
      + playerLiteCardHtml
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Shared Teamwork Points</div>'
      + '<div class="campaign-tmw">' + sharedTmw + "</div>"
      + '<div class="campaign-muted" style="margin-top:.2rem;">Coin <strong style="color:var(--gold2);">' + sharedCredits + '₵</strong> · Renown <strong style="color:var(--teal);">' + sharedRenown + '</strong></div>'
      + '<div class="campaign-muted" style="margin-top:.2rem;">Last authoritative sync: <strong style="color:var(--text2);">' + escapeHtml(authoritativeStamp) + '</strong></div>'
      + '<div class="campaign-muted" style="margin-top:.2rem;">Last snapshot: <strong style="color:var(--text2);">' + escapeHtml(snapshotAgeText) + '</strong></div>'
      + '<div class="campaign-muted" style="margin-top:.2rem;">' + tableStateLine + '</div>'
      + '<div class="campaign-actions" style="margin-top:.35rem;">'
      + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.syncSharedNow()">Sync Shared World</button>'
      + (isGm ? '' : '<button class="btn btn-xs" onclick="window.campaignSystem.requestResync()">Request Resync</button>')
      + '<button class="btn btn-xs" onclick="window.campaignSystem.reconnectNow()">Reconnect</button>'
      + '<button class="btn btn-xs btn-warn" onclick="window.campaignSystem.recoverSyncNow()">Fix Desync</button>'
      + '<button class="btn btn-xs" onclick="window.campaignSystem.showOnboarding(true)">Show Onboarding</button>'
      + '</div>'
      + '<div class="campaign-muted">'
      + 'Persistent state enabled'
      + (campaign && campaign.archived ? ' · <strong style="color:var(--gold2);">Archived</strong>' : '')
      + (campaign && campaign.hasPassword ? ' · Password Protected' : '')
      + '</div>'
      + "</div>"
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Table Soundtrack</div>'
      + '<div class="campaign-muted"><strong>' + escapeHtml(soundtrackSettings.enabled ? ('Mood: ' + soundtrackSummary.moodLabel) : 'No GM soundtrack override active') + '</strong></div>'
      + '<div class="campaign-muted" style="margin-top:.22rem;">Playlist: <strong style="color:var(--gold2);">' + escapeHtml(soundtrackSummary.suiteLabel) + '</strong> · ' + escapeHtml(soundtrackSummary.styleLabel) + '</div>'
      + '<div class="campaign-muted" style="margin-top:.22rem;">Ambience: <strong style="color:var(--teal);">' + escapeHtml(soundtrackSummary.ambienceLabel) + '</strong></div>'
      + '<div class="campaign-muted" style="margin-top:.22rem;">Applies to everyone in the campaign who has music enabled in Settings.</div>'
      + (isGm
        ? ('<div style="display:flex;flex-direction:column;gap:.35rem;margin-top:.45rem;">'
          + '<div class="campaign-roll-grid">'
          + '<select id="campaignMusicMood" class="campaign-input" onchange="window.campaignSystem.syncCampaignSoundtrackMoodToEditor()">' + soundtrackMoodOptionsHtml + '</select>'
          + '<select id="campaignMusicSuite" class="campaign-input" onchange="window.campaignSystem.refreshCampaignSoundtrackStyleOptions()">' + soundtrackSuiteOptionsHtml + '</select>'
          + '<select id="campaignMusicStyle" class="campaign-input">' + soundtrackStyleOptionsHtml + '</select>'
          + '</div>'
          + '<div class="campaign-roll-grid">'
          + '<select id="campaignMusicAmbienceA" class="campaign-input">' + soundtrackAmbienceOptionsHtml + '</select>'
          + '<select id="campaignMusicAmbienceB" class="campaign-input">' + soundtrackAmbienceOptionsHtmlSecondary + '</select>'
          + '</div>'
          + '<div class="campaign-actions" style="margin-top:.1rem;">'
          + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.applyCampaignSoundtrackMoodFromUi()"' + riskyDisabledAttr + '>Use Mood Preset</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.applyCampaignSoundtrackMixFromUi()"' + riskyDisabledAttr + '>Play Custom Mix</button>'
          + '<button class="btn btn-xs btn-red" onclick="window.campaignSystem.clearCampaignSoundtrack()"' + riskyDisabledAttr + '>Clear Table Music</button>'
          + '</div>'
          + '<div class="campaign-muted" style="font-size:.78rem;">Pick a mood for fast scene swaps, or build a custom mix with any playlist and ambience combo.</div>'
          + '</div>')
        : '')
      + "</div>"
      + (isGm
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">GM Roll Call</div>'
          + '<div class="campaign-roll-grid">'
          + '<input id="campaignRollLabel" class="campaign-input" type="text" maxlength="80" placeholder="Dread Check" value="Dread Check">'
          + '<input id="campaignRollStat" class="campaign-input" type="text" maxlength="32" placeholder="valor" value="valor">'
          + '<input id="campaignRollDread" class="campaign-input" type="number" min="1" max="20" value="8">'
          + "</div>"
          + '<div class="campaign-actions" style="margin-top:.35rem;">'
          + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.callRollRequest()"' + riskyDisabledAttr + '>Call Roll</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.closeActiveRoll()"' + riskyDisabledAttr + '>Close Active</button>'
          + "</div>"
          + (active ? ('<div class="campaign-muted" style="margin-top:.35rem;">Active: ' + escapeHtml(active.label) + ' · ' + escapeHtml(active.stat) + ' vs d' + Number(active.dread || 8) + '</div>') : '<div class="campaign-muted" style="margin-top:.35rem;">No active roll request.</div>')
          + "</div>")
        : "")
      + (isGm
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">GM Campaign Debug</div>'
          + '<div class="campaign-muted">Last authoritative push: <strong style="color:var(--text2);">' + escapeHtml(authoritativeStamp) + '</strong></div>'
          + '<div class="campaign-muted" style="margin-top:.2rem;">Last player resync request: <strong style="color:var(--text2);">' + escapeHtml(gmResyncRequester) + '</strong> @ <strong style="color:var(--text2);">' + escapeHtml(gmResyncRequestAt) + '</strong></div>'
          + '<div class="campaign-muted" style="margin-top:.2rem;">Auto-rebroadcast: <strong style="color:' + (state.lastAutoRebroadcastOk === false ? 'var(--red2)' : 'var(--teal)') + ';">' + escapeHtml(gmAutoRebroadcastStatus) + '</strong> @ <strong style="color:var(--text2);">' + escapeHtml(gmAutoRebroadcastAt) + '</strong>' + escapeHtml(gmAutoRebroadcastDetail) + '</div>'
          + '</div>'
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">GM Campaign Controls</div>'
          + '<div class="campaign-roll-grid">'
          + '<input id="campaignSetPasswordInput" class="campaign-input" type="password" maxlength="120" placeholder="Set/replace password (blank to remove)">'
          + "</div>"
          + '<div class="campaign-actions" style="margin-top:.35rem;">'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.setCampaignPassword()">Apply Password</button>'
          + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.forceAuthoritativeResync()">Broadcast Authoritative State</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.clearProvinceSelections()">Clear Player Map Cursors</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.exportSnapshot()">Export Snapshot</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.importSnapshotPrompt()">Import Snapshot</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.toggleArchive()">' + ((campaign && campaign.archived) ? 'Reopen' : 'Archive') + '</button>'
          + '<button class="btn btn-xs btn-red" onclick="window.campaignSystem.deleteCampaign()">Delete Campaign</button>'
          + "</div>"
          + '</div>')
        : "")
      + (isGm
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Phase 1: GM Mode Control</div>'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">Select GM playstyle (affects actions, travel, and time advancement)</div>'
          + '<div class="campaign-actions" style="margin-top:.35rem;gap:.2rem;">'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.setGmMode(\'passive\')">Passive Mode</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.setGmMode(\'active\')">Active mode</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.setGmMode(\'facilitative\')">Facilitative Mode</button>'
          + '</div>'
          + '<div class="campaign-muted" style="margin-top:.35rem;font-size:.8rem;">'
          + '<strong>Passive:</strong> GM spectates, players act independently (like solo x3)<br>'
          + '<strong>Active:</strong> GM approves actions before they take effect<br>'
          + '<strong>Facilitative:</strong> GM controls travel/time, players handle character actions'
          + '</div>'
          + '<div class="campaign-actions" style="margin-top:.35rem;gap:.2rem;">'
          + '<button class="btn btn-xs ' + (strictCameraLock ? 'btn-teal' : '') + '" onclick="window.campaignSystem.setGmCameraLock(' + (strictCameraLock ? 'false' : 'true') + ')">Strict GM Camera Lock ' + (strictCameraLock ? 'ON' : 'OFF') + '</button>'
          + '</div>'
          + '<div class="campaign-muted" style="margin-top:.22rem;font-size:.78rem;">When ON, players auto-follow GM context/tab/province focus for a unified table view.</div>'
          + '</div>')
        : "")
      + (isGm
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Phase 1: Campaign Combat & Travel</div>'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">Multi-player combat coordination and party travel control</div>'
          + '<div class="campaign-actions" style="margin-top:.35rem;gap:.2rem;">'
          + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.startCampaignCombat(window.campaignSystem.buildPartyRoster())"' + riskyDisabledAttr + '>Start Combat</button>'
          + combatReadyHintHtml
          + '<button class="btn btn-xs" onclick="window.campaignSystem.nextCombatActor()"' + riskyDisabledAttr + '>Advance Step</button>'
          + '<button class="btn btn-xs btn-red" onclick="window.campaignSystem.endCampaignCombat()"' + riskyDisabledAttr + '>End Combat</button>'
          + '</div>'
          + '<div class="campaign-actions" style="margin-top:.35rem;gap:.2rem;">'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.gmAdvanceTime(1)"' + riskyDisabledAttr + '>Advance Rest (1 Phase)</button>'
          + '<button class="btn btn-xs" onclick="window.campaignSystem.promptCampaignTravel()"' + riskyDisabledAttr + '>Travel To...</button>'
          + '</div>'
          + '<div class="campaign-muted" style="margin-top:.35rem;"><strong>Current Combat:</strong> <span id="combatStatusText">Inactive</span></div>'
          + '<div class="campaign-muted" style="margin-top:.18rem;"><strong>Party Travel:</strong> ' + travelStatusText + '</div>'
          + '</div>')
        : "")
      + (state.code
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Party Roster (All Players)</div>'
          + '<div id="partyRosterContainer" style="display:flex;flex-direction:column;gap:.5rem;">'
          + (function() {
            var roster = buildPartyRoster();
            if (roster.length === 0) return '<div class="campaign-muted">No connected characters yet.</div>';
            return roster.map(function(p) {
              var loadout = p.character && p.character.loadout ? p.character.loadout : {};
              var loadoutText = [loadout.weapon1, loadout.weapon2, loadout.armor].filter(Boolean).join(' | ');
              var hacksCount = Array.isArray(p.character && p.character.hacks) ? p.character.hacks.length : 0;
              return '<div style="padding:.5rem;background:var(--bg3);border-radius:.3rem;border-left:3px solid var(--teal);">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;">'
                + '<strong>' + escapeHtml(p.character.name) + '</strong>'
                + '<span class="campaign-muted" style="font-size:.85rem;">' + escapeHtml(p.role) + '</span>'
                + '</div>'
                + '<div class="campaign-muted" style="margin-top:.2rem;font-size:.85rem;">'
                + 'HP ' + p.character.health + '/' + p.character.maxHealth + ' · MS ' + p.character.mentalStress + '/' + p.character.maxMentalStress
                + (p.character.stats && (p.character.stats.valor) ? ' · Val ' + Number(p.character.stats.valor) : '')
                + '</div>'
                + '<div class="campaign-muted" style="margin-top:.12rem;font-size:.78rem;">Loadout: ' + escapeHtml(loadoutText || 'Not synced yet') + '</div>'
                + '<div class="campaign-muted" style="margin-top:.08rem;font-size:.78rem;">OS Hacks: ' + String(hacksCount) + '</div>'
                + '</div>';
            }).join('');
          })()
          + '</div>'
          + '</div>')
        : "")
      + (state.code
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Phase 2: Party Status Dashboard</div>'
          + '<div style="display:flex;flex-direction:column;gap:.5rem;">'
          + (function() {
            var statuses = getPartyStatus();
            if (statuses.length === 0) return '<div class="campaign-muted">No party members with character data.</div>';
            return statuses.map(function(s) {
              var healthPercent = Math.round((s.health / s.maxHealth) * 100);
              var stressPercent = Math.round((s.mentalStress / s.maxMentalStress) * 100);
              var statusLine = s.isDead ? '<span style="color:var(--red2);"><strong>DEAD</strong></span>' 
                : ('HP <strong>' + s.health + '/' + s.maxHealth + '</strong> (' + healthPercent + '%) · MS <strong>' + s.mentalStress + '/' + s.maxMentalStress + '</strong> (' + stressPercent + '%)');
              return '<div style="padding:.5rem;background:var(--bg3);border-radius:.3rem;border-left:4px solid ' + (s.isDead ? 'var(--red2)' : (stressPercent > 80 ? 'var(--red2)' : (healthPercent < 30 ? 'var(--gold2)' : 'var(--teal)'))) + ';">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;">'
                + '<strong>' + escapeHtml(s.name) + '</strong>'
                + '<span class="campaign-muted" style="font-size:.85rem;">' + escapeHtml(s.role) + '</span>'
                + '</div>'
                + '<div class="campaign-muted" style="margin-top:.2rem;font-size:.85rem;">' + statusLine + '</div>'
                + (Array.isArray(s.conditions) && s.conditions.length > 0 ? '<div class="campaign-muted" style="margin-top:.1rem;font-size:.75rem;color:var(--gold2);">Conditions: ' + escapeHtml(s.conditions.join(', ')) + '</div>' : '')
                + '</div>';
            }).join('');
          })()
          + '</div>'
          + '</div>')
        : "")
      + (isGm && state.code
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Phase 2: Action Queue (Active Mode)</div>'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">Players submit actions; you approve or reject them</div>'
          + '<div id="actionQueueContainer" style="display:flex;flex-direction:column;gap:.5rem;">'
          + (function() {
            var queue = getPendingActions();
            if (queue.length === 0) return '<div class="campaign-muted">No pending actions.</div>';
            return queue.map(function(action) {
              return '<div style="padding:.5rem;background:var(--bg3);border-radius:.3rem;border-left:3px solid var(--gold2);">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;">'
                + '<strong>' + escapeHtml(action.playerName) + '</strong>'
                + '<span class="campaign-muted" style="font-size:.85rem;">' + escapeHtml(action.type) + '</span>'
                + '</div>'
                + '<div class="campaign-muted" style="margin-top:.2rem;font-size:.85rem;">' + escapeHtml(JSON.stringify(action.data)) + '</div>'
                + '<div class="campaign-actions" style="margin-top:.2rem;gap:.1rem;">'
                + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.gmApproveAction(\'' + escapeHtml(action.id) + '\')">Approve</button>'
                + '<button class="btn btn-xs btn-red" onclick="window.campaignSystem.gmRejectAction(\'' + escapeHtml(action.id) + '\', \'denied\')">Reject</button>'
                + '</div>'
                + '</div>';
            }).join('');
          })()
          + '</div>'
          + '</div>')
        : "")
      + (state.code
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Phase 2: Character Inventories</div>'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">Per-character backpack management</div>'
          + '<div id="charInventoriesContainer" style="display:flex;flex-direction:column;gap:.5rem;">'
          + (function() {
            var roster = buildPartyRoster();
            if (roster.length === 0) return '<div class="campaign-muted">No characters yet.</div>';
            var allInventories = getAllCharacterInventories();
            return roster.map(function(p) {
              var inv = allInventories[p.token] || [];
              return '<div style="padding:.5rem;background:var(--bg3);border-radius:.3rem;">'
                + '<strong>' + escapeHtml(p.character.name) + '</strong>'
                + '<div class="campaign-muted" style="margin-top:.2rem;font-size:.85rem;">'
                + (inv.length > 0 ? inv.map(function(item, idx) {
                  return '<button class="btn btn-xs" style="margin:0 .1rem .2rem 0;" onclick="window.campaignSystem.removeItemFromCharacterInventory(\'' + p.token + '\', ' + idx + ')">✕ ' + escapeHtml(item) + '</button>';
                }).join('') : '<span class="campaign-muted">No items</span>')
                + '</div>'
                + '</div>';
            }).join('');
          })()
          + '</div>'
          + '</div>')
        : "")
      + (isGm && state.code
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Phase 3: Death & Incapacitation</div>'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">Track character death states and prevent dead characters from acting</div>'
          + '<div id="deathStatesContainer" style="display:flex;flex-direction:column;gap:.5rem;">'
          + (function() {
            var allDead = getDeadCharacters();
            var roster = buildPartyRoster();
            var aliveCount = roster.length - allDead.length;
            return '<div style="margin-bottom:.2rem;"><strong>' + aliveCount + '/' + roster.length + ' alive</strong></div>'
              + (allDead.length > 0 ? allDead.map(function(d) {
                return '<div style="padding:.3rem;background:var(--red2);color:var(--bg1);border-radius:.2rem;font-size:.85rem;">'
                  + '<strong>DEAD</strong> - ' + (new Date(d.deadAt).toLocaleTimeString()) + ' (' + escapeHtml(d.reason) + ')'
                  + '</div>';
              }).join('') : '<div class="campaign-muted">All characters alive</div>')
              + '<div class="campaign-actions" style="margin-top:.2rem;gap:.1rem;">'
              + roster.map(function(p) {
                var isDead = window.campaignSystem.isCharacterDead(p.token);
                return '<button class="btn btn-xs ' + (isDead ? 'btn-red' : 'btn-green') + '" onclick="window.campaignSystem.setCharacterDead(\'' + p.token + '\', ' + (!isDead) + ', \'GM set\')">'
                  + (isDead ? '✓' : '✕') + ' ' + escapeHtml(p.character.name) + '</button>';
              }).join('')
              + '</div>';
          })()
          + '</div>'
          + '</div>')
        : "")
      + (isGm && state.code
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Phase 3: Contested Rolls</div>'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">Player vs Player or opposed rolls with roll resolution</div>'
          + '<div id="contestedRollsContainer" style="display:flex;flex-direction:column;gap:.5rem;">'
          + (function() {
            // TODO: Implement contested rolls GUI when needed
            return '<div class="campaign-muted">No active contested rolls. Start one with API call.</div>';
          })()
          + '</div>'
          + '</div>')
        : "")
      + (state.code
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">Phase 3: Character Dice Visibility</div>'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">See each character\'s die sizes and Wayfarer\'s Lead</div>'
          + '<div id="diceVisibilityContainer" style="display:flex;flex-direction:column;gap:.5rem;">'
          + (function() {
            var roster = buildPartyRoster();
            var allDice = getAllCharacterDice();
            var leadDie = getLargestWayfarersLeadDie();
            if (roster.length === 0) return '<div class="campaign-muted">No characters yet.</div>';
            return '<div style="margin-bottom:.2rem;"><strong>Largest Wayfarer\'s Lead: d' + leadDie + '</strong></div>'
              + roster.map(function(p) {
                var dice = allDice[p.token] || getCharacterDice(p.token);
                var shorthand = 'Vd:d' + Number(dice.valor || 4) + ' | Bd:d' + dice.body + ' | Md:d' + dice.mind;
                return '<div style="padding:.3rem;background:var(--bg3);border-radius:.2rem;font-size:.85rem;border-left:2px solid var(--teal);">'
                  + '<strong>' + escapeHtml(p.character.name) + '</strong>'
                  + ' Lead: <strong style="color:var(--gold2);">d' + Math.max(Number(dice.valor || 4), dice.body, dice.mind, dice.spirit, dice.control, dice.strike, dice.shoot, dice.defend) + '</strong>'
                  + '<div style="margin-top:.1rem;">' + shorthand + '</div>'
                  + '</div>';
              }).join('');
          })()
          + '</div>'
          + '</div>')
        : "")
      + (isGm
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">GM Economy Controls & Audit</div>'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">Manual corrections with required reason. All changes are written to the shared ledger.</div>'
          + '<div class="campaign-roll-grid">'
          + '<select id="campaignEconomyResource" class="campaign-input">'
          + '<option value="tmw">Teamwork (TMW)</option>'
          + '<option value="credits">Credits</option>'
          + '<option value="renown">Renown</option>'
          + '</select>'
          + '<input id="campaignEconomyDelta" class="campaign-input" type="number" step="1" value="1" placeholder="Delta (+/-)">'
          + '</div>'
          + '<textarea id="campaignEconomyReason" class="campaign-input" maxlength="220" placeholder="Required reason for adjustment..."></textarea>'
          + '<div class="campaign-actions" style="margin-top:.35rem;">'
          + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.applyGmEconomyAdjustment()">Apply & Log</button>'
          + '<button class="btn btn-xs" onclick="if(window.auditPanelUI) window.auditPanelUI.showAuditPanelModal()">View Audit</button>'
          + '</div>'
          + '<div style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--border2);">'
          + '<div class="campaign-muted" style="margin-bottom:.35rem;">Teamwork Enforcement</div>'
          + '<div class="campaign-actions" style="gap:.2rem;">'
          + '<button class="btn btn-xs" id="campaignStrictModeBtn" onclick="window.campaignSystem.toggleStrictTeamworkMode()">Strict Mode OFF</button>'
          + '<button class="btn btn-xs" onclick="if(window.auditPanelUI) window.auditPanelUI.exportLedgerCSV()">Export Ledger</button>'
          + '<button class="btn btn-xs" onclick="if(window.auditPanelUI) window.auditPanelUI.exportFailureReport()">Export Report</button>'
          + '</div>'
          + '</div>'
          + '</div>')
        : "")
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Online Members</div>'
      + renderMembers(campaign ? campaign.members : [])
      + "</div>"
      + readyCheckCardHtml
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Campaign Wayfarers</div>'
      + '<div class="campaign-actions campaign-sort-actions">'
      + '<button class="btn btn-xs ' + (state.gmWayfarerSort === 'online' ? 'btn-teal' : '') + '" onclick="window.campaignSystem.setWayfarerSort(\'online\')">Online First</button>'
      + '<button class="btn btn-xs ' + (state.gmWayfarerSort === 'updated' ? 'btn-teal' : '') + '" onclick="window.campaignSystem.setWayfarerSort(\'updated\')">Last Updated</button>'
      + '</div>'
      + renderCharacterRoster(roster, isGm)
      + '</div>'
      + forgeSummaryCardHtml
      + (isGm
        ? (""
          + '<div class="campaign-card">'
          + '<div class="campaign-card-title">GM Wayfarer Generator</div>'
          + '<div class="campaign-muted">Generate quick NPC/PC ideas for campaign prep.</div>'
          + '<div class="campaign-actions" style="margin-top:.35rem;">'
          + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.generateWayfarerIdea()">Generate Idea</button>'
          + '</div>'
          + (state.gmIdea ? ('<div class="campaign-muted" style="margin-top:.35rem;color:var(--text2);">' + escapeHtml(state.gmIdea) + '</div>') : '')
          + '</div>')
        : "")
      + diagnosticsCardHtml
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Party Backpack Sharing (Party Stash)</div>'
      + '<div class="campaign-muted">Share items from your backpack to a shared pool, then claim them on any wayfarer. Roster buttons copy visible items into your backpack first.</div>'
        + '<div class="campaign-muted" style="margin-top:.28rem;">Your backpack: ' + (localBackpackSlots.length ? localBackpackSlots.map(function (entry) {
          return '<button class="btn btn-xs" style="margin:0 .2rem .2rem 0;" onclick="window.campaignSystem.shareBackpackItem(' + entry.idx + ')">Share ' + escapeHtml(normalizeItemLabel(entry.item)) + '</button>';
        }).join('') : 'No items') + '</div>'
      + '<div class="campaign-muted" style="margin-top:.28rem;">Party pool: ' + (partyStash.length ? partyStash.map(function (item, i) {
          return '<button class="btn btn-xs btn-teal" style="margin:0 .2rem .2rem 0;" onclick="window.campaignSystem.claimSharedItem(' + i + ')">Take ' + escapeHtml(normalizeItemLabel(item)) + '</button>';
        }).join('') : 'No shared items yet') + '</div>'
      + '</div>'
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Private Notes</div>'
      + '<textarea id="campaignPrivateNoteInput" class="campaign-input" maxlength="5000" placeholder="Your private campaign notes...">' + escapeHtml(privateNote) + '</textarea>'
      + '<div class="campaign-actions" style="margin-top:.35rem;">'
      + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.savePrivateNote()">Save Notes</button>'
      + '</div>'
      + summaryHtml
      + "</div>"
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Recent Log</div>'
      + renderLog(campaign ? campaign.log : [])
      + "</div>"
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Session Recap Summary</div>'
      + (recapHighlights.length
        ? ('<ol class="campaign-quickstart-list">' + recapHighlights.map(function (line) {
            return '<li>' + escapeHtml(line) + '</li>';
          }).join('') + '</ol>')
        : '<div class="campaign-muted">No recap summary yet.</div>')
      + "</div>"
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Session Recap Timeline</div>'
      + renderSessionTimeline(sessionTimeline, 18)
      + "</div>"
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Campaign Chronicle</div>'
      + renderCampaignChronicle(campaignChronicle, 10)
      + "</div>"
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Unresolved Hooks</div>'
      + '<div class="campaign-muted" style="margin-bottom:.3rem;">Open hooks: <strong style="color:var(--gold2);">' + String(openHookCount) + '</strong></div>'
      + renderCampaignHooks(unresolvedHooks, isGm)
      + "</div>"
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Shared Economy Ledger</div>'
      + renderEconomyLedger(economyLedger, 14)
      + "</div>";

    bindDraftInputs();
    applyGmCompactLayout();
    applyPlayerCompactLayout();
    applyPlayerLiteMode();
    restoreCampaignSoundtrackDraftFocus();
  }

  function applyGmCompactLayout() {
    if (state.role !== "gm") return;
    var section = document.getElementById("campaignSettingsSection");
    if (!section) return;
    if (section.querySelector("#campaignCompactGroups")) return;

    var cards = Array.prototype.slice.call(section.querySelectorAll(".campaign-card"));
    if (!cards.length) return;

    var advancedTitles = {
      "GM Campaign Debug": true,
      "GM Campaign Controls": true,
      "GM Economy Controls & Audit": true,
      "Bug Report & Diagnostics": true,
      "Recent Log": true,
      "Shared Economy Ledger": true,
      "Phase 3: Contested Rolls": true,
      "Phase 3: Death & Incapacitation": true,
      "Phase 3: Character Dice Visibility": true,
      "Phase 2: Character Inventories": true
    };
    var systemsTitles = {
      "Phase 1: Campaign Combat & Travel": true,
      "Phase 2: Party Status Dashboard": true,
      "Phase 2: Action Queue (Active Mode)": true,
      "Party Roster (All Players)": true,
      "Campaign Wayfarers": true,
      "Online Members": true,
      "GM Forge Library": true,
      "Campaign Chronicle": true,
      "Unresolved Hooks": true,
      "Session Recap Summary": true,
      "Session Recap Timeline": true
    };

    var advanced = [];
    var systems = [];
    cards.forEach(function (card) {
      var titleEl = card.querySelector(".campaign-card-title");
      var title = titleEl ? String(titleEl.textContent || "").trim() : "";
      if (advancedTitles[title]) advanced.push(card);
      else if (systemsTitles[title]) systems.push(card);
    });

    function buildGroup(id, summaryText, items, openByDefault) {
      if (!items.length) return null;
      var wrapper = document.createElement("details");
      wrapper.id = id;
      wrapper.className = "campaign-card";
      if (openByDefault) wrapper.open = true;
      var summary = document.createElement("summary");
      summary.className = "campaign-card-title";
      summary.style.cursor = "pointer";
      summary.textContent = summaryText;
      wrapper.appendChild(summary);
      items.forEach(function (item) { wrapper.appendChild(item); });
      return wrapper;
    }

    var host = document.createElement("div");
    host.id = "campaignCompactGroups";
    var systemsGroup = buildGroup("campaignSystemsGroup", "Campaign Systems (Play)", systems, true);
    var advancedGroup = buildGroup("campaignAdvancedGroup", "Advanced GM Tools (Debug/Admin)", advanced, false);
    if (systemsGroup) host.appendChild(systemsGroup);
    if (advancedGroup) host.appendChild(advancedGroup);
    if (!host.childNodes.length) return;

    var insertionAnchor = section.querySelector(".campaign-card");
    if (insertionAnchor) {
      insertionAnchor.parentNode.insertBefore(host, insertionAnchor.nextSibling);
    } else {
      section.appendChild(host);
    }
  }

  function applyPlayerCompactLayout() {
    if (state.role !== "player") return;
    var section = document.getElementById("campaignSettingsSection");
    if (!section) return;
    if (section.querySelector("#campaignPlayerCompactGroups")) return;

    var cards = Array.prototype.slice.call(section.querySelectorAll(".campaign-card"));
    if (!cards.length) return;

    var essentialTitles = {
      "Shared Teamwork Points": true,
      "Ready Check": true,
      "Online Members": true,
      "Mobile / Player-Lite": true
    };
    var partyTitles = {
      "Party Roster (All Players)": true,
      "Phase 2: Party Status Dashboard": true,
      "Campaign Wayfarers": true,
      "Phase 2: Character Inventories": true,
      "Phase 3: Character Dice Visibility": true,
      "Party Backpack Sharing (Party Stash)": true
    };
    var archiveTitles = {
      "Private Notes": true,
      "Recent Log": true,
      "Session Recap Timeline": true,
      "Session Recap Summary": true,
      "Campaign Chronicle": true,
      "Unresolved Hooks": true,
      "Shared Economy Ledger": true,
      "Bug Report & Diagnostics": true
    };

    var essentials = [];
    var party = [];
    var archive = [];
    cards.forEach(function (card) {
      if (card.classList.contains("campaign-player-live-card")) return;
      var titleEl = card.querySelector(".campaign-card-title");
      var title = titleEl ? String(titleEl.textContent || "").trim() : "";
      if (essentialTitles[title]) essentials.push(card);
      else if (partyTitles[title]) party.push(card);
      else if (archiveTitles[title]) archive.push(card);
    });

    function buildGroup(id, summaryText, items, openByDefault) {
      if (!items.length) return null;
      var wrapper = document.createElement("details");
      wrapper.id = id;
      wrapper.className = "campaign-card";
      if (openByDefault) wrapper.open = true;
      var summary = document.createElement("summary");
      summary.className = "campaign-card-title";
      summary.style.cursor = "pointer";
      summary.textContent = summaryText;
      wrapper.appendChild(summary);
      items.forEach(function (item) { wrapper.appendChild(item); });
      return wrapper;
    }

    var host = document.createElement("div");
    host.id = "campaignPlayerCompactGroups";
    var essentialsGroup = buildGroup("campaignPlayerEssentialsGroup", "Player Essentials", essentials, true);
    var partyGroup = buildGroup("campaignPlayerPartyGroup", "Party Systems", party, false);
    var archiveGroup = buildGroup("campaignPlayerArchiveGroup", "Notes & Logs", archive, false);
    if (essentialsGroup) host.appendChild(essentialsGroup);
    if (partyGroup) host.appendChild(partyGroup);
    if (archiveGroup) host.appendChild(archiveGroup);
    if (!host.childNodes.length) return;

    var insertionAnchor = section.querySelector(".campaign-player-live-card") || section.querySelector(".campaign-card");
    if (insertionAnchor) {
      insertionAnchor.parentNode.insertBefore(host, insertionAnchor.nextSibling);
    } else {
      section.appendChild(host);
    }
  }

  function isPlayerLiteModeEnabled() {
    try {
      return String(window.localStorage && window.localStorage.getItem("btl-campaign-player-lite") || "0") === "1";
    } catch (_err) {
      return false;
    }
  }

  function applyPlayerLiteMode() {
    var body = document.body;
    if (!body) return;
    var enabled = isPlayerLiteModeEnabled();
    body.classList.toggle("campaign-player-lite-mode", !!enabled);
  }

  function setPlayerLiteMode(enabled) {
    var next = !!enabled;
    try {
      if (window.localStorage) {
        window.localStorage.setItem("btl-campaign-player-lite", next ? "1" : "0");
      }
    } catch (_err) {}
    applyPlayerLiteMode();
    renderSettingsSection();
    if (typeof window.showNotif === "function") {
      window.showNotif(next ? "Player-lite mode enabled." : "Player-lite mode disabled.", "good");
    }
  }

  function ensureDockPanel() {
    if (document.getElementById("campaignDock")) return;

    var dock = document.createElement("div");
    dock.id = "campaignDock";
    dock.className = "campaign-dock";

    dock.innerHTML = ""
      + '<button id="campaignDockToggle" class="campaign-dock-toggle" onclick="window.campaignSystem.toggleDock()">Campaign</button>'
      + '<div id="campaignDockPanel" class="campaign-dock-panel">'
      + '<div class="campaign-dock-head">'
      + '<div class="campaign-dock-title">Campaign Live</div>'
      + '<div id="campaignDockBadge" class="campaign-dock-badge offline">Offline</div>'
      + "</div>"
      + '<div id="campaignDockMeta" class="campaign-dock-meta">No campaign connected.</div>'
      + '<div id="campaignDockScene" class="campaign-dock-scene"></div>'
      + '<div id="campaignDockLiveStatus" class="campaign-dock-roll campaign-dock-live"></div>'
      + '<div id="campaignDockRoll" class="campaign-dock-roll campaign-dock-mechanics"></div>'
      + '<div id="campaignDockLock" class="campaign-dock-roll campaign-dock-lock"></div>'
      + '<div id="campaignDockFilters" class="campaign-dock-filters"></div>'
      + '<div id="campaignDockTrigger" class="campaign-dock-roll campaign-dock-trigger"></div>'
      + '<div id="campaignDockTimeline" class="campaign-dock-timeline"></div>'
      + '<div id="campaignDockTimelineActions" class="campaign-dock-timeline-actions"></div>'
      + '<div class="campaign-dock-chat">'
      + '<div class="campaign-dock-chat-row">'
      + '<input id="campaignDockChatInput" class="campaign-dock-input" type="text" maxlength="500" placeholder="Type campaign chat...">'
      + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.sendChatMessage()">Send</button>'
      + '</div>'
      + '<div class="campaign-dock-chat-helper">Tip: GM can run <strong>/prompt valor d6 @wayfarer breach door</strong> from chat.</div>'
      + '<div class="campaign-dock-chat-actions">'
      + '<button class="btn btn-xs" onclick="window.campaignSystem.clearRecentDockChat()">Clear Recent</button>'
      + '<button class="btn btn-xs" onclick="window.campaignSystem.restoreRecentDockChat()" title="Restore last cleared chat batch">Restore</button>'
      + '</div>'
      + "</div>"
      + "</div>";

    document.body.appendChild(dock);

    var input = document.getElementById("campaignDockChatInput");
    if (input) {
      input.addEventListener("keydown", function (evt) {
        if (evt.key === "Enter") {
          evt.preventDefault();
          sendChatMessage();
        }
      });
    }

    renderDockPanel();
  }

  function findCampaignCombatParticipant(combatState, token) {
    if (!combatState || !Array.isArray(combatState.participants)) return null;
    var target = String(token || "");
    for (var i = 0; i < combatState.participants.length; i += 1) {
      var row = combatState.participants[i];
      if (!row) continue;
      if (String(row.token || "") === target) return row;
    }
    return null;
  }

  function getCampaignCombatActorSummary(combatState) {
    if (!combatState || !combatState.active || !Array.isArray(combatState.turnOrder) || !combatState.turnOrder.length) {
      return { active: false };
    }
    var phase = String(combatState.phase || "wayfarer");
    var token = String(getCampaignCombatActiveToken(combatState) || "");
    if (!token && phase === "wayfarer") {
      var actedCount = getCampaignCombatActedWayfarers(combatState).length;
      var wayfarerTotal = getCampaignCombatWayfarerTokens(combatState).length;
      return {
        active: true,
        key: "gm-prompt:" + Math.max(1, Number(combatState.round || 1)) + ":" + actedCount,
        token: "",
        name: "GM chooses next Wayfarer",
        round: Math.max(1, Number(combatState.round || 1)),
        index: actedCount + 1,
        total: Math.max(1, wayfarerTotal + 1),
        isEnemy: false,
        hasActed: false,
        isMe: false,
        isPrompt: true
      };
    }
    var idx = Array.isArray(combatState.turnOrder) ? combatState.turnOrder.indexOf(token) : -1;
    var row = findCampaignCombatParticipant(combatState, token);
    var fallbackName = token.indexOf("enemy:") === 0
      ? "Enemy Turn"
      : (token || "Wayfarer");
    return {
      active: true,
      key: token + ":" + Math.max(1, Number(combatState.round || 1)) + ":" + phase,
      token: token,
      name: String((row && row.name) || fallbackName || "Wayfarer"),
      round: Math.max(1, Number(combatState.round || 1)),
      index: idx >= 0 ? (idx + 1) : 1,
      total: combatState.turnOrder.length,
      isEnemy: !!(row && row.isEnemy),
      hasActed: !!(row && row.hasActed),
      isMe: !!(state.token && token && String(state.token) === token),
      isPrompt: false
    };
  }

  function buildCampaignUiAction(label, onclick, tone, disabled) {
    return {
      label: String(label || "").trim(),
      onclick: String(onclick || "").trim(),
      tone: String(tone || "").trim().toLowerCase(),
      disabled: !!disabled
    };
  }

  function pushCampaignUiAction(list, label, onclick, tone, disabled) {
    if (!Array.isArray(list)) return;
    var next = buildCampaignUiAction(label, onclick, tone, disabled);
    if (!next.label || !next.onclick) return;
    for (var i = 0; i < list.length; i += 1) {
      var row = list[i];
      if (!row) continue;
      if (String(row.label || "") === next.label && String(row.onclick || "") === next.onclick) return;
    }
    list.push(next);
  }

  function getCampaignTabCommand(tabId) {
    var tab = String(tabId || "").trim().toLowerCase();
    if (!tab) return "";
    return 'if (typeof window.switchTab === "function") window.switchTab("' + tab + '", document.getElementById("tabnav-' + tab + '"));';
  }

  function getCampaignDockCommand() {
    return 'window.campaignSystem.openDock()';
  }

  function getCampaignJoinSharedVttCommand() {
    return 'window.campaignSystem.joinSharedCombatMode()';
  }

  function getCampaignTargetDisplayName(token, fallback) {
    var wanted = String(token || "").trim();
    if (!wanted) return String(fallback || "table");
    return getCampaignCharacterName(wanted, fallback || wanted);
  }

  function getOldestActivePendingCheck(sharedState) {
    var pending = ensurePendingChecksState(sharedState || getCampaignSharedState());
    var active = pending && pending.active && typeof pending.active === "object" ? pending.active : {};
    var rows = Object.keys(active).map(function (id) {
      return active[id];
    }).filter(function (row) {
      return !!(row && typeof row === "object");
    }).sort(function (a, b) {
      return Number(a && a.createdAt || 0) - Number(b && b.createdAt || 0);
    });
    return rows.length ? rows[0] : null;
  }

  function getCampaignEnemyActionSummary(request) {
    if (!request || typeof request !== "object") return { title: "Enemy Action", detail: "", targetLabel: "the table" };
    if (String(request.mode || "single") === "aoe") {
      var band = String(request.rangeBand || request.aoeBand || "close").trim() || "close";
      return {
        title: "Enemy Action · AOE",
        detail: "Lane " + band.toUpperCase(),
        targetLabel: band.toUpperCase() + " lane"
      };
    }
    return {
      title: "Enemy Action",
      detail: "Target " + String(request.targetName || "Wayfarer"),
      targetLabel: String(request.targetName || "a Wayfarer")
    };
  }

  function getCampaignLiveActionContract(sharedState, campaignState) {
    var shared = sharedState || getCampaignSharedState() || {};
    var campaign = campaignState || state.campaign || {};
    var readyCheck = shared && shared.readyCheck && typeof shared.readyCheck === "object"
      ? shared.readyCheck
      : ensureReadyCheckState(shared);
    var combatState = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
      ? shared.campaignCombat
      : ensureCampaignCombatState(shared);
    var tableState = getCampaignTableState(shared);
    var sceneState = resolveTableSceneState(shared, tableState, campaign);
    var soundtrackSettings = normalizeCampaignSoundtrackSettings(ensureGmSettings(shared).soundtrack);
    var soundtrackSummary = soundtrackSettings.enabled ? getCampaignSoundtrackSummary(soundtrackSettings) : null;
    var activeRoll = campaign && campaign.activeRollRequest && campaign.activeRollRequest.id
      ? campaign.activeRollRequest
      : null;
    var actor = getCampaignCombatActorSummary(combatState);
    var enemyRequest = getCampaignEnemyActionRequest(combatState);
    var pending = ensurePendingChecksState(shared);
    var pendingActiveCount = pending && pending.active ? Object.keys(pending.active).length : 0;
    var oldestPending = getOldestActivePendingCheck(shared);
    var readyRequiredCount = Array.isArray(readyCheck && readyCheck.requiredTokens) ? readyCheck.requiredTokens.length : 0;
    var readyResponseCount = getReadyCheckResponseCount(readyCheck);
    var canRespondReady = !!(state.token && readyCheck && readyCheck.responses && !readyCheck.responses[state.token]);
    var openCombatCommand = getCampaignTabCommand("combat");
    var openCharacterCommand = getCampaignTabCommand("character");
    var openMerchantCommand = getCampaignTabCommand("shop");
    var openMissionsCommand = getCampaignTabCommand("missions");
    var joinSharedVttCommand = getCampaignJoinSharedVttCommand();
    var contract = {
      kind: "idle",
      id: "",
      source: "table",
      status: "idle",
      tone: tableState && tableState.key === "combat" ? "teal" : "muted",
      label: String(tableState && tableState.label || "Exploration"),
      summary: "The table is clear and ready.",
      detail: "",
      prompt: state.role === "gm"
        ? "Guide the next scene, prompt a roll, or open a shared area."
        : "You can move between sheet, map, and merchant while waiting on the next cue.",
      canActNow: false,
      stat: "",
      dread: 0,
      scope: "table",
      targetToken: "",
      targetName: "",
      targetTokens: [],
      targetNames: [],
      actingToken: "",
      actingName: "",
      pendingActiveCount: pendingActiveCount,
      readyRequiredCount: readyRequiredCount,
      readyResponseCount: readyResponseCount,
      sceneMode: String(sceneState && sceneState.effective || "exploration"),
      tableStateKey: String(tableState && tableState.key || "exploration"),
      soundtrackLabel: soundtrackSummary ? String(soundtrackSummary.moodLabel || soundtrackSummary.suiteLabel || "") : "",
      vttOpen: !!(combatState && combatState.vttSession),
      actions: []
    };

    if (isRecoveryOnlySyncState()) {
      contract.kind = "recovery";
      contract.id = "recovery";
      contract.status = "pending";
      contract.tone = "red";
      contract.label = "Reconnect In Progress";
      contract.summary = String(state.syncText || "Reconciling shared campaign state.");
      contract.prompt = "Hold risky actions until the authoritative snapshot settles.";
      pushCampaignUiAction(contract.actions, "Reconnect", 'window.campaignSystem.reconnectNow()', "teal");
      pushCampaignUiAction(contract.actions, "Fix Desync", 'window.campaignSystem.recoverSyncNow()', "red");
      return contract;
    }

    if (activeRoll) {
      var activeTargetToken = String(activeRoll.targetToken || "").trim();
      var activeTargetName = activeTargetToken
        ? getCampaignTargetDisplayName(activeTargetToken, activeRoll.targetName || activeTargetToken)
        : "table";
      var canOpenRoll = state.role !== "gm" && (!activeTargetToken || String(state.token || "") === activeTargetToken);
      var responseCount = Array.isArray(activeRoll.responses) ? activeRoll.responses.length : 0;
      contract.kind = "roll-request";
      contract.id = String(activeRoll.id || "");
      contract.source = "campaign-roll-request";
      contract.status = "pending";
      contract.tone = canOpenRoll ? "teal" : (state.role === "gm" ? "gold" : "muted");
      contract.label = String(activeRoll.label || "Dread Check");
      contract.summary = String(activeRoll.stat || "valor").toUpperCase() + " vs d" + Math.max(1, Number(activeRoll.dread || 8) || 8);
      contract.detail = activeTargetToken
        ? ("Target " + activeTargetName + " · " + responseCount + " response" + (responseCount === 1 ? "" : "s"))
        : ("Open party response · " + responseCount + " response" + (responseCount === 1 ? "" : "s"));
      contract.prompt = canOpenRoll
        ? "You are the one who should click next."
        : (state.role === "gm"
          ? ("Waiting on " + activeTargetName + " to answer the live roll prompt.")
          : ("Waiting on " + activeTargetName + " to answer the live roll prompt."));
      contract.canActNow = canOpenRoll;
      contract.stat = String(activeRoll.stat || "valor");
      contract.dread = Math.max(1, Number(activeRoll.dread || 8) || 8);
      contract.scope = activeTargetToken ? "individual" : "party";
      contract.targetToken = activeTargetToken;
      contract.targetName = activeTargetName;
      contract.targetTokens = activeTargetToken ? [activeTargetToken] : [];
      contract.targetNames = activeTargetToken ? [activeTargetName] : [];
      if (canOpenRoll) {
        pushCampaignUiAction(contract.actions, "Open Roll Prompt", 'window.campaignSystem.openActiveRollPrompt()', "teal");
      } else if (state.role === "gm") {
        pushCampaignUiAction(contract.actions, "Close Active Roll", 'window.campaignSystem.closeActiveRoll()', "red");
      }
      if (contract.vttOpen && state.role === "player") {
        pushCampaignUiAction(contract.actions, "Join Shared VTT", joinSharedVttCommand, "teal");
      } else {
        pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "");
      }
      return contract;
    }

    if (readyCheck && readyCheck.id && String(readyCheck.status || "") === "pending") {
      contract.kind = "ready-check";
      contract.id = String(readyCheck.id || "");
      contract.source = "ready-check";
      contract.status = "pending";
      contract.tone = canRespondReady ? "teal" : (state.role === "gm" ? "gold" : "muted");
      contract.label = String(readyCheck.label || "Ready Check");
      contract.summary = readyResponseCount + "/" + readyRequiredCount + " ready";
      contract.detail = String(readyCheck.type || "shared action");
      contract.prompt = canRespondReady
        ? "Let the table know if you are ready to proceed."
        : (state.role === "gm"
          ? "You can wait, force-approve, or cancel before moving forward."
          : "Waiting for the remaining responses before the table advances.");
      contract.canActNow = !!(canRespondReady || state.role === "gm");
      if (canRespondReady) {
        pushCampaignUiAction(contract.actions, "Ready", 'window.campaignSystem.respondReadyCheck(true)', "teal");
        pushCampaignUiAction(contract.actions, "Not Ready", 'window.campaignSystem.respondReadyCheck(false)', "red");
      } else if (state.role === "gm") {
        pushCampaignUiAction(contract.actions, "Force Approve", 'window.campaignSystem.forceApproveReadyCheck()', "teal");
        pushCampaignUiAction(contract.actions, "Cancel", 'window.campaignSystem.cancelReadyCheck()', "red");
      }
      return contract;
    }

    if (combatState && combatState.active) {
      if (String(combatState.phase || "wayfarer") === "enemy") {
        var enemySummary = getCampaignEnemyActionSummary(enemyRequest);
        var enemyTargetsMe = !!(state.role === "player" && state.token && enemyRequest && String(enemyRequest.status || "pending") === "pending" && isCampaignEnemyActionTargetToken(enemyRequest, state.token));
        contract.kind = "enemy-action";
        contract.id = String(enemyRequest && enemyRequest.id || "enemy-phase");
        contract.source = enemyRequest ? "enemy-action-request" : "enemy-phase";
        contract.status = enemyRequest ? String(enemyRequest.status || "pending") : "awaiting-prompt";
        contract.tone = enemyTargetsMe ? "red" : (state.role === "gm" ? "gold" : "muted");
        contract.label = enemyRequest ? enemySummary.title : "Enemy Phase";
        contract.summary = enemyRequest
          ? enemySummary.detail
          : "GM chooses the next enemy target or lane.";
        contract.detail = enemyRequest
          ? (enemyTargetsMe
            ? "This action is targeting you."
            : ("Waiting on " + enemySummary.targetLabel + "."))
          : (state.role === "gm" ? "Prompt an enemy action, then let that Wayfarer resolve it." : "Wait for the GM to send the next enemy prompt.");
        contract.prompt = enemyTargetsMe
          ? "Click Enemy Action on the Combat Tab or shared VTT now."
          : (enemyRequest
            ? (String(enemyRequest.status || "pending") === "resolved"
              ? "The last enemy action is resolved. The GM can prompt again or end the round."
              : "Enemy pressure is live; keep the table on the prompted target.")
            : "Enemy turn is active.");
        contract.canActNow = !!(enemyTargetsMe || (state.role === "gm" && !enemyRequest));
        contract.scope = enemyRequest && String(enemyRequest.mode || "single") === "aoe" ? "lane" : "individual";
        contract.targetToken = String(enemyRequest && enemyRequest.targetToken || "");
        contract.targetName = String(enemyRequest && enemyRequest.targetName || "");
        contract.targetTokens = enemyRequest && Array.isArray(enemyRequest.targetTokens) ? enemyRequest.targetTokens.slice() : [];
        contract.targetNames = enemyRequest && Array.isArray(enemyRequest.targetNames) ? enemyRequest.targetNames.slice() : [];
        if (enemyTargetsMe) {
          pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "red");
          if (contract.vttOpen) pushCampaignUiAction(contract.actions, "Join Shared VTT", joinSharedVttCommand, "teal");
        } else if (state.role === "gm") {
          pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "teal");
          if (contract.vttOpen) pushCampaignUiAction(contract.actions, "Open Shared VTT", joinSharedVttCommand, "");
        } else if (contract.vttOpen) {
          pushCampaignUiAction(contract.actions, "Join Shared VTT", joinSharedVttCommand, "teal");
          pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "");
        } else {
          pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "");
        }
        return contract;
      }

      if (actor.active) {
        contract.kind = "turn-prompt";
        contract.id = String(actor.key || "combat-turn");
        contract.source = "campaign-turn-order";
        contract.status = actor.hasActed ? "acted" : "pending";
        contract.tone = actor.isMe ? "teal" : (actor.isPrompt ? "gold" : "muted");
        contract.label = actor.isPrompt ? "Choose The Next Wayfarer" : String(actor.name || "Wayfarer");
        contract.summary = "Round " + actor.round + " · Turn " + actor.index + "/" + actor.total;
        contract.detail = actor.isPrompt
          ? "GM prompt is open."
          : (actor.isMe
            ? "It is your turn to act."
            : ((actor.isEnemy ? "Enemy turn is queued." : "Current acting Wayfarer")));
        contract.prompt = actor.isPrompt
          ? "Pick who goes next before the table can continue."
          : (actor.isMe
            ? "Resolve your action from Combat, Quick Panel, or the shared VTT."
            : ("Waiting on " + actor.name + " to finish."));
        contract.canActNow = !!(actor.isPrompt ? (state.role === "gm") : actor.isMe);
        contract.actingToken = String(actor.token || "");
        contract.actingName = String(actor.name || "");
        if (actor.isPrompt) {
          pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "teal");
          if (contract.vttOpen) pushCampaignUiAction(contract.actions, "Open Shared VTT", joinSharedVttCommand, "");
        } else if (actor.isMe) {
          pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "teal");
          if (contract.vttOpen) pushCampaignUiAction(contract.actions, "Join Shared VTT", joinSharedVttCommand, "");
        } else if (contract.vttOpen && state.role === "player") {
          pushCampaignUiAction(contract.actions, "Join Shared VTT", joinSharedVttCommand, "teal");
          pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "");
        } else {
          pushCampaignUiAction(contract.actions, "Open Combat", openCombatCommand, "");
        }
        return contract;
      }
    }

    if (oldestPending) {
      var pendingStat = String(oldestPending.stat || "").trim();
      var pendingParticipants = Array.isArray(oldestPending.participants) ? oldestPending.participants.length : 0;
      contract.kind = "pending-check";
      contract.id = String(oldestPending.id || "");
      contract.source = "pending-check";
      contract.status = String(oldestPending.status || "pending");
      contract.tone = state.role === "gm" ? "gold" : "muted";
      contract.label = String(oldestPending.label || "Pending Check");
      contract.summary = pendingStat ? (pendingStat.toUpperCase() + " vs d" + Math.max(1, Number(oldestPending.dread || 8) || 8)) : "GM outcome queue";
      contract.detail = pendingParticipants ? (pendingParticipants + " participant" + (pendingParticipants === 1 ? "" : "s")) : String(oldestPending.scope || "campaign");
      contract.prompt = state.role === "gm"
        ? "A shared check is still waiting for your ruling."
        : "A shared check is live. Watch for the next GM prompt or outcome.";
      pushCampaignUiAction(contract.actions, "Open Dock", getCampaignDockCommand(), "teal");
      if (state.role === "gm") pushCampaignUiAction(contract.actions, "Open Missions", openMissionsCommand, "");
      return contract;
    }

    pushCampaignUiAction(contract.actions, "Open Dock", getCampaignDockCommand(), "teal");
    if (state.role === "gm") {
      pushCampaignUiAction(contract.actions, "GM Dashboard", 'if (typeof window.openGmDashboard === "function") window.openGmDashboard();', "");
      pushCampaignUiAction(contract.actions, "Open Missions", openMissionsCommand, "");
    } else {
      pushCampaignUiAction(contract.actions, "Character", openCharacterCommand, "");
      pushCampaignUiAction(contract.actions, "Merchant", openMerchantCommand, "");
    }
    return contract;
  }

  function renderCampaignActionButtons(actions, options) {
    var opts = options && typeof options === "object" ? options : {};
    var source = Array.isArray(actions) ? actions : [];
    var limit = Math.max(0, Number(opts.limit || source.length) || 0);
    if (!limit) return "";
    return source.slice(0, limit).map(function (action) {
      if (!action || !action.label || !action.onclick) return "";
      var tone = String(action.tone || "").toLowerCase();
      var toneClass = tone === "red"
        ? " btn-red"
        : (tone === "teal"
          ? " btn-teal"
          : (tone === "primary" ? " btn-primary" : ""));
      var sizeClass = opts.sizeClass ? (" " + String(opts.sizeClass)) : "";
      var disabledAttr = action.disabled ? " disabled" : "";
      return '<button class="btn' + sizeClass + toneClass + '" onclick="' + escapeHtml(action.onclick) + '"' + disabledAttr + '>' + escapeHtml(action.label) + '</button>';
    }).join("");
  }

  function renderCampaignDockLiveActionCard(contract) {
    if (!contract || typeof contract !== "object") return "";
    var kindLabels = {
      recovery: "Recovery",
      "roll-request": "Live Roll",
      "ready-check": "Ready Check",
      "enemy-action": "Enemy Phase",
      "turn-prompt": "Turn Prompt",
      "pending-check": "GM Queue",
      idle: "Table Flow"
    };
    var actionsHtml = renderCampaignActionButtons(contract.actions, { limit: 2, sizeClass: "btn-xs" });
    return ''
      + '<div class="campaign-dock-status-card">'
      + '<div class="campaign-dock-status-label">' + escapeHtml(String(kindLabels[contract.kind] || "Live Prompt")) + '</div>'
      + '<div class="campaign-dock-status-main">' + escapeHtml(String(contract.label || "Table")) + '</div>'
      + '<div class="campaign-dock-status-sub">' + escapeHtml(String(contract.summary || "")) + (contract.detail ? ' · ' + escapeHtml(String(contract.detail || "")) : '') + '</div>'
      + (contract.prompt ? '<div class="campaign-dock-status-sub" style="margin-top:.16rem;">' + escapeHtml(String(contract.prompt || "")) + '</div>' : '')
      + (actionsHtml ? '<div class="campaign-dock-roll-actions">' + actionsHtml + '</div>' : '')
      + '</div>';
  }

  function renderGlobalQuickAccess() {
    var root = document.getElementById("globalQuickAccess");
    if (!root) return;
    if (!state.code) {
      root.innerHTML = "";
      root.classList.remove("is-active");
      root.style.display = "none";
      root.hidden = true;
      state.lastGlobalQuickAccessHash = "";
      return;
    }

    var shared = getCampaignSharedState();
    var contract = getCampaignLiveActionContract(shared, state.campaign || {});
    var soundtrackChip = contract.soundtrackLabel
      ? ('<span class="table-rail-chip is-gold">Music · ' + escapeHtml(contract.soundtrackLabel) + '</span>')
      : '';
    var chips = ''
      + '<span class="table-rail-chip is-teal">Code · ' + escapeHtml(state.code || "-") + '</span>'
      + '<span class="table-rail-chip">Role · ' + escapeHtml(state.role === "gm" ? "GM" : "Player") + '</span>'
      + '<span class="table-rail-chip is-' + escapeHtml(state.syncHealth || "muted") + '">Sync · ' + escapeHtml(String(state.syncText || state.syncHealth || "idle")) + '</span>'
      + '<span class="table-rail-chip">Scene · ' + escapeHtml(String(contract.tableStateKey === "combat" ? "Combat" : contract.tableStateLabel || "Exploration")) + '</span>'
      + (contract.vttOpen ? '<span class="table-rail-chip is-teal">Shared VTT</span>' : '')
      + (contract.pendingActiveCount > 0 ? '<span class="table-rail-chip">Checks · ' + contract.pendingActiveCount + '</span>' : '')
      + soundtrackChip;
    var buttonsHtml = renderCampaignActionButtons(contract.actions, { limit: 4, sizeClass: "btn-sm" });
    var hash = JSON.stringify({
      code: state.code,
      role: state.role,
      syncText: state.syncText,
      syncHealth: state.syncHealth,
      contract: {
        kind: contract.kind,
        id: contract.id,
        label: contract.label,
        summary: contract.summary,
        detail: contract.detail,
        prompt: contract.prompt,
        tone: contract.tone,
        pendingActiveCount: contract.pendingActiveCount,
        vttOpen: contract.vttOpen,
        soundtrackLabel: contract.soundtrackLabel,
        actionKeys: (Array.isArray(contract.actions) ? contract.actions : []).map(function (action) {
          return String(action && action.label || "") + "|" + String(action && action.onclick || "");
        })
      }
    });
    if (hash === state.lastGlobalQuickAccessHash) return;
    state.lastGlobalQuickAccessHash = hash;
    root.hidden = false;
    root.style.display = "";
    root.classList.add("is-active");
    root.innerHTML = ''
      + '<span class="qa-label">Table</span>'
      + '<div class="table-rail-copy">'
      + '<div class="table-rail-title">' + escapeHtml(String(contract.label || "Table Ready")) + '</div>'
      + '<div class="table-rail-sub">' + escapeHtml(String(contract.summary || "")) + (contract.detail ? ' · ' + escapeHtml(String(contract.detail || "")) : '') + '</div>'
      + (contract.prompt ? '<div class="table-rail-sub is-muted">' + escapeHtml(String(contract.prompt || "")) + '</div>' : '')
      + '</div>'
      + '<div class="table-rail-chip-row">' + chips + '</div>'
      + (buttonsHtml ? '<div class="table-rail-actions">' + buttonsHtml + '</div>' : '');
  }

  function renderDockPanel() {
    var root = document.getElementById("campaignDock");
    if (!root) {
      renderGlobalQuickAccess();
      applyGlobalSceneFocus("");
      return;
    }
    root.classList.toggle("open", !!state.dockOpen);
    syncDockOffset(root);

    var badge = document.getElementById("campaignDockBadge");
    var scene = document.getElementById("campaignDockScene");
    var meta = document.getElementById("campaignDockMeta");
    var liveStatus = document.getElementById("campaignDockLiveStatus");
    var timeline = document.getElementById("campaignDockTimeline");
    var roll = document.getElementById("campaignDockRoll");
    var filters = document.getElementById("campaignDockFilters");
    var trigger = document.getElementById("campaignDockTrigger");
    var lock = document.getElementById("campaignDockLock");
    var timelineActions = document.getElementById("campaignDockTimelineActions");

    var campaign = state.campaign;
    var active = campaign && campaign.activeRollRequest;
    var shared = getCampaignSharedState();
    var tableState = getCampaignTableState(shared);
    var readyCheck = shared && shared.readyCheck && typeof shared.readyCheck === "object"
      ? shared.readyCheck
      : ensureReadyCheckState(shared);
    var combatState = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
      ? shared.campaignCombat
      : ensureCampaignCombatState(shared);
    var sceneState = resolveTableSceneState(shared, tableState, campaign);
    var sceneMode = String(sceneState && sceneState.effective || "exploration");
    var sceneDescriptor = sceneState && sceneState.descriptor ? sceneState.descriptor : getTableSceneDescriptor(sceneMode);
    var liveAction = getCampaignLiveActionContract(shared, campaign || {});

    root.classList.toggle("campaign-scene-narrative", sceneMode === "narrative");
    root.classList.toggle("campaign-scene-exploration", sceneMode === "exploration");
    root.classList.toggle("campaign-scene-combat", sceneMode === "combat");
    applyGlobalSceneFocus(sceneMode);
    state.effectiveTableSceneMode = sceneMode;
    if (state.tableSceneMode === "auto") {
      applySceneTimelinePreset(sceneMode, false);
    }
    renderGlobalQuickAccess();

    var dockToggle = document.getElementById("campaignDockToggle");
    if (dockToggle) {
      dockToggle.textContent = "Campaign · " + String(sceneDescriptor.shortLabel || "Table");
      dockToggle.title = "Table focus: " + String(sceneDescriptor.label || sceneMode);
    }

    if (scene) {
      scene.innerHTML = "";
      scene.setAttribute("hidden", "hidden");
    }

    if (badge) {
      var dockMode = getTableBadgeTone(tableState);
      badge.textContent = String(tableState && tableState.label || "Exploration");
      badge.className = "campaign-dock-badge " + dockMode;
    }

    if (meta) {
      var roleLabel = state.role === "gm" ? "GM" : (state.role ? "Player" : "-");
      meta.innerHTML = ""
        + '<span>Code <strong>' + escapeHtml(state.code || "-") + "</strong></span>"
        + '<span>Role <strong>' + escapeHtml(roleLabel) + "</strong></span>"
        + '<span>Sync <strong>' + escapeHtml(String(state.syncText || state.syncHealth || "idle")) + "</strong></span>"
        + '<span>TMW <strong>' + String(campaign && campaign.shared ? Number(campaign.shared.tmw || 0) : getTmwValue()) + "</strong></span>";
    }

    if (lock) {
      var cameraOn = isStrictGmCameraLockEnabled(shared);
      if (state.role === "player" && cameraOn) {
        lock.innerHTML = '<div class="campaign-dock-empty" style="text-align:left;border:1px solid rgba(232,192,80,.42);background:rgba(232,192,80,.1);color:var(--text2);">'
          + '<strong style="color:var(--gold2);">GM Camera Lock:</strong> Map tabs follow GM. '
          + 'Character tab remains available for your decisions.'
          + '</div>';
      } else {
        lock.innerHTML = "";
      }
    }

    if (liveStatus) {
      var actor = getCampaignCombatActorSummary(combatState);
      var readyRequiredCount = Array.isArray(readyCheck.requiredTokens) ? readyCheck.requiredTokens.length : 0;
      var readyResponseCount = getReadyCheckResponseCount(readyCheck);
      var readyStatus = String(readyCheck.status || "idle");
      var canRespondReady = !!(state.token && readyCheck && readyCheck.responses && !readyCheck.responses[state.token]);
      var cards = [];

      cards.push(renderCampaignDockLiveActionCard(liveAction));

      if (actor.active && liveAction.kind !== "turn-prompt" && liveAction.kind !== "enemy-action") {
        var now = Date.now();
        var enemyRequest = getCampaignEnemyActionRequest(combatState);
        if (actor.key && actor.key !== state.lastDockActorKey) {
          state.lastDockActorKey = actor.key;
          state.dockActorFlashUntil = now + 3200;
        }
        var actorCardClass = "campaign-dock-status-card" + (state.dockActorFlashUntil > now ? " is-flash" : "");
        var actorTurnText = actor.isPrompt
          ? "GM is choosing who goes next"
          : (actor.isMe
            ? "your call to act"
            : (actor.isEnemy
              ? (enemyRequest
                ? (String(enemyRequest.status || "pending") === "resolved"
                  ? "enemy action resolved; GM can prompt again or end the round"
                  : (String(enemyRequest.mode || "single") === "aoe"
                    ? ("AOE targeting " + String(enemyRequest.rangeBand || "close").toUpperCase() + " lane")
                    : ("targeting " + String(enemyRequest.targetName || "a Wayfarer"))))
                : "GM is lining up the next enemy action")
              : "waiting on that wayfarer"));
        cards.push(''
          + '<div class="' + actorCardClass + '">'
          + '<div class="campaign-dock-status-label">Current Actor</div>'
          + '<div class="campaign-dock-status-main">' + escapeHtml(actor.name)
          + (actor.isPrompt ? ' <span class="campaign-dock-status-tag ally">Prompt</span>' : (actor.isEnemy ? ' <span class="campaign-dock-status-tag enemy">Enemy</span>' : ' <span class="campaign-dock-status-tag ally">Wayfarer</span>'))
          + (actor.isMe ? ' <span class="campaign-dock-status-tag ally">Your Turn</span>' : '')
          + '</div>'
          + '<div class="campaign-dock-status-sub">Round ' + actor.round + ' · Turn ' + actor.index + '/' + actor.total + (actor.hasActed ? ' · already acted' : ' · ' + escapeHtml(actorTurnText)) + '</div>'
          + '</div>');
      } else {
        state.lastDockActorKey = "";
        state.dockActorFlashUntil = 0;
      }

      if (readyCheck && readyCheck.id && readyStatus !== "idle" && liveAction.kind !== "ready-check") {
        cards.push(''
          + '<div class="campaign-dock-status-card">'
          + '<div class="campaign-dock-status-label">Ready Check</div>'
          + '<div class="campaign-dock-status-main">' + escapeHtml(String(readyCheck.label || "Shared action")) + '</div>'
          + '<div class="campaign-dock-status-sub">' + escapeHtml(readyStatus) + ' · ' + readyResponseCount + '/' + readyRequiredCount + ' responses</div>'
          + (readyStatus === "pending" && canRespondReady
            ? '<div class="campaign-dock-roll-actions"><button class="btn btn-xs btn-teal" onclick="window.campaignSystem.respondReadyCheck(true)">Ready</button><button class="btn btn-xs btn-red" onclick="window.campaignSystem.respondReadyCheck(false)">Not Ready</button></div>'
            : '')
          + (readyStatus === "pending" && state.role === "gm"
            ? '<div class="campaign-dock-roll-actions"><button class="btn btn-xs btn-teal" onclick="window.campaignSystem.forceApproveReadyCheck()">Force Approve</button><button class="btn btn-xs" onclick="window.campaignSystem.cancelReadyCheck()">Cancel</button></div>'
            : '')
          + '</div>');
      }

      liveStatus.innerHTML = cards.length
        ? ('<div class="campaign-dock-status-grid">' + cards.filter(Boolean).join("") + '</div>')
        : '<div class="campaign-dock-empty">No active initiative or ready check.</div>';
    }

    if (roll) {
      if (!active) {
        roll.innerHTML = '<div class="campaign-dock-empty">No active GM roll request.</div>';
      } else {
        var activeTargetToken = String(active.targetToken || "");
        var canRoll = state.role !== "gm" && (!activeTargetToken || String(state.token || "") === activeTargetToken);
        var targetSuffix = activeTargetToken
          ? (' · Target ' + escapeHtml(String(active.targetName || activeTargetToken)))
          : "";
        var responseCount = Array.isArray(active.responses) ? active.responses.length : 0;
        roll.innerHTML = ""
          + '<div class="campaign-dock-roll-line">'
          + '<span><strong>' + escapeHtml(active.label || "Dread Check") + '</strong> · ' + escapeHtml(String(active.stat || "valor").toUpperCase()) + ' vs d' + Number(active.dread || 8) + targetSuffix + '</span>'
          + '<span>' + responseCount + ' response' + (responseCount === 1 ? "" : "s") + '</span>'
          + "</div>"
          + (canRoll
            ? '<div class="campaign-dock-roll-actions"><button class="btn btn-xs btn-teal" onclick="window.campaignSystem.openActiveRollPrompt()">Open Roll Prompt</button></div>'
            : (state.role === "gm"
              ? '<div class="campaign-dock-roll-actions"><button class="btn btn-xs" onclick="window.campaignSystem.closeActiveRoll()">Close Active</button></div>'
              : '<div class="campaign-dock-roll-actions"><span class="campaign-dock-empty">Waiting on target.</span></div>'));
      }
    }

    if (filters) {
      if (state.role === "gm") {
        var modes = [
          { id: "all", label: "All" },
          { id: "chat", label: "Chat" },
          { id: "roll", label: "Rolls" },
          { id: "system", label: "System" },
          { id: "recap", label: "Recap" }
        ];
        if (sceneMode === "narrative") {
          modes = [
            { id: "all", label: "All" },
            { id: "chat", label: "Chat" },
            { id: "system", label: "System" }
          ];
        } else if (sceneMode === "exploration") {
          modes = [
            { id: "all", label: "All" },
            { id: "chat", label: "Chat" },
            { id: "system", label: "System" },
            { id: "recap", label: "Recap" }
          ];
        } else if (sceneMode === "combat") {
          modes = [
            { id: "all", label: "All" },
            { id: "roll", label: "Rolls" },
            { id: "chat", label: "Chat" },
            { id: "system", label: "System" }
          ];
        }
        filters.innerHTML = modes.map(function (m) {
          var on = state.timelineFilter === m.id;
          return '<button class="btn btn-xs ' + (on ? 'btn-teal' : '') + '" onclick="window.campaignSystem.setTimelineFilter(\'' + m.id + '\')">' + m.label + '</button>';
        }).join("");
      } else {
        filters.innerHTML = "";
      }
    }

    if (trigger) {
      var allLog = campaign && Array.isArray(campaign.log) ? campaign.log : [];
      var triggerRows = allLog.filter(function (entry) {
        var text = String(entry && entry.text || "");
        return text.indexOf("GM Trigger Debug") >= 0 || text.indexOf("Trigger:") >= 0 || text.indexOf("hex-enter") >= 0;
      });
      if (state.role === "gm" && triggerRows.length) {
        var latest = triggerRows[triggerRows.length - 1] || {};
        trigger.innerHTML = ''
          + '<div class="campaign-dock-roll-line">'
          + '<span><strong>GM Trigger Debug</strong></span>'
          + '<span>' + escapeHtml(formatTimestamp(latest.at)) + '</span>'
          + '</div>'
          + '<div class="campaign-dock-empty" style="text-align:left;">' + escapeHtml(String(latest.text || "No trigger details.")) + '</div>';
      } else {
        trigger.innerHTML = "";
      }
    }

    if (timeline) {
      var oldScrollBottom = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
      var combinedSource = buildDockTimelineSource(
        campaign && campaign.log ? campaign.log : [],
        shared && Array.isArray(shared.sessionTimeline) ? shared.sessionTimeline : []
      );
      var filtered = filterTimeline(combinedSource);
      var latestEntry = filtered.length ? filtered[filtered.length - 1] : null;
      var latestEntryKey = latestEntry ? getTimelineEntryKey(latestEntry) : "";
      var hasNewEntry = !!(latestEntryKey && latestEntryKey !== state.lastDockTimelineEntryKey);
      var shouldStickToBottom = !state.dockTimelinePinned && oldScrollBottom < 52;
      timeline.innerHTML = renderDockTimeline(filtered);
      if (!timeline._campaignScrollBound) {
        timeline.addEventListener("scroll", function () {
          var distance = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
          var nearBottom = distance < 44;
          if (nearBottom) {
            if (state.dockTimelinePinned || state.dockTimelineUnseen) {
              state.dockTimelinePinned = false;
              state.dockTimelineUnseen = 0;
              renderDockPanel();
            }
            return;
          }
          state.dockTimelinePinned = true;
        });
        timeline._campaignScrollBound = true;
      }
      var newLogSize = campaign && Array.isArray(campaign.log) ? campaign.log.length : 0;
      if (shouldStickToBottom || (newLogSize !== state.lastDockLogSize && oldScrollBottom < 120 && !state.dockTimelinePinned)) {
        timeline.scrollTop = timeline.scrollHeight;
        state.dockTimelineUnseen = 0;
      } else if (hasNewEntry && state.dockTimelinePinned) {
        state.dockTimelineUnseen = Math.min(99, Number(state.dockTimelineUnseen || 0) + 1);
      }
      state.lastDockLogSize = newLogSize;
      state.lastDockTimelineEntryKey = latestEntryKey;
    }

    if (timelineActions) {
      var badge = state.dockTimelineUnseen > 0 ? (' <span class="campaign-dock-unseen-badge">+' + state.dockTimelineUnseen + '</span>') : "";
      timelineActions.innerHTML = ""
        + '<button class="btn btn-xs ' + (state.dockTimelinePinned ? 'btn-teal' : '') + '" onclick="window.campaignSystem.toggleDockTimelinePin()">'
        + (state.dockTimelinePinned ? 'Auto-scroll Off' : 'Auto-scroll On')
        + '</button>'
        + '<button class="btn btn-xs" onclick="window.campaignSystem.jumpDockTimelineLatest()">Jump To Latest' + badge + '</button>';
    }

    if (window.accessibilityI18n && typeof window.accessibilityI18n.schedulePageTranslation === "function") {
      try { window.accessibilityI18n.schedulePageTranslation(root); } catch (_err) {}
    }
  }

  function toggleDockTimelinePin() {
    state.dockTimelinePinned = !state.dockTimelinePinned;
    if (!state.dockTimelinePinned) state.dockTimelineUnseen = 0;
    renderDockPanel();
  }

  function jumpDockTimelineLatest() {
    var timeline = document.getElementById("campaignDockTimeline");
    if (timeline) {
      timeline.scrollTop = timeline.scrollHeight;
    }
    state.dockTimelinePinned = false;
    state.dockTimelineUnseen = 0;
    renderDockPanel();
  }

  function syncDockOffset(root) {
    var target = root || document.getElementById("campaignDock");
    if (!target) return;
    var panel = document.getElementById("settingsPanel");
    var settingsOpen = !!(panel && panel.classList.contains("open"));
    target.classList.toggle("settings-open", settingsOpen && window.innerWidth > 700);
  }

  function readUiValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "") : "";
  }

  async function attemptAutoRestore(force) {
    if (!state.socket || !state.connected || state.restoringSession) return;
    if (!force && state.autoRestoreTried) return;
    if (!force) state.autoRestoreTried = true;

    var session = loadSession({ source: "session" });
    if (!session || !session.code) return;

    state.restoringSession = true;
    var res = await emitWithAck("campaign:join", {
      code: session.code,
      token: session.token,
      name: session.name || ensureName(),
      role: session.role === "gm" ? "gm" : "player"
    });
    state.restoringSession = false;

    if (!res.ok) {
      state.uiDraft.name = session.name || state.uiDraft.name || ensureName();
      state.uiDraft.code = session.code;
      state.uiDraft.joinPassword = "";
      markSessionRestoreFailure(session, res.error || "Saved campaign session could not be restored.");
      safeNotif((res.error || "Saved campaign session could not be restored.") + " Use Resume or Rejoin in Settings > Campaign.", "warn");
      renderSettingsSection();
      renderDockPanel();
      return;
    }

    state.code = res.code;
    state.role = res.role;
    state.token = String(res.token || "");
    state.playerName = String(res.name || session.name || ensureName());
    state.activePromptId = "";
    state.sessionPersistenceSuppressed = false;
    persistSession();

    refreshSettingsModeFromCampaign();
    maybePrimePlayerDock();

    safeNotif("Restored campaign " + res.code + " as " + (res.role === "gm" ? "GM" : "Player") + ".", "good");
    renderSettingsSection();
    renderDockPanel();
  }

  function ensureSocket() {
    if (!canUseSockets()) {
      return false;
    }
    if (state.socket) return true;

    state.socket = window.io({ transports: ["websocket", "polling"] });

    state.socket.on("connect", function () {
      state.connected = true;
      syncWindowStateAlias();
      state.lastCampaignStateAt = Date.now();
      if (state.code) {
        state.waitingReconnectSnapshot = true;
        if (!state.reconnectGraceUntil) state.reconnectGraceUntil = Date.now() + STALE_SYNC_MS;
      }
      setSyncHealth("online", "Connected");
      renderSettingsSection();
      renderDockPanel();
      attemptAutoRestore(!!state.code);
      syncCharacterToCampaign(true);
    });

    state.socket.on("disconnect", function () {
      state.connected = false;
      state.lastDisconnectAt = Date.now();
      state.reconnectGraceUntil = state.lastDisconnectAt + STALE_SYNC_MS;
      if (state.code) state.waitingReconnectSnapshot = true;
      setSyncHealth(state.code ? "stale" : "offline", state.code ? "Reconnecting (" + Math.max(0, Math.ceil(STALE_SYNC_MS / 1000)) + "s)" : "Offline");
      renderSettingsSection();
      renderDockPanel();
    });

    state.socket.on("campaign:state", function (snapshot) {
      syncWindowStateAlias();
      var previousSharedState = getCampaignSharedState();
      var incomingVersion = snapshot && snapshot.shared ? Number(snapshot.shared.stateVersion || 0) : 0;
      state.lastServerStateVersion = Math.max(state.lastServerStateVersion, incomingVersion);
      if (incomingVersion && state.lastSharedVersion && incomingVersion < state.lastSharedVersion) {
        setSyncHealth("stale", "Reconciling...");
        maybeDeterministicReconcile("version-drift");
        return;
      }

      state.campaign = snapshot || null;
      state.code = snapshot && snapshot.code ? String(snapshot.code) : "";
      state.lastCampaignStateAt = Date.now();
      state.waitingReconnectSnapshot = false;
      state.reconnectGraceUntil = 0;

      if (snapshot && snapshot.me) {
        state.role = snapshot.me.role === "gm" ? "gm" : "player";
        if (snapshot.me.token) {
          state.token = String(snapshot.me.token);
          persistSession();
        }
      }
      if (snapshot && snapshot.shared && snapshot.shared.updatedAt) {
        state.lastAuthoritativeAt = Number(snapshot.shared.updatedAt || 0) || state.lastAuthoritativeAt;
      }

      var nextTmw = snapshot && snapshot.shared ? Number(snapshot.shared.tmw || 0) : null;
      if (nextTmw !== null && nextTmw !== getTmwValue()) {
        setLocalTmw(nextTmw);
      }

      applySharedState(
        snapshot && snapshot.shared ? snapshot.shared.state : null,
        snapshot && snapshot.shared ? snapshot.shared.stateVersion : 0,
        previousSharedState
      );

      if ((!window.S.rival || typeof window.S.rival !== "object")
        && snapshot && snapshot.shared && snapshot.shared.state
        && snapshot.shared.state.rival && typeof snapshot.shared.state.rival === "object") {
        window.S.rival = deepCloneJson(snapshot.shared.state.rival) || {};
      }

      if (incomingVersion >= state.lastSharedVersion) {
        state.syncConflictCount = 0;
        state.lastSyncConflicts = [];
      }

      refreshSettingsModeFromCampaign();
      maybePrimePlayerDock();
      if (state.connected) {
        state.lastSyncAt = Date.now();
        refreshSyncHealth();
      }

      var hadActivePrompt = !!state.activePromptId;
      if (!(snapshot && snapshot.activeRollRequest && snapshot.activeRollRequest.id)) {
        state.activePromptId = "";
        if (hadActivePrompt && state.role === "player" && typeof window.closeModal === "function") {
          window.closeModal();
        }
      }
      maybeAutoResolveActiveRoll(snapshot && snapshot.activeRollRequest ? snapshot.activeRollRequest : null).catch(function () {});
      maybePromptActiveRoll(snapshot && snapshot.activeRollRequest ? snapshot.activeRollRequest : null);
      applyAuthoritativeSelfCharacterFromSnapshot(snapshot || null);
      renderSettingsSection();
      renderDockPanel();
      syncCharacterToCampaign(false);
      if (state.role === "gm") {
        closeCampaignOnboardingIfOpen();
      } else {
        showOnboarding(false);
      }
    });

    state.socket.on("campaign:resyncRequested", function (payload) {
      if (state.role !== "gm" || !state.code || !state.connected) return;
      syncWindowStateAlias();
      state.lastResyncRequester = payload && payload.requesterName ? String(payload.requesterName) : "Player";
      state.lastResyncRequestAt = Number(payload && payload.requestedAt || Date.now()) || Date.now();
      syncSharedSilent("gm-authoritative-resync-request").then(function (res) {
        state.lastAutoRebroadcastAt = Date.now();
        state.lastAutoRebroadcastOk = !!(res && res.ok);
        state.lastAutoRebroadcastError = (res && res.ok)
          ? ""
          : String((res && res.error) || "rebroadcast failed");
        renderSettingsSection();
        if (!res || !res.ok) {
          safeNotif("Auto-rebroadcast failed: " + state.lastAutoRebroadcastError + ".", "warn");
          return;
        }
        var requester = payload && payload.requesterName ? String(payload.requesterName) : "Player";
        safeNotif("Authoritative resync sent for " + requester + ".", "good");
      }).catch(function () {});
      renderSettingsSection();
    });

    state.socket.on("campaign:notice", function (payload) {
      if (!payload || typeof payload !== "object") return;
      var text = String(payload.text || "").trim();
      if (!text) return;
      var isTriggerDebug = text.indexOf("GM Trigger Debug") >= 0
        || text.indexOf("Trigger:") >= 0
        || text.indexOf("hex-enter") >= 0;
      if (isTriggerDebug) return;
      var sourceToken = String(payload.sourceToken || "");
      if (sourceToken && state.token && sourceToken === state.token) return;

      var kind = String(payload.kind || "system");
      var tone = "info";
      if (kind === "roll" || kind === "roll-result") tone = "good";
      else if (kind === "tmw") tone = "good";
      else if (kind === "chat") tone = "info";
      else if (kind === "system") tone = "info";

      safeNotif("Campaign: " + text, tone);
    });

    state.socket.on("campaign:deleted", function (payload) {
      var code = payload && payload.code ? String(payload.code) : state.code;
      state.code = "";
      state.role = "";
      state.token = "";
      state.campaign = null;
      state.activePromptId = "";
      state.lastAppliedPartyRestEventId = "";
      state.uiDraft.code = "";
      state.uiDraft.joinPassword = "";
      state.lastPlayerDockSeed = "";
      clearSession();
      refreshSettingsModeFromCampaign();
      safeNotif((code ? ("Campaign " + code + " was deleted by GM.") : "Campaign deleted by GM."), "warn");
      renderSettingsSection();
      renderDockPanel();
    });

    return true;
  }

  function labelConditionName(key) {
    var txt = String(key || "").trim();
    return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : "";
  }

  function getCampaignRollPoolConditionMap(statKey) {
    var key = String(statKey || "valor").trim().toLowerCase();
    if (key === "body" || key === "strike" || key === "shoot") {
      return { positive: "empowered", negative: "weakened", pool: "Body / Strike / Shoot" };
    }
    if (key === "mind" || key === "control") {
      return { positive: "focused", negative: "distracted", pool: "Mind / Control" };
    }
    if (key === "spirit" || key === "lead") {
      return { positive: "bolstered", negative: "shaken", pool: "Spirit / Lead" };
    }
    return { positive: "protected", negative: "vulnerable", pool: "Defend" };
  }

  function summarizeCampaignRollBonusPack(pack) {
    var source = pack && typeof pack === "object" ? pack : {};
    var parts = [];
    var advDice = Array.isArray(source.advDice) ? source.advDice : [];
    var flat = Number(source.flat || 0);
    var addValor = Math.max(0, Number(source.addValor || 0) || 0);
    if (advDice.length) {
      parts.push(advDice.map(function (die) { return "Ad" + Number(die || 0); }).join(", "));
    }
    if (flat) parts.push((flat > 0 ? "+" : "") + flat);
    if (addValor) parts.push("+" + addValor + " V.D.");
    if (source.holyShield) parts.push("Holy Shield");
    return parts.join(" | ");
  }

  function hasCampaignRollBonusPack(pack) {
    var source = pack && typeof pack === "object" ? pack : {};
    return !!(
      (Array.isArray(source.advDice) && source.advDice.length) ||
      Number(source.flat || 0) ||
      Number(source.addValor || 0) ||
      source.holyShield
    );
  }

  function getCampaignRollInventoryEntries(statKey) {
    if (typeof window.getInventoryRollBonusEntriesForStat !== "function") return [];
    var out = window.getInventoryRollBonusEntriesForStat(statKey);
    return Array.isArray(out) ? out : [];
  }

  function getCampaignRollHackEntries(statKey) {
    var key = String(statKey || "valor").trim().toLowerCase();
    if (key !== "control") return [];
    var owned = (typeof window.S !== "undefined" && window.S && Array.isArray(window.S.ownedHacks))
      ? window.S.ownedHacks.filter(Boolean)
      : [];
    var catalog = (typeof window.SHOP_DATA !== "undefined" && window.SHOP_DATA && Array.isArray(window.SHOP_DATA.os_hacks))
      ? window.SHOP_DATA.os_hacks
      : [];
    return owned.map(function (name, idx) {
      var label = String(name || "").trim();
      var match = catalog.find(function (entry) {
        return entry && String(entry.name || "").trim().toLowerCase() === label.toLowerCase();
      }) || null;
      return {
        id: "hack:" + idx,
        name: label,
        detail: match ? String(match.desc || "") : ""
      };
    }).filter(function (entry) {
      return !!entry.name;
    });
  }

  function getCampaignSelectedInventoryEntries(statKey, selections, sources) {
    var opts = selections && typeof selections === "object" ? selections : {};
    var selectedIds = Array.isArray(opts.inventorySelectionIds)
      ? opts.inventorySelectionIds.map(function (id) { return String(id || "").trim(); }).filter(Boolean)
      : [];
    if (!selectedIds.length) return [];
    var selectedMap = {};
    selectedIds.forEach(function (id) { selectedMap[id] = true; });
    var entries = sources && Array.isArray(sources.inventoryEntries)
      ? sources.inventoryEntries
      : getCampaignRollInventoryEntries(statKey);
    return entries.filter(function (entry) {
      return !!(entry && selectedMap[String(entry.id || "")]);
    });
  }

  function summarizeCampaignInventoryEntrySelections(entries) {
    var list = Array.isArray(entries) ? entries : [];
    return list.map(function (entry) {
      var label = String(entry && entry.label || "Item");
      var itemText = String(entry && entry.itemText || "").trim();
      var summary = String(entry && entry.summary || "").trim().replace(/\s*\|\s*/g, " · ");
      var head = itemText ? (label + " · " + itemText) : label;
      return summary ? (head + " (" + summary + ")") : head;
    }).join(" · ");
  }

  function getCampaignSelectedHackNames(selections, sources) {
    var opts = selections && typeof selections === "object" ? selections : {};
    var selectedIds = Array.isArray(opts.hackSelectionIds)
      ? opts.hackSelectionIds.map(function (id) { return String(id || "").trim(); }).filter(Boolean)
      : [];
    if (!selectedIds.length) return [];
    var selectedMap = {};
    selectedIds.forEach(function (id) { selectedMap[id] = true; });
    var hacks = sources && Array.isArray(sources.hackEntries)
      ? sources.hackEntries
      : getCampaignRollHackEntries("");
    return hacks.filter(function (entry) {
      return !!(entry && selectedMap[String(entry.id || "")]);
    }).map(function (entry) {
      return String(entry && entry.name || "").trim();
    }).filter(Boolean);
  }

  function getCampaignPromptBonusSources(statKey) {
    var key = String(statKey || "valor").trim().toLowerCase();
    var flavorName = String((typeof window.S !== "undefined" && window.S && window.S.flavor) || "").trim();
    var mutationName = String((typeof window.S !== "undefined" && window.S && window.S.mutation) || "").trim();
    var flavor = (typeof window.getFlavorBonus === "function")
      ? (window.getFlavorBonus(key) || { flat: 0, advDice: [], holyShield: false })
      : { flat: 0, advDice: [], holyShield: false };
    var mutation = (typeof window.getMutationBonus === "function")
      ? (window.getMutationBonus(key) || { flat: 0, advDice: [] })
      : { flat: 0, advDice: [] };
    var inventoryEntries = getCampaignRollInventoryEntries(key);
    var inventory = (typeof window.collectInventoryBonusesForStat === "function")
      ? (window.collectInventoryBonusesForStat(key) || { advDice: [], flat: 0, addValor: 0, notes: [] })
      : { advDice: [], flat: 0, addValor: 0, notes: [] };
    var hackEntries = getCampaignRollHackEntries(key);
    return {
      key: key,
      flavorName: flavorName,
      flavor: flavor,
      mutationName: mutationName,
      mutation: mutation,
      inventoryEntries: inventoryEntries,
      inventory: inventory,
      hackEntries: hackEntries,
      hasFlavorChoice: !!flavorName,
      hasFlavor: hasCampaignRollBonusPack(flavor),
      hasMutationChoice: !!mutationName,
      hasMutation: hasCampaignRollBonusPack(mutation),
      hasInventory: !!inventoryEntries.length || hasCampaignRollBonusPack(inventory),
      hasHackChoice: !!hackEntries.length
    };
  }

  function getCampaignPromptSelections() {
    var useFlavorEl = document.getElementById("campaignRollUseFlavor");
    var useMutationEl = document.getElementById("campaignRollUseMutation");
    var useInventoryEl = document.getElementById("campaignRollUseInventory");
    var pushLuckEl = document.getElementById("campaignRollUsePushLuck");
    var inventorySelectionIds = Array.prototype.slice.call(
      document.querySelectorAll("[data-campaign-roll-inventory]:checked")
    ).map(function (el) {
      return String(el && el.value || "").trim();
    }).filter(Boolean);
    var hackSelectionIds = Array.prototype.slice.call(
      document.querySelectorAll("[data-campaign-roll-hack]:checked")
    ).map(function (el) {
      return String(el && el.value || "").trim();
    }).filter(Boolean);
    return {
      useFlavor: !useFlavorEl || !!useFlavorEl.checked,
      useMutation: !useMutationEl || !!useMutationEl.checked,
      useInventory: !!((useInventoryEl && useInventoryEl.checked) || inventorySelectionIds.length),
      inventorySelectionIds: inventorySelectionIds,
      hackSelectionIds: hackSelectionIds,
      pushLuck: !!(pushLuckEl && pushLuckEl.checked)
    };
  }

  function buildCampaignActiveRollManualLines(statKey, request, selections, sources, pushLuckDread) {
    var lines = [];
    var key = String(statKey || "valor").trim().toLowerCase();
    var opts = selections && typeof selections === "object" ? selections : {};
    var sourcePack = sources && typeof sources === "object" ? sources : getCampaignPromptBonusSources(key);
    if (sourcePack.hasFlavorChoice) {
      if (sourcePack.hasFlavor) {
        lines.push((opts.useFlavor ? "Apply" : "Ignore") + " Personal Flavor (" + sourcePack.flavorName + "): " + summarizeCampaignRollBonusPack(sourcePack.flavor) + ".");
      } else {
        lines.push((opts.useFlavor ? "Invoke" : "Ignore") + " Personal Flavor: " + sourcePack.flavorName + ".");
      }
    }
    if (sourcePack.hasMutationChoice) {
      if (sourcePack.hasMutation) {
        lines.push((opts.useMutation ? "Apply" : "Ignore") + " Mutation (" + sourcePack.mutationName + "): " + summarizeCampaignRollBonusPack(sourcePack.mutation) + ".");
      } else {
        lines.push((opts.useMutation ? "Invoke" : "Ignore") + " Mutation: " + sourcePack.mutationName + ".");
      }
    }
    if (sourcePack.hasInventory) {
      var selectedEntries = getCampaignSelectedInventoryEntries(key, opts, sourcePack);
      var selectedInventorySummary = summarizeCampaignInventoryEntrySelections(selectedEntries);
      var inventorySummary = summarizeCampaignRollBonusPack(sourcePack.inventory);
      if (opts.useInventory) {
        if (selectedInventorySummary) {
          lines.push("Apply chosen item bonus: " + selectedInventorySummary + ".");
        } else {
          lines.push("Apply chosen item bonus: " + inventorySummary + (sourcePack.inventory.notes && sourcePack.inventory.notes.length ? " (" + sourcePack.inventory.notes.join(" · ") + ")." : "."));
        }
      } else {
        lines.push("Optional item bonus available: " + inventorySummary + (sourcePack.inventory.notes && sourcePack.inventory.notes.length ? " (" + sourcePack.inventory.notes.join(" · ") + ")." : "."));
      }
    }
    if (sourcePack.hasHackChoice) {
      var hackNames = getCampaignSelectedHackNames(opts, sourcePack);
      if (hackNames.length) {
        lines.push("Selected hack / technique: " + hackNames.join(", ") + ".");
      }
    }
    if (opts.pushLuck) {
      var condMap = getCampaignRollPoolConditionMap(key);
      lines.push("Push Your Luck selected: spend 2 TMW, step Dread up to d" + Math.max(4, Number(pushLuckDread || request && request.dread || 8)) + ", gain " + labelConditionName(condMap.positive) + " on success or " + labelConditionName(condMap.negative) + " on failure.");
    }
    return lines;
  }

  function applyCampaignPushLuckCondition(statKey, success) {
    if (typeof window.S === "undefined" || !window.S || !window.S.conditions) return "";
    var condMap = getCampaignRollPoolConditionMap(statKey);
    var key = success ? condMap.positive : condMap.negative;
    if (!key) return "";
    window.S.conditions[key] = true;
    if (typeof window.updateConditionButtons === "function") window.updateConditionButtons();
    if (typeof window.updateAllStatDisplays === "function") window.updateAllStatDisplays();
    return key;
  }

  function performCampaignPromptRoll(statKey, dreadDie, selections, requestLabel) {
    var key = String(statKey || "valor").trim().toLowerCase();
    var opts = selections && typeof selections === "object" ? selections : {};
    var actionDie = Math.max(4, Number(resolveActionDie(key) || 4));
    var pushedLuck = !!opts.pushLuck;
    var finalDreadDie = pushedLuck && typeof window.stepUp === "function"
      ? Math.max(4, Number(window.stepUp(dreadDie || 8) || dreadDie || 8))
      : Math.max(4, Number(dreadDie || 8) || 8);
    var label = String(requestLabel || key || "Campaign Roll");
    var sourcePack = getCampaignPromptBonusSources(key);
    var flavorBonus = opts.useFlavor && sourcePack.hasFlavorChoice && typeof window.getFlavorBonus === "function"
      ? (window.getFlavorBonus(key) || { flat: 0, advDice: [], holyShield: false })
      : { flat: 0, advDice: [], holyShield: false };
    var mutationBonus = opts.useMutation && sourcePack.hasMutationChoice && typeof window.getMutationBonus === "function"
      ? (window.getMutationBonus(key) || { flat: 0, advDice: [] })
      : { flat: 0, advDice: [] };
    var selectedInventoryEntries = getCampaignSelectedInventoryEntries(key, opts, sourcePack);
    var selectedInventorySummary = summarizeCampaignInventoryEntrySelections(selectedInventoryEntries);
    var selectedHackNames = getCampaignSelectedHackNames(opts, sourcePack);
    var inventoryBonus = opts.useInventory && typeof window.collectInventoryBonusesForStat === "function"
      ? (window.collectInventoryBonusesForStat(key, { selectedIds: opts.inventorySelectionIds || [] }) || { advDice: [], flat: 0, addValor: 0, notes: [] })
      : { advDice: [], flat: 0, addValor: 0, notes: [] };
    var gearBonus = typeof window.getGearRollBonuses === "function"
      ? (window.getGearRollBonuses(key, actionDie) || { advDice: [], flat: 0, addDice: [], notes: [] })
      : { advDice: [], flat: 0, addDice: [], notes: [] };
    var mod = (window.S && window.S.rollMod && typeof window.S.rollMod === "object")
      ? window.S.rollMod
      : { advDice: [], flat: 0 };
    var advDiceArr = [];
    var flatBonus = 0;
    var addValorDie = false;

    if ((key === "strike" || key === "shoot" || key === "defend") && typeof window.parseWeaponBonuses === "function") {
      var weaponBonus = window.parseWeaponBonuses(key === "defend" ? "defend" : key) || { flat: 0, advDie: 0, addAdvDie: false };
      if (key === "defend" && typeof window.parseArmorAdvDie === "function") {
        var armorAdv = Number(window.parseArmorAdvDie() || 0);
        if (armorAdv > 0) advDiceArr.push(armorAdv);
      }
      if (Number(weaponBonus.advDie || 0) > 0) advDiceArr.push(Number(weaponBonus.advDie || 0));
      flatBonus += Number(weaponBonus.flat || 0);
      addValorDie = !!weaponBonus.addAdvDie;
    }

    advDiceArr = advDiceArr
      .concat(Array.isArray(flavorBonus.advDice) ? flavorBonus.advDice : [])
      .concat(Array.isArray(mutationBonus.advDice) ? mutationBonus.advDice : [])
      .concat(Array.isArray(gearBonus.advDice) ? gearBonus.advDice : [])
      .concat(Array.isArray(mod.advDice) ? mod.advDice : [])
      .concat(Array.isArray(inventoryBonus.advDice) ? inventoryBonus.advDice : []);

    flatBonus += Number(flavorBonus.flat || 0)
      + Number(mutationBonus.flat || 0)
      + Number(gearBonus.flat || 0)
      + Number(mod.flat || 0)
      + Number(inventoryBonus.flat || 0);

    var augDie = typeof window.getAugBonus === "function" ? Number(window.getAugBonus(key) || 0) : 0;
    var action = (typeof window.rollWithAdvantage === "function")
      ? window.rollWithAdvantage(actionDie, advDiceArr, { type: "action", major: true, label: label })
      : { total: Math.floor(Math.random() * actionDie) + 1, breakdown: "", exploded: false };
    var total = Number(action.total || 0) + flatBonus;
    var queuedValor = (typeof window.consumeQueuedRollModValorDice === "function")
      ? window.consumeQueuedRollModValorDice(label + " Queued Valor")
      : { total: 0, dice: [], rolls: [] };
    total += Number(queuedValor.total || 0);
    var holyShieldRoll = flavorBonus.holyShield && typeof window.explodingRoll === "function"
      ? window.explodingRoll((window.S && window.S.stats && window.S.stats.spirit) || 4, { type: "action", major: true, label: "Holy Shield" })
      : null;
    if (holyShieldRoll) total += Number(holyShieldRoll.total || 0);
    var weaponValorRoll = addValorDie && typeof window.explodingRoll === "function"
      ? window.explodingRoll((window.S && window.S.stats && window.S.stats.valor) || 4, { type: "action", major: true, label: "Weapon V.D." })
      : null;
    if (weaponValorRoll) total += Number(weaponValorRoll.total || 0);
    var inventoryValorRolls = [];
    var inventoryValorCount = Math.max(0, Number(inventoryBonus.addValor || 0) || 0);
    for (var i = 0; i < inventoryValorCount; i += 1) {
      if (typeof window.explodingRoll !== "function") break;
      var inventoryRoll = window.explodingRoll((window.S && window.S.stats && window.S.stats.valor) || 4, { type: "action", major: true, label: "Item V.D. #" + (i + 1) });
      inventoryValorRolls.push(inventoryRoll);
      total += Number(inventoryRoll.total || 0);
    }
    var gearAddRolls = Array.isArray(gearBonus.addDice)
      ? gearBonus.addDice.map(function (dieSize) {
          return typeof window.explodingRoll === "function"
            ? window.explodingRoll(Number(dieSize || 4), { type: "action", major: true, label: "Gear Bonus" })
            : { total: Math.floor(Math.random() * Math.max(4, Number(dieSize || 4))) + 1 };
        })
      : [];
    gearAddRolls.forEach(function (rollObj) { total += Number(rollObj && rollObj.total || 0); });
    var augRoll = augDie > 0 && typeof window.explodingRoll === "function"
      ? window.explodingRoll(augDie, { type: "action", major: true, label: "Augment" })
      : null;
    if (augRoll) total += Number(augRoll.total || 0);
    var relicRolls = typeof window.getPermanentValorBonusRolls === "function"
      ? (window.getPermanentValorBonusRolls(key, label + " Relic") || [])
      : [];
    if (typeof window.sumValorBonusRolls === "function") total += Number(window.sumValorBonusRolls(relicRolls) || 0);
    var radPenalty = typeof window.getRadPenaltyForStat === "function" ? Number(window.getRadPenaltyForStat(key) || 0) : 0;
    total = Math.max(0, total - radPenalty);
    var dreadRoll = typeof window.explodingRoll === "function"
      ? window.explodingRoll(finalDreadDie, { type: "dread", major: true, label: "Campaign Dread" })
      : { total: Math.floor(Math.random() * finalDreadDie) + 1 };
    var finalTotal = Math.max(0, Number(total || 0));
    var finalDreadTotal = Math.max(0, Number(dreadRoll.total || 0));
    return {
      actionDie: actionDie,
      actionTotal: finalTotal,
      dreadDie: finalDreadDie,
      dreadTotal: finalDreadTotal,
      success: finalTotal >= finalDreadTotal,
      pushLuck: pushedLuck,
      usedFlavor: !!(opts.useFlavor && sourcePack.hasFlavorChoice),
      usedMutation: !!(opts.useMutation && sourcePack.hasMutationChoice),
      usedInventory: !!opts.useInventory,
      selectedInventoryEntries: selectedInventoryEntries,
      selectedHackNames: selectedHackNames,
      conditionApplied: "",
      bonusNotes: []
        .concat((opts.useFlavor && sourcePack.hasFlavorChoice)
          ? [hasCampaignRollBonusPack(flavorBonus)
              ? ("Personal Flavor " + summarizeCampaignRollBonusPack(flavorBonus))
              : "Personal Flavor invoked"]
          : [])
        .concat((opts.useMutation && sourcePack.hasMutationChoice)
          ? [hasCampaignRollBonusPack(mutationBonus)
              ? ("Mutation " + summarizeCampaignRollBonusPack(mutationBonus))
              : "Mutation invoked"]
          : [])
        .concat(opts.useInventory
          ? [selectedInventorySummary
              ? ("Gear " + selectedInventorySummary)
              : (hasCampaignRollBonusPack(inventoryBonus)
                  ? (inventoryBonus.notes && inventoryBonus.notes.length ? inventoryBonus.notes.join(" · ") : ("Inventory " + summarizeCampaignRollBonusPack(inventoryBonus)))
                  : "Gear invoked")]
          : [])
        .concat(selectedHackNames.length ? ["Hack " + selectedHackNames.join(", ")] : [])
        .concat(pushedLuck ? ["Push Your Luck"] : []),
      detail: {
        action: action,
        dread: dreadRoll,
        queuedValor: queuedValor,
        holyShieldRoll: holyShieldRoll,
        weaponValorRoll: weaponValorRoll,
        inventoryValorRolls: inventoryValorRolls,
        gearAddRolls: gearAddRolls,
        augRoll: augRoll,
        relicRolls: relicRolls,
        radPenalty: radPenalty
      }
    };
  }

  function openActiveRollPrompt(force) {
    var activeRequest = state.campaign && state.campaign.activeRollRequest;
    if (!activeRequest || !activeRequest.id || state.role === "gm") return false;
    var targetToken = String(activeRequest.targetToken || "");
    if (targetToken && String(state.token || "") !== targetToken) return false;
    if (!force && state.activePromptId === activeRequest.id) return false;
    state.activePromptId = activeRequest.id;

    var stat = String(activeRequest.stat || "valor").trim().toLowerCase() || "valor";
    var dread = Math.max(4, Number(activeRequest.dread || 8) || 8);
    var actionDie = Math.max(4, Number(resolveActionDie(stat) || 4));
    var sources = getCampaignPromptBonusSources(stat);
    var condMap = getCampaignRollPoolConditionMap(stat);
    var manualEnabled = !!(window.settingsSystem
      && typeof window.settingsSystem.isManualRollMode === "function"
      && window.settingsSystem.isManualRollMode()
      && typeof window.openProvinceManualCheckPrompt === "function");
    var canPushLuck = getTmwValue() >= 2;
    var flavorLabel = String(sources.flavorName || "Personal Flavor").trim() || "Personal Flavor";
    var mutationLabel = String(sources.mutationName || "Mutation").trim() || "Mutation";
    var inventoryPickerHtml = "";
    if (Array.isArray(sources.inventoryEntries) && sources.inventoryEntries.length) {
      inventoryPickerHtml = '<div style="padding:.44rem .5rem;border:1px solid var(--border2);background:rgba(255,255,255,.03);border-radius:4px;">'
        + '<div style="font-size:.74rem;color:var(--gold2);margin-bottom:.22rem;"><strong>Use Item / Gear</strong></div>'
        + '<div style="display:grid;gap:.22rem;">'
        + sources.inventoryEntries.map(function (entry) {
          var id = String(entry && entry.id || "");
          var title = String(entry && entry.label || "Item");
          var text = String(entry && entry.itemText || "").trim();
          var summary = String(entry && entry.summary || "").trim();
          return '<label style="display:flex;gap:.42rem;align-items:flex-start;font-size:.76rem;color:var(--text2);">'
            + '<input type="checkbox" data-campaign-roll-inventory value="' + escapeHtml(id) + '" style="margin-top:.16rem;">'
            + '<span><strong>' + escapeHtml(title) + '</strong> · ' + escapeHtml(text)
            + (summary ? '<br><span style="font-size:.7rem;color:var(--muted2);">' + escapeHtml(summary) + '</span>' : '')
            + '</span></label>';
        }).join("")
        + '</div>'
        + '</div>';
    } else if (sources.hasInventory) {
      inventoryPickerHtml = '<label style="display:flex;gap:.42rem;align-items:flex-start;font-size:.76rem;color:var(--text2);">'
        + '<input id="campaignRollUseInventory" type="checkbox" style="margin-top:.16rem;">'
        + '<span><strong>Use Relevant Item / Gear</strong><br><span style="font-size:.7rem;color:var(--muted2);">'
        + escapeHtml((sources.inventory.notes && sources.inventory.notes.length ? sources.inventory.notes.join(" · ") + " · " : "") + summarizeCampaignRollBonusPack(sources.inventory))
        + '</span></span></label>';
    }
    var hackPickerHtml = sources.hasHackChoice
      ? ('<div style="padding:.44rem .5rem;border:1px solid var(--border2);background:rgba(255,255,255,.03);border-radius:4px;">'
        + '<div style="font-size:.74rem;color:var(--teal);margin-bottom:.22rem;"><strong>Use Hack / Technique</strong></div>'
        + '<div style="display:grid;gap:.22rem;">'
        + sources.hackEntries.map(function (entry) {
          var id = String(entry && entry.id || "");
          var name = String(entry && entry.name || "Hack");
          var detail = String(entry && entry.detail || "").trim();
          return '<label style="display:flex;gap:.42rem;align-items:flex-start;font-size:.76rem;color:var(--text2);">'
            + '<input type="checkbox" data-campaign-roll-hack value="' + escapeHtml(id) + '" style="margin-top:.16rem;">'
            + '<span><strong>' + escapeHtml(name) + '</strong>'
            + (detail ? '<br><span style="font-size:.7rem;color:var(--muted2);">' + escapeHtml(detail) + '</span>' : '<br><span style="font-size:.7rem;color:var(--muted2);">Narrative technique note for the GM.</span>')
            + '</span></label>';
        }).join("")
        + '</div>'
        + '</div>')
      : "";
    var html = ""
      + '<div style="font-size:.82rem;color:var(--muted2);margin-bottom:.42rem;">GM requested a synchronized campaign roll.</div>'
      + '<div style="font-size:.9rem;color:var(--text2);line-height:1.55;margin-bottom:.5rem;"><strong>' + escapeHtml(activeRequest.label || "Dread Check") + '</strong><br>'
      + 'Roll <strong style="color:var(--teal);">' + escapeHtml(stat.toUpperCase()) + ' d' + actionDie + '</strong> against <strong style="color:var(--red2);">Dread d' + dread + '</strong>.</div>'
      + '<div style="font-size:.74rem;color:var(--muted2);margin-bottom:.38rem;">Success grants <strong style="color:var(--green2);">+1 Successful Roll</strong>. Failure consequence equals the failed margin. Choose any relevant bonus before you roll.</div>'
      + '<div style="display:grid;gap:.28rem;margin-bottom:.46rem;">'
      + (sources.hasFlavorChoice
        ? '<label style="display:flex;gap:.42rem;align-items:flex-start;font-size:.76rem;color:var(--text2);"><input id="campaignRollUseFlavor" type="checkbox" checked style="margin-top:.16rem;"><span><strong>Use Personal Flavor</strong> · ' + escapeHtml(flavorLabel) + '<br><span style="font-size:.7rem;color:var(--muted2);">' + escapeHtml(sources.hasFlavor ? summarizeCampaignRollBonusPack(sources.flavor) : 'Narrative tag ready to invoke.') + '</span></span></label>'
        : '')
      + (sources.hasMutationChoice
        ? '<label style="display:flex;gap:.42rem;align-items:flex-start;font-size:.76rem;color:var(--text2);"><input id="campaignRollUseMutation" type="checkbox" checked style="margin-top:.16rem;"><span><strong>Use Mutation</strong> · ' + escapeHtml(mutationLabel) + '<br><span style="font-size:.7rem;color:var(--muted2);">' + escapeHtml(sources.hasMutation ? summarizeCampaignRollBonusPack(sources.mutation) : 'Narrative tag ready to invoke.') + '</span></span></label>'
        : '')
      + inventoryPickerHtml
      + hackPickerHtml
      + '<label style="display:flex;gap:.42rem;align-items:flex-start;font-size:.76rem;color:' + (canPushLuck ? 'var(--text2)' : 'var(--muted2)') + ';"><input id="campaignRollUsePushLuck" type="checkbox"' + (canPushLuck ? '' : ' disabled') + ' style="margin-top:.16rem;"><span><strong>Push Your Luck</strong> <span style="font-size:.72rem;color:var(--gold2);">(2 TMW)</span><br><span style="font-size:.7rem;color:var(--muted2);">Step Dread up to d' + (typeof window.stepUp === "function" ? Math.max(4, Number(window.stepUp(dread) || dread)) : dread) + '. On success gain ' + escapeHtml(labelConditionName(condMap.positive)) + '; on failure gain ' + escapeHtml(labelConditionName(condMap.negative)) + '.</span></span></label>'
      + '</div>'
      + '<div style="display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;">'
      + (manualEnabled ? '<button class="btn btn-sm btn-primary" onclick="window.campaignSystem.submitActiveRollManual()">Submit Manual Roll</button>' : '')
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.submitActiveRoll()">Roll Now</button>'
      + '<button class="btn btn-sm" onclick="closeModal()">Later</button>'
      + "</div>";

    if (typeof window.openModal === "function") {
      window.openModal("Campaign Roll Request", html);
    }
    return true;
  }

  function maybePromptActiveRoll(activeRequest) {
    if (!activeRequest || !activeRequest.id) return;
    if (state.role === "gm") return;
    if (openActiveRollPrompt(false)) {
      safeNotif("GM called a campaign roll.", "info");
    }
  }

  function getOnboardingSteps() {
    var shared = getCampaignSharedState();
    var provinceMap = shared && shared.provinceMap ? shared.provinceMap : (typeof window.getProvinceMapState === "function" ? window.getProvinceMapState() : null);
    var provinceReady = !!(provinceMap && Array.isArray(provinceMap.mapData) && provinceMap.mapData.length);
    var seaReady = !!(window.S && window.S.lastSea && Array.isArray(window.S.lastSea.map) && window.S.lastSea.map.length);
    var galaxyReady = !!(window.S && window.S.starSystem && Array.isArray(window.S.starSystem.hexes) && window.S.starSystem.hexes.length);
    var worldReady = !!(window.S && window.S.worldThatWas && Array.isArray(window.S.worldThatWas.hexes) && window.S.worldThatWas.hexes.length);
    var planetReady = !!(window.S && window.S.starSystem && window.S.starSystem.planetExplorationByHex && Object.keys(window.S.starSystem.planetExplorationByHex).length);
    var yessodReady = !!(window.S && window.S.starSystem && window.S.starSystem.yessod && Array.isArray(window.S.starSystem.yessod.cells) && window.S.starSystem.yessod.cells.length);
    var combatState = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
      ? shared.campaignCombat
      : null;
    var combatReady = !!(combatState && Array.isArray(combatState.participants) && combatState.participants.length);
    var vttReady = !!(combatState && combatState.vttSession);
    return {
      inCampaign: !!(state.code && state.connected),
      provinceReady: provinceReady,
      seaReady: seaReady,
      galaxyReady: galaxyReady,
      worldReady: worldReady,
      planetReady: planetReady,
      yessodReady: yessodReady,
      combatReady: combatReady,
      vttReady: vttReady,
      mapsReady: provinceReady || seaReady || galaxyReady || worldReady || planetReady || yessodReady
    };
  }

  function renderOnboardingHtml() {
    var steps = getOnboardingSteps();
    var roleText = state.role === "gm" ? "GM" : (state.role === "player" ? "Player" : "Not joined");
    var mapSummary = [
      { label: "Province", ready: steps.provinceReady },
      { label: "Last Sea", ready: steps.seaReady },
      { label: "Galaxy", ready: steps.galaxyReady },
      { label: "World That Was", ready: steps.worldReady },
      { label: "Planet", ready: steps.planetReady },
      { label: "Yessod", ready: steps.yessodReady }
    ].map(function (entry) {
      return (entry.ready ? "✓ " : "· ") + entry.label;
    }).join(" / ");
    var combatSummary = (steps.combatReady ? "Combat seeded" : "Combat idle") + " / " + (steps.vttReady ? "Shared VTT open" : "VTT not opened");
    return ""
      + '<div style="font-size:.82rem;color:var(--muted2);line-height:1.6;">'
      + '<strong style="color:var(--text);">Campaign Quickstart</strong><br>'
      + 'Role: <strong style="color:var(--gold2);">' + escapeHtml(roleText) + '</strong><br>'
      + 'Shared world state: <strong style="color:var(--teal);">' + escapeHtml(mapSummary) + '</strong><br>'
      + 'Combat / VTT: <strong style="color:var(--text2);">' + escapeHtml(combatSummary) + '</strong>'
      + '</div>'
      + '<div style="margin-top:.55rem;display:grid;gap:.4rem;">'
      + '<div>' + (steps.inCampaign ? '✅' : '⬜') + ' Join/Create campaign and confirm your role.</div>'
      + '<div>' + (steps.mapsReady ? '✅' : '⬜') + ' GM generates or unlocks the needed map layers. Shared state auto-syncs every ~1.2s.</div>'
      + '<div>' + ((steps.combatReady || !steps.inCampaign) ? '✅' : '⬜') + ' Seed Combat first, then use Enter Combat Mode / Join Shared VTT when the table moves to battle.</div>'
      + '<div>' + ((state.syncHealth === "online") ? '✅' : '⬜') + ' Use Sync Shared World or Broadcast Authoritative State if players look out-of-sync.</div>'
      + '<div>' + ((state.role === "gm") ? '✅' : '⬜') + ' Players can use Request Resync to force a fresh authoritative snapshot.</div>'
      + '<div>' + ((state.syncConflictCount === 0) ? '✅' : '⬜') + ' Resolve guardrail conflicts if shown.</div>'
      + '</div>'
      + '<div style="margin-top:.6rem;display:flex;gap:.35rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem.syncSharedNow()">Sync Now</button>'
      + (state.role === "gm"
        ? '<button class="btn btn-xs" onclick="if(typeof generateMap===\'function\')generateMap();">Generate Province</button>'
          + '<button class="btn btn-xs" onclick="if(typeof generateLastSea===\'function\')generateLastSea();">Generate Sea</button>'
          + '<button class="btn btn-xs" onclick="if(typeof generateStarSystemMap===\'function\')generateStarSystemMap();">Generate Galaxy</button>'
        : '')
      + (steps.vttReady
        ? '<button class="btn btn-xs btn-teal" onclick="window.campaignSystem&&window.campaignSystem.joinSharedCombatMode&&window.campaignSystem.joinSharedCombatMode()">Open Shared VTT</button>'
        : '')
      + '</div>';
  }

  function showOnboarding(force) {
    if (!state.code || !state.connected || typeof window.openModal !== "function") return;
    var key = "beyond-light-campaign-onboarding-v2:" + String(state.code || "") + ":" + String(state.token || "");
    var seen = "";
    try { seen = localStorage.getItem(key) || ""; } catch (_err) {}
    if (!force && seen === "1") return;
    window.openModal("Campaign Onboarding", renderOnboardingHtml());
    try { localStorage.setItem(key, "1"); } catch (_err) {}
  }

  function closeCampaignOnboardingIfOpen() {
    var overlay = document.getElementById("rollModal");
    var title = document.getElementById("modalTitle");
    if (!overlay || !title || !overlay.classList.contains("open")) return;
    if (String(title.textContent || "").trim() !== "Campaign Onboarding") return;
    if (typeof window.closeModal === "function") {
      window.closeModal();
    } else {
      overlay.classList.remove("open");
      if (document.body) document.body.classList.remove("modal-open");
    }
  }

  function resolveActionDie(stat) {
    if (typeof window.getEffectiveDie === "function") {
      return Number(window.getEffectiveDie(stat) || 4);
    }
    if (typeof window.S !== "undefined" && window.S && window.S.stats) {
      return Number(window.S.stats[stat] || 4);
    }
    return 4;
  }

  async function createCampaign() {
    if (!(await ensureCampaignConnectionReady())) return { ok: false, error: "Server unavailable." };

    var name = readUiValue("campaignNameInput").trim() || ensureName();
    var joinPass = readUiValue("campaignPasswordInput");
    state.playerName = name;
    state.uiDraft.name = name;

    var res = await emitWithAck("campaign:create", { name: name, password: joinPass });
    if (!res.ok) {
      safeNotif(res.error || "Could not create campaign.", "warn");
      return res || { ok: false, error: "Could not create campaign." };
    }

    state.code = res.code;
    state.role = "gm";
    state.token = String(res.token || "");
    state.playerName = String(res.name || name || "GM");
    state.activePromptId = "";
    state.sessionPersistenceSuppressed = false;
    state.lastAppliedSelfCharacterAt = 0;
    state.lastCharacterHash = "";
    state.uiDraft.code = res.code;
    state.uiDraft.joinPassword = "";
    setCampaignSoundtrackDraftFromConfig(createDefaultCampaignSoundtrackSettings(), { dirty: false });
    persistSession();

    refreshSettingsModeFromCampaign();
    maybePrimePlayerDock();
    closeCampaignOnboardingIfOpen();

    safeNotif("Campaign created. Share code " + res.code + ".", "good");
    syncCharacterToCampaign(true);
    renderSettingsSection();
    renderDockPanel();
    return res;
  }

  async function joinCampaign(role, options) {
    if (!(await ensureCampaignConnectionReady())) return { ok: false, error: "Server unavailable." };

    var opts = options || {};
    var session = loadSession({ preferPersistent: true });

    var name = (opts.name || readUiValue("campaignNameInput") || "").trim() || ensureName();
    var codeRaw = opts.code || readUiValue("campaignCodeInput") || (session ? session.code : "");
    var code = formatCode(codeRaw);
    var joinPass = opts.password || readUiValue("campaignPasswordInput") || "";
    var requestedRole = role === "gm" ? "gm" : "player";
    var hasTokenOverride = Object.prototype.hasOwnProperty.call(opts, "token");

    if (!code) {
      if (!opts.silent) safeNotif("Enter a campaign code to join.", "warn");
      return { ok: false, error: "Missing campaign code." };
    }

    state.playerName = name;
    state.uiDraft.name = name;
    state.uiDraft.code = code;
    state.uiDraft.joinPassword = joinPass;

    // Reuse token only when role and campaign code match the active/saved session.
    var activeToken = (state.code === code && state.role === requestedRole) ? String(state.token || "") : "";
    var sessionToken = (session && session.code === code && session.role === requestedRole) ? String(session.token || "") : "";
    var tokenHint = opts.fresh
      ? ""
      : String(hasTokenOverride ? opts.token : (activeToken || sessionToken || "")).trim();

    var res = await emitWithAck("campaign:join", {
      code: code,
      name: name,
      role: requestedRole,
      token: tokenHint,
      password: joinPass
    });

    if (!res.ok) {
      if (!opts.silent) safeNotif(res.error || "Could not join campaign.", "warn");
      return res || { ok: false, error: "Could not join campaign." };
    }

    state.code = res.code;
    state.role = res.role;
    state.token = String(res.token || "");
    state.playerName = String(res.name || name || ensureName());
    state.activePromptId = "";
    state.sessionPersistenceSuppressed = false;
    state.lastAppliedSelfCharacterAt = 0;
    state.lastCharacterHash = "";
    state.uiDraft.code = res.code;
    state.uiDraft.joinPassword = "";
    setCampaignSoundtrackDraftFromConfig(createDefaultCampaignSoundtrackSettings(), { dirty: false });
    persistSession();

    refreshSettingsModeFromCampaign();
    maybePrimePlayerDock();
    if (res.role === "gm") closeCampaignOnboardingIfOpen();
    if (res.role === "player" && window.settingsSystem && typeof window.settingsSystem.closeSettings === "function") {
      window.settingsSystem.closeSettings();
    }

    if (!opts.silent) {
      safeNotif(
        (res.restored ? "Reconnected to " : "Joined ") + "campaign " + res.code + " as " + (res.role === "gm" ? "GM" : "Player") + ".",
        "good"
      );
    }

    syncCharacterToCampaign(true);
    renderSettingsSection();
    renderDockPanel();
    return res;
  }

  async function leaveCampaign() {
    if (state.socket) {
      await emitWithAck("campaign:leave", {});
    }

    state.code = "";
    state.role = "";
    state.token = "";
    state.campaign = null;
    state.activePromptId = "";
    state.sessionPersistenceSuppressed = false;
    state.lastAppliedSelfCharacterAt = 0;
    state.lastAppliedPartyRestEventId = "";
    state.lastCharacterHash = "";
    state.lastAppliedCampaignSoundtrackHash = "";
    state.uiDraft.joinPassword = "";
    state.lastPlayerDockSeed = "";
    setCampaignSoundtrackDraftFromConfig(createDefaultCampaignSoundtrackSettings(), { dirty: false });
    if (typeof window.AudioManager !== "undefined" && window.AudioManager && typeof window.AudioManager.clearCampaignSoundtrack === "function") {
      try {
        window.AudioManager.clearCampaignSoundtrack({ fadeIn: true });
      } catch (_err) {}
    }
    clearSession();
    refreshSettingsModeFromCampaign();

    safeNotif("Left campaign.", "warn");
    renderSettingsSection();
    renderDockPanel();
    return { ok: true };
  }

  async function callRollRequest() {
    var label = readUiValue("campaignRollLabel").trim() || "Dread Check";
    var stat = readUiValue("campaignRollStat").trim().toLowerCase() || "valor";
    var dread = Math.max(1, Number(readUiValue("campaignRollDread") || 8));

    return requestRollPrompt(label, stat, dread, "");
  }

  async function requestRollPrompt(label, stat, dread, targetToken, options) {
    if (!state.socket) {
      safeNotif("Only connected GM can call campaign rolls.", "warn");
      return { ok: false, error: "Not connected." };
    }
    if (!guardAction("callRoll", "Only connected GM can call campaign rolls.")) return { ok: false, error: "Not allowed." };
    if (!guardRiskySharedAction("call roll request")) return { ok: false, error: "Cancelled." };

    var opts = options && typeof options === "object" ? options : {};
    var nextLabel = String(label || "Dread Check").trim() || "Dread Check";
    var nextStat = String(stat || "valor").trim().toLowerCase() || "valor";
    var nextDread = Math.max(1, Number(dread || 8));
    var payload = { label: nextLabel, stat: nextStat, dread: nextDread };
    var target = String(targetToken || "").trim();
    var providedPendingCheckId = "";
    if (typeof options === "string") {
      providedPendingCheckId = String(options || "").trim();
    } else if (opts.pendingCheckId) {
      providedPendingCheckId = String(opts.pendingCheckId || "").trim();
    }
    var pendingCheckId = providedPendingCheckId;
    var createdPendingCheck = false;
    var autoResolveOnSubmit = !!(
      typeof opts.autoResolveOnSubmit === "boolean"
        ? opts.autoResolveOnSubmit
        : !!String(targetToken || "").trim()
    );
    var defaultOutcomeTarget = String(
      opts.defaultOutcomeTarget != null
        ? opts.defaultOutcomeTarget
        : (target || "party")
    ).trim() || (target || "party");
    var failurePenaltyType = normalizeSceneFailurePenaltyType(opts.failurePenaltyType || "mentalStress");
    var failTmw = Math.max(0, parseInt(opts.failTmw != null ? opts.failTmw : 1, 10) || 0);
    if (state.role === "gm") {
      if (!pendingCheckId) {
        var pendingCheck = startGmPendingCheck({
          type: "shared-check",
          scope: target ? "individual" : "party",
          label: nextLabel,
          stat: nextStat,
          statOptions: [nextStat],
          dread: nextDread,
          context: nextLabel,
          stake: target ? "Individual actor check waiting on GM resolution." : "Shared campaign consequence waiting on GM resolution.",
          participants: target ? [{ token: target }] : [],
          payload: {
            defaultOutcomeTarget: defaultOutcomeTarget,
            failurePenaltyType: failurePenaltyType,
            failTmw: failTmw,
            autoResolveOnSubmit: autoResolveOnSubmit
          }
        });
        if (pendingCheck && pendingCheck.ok && pendingCheck.id) {
          pendingCheckId = String(pendingCheck.id || "");
          createdPendingCheck = true;
        }
      }
    }
    if (target) payload.targetToken = target;
    if (pendingCheckId) payload.pendingCheckId = pendingCheckId;
    payload.defaultOutcomeTarget = defaultOutcomeTarget;
    payload.failurePenaltyType = failurePenaltyType;
    payload.failTmw = failTmw;
    if (autoResolveOnSubmit) payload.autoResolveOnSubmit = true;

    var res = await emitWithAck("campaign:rollRequest", payload);
    if (!res.ok) {
      if (pendingCheckId && state.role === "gm" && (createdPendingCheck || opts.keepPendingOnFailure !== true)) {
        var shared = getMutableCampaignSharedState();
        var pending = ensurePendingChecksState(shared);
        if (pending.active && pending.active[pendingCheckId]) {
          delete pending.active[pendingCheckId];
          syncPendingChecks("pending-check-cancelled");
        }
      }
      safeNotif(res.error || "Could not create roll request.", "warn");
      return res || { ok: false, error: "Could not create roll request." };
    }
    safeNotif("Roll request sent to campaign.", "good");
    var nextRes = res && typeof res === "object" ? res : { ok: true };
    nextRes.pendingCheckId = pendingCheckId;
    return nextRes;
  }

  function buildCampaignRollSubmissionNotes(result) {
    var parts = [];
    if (result && result.pushLuck) parts.push("Push Your Luck");
    if (result && Array.isArray(result.bonusNotes)) {
      result.bonusNotes.forEach(function (note) {
        var text = String(note || "").trim();
        if (text) parts.push(text);
      });
    }
    return parts.join(" | ").slice(0, 180);
  }

  async function closeActiveRollSilently() {
    if (!state.socket || state.role !== "gm") return { ok: false, error: "Not allowed." };
    var res = await emitWithAck("campaign:closeRoll", {});
    return res || { ok: false, error: "Could not close roll request." };
  }

  async function maybeAutoResolveActiveRoll(activeRequest) {
    if (state.role !== "gm" || !activeRequest || !activeRequest.id || !activeRequest.pendingCheckId) return false;
    if (!activeRequest.autoResolveOnSubmit) return false;
    var targetToken = String(activeRequest.targetToken || "").trim();
    if (!targetToken) return false;
    var responses = Array.isArray(activeRequest.responses) ? activeRequest.responses.slice() : [];
    if (!responses.length) return false;
    var targetResponse = null;
    for (var i = responses.length - 1; i >= 0; i -= 1) {
      var row = responses[i];
      if (!row || String(row.token || "").trim() !== targetToken) continue;
      targetResponse = row;
      break;
    }
    if (!targetResponse) return false;
    var responseKey = String(activeRequest.id || "") + ":" + String(targetResponse.token || "") + ":" + Number(targetResponse.at || 0);
    if (state.lastAutoResolvedRollKey === responseKey) return true;
    state.lastAutoResolvedRollKey = responseKey;
    var pendingCheck = getPendingCheckById(activeRequest.pendingCheckId);
    var payload = pendingCheck && pendingCheck.payload && typeof pendingCheck.payload === "object" ? pendingCheck.payload : {};
    var targetValue = String(payload.defaultOutcomeTarget || targetToken || "party").trim() || "party";
    var resolved = await resolveSceneCheckOutcome({
      checkId: String(activeRequest.pendingCheckId || ""),
      success: !!targetResponse.success,
      actionTotal: Math.max(0, Number(targetResponse.total || 0)),
      dreadTotal: Math.max(0, Number(targetResponse.dreadTotal || 0)),
      resolvedVia: "auto-player-submit",
      scope: targetValue === "party" ? "party" : "individual",
      targetValue: targetValue,
      targetTokens: targetValue === "party" ? buildSceneCheckTargetTokens("party", "", []) : [targetValue]
    });
    if (!resolved || !resolved.ok) {
      state.lastAutoResolvedRollKey = "";
      return false;
    }
    await closeActiveRollSilently();
    renderSettingsSection();
    renderDockPanel();
    return true;
  }

  async function closeActiveRoll() {
    if (!state.socket) {
      safeNotif("Only connected GM can close roll requests.", "warn");
      return;
    }
    if (!guardAction("closeRoll", "Only connected GM can close roll requests.")) return;
    if (!guardRiskySharedAction("close roll request")) return;
    var res = await emitWithAck("campaign:closeRoll", {});
    if (!res.ok) {
      safeNotif(res.error || "Could not close roll request.", "warn");
      return;
    }
    safeNotif("Active roll request closed.", "good");
  }

  async function savePrivateNote() {
    if (!state.socket || !state.code) {
      safeNotif("Join a campaign first.", "warn");
      return;
    }
    var note = readUiValue("campaignPrivateNoteInput");
    var res = await emitWithAck("campaign:privateNote", { text: note });
    if (!res.ok) {
      safeNotif(res.error || "Could not save notes.", "warn");
      return;
    }
    safeNotif("Private notes saved.", "good");
  }

  async function setCampaignPassword() {
    if (!state.socket) {
      safeNotif("Only connected GM can update campaign password.", "warn");
      return;
    }
    if (!guardAction("setPassword", "Only connected GM can update campaign password.")) return;
    var password = readUiValue("campaignSetPasswordInput");
    var res = await emitWithAck("campaign:setPassword", { password: password });
    if (!res.ok) {
      safeNotif(res.error || "Could not update campaign password.", "warn");
      return;
    }
    safeNotif(password.trim() ? "Campaign password updated." : "Campaign password removed.", "good");
  }

  async function forceAuthoritativeResync() {
    if (!state.socket) {
      safeNotif("Only connected GM can broadcast authoritative state.", "warn");
      return;
    }
    if (!guardAction("forceAuthoritativeResync", "Only connected GM can broadcast authoritative state.")) return;
    var res = await syncSharedSilent("gm-authoritative-broadcast");
    state.lastAutoRebroadcastAt = Date.now();
    state.lastAutoRebroadcastOk = !!(res && res.ok);
    state.lastAutoRebroadcastError = (res && res.ok)
      ? ""
      : String((res && res.error) || "broadcast failed");
    renderSettingsSection();
    if (!res || !res.ok) {
      safeNotif((res && res.error) || "Broadcast sync failed.", "warn");
      return;
    }
    safeNotif("Authoritative world state broadcasted to campaign.", "good");
  }

  async function reconnectNow() {
    if (!ensureSocket()) {
      safeNotif("Multiplayer requires the local campaign server.", "warn");
      return { ok: false, error: "Server unavailable." };
    }
    if (state.socket && !state.connected && typeof state.socket.connect === "function") {
      state.socket.connect();
      safeNotif(state.code ? "Reconnect requested." : "Connecting to campaign server...", "info");
      return { ok: true, pending: true };
    }
    if (!state.code || !state.role) {
      var savedSummary = getSavedCampaignSessionSummary();
      if (savedSummary.hasSaved) {
        return resumeSavedCampaignSession({ silent: true });
      }
      safeNotif("No active campaign session to reconnect.", "warn");
      return { ok: false, error: "No active campaign session." };
    }
    var joinResult = await joinCampaign(state.role, {
      code: state.code,
      name: state.playerName || ensureName(),
      token: state.token,
      silent: true
    });
    if (!joinResult || !joinResult.ok) {
      safeNotif((joinResult && joinResult.error) || "Reconnect handshake failed.", "warn");
      return joinResult || { ok: false, error: "Reconnect failed." };
    }
    refreshSyncHealth();
    renderSettingsSection();
    renderDockPanel();
    safeNotif("Reconnect handshake complete.", "good");
    return joinResult;
  }

  async function recoverSyncNow() {
    if (!state.code) {
      safeNotif("Join a campaign first.", "warn");
      return;
    }
    if (!state.connected) {
      await reconnectNow();
      return;
    }
    if (state.role === "gm") {
      await forceAuthoritativeResync();
      return;
    }
    await requestResync();
  }

  function getSyncStatus() {
    return {
      mode: String(state.syncHealth || "idle"),
      text: String(state.syncText || "Idle"),
      lastSyncAt: Number(state.lastSyncAt || 0),
      lastCampaignStateAt: Number(state.lastCampaignStateAt || 0),
      sharedVersion: Number(state.lastSharedVersion || 0),
      pendingSyncCount: Number(state.pendingSyncCount || 0),
      syncConflictCount: Number(state.syncConflictCount || 0),
      connected: !!state.connected,
      code: String(state.code || "")
    };
  }

  async function clearProvinceSelections() {
    if (!state.socket) {
      safeNotif("Only connected GM can clear player cursors.", "warn");
      return;
    }
    if (!guardAction("clearProvinceSelections", "Only connected GM can clear player cursors.")) return;
    var shared = getCampaignSharedState();
    var selected = shared && shared.provinceSelections && typeof shared.provinceSelections === "object"
      ? deepCloneJson(shared.provinceSelections) || {}
      : {};
    Object.keys(selected).forEach(function (token) {
      if (state.token && String(token) === String(state.token)) return;
      delete selected[token];
    });
    var res = await pushSharedState({ provinceSelections: selected }, "gm-clear-province-selections");
    if (!res || !res.ok) {
      safeNotif((res && res.error) || "Could not clear player cursors.", "warn");
      return;
    }
    safeNotif("Cleared player map cursors.", "good");
  }

  async function syncProvinceFocus(reason) {
    if (!state.socket || !state.connected || !state.code) return { ok: false, error: "Not connected." };
    var now = Date.now();
    if (now - Number(state.lastProvinceFocusSyncAt || 0) < 220) {
      state.pendingProvinceFocusReason = String(reason || state.pendingProvinceFocusReason || "province-focus");
      if (!state.provinceFocusSyncTimer) {
        var waitMs = Math.max(40, 240 - (now - Number(state.lastProvinceFocusSyncAt || 0)));
        state.provinceFocusSyncTimer = setTimeout(function () {
          state.provinceFocusSyncTimer = null;
          var queuedReason = String(state.pendingProvinceFocusReason || "province-focus");
          state.pendingProvinceFocusReason = "";
          syncProvinceFocus(queuedReason).catch(function () {});
        }, waitMs);
      }
      return { ok: true, queued: true };
    }
    var key = (typeof window.getProvinceSelectedKey === "function")
      ? String(window.getProvinceSelectedKey() || "")
      : "";
    if (!key) return { ok: false, error: "No province selected." };

    if (state.provinceFocusSyncTimer) {
      clearTimeout(state.provinceFocusSyncTimer);
      state.provinceFocusSyncTimer = null;
    }
    state.pendingProvinceFocusReason = "";
    state.lastProvinceFocusSyncAt = now;
    var mutableShared = getMutableCampaignSharedState();
    var patch = {};
    if (state.token) {
      patch.provinceSelections = {};
      patch.provinceSelections[state.token] = {
        key: key,
        name: String(state.playerName || ensureName() || "Wayfarer"),
        at: now
      };
      var liveSelections = mutableShared.provinceSelections && typeof mutableShared.provinceSelections === "object"
        ? mutableShared.provinceSelections
        : {};
      liveSelections[state.token] = deepCloneJson(patch.provinceSelections[state.token]) || patch.provinceSelections[state.token];
      mutableShared.provinceSelections = liveSelections;
    }

    if (state.role === "gm") {
      var shared = getCampaignSharedState();
      var travel = shared && shared.campaignTravel && typeof shared.campaignTravel === "object"
        ? deepCloneJson(shared.campaignTravel) || {}
        : {};
      travel.region = String(travel.region || "province");
      travel.context = String(travel.context || "traveling");
      travel.tab = "map";
      travel.label = String(travel.label || "Province Map");
      travel.provinceKey = key;
      travel.movedBy = String(state.playerName || ensureName() || "GM");
      travel.reason = String(reason || "province-focus");
      travel.phaseCost = 0;
      travel.updatedAt = now;
      patch.campaignTravel = travel;
      mutableShared.campaignTravel = deepCloneJson(travel) || travel;
      try {
        state.lastCameraViewHash = cameraViewHash(buildCameraViewSnapshot());
      } catch (_err) {}
      var provinceMap = buildProvinceSharedSnapshot(key);
      if (provinceMap) {
        patch.provinceMap = provinceMap;
        mutableShared.provinceMap = deepCloneJson(provinceMap) || provinceMap;
      }
    }

    if (!Object.keys(patch).length) return { ok: false, error: "No focus patch available." };
    return syncSharedPatch(patch, reason || "province-focus");
  }

  async function toggleArchive() {
    if (!state.socket) {
      safeNotif("Only connected GM can change archive state.", "warn");
      return;
    }
    if (!guardAction("archiveCampaign", "Only connected GM can change archive state.")) return;
    var archived = !!(state.campaign && state.campaign.archived);
    var evt = archived ? "campaign:unarchive" : "campaign:archive";
    var res = await emitWithAck(evt, {});
    if (!res.ok) {
      safeNotif(res.error || "Could not update campaign archive state.", "warn");
      return;
    }
    safeNotif(archived ? "Campaign reopened." : "Campaign archived.", "good");
  }

  async function deleteCampaign() {
    if (!state.socket) {
      safeNotif("Only connected GM can delete campaigns.", "warn");
      return;
    }
    if (!guardAction("deleteCampaign", "Only connected GM can delete campaigns.")) return;
    var ok = window.confirm("Delete this campaign for everyone? This cannot be undone.");
    if (!ok) return;

    var res = await emitWithAck("campaign:delete", {});
    if (!res.ok) {
      safeNotif(res.error || "Could not delete campaign.", "warn");
      return;
    }

    var oldCode = state.code;
    state.code = "";
    state.role = "";
    state.token = "";
    state.campaign = null;
    state.activePromptId = "";
    state.uiDraft.code = "";
    state.uiDraft.joinPassword = "";
    state.lastPlayerDockSeed = "";
    setCampaignSoundtrackDraftFromConfig(createDefaultCampaignSoundtrackSettings(), { dirty: false });
    clearSession();
    refreshSettingsModeFromCampaign();
    safeNotif("Deleted campaign " + oldCode + ".", "warn");
    renderSettingsSection();
    renderDockPanel();
  }

  function setTimelineFilter(mode, options) {
    var opts = options || {};
    var next = String(mode || "all");
    if (["all", "chat", "roll", "system", "recap"].indexOf(next) === -1) next = "all";
    if (state.timelineFilter === next) {
      if (!opts.systemPreset) state.timelineFilterManual = true;
      return;
    }
    state.timelineFilter = next;
    if (!opts.systemPreset) {
      state.timelineFilterManual = true;
    }
    renderDockPanel();
  }

  function clearRecentDockChat(count) {
    var take = Math.max(1, Math.min(100, Number(count || 20)));
    var campaignLog = state.campaign && Array.isArray(state.campaign.log) ? state.campaign.log : [];
    var shared = getCampaignSharedState();
    var recap = shared && Array.isArray(shared.sessionTimeline) ? shared.sessionTimeline : [];
    var source = buildDockTimelineSource(campaignLog, recap);
    var visible = filterTimeline(source);
    var chatEntries = visible.filter(function (entry) {
      return String(entry && entry.kind || "") === "chat";
    });
    if (!chatEntries.length) {
      safeNotif("No chat lines to clear.", "info");
      return;
    }
    var removed = chatEntries.slice(-take);
    state.hiddenTimelineKeys = Array.isArray(state.hiddenTimelineKeys) ? state.hiddenTimelineKeys : [];
    state.hiddenTimelineUndoBatches = Array.isArray(state.hiddenTimelineUndoBatches) ? state.hiddenTimelineUndoBatches : [];
    var removedKeys = [];
    removed.forEach(function (entry) {
      var key = getTimelineEntryKey(entry);
      if (state.hiddenTimelineKeys.indexOf(key) === -1) {
        state.hiddenTimelineKeys.push(key);
        removedKeys.push(key);
      }
    });
    if (state.hiddenTimelineKeys.length > 1000) {
      state.hiddenTimelineKeys = state.hiddenTimelineKeys.slice(state.hiddenTimelineKeys.length - 1000);
    }
    if (removedKeys.length) {
      state.hiddenTimelineUndoBatches.push(removedKeys);
      if (state.hiddenTimelineUndoBatches.length > 40) {
        state.hiddenTimelineUndoBatches = state.hiddenTimelineUndoBatches.slice(state.hiddenTimelineUndoBatches.length - 40);
      }
    }
    renderDockPanel();
    safeNotif("Cleared " + removed.length + " recent chat line" + (removed.length === 1 ? "" : "s") + " from your dock view.", "good");
  }

  function restoreRecentDockChat() {
    if (state.role !== "gm") {
      safeNotif("Only GM can restore cleared chat in this session.", "warn");
      return;
    }
    state.hiddenTimelineUndoBatches = Array.isArray(state.hiddenTimelineUndoBatches) ? state.hiddenTimelineUndoBatches : [];
    state.hiddenTimelineKeys = Array.isArray(state.hiddenTimelineKeys) ? state.hiddenTimelineKeys : [];
    if (!state.hiddenTimelineUndoBatches.length) {
      safeNotif("No cleared chat batch to restore.", "info");
      return;
    }
    var lastBatch = state.hiddenTimelineUndoBatches.pop() || [];
    if (!lastBatch.length) {
      safeNotif("No cleared chat batch to restore.", "info");
      return;
    }
    state.hiddenTimelineKeys = state.hiddenTimelineKeys.filter(function (key) {
      return lastBatch.indexOf(key) === -1;
    });
    renderDockPanel();
    safeNotif("Restored " + lastBatch.length + " cleared chat line" + (lastBatch.length === 1 ? "" : "s") + ".", "good");
  }

  async function submitActiveRoll() {
    var req = state.campaign && state.campaign.activeRollRequest;
    if (!req) {
      safeNotif("No active campaign roll request.", "warn");
      return;
    }

    var targetToken = String(req.targetToken || "");
    if (targetToken && String(state.token || "") !== targetToken) {
      safeNotif("This roll request targets another player.", "warn");
      return;
    }

    var stat = String(req.stat || "valor").toLowerCase();
    var selections = getCampaignPromptSelections();
    if (selections.pushLuck && getTmwValue() < 2) {
      safeNotif("Need 2 TMW to Push Your Luck.", "warn");
      return { ok: false, error: "Not enough TMW." };
    }
    if (typeof window.clearConditionOnUse === "function") {
      window.clearConditionOnUse(stat);
    }
    if (selections.pushLuck && typeof window.changeCounter === "function") {
      window.changeCounter("tmw", -2);
    }
    var result = performCampaignPromptRoll(stat, req.dread, selections, req.label || ("Campaign " + stat));
    if (result.pushLuck) {
      result.conditionApplied = applyCampaignPushLuckCondition(stat, !!result.success);
    }
    return submitActiveRollResult(req, result, false);
  }

  async function submitActiveRollResult(req, result, manual) {
    if (!req || !req.id) {
      safeNotif("No active campaign roll request.", "warn");
      return { ok: false, error: "No active campaign roll request." };
    }

    var rollResult = result && typeof result === "object" ? result : {};
    var actionDie = Math.max(1, Number(rollResult.actionDie || 4) || 4);
    var actionTotal = Math.max(0, Number(rollResult.actionTotal || rollResult.total || 0) || 0);
    var dreadTotal = Math.max(0, Number(rollResult.dreadTotal || 0) || 0);
    var pushLuck = !!rollResult.pushLuck;
    var conditionApplied = String(rollResult.conditionApplied || "").trim();
    var notes = buildCampaignRollSubmissionNotes(rollResult);

    var res = await emitWithAck("campaign:rollSubmit", {
      requestId: req.id,
      total: actionTotal,
      dreadTotal: dreadTotal,
      die: actionDie,
      method: manual ? "manual" : "auto",
      manual: !!manual,
      pushLuck: pushLuck,
      conditionApplied: conditionApplied,
      notes: notes
    });

    if (!res.ok) {
      safeNotif(res.error || "Could not submit roll.", "warn");
      return res || { ok: false, error: "Could not submit roll." };
    }

    if (req.pendingCheckId && !req.autoResolveOnSubmit) {
      submitPendingCheck(req.pendingCheckId, {
        total: actionTotal,
        dreadTotal: dreadTotal,
        die: actionDie,
        method: manual ? "manual" : "auto",
        manual: !!manual,
        notes: notes
      }).catch(function () {});
    }

    if (typeof window.closeModal === "function") {
      window.closeModal();
    }

    safeNotif(
      "Submitted: " + String(req.stat || "valor").toUpperCase() + " d" + actionDie + " " + actionTotal + " vs " + dreadTotal + (pushLuck ? " [Push Luck]" : "") + ".",
      actionTotal >= dreadTotal ? "good" : "warn"
    );
    return res;
  }

  function submitActiveRollManual() {
    var req = state.campaign && state.campaign.activeRollRequest;
    if (!req) {
      safeNotif("No active campaign roll request.", "warn");
      return;
    }

    var targetToken = String(req.targetToken || "");
    if (targetToken && String(state.token || "") !== targetToken) {
      safeNotif("This roll request targets another player.", "warn");
      return;
    }

    if (typeof window.openProvinceManualCheckPrompt !== "function") {
      safeNotif("Manual roll prompt is unavailable.", "warn");
      return;
    }

    var stat = String(req.stat || "valor").toLowerCase();
    var actionDie = resolveActionDie(stat);
    var selections = getCampaignPromptSelections();
    if (selections.pushLuck && getTmwValue() < 2) {
      safeNotif("Need 2 TMW to Push Your Luck.", "warn");
      return;
    }
    var manualDread = selections.pushLuck && typeof window.stepUp === "function"
      ? Math.max(4, Number(window.stepUp(req.dread || 8) || req.dread || 8))
      : Math.max(4, Number(req.dread || 8) || 8);
    var sources = getCampaignPromptBonusSources(stat);
    window.openProvinceManualCheckPrompt({
      title: "Campaign Roll Request",
      context: String(req.label || "GM Check"),
      statKey: stat,
      statLabel: stat.toUpperCase(),
      actionDie: actionDie,
      dreadDie: manualDread,
      modifierLines: buildCampaignActiveRollManualLines(stat, req, selections, sources, manualDread),
      onResolve: function (outcome) {
        if (typeof window.clearConditionOnUse === "function") {
          window.clearConditionOnUse(stat);
        }
        if (selections.pushLuck && typeof window.changeCounter === "function") {
          window.changeCounter("tmw", -2);
        }
        var success = !!(outcome && outcome.success);
        var conditionApplied = selections.pushLuck ? applyCampaignPushLuckCondition(stat, success) : "";
        submitActiveRollResult(
          req,
          {
            actionDie: actionDie,
            actionTotal: Number(outcome && outcome.actionTotal || 0),
            dreadTotal: Number(outcome && outcome.dreadTotal || 0),
            pushLuck: !!selections.pushLuck,
            usedFlavor: !!selections.useFlavor,
            usedMutation: !!selections.useMutation,
            usedInventory: !!selections.useInventory,
            conditionApplied: conditionApplied,
            bonusNotes: buildCampaignRollSubmissionNotes({
              pushLuck: !!selections.pushLuck,
              bonusNotes: buildCampaignActiveRollManualLines(stat, req, selections, sources, manualDread)
            }).split(" | ").filter(Boolean)
          },
          true
        );
      }
    });
  }

  // Broadcast a roll/encounter result to all campaign players so everyone sees
  // the same shared-world outcomes (encounter type, die values, location).
  async function broadcastRollResult(label, summary) {
    if (!state.socket || !state.connected || !state.code) return;
    var name = String(state.playerName || ensureName() || "Wayfarer");
    var msg = "[" + escapeHtml(name) + "] " + escapeHtml(String(label || "Roll")) + ": " + escapeHtml(String(summary || "—"));
    await emitWithAck("campaign:chat", { message: msg });
  }

  async function syncProvinceEncounterResult(provinceKey, encounterHtml) {
    if (!state.socket || !state.connected || !state.code) return { ok: false, error: "Not connected." };
    var key = String(provinceKey || "").trim();
    var html = String(encounterHtml || "").trim();
    if (!key || !html) return { ok: false, error: "Invalid province encounter payload." };
    var out = await emitWithAck("campaign:provinceEncounterResult", {
      provinceKey: key,
      encounterHtml: html.slice(0, 18000)
    });
    if (!out || !out.ok) {
      safeNotif((out && out.error) || "Could not sync province encounter to campaign.", "warn");
      return out || { ok: false };
    }
    return out;
  }

  async function syncFactionProgressPatch(patch, reason) {
    if (!state.socket || !state.connected || !state.code) return { ok: false, error: "Not connected." };
    if (state.role !== "gm") return { ok: false, error: "Only GM can sync faction progress." };
    if (!patch || typeof patch !== "object") return { ok: false, error: "Invalid faction progress patch." };
    var out = await emitWithAck("campaign:syncFactionProgress", {
      state: patch,
      reason: reason || "faction-progress"
    });
    if (!out || !out.ok) {
      safeNotif((out && out.error) || "Could not sync faction progress to campaign.", "warn");
      return out || { ok: false };
    }
    applyLocalSharedPatch(patch);
    return out;
  }

  async function sendChatMessage(options) {
    if (!state.socket || !state.code) {
      safeNotif("Join a campaign first.", "warn");
      return;
    }

    var opts = options && typeof options === "object" ? options : null;
    var input = document.getElementById("campaignDockChatInput");
    var msg = opts && typeof opts.message === "string"
      ? String(opts.message || "").trim()
      : (input ? String(input.value || "").trim() : "");
    if (!msg) return;

    var payload = { message: msg };
    if (opts && opts.channel) payload.channel = String(opts.channel || "").trim().toLowerCase();
    if (opts && opts.targetToken) payload.targetToken = String(opts.targetToken || "").trim();

    var slash = parsePromptSlashCommand(msg);
    if (slash) {
      if (slash.command !== "prompt") {
        safeNotif("Unknown command. Try /prompt <stat> d6 @name <context>", "warn");
        return;
      }
      if (state.role !== "gm") {
        safeNotif("Only GM can use /prompt.", "warn");
        return;
      }
      if (slash.targetUnresolved) {
        safeNotif("Could not find target " + slash.targetUnresolved + ". Use a listed player name.", "warn");
        return;
      }
      var promptRes = await requestRollPrompt(slash.label, slash.stat, slash.dread, slash.targetToken);
      if (!promptRes || !promptRes.ok) {
        return;
      }
      var chatNotice = "🎲 Prompt " + String(slash.targetLabel || "table") + " · "
        + String(slash.stat || "valor").toUpperCase() + " vs d" + Number(slash.dread || 6)
        + (slash.context ? (" · " + String(slash.context)) : "");
      await emitWithAck("campaign:chat", { message: chatNotice });
      if (input && (!opts || (opts && !opts.message))) input.value = "";
      return;
    }

    var res = await emitWithAck("campaign:chat", payload);
    if (!res.ok) {
      safeNotif(res.error || "Could not send chat message.", "warn");
      return;
    }

    if (input && (!opts || (opts && !opts.message))) input.value = "";
  }

  async function applyGmEconomyAdjustment() {
    if (!state.socket || !state.code) {
      safeNotif("Only connected GM can run economy adjustments.", "warn");
      return;
    }
    if (!guardAction("adjustEconomy", "Only connected GM can run economy adjustments.")) return;

    var resource = readUiValue("campaignEconomyResource").trim().toLowerCase() || "tmw";
    var rawDelta = Number(readUiValue("campaignEconomyDelta") || 0);
    var reason = readUiValue("campaignEconomyReason").trim();

    if (!reason || reason.length < 3) {
      safeNotif("Reason is required for ledger transparency.", "warn");
      return;
    }
    if (!Number.isFinite(rawDelta) || rawDelta === 0) {
      safeNotif("Delta must be a non-zero number.", "warn");
      return;
    }

    var appliedDelta = 0;
    state.suppressEconomyLedgerAuto = true;
    try {
      if (resource === "tmw") {
        var beforeTmw = Math.max(0, Number(window.S && window.S.tmw || 0));
        if (typeof window.changeCounter === "function") {
          window.changeCounter("tmw", rawDelta);
        } else if (window.S) {
          window.S.tmw = Math.max(0, beforeTmw + rawDelta);
          if (typeof window.updateTMWPool === "function") window.updateTMWPool();
        }
        var afterTmw = Math.max(0, Number(window.S && window.S.tmw || 0));
        appliedDelta = afterTmw - beforeTmw;
      } else if (resource === "credits") {
        var beforeCredits = Math.max(0, Number(window.S && window.S.credits || 0));
        if (window.S) {
          window.S.credits = Math.max(0, beforeCredits + rawDelta);
          if (typeof window.updateCreditsUI === "function") window.updateCreditsUI();
        }
        var afterCredits = Math.max(0, Number(window.S && window.S.credits || 0));
        appliedDelta = afterCredits - beforeCredits;
      } else if (resource === "renown") {
        var beforeRenown = Math.max(0, Number(window.S && window.S.renown || 0));
        if (window.S) {
          window.S.renown = Math.max(0, beforeRenown + rawDelta);
          if (typeof window.updateRenown === "function") window.updateRenown();
        }
        var afterRenown = Math.max(0, Number(window.S && window.S.renown || 0));
        appliedDelta = afterRenown - beforeRenown;
      } else {
        safeNotif("Unsupported resource. Use tmw, credits, or renown.", "warn");
        return;
      }
    } finally {
      state.suppressEconomyLedgerAuto = false;
    }

    if (!appliedDelta) {
      safeNotif("No change applied (already at floor or unchanged).", "warn");
      return;
    }

    recordEconomyDelta(resource, appliedDelta, "GM Adjustment: " + reason);
    var res = await syncSharedSilent("gm-economy-adjust");
    if (!res || !res.ok) {
      safeNotif((res && res.error) || "Adjustment applied locally, but sync failed.", "warn");
      return;
    }

    safeNotif("GM adjusted " + resource.toUpperCase() + " by " + (appliedDelta > 0 ? "+" : "") + appliedDelta + ".", "good");
    renderSettingsSection();
    renderDockPanel();
  }

  function openDock(filterMode) {
    if (filterMode) setTimelineFilter(filterMode);
    state.dockOpen = true;
    renderDockPanel();
  }

  function toggleDock() {
    state.dockOpen = !state.dockOpen;
    renderDockPanel();
  }

  function maybePrimePlayerDock() {
    if (state.role !== "player" || !state.code || !state.connected) return;
    var seed = String(state.code || "") + ":" + String(state.token || "");
    if (!seed || seed === state.lastPlayerDockSeed) return;
    state.lastPlayerDockSeed = seed;
    state.dockOpen = true;
  }

  function formatSyncStatusLine() {
    var roleLabel = state.role === "gm" ? "GM" : (state.role === "player" ? "Player" : "Offline");
    var syncLabel = String(state.syncText || "").trim().toLowerCase() || (state.syncHealth === "syncing"
      ? "syncing"
      : (state.syncHealth === "stale" ? "pending" : (state.syncHealth === "online" ? "synced" : "offline")));
    var stamp = formatTimestamp(state.lastAuthoritativeAt) || formatTimestamp(state.lastSyncAt) || "-";
    var age = state.lastCampaignStateAt ? (" · snapshot " + getLastSnapshotAgeSeconds() + "s") : "";
    var conflict = state.syncConflictCount > 0 ? (" · conflicts " + state.syncConflictCount) : "";
    return "Campaign " + roleLabel + " · " + syncLabel + conflict + " · authoritative " + stamp + age;
  }

  function ensureMapSyncStatusBars() {
    var targets = [
      document.querySelector("#tab-map .map-controls"),
      document.getElementById("tab-lastsea"),
      document.getElementById("tab-galaxy"),
      document.getElementById("tab-worldthatwas")
    ];
    var lineText = formatSyncStatusLine();
    for (var i = 0; i < targets.length; i += 1) {
      var host = targets[i];
      if (!host) continue;
      var bar = host.querySelector(".campaign-sync-status");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "campaign-sync-status";
        bar.style.margin = "0 0 .35rem 0";
        bar.style.padding = ".35rem .5rem";
        bar.style.border = "1px solid rgba(60,150,150,.35)";
        bar.style.borderRadius = ".45rem";
        bar.style.background = "rgba(10,22,24,.45)";
        bar.style.fontSize = ".72rem";
        bar.style.color = "var(--muted2)";
        bar.style.display = "flex";
        bar.style.gap = ".45rem";
        bar.style.alignItems = "center";
        bar.style.justifyContent = "space-between";
        if (host.firstChild) host.insertBefore(bar, host.firstChild);
        else host.appendChild(bar);
      }
      bar.innerHTML = '<span>' + escapeHtml(lineText) + '</span>'
        + ((state.role === "player" && state.code)
          ? '<button class="btn btn-xs" onclick="window.campaignSystem.requestResync()">Request Resync</button>'
          : '');
    }
  }

  async function requestResync() {
    if (!state.socket || !state.code) {
      safeNotif("Join a campaign first.", "warn");
      return;
    }
    if (!guardAction("requestResync", "Only campaign players can request a resync.")) return;
    state.lastResyncRequestAt = Date.now();
    setSyncHealth("syncing", "Reconciling...");
    var res = await emitWithAck("campaign:requestResync", {});
    if (!res || !res.ok) {
      safeNotif((res && res.error) || "Could not request resync.", "warn");
      return;
    }
    if (res.stateVersion) {
      state.lastSharedVersion = Math.max(state.lastSharedVersion, Number(res.stateVersion || 0));
    }
    if (res.authoritativeAt) {
      state.lastAuthoritativeAt = Number(res.authoritativeAt || 0) || state.lastAuthoritativeAt;
    }
    if (res.gmOnline === false) {
      safeNotif("Requested resync, but GM is offline. Last snapshot replayed.", "warn");
    } else {
      safeNotif("Requested authoritative resync.", "good");
    }
    refreshSyncHealth();
  }

  function buildCampaignDiagnosticsBundle(authoritativeSnapshot) {
    var shared = getCampaignSharedState();
    var combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
      ? shared.campaignCombat
      : {};
    var soundtrack = ensureGmSettings(shared).soundtrack || {};
    var hooks = getCampaignHooks();
    var chronicle = getCampaignChronicleEntries();
    var roster = buildPartyRoster().map(function (entry) {
      return {
        token: String(entry.token || ""),
        name: String(entry.character && entry.character.name || entry.name || ""),
        role: String(entry.role || ""),
        health: Number(entry.character && entry.character.health || 0),
        maxHealth: Number(entry.character && entry.character.maxHealth || 0),
        mentalStress: Number(entry.character && entry.character.mentalStress || 0),
        maxMentalStress: Number(entry.character && entry.character.maxMentalStress || 0)
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      app: {
        href: String(window.location && window.location.href || ""),
        userAgent: String(navigator && navigator.userAgent || "")
      },
      seat: {
        code: String(state.code || ""),
        role: String(state.role || ""),
        token: String(state.token || ""),
        playerName: String(state.playerName || ensureName() || ""),
        connected: !!state.connected,
        syncHealth: String(state.syncHealth || "idle"),
        syncText: String(state.syncText || ""),
        lastSnapshotAgeSeconds: state.lastCampaignStateAt ? getLastSnapshotAgeSeconds() : null,
        lastAuthoritativeAt: Number(state.lastAuthoritativeAt || 0),
        lastSyncAt: Number(state.lastSyncAt || 0)
      },
      table: {
        tableState: getCampaignTableState(shared),
        readyCheck: deepCloneJson(shared.readyCheck || ensureReadyCheckState(shared)),
        pendingCheckCount: Object.keys((shared.pendingChecks && shared.pendingChecks.active) || {}).length,
        activeRollRequest: deepCloneJson(state.campaign && state.campaign.activeRollRequest || null),
        campaignTravel: deepCloneJson(shared.campaignTravel || null),
        campaignCombat: deepCloneJson(combat || null),
        soundtrack: deepCloneJson(soundtrack || null)
      },
      roster: roster,
      chronicle: {
        count: chronicle.length,
        latest: chronicle.length ? chronicle[0] : null
      },
      hooks: {
        total: hooks.length,
        open: hooks.filter(function (hook) { return String(hook && hook.status || "open") !== "resolved"; }).length,
        latestOpen: hooks.filter(function (hook) { return String(hook && hook.status || "open") !== "resolved"; }).slice(0, 5)
      },
      gmForge: deepCloneJson(shared.gmForge || ensureGmForgeState(shared)),
      authoritativeSnapshot: authoritativeSnapshot || null
    };
  }

  function downloadJsonFile(fileName, value) {
    var text = JSON.stringify(value, null, 2);
    try {
      var blob = new Blob([text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        try { URL.revokeObjectURL(url); } catch (_err) {}
        try { link.remove(); } catch (_err2) {}
      }, 0);
    } catch (_err3) {}
    return text;
  }

  async function exportDiagnosticsBundle() {
    var authoritativeSnapshot = null;
    if (state.role === "gm" && state.socket && state.code) {
      var snapshotRes = await emitWithAck("campaign:exportSnapshot", {});
      if (snapshotRes && snapshotRes.ok && snapshotRes.snapshot) {
        authoritativeSnapshot = snapshotRes.snapshot;
      }
    }
    var bundle = buildCampaignDiagnosticsBundle(authoritativeSnapshot);
    var fileName = "campaign-diagnostics-" + String(state.code || "local") + "-" + Date.now() + ".json";
    downloadJsonFile(fileName, bundle);
    safeNotif("Diagnostics bundle exported.", "good");
    return bundle;
  }

  async function copyDiagnosticsSummary() {
    var bundle = buildCampaignDiagnosticsBundle(null);
    var summary = JSON.stringify({
      generatedAt: bundle.generatedAt,
      seat: bundle.seat,
      table: bundle.table,
      chronicle: bundle.chronicle,
      hooks: bundle.hooks
    }, null, 2);
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(summary);
        safeNotif("Diagnostics summary copied.", "good");
        return true;
      }
    } catch (_err) {}
    if (typeof window.openModal === "function") {
      window.openModal("Diagnostics Summary", '<textarea style="width:100%;min-height:240px;background:#111723;border:1px solid #2a354a;color:var(--text);border-radius:.45rem;padding:.55rem;font-family:monospace;font-size:.75rem;">' + escapeHtml(summary) + '</textarea>');
      return true;
    }
    safeNotif("Clipboard unavailable. Opened summary fallback failed.", "warn");
    return false;
  }

  async function exportSnapshot() {
    if (!state.socket || !state.code) {
      safeNotif("Only connected GM can export snapshots.", "warn");
      return;
    }
    if (!guardAction("exportSnapshot", "Only connected GM can export snapshots.")) return;
    var res = await emitWithAck("campaign:exportSnapshot", {});
    if (!res || !res.ok || !res.snapshot) {
      safeNotif((res && res.error) || "Could not export snapshot.", "warn");
      return;
    }
    var text = JSON.stringify(res.snapshot, null, 2);
    var fileName = "campaign-" + String(state.code || "snapshot") + "-" + Date.now() + ".json";
    try {
      var blob = new Blob([text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        try { URL.revokeObjectURL(url); } catch (_err) {}
        try { link.remove(); } catch (_err) {}
      }, 0);
    } catch (_err) {
      // Fallback path for strict environments.
    }
    safeNotif("Campaign snapshot exported.", "good");
  }

  function importSnapshotPrompt() {
    if (!guardAction("importSnapshot", "Only connected GM can import snapshots.")) return;
    if (typeof window.openModal !== "function") {
      safeNotif("Modal UI unavailable.", "warn");
      return;
    }
    var html = ''
      + '<div style="font-size:.82rem;color:var(--muted2);margin-bottom:.45rem;">Paste a previously exported campaign snapshot JSON.</div>'
      + '<textarea id="campaignImportSnapshotInput" style="width:100%;min-height:190px;background:#111723;border:1px solid #2a354a;color:var(--text);border-radius:.45rem;padding:.55rem;font-family:monospace;font-size:.75rem;"></textarea>'
      + '<div style="display:flex;justify-content:flex-end;gap:.35rem;margin-top:.55rem;">'
      + '<button class="btn btn-sm" onclick="closeModal()">Cancel</button>'
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.importSnapshotFromModal()">Import Snapshot</button>'
      + '</div>';
    window.openModal("Import Campaign Snapshot", html);
  }

  async function importSnapshotFromModal() {
    if (!guardAction("importSnapshot", "Only connected GM can import snapshots.")) return;
    var raw = readUiValue("campaignImportSnapshotInput");
    if (!raw.trim()) {
      safeNotif("Paste snapshot JSON first.", "warn");
      return;
    }
    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_err) {
      safeNotif("Snapshot JSON is invalid.", "warn");
      return;
    }
    var res = await emitWithAck("campaign:importSnapshot", { snapshot: parsed });
    if (!res || !res.ok) {
      safeNotif((res && res.error) || "Could not import snapshot.", "warn");
      return;
    }
    if (typeof window.closeModal === "function") window.closeModal();
    safeNotif("Campaign snapshot imported and broadcast.", "good");
  }

  function getProvinceSelectionMarkers() {
    var shared = getCampaignSharedState();
    var selections = shared && shared.provinceSelections && typeof shared.provinceSelections === "object"
      ? shared.provinceSelections
      : {};
    var roster = state.campaign && Array.isArray(state.campaign.roster) ? state.campaign.roster : [];
    var byToken = {};
    roster.forEach(function (member) {
      if (!member || !member.token) return;
      byToken[String(member.token)] = member;
    });
    var out = [];
    Object.keys(selections).forEach(function (token) {
      var entry = selections[token];
      var key = entry && typeof entry.key === "string" ? entry.key : "";
      if (!key) return;
      var name = entry && entry.name ? String(entry.name) : "";
      var member = byToken[token] || null;
      if (!name && member && member.name) name = String(member.name);
      out.push({
        token: String(token),
        key: key,
        name: name || "Wayfarer",
        at: Number(entry && entry.at || 0),
        isMe: !!(state.token && String(state.token) === String(token)),
        online: !!(member && member.online)
      });
    });
    return out;
  }

  function init() {
    syncWindowStateAlias();
    patchTmwHooks();
    patchMentalStressHooks();
    patchSharedEconomyHooks();
    patchMapGenerationHooks();
    patchSharedProgressHooks();
    patchEncounterVisibilityHooks();
    patchAreaSessionHooks();
    patchCameraLockHooks();
    patchCombatSyncHooks();
    applyPlayerLiteMode();
    refreshProgressHash();
    ensureSocket();
    window.addEventListener("resize", function () { syncDockOffset(); });

    if (typeof window.saveCharacter === "function" && !window._campaignWrappedSaveCharacter) {
      var baseSaveCharacter = window.saveCharacter;
      window.saveCharacter = function () {
        var out = baseSaveCharacter.apply(this, arguments);
        syncCharacterToCampaign(true);
        return out;
      };
      window._campaignWrappedSaveCharacter = true;
    }

    if (typeof window.loadCharacter === "function" && !window._campaignWrappedLoadCharacter) {
      var baseLoadCharacter = window.loadCharacter;
      window.loadCharacter = function () {
        var out = baseLoadCharacter.apply(this, arguments);
        syncCharacterToCampaign(true);
        return out;
      };
      window._campaignWrappedLoadCharacter = true;
    }

    if (typeof window.startCombat === "function" && !window._campaignWrappedStartCombat) {
      var baseStartCombat = window.startCombat;
      window.startCombat = function () {
        var wasActive = !!(window.S && window.S.combat && window.S.combat.active);
        var out = baseStartCombat.apply(this, arguments);
        var isNowActive = !!(window.S && window.S.combat && window.S.combat.active);
        if (!wasActive && isNowActive && state.code && state.connected) {
          startCampaignCombat(null);
        }
        return out;
      };
      window._campaignWrappedStartCombat = true;
    }

    if (typeof window.endCombat === "function" && !window._campaignWrappedEndCombat) {
      var baseEndCombat = window.endCombat;
      window.endCombat = function () {
        var out = baseEndCombat.apply(this, arguments);
        var combatState = ensureCampaignCombatState();
        if (combatState && combatState.active && state.code && state.connected) {
          endCampaignCombat();
        }
        return out;
      };
      window._campaignWrappedEndCombat = true;
    }

    state.ready = true;
  }

  function shouldHydrateCampaignUI() {
    if (state.code || state.connected || state.dockOpen) return true;
    var settingsPanel = document.getElementById("settingsPanel");
    return !!(settingsPanel && settingsPanel.classList.contains("open"));
  }

  function hydrateCampaignUIIfNeeded() {
    if (!shouldHydrateCampaignUI()) return;
    if (!document.getElementById("campaignSettingsSection")) {
      ensureSettingsSection();
    }
    ensureDockPanel();
    ensureMapSyncStatusBars();
    renderGlobalQuickAccess();
    syncDockOffset();
  }

  function scheduleInit() {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(function () {
        init();
      }, { timeout: 1800 });
      return;
    }
    setTimeout(init, 500);
  }

  setInterval(function () {
    syncWindowStateAlias();
    patchTmwHooks();
    patchMentalStressHooks();
    patchSharedEconomyHooks();
    patchMapGenerationHooks();
    patchSharedProgressHooks();
    patchEncounterVisibilityHooks();
    patchAreaSessionHooks();
    patchCameraLockHooks();
    hydrateCampaignUIIfNeeded();
    var syncStateChanged = refreshSyncHealth();
    if (syncStateChanged) {
      renderSettingsSection();
      renderDockPanel();
      ensureMapSyncStatusBars();
    }
    syncCharacterToCampaign(false);
    if (state.connected && state.code && !state.applyingSharedState) {
      var nextProgressHash = getProgressHash();
      if (nextProgressHash && nextProgressHash !== state.lastProgressHash) {
        state.lastProgressHash = nextProgressHash;
        if (state.role === "player") {
          syncPlayerSharedPatch(collectProgressSharedPatch(), "progress-tick");
        }
      }
    }
    if (state.role !== "player") {
      syncSharedState("tick");
    }
    syncCombatSceneHeartbeat("combat-heartbeat");
    if (state.role === "gm" && isStrictGmCameraLockEnabled()) {
      scheduleGmCameraSync("camera-heartbeat", true);
    }
    if (state.role === "player" && isStrictGmCameraLockEnabled()) {
      var shared = getCampaignSharedState();
      var travel = shared && shared.campaignTravel && typeof shared.campaignTravel === "object"
        ? shared.campaignTravel
        : null;
      if (travel && isPlayerViewOutOfLock(travel)) {
        applyCampaignTravelState(travel, { force: true });
      }
    }
  }, 2200);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInit);
  } else {
    scheduleInit();
  }

  window.campaignSystem = {
    createCampaign: createCampaign,
    joinCampaign: joinCampaign,
    leaveCampaign: leaveCampaign,
    callRollRequest: callRollRequest,
    closeActiveRoll: closeActiveRoll,
    openActiveRollPrompt: function () { return openActiveRollPrompt(true); },
    submitActiveRoll: submitActiveRoll,
    submitActiveRollManual: submitActiveRollManual,
    savePrivateNote: savePrivateNote,
    setCampaignPassword: setCampaignPassword,
    toggleArchive: toggleArchive,
    deleteCampaign: deleteCampaign,
    setTimelineFilter: setTimelineFilter,
    setTableSceneMode: setTableSceneMode,
    refreshSceneFocusState: refreshSceneFocusState,
    requestSharedConsent: requestSharedConsent,
    requestSharedWorldAction: requestSharedWorldAction,
    requestPartyRestBoon: requestPartyRestBoon,
    syncProvinceEncounterResult: syncProvinceEncounterResult,
    respondReadyCheck: respondReadyCheck,
    forceApproveReadyCheck: forceApproveReadyCheck,
    cancelReadyCheck: cancelReadyCheck,
    generateWayfarerIdea: generateWayfarerIdea,
    setWayfarerSort: setWayfarerSort,
    sendChatMessage: sendChatMessage,
    broadcastRollResult: broadcastRollResult,
    applyGmEconomyAdjustment: applyGmEconomyAdjustment,
    forceAuthoritativeResync: forceAuthoritativeResync,
    clearProvinceSelections: clearProvinceSelections,
    syncProvinceFocus: syncProvinceFocus,
    showOnboarding: showOnboarding,
    requestResync: requestResync,
    requestRollPrompt: requestRollPrompt,
    getRollPromptTargets: getRollPromptTargets,
    getCampaignCharacterSnapshot: getCampaignCharacterSnapshot,
    getCampaignCharacterName: getCampaignCharacterName,
    getCampaignCharacterDie: getCampaignCharacterDie,
    getPendingCheckById: getPendingCheckById,
    resolveSceneCheckOutcome: resolveSceneCheckOutcome,
    requestSceneCheck: requestSceneCheck,
    registerSceneCheckHandler: registerSceneCheckHandler,
    getGmForgePresets: getGmForgePresets,
    saveGmForgePreset: saveGmForgePreset,
    deleteGmForgePreset: deleteGmForgePreset,
    setGmForgeLastPreset: setGmForgeLastPreset,
    getCampaignChronicleEntries: getCampaignChronicleEntries,
    addCampaignChronicleEntry: addCampaignChronicleEntry,
    getCampaignHooks: getCampaignHooks,
    addCampaignHook: addCampaignHook,
    resolveCampaignHook: resolveCampaignHook,
    reopenCampaignHook: reopenCampaignHook,
    exportDiagnosticsBundle: exportDiagnosticsBundle,
    copyDiagnosticsSummary: copyDiagnosticsSummary,
    exportSnapshot: exportSnapshot,
    importSnapshotPrompt: importSnapshotPrompt,
    importSnapshotFromModal: importSnapshotFromModal,
    clearRecentDockChat: clearRecentDockChat,
    restoreRecentDockChat: restoreRecentDockChat,
    toggleDock: toggleDock,
    openDock: openDock,
    toggleDockTimelinePin: toggleDockTimelinePin,
    jumpDockTimelineLatest: jumpDockTimelineLatest,
    recordEconomyDelta: recordEconomyDelta,
    toggleStrictTeamworkMode: function() {
      var enabled = false;
      if (typeof window.teamworkRulesSystem !== "undefined" && window.teamworkRulesSystem) {
        enabled = !window.teamworkRulesSystem.isStrictMode();
        window.teamworkRulesSystem.setStrictMode(enabled);
      }
      var btn = document.getElementById("campaignStrictModeBtn");
      if (btn) {
        btn.textContent = "Strict Mode " + (enabled ? "ON" : "OFF");
        btn.classList.toggle("btn-red", enabled);
        btn.classList.toggle("btn-green", !enabled);
      }
      renderSettingsSection();
    },
    getProvinceSelectionMarkers: getProvinceSelectionMarkers,
    syncSharedNow: syncSharedNow,
    syncSharedSilent: syncSharedSilent,
    syncSharedPatch: syncSharedPatch,
    shareBackpackItem: shareBackpackItem,
    claimSharedItem: claimSharedItem,
    copyRosterItem: copyRosterItem,
    viewRosterSheet: viewRosterSheet,
    // Phase 1: GM modes and campaign combat
    setGmMode: setGmMode,
    setGmCameraLock: setGmCameraLock,
    setGmSoundtrack: setGmSoundtrack,
    applyCampaignSoundtrackMoodFromUi: applyCampaignSoundtrackMoodFromUi,
    applyCampaignSoundtrackMixFromUi: applyCampaignSoundtrackMixFromUi,
    clearCampaignSoundtrack: clearCampaignSoundtrack,
    refreshCampaignSoundtrackStyleOptions: refreshCampaignSoundtrackStyleOptions,
    syncCampaignSoundtrackMoodToEditor: syncCampaignSoundtrackMoodToEditor,
    startCampaignCombat: startCampaignCombat,
    setCombatActor: setCombatActor,
    promptEnemyAction: promptEnemyAction,
    clearEnemyActionRequest: clearEnemyActionRequest,
    resolveEnemyActionRequest: resolveEnemyActionRequest,
    nextCombatActor: nextCombatActor,
    endCampaignCombat: endCampaignCombat,
    joinSharedCombatMode: joinSharedCampaignCombatMode,
    joinSharedAreaSession: joinSharedCampaignAreaSessionFromPrompt,
    getCurrentCombatActor: getCurrentCombatActor,
    getEnemyActionRequest: function () {
      return getCampaignEnemyActionRequest(ensureCampaignCombatState());
    },
    gmInitiateTravel: gmInitiateTravel,
    promptCampaignTravel: promptCampaignTravel,
    gmAdvanceTime: gmAdvanceTime,
    buildPartyRoster: buildPartyRoster,
    ensureGmSettings: ensureGmSettings,
    ensureCampaignCombatState: ensureCampaignCombatState,
    // Phase 2: Seamless Experience
    submitPlayerAction: submitPlayerAction,
    gmApproveAction: gmApproveAction,
    gmRejectAction: gmRejectAction,
    getPendingActions: getPendingActions,
    getCharacterStatus: getCharacterStatus,
    getPartyStatus: getPartyStatus,
    addItemToCharacterInventory: addItemToCharacterInventory,
    removeItemFromCharacterInventory: removeItemFromCharacterInventory,
    getCharacterInventory: getCharacterInventory,
    getAllCharacterInventories: getAllCharacterInventories,
    // Phase 3: Edge Cases & Robustness
    setCharacterDead: setCharacterDead,
    isCharacterDead: isCharacterDead,
    getDeadCharacters: getDeadCharacters,
    canCharacterAct: canCharacterAct,
    startContestedRoll: startContestedRoll,
    submitContestedRoll: submitContestedRoll,
    getContestedRoll: getContestedRoll,
    setCharacterDice: setCharacterDice,
    getCharacterDice: getCharacterDice,
    getLargestWayfarersLeadDie: getLargestWayfarersLeadDie,
    getAllCharacterDice: getAllCharacterDice,
    getSavedSessionSummary: getSavedCampaignSessionSummary,
    openCampaignRecoveryCenter: openCampaignRecoveryCenter,
    resumeSavedCampaignSession: resumeSavedCampaignSession,
    rejoinSavedCampaignSession: rejoinSavedCampaignSession,
    resumeSavedCampaignSessionFromModal: resumeSavedCampaignSessionFromModal,
    rejoinSavedCampaignSessionFromModal: rejoinSavedCampaignSessionFromModal,
    forgetSavedCampaignSession: forgetSavedCampaignSession,
    forgetSavedCampaignSessionFromModal: forgetSavedCampaignSessionFromModal,
    refreshUI: function () {
      renderSettingsSection();
      renderDockPanel();
      renderGlobalQuickAccess();
    },
    getState: function () {
      return {
        connected: state.connected,
        code: state.code,
        role: state.role,
        token: state.token,
        campaign: state.campaign,
        savedSession: getSavedCampaignSessionSummary()
      };
    },
    getSyncStatus: getSyncStatus,
    setPlayerLiteMode: setPlayerLiteMode,
    isPlayerLiteModeEnabled: isPlayerLiteModeEnabled,
    getSharedState: function () {
      return getCampaignSharedState();
    },
    getLiveActionContract: function () {
      return getCampaignLiveActionContract(getCampaignSharedState(), state.campaign || {});
    },
    syncFactionProgressPatch: syncFactionProgressPatch,
    syncCharacterToCampaign: syncCharacterToCampaign,
    reconnectNow: reconnectNow,
    recoverSyncNow: recoverSyncNow,
    isCampaignPlayerReadOnlyForSharedWorld: isCampaignPlayerReadOnlyForSharedWorld,
    guardSharedWorldMutation: guardSharedWorldMutation,
    guardGmCheckResolution: guardGmCheckResolution,
    startGmPendingCheck: startGmPendingCheck,
    submitPendingCheck: submitPendingCheck,
    applyGmCheckOutcome: applyGmCheckOutcome,
    resolveGmPendingCheck: resolveGmPendingCheck,
    runGmResolvedCheck: runGmResolvedCheck,
    getPendingChecks: getPendingChecks
  };
})();

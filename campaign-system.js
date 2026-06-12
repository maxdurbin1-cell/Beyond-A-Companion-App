// campaign-system.js — Multiplayer campaign rooms with session restore and dock UI
(function () {
  var SESSION_KEY = "beyond-light-campaign-session";
  var STALE_SYNC_MS = 12000;

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
    autoRestoreTried: false,
    restoringSession: false,
    dockOpen: false,
    lastDockLogSize: 0,
    timelineFilter: "all",
    hiddenTimelineKeys: [],
    hiddenTimelineUndoBatches: [],
    lastCharacterHash: "",
    lastAppliedSelfCharacterAt: 0,
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
      joinPassword: ""
    },
    activeRosterSheetToken: "",
    lastCampaignCombatPromptAt: 0,
    lastCampaignTravelAppliedAt: 0,
    lastReadyCheckPromptId: "",
    lastProvinceMapHash: "",
    lastProvinceSelectionsHash: "",
    lastProvinceFocusSyncAt: 0,
    lastCameraViewHash: "",
    lastCameraWorldSyncAt: 0,
    cameraSyncTimer: null,
    cameraSyncReason: "",
    cameraSyncWantsWorld: false,
    combatSceneSyncTimer: null,
    lastCombatSceneHash: "",
    lastPlayerDockSeed: "",
    lastDockActorKey: "",
    dockActorFlashUntil: 0,
    dockTimelinePinned: false,
    dockTimelineUnseen: 0,
    lastDockTimelineEntryKey: "",
    tableSceneMode: "auto",
    effectiveTableSceneMode: "exploration",
    timelineFilterManual: false
  };

  var readyCheckCallbacks = {};

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
    if (activeTab === "character") return false;
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

  function guardSharedWorldMutation(errorText) {
    if (!isCampaignPlayerReadOnlyForSharedWorld()) return true;
    safeNotif(errorText || "Only the GM can change the shared world state in Campaign mode.", "warn");
    return false;
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

    if (travelKey && (state.role === "gm" || isStrictGmCameraLockEnabled(shared))) {
      return travelKey;
    }
    if (localKey) return localKey;
    if (travelKey) return travelKey;
    return incoming ? String(incoming.selectedKey || "") : "";
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
        } else if (tab !== activeTab && typeof window.switchTab === "function") {
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

    if (provinceKey && provinceKey !== activeProvinceKey && typeof window.setProvinceSelectedKey === "function") {
      try { window.setProvinceSelectedKey(provinceKey); } catch (_err) {}
    }

    if (travelAt) {
      state.lastCampaignTravelAppliedAt = travelAt;
    }
  }

  function patchCameraLockHooks() {
    if (window._campaignPatchedCameraLockHooks) return;

    var pendingNavigationSync = null;
    var pendingNavigationTimer = 0;

    function syncCampaignNavigationState(nextContext, nextTab) {
      if (!state.socket || !state.connected || !state.code) return;
      if (state.role !== "gm") return;
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
      travel.reason = String(travel.reason || "navigation");
      travel.phaseCost = Math.max(0, Number(travel.phaseCost || 0) || 0);
      travel.updatedAt = Date.now();
      var out = syncSharedPatch({ campaignTravel: deepCloneJson(travel) || travel }, "navigation-state");
      if (out && typeof out.catch === "function") out.catch(function () {});
    }

    if (typeof window.switchTab === "function") {
      var baseSwitchTab = window.switchTab;
      window.switchTab = function () {
        var out = baseSwitchTab.apply(this, arguments);
        if (state.applyingSharedState) return out;
        syncCampaignNavigationState(window._activeContext || "", String(arguments[0] || ""));
        scheduleGmCameraSync("switch-tab", true);
        return out;
      };
    }

    if (typeof window.setContext === "function") {
      var baseSetContext = window.setContext;
      window.setContext = function () {
        var out = baseSetContext.apply(this, arguments);
        if (state.applyingSharedState) return out;
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
        if (out) scheduleGmCameraSync("province-focus", false);
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
    return {
      combat: deepCloneJson(window.S.combat || {}) || {},
      enemies: Array.isArray(window.S.enemies) ? (deepCloneJson(window.S.enemies) || []) : [],
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
    if (state.combatSceneSyncTimer) clearTimeout(state.combatSceneSyncTimer);
    state.combatSceneSyncTimer = setTimeout(function () {
      state.combatSceneSyncTimer = null;
      if (!state.socket || !state.connected || !state.code || state.applyingSharedState) return;
      var scene = collectCombatSceneState();
      var hash = hashCombatSceneState(scene);
      if (!hash || hash === state.lastCombatSceneHash) return;
      state.lastCombatSceneHash = hash;
      var out = syncSharedPatch({ combatScene: scene }, reason || "combat-scene");
      if (out && typeof out.catch === "function") out.catch(function () {});
    }, 0);
  }

  function syncCombatSceneHeartbeat(reason) {
    if (state.role !== "gm" || !state.socket || !state.connected || !state.code || state.applyingSharedState) return;
    var scene = collectCombatSceneState();
    var hash = hashCombatSceneState(scene);
    if (!hash || hash === state.lastCombatSceneHash) return;
    state.lastCombatSceneHash = hash;
    var out = syncSharedPatch({ combatScene: scene }, reason || "combat-scene-heartbeat");
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

  function getPendingChecks() {
    var checks = ensurePendingChecksState(getCampaignSharedState());
    return deepCloneJson(checks) || { active: {}, history: [] };
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

  function findOnlineParticipantTokens() {
    var out = [];
    var seen = {};
    var participants = state.campaign && Array.isArray(state.campaign.participants) ? state.campaign.participants : [];
    var roster = state.campaign && Array.isArray(state.campaign.roster) ? state.campaign.roster : [];
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

    roster.forEach(function (member) {
      if (!member || !member.online) return;
      var token = String(member.token || "").trim();
      if (!token || seen[token]) return;
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
    var html = ''
      + '<div style="font-size:.84rem;color:var(--text2);line-height:1.6;margin-bottom:.5rem;">Party consent required before: <strong style="color:var(--gold2);">' + escapeHtml(label) + '</strong>.</div>'
      + '<div style="font-size:.76rem;color:var(--muted2);margin-bottom:.55rem;">Choose ready or not ready. GM can proceed after all are ready.</div>'
      + '<div style="display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;">'
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.respondReadyCheck(true);closeModal();">Ready</button>'
      + '<button class="btn btn-sm btn-warn" onclick="window.campaignSystem.respondReadyCheck(false);closeModal();">Not Ready</button>'
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

  function advanceSharedGameDate(intervals) {
    var count = Math.max(1, Math.min(8, Number(intervals || 1) || 1));
    if (typeof window.S === "undefined" || !window.S) return count;
    if (!window.S.gameDate || typeof window.S.gameDate !== "object") {
      window.S.gameDate = { day: 1, month: 1, year: 1, phase: 0 };
    }
    var d = window.S.gameDate;
    for (var i = 0; i < count; i++) {
      if (typeof window.advanceProvincePhasePenalty === "function") {
        window.advanceProvincePhasePenalty(1);
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

  function refreshSettingsModeFromCampaign() {
    if (!window.settingsSystem || typeof window.settingsSystem.setGameMode !== "function") return;
    if (!state.code) {
      window.settingsSystem.setGameMode("solo", { silent: true });
      return;
    }
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
    if (typeof window.S === "undefined" || !window.S) return {};
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
      credits: Math.max(0, Number(window.S.credits || 0)),
      renown: Math.max(0, Number(window.S.renown || 0)),
      mentalStress: Math.max(0, Number((typeof current.mentalStress === "number" ? current.mentalStress : window.S.mentalStress) || 0)),
      missionTokens: deepCloneJson(window.S.missionTokens || {}),
      activeMissions: deepCloneJson(window.S.activeMissions || []),
      completedMissions: deepCloneJson(window.S.completedMissions || []),
      availableJobs: deepCloneJson(window.S.availableJobs || []),
      storyline: deepCloneJson(window.S.storyline || {}),
      caravan: deepCloneJson(window.S.caravan || {}),
      holding: deepCloneJson(window.S.holding || {}),
      starship: deepCloneJson(window.S.starship || {}),
      factionRenown: deepCloneJson(window.S.factionRenown || {}),
      factionBases: deepCloneJson(window.S.factionBases || {}),
      factionWayfarerTasks: deepCloneJson(window.S.factionWayfarerTasks || []),
      factionNarrative: deepCloneJson(window.S.factionNarrative || {}),
      rival: deepCloneJson((window.S.rival && typeof window.S.rival === "object" ? window.S.rival : current.rival) || null),
      partyStash: Array.isArray(current.partyStash) ? current.partyStash.slice() : [],
      economyLedger: mergeEconomyLedger(current.economyLedger),
      provinceSelections: existingSelections,
      readyCheck: deepCloneJson(current.readyCheck || ensureReadyCheckState(current)),
      pendingChecks: deepCloneJson(current.pendingChecks || ensurePendingChecksState(current)),
      sessionTimeline: deepCloneJson(current.sessionTimeline || ensureSessionTimelineState(current))
    };
    var shouldPushAuthoritativeMaps = (state.role === "gm") || !state.code;
    if (shouldPushAuthoritativeMaps && typeof window.getProvinceMapState === "function") {
      shared.provinceMap = deepCloneJson(window.getProvinceMapState() || null);
    }
    if (shouldPushAuthoritativeMaps) {
      shared.lastSea = deepCloneJson(window.S.lastSea || {});
      shared.starSystem = deepCloneJson(window.S.starSystem || {});
      shared.worldThatWas = deepCloneJson(window.S.worldThatWas || {});
      shared.gameDate = deepCloneJson(window.S.gameDate || {});
      shared.combatScene = collectCombatSceneState();
      shared.gmSettings = deepCloneJson(current.gmSettings || ensureGmSettings());
      shared.campaignCombat = deepCloneJson(current.campaignCombat || ensureCampaignCombatState());
      shared.campaignTravel = deepCloneJson(current.campaignTravel || ensureCampaignTravelState());
      shared.actionQueue = deepCloneJson(current.actionQueue || ensureActionQueue());
      shared.characterInventories = deepCloneJson(current.characterInventories || ensureCharacterInventories());
      shared.characterDeathStates = deepCloneJson(current.characterDeathStates || ensureCharacterDeathStates());
      shared.contestedRolls = deepCloneJson(current.contestedRolls || ensureContestedRolls());
      shared.characterDice = deepCloneJson(current.characterDice || ensureCharacterDice());
      if (window.S.worldState && typeof window.S.worldState === "object") {
        shared.worldState = deepCloneJson(window.S.worldState);
      }
    }
    return shared;
  }

  function collectProgressSharedPatch() {
    if (typeof window.S === "undefined" || !window.S) return {};
    return {
      renown: Math.max(0, Number(window.S.renown || 0)),
      credits: Math.max(0, Number(window.S.credits || 0)),
      mentalStress: Math.max(0, Number(window.S.mentalStress || 0)),
      missionTokens: deepCloneJson(window.S.missionTokens || {}),
      activeMissions: deepCloneJson(window.S.activeMissions || []),
      completedMissions: deepCloneJson(window.S.completedMissions || []),
      availableJobs: deepCloneJson(window.S.availableJobs || []),
      storyline: deepCloneJson(window.S.storyline || {}),
      holding: deepCloneJson(window.S.holding || {}),
      caravan: deepCloneJson(window.S.caravan || {}),
      factionWayfarerTasks: deepCloneJson(window.S.factionWayfarerTasks || []),
      factionNarrative: deepCloneJson(window.S.factionNarrative || {}),
      factionRenown: deepCloneJson(window.S.factionRenown || {}),
      factionBases: deepCloneJson(window.S.factionBases || {}),
      rival: deepCloneJson(window.S.rival || {}),
      worldState: deepCloneJson(window.S.worldState || {})
    };
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

  function applySharedState(sharedState, sharedVersion) {
    if (!sharedState || typeof sharedState !== "object") return;
    var nextVersion = Math.max(0, Number(sharedVersion || 0) || 0);
    if (nextVersion && nextVersion < state.lastSharedVersion) return;
    if (typeof window.S === "undefined" || !window.S) return;

    var localStarState = cloneClientLocalStarState();
    var localWorldState = cloneClientLocalWorldState();
    var localSeaState = cloneClientLocalSeaState();
    var localProvinceState = cloneClientLocalProvinceState();
    var nextProvinceSelectionsHash = safeJsonHash(sharedState.provinceSelections || {});
    var provinceSelectionsChanged = nextProvinceSelectionsHash !== state.lastProvinceSelectionsHash;

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
        window.S.gameDate = deepCloneJson(sharedState.gameDate) || {};
      }
      if (sharedState.combatScene && typeof sharedState.combatScene === "object") {
        window.S.combat = deepCloneJson(sharedState.combatScene.combat || {}) || {};
        window.S.enemies = Array.isArray(sharedState.combatScene.enemies) ? (deepCloneJson(sharedState.combatScene.enemies) || []) : [];
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
        }
        if (sharedState.combatScene.syncMeta && typeof sharedState.combatScene.syncMeta === "object") {
          window.S.combat.sceneSyncMeta = deepCloneJson(sharedState.combatScene.syncMeta) || null;
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
      }
      if (sharedState.gmSettings && typeof sharedState.gmSettings === "object") {
        var current = getCampaignSharedState() || {};
        if (!current.gmSettings) current.gmSettings = {};
        Object.assign(current.gmSettings, sharedState.gmSettings);
      }
      if (sharedState.campaignCombat && typeof sharedState.campaignCombat === "object") {
        var current = getCampaignSharedState() || {};
        if (!current.campaignCombat) current.campaignCombat = {};
        Object.assign(current.campaignCombat, sharedState.campaignCombat);
        var combatStartedAt = Number(current.campaignCombat.startedAt || 0);
        if (current.campaignCombat.active && combatStartedAt && combatStartedAt !== state.lastCampaignCombatPromptAt) {
          state.lastCampaignCombatPromptAt = combatStartedAt;
          safeNotif("Campaign combat started. Enter the Combat tab to join initiative.", "warn");
        }
        if (!current.campaignCombat.active) {
          state.lastCampaignCombatPromptAt = 0;
        }
      }
      if (sharedState.campaignTravel && typeof sharedState.campaignTravel === "object") {
        var current = getCampaignSharedState() || {};
        if (!current.campaignTravel) current.campaignTravel = {};
        Object.assign(current.campaignTravel, deepCloneJson(sharedState.campaignTravel) || {});
        applyCampaignTravelState(current.campaignTravel);
      }
      if (sharedState.readyCheck && typeof sharedState.readyCheck === "object") {
        var current = getCampaignSharedState() || {};
        current.readyCheck = deepCloneJson(sharedState.readyCheck) || ensureReadyCheckState(current);
        if (String(current.readyCheck.status || "") !== "pending") {
          state.lastReadyCheckPromptId = "";
        }
      }
      if (sharedState.pendingChecks && typeof sharedState.pendingChecks === "object") {
        var current = getCampaignSharedState() || {};
        current.pendingChecks = deepCloneJson(sharedState.pendingChecks) || ensurePendingChecksState(current);
      }
      if (Array.isArray(sharedState.sessionTimeline)) {
        var current = getCampaignSharedState() || {};
        current.sessionTimeline = deepCloneJson(sharedState.sessionTimeline) || [];
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
        var nextProvinceMapHash = safeJsonHash(sharedState.provinceMap);
        if (nextProvinceMapHash !== state.lastProvinceMapHash) {
          var provincePayload = deepCloneJson(sharedState.provinceMap) || {};
          provincePayload.selectedKey = resolveProvinceSelectionKeyForSharedState(sharedState, localProvinceState, provincePayload);
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
    if (window.S && window.S.starSystem && window.S.starSystem.activeSpaceEncounter && typeof window.renderSpaceEncounterPanel === "function") {
      try { window.renderSpaceEncounterPanel(); } catch (_err) {}
    }
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
    if (provinceSelectionsChanged && typeof window.renderHexMap === "function") window.renderHexMap();
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
      if (shared && shared.readyCheck) {
        promptReadyCheckIfNeeded(shared.readyCheck);
        maybeResolveReadyCheck();
      }
    } catch (_err) {}

    state.lastSharedVersion = nextVersion || state.lastSharedVersion;
    state.lastSharedHash = JSON.stringify(sharedState);
    refreshProgressHash();
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
    var shared = collectSharedState();
    var hash = JSON.stringify(shared);
    if (!hash || hash === state.lastSharedHash) return;
    var res = await pushSharedState(shared, reason || "auto");
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

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        code: formatCode(parsed.code || ""),
        token: String(parsed.token || "").trim(),
        name: String(parsed.name || "").trim().slice(0, 32),
        role: parsed.role === "gm" ? "gm" : "player"
      };
    } catch (_err) {
      return null;
    }
  }

  function persistSession() {
    if (!state.code || !state.token) return;
    var payload = {
      code: state.code,
      token: state.token,
      name: state.playerName || ensureName(),
      role: state.role === "gm" ? "gm" : "player"
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (_err) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (_err) {}
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
        currentActorIndex: 0,
        participants: []
      };
    }
    return sharedState.campaignCombat;
  }

  // Get or initialize GM settings (gmMode, visibility, etc)
  function ensureGmSettings(sharedState) {
    if (!sharedState) sharedState = getMutableCampaignSharedState();
    if (!sharedState.gmSettings) {
      sharedState.gmSettings = {
        mode: "passive", // "passive" | "active" | "facilitative"
        travelMode: "gm-led", // who can initiate travel
        combatMode: "turn-based", // combat style
        cameraLock: true
      };
    }
    if (typeof sharedState.gmSettings.cameraLock !== "boolean") {
      sharedState.gmSettings.cameraLock = true;
    }
    return sharedState.gmSettings;
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
    if (!state.campaign || !state.campaign.participants) return [];
    var roster = [];
    state.campaign.participants.forEach(function(participant) {
      if (!participant.character) return;
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

  // Start campaign combat: establish turn order based on initiative (valor roll)
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
      combatState.active = true;
      combatState.round = 1;
      combatState.currentActorIndex = 0;

      // Build turn order: Wayfarers first (highest Valor first), then enemies.
      var roster = (Array.isArray(participants) ? participants : buildPartyRoster()).slice();
      roster.sort(function(a, b) {
        var advA = Number((a.character && a.character.stats && (a.character.stats.valor)) || 0);
        var advB = Number((b.character && b.character.stats && (b.character.stats.valor)) || 0);
        return advB - advA;
      });

      var enemyList = [];
      var gameState = syncWindowStateAlias() || resolveGameState() || (typeof window !== "undefined" ? window.S : null);
      var enemiesSource = gameState && Array.isArray(gameState.enemies) ? gameState.enemies : [];
      enemiesSource.forEach(function (enemy, idx) {
          if (!enemy || enemy.ally) return;
          var enemyName = String(enemy.name || ("Enemy " + (idx + 1)));
          var baseToken = String(enemy.id != null ? enemy.id : ("enemy-" + idx));
          enemyList.push({ token: "enemy:" + baseToken + ":turn1", name: enemyName + " (Turn 1)" });
          enemyList.push({ token: "enemy:" + baseToken + ":turn2", name: enemyName + " (Turn 2)" });
      });

      combatState.turnOrder = roster.map(function (p) { return String(p.token || ""); }).filter(Boolean);
      enemyList.forEach(function (enemy) {
        combatState.turnOrder.push(enemy.token);
      });

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

      var enemies = enemyList.map(function (enemy) {
        return {
          token: enemy.token,
          name: enemy.name,
          role: "enemy",
          isEnemy: true,
          isDead: false,
          hasActed: false
        };
      });

      combatState.participants = wayfarers.concat(enemies);
      combatState.startedAt = Date.now();
      combatState.startedBy = String(state.playerName || ensureName() || "Wayfarer");
      sharedState.campaignCombat = deepCloneJson(combatState) || combatState;
      appendSessionTimeline("combat", "Campaign combat started.", {
        startedBy: combatState.startedBy,
        participants: Array.isArray(combatState.turnOrder) ? combatState.turnOrder.length : 0
      });

      if (state.code && state.connected) {
        if (state.role === "player") {
          syncPlayerSharedPatch({ campaignCombat: deepCloneJson(combatState) || {} }, "start-campaign-combat-player");
        } else {
          var startPatch = syncSharedPatch({ campaignCombat: sharedState.campaignCombat }, "start-campaign-combat");
          if (startPatch && typeof startPatch.catch === "function") {
            startPatch.catch(function () {});
          }
        }
        broadcastRollResult(
          "Campaign Combat",
          "Initiative opened by " + combatState.startedBy + ". Wayfarers act first; each enemy acts twice per round."
        );
      }
      if (callback) callback({ ok: true });
    } catch (err) {
      if (callback) callback({ ok: false, error: String(err) });
    }
  }

  // Get current actor in turn order
  function getCurrentCombatActor() {
    var combatState = ensureCampaignCombatState();
    if (!combatState.active || !Array.isArray(combatState.turnOrder) || combatState.turnOrder.length === 0) {
      return null;
    }
    var idx = Math.max(0, Math.min(combatState.currentActorIndex, combatState.turnOrder.length - 1));
    return combatState.turnOrder[idx] || null;
  }

  // Advance to next actor in turn order
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

      var orderSize = combatState.turnOrder.length;
      var actorIndex = Math.max(0, Math.min(Number(combatState.currentActorIndex || 0), orderSize - 1));
      var actorToken = String(combatState.turnOrder[actorIndex] || "");

      // Mark current actor as acted
      if (Array.isArray(combatState.participants) && actorToken) {
        for (var pIdx = 0; pIdx < combatState.participants.length; pIdx += 1) {
          var row = combatState.participants[pIdx];
          if (!row || String(row.token || "") !== actorToken) continue;
          row.hasActed = true;
          break;
        }
      }

      combatState.currentActorIndex = actorIndex + 1;
      if (combatState.currentActorIndex >= orderSize) {
        combatState.currentActorIndex = 0;
        combatState.round += 1;
        // Reset hasActed for new round
        if (Array.isArray(combatState.participants)) {
          for (var i = 0; i < combatState.participants.length; i++) {
            combatState.participants[i].hasActed = false;
          }
        }
      }

      var sharedState = getMutableCampaignSharedState();
      sharedState.campaignCombat = deepCloneJson(combatState) || combatState;

      if (state.code && state.connected) {
        var patchOut = syncSharedPatch({ campaignCombat: sharedState.campaignCombat }, "next-combat-turn");
        if (patchOut && typeof patchOut.catch === "function") {
          patchOut.catch(function () {});
        }
      }
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
      combatState.currentActorIndex = 0;
      combatState.participants = [];
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
      }
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
        syncSharedPatch({ gmSettings: { cameraLock: !!enabled } }, "set-gm-camera-lock").then(function (res) {
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

  async function syncPlayerSharedPatch(patch, reason) {
    if (!state.socket || !state.connected || !state.code) return { ok: false, error: "Not connected." };
    if (!patch || typeof patch !== "object") return { ok: false, error: "Invalid patch." };
    var safePatch = sanitizePlayerSharedPatch(patch);
    if (!Object.keys(safePatch).length) {
      maybeNotifyPlayerPatchGuardrail(reason || "player-patch");
      return { ok: false, error: "No permitted player patch keys." };
    }
    var gmSettings = ensureGmSettings();
    if (String(gmSettings.mode || "passive") === "active") {
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
    return pushSharedState(patch, reason || "gm-shared-patch");
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
    if (!state.campaign || !state.campaign.participants) return null;
    var participant = state.campaign.participants.get(token);
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
    if (!state.campaign || !state.campaign.participants) return [];
    var statuses = [];
    state.campaign.participants.forEach(function(participant, token) {
      if (participant.character) {
        statuses.push(getCharacterStatus(token));
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
      var p = state.campaign && state.campaign.participants ? state.campaign.participants.get(token) : null;
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
    return {
      name: ensureName(),
      health: Math.max(0, Number(hp || 0)),
      maxHealth: maxHealth,
      mentalStress: Math.max(0, Number(mentalStress || 0)),
      maxMentalStress: maxMentalStress,
      stress: Math.max(0, Number(mentalStress || 0)),
      pathTokens: Math.max(0, Number((typeof window.S !== "undefined" && window.S && window.S.pathTokens) || 0)),
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
    var nextPathTokens = Math.max(0, Number(character.pathTokens || 0));
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
    if (Number(window.S.pathTokens || 0) !== nextPathTokens) {
      window.S.pathTokens = nextPathTokens;
      changed = true;
    }

    state.lastAppliedSelfCharacterAt = updatedAt || Date.now();
    state.lastCharacterHash = JSON.stringify(collectCharacterSummary());

    if (!changed) return false;
    if (typeof window.updateStressUI === "function") window.updateStressUI();
    if (typeof window.updateMentalStressUI === "function") window.updateMentalStressUI();
    var pathTokenEl = document.getElementById("pathTokensVal");
    if (pathTokenEl) pathTokenEl.textContent = String(window.S.pathTokens || 0);
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
      ? details.characterDelta
      : {};
    var sharedDelta = details.sharedDelta && typeof details.sharedDelta === "object"
      ? details.sharedDelta
      : {};

    return emitWithAck("campaign:gmApplyCheckOutcome", {
      checkId: String(details.checkId || "").slice(0, 80),
      label: String(details.label || "Campaign Check").slice(0, 120),
      outcome: String(details.outcome || "success").toLowerCase() === "failure" ? "failure" : "success",
      scope: String(details.scope || (targetTokens.length > 1 ? "party" : "individual")).slice(0, 24),
      targetTokens: targetTokens,
      characterDelta: {
        health: Number(characterDelta.health || 0) || 0,
        mentalStress: Number(characterDelta.mentalStress || 0) || 0,
        pathTokens: Number(characterDelta.pathTokens || 0) || 0
      },
      sharedDelta: {
        tmw: Number(sharedDelta.tmw || 0) || 0
      }
    });
  }

  async function shareBackpackItem(slotIndex) {
    if (typeof window.S === "undefined" || !window.S) return;
    if (!Array.isArray(window.S.backpack)) {
      safeNotif("No backpack items to share.", "warn");
      return;
    }
    var idx = Math.max(0, Number(slotIndex || 0));
    var item = normalizeItemLabel(window.S.backpack[idx]);
    if (!item) {
      safeNotif("That backpack slot is empty.", "warn");
      return;
    }
    var res = await emitWithAck("campaign:stashShare", { item: item });
    if (!res.ok) {
      safeNotif(res.error || "Could not share item.", "warn");
      return;
    }
    window.S.backpack[idx] = "";
    if (typeof window.renderBackpackUI === "function") window.renderBackpackUI();
    syncCharacterToCampaign(true);
    safeNotif("Shared item to party stash: " + item, "good");
  }

  async function claimSharedItem(stashIndex) {
    var hasSlot = Array.isArray(window.S && window.S.backpack) && window.S.backpack.indexOf("") >= 0;
    if (!hasSlot) {
      safeNotif("Backpack full.", "warn");
      return;
    }
    var shared = getCampaignSharedState();
    var list = Array.isArray(shared.partyStash) ? shared.partyStash.slice() : [];
    var idx = Math.max(0, Number(stashIndex || 0));
    // Capture item name locally before the server removes it from the stash.
    var localItem = normalizeItemLabel(list[idx]);
    if (!localItem) {
      safeNotif("That party stash item is no longer available.", "warn");
      return;
    }
    var res = await emitWithAck("campaign:stashClaim", { index: idx });
    if (!res.ok) {
      safeNotif(res.error || "Could not claim party item.", "warn");
      return;
    }
    // Prefer server-confirmed item name; fall back to the locally-read value so the
    // slot text is never blank even if the server ack arrives before the state snapshot.
    var claimedItem = normalizeItemLabel((res && res.item) || localItem);
    if (!claimedItem) {
      safeNotif("Claimed item, but item name was empty. Check your backpack.", "warn");
      return;
    }
    if (!addItemToBackpack(claimedItem)) {
      safeNotif("Claimed item, but backpack storage failed.", "warn");
      return;
    }
    // Re-render manually in case the incoming state snapshot clears the slot before renderBackpackUI.
    if (typeof window.renderBackpackUI === "function") {
      setTimeout(function () { window.renderBackpackUI(); }, 80);
    }
    syncCharacterToCampaign(true);
    safeNotif("Claimed from party stash: " + claimedItem, "good");
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
  }

  function renderSettingsSection() {
    var section = document.getElementById("campaignSettingsSection");
    if (!section) return;

    captureDraftInputs();

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
    var strictCameraLock = !!(gmSettings && gmSettings.cameraLock);
    var isGm = state.role === "gm";
    var sessionTimeline = Array.isArray(sharedState.sessionTimeline)
      ? sharedState.sessionTimeline
      : ensureSessionTimelineState(sharedState);
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
        + '<div class="campaign-muted" style="margin-top:.22rem;">You can still open <strong style="color:var(--gold2);">Character</strong> any time to review stats, weapons, and inventory.</div>'
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
      + playerCameraLockBannerHtml
      + quickStartHtml
      + playerLiveTableHtml
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
          + '<button class="btn btn-xs" onclick="window.campaignSystem.nextCombatActor()"' + riskyDisabledAttr + '>Next Actor</button>'
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
      + '<div class="campaign-card-title">Session Recap Timeline</div>'
      + renderSessionTimeline(sessionTimeline, 18)
      + "</div>"
      + '<div class="campaign-card">'
      + '<div class="campaign-card-title">Shared Economy Ledger</div>'
      + renderEconomyLedger(economyLedger, 14)
      + "</div>";

    bindDraftInputs();
    applyGmCompactLayout();
    applyPlayerCompactLayout();
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
      "Online Members": true
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
      "Online Members": true
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
      "Shared Economy Ledger": true
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
    var idx = Math.max(0, Math.min(Number(combatState.currentActorIndex || 0), combatState.turnOrder.length - 1));
    var token = String(combatState.turnOrder[idx] || "");
    var row = findCampaignCombatParticipant(combatState, token);
    var fallbackName = token.indexOf("enemy:") === 0
      ? token.replace(/^enemy:/, "").replace(/:turn\d+$/, "")
      : (token || "Wayfarer");
    return {
      active: true,
      key: token + ":" + Math.max(1, Number(combatState.round || 1)),
      token: token,
      name: String((row && row.name) || fallbackName || "Wayfarer"),
      round: Math.max(1, Number(combatState.round || 1)),
      index: idx + 1,
      total: combatState.turnOrder.length,
      isEnemy: !!(row && row.isEnemy),
      hasActed: !!(row && row.hasActed),
      isMe: !!(state.token && token && String(state.token) === token)
    };
  }

  function renderDockPanel() {
    var root = document.getElementById("campaignDock");
    if (!root) {
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

    root.classList.toggle("campaign-scene-narrative", sceneMode === "narrative");
    root.classList.toggle("campaign-scene-exploration", sceneMode === "exploration");
    root.classList.toggle("campaign-scene-combat", sceneMode === "combat");
    applyGlobalSceneFocus(sceneMode);
    state.effectiveTableSceneMode = sceneMode;
    if (state.tableSceneMode === "auto") {
      applySceneTimelinePreset(sceneMode, false);
    }

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

      if (actor.active) {
        var now = Date.now();
        if (actor.key && actor.key !== state.lastDockActorKey) {
          state.lastDockActorKey = actor.key;
          state.dockActorFlashUntil = now + 3200;
        }
        var actorCardClass = "campaign-dock-status-card" + (state.dockActorFlashUntil > now ? " is-flash" : "");
        var actorTurnText = actor.isMe
          ? "your call to act"
          : (actor.isEnemy ? "storyteller resolves enemy action" : "waiting on that wayfarer");
        cards.push(''
          + '<div class="' + actorCardClass + '">'
          + '<div class="campaign-dock-status-label">Current Actor</div>'
          + '<div class="campaign-dock-status-main">' + escapeHtml(actor.name)
          + (actor.isEnemy ? ' <span class="campaign-dock-status-tag enemy">Enemy</span>' : ' <span class="campaign-dock-status-tag ally">Wayfarer</span>')
          + (actor.isMe ? ' <span class="campaign-dock-status-tag ally">Your Turn</span>' : '')
          + '</div>'
          + '<div class="campaign-dock-status-sub">Round ' + actor.round + ' · Turn ' + actor.index + '/' + actor.total + (actor.hasActed ? ' · already acted' : ' · ' + escapeHtml(actorTurnText)) + '</div>'
          + '</div>');
      } else {
        state.lastDockActorKey = "";
        state.dockActorFlashUntil = 0;
      }

      if (readyCheck && readyCheck.id && readyStatus !== "idle") {
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
        ? ('<div class="campaign-dock-status-grid">' + cards.join("") + '</div>')
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
            ? '<div class="campaign-dock-roll-actions"><button class="btn btn-xs btn-teal" onclick="window.campaignSystem.submitActiveRoll()">Roll Now</button></div>'
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

    var session = loadSession();
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
      clearSession();
      safeNotif("Saved campaign session could not be restored.", "warn");
      renderSettingsSection();
      renderDockPanel();
      return;
    }

    state.code = res.code;
    state.role = res.role;
    state.token = String(res.token || "");
    state.playerName = String(res.name || session.name || ensureName());
    state.activePromptId = "";
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

      var incomingVersion = snapshot && snapshot.shared ? Number(snapshot.shared.stateVersion || 0) : 0;
      state.lastServerStateVersion = Math.max(state.lastServerStateVersion, incomingVersion);

      var nextTmw = snapshot && snapshot.shared ? Number(snapshot.shared.tmw || 0) : null;
      if (nextTmw !== null && nextTmw !== getTmwValue()) {
        setLocalTmw(nextTmw);
      }

      if (incomingVersion && state.lastSharedVersion && incomingVersion < state.lastSharedVersion) {
        setSyncHealth("stale", "Reconciling...");
        maybeDeterministicReconcile("version-drift");
      }

      applySharedState(
        snapshot && snapshot.shared ? snapshot.shared.state : null,
        snapshot && snapshot.shared ? snapshot.shared.stateVersion : 0
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

  function maybePromptActiveRoll(activeRequest) {
    if (!activeRequest || !activeRequest.id) return;
    if (state.role === "gm") return;
    var targetToken = String(activeRequest.targetToken || "");
    if (targetToken && String(state.token || "") !== targetToken) return;
    if (state.activePromptId === activeRequest.id) return;
    state.activePromptId = activeRequest.id;

    var stat = String(activeRequest.stat || "valor");
    var dread = Number(activeRequest.dread || 8);
    var html = ""
      + '<div style="font-size:.82rem;color:var(--muted2);margin-bottom:.45rem;">GM requested a synchronized campaign roll.</div>'
      + '<div style="font-size:.9rem;color:var(--text2);margin-bottom:.55rem;"><strong>' + escapeHtml(activeRequest.label || "Dread Check") + '</strong><br>'
      + 'Roll <strong style="color:var(--teal);">' + escapeHtml(stat.toUpperCase()) + '</strong> against <strong style="color:var(--red2);">Dread d' + dread + '</strong>.</div>'
      + '<div style="display:flex;gap:.35rem;justify-content:flex-end;">'
      + '<button class="btn btn-sm btn-teal" onclick="window.campaignSystem.submitActiveRoll()">Roll Now</button>'
      + '<button class="btn btn-sm" onclick="closeModal()">Later</button>'
      + "</div>";

    if (typeof window.openModal === "function") {
      window.openModal("Campaign Roll Request", html);
    }
    safeNotif("GM called a campaign roll.", "info");
  }

  function getOnboardingSteps() {
    var shared = getCampaignSharedState();
    var provinceMap = shared && shared.provinceMap ? shared.provinceMap : (typeof window.getProvinceMapState === "function" ? window.getProvinceMapState() : null);
    var provinceReady = !!(provinceMap && Array.isArray(provinceMap.mapData) && provinceMap.mapData.length);
    var seaReady = !!(window.S && window.S.lastSea && Array.isArray(window.S.lastSea.map) && window.S.lastSea.map.length);
    var galaxyReady = !!(window.S && window.S.starSystem && Array.isArray(window.S.starSystem.hexes) && window.S.starSystem.hexes.length);
    var worldReady = !!(window.S && window.S.worldThatWas && Array.isArray(window.S.worldThatWas.hexes) && window.S.worldThatWas.hexes.length);
    return {
      inCampaign: !!(state.code && state.connected),
      provinceReady: provinceReady,
      seaReady: seaReady,
      galaxyReady: galaxyReady,
      worldReady: worldReady,
      mapsReady: provinceReady || seaReady || galaxyReady || worldReady
    };
  }

  function renderOnboardingHtml() {
    var steps = getOnboardingSteps();
    var roleText = state.role === "gm" ? "GM" : (state.role === "player" ? "Player" : "Not joined");
    var mapSummary = [
      steps.provinceReady ? "Province" : "-",
      steps.seaReady ? "Last Sea" : "-",
      steps.galaxyReady ? "Galaxy" : "-",
      steps.worldReady ? "World" : "-"
    ].join(" / ");
    return ""
      + '<div style="font-size:.82rem;color:var(--muted2);line-height:1.6;">'
      + '<strong style="color:var(--text);">Campaign Quickstart</strong><br>'
      + 'Role: <strong style="color:var(--gold2);">' + escapeHtml(roleText) + '</strong><br>'
      + 'Shared map state: <strong style="color:var(--teal);">' + escapeHtml(mapSummary) + '</strong>'
      + '</div>'
      + '<div style="margin-top:.55rem;display:grid;gap:.4rem;">'
      + '<div>' + (steps.inCampaign ? '✅' : '⬜') + ' Join/Create campaign and confirm your role.</div>'
      + '<div>' + (steps.mapsReady ? '✅' : '⬜') + ' GM generates map(s). Shared state auto-syncs every ~1.2s.</div>'
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
    if (!ensureSocket()) {
      safeNotif("Multiplayer requires running the local campaign server.", "warn");
      return;
    }

    var name = readUiValue("campaignNameInput").trim() || ensureName();
    var joinPass = readUiValue("campaignPasswordInput");
    state.playerName = name;
    state.uiDraft.name = name;

    var res = await emitWithAck("campaign:create", { name: name, password: joinPass });
    if (!res.ok) {
      safeNotif(res.error || "Could not create campaign.", "warn");
      return;
    }

    state.code = res.code;
    state.role = "gm";
    state.token = String(res.token || "");
    state.playerName = String(res.name || name || "GM");
    state.activePromptId = "";
    state.lastAppliedSelfCharacterAt = 0;
    state.lastCharacterHash = "";
    state.uiDraft.code = res.code;
    state.uiDraft.joinPassword = "";
    persistSession();

    refreshSettingsModeFromCampaign();
    maybePrimePlayerDock();
    closeCampaignOnboardingIfOpen();

    safeNotif("Campaign created. Share code " + res.code + ".", "good");
    syncCharacterToCampaign(true);
    renderSettingsSection();
    renderDockPanel();
  }

  async function joinCampaign(role, options) {
    if (!ensureSocket()) {
      safeNotif("Multiplayer requires running the local campaign server.", "warn");
      return;
    }

    var opts = options || {};
    var session = loadSession();

    var name = (opts.name || readUiValue("campaignNameInput") || "").trim() || ensureName();
    var codeRaw = opts.code || readUiValue("campaignCodeInput") || (session ? session.code : "");
    var code = formatCode(codeRaw);
    var joinPass = opts.password || readUiValue("campaignPasswordInput") || "";
    var requestedRole = role === "gm" ? "gm" : "player";

    if (!code) {
      if (!opts.silent) safeNotif("Enter a campaign code to join.", "warn");
      return;
    }

    state.playerName = name;
    state.uiDraft.name = name;
    state.uiDraft.code = code;
    state.uiDraft.joinPassword = joinPass;

    // Reuse token only when role and campaign code match the active/saved session.
    var activeToken = (state.code === code && state.role === requestedRole) ? String(state.token || "") : "";
    var sessionToken = (session && session.code === code && session.role === requestedRole) ? String(session.token || "") : "";
    var tokenHint = String(opts.token || activeToken || sessionToken || "").trim();

    var res = await emitWithAck("campaign:join", {
      code: code,
      name: name,
      role: requestedRole,
      token: tokenHint,
      password: joinPass
    });

    if (!res.ok) {
      if (!opts.silent) safeNotif(res.error || "Could not join campaign.", "warn");
      return;
    }

    state.code = res.code;
    state.role = res.role;
    state.token = String(res.token || "");
    state.playerName = String(res.name || name || ensureName());
    state.activePromptId = "";
    state.lastAppliedSelfCharacterAt = 0;
    state.lastCharacterHash = "";
    state.uiDraft.code = res.code;
    state.uiDraft.joinPassword = "";
    persistSession();

    refreshSettingsModeFromCampaign();
    maybePrimePlayerDock();
    if (res.role === "gm") closeCampaignOnboardingIfOpen();

    if (!opts.silent) {
      safeNotif(
        (res.restored ? "Reconnected to " : "Joined ") + "campaign " + res.code + " as " + (res.role === "gm" ? "GM" : "Player") + ".",
        "good"
      );
    }

    syncCharacterToCampaign(true);
    renderSettingsSection();
    renderDockPanel();
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
    state.lastAppliedSelfCharacterAt = 0;
    state.lastCharacterHash = "";
    state.uiDraft.joinPassword = "";
    state.lastPlayerDockSeed = "";
    clearSession();
    refreshSettingsModeFromCampaign();

    safeNotif("Left campaign.", "warn");
    renderSettingsSection();
    renderDockPanel();
  }

  async function callRollRequest() {
    var label = readUiValue("campaignRollLabel").trim() || "Dread Check";
    var stat = readUiValue("campaignRollStat").trim().toLowerCase() || "valor";
    var dread = Math.max(1, Number(readUiValue("campaignRollDread") || 8));

    return requestRollPrompt(label, stat, dread, "");
  }

  async function requestRollPrompt(label, stat, dread, targetToken) {
    if (!state.socket) {
      safeNotif("Only connected GM can call campaign rolls.", "warn");
      return { ok: false, error: "Not connected." };
    }
    if (!guardAction("callRoll", "Only connected GM can call campaign rolls.")) return { ok: false, error: "Not allowed." };
    if (!guardRiskySharedAction("call roll request")) return { ok: false, error: "Cancelled." };

    var nextLabel = String(label || "Dread Check").trim() || "Dread Check";
    var nextStat = String(stat || "valor").trim().toLowerCase() || "valor";
    var nextDread = Math.max(1, Number(dread || 8));
    var payload = { label: nextLabel, stat: nextStat, dread: nextDread };
    var target = String(targetToken || "").trim();
    var pendingCheckId = "";
    if (state.role === "gm") {
      var pendingCheck = startGmPendingCheck({
        type: "shared-check",
        scope: target ? "individual" : "party",
        label: nextLabel,
        stat: nextStat,
        statOptions: [nextStat],
        dread: nextDread,
        context: nextLabel,
        stake: target ? "Individual actor check waiting on GM resolution." : "Shared campaign consequence waiting on GM resolution.",
        participants: target ? [{ token: target }] : []
      });
      if (pendingCheck && pendingCheck.ok && pendingCheck.id) {
        pendingCheckId = String(pendingCheck.id || "");
      }
    }
    if (target) payload.targetToken = target;
    if (pendingCheckId) payload.pendingCheckId = pendingCheckId;

    var res = await emitWithAck("campaign:rollRequest", payload);
    if (!res.ok) {
      if (pendingCheckId) {
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
    return res;
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
      return;
    }
    if (state.socket && !state.connected && typeof state.socket.connect === "function") {
      state.socket.connect();
      safeNotif("Reconnect requested.", "info");
      return;
    }
    if (state.code && state.role) {
      await joinCampaign(state.role, {
        code: state.code,
        name: state.playerName || ensureName(),
        token: state.token,
        silent: true
      });
      refreshSyncHealth();
      renderSettingsSection();
      renderDockPanel();
      safeNotif("Reconnect handshake complete.", "good");
      return;
    }
    safeNotif("No active campaign session to reconnect.", "warn");
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
      return { ok: true, skipped: true };
    }
    var key = (typeof window.getProvinceSelectedKey === "function")
      ? String(window.getProvinceSelectedKey() || "")
      : "";
    if (!key) return { ok: false, error: "No province selected." };

    state.lastProvinceFocusSyncAt = now;
    var patch = {};
    if (state.token) {
      patch.provinceSelections = {};
      patch.provinceSelections[state.token] = {
        key: key,
        name: String(state.playerName || ensureName() || "Wayfarer"),
        at: now
      };
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
    clearSession();
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
    var actionDie = resolveActionDie(stat);
    var action = (typeof window.explodingRoll === "function")
      ? window.explodingRoll(actionDie, { type: "action", major: true, label: "Campaign " + stat })
      : { total: Math.floor(Math.random() * actionDie) + 1 };
    var dreadRoll = (typeof window.explodingRoll === "function")
      ? window.explodingRoll(req.dread, { type: "dread", major: true, label: "Campaign Dread" })
      : { total: Math.floor(Math.random() * req.dread) + 1 };

    var res = await emitWithAck("campaign:rollSubmit", {
      requestId: req.id,
      total: action.total,
      dreadTotal: dreadRoll.total,
      die: actionDie
    });

    if (!res.ok) {
      safeNotif(res.error || "Could not submit roll.", "warn");
      return;
    }

    if (req.pendingCheckId) {
      submitPendingCheck(req.pendingCheckId, {
        total: action.total,
        dreadTotal: dreadRoll.total,
        die: actionDie,
        method: "auto",
        manual: false
      }).catch(function () {});
    }

    if (typeof window.closeModal === "function") {
      window.closeModal();
    }

    safeNotif(
      "Submitted: " + stat.toUpperCase() + " d" + actionDie + " " + action.total + " vs " + dreadRoll.total + ".",
      action.total >= dreadRoll.total ? "good" : "warn"
    );
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
    patchCameraLockHooks();
    patchCombatSyncHooks();
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
    submitActiveRoll: submitActiveRoll,
    savePrivateNote: savePrivateNote,
    setCampaignPassword: setCampaignPassword,
    toggleArchive: toggleArchive,
    deleteCampaign: deleteCampaign,
    setTimelineFilter: setTimelineFilter,
    setTableSceneMode: setTableSceneMode,
    refreshSceneFocusState: refreshSceneFocusState,
    requestSharedConsent: requestSharedConsent,
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
    startCampaignCombat: startCampaignCombat,
    nextCombatActor: nextCombatActor,
    endCampaignCombat: endCampaignCombat,
    getCurrentCombatActor: getCurrentCombatActor,
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
    refreshUI: function () {
      renderSettingsSection();
      renderDockPanel();
    },
    getState: function () {
      return {
        connected: state.connected,
        code: state.code,
        role: state.role,
        token: state.token,
        campaign: state.campaign
      };
    },
    getSyncStatus: getSyncStatus,
    getSharedState: function () {
      return getCampaignSharedState();
    },
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

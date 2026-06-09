// game-consistency-system.js — shared rule helpers for map, combat, and manual-roll parity.
(function () {
  "use strict";

  var effectDefinitions = {};
  var ruleEventCounter = 0;

  function getState() {
    var state = null;
    try {
      if (typeof S !== "undefined" && S) state = S;
    } catch (_err) {}
    if (!state && typeof window !== "undefined" && window.S) state = window.S;
    if (state && typeof window !== "undefined" && window.S !== state) {
      window.S = state;
    }
    if (state && typeof state.successRollCount === "number" && !state.successRolls) {
      state.successRolls = Math.max(0, Number(state.successRollCount || 0));
    }
    return state || null;
  }

  function parseManualTotal(rawValue) {
    var raw = String(rawValue == null ? "" : rawValue).trim();
    if (!raw) return null;
    if (!/^[+\-\d\s]+$/.test(raw)) return null;
    var compact = raw.replace(/\s+/g, "");
    if (!/^[+-]?\d+(?:[+-]\d+)*$/.test(compact)) return null;
    var parts = compact.match(/[+-]?\d+/g) || [];
    if (!parts.length) return null;
    var total = 0;
    for (var i = 0; i < parts.length; i++) total += Number(parts[i] || 0);
    if (!Number.isFinite(total)) return null;
    return Math.round(total);
  }

  function readManualTotal(elementOrId, minValue) {
    var el = typeof elementOrId === "string" ? document.getElementById(elementOrId) : elementOrId;
    var parsed = parseManualTotal(el && el.value);
    var min = Number.isFinite(Number(minValue)) ? Number(minValue) : 1;
    if (!Number.isFinite(parsed) || parsed < min) return null;
    return parsed;
  }

  function getFailureMargin(details, fallback) {
    var opts = details && typeof details === "object" ? details : {};
    var explicit = Number(opts.failedBy || opts.margin || opts.delta || 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.round(explicit));
    var actionTotal = Number(opts.actionTotal || opts.action || opts.roll || 0);
    var dreadTotal = Number(opts.dreadTotal || opts.dread || opts.difficulty || 0);
    if (Number.isFinite(actionTotal) && Number.isFinite(dreadTotal) && dreadTotal > actionTotal) {
      return Math.max(1, Math.round(dreadTotal - actionTotal));
    }
    var fallbackAmount = Number(fallback || opts.fallbackAmount || 1);
    return Math.max(1, Number.isFinite(fallbackAmount) ? Math.round(fallbackAmount) : 1);
  }

  function applyFailureMarginPenalty(kind, details) {
    var opts = details && typeof details === "object" ? details : {};
    var penaltyKind = String(kind || opts.kind || "stress").toLowerCase();
    var amount = getFailureMargin(opts, opts.fallbackAmount || 1);
    var state = getState();
    var appliedAs = "Stress";
    if (/mental|morale|mind/.test(penaltyKind)) {
      appliedAs = "Mental Stress";
      if (typeof changeMentalStress === "function") changeMentalStress(amount);
      else if (typeof changeStress === "function") changeStress(amount);
    } else if (/rad|radiation/.test(penaltyKind)) {
      appliedAs = "Radiation";
      if (typeof changeRads === "function") changeRads(amount);
      else if (state && state.radiationState && typeof state.radiationState === "object") {
        state.radiationState.gainTicks = Math.max(0, Number(state.radiationState.gainTicks || 0) + amount);
      } else if (state) {
        state.radiationExposure = Math.max(0, Number(state.radiationExposure || 0) + amount);
      }
    } else if (/health|damage|wound|body/.test(penaltyKind)) {
      appliedAs = "Health";
      if (typeof changeHealth === "function") changeHealth(amount);
      else if (typeof changeStress === "function") changeStress(amount);
    } else {
      if (typeof changeStress === "function") changeStress(amount);
    }
    var result = { kind: penaltyKind, amount: amount, label: appliedAs, text: appliedAs + " +" + amount };
    dispatchRuleEvent("failureMarginPenaltyApplied", result);
    return result;
  }

  function deathNumberForHealth(health) {
    var hp = Math.max(1, Number(health || 0));
    return Math.max(1, Math.ceil(hp / 2));
  }

  function getCombatantHealth(combatant) {
    if (!combatant || typeof combatant !== "object") return 0;
    return Math.max(
      0,
      Number(combatant.maxHp || 0),
      Number(combatant.maxStress || 0),
      Number(combatant.enemyHealth || 0),
      Number(combatant.health || 0),
      Number(combatant.hp || 0)
    );
  }

  function isHostileCombatant(combatant) {
    if (!combatant || typeof combatant !== "object") return false;
    if (combatant.isPlayer || combatant.ally) return false;
    var faction = String(combatant.faction || "").toLowerCase();
    return faction === "monster" || faction === "enemy" || faction === "hostile" || !faction;
  }

  function normalizeCombatant(combatant, options) {
    if (!isHostileCombatant(combatant)) return combatant;
    var hp = getCombatantHealth(combatant);
    if (hp <= 0) return combatant;
    combatant.deathNumber = deathNumberForHealth(hp);
    return combatant;
  }

  function isTeamworkConversionReason(reason) {
    var text = String(reason || "").toLowerCase();
    return /teamwork|tmw/.test(text) && /convert|converted|spend|spent|succeed|success/.test(text);
  }

  function recordTeamworkConvertedSuccess(reason) {
    if (typeof window.showNotif === "function") {
      window.showNotif("Teamwork converted the failure to success. No Successful Roll gained.", "good");
    }
    return {
      success: true,
      teamworkConverted: true,
      awardsSuccessfulRoll: false,
      reason: reason || "teamwork-converted-success"
    };
  }

  function ensureRulesEngineState() {
    var state = getState();
    if (!state) return null;
    if (!state.rulesEngine || typeof state.rulesEngine !== "object") {
      state.rulesEngine = {};
    }
    if (!Array.isArray(state.rulesEngine.events)) state.rulesEngine.events = [];
    if (!Array.isArray(state.rulesEngine.effectQueue)) state.rulesEngine.effectQueue = [];
    return state.rulesEngine;
  }

  function dispatchRuleEvent(type, payload) {
    var entry = {
      id: "rule-" + Date.now() + "-" + (++ruleEventCounter),
      type: String(type || "event"),
      payload: payload || {},
      at: new Date().toISOString()
    };
    var engine = ensureRulesEngineState();
    if (engine) {
      engine.events.unshift(entry);
      engine.events = engine.events.slice(0, 80);
    }
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
      try { window.dispatchEvent(new CustomEvent("btl:rule-event", { detail: entry })); } catch (_err) {}
    }
    return entry;
  }

  function normalizeEffectDefinition(definition) {
    if (!definition || typeof definition !== "object") return null;
    var id = String(definition.id || definition.key || "").trim();
    if (!id) return null;
    return Object.assign({
      id: id,
      label: id,
      text: "",
      trigger: "manual",
      scope: "scene",
      expiry: "use",
      manualPrompt: "",
      autoEffect: {}
    }, definition, { id: id });
  }

  function registerEffect(definition) {
    var normalized = normalizeEffectDefinition(definition);
    if (!normalized) return null;
    effectDefinitions[normalized.id] = normalized;
    dispatchRuleEvent("effectRegistered", { id: normalized.id, label: normalized.label, trigger: normalized.trigger, scope: normalized.scope });
    return normalized;
  }

  function registerEffects(definitions) {
    if (!Array.isArray(definitions)) return [];
    return definitions.map(registerEffect).filter(Boolean);
  }

  function getEffectDefinition(id) {
    return effectDefinitions[String(id || "")] || null;
  }

  function listEffectDefinitions() {
    return Object.keys(effectDefinitions).sort().map(function (id) { return effectDefinitions[id]; });
  }

  function queueEffect(effectId, options) {
    var opts = options && typeof options === "object" ? options : {};
    var def = typeof effectId === "object" ? registerEffect(effectId) : getEffectDefinition(effectId);
    if (!def) return null;
    var engine = ensureRulesEngineState();
    if (!engine) return null;
    var entry = {
      id: String(opts.id || def.id + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000)),
      effectId: def.id,
      label: String(opts.label || def.label || def.id),
      source: String(opts.source || def.label || def.id),
      trigger: String(opts.trigger || def.trigger || "manual"),
      scope: String(opts.scope || def.scope || "scene"),
      expiry: String(opts.expiry || def.expiry || "use"),
      payload: Object.assign({}, def.autoEffect || {}, opts.payload || {}),
      contextKey: String(opts.contextKey || ""),
      uses: Math.max(1, Number(opts.uses || (def.autoEffect && def.autoEffect.uses) || 1)),
      createdAt: new Date().toISOString()
    };
    engine.effectQueue = engine.effectQueue.filter(function (queued) {
      return queued && String(queued.id || "") !== entry.id && String(queued.effectId || "") !== entry.effectId;
    });
    engine.effectQueue.push(entry);
    dispatchRuleEvent("effectQueued", { id: entry.id, effectId: entry.effectId, label: entry.label, trigger: entry.trigger, scope: entry.scope });
    return entry;
  }

  function getQueuedEffects(filter) {
    var engine = ensureRulesEngineState();
    if (!engine) return [];
    var opts = filter && typeof filter === "object" ? filter : {};
    return engine.effectQueue.filter(function (entry) {
      if (!entry) return false;
      if (opts.effectId && String(entry.effectId || "") !== String(opts.effectId)) return false;
      if (opts.scope && String(entry.scope || "") !== String(opts.scope)) return false;
      if (opts.trigger && String(entry.trigger || "") !== String(opts.trigger)) return false;
      return true;
    });
  }

  function consumeQueuedEffect(effectId, consumeOptions) {
    var engine = ensureRulesEngineState();
    if (!engine) return null;
    var opts = consumeOptions && typeof consumeOptions === "object" ? consumeOptions : {};
    var consumed = null;
    var kept = [];
    engine.effectQueue.forEach(function (entry) {
      if (!consumed && entry && String(entry.effectId || "") === String(effectId || "")) {
        consumed = entry;
        entry.uses = Math.max(0, Number(entry.uses || 1) - Number(opts.uses || 1));
        if (entry.uses > 0) kept.push(entry);
        return;
      }
      if (entry) kept.push(entry);
    });
    engine.effectQueue = kept;
    if (consumed) dispatchRuleEvent("effectConsumed", { id: consumed.id, effectId: consumed.effectId, label: consumed.label });
    return consumed;
  }

  function createRollRequest(options) {
    var opts = options && typeof options === "object" ? options : {};
    var request = {
      id: String(opts.id || "roll-" + Date.now() + "-" + (++ruleEventCounter)),
      source: String(opts.source || "unknown"),
      actionType: String(opts.actionType || opts.type || ""),
      label: String(opts.label || opts.actionType || "Roll"),
      statKey: String(opts.statKey || ""),
      actionDie: Number(opts.actionDie || 0),
      dreadDie: Number(opts.dreadDie || 0),
      manual: !!opts.manual,
      tags: Array.isArray(opts.tags) ? opts.tags.slice() : [],
      modifiers: Array.isArray(opts.modifiers) ? opts.modifiers.slice() : [],
      createdAt: new Date().toISOString()
    };
    dispatchRuleEvent("rollRequested", request);
    return request;
  }

  function applyRollModifiers(request, modifiers) {
    var req = request && typeof request === "object" ? Object.assign({}, request) : createRollRequest({});
    var explicit = Array.isArray(modifiers) ? modifiers : [];
    req.modifiers = (Array.isArray(req.modifiers) ? req.modifiers.slice() : []).concat(explicit);
    dispatchRuleEvent("modifiersApplied", { rollId: req.id, source: req.source, actionType: req.actionType, modifiers: req.modifiers });
    return req;
  }

  function resolveRollOutcome(request, outcome, options) {
    var req = request && typeof request === "object" ? request : createRollRequest({ source: "unknown" });
    var resultData = outcome && typeof outcome === "object" ? outcome : {};
    var actionTotal = Number(resultData.actionTotal || resultData.action || 0);
    var dreadTotal = Number(resultData.dreadTotal || resultData.dread || 0);
    var success = typeof resultData.success === "boolean" ? resultData.success : actionTotal >= dreadTotal;
    var margin = Math.max(0, Number(resultData.margin || Math.abs(actionTotal - dreadTotal) || 0));
    var teamworkConverted = !!resultData.teamworkConverted || isTeamworkConversionReason(resultData.reason || (options && options.reason));
    var resolved = {
      rollId: req.id,
      source: req.source,
      actionType: req.actionType,
      label: req.label,
      actionTotal: actionTotal,
      dreadTotal: dreadTotal,
      success: success,
      margin: margin,
      manualOverride: !!resultData.manualOverride,
      teamworkConverted: teamworkConverted,
      awardsSuccessfulRoll: !!success && !teamworkConverted
    };
    dispatchRuleEvent("rollResolved", resolved);
    var opts = options && typeof options === "object" ? options : {};
    if (opts.awardRewards !== false) {
      if (success) awardSuccessfulRoll(teamworkConverted ? "teamwork-converted-success" : (opts.reason || resultData.reason || "roll-success"));
      else awardFailedRoll(opts.reason || resultData.reason || "roll-failure", opts.failureOptions || {});
      dispatchRuleEvent("rewardsApplied", { rollId: req.id, success: success, teamworkConverted: teamworkConverted, awardsSuccessfulRoll: resolved.awardsSuccessfulRoll });
    }
    return resolved;
  }

  function normalizeEnemyRoster(options) {
    var state = getState();
    if (!state || !Array.isArray(state.enemies)) return 0;
    var changed = 0;
    state.enemies.forEach(function (enemy) {
      var before = Number(enemy && enemy.deathNumber || 0);
      normalizeCombatant(enemy, options);
      var after = Number(enemy && enemy.deathNumber || 0);
      if (after && after !== before) changed += 1;
    });
    return changed;
  }

  function normalizeCombatSceneSeed(seed, options) {
    if (!seed || typeof seed !== "object") return seed;
    if (Array.isArray(seed.tokens)) {
      seed.tokens.forEach(function (token) { normalizeCombatant(token, options); });
    }
    if (Array.isArray(seed.enemies)) {
      seed.enemies.forEach(function (enemy) { normalizeCombatant(enemy, options); });
    }
    return seed;
  }

  function awardSuccessfulRoll(reason) {
    if (isTeamworkConversionReason(reason)) {
      recordTeamworkConvertedSuccess(reason);
      return 0;
    }
    getState();
    if (typeof window.addSuccessRoll === "function") {
      window.addSuccessRoll();
      getState();
      return 1;
    }
    var state = getState();
    if (!state) return 0;
    state.successRolls = Math.max(0, Number(state.successRolls || 0)) + 1;
    if (state.successRolls >= 3) {
      state.successRolls = 0;
      state.pathTokens = Math.max(0, Number(state.pathTokens || 0)) + 1;
      if (typeof window.showNotif === "function") window.showNotif("3 successful rolls — +1 Path Token!", "good");
    } else if (typeof window.showNotif === "function") {
      window.showNotif("Successful roll recorded (" + state.successRolls + "/3 toward Path Token).", "good");
    }
    state.successRollCount = state.successRolls;
    var srEl = document.getElementById("successRollsVal");
    if (srEl) srEl.textContent = String(state.successRolls || 0);
    var ptEl = document.getElementById("pathTokensVal");
    if (ptEl) ptEl.textContent = String(state.pathTokens || 0);
    return 1;
  }

  function awardFailedRoll(reason, options) {
    if (typeof window.addTMWOnFail === "function") {
      return window.addTMWOnFail(reason || "failed-roll", options || {});
    }
    if (typeof window.awardTeamworkOnFailure === "function") {
      return window.awardTeamworkOnFailure(reason || "failed-roll", options || {});
    }
    var state = getState();
    if (!state) return 0;
    state.tmw = Math.max(0, Number(state.tmw || 0)) + 1;
    if (typeof window.updateTMWPool === "function") window.updateTMWPool();
    return 1;
  }

  function installWrappers() {
    if (typeof window.renderEnemies === "function" && !window.renderEnemies.__btlConsistencyWrapped) {
      var baseRenderEnemies = window.renderEnemies;
      window.renderEnemies = function () {
        normalizeEnemyRoster();
        return baseRenderEnemies.apply(this, arguments);
      };
      window.renderEnemies.__btlConsistencyWrapped = true;
    }

    if (typeof window.startCombat === "function" && !window.startCombat.__btlConsistencyWrapped) {
      var baseStartCombat = window.startCombat;
      window.startCombat = function () {
        normalizeEnemyRoster();
        return baseStartCombat.apply(this, arguments);
      };
      window.startCombat.__btlConsistencyWrapped = true;
    }

    if (typeof window.openCombatSceneEditor === "function" && !window.openCombatSceneEditor.__btlConsistencyWrapped) {
      var baseOpenCombatSceneEditor = window.openCombatSceneEditor;
      window.openCombatSceneEditor = function (seed) {
        normalizeCombatSceneSeed(seed);
        return baseOpenCombatSceneEditor.apply(this, arguments);
      };
      window.openCombatSceneEditor.__btlConsistencyWrapped = true;
    }
  }

  registerEffects([
    {
      id: "personal-flavor.ghoul-hidden",
      aliases: ["ghoul-hidden", "ghost-hidden"],
      label: "Ghoul Hidden",
      text: "On a killing blow, disappear and gain Hidden. Your next Strike or Shoot rolls Advantage d10, then you reappear.",
      trigger: "killing-blow",
      scope: "combat",
      expiry: "next-strike-shoot-or-one-round",
      manualPrompt: "Next Strike/Shoot: include Advantage d10. Do not apply it to Defend or non-attack rolls.",
      autoEffect: {
        type: "attackAdvantage",
        die: 10,
        attackTypes: ["strike", "shoot"],
        uses: 1,
        rounds: 1
      }
    }
  ]);

  window.BTLRules = Object.assign({}, window.BTLRules || {}, {
    parseManualTotal: parseManualTotal,
    readManualTotal: readManualTotal,
    deathNumberForHealth: deathNumberForHealth,
    normalizeCombatant: normalizeCombatant,
    normalizeEnemyRoster: normalizeEnemyRoster,
    normalizeCombatSceneSeed: normalizeCombatSceneSeed,
    awardSuccessfulRoll: awardSuccessfulRoll,
    awardFailedRoll: awardFailedRoll,
    isTeamworkConversionReason: isTeamworkConversionReason,
    recordTeamworkConvertedSuccess: recordTeamworkConvertedSuccess,
    dispatchRuleEvent: dispatchRuleEvent,
    registerEffect: registerEffect,
    registerEffects: registerEffects,
    getEffectDefinition: getEffectDefinition,
    listEffectDefinitions: listEffectDefinitions,
    queueEffect: queueEffect,
    getQueuedEffects: getQueuedEffects,
    consumeQueuedEffect: consumeQueuedEffect,
    createRollRequest: createRollRequest,
    applyRollModifiers: applyRollModifiers,
    resolveRollOutcome: resolveRollOutcome,
    getFailureMargin: getFailureMargin,
    applyFailureMarginPenalty: applyFailureMarginPenalty,
    getState: getState,
    installWrappers: installWrappers
  });

  installWrappers();
  setTimeout(installWrappers, 0);
  setTimeout(installWrappers, 250);
})();

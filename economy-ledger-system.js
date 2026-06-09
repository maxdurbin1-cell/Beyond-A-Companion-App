// economy-ledger-system.js — Phase 1: Shared Economy Ledger with full audit trail
// Provides centralized, traceable management of coin, teamwork, and renown
// with idempotency checks and GM recovery tools.

(function () {
  "use strict";

  // ============================================================================
  // LEDGER STATE & CACHE
  // ============================================================================

  var state = {
    recentLedgerEvents: [],           // Last N events for local tracking
    lastProcessedEventId: "",        // Dedup guard
    lastAwardedTeamworkAt: 0,        // Timestamp of last teamwork award
    teamworkFailureDedupeMs: 180,    // Min ms between same-source failures
    teamworkFailureDedupeKey: "",    // Track what failure we're deduping
    strictTeamworkMode: false,       // GM setting: must have reason for all TMW
    strictModeMinRenown: 5,          // Renown threshold before strict mode auto-enables
    eventIdRegistry: {},             // { eventId: true } for seen events
    maxCachedEvents: 200
  };

  // ============================================================================
  // CORE LEDGER API
  // ============================================================================

  /**
   * Create a transaction ledger event object with full traceability.
   * @param {string} resource - "tmw", "credits", "renown"
   * @param {number} delta - +/- change
   * @param {string} reason - Why this change happened
   * @param {object} opts - Optional: { source, playerId, sessionId }
   * @returns {object} Event with id, timestamp, all metadata
   */
  function createLedgerEvent(resource, delta, reason, opts) {
    var options = opts || {};
    var playerId = String(options.playerId || (window.S && window.S.name) || "Wayfarer");
    var source = String(options.source || "player-action");
    var sessionCode = String(options.sessionCode || 
      (typeof window.campaignSystem !== "undefined" && window.campaignSystem && window.campaignSystem.state && window.campaignSystem.state.code) || 
      "solo");

    var event = {
      id: "eco-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
      resource: String(resource || "unknown"),
      delta: Number(delta || 0),
      reason: String(reason || "").slice(0, 200),
      source: source,
      playerId: playerId,
      sessionCode: sessionCode,
      timestamp: Date.now(),
      appliedAt: null,
      applied: false
    };

    return event;
  }

  /**
   * Record a ledger event locally. Integrate with campaign system if available.
   * @param {object} event - Created via createLedgerEvent
   * @returns {boolean} Success
   */
  function recordLedgerEvent(event) {
    if (!event || typeof event !== "object") return false;
    if (!event.id) return false;

    // Idempotency: reject duplicate event IDs
    if (state.eventIdRegistry[event.id]) {
      console.warn("[Economy] Duplicate event ID, skipping:", event.id);
      return false;
    }

    state.eventIdRegistry[event.id] = true;
    state.recentLedgerEvents.push(event);

    // Keep cache size reasonable
    if (state.recentLedgerEvents.length > state.maxCachedEvents) {
      state.recentLedgerEvents = state.recentLedgerEvents.slice(-state.maxCachedEvents);
    }

    // Broadcast to campaign system if available
    if (typeof window.campaignSystem !== "undefined" && window.campaignSystem && typeof window.campaignSystem.recordEconomyDelta === "function") {
      window.campaignSystem.recordEconomyDelta(event.resource, event.delta, event.reason);
    }

    return true;
  }

  /**
   * Award teamwork on roll failure with full traceability.
   * Respects strict mode if enabled.
   * @param {object} opts - { reason, failureType, rollValue, difficulty, playerId }
   * @returns {number} Amount awarded (0 if rejected)
   */
  function awardTeamworkOnFailure(opts) {
    var options = opts || {};
    var reason = String(options.reason || "failed-roll").slice(0, 100);
    var failureType = String(options.failureType || "roll");
    var rollValue = Number(options.rollValue || 0);
    var difficulty = Number(options.difficulty || 0);
    var playerId = String(options.playerId || (window.S && window.S.name) || "Wayfarer");

    // Strict mode: require detailed reason
    if ((state.strictTeamworkMode && reason === "failed-roll") || reason.length < 10) {
      console.warn("[Economy] Strict teamwork mode: insufficient reason:", reason);
      return 0;
    }

    // Deduplication: prevent same failure from being counted twice within timeframe
    var now = Date.now();
    var dedupeKey = reason + "::" + failureType;
    if (state.teamworkFailureDedupeKey === dedupeKey && 
        (now - state.lastAwardedTeamworkAt) < state.teamworkFailureDedupeMs) {
      console.warn("[Economy] Teamwork award deduplicated (too soon):", dedupeKey);
      return 0;
    }

    // Determine amount based on flavor/settings
    var amount = 1;
    if (window.S && window.S.flavor && window.S.flavor.toLowerCase().includes("failed rolls grant +2")) {
      amount = 2;
    }

    // Create event
    var event = createLedgerEvent("tmw", amount, 
      "Failure award: " + reason + " [roll=" + rollValue + " vs " + difficulty + "]",
      { source: failureType, playerId: playerId }
    );

    // Record it
    if (!recordLedgerEvent(event)) {
      return 0;
    }

    // Actually apply the teamwork
    if (typeof window.changeCounter === "function") {
      window.changeCounter("tmw", amount);
    } else if (window.S) {
      window.S.tmw = Math.max(0, (window.S.tmw || 0) + amount);
      if (typeof window.updateTMWPool === "function") window.updateTMWPool();
    }

    state.lastAwardedTeamworkAt = now;
    state.teamworkFailureDedupeKey = dedupeKey;

    return amount;
  }

  /**
   * Spend teamwork for a recovery action (boost or push luck).
   * @param {object} opts - { cost, action, rollContext }
   * @returns {boolean} Success
   */
  function spendTeamwork(opts) {
    var options = opts || {};
    var cost = Number(options.cost || 1);
    var action = String(options.action || "recovery");
    var rollContext = String(options.rollContext || "");

    if ((window.S && window.S.tmw || 0) < cost) {
      return false;
    }

    // Record spend
    var event = createLedgerEvent("tmw", -cost, 
      "Spent: " + action + (rollContext ? " (" + rollContext + ")" : ""),
      { source: "player-spend" }
    );

    recordLedgerEvent(event);

    if (typeof window.changeCounter === "function") {
      window.changeCounter("tmw", -cost);
    } else if (window.S) {
      window.S.tmw = Math.max(0, (window.S.tmw || 0) - cost);
      if (typeof window.updateTMWPool === "function") window.updateTMWPool();
    }

    return true;
  }

  /**
   * Record a coin transaction with full audit trail.
   * @param {object} opts - { delta, reason, source, playerId }
   * @returns {boolean} Success
   */
  function recordCoinTransaction(opts) {
    var options = opts || {};
    var delta = Number(options.delta || 0);
    var reason = String(options.reason || "");
    var source = String(options.source || "transaction");

    if (!Number.isFinite(delta) || delta === 0) return false;
    if (!reason || reason.length < 3) {
      console.warn("[Economy] Coin transaction requires detailed reason");
      return false;
    }

    var event = createLedgerEvent("credits", delta, reason, { source: source });
    return recordLedgerEvent(event);
  }

  /**
   * Record renown change with traceability.
   * @param {object} opts - { delta, reason, source }
   * @returns {boolean} Success
   */
  function recordRenownChange(opts) {
    var options = opts || {};
    var delta = Number(options.delta || 0);
    var reason = String(options.reason || "");
    var source = String(options.source || "faction");

    if (!Number.isFinite(delta) || delta === 0) return false;

    var event = createLedgerEvent("renown", delta, reason, { source: source });
    return recordLedgerEvent(event);
  }

  /**
   * Get full ledger history for audit trail.
   * @param {object} opts - { resource, playerId, source, limit }
   * @returns {array} Filtered ledger events
   */
  function getLedgerHistory(opts) {
    var options = opts || {};
    var resource = String(options.resource || "").toLowerCase();
    var playerId = String(options.playerId || "");
    var source = String(options.source || "");
    var limit = Number(options.limit || 100);

    var filtered = state.recentLedgerEvents.slice();
    
    if (resource) {
      filtered = filtered.filter(function (e) { return e.resource === resource; });
    }
    if (playerId) {
      filtered = filtered.filter(function (e) { return e.playerId === playerId; });
    }
    if (source) {
      filtered = filtered.filter(function (e) { return e.source === source; });
    }

    return filtered.slice(-limit);
  }

  /**
   * Get summary stats for audit panel display.
   * @returns {object} { tmwTotal, creditsTotal, renownTotal, eventCount, ... }
   */
  function getLedgerSummary() {
    var summary = {
      tmwTotal: 0,
      tmwAwards: 0,
      tmwSpends: 0,
      creditsTotal: 0,
      creditsIncome: 0,
      creditsSpent: 0,
      renownTotal: 0,
      renownGained: 0,
      renownLost: 0,
      eventCount: state.recentLedgerEvents.length,
      firstEventAt: state.recentLedgerEvents.length > 0 ? state.recentLedgerEvents[0].timestamp : null,
      lastEventAt: state.recentLedgerEvents.length > 0 ? state.recentLedgerEvents[state.recentLedgerEvents.length - 1].timestamp : null
    };

    state.recentLedgerEvents.forEach(function (event) {
      if (event.resource === "tmw") {
        summary.tmwTotal += event.delta;
        if (event.delta > 0) summary.tmwAwards += event.delta;
        else summary.tmwSpends += -event.delta;
      } else if (event.resource === "credits") {
        summary.creditsTotal += event.delta;
        if (event.delta > 0) summary.creditsIncome += event.delta;
        else summary.creditsSpent += -event.delta;
      } else if (event.resource === "renown") {
        summary.renownTotal += event.delta;
        if (event.delta > 0) summary.renownGained += event.delta;
        else summary.renownLost += -event.delta;
      }
    });

    return summary;
  }

  /**
   * Enable/disable strict teamwork mode for GM control.
   * @param {boolean} enabled
   */
  function setStrictTeamworkMode(enabled) {
    state.strictTeamworkMode = !!enabled;
    if (typeof window.showNotif === "function") {
      window.showNotif("Strict teamwork mode " + (enabled ? "enabled" : "disabled") + ".", enabled ? "good" : "info");
    }
  }

  /**
   * Get current strict mode setting.
   * @returns {boolean}
   */
  function isStrictTeamworkMode() {
    return state.strictTeamworkMode;
  }

  /**
   * Export ledger as CSV for GM review/backups.
   * @returns {string} CSV formatted ledger
   */
  function exportLedgerAsCSV() {
    var lines = ["timestamp,resource,delta,reason,playerId,source"];
    state.recentLedgerEvents.forEach(function (event) {
      var reason = String(event.reason || "").replace(/"/g, '""');
      lines.push([
        new Date(event.timestamp).toISOString(),
        event.resource,
        event.delta,
        '"' + reason + '"',
        event.playerId,
        event.source
      ].join(","));
    });
    return lines.join("\n");
  }

  /**
   * Clear all local ledger (GM recovery tool - dangerous!).
   * Should only be called via explicit GM action with confirmation.
   */
  function clearLedger() {
    state.recentLedgerEvents = [];
    state.eventIdRegistry = {};
    if (typeof window.showNotif === "function") {
      window.showNotif("Local ledger cleared. This does not affect campaign server.", "warn");
    }
  }

  // ============================================================================
  // EXPORT API
  // ============================================================================

  window.economyLedgerSystem = {
    createLedgerEvent: createLedgerEvent,
    recordLedgerEvent: recordLedgerEvent,
    awardTeamworkOnFailure: awardTeamworkOnFailure,
    spendTeamwork: spendTeamwork,
    recordCoinTransaction: recordCoinTransaction,
    recordRenownChange: recordRenownChange,
    getLedgerHistory: getLedgerHistory,
    getLedgerSummary: getLedgerSummary,
    setStrictTeamworkMode: setStrictTeamworkMode,
    isStrictTeamworkMode: isStrictTeamworkMode,
    exportLedgerAsCSV: exportLedgerAsCSV,
    clearLedger: clearLedger,
    _state: state  // For debugging only
  };

  console.log("[Economy] Ledger System initialized. Available at window.economyLedgerSystem");
})();

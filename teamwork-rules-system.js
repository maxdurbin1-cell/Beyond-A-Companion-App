// teamwork-rules-system.js — Phase 1: Centralized teamwork enforcement
// Single source of truth for all failed-roll, penalty, and recovery logic.
// Prevents duplicate awards and ensures predictable teamwork pot behavior.

(function () {
  "use strict";

  var state = {
    failedRollLog: [],           // Track each failure for audit
    lastFailureAt: 0,
    maxLogSize: 150,
    campaignMode: false,        // Track if we're in multiplayer
    strictMode: false,          // From GM settings
    coreAssetId: ""              // Track player identity
  };

  /**
   * Initialize the teamwork rules system.
   * Call once on load to set up integrations.
   */
  function initialize() {
    // Detect campaign mode
    if (typeof window.campaignSystem !== "undefined" && window.campaignSystem && window.campaignSystem.state) {
      state.campaignMode = !!window.campaignSystem.state.code;
    }

    console.log("[Teamwork Rules] System initialized. Campaign mode:", state.campaignMode);
  }

  /**
   * CENTRALIZED: Handle any roll failure with full traceability.
   * This is the one function all failures should route through.
   * 
   * @param {string} failureContext - What kind of failure (combat, skill, social, event, etc.)
   * @param {object} rollDetails - { stat, roll, difficulty, description, ... }
   * @returns {object} { awarded: number, reason: string, offered: boolean }
   */
  function onRollFailure(failureContext, rollDetails) {
    var context = String(failureContext || "unknown-failure");
    var details = rollDetails || {};

    // Valor Die (V.D.) additive bonus logic.
    var stat = String(details.stat || "valor");
    var roll = Number(details.roll || 0);
    var difficulty = Number(details.difficulty || 0);
    var description = String(details.description || "");
    var sessionContext = String(details.sessionContext || "solo");  // "solo" or campaign code

    // Build detailed failure reason
    var failureReason = context + ": " + stat.toUpperCase() + " d? " + roll + " vs " + difficulty;
    if (stat === "valor") {
      failureReason += " (Valor Die, additive bonus)";
    }
    if (description) {
      failureReason += " (" + description + ")";
    }

    // Log the failure for audit trail
    var failureEntry = {
      timestamp: Date.now(),
      context: context,
      stat: stat,
      roll: roll,
      difficulty: difficulty,
      description: description,
      reason: failureReason,
      sessionContext: sessionContext,
      awarded: 0
    };

    // DEDUP GUARD: Don't double-count the same failure
    // Check if this exact failure was just processed
    var now = Date.now();
    if (state.lastFailureAt && (now - state.lastFailureAt) < 100 && state.failedRollLog.length > 0) {
      var last = state.failedRollLog[state.failedRollLog.length - 1];
      if (last.context === context && last.stat === stat && last.roll === roll && last.difficulty === difficulty) {
        console.warn("[Teamwork Rules] Duplicate failure ignored:", failureReason);
        return { awarded: 0, reason: "duplicate-filtered", offered: false };
      }
    }

    // Use economy ledger if available
    var awarded = 0;
    if (typeof window.economyLedgerSystem !== "undefined" && window.economyLedgerSystem) {
      awarded = window.economyLedgerSystem.awardTeamworkOnFailure({
        reason: failureReason,
        failureType: context,
        rollValue: roll,
        difficulty: difficulty
      }) || 0;
    } else {
      // Fallback to legacy awardTeamworkOnFailure if ledger system not loaded
      if (typeof window.awardTeamworkOnFailure === "function") {
        awarded = window.awardTeamworkOnFailure(failureReason, { dedupeMs: 100 }) || 0;
      }
    }

    failureEntry.awarded = awarded;
    state.failedRollLog.push(failureEntry);
    state.lastFailureAt = now;

    // Keep log capped
    if (state.failedRollLog.length > state.maxLogSize) {
      state.failedRollLog = state.failedRollLog.slice(-state.maxLogSize);
    }

    return {
      awarded: awarded,
      reason: failureReason,
      offered: awarded > 0
    };
  }

  /**
   * EVENT FAILURE PATH: Mission/quest failure grants teamwork.
   * Used when missions are abandoned or fail.
   * @param {object} eventDetails - { missionName, difficulty, abandonment }
   * @returns {number} Amount awarded
   */
  function onEventFailure(eventDetails) {
    var details = eventDetails || {};
    var missionName = String(details.missionName || "Quest");
    var difficulty = String(details.difficulty || "unknown");
    var reason = "Mission failure: " + missionName + " (" + difficulty + ")";

    return onRollFailure("event-failure", {
      stat: "will",
      roll: 0,
      difficulty: 0,
      description: reason,
      sessionContext: state.campaignMode ? "campaign" : "solo"
    }).awarded;
  }

  /**
   * COMBAT FAILURE PATH: Loss in combat grants teamwork.
   * Called when player loses combat encounter.
   * @param {object} combatDetails - { enemyName, playerHealth, damageDealt, ... }
   * @returns {number} Amount awarded
   */
  function onCombatFailure(combatDetails) {
    var details = combatDetails || {};
    var enemy = String(details.enemyName || "Unknown opponent");
    var playerHealth = Number(details.playerHealth || 0);
    var description = "Defeated by " + enemy + " (Health: " + playerHealth + ")";

    return onRollFailure("combat-defeat", {
      stat: "strike",
      roll: 0,
      difficulty: 10,
      description: description,
      sessionContext: state.campaignMode ? "campaign" : "solo"
    }).awarded;
  }

  /**
   * PENALTY FAILURE PATH: TMW pot awarded for condition/trauma checks.
   * Called when player enters stressed/traumatized state despite actions.
   * @param {object} penaltyDetails - { condition, severity }
   * @returns {number} Amount awarded
   */
  function onPenaltyFailure(penaltyDetails) {
    var details = penaltyDetails || {};
    var condition = String(details.condition || "stress");
    var severity = String(details.severity || "standard");

    return onRollFailure("condition-penalty", {
      stat: "mind",
      roll: 0,
      difficulty: 0,
      description: "Condition acquired: " + condition + " (" + severity + ")",
      sessionContext: state.campaignMode ? "campaign" : "solo"
    }).awarded;
  }

  /**
   * Get failure history for audit/debugging.
   * @param {number} limit - Max entries to return
   * @returns {array}
   */
  function getFailureHistory(limit) {
    var n = Number(limit || 50);
    return state.failedRollLog.slice(-(n)).reverse();
  }

  /**
   * Get summary of failures and awards for current session.
   * @returns {object}
   */
  function getTeamworkSummary() {
    var totalAwarded = 0;
    var failureCount = 0;
    var byContext = {};

    state.failedRollLog.forEach(function (entry) {
      if (entry.awarded > 0) {
        totalAwarded += entry.awarded;
        failureCount++;
      }
      if (!byContext[entry.context]) {
        byContext[entry.context] = { failures: 0, awarded: 0 };
      }
      byContext[entry.context].failures++;
      byContext[entry.context].awarded += entry.awarded;
    });

    return {
      sessionFailures: failureCount,
      sessionTeamworkAwarded: totalAwarded,
      byContext: byContext,
      lastFailure: state.failedRollLog.length > 0 ? state.failedRollLog[state.failedRollLog.length - 1].timestamp : null
    };
  }

  /**
   * Set strict mode from GM controls.
   * When strict: failures must have explicit reason logged.
   * @param {boolean} enabled
   */
  function setStrictMode(enabled) {
    state.strictMode = !!enabled;
    if (typeof window.economyLedgerSystem !== "undefined" && window.economyLedgerSystem && window.economyLedgerSystem.setStrictTeamworkMode) {
      window.economyLedgerSystem.setStrictTeamworkMode(enabled);
    }
  }

  /**
   * Is strict mode active?
   * @returns {boolean}
   */
  function isStrictMode() {
    return state.strictMode;
  }

  /**
   * Update campaign detection.
   * Called when joining/leaving campaign.
   * @param {boolean} inCampaign
   */
  function setCampaignMode(inCampaign) {
    state.campaignMode = !!inCampaign;
  }

  /**
   * Export failure report for GM review.
   * @returns {string} Formatted report
   */
  function exportFailureReport() {
    var summary = getTeamworkSummary();
    var lines = [
      "=== TEAMWORK FAILURE REPORT ===",
      "Session Failures: " + summary.sessionFailures,
      "Session Teamwork Awarded: " + summary.sessionTeamworkAwarded,
      "",
      "By Context:"
    ];

    Object.entries(summary.byContext).forEach(function (pair) {
      var key = pair[0];
      var data = pair[1];
      lines.push("  " + key + ": " + data.failures + " failures → " + data.awarded + " TMW");
    });

    lines.push("");
    lines.push("Recent Failures:");
    getFailureHistory(20).forEach(function (entry) {
      lines.push("  [" + new Date(entry.timestamp).toLocaleTimeString() + "] " + entry.reason + " → +" + entry.awarded + " TMW");
    });

    return lines.join("\n");
  }

  // ============================================================================
  // EXPORT API
  // ============================================================================

  window.teamworkRulesSystem = {
    initialize: initialize,
    onRollFailure: onRollFailure,
    onEventFailure: onEventFailure,
    onCombatFailure: onCombatFailure,
    onPenaltyFailure: onPenaltyFailure,
    getFailureHistory: getFailureHistory,
    getTeamworkSummary: getTeamworkSummary,
    setStrictMode: setStrictMode,
    isStrictMode: isStrictMode,
    setCampaignMode: setCampaignMode,
    exportFailureReport: exportFailureReport,
    _state: state  // For debugging
  };

  // Auto-init
  setTimeout(function () { initialize(); }, 100);

  console.log("[Teamwork Rules] System loaded. Available at window.teamworkRulesSystem");
})();

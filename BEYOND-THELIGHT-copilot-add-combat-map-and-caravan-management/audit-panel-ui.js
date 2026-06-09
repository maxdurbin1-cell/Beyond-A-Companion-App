// audit-panel-ui.js — Phase 1: Enhanced economy audit display
// Shows transaction history, teamwork awards, and ledger validation UI for GM review.

(function () {
  "use strict";

  /**
   * Render an HTML audit panel for economy review.
   * Can be shown in a modal or embedded in settings.
   * @param {object} opts - { showTeamwork, showCoin, showRenown, limit }
   * @returns {string} HTML
   */
  function renderAuditPanel(opts) {
    var options = opts || {};
    var showTeamwork = options.showTeamwork !== false;
    var showCoin = options.showCoin !== false;
    var showRenown = options.showRenown !== false;
    var limit = Number(options.limit || 20);

    var html = '<div class="audit-panel">';

    // Summary stats
    if (typeof window.economyLedgerSystem !== "undefined" && window.economyLedgerSystem && window.economyLedgerSystem.getLedgerSummary) {
      var summary = window.economyLedgerSystem.getLedgerSummary();
      html += ''
        + '<div class="audit-section">'
        + '<h3 class="audit-subtitle">Session Summary</h3>'
        + '<div class="audit-row">'
        + '<span>Total Events Logged:</span>'
        + '<span class="audit-value">' + summary.eventCount + '</span>'
        + '</div>'
        + '<div class="audit-row">'
        + '<span>Teamwork Awarded:</span>'
        + '<span class="audit-value" style="color:var(--teal);">+' + summary.tmwAwards + '</span>'
        + '</div>'
        + '<div class="audit-row">'
        + '<span>Teamwork Spent:</span>'
        + '<span class="audit-value" style="color:var(--red2);">-' + summary.tmwSpends + '</span>'
        + '</div>'
        + '<div class="audit-row">'
        + '<span>Credits Earned:</span>'
        + '<span class="audit-value" style="color:var(--gold);">+' + summary.creditsIncome + '₵</span>'
        + '</div>'
        + '<div class="audit-row">'
        + '<span>Credits Spent:</span>'
        + '<span class="audit-value" style="color:var(--red2);">-' + summary.creditsSpent + '₵</span>'
        + '</div>'
        + '<div class="audit-row">'
        + '<span>Renown Gained:</span>'
        + '<span class="audit-value" style="color:var(--green);">+' + summary.renownGained + '</span>'
        + '</div>'
        + '<div class="audit-row">'
        + '<span>Renown Lost:</span>'
        + '<span class="audit-value" style="color:var(--red2);">-' + summary.renownLost + '</span>'
        + '</div>'
        + '</div>';
    }

    // Teamwork ledger
    if (showTeamwork && typeof window.economyLedgerSystem !== "undefined" && window.economyLedgerSystem && window.economyLedgerSystem.getLedgerHistory) {
      var tmwEvents = window.economyLedgerSystem.getLedgerHistory({ resource: "tmw", limit: limit });
      html += ''
        + '<div class="audit-section">'
        + '<h3 class="audit-subtitle">Teamwork History</h3>'
        + (tmwEvents.length === 0
          ? '<div class="audit-empty">No teamwork transactions yet.</div>'
          : '<div class="audit-ledger">' + tmwEvents.map(function (e) {
            var sign = e.delta > 0 ? "+" : "";
            var color = e.delta > 0 ? "var(--teal)" : "var(--red2)";
            return ''
              + '<div class="audit-ledger-row">'
              + '<span class="audit-time">' + new Date(e.timestamp).toLocaleTimeString() + '</span>'
              + '<span class="audit-delta" style="color:' + color + ';">' + sign + e.delta + '</span>'
              + '<span class="audit-reason">' + escapeHtml(e.reason || e.source) + '</span>'
              + '<span class="audit-player">' + escapeHtml(e.playerId) + '</span>'
              + '</div>';
          }).join("") + '</div>')
        + '</div>';
    }

    // Coin ledger
    if (showCoin && typeof window.economyLedgerSystem !== "undefined" && window.economyLedgerSystem && window.economyLedgerSystem.getLedgerHistory) {
      var coinEvents = window.economyLedgerSystem.getLedgerHistory({ resource: "credits", limit: limit });
      html += ''
        + '<div class="audit-section">'
        + '<h3 class="audit-subtitle">Coins / Credits History</h3>'
        + (coinEvents.length === 0
          ? '<div class="audit-empty">No coin transactions yet.</div>'
          : '<div class="audit-ledger">' + coinEvents.map(function (e) {
            var sign = e.delta > 0 ? "+" : "";
            var color = e.delta > 0 ? "var(--gold2)" : "var(--red2)";
            return ''
              + '<div class="audit-ledger-row">'
              + '<span class="audit-time">' + new Date(e.timestamp).toLocaleTimeString() + '</span>'
              + '<span class="audit-delta" style="color:' + color + ';">' + sign + e.delta + '₵</span>'
              + '<span class="audit-reason">' + escapeHtml(e.reason || e.source) + '</span>'
              + '<span class="audit-player">' + escapeHtml(e.playerId) + '</span>'
              + '</div>';
          }).join("") + '</div>')
        + '</div>';
    }

    // Renown ledger
    if (showRenown && typeof window.economyLedgerSystem !== "undefined" && window.economyLedgerSystem && window.economyLedgerSystem.getLedgerHistory) {
      var renownEvents = window.economyLedgerSystem.getLedgerHistory({ resource: "renown", limit: limit });
      html += ''
        + '<div class="audit-section">'
        + '<h3 class="audit-subtitle">Renown History</h3>'
        + (renownEvents.length === 0
          ? '<div class="audit-empty">No renown changes yet.</div>'
          : '<div class="audit-ledger">' + renownEvents.map(function (e) {
            var sign = e.delta > 0 ? "+" : "";
            var color = e.delta > 0 ? "var(--green)" : "var(--red2)";
            return ''
              + '<div class="audit-ledger-row">'
              + '<span class="audit-time">' + new Date(e.timestamp).toLocaleTimeString() + '</span>'
              + '<span class="audit-delta" style="color:' + color + ';">' + sign + e.delta + '</span>'
              + '<span class="audit-reason">' + escapeHtml(e.reason || e.source) + '</span>'
              + '<span class="audit-player">' + escapeHtml(e.playerId) + '</span>'
              + '</div>';
          }).join("") + '</div>')
        + '</div>';
    }

    // Teamwork failure log
    if (typeof window.teamworkRulesSystem !== "undefined" && window.teamworkRulesSystem && window.teamworkRulesSystem.getFailureHistory) {
      var failures = window.teamworkRulesSystem.getFailureHistory(15);
      html += ''
        + '<div class="audit-section">'
        + '<h3 class="audit-subtitle">Failure & Award Log</h3>'
        + (failures.length === 0
          ? '<div class="audit-empty">No roll failures logged yet.</div>'
          : '<div class="audit-ledger">' + failures.map(function (f) {
            return ''
              + '<div class="audit-ledger-row">'
              + '<span class="audit-time">' + new Date(f.timestamp).toLocaleTimeString() + '</span>'
              + '<span class="audit-context" style="color:var(--muted2);">' + escapeHtml(f.context) + '</span>'
              + '<span class="audit-stat">' + escapeHtml(f.stat.toUpperCase()) + '</span>'
              + '<span class="audit-award" style="color:var(--teal);">+' + f.awarded + ' TMW</span>'
              + '</div>';
          }).join("") + '</div>')
        + '</div>';
    }

    // Strict mode status
    if (typeof window.teamworkRulesSystem !== "undefined" && window.teamworkRulesSystem && window.teamworkRulesSystem.isStrictMode) {
      var strictMode = window.teamworkRulesSystem.isStrictMode();
      html += ''
        + '<div class="audit-section">'
        + '<h3 class="audit-subtitle">Mode Status</h3>'
        + '<div class="audit-row">'
        + '<span>Strict Teamwork Mode:</span>'
        + '<span class="audit-value" style="color:' + (strictMode ? 'var(--red2)' : 'var(--green)') + ';">'
        + (strictMode ? "ENABLED" : "Disabled")
        + '</span>'
        + '</div>'
        + '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Show audit panel in a modal.
   */
  function showAuditPanelModal() {
    if (typeof window.openModal !== "function") return;
    var html = renderAuditPanel({ showTeamwork: true, showCoin: true, showRenown: true, limit: 25 });
    window.openModal("Economy Audit Ledger", html);
  }

  /**
   * Export ledger in CSV format for offline review.
   */
  function exportLedgerCSV() {
    if (typeof window.economyLedgerSystem === "undefined" || !window.economyLedgerSystem) {
      if (typeof window.showNotif === "function") window.showNotif("Ledger system not ready.", "warn");
      return;
    }

    var csv = window.economyLedgerSystem.exportLedgerAsCSV();
    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "economy-ledger-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof window.showNotif === "function") window.showNotif("Ledger exported to CSV.", "good");
  }

  /**
   * Export failure report for GM review.
   */
  function exportFailureReport() {
    if (typeof window.teamworkRulesSystem === "undefined" || !window.teamworkRulesSystem) {
      if (typeof window.showNotif === "function") window.showNotif("Teamwork system not ready.", "warn");
      return;
    }

    var report = window.teamworkRulesSystem.exportFailureReport();
    var blob = new Blob([report], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "failure-report-" + new Date().toISOString().slice(0, 10) + ".txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof window.showNotif === "function") window.showNotif("Failure report exported.", "good");
  }

  /**
   * Add audit panel CSS styles to page.
   */
  function injectAuditCSS() {
    var style = document.getElementById("audit-panel-styles");
    if (style) return;

    style = document.createElement("style");
    style.id = "audit-panel-styles";
    style.textContent = `
      .audit-panel {
        font-size: 0.85rem;
        line-height: 1.5;
      }
      .audit-section {
        margin-bottom: 1.2rem;
        padding: 0.7rem;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border2);
        border-radius: 2px;
      }
      .audit-subtitle {
        font-family: 'Cinzel', serif;
        font-size: 0.75rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--gold);
        margin-bottom: 0.5rem;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.3rem;
      }
      .audit-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.3rem 0;
        border-bottom: 1px solid var(--border2);
      }
      .audit-row:last-child {
        border-bottom: none;
      }
      .audit-value {
        font-weight: 600;
        font-family: 'Rajdhani', monospace;
      }
      .audit-empty {
        color: var(--muted2);
        font-style: italic;
        text-align: center;
        padding: 0.5rem;
      }
      .audit-ledger {
        display: grid;
        gap: 0.4rem;
      }
      .audit-ledger-row {
        display: grid;
        grid-template-columns: 80px 60px 1fr 100px;
        gap: 0.5rem;
        padding: 0.4rem;
        background: rgba(255, 255, 255, 0.01);
        border: 1px solid var(--border2);
        border-radius: 2px;
        font-size: 0.8rem;
      }
      .audit-time {
        font-family: 'Rajdhani', monospace;
        color: var(--muted2);
        font-size: 0.75rem;
      }
      .audit-delta {
        font-weight: 700;
        font-family: 'Rajdhani', monospace;
      }
      .audit-reason {
        color: var(--text2);
        word-break: break-word;
      }
      .audit-player {
        color: var(--muted2);
        font-size: 0.75rem;
        text-align: right;
      }
      .audit-context {
        font-family: 'Rajdhani', monospace;
        font-size: 0.75rem;
      }
      .audit-stat {
        font-weight: 600;
        font-family: 'Rajdhani', monospace;
        color: var(--teal);
      }
      .audit-award {
        font-weight: 700;
      }
      @media (max-width: 768px) {
        .audit-ledger-row {
          grid-template-columns: 1fr;
          font-size: 0.75rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Auto-inject styles
  injectAuditCSS();

  // Export API
  window.auditPanelUI = {
    renderAuditPanel: renderAuditPanel,
    showAuditPanelModal: showAuditPanelModal,
    exportLedgerCSV: exportLedgerCSV,
    exportFailureReport: exportFailureReport,
    injectAuditCSS: injectAuditCSS
  };

  console.log("[Audit Panel] UI system loaded. Available at window.auditPanelUI");
})();

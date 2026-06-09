(function () {
  "use strict";

  var TABLE_BODY_ID = "license-table-body";
  var KEY_STORAGE_KEY = "btl_paywall_admin_key";
  var KEY_STORAGE_MODE = "btl_paywall_admin_key_mode";

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(id, message, type) {
    var el = byId(id);
    if (!el) return;
    el.textContent = String(message || "");
    el.className = "status" + (type ? " " + String(type) : "");
  }

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function getAdminKey() {
    var input = byId("admin-key");
    return input ? String(input.value || "").trim() : "";
  }

  function saveAdminKeyPreference() {
    var key = getAdminKey();
    var mode = byId("remember-key") ? String(byId("remember-key").value || "session") : "session";
    try {
      localStorage.removeItem(KEY_STORAGE_KEY);
      localStorage.removeItem(KEY_STORAGE_MODE);
      sessionStorage.removeItem(KEY_STORAGE_KEY);
      sessionStorage.removeItem(KEY_STORAGE_MODE);
    } catch (_err) { console.error(_err); }

    if (!key) return;
    try {
      if (mode === "browser") {
        localStorage.setItem(KEY_STORAGE_KEY, key);
        localStorage.setItem(KEY_STORAGE_MODE, mode);
      } else {
        sessionStorage.setItem(KEY_STORAGE_KEY, key);
        sessionStorage.setItem(KEY_STORAGE_MODE, mode);
      }
    } catch (_err) { console.error(_err); }
  }

  function loadAdminKeyPreference() {
    var key = "";
    var mode = "session";
    try {
      key = localStorage.getItem(KEY_STORAGE_KEY) || sessionStorage.getItem(KEY_STORAGE_KEY) || "";
      mode = localStorage.getItem(KEY_STORAGE_MODE) || sessionStorage.getItem(KEY_STORAGE_MODE) || "session";
    } catch (_err) { console.error(_err); }

    var input = byId("admin-key");
    var modeSelect = byId("remember-key");
    if (input && key) input.value = key;
    if (modeSelect) modeSelect.value = mode === "browser" ? "browser" : "session";
  }

  async function postJson(url, payload) {
    var key = getAdminKey();
    if (key) saveAdminKeyPreference();

    var headers = {
      "Content-Type": "application/json"
    };
    if (key) headers["x-admin-key"] = key;

    var response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload || {})
    });

    var body = null;
    try {
      body = await response.json();
    } catch (_err) {
      body = null;
    }
    return { ok: response.ok, status: response.status, body: body };
  }

  async function loadAdminConfigStatus() {
    var result;
    try {
      result = await fetch("/api/license/admin/config", { method: "GET" });
    } catch (_err) {
      setStatus("admin-config-status", "Could not reach admin config endpoint.", "error");
      return;
    }

    var body = null;
    try {
      body = await result.json();
    } catch (_err) {
      body = null;
    }

    if (!result.ok || !body || !body.ok) {
      setStatus("admin-config-status", "Admin config check failed.", "error");
      return;
    }

    if (!body.adminKeyConfigured) {
      setStatus("admin-config-status", "Server admin key is NOT configured. Set PAYWALL_ADMIN_KEY and restart server.", "warn");
      return;
    }

    var adminEmail = String(body.adminEmail || "").trim();
    setStatus("admin-config-status", "Server admin key is configured. Admin email is " + (adminEmail || "(not set)") + ". Enter the key VALUE above (not the literal text PAYWALL_ADMIN_KEY), or log in at /access with admin email + admin key.", "ok");
  }

  function formatTime(ts) {
    var n = Number(ts || 0);
    if (!n) return "-";
    var d = new Date(n);
    return d.toLocaleString();
  }

  function renderLicenses(licenses) {
    var body = byId(TABLE_BODY_ID);
    if (!body) return;
    body.innerHTML = "";

    if (!Array.isArray(licenses) || licenses.length === 0) {
      var empty = document.createElement("tr");
      empty.innerHTML = "<td colspan=\"6\">No licenses found.</td>";
      body.appendChild(empty);
      return;
    }

    licenses.forEach(function (item) {
      var tr = document.createElement("tr");
      var disabled = !!item.disabled;
      var statusChip = disabled
        ? '<span class="chip disabled">Disabled</span>'
        : '<span class="chip active">Active</span>';
      var actionText = disabled ? "Restore" : "Revoke";
      var actionClass = disabled ? "secondary" : "danger";
      tr.innerHTML = ""
        + "<td>" + String(item.code || "") + "</td>"
        + "<td>" + String(item.email || "-") + "</td>"
        + "<td>" + formatTime(item.issuedAt) + "</td>"
        + "<td>" + String(item.redeemedByEmail || "-") + "</td>"
        + "<td>" + statusChip + "</td>"
        + "<td><button type=\"button\" class=\"" + actionClass + "\" data-code=\"" + String(item.code || "") + "\" data-disable=\"" + String(!disabled) + "\">" + actionText + "</button></td>";
      body.appendChild(tr);
    });
  }

  async function doIssue() {
    setStatus("issue-status", "Issuing codes...", "");
    setStatus("issue-result", "", "");

    var email = byId("issue-email") ? String(byId("issue-email").value || "").trim() : "";
    var quantity = byId("issue-quantity") ? Number(byId("issue-quantity").value || 1) : 1;
    var result = await postJson("/api/license/issue", { email: email, quantity: quantity });

    if (!result.ok || !result.body || !result.body.ok) {
      var issueError = (result.body && result.body.error) ? result.body.error : "Could not issue codes.";
      setStatus("issue-status", issueError, "error");
      return;
    }

    setStatus("issue-status", "Codes issued successfully.", "ok");
    setStatus("issue-result", "Codes: " + String((result.body.codes || []).join(", ")), "ok");
  }

  async function doSearch() {
    setStatus("search-status", "Loading licenses...", "");
    var email = byId("search-email") ? String(byId("search-email").value || "").trim().toLowerCase() : "";
    var code = byId("search-code") ? normalizeCode(byId("search-code").value || "") : "";
    var includeDisabled = byId("include-disabled") ? String(byId("include-disabled").value || "false") === "true" : false;

    var result = await postJson("/api/license/admin/list", {
      email: email,
      code: code,
      includeDisabled: includeDisabled
    });

    if (!result.ok || !result.body || !result.body.ok) {
      var errMsg = (result.body && result.body.error) ? result.body.error : "Search failed.";
      setStatus("search-status", errMsg, "error");
      renderLicenses([]);
      return;
    }

    var list = Array.isArray(result.body.licenses) ? result.body.licenses : [];
    renderLicenses(list);
    setStatus("search-status", "Found " + String(list.length) + " license(s).", "ok");
  }

  async function doAdminAccessTest() {
    setStatus("admin-test-status", "Testing admin access...", "");
    var result;
    try {
      result = await postJson("/api/license/admin/test", {});
    } catch (_err) {
      setStatus("admin-test-status", "Could not reach server for admin test.", "error");
      return;
    }
    if (!result.ok || !result.body || !result.body.ok) {
      var err = (result.body && result.body.error) ? result.body.error : "Admin access failed.";
      setStatus("admin-test-status", err, "error");
      setStatus("license-storage-status", "", "");
      return;
    }
    setStatus("admin-test-status", "Admin access confirmed. You can issue codes.", "ok");
    await loadStoragePathHint();
  }

  async function loadStoragePathHint() {
    var result;
    try {
      result = await postJson("/api/license/admin/storage", {});
    } catch (_err) {
      setStatus("license-storage-status", "Could not load license storage path.", "warn");
      return;
    }

    if (!result.ok || !result.body || !result.body.ok) {
      var err = (result.body && result.body.error) ? result.body.error : "Could not read license storage path.";
      setStatus("license-storage-status", err, "warn");
      return;
    }

    var activePath = String(result.body.activePath || "(unknown)");
    var existsText = result.body.activeExists ? "present" : "not created yet";
    var msg = "License codes persist at: " + activePath + " (" + existsText + ").";
    if (result.body.legacyExists && !result.body.usingLegacyPath) {
      msg += " Legacy file also detected at " + String(result.body.legacyPath || "") + ".";
    }
    setStatus("license-storage-status", msg, "ok");
  }

  async function toggleLicense(code, disable) {
    setStatus("search-status", (disable ? "Revoking " : "Restoring ") + code + "...", "");
    var result = await postJson("/api/license/admin/revoke", {
      code: code,
      disabled: !!disable
    });

    if (!result.ok || !result.body || !result.body.ok) {
      var err = (result.body && result.body.error) ? result.body.error : "Update failed.";
      setStatus("search-status", err, "error");
      return;
    }

    setStatus("search-status", "Updated code " + code + ".", "ok");
    await doSearch();
  }

  function initActions() {
    var issueBtn = byId("issue-btn");
    var searchBtn = byId("search-btn");
    var testAdminBtn = byId("test-admin-btn");
    var body = byId(TABLE_BODY_ID);

    if (issueBtn) {
      issueBtn.addEventListener("click", function () {
        doIssue();
      });
    }
    if (searchBtn) {
      searchBtn.addEventListener("click", function () {
        doSearch();
      });
    }
    if (testAdminBtn) {
      testAdminBtn.addEventListener("click", function () {
        doAdminAccessTest();
      });
    }

    if (body) {
      body.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || target.tagName !== "BUTTON") return;
        var code = normalizeCode(target.getAttribute("data-code") || "");
        var disable = String(target.getAttribute("data-disable") || "true") === "true";
        if (!code) return;
        toggleLicense(code, disable);
      });
    }
  }

  function init() {
    loadAdminKeyPreference();
    loadAdminConfigStatus();
    initActions();
    window.btlTestAdminAccess = doAdminAccessTest;
    doAdminAccessTest();
    doSearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

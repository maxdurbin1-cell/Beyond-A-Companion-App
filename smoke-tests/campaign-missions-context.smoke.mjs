import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 25000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: process.env.PORT || "3000" }
  });

  child.stdout.on("data", (buf) => {
    const line = String(buf || "").trim();
    if (line) process.stdout.write(`[server] ${line}\n`);
  });
  child.stderr.on("data", (buf) => {
    const line = String(buf || "").trim();
    if (line) process.stderr.write(`[server:err] ${line}\n`);
  });

  return child;
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_err) {
      // Retry until timeout.
    }
    await wait(350);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function dismissBlockingOverlays(page) {
  await page.evaluate(() => {
    try {
      if (window.introSystem && typeof window.introSystem.skipIntro === "function") {
        window.introSystem.skipIntro();
      }
    } catch (_err) {}
    try {
      if (window.soloReference && typeof window.soloReference.close === "function") {
        window.soloReference.close();
      }
    } catch (_err) {}
    try {
      if (typeof window.closeModal === "function") {
        window.closeModal();
      }
    } catch (_err) {}
  });
}

async function waitForCampaignReady(page) {
  await page.waitForFunction(
    () => !!(window.campaignSystem && window.campaignSystem.getState && window.campaignSystem.getState().connected),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
  await dismissBlockingOverlays(page);
}

async function clearSession(page) {
  await page.evaluate(async () => {
    try {
      localStorage.removeItem("beyond-light-campaign-session");
    } catch (_err) {}
    try {
      if (window.campaignSystem && window.campaignSystem.getState) {
        const st = window.campaignSystem.getState();
        if (st && st.code && typeof window.campaignSystem.leaveCampaign === "function") {
          await window.campaignSystem.leaveCampaign();
        }
      }
    } catch (_err) {}
  });
  await dismissBlockingOverlays(page);
}

async function syncShared(page, reason) {
  const out = await page.evaluate(async (syncReason) => {
    if (!window.campaignSystem || typeof window.campaignSystem.syncSharedSilent !== "function") {
      return { ok: false, error: "syncSharedSilent unavailable" };
    }
    for (let i = 0; i < 6; i += 1) {
      try {
        const res = await window.campaignSystem.syncSharedSilent(`${syncReason}-${i}`);
        if (res && res.ok) return res;
      } catch (_err) {}
      await new Promise((resolve) => setTimeout(resolve, 180 * (i + 1)));
    }
    return { ok: false, error: "sync retries exhausted" };
  }, reason);
  if (!out || !out.ok) {
    throw new Error(`Shared sync failed for ${reason}: ${JSON.stringify(out)}`);
  }
}

async function setContext(page, ctx) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await page.evaluate(async (nextCtx) => {
      if (typeof window.setContext !== "function") {
        return { ok: false, error: "setContext unavailable" };
      }
      const ctxBtn = document.querySelector(`.ctx-btn[data-ctx="${nextCtx}"]`);
      window.setContext(nextCtx, ctxBtn || null);
      if (typeof window.requestMainNavOverflowSync === "function") {
        window.requestMainNavOverflowSync();
      }
      const activeBtn = document.querySelector("#mainNavTablist .tab-btn.active[data-tab]");
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const travel = shared && shared.campaignTravel && typeof shared.campaignTravel === "object"
        ? shared.campaignTravel
        : null;
      return {
        ok: true,
        activeContext: String(window._activeContext || ""),
        activeTab: String(activeBtn && activeBtn.getAttribute("data-tab") || ""),
        travelContext: String(travel && travel.context || "")
      };
    }, ctx);
    if (!result || !result.ok) {
      throw new Error(`Could not set context ${ctx}: ${JSON.stringify(result)}`);
    }
    await syncShared(page, `missions-context-${ctx}-attempt-${attempt + 1}`);
    try {
      await page.waitForFunction(
        (expectedCtx) => {
          const coreTabByContext = {
            traveling: "tabnav-character",
            holding: "tabnav-map",
            sea: "tabnav-lastsea",
            space: "tabnav-galaxy"
          };
          const coreTabId = coreTabByContext[String(expectedCtx || "")] || "";
          const coreTab = coreTabId ? document.getElementById(coreTabId) : null;
          return !!(
            String(window._activeContext || "") === String(expectedCtx || "")
            && coreTab
            && window.getComputedStyle(coreTab).display !== "none"
          );
        },
        ctx,
        { timeout: Math.max(6000, Math.floor(STEP_TIMEOUT_MS / 2)) }
      );
      await dismissBlockingOverlays(page);
      return;
    } catch (_err) {
      await page.evaluate(async () => {
        try {
          if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
            await window.campaignSystem.requestResync();
          }
        } catch (_err2) {}
      });
      await wait(220 * (attempt + 1));
    }
  }
  const diagnostics = await page.evaluate((expectedCtx) => {
    const coreTabByContext = {
      traveling: "tabnav-character",
      holding: "tabnav-map",
      sea: "tabnav-lastsea",
      space: "tabnav-galaxy"
    };
    const coreTabId = coreTabByContext[String(expectedCtx || "")] || "";
    const coreTab = coreTabId ? document.getElementById(coreTabId) : null;
    const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
      ? window.campaignSystem.getSharedState()
      : null;
    const travel = shared && shared.campaignTravel && typeof shared.campaignTravel === "object"
      ? shared.campaignTravel
      : null;
    return {
      expectedCtx: String(expectedCtx || ""),
      activeContext: String(window._activeContext || ""),
      coreTabId,
      coreTabDisplay: coreTab ? String(window.getComputedStyle(coreTab).display || "") : "missing",
      activeTab: String((document.querySelector("#mainNavTablist .tab-btn.active[data-tab]") || {}).id || ""),
      visibleTabs: Array.from(document.querySelectorAll("#mainNav .tab-btn")).filter((el) => window.getComputedStyle(el).display !== "none").map((el) => String(el.id || el.textContent || "")),
      travelContext: String(travel && travel.context || ""),
      travelTab: String(travel && travel.tab || "")
    };
  }, ctx);
  throw new Error(`Could not settle context ${ctx}: ${JSON.stringify(diagnostics)}`);
}

async function clickMissionsAndAssert(page, ctx, label) {
  const pageErrors = [];
  if (!page._missionsPageErrorHooked) {
    page._missionsPageErrorHooked = true;
    page.on("pageerror", (err) => {
      pageErrors.push(String(err && err.stack ? err.stack : err));
      if (pageErrors.length > 10) pageErrors.shift();
    });
  }
  await dismissBlockingOverlays(page);
  try {
    await page.waitForFunction(
      (expectedCtx) => {
        const coreTabByContext = {
          traveling: "tabnav-character",
          holding: "tabnav-map",
          sea: "tabnav-lastsea",
          space: "tabnav-galaxy"
        };
        const coreTabId = coreTabByContext[String(expectedCtx || "")] || "";
        const coreTab = coreTabId ? document.getElementById(coreTabId) : null;
        return !!(
          coreTab
          && window.getComputedStyle(coreTab).display !== "none"
        );
      },
      ctx,
      { timeout: STEP_TIMEOUT_MS }
    );
  } catch (err) {
    const contextDiagnostics = await page.evaluate((expectedCtx) => {
      const coreTabByContext = {
        traveling: "tabnav-character",
        holding: "tabnav-map",
        sea: "tabnav-lastsea",
        space: "tabnav-galaxy"
      };
      const coreTabId = coreTabByContext[String(expectedCtx || "")] || "";
      const visibleTabs = Array.from(document.querySelectorAll("#mainNav .tab-btn")).filter((el) => window.getComputedStyle(el).display !== "none").map((el) => String(el.id || ""));
      const hiddenTabs = Array.from(document.querySelectorAll("#mainNav .tab-btn")).filter((el) => window.getComputedStyle(el).display === "none").map((el) => String(el.id || ""));
      const coreTab = coreTabId ? document.getElementById(coreTabId) : null;
      const ctxBar = Array.from(document.querySelectorAll(".ctx-btn")).map((el) => ({
        ctx: String(el.getAttribute("data-ctx") || ""),
        pressed: String(el.getAttribute("aria-pressed") || ""),
        on: !!el.classList.contains("on")
      }));
      return {
        expectedCtx: String(expectedCtx || ""),
        coreTabId,
        coreTabDisplay: coreTab ? String(window.getComputedStyle(coreTab).display || "") : "missing",
        visibleTabs,
        hiddenTabs,
        ctxBar,
        activePanels: Array.from(document.querySelectorAll(".tab-panel.active")).map((el) => String(el.id || "")),
        activeTabs: Array.from(document.querySelectorAll("#mainNavTablist .tab-btn.active")).map((el) => String(el.id || ""))
      };
    }, ctx);
    throw new Error(`Context ${label || ctx} did not settle to a visible core tab: ${JSON.stringify({ contextDiagnostics, pageErrors, error: String(err && err.message ? err.message : err) })}`);
  }
  await page.waitForFunction(
    () => {
      const btn = document.getElementById("tabnav-missions");
      return !!btn;
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  let missionsActivated = false;
  for (let attempt = 0; attempt < 3 && !missionsActivated; attempt += 1) {
    const activation = await page.evaluate((attemptNumber) => {
      const btn = document.getElementById("tabnav-missions");
      const btnHidden = !!(btn && window.getComputedStyle(btn).display === "none");
      const overflowItem = Array.from(document.querySelectorAll("#mainNavOverflowPanel .tab-btn,[data-overflow-for]"))
        .find((el) => {
          const overflowFor = String(el.getAttribute("data-overflow-for") || "");
          const text = String(el.textContent || "").trim();
          return overflowFor === "tabnav-missions" || text === "Missions";
        }) || null;
      try {
        if (btnHidden && overflowItem && typeof overflowItem.click === "function") {
          overflowItem.click();
          return { ok: true, path: "overflow-click" };
        }
        if (btn && typeof btn.click === "function") {
          btn.click();
          return { ok: true, path: btnHidden ? "hidden-btn-click" : "visible-btn-click" };
        }
        if (attemptNumber === 0 && typeof window.openMissionsTab === "function") {
          window.openMissionsTab();
          return { ok: true, path: "openMissionsTab" };
        }
        if (typeof window.switchTab === "function") {
          window.switchTab("missions", btn || null);
          return { ok: true, path: btn ? "switchTab-direct" : "switchTab-null" };
        }
        return { ok: false, error: "No missions activation path available" };
      } catch (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) };
      }
    }, attempt);
    if (!activation || !activation.ok) {
      throw new Error(`Could not activate missions in ${ctx}: ${JSON.stringify(activation)}`);
    }
    await dismissBlockingOverlays(page);
    try {
      await page.waitForFunction(
        () => {
          const panel = document.getElementById("tab-missions");
          const btn = document.getElementById("tabnav-missions");
          return !!(
            panel && btn
            && panel.classList.contains("active")
            && btn.classList.contains("active")
          );
        },
        null,
        { timeout: Math.max(4000, Math.floor(STEP_TIMEOUT_MS / 2)) }
      );
      missionsActivated = true;
    } catch (_err) {
      await wait(180 * (attempt + 1));
    }
  }

  if (!missionsActivated) {
    const postClick = await page.evaluate((activeCtx) => {
      const btn = document.getElementById("tabnav-missions");
      const panel = document.getElementById("tab-missions");
      const activePanels = Array.from(document.querySelectorAll(".tab-panel.active")).map((el) => String(el.id || ""));
      const activeTabs = Array.from(document.querySelectorAll("#mainNavTablist .tab-btn.active")).map((el) => String(el.id || ""));
      const tablist = document.getElementById("mainNavTablist");
      const state = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
      return {
        context: activeCtx,
        missionBtnActive: !!(btn && btn.classList.contains("active")),
        missionPanelActive: !!(panel && panel.classList.contains("active")),
        missionParentId: String(btn && btn.parentElement ? btn.parentElement.id || "" : ""),
        missionInTablist: !!(btn && tablist && btn.parentElement === tablist),
        activePanels,
        activeTabs,
        missionDisplay: btn ? String(window.getComputedStyle(btn).display || "") : "missing",
        campaignCode: String(state && state.code || ""),
        campaignRole: String(state && state.role || "")
      };
    }, ctx);
    throw new Error(`Missions panel activation timed out in ${ctx}: ${JSON.stringify({ postClick, pageErrors })}`);
  }

  const postClick = await page.evaluate((activeCtx) => {
    const btn = document.getElementById("tabnav-missions");
    const panel = document.getElementById("tab-missions");
    const activePanels = Array.from(document.querySelectorAll(".tab-panel.active")).map((el) => String(el.id || ""));
    const activeTabs = Array.from(document.querySelectorAll("#mainNavTablist .tab-btn.active")).map((el) => String(el.id || ""));
    const tablist = document.getElementById("mainNavTablist");
    const state = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
    return {
      context: activeCtx,
      missionBtnActive: !!(btn && btn.classList.contains("active")),
      missionPanelActive: !!(panel && panel.classList.contains("active")),
      missionParentId: String(btn && btn.parentElement ? btn.parentElement.id || "" : ""),
      missionInTablist: !!(btn && tablist && tablist.contains(btn)),
      activePanels,
      activeTabs,
      missionDisplay: btn ? String(window.getComputedStyle(btn).display || "") : "missing",
      campaignCode: String(state && state.code || ""),
      campaignRole: String(state && state.role || "")
    };
  }, ctx);

  const diagnostics = await page.evaluate((activeCtx) => {
    const body = document.body;
    const btn = document.getElementById("tabnav-missions");
    const panel = document.getElementById("tab-missions");
    const tablist = document.getElementById("mainNavTablist");
    const parentId = btn && btn.parentElement ? String(btn.parentElement.id || "") : "";
    const computedDisplay = btn ? String(window.getComputedStyle(btn).display || "") : "missing";
    const state = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
    return {
      context: activeCtx,
      missionParentId: parentId,
      inMainTablist: !!(tablist && btn && tablist.contains(btn)),
      missionDisplay: computedDisplay,
      missionBtnActive: !!(btn && btn.classList.contains("active")),
      missionPanelActive: !!(panel && panel.classList.contains("active")),
      bodyCampaignMode: !!(body && (body.classList.contains("campaign-mode") || body.classList.contains("gm-mode"))),
      campaignCode: String(state && state.code || ""),
      campaignRole: String(state && state.role || "")
    };
  }, ctx);

  if (!diagnostics.bodyCampaignMode) {
    throw new Error(`Campaign mode not active while validating missions tab: ${JSON.stringify(diagnostics)}`);
  }
  if (!diagnostics.inMainTablist) {
    throw new Error(`Missions tab is not attached to mainNavTablist in ${ctx}: ${JSON.stringify(diagnostics)}`);
  }
  if (!diagnostics.missionBtnActive || !diagnostics.missionPanelActive) {
    throw new Error(`Missions click did not activate missions panel in ${ctx}: ${JSON.stringify({ diagnostics, postClick })}`);
  }

  return diagnostics;
}

async function runAssertions(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForCampaignReady(page);
  await clearSession(page);

  await page.evaluate(() => {
    const el = document.getElementById("campaignNameInput");
    if (el) el.value = "Missions Smoke GM";
  });
  await page.evaluate(async () => {
    await window.campaignSystem.createCampaign();
  });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => {
      const st = window.campaignSystem.getState();
      const body = document.body;
      const campaignMode = !!(body && (body.classList.contains("campaign-mode") || body.classList.contains("gm-mode")));
      return !!(st && st.code && st.role === "gm" && campaignMode);
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const checks = [];

  await setContext(page, "space");
  checks.push(await clickMissionsAndAssert(page, "space", "space-initial"));

  await setContext(page, "traveling");
  checks.push(await clickMissionsAndAssert(page, "traveling", "traveling"));

  await setContext(page, "sea");
  checks.push(await clickMissionsAndAssert(page, "sea", "sea"));

  await setContext(page, "space");
  checks.push(await clickMissionsAndAssert(page, "space", "space-return"));

  process.stdout.write(`Campaign missions context smoke passed: ${JSON.stringify({ checks })}\n`);
}

async function run() {
  const server = startServer();
  let browser;

  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await runAssertions(page);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

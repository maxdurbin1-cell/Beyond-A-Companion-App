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

async function setContext(page, ctx) {
  const btn = page.locator(`.ctx-btn[data-ctx="${ctx}"]`);
  await btn.click();
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
      if (!btn) return false;
      return window.getComputedStyle(btn).display !== "none";
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  await page.evaluate(() => {
    if (typeof window.openMissionsTab !== "function") {
      throw new Error("openMissionsTab unavailable");
    }
    window.openMissionsTab();
  });
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
      { timeout: STEP_TIMEOUT_MS }
    );
  } catch (err) {
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
    throw new Error(`Missions panel activation timed out in ${ctx}: ${JSON.stringify({ postClick, pageErrors, error: String(err && err.message ? err.message : err) })}`);
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
      missionInTablist: !!(btn && tablist && btn.parentElement === tablist),
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
      inMainTablist: !!(tablist && btn && btn.parentElement === tablist),
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

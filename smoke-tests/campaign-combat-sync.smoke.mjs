import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 30000;
const STEP_TIMEOUT_MS = 20000;
const COMBAT_SYNC_TIMEOUT_MS = 12000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferredPort = 3202) {
  if (await canBindPort(preferredPort)) return preferredPort;
  for (let i = 0; i < 32; i += 1) {
    const candidate = 5400 + Math.floor(Math.random() * 1200);
    if (await canBindPort(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for campaign combat sync smoke.");
}

function startServer(port) {
  const stamp = `${process.pid}-${Date.now()}`;
  const tempRoot = path.join(os.tmpdir(), `btl-smoke-campaign-combat-sync-${stamp}`);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      PAYWALL_DISABLED: process.env.PAYWALL_DISABLED || "1",
      CAMPAIGN_STORE_PATH: process.env.CAMPAIGN_STORE_PATH || path.join(tempRoot, "campaign-data.json"),
      CAMPAIGN_SNAPSHOT_DIR: process.env.CAMPAIGN_SNAPSHOT_DIR || path.join(tempRoot, "snapshots"),
      LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH || path.join(tempRoot, "license-data.json")
    }
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

function findChromiumExecutable() {
  const homeDir = process.env.HOME || os.homedir();
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    path.join(homeDir, "Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
    path.join(homeDir, "Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
  ];
  return candidates.find((entry) => entry && fs.existsSync(entry)) || "";
}

async function launchChromium() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (message.indexOf("Executable doesn't exist") < 0) throw err;
    const executablePath = findChromiumExecutable();
    if (!executablePath) throw err;
    return chromium.launch({ headless: true, executablePath });
  }
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
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.waitForFunction(
        () => !!(window.campaignSystem && window.campaignSystem.getState && window.campaignSystem.getState().connected),
        null,
        { timeout: STEP_TIMEOUT_MS }
      );
      await dismissBlockingOverlays(page);
      return;
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
        await wait(300);
      }
    }
  }
  const readiness = await page.evaluate(() => ({
    hasCampaignSystem: !!window.campaignSystem,
    hasGetState: !!(window.campaignSystem && window.campaignSystem.getState),
    connected: !!(window.campaignSystem && window.campaignSystem.getState && window.campaignSystem.getState().connected),
    hasSocket: !!(window.campaignSystem && window.campaignSystem.getState && window.campaignSystem.getState().socket),
    documentReadyState: String(document.readyState || "")
  }));
  throw new Error(`Campaign ready wait timed out: state=${JSON.stringify(readiness)} error=${String(lastError && lastError.message ? lastError.message : lastError)}`);
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

async function ensureBaseState(page) {
  await page.evaluate(() => {
    const state = (() => {
      try {
        return (typeof S !== "undefined" && S) ? S : (window.S || null);
      } catch (_err) {
        return window.S || null;
      }
    })();
    if (!state && typeof window.generateCharacter === "function") {
      try { window.generateCharacter(); } catch (_err) {}
    }
    const liveState = (() => {
      try {
        return (typeof S !== "undefined" && S) ? S : (window.S = window.S || {});
      } catch (_err) {
        return (window.S = window.S || {});
      }
    })();
    window.S = liveState;
    liveState.combat = liveState.combat || {};
    liveState.enemies = Array.isArray(liveState.enemies) ? liveState.enemies : [];
    liveState.combatMap = liveState.combatMap && typeof liveState.combatMap === "object"
      ? liveState.combatMap
      : { units: [] };
  });
}

async function collectCombatSummary(page) {
  return page.evaluate(() => {
    const state = (() => {
      try {
        return (typeof S !== "undefined" && S) ? S : (window.S || {});
      } catch (_err) {
        return window.S || {};
      }
    })();
    window.S = state;
    const combat = state && state.combat ? state.combat : {};
    const enemies = Array.isArray(state && state.enemies) ? state.enemies : [];
    const units = state && state.combatMap && Array.isArray(state.combatMap.units)
      ? state.combatMap.units
      : [];
    const ashRaiderUnit = units.find((unit) => unit && unit.trackerKey === "enemy:smoke-e1")
      || units.find((unit) => unit && unit.name === "Ash Raider")
      || null;
    const paleHoundUnit = units.find((unit) => unit && unit.trackerKey === "enemy:smoke-e2")
      || units.find((unit) => unit && unit.name === "Pale Hound")
      || null;
    return {
      active: !!combat.active,
      enemyDread: Number(combat.enemyDread || 0),
      firstEnemyStress: enemies[0] ? Number(enemies[0].stress || 0) : -1,
      secondEnemyStress: enemies[1] ? Number(enemies[1].stress || 0) : -1,
      ashRaiderZone: ashRaiderUnit ? String(ashRaiderUnit.zone || "") : "",
      paleHoundPresent: !!paleHoundUnit,
      unitCount: units.length,
      combatAugState: !!(state && state.combatAugState && state.combatAugState.decentralizedHeartUsed)
    };
  });
}

function combatSummaryMatches(summary, expected) {
  const actual = summary || {};
  const target = expected || {};
  const requiresAshRaiderZone = Object.prototype.hasOwnProperty.call(target, "ashRaiderZone")
    && String(target.ashRaiderZone || "") !== "";
  return (
    actual.active === target.active &&
    Number(actual.enemyDread || 0) === Number(target.enemyDread || 0) &&
    Number(actual.firstEnemyStress || 0) === Number(target.firstEnemyStress || 0) &&
    Number(actual.secondEnemyStress || 0) === Number(target.secondEnemyStress || 0) &&
    (!requiresAshRaiderZone || String(actual.ashRaiderZone || "") === String(target.ashRaiderZone || "")) &&
    !!actual.paleHoundPresent === !!target.paleHoundPresent &&
    Number(actual.unitCount || 0) >= Number(target.minUnitCount || 0) &&
    !!actual.combatAugState === !!target.combatAugState
  );
}

async function waitForCombatSummary(page, expected, label) {
  const immediateSummary = await collectCombatSummary(page);
  if (combatSummaryMatches(immediateSummary, expected)) {
    return;
  }
  try {
    await page.waitForFunction(
      (target) => {
        const state = (() => {
          try {
            return (typeof S !== "undefined" && S) ? S : (window.S || {});
          } catch (_err) {
            return window.S || {};
          }
        })();
        window.S = state;
        const combat = state && state.combat ? state.combat : {};
        const enemies = Array.isArray(state && state.enemies) ? state.enemies : [];
        const units = state && state.combatMap && Array.isArray(state.combatMap.units)
          ? state.combatMap.units
          : [];
        const ashRaiderUnit = units.find((unit) => unit && unit.trackerKey === "enemy:smoke-e1")
          || units.find((unit) => unit && unit.name === "Ash Raider")
          || null;
        const paleHoundUnit = units.find((unit) => unit && unit.trackerKey === "enemy:smoke-e2")
          || units.find((unit) => unit && unit.name === "Pale Hound")
          || null;
        const requiresAshRaiderZone = Object.prototype.hasOwnProperty.call(target || {}, "ashRaiderZone")
          && String(target && target.ashRaiderZone || "") !== "";
        return (
          !!combat.active === !!target.active &&
          Number(combat.enemyDread || 0) === Number(target.enemyDread || 0) &&
          Number(enemies[0] && enemies[0].stress || 0) === Number(target.firstEnemyStress || 0) &&
          Number(enemies[1] && enemies[1].stress || 0) === Number(target.secondEnemyStress || 0) &&
          (!requiresAshRaiderZone || String(ashRaiderUnit && ashRaiderUnit.zone || "") === String(target.ashRaiderZone || "")) &&
          (!!paleHoundUnit === !!target.paleHoundPresent) &&
          units.length >= Number(target.minUnitCount || 0) &&
          (!!(state && state.combatAugState && state.combatAugState.decentralizedHeartUsed) === !!target.combatAugState)
        );
      },
      expected,
      { timeout: COMBAT_SYNC_TIMEOUT_MS }
    );
  } catch (err) {
    const summary = await collectCombatSummary(page);
    throw new Error(`${label} wait timed out: expected=${JSON.stringify(expected)} actual=${JSON.stringify(summary)} error=${String(err && err.message ? err.message : err)}`);
  }

  const summary = await collectCombatSummary(page);
  if (!combatSummaryMatches(summary, expected)) {
    throw new Error(`${label} combat sync mismatch: expected=${JSON.stringify(expected)} actual=${JSON.stringify(summary)}`);
  }
}

async function reconcileCombatSync(gmPage, playerPage, reason) {
  await gmPage.evaluate(async (why) => {
    try {
      if (window.campaignSystem && typeof window.campaignSystem.forceAuthoritativeResync === "function") {
        await window.campaignSystem.forceAuthoritativeResync();
        return;
      }
      if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
        await window.campaignSystem.syncSharedSilent(String(why || "combat-sync-reconcile"));
      }
    } catch (_err) {}
  }, String(reason || "combat-sync-reconcile"));

  await playerPage.evaluate(async () => {
    try {
      if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
        await window.campaignSystem.requestResync();
      }
    } catch (_err) {}
  });
  await wait(700);
}

async function waitForCombatSummaryWithRetry(gmPage, playerPage, expected, label) {
  var lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await waitForCombatSummary(playerPage, expected, label + " attempt " + String(attempt + 1));
      return;
    } catch (err) {
      lastError = err;
      await reconcileCombatSync(gmPage, playerPage, label + "-attempt-" + String(attempt + 1));
      const afterReconcile = await collectCombatSummary(playerPage);
      if (combatSummaryMatches(afterReconcile, expected)) {
        return;
      }
    }
  }
  throw lastError || new Error(label + " failed after retries.");
}

function combatSummariesConverged(gmSummary, playerSummary, expected) {
  return (
    combatSummaryMatches(gmSummary, expected)
    && combatSummaryMatches(playerSummary, expected)
    && String(gmSummary && gmSummary.ashRaiderZone || "") === String(playerSummary && playerSummary.ashRaiderZone || "")
  );
}

async function waitForCombatSummaryConvergence(gmPage, playerPage, expected, label) {
  const gmImmediate = await collectCombatSummary(gmPage);
  const playerImmediate = await collectCombatSummary(playerPage);
  if (combatSummariesConverged(gmImmediate, playerImmediate, expected)) {
    return;
  }
  const start = Date.now();
  while (Date.now() - start < COMBAT_SYNC_TIMEOUT_MS) {
    await wait(250);
    const gmSummary = await collectCombatSummary(gmPage);
    const playerSummary = await collectCombatSummary(playerPage);
    if (combatSummariesConverged(gmSummary, playerSummary, expected)) {
      return;
    }
  }
  const gmSummary = await collectCombatSummary(gmPage);
  const playerSummary = await collectCombatSummary(playerPage);
  throw new Error(`${label} convergence wait timed out: expected=${JSON.stringify(expected)} gm=${JSON.stringify(gmSummary)} player=${JSON.stringify(playerSummary)}`);
}

async function waitForCombatSummaryConvergenceWithRetry(gmPage, playerPage, expected, label) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await waitForCombatSummaryConvergence(gmPage, playerPage, expected, `${label} attempt ${attempt + 1}`);
      return;
    } catch (err) {
      lastError = err;
      await reconcileCombatSync(gmPage, playerPage, `${label}-attempt-${attempt + 1}`);
    }
  }
  throw lastError || new Error(label + " convergence failed after retries.");
}

async function waitForCombatHydration(page, label, minUnits = 3) {
  try {
    await page.waitForFunction(
      (targetUnits) => {
        const state = (() => {
          try {
            return (typeof S !== "undefined" && S) ? S : (window.S || {});
          } catch (_err) {
            return window.S || {};
          }
        })();
        window.S = state;
        const enemies = Array.isArray(state && state.enemies) ? state.enemies : [];
        const units = state && state.combatMap && Array.isArray(state.combatMap.units)
          ? state.combatMap.units
          : [];
        const ashRaiderUnit = units.find((unit) => unit && unit.trackerKey === "enemy:smoke-e1")
          || units.find((unit) => unit && unit.name === "Ash Raider")
          || null;
        const paleHoundUnit = units.find((unit) => unit && unit.trackerKey === "enemy:smoke-e2")
          || units.find((unit) => unit && unit.name === "Pale Hound")
          || null;
        return (
          enemies.length >= 2 &&
          units.length >= Number(targetUnits || 3) &&
          !!ashRaiderUnit &&
          !!paleHoundUnit
        );
      },
      Number(minUnits || 3),
      { timeout: COMBAT_SYNC_TIMEOUT_MS }
    );
  } catch (err) {
    const summary = await collectCombatSummary(page);
    throw new Error(`${label} hydration wait timed out: actual=${JSON.stringify(summary)} error=${String(err && err.message ? err.message : err)}`);
  }
}

async function recoverCombatHydration(page, reason) {
  await page.evaluate(async (why) => {
    const liveState = (() => {
      try {
        return (typeof S !== "undefined" && S) ? S : (window.S || {});
      } catch (_err) {
        return window.S || {};
      }
    })();
    window.S = liveState;
    try {
      if (typeof window.updateCombatUI === "function") window.updateCombatUI();
    } catch (_err) {}
    try {
      if (typeof window.renderEnemies === "function") window.renderEnemies();
    } catch (_err) {}
    try {
      if (typeof window.renderCombatMap === "function") window.renderCombatMap();
    } catch (_err) {}
    try {
      if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
        await window.campaignSystem.syncSharedSilent(String(why || "combat-hydration-recover"));
      } else if (window.campaignSystem && typeof window.campaignSystem.syncSharedNow === "function") {
        await window.campaignSystem.syncSharedNow();
      }
    } catch (_err) {}
    try {
      const overlay = document.getElementById("combatModeOverlay");
      const overlayOpen = !!(overlay && overlay.classList.contains("open"));
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : null;
      if (!overlayOpen && combat && combat.active && combat.vttSession && typeof window.campaignSystem.joinSharedCombatMode === "function") {
        try { window.campaignSystem.joinSharedCombatMode(); } catch (_joinErr) {}
      }
    } catch (_err) {}
  }, String(reason || "combat-hydration-recover"));
  await wait(800);
}

async function waitForCombatHydrationWithRetry(page, label, minUnits = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await waitForCombatHydration(page, `${label} attempt ${attempt + 1}`, minUnits);
      return;
    } catch (err) {
      lastError = err;
      await recoverCombatHydration(page, `${label}-attempt-${attempt + 1}`);
    }
  }
  throw lastError || new Error(`${label} hydration failed after retries.`);
}

async function collectSceneEditorSummary(page) {
  return page.evaluate(() => {
    const storeState = window.CombatSceneStore && typeof window.CombatSceneStore.getState === 'function'
      ? window.CombatSceneStore.getState()
      : {};
    const scenes = Array.isArray(storeState.scenes) ? storeState.scenes : [];
    const activeScene = scenes.find((scene) => scene && String(scene.id || '') === String(storeState.activeSceneId || '')) || null;
    const overlay = document.getElementById('combatModeOverlay');
    return {
      overlayOpen: !!(overlay && overlay.classList.contains('open')),
      activeTab: (() => {
        const active = document.querySelector('#mainNavTablist .tab-btn.active[data-tab]');
        return active ? String(active.getAttribute('data-tab') || '') : '';
      })(),
      tokenCount: Array.isArray(storeState.tokens) ? storeState.tokens.length : 0,
      tokenNames: Array.isArray(storeState.tokens) ? storeState.tokens.map((token) => String(token && token.name || '')) : [],
      sceneName: String(activeScene && activeScene.name || '')
    };
  });
}

async function waitForSceneEditorState(page, expected, label) {
  const target = Object.assign({ minTokens: 0, requiredNames: [], overlayOpen: true }, expected || {});
  try {
    await page.waitForFunction(
      (criteria) => {
        const storeState = window.CombatSceneStore && typeof window.CombatSceneStore.getState === 'function'
          ? window.CombatSceneStore.getState()
          : {};
        const scenes = Array.isArray(storeState.scenes) ? storeState.scenes : [];
        const activeScene = scenes.find((scene) => scene && String(scene.id || '') === String(storeState.activeSceneId || '')) || null;
        const tokenNames = Array.isArray(storeState.tokens) ? storeState.tokens.map((token) => String(token && token.name || '')) : [];
        const active = document.querySelector('#mainNavTablist .tab-btn.active[data-tab]');
        const activeTab = active ? String(active.getAttribute('data-tab') || '') : '';
        const overlay = document.getElementById('combatModeOverlay');
        return (
          (!!(overlay && overlay.classList.contains('open')) === !!criteria.overlayOpen) &&
          (!criteria.activeTab || activeTab === String(criteria.activeTab)) &&
          tokenNames.length >= Number(criteria.minTokens || 0) &&
          (!criteria.sceneName || String(activeScene && activeScene.name || '') === String(criteria.sceneName)) &&
          (Array.isArray(criteria.requiredNames) ? criteria.requiredNames.every((name) => tokenNames.indexOf(String(name || '')) >= 0) : true)
        );
      },
      target,
      { timeout: COMBAT_SYNC_TIMEOUT_MS }
    );
  } catch (err) {
    const summary = await collectSceneEditorSummary(page);
    throw new Error(`${label} scene wait timed out: expected=${JSON.stringify(target)} actual=${JSON.stringify(summary)} error=${String(err && err.message ? err.message : err)}`);
  }
}

async function waitForSceneEditorStateWithRetry(page, expected, label, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await waitForSceneEditorState(page, expected, `${label} attempt ${attempt + 1}`);
      return;
    } catch (err) {
      lastError = err;
      await recoverCombatHydration(page, `${label}-recover-${attempt + 1}`);
      await page.evaluate(async () => {
        try {
          if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
            await window.campaignSystem.requestResync();
          }
        } catch (_err) {}
      });
      await wait(240 * (attempt + 1));
    }
  }
  throw lastError || new Error(`${label} scene state failed after retries.`);
}

async function ensurePlayerJoinedSharedVtt(page, label, minTokens = 2, attempts = 4) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await page.evaluate(() => {
      try {
        if (typeof window.joinSharedCampaignCombatModeFromPrompt === 'function') {
          window.joinSharedCampaignCombatModeFromPrompt();
          return;
        }
      } catch (_err) {}
      try {
        if (window.campaignSystem && typeof window.campaignSystem.joinSharedCombatMode === 'function') {
          window.campaignSystem.joinSharedCombatMode();
        }
      } catch (_err) {}
    });
    try {
      await waitForSceneEditorState(page, {
        overlayOpen: true,
        minTokens
      }, `${label} attempt ${attempt + 1}`);
      return;
    } catch (err) {
      lastError = err;
      await recoverCombatHydration(page, `${label}-recover-${attempt + 1}`);
      await wait(280 * (attempt + 1));
    }
  }
  throw lastError || new Error(`${label} join failed after retries.`);
}

async function waitForSharedVttPrompt(page, label) {
  try {
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById('combatModeOverlay');
        const shared = window.campaignSystem && window.campaignSystem.getSharedState
          ? window.campaignSystem.getSharedState()
          : null;
        return !!(
          window.joinSharedCampaignCombatModeFromPrompt
          && shared?.campaignCombat?.vttSession?.enteredAt
          && String(document.getElementById('modalTitle')?.textContent || '') === 'Join Shared Combat Mode'
          && !(overlay && overlay.classList.contains('open'))
        );
      },
      null,
      { timeout: COMBAT_SYNC_TIMEOUT_MS }
    );
  } catch (err) {
    const summary = await collectSceneEditorSummary(page);
    throw new Error(`${label} shared VTT prompt timed out: actual=${JSON.stringify(summary)} error=${String(err && err.message ? err.message : err)}`);
  }
}

async function syncSharedSilentRetry(page, reason, attempts = 6) {
  let lastResult = { ok: false, error: 'No sync attempts made.' };
  for (let i = 0; i < attempts; i += 1) {
    const syncReason = `${String(reason || "smoke-sync")}-attempt-${i + 1}`;
    const result = await page.evaluate(async (why) => {
      if (!window.campaignSystem || typeof window.campaignSystem.syncSharedSilent !== "function") {
        return { ok: false, error: "campaignSystem.syncSharedSilent unavailable" };
      }
      return window.campaignSystem.syncSharedSilent(why);
    }, syncReason);

    lastResult = result || { ok: false, error: 'No sync response.' };
    if (result && result.ok && !result.queued && !result.coalesced) return result;

    const msg = String(result && result.error || "");
    if (msg !== "Sync already in flight." && !result.queued && !result.coalesced) {
      return result;
    }

    await wait(120 + (i * 80));
  }
  if (lastResult && lastResult.ok && !lastResult.queued && !lastResult.coalesced) return lastResult;
  return { ok: false, error: "Sync retry exhausted." };
}

async function runScenario(browser, baseUrl) {
  const gmPage = await browser.newPage();
  const playerPage = await browser.newPage();

  for (const page of [gmPage, playerPage]) {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForCampaignReady(page);
    await clearSession(page);
    await ensureBaseState(page);
  }

  await gmPage.evaluate(() => {
    const el = document.getElementById("campaignNameInput");
    if (el) el.value = "Combat Smoke GM";
  });
  await gmPage.evaluate(async () => {
    await window.campaignSystem.createCampaign();
  });

  await gmPage.waitForFunction(
    () => {
      const st = window.campaignSystem.getState();
      return !!(st && st.code && st.role === "gm");
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const code = await gmPage.evaluate(() => window.campaignSystem.getState().code || "");
  if (!code) throw new Error("Combat smoke failed: no campaign code created.");

  await playerPage.evaluate(async (campaignCode) => {
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Combat Smoke Player" });
  }, code);

  await playerPage.waitForFunction(
    (campaignCode) => {
      const st = window.campaignSystem.getState();
      return !!(st && st.code === campaignCode && st.role === "player");
    },
    code,
    { timeout: STEP_TIMEOUT_MS }
  );

  await gmPage.waitForFunction(
    () => {
      const st = window.campaignSystem.getState();
      const members = (st && st.campaign && (st.campaign.roster || st.campaign.members)) || [];
      return members.length >= 2;
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const activeGmMode = await gmPage.evaluate(() => new Promise((resolve) => {
    window.campaignSystem.setGmMode('active', (result) => resolve(result || { ok: false, error: 'No GM mode callback.' }));
  }));
  if (!activeGmMode || !activeGmMode.ok) {
    throw new Error(`Could not enable active GM mode for VTT sync regression: ${JSON.stringify(activeGmMode)}`);
  }
  await playerPage.waitForFunction(
    () => String(window.campaignSystem.getSharedState()?.gmSettings?.mode || '') === 'active',
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  await gmPage.evaluate(() => {
    const cfg = window.getMapFogConfig('province');
    if (cfg && cfg.enabled) window.toggleMapFogForRegion('province');
    window.toggleMapFogForRegion('province');
  });
  await playerPage.waitForFunction(
    () => !!window.getMapFogConfig('province').enabled,
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
  const playerFogUi = await playerPage.evaluate(() => {
    if (typeof window.renderCompanionOverhaul === 'function') window.renderCompanionOverhaul();
    const button = document.querySelector('#tab-map .coFogModeBtn');
    return {
      enabled: !!window.getMapFogConfig('province').enabled,
      buttonPresent: !!button,
      buttonDisabled: !!(button && button.disabled),
      buttonText: String(button && button.textContent || '')
    };
  });
  if (!playerFogUi.enabled || !playerFogUi.buttonPresent || !playerFogUi.buttonDisabled || !/GM Fog: On/.test(playerFogUi.buttonText)) {
    throw new Error(`Player fog toolbar did not reflect GM authority: ${JSON.stringify(playerFogUi)}`);
  }
  await gmPage.evaluate(() => window.toggleMapFogForRegion('province'));
  await playerPage.waitForFunction(
    () => !window.getMapFogConfig('province').enabled,
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  await Promise.all([
    gmPage.evaluate(() => {
      if (typeof window.switchTab === "function") window.switchTab("combat");
    }),
    playerPage.evaluate(() => {
      if (typeof window.switchTab === "function") window.switchTab("combat");
    })
  ]);

  const combatSetup = await gmPage.evaluate(() => {
    const liveState = (() => {
      try {
        return (typeof S !== "undefined" && S) ? S : (window.S = window.S || {});
      } catch (_err) {
        return (window.S = window.S || {});
      }
    })();
    window.S = liveState;
    liveState.combat = {
      active: true,
      enemyDread: 8,
      spacing: "Nearby",
      round: 1,
      actionsLeft: 3
    };
    liveState.enemies = [
      { id: "smoke-e1", name: "Ash Raider", stress: 1, maxStress: 6, ally: false, conditions: [] }
    ];
    liveState.combatMap = {
      units: [
        { id: 1, name: "Combat Smoke GM", side: "ally", zone: "Engaged", isPlayer: true },
        { id: 2, name: "Ash Raider", side: "enemy", zone: "Nearby", fromTracker: true, trackerKey: "enemy:smoke-e1" }
      ],
      lastRelativeZone: "Nearby"
    };
    if (typeof window.updateCombatUI === "function") {
      try { window.updateCombatUI(); } catch (_err2) {}
    }
    if (typeof window.renderEnemies === "function") {
      try { window.renderEnemies(); } catch (_err3) {}
    }
    if (typeof window.renderCombatMap === "function") {
      try { window.renderCombatMap(); } catch (_err4) {}
    }

    const st = window.campaignSystem.getState();
    const members = (st && st.campaign && (st.campaign.roster || st.campaign.members)) || [];
    const gmMember = members.find((member) => member && member.role === "gm") || members[0];
    const playerMember = members.find((member) => member && member.role !== "gm") || members[members.length - 1];
    return {
      participants: [
        {
          token: String(gmMember && gmMember.token || "gm-token"),
          name: String(gmMember && gmMember.name || "GM"),
          role: "gm",
          character: { name: String(gmMember && gmMember.name || "GM"), stats: { valor: 10 } }
        },
        {
          token: String(playerMember && playerMember.token || "player-token"),
          name: String(playerMember && playerMember.name || "Player"),
          role: "player",
          character: { name: String(playerMember && playerMember.name || "Player"), stats: { valor: 6 } }
        }
      ]
    };
  });

  const started = await gmPage.evaluate(async (payload) => {
    return new Promise((resolve) => {
      window.campaignSystem.startCampaignCombat(payload.participants, function (res) {
        resolve(res || { ok: false, error: "No callback result." });
      }, { skipReadyCheck: true });
    });
  }, combatSetup);
  if (!started || !started.ok) {
    throw new Error(`Combat smoke failed to start campaign combat: ${JSON.stringify(started)}`);
  }

  await waitForSceneEditorState(playerPage, {
    overlayOpen: false,
    activeTab: 'combat'
  }, 'Player remains on Combat Tab before GM opens VTT');

  await gmPage.evaluate(() => {
    const btn = document.getElementById('combatEnterModeBtn');
    if (!btn) throw new Error('Missing combatEnterModeBtn');
    btn.click();
  });

  await waitForSceneEditorStateWithRetry(gmPage, {
    overlayOpen: true,
    minTokens: 1
  }, 'GM shared VTT opened');
  await waitForSharedVttPrompt(playerPage, 'Player receives shared VTT prompt');
  await waitForSceneEditorState(playerPage, {
    overlayOpen: false,
    activeTab: 'combat'
  }, 'Player stays on Combat Tab until joining shared VTT');

  await playerPage.evaluate(() => {
    if (
      typeof window.joinSharedCampaignCombatModeFromPrompt !== 'function'
      && !(window.campaignSystem && typeof window.campaignSystem.joinSharedCombatMode === 'function')
    ) {
      throw new Error('Missing shared VTT join entry point');
    }
  });
  await ensurePlayerJoinedSharedVtt(playerPage, 'Player initial shared VTT state', 2);

  const activePlayerToken = await playerPage.evaluate(() => String(window.campaignSystem.getState().token || ''));
  const actorPrompt = await gmPage.evaluate((token) => new Promise((resolve) => {
    window.campaignSystem.setCombatActor(token, (result) => resolve(result || { ok: false, error: 'No actor callback.' }));
  }), activePlayerToken);
  if (!actorPrompt || !actorPrompt.ok) {
    throw new Error(`GM could not grant the player VTT turn: ${JSON.stringify(actorPrompt)}`);
  }
  await playerPage.waitForFunction(
    (token) => String(window.campaignSystem.getSharedState()?.campaignCombat?.activeToken || '') === String(token || ''),
    activePlayerToken,
    { timeout: STEP_TIMEOUT_MS }
  );

  const playerMove = await playerPage.evaluate(async (token) => {
    const shared = window.campaignSystem.getSharedState();
    const scene = JSON.parse(JSON.stringify(shared?.combatScene || {}));
    const editor = scene?.sceneEditor;
    const owned = Array.isArray(editor?.tokens)
      ? editor.tokens.find((entry) => String(entry?.ownerToken || '') === String(token || ''))
      : null;
    if (!owned) return { ok: false, error: 'Owned Wayfarer token missing from shared VTT.' };
    const fromQ = Number(owned.q || 0);
    const nextQ = fromQ + 1;
    owned.q = nextQ;
    if (Array.isArray(editor.scenes)) {
      const active = editor.scenes.find((entry) => String(entry?.id || '') === String(editor.activeSceneId || ''));
      const snapshotOwned = Array.isArray(active?.tokens)
        ? active.tokens.find((entry) => String(entry?.ownerToken || '') === String(token || ''))
        : null;
      if (snapshotOwned) snapshotOwned.q = nextQ;
    }
    const result = await window.campaignSystem.syncSharedPatch({ combatScene: scene }, 'smoke-active-player-vtt-move');
    return { result, fromQ, nextQ };
  }, activePlayerToken);
  if (!playerMove || !playerMove.result || !playerMove.result.ok || (playerMove.result.conflicts || []).includes('combatScene')) {
    throw new Error(`Active player VTT movement did not sync: ${JSON.stringify(playerMove)}`);
  }
  try {
    await gmPage.waitForFunction(
      ({ token, q }) => {
        const tokens = window.campaignSystem.getSharedState()?.combatScene?.sceneEditor?.tokens || [];
        const owned = tokens.find((entry) => String(entry?.ownerToken || '') === String(token || ''));
        return !!owned && Number(owned.q || 0) === Number(q);
      },
      { token: activePlayerToken, q: playerMove.nextQ },
      { timeout: STEP_TIMEOUT_MS }
    );
  } catch (err) {
    const [gmMoveState, playerMoveState] = await Promise.all([gmPage, playerPage].map((page) => page.evaluate((token) => {
      const sharedTokens = window.campaignSystem.getSharedState()?.combatScene?.sceneEditor?.tokens || [];
      const storeTokens = window.CombatSceneStore?.getState?.().tokens || [];
      const sharedOwned = sharedTokens.find((entry) => String(entry?.ownerToken || '') === String(token || ''));
      const storeOwned = storeTokens.find((entry) => String(entry?.ownerToken || '') === String(token || ''));
      return {
        activeToken: String(window.campaignSystem.getSharedState()?.campaignCombat?.activeToken || ''),
        sharedOwned: sharedOwned ? { id: sharedOwned.id, q: sharedOwned.q, r: sharedOwned.r } : null,
        storeOwned: storeOwned ? { id: storeOwned.id, q: storeOwned.q, r: storeOwned.r } : null
      };
    }, activePlayerToken)));
    throw new Error(`Active player VTT movement was acknowledged but not propagated: result=${JSON.stringify(playerMove)} gm=${JSON.stringify(gmMoveState)} player=${JSON.stringify(playerMoveState)} cause=${String(err && err.message || err)}`);
  }

  await gmPage.evaluate(() => {
    if (typeof window.closeCombatSceneEditor === 'function') window.closeCombatSceneEditor();
  });
  await playerPage.waitForFunction(
    () => {
      const shared = window.campaignSystem && window.campaignSystem.getSharedState
        ? window.campaignSystem.getSharedState()
        : null;
      return !shared?.campaignCombat?.vttSession && !document.querySelector('#combatModeOverlay.open');
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  await gmPage.evaluate(() => {
    const button = document.querySelector('.ctx-btn[data-ctx="holding"]');
    if (typeof window.setContext === 'function') window.setContext('holding', button || null);
  });
  await playerPage.waitForFunction(
    () => {
      const activeContext = String(window._activeContext || '');
      const activeTab = document.querySelector('#mainNavTablist .tab-btn.active[data-tab]');
      return activeContext === 'holding' && String(activeTab?.getAttribute('data-tab') || '') === 'map';
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  await gmPage.evaluate(() => {
    window.openCombatSceneEditor({
      id: 'smoke-saved-empty-scene',
      name: 'Saved Empty Smoke Scene',
      board: { cols: 12, rows: 12, size: 42, zoom: 1, panX: 480, panY: 300, background: '' },
      layers: { terrain: {}, objects: {}, hazards: {} },
      fog: { enabled: true, revealed: {} },
      tokens: []
    });
  });
  await waitForSceneEditorState(gmPage, {
    overlayOpen: true,
    sceneName: 'Saved Empty Smoke Scene'
  }, 'GM saved empty scene opened');
  await waitForSharedVttPrompt(playerPage, 'Player receives saved empty scene prompt');
  const savedSceneInvite = await playerPage.evaluate(() => {
    const shared = window.campaignSystem.getSharedState();
    const session = shared?.campaignCombat?.vttSession || null;
    const editor = shared?.combatScene?.sceneEditor || null;
    return {
      sessionId: String(session?.id || ''),
      sessionSceneId: String(session?.activeSceneId || ''),
      sessionSceneName: String(session?.sceneName || ''),
      editorSceneId: String(editor?.activeSceneId || ''),
      boardCols: Number(editor?.board?.cols || 0)
    };
  });
  if (
    !savedSceneInvite.sessionId
    || savedSceneInvite.sessionSceneId !== 'smoke-saved-empty-scene'
    || savedSceneInvite.editorSceneId !== 'smoke-saved-empty-scene'
    || savedSceneInvite.boardCols !== 12
  ) {
    throw new Error(`Saved empty scene invitation was incomplete: ${JSON.stringify(savedSceneInvite)}`);
  }
  await ensurePlayerJoinedSharedVtt(playerPage, 'Player saved empty scene VTT state', 0);
  await waitForSceneEditorState(playerPage, {
    overlayOpen: true,
    sceneName: 'Saved Empty Smoke Scene'
  }, 'Player joined saved empty scene');

  const seeded = await gmPage.evaluate(async () => {
    const liveState = (() => {
      try {
        return (typeof S !== "undefined" && S) ? S : (window.S = window.S || {});
      } catch (_err) {
        return (window.S = window.S || {});
      }
    })();
    window.S = liveState;
    const combat = {
      active: true,
      enemyDread: 8,
      spacing: "Nearby",
      round: 1,
      actionsLeft: 3,
      sceneOpener: {
        zoneTerrain: "ruins",
        coverTier: "medium",
        coverDesc: "Broken pillars and shattered masonry"
      }
    };
    const enemies = [
      { id: "smoke-e1", name: "Ash Raider", stress: 1, maxStress: 6, ally: false, conditions: [] },
      { id: "smoke-e2", name: "Pale Hound", stress: 0, maxStress: 4, ally: false, conditions: [] }
    ];
    const combatMap = {
      units: [
        { id: 1, name: "Combat Smoke GM", side: "ally", zone: "Engaged", isPlayer: true },
        { id: 2, name: "Ash Raider", side: "enemy", zone: "Nearby", fromTracker: true, trackerKey: "enemy:smoke-e1" },
        { id: 3, name: "Pale Hound", side: "enemy", zone: "Flanking", fromTracker: true, trackerKey: "enemy:smoke-e2" }
      ],
      lastRelativeZone: "Nearby"
    };
    const combatAugState = { decentralizedHeartUsed: false };
    liveState.combat = combat;
    liveState.enemies = enemies;
    liveState.combatMap = combatMap;
    liveState.combatAugState = combatAugState;
    if (typeof window.openCombatSceneEditor === "function") {
      try {
        window.openCombatSceneEditor({
          id: "smoke-shared-scene",
          name: "Smoke Shared Scene",
          tokens: [
            { id: "smoke-player", name: "Combat Smoke GM", faction: "player", hp: 12, maxHp: 12, q: 0, r: 0, size: 1, isPlayer: true },
            { id: "smoke-enemy-a", name: "Ash Raider", faction: "monster", hp: 8, maxHp: 8, q: 1, r: 0, size: 1 },
            { id: "smoke-enemy-b", name: "Pale Hound", faction: "monster", hp: 6, maxHp: 6, q: 3, r: 0, size: 1 }
          ]
        });
      } catch (_sceneErr) {}
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
    if (!window.campaignSystem || typeof window.campaignSystem.syncSharedPatch !== "function") {
      return { ok: false, error: "campaignSystem.syncSharedPatch unavailable" };
    }
    const sceneEditor = liveState.combat && liveState.combat.sceneEditor && typeof liveState.combat.sceneEditor === "object"
      ? (JSON.parse(JSON.stringify(liveState.combat.sceneEditor)) || null)
      : null;
    return window.campaignSystem.syncSharedPatch({
      combatScene: {
        combat,
        enemies,
        combatMap,
        combatAugState,
        sceneEditor,
        naval: null,
        caravan: null
      }
    }, "smoke-combat-seed");
  });

  if (!seeded || !seeded.ok) {
    throw new Error(`Combat smoke failed to seed combat scene: ${JSON.stringify(seeded)}`);
  }

  await waitForCombatHydrationWithRetry(gmPage, "GM seeded state", 3);
  const expectedSeedGm = await collectCombatSummary(gmPage);
  const expectedSeed = {
    active: expectedSeedGm.active,
    enemyDread: expectedSeedGm.enemyDread,
    firstEnemyStress: expectedSeedGm.firstEnemyStress,
    secondEnemyStress: expectedSeedGm.secondEnemyStress,
    paleHoundPresent: expectedSeedGm.paleHoundPresent,
    minUnitCount: Math.max(3, Number(expectedSeedGm.unitCount || 0)),
    combatAugState: expectedSeedGm.combatAugState
  };
  await waitForCombatSummaryWithRetry(gmPage, playerPage, expectedSeed, "Player seeded state");

  const gmSummary = await collectCombatSummary(gmPage);
  const playerSummary = await collectCombatSummary(playerPage);
  process.stdout.write(`Combat sync smoke passed: code=${code}, savedScene=${JSON.stringify(savedSceneInvite)}, gm=${JSON.stringify(gmSummary)}, player=${JSON.stringify(playerSummary)}\n`);

  await gmPage.close();
  await playerPage.close();
}

async function run() {
  const requestedUrl = String(process.env.SMOKE_URL || "").trim();
  const port = requestedUrl
    ? Number(new URL(requestedUrl).port || 80)
    : await pickAvailablePort(Number(process.env.PORT || 3202) || 3202);
  const baseUrl = requestedUrl || `http://127.0.0.1:${port}`;
  const server = startServer(port);
  let browser;

  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await launchChromium();
    await runScenario(browser, baseUrl);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_err) {}
    }
    server.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

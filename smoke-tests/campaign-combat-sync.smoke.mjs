import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 16000;
const COMBAT_SYNC_TIMEOUT_MS = 10000;

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
    const ashRaiderUnit = units.find((unit) => unit && (unit.trackerKey === "enemy:smoke-e1" || unit.name === "Ash Raider")) || null;
    const paleHoundUnit = units.find((unit) => unit && (unit.trackerKey === "enemy:smoke-e2" || unit.name === "Pale Hound")) || null;
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

async function waitForCombatSummary(page, expected, label) {
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
        const ashRaiderUnit = units.find((unit) => unit && (unit.trackerKey === "enemy:smoke-e1" || unit.name === "Ash Raider")) || null;
        const paleHoundUnit = units.find((unit) => unit && (unit.trackerKey === "enemy:smoke-e2" || unit.name === "Pale Hound")) || null;
        return (
          !!combat.active === !!target.active &&
          Number(combat.enemyDread || 0) === Number(target.enemyDread || 0) &&
          Number(enemies[0] && enemies[0].stress || 0) === Number(target.firstEnemyStress || 0) &&
          Number(enemies[1] && enemies[1].stress || 0) === Number(target.secondEnemyStress || 0) &&
          String(ashRaiderUnit && ashRaiderUnit.zone || "") === String(target.ashRaiderZone || "") &&
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
  if (
    summary.active !== expected.active ||
    summary.enemyDread !== expected.enemyDread ||
    summary.firstEnemyStress !== expected.firstEnemyStress ||
    summary.secondEnemyStress !== expected.secondEnemyStress ||
    summary.ashRaiderZone !== expected.ashRaiderZone ||
    summary.paleHoundPresent !== expected.paleHoundPresent ||
    summary.unitCount < expected.minUnitCount ||
    summary.combatAugState !== expected.combatAugState
  ) {
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
    }
  }
  throw lastError || new Error(label + " failed after retries.");
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
        const ashRaiderUnit = units.find((unit) => unit && (unit.trackerKey === "enemy:smoke-e1" || unit.name === "Ash Raider")) || null;
        const paleHoundUnit = units.find((unit) => unit && (unit.trackerKey === "enemy:smoke-e2" || unit.name === "Pale Hound")) || null;
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

async function waitForSharedVttPrompt(page, label) {
  try {
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById('combatModeOverlay');
        return !!window.joinSharedCampaignCombatModeFromPrompt && !(overlay && overlay.classList.contains('open'));
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

async function runScenario(browser) {
  const gmPage = await browser.newPage();
  const playerPage = await browser.newPage();

  for (const page of [gmPage, playerPage]) {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
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

  await gmPage.waitForSelector('#combatModeOverlay.open', { timeout: STEP_TIMEOUT_MS });
  await waitForSharedVttPrompt(playerPage, 'Player receives shared VTT prompt');
  await waitForSceneEditorState(playerPage, {
    overlayOpen: false,
    activeTab: 'combat'
  }, 'Player stays on Combat Tab until joining shared VTT');

  await playerPage.evaluate(() => {
    if (typeof window.joinSharedCampaignCombatModeFromPrompt !== 'function') {
      throw new Error('Missing joinSharedCampaignCombatModeFromPrompt');
    }
    window.joinSharedCampaignCombatModeFromPrompt();
  });
  await playerPage.waitForSelector('#combatModeOverlay.open', { timeout: COMBAT_SYNC_TIMEOUT_MS });
  await waitForSceneEditorState(playerPage, {
    minTokens: 3,
    sceneName: 'Live Combat Map',
    requiredNames: ['Ash Raider']
  }, 'Player initial shared VTT state');

  await gmPage.evaluate(() => {
    window.openCombatSceneEditor({
      id: 'smoke-shared-scene',
      name: 'Smoke Shared Scene',
      tokens: [
        { id: 'smoke-player', name: 'Combat Smoke GM', faction: 'player', hp: 12, maxHp: 12, q: 0, r: 0, size: 1, isPlayer: true },
        { id: 'smoke-enemy-a', name: 'Ash Raider', faction: 'monster', hp: 8, maxHp: 8, q: 1, r: 0, size: 1 },
        { id: 'smoke-enemy-b', name: 'Pale Hound', faction: 'monster', hp: 6, maxHp: 6, q: 3, r: 0, size: 1 }
      ]
    });
  });

  await waitForSceneEditorState(playerPage, {
    minTokens: 3,
    sceneName: 'Smoke Shared Scene',
    requiredNames: ['Combat Smoke Player', 'Ash Raider', 'Pale Hound']
  }, 'Player refreshed shared VTT state');

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
    return window.campaignSystem.syncSharedPatch({
      combatScene: {
        combat,
        enemies,
        combatMap,
        combatAugState,
        naval: null,
        caravan: null
      }
    }, "smoke-combat-seed");
  });

  if (!seeded || !seeded.ok) {
    throw new Error(`Combat smoke failed to seed combat scene: ${JSON.stringify(seeded)}`);
  }

  await waitForCombatHydration(gmPage, "GM seeded state", 3);
  const expectedSeedGm = await collectCombatSummary(gmPage);
  const expectedSeed = {
    active: expectedSeedGm.active,
    enemyDread: expectedSeedGm.enemyDread,
    firstEnemyStress: expectedSeedGm.firstEnemyStress,
    secondEnemyStress: expectedSeedGm.secondEnemyStress,
    ashRaiderZone: expectedSeedGm.ashRaiderZone,
    paleHoundPresent: expectedSeedGm.paleHoundPresent,
    minUnitCount: Math.max(3, Number(expectedSeedGm.unitCount || 0)),
    combatAugState: expectedSeedGm.combatAugState
  };
  await waitForCombatSummaryWithRetry(gmPage, playerPage, expectedSeed, "Player seeded state");

  const mutated = await gmPage.evaluate(async () => {
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
      enemyDread: 12,
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
      { id: "smoke-e1", name: "Ash Raider", stress: 3, maxStress: 6, ally: false, conditions: [] },
      { id: "smoke-e2", name: "Pale Hound", stress: 1, maxStress: 4, ally: false, conditions: [] }
    ];
    const combatMap = {
      units: [
        { id: 1, name: "Combat Smoke GM", side: "ally", zone: "Engaged", isPlayer: true },
        { id: 2, name: "Ash Raider", side: "enemy", zone: "Engaged", fromTracker: true, trackerKey: "enemy:smoke-e1" },
        { id: 3, name: "Pale Hound", side: "enemy", zone: "Flanking", fromTracker: true, trackerKey: "enemy:smoke-e2" },
        { id: 4, name: "Combat Smoke Ally", side: "ally", zone: "Close", isPlayer: false }
      ],
      lastRelativeZone: "Nearby"
    };
    const combatAugState = { decentralizedHeartUsed: true };
    liveState.combat = combat;
    liveState.enemies = enemies;
    liveState.combatMap = combatMap;
    liveState.combatAugState = combatAugState;
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
    return window.campaignSystem.syncSharedPatch({
      combatScene: {
        combat,
        enemies,
        combatMap,
        combatAugState,
        naval: null,
        caravan: null
      }
    }, "smoke-combat-mutate");
  });

  if (!mutated || !mutated.ok) {
    throw new Error(`Combat smoke failed to sync mutated combat scene: ${JSON.stringify(mutated)}`);
  }

  await waitForCombatHydration(gmPage, "GM mutated state", 4);
  const expectedMutatedGm = await collectCombatSummary(gmPage);
  const expectedMutated = {
    active: expectedMutatedGm.active,
    enemyDread: expectedMutatedGm.enemyDread,
    firstEnemyStress: expectedMutatedGm.firstEnemyStress,
    secondEnemyStress: expectedMutatedGm.secondEnemyStress,
    ashRaiderZone: expectedMutatedGm.ashRaiderZone,
    paleHoundPresent: expectedMutatedGm.paleHoundPresent,
    minUnitCount: Math.max(4, Number(expectedMutatedGm.unitCount || 0)),
    combatAugState: expectedMutatedGm.combatAugState
  };
  await waitForCombatSummaryWithRetry(gmPage, playerPage, expectedMutated, "Player mutated state");

  const gmSummary = await collectCombatSummary(gmPage);
  const playerSummary = await collectCombatSummary(playerPage);
  process.stdout.write(`Combat sync smoke passed: code=${code}, gm=${JSON.stringify(gmSummary)}, player=${JSON.stringify(playerSummary)}\n`);

  await gmPage.close();
  await playerPage.close();
}

async function run() {
  const server = startServer();
  let browser;

  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await launchChromium();
    await runScenario(browser);
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

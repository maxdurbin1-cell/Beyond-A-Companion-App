import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 30000;

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
    } catch (_err) {}
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

async function runScenario(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => {
      return !!(
        window.createMission &&
        window.openRaidWingPopup &&
        window.resolveLegacyRaidHexEncounter &&
        window.finishLegacyRaidCombatScene
      );
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const setup = await page.evaluate(() => {
    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }
    if (window.S && typeof window.S === "object") {
      window.S.health = Math.max(8, Number(window.S.health || 0));
      window.S.mentalStress = Math.max(0, Number(window.S.mentalStress || 0));
    }

    const mission = window.createMission(
      "Raid Signal",
      "Smoke Raid Combat Return",
      "hard",
      "Province",
      "province",
      "Test Hostiles",
      {
        missionType: "legacy_raid",
        storyTheme: "legacy_raid"
      }
    );
    if (!mission) throw new Error("Failed to create legacy raid mission.");

    mission.legacyRaidBoss = "Ember Tyrant";
    mission.legacyRaidRegion = "province";
    mission.steps = mission.steps || {};
    mission.steps[1] = mission.steps[1] || {};
    mission.steps[1].completed = true;

    if (!window.openRaidWingPopup(mission.id, 2)) {
      throw new Error("Failed to open Wing 2 popup.");
    }

    const grid = mission.legacyRaidWingGrid && mission.legacyRaidWingGrid["2"];
    if (!grid || !grid.cells) throw new Error("Wing 2 grid state unavailable.");

    const currentId = String(grid.currentId || "");
    const cell = grid.cells[currentId];
    if (!cell) throw new Error("Current Wing 2 cell missing.");

    cell.eventType = "enemy";
    cell.cleared = false;
    grid.selectedId = currentId;

    const opened = !!window.resolveLegacyRaidHexEncounter(mission.id, 2);
    if (!opened) throw new Error("Enemy hex encounter did not resolve.");

    return {
      missionId: Number(mission.id || 0),
      wingNum: 2,
      cellId: currentId
    };
  });

  await page.waitForFunction(() => {
    const overlay = document.getElementById("rollModal");
    const title = document.getElementById("modalTitle");
    const content = document.getElementById("modalContent");
    const qp = document.getElementById("qpContent");
    const text = String(content && content.textContent ? content.textContent : "");
    const titleText = String(title && title.textContent ? title.textContent : "");
    const qpText = String(qp && qp.textContent ? qp.textContent : "");
    const raidFlowActive = !!(
      window.S &&
      window.S.combat &&
      window.S.combat.raidFlow &&
      window.S.combat.raidFlow.active
    );
    const hasRaidModal = !!(
      overlay &&
      overlay.classList.contains("open") &&
      /Raid Combat/i.test(titleText) &&
      /Combat Engaged/i.test(text)
    );
    const hasRaidQuickPanel = /Stage:/i.test(qpText) && /Enemy Action/i.test(qpText) && /Turn:/i.test(qpText);
    return !!(
      raidFlowActive &&
      (hasRaidModal || hasRaidQuickPanel)
    );
  }, null, { timeout: STEP_TIMEOUT_MS });

  const combatSummary = await page.evaluate(({ missionId, wingNum }) => {
    if (window.S && typeof window.S === "object") {
      window.S.health = Math.max(8, Number(window.S.health || 0));
    }
    if (window.S && Array.isArray(window.S.enemies)) {
      window.S.enemies = window.S.enemies.filter((enemy) => enemy && enemy.ally);
    }
    if (typeof window.finishLegacyRaidCombatScene !== "function") {
      throw new Error("finishLegacyRaidCombatScene is unavailable.");
    }
    window.finishLegacyRaidCombatScene(missionId, wingNum);
    return {
      enemiesLeft: Array.isArray(window.S && window.S.enemies)
        ? window.S.enemies.filter((enemy) => enemy && !enemy.ally).length
        : -1
    };
  }, setup);

  await page.waitForFunction(() => {
    const overlay = document.getElementById("rollModal");
    const title = document.getElementById("modalTitle");
    const content = document.getElementById("modalContent");
    const text = String(content && content.textContent ? content.textContent : "");
    return !!(
      overlay &&
      overlay.classList.contains("open") &&
      title &&
      /Raid Combat Complete/i.test(String(title.textContent || "")) &&
      /Return to Wing 2/i.test(text)
    );
  }, null, { timeout: STEP_TIMEOUT_MS });

  await page.close();

  if (pageErrors.length) {
    throw new Error(`Raid combat return smoke saw page errors: ${pageErrors.join(" | ")}`);
  }
  if (combatSummary.enemiesLeft !== 0) {
    throw new Error(`Expected no hostiles before ending combat, got: ${JSON.stringify(combatSummary)}`);
  }

  return setup;
}

let server;
let browser;

try {
  server = startServer();
  await waitForServer(BASE_URL, START_TIMEOUT_MS);
  browser = await chromium.launch({ headless: true });
  const result = await runScenario(browser);
  console.log(`raid combat return smoke passed: mission=${result.missionId} wing=${result.wingNum} cell=${result.cellId}`);
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill("SIGTERM");
}
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

  const setup = await page.evaluate(() => {
    if (typeof window.switchQP !== "function") {
      throw new Error("switchQP is unavailable.");
    }
    if (typeof window.resolveLegacyRaidHexEncounter !== "function") {
      throw new Error("resolveLegacyRaidHexEncounter is unavailable.");
    }

    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }

    if (typeof window.toggleQuickPanel === "function") {
      const qp = document.getElementById("quickPanel");
      if (!qp || !qp.classList.contains("open")) window.toggleQuickPanel();
    }
    if (typeof window.switchQP === "function") {
      window.switchQP("combat");
    }

    const mission = window.createMission(
      "Raid Signal",
      "Smoke Quick Panel Raid UI",
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
    const qp = document.getElementById("quickPanel");
    const content = document.getElementById("qpContent");
    const text = String(content && content.textContent ? content.textContent : "");
    return !!(
      qp &&
      qp.classList.contains("open") &&
      content &&
      /Stage:/i.test(text) &&
      /Round:/i.test(text) &&
      /Turn:/i.test(text) &&
      /Start Scene/i.test(text) &&
      /Enemy Action/i.test(text) &&
      /Combat Tab Wayfarer Action/i.test(text) &&
      !/Trauma Check/i.test(text)
    );
  }, null, { timeout: STEP_TIMEOUT_MS });

  const qpSummary = await page.evaluate(() => {
    const content = document.getElementById("qpContent");
    const text = String(content && content.textContent ? content.textContent : "");
    return {
      hasRaidStage: /Stage:/i.test(text),
      hasRound: /Round:/i.test(text),
      hasTurn: /Turn:/i.test(text),
      hasStart: /Start Scene/i.test(text),
      hasEnemyAction: /Enemy Action/i.test(text),
      hasWayfarerSelect: !!document.getElementById("raidCombatTabActionSelect"),
      hasTrauma: /Trauma Check/i.test(text)
    };
  });

  await page.close();

  if (pageErrors.length) {
    throw new Error(`Quick panel raid UI smoke saw page errors: ${pageErrors.join(" | ")}`);
  }
  if (!qpSummary.hasRaidStage || !qpSummary.hasRound || !qpSummary.hasTurn || !qpSummary.hasStart || !qpSummary.hasEnemyAction || !qpSummary.hasWayfarerSelect || qpSummary.hasTrauma) {
    throw new Error(`Quick panel raid UI assertions failed: ${JSON.stringify(qpSummary)}`);
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
  console.log(`quick panel raid ui smoke passed: mission=${result.missionId} wing=${result.wingNum} cell=${result.cellId}`);
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill("SIGTERM");
}

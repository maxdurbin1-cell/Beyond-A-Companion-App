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

async function runScenario(browser) {
  const page = await browser.newPage();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  await page.waitForFunction(
    () => {
      return !!(
        window.createMission &&
        window.openRaidWingPopup &&
        window.resolveLegacyRaidHexEncounter &&
        window.useLegacyRaidTeleport
      );
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const result = await page.evaluate(() => {
    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }

    const mission = window.createMission(
      "Raid Signal",
      "Smoke Teleport Choice",
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

    const cellIds = Object.keys(grid.cells);
    const startId = String(grid.currentId || "");
    const startCell = grid.cells[startId];
    if (!startCell) throw new Error("Current Wing 2 cell missing.");

    const teleportTarget = cellIds.find((id) => id !== startId && grid.cells[id] && !grid.cells[id].isStart) || startId;
    startCell.eventType = "teleport";
    startCell.teleportTo = String(teleportTarget);
    startCell.cleared = false;
    grid.selectedId = startId;

    const preCurrent = String(grid.currentId || "");
    const preSelected = String(grid.selectedId || "");

    const discovered = !!window.resolveLegacyRaidHexEncounter(mission.id, 2);
    const postDiscoverCurrent = String(grid.currentId || "");
    const postDiscoverSelected = String(grid.selectedId || "");

    const discoveredWithoutAutoTeleport = discovered && postDiscoverCurrent === preCurrent && postDiscoverSelected === preSelected;

    const used = !!window.useLegacyRaidTeleport(mission.id, 2);
    const postUseCurrent = String(grid.currentId || "");

    return {
      discovered,
      discoveredWithoutAutoTeleport,
      used,
      preCurrent,
      postDiscoverCurrent,
      teleportTarget: String(teleportTarget),
      postUseCurrent
    };
  });

  await page.close();

  if (!result.discovered) {
    throw new Error(`Teleport discover step did not resolve: ${JSON.stringify(result)}`);
  }
  if (!result.discoveredWithoutAutoTeleport) {
    throw new Error(`Teleport auto-fired during discover step: ${JSON.stringify(result)}`);
  }
  if (!result.used || result.postUseCurrent !== result.teleportTarget) {
    throw new Error(`Manual teleport use failed: ${JSON.stringify(result)}`);
  }

  return result;
}

let server;
let browser;

try {
  server = startServer();
  await waitForServer(BASE_URL, START_TIMEOUT_MS);
  browser = await chromium.launch({ headless: true });
  const result = await runScenario(browser);
  console.log(`raid teleport choice smoke passed: ${result.preCurrent} -> ${result.postUseCurrent}`);
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill("SIGTERM");
}

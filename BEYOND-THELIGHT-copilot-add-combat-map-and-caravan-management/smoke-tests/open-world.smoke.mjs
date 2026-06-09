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

async function runScenario(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => !!(
      window.generateMap &&
      window.openLegacyRaidChest &&
      window.resolveSeaEncounter &&
      window.ensureRivalState &&
      window.rollRivalEncounterForMap
    ),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const summary = await page.evaluate(() => {
    function resolveState() {
      try {
        return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
      } catch (_err) {
        return window.S || null;
      }
    }

    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }

    if (typeof window.generateMap === "function") window.generateMap();
    if (typeof window.generateLastSea === "function") window.generateLastSea();
    if (typeof window.generateWorldThatWasMap === "function") window.generateWorldThatWasMap();
    if (typeof window.generateStarSystemMap === "function") window.generateStarSystemMap("cluster");

    const state = resolveState();
    if (!state) throw new Error("Global state S is unavailable.");

    const provinceState = (typeof window.getProvinceMapState === "function") ? window.getProvinceMapState() : null;
    const firstHex = provinceState && Array.isArray(provinceState.mapData) && provinceState.mapData.length
      ? provinceState.mapData[0]
      : null;
    if (!firstHex) throw new Error("Province map did not generate hexes.");
    const firstKey = String(firstHex.col) + "," + String(firstHex.row);

    const beforeCredits = Number(state.credits || 0);
    const beforePath = Number(state.pathTokens || 0);
    const beforeTmw = Number(state.tmw || 0);

    if (typeof window.ensureRivalState === "function") window.ensureRivalState();
    state.rival.rapport = -5;
    state.rival.threatTier = 8;
    state.rival.alive = true;
    state.rival.lastGateToken = "";

    if (typeof window.rollRivalEncounterForMap === "function") {
      window.rollRivalEncounterForMap("province", {
        key: firstKey,
        label: String(firstHex.name || firstHex.type || "Province Hex"),
        terrain: String((firstHex.terrain && firstHex.terrain.name) || firstHex.type || "wilderness")
      });
    }

    const rivalAutoFight = !!(state.rival && state.rival.activeCombat);

    if (state.combat && typeof state.combat === "object") {
      state.combat.active = false;
    }
    state.enemies = [];
    if (state.rival) state.rival.activeCombat = null;

    state.rival.lastGateToken = "";
    state.rival.rapport = 6;
    state.rival.threatTier = 2;
    const originalRoll = window.roll;
    window.roll = function forcedLowRoll() { return 1; };
    try {
      window.rollRivalEncounterForMap("province", {
        key: firstKey,
        label: String(firstHex.name || firstHex.type || "Province Hex"),
        terrain: String((firstHex.terrain && firstHex.terrain.name) || firstHex.type || "wilderness")
      });
    } finally {
      window.roll = originalRoll;
    }

    state.solarCycleLegacy = state.solarCycleLegacy || {};
    state.solarCycleLegacy.raidKeys = { bronze: 1, silver: 1, gold: 1, platinum: 1 };
    state.solarCycleLegacy.raidMedals = Number(state.solarCycleLegacy.raidMedals || 0);
    state.solarCycleLegacy.raidPoints = Number(state.solarCycleLegacy.raidPoints || 0);
    state.solarCycleLegacy.raidTrophies = Array.isArray(state.solarCycleLegacy.raidTrophies) ? state.solarCycleLegacy.raidTrophies : [];

    const chestResults = [
      window.openLegacyRaidChest("bronze"),
      window.openLegacyRaidChest("silver"),
      window.openLegacyRaidChest("gold"),
      window.openLegacyRaidChest("platinum")
    ];
    if (!chestResults.every(Boolean)) {
      throw new Error("One or more raid chest opens failed.");
    }

    state.stats = state.stats || {};
    state.stats.spirit = 4;
    if (typeof window.ensureDarkAfflictionState === "function") window.ensureDarkAfflictionState();
    state.darkAfflictions = state.darkAfflictions || {};
    state.darkAfflictions.vampirism = state.darkAfflictions.vampirism || { active: false, corruption: 0, lastFedStamp: "" };
    state.darkAfflictions.vampirism.active = false;
    state.darkAfflictions.vampirism.corruption = 0;

    for (let i = 0; i < 5 && !state.darkAfflictions.vampirism.active; i += 1) {
      window.resolveSeaEncounter("fightOutcome", "2 Vampires", {
        won: true,
        vampireEncounter: true,
        vampireDread: 20
      });
    }

    return {
      rivalAutoFight,
      rivalAllySupportTriggered: String(state.rival && state.rival.lastOutcome || "") === "Ally Support",
      creditsDelta: Number(state.credits || 0) - beforeCredits,
      vampirismActive: !!(state.darkAfflictions && state.darkAfflictions.vampirism && state.darkAfflictions.vampirism.active)
    };
  });

  if (!summary.rivalAutoFight) {
    throw new Error("Rival auto-fight assertion failed: threat tier ambush did not trigger active combat.");
  }
  if (!summary.rivalAllySupportTriggered) {
    throw new Error("Rival ally support assertion failed: support bonuses did not apply.");
  }
  if (summary.creditsDelta <= 0) {
    throw new Error(`Raid chest assertion failed: no credits gained (delta=${summary.creditsDelta}).`);
  }
  if (!summary.vampirismActive) {
    throw new Error("Vampire conversion assertion failed: vampirism did not activate after repeated bite checks.");
  }

  if (pageErrors.length) {
    throw new Error(`Encountered ${pageErrors.length} page errors: ${pageErrors.join(" | ")}`);
  }

  await page.close();
  return summary;
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const summary = await runScenario(browser);
    process.stdout.write(`[smoke] open-world summary: ${JSON.stringify(summary)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await wait(250);
      if (!server.killed) server.kill("SIGKILL");
    }
  }
}

main().catch((err) => {
  process.stderr.write(`[smoke] open-world failed: ${String(err && err.stack ? err.stack : err)}\n`);
  process.exitCode = 1;
});

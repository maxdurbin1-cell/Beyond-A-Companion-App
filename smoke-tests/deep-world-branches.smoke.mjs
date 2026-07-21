import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  const preferred = Number(process.env.PORT || 3000);
  if (Number.isFinite(preferred) && preferred > 0 && preferred < 65536 && await canBindPort(preferred)) {
    return preferred;
  }
  for (let i = 0; i < 40; i += 1) {
    const port = 4200 + Math.floor(Math.random() * 1000);
    if (await canBindPort(port)) return port;
  }
  throw new Error("Unable to find a free port for deep world branch smoke test.");
}

function startServer(port) {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) }
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

async function launchBrowser() {
  const launchers = [
    () => chromium.launch({ headless: true }),
    () => chromium.launch({ channel: "chrome", headless: true }),
    () => chromium.launch({ channel: "msedge", headless: true })
  ];
  let lastError = null;
  for (const launch of launchers) {
    try {
      return await launch();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Unable to launch a Chromium browser for smoke testing.");
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_err) {
      // Retry until ready.
    }
    await wait(250);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function runScenario(page, baseUrl) {
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  await page.goto(`${baseUrl}/?skipIntro=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    () => typeof window.generateStarSystemMap === "function"
      && typeof window.renderPlanetExplorationPanel === "function"
      && typeof window.renderYessodPanel === "function"
      && typeof window.resolveGlobalManualActionCheck === "function",
    null,
    { timeout: 30000 }
  );

  const summary = await page.evaluate(() => {
    let smokeRandomState = 0x51de2026;
    Math.random = () => {
      smokeRandomState = (Math.imul(smokeRandomState, 1664525) + 1013904223) >>> 0;
      return smokeRandomState / 0x100000000;
    };
    const requireState = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const closeModalIfOpen = () => {
      if (typeof window.closeModal === "function") {
        try { window.closeModal(); } catch (_err) {}
      }
    };
    const modalTitle = () => String((document.getElementById("modalTitle") || {}).textContent || "").trim();
    const modalText = () => String((document.getElementById("modalContent") || {}).textContent || "").trim();
    const clickButtonByText = (scope, label) => {
      const root = scope ? document.querySelector(scope) : document;
      if (!root) return false;
      const target = Array.from(root.querySelectorAll("button")).find((button) => {
        return String(button.textContent || "").indexOf(label) >= 0;
      });
      if (!target) return false;
      target.click();
      return true;
    };
    const setManualRollTotals = (actionTotal, dreadTotal) => {
      const actionInput = document.getElementById("globalManualActionValue");
      const dreadInput = document.getElementById("globalManualDreadValue");
      requireState(actionInput && dreadInput, "Manual roll inputs were not rendered.");
      actionInput.value = String(actionTotal);
      dreadInput.value = String(dreadTotal);
    };
    const ensureLostCityData = (cell) => {
      cell.data = cell.data || {};
      cell.data.lostCity = cell.data.lostCity || {
        watch: "Irradiated Ones patrol the corridor.",
        buildingCondition: "Partially Intact",
        buildingThis: "Archive tower",
        buildingMade: "Steel and ceramic",
        buildingFor: "Data preservation",
        buildingInside: "Dormant drones and locked vaults",
        buildingNow: "Ghost district",
        discovery: {
          shape: "Signal shrine",
          fn: "Reveals hazard patterns",
          current: "Partially active"
        }
      };
    };
    const ensureRuinData = (cell) => {
      cell.data = cell.data || {};
      cell.data.ruin = cell.data.ruin || {
        builder: "Wardens",
        builtFor: "Archive vault",
        construction: "Basalt and alloy ribs",
        entrance: "Collapsed cargo hatch",
        rooms: 4,
        novelty: "Zero-gravity pockets in collapsed halls"
      };
    };

    if (window.introSystem && typeof window.introSystem.skipIntro === "function") {
      window.introSystem.skipIntro();
    }
    if (window.soloReference && typeof window.soloReference.close === "function") {
      window.soloReference.close();
    }
    closeModalIfOpen();

    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }
    if (window.settingsSystem && typeof window.settingsSystem.isManualRollMode === "function" && !window.settingsSystem.isManualRollMode()) {
      window.settingsSystem.toggleManualRollMode();
    }

    window.generateStarSystemMap("cluster");
    const starState = window.S && window.S.starSystem ? window.S.starSystem : null;
    requireState(starState && Array.isArray(starState.hexes) && starState.hexes.length, "Star system map did not generate.");

    const planetHex = starState.hexes.find((hex) => hex && hex.type === "planet");
    requireState(planetHex, "No planet hex was generated.");

    if (typeof window.selectStarHex === "function") window.selectStarHex(planetHex.id);
    else if (typeof window.setCurrentStarHexById === "function") window.setCurrentStarHexById(planetHex.id);
    else starState.currentHexId = planetHex.id;
    starState.activePlanetHexId = planetHex.id;

    const planetState = ensurePlanetSurfaceState(planetHex);
    requireState(planetState && Array.isArray(planetState.cells) && planetState.cells.length, "Planet surface state was not created.");

    const merchantCell = planetState.cells.find((cell) => cell.marker === "merchant_colony") || planetState.cells[0];
    const lostCityCell = planetState.cells.find((cell) => cell.marker === "empty_colony") || planetState.cells[1] || planetState.cells[0];
    const ruinCell = planetState.cells.find((cell) => cell.marker === "ruins") || planetState.cells[2] || planetState.cells[0];

    merchantCell.marker = "merchant_colony";
    merchantCell.explored = true;
    lostCityCell.marker = "empty_colony";
    lostCityCell.explored = true;
    ruinCell.marker = "ruins";
    ruinCell.explored = true;
    ensureLostCityData(lostCityCell);
    ensureRuinData(ruinCell);

    planetState.selectedCellId = merchantCell.id;
    renderPlanetExplorationPanel();

    const createdTask = window.createPlanetTask({
      preferredCellId: merchantCell.id,
      title: "Smoke Surface Task",
      text: "Verify planet task visibility from the surface panel."
    });
    requireState(createdTask && createdTask.id, "Planet task was not created.");

    const planetPanelText = String((document.getElementById("tab-planet") || {}).textContent || "");
    const taskVisible = /Open Tasks/i.test(planetPanelText) && planetPanelText.indexOf("Smoke Surface Task") >= 0;

    window.openPlanetMerchantMarket();
    const merchantOffersVisible = /Merchant Market/i.test(modalTitle()) && /Cost:/i.test(modalText()) && /Buy/i.test(modalText());
    closeModalIfOpen();

    planetState.selectedCellId = merchantCell.id;
    renderPlanetExplorationPanel();
    requireState(clickButtonByText("#tab-planet", "Sneak Into Black Market"), "Black market button was not available on the Planet panel.");
    const pendingBlackMarket = window._pendingGlobalManualActionCheck || null;
    requireState(!!pendingBlackMarket, "Black market manual prompt did not open.");
    const blackMarketPromptOk = pendingBlackMarket.dreadDie === 12 && /Black Market/i.test(modalTitle());
    setManualRollTotals(12, 5);
    window.resolveGlobalManualActionCheck("success", false);
    const blackMarketOffersVisible = /Black Market Dealer/i.test(modalText()) && /Hacks/i.test(modalText());
    closeModalIfOpen();

    planetState.selectedCellId = lostCityCell.id;
    renderPlanetExplorationPanel();
    window.openPlanetLostCityBuildingExploration();
    const lostCityBuildingVisible = /Building Exploration/i.test(modalText()) && /District Travel/i.test(modalText()) && /Open District Hexcrawl/i.test(modalText());
    requireState(clickButtonByText("#modalContent", "Open District Hexcrawl"), "Lost city hexcrawl button was not available.");
    const lostCityHexcrawlVisible = /District Network/i.test(modalText()) && /Scout Node/i.test(modalText());
    const beforeLostCityHistory = Array.isArray((lostCityCell.data.lostCityHexcrawl || {}).history)
      ? lostCityCell.data.lostCityHexcrawl.history.length
      : 0;
    requireState(clickButtonByText("#modalContent", "Scout Node"), "Lost city scout action was not available.");
    const afterLostCityHistory = Array.isArray((lostCityCell.data.lostCityHexcrawl || {}).history)
      ? lostCityCell.data.lostCityHexcrawl.history.length
      : 0;
    closeModalIfOpen();

    window.openPlanetRuinPopup(ruinCell.id);
    const ruinModalVisible = /Planet Ruins/i.test(modalTitle()) && /Room 1/i.test(modalText());
    requireState(clickButtonByText("#modalContent", "Explore"), "Planet ruin explore action was not available.");
    const entranceRoom = Array.isArray(ruinCell.data.ruinRooms) && ruinCell.data.ruinRooms.length ? ruinCell.data.ruinRooms[0] : null;
    const ruinEntranceCleared = !!(entranceRoom && entranceRoom.cleared);
    closeModalIfOpen();

    const yessodState = ensureYessodState();
    requireState(yessodState && Array.isArray(yessodState.cells) && yessodState.cells.length, "Yessod state did not initialize.");
    window.S.starSystem.yessodUnlocked = true;
    renderYessodPanel();

    const yessodLift = yessodState.cells.find((cell) => cell.marker === "lift") || yessodState.cells[0];
    const yessodBarrier = yessodState.cells.find((cell) => cell.marker === "barrier") || yessodState.cells[1] || yessodState.cells[0];
    const yessodLostCity = yessodState.cells.find((cell) => cell.marker === "lost_city") || yessodState.cells[2] || yessodState.cells[0];

    yessodLift.marker = "lift";
    yessodState.selectedCellId = yessodLift.id;
    const traumaBeforeLift = Number(window.S.trauma || 0);
    window.yessodUseLift(1);
    const traumaAfterLift = Number(window.S.trauma || 0);
    const liftAppliedTrauma = traumaAfterLift === traumaBeforeLift + 1;
    const liftAdvancedStrata = Number(yessodState.currentStrata || 0) === 2;

    yessodBarrier.marker = "barrier";
    yessodState.selectedCellId = yessodBarrier.id;
    const traumaBeforeBarrier = Number(window.S.trauma || 0);
    window.yessodTraverseBarrier(yessodBarrier.id);
    const pendingBarrier = window._pendingGlobalManualActionCheck || null;
    requireState(!!pendingBarrier, "Yessod barrier prompt did not open.");
    const barrierPromptOk = /Barrier/i.test(modalTitle());
    setManualRollTotals(2, 9);
    window.resolveGlobalManualActionCheck("failure", false);
    const traumaAfterBarrier = Number(window.S.trauma || 0);
    const barrierAppliedTrauma = traumaAfterBarrier > traumaBeforeBarrier;

    yessodLostCity.marker = "lost_city";
    yessodState.selectedCellId = yessodLostCity.id;
    window.yessodExploreLostCity(yessodLostCity.id);
    const pendingYessodLostCity = window._pendingGlobalManualActionCheck || null;
    requireState(!!pendingYessodLostCity, "Yessod lost city manual prompt did not open.");
    const yessodPromptOk = pendingYessodLostCity.dreadDie === 8 && /Lost City/i.test(modalTitle());
    setManualRollTotals(2, 9);
    window.resolveGlobalManualActionCheck("failure", false);
    const yessodEncounterText = String((window.S.starSystem.yessod && window.S.starSystem.yessod.lastEncounter) || "");

    window.enterYessodBossTower("mephisto_tower");
    const pendingBossCombat = window.S.starSystem.yessod && window.S.starSystem.yessod.pendingCombatOutcome
      ? window.S.starSystem.yessod.pendingCombatOutcome
      : null;
    const bossSeeded = !!(pendingBossCombat && pendingBossCombat.type === "boss" && Array.isArray(window.S.enemies) && window.S.enemies.length >= 7);
    closeModalIfOpen();

    return {
      planet: {
        taskVisible,
        merchantOffersVisible,
        blackMarketPromptOk,
        blackMarketOffersVisible,
        lostCityBuildingVisible,
        lostCityHexcrawlVisible,
        lostCityHistoryAdvanced: afterLostCityHistory > beforeLostCityHistory,
        ruinModalVisible,
        ruinEntranceCleared
      },
      yessod: {
        liftAppliedTrauma,
        liftAdvancedStrata,
        barrierPromptOk,
        barrierAppliedTrauma,
        yessodPromptOk,
        encounterRecorded: /Lost City Exploration/i.test(yessodEncounterText),
        bossSeeded
      }
    };
  });

  const checks = [
    summary.planet.taskVisible,
    summary.planet.merchantOffersVisible,
    summary.planet.blackMarketPromptOk,
    summary.planet.blackMarketOffersVisible,
    summary.planet.lostCityBuildingVisible,
    summary.planet.lostCityHexcrawlVisible,
    summary.planet.lostCityHistoryAdvanced,
    summary.planet.ruinModalVisible,
    summary.planet.ruinEntranceCleared,
    summary.yessod.liftAppliedTrauma,
    summary.yessod.liftAdvancedStrata,
    summary.yessod.barrierPromptOk,
    summary.yessod.barrierAppliedTrauma,
    summary.yessod.yessodPromptOk,
    summary.yessod.encounterRecorded,
    summary.yessod.bossSeeded
  ];

  if (checks.some((entry) => !entry)) {
    throw new Error(`Deep world branch assertion failed: ${JSON.stringify(summary)}`);
  }
  if (pageErrors.length) {
    throw new Error(`Encountered ${pageErrors.length} page errors: ${pageErrors.join(" | ")}`);
  }

  return summary;
}

async function run() {
  const port = await pickPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServer(port);
  let browser;
  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const summary = await runScenario(page, baseUrl);
    process.stdout.write(`[smoke] deep-world-branches summary: ${JSON.stringify(summary)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await wait(250);
      if (!server.killed) server.kill("SIGKILL");
    }
  }
}

run().catch((err) => {
  process.stderr.write(`[smoke] deep-world-branches failed: ${String(err && err.stack ? err.stack : err)}\n`);
  process.exitCode = 1;
});

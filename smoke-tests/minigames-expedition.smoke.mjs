import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      // Retry.
    }
    await wait(300);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
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

async function runAssertions(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  const result = await page.evaluate(() => {
    if (typeof window.startHoldingMiniGamesExpedition !== "function") {
      return { ok: false, error: "startHoldingMiniGamesExpedition missing" };
    }
    if (typeof window.confirmCrucibleExpeditionLoadout !== "function") {
      return { ok: false, error: "confirmCrucibleExpeditionLoadout missing" };
    }
    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      try {
        window.settingsSystem.setGameMode("solo", { silent: true });
      } catch (_err) {}
    }

    window.startHoldingMiniGamesExpedition("smoke-minigames-expedition");
    window._expeditionLoadout = {
      armor: "medium",
      weapon: "sword",
      flavor: "Teleportation: Teleport to any location you can see"
    };
    const loadoutOk = window.confirmCrucibleExpeditionLoadout();
    if (!loadoutOk) {
      return { ok: false, error: "loadout confirmation failed" };
    }

    const match = typeof window.getHoldingCrucibleMatch === "function"
      ? window.getHoldingCrucibleMatch()
      : (window.S && window.S.holding && window.S.holding.crucible ? window.S.holding.crucible.match : null);
    if (!match || !match.expedition || !match.hexMap || !match.hexMap.hexes) {
      return { ok: false, error: "expedition match missing" };
    }

    const ruinCell = Object.values(match.hexMap.hexes).find((cell) => cell && cell.ruin);
    const party = (match.allies || []).filter((unit) => unit && unit.isPlayer && Number(unit.hp || 0) > 0);
    if (!ruinCell) {
      return { ok: false, error: "no ruin hex available" };
    }
    if (party.length < 1) {
      return { ok: false, error: `expected at least 1 wayfarer, got ${party.length}` };
    }

    const lead = party[0];
    lead.position = { q: Number(ruinCell.q || 0), r: Number(ruinCell.r || 0) };
    match.selectedAllyId = String(lead.id || "");
    match.selectedAllyTargetId = String(lead.id || "");
    window.holdingCrucibleExpeditionSearchHex();

    const activeRuin = match.expedition.activeRuin;
    if (!activeRuin || !Array.isArray(activeRuin.rooms)) {
      return { ok: false, error: "ruin crawl did not start" };
    }

    for (let i = 0; i < activeRuin.rooms.length; i += 1) {
      window.holdingCrucibleExploreExpeditionRuinRoom(i);
    }

    const exploredRooms = activeRuin.rooms.filter((room) => room && room.explored).length;
    window.holdingCrucibleResolveExpeditionRuinBoss();

    const combatMatch = typeof window.getHoldingCrucibleMatch === "function"
      ? window.getHoldingCrucibleMatch()
      : match;
    const enemy = combatMatch && combatMatch.enemies && combatMatch.enemies[0];
    if (!combatMatch || !combatMatch.expedition || combatMatch.expedition.phase !== "combat" || !enemy) {
      return { ok: false, error: "ruin boss combat did not start", exploredRooms };
    }

    enemy.hp = 30;
    enemy.maxHp = 30;
    const anchors = [
      { q: Number(enemy.position && enemy.position.q || 0) - 1, r: Number(enemy.position && enemy.position.r || 0) },
      { q: Number(enemy.position && enemy.position.q || 0), r: Number(enemy.position && enemy.position.r || 0) - 1 },
      { q: Number(enemy.position && enemy.position.q || 0) + 1, r: Number(enemy.position && enemy.position.r || 0) },
      { q: Number(enemy.position && enemy.position.q || 0), r: Number(enemy.position && enemy.position.r || 0) + 1 }
    ];
    party.forEach((ally, idx) => {
      ally.position = anchors[idx] || anchors[0];
      ally.ap = 2;
    });

    match.selectedTargetId = String(enemy.id || "");

    const modalBefore = String((document.getElementById("modalContent") && document.getElementById("modalContent").textContent) || "");
    const queueSnapshots = [];

    const isCampaignParty = party.length > 1;
    if (isCampaignParty) {
      for (const ally of party) {
        window.selectHoldingCrucibleUnit(String(ally.id || ""));
        const actionEl = document.getElementById("crucibleTeamActionSelect");
        const targetEl = document.getElementById("crucibleTeamTargetSelect");
        if (!actionEl || !targetEl) {
          return { ok: false, error: "combat controls missing", modalBefore };
        }
        actionEl.value = "attack";
        if (typeof window.refreshCrucibleTeamActionOptions === "function") {
          window.refreshCrucibleTeamActionOptions();
        }
        targetEl.value = `enemy:${String(enemy.id || "")}`;
        const queued = window.holdingCrucibleExecuteTeamAction();
        queueSnapshots.push({ ally: ally.name, queued, apAfterQueue: Number(ally.ap || 0) });
      }
    } else {
      const actionEl = document.getElementById("crucibleWayfarerActionSelect");
      const targetEl = document.getElementById("crucibleWayfarerTargetSelect");
      if (!actionEl || !targetEl) {
        return { ok: false, error: "wayfarer combat controls missing", modalBefore };
      }
      actionEl.value = "strike";
      if (typeof window.refreshCrucibleWayfarerActionOptions === "function") {
        window.refreshCrucibleWayfarerActionOptions();
      }
      targetEl.value = `enemy:${String(enemy.id || "")}`;
      const executed = window.holdingCrucibleExecuteWayfarerAction();
      queueSnapshots.push({ ally: lead.name, executed, apAfterExecute: Number(lead.ap || 0) });
    }

    const queuedBeforeResolve = Array.isArray(combatMatch.expedition.pendingCombatActions)
      ? combatMatch.expedition.pendingCombatActions.length
      : 0;

    window.holdingCrucibleAdvanceRound();
    if (!isCampaignParty) {
      if (typeof window.holdingCrucibleRunEnemyAI === "function") {
        window.holdingCrucibleRunEnemyAI();
      }
      window.holdingCrucibleAdvanceRound();
    }

    const after = typeof window.getHoldingCrucibleMatch === "function"
      ? window.getHoldingCrucibleMatch()
      : combatMatch;
    const queuedAfterResolve = after && after.expedition && Array.isArray(after.expedition.pendingCombatActions)
      ? after.expedition.pendingCombatActions.length
      : -1;
    const modalAfter = String((document.getElementById("modalContent") && document.getElementById("modalContent").textContent) || "");
    const livingEnemies = after ? (after.enemies || []).filter((unit) => unit && Number(unit.hp || 0) > 0).length : 0;

    return {
      ok: true,
      partySize: party.length,
      ruinRooms: activeRuin.rooms.length,
      exploredRooms,
      queuedBeforeResolve,
      queuedAfterResolve,
      roundAfterResolve: after ? Number(after.round || 0) : 0,
      partyRoundAfterResolve: after && after.expedition ? Number(after.expedition.partyRound || 0) : 0,
      phaseAfterResolve: after && after.expedition ? String(after.expedition.phase || "") : "",
      livingEnemies,
      queueSnapshots,
      isCampaignParty,
      sawResolveLabel: /Resolve Party Round/i.test(modalBefore),
      sawQueueSummary: /Queued actions/i.test(modalBefore),
      sawSoloExecuteLabel: /Begin Enemy Turn|End Enemy Turn/i.test(modalBefore),
      sawRuinCopy: /Ruin Internal Crawl/i.test(modalAfter) || /Expedition Combat Round/i.test(modalAfter),
      logTail: after && Array.isArray(after.log) ? after.log.slice(-8) : []
    };
  });

  if (!result || !result.ok) {
    throw new Error(`Mini Games expedition smoke setup failed: ${JSON.stringify(result)}`);
  }
  if (result.partySize < 1) {
    throw new Error(`Expedition party did not include a wayfarer: ${JSON.stringify(result)}`);
  }
  if (result.ruinRooms < 4 || result.ruinRooms > 6 || result.exploredRooms !== result.ruinRooms) {
    throw new Error(`Ruin crawl did not fully resolve: ${JSON.stringify(result)}`);
  }
  if (result.isCampaignParty) {
    if (!result.sawResolveLabel || !result.sawQueueSummary) {
      throw new Error(`Campaign expedition UI did not expose round planning controls: ${JSON.stringify(result)}`);
    }
    if (result.queuedBeforeResolve < result.partySize) {
      throw new Error(`Did not queue the full party before resolving: ${JSON.stringify(result)}`);
    }
  } else {
    if (!result.sawSoloExecuteLabel) {
      throw new Error(`Solo expedition UI did not expose immediate combat controls: ${JSON.stringify(result)}`);
    }
    if (result.queuedBeforeResolve > 0) {
      throw new Error(`Solo expedition should not queue party actions: ${JSON.stringify(result)}`);
    }
  }
  if (result.queuedAfterResolve !== 0) {
    throw new Error(`Queued expedition actions were not cleared after round resolution: ${JSON.stringify(result)}`);
  }
  if (result.roundAfterResolve < 2 && result.livingEnemies > 0 && result.isCampaignParty) {
    throw new Error(`Campaign expedition round did not advance through enemy response: ${JSON.stringify(result)}`);
  }
  if (!result.isCampaignParty && result.livingEnemies > 0 && result.phaseAfterResolve !== "combat") {
    throw new Error(`Solo expedition combat phase unexpectedly ended: ${JSON.stringify(result)}`);
  }

  process.stdout.write(`Mini Games expedition smoke passed: ${JSON.stringify(result)}\n`);
}

async function run() {
  const server = startServer();
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await launchChromium();
    const page = await browser.newPage();
    await runAssertions(page);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

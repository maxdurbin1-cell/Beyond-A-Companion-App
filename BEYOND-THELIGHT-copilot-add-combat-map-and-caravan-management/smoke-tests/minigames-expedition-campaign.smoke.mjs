import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_err) {}
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
    if (!window.settingsSystem || typeof window.settingsSystem.setGameMode !== "function") {
      return { ok: false, error: "settingsSystem.setGameMode missing" };
    }
    if (typeof window.startHoldingMiniGamesExpedition !== "function") {
      return { ok: false, error: "startHoldingMiniGamesExpedition missing" };
    }
    if (typeof window.confirmCrucibleExpeditionLoadout !== "function") {
      return { ok: false, error: "confirmCrucibleExpeditionLoadout missing" };
    }

    window.settingsSystem.setGameMode("campaign", { silent: true });
    window.startHoldingMiniGamesExpedition("smoke-minigames-expedition-campaign");

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

    const party = (match.allies || []).filter((unit) => unit && unit.isPlayer && Number(unit.hp || 0) > 0);
    if (party.length < 4) {
      return { ok: false, error: `expected campaign party >=4, got ${party.length}` };
    }

    const ruinCell = Object.values(match.hexMap.hexes).find((cell) => cell && cell.ruin);
    if (!ruinCell) {
      return { ok: false, error: "no ruin hex available" };
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
    window.holdingCrucibleResolveExpeditionRuinBoss();

    const combatMatch = typeof window.getHoldingCrucibleMatch === "function"
      ? window.getHoldingCrucibleMatch()
      : match;
    const enemy = combatMatch && combatMatch.enemies && combatMatch.enemies[0];
    if (!combatMatch || !combatMatch.expedition || combatMatch.expedition.phase !== "combat" || !enemy) {
      return { ok: false, error: "ruin boss combat did not start" };
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
      ally.ap = Number(ally.maxAp || 2);
    });

    match.selectedTargetId = String(enemy.id || "");
    const modalBefore = String((document.getElementById("modalContent") && document.getElementById("modalContent").textContent) || "");

    const queueSnapshots = [];
    for (const ally of party) {
      window.selectHoldingCrucibleUnit(String(ally.id || ""));
      const actionEl = document.getElementById("crucibleTeamActionSelect");
      const targetEl = document.getElementById("crucibleTeamTargetSelect");
      if (!actionEl || !targetEl) {
        return { ok: false, error: "campaign team action controls missing", modalBefore };
      }
      actionEl.value = "attack";
      if (typeof window.refreshCrucibleTeamActionOptions === "function") {
        window.refreshCrucibleTeamActionOptions();
      }
      targetEl.value = `enemy:${String(enemy.id || "")}`;
      const queued = window.holdingCrucibleExecuteTeamAction();
      queueSnapshots.push({ ally: ally.name, queued, apAfterQueue: Number(ally.ap || 0) });
    }

    const queuedBeforeResolve = Array.isArray(combatMatch.expedition.pendingCombatActions)
      ? combatMatch.expedition.pendingCombatActions.length
      : 0;
    window.holdingCrucibleAdvanceRound();

    const after = typeof window.getHoldingCrucibleMatch === "function"
      ? window.getHoldingCrucibleMatch()
      : combatMatch;
    const queuedAfterResolve = after && after.expedition && Array.isArray(after.expedition.pendingCombatActions)
      ? after.expedition.pendingCombatActions.length
      : -1;
    const livingEnemies = after ? (after.enemies || []).filter((unit) => unit && Number(unit.hp || 0) > 0).length : 0;

    return {
      ok: true,
      partySize: party.length,
      queuedBeforeResolve,
      queuedAfterResolve,
      roundAfterResolve: after ? Number(after.round || 0) : 0,
      partyRoundAfterResolve: after && after.expedition ? Number(after.expedition.partyRound || 0) : 0,
      phaseAfterResolve: after && after.expedition ? String(after.expedition.phase || "") : "",
      livingEnemies,
      queueSnapshots,
      sawResolveLabel: /Resolve Party Round/i.test(modalBefore),
      sawQueueSummary: /Queued actions/i.test(modalBefore),
      sawActionCounters: /Wayfarer Actions\s+\d+\/\d+/.test(modalBefore) && /Enemy Actions\s+\d+\/\d+/.test(modalBefore),
      logTail: after && Array.isArray(after.log) ? after.log.slice(-8) : []
    };
  });

  if (!result || !result.ok) {
    throw new Error(`Campaign expedition smoke setup failed: ${JSON.stringify(result)}`);
  }
  if (result.partySize < 4) {
    throw new Error(`Campaign expedition did not include full party: ${JSON.stringify(result)}`);
  }
  if (!result.sawResolveLabel || !result.sawQueueSummary) {
    throw new Error(`Campaign expedition UI did not expose round planning controls: ${JSON.stringify(result)}`);
  }
  if (!result.sawActionCounters) {
    throw new Error(`Campaign expedition UI did not show action counters: ${JSON.stringify(result)}`);
  }
  if (result.queuedBeforeResolve < result.partySize) {
    throw new Error(`Did not queue full campaign party before resolve: ${JSON.stringify(result)}`);
  }
  if (result.queuedAfterResolve !== 0) {
    throw new Error(`Queued actions not cleared after campaign resolve: ${JSON.stringify(result)}`);
  }
  if (result.roundAfterResolve < 2 && result.livingEnemies > 0) {
    throw new Error(`Campaign expedition round did not advance through enemy response: ${JSON.stringify(result)}`);
  }

  process.stdout.write(`Campaign Mini Games expedition smoke passed: ${JSON.stringify(result)}\n`);
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
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

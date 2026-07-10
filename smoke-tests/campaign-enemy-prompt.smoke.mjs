import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 30000;
const STEP_TIMEOUT_MS = 30000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPortOpen(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferredPort = 3000) {
  if (await checkPortOpen(preferredPort)) return preferredPort;
  for (let i = 0; i < 25; i += 1) {
    const candidate = 4300 + Math.floor(Math.random() * 1400);
    if (await checkPortOpen(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for campaign enemy prompt smoke.");
}

function startServer(port) {
  const stamp = `${process.pid}-${Date.now()}`;
  const tempRoot = path.join(os.tmpdir(), `btl-smoke-campaign-enemy-prompt-${stamp}`);
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

async function syncCharacter(page, name) {
  await page.evaluate(async (characterName) => {
    const s = window.S = window.S || {};
    s.name = characterName;
    s.stats = {
      body: 8,
      strike: 8,
      shoot: 8,
      mind: 8,
      control: 8,
      lead: 8,
      spirit: 8,
      defend: 8
    };
    s.combat = s.combat || {};
    if (window.campaignSystem && typeof window.campaignSystem.syncCharacterToCampaign === "function") {
      try {
        await window.campaignSystem.syncCharacterToCampaign(true);
      } catch (_err) {}
    }
  }, name);
}

async function waitForEnemyPrompt(page) {
  await page.waitForFunction(
    () => {
      const req = window.campaignSystem && typeof window.campaignSystem.getEnemyActionRequest === "function"
        ? window.campaignSystem.getEnemyActionRequest()
        : null;
      return !!(req && req.status === "pending" && req.targetName === "Aarav");
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
}

async function waitForCombatActive(page) {
  await page.waitForFunction(
    () => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      return !!combat.active;
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
}

async function waitForResolvedEnemyRequest(gmPage, playerPage) {
  let lastPlayer = null;
  let lastGm = null;
  let retriedLocalAction = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    lastPlayer = await playerPage.evaluate(() => (
      window.campaignSystem && typeof window.campaignSystem.getEnemyActionRequest === "function"
        ? window.campaignSystem.getEnemyActionRequest()
        : null
    ));
    lastGm = await gmPage.evaluate(() => (
      window.campaignSystem && typeof window.campaignSystem.getEnemyActionRequest === "function"
        ? window.campaignSystem.getEnemyActionRequest()
        : null
    ));
    if (
      lastPlayer && lastGm &&
      lastPlayer.status === "resolved" && lastPlayer.resolvedByToken &&
      lastGm.status === "resolved" && lastGm.resolvedByToken
    ) {
      return;
    }
    const playerResolved = !!(lastPlayer && lastPlayer.status === "resolved" && lastPlayer.resolvedByToken);
    const gmResolved = !!(lastGm && lastGm.status === "resolved" && lastGm.resolvedByToken);
    const bothPending = !!(
      lastPlayer && lastGm
      && String(lastPlayer.status || "") === "pending"
      && String(lastGm.status || "") === "pending"
    );
    if (bothPending && !retriedLocalAction && attempt >= 2) {
      retriedLocalAction = true;
      await playerPage.evaluate(() => {
        if (typeof runCampaignPromptedEnemyAction !== "function") return false;
        try {
          return !!runCampaignPromptedEnemyAction();
        } catch (_err) {
          return false;
        }
      });
      await wait(450);
      continue;
    }
    if (gmResolved && !playerResolved) {
      await playerPage.evaluate(async () => {
        if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
          try { await window.campaignSystem.requestResync(); } catch (_err) {}
        }
      });
    } else if (bothPending && attempt >= 4) {
      await gmPage.evaluate(async () => {
        if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
          try { await window.campaignSystem.syncSharedSilent("enemy-prompt-resolve-rebroadcast"); } catch (_err) {}
        }
      });
      await playerPage.evaluate(async () => {
        if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
          try { await window.campaignSystem.requestResync(); } catch (_err) {}
        }
      });
    }
    await wait(gmResolved || playerResolved ? 450 : 350);
  }
  throw new Error(`Enemy prompt smoke timed out waiting for resolved shared request: player=${JSON.stringify(lastPlayer)} gm=${JSON.stringify(lastGm)}`);
}

async function waitForSharedEnemySeed(gmPage, playerPage) {
  let lastPlayer = null;
  let lastGm = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    lastPlayer = await playerPage.evaluate(() => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const scene = shared && shared.combatScene && typeof shared.combatScene === "object"
        ? shared.combatScene
        : null;
      const enemies = scene && Array.isArray(scene.enemies) ? scene.enemies : [];
      return {
        ready: enemies.some((enemy) => enemy && enemy.name === "Ash Raider"),
        enemyNames: enemies.map((enemy) => String(enemy && enemy.name || "")).filter(Boolean),
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0)
      };
    });
    if (lastPlayer && lastPlayer.ready) return;
    lastGm = await gmPage.evaluate(() => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const scene = shared && shared.combatScene && typeof shared.combatScene === "object"
        ? shared.combatScene
        : null;
      const enemies = scene && Array.isArray(scene.enemies) ? scene.enemies : [];
      return {
        ready: enemies.some((enemy) => enemy && enemy.name === "Ash Raider"),
        enemyNames: enemies.map((enemy) => String(enemy && enemy.name || "")).filter(Boolean),
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0)
      };
    });
    await playerPage.evaluate(async () => {
      if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
        try { await window.campaignSystem.requestResync(); } catch (_err) {}
      }
    });
    if (lastGm && lastGm.ready) {
      await gmPage.evaluate(async () => {
        if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
          try { await window.campaignSystem.syncSharedSilent("enemy-prompt-scene-seed"); } catch (_err) {}
        }
      });
    }
    await wait(600);
  }
  throw new Error(`Enemy prompt smoke timed out waiting for Ash Raider in shared combat scene: gm=${JSON.stringify(lastGm)} player=${JSON.stringify(lastPlayer)}`);
}

async function collectResolutionSummary(page) {
  return page.evaluate(() => ({
    request: window.campaignSystem && typeof window.campaignSystem.getEnemyActionRequest === "function"
      ? window.campaignSystem.getEnemyActionRequest()
      : null,
    result: String(document.getElementById("enemyActionResult")?.innerText || "").trim(),
    gate: String(document.getElementById("campaignCombatTurnGate")?.textContent || "").trim(),
    turnOrder: (() => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : {};
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      return Array.isArray(combat.turnOrder) ? combat.turnOrder.slice() : [];
    })()
  }));
}

async function runScenario(browser, baseUrl) {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gmPage = await gmContext.newPage();
  const playerPage = await playerContext.newPage();
  const pageErrors = [];

  gmPage.on("pageerror", (err) => pageErrors.push("gm: " + String(err && err.message ? err.message : err)));
  playerPage.on("pageerror", (err) => pageErrors.push("player: " + String(err && err.message ? err.message : err)));

  try {
    for (const page of [gmPage, playerPage]) {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForCampaignReady(page);
      await clearSession(page);
    }

    await gmPage.evaluate(() => {
      const el = document.getElementById("campaignNameInput");
      if (el) el.value = "Enemy Prompt GM";
    });
    await gmPage.evaluate(async () => {
      await window.campaignSystem.createCampaign();
    });

    const code = await gmPage.evaluate(() => window.campaignSystem.getState().code || "");
    if (!code) throw new Error("Enemy prompt smoke failed to create a campaign code.");

    await playerPage.evaluate(async (campaignCode) => {
      await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Aarav" });
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
        const roster = ((window.campaignSystem.getState().campaign || {}).roster || []);
        return roster.length >= 2;
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    await syncCharacter(gmPage, "Enemy Prompt GM");
    await syncCharacter(playerPage, "Aarav");

    await Promise.all([
      gmPage.evaluate(() => { if (window.switchTab) window.switchTab("combat"); }),
      playerPage.evaluate(() => { if (window.switchTab) window.switchTab("combat"); })
    ]);

    const setup = await gmPage.evaluate(() => {
      const roster = ((window.campaignSystem.getState().campaign || {}).roster || []);
      const gmMember = roster.find((entry) => entry && entry.role === "gm") || roster[0];
      const playerMember = roster.find((entry) => entry && entry.role !== "gm") || roster[roster.length - 1];

      const combat = {
        active: true,
        enemyDread: 8,
        spacing: "Close",
        round: 1,
        actionsLeft: 3,
        sceneOpener: {
          zoneTerrain: "crater-field",
          coverTier: "heavy",
          coverDesc: "Heavy Cover (+2 Defend)"
        }
      };
      const enemies = [
        { id: "prompt-e1", name: "Ash Raider", stress: 0, maxStress: 6, ally: false, conditions: [] }
      ];
      const combatMap = {
        units: [
          { id: 1, name: "Aarav", side: "ally", zone: "Close", isPlayer: true },
          { id: 2, name: "Ash Raider", side: "enemy", zone: "Close", fromTracker: true, trackerKey: "enemy:prompt-e1" }
        ],
        lastRelativeZone: "Close"
      };

      const liveState = window.S = window.S || {};
      liveState.combat = combat;
      liveState.enemies = enemies;
      liveState.combatMap = combatMap;
      if (typeof window.updateCombatUI === "function") {
        try { window.updateCombatUI(); } catch (_err) {}
      }
      if (typeof window.renderEnemies === "function") {
        try { window.renderEnemies(); } catch (_err) {}
      }
      if (typeof window.renderCombatMap === "function") {
        try { window.renderCombatMap(); } catch (_err) {}
      }

      return {
        playerToken: String(playerMember && playerMember.token || "player-token"),
        participants: [
          {
            token: String(gmMember && gmMember.token || "gm-token"),
            name: String(gmMember && gmMember.name || "GM"),
            role: "gm",
            character: { name: String(gmMember && gmMember.name || "GM"), stats: { valor: 10 } }
          },
          {
            token: String(playerMember && playerMember.token || "player-token"),
            name: String(playerMember && playerMember.name || "Aarav"),
            role: "player",
            character: { name: String(playerMember && playerMember.name || "Aarav"), stats: { valor: 8 } }
          }
        ],
        combatScene: {
          combat,
          enemies,
          combatMap,
          combatAugState: null,
          naval: null,
          caravan: null
        }
      };
    });

    const started = await gmPage.evaluate(async (payload) => {
      return await new Promise((resolve) => {
        window.campaignSystem.startCampaignCombat(payload.participants, (res) => resolve(res || { ok: false }), { skipReadyCheck: true });
      });
    }, setup);
    if (!started || !started.ok) {
      throw new Error(`Enemy prompt smoke failed to start combat: ${JSON.stringify(started)}`);
    }

    const seeded = await gmPage.evaluate(async (payload) => {
      return window.campaignSystem.syncSharedPatch({ combatScene: payload.combatScene }, "enemy-prompt-smoke-seed");
    }, setup);
    if (!seeded || !seeded.ok) {
      throw new Error(`Enemy prompt smoke failed to sync combat scene: ${JSON.stringify(seeded)}`);
    }

    await waitForCombatActive(gmPage);
    await waitForCombatActive(playerPage);

    await waitForSharedEnemySeed(gmPage, playerPage);

    const selectedActor = await gmPage.evaluate(async (playerToken) => {
      return await new Promise((resolve) => {
        window.campaignSystem.setCombatActor(playerToken, (res) => resolve(res || { ok: false }));
      });
    }, setup.playerToken);
    if (!selectedActor || !selectedActor.ok) {
      throw new Error(`Enemy prompt smoke failed to set the acting Wayfarer: ${JSON.stringify(selectedActor)}`);
    }
    await gmPage.evaluate(async () => {
      if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
        try { await window.campaignSystem.syncSharedSilent("enemy-prompt-actor-sync"); } catch (_err) {}
      }
    });

    await playerPage.waitForFunction(
      (playerToken) => {
        const shared = window.campaignSystem.getSharedState();
        const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
          ? shared.campaignCombat
          : {};
        return combat.phase === "wayfarer" && combat.activeToken === playerToken;
      },
      setup.playerToken,
      { timeout: STEP_TIMEOUT_MS }
    );

    const advancedToEnemy = await gmPage.evaluate(async () => {
      return await new Promise((resolve) => {
        window.campaignSystem.nextCombatActor((res) => resolve(res || { ok: false }));
      });
    });
    if (!advancedToEnemy || !advancedToEnemy.ok) {
      throw new Error(`Enemy prompt smoke failed to advance into enemy phase: ${JSON.stringify(advancedToEnemy)}`);
    }
    await gmPage.evaluate(async () => {
      if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
        try { await window.campaignSystem.syncSharedSilent("enemy-prompt-phase-sync"); } catch (_err) {}
      }
    });

    try {
      await playerPage.waitForFunction(
        () => {
          const shared = window.campaignSystem.getSharedState();
          const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
            ? shared.campaignCombat
            : {};
          return combat.phase === "enemy" && combat.activeToken === "enemy:phase";
        },
        null,
        { timeout: STEP_TIMEOUT_MS }
      );
    } catch (_err) {
      await gmPage.evaluate(async () => {
        if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
          try { await window.campaignSystem.syncSharedSilent("enemy-prompt-phase-resync"); } catch (_err2) {}
        }
      });
      await playerPage.evaluate(async () => {
        if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
          try { await window.campaignSystem.requestResync(); } catch (_err2) {}
        }
      });
      await playerPage.waitForFunction(
        () => {
          const shared = window.campaignSystem.getSharedState();
          const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
            ? shared.campaignCombat
            : {};
          return combat.phase === "enemy" && combat.activeToken === "enemy:phase";
        },
        null,
        { timeout: STEP_TIMEOUT_MS }
      );
    }

    const prompted = await gmPage.evaluate(async (playerToken) => {
      return await new Promise((resolve) => {
        window.campaignSystem.promptEnemyAction({
          mode: "single",
          enemyId: "prompt-e1",
          enemyName: "Ash Raider",
          targetToken: playerToken,
          targetName: "Aarav",
          rangeBand: "close",
          targetZoneLabel: "Close"
        }, (res) => resolve(res || { ok: false }));
      });
    }, setup.playerToken);
    if (!prompted || !prompted.ok) {
      throw new Error(`Enemy prompt smoke failed to create the enemy action request: ${JSON.stringify(prompted)}`);
    }
    await gmPage.evaluate(() => {
      if (typeof consumeEnemyActionBudget === "function") {
        try { consumeEnemyActionBudget("enemy prompt"); } catch (_err) {}
      }
      if (typeof renderCampaignInitiativePanel === "function") {
        try { renderCampaignInitiativePanel(); } catch (_err) {}
      }
    });

    await waitForEnemyPrompt(playerPage);
    await playerPage.waitForFunction(
      () => {
        const enemies = window.S && Array.isArray(window.S.enemies) ? window.S.enemies : [];
        const hasEnemy = enemies.some((enemy) => enemy && enemy.name === "Ash Raider");
        const activeEnemy = typeof getPrimaryCombatEnemy === "function" ? getPrimaryCombatEnemy() : null;
        return hasEnemy && !!(activeEnemy && activeEnemy.name);
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    const gmPendingSummary = await collectResolutionSummary(gmPage);
    const playerPendingSummary = await collectResolutionSummary(playerPage);
    if (gmPendingSummary.gate.indexOf("Wait for Aarav to resolve Enemy Action") < 0) {
      throw new Error(`Enemy prompt smoke did not surface the GM next-click guidance: ${JSON.stringify(gmPendingSummary)}`);
    }
    if (playerPendingSummary.gate.indexOf("Click Enemy Action now") < 0) {
      throw new Error(`Enemy prompt smoke did not surface the player next-click guidance: ${JSON.stringify(playerPendingSummary)}`);
    }

    const resolvedLocally = await playerPage.evaluate(() => {
      if (typeof runCampaignPromptedEnemyAction !== "function") {
        return { ok: false, error: "Missing runCampaignPromptedEnemyAction" };
      }
      return { ok: !!runCampaignPromptedEnemyAction() };
    });
    if (!resolvedLocally || !resolvedLocally.ok) {
      throw new Error(`Enemy prompt smoke failed to trigger player enemy action: ${JSON.stringify(resolvedLocally)}`);
    }

    await waitForResolvedEnemyRequest(gmPage, playerPage);

    const gmSummary = await collectResolutionSummary(gmPage);
    const playerSummary = await collectResolutionSummary(playerPage);

    const resolvedSummary = String(
      playerSummary.result
      || (playerSummary.request && playerSummary.request.resolutionSummary)
      || ""
    ).trim();
    if (!resolvedSummary) {
      throw new Error(`Enemy prompt smoke did not produce a combat result for the player: ${JSON.stringify(playerSummary)}`);
    }
    if (!gmSummary.request || gmSummary.request.resolvedByToken !== setup.playerToken) {
      throw new Error(`Enemy prompt smoke did not persist the resolved player token: ${JSON.stringify(gmSummary)}`);
    }
    if (gmSummary.turnOrder.length !== 2 || gmSummary.turnOrder[0] !== setup.playerToken || gmSummary.turnOrder[1] !== "enemy:phase") {
      throw new Error(`Enemy prompt smoke saw an unexpected campaign turn order: ${JSON.stringify(gmSummary.turnOrder)}`);
    }
    if (pageErrors.length) {
      throw new Error(`Enemy prompt smoke saw page errors: ${pageErrors.join(" | ")}`);
    }

    process.stdout.write(
      "Campaign enemy prompt smoke passed: "
      + JSON.stringify({
        code,
        gmSummary,
        playerSummary
      })
      + "\n"
    );
  } finally {
    await gmContext.close();
    await playerContext.close();
  }
}

async function main() {
  const port = await pickAvailablePort(Number(process.env.PORT || 3000));
  const baseUrl = process.env.SMOKE_URL || `http://127.0.0.1:${port}`;
  const server = startServer(port);
  let browser;
  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await launchChromium();
    await runScenario(browser, baseUrl);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

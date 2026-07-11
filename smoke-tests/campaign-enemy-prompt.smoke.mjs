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

async function hydrateEnemyPromptSeat(page, payload) {
  await page.evaluate((details) => {
    const playerToken = String(details && details.playerToken || "player-token");
    const playerName = String(details && details.playerName || "Aarav");
    const liveState = window.S = window.S || {};
    liveState.combat = {
      active: true,
      enemyDread: 8,
      spacing: "Close",
      round: 1,
      actionsLeft: 3,
      customEnemyActionSource: "smoke",
      customEnemyActionCadence: 1,
      customEnemyActionEvents: [
        {
          name: "Smoke Arc Lash",
          desc: "Stable smoke-test enemy prompt event.",
          kind: "directStress",
          scale: 1,
          element: "shock",
          ranges: ["close"]
        }
      ],
      sceneOpener: {
        zoneTerrain: "crater-field",
        coverTier: "heavy",
        coverDesc: "Heavy Cover (+2 Defend)"
      }
    };
    liveState.enemies = [
      { id: "prompt-e1", name: "Ash Raider", stress: 0, maxStress: 6, ally: false, conditions: [] }
    ];
    liveState.combatMap = {
      units: [
        { id: 1, name: "Aarav", side: "ally", zone: "Close", isPlayer: true },
        { id: 2, name: "Ash Raider", side: "enemy", zone: "Close", fromTracker: true, trackerKey: "enemy:prompt-e1" }
      ],
      lastRelativeZone: "Close"
    };
    if (typeof window.openCombatSceneEditor === "function") {
      try {
        window.openCombatSceneEditor({
          id: "enemy-prompt-scene",
          name: "Enemy Prompt Scene",
          tokens: [
            { id: "prompt-player", name: "Aarav", faction: "player", hp: 10, maxHp: 10, q: 0, r: 0, size: 1, isPlayer: true },
            { id: "prompt-enemy-a", name: "Ash Raider", faction: "monster", hp: 6, maxHp: 6, q: 1, r: 0, size: 1 }
          ]
        });
      } catch (_sceneErr) {}
    }
    const sceneEditor = liveState.combat && liveState.combat.sceneEditor && typeof liveState.combat.sceneEditor === "object"
      ? (JSON.parse(JSON.stringify(liveState.combat.sceneEditor)) || null)
      : null;
    const combatState = {
      active: true,
      enemyDread: 8,
      round: 1,
      turnOrder: [playerToken, "enemy:phase"],
      currentActorIndex: 1,
      participants: [
        {
          token: playerToken,
          name: playerName,
          role: "player",
          isEnemy: false,
          isDead: false,
          hasActed: true
        },
        {
          token: "enemy:phase",
          name: "Enemy Turn",
          role: "enemy",
          isEnemy: true,
          isDead: false,
          hasActed: false
        }
      ],
      phase: "enemy",
      activeToken: "enemy:phase",
      pendingWayfarers: [],
      actedWayfarers: [playerToken],
      enemyActionRequest: null,
      startedAt: Date.now(),
      startedBy: "Enemy Prompt GM",
      vttSession: null
    };
    const sharedRoot = (() => {
      if (window.campaignSystem && typeof window.campaignSystem.getSharedState === "function") {
        try {
          const liveShared = window.campaignSystem.getSharedState();
          if (liveShared && typeof liveShared === "object") return liveShared;
        } catch (_err) {}
      }
      const snapshot = window.campaignSystem && typeof window.campaignSystem.getState === "function"
        ? window.campaignSystem.getState()
        : null;
      if (!snapshot) return null;
      snapshot.campaign = snapshot.campaign && typeof snapshot.campaign === "object" ? snapshot.campaign : {};
      snapshot.campaign.shared = snapshot.campaign.shared && typeof snapshot.campaign.shared === "object"
        ? snapshot.campaign.shared
        : { state: {}, tmw: 0, stateVersion: 0 };
      snapshot.campaign.shared.state = snapshot.campaign.shared.state && typeof snapshot.campaign.shared.state === "object"
        ? snapshot.campaign.shared.state
        : {};
      return snapshot.campaign.shared.state;
    })();
    if (sharedRoot) {
      sharedRoot.combatScene = {
        combat: JSON.parse(JSON.stringify(liveState.combat || {})) || {},
        enemies: JSON.parse(JSON.stringify(liveState.enemies || [])) || [],
        combatMap: JSON.parse(JSON.stringify(liveState.combatMap || {})) || {},
        combatAugState: null,
        sceneEditor,
        naval: null,
        caravan: null
      };
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
    if (typeof window.renderCampaignInitiativePanel === "function") {
      try { window.renderCampaignInitiativePanel(); } catch (_err) {}
    }
    if (typeof window.renderQP === "function") {
      try { window.renderQP("combat"); } catch (_err) {}
    }
  }, payload);
}

async function waitForEnemyPrompt(page) {
  let requestedResync = false;
  let lastReq = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    lastReq = await page.evaluate(() => (
      window.campaignSystem && typeof window.campaignSystem.getEnemyActionRequest === "function"
        ? window.campaignSystem.getEnemyActionRequest()
        : null
    ));
    if (lastReq && lastReq.status === "pending" && lastReq.targetName === "Aarav") return;
    if (!requestedResync && attempt >= 3) {
      requestedResync = true;
      await page.evaluate(async () => {
        if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
          try { await window.campaignSystem.requestResync(); } catch (_err) {}
        }
      });
    }
    await wait(400);
  }
  throw new Error(`Enemy prompt smoke timed out waiting for the player prompt: ${JSON.stringify(lastReq)}`);
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

async function callCampaignAction(page, actionName, arg, options) {
  return page.evaluate(async (payload) => {
    const fn = window.campaignSystem && window.campaignSystem[payload.actionName];
    if (typeof fn !== "function") {
      return { ok: false, error: `Missing action ${payload.actionName}` };
    }
    return new Promise((resolve) => {
      if (payload.hasArg) {
        fn(payload.arg, function (res) {
          resolve(res || { ok: false, error: "No callback result." });
        }, payload.options || undefined);
      } else {
        fn(function (res) {
          resolve(res || { ok: false, error: "No callback result." });
        });
      }
    });
  }, {
    actionName,
    hasArg: arg !== undefined,
    arg,
    options: options || undefined
  });
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
      await wait(250);
    } else if (bothPending && attempt >= 4) {
      await wait(250);
    }
    await wait(gmResolved || playerResolved ? 450 : 350);
  }
  const playerSummary = await collectResolutionSummary(playerPage);
  const gmSummary = await collectResolutionSummary(gmPage);
  throw new Error(
    `Enemy prompt smoke timed out waiting for resolved shared request: player=${JSON.stringify(lastPlayer)} gm=${JSON.stringify(lastGm)} `
    + `playerSummary=${JSON.stringify(playerSummary)} gmSummary=${JSON.stringify(gmSummary)}`
  );
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
      const liveState = (() => {
        try {
          return (typeof S !== "undefined" && S) ? S : (window.S || {});
        } catch (_err) {
          return window.S || {};
        }
      })();
      const localEnemies = Array.isArray(liveState && liveState.enemies) ? liveState.enemies : [];
      const localUnits = liveState && liveState.combatMap && Array.isArray(liveState.combatMap.units)
        ? liveState.combatMap.units
        : [];
      const enemyNames = enemies.map((enemy) => String(enemy && enemy.name || "")).filter(Boolean);
      const localEnemyNames = localEnemies.map((enemy) => String(enemy && enemy.name || "")).filter(Boolean);
      const localUnitNames = localUnits.map((unit) => String(unit && unit.name || "")).filter(Boolean);
      return {
        ready: enemyNames.includes("Ash Raider") || localEnemyNames.includes("Ash Raider") || localUnitNames.includes("Ash Raider"),
        enemyNames,
        localEnemyNames,
        localUnitNames,
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
      const liveState = (() => {
        try {
          return (typeof S !== "undefined" && S) ? S : (window.S || {});
        } catch (_err) {
          return window.S || {};
        }
      })();
      const localEnemies = Array.isArray(liveState && liveState.enemies) ? liveState.enemies : [];
      const localUnits = liveState && liveState.combatMap && Array.isArray(liveState.combatMap.units)
        ? liveState.combatMap.units
        : [];
      const enemyNames = enemies.map((enemy) => String(enemy && enemy.name || "")).filter(Boolean);
      const localEnemyNames = localEnemies.map((enemy) => String(enemy && enemy.name || "")).filter(Boolean);
      const localUnitNames = localUnits.map((unit) => String(unit && unit.name || "")).filter(Boolean);
      return {
        ready: enemyNames.includes("Ash Raider") || localEnemyNames.includes("Ash Raider") || localUnitNames.includes("Ash Raider"),
        enemyNames,
        localEnemyNames,
        localUnitNames,
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0)
      };
    });
    await wait(600);
  }
  throw new Error(`Enemy prompt smoke timed out waiting for Ash Raider in shared combat scene: gm=${JSON.stringify(lastGm)} player=${JSON.stringify(lastPlayer)}`);
}

async function waitForPlayerActorPrompt(gmPage, playerPage, playerToken) {
  let lastPlayer = null;
  let lastGm = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    lastPlayer = await playerPage.evaluate((token) => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      return {
        phase: String(combat.phase || ""),
        activeToken: String(combat.activeToken || ""),
        pendingWayfarers: Array.isArray(combat.pendingWayfarers)
          ? combat.pendingWayfarers.map((entry) => String(entry || ""))
          : [],
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0),
        ready: String(combat.phase || "") === "wayfarer" && String(combat.activeToken || "") === String(token || "")
      };
    }, playerToken);
    if (lastPlayer && lastPlayer.ready) return;
    lastGm = await gmPage.evaluate((token) => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      return {
        phase: String(combat.phase || ""),
        activeToken: String(combat.activeToken || ""),
        pendingWayfarers: Array.isArray(combat.pendingWayfarers)
          ? combat.pendingWayfarers.map((entry) => String(entry || ""))
          : [],
        expectedToken: String(token || ""),
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0)
      };
    }, playerToken);
    await wait(450);
  }
  throw new Error(`Enemy prompt smoke timed out waiting for player actor prompt: gm=${JSON.stringify(lastGm)} player=${JSON.stringify(lastPlayer)}`);
}

async function waitForEnemyPhase(gmPage, playerPage) {
  let lastPlayer = null;
  let lastGm = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    lastPlayer = await playerPage.evaluate(() => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      return {
        phase: String(combat.phase || ""),
        activeToken: String(combat.activeToken || ""),
        pendingWayfarers: Array.isArray(combat.pendingWayfarers)
          ? combat.pendingWayfarers.map((entry) => String(entry || ""))
          : [],
        actedWayfarers: Array.isArray(combat.actedWayfarers)
          ? combat.actedWayfarers.map((entry) => String(entry || ""))
          : [],
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0),
        ready: String(combat.phase || "") === "enemy" && String(combat.activeToken || "") === "enemy:phase"
      };
    });
    if (lastPlayer && lastPlayer.ready) return;
    lastGm = await gmPage.evaluate(() => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      return {
        phase: String(combat.phase || ""),
        activeToken: String(combat.activeToken || ""),
        pendingWayfarers: Array.isArray(combat.pendingWayfarers)
          ? combat.pendingWayfarers.map((entry) => String(entry || ""))
          : [],
        actedWayfarers: Array.isArray(combat.actedWayfarers)
          ? combat.actedWayfarers.map((entry) => String(entry || ""))
          : [],
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0)
      };
    });
    await wait(450);
  }
  throw new Error(`Enemy prompt smoke timed out waiting for enemy phase: gm=${JSON.stringify(lastGm)} player=${JSON.stringify(lastPlayer)}`);
}

async function waitForAuthoritativeEnemySeed(gmPage, playerPage, playerToken) {
  let lastPlayer = null;
  let lastGm = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    lastPlayer = await playerPage.evaluate((token) => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      const scene = shared && shared.combatScene && typeof shared.combatScene === "object"
        ? shared.combatScene
        : {};
      const enemies = Array.isArray(scene.enemies) ? scene.enemies : [];
      const participants = Array.isArray(combat.participants) ? combat.participants : [];
      return {
        active: !!combat.active,
        phase: String(combat.phase || ""),
        activeToken: String(combat.activeToken || ""),
        enemyNames: enemies.map((enemy) => String(enemy && enemy.name || "")).filter(Boolean),
        participantTokens: participants.map((row) => String(row && row.token || "")).filter(Boolean),
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0),
        ready: (
          !!combat.active
          && String(combat.phase || "") === "enemy"
          && String(combat.activeToken || "") === "enemy:phase"
          && enemies.some((enemy) => enemy && enemy.name === "Ash Raider")
          && participants.some((row) => row && String(row.token || "") === String(token || ""))
        )
      };
    }, playerToken);
    if (lastPlayer && lastPlayer.ready) return;
    lastGm = await gmPage.evaluate((token) => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      const scene = shared && shared.combatScene && typeof shared.combatScene === "object"
        ? shared.combatScene
        : {};
      const enemies = Array.isArray(scene.enemies) ? scene.enemies : [];
      const participants = Array.isArray(combat.participants) ? combat.participants : [];
      return {
        active: !!combat.active,
        phase: String(combat.phase || ""),
        activeToken: String(combat.activeToken || ""),
        enemyNames: enemies.map((enemy) => String(enemy && enemy.name || "")).filter(Boolean),
        participantTokens: participants.map((row) => String(row && row.token || "")).filter(Boolean),
        stateVersion: Number((window.campaignSystem.getState().campaign || {}).shared?.stateVersion || 0),
        expectedToken: String(token || "")
      };
    }, playerToken);
    await wait(500);
  }
  throw new Error(`Enemy prompt smoke timed out waiting for authoritative enemy seed: gm=${JSON.stringify(lastGm)} player=${JSON.stringify(lastPlayer)}`);
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
        customEnemyActionSource: "smoke",
        customEnemyActionCadence: 1,
        customEnemyActionEvents: [
          {
            name: "Smoke Arc Lash",
            desc: "Stable smoke-test enemy prompt event.",
            kind: "directStress",
            scale: 1,
            element: "shock",
            ranges: ["close"]
          }
        ],
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
      if (typeof window.openCombatSceneEditor === "function") {
        try {
          window.openCombatSceneEditor({
            id: "enemy-prompt-scene",
            name: "Enemy Prompt Scene",
            tokens: [
              { id: "prompt-player", name: "Aarav", faction: "player", hp: 10, maxHp: 10, q: 0, r: 0, size: 1, isPlayer: true },
              { id: "prompt-enemy-a", name: "Ash Raider", faction: "monster", hp: 6, maxHp: 6, q: 1, r: 0, size: 1 }
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

      const sceneEditor = liveState.combat && liveState.combat.sceneEditor && typeof liveState.combat.sceneEditor === "object"
        ? (JSON.parse(JSON.stringify(liveState.combat.sceneEditor)) || null)
        : null;
      return {
        playerToken: String(playerMember && playerMember.token || "player-token"),
        playerName: String(playerMember && playerMember.name || "Aarav"),
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
          sceneEditor,
          naval: null,
          caravan: null
        }
      };
    });

    const snapshot = {
      version: 1,
      code,
      archived: false,
      shared: {
        tmw: 0,
        stateVersion: 0,
        state: {
          campaignCombat: {
            active: true,
            enemyDread: 8,
            round: 1,
            turnOrder: [setup.playerToken, "enemy:phase"],
            currentActorIndex: 1,
            participants: [
              {
                token: setup.playerToken,
                name: setup.playerName,
                role: "player",
                isEnemy: false,
                isDead: false,
                hasActed: true
              },
              {
                token: "enemy:phase",
                name: "Enemy Turn",
                role: "enemy",
                isEnemy: true,
                isDead: false,
                hasActed: false
              }
            ],
            phase: "enemy",
            activeToken: "enemy:phase",
            pendingWayfarers: [],
            actedWayfarers: [setup.playerToken],
            enemyActionRequest: null,
            startedAt: Date.now(),
            startedBy: "Enemy Prompt GM",
            vttSession: null
          },
          combatScene: setup.combatScene
        }
      },
      participants: setup.participants.map((participant) => ({
        token: participant.token,
        name: participant.name,
        role: participant.role,
        lastSeenAt: Date.now(),
        character: participant.character || null
      })),
      privateNotes: [],
      activeRollRequest: null,
      log: []
    };
    const imported = await gmPage.evaluate(async (snapshotJson) => {
      try {
        let input = document.getElementById("campaignImportSnapshotInput");
        if (!input) {
          input = document.createElement("textarea");
          input.id = "campaignImportSnapshotInput";
          input.style.display = "none";
          document.body.appendChild(input);
        }
        input.value = snapshotJson;
        await window.campaignSystem.importSnapshotFromModal();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) };
      }
    }, JSON.stringify(snapshot));
    if (!imported || !imported.ok) {
      throw new Error(`Enemy prompt smoke failed to import the authoritative combat snapshot: ${JSON.stringify(imported)}`);
    }
    await waitForAuthoritativeEnemySeed(gmPage, playerPage, setup.playerToken);
    const gmPrimedState = await gmPage.evaluate(() => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
        ? shared.campaignCombat
        : {};
      return {
        active: !!combat.active,
        phase: String(combat.phase || ""),
        activeToken: String(combat.activeToken || ""),
        participantTokens: Array.isArray(combat.participants)
        ? combat.participants.map((row) => String(row && row.token || "")).filter(Boolean)
          : []
      };
    });
    if (!(gmPrimedState.active && gmPrimedState.phase === "enemy" && gmPrimedState.activeToken === "enemy:phase" && gmPrimedState.participantTokens.indexOf(setup.playerToken) >= 0)) {
      throw new Error(`Enemy prompt smoke GM combat state is not ready for prompting: ${JSON.stringify(gmPrimedState)}`);
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
    const gmPendingSummary = await collectResolutionSummary(gmPage);
    const playerPendingSummary = await collectResolutionSummary(playerPage);
    if (gmPendingSummary.gate.indexOf("Wait for Aarav to resolve Enemy Action") < 0) {
      throw new Error(`Enemy prompt smoke did not surface the GM next-click guidance: ${JSON.stringify(gmPendingSummary)}`);
    }
    if (playerPendingSummary.gate.indexOf("Click Enemy Action now") < 0) {
      throw new Error(`Enemy prompt smoke did not surface the player next-click guidance: ${JSON.stringify(playerPendingSummary)}`);
    }

    const resolvedLocally = await playerPage.evaluate(async () => {
      const req = window.campaignSystem && typeof window.campaignSystem.getEnemyActionRequest === "function"
        ? window.campaignSystem.getEnemyActionRequest()
        : null;
      if (!req || !req.id) {
        return { ok: false, error: "Missing pending enemy action request" };
      }
      return await new Promise((resolve) => {
        window.campaignSystem.resolveEnemyActionRequest({
          id: String(req.id || ""),
          resolutionSummary: "Smoke direct resolve"
        }, (res) => resolve(res || { ok: false, error: "No callback result." }));
      });
    });
    if (!resolvedLocally || !resolvedLocally.ok) {
      throw new Error(`Enemy prompt smoke failed to resolve the player enemy action: ${JSON.stringify(resolvedLocally)}`);
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

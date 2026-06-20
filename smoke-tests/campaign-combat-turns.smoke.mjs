import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 16000;

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

async function collectTurnSummary(page) {
  return page.evaluate(() => {
    const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
      ? (window.campaignSystem.getSharedState() || {})
      : {};
    const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
      ? shared.campaignCombat
      : {};
    const turnOrder = Array.isArray(combat.turnOrder) ? combat.turnOrder.slice() : [];
    const participants = Array.isArray(combat.participants) ? combat.participants : [];
    return {
      active: !!combat.active,
      round: Number(combat.round || 0),
      phase: String(combat.phase || "wayfarer"),
      currentActorIndex: Number.isFinite(Number(combat.currentActorIndex)) ? Number(combat.currentActorIndex) : -1,
      activeToken: String(combat.activeToken || ""),
      pendingWayfarers: Array.isArray(combat.pendingWayfarers) ? combat.pendingWayfarers.map((entry) => String(entry || "")) : [],
      actedWayfarers: Array.isArray(combat.actedWayfarers) ? combat.actedWayfarers.map((entry) => String(entry || "")) : [],
      turnOrder,
      participantActed: participants.reduce((acc, row) => {
        if (!row || !row.token) return acc;
        acc[String(row.token)] = !!row.hasActed;
        return acc;
      }, {})
    };
  });
}

async function waitForTurnSummary(page, expected, label) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await collectTurnSummary(page);
    process.stdout.write(`[trace] ${label} attempt=${attempt + 1} before=${JSON.stringify(before)} expected=${JSON.stringify({ round: expected.round, phase: expected.phase, actor: expected.activeToken, idx: expected.currentActorIndex })}\n`);
    try {
      await page.waitForFunction(
        (target) => {
          const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
            ? (window.campaignSystem.getSharedState() || {})
            : {};
          const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
            ? shared.campaignCombat
            : {};
          const turnOrder = Array.isArray(combat.turnOrder) ? combat.turnOrder : [];
          const participants = Array.isArray(combat.participants) ? combat.participants : [];
          const actorIndex = Number.isFinite(Number(combat.currentActorIndex)) ? Number(combat.currentActorIndex) : -1;
          const activeToken = String(combat.activeToken || "");
          const phase = String(combat.phase || "wayfarer");
          const pendingWayfarers = Array.isArray(combat.pendingWayfarers) ? combat.pendingWayfarers.map((entry) => String(entry || "")) : [];
          const actedWayfarers = Array.isArray(combat.actedWayfarers) ? combat.actedWayfarers.map((entry) => String(entry || "")) : [];
          if (!!combat.active !== !!target.active) return false;
          if (Number(combat.round || 0) !== Number(target.round || 0)) return false;
          if (phase !== String(target.phase || "wayfarer")) return false;
          if (actorIndex !== Number(target.currentActorIndex || 0)) return false;
          if (activeToken !== String(target.activeToken || "")) return false;
          if (target.turnOrder && JSON.stringify(turnOrder) !== JSON.stringify(target.turnOrder)) return false;
          if (target.pendingWayfarers && JSON.stringify(pendingWayfarers) !== JSON.stringify(target.pendingWayfarers)) return false;
          if (target.actedWayfarers && JSON.stringify(actedWayfarers) !== JSON.stringify(target.actedWayfarers)) return false;
          if (target.participantActed) {
            for (const key of Object.keys(target.participantActed)) {
              const row = participants.find((item) => item && String(item.token || "") === String(key));
              if (!!(row && row.hasActed) !== !!target.participantActed[key]) return false;
            }
          }
          return true;
        },
        expected,
        { timeout: STEP_TIMEOUT_MS }
      );
      lastErr = null;
      const after = await collectTurnSummary(page);
      process.stdout.write(`[trace] ${label} attempt=${attempt + 1} matched=${JSON.stringify(after)}\n`);
      break;
    } catch (err) {
      lastErr = err;
      const miss = await collectTurnSummary(page);
      process.stdout.write(`[trace] ${label} attempt=${attempt + 1} timeoutSnapshot=${JSON.stringify(miss)}\n`);
      await page.evaluate(async () => {
        try {
          if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
            await window.campaignSystem.syncSharedSilent();
          }
        } catch (_err) {}
      });
      const postSync = await collectTurnSummary(page);
      process.stdout.write(`[trace] ${label} attempt=${attempt + 1} postSync=${JSON.stringify(postSync)}\n`);
      await wait(200 * (attempt + 1));
    }
  }
  if (lastErr) throw lastErr;

  const summary = await collectTurnSummary(page);
  if (
    summary.active !== expected.active ||
    summary.round !== expected.round ||
    summary.phase !== expected.phase ||
    summary.currentActorIndex !== expected.currentActorIndex ||
    summary.activeToken !== expected.activeToken ||
    JSON.stringify(summary.pendingWayfarers) !== JSON.stringify(expected.pendingWayfarers) ||
    JSON.stringify(summary.actedWayfarers) !== JSON.stringify(expected.actedWayfarers) ||
    JSON.stringify(summary.turnOrder) !== JSON.stringify(expected.turnOrder)
  ) {
    throw new Error(`${label} mismatch: expected=${JSON.stringify(expected)} actual=${JSON.stringify(summary)}`);
  }
}

async function callCampaignAction(page, actionName, arg) {
  return page.evaluate(async (payload) => {
    const fn = window.campaignSystem && window.campaignSystem[payload.actionName];
    if (typeof fn !== "function") {
      return { ok: false, error: `Missing action ${payload.actionName}` };
    }
    return new Promise((resolve) => {
      if (payload.hasArg) {
        fn(payload.arg, function (res) { resolve(res || { ok: false, error: "No callback result." }); }, payload.options || undefined);
      } else {
        fn(function (res) { resolve(res || { ok: false, error: "No callback result." }); });
      }
    });
  }, {
    actionName,
    hasArg: arg !== undefined,
    arg,
    options: actionName === "startCampaignCombat" ? { skipReadyCheck: true } : undefined
  });
}

async function runScenario(browser) {
  const gmPage = await browser.newPage();
  const playerPage = await browser.newPage();

  for (const page of [gmPage, playerPage]) {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForCampaignReady(page);
    await clearSession(page);
  }

  await gmPage.evaluate(() => {
    const el = document.getElementById("campaignNameInput");
    if (el) el.value = "Turn Smoke GM";
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
  if (!code) throw new Error("Combat turn smoke failed: no campaign code created.");

  await playerPage.evaluate(async (campaignCode) => {
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Turn Smoke Player" });
  }, code);

  await playerPage.waitForFunction(
    (campaignCode) => {
      const st = window.campaignSystem.getState();
      return !!(st && st.code === campaignCode && st.role === "player");
    },
    code,
    { timeout: STEP_TIMEOUT_MS }
  );

  // Wait until GM sees at least 2 members (self + player) in roster
  await gmPage.waitForFunction(
    () => {
      const st = window.campaignSystem.getState();
      const members = (st && st.campaign && (st.campaign.roster || st.campaign.members)) || [];
      return members.length >= 2;
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const combatSetup = await gmPage.evaluate(() => {
    const st = window.campaignSystem.getState();
    const members = (st && st.campaign && (st.campaign.roster || st.campaign.members)) || [];
    if (!members.length) {
      return { ok: false, error: `Missing campaign participants. state keys=${Object.keys((st && st.campaign) || {}).join(",")}` };
    }
    const gmMember = members.find((member) => member && member.role === "gm") || members[0];
    const playerMember = members.find((member) => member && member.role !== "gm") || members[members.length - 1];
    window.S = window.S || {};
    window.S.enemies = [
      { id: "turn-smoke-e1", name: "Clockwork Hunter", ally: false, stress: 0, maxStress: 8, conditions: [] }
    ];
    return {
      ok: true,
      participants: [
        {
          token: String(gmMember.token || "gm-token"),
          name: String(gmMember.name || "GM"),
          role: "gm",
          character: { name: String(gmMember.name || "GM"), stats: { valor: 10 } }
        },
        {
          token: String(playerMember.token || "player-token"),
          name: String(playerMember.name || "Player"),
          role: "player",
          character: { name: String(playerMember.name || "Player"), stats: { valor: 6 } }
        }
      ],
      expected: {
        gmToken: String(gmMember.token || "gm-token"),
        playerToken: String(playerMember.token || "player-token"),
        enemyTurn: "enemy:phase"
      }
    };
  });

  if (!combatSetup || !combatSetup.ok) {
    throw new Error(`Combat turn smoke setup failed: ${JSON.stringify(combatSetup)}`);
  }

  const started = await gmPage.evaluate(async (payload) => {
    return new Promise((resolve) => {
      window.campaignSystem.startCampaignCombat(payload.participants, function (res) {
        resolve(res || { ok: false, error: "No callback result." });
      }, { skipReadyCheck: true });
    });
  }, combatSetup);

  if (!started || !started.ok) {
    throw new Error(`Combat turn smoke failed to start combat: ${JSON.stringify(started)}`);
  }

  // In flaky sync windows, re-issue the start once if combat is still inactive.
  const bootstrapState = await collectTurnSummary(gmPage);
  if (!bootstrapState.active) {
    const retryStart = await gmPage.evaluate(async (payload) => {
      return new Promise((resolve) => {
        window.campaignSystem.startCampaignCombat(payload.participants, function (res) {
          resolve(res || { ok: false, error: "No callback result." });
        }, { skipReadyCheck: true });
      });
    }, combatSetup);
    if (!retryStart || !retryStart.ok) {
      throw new Error(`Combat turn smoke retry failed: ${JSON.stringify(retryStart)}`);
    }
  }

  // Force an explicit sync from GM after combat starts and await its completion
  await gmPage.evaluate(async () => {
    if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
      await window.campaignSystem.syncSharedSilent();
    }
  });
  await wait(600);

  // Diagnostic: what does GM and player see?
  const gmStateBefore = await collectTurnSummary(gmPage);
  const playerStateBefore = await collectTurnSummary(playerPage);
  if (!gmStateBefore.active) {
    throw new Error(`Combat turn smoke: GM does not have active combat after start: ${JSON.stringify(gmStateBefore)}`);
  }
  if (!playerStateBefore.active) {
    throw new Error(`Combat turn smoke: Player does not have active combat after sync: ${JSON.stringify(playerStateBefore)}`);
  }

  const turnOrder = [
    combatSetup.expected.playerToken,
    combatSetup.expected.enemyTurn
  ];

  await waitForTurnSummary(playerPage, {
    active: true,
    round: 1,
    phase: "wayfarer",
    currentActorIndex: -1,
    activeToken: "",
    pendingWayfarers: [combatSetup.expected.playerToken],
    actedWayfarers: [],
    turnOrder,
    participantActed: {
      [combatSetup.expected.playerToken]: false,
      [combatSetup.expected.enemyTurn]: false
    }
  }, "Combat start state");

  for (const step of [
    {
      actionName: "setCombatActor",
      arg: combatSetup.expected.playerToken,
      expected: {
        active: true,
        round: 1,
        phase: "wayfarer",
        currentActorIndex: 0,
        activeToken: combatSetup.expected.playerToken,
        pendingWayfarers: [combatSetup.expected.playerToken],
        actedWayfarers: [],
        turnOrder,
        participantActed: {
          [combatSetup.expected.playerToken]: false,
          [combatSetup.expected.enemyTurn]: false
        }
      }
    },
    {
      actionName: "nextCombatActor",
      expected: {
        active: true,
        round: 1,
        currentActorIndex: 1,
        phase: "enemy",
        activeToken: combatSetup.expected.enemyTurn,
        pendingWayfarers: [],
        actedWayfarers: [combatSetup.expected.playerToken],
        turnOrder,
        participantActed: {
          [combatSetup.expected.playerToken]: true,
          [combatSetup.expected.enemyTurn]: false
        }
      }
    },
    {
      actionName: "nextCombatActor",
      expected: {
        active: true,
        round: 2,
        phase: "wayfarer",
        currentActorIndex: -1,
        activeToken: "",
        pendingWayfarers: [combatSetup.expected.playerToken],
        actedWayfarers: [],
        turnOrder,
        participantActed: {
          [combatSetup.expected.playerToken]: false,
          [combatSetup.expected.enemyTurn]: false
        }
      }
    }
  ]) {
    const advanced = await callCampaignAction(gmPage, step.actionName, step.arg);
    if (!advanced || !advanced.ok) {
      throw new Error(`Combat turn smoke failed for ${step.actionName}: ${JSON.stringify(advanced)}`);
    }
    await waitForTurnSummary(playerPage, step.expected, "Combat turn progression");
  }

  const gmSummary = await collectTurnSummary(gmPage);
  const playerSummary = await collectTurnSummary(playerPage);
  process.stdout.write(`Combat turn smoke passed: code=${code}, gm=${JSON.stringify(gmSummary)}, player=${JSON.stringify(playerSummary)}\n`);

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

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
      // retry
    }
    await wait(300);
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
}

async function runScenario(browser) {
  const gmPage = await browser.newPage();
  const p1Page = await browser.newPage();

  for (const page of [gmPage, p1Page]) {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForCampaignReady(page);
    await clearSession(page);
  }

  await gmPage.evaluate(() => {
    const el = document.getElementById("campaignNameInput");
    if (el) el.value = "Guild Sync GM";
  });
  await gmPage.evaluate(async () => {
    await window.campaignSystem.createCampaign();
  });

  const code = await gmPage.evaluate(() => {
    const st = window.campaignSystem.getState();
    return st && st.code ? st.code : "";
  });
  if (!code) throw new Error("Failed to create campaign code.");

  await p1Page.evaluate(async (campaignCode) => {
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Guild Sync P1" });
  }, code);

  await p1Page.waitForFunction(
    (campaignCode) => {
      const st = window.campaignSystem.getState();
      return !!(st && st.code === campaignCode && st.role === "player");
    },
    code,
    { timeout: STEP_TIMEOUT_MS }
  );

  const gmRun = await gmPage.evaluate(async () => {
    function resolveState() {
      try {
        return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
      } catch (_err) {
        return window.S || null;
      }
    }

    const fs = window.factionSystem;
    const state = resolveState();
    if (!fs || !state) return { ok: false, error: "Missing factionSystem or state." };

    const factionId = "military";
    fs.joinGuild(factionId);
    const gState = state.factionNarrative && state.factionNarrative.guildCampaigns
      ? state.factionNarrative.guildCampaigns[factionId]
      : null;
    if (!gState) return { ok: false, error: "Guild state missing." };

    gState.currentArcStage = 0;
    gState.activeCampaignMissionId = null;
    fs.startGuildCampaign(factionId);
    if (!gState.activeCampaignMissionId) return { ok: false, error: "No active guild campaign mission posted." };

    fs.refreshGuildContracts(factionId);
    const contracts = Array.isArray(gState.guildContracts) ? gState.guildContracts : [];
    if (!contracts.length) return { ok: false, error: "No guild contracts available." };

    fs.postGuildContract(factionId, contracts[0].id);
    if (!gState.activeContractMissionId) return { ok: false, error: "No active guild contract mission posted." };

    const sync = await window.campaignSystem.syncSharedSilent("guild-multiplayer-sync");
    if (!sync || !sync.ok) return { ok: false, error: (sync && sync.error) || "sync failed" };

    return {
      ok: true,
      campaignMissionId: Number(gState.activeCampaignMissionId || 0),
      contractMissionId: Number(gState.activeContractMissionId || 0)
    };
  });

  if (!gmRun || !gmRun.ok) {
    throw new Error(`GM setup failed: ${JSON.stringify(gmRun)}`);
  }

  await p1Page.waitForFunction(
    (ids) => {
      function resolveState() {
        try {
          return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
        } catch (_err) {
          return window.S || null;
        }
      }
      const s = resolveState();
      if (!s || !Array.isArray(s.activeMissions)) return false;
      const missionIds = s.activeMissions.map((m) => Number(m && m.id || 0));
      return missionIds.indexOf(Number(ids.campaignMissionId || 0)) >= 0 && missionIds.indexOf(Number(ids.contractMissionId || 0)) >= 0;
    },
    { campaignMissionId: gmRun.campaignMissionId, contractMissionId: gmRun.contractMissionId },
    { timeout: STEP_TIMEOUT_MS }
  );

  const playerSummary = await p1Page.evaluate((ids) => {
    function resolveState() {
      try {
        return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
      } catch (_err) {
        return window.S || null;
      }
    }
    const s = resolveState();
    const active = Array.isArray(s && s.activeMissions) ? s.activeMissions : [];
    const campaignMission = active.find((m) => Number(m && m.id || 0) === Number(ids.campaignMissionId || 0));
    const contractMission = active.find((m) => Number(m && m.id || 0) === Number(ids.contractMissionId || 0));
    return {
      campaignSeen: !!campaignMission,
      contractSeen: !!contractMission,
      campaignType: campaignMission ? String(campaignMission.missionType || "") : "",
      contractType: contractMission ? String(contractMission.missionType || "") : ""
    };
  }, { campaignMissionId: gmRun.campaignMissionId, contractMissionId: gmRun.contractMissionId });

  if (!playerSummary.campaignSeen || !playerSummary.contractSeen) {
    throw new Error(`Player did not receive guild mission sync: ${JSON.stringify(playerSummary)}`);
  }
  if (playerSummary.campaignType !== "guild_campaign") {
    throw new Error(`Campaign mission type mismatch on player: ${JSON.stringify(playerSummary)}`);
  }
  if (playerSummary.contractType !== "guild_contract") {
    throw new Error(`Guild contract mission type mismatch on player: ${JSON.stringify(playerSummary)}`);
  }

  return {
    ok: true,
    code,
    campaignMissionId: gmRun.campaignMissionId,
    contractMissionId: gmRun.contractMissionId,
    playerSummary
  };
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const summary = await runScenario(browser);
    process.stdout.write(`[smoke] guild-multiplayer-sync summary: ${JSON.stringify(summary)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await wait(200);
      if (!server.killed) server.kill("SIGKILL");
    }
  }
}

main().catch((err) => {
  process.stderr.write(`[smoke] guild-multiplayer-sync failed: ${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

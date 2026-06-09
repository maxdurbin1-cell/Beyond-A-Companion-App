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
      // Retry.
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

async function runGuildScenario(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => !!(
      window.factionSystem &&
      window.factionSystem.joinGuild &&
      window.factionSystem.startGuildCampaign &&
      window.factionSystem.postGuildContract
    ),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  return page.evaluate(() => {
    function fail(error, extra) {
      return Object.assign({ ok: false, error: String(error || "unknown") }, extra || {});
    }
    function resolveState() {
      try {
        return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
      } catch (_err) {
        return window.S || null;
      }
    }

    if (typeof window.generateMap === "function") {
      try { window.generateMap(); } catch (_err) {}
    }

    const provinceBefore = (typeof window.getProvinceMapState === "function")
      ? window.getProvinceMapState()
      : null;
    const provinceBeforeCells = provinceBefore && Array.isArray(provinceBefore.mapData)
      ? provinceBefore.mapData.length
      : 0;

    const fs = window.factionSystem;
    const state = resolveState();
    if (!state) return fail("State S unavailable");

    const guildIds = ["corporations", "religious", "military", "underworld", "rebels", "scholars"];
    const results = [];

    guildIds.forEach((guildId) => {
      const gState = state.factionNarrative && state.factionNarrative.guildCampaigns
        ? state.factionNarrative.guildCampaigns[guildId]
        : null;
      if (!gState) throw new Error(`Missing guild state for ${guildId}`);

      fs.joinGuild(guildId);

      // Force stage-by-stage campaign completion for all 7 quests.
      for (let stage = 0; stage < 7; stage += 1) {
        gState.currentArcStage = stage;
        gState.activeCampaignMissionId = null;

        if (stage === 6) {
          const earned = Array.isArray(gState.earnedPrepOptions) ? gState.earnedPrepOptions.slice(0, 3) : [];
          gState.activePrepIds = earned;
        }

        fs.startGuildCampaign(guildId);
        const missionId = gState.activeCampaignMissionId;
        if (!missionId) throw new Error(`No mission posted at stage ${stage} for ${guildId}`);
        const mission = (state.activeMissions || []).find((m) => String(m.id) === String(missionId));
        if (!mission) throw new Error(`Mission not found in active list for ${guildId} stage ${stage}`);

        if (stage === 6) {
          if (mission.missionType !== "guild_boss_hunt") throw new Error(`Boss mission type mismatch for ${guildId}`);
          if (!mission.guildBossLayer || !Array.isArray(mission.guildBossLayer.abilities)) {
            throw new Error(`Missing boss layer for ${guildId}`);
          }
          const lockCount = mission.guildBossLayer.abilities.filter((row) => Array.isArray(row.lockedByPrepIds) && row.lockedByPrepIds.length).length;
          if (lockCount <= 0) throw new Error(`No locked boss abilities for ${guildId}`);
        }

        fs.onMissionResolved(mission, true);
      }

      if (!gState.bossDefeated) throw new Error(`Boss not marked defeated for ${guildId}`);
      if (Number(gState.currentArcStage || 0) < 7) throw new Error(`Campaign stage did not reach completion for ${guildId}`);

      // Validate repeatable guild_contract flow.
      fs.refreshGuildContracts(guildId);
      const contracts = Array.isArray(gState.guildContracts) ? gState.guildContracts : [];
      if (!contracts.length) throw new Error(`No guild contracts generated for ${guildId}`);
      const firstContract = contracts[0];
      fs.postGuildContract(guildId, firstContract.id);
      if (!gState.activeContractMissionId) throw new Error(`No active guild contract mission for ${guildId}`);
      const contractMission = (state.activeMissions || []).find((m) => String(m.id) === String(gState.activeContractMissionId));
      if (!contractMission) throw new Error(`Active guild contract mission missing for ${guildId}`);
      if (contractMission.missionType !== "guild_contract") throw new Error(`Contract mission type mismatch for ${guildId}`);
      fs.onMissionResolved(contractMission, true);
      if (gState.activeContractMissionId) throw new Error(`Contract mission not cleared for ${guildId}`);
      if (Number(gState.contractRuns || 0) < 1) throw new Error(`Contract run counter did not advance for ${guildId}`);

      results.push({
        guildId,
        completedQuestIds: (gState.completedQuestIds || []).length,
        contractRuns: Number(gState.contractRuns || 0)
      });
    });

    const provinceAfter = (typeof window.getProvinceMapState === "function")
      ? window.getProvinceMapState()
      : null;
    const provinceAfterCells = provinceAfter && Array.isArray(provinceAfter.mapData)
      ? provinceAfter.mapData.length
      : 0;

    // Wayfarer marker compatibility check should remain callable.
    let wayfarerCheck = false;
    try {
      wayfarerCheck = typeof fs.getProvinceTask === "function";
      if (wayfarerCheck && provinceAfter && Array.isArray(provinceAfter.mapData) && provinceAfter.mapData.length) {
        const hex = provinceAfter.mapData[0];
        fs.getProvinceTask(`${hex.col},${hex.row}`);
      }
    } catch (_err) {
      wayfarerCheck = false;
    }

    if (provinceBeforeCells <= 0 || provinceAfterCells <= 0) {
      return fail("Province map cells missing before/after guild flows", { provinceBeforeCells, provinceAfterCells, results });
    }
    if (!wayfarerCheck) {
      return fail("Wayfarer province task accessor failed", { provinceBeforeCells, provinceAfterCells, results });
    }

    return {
      ok: true,
      provinceBeforeCells,
      provinceAfterCells,
      guilds: results
    };
  });
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const summary = await runGuildScenario(page);
    if (!summary || !summary.ok) {
      throw new Error(`Guild smoke failed: ${JSON.stringify(summary)}`);
    }
    process.stdout.write(`[smoke] guild-system summary: ${JSON.stringify(summary)}\n`);
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
  process.stderr.write(`[smoke] guild-system failed: ${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

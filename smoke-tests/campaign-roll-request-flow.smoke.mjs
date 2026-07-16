import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 30000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPortOpen(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferredPort = 3000) {
  if (Number.isFinite(preferredPort) && preferredPort > 0 && preferredPort < 65536) {
    const available = await checkPortOpen(preferredPort);
    if (available) return preferredPort;
  }

  for (let i = 0; i < 30; i += 1) {
    const candidate = 4000 + Math.floor(Math.random() * 2000);
    const available = await checkPortOpen(candidate);
    if (available) return candidate;
  }

  throw new Error("Unable to find a free local port for campaign roll request smoke test.");
}

function startServer(port, tempRoot) {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
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

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (!/Executable doesn't exist/i.test(message)) throw err;
    return chromium.launch({ headless: true, channel: "chrome" });
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

async function prepareClient(page, baseUrl) {
  await page.goto(`${baseUrl}/?skipIntro=1&qa=campaign-roll-request-flow`, {
    waitUntil: "domcontentloaded",
    timeout: STEP_TIMEOUT_MS
  });
  await dismissBlockingOverlays(page);
  await page.waitForFunction(
    () => !!(window.campaignSystem && window.campaignSystem.getState && window.settingsSystem && window.S),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
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

async function requestTargetedPrompt(gmPage, label, stat, dread, options = {}) {
  const result = await gmPage.evaluate(async (payload) => {
    const st = window.campaignSystem.getState();
    const roster = st && st.campaign && (st.campaign.roster || st.campaign.members) || [];
    const player = roster.find((entry) => entry && entry.role !== "gm");
    if (!player || !player.token) return { ok: false, error: "Could not find player token." };
    return window.campaignSystem.requestRollPrompt(payload.label, payload.stat, payload.dread, player.token, payload.options);
  }, { label, stat, dread, options });
  if (!result || !result.ok) {
    throw new Error(`Targeted prompt failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function main() {
  const preferredPort = process.env.PORT ? Number(process.env.PORT) : 4100;
  const port = await pickAvailablePort(preferredPort);
  const baseUrl = process.env.SMOKE_URL || `http://127.0.0.1:${port}`;
  const tempRoot = path.join(os.tmpdir(), `btl-campaign-roll-request-${process.pid}-${Date.now()}`);
  const server = startServer(port, tempRoot);
  let browser;

  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await launchBrowser();

    const gmPage = await browser.newPage();
    const playerPage = await browser.newPage();
    const pageErrors = [];

    gmPage.on("pageerror", (err) => pageErrors.push(`GM: ${String(err && err.message ? err.message : err)}`));
    playerPage.on("pageerror", (err) => pageErrors.push(`Player: ${String(err && err.message ? err.message : err)}`));

    await prepareClient(gmPage, baseUrl);
    await prepareClient(playerPage, baseUrl);

    await gmPage.evaluate(() => {
      const input = document.getElementById("campaignNameInput");
      if (input) input.value = "Campaign Prompt Smoke GM";
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
    if (!code) throw new Error("Campaign prompt smoke failed: no campaign code created.");

    await playerPage.evaluate(async (campaignCode) => {
      await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Campaign Prompt Smoke Player", silent: true });
    }, code);
    await playerPage.waitForFunction(
      (campaignCode) => {
        const st = window.campaignSystem.getState();
        return !!(st && st.code === campaignCode && st.role === "player");
      },
      code,
      { timeout: STEP_TIMEOUT_MS }
    );

    await playerPage.evaluate(async () => {
      window.S.stats.lead = 8;
      window.S.stats.control = 8;
      window.S.stats.defend = 8;
      window.S.health = 0;
      window.S.stress = 0;
      window.S.pathTokens = 0;
      window.S.successRolls = 0;
      window.S.successRollCount = 0;
      window.S.mentalStress = 0;
      window.S.rads = 0;
      window.S.flavor = "Circuit Saint: traces old circuitry by touch.";
      window.S.personalFlavors = ["Circuit Saint: traces old circuitry by touch."];
      window.S.ownedHacks = ["Ping"];
      window.S.backpack = ["Compass (1 slot)", "Lockpicks (1 slot)"];
      window.S.equipment = window.S.equipment || {};
      window.S.equipment.readied = "Lockpicks";
      if (window.campaignSystem && typeof window.campaignSystem.syncCharacterToCampaign === "function") {
        await window.campaignSystem.syncCharacterToCampaign(true);
      }
    });
    await wait(1000);

    const gmRollCallUi = await gmPage.evaluate(() => {
      window.campaignSystem.refreshUI();
      const target = document.getElementById("campaignRollTarget");
      const stat = document.getElementById("campaignRollStat");
      const dread = document.getElementById("campaignRollDread");
      return {
        targetTag: target && target.tagName,
        targetOptions: target ? target.options.length : 0,
        statTag: stat && stat.tagName,
        statValues: stat ? Array.from(stat.options).map((option) => option.value) : [],
        dreadTag: dread && dread.tagName,
        dreadValues: dread ? Array.from(dread.options).map((option) => Number(option.value)) : [],
        hasPreview: !!document.getElementById("campaignRollSheetPreview")
      };
    });
    if (gmRollCallUi.targetTag !== "SELECT" || gmRollCallUi.targetOptions < 2 || gmRollCallUi.statTag !== "SELECT" || gmRollCallUi.dreadTag !== "SELECT" || !gmRollCallUi.hasPreview) {
      throw new Error(`GM Roll Call is not using controlled target/stat/dread inputs: ${JSON.stringify(gmRollCallUi)}`);
    }
    if (!gmRollCallUi.statValues.includes("lead") || gmRollCallUi.statValues.includes("action")) {
      throw new Error(`GM Roll Call exposed an invalid stat contract: ${JSON.stringify(gmRollCallUi)}`);
    }
    if (JSON.stringify(gmRollCallUi.dreadValues) !== JSON.stringify([4, 6, 8, 10, 12, 20])) {
      throw new Error(`GM Roll Call exposed non-standard Dread dice: ${JSON.stringify(gmRollCallUi)}`);
    }

    const rejectedContracts = await gmPage.evaluate(async () => {
      const st = window.campaignSystem.getState();
      const roster = st && st.campaign && (st.campaign.roster || st.campaign.members) || [];
      const player = roster.find((entry) => entry && entry.role !== "gm");
      return {
        invalidStat: await window.campaignSystem.requestRollPrompt("Invalid Stat", "Action Die", 8, player.token),
        invalidDread: await window.campaignSystem.requestRollPrompt("Invalid Dread", "lead", 7, player.token)
      };
    });
    if ((rejectedContracts.invalidStat && rejectedContracts.invalidStat.ok) || (rejectedContracts.invalidDread && rejectedContracts.invalidDread.ok)) {
      throw new Error(`Invalid campaign roll contracts were accepted: ${JSON.stringify(rejectedContracts)}`);
    }

    await requestTargetedPrompt(gmPage, "Alias Smoke Prompt", "notice", 6);
    await playerPage.waitForFunction(
      () => {
        const req = window.campaignSystem.getState().campaign && window.campaignSystem.getState().campaign.activeRollRequest;
        return !!(req && req.stat === "mind" && req.dread === 6);
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    await gmPage.evaluate(() => window.campaignSystem.closeActiveRoll());
    await gmPage.waitForFunction(
      () => !((window.campaignSystem.getState().campaign && window.campaignSystem.getState().campaign.activeRollRequest) || null),
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    await playerPage.evaluate(() => {
      if (typeof window.closeModal === "function") window.closeModal();
    });

    await requestTargetedPrompt(gmPage, "Control Smoke Prompt", "control", 6);
    await playerPage.waitForFunction(
      () => {
        const req = window.campaignSystem.getState().campaign && window.campaignSystem.getState().campaign.activeRollRequest;
        if (!req || req.stat !== "control") return false;
        return Array.from(document.querySelectorAll("[data-campaign-roll-inventory]")).some((el) => /lockpicks/i.test(String(el.parentElement && el.parentElement.textContent || "")))
          && Array.from(document.querySelectorAll("[data-campaign-roll-hack]")).some((el) => /ping/i.test(String(el.parentElement && el.parentElement.textContent || "")));
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    const controlPromptUi = await playerPage.evaluate(() => ({
      inventory: Array.from(document.querySelectorAll("[data-campaign-roll-inventory]")).map((el) => ({
        value: el.value,
        label: String(el.parentElement && el.parentElement.textContent || "")
      })),
      hacks: Array.from(document.querySelectorAll("[data-campaign-roll-hack]")).map((el) => ({
        value: el.value,
        label: String(el.parentElement && el.parentElement.textContent || "")
      })),
      flavorAvailable: !!document.getElementById("campaignRollUseFlavor")
    }));
    if (!controlPromptUi.flavorAvailable) {
      throw new Error(`Control prompt did not expose personal flavor: ${JSON.stringify(controlPromptUi)}`);
    }
    if (!controlPromptUi.inventory.some((entry) => /lockpicks/i.test(entry.label))) {
      throw new Error(`Control prompt did not expose lockpicks inventory bonuses: ${JSON.stringify(controlPromptUi)}`);
    }
    if (!controlPromptUi.hacks.some((entry) => /ping/i.test(entry.label))) {
      throw new Error(`Control prompt did not expose hack choices: ${JSON.stringify(controlPromptUi)}`);
    }

    await gmPage.evaluate(() => window.campaignSystem.closeActiveRoll());
    await gmPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        return !((st && st.campaign && st.campaign.activeRollRequest) || null);
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    await playerPage.evaluate(() => {
      if (typeof window.closeModal === "function") window.closeModal();
    });

    await playerPage.evaluate(async () => {
      window.S.equipment.readied = "Compass";
      if (window.campaignSystem && typeof window.campaignSystem.syncCharacterToCampaign === "function") {
        await window.campaignSystem.syncCharacterToCampaign(true);
      }
    });
    await wait(500);

    const leadPrompt = await requestTargetedPrompt(gmPage, "Lead Smoke Prompt", "lead", 4);
    if (!leadPrompt.pendingCheckId) {
      throw new Error(`Lead prompt did not create pending check metadata: ${JSON.stringify(leadPrompt)}`);
    }
    await playerPage.waitForFunction(
      () => {
        const req = window.campaignSystem.getState().campaign && window.campaignSystem.getState().campaign.activeRollRequest;
        if (!req || req.stat !== "lead") return false;
        return Array.from(document.querySelectorAll("[data-campaign-roll-inventory]")).some((el) => /compass/i.test(String(el.parentElement && el.parentElement.textContent || "")));
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    const leadPromptUi = await playerPage.evaluate(() => ({
      inventory: Array.from(document.querySelectorAll("[data-campaign-roll-inventory]")).map((el) => ({
        value: el.value,
        label: String(el.parentElement && el.parentElement.textContent || "")
      })),
      flavorAvailable: !!document.getElementById("campaignRollUseFlavor")
    }));
    if (!leadPromptUi.flavorAvailable) {
      throw new Error(`Lead prompt did not expose personal flavor: ${JSON.stringify(leadPromptUi)}`);
    }
    if (!leadPromptUi.inventory.some((entry) => /compass/i.test(entry.label))) {
      throw new Error(`Lead prompt did not expose compass inventory bonuses: ${JSON.stringify(leadPromptUi)}`);
    }

    await playerPage.evaluate(() => {
      window.openProvinceManualCheckPrompt = (cfg) => {
        if (cfg && typeof cfg.onResolve === "function") {
          cfg.onResolve({ success: true, actionTotal: 10, dreadTotal: 4, manual: true });
        }
        return true;
      };
      const firstInventory = document.querySelector("[data-campaign-roll-inventory]");
      if (firstInventory) firstInventory.checked = true;
    });
    await playerPage.evaluate(() => window.campaignSystem.submitActiveRollManual());

    await playerPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        return !((st && st.campaign && st.campaign.activeRollRequest) || null)
          && Number(window.S.successRolls || window.S.successRollCount || 0) === 1;
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    await gmPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        const roster = st && st.campaign && (st.campaign.roster || st.campaign.members) || [];
        const player = roster.find((entry) => entry && entry.role !== "gm");
        const c = player && player.character || {};
        return !((st && st.campaign && st.campaign.activeRollRequest) || null)
          && Number(c.successRolls || c.successRollCount || 0) === 1;
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const damagePrompt = await requestTargetedPrompt(gmPage, "Damage Margin Smoke Prompt", "defend", 6, {
      failurePenaltyType: "health",
      failTmw: 1
    });
    if (!damagePrompt.pendingCheckId) {
      throw new Error(`Damage prompt did not create pending check metadata: ${JSON.stringify(damagePrompt)}`);
    }
    await playerPage.waitForFunction(
      () => {
        const req = window.campaignSystem.getState().campaign && window.campaignSystem.getState().campaign.activeRollRequest;
        return !!(req && req.stat === "defend" && req.failurePenaltyType === "health");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    await playerPage.evaluate(() => {
      window.openProvinceManualCheckPrompt = (cfg) => {
        if (cfg && typeof cfg.onResolve === "function") {
          cfg.onResolve({ success: false, actionTotal: 2, dreadTotal: 6, manual: true });
        }
        return true;
      };
    });
    await playerPage.evaluate(() => window.campaignSystem.submitActiveRollManual());
    await playerPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        return !((st && st.campaign && st.campaign.activeRollRequest) || null);
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    await wait(500);
    const playerHealth = await playerPage.evaluate(() => {
      const st = window.campaignSystem.getState();
      const roster = st && st.campaign && (st.campaign.roster || st.campaign.members) || [];
      const self = roster.find((entry) => entry && String(entry.token || "") === String(st.token || ""));
      return {
        localDamageTaken: Number(window.S.health || 0),
        localDefend: Number(window.S.stats && window.S.stats.defend || 0),
        character: self && self.character || null
      };
    });
    if (playerHealth.localDamageTaken !== 4) {
      throw new Error(`Player sheet did not receive failed-margin damage: ${JSON.stringify(playerHealth)}`);
    }
    const campaignHealth = await gmPage.evaluate(() => {
      const st = window.campaignSystem.getState();
      const roster = st && st.campaign && (st.campaign.roster || st.campaign.members) || [];
      const player = roster.find((entry) => entry && entry.role !== "gm");
      const character = player && player.character || {};
      const party = window.campaignSystem.buildPartyRoster();
      const partyCharacter = party[0] && party[0].character || {};
      return {
        health: Number(character.health || 0),
        maxHealth: Number(character.maxHealth || 0),
        damageTaken: Number(character.damageTaken || 0),
        healthModel: String(character.healthModel || ""),
        partyHealth: Number(partyCharacter.health || 0)
      };
    });
    if (campaignHealth.health !== 12 || campaignHealth.maxHealth !== 16 || campaignHealth.damageTaken !== 4 || campaignHealth.healthModel !== "remaining" || campaignHealth.partyHealth !== 12) {
      throw new Error(`Campaign HP did not mirror the sheet damage track correctly: ${JSON.stringify(campaignHealth)}`);
    }

    await playerPage.evaluate(() => window.settingsSystem.setGameMode("solo"));
    await playerPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        return !st.code && !st.role && document.body.classList.contains("solo-mode");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    await gmPage.evaluate(() => window.settingsSystem.setGameMode("solo"));
    await gmPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        return !st.code && !st.role && document.body.classList.contains("solo-mode");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    if (pageErrors.length) {
      throw new Error(`Campaign prompt smoke saw page errors: ${pageErrors.join(" | ")}`);
    }

    process.stdout.write(`Campaign roll request smoke passed: code=${code}\n`);
    await gmPage.close();
    await playerPage.close();
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

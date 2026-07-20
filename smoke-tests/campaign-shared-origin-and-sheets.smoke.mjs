import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

let BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 40000;

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

async function pickAvailablePort(preferredPort = 3204) {
  if (await canBindPort(preferredPort)) return preferredPort;
  for (let i = 0; i < 32; i += 1) {
    const candidate = 6200 + Math.floor(Math.random() * 800);
    if (await canBindPort(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for campaign shared origin smoke.");
}

function startServer(port, tempRoot) {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      HOST: "127.0.0.1",
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

async function buildCharacterAndOrigin(page, playerLabel, reason) {
  await page.evaluate(async ({ label, why }) => {
    function resolveState() {
      try {
        return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
      } catch (_err) {
        return window.S || null;
      }
    }
    if (typeof window.generateCharacter === "function") {
      try { window.generateCharacter(); } catch (_err) {}
    }
    const s = resolveState();
    if (s) {
      s.name = String(label || "Wayfarer");
      if (!s.reason) s.reason = String(why || "find a better route");
      s.career = "Smoke Cartographer";
      s.background = "Shared-table test Wayfarer";
      s.flavor = "Pathfinder: Add Valor Die as a bonus when encountering Barriers during traversal";
      s.traits = { virtue: "Mercy", vice: "Vain", reputation: "Honest" };
      s.equipment = s.equipment && typeof s.equipment === "object" ? s.equipment : {};
      s.equipment.weapon1 = "Sword (+1 Strike | Engaged)";
      s.equipment.weapon2 = "Shield (+V.D. Defend)";
      s.backstory = s.backstory && typeof s.backstory === "object" ? s.backstory : {};
      s.backstory.origin = `${label} Origin`;
      s.backstory.hometown = `${label} Hometown`;
      s.backstory.rival = `${label} Rival`;
      s.backstory.connection = `${label} Trusted Contact`;
      s.backstory.notes = `${label} carries a personal campaign thread.`;
    }
    if (typeof window.createOriginMissionFromReason === "function") {
      try { window.createOriginMissionFromReason(true, { suppressFocus: true }); } catch (_err) {}
    }
    if (window.campaignSystem && typeof window.campaignSystem.syncCharacterToCampaign === "function") {
      await window.campaignSystem.syncCharacterToCampaign(true);
    }
  }, { label: playerLabel, why: reason });
}

async function runScenario(browser) {
  const gmPage = await browser.newPage();
  const p1Page = await browser.newPage();

  for (const page of [gmPage, p1Page]) {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForCampaignReady(page);
    await clearSession(page);
  }

  const manualBuilderCheck = await gmPage.evaluate(() => {
    if (typeof window.setCharacterTrait === "function") window.setCharacterTrait("virtue", "Mercy");
    if (typeof window.setManualBackstoryField === "function") window.setManualBackstoryField("hometown", "Manual Smoke Hometown");
    if (typeof window.openManualEquipmentPicker === "function") window.openManualEquipmentPicker("weapon2");
    const choices = Array.isArray(window._manualEquipmentChoices) ? window._manualEquipmentChoices : [];
    const shieldIndex = choices.findIndex((entry) => entry && /shield/i.test(String(entry.name || "")));
    const picker = document.getElementById("manualEquipmentChoice");
    if (picker && shieldIndex >= 0) picker.value = String(shieldIndex);
    if (picker && shieldIndex >= 0 && typeof window.applyManualEquipmentChoice === "function") {
      window.applyManualEquipmentChoice("weapon2");
    }
    const state = (typeof S !== "undefined" && S) ? S : window.S;
    const topButtons = Array.from(document.querySelectorAll("#tab-character .char-top button")).map((button) => String(button.textContent || "").trim());
    return {
      hasManualBuilder: !!document.getElementById("manualCharacterBuilder"),
      hasManualButton: topButtons.some((label) => label === "Manual Build"),
      hasGuideButton: topButtons.some((label) => label === "Guide"),
      hasGuidedBuildText: document.body.textContent.includes("Guided Character Builder"),
      virtue: String(state && state.traits && state.traits.virtue || ""),
      hometown: String(state && state.backstory && state.backstory.hometown || ""),
      weapon2: String(state && state.equipment && state.equipment.weapon2 || ""),
      hasFlavorPicker: typeof window.openManualFlavorPicker === "function"
    };
  });
  if (!manualBuilderCheck.hasManualBuilder || !manualBuilderCheck.hasManualButton || manualBuilderCheck.hasGuideButton
    || manualBuilderCheck.hasGuidedBuildText || manualBuilderCheck.virtue !== "Mercy"
    || manualBuilderCheck.hometown !== "Manual Smoke Hometown" || !/shield/i.test(manualBuilderCheck.weapon2)
    || !manualBuilderCheck.hasFlavorPicker) {
    throw new Error(`Manual character builder regression: ${JSON.stringify(manualBuilderCheck)}`);
  }

  await gmPage.evaluate(() => {
    const el = document.getElementById("campaignNameInput");
    if (el) el.value = "Sheet+Origin GM";
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
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Sheet+Origin P1" });
  }, code);

  await p1Page.waitForFunction(
    (campaignCode) => {
      const st = window.campaignSystem.getState();
      return !!(st && st.code === campaignCode && st.role === "player");
    },
    code,
    { timeout: STEP_TIMEOUT_MS }
  );

  await buildCharacterAndOrigin(gmPage, "GM Atlas", "recover old convoy manifests");
  await buildCharacterAndOrigin(p1Page, "P1 Vesper", "pay a reef-syndicate debt");

  try {
    await gmPage.waitForFunction(
      () => {
        const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
        const campaign = st && st.campaign ? st.campaign : null;
        const shared = campaign && campaign.shared && campaign.shared.state ? campaign.shared.state : {};
        const roster = Array.isArray(campaign && campaign.roster) ? campaign.roster : [];
        const missions = Array.isArray(shared && shared.activeMissions) ? shared.activeMissions : [];
        const origins = missions.filter((m) => m && m.missionType === "origin_story");
        const ownerTokens = new Set(origins.map((m) => String(m.originOwnerToken || "")).filter(Boolean));
        const rosterWithCharacters = roster.filter((m) => m && m.character);
        const rosterWithStoryThreads = roster.filter((m) => m && m.character && m.character.backstory
          && m.character.backstory.hometown && m.character.backstory.rival && m.character.backstory.connection);
        return origins.length >= 1 && ownerTokens.size >= 1 && rosterWithCharacters.length >= 2 && rosterWithStoryThreads.length >= 2;
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
  } catch (err) {
    const gmDiagnostics = await gmPage.evaluate(() => {
      const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
      const campaign = st && st.campaign ? st.campaign : null;
      const shared = campaign && campaign.shared && campaign.shared.state ? campaign.shared.state : {};
      const roster = Array.isArray(campaign && campaign.roster) ? campaign.roster : [];
      const missions = Array.isArray(shared && shared.activeMissions) ? shared.activeMissions : [];
      const origins = missions.filter((m) => m && m.missionType === "origin_story");
      const ownerTokens = Array.from(new Set(origins.map((m) => String(m.originOwnerToken || "")).filter(Boolean)));
      return {
        role: String(st && st.role || ""),
        code: String(st && st.code || ""),
        rosterSize: roster.length,
        rosterWithCharacter: roster.filter((m) => m && m.character).length,
        rosterWithLoadout: roster.filter((m) => m && m.character && m.character.loadout).length,
        rosterWithHacks: roster.filter((m) => m && m.character && Array.isArray(m.character.hacks)).length,
        rosterWithStoryThreads: roster.filter((m) => m && m.character && m.character.backstory
          && m.character.backstory.hometown && m.character.backstory.rival && m.character.backstory.connection).length,
        originCount: origins.length,
        ownerTokenCount: ownerTokens.length,
        ownerTokens
      };
    });
    throw new Error(`GM did not observe synchronized roster + origin state: ${JSON.stringify({ diagnostics: gmDiagnostics, error: String(err && err.message ? err.message : err) })}`);
  }

  try {
    await p1Page.waitForFunction(
      () => {
        function resolveState() {
          try {
            return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
          } catch (_err) {
            return window.S || null;
          }
        }

        function hasVisibleOriginThread(list) {
          const missions = Array.isArray(list) ? list : [];
          const origins = missions.filter((m) => m && m.missionType === "origin_story");
          const ownerTokens = new Set(origins.map((m) => String(m.originOwnerToken || "")).filter(Boolean));
          return origins.length >= 1 && ownerTokens.size >= 1;
        }

        const s = resolveState();
        const localOk = hasVisibleOriginThread(s && s.activeMissions);

        const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
        const campaign = st && st.campaign ? st.campaign : null;
        const shared = campaign && campaign.shared && campaign.shared.state ? campaign.shared.state : null;
        const sharedOk = hasVisibleOriginThread(shared && shared.activeMissions);

        return localOk || sharedOk;
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
  } catch (err) {
    const p1Diagnostics = await p1Page.evaluate(() => {
      function resolveState() {
        try {
          return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
        } catch (_err) {
          return window.S || null;
        }
      }

      function summarizeOrigins(list) {
        const missions = Array.isArray(list) ? list : [];
        const origins = missions.filter((m) => m && m.missionType === "origin_story");
        const owners = Array.from(new Set(origins.map((m) => String(m.originOwnerToken || "")).filter(Boolean)));
        return {
          originCount: origins.length,
          ownerCount: owners.length,
          ownerTokens: owners
        };
      }

      const s = resolveState();
      const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
      const campaign = st && st.campaign ? st.campaign : null;
      const shared = campaign && campaign.shared && campaign.shared.state ? campaign.shared.state : null;
      return {
        role: String(st && st.role || ""),
        code: String(st && st.code || ""),
        local: summarizeOrigins(s && s.activeMissions),
        shared: summarizeOrigins(shared && shared.activeMissions)
      };
    });
    throw new Error(`P1 did not observe synchronized origin missions: ${JSON.stringify({ diagnostics: p1Diagnostics, error: String(err && err.message ? err.message : err) })}`);
  }

  const gmSummary = await gmPage.evaluate(() => {
    const st = window.campaignSystem.getState();
    const roster = Array.isArray(st && st.campaign && st.campaign.roster) ? st.campaign.roster : [];
    const shared = st && st.campaign && st.campaign.shared && st.campaign.shared.state ? st.campaign.shared.state : {};
    const origins = (Array.isArray(shared.activeMissions) ? shared.activeMissions : [])
      .filter((m) => m && m.missionType === "origin_story");
    const playerMember = roster.find((member) => member && member.role === "player" && member.character);
    let stagedStoryHook = null;
    if (playerMember && window.campaignSystem && typeof window.campaignSystem.stageWayfarerStoryThread === "function") {
      stagedStoryHook = window.campaignSystem.stageWayfarerStoryThread(playerMember.token, "hometown");
    }

    const sheetChecks = roster.map((member) => {
      let opened = false;
      try {
        if (window.campaignSystem && typeof window.campaignSystem.viewRosterSheet === "function") {
          window.campaignSystem.viewRosterSheet(member.token);
          opened = true;
        }
      } catch (_err) {
        opened = false;
      }
      return {
        token: String(member && member.token || ""),
        hasCharacter: !!(member && member.character),
        hasLoadout: !!(member && member.character && member.character.loadout),
        hasHacks: !!(member && member.character && Array.isArray(member.character.hacks)),
        hasTraits: !!(member && member.character && member.character.traits && member.character.traits.virtue),
        hasBackstory: !!(member && member.character && member.character.backstory
          && member.character.backstory.hometown && member.character.backstory.rival && member.character.backstory.connection),
        opened
      };
    });

    return {
      rosterSize: roster.length,
      originCount: origins.length,
      ownerTokenCount: new Set(origins.map((m) => String(m.originOwnerToken || "")).filter(Boolean)).size,
      stagedStoryHook: stagedStoryHook ? {
        text: String(stagedStoryHook.text || ""),
        source: String(stagedStoryHook.source || ""),
        missionId: String(stagedStoryHook.missionId || "")
      } : null,
      canRequestStoryRoll: !!(window.campaignSystem && typeof window.campaignSystem.requestWayfarerStoryRoll === "function"),
      sheetChecks
    };
  });

  if (gmSummary.rosterSize < 2) {
    throw new Error(`Roster did not include both players: ${JSON.stringify(gmSummary)}`);
  }
  if (gmSummary.originCount < 1 || gmSummary.ownerTokenCount < 1) {
    throw new Error(`Shared origin mission thread was not preserved: ${JSON.stringify(gmSummary)}`);
  }
  if (!gmSummary.sheetChecks.every((row) => row.hasCharacter && row.hasLoadout && row.hasHacks && row.hasTraits && row.hasBackstory && row.opened)) {
    throw new Error(`GM could not open full synced sheets for all players: ${JSON.stringify(gmSummary)}`);
  }
  if (!gmSummary.stagedStoryHook || !gmSummary.stagedStoryHook.missionId.includes("wayfarer:") || !gmSummary.canRequestStoryRoll) {
    throw new Error(`GM could not stage and manage a player-owned story thread: ${JSON.stringify(gmSummary)}`);
  }

  const storyRollRequest = await gmPage.evaluate(async () => {
    const state = window.campaignSystem.getState();
    const roster = Array.isArray(state && state.campaign && state.campaign.roster) ? state.campaign.roster : [];
    const player = roster.find((member) => member && member.role === "player" && member.character);
    if (!player) return { ok: false, error: "Player Wayfarer not found." };
    return window.campaignSystem.requestWayfarerStoryRoll(player.token, "rival");
  });
  if (!storyRollRequest || !storyRollRequest.ok) {
    throw new Error(`GM could not request the player's Rival roll: ${JSON.stringify(storyRollRequest)}`);
  }
  await p1Page.waitForFunction(
    () => {
      const state = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
      const request = state && state.campaign ? state.campaign.activeRollRequest : null;
      return !!(request && request.id && /rival/i.test(String(request.label || ""))
        && String(request.targetToken || "") === String(state.token || ""));
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
  gmSummary.storyRollRequest = {
    ok: true,
    label: "Rival",
    target: "player-owner"
  };

  return {
    ok: true,
    code,
    gmSummary
  };
}

async function main() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const tempRoot = path.join(os.tmpdir(), `btl-smoke-shared-origin-${stamp}`);
  const requestedUrl = String(process.env.SMOKE_URL || "").trim();
  const port = requestedUrl
    ? Number(new URL(requestedUrl).port || 80)
    : await pickAvailablePort(Number(process.env.PORT || 3204) || 3204);
  BASE_URL = requestedUrl || `http://127.0.0.1:${port}`;
  const server = startServer(port, tempRoot);
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const summary = await runScenario(browser);
    process.stdout.write(`[smoke] campaign-shared-origin-and-sheets summary: ${JSON.stringify(summary)}\n`);
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
  process.stderr.write(`[smoke] campaign-shared-origin-and-sheets failed: ${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

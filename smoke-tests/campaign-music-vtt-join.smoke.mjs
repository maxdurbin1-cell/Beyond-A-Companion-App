import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
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
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferredPort = 3000) {
  if (await checkPortOpen(preferredPort)) return preferredPort;
  for (let i = 0; i < 25; i += 1) {
    const candidate = 4100 + Math.floor(Math.random() * 1400);
    if (await checkPortOpen(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for campaign music VTT smoke.");
}

function startServer(port) {
  const stamp = `${process.pid}-${Date.now()}`;
  const tempRoot = path.join(os.tmpdir(), `btl-smoke-campaign-music-vtt-${stamp}`);
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

async function waitForPlayerSharedVttJoinPrompt(gmPage, playerPage) {
  let lastSnapshot = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await playerPage.waitForFunction(
        () => {
          const overlay = document.getElementById("combatModeOverlay");
          const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
            ? window.campaignSystem.getSharedState()
            : null;
          const vttSession = shared && shared.campaignCombat && shared.campaignCombat.vttSession
            ? shared.campaignCombat.vttSession
            : null;
          const hasSceneEditor = !!(window.S && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object");
          return (
            (!overlay || !overlay.classList.contains("open")) &&
            (
              typeof window.joinSharedCampaignCombatModeFromPrompt === "function"
              || (!!vttSession && hasSceneEditor && !!(window.campaignSystem && typeof window.campaignSystem.joinSharedCombatMode === "function"))
            )
          );
        },
        null,
        { timeout: 4000 }
      );
      return;
    } catch (_err) {
      lastSnapshot = await playerPage.evaluate(() => {
        const overlay = document.getElementById("combatModeOverlay");
        const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
          ? window.campaignSystem.getSharedState()
          : null;
        const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
          ? shared.campaignCombat
          : null;
        return {
          overlayOpen: !!(overlay && overlay.classList.contains("open")),
          joinFnType: typeof window.joinSharedCampaignCombatModeFromPrompt,
          hasSceneEditor: !!(window.S && window.S.combat && window.S.combat.sceneEditor && typeof window.S.combat.sceneEditor === "object"),
          vttEnteredAt: Number(combat && combat.vttSession && combat.vttSession.enteredAt || 0),
          vttSceneName: String(combat && combat.vttSession && combat.vttSession.sceneName || ""),
          startedAt: Number(combat && combat.startedAt || 0)
        };
      });
      await playerPage.evaluate(async () => {
        try {
          if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
            await window.campaignSystem.requestResync();
          }
        } catch (_err2) {}
      });
      await gmPage.evaluate(async () => {
        try {
          if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
            await window.campaignSystem.syncSharedSilent("music-vtt-join-prompt-retry");
          }
        } catch (_err2) {}
      });
      await wait(300);
    }
  }
  throw new Error(`Player never received shared VTT join prompt: ${JSON.stringify(lastSnapshot || {})}`);
}

async function enableMusicConsent(page) {
  await page.evaluate(async () => {
    const audio = window.AudioManager;
    if (audio && typeof audio.setMusicConsent === "function" && !audio.musicConsent) {
      audio.setMusicConsent(true);
    }
    if (audio && audio.audioContext && audio.audioContext.state === "suspended") {
      try {
        await audio.audioContext.resume();
      } catch (_err) {}
    }
  });
}

async function syncCharacter(page, name) {
  await page.evaluate(async (characterName) => {
    if ((!window.S || !window.S.stats) && typeof window.generateCharacter === "function") {
      try { window.generateCharacter(); } catch (_err) {}
    }
    const s = window.S = window.S || {};
    s.name = characterName;
    s.stats = Object.assign(
      { body: 8, strike: 8, shoot: 8, mind: 8, control: 8, lead: 8, spirit: 8, defend: 8 },
      s.stats || {}
    );
    s.combat = s.combat || {};
    s.enemies = Array.isArray(s.enemies) ? s.enemies : [];
    s.combatMap = s.combatMap && typeof s.combatMap === "object"
      ? s.combatMap
      : { units: [] };
    s.backpack = ["Compass (1 slot)", "Lockpicks (1 slot)"];
    s.ownedHacks = ["Ping"];
    s.personalFlavors = ["Circuit Saint: traces old circuitry by touch."];
    s.flavor = "Circuit Saint: traces old circuitry by touch.";
    s.equipment = s.equipment || {};
    s.equipment.readied = "Compass";
    if (window.campaignSystem && typeof window.campaignSystem.syncCharacterToCampaign === "function") {
      await window.campaignSystem.syncCharacterToCampaign(true);
    }
  }, name);
}

async function setCampaignMood(page, mood, suiteId, styleName, ambienceIds) {
  return page.evaluate(async (payload) => {
    return await new Promise((resolve) => {
      window.campaignSystem.setGmSoundtrack(payload, (res) => resolve(res || { ok: false }));
    });
  }, {
    enabled: true,
    mood,
    suiteId,
    styleName,
    ambienceIds
  });
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
      await page.goto(baseUrl, { waitUntil: "networkidle", timeout: STEP_TIMEOUT_MS });
      await waitForCampaignReady(page);
      await clearSession(page);
    }

    await enableMusicConsent(gmPage);
    await enableMusicConsent(playerPage);

    await gmPage.evaluate(() => {
      const el = document.getElementById("campaignNameInput");
      if (el) el.value = "Music Risk GM";
    });
    await gmPage.evaluate(async () => {
      await window.campaignSystem.createCampaign();
    });

    const code = await gmPage.evaluate(() => {
      const st = window.campaignSystem.getState();
      return st && st.code ? st.code : "";
    });
    if (!code) throw new Error("Failed to create campaign code.");

    await playerPage.evaluate(async (campaignCode) => {
      await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Music Risk Player" });
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

    await syncCharacter(gmPage, "Music Risk GM");
    await syncCharacter(playerPage, "Music Risk Player");
    await wait(800);

    const provinceMood = await setCampaignMood(
      gmPage,
      "province-expedition",
      "music-suite-province",
      "Province Marches",
      ["amb-wind"]
    );
    if (!provinceMood || !provinceMood.ok) {
      throw new Error(`Province soundtrack sync failed: ${JSON.stringify(provinceMood)}`);
    }

    await playerPage.waitForFunction(
      () => {
        return !!(
          window.AudioManager &&
          window.AudioManager.musicConsent === true &&
          window.AudioManager.campaignSoundtrackOverride &&
          window.AudioManager.campaignSoundtrackOverride.mood === "province-expedition"
        );
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    await Promise.all([
      gmPage.evaluate(() => { if (window.switchTab) window.switchTab("combat"); }),
      playerPage.evaluate(() => { if (window.switchTab) window.switchTab("combat"); })
    ]);

    const participants = await gmPage.evaluate(() => {
      const s = window.S = window.S || {};
      const combat = { active: true, enemyDread: 8, spacing: "Nearby", round: 1, actionsLeft: 3 };
      const enemies = [
        { id: "risk-e1", name: "Ash Raider", stress: 1, maxStress: 6, ally: false, conditions: [] },
        { id: "risk-e2", name: "Pale Hound", stress: 0, maxStress: 6, ally: false, conditions: [] }
      ];
      const combatMap = {
        units: [
          { id: 1, name: "Music Risk GM", side: "ally", zone: "Engaged", isPlayer: true },
          { id: 2, name: "Ash Raider", side: "enemy", zone: "Nearby", fromTracker: true, trackerKey: "enemy:risk-e1" },
          { id: 3, name: "Pale Hound", side: "enemy", zone: "Far", fromTracker: true, trackerKey: "enemy:risk-e2" }
        ],
        lastRelativeZone: "Nearby"
      };
      s.combat = combat;
      s.enemies = enemies;
      s.combatMap = combatMap;
      if (typeof window.updateCombatUI === "function") {
        try { window.updateCombatUI(); } catch (_err) {}
      }
      if (typeof window.renderEnemies === "function") {
        try { window.renderEnemies(); } catch (_err) {}
      }
      if (typeof window.renderCombatMap === "function") {
        try { window.renderCombatMap(); } catch (_err) {}
      }
      const members = ((window.campaignSystem.getState().campaign || {}).roster || []);
      const gmMember = members.find((entry) => entry && entry.role === "gm") || members[0];
      const playerMember = members.find((entry) => entry && entry.role !== "gm") || members[members.length - 1];
      return {
        participants: [
          {
            token: String(gmMember && gmMember.token || "gm-token"),
            name: String(gmMember && gmMember.name || "GM"),
            role: "gm",
            character: { name: String(gmMember && gmMember.name || "GM"), stats: { valor: 10 } }
          },
          {
            token: String(playerMember && playerMember.token || "player-token"),
            name: String(playerMember && playerMember.name || "Player"),
            role: "player",
            character: { name: String(playerMember && playerMember.name || "Player"), stats: { valor: 6 } }
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

    const combatStart = await gmPage.evaluate(async (parts) => {
      return await new Promise((resolve) => {
        window.campaignSystem.startCampaignCombat(parts.participants, (res) => resolve(res || { ok: false }), { skipReadyCheck: true });
      });
    }, participants);
    if (!combatStart || !combatStart.ok) {
      throw new Error(`Combat start failed: ${JSON.stringify(combatStart)}`);
    }

    const seeded = await gmPage.evaluate(async (payload) => {
      return window.campaignSystem.syncSharedPatch({ combatScene: payload.combatScene }, "music-risk-combat-seed");
    }, participants);
    if (!seeded || !seeded.ok) {
      throw new Error(`Combat scene seed failed: ${JSON.stringify(seeded)}`);
    }

    await playerPage.waitForFunction(
      () => {
        const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
          ? window.campaignSystem.getSharedState()
          : null;
        const scene = shared && shared.combatScene && typeof shared.combatScene === "object"
          ? shared.combatScene
          : null;
        const enemies = scene && Array.isArray(scene.enemies) ? scene.enemies : [];
        return enemies.some((enemy) => enemy && enemy.name === "Ash Raider");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    await gmPage.evaluate(() => {
      const btn = document.getElementById("combatEnterModeBtn");
      if (!btn) throw new Error("Missing combatEnterModeBtn");
      btn.click();
    });
    await gmPage.waitForSelector("#combatModeOverlay.open", { timeout: STEP_TIMEOUT_MS });
    await waitForPlayerSharedVttJoinPrompt(gmPage, playerPage);

    const promptStateBeforeSwap = await playerPage.evaluate(() => ({
      modalTitle: document.getElementById("modalTitle")?.textContent || "",
      overlayOpen: !!document.querySelector("#combatModeOverlay.open"),
      joinFnType: typeof window.joinSharedCampaignCombatModeFromPrompt
    }));

    const combatMood = await setCampaignMood(
      gmPage,
      "combat-pressure",
      "music-suite-combat",
      "Iron Clash",
      ["amb-weapon-fighting"]
    );
    if (!combatMood || !combatMood.ok) {
      throw new Error(`Combat soundtrack sync failed: ${JSON.stringify(combatMood)}`);
    }

    await playerPage.waitForFunction(
      () => {
        return !!(
          window.AudioManager &&
          window.AudioManager.campaignSoundtrackOverride &&
          window.AudioManager.campaignSoundtrackOverride.mood === "combat-pressure"
        );
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const promptStateAfterSwap = await playerPage.evaluate(() => ({
      modalTitle: document.getElementById("modalTitle")?.textContent || "",
      overlayOpen: !!document.querySelector("#combatModeOverlay.open"),
      joinFnType: typeof window.joinSharedCampaignCombatModeFromPrompt,
      soundtrackMood: window.AudioManager?.campaignSoundtrackOverride?.mood || ""
    }));

    const joinAttempt = await playerPage.evaluate(() => {
      const beforeOpen = !!document.querySelector("#combatModeOverlay.open");
      let method = "missing";
      let result = "missing";
      if (typeof window.joinSharedCampaignCombatModeFromPrompt === "function") {
        method = "prompt";
        result = window.joinSharedCampaignCombatModeFromPrompt();
      } else if (window.campaignSystem && typeof window.campaignSystem.joinSharedCombatMode === "function") {
        method = "direct";
        result = window.campaignSystem.joinSharedCombatMode();
      }
      return {
        method,
        resultType: typeof result,
        beforeOpen,
        afterOpen: !!document.querySelector("#combatModeOverlay.open")
      };
    });

    await playerPage.waitForFunction(
      () => !!document.querySelector("#combatModeOverlay.open"),
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    await playerPage.waitForFunction(
      () => {
        const units = window.S && window.S.combat && window.S.combat.sceneEditor && Array.isArray(window.S.combat.sceneEditor.tokens)
          ? window.S.combat.sceneEditor.tokens
          : [];
        return units.some((unit) => unit && unit.name === "Ash Raider");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const playerSummary = await playerPage.evaluate(() => ({
      overlayOpen: !!document.querySelector("#combatModeOverlay.open"),
      soundtrackMood: window.AudioManager?.campaignSoundtrackOverride?.mood || "",
      unitNames: (window.S?.combat?.sceneEditor?.tokens || []).map((unit) => unit && unit.name).filter(Boolean)
    }));
    const gmSummary = await gmPage.evaluate(() => ({
      overlayOpen: !!document.querySelector("#combatModeOverlay.open"),
      soundtrackMood: window.AudioManager?.campaignSoundtrackOverride?.mood || "",
      musicConsent: !!window.AudioManager?.musicConsent
    }));

    if (pageErrors.length) {
      throw new Error(`Music/VTT smoke saw page errors: ${pageErrors.join(" | ")}`);
    }

    process.stdout.write(
      "Campaign music VTT join smoke passed: "
      + JSON.stringify({
        code,
        promptBeforeSwap: promptStateBeforeSwap,
        promptAfterSwap: promptStateAfterSwap,
        joinAttempt,
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

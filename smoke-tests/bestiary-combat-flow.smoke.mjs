import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 30000;
const STEP_TIMEOUT_MS = 20000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferred = 3217) {
  if (await canBindPort(preferred)) return preferred;
  for (let i = 0; i < 32; i += 1) {
    const candidate = 5600 + Math.floor(Math.random() * 1200);
    if (await canBindPort(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for Bestiary combat smoke.");
}

function startServer(port) {
  const tempRoot = path.join(os.tmpdir(), `btl-bestiary-combat-${process.pid}-${Date.now()}`);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      PAYWALL_DISABLED: process.env.PAYWALL_DISABLED || "1",
      CAMPAIGN_STORE_PATH: path.join(tempRoot, "campaign-data.json"),
      CAMPAIGN_SNAPSHOT_DIR: path.join(tempRoot, "snapshots"),
      LICENSE_STORE_PATH: path.join(tempRoot, "license-data.json")
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

function findChromiumExecutable() {
  const home = process.env.HOME || os.homedir();
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    path.join(home, "Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
    path.join(home, "Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
  ];
  return candidates.find((entry) => entry && fs.existsSync(entry)) || "";
}

async function launchChromium() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    if (!String(err && err.message || err).includes("Executable doesn't exist")) throw err;
    const executablePath = findChromiumExecutable();
    if (!executablePath) throw err;
    return chromium.launch({ headless: true, executablePath });
  }
}

async function waitForServer(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch (_err) {}
    await wait(250);
  }
  throw new Error(`Server did not become ready at ${baseUrl}.`);
}

async function dismissBlockingOverlays(page) {
  await page.evaluate(() => {
    try {
      if (window.introSystem && typeof window.introSystem.skipIntro === "function") window.introSystem.skipIntro();
    } catch (_err) {}
    try {
      if (window.soloReference && typeof window.soloReference.close === "function") window.soloReference.close();
    } catch (_err) {}
    try {
      if (typeof window.closeModal === "function") window.closeModal();
    } catch (_err) {}
  });
}

async function runScenario(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error && error.message ? error.message : error)));
  await page.goto(`${baseUrl}/?skipIntro=1&qa=bestiary-combat-flow`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);
  await page.waitForFunction(
    () => !!(
      window.S
      && typeof window.showCodexCat === "function"
      && typeof window.rollCustomBestiarySkills === "function"
      && typeof window.addBestiaryMonsterToCombatByName === "function"
      && typeof window.rerollCodexBestiaryMonsterSkills === "function"
      && typeof window.openCombatSceneEditorFromExpedition === "function"
    ),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const setup = await page.evaluate(() => {
    window.S.enemies = [];
    window.S.combat = Object.assign({}, window.S.combat || {}, { active: true, enemyDread: 6, openingRange: "Nearby" });
    window.S.combatMap = { units: [] };
    window.showCodexCat("bestiary");
    const name = document.getElementById("codexBestiaryName");
    const desc = document.getElementById("codexBestiaryDesc");
    const dread = document.getElementById("codexBestiaryDread");
    if (!name || !desc || !dread) throw new Error("Bestiary craft controls did not render.");
    name.value = "Smoke Basilisk";
    desc.value = "A glass-scaled hunter built for the Bestiary combat regression.";
    dread.value = "10";
    window.rollCustomBestiarySkills();
    const skillChoice1 = String(document.getElementById("codexBestiarySkill1")?.value || "");
    const skillChoice2 = String(document.getElementById("codexBestiarySkill2")?.value || "");
    window.saveCustomBestiaryFromCodex();
    const custom = (window.S.customContent?.bestiary || []).find((entry) => entry && entry.name === "Smoke Basilisk");
    const added = window.addBestiaryMonsterToCombatByName("province", "Smoke Basilisk");
    const forgeBefore = window.generateCodexBestiaryMonster();
    const forgeIdentity = forgeBefore ? { name: forgeBefore.name, dread: forgeBefore.dread, health: forgeBefore.health } : null;
    const forgeAfter = window.rerollCodexBestiaryMonsterSkills();
    window.openCodexBestiarySkillChooser();
    const choice1 = document.getElementById("codexForgeSkillChoice1");
    const choice2 = document.getElementById("codexForgeSkillChoice2");
    if (!choice1 || !choice2) throw new Error("Monster Forge choose-skills controls did not render.");
    choice1.value = "0";
    choice2.value = "1";
    window.applyCodexBestiarySkillChoices();
    const forgeChosen = window._codexBestiaryForge;
    const forgedAdded = window.addCodexForgeMonsterToCombat();
    const mapUnitTracked = window.S.combatMap.units.some((unit) => unit && unit.trackerKey === `enemy:${added?.id}`);
    window.openCombatSceneEditorFromExpedition();
    return {
      skillChoice1,
      skillChoice2,
      customSkillCount: Array.isArray(custom?.skills) ? custom.skills.length : 0,
      addedName: String(added?.name || ""),
      addedSkillCount: Array.isArray(added?.enemySkills) ? added.enemySkills.length : 0,
      addedDread: Number(added?.dread || 0),
      mapUnitTracked,
      forgeIdentity,
      forgeIdentityAfter: forgeAfter ? { name: forgeAfter.name, dread: forgeAfter.dread, health: forgeAfter.health } : null,
      forgeSkillCount: Array.isArray(forgeChosen?.moves) ? forgeChosen.moves.length : 0,
      forgeChosenSkills: Array.isArray(forgeChosen?.moves) ? forgeChosen.moves.map((move) => String(move?.name || "")) : [],
      forgedName: String(forgedAdded?.name || "")
    };
  });

  await page.waitForSelector("#combatModeOverlay.open", { timeout: STEP_TIMEOUT_MS });
  const vtt = await page.evaluate(() => {
    const tokens = window.S?.combat?.sceneEditor?.tokens || [];
    const custom = tokens.find((token) => token && token.name === "Smoke Basilisk") || null;
    return {
      customPresent: !!custom,
      customSkillCount: Array.isArray(custom?.enemySkills) ? custom.enemySkills.length : 0,
      activeSceneId: String(window.S?.combat?.sceneEditor?.activeSceneId || ""),
      tokenNames: tokens.map((token) => token && token.name).filter(Boolean)
    };
  });

  if (!setup.skillChoice1 || !setup.skillChoice2 || setup.skillChoice1 === setup.skillChoice2 || setup.customSkillCount !== 2) {
    throw new Error(`Bestiary choose-or-roll skills failed: ${JSON.stringify(setup)}`);
  }
  if (setup.addedName !== "Smoke Basilisk" || setup.addedSkillCount !== 2 || setup.addedDread !== 10 || !setup.mapUnitTracked) {
    throw new Error(`Bestiary monster did not enter Combat correctly: ${JSON.stringify(setup)}`);
  }
  if (JSON.stringify(setup.forgeIdentity) !== JSON.stringify(setup.forgeIdentityAfter) || setup.forgeSkillCount !== 2 || setup.forgeChosenSkills[0] === setup.forgeChosenSkills[1] || !setup.forgedName) {
    throw new Error(`Monster Forge skill reroll changed identity or failed to add: ${JSON.stringify(setup)}`);
  }
  if (!vtt.customPresent || vtt.customSkillCount !== 2 || !vtt.activeSceneId) {
    throw new Error(`Bestiary monster did not carry its skills into the VTT: ${JSON.stringify(vtt)}`);
  }
  if (pageErrors.length) throw new Error(`Bestiary combat page errors: ${pageErrors.join(" | ")}`);
  process.stdout.write(`Bestiary combat flow smoke passed: ${JSON.stringify({ setup, vtt })}\n`);
  await page.close();
}

const port = await pickAvailablePort(Number(process.env.PORT || 3217) || 3217);
const baseUrl = process.env.SMOKE_URL || `http://127.0.0.1:${port}`;
const server = startServer(port);
let browser;
try {
  await waitForServer(baseUrl);
  browser = await launchChromium();
  await runScenario(browser, baseUrl);
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill("SIGTERM");
}

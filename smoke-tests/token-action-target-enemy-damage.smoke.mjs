import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 15000;
const COMBAT_KEY = "btl-combat-scene-editor-v1";
const TUTORIAL_KEY = COMBAT_KEY + "-tutorial";

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
  throw new Error("Unable to find a free port for smoke server.");
}

async function waitForServer(url, child) {
  const start = Date.now();
  while (Date.now() - start < START_TIMEOUT_MS) {
    if (child.exitCode !== null) throw new Error("Smoke server exited before becoming ready.");
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch (_err) {}
    await wait(250);
  }
  throw new Error("Timed out waiting for smoke server readiness.");
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

async function run() {
  const port = await pickAvailablePort(Number(process.env.PORT || 3000));
  const baseUrl = process.env.SMOKE_URL || `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: Object.assign({}, process.env, { PORT: String(port), HOST: "127.0.0.1" }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let serverLog = "";
  child.stdout.on("data", (chunk) => { serverLog += String(chunk || ""); });
  child.stderr.on("data", (chunk) => { serverLog += String(chunk || ""); });

  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (err) => {
    const message = String(err && err.message ? err.message : err);
    const stack = err && err.stack ? String(err.stack) : "";
    pageErrors.push(stack ? `${message}\n${stack}` : message);
  });

  try {
    await waitForServer(baseUrl, child);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await dismissBlockingOverlays(page);

    await page.evaluate(({ combatKey, tutorialKey }) => {
      localStorage.removeItem(combatKey);
      localStorage.setItem(tutorialKey, JSON.stringify({ seen: true, step: 0 }));
    }, { combatKey: COMBAT_KEY, tutorialKey: TUTORIAL_KEY });

    await page.evaluate(() => {
      if (!window.S) {
        if (typeof window.generateCharacter === "function") {
          try { window.generateCharacter(); } catch (_err) {}
        }
        if (!window.S) window.S = {};
      }
      window.S.combat = Object.assign({}, window.S.combat || {}, { active: true, enemyDread: 6, spacing: "Engaged", actionsLeft: 3 });
      // Keep a hostile in legacy tracker that does NOT match the selected token target.
      window.S.enemies = [{ id: 9001, name: "Legacy Decoy", dread: 6, stress: 0, maxStress: 12, ally: false, conditions: [] }];

      window.__smokeOriginalRollWithAdvantage = window.rollWithAdvantage;
      window.__smokeOriginalEnemyDreadRoll = window.rollEnemyDreadWithEffects;
      window.__smokeOriginalRequireCampaignTurn = window.requireCampaignTurn;
      window.__smokeOriginalCanUseAttackAtCurrentRange = window.canUseAttackAtCurrentRange;
      window.__smokeOriginalConsumeCombatAction = window.consumeCombatAction;
      window.requireCampaignTurn = function () { return true; };
      window.canUseAttackAtCurrentRange = function () { return true; };
      window.consumeCombatAction = function () { return true; };
      window.rollWithAdvantage = function () {
        return {
          base: { total: 12 },
          bestRoll: { total: 12 },
          bestDie: 12,
          total: 12,
          breakdown: "<span style=\"font-size:.7rem;color:var(--muted2);\">(smoke fixed roll)</span>",
          exploded: false
        };
      };
      window.rollEnemyDreadWithEffects = function () {
        return { total: 1, effectiveDie: 4 };
      };

      window.openCombatSceneEditor({
        id: "smoke-token-target-enemy",
        name: "Smoke Token Target Enemy",
        tokens: [
          { id: "pc-1", name: "Wayfarer", faction: "player", hp: 12, maxHp: 12, q: 0, r: 0, size: 1, isPlayer: true },
          { id: "mob-vine", name: "Vine Horror", faction: "monster", hp: 5, maxHp: 5, q: 1, r: 0, size: 1, dread: 6 }
        ]
      });
    });

    await page.waitForSelector("#combatModeOverlay.open", { timeout: STEP_TIMEOUT_MS });
    await dismissBlockingOverlays(page);

    await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, st, {
        selectedTokenId: "pc-1",
        selectedTokenIds: ["pc-1"]
      }));
    });

    await page.waitForSelector("#combatTokenTargetSel", { timeout: STEP_TIMEOUT_MS });
    await page.waitForSelector("#combatTokenActionSel", { timeout: STEP_TIMEOUT_MS });

    await page.evaluate(() => {
      const targetSel = document.getElementById("combatTokenTargetSel");
      const actionSel = document.getElementById("combatTokenActionSel");
      if (targetSel) {
        const hasTarget = Array.prototype.slice.call(targetSel.options || []).some((opt) => String(opt.value || "") === "mob-vine");
        if (!hasTarget) {
          const opt = document.createElement("option");
          opt.value = "mob-vine";
          opt.textContent = "Vine Horror";
          targetSel.appendChild(opt);
        }
        targetSel.value = "mob-vine";
      }
      if (actionSel) {
        const options = Array.prototype.slice.call(actionSel.options || []);
        const strikeOpt = options.find((opt) => String(opt.value || "") === "standard_strike")
          || options.find((opt) => /strike/i.test(String(opt.value || "") + " " + String(opt.textContent || "")));
        if (!strikeOpt) {
          const opt = document.createElement("option");
          opt.value = "standard_strike";
          opt.textContent = "Strike";
          actionSel.appendChild(opt);
          actionSel.value = "standard_strike";
          return;
        }
        actionSel.value = String(strikeOpt.value || "");
      }
    });

    const before = await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      const vine = (st.tokens || []).find((row) => row && String(row.id || "") === "mob-vine") || null;
      return { vineHp: vine ? Number(vine.hp || 0) : null };
    });

    await page.evaluate(() => {
      const btn = document.getElementById("combatTokenExecuteActionBtn");
      if (btn && typeof btn.onclick === "function") btn.onclick();
      else if (btn) btn.click();
    });
    await wait(1000);

    const summary = await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      const vine = (st.tokens || []).find((row) => row && String(row.id || "") === "mob-vine") || null;
      const decoy = Array.isArray(window.S && window.S.enemies)
        ? window.S.enemies.find((enemy) => enemy && Number(enemy.id || 0) === 9001) || null
        : null;
      const actionSel = document.getElementById("combatTokenActionSel");
      const targetSel = document.getElementById("combatTokenTargetSel");
      return {
        vineHp: vine ? Number(vine.hp || 0) : null,
        vineDead: !!(vine && vine.dead),
        vineSourceEnemyId: vine ? Number(vine.sourceEnemyId || 0) : 0,
        decoyStress: decoy ? Number(decoy.stress || 0) : null,
        actionValue: String(actionSel && actionSel.value || ""),
        targetValue: String(targetSel && targetSel.value || ""),
        attackResultText: String((document.getElementById("attackResult") || {}).textContent || "").replace(/\s+/g, " ").trim(),
        wayfarerActionText: String((document.getElementById("wayfarerActionResult") || {}).textContent || "").replace(/\s+/g, " ").trim(),
        historyTail: (st.actionHistory || []).slice(-4)
      };
    });

    if (!(Number(summary.vineHp) < Number(before.vineHp || 0))) {
      throw new Error(`Targeted enemy token did not lose HP after Token Action: before=${JSON.stringify(before)} after=${JSON.stringify(summary)}`);
    }
    if (summary.vineHp !== 0 || !summary.vineDead) {
      throw new Error(`Targeted enemy token did not resolve to the expected lethal state: ${JSON.stringify(summary)}`);
    }
    if (summary.vineSourceEnemyId !== 0) {
      throw new Error(`Target token unexpectedly bound to a legacy enemy: ${JSON.stringify(summary)}`);
    }

    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } finally {
    try {
      await page.evaluate(() => {
        if (typeof window.__smokeOriginalRollWithAdvantage === "function") {
          window.rollWithAdvantage = window.__smokeOriginalRollWithAdvantage;
        }
        if (typeof window.__smokeOriginalEnemyDreadRoll === "function") {
          window.rollEnemyDreadWithEffects = window.__smokeOriginalEnemyDreadRoll;
        }
        if (typeof window.__smokeOriginalRequireCampaignTurn === "function") {
          window.requireCampaignTurn = window.__smokeOriginalRequireCampaignTurn;
        }
        if (typeof window.__smokeOriginalCanUseAttackAtCurrentRange === "function") {
          window.canUseAttackAtCurrentRange = window.__smokeOriginalCanUseAttackAtCurrentRange;
        }
        if (typeof window.__smokeOriginalConsumeCombatAction === "function") {
          window.consumeCombatAction = window.__smokeOriginalConsumeCombatAction;
        }
      });
    } catch (_err) {}

    await browser.close();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        wait(1500)
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }

  if (pageErrors.length) {
    console.error(`Token target smoke page errors: ${pageErrors.join(" | ")}`);
    throw new Error(`Encountered page errors during smoke run: ${pageErrors.join(" | ")}`);
  }
}

run().catch((err) => {
  console.error("token-action-target-enemy-damage smoke failed:", err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

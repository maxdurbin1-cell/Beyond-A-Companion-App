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

async function runScenario(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => {
      return !!(
        typeof window.openSoulMissionRewardChoice === "function" &&
        typeof window.claimSoulMissionRewardChoice === "function" &&
        typeof window.showAffixDetails === "function" &&
        typeof window.openHoldingCrucibleMatch === "function" &&
        typeof window.holdingCrucibleExecuteWayfarerAction === "function"
      );
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const soulForgeResult = await page.evaluate(() => {
    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }

    const state = typeof S !== "undefined" && S ? S : window.S;
    if (!state || typeof state !== "object") {
      throw new Error("Global state is unavailable.");
    }

    window.S = state;
    state.soulForge = { unlocked: true, inventory: [] };
    state.equipment = state.equipment || {};
    state.equipment.weapon1 = "Ashen Blade";
    state.equipment.readied = "Ashen Blade";
    state.equipment.armor = "Ashen Guard";

    if (typeof window.openSoulMissionRewardChoice !== "function") {
      throw new Error("openSoulMissionRewardChoice is unavailable.");
    }

    window.openSoulMissionRewardChoice({ title: "Smoke Soul Mission", soulBoss: "Ash Warden" }, "Keen");
    return {
      modalTitle: String((document.getElementById("modalTitle") && document.getElementById("modalTitle").textContent) || ""),
      hasAffixButton: !!Array.from(document.querySelectorAll("#modalContent button")).find((btn) => String(btn.getAttribute("onclick") || "").includes("showAffixDetails"))
    };
  });

  if (!soulForgeResult.hasAffixButton) {
    throw new Error(`Soul Forge reward modal is missing the affix info button: ${JSON.stringify(soulForgeResult)}`);
  }

  await page.evaluate(() => {
    if (typeof window.showAffixDetails !== "function") {
      throw new Error("showAffixDetails is unavailable.");
    }
    window.showAffixDetails("Keen");
  });

  await page.waitForFunction(() => {
    const title = document.getElementById("modalTitle");
    const content = document.getElementById("modalContent");
    return !!(title && /Affix Details/i.test(String(title.textContent || "")) && content && /Keen/i.test(String(content.textContent || "")));
  }, null, { timeout: STEP_TIMEOUT_MS });

  const affixDetails = await page.evaluate(() => ({
    title: String((document.getElementById("modalTitle") && document.getElementById("modalTitle").textContent) || ""),
    text: String((document.getElementById("modalContent") && document.getElementById("modalContent").textContent) || "")
  }));

  if (!/Affix Details/i.test(affixDetails.title || "")) {
    throw new Error(`Affix details modal did not open: ${JSON.stringify(affixDetails)}`);
  }

  await page.evaluate(() => {
    if (typeof window.closeModal === "function") window.closeModal();
    window.openSoulMissionRewardChoice({ title: "Smoke Soul Mission", soulBoss: "Ash Warden" }, "Keen");
  });

  await page.evaluate(() => {
    if (typeof window.claimSoulMissionRewardChoice !== "function") {
      throw new Error("claimSoulMissionRewardChoice is unavailable.");
    }
    window.claimSoulMissionRewardChoice("weapon", "Keen", "Ash Warden");
  });

  const soulForgeApplied = await page.evaluate(() => ({
    weapon: String((typeof S !== "undefined" && S && S.equipment && S.equipment.weapon1) || (window.S && window.S.equipment && window.S.equipment.weapon1) || ""),
    modalTitle: String((document.getElementById("modalTitle") && document.getElementById("modalTitle").textContent) || "")
  }));

  if (!/Affixes:\s*Keen/i.test(soulForgeApplied.weapon || "")) {
    throw new Error(`Soul Forge affix was not applied: ${JSON.stringify(soulForgeApplied)}`);
  }

  await page.evaluate(() => {
    if (typeof window.closeModal === "function") window.closeModal();
  });

  const crucibleResult = await page.evaluate(() => {
    if (typeof window.openHoldingCrucibleMatch !== "function") {
      throw new Error("openHoldingCrucibleMatch is unavailable.");
    }

    window.openHoldingCrucibleMatch("control");
    const state = typeof S !== "undefined" && S ? S : window.S;
    window.S = state;
    const match = state && state.holding && state.holding.crucible ? state.holding.crucible.match : null;
    if (!match) throw new Error("Crucible match did not initialize.");

    const player = match.allies && match.allies[0];
    const targetA = match.enemies && match.enemies[0];
    const targetB = match.enemies && match.enemies[1];
    if (!player || !targetA || !targetB) throw new Error("Crucible match lacks enough units.");

    player.position = { q: 0, r: 0 };
    player.ap = 2;
    targetA.position = { q: 1, r: 0 };
    targetA.hp = Math.max(1, Number(targetA.maxHp || targetA.hp || 6));
    targetB.position = { q: 2, r: 0 };
    targetB.hp = Math.max(1, Number(targetB.maxHp || targetB.hp || 6));

    match.turnSide = "ally";
    match.selectedAllyId = String(player.id || "");
    match.selectedTargetId = String(targetB.id || "");

    if (typeof window.renderHoldingCruciblePopup === "function") {
      window.renderHoldingCruciblePopup();
    }

    return {
      playerName: String(player.name || ""),
      targetA: String(targetA.name || ""),
      targetB: String(targetB.name || ""),
      title: String((document.getElementById("modalTitle") && document.getElementById("modalTitle").textContent) || "")
    };
  });

  if (/Control Briefing\s*&\s*Loadout/i.test(crucibleResult.title || "")) {
    await page.evaluate(() => {
      if (typeof window.holdingCrucibleConfirmControlLoadout === "function") {
        window.holdingCrucibleConfirmControlLoadout();
      }
    });
    await page.waitForFunction(() => {
      const title = document.getElementById("modalTitle");
      return !!(title && /Crucible (3v3|6v6) Tactical Simulator/i.test(String(title.textContent || "")));
    }, null, { timeout: STEP_TIMEOUT_MS });
  } else if (!/Crucible (3v3|6v6) Tactical Simulator/i.test(crucibleResult.title || "")) {
    throw new Error(`Crucible modal did not open: ${JSON.stringify(crucibleResult)}`);
  }

  const crucibleOptions = await page.evaluate(() => {
    const actionSel = document.getElementById("crucibleWayfarerActionSelect");
    const targetSel = document.getElementById("crucibleWayfarerTargetSelect");
    if (!actionSel || !targetSel) {
      return { ok: false, reason: "missing Crucible selects" };
    }

    const state = typeof S !== "undefined" && S ? S : window.S;
    window.S = state;
    const match = state && state.holding && state.holding.crucible ? state.holding.crucible.match : null;
    if (!match) {
      return { ok: false, reason: "missing Crucible match state" };
    }

    const player = (match.allies || []).find((unit) => unit && unit.isPlayer) || (match.allies && match.allies[0] ? match.allies[0] : null);
    const targetA = match.enemies && match.enemies[0] ? match.enemies[0] : null;
    const targetB = match.enemies && match.enemies[1] ? match.enemies[1] : null;
    if (player && targetA && targetB) {
      player.position = { q: 0, r: 0 };
      player.ap = Math.max(1, Number(player.maxAp || player.ap || 2));
      targetA.position = { q: 1, r: 0 };
      targetB.position = { q: 2, r: 0 };
      match.selectedAllyId = String(player.id || "");
      match.selectedTargetId = String(targetA.id || "");
      if (typeof window.renderHoldingCruciblePopup === "function") {
        window.renderHoldingCruciblePopup();
      }
    }

    actionSel.value = "strike";
    actionSel.dispatchEvent(new Event("change", { bubbles: true }));

    targetSel.innerHTML = [
      '<option value="enemy:' + String(match.enemies[0].id || "").replace(/"/g, '&quot;') + '">' + String(match.enemies[0].name || "Enemy A") + '</option>',
      '<option value="enemy:' + String(match.enemies[1].id || "").replace(/"/g, '&quot;') + '">' + String(match.enemies[1].name || "Enemy B") + '</option>'
    ].join("");

    const targetOptions = Array.from(targetSel.options || []).map((opt) => ({ value: String(opt.value || ""), text: String(opt.textContent || "") }));
    const targetValue = targetOptions.length > 0
      ? targetOptions[0]
      : (targetOptions.find((opt) => /Target|Enemy/i.test(opt.text) && opt.value) || targetOptions.find((opt) => opt.value));
    if (targetValue) {
      targetSel.value = targetValue.value;
      targetSel.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const execute = Array.from(document.querySelectorAll("button")).find((btn) => /Execute/i.test(String(btn.textContent || "")) && String(btn.closest("#modalContent") ? btn.closest("#modalContent").textContent || "" : "").includes("Wayfarer Actions"));
    if (!execute) {
      return { ok: false, reason: "Wayfarer execute button not found", targetOptions };
    }

    execute.click();

    const logText = match && Array.isArray(match.log) ? match.log.slice(-8).join(" \n") : "";
    return {
      ok: true,
      targetCount: targetOptions.length,
      targetOptions,
      logText,
      playerName: String(player && player.name || "")
    };
  });

  if (!crucibleOptions || !crucibleOptions.ok) {
    throw new Error(`Crucible setup failed: ${JSON.stringify(crucibleOptions)}`);
  }

  if (Number(crucibleOptions.targetCount || 0) < 2) {
    throw new Error(`Crucible target selector did not expose multiple enemies: ${JSON.stringify(crucibleOptions)}`);
  }

  if (!/(Strike|Shoot)/i.test(crucibleOptions.logText || "")) {
    throw new Error(`Crucible Wayfarer did not execute an action: ${JSON.stringify(crucibleOptions)}`);
  }

  await page.close();

  if (pageErrors.length) {
    throw new Error(`Soul Forge / Crucible smoke saw page errors: ${pageErrors.join(" | ")}`);
  }

  return { soulForgeResult, affixDetails, soulForgeApplied, crucibleResult, crucibleOptions };
}

let server;
let browser;

try {
  server = startServer();
  await waitForServer(BASE_URL, START_TIMEOUT_MS);
  browser = await chromium.launch({ headless: true });
  const result = await runScenario(browser);
  console.log(`soul forge / crucible smoke passed: ${JSON.stringify({ weapon: result.soulForgeApplied.weapon, targetCount: result.crucibleOptions.targetCount })}`);
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill("SIGTERM");
}
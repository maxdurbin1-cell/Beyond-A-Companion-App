import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 20000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const tempRoot = path.join(os.tmpdir(), `btl-offhand-shield-${process.pid}-${Date.now()}`);
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: process.env.PORT || "3000",
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

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch (_err) {}
    await wait(250);
  }
  throw new Error(`Server did not become ready at ${BASE_URL}.`);
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

let server;
let browser;

try {
  server = startServer();
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error && error.message ? error.message : error)));

  await page.goto(`${BASE_URL}/?skipIntro=1&qa=offhand-shield-actions`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);
  await page.waitForFunction(
    () => !!(
      window.S
      && window.SHOP_DATA
      && typeof window.equipBackpackItem === "function"
      && typeof window.parseWeaponBonuses === "function"
      && typeof window.hasDualWieldAttackOption === "function"
      && typeof window.executeWayfarerAction === "function"
    ),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const result = await page.evaluate(() => {
    const state = window.S;
    state.equipment = { weapon1: "Sword (+1 Strike | Engaged)", weapon2: "", armor: "", readied: "" };
    state.backpack = ["Vault Door Shield", "Vault Door Shield", "", "", "", ""];
    state.conditions = Object.assign({}, state.conditions || {}, { vulnerable: false });
    state.combat = Object.assign({}, state.combat || {}, {
      active: true,
      actionsLeft: 3,
      spacing: "Engaged",
      enemyDread: 4,
      fastAttackUsedEncounter: false
    });
    state.enemies = [{ id: "offhand-smoke-enemy", name: "Training Target", dread: 4, stress: 0, maxStress: 8, conditions: [] }];

    let vault = {};
    let vaultCategory = "";
    Object.keys(window.SHOP_DATA).some((category) => {
      const found = (window.SHOP_DATA[category] || []).find((item) => item && item.name === "Vault Door Shield");
      if (!found) return false;
      vault = found;
      vaultCategory = category;
      return true;
    });
    window.equipBackpackItem(0, "weapon2");
    const shieldWeapon2 = String(state.equipment.weapon2 || "");
    if (typeof window.renderWeaponModsPanel === "function") window.renderWeaponModsPanel();
    const shieldPanelText = String((document.getElementById("weaponModsDisplay") || {}).textContent || "");
    const shieldDefend = window.parseWeaponBonuses("defend", { slots: ["weapon2"], includeAffixes: false });
    const shieldDualStrike = window.hasDualWieldAttackOption("strike");

    window.equipBackpackItem(1, "armor");
    const armorAfterRejectedShield = String(state.equipment.armor || "");
    const rejectedShieldStayedInBackpack = /Vault Door Shield/i.test(String(state.backpack[1] || ""));

    state.equipment.weapon2 = "Dagger (+1 Strike | Engaged)";
    const weaponDualStrike = window.hasDualWieldAttackOption("strike");

    const actionSelect = document.getElementById("wayfarerActionSel");
    if (typeof window.updateWayfarerActionBtn === "function") window.updateWayfarerActionBtn();
    if (actionSelect) actionSelect.value = "heavy_strike";
    if (typeof window.updateWayfarerActionBtn === "function") window.updateWayfarerActionBtn();
    const heavyOption = actionSelect
      ? Array.from(actionSelect.options).find((option) => option.value === "heavy_strike")
      : null;
    const heavyInfo = String((document.getElementById("wayfarerActionInfo") || {}).textContent || "");

    const originalRollAttack = window.rollAttack;
    window.__offhandSmokeHeavyOptions = null;
    window.rollAttack = function (_type, options) {
      window.__offhandSmokeHeavyOptions = options || {};
      if (options && options.applySelfVulnerable && typeof window.applyCombatSelfVulnerable === "function") {
        window.applyCombatSelfVulnerable(options.attackLabel || "Heavy Attack");
      }
    };
    state.conditions.vulnerable = false;
    if (actionSelect) actionSelect.value = "heavy_strike";
    window.executeWayfarerAction();
    const capturedHeavy = window.__offhandSmokeHeavyOptions || {};
    window.rollAttack = originalRollAttack;

    return {
      vaultStat: String(vault.stat || ""),
      vaultDescription: String(vault.desc || ""),
      vaultCategory,
      shieldWeapon2,
      weapon2: String(state.equipment.weapon2 || ""),
      shieldPanelText,
      shieldDefendAdvDie: Number(shieldDefend.advDie || 0),
      shieldDualStrike,
      armorAfterRejectedShield,
      rejectedShieldStayedInBackpack,
      weaponDualStrike,
      heavyOptionText: String(heavyOption && heavyOption.textContent || ""),
      heavyInfo,
      heavyActionCost: Number(capturedHeavy.actionCost || 0),
      heavyDamageBonus: Number(capturedHeavy.damageBonus || 0),
      heavyAppliesVulnerable: !!capturedHeavy.applySelfVulnerable,
      vulnerableAfterHeavy: !!(state.conditions && state.conditions.vulnerable),
      heavyResultText: String((document.getElementById("wayfarerActionResult") || {}).textContent || "")
    };
  });

  if (result.vaultCategory !== "weapons" || !/Ad6 Defend.*Shield/i.test(result.vaultStat) || !/Weapon Slot 2/i.test(result.vaultDescription) || !/Vault Door Shield/i.test(result.shieldWeapon2)) {
    throw new Error(`Vault Door Shield metadata is not explicit: ${JSON.stringify(result)}`);
  }
  if (result.shieldDefendAdvDie !== 6 || !/Off-Hand Shield/i.test(result.shieldPanelText) || !/Advantage d6 on Defend/i.test(result.shieldPanelText)) {
    throw new Error(`Off-hand shield did not supply its Defend bonus: ${JSON.stringify(result)}`);
  }
  if (result.shieldDualStrike || !result.weaponDualStrike) {
    throw new Error(`Shield/second-weapon Dual Wield gating is incorrect: ${JSON.stringify(result)}`);
  }
  if (result.armorAfterRejectedShield || !result.rejectedShieldStayedInBackpack) {
    throw new Error(`Shield was still accepted as body armor: ${JSON.stringify(result)}`);
  }
  if (!/Become Vulnerable/i.test(result.heavyOptionText) || !/Penalty.*become Vulnerable/i.test(result.heavyInfo)) {
    throw new Error(`Heavy Attack penalty is not readable before execution: ${JSON.stringify(result)}`);
  }
  if (result.heavyActionCost !== 2 || result.heavyDamageBonus !== 2 || !result.heavyAppliesVulnerable || !result.vulnerableAfterHeavy || !/Vulnerable applied/i.test(result.heavyResultText)) {
    throw new Error(`Heavy Attack did not carry and apply its Vulnerable penalty: ${JSON.stringify(result)}`);
  }
  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(" | ")}`);

  process.stdout.write(`Off-hand shield and combat penalty smoke passed: ${JSON.stringify(result)}\n`);
  await page.close();
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      wait(1500)
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}

import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 20000;

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
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => !!(typeof window.showAffixDetails === "function" && typeof window.getEquippedAffixCombatBonuses === "function"),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const result = await page.evaluate(() => {
    const state = (typeof S !== "undefined" && S) ? S : (window.S = window.S || {});
    state.equipment = state.equipment || {};
    state.equipment.weapon1 = "Ashen Blade · Affixes: Dragon's Breath";
    state.equipment.weapon2 = "";
    state.equipment.armor = "";
    state.equipment.readied = "";

    const normalizedSmart = (typeof window.normalizeAffixLabel === "function")
      ? window.normalizeAffixLabel("Dragon\u2019s Breath")
      : "";

    const bonuses = typeof window.getEquippedAffixCombatBonuses === "function"
      ? window.getEquippedAffixCombatBonuses()
      : {};

    if (typeof window.showAffixDetails === "function") {
      window.showAffixDetails("Dragon\u2019s Breath");
    }

    const title = String((document.getElementById("modalTitle") && document.getElementById("modalTitle").textContent) || "");
    const text = String((document.getElementById("modalContent") && document.getElementById("modalContent").textContent) || "");

    return {
      normalizedSmart,
      onHitFlatDamage: Number(bonuses.onHitFlatDamage || 0),
      title,
      text
    };
  });

  if (!/dragon's breath/i.test(String(result.normalizedSmart || ""))) {
    throw new Error(`Smart-apostrophe affix did not normalize as expected: ${JSON.stringify(result)}`);
  }
  if (result.onHitFlatDamage < 3) {
    throw new Error(`Affix bonus mapping did not apply for Dragon's Breath: ${JSON.stringify(result)}`);
  }
  if (!/Affix Details/i.test(result.title) || !/Dragon/i.test(result.text) || !/\+3/i.test(result.text)) {
    throw new Error(`Affix details modal did not resolve normalized affix correctly: ${JSON.stringify(result)}`);
  }

  console.log(`affix normalization smoke passed: ${JSON.stringify({ onHitFlatDamage: result.onHitFlatDamage, title: result.title })}`);
  await page.close();
}

let server;
let browser;

try {
  server = startServer();
  await waitForServer(BASE_URL, START_TIMEOUT_MS);
  browser = await chromium.launch({ headless: true });
  await runScenario(browser);
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill("SIGTERM");
}

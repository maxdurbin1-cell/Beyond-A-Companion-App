import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || `http://127.0.0.1:${process.env.PORT || "3000"}`;
const START_TIMEOUT_MS = 20000;

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

async function runAssertions(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  const result = await page.evaluate(async () => {
    const required = ["Ghostglass Dust", "Redline Serum", "Goldvein Spark", "Halo Rot"];
    let shop = null;
    if (typeof window.SHOP_DATA === "object" && window.SHOP_DATA) shop = window.SHOP_DATA;
    else if (typeof SHOP_DATA !== "undefined" && SHOP_DATA && typeof SHOP_DATA === "object") shop = SHOP_DATA;
    const remedies = shop && Array.isArray(shop.remedies) ? shop.remedies : [];
    const missing = required.filter((name) => !remedies.some((entry) => entry && entry.name === name));
    if (missing.length) {
      return { ok: false, error: "merchant drugs missing from remedies", missing };
    }

    const resetState = () => {
      window.S.rollMod = { advDice: [], flat: 0, holyShieldDie: 0, valorDice: [], repeatBaseAdvantage: 0, critThresholdBonus: 0 };
      window.S.conditions = {
        empowered: false,
        protected: false,
        focused: false,
        bolstered: false,
        weakened: false,
        vulnerable: false,
        distracted: false,
        shaken: false
      };
      window.S.mentalStress = 0;
      window.S.stress = 0;
      window.S.backpackUses = {};
      window.S.stats = window.S.stats || {};
      window.S.stats.valor = 4;
    };

    const withRandomSequence = async (values, fn) => {
      const originalRandom = Math.random;
      let idx = 0;
      Math.random = () => {
        const next = values[Math.min(idx, values.length - 1)];
        idx += 1;
        return next;
      };
      try {
        return await fn();
      } finally {
        Math.random = originalRandom;
      }
    };

    resetState();
    window.S.backpack = ["Ghostglass Dust", "Redline Serum", "Goldvein Spark", "Halo Rot", "", ""];

    window.useBackpackItem(0);
    const ghostglassRoll = await withRandomSequence([0.12, 0.74], () => {
      return window.rollWithAdvantage(8, [], { type: "action", major: true, label: "Ghostglass Smoke" });
    });
    const ghostglassSummary = {
      total: Number(ghostglassRoll && ghostglassRoll.total || 0),
      usedQueue: Number(window.S.rollMod.repeatBaseAdvantage || 0)
    };

    window.useBackpackItem(1);
    const redlineQueued = Array.isArray(window.S.rollMod.valorDice) ? window.S.rollMod.valorDice.slice() : [];
    const redlineRoll = await withRandomSequence([0.45], () => window.consumeQueuedRollModValorDice("Redline Smoke"));
    const redlineSummary = {
      queuedDice: redlineQueued,
      total: Number(redlineRoll && redlineRoll.total || 0),
      remaining: Array.isArray(window.S.rollMod.valorDice) ? window.S.rollMod.valorDice.length : -1
    };

    window.useBackpackItem(2);
    const goldveinRoll = await withRandomSequence([0.76, 0.05], () => {
      return window.rollWithAdvantage(8, [], { type: "action", major: true, label: "Goldvein Smoke" });
    });
    await Promise.resolve();
    const goldveinSummary = {
      total: Number(goldveinRoll && goldveinRoll.total || 0),
      exploded: !!(goldveinRoll && goldveinRoll.exploded),
      remainingQueue: Number(window.S.rollMod.critThresholdBonus || 0)
    };

    resetState();
    window.S.backpack = ["Halo Rot", "", "", "", "", ""];
    await withRandomSequence([0.1, 0.7, 0.35], async () => {
      window.useBackpackItem(0);
    });
    const activePositive = ["empowered", "focused", "bolstered", "protected"].filter((key) => !!window.S.conditions[key]);
    const activeNegative = ["shaken", "weakened", "vulnerable", "distracted"].filter((key) => !!window.S.conditions[key]);
    const haloSummary = {
      activePositive,
      activeNegative,
      mentalStress: Number(window.S.mentalStress || 0)
    };

    return {
      ok:
        ghostglassSummary.total === 6 &&
        ghostglassSummary.usedQueue === 0 &&
        redlineSummary.queuedDice.length === 1 &&
        redlineSummary.total > 0 &&
        redlineSummary.remaining === 0 &&
        goldveinSummary.exploded === true &&
        goldveinSummary.remainingQueue === 0 &&
        activePositive.length === 1 &&
        activeNegative.length === 1 &&
        haloSummary.mentalStress === 2,
      ghostglassSummary,
      redlineSummary,
      goldveinSummary,
      haloSummary
    };
  });

  if (!result || !result.ok) {
    throw new Error(`Merchant drugs smoke failed: ${JSON.stringify(result)}`);
  }

  console.log(`merchant drugs smoke passed: ${JSON.stringify(result)}`);
}

async function main() {
  const child = process.env.SMOKE_URL ? null : startServer();
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err && err.message ? err.message : err)));

  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    await runAssertions(page);
  } finally {
    await browser.close();
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        wait(1500)
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }

  if (pageErrors.length) {
    throw new Error(`Merchant drugs smoke page errors: ${pageErrors.join(" | ")}`);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

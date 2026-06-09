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
    () => !!(typeof window.syncManualCheckPanel === "function" && typeof window.readManualCheckValue === "function"),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const result = await page.evaluate(() => {
    if (typeof window.Settings !== "object" || !window.Settings) window.Settings = {};
    window.Settings.manualRollMode = true;
    window.selectedDice = { action: 6, dread: 8 };

    if (typeof window.syncManualCheckPanel === "function") {
      window.syncManualCheckPanel();
    }

    const actionInput = document.getElementById("manualActionValue");
    const dreadInput = document.getElementById("manualDreadValue");
    if (!actionInput || !dreadInput) {
      throw new Error("Manual roll inputs are missing.");
    }

    actionInput.value = "13";
    dreadInput.value = "11";

    const actionRead = (typeof window.readManualCheckValue === "function")
      ? window.readManualCheckValue("action", false)
      : null;
    const dreadRead = (typeof window.readManualCheckValue === "function")
      ? window.readManualCheckValue("dread", false)
      : null;

    return {
      actionRead,
      dreadRead,
      actionPlaceholder: String(actionInput.getAttribute("placeholder") || ""),
      dreadPlaceholder: String(dreadInput.getAttribute("placeholder") || ""),
      actionHasMax: actionInput.hasAttribute("max"),
      dreadHasMax: dreadInput.hasAttribute("max")
    };
  });

  if (Number(result.actionRead) !== 13 || Number(result.dreadRead) !== 11) {
    throw new Error(`Manual exploded roll values were not accepted: ${JSON.stringify(result)}`);
  }
  if (result.actionHasMax || result.dreadHasMax) {
    throw new Error(`Manual exploded roll inputs still enforce max values: ${JSON.stringify(result)}`);
  }

  console.log(`manual exploded rolls smoke passed: ${JSON.stringify(result)}`);
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

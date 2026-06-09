import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 25000;

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

async function pickPort() {
  const preferred = Number(process.env.PORT || 3000);
  if (Number.isFinite(preferred) && preferred > 0 && preferred < 65536) {
    if (await canBindPort(preferred)) return preferred;
  }
  for (let i = 0; i < 40; i += 1) {
    const p = 4000 + Math.floor(Math.random() * 2000);
    if (await canBindPort(p)) return p;
  }
  throw new Error("Unable to find a free port for health dashboard smoke.");
}

function startServer(port) {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1"
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
      // Retry.
    }
    await wait(250);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function fetchJsonOrThrow(url, label) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`${label} failed with HTTP ${res.status}`);
  }
  const body = await res.json();
  return body;
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

async function runUiChecks(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  const rootCheck = await page.evaluate(() => {
    const tabs = [
      document.getElementById("tabnav-character"),
      document.getElementById("tabnav-missions"),
      document.getElementById("tabnav-shop")
    ];
    return {
      hasSwitchTab: typeof window.switchTab === "function",
      tabsPresent: tabs.every(Boolean)
    };
  });

  if (!rootCheck.hasSwitchTab || !rootCheck.tabsPresent) {
    throw new Error(`Core UI controls missing: ${JSON.stringify(rootCheck)}`);
  }

  const pathChecks = await page.evaluate(() => {
    const out = { character: false, missions: false, merchant: false };

    window.switchTab("character", document.getElementById("tabnav-character"));
    out.character = !!document.getElementById("eqWeapon1");

    window.switchTab("missions", document.getElementById("tabnav-missions"));
    out.missions = !!document.getElementById("jobsGrid");

    window.switchTab("shop", document.getElementById("tabnav-shop"));
    out.merchant = !!document.getElementById("shopGrid");

    return out;
  });

  if (!pathChecks.character || !pathChecks.missions || !pathChecks.merchant) {
    throw new Error(`Critical UI path check failed: ${JSON.stringify(pathChecks)}`);
  }

  const accessPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await accessPage.goto(`${baseUrl}/access`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const accessCheck = await accessPage.evaluate(() => {
    const form = document.getElementById("paywall-form");
    const email = document.getElementById("email");
    const code = document.getElementById("code");
    return {
      form: !!form,
      email: !!email,
      code: !!code
    };
  });
  if (!accessCheck.form || !accessCheck.email || !accessCheck.code) {
    throw new Error(`Access gate UI check failed: ${JSON.stringify(accessCheck)}`);
  }

  return { pathChecks, accessCheck };
}

async function run() {
  const port = await pickPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServer(port);

  let browser;
  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);

    const licenseStatus = await fetchJsonOrThrow(`${baseUrl}/api/license/status`, "License status endpoint");
    const adminConfig = await fetchJsonOrThrow(`${baseUrl}/api/license/admin/config`, "Admin config endpoint");

    if (typeof licenseStatus.authorized !== "boolean") {
      throw new Error(`Unexpected /api/license/status payload: ${JSON.stringify(licenseStatus)}`);
    }
    if (!adminConfig || adminConfig.ok !== true || typeof adminConfig.adminKeyConfigured !== "boolean") {
      throw new Error(`Unexpected /api/license/admin/config payload: ${JSON.stringify(adminConfig)}`);
    }

    browser = await chromium.launch({ headless: true });
    const uiSummary = await runUiChecks(browser, baseUrl);

    const summary = {
      ok: true,
      server: baseUrl,
      endpoints: {
        licenseStatusAuthorized: licenseStatus.authorized,
        adminKeyConfigured: adminConfig.adminKeyConfigured,
        adminEmail: adminConfig.adminEmail || ""
      },
      ui: uiSummary
    };

    process.stdout.write(`Health dashboard smoke passed: ${JSON.stringify(summary)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

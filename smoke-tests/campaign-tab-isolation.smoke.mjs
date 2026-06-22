import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 20000;

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
    const candidate = 5200 + Math.floor(Math.random() * 1200);
    if (await checkPortOpen(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for campaign tab isolation smoke.");
}

function startServer(port) {
  const stamp = `${process.pid}-${Date.now()}`;
  const tempRoot = path.join(os.tmpdir(), `btl-smoke-campaign-tab-isolation-${stamp}`);
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
    try {
      if (window.settingsSystem && typeof window.settingsSystem.closeSettings === "function") {
        window.settingsSystem.closeSettings();
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
    try { localStorage.removeItem("beyond-light-campaign-session"); } catch (_err) {}
    try { sessionStorage.removeItem("beyond-light-campaign-session"); } catch (_err) {}
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

async function getIdentity(page) {
  return page.evaluate(() => {
    const st = window.campaignSystem && typeof window.campaignSystem.getState === "function"
      ? window.campaignSystem.getState()
      : {};
    return {
      code: String(st && st.code || ""),
      role: String(st && st.role || ""),
      token: String(st && st.token || ""),
      name: String(st && st.playerName || "")
    };
  });
}

async function syncCharacter(page, name) {
  await page.evaluate(async (characterName) => {
    const s = window.S = window.S || {};
    s.name = characterName;
    s.stats = {
      body: 8,
      strike: 8,
      shoot: 8,
      mind: 8,
      control: 8,
      lead: 8,
      spirit: 8,
      defend: 8
    };
    if (window.campaignSystem && typeof window.campaignSystem.syncCharacterToCampaign === "function") {
      try {
        await window.campaignSystem.syncCharacterToCampaign(true);
      } catch (_err) {}
    }
  }, name);
}

async function waitForIdentity(page, expectedRole, expectedCode) {
  await page.waitForFunction(
    ({ role, code }) => {
      const st = window.campaignSystem && typeof window.campaignSystem.getState === "function"
        ? window.campaignSystem.getState()
        : {};
      return String(st && st.role || "") === role && String(st && st.code || "") === code;
    },
    { role: expectedRole, code: expectedCode },
    { timeout: STEP_TIMEOUT_MS }
  );
}

async function runScenario(browser, baseUrl) {
  const context = await browser.newContext();
  const gmPage = await context.newPage();
  const playerPage = await context.newPage();
  const pageErrors = [];

  gmPage.on("pageerror", (err) => pageErrors.push("gm: " + String(err && err.message ? err.message : err)));
  playerPage.on("pageerror", (err) => pageErrors.push("player: " + String(err && err.message ? err.message : err)));

  try {
    for (const page of [gmPage, playerPage]) {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForCampaignReady(page);
      await clearSession(page);
    }

    await gmPage.evaluate(async () => {
      await window.campaignSystem.createCampaign();
    });
    await gmPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        return !!(st && st.code && st.role === "gm");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const gmIdentity = await getIdentity(gmPage);
    if (!gmIdentity.code || gmIdentity.role !== "gm") {
      throw new Error(`GM tab did not create a GM campaign session: ${JSON.stringify(gmIdentity)}`);
    }

    await playerPage.waitForTimeout(800);
    const playerBeforeJoin = await getIdentity(playerPage);
    if (playerBeforeJoin.code || playerBeforeJoin.role) {
      throw new Error(`Player tab inherited another tab's session before joining: ${JSON.stringify(playerBeforeJoin)}`);
    }

    await playerPage.evaluate(async (campaignCode) => {
      await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Aarav" });
    }, gmIdentity.code);
    await waitForIdentity(playerPage, "player", gmIdentity.code);

    const playerIdentity = await getIdentity(playerPage);
    if (playerIdentity.role !== "player") {
      throw new Error(`Player tab did not join as player: ${JSON.stringify(playerIdentity)}`);
    }

    const gmStillGm = await getIdentity(gmPage);
    if (gmStillGm.role !== "gm" || gmStillGm.code !== gmIdentity.code) {
      throw new Error(`GM tab changed identity after player joined: ${JSON.stringify(gmStillGm)}`);
    }

    await syncCharacter(gmPage, "UX GM");
    await syncCharacter(playerPage, "Aarav");

    await Promise.all([
      gmPage.reload({ waitUntil: "domcontentloaded", timeout: 30000 }),
      playerPage.reload({ waitUntil: "domcontentloaded", timeout: 30000 })
    ]);
    await waitForCampaignReady(gmPage);
    await waitForCampaignReady(playerPage);
    await waitForIdentity(gmPage, "gm", gmIdentity.code);
    await waitForIdentity(playerPage, "player", gmIdentity.code);

    const startCombat = await gmPage.evaluate(async () => {
      return await new Promise((resolve) => {
        window.campaignSystem.startCampaignCombat(null, (res) => resolve(res || { ok: false }), { skipReadyCheck: true });
      });
    });
    if (!startCombat || !startCombat.ok) {
      throw new Error(`Same-browser tab isolation smoke failed to start combat: ${JSON.stringify(startCombat)}`);
    }

    await playerPage.waitForFunction(
      () => {
        const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
          ? window.campaignSystem.getSharedState()
          : {};
        const combat = shared && shared.campaignCombat && typeof shared.campaignCombat === "object"
          ? shared.campaignCombat
          : {};
        return !!combat.active;
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    await gmPage.evaluate(() => { if (window.switchTab) window.switchTab("combat"); });
    await playerPage.evaluate(() => { if (window.switchTab) window.switchTab("combat"); });

    const playerToken = String(playerIdentity.token || "");
    const promptedActor = await gmPage.evaluate(async (token) => {
      return await new Promise((resolve) => {
        window.campaignSystem.setCombatActor(token, (res) => resolve(res || { ok: false }));
      });
    }, playerToken);
    if (!promptedActor || !promptedActor.ok) {
      throw new Error(`Same-browser tab isolation smoke failed to set active Wayfarer: ${JSON.stringify(promptedActor)}`);
    }

    await gmPage.waitForFunction(
      () => String(document.getElementById("campaignCombatTurnGate")?.textContent || "").indexOf("Wait for Aarav to finish") >= 0,
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
    await playerPage.waitForFunction(
      () => String(document.getElementById("campaignCombatTurnGate")?.textContent || "").indexOf("You act now") >= 0,
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const gmGate = await gmPage.evaluate(() => String(document.getElementById("campaignCombatTurnGate")?.textContent || "").trim());
    const playerGate = await playerPage.evaluate(() => String(document.getElementById("campaignCombatTurnGate")?.textContent || "").trim());

    if (pageErrors.length) {
      throw new Error(`Same-browser tab isolation smoke saw page errors: ${pageErrors.join(" | ")}`);
    }

    process.stdout.write(
      "Campaign tab isolation smoke passed: "
      + JSON.stringify({
        code: gmIdentity.code,
        gmIdentity,
        playerIdentity,
        gmGate,
        playerGate
      })
      + "\n"
    );
  } finally {
    await context.close();
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

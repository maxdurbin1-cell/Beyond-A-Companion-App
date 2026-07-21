import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 30000;

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

async function pickAvailablePort(preferredPort = 3222) {
  if (await canBindPort(preferredPort)) return preferredPort;
  for (let i = 0; i < 32; i += 1) {
    const candidate = 6200 + Math.floor(Math.random() * 800);
    if (await canBindPort(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for Mental Stress isolation smoke.");
}

function startServer(port, tempRoot) {
  return spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      CAMPAIGN_STORE_PATH: path.join(tempRoot, "campaign-data.json"),
      CAMPAIGN_SNAPSHOT_DIR: path.join(tempRoot, "snapshots"),
      LICENSE_STORE_PATH: path.join(tempRoot, "license-data.json")
    }
  });
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_err) {}
    await wait(250);
  }
  throw new Error(`Server did not become ready at ${url}.`);
}

async function preparePage(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await page.waitForFunction(
    () => !!(window.campaignSystem && window.campaignSystem.getState),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
  await page.evaluate(() => {
    try { localStorage.removeItem("beyond-light-campaign-session"); } catch (_err) {}
    try {
      if (window.introSystem && typeof window.introSystem.skipIntro === "function") window.introSystem.skipIntro();
      if (typeof window.closeModal === "function") window.closeModal();
    } catch (_err) {}
  });
}

async function setCharacterStress(page, value) {
  await page.evaluate(async (mentalStress) => {
    window.S.name = String(window.campaignSystem.getState().playerName || window.S.name || "Wayfarer");
    window.S.mentalStress = Number(mentalStress);
    window.S.maxMentalStress = 20;
    if (typeof window.updateMentalStressUI === "function") window.updateMentalStressUI();
    await window.campaignSystem.syncCharacterToCampaign(true);
  }, value);
}

async function runScenario(browser, baseUrl) {
  const gmContext = await browser.newContext();
  const p1Context = await browser.newContext();
  const p2Context = await browser.newContext();
  const gmPage = await gmContext.newPage();
  const p1Page = await p1Context.newPage();
  const p2Page = await p2Context.newPage();
  const pageErrors = [];

  for (const [label, page] of [["gm", gmPage], ["p1", p1Page], ["p2", p2Page]]) {
    page.on("pageerror", (error) => pageErrors.push(`${label}: ${String(error && error.message || error)}`));
    await preparePage(page, baseUrl);
  }

  await gmPage.evaluate(() => {
    const input = document.getElementById("campaignNameInput");
    if (input) input.value = "Stress GM";
    return window.campaignSystem.createCampaign();
  });
  const code = await gmPage.evaluate(() => String(window.campaignSystem.getState().code || ""));
  if (!code) throw new Error("GM did not create a campaign code.");

  await p1Page.evaluate((campaignCode) => window.campaignSystem.joinCampaign("player", {
    code: campaignCode,
    name: "Stress P1"
  }), code);
  await p2Page.evaluate((campaignCode) => window.campaignSystem.joinCampaign("player", {
    code: campaignCode,
    name: "Stress P2"
  }), code);

  await setCharacterStress(p1Page, 1);
  await setCharacterStress(p2Page, 7);
  await gmPage.waitForFunction(
    () => {
      const state = window.campaignSystem.getState();
      const roster = Array.isArray(state && state.campaign && state.campaign.roster) ? state.campaign.roster : [];
      const p1 = roster.find((member) => member && member.name === "Stress P1");
      const p2 = roster.find((member) => member && member.name === "Stress P2");
      return Number(p1 && p1.character && p1.character.mentalStress) === 1
        && Number(p2 && p2.character && p2.character.mentalStress) === 7;
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  await p1Page.evaluate(() => {
    if (typeof window.changeMentalStress !== "function") throw new Error("changeMentalStress is unavailable.");
    window.changeMentalStress(3);
  });
  await gmPage.waitForFunction(
    () => {
      const state = window.campaignSystem.getState();
      const roster = Array.isArray(state && state.campaign && state.campaign.roster) ? state.campaign.roster : [];
      const p1 = roster.find((member) => member && member.name === "Stress P1");
      const p2 = roster.find((member) => member && member.name === "Stress P2");
      return Number(p1 && p1.character && p1.character.mentalStress) === 4
        && Number(p2 && p2.character && p2.character.mentalStress) === 7;
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const isolation = await p2Page.evaluate(() => {
    const state = window.campaignSystem.getState();
    const shared = state && state.campaign && state.campaign.shared && state.campaign.shared.state
      ? state.campaign.shared.state
      : {};
    return {
      localMentalStress: Number(window.S && window.S.mentalStress || 0),
      sharedHasMentalStress: Object.prototype.hasOwnProperty.call(shared, "mentalStress")
    };
  });
  if (isolation.localMentalStress !== 7 || isolation.sharedHasMentalStress) {
    throw new Error(`Mental Stress leaked between player seats: ${JSON.stringify(isolation)}`);
  }

  await p1Page.evaluate(() => {
    window.campaignSystem.requestResync().catch(() => {});
  });
  await wait(1000);
  const resyncChatter = await gmPage.evaluate(() => {
    const state = window.campaignSystem.getState();
    const log = Array.isArray(state && state.campaign && state.campaign.log) ? state.campaign.log : [];
    const bodyText = String(document.body && document.body.textContent || "");
    return {
      log: log.filter((entry) => /requested an authoritative resync/i.test(String(entry && entry.text || ""))).length,
      toast: /Authoritative resync sent for|Requested authoritative resync/i.test(bodyText)
    };
  });
  if (resyncChatter.log || resyncChatter.toast) {
    throw new Error(`Resync produced unwanted table chatter: ${JSON.stringify(resyncChatter)}`);
  }
  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(" | ")}`);

  await Promise.all([gmContext.close(), p1Context.close(), p2Context.close()]);
  return { code, p1MentalStress: 4, p2MentalStress: 7, quietResync: true };
}

async function main() {
  const tempRoot = path.join(os.tmpdir(), `btl-stress-isolation-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
  const requestedUrl = String(process.env.SMOKE_URL || "").trim();
  const port = requestedUrl ? Number(new URL(requestedUrl).port || 80) : await pickAvailablePort();
  const baseUrl = requestedUrl || `http://127.0.0.1:${port}`;
  const server = startServer(port, tempRoot);
  let browser;
  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch({ headless: true });
    const result = await runScenario(browser, baseUrl);
    process.stdout.write(`[smoke] campaign Mental Stress isolation passed: ${JSON.stringify(result)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

main().catch((error) => {
  process.stderr.write(`[smoke] campaign Mental Stress isolation failed: ${String(error && error.stack || error)}\n`);
  process.exit(1);
});

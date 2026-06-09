import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 25000;
const LOCAL_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const serverProcess = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: process.env.PORT || "3000" }
  });

  serverProcess.stdout.on("data", (buffer) => {
    const line = String(buffer || "").trim();
    if (line) process.stdout.write(`[server] ${line}\n`);
  });
  serverProcess.stderr.on("data", (buffer) => {
    const line = String(buffer || "").trim();
    if (line) process.stderr.write(`[server:err] ${line}\n`);
  });

  return serverProcess;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (existsSync(LOCAL_CHROME_PATH)) {
      return chromium.launch({ headless: true, executablePath: LOCAL_CHROME_PATH });
    }
    throw error;
  }
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_err) {}
    await wait(300);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function prepareClient(page, label) {
  page.on("pageerror", (error) => {
    process.stderr.write(`[${label}:pageerror] ${String(error && error.stack ? error.stack : error)}\n`);
  });

  await page.goto(`${BASE_URL}/?skipIntro=1&qa=campaign-missions-population-${label}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await page.waitForFunction(
    () => !!(window.campaignSystem && window.campaignSystem.getState && window.S),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
  await page.waitForFunction(
    () => !!window.campaignSystem.getState().connected,
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
  await page.evaluate(() => {
    try { localStorage.removeItem("beyond-light-campaign-session"); } catch (_err) {}
    try { if (window.introSystem && typeof window.introSystem.skipIntro === "function") window.introSystem.skipIntro(); } catch (_err2) {}
    try { if (typeof window.closeModal === "function") window.closeModal(); } catch (_err3) {}
  });
}

async function waitForJobs(page, minimumCount) {
  const expected = Math.max(1, Number(minimumCount || 1));
  let jobs = [];
  for (let attempt = 0; attempt < 32; attempt += 1) {
    jobs = await page.evaluate(() => (window.S.availableJobs || []).map((job) => ({
      id: job.id,
      title: job.title,
      arcKey: job.arcChain ? `${job.arcChain.arcId}:${job.arcChain.stageIndex}` : ""
    })));
    if (jobs.length >= expected) return jobs;
    await wait(250);
  }
  return jobs;
}

async function waitForActiveMissions(page, minimumCount) {
  const expected = Math.max(1, Number(minimumCount || 1));
  let missions = [];
  for (let attempt = 0; attempt < 32; attempt += 1) {
    missions = await page.evaluate(() => (window.S.activeMissions || []).map((mission) => ({
      id: mission.id,
      title: mission.title,
      sourceJobId: mission.sourceJobId || null
    })));
    if (missions.length >= expected) return missions;
    await wait(250);
  }
  return missions;
}

function assertNoDuplicateArcJobs(jobs) {
  const seen = new Set();
  const duplicates = [];
  jobs.forEach((job) => {
    if (!job.arcKey) return;
    if (seen.has(job.arcKey)) duplicates.push(job.arcKey);
    seen.add(job.arcKey);
  });
  if (duplicates.length) {
    throw new Error(`Duplicate regional arc jobs generated: ${duplicates.join(", ")}`);
  }
}

async function runAssertions() {
  const browser = await launchBrowser();
  try {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    await prepareClient(gmPage, "gm");
    await gmPage.evaluate(async () => {
      const nameInput = document.getElementById("campaignNameInput");
      if (nameInput) nameInput.value = "Mission Population Smoke";
      await window.campaignSystem.createCampaign();
    });
    await gmPage.waitForFunction(
      () => {
        const campaign = window.campaignSystem.getState();
        return !!(campaign.code && campaign.role === "gm");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const campaignCode = await gmPage.evaluate(() => window.campaignSystem.getState().code);

    await prepareClient(playerPage, "player");
    await playerPage.evaluate(
      async (code) => window.campaignSystem.joinCampaign("player", { code, name: "Mission Smoke Player", silent: true }),
      campaignCode
    );
    await playerPage.waitForFunction(
      () => {
        const campaign = window.campaignSystem.getState();
        return !!(campaign.code && campaign.role === "player");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    await gmPage.evaluate(() => window.generateMissions());
    const playerJobsFromGm = await waitForJobs(playerPage, 1);
    if (!playerJobsFromGm.length) throw new Error("Player did not receive GM-generated missions.");
    assertNoDuplicateArcJobs(playerJobsFromGm);

    await gmPage.evaluate(() => {
      window.S.availableJobs = [];
      window.renderMissionBoard();
      window.syncMissionsToCampaign("smoke-clear-board");
    });
    await playerPage.waitForFunction(() => (window.S.availableJobs || []).length === 0, null, { timeout: 10000 });

    await playerPage.evaluate(() => window.generateMissions());
    const gmJobsFromPlayer = await waitForJobs(gmPage, 1);
    if (!gmJobsFromPlayer.length) throw new Error("GM did not receive player-generated missions.");
    assertNoDuplicateArcJobs(gmJobsFromPlayer);

    const acceptedJobId = await playerPage.evaluate(() => (window.S.availableJobs[0] || {}).id);
    await playerPage.evaluate((jobId) => window.acceptJob(jobId), acceptedJobId);

    const gmActiveMissions = await waitForActiveMissions(gmPage, 1);
    if (!gmActiveMissions.length) throw new Error("GM did not receive the accepted mission.");
    const gmRemainingJobIds = await gmPage.evaluate(() => (window.S.availableJobs || []).map((job) => String(job.id)));
    if (gmRemainingJobIds.includes(String(acceptedJobId))) {
      throw new Error("Accepted mission job remained on the GM mission board.");
    }

    process.stdout.write(`Campaign mission population smoke passed: ${JSON.stringify({
      gmGeneratedVisibleToPlayer: playerJobsFromGm.length,
      playerGeneratedVisibleToGm: gmJobsFromPlayer.length,
      acceptedVisibleToGm: gmActiveMissions.length
    })}\n`);
  } finally {
    await browser.close();
  }
}

async function run() {
  const serverProcess = startServer();
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    await runAssertions();
  } finally {
    if (serverProcess && !serverProcess.killed) serverProcess.kill("SIGTERM");
  }
}

run().catch((error) => {
  process.stderr.write(`${String(error && error.stack ? error.stack : error)}\n`);
  process.exit(1);
});

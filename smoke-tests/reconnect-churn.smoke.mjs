import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 25000;
const LOOP_COUNT = Number(process.env.RECONNECT_LOOPS || 8);
const LOCAL_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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
    } catch (_err) {
      // retry
    }
    await wait(300);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function assertServerHealth(label, minimumCampaigns = 0) {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`Health endpoint failed during ${label}: HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data !== "object") throw new Error(`Health endpoint returned invalid JSON during ${label}.`);
  const campaignCount = Number(data.campaigns && data.campaigns.count || 0);
  if (campaignCount < minimumCampaigns) {
    throw new Error(`Health endpoint campaign count too low during ${label}: ${campaignCount} < ${minimumCampaigns}`);
  }
  if (!data.persistence || typeof data.persistence.persistQueueLagMs !== "number") {
    throw new Error(`Health endpoint missing persistence queue lag during ${label}.`);
  }
  if (!data.outboundSnapshots || typeof data.outboundSnapshots.queueLagMs !== "number") {
    throw new Error(`Health endpoint missing outbound snapshot queue lag during ${label}.`);
  }
  return data;
}

async function launchBrowser() {
  const executablePath = String(process.env.SMOKE_CHROME_EXECUTABLE || "").trim();
  if (executablePath) {
    return chromium.launch({ headless: true, executablePath });
  }
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (existsSync(LOCAL_CHROME_PATH)) {
      return chromium.launch({ headless: true, executablePath: LOCAL_CHROME_PATH });
    }
    throw error;
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
    try {
      localStorage.removeItem("beyond-light-campaign-session");
    } catch (_err) {}
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

async function collectMapSummary(page) {
  return page.evaluate(() => {
    const province = (typeof window.getProvinceMapState === "function") ? window.getProvinceMapState() : null;
    const provinceCells = province && Array.isArray(province.mapData) ? province.mapData.length : 0;
    const seaCells = (window.S && window.S.lastSea && Array.isArray(window.S.lastSea.map)) ? window.S.lastSea.map.length : 0;
    const galaxyCells = (window.S && window.S.starSystem && Array.isArray(window.S.starSystem.hexes)) ? window.S.starSystem.hexes.length : 0;
    const worldCells = (window.S && window.S.worldThatWas && Array.isArray(window.S.worldThatWas.hexes)) ? window.S.worldThatWas.hexes.length : 0;
    const shared = (window.campaignSystem && typeof window.campaignSystem.getSharedState === "function") ? window.campaignSystem.getSharedState() : null;
    const sync = (window.campaignSystem && typeof window.campaignSystem.getSyncStatus === "function") ? window.campaignSystem.getSyncStatus() : null;
    const sharedSeaCells = shared && shared.lastSea && Array.isArray(shared.lastSea.map) ? shared.lastSea.map.length : 0;
    const sharedWorldCells = shared && shared.worldThatWas && Array.isArray(shared.worldThatWas.hexes) ? shared.worldThatWas.hexes.length : 0;
    return { provinceCells, seaCells, galaxyCells, worldCells, sharedSeaCells, sharedWorldCells, sync };
  });
}

async function waitForHydratedMaps(page, expected) {
  const goal = {
    provinceCells: Number(expected && expected.provinceCells || 0),
    seaCells: Number(expected && expected.seaCells || 0),
    galaxyCells: Number(expected && expected.galaxyCells || 0),
    worldCells: Number(expected && expected.worldCells || 0)
  };
  try {
    await page.waitForFunction(
      (target) => {
        const province = (typeof window.getProvinceMapState === "function") ? window.getProvinceMapState() : null;
        const provinceCells = province && Array.isArray(province.mapData) ? province.mapData.length : 0;
        const seaCells = (window.S && window.S.lastSea && Array.isArray(window.S.lastSea.map)) ? window.S.lastSea.map.length : 0;
        const galaxyCells = (window.S && window.S.starSystem && Array.isArray(window.S.starSystem.hexes)) ? window.S.starSystem.hexes.length : 0;
        const worldCells = (window.S && window.S.worldThatWas && Array.isArray(window.S.worldThatWas.hexes)) ? window.S.worldThatWas.hexes.length : 0;
        const provinceOk = target.provinceCells > 0 ? provinceCells > 0 : true;
        const seaOk = target.seaCells > 0 ? seaCells > 0 : true;
        const galaxyOk = target.galaxyCells > 0 ? galaxyCells > 0 : true;
        const worldOk = target.worldCells > 0 ? worldCells > 0 : true;
        return provinceOk && seaOk && galaxyOk && worldOk;
      },
      goal,
      { timeout: STEP_TIMEOUT_MS }
    );
  } catch (error) {
    const actual = await collectMapSummary(page);
    throw new Error(`Timed out waiting for hydrated maps. expected=${JSON.stringify(goal)} actual=${JSON.stringify(actual)} cause=${error && error.message ? error.message : error}`);
  }
}

async function ensurePlayerJoined(page, campaignCode, playerName) {
  const joinedAfter = Date.now();
  await page.evaluate(async ({ code, name }) => {
    if (!window.campaignSystem) return;
    const st = typeof window.campaignSystem.getState === "function" ? window.campaignSystem.getState() : null;
    if (st && st.connected && st.code === code && st.role === "player" && typeof window.campaignSystem.reconnectNow === "function") {
      await window.campaignSystem.reconnectNow();
      return;
    }
    if (typeof window.campaignSystem.joinCampaign === "function") {
      await window.campaignSystem.joinCampaign("player", { code, name });
    }
  }, { code: campaignCode, name: playerName });
  await page.waitForFunction(
    ({ code, joinedAt }) => {
      const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
      const sync = window.campaignSystem && window.campaignSystem.getSyncStatus ? window.campaignSystem.getSyncStatus() : null;
      return !!(st && st.connected && st.code === code && st.role === "player" && sync && Number(sync.lastCampaignStateAt || 0) >= joinedAt);
    },
    { code: campaignCode, joinedAt: joinedAfter },
    { timeout: STEP_TIMEOUT_MS }
  );
  return true;
}

async function waitForCountdownChipState(page, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll("#campaignSettingsSection .campaign-status-row .campaign-badge"));
      return badges.map((el) => String(el.textContent || "").trim()).join(" | ");
    });
    if (/reconciling\s*\(\d+s\)|reconnecting\s*\(\d+s\)/i.test(text)) {
      return { seen: true, text };
    }
    await wait(180);
  }
  const fallback = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll("#campaignSettingsSection .campaign-status-row .campaign-badge"));
    return badges.map((el) => String(el.textContent || "").trim()).join(" | ");
  });
  return { seen: false, text: fallback };
}

async function runScenario(browser) {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gmPage = await gmContext.newPage();
  const playerPage = await playerContext.newPage();
  const pageErrors = [];

  gmPage.on("pageerror", (err) => pageErrors.push(`GM: ${String(err && err.message ? err.message : err)}`));
  playerPage.on("pageerror", (err) => pageErrors.push(`Player: ${String(err && err.message ? err.message : err)}`));

  for (const page of [gmPage, playerPage]) {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForCampaignReady(page);
    await clearSession(page);
  }

  await gmPage.evaluate(() => {
    const el = document.getElementById("campaignNameInput");
    if (el) el.value = "Reconnect GM";
  });
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

  const code = await gmPage.evaluate(() => window.campaignSystem.getState().code || "");
  if (!code) throw new Error("Campaign code was not created.");

  await playerPage.evaluate(async (campaignCode) => {
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Reconnect Player" });
  }, code);

  await ensurePlayerJoined(playerPage, code, "Reconnect Player");

  const syncResult = await gmPage.evaluate(async () => {
    if (typeof window.generateMap === "function") window.generateMap();
    if (typeof window.generateLastSea === "function") window.generateLastSea();
    if (typeof window.generateStarSystemMap === "function") window.generateStarSystemMap("cluster");
    if (typeof window.generateWorldThatWasMap === "function") window.generateWorldThatWasMap();
    let attempt = 0;
    let last = null;
    while (attempt < 3) {
      last = await window.campaignSystem.syncSharedSilent("reconnect-soak-init-" + attempt);
      if (last && last.ok) return { ok: true, attempt: attempt + 1, lastError: "", last };
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return {
      ok: false,
      attempt,
      lastError: last && last.error ? String(last.error) : "unknown"
    };
  });
  if (!syncResult || !syncResult.ok) {
    throw new Error(`Initial authoritative sync failed: ${JSON.stringify(syncResult)}`);
  }
  console.log(`Initial authoritative sync: ${JSON.stringify(syncResult)}`);

  const expected = await collectMapSummary(gmPage);
  if (!expected.provinceCells || !expected.seaCells || !expected.galaxyCells || !expected.worldCells) {
    throw new Error(`GM map generation incomplete: ${JSON.stringify(expected)}`);
  }

  const durations = [];
  let countdownSeen = false;
  for (let i = 0; i < LOOP_COUNT; i += 1) {
    const loopStart = Date.now();
    await playerContext.setOffline(true);
    const countdownProbe = await waitForCountdownChipState(playerPage, 2600);
    if (countdownProbe.seen) countdownSeen = true;
    await playerContext.setOffline(false);
    await waitForCampaignReady(playerPage);
    await ensurePlayerJoined(playerPage, code, "Reconnect Player");

    const chipText = await playerPage.evaluate(() => {
      const badges = Array.from(document.querySelectorAll("#campaignSettingsSection .campaign-status-row .campaign-badge"));
      return badges.map((el) => String(el.textContent || "").trim()).join(" | ");
    });

    const reqStart = Date.now();
    await playerPage.evaluate(async () => {
      if (window.campaignSystem && typeof window.campaignSystem.requestResync === "function") {
        await window.campaignSystem.requestResync();
      }
    });
    const reqMs = Date.now() - reqStart;

    await gmPage.evaluate(async () => {
      if (window.campaignSystem && typeof window.campaignSystem.forceAuthoritativeResync === "function") {
        await window.campaignSystem.forceAuthoritativeResync();
      }
    });
    await waitForHydratedMaps(playerPage, expected);

    durations.push({
      loop: i + 1,
      totalMs: Date.now() - loopStart,
      requestResyncMs: reqMs,
      chipText
    });
  }

  if (!countdownSeen) {
    throw new Error("Reconnect countdown state was not observed in sync chip during churn loops.");
  }

  const finalSummary = await collectMapSummary(playerPage);
  if (
    finalSummary.provinceCells <= 0 ||
    finalSummary.seaCells <= 0 ||
    finalSummary.galaxyCells <= 0 ||
    finalSummary.worldCells <= 0
  ) {
    throw new Error(`Player map hydration regressed after reconnect churn: ${JSON.stringify(finalSummary)}`);
  }

  if (pageErrors.length) {
    throw new Error(`Reconnect churn encountered page errors: ${pageErrors.join(" | ")}`);
  }

  const reqAvg = Math.round(durations.reduce((sum, d) => sum + d.requestResyncMs, 0) / Math.max(1, durations.length));
  const totalAvg = Math.round(durations.reduce((sum, d) => sum + d.totalMs, 0) / Math.max(1, durations.length));
  const health = await assertServerHealth("post-reconnect-soak", 1);
  console.log(`Reconnect churn soak passed: loops=${LOOP_COUNT}, avgRequestResyncMs=${reqAvg}, avgLoopMs=${totalAvg}, code=${code}`);
  console.log(`Server health: campaigns=${health.campaigns.count}, lastPersistAt=${health.persistence.lastPersistIso || "pending"}, persistQueueLagMs=${health.persistence.persistQueueLagMs}, outboundQueueLagMs=${health.outboundSnapshots.queueLagMs}`);
}

async function main() {
  const server = startServer();
  let browser = null;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    await assertServerHealth("startup", 0);
    browser = await launchBrowser();
    await runScenario(browser);
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

let BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const CLICK_LIMIT = 280;
const MULTI_CLIENT_TIMEOUT_MS = 25000;

const SKIP_LABELS = [
  /delete campaign/i,
  /archive/i,
  /reopen/i,
  /leave\b/i,
  /delete\b/i,
  /reset\b/i,
  /logout/i
];

function shouldSkipLabel(label) {
  return SKIP_LABELS.some((rx) => rx.test(label || ""));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPortOpen(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferredPort) {
  if (Number.isFinite(preferredPort) && preferredPort > 0 && preferredPort < 65536) {
    const available = await checkPortOpen(preferredPort);
    if (available) return preferredPort;
  }

  for (let i = 0; i < 30; i += 1) {
    const candidate = 4000 + Math.floor(Math.random() * 2000);
    const available = await checkPortOpen(candidate);
    if (available) return candidate;
  }

  throw new Error("Unable to find a free local port for smoke server.");
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

async function waitForCampaignReady(page, label) {
  await page.waitForFunction(
    () => !!(window.campaignSystem && window.campaignSystem.getState && window.campaignSystem.getState().connected),
    null,
    { timeout: MULTI_CLIENT_TIMEOUT_MS }
  );
  await dismissBlockingOverlays(page);
  try {
    await page.evaluate(() => {
      if (window.campaignSystem && typeof window.campaignSystem.showOnboarding === "function") {
        window.campaignSystem.showOnboarding(false);
      }
    });
  } catch (_err) {
    // Non-fatal.
  }
  await dismissBlockingOverlays(page);
  if (!label) return;
}

async function collectMapSummary(page) {
  return page.evaluate(() => {
    const province = (typeof window.getProvinceMapState === "function") ? window.getProvinceMapState() : null;
    const provinceCells = province && Array.isArray(province.mapData) ? province.mapData.length : 0;
    const seaCells = (window.S && window.S.lastSea && Array.isArray(window.S.lastSea.map)) ? window.S.lastSea.map.length : 0;
    const galaxyCells = (window.S && window.S.starSystem && Array.isArray(window.S.starSystem.hexes)) ? window.S.starSystem.hexes.length : 0;
    const worldCells = (window.S && window.S.worldThatWas && Array.isArray(window.S.worldThatWas.hexes)) ? window.S.worldThatWas.hexes.length : 0;
    return { provinceCells, seaCells, galaxyCells, worldCells };
  });
}

function hasAllGeneratedMaps(summary) {
  return !!(
    summary &&
    Number(summary.provinceCells || 0) > 0 &&
    Number(summary.seaCells || 0) > 0 &&
    Number(summary.galaxyCells || 0) > 0 &&
    Number(summary.worldCells || 0) > 0
  );
}

function expectedHydrationFromGmSummary(summary) {
  const s = summary || {};
  return {
    provinceCells: Number(s.provinceCells || 0),
    seaCells: Number(s.seaCells || 0),
    galaxyCells: Number(s.galaxyCells || 0),
    worldCells: Number(s.worldCells || 0)
  };
}

async function waitForHydratedMaps(page, label, expected) {
  const goal = expectedHydrationFromGmSummary(expected);
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
    { timeout: MULTI_CLIENT_TIMEOUT_MS }
  );

  const summary = await collectMapSummary(page);
  if (
    (goal.provinceCells > 0 && summary.provinceCells <= 0) ||
    (goal.seaCells > 0 && summary.seaCells <= 0) ||
    (goal.galaxyCells > 0 && summary.galaxyCells <= 0) ||
    (goal.worldCells > 0 && summary.worldCells <= 0)
  ) {
    throw new Error(`${label} map hydration incomplete: expected=${JSON.stringify(goal)} actual=${JSON.stringify(summary)}`);
  }
}

async function runMultiClientSyncAssertions(browser, pageErrors) {
  const gmPage = await browser.newPage();
  const playerPage = await browser.newPage();
  const lateJoinPage = await browser.newPage();

  [gmPage, playerPage, lateJoinPage].forEach((page, idx) => {
    page.on("pageerror", (err) => {
      pageErrors.push(`Client ${idx + 1}: ${String(err && err.message ? err.message : err)}`);
    });
  });

  await gmPage.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await playerPage.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await lateJoinPage.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  await dismissBlockingOverlays(gmPage);
  await dismissBlockingOverlays(playerPage);
  await dismissBlockingOverlays(lateJoinPage);

  for (const page of [gmPage, playerPage, lateJoinPage]) {
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

  await waitForCampaignReady(gmPage, "GM");
  await waitForCampaignReady(playerPage, "Player");
  await waitForCampaignReady(lateJoinPage, "LateJoin");

  await gmPage.evaluate(() => {
    const el = document.getElementById("campaignNameInput");
    if (el) el.value = "Smoke GM";
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
    { timeout: MULTI_CLIENT_TIMEOUT_MS }
  );

  const code = await gmPage.evaluate(() => window.campaignSystem.getState().code || "");
  if (!code) {
    throw new Error("GM campaign creation assertion failed: no campaign code allocated.");
  }

  await playerPage.evaluate(async (campaignCode) => {
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Smoke Player" });
  }, code);

  await playerPage.waitForFunction(
    (campaignCode) => {
      const st = window.campaignSystem.getState();
      return !!(st && st.code === campaignCode && st.role === "player");
    },
    code,
    { timeout: MULTI_CLIENT_TIMEOUT_MS }
  );

  const generatedInfo = await gmPage.evaluate(async () => {
    const diagnostics = [];
    const resolveFn = (name) => {
      if (typeof window[name] === "function") return window[name];
      try {
        const maybe = Function(`return (typeof ${name} === 'function') ? ${name} : null;`)();
        return typeof maybe === "function" ? maybe : null;
      } catch (_err) {
        return null;
      }
    };

    const provinceFn = resolveFn("generateMap");
    const seaFn = resolveFn("generateLastSea");
    const galaxyFn = resolveFn("generateStarSystemMap");
    const worldFn = resolveFn("generateWorldThatWasMap");

    diagnostics.push(`fn:province=${!!provinceFn},sea=${!!seaFn},galaxy=${!!galaxyFn},world=${!!worldFn}`);
    if (provinceFn) {
      try { provinceFn(); } catch (err) { diagnostics.push(`province:${String(err && err.message ? err.message : err)}`); }
    }
    if (seaFn) {
      try { seaFn(); } catch (err) { diagnostics.push(`sea:${String(err && err.message ? err.message : err)}`); }
    }
    if (galaxyFn) {
      try { galaxyFn("cluster"); } catch (err) { diagnostics.push(`galaxy:${String(err && err.message ? err.message : err)}`); }
    }
    if (worldFn) {
      try { worldFn(); } catch (err) { diagnostics.push(`world:${String(err && err.message ? err.message : err)}`); }
    }

    const res = await window.campaignSystem.syncSharedSilent("smoke-multi-client-map-sync");
    return { ok: !!(res && res.ok), diagnostics };
  });
  if (!generatedInfo || !generatedInfo.ok) {
    throw new Error(`GM map generation sync assertion failed: ${JSON.stringify(generatedInfo)}`);
  }

  const gmSummary = await collectMapSummary(gmPage);
  if (gmSummary.provinceCells <= 0) {
    throw new Error(`GM province map generation assertion failed: summary=${JSON.stringify(gmSummary)} diagnostics=${JSON.stringify(generatedInfo)}`);
  }

  const guardrailAttempt = await playerPage.evaluate(async () => {
    const before = (typeof window.getProvinceMapState === "function") ? (window.getProvinceMapState() || {}) : {};
    const fakeProvince = {
      mapData: [{ col: 0, row: 0, terrain: "void", type: "wilderness", name: "Injected", data: {} }],
      hexNotes: {},
      usedPerils: [],
      usedBarriers: [],
      selectedKey: "",
      provinceSecretPadKey: ""
    };
    const fakeState = {
      provinceMap: fakeProvince,
      lastSea: { map: [{ key: "s-0-0", col: 0, row: 0, type: "sea" }], islands: [] },
      starSystem: { hexes: [{ id: 999, q: 0, r: 0, type: "nothing" }] },
      worldThatWas: { hexes: [{ id: "wtw-x", col: 0, row: 0 }] },
      gameDate: { day: 99, month: 99, year: 9999 }
    };

    const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
    if (!st || !st.code || !st.token || typeof window.io !== "function") {
      return {
        ok: false,
        conflicts: [],
        error: "Missing campaign state or io socket client.",
        beforeProvinceCells: Array.isArray(before.mapData) ? before.mapData.length : 0,
        afterProvinceCells: Array.isArray(before.mapData) ? before.mapData.length : 0
      };
    }

    const res = await new Promise((resolve) => {
      const s = window.io({ transports: ["websocket", "polling"] });
      const done = (payload) => {
        try { s.disconnect(); } catch (_err) {}
        resolve(payload || { ok: false, error: "No response" });
      };
      s.on("connect_error", (err) => {
        done({ ok: false, error: String(err && err.message ? err.message : err) });
      });
      s.on("connect", () => {
        s.emit("campaign:join", {
          code: st.code,
          token: st.token,
          role: "player",
          name: "Smoke Guardrail Player"
        }, (joinAck) => {
          if (!joinAck || !joinAck.ok) {
            done({ ok: false, error: (joinAck && joinAck.error) || "Join failed" });
            return;
          }
          s.emit("campaign:syncState", {
            reason: "smoke-non-gm-overwrite-attempt",
            state: fakeState
          }, (syncAck) => {
            done(syncAck);
          });
        });
      });
      setTimeout(() => {
        done({ ok: false, error: "Guardrail socket attempt timed out" });
      }, 12000);
    });

    const after = (typeof window.getProvinceMapState === "function") ? (window.getProvinceMapState() || {}) : {};
    return {
      ok: !!(res && res.ok),
      conflicts: Array.isArray(res && res.conflicts) ? res.conflicts : [],
      error: res && res.error ? String(res.error) : "",
      beforeProvinceCells: Array.isArray(before.mapData) ? before.mapData.length : 0,
      afterProvinceCells: Array.isArray(after.mapData) ? after.mapData.length : 0
    };
  });

  if (!guardrailAttempt.ok) {
    throw new Error(`Non-GM guardrail sync call failed: ${JSON.stringify(guardrailAttempt)}`);
  }

  const expectedConflictKeys = ["provinceMap", "lastSea", "starSystem", "worldThatWas", "gameDate"];
  const missingConflictKeys = expectedConflictKeys.filter((key) => !guardrailAttempt.conflicts.includes(key));
  if (missingConflictKeys.length) {
    throw new Error(`Guardrail conflict assertion failed. Missing conflicts for keys: ${missingConflictKeys.join(", ")}. Full result=${JSON.stringify(guardrailAttempt)}`);
  }

  await gmPage.waitForTimeout(300);
  const gmAfterGuardrailSummary = await collectMapSummary(gmPage);
  if (gmAfterGuardrailSummary.provinceCells !== gmSummary.provinceCells) {
    throw new Error(`Guardrail state preservation failed for GM province map: before=${JSON.stringify(gmSummary)} after=${JSON.stringify(gmAfterGuardrailSummary)}`);
  }

  await waitForHydratedMaps(playerPage, "Player", gmSummary);

  await lateJoinPage.evaluate(async (campaignCode) => {
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Smoke Late Join" });
  }, code);

  await lateJoinPage.waitForFunction(
    (campaignCode) => {
      const st = window.campaignSystem.getState();
      return !!(st && st.code === campaignCode && st.role === "player");
    },
    code,
    { timeout: MULTI_CLIENT_TIMEOUT_MS }
  );

  await waitForHydratedMaps(lateJoinPage, "LateJoin", gmSummary);

  const playerSummary = await collectMapSummary(playerPage);
  const lateSummary = await collectMapSummary(lateJoinPage);
  process.stdout.write(
    `Multi-client sync assertions passed: code=${code}, gm=${JSON.stringify(gmSummary)}, guardrailConflicts=${JSON.stringify(guardrailAttempt.conflicts)}, player=${JSON.stringify(playerSummary)}, lateJoin=${JSON.stringify(lateSummary)}\n`
  );

  await gmPage.close();
  await playerPage.close();
  await lateJoinPage.close();
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_err) {
      // Retry until timeout.
    }
    await wait(350);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

function startServer(port) {
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "beyond-light-click-smoke-"));
  const storePath = path.join(storeDir, "campaign-data.json");
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      CAMPAIGN_STORE_PATH: storePath
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

  return {
    child,
    cleanup() {
      try {
        fs.rmSync(storeDir, { recursive: true, force: true });
      } catch (_err) {
        // Best-effort cleanup for temp smoke data.
      }
    }
  };
}

async function run() {
  const requestedPort = Number(process.env.PORT || 3000);
  const port = await pickAvailablePort(requestedPort);
  BASE_URL = process.env.SMOKE_URL || `http://127.0.0.1:${port}`;

  const serverHandle = startServer(port);
  const server = serverHandle.child;
  let browser;
  const failures = [];
  const pageErrors = [];

  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);

    browser = await chromium.launch({ headless: true });
    await runMultiClientSyncAssertions(browser, pageErrors);

    const page = await browser.newPage();

    page.on("pageerror", (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await dismissBlockingOverlays(page);

    const tabButtons = page.locator(".tab-btn");
    const tabCount = await tabButtons.count();
    for (let i = 0; i < tabCount; i += 1) {
      const tab = tabButtons.nth(i);
      if (!(await tab.isVisible())) continue;
      try {
        await tab.click({ timeout: 1500 });
        await page.waitForTimeout(40);
      } catch (_err) {
        // Continue trying all tabs.
      }
    }

    const clickables = page.locator("button,[role='button'],[onclick]");
    const count = await clickables.count();
    const max = Math.min(count, CLICK_LIMIT);

    for (let i = 0; i < max; i += 1) {
      await dismissBlockingOverlays(page);
      const el = clickables.nth(i);
      if (!(await el.isVisible())) continue;
      if (!(await el.isEnabled())) continue;

      const label = ((await el.textContent()) || "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (shouldSkipLabel(label)) continue;

      try {
        await el.scrollIntoViewIfNeeded();
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(30);
      } catch (err) {
        const message = String(err && err.message ? err.message : err);
        if (/intercepts pointer events/i.test(message)) {
          try {
            await dismissBlockingOverlays(page);
            await el.click({ timeout: 1200, force: true });
            await page.waitForTimeout(30);
            continue;
          } catch (retryErr) {
            failures.push(`Click failed [${i}] ${label || "<unlabeled>"}: ${String(retryErr && retryErr.message ? retryErr.message : retryErr)}`);
            continue;
          }
        }
        failures.push(`Click failed [${i}] ${label || "<unlabeled>"}: ${message}`);
      }
    }

    if (pageErrors.length) {
      failures.push(...pageErrors.map((e) => `Uncaught page error: ${e}`));
    }

    if (failures.length) {
      throw new Error(`Smoke failures (${failures.length}):\n${failures.slice(0, 25).join("\n")}`);
    }

    process.stdout.write(`Smoke passed: checked up to ${max} clickable paths with no uncaught runtime errors.\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
    if (serverHandle && typeof serverHandle.cleanup === "function") {
      serverHandle.cleanup();
    }
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

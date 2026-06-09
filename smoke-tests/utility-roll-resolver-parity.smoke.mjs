import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 25000;

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

async function runScenario(browser) {
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => typeof window.resolveStatVsDreadCheck === "function" && !!window.S,
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const summary = await page.evaluate(async () => {
    const requiredFns = [
      ["rollHaggle", window.rollHaggle],
      ["attemptBlackMarketAccess", window.attemptBlackMarketAccess],
      ["attemptEncounterThievery", window.attemptEncounterThievery],
      ["attemptThievery", window.attemptThievery],
      ["resolveProvinceHoldingDowntime", window.resolveProvinceHoldingDowntime]
    ];

    const sourceMissing = requiredFns
      .filter(([, fn]) => typeof fn !== "function" || !String(fn).includes("resolveStatVsDreadCheck"))
      .map(([name]) => name);

    if (sourceMissing.length) {
      throw new Error(`Resolver not wired in: ${sourceMissing.join(", ")}`);
    }

    const featureSource = await fetch("./new-features.js").then((r) => r.text());
    const holdingResolverRegex = /function\s+resolveHoldingDowntimeEvent[\s\S]*?resolveStatVsDreadCheck/;
    if (!holdingResolverRegex.test(featureSource)) {
      throw new Error("resolveHoldingDowntimeEvent is not using resolveStatVsDreadCheck");
    }

    if (typeof window.ensureDarkAfflictionState === "function") {
      window.ensureDarkAfflictionState();
    }

    const originalManualMode = window.isManualRollModeEnabled;
    const originalManualPrompt = window.openProvinceManualCheckPrompt;

    const state = window.S;
    state.darkAfflictions = state.darkAfflictions || {};
    state.darkAfflictions.vampirism = state.darkAfflictions.vampirism || { active: false, corruption: 0 };
    state.darkAfflictions.wolfism = state.darkAfflictions.wolfism || { active: false, corruption: 0 };

    state.darkAfflictions.vampirism.active = false;
    state.darkAfflictions.vampirism.corruption = 0;
    state.darkAfflictions.wolfism.active = false;
    state.darkAfflictions.wolfism.corruption = 0;

    const originalPenaltyFn = window.getDarkAfflictionPenalty;
    window.getDarkAfflictionPenalty = () => 0;

    const noPenalty = window.resolveStatVsDreadCheck({
      statKey: "spirit",
      actionDie: 6,
      dreadDie: 8,
      allowManual: false,
      rollActionTotal: () => 10,
      rollDreadTotal: () => 8,
      actionAdjusters: [
        (payload) => {
          const adj = window.applyUtilityRollDarkPenalty("spirit", payload.actionTotal);
          return { delta: Number(adj.total || 0) - Number(payload.actionTotal || 0) };
        }
      ]
    });

    state.darkAfflictions.vampirism.active = true;
    state.darkAfflictions.vampirism.corruption = 4;
    window.getDarkAfflictionPenalty = () => -2;

    const withPenalty = window.resolveStatVsDreadCheck({
      statKey: "spirit",
      actionDie: 6,
      dreadDie: 8,
      allowManual: false,
      rollActionTotal: () => 10,
      rollDreadTotal: () => 8,
      actionAdjusters: [
        (payload) => {
          const adj = window.applyUtilityRollDarkPenalty("spirit", payload.actionTotal);
          return {
            delta: Number(adj.total || 0) - Number(payload.actionTotal || 0),
            note: Number(adj.penalty || 0) < 0 ? `Day penalty ${Number(adj.penalty || 0)}` : ""
          };
        }
      ]
    });

    let manualResolved = null;
    window.isManualRollModeEnabled = () => true;
    window.openProvinceManualCheckPrompt = (cfg) => {
      cfg.onResolve({ manual: true, actionTotal: 10, dreadTotal: 8, mode: "compare" });
      return true;
    };

    window.resolveStatVsDreadCheck({
      statKey: "spirit",
      actionDie: 6,
      dreadDie: 8,
      actionAdjusters: [
        (payload) => {
          const adj = window.applyUtilityRollDarkPenalty("spirit", payload.actionTotal);
          return {
            delta: Number(adj.total || 0) - Number(payload.actionTotal || 0),
            note: Number(adj.penalty || 0) < 0 ? `Day penalty ${Number(adj.penalty || 0)}` : ""
          };
        }
      ],
      onResolved: (result) => {
        manualResolved = result;
      }
    });

    window.isManualRollModeEnabled = originalManualMode;
    window.openProvinceManualCheckPrompt = originalManualPrompt;
    window.getDarkAfflictionPenalty = originalPenaltyFn;

    if (!noPenalty || noPenalty.actionTotal !== 10) {
      throw new Error(`Expected no-penalty action total 10, got ${JSON.stringify(noPenalty)}`);
    }
    if (!withPenalty || withPenalty.actionTotal >= noPenalty.actionTotal) {
      throw new Error(`Penalty did not reduce action total: ${JSON.stringify({ noPenalty, withPenalty })}`);
    }
    if (!manualResolved || !manualResolved.manual || manualResolved.actionTotal >= 10) {
      throw new Error(`Manual parity check failed: ${JSON.stringify(manualResolved)}`);
    }

    return {
      resolverWired: true,
      noPenaltyTotal: noPenalty.actionTotal,
      withPenaltyTotal: withPenalty.actionTotal,
      manualTotal: manualResolved.actionTotal,
      manualNotes: manualResolved.modifierNotes || []
    };
  });

  process.stdout.write(`Utility resolver parity smoke passed: ${JSON.stringify(summary)}\n`);
  await page.close();
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    await runScenario(browser);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

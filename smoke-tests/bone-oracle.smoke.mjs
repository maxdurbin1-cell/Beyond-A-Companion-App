import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    await wait(300);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
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

async function runAssertions(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);
  await page.waitForFunction(
    () => {
      let st = null;
      try { st = window.eval("S"); } catch (_err) { st = window.S; }
      return !!st && typeof window.usePersonalFlavorAction === "function";
    },
    null,
    { timeout: 15000 }
  );

  const result = await page.evaluate(() => {
    let state = null;
    try { state = window.eval("S"); } catch (_err) { state = window.S; }
    if (!state || typeof window.usePersonalFlavorAction !== "function") {
      return { ok: false, error: "Flavor system unavailable" };
    }

    try {
      if (typeof window.setFlavor === "function") window.setFlavor("Bone Oracle");
      else state.flavor = "Bone Oracle";
    } catch (_err) {
      state.flavor = "Bone Oracle";
    }

    state.storyline = state.storyline || {};
    if (!Array.isArray(state.storyline.omenLog)) state.storyline.omenLog = [];
    state.combat = state.combat || {};
    state.combat.active = false;
    state.combat.raidFlow = null;
    state.combat.personalFlavorSuppressedRounds = 0;
    state.flavorActionState = state.flavorActionState || {};
    delete state.flavorActionState["bone oracle"];
    state.flavor = "bone oracle";

    const beforeTokens = Number(state.pathTokens || 0);
    const beforeLogLen = Number(state.storyline.omenLog.length || 0);

    window.usePersonalFlavorAction();

    const tabSignalAfterFirst = (() => {
      const active = document.querySelector(".tab-content.active");
      const activeId = active ? String(active.id || "") : "";
      const nav = document.getElementById("tabnav-newsun");
      const panel = document.getElementById("tab-newsun");
      return {
        activeId,
        navSelected: nav ? String(nav.getAttribute("aria-selected") || "") : "",
        panelVisible: panel ? (panel.style.display !== "none") : false
      };
    })();

    const afterFirstTokens = Number(state.pathTokens || 0);
    const afterFirstLogLen = Number(state.storyline.omenLog.length || 0);
    const firstLogEntry = String((state.storyline.omenLog[0] || ""));

    try {
      if (typeof window.closeModal === "function") window.closeModal();
    } catch (_err) {}

    window.usePersonalFlavorAction();

    const afterSecondTokens = Number(state.pathTokens || 0);
    const afterSecondLogLen = Number(state.storyline.omenLog.length || 0);

    return {
      ok: true,
      tabSignalAfterFirst,
      firstUse: {
        tokenGain: afterFirstTokens - beforeTokens,
        logGain: afterFirstLogLen - beforeLogLen,
        firstLogEntry
      },
      secondUse: {
        tokenGain: afterSecondTokens - afterFirstTokens,
        logGain: afterSecondLogLen - afterFirstLogLen
      },
      cooldownStamp: state.flavorActionState && state.flavorActionState["bone oracle"]
        ? state.flavorActionState["bone oracle"].stamp
        : ""
    };
  });

  if (!result || !result.ok) {
    throw new Error(`Bone Oracle smoke setup failed: ${JSON.stringify(result)}`);
  }

  if (result.firstUse.tokenGain < 1) {
    throw new Error(`Bone Oracle did not grant path token on first use: ${JSON.stringify(result)}`);
  }

  if (result.firstUse.logGain < 1 || !/^Bone Oracle:/i.test(String(result.firstUse.firstLogEntry || ""))) {
    throw new Error(`Bone Oracle did not log omen correctly: ${JSON.stringify(result)}`);
  }

  const tabSignal = result.tabSignalAfterFirst || {};
  const handedOff = String(tabSignal.activeId || "") === "tab-newsun"
    || String(tabSignal.navSelected || "") === "true"
    || !!tabSignal.panelVisible;
  if (!handedOff) {
    throw new Error(`Bone Oracle did not hand off to Omen/New Sun tab: ${JSON.stringify(result)}`);
  }

  if (result.secondUse.tokenGain !== 0 || result.secondUse.logGain !== 0) {
    throw new Error(`Bone Oracle daily lockout failed on second use: ${JSON.stringify(result)}`);
  }

  process.stdout.write(`Bone Oracle smoke passed: ${JSON.stringify(result)}\n`);
}

async function run() {
  const server = startServer();
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await runAssertions(page);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

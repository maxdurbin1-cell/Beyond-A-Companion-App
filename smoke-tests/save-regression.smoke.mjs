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
    () => typeof window.saveCharacter === "function" && typeof window.loadCharacter === "function" && !!window.S,
    null,
    { timeout: 20000 }
  );

  const firstPass = await page.evaluate(() => {
    const keys = [
      "beyond-light-character",
      "beyond-light-character-backup",
      "beyond-light-character-checkpoint",
      "beyond-light-character-meta",
      "beyond-light-character-checkpoint-1",
      "beyond-light-character-checkpoint-2",
      "beyond-light-character-checkpoint-3"
    ];
    keys.forEach((k) => {
      try { localStorage.removeItem(k); } catch (_err) {}
    });

    const state = (typeof S !== "undefined" && S) ? S : window.S;
    if (!state || typeof state !== "object") {
      return { ok: false, error: "global state object unavailable" };
    }

    const marker = `smoke-save-${Date.now()}`;
    const cycle = { marker };
    cycle.self = cycle;

    state.name = marker;
    state.credits = 4321;
    state.traits = state.traits && typeof state.traits === "object" ? state.traits : {};
    state.traits.smokeSaveMarker = marker;
    state.backstory = state.backstory && typeof state.backstory === "object" ? state.backstory : {};
    state.backstory.hometown = `Hometown-${marker}`;
    state.backstory.rival = `Rival-${marker}`;
    state.backstory.connection = `Contact-${marker}`;
    state.backstory.notes = `Backstory-${marker}`;
    state.backpack = Array.isArray(state.backpack) ? state.backpack : ["", "", "", "", "", ""];
    state.backpack[0] = `Token-${marker}`;
    state._smokeCycle = cycle;

    const saveBtn = document.querySelector('#tab-character .char-top button[onclick*="saveCharacter()"]');
    if (saveBtn) {
      saveBtn.click();
    } else {
      window.saveCharacter();
    }

    const raw = localStorage.getItem("beyond-light-character");
    if (!raw) {
      return { ok: false, error: "primary save key missing" };
    }

    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch (err) {
      return { ok: false, error: `primary save JSON invalid: ${String(err && err.message ? err.message : err)}` };
    }

    const data = envelope && envelope.data && typeof envelope.data === "object" ? envelope.data : null;
    if (!data) {
      return { ok: false, error: "primary save envelope missing data" };
    }

    const saveMarkerOk = String(data.name || "") === marker
      && Number(data.credits || 0) === 4321
      && String((data.traits && data.traits.smokeSaveMarker) || "") === marker
      && String((data.backstory && data.backstory.hometown) || "") === `Hometown-${marker}`
      && String((data.backstory && data.backstory.rival) || "") === `Rival-${marker}`
      && String((data.backstory && data.backstory.connection) || "") === `Contact-${marker}`
      && String((data.backstory && data.backstory.notes) || "") === `Backstory-${marker}`
      && Array.isArray(data.backpack)
      && String(data.backpack[0] || "") === `Token-${marker}`;

    if (!saveMarkerOk) {
      return {
        ok: false,
        error: "saved payload missing expected marker fields",
        savedName: data.name,
        savedCredits: data.credits,
        savedTrait: data.traits && data.traits.smokeSaveMarker,
        savedBackstory: data.backstory,
        savedBackpack0: Array.isArray(data.backpack) ? data.backpack[0] : null
      };
    }

    if (data._smokeCycle && typeof data._smokeCycle === "object" && data._smokeCycle.self) {
      return { ok: false, error: "circular field unexpectedly persisted" };
    }

    return {
      ok: true,
      marker,
      saveSchema: envelope.schema,
      hasChecksum: !!envelope.checksum
    };
  });

  if (!firstPass || !firstPass.ok) {
    throw new Error(`Save regression smoke failed during save pass: ${JSON.stringify(firstPass)}`);
  }

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  const secondPass = await page.evaluate((expectedMarker) => {
    const raw = localStorage.getItem("beyond-light-character");
    if (!raw) return { ok: false, error: "primary save key missing after reload" };

    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch (err) {
      return { ok: false, error: `primary save JSON invalid after reload: ${String(err && err.message ? err.message : err)}` };
    }

    const data = envelope && envelope.data && typeof envelope.data === "object" ? envelope.data : null;
    if (!data) {
      return { ok: false, error: "primary save envelope missing data after reload" };
    }

    const hasMarker = String(data.name || "") === expectedMarker
      && Number(data.credits || 0) === 4321
      && String((data.traits && data.traits.smokeSaveMarker) || "") === expectedMarker
      && String((data.backstory && data.backstory.hometown) || "") === `Hometown-${expectedMarker}`
      && String((data.backstory && data.backstory.rival) || "") === `Rival-${expectedMarker}`
      && String((data.backstory && data.backstory.connection) || "") === `Contact-${expectedMarker}`
      && String((data.backstory && data.backstory.notes) || "") === `Backstory-${expectedMarker}`
      && Array.isArray(data.backpack)
      && String(data.backpack[0] || "") === `Token-${expectedMarker}`;

    if (!hasMarker) {
      return {
        ok: false,
        error: "saved payload marker fields mismatch after reload",
        savedName: data.name,
        savedCredits: data.credits,
        savedTrait: data.traits && data.traits.smokeSaveMarker,
        savedBackstory: data.backstory,
        savedBackpack0: Array.isArray(data.backpack) ? data.backpack[0] : null
      };
    }

    const checkpointRaw = localStorage.getItem("beyond-light-character-checkpoint-1");
    if (!checkpointRaw) {
      return { ok: false, error: "checkpoint slot 1 missing after save" };
    }

    return {
      ok: true,
      marker: expectedMarker,
      saveSchema: envelope.schema,
      hasChecksum: !!envelope.checksum,
      hasCheckpointSlot1: true
    };
  }, firstPass.marker);

  if (!secondPass || !secondPass.ok) {
    throw new Error(`Save regression smoke failed during reload pass: ${JSON.stringify(secondPass)}`);
  }

  process.stdout.write(`Save regression smoke passed: ${JSON.stringify(secondPass)}\n`);
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

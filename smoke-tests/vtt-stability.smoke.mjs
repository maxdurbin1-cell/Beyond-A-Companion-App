import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const COMBAT_KEY = "btl-combat-scene-editor-v1";
const TUTORIAL_KEY = COMBAT_KEY + "-tutorial";

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

async function pickAvailablePort(preferredPort = 3000) {
  if (await canBindPort(preferredPort)) return preferredPort;
  for (let i = 0; i < 40; i += 1) {
    const candidate = 4100 + Math.floor(Math.random() * 2400);
    if (await canBindPort(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for the VTT stability smoke.");
}

async function waitForServer(url, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    if (child.exitCode !== null) throw new Error("VTT stability server exited before becoming ready.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_err) {}
    await wait(200);
  }
  throw new Error("Timed out waiting for the VTT stability server.");
}

async function measureAnimationFrames(page, count) {
  return page.evaluate(async (frameCount) => {
    const startedAt = performance.now();
    for (let i = 0; i < frameCount; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return Math.round(performance.now() - startedAt);
  }, count);
}

async function run() {
  const port = await pickAvailablePort(Number(process.env.PORT || 3000));
  const baseUrl = process.env.SMOKE_URL || `http://127.0.0.1:${port}`;
  const ownsTempRoot = !process.env.CAMPAIGN_STORE_PATH;
  const tempRoot = ownsTempRoot
    ? fs.mkdtempSync(path.join(os.tmpdir(), "btl-vtt-stability-"))
    : path.dirname(path.resolve(process.env.CAMPAIGN_STORE_PATH));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      PAYWALL_DISABLED: "1",
      BTL_DATA_DIR: process.env.BTL_DATA_DIR || tempRoot,
      CAMPAIGN_STORE_PATH: process.env.CAMPAIGN_STORE_PATH || path.join(tempRoot, "campaign-data.json"),
      CAMPAIGN_SNAPSHOT_DIR: process.env.CAMPAIGN_SNAPSHOT_DIR || path.join(tempRoot, "snapshots"),
      LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH || path.join(tempRoot, "license-data.json")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let serverLog = "";
  child.stdout.on("data", (chunk) => { serverLog += String(chunk || ""); });
  child.stderr.on("data", (chunk) => { serverLog += String(chunk || ""); });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error && error.message ? error.message : error)));

  try {
    await waitForServer(baseUrl, child);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(({ combatKey, tutorialKey }) => {
      try { window.introSystem?.skipIntro?.(); } catch (_err) {}
      try { window.soloReference?.close?.(); } catch (_err) {}
      try { window.closeModal?.(); } catch (_err) {}
      localStorage.removeItem(combatKey);
      localStorage.setItem(tutorialKey, JSON.stringify({ seen: true, step: 7 }));
    }, { combatKey: COMBAT_KEY, tutorialKey: TUTORIAL_KEY });

    const mainFrameMs = await measureAnimationFrames(page, 45);
    if (mainFrameMs > 3500) {
      throw new Error(`Main page frame budget exceeded before VTT open (${mainFrameMs}ms). Audio may be generating eagerly.`);
    }

    const tokens = Array.from({ length: 80 }, (_, index) => ({
      id: `stability-token-${index}`,
      name: `Stability Token ${index + 1}`,
      faction: index % 4 === 0 ? "monster" : "player",
      hp: 10,
      maxHp: 10,
      q: (index % 16) - 8,
      r: Math.floor(index / 16) - 2,
      size: 1,
      dread: 8,
      deathNumber: 8,
      status: index % 3 === 0 ? ["Focused"] : []
    }));

    await page.evaluate((seedTokens) => {
      window.openCombatSceneEditor({
        id: "vtt-stability-scene",
        name: "VTT Stability Scene",
        tokens: seedTokens,
        board: { cols: 32, rows: 28, size: 42, zoom: 1, panX: 700, panY: 430 }
      });
    }, tokens);
    await page.waitForSelector("#combatModeOverlay.open", { timeout: 10000 });
    await page.evaluate(() => window.closeModal?.());

    const vttIdleFrameMs = await measureAnimationFrames(page, 45);
    if (vttIdleFrameMs > 3500) {
      throw new Error(`Idle VTT frame budget exceeded (${vttIdleFrameMs}ms).`);
    }

    await page.evaluate(() => {
      const canvas = document.getElementById("combatSceneCanvas");
      window.__vttCanvasAttributeWrites = { width: 0, height: 0 };
      new MutationObserver((records) => {
        records.forEach((record) => {
          if (record.attributeName === "width" || record.attributeName === "height") {
            window.__vttCanvasAttributeWrites[record.attributeName] += 1;
          }
        });
      }).observe(canvas, { attributes: true, attributeFilter: ["width", "height"] });
      const state = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState({
        activeTool: "pan",
        board: { ...state.board, cols: 32, rows: 28, panX: 700, panY: 430 }
      });
    });

    const panResult = await page.evaluate(async () => {
      const canvas = document.getElementById("combatSceneCanvas");
      const rect = canvas.getBoundingClientRect();
      const startX = rect.left + 500;
      const startY = rect.top + 360;
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        clientX: startX,
        clientY: startY
      }));
      const startedAt = performance.now();
      for (let i = 1; i <= 60; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(() => {
          canvas.dispatchEvent(new MouseEvent("mousemove", {
            bubbles: true,
            buttons: 1,
            clientX: startX + i * 2,
            clientY: startY + Math.sin(i / 5) * 14
          }));
          resolve();
        }));
      }
      canvas.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        button: 0,
        clientX: startX + 120,
        clientY: startY
      }));
      await new Promise((resolve) => setTimeout(resolve, 250));
      const state = window.CombatSceneStore.getState();
      const timerStartedAt = performance.now();
      const responsiveTimerMs = await new Promise((resolve) => {
        setTimeout(() => resolve(Math.round(performance.now() - timerStartedAt)), 25);
      });
      return {
        elapsedMs: Math.round(performance.now() - startedAt),
        responsiveTimerMs,
        panX: Number(state.board && state.board.panX || 0),
        canvasWrites: window.__vttCanvasAttributeWrites
      };
    });

    if (panResult.elapsedMs > 6000) {
      throw new Error(`Dense VTT pan exceeded stability budget: ${JSON.stringify(panResult)}`);
    }
    if (panResult.responsiveTimerMs > 250) {
      throw new Error(`Main thread remained blocked after VTT pan: ${JSON.stringify(panResult)}`);
    }
    if (Math.abs(panResult.panX - 820) > 1) {
      throw new Error(`VTT pan state did not apply consistently: ${JSON.stringify(panResult)}`);
    }
    if (Number(panResult.canvasWrites.width || 0) > 2 || Number(panResult.canvasWrites.height || 0) > 2) {
      throw new Error(`VTT canvas was reallocated during pointer frames: ${JSON.stringify(panResult)}`);
    }

    await page.evaluate(() => window.closeCombatSceneEditor());
    await page.waitForFunction(() => !document.getElementById("combatModeOverlay")?.classList.contains("open"), null, { timeout: 10000 });
    await page.evaluate(() => window.openCombatSceneEditor({
      id: "vtt-stability-reopen",
      name: "VTT Stability Reopen",
      tokens: [{ id: "reopen-token", name: "Reopen Token", faction: "player", hp: 8, maxHp: 8, q: 0, r: 0 }]
    }));
    await page.waitForSelector("#combatModeOverlay.open", { timeout: 10000 });

    if (pageErrors.length) {
      throw new Error(`VTT stability page errors: ${pageErrors.join(" | ")}`);
    }

    console.log(JSON.stringify({
      ok: true,
      mainFrameMs,
      vttIdleFrameMs,
      panResult
    }, null, 2));
  } catch (error) {
    error.message += `\nServer log:\n${serverLog.slice(-5000)}`;
    throw error;
  } finally {
    await browser.close();
    if (child.exitCode === null) child.kill("SIGTERM");
    if (ownsTempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

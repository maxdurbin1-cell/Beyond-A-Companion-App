import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;

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

async function runAssertions(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  const result = await page.evaluate(async () => {
    if (typeof window.openSharedPuzzleChallenge !== "function") {
      return { ok: false, error: "openSharedPuzzleChallenge missing" };
    }
    if (typeof window._cpAction !== "function") {
      return { ok: false, error: "_cpAction missing" };
    }

    const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const modalText = () => {
      const node = document.getElementById("modalContent");
      return String(node && node.textContent || "").replace(/\s+/g, " ").trim();
    };
    const modalButtons = () => Array.from(document.querySelectorAll("#modalContent button"));

    if (!window.openSharedPuzzleChallenge({
      source: "event",
      mode: "pipe_flow",
      title: "Smoke Pipe Puzzle",
      prompt: "Route the flow."
    })) {
      return { ok: false, error: "pipe_flow did not open" };
    }

    const pipeButtons = modalButtons().filter((btn) => {
      const text = String(btn.textContent || "").trim();
      return text !== "Give Up" && text !== "Submit";
    });
    const rotatableTileIndexes = pipeButtons
      .map((btn, idx) => ({ btn, idx }))
      .filter((entry) => !entry.btn.disabled)
      .map((entry) => entry.idx);
    if (!rotatableTileIndexes.length) {
      return {
        ok: false,
        error: "pipe_flow had no rotatable tiles",
        pipeText: modalText()
      };
    }
    const readPipeGlyphs = () => modalButtons()
      .filter((btn) => {
        const text = String(btn.textContent || "").trim();
        return text !== "Give Up" && text !== "Submit";
      })
      .map((btn) => String(btn.textContent || "").trim())
      .join("|");
    const pipeBefore = readPipeGlyphs();
    window._cpAction("pipe_rotate", rotatableTileIndexes[0]);
    await waitFor(80);
    const pipeAfter = readPipeGlyphs();
    if (!pipeAfter || pipeAfter === pipeBefore) {
      return {
        ok: false,
        error: "pipe_flow rotate did not change the board",
        pipeBefore,
        pipeAfter
      };
    }
    window._cpAction("give_up");
    await waitFor(120);

    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      if (!window.openSharedPuzzleChallenge({
        source: "event",
        mode: "wordle_arcane",
        title: "Smoke Wordle Puzzle",
        prompt: "Decode the five-letter runeword."
      })) {
        return { ok: false, error: "wordle_arcane did not open" };
      }
    } finally {
      Math.random = originalRandom;
    }

    ["g", "l", "y", "p", "h"].forEach((ch) => window._cpAction("wordle_key", ch));
    window._cpAction("wordle_submit_guess");
    await waitFor(900);
    const wordleSolved = modalText().indexOf("Runeboard solved.") >= 0;
    if (!wordleSolved) {
      return { ok: false, error: "wordle_arcane did not resolve to success", wordleText: modalText() };
    }
    window._cpAction("submit");
    await waitFor(120);

    return {
      ok: true,
      pipeRotatableTiles: rotatableTileIndexes.length,
      pipeBefore,
      pipeAfter,
      wordleText: modalText()
    };
  });

  if (!result || !result.ok) {
    throw new Error(`Shared puzzle smoke failed: ${JSON.stringify(result)}`);
  }
}

async function main() {
  const child = startServer();
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err && err.message ? err.message : err)));

  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    await runAssertions(page);
  } finally {
    await browser.close();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        wait(1500)
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }

  if (pageErrors.length) {
    throw new Error(`Shared puzzle smoke page errors: ${pageErrors.join(" | ")}`);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

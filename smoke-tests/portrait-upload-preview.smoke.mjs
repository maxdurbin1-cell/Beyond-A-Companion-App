import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_err) {}
    await wait(300);
  }
  throw new Error(`Server did not become ready at ${url}`);
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
      if (typeof window.closeModal === "function") window.closeModal();
    } catch (_err) {}
    try {
      if (window.introSystem && typeof window.introSystem.enterLegacyMode === "function") {
        window.introSystem.enterLegacyMode();
      }
    } catch (_err) {}
    try {
      if (typeof window.closeModal === "function") window.closeModal();
    } catch (_err) {}
    try {
      const modal = document.getElementById("modalContent");
      if (modal) {
        const btns = Array.from(modal.querySelectorAll("button"));
        btns.forEach((btn) => {
          const txt = String(btn.textContent || "").toLowerCase();
          if (txt.includes("dismiss") || txt.includes("close")) {
            if (typeof btn.click === "function") btn.click();
          }
        });
      }
    } catch (_err) {}
  });
}

function writeTinyPng(filePath) {
  const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZfK8AAAAASUVORK5CYII=";
  fs.writeFileSync(filePath, Buffer.from(tinyPngBase64, "base64"));
  return `data:image/png;base64,${tinyPngBase64}`;
}

async function runScenario(browser) {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("beyond-light-solo-guide-dismissed", "1");
    } catch (_err) {}
  });
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  const tmpPath = path.join(os.tmpdir(), `portrait-upload-${Date.now()}.png`);
  const dataUrl = writeTinyPng(tmpPath);
  await page.evaluate((url) => {
    if (window.SharedIconSystem && typeof window.SharedIconSystem.setWayfarerPortraitImage === "function") {
      window.SharedIconSystem.setWayfarerPortraitImage(url, "Uploaded image");
      return;
    }
    window.S = window.S || {};
    window.S.portraitImage = url;
    window.S.portraitSource = "Uploaded image";
  }, dataUrl);
  await page.evaluate(() => {
    const mountId = "smokePortraitMount";
    let mount = document.getElementById(mountId);
    if (!mount) {
      mount = document.createElement("div");
      mount.id = mountId;
      mount.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;background:rgba(0,0,0,.35);padding:8px;";
      document.body.appendChild(mount);
    }
    if (window.SharedIconSystem && typeof window.SharedIconSystem.renderWayfarerSheetPanel === "function") {
      window.SharedIconSystem.renderWayfarerSheetPanel(mountId, window.S || {});
    }
  });
  await dismissBlockingOverlays(page);

  await page.waitForSelector("button[onclick*='openWayfarerPortraitPreview'] img[src^='data:image']", { timeout: 15000, state: "attached" });
  const modalPayload = await page.evaluate((url) => {
    if (!window.SharedIconSystem || typeof window.SharedIconSystem.openWayfarerPortraitPreview !== "function") {
      return { ok: false, error: "Missing SharedIconSystem.openWayfarerPortraitPreview." };
    }
    const src = String(url || "");
    window.SharedIconSystem.openWayfarerPortraitPreview(src, "Smoke Wayfarer", "Uploaded image");
    const content = document.getElementById("modalContent");
    const img = content ? content.querySelector("img") : null;
    const title = document.getElementById("modalTitle");
    return {
      ok: true,
      hasDataImage: !!(img && String(img.getAttribute("src") || "").startsWith("data:image")),
      hasPreviewAlt: !!(img && String(img.getAttribute("alt") || "").toLowerCase().includes("portrait preview")),
      titleText: String(title && title.textContent || "")
    };
  }, dataUrl);
  if (!modalPayload || !modalPayload.ok || !modalPayload.hasDataImage || !modalPayload.hasPreviewAlt) {
    throw new Error(`Portrait preview modal payload invalid: ${JSON.stringify(modalPayload)}`);
  }

  process.stdout.write("Portrait upload preview smoke passed.\n");
  try { fs.unlinkSync(tmpPath); } catch (_err) {}
  await page.close();
}

async function run() {
  const server = startServer();
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    await runScenario(browser);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_err) {}
    }
    server.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

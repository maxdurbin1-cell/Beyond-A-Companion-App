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

  const prep = await page.evaluate(() => {
    if (typeof window.generateMap !== "function") {
      return { ok: false, error: "generateMap missing" };
    }
    window.generateMap();
    if (typeof window.ensureProvinceLibraryHex === "function") {
      try { window.ensureProvinceLibraryHex(); } catch (_err) {}
    }
    if (typeof window.renderHexMap === "function") {
      try { window.renderHexMap(); } catch (_err) {}
    }

    const province = (typeof window.getProvinceMapState === "function") ? window.getProvinceMapState() : null;
    const mapData = province && Array.isArray(province.mapData) ? province.mapData : [];

    const typeCounts = Array.isArray(mapData)
      ? mapData.reduce((acc, h) => {
          const t = String((h && h.type) || "unknown").toLowerCase();
          acc[t] = Number(acc[t] || 0) + 1;
          return acc;
        }, {})
      : {};

    const libraryHex = Array.isArray(mapData)
      ? mapData.find((h) => h && String(h.type || "").toLowerCase() === "library")
      : null;
    if (!libraryHex) {
      return { ok: false, error: "library hex not generated", typeCounts };
    }

    if (typeof window.setProvinceSelectedKey === "function") {
      window.setProvinceSelectedKey(`${libraryHex.col},${libraryHex.row}`);
    } else {
      window.selectedHex = libraryHex;
      if (typeof window.renderHexMap === "function") window.renderHexMap();
      if (typeof window.renderHexInfo === "function") window.renderHexInfo(libraryHex);
    }

    const info = document.getElementById("hexInfo");
    const hasJoinCopy = !!(info && /Join Area: Infinite Library Megastack/i.test(String(info.textContent || "")));

    if (typeof window.openInfiniteLibraryAtHex !== "function") {
      return { ok: false, error: "openInfiniteLibraryAtHex missing", hasJoinCopy };
    }

    window.openInfiniteLibraryAtHex(libraryHex.col, libraryHex.row);
    const modalTitle = String((document.getElementById("modalTitle") && document.getElementById("modalTitle").textContent) || "");

    if (typeof window.openSoloGMConsole !== "function") {
      return { ok: false, error: "openSoloGMConsole missing", hasJoinCopy, modalTitle };
    }

    window.openSoloGMConsole();
    const soloTitle = String((document.getElementById("modalTitle") && document.getElementById("modalTitle").textContent) || "");
    const soloContent = String((document.getElementById("modalContent") && document.getElementById("modalContent").textContent) || "");

    const soloState = (() => {
      try {
        if (typeof S !== "undefined" && S && S.soloGM) {
          return {
            objectiveId: S.soloGM.currentObjectiveId || "",
            libraryDelves: Number((S.soloGM.websiteCounters && S.soloGM.websiteCounters.libraryDelves) || 0)
          };
        }
      } catch (_err) {}
      if (window.S && window.S.soloGM) {
        return {
          objectiveId: window.S.soloGM.currentObjectiveId || "",
          libraryDelves: Number((window.S.soloGM.websiteCounters && window.S.soloGM.websiteCounters.libraryDelves) || 0)
        };
      }
      return null;
    })();

    return {
      ok: true,
      hasJoinCopy,
      libraryModalTitle: modalTitle,
      soloModalTitle: soloTitle,
      hasObjectiveText: /Current Solo Goal/i.test(soloContent),
      soloState
    };
  });

  if (!prep || !prep.ok) {
    throw new Error(`Solo/Library smoke setup failed: ${JSON.stringify(prep)}`);
  }

  if (!prep.hasJoinCopy) {
    throw new Error(`Library hex info missing join action copy: ${JSON.stringify(prep)}`);
  }

  if (!/Infinite Library/i.test(prep.libraryModalTitle || "")) {
    throw new Error(`Library modal did not open correctly: ${JSON.stringify(prep)}`);
  }

  if (!/Solo-GM Console/i.test(prep.soloModalTitle || "")) {
    throw new Error(`Solo GM modal did not open correctly: ${JSON.stringify(prep)}`);
  }

  if (!prep.hasObjectiveText) {
    throw new Error(`Solo GM objective block missing: ${JSON.stringify(prep)}`);
  }

  if (prep.soloState && Number(prep.soloState.libraryDelves || 0) < 1) {
    throw new Error(`Solo GM did not track library delve counter: ${JSON.stringify(prep)}`);
  }

  process.stdout.write(`Solo/Library smoke passed: ${JSON.stringify(prep)}\n`);
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

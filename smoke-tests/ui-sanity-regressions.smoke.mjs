import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  const preferred = Number(process.env.PORT || 3000);
  if (Number.isFinite(preferred) && preferred > 0 && preferred < 65536) {
    if (await canBindPort(preferred)) return preferred;
  }
  for (let i = 0; i < 40; i += 1) {
    const p = 4000 + Math.floor(Math.random() * 2000);
    if (await canBindPort(p)) return p;
  }
  throw new Error("Unable to find a free port for sanity smoke test.");
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
    await wait(250);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

function startServer(port) {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) }
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

async function runChecks(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => typeof window.switchTab === "function" && typeof window.setContext === "function" && !!document.getElementById("tabnav-oracle"),
    null,
    { timeout: 15000 }
  );

  const bestiaryResult = await page.evaluate(() => {
    try {
      window.switchTab("codex", document.getElementById("tabnav-codex"));
      if (typeof window.showCodexCat === "function") {
        const activeBtn = document.querySelector(".codex-cats .scat.on") || null;
        window.showCodexCat("bestiary", activeBtn);
      }
      const content = document.getElementById("codexContent");
      const viewBtn = content
        ? Array.from(content.querySelectorAll("button")).find((b) => String(b.textContent || "").trim().toLowerCase() === "view")
        : null;
      if (!viewBtn) return { ok: false, reason: "View button not found in bestiary." };
      viewBtn.click();
      const overlay = document.getElementById("rollModal");
      const modalBody = document.getElementById("modalContent");
      const header = document.getElementById("modalTitle");
      const isOpen = !!(overlay && overlay.classList.contains("open"));
      const modalHasText = !!(modalBody && String(modalBody.textContent || "").trim().length > 20);
      const headerText = header ? String(header.textContent || "").trim() : "";
      return { ok: isOpen && modalHasText, isOpen, modalHasText, headerText };
    } catch (err) {
      return { ok: false, reason: String(err && err.message ? err.message : err) };
    }
  });

  if (!bestiaryResult.ok) {
    throw new Error(`Bestiary modal check failed: ${JSON.stringify(bestiaryResult)}`);
  }

  await dismissBlockingOverlays(page);

  const oracleVisibility = await page.evaluate(() => {
    const contexts = ["traveling", "holding", "sea", "space"];
    const out = {};
    for (const ctx of contexts) {
      window.setContext(ctx, null);
      const btn = document.getElementById("tabnav-oracle");
      if (!btn) {
        out[ctx] = { present: false, visible: false, display: "missing" };
        continue;
      }
      const cs = window.getComputedStyle(btn);
      const visible = cs.display !== "none" && cs.visibility !== "hidden";
      out[ctx] = { present: true, visible, display: cs.display };
    }
    const allVisible = contexts.every((ctx) => out[ctx] && out[ctx].visible);
    return { ok: allVisible, details: out };
  });

  if (!oracleVisibility.ok) {
    throw new Error(`Oracle visibility check failed: ${JSON.stringify(oracleVisibility)}`);
  }

  await page.evaluate(() => {
    window.setContext("traveling", null);
    window.switchTab("character", document.getElementById("tabnav-character"));
    if (window.settingsSystem && typeof window.settingsSystem.setTextSize === "function") {
      window.settingsSystem.setTextSize("large");
    } else {
      document.documentElement.style.fontSize = "18px";
      ["text-size-small", "text-size-medium", "text-size-large"].forEach((cls) => document.body.classList.remove(cls));
      document.body.classList.add("text-size-large");
    }
  });

  await page.waitForFunction(
    () => document.body.classList.contains("text-size-large") || String((document.documentElement && document.documentElement.style && document.documentElement.style.fontSize) || "") === "18px",
    null,
    { timeout: 8000 }
  );

  const largeTextResult = await page.evaluate(() => {

    const main = document.getElementById("main-content");
    const panel = document.getElementById("tab-character");
    const charGrid = panel ? panel.querySelector(".char-grid") : null;
    const equipmentInput = document.getElementById("eqWeapon1");
    const overflowX = main ? (main.scrollWidth - main.clientWidth) : 0;
    const panelOverflowX = panel ? (panel.scrollWidth - panel.clientWidth) : 0;
    const charGridOverflowX = charGrid ? (charGrid.scrollWidth - charGrid.clientWidth) : 0;

    let equipmentWithinViewport = false;
    if (equipmentInput) {
      const rect = equipmentInput.getBoundingClientRect();
      equipmentWithinViewport = rect.left >= 0 && rect.right <= window.innerWidth + 1;
    }

    const panelReadable = !!panel && window.getComputedStyle(panel).display !== "none";
    const bodyLargeClass = document.body.classList.contains("text-size-large");
    const rootFont = String((document.documentElement && document.documentElement.style && document.documentElement.style.fontSize) || "");
    const largeModeApplied = bodyLargeClass || rootFont === "18px";

    const ok = largeModeApplied && panelReadable && panelOverflowX <= 24 && charGridOverflowX <= 24 && equipmentWithinViewport;
    return {
      ok,
      bodyLargeClass,
      largeModeApplied,
      rootFont,
      panelReadable,
      overflowX,
      panelOverflowX,
      charGridOverflowX,
      equipmentWithinViewport,
      viewportWidth: window.innerWidth
    };
  });

  if (!largeTextResult.ok) {
    throw new Error(`Large text readability check failed: ${JSON.stringify(largeTextResult)}`);
  }

  return {
    bestiary: bestiaryResult,
    oracle: oracleVisibility,
    largeText: largeTextResult
  };
}

async function run() {
  const port = await pickPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServer(port);

  let browser;
  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const result = await runChecks(page, baseUrl);
    process.stdout.write(`UI sanity smoke passed: ${JSON.stringify(result)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

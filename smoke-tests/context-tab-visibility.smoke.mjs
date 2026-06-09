import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const CONTEXTS = ["traveling", "holding", "sea", "space"];
const REQUIRED_CORE_TAB_BY_CONTEXT = {
  traveling: "tabnav-character",
  holding: "tabnav-map",
  sea: "tabnav-lastsea",
  space: "tabnav-galaxy"
};

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

  await page.waitForFunction(() => typeof window.setContext === "function", null, { timeout: 20000 });

  const result = await page.evaluate(({ contexts, requiredCoreByContext }) => {
    const failures = [];
    const summaries = [];

    function getCtxTabs() {
      return Array.from(document.querySelectorAll("#mainNav .tab-btn[class*='ctx-']"));
    }

    function visibleTabIds(tabs) {
      return tabs
        .filter((el) => window.getComputedStyle(el).display !== "none")
        .map((el) => String(el.id || ""))
        .filter(Boolean);
    }

    for (const ctx of contexts) {
      const ctxBtn = document.querySelector(`.ctx-btn[data-ctx='${ctx}']`);
      window.setContext(ctx, ctxBtn || null);

      const tabs = getCtxTabs();
      const visible = visibleTabIds(tabs);

      const leaked = visible.filter((id) => {
        const el = document.getElementById(id);
        return !(el && el.classList && el.classList.contains(`ctx-${ctx}`));
      });

      const requiredCore = requiredCoreByContext[ctx] || null;
      const missingCore = requiredCore && !visible.includes(requiredCore) ? [requiredCore] : [];

      summaries.push({ ctx, visibleCount: visible.length, requiredCore, visible });

      if (missingCore.length || leaked.length) {
        failures.push({ ctx, missingCore, leaked, requiredCore, visible });
      }
    }

    const spaceSummary = summaries.find((s) => s.ctx === "space") || null;
    const expectedSpaceOrder = [
      "tabnav-oracle",
      "tabnav-missions",
      "tabnav-galaxy",
      "tabnav-worldthatwas",
      "tabnav-planet",
      "tabnav-naval",
      "tabnav-exocrafts",
      "tabnav-shop"
    ];
    if (spaceSummary) {
      const positions = expectedSpaceOrder.map((id) => spaceSummary.visible.indexOf(id));
      const missing = expectedSpaceOrder.filter((id) => !spaceSummary.visible.includes(id));
      const outOfOrder = positions.some((pos, idx) => idx > 0 && pos >= 0 && positions[idx - 1] >= 0 && pos < positions[idx - 1]);
      if (missing.length || outOfOrder) {
        failures.push({
          ctx: "space",
          missing,
          expectedSpaceOrder,
          visible: spaceSummary.visible,
          reason: outOfOrder ? "space tab order mismatch" : "required space tabs missing"
        });
      }
    }

    return {
      ok: failures.length === 0,
      failures,
      summaries
    };
  }, { contexts: CONTEXTS, requiredCoreByContext: REQUIRED_CORE_TAB_BY_CONTEXT });

  if (!result || !result.ok) {
    throw new Error(`Context tab visibility smoke failed: ${JSON.stringify(result)}`);
  }

  const compact = {
    ok: result.ok,
    contexts: (result.summaries || []).map((s) => ({
      ctx: s.ctx,
      expectedCount: s.expectedCount,
      visibleCount: s.visibleCount
    }))
  };
  process.stdout.write(`Context tab visibility smoke passed: ${JSON.stringify(compact)}\n`);
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

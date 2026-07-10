import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 25000;

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
    const p = 4200 + Math.floor(Math.random() * 1800);
    if (await canBindPort(p)) return p;
  }
  throw new Error("Unable to find a free port for GM Forge smoke.");
}

function startServer(port, tempRoot) {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      CAMPAIGN_STORE_PATH: process.env.CAMPAIGN_STORE_PATH || path.join(tempRoot, "campaign-data.json"),
      CAMPAIGN_SNAPSHOT_DIR: process.env.CAMPAIGN_SNAPSHOT_DIR || path.join(tempRoot, "snapshots"),
      LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH || path.join(tempRoot, "license-data.json")
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

  return child;
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_err) {}
    await wait(250);
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

async function run() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const tempRoot = path.join(os.tmpdir(), `btl-smoke-gm-forge-${stamp}`);
  const port = await pickPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServer(port, tempRoot);

  let browser;
  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await dismissBlockingOverlays(page);

    const summary = await page.evaluate(() => {
      if (!window.settingsSystem || !window.gmDashboard) {
        return { ok: false, error: "GM dashboard or settings system unavailable." };
      }
      if (typeof window.generateCharacter === "function") {
        try { window.generateCharacter(); } catch (_err) {}
      }
      window.settingsSystem.setGameMode("gm", { silent: true });
      window.prompt = () => "Automation Preset";
      window.gmDashboard.open();
      window.gmDashboard.applyPreset("rift-patrol");
      window.gmDashboard.saveCurrentPreset();
      const saved = JSON.parse(window.localStorage.getItem("btl-gm-forge-presets-v1") || "[]");
      const beforeJobs = Array.isArray(window.S && window.S.availableJobs) ? window.S.availableJobs.length : 0;
      window.gmDashboard.deployToBoard();
      const jobs = Array.isArray(window.S && window.S.availableJobs) ? window.S.availableJobs : [];
      const posted = jobs[jobs.length - 1] || null;
      window.gmDashboard.tab("chronicle");
      window.gmDashboard.setChronicleTitle("Automation Chronicle");
      window.gmDashboard.setChronicleBody("The crew breached the rift perimeter and marked the skyfall gate.");
      window.gmDashboard.addChronicleEntry();
      window.gmDashboard.setChronicleHook("The patrol captain escaped into the Lost City.");
      window.gmDashboard.addHook();
      const meta = window.S && window.S.gmForgeMeta && typeof window.S.gmForgeMeta === "object" ? window.S.gmForgeMeta : { chronicle: [], hooks: [] };

      return {
        ok: true,
        presetSaved: saved.some((row) => String(row && row.name || "") === "Automation Preset"),
        jobsBefore: beforeJobs,
        jobsAfter: jobs.length,
        posted,
        chronicleCount: Array.isArray(meta.chronicle) ? meta.chronicle.length : 0,
        hookCount: Array.isArray(meta.hooks) ? meta.hooks.length : 0
      };
    });

    if (!summary || !summary.ok) {
      throw new Error(`GM Forge smoke failed before assertions: ${JSON.stringify(summary)}`);
    }
    if (!summary.presetSaved) {
      throw new Error(`Preset save did not persist: ${JSON.stringify(summary)}`);
    }
    if (!(summary.jobsAfter > summary.jobsBefore)) {
      throw new Error(`Mission board did not receive a GM Forge job: ${JSON.stringify(summary)}`);
    }
    if (!summary.posted || !summary.posted.templateId || !summary.posted.templateLabel) {
      throw new Error(`Posted job missing template metadata: ${JSON.stringify(summary)}`);
    }
    if (!Array.isArray(summary.posted.unresolvedHooks) || !summary.posted.unresolvedHooks.length) {
      throw new Error(`Posted job missing unresolved hooks: ${JSON.stringify(summary)}`);
    }
    if (summary.chronicleCount < 1 || summary.hookCount < 1) {
      throw new Error(`Chronicle/hook local fallback did not update: ${JSON.stringify(summary)}`);
    }

    process.stdout.write(`GM Forge smoke passed: ${JSON.stringify(summary)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

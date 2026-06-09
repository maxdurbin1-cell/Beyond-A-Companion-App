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

async function resetPage(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(async () => {
    try { localStorage.removeItem("beyond-light-campaign-session"); } catch (_err) {}
    try {
      if (window.campaignSystem && window.campaignSystem.getState) {
        const st = window.campaignSystem.getState();
        if (st && st.code && typeof window.campaignSystem.leaveCampaign === "function") {
          await window.campaignSystem.leaveCampaign();
        }
      }
    } catch (_err) {}
    try {
      if (typeof window.closeModal === "function") window.closeModal();
    } catch (_err) {}
  });
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const gmPage = await browser.newPage();
    const playerPage = await browser.newPage();

    await resetPage(gmPage);
    await resetPage(playerPage);

    await gmPage.evaluate(() => {
      const el = document.getElementById("campaignNameInput");
      if (el) el.value = "Smoke GM";
    });
    await gmPage.evaluate(async () => {
      await window.campaignSystem.createCampaign();
    });

    const code = await gmPage.evaluate(() => window.campaignSystem.getState().code || "");
    if (!code) throw new Error("Campaign code was not created.");

    await playerPage.evaluate(async (campaignCode) => {
      await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Smoke Player" });
    }, code);
    await wait(1200);

    await gmPage.evaluate(() => {
      if (typeof window.switchTab === "function") {
        const btn = document.querySelector(".tab-btn[onclick*=\"switchTab('map'\"]");
        window.switchTab("map", btn || null);
      }
      if (typeof window.generateMap === "function") window.generateMap();
    });

    const synced = await gmPage.evaluate(async () => {
      for (let i = 0; i < 5; i += 1) {
        const out = await window.campaignSystem.syncSharedSilent("smoke-authority-map-" + i);
        if (out && out.ok) return out;
        await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
      }
      return { ok: false };
    });
    if (!synced || !synced.ok) throw new Error(`Initial province sync failed: ${JSON.stringify(synced)}`);

    await wait(1200);

    const encounter = await playerPage.evaluate(async () => {
      const state = window.getProvinceMapState();
      const hex = state.mapData.find((entry) => entry && entry.type === "wilderness") || state.mapData[0];
      const key = `${hex.col},${hex.row}`;
      if (typeof window.setProvinceSelectedKey === "function") {
        window.setProvinceSelectedKey(key);
      }
      for (let i = 0; i < 12; i += 1) {
        window.rollHexEncounter(hex.col, hex.row);
        await new Promise((resolve) => setTimeout(resolve, 120));
        const el = document.getElementById(`hexEnc-${hex.col}-${hex.row}`);
        const text = el ? el.innerText : "";
        if (text && !text.includes("Rolling encounter...")) {
          return { key, text };
        }
      }
      return { key, text: "" };
    });

    if (!encounter.text || encounter.text.includes("Encounter roll failed")) {
      throw new Error(`Province encounter did not resolve correctly: ${JSON.stringify(encounter)}`);
    }

    await wait(1600);

    const gmEncounterHtml = await gmPage.evaluate((key) => {
      const shared = window.campaignSystem.getSharedState();
      const province = shared && shared.provinceMap;
      const hex = province && Array.isArray(province.mapData)
        ? province.mapData.find((entry) => entry && `${entry.col},${entry.row}` === key)
        : null;
      return hex && hex.data ? String(hex.data.lastEncounterHtml || "") : "";
    }, encounter.key);

    if (!gmEncounterHtml) {
      throw new Error("GM did not receive shared province encounter output.");
    }

    const illegal = await playerPage.evaluate(async () => {
      return await window.campaignSystem.syncSharedPatch({ gmSettings: { mode: "active" } }, "smoke-illegal-gm-settings");
    });

    if (!illegal || illegal.ok) {
      throw new Error(`Illegal player patch should have been rejected: ${JSON.stringify(illegal)}`);
    }

    const gmMode = await gmPage.evaluate(() => {
      const shared = window.campaignSystem.getSharedState();
      return shared && shared.gmSettings ? shared.gmSettings.mode : "";
    });
    if (gmMode !== "passive") {
      throw new Error(`GM mode unexpectedly changed to ${gmMode}`);
    }

    const beforePhase = await gmPage.evaluate(() => {
      return window.S && window.S.gameDate ? Number(window.S.gameDate.phase || 0) : -1;
    });

    await gmPage.evaluate(() => {
      window.campaignSystem.gmInitiateTravel({
        label: "Last Sea",
        region: "sea",
        context: "sea",
        tab: "lastsea",
        phaseCost: 1,
        reason: "smoke-travel"
      });
    });

    await wait(500);

    await playerPage.evaluate(async () => {
      const shared = window.campaignSystem.getSharedState();
      const ready = shared && shared.readyCheck;
      if (ready && ready.id && ready.status === "pending") {
        await new Promise((resolve) => {
          window.campaignSystem.respondReadyCheck(true, () => resolve());
        });
      }
    });

    await wait(1800);

    const afterPhase = await gmPage.evaluate(() => {
      return window.S && window.S.gameDate ? Number(window.S.gameDate.phase || 0) : -1;
    });
    const activePlayerTab = await playerPage.evaluate(() => {
      const active = document.querySelector(".tab-panel.active");
      return active ? active.id : "";
    });

    if (beforePhase === afterPhase) {
      throw new Error(`Travel did not advance shared phase clock: before=${beforePhase}, after=${afterPhase}`);
    }
    if (activePlayerTab !== "tab-lastsea") {
      throw new Error(`Travel did not move player to Last Sea tab: ${activePlayerTab}`);
    }

    console.log(JSON.stringify({
      encounter: encounter.text.slice(0, 120),
      gmEncounterSynced: true,
      illegalPatchRejected: true,
      phaseAdvanced: true,
      activePlayerTab
    }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
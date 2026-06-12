import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = Math.max(20000, Number(process.env.SMOKE_START_TIMEOUT_MS) || 120000);
const STEP_TIMEOUT_MS = Math.max(15000, Number(process.env.SMOKE_STEP_TIMEOUT_MS) || 45000);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const stamp = `${process.pid}-${Date.now()}`;
  const tempRoot = path.join(os.tmpdir(), `btl-smoke-authority-travel-${stamp}`);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      HOST: process.env.HOST || "127.0.0.1",
      PORT: process.env.PORT || "3000",
      PAYWALL_DISABLED: process.env.PAYWALL_DISABLED || "1",
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
    await wait(300);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function resetPage(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(
    () => !!(window.campaignSystem && window.campaignSystem.getState && window.campaignSystem.getState().connected),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
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
    await playerPage.waitForFunction(
      (campaignCode) => {
        const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
        return !!(st && st.code === campaignCode && st.role === "player");
      },
      code,
      { timeout: STEP_TIMEOUT_MS }
    );

    const playerToken = await playerPage.evaluate(() => String(window.campaignSystem.getState().token || ""));
    if (!playerToken) throw new Error("Player token was not assigned.");

    await playerPage.evaluate(async () => {
      if (!window.S || typeof window.S !== "object") window.S = {};
      window.S.health = 10;
      window.S.maxHealth = 10;
      window.S.mentalStress = 0;
      window.S.maxMentalStress = 20;
      window.S.pathTokens = 0;
      if (typeof window.updateStressUI === "function") window.updateStressUI();
      if (typeof window.updateMentalStressUI === "function") window.updateMentalStressUI();
      const pathTokenEl = document.getElementById("pathTokensVal");
      if (pathTokenEl) pathTokenEl.textContent = "0";
      if (window.campaignSystem && typeof window.campaignSystem.syncCharacterToCampaign === "function") {
        await window.campaignSystem.syncCharacterToCampaign(true);
      }
    });

    await gmPage.waitForFunction(
      (token) => {
        const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
        const roster = st && st.campaign && Array.isArray(st.campaign.roster) ? st.campaign.roster : [];
        return roster.some((member) => String(member && member.token || "") === token && member.character && Number(member.character.maxHealth || 0) >= 10);
      },
      playerToken,
      { timeout: STEP_TIMEOUT_MS }
    );

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

    await gmPage.waitForFunction(
      () => {
        const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
          ? window.campaignSystem.getSharedState()
          : null;
        const province = shared && shared.provinceMap;
        return !!(province && Array.isArray(province.mapData) && province.mapData.length);
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const selectedKey = await gmPage.evaluate(() => {
      const province = window.getProvinceMapState();
      const current = String((province && province.selectedKey) || "");
      const targetHex = Array.isArray(province && province.mapData)
        ? province.mapData.find((entry) => entry && `${entry.col},${entry.row}` !== current)
        : null;
      if (!targetHex) return "";
      const key = `${targetHex.col},${targetHex.row}`;
      if (typeof window.setProvinceSelectedKey === "function") {
        window.setProvinceSelectedKey(key);
      }
      return key;
    });

    if (!selectedKey) {
      throw new Error("Could not choose a province hex for authority sync validation.");
    }

    await gmPage.waitForFunction(
      (key) => {
        const province = typeof window.getProvinceMapState === "function" ? window.getProvinceMapState() : null;
        const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
          ? window.campaignSystem.getSharedState()
          : null;
        const travel = shared && shared.campaignTravel;
        return !!(
          province
          && String(province.selectedKey || "") === key
          && shared
          && shared.provinceMap
          && String(shared.provinceMap.selectedKey || "") === key
          && travel
          && String(travel.provinceKey || "") === key
        );
      },
      selectedKey,
      { timeout: STEP_TIMEOUT_MS }
    );

    await playerPage.waitForFunction(
      (key) => {
        const province = typeof window.getProvinceMapState === "function" ? window.getProvinceMapState() : null;
        return !!(province && String(province.selectedKey || "") === key);
      },
      selectedKey,
      { timeout: STEP_TIMEOUT_MS }
    );

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

    const successCheckId = await gmPage.evaluate((targetToken) => {
      const out = window.campaignSystem.startGmPendingCheck({
        type: "shared-check",
        scope: "individual",
        label: "Smoke Success Check",
        stat: "lead",
        statOptions: ["lead"],
        dread: 6,
        context: "Smoke GM targeted success flow",
        stake: "Grant Path Tokens to a chosen wayfarer.",
        participants: [{ token: targetToken, name: "Smoke Player" }]
      });
      return out && out.ok ? String(out.id || "") : "";
    }, playerToken);

    if (!successCheckId) {
      throw new Error("GM could not create a pending success check.");
    }

    await playerPage.evaluate(async (checkId) => {
      const out = await window.campaignSystem.submitPendingCheck(checkId, {
        total: 8,
        dreadTotal: 4,
        die: 8,
        manual: true,
        method: "manual",
        notes: "Smoke success submission"
      });
      if (!out || !out.ok) {
        throw new Error(`submitPendingCheck failed: ${JSON.stringify(out)}`);
      }
    }, successCheckId);

    await gmPage.waitForFunction(
      (checkId) => {
        const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
          ? window.campaignSystem.getSharedState()
          : null;
        const active = shared && shared.pendingChecks && shared.pendingChecks.active;
        const check = active && active[checkId];
        return !!(check && Array.isArray(check.submissions) && check.submissions.length >= 1);
      },
      successCheckId,
      { timeout: STEP_TIMEOUT_MS }
    );

    const successApplied = await gmPage.evaluate(async (checkId, targetToken) => {
      const applied = await window.campaignSystem.applyGmCheckOutcome({
        checkId,
        label: "Smoke Success Check",
        outcome: "success",
        scope: "individual",
        targetTokens: [targetToken],
        characterDelta: { health: 0, mentalStress: 0, pathTokens: 2 },
        sharedDelta: { tmw: 0 }
      });
      if (!applied || !applied.ok) return applied || { ok: false, error: "Outcome apply failed." };
      const resolved = window.campaignSystem.resolveGmPendingCheck(checkId, {
        success: true,
        actionTotal: 8,
        dreadTotal: 4,
        margin: 4,
        resolvedVia: "smoke-test",
        effectsApplied: applied.applied || null
      });
      return { ok: !!resolved, applied: applied.applied || null };
    }, successCheckId, playerToken);

    if (!successApplied || !successApplied.ok) {
      throw new Error(`GM could not resolve success check: ${JSON.stringify(successApplied)}`);
    }

    await playerPage.waitForFunction(
      () => Number((window.S && window.S.pathTokens) || 0) === 2,
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const failureCheckId = await gmPage.evaluate(() => {
      const targets = window.campaignSystem.getRollPromptTargets();
      const participants = Array.isArray(targets)
        ? targets.map((row) => ({ token: String(row.token || ""), name: String(row.name || "Wayfarer") })).filter((row) => row.token)
        : [];
      const out = window.campaignSystem.startGmPendingCheck({
        type: "shared-check",
        scope: "party",
        label: "Smoke Failure Check",
        stat: "mind",
        statOptions: ["mind"],
        dread: 8,
        context: "Smoke GM party failure flow",
        stake: "Apply party pressure and teamwork recovery.",
        participants
      });
      return out && out.ok ? String(out.id || "") : "";
    });

    if (!failureCheckId) {
      throw new Error("GM could not create a pending failure check.");
    }

    await playerPage.evaluate(async (checkId) => {
      const out = await window.campaignSystem.submitPendingCheck(checkId, {
        total: 3,
        dreadTotal: 7,
        die: 6,
        manual: true,
        method: "manual",
        notes: "Smoke failure submission"
      });
      if (!out || !out.ok) {
        throw new Error(`submitPendingCheck failed: ${JSON.stringify(out)}`);
      }
    }, failureCheckId);

    await gmPage.waitForFunction(
      (checkId) => {
        const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
          ? window.campaignSystem.getSharedState()
          : null;
        const active = shared && shared.pendingChecks && shared.pendingChecks.active;
        const check = active && active[checkId];
        return !!(check && Array.isArray(check.submissions) && check.submissions.length >= 1);
      },
      failureCheckId,
      { timeout: STEP_TIMEOUT_MS }
    );

    const failureApplied = await gmPage.evaluate(async (checkId) => {
      const targets = window.campaignSystem.getRollPromptTargets();
      const targetTokens = Array.isArray(targets) ? targets.map((row) => String(row.token || "")).filter(Boolean) : [];
      const applied = await window.campaignSystem.applyGmCheckOutcome({
        checkId,
        label: "Smoke Failure Check",
        outcome: "failure",
        scope: "party",
        targetTokens,
        characterDelta: { health: 0, mentalStress: 2, pathTokens: 0 },
        sharedDelta: { tmw: 1 }
      });
      if (!applied || !applied.ok) return applied || { ok: false, error: "Outcome apply failed." };
      const resolved = window.campaignSystem.resolveGmPendingCheck(checkId, {
        success: false,
        actionTotal: 3,
        dreadTotal: 7,
        failedBy: 4,
        resolvedVia: "smoke-test",
        effectsApplied: applied.applied || null
      });
      return { ok: !!resolved, applied: applied.applied || null };
    }, failureCheckId);

    if (!failureApplied || !failureApplied.ok) {
      throw new Error(`GM could not resolve failure check: ${JSON.stringify(failureApplied)}`);
    }

    await playerPage.waitForFunction(
      () => Number((window.S && window.S.mentalStress) || 0) === 2,
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const sharedOutcomeState = await gmPage.evaluate(() => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : {};
      return {
        tmw: Number(shared.tmw || 0),
        pendingHistory: Array.isArray(shared.pendingChecks && shared.pendingChecks.history)
          ? shared.pendingChecks.history.length
          : 0
      };
    });

    if (sharedOutcomeState.tmw !== 1) {
      throw new Error(`Failure outcome did not increase shared TMW: ${JSON.stringify(sharedOutcomeState)}`);
    }
    if (sharedOutcomeState.pendingHistory < 2) {
      throw new Error(`Pending checks were not archived into history: ${JSON.stringify(sharedOutcomeState)}`);
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
      selectedKey,
      encounter: encounter.text.slice(0, 120),
      gmEncounterSynced: true,
      gmSelectionSynced: true,
      gmCheckSuccessApplied: true,
      gmCheckFailureApplied: true,
      illegalPatchRejected: true,
      phaseAdvanced: true,
      activePlayerTab,
      sharedTmw: sharedOutcomeState.tmw
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

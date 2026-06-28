import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 45000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPortOpen(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferredPort = 3000) {
  if (await checkPortOpen(preferredPort)) return preferredPort;
  for (let i = 0; i < 25; i += 1) {
    const candidate = 5300 + Math.floor(Math.random() * 1200);
    if (await checkPortOpen(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for campaign exploration sweep.");
}

function startServer(port) {
  const stamp = `${process.pid}-${Date.now()}`;
  const tempRoot = path.join(os.tmpdir(), `btl-smoke-campaign-exploration-${stamp}`);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
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

async function dismissBlockingOverlays(page) {
  await page.evaluate(() => {
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
    try {
      if (window.settingsSystem && typeof window.settingsSystem.closeSettings === "function") {
        window.settingsSystem.closeSettings();
      }
    } catch (_err) {}
  });
}

async function waitForCampaignReady(page) {
  await page.waitForFunction(
    () => !!(window.campaignSystem && window.campaignSystem.getState && window.campaignSystem.getState().connected),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
  await dismissBlockingOverlays(page);
}

async function clearSession(page) {
  await page.evaluate(async () => {
    try { localStorage.removeItem("beyond-light-campaign-session"); } catch (_err) {}
    try { sessionStorage.removeItem("beyond-light-campaign-session"); } catch (_err) {}
    try {
      if (window.campaignSystem && window.campaignSystem.getState) {
        const st = window.campaignSystem.getState();
        if (st && st.code && typeof window.campaignSystem.leaveCampaign === "function") {
          await window.campaignSystem.leaveCampaign();
        }
      }
    } catch (_err) {}
  });
  await dismissBlockingOverlays(page);
}

async function syncCharacter(page, name) {
  await page.evaluate(async (characterName) => {
    if ((!window.S || !window.S.stats) && typeof window.generateCharacter === "function") {
      try { window.generateCharacter(); } catch (_err) {}
    }
    const s = window.S = window.S || {};
    s.name = characterName;
    s.stats = Object.assign(
      { body: 8, strike: 8, shoot: 8, mind: 8, control: 8, lead: 8, spirit: 8, defend: 8 },
      s.stats || {}
    );
    s.backpack = ["Compass (1 slot)", "Blight Repellent (1 slot)", "Torch (1 slot)"];
    s.ownedHacks = ["Ping"];
    s.personalFlavors = ["Mercy"];
    s.flavor = "Mercy";
    s.credits = Math.max(500, Number(s.credits || 0));
    s.tmw = Math.max(6, Number(s.tmw || 0));
    if (window.campaignSystem && typeof window.campaignSystem.syncCharacterToCampaign === "function") {
      try {
        await window.campaignSystem.syncCharacterToCampaign(true);
      } catch (_err) {}
    }
  }, name);
}

async function switchTab(page, tab) {
  await page.evaluate((nextTab) => {
    const contextByTab = {
      map: "holding",
      lastsea: "sea",
      galaxy: "space",
      worldthatwas: "space",
      planet: "space",
      yessod: "space",
      exocrafts: "space",
      naval: "space"
    };
    const nextContext = contextByTab[nextTab];
    if (nextContext && typeof window.setContext === "function") {
      const ctxBtn = document.querySelector(`.ctx-btn[data-ctx="${nextContext}"]`);
      window.setContext(nextContext, ctxBtn || null);
    }
    if (typeof window.switchTab !== "function") return;
    const btn = document.querySelector(`#mainNav .tab-btn[data-tab="${nextTab}"]`)
      || document.getElementById(`tabnav-${nextTab}`);
    window.switchTab(nextTab, btn || null);
  }, tab);
  await dismissBlockingOverlays(page);
}

async function waitForActiveTab(page, tabPanelId) {
  await page.waitForFunction(
    (expected) => {
      const active = document.querySelector(".tab-panel.active");
      return !!(active && active.id === expected);
    },
    tabPanelId,
    { timeout: STEP_TIMEOUT_MS }
  );
}

async function syncShared(page, reason) {
  const out = await page.evaluate(async (syncReason) => {
    if (!window.campaignSystem || typeof window.campaignSystem.syncSharedSilent !== "function") {
      return { ok: false, error: "syncSharedSilent missing" };
    }
    for (let i = 0; i < 6; i += 1) {
      const res = await window.campaignSystem.syncSharedSilent(`${syncReason}-${i}`);
      if (res && res.ok) return res;
      await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
    }
    return { ok: false, error: "shared sync retries exhausted" };
  }, reason);
  if (!out || !out.ok) {
    throw new Error(`Shared sync failed for ${reason}: ${JSON.stringify(out)}`);
  }
}

async function waitForCampaignLogText(page, snippet) {
  await page.waitForFunction(
    (text) => {
      const st = window.campaignSystem && typeof window.campaignSystem.getState === "function"
        ? window.campaignSystem.getState()
        : null;
      const log = st && st.campaign && Array.isArray(st.campaign.log) ? st.campaign.log : [];
      return log.some((entry) => entry && String(entry.text || "").indexOf(text) >= 0);
    },
    snippet,
    { timeout: STEP_TIMEOUT_MS }
  );
}

async function respondPendingReadyCheck(page) {
  await page.waitForFunction(
    () => {
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      const ready = shared && shared.readyCheck;
      return !!(ready && ready.id && String(ready.status || "") === "pending");
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
  await page.evaluate(async () => {
    const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
      ? window.campaignSystem.getSharedState()
      : null;
    const ready = shared && shared.readyCheck;
    if (ready && ready.id && String(ready.status || "") === "pending") {
      await new Promise((resolve) => {
        window.campaignSystem.respondReadyCheck(true, () => resolve());
      });
    }
  });
}

async function collectReadyCheckDiagnostics(page) {
  return page.evaluate(() => {
    const st = window.campaignSystem && typeof window.campaignSystem.getState === "function"
      ? window.campaignSystem.getState()
      : null;
    const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
      ? window.campaignSystem.getSharedState()
      : null;
    const active = document.querySelector(".tab-panel.active");
    const modal = document.getElementById("modalTitle");
    return {
      role: st ? String(st.role || "") : "",
      connected: !!(st && st.connected),
      syncHealth: st ? String(st.syncHealth || "") : "",
      syncText: st ? String(st.syncText || "") : "",
      lastSharedVersion: st ? Number(st.lastSharedVersion || 0) : 0,
      campaignReadyCheck: shared && shared.readyCheck ? {
        id: String(shared.readyCheck.id || ""),
        status: String(shared.readyCheck.status || ""),
        type: String(shared.readyCheck.type || ""),
        label: String(shared.readyCheck.label || ""),
        requiredTokens: Array.isArray(shared.readyCheck.requiredTokens)
          ? shared.readyCheck.requiredTokens.map((token) => String(token || ""))
          : [],
        responseTokens: shared.readyCheck.responses && typeof shared.readyCheck.responses === "object"
          ? Object.keys(shared.readyCheck.responses)
          : []
      } : null,
      campaignTravel: shared && shared.campaignTravel ? {
        region: String(shared.campaignTravel.region || ""),
        context: String(shared.campaignTravel.context || ""),
        tab: String(shared.campaignTravel.tab || ""),
        phaseCost: Number(shared.campaignTravel.phaseCost || 0),
        reason: String(shared.campaignTravel.reason || "")
      } : null,
      activeTab: active ? active.id : "",
      activeContext: String(window._activeContext || ""),
      modalTitle: modal ? String(modal.textContent || "") : "",
      roster: st && st.campaign && Array.isArray(st.campaign.roster)
        ? st.campaign.roster.map((row) => ({
            token: String(row && row.token || ""),
            name: String(row && row.name || ""),
            role: String(row && row.role || ""),
            online: row ? row.online !== false : false
          }))
        : []
    };
  });
}

async function collectNavigationDiagnostics(page) {
  return page.evaluate(() => {
    const st = window.campaignSystem && typeof window.campaignSystem.getState === "function"
      ? window.campaignSystem.getState()
      : null;
    const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
      ? window.campaignSystem.getSharedState()
      : null;
    const active = document.querySelector(".tab-panel.active");
    const activeBtn = document.querySelector("#mainNavTablist .tab-btn.active[data-tab]");
    const starState = window.S && window.S.starSystem ? window.S.starSystem : null;
    return {
      role: st ? String(st.role || "") : "",
      connected: !!(st && st.connected),
      activeTab: active ? active.id : "",
      activeButton: activeBtn ? String(activeBtn.getAttribute("data-tab") || "") : "",
      activeContext: String(window._activeContext || ""),
      campaignTravel: shared && shared.campaignTravel ? {
        region: String(shared.campaignTravel.region || ""),
        context: String(shared.campaignTravel.context || ""),
        tab: String(shared.campaignTravel.tab || ""),
        phaseCost: Number(shared.campaignTravel.phaseCost || 0),
        reason: String(shared.campaignTravel.reason || "")
      } : null,
      readyCheck: shared && shared.readyCheck ? {
        id: String(shared.readyCheck.id || ""),
        status: String(shared.readyCheck.status || "")
      } : null,
      hasGalaxyData: !!(starState && Array.isArray(starState.hexes) && starState.hexes.length),
      modalTitle: String((document.getElementById("modalTitle") || {}).textContent || "")
    };
  });
}

async function runScenario(browser, baseUrl) {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gmPage = await gmContext.newPage();
  const playerPage = await playerContext.newPage();
  const pageErrors = [];
  const appUrl = new URL(baseUrl);
  appUrl.searchParams.set("skipIntro", "1");
  const appHref = appUrl.toString();

  gmPage.on("pageerror", (err) => pageErrors.push("gm: " + String(err && err.message ? err.message : err)));
  playerPage.on("pageerror", (err) => pageErrors.push("player: " + String(err && err.message ? err.message : err)));

  try {
    for (const page of [gmPage, playerPage]) {
      await page.goto(appHref, { waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForCampaignReady(page);
      await clearSession(page);
    }

    await gmPage.evaluate(() => {
      const el = document.getElementById("campaignNameInput");
      if (el) el.value = "Campaign Exploration Sweep";
    });
    await gmPage.evaluate(async () => {
      await window.campaignSystem.createCampaign();
    });
    await gmPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        return !!(st && st.code && st.role === "gm");
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const campaignCode = await gmPage.evaluate(() => {
      const st = window.campaignSystem.getState();
      return String(st && st.code || "");
    });
    if (!campaignCode) throw new Error("Failed to create campaign.");

    await playerPage.evaluate(async (code) => {
      await window.campaignSystem.joinCampaign("player", { code, name: "Aarav" });
    }, campaignCode);
    await playerPage.waitForFunction(
      (code) => {
        const st = window.campaignSystem.getState();
        return !!(st && st.code === code && st.role === "player");
      },
      campaignCode,
      { timeout: STEP_TIMEOUT_MS }
    );

    await syncCharacter(gmPage, "Sweep GM");
    await syncCharacter(playerPage, "Aarav");
    await gmPage.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        const roster = (st && st.campaign && Array.isArray(st.campaign.roster)) ? st.campaign.roster : [];
        return roster.length >= 2 && roster.every((row) => row && row.character);
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    await gmPage.evaluate(async () => {
      await new Promise((resolve) => {
        window.campaignSystem.setGmCameraLock(true, () => resolve());
      });
    });

    await switchTab(gmPage, "map");
    await gmPage.evaluate(() => {
      if (typeof window.generateMap === "function") window.generateMap();
    });
    await syncShared(gmPage, "campaign-exploration-province");

    await playerPage.waitForFunction(
      () => {
        const province = typeof window.getProvinceMapState === "function" ? window.getProvinceMapState() : null;
        return !!(province && Array.isArray(province.mapData) && province.mapData.length);
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );

    const playerShopImmediate = await playerPage.evaluate(() => {
      const snapshot = () => {
        const active = document.querySelector(".tab-panel.active");
        const activeBtn = document.querySelector("#mainNavTablist .tab-btn.active[data-tab]");
        return {
          activeTab: active ? active.id : "",
          activeButton: activeBtn ? String(activeBtn.getAttribute("data-tab") || "") : "",
          activeContext: String(window._activeContext || "")
        };
      };
      const before = snapshot();
      const shopBtn = document.getElementById("tabnav-shop")
        || document.querySelector('#mainNavTablist .tab-btn[data-tab="shop"]');
      let switchError = "";
      try {
        if (typeof window.switchTab === "function") {
          window.switchTab("shop", shopBtn || null);
        }
      } catch (err) {
        switchError = String(err && err.message ? err.message : err);
      }
      const after = snapshot();
      const active = document.querySelector(".tab-panel.active");
      const activeBtn = document.querySelector("#mainNavTablist .tab-btn.active[data-tab]");
      const shop = document.getElementById("tab-shop");
      return {
        before,
        after,
        switchError,
        activeTab: active ? active.id : "",
        activeButton: activeBtn ? String(activeBtn.getAttribute("data-tab") || "") : "",
        activeContext: String(window._activeContext || ""),
        shopPanelExists: !!shop,
        shopButtonVisible: !!(shopBtn && shopBtn.offsetParent !== null),
        shopButtons: shop ? shop.querySelectorAll("button").length : 0
      };
    });
    if (playerShopImmediate.activeTab !== "tab-shop") {
      throw new Error(`Player shop tab did not activate: ${JSON.stringify(playerShopImmediate)}`);
    }
    await playerPage.waitForTimeout(700);
    const playerShopStatus = await playerPage.evaluate(() => {
      const active = document.querySelector(".tab-panel.active");
      const tab = active ? active.id : "";
      const shop = document.getElementById("tab-shop");
      return {
        activeTab: tab,
        hasShopButtons: !!(shop && shop.querySelector("button"))
      };
    });
    if (playerShopStatus.activeTab !== "tab-shop" || !playerShopStatus.hasShopButtons) {
      throw new Error(`Player shop access failed under camera lock: ${JSON.stringify(playerShopStatus)}`);
    }

    await switchTab(playerPage, "map");
    await waitForActiveTab(playerPage, "tab-map");

    const provinceObservation = await playerPage.evaluate(() => {
      const province = typeof window.getProvinceMapState === "function" ? window.getProvinceMapState() : null;
      const mapData = province && Array.isArray(province.mapData) ? province.mapData : [];
      const candidate = mapData.find((hex) => {
        if (!hex || hex.type !== "wilderness") return false;
        const options = typeof window.getAvailableObservationDirections === "function"
          ? window.getAvailableObservationDirections(hex.col, hex.row)
          : [];
        return options.some((opt) => {
          const target = typeof window.getAdjacentHexByDirection === "function"
            ? window.getAdjacentHexByDirection(hex.col, hex.row, opt.key)
            : null;
          return !!(target && target.hex && target.hex.type === "wilderness");
        });
      });
      if (!candidate) return { ok: false, error: "No valid wilderness observation candidate found." };
      const key = `${candidate.col},${candidate.row}`;
      window.setProvinceSelectedKey(key);
      const dir = window.getAvailableObservationDirections(candidate.col, candidate.row).find((opt) => {
        const target = window.getAdjacentHexByDirection(candidate.col, candidate.row, opt.key);
        return !!(target && target.hex && target.hex.type === "wilderness");
      });
      if (!dir) return { ok: false, error: "No adjacent wilderness direction found." };
      const target = window.getAdjacentHexByDirection(candidate.col, candidate.row, dir.key);
      if (target && target.hex) target.hex.data = null;
      window.selectedDice = { action: 8, dread: 6 };
      window.performWildernessObservationManualRoll(candidate.col, candidate.row, dir.key, target);
      const actionInput = document.getElementById("wildcardActionValue");
      const dreadInput = document.getElementById("wildcardDreadValue");
      if (!actionInput || !dreadInput) return { ok: false, error: "Manual observation inputs did not render." };
      actionInput.value = "8";
      dreadInput.value = "4";
      window.finalizeWildernessManualRoll(candidate.col, candidate.row, dir.key, null);
      const refreshed = window.getAdjacentHexByDirection(candidate.col, candidate.row, dir.key);
      return {
        ok: true,
        modalTitle: String((document.getElementById("modalTitle") || {}).textContent || ""),
        targetDataExists: !!(refreshed && refreshed.hex && refreshed.hex.data && typeof refreshed.hex.data === "object"),
        targetWonder: refreshed && refreshed.hex && refreshed.hex.data ? String(refreshed.hex.data.wonder || "") : ""
      };
    });
    if (!provinceObservation.ok || !provinceObservation.targetDataExists || !/Observation/i.test(provinceObservation.modalTitle)) {
      throw new Error(`Province observe-adjacent flow failed: ${JSON.stringify(provinceObservation)}`);
    }

    const provinceEncounter = await playerPage.evaluate(async () => {
      const province = typeof window.getProvinceMapState === "function" ? window.getProvinceMapState() : null;
      const mapData = province && Array.isArray(province.mapData) ? province.mapData : [];
      const hex = mapData.find((entry) => entry && entry.type === "wilderness") || mapData[0];
      if (!hex) return { ok: false, error: "No province hex found for encounter." };
      window.setProvinceSelectedKey(`${hex.col},${hex.row}`);
      await new Promise((resolve) => setTimeout(resolve, 80));
      let el = document.getElementById(`hexEnc-${hex.col}-${hex.row}`);
      if (!el && typeof window.renderHexInfo === "function") {
        const liveSelected = window.selectedHex || (typeof window.resolveProvinceHexFromKey === "function"
          ? window.resolveProvinceHexFromKey(`${hex.col},${hex.row}`)
          : null);
        if (liveSelected) {
          window.renderHexInfo(liveSelected);
          await new Promise((resolve) => setTimeout(resolve, 80));
          el = document.getElementById(`hexEnc-${hex.col}-${hex.row}`);
        }
      }
      if (!el) {
        return {
          ok: false,
          error: "Province encounter panel missing.",
          selectedKey: typeof window.getProvinceSelectedKey === "function"
            ? String(window.getProvinceSelectedKey() || "")
            : "",
          selectedHexExists: !!window.selectedHex
        };
      }
      window.rollHexEncounter(hex.col, hex.row);
      await new Promise((resolve) => setTimeout(resolve, 180));
      el = document.getElementById(`hexEnc-${hex.col}-${hex.row}`);
      const liveProvince = typeof window.getProvinceMapState === "function" ? window.getProvinceMapState() : null;
      const liveHex = liveProvince && Array.isArray(liveProvince.mapData)
        ? liveProvince.mapData.find((entry) => entry && Number(entry.col) === Number(hex.col) && Number(entry.row) === Number(hex.row))
        : null;
      const persistedHtml = liveHex && liveHex.data && typeof liveHex.data === "object"
        ? String(liveHex.data.lastEncounterHtml || "")
        : "";
      let persistedText = "";
      if (persistedHtml) {
        const temp = document.createElement("div");
        temp.innerHTML = persistedHtml;
        persistedText = String(temp.textContent || temp.innerText || "").trim();
      }
      return {
        ok: !!(
          (el && String(el.innerText || "").trim())
          || persistedText
        ),
        text: el ? String(el.innerText || "").trim() : "",
        panelFound: !!el,
        persistedText
      };
    });
    if (!provinceEncounter.ok) {
      throw new Error(`Province encounter did not render for player: ${JSON.stringify(provinceEncounter)}`);
    }

    const gmTravelKickoff = await gmPage.evaluate(async () => {
      let callbackResult = null;
      window.campaignSystem.gmInitiateTravel({
        label: "Last Sea",
        region: "sea",
        context: "sea",
        tab: "lastsea",
        phaseCost: 1,
        reason: "campaign-exploration-sweep"
      }, (res) => {
        callbackResult = res || null;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      return {
        callbackResult,
        readyCheck: shared && shared.readyCheck ? {
          id: String(shared.readyCheck.id || ""),
          status: String(shared.readyCheck.status || ""),
          label: String(shared.readyCheck.label || ""),
          requiredTokens: Array.isArray(shared.readyCheck.requiredTokens)
            ? shared.readyCheck.requiredTokens.map((token) => String(token || ""))
            : [],
          responseTokens: shared.readyCheck.responses && typeof shared.readyCheck.responses === "object"
            ? Object.keys(shared.readyCheck.responses)
            : []
        } : null,
        campaignTravel: shared && shared.campaignTravel ? {
          region: String(shared.campaignTravel.region || ""),
          context: String(shared.campaignTravel.context || ""),
          tab: String(shared.campaignTravel.tab || ""),
          phaseCost: Number(shared.campaignTravel.phaseCost || 0),
          reason: String(shared.campaignTravel.reason || "")
        } : null
      };
    });
    if (!gmTravelKickoff.readyCheck || gmTravelKickoff.readyCheck.status !== "pending") {
      throw new Error(`GM travel kickoff did not create a ready check: ${JSON.stringify(gmTravelKickoff)}`);
    }
    await wait(400);
    try {
      await respondPendingReadyCheck(playerPage);
    } catch (err) {
      const [gmReadyDiag, playerReadyDiag] = await Promise.all([
        collectReadyCheckDiagnostics(gmPage),
        collectReadyCheckDiagnostics(playerPage)
      ]);
      throw new Error(
        `Ready check did not reach player after Sea travel. `
        + `GM=${JSON.stringify(gmReadyDiag)} `
        + `PLAYER=${JSON.stringify(playerReadyDiag)} `
        + `ERR=${String(err && err.message ? err.message : err)}`
      );
    }
    await wait(1600);
    const seaTravelStatus = await playerPage.evaluate(() => {
      const active = document.querySelector(".tab-panel.active");
      const st = window.campaignSystem && typeof window.campaignSystem.getState === "function"
        ? window.campaignSystem.getState()
        : null;
      const shared = window.campaignSystem && typeof window.campaignSystem.getSharedState === "function"
        ? window.campaignSystem.getSharedState()
        : null;
      return {
        activeTab: active ? active.id : "",
        activeContext: String(window._activeContext || ""),
        campaignTravel: shared && shared.campaignTravel ? {
          region: String(shared.campaignTravel.region || ""),
          context: String(shared.campaignTravel.context || ""),
          tab: String(shared.campaignTravel.tab || ""),
          phaseCost: Number(shared.campaignTravel.phaseCost || 0)
        } : null,
        role: st ? String(st.role || "") : "",
        connected: !!(st && st.connected)
      };
    });
    if (seaTravelStatus.activeTab !== "tab-lastsea") {
      throw new Error(`Player did not follow Sea travel: ${JSON.stringify(seaTravelStatus)}`);
    }

    await switchTab(gmPage, "galaxy");
    await gmPage.evaluate(() => {
      if (typeof window.generateStarSystemMap === "function") window.generateStarSystemMap("cluster");
    });
    await syncShared(gmPage, "campaign-exploration-galaxy");
    await switchTab(playerPage, "galaxy");
    try {
      await waitForActiveTab(playerPage, "tab-galaxy");
    } catch (err) {
      const [gmNavDiag, playerNavDiag] = await Promise.all([
        collectNavigationDiagnostics(gmPage),
        collectNavigationDiagnostics(playerPage)
      ]);
      throw new Error(
        `Galaxy navigation did not settle for player. `
        + `GM=${JSON.stringify(gmNavDiag)} `
        + `PLAYER=${JSON.stringify(playerNavDiag)} `
        + `ERR=${String(err && err.message ? err.message : err)}`
      );
    }

    const galaxyPrep = await gmPage.evaluate(() => {
      const starState = window.S && window.S.starSystem ? window.S.starSystem : null;
      const hexes = starState && Array.isArray(starState.hexes) ? starState.hexes : [];
      const current = hexes.find((hex) => hex && Number(hex.id) > 0) || hexes[0];
      if (!current) return { ok: false, error: "No galaxy hex found." };
      if (typeof window.selectStarHex === "function") window.selectStarHex(current.id);
      else if (typeof window.setCurrentStarHexById === "function") window.setCurrentStarHexById(current.id);
      else starState.currentHexId = current.id;
      return { ok: true, hexId: Number(current.id || 0) };
    });
    if (!galaxyPrep.ok) throw new Error(`Galaxy prep failed: ${JSON.stringify(galaxyPrep)}`);
    await syncShared(gmPage, "campaign-exploration-galaxy-focus");

    await playerPage.evaluate(() => {
      const starState = window.S && window.S.starSystem ? window.S.starSystem : null;
      const current = starState && Array.isArray(starState.hexes)
        ? (starState.hexes.find((hex) => hex && Number(hex.id) > 0) || starState.hexes[0])
        : null;
      if (current) {
        if (typeof window.selectStarHex === "function") window.selectStarHex(current.id);
        else if (typeof window.setCurrentStarHexById === "function") window.setCurrentStarHexById(current.id);
        else starState.currentHexId = current.id;
      }
      window.runGalaxyEncounterRoll();
    });
    await waitForCampaignLogText(gmPage, "Requesting GM action: roll the active galaxy encounter");

    const planetPrep = await gmPage.evaluate(() => {
      const starState = window.S && window.S.starSystem ? window.S.starSystem : null;
      const hexes = starState && Array.isArray(starState.hexes) ? starState.hexes : [];
      const planetHex = hexes.find((hex) => hex && hex.type === "planet");
      if (!planetHex) return { ok: false, error: "No planet hex generated." };
      if (typeof window.selectStarHex === "function") window.selectStarHex(planetHex.id);
      else if (typeof window.setCurrentStarHexById === "function") window.setCurrentStarHexById(planetHex.id);
      else starState.currentHexId = planetHex.id;
      starState.activePlanetHexId = planetHex.id;
      const state = typeof window.ensurePlanetSurfaceState === "function" ? window.ensurePlanetSurfaceState(planetHex) : null;
      if (!state || !Array.isArray(state.cells) || !state.cells.length) {
        return { ok: false, error: "Planet surface state missing." };
      }
      const merchantCell = state.cells.find((cell) => cell && cell.marker === "merchant_colony") || state.cells[0];
      merchantCell.marker = "merchant_colony";
      merchantCell.explored = true;
      state.selectedCellId = merchantCell.id;
      if (typeof window.renderPlanetExplorationPanel === "function") window.renderPlanetExplorationPanel();
      return { ok: true, cellId: Number(merchantCell.id || 0) };
    });
    if (!planetPrep.ok) throw new Error(`Planet prep failed: ${JSON.stringify(planetPrep)}`);
    await syncShared(gmPage, "campaign-exploration-planet");

    await switchTab(playerPage, "planet");
    await waitForActiveTab(playerPage, "tab-planet");
    const planetFlow = await playerPage.evaluate(() => {
      const starState = window.S && window.S.starSystem ? window.S.starSystem : null;
      const hexes = starState && Array.isArray(starState.hexes) ? starState.hexes : [];
      const planetHex = hexes.find((hex) => hex && hex.type === "planet");
      if (!planetHex) return { ok: false, error: "No planet hex visible on player." };
      starState.activePlanetHexId = planetHex.id;
      const state = typeof window.ensurePlanetSurfaceState === "function" ? window.ensurePlanetSurfaceState(planetHex) : null;
      if (!state || !Array.isArray(state.cells) || !state.cells.length) {
        return { ok: false, error: "Planet surface state missing for player." };
      }
      const merchantCell = state.cells.find((cell) => cell && cell.marker === "merchant_colony") || state.cells[0];
      merchantCell.marker = "merchant_colony";
      merchantCell.explored = true;
      state.selectedCellId = merchantCell.id;
      if (typeof window.renderPlanetExplorationPanel === "function") window.renderPlanetExplorationPanel();
      window.openPlanetMerchantMarket();
      const modalTitle = String((document.getElementById("modalTitle") || {}).textContent || "");
      const modalText = String((document.getElementById("modalContent") || {}).textContent || "");
      if (typeof window.closeModal === "function") window.closeModal();
      window.rollPlanetHexEncounter();
      return {
        ok: true,
        merchantVisible: /Merchant Market/i.test(modalTitle) && /Buy/i.test(modalText)
      };
    });
    if (!planetFlow.ok || !planetFlow.merchantVisible) {
      throw new Error(`Planet merchant flow failed for player: ${JSON.stringify(planetFlow)}`);
    }
    await waitForCampaignLogText(gmPage, "Requesting GM action: roll the active planet encounter");

    const yessodPrep = await gmPage.evaluate(() => {
      const starState = window.S && window.S.starSystem ? window.S.starSystem : null;
      if (!starState) return { ok: false, error: "Star system missing for Yessod." };
      starState.yessodUnlocked = true;
      const state = typeof window.ensureYessodState === "function" ? window.ensureYessodState() : null;
      if (!state || !Array.isArray(state.cells) || !state.cells.length) {
        return { ok: false, error: "Yessod state missing." };
      }
      const cell = state.cells.find((entry) => entry && entry.marker === "wilderness") || state.cells[0];
      state.selectedCellId = cell.id;
      if (typeof window.renderYessodPanel === "function") window.renderYessodPanel();
      return { ok: true, cellId: Number(cell.id || 0) };
    });
    if (!yessodPrep.ok) throw new Error(`Yessod prep failed: ${JSON.stringify(yessodPrep)}`);
    await syncShared(gmPage, "campaign-exploration-yessod");

    await switchTab(playerPage, "yessod");
    await waitForActiveTab(playerPage, "tab-yessod");
    await playerPage.evaluate(() => {
      if (window.S && window.S.starSystem) {
        window.S.starSystem.yessodUnlocked = true;
      }
      if (typeof window.ensureYessodState === "function") {
        const state = window.ensureYessodState();
        if (state && Array.isArray(state.cells) && state.cells.length && !state.selectedCellId) {
          state.selectedCellId = state.cells[0].id;
        }
      }
      if (typeof window.renderYessodPanel === "function") window.renderYessodPanel();
      window.rollYessodEncounter();
    });
    await waitForCampaignLogText(gmPage, "Requesting GM action: roll the active Yessod encounter");

    if (pageErrors.length) {
      throw new Error(`Page errors encountered: ${pageErrors.join(" | ")}`);
    }

    return {
      provinceObservation,
      provinceEncounter: {
        preview: provinceEncounter.text.slice(0, 120)
      },
      playerShopStatus,
      galaxyRequestLogged: true,
      planetFlow,
      yessodRequestLogged: true
    };
  } finally {
    await gmContext.close();
    await playerContext.close();
  }
}

async function main() {
  const preferredPort = Number(process.env.PORT || 3000) || 3000;
  const port = await pickAvailablePort(preferredPort);
  const baseUrl = process.env.SMOKE_URL || `http://127.0.0.1:${port}`;
  const server = startServer(port);
  let browser;
  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await launchChromium();
    const summary = await runScenario(browser, baseUrl);
    process.stdout.write(`[smoke] campaign-exploration-sweep summary: ${JSON.stringify(summary)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await wait(250);
      if (!server.killed) server.kill("SIGKILL");
    }
  }
}

main().catch((err) => {
  process.stderr.write(`[smoke] campaign-exploration-sweep failed: ${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

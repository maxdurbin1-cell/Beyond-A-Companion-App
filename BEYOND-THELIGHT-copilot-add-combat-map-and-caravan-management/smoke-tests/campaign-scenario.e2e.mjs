import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 25000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncSharedWithRetry(page, reason, options) {
  const opts = options || {};
  const retries = Number.isFinite(opts.retries) ? Number(opts.retries) : 4;
  const backoffMs = Array.isArray(opts.backoffMs) && opts.backoffMs.length
    ? opts.backoffMs.map((n) => Math.max(0, Number(n) || 0))
    : [150, 300, 600, 1200];

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await page.evaluate(async (payload) => {
      const sync = await window.campaignSystem.syncSharedSilent(payload.reason);
      return { ok: !!(sync && sync.ok), sync };
    }, { reason });
    if (result && result.ok) return result;

    const errText = String(result && result.sync && result.sync.error || "").toLowerCase();
    const retriable = errText.indexOf("sync already in flight") >= 0;
    if (!retriable || attempt >= retries) {
      return result;
    }
    const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
    await wait(delay);
  }
  return { ok: false, sync: { ok: false, error: "sync retry exhausted" } };
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
    } catch (_err) {
      // Retry until timeout.
    }
    await wait(350);
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
    try {
      localStorage.removeItem("beyond-light-campaign-session");
    } catch (_err) {}
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

async function collectMapSummary(page) {
  return page.evaluate(() => {
    const province = (typeof window.getProvinceMapState === "function") ? window.getProvinceMapState() : null;
    const provinceCells = province && Array.isArray(province.mapData) ? province.mapData.length : 0;
    const seaCells = (window.S && window.S.lastSea && Array.isArray(window.S.lastSea.map)) ? window.S.lastSea.map.length : 0;
    const galaxyCells = (window.S && window.S.starSystem && Array.isArray(window.S.starSystem.hexes)) ? window.S.starSystem.hexes.length : 0;
    const worldCells = (window.S && window.S.worldThatWas && Array.isArray(window.S.worldThatWas.hexes)) ? window.S.worldThatWas.hexes.length : 0;
    return { provinceCells, seaCells, galaxyCells, worldCells };
  });
}

async function collectStashSnapshot(page, label) {
  try {
    const snapshot = await page.evaluate(() => {
      const state = (window.campaignSystem && typeof window.campaignSystem.getState === "function")
        ? window.campaignSystem.getState()
        : null;
      const shared = state && state.campaign && state.campaign.shared && state.campaign.shared.state
        ? state.campaign.shared.state
        : {};
      const stash = Array.isArray(shared.partyStash) ? shared.partyStash.slice() : [];
      return {
        code: String(state && state.code || ""),
        role: String(state && state.role || ""),
        token: String(state && state.token || ""),
        connected: !!(state && state.connected),
        syncHealth: String(state && state.syncHealth || ""),
        syncText: String(state && state.syncText || ""),
        lastCampaignStateAt: Number(state && state.lastCampaignStateAt || 0),
        sharedVersion: Number(state && state.lastSharedVersion || 0),
        pendingSyncCount: Number(state && state.pendingSyncCount || 0),
        syncConflictCount: Number(state && state.syncConflictCount || 0),
        partyStash: stash,
        partyStashCount: stash.length
      };
    });
    return { label, ok: true, snapshot };
  } catch (err) {
    return {
      label,
      ok: false,
      error: String(err && err.message ? err.message : err)
    };
  }
}

async function waitForHydratedMaps(page, expected) {
  const goal = {
    provinceCells: Number(expected && expected.provinceCells || 0),
    seaCells: Number(expected && expected.seaCells || 0),
    galaxyCells: Number(expected && expected.galaxyCells || 0),
    worldCells: Number(expected && expected.worldCells || 0)
  };
  await page.waitForFunction(
    (target) => {
      const province = (typeof window.getProvinceMapState === "function") ? window.getProvinceMapState() : null;
      const provinceCells = province && Array.isArray(province.mapData) ? province.mapData.length : 0;
      const seaCells = (window.S && window.S.lastSea && Array.isArray(window.S.lastSea.map)) ? window.S.lastSea.map.length : 0;
      const galaxyCells = (window.S && window.S.starSystem && Array.isArray(window.S.starSystem.hexes)) ? window.S.starSystem.hexes.length : 0;
      const worldCells = (window.S && window.S.worldThatWas && Array.isArray(window.S.worldThatWas.hexes)) ? window.S.worldThatWas.hexes.length : 0;
      const provinceOk = target.provinceCells > 0 ? provinceCells > 0 : true;
      const seaOk = target.seaCells > 0 ? seaCells > 0 : true;
      const galaxyOk = target.galaxyCells > 0 ? galaxyCells > 0 : true;
      const worldOk = target.worldCells > 0 ? worldCells > 0 : true;
      return provinceOk && seaOk && galaxyOk && worldOk;
    },
    goal,
    { timeout: STEP_TIMEOUT_MS }
  );
}

async function runScenario(browser) {
  const gmPage = await browser.newPage();
  const p1Page = await browser.newPage();
  const p2Page = await browser.newPage();

  for (const page of [gmPage, p1Page, p2Page]) {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForCampaignReady(page);
    await clearSession(page);
  }

  await gmPage.evaluate(() => {
    const el = document.getElementById("campaignNameInput");
    if (el) el.value = "Scenario GM";
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

  const code = await gmPage.evaluate(() => window.campaignSystem.getState().code || "");
  if (!code) throw new Error("Campaign code not created by GM.");

  await p1Page.evaluate(async (campaignCode) => {
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Scenario P1" });
  }, code);
  await p2Page.evaluate(async (campaignCode) => {
    await window.campaignSystem.joinCampaign("player", { code: campaignCode, name: "Scenario P2" });
  }, code);

  for (const page of [p1Page, p2Page]) {
    await page.waitForFunction(
      (campaignCode) => {
        const st = window.campaignSystem.getState();
        return !!(st && st.code === campaignCode && st.role === "player");
      },
      code,
      { timeout: STEP_TIMEOUT_MS }
    );
  }

  await gmPage.evaluate(async () => {
    if (typeof window.generateMap === "function") window.generateMap();
    if (typeof window.generateLastSea === "function") window.generateLastSea();
    if (typeof window.generateStarSystemMap === "function") window.generateStarSystemMap("cluster");
    if (typeof window.generateWorldThatWasMap === "function") window.generateWorldThatWasMap();
  });

  const genRes = await syncSharedWithRetry(gmPage, "scenario-sync", {
    retries: 5,
    backoffMs: [200, 400, 800, 1200, 1600]
  });

  if (!genRes.ok) {
    throw new Error(`GM shared sync failed: ${JSON.stringify(genRes)}`);
  }

  const factionMissionFlow = await gmPage.evaluate(async () => {
    const out = {
      ok: false,
      error: "",
      acceptedMissionId: null,
      completedMissionId: null,
      completedMissionIds: [],
      completedRuns: 0,
      activeBefore: 0,
      activeAfterAccept: 0,
      activeAfterComplete: 0,
      completedBefore: 0,
      completedAfter: 0,
      pointsBefore: { heroic: 0, tyrant: 0, martyr: 0 },
      pointsAfter: { heroic: 0, tyrant: 0, martyr: 0 },
      finaleBeforeUnlocked: false,
      finaleAfterUnlocked: false,
      chosenFaction: "",
      chosenMission: ""
    };

    if (!window.factionSystem || !window.factionSystem.FACTIONS) {
      out.error = "Faction system is unavailable.";
      return out;
    }
    function resolveState() {
      try {
        return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
      } catch (_err) {
        return window.S || null;
      }
    }

    var stateRef = resolveState();
    if (!stateRef && typeof window.generateCharacter === "function") {
      try { window.generateCharacter(); } catch (_err) {}
      stateRef = resolveState();
    }
    if (!stateRef) {
      out.error = "Global state S is unavailable.";
      return out;
    }

    const factionIds = Object.keys(window.factionSystem.FACTIONS || {});
    if (!factionIds.length) {
      out.error = "No factions defined.";
      return out;
    }

    const factionId = factionIds[0];
    const faction = window.factionSystem.FACTIONS[factionId] || {};
    const mission = Array.isArray(faction.factionMissions) && faction.factionMissions.length
      ? faction.factionMissions[0]
      : null;
    if (!mission || !mission.id) {
      out.error = "No faction mission available for UI flow.";
      return out;
    }

    out.chosenFaction = factionId;
    out.chosenMission = String(mission.id);

    if (!stateRef.factionRenown || typeof stateRef.factionRenown !== "object") {
      stateRef.factionRenown = {};
    }
    for (var ri = 0; ri < factionIds.length; ri += 1) {
      var renownFactionId = factionIds[ri];
      stateRef.factionRenown[renownFactionId] = Math.max(10, Number(stateRef.factionRenown[renownFactionId] || 0));
    }
    out.activeBefore = Array.isArray(stateRef.activeMissions) ? stateRef.activeMissions.length : 0;
    out.completedBefore = Array.isArray(stateRef.completedMissions) ? stateRef.completedMissions.length : 0;

    if (!stateRef.factionNarrative || typeof stateRef.factionNarrative !== "object") {
      stateRef.factionNarrative = {};
    }
    if (!stateRef.factionNarrative.pathPoints || typeof stateRef.factionNarrative.pathPoints !== "object") {
      stateRef.factionNarrative.pathPoints = { heroic: 0, tyrant: 0, martyr: 0 };
    }
    if (!stateRef.factionNarrative.finale || typeof stateRef.factionNarrative.finale !== "object") {
      stateRef.factionNarrative.finale = { unlocked: false, key: "", revealed: false, unlockedAt: 0 };
    }
    const beforePoints = stateRef.factionNarrative.pathPoints;
    out.pointsBefore = {
      heroic: Number(beforePoints.heroic || 0),
      tyrant: Number(beforePoints.tyrant || 0),
      martyr: Number(beforePoints.martyr || 0)
    };
    out.finaleBeforeUnlocked = !!(stateRef.factionNarrative.finale && stateRef.factionNarrative.finale.unlocked);

    if (typeof window.factionSystem.expandFaction === "function") {
      try { window.factionSystem.expandFaction(factionId); } catch (_err) {}
      if (typeof window.closeModal === "function") {
        try { window.closeModal(); } catch (_err) {}
      }
    }

    if (typeof window.factionSystem.acceptFactionMission !== "function") {
      out.error = "acceptFactionMission UI action is unavailable.";
      return out;
    }

    if (typeof window.completeMissionStep !== "function" && typeof window.resolveMissionOutcome !== "function") {
      out.error = "Mission UI handlers are unavailable.";
      return out;
    }

    function runHeroicContract(nextFactionId, nextMissionId) {
      if (typeof window.factionSystem.acceptFactionMission !== "function") return { ok: false, error: "acceptFactionMission unavailable." };
      window.factionSystem.acceptFactionMission(nextFactionId, nextMissionId, "heroic");
      var activeContract = Array.isArray(stateRef.activeMissions)
        ? stateRef.activeMissions.find((m) => m && m.missionType === "faction_contract" && m.factionContract && m.factionContract.factionId === nextFactionId && String(m.factionContract.missionId) === String(nextMissionId))
        : null;
      if (!activeContract || !activeContract.id) {
        return { ok: false, error: "Faction mission was not assigned through UI flow." };
      }

      if (typeof window.completeMissionStep === "function") {
        window.completeMissionStep(activeContract.id, 1);
        window.completeMissionStep(activeContract.id, 2);
      }
      if (typeof window.resolveMissionOutcome === "function") {
        window.resolveMissionOutcome(activeContract.id, true);
      } else if (typeof window.completeMissionStep === "function") {
        window.completeMissionStep(activeContract.id, 3);
      }

      var completedContract = Array.isArray(stateRef.completedMissions)
        ? stateRef.completedMissions.find((m) => m && m.missionType === "faction_contract" && String(m.id) === String(activeContract.id))
        : null;
      if (!completedContract || !completedContract.id) {
        return { ok: false, error: "Faction mission did not complete through UI flow." };
      }

      return { ok: true, id: Number(completedContract.id) };
    }

    var firstRun = runHeroicContract(factionId, mission.id);
    if (!firstRun.ok) {
      out.error = firstRun.error || "First heroic contract failed.";
      return out;
    }
    out.acceptedMissionId = firstRun.id;
    out.completedMissionId = firstRun.id;
    out.completedMissionIds.push(firstRun.id);
    out.completedRuns = 1;
    out.activeAfterAccept = Array.isArray(stateRef.activeMissions) ? stateRef.activeMissions.length : 0;

    const heroicThreshold = 5;
    const used = {};
    used[String(factionId) + "::" + String(mission.id)] = true;

    for (var fi = 0; fi < factionIds.length; fi += 1) {
      var currentHeroic = Number((stateRef.factionNarrative && stateRef.factionNarrative.pathPoints && stateRef.factionNarrative.pathPoints.heroic) || 0);
      if (currentHeroic >= heroicThreshold) break;
      var fId = factionIds[fi];
      var fx = window.factionSystem.FACTIONS && window.factionSystem.FACTIONS[fId] ? window.factionSystem.FACTIONS[fId] : null;
      var mList = fx && Array.isArray(fx.factionMissions) ? fx.factionMissions : [];
      for (var mi = 0; mi < mList.length; mi += 1) {
        currentHeroic = Number((stateRef.factionNarrative && stateRef.factionNarrative.pathPoints && stateRef.factionNarrative.pathPoints.heroic) || 0);
        if (currentHeroic >= heroicThreshold) break;
        var mId = mList[mi] && mList[mi].id;
        var key = String(fId) + "::" + String(mId);
        if (!mId || used[key]) continue;
        used[key] = true;
        var run = runHeroicContract(fId, mId);
        if (run.ok) {
          out.completedMissionIds.push(run.id);
          out.completedRuns += 1;
        }
      }
    }

    out.activeAfterComplete = Array.isArray(stateRef.activeMissions) ? stateRef.activeMissions.length : 0;
    out.completedAfter = Array.isArray(stateRef.completedMissions) ? stateRef.completedMissions.length : 0;

    const afterPoints = (stateRef.factionNarrative && stateRef.factionNarrative.pathPoints) || { heroic: 0, tyrant: 0, martyr: 0 };
    out.pointsAfter = {
      heroic: Number(afterPoints.heroic || 0),
      tyrant: Number(afterPoints.tyrant || 0),
      martyr: Number(afterPoints.martyr || 0)
    };
    out.finaleAfterUnlocked = !!(stateRef.factionNarrative && stateRef.factionNarrative.finale && stateRef.factionNarrative.finale.unlocked);

    if (window.factionSystem && typeof window.factionSystem.openEndingsTab === "function") {
      try { window.factionSystem.openEndingsTab(); } catch (_err) {}
    }

    if (!window.S || typeof window.S !== "object") {
      window.S = {};
    }
    window.S.activeMissions = Array.isArray(stateRef.activeMissions) ? stateRef.activeMissions : [];
    window.S.completedMissions = Array.isArray(stateRef.completedMissions) ? stateRef.completedMissions : [];
    window.S.factionRenown = stateRef.factionRenown && typeof stateRef.factionRenown === "object" ? stateRef.factionRenown : {};
    window.S.factionBases = stateRef.factionBases && typeof stateRef.factionBases === "object" ? stateRef.factionBases : {};
    window.S.factionWayfarerTasks = Array.isArray(stateRef.factionWayfarerTasks) ? stateRef.factionWayfarerTasks : [];
    window.S.factionNarrative = stateRef.factionNarrative && typeof stateRef.factionNarrative === "object" ? stateRef.factionNarrative : {};

    const syncRes = await window.campaignSystem.syncSharedSilent("scenario-ui-faction-mission");
    out.ok = !!(syncRes && syncRes.ok);
    if (!out.ok) out.error = (syncRes && syncRes.error) || "UI flow sync failed.";
    return out;
  });
  if (factionMissionFlow && !factionMissionFlow.ok && String(factionMissionFlow.error || "").toLowerCase().indexOf("sync already in flight") >= 0) {
    const postFlowRetry = await syncSharedWithRetry(gmPage, "scenario-ui-faction-mission", {
      retries: 5,
      backoffMs: [200, 400, 800, 1200, 1600]
    });
    if (postFlowRetry && postFlowRetry.ok) {
      factionMissionFlow.ok = true;
      factionMissionFlow.error = "";
    }
  }
  if (!factionMissionFlow || !factionMissionFlow.ok) {
    throw new Error(`Faction mission UI flow failed: ${JSON.stringify(factionMissionFlow)}`);
  }
  if (
    !factionMissionFlow.acceptedMissionId
  ) {
    throw new Error(`Mission assignment assertion failed: ${JSON.stringify(factionMissionFlow)}`);
  }
  if (
    Number(factionMissionFlow.completedAfter || 0) <= Number(factionMissionFlow.completedBefore || 0) ||
    !factionMissionFlow.completedMissionId
  ) {
    throw new Error(`Mission completion assertion failed: ${JSON.stringify(factionMissionFlow)}`);
  }
  if (Number(factionMissionFlow.pointsAfter.heroic || 0) <= Number(factionMissionFlow.pointsBefore.heroic || 0)) {
    throw new Error(`Faction progression assertion failed: ${JSON.stringify(factionMissionFlow)}`);
  }
  if (
    !!factionMissionFlow.finaleBeforeUnlocked ||
    !factionMissionFlow.finaleAfterUnlocked ||
    Number(factionMissionFlow.pointsAfter.heroic || 0) < 5
  ) {
    throw new Error(`Endings unlock assertion failed: ${JSON.stringify(factionMissionFlow)}`);
  }

  const gmSummary = await collectMapSummary(gmPage);
  await waitForHydratedMaps(p1Page, gmSummary);
  await waitForHydratedMaps(p2Page, gmSummary);

  const shareAck = await p1Page.evaluate(async () => {
    const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
    if (!st || !st.code || !st.token || typeof window.io !== "function") {
      return { ok: false, error: "Missing player state/socket." };
    }
    return await new Promise((resolve) => {
      const s = window.io({ transports: ["websocket", "polling"] });
      const done = (payload) => {
        try { s.disconnect(); } catch (_err) {}
        resolve(payload || { ok: false, error: "No response" });
      };
      s.on("connect_error", (err) => done({ ok: false, error: String(err && err.message ? err.message : err) }));
      s.on("connect", () => {
        s.emit("campaign:join", {
          code: st.code,
          token: st.token,
          role: "player",
          name: "Scenario P1"
        }, (joinAck) => {
          if (!joinAck || !joinAck.ok) {
            done({ ok: false, error: (joinAck && joinAck.error) || "join failed" });
            return;
          }
          s.emit("campaign:stashShare", { item: "Scenario Relic" }, (shareRes) => {
            done(shareRes);
          });
        });
      });
      setTimeout(() => done({ ok: false, error: "stash share timed out" }), 12000);
    });
  });
  if (!shareAck || !shareAck.ok) {
    throw new Error(`Stash share failed: ${JSON.stringify(shareAck)}`);
  }

  try {
    await p2Page.waitForFunction(
      () => {
        const st = window.campaignSystem.getState();
        const shared = st && st.campaign && st.campaign.shared && st.campaign.shared.state ? st.campaign.shared.state : {};
        return Array.isArray(shared.partyStash) && shared.partyStash.indexOf("Scenario Relic") >= 0;
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    );
  } catch (err) {
    const snapshots = await Promise.all([
      collectStashSnapshot(gmPage, "gm"),
      collectStashSnapshot(p1Page, "player1"),
      collectStashSnapshot(p2Page, "player2")
    ]);
    throw new Error(
      "Stash sync wait timed out for Scenario Relic: "
      + JSON.stringify({
        timeoutMs: STEP_TIMEOUT_MS,
        shareAck,
        snapshots,
        error: String(err && err.message ? err.message : err)
      })
    );
  }

  const claimAck = await p2Page.evaluate(async () => {
    const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
    if (!st || !st.code || !st.token || typeof window.io !== "function") {
      return { ok: false, error: "Missing player state/socket." };
    }
    const claimRes = await new Promise((resolve) => {
      const s = window.io({ transports: ["websocket", "polling"] });
      const done = (payload) => {
        try { s.disconnect(); } catch (_err) {}
        resolve(payload || { ok: false, error: "No response" });
      };
      s.on("connect_error", (err) => done({ ok: false, error: String(err && err.message ? err.message : err) }));
      s.on("connect", () => {
        s.emit("campaign:join", {
          code: st.code,
          token: st.token,
          role: "player",
          name: "Scenario P2"
        }, (joinAck) => {
          if (!joinAck || !joinAck.ok) {
            done({ ok: false, error: (joinAck && joinAck.error) || "join failed" });
            return;
          }
          s.emit("campaign:stashClaim", { index: 0 }, (claimResult) => {
            done(claimResult);
          });
        });
      });
      setTimeout(() => done({ ok: false, error: "stash claim timed out" }), 12000);
    });

    if (!window.S || !Array.isArray(window.S.backpack)) {
      if (!window.S) window.S = {};
      window.S.backpack = Array(10).fill("");
    }
    var item = String((claimRes && claimRes.item) || "").trim();
    if (item) {
      var slot = window.S.backpack.indexOf("");
      if (slot >= 0) window.S.backpack[slot] = item;
    }
    return claimRes;
  });
  if (!claimAck || !claimAck.ok || String(claimAck.item || "") !== "Scenario Relic") {
    throw new Error(`Stash claim failed: ${JSON.stringify(claimAck)}`);
  }

  const renownAck = await gmPage.evaluate(async () => {
    const st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
    if (!st || !st.code || !st.token || typeof window.io !== "function") {
      return { ok: false, error: "Missing GM state/socket." };
    }
    return await new Promise((resolve) => {
      const s = window.io({ transports: ["websocket", "polling"] });
      const done = (payload) => {
        try { s.disconnect(); } catch (_err) {}
        resolve(payload || { ok: false, error: "No response" });
      };
      s.on("connect_error", (err) => done({ ok: false, error: String(err && err.message ? err.message : err) }));
      s.on("connect", () => {
        s.emit("campaign:join", {
          code: st.code,
          token: st.token,
          role: "gm",
          name: "Scenario GM"
        }, (joinAck) => {
          if (!joinAck || !joinAck.ok) {
            done({ ok: false, error: (joinAck && joinAck.error) || "join failed" });
            return;
          }
          s.emit("campaign:deltaRenown", { delta: 2, reason: "scenario" }, (deltaAck) => {
            done(deltaAck);
          });
        });
      });
      setTimeout(() => done({ ok: false, error: "delta renown timed out" }), 12000);
    });
  });
  if (!renownAck || !renownAck.ok) {
    throw new Error(`Renown delta failed: ${JSON.stringify(renownAck)}`);
  }

  await p1Page.waitForFunction(
    () => {
      var st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
      var shared = st && st.campaign && st.campaign.shared && st.campaign.shared.state ? st.campaign.shared.state : {};
      return Number(shared.renown || 0) >= 2;
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const resyncAck = await p1Page.evaluate(async () => {
    const before = Date.now();
    await window.campaignSystem.requestResync();
    const st = window.campaignSystem.getState();
    return {
      code: st && st.code,
      tookMs: Date.now() - before
    };
  });
  if (!resyncAck || !resyncAck.code) {
    throw new Error(`Player requestResync failed: ${JSON.stringify(resyncAck)}`);
  }

  const snapshotInfo = await gmPage.evaluate(async () => {
    const st = window.campaignSystem.getState();
    if (!st || !st.code || !st.token || typeof window.io !== "function") {
      return { ok: false, error: "Missing GM state/socket." };
    }
    return await new Promise((resolve) => {
      const s = window.io({ transports: ["websocket", "polling"] });
      const done = (payload) => {
        try { s.disconnect(); } catch (_err) {}
        resolve(payload || { ok: false, error: "No response" });
      };
      s.on("connect_error", (err) => done({ ok: false, error: String(err && err.message ? err.message : err) }));
      s.on("connect", () => {
        s.emit("campaign:join", {
          code: st.code,
          token: st.token,
          role: "gm",
          name: "Scenario GM"
        }, (joinAck) => {
          if (!joinAck || !joinAck.ok) {
            done({ ok: false, error: (joinAck && joinAck.error) || "join failed" });
            return;
          }
          s.emit("campaign:exportSnapshot", {}, (exportAck) => {
            if (!exportAck || !exportAck.ok || !exportAck.snapshot) {
              done({ ok: false, error: (exportAck && exportAck.error) || "export failed" });
              return;
            }
            s.emit("campaign:importSnapshot", { snapshot: exportAck.snapshot }, (importAck) => {
              done({ ok: !!(importAck && importAck.ok), exportOk: true, importAck });
            });
          });
        });
      });
      setTimeout(() => done({ ok: false, error: "snapshot socket timed out" }), 12000);
    });
  });

  if (!snapshotInfo || !snapshotInfo.ok) {
    throw new Error(`Snapshot export/import assertion failed: ${JSON.stringify(snapshotInfo)}`);
  }

  const p1Faction = await p1Page.evaluate(() => {
    var st = window.campaignSystem && window.campaignSystem.getState ? window.campaignSystem.getState() : null;
    var shared = st && st.campaign && st.campaign.shared && st.campaign.shared.state ? st.campaign.shared.state : {};
    var completed = Array.isArray(shared && shared.completedMissions) ? shared.completedMissions : [];
    var heroicPoints = shared && shared.factionNarrative && shared.factionNarrative.pathPoints
      ? Number(shared.factionNarrative.pathPoints.heroic || 0)
      : 0;
    var completedContracts = shared && shared.factionNarrative && Array.isArray(shared.factionNarrative.completedContracts)
      ? shared.factionNarrative.completedContracts.length
      : 0;
    var finaleUnlocked = !!(shared && shared.factionNarrative && shared.factionNarrative.finale && shared.factionNarrative.finale.unlocked);
    var hasCompletedFactionContract = completed.some(function (m) {
      return !!(m && m.missionType === "faction_contract");
    });
    return {
      completedFactionContract: hasCompletedFactionContract,
      heroicPoints: heroicPoints,
      completedContracts: completedContracts,
      finaleUnlocked: finaleUnlocked
    };
  });
  if (
    !p1Faction.completedFactionContract ||
    Number(p1Faction.heroicPoints || 0) < 5 ||
    Number(p1Faction.completedContracts || 0) < 5 ||
    !p1Faction.finaleUnlocked
  ) {
    throw new Error(`Faction contract sync assertion failed: ${JSON.stringify(p1Faction)}`);
  }

  process.stdout.write(`Campaign scenario passed: code=${code}, requestResyncMs=${resyncAck.tookMs}, factionMissions=${factionMissionFlow.completedRuns}, heroic=${factionMissionFlow.pointsAfter.heroic}, endingsUnlocked=${String(factionMissionFlow.finaleAfterUnlocked)}\n`);

  await gmPage.close();
  await p1Page.close();
  await p2Page.close();
}

async function run() {
  const server = startServer();
  let browser;

  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    await runScenario(browser);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  }
}

run().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});

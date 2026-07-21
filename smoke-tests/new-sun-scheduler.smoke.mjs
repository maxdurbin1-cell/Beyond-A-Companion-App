import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 30000;

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

async function runScenario(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);

  await page.waitForFunction(
    () => {
      return !!(
        window.setSolarCycleStoryModeEnabled &&
        window.syncSolarCycleQuestScheduler &&
        window.resolveSolarCycleSchedulerQuest &&
        window.getSolarCycleStatus
      );
    },
    null,
    { timeout: STEP_TIMEOUT_MS }
  );

  const summary = await page.evaluate(async () => {
    let smokeRandomState = 0x5eed1234;
    Math.random = () => {
      smokeRandomState = (Math.imul(smokeRandomState, 1664525) + 1013904223) >>> 0;
      return smokeRandomState / 0x100000000;
    };
    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }

    if (typeof window.generateMap === "function") window.generateMap();
    if (typeof window.generateLastSea === "function") window.generateLastSea();
    if (typeof window.generateWorldThatWasMap === "function") window.generateWorldThatWasMap();
    if (typeof window.generateStarSystemMap === "function") window.generateStarSystemMap("cluster");

    if (typeof window.setSolarCycleStoryModeEnabled === "function") {
      window.setSolarCycleStoryModeEnabled(true);
    }
    if (typeof window.startSolarCycleMode === "function") {
      window.startSolarCycleMode("relic");
    }
    if (typeof window.setSolarCycleRouteMode === "function") {
      window.setSolarCycleRouteMode("straight");
    }

    const phaseCount = (typeof window.getActiveDayPhases === "function") ? window.getActiveDayPhases().length : 4;

    function resolveState() {
      try {
        return Function("return (typeof S !== 'undefined' && S) ? S : (window.S || null);")();
      } catch (_err) {
        return window.S || null;
      }
    }

    function getQs() {
      const stateRef = resolveState();
      return (stateRef && stateRef.solarCycle && stateRef.solarCycle.questScheduler)
        ? stateRef.solarCycle.questScheduler
        : null;
    }

    function activeQuests(qs, region) {
      if (!qs || !Array.isArray(qs.activeQuestIds)) return [];
      return qs.activeQuestIds
        .map((id) => (qs.questById ? qs.questById[id] : null))
        .filter((q) => q && !q.resolved && !q.expired && (!region || q.region === region));
    }

    function findPortalHandoffQuest(qs, sourceQuestId) {
      if (!qs) return null;
      var sourceId = String(sourceQuestId || '');
      var active = activeQuests(qs, 'wtw');
      var match = active.find(function (q) {
        if (!q || q.resolved || q.expired) return false;
        if (sourceId && (String(q.portalHandoffSource || '') === sourceId || String(q.sourceQuestId || '') === sourceId)) return true;
        return /portal handoff/i.test(String(q.title || ''));
      });
      if (match) return match;

      var byId = qs.questById && typeof qs.questById === 'object'
        ? Object.keys(qs.questById).map(function (id) { return qs.questById[id]; })
        : [];
      match = byId.find(function (q) {
        if (!q || q.resolved || q.expired || String(q.region || '') !== 'wtw') return false;
        if (sourceId && (String(q.portalHandoffSource || '') === sourceId || String(q.sourceQuestId || '') === sourceId)) return true;
        return /portal handoff/i.test(String(q.title || ''));
      });
      if (match) return match;

      match = byId.find(function (q) {
        if (!q || String(q.region || '') !== 'wtw') return false;
        if (sourceId && (String(q.portalHandoffSource || '') === sourceId || String(q.sourceQuestId || '') === sourceId)) return true;
        return /portal handoff/i.test(String(q.title || ''));
      });
      if (match) return match;

      if (qs.wtwQuestByHex && typeof qs.wtwQuestByHex === 'object') {
        var hexIds = Object.keys(qs.wtwQuestByHex);
        for (var i = 0; i < hexIds.length; i += 1) {
          var qid = qs.wtwQuestByHex[hexIds[i]];
          var q = qs.questById ? qs.questById[qid] : null;
          if (!q || q.resolved || q.expired || String(q.region || '') !== 'wtw') continue;
          if (sourceId && (String(q.portalHandoffSource || '') === sourceId || String(q.sourceQuestId || '') === sourceId)) return q;
          if (/portal handoff/i.test(String(q.title || ''))) return q;
        }
        for (var j = 0; j < hexIds.length; j += 1) {
          var qidAny = qs.wtwQuestByHex[hexIds[j]];
          var qAny = qs.questById ? qs.questById[qidAny] : null;
          if (!qAny || String(qAny.region || '') !== 'wtw') continue;
          if (sourceId && (String(qAny.portalHandoffSource || '') === sourceId || String(qAny.sourceQuestId || '') === sourceId)) return qAny;
          if (/portal handoff/i.test(String(qAny.title || ''))) return qAny;
        }
      }
      return null;
    }

    function alignQuestWindow(quest) {
      const stateRef = resolveState();
      if (!quest || !stateRef || !stateRef.gameDate || !stateRef.solarCycle) return;
      const sc = stateRef.solarCycle;
      const currentDay = Number(sc.daysElapsed || 0);
      const startDay = Number(quest.startDay || 0);
      if (currentDay < startDay && typeof window.progressSolarCycleDay === "function") {
        window.progressSolarCycleDay(startDay - currentDay);
      }

      const windowList = Array.isArray(quest.phaseWindow) ? quest.phaseWindow.slice() : [];
      if (windowList.length) {
        stateRef.gameDate.phase = Number(windowList[0] || 0) % phaseCount;
      }
    }

    function resolveQuest(quest, approach) {
      if (!quest) return false;
      alignQuestWindow(quest);
      return !!(typeof window.resolveSolarCycleSchedulerQuest === "function" && window.resolveSolarCycleSchedulerQuest(quest.id, approach || "investigate"));
    }

    if (typeof window.syncSolarCycleQuestScheduler === "function") window.syncSolarCycleQuestScheduler(true);

    let guard = 0;
    while (guard < 900) {
      guard += 1;
      const qs = getQs();
      if (!qs) break;
      const doneProvince = Number(qs.completedByRegion && qs.completedByRegion.province || 0);
      const doneSea = Number(qs.completedByRegion && qs.completedByRegion.sea || 0);
      if (doneProvince >= 10 && doneSea >= 2) break;

      if (typeof window.syncSolarCycleQuestScheduler === "function") window.syncSolarCycleQuestScheduler(true);
      const currentQs = getQs();
      const targetRegion = doneProvince < 10 ? "province" : "sea";
      const pick = activeQuests(currentQs, targetRegion)[0] || activeQuests(currentQs)[0];
      if (!pick) {
        if (typeof window.progressSolarCycleDay === "function") window.progressSolarCycleDay(1);
        continue;
      }
      resolveQuest(pick, "investigate");
    }

    const qsAfterVolume = getQs();
    const provinceDone = Number(qsAfterVolume && qsAfterVolume.completedByRegion && qsAfterVolume.completedByRegion.province || 0);
    const seaDone = Number(qsAfterVolume && qsAfterVolume.completedByRegion && qsAfterVolume.completedByRegion.sea || 0);
    if (provinceDone < 10 || seaDone < 2) {
      throw new Error(`Early volume ramp check failed: province=${provinceDone}, sea=${seaDone}`);
    }

    if (typeof window.syncSolarCycleQuestScheduler === "function") window.syncSolarCycleQuestScheduler(true);
    let qs = getQs();
    let expiryQuest = activeQuests(qs)[0] || null;
    if (!expiryQuest) {
      let expirySearch = 0;
      while (expirySearch < 25 && !expiryQuest) {
        expirySearch += 1;
        if (typeof window.progressSolarCycleDay === "function") window.progressSolarCycleDay(1);
        if (typeof window.syncSolarCycleQuestScheduler === "function") window.syncSolarCycleQuestScheduler(true);
        qs = getQs();
        expiryQuest = activeQuests(qs)[0] || null;
      }
    }
    if (!expiryQuest) throw new Error("Could not acquire quest for expiry assertion.");

    const blockedPhase = (() => {
      const allowed = Array.isArray(expiryQuest.phaseWindow) ? expiryQuest.phaseWindow : [];
      for (let i = 0; i < phaseCount; i += 1) {
        if (allowed.indexOf(i) < 0) return i;
      }
      return (Number(allowed[0] || 0) + 1) % phaseCount;
    })();

    const expiryStateRef = resolveState();
    if (expiryStateRef && expiryStateRef.gameDate) {
      expiryStateRef.gameDate.phase = blockedPhase;
    }

    const scForExpiry = expiryStateRef && expiryStateRef.solarCycle ? expiryStateRef.solarCycle : null;
    const nowDay = Number(scForExpiry && scForExpiry.daysElapsed || 0);
    const daysToExpire = Math.max(1, Number(expiryQuest.endDay || nowDay) - nowDay + 1);
    if (typeof window.progressSolarCycleDay === "function") window.progressSolarCycleDay(daysToExpire);
    if (typeof window.syncSolarCycleQuestScheduler === "function") window.syncSolarCycleQuestScheduler(false);

    qs = getQs();
    const expiryState = qs && qs.questById ? qs.questById[expiryQuest.id] : null;
    if (!expiryState || !expiryState.expired) {
      throw new Error("Day/phase expiry assertion failed: quest did not expire after window close.");
    }

    let portalSourceQuestId = "";
    let handoffQuestId = "";
    let portalGuard = 0;
    while (portalGuard < 220 && !handoffQuestId) {
      portalGuard += 1;
      if (typeof window.syncSolarCycleQuestScheduler === "function") window.syncSolarCycleQuestScheduler(true);
      qs = getQs();
      var preexistingHandoff = findPortalHandoffQuest(qs, portalSourceQuestId);
      if (preexistingHandoff) {
        handoffQuestId = String(preexistingHandoff.id || '');
        break;
      }
      const portalSea = activeQuests(qs, "sea").find((q) => !!q.portalHandoff);
      if (!portalSea) {
        const anySea = activeQuests(qs, "sea")[0];
        if (!anySea) {
          if (typeof window.progressSolarCycleDay === "function") window.progressSolarCycleDay(1);
          continue;
        }
        resolveQuest(anySea, "investigate");
        continue;
      }

      portalSourceQuestId = portalSea.id;
      if (!resolveQuest(portalSea, "portal")) {
        continue;
      }

      qs = getQs();
      const handoff = findPortalHandoffQuest(qs, portalSourceQuestId);
      if (handoff) handoffQuestId = handoff.id;
    }

    if (!handoffQuestId) {
      throw new Error("Sea -> WTW portal handoff assertion failed: no WTW handoff quest became active.");
    }

    let seaVolumeGuard = 0;
    while (seaVolumeGuard < 1000) {
      seaVolumeGuard += 1;
      qs = getQs();
      const doneSeaNow = Number(qs && qs.completedByRegion && qs.completedByRegion.sea || 0);
      if (doneSeaNow >= 6) break;
      if (typeof window.syncSolarCycleQuestScheduler === "function") window.syncSolarCycleQuestScheduler(true);
      qs = getQs();
      const seaQuest = activeQuests(qs, "sea")[0] || activeQuests(qs)[0];
      if (!seaQuest) {
        if (typeof window.progressSolarCycleDay === "function") window.progressSolarCycleDay(1);
        continue;
      }
      resolveQuest(seaQuest, "investigate");
    }

    qs = getQs();
    const seaDoneFinal = Number(qs && qs.completedByRegion && qs.completedByRegion.sea || 0);
    if (seaDoneFinal < 6) {
      throw new Error(`High-volume Sea completion assertion failed: sea=${seaDoneFinal}`);
    }

    let diversityGuard = 0;
    while (diversityGuard < 260) {
      diversityGuard += 1;
      qs = getQs();
      const clueSet = new Set((qs && Array.isArray(qs.clueLedger) ? qs.clueLedger : []).map((row) => row && row.methodId).filter(Boolean));
      if (clueSet.size >= 3) break;

      if (typeof window.syncSolarCycleQuestScheduler === "function") window.syncSolarCycleQuestScheduler(true);
      qs = getQs();
      const q = activeQuests(qs)[0];
      if (!q) {
        if (typeof window.progressSolarCycleDay === "function") window.progressSolarCycleDay(1);
        continue;
      }
      resolveQuest(q, "investigate");
    }

    qs = getQs();
    const clueSet = new Set((qs && Array.isArray(qs.clueLedger) ? qs.clueLedger : []).map((row) => row && row.methodId).filter(Boolean));
    if (clueSet.size < 3) {
      throw new Error(`Clue diversity assertion failed: uniqueMethods=${clueSet.size}`);
    }

    return {
      provinceDone: Number(qs && qs.completedByRegion && qs.completedByRegion.province || 0),
      seaDone: Number(qs && qs.completedByRegion && qs.completedByRegion.sea || 0),
      wtwDone: Number(qs && qs.completedByRegion && qs.completedByRegion.wtw || 0),
      galaxyDone: Number(qs && qs.completedByRegion && qs.completedByRegion.galaxy || 0),
      clueCount: Number(qs && Array.isArray(qs.clueLedger) ? qs.clueLedger.length : 0),
      uniqueMethods: clueSet.size,
      portalSourceQuestId,
      handoffQuestId
    };
  });

  if (pageErrors.length) {
    throw new Error(`Page errors detected during scheduler smoke: ${pageErrors.join(" | ")}`);
  }

  console.log(
    `New Sun scheduler smoke passed: province=${summary.provinceDone}, sea=${summary.seaDone}, wtw=${summary.wtwDone}, galaxy=${summary.galaxyDone}, clues=${summary.clueCount}, uniqueMethods=${summary.uniqueMethods}, portal=${summary.portalSourceQuestId}->${summary.handoffQuestId}`
  );
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
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

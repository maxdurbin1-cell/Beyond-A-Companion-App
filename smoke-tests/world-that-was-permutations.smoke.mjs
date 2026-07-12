import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 30000;
const CHROME_EXECUTABLE = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferredPort = 3101) {
  if (await canBindPort(preferredPort)) return preferredPort;
  for (let i = 0; i < 32; i += 1) {
    const candidate = 5600 + Math.floor(Math.random() * 1200);
    if (await canBindPort(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for World That Was permutations smoke.");
}

function startServer(port) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) }
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
      if (typeof window.closeModal === "function") window.closeModal();
    } catch (_err) {}
  });
}

async function bootWorldThatWas(page) {
  await page.evaluate(() => {
    function byId(id) {
      return document.getElementById(id);
    }

    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }
    if (typeof window.setContext === "function") {
      window.setContext("space", document.querySelector(".ctx-btn[data-ctx='space']") || null);
    }
    if (typeof window.switchTab === "function") {
      window.switchTab("worldthatwas", byId("tabnav-worldthatwas") || null);
    }
    if (typeof window.generateWorldThatWasMap === "function") {
      window.generateWorldThatWasMap();
    }
    if (window.S) window.S.credits = 5000;
    if (typeof window.setCredits === "function") window.setCredits(5000);
    if (typeof window.updateCreditsUI === "function") window.updateCreditsUI();
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();

    window.__wtwSmoke = {
      setRollQueue(totals) {
        this.originalExplodingRoll = window.explodingRoll;
        const queue = Array.isArray(totals) ? totals.slice() : [];
        window.explodingRoll = function smokeExplodingRoll(die) {
          const total = queue.length ? Number(queue.shift()) : 1;
          return { total, die: Number(die || 0), exploded: false, rolls: [total] };
        };
      },
      restoreRolls() {
        if (this.originalExplodingRoll) {
          window.explodingRoll = this.originalExplodingRoll;
          this.originalExplodingRoll = null;
        }
      },
      clearConds() {
        if (window.S && window.S.conditions) {
          Object.keys(window.S.conditions).forEach((key) => {
            window.S.conditions[key] = false;
          });
        }
      },
      pickServiceHex() {
        const w = window.S && window.S.worldThatWas;
        const hex = (w.hexes || []).find((entry) => entry && entry.serviceNode);
        if (!hex) throw new Error("No service hex found.");
        w.currentZone = hex.zone;
        w.selectedHexId = hex.id;
        return hex.id;
      },
      pickEventHex() {
        const w = window.S && window.S.worldThatWas;
        const hex = (w.hexes || []).find((entry) => entry && entry.narrative);
        if (!hex) throw new Error("No event hex found.");
        w.currentZone = hex.zone;
        w.selectedHexId = hex.id;
        return hex.id;
      },
      seedSkillEvent(title) {
        const w = window.S && window.S.worldThatWas;
        const hex = (w.hexes || []).find((entry) => entry && entry.id === w.selectedHexId);
        if (!hex) throw new Error("No selected hex for event seed.");
        hex.skirmish = false;
        hex.narrative = hex.narrative || {};
        hex.narrative.event = {
          title: title || "Smoke Event",
          text: "A deterministic event for smoke coverage.",
          action: "Make the explicit Valor roll.",
          reward: "Credits and supplies.",
          mode: "skill",
          stat: "valor",
          dread: 8
        };
        return { hexId: hex.id, title: hex.narrative.event.title };
      },
      seedCombatEvent(title) {
        const w = window.S && window.S.worldThatWas;
        const hex = (w.hexes || []).find((entry) => entry && entry.id === w.selectedHexId);
        if (!hex) throw new Error("No selected hex for combat event seed.");
        hex.skirmish = false;
        hex.narrative = hex.narrative || {};
        hex.narrative.event = {
          title: title || "Smoke Combat Event",
          text: "A deterministic combat event for smoke coverage.",
          action: "Fight through the ambush.",
          reward: "Credits, scrap, and loot.",
          mode: "combat",
          enemies: 2,
          enemyName: "Smoke Hostile",
          enemyDesc: "Synthetic combat test enemy.",
          dread: 8,
          enemyHealth: 16
        };
        return { hexId: hex.id, title: hex.narrative.event.title };
      },
      seedTask(id, tmw) {
        const w = window.S && window.S.worldThatWas;
        const hex = (w.hexes || []).find((entry) => entry && entry.id === w.selectedHexId);
        if (!hex) throw new Error("No selected hex for task seed.");
        const power = String(hex.controller || (w.zones || []).find((z) => z.name === hex.zone)?.leader || "Syndicates");
        w.activeTasks = [{
          id,
          title: `Smoke Task ${id}`,
          power,
          hexId: hex.id,
          dread: 8,
          rewardCredits: 150,
          rewardTier: "medium",
          status: "open"
        }];
        hex.skirmish = false;
        if (window.S) {
          window.S.tmw = Number(tmw || 0);
          window.S.successRolls = 0;
          window.S.successRollCount = 0;
        }
        this.clearConds();
        return { hexId: hex.id, power };
      },
      getTaskSummary() {
        const panel = document.getElementById("wtwInfo");
        return panel ? String(panel.textContent || "") : "";
      },
      getState() {
        const w = window.S && window.S.worldThatWas;
        const hex = (w.hexes || []).find((entry) => entry && entry.id === w.selectedHexId) || null;
        return {
          credits: Number((window.S && window.S.credits) || 0),
          tmw: Number((window.S && window.S.tmw) || 0),
          skirmish: !!(hex && hex.skirmish),
          focused: !!(window.S && window.S.conditions && window.S.conditions.focused),
          distracted: !!(window.S && window.S.conditions && window.S.conditions.distracted),
          pendingCelebration: !!(hex && hex.pendingServiceCelebration),
          activeTasks: Array.isArray(w.activeTasks) ? w.activeTasks.length : 0,
          selectedHexId: hex ? String(hex.id) : "",
          eventTitle: String((hex && hex.narrative && hex.narrative.event && hex.narrative.event.title) || "")
        };
      }
    };
  });

  await page.waitForFunction(
    () => !!(
      document.getElementById("tab-worldthatwas") &&
      document.getElementById("wtwInfo") &&
      window.__wtwSmoke &&
      window.wtwResolveEvent &&
      window.wtwCompleteTask &&
      window.wtwBuyService
    ),
    null,
    { timeout: STEP_TIMEOUT_MS }
  );
}

async function openAccordion(page, title) {
  await page.waitForFunction(
    (expectedTitle) => {
      const root = document.getElementById("wtwInfo");
      if (!root) return false;
      return Array.from(root.querySelectorAll("summary")).some((node) => {
        return String(node.textContent || "").includes(String(expectedTitle || ""));
      });
    },
    title,
    { timeout: STEP_TIMEOUT_MS }
  );

  const summary = page.locator("#wtwInfo summary").filter({ hasText: title }).first();
  if (await summary.count()) {
    try {
      await summary.click();
      return;
    } catch (_err) {
      // Fall back to a direct DOM click if Playwright catches a transient layout race.
    }
  }

  const opened = await page.evaluate((expectedTitle) => {
    const root = document.getElementById("wtwInfo");
    if (!root) return false;
    const details = Array.from(root.querySelectorAll("details")).find((node) => {
      const summaryNode = node.querySelector("summary");
      return summaryNode && String(summaryNode.textContent || "").includes(String(expectedTitle || ""));
    });
    if (!details) return false;
    if (!details.open) {
      const summaryNode = details.querySelector("summary");
      if (summaryNode && typeof summaryNode.click === "function") summaryNode.click();
    }
    return !!details.open || !!details.querySelector("summary");
  }, title);

  if (!opened) {
    throw new Error(`Could not open accordion "${title}".`);
  }
}

async function assertTextContains(page, expected, label) {
  const text = await page.locator("#wtwInfo").textContent();
  if (!text || !text.includes(expected)) {
    throw new Error(`${label} missing expected text: ${expected}`);
  }
}

async function setRollQueue(page, totals) {
  await page.evaluate((vals) => {
    window.__wtwSmoke.setRollQueue(vals);
  }, totals);
}

async function restoreRolls(page) {
  await page.evaluate(() => {
    window.__wtwSmoke.restoreRolls();
  });
}

async function closeOpenModal(page) {
  await page.evaluate(() => {
    if (typeof window.closeModal === "function") window.closeModal();
  });
}

async function clickButtonContaining(page, text, root = "#wtwInfo") {
  const btn = page.locator(`${root} button:visible`).filter({ hasText: text }).first();
  await btn.click();
}

async function runScenario(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  const url = new URL(baseUrl);
  url.searchParams.set("skipIntro", "1");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissBlockingOverlays(page);
  await bootWorldThatWas(page);

  const summary = {};

  process.stdout.write("[smoke] step: service setup\n");
  await page.evaluate(() => {
    window.__wtwSmoke.pickServiceHex();
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  await openAccordion(page, "District Services");
  await assertTextContains(page, "Buy Service", "service accordion");
  await assertTextContains(page, "Roll Celebration Event", "service accordion");
  const creditsBeforeService = await page.evaluate(() => window.__wtwSmoke.getState().credits);
  await clickButtonContaining(page, "Buy Service", "#wtwInfo");
  const creditsAfterService = await page.evaluate(() => window.__wtwSmoke.getState().credits);
  if (!(creditsAfterService < creditsBeforeService)) {
    throw new Error(`Service purchase did not spend credits (${creditsBeforeService} -> ${creditsAfterService}).`);
  }
  await clickButtonContaining(page, "Roll Celebration Event", "#wtwInfo");
  await assertTextContains(page, "vs DD", "celebration action buttons");
  await setRollQueue(page, [10, 1]);
  await clickButtonContaining(page, "Lead vs DD", "#wtwInfo");
  await restoreRolls(page);
  const celebrationState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (celebrationState.pendingCelebration) {
    throw new Error("Celebration did not resolve.");
  }
  summary.servicePurchase = { before: creditsBeforeService, after: creditsAfterService };

  process.stdout.write("[smoke] step: event success/failure\n");
  await page.evaluate(() => {
    window.__wtwSmoke.pickEventHex();
    window.__wtwSmoke.seedSkillEvent("Smoke Success Event");
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  await assertTextContains(page, "Roll Valor vs DD8", "event button");
  const creditsBeforeEventSuccess = await page.evaluate(() => window.__wtwSmoke.getState().credits);
  await setRollQueue(page, [10, 1]);
  await clickButtonContaining(page, "Roll Valor vs DD8", "#wtwInfo");
  await restoreRolls(page);
  const eventSuccessState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (!(eventSuccessState.credits >= creditsBeforeEventSuccess + 50)) {
    throw new Error(`Event success rewards did not apply (${creditsBeforeEventSuccess} -> ${eventSuccessState.credits}).`);
  }
  if (eventSuccessState.skirmish) {
    throw new Error("Event success incorrectly triggered skirmish.");
  }

  await page.evaluate(() => {
    window.__wtwSmoke.seedSkillEvent("Smoke Failure Event");
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  await setRollQueue(page, [1, 10]);
  await clickButtonContaining(page, "Roll Valor vs DD8", "#wtwInfo");
  await restoreRolls(page);
  const eventFailureState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (!eventFailureState.skirmish) {
    throw new Error("Event failure did not trigger skirmish.");
  }
  summary.eventStates = { successCredits: eventSuccessState.credits, failureSkirmish: eventFailureState.skirmish };

  process.stdout.write("[smoke] step: combat event branches\n");
  await page.evaluate(() => {
    window.__wtwSmoke.seedCombatEvent("Smoke Combat Victory");
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  await assertTextContains(page, "Open Combat + Quick Access", "combat event actions");
  const creditsBeforeCombatVictory = await page.evaluate(() => window.__wtwSmoke.getState().credits);
  await clickButtonContaining(page, "Victory", "#wtwInfo");
  const combatVictoryState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (!(combatVictoryState.credits >= creditsBeforeCombatVictory + 90) || combatVictoryState.skirmish) {
    throw new Error(`Combat event victory branch incorrect: ${JSON.stringify(combatVictoryState)}`);
  }

  await page.evaluate(() => {
    window.__wtwSmoke.seedCombatEvent("Smoke Combat Failure");
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  const tmwBeforeCombatFailure = await page.evaluate(() => window.__wtwSmoke.getState().tmw);
  await clickButtonContaining(page, "Defeat", "#wtwInfo");
  const combatFailureState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (!combatFailureState.skirmish || combatFailureState.tmw !== tmwBeforeCombatFailure + 1) {
    throw new Error(`Combat event failure branch incorrect: ${JSON.stringify(combatFailureState)}`);
  }
  summary.eventStates.combatVictoryCredits = combatVictoryState.credits;
  summary.eventStates.combatFailureSkirmish = combatFailureState.skirmish;

  process.stdout.write("[smoke] step: task accept\n");
  await page.evaluate(() => {
    window.__wtwSmoke.seedTask("accept", 0);
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  await openAccordion(page, "Zone Power & Tasks");
  await assertTextContains(page, "Roll: Valor vs D8", "task copy");
  await assertTextContains(page, "Failure: accept for +1 Teamwork and a skirmish", "task failure copy");
  await setRollQueue(page, [1, 10]);
  await clickButtonContaining(page, "Roll Valor vs D8", "#wtwInfo");
  await restoreRolls(page);
  await clickButtonContaining(page, "Accept (+1 Teamwork)", "body");
  const acceptState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (acceptState.tmw !== 1 || !acceptState.skirmish || acceptState.activeTasks !== 0) {
    throw new Error(`Accept failure branch incorrect: ${JSON.stringify(acceptState)}`);
  }

  process.stdout.write("[smoke] step: task teamwork convert\n");
  const creditsBeforeTeamwork = await page.evaluate(() => window.__wtwSmoke.getState().credits);
  await page.evaluate(() => {
    window.__wtwSmoke.seedTask("teamwork", 3);
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  await setRollQueue(page, [1, 10]);
  await clickButtonContaining(page, "Roll Valor vs D8", "#wtwInfo");
  await restoreRolls(page);
  await clickButtonContaining(page, "Spend 3 Teamwork", "body");
  const teamworkState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (teamworkState.tmw !== 0 || teamworkState.activeTasks !== 0 || teamworkState.credits <= creditsBeforeTeamwork) {
    throw new Error(`Teamwork conversion branch incorrect: ${JSON.stringify(teamworkState)}`);
  }
  await closeOpenModal(page);

  process.stdout.write("[smoke] step: task push success\n");
  await page.evaluate(() => {
    window.__wtwSmoke.seedTask("push-success", 2);
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  await setRollQueue(page, [1, 10, 10, 1]);
  await clickButtonContaining(page, "Roll Valor vs D8", "#wtwInfo");
  await clickButtonContaining(page, "Push Luck 2 TMW", "body");
  await restoreRolls(page);
  const pushSuccessState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (pushSuccessState.tmw !== 0 || !pushSuccessState.focused || pushSuccessState.activeTasks !== 0 || pushSuccessState.skirmish) {
    throw new Error(`Push luck success branch incorrect: ${JSON.stringify(pushSuccessState)}`);
  }
  await closeOpenModal(page);

  process.stdout.write("[smoke] step: task push failure\n");
  await page.evaluate(() => {
    window.__wtwSmoke.seedTask("push-failure", 2);
    if (typeof window.renderWorldThatWas === "function") window.renderWorldThatWas();
  });
  await setRollQueue(page, [1, 10, 1, 10]);
  await clickButtonContaining(page, "Roll Valor vs D8", "#wtwInfo");
  await clickButtonContaining(page, "Push Luck 2 TMW", "body");
  await restoreRolls(page);
  const pushFailureState = await page.evaluate(() => window.__wtwSmoke.getState());
  if (pushFailureState.tmw !== 1 || !pushFailureState.distracted || pushFailureState.activeTasks !== 0 || !pushFailureState.skirmish) {
    throw new Error(`Push luck failure branch incorrect: ${JSON.stringify(pushFailureState)}`);
  }
  summary.taskBranches = {
    accept: acceptState,
    teamwork: teamworkState,
    pushSuccess: pushSuccessState,
    pushFailure: pushFailureState
  };

  if (pageErrors.length) {
    throw new Error(`Encountered ${pageErrors.length} page errors: ${pageErrors.join(" | ")}`);
  }

  await page.screenshot({ path: "/tmp/world-that-was-permutations-smoke.png", fullPage: false });
  await page.close();
  return summary;
}

async function main() {
  const requestedUrl = String(process.env.SMOKE_URL || "").trim();
  const port = requestedUrl
    ? Number(new URL(requestedUrl).port || 80)
    : await pickAvailablePort(Number(process.env.PORT || 3101) || 3101);
  const baseUrl = requestedUrl || `http://127.0.0.1:${port}`;
  const server = startServer(port);
  let browser;
  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true, executablePath: CHROME_EXECUTABLE });
    const summary = await runScenario(browser, baseUrl);
    process.stdout.write(`[smoke] world-that-was permutations summary: ${JSON.stringify(summary)}\n`);
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
  process.stderr.write(`[smoke] world-that-was permutations failed: ${String(err && err.stack ? err.stack : err)}\n`);
  process.exitCode = 1;
});

import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const COMBAT_KEY = "btl-combat-scene-editor-v1";
const TUTORIAL_KEY = COMBAT_KEY + "-tutorial";

function resolveAuditRole() {
  const arg = (process.argv || []).find((row) => /^--role=/.test(String(row || "")));
  const fromArg = arg ? String(arg).split("=")[1] : "";
  const raw = String(fromArg || process.env.VTT_AUDIT_ROLE || "gm").toLowerCase();
  return raw === "player" || raw === "player-safe" ? "player" : "gm";
}

const AUDIT_ROLE = resolveAuditRole();

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
    const candidate = 4100 + Math.floor(Math.random() * 1400);
    if (await checkPortOpen(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for controls audit server.");
}

async function waitForServer(url, child) {
  const start = Date.now();
  while (Date.now() - start < START_TIMEOUT_MS) {
    if (child.exitCode !== null) throw new Error("Audit server exited before becoming ready.");
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch (_err) {}
    await wait(250);
  }
  throw new Error("Timed out waiting for controls audit server readiness.");
}

async function dismissBlockingOverlays(page) {
  await page.evaluate(() => {
    try {
      if (window.introSystem && typeof window.introSystem.skipIntro === "function") window.introSystem.skipIntro();
    } catch (_err) {}
    try {
      if (window.soloReference && typeof window.soloReference.close === "function") window.soloReference.close();
    } catch (_err) {}
    try {
      if (typeof window.closeModal === "function") window.closeModal();
    } catch (_err) {}
  });
}

function orderedFailures(entries) {
  return entries.filter((row) => !row.ok).map((row, idx) => ({
    order: idx + 1,
    category: row.category,
    action: row.action,
    detail: row.detail || "failed"
  }));
}

async function run() {
  const port = await pickAvailablePort(Number(process.env.PORT || 3000));
  const baseUrl = process.env.SMOKE_URL || `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: Object.assign({}, process.env, { PORT: String(port), HOST: "127.0.0.1" }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let serverLog = "";
  child.stdout.on("data", (chunk) => { serverLog += String(chunk || ""); });
  child.stderr.on("data", (chunk) => { serverLog += String(chunk || ""); });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err && err.message ? err.message : err)));

  const results = [];
  const record = (category, action, ok, detail = "") => {
    results.push({ category, action, ok: !!ok, detail: String(detail || "") });
  };

  const clickId = async (category, id, verify) => {
    const exists = await page.evaluate((nodeId) => !!document.getElementById(nodeId), id);
    if (!exists) {
      record(category, id, false, "missing element");
      return;
    }
    try {
      await page.evaluate((nodeId) => {
        const el = document.getElementById(nodeId);
        if (!el) throw new Error("missing");
        el.click();
      }, id);
      if (typeof verify === "function") {
        const out = await verify();
        record(category, id, !!out.ok, out.detail || "");
      } else {
        record(category, id, true, "clicked");
      }
    } catch (err) {
      record(category, id, false, String(err && err.message ? err.message : err));
    }
  };

  const closeModalIfOpen = async () => {
    await page.evaluate(() => {
      const modal = document.getElementById("rollModal");
      if (modal && modal.style.display !== "none" && typeof window.closeModal === "function") {
        window.closeModal();
      }
    });
  };

  const tokenScreenPoint = async (tokenId) => page.evaluate((id) => {
    const st = window.CombatSceneStore.getState();
    const token = (st.tokens || []).find((row) => row && String(row.id) === String(id));
    const canvas = document.getElementById("combatSceneCanvas");
    if (!token || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const size = Number(st.board && st.board.size || 42) * Number(st.board && st.board.zoom || 1);
    const panX = Number(st.board && st.board.panX || 0);
    const panY = Number(st.board && st.board.panY || 0);
    const x = Math.sqrt(3) * size * (Number(token.q || 0) + Number(token.r || 0) / 2) + panX;
    const y = 1.5 * size * Number(token.r || 0) + panY;
    return { x: rect.left + x, y: rect.top + y };
  }, tokenId);

  const hexScreenPoint = async (q, r) => page.evaluate(({ qq, rr }) => {
    const st = window.CombatSceneStore.getState();
    const canvas = document.getElementById("combatSceneCanvas");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const size = Number(st.board && st.board.size || 42) * Number(st.board && st.board.zoom || 1);
    const panX = Number(st.board && st.board.panX || 0);
    const panY = Number(st.board && st.board.panY || 0);
    const x = Math.sqrt(3) * size * (Number(qq || 0) + Number(rr || 0) / 2) + panX;
    const y = 1.5 * size * Number(rr || 0) + panY;
    return { x: rect.left + x, y: rect.top + y };
  }, { qq: q, rr: r });

  const clickContextAction = async (category, contextKind, target, actionKey) => {
    try {
      await closeModalIfOpen();
      let point = null;
      if (contextKind === "token") point = await tokenScreenPoint(target);
      else point = await hexScreenPoint(target.q, target.r);
      if (!point) {
        record(category, actionKey, false, "target point unavailable");
        return;
      }
      await page.evaluate(({ x, y }) => {
        const canvas = document.getElementById("combatSceneCanvas");
        if (!canvas) throw new Error("canvas missing");
        const evt = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: Number(x || 0),
          clientY: Number(y || 0),
          button: 2
        });
        canvas.dispatchEvent(evt);
      }, point);
      const selector = `#combatTokenContextMenu [data-menu-action="${actionKey}"]`;
      const actionVisible = await page.waitForFunction((sel) => {
        const menu = document.getElementById("combatTokenContextMenu");
        const node = document.querySelector(sel);
        return !!(menu && menu.style.display !== "none" && node);
      }, selector, { timeout: 2500 }).then(() => true).catch(() => false);
      if (!actionVisible) {
        const detail = await page.evaluate(() => {
          const menu = document.getElementById("combatTokenContextMenu");
          if (!menu) return "menu missing";
          return [
            `display=${String(menu.style.display || "")}`,
            `text=${String(menu.textContent || "").trim().slice(0, 180)}`
          ].join(" ");
        });
        record(category, actionKey, false, `menu action missing (${detail})`);
        return;
      }
      await page.evaluate((sel) => {
        const node = document.querySelector(sel);
        if (!node) throw new Error("action node missing");
        node.click();
      }, selector);
      await wait(30);
      record(category, actionKey, true, "clicked");
    } catch (err) {
      record(category, actionKey, false, String(err && err.message ? err.message : err));
    }
  };

  try {
    await waitForServer(baseUrl, child);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await dismissBlockingOverlays(page);

    await page.evaluate(({ combatKey, tutorialKey }) => {
      localStorage.removeItem(combatKey);
      localStorage.removeItem(tutorialKey);
      window.__vttAuditRole = window.__vttAuditRole || "gm";
      const originalPrompt = window.prompt;
      window.__auditPromptOriginal = originalPrompt;
      window.prompt = function (message, fallback) {
        const msg = String(message || "").toLowerCase();
        if (msg.includes("dice roll")) return "1d20+3";
        if (msg.includes("token vision")) return "4";
        if (msg.includes("text label")) return "Audit";
        return fallback == null ? "1" : String(fallback);
      };
      window.confirm = function () { return true; };
    }, { combatKey: COMBAT_KEY, tutorialKey: TUTORIAL_KEY });

    await page.evaluate((role) => {
      window.__vttAuditRole = String(role || "gm");
    }, AUDIT_ROLE);

    await page.evaluate(() => {
      window.openCombatSceneEditor({
        id: "controls-audit-scene",
        name: "Controls Audit",
        tokens: [
          { id: "player-1", name: "Wayfarer", faction: "player", hp: 12, maxHp: 12, q: 0, r: 0, size: 1, isPlayer: true },
          { id: "enemy-1", name: "Night Corsair", faction: "monster", hp: 10, maxHp: 10, q: 2, r: 0, size: 1, dread: 6, deathNumber: 6 }
        ]
      });
    });

    await page.waitForSelector("#combatModeOverlay.open", { timeout: 10000 });
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      const modal = document.getElementById("rollModal");
      if (modal && modal.style.display !== "none" && /Combat Mode Tour/.test(modal.textContent || "")) {
        if (typeof window.closeModal === "function") window.closeModal();
      }
      window.CombatSceneStore.setState((function () {
        const st = window.CombatSceneStore.getState();
        return Object.assign({}, st, { selectedTokenId: "player-1", selectedTokenIds: ["player-1"] });
      })());
      if (window.__vttAuditRole === "gm") {
        window.applyCombatAssetActionAt("set-tool", "hazards:trap", 3, 3, true);
        window.applyCombatAssetActionAt("stock-cache", "balanced", 9, 2, true);
      }
    });

    const toolbarToolChecks = AUDIT_ROLE === "gm"
      ? [
        ["combatToolbarSelectBtn", "select"],
        ["combatToolbarDrawBtn", "paint"],
        ["combatToolbarTextBtn", "text"],
        ["combatToolbarMeasureBtn", "ruler"],
        ["combatToolbarRulerBtn", "ruler"],
        ["combatToolbarPanBtn", "pan"],
        ["combatToolbarPingBtn", "ping"]
      ]
      : [
        ["combatToolbarSelectBtn", "select"],
        ["combatToolbarMeasureBtn", "ruler"],
        ["combatToolbarRulerBtn", "ruler"],
        ["combatToolbarPanBtn", "pan"],
        ["combatToolbarPingBtn", "ping"]
      ];
    for (const [id, expected] of toolbarToolChecks) {
      await clickId("toolbar", id, async () => {
        const activeTool = await page.evaluate(() => String(window.CombatSceneStore.getState().activeTool || ""));
        return { ok: activeTool === expected, detail: `activeTool=${activeTool}` };
      });
    }

    await clickId("toolbar", "combatToolbarZoomInBtn", async () => {
      const state = await page.evaluate(() => window.CombatSceneStore.getState().board.zoom);
      return { ok: Number(state) > 1, detail: `zoom=${state}` };
    });

    await clickId("toolbar", "combatToolbarZoomOutBtn", async () => {
      const state = await page.evaluate(() => window.CombatSceneStore.getState().board.zoom);
      return { ok: Number(state) <= 1.1, detail: `zoom=${state}` };
    });

    await clickId("toolbar", "combatToolbarZoomResetBtn", async () => {
      const state = await page.evaluate(() => window.CombatSceneStore.getState().board.zoom);
      return { ok: Math.abs(Number(state) - 1) < 0.001, detail: `zoom=${state}` };
    });

    await clickId("toolbar", "combatToolbarTurnOrderBtn", async () => ({ ok: true, detail: "opened/scroll attempt" }));
    await clickId("toolbar", "combatToolbarDiceBtn", async () => ({ ok: true, detail: "prompt-driven roll attempted" }));

    const railToolChecks = AUDIT_ROLE === "gm"
      ? [
        ["combatRailSelectBtn", "select"],
        ["combatRailPanBtn", "pan"],
        ["combatRailDrawBtn", "paint"],
        ["combatRailTextBtn", "text"],
        ["combatRailMeasureBtn", "ruler"],
        ["combatRailFogBtn", "fog"]
      ]
      : [
        ["combatRailSelectBtn", "select"],
        ["combatRailPanBtn", "pan"],
        ["combatRailMeasureBtn", "ruler"]
      ];
    for (const [id, expected] of railToolChecks) {
      await clickId("rail", id, async () => {
        const activeTool = await page.evaluate(() => String(window.CombatSceneStore.getState().activeTool || ""));
        return { ok: activeTool === expected, detail: `activeTool=${activeTool}` };
      });
    }
    await clickId("rail", "combatRailEffectsBtn", async () => {
      const open = await page.evaluate(() => {
        const modal = document.getElementById("rollModal");
        return !!(modal && modal.style.display !== "none" && /Combat Effects/.test(modal.textContent || ""));
      });
      await page.evaluate(() => { if (typeof window.closeModal === "function") window.closeModal(); });
      return { ok: open, detail: open ? "effects modal opened" : "effects modal missing" };
    });
    await clickId("rail", "combatRailDiceBtn", async () => ({ ok: true, detail: "dice proxy click attempted" }));

    await clickId("modal", "combatRulesReferenceBtn", async () => {
      const open = await page.evaluate(() => {
        const modal = document.getElementById("rollModal");
        return !!(modal && modal.style.display !== "none" && /Combat Rules Reference/.test(modal.textContent || ""));
      });
      await page.evaluate(() => { if (typeof window.closeModal === "function") window.closeModal(); });
      return { ok: open, detail: open ? "rules modal opened" : "rules modal missing" };
    });

    if (AUDIT_ROLE === "gm") {
      await clickId("modal", "combatSettingsBtn", async () => {
        const open = await page.evaluate(() => {
          const modal = document.getElementById("rollModal");
          return !!(modal && modal.style.display !== "none" && /Combat Settings/.test(modal.textContent || ""));
        });
        await page.evaluate(() => { if (typeof window.closeModal === "function") window.closeModal(); });
        return { ok: open, detail: open ? "settings modal opened" : "settings modal missing" };
      });
    }

    await clickId("modal", "combatAssetsBtn", async () => {
      const state = await page.evaluate(() => {
        const dock = document.getElementById("combatAssetDock");
        return dock ? dock.classList.contains("open") : null;
      });
      return { ok: state !== null, detail: `asset dock now ${state ? "open" : "closed"}` };
    });

    await clickId("modal", "combatToolbarEffectsBtn", async () => {
      const open = await page.evaluate(() => {
        const modal = document.getElementById("rollModal");
        return !!(modal && modal.style.display !== "none" && /Combat Effects/.test(modal.textContent || ""));
      });
      if (open) {
        await page.evaluate(() => {
          const target = document.getElementById("combatFxTarget");
          const name = document.getElementById("combatFxName");
          const stress = document.getElementById("combatFxStress");
          const rounds = document.getElementById("combatFxRounds");
          if (target) target.value = "player-1";
          if (name) name.value = "Audit Burn";
          if (stress) stress.value = "1";
          if (rounds) rounds.value = "1";
          const modal = document.getElementById("rollModal");
          const applyBtn = modal ? Array.from(modal.querySelectorAll("button")).find((node) => /Apply/.test(node.textContent || "")) : null;
          if (applyBtn) applyBtn.click();
        });
      }
      const applied = await page.evaluate(() => {
        const st = window.CombatSceneStore.getState();
        return (st.tokenRoundEffects || []).some((row) => row && row.targetTokenId === "player-1" && row.label === "Audit Burn");
      });
      return { ok: open && applied, detail: `open=${open} applied=${applied}` };
    });

    await clickContextAction("context-token", "token", "player-1", "ping");
    await clickContextAction("context-token", "token", "player-1", "sheet");
    await closeModalIfOpen();
    if (AUDIT_ROLE === "gm") {
      await clickContextAction("context-token", "token", "player-1", "copy");
      await clickContextAction("context-token", "token", "player-1", "paste");
      await clickContextAction("context-token", "token", "player-1", "undo");
      await clickContextAction("context-token", "token", "player-1", "redo");
      await clickContextAction("context-token", "token", "player-1", "hold-turn");
      await clickContextAction("context-token", "token", "player-1", "delay-turn");
      await clickContextAction("context-token", "token", "player-1", "add-turn");
      await clickContextAction("context-token", "token", "player-1", "reactions");
      await clickContextAction("context-token", "token", "player-1", "change-layer");
      await clickContextAction("context-token", "token", "player-1", "front");
      await clickContextAction("context-token", "token", "player-1", "back");
      await clickContextAction("context-token", "token", "player-1", "lock");
      await clickContextAction("context-token", "token", "player-1", "enumerate");
      await clickContextAction("context-token", "token", "player-1", "rotate");
      await clickContextAction("context-token", "token", "player-1", "half");
      await clickContextAction("context-token", "token", "player-1", "quarter");
    }

    await page.evaluate(() => {
      window.CombatSceneStore.setState((function () {
        const st = window.CombatSceneStore.getState();
        return Object.assign({}, st, { selectedTokenId: "player-1", selectedTokenIds: ["player-1"] });
      })());
    });

    if (AUDIT_ROLE === "gm") {
      await clickContextAction("context-map", "hex", { q: 3, r: 3 }, "configure-hazard");
      await closeModalIfOpen();
      await clickContextAction("context-map", "hex", { q: 3, r: 3 }, "run-hazard");
      await closeModalIfOpen();
      await page.evaluate(() => {
        window.applyCombatAssetActionAt("stock-cache", "balanced", 9, 2, true);
      });
      await clickContextAction("context-map", "hex", { q: 9, r: 2 }, "manage-cache");
      await closeModalIfOpen();
      await clickContextAction("context-map", "hex", { q: 9, r: 2 }, "copy");
      await clickContextAction("context-map", "hex", { q: 9, r: 2 }, "paste");
      await clickContextAction("context-map", "hex", { q: 9, r: 2 }, "lock");
    }

    await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      const effectsCount = Array.isArray(st.tokenRoundEffects) ? st.tokenRoundEffects.length : 0;
      if (!Number.isFinite(effectsCount)) throw new Error("effects count invalid");
    });

    if (pageErrors.length) {
      record("runtime", "pageerror", false, pageErrors.join(" | "));
    }

    const summary = {
      ok: true,
      role: AUDIT_ROLE,
      passCount: results.filter((row) => row.ok).length,
      failCount: results.filter((row) => !row.ok).length,
      failures: orderedFailures(results)
    };

    if (summary.failCount > 0) {
      throw new Error(`Controls audit failures: ${JSON.stringify(summary.failures)}`);
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await wait(250);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    if (serverLog && process.env.DEBUG_SMOKE_LOGS === "1") {
      console.error(serverLog);
    }
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});

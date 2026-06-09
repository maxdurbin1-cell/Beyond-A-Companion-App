import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const STEP_TIMEOUT_MS = 15000;
const COMBAT_KEY = "btl-combat-scene-editor-v1";
const TUTORIAL_KEY = COMBAT_KEY + "-tutorial";

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
  throw new Error("Unable to find a free port for smoke server.");
}

async function waitForServer(url, child) {
  const start = Date.now();
  while (Date.now() - start < START_TIMEOUT_MS) {
    if (child.exitCode !== null) throw new Error("Smoke server exited before becoming ready.");
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch (_err) {}
    await wait(250);
  }
  throw new Error("Timed out waiting for smoke server readiness.");
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

  try {
    await waitForServer(baseUrl, child);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await dismissBlockingOverlays(page);

    await page.evaluate(({ combatKey, tutorialKey }) => {
      localStorage.removeItem(combatKey);
      localStorage.setItem(tutorialKey, JSON.stringify({ seen: true, step: 0 }));
    }, { combatKey: COMBAT_KEY, tutorialKey: TUTORIAL_KEY });

    await page.evaluate(() => {
      if (!window.S) {
        if (typeof window.generateCharacter === "function") {
          try { window.generateCharacter(); } catch (_err) {}
        }
        if (!window.S) window.S = {};
      }
      window.S.combat = Object.assign({}, window.S.combat || {}, { active: true, enemyDread: 6, spacing: "Engaged", actionsLeft: 3 });

      window.__smokeOriginalRollWithAdvantage = window.rollWithAdvantage;
      window.__smokeOriginalEnemyDreadRoll = window.rollEnemyDreadWithEffects;
      window.__smokeOriginalRequireCampaignTurn = window.requireCampaignTurn;
      window.__smokeOriginalCanUseAttackAtCurrentRange = window.canUseAttackAtCurrentRange;
      window.__smokeOriginalConsumeCombatAction = window.consumeCombatAction;
      window.requireCampaignTurn = function () { return true; };
      window.canUseAttackAtCurrentRange = function () { return true; };
      window.consumeCombatAction = function () { return true; };
      window.rollWithAdvantage = function () {
        return {
          base: { total: 12 },
          bestRoll: { total: 12 },
          bestDie: 12,
          total: 12,
          breakdown: "<span style=\"font-size:.7rem;color:var(--muted2);\">(smoke fixed roll)</span>",
          exploded: false
        };
      };
      window.rollEnemyDreadWithEffects = function () {
        return { total: 1, effectiveDie: 4 };
      };

      window.openCombatSceneEditor({
        id: "smoke-enemy-loot-drop-format",
        name: "Smoke Enemy Loot Drop Format",
        tokens: [
          { id: "pc-1", name: "Wayfarer", faction: "player", hp: 12, maxHp: 12, q: 0, r: 0, size: 1, isPlayer: true },
          { id: "mob-vine", name: "Vine Horror", faction: "monster", hp: 5, maxHp: 5, q: 1, r: 0, size: 1, dread: 6 }
        ]
      });
    });

    await page.waitForSelector("#combatModeOverlay.open", { timeout: STEP_TIMEOUT_MS });
    await dismissBlockingOverlays(page);

    await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, st, {
        selectedTokenId: "pc-1",
        selectedTokenIds: ["pc-1"]
      }));
    });

    await page.waitForSelector("#combatTokenTargetSel", { timeout: STEP_TIMEOUT_MS });
    await page.waitForSelector("#combatTokenActionSel", { timeout: STEP_TIMEOUT_MS });

    await page.evaluate(() => {
      const targetSel = document.getElementById("combatTokenTargetSel");
      const actionSel = document.getElementById("combatTokenActionSel");
      if (targetSel) {
        const hasTarget = Array.prototype.slice.call(targetSel.options || []).some((opt) => String(opt.value || "") === "mob-vine");
        if (!hasTarget) {
          const opt = document.createElement("option");
          opt.value = "mob-vine";
          opt.textContent = "Vine Horror";
          targetSel.appendChild(opt);
        }
        targetSel.value = "mob-vine";
      }
      if (actionSel) {
        const options = Array.prototype.slice.call(actionSel.options || []);
        const strikeOpt = options.find((opt) => String(opt.value || "") === "standard_strike")
          || options.find((opt) => /strike/i.test(String(opt.value || "") + " " + String(opt.textContent || "")));
        if (!strikeOpt) {
          const opt = document.createElement("option");
          opt.value = "standard_strike";
          opt.textContent = "Strike";
          actionSel.appendChild(opt);
          actionSel.value = "standard_strike";
          return;
        }
        actionSel.value = String(strikeOpt.value || "");
      }
    });

    await page.evaluate(() => {
      const btn = document.getElementById("combatTokenExecuteActionBtn");
      if (btn && typeof btn.onclick === "function") btn.onclick();
      else if (btn) btn.click();
    });
    await wait(1000);

    const summary = await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      const tokens = Array.isArray(st.tokens) ? st.tokens : [];
      const deadEnemy = tokens.find((row) => row && String(row.id || "") === "mob-vine");
      const drops = st.sceneRules && st.sceneRules.lootDrops && typeof st.sceneRules.lootDrops === "object"
        ? st.sceneRules.lootDrops
        : {};
      const drop = drops["mob-vine"] || null;
      const dropItems = drop && Array.isArray(drop.items) ? drop.items.slice() : [];

      const merchantPool = new Set();
      let shop = null;
      try {
        if (typeof window.SHOP_DATA === "object" && window.SHOP_DATA) shop = window.SHOP_DATA;
        else if (typeof SHOP_DATA !== "undefined" && SHOP_DATA && typeof SHOP_DATA === "object") shop = SHOP_DATA;
      } catch (_err) {
        shop = null;
      }
      if (shop) {
        Object.keys(shop).forEach((cat) => {
          const list = Array.isArray(shop[cat]) ? shop[cat] : [];
          list.forEach((entry) => {
            const label = String((entry && (entry.name || entry)) || "").trim();
            if (label) merchantPool.add(label);
          });
        });
      }

      function parseCredits(text) {
        const m = String(text || "").match(/^Credits\s*x\s*(\d+)$/i);
        return m ? Number(m[1]) : null;
      }

      const oneCreditEntry = dropItems.length === 1 ? parseCredits(dropItems[0]) : null;
      const isCreditsDrop = Number.isFinite(oneCreditEntry) && oneCreditEntry >= 50 && oneCreditEntry <= 100;
      const isMerchantItemsDrop = dropItems.length >= 1 && dropItems.length <= 2
        && dropItems.every((name) => merchantPool.has(String(name || "").trim()));

      return {
        deadEnemyHp: deadEnemy ? Number(deadEnemy.hp || 0) : null,
        deadEnemyDead: !!(deadEnemy && deadEnemy.dead),
        dropExists: !!drop,
        dropItems,
        merchantPoolSize: merchantPool.size,
        isCreditsDrop,
        isMerchantItemsDrop,
        pass: !!drop && (isCreditsDrop || isMerchantItemsDrop)
      };
    });

    if (summary.deadEnemyHp !== 0 || !summary.deadEnemyDead) {
      throw new Error(`Enemy token was not killed as expected: ${JSON.stringify(summary)}`);
    }
    if (!summary.dropExists) {
      throw new Error(`No loot drop found for dead enemy token: ${JSON.stringify(summary)}`);
    }
    if (!summary.pass) {
      throw new Error(
        "Loot drop format invalid. Expected either one Credits x50-100 entry OR 1-2 merchant item names. "
        + JSON.stringify(summary)
      );
    }

    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } finally {
    try {
      await page.evaluate(() => {
        if (typeof window.__smokeOriginalRollWithAdvantage === "function") {
          window.rollWithAdvantage = window.__smokeOriginalRollWithAdvantage;
        }
        if (typeof window.__smokeOriginalEnemyDreadRoll === "function") {
          window.rollEnemyDreadWithEffects = window.__smokeOriginalEnemyDreadRoll;
        }
        if (typeof window.__smokeOriginalRequireCampaignTurn === "function") {
          window.requireCampaignTurn = window.__smokeOriginalRequireCampaignTurn;
        }
        if (typeof window.__smokeOriginalCanUseAttackAtCurrentRange === "function") {
          window.canUseAttackAtCurrentRange = window.__smokeOriginalCanUseAttackAtCurrentRange;
        }
        if (typeof window.__smokeOriginalConsumeCombatAction === "function") {
          window.consumeCombatAction = window.__smokeOriginalConsumeCombatAction;
        }
      });
    } catch (_err) {}

    await browser.close();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        wait(1500)
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }

  if (pageErrors.length) {
    throw new Error(`Encountered page errors during smoke run: ${pageErrors.join(" | ")}`);
  }
}

run().catch((err) => {
  console.error("enemy-loot-drop-format smoke failed:", err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

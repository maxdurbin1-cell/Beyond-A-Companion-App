import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;
const COMBAT_KEY = "btl-combat-scene-editor-v1";
const TUTORIAL_KEY = COMBAT_KEY + "-tutorial";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPortOpen(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function pickAvailablePort(preferredPort = 3000) {
  if (await checkPortOpen(preferredPort)) return preferredPort;
  for (let i = 0; i < 25; i += 1) {
    const candidate = 4100 + Math.floor(Math.random() * 1400);
    if (await checkPortOpen(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port for the VTT smoke server.");
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
      localStorage.removeItem(tutorialKey);
    }, { combatKey: COMBAT_KEY, tutorialKey: TUTORIAL_KEY });

    await page.evaluate(() => {
      window.openCombatSceneEditor({
        id: "smoke-scene",
        name: "Smoke Scene",
        tokens: [
          { id: "player-1", name: "Wayfarer", faction: "player", hp: 12, maxHp: 12, q: 0, r: 0, size: 1, isPlayer: true },
          { id: "enemy-1", name: "Night Corsair", faction: "monster", hp: 10, maxHp: 10, q: 2, r: 0, size: 1, dread: 6, deathNumber: 6 }
        ]
      });
    });

    await page.waitForSelector("#combatModeOverlay.open", { timeout: 10000 });
    await page.waitForFunction(() => {
      const modal = document.getElementById("rollModal");
      return !!(modal && modal.style.display !== "none" && /Combat Mode Tour/.test(modal.textContent || ""));
    }, null, { timeout: 10000 });

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Resume Later" }).click();

    const tutorialState = await page.evaluate((tutorialKey) => JSON.parse(localStorage.getItem(tutorialKey) || "{}"), TUTORIAL_KEY);
    if (Number(tutorialState.step) !== 1 || tutorialState.seen !== false) {
      throw new Error(`Tutorial resume state not persisted correctly: ${JSON.stringify(tutorialState)}`);
    }

    await page.evaluate(() => window.openCombatTutorial(1));
    await page.waitForFunction(() => {
      const modal = document.getElementById("rollModal");
      return !!(modal && /Step 2 of 7/.test(modal.textContent || ""));
    }, null, { timeout: 10000 });
    await page.evaluate(() => window.closeModal());

    const modalLayering = await page.evaluate(() => {
      const overlay = document.getElementById("combatModeOverlay");
      window.showCombatRulesReference();
      const modal = document.getElementById("rollModal");
      const rulesAbove = Number(window.getComputedStyle(modal).zIndex || 0) > Number(window.getComputedStyle(overlay).zIndex || 0);
      window.closeModal();
      window.CombatSceneStore.setState((function () {
        const st = window.CombatSceneStore.getState();
        return Object.assign({}, st, { selectedTokenId: "player-1", selectedTokenIds: ["player-1"] });
      })());
      if (typeof window.openSelectedCombatSheetFromRulesReference === "function") window.openSelectedCombatSheetFromRulesReference();
      const sheetModal = document.getElementById("rollModal");
      const sheetAbove = Number(window.getComputedStyle(sheetModal).zIndex || 0) > Number(window.getComputedStyle(overlay).zIndex || 0);
      const sheetVisible = !!sheetModal && sheetModal.style.display !== "none";
      return { rulesAbove, sheetAbove, sheetVisible };
    });

    if (!modalLayering.rulesAbove || !modalLayering.sheetAbove || !modalLayering.sheetVisible) {
      throw new Error(`Modal layering assertion failed: ${JSON.stringify(modalLayering)}`);
    }

    await page.evaluate(() => window.closeModal());
    await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, st, {
        assetBrowser: Object.assign({}, st.assetBrowser || {}, { category: "objects", query: "obstacle" })
      }));
      window.combatOpenAssetsHub();
    });
    await page.waitForSelector("#combatAssetDock.open", { timeout: 10000 });
    const assetCardInfo = await page.locator('article[data-asset-id="obj-obstacle"]').evaluate((node) => ({
      draggable: !!node.getAttribute("draggable"),
      label: node.getAttribute("data-asset-label") || node.textContent || ""
    }));
    if (!assetCardInfo.draggable) {
      throw new Error(`Asset card is not draggable: ${JSON.stringify(assetCardInfo)}`);
    }

    const dragResult = await page.evaluate(() => {
      const canvas = document.getElementById("combatSceneCanvas");
      const rect = canvas.getBoundingClientRect();
      // Seed a concrete TARGET hex; drag/drop should still land at the cursor hex.
      window.applyCombatAssetActionAt("set-tool", "terrain:road", 5, 2, true);
      const seeded = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, seeded, {
        selectedMapItem: { layer: "terrain", key: "5,2" }
      }));
      const st = window.CombatSceneStore.getState();
      const dropClientX = rect.left + 560;
      const dropClientY = rect.top + 360;
      const dropped = window.debugCombatDropAsset("set-tool", "objects:obstacle", dropClientX, dropClientY);
      const after = window.CombatSceneStore.getState();
      const objectKeys = Object.keys((after.layers && after.layers.objects) || {});
      const selectedTarget = after.selectedMapItem ? String(after.selectedMapItem.key || "") : "";
      return {
        dropped,
        objectCount: objectKeys.length,
        lastObject: objectKeys[objectKeys.length - 1] || "",
        selectedTarget,
        valueAtSelectedTarget: (after.layers && after.layers.objects && after.layers.objects[selectedTarget]) || ""
      };
    });

    if (!dragResult.dropped || Number(dragResult.objectCount || 0) <= 0) {
      throw new Error(`Asset drag/drop did not stamp an object: ${JSON.stringify(dragResult)}`);
    }
    if (dragResult.valueAtSelectedTarget !== "obstacle" || dragResult.selectedTarget === "5,2") {
      throw new Error(`Asset drop did not land at the cursor hex: ${JSON.stringify(dragResult)}`);
    }

    const cardPlacement = await page.evaluate(() => {
      const before = window.CombatSceneStore.getState();
      const assetCard = document.querySelector('article.combat-asset-card[data-asset-id="obj-obstacle"][data-asset-action="paint-object"]');
      if (!assetCard) return { ok: false, reason: "asset-card-missing" };
      const selectedTarget = before.selectedMapItem && before.selectedMapItem.key ? String(before.selectedMapItem.key || "") : "";
      const selected = (before.tokens || []).find((row) => row && row.id === before.selectedTokenId) || null;
      const expectedKey = selectedTarget || (selected ? `${Number(selected.q || 0) + 1},${Number(selected.r || 0) + 1}` : "0,0");
      const onclickBound = typeof assetCard.onclick === "function";
      assetCard.click();
      const after = window.CombatSceneStore.getState();
      const valueAtExpected = (after.layers && after.layers.objects && after.layers.objects[expectedKey]) || "";
      return {
        ok: true,
        onclickBound,
        expectedKey,
        valueAtExpected,
        selectedTarget,
        historyTail: (after.actionHistory || []).slice(-1)[0] || ""
      };
    });

    if (!cardPlacement.ok || cardPlacement.valueAtExpected !== "obstacle") {
      throw new Error(`Asset card click did not place object: ${JSON.stringify(cardPlacement)}`);
    }

    const targetPoint = await page.evaluate(() => {
      const canvas = document.getElementById("combatSceneCanvas");
      const rect = canvas.getBoundingClientRect();
      const st = window.CombatSceneStore.getState();
      const size = Number(st.board && st.board.size || 42) * Number(st.board && st.board.zoom || 1);
      const x = size * (Math.sqrt(3) * 5 + (Math.sqrt(3) / 2) * 2) + Number(st.board && st.board.panX || 0);
      const y = size * (1.5 * 2) + Number(st.board && st.board.panY || 0);
      return { x: rect.left + x, y: rect.top + y };
    });
    await page.mouse.click(targetPoint.x, targetPoint.y);

    await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, st, {
        assetBrowser: Object.assign({}, st.assetBrowser || {}, { category: "villains", query: "" })
      }));
      window.combatOpenAssetsHub();
      window.CombatSceneStore.setState(Object.assign({}, window.CombatSceneStore.getState(), {
        selectedMapItem: { layer: "terrain", key: "5,2" }
      }));
    });
    await page.waitForSelector('article.combat-asset-card[data-asset-action="spawn-villain"]', { timeout: 10000 });
    await page.locator('article.combat-asset-card[data-asset-action="spawn-villain"]').first().click();

    const villainPlacement = await page.evaluate(() => {
      const targetKey = "5,2";
      const after = window.CombatSceneStore.getState();
      const monsterTokens = (after.tokens || [])
        .filter((row) => row && String(row.faction || "") === "monster")
        .map((row) => ({ id: String(row.id || ""), name: String(row.name || ""), q: Number(row.q || 0), r: Number(row.r || 0) }));
      const placed = (after.tokens || []).find((row) => row && Number(row.q || 0) === 5 && Number(row.r || 0) === 2 && String(row.faction || "") === "monster") || null;
      return { ok: !!placed, placedName: placed ? String(placed.name || "") : "", targetKey, monsterTokens };
    });

    if (!villainPlacement.ok) {
      throw new Error(`Villain card did not place on the selected target hex: ${JSON.stringify(villainPlacement)}`);
    }

    await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, st, {
        assetBrowser: Object.assign({}, st.assetBrowser || {}, { category: "battlemaps", query: "" })
      }));
      window.combatOpenAssetsHub();
    });
    await page.waitForSelector('article.combat-asset-card[data-asset-action="map-preset"][data-asset-id="map-storm"]', { timeout: 10000 });
    await page.locator('article.combat-asset-card[data-asset-action="map-preset"][data-asset-id="map-storm"]').first().click();

    const battlemapPlacement = await page.evaluate(() => {
      const after = window.CombatSceneStore.getState();
      return {
        ok: Number(after.board && after.board.cols || 0) === 18 && Number(after.board && after.board.rows || 0) === 10 && String(after.board && after.board.weatherOverlay || "") === "storm",
        cols: Number(after.board && after.board.cols || 0),
        rows: Number(after.board && after.board.rows || 0),
        weather: String(after.board && after.board.weatherOverlay || "")
      };
    });

    if (!battlemapPlacement.ok) {
      throw new Error(`Battlemap preset did not apply correctly: ${JSON.stringify(battlemapPlacement)}`);
    }

    const hoverLabels = await page.evaluate(() => {
      const icon = document.getElementById("combatRailSelectBtn");
      const tools = document.getElementById("combatToolsPanel")?.querySelector(".combat-panel-header");
      const feed = document.getElementById("combatFeedPanel")?.querySelector(".combat-panel-header");
      return {
        icon: icon?.getAttribute("data-hover-label") || "",
        tools: tools?.getAttribute("data-hover-label") || "",
        feed: feed?.getAttribute("data-hover-label") || ""
      };
    });

    if (!hoverLabels.icon || !hoverLabels.tools || !hoverLabels.feed) {
      throw new Error(`Hover labels missing on side panels: ${JSON.stringify(hoverLabels)}`);
    }

    const effectsTargeting = await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, st, { selectedTokenId: "", selectedTokenIds: [] }));
      const fxBtn = document.getElementById("combatToolbarEffectsBtn");
      if (!fxBtn) return { opened: false, applied: false, reason: "effects-button-missing" };
      fxBtn.click();
      const modal = document.getElementById("rollModal");
      const opened = !!(modal && modal.style.display !== "none" && /Combat Effects/.test(modal.textContent || ""));
      const target = document.getElementById("combatFxTarget");
      if (!opened || !target) return { opened, applied: false, reason: "modal-or-target-missing" };
      target.value = "player-1";
      const name = document.getElementById("combatFxName");
      const stress = document.getElementById("combatFxStress");
      const rounds = document.getElementById("combatFxRounds");
      if (name) name.value = "Test Burn";
      if (stress) stress.value = "1";
      if (rounds) rounds.value = "2";
      const applyBtn = Array.from(modal.querySelectorAll("button")).find((node) => /Apply/.test(node.textContent || ""));
      if (!applyBtn) return { opened, applied: false, reason: "apply-button-missing" };
      applyBtn.click();
      const next = window.CombatSceneStore.getState();
      const hasEffect = (next.tokenRoundEffects || []).some((row) => row && row.targetTokenId === "player-1" && row.label === "Test Burn");
      return { opened, applied: hasEffect };
    });

    if (!effectsTargeting.opened || !effectsTargeting.applied) {
      throw new Error(`Effects tool did not open/apply without preselected token: ${JSON.stringify(effectsTargeting)}`);
    }

    const seededMapItems = await page.evaluate(() => {
      window.applyCombatAssetActionAt("set-tool", "hazards:trap", 3, 3, true);
      window.applyCombatAssetActionAt("stock-cache", "balanced", 4, 4, true);
      const st = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, st, {
        autoRoll: false,
        selectedTokenId: "player-1",
        selectedTokenIds: ["player-1"],
        selectedMapItem: { layer: "hazards", key: "3,3" }
      }));
      const next = window.CombatSceneStore.getState();
      return {
        hazard: next.layers?.hazards?.["3,3"] || "",
        cache: next.layers?.objects?.["4,4"] || ""
      };
    });

    if (seededMapItems.hazard !== "trap" || seededMapItems.cache !== "loot-cache") {
      throw new Error(`Failed to seed hazard/cache items: ${JSON.stringify(seededMapItems)}`);
    }

    await page.evaluate(() => window.openCombatHazardConfigModal(3, 3));
    await page.waitForFunction(() => {
      const modal = document.getElementById("rollModal");
      return !!(modal && modal.style.display !== "none" && /Hazard Configuration/.test(modal.textContent || ""));
    }, null, { timeout: 10000 });
    await page.locator("#combatHazardConfigLabel").fill("Trap Lattice");
    await page.locator("#combatHazardConfigDd").fill("11");
    await page.locator("#combatHazardConfigDamage").fill("2");
    await page.locator("#combatHazardConfigDie").selectOption("mind");
    await page.locator("#combatHazardConfigDie").evaluate((node) => node.value);
    await page.locator("#combatHazardConfigDie").blur();
    await page.getByRole("button", { name: "Apply Hazard" }).click();

    const hazardConfigState = await page.evaluate(() => {
      const row = window.CombatSceneStore.getState().sceneRules?.hazardChecks?.["3,3"] || null;
      return row ? { dd: row.dd, damage: row.onFailDamage, dieKey: row.dieKey, label: row.label } : null;
    });

    if (!hazardConfigState || hazardConfigState.dd !== 11 || hazardConfigState.damage !== 2 || hazardConfigState.dieKey !== "mind" || hazardConfigState.label !== "Trap Lattice") {
      throw new Error(`Hazard config modal did not persist correctly: ${JSON.stringify(hazardConfigState)}`);
    }

    const hpBeforeHazard = await page.evaluate(() => {
      const token = (window.CombatSceneStore.getState().tokens || []).find((row) => row && row.id === "player-1") || null;
      return Number(token?.hp || 0);
    });

    await page.evaluate(() => window.applyCombatAssetActionAt("hazard-check", "", 3, 3, false));
    await page.waitForFunction(() => {
      const modal = document.getElementById("rollModal");
      return !!(modal && modal.style.display !== "none" && /Hazard Check/.test(modal.textContent || ""));
    }, null, { timeout: 10000 });
    await page.locator("#combatHazardRunDie").selectOption("mind");
    await page.locator("#combatHazardRunTotal").fill("1");
    await page.locator("#combatHazardResolveBtn").click();

    const hazardResolution = await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      const token = (st.tokens || []).find((row) => row && row.id === "player-1") || null;
      return {
        hp: token?.hp,
        lastLog: (st.actionHistory || []).slice(-1)[0] || ""
      };
    });

    if (Number(hazardResolution.hp || 0) !== hpBeforeHazard - 2) {
      throw new Error(`Hazard resolution modal did not apply fail damage: ${JSON.stringify(hazardResolution)}`);
    }

    await page.evaluate(() => window.openCombatLootCacheModal(4, 4));
    await page.waitForFunction(() => {
      const modal = document.getElementById("rollModal");
      return !!(modal && modal.style.display !== "none" && /Loot Cache Controls/.test(modal.textContent || ""));
    }, null, { timeout: 10000 });
    await page.locator("#combatLootCacheMode").selectOption("items-affixes");
    await page.locator("#combatLootCacheTier").fill("10");
    await page.locator("#combatLootCacheStockBtn").click();

    const cacheState = await page.evaluate(() => {
      const row = window.CombatSceneStore.getState().sceneRules?.mapLootCaches?.["4,4"] || null;
      return row ? { count: Array.isArray(row.items) ? row.items.length : 0, items: row.items || [] } : null;
    });

    if (!cacheState || cacheState.count < 2 || !cacheState.items.some((item) => String(item || "").includes("Affix Sigil ["))) {
      throw new Error(`Loot cache modal did not stock expected rewards: ${JSON.stringify(cacheState)}`);
    }

    const mapItemOps = await page.evaluate(() => {
      const st = window.CombatSceneStore.getState();
      window.CombatSceneStore.setState(Object.assign({}, st, {
        selectedTokenId: "",
        selectedTokenIds: [],
        selectedMapItem: { layer: "hazards", key: "3,3" }
      }));
      const copied = window.copySelectedCombatMapItem();
      const moved = window.moveCombatMapItemByKey("hazards", "3,3", 5, 3);
      const pasted = window.pasteCombatMapItemAt(6, 3);
      const next = window.CombatSceneStore.getState();
      return {
        copied,
        moved,
        pasted,
        movedHazard: next.layers?.hazards?.["5,3"] || "",
        pastedHazard: next.layers?.hazards?.["6,3"] || "",
        movedConfig: next.sceneRules?.hazardChecks?.["5,3"] || null
      };
    });

    if (!mapItemOps.copied || !mapItemOps.moved || !mapItemOps.pasted || mapItemOps.movedHazard !== "trap" || mapItemOps.pastedHazard !== "trap" || !mapItemOps.movedConfig) {
      throw new Error(`Map item manipulation failed: ${JSON.stringify(mapItemOps)}`);
    }

    await page.evaluate(() => {
      const modal = document.getElementById("rollModal");
      if (modal && typeof window.closeModal === "function") window.closeModal();
    });

    await page.evaluate(() => {
      const canvas = document.getElementById("combatSceneCanvas");
      if (!canvas) return;
      const st = window.CombatSceneStore.getState();
      const token = (st.tokens || []).find((row) => row && row.id === "player-1") || null;
      if (!token) return;
      const board = st.board || {};
      const size = Number(board.size || 42) * Number(board.zoom || 1);
      const cx = Math.round(size * (Math.sqrt(3) * Number(token.q || 0) + (Math.sqrt(3) / 2) * Number(token.r || 0)) + Number(board.panX || 0));
      const cy = Math.round(size * (1.5 * Number(token.r || 0)) + Number(board.panY || 0));
      const first = new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: cx,
        clientY: cy,
        button: 0
      });
      canvas.dispatchEvent(first);
    });

    await page.waitForFunction(() => {
      const modal = document.getElementById("rollModal");
      return !!(modal && modal.style.display !== "none" && /Combat Sheet/.test(modal.textContent || ""));
    }, null, { timeout: 10000 });

    const sheetTextCheck = await page.evaluate(() => {
      const modal = document.getElementById("rollModal");
      const text = String(modal && modal.textContent || "");
      return {
        hasArmor: text.indexOf("Armor:") >= 0,
        hasDefendMath: text.indexOf("Defend math:") >= 0
      };
    });

    if (!sheetTextCheck.hasArmor || !sheetTextCheck.hasDefendMath) {
      throw new Error(`Double-click sheet missing armor/defend math content: ${JSON.stringify(sheetTextCheck)}`);
    }

    if (pageErrors.length) {
      throw new Error(`Page errors detected: ${pageErrors.join(" | ")}`);
    }

    console.log(JSON.stringify({ ok: true, tutorialState, modalLayering, dragResult }, null, 2));
  } finally {
    await browser.close();
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
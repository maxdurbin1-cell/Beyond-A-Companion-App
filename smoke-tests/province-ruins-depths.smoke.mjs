import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;

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
  if (Number.isFinite(preferred) && preferred > 0 && preferred < 65536 && await canBindPort(preferred)) {
    return preferred;
  }
  for (let i = 0; i < 40; i += 1) {
    const port = 5200 + Math.floor(Math.random() * 1000);
    if (await canBindPort(port)) return port;
  }
  throw new Error("Unable to find a free port for province ruins/depths smoke.");
}

function startServer(port) {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) }
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
      // Retry until ready.
    }
    await wait(250);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function launchBrowser() {
  const launchers = [
    () => chromium.launch({ headless: true }),
    () => chromium.launch({ channel: "chrome", headless: true }),
    () => chromium.launch({ channel: "msedge", headless: true })
  ];
  let lastError = null;
  for (const launch of launchers) {
    try {
      return await launch();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Unable to launch Chromium for province ruins/depths smoke.");
}

async function runScenario(page, baseUrl) {
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  await page.goto(`${baseUrl}/?skipIntro=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    () => typeof window.generateMap === "function"
      && typeof window.openProvinceRuinPopup === "function"
      && typeof window.resolveProvinceRuinRoom === "function"
      && typeof window.openProvinceDepthsPopup === "function"
      && typeof window.resolveProvinceDepthsSegment === "function",
    null,
    { timeout: 30000 }
  );

  const summary = await page.evaluate(() => {
    const requireState = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const modalTitle = () => String((document.getElementById("modalTitle") || {}).textContent || "").trim();
    const modalText = () => String((document.getElementById("modalContent") || {}).textContent || "").trim();
    const closeModalIfOpen = () => {
      if (typeof window.closeModal === "function") {
        try { window.closeModal(); } catch (_err) {}
      }
    };

    if (window.introSystem && typeof window.introSystem.skipIntro === "function") {
      window.introSystem.skipIntro();
    }
    if (window.soloReference && typeof window.soloReference.close === "function") {
      window.soloReference.close();
    }
    closeModalIfOpen();

    if (window.settingsSystem && typeof window.settingsSystem.setGameMode === "function") {
      window.settingsSystem.setGameMode("solo", { silent: true });
    }

    window.generateMap();
    const provinceState = typeof getProvinceMapState === "function" ? getProvinceMapState() : null;
    const mapData = provinceState && Array.isArray(provinceState.mapData) ? provinceState.mapData : [];
    requireState(mapData.length >= 3, "Province map did not generate.");

    const ruinHex = mapData.find((hex) => hex && String(hex.type || "") === "ruins") || mapData[0];
    const depthsHex = mapData.find((hex) => hex && String(hex.type || "") === "depths") || mapData[1];
    requireState(ruinHex && depthsHex, "Could not seed ruin/depths test hexes.");

    window.S = window.S || {};
    window.S.stats = window.S.stats || {};
    window.S.stats.valor = 12;
    window.S.stats.lead = 12;

    ruinHex.type = "ruins";
    ruinHex.name = "Smoke Ruin";
    ruinHex.data = Object.assign({}, ruinHex.data || {}, {
      builder: "Wardens",
      builtFor: "Archive vault",
      construction: "Basalt and alloy ribs",
      entrance: "Sunken freight hatch",
      rooms: 3,
      novelty: "Zero-gravity pockets in collapsed halls",
      provinceRuinRooms: [
        {
          idx: 1,
          type: "Entrance",
          cleared: true,
          result: "Entry secured.",
          description: "A breached vestibule open to the rain."
        },
        {
          idx: 2,
          type: "Empty",
          cleared: false,
          result: "",
          description: "Collapsed shelves and scattered ceramic plates."
        },
        {
          idx: 3,
          type: "Boss Chamber",
          cleared: false,
          result: "",
          description: "The core vault where the ruin warden waits."
        }
      ]
    });

    depthsHex.type = "depths";
    depthsHex.name = "Smoke Depths";
    depthsHex.data = Object.assign({}, depthsHex.data || {}, {
      entrance: "A cracked stairwell drops beneath the province bedrock.",
      seal: "Whispered keys wake the next floor."
    });

    applyProvinceMapState(provinceState);

    window.openProvinceRuinPopup(ruinHex.col, ruinHex.row);
    const ruinHeaderText = modalText();
    const ruinHeaderOk = /Province Ruins/i.test(modalTitle())
      && /Wardens/i.test(ruinHeaderText)
      && /Archive vault/i.test(ruinHeaderText)
      && !/undefined/i.test(ruinHeaderText);

    let provinceAfterRuinOpen = getProvinceMapState();
    let ruinHexState = provinceAfterRuinOpen.mapData.find((hex) => hex && hex.col === ruinHex.col && hex.row === ruinHex.row);
    const ruinHexcrawl = ruinHexState && ruinHexState.data ? ruinHexState.data.provinceRuinHexcrawl : null;
    requireState(ruinHexcrawl && Array.isArray(ruinHexcrawl.nodes), "Province ruin hexcrawl did not initialize.");
    const emptyNode = ruinHexcrawl.nodes.find((node) => node && Number(node.roomIdx) === 1);
    const bossNode = ruinHexcrawl.nodes.find((node) => node && Number(node.roomIdx) === 2);
    requireState(emptyNode && bossNode, "Province ruin nodes did not map to test rooms.");

    window.exploreProvinceRuinHexNode(ruinHex.col, ruinHex.row, emptyNode.id);
    const ruinExplorePromptOk = /Explore \(Valor Die vs DD/i.test(modalText());

    const originalRoll = window.roll;
    window.roll = (sides) => Math.max(1, Number(sides || 0) - 1);
    try {
      window.resolveProvinceRuinRoom(ruinHex.col, ruinHex.row, 1);
    } finally {
      window.roll = originalRoll;
    }
    provinceAfterRuinOpen = getProvinceMapState();
    ruinHexState = provinceAfterRuinOpen.mapData.find((hex) => hex && hex.col === ruinHex.col && hex.row === ruinHex.row);
    const clearedRuinRoom = ruinHexState && ruinHexState.data && Array.isArray(ruinHexState.data.provinceRuinRooms)
      ? (ruinHexState.data.provinceRuinRooms[1] || {})
      : {};
    const ruinRoomCleared = !!clearedRuinRoom.cleared && /Success/i.test(String(clearedRuinRoom.result || ""));

    window.exploreProvinceRuinHexNode(ruinHex.col, ruinHex.row, bossNode.id);
    window.resolveProvinceRuinRoom(ruinHex.col, ruinHex.row, 2);
    const bossPromptText = modalText();
    const ruinBossPromptOk = /Start Boss Combat/i.test(bossPromptText)
      && /Success/i.test(bossPromptText)
      && /Failure/i.test(bossPromptText);

    window.resolveProvinceRuinBossOutcome(ruinHex.col, ruinHex.row, 2, true);
    provinceAfterRuinOpen = getProvinceMapState();
    ruinHexState = provinceAfterRuinOpen.mapData.find((hex) => hex && hex.col === ruinHex.col && hex.row === ruinHex.row);
    const bossRoom = ruinHexState && ruinHexState.data && Array.isArray(ruinHexState.data.provinceRuinRooms)
      ? (ruinHexState.data.provinceRuinRooms[2] || {})
      : {};
    const ruinBossResolved = !!bossRoom.cleared && /Boss defeated/i.test(String(bossRoom.result || ""));
    closeModalIfOpen();

    window.openProvinceDepthsPopup(depthsHex.col, depthsHex.row);
    let provinceAfterDepthsInit = getProvinceMapState();
    let depthsHexState = provinceAfterDepthsInit.mapData.find((hex) => hex && hex.col === depthsHex.col && hex.row === depthsHex.row);
    requireState(depthsHexState && depthsHexState.data, "Province depths state did not initialize.");
    depthsHexState.data.provinceDepths = depthsHexState.data.provinceDepths || {};
    depthsHexState.data.provinceDepths.currentFloor = 1;
    depthsHexState.data.provinceDepths.deepestFloor = 1;
    depthsHexState.data.provinceDepths.totalSegments = 4;
    depthsHexState.data.provinceDepths.hiddenRoomsFound = 0;
    depthsHexState.data.provinceDepths.floors = depthsHexState.data.provinceDepths.floors || {};
    depthsHexState.data.provinceDepths.floors["1"] = depthsHexState.data.provinceDepths.floors["1"] || {};
    depthsHexState.data.provinceDepths.floors["1"].die = 4;
    depthsHexState.data.provinceDepths.floors["1"].selectedIdx = 1;
    depthsHexState.data.provinceDepths.floors["1"].stairsUnlocked = false;
    depthsHexState.data.provinceDepths.floors["1"].segments = [
      {
        idx: 1,
        kind: "Entrance Hall",
        description: "A black stair breathes dust and cold air from below.",
        discovered: true,
        cleared: true,
        result: "Camp marked at the dungeon mouth.",
        hidden: false,
        pendingCombat: false
      },
      {
        idx: 2,
        kind: "Loot Vault",
        description: "A sealed side vault threaded with dustless wire.",
        discovered: true,
        cleared: false,
        result: "",
        hidden: false,
        pendingCombat: false
      },
      {
        idx: 3,
        kind: "Monster Lair",
        description: "Scratch marks circle the walls where the defenders nest.",
        discovered: true,
        cleared: false,
        result: "",
        hidden: false,
        pendingCombat: false,
        encounterCount: 2,
        encounterName: "Depth Stalkers"
      },
      {
        idx: 4,
        kind: "Stairway",
        description: "A stair spirals into colder dark.",
        discovered: true,
        cleared: false,
        result: "",
        hidden: false,
        pendingCombat: false
      }
    ];
    applyProvinceMapState(provinceAfterDepthsInit);

    window.openProvinceDepthsPopup(depthsHex.col, depthsHex.row);
    const depthsHeaderText = modalText();
    const depthsHeaderOk = /Infinite Dungeon/i.test(modalTitle())
      && /Press Deeper/i.test(depthsHeaderText)
      && /Search Hidden Room/i.test(depthsHeaderText)
      && !/undefined/i.test(depthsHeaderText);

    window.openProvinceDepthsActionPrompt(depthsHex.col, depthsHex.row, 1);
    const statPromptText = modalText();
    const depthsStatPromptOk = /Choose which Soul Array stat fits this segment check/i.test(statPromptText)
      && /Lead/i.test(statPromptText)
      && /Control/i.test(statPromptText)
      && /Mind/i.test(statPromptText);

    window.roll = (sides) => Math.max(1, Number(sides || 0) - 1);
    try {
      window.resolveProvinceDepthsSegment(depthsHex.col, depthsHex.row, 1, "lead");
    } finally {
      window.roll = originalRoll;
    }
    provinceAfterDepthsInit = getProvinceMapState();
    depthsHexState = provinceAfterDepthsInit.mapData.find((hex) => hex && hex.col === depthsHex.col && hex.row === depthsHex.row);
    let floorState = depthsHexState && depthsHexState.data && depthsHexState.data.provinceDepths && depthsHexState.data.provinceDepths.floors
      ? depthsHexState.data.provinceDepths.floors["1"]
      : null;
    const vaultSegment = floorState && Array.isArray(floorState.segments) ? (floorState.segments[1] || {}) : {};
    const depthsVaultResolved = !!vaultSegment.cleared
      && /LEAD d/i.test(String(vaultSegment.result || ""))
      && /Success/i.test(String(vaultSegment.result || ""));

    window.resolveProvinceDepthsSegment(depthsHex.col, depthsHex.row, 2);
    const lairPromptText = modalText();
    provinceAfterDepthsInit = getProvinceMapState();
    depthsHexState = provinceAfterDepthsInit.mapData.find((hex) => hex && hex.col === depthsHex.col && hex.row === depthsHex.row);
    floorState = depthsHexState && depthsHexState.data && depthsHexState.data.provinceDepths && depthsHexState.data.provinceDepths.floors
      ? depthsHexState.data.provinceDepths.floors["1"]
      : null;
    const depthsLairPromptOk = !!(floorState && floorState.segments && floorState.segments[2] && floorState.segments[2].pendingCombat)
      && /Start Combat/i.test(lairPromptText)
      && /Victory/i.test(lairPromptText)
      && /Fall Back/i.test(lairPromptText);

    window.resolveProvinceDepthsCombatOutcome(depthsHex.col, depthsHex.row, 2, true);
    provinceAfterDepthsInit = getProvinceMapState();
    depthsHexState = provinceAfterDepthsInit.mapData.find((hex) => hex && hex.col === depthsHex.col && hex.row === depthsHex.row);
    floorState = depthsHexState && depthsHexState.data && depthsHexState.data.provinceDepths && depthsHexState.data.provinceDepths.floors
      ? depthsHexState.data.provinceDepths.floors["1"]
      : null;
    const lairSegment = floorState && Array.isArray(floorState.segments) ? (floorState.segments[2] || {}) : {};
    const depthsLairResolved = !!lairSegment.cleared
      && !lairSegment.pendingCombat
      && /Hostiles cleared/i.test(String(lairSegment.result || ""));

    window.resolveProvinceDepthsSegment(depthsHex.col, depthsHex.row, 3);
    provinceAfterDepthsInit = getProvinceMapState();
    depthsHexState = provinceAfterDepthsInit.mapData.find((hex) => hex && hex.col === depthsHex.col && hex.row === depthsHex.row);
    floorState = depthsHexState && depthsHexState.data && depthsHexState.data.provinceDepths && depthsHexState.data.provinceDepths.floors
      ? depthsHexState.data.provinceDepths.floors["1"]
      : null;
    const stairSegment = floorState && Array.isArray(floorState.segments) ? (floorState.segments[3] || {}) : {};
    const depthsStairUnlocked = !!(floorState && floorState.stairsUnlocked)
      && !!stairSegment.cleared
      && /Stair secured/i.test(String(stairSegment.result || ""));

    window.descendProvinceDepthsFloor(depthsHex.col, depthsHex.row);
    provinceAfterDepthsInit = getProvinceMapState();
    depthsHexState = provinceAfterDepthsInit.mapData.find((hex) => hex && hex.col === depthsHex.col && hex.row === depthsHex.row);
    const depthsDescended = Number((((depthsHexState || {}).data || {}).provinceDepths || {}).currentFloor || 0) === 2;

    return {
      ruins: {
        ruinHeaderOk,
        ruinExplorePromptOk,
        ruinRoomCleared,
        ruinBossPromptOk,
        ruinBossResolved
      },
      depths: {
        depthsHeaderOk,
        depthsStatPromptOk,
        depthsVaultResolved,
        depthsLairPromptOk,
        depthsLairResolved,
        depthsStairUnlocked,
        depthsDescended
      }
    };
  });

  const checks = [
    summary.ruins.ruinHeaderOk,
    summary.ruins.ruinExplorePromptOk,
    summary.ruins.ruinRoomCleared,
    summary.ruins.ruinBossPromptOk,
    summary.ruins.ruinBossResolved,
    summary.depths.depthsHeaderOk,
    summary.depths.depthsStatPromptOk,
    summary.depths.depthsVaultResolved,
    summary.depths.depthsLairPromptOk,
    summary.depths.depthsLairResolved,
    summary.depths.depthsStairUnlocked,
    summary.depths.depthsDescended
  ];

  if (checks.some((entry) => !entry)) {
    throw new Error(`Province ruins/depths assertion failed: ${JSON.stringify(summary)}`);
  }
  if (pageErrors.length) {
    throw new Error(`Encountered ${pageErrors.length} page errors: ${pageErrors.join(" | ")}`);
  }

  return summary;
}

async function run() {
  const port = await pickPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServer(port);
  let browser;
  try {
    await waitForServer(baseUrl, START_TIMEOUT_MS);
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const summary = await runScenario(page, baseUrl);
    process.stdout.write(`[smoke] province-ruins-depths summary: ${JSON.stringify(summary)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await wait(250);
      if (!server.killed) server.kill("SIGKILL");
    }
  }
}

run().catch((err) => {
  process.stderr.write(`[smoke] province-ruins-depths failed: ${String(err && err.stack ? err.stack : err)}\n`);
  process.exitCode = 1;
});

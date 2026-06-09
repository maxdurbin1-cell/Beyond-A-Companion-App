import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { chromium } from "playwright";

const START_TIMEOUT_MS = 20000;

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
  for (let i = 0; i < 20; i += 1) {
    const candidate = 4100 + Math.floor(Math.random() * 1400);
    if (await checkPortOpen(candidate)) return candidate;
  }
  throw new Error("Unable to find a free port.");
}

async function waitForServer(url, child) {
  const start = Date.now();
  while (Date.now() - start < START_TIMEOUT_MS) {
    if (child.exitCode !== null) throw new Error("Server exited before ready.");
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch (_err) {}
    await wait(250);
  }
  throw new Error("Timed out waiting for server.");
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

async function verifyInspectSkills(page) {
  const result = await page.evaluate(() => {
    if (typeof window.getCodexBestiaryByRegion !== "function" || typeof window.getBestiaryEntrySkillObjects !== "function") {
      return { ok: false, error: "Bestiary helpers unavailable." };
    }
    const byRegion = window.getCodexBestiaryByRegion();
    const picks = [];
    Object.keys(byRegion || {}).forEach((region) => {
      const list = Array.isArray(byRegion[region]) ? byRegion[region] : [];
      if (list.length) picks.push({ region, entry: list[0] });
    });
    const selected = picks.slice(0, 5);
    const details = selected.map(({ region, entry }) => {
      const skills = window.getBestiaryEntrySkillObjects(entry);
      try {
        window.openBestiaryEntryDetails(region, entry.name);
      } catch (_err) {}
      const modal = document.getElementById("rollModal");
      const modalText = String(modal && modal.textContent || "");
      if (typeof window.closeModal === "function") window.closeModal();
      return {
        region,
        name: String(entry && entry.name || "Unknown"),
        skillCount: Array.isArray(skills) ? skills.length : 0,
        names: Array.isArray(skills) ? skills.map((s) => String(s && s.name || "")).filter(Boolean) : [],
        validRanges: Array.isArray(skills) ? skills.every((s) => {
          const ranges = Array.isArray(s && s.range) ? s.range : [];
          return ranges.length > 0 && ranges.every((r) => ["engaged", "close", "nearby", "far"].includes(String(r || "").toLowerCase()));
        }) : false,
        rollTextOk: Array.isArray(skills) ? skills.every((s) => /vs Dread d\d+/i.test(String(s && s.rollLabel || ""))) : false,
        modalHasBoth: Array.isArray(skills) && skills.length >= 2
          ? modalText.includes(String(skills[0].name || "")) && modalText.includes(String(skills[1].name || ""))
          : false
      };
    });
    const ok = details.length >= 3 && details.every((d) => d.skillCount === 2 && d.names.length === 2 && d.validRanges && d.rollTextOk && d.modalHasBoth);
    return { ok, details };
  });

  if (!result || !result.ok) {
    throw new Error("Inspect Skills verification failed: " + JSON.stringify(result));
  }
  return result.details;
}

async function runEffectFamilyTest(page, effectType, opts = {}) {
  const expected = await page.evaluate(async ({ effectType, opts }) => {
    const basePlayer = {
      id: "player-1",
      name: "Wayfarer",
      faction: "player",
      hp: 20,
      maxHp: 20,
      q: 0,
      r: 0,
      size: 1,
      isPlayer: true,
      defend: 4,
      body: 4,
      mind: 4,
      spirit: 4,
      control: 4,
      strike: 4,
      shoot: 4,
      lead: 4
    };
    const enemyHp = Number(opts && opts.enemyHp || 10);
    const enemyMaxHp = Number(opts && opts.enemyMaxHp || enemyHp);
    const enemy = {
      id: "enemy-1",
      name: "Effect Tester",
      faction: "monster",
      hp: enemyHp,
      maxHp: enemyMaxHp,
      q: 1,
      r: 0,
      size: 1,
      dread: 20,
      codexDread: 20,
      deathNumber: 10,
      enemySkills: [
        {
          name: "Effect Probe",
          desc: "Automated effect probe.",
          save: "defend",
          range: ["engaged", "close", "nearby", "far"],
          effectType,
          kind: effectType,
          damageMode: effectType === "damage" ? "margin" : "flat",
          onFailStress: effectType === "self_siphon" ? 2 : (effectType === "damage" ? 0 : 1),
          onFailStressBonus: 0,
          effectCondition: effectType === "condition_negative" ? "shaken" : "",
          onFail: "Effect applies.",
          onSuccess: "Resisted.",
          source: "Smoke",
          costActions: 1,
          dreadDie: 20
        },
        {
          name: "Filler",
          desc: "Fallback move.",
          save: "defend",
          range: ["engaged"],
          effectType: "damage",
          kind: "damage",
          damageMode: "flat",
          onFailStress: 1,
          onFail: "Take 1 stress.",
          onSuccess: "Resisted.",
          source: "Smoke",
          costActions: 1,
          dreadDie: 20
        }
      ]
    };

    window.openCombatSceneEditor({ id: "effect-scene-" + effectType, name: "Effect " + effectType, tokens: [basePlayer, enemy] });

    if (!window.S) window.S = {};
    if (!window.S.stats) {
      window.S.stats = { body: 4, strike: 4, shoot: 4, mind: 4, spirit: 4, defend: 4, control: 4, lead: 4, valor: 4 };
    }
    if (!window.S.conditions) {
      window.S.conditions = { empowered: false, protected: false, focused: false, bolstered: false, weakened: false, vulnerable: false, distracted: false, shaken: false };
    }
    if (!window.S.combat) window.S.combat = {};
    window.S.combat.active = true;
    window.S.combat.round = 1;
    window.S.combat.actionsLeft = 3;
    window.S.combat.maxActions = 3;
    window.S.radiation = 0;
    window.S.mentalStress = 0;
    window.S.combat.enemySkillLocks = {};
    Object.keys(window.S.conditions).forEach((k) => { window.S.conditions[k] = false; });

    const st = window.CombatSceneStore.getState();
    window.CombatSceneStore.setState(Object.assign({}, st, {
      tokens: (st.tokens || []).map((row) => {
        if (!row || !row.id) return row;
        if (row.id === "enemy-1") {
          return Object.assign({}, row, { hp: enemyHp, maxHp: enemyMaxHp, dead: false });
        }
        if (row.id === "player-1") {
          return Object.assign({}, row, { hp: 20, maxHp: 20, dead: false });
        }
        return row;
      }),
      selectedTokenId: "enemy-1",
      selectedTokenIds: ["enemy-1"],
      teamActions: { "enemy-1": 3, "player-1": 3 },
      initiative: [{ tokenId: "enemy-1" }, { tokenId: "player-1" }],
      initiativeIndex: 0,
      currentTurnIndex: 0
    }));

    await new Promise((r) => setTimeout(r, 50));
    if (typeof window.debugApplyEnemySkillEffect !== "function") {
      return { ok: false, error: "debugApplyEnemySkillEffect unavailable.", effectType };
    }

    function snapshot() {
      const now = window.CombatSceneStore.getState();
      const enemyRow = (now.tokens || []).find((t) => t && t.id === "enemy-1") || {};
      const playerRow = (now.tokens || []).find((t) => t && t.id === "player-1") || {};
      return {
        playerHp: Number(playerRow.hp || 0),
        enemyHp: Number(enemyRow.hp || 0),
        playerConditions: Object.assign({}, window.S && window.S.conditions || {}),
        playerActionsLeft: Math.max(0, Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0)),
        radiation: Math.max(0, Number(window.S && window.S.radiation || 0)),
        mentalStress: Math.max(0, Number(window.S && window.S.mentalStress || 0)),
        locks: Object.assign({}, window.S && window.S.combat && window.S.combat.enemySkillLocks || {}),
        enemyStatus: Array.isArray(enemyRow.status) ? enemyRow.status.slice() : []
      };
    }

    const before = snapshot();
    const invoke = window.debugApplyEnemySkillEffect(effectType, {
      actorId: "enemy-1",
      foeId: "player-1",
      effectCondition: effectType === "condition_negative" ? "shaken" : "",
      onFailStress: effectType === "self_heal" ? 0 : 1,
      damageMode: effectType === "damage" ? "margin" : "flat",
      skipDamage: effectType === "self_heal"
    });
    await new Promise((r) => setTimeout(r, 40));
    const after = snapshot();

    let passed = false;
    if (effectType === "radiation" && (after.radiation > before.radiation || (invoke && Array.isArray(invoke.notes) && invoke.notes.some((n) => /radiation\s*\+/i.test(String(n || "")))))) passed = true;
    if (effectType === "action_down" && after.playerActionsLeft < before.playerActionsLeft) passed = true;
    if (effectType === "lock_spell" && (Number(after.locks.spellUntilRound || 0) >= 2 || (invoke && Array.isArray(invoke.notes) && invoke.notes.some((n) => /spellcasting locked/i.test(String(n || "")))))) passed = true;
    if (effectType === "lock_hack" && (Number(after.locks.hackUntilRound || 0) >= 2 || (invoke && Array.isArray(invoke.notes) && invoke.notes.some((n) => /hack casting locked/i.test(String(n || "")))))) passed = true;
    if (effectType === "lock_augmentation" && (Number(after.locks.augmentationUntilRound || 0) >= 2 || (invoke && Array.isArray(invoke.notes) && invoke.notes.some((n) => /augmentation use locked/i.test(String(n || "")))))) passed = true;
    if (effectType === "condition_negative" && (after.playerConditions.weakened || after.playerConditions.vulnerable || after.playerConditions.shaken || after.playerConditions.distracted)) passed = true;
    if (effectType === "mental_stress" && after.mentalStress > before.mentalStress) passed = true;
    if (effectType === "damage" && after.playerHp < before.playerHp) passed = true;
    if (effectType === "self_heal" && after.enemyHp > before.enemyHp) passed = true;
    if (effectType === "self_siphon" && after.enemyHp > before.enemyHp) passed = true;
    if (effectType === "self_protected" && after.enemyStatus.includes("protected")) passed = true;
    if (effectType === "self_empowered" && after.enemyStatus.includes("empowered")) passed = true;
    if (effectType === "self_invisible" && after.enemyStatus.includes("invisible")) passed = true;
    if (effectType === "self_invincible" && after.enemyStatus.includes("invincible")) passed = true;

    let lockoutCheck = { attempted: false, blocked: false, message: "" };
    if (effectType === "lock_hack") {
      lockoutCheck.attempted = true;
      let lastNotif = "";
      const originalNotif = window.showNotif;
      window.showNotif = function (msg, type) {
        lastNotif = String(msg || "");
        if (typeof originalNotif === "function") return originalNotif(msg, type);
      };
      const actionsBefore = Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0);
      try {
        window.executeCombatUtilityAction("hack", "Javelin");
      } catch (_err) {}
      const actionsAfter = Number(window.S && window.S.combat && window.S.combat.actionsLeft || 0);
      window.showNotif = originalNotif;
      lockoutCheck.blocked = actionsAfter === actionsBefore;
      lockoutCheck.message = lastNotif;
    }

    return { ok: passed, effectType, before, after, lockoutCheck, invoke };
  }, { effectType, opts });

  if (!expected || !expected.ok) {
    throw new Error("Effect family verification failed: " + JSON.stringify(expected));
  }
  return expected;
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

  try {
    await waitForServer(baseUrl, child);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await dismissBlockingOverlays(page);

    const inspectDetails = await verifyInspectSkills(page);

    const tests = [
      { effectType: "radiation" },
      { effectType: "action_down" },
      { effectType: "lock_spell" },
      { effectType: "lock_hack" },
      { effectType: "lock_augmentation" },
      { effectType: "condition_negative" },
      { effectType: "mental_stress" },
      { effectType: "damage" },
      { effectType: "self_heal", opts: { enemyHp: 6, enemyMaxHp: 12 } },
      { effectType: "self_siphon", opts: { enemyHp: 6, enemyMaxHp: 12 } },
      { effectType: "self_protected" },
      { effectType: "self_empowered" },
      { effectType: "self_invisible" },
      { effectType: "self_invincible" }
    ];

    const effectResults = [];
    for (const test of tests) {
      const result = await runEffectFamilyTest(page, test.effectType, test.opts || {});
      effectResults.push(result);
    }

    console.log("Monster Inspect Skills verified:");
    inspectDetails.forEach((row) => {
      console.log(`- ${row.region}/${row.name}: ${row.names.join(", ")}`);
    });

    console.log("Effect family checks:");
    effectResults.forEach((row) => {
      const lockSuffix = row.lockoutCheck && row.lockoutCheck.attempted
        ? ` | lockoutBlocked=${row.lockoutCheck.blocked} msg=${row.lockoutCheck.message}`
        : "";
      console.log(`- ${row.effectType}: PASS${lockSuffix}`);
    });

    console.log("Monster skills/effects smoke passed.");
  } finally {
    await browser.close().catch(() => {});
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        wait(1500)
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

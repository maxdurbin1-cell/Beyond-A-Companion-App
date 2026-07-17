import { spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const suiteName = String(process.argv[2] || "multiplayer").toLowerCase();
const suites = {
  core: [
    "smoke:clicks",
    "smoke:portrait-preview",
    "smoke:solo-library",
    "smoke:manual-exploded-rolls",
    "smoke:minigames-expedition",
    "smoke:minigames-expedition-campaign",
    "smoke:bone-oracle",
    "smoke:gm-forge-chronicle",
    "smoke:combat-sync",
    "smoke:campaign-enemy-prompt",
    "smoke:combat-turns",
    "smoke:campaign-tab-isolation",
    "smoke:token-target-damage",
    "smoke:enemy-loot-drop",
    "smoke:enemy-loot-drop-items",
    "smoke:offhand-shield-actions",
    "smoke:vtt-stability",
    "smoke:scenario",
    "smoke:campaign-missions-context",
    "smoke:guild-multiplayer-sync",
    "smoke:campaign-shared-origin-and-sheets",
    "smoke:campaign-roll-request-flow",
    "smoke:authority-travel",
    "smoke:campaign-exploration-sweep",
    "smoke:campaign-music-vtt-join",
    "smoke:galaxy-manual-prompts",
    "smoke:wtw-permutations",
    "smoke:province-ruins-depths",
    "smoke:deep-world-branches",
    "smoke:newsun-scheduler",
    "smoke:legacy-raid",
    "smoke:raid-combat-return",
    "smoke:quick-panel-raid-ui",
    "smoke:raid-teleport-choice",
    "smoke:guild-system",
    "smoke:open-world",
    "smoke:maybe-reconnect"
  ],
  multiplayer: [
    "smoke:gm-forge-chronicle",
    "smoke:combat-sync",
    "smoke:campaign-enemy-prompt",
    "smoke:combat-turns",
    "smoke:scenario",
    "smoke:authority-travel",
    "smoke:campaign-exploration-sweep",
    "smoke:campaign-music-vtt-join",
    "smoke:guild-multiplayer-sync",
    "smoke:campaign-shared-origin-and-sheets",
    "smoke:campaign-roll-request-flow"
  ]
};

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

async function pickAvailablePort(preferredPort) {
  if (await canBindPort(preferredPort)) return preferredPort;
  for (let i = 0; i < 64; i += 1) {
    const candidate = 3600 + Math.floor(Math.random() * 4200);
    if (await canBindPort(candidate)) return candidate;
  }
  throw new Error(`Unable to find a free port for ${suiteName} release suite.`);
}

async function runSuite() {
  const suite = suites[suiteName];
  const maxAttempts = 1;
  if (!suite) {
    throw new Error(`Unknown release suite "${suiteName}". Expected one of: ${Object.keys(suites).join(", ")}`);
  }

  for (let i = 0; i < suite.length; i += 1) {
    const script = suite[i];
    let passed = false;
    let lastStatus = 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const port = await pickAvailablePort(3600 + i + ((attempt - 1) * 80));
      const stamp = `${Date.now()}-${i}-${attempt}-${Math.floor(Math.random() * 100000)}`;
      const tempRoot = path.join(os.tmpdir(), `btl-${suiteName}-suite-${stamp}`);
      const env = {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        SMOKE_URL: `http://127.0.0.1:${port}`,
        CAMPAIGN_STORE_PATH: path.join(tempRoot, "campaign-data.json"),
        CAMPAIGN_SNAPSHOT_DIR: path.join(tempRoot, "snapshots"),
        LICENSE_STORE_PATH: path.join(tempRoot, "license-data.json")
      };

      process.stdout.write(`\n[${suiteName}] Running ${script} on ${env.SMOKE_URL} (attempt ${attempt}/${maxAttempts})\n`);
      const res = spawnSync(npmCmd, ["run", script], { stdio: "inherit", env });
      lastStatus = Number.isInteger(res.status) ? res.status : 1;
      if (lastStatus === 0) {
        passed = true;
        break;
      }
      if (attempt < maxAttempts) {
        process.stdout.write(`[${suiteName}] ${script} failed on attempt ${attempt}. Retrying with a fresh port...\n`);
      }
    }
    if (!passed) {
      process.exit(lastStatus);
    }
  }

  process.stdout.write(`\n[${suiteName}] ${suiteName === "core" ? "Core smoke suite" : "Multiplayer release soak"} passed.\n`);
}

await runSuite();

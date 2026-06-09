const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const NODE_ENV = String(process.env.NODE_ENV || "development").trim().toLowerCase();
const IS_PRODUCTION = NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const HOST = String(process.env.HOST || process.env.BIND_HOST || "0.0.0.0").trim() || "0.0.0.0";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
const BTL_DATA_DIR = path.resolve(process.env.BTL_DATA_DIR || path.join(os.homedir(), ".beyond-the-light"));
const STORE_PATH = path.resolve(process.env.CAMPAIGN_STORE_PATH || path.join(__dirname, "campaign-data.json"));
const STORE_BACKUP_PATH = `${STORE_PATH}.bak`;
const STORE_SNAPSHOT_DIR = path.resolve(
  process.env.CAMPAIGN_SNAPSHOT_DIR || path.join(path.dirname(STORE_PATH), `${path.basename(STORE_PATH)}.snapshots`)
);
const LEGACY_LICENSE_STORE_PATH = path.join(BTL_DATA_DIR, "license-data.json");
const LICENSE_STORE_PATH = path.resolve(process.env.LICENSE_STORE_PATH || "/opt/render/project/src/license-data.json");
const LICENSE_STORE_BACKUP_PATH = `${LICENSE_STORE_PATH}.bak`;
const ACCESS_PAGE_PATH = path.join(__dirname, "access.html");
const LICENSE_ADMIN_PAGE_PATH = path.join(__dirname, "license-admin.html");
const PAYWALL_SESSION_COOKIE = "btl_access_session";
const PAYWALL_SESSION_TTL_MS = Math.max(24 * 60 * 60 * 1000, Number(process.env.PAYWALL_SESSION_TTL_MS) || (90 * 24 * 60 * 60 * 1000));
const LICENSE_CODE_LENGTH = Math.max(6, Number(process.env.LICENSE_CODE_LENGTH) || 10);
const GOD_KEY_HASH = String(process.env.PAYWALL_GOD_KEY_HASH || "").trim().toLowerCase();
const GOD_KEY_PLAINTEXT = String(process.env.PAYWALL_GOD_KEY || "").trim();
const PAYWALL_ADMIN_KEY = String(process.env.PAYWALL_ADMIN_KEY || "Turbo_GooseDT*24").trim();
const PAYWALL_ADMIN_EMAIL = normalizeEmail(process.env.PAYWALL_ADMIN_EMAIL || "maxadurbin@gmail.com");
const PAYWALL_DISABLED = ["1", "true", "yes", "on"].includes(String(process.env.PAYWALL_DISABLED || "").trim().toLowerCase());
const PAYWALL_BYPASS_LOCALHOST = ["1", "true", "yes", "on"].includes(String(process.env.PAYWALL_BYPASS_LOCALHOST || (IS_PRODUCTION ? "" : "1")).trim().toLowerCase());
const PRICE_SINGLE_CENTS = 1000;
const PRICE_BUNDLE4_CENTS = 2500;
const CAMPAIGN_SNAPSHOT_MIN_INTERVAL_MS = Math.max(50, Number(process.env.CAMPAIGN_SNAPSHOT_MIN_INTERVAL_MS) || 140);
const CAMPAIGN_PERSIST_DEBOUNCE_MS = Math.max(50, Number(process.env.CAMPAIGN_PERSIST_DEBOUNCE_MS) || 250);
const CAMPAIGN_BACKUP_INTERVAL_MS = Math.max(60 * 1000, Number(process.env.CAMPAIGN_BACKUP_INTERVAL_MS) || (5 * 60 * 1000));
const CAMPAIGN_MAX_SNAPSHOT_BACKUPS = Math.max(3, Number(process.env.CAMPAIGN_MAX_SNAPSHOT_BACKUPS) || 18);
const GM_ONLY_EVENTS = {
  "campaign:archive": true,
  "campaign:unarchive": true,
  "campaign:setPassword": true,
  "campaign:delete": true,
  "campaign:rollRequest": true,
  "campaign:closeRoll": true,
  "campaign:exportSnapshot": true,
  "campaign:importSnapshot": true
};
const AUTHORITATIVE_STATE_KEYS = [
  "provinceMap",
  "lastSea",
  "starSystem",
  "worldThatWas",
  "gameDate",
  "combatScene",
  "gmSettings",
  "campaignTravel",
  "factionRenown",
  "factionBases",
  "factionWayfarerTasks",
  "factionNarrative",
  "campaignCombat",
  "characterDeathStates",
  "contestedRolls",
  "characterDice"
];
const PLAYER_PATCH_ALLOWED_KEYS = {
  renown: true,
  credits: true,
  mentalStress: true,
  missionTokens: true,
  activeMissions: true,
  completedMissions: true,
  availableJobs: true,
  storyline: true,
  holding: true,
  caravan: true,
  factionWayfarerTasks: true,
  factionNarrative: true,
  factionRenown: true,
  factionBases: true,
  provinceSelections: true,
  partyStash: true,
  characterInventories: true,
  economyLedger: true,
  readyCheck: true,
  pendingChecks: true,
  combatScene: true
};
const AUDIO_PROXY_ALLOWED_HOSTS = new Set([
  "incompetech.com",
  "www.incompetech.com",
  "opengameart.org",
  "www.opengameart.org",
  "freesound.org",
  "www.freesound.org",
  "cdn.freesound.org",
  "drive.google.com",
  "archive.org",
  "ia800000.us.archive.org",
  "ia600000.us.archive.org",
  "ia500000.us.archive.org",
  "ia400000.us.archive.org",
  "ia200000.us.archive.org",
  "ia100000.us.archive.org"
]);

const campaigns = new Map();
let persistTimer = null;
let persistQueued = false;
let persistQueuedAt = 0;
let campaignBackupTimer = null;
const campaignPersistenceHealth = {
  lastPersistAt: 0,
  lastPersistDurationMs: 0,
  lastPersistError: "",
  lastPersistPath: STORE_PATH,
  lastBackupAt: 0,
  lastSnapshotAt: 0,
  lastSnapshotPath: "",
  lastLoadSource: "",
  lastLoadError: "",
  lastIntegrityCheckAt: 0,
  restoredFrom: "",
  persistCount: 0,
  snapshotCount: 0
};
const licenseStore = {
  version: 1,
  updatedAt: Date.now(),
  licenses: {},
  sessions: {}
};

app.use(express.json({ limit: "256kb" }));

function safeClone(value) {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_err) {
    return value;
  }
}

function safeIsoTime(value) {
  const n = Number(value || 0);
  if (!n) return "";
  try {
    return new Date(n).toISOString();
  } catch (_err) {
    return "";
  }
}

function writeJsonAtomic(targetPath, serialized, backupPath) {
  const resolved = path.resolve(targetPath);
  const tmpPath = `${resolved}.${process.pid}.${Date.now()}.tmp`;
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  try {
    fs.writeFileSync(tmpPath, serialized, "utf8");
    fs.renameSync(tmpPath, resolved);
    if (backupPath) {
      fs.writeFileSync(path.resolve(backupPath), serialized, "utf8");
    }
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_cleanupErr) {}
    throw err;
  }
}

function listCampaignSnapshotFiles() {
  try {
    if (!fs.existsSync(STORE_SNAPSHOT_DIR)) return [];
    return fs.readdirSync(STORE_SNAPSHOT_DIR)
      .filter((name) => /^campaign-data-\d{4}-\d{2}-\d{2}T/.test(name) && name.endsWith(".json"))
      .map((name) => {
        const fullPath = path.join(STORE_SNAPSHOT_DIR, name);
        let mtime = 0;
        try {
          mtime = Number(fs.statSync(fullPath).mtimeMs || 0);
        } catch (_err) {}
        return { path: fullPath, mtime };
      })
      .sort((a, b) => Number(b.mtime || 0) - Number(a.mtime || 0));
  } catch (_err) {
    return [];
  }
}

function pruneCampaignSnapshotBackups() {
  const files = listCampaignSnapshotFiles();
  files.slice(CAMPAIGN_MAX_SNAPSHOT_BACKUPS).forEach((entry) => {
    try {
      fs.unlinkSync(entry.path);
    } catch (_err) {}
  });
}

function mergePlayerActionQueue(existingState, incomingQueue, requesterToken) {
  const existingQueue = Array.isArray(existingState && existingState.actionQueue) ? existingState.actionQueue : [];
  const merged = existingQueue.slice();
  const knownIds = new Set(merged.map((entry) => String(entry && entry.id || "")).filter(Boolean));
  if (!Array.isArray(incomingQueue) || !requesterToken) return merged;

  incomingQueue.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    if (String(entry.token || "") !== String(requesterToken || "")) return;
    if (String(entry.status || "pending") !== "pending") return;
    const id = String(entry.id || "");
    if (!id || knownIds.has(id)) return;
    knownIds.add(id);
    merged.push(safeClone(entry));
  });

  return merged;
}

function getSharedMissionMergeKey(mission) {
  if (!mission || typeof mission !== "object") return "";
  const missionId = mission.id;
  if (missionId !== undefined && missionId !== null && String(missionId).trim()) {
    return `id:${String(missionId).trim()}`;
  }
  return [
    String(mission.missionType || ""),
    String(mission.title || ""),
    String(mission.location || ""),
    String(mission.templateId || mission.templateLabel || ""),
    String(mission.originOwnerToken || ""),
    String(mission.originOwnerName || ""),
    String(mission.originReason || "")
  ].join("|");
}

function getSharedJobMergeKey(job) {
  if (!job || typeof job !== "object") return "";
  const jobId = job.id;
  if (jobId !== undefined && jobId !== null && String(jobId).trim()) {
    return `id:${String(jobId).trim()}`;
  }
  return [
    String(job.missionType || ""),
    String(job.title || ""),
    String(job.location || ""),
    String(job.templateId || job.templateLabel || "")
  ].join("|");
}

function getMissionSourceJobKey(mission) {
  if (!mission || typeof mission !== "object") return "";
  const sourceId = mission.sourceJobId ?? mission.acceptedJobId ?? mission.jobId;
  return sourceId !== undefined && sourceId !== null && String(sourceId).trim()
    ? `id:${String(sourceId).trim()}`
    : "";
}

function mergeSharedMissionLists(existingList, incomingList) {
  const out = [];
  const indexByKey = new Map();

  const addOrReplace = (mission) => {
    if (!mission || typeof mission !== "object") return;
    const key = getSharedMissionMergeKey(mission);
    if (!key) return;
    const row = safeClone(mission);
    if (indexByKey.has(key)) {
      out[indexByKey.get(key)] = row;
    } else {
      indexByKey.set(key, out.length);
      out.push(row);
    }
  };

  (Array.isArray(existingList) ? existingList : []).forEach(addOrReplace);
  (Array.isArray(incomingList) ? incomingList : []).forEach(addOrReplace);
  return out;
}

function normalizeSharedMissionCollections(sharedState) {
  if (!sharedState || typeof sharedState !== "object") return sharedState;

  if (Array.isArray(sharedState.completedMissions)) {
    sharedState.completedMissions = mergeSharedMissionLists([], sharedState.completedMissions);
  }

  if (Array.isArray(sharedState.activeMissions)) {
    const completedKeys = new Set(
      (Array.isArray(sharedState.completedMissions) ? sharedState.completedMissions : [])
        .map(getSharedMissionMergeKey)
        .filter(Boolean)
    );
    sharedState.activeMissions = mergeSharedMissionLists([], sharedState.activeMissions)
      .filter((mission) => !completedKeys.has(getSharedMissionMergeKey(mission)));
  }

  if (Array.isArray(sharedState.availableJobs)) {
    const claimedJobKeys = new Set();
    (Array.isArray(sharedState.activeMissions) ? sharedState.activeMissions : []).forEach((mission) => {
      const key = getMissionSourceJobKey(mission);
      if (key) claimedJobKeys.add(key);
    });
    (Array.isArray(sharedState.completedMissions) ? sharedState.completedMissions : []).forEach((mission) => {
      const key = getMissionSourceJobKey(mission);
      if (key) claimedJobKeys.add(key);
    });

    const seen = new Set();
    const jobs = [];
    sharedState.availableJobs.forEach((job) => {
      const key = getSharedJobMergeKey(job);
      if (!key || seen.has(key) || claimedJobKeys.has(key)) return;
      seen.add(key);
      jobs.push(safeClone(job));
    });
    sharedState.availableJobs = jobs;
  }

  return sharedState;
}

function mergeAllowedPlayerState(existingState, incoming, requesterToken, conflicts) {
  const merged = Object.assign({}, existingState || {});
  const incomingState = incoming && typeof incoming === "object" ? incoming : {};
  const conflictList = Array.isArray(conflicts) ? conflicts : [];

  Object.keys(incomingState).forEach((key) => {
    if (key === "provinceSelections" || key === "economyLedger" || key === "characterInventories" || key === "actionQueue" || key === "readyCheck" || key === "pendingChecks") return;
    if (!PLAYER_PATCH_ALLOWED_KEYS[key]) {
      conflictList.push(key);
      return;
    }
    if (key === "activeMissions") {
      merged.activeMissions = mergeSharedMissionLists(existingState && existingState.activeMissions, incomingState.activeMissions);
      return;
    }
    if (key === "completedMissions") {
      merged.completedMissions = mergeSharedMissionLists(existingState && existingState.completedMissions, incomingState.completedMissions);
      return;
    }
    if (key === "missionTokens") {
      const existingTokens = existingState && existingState.missionTokens && typeof existingState.missionTokens === "object"
        ? safeClone(existingState.missionTokens) || {}
        : {};
      const incomingTokens = incomingState.missionTokens && typeof incomingState.missionTokens === "object"
        ? safeClone(incomingState.missionTokens) || {}
        : {};
      merged.missionTokens = Object.assign({}, existingTokens, incomingTokens);
      return;
    }
    merged[key] = safeClone(incomingState[key]);
  });

  if (
    incomingState.provinceSelections && typeof incomingState.provinceSelections === "object" &&
    !Array.isArray(incomingState.provinceSelections)
  ) {
    const currentSelections = existingState && existingState.provinceSelections && typeof existingState.provinceSelections === "object" && !Array.isArray(existingState.provinceSelections)
      ? existingState.provinceSelections
      : {};
    merged.provinceSelections = Object.assign({}, currentSelections, safeClone(incomingState.provinceSelections) || {});
  }

  if (incomingState.characterInventories && typeof incomingState.characterInventories === "object" && !Array.isArray(incomingState.characterInventories)) {
    if (requesterToken && Object.prototype.hasOwnProperty.call(incomingState.characterInventories, requesterToken)) {
      const currentInventories = existingState && existingState.characterInventories && typeof existingState.characterInventories === "object"
        ? safeClone(existingState.characterInventories) || {}
        : {};
      currentInventories[requesterToken] = safeClone(incomingState.characterInventories[requesterToken]) || [];
      merged.characterInventories = currentInventories;
    }
  }

  if (Array.isArray(incomingState.actionQueue)) {
    merged.actionQueue = mergePlayerActionQueue(existingState, incomingState.actionQueue, requesterToken);
  }

  if (incomingState.readyCheck && typeof incomingState.readyCheck === "object") {
    const incomingReady = incomingState.readyCheck;
    const currentReady = existingState && existingState.readyCheck && typeof existingState.readyCheck === "object"
      ? safeClone(existingState.readyCheck) || {}
      : {};
    const response = incomingReady.response && typeof incomingReady.response === "object" ? incomingReady.response : null;
    const incomingId = String(incomingReady.id || "");
    const currentId = String(currentReady.id || "");
    const responseToken = response ? String(response.token || "") : "";
    const pending = String(currentReady.status || "") === "pending";

    if (response && requesterToken && responseToken === String(requesterToken) && currentId && incomingId === currentId && pending) {
      if (!currentReady.responses || typeof currentReady.responses !== "object") currentReady.responses = {};
      currentReady.responses[responseToken] = {
        ready: !!response.ready,
        name: String(response.name || "Wayfarer"),
        at: Number(response.at || Date.now()) || Date.now()
      };
      merged.readyCheck = currentReady;
    } else {
      conflictList.push("readyCheck");
    }
  }

  if (incomingState.pendingChecks && typeof incomingState.pendingChecks === "object") {
    const incomingPending = incomingState.pendingChecks;
    const currentPending = existingState && existingState.pendingChecks && typeof existingState.pendingChecks === "object"
      ? safeClone(existingState.pendingChecks) || { active: {}, history: [] }
      : { active: {}, history: [] };
    const active = currentPending.active && typeof currentPending.active === "object" && !Array.isArray(currentPending.active)
      ? currentPending.active
      : {};
    const recordId = String(incomingPending.id || "");
    const submission = incomingPending.submission && typeof incomingPending.submission === "object"
      ? safeClone(incomingPending.submission) || {}
      : null;
    const submissionToken = submission ? String(submission.token || "") : "";
    const record = recordId && active[recordId] && typeof active[recordId] === "object" ? active[recordId] : null;
    const pending = record && String(record.status || "pending") === "pending";

    if (record && pending && requesterToken && submission && submissionToken === String(requesterToken)) {
      if (!Array.isArray(record.submissions)) record.submissions = [];
      const normalized = {
        token: submissionToken,
        name: String(submission.name || "Wayfarer").slice(0, 48),
        role: String(submission.role || "player") === "gm" ? "gm" : "player",
        total: Math.max(0, Number(submission.total || 0) || 0),
        dreadTotal: Math.max(0, Number(submission.dreadTotal || 0) || 0),
        die: Math.max(1, Number(submission.die || 4) || 4),
        success: typeof submission.success === "boolean"
          ? !!submission.success
          : (Math.max(0, Number(submission.total || 0) || 0) >= Math.max(0, Number(submission.dreadTotal || 0) || 0)),
        method: String(submission.method || "auto").slice(0, 24),
        notes: String(submission.notes || "").slice(0, 180),
        at: Number(submission.at || Date.now()) || Date.now()
      };
      const idx = record.submissions.findIndex((row) => String(row && row.token || "") === submissionToken);
      if (idx >= 0) record.submissions[idx] = normalized;
      else record.submissions.push(normalized);
      currentPending.active = active;
      merged.pendingChecks = currentPending;
    } else {
      conflictList.push("pendingChecks");
    }
  }

  return merged;
}

function randomFromChars(length, chars) {
  let value = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    value += chars[idx];
  }
  return value;
}

function randomCode(length) {
  return randomFromChars(length, CODE_CHARS);
}

function randomToken(length) {
  return randomFromChars(length, TOKEN_CHARS);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLicenseCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashString(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function computeGodKeyHash() {
  if (GOD_KEY_HASH) return GOD_KEY_HASH;
  if (!GOD_KEY_PLAINTEXT) return "";
  return hashString(normalizeLicenseCode(GOD_KEY_PLAINTEXT));
}

function isGodKey(inputCode) {
  const hash = computeGodKeyHash();
  const normalized = normalizeLicenseCode(inputCode);
  if (!hash || !normalized) return false;
  return hashString(normalized).toLowerCase() === hash;
}

function parseCookies(req) {
  const header = String((req && req.headers && req.headers.cookie) || "");
  const out = {};
  if (!header) return out;
  const parts = header.split(";");
  for (let i = 0; i < parts.length; i += 1) {
    const pair = parts[i] || "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value || "");
  }
  return out;
}

function makeCookie(name, value, opts) {
  const options = opts || {};
  const parts = [`${name}=${encodeURIComponent(String(value || ""))}`];
  parts.push(`Path=${options.path || "/"}`);
  if (typeof options.maxAgeSeconds === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function safeSessionForResponse(session) {
  if (!session) return null;
  return {
    email: String(session.email || ""),
    isGod: !!session.isGod,
    isAdmin: !!session.isAdmin,
    expiresAt: Number(session.expiresAt || 0)
  };
}

function persistLicenseStoreNow() {
  const data = {
    version: 1,
    updatedAt: Date.now(),
    licenses: licenseStore.licenses && typeof licenseStore.licenses === "object" ? licenseStore.licenses : {},
    sessions: licenseStore.sessions && typeof licenseStore.sessions === "object" ? licenseStore.sessions : {}
  };
  const serialized = JSON.stringify(data, null, 2);
  const tmpPath = `${LICENSE_STORE_PATH}.tmp`;

  fs.mkdirSync(path.dirname(LICENSE_STORE_PATH), { recursive: true });
  fs.writeFileSync(tmpPath, serialized, "utf8");
  fs.renameSync(tmpPath, LICENSE_STORE_PATH);
  fs.writeFileSync(LICENSE_STORE_BACKUP_PATH, serialized, "utf8");
}

function persistLicenseStoreSafe() {
  try {
    persistLicenseStoreNow();
  } catch (err) {
    console.warn("Could not persist license store:", err && err.message ? err.message : err);
  }
}

function loadLicenseStoreFromDisk() {
  try {
    const candidates = [LICENSE_STORE_PATH, LICENSE_STORE_BACKUP_PATH];
    const legacyPath = path.resolve(LEGACY_LICENSE_STORE_PATH);
    const legacyBackupPath = `${legacyPath}.bak`;
    if (legacyPath !== path.resolve(LICENSE_STORE_PATH)) {
      candidates.push(legacyPath);
      candidates.push(legacyBackupPath);
    }

    const uniqueCandidates = [];
    const seen = new Set();
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = path.resolve(candidates[i]);
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      uniqueCandidates.push(candidate);
    }

    let loadedFrom = "";
    for (let i = 0; i < uniqueCandidates.length; i += 1) {
      const candidate = uniqueCandidates[i];
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, "utf8");
      if (!raw.trim()) continue;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.licenses && typeof parsed.licenses === "object") {
        licenseStore.licenses = parsed.licenses;
      }
      if (parsed && parsed.sessions && typeof parsed.sessions === "object") {
        licenseStore.sessions = parsed.sessions;
      }
      licenseStore.updatedAt = Number(parsed && parsed.updatedAt) || Date.now();
      loadedFrom = candidate;
      break;
    }

    if (loadedFrom && path.resolve(loadedFrom) !== path.resolve(LICENSE_STORE_PATH)) {
      persistLicenseStoreSafe();
      console.log(`Migrated license store from ${loadedFrom} to ${LICENSE_STORE_PATH}`);
    }
  } catch (err) {
    console.warn("Could not load license store:", err && err.message ? err.message : err);
  }
}

function createLicenseCode() {
  let tries = 0;
  while (tries < 4000) {
    const raw = randomCode(LICENSE_CODE_LENGTH);
    const code = normalizeLicenseCode(raw);
    if (!code) {
      tries += 1;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(licenseStore.licenses, code)) return code;
    tries += 1;
  }
  throw new Error("Could not allocate license code");
}

function createAccessSession(email, code, flags) {
  const opts = flags && typeof flags === "object" ? flags : {};
  let tries = 0;
  while (tries < 3000) {
    const token = randomToken(32);
    if (Object.prototype.hasOwnProperty.call(licenseStore.sessions, token)) {
      tries += 1;
      continue;
    }
    const now = Date.now();
    const session = {
      token,
      email: normalizeEmail(email),
      code: normalizeLicenseCode(code),
      isGod: !!opts.isGod,
      isAdmin: !!opts.isAdmin,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + PAYWALL_SESSION_TTL_MS
    };
    licenseStore.sessions[token] = session;
    licenseStore.updatedAt = now;
    persistLicenseStoreSafe();
    return session;
  }
  throw new Error("Could not create access session");
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const token = String(cookies[PAYWALL_SESSION_COOKIE] || "").trim();
  if (!token) return null;
  const session = licenseStore.sessions[token];
  if (!session || typeof session !== "object") return null;
  const now = Date.now();
  if (Number(session.expiresAt || 0) <= now) {
    delete licenseStore.sessions[token];
    licenseStore.updatedAt = now;
    persistLicenseStoreSafe();
    return null;
  }
  if ((now - Number(session.lastSeenAt || 0)) > 60 * 1000) {
    session.lastSeenAt = now;
    persistLicenseStoreSafe();
  }
  return session;
}

function clearSessionByRequest(req) {
  const cookies = parseCookies(req);
  const token = String(cookies[PAYWALL_SESSION_COOKIE] || "").trim();
  if (!token) return;
  if (Object.prototype.hasOwnProperty.call(licenseStore.sessions, token)) {
    delete licenseStore.sessions[token];
    licenseStore.updatedAt = Date.now();
    persistLicenseStoreSafe();
  }
}

function isHtmlRequest(req) {
  const accept = String((req && req.headers && req.headers.accept) || "").toLowerCase();
  return accept.includes("text/html") || accept.includes("application/xhtml+xml");
}

function isPaywallPublicPath(pathname) {
  const p = String(pathname || "").trim();
  if (!p) return false;
  if (p === "/access" || p === "/access.html" || p === "/paywall-gate.js") return true;
  if (p === "/admin/licenses" || p === "/license-admin.html" || p === "/license-admin.js") return true;
  if (p.startsWith("/api/license/")) return true;
  return false;
}

function validateAdminKey(req) {
  if (!PAYWALL_ADMIN_KEY) {
    return { ok: false, status: 503, error: "PAYWALL_ADMIN_KEY is not configured on the server." };
  }
  const providedKey = String(req.get("x-admin-key") || "").trim();
  if (providedKey && providedKey === PAYWALL_ADMIN_KEY) {
    return { ok: true };
  }
  const session = getSessionFromRequest(req);
  if (session && session.isAdmin) {
    return { ok: true };
  }
  return { ok: false, status: 403, error: "Admin key is invalid." };
}

function getSortedLicenses() {
  return Object.keys(licenseStore.licenses || {})
    .map((code) => {
      const entry = licenseStore.licenses[code] || {};
      return {
        code: normalizeLicenseCode(entry.code || code),
        email: normalizeEmail(entry.email),
        issuedAt: Number(entry.issuedAt || 0),
        priceCents: Math.max(0, Number(entry.priceCents || 0)),
        bundleSize: Math.max(1, Number(entry.bundleSize || 1)),
        redeemedByEmail: normalizeEmail(entry.redeemedByEmail),
        redeemedAt: Number(entry.redeemedAt || 0),
        disabled: !!entry.disabled
      };
    })
    .sort((a, b) => Number(b.issuedAt || 0) - Number(a.issuedAt || 0));
}

function requirePaywallAccess(req, res, next) {
  // Paywall disabled - all users have full access
  next();
}

function isLoopbackRequest(req) {
  const host = String((req && req.hostname) || "").toLowerCase().trim();
  const forwarded = String((req && req.headers && req.headers["x-forwarded-for"]) || "");
  const firstForwarded = forwarded.split(",")[0].trim();
  const ip = String((req && (req.ip || req.socket && req.socket.remoteAddress)) || "").trim();
  return host === "localhost"
    || host === "127.0.0.1"
    || host === "::1"
    || ip === "127.0.0.1"
    || ip === "::1"
    || ip === "::ffff:127.0.0.1"
    || firstForwarded === "127.0.0.1"
    || firstForwarded === "::1"
    || firstForwarded === "::ffff:127.0.0.1";
}

function hashPassword(password, salt) {
  const s = String(salt || "");
  return crypto.createHash("sha256").update(String(password || "") + ":" + s).digest("hex");
}

function createPasswordPack(password) {
  const pass = String(password || "").trim();
  if (!pass) return null;
  const salt = randomToken(12);
  const hash = hashPassword(pass, salt);
  return { salt, hash };
}

function verifyPassword(campaign, passwordInput) {
  if (!campaign.passwordHash || !campaign.passwordSalt) return true;
  const input = String(passwordInput || "");
  if (!input.trim()) return false;
  return hashPassword(input, campaign.passwordSalt) === campaign.passwordHash;
}

function createCampaignCode() {
  let tries = 0;
  while (tries < 2000) {
    const code = randomCode(6);
    if (!campaigns.has(code)) {
      return code;
    }
    tries += 1;
  }
  throw new Error("Could not allocate campaign code");
}

function createParticipantToken(campaign) {
  let tries = 0;
  while (tries < 5000) {
    const token = randomToken(16);
    if (!campaign.participants.has(token)) {
      return token;
    }
    tries += 1;
  }
  throw new Error("Could not allocate participant token");
}

function ensureCampaignShape(raw) {
  const normalized = {
    code: String((raw && raw.code) || ""),
    shared: {
      tmw: Math.max(0, Number(raw && raw.shared ? raw.shared.tmw : 0) || 0),
      state: raw && raw.shared && raw.shared.state && typeof raw.shared.state === "object"
        ? raw.shared.state
        : {},
      stateVersion: Math.max(0, Number(raw && raw.shared ? raw.shared.stateVersion : 0) || 0)
    },
    participants: new Map(),
    sessions: new Map(),
    gmToken: raw && raw.gmToken ? String(raw.gmToken) : "",
    archived: !!(raw && raw.archived),
    passwordHash: raw && raw.passwordHash ? String(raw.passwordHash) : "",
    passwordSalt: raw && raw.passwordSalt ? String(raw.passwordSalt) : "",
    privateNotes: new Map(),
    activeRollRequest: null,
    log: Array.isArray(raw && raw.log) ? raw.log.slice(-250) : [],
    updatedAt: Number(raw && raw.updatedAt) || Date.now()
  };

  const participantList = Array.isArray(raw && raw.participants) ? raw.participants : [];
  for (let i = 0; i < participantList.length; i += 1) {
    const p = participantList[i] || {};
    const token = String(p.token || "").trim();
    if (!token) continue;
    normalized.participants.set(token, {
      token,
      name: String(p.name || "Player").trim().slice(0, 32) || "Player",
      role: p.role === "gm" ? "gm" : "player",
      lastSeenAt: Number(p.lastSeenAt) || Date.now(),
      character: p && p.character && typeof p.character === "object"
        ? {
            name: String(p.character.name || p.name || "Wayfarer").slice(0, 48),
            health: Math.max(0, Number(p.character.health || 0)),
            maxHealth: Math.max(1, Number(p.character.maxHealth || p.character.maxStress || 1)),
            mentalStress: Math.max(0, Number((typeof p.character.mentalStress === "number" ? p.character.mentalStress : p.character.stress) || 0)),
            maxMentalStress: Math.max(1, Number(p.character.maxMentalStress || p.character.mentalStressCap || p.character.stressCap || 20)),
            stress: Math.max(0, Number((typeof p.character.mentalStress === "number" ? p.character.mentalStress : p.character.stress) || 0)),
            look: String(p.character.look || "").slice(0, 180),
            stats: p.character.stats && typeof p.character.stats === "object" ? p.character.stats : {},
            loadout: p.character.loadout && typeof p.character.loadout === "object" ? p.character.loadout : {},
            hacks: Array.isArray(p.character.hacks) ? p.character.hacks : [],
            backpack: Array.isArray(p.character.backpack)
              ? p.character.backpack.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
              : [],
            updatedAt: Number(p.character.updatedAt) || Date.now()
          }
        : null
    });
  }

  if (normalized.gmToken && !normalized.participants.has(normalized.gmToken)) {
    normalized.gmToken = "";
  }

  const notes = Array.isArray(raw && raw.privateNotes) ? raw.privateNotes : [];
  for (let i = 0; i < notes.length; i += 1) {
    const item = notes[i] || {};
    const token = String(item.token || "").trim();
    if (!token || !normalized.participants.has(token)) continue;
    normalized.privateNotes.set(token, {
      token,
      text: String(item.text || "").slice(0, 5000),
      updatedAt: Number(item.updatedAt) || Date.now()
    });
  }

  const roll = raw && raw.activeRollRequest;
  if (roll && typeof roll === "object" && roll.id) {
    const responses = Array.isArray(roll.responses) ? roll.responses : [];
    normalized.activeRollRequest = {
      id: String(roll.id),
      stat: String(roll.stat || "valor"),
      dread: Math.max(1, Number(roll.dread || 8)),
      label: String(roll.label || "GM Check").slice(0, 80),
      pendingCheckId: String(roll.pendingCheckId || "").trim(),
      targetToken: String(roll.targetToken || "").trim(),
      targetName: String(roll.targetName || "").trim().slice(0, 48),
      createdAt: Number(roll.createdAt) || Date.now(),
      responses: responses.map((resp) => ({
        token: String((resp && resp.token) || ""),
        name: String((resp && resp.name) || "Player"),
        role: resp && resp.role === "gm" ? "gm" : "player",
        total: Math.max(0, Number(resp && resp.total) || 0),
        dreadTotal: Math.max(0, Number(resp && resp.dreadTotal) || 0),
        die: Math.max(1, Number(resp && resp.die) || 4),
        success: !!(resp && resp.success),
        at: Number(resp && resp.at) || Date.now()
      }))
    };
  }

  return normalized;
}

function serializeCampaign(campaign) {
  return {
    code: campaign.code,
    shared: {
      tmw: Math.max(0, Number(campaign.shared.tmw || 0)),
      state: campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
        ? campaign.shared.state
        : {},
      stateVersion: Math.max(0, Number(campaign.shared && campaign.shared.stateVersion || 0) || 0)
    },
    participants: Array.from(campaign.participants.values()).map((p) => ({
      token: p.token,
      name: p.name,
      role: p.role,
      lastSeenAt: Number(p.lastSeenAt || Date.now()),
      character: p.character
        ? {
            name: String(p.character.name || p.name || "Wayfarer").slice(0, 48),
            health: Math.max(0, Number(p.character.health || 0)),
            maxHealth: Math.max(1, Number(p.character.maxHealth || p.character.maxStress || 1)),
            mentalStress: Math.max(0, Number((typeof p.character.mentalStress === "number" ? p.character.mentalStress : p.character.stress) || 0)),
            maxMentalStress: Math.max(1, Number(p.character.maxMentalStress || p.character.mentalStressCap || p.character.stressCap || 20)),
            stress: Math.max(0, Number((typeof p.character.mentalStress === "number" ? p.character.mentalStress : p.character.stress) || 0)),
            look: String(p.character.look || "").slice(0, 180),
            stats: p.character.stats && typeof p.character.stats === "object" ? p.character.stats : {},
            loadout: p.character.loadout && typeof p.character.loadout === "object" ? p.character.loadout : {},
            hacks: Array.isArray(p.character.hacks) ? p.character.hacks : [],
            backpack: Array.isArray(p.character.backpack)
              ? p.character.backpack.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
              : [],
            updatedAt: Number(p.character.updatedAt || Date.now())
          }
        : null
    })),
    gmToken: campaign.gmToken || "",
    archived: !!campaign.archived,
    passwordHash: campaign.passwordHash || "",
    passwordSalt: campaign.passwordSalt || "",
    privateNotes: Array.from(campaign.privateNotes.values()).map((note) => ({
      token: note.token,
      text: String(note.text || "").slice(0, 5000),
      updatedAt: Number(note.updatedAt || Date.now())
    })),
    activeRollRequest: campaign.activeRollRequest
      ? {
          id: campaign.activeRollRequest.id,
          stat: campaign.activeRollRequest.stat,
          dread: campaign.activeRollRequest.dread,
          label: campaign.activeRollRequest.label,
          pendingCheckId: String(campaign.activeRollRequest.pendingCheckId || ""),
          targetToken: String(campaign.activeRollRequest.targetToken || ""),
          targetName: String(campaign.activeRollRequest.targetName || ""),
          createdAt: campaign.activeRollRequest.createdAt,
          responses: Array.isArray(campaign.activeRollRequest.responses)
            ? campaign.activeRollRequest.responses
            : []
        }
      : null,
    log: Array.isArray(campaign.log) ? campaign.log.slice(-250) : [],
    updatedAt: Date.now()
  };
}

function makeCampaignStorePayload() {
  return {
    version: 1,
    savedAt: Date.now(),
    campaigns: Array.from(campaigns.values()).map(serializeCampaign)
  };
}

function writeCampaignSnapshotBackup(data, reason) {
  const payload = data || makeCampaignStorePayload();
  const serialized = JSON.stringify(payload, null, 2);
  const stamp = new Date(Number(payload.savedAt || Date.now())).toISOString().replace(/[:.]/g, "-");
  const safeReason = String(reason || "snapshot").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "snapshot";
  const snapshotPath = path.join(STORE_SNAPSHOT_DIR, `campaign-data-${stamp}-${safeReason}.json`);
  writeJsonAtomic(snapshotPath, serialized);
  campaignPersistenceHealth.lastSnapshotAt = Date.now();
  campaignPersistenceHealth.lastSnapshotPath = snapshotPath;
  campaignPersistenceHealth.snapshotCount += 1;
  pruneCampaignSnapshotBackups();
  return snapshotPath;
}

function persistCampaignsNow(options) {
  const opts = options || {};
  const startedAt = Date.now();
  const data = makeCampaignStorePayload();
  const serialized = JSON.stringify(data, null, 2);
  try {
    writeJsonAtomic(STORE_PATH, serialized, STORE_BACKUP_PATH);
    campaignPersistenceHealth.lastPersistAt = Date.now();
    campaignPersistenceHealth.lastPersistDurationMs = Date.now() - startedAt;
    campaignPersistenceHealth.lastPersistError = "";
    campaignPersistenceHealth.lastPersistPath = STORE_PATH;
    campaignPersistenceHealth.lastBackupAt = Date.now();
    campaignPersistenceHealth.persistCount += 1;
    if (opts.snapshot) {
      writeCampaignSnapshotBackup(data, opts.reason || "persist");
    }
    return data;
  } catch (err) {
    campaignPersistenceHealth.lastPersistDurationMs = Date.now() - startedAt;
    campaignPersistenceHealth.lastPersistError = err && err.message ? err.message : String(err);
    throw err;
  }
}

function schedulePersist() {
  persistQueued = true;
  if (!persistQueuedAt) persistQueuedAt = Date.now();
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!persistQueued) return;
    persistQueued = false;
    persistQueuedAt = 0;
    try {
      persistCampaignsNow();
    } catch (err) {
      console.warn("Could not persist campaigns:", err && err.message ? err.message : err);
    }
  }, CAMPAIGN_PERSIST_DEBOUNCE_MS);
}

function readCampaignStoreCandidate(filePath) {
  const candidatePath = path.resolve(filePath);
  if (!fs.existsSync(candidatePath)) {
    return { ok: false, path: candidatePath, error: "missing" };
  }
  const raw = fs.readFileSync(candidatePath, "utf8");
  if (!raw.trim()) {
    return { ok: false, path: candidatePath, error: "empty" };
  }
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed && parsed.campaigns) ? parsed.campaigns : null;
  if (!list) {
    return { ok: false, path: candidatePath, error: "missing campaigns array" };
  }
  const normalized = [];
  for (let i = 0; i < list.length; i += 1) {
    const shaped = ensureCampaignShape(list[i]);
    if (!shaped.code) continue;
    normalized.push(shaped);
  }
  return {
    ok: true,
    path: candidatePath,
    savedAt: Number(parsed && parsed.savedAt || 0),
    version: Number(parsed && parsed.version || 1),
    campaigns: normalized
  };
}

function loadCampaignsFromDisk() {
  campaignPersistenceHealth.lastIntegrityCheckAt = Date.now();
  try {
    const snapshotCandidates = listCampaignSnapshotFiles().map((entry) => entry.path);
    const candidates = [STORE_PATH, STORE_BACKUP_PATH].concat(snapshotCandidates);
    const seen = new Set();
    let loaded = null;
    const failures = [];

    for (let i = 0; i < candidates.length; i += 1) {
      const candidatePath = path.resolve(candidates[i]);
      if (seen.has(candidatePath)) continue;
      seen.add(candidatePath);
      try {
        const result = readCampaignStoreCandidate(candidatePath);
        if (result.ok) {
          loaded = result;
          break;
        }
        failures.push(`${candidatePath}: ${result.error}`);
      } catch (err) {
        failures.push(`${candidatePath}: ${err && err.message ? err.message : err}`);
      }
    }

    if (!loaded) {
      if (failures.length) {
        campaignPersistenceHealth.lastLoadError = failures.join(" | ").slice(0, 500);
      }
      return;
    }

    loaded.campaigns.forEach((campaign) => {
      campaigns.set(campaign.code, campaign);
    });
    campaignPersistenceHealth.lastLoadSource = loaded.path;
    campaignPersistenceHealth.lastLoadError = "";

    if (path.resolve(loaded.path) !== path.resolve(STORE_PATH)) {
      campaignPersistenceHealth.restoredFrom = loaded.path;
      try {
        persistCampaignsNow({ snapshot: true, reason: "auto-restore" });
        console.log(`Restored campaign store from ${loaded.path} to ${STORE_PATH}.`);
      } catch (err) {
        campaignPersistenceHealth.lastLoadError = `restore failed: ${err && err.message ? err.message : err}`;
        console.warn("Could not restore campaign primary store:", err && err.message ? err.message : err);
      }
    }

    if (campaigns.size > 0) {
      console.log(`Loaded ${campaigns.size} persisted campaign(s).`);
    }
  } catch (err) {
    campaignPersistenceHealth.lastLoadError = err && err.message ? err.message : String(err);
    console.warn("Could not load persisted campaigns:", err && err.message ? err.message : err);
  }
}

function persistCampaignSnapshotBackup(reason) {
  if (!campaigns.size) return null;
  try {
    return writeCampaignSnapshotBackup(makeCampaignStorePayload(), reason || "periodic");
  } catch (err) {
    campaignPersistenceHealth.lastPersistError = `snapshot failed: ${err && err.message ? err.message : err}`;
    console.warn("Could not write campaign snapshot backup:", err && err.message ? err.message : err);
    return null;
  }
}

function startCampaignBackupTimer() {
  if (campaignBackupTimer) return;
  campaignBackupTimer = setInterval(() => {
    persistCampaignSnapshotBackup("periodic");
  }, CAMPAIGN_BACKUP_INTERVAL_MS);
  if (typeof campaignBackupTimer.unref === "function") campaignBackupTimer.unref();
}

function getOnlineTokenSet(campaign) {
  const tokens = new Set();
  campaign.sessions.forEach((token) => {
    if (token) tokens.add(token);
  });
  return tokens;
}

function snapshotCampaign(campaign, requesterToken) {
  const onlineTokens = getOnlineTokenSet(campaign);
  const roster = Array.from(campaign.participants.values())
    .map((member) => ({
      token: member.token,
      name: member.name,
      role: member.role,
      online: onlineTokens.has(member.token),
      lastSeenAt: Number(member.lastSeenAt || Date.now()),
      character: member.character
        ? {
            name: String(member.character.name || member.name || "Wayfarer").slice(0, 48),
            health: Math.max(0, Number(member.character.health || 0)),
            maxHealth: Math.max(1, Number(member.character.maxHealth || member.character.maxStress || 1)),
            mentalStress: Math.max(0, Number((typeof member.character.mentalStress === "number" ? member.character.mentalStress : member.character.stress) || 0)),
            maxMentalStress: Math.max(1, Number(member.character.maxMentalStress || member.character.mentalStressCap || member.character.stressCap || 20)),
            stress: Math.max(0, Number((typeof member.character.mentalStress === "number" ? member.character.mentalStress : member.character.stress) || 0)),
            look: String(member.character.look || "").slice(0, 180),
            stats: member.character.stats && typeof member.character.stats === "object" ? member.character.stats : {},
            loadout: member.character.loadout && typeof member.character.loadout === "object" ? member.character.loadout : {},
            hacks: Array.isArray(member.character.hacks) ? member.character.hacks : [],
            backpack: Array.isArray(member.character.backpack)
              ? member.character.backpack.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
              : [],
            updatedAt: Number(member.character.updatedAt || 0)
          }
        : null
    }))
    .sort((a, b) => {
      if (a.role === "gm" && b.role !== "gm") return -1;
      if (a.role !== "gm" && b.role === "gm") return 1;
      return a.name.localeCompare(b.name);
    });

  const requesterRole = requesterToken && campaign.gmToken && requesterToken === campaign.gmToken ? "gm" : "player";
  const requesterNote = requesterToken && campaign.privateNotes.has(requesterToken)
    ? campaign.privateNotes.get(requesterToken)
    : null;
  const notesSummary = requesterRole === "gm"
    ? Array.from(campaign.participants.values()).map((p) => {
        const note = campaign.privateNotes.get(p.token);
        return {
          token: p.token,
          name: p.name,
          updatedAt: note ? Number(note.updatedAt || 0) : 0,
          hasNote: !!(note && String(note.text || "").trim()),
          preview: note ? String(note.text || "").slice(0, 120) : ""
        };
      })
    : [];

  function canViewerSeeLogEntry(entry) {
    if (!entry || !entry.meta || typeof entry.meta !== "object") return true;
    const visibility = String(entry.meta.visibility || "public");
    if (visibility === "public") return true;

    const viewer = String(requesterToken || "");
    const source = String(entry.meta.token || "");
    const isGm = !!(viewer && campaign.gmToken && viewer === campaign.gmToken);

    if (isGm) return true;
    if (source && viewer && source === viewer) return true;
    if (visibility === "targeted") {
      const target = String(entry.meta.targetToken || "");
      return !!(viewer && target && viewer === target);
    }
    if (visibility === "gm") return false;
    return true;
  }

  const visibleLog = campaign.log.filter((entry) => canViewerSeeLogEntry(entry));

  return {
    code: campaign.code,
    archived: !!campaign.archived,
    hasPassword: !!(campaign.passwordHash && campaign.passwordSalt),
    shared: {
      tmw: Number(campaign.shared.tmw || 0),
      state: campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
        ? campaign.shared.state
        : {},
      stateVersion: Math.max(0, Number(campaign.shared && campaign.shared.stateVersion || 0) || 0),
      updatedAt: Number(campaign.updatedAt || Date.now())
    },
    members: roster.filter((m) => m.online).map((m) => ({
      name: m.name,
      role: m.role,
      token: m.token
    })),
    roster,
    me: requesterToken
      ? {
          token: requesterToken,
          role: requesterRole,
          privateNote: requesterNote ? String(requesterNote.text || "") : ""
        }
      : null,
    notesSummary,
    activeRollRequest: campaign.activeRollRequest
      ? {
          id: campaign.activeRollRequest.id,
          stat: campaign.activeRollRequest.stat,
          dread: campaign.activeRollRequest.dread,
          label: campaign.activeRollRequest.label,
          pendingCheckId: String(campaign.activeRollRequest.pendingCheckId || ""),
          targetToken: String(campaign.activeRollRequest.targetToken || ""),
          targetName: String(campaign.activeRollRequest.targetName || ""),
          createdAt: campaign.activeRollRequest.createdAt,
          responses: Array.isArray(campaign.activeRollRequest.responses)
            ? campaign.activeRollRequest.responses
            : []
        }
      : null,
    log: visibleLog.slice(-80)
  };
}

function flushCampaignState(code) {
  const campaign = campaigns.get(code);
  if (!campaign) return;
  if (campaign.snapshotEmitTimer) {
    clearTimeout(campaign.snapshotEmitTimer);
    campaign.snapshotEmitTimer = null;
  }
  campaign.lastSnapshotEmitAt = Date.now();
  campaign.sessions.forEach((token, socketId) => {
    io.to(socketId).emit("campaign:state", snapshotCampaign(campaign, token));
  });
}

function emitCampaignState(code, opts) {
  const campaign = campaigns.get(code);
  if (!campaign) return;
  const options = opts || {};
  if (options.immediate) {
    flushCampaignState(code);
    return;
  }
  campaign.snapshotQueuedAt = Date.now();
  if (campaign.snapshotEmitTimer) return;
  const elapsed = campaign.lastSnapshotEmitAt
    ? Date.now() - Number(campaign.lastSnapshotEmitAt || 0)
    : CAMPAIGN_SNAPSHOT_MIN_INTERVAL_MS;
  const wait = Math.max(0, CAMPAIGN_SNAPSHOT_MIN_INTERVAL_MS - elapsed);
  campaign.snapshotEmitTimer = setTimeout(() => {
    flushCampaignState(code);
  }, wait);
}

function getOutboundSnapshotQueueHealth() {
  let queuedCampaigns = 0;
  let maxLagMs = 0;
  campaigns.forEach((campaign) => {
    if (!campaign || !campaign.snapshotEmitTimer) return;
    queuedCampaigns += 1;
    const queuedAt = Number(campaign.snapshotQueuedAt || 0);
    if (queuedAt) maxLagMs = Math.max(maxLagMs, Date.now() - queuedAt);
  });
  return { queuedCampaigns, maxLagMs };
}

function getCampaignServerHealth() {
  const outbound = getOutboundSnapshotQueueHealth();
  const persistQueueLagMs = persistQueued && persistQueuedAt ? Math.max(0, Date.now() - persistQueuedAt) : 0;
  return {
    ok: !campaignPersistenceHealth.lastPersistError,
    nodeEnv: NODE_ENV,
    uptimeSec: Math.round(process.uptime()),
    campaigns: {
      count: campaigns.size,
      activeSessions: Array.from(campaigns.values()).reduce((sum, campaign) => sum + (campaign && campaign.sessions ? campaign.sessions.size : 0), 0)
    },
    persistence: {
      storePath: STORE_PATH,
      backupPath: STORE_BACKUP_PATH,
      snapshotDir: STORE_SNAPSHOT_DIR,
      lastPersistAt: campaignPersistenceHealth.lastPersistAt,
      lastPersistIso: safeIsoTime(campaignPersistenceHealth.lastPersistAt),
      lastPersistDurationMs: campaignPersistenceHealth.lastPersistDurationMs,
      lastPersistError: campaignPersistenceHealth.lastPersistError,
      lastBackupAt: campaignPersistenceHealth.lastBackupAt,
      lastBackupIso: safeIsoTime(campaignPersistenceHealth.lastBackupAt),
      lastSnapshotAt: campaignPersistenceHealth.lastSnapshotAt,
      lastSnapshotIso: safeIsoTime(campaignPersistenceHealth.lastSnapshotAt),
      lastSnapshotPath: campaignPersistenceHealth.lastSnapshotPath,
      lastLoadSource: campaignPersistenceHealth.lastLoadSource,
      lastLoadError: campaignPersistenceHealth.lastLoadError,
      lastIntegrityCheckAt: campaignPersistenceHealth.lastIntegrityCheckAt,
      lastIntegrityCheckIso: safeIsoTime(campaignPersistenceHealth.lastIntegrityCheckAt),
      restoredFrom: campaignPersistenceHealth.restoredFrom,
      persistCount: campaignPersistenceHealth.persistCount,
      snapshotCount: campaignPersistenceHealth.snapshotCount,
      persistQueued: !!persistQueued,
      persistQueueLagMs
    },
    outboundSnapshots: {
      queuedCampaigns: outbound.queuedCampaigns,
      queueLagMs: outbound.maxLagMs,
      minIntervalMs: CAMPAIGN_SNAPSHOT_MIN_INTERVAL_MS
    },
    checkedAt: Date.now()
  };
}

function emitCampaignNotice(campaign, notice) {
  if (!campaign || !notice) return;
  campaign.sessions.forEach((token, socketId) => {
    if (notice.meta && typeof notice.meta === "object") {
      const visibility = String(notice.meta.visibility || "public");
      const viewer = String(token || "");
      const source = String(notice.meta.token || "");
      const target = String(notice.meta.targetToken || "");
      const isGm = !!(campaign.gmToken && viewer && viewer === campaign.gmToken);
      if (visibility === "gm" && !isGm && viewer !== source) return;
      if (visibility === "targeted" && !isGm && viewer !== source && viewer !== target) return;
    }
    io.to(socketId).emit("campaign:notice", notice);
  });
}

function addLog(campaign, kind, text, meta) {
  const entry = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    kind,
    text,
    meta: meta || null,
    at: Date.now()
  };
  campaign.log.push(entry);
  if (campaign.log.length > 250) {
    campaign.log = campaign.log.slice(-250);
  }
  campaign.updatedAt = Date.now();
  emitCampaignNotice(campaign, {
    id: entry.id,
    kind: entry.kind,
    text: entry.text,
    at: entry.at,
    sourceToken: entry.meta && entry.meta.token ? String(entry.meta.token) : "",
    meta: entry.meta || null
  });
  schedulePersist();
}

function getCampaignBySocket(socket) {
  const code = socket.data && socket.data.campaignCode;
  if (!code) return null;
  return campaigns.get(code) || null;
}

function setParticipantRole(campaign, token, nextRole) {
  const member = campaign.participants.get(token);
  if (!member) return;

  if (nextRole === "gm") {
    campaign.gmToken = token;
    member.role = "gm";
  } else {
    if (campaign.gmToken && campaign.gmToken === token) {
      member.role = "gm";
    } else {
      member.role = "player";
    }
  }
}

function chooseFallbackGm(campaign) {
  if (campaign.gmToken && campaign.participants.has(campaign.gmToken)) {
    return;
  }
  const first = Array.from(campaign.participants.values())[0];
  if (!first) {
    campaign.gmToken = "";
    return;
  }
  campaign.gmToken = first.token;
  first.role = "gm";
}

function normalizeName(input, fallback) {
  return String(input || fallback || "Player").trim().slice(0, 32) || String(fallback || "Player");
}

function normalizeCharacter(input, fallbackName) {
  const c = input && typeof input === "object" ? input : {};
  const stats = c.stats && typeof c.stats === "object" ? c.stats : {};
  const mentalStress = Math.max(0, Number((typeof c.mentalStress === "number" ? c.mentalStress : c.stress) || 0));
  const maxHealthFromStats = Math.max(1, Number((stats.defend || stats.body || stats.valor || 4)) * 2);
  const maxHealth = Math.max(1, Number(c.maxHealth || c.maxStress || maxHealthFromStats));
  const maxMentalStress = Math.max(1, Number(c.maxMentalStress || c.mentalStressCap || c.stressCap || 20));
  const loadoutInput = c.loadout && typeof c.loadout === "object" ? c.loadout : {};
  const loadout = {
    weapon1: String(loadoutInput.weapon1 || c.weapon1 || "").trim().slice(0, 120),
    weapon2: String(loadoutInput.weapon2 || c.weapon2 || "").trim().slice(0, 120),
    armor: String(loadoutInput.armor || c.armor || "").trim().slice(0, 120),
    readied: String(loadoutInput.readied || c.readied || "").trim().slice(0, 120)
  };
  const hacksInput = Array.isArray(c.hacks) ? c.hacks : (Array.isArray(c.ownedHacks) ? c.ownedHacks : []);
  const hacks = hacksInput.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 40);
  return {
    name: String(c.name || fallbackName || "Wayfarer").slice(0, 48),
    health: Math.max(0, Number(c.health || 0)),
    maxHealth,
    mentalStress,
    maxMentalStress,
    stress: mentalStress,
    look: String(c.look || "").slice(0, 180),
    stats,
    loadout,
    hacks,
    backpack: Array.isArray(c.backpack)
      ? c.backpack.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
      : [],
    updatedAt: Date.now()
  };
}

function resolveOrCreateParticipant(campaign, name, requestedRole, tokenHint) {
  const normalizedName = normalizeName(name, requestedRole === "gm" ? "GM" : "Player");
  const desiredRole = requestedRole === "gm" ? "gm" : "player";

  if (tokenHint) {
    const byToken = campaign.participants.get(tokenHint);
    if (byToken) {
      // Prevent accidental role takeover when a stale GM token is reused while joining as Player.
      if (desiredRole === "player" && byToken.role === "gm") {
        // Fall through and resolve by name/new participant instead of restoring GM token.
      } else {
      byToken.name = normalizedName;
      if (desiredRole === "gm") {
        if (campaign.gmToken && campaign.gmToken !== tokenHint) {
          return { error: "This campaign already has a GM." };
        }
        setParticipantRole(campaign, tokenHint, "gm");
      }
      if (!byToken.character) {
        byToken.character = normalizeCharacter(null, byToken.name);
      }
      byToken.lastSeenAt = Date.now();
      return { token: tokenHint, participant: byToken, restored: true };
      }
    }
  }

  const sameName = Array.from(campaign.participants.values()).filter((p) => p.name.toLowerCase() === normalizedName.toLowerCase());
  if (!tokenHint && sameName.length === 1) {
    const only = sameName[0];
    if (only.role === desiredRole) {
      if (desiredRole === "gm" && campaign.gmToken && campaign.gmToken !== only.token) {
        return { error: "This campaign already has a GM." };
      }
      only.lastSeenAt = Date.now();
      if (desiredRole === "gm") setParticipantRole(campaign, only.token, "gm");
      if (!only.character) {
        only.character = normalizeCharacter(null, only.name);
      }
      return { token: only.token, participant: only, restored: true };
    }
  }

  if (desiredRole === "gm" && campaign.gmToken) {
    return { error: "This campaign already has a GM." };
  }

  const token = createParticipantToken(campaign);
  const participant = {
    token,
    name: normalizedName,
    role: desiredRole,
    lastSeenAt: Date.now(),
    character: normalizeCharacter(null, normalizedName)
  };

  campaign.participants.set(token, participant);
  if (desiredRole === "gm") {
    campaign.gmToken = token;
  }
  campaign.updatedAt = Date.now();
  schedulePersist();
  return { token, participant, restored: false };
}

function isGm(campaign, token) {
  return !!(token && campaign.gmToken && token === campaign.gmToken);
}

function requireGmAction(campaign, token, eventName, ack) {
  if (!GM_ONLY_EVENTS[eventName]) return true;
  if (isGm(campaign, token)) return true;
  if (typeof ack === "function") ack({ ok: false, error: "Only GM can perform this action." });
  return false;
}

function makeCampaignExportSnapshot(campaign) {
  return {
    version: 1,
    code: campaign.code,
    exportedAt: Date.now(),
    archived: !!campaign.archived,
    shared: {
      tmw: Math.max(0, Number(campaign.shared && campaign.shared.tmw || 0)),
      stateVersion: Math.max(0, Number(campaign.shared && campaign.shared.stateVersion || 0)),
      state: campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
        ? campaign.shared.state
        : {}
    },
    participants: Array.from(campaign.participants.values()).map((p) => ({
      token: p.token,
      name: p.name,
      role: p.role,
      lastSeenAt: Number(p.lastSeenAt || Date.now()),
      character: p.character && typeof p.character === "object" ? p.character : null
    })),
    privateNotes: Array.from(campaign.privateNotes.values()).map((n) => ({
      token: n.token,
      text: String(n.text || "").slice(0, 5000),
      updatedAt: Number(n.updatedAt || Date.now())
    })),
    activeRollRequest: campaign.activeRollRequest && typeof campaign.activeRollRequest === "object"
      ? campaign.activeRollRequest
      : null,
    log: Array.isArray(campaign.log) ? campaign.log.slice(-250) : []
  };
}

function applyCampaignImportSnapshot(campaign, rawSnapshot) {
  const snap = rawSnapshot && typeof rawSnapshot === "object" ? rawSnapshot : null;
  if (!snap) return { ok: false, error: "Invalid snapshot payload." };
  const shared = snap.shared && typeof snap.shared === "object" ? snap.shared : null;
  if (!shared || !shared.state || typeof shared.state !== "object") {
    return { ok: false, error: "Snapshot missing shared.state object." };
  }

  campaign.shared.tmw = Math.max(0, Number(shared.tmw || 0));
  campaign.shared.state = shared.state;
  campaign.shared.stateVersion = Math.max(0, Number(shared.stateVersion || campaign.shared.stateVersion || 0)) + 1;

  const nextParticipants = new Map();
  const participantList = Array.isArray(snap.participants) ? snap.participants : [];
  for (let i = 0; i < participantList.length; i += 1) {
    const p = participantList[i] || {};
    const token = String(p.token || "").trim();
    if (!token) continue;
    nextParticipants.set(token, {
      token,
      name: normalizeName(p.name, "Player"),
      role: p.role === "gm" ? "gm" : "player",
      lastSeenAt: Number(p.lastSeenAt || Date.now()),
      character: normalizeCharacter(p.character, p.name || "Wayfarer")
    });
  }
  if (!nextParticipants.size) {
    return { ok: false, error: "Snapshot contains no participants." };
  }

  campaign.participants = nextParticipants;
  campaign.gmToken = "";
  nextParticipants.forEach((p) => {
    if (p.role === "gm" && !campaign.gmToken) {
      campaign.gmToken = p.token;
    }
  });
  chooseFallbackGm(campaign);

  const nextNotes = new Map();
  const notes = Array.isArray(snap.privateNotes) ? snap.privateNotes : [];
  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i] || {};
    const token = String(n.token || "").trim();
    if (!token || !campaign.participants.has(token)) continue;
    nextNotes.set(token, {
      token,
      text: String(n.text || "").slice(0, 5000),
      updatedAt: Number(n.updatedAt || Date.now())
    });
  }
  campaign.privateNotes = nextNotes;

  const roll = snap.activeRollRequest && typeof snap.activeRollRequest === "object"
    ? snap.activeRollRequest
    : null;
  campaign.activeRollRequest = roll
    ? {
        id: String(roll.id || `${Date.now()}-import`),
        stat: String(roll.stat || "valor"),
        dread: Math.max(1, Number(roll.dread || 8)),
        label: String(roll.label || "GM Check").slice(0, 80),
        pendingCheckId: String(roll.pendingCheckId || "").trim(),
        targetToken: String(roll.targetToken || "").trim(),
        targetName: String(roll.targetName || "").trim().slice(0, 48),
        createdAt: Number(roll.createdAt || Date.now()),
        responses: Array.isArray(roll.responses) ? roll.responses : []
      }
    : null;

  campaign.log = Array.isArray(snap.log) ? snap.log.slice(-250) : [];
  campaign.archived = !!snap.archived;
  campaign.updatedAt = Date.now();
  schedulePersist();

  return { ok: true };
}

function canJoinArchivedCampaign(campaign, tokenHint) {
  if (!campaign.archived) return true;
  const token = String(tokenHint || "").trim();
  if (!token) return false;
  if (!campaign.participants.has(token)) return false;
  return true;
}

function attachSocketToCampaign(socket, campaign, token) {
  socket.join(campaign.code);
  socket.data.campaignCode = campaign.code;
  socket.data.token = token;
  socket.data.role = campaign.gmToken && campaign.gmToken === token ? "gm" : "player";
  campaign.sessions.set(socket.id, token);
}

function detachSocket(socket, opts) {
  const options = opts || {};
  const campaign = getCampaignBySocket(socket);
  if (!campaign) return;

  const token = socket.data.token || campaign.sessions.get(socket.id);
  const participant = token ? campaign.participants.get(token) : null;

  campaign.sessions.delete(socket.id);
  socket.leave(campaign.code);
  socket.data.campaignCode = "";
  socket.data.role = "";
  socket.data.token = "";

  if (participant) {
    participant.lastSeenAt = Date.now();
    if (!options.silent) {
      addLog(campaign, "system", `${participant.name} left the campaign.`);
    } else {
      schedulePersist();
    }
  }

  emitCampaignState(campaign.code);
}

app.get("/access", (_req, res) => {
  res.sendFile(ACCESS_PAGE_PATH);
});

app.get("/admin/licenses", (_req, res) => {
  res.sendFile(LICENSE_ADMIN_PAGE_PATH);
});

app.get("/api/license/status", (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.json({ ok: true, authorized: false });
    return;
  }
  res.json({ ok: true, authorized: true, session: safeSessionForResponse(session) });
});

app.get("/api/license/admin/config", (_req, res) => {
  res.json({
    ok: true,
    adminKeyConfigured: !!PAYWALL_ADMIN_KEY,
    adminEmail: PAYWALL_ADMIN_EMAIL,
    adminPath: "/admin/licenses"
  });
});

app.post("/api/license/logout", (req, res) => {
  clearSessionByRequest(req);
  res.setHeader("Set-Cookie", makeCookie(PAYWALL_SESSION_COOKIE, "", {
    path: "/",
    maxAgeSeconds: 0,
    httpOnly: true,
    sameSite: "Lax",
    secure: !!req.secure
  }));
  res.json({ ok: true });
});

app.post("/api/license/issue", (req, res) => {
  const adminCheck = validateAdminKey(req);
  if (!adminCheck.ok) {
    res.status(adminCheck.status).json({ ok: false, error: adminCheck.error });
    return;
  }

  const email = normalizeEmail(req.body && req.body.email);
  const quantity = Number(req.body && req.body.quantity);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "A valid buyer email is required." });
    return;
  }
  if (quantity !== 1 && quantity !== 4) {
    res.status(400).json({ ok: false, error: "Quantity must be 1 or 4." });
    return;
  }

  const pricePerPack = quantity === 4 ? PRICE_BUNDLE4_CENTS : PRICE_SINGLE_CENTS;
  const issued = [];
  const now = Date.now();
  try {
    for (let i = 0; i < quantity; i += 1) {
      const code = createLicenseCode();
      licenseStore.licenses[code] = {
        code,
        email,
        issuedAt: now,
        priceCents: pricePerPack,
        bundleSize: quantity,
        redeemedByEmail: "",
        redeemedAt: 0,
        disabled: false
      };
      issued.push(code);
    }
    licenseStore.updatedAt = now;
    persistLicenseStoreSafe();
  } catch (err) {
    res.status(500).json({ ok: false, error: "Could not issue license codes." });
    return;
  }

  res.json({
    ok: true,
    email,
    quantity,
    totalPriceCents: pricePerPack,
    totalPriceUsd: (pricePerPack / 100).toFixed(2),
    codes: issued
  });
});

app.post("/api/license/admin/list", (req, res) => {
  const adminCheck = validateAdminKey(req);
  if (!adminCheck.ok) {
    res.status(adminCheck.status).json({ ok: false, error: adminCheck.error });
    return;
  }

  const email = normalizeEmail(req.body && req.body.email);
  const code = normalizeLicenseCode(req.body && req.body.code);
  const includeDisabled = !!(req.body && req.body.includeDisabled);
  const licenses = getSortedLicenses()
    .filter((item) => {
      if (!includeDisabled && item.disabled) return false;
      if (email && item.email !== email && item.redeemedByEmail !== email) return false;
      if (code && item.code !== code) return false;
      return true;
    })
    .slice(0, 300);

  res.json({ ok: true, count: licenses.length, licenses });
});

app.post("/api/license/admin/revoke", (req, res) => {
  const adminCheck = validateAdminKey(req);
  if (!adminCheck.ok) {
    res.status(adminCheck.status).json({ ok: false, error: adminCheck.error });
    return;
  }

  const code = normalizeLicenseCode(req.body && req.body.code);
  const disabled = typeof (req.body && req.body.disabled) === "boolean" ? !!req.body.disabled : true;
  if (!code) {
    res.status(400).json({ ok: false, error: "License code is required." });
    return;
  }
  const license = licenseStore.licenses[code];
  if (!license || typeof license !== "object") {
    res.status(404).json({ ok: false, error: "License code was not found." });
    return;
  }

  license.disabled = disabled;
  licenseStore.updatedAt = Date.now();
  persistLicenseStoreSafe();

  res.json({
    ok: true,
    license: {
      code,
      email: normalizeEmail(license.email),
      redeemedByEmail: normalizeEmail(license.redeemedByEmail),
      disabled: !!license.disabled,
      issuedAt: Number(license.issuedAt || 0),
      redeemedAt: Number(license.redeemedAt || 0)
    }
  });
});

app.post("/api/license/admin/storage", (req, res) => {
  const adminCheck = validateAdminKey(req);
  if (!adminCheck.ok) {
    res.status(adminCheck.status).json({ ok: false, error: adminCheck.error });
    return;
  }

  const resolvedActivePath = path.resolve(LICENSE_STORE_PATH);
  const resolvedLegacyPath = path.resolve(LEGACY_LICENSE_STORE_PATH);
  const activeExists = fs.existsSync(resolvedActivePath);
  const legacyExists = resolvedLegacyPath !== resolvedActivePath ? fs.existsSync(resolvedLegacyPath) : false;

  res.json({
    ok: true,
    activePath: resolvedActivePath,
    activeExists,
    usingLegacyPath: resolvedActivePath === resolvedLegacyPath,
    legacyPath: resolvedLegacyPath,
    legacyExists
  });
});

app.post("/api/license/admin/test", (req, res) => {
  const adminCheck = validateAdminKey(req);
  if (!adminCheck.ok) {
    res.status(adminCheck.status).json({ ok: false, error: adminCheck.error });
    return;
  }
  res.json({
    ok: true,
    canIssueCodes: true,
    adminEmail: PAYWALL_ADMIN_EMAIL
  });
});

app.get("/api/health", (_req, res) => {
  res.json(getCampaignServerHealth());
});

app.get("/healthz", (_req, res) => {
  res.json(getCampaignServerHealth());
});

app.post("/api/license/login", (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const submittedCode = normalizeLicenseCode(req.body && req.body.code);
  if (!email || !submittedCode) {
    res.status(400).json({ ok: false, error: "Email and access code are required." });
    return;
  }

  const now = Date.now();
  const isGod = isGodKey(submittedCode);
  const normalizedAdminCode = normalizeLicenseCode(PAYWALL_ADMIN_KEY);
  const isAdminCode = !!(normalizedAdminCode && submittedCode === normalizedAdminCode);
  const isAdminEmail = !!(PAYWALL_ADMIN_EMAIL && email === PAYWALL_ADMIN_EMAIL);
  const isAdminLogin = isAdminCode && isAdminEmail;

  if (isAdminCode && !isAdminEmail) {
    res.status(403).json({ ok: false, error: "Admin key must be used with the configured admin email." });
    return;
  }

  if (!isGod && !isAdminLogin) {
    const license = licenseStore.licenses[submittedCode];
    if (!license || typeof license !== "object") {
      res.status(403).json({ ok: false, error: "That access code is not recognized." });
      return;
    }
    if (license.disabled) {
      res.status(403).json({ ok: false, error: "That access code has been disabled." });
      return;
    }
    if (normalizeEmail(license.email) !== email) {
      res.status(403).json({ ok: false, error: "This code does not belong to that email." });
      return;
    }
    const redeemedByEmail = normalizeEmail(license.redeemedByEmail);
    if (redeemedByEmail && redeemedByEmail !== email) {
      res.status(403).json({ ok: false, error: "This code has already been redeemed by a different email." });
      return;
    }
    if (!redeemedByEmail) {
      license.redeemedByEmail = email;
      license.redeemedAt = now;
      licenseStore.updatedAt = now;
      persistLicenseStoreSafe();
    }
  }

  let session;
  try {
    session = createAccessSession(email, submittedCode, {
      isGod,
      isAdmin: isAdminLogin
    });
  } catch (_err) {
    res.status(500).json({ ok: false, error: "Could not create access session." });
    return;
  }

  res.setHeader("Set-Cookie", makeCookie(PAYWALL_SESSION_COOKIE, session.token, {
    path: "/",
    maxAgeSeconds: Math.floor(PAYWALL_SESSION_TTL_MS / 1000),
    httpOnly: true,
    sameSite: "Lax",
    secure: !!req.secure
  }));
  res.json({ ok: true, authorized: true, session: safeSessionForResponse(session) });
});

app.use(requirePaywallAccess);

function isAllowedAudioProxyHost(hostname) {
  const host = String(hostname || "").toLowerCase().trim();
  if (!host) return false;
  if (AUDIO_PROXY_ALLOWED_HOSTS.has(host)) return true;
  if (host.endsWith(".incompetech.com")) return true;
  if (host.endsWith(".opengameart.org")) return true;
  if (host.endsWith(".freesound.org")) return true;
  if (host.endsWith(".archive.org")) return true;
  return false;
}

function hasSupportedAudioExtension(pathname) {
  const pathOnly = String(pathname || "").toLowerCase();
  return pathOnly.endsWith(".mp3") || pathOnly.endsWith(".ogg") || pathOnly.endsWith(".wav");
}

// Converts Google Drive shareable/open links to a direct download URL.
// Supports: /open?id=ID, /file/d/ID/view, /uc?id=ID
function normalizeGoogleDriveUrl(url) {
  const host = url.hostname.toLowerCase();
  if (host !== "drive.google.com") return url;
  let fileId = null;
  // /file/d/FILE_ID/... format
  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) fileId = fileMatch[1];
  // /open?id=FILE_ID or /uc?id=FILE_ID
  if (!fileId) fileId = url.searchParams.get("id");
  if (!fileId) return url; // can't resolve, pass through
  const direct = new URL("https://drive.google.com/uc");
  direct.searchParams.set("export", "download");
  direct.searchParams.set("id", fileId);
  return direct;
}

app.get("/api/audio-proxy", async (req, res) => {
  const src = String((req.query && req.query.src) || "").trim();
  if (!src) {
    res.status(400).json({ ok: false, error: "Missing src query parameter." });
    return;
  }

  let target;
  try {
    target = new URL(src);
  } catch (_err) {
    res.status(400).json({ ok: false, error: "Invalid src URL." });
    return;
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    res.status(400).json({ ok: false, error: "Only http/https URLs are allowed." });
    return;
  }

  if (!isAllowedAudioProxyHost(target.hostname)) {
    res.status(403).json({ ok: false, error: "Source host is not allowlisted." });
    return;
  }

  // Normalize Google Drive shareable links to direct download URL
  target = normalizeGoogleDriveUrl(target);

  const isGoogleDrive = target.hostname === "drive.google.com";
  const isArchiveOrg = target.hostname === "archive.org" || target.hostname.endsWith(".archive.org");
  if (!isGoogleDrive && !isArchiveOrg && !hasSupportedAudioExtension(target.pathname)) {
    res.status(400).json({ ok: false, error: "Only .mp3, .ogg, and .wav files are allowed." });
    return;
  }

  try {
    const upstream = await fetch(target.toString(), { redirect: "follow" });
    if (!upstream.ok) {
      res.status(upstream.status).json({ ok: false, error: "Upstream audio fetch failed." });
      return;
    }

    const contentType = String(upstream.headers.get("content-type") || "application/octet-stream");
    const audioType = contentType.startsWith("audio/") ? contentType : "audio/mpeg";
    const cacheControl = String(upstream.headers.get("cache-control") || "public, max-age=86400");
    const body = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", audioType);
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("Accept-Ranges", "bytes");
    res.send(body);
  } catch (_err) {
    res.status(502).json({ ok: false, error: "Audio proxy request failed." });
  }
});

app.use(express.static(path.join(__dirname)));

loadLicenseStoreFromDisk();
loadCampaignsFromDisk();
startCampaignBackupTimer();

io.on("connection", (socket) => {
  socket.on("campaign:create", (payload, ack) => {
    try {
      const name = normalizeName(payload && payload.name, "GM");
      const code = createCampaignCode();
      const campaign = {
        code,
        shared: { tmw: 0, state: {}, stateVersion: 0 },
        participants: new Map(),
        sessions: new Map(),
        gmToken: "",
        archived: false,
        passwordHash: "",
        passwordSalt: "",
        privateNotes: new Map(),
        activeRollRequest: null,
        log: [],
        updatedAt: Date.now()
      };

      const passwordPack = createPasswordPack(payload && payload.password);
      if (passwordPack) {
        campaign.passwordSalt = passwordPack.salt;
        campaign.passwordHash = passwordPack.hash;
      }

      const token = createParticipantToken(campaign);
      campaign.participants.set(token, {
        token,
        name,
        role: "gm",
        lastSeenAt: Date.now(),
        character: normalizeCharacter(payload && payload.character, name)
      });
      campaign.gmToken = token;
      campaigns.set(code, campaign);

      attachSocketToCampaign(socket, campaign, token);
      addLog(campaign, "system", `${name} created the campaign.`);

      emitCampaignState(code);
      if (typeof ack === "function") {
        ack({
          ok: true,
          code,
          role: "gm",
          token,
          name,
          hasPassword: !!passwordPack
        });
      }
    } catch (_err) {
      if (typeof ack === "function") ack({ ok: false, error: "Could not create campaign." });
    }
  });

  socket.on("campaign:join", (payload, ack) => {
    const code = String((payload && payload.code) || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const role = (payload && payload.role) === "gm" ? "gm" : "player";
    const name = normalizeName(payload && payload.name, role === "gm" ? "GM" : "Player");
    const tokenHint = String((payload && payload.token) || "").trim();
    const passwordInput = String((payload && payload.password) || "");
    const campaign = campaigns.get(code);

    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Campaign code not found." });
      return;
    }

    if (!canJoinArchivedCampaign(campaign, tokenHint)) {
      if (typeof ack === "function") ack({ ok: false, error: "Campaign is archived. Ask GM to reopen it." });
      return;
    }

    const hasValidToken = !!(tokenHint && campaign.participants.has(tokenHint));
    if (!hasValidToken && !verifyPassword(campaign, passwordInput)) {
      if (typeof ack === "function") ack({ ok: false, error: "Incorrect campaign password." });
      return;
    }

    detachSocket(socket, { silent: true });

    const resolved = resolveOrCreateParticipant(campaign, name, role, tokenHint || "");
    if (resolved.error) {
      if (typeof ack === "function") ack({ ok: false, error: resolved.error });
      return;
    }

    const token = resolved.token;
    const participant = resolved.participant;
    attachSocketToCampaign(socket, campaign, token);

    addLog(
      campaign,
      "system",
      `${participant.name} ${resolved.restored ? "reconnected" : "joined"} as ${participant.role === "gm" ? "GM" : "Player"}.`
    );

    emitCampaignState(code);
    if (typeof ack === "function") {
      ack({
        ok: true,
        code,
        role: participant.role,
        token,
        name: participant.name,
        restored: !!resolved.restored
      });
    }
  });

  socket.on("campaign:leave", (_payload, ack) => {
    detachSocket(socket, { silent: false });
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("campaign:setTmw", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const value = Math.max(0, Number((payload && payload.value) || 0));
    const token = socket.data.token;
    const member = token ? campaign.participants.get(token) : null;
    campaign.shared.tmw = value;
    campaign.updatedAt = Date.now();
    addLog(campaign, "tmw", `${member ? member.name : "Someone"} set Teamwork to ${value}.`, { value });

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, value, authoritativeAt: campaign.updatedAt });
  });

  socket.on("campaign:deltaTmw", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const delta = Number((payload && payload.delta) || 0);
    const next = Math.max(0, Number(campaign.shared.tmw || 0) + delta);
    const token = socket.data.token;
    const member = token ? campaign.participants.get(token) : null;
    campaign.shared.tmw = next;
    campaign.updatedAt = Date.now();
    addLog(campaign, "tmw", `${member ? member.name : "Someone"} changed Teamwork by ${delta > 0 ? "+" : ""}${delta} (now ${next}).`, { delta, value: next });

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, value: next, authoritativeAt: campaign.updatedAt });
  });

  socket.on("campaign:deltaMentalStress", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const delta = Number((payload && payload.delta) || 0);
    if (!Number.isFinite(delta) || delta === 0) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid mental stress delta." });
      return;
    }

    const sharedState = campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
      ? campaign.shared.state
      : {};
    const next = Math.max(0, Number(sharedState.mentalStress || 0) + delta);
    sharedState.mentalStress = next;
    campaign.shared.state = sharedState;
    campaign.shared.stateVersion = Math.max(0, Number(campaign.shared.stateVersion || 0)) + 1;
    campaign.updatedAt = Date.now();

    const token = socket.data.token;
    const member = token ? campaign.participants.get(token) : null;
    addLog(
      campaign,
      "system",
      `${member ? member.name : "Someone"} changed shared Mental Stress by ${delta > 0 ? "+" : ""}${delta} (now ${next}).`,
      { token: token || "", delta, mentalStress: next }
    );

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, mentalStress: next, stateVersion: campaign.shared.stateVersion, authoritativeAt: campaign.updatedAt });
  });

  socket.on("campaign:deltaCredits", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const delta = Number((payload && payload.delta) || 0);
    if (!Number.isFinite(delta) || delta === 0) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid credits delta." });
      return;
    }

    const sharedState = campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
      ? campaign.shared.state
      : {};
    const next = Math.max(0, Number(sharedState.credits || 0) + delta);
    sharedState.credits = next;
    campaign.shared.state = sharedState;
    campaign.shared.stateVersion = Math.max(0, Number(campaign.shared.stateVersion || 0)) + 1;
    campaign.updatedAt = Date.now();

    const token = socket.data.token;
    const member = token ? campaign.participants.get(token) : null;
    addLog(
      campaign,
      "system",
      `${member ? member.name : "Someone"} changed shared Credits by ${delta > 0 ? "+" : ""}${delta} (now ${next}).`,
      { token: token || "", delta, credits: next }
    );

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, credits: next, stateVersion: campaign.shared.stateVersion, authoritativeAt: campaign.updatedAt });
  });

  socket.on("campaign:deltaRenown", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const delta = Number((payload && payload.delta) || 0);
    if (!Number.isFinite(delta) || delta === 0) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid renown delta." });
      return;
    }

    const sharedState = campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
      ? campaign.shared.state
      : {};
    const next = Math.max(0, Number(sharedState.renown || 0) + delta);
    sharedState.renown = next;
    campaign.shared.state = sharedState;
    campaign.shared.stateVersion = Math.max(0, Number(campaign.shared.stateVersion || 0)) + 1;
    campaign.updatedAt = Date.now();

    const token = socket.data.token;
    const member = token ? campaign.participants.get(token) : null;
    addLog(
      campaign,
      "system",
      `${member ? member.name : "Someone"} changed shared Renown by ${delta > 0 ? "+" : ""}${delta} (now ${next}).`,
      { token: token || "", delta, renown: next }
    );

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, renown: next, stateVersion: campaign.shared.stateVersion, authoritativeAt: campaign.updatedAt });
  });

  socket.on("campaign:stashShare", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const item = String((payload && payload.item) || "").trim();
    if (!item) {
      if (typeof ack === "function") ack({ ok: false, error: "No item provided." });
      return;
    }

    const sharedState = campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
      ? campaign.shared.state
      : {};
    const stash = Array.isArray(sharedState.partyStash) ? sharedState.partyStash.slice() : [];
    stash.push(item);
    sharedState.partyStash = stash;
    campaign.shared.state = sharedState;
    campaign.shared.stateVersion = Math.max(0, Number(campaign.shared.stateVersion || 0)) + 1;
    campaign.updatedAt = Date.now();

    const token = socket.data.token;
    const member = token ? campaign.participants.get(token) : null;
    addLog(campaign, "system", `${member ? member.name : "Someone"} shared ${item} to the party stash.`, {
      token: token || "",
      item,
      action: "stash-share"
    });

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, stateVersion: campaign.shared.stateVersion, authoritativeAt: campaign.updatedAt });
  });

  socket.on("campaign:stashClaim", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const idx = Math.max(0, Number((payload && payload.index) || 0));
    const sharedState = campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
      ? campaign.shared.state
      : {};
    const stash = Array.isArray(sharedState.partyStash) ? sharedState.partyStash.slice() : [];
    const item = String(stash[idx] || "").trim();
    if (!item) {
      if (typeof ack === "function") ack({ ok: false, error: "That stash item is no longer available." });
      return;
    }

    stash.splice(idx, 1);
    sharedState.partyStash = stash;
    campaign.shared.state = sharedState;
    campaign.shared.stateVersion = Math.max(0, Number(campaign.shared.stateVersion || 0)) + 1;
    campaign.updatedAt = Date.now();

    const token = socket.data.token;
    const member = token ? campaign.participants.get(token) : null;
    addLog(campaign, "system", `${member ? member.name : "Someone"} claimed ${item} from the party stash.`, {
      token: token || "",
      item,
      action: "stash-claim"
    });

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, item, stateVersion: campaign.shared.stateVersion, authoritativeAt: campaign.updatedAt });
  });

  socket.on("campaign:syncState", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const incoming = payload && payload.state && typeof payload.state === "object"
      ? payload.state
      : null;
    if (!incoming) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid shared state payload." });
      return;
    }

    const existingState = campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
      ? campaign.shared.state
      : {};
    const token = socket.data.token || "";
    const member = token ? campaign.participants.get(token) : null;
    const gmAuthority = isGm(campaign, token);
    const conflicts = [];
    let merged = Object.assign({}, existingState, incoming);

    if (!gmAuthority) {
      merged = mergeAllowedPlayerState(existingState, incoming, token, conflicts);
    } else if (
      incoming.provinceSelections && typeof incoming.provinceSelections === "object" &&
      !Array.isArray(incoming.provinceSelections)
    ) {
      const currentSelections = existingState.provinceSelections && typeof existingState.provinceSelections === "object" && !Array.isArray(existingState.provinceSelections)
        ? existingState.provinceSelections
        : {};
      merged.provinceSelections = Object.assign({}, currentSelections, incoming.provinceSelections);
    }
    if (gmAuthority) {
      if (Array.isArray(incoming.activeMissions)) {
        merged.activeMissions = mergeSharedMissionLists(existingState.activeMissions, incoming.activeMissions);
      }
      if (Array.isArray(incoming.completedMissions)) {
        merged.completedMissions = mergeSharedMissionLists(existingState.completedMissions, incoming.completedMissions);
      }
      if (incoming.missionTokens && typeof incoming.missionTokens === "object" && !Array.isArray(incoming.missionTokens)) {
        const existingTokens = existingState.missionTokens && typeof existingState.missionTokens === "object"
          ? safeClone(existingState.missionTokens) || {}
          : {};
        merged.missionTokens = Object.assign({}, existingTokens, safeClone(incoming.missionTokens) || {});
      }
    }
    if (Array.isArray(incoming.economyLedger)) {
      const existingLedger = Array.isArray(existingState.economyLedger) ? existingState.economyLedger : [];
      const combined = existingLedger.concat(incoming.economyLedger);
      const seen = new Set();
      const deduped = [];
      for (let i = 0; i < combined.length; i += 1) {
        const row = combined[i];
        if (!row || typeof row !== "object") continue;
        const id = String(row.id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        deduped.push(row);
      }
      deduped.sort((a, b) => Number(a && a.at || 0) - Number(b && b.at || 0));
      merged.economyLedger = deduped.slice(-220);
    }
    if (Array.isArray(merged.partyStash)) {
      merged.partyStash = merged.partyStash.slice();
    } else if (Array.isArray(existingState.partyStash)) {
      merged.partyStash = existingState.partyStash.slice();
    }
    if (typeof merged.mentalStress === "number") {
      merged.mentalStress = Math.max(0, Number(merged.mentalStress || 0));
    } else if (typeof existingState.mentalStress === "number") {
      merged.mentalStress = Math.max(0, Number(existingState.mentalStress || 0));
    }
    if (typeof merged.credits === "number") {
      merged.credits = Math.max(0, Number(merged.credits || 0));
    } else if (typeof existingState.credits === "number") {
      merged.credits = Math.max(0, Number(existingState.credits || 0));
    }
    if (typeof merged.renown === "number") {
      merged.renown = Math.max(0, Number(merged.renown || 0));
    } else if (typeof existingState.renown === "number") {
      merged.renown = Math.max(0, Number(existingState.renown || 0));
    }
    normalizeSharedMissionCollections(merged);

    campaign.shared.state = merged;
    campaign.shared.stateVersion = Math.max(0, Number(campaign.shared.stateVersion || 0)) + 1;
    campaign.updatedAt = Date.now();

    if (conflicts.length) {
      const conflictKey = `${token || "unknown"}:${conflicts.slice().sort().join(",")}`;
      const now = Date.now();
      if (campaign.lastConflictLogKey !== conflictKey || (now - Number(campaign.lastConflictLogAt || 0)) > 30000) {
        campaign.lastConflictLogKey = conflictKey;
        campaign.lastConflictLogAt = now;
        addLog(
          campaign,
          "system",
          `${member ? member.name : "Player"} sync had protected keys ignored: ${conflicts.join(", ")}.`,
          { token: token || "", conflicts }
        );
      }
    }

    campaign.updatedAt = Date.now();
    schedulePersist();

    emitCampaignState(campaign.code);
    if (typeof ack === "function") {
      ack({ ok: true, stateVersion: campaign.shared.stateVersion, conflicts, authoritativeAt: campaign.updatedAt });
    }
  });

  socket.on("campaign:provinceEncounterResult", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const provinceKey = String((payload && payload.provinceKey) || "").trim();
    const encounterHtml = String((payload && payload.encounterHtml) || "").trim();
    if (!provinceKey || !encounterHtml) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid province encounter payload." });
      return;
    }

    const parts = provinceKey.split(",");
    const col = Number(parts[0]);
    const row = Number(parts[1]);
    if (!Number.isFinite(col) || !Number.isFinite(row)) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid province key." });
      return;
    }

    const sharedState = campaign.shared && campaign.shared.state && typeof campaign.shared.state === "object"
      ? campaign.shared.state
      : {};
    const provinceMap = sharedState.provinceMap && typeof sharedState.provinceMap === "object"
      ? safeClone(sharedState.provinceMap) || {}
      : {};
    const mapData = Array.isArray(provinceMap.mapData) ? provinceMap.mapData.slice() : [];
    let found = false;

    for (let i = 0; i < mapData.length; i += 1) {
      const hex = mapData[i];
      if (!hex || Number(hex.col) !== col || Number(hex.row) !== row) continue;
      const data = hex.data && typeof hex.data === "object" ? Object.assign({}, hex.data) : {};
      data.lastEncounterHtml = encounterHtml.slice(0, 18000);
      mapData[i] = Object.assign({}, hex, { data });
      found = true;
      break;
    }

    if (!found) {
      if (typeof ack === "function") ack({ ok: false, error: "Province hex not found in shared map." });
      return;
    }

    provinceMap.mapData = mapData;
    sharedState.provinceMap = provinceMap;
    campaign.shared.state = sharedState;
    campaign.shared.stateVersion = Math.max(0, Number(campaign.shared.stateVersion || 0)) + 1;
    campaign.updatedAt = Date.now();
    schedulePersist();

    const token = socket.data.token || "";
    const member = token ? campaign.participants.get(token) : null;
    addLog(campaign, "system", `${member ? member.name : "Player"} synced province encounter @ ${provinceKey}.`, {
      token,
      provinceKey,
      action: "province-encounter-sync"
    });

    emitCampaignState(campaign.code);
    if (typeof ack === "function") {
      ack({ ok: true, stateVersion: campaign.shared.stateVersion, authoritativeAt: campaign.updatedAt });
    }
  });

  socket.on("campaign:requestResync", (_payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }
    const token = String(socket.data.token || "");
    const member = token ? campaign.participants.get(token) : null;
    addLog(
      campaign,
      "system",
      `${member ? member.name : "Player"} requested an authoritative resync.`,
      { token }
    );

    const gmSocketIds = [];
    campaign.sessions.forEach((sessionToken, socketId) => {
      if (campaign.gmToken && sessionToken === campaign.gmToken) {
        gmSocketIds.push(socketId);
      }
    });

    if (gmSocketIds.length) {
      for (let i = 0; i < gmSocketIds.length; i += 1) {
        io.to(gmSocketIds[i]).emit("campaign:resyncRequested", {
          code: campaign.code,
          requesterToken: token,
          requesterName: member ? member.name : "Player",
          requestedAt: Date.now()
        });
      }
    }

    emitCampaignState(campaign.code);
    if (typeof ack === "function") {
      ack({
        ok: true,
        gmOnline: gmSocketIds.length > 0,
        stateVersion: Math.max(0, Number(campaign.shared.stateVersion || 0)),
        authoritativeAt: campaign.updatedAt
      });
    }
  });

  socket.on("campaign:chat", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const message = String((payload && payload.message) || "").trim().slice(0, 500);
    if (!message) {
      if (typeof ack === "function") ack({ ok: false, error: "Message is empty." });
      return;
    }

    const token = socket.data.token;
    const member = token ? campaign.participants.get(token) : null;
    const name = member ? member.name : "Player";
    const senderIsGm = !!(token && campaign.gmToken && token === campaign.gmToken);

    const requestedChannel = String((payload && payload.channel) || "ic").trim().toLowerCase();
    const channel = ["ic", "ooc", "whisper", "gm", "system"].includes(requestedChannel)
      ? requestedChannel
      : "ic";
    const targetToken = String((payload && payload.targetToken) || "").trim();

    if (channel === "gm" && !senderIsGm) {
      if (typeof ack === "function") ack({ ok: false, error: "Only GM can send GM-only messages." });
      return;
    }

    if (channel === "whisper" && (!targetToken || !campaign.participants.has(targetToken))) {
      if (typeof ack === "function") ack({ ok: false, error: "Whisper target is invalid." });
      return;
    }

    const targetMember = channel === "whisper" && targetToken ? campaign.participants.get(targetToken) : null;
    const visibility = channel === "whisper" ? "targeted" : (channel === "gm" ? "gm" : "public");
    const tagged = channel === "ic"
      ? `${name}: ${message}`
      : channel === "ooc"
        ? `[OOC] ${name}: ${message}`
        : channel === "whisper"
          ? `[Whisper ${name} -> ${targetMember ? targetMember.name : "Unknown"}] ${message}`
          : channel === "gm"
            ? `[GM] ${name}: ${message}`
            : `[System] ${name}: ${message}`;

    addLog(campaign, "chat", tagged, {
      token: token || "",
      name,
      message,
      channel,
      targetToken: channel === "whisper" ? targetToken : "",
      visibility
    });

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("campaign:privateNote", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const token = socket.data.token;
    if (!token || !campaign.participants.has(token)) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid participant session." });
      return;
    }

    const text = String((payload && payload.text) || "").slice(0, 5000);
    const trimmed = text.trim();
    if (!trimmed) {
      campaign.privateNotes.delete(token);
    } else {
      campaign.privateNotes.set(token, {
        token,
        text,
        updatedAt: Date.now()
      });
    }

    const participant = campaign.participants.get(token);
    addLog(campaign, "note", `${participant ? participant.name : "Player"} updated private notes.`, {
      token
    });
    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("campaign:updateCharacter", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const token = socket.data.token;
    if (!token || !campaign.participants.has(token)) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid participant session." });
      return;
    }

    const participant = campaign.participants.get(token);
    participant.character = normalizeCharacter(payload && payload.character, participant.name);
    participant.lastSeenAt = Date.now();
    campaign.updatedAt = Date.now();
    schedulePersist();

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("campaign:archive", (_payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }
    const token = socket.data.token;
    if (!requireGmAction(campaign, token, "campaign:archive", ack)) return;
    campaign.archived = true;
    addLog(campaign, "system", "GM archived this campaign.");
    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("campaign:unarchive", (_payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }
    const token = socket.data.token;
    if (!requireGmAction(campaign, token, "campaign:unarchive", ack)) return;
    campaign.archived = false;
    addLog(campaign, "system", "GM reopened this campaign.");
    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("campaign:setPassword", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }
    const token = socket.data.token;
    if (!requireGmAction(campaign, token, "campaign:setPassword", ack)) return;

    const password = String((payload && payload.password) || "").trim();
    if (!password) {
      campaign.passwordHash = "";
      campaign.passwordSalt = "";
      addLog(campaign, "system", "GM removed the campaign password.");
    } else {
      const pack = createPasswordPack(password);
      campaign.passwordHash = pack.hash;
      campaign.passwordSalt = pack.salt;
      addLog(campaign, "system", "GM updated the campaign password.");
    }
    campaign.updatedAt = Date.now();
    schedulePersist();
    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, hasPassword: !!campaign.passwordHash });
  });

  socket.on("campaign:delete", (_payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }
    const token = socket.data.token;
    if (!requireGmAction(campaign, token, "campaign:delete", ack)) return;

    campaign.sessions.forEach((_t, socketId) => {
      io.to(socketId).emit("campaign:deleted", {
        code: campaign.code,
        message: "Campaign deleted by GM."
      });
      const client = io.sockets.sockets.get(socketId);
      if (client) {
        client.leave(campaign.code);
        client.data.campaignCode = "";
        client.data.role = "";
        client.data.token = "";
      }
    });

    campaigns.delete(campaign.code);
    schedulePersist();
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("campaign:rollRequest", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const token = socket.data.token;
    if (!requireGmAction(campaign, token, "campaign:rollRequest", ack)) return;

    const dread = Math.max(1, Number((payload && payload.dread) || 8));
    const stat = String((payload && payload.stat) || "valor").trim().slice(0, 32) || "valor";
    const label = String((payload && payload.label) || "GM Check").trim().slice(0, 80) || "GM Check";
    const pendingCheckId = String((payload && payload.pendingCheckId) || "").trim();
    const targetToken = String((payload && payload.targetToken) || "").trim();
    const targetMember = targetToken ? campaign.participants.get(targetToken) : null;
    if (targetToken && (!targetMember || targetMember.role !== "player")) {
      if (typeof ack === "function") ack({ ok: false, error: "Prompt target must be an active player token." });
      return;
    }

    campaign.activeRollRequest = {
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      stat,
      dread,
      label,
      pendingCheckId,
      targetToken: targetToken || "",
      targetName: targetMember ? String(targetMember.name || "") : "",
      createdAt: Date.now(),
      responses: []
    };

    const gm = campaign.participants.get(token);
    addLog(campaign, "roll", `${gm ? gm.name : "GM"} called ${label}: ${stat.toUpperCase()} vs Dread d${dread}${targetMember ? ` for ${targetMember.name}` : ""}.`, {
      stat,
      dread,
      label,
      targetToken: targetToken || "",
      targetName: targetMember ? String(targetMember.name || "") : ""
    });

    emitCampaignState(campaign.code);
    if (typeof ack === "function") ack({ ok: true, requestId: campaign.activeRollRequest.id });
  });

  socket.on("campaign:rollSubmit", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign || !campaign.activeRollRequest) {
      if (typeof ack === "function") ack({ ok: false, error: "No active roll request." });
      return;
    }

    const requestId = String((payload && payload.requestId) || "");
    if (requestId !== campaign.activeRollRequest.id) {
      if (typeof ack === "function") ack({ ok: false, error: "Roll request is no longer active." });
      return;
    }

    const total = Math.max(0, Number((payload && payload.total) || 0));
    const dreadTotal = Math.max(0, Number((payload && payload.dreadTotal) || 0));
    const die = Math.max(1, Number((payload && payload.die) || 4));

    const token = socket.data.token || "";
    const rollTargetToken = String((campaign.activeRollRequest && campaign.activeRollRequest.targetToken) || "");
    if (rollTargetToken && token !== rollTargetToken) {
      if (typeof ack === "function") ack({ ok: false, error: "This roll request targets another player." });
      return;
    }
    const member = token ? campaign.participants.get(token) : null;
    const response = {
      token,
      name: member ? member.name : "Player",
      role: member ? member.role : "player",
      total,
      dreadTotal,
      die,
      success: total >= dreadTotal,
      at: Date.now()
    };

    const existingIdx = campaign.activeRollRequest.responses.findIndex((resp) => resp.token === token);
    if (existingIdx >= 0) {
      campaign.activeRollRequest.responses[existingIdx] = response;
    } else {
      campaign.activeRollRequest.responses.push(response);
    }

    addLog(
      campaign,
      "roll-result",
      `${response.name} rolled ${campaign.activeRollRequest.stat.toUpperCase()} d${response.die}: ${response.total} vs ${response.dreadTotal} (${response.success ? "success" : "fail"}).`,
      response
    );
    emitCampaignState(campaign.code);

    if (typeof ack === "function") ack({ ok: true, response });
  });

  socket.on("campaign:closeRoll", (_payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }

    const token = socket.data.token;
    if (!requireGmAction(campaign, token, "campaign:closeRoll", ack)) return;

    campaign.activeRollRequest = null;
    addLog(campaign, "roll", "GM closed the active roll request.");
    emitCampaignState(campaign.code);

    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("campaign:exportSnapshot", (_payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }
    const token = socket.data.token;
    if (!requireGmAction(campaign, token, "campaign:exportSnapshot", ack)) return;
    const snapshot = makeCampaignExportSnapshot(campaign);
    if (typeof ack === "function") ack({ ok: true, snapshot });
  });

  socket.on("campaign:importSnapshot", (payload, ack) => {
    const campaign = getCampaignBySocket(socket);
    if (!campaign) {
      if (typeof ack === "function") ack({ ok: false, error: "Not connected to a campaign." });
      return;
    }
    const token = socket.data.token;
    if (!requireGmAction(campaign, token, "campaign:importSnapshot", ack)) return;
    const result = applyCampaignImportSnapshot(campaign, payload && payload.snapshot);
    if (!result.ok) {
      if (typeof ack === "function") ack(result);
      return;
    }
    addLog(campaign, "system", "GM imported a campaign snapshot.", { token: token || "" });
    emitCampaignState(campaign.code);
    if (typeof ack === "function") {
      ack({ ok: true, stateVersion: Math.max(0, Number(campaign.shared.stateVersion || 0)), authoritativeAt: campaign.updatedAt });
    }
  });

  socket.on("disconnect", () => {
    detachSocket(socket, { silent: true });
  });
});

process.on("SIGINT", () => {
  persistLicenseStoreSafe();
  try {
    persistCampaignsNow();
  } catch (_err) { console.error(_err); }
  process.exit(0);
});

process.on("SIGTERM", () => {
  persistLicenseStoreSafe();
  try {
    persistCampaignsNow();
  } catch (_err) { console.error(_err); }
  process.exit(0);
});

server.listen(PORT, HOST, () => {
  const hostLabel = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`BEYOND-THE-LIGHT campaign server running at http://${hostLabel}:${PORT}`);
});
